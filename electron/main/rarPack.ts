// 자산 브라우저가 받은 RAR 팩을 그림만 담은 zip 으로 바꾼다 — 렌더러의 팩 읽기(zip 전용)가 그대로 쓴다.
// 제작자 페이지가 zip 대신 rar 한 파일을 주는 팩이 있다(Rasak Modern, RAR5 15MB). 그림은 사용자 PC 에서만 풀린다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createExtractorFromData } from "node-unrar-js";

const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const MAX_UNPACKED_BYTES = 96 * 1024 * 1024;

export function isRar(bytes: Uint8Array): boolean {
  return bytes.length >= 7 && bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21 && bytes[4] === 0x1a && bytes[5] === 0x07;
}

/** RAR 안의 그림 파일만 무압축(stored) zip 으로 묶는다. 경로에 `..`·절대경로가 있는 항목은 뺀다. */
export async function rarImagesToZip(bytes: Uint8Array): Promise<Uint8Array> {
  const wasmBinary = readFileSync(join(__dirname, "unrar.wasm"));
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const extractor = await createExtractorFromData({ data, wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer });
  const names = [...extractor.getFileList().fileHeaders]
    .filter((header) => !header.flags.directory && !header.flags.encrypted && IMAGE.test(header.name) && safeName(header.name))
    .map((header) => header.name);
  const entries: { name: string; data: Uint8Array }[] = [];
  let total = 0;
  for (const file of extractor.extract({ files: names }).files) {
    const content = file.extraction;
    if (!content) continue;
    total += content.byteLength;
    if (total > MAX_UNPACKED_BYTES) throw new Error("압축을 풀면 96MB 가 넘어 가져오지 않습니다.");
    entries.push({ name: file.fileHeader.name.replace(/\\/g, "/"), data: content });
  }
  if (entries.length === 0) throw new Error("압축 안에 그림 파일이 없습니다.");
  return storedZip(entries);
}

function safeName(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  return normalized.length > 0 && !normalized.startsWith("/") && !/^[a-z]:/i.test(normalized) && !normalized.split("/").includes("..");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, entry.data.length, true); lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, entry.data.length, true); cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, cursor); cursor += part.length; }
  return out;
}
