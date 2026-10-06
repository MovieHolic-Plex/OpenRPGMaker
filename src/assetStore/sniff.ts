/**
 * blob 바이트의 실제 형식을 시그니처로 판정한다. 확장자·선언된 mime 은 믿지 않는다.
 * 서버 업로드 검증과 Electron 메인의 받은 바이트 검증이 같이 쓴다.
 */
import type { StoreBlobMime } from "./format";

const startsWith = (bytes: Uint8Array, sig: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + sig.length && sig.every((value, index) => bytes[offset + index] === value);
const ascii = (bytes: Uint8Array, offset: number, text: string): boolean =>
  startsWith(bytes, [...text].map((c) => c.charCodeAt(0)), offset);

export function sniffMime(bytes: Uint8Array): StoreBlobMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WAVE")) return "audio/wav";
  if (ascii(bytes, 0, "OggS")) return "audio/ogg";
  if (ascii(bytes, 0, "ID3") || (bytes.length > 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(bytes, 4, "ftyp") && (ascii(bytes, 8, "M4A ") || ascii(bytes, 8, "mp42") || ascii(bytes, 8, "isom") || ascii(bytes, 8, "M4B "))) return "audio/mp4";
  return null;
}

/** PNG IHDR 의 가로·세로. PNG 가 아니면 null. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (sniffMime(bytes) !== "image/png" || bytes.length < 24 || !ascii(bytes, 12, "IHDR")) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export const MIME_EXTENSIONS: Readonly<Record<StoreBlobMime, string>> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a",
};

export function dataUrlParts(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/is.exec(dataUrl);
  return match ? { mime: match[1]!.toLowerCase(), base64: match[2]! } : null;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  return btoa(binary);
}
