const ASSET_KINDS = new Set([
  "chipset", "charset", "battle", "battleCharset", "battleWeapon", "backdrop",
  "gameOver", "monster", "faceset", "picture", "system", "system2", "title",
  "music", "sound", "tileset", "sprite",
]);

export function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return ascii || `item-${Date.now().toString(36)}`;
}

export function isAssetKind(kind: unknown): kind is string {
  return typeof kind === "string" && ASSET_KINDS.has(kind);
}

export interface DecodedDataUrl {
  mime: string;
  bytes: Buffer;
}

export function decodeDataUrl(dataUrl: unknown): DecodedDataUrl | null {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/is.exec(dataUrl);
  if (!match) return null;
  try {
    return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length > 16 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return bytes.toString("ascii", 12, 16) === "IHDR" ? "image/png" : null;
  }
  if (bytes.length > 6 && bytes.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function sniffAudioMime(bytes: Buffer): string | null {
  if (bytes.length > 64 && bytes.toString("ascii", 0, 4) === "OggS" && bytes[4] === 0) {
    const body = bytes.toString("latin1", 0, Math.min(bytes.length, 65536));
    if (body.includes("vorbis") || body.includes("Opus") || body.includes("FLAC")) return "audio/ogg";
    return null;
  }
  if (bytes.length > 128 && bytes.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length > 128 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const bitrateIndex = (bytes[2] >> 4) & 0x0f;
    if (bitrateIndex !== 0 && bitrateIndex !== 0x0f) return "audio/mpeg";
    return null;
  }
  if (bytes.length > 44 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") {
    const riffSize = bytes.readUInt32LE(4);
    if (bytes.toString("ascii", 12, 16) === "fmt " && riffSize <= bytes.length) return "audio/wav";
    return null;
  }
  if (bytes.length > 32 && bytes.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  return null;
}

export function readStoredZipEntryNames(bytes: Buffer): string[] {
  if (bytes.length < 22 || bytes.readUInt32LE(bytes.length - 22) !== 0x06054b50) {
    throw new Error("not a zip: end-of-central-directory missing");
  }
  const count = bytes.readUInt16LE(bytes.length - 12);
  let offset = bytes.readUInt32LE(bytes.length - 6);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("corrupt central directory");
    const nameLen = bytes.readUInt16LE(offset + 28);
    const extraLen = bytes.readUInt16LE(offset + 30);
    const commentLen = bytes.readUInt16LE(offset + 32);
    names.push(bytes.toString("utf8", offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

export function readGamePackageProjectJson(bytes: Buffer): string {
  const names = readStoredZipEntryNames(bytes);
  if (!names.includes("project.json")) throw new Error("project.json entry is missing");
  return readStoredEntry(bytes, findLocalEntry(bytes, "project.json"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateProjectShape(json: unknown): number {
  if (!isRecord(json)) throw new Error("project.json is not an object");
  if (json.version !== 3) throw new Error("project.json must be schema version 3 (re-export from the current editor)");
  const meta = json.meta;
  if (!isRecord(meta) || typeof meta.title !== "string") throw new Error("project.json meta.title is missing");
  for (const field of ["assets", "tilesets", "database", "system", "session", "mapTree", "flags"]) {
    if (!isRecord(json[field])) throw new Error(`project.json is missing the ${field} record`);
  }
  for (const field of ["resourceProfiles", "switches", "variables", "commonEvents"]) {
    if (!Array.isArray(json[field])) throw new Error(`project.json is missing the ${field} array`);
  }
  if (!isRecord(json.maps)) throw new Error("project.json is missing the maps record");
  const maps = json.maps as Record<string, unknown>;
  for (const [id, map] of Object.entries(maps)) {
    if (!isRecord(map)) throw new Error(`map ${id} is not an object`);
    for (const field of ["id", "name", "tilesetId"]) {
      if (typeof map[field] !== "string") throw new Error(`map ${id} is missing ${field}`);
    }
    for (const field of ["width", "height", "tileSize"]) {
      if (typeof map[field] !== "number") throw new Error(`map ${id} is missing ${field}`);
    }
    for (const field of ["lowerTiles", "upperTiles", "events"]) {
      if (!Array.isArray(map[field])) throw new Error(`map ${id} is missing ${field}`);
    }
  }
  if (typeof json.startMapId !== "string" || !(json.startMapId in maps)) {
    throw new Error("project.json startMapId does not point at a map");
  }
  const startPos = json.startPos;
  if (!isRecord(startPos) || typeof startPos.x !== "number" || typeof startPos.y !== "number") {
    throw new Error("project.json startPos is invalid");
  }
  return Object.keys(maps).length;
}

function findLocalEntry(bytes: Buffer, target: string): number {
  let offset = 0;
  while (offset + 30 < bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const nameLen = bytes.readUInt16LE(offset + 26);
    const extraLen = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataLen = bytes.readUInt32LE(offset + 18);
    if (name === target) return offset;
    offset += 30 + nameLen + extraLen + dataLen;
  }
  throw new Error(`entry not found: ${target}`);
}

function readStoredEntry(bytes: Buffer, localOffset: number): string {
  const compression = bytes.readUInt16LE(localOffset + 8);
  if (compression !== 0) throw new Error("only stored (uncompressed) zip entries are supported");
  const nameLen = bytes.readUInt16LE(localOffset + 26);
  const extraLen = bytes.readUInt16LE(localOffset + 28);
  const dataLen = bytes.readUInt32LE(localOffset + 18);
  const start = localOffset + 30 + nameLen + extraLen;
  return bytes.toString("utf8", start, start + dataLen);
}
