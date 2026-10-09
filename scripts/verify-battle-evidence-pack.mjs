import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = process.argv[2];

if (!manifestPath) {
  console.error("Usage: node scripts/verify-battle-evidence-pack.mjs <manifest.json>");
  process.exit(2);
}

const manifest = JSON.parse(stripBom(await readFile(manifestPath, "utf8")));
const screenshots = screenshotEntries(manifest);
const failures = [];

for (const screenshot of screenshots) {
  const path = resolve(screenshot);
  if (!existsSync(path)) {
    failures.push(`${screenshot}: missing`);
    continue;
  }
  const bytes = await readFile(path);
  if (bytes.length < 10_000) failures.push(`${screenshot}: too small (${bytes.length} bytes)`);
  const dimensions = pngDimensions(bytes);
  if (!dimensions) {
    failures.push(`${screenshot}: invalid PNG header`);
    continue;
  }
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    failures.push(`${screenshot}: invalid dimensions ${dimensions.width}x${dimensions.height}`);
  }
}

const summary = {
  manifest: manifestPath,
  screenshotCount: screenshots.length,
  failures,
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);

function screenshotEntries(value) {
  if (Array.isArray(value?.screenshots)) return value.screenshots;
  if (Array.isArray(value?.viewports)) {
    return value.viewports.flatMap((viewport) => Array.isArray(viewport.screenshots) ? viewport.screenshots : []);
  }
  throw new Error("manifest must include screenshots[] or viewports[].screenshots[]");
}

function pngDimensions(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) return undefined;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}
