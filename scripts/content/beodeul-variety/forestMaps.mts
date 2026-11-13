// 버들항 «숲 맵» 표본(모델 없음) — 조수가 실제로 까는 숲 맵을 게임 여섯으로 지어 1배 그림과 사실을 남긴다.
// 마을 표본(forestFacts.mts)은 숲이 맵 구석 한 덩이뿐이라 «특히 숲쪽» 을 못 보였다(오너 2026-11-13). 여기서는 숲이 맵의 대부분이다.
//
//   [ROOT=<체크아웃>] bun scripts/content/beodeul-variety/forestMaps.mts <결과 폴더> [--tag now] [--games 0,1,2] [--kinds route,path,deep,wood] [--alone] [--project]
//        --alone: 게임끼리 서로를 모르게 짓는다(다른 게임 기록 없는 첫 게임과 같다)
//        --project: 맵마다 그 맵이 시작 맵인 프로젝트(<tag>-<종류>-<n>.project.json)도 남긴다 — 플레이어에서 본다
//
// 게임마다 짓는 맵(같은 게임 열쇠 = forestFacts 의 여섯, 같은 씨앗):
//   route  — author_wild_route   : 40×30 숲 도로(길 양옆 숲 벽)
//   path   — author_forest_route : 마을 북쪽 숲길 32×40 (terrain forest) — 씨앗을 넘긴다(안 넘기면 도구가 무작위 덧값을 써서 판마다 다른 숲이 된다)
//   edge   — author_forest_route : 숲 어귀(terrain edge)
//   field  — author_forest_route : 트인 들판(terrain field)
//   deep   — 마을(강가) + 숲 생김새 deep : 마을 가장자리의 깊은 숲
//   wood   — 던전 주제 forest(청사진 장소 종류 deep-forest «깊은 숲») : 빈터가 이어진 수관 숲 미로
// 남기는 것: <tag>-<종류>-<n>.png · <tag>-forest.json(맵마다 크기·겉모습·층별 칸 수·걷는 칸·주인공 세울 자리 셋)
// ROOT 를 주면 그 체크아웃의 코드로 짓는다(전/후 대조 — 같은 스크립트를 두 체크아웃에 돌린다).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.ROOT ?? path.resolve(import.meta.dir, "../../..");
const { createBlankProject } = await import(`${ROOT}/src/project/defaults/blankProject.ts`);
const { renderMapPng } = await import(`${ROOT}/scripts/qa-game/render.mts`);
const { runTool } = await import(`${ROOT}/src/editor/tools/toolRunner.ts`);
const { isPassable } = await import(`${ROOT}/src/project/collision.ts`);
const { createBuildRun } = await import(`${ROOT}/src/ai/v2/shared/buildRun.ts`);
const { builderFor } = await import(`${ROOT}/src/ai/v2/place/builders/index.ts`);
const { tilesetLookTableFor } = await import(`${ROOT}/src/assets/tilesetLooks.ts`);
const { chooseTilesetLook } = await import(`${ROOT}/src/project/tilesetLook.ts`);
const { serialize } = await import(`${ROOT}/src/project/io.ts`);

const TS = "beodeul_city";
const argv = process.argv.slice(2);
const out = argv[0]!;
const tag = argv.includes("--tag") ? argv[argv.indexOf("--tag") + 1]! : "now";
const only = argv.includes("--games") ? new Set(argv[argv.indexOf("--games") + 1]!.split(",").map(Number)) : undefined;
const kinds = argv.includes("--kinds") ? new Set(argv[argv.indexOf("--kinds") + 1]!.split(",")) : undefined;
const wants = (kind: string): boolean => !kinds || kinds.has(kind);
fs.mkdirSync(out, { recursive: true });
const NAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"];
const GAMES = NAMES.map((name) => JSON.stringify(["project", `variety-${name}`]));
const SALTS = [4242, 91357, 250118, 604811, 733202, 918466];
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;

type AnyProject = ReturnType<typeof createBlankProject>;
const call = (ctx: { project: AnyProject }, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string; ok?: boolean } => {
  const res = runTool(ctx as never, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`${name}: ${String(res.summary).slice(0, 200)}`);
  return res as never;
};

const rows: Record<string, unknown>[] = [];
function record(project: AnyProject, mapId: string, file: string, kind: string, game: number): void {
  const map = project.maps[mapId]!;
  const W = map.width, H = map.height;
  fs.writeFileSync(path.join(out, `${file}.png`), renderMapPng(project, map).png);
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const filled = Object.fromEntries(LAYERS.map((layer) => [layer, Array.from({ length: W * H }, (_, i) => m[layer]?.[i] ?? -1).filter((t) => t >= 0).length]));
  const walk: boolean[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) walk.push(isPassable(project, map, x, y));
  // 주인공 세울 자리: 걷는 칸 가운데 둘레 세 칸에 막힌 칸(나무)이 가장 많은 자리 셋(서로 열 칸 넘게 떨어진다).
  const scored: { x: number; y: number; n: number }[] = [];
  for (let y = 4; y < H - 4; y += 1) for (let x = 5; x < W - 5; x += 1) {
    if (!walk[y * W + x]) continue;
    let n = 0;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (!walk[(y + dy) * W + x + dx]) n += 1;
    scored.push({ x, y, n });
  }
  scored.sort((a, b) => b.n - a.n || a.y - b.y || a.x - b.x);
  const spots: typeof scored = [];
  for (const s of scored) { if (spots.length >= 3) break; if (spots.every((t) => Math.abs(t.x - s.x) + Math.abs(t.y - s.y) > 10)) spots.push(s); }
  // --project: 그 맵을 시작 맵으로 한 프로젝트를 남긴다(플레이어에서 보는 용도 — scripts/qa/runtime/beodeul-forest-look.scenario.mjs)
  if (argv.includes("--project") && spots[0]) {
    const play = structuredClone(project) as AnyProject & { startMapId: string; startPos: { x: number; y: number } };
    play.startMapId = mapId; play.startPos = { x: spots[0].x, y: spots[0].y };
    // 그 맵과 그 맵의 타일셋만 남긴다(빈 프로젝트의 타일셋 전부를 실으면 80MB 가 넘는다) — 저장 글은 편집기와 같은 serialize 로 쓴다
    play.maps = { [mapId]: play.maps[mapId]! } as never;
    play.mapTree = { mapId, children: [] } as never;
    play.tilesets = Object.fromEntries(Object.entries(play.tilesets).filter(([id]) => id === map.tilesetId)) as never;
    fs.writeFileSync(path.join(out, `${file}.project.json`), serialize(play as never));
  }
  rows.push({ id: file, kind, game, name: map.name, w: W, h: H, look: project.tilesets[TS]?.look ?? null, filled, walkable: walk.filter(Boolean).length, spots, file: `${file}.png` });
  console.log(`${file} ${W}x${H} look ${JSON.stringify(project.tilesets[TS]?.look ?? null)}`);
}

// 여섯 게임은 «한 사람이 차례로 만든 게임» 이다 — 뒤 게임은 앞 게임들이 이미 쓴 겉모습을 안다(조수 요청의 lookTaken, src/ai/piAgent/gameLooks.ts).
// 고르는 쪽이 이 값을 모르는 옛 체크아웃에서는 그냥 무시된다(게임마다 열쇠 해시만).
const TAKEN: unknown[][] = [];
{
  const table = tilesetLookTableFor(TS);
  const looks: unknown[] = [];
  for (const key of GAMES) { TAKEN.push([...looks]); if (table) looks.push(chooseTilesetLook(table, key, looks)); }
}
for (const [n, key] of GAMES.entries()) {
  if (only && !only.has(n)) continue;
  const lookTaken = argv.includes("--alone") ? undefined : TAKEN[n];
  // 숲 도로
  if (wants("route")) try {
    const ctx = { project: createBlankProject(), assistantRun: true, lookKey: key, lookTaken } as { project: AnyProject; currentMapId?: string };
    ctx.currentMapId = ctx.project.startMapId;
    call(ctx, "create_map", { id: "map_route", name: "숲 도로", width: 40, height: 30, tilesetId: TS });
    call(ctx, "author_wild_route", { mapId: "map_route", exits: [{ x: 0, y: 22 }, { x: 39, y: 6 }], seed: SALTS[n]! % 1000, clearings: [{ x: 17, y: 12, w: 6, h: 5 }] });
    record(ctx.project, "map_route", `${tag}-route-${n}`, "route", n);
  } catch (error) { console.log(`${tag}-route-${n}: 짓기 실패 — ${String(error).slice(0, 200)}`); }
  // 마을 + 북쪽 숲길 셋(숲길 · 숲 어귀 · 들판)
  if (wants("path")) try {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key, lookTaken } as { project: AnyProject; currentMapId: string };
    const spec = { type: "village", name: "버들 마을", salt: SALTS[n]!, variety: `${key}|숲 곁 마을` };
    const res = builderFor(spec as never)!.build(createBuildRun(ctx as never), spec as never);
    if (!res.ok || !res.mapIds[0]) throw new Error(`village: ${res.summary.slice(0, 160)}`);
    const made = call(ctx, "author_forest_route", { fromMapId: res.mapIds[0], side: "north", count: 3, names: ["속삭이는 숲", "숲 어귀", "바람 들판"], terrains: ["forest", "edge", "field"], seed: SALTS[n]! % 1_000_000 });
    const maps = ((made.data as { maps?: { mapId: string }[] } | undefined)?.maps ?? []).map((row) => row.mapId);
    ["path", "edge", "field"].forEach((kind, i) => { if (maps[i]) record(ctx.project, maps[i]!, `${tag}-${kind}-${n}`, kind, n); });
  } catch (error) { console.log(`${tag}-path-${n}: 짓기 실패 — ${String(error).slice(0, 200)}`); }
  // 마을 가장자리의 깊은 숲(숲 생김새 deep 이 있는 체크아웃만 — 없으면 그 게임이 고른 생김새 그대로)
  if (wants("deep")) try {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key, lookTaken } as { project: AnyProject; currentMapId: string };
    const table = tilesetLookTableFor(TS)!;
    const hasDeep = Object.keys((table.parts as Record<string, { options: Record<string, unknown> }>).woods?.options ?? {}).includes("deep");
    const spec = { type: "village", name: "숲가 마을", salt: SALTS[(n + 2) % 6]!, variety: `${key}|숲가 마을`, hints: { width: 56, height: 44 } };
    const run = createBuildRun(ctx as never);
    let res = builderFor(spec as never)!.build(run, spec as never);
    if (hasDeep && res.ok && res.mapIds[0]) {
      // 게임이 고른 겉모습에서 숲 생김새만 deep 으로 바꿔 같은 마을을 새로 짓는다(다른 갈래는 그 게임 것 그대로).
      const look = { ...(ctx.project.tilesets[TS]!.look ?? { textureKey: table.texture }), woods: "deep" };
      const again = createBlankProject();
      again.tilesets[TS]!.look = look as never;
      const ctx2 = { project: again, currentMapId: again.startMapId, assistantRun: true, lookKey: key, lookTaken } as { project: AnyProject; currentMapId: string };
      res = builderFor(spec as never)!.build(createBuildRun(ctx2 as never), spec as never);
      if (res.ok && res.mapIds[0]) record(ctx2.project, res.mapIds[0], `${tag}-deep-${n}`, "deep", n);
    } else if (res.ok && res.mapIds[0]) record(ctx.project, res.mapIds[0], `${tag}-deep-${n}`, "deep", n);
  } catch (error) { console.log(`${tag}-deep-${n}: 짓기 실패 — ${String(error).slice(0, 200)}`); }
  // 깊은 숲(던전 주제 forest) — 조수의 청사진이 «깊은 숲» 장소로 짓는 맵
  if (wants("wood")) try {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key, lookTaken } as { project: AnyProject; currentMapId: string };
    const spec = { type: "dungeon", theme: "forest", size: "small", name: "깊은 숲", salt: SALTS[n]! };
    const res = builderFor(spec as never)!.build(createBuildRun(ctx as never), spec as never);
    if (!res.ok || !res.mapIds[0]) throw new Error(`dungeon: ${res.summary.slice(0, 160)}`);
    record(ctx.project, res.mapIds[0], `${tag}-wood-${n}`, "wood", n);
  } catch (error) { console.log(`${tag}-wood-${n}: 짓기 실패 — ${String(error).slice(0, 200)}`); }
}
fs.writeFileSync(path.join(out, `${tag}${kinds ? `-${[...kinds].join("-")}` : ""}-forest.json`), JSON.stringify({ tag, rows }));
