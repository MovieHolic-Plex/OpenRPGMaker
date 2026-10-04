// 높이 지형 절벽 그림을 맵 줄마다 잘라 Phaser 텍스처 프레임으로 올린다. 런타임(playSceneMapRuntime)과 편집기(EditScene)가 같이 쓴다.
// 줄 띠는 텍스처 몇 장(페이지)에 세로로 쌓아 프레임으로 나눈다 — 줄마다 텍스처를 만들면 100줄 맵이 텍스처 100장이 된다.
import { effectiveHeights, renderRelief, type ReliefGroundSurface } from "@/project/relief/render";
import { hasRelief } from "@/project/relief/walk";
import { cellLift, reliefLiftField, reliefRenderOptions, reliefRowStrips, type ReliefLiftField, type ReliefRowStrip, type ReliefStripPart } from "@/project/relief/screen";
import { gridFromRelief, RELIEF_TILE, type ReliefData } from "@/project/relief/types";

const PAGE_HEIGHT = 2048;
let textureSerial = 0;

interface ReliefFrameTexture {
  add(name: string, sourceIndex: number, x: number, y: number, width: number, height: number): unknown;
  setFilter?(mode: number): unknown;
  /** 캔버스 텍스처 재사용용(Phaser CanvasTexture 만 갖는다). 하나라도 없으면 재사용하지 않고 새로 만든다. */
  readonly canvas?: HTMLCanvasElement;
  readonly context?: CanvasRenderingContext2D;
  refresh?(): unknown;
  getFrameNames?(includeBase?: boolean): string[];
  remove?(name: string): unknown;
}

export interface ReliefTextureManager {
  exists(key: string): boolean;
  remove(key: string): unknown;
  addCanvas(key: string, canvas: HTMLCanvasElement): ReliefFrameTexture | null;
  /** 캔버스 텍스처 재사용용(선택). 시험용 스텁은 아무 값이나 돌려줘도 된다 — 쓸 때 모양을 확인한다. */
  get?(key: string): unknown;
}

/** 씬이 가진 textures 가 절벽 띠를 올릴 수 있는 완전한 텍스처 관리자인지 본다(시험용 스텁은 get 만 갖는다). */
export function asReliefTextures(textures: Partial<ReliefTextureManager> | undefined): ReliefTextureManager | null {
  return textures && textures.exists && textures.remove && textures.addCanvas ? (textures as ReliefTextureManager) : null;
}

/** 재사용 모드의 페이지 높이 눈금(px). PAGE_HEIGHT 의 약수라 꽉 찬 페이지는 눈금에 딱 맞는다. */
const REUSE_HEIGHT_STEP = 256;

/** 줄 하나의 띠 프레임. x·y 는 월드 px(원점 왼쪽 위), scale 은 맵 칸 크기 / 16. */
export interface ReliefStripFrame {
  readonly row: number;
  readonly part: ReliefStripPart;
  readonly textureKey: string;
  readonly frame: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface ReliefStripTextures {
  readonly textureKeys: readonly string[];
  /** 줄 번호 오름차순, 줄마다 under 다음 over */
  readonly frames: readonly ReliefStripFrame[];
}

const reliefPresence = new WeakMap<ReliefData, boolean>();

/**
 * 평지·relief 없음이면 null. 들림 표는 relief 객체마다 한 번 계산된다(screen.ts).
 * 「높이가 있는가」도 객체마다 한 번만 잰다 — 편집기는 다시 그리는 타일마다 이것을 불러 맵 전체 단을 훑었다
 * (2026-10-03 높이 붓 프로필: 드래그 한 번에 약 0.35초).
 */
export function reliefFieldOf(relief: ReliefData | undefined): ReliefLiftField | null {
  if (!relief) return null;
  let present = reliefPresence.get(relief);
  if (present === undefined) reliefPresence.set(relief, present = hasRelief(relief));
  return present ? reliefLiftField(relief) : null;
}

/** 칸 (x, y) 에 선 것을 올릴 월드 px. relief 가 없으면 0. */
export function reliefCellLiftPx(relief: ReliefData | undefined, x: number, y: number, tileSize: number): number {
  const field = reliefFieldOf(relief);
  return field ? cellLift(field, x, y) * tileSize : 0;
}

function packPages(strips: readonly ReliefRowStrip[]): ReliefRowStrip[][] {
  const pages: ReliefRowStrip[][] = [];
  let page: ReliefRowStrip[] = [], height = 0;
  for (const strip of strips) {
    if (page.length && height + strip.h > PAGE_HEIGHT) { pages.push(page); page = []; height = 0; }
    page.push(strip); height += strip.h;
  }
  if (page.length) pages.push(page);
  return pages;
}

export interface ReliefStripBuildOptions {
  readonly ground?: ReliefGroundSurface;
  /**
   * 직전에 만든 페이지 텍스처 키. 주면 캔버스 크기가 같은 페이지는 새로 만들지 않고 그 캔버스를 고쳐 쓴다 —
   * 높이 붓 드래그 중 텍스처를 만들고 지우기를 되풀이하면 GPU 업로드가 겹친다(편집기 EditScene).
   * 줄 띠는 줄마다 크기가 달라 페이지 크기가 매번 바뀌므로, 이 모드에서는 폭을 그림 폭에, 높이를
   * {@link REUSE_HEIGHT_STEP} 눈금에 맞춰 키운다. 쓰지 않은 옛 페이지는 여기서 지운다. 런타임은 주지 않는다(옛 동작 그대로).
   */
  readonly reuseKeys?: readonly string[];
}

/** 이 키의 텍스처가 (width × height) 캔버스 텍스처면 돌려준다. 아니면 null. */
function reusableTexture(textures: ReliefTextureManager, key: string | undefined, width: number, height: number): ReliefFrameTexture | null {
  if (!key || !textures.exists(key) || !textures.get) return null;
  const texture = textures.get(key) as ReliefFrameTexture | null | undefined;
  const canvas = texture?.canvas;
  if (!texture || !canvas || !texture.context || !texture.refresh || !texture.getFrameNames || !texture.remove) return null;
  return canvas.width === width && canvas.height === height ? texture : null;
}

/** 절벽 그림 → 줄 띠 텍스처. 다시 그릴 때 {@link removeReliefTextures} 로 버린다(재사용 모드는 옵션 참고). */
export function buildReliefStripTextures(
  textures: ReliefTextureManager,
  relief: ReliefData,
  tileSize: number,
  options: ReliefStripBuildOptions = {},
): ReliefStripTextures {
  const render = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief, options.ground));
  const scale = tileSize / RELIEF_TILE;
  const reuseKeys = options.reuseKeys;
  const textureKeys: string[] = [];
  const frames: ReliefStripFrame[] = [];
  const strips = [...reliefRowStrips(render, relief.width, "under"), ...reliefRowStrips(render, relief.width, "over")];
  let pageIndex = 0;
  for (const page of packPages(strips)) {
    const previousKey = reuseKeys?.[pageIndex++];
    const usedWidth = Math.max(...page.map((s) => s.w));
    const usedHeight = page.reduce((sum, s) => sum + s.h, 0);
    const width = reuseKeys ? Math.max(usedWidth, render.PW) : usedWidth;
    const height = reuseKeys ? Math.ceil(usedHeight / REUSE_HEIGHT_STEP) * REUSE_HEIGHT_STEP : usedHeight;
    const reused = reusableTexture(textures, previousKey, width, height);
    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null;
    if (reused) {
      // 같은 크기 — 캔버스를 비우고 프레임만 새로 단다.
      context = reused.context ?? null;
      for (const name of reused.getFrameNames?.() ?? []) reused.remove?.(name);
      context?.clearRect(0, 0, width, height);
    } else {
      if (previousKey) removeReliefTextures(textures, [previousKey]);
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d");
    }
    if (!context) continue;
    const offsets: number[] = [];
    let cursor = 0;
    for (const strip of page) {
      context.putImageData(new ImageData(new Uint8ClampedArray(strip.rgba), strip.w, strip.h), 0, cursor);
      offsets.push(cursor);
      cursor += strip.h;
    }
    let pageKey: string;
    let pageTexture: ReliefFrameTexture | null;
    if (reused && previousKey) {
      reused.refresh?.();
      pageKey = previousKey;
      pageTexture = reused;
    } else {
      // 그린 뒤에 올린다(만들 때 한 번만 GPU 로 올라간다).
      pageKey = `__oprn_relief_${++textureSerial}`;
      pageTexture = canvas ? textures.addCanvas(pageKey, canvas) : null;
      pageTexture?.setFilter?.(1);
    }
    if (!pageTexture) continue;
    const target = pageTexture;
    textureKeys.push(pageKey);
    page.forEach((strip, index) => {
      const frame = `${strip.part}_${strip.row}`;
      target.add(frame, 0, 0, offsets[index]!, strip.w, strip.h);
      frames.push({ row: strip.row, part: strip.part, textureKey: pageKey, frame, x: strip.x * scale, y: (strip.y - render.pad) * scale, scale });
    });
  }
  // 이번에 쓰지 않은 옛 페이지(페이지 수가 줄었거나 크기가 달라 새로 만든 것)는 버린다.
  if (reuseKeys) removeReliefTextures(textures, reuseKeys.filter((old) => !textureKeys.includes(old)));
  frames.sort((a, b) => a.row - b.row || (a.part === b.part ? 0 : a.part === "under" ? -1 : 1));
  return { textureKeys, frames };
}

export function removeReliefTextures(textures: ReliefTextureManager, keys: readonly string[]): void {
  for (const key of keys) if (textures.exists(key)) textures.remove(key);
}
