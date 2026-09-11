// 집 형태 레코드 → 실제 타일 그림.
//
// 「마을」탭이 오래 어려웠던 이유는 값이 아니라 **그림이 없어서**였다. 날개 좌표
// x/y/w/h 를 숫자로 넣어도 그게 ㄱ자인지 ㄷ자인지, 지붕이 어떻게 얹히는지 알 길이
// 없었다. 추상 격자(칸 채움/빈칸)는 바닥 모양만 알려주고 층수·재료·창문은 못 보여준다.
//
// 그래서 시공 코드를 그대로 빌려 쓴다: 잔디 스크래치 맵에 `stampFootprintHouseKit` 로
// 집을 한 채 찍고, 맵 트리 썸네일과 같은 `drawMapTileLayers` 로 캔버스에 그린다.
// 미리보기와 실제 시공이 **같은 함수**를 지나므로 그림이 거짓말을 할 수 없다.
//
// 계약(mapThumbnail.ts 와 같다):
//  · 재료(합본 마을 칩셋)를 못 구하면 집 그림인 척하지 않고 null 을 돌려준다 —
//    호출부가 추상 격자로 폴백한다.
//  · 캐시는 렌더된 캔버스를 그대로 들고 있는다. data URL 로 두면 재렌더마다 이미지
//    디코드를 기다려서 카드가 한 번 비어 보인다.
//  · 캐시 키는 레코드 내용 시그니처라서 날개를 고치면 자동으로 다시 렌더된다.

import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import {
  ALL_HOUSE_KIT_IDS,
  MIXABLE_HOUSE_KIT_IDS,
  stampFootprintHouseKit,
  type HouseKitId,
} from "@/editor/houseKit";
import { applyRoofDeck } from "@/editor/tools/village/houses";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import type { VillageHouseTemplateRecord } from "@/project/types/village";
import { el } from "@/util/dom";

/** 집 킷 타일 번호(406·467·374…)가 종속된 칩셋. 다른 칩셋이면 엉뚱한 그림이 나온다. */
export const HOUSE_KIT_CHIPSET_KEY = "tex_easyrpg_chipset_combined_town";

/**
 * 마을 원형 전경 그림. 집 한 채와 달리 전경은 도로 탐색·마당·바깥 숲까지 도는 무거운
 * 시공이라 브라우저에서 6장을 즉석에서 돌리지 않는다 — `scripts/bake-village-archetype-previews.mts`
 * 가 실제 `author_village` 결과를 굽고, 화면은 그 PNG 를 읽는다.
 * 파일이 없으면 `<img>` 의 error 로 떨어지므로 호출부가 글자 카드로 폴백한다.
 */
export function villageArchetypeShotUrl(archetypeId: string): string {
  return `assets/village-preview/${archetypeId}.png`;
}

/** 집 둘레 잔디 여백(칸) — 지붕 처마와 문 앞이 잘리지 않게 둔다. */
const MARGIN = 1;

export type HousePreviewSize = "card" | "hero";

const PREVIEW_PIXELS: Readonly<Record<HousePreviewSize, number>> = { card: 96, hero: 168 };
/** 고밀도 화면에서도 또렷하게 — 캔버스 백킹만 키우고 CSS 크기는 그대로 둔다. */
const BACKING_SCALE = 2;
const CACHE_LIMIT = 160;

const renderedCache = new Map<string, HTMLCanvasElement>();
/**
 * 같은 형태를 그리는 캔버스가 여러 장 동시에 만들어진다(목록 썸네일 + 히어로 + 갤러리).
 * 렌더는 한 번만 돌리고, 기다리는 캔버스를 여기 모아 뒀다가 한꺼번에 채운다 — 첫 장만
 * 그리고 나머지를 버리면 아직 DOM 에 붙지 않은 카드가 영구히 빈 채로 남는다.
 */
const pendingKeys = new Map<string, Set<HTMLCanvasElement>>();

/**
 * 킷을 고른다. 레코드가 킷을 비워 두면 시공에서는 프리셋·씨앗값이 고르지만, 미리보기는
 * 그때도 그림을 내야 한다 — id 해시로 안정적으로 하나 집는다(같은 형태는 늘 같은 재료).
 */
export function previewKitFor(record: VillageHouseTemplateRecord): HouseKitId {
  const explicit = record.kitId;
  if (explicit && (ALL_HOUSE_KIT_IDS as readonly string[]).includes(explicit)) return explicit as HouseKitId;
  const pool = MIXABLE_HOUSE_KIT_IDS;
  return pool[hash(record.id) % pool.length] as HouseKitId;
}

/** 킷 타일이 통하는 타일셋. 프로젝트에 합본 마을 칩셋이 없으면 undefined. */
export function houseKitTileset(project: Project): TilesetDef | undefined {
  return Object.values(project.tilesets).find(
    (tileset) => tileset.image.type === "bundled" && tileset.image.id === HOUSE_KIT_CHIPSET_KEY,
  );
}

/**
 * 레코드 한 채를 찍은 스크래치 맵. 순수 함수 — 캔버스가 없는 환경에서도 돌아가므로
 * "지붕 타일이 실제로 들어갔는지" 를 유닛 테스트로 볼 수 있다.
 */
export function housePreviewMap(
  record: VillageHouseTemplateRecord,
  project: Project,
): { readonly map: GameMap; readonly tileset: TilesetDef } | undefined {
  const tileset = houseKitTileset(project);
  if (!tileset) return undefined;
  const wings = record.wings ?? [];
  if (wings.length === 0) return undefined;
  const width = Math.max(...wings.map((wing) => wing.x + wing.w)) + MARGIN * 2;
  const height = Math.max(...wings.map((wing) => wing.y + wing.h)) + MARGIN * 2;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  const map = createBlankMap(record.name || record.id, width, height, tileset.id, tileset.tileSize);
  const stamped = stampFootprintHouseKit(map, {
    wings: wings.map((wing) => ({
      x: wing.x + MARGIN,
      y: wing.y + MARGIN,
      w: wing.w,
      h: wing.h,
      ...(wing.stories === undefined ? {} : { stories: wing.stories }),
    })),
    kitId: previewKitFor(record),
    stories: record.stories === 3 ? 3 : record.stories === 2 ? 2 : 1,
    ...(record.lowWall ? { lowWall: true } : {}),
    doorEvent: false,
  });
  // 규약 위반 레코드는 스탬프가 거절한다 — 반쯤 그려진 집을 보여주지 않는다.
  if (!stamped.ok) return undefined;
  if (record.roofDeck && stamped.doorAt) {
    applyRoofDeck(
      map,
      {
        x: MARGIN,
        y: MARGIN,
        w: width - MARGIN * 2,
        h: height - MARGIN * 2,
      },
      stamped.doorAt,
    );
  }
  return { map, tileset };
}

/**
 * 캔버스를 즉시 돌려주고 그림은 타일셋 이미지가 준비되는 대로 채운다. 재료를 못 구하면
 * `data-preview-state="none"` 으로 남기므로 호출부가 추상 격자로 폴백할 수 있다.
 */
export function createHousePreview(
  record: VillageHouseTemplateRecord,
  project: Project,
  size: HousePreviewSize,
  options: { readonly label?: string; readonly testid?: string } = {},
): HTMLCanvasElement {
  const pixels = PREVIEW_PIXELS[size];
  const key = previewCacheKey(record, project, size);
  const canvas = el("canvas", {
    class: `db-village-house-shot is-${size}`,
    attrs: {
      role: "img",
      "aria-label": options.label ?? `${record.name || record.id} 집 그림`,
      width: String(pixels * BACKING_SCALE),
      height: String(pixels * BACKING_SCALE),
    },
    dataset: {
      testid: options.testid ?? `db-village-house-shot-${record.id}`,
      previewState: "pending",
      // 같은 형태를 그리는 캔버스가 여러 장(목록 썸네일·히어로·갤러리) 붙을 수 있다.
      // testid 는 자리마다 달라야 테스트가 헷갈리지 않으므로, 채워 넣을 대상은 이 키로 찾는다.
      previewKey: key,
    },
  }) as HTMLCanvasElement;

  const cached = renderedCache.get(key);
  if (cached) {
    blit(canvas, cached);
    return canvas;
  }
  void paint(record, project, key, canvas);
  return canvas;
}

/** 실제 시공 결과 맵(프리셋 미리보기 등)을 카드 한 장에 그린다. */
export function createMapShot(
  map: GameMap,
  tileset: TilesetDef,
  options: { readonly label: string; readonly testid: string; readonly width?: number; readonly height?: number },
): HTMLCanvasElement {
  const width = options.width ?? 320;
  const height = options.height ?? 240;
  const canvas = el("canvas", {
    class: "db-village-map-shot",
    attrs: {
      role: "img",
      "aria-label": options.label,
      width: String(width * BACKING_SCALE),
      height: String(height * BACKING_SCALE),
    },
    dataset: { testid: options.testid, previewState: "pending" },
  }) as HTMLCanvasElement;
  void (async () => {
    const stage = await renderStage(map, tileset, canvas.width, canvas.height);
    if (stage) blit(canvas, stage);
    else canvas.dataset.previewState = "none";
  })();
  return canvas;
}

/**
 * 스크래치 맵을 카드 크기로 그린다. 칩셋을 못 구하면 `previewState=none` 으로 남기므로
 * 카드는 글자만으로도 클릭할 수 있다. 집 미리보기와 같은 캐시·대기열을 쓴다.
 */
export function createScratchPreview(options: {
  readonly cacheKey: string;
  readonly label: string;
  readonly testid: string;
  readonly size?: HousePreviewSize;
  readonly build: () => { readonly map: GameMap; readonly tileset: TilesetDef } | undefined;
}): HTMLCanvasElement {
  const size = options.size ?? "card";
  const pixels = PREVIEW_PIXELS[size];
  const key = options.cacheKey;
  const canvas = el("canvas", {
    class: `db-village-house-shot is-${size}`,
    attrs: {
      role: "img",
      "aria-label": options.label,
      width: String(pixels * BACKING_SCALE),
      height: String(pixels * BACKING_SCALE),
    },
    dataset: {
      testid: options.testid,
      previewState: "pending",
      previewKey: key,
    },
  }) as HTMLCanvasElement;

  const cached = renderedCache.get(key);
  if (cached) {
    blit(canvas, cached);
    return canvas;
  }
  void paintFromBuild(options.build, key, canvas);
  return canvas;
}

function previewCacheKey(record: VillageHouseTemplateRecord, project: Project, size: HousePreviewSize): string {
  const wings = (record.wings ?? []).map((wing) => `${wing.x},${wing.y},${wing.w},${wing.h}`).join(";");
  const tilesetId = houseKitTileset(project)?.id ?? "none";
  return [
    size,
    tilesetId,
    previewKitFor(record),
    `${record.w}x${record.h}`,
    record.stories ?? 1,
    record.lowWall ? "low" : "-",
    record.roofDeck ? "deck" : "-",
    wings,
  ].join("|");
}

async function paint(
  record: VillageHouseTemplateRecord,
  project: Project,
  key: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  await paintFromBuild(() => housePreviewMap(record, project), key, canvas);
}

async function paintFromBuild(
  build: () => { readonly map: GameMap; readonly tileset: TilesetDef } | undefined,
  key: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const waiting = pendingKeys.get(key);
  if (waiting) {
    waiting.add(canvas);
    return;
  }
  const queue = new Set<HTMLCanvasElement>([canvas]);
  pendingKeys.set(key, queue);
  try {
    const scratch = build();
    if (!scratch) {
      for (const target of queue) target.dataset.previewState = "none";
      return;
    }
    const stage = await renderStage(scratch.map, scratch.tileset, canvas.width, canvas.height);
    if (!stage) {
      for (const target of queue) target.dataset.previewState = "none";
      return;
    }
    renderedCache.set(key, stage);
    evictOverflow();
    // 기다린 캔버스 + 이미 화면에 붙은 같은 키의 캔버스를 전부 채운다.
    for (const target of queue) blit(target, stage);
    for (const live of liveCanvasesFor(key)) if (!queue.has(live)) blit(live, stage);
  } catch {
    // 폴백 표시가 남는다 — 카드 하나 때문에 탭 렌더가 멈추면 안 된다.
    for (const target of queue) target.dataset.previewState = "none";
  } finally {
    pendingKeys.delete(key);
  }
}

/**
 * 타일을 목표 크기로 곧바로 그리면 소스 사각형이 서브픽셀이 되어 격자가 뭉개진다 —
 * 중간 캔버스에 정수 배율로 그린 뒤 한 번만 축소한다(mapThumbnail 과 같은 이유).
 */
async function renderStage(
  map: GameMap,
  tileset: TilesetDef,
  targetWidth: number,
  targetHeight: number,
): Promise<HTMLCanvasElement | undefined> {
  const tile = map.tileSize || tileset.tileSize || 16;
  const pixelWidth = map.width * tile;
  const pixelHeight = map.height * tile;
  if (pixelWidth <= 0 || pixelHeight <= 0) return undefined;

  const image = await loadTilesetImage(tileset);
  if ("complete" in image && (!image.complete || image.naturalWidth === 0)) return undefined;

  const full = document.createElement("canvas");
  full.width = pixelWidth;
  full.height = pixelHeight;
  const fullContext = full.getContext("2d", { alpha: false });
  if (!fullContext) return undefined;
  fullContext.imageSmoothingEnabled = false;
  fullContext.fillStyle = "#243018";
  fullContext.fillRect(0, 0, pixelWidth, pixelHeight);
  drawMapTileLayers(fullContext, image, map, tileset, 1);

  const target = document.createElement("canvas");
  target.width = targetWidth;
  target.height = targetHeight;
  const context = target.getContext("2d", { alpha: false });
  if (!context) return undefined;
  const fit = Math.min(targetWidth / pixelWidth, targetHeight / pixelHeight);
  const drawWidth = Math.max(1, Math.round(pixelWidth * fit));
  const drawHeight = Math.max(1, Math.round(pixelHeight * fit));
  context.fillStyle = "#141b12";
  context.fillRect(0, 0, targetWidth, targetHeight);
  // 정수 배율로 확대될 때는 픽셀을 살리고, 축소될 때만 부드럽게.
  const enlarging = fit >= 1;
  context.imageSmoothingEnabled = !enlarging;
  if (!enlarging) context.imageSmoothingQuality = "high";
  context.drawImage(
    full,
    Math.floor((targetWidth - drawWidth) / 2),
    Math.floor((targetHeight - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );
  return target;
}

function liveCanvasesFor(previewKey: string): HTMLCanvasElement[] {
  if (typeof document.querySelectorAll !== "function") return [];
  return Array.from(
    document.querySelectorAll<HTMLCanvasElement>(`canvas[data-preview-key="${cssEscape(previewKey)}"]`),
  );
}

/** 키에는 레코드 id(사용자 입력)가 섞인다 — 따옴표 하나로 선택자가 깨지지 않게 막는다. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function blit(canvas: HTMLCanvasElement, source: HTMLCanvasElement): void {
  const context = canvas.getContext("2d", { alpha: false });
  // fakeDom 은 2D 컨텍스트를 흉내내지 않고 null 을 준다 — 그림 없이도 계약은 유지한다.
  if (!context) {
    canvas.dataset.previewState = "nocontext";
    return;
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.dataset.previewState = "ready";
}

function evictOverflow(): void {
  while (renderedCache.size > CACHE_LIMIT) {
    const oldest = renderedCache.keys().next();
    if (oldest.done) return;
    renderedCache.delete(oldest.value);
  }
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
