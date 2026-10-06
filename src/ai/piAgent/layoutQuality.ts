import { tileAt } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";
import { checkTownMap } from "@/editor/tools/packTownTools";
import { isPackPresetTileset, lintPackMap } from "@/project/rpgmakerMv/packMapLint";

// 조수가 칠한 맵의 배치 품질(빈 바닥·빈 정사각형·좌우 대칭)을 끝에서 한 번 잰다.
// 문서·예제만으로는 전체 배치가 옮겨지지 않았다(2026-09-25 Rasak 시험: 문서를 세 번 고쳐도 마을 빈 바닥 44%,
// 제작자 맵 0~27%). 그래서 끝났다고 할 때 숫자와 좌표를 돌려주고 한 번 더 채우게 한다.
// 거부·되돌리기는 하지 않는다 — 수리 프롬프트 한 번뿐인 권고다(게이트를 늘리지 않는다 — openwiki/teaching-assistant-tilesets.md).
//
// 정의는 scripts/content/rasak/check_examples.py 와 같다. 바닥은 1층 통행 가능 + 3층 빈 칸(벽·지붕·물·천장은 막힘이라 빠진다).
//   빈 바닥 %   = 바닥 칸 중 3×3 이웃에 2·3·4층이 하나도 없는 칸의 비율
//   빈 정사각형 = 2·3·4층이 없는 바닥으로만 된 가장 큰 정사각형 한 변
//   대칭 배수   = 3층 칸 중 좌우 거울 칸도 3층인 비율 ÷ 3층 밀도(우연이면 1)
// 한도는 제작자 맵(Rasak 프리뷰 p01·p02·p27a·p28, 0~27% / 2~5 / 1.0~2.0)에서 잰 값이다.
export const LAYOUT_QUALITY_LIMITS = { empty: 30, square: 5, mirror: 2.2 } as const;

/** 수리 대상으로 볼 최소 규모 — 몇 칸 고친 편집이나 작은 맵에는 묻지 않는다. */
const MIN_CELLS = 150;
const MIN_FLOOR = 40;
const MIN_PAINTED_SHARE = 0.25;
const MIN_OBJECTS_FOR_MIRROR = 12;
const WINDOW = 6;

export interface LayoutQualityStats {
  readonly empty: number;
  readonly square: number;
  readonly mirror: number;
  readonly floorCells: number;
  readonly squareAt?: { readonly x: number; readonly y: number };
  /** 빈 바닥이 가장 많은 6×6 창(겹치지 않게 최대 3개). */
  readonly emptiestWindows: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly emptyCells: number }[];
}

export interface LayoutQualityIssue {
  readonly mapId: string;
  /** 팩 세트 맵(pack)은 빈 바닥 비율을 재지 않는다 — null. */
  readonly stats: LayoutQualityStats | null;
  readonly problems: readonly string[];
  /** 마을 짜임이 없는 팩 프리셋 맵(REFMAP 세트 등)이면 check_pack_map 경고(구조·통행·벽걸이·빈 공간). */
  readonly pack?: readonly string[];
  /** 팩 도시 타일셋 맵이면 check_town_map 의 좌표 달린 항목(거부 위반 먼저). */
  readonly town?: readonly string[];
}

/** 마을 짜임 재료가 있는 팩 타일셋 맵이면 check_town_map 결과를, 아니면 빈 배열. */
function packTownProblems(project: Project, map: GameMap): string[] {
  const presetId = project.tilesets[map.tilesetId]?.mvPack?.presetId;
  if (!MV_PACK_PRESETS.some((preset) => preset.id === presetId && preset.town)) return [];
  return [...checkTownMap(project, map).issues];
}

export function measureLayoutQuality(project: Project, map: GameMap): LayoutQualityStats | null {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return null;
  // Kit terrain includes forests, relief and roads in its actual lower material tiles.
  // Generated props now live separately in upperTiles; a village density metric still doesn't describe a continent.
  if (map.worldmapSource?.tilemap?.version === 1 && tileset.family === 'worldmap-kit') return null;
  // The world kit bakes trees, buildings and roads into one image cell per map cell.
  // Counting only upper layers calls that authored scenery empty and asks the model to cover it.
  if (map.worldmapSource && tileset.image.type === 'uploaded' && tileset.tileSize === 16
    && tileset.tilesPerRow === map.width && tileset.count >= map.width * map.height
    && map.lowerTiles.every((tile, index) => tile === index)) return null;
  const { width: w, height: h } = map;
  const n = w * h;
  const floor = new Uint8Array(n);
  const occ = new Uint8Array(n);
  const upper = new Uint8Array(n);
  let objects = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const { lower, upper: l3, layers } = tileAt(map, x, y);
      const pass = lower >= 0 ? tileset.passability[lower] : undefined;
      const walkable = !!pass && (pass.up || pass.down || pass.left || pass.right);
      if (l3 >= 0) { upper[i] = 1; objects++; }
      occ[i] = layers[1] >= 0 || l3 >= 0 || layers[3] >= 0 ? 1 : 0;
      floor[i] = walkable && l3 < 0 ? 1 : 0;
    }
  }
  const lonely = new Uint8Array(n);
  let floorCells = 0;
  let lonelyCells = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!floor[i]) continue;
      floorCells++;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && occ[ny * w + nx]) { near = true; break; }
        }
      }
      if (!near) { lonely[i] = 1; lonelyCells++; }
    }
  }
  // 가장 큰 빈 정사각형(오른아래 모서리 기준 DP).
  let square = 0;
  let squareAt: { x: number; y: number } | undefined;
  const dp = new Uint16Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!floor[i] || occ[i]) continue;
      const k = (y + 1) * (w + 1) + x + 1;
      dp[k] = Math.min(dp[k - (w + 1)]!, dp[k - 1]!, dp[k - (w + 1) - 1]!) + 1;
      if (dp[k]! > square) { square = dp[k]!; squareAt = { x: x - square + 1, y: y - square + 1 }; }
    }
  }
  let mirror = 0;
  if (objects >= MIN_OBJECTS_FOR_MIRROR) {
    let minX = w, maxX = -1;
    for (let i = 0; i < n; i++) if (upper[i]) { const x = i % w; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const axis = minX + maxX;
    let twins = 0;
    for (let i = 0; i < n; i++) {
      if (!upper[i]) continue;
      const x = i % w, y = (i - x) / w, mx = axis - x;
      if (mx !== x && mx >= 0 && mx < w && upper[y * w + mx]) twins++;
    }
    mirror = Math.round((twins / objects) / (objects / n) * 10) / 10;
  }
  return {
    empty: floorCells ? Math.round(100 * lonelyCells / floorCells) : 0,
    square,
    mirror,
    floorCells,
    ...(squareAt ? { squareAt } : {}),
    emptiestWindows: emptiestWindows(lonely, w, h),
  };
}

function emptiestWindows(lonely: Uint8Array, w: number, h: number) {
  const ww = Math.min(WINDOW, w), wh = Math.min(WINDOW, h);
  const candidates: { x: number; y: number; w: number; h: number; emptyCells: number }[] = [];
  for (let y = 0; y + wh <= h; y += 2) {
    for (let x = 0; x + ww <= w; x += 2) {
      let count = 0;
      for (let dy = 0; dy < wh; dy++) for (let dx = 0; dx < ww; dx++) count += lonely[(y + dy) * w + x + dx]!;
      if (count >= (ww * wh) / 2) candidates.push({ x, y, w: ww, h: wh, emptyCells: count });
    }
  }
  candidates.sort((a, b) => b.emptyCells - a.emptyCells || a.y - b.y || a.x - b.x);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length >= 3) break;
    if (picked.every(p => c.x + c.w <= p.x || p.x + p.w <= c.x || c.y + c.h <= p.y || p.y + p.h <= c.y)) picked.push(c);
  }
  return picked;
}

function layoutProblems(stats: LayoutQualityStats): string[] {
  const lim = LAYOUT_QUALITY_LIMITS;
  const problems: string[] = [];
  if (stats.empty > lim.empty) problems.push(`빈 바닥 ${stats.empty}% (기준 ≤${lim.empty}%)`);
  if (stats.square > lim.square) problems.push(`소품 없는 빈 정사각형 ${stats.square}×${stats.square}칸${stats.squareAt ? ` (왼위 ${stats.squareAt.x},${stats.squareAt.y})` : ""} (기준 ≤${lim.square})`);
  if (stats.mirror > lim.mirror) problems.push(`좌우 대칭 ${stats.mirror}배 (기준 ≤${lim.mirror}, 우연이면 1)`);
  return problems;
}

/** 이번 실행이 1층을 크게 칠한 맵(새 맵 포함)만 본다. 작은 수정·이미 있던 맵의 소품 추가는 묻지 않는다. */
function paintedShare(map: GameMap, before: GameMap | undefined): number {
  const n = map.width * map.height;
  if (!before || before.width !== map.width || before.height !== map.height) return 1;
  let changed = 0;
  for (let i = 0; i < n; i++) if (map.lowerTiles[i] !== before.lowerTiles[i]) changed++;
  return changed / n;
}

/**
 * 마을 짜임이 없는 팩 프리셋 맵이면 check_pack_map 경고, 아니면 null. 이런 맵은 빈 바닥 비율·빈 정사각형으로 재지 않는다 —
 * 「비었으니 채워라」는 세트 규칙(공간이 남으면 방이 너무 큰 것)과 반대다. 2026-09-28 시험: 그 권고를 받은 조수가
 * 어부 집 한가운데에 5×5 초록 러그를 깔았다.
 */
function packMapProblems(project: Project, map: GameMap): string[] | null {
  const tileset = project.tilesets[map.tilesetId];
  if (!isPackPresetTileset(tileset) || MV_PACK_PRESETS.some((preset) => preset.id === tileset?.mvPack?.presetId && preset.town)) return null;
  return [...(lintPackMap(project, map)?.warnings ?? [])];
}

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
function mapChanged(map: GameMap, before: GameMap | undefined): boolean {
  if (!before || before.width !== map.width || before.height !== map.height) return true;
  return LAYERS.some((layer) => (map[layer] ?? []).some((tile, i) => tile !== (before[layer]?.[i] ?? -1)));
}

export function inspectPiLayoutQuality(project: Project, baseline: Project, scopeMapIds: readonly string[] | undefined,
  skipMapIds: Iterable<string> = []): LayoutQualityIssue[] {
  const skip = new Set(skipMapIds);
  const ids = scopeMapIds?.length
    ? [...new Set([...scopeMapIds, ...Object.keys(project.maps).filter(id => !baseline.maps[id])])]
    : Object.keys(project.maps);
  const issues: LayoutQualityIssue[] = [];
  for (const mapId of ids) {
    const map = project.maps[mapId];
    if (!map || skip.has(mapId)) continue;
    // 팩 세트 맵은 작은 집(9×9)도 본다 — 이번 실행이 칸을 바꿨으면.
    const pack = packMapProblems(project, map);
    if (pack) {
      if (pack.length && mapChanged(map, baseline.maps[mapId])) issues.push({ mapId, stats: null, problems: [], pack });
      continue;
    }
    if (map.width * map.height < MIN_CELLS) continue;
    if (paintedShare(map, baseline.maps[mapId]) < MIN_PAINTED_SHARE) continue;
    const stats = measureLayoutQuality(project, map);
    if (!stats || stats.floorCells < MIN_FLOOR) continue;
    const problems = layoutProblems(stats);
    const town = packTownProblems(project, map);
    if (problems.length || town.length) issues.push({ mapId, stats, problems, ...(town.length ? { town } : {}) });
  }
  return issues;
}

export function piLayoutRepairPrompt(issues: readonly LayoutQualityIssue[]): string {
  const packIssues = issues.filter(issue => issue.pack?.length);
  if (packIssues.length === issues.length) return piPackRepairPrompt(packIssues);
  const lines = issues.filter(issue => !issue.pack).map(issue => {
    const windows = (issue.stats?.emptiestWindows ?? []).map(r => `(${r.x},${r.y}) ${r.w}×${r.h}칸 중 빈 칸 ${r.emptyCells}`).join(" · ");
    const head = issue.problems.length ? `- ${issue.mapId}: ${issue.problems.join(" / ")}${windows ? `. 가장 빈 곳: ${windows}` : ""}` : `- ${issue.mapId}:`;
    const town = issue.town?.length
      ? `\n  도시 점검(check_town_map, [거부] 는 도구가 실패로 돌려주는 확실한 위반 — 먼저 고친다):\n` + issue.town.map(line => `  · ${line}`).join("\n")
      : "";
    return head + town;
  });
  return "[배치 품질 검사] 칠한 맵이 제작자 예제 기준보다 비어 있거나 좌우 대칭이다. 끝내기 전에 한 번 고쳐라.\n"
    + lines.join("\n") + "\n"
    + "고치는 법: 먼저 show_map_region 으로 위 좌표를 본다. 그 자리에 무엇이 있을 곳인지(집 마당·밭·숲 가장자리·방의 용도)를 정하고 "
    + "그 용도에 맞는 덩이(가구 한 벌, 집 곁 생활 소품 묶음, 나무 2~3그루+덤불, 바닥 장식 2층)를 놓는다. "
    + "1×1 소품·바닥 얼룩·풀 한 칸을 고르게 흩뿌리지 마라 — 숫자만 맞추는 흩뿌림은 빈 바닥보다 나쁘다. 좌우 대칭이면 한쪽 덩이를 옮기거나 바꿔 비대칭으로 만든다. "
    + "길·문 앞·통로는 막지 않는다. 사용자가 넓은 빈터를 요청했다면 고치지 말고 그 이유를 보고에 적는다."
    + (issues.some(issue => issue.town?.length) ? " 도시 맵은 고친 뒤 check_town_map 이 실패 없이 돌아올 때까지 다시 부른다." : "")
    + (packIssues.length ? "\n" + piPackRepairPrompt(packIssues) : "");
}

/** 팩 세트 맵(REFMAP 등) 수리 권고 — check_pack_map 경고를 그대로 좌표와 함께 준다. */
export function piPackRepairPrompt(issues: readonly LayoutQualityIssue[]): string {
  return "[세트 맵 검사 check_pack_map] 깐 맵이 세트 게시 기준(완성 장소 38곳이 모두 통과한 기준)을 못 넘었다. 끝내기 전에 고쳐라.\n"
    + issues.map(issue => `- ${issue.mapId}:\n` + (issue.pack ?? []).map(line => `  · ${line}`).join("\n")).join("\n") + "\n"
    + "고치는 법: show_map_region 으로 그 좌표를 먼저 본다. "
    + "「구조」는 천장 테 바로 밑에 벽면 2줄을 댄다(칸막이 천장 덩이도 그 밑 2줄 벽면). "
    + "「통행」은 입구(맵 가장자리로 이어진 바닥)에서 모든 방·가구 앞까지 한 칸 길을 낸다 — 침대는 긴 옆면 한쪽을 비우고, 입구가 없으면 남쪽 벽을 1~2칸 터서 바닥을 맵 끝까지 잇는다. "
    + "「벽걸이」는 창·액자·선반·시계를 벽면 줄로, 침대 머리·장·선반은 벽에 붙인다. "
    + "「공간」은 빈 바닥을 소품·러그로 메우지 말고 방·맵을 줄인다: 칸막이 천장 덩이로 알코브·ㄱ자 방을 만들거나 벽을 안쪽으로 옮기고, 맵이 크면 resize_map. "
    + "고친 뒤 check_pack_map 을 다시 불러 warnings 가 빌 때까지 반복한다.";
}
