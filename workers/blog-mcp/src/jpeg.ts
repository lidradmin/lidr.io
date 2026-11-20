/**
 * Removes privacy-sensitive metadata from a JPEG without re-encoding it.
 *
 * Allowlist, not blocklist: only the segments needed to display the image are
 * kept (APP0 JFIF, APP2 ICC colour profile, APP14 Adobe, and the codec's own
 * tables/frames/scans). Everything else goes: EXIF/GPS and XMP (APP1), MPF
 * (APP2), C2PA/JUMBF (APP11), IPTC (APP13), comments, and any data after the
 * end-of-image marker, where phones append depth/gain-map images (each with its
 * own EXIF) or Motion Photo video.
 */

export class NotJpegError extends Error {
  constructor() {
    super("The photo isn't a JPEG. Use the exact command from start_photo_upload, which converts it to JPEG first.");
  }
}

const ICC = new TextEncoder().encode("ICC_PROFILE\0");

function startsWith(buf: Uint8Array, at: number, prefix: Uint8Array): boolean {
  if (at + prefix.length > buf.length) return false;
  for (let k = 0; k < prefix.length; k++) if (buf[at + k] !== prefix[k]) return false;
  return true;
}

function keepAppSegment(input: Uint8Array, marker: number, start: number): boolean {
  if (marker === 0xe0 || marker === 0xee) return true; // JFIF, Adobe (colour transform)
  if (marker === 0xe2) return startsWith(input, start + 4, ICC); // ICC profile only, not MPF
  return false;
}

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new NotJpegError();
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) throw new NotJpegError();
    while (input[i + 1] === 0xff) i++; // fill bytes before a marker
    const marker = input[i + 1];
    if (marker === undefined) break;

    if (marker === 0xd9) {
      out.push(input.subarray(i, i + 2)); // end of image: drop anything after it
      return concat(out);
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > input.length) break;
    const len = (input[i + 2] << 8) | input[i + 3];
    const end = i + 2 + len;
    if (len < 2 || end > input.length) throw new NotJpegError();

    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xfe || (isApp && !keepAppSegment(input, marker, i))) {
      i = end; // drop comments and non-allowlisted APPn
      continue;
    }
    out.push(input.subarray(i, end));
    i = end;

    if (marker === 0xda) {
      // Start of scan: entropy-coded data runs until the next real marker.
      // Inside it, FF00 is an escaped FF and FFD0–FFD7 are restart markers.
      let j = i;
      while (j < input.length) {
        if (input[j] === 0xff) {
          const next = input[j + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            j += 2;
            continue;
          }
          if (next === 0xff) {
            j++;
            continue;
          }
          break;
        }
        j++;
      }
      out.push(input.subarray(i, j));
      i = j;
    }
  }
  throw new NotJpegError(); // no end-of-image marker
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
