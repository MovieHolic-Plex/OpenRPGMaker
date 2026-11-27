import { closeSync, openSync, readSync, statSync } from "node:fs";

export interface OpakEntryMeta {
  readonly path: string;
  readonly offset: number;
  readonly size: number;
  readonly sha256: string;
}

export interface OpakArchiveManifest {
  readonly magic: "OPAK";
  readonly formatVersion: 1;
  readonly gameTitle: string;
  readonly createdAt: string;
  readonly entryCount: number;
  readonly totalPayloadBytes: number;
  readonly entries: readonly OpakEntryMeta[];
}

const OPAK_MAGIC_BYTES = [0x4f, 0x50, 0x41, 0x4b] as const; // "OPAK"
const HEADER_PREFIX_BYTES = 12;

export function normalizeOpakPath(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const normalized = decoded.replaceAll("\\", "/").replace(/^\/+/u, "");
  if (normalized.includes("\0")) return null;
  if (normalized === "") return "index.html";
  const segments = normalized.split("/");
  const clean: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    clean.push(segment);
  }
  return clean.length === 0 ? "index.html" : clean.join("/");
}

/**
 * Reads an OPAK v1 binary archive (`resources/game.pak`) without loading all payload bytes into memory.
 * Supports both file-backed random reads (for Electron runtime) and buffer-backed reads (for tests/tools).
 */
export class OpakArchiveReader {
  readonly manifest: OpakArchiveManifest;
  private readonly payloadStart: number;
  private readonly totalSize: number;
  private readonly entryMap: ReadonlyMap<string, OpakEntryMeta>;
  private readonly buffer: Uint8Array | null;
  private fd: number | null;

  private constructor(
    manifest: OpakArchiveManifest,
    payloadStart: number,
    totalSize: number,
    buffer: Uint8Array | null,
    fd: number | null,
  ) {
    this.manifest = manifest;
    this.payloadStart = payloadStart;
    this.totalSize = totalSize;
    this.buffer = buffer;
    this.fd = fd;
    const map = new Map<string, OpakEntryMeta>();
    for (const entry of manifest.entries) {
      map.set(entry.path, entry);
    }
    this.entryMap = map;
  }

  static openFile(pakFilePath: string): OpakArchiveReader {
    const fd = openSync(pakFilePath, "r");
    try {
      const stats = statSync(pakFilePath);
      const totalSize = stats.size;
      if (totalSize < HEADER_PREFIX_BYTES) {
        throw new Error("Invalid OPAK archive: file smaller than 12-byte header");
      }
      const prefix = Buffer.allocUnsafe(HEADER_PREFIX_BYTES);
      readExact(fd, prefix, 0, HEADER_PREFIX_BYTES, 0);
      const { headerLen } = parseHeaderPrefix(prefix);
      const payloadStart = HEADER_PREFIX_BYTES + headerLen;
      if (payloadStart > totalSize) {
        throw new Error("Truncated OPAK archive header");
      }
      const headerBuf = Buffer.allocUnsafe(headerLen);
      readExact(fd, headerBuf, 0, headerLen, HEADER_PREFIX_BYTES);
      const manifest = parseManifest(headerBuf);
      return new OpakArchiveReader(manifest, payloadStart, totalSize, null, fd);
    } catch (error) {
      try {
        closeSync(fd);
      } catch {
        // ignore close error
      }
      throw error;
    }
  }

  static fromBuffer(bytes: Uint8Array): OpakArchiveReader {
    if (bytes.length < HEADER_PREFIX_BYTES) {
      throw new Error("Invalid OPAK archive: buffer smaller than 12-byte header");
    }
    const { headerLen } = parseHeaderPrefix(bytes);
    const payloadStart = HEADER_PREFIX_BYTES + headerLen;
    if (payloadStart > bytes.length) {
      throw new Error("Truncated OPAK archive header");
    }
    const manifest = parseManifest(bytes.subarray(HEADER_PREFIX_BYTES, payloadStart));
    return new OpakArchiveReader(manifest, payloadStart, bytes.length, bytes, null);
  }

  getEntryMeta(rawPath: string): OpakEntryMeta | null {
    const clean = normalizeOpakPath(rawPath);
    if (!clean) return null;
    const exact = this.entryMap.get(clean);
    if (exact) return exact;
    if (clean === "index.html") {
      return this.entryMap.get("player.html") ?? null;
    }
    return null;
  }

  readEntry(rawPath: string): Uint8Array | null {
    const meta = this.getEntryMeta(rawPath);
    if (!meta) return null;
    return this.readSlice(meta, 0, meta.size);
  }

  readSlice(meta: OpakEntryMeta, sliceOffset: number, sliceLength: number): Uint8Array {
    if (sliceOffset < 0 || sliceLength < 0 || sliceOffset + sliceLength > meta.size) {
      throw new Error(`Out-of-bounds OPAK read for ${meta.path}`);
    }
    const absStart = this.payloadStart + meta.offset + sliceOffset;
    const absEnd = absStart + sliceLength;
    if (absEnd > this.totalSize) {
      throw new Error(`Truncated OPAK entry: ${meta.path}`);
    }
    if (sliceLength === 0) return new Uint8Array(0);
    if (this.buffer) {
      return this.buffer.slice(absStart, absEnd);
    }
    if (this.fd === null) {
      throw new Error("OPAK archive reader has already been closed");
    }
    const out = Buffer.allocUnsafe(sliceLength);
    readExact(this.fd, out, 0, sliceLength, absStart);
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  }

  listPaths(): readonly string[] {
    return this.manifest.entries.map((entry) => entry.path);
  }

  close(): void {
    if (this.fd !== null) {
      try {
        closeSync(this.fd);
      } catch {
        // ignore close errors during shutdown
      }
      this.fd = null;
    }
  }
}

function parseHeaderPrefix(bytes: Uint8Array): { readonly version: number; readonly headerLen: number } {
  for (let i = 0; i < OPAK_MAGIC_BYTES.length; i += 1) {
    if (bytes[i] !== OPAK_MAGIC_BYTES[i]) {
      throw new Error("Invalid OPAK archive header magic");
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== 1) {
    throw new Error(`Unsupported OPAK archive version: ${version}`);
  }
  const headerLen = view.getUint32(8, true);
  if (headerLen === 0 || headerLen > 64 * 1024 * 1024) {
    throw new Error(`Invalid OPAK header length: ${headerLen}`);
  }
  return { version, headerLen };
}

function parseManifest(headerBytes: Uint8Array): OpakArchiveManifest {
  const manifest = JSON.parse(new TextDecoder().decode(headerBytes)) as Partial<OpakArchiveManifest>;
  if (
    manifest.magic !== "OPAK" ||
    manifest.formatVersion !== 1 ||
    !Array.isArray(manifest.entries)
  ) {
    throw new Error("Invalid OPAK manifest structure");
  }
  return manifest as OpakArchiveManifest;
}

function readExact(fd: number, target: Buffer, offset: number, length: number, position: number): void {
  let remaining = length;
  let dstOffset = offset;
  let filePos = position;
  while (remaining > 0) {
    const bytesRead = readSync(fd, target, dstOffset, remaining, filePos);
    if (bytesRead <= 0) {
      throw new Error("Unexpected EOF while reading OPAK archive");
    }
    remaining -= bytesRead;
    dstOffset += bytesRead;
    filePos += bytesRead;
  }
}
