/**
 * 전투 배틀러 그림의 「지금 보이는 모습」을 캔버스에 뜬다 — 적 쓰러짐 연출(battleEnemyCollapse)과 상태 오라 자리 맞춤
 * (battleFieldDom.fitAuraLayerToSprite)이 같이 쓴다.
 *
 * 적 그림은 스킨마다 다른 길로 그려진다: 정적 img(object-fit: contain), 도트 시트 칸(배경 그림 300%·위치 %),
 * 확장 배틀러(배경 스트립). 여기서는 계산 스타일을 읽어 셋을 같은 캔버스로 옮기고, 불투명 픽셀이 차지한 상자도 잰다 —
 * 도트 칸은 144px 칸의 아래 ⅓ 만 슬라임이라 칸 상자를 몸으로 보면 머리 위 표시가 허공에 뜬다.
 */

export type SpriteSnapshot = {
  /** 그림(캔버스 해상도 = 레이아웃 px × resolution). */
  readonly source: HTMLCanvasElement;
  readonly resolution: number;
  /** 보이는 상자 — 노드 기준 노드 좌표 px. */
  readonly box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** 그림이 좌우 뒤집혀 그려졌는가(측면 배치). */
  readonly mirrored: boolean;
  /** 보간해 그려야 하는가(축소되는 고해상도 그림). false 면 도트 — pixelated. */
  readonly smooth: boolean;
};

type SpriteStyle = {
  readonly imageRendering: string;
  readonly backgroundImage: string;
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
  readonly objectPosition: string;
  readonly transform: string;
};

export async function snapshotSprite(node: HTMLElement, sprite: HTMLElement, maxResolution = 3): Promise<SpriteSnapshot | null> {
  const width = sprite.offsetWidth;
  const height = sprite.offsetHeight;
  if (width <= 0 || height <= 0) return null;
  // 상자·스타일은 **지금** 잰다(await 뒤에 읽으면 바뀌어 있다). 도트 시트 적은 막타 직후 녹은·떨어진 칸(dead)으로
  // 넘어가므로, 이미지를 기다린 뒤 읽으면 쓰러진 칸이 분해된다(실측: 비스듬한 웅덩이).
  const nodeRect = node.getBoundingClientRect();
  // 무대 배율(640×480 논리 해상도를 키워 보인다) × 화면 배율만큼 촘촘히 그려야 흐리지 않다.
  const stageScale = node.offsetWidth > 0 ? nodeRect.width / node.offsetWidth : 1;
  const resolution = Math.max(1, Math.min(maxResolution, stageScale * (window.devicePixelRatio || 1)));
  const live = getComputedStyle(sprite);
  const style: SpriteStyle = {
    imageRendering: live.imageRendering,
    backgroundImage: live.backgroundImage,
    backgroundSize: live.backgroundSize,
    backgroundPosition: live.backgroundPosition,
    objectPosition: live.objectPosition,
    transform: live.transform,
  };
  const box = visualBox(sprite, nodeRect, stageScale, width, height);
  const source = document.createElement("canvas");
  source.width = Math.ceil(width * resolution);
  source.height = Math.ceil(height * resolution);
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const smooth = style.imageRendering !== "pixelated" && style.imageRendering !== "crisp-edges";
  context.imageSmoothingEnabled = smooth;
  context.scale(resolution, resolution);
  const backgroundUrl = firstCssUrl(style.backgroundImage);
  const drawn = backgroundUrl
    ? await drawBackground(context, backgroundUrl, style, width, height)
    : sprite instanceof HTMLImageElement && await drawContained(context, sprite, style, width, height);
  if (!drawn) return null;
  return { source, resolution, box, mirrored: mirroredTransform(style.transform), smooth };
}

/**
 * 불투명 픽셀(알파 > 24)이 차지한 상자 — 0~1 비율(그림 상자 기준). 비었거나 읽을 수 없으면(교차 출처) null.
 */
export function opaqueBounds(canvas: HTMLCanvasElement): { left: number; top: number; right: number; bottom: number } | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) return null;
  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    const row = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[row + x * 4 + 3]! > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    left: minX / canvas.width,
    top: minY / canvas.height,
    right: (maxX + 1) / canvas.width,
    bottom: (maxY + 1) / canvas.height,
  };
}

/**
 * 스프라이트가 **보이는** 상자(노드 기준, 노드 좌표 px). offsetLeft/Top 은 쓰지 않는다 — 스킨이 그림을
 * transform(translate -50%·확대)으로 세우므로 레이아웃 좌표는 보이는 자리와 다르다(실측: 왼쪽 아래로 70~300px 어긋남).
 */
function visualBox(
  sprite: HTMLElement,
  nodeRect: DOMRect,
  stageScale: number,
  layoutWidth: number,
  layoutHeight: number,
): SpriteSnapshot["box"] {
  const rect = sprite.getBoundingClientRect();
  const scale = stageScale || 1;
  const width = rect.width > 0 ? rect.width / scale : layoutWidth;
  const height = rect.height > 0 ? rect.height / scale : layoutHeight;
  return { left: (rect.left - nodeRect.left) / scale, top: (rect.top - nodeRect.top) / scale, width, height };
}

function mirroredTransform(transform: string): boolean {
  const match = /^matrix\(([^,]+),/.exec(transform);
  return match ? Number(match[1]) < 0 : false;
}

function firstCssUrl(value: string): string | null {
  const match = /url\(["']?([^"')]+)["']?\)/.exec(value);
  return match?.[1] ?? null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** CSS 배경 한 장(첫 층)을 상자에 그대로 옮긴다. background-size/position 의 % · px · auto 를 푼다. */
async function drawBackground(
  context: CanvasRenderingContext2D,
  url: string,
  style: SpriteStyle,
  width: number,
  height: number,
): Promise<boolean> {
  const image = await loadImage(url);
  if (!image) return false;
  const [sizeX = "auto", sizeY = "auto"] = style.backgroundSize.split(",")[0]!.trim().split(/\s+/);
  let drawWidth = cssLength(sizeX, width, NaN);
  let drawHeight = cssLength(sizeY, height, NaN);
  if (Number.isNaN(drawWidth) && Number.isNaN(drawHeight)) {
    drawWidth = image.naturalWidth;
    drawHeight = image.naturalHeight;
  } else if (Number.isNaN(drawWidth)) {
    drawWidth = (drawHeight * image.naturalWidth) / image.naturalHeight;
  } else if (Number.isNaN(drawHeight)) {
    drawHeight = (drawWidth * image.naturalHeight) / image.naturalWidth;
  }
  const [positionX = "0%", positionY = "0%"] = style.backgroundPosition.split(",")[0]!.trim().split(/\s+/);
  const x = cssOffset(positionX, width - drawWidth);
  const y = cssOffset(positionY, height - drawHeight);
  context.drawImage(image, x, y, drawWidth, drawHeight);
  return true;
}

async function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  style: SpriteStyle,
  width: number,
  height: number,
): Promise<boolean> {
  let drawable: HTMLImageElement = image;
  if (!image.complete || image.naturalWidth === 0) {
    const loaded = await loadImage(image.src);
    if (!loaded) return false;
    drawable = loaded;
  }
  const fit = Math.min(width / drawable.naturalWidth, height / drawable.naturalHeight);
  const drawWidth = drawable.naturalWidth * fit;
  const drawHeight = drawable.naturalHeight * fit;
  const [positionX = "50%", positionY = "50%"] = style.objectPosition.split(/\s+/);
  // 도트 시트 경로는 내용 그림을 화면 밖(-99999px)으로 치운다 — 그때는 배경 쪽으로 왔어야 했다. 여기서는 가운데로 본다.
  const offsetX = cssOffset(positionX, width - drawWidth);
  const offsetY = cssOffset(positionY, height - drawHeight);
  const x = Math.abs(offsetX) > width * 4 ? (width - drawWidth) / 2 : offsetX;
  const y = Math.abs(offsetY) > height * 4 ? (height - drawHeight) / 2 : offsetY;
  context.drawImage(drawable, x, y, drawWidth, drawHeight);
  return true;
}

function cssLength(value: string, box: number, fallback: number): number {
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * box;
  if (value.endsWith("px")) return Number.parseFloat(value);
  return fallback;
}

/** background-position / object-position 의 한 축. % 는 (상자 − 그림) 비율이다. */
function cssOffset(value: string, free: number): number {
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return free;
  if (value === "center") return free / 2;
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * free;
  return Number.parseFloat(value) || 0;
}
