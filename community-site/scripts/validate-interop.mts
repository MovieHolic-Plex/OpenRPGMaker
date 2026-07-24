/**
 * Interop proof for the community site downloads.
 * Run from repo root:  npx tsx community-site/scripts/validate-interop.mts [baseUrl]
 *
 * - Asset download must be editor UploadedAsset-shaped and decode to a real image.
 * - Game download must open with the EDITOR'S OWN .rpgzzu reader.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readProjectPackage, readProjectPackageEntryNames } from "@/project/package";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const ASSET_SLUG = process.argv[3] ?? "hero-01-face";
const GAME_SLUG = process.argv[4] ?? "sample-adventure";

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
}

const assetRes = await fetch(`${BASE}/api/assets/${ASSET_SLUG}/download`);
assert(assetRes.ok, `asset download HTTP ${assetRes.status}`);
const asset = (await assetRes.json()) as Record<string, unknown>;
for (const key of ["id", "name", "kind", "dataUrl", "meta"]) {
  assert(key in asset, `UploadedAsset missing field: ${key}`);
}
assert(typeof asset.dataUrl === "string" && asset.dataUrl.startsWith("data:image/"), "dataUrl is not an image data URL");
const imgBytes = Buffer.from(String(asset.dataUrl).split(",")[1], "base64");
assert(imgBytes[0] === 0x89 && imgBytes[1] === 0x50, "asset payload is not a PNG");
console.log(`asset OK: ${asset.name} (${asset.kind}), ${imgBytes.length} bytes PNG`);

const gameRes = await fetch(`${BASE}/api/games/${GAME_SLUG}/download`);
assert(gameRes.ok, `game download HTTP ${gameRes.status}`);
const dir = await mkdtemp(path.join(tmpdir(), "openrpg-interop-"));
const pkgPath = path.join(dir, "game.rpgzzu");
await writeFile(pkgPath, Buffer.from(await gameRes.arrayBuffer()));
const pkgBlob = new Blob([await readFile(pkgPath)]);
const names = await readProjectPackageEntryNames(pkgBlob);
assert(names.includes("project.json"), "package missing project.json");
const project = await readProjectPackage(pkgBlob);
const mapCount = Object.keys(project.maps).length;
assert(mapCount >= 1, "project has no maps");
console.log(`game OK: "${project.meta.title}" — ${names.length} zip entries, ${mapCount} map(s), read by editor's own readProjectPackage`);
await rm(dir, { recursive: true, force: true });
console.log("INTEROP PROOF PASSED");
