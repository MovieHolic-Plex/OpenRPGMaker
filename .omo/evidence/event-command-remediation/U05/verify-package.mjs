import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const prefix = ".omo/evidence/event-command-remediation/U05/";
const index = JSON.parse(await readFile(join(root, "package-index.json"), "utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const entries = new Map();
for (const entry of index.artifacts) {
  assert.ok(!entry.path.startsWith("/") && !entry.path.split("/").includes(".."));
  assert.ok(!entries.has(entry.path), `Duplicate artifact: ${entry.path}`);
  assert.ok(!/\.(png|jpe?g|gif|webp|bmp|mp4|webm|mov|zip)$/i.test(entry.path));
  const bytes = await readFile(join(root, entry.path));
  assert.equal(bytes.length, entry.bytes, entry.path);
  assert.equal(sha256(bytes), entry.sha256, entry.path);
  if (entry.decoded) {
    const decoded = gunzipSync(bytes);
    assert.equal(decoded.length, entry.decoded.bytes, entry.path);
    assert.equal(sha256(decoded), entry.decoded.sha256, entry.path);
  }
  entries.set(entry.path, entry);
}
const tracked = (await readFile(join(root, "tracked-files.txt"), "utf8")).trim().split("\n");
assert.deepEqual(tracked, [...index.artifacts.map(entry => prefix + entry.path), prefix + "package-index.json"].sort());
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
for (const claim of manifest.artifacts) {
  const packaged = entries.get(claim.path) ?? [...entries.values()].find(entry => entry.decoded?.path === claim.path);
  assert.ok(packaged, `Missing manifest artifact: ${claim.path}`);
  const identity = packaged.decoded ?? packaged;
  assert.equal(identity.bytes, claim.bytes, claim.path);
  assert.equal(identity.sha256, claim.sha256, claim.path);
}
console.log(JSON.stringify({ status: "PASS", trackedFiles: tracked.length,
  hashedArtifacts: entries.size, originalManifestClaimsValidated: manifest.artifacts.length,
  compressedArtifacts: index.artifacts.filter(entry => entry.decoded).length,
  applicationChecksExecuted: false }, null, 2));
