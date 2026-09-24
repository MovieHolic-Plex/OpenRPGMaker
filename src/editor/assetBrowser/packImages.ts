export type PackImageRole = "tilemap" | "single" | "other";

export type PackImage = {
  readonly name: string;
  readonly role: PackImageRole;
  readonly width: number | null;
  readonly height: number | null;
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;
const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD = 0x06054b50;

type ZipEntry = {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
};

export async function listPackImages(fileName: string, bytes: Uint8Array): Promise<readonly PackImage[]> {
  if (!isZip(bytes)) {
    const size = imageSize(bytes);
    if (!isImageName(fileName) || size === null) return [];
    return [{ name: fileName, role: classify(size.width, size.height), width: size.width, height: size.height }];
  }
  const images: PackImage[] = [];
  for (const entry of listZipEntries(bytes)) {
    if (!isSafeZipName(entry.name) || !isImageName(entry.name)) continue;
    const data = await readZipEntry(bytes, entry);
    const size = imageSize(data);
    images.push({
      name: entry.name,
      role: size === null ? "other" : classify(size.width, size.height),
      width: size?.width ?? null,
      height: size?.height ?? null,
    });
  }
  return images;
}

export async function extractPackImage(fileName: string, bytes: Uint8Array, entryName: string): Promise<Uint8Array> {
  if (!isZip(bytes)) {
    if (entryName !== fileName) throw new Error("고른 그림이 받은 파일과 다릅니다.");
    return bytes;
  }
  const entry = listZipEntries(bytes).find((candidate) => candidate.name === entryName);
  if (entry === undefined || !isSafeZipName(entry.name)) throw new Error("압축 안에서 고른 그림을 찾지 못했습니다.");
  return readZipEntry(bytes, entry);
}

export function suggestPackImage(images: readonly PackImage[]): PackImage | null {
  const sheets = images.filter((image) => image.role === "tilemap");
  if (sheets.length === 0) return null;
  return sheets.reduce((best, image) => (area(image) > area(best) ? image : best));
}

function classify(width: number, height: number): PackImageRole {
  if (width <= 48 && height <= 48) return "single";
  if (width >= 32 && height >= 32 && width % 16 === 0 && height % 16 === 0 && width * height >= 128 * 64) return "tilemap";
  return "other";
}

function area(image: PackImage): number {
  return (image.width ?? 0) * (image.height ?? 0);
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isImageName(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isSafeZipName(name: string): boolean {
  if (name.length === 0 || name.startsWith("/") || name.includes("\\")) return false;
  if (name.split("/").includes("..")) return false;
  if (name.includes("__MACOSX")) return false;
  return true;
}

function listZipEntries(bytes: Uint8Array): readonly ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error("압축 목차를 찾지 못했습니다.");
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_HEADER) throw new Error("압축 목차가 손상되었습니다.");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name.endsWith("/")) entries.push({ name, method, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== LOCAL_HEADER) throw new Error("압축 항목이 손상되었습니다.");
  const flags = view.getUint16(offset + 6, true);
  if ((flags & 0x1) !== 0) throw new Error("암호가 걸린 압축은 열 수 없습니다.");
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error("이 압축 방식은 열 수 없습니다.");
  const stream = new Blob([compressed.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 65535);
  for (let index = view.byteLength - 22; index >= min; index -= 1) {
    if (view.getUint32(index, true) === EOCD) return index;
  }
  return -1;
}

function imageSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes) ?? gifSize(bytes);
}

function pngSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function gifSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== "GIF") return null;
  return { width: at(bytes, 6) + (at(bytes, 7) << 8), height: at(bytes, 8) + (at(bytes, 9) << 8) };
}

function webpSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP" || ascii(bytes, 12, 4) !== "VP8X") return null;
  return {
    width: 1 + at(bytes, 24) + (at(bytes, 25) << 8) + (at(bytes, 26) << 16),
    height: 1 + at(bytes, 27) + (at(bytes, 28) << 8) + (at(bytes, 29) << 16),
  };
}

function jpegSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let cursor = 2;
  while (cursor + 9 < bytes.length) {
    if (bytes[cursor] !== 0xff) return null;
    const marker = at(bytes, cursor + 1);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: (at(bytes, cursor + 5) << 8) + at(bytes, cursor + 6), width: (at(bytes, cursor + 7) << 8) + at(bytes, cursor + 8) };
    }
    const length = (at(bytes, cursor + 2) << 8) + at(bytes, cursor + 3);
    if (length < 2) return null;
    cursor += 2 + length;
  }
  return null;
}

function at(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}
