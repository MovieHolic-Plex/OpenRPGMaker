// 버들항 woodland B 쇼케이스 — 원본 수관(B) + 짙은 풀 오토타일로, 작가가 실제로 쓰는 도구(author_wild_route·stamp_object·fill_region·
// …)만으로 짓는 목적 있는 숲 장면 7개. 새 그림 없음(버들항 기존 조각 + 짙은 풀).
//   bun scripts/qa/beodeul-woodlands-showcase.mts <outDir>
import fs from "node:fs";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import { resetMapEditHistory } from "../../src/editor/mapEditHistory.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { PNG } from "pngjs";
import forestGround from "../../tiledata/beodeul-ground/forest-ground.json";

const out = process.argv[2] ?? "/tmp/bw-show";
fs.mkdirSync(out, { recursive: true });
type Ctx = { project: Project };
const ok = (r: { ok: boolean; summary?: string }, what: string) => { if (!r.ok) throw new Error(`${what}: ${r.summary}`); };
const save = (p: Project, id: string, name: string) => {
  const png = PNG.sync.read(renderMapPng({ ...p, startMapId: "" }, p.maps[id]!, 1).png), m = p.maps[id]!;
  const pad = png.height - m.height * 16, cut = new PNG({ width: png.width, height: m.height * 16 });
  png.data.copy(cut.data, 0, pad * png.width * 4);
  fs.writeFileSync(`${out}/${name}.png`, PNG.sync.write(cut));
  // 짙은 풀 칸 표(설명 그림용): 맵 칸 → beodeul_ground 칸 번호(가장자리) 또는 원본 속 칸
  const ts = p.tilesets[m.tilesetId]!, fams = forestGround.darkGrass.families as Record<string, Record<string, number>>;
  const toGround = new Map<number, number>();
  for (const f of ["plain", "woodland"]) { const g = ts.autotileGroups?.find((x) => x.id === (f === "plain" ? "beodeul_dark_grass" : "beodeul_dark_grass_woodland")); if (g) for (const [k, t] of Object.entries(fams[f]!)) toGround.set(g.variantMap[k]!, t); }
  const cells: [number, number, number][] = [];
  m.lowerTiles.forEach((t, i) => { const gid = toGround.get(t); if (gid !== undefined) cells.push([i % m.width, Math.floor(i / m.width), gid]); else if (forestGround.darkGrass.interior.includes(t)) cells.push([i % m.width, Math.floor(i / m.width), -1]); });
  fs.writeFileSync(`${out}/${name}.darkgrass.json`, JSON.stringify(cells));
  console.log(name);
};
const fresh = (): Ctx => { resetMapEditHistory(); return { project: createBlankProject() }; };
const kit = (ctx: Ctx, mapId: string, id: string, x: number, y: number) => {
  const r = runTool(ctx, "stamp_object", { objectId: `kit:beodeul_city/${id}`, mapId, x, y }, { dryRun: false });
  if (!r.ok) console.warn(`  stamp ${id} (${x},${y}) 실패: ${r.summary}`);
};
const route = (ctx: Ctx, id: string, w: number, h: number, args: Record<string, unknown>) => {
  ok(runTool(ctx, "create_map", { id, name: id, width: w, height: h, tilesetId: "beodeul_city" }, { dryRun: false }), "create_map");
  ok(runTool(ctx, "author_wild_route", { mapId: id, ...args }, { dryRun: false }), `route ${id}`);
};
const fill = (ctx: Ctx, mapId: string, material: string, rect: { x: number; y: number; w: number; h: number }, shape = "rect") =>
  ok(runTool(ctx, "fill_region", { mapId, material, rect, shape }, { dryRun: false }), `fill ${material}`);

// 1. 숲길 끝 사냥꾼 야영지 — 남쪽 입구에서 북쪽 공터까지 막다른 활엽수림 길. 목적: 공터의 모닥불(사냥꾼 야영)이 길의 끝.
{
  const c = fresh();
  route(c, "s1", 32, 26, { exits: [{ x: 15, y: 25 }], end: { x: 15, y: 10 }, clearings: [{ x: 10, y: 2, w: 11, h: 7 }], seed: 4 });
  kit(c, "s1", "bd-pick-deep-forest-path-campfire", 15, 5);
  kit(c, "s1", "bd-pick-deep-forest-path-hide-rack", 11, 3);
  kit(c, "s1", "bd-pick-deep-forest-path-hunter-post", 19, 2);
  kit(c, "s1", "bd-pick-deep-forest-path-chopping-block", 18, 6);
  kit(c, "s1", "bd-pick-deep-forest-path-log-fallen", 12, 6);
  kit(c, "s1", "bd-pick-deep-forest-path-stump", 20, 5);
  save(c.project, "s1", "s1-hunter-camp");
}

// 2. 개울을 건너는 혼효림 길 — 서→동 길이 남북 개울을 돌다리로 건넌다. 목적: 다리가 길의 고비.
{
  const c = fresh();
  route(c, "s2", 36, 22, { exits: [{ x: 0, y: 11 }, { x: 35, y: 11 }], clearings: [{ x: 15, y: 0, w: 7, h: 22 }], forestType: "mixed", seed: 7 });
  fill(c, "s2", "버들항 강·운하 물", { x: 17, y: 0, w: 3, h: 22 });
  // 길(2줄, seed 7 은 12·13행으로 개울을 건넌다) 위에 다리 상판을 맞춘다. 다리 자리의 길섶 소품은 먼저 걷어 낸다.
  { const { setLayerTileAt } = await import("../../src/project/mapLayers.ts"); const m = c.project.maps.s2!;
    for (let y = 11; y < 15; y++) for (let x = 16; x < 21; x++) for (const L of [2, 3, 4] as const) setLayerTileAt(m, L, y * m.width + x, -1); }
  kit(c, "s2", "bd-pick-mountain-pass-stone-bridge", 16, 11);
  kit(c, "s2", "bd-pick-deep-forest-path-fern-a", 15, 4);
  kit(c, "s2", "bd-pick-deep-forest-path-stones-b", 21, 16);
  kit(c, "s2", "bd-pick-deep-forest-path-fern-c", 21, 3);
  save(c.project, "s2", "s2-creek-bridge");
}

// 3. 침엽 산자락 사당 — 전나무·측백 숲을 지나 북쪽 끝 바위 공터의 길가 사당. 목적: 순례길의 끝.
{
  const c = fresh();
  route(c, "s3", 30, 26, { exits: [{ x: 14, y: 25 }], end: { x: 14, y: 9 }, clearings: [{ x: 10, y: 2, w: 9, h: 6 }], forestType: "conifer", seed: 5 });
  kit(c, "s3", "bd-pick-mountain-pass-shrine", 14, 2);
  kit(c, "s3", "bd-pick-mountain-pass-boulder-l", 11, 3);
  kit(c, "s3", "bd-pick-mountain-pass-boulder-m", 17, 4);
  kit(c, "s3", "bd-pick-deep-forest-path-cairn", 12, 6);
  kit(c, "s3", "bd-pick-deep-forest-path-cairn-s", 16, 6);
  save(c.project, "s3", "s3-mountain-shrine");
}

// 4. 혼효림 가장자리 농가 — 서→동 길 위쪽으로 숲을 연 농가 마당: 헛간·울타리 밭·닭장·건초. 목적: 숲 속 외딴 농가.
{
  const c = fresh();
  route(c, "s4", 40, 26, { exits: [{ x: 0, y: 19 }, { x: 39, y: 19 }], clearings: [{ x: 5, y: 2, w: 28, h: 14 }], forestType: "mixed", seed: 3 });
  c.project.maps.s4!.mapRole = "town";  // 외딴 농가 = 작은 정착지(도로·필드 맵은 농장 소품을 막는다 — routePropPolicy)
  kit(c, "s4", "bd-farm-barn", 7, 4);
  kit(c, "s4", "bd-farm-fenced-plot", 16, 5);
  kit(c, "s4", "bd-farm-coop", 25, 6);
  kit(c, "s4", "bd-pick-riverside-mill-haystack", 14, 11);
  kit(c, "s4", "bd-pick-riverside-mill-haystack", 28, 10);
  fill(c, "s4", "버들항 농장 흙길", { x: 9, y: 10, w: 2, h: 8 });
  fill(c, "s4", "버들항 농장 흙길", { x: 19, y: 11, w: 1, h: 7 });
  save(c.project, "s4", "s4-forest-farm");
}

// 6. 숲 속 폐허 신전 — 남쪽 길이 무너진 성문을 지나 모자이크 바닥과 기둥이 남은 신전 터에 닿는다. 목적: 잊힌 신전.
{
  const c = fresh();
  route(c, "s6", 34, 28, { exits: [{ x: 16, y: 27 }], end: { x: 16, y: 13 }, clearings: [{ x: 9, y: 1, w: 15, h: 10 }], seed: 6 });
  kit(c, "s6", "bd-pick-temple-ruins-mosaic-medallion-5x5", 14, 3);
  for (const [x, y] of [[12, 2], [20, 2], [12, 6]] as const) kit(c, "s6", "bd-pick-temple-ruins-column-temple", x, y);
  kit(c, "s6", "bd-pick-temple-ruins-column-temple-broken", 20, 6);
  kit(c, "s6", "bd-pick-temple-ruins-fallen-column-temple", 21, 9);
  kit(c, "s6", "bd-pick-temple-ruins-rubble-temple", 10, 9);
  kit(c, "s6", "bd-pick-deep-forest-path-ruin-gate", 15, 9);
  save(c.project, "s6", "s6-forest-ruin");
}

// 7. 짙은 활엽수림의 숨은 연못 — 길 옆 공터에 둥근 연못, 물가에 고사리·버섯·징검돌. 목적: 길에서 잠시 쉬는 물가.
{
  const c = fresh();
  route(c, "s7", 32, 26, { exits: [{ x: 6, y: 25 }, { x: 6, y: 0 }], clearings: [{ x: 12, y: 7, w: 13, h: 10 }], seed: 8 });
  fill(c, "s7", "버들항 강·운하 물", { x: 15, y: 9, w: 8, h: 6 }, "ellipse");
  kit(c, "s7", "bd-pick-deep-forest-path-fern-b", 13, 8);
  kit(c, "s7", "bd-pick-deep-forest-path-toadstools-a", 24, 10);
  kit(c, "s7", "bd-pick-deep-forest-path-stones-a", 13, 12);
  kit(c, "s7", "bd-pick-deep-forest-path-wild-a", 20, 16);
  kit(c, "s7", "bd-pick-deep-forest-path-fern-c", 24, 15);
  save(c.project, "s7", "s7-hidden-pond");
}

// 8. 숲 가장자리 양 목장 — 침엽 숲을 연 울타리 목장(닫힌 울타리·문틈 없는 우리)과 양, 건초. 목적: 길가 목동의 우리.
{
  const c = fresh();
  route(c, "s8", 34, 24, { exits: [{ x: 0, y: 18 }, { x: 33, y: 18 }], clearings: [{ x: 7, y: 2, w: 20, h: 12 }], forestType: "conifer", seed: 9 });
  const { default: catalog } = await import("../../src/assets/beodeulGroundCatalog.json");
  const { createBeodeulGroundTileset } = await import("../../src/project/defaults/beodeulGround.ts");
  const { translateTiles } = await import("../../src/project/objectStamp.ts");
  const { setLayerTileAt } = await import("../../src/project/mapLayers.ts");
  const m = c.project.maps.s8!, ts = c.project.tilesets[m.tilesetId]!;
  const common = c.project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  const piece = (name: string) => catalog.recipes.find((r) => r.id === `bdg-woodland-fence-${name}`)!.rows[0]![0]!;
  const tr = translateTiles(common, ts, ["horizontal", "vertical", "vertical-east", "corner", "corner-se", "corner-nw", "corner-ne"].map(piece)).map;
  const put = (name: string, x: number, y: number) => setLayerTileAt(m, 3, y * m.width + x, tr.get(piece(name))!);
  const [x0, y0, x1, y1] = [10, 4, 21, 11];
  put("corner-nw", x0, y0); put("corner-ne", x1, y0); put("corner", x0, y1); put("corner-se", x1, y1);
  for (let x = x0 + 1; x < x1; x++) { put("horizontal", x, y0); if (x !== 15 && x !== 16) put("horizontal", x, y1); }
  for (let y = y0 + 1; y < y1; y++) { put("vertical", x0, y); put("vertical-east", x1, y); }
  for (const [x, y, s] of [[12, 6, "a"], [17, 7, "b"], [14, 9, "a"], [19, 10, "b"]] as const) kit(c, "s8", `bd-pick-coast-cliff-road-sheep-${s}`, x, y);
  kit(c, "s8", "bd-pick-coast-cliff-road-haystack", 24, 6);
  fill(c, "s8", "버들항 농장 흙길", { x: 15, y: 12, w: 2, h: 5 });
  save(c.project, "s8", "s8-sheep-pen");
}
