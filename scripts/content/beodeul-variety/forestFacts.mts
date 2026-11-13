// 버들항 숲·바닥 «닮음» 재기의 사실 찍기(모델 없음) — 맵마다 나무 킷 놓임·이어진 숲 수관 칸·밑풀 기물·바닥 재질을 적는다.
// 화소 비교(같은 그림인가)와 지표 계산은 forestMeasure.py 가 한다.
//
//   bun scripts/content/beodeul-variety/forestFacts.mts build <결과 폴더> [--tag before|after]
//        같은 마을 요청을 게임 여섯 × (강가·포구)로 짓고(sixGames 와 같은 열쇠·씨앗), 숲 생김새 선택지마다 같은 씨앗 한 판씩을 더 짓는다.
//        남기는 것: <tag>-<theme>-<n>.png(1배) · <tag>-woods-<이름>.png · <tag>-facts.json
//   bun scripts/content/beodeul-variety/forestFacts.mts read <결과.json> <project.json | 그것을 품은 폴더>...
//        저장된 게임·명세 은행 결과의 버들항 맵을 같은 꼴로 적는다.
//
// 왜(오너 2026-11-13): «나무랑 땅 타일도 좀 다양하게 해야할듯. 특히 숲쪽....» — 한 맵의 숲이 나무 그림 하나를 고른 간격으로 찍은 것으로 읽혔다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { activeTileGrafts } from "../../../src/assets/tileGrafts.ts";
import { tilesetLookOptions, tilesetLookTableFor } from "../../../src/assets/tilesetLooks.ts";
import { BEODEUL_NATURE } from "../../../src/project/defaults/beodeulNature.ts";
import { chooseTilesetLook } from "../../../src/project/tilesetLook.ts";
import { standKitPictures, standVariantKit } from "../../../src/project/standKit.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types.ts";

const TS = "beodeul_city";
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
type KitCells = { kit: StructureKitDef; kind: "tree" | "under"; cells: { dx: number; dy: number; tile: number }[] };

function natureKits(tileset: TilesetDef): KitCells[] {
  const out: KitCells[] = [];
  const meta = tileset.tileMeta as unknown as ({ tags?: string[] } | undefined)[] | undefined;
  for (const kit of tileset.structureKits ?? []) {
    const cells: KitCells["cells"] = [];
    kit.rows.forEach((row, dy) => { for (const layer of [row.tiles, row.upperTiles]) (layer ?? []).forEach((tile, dx) => { if (typeof tile === "number" && tile >= 0) cells.push({ dx, dy, tile }); }); });
    if (!cells.length) continue;
    const tags = meta?.[cells[0]!.tile]?.tags ?? [], kitTags = kit.ai?.tags ?? [];
    const tree = tags.includes("tree");
    const under = !tree && kit.width <= 3 && kit.height <= 2 && (tags.includes("decal") || tags.includes("prop")) && kitTags.some((t) => t === "숲" || t === "필드" || t === "산" || t === "늪");
    if (tree || under) out.push({ kit, kind: tree ? "tree" : "under", cells });
    // 숲 구성의 «다른 개체» 그림(같은 킷의 둘째·셋째 그림)도 같은 킷으로 읽되 이름에 #번호를 붙인다 — 같은 그림이 몇 번 섰는지를 그림 단위로 센다.
    const stand = tileset.look?.stand;
    if (tree && stand) for (let pick = 1; pick < standKitPictures(tileset.id, stand, kit.id); pick += 1) {
      const variant = standVariantKit(tileset, kit, stand, pick);
      if (!variant) continue;
      const vcells: KitCells["cells"] = [];
      variant.rows.forEach((row, dy) => { for (const layer of [row.tiles, row.upperTiles]) (layer ?? []).forEach((tile, dx) => { if (typeof tile === "number" && tile >= 0) vcells.push({ dx, dy, tile }); }); });
      if (vcells.length) out.push({ kit: { ...variant, id: `${kit.id}#${pick}` }, kind: "tree", cells: vcells });
    }
  }
  return out.sort((a, b) => b.cells.length - a.cells.length || a.kit.id.localeCompare(b.kit.id));
}

function factsOf(project: Project, map: GameMap, id: string): Record<string, unknown> {
  const tileset = project.tilesets[map.tilesetId]!;
  const W = map.width, H = map.height, n = W * H;
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const at = (layer: string, i: number): number => m[layer]?.[i] ?? -1;
  const cellSets = Array.from({ length: n }, (_, i) => new Set(LAYERS.map((l) => at(l, i)).filter((t) => t >= 0)));
  const where = new Map<number, number[]>();
  cellSets.forEach((set, i) => { for (const t of set) { const a = where.get(t); if (a) a.push(i); else where.set(t, [i]); } });
  const claimed = new Set<string>();
  const placed: { kit: string; kind: string; x: number; y: number; w: number; h: number }[] = [];
  const found = natureKits(tileset);
  const kitById = new Map(found.map((entry) => [entry.kit.id, entry.kit] as const));
  for (const { kit, kind, cells } of found) {
    const anchor = cells[0]!;
    for (const i of where.get(anchor.tile) ?? []) {
      const x = (i % W) - anchor.dx, y = Math.floor(i / W) - anchor.dy;
      if (x < 0 || y < 0 || x + kit.width > W || y + kit.height > H) continue;
      if (!cells.every((c) => cellSets[(y + c.dy) * W + x + c.dx]!.has(c.tile) && !claimed.has(`${x + c.dx},${y + c.dy},${c.tile}`))) continue;
      for (const c of cells) claimed.add(`${x + c.dx},${y + c.dy},${c.tile}`);
      placed.push({ kit: kit.id, kind, x, y, w: kit.width, h: kit.height });
    }
  }
  // 그림: 킷 칸마다 (그림판, 칸) — 겉모습이 겹친 뒤의 것. 화소 비교는 파이썬이 한다.
  const grafts = new Map(activeTileGrafts(tileset).map((g) => [g.targetTile, [g.sourceChipset, g.sourceTile] as [string, number]]));
  const sheet = tileset.image.type === "bundled" ? tileset.image.id : "?";
  const picOf = (tile: number): [string, number] => grafts.get(tile) ?? [sheet, tile];
  const kitPics: Record<string, [string, number][]> = {};
  for (const p of placed) if (!kitPics[p.kit]) {
    const kit = kitById.get(p.kit)!;
    kitPics[p.kit] = kit.rows.flatMap((row) => Array.from({ length: kit.width }, (_, x) => { const up = row.upperTiles?.[x] ?? -1; return picOf(up >= 0 ? up : row.tiles[x] ?? -1); }));
  }
  // 이어진 숲 수관: 자연 덧그림의 수관 칸에서 이식된 칸(2·3층)
  const canopySrc = new Set<number>();
  for (const style of ["leaf", "snow"] as const) for (const row of BEODEUL_NATURE.forestCanopy[style]) for (const t of row) if (t >= 0) canopySrc.add(t);
  const canopyTile = new Set((tileset.tileGrafts ?? []).filter((g) => g.sourceChipset === "tex_beodeul_nature" && canopySrc.has(g.sourceTile)).map((g) => g.targetTile));
  const canopy: number[] = [];
  for (let i = 0; i < n; i++) if (canopyTile.has(at("lowerOverlayTiles", i)) || canopyTile.has(at("upperTiles", i))) canopy.push(i);
  const canopyPics = [...new Set(canopy.map((i) => { const t = canopyTile.has(at("upperTiles", i)) ? at("upperTiles", i) : at("lowerOverlayTiles", i); return picOf(t).join("#"); }))].length;
  // 바닥: 칸마다 (아래층 칸의 그림, 아래 덧층 칸의 그림) — 재질 이름은 이름표
  const meta = tileset.tileMeta as unknown as ({ label?: string } | undefined)[] | undefined;
  const ground: Record<string, number> = {}, floor: Record<string, number> = {};
  let walk = 0;
  for (let i = 0; i < n; i++) {
    if (!isPassable(project, map, i % W, Math.floor(i / W))) continue;
    walk += 1;
    const low = at("lowerTiles", i), ov = at("lowerOverlayTiles", i);
    const key = `${meta?.[low]?.label ?? low}|${picOf(low).join("#")}`;
    ground[key] = (ground[key] ?? 0) + 1;
    if (ov >= 0) { const k2 = `${meta?.[ov]?.label ?? ov}`; floor[k2] = (floor[k2] ?? 0) + 1; }
  }
  // 숲 속에 설 자리(쪽에서 주인공을 세워 가까이 본다): 걷는 칸 가운데 세 칸 안에 나무·수관 칸이 가장 많은 칸 셋(서로 열 칸 넘게 떨어진 것).
  const wood = new Uint8Array(n);
  for (const p of placed) if (p.kind === "tree") for (let y = p.y; y < p.y + p.h; y += 1) for (let x = p.x; x < p.x + p.w; x += 1) wood[y * W + x] = 1;
  for (const c of canopy) wood[c] = 1;
  const scored: { x: number; y: number; n: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = i % W, y = (i - x) / W;
    if (x < 6 || y < 5 || x >= W - 6 || y >= H - 4 || !isPassable(project, map, x, y) || at("upperTiles", i) >= 0 || at("upperTiles", i - W) >= 0) continue;
    let k = 0; for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) k += wood[(y + dy) * W + x + dx]!;
    scored.push({ x, y, n: k });
  }
  scored.sort((a, b) => b.n - a.n);
  const spots: typeof scored = [];
  for (const s of scored) { if (spots.length >= 3) break; if (spots.every((t) => Math.abs(t.x - s.x) + Math.abs(t.y - s.y) > 10)) spots.push(s); }
  return { id, map: map.name, w: W, h: H, look: tileset.look ?? null, placed, kitPics, canopy, canopyPics, walk, ground, floor, spots };
}

const argv = process.argv.slice(2);
const mode = argv[0];
if (mode === "build") {
  const out = argv[1]!; const tag = argv.includes("--tag") ? argv[argv.indexOf("--tag") + 1]! : "now";
  fs.mkdirSync(out, { recursive: true });
  const GAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
  const SALTS = [4242, 91357, 250118, 604811, 733202, 918466];
  const REQUEST: Record<string, { name: string; task: string; hints: Record<string, unknown> }> = {
    river: { name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
    coast: { name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
  };
  const rows: Record<string, unknown>[] = [];
  // 여섯 게임은 «한 사람이 차례로 만든 게임» — 뒤 게임은 앞 게임들이 쓴 겉모습을 안다(조수 요청의 lookTaken, src/ai/piAgent/gameLooks.ts). --alone 이면 서로 모른다.
  const TAKEN = new Map<string, ToolContext["lookTaken"]>();
  if (!argv.includes("--alone")) {
    const looks: NonNullable<ToolContext["lookTaken"]>[number][] = [];
    for (const key of GAMES) { TAKEN.set(key, [...looks]); looks.push(chooseTilesetLook(tilesetLookTableFor(TS)!, key, looks)); }
  }
  const buildOne = (key: string, salt: number, theme: string, file: string, look?: Record<string, string>): void => {
    const req = REQUEST[theme]!;
    const project = createBlankProject();
    if (look) project.tilesets[TS]!.look = { textureKey: tilesetLookTableFor(TS)!.texture, ...look };
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key, ...(look ? {} : { lookTaken: TAKEN.get(key) }) } as ToolContext;
    const spec = { type: "village", name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as PlaceSpec;
    const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
    const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
    if (!res.ok || !map) { console.log(`${file}: 짓기 실패 — ${res.summary.slice(0, 160)}`); return; }
    fs.writeFileSync(path.join(out, `${file}.png`), renderMapPng(ctx.project, map).png);
    rows.push({ ...factsOf(ctx.project, map, file), file: `${file}.png`, theme, salt });
    console.log(`${file} ${map.width}x${map.height} look ${JSON.stringify(ctx.project.tilesets[TS]!.look ?? null)}`);
  };
  for (const theme of ["river", "coast"]) for (const [n, key] of GAMES.entries()) buildOne(key, SALTS[n]!, theme, `${tag}-${theme}-${n}`);
  // 숲 생김새 선택지마다 같은 씨앗·같은 게임(다른 갈래는 비움)
  for (const woods of tilesetLookOptions(tilesetLookTableFor(TS)!, "woods")) buildOne(GAMES[0]!, SALTS[2]!, "river", `${tag}-woods-${woods || "orig"}`, woods ? { woods } : {});
  // 숲 구성이 있는 판(4차부터): 같은 씨앗·같은 숲 구성에 숲 생김새만 바꿔 — 생김새가 칸으로 얼마나 갈리는지 본다.
  const stands = tilesetLookOptions(tilesetLookTableFor(TS)!, "stand" as never).filter(Boolean);
  if (stands.length) for (const woods of tilesetLookOptions(tilesetLookTableFor(TS)!, "woods")) buildOne(GAMES[0]!, SALTS[2]!, "river", `${tag}-shape-${woods || "orig"}`, { ...(woods ? { woods } : {}), stand: stands.includes("oakwood") ? "oakwood" : stands[0]!, standKey: "tex_beodeul_stands" });
  fs.writeFileSync(path.join(out, `${tag}-facts.json`), JSON.stringify({ tag, rows }));
} else if (mode === "read") {
  const outFile = argv[1]!;
  const files: string[] = [];
  const walk = (p: string, depth: number): void => {
    if (p.endsWith("project.json")) { files.push(p); return; }
    if (depth < 0 || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) return;
    if (fs.existsSync(path.join(p, "project.json"))) { files.push(path.join(p, "project.json")); return; }
    for (const name of fs.readdirSync(p).sort()) if (!name.startsWith(".") && name !== "maps") walk(path.join(p, name), depth - 1);
  };
  for (const input of argv.slice(2)) walk(path.resolve(input), 2);
  const rows: Record<string, unknown>[] = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { project?: Project } & Project;
    const project = (raw.project ?? raw) as Project;
    const game = path.basename(path.dirname(file));
    for (const map of Object.values(project.maps)) {
      if (map.tilesetId !== TS || project.tilesets[TS]?.image.type !== "bundled") continue;
      const facts = factsOf(project, map, `${game}/${map.name}`);
      if ((facts.placed as unknown[]).length || (facts.canopy as unknown[]).length) rows.push({ ...facts, game });
    }
  }
  fs.writeFileSync(outFile, JSON.stringify({ tag: "read", rows }));
  console.log(`게임 ${files.length} · 버들항 맵 ${rows.length} → ${outFile}`);
} else throw new Error("forestFacts.mts build <폴더> [--tag …] | read <결과.json> <project.json…>");
