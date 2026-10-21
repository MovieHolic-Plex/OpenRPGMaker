// jp_city 숲 참고문서(jp-forest) 장면 — 실제 도구·엔진으로 만든 맵과 검사 결과를 JSON 으로 낸다. 그림·문서는 bake_forest_refs.py 가 굽는다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/forest/forest_refs_scenes.mts <out.json>
// 맵은 모두 번들 jp_city 정의(src/assets/jpCityTileset.json)로 만든다. 손으로 쓴 칸 번호 없음 — 칸 번호는 정의·도구 결과에서 읽는다.
import { readFileSync, writeFileSync } from "node:fs";
import { deserialize } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";
import { getTool } from "@/editor/tools/toolRegistry";
import { checkJpForest } from "@/editor/jpCity/forestPainter";
import { isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";

const outPath = process.argv[2] ?? "/tmp/jpf/refs/scenes.json";
const project: Project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.tilesets.jp_city = createJpCityTileset();
const ts = project.tilesets.jp_city!;
const g = ts.autotileGroups!.find((a) => a.id === "jp-forest4-bl")!;
const cp = g.composer!;
const LAWN = 3281;
const roadGroup = ts.autotileGroups!.find((a) => a.id === "jp-lane-road")!;
const ROAD = (roadGroup.variantMap as Record<string, number>)["255"] ?? roadGroup.memberTileIds[0]!;   // 길 몸통 칸
const run = (name: string, args: Record<string, unknown>) => {
  const r = getTool(name)!.run(project, args);
  return { summary: r.summary, data: r.data, warnings: r.warnings ?? [] };
};
const layersOf = (m: GameMap) => ({ L1: [...Array(m.width * m.height).keys()].map((i) => layerTileAt(m, 1, i)), L2: [...Array(m.width * m.height).keys()].map((i) => layerTileAt(m, 2, i)),
  L3: [...Array(m.width * m.height).keys()].map((i) => layerTileAt(m, 3, i)), L4: [...Array(m.width * m.height).keys()].map((i) => layerTileAt(m, 4, i)) });
const pass = (m: GameMap) => [...Array(m.width * m.height).keys()].map((i) => (isPassable(project, m, i % m.width, Math.floor(i / m.width)) ? 1 : 0));
const lawnMap = (id: string, w: number, h: number): GameMap => {
  run("create_map", { id, name: id, width: w, height: h, tilesetId: "jp_city" });
  const m = project.maps[id]!;
  for (let i = 0; i < w * h; i++) setLayerTileAt(m, 1, i, LAWN);
  return m;
};
const scenes: Record<string, unknown> = {};
const scene = (key: string, m: GameMap, extra: Record<string, unknown> = {}) => {
  scenes[key] = { id: m.id, width: m.width, height: m.height, layers: layersOf(m), passable: pass(m), issues: checkJpForest(m, ts), ...extra };
};

// 1) 정답 예제: 16×12 잔디, 숲 사각형 (2,2) 12×7, dense, 그늘 켬
lawnMap("ex", 16, 12);
const exRes = run("paint_jp_forest", { mapId: "ex", rect: { x: 2, y: 2, w: 12, h: 7 }, forestType: "dense" });

scene("ex", project.maps.ex!, { call: { tool: "paint_jp_forest", args: { mapId: "ex", rect: { x: 2, y: 2, w: 12, h: 7 }, forestType: "dense" } }, result: exRes });
// 2) 그늘 끔(나무가 떠 보인다)
// 3) 공원 숲 grove
lawnMap("grove", 32, 20);
const grRes = run("paint_jp_forest", { mapId: "grove", rect: { x: 2, y: 2, w: 28, h: 15 }, forestType: "grove" });
scene("grove", project.maps.grove!, { call: { tool: "paint_jp_forest", args: { mapId: "grove", rect: { x: 2, y: 2, w: 28, h: 15 }, forestType: "grove" } }, result: grRes });
// 4) 오류: 나무 키트를 낱개로 격자에 찍기(줄 맞춘 나무·그늘 없음·수관이 안 겹친다)
lawnMap("kits", 16, 12);
const kitCalls: Record<string, unknown>[] = [];
for (const [x, y] of [[2, 2], [6, 2], [10, 2], [2, 5], [6, 5], [10, 5]] as const) {
  const a = { objectId: "kit:jp_city/jp-prop-tree-zelkova", mapId: "kits", x, y };
  try { run("stamp_object", a); kitCalls.push(a); } catch (e) { kitCalls.push({ ...a, error: String((e as Error).message).slice(0, 160) }); }
}
scene("kits", project.maps.kits!, { calls: kitCalls });
// 5) 오류: 2칸 띠(나무가 서지 못한다)
lawnMap("thin", 16, 12);
const thRes = run("paint_jp_forest", { mapId: "thin", rect: { x: 2, y: 5, w: 12, h: 2 }, forestType: "dense" });
scene("thin", project.maps.thin!, { call: { tool: "paint_jp_forest", args: { mapId: "thin", rect: { x: 2, y: 5, w: 12, h: 2 } } }, result: thRes });
// 6) 길·건물 칸은 건너뛴다: 숲 사각형 한가운데 길
lawnMap("road", 16, 12);
for (let x = 0; x < 16; x++) setLayerTileAt(project.maps.road!, 1, 6 * 16 + x, ROAD);
const rdRes = run("paint_jp_forest", { mapId: "road", rect: { x: 2, y: 2, w: 12, h: 9 }, forestType: "dense" });
scene("road", project.maps.road!, { call: { tool: "paint_jp_forest", args: { mapId: "road", rect: { x: 2, y: 2, w: 12, h: 9 } } }, result: rdRes });
// 7) 변조 검출: 정답 예제를 복사해 한 곳씩 망가뜨리고 검사한다
const own = new Set<number>(cp.sprites.flatMap((s) => s.tiles).filter((t) => t >= 0 && !(g.memberTileIds ?? []).includes(t)));
const mutate = (key: string, fn: (m: GameMap) => string) => {
  const m = structuredClone(project.maps.ex!) as GameMap;
  m.id = key;
  const what = fn(m);
  scene(key, m, { mutation: what });
};
const firstTree = (m: GameMap, pred: (x: number, y: number, t: number, L: number) => boolean) => {
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) for (const L of [4, 3, 2] as const) {
    const t = layerTileAt(m, L, y * m.width + x);
    if (own.has(t) && pred(x, y, t, L)) return { x, y, t, L };
  }
  throw new Error("no tree tile: " + m.id);
};
mutate("mut-layer", (m) => {   // 수관 칸을 1층에 칠함(잘못된 레이어)
  const p = firstTree(m, (_x, y) => y >= 4);
  setLayerTileAt(m, 1, p.y * m.width + p.x, p.t); setLayerTileAt(m, p.L, p.y * m.width + p.x, -1);
  return `(${p.x},${p.y}) ${p.L}층 칸 ${p.t} 을 1층으로 옮김`;
});
mutate("mut-trunk", (m) => {   // 밑동 줄 칸을 지움(빠진 줄기)
  // 밑동 칸 중 지웠을 때 바로 위 줄기 칸이 「밑동 위에만 쓰이는 칸」이라 검사가 알아볼 수 있는 첫 칸(같은 그림 칸이 수관 여러 자리에 합쳐진 줄기는 구조만으로 못 가린다)
  const bottom = new Set(cp.sprites.flatMap((s) => s.tiles.slice((s.h - 1) * s.w)).filter((t) => t >= 0));
  const base = checkJpForest(m, ts).length;
  for (let y = 5; y < m.height; y++) for (let x = 4; x < m.width; x++) {
    const i = y * m.width + x;
    if (!([2, 3, 4] as const).some((L) => bottom.has(layerTileAt(m, L, i)))) continue;
    const keep = ([2, 3, 4] as const).map((L) => layerTileAt(m, L, i));
    for (const L of [2, 3, 4] as const) setLayerTileAt(m, L, i, -1);
    if (checkJpForest(m, ts).length > base) return `(${x},${y}) 밑동 칸의 2~4층을 지움`;
    ([2, 3, 4] as const).forEach((L, k) => setLayerTileAt(m, L, i, keep[k]!));
  }
  throw new Error("mut-trunk: 검사가 알아볼 밑동 칸이 없다");
});
mutate("mut-road", (m) => {    // 수관이 넘친 숲 밖 잔디 칸을 길로 바꿈(넘친 수관이 길 위에 남는다)
  const forest = new Set(g.memberTileIds ?? []);
  const p = firstTree(m, (x, y) => !forest.has(layerTileAt(m, 1, y * m.width + x)));
  setLayerTileAt(m, 1, p.y * m.width + p.x, ROAD);
  return `(${p.x},${p.y}) 숲 밖 잔디를 길 ${ROAD} 로 바꿈(그 위 수관 칸은 그대로)`;
});
// 8) 실제 조립기 결과: 신사 지역(compose_jp_region), 주택가 공원 숲(compose_jp_city_street residential)
run("create_map", { id: "shrine", name: "shrine", width: 50, height: 36, tilesetId: "jp_city" });
const shRes = run("compose_jp_region", { mapId: "shrine", region: "torii_shrine_precinct", seed: 1 });
scene("shrine", project.maps.shrine!, { call: { tool: "compose_jp_region", args: { region: "torii_shrine_precinct", seed: 1 } }, result: { summary: shRes.summary } });
run("create_map", { id: "street", name: "street", width: 50, height: 36, tilesetId: "jp_city" });
const stRes = run("compose_jp_city_street", { mapId: "street", style: "residential", seed: 1 });
scene("street", project.maps.street!, { call: { tool: "compose_jp_city_street", args: { style: "residential", seed: 1 } }, result: { summary: stRes.summary, parkForestCells: (stRes.data as { parkForestCells?: number }).parkForestCells } });

const passOf = (t: number) => ts.passability[t];
const out = {
  tilesetId: ts.id, textureKey: "tex_jp_city", count: ts.count, tilesPerRow: ts.tilesPerRow, tileSize: ts.tileSize,
  group: { id: g.id, name: g.name, layer: g.layer, memberTileIds: g.memberTileIds, composer: { ...cp, overhangOnTiles: undefined, overhangOnTilesCount: cp.overhangOnTiles?.length ?? 0 } },
  engine: {
    floor: { tile: g.memberTileIds[0], passability: passOf(g.memberTileIds[0]!), priority: ts.priority[g.memberTileIds[0]!], meta: ts.tileMeta?.[g.memberTileIds[0]!] },
    sprite: { tile: cp.sprites[0]!.tiles.find((t) => t >= 0), passability: passOf(cp.sprites[0]!.tiles.find((t) => t >= 0)!), priority: ts.priority[cp.sprites[0]!.tiles.find((t) => t >= 0)!], meta: ts.tileMeta?.[cp.sprites[0]!.tiles.find((t) => t >= 0)!] },
    apron: { tile: cp.ground!.apronTiles.find((t) => t >= 0), passability: passOf(cp.ground!.apronTiles.find((t) => t >= 0)!), priority: ts.priority[cp.ground!.apronTiles.find((t) => t >= 0)!], meta: ts.tileMeta?.[cp.ground!.apronTiles.find((t) => t >= 0)!] },
    lawn: { tile: LAWN, passability: passOf(LAWN), priority: ts.priority[LAWN] },
    road: ROAD,
  },
  scenes,
};
writeFileSync(outPath, JSON.stringify(out));
console.log(Object.entries(scenes).map(([k, v]) => `${k}: issues ${(v as { issues: unknown[] }).issues.length}`).join(" · "));
