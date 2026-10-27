// 왕도 아스텔 조각 견본 맵(bd-capital-*) — 새 프로젝트의 버들항 공용 번들만으로 성벽 고리 · 둥근 탑 · 운하 수문(북·남) · 광장 분수 · 포고 단 ·
// 왕실 깃대 · 벽걸이 깃발 · 방패 · 가로등 · 쌍등 · 운하 선착 계단 · 갑문을 한 맵에 찍고, 정본 저장소(project.sqlite)에 저장 → 다시 열어 같은지 확인한다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/beodeul-capital/sample-map.mts <projectDir> <fixture.json>
// fixture.json 은 다시 연 프로젝트(그림 바이트 포함) — scripts/qa/runtime/astel-capital.capture.mjs 가 전용 플레이어로 띄운다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store.ts";
import { createBlankProject } from "../../../src/project/defaults";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets";
import { setLayerTileAt } from "../../../src/project/mapLayers";
import { stampTownWall, type TownWallPlan } from "../../../src/editor/tools/beodeulTownWall";
import type { GameMap, MapId, Project, StructureKitDef } from "../../../src/project/types";

const [projectDir, fixture] = process.argv.slice(2);
if (!projectDir || !fixture) throw new Error("usage: sample-map.mts <projectDir> <fixture.json>");

const GRASS = 737, COBBLE = 3221, CANAL = [23089, 23153, 23153, 23137];
const W = 34, H = 30, CX = 22;                       // 운하 네 열 x 22..25
const p = createBlankProject();
p.meta.title = "왕도 아스텔 조각 견본";
p.system.opening = undefined;
ensureBundledTilesets(p);
const ts = p.tilesets.beodeul_city!;
const kit = (id: string) => { const k = ts.structureKits?.find((s) => s.id === id); assert(k, `kit ${id}`); return k as StructureKitDef; };

const base = structuredClone(Object.values(p.maps)[0]!);
const id = "astel_capital_sample" as MapId;
const map: GameMap = { ...base, id, name: "왕도 아스텔 조각 견본", width: W, height: H, tilesetId: "beodeul_city" as GameMap["tilesetId"], tileSize: 16,
  lowerTiles: Array(W * H).fill(GRASS), upperTiles: Array(W * H).fill(-1), lowerOverlayTiles: Array(W * H).fill(-1), upperOverlayTiles: Array(W * H).fill(-1), events: [] };
delete (map as { relief?: unknown }).relief;
const I = (x: number, y: number) => y * W + x;
// 광장 · 성문 길(자갈) · 운하
for (let y = 10; y <= 20; y++) for (let x = 3; x <= 20; x++) map.lowerTiles[I(x, y)] = COBBLE;
for (let y = 0; y < 10; y++) for (const x of [9, 10]) map.lowerTiles[I(x, y)] = COBBLE;
for (let y = 10; y <= 20; y++) for (const x of [27, 28, 29]) map.lowerTiles[I(x, y)] = COBBLE;
for (let y = 0; y < H; y++) CANAL.forEach((t, i) => { map.lowerTiles[I(CX + i, y)] = t; });

// 성벽 고리(3판 번들 조각) — 북쪽 성문(8..11 열린 문)
const plan: TownWallPlan = { x0: 1, y0: 4, x1: 32, y1: 21, gates: [{ side: "N", x: 9 }], gaps: [], towers: [], stairs: [] };
stampTownWall(map, plan);
// 운하 칸의 땅 그림자는 물 위에 두지 않는다
for (let y = 0; y < H; y++) for (let i = 0; i < 4; i++) {
  const c = I(CX + i, y);
  if (y !== plan.y0 && y !== plan.y0 + 1 && y !== plan.y1 && y !== plan.y1 + 1 && !(y >= plan.y0 + 2 && y <= plan.y0 + 5) && !(y >= plan.y1 + 2 && y <= plan.y1 + 5)) {
    setLayerTileAt(map, 2, c, -1); setLayerTileAt(map, 3, c, -1);
  }
}

/** 키트 찍기: 바닥 층(tiles) → 1층, 위층(upperTiles) → 3층(그 칸 2·4층 비움). overlay=true 면 위층을 4층(벽 앞면 위 덧그림)에 둔다. */
function stamp(k: StructureKitDef, x0: number, y0: number, overlay = false) {
  k.rows.forEach((row, dy) => row.tiles.forEach((t, dx) => {
    const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = I(x, y);
    if (t >= 0) map.lowerTiles[c] = t;
    const u = row.upperTiles?.[dx] ?? -1;
    if (u >= 0) {
      if (overlay) { setLayerTileAt(map, 4, c, u); return; }
      setLayerTileAt(map, 3, c, u); setLayerTileAt(map, 2, c, -1); setLayerTileAt(map, 4, c, -1);
    }
  }));
}
// 둥근 탑: 0행 = 성벽 윗면 첫 줄 − 4
stamp(kit("bd-capital-round-tower-corner-w"), plan.x0, plan.y0 - 4);
stamp(kit("bd-capital-round-tower"), 5, plan.y0 - 4);
stamp(kit("bd-capital-round-tower"), 12, plan.y0 - 4);
stamp(kit("bd-capital-round-tower-corner-e"), plan.x1 - 2, plan.y0 - 4);
stamp(kit("bd-capital-round-tower-lit"), 15, plan.y1 - 4);
// 운하 수문: 성벽 앞면 네 줄 × 운하 네 열
stamp(kit("bd-capital-watergate-n"), CX, plan.y0 + 2);
stamp(kit("bd-capital-watergate-s"), CX, plan.y1 + 2);
// 북쪽 성벽 마을 쪽 앞면에 벽걸이 깃발 · 방패(4층)
stamp(kit("bd-capital-banner-wall"), 16, plan.y0 + 2, true);
stamp(kit("bd-capital-shield"), 18, plan.y0 + 2, true);
stamp(kit("bd-capital-banner-wall"), 20, plan.y0 + 2, true);
// 광장
stamp(kit("bd-capital-fountain"), 4, 12);
stamp(kit("bd-capital-dais"), 10, 13);
stamp(kit("bd-capital-banner-pole"), 9, 11);
stamp(kit("bd-capital-banner-pole"), 14, 11);
stamp(kit("bd-capital-lamp"), 3, 17);
stamp(kit("bd-capital-lamp-double"), 9, 16);
stamp(kit("bd-capital-lamp"), 14, 16);
stamp(kit("bd-capital-lamp"), 20, 11);
// 운하: 선착 계단(서·동 둑) · 갑문(양쪽 둑 물레)
stamp(kit("bd-capital-quay-steps-w"), CX, 11);
stamp(kit("bd-capital-quay-steps-e"), CX + 3, 11);
stamp(kit("bd-capital-canal-lock"), CX - 1, 16);

for (const old of Object.keys(p.maps)) delete p.maps[old as MapId];
p.maps[id] = map;
p.mapTree = { ...p.mapTree, children: [{ mapId: id, children: [] }] } as Project["mapTree"];
p.startMapId = id;
p.startPos = { x: 12, y: 18 };

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
mkdirSync(projectDir, { recursive: true });
let store = await initLocalProjectStore({ projectDir });
const saved = await store.saveProject(p);
assert.equal(saved.kind, "saved", JSON.stringify(saved));
const projectId = store.info().projectId;
store.close();
store = await openLocalProjectStore({ projectDir });
const snap = store.loadSnapshot();
store.close();
assert.ok(snap, "reload returned nothing");
const got = snap.project.maps[id]!;
for (const k of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const) assert.deepEqual(got[k], map[k], `reload differs in ${k}`);
const reloadedTs = snap.project.tilesets.beodeul_city!;
assert.ok(reloadedTs.count >= 33664, `reloaded beodeul_city count ${reloadedTs.count}`);
assert.ok(reloadedTs.structureKits?.some((k) => k.id === "bd-capital-canal-lock"), "reloaded tileset lacks bd-capital kits");

// 플레이어용: 그림 참조(ref)를 바이트로 되돌린다
const portable = structuredClone(snap.project) as Project;
for (const a of Object.values(portable.assets.uploaded)) {
  if (a.ref && !a.dataUrl) {
    const bytes = readFileSync(join(projectDir, "assets", `${a.ref.sha256}.${a.ref.extension}`));
    a.dataUrl = `data:${a.ref.mime};base64,${bytes.toString("base64")}`; delete a.ref;
  }
}
mkdirSync(dirname(fixture), { recursive: true });
writeFileSync(fixture, JSON.stringify(portable));
const proof = { projectId, projectDir, storeFile: join(projectDir, "project.sqlite"), revision: snap.revision, sha256: snap.sha256, mapId: id,
  layersSha: sha([got.lowerTiles, got.lowerOverlayTiles, got.upperTiles, got.upperOverlayTiles]), tilesetCount: reloadedTs.count,
  capitalKits: reloadedTs.structureKits!.filter((k) => k.id.startsWith("bd-capital-")).length, savedAndReopened: true };
writeFileSync(join(dirname(fixture), "save-reload-proof.json"), JSON.stringify(proof, null, 1));
console.log(JSON.stringify(proof));
