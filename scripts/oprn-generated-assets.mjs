import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const UNSAFE_NAMES = new Set(["output.png", "test.png", "image.png"]);

const args = process.argv.slice(2);
const mode = args[0] ?? "help";
const options = parseOptions(args.slice(1));

if (mode === "dry-run") {
  await dryRun(options);
} else if (mode === "validate-only") {
  await validateOnly(options);
} else if (mode === "agy-command") {
  await writeAgyCommands(options);
} else {
  console.log("Usage: node scripts/oprn-generated-assets.mjs dry-run|validate-only|agy-command --manifest <json> --raw-root <dir> --out <json> [--contact-sheet <json>]");
}

async function dryRun(options) {
  const manifest = await readManifest(options);
  const rawRoot = options["raw-root"] ?? ".omo/evidence/oprn-generated-assets-execution/raw";
  await mkdir(rawRoot, { recursive: true });
  const validations = [];
  for (const entry of manifest.assets) {
    const rawPath = path.join(rawRoot, `${entry.id}-${stableEightHex(entry.id)}.png`);
    await writeFile(rawPath, createFakePng(entry.expectedDimensions.width, entry.expectedDimensions.height));
    validations.push(await validateEntry(entry, rawPath));
  }
  await writeJson(requiredOption(options, "out"), { mode: "dry-run", validations });
  if (options["contact-sheet"]) await writeJson(options["contact-sheet"], contactSheet(manifest, validations));
  console.log(`dry-run wrote ${validations.length} fake PNG validations`);
}

async function validateOnly(options) {
  const manifest = await readManifest(options);
  const rawRoot = options["raw-root"] ?? ".";
  const validations = [];
  for (const entry of manifest.assets) {
    const rawPath = entry.rawPath ?? path.join(rawRoot, `${entry.id}-${stableEightHex(entry.id)}.png`);
    validations.push(await validateEntry(entry, rawPath));
  }
  await writeJson(requiredOption(options, "out"), { mode: "validate-only", validations });
  console.log(`validate-only wrote ${validations.length} validations`);
}

async function writeAgyCommands(options) {
  const manifest = await readManifest(options);
  const rawRoot = options["raw-root"] ?? ".omo/evidence/oprn-generated-assets-execution/raw";
  const commands = manifest.assets.map((entry) => {
    const out = path.resolve(rawRoot, `${entry.id}-${stableEightHex(entry.id)}.png`);
    return {
      entryId: entry.id,
      command: [
        "agy",
        "--dangerously-skip-permissions",
        "--print-timeout",
        "180s",
        "--print",
        `Create a new ${entry.expectedDimensions.width}x${entry.expectedDimensions.height} PNG image file at ${out}. Subject: ${entry.prompt}. Style: original retro 2D JRPG pixel art, crisp pixel edges. Avoid: ${entry.negativePrompt}. After creating it, reply with only the file path and image format.`,
      ],
      executed: false,
    };
  });
  await writeJson(requiredOption(options, "out"), { mode: "agy-command", commands });
  console.log(`agy-command documented ${commands.length} commands without execution`);
}

async function validateEntry(entry, filePath) {
  const issues = [];
  if (!safePath(filePath)) issues.push("output path must be a unique generated PNG outside public/assets/easyrpg");
  let bytes = null;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      issues.push("file is missing");
    } else {
      throw error;
    }
  }
  const inspection = bytes ? inspectPng(bytes) : null;
  if (inspection && inspection.format !== "png") issues.push(inspection.reason);
  if (inspection && inspection.format === "png") {
    if (inspection.width !== entry.expectedDimensions.width || inspection.height !== entry.expectedDimensions.height) {
      issues.push(`PNG dimensions ${inspection.width}x${inspection.height} do not match ${entry.expectedDimensions.width}x${entry.expectedDimensions.height}`);
    }
    if (!inspection.nonblank) issues.push("PNG appears blank");
    // dry-run 이 쓰는 가짜 픽셀(x*17+y*31 그라데이션)이 그대로 승격된 사고가 있다 — 실측 2026-09-15:
    // public/assets/generated/starter/ 안에 hero-01-charset.png 포함 5장이 이 패턴이었다.
    // 검증이 "공백이 아니다" 만 봤기 때문에 가짜도 통과해 status:promoted 로 기록됐다.
    if (inspection.dryRunFake) {
      issues.push("PNG is the dry-run fake placeholder (x*17+y*31 gradient); generate the real asset before promoting");
    }
  }
  const sha256 = bytes ? createHash("sha256").update(bytes).digest("hex") : null;
  return { entryId: entry.id, resourceKind: entry.resourceKind, target: entry.target, path: filePath.replaceAll("\\", "/"), ok: issues.length === 0, inspection, sha256, promotion: issues.length === 0 ? promotion(entry, filePath, sha256) : null, issues };
}

function promotion(entry, rawPath, sha256) {
  return { entryId: entry.id, resourceId: entry.resourceId, rawPath: rawPath.replaceAll("\\", "/"), promotedPath: `public/assets/generated/starter/${entry.id}.png`, sha256, status: "promoted" };
}

function inspectPng(bytes) {
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { format: "invalid", reason: "file is not a PNG" };
  }
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) return { format: "invalid", reason: "PNG chunk length exceeds file size" };
    if (type === "IHDR") {
      width = bytes.readUInt32BE(start);
      height = bytes.readUInt32BE(start + 4);
      colorType = bytes[start + 9];
    }
    if (type === "IDAT") idat.push(bytes.subarray(start, end));
    if (type === "IEND") break;
    offset = end + 4;
  }
  if (width <= 0 || height <= 0 || idat.length === 0) return { format: "invalid", reason: "PNG is missing pixels" };
  if (colorType !== 6) return { format: "invalid", reason: "PNG color type must be RGBA" };
  const inflated = inflateSync(Buffer.concat(idat));
  // 스캔라인 필터를 풀어야 픽셀을 본다 — 저장소에 들어 있는 파일은 재인코딩돼 있어 필터 0 가정이 틀린다
  // (실측 2026-09-15: dry-run 가짜 5장이 필터 0 가정 탓에 그대로 통과했다).
  const pixels = decodeRgba(inflated, width, height);
  if (!pixels) return { format: "invalid", reason: "PNG uses an unsupported scanline filter" };
  const dryRunFake = isDryRunFake(pixels, width, height);
  return { format: "png", width, height, mode: "rgba", byteSize: bytes.length, dryRunFake, nonblank: hasVariation(pixels, width, height) };
}

function hasVariation(pixels, width, height) {
  const stride = width * 4;
  const first = pixels.subarray(0, 4);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const offset = row + x * 4;
      if (pixels[offset + 3] !== 0 && !pixels.subarray(offset, offset + 4).equals(first)) return true;
    }
  }
  return false;
}

/** PNG 스캔라인 필터(0~4)를 풀어 RGBA 픽셀 버퍼로 돌려준다. 지원하지 않는 필터면 null. */
function decodeRgba(inflated, width, height) {
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    if (pos + 1 + stride > inflated.length) return null;
    const filter = inflated[pos];
    pos += 1;
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[pos + x];
      const left = x >= bpp ? out[rowStart + x - bpp] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prevStart + x - bpp] : 0;
      let recon;
      if (filter === 0) recon = value;
      else if (filter === 1) recon = value + left;
      else if (filter === 2) recon = value + up;
      else if (filter === 3) recon = value + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        return null;
      }
      out[rowStart + x] = recon & 255;
    }
    pos += stride;
  }
  return out;
}

/** dry-run 전용 가짜 픽셀인가 — 실제 그림이 우연히 이 공식을 만족할 수는 없다. */
function isDryRunFake(pixels, width, height) {
  const stride = width * 4;
  const stepX = Math.max(1, Math.floor(width / 16));
  const stepY = Math.max(1, Math.floor(height / 16));
  let sampled = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const value = (x * 17 + y * 31) % 251;
      const offset = y * stride + x * 4;
      if (pixels[offset] !== value || pixels[offset + 1] !== (80 + value) % 251
        || pixels[offset + 2] !== (160 + value) % 251 || pixels[offset + 3] !== 255) return false;
      sampled += 1;
    }
  }
  return sampled >= 4;
}

function createFakePng(width, height) {
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const value = (x * 17 + y * 31) % 251;
      const offset = row + 1 + x * 4;
      raw[offset] = value;
      raw[offset + 1] = (80 + value) % 251;
      raw[offset + 2] = (160 + value) % 251;
      raw[offset + 3] = 255;
    }
  }
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr(width, height)), chunk("IDAT", zlibStored(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  return data;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function zlibStored(raw) {
  const blocks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < raw.length; offset += 65535) {
    const length = Math.min(65535, raw.length - offset);
    const finalBlock = offset + length >= raw.length ? 1 : 0;
    const header = Buffer.from([finalBlock, length & 255, length >> 8, (~length) & 255, ((~length) >> 8) & 255]);
    blocks.push(header, raw.subarray(offset, offset + length));
  }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(raw), 0);
  blocks.push(checksum);
  return Buffer.concat(blocks);
}

function contactSheet(manifest, validations) {
  return {
    columns: 4,
    rows: Math.ceil(manifest.assets.length / 4),
    cells: validations.map((validation) => {
      const entry = manifest.assets.find((candidate) => candidate.id === validation.entryId);
      return { entryId: validation.entryId, target: entry?.target ?? "", label: `${entry?.target ?? ""}: ${entry?.resourceId ?? ""}`, path: validation.promotion?.promotedPath ?? validation.path, width: entry?.expectedDimensions.width ?? 0, height: entry?.expectedDimensions.height ?? 0 };
    }),
  };
}

async function readManifest(options) {
  return JSON.parse(await readFile(requiredOption(options, "manifest"), "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (key?.startsWith("--") && value) parsed[key.slice(2)] = value;
  }
  return parsed;
}

function requiredOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function safePath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const name = normalized.split("/").at(-1) ?? "";
  return normalized.endsWith(".png") && !UNSAFE_NAMES.has(name) && !normalized.includes("public/assets/easyrpg/");
}

function stableEightHex(value) {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let current = (crc ^ byte) & 255;
    for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    crc = (crc >>> 8) ^ current;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
