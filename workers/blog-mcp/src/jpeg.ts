/**
 * Removes privacy-sensitive metadata from a JPEG without re-encoding it:
 * APP1 (EXIF incl. GPS, and XMP), APP13 (IPTC/Photoshop) and comments.
 * Everything from the start-of-scan marker onwards is copied unchanged.
 */

export class NotJpegError extends Error {
  constructor() {
    super("The photo isn't a JPEG. Use the exact command from start_photo_upload, which converts it to JPEG first.");
  }
}

const DROP = new Set([0xe1, 0xed, 0xfe]); // APP1, APP13, COM

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new NotJpegError();
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) throw new NotJpegError();
    let marker = input[i + 1];
    // Fill bytes (0xFF padding) before a marker.
    while (marker === 0xff && i + 2 < input.length) {
      i++;
      marker = input[i + 1];
    }
    if (marker === undefined) throw new NotJpegError();
    if (marker === 0xda || marker === 0xd9) {
      out.push(input.subarray(i)); // start of scan (or end): the rest is image data
      return concat(out);
    }
    // Standalone markers (RSTn, TEM) carry no length.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > input.length) throw new NotJpegError();
    const len = (input[i + 2] << 8) | input[i + 3];
    const end = i + 2 + len;
    if (len < 2 || end > input.length) throw new NotJpegError();
    if (!DROP.has(marker)) out.push(input.subarray(i, end));
    i = end;
  }
  throw new NotJpegError(); // no image data
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
