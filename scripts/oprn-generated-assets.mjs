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
  const raw = inflateSync(Buffer.concat(idat));
  return { format: "png", width, height, mode: "rgba", byteSize: bytes.length, nonblank: hasVariation(raw, width, height) };
}

function hasVariation(raw, width, height) {
  const stride = 1 + width * 4;
  const first = raw.subarray(1, 5);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      if (raw[offset + 3] !== 0 && !raw.subarray(offset, offset + 4).equals(first)) return true;
    }
  }
  return false;
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
