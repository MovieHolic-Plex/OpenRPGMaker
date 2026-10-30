// 타일 이식(tile graft) 공용 로직.
// 다른 번들 타일 그림판의 개별 타일을 현재 타일셋 아틀라스에 16×16 blit 으로 "부분 로딩"한다.
// 넘버링 보존 원칙: 기존 타일 id 는 절대 변하지 않는다 —
//   (a) targetTile < 원본 count → 기존 슬롯 덮어쓰기,
//   (b) targetTile >= 원본 count → 행 단위 확장(count 를 tilesPerRow 배수로 확장, 아틀라스가 세로로 자람).
// 렌더는 베이크(캔버스 합성): Phaser 텍스처는 ensureTilesetTexture(tilesetImage.ts /
// (export 번들은 vite alias 없이 실제 tilesetImage.ts 를 그대로 사용), DOM 미리보기는 tileGraftImageCache.ts 가 이 모듈을 공유한다.
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "./bundledChipsetGeometry";
import type { TileGraft, TilesetDef } from "@/project/types";

type GraftSource = HTMLImageElement | HTMLCanvasElement;

// 유효한 graft 만 남기고 targetTile 중복은 마지막 항목이 이긴다(덮어쓰기 의미론).
export function activeTileGrafts(tileset: Pick<TilesetDef, "tileGrafts">): TileGraft[] {
  const byTarget = new Map<number, TileGraft>();
  for (const graft of tileset.tileGrafts ?? []) {
    if (!isValidTileGraft(graft)) continue;
    byTarget.set(graft.targetTile, graft);
  }
  return [...byTarget.values()].sort((a, b) => a.targetTile - b.targetTile);
}

export function isValidTileGraft(graft: TileGraft | undefined | null): graft is TileGraft {
  return (
    !!graft &&
    Number.isInteger(graft.targetTile) &&
    graft.targetTile >= 0 &&
    Number.isInteger(graft.sourceTile) &&
    graft.sourceTile >= 0 &&
    typeof graft.sourceChipset === "string" &&
    graft.sourceChipset.length > 0
  );
}

// graft 구성에 따라 달라지는 텍스처 캐시 suffix. graft 가 없으면 빈 문자열.
// tilesetTextureKey 가 baseKey(+투명색 suffix) 뒤에 붙인다 — graft 편집 시 캐시 자동 무효화.
//
// 기억해 둔다. 이 값은 타일 한 칸을 그릴 때마다 불리는데(tilesetTextureKey), 기본 타일셋(forest_harmony)은
// 이식이 553개라 매번 정렬·이어 붙이기·해시를 다시 하면 칸당 약 0.18ms, 100×100 맵 한 번 그리기에 3초가
// 넘었다(Node 실측). 배열 정체성과 길이가 같으면 같은 답이다 — 이식을 바꾸는 코드는 배열을 새로 만들거나
// push 한다(길이가 바뀐다). 항목을 제자리에서 고치는 코드는 없다.
const graftSuffixCache = new WeakMap<readonly TileGraft[], { readonly length: number; readonly suffix: string }>();
export function tileGraftsTextureSuffix(tileset: Pick<TilesetDef, "tileGrafts">): string {
  const source = tileset.tileGrafts;
  if (!source || source.length === 0) return "";
  const cached = graftSuffixCache.get(source);
  if (cached && cached.length === source.length) return cached.suffix;
  const suffix = computeTileGraftsTextureSuffix(tileset);
  graftSuffixCache.set(source, { length: source.length, suffix });
  return suffix;
}

function computeTileGraftsTextureSuffix(tileset: Pick<TilesetDef, "tileGrafts">): string {
  const grafts = activeTileGrafts(tileset);
  if (grafts.length === 0) return "";
  const signature = grafts
    .map((graft) => `${graft.targetTile}:${graft.sourceChipset}:${graft.sourceTile}`)
    .join("|");
  return `__grafts_${hashString(signature)}`;
}

// minCount 이상이면서 tilesPerRow 의 배수인 최소 count(행 단위 확장 규칙).
export function rowAlignedTileCount(minCount: number, tilesPerRow: number): number {
  const columns = Math.max(1, Math.floor(tilesPerRow));
  return Math.ceil(Math.max(0, minCount) / columns) * columns;
}

// graft 를 포함해 타일셋이 실제로 필요로 하는 count (확장 모드 반영).
export function tileCountWithGrafts(
  tileset: Pick<TilesetDef, "count" | "tilesPerRow" | "tileGrafts">
): number {
  const grafts = activeTileGrafts(tileset);
  const maxTarget = grafts.reduce((max, graft) => Math.max(max, graft.targetTile), -1);
  return Math.max(tileset.count, rowAlignedTileCount(maxTarget + 1, tileset.tilesPerRow));
}

/**
 * 합성 계획 — 캔버스 크기, 소스 목록, 칸 하나당 9개 정수(소스 번호·원본 x,y,w,h·대상 x,y,w,h).
 * 메인 스레드 합성(createGraftedTilesetCanvas)과 워커 합성(tilesetBake.worker.ts)이 같은 계획을 같은 순서로 그린다:
 * 베이스를 (0,0)에 그리고, 칸마다 대상 칸을 지운 뒤 소스 칸을 그린다.
 */
export interface GraftedTilesetPlan<TSource> {
  readonly width: number;
  readonly height: number;
  /** 이식이 요구하는 최소 크기 — 베이스 크기를 모를 때(그림판 키만으로 세운 계획) 워커가 베이스 크기와 큰 쪽을 쓴다. */
  readonly minWidth: number;
  readonly minHeight: number;
  readonly base: TSource;
  readonly sources: readonly TSource[];
  /** sources 와 같은 순서의 그림판 키(워커가 그림을 주소로 받을 때 쓴다). */
  readonly sourceKeys: readonly string[];
  /** [sourceIndex, sx, sy, sw, sh, dx, dy, dw, dh] × 칸 수. */
  readonly ops: Int32Array;
}
export const GRAFT_PLAN_STRIDE = 9;

/** 계획 세우기를 몇 칸마다 쉬어 갈지(planGraftedTilesetSteps 가 이만큼마다 yield 한다). */
const PLAN_STEP_GRAFTS = 16;

// 베이스 이미지 위에 graft 타일들을 합성할 계획을 세운다.
// - 캔버스 크기: 베이스 크기와 count 가 요구하는 크기의 최대(확장 모드에서 세로로 자람).
// - resolveSourceImage: sourceChipset textureKey → 이미지(투명색 처리 완료본). 못 찾으면 해당 graft 는 건너뛰고 경고.
export function planGraftedTileset<TSource extends GraftSource | string>(
  tileset: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">,
  base: TSource,
  resolveSourceImage: (sourceChipset: string) => TSource | null
): GraftedTilesetPlan<TSource> {
  const steps = planGraftedTilesetSteps(tileset, base, resolveSourceImage);
  for (let step = steps.next(); ; step = steps.next()) if (step.done) return step.value;
}

/**
 * planGraftedTileset 를 조각으로 — PLAN_STEP_GRAFTS 칸마다 yield 한다. 이식이 4천 칸인 아틀라스는 한 번에 세우면
 * 메인 스레드를 수십 ms 막으므로, 유휴 시간에 미리 굽는 쪽(tilesetPrewarm.ts)이 시간 상한 안에서 이어 돌린다.
 * 결과는 planGraftedTileset 과 같다(대상 칸이 겹치면 뒤 항목이 이긴다 — activeTileGrafts 와 같은 규칙; 칸이 겹치지 않으니 그리는 순서는 결과를 바꾸지 않는다).
 */
export function* planGraftedTilesetSteps<TSource extends GraftSource | string>(
  tileset: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">,
  base: TSource,
  resolveSourceImage: (sourceChipset: string) => TSource | null
): Generator<void, GraftedTilesetPlan<TSource>, void> {
  const raw = tileset.tileGrafts ?? [];
  const byTarget = new Map<number, TileGraft>();
  for (let index = 0; index < raw.length; index += 1) {
    const graft = raw[index];
    if (isValidTileGraft(graft)) byTarget.set(graft.targetTile, graft);
    if (index % PLAN_STEP_GRAFTS === PLAN_STEP_GRAFTS - 1) yield;
  }
  const grafts = [...byTarget.values()].sort((a, b) => a.targetTile - b.targetTile);
  yield;
  const tileSize = tileset.tileSize;
  const maxTarget = grafts.length > 0 ? grafts[grafts.length - 1]!.targetTile : -1;
  const rows = Math.ceil(Math.max(tileset.count, rowAlignedTileCount(maxTarget + 1, tileset.tilesPerRow)) / Math.max(1, tileset.tilesPerRow));
  const sources: TSource[] = [];
  const sourceKeys: string[] = [];
  const sourceIndex = new Map<string, number>();
  const ops = new Int32Array(grafts.length * GRAFT_PLAN_STRIDE);
  let count = 0;
  for (let index = 0; index < grafts.length; index += 1) {
    const graft = grafts[index]!;
    let sourceAt = sourceIndex.get(graft.sourceChipset);
    if (sourceAt === undefined) {
      const source = resolveSourceImage(graft.sourceChipset);
      sourceAt = source ? sources.push(source) - 1 : -1;
      if (source) sourceKeys.push(graft.sourceChipset);
      sourceIndex.set(graft.sourceChipset, sourceAt);
    }
    if (sourceAt < 0) {
      console.warn(`[tileGrafts] 소스 타일 그림판 이미지를 찾지 못해 이식을 건너뜁니다: ${graft.sourceChipset}#${graft.sourceTile}`);
    } else {
      const geometry = graftSourceGeometry(graft);
      const sourceTileSize = geometry.tileSize;
      const src = tileXY(graft.sourceTile, geometry.tilesPerRow, sourceTileSize);
      const dst = tileXY(graft.targetTile, tileset.tilesPerRow, tileSize);
      const at = count * GRAFT_PLAN_STRIDE;
      ops[at] = sourceAt; ops[at + 1] = src.x; ops[at + 2] = src.y; ops[at + 3] = sourceTileSize; ops[at + 4] = sourceTileSize;
      ops[at + 5] = dst.x; ops[at + 6] = dst.y; ops[at + 7] = tileSize; ops[at + 8] = tileSize;
      count += 1;
    }
    if (index % PLAN_STEP_GRAFTS === PLAN_STEP_GRAFTS - 1) yield;
  }
  // 소스가 그림판 키(문자열)면 크기를 모른다 — 최소 크기만 두고 워커가 베이스를 푼 뒤 정한다.
  const minWidth = tileset.tilesPerRow * tileSize;
  const minHeight = rows * tileSize;
  return {
    width: typeof base === "string" ? minWidth : Math.max(sourceWidth(base), minWidth),
    height: typeof base === "string" ? minHeight : Math.max(sourceHeight(base), minHeight),
    minWidth,
    minHeight,
    base,
    sources,
    sourceKeys,
    ops: ops.subarray(0, count * GRAFT_PLAN_STRIDE),
  };
}

type PlanContext = Pick<CanvasRenderingContext2D, "drawImage" | "clearRect" | "imageSmoothingEnabled">;
/** 계획대로 그린다 — 워커(OffscreenCanvas)도 같은 순서를 따른다(tilesetBake.worker.ts). */
export function drawGraftedTilesetPlan<TSource extends GraftSource>(context: PlanContext, plan: GraftedTilesetPlan<TSource>): void {
  context.imageSmoothingEnabled = false;
  context.drawImage(plan.base, 0, 0);
  const ops = plan.ops;
  for (let at = 0; at < ops.length; at += GRAFT_PLAN_STRIDE) {
    context.clearRect(ops[at + 5]!, ops[at + 6]!, ops[at + 7]!, ops[at + 8]!);
    context.drawImage(plan.sources[ops[at]!]!, ops[at + 1]!, ops[at + 2]!, ops[at + 3]!, ops[at + 4]!, ops[at + 5]!, ops[at + 6]!, ops[at + 7]!, ops[at + 8]!);
  }
}

// 베이스 이미지 위에 graft 타일들을 합성한 캔버스를 만든다(메인 스레드). 실패 시 null.
export function createGraftedTilesetCanvas(
  tileset: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">,
  base: GraftSource,
  resolveSourceImage: (sourceChipset: string) => GraftSource | null
): HTMLCanvasElement | null {
  const plan = planGraftedTileset(tileset, base, resolveSourceImage);
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  drawGraftedTilesetPlan(context, plan);
  return canvas;
}

type GraftGeometry = { tileSize: number; tilesPerRow: number };
/** 업로드 그림판 키 → 그 그림판을 쓰는 타일셋의 칸 배치. 프로젝트를 아는 쪽(tilesetImage.ts·헤드리스 렌더)이 등록한다. */
let uploadedGraftGeometry: (sourceChipset: string) => GraftGeometry | null = () => null;
export function setUploadedGraftGeometryResolver(resolve: (sourceChipset: string) => GraftGeometry | null): void {
  uploadedGraftGeometry = resolve;
}

/**
 * 이식 소스 칸의 크기·한 줄 칸 수 — 이식에 적힌 값이 먼저, 그다음 업로드 그림판을 쓰는 타일셋(칸 배치를 적기 전에 만든 이식),
 * 마지막으로 번들 키. 업로드 그림판을 번들 기본값(30칸)으로 읽으면 엉뚱한 칸·투명 칸이 그려진다.
 */
export function graftSourceGeometry(graft: Pick<TileGraft, "sourceChipset" | "sourceTileSize" | "sourceTilesPerRow">): GraftGeometry {
  const uploaded = graft.sourceTileSize && graft.sourceTilesPerRow ? null : uploadedGraftGeometry(graft.sourceChipset);
  return {
    tileSize: graft.sourceTileSize ?? uploaded?.tileSize ?? bundledChipsetTileSize(graft.sourceChipset),
    tilesPerRow: graft.sourceTilesPerRow ?? uploaded?.tilesPerRow ?? bundledChipsetTilesPerRow(graft.sourceChipset),
  };
}

/** 프로젝트에서 업로드 그림판 키를 쓰는 타일셋의 칸 배치. */
export function uploadedGraftGeometryIn(tilesets: Readonly<Record<string, TilesetDef>>, sourceChipset: string): GraftGeometry | null {
  for (const tileset of Object.values(tilesets)) {
    if (tileset.image.type === "uploaded" && tileset.image.id === sourceChipset) return { tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow };
  }
  return null;
}

function tileXY(tile: number, tilesPerRow: number, tileSize: number): { x: number; y: number } {
  const columns = Math.max(1, tilesPerRow);
  return { x: (tile % columns) * tileSize, y: Math.floor(tile / columns) * tileSize };
}

function sourceWidth(source: GraftSource): number {
  return source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
}

function sourceHeight(source: GraftSource): number {
  return source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function graftExpandedBadge(tileset: Pick<TilesetDef, "count" | "tilesPerRow" | "tileGrafts">): string | null {
  const base = tileset.count;
  const expanded = tileCountWithGrafts(tileset);
  if (expanded <= base) return null;
  return `+${expanded - base} tiles (${Math.ceil(expanded / Math.max(1, tileset.tilesPerRow))} rows)`;
}
