// 팩 프리셋 타일셋으로 소도시 한 장의 뼈대를 한 번에 까는 도구(build_pack_town)와, 손으로 깐 도시 맵이
// 부자연스러운지 숫자로 보는 도구(check_town_map).
//
// 조수가 칸마다 좌표를 고르면 같은 간격의 네모 건물이 빈 보도 바다에 떴다(2026-09-25 Rasak 마을 시험, 65툴콜).
// LLM 은 땅 쓰임만 정하고 배치는 절차가 한다(CityCraft 2024·CityGenAgent 2026) — 본체는 townLayout.ts.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";
import type { MvTownRecipe } from "@/project/rpgmakerMv/packPreset";
import { layOutPackTown } from "@/project/rpgmakerMv/townLayout";
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

export interface TownMapCheck {
  /** 같은 바닥 재료가 물체 없이 이어진 가장 큰 덩어리(차도 제외). */
  readonly largestPlain: { readonly material: string; readonly cells: number; readonly box: { x: number; y: number; w: number; h: number } } | null;
  /** 맵 네 변에서 안쪽으로, 같은 재료만 있고 물체가 없는 줄이 몇 줄 이어지나. */
  readonly emptyEdges: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
  /** 바닥 재료 비율(%) 상위 5개. */
  readonly materialShare: readonly { readonly material: string; readonly percent: number }[];
  readonly issues: readonly string[];
}

/** 연구 정리(openwiki 「마을 짜임」)의 자기 점검 중 칸 배열로 셀 수 있는 것. */
export function checkTownMap(project: Project, map: GameMap): TownMapCheck {
  const tileset = project.tilesets[map.tilesetId];
  const W = map.width;
  const H = map.height;
  const label = (i: number): string => tileset?.tileMeta?.[map.lowerTiles[i] ?? -1]?.label ?? "";
  const tagsOf = (i: number): readonly string[] => tileset?.tileMeta?.[map.lowerTiles[i] ?? -1]?.tags ?? [];
  const plain = (i: number): boolean => (map.upperTiles[i] ?? -1) < 0 && tagsOf(i).includes("ground");
  const seen = new Uint8Array(W * H);
  let largest: TownMapCheck["largestPlain"] = null;
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
    if (!largest || cells > largest.cells) largest = { material: name, cells, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  }
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
  const issues: string[] = [];
  if (largest && largest.cells > 36) {
    issues.push(`「${largest.material}」 ${largest.cells}칸이 물체 없이 이어진다(${largest.box.x},${largest.box.y} ${largest.box.w}×${largest.box.h}) — 36칸(6×6)을 넘는 빈 바닥은 나무·화단·벤치·재료 바꿈으로 끊는다.`);
  }
  for (const [side, n] of Object.entries(emptyEdges)) {
    if (n >= 2) issues.push(`맵 ${side === "top" ? "위" : side === "bottom" ? "아래" : side === "left" ? "왼" : "오른"}쪽 끝 ${n}줄이 같은 재료뿐이다 — 길을 맵 밖으로 잇거나 뒷마당 울타리·나무·건물 뒷면으로 채운다.`);
  }
  const sidewalk = materialShare.find((m) => m.material.includes("보도"));
  if (sidewalk && sidewalk.percent > 25) issues.push(`보도가 맵의 ${sidewalk.percent}% — 25%를 넘으면 건물이 보도 바다에 떠 보인다. 마당·주차장·골목으로 나눈다.`);
  return { largestPlain: largest, emptyEdges, materialShare, issues };
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
      ...(check.issues.length ? { warnings: check.issues } : {}),
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
    "도시 맵이 부자연스러운지 숫자로 본다 — 물체 없이 36칸(6×6)을 넘게 이어진 같은 바닥, 맵 끝의 빈 띠(2줄 이상), 보도 비율(25% 초과). "
    + "손으로 깔거나 고친 뒤 issues 가 빌 때까지 고친다.",
  mode: "read",
  parameters: { type: "object", properties: { mapId: { type: "string" } }, required: ["mapId"] },
  invalidArgsExample: { mapId: "town" },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const check = checkTownMap(draft, map);
    return {
      summary: check.issues.length ? `${map.name}: 고칠 곳 ${check.issues.length}개` : `${map.name}: 빈 바닥·빈 띠·보도 비율 모두 기준 안`,
      ...(check.issues.length ? { warnings: check.issues } : {}),
      data: check,
    };
  },
};

export const PACK_TOWN_TOOLS: readonly ToolDefinition[] = [buildPackTown, checkTownMapTool];
