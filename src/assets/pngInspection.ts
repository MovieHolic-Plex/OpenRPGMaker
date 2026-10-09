const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

export type PngInspection = {
  readonly format: "png";
  readonly width: number;
  readonly height: number;
  readonly mode: "rgb" | "rgba";
  readonly byteSize: number;
  readonly transparentPixels: number;
  readonly opaqueColorKeyPixels: number;
  readonly nonblank: boolean;
};

export type PngInspectionResult =
  | { readonly ok: true; readonly inspection: PngInspection }
  | { readonly ok: false; readonly reason: string };

type PngHeader = {
  readonly width: number;
  readonly height: number;
  readonly colorType: 2 | 6;
  readonly idat: Uint8Array;
};

type PngHeaderResult =
  | { readonly ok: true; readonly header: PngHeader }
  | { readonly ok: false; readonly reason: string };

export async function inspectPngBytes(bytes: Uint8Array): Promise<PngInspectionResult> {
  const header = readPngHeader(bytes);
  if (!header.ok) return header;
  const inflated = await inflateBytes(header.header.idat);
  if (!inflated.ok) return inflated;
  const pixels = decodeScanlines(header.header, inflated.bytes);
  if (!pixels.ok) return pixels;
  return {
    ok: true,
    inspection: {
      format: "png",
      width: header.header.width,
      height: header.header.height,
      mode: header.header.colorType === 6 ? "rgba" : "rgb",
      byteSize: bytes.byteLength,
      transparentPixels: countTransparentPixels(pixels.rgba),
      opaqueColorKeyPixels: countOpaqueColorKeyPixels(pixels.rgba),
      nonblank: hasVisibleVariation(pixels.rgba),
    },
  };
}

function readPngHeader(bytes: Uint8Array): PngHeaderResult {
  if (bytes.byteLength < PNG_SIGNATURE.length) return { ok: false, reason: "file is not a PNG" };
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return { ok: false, reason: "file is not a PNG" };
  }
  if (bytes.byteLength < 33) return { ok: false, reason: "file is too small to be a PNG" };
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let colorType: 2 | 6 | null = null;
  const idatChunks: Uint8Array[] = [];
  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.byteLength) return { ok: false, reason: "PNG chunk length exceeds file size" };
    if (type === "IHDR") {
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      const bitDepth = bytes[dataStart + 8];
      const parsedColorType = bytes[dataStart + 9];
      const interlace = bytes[dataStart + 12];
      if (bitDepth !== 8) return { ok: false, reason: "PNG bit depth must be 8" };
      if (parsedColorType !== 2 && parsedColorType !== 6) return { ok: false, reason: "PNG color type must be RGB or RGBA" };
      if (interlace !== 0) return { ok: false, reason: "interlaced PNGs are not supported" };
      colorType = parsedColorType;
    }
    if (type === "IDAT") idatChunks.push(bytes.slice(dataStart, dataEnd));
    if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  if (width <= 0 || height <= 0 || colorType === null) return { ok: false, reason: "PNG is missing IHDR" };
  if (idatChunks.length === 0) return { ok: false, reason: "PNG is missing IDAT pixels" };
  return { ok: true, header: { width, height, colorType, idat: joinBytes(idatChunks) } };
}

async function inflateBytes(bytes: Uint8Array): Promise<{ readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly reason: string }> {
  try {
    const stableBytes = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(stableBytes).set(bytes);
    const stream = new Blob([stableBytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    for (;;) {
      const read = await reader.read();
      if (read.done) break;
      chunks.push(read.value);
    }
    return { ok: true, bytes: joinBytes(chunks) };
  } catch (error) {
    if (error instanceof Error) return { ok: false, reason: `PNG pixel data cannot be inflated: ${error.message}` };
    throw error;
  }
}

function decodeScanlines(header: PngHeader, raw: Uint8Array): { readonly ok: true; readonly rgba: Uint8Array } | { readonly ok: false; readonly reason: string } {
  const bytesPerPixel = header.colorType === 6 ? 4 : 3;
  const rowLength = header.width * bytesPerPixel;
  const expected = (rowLength + 1) * header.height;
  if (raw.byteLength !== expected) return { ok: false, reason: `PNG pixel payload is ${raw.byteLength} bytes, expected ${expected}` };
  const unfiltered = new Uint8Array(rowLength * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const sourceRow = y * (rowLength + 1);
    const filter = raw[sourceRow];
    if (filter === undefined || filter > 4) return { ok: false, reason: "PNG row uses an unsupported filter" };
    const targetRow = y * rowLength;
    for (let x = 0; x < rowLength; x += 1) {
      const current = raw[sourceRow + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? unfiltered[targetRow + x - bytesPerPixel] ?? 0 : 0;
      const up = y > 0 ? unfiltered[targetRow + x - rowLength] ?? 0 : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? unfiltered[targetRow + x - rowLength - bytesPerPixel] ?? 0 : 0;
      unfiltered[targetRow + x] = unfilterByte(filter, current, left, up, upLeft);
    }
  }
  return { ok: true, rgba: toRgba(header, unfiltered) };
}

function toRgba(header: PngHeader, pixels: Uint8Array): Uint8Array {
  if (header.colorType === 6) return pixels;
  const rgba = new Uint8Array(header.width * header.height * 4);
  for (let source = 0, target = 0; source < pixels.byteLength; source += 3, target += 4) {
    rgba[target] = pixels[source] ?? 0;
    rgba[target + 1] = pixels[source + 1] ?? 0;
    rgba[target + 2] = pixels[source + 2] ?? 0;
    rgba[target + 3] = 255;
  }
  return rgba;
}

function unfilterByte(filter: number, current: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return current;
    case 1:
      return (current + left) & 255;
    case 2:
      return (current + up) & 255;
    case 3:
      return (current + Math.floor((left + up) / 2)) & 255;
    case 4:
      return (current + paeth(left, up, upLeft)) & 255;
    default:
      return current;
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function hasVisibleVariation(rgba: Uint8Array): boolean {
  if (rgba.byteLength < 8) return false;
  const firstR = rgba[0] ?? 0;
  const firstG = rgba[1] ?? 0;
  const firstB = rgba[2] ?? 0;
  const firstA = rgba[3] ?? 0;
  for (let offset = 0; offset <= rgba.byteLength - 4; offset += 4) {
    const alpha = rgba[offset + 3] ?? 0;
    if (alpha === 0) continue;
    if ((rgba[offset] ?? 0) !== firstR || (rgba[offset + 1] ?? 0) !== firstG || (rgba[offset + 2] ?? 0) !== firstB || alpha !== firstA) return true;
  }
  return false;
}

function countTransparentPixels(rgba: Uint8Array): number {
  let total = 0;
  for (let offset = 3; offset < rgba.byteLength; offset += 4) {
    if (rgba[offset] === 0) total += 1;
  }
  return total;
}

function countOpaqueColorKeyPixels(rgba: Uint8Array): number {
  let total = 0;
  for (let offset = 0; offset <= rgba.byteLength - 4; offset += 4) {
    const red = rgba[offset] ?? 0;
    const green = rgba[offset + 1] ?? 0;
    const blue = rgba[offset + 2] ?? 0;
    const alpha = rgba[offset + 3] ?? 0;
    if (alpha > 0 && isColorKey(red, green, blue)) total += 1;
  }
  return total;
}

function isColorKey(red: number, green: number, blue: number): boolean {
  if (red === 255 && green === 0 && blue === 255) return true;
  return red === 255 && green === 103 && blue === 139;
}

function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000 + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)) >>> 0;
}
