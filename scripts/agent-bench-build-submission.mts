/**
 * 에이전트 벤치 제출물 생성 — 저장소의 마을 시공 하네스로 짓고, 감사에서 걸리는
 * 결함 세 가지를 고친 뒤, 채점기와 같은 코드로 자체 채점해 제출 경로에 쓴다.
 *
 *   npx tsx scripts/agent-bench-build-submission.mts sweep
 *   npx tsx scripts/agent-bench-build-submission.mts emit --seed 7 --width 64 --height 64 --houses 14
 *   npx tsx scripts/agent-bench-build-submission.mts render --in output/agent-bench/submission.json
 *
 * 하네스를 쓰는 이유: 문 규약·오토타일 변형·울타리 둘레·레이어 우선순위는 전부 이
 * 저장소 안에 정본이 있다. 타일 번호를 손으로 적으면 그 정본과 갈린다.
 *
 * 시공 후 보정 세 가지(전부 "제출물 = 타일 두 장"이라는 맥락에서 필요한 것):
 *  1) 여관 간판 443 — 하네스는 이 번호에 다른 칩셋 그래픽을 이식해서 쓴다(builder.
 *     ensureInnSignGraft). 제출물은 타일 번호만 나가므로 이식이 따라가지 않고, 기본
 *     칩셋의 443 은 전역 금지 타일이다. 같은 용도의 상점 간판 473 으로 바꾼다.
 *  2) 나무 밑동 — 하네스는 수관(upper)+밑동(lower) 세로 2칸으로 한 그루를 만든다.
 *     여기에 수관 칸 자신의 하위에도 밑동을 깔아 "숲 겹침"(layoutPlacementValidate 가
 *     명시적으로 인정하는 배치) 형태로 만든다. 세로 2칸 규칙도 그대로 유지된다.
 *  3) 떨어진 포석 노두 — placeStoneRestSpots 는 석상 쉼터를 일부러 길에서 떼어 놓는다.
 *     마을 도로망은 하나여야 하므로 짧은 포석 길로 본망에 잇고 오토타일을 다시 성형한다.
 */
import fs from "node:fs";
import path from "node:path";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { buildTownGroundTruth } from "../src/benchmark/town/groundTruth.ts";
import { scoreAgentMap } from "../src/benchmark/agent/scoring.ts";
import { ROAD_FAMILY, detectVillage } from "../src/benchmark/agent/detect.ts";
import { connectedComponents } from "../src/benchmark/town/gridWalk.ts";
import { SUBMISSION_PATH, parseSubmission } from "../src/benchmark/agent/spec.ts";
import { renderTileGridPng } from "../src/benchmark/town/inputImages.ts";
import { deriveTreePairs } from "../src/benchmark/groundTruth.ts";
import { DEFAULT_COBBLE_AUTOTILE_GROUP } from "../src/project/defaults/autotileGroups.ts";
import { shapeAutotileGroupAround } from "../src/project/defaults/autotileEngine.ts";
import { COBBLE_TILE } from "../src/project/defaults/chipsetMapping.ts";
import { TILE } from "../src/project/defaults/constants.ts";
import { validateLayoutPlacement } from "../src/project/lint/layoutPlacementValidate.ts";
import type { GameMap, Project } from "../src/project/types.ts";
import type { ToolContext } from "../src/editor/tools/types.ts";

const EMPTY = -1;
const INN_SIGN_BANNED = 443;
const SHOP_SIGN = 473;

export interface FlatMap {
  width: number;
  height: number;
  lower: number[];
  upper: number[];
}

export interface BuildArgs {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly houses: number;
  readonly pathStyle: "sand" | "dirt" | "stone";
  readonly decor?: boolean;
  readonly fences?: boolean;
  readonly edgeTrees?: "conifer" | "dense" | "none";
  readonly theme?: string;
  readonly kitMix?: string;
  readonly plazaLayout?: string;
  /** 강·숲 terrain 패스 생략 — 물이 없으면 판자 다리(199)도 없다. */
  readonly skipTerrain?: boolean;
  /**
   * 집 형태 카탈로그 — 순서대로 돌려 쓴다. 왜 직접 고르는가: estate-* 는 본채와
   * **분리 헛간**을 한 필지에 세우고, 헛간에는 문이 없다. 감사는 "문 없는 건물"을
   * 집이 아닌 것으로 세므로, 마을을 문 있는 집만으로 구성하려면 형태를 지정해야 한다.
   * rooftop-deck 은 옥상 판자(199)가 상위로 올라가 레이어 규율에 걸리므로 제외한다.
   */
  readonly templates?: readonly string[];
  /** 길 폭(1~3). 넓은 길은 마을 규모를 키우지만 울타리·문 앞 여유를 줄인다. */
  readonly roadWidth?: number;
  /** 나무 배치 방식 — pair(2칸) | single(1칸) | none. */
  readonly treeMode?: TreeMode;
}

const groundTruth = buildTownGroundTruth();
const TREE_PAIRS = new Map(deriveTreePairs());

/** 하네스 시공 — 프로젝트째로 돌려준다(정본 린터를 그 위에 돌리기 위해). */
export function buildProject(args: BuildArgs): { project: Project; map: GameMap } {
  const context: ToolContext = { project: createEmptyToolProject("에이전트 벤치 마을") };
  const result = runTool(context, "build_village", {
    seed: args.seed,
    width: args.width,
    height: args.height,
    houses: args.houses,
    pathStyle: args.pathStyle,
    decor: args.decor ?? true,
    fences: args.fences ?? true,
    edgeTrees: args.edgeTrees ?? "conifer",
    ...(args.theme ? { theme: args.theme } : {}),
    ...(args.kitMix ? { kitMix: args.kitMix } : {}),
    ...(args.plazaLayout ? { plazaLayout: args.plazaLayout } : {}),
    ...(args.skipTerrain ? { skipTerrain: true } : {}),
    ...(args.roadWidth ? { roadWidth: args.roadWidth } : {}),
    ...(args.templates && args.templates.length > 0
      ? {
          housePlans: Array.from({ length: args.houses }, (_unused, index) => ({
            templateId: args.templates![index % args.templates!.length],
          })),
        }
      : {}),
    interior: false,
    doorEvent: false,
  });
  if (!result.ok) throw new Error(`build_village 실패: ${result.summary}`);
  const data = result.data as { mapId: string };
  const map = context.project.maps[data.mapId];
  if (!map) throw new Error(`맵 없음: ${data.mapId}`);
  return { project: context.project, map };
}

export function flatten(map: GameMap): FlatMap {
  return { width: map.width, height: map.height, lower: [...map.lowerTiles], upper: [...map.upperTiles] };
}

// ── 보정 1: 금지 타일 ──────────────────────────────────────────────────────

export function fixBanned(map: GameMap): { swapped: number; cleared: number } {
  let swapped = 0;
  let cleared = 0;
  for (let index = 0; index < map.upperTiles.length; index += 1) {
    if (map.upperTiles[index] === INN_SIGN_BANNED) {
      map.upperTiles[index] = SHOP_SIGN;
      swapped += 1;
      continue;
    }
    if (groundTruth.banned.has(map.upperTiles[index]!)) {
      map.upperTiles[index] = EMPTY;
      cleared += 1;
    }
    if (groundTruth.banned.has(map.lowerTiles[index]!)) {
      map.lowerTiles[index] = TILE.GRASS;
      cleared += 1;
    }
  }
  return { swapped, cleared };
}

// ── 보정 2: 나무 밑동 ──────────────────────────────────────────────────────

/**
 * 나무 두 칸을 다시 쌓는다 — 채점 규칙과 그림을 동시에 만족시키는 유일한 배치.
 *
 * 하네스 기본: 수관(upper) 위 칸 + 밑동(lower) 아래 칸. 그런데 밑동을 **하위**에
 * 놓으면 그 칸 밑에 아무것도 없어서, 밑동 타일의 투명 픽셀(290 은 256 중 129)이
 * 그대로 배경으로 뚫린다 — 렌더에서 나무 밑이 어두운 상자로 나온다(실측).
 *
 * 그래서:
 *   수관 칸  : 하위 = 그 나무의 밑동, 상위 = 수관   (감사의 나무 쌍 규칙 충족)
 *   밑동 칸  : 하위 = 잔디,           상위 = 밑동   (밑동이 잔디 위에 서서 어둡지 않다)
 *
 * 두 규칙 다 지킨다. layoutPlacementValidate 는 아래 칸의 밑동이 상위여도 한 그루로
 * 인정하고(레거시 upper 밑동), 감사는 수관 칸의 하위만 본다. 남는 어두운 픽셀은
 * 수관·밑동이 **둘 다** 투명한 자리뿐이다(침엽 15% · 활엽 19~22%) — 하네스 기본의
 * 밑동 칸 50% 보다 오히려 적다.
 */
export type TreeMode = "pair" | "single" | "none";

export function fixTreeTrunks(
  map: GameMap,
  mode: TreeMode = "pair",
): { filled: number; lifted: number; removed: number; skipped: number; skippedTiles: number[] } {
  const trunks = new Set(TREE_PAIRS.values());
  let filled = 0;
  let lifted = 0;
  let removed = 0;
  if (mode === "none") {
    for (let index = 0; index < map.upperTiles.length; index += 1) {
      if (TREE_PAIRS.has(map.upperTiles[index]!)) {
        map.upperTiles[index] = EMPTY;
        if (map.lowerTiles[index] === EMPTY) map.lowerTiles[index] = TILE.GRASS;
        lifted += 1;
      }
      if (trunks.has(map.lowerTiles[index]!)) map.lowerTiles[index] = TILE.GRASS;
    }
    return { filled: 0, lifted, removed: 0, skipped: 0, skippedTiles: [] };
  }
  const skippedTiles: number[] = [];
  for (let index = 0; index < map.upperTiles.length; index += 1) {
    const trunk = TREE_PAIRS.get(map.upperTiles[index]!);
    if (trunk === undefined) continue;
    const below = map.lowerTiles[index]!;
    // 1) 수관 칸의 하위를 이 나무의 밑동으로. 잔디·빈 칸·다른 나무의 밑동만 덮는다
    //    (숲이 세로로 겹친 칸은 아래 나무의 수관이 덮고 있어 하위 그림이 보이지 않는다).
    if (below !== trunk) {
      if (below === TILE.GRASS || below === EMPTY || trunks.has(below)) {
        map.lowerTiles[index] = trunk;
        filled += 1;
      } else {
        // 잔디가 아닌 칸(집 벽·바닥 등) 위 수관 = 나무가 건물을 파고든 배치다.
        // 밑동을 억지로 밀어 넣지 않고 그 수관을 걷어낸다 — 그림도 감사도 그게 맞다.
        skippedTiles.push(below);
        map.upperTiles[index] = EMPTY;
        removed += 1;
        continue;
      }
    }
    // 2) single 모드: 아래 밑동 칸을 잔디로 되돌려 한 칸 나무로 만든다.
    if (mode === "single") {
      const belowIndex = index + map.width;
      if (belowIndex >= map.lowerTiles.length) continue;
      if (map.lowerTiles[belowIndex] === trunk && map.upperTiles[belowIndex] === EMPTY) {
        map.lowerTiles[belowIndex] = TILE.GRASS;
        lifted += 1;
      }
    }
  }
  return { filled, lifted, removed, skipped: skippedTiles.length, skippedTiles };
}

// ── 보정 3: 도로망 단일화 ──────────────────────────────────────────────────

function roadIndices(map: GameMap): Set<number> {
  const cells = new Set<number>();
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    if (ROAD_FAMILY.has(map.lowerTiles[index]!)) cells.add(index);
  }
  return cells;
}

/** 포석 길을 깔 수 있는 칸 — 잔디 + 상위 비어 있음. 집·울타리·소품을 덮지 않는다. */
function paintable(map: GameMap, index: number): boolean {
  return map.lowerTiles[index] === TILE.GRASS && map.upperTiles[index] === EMPTY;
}

export function unifyRoads(map: GameMap): { linked: number; erased: number; paths: number } {
  const view = { width: map.width, height: map.height };
  let linked = 0;
  let erased = 0;
  let paths = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    const cells = roadIndices(map);
    const components = connectedComponents(view, cells);
    if (components.length <= 1) break;
    const main = new Set(components[0]!);
    const stray = components[1]!;
    // 떨어진 성분에서 본망까지 최단 경로(잔디만 통과).
    const previous = new Map<number, number>();
    const queue: number[] = [...stray];
    const seen = new Set<number>(stray);
    let hit: number | null = null;
    while (queue.length > 0 && hit === null) {
      const current = queue.shift()!;
      const x = current % map.width;
      const y = Math.floor(current / map.width);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const next = ny * map.width + nx;
        if (seen.has(next)) continue;
        if (main.has(next)) {
          previous.set(next, current);
          hit = next;
          break;
        }
        if (!paintable(map, next)) continue;
        seen.add(next);
        previous.set(next, current);
        queue.push(next);
      }
    }
    if (hit === null) {
      for (const index of stray) map.lowerTiles[index] = TILE.GRASS;
      erased += stray.length;
      continue;
    }
    // 경로 되짚어 포석 몸통으로 깐다(본망 칸과 떨어진 성분 칸 자체는 건드리지 않는다).
    const painted: { x: number; y: number }[] = [];
    let cursor = previous.get(hit)!;
    while (!stray.includes(cursor)) {
      map.lowerTiles[cursor] = COBBLE_TILE.BODY;
      painted.push({ x: cursor % map.width, y: Math.floor(cursor / map.width) });
      linked += 1;
      cursor = previous.get(cursor)!;
    }
    paths += 1;
    // 새 포석 + 이어진 노두 전체의 오토타일 변형을 다시 성형한다.
    const touched = [
      ...painted,
      ...stray.map((index) => ({ x: index % map.width, y: Math.floor(index / map.width) })),
      { x: hit % map.width, y: Math.floor(hit / map.width) },
    ];
    shapeAutotileGroupAround(map, DEFAULT_COBBLE_AUTOTILE_GROUP, touched);
  }
  return { linked, erased, paths };
}

// ── 채점·보고 ──────────────────────────────────────────────────────────────

export function scoreOf(map: FlatMap) {
  return scoreAgentMap({ map, groundTruth });
}

function line(label: string, scored: ReturnType<typeof scoreOf>): string {
  const d = scored.detail;
  return (
    `${label.padEnd(30)} q=${scored.quality.toFixed(3)} work=${scored.workMean.toFixed(3)} scale=${scored.scale.toFixed(2)} | ` +
    `집 ${d.houses}/${d.buildings} 문 ${d.doors} 길 ${d.roadCells}(${d.roadComponents}) 울 ${d.fenceCells} 나무 ${d.trees}/${d.brokenTrees} | ` +
    `문길 ${(d.doorsWithRoad as number).toFixed(2)} 도달 ${(d.doorsReachable as number).toFixed(2)} ` +
    `울문법 ${(d.fenceGrammar as number).toFixed(2)} 오토 ${(d.roadAutotileLegality as number).toFixed(2)}(${d.autotileGradedCells}) ` +
    `레이어 ${(d.layerDiscipline as number).toFixed(3)} 밴${d.noBanned} 나무온전 ${(d.treesIntact as number).toFixed(2)}`
  );
}

export function buildFixed(args: BuildArgs): { flat: FlatMap; project: Project; map: GameMap; notes: string } {
  const { project, map } = buildProject(args);
  const banned = fixBanned(map);
  const trees = fixTreeTrunks(map, args.treeMode ?? "pair");
  const roads = unifyRoads(map);
  return {
    flat: flatten(map),
    project,
    map,
    notes:
      `간판교체 ${banned.swapped} 금지제거 ${banned.cleared} 밑동 ${trees.filled}/올림 ${trees.lifted}` +
      `(건물 침범 수관 ${trees.removed} 제거) ` +
      `길연결 ${roads.paths}갈래 ${roads.linked}칸 지움 ${roads.erased}`,
  };
}

function sweep(flags: Record<string, string>): void {
  const width = Number.parseInt(flags.width ?? "64", 10);
  const height = Number.parseInt(flags.height ?? "64", 10);
  const houses = Number.parseInt(flags.houses ?? "14", 10);
  const seeds = (flags.seeds ?? "1,2,3,4,5,6,7,8,9,10").split(",").map((value) => Number.parseInt(value, 10));
  for (const seed of seeds) {
    try {
      const built = buildFixed({
        seed,
        width,
        height,
        houses,
        pathStyle: (flags.pathStyle ?? "dirt") as BuildArgs["pathStyle"],
        skipTerrain: flags.skipTerrain === "true",
        ...(flags.roadWidth ? { roadWidth: Number.parseInt(flags.roadWidth, 10) } : {}),
        ...(flags.templates ? { templates: flags.templates.split(",") } : {}),
      });
      const scored = scoreOf(built.flat);
      console.log(`${line(`s${seed} ${width}x${height} h${houses}`, scored)} | ${built.notes}`);
    } catch (error) {
      console.log(`s${seed} FAIL ${String(error).slice(0, 160)}`);
    }
  }
}

function lintReport(project: Project, map: GameMap): void {
  const issues = validateLayoutPlacement(project, { mapId: map.id });
  const blocking = issues.filter((issue) => issue.severity === "error");
  console.log(`정본 린터: 오류 ${blocking.length} / 전체 ${issues.length}`);
  for (const issue of issues.slice(0, 8)) {
    console.log(`  [${issue.severity}] ${issue.code} ${issue.message.slice(0, 140)}`);
  }
}

async function emit(flags: Record<string, string>): Promise<void> {
  const args: BuildArgs = {
    seed: Number.parseInt(flags.seed ?? "7", 10),
    width: Number.parseInt(flags.width ?? "64", 10),
    height: Number.parseInt(flags.height ?? "64", 10),
    houses: Number.parseInt(flags.houses ?? "14", 10),
    pathStyle: (flags.pathStyle ?? "dirt") as BuildArgs["pathStyle"],
    edgeTrees: (flags.edgeTrees ?? "conifer") as BuildArgs["edgeTrees"],
    decor: flags.decor !== "false",
    fences: flags.fences !== "false",
    skipTerrain: flags.skipTerrain === "true",
    ...(flags.roadWidth ? { roadWidth: Number.parseInt(flags.roadWidth, 10) } : {}),
    ...(flags.templates ? { templates: flags.templates.split(",") } : {}),
    ...(flags.theme ? { theme: flags.theme } : {}),
  };
  const built = buildFixed(args);
  console.log(line("제출", scoreOf(built.flat)));
  console.log(`보정: ${built.notes}`);
  lintReport(built.project, built.map);

  const target = flags.out ?? SUBMISSION_PATH;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const text = JSON.stringify({
    width: built.flat.width,
    height: built.flat.height,
    lowerTiles: built.flat.lower,
    upperTiles: built.flat.upper,
  });
  fs.writeFileSync(target, text, "utf8");
  const parsed = parseSubmission(fs.readFileSync(target, "utf8"));
  console.log(parsed.ok ? `제출 파서 통과 -> ${target} (${text.length} bytes)` : `제출 파서 실패: ${parsed.reason}`);
}

async function render(flags: Record<string, string>): Promise<void> {
  const source = flags.in ?? SUBMISSION_PATH;
  const parsed = parseSubmission(fs.readFileSync(source, "utf8"));
  if (!parsed.ok) throw new Error(`제출물 파싱 실패: ${parsed.reason}`);
  const out = flags.out ?? source.replace(/\.json$/, ".png");
  fs.writeFileSync(out, await renderTileGridPng(parsed.map));
  console.log(`${out} (${parsed.map.width}x${parsed.map.height})`);
}

/** 남은 감점 항목을 칸 단위로 보고한다 — 무엇을 더 고칠 수 있는지 보려고. */
function diagnose(flags: Record<string, string>): void {
  const args: BuildArgs = {
    seed: Number.parseInt(flags.seed ?? "1", 10),
    width: Number.parseInt(flags.width ?? "96", 10),
    height: Number.parseInt(flags.height ?? "96", 10),
    houses: Number.parseInt(flags.houses ?? "24", 10),
    pathStyle: (flags.pathStyle ?? "dirt") as BuildArgs["pathStyle"],
    skipTerrain: flags.skipTerrain === "true",
    ...(flags.roadWidth ? { roadWidth: Number.parseInt(flags.roadWidth, 10) } : {}),
    ...(flags.templates ? { templates: flags.templates.split(",") } : {}),
  };
  const built = buildFixed(args);
  const map = built.flat;
  const scored = scoreOf(map);
  console.log(line(`s${args.seed} ${args.width}x${args.height}`, scored));

  const detection = detectVillage(map);
  for (const building of detection.buildings.filter((candidate) => candidate.doors.length === 0)) {
    const tiles = [...new Set(building.cells.map((index) => map.lower[index] ?? EMPTY))].sort((a, b) => a - b);
    const upperTiles = [...new Set(building.cells.map((index) => map.upper[index] ?? EMPTY))].filter((tile) => tile !== EMPTY);
    console.log(
      `문 없는 건물: ${building.cells.length}칸 bbox=(${building.bbox.x},${building.bbox.y}) ${building.bbox.w}x${building.bbox.h}\n` +
        `  하위 ${tiles.join(",")}\n  상위 ${upperTiles.join(",")}`,
    );
  }

  const wrong = new Map<number, number>();
  for (let index = 0; index < map.upper.length; index += 1) {
    const upper = map.upper[index]!;
    if (upper === EMPTY) continue;
    if (groundTruth.priority[upper] !== "upper") wrong.set(upper, (wrong.get(upper) ?? 0) + 1);
  }
  if (wrong.size > 0) {
    console.log(
      `레이어 위반 타일: ${[...wrong.entries()].map(([tile, count]) => `${tile}×${count}(prio=${groundTruth.priority[tile]})`).join(" ")}`,
    );
  }
}

/** 나무 처리 세 가지를 나란히 굽는다 — 점수는 같아도 그림이 다르다. */
async function renderBuild(flags: Record<string, string>): Promise<void> {
  const base = {
    seed: Number.parseInt(flags.seed ?? "1", 10),
    width: Number.parseInt(flags.width ?? "64", 10),
    height: Number.parseInt(flags.height ?? "64", 10),
    houses: Number.parseInt(flags.houses ?? "14", 10),
    pathStyle: (flags.pathStyle ?? "dirt") as BuildArgs["pathStyle"],
  };
  for (const mode of ["pair", "single", "none"] as const) {
    const built = buildFixed({ ...base, treeMode: mode });
    const scored = scoreOf(built.flat);
    fs.writeFileSync(`output/agent-bench/tree-${mode}.png`, await renderTileGridPng(built.flat));
    console.log(`${line(`나무 ${mode}`, scored)}`);
  }
}

function parseFlags(argv: readonly string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[token.slice(2)] = "true";
    else {
      flags[token.slice(2)] = next;
      i += 1;
    }
  }
  return flags;
}

const [command = "sweep", ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
if (command === "sweep") sweep(flags);
else if (command === "emit") await emit(flags);
else if (command === "render") await render(flags);
else if (command === "diagnose") diagnose(flags);
else if (command === "render-build") await renderBuild(flags);
else console.error("사용법: sweep | emit | render [--seed n --width n --height n --houses n --pathStyle dirt|sand]");
