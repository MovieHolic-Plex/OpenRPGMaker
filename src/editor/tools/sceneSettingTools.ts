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
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const BUILD_SCENE_SETTING_TOOL = "build_scene_setting";

export const SCENE_THEMES = ["lava_bridge", "volcano", "poison_swamp", "ruins_shrine"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

const KIT = "kit:beodeul_city/";
const VOLCANO = "bd-pick-volcano-cave-";
const RUINS = "bd-pick-temple-ruins-";
const SWAMP = "bd-pick-swamp-stilt-";

interface Stamp {
  readonly id: string;
  readonly dx: number;
  readonly dy: number;
}

interface Layout {
  readonly ground: { readonly material: string; readonly rx: number; readonly ry: number };
  /** 바닥 위에 먼저 깔 칠하기(물 등). 이벤트 칸과 시작 칸을 침범하지 않게 좌표를 고른다. */
  readonly fills: readonly { readonly material: string; readonly dx: number; readonly dy: number; readonly w: number; readonly h: number }[];
  /** 위에서 아래 순서로 찍는다 — 뒤에 찍은 것이 앞의 것을 덮는다. */
  readonly stamps: readonly Stamp[];
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
      if (d < 1 + (hash01(cx, cy, b.seed) - 0.5) * 0.7) out.push({ x: cx, y: cy });
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
    if (Math.abs(cx - x) > 2) {
      if (hash01(Math.floor(cx / 3), 1, 77) < 0.5) rows.unshift(y - 3);
      if (hash01(Math.floor((cx + 1) / 3), 2, 77) < 0.5) rows.push(y + 2);
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
  const off = (cx: number) => (hash01(Math.floor(cx / 3), 7, f.seed) < 0.5 ? 0 : Math.sign(f.dy));
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

/** 바닥 표본 키트를 rect 칸마다 되풀이해 하단 층에 깐다(원점 ox,oy 기준 무늬 주기). */
function tileKit(project: Project, map: GameMap, kitId: string, rect: { x: number; y: number; w: number; h: number }, ox: number, oy: number): number {
  const kit = project.tilesets[map.tilesetId]?.structureKits?.find((k) => k.id === kitId);
  if (!kit) return 0;
  let n = 0;
  for (let cy = Math.max(0, rect.y); cy < Math.min(map.height, rect.y + rect.h); cy++) {
    for (let cx = Math.max(0, rect.x); cx < Math.min(map.width, rect.x + rect.w); cx++) {
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

/**
 * 무대마다 «빈 땅에 흩뿌릴 소품» 목록 — 15차 연속 심판이 «맵이 휑하다(소품이 가장자리·중앙에만)» 로 감점했다.
 * 자리는 해시로 고르되(같은 입력 → 같은 배치) 몸체·이미 찍은 키트·이벤트 칸·시작 칸과 1칸 간격을 둔다.
 * 2026-10-18: 같은 1×1 뾰족돌을 고르게 뿌린 땅은 «무늬 잡음» 으로 읽혔다 — 무대는 이벤트 칸 둘레의 고정 세트가 맡고 흩뿌림은 줄였다.
 */
const SCATTER: Record<SceneTheme, readonly (readonly [string, number])[]> = {
  volcano: [[VOLCANO + "spike-small", 3], [VOLCANO + "ember-a", 2], [VOLCANO + "bones", 2], [VOLCANO + "steam-vent", 3], [VOLCANO + "stalagmite", 2], [VOLCANO + "spike-tall", 2], [VOLCANO + "pillar-broken-b", 1], [RUINS + "rubble-temple", 2]],
  lava_bridge: [[VOLCANO + "spike-small", 3], [VOLCANO + "ember-a", 2], [VOLCANO + "bones", 2], [VOLCANO + "stalagmite", 2], [VOLCANO + "pillar-broken-b", 2], [RUINS + "rubble-temple", 4], [RUINS + "fallen-column-temple", 1]],
  poison_swamp: [[RUINS + "cypress-ruin", 2], [RUINS + "rubble-temple", 4], [RUINS + "column-temple-broken", 2], [RUINS + "fallen-column-temple", 1], [RUINS + "ruined-wall-2", 2], [VOLCANO + "bones", 2], [SWAMP + "reed-stack", 1]],
  ruins_shrine: [[RUINS + "rubble-temple", 6], [RUINS + "column-temple-broken", 3], [RUINS + "fallen-column-temple", 2], [RUINS + "cypress-ruin", 3], [RUINS + "vines-2", 3], [RUINS + "ruined-wall-2", 2], [VOLCANO + "brazier", 2], [VOLCANO + "bones", 2]],
};

function scatterStamps(
  project: Project, map: GameMap, theme: SceneTheme, ground: { x: number; y: number; w: number; h: number },
  occupied: Set<number>, blocked: (cx: number, cy: number) => boolean,
): { id: string; x: number; y: number }[] {
  const kits = project.tilesets.beodeul_city?.structureKits ?? [];
  const out: { id: string; x: number; y: number }[] = [];
  let n = 0;
  for (const [id, count] of SCATTER[theme]) {
    const kit = kits.find((k) => k.id === id);
    if (!kit) continue;
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++, n++) {
        const px = ground.x + Math.floor(hash01(n, 1, 501) * Math.max(1, ground.w - kit.width + 1));
        const py = ground.y + Math.floor(hash01(n, 2, 502) * Math.max(1, ground.h - kit.height + 1));
        if (px < 0 || py < 0 || px + kit.width > map.width || py + kit.height > map.height) continue;
        let ok = true;
        for (let dy = -1; dy <= kit.height && ok; dy++) for (let dx = -1; dx <= kit.width && ok; dx++) {
          const cx = px + dx, cy = py + dy;
          if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
          if (occupied.has(cy * map.width + cx) || blocked(cx, cy)) ok = false;
        }
        if (!ok) continue;
        for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) occupied.add((py + dy) * map.width + px + dx);
        out.push({ id: KIT + id, x: px, y: py });
        n++;
        break;
      }
    }
  }
  return out;
}

/** 몸체 둘레(8방향 이웃)에 놓을 1×1 흑요석·불씨 소품 — 직각 가장자리를 가린다. */
function rimStamps(map: GameMap, cells: readonly { x: number; y: number }[], keep: (cx: number, cy: number) => boolean, seed: number, density: number): { id: string; x: number; y: number }[] {
  const lava = new Set(cells.map((c) => c.y * map.width + c.x));
  const seen = new Set<number>();
  const out: { id: string; x: number; y: number }[] = [];
  for (const c of cells) {
    for (let ny = c.y - 1; ny <= c.y + 1; ny++) {
      for (let nx = c.x - 1; nx <= c.x + 1; nx++) {
        const k = ny * map.width + nx;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || lava.has(k) || seen.has(k) || !keep(nx, ny)) continue;
        seen.add(k);
        const h = hash01(nx, ny, seed);
        if (h > density) continue;
        const pick = hash01(ny, nx, seed + 5);
        const id = pick < 0.4 ? "spike-small" : pick < 0.55 ? "ember-a" : pick < 0.62 ? "bones" : pick < 0.72 ? "fire-crystal" : "steam-vent";
        out.push({ id: VOLCANO + id, x: nx, y: ny });
      }
    }
  }
  return out;
}

const s = (id: string, dx: number, dy: number): Stamp => ({ id, dx, dy });

/** 배치는 이벤트 칸 기준 상대 좌표다. 이벤트 칸과 그 왼쪽 시작 칸, 생존 걷기 길(walk)은 막지 않는다. */
function layoutFor(theme: SceneTheme): Layout {
  switch (theme) {
    case "lava_bridge": {
      // 그을린 흙바닥 협곡을 4~5줄 용암 강(y-3..y+2)이 가로지르고, 바위 다리(3×7, y-3..y+3)가 이벤트 칸을 지나 두 둑의
      // 유적 테라스(트래버틴)를 잇는다. 다리 머리에 화로·신전 기둥, 둑에는 현무암 기둥·흑요석 무리·용암 폭포.
      // 생존 분기는 다리를 따라 북쪽 테라스까지 4칸 건너간다.
      return {
        ground: { material: "버들항 모랫길", rx: 10, ry: 7 },
        floorKit: `${RUINS}floor-dirt`,
        pads: [
          { kit: `${RUINS}floor-trav`, dx: -3, dy: -6, w: 7, h: 3 },
          { kit: `${RUINS}floor-trav`, dx: -3, dy: 4, w: 7, h: 3 },
        ],
        fills: [],
        walk: { dir: "up", steps: 4 },
        stamps: [
          s(`${VOLCANO}bridge`, -1, -3),
          s(`${VOLCANO}brazier`, -2, -5),
          s(`${VOLCANO}brazier`, 2, -5),
          s(`${VOLCANO}brazier`, -2, 3),
          s(`${VOLCANO}brazier`, 2, 3),
          s(`${RUINS}column-temple-tall`, -4, -7),
          s(`${RUINS}column-temple-tall`, 4, -7),
          s(`${RUINS}column-temple-broken`, -4, 4),
          s(`${RUINS}column-temple-broken`, 4, 4),
          s(`${VOLCANO}altar`, -9, -7),
          s(`${RUINS}face-temple-3h`, 5, -7),
          s(`${RUINS}ruined-wall-2`, -7, -6),
          s("bd-prop-statue_sage", 6, 3),
          s(`${VOLCANO}lava-fall-strip`, 6, -5),
          s(`${VOLCANO}stalagmite`, -6, -5),
          s(`${VOLCANO}spike-tall`, -9, 5),
          s(`${VOLCANO}spike-wide`, -8, 3),
          s(`${VOLCANO}pillar-broken-a`, -6, 3),
          s(`${VOLCANO}pillar-fallen`, -3, 6),
          s(`${VOLCANO}spike-small`, 3, -3),
          s(`${VOLCANO}fire-crystal`, -3, -4),
          s(`${VOLCANO}fire-crystal`, 3, 3),
          s(`${VOLCANO}steam-vent`, -3, 3),
          s(`${VOLCANO}bones`, 1, 5),
          s(`${RUINS}rubble-temple`, -1, 6),
          s(`${VOLCANO}ember-a`, 5, -4),
        ],
      };
    }
    case "volcano":
      // 그을린 분화구 길: 이벤트 줄(y-1..y+1)이 길이고, 길 위(y-5..y-3)·아래(y+3..y+5)에 가는 용암 균열이 길을 따라 흐르다
      // 오른쪽 분화구 용암 못에 닿는다. 이벤트 칸 바로 둘레에 흑요석 무리·증기 구멍·불탄 뼈(y±2 줄은 균열이 닿지 않는 소품 줄).
      // 생존 분기는 길을 따라 오른쪽으로 3칸 나아간다(못은 x+4 부터).
      return {
        ground: { material: "버들항 모랫길", rx: 9, ry: 6 },
        fills: [],
        bodies: [{ kind: "lava", cx: 7.2, cy: -0.5, rx: 3.2, ry: 4.6, seed: 11, minDx: 4 }],
        fissures: [
          { dy: -4, dx0: -7, dx1: 4, seed: 5 },
          { dy: 3, dx0: -6, dx1: 4, seed: 9 },
        ],
        walk: { dir: "right", steps: 3 },
        stamps: [
          s(`${VOLCANO}spike-wide`, -2, -2),
          s(`${VOLCANO}spike-tall`, 1, -2),
          s(`${VOLCANO}steam-vent`, 3, -1),
          s(`${VOLCANO}steam-vent`, -1, 1),
          s(`${VOLCANO}steam-vent`, 2, 1),
          s(`${VOLCANO}bones`, 1, 1),
          s(`${VOLCANO}ember-a`, 0, -1),
          s(`${VOLCANO}fire-crystal`, -3, 1),
          s(`${VOLCANO}spike-small`, -4, 1),
          s(`${VOLCANO}pillar-broken-a`, -5, -2),
          s(`${VOLCANO}stalagmite`, 3, 1),
          s(`${VOLCANO}stalagmite`, -6, 1),
          s(`${VOLCANO}spike-small`, 0, 2),
          s(`${VOLCANO}bones`, -3, 2),
          s(`${VOLCANO}spike-wide`, -6, -7),
          s(`${VOLCANO}spike-tall`, 2, -7),
          s(`${VOLCANO}pillar-broken-b`, -1, -7),
          s(`${VOLCANO}lava-fall-strip`, 5, -6),
          s(`${VOLCANO}fire-crystal`, -2, 6),
          s(`${VOLCANO}spike-small`, 3, 6),
        ],
      };
    case "poison_swamp":
      // 마도 유적의 독늪 둑길: 이끼 낀 유적 판석 바닥, 이벤트 줄(y-1..y+1)만 남기고 위·아래로 독늪이 붙어 이벤트 칸이 좁은 둑길 목이 된다.
      // 둑길은 트래버틴 판석, 양 끝에 신전 기둥 문, 가장자리에 부러진 기둥·증기 분출구·뼈. 북쪽에는 무너진 신전 벽·소신전·교단 제단·
      // 현자 석상, 둑길 끝(동쪽)에는 마법진 모자이크. 생존 분기는 둑길을 따라 오른쪽으로 4칸 건너간다.
      return {
        ground: { material: "버들항 광장 판석", rx: 24, ry: 20 },
        floorKit: `${RUINS}floor-ruin`,
        pads: [{ kit: `${RUINS}floor-trav`, dx: -4, dy: -1, w: 11, h: 3 }],
        fills: [],
        bodies: [
          { kind: "water", cx: 1, cy: -3.3, rx: 4.6, ry: 2.1, seed: 23, minDx: -5, maxDx: 6, keepDy: 1 },
          { kind: "water", cx: 1.5, cy: 3.4, rx: 4.8, ry: 1.9, seed: 29, minDx: -5, maxDx: 6, keepDy: 1 },
        ],
        walk: { dir: "right", steps: 4 },
        stamps: [
          s(`${RUINS}column-temple-tall`, -5, -3),
          s(`${RUINS}column-temple-tall`, 7, -3),
          s(`${RUINS}column-temple-broken`, -2, -2),
          s(`${RUINS}column-temple-broken`, 3, -2),
          s(`${VOLCANO}steam-vent`, 0, -1),
          s(`${VOLCANO}steam-vent`, 5, -1),
          s(`${VOLCANO}steam-vent`, 2, 1),
          s(`${VOLCANO}bones`, -1, 1),
          s(`${RUINS}fallen-column-temple`, 3, 1),
          s(`${RUINS}rubble-temple`, -3, 1),
          s(`${SWAMP}pilings`, -1, -4),
          s(`${SWAMP}pilings`, 4, -5),
          s(`${RUINS}mosaic-medallion-5x5`, 8, -2),
          s(`${RUINS}column-temple-broken`, 13, -2),
          s(`${RUINS}fallen-column-temple`, 9, 3),
          s("bd-pick-castle-catacombs-altar-stone", 9, -5),
          s(`${RUINS}face-temple-3h`, -6, -11),
          s("bd-pick-deep-forest-path-ruin-gate", -3, -11),
          s(`${RUINS}roof-naiskos-pediment`, 2, -11),
          s(`${RUINS}face-temple-2h`, 7, -11),
          s(`${RUINS}face-temple-3h`, 10, -11),
          s("bd-pick-aqueduct-sewer-altar-cult", 3, -7),
          s("bd-prop-statue_sage", -6, -8),
          s(`${RUINS}column-temple-broken`, 0, -8),
          s(`${RUINS}column-temple-broken`, 7, -8),
          s(`${SWAMP}snag`, 11, -9),
          s(`${RUINS}ruined-wall-2`, -6, -2),
          s(`${RUINS}cypress-ruin`, -6, 2),
        ],
      };
    case "ruins_shrine":
      // 모자이크 메달리온(7×7) 위에 이벤트 칸, 북쪽에 소신전과 제단 닫집, 둘레에 기둥·잔해.
      return {
        ground: { material: "버들항 광장 판석", rx: 9, ry: 7 },
        fills: [],
        stamps: [
          s(`${RUINS}mosaic-medallion-7x7`, -3, -3),
          s(`${RUINS}cypress-ruin`, -8, -6),
          s(`${RUINS}cypress-ruin`, 8, -5),
          s(`${RUINS}vines-2`, -4, -9),
          s(`${RUINS}vines-2`, 3, -9),
          s(`${RUINS}roof-naiskos-pediment`, -2, -9),
          s(`${RUINS}column-temple-tall`, -6, -4),
          s(`${RUINS}column-temple-tall`, 6, -4),
          s(`${RUINS}column-temple-broken`, -6, 3),
          s(`${RUINS}column-temple-broken`, 6, 3),
          s(`${RUINS}fallen-column-temple`, -9, 5),
          s(`${RUINS}rubble-temple`, 4, 5),
          s(`${VOLCANO}brazier`, -5, -2),
          s(`${VOLCANO}brazier`, 5, -2),
          s(`${RUINS}ruined-wall-2`, 8, 0),
          s("bd-prop-sword_barrel", 0, -1),
        ],
      };
  }
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
  return [...new Set(layoutFor(theme).stamps.map((st) => KIT + st.id))];
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

      const layout = layoutFor(theme);
      const fill = toolByName(CONSTRUCTION_TOOLS_V3, "fill_region");
      const stamp = toolByName(SHARED_OBJECT_TOOLS, "stamp_object");
      const warnings: string[] = [];
      const built: string[] = [];

      const g = layout.ground;
      const ground = snapToMapEdge(map, clampRect(map, x - g.rx, y - g.ry, g.rx * 2 + 1, g.ry * 2 + 1));
      for (const r of roundedParts(map, ground)) fill.run(project, { mapId, rect: r, material: g.material, clearUpper: true });
      built.push(`바닥 ${g.material} ${ground.w}×${ground.h}`);
      if (layout.floorKit && tileKit(project, map, layout.floorKit, ground, x, y) > 0) built.push(`바닥 무늬 ${layout.floorKit.replace("bd-pick-", "")}`);
      for (const p of layout.pads ?? []) tileKit(project, map, p.kit, { x: x + p.dx, y: y + p.dy, w: p.w, h: p.h }, x, y);

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

      // 불규칙 몸체(용암·물) — 칸 단위로 칠하고 둘레에 흑요석·불씨를 둘러 직각 가장자리를 가린다.
      const bodyDecor: { id: string; x: number; y: number }[] = [];
      const bridgeBox = (cx: number, cy: number) => theme === "lava_bridge" && Math.abs(cx - x) <= 1 && cy >= y - 3 && cy <= y + 3;
      const walk = layout.walk ? walkCells(x, y, layout.walk) : [];
      const onWalk = (cx: number, cy: number) => walk.some((c) => c.x === cx && c.y === cy);
      const free = (cx: number, cy: number) => !((cx === x && cy === y) || (cx === x - 1 && cy === y)) && !bridgeBox(cx, cy) && !onWalk(cx, cy);
      const lavaOf: { cells: { x: number; y: number }[]; rim: number }[] = theme === "lava_bridge"
        ? [{ cells: lavaBandCells(map, x, y), rim: 0.28 }]
        : [
          ...(layout.bodies ?? []).filter((b) => b.kind === "lava").map((b) => ({ cells: bodyCells(map, x, y, b, free), rim: 0.5 })),
          ...(layout.fissures ?? []).map((f) => ({ cells: fissureCells(map, x, y, f, free), rim: 0.12 })),
        ];
      for (const { cells, rim } of lavaOf) {
        for (const c of cells) setLayerTileAt(map, 1, c.y * map.width + c.x, LAVA_TILES[c.y % 2]![c.x % 2]!);
        for (const c of cells) for (let l = 2; l <= 3; l++) setLayerTileAt(map, l as 2 | 3, c.y * map.width + c.x, -1);
        applyBankOverlay(project, map, cells, BEODEUL_NATURE.bankLava);
        if (theme === "lava_bridge") for (const c of cells) if (bridgeBox(c.x, c.y)) setLayerTileAt(map, 2, c.y * map.width + c.x, -1);
        bodyDecor.push(...rimStamps(map, cells, free, 41, rim));
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
      let stamped = 0;
      const occupied = new Set<number>();
      const kitList = project.tilesets.beodeul_city?.structureKits ?? [];
      const mark = (id: string, px: number, py: number) => {
        const k = kitList.find((q) => q.id === id.replace(KIT, ""));
        for (let dy = 0; dy < (k?.height ?? 1); dy++) for (let dx = 0; dx < (k?.width ?? 1); dx++) occupied.add((py + dy) * map.width + px + dx);
      };
      const waterOrLava = new Set<number>();
      for (const { cells } of lavaOf) for (const c of cells) waterOrLava.add(c.y * map.width + c.x);
      for (const b of (layout.bodies ?? []).filter((q) => q.kind === "water")) for (const c of bodyCells(map, x, y, b, free)) waterOrLava.add(c.y * map.width + c.x);
      for (const d of bodyDecor) {
        try { stamp.run(project, { objectId: KIT + d.id, mapId, x: d.x, y: d.y }); stamped++; mark(d.id, d.x, d.y); } catch { /* 맵 밖·충돌 칸은 건너뛴다 */ }
      }
      for (const st of layout.stamps) {
        try {
          stamp.run(project, { objectId: KIT + st.id, mapId, x: x + st.dx, y: y + st.dy });
          mark(st.id, x + st.dx, y + st.dy);
          stamped++;
        } catch (error) {
          warnings.push(`${st.id} (${x + st.dx},${y + st.dy}) 건너뜀: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
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
      const scatterBlocked = (cx: number, cy: number) => waterOrLava.has(cy * map.width + cx) || !free(cx, cy);
      let scattered = 0;
      for (const d of scatterStamps(project, map, theme, ground, occupied, scatterBlocked)) {
        try { stamp.run(project, { objectId: d.id, mapId, x: d.x, y: d.y }); scattered++; } catch { /* 건너뜀 */ }
      }
      built.push(`키트 ${stamped}/${layout.stamps.length}개 · 흩뿌린 소품 ${scattered}개`);

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
      return {
        summary: `무대 ${theme} → ${mapId} 이벤트 칸 (${x},${y}) 둘레: ${built.join(" · ")}. 이제 show_map_region 으로 확인하고 (${x},${y}) 에 이벤트를 만든다 — 시작 칸 (${x - 1},${y}) 은 막혀 있지 않다.${collapse ? ` 다리 붕괴 연출은 사망 분기에서 data.collapse.cells ${collapse.cells.length}칸에 changeTile{mapId,layer:"upper",x,y,tile} 을 적용한다(다리 그림이 상단 층이라 반드시 layer "upper" — 하단은 이미 용암이라 바꿔도 화면이 그대로다). 붕괴 직후 한 번 더 화면을 붉게 번쩍이면 틈이 눈에 띈다.` : ""}${survivalWalk ? ` 생존(무사 통과) 분기는 제자리에 세워 두지 말고 moveActor{target:"player",moves:data.survivalWalk.moves} 로 (${survivalWalk.end.x},${survivalWalk.end.y}) 까지 ${walk.length}칸 걸어 위험 구역을 건너게 하고, 걷는 동안 tint 를 원래대로·weather none 으로 거둔다.` : ""}`,
        data: { theme, mapId, focus: { x, y }, start: { x: x - 1, y }, ground, stamped, total: layout.stamps.length, ...(collapse ? { collapse } : {}), ...(survivalWalk ? { survivalWalk } : {}) },
        ...(warnings.length ? { warnings } : {}),
      };
    },
  },
];
