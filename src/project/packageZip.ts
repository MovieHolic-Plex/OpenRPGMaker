export interface ZipEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

interface ZipCentralEntry {
  readonly name: string;
  readonly crc: number;
  readonly flags: number;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localOffset: number;
}

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipFormatError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | 1;
const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CRC_TABLE = makeCrcTable();

export function writeStoredZip(entries: readonly ZipEntry[]): Blob {
  const localParts: ArrayBuffer[] = [];
  const centralParts: ArrayBuffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const localHeader = createLocalHeader(nameBytes, entry.bytes.length, crc);
    const centralHeader = createCentralHeader(nameBytes, entry.bytes.length, crc, offset);
    localParts.push(toArrayBuffer(localHeader), toArrayBuffer(entry.bytes));
    centralParts.push(toArrayBuffer(centralHeader));
    offset += localHeader.length + entry.bytes.length;
  }

  const centralSize = byteLength(centralParts);
  const end = createEndRecord(entries.length, centralSize, offset);
  return new Blob([...localParts, ...centralParts, toArrayBuffer(end)], { type: "application/zip" });
}

export function readStoredZipEntryNames(bytes: Uint8Array): readonly string[] {
  return readCentralDirectory(bytes).map((entry) => entry.name);
}

export function readStoredZipEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  const entry = readCentralDirectory(bytes).find((candidate) => candidate.name === name);
  if (!entry) return null;
  if (entry.method !== STORE_METHOD) {
    throw new ZipFormatError(`Unsupported compression method for ${entry.name}`);
  }
  if (uint32(bytes, entry.localOffset) !== LOCAL_FILE_HEADER) {
    throw new ZipFormatError(`Broken local header for ${entry.name}`);
  }
  const nameLength = uint16(bytes, entry.localOffset + 26);
  const extraLength = uint16(bytes, entry.localOffset + 28);
  const contentStart = entry.localOffset + 30 + nameLength + extraLength;
  const contentEnd = contentStart + entry.compressedSize;
  if (contentEnd > bytes.length) {
    throw new ZipFormatError(`Truncated entry ${entry.name}`);
  }
  const localName = decoder.decode(bytes.slice(entry.localOffset + 30, entry.localOffset + 30 + nameLength));
  const payload = bytes.slice(contentStart, contentEnd);
  if (localName !== entry.name || uint16(bytes, entry.localOffset + 8) !== entry.method
    || uint16(bytes, entry.localOffset + 6) !== entry.flags || (entry.flags & ~UTF8_FLAG) !== 0
    || entry.compressedSize !== entry.uncompressedSize
    || uint32(bytes, entry.localOffset + 18) !== entry.compressedSize
    || uint32(bytes, entry.localOffset + 22) !== entry.uncompressedSize
    || uint32(bytes, entry.localOffset + 14) !== entry.crc || crc32(payload) !== entry.crc) {
    throw new ZipFormatError(`Inconsistent stored entry ${entry.name}`);
  }
  return payload;
}

function readCentralDirectory(bytes: Uint8Array): readonly ZipCentralEntry[] {
  const endOffset = findEndRecord(bytes);
  const entryCount = uint16(bytes, endOffset + 10);
  const centralOffset = uint32(bytes, endOffset + 16);
  if (endOffset + 22 + uint16(bytes, endOffset + 20) !== bytes.length
    || uint16(bytes, endOffset + 4) !== 0 || uint16(bytes, endOffset + 6) !== 0
    || uint16(bytes, endOffset + 8) !== entryCount
    || centralOffset + uint32(bytes, endOffset + 12) !== endOffset) throw new ZipFormatError("Inconsistent ZIP directory");
  const entries: ZipCentralEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (uint32(bytes, offset) !== CENTRAL_FILE_HEADER) {
      throw new ZipFormatError("Broken central directory");
    }
    const method = uint16(bytes, offset + 10);
    const compressedSize = uint32(bytes, offset + 20);
    const uncompressedSize = uint32(bytes, offset + 24);
    const nameLength = uint16(bytes, offset + 28);
    const extraLength = uint16(bytes, offset + 30);
    const commentLength = uint16(bytes, offset + 32);
    const localOffset = uint32(bytes, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) {
      throw new ZipFormatError("Truncated central directory name");
    }
    entries.push({
      name: decoder.decode(bytes.slice(nameStart, nameEnd)),
      crc: uint32(bytes, offset + 16),
      flags: uint16(bytes, offset + 8),
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  if (offset !== endOffset) throw new ZipFormatError("Undeclared directory data");
  let localEnd = 0;
  for (const entry of [...entries].sort((a, b) => a.localOffset - b.localOffset)) {
    if (entry.localOffset !== localEnd || uint32(bytes, localEnd) !== LOCAL_FILE_HEADER) throw new ZipFormatError("Undeclared local entry data");
    localEnd += 30 + uint16(bytes, localEnd + 26) + uint16(bytes, localEnd + 28) + entry.compressedSize;
  }
  if (localEnd !== centralOffset) throw new ZipFormatError("Undeclared payload data");
  return entries;
}

function createLocalHeader(nameBytes: Uint8Array, size: number, crc: number): Uint8Array {
  const bytes = new Uint8Array(30 + nameBytes.length);
  setUint32(bytes, 0, LOCAL_FILE_HEADER);
  setUint16(bytes, 4, 20);
  setUint16(bytes, 6, UTF8_FLAG);
  setUint16(bytes, 8, STORE_METHOD);
  setUint16(bytes, 10, DOS_TIME);
  setUint16(bytes, 12, DOS_DATE);
  setUint32(bytes, 14, crc);
  setUint32(bytes, 18, size);
  setUint32(bytes, 22, size);
  setUint16(bytes, 26, nameBytes.length);
  bytes.set(nameBytes, 30);
  return bytes;
}

function createCentralHeader(nameBytes: Uint8Array, size: number, crc: number, localOffset: number): Uint8Array {
  const bytes = new Uint8Array(46 + nameBytes.length);
  setUint32(bytes, 0, CENTRAL_FILE_HEADER);
  setUint16(bytes, 4, 20);
  setUint16(bytes, 6, 20);
  setUint16(bytes, 8, UTF8_FLAG);
  setUint16(bytes, 10, STORE_METHOD);
  setUint16(bytes, 12, DOS_TIME);
  setUint16(bytes, 14, DOS_DATE);
  setUint32(bytes, 16, crc);
  setUint32(bytes, 20, size);
  setUint32(bytes, 24, size);
  setUint16(bytes, 28, nameBytes.length);
  setUint32(bytes, 42, localOffset);
  bytes.set(nameBytes, 46);
  return bytes;
}

function createEndRecord(entryCount: number, centralSize: number, centralOffset: number): Uint8Array {
  const bytes = new Uint8Array(22);
  setUint32(bytes, 0, END_OF_CENTRAL_DIRECTORY);
  setUint16(bytes, 8, entryCount);
  setUint16(bytes, 10, entryCount);
  setUint32(bytes, 12, centralSize);
  setUint32(bytes, 16, centralOffset);
  return bytes;
}

function findEndRecord(bytes: Uint8Array): number {
  const minimumOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (uint32(bytes, offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new ZipFormatError("End of central directory not found");
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): readonly number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
}

function byteLength(parts: readonly ArrayBuffer[]): number {
  return parts.reduce((total, part) => total + part.byteLength, 0);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function uint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function setUint16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 2).setUint16(0, value, true);
}

function setUint32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
}
