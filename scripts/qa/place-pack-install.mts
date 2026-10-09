// 장소 팩을 새 프로젝트에 「스토어에서 받은 것처럼」 넣고, 그 타일셋을 쓰는 빈 맵을 만든 프로젝트 파일을 낸다.
// 다른 사람의 조수가 이 팩 하나로 장소를 깔 수 있는지 헤드리스 Pi 로 시험할 때 쓴다.
//
//   bun scripts/qa/place-pack-install.mts <slug> <out.json> [--map desert_a:64x48] [--bare]
//   bun scripts/pi-agent.mts --project <out.json> --maps desert_a --current desert_a --task "..."
//
// --bare: 번들 버들항(beodeul_city)을 프로젝트에서 뺀다 — 이 팩만 있는 프로젝트(남의 편집기에서 받은 것과 같다).
import fs from "node:fs";
import { storeProjectId } from "../../src/assetStore/format.ts";
import { applyPackToProject } from "../../src/assetStore/pack.ts";
import { createBlankProject } from "../../src/project/defaults/defaultProject.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { placePack } from "../../store-server/scripts/placePacks.ts";

const [slug, out] = process.argv.slice(2);
if (!slug || !out) throw new Error("사용법: bun scripts/qa/place-pack-install.mts <slug> <out.json> [--map id:WxH] [--bare]");
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const [mapId, size = "64x48"] = (arg("map") ?? "place_a:64x48").split(":");
const [w, h] = size.split("x").map(Number);

const pack = placePack(slug);
const project = createBlankProject();
const itemSlug = `beodeul-place-${slug}`;
const result = applyPackToProject(project, pack.manifest, {
  slug: itemSlug, version: 1, author: "OPRN", storeUrl: "https://store.openrpgmaker.com", itemUrl: `https://store.openrpgmaker.com/items/${itemSlug}`,
  blob: (sha) => { const bytes = pack.blobs.get(sha); if (!bytes) throw new Error(`blob ${sha}`); return bytes; },
});
const tilesetId = result.tilesetIds[0]!;
if (process.argv.includes("--bare")) {
  for (const id of Object.keys(project.tilesets)) if (id.startsWith("beodeul_")) delete project.tilesets[id];
  // 번들 버들항을 가리키던 맵은 이 팩 타일셋으로 옮기고 칸을 비운다(남은 번호가 다른 그림을 가리키지 않게).
  for (const map of Object.values(project.maps)) {
    if (project.tilesets[map.tilesetId]) continue;
    map.tilesetId = tilesetId;
    map.lowerTiles = map.lowerTiles.map(() => -1);
    map.upperTiles = map.upperTiles.map(() => -1);
    delete map.lowerOverlayTiles; delete map.upperOverlayTiles;
  }
}
const ctx = { project };
const created = runTool(ctx, "create_map", { id: mapId, name: mapId, width: w, height: h, tilesetId });
if (!created.ok) throw new Error(`create_map: ${created.summary}`);
fs.writeFileSync(out, JSON.stringify(ctx.project));
console.log(`ok ${slug} → ${out} · 타일셋 ${tilesetId} · 맵 ${mapId} ${w}x${h} · 에셋 ${result.assetIds.join(", ")} · ${storeProjectId(itemSlug, "x")}`);
