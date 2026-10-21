// 맵 배경 탭의 「게임 화면 미리보기」 — 플레이와 같은 식(맞추기·반복·흐름·깊이)으로 배경 스택을 움직여 보인다.
//
// 왜 따로 그리나: 편집기 캔버스는 정지 화면이고(움직임은 플레이에서만), 예전 탭 미리보기는 첫 장 한 장을
// <img> 로 잘라 보여 줘서 「무엇이 어떻게 움직이는지」 도, 게임에서 몇 배로 보이는지도 알 수 없었다.
// 여기서는 게임 화면 크기(해상도 / 카메라 배율)의 캔버스에 층을 그리고, 주인공이 좌우로 걷는다고 가정해
// 카메라를 천천히 흔든다 — 깊이(시차)가 눈에 보인다. 식은 `playSceneMapBackground` 와 같다:
//   cover 배율 = max(화면/그림)(넘치는 축은 가운데 맞춤), 층 위치(논리 px) = 자동 흐름 + 카메라 이동 × 깊이,
//   반복 축은 그림 폭마다 이어 그리고, 반복을 끈 축은 한 장만(남는 자리는 검다).

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { mapBackgroundCoverCentre, mapBackgroundCoverScale } from "@/project/mapBackground";
import type { MapBackground, MapBackgroundLayer, Project } from "@/project/types";
import { el } from "@/util/dom";

/** 60Hz 논리 프레임당 px — 플레이와 같은 단위. */
const FRAMES_PER_SECOND = 60;
/** 미리보기 카메라가 좌우로 오가는 폭(논리 px)과 주기(ms). 두 칸 반 정도 — 시차가 보일 만큼만. */
const PAN_AMPLITUDE = 40;
const PAN_PERIOD_MS = 6000;

type LayerState = { readonly layer: MapBackground | MapBackgroundLayer; readonly image: HTMLImageElement };

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** 한 층을 그린다. 플레이의 TileSprite 배치와 같은 결과가 나오게 한다. */
export function drawMapBackgroundLayer(
  ctx: CanvasRenderingContext2D,
  layer: MapBackground | MapBackgroundLayer,
  image: { readonly width: number; readonly height: number } & CanvasImageSource,
  viewport: { readonly width: number; readonly height: number },
  initialOffset: { readonly x: number; readonly y: number },
): void {
  let offset = initialOffset;
  if (!image.width || !image.height) return;
  const scale = mapBackgroundCoverScale(layer.fit, viewport, image);
  const centre = mapBackgroundCoverCentre(layer.fit, viewport, image);
  offset = { x: offset.x + centre.x, y: offset.y + centre.y };
  const drawnW = image.width * scale;
  const drawnH = image.height * scale;
  const loopX = layer.loopX !== false;
  const loopY = layer.loopY !== false;
  const startX = loopX ? -modulo(offset.x, drawnW) : -offset.x;
  const startY = loopY ? -modulo(offset.y, drawnH) : -offset.y;
  const endX = loopX ? viewport.width : startX + drawnW;
  const endY = loopY ? viewport.height : startY + drawnH;
  for (let y = startY; y < endY; y += drawnH) {
    for (let x = startX; x < endX; x += drawnW) {
      ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(drawnW), Math.round(drawnH));
    }
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  cover: NonNullable<Parameters<typeof createMapBackgroundLivePreview>[0]["cover"]>,
  viewport: { readonly width: number; readonly height: number },
): void {
  const { cols, rows, tileSize, originX, originY } = cover;
  // 불투명 — 반투명이면 「흐리게나마 보인다」 로 읽혔다. 플레이에서는 타일이 배경을 완전히 가린다.
  ctx.fillStyle = "#3b4636";
  const firstCol = Math.max(0, Math.floor(originX / tileSize));
  const firstRow = Math.max(0, Math.floor(originY / tileSize));
  for (let row = firstRow; row < rows && row * tileSize - originY < viewport.height; row += 1) {
    for (let col = firstCol; col < cols && col * tileSize - originX < viewport.width; col += 1) {
      if (cover.cellVisible(row * cols + col)) continue;
      ctx.fillRect(Math.round(col * tileSize - originX), row * tileSize - originY, tileSize, tileSize);
    }
  }
}

/**
 * 움직이는 미리보기 요소를 만든다. 문서에서 떨어지면 스스로 멈춘다(탭을 다시 그리면 새로 만든다).
 * `viewport` 는 게임 화면이 보여 주는 월드 크기(논리 px). 캔버스는 그 크기, CSS 로 확대해 보인다.
 */
export function createMapBackgroundLivePreview(input: {
  readonly background: MapBackground;
  readonly project: Project;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly testid?: string;
  /**
   * 맵 칸 덮개 — 플레이 첫 화면(맵 왼쪽 위 또는 시작 위치)에서 타일이 배경을 가리는 칸을 어둡게 칠한다.
   * 2026-10-21 감사: 미리보기에는 노을 전체가 보이는데 게임에서는 윗줄 몇 칸만 비쳐 「해가 안 보인다」 였다.
   */
  readonly cover?: {
    readonly cols: number;
    readonly rows: number;
    readonly tileSize: number;
    /** 화면 왼쪽 위가 가리키는 월드 좌표(px). */
    readonly originX: number;
    readonly originY: number;
    readonly cellVisible: (index: number) => boolean;
  };
  /**
   * 미리보기 카메라가 시작 화면에서 좌우로 갈 수 있는 거리(논리 px). 맵이 한 화면 크기면 {0,0} — 플레이에서도
   * 카메라가 안 움직이므로 미리보기도 흔들지 않는다(2026-10-21 적대 검수: 없는 시차를 보여 줬다).
   * 생략하면 ±40px.
   */
  readonly pan?: { readonly left: number; readonly right: number };
}): HTMLElement {
  const { background, project, viewport } = input;
  const canvas = el("canvas", {
    class: "map-bg-live-canvas",
    attrs: { width: String(viewport.width), height: String(viewport.height), "aria-label": "게임 화면 미리보기" },
    dataset: { testid: input.testid ?? "map-bg-live-preview" },
  }) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const stack = [background, ...(background.layers ?? [])].filter((layer) => (layer.imageId ?? "").trim() !== "");
  const states: LayerState[] = [];
  for (const layer of stack) {
    const url = resolveAssetResourceUrl(layer.imageId, { project });
    if (!url) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    states.push({ layer, image });
  }
  const startedAt = performance.now();
  let frame = 0;
  const draw = (now: number): void => {
    if (!ctx) return;
    if (!canvas.isConnected && now - startedAt > 1000) return;
    const elapsed = now - startedAt;
    const wave = Math.sin((elapsed / PAN_PERIOD_MS) * Math.PI * 2);
    const pan = input.pan ?? { left: PAN_AMPLITUDE, right: PAN_AMPLITUDE };
    const camera = wave >= 0 ? wave * Math.min(PAN_AMPLITUDE, pan.right) : wave * Math.min(PAN_AMPLITUDE, pan.left);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    for (const { layer, image } of states) {
      if (!image.complete || !image.naturalWidth) continue;
      const seconds = elapsed / 1000;
      const follow = layer.cameraFollow ?? 0;
      const offset = {
        x: (layer.scrollX ?? 0) * seconds * FRAMES_PER_SECOND + camera * follow,
        y: (layer.scrollY ?? 0) * seconds * FRAMES_PER_SECOND,
      };
      drawMapBackgroundLayer(ctx, layer, image, viewport, offset);
    }
    // 타일은 카메라와 함께 움직인다 — 덮개도 카메라만큼 민다(배경은 깊이만큼만 움직인다).
    if (input.cover) drawCover(ctx, { ...input.cover, originX: input.cover.originX + camera }, viewport);
    canvas.dataset.frame = String(++frame);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return canvas;
}
