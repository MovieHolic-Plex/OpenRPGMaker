// build_scene_setting — 이벤트·컷씬·함정 요청이 말한 «무대»(화산·용암 다리·독늪·유적·성소)를 버들항(beodeul_city)의
// 기존 키트로 한 번에 짓는다. 새 그림을 그리지 않는다: 용암 강·바위 다리·흑요석 제단(화산 동굴 팩), 늪 물·맹그로브,
// 신전 폐허 기둥·모자이크·소신전 키트를 이벤트 좌표 둘레에 배치한다.
//
// 2026-10-15 JRPG 파일럿 실측: 조수는 이벤트 도구만 쓰고 지형을 짓지 않았다. 도구를 보이게 해도(42회 stamp_object) 어떤 키트가
// 무엇이 되는지 몰라 구석에 소품만 얹었다. 이 도구가 «장면 낱말 → 키트 조합» 을 코드로 고정한다.

import type { GameMap, Project } from "@/project/types";
import { installBeodeulArchitecture } from "@/project/defaults/beodeulArchitecture";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS, prepareSharedObject } from "./sharedObjectTools";
import { setLayerTileAt, layerTileAt } from "@/project/mapLayers";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { translateTiles } from "@/project/objectStamp";
import { canMove } from "@/project/collision";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { SCENE_STAGE_TAG } from "./sceneStageGuard";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const BUILD_SCENE_SETTING_TOOL = "build_scene_setting";

export const SCENE_THEMES = ["lava_bridge", "volcano", "poison_swamp", "ruins_shrine"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

const KIT = "kit:beodeul_city/";
const VOLCANO = "bd-pick-volcano-cave-";
const RUINS = "bd-pick-temple-ruins-";
const SWAMP = "bd-pick-swamp-stilt-";

/**
 * 무대 기물 한 점(또는 대칭 한 쌍). dx,dy 는 이벤트 칸 기준 왼쪽 위 칸.
 * mirror 가 있으면 거울 짝을 함께 찍는다 — axis "x" 는 세로줄 x+at 기준 좌우, "y" 는 가로줄 y+at 기준 위아래.
 * 짝 한쪽이 맵 밖·몸체 위·동선 위라 못 들어가면 두 쪽을 함께 빼거나 함께 민다(대칭이 깨진 한 짝은 남기지 않는다).
 */
interface Piece {
  readonly id: string;
  readonly dx: number;
  readonly dy: number;
  readonly mirror?: { readonly axis: "x" | "y"; readonly at: number };
}

interface Layout {
  readonly ground: { readonly material: string; readonly rx: number; readonly ry: number };
  /** 바닥 위에 먼저 깔 칠하기(물 등). 이벤트 칸과 시작 칸을 침범하지 않게 좌표를 고른다. */
  readonly fills: readonly { readonly material: string; readonly dx: number; readonly dy: number; readonly w: number; readonly h: number }[];
  /** 위에서 아래 순서로 찍는다 — 뒤에 찍은 것이 앞의 것을 덮는다. */
  readonly pieces: readonly Piece[];
  /** 비워 두는 동선(다리·둑길·참배로) — 바닥 그림(모자이크·다리) 말고는 기물을 얹지 않고, 조수의 덧찍기도 막는다. */
  readonly corridors?: readonly { readonly dx: number; readonly dy: number; readonly w: number; readonly h: number }[];
  /** 칸 단위로 칠하는 불규칙 몸체(용암·물). 2×2 스탬프 격자로는 직각 윤곽만 나온다. */
  readonly bodies?: readonly Body[];
  /** 바닥 전체에 이어 까는 바닥 표본 키트(하단 층). 오토타일 판석 한 장은 «벽돌 광장» 으로 읽혔다(2026-10-17 jrpg_003 심판). */
  readonly floorKit?: string;
  /** 바닥 위에 덧까는 표본 구역(둑길·다리 머리 테라스) — 칸마다 키트 무늬를 되풀이한다. */
  readonly pads?: readonly { readonly kit: string; readonly dx: number; readonly dy: number; readonly w: number; readonly h: number }[];
  /** 이벤트 칸을 가로지르는 가는 용암 균열(2칸 폭). dy 줄을 따라 dx0..dx1, 3칸마다 한 줄씩 굽는다. */
  readonly fissures?: readonly { readonly dy: number; readonly dx0: number; readonly dx1: number; readonly seed: number }[];
  /**
   * 생존(무사 통과) 분기가 걸어갈 길 — 이벤트 칸에서 dir 로 steps 칸. 무대는 이 칸을 막지 않고, 결과 data.survivalWalk 로
   * moveActor 이동 목록을 돌려준다. 생존 분기가 제자리에 서 있기만 하면 «무사 통과» 가 안 보인다(2026-10-17 jrpg_003 심판 45점).
   */
  readonly walk?: { readonly dir: "up" | "down" | "right"; readonly steps: number };
}

interface Body {
  readonly kind: "lava" | "water";
  /** 이벤트 칸 기준 중심·반지름. 윤곽은 칸마다 해시 잡음으로 흔든다. */
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly seed: number;
  /** 이 dx 보다 왼쪽(시작 칸 쪽)에는 칠하지 않는다. */
  readonly minDx: number;
  /** 이 dx 보다 오른쪽에는 칠하지 않는다. */
  readonly maxDx?: number;
  /** 이벤트 줄 위아래 이 칸 수 안(|dy| ≤ keepDy)은 마른 땅으로 남긴다 — 두 못 사이의 둑길. */
  readonly keepDy?: number;
}

/** 칸 좌표에서 0..1 결정적 잡음 — 같은 입력이면 항상 같은 윤곽이라 재현·측정이 된다. */
function hash01(a: number, b: number, seed: number): number {
  let h = (Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519) ^ Math.imul(seed + 3266489917, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * 사각 구역 안에서 남길 칸 — 변마다 2칸 묶음으로 0..depth 칸씩 들쭉날쭉 깎고 모서리는 한 칸 더 둥글린다. 맵 끝에 닿은 변은 그대로.
 * 왜(2026-10-18 심판 4건 모두): 곧은 변의 판석·흙 구역이 «어색한 직선 사각 패치» 로 읽혔다.
 */
function raggedKeep(bounds: { readonly width: number; readonly height: number }, r: Rect, seed: number, depth: number): (cx: number, cy: number) => boolean {
  const left = r.x > 0, right = r.x + r.w < bounds.width, top = r.y > 0, bottom = r.y + r.h < bounds.height;
  const cut = (i: number, side: number) => Math.floor(hash01(Math.floor(i / 2), side, seed) * (depth + 1));
  return (cx, cy) => {
    if (cx < r.x || cy < r.y || cx >= r.x + r.w || cy >= r.y + r.h) return false;
    const dl = left ? cx - r.x - cut(cy, 1) : Infinity;
    const dr = right ? r.x + r.w - 1 - cx - cut(cy, 2) : Infinity;
    const dt = top ? cy - r.y - cut(cx, 3) : Infinity;
    const db = bottom ? r.y + r.h - 1 - cy - cut(cx, 4) : Infinity;
    if (dl < 0 || dr < 0 || dt < 0 || db < 0) return false;
    return Math.min(dl, dr) + Math.min(dt, db) >= 1;
  };
}

/** keep 칸을 줄마다 이어진 1줄 사각형들로 — fill_region 은 사각형만 받는다. */
function rowRuns(r: Rect, keep: (cx: number, cy: number) => boolean): Rect[] {
  const out: Rect[] = [];
  for (let cy = r.y; cy < r.y + r.h; cy++) {
    let from = -1;
    for (let cx = r.x; cx <= r.x + r.w; cx++) {
      const k = cx < r.x + r.w && keep(cx, cy);
      if (k && from < 0) from = cx;
      if (!k && from >= 0) { out.push({ x: from, y: cy, w: cx - from, h: 1 }); from = -1; }
    }
  }
  return out;
}

/** 용암 2×2 스탬프의 칸 번호(위·아래·좌·우 홀짝마다 다른 노이즈 프레임) — 칸마다 절대 좌표 홀짝으로 고른다. */
const LAVA_TILES = [[27292, 27296], [27300, 27304]] as const;

/** 직교 이웃이 1칸 이하인 외톨이·돌기 칸을 두 번 깎는다 — 한 칸짜리 네모 돌기가 둑 덧그림에서 어두운 네모로 남는다. */
function trimSpurs(map: GameMap, cells: { x: number; y: number }[]): { x: number; y: number }[] {
  let cur = cells;
  for (let pass = 0; pass < 2; pass++) {
    const set = new Set(cur.map((c) => c.y * map.width + c.x));
    const has = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || set.has(cy * map.width + cx);
    cur = cur.filter((c) => [has(c.x - 1, c.y), has(c.x + 1, c.y), has(c.x, c.y - 1), has(c.x, c.y + 1)].filter(Boolean).length >= 2);
  }
  return cur;
}

function bodyCells(map: GameMap, x: number, y: number, b: Body, keep: (cx: number, cy: number) => boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const ox = x + b.cx, oy = y + b.cy;
  for (let cy = Math.floor(oy - b.ry - 2); cy <= Math.ceil(oy + b.ry + 2); cy++) {
    for (let cx = Math.floor(ox - b.rx - 2); cx <= Math.ceil(ox + b.rx + 2); cx++) {
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || cx - x < b.minDx) continue;
      if ((b.maxDx !== undefined && cx - x > b.maxDx) || (b.keepDy !== undefined && Math.abs(cy - y) <= b.keepDy) || !keep(cx, cy)) continue;
      const d = ((cx - ox) / b.rx) ** 2 + ((cy - oy) / b.ry) ** 2;
      // 잡음은 이벤트 줄에서 잰 위아래 거리로 고른다 — 이벤트 줄을 사이에 둔 두 못(둑길 위·아래)이 거울처럼 같은 윤곽이 된다.
      if (d < 1 + (hash01(cx, Math.abs(cy - y), b.seed) - 0.5) * 0.7) out.push({ x: cx, y: cy });
    }
  }
  return trimSpurs(map, out);
}

/**
 * 용암 강(가로 띠, 기본 4줄 y-2..y+1) — 위·아래 가장자리를 3칸 단위로 들쭉날쭉하게. 다리(3×7, y-3..y+3)의 양 끝은
 * 강 밖 둑에 닿는다. 2줄짜리 띠는 다리가 «바닥 위 석판» 으로 읽혔다.
 */
function lavaBandCells(map: GameMap, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let cx = 0; cx < map.width; cx++) {
    const rows = [y - 2, y - 1, y, y + 1];
    // 돌기는 3~4칸 묶음 단위이고, 다리(x-1..x+1) 양옆 2칸 안에서는 만들지 않는다(한 칸 돌기가 어두운 네모로 남는다).
    // 묶음은 다리에서 잰 거리로 고른다 — 다리 좌우의 강 기슭이 거울처럼 같은 굴곡이 된다.
    const off = Math.abs(cx - x);
    if (off > 2) {
      if (hash01(Math.floor(off / 3), 1, 77) < 0.5) rows.unshift(y - 3);
      if (hash01(Math.floor((off + 1) / 3), 2, 77) < 0.5) rows.push(y + 2);
    }
    for (const cy of rows) if (cy >= 0 && cy < map.height) out.push({ x: cx, y: cy });
  }
  return out;
}

/**
 * 가는 용암 균열 — 2칸 폭, 3칸 묶음마다 길 반대쪽으로 한 줄씩 굽는다(길 쪽으로 굽으면 길 띠에 잘려 1칸 폭 «검은 홈» 이 남았다).
 * 굽는 자리는 두 묶음의 줄을 모두 칠해 끊기지 않는다.
 */
function fissureCells(map: GameMap, x: number, y: number, f: { dy: number; dx0: number; dx1: number; seed: number }, keep: (cx: number, cy: number) => boolean): { x: number; y: number }[] {
  // 3칸 묶음은 균열 서쪽 끝(x+dx0)에서 센다 — 이벤트 칸이 어디든 굽이(와 그 앞 바위 무리 자리)가 같은 상대 위치에 난다.
  const off = (cx: number) => (hash01(Math.floor((cx - x - f.dx0) / 3), 7, f.seed) < 0.5 ? 0 : Math.sign(f.dy));
  const out = new Map<number, { x: number; y: number }>();
  for (let cx = x + f.dx0; cx <= x + f.dx1; cx++) {
    const base = y + f.dy + off(cx);
    const rows = new Set([base, base + 1]);
    if (cx > x + f.dx0 && off(cx - 1) !== off(cx)) for (const r of [y + f.dy + off(cx - 1), y + f.dy + off(cx - 1) + 1]) rows.add(r);
    for (const cy of rows) {
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || Math.abs(cy - y) <= 1 || !keep(cx, cy)) continue;
      out.set(cy * map.width + cx, { x: cx, y: cy });
    }
  }
  return trimSpurs(map, [...out.values()]);
}

/** 바닥 표본 키트를 rect 칸마다 되풀이해 하단 층에 깐다(원점 ox,oy 기준 무늬 주기). keep 이 있으면 그 칸만. */
function tileKit(project: Project, map: GameMap, kitId: string, rect: Rect, ox: number, oy: number, keep?: (cx: number, cy: number) => boolean): number {
  const kit = project.tilesets[map.tilesetId]?.structureKits?.find((k) => k.id === kitId);
  if (!kit) return 0;
  let n = 0;
  for (let cy = Math.max(0, rect.y); cy < Math.min(map.height, rect.y + rect.h); cy++) {
    for (let cx = Math.max(0, rect.x); cx < Math.min(map.width, rect.x + rect.w); cx++) {
      if (keep && !keep(cx, cy)) continue;
      const t = kit.rows[(((cy - oy) % kit.height) + kit.height) % kit.height]?.tiles[(((cx - ox) % kit.width) + kit.width) % kit.width] ?? -1;
      if (t < 0) continue;
      setLayerTileAt(map, 1, cy * map.width + cx, t);
      n++;
    }
  }
  return n;
}

const WALK_STEP = { up: [0, -1], down: [0, 1], right: [1, 0] } as const;

function walkCells(x: number, y: number, walk: NonNullable<Layout["walk"]>): { x: number; y: number }[] {
  const [sx, sy] = WALK_STEP[walk.dir];
  return Array.from({ length: walk.steps }, (_, i) => ({ x: x + sx * (i + 1), y: y + sy * (i + 1) }));
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * 몸체 칸마다 이웃 8비트 둑 덧그림(2층)을 얹는다 — 직각 칸 경계가 흑요석 둑(용암) 또는 이끼 둑(늪)의 둥근 윤곽이 된다.
 * 맵 밖은 «같은 칸» 으로 본다(맵 끝에 닿은 변은 둑을 두지 않는다).
 */
function applyBankOverlay(project: Project, map: GameMap, cells: readonly { x: number; y: number }[], table: readonly number[]): number {
  const target = project.tilesets[map.tilesetId]!;
  const nature = (project.tilesets[BEODEUL_NATURE_ID] ??= createBeodeulNatureTileset());
  if (nature.count < BEODEUL_NATURE.count) project.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset();
  const src = project.tilesets[BEODEUL_NATURE_ID]!;
  const inBody = new Set(cells.map((c) => c.y * map.width + c.x));
  const want = new Map<number, number>();
  for (const c of cells) {
    let mask = 0;
    N8.forEach(([dx, dy], b) => {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || inBody.has(ny * map.width + nx)) mask |= 1 << b;
    });
    const t = table[mask] ?? -1;
    if (t >= 0) want.set(c.y * map.width + c.x, t);
  }
  if (!want.size) return 0;
  const tr = translateTiles(src, target, new Set(want.values()));
  for (const to of tr.map.values()) {
    target.priority[to] = "upper";
    target.passability[to] = { up: true, down: true, left: true, right: true };
  }
  for (const [i, t] of want) if (layerTileAt(map, 2, i) < 0) setLayerTileAt(map, 2, i, tr.map.get(t)!);
  return want.size;
}

/** 한 점. */
const one = (id: string, dx: number, dy: number): Piece => ({ id, dx, dy });
/** 세로줄 x+at 기준 좌우 한 쌍 — dx 는 오른쪽 짝. */
const lr = (id: string, dx: number, dy: number, at = 0): Piece => ({ id, dx, dy, mirror: { axis: "x", at } });
/** 가로줄 y+at 기준 위아래 한 쌍 — dy 는 위쪽 짝. */
const ud = (id: string, dx: number, dy: number, at = 0): Piece => ({ id, dx, dy, mirror: { axis: "y", at } });

/**
 * 무대 짜임새 — 이벤트 칸 기준 상대 좌표의 건축 세트. 흩뿌림(해시로 고른 1×1 뼈·잔해·뾰족돌)은 쓰지 않는다:
 * 2026-10-18 사용자 피드백 «기물 배치가 엉망» — 광장·길 위에 아무렇게나 떨어진 1×1 소품이 무대를 잡동사니로 만들었다.
 * 기물은 동선(corridors)을 비우고 쌍(lr·ud)으로 축에 맞춰 선다. 이벤트 칸과 그 왼쪽 시작 칸, 생존 걷기 길(walk)은 막지 않는다.
 */
function arrange(theme: SceneTheme): Layout {
  switch (theme) {
    case "lava_bridge":
      // 동서로 하나 이어진 용암 협곡(y-3..y+2)을 가운데 바위 다리(3×7)가 남북으로 건넌다. 다리 머리마다 화로 한 쌍,
      // 북(y-5..y-4)·남(y+3..y+4) 기슭을 따라 현무암 기둥과 마그마 분출구가 다리를 축으로 좌우 대칭으로 선다. 다리 위 동선은 비운다.
      // 생존 분기는 다리를 따라 북쪽 기슭까지 4칸 건너간다.
      return {
        ground: { material: "버들항 모랫길", rx: 10, ry: 7 },
        floorKit: `${RUINS}floor-dirt`,
        fills: [],
        walk: { dir: "up", steps: 4 },
        corridors: [{ dx: -1, dy: -7, w: 3, h: 15 }],
        pieces: [
          one(`${VOLCANO}bridge`, -1, -3),
          lr(`${VOLCANO}brazier`, 2, -5),
          lr(`${VOLCANO}brazier`, 2, 3),
          lr(`${VOLCANO}pillar-broken-a`, 4, -5),
          lr(`${VOLCANO}steam-vent`, 6, -4),
          lr(`${VOLCANO}pillar-broken-a`, 8, -5),
          lr(`${VOLCANO}pillar-broken-a`, 4, 3),
          lr(`${VOLCANO}steam-vent`, 6, 3),
          lr(`${VOLCANO}pillar-broken-a`, 8, 3),
        ],
      };
    case "volcano":
      // 그을린 분화구 길: 이벤트 줄(y-1..y+1)이 넓게 빈 길이고, 길 바깥 양옆(y-5..y-3, y+3..y+5)으로 가는 용암 균열이 길과 나란히
      // 흐르다 동쪽 분화구 용암 못에 닿는다. 균열·못은 길을 축으로 위아래 거울처럼 굽고, 흑요석 바위 무리는 균열 서쪽 끝 굽이와
      // 못가 바깥 굽이에만 모아 둔다. 생존 분기는 길을 따라 오른쪽으로 3칸 나아간다(못은 x+4 부터).
      return {
        ground: { material: "버들항 모랫길", rx: 9, ry: 6 },
        fills: [],
        bodies: [{ kind: "lava", cx: 7.2, cy: 0, rx: 3.2, ry: 4.6, seed: 11, minDx: 4 }],
        fissures: [
          { dy: -4, dx0: -4, dx1: 4, seed: 5 },
          { dy: 3, dx0: -4, dx1: 4, seed: 5 },
        ],
        walk: { dir: "right", steps: 3 },
        corridors: [{ dx: -9, dy: -1, w: 13, h: 3 }],
        // 바위 무리: 균열 서쪽 끝 앞(dx -7..-5)과 균열이 바깥으로 굽어 길 쪽에 빈 홈이 난 자리(dx 2..3)에만.
        pieces: [
          ud(`${VOLCANO}spike-tall`, -7, -4),
          ud(`${VOLCANO}spike-wide`, -6, -4),
          ud(`${VOLCANO}spike-tall`, 3, -3),
          ud(`${VOLCANO}stalagmite`, 2, -3),
        ],
      };
    case "poison_swamp":
      // 마도 유적의 독늪: 늪 한 못을 마른 둑길(이벤트 줄)이 동서로 가로지른다 — 위·아래 늪 윤곽은 둑길을 축으로 거울처럼 같다.
      // 둑길 들머리(서)와 날머리(동)에 경고 등불 말뚝 한 쌍씩이 둑길을 끼고, 날머리 너머에 마법진 모자이크.
      // 북쪽 늪가에는 소신전을 가운데 두고 석상·고목이 늪 가운데 세로줄(x+2)을 축으로 좌우 대칭으로 선다.
      // 생존 분기는 둑길을 따라 4칸 건너간다.
      return {
        ground: { material: "버들항 광장 판석", rx: 24, ry: 20 },
        floorKit: `${RUINS}floor-ruin`,
        fills: [],
        bodies: [
          { kind: "water", cx: 2, cy: -3.3, rx: 5, ry: 2, seed: 23, minDx: -3, maxDx: 7, keepDy: 1 },
          { kind: "water", cx: 2, cy: 3.3, rx: 5, ry: 2, seed: 23, minDx: -3, maxDx: 7, keepDy: 1 },
        ],
        walk: { dir: "right", steps: 4 },
        corridors: [{ dx: -6, dy: 0, w: 15, h: 1 }],
        pieces: [
          ud(`${SWAMP}lantern`, -4, -3),
          ud(`${SWAMP}lantern`, 8, -3),
          one(`${RUINS}mosaic-medallion-5x5`, 9, -2),
          one(`${RUINS}roof-naiskos-pediment`, 0, -11),
          lr("bd-prop-statue_sage", 5, -10, 2),
          lr(`${RUINS}column-temple-tall`, 8, -9, 2),
        ],
      };
    case "ruins_shrine":
      // 성소: 모자이크 메달리온(7×7) 한가운데 이벤트 칸, 그 뒤(북) 맵 안쪽에 소신전과 좌우 수호 석상. 메달리온 양옆 x±4 줄에
      // 3줄마다 한 쌍씩 열주가 남북 참배로를 따라 서고, 메달리온 남쪽 모서리 화로 한 쌍이 참배로 들머리를 연다. 바깥 줄은 사이프러스.
      return {
        ground: { material: "버들항 광장 판석", rx: 9, ry: 7 },
        fills: [],
        corridors: [{ dx: -1, dy: 4, w: 3, h: 4 }],
        pieces: [
          one(`${RUINS}mosaic-medallion-7x7`, -3, -3),
          one(`${RUINS}roof-hip-shrine`, -1, -6),
          lr("bd-prop-statue_sage", 4, -6),
          lr(`${RUINS}column-temple`, 4, -1),
          lr(`${RUINS}column-temple`, 4, 2),
          lr(`${RUINS}column-temple`, 4, 5),
          lr(`${VOLCANO}brazier`, 3, 4),
          lr(`${RUINS}cypress-ruin`, 7, -5),
          lr(`${RUINS}cypress-ruin`, 7, -1),
          lr(`${RUINS}cypress-ruin`, 7, 3),
        ],
      };
  }
}

/** 바닥 그림(모자이크·다리)만 동선 위에 깐다 — 걸어 지나가는 칸이다. */
const FLOOR_PIECE = /mosaic|bridge|floor/u;

/** 쌍의 두 짝(또는 한 점)의 놓을 자리 — 이벤트 칸 기준 dx,dy. */
function pieceSpots(p: Piece, w: number, h: number): { dx: number; dy: number }[] {
  if (!p.mirror) return [{ dx: p.dx, dy: p.dy }];
  const m = p.mirror;
  const twin = m.axis === "x" ? { dx: 2 * m.at - p.dx - w + 1, dy: p.dy } : { dx: p.dx, dy: 2 * m.at - p.dy - h + 1 };
  return twin.dx === p.dx && twin.dy === p.dy ? [{ dx: p.dx, dy: p.dy }] : [{ dx: p.dx, dy: p.dy }, twin];
}

function toolByName(list: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = list.find((t) => t.name === name);
  if (!tool) throw new Error(`내부 도구를 찾지 못했습니다: ${name}`);
  return tool;
}

/**
 * 다리 칸(x-1..x+1, 용암 띠 y-1..y)이 «무너진» 모습. 다리 그림은 상단(upper) 층이고 그 밑 하단은 이미 용암이라,
 * 하단만 바꾸면 화면이 그대로다(2026-10-16 18차: 심판이 «다리가 온전하다» 로 감점). 상단 칸을 용암 타일로 덮어 틈을 낸다.
 * 용암 칸 번호는 홀짝 칸마다 다르다.
 */
function bridgeCollapse(map: GameMap, x: number, y: number): { cells: { x: number; y: number; layer: "upper"; tile: number }[] } {
  const cells: { x: number; y: number; layer: "upper"; tile: number }[] = [];
  for (const cy of [y - 2, y - 1, y, y + 1]) {
    for (const cx of [x - 1, x, x + 1]) {
      if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
      cells.push({ x: cx, y: cy, layer: "upper", tile: LAVA_TILES[cy % 2]![cx % 2]! });
    }
  }
  return { cells: cells.filter((c) => c.tile >= 0) };
}

/** 구역 가장자리까지 4칸 이하만 남으면 그 모서리는 맵 끝까지 잇는다 — 가는 풀밭 띠가 직선 경계로 남지 않게. */
function snapToMapEdge(map: GameMap, r: { x: number; y: number; w: number; h: number }) {
  const m = 4;
  const x0 = r.x <= m ? 0 : r.x;
  const y0 = r.y <= m ? 0 : r.y;
  const x1 = map.width - (r.x + r.w) <= m ? map.width : r.x + r.w;
  const y1 = map.height - (r.y + r.h) <= m ? map.height : r.y + r.h;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 직사각형 바닥의 네 모서리를 계단식으로 깎아 반듯한 사각 패치로 보이지 않게 한다(맵 끝에 닿은 변은 그대로). */
function roundedParts(map: GameMap, r: { x: number; y: number; w: number; h: number }) {
  if (r.w < 6 || r.h < 6) return [r];
  const c = r.w >= 12 && r.h >= 8 ? 3 : 2;
  // 맵 가장자리에 닿은 변은 그대로 둔다 — 깎으면 그 모서리에 풀밭 삼각형이 남는다.
  const left = r.x <= 0, right = r.x + r.w >= map.width, top = r.y <= 0, bottom = r.y + r.h >= map.height;
  const cl = left ? 0 : c, cr = right ? 0 : c, ct = top ? 0 : c, cb = bottom ? 0 : c;
  return [
    { x: r.x + cl, y: r.y, w: r.w - cl - cr, h: r.h },
    { x: r.x, y: r.y + ct, w: r.w, h: r.h - ct - cb },
    { x: r.x + (left ? 0 : 1), y: r.y + (top ? 0 : 1), w: r.w - (left ? 0 : 1) - (right ? 0 : 1), h: r.h - (top ? 0 : 1) - (bottom ? 0 : 1) },
  ];
}

function themeKitIds(theme: SceneTheme): string[] {
  return [...new Set(arrange(theme).pieces.map((p) => KIT + p.id))];
}

function clampRect(map: GameMap, x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(map.width, x + w);
  const y1 = Math.min(map.height, y + h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export const SCENE_SETTING_TOOLS: readonly ToolDefinition[] = [
  {
    name: BUILD_SCENE_SETTING_TOOL,
    mode: "write",
    domains: ["map", "tile"],
    description:
      "이벤트·컷씬·함정이 놓일 «무대» 를 이벤트 좌표 둘레에 한 번에 짓는다(버들항 beodeul_city 맵 전용, 새 그림 없이 기존 키트). "
      + "theme: volcano(그을린 분화구 길: 길 양옆 용암 균열·분화구 용암 못·흑요석·증기 구멍) · lava_bridge(협곡을 가로지르는 용암 강 + 바위 다리, 이벤트 칸이 다리 위, 양 끝 유적 테라스) · "
      + "poison_swamp(마도 유적 독늪 둑길: 유적 판석·신전 기둥 문·소신전·제단, 이벤트 칸은 두 독늪 사이 좁은 둑길) · ruins_shrine(마도·고대 유적/성소: 모자이크 바닥·소신전·기둥·화로). "
      + "x,y 는 이벤트(트리거) 칸이고 x-1,y 는 플레이어가 걸어 들어오는 칸이다 — 이 두 칸은 막지 않는다. 이 좌표 둘레 한 구역만 바꾸고 맵의 나머지는 보존한다. "
      + "결과 data.survivalWalk.moves 는 생존(무사 통과) 분기에서 주인공이 위험 구역을 건너는 막히지 않은 걸음이다(moveActor target:'player'). "
      + "houses 는 volcano 에서 «마을 외곽» 을 말할 때만(0~3) 구역 밖 모서리에 마을 집을 얹는다. 짓고 나서 show_map_region 으로 그림을 확인하고 이벤트를 만든다.",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id(생략 시 현재 맵)" },
        theme: { type: "string", enum: [...SCENE_THEMES] },
        x: { type: "integer", description: "이벤트(트리거) 칸 x" },
        y: { type: "integer", description: "이벤트(트리거) 칸 y" },
        houses: { type: "integer", minimum: 0, maximum: 3, description: "volcano 전용: 마을 집 채수(0~3). 생략하면 0" },
      },
      required: ["theme", "x", "y"],
      additionalProperties: false,
    },
    invalidArgsExample: { mapId: "map_id", theme: "volcano", x: 16, y: 11 },
    prepare: async (args) => {
      const theme = args.theme as SceneTheme;
      if (!SCENE_THEMES.includes(theme)) return;
      await Promise.all(themeKitIds(theme).map((id) => prepareSharedObject(id)));
    },
    run(project: Project, args: Readonly<Record<string, unknown>>): ToolExecResult {
      const theme = args.theme as SceneTheme;
      if (!SCENE_THEMES.includes(theme)) throw new ToolError(`theme 은 ${SCENE_THEMES.join(" | ")} 중 하나여야 합니다`, { code: "bad-theme" });
      const mapId = String(args.mapId ?? "");
      const map = project.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
      if (map.tilesetId !== "beodeul_city") {
        throw new ToolError(
          `build_scene_setting 은 버들항(beodeul_city) 맵 전용입니다 — 이 맵 칩셋은 ${map.tilesetId}. list_spatial_designs·stamp_object 로 이 칩셋의 오브젝트를 직접 찍으세요.`,
          { code: "tileset-not-supported" },
        );
      }
      const x = Number(args.x);
      const y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
        throw new ToolError(`좌표 (${args.x},${args.y}) 가 맵 ${map.width}×${map.height} 밖입니다`, { code: "out-of-map" });
      }

      // 다시 지으면 옛 무대의 보호 구역부터 걷는다 — 남겨 두면 이번 무대의 기물이 그 구역에 걸려 거절된다.
      map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(SCENE_STAGE_TAG));
      const layout = arrange(theme);
      const fill = toolByName(CONSTRUCTION_TOOLS_V3, "fill_region");
      const stamp = toolByName(SHARED_OBJECT_TOOLS, "stamp_object");
      const warnings: string[] = [];
      const built: string[] = [];

      const g = layout.ground;
      const ground = snapToMapEdge(map, clampRect(map, x - g.rx, y - g.ry, g.rx * 2 + 1, g.ry * 2 + 1));
      const groundKeep = raggedKeep(map, ground, 3, 2);
      for (const r of rowRuns(ground, groundKeep)) fill.run(project, { mapId, rect: r, material: g.material, clearUpper: true });
      built.push(`바닥 ${g.material} ${ground.w}×${ground.h}`);
      if (layout.floorKit && tileKit(project, map, layout.floorKit, ground, x, y, groundKeep) > 0) built.push(`바닥 무늬 ${layout.floorKit.replace("bd-pick-", "")}`);
      for (const [i, p] of (layout.pads ?? []).entries()) {
        const r = { x: x + p.dx, y: y + p.dy, w: p.w, h: p.h };
        const keepPad = raggedKeep({ width: Infinity, height: Infinity }, r, 17 + i, 1);
        tileKit(project, map, p.kit, r, x, y, (cx, cy) => groundKeep(cx, cy) && keepPad(cx, cy));
      }

      for (const f of layout.fills) {
        const r = clampRect(map, x + f.dx, y + f.dy, f.w, f.h);
        if (r.w === 0 || r.h === 0) continue;
        try {
          for (const part of roundedParts(map, r)) fill.run(project, { mapId, rect: part, material: f.material, clearUpper: true });
        } catch (error) {
          warnings.push(`${f.material} 칠하기 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (layout.fills.length) built.push(`${layout.fills[0]!.material} 영역`);

      // 불규칙 몸체(용암·물) — 칸 단위로 칠하고, 둘레는 둑 덧그림(applyBankOverlay)이 둥글린다.
      const bridgeBox = (cx: number, cy: number) => theme === "lava_bridge" && Math.abs(cx - x) <= 1 && cy >= y - 3 && cy <= y + 3;
      const walk = layout.walk ? walkCells(x, y, layout.walk) : [];
      const onWalk = (cx: number, cy: number) => walk.some((c) => c.x === cx && c.y === cy);
      const free = (cx: number, cy: number) => !((cx === x && cy === y) || (cx === x - 1 && cy === y)) && !bridgeBox(cx, cy) && !onWalk(cx, cy);
      const lavaOf: { x: number; y: number }[][] = theme === "lava_bridge"
        ? [lavaBandCells(map, x, y)]
        : [
          ...(layout.bodies ?? []).filter((b) => b.kind === "lava").map((b) => bodyCells(map, x, y, b, free)),
          ...(layout.fissures ?? []).map((f) => fissureCells(map, x, y, f, free)),
        ];
      for (const cells of lavaOf) {
        for (const c of cells) setLayerTileAt(map, 1, c.y * map.width + c.x, LAVA_TILES[c.y % 2]![c.x % 2]!);
        for (const c of cells) for (let l = 2; l <= 3; l++) setLayerTileAt(map, l as 2 | 3, c.y * map.width + c.x, -1);
        applyBankOverlay(project, map, cells, BEODEUL_NATURE.bankLava);
        if (theme === "lava_bridge") for (const c of cells) if (bridgeBox(c.x, c.y)) setLayerTileAt(map, 2, c.y * map.width + c.x, -1);
      }
      if (layout.fissures?.length) built.push(`용암 균열 ${layout.fissures.length}줄`);
      for (const b of (layout.bodies ?? []).filter((q) => q.kind === "water")) {
        const cells = bodyCells(map, x, y, b, free);
        const rows = new Map<number, number[]>();
        for (const c of cells) (rows.get(c.y) ?? rows.set(c.y, []).get(c.y)!).push(c.x);
        for (const [cy, xs] of rows) {
          xs.sort((p, q) => p - q);
          let from = xs[0]!, prev = from;
          for (const cx of [...xs.slice(1), Number.POSITIVE_INFINITY]) {
            if (cx !== prev + 1) {
              fill.run(project, { mapId, rect: { x: from, y: cy, w: prev - from + 1, h: 1 }, material: "버들항 물", clearUpper: true });
              from = cx;
            }
            prev = cx;
          }
        }
        applyBankOverlay(project, map, cells, BEODEUL_NATURE.bankBog);
        built.push("물 " + cells.length + "칸");
      }
      const occupied = new Set<number>();
      const kitList = project.tilesets.beodeul_city?.structureKits ?? [];
      const waterOrLava = new Set<number>();
      for (const cells of lavaOf) for (const c of cells) waterOrLava.add(c.y * map.width + c.x);
      for (const b of (layout.bodies ?? []).filter((q) => q.kind === "water")) for (const c of bodyCells(map, x, y, b, free)) waterOrLava.add(c.y * map.width + c.x);
      const corridors = (layout.corridors ?? []).map((c) => clampRect(map, x + c.dx, y + c.dy, c.w, c.h));
      const inCorridor = (cx: number, cy: number) => corridors.some((r) => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h);
      // 기물은 무대 바닥 안에만 선다. 물·용암·동선·이벤트 칸·걷기 길·다른 기물 위는 안 된다(바닥 그림인 모자이크·다리는 동선·몸체 위에 깐다).
      const fits = (id: string, w: number, h: number, px: number, py: number) => {
        if (px < 0 || py < 0 || px + w > map.width || py + h > map.height) return false;
        const floorPiece = FLOOR_PIECE.test(id);
        for (let cy = py; cy < py + h; cy++) {
          for (let cx = px; cx < px + w; cx++) {
            if (!groundKeep(cx, cy) || cx < ground.x || cy < ground.y || cx >= ground.x + ground.w || cy >= ground.y + ground.h) return false;
            if (!floorPiece && (waterOrLava.has(cy * map.width + cx) || !free(cx, cy) || inCorridor(cx, cy) || occupied.has(cy * map.width + cx))) return false;
          }
        }
        return true;
      };
      let stamped = 0;
      let dropped = 0;
      for (const p of layout.pieces) {
        const kit = kitList.find((k) => k.id === p.id);
        if (!kit) {
          warnings.push(`${p.id} 키트가 없어 건너뜀`);
          continue;
        }
        // 쌍은 두 짝이 모두 들어갈 때만 찍는다 — 한 짝이 맵 밖·몸체·동선에 걸리면 둘 다 뺀다(좌우·위아래 대칭이 깨지지 않게).
        const spots = pieceSpots(p, kit.width, kit.height).map((sp) => ({ x: x + sp.dx, y: y + sp.dy }));
        if (!spots.every((sp) => fits(p.id, kit.width, kit.height, sp.x, sp.y))) {
          dropped++;
          continue;
        }
        for (const sp of spots) {
          try {
            stamp.run(project, { objectId: KIT + p.id, mapId, x: sp.x, y: sp.y });
            stamped++;
            if (!FLOOR_PIECE.test(p.id)) for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) occupied.add((sp.y + dy) * map.width + sp.x + dx);
          } catch (error) {
            warnings.push(`${p.id} (${sp.x},${sp.y}) 건너뜀: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
          }
        }
      }
      if (theme === "ruins_shrine" && x + 1 < map.width && y >= 1) {
        // 성검 꽂힌 바위(1×2, 손 도트) — 이벤트 칸 오른쪽. 위칸 = 칼자루·날(통행), 아래칸 = 바위(막힘).
        const target = project.tilesets[map.tilesetId]!;
        const nature = (project.tilesets[BEODEUL_NATURE_ID] ??= createBeodeulNatureTileset());
        if (nature.count < BEODEUL_NATURE.count) project.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset();
        const tr = translateTiles(project.tilesets[BEODEUL_NATURE_ID]!, target, new Set(BEODEUL_NATURE.swordStone));
        const [topTile, bottomTile] = BEODEUL_NATURE.swordStone.map((t) => tr.map.get(t)!);
        target.priority[topTile!] = "upper";
        target.passability[topTile!] = { up: true, down: true, left: true, right: true };
        target.priority[bottomTile!] = "lower";
        target.passability[bottomTile!] = { up: false, down: false, left: false, right: false };
        setLayerTileAt(map, 3, (y - 1) * map.width + x + 1, topTile!);
        setLayerTileAt(map, 3, y * map.width + x + 1, bottomTile!);
        occupied.add((y - 1) * map.width + x + 1);
        occupied.add(y * map.width + x + 1);
        built.push("성검 꽂힌 바위");
      }
      built.push(`기물 ${stamped}점${dropped ? `(맵 밖·몸체에 걸린 대칭 쌍 ${dropped}개는 통째로 뺌)` : ""}`);

      // 무대 보호 구역 — 이벤트 칸 둘레 2칸과 동선(다리·둑길·참배로). 조수의 stamp_object·place_props 는 여기에 소품을 얹지 못한다
      // (sceneStageGuard). composed-layout 표식은 배치 품질 권고의 «빈 바닥 채우기» 를 끈다 — 그 권고가 비운 칸에 소품을 흩뿌리게 한다.
      const zones = [
        { name: "무대 초점", ...clampRect(map, x - 2, y - 2, 5, 5) },
        ...corridors.map((r) => ({ name: "무대 동선", ...r })),
      ];
      for (const z of zones) addMapLocation(map, { ...z, tags: [SCENE_STAGE_TAG, COMPOSED_LAYOUT_TAG], note: `build_scene_setting ${theme} 보호 구역 — 소품 금지` });

      const houses = theme === "volcano" ? Math.max(0, Math.min(3, Math.trunc(Number(args.houses ?? 0)))) : 0;
      if (houses > 0) {
        const slots: readonly { id: string; hx: number; hy: number; w: number; h: number }[] = [
          { id: "bd-house-village-cream", hx: 0, hy: 0, w: 7, h: 6 },
          { id: "bd-house-village-ochre", hx: 0, hy: 7, w: 6, h: 6 },
          { id: "bd-house-village-stone", hx: 8, hy: 0, w: 4, h: 6 },
        ];
        if (!project.tilesets.beodeul_city?.structureKits?.some((k) => k.id === slots[0]!.id)) installBeodeulArchitecture(project);
        const hot = { x0: x + 1, x1: x + g.rx, y0: y - 5, y1: y + 3 };
        let placed = 0;
        for (const slot of slots) {
          if (placed >= houses) break;
          const overlapsHot = slot.hx + slot.w > hot.x0 && slot.hx <= hot.x1 && slot.hy + slot.h > hot.y0 && slot.hy <= hot.y1;
          if (overlapsHot) continue;
          try {
            stamp.run(project, { objectId: KIT + slot.id, mapId, x: slot.hx, y: slot.hy });
            placed++;
          } catch (error) {
            warnings.push(`${slot.id} (${slot.hx},${slot.hy}) 건너뜀: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
          }
        }
        built.push(`마을 집 ${placed}채`);
      }

      const collapse = theme === "lava_bridge" ? bridgeCollapse(map, x, y) : undefined;
      const blockedWalk = walk.filter((c, i) => !canMove(project, map, i === 0 ? x : walk[i - 1]!.x, i === 0 ? y : walk[i - 1]!.y, c.x, c.y));
      if (blockedWalk.length) warnings.push(`생존 걷기 길 막힘: ${blockedWalk.map((c) => `(${c.x},${c.y})`).join(" ")}`);
      const survivalWalk = layout.walk && !blockedWalk.length
        ? { moves: walk.map(() => ({ kind: "move", dir: layout.walk!.dir })), cells: walk, end: walk[walk.length - 1]! }
        : undefined;
      // 성검을 뽑는 순간 바위 위칸(칼자루·날)을 그 칸 바닥 그림으로 덮는다 — 뽑았는데 칼이 바위에 그대로면 «뽑는 동작이 없다» 로
      // 감점(2026-10-18 jrpg_046 48점). 컷씬 changeTile 은 음수 타일을 0 으로 자르므로 «지우기» 대신 같은 바닥 칸을 쓴다.
      const swordPull = built.includes("성검 꽂힌 바위")
        ? { cells: [{ x: x + 1, y: y - 1, layer: "upper" as const, tile: layerTileAt(map, 1, (y - 1) * map.width + x + 1) }], stone: { x: x + 1, y } }
        : undefined;
      return {
        summary: `무대 ${theme} → ${mapId} 이벤트 칸 (${x},${y}) 둘레: ${built.join(" · ")}. 이제 show_map_region 으로 확인하고 (${x},${y}) 에 이벤트를 만든다 — 시작 칸 (${x - 1},${y}) 은 막혀 있지 않다. 기물은 축에 맞춘 대칭 세트로 이미 섰다 — 무대 초점·동선 ${zones.length}곳(scene-stage 로케이션)은 비워 둔 칸이라 stamp_object·place_props 가 거절하니, 소품을 더 흩뿌리지 않는다.${collapse ? ` 다리 붕괴 연출은 사망 분기에서 data.collapse.cells ${collapse.cells.length}칸에 changeTile{mapId,layer:"upper",x,y,tile} 을 적용한다(다리 그림이 상단 층이라 반드시 layer "upper" — 하단은 이미 용암이라 바꿔도 화면이 그대로다). 붕괴 직후 한 번 더 화면을 붉게 번쩍이면 틈이 눈에 띈다.` : ""}${survivalWalk ? ` 생존(무사 통과) 분기는 제자리에 세워 두지 말고 moveActor{target:"player",moves:data.survivalWalk.moves} 로 (${survivalWalk.end.x},${survivalWalk.end.y}) 까지 ${walk.length}칸 걸어 위험 구역을 건너게 하고, 걷는 동안 tint 를 원래대로·weather none 으로 거둔다.` : ""}${swordPull ? ` 성검을 뽑는 분기는 바위 앞에서 한 걸음 다가서 칼자루를 쥐고(검을 쥔 인물 jump dx:0,dy:0) parallel[ flash white, shake, music se, particles sparkle(바위 칸), 빛기둥 picture(add) ] 와 함께 data.swordPull.cells 를 changeTile{mapId,layer:"upper",x,y,tile} 로 그대로 적용해 바위에서 칼이 사라지게 하고, 이어서 «성검을 높이 치켜들었다!» 대사 + sparkle 를 인물 위에 띄운다.` : ""}`,
        data: { theme, mapId, focus: { x, y }, start: { x: x - 1, y }, ground, stamped, total: layout.pieces.length, protectedZones: zones, ...(collapse ? { collapse } : {}), ...(survivalWalk ? { survivalWalk } : {}), ...(swordPull ? { swordPull } : {}) },
        ...(warnings.length ? { warnings } : {}),
      };
    },
  },
];
