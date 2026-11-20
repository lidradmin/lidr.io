import exifReader from "exif-reader";
import sharp from "sharp";
import { beforeAll, describe, expect, test } from "vitest";
import { NotJpegError, stripJpegMetadata } from "./jpeg";
import { MemoryKV } from "./testing";
import { handleUpload, listPendingPhotos, signUploadToken, verifyUploadToken, type UploadClaims } from "./upload";

let gpsJpeg: Uint8Array;
beforeAll(async () => {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#7a7" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "secret" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "0/1 7/1 0/1" } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="51,30N"/></rdf:RDF></x:xmpmeta>')
    .toBuffer();
  gpsJpeg = new Uint8Array(buf);
  const info = exifReader((await sharp(buf).metadata()).exif!).GPSInfo;
  expect(info?.GPSLatitude).toBeDefined(); // the fixture really has GPS
});

describe("stripJpegMetadata", () => {
  test("removes EXIF (incl. GPS) and XMP but keeps a valid image", async () => {
    const out = stripJpegMetadata(gpsJpeg);
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect([meta.width, meta.height, meta.format]).toEqual([64, 48, "jpeg"]);
    expect(out.length).toBeLessThan(gpsJpeg.length);
  });
  test("drops images appended after the end marker (phone depth/gain maps with their own GPS)", async () => {
    const plain = new Uint8Array(await sharp({ create: { width: 32, height: 24, channels: 3, background: "#333" } }).jpeg().toBuffer());
    const combined = new Uint8Array(plain.length + gpsJpeg.length);
    combined.set(plain);
    combined.set(gpsJpeg, plain.length);
    const out = stripJpegMetadata(combined);
    expect(out.length).toBeLessThanOrEqual(plain.length);
    expect(Buffer.from(out).includes(Buffer.from("Exif"))).toBe(false);
    expect((await sharp(out).metadata()).width).toBe(32);
  });
  test("drops MPF/C2PA-style APP segments but keeps the ICC profile", async () => {
    const withIcc = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 3, background: "#a33" } }).jpeg().withIccProfile("srgb").toBuffer());
    const seg = (marker: number, payload: string) => {
      const body = new TextEncoder().encode(payload);
      return new Uint8Array([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]);
    };
    const mpf = seg(0xe2, "MPF\0secret-gps");
    const c2pa = seg(0xeb, "JP\0\0secret-gps");
    const input = new Uint8Array([...withIcc.subarray(0, 2), ...mpf, ...c2pa, ...withIcc.subarray(2)]);
    const out = stripJpegMetadata(input);
    expect(Buffer.from(out).includes(Buffer.from("secret-gps"))).toBe(false);
    expect(Buffer.from(out).includes(Buffer.from("ICC_PROFILE"))).toBe(true);
    expect((await sharp(out).metadata()).icc).toBeDefined();
  });
  test("progressive JPEGs (several scans) survive intact", async () => {
    const prog = new Uint8Array(await sharp(Buffer.from(gpsJpeg)).jpeg({ progressive: true }).withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "1/1 2/1 3/1" } }).toBuffer());
    const out = stripJpegMetadata(prog);
    const before = await sharp(Buffer.from(prog)).raw().toBuffer();
    const after = await sharp(out).raw().toBuffer();
    expect(Buffer.compare(before, after)).toBe(0);
    expect((await sharp(out).metadata()).exif).toBeUndefined();
  });
  test("rejects anything that isn't a JPEG", () => {
    expect(() => stripJpegMetadata(new TextEncoder().encode("GIF89a..."))).toThrow(NotJpegError);
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8]))).toThrow(NotJpegError);
  });
});

const KEY = "k".repeat(48);
const claims = (over: Partial<UploadClaims> = {}): UploadClaims => ({ u: 7, s: "a-post", f: "cover.jpg", k: "cover", exp: Date.now() + 60_000, ...over });

describe("upload tokens", () => {
  test("round-trip", async () => {
    const kv = new MemoryKV();
    const t = await signUploadToken(claims(), KEY);
    expect(await verifyUploadToken(t, KEY, kv)).toMatchObject({ u: 7, s: "a-post", f: "cover.jpg" });
  });
  test("single use", async () => {
    const kv = new MemoryKV();
    const t = await signUploadToken(claims(), KEY);
    await verifyUploadToken(t, KEY, kv);
    await expect(verifyUploadToken(t, KEY, kv)).rejects.toThrow(/already been used/);
  });
  test("expired, tampered and wrong key are refused", async () => {
    const kv = new MemoryKV();
    await expect(verifyUploadToken(await signUploadToken(claims({ exp: Date.now() - 1 }), KEY), KEY, kv)).rejects.toThrow(/expired/);
    const t = await signUploadToken(claims(), KEY);
    const [p, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ ...claims(), s: "other" })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    await expect(verifyUploadToken(`${forged}.${sig}`, KEY, kv)).rejects.toThrow(/isn't valid/);
    await expect(verifyUploadToken(`${p}.${sig}`, "x".repeat(48), kv)).rejects.toThrow(/isn't valid/);
    await expect(verifyUploadToken("garbage", KEY, kv)).rejects.toThrow(/isn't valid/);
  });
});

describe("handleUpload", () => {
  const up = async (body: BodyInit, token: string, kv: MemoryKV, method = "POST") =>
    handleUpload(new Request(`https://mcp.example/upload/${token}`, { method, body: method === "POST" ? body : undefined }), token, { kv, signingKey: KEY });

  test("stores a stripped JPEG and returns its public path", async () => {
    const kv = new MemoryKV();
    const t = await signUploadToken(claims({ alt: "Rebar cage" }), KEY);
    const res = await up(gpsJpeg, t, kv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, path: "/images/blog/a-post/cover.jpg", message: expect.stringContaining("Uploaded") });
    const pending = await listPendingPhotos(kv, 7, "a-post");
    expect(pending.map((p) => p.file)).toEqual(["cover.jpg"]);
    expect(pending[0].alt).toBe("Rebar cage");
    const stored = new Uint8Array((await kv.get(pending[0].key, "arrayBuffer"))!);
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
  });

  test("refuses non-JPEG, oversize, empty and wrong method with plain messages", async () => {
    const kv = new MemoryKV();
    let res = await up(new TextEncoder().encode("PNG..."), await signUploadToken(claims(), KEY), kv);
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: string }).error).toMatch(/JPEG/);
    res = await up(new Uint8Array(15 * 1024 * 1024 + 1), await signUploadToken(claims(), KEY), kv);
    expect(res.status).toBe(413);
    res = await up(new Uint8Array(0), await signUploadToken(claims(), KEY), kv);
    expect(res.status).toBe(400);
    res = await up("", await signUploadToken(claims(), KEY), kv, "GET");
    expect(res.status).toBe(405);
  });

  test("if storing fails, the link isn't used up", async () => {
    const kv = new MemoryKV();
    const t = await signUploadToken(claims(), KEY);
    const realPut = kv.put.bind(kv);
    kv.put = async () => { throw new Error("KV down"); };
    expect((await up(gpsJpeg, t, kv)).status).toBe(500);
    kv.put = realPut;
    expect((await up(gpsJpeg, t, kv)).status).toBe(200);
  });

  test("a used or bad link is refused before reading the photo", async () => {
    const kv = new MemoryKV();
    const t = await signUploadToken(claims(), KEY);
    expect((await up(gpsJpeg, t, kv)).status).toBe(200);
    const again = await up(gpsJpeg, t, kv);
    expect(again.status).toBe(403);
    expect(((await again.json()) as { error: string }).error).toMatch(/already been used/);
  });
});
