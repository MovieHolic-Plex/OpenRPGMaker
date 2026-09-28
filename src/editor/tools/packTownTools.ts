// 팩 프리셋 타일셋으로 소도시 한 장의 뼈대를 한 번에 까는 도구(build_pack_town)와, 손으로 깐 도시 맵이
// 부자연스러운지 숫자로 보는 도구(check_town_map).
//
// 조수가 칸마다 좌표를 고르면 같은 간격의 네모 건물이 빈 보도 바다에 떴다(2026-09-25 Rasak 마을 시험, 65툴콜).
// LLM 은 땅 쓰임만 정하고 배치는 절차가 한다(CityCraft 2024·CityGenAgent 2026) — 본체는 townLayout.ts.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";
import type { MvTownRecipe } from "@/project/rpgmakerMv/packPreset";
import { layOutPackTown } from "@/project/rpgmakerMv/townLayout";
import { lintPackMap } from "@/project/rpgmakerMv/packMapLint";
import { paintPackLayoutTool } from "./packLayoutTool";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { requireMap } from "./mapHelpers";

function townRecipe(project: Project, map: GameMap): { tileset: TilesetDef; recipe: MvTownRecipe } {
  const tileset = project.tilesets[map.tilesetId];
  const presetId = tileset?.mvPack?.presetId;
  const recipe = MV_PACK_PRESETS.find((preset) => preset.id === presetId)?.town;
  if (!tileset || !recipe) {
    throw new ToolError(
      `${map.name} 의 타일셋(${tileset?.name ?? map.tilesetId})에는 마을 짜임 재료가 없습니다 — 팩 프리셋(예: Rasak Modern 도시)으로 만든 타일셋 맵에서만 됩니다.`,
      { code: "no-town-recipe", mapId: map.id },
    );
  }
  return { tileset, recipe };
}

/** 규칙이 확실해서 권고가 아니라 거부하는 위반 — 좌표가 붙는다. 경고로는 모델이 고치지 않았다(2026-09-25 재시험). */
export interface TownViolation {
  readonly code: "door-off-ground" | "door-blocked" | "awning-off-ground" | "building-no-door" | "facade-on-road" | "parking-in-front" | "prop-on-roof" | "prop-on-road" | "facade-too-wide";
  readonly x: number;
  readonly y: number;
  readonly message: string;
}

type Box = { x: number; y: number; w: number; h: number };

export interface TownMapCheck {
  /** 같은 바닥 재료가 물체 없이 이어진 가장 큰 덩어리(차도 제외, 뒷골목 포함). */
  readonly largestPlain: { readonly material: string; readonly cells: number; readonly box: Box } | null;
  /** 36칸을 넘는 빈 바닥 덩어리 전부(큰 순, 최대 5개). */
  readonly plainAreas: readonly { readonly material: string; readonly cells: number; readonly box: Box }[];
  /** 차도(뒷골목 제외) 비율 %. */
  readonly roadPercent: number;
  /** 거부 규칙 위반. 하나라도 있으면 check_town_map 은 실패로 돌려준다. */
  readonly violations: readonly TownViolation[];
  /** 맵 네 변에서 안쪽으로, 같은 재료만 있고 물체가 없는 줄이 몇 줄 이어지나. */
  readonly emptyEdges: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
  /** 바닥 재료 비율(%) 상위 5개. */
  readonly materialShare: readonly { readonly material: string; readonly percent: number }[];
  readonly issues: readonly string[];
}

const OBJECT_KINDS = new Set(["decal", "prop", "tall", "wallmount", "door", "overhead"]);
/** 가게 앞(파사드 바로 아래)에 붙은 주차·빈 아스팔트가 이 칸 수를 넘으면 「가게와 길 사이 주차장」이다. 짐 부리는 자리 2×3 까지는 둔다. */
const FRONT_PARKING_MAX = 6;
/** 한 건물 파사드 폭 상한 — 미국 소도시 가게 4~6칸, 은행·호텔 같은 큰 건물도 7~10칸(연구 정리 B-10). */
const FACADE_MAX_WIDTH = 10;

/** 연구 정리(openwiki 「마을 짜임」)의 자기 점검 중 칸 배열로 셀 수 있는 것. */
export function checkTownMap(project: Project, map: GameMap): TownMapCheck {
  const tileset = project.tilesets[map.tilesetId];
  const recipe = MV_PACK_PRESETS.find((preset) => preset.id === tileset?.mvPack?.presetId)?.town;
  const W = map.width;
  const H = map.height;
  const metaAt = (i: number) => tileset?.tileMeta?.[map.lowerTiles[i] ?? -1];
  const label = (i: number): string => metaAt(i)?.label ?? "";
  const tagsOf = (i: number): readonly string[] => metaAt(i)?.tags ?? [];
  const alleyName = recipe?.alley ?? "짙은 아스팔트";
  // 뒷골목·뒷마당은 차도 태그지만 걷는 빈 바닥이다 — 빼면 가게 뒤 빈 아스팔트 수백 칸을 못 본다(render 레인 B-10).
  const plain = (i: number): boolean => (map.upperTiles[i] ?? -1) < 0 && (tagsOf(i).includes("ground") || label(i) === alleyName);
  const seen = new Uint8Array(W * H);
  let largest: TownMapCheck["largestPlain"] = null;
  const plainAreas: { material: string; cells: number; box: Box }[] = [];
  for (let start = 0; start < W * H; start += 1) {
    if (seen[start] || !plain(start)) continue;
    const name = label(start);
    const stack = [start];
    seen[start] = 1;
    let cells = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (stack.length) {
      const i = stack.pop()!;
      cells += 1;
      const x = i % W, y = Math.floor(i / W);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!seen[j] && plain(j) && label(j) === name) { seen[j] = 1; stack.push(j); }
      }
    }
    const area = { material: name, cells, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
    if (!largest || cells > largest.cells) largest = area;
    if (cells > 36) plainAreas.push(area);
  }
  plainAreas.sort((a, b) => b.cells - a.cells);
  plainAreas.splice(5);
  const lineEmpty = (cells: number[]): boolean => cells.every((i) => (map.upperTiles[i] ?? -1) < 0) && new Set(cells.map(label)).size === 1;
  const run = (line: (k: number) => number[], count: number): number => {
    let n = 0;
    while (n < count && lineEmpty(line(n))) n += 1;
    return n;
  };
  const row = (y: number) => Array.from({ length: W }, (_, x) => y * W + x);
  const col = (x: number) => Array.from({ length: H }, (_, y) => y * W + x);
  const emptyEdges = {
    top: run((k) => row(k), H), bottom: run((k) => row(H - 1 - k), H),
    left: run((k) => col(k), W), right: run((k) => col(W - 1 - k), W),
  };
  const counts = new Map<string, number>();
  for (let i = 0; i < W * H; i += 1) counts.set(label(i) || "(빈 칸)", (counts.get(label(i) || "(빈 칸)") ?? 0) + 1);
  const materialShare = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([material, n]) => ({ material, percent: Math.round((n / (W * H)) * 100) }));
  const carriageway = (i: number): boolean => tagsOf(i).includes("road") && label(i) !== alleyName;
  let roadCells = 0;
  for (let i = 0; i < W * H; i += 1) if (carriageway(i)) roadCells += 1;
  const roadPercent = Math.round((roadCells / (W * H)) * 100);
  const violations = tileset ? townViolations(tileset, map, recipe, carriageway) : [];
  const issues: string[] = violations.map((v) => `[거부] ${v.message}`);
  for (const area of plainAreas) {
    issues.push(`「${area.material}」 ${area.cells}칸이 물체 없이 이어진다(${area.box.x},${area.box.y} ${area.box.w}×${area.box.h}) — 36칸(6×6)을 넘는 빈 바닥은 나무·화단·벤치·주차 칸 선·재료 바꿈으로 끊는다.`);
  }
  if (roadPercent > 40) issues.push(`차도가 맵의 ${roadPercent}% — 20~30% 가 소도시다. 골목길을 5칸으로 줄이거나 차도 대신 블록을 둔다.`);
  for (const [side, n] of Object.entries(emptyEdges)) {
    if (n >= 2) issues.push(`맵 ${side === "top" ? "위" : side === "bottom" ? "아래" : side === "left" ? "왼" : "오른"}쪽 끝 ${n}줄이 같은 재료뿐이다 — 길을 맵 밖으로 잇거나 뒷마당 울타리·나무·건물 뒷면으로 채운다.`);
  }
  const sidewalk = materialShare.find((m) => m.material.includes("보도"));
  if (sidewalk && sidewalk.percent > 25) issues.push(`보도가 맵의 ${sidewalk.percent}% — 25%를 넘으면 건물이 보도 바다에 떠 보인다. 마당·주차장·골목으로 나눈다.`);
  return { largestPlain: largest, plainAreas, roadPercent, violations, emptyEdges, materialShare, issues };
}

/**
 * 칸 배열에서 확실히 틀린 건물·거리 문법을 좌표와 함께 찾는다. 이 팩은 파사드가 남쪽(아래)을 본다 —
 * 위에서 아래로 옥상 → 창 난 층 → 1층 띠, 문은 1층 띠 맨 아랫줄, 그 아래가 보도.
 */
function townViolations(tileset: TilesetDef, map: GameMap, recipe: MvTownRecipe | undefined, carriageway: (i: number) => boolean): TownViolation[] {
  const W = map.width;
  const H = map.height;
  const out: TownViolation[] = [];
  const add = (code: TownViolation["code"], x: number, y: number, message: string) => {
    if (out.length < 40) out.push({ code, x, y, message });
  };
  const role = (i: number) => tileset.tileMeta?.[map.lowerTiles[i] ?? -1]?.role;
  const building = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && (role(y * W + x) === "wall" || role(y * W + x) === "roof");
  const wall = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && role(y * W + x) === "wall";
  /** 1층 띠 맨 아랫줄 = 외벽이고 바로 아래가 건물이 아닌 칸. */
  const facadeBottom = (x: number, y: number): boolean => wall(x, y) && y + 1 < H && !building(x, y + 1);
  const label = (i: number) => tileset.tileMeta?.[map.lowerTiles[i] ?? -1]?.label ?? "";

  // 위층 타일 → 팩 물체(몇째 줄인지와 종류).
  const kitCell = new Map<number, { id: string; kind: string; row: number; last: number; onRoad: boolean }>();
  for (const kit of tileset.structureKits ?? []) {
    if (kit.learnedFrom !== "pack-preset") continue;
    const kind = kit.ai?.tags?.find((tag) => OBJECT_KINDS.has(tag)) ?? "prop";
    const onRoad = kit.ai?.tags?.includes("on-road") === true;
    kit.rows.forEach((row, r) => row.upperTiles?.forEach((tile) => {
      if (tile >= 0 && !kitCell.has(tile)) kitCell.set(tile, { id: kit.id, kind, row: r, last: kit.rows.length - 1, onRoad });
    }));
  }
  const doorAt = new Set<number>();
  const reported = new Set<string>();
  for (let i = 0; i < W * H; i += 1) {
    const cell = kitCell.get(map.upperTiles[i] ?? -1);
    if (!cell) continue;
    const x = i % W, y = Math.floor(i / W);
    const once = (key: string) => (reported.has(key) ? false : (reported.add(key), true));
    if (cell.kind === "door" && cell.row === cell.last) {
      doorAt.add(i);
      if (!facadeBottom(x, y)) {
        add("door-off-ground", x, y, `문 ${cell.id} 의 밑칸 (${x},${y}) 이 1층 외벽 맨 아랫줄이 아니다${wall(x, y + 1) ? " — 아래에 외벽이 더 있다(문이 윗층에 떠 있다)" : wall(x, y) ? "" : " — 밑이 외벽이 아니다"}. 문은 건물 맨 아래 외벽 줄, 바로 아래가 보도인 칸에 base 로 찍는다.`);
      } else {
        const front = (y + 1) * W + x;
        const blocker = kitCell.get(map.upperTiles[front] ?? -1);
        if (blocker && (blocker.kind === "prop" || blocker.kind === "tall") && blocker.row === blocker.last) {
          add("door-blocked", x, y + 1, `문 (${x},${y}) 바로 앞 (${x},${y + 1}) 을 ${blocker.id} 가 막는다 — 문 앞 한 칸은 비운다.`);
        }
      }
    }
    if (cell.kind === "overhead" && cell.row === cell.last && once(`aw${y}:${x - 1}`) && once(`aw${y}:${x}`)) {
      reported.add(`aw${y}:${x + 1}`); reported.add(`aw${y}:${x + 2}`);
      if (!facadeBottom(x, y)) {
        add("awning-off-ground", x, y, `차양 ${cell.id} 의 그늘 줄 (${x},${y}) 이 1층 외벽 맨 아랫줄이 아니다${wall(x, y + 1) ? " — 윗층에 달렸다" : " — 벽 밖에 걸렸다"}. 차양은 1층 문 바로 위, 그늘 줄이 문 아랫칸과 같은 줄이 되게 base 로 찍는다.`);
      }
    }
    if ((cell.kind === "prop" || cell.kind === "tall" || cell.kind === "decal") && cell.row === cell.last) {
      if (building(x, y)) {
        add("prop-on-roof", x, y, `${cell.id} 의 밑칸 (${x},${y}) 이 옥상·외벽(${label(i)}) 위다 — 가로등·표지판·나무·바닥 표시는 보도·잔디에 세운다(옥상 물체는 위성 안테나 같은 wallmount 만).`);
      } else if (cell.kind !== "decal" && !cell.onRoad && carriageway(i)) {
        add("prop-on-road", x, y, `${cell.id} 의 밑칸 (${x},${y}) 이 차도(${label(i)}) 위다 — 차도 옆 보도 바깥 줄(연석 쪽)에 세운다(교통 콘만 차도 위).`);
      }
    }
  }

  // 건물마다: 1층 맨 아랫줄을 가로로 잇고, 열마다 건물 꼭대기(높이·옥상 재료)가 바뀌는 곳에서 자른다.
  const topOf = (x: number, y: number): number => { let t = y; while (t - 1 >= 0 && building(x, t - 1)) t -= 1; return t; };
  const alleyName = recipe?.alley ?? "짙은 아스팔트";
  const parkingName = recipe?.parkingLine ?? "흰 주차선";
  const parkingLike = (i: number): boolean => {
    const up = tileset.tileMeta?.[map.upperTiles[i] ?? -1]?.label;
    return up === parkingName || ((map.upperTiles[i] ?? -1) < 0 && (label(i) === alleyName || label(i) === "아스팔트 평면"));
  };
  const parkingSeen = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    let x = 0;
    while (x < W) {
      if (!facadeBottom(x, y)) { x += 1; continue; }
      const x0 = x;
      const key = (cx: number) => { const t = topOf(cx, y); return `${t}|${label(t * W + cx)}`; };
      const k = key(x);
      while (x < W && facadeBottom(x, y) && key(x) === k) x += 1;
      const w = x - x0;
      const top = topOf(x0, y);
      const h = y - top + 1;
      const box = `(${x0},${top} ${w}×${h})`;
      const doors = [...Array(w).keys()].filter((dx) => doorAt.has(y * W + x0 + dx)).length;
      const onRoad = [...Array(w).keys()].find((dx) => carriageway((y + 1) * W + x0 + dx));
      if (w >= 2 && h >= 2 && doors === 0) {
        add("building-no-door", x0, y, `건물 ${box} 1층 맨 아랫줄(y ${y})에 문이 없다 — 보도 쪽 1층 벽에 문(가게는 glass_door_*, 집은 houseDoor)을 base:{x,y:${y}} 로 찍는다.`);
      }
      if (onRoad !== undefined) {
        add("facade-on-road", x0 + onRoad, y + 1, `건물 ${box} 바로 앞 (${x0 + onRoad},${y + 1}) 이 차도다 — 파사드와 차도 사이에 보도 2~3칸(주택은 앞마당)을 둔다.`);
      }
      if (w > FACADE_MAX_WIDTH && top < y) {
        add("facade-too-wide", x0, top, `건물 ${box} 이 폭 ${w}칸 한 덩어리(같은 옥상·같은 높이)다 — ${FACADE_MAX_WIDTH}칸 이하로 나누고 이웃과 재료·층수를 다르게 한다(가게 4~6칸).`);
      }
      // 파사드 바로 아래에서 시작하는 주차·빈 아스팔트 덩어리 — 가게와 길 사이 주차장.
      for (let dx = 0; dx < w && y + 1 < H; dx += 1) {
        const start = (y + 1) * W + x0 + dx;
        if (parkingSeen[start] || !parkingLike(start)) continue;
        const stack = [start];
        parkingSeen[start] = 1;
        let cells = 0, bx0 = W, by0 = H, bx1 = 0, by1 = 0;
        while (stack.length) {
          const i = stack.pop()!;
          cells += 1;
          const cx = i % W, cy = Math.floor(i / W);
          bx0 = Math.min(bx0, cx); by0 = Math.min(by0, cy); bx1 = Math.max(bx1, cx); by1 = Math.max(by1, cy);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + ox, ny = cy + oy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (!parkingSeen[j] && parkingLike(j)) { parkingSeen[j] = 1; stack.push(j); }
          }
        }
        if (cells > FRONT_PARKING_MAX) {
          add("parking-in-front", bx0, by0, `건물 ${box} 앞 (${bx0},${by0} ${bx1 - bx0 + 1}×${by1 - by0 + 1}) 에 주차장·빈 아스팔트 ${cells}칸 — 주차는 가게 뒤(뒷골목 쪽)에 둔다. 가게 앞은 보도(가로등·가로수·벤치)로 바꾼다.`);
        }
      }
    }
  }
  return out;
}

/** 거부 규칙 위반을 한 오류로 — 좌표 목록을 그대로 싣는다. */
export function townViolationError(map: GameMap, check: TownMapCheck): ToolError | null {
  if (!check.violations.length) return null;
  const first = check.violations[0]!;
  const rest = check.issues.filter((line) => !line.startsWith("[거부]"));
  return new ToolError(
    `${map.name}: 도시 문법 위반 ${check.violations.length}곳 — 고치기 전에는 완료가 아니다(권고가 아니라 거부).\n`
      + check.violations.map((v) => `- ${v.code} ${v.message}`).join("\n")
      + (rest.length ? `\n권고: ${rest.join(" / ")}` : ""),
    { code: "town-grammar", mapId: map.id, x: first.x, y: first.y },
  );
}

const buildPackTown: ToolDefinition = {
  name: "build_pack_town",
  description:
    "팩 프리셋 도시 타일셋(예: Rasak Modern 도시) 맵에 소도시 뼈대를 한 번에 깐다 — 뒷골목·뒷주차, 벽을 맞댄 가게 줄(폭·층·재료가 이웃과 다르고 문·차양·쇼윈도가 1층에만), "
    + "큰길(중앙선·화살표)과 세로 골목길(교차로 횡단보도·T 교차로), 연석-잔디 띠-보도, 앞마당·진입로·현관길·뒷마당 울타리가 있는 주택, 분수 공원, 가로등·가로수·소화전·쓰레기통·자판기. "
    + "맵 전체를 새로 깐다 — 이미 칠한 맵은 replace:true 일 때만. 맵은 40×30 이상(50×40 권장, 80×60 이면 주택가 두 줄). "
    + "결과의 lots(가게·주택 문 칸)에 이동 이벤트·NPC 를 놓고, 간판·노점·자판기 같은 개성은 stamp_tileset_object 로 더한다. 마음에 안 들면 seed 를 바꿔 다시.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      seed: { type: "integer", description: "선택. 같은 seed 면 같은 마을. 생략하면 무작위" },
      crossStreets: { type: "integer", minimum: 0, maximum: 2, description: "선택. 세로 골목길 수(기본: 폭 70 이상 2, 아니면 1). 둘째 길은 큰길에서 T 로 갈라진다" },
      park: { type: "boolean", description: "선택. 분수 공원(기본 true)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 통째로 새로 깔 때만 true" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: { mapId: "town", seed: 7 },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const { tileset, recipe } = townRecipe(draft, map);
    if (map.width < 40 || map.height < 30) {
      throw new ToolError(`${map.name} 는 ${map.width}×${map.height} — 마을 짜임은 40×30 이상 맵에서만 됩니다(50×40 권장). resize 하거나 새 맵을 만드세요.`, { code: "map-too-small", mapId: map.id });
    }
    const painted = map.upperTiles.some((t) => t >= 0) || new Set(map.lowerTiles.filter((t) => t >= 0)).size > 2;
    if (painted && args.replace !== true) {
      throw new ToolError(`${map.name} 에 이미 칠한 내용이 있습니다 — 통째로 새로 깔려면 replace:true(기존 타일은 사라진다), 아니면 빈 새 맵에서.`, { code: "map-not-empty", mapId: map.id });
    }
    map.lowerTiles = new Array(map.width * map.height).fill(-1);
    map.upperTiles = new Array(map.width * map.height).fill(-1);
    const seed = Number.isInteger(args.seed) ? (args.seed as number) : undefined;
    const crossStreets = Number.isInteger(args.crossStreets) ? (args.crossStreets as number) : undefined;
    const result = layOutPackTown(tileset, recipe, map, {
      ...(seed !== undefined ? { seed } : {}),
      ...(crossStreets !== undefined ? { crossStreets } : {}),
      ...(args.park === false ? { park: false } : {}),
    });
    const count = (kind: string) => result.lots.filter((lot) => lot.kind === kind).length;
    const check = checkTownMap(draft, map);
    return {
      summary: `${map.name}에 마을 뼈대를 깔았음(seed ${result.seed}) — 가게 ${count("shop")}·사무실 ${count("office")}·주택 ${count("house")}·공원 ${count("park")}, 길 ${result.roads.length}개`,
      ...(check.issues.length ? { warnings: [...check.issues] } : {}),
      data: {
        seed: result.seed,
        lots: result.lots.map((lot) => ({ ...lot })),
        roads: result.roads,
        check,
        next: "문 칸(lots[].door)에 이동 이벤트·NPC, 가게마다 간판·노점·화분으로 개성, show_map_region 으로 그림 확인.",
      },
    };
  },
};

const checkTownMapTool: ToolDefinition = {
  name: "check_town_map",
  description:
    "도시 맵이 부자연스러운지 숫자로 본다 — 물체 없이 36칸(6×6)을 넘게 이어진 같은 바닥(뒷골목 아스팔트 포함), 맵 끝의 빈 띠(2줄 이상), 보도 비율(25% 초과), 차도 비율(40% 초과). "
    + "건물·거리 문법 위반은 좌표와 함께 실패로 돌려준다: 1층 외벽 맨 아랫줄이 아닌 문·차양, 문 앞을 막은 물체, 문 없는 건물, 차도에 바로 붙은 파사드, "
    + "가게 앞 주차장(6칸 초과), 옥상·외벽 위의 가로등·나무·바닥 표시, 차도 위 가로등·표지판, 10칸 넘는 한 덩어리 파사드. "
    + "손으로 깔거나 고친 뒤 실패가 사라지고 issues 가 빌 때까지 고친다.",
  mode: "read",
  parameters: { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"] },
  invalidArgsExample: { mapId: "town" },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const check = checkTownMap(draft, map);
    // 경고만 받은 모델은 고치지 않았다 — 확실한 문법 위반은 실패로 돌려 좌표를 들이민다.
    const refusal = townViolationError(map, check);
    if (refusal) throw refusal;

    return {
      summary: check.issues.length ? `${map.name}: 고칠 곳 ${check.issues.length}개` : `${map.name}: 빈 바닥·빈 띠·보도 비율 모두 기준 안`,
      ...(check.issues.length ? { warnings: [...check.issues] } : {}),
      data: check,
    };
  },
};

// 세트 맵을 사람이 검수하며 모은 규칙(구조·통행·빈 공간)을 조수도 쓰게 한다 — 게시 스크립트와 같은 함수(packMapLint.ts).
// 2026-09-28 REFMAP 헤드리스 시험: 이 검사 없이 조수가 깐 실내 넷 중 넷이 입구 없음·ㅁ자 방·벽에서 뜬 침대·5×5 빈 바닥이었다.
const checkPackMapTool: ToolDefinition = {
  name: "check_pack_map",
  description:
    "팩 프리셋 타일셋(REFMAP 세트 등) 맵을 세트 게시 기준으로 검사한다. "
    + "구조: 천장·지붕 밑에 벽면이 있나, 벽면이 2줄 이상인가. "
    + "통행(엔진 규칙 그대로): 맵 가장자리 입구에서 모든 바닥·가구에 닿나, 침대 긴 옆면이 비었나, 키 큰 가구 몸통을 뚫고 지나야 하는 곳, 물·벽 위를 걷게 된 칸. "
    + "벽걸이: 창·액자·선반·시계·침대 머리가 벽에 붙었나. 겹침: 큰 물체끼리. 모양: 네모 물. "
    + "공간: 가구 없는 빈 바닥 직사각형(두 변 3 이상)이 한도(집 실내 12·동굴 20·야외 48칸)를 넘나 — 넘으면 물체로 메우지 말고 방·맵을 줄인다. "
    + "경고마다 좌표가 붙는다. 다 깔거나 고친 뒤 warnings 가 빌 때까지 고치고 다시 부른다(세트의 완성 장소 38곳은 모두 경고 0).",
  mode: "read",
  parameters: { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"] },
  invalidArgsExample: { mapId: "fisher_house" },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const result = lintPackMap(draft, map);
    if (!result) {
      throw new ToolError(`${map.name} 의 타일셋(${map.tilesetId})은 재료·물체 이름이 있는 팩 프리셋이 아니다 — check_pack_map 은 팩 프리셋 맵에서만 된다.`, { code: "not-pack-map", mapId: map.id });
    }
    return {
      summary: result.warnings.length ? `${map.name}: 고칠 곳 ${result.warnings.length}가지` : `${map.name}: 구조·통행·벽걸이·겹침·빈 공간 모두 통과(물체 ${result.objects}개)`,
      ...(result.warnings.length ? { warnings: [...result.warnings] } : {}),
      data: result,
    };
  },
};

export const PACK_TOWN_TOOLS: readonly ToolDefinition[] = [buildPackTown, checkTownMapTool, checkPackMapTool, paintPackLayoutTool];
