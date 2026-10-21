import { roomSpecOf } from "@/editor/handInterior/builder";
import { tileAt } from "@/project/collision";
import { hasRelief } from "@/project/relief/walk";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { isComposedLayoutMap } from "@/project/mapNamedLocations";

// 조수가 칠한 맵의 배치 품질(빈 바닥·빈 정사각형·좌우 대칭)을 끝에서 한 번 잰다.
// 문서·예제만으로는 전체 배치가 옮겨지지 않았다(2026-09-25 Rasak 시험: 문서를 세 번 고쳐도 마을 빈 바닥 44%,
// 제작자 맵 0~27%). 그래서 끝났다고 할 때 숫자와 좌표를 돌려주고 한 번 더 채우게 한다.
// 거부·되돌리기는 하지 않는다 — 수리 프롬프트 한 번뿐인 권고다(게이트를 늘리지 않는다 — openwiki/teaching-assistant-tilesets.md).
//
// 정의는 옛 Rasak 예제 검사(check_examples.py, 2026-10-07 삭제)와 같다. 바닥은 1층 통행 가능 + 3층 빈 칸(벽·지붕·물·천장은 막힘이라 빠진다).
//   빈 바닥 %   = 바닥 칸 중 3×3 이웃에 2·3·4층이 하나도 없는 칸의 비율
//   빈 정사각형 = 2·3·4층이 없는 바닥으로만 된 가장 큰 정사각형 한 변
//   대칭 배수   = 3층 칸 중 좌우 거울 칸도 3층인 비율 ÷ 3층 밀도(우연이면 1)
// 한도는 제작자 맵(Rasak 프리뷰 p01·p02·p27a·p28, 0~27% / 2~5 / 1.0~2.0)에서 잰 값이다.
export const LAYOUT_QUALITY_LIMITS = { empty: 30, square: 5, mirror: 2.2 } as const;
/**
 * 트인 땅이 의도인 맵 — 바닥(통행 칸)의 절반 이상이 모래·눈 재질. 2026-10-11 실제 입력창 검수: 사막 마을 2건 모두 위 기준에 걸려
 * 억지 수리를 했고, 그 수리에서 키트가 두 단에 걸쳤으며, 수리 뒤에도 기준 미달이었다. 마을 도구(beodeulVillage.ts openLand)는
 * 사막·설원에 빈 덩이를 90칸(≈ 9×9)까지, 화면당 빈 바닥 74%까지 일부러 남긴다(풀밭은 14칸·58%). 그 의도 상한에 맞춘 값이다 —
 * 같은 시드 3·7·11 실측: 사막·설원 빈 바닥 27~42%, 빈 정사각형 7~9 / 풀밭 1~6%, 3~5.
 */
export const OPEN_LAND_LAYOUT_LIMITS = { empty: 45, square: 9, mirror: 2.2 } as const;
/** 트인 땅 재질 — 칸 이름표·설명(tileMeta.label/description). 길 태그(road) 칸은 세지 않는다(풀밭 마을의 모랫길). */
const OPEN_GROUND = /모래|사막|sand|desert|눈 ?바닥|고원 ?눈|눈밭|설원|snow/i;
const OPEN_LAND_SHARE = 0.5;

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
  /** 바닥 칸 중 모래·눈 재질 비율(%). */
  readonly openGround: number;
  /** 트인 땅 기준(OPEN_LAND_LAYOUT_LIMITS)으로 재는 맵인가 — openGround ≥ 50%. */
  readonly openLand: boolean;
  readonly squareAt?: { readonly x: number; readonly y: number };
  /** 빈 바닥이 가장 많은 6×6 창(겹치지 않게 최대 3개). */
  readonly emptiestWindows: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly emptyCells: number }[];
}

export interface LayoutQualityIssue {
  readonly mapId: string;
  readonly stats: LayoutQualityStats;
  readonly problems: readonly string[];
  /** 방 짓기 역할표 칩셋으로 지은 실내(build_hand_interior_room) — 빈 바닥은 메우지 말고 방을 줄인다. */
  readonly interior?: boolean;
  /** 높이 단(map.relief)이 있는 맵 — 수리할 때 단 경계를 지켜야 한다(stamp_object 높이 규칙). */
  readonly relief?: boolean;
}

function openGroundTile(tileset: TilesetDef, tile: number, cache: Map<number, boolean>): boolean {
  let hit = cache.get(tile);
  if (hit === undefined) {
    const meta = tileset.tileMeta?.[tile];
    hit = !!meta && !(meta.tags ?? []).includes("road") && OPEN_GROUND.test(`${meta.label ?? ""} ${meta.description ?? ""}`);
    cache.set(tile, hit);
  }
  return hit;
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
  let walkCells = 0, openGroundCells = 0;
  const groundCache = new Map<number, boolean>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const { lower, upper: l3, layers } = tileAt(map, x, y);
      const pass = lower >= 0 ? tileset.passability[lower] : undefined;
      const walkable = !!pass && (pass.up || pass.down || pass.left || pass.right);
      if (l3 >= 0) { upper[i] = 1; objects++; }
      occ[i] = layers[1] >= 0 || l3 >= 0 || layers[3] >= 0 ? 1 : 0;
      floor[i] = walkable && l3 < 0 ? 1 : 0;
      if (walkable) { walkCells++; if (openGroundTile(tileset, lower, groundCache)) openGroundCells++; }
    }
  }
  const openGround = walkCells ? Math.round(100 * openGroundCells / walkCells) : 0;
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
    openGround,
    openLand: openGround >= OPEN_LAND_SHARE * 100,
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

export function layoutQualityLimits(stats: Pick<LayoutQualityStats, "openLand">) {
  return stats.openLand ? OPEN_LAND_LAYOUT_LIMITS : LAYOUT_QUALITY_LIMITS;
}

function layoutProblems(stats: LayoutQualityStats): string[] {
  const lim = layoutQualityLimits(stats);
  const open = stats.openLand ? `, 트인 땅 기준 — 모래·눈 바닥 ${stats.openGround}%` : "";
  const problems: string[] = [];
  if (stats.empty > lim.empty) problems.push(`빈 바닥 ${stats.empty}% (기준 ≤${lim.empty}%${open})`);
  if (stats.square > lim.square) problems.push(`소품 없는 빈 정사각형 ${stats.square}×${stats.square}칸${stats.squareAt ? ` (왼위 ${stats.squareAt.x},${stats.squareAt.y})` : ""} (기준 ≤${lim.square}${open})`);
  if (stats.mirror > lim.mirror) problems.push(`좌우 대칭 ${stats.mirror}배 (기준 ≤${lim.mirror}, 우연이면 1)`);
  return problems;
}

/**
 * 이번 실행이 1층을 크게 칠한 맵(새 맵 포함)만 본다. 작은 수정·이미 있던 맵의 소품 추가는 묻지 않는다.
 * 빈 칸으로 «비운» 칸은 칠한 것으로 세지 않는다 — 맵 배경(파노라마)이 비칠 하늘·바다 자리를 비우는 일(clearForBackground)이다.
 * 2026-10-22 조수 시험: 「옥상 뒤에 노을 하늘」 요청에서 위 7줄을 비우자 이 검사가 원래부터 빈 옥상 바닥을 「빈 바닥 50%」로 잡아
 * 조수가 사용자가 청하지 않은 벤치·가로등 11개를 깔았다.
 */
function paintedShare(map: GameMap, before: GameMap | undefined): number {
  const n = map.width * map.height;
  if (!before || before.width !== map.width || before.height !== map.height) return 1;
  let changed = 0;
  for (let i = 0; i < n; i++) if (map.lowerTiles[i] !== before.lowerTiles[i] && (map.lowerTiles[i] ?? -1) >= 0) changed++;
  return changed / n;
}

// 구성기(compose_* 도구·layout 방 짓기)가 «구역마다 쓰임»을 정해 깐 맵 — 판정은 isComposedLayoutMap(mapNamedLocations.ts, 표식 composed-layout) 하나다.
// 이 검사가 내는 권고는 전부 «빈 땅 채우기·대칭 깨기»(빈 바닥·빈 정사각형·좌우 대칭)뿐이다. 구성기 맵은 차도·선로·승강장·광장 동선·복도의 빈칸이
// 용도로 비운 칸이라, 이 권고가 조수에게 석탄 통·드론 패드·광고판을 구성기 맵 한가운데에 흩뿌리게 했다(2026-10-14 steampunk_city·sf_station 실조수).
// 그래서 구성기 맵은 이 검사 전체를 건너뛴다. 문에 닿지 않는 길·겹침 같은 실제 결함은 이 검사의 몫이 아니다 —
// 구성기 도구 자신의 검증(접근칸 도달·문 틈 통행 → compose-failed)과 맵 구조 lint 가 따로 막는다.
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
    if (map.width * map.height < MIN_CELLS) continue;
    if (isComposedLayoutMap(map)) continue;
    if (paintedShare(map, baseline.maps[mapId]) < MIN_PAINTED_SHARE) continue;
    const stats = measureLayoutQuality(project, map);
    if (!stats || stats.floorCells < MIN_FLOOR) continue;
    const problems = layoutProblems(stats);
    const relief = map.relief;
    const hasRamp = relief?.ramps?.some((v) => v >= 1 && v <= 8) ?? false;
    if (problems.length) issues.push({ mapId, stats, problems, ...(roomSpecOf(project.tilesets[map.tilesetId]) ? { interior: true } : {}),
      ...(relief && (hasRelief(relief) || hasRamp) ? { relief: true } : {}) });
  }
  return issues;
}

/** 높이 단이 있는 맵의 수리 규칙(2026-10-11 — 사막 오아시스 수리에서 돗자리 3×2 가 0단·1단에 걸쳐 절벽 띠에 잘렸다). */
const RELIEF_REPAIR_RULE = "높이 단 경계를 지켜라: 이 맵에는 높이 단(절벽·경사로)이 있다. 키트는 한 단 위에만 놓는다 — 그림 칸이 두 단에 걸치면 절벽 띠가 그림을 가른다. "
  + "경사로·계단 칸과 절벽 바로 위·아래 칸에는 놓지 말고, 바로 남쪽이 더 높은 칸(3/4 시점에서 아랫줄이 덮인다)도 피한다. "
  + "stamp_object 가 「높이 규칙」으로 거절하면 같은 자리를 다시 보내지 말고 거절 문구의 대안 자리로 옮기거나 그 자리를 비워 둔다.";
/** 보고 정직성 — 조수의 완료 선언은 근거가 아니다. 다시 잰 숫자는 실행기가 알려 준다. */
const HONEST_REPORT_RULE = "끝 보고에는 고친 곳과 고치지 않고 남긴 곳을 그대로 적는다. 고친 뒤 숫자는 실행기가 다시 잰다 — 「기준 통과」「이상 없음」을 스스로 단정하지 마라.";

export function piLayoutRepairPrompt(issues: readonly LayoutQualityIssue[]): string {
  const reliefRule = issues.some((i) => i.relief) ? `\n${RELIEF_REPAIR_RULE}` : "";
  // 실내는 「채워라」가 아니라 「줄여라」 — 2026-10-08 조수 시험: 24×18 상자 집에 빈 바닥 경고를 받자 서재 코너·화분을 흩뿌려 채웠다.
  if (issues.length && issues.every((i) => i.interior)) {
    return "[배치 품질 검사] 지은 실내가 비어 있다 — 가구를 흩뿌려 메우지 마라. 빈 바닥은 방이 너무 크다는 뜻이다.\n"
      + issues.map((i) => `- ${i.mapId}: ${i.problems.join(" / ")}`).join("\n") + "\n"
      + "고치는 법: build_hand_interior_room 을 같은 mapId·replace:true 로 다시 부르며 layout(방 구성 — program 또는 rooms 의 방 종류)을 준다. "
      + "도구가 방마다 알맞은 크기로 배치를 짜고 제작자 예제 방의 가구 한 벌을 심는다. 이미 layout 으로 지었다면 방 수를 줄이거나 layout.rooms 의 w·h 를 줄인다. "
      + "한 방만 비었다면 그 방 종류에 맞는 가구 한 벌(list_hand_interior_parts room)을 벽을 따라 놓는다. 사용자가 넓은 빈 방(무도회장 등)을 요청했다면 고치지 말고 그 이유를 보고에 적는다. "
      // 거리와 실내를 한 칩셋으로 까는 번들(modern_city·jp_city)은 거리 맵도 여기로 온다 — 2026-10-14 실조수가 이 문장을 따라 도쿄풍 거리 60×48 을 로비 10×8 로 덮었다.
      + "그 맵이 실내가 아니라 거리·야외(도로·보도·건물 외형 키트가 깔린 맵)면 build_hand_interior_room 을 부르지 마라 — 맵 전체가 실내로 바뀐다. 고치지 말고 「거리 맵이라 실내 기준이 맞지 않음」이라고 보고에 적는다."
      + reliefRule + "\n" + HONEST_REPORT_RULE;
  }
  const lines = issues.map(issue => {
    const windows = issue.stats.emptiestWindows.map(r => `(${r.x},${r.y}) ${r.w}×${r.h}칸 중 빈 칸 ${r.emptyCells}`).join(" · ");
    return `- ${issue.mapId}: ${issue.problems.join(" / ")}${windows ? `. 가장 빈 곳: ${windows}` : ""}`;
  });
  const openLand = issues.some((i) => i.stats.openLand)
    ? `\n트인 땅 기준으로 잰 맵(바닥 대부분이 모래·눈 — 빈 바닥 ≤${OPEN_LAND_LAYOUT_LIMITS.empty}%, 빈 정사각형 ≤${OPEN_LAND_LAYOUT_LIMITS.square})은 드문드문한 땅 자체가 의도다. 기준을 넘는 큰 빈터에만 덩이 하나를 놓고, 풀밭 마을처럼 빽빽하게 채우지 마라.`
    : "";
  return "[배치 품질 검사] 칠한 맵이 제작자 예제 기준보다 비어 있거나 좌우 대칭이다. 끝내기 전에 한 번 고쳐라.\n"
    + lines.join("\n") + "\n"
    + "고치는 법: 먼저 show_map_region 으로 위 좌표를 본다. 그 자리에 무엇이 있을 곳인지(집 마당·밭·숲 가장자리·방의 용도)를 정하고 "
    + "그 용도에 맞는 덩이(가구 한 벌, 집 곁 생활 소품 묶음, 나무 2~3그루+덤불, 바닥 장식 2층)를 놓는다. "
    + "1×1 소품·바닥 얼룩·풀 한 칸을 고르게 흩뿌리지 마라 — 숫자만 맞추는 흩뿌림은 빈 바닥보다 나쁘다. 좌우 대칭이면 한쪽 덩이를 옮기거나 바꿔 비대칭으로 만든다. "
    + "길·문 앞·통로는 막지 않는다. 사용자가 넓은 빈터를 요청했다면 고치지 말고 그 이유를 보고에 적는다."
    + openLand + reliefRule + "\n" + HONEST_REPORT_RULE;
}

/**
 * 수리 뒤 다시 쟀는데도 기준 미달일 때 한 번 보내는 보고 지시(2026-10-11 실제 입력창 검수: 사막 2건이 수리 뒤에도 미달이었는데
 * 조수는 「이상 없음」만 보고했다 — 다시 잰 숫자를 조수가 몰랐다). 더 고치게 하지 않는다(권고는 한 번뿐) — 사실대로 적게만 한다.
 */
export function piLayoutShortfallPrompt(issues: readonly LayoutQualityIssue[]): string {
  return "[배치 품질 재측정] 수리 뒤에 다시 쟀는데도 기준 미달이다:\n"
    + issues.map((i) => `- ${i.mapId}: ${i.problems.join(" / ")}`).join("\n") + "\n"
    + "더 고치지 마라(배치 권고는 한 번뿐이다). 사용자에게 줄 최종 보고에 이 미달을 숫자 그대로 적고, 남긴 이유(트인 땅이 의도·높이 규칙에 막힌 자리·요청한 빈터 등)를 한 줄로 밝혀라. "
    + "「이상 없음」「기준 통과」「모두 고쳤다」라고 쓰지 마라.";
}
