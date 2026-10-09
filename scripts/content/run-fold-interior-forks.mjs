import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { bridgeCall, foldInteriorForks, loadPng, pngBytes, readSheet, tileHash, UNIFIED_ASSET, UNIFIED_ID } from "./fold-interior-forks.mjs";

const host = process.env.FOLD_HOST ?? "http://mdc-server:9888";
const projectDir = "/home/main/.local/share/oprn/web-workspace";
const out = "verify-shots/interior-fork-fold";
const dry = process.argv.includes("--dry");

const html = await (await fetch(host)).text();
const token = html.match(/"token":"([^"]+)"/)?.[1];
if (!token) throw new Error("브리지 토큰을 찾지 못했습니다");

const loaded = await bridgeCall(host, token, "oprn:project.load", { projectDir });
const project = JSON.parse(loaded.serialized);
const assetDir = `${projectDir}/assets`;
const sheets = {
  unified: readSheet(`${assetDir}/${project.assets.uploaded[UNIFIED_ASSET].ref.sha256}.png`),
  tileset_potter_cohesive_20260921: readSheet(`${assetDir}/${project.assets.uploaded.interior_potter_cohesive_20260921.ref.sha256}.png`),
  tileset_trade_rooms_20260921: readSheet(`${assetDir}/${project.assets.uploaded.interior_trade_rooms_20260921.ref.sha256}.png`),
};
const beforeHashes = new Map();
for (const map of Object.values(project.maps)) {
  if (!["tileset_potter_cohesive_20260921", "tileset_trade_rooms_20260921"].includes(map.tilesetId)) continue;
  const sheet = sheets[map.tilesetId];
  for (const key of ["lowerTiles", "upperTiles"]) {
    for (const cell of map[key] ?? []) {
      if (typeof cell === "number" && cell >= 0) beforeHashes.set(`${map.id}:${key}:${map[key].indexOf(cell)}`, null);
    }
  }
  beforeHashes.set(map.id, {
    lower: (map.lowerTiles ?? []).map((cell) => (typeof cell === "number" && cell >= 0 ? tileHash(sheet, cell) : cell)),
    upper: (map.upperTiles ?? []).map((cell) => (typeof cell === "number" && cell >= 0 ? tileHash(sheet, cell) : cell)),
  });
}
const { png, report } = foldInteriorForks(project, sheets);
for (const [mapId, hashes] of beforeHashes) {
  if (!hashes || !project.maps[mapId]) continue;
  const map = project.maps[mapId];
  const sheet = png;
  for (const key of ["lower", "upper"]) {
    const cells = map[`${key}Tiles`];
    hashes[key].forEach((hash, index) => {
      if (typeof hash !== "string") return;
      const actual = tileHash(sheet, cells[index]);
      if (actual !== hash) throw new Error(`${mapId} ${key} ${index} 그림이 달라졌습니다`);
    });
  }
}
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ dry, moved: report.movedMaps.length, appended: report.appended.length, count: report.unifiedCount, image: report.image, grassRemoved: report.grassRemoved, docs: report.docs.length }, null, 2));
if (dry) process.exit(0);

const backup = await bridgeCall(host, token, "oprn:project.backup", { projectDir });
const put = await bridgeCall(host, token, "oprn:assets.put", {
  projectDir,
  mime: "image/png",
  extension: "png",
  originalName: "easyrpg-interior-unified-folded.png",
  kind: "tileset",
  bytes: Buffer.from(pngBytes(png)).toString("base64"),
});
const ref = put.ref;
if (ref.sha256 !== createHash("sha256").update(pngBytes(png)).digest("hex")) throw new Error("저장한 시트 해시가 다릅니다");
project.assets.uploaded[UNIFIED_ASSET].ref = ref;
const fresh = await bridgeCall(host, token, "oprn:project.load", { projectDir });
if (fresh.sha256 !== loaded.sha256) throw new Error("저장 전에 프로젝트가 바뀌었습니다");
const saved = await bridgeCall(host, token, "oprn:project.save", {
  projectDir,
  serialized: JSON.stringify(project),
  expectedSha: fresh.sha256,
});
if (saved.kind !== "saved") throw new Error(`저장 실패 ${JSON.stringify(saved).slice(0, 400)}`);
const reloaded = await bridgeCall(host, token, "oprn:project.load", { projectDir });
const again = JSON.parse(reloaded.serialized);
if (again.tilesets.tileset_potter_cohesive_20260921 || again.tilesets.tileset_trade_rooms_20260921 || again.tilesets.forest_harmony_grass_joins) {
  throw new Error("재로드 후에도 포크 타일셋이 있습니다");
}
if (again.tilesets[UNIFIED_ID].count !== report.unifiedCount) throw new Error("재로드 칸 수가 다릅니다");
const savedSheet = loadPng(await (await fetch(`${host}/__oprn/asset//${ref.sha256}`)).arrayBuffer().then((buf) => Buffer.from(buf)).catch(() => null) ?? Buffer.alloc(0));
if (!savedSheet.width) {
  const disk = readSheet(`${assetDir}/${ref.sha256}.png`);
  if (disk.width !== png.width || disk.height !== png.height) throw new Error("디스크 시트 크기가 다릅니다");
}
writeFileSync(`${out}/proof.json`, JSON.stringify({
  projectId: again.meta?.title,
  storage: projectDir,
  backup,
  sha256: saved.sha256,
  revision: reloaded.revision,
  reloaded: true,
  report,
}, null, 2));
console.log("saved", saved.sha256, "revision", reloaded.revision);
