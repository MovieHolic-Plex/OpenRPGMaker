/**
 * 대화 흉상(고해상도 일러스트)을 3세대 도트 화면에 맞춘다 — 표시 시점에만 그리고 원본 그림은 건드리지 않는다.
 * 맵은 2배 화소로 그려지므로 흉상도 "화소 하나 = 화면 2칸" 이 되게 줄여서(상자 안에 들어갈 크기),
 * 색을 한 줌으로 줄이고(중앙값 자르기), 윤곽선을 1화소 두른 뒤 2배 최근접으로 키운다.
 */

/** 도트 격자(화소 단위). 화면에서는 2배로 나온다. */
export const BUST_ART_WIDTH = 44;
export const BUST_ART_HEIGHT = 46;
export const BUST_PIXEL_SCALE = 2;
/** 큰 원래 격자 흉상(아스트라 인물 2판, 64x64 = 전투 트레이너 그림과 같은 화소 크기). 화면에서 2배 = 128x128 칸. */
export const BUST_LARGE_SIZE = 64;
const LARGE_BUST_PATH = /\/assets\/emerald-monster\/cast\/[a-z][a-z0-9-]*\/bust-[a-z]+\.png(?:$|[?#])/u;
const PALETTE_SIZE = 16;
const ALPHA_CUT = 128;
const OUTLINE: readonly [number, number, number] = [0x20, 0x30, 0x28];

const cache = new Map<string, Promise<RenderedBust | null>>();
/** 다 풀린 흉상(그림 받기·도트 변환이 끝난 것). null = 실패했거나 해당 없음 — 원본을 그대로 쓴다. */
const settled = new Map<string, RenderedBust | null>();
type RenderedBust = { readonly dataUrl: string; readonly large: boolean };

function taskFor(url: string): Promise<RenderedBust | null> {
  let task = cache.get(url);
  if (!task) {
    task = render(url).catch(() => null).then((rendered) => {
      settled.set(url, rendered);
      return rendered;
    });
    cache.set(url, task);
  }
  return task;
}

/** 이 흉상을 곧바로 보일 수 있는가(받기·변환이 끝났다). */
export function pixelBustSettled(url: string): boolean {
  return settled.has(url);
}

/**
 * 흉상을 미리 받아 둔다. 대사창이 이 약속을 기다린 뒤 열리면 이름표만 있는 빈 창이 먼저 보이지 않는다
 * (2026-10-30 이세계 고딩: 첫 줄마다 이름표만 약 1초). 실패해도 resolve 한다.
 */
export function preloadPixelBust(url: string): Promise<void> {
  return taskFor(url).then(() => undefined);
}

type Rgb = [number, number, number];

function medianCut(pixels: readonly Rgb[], colors: number): Rgb[] {
  let boxes: Rgb[][] = [pixels.slice()];
  while (boxes.length < colors) {
    let pick = -1;
    let pickRange = 0;
    let pickChannel = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (let channel = 0; channel < 3; channel += 1) {
        let min = 255;
        let max = 0;
        for (const p of box) {
          if (p[channel] < min) min = p[channel];
          if (p[channel] > max) max = p[channel];
        }
        const range = (max - min) * Math.sqrt(box.length);
        if (range > pickRange) {
          pickRange = range;
          pick = index;
          pickChannel = channel;
        }
      }
    });
    if (pick < 0) break;
    const box = boxes[pick]!;
    box.sort((a, b) => a[pickChannel]! - b[pickChannel]!);
    const half = box.length >> 1;
    boxes.splice(pick, 1, box.slice(0, half), box.slice(half));
  }
  return boxes.map((box) => {
    const sum: Rgb = [0, 0, 0];
    for (const p of box) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
    }
    const n = Math.max(1, box.length);
    return [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)] as Rgb;
  });
}

function nearest(palette: readonly Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0]!;
  let bestDistance = Infinity;
  for (const color of palette) {
    const d = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = color;
    }
  }
  return best;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // 받은 뒤 디코드까지 끝내 둔다 — 대사창이 열리는 프레임에서 큰 초상을 디코드하느라 멈추지 않게.
    image.onload = () => {
      const decoded = typeof image.decode === "function" ? image.decode().catch(() => undefined) : Promise.resolve();
      void decoded.then(() => resolve(image));
    };
    image.onerror = () => reject(new Error("bust image load failed"));
    image.src = url;
  });
}

async function render(url: string): Promise<RenderedBust | null> {
  const image = await loadImage(url);
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (!w || !h) return null;
  // 이미 64x64 원래 격자로 구운 흉상은 2배 최근접으로만 키운다(128x128 칸, 전투 64x64 그림과 같은 화소 크기).
  if (w === BUST_LARGE_SIZE && h === BUST_LARGE_SIZE) {
    const large = document.createElement("canvas");
    large.width = w * BUST_PIXEL_SCALE;
    large.height = h * BUST_PIXEL_SCALE;
    const largeCtx = large.getContext("2d");
    if (!largeCtx) return null;
    largeCtx.imageSmoothingEnabled = false;
    largeCtx.drawImage(image, 0, 0, large.width, large.height);
    return { dataUrl: large.toDataURL("image/png"), large: true };
  }
  const big = document.createElement("canvas");
  big.width = BUST_ART_WIDTH * BUST_PIXEL_SCALE;
  big.height = BUST_ART_HEIGHT * BUST_PIXEL_SCALE;
  const bigCtx = big.getContext("2d");
  if (!bigCtx) return null;
  bigCtx.imageSmoothingEnabled = false;
  // 이미 도트 격자 44x46 으로 구운 흉상(아스트라 인물, scripts/content/monsters/bake_astra_cast.py — 16색·윤곽·눈/입 손질)은
  // 다시 줄이거나 색을 다시 고르지 않고 2배 최근접으로만 키운다. 다시 줄이면 손질한 눈·입이 뭉개진다.
  if (w === BUST_ART_WIDTH && h === BUST_ART_HEIGHT) {
    bigCtx.drawImage(image, 0, 0, big.width, big.height);
    return { dataUrl: big.toDataURL("image/png"), large: false };
  }
  const fit = Math.min(BUST_ART_WIDTH / w, BUST_ART_HEIGHT / h);
  const dw = Math.max(1, Math.round(w * fit));
  const dh = Math.max(1, Math.round(h * fit));
  const art = document.createElement("canvas");
  art.width = BUST_ART_WIDTH;
  art.height = BUST_ART_HEIGHT;
  const ctx = art.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // 아래·가운데 맞춤. 윤곽선이 들어갈 1화소 여백을 남긴다.
  ctx.drawImage(image, Math.floor((BUST_ART_WIDTH - dw) / 2), BUST_ART_HEIGHT - dh, dw, dh);
  const data = ctx.getImageData(0, 0, BUST_ART_WIDTH, BUST_ART_HEIGHT);
  const px = data.data;
  const solid = (i: number) => px[i * 4 + 3]! >= ALPHA_CUT;
  const opaque: Rgb[] = [];
  for (let i = 0; i < BUST_ART_WIDTH * BUST_ART_HEIGHT; i += 1) {
    if (solid(i)) opaque.push([px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!]);
  }
  if (opaque.length === 0) return null;
  const palette = medianCut(opaque, PALETTE_SIZE);
  const out = ctx.createImageData(BUST_ART_WIDTH, BUST_ART_HEIGHT);
  const o = out.data;
  const put = (i: number, c: readonly number[]) => {
    o[i * 4] = c[0]!;
    o[i * 4 + 1] = c[1]!;
    o[i * 4 + 2] = c[2]!;
    o[i * 4 + 3] = 255;
  };
  for (let y = 0; y < BUST_ART_HEIGHT; y += 1) {
    for (let x = 0; x < BUST_ART_WIDTH; x += 1) {
      const i = y * BUST_ART_WIDTH + x;
      if (solid(i)) {
        put(i, nearest(palette, px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!));
        continue;
      }
      const edge = (nx: number, ny: number) =>
        nx >= 0 && ny >= 0 && nx < BUST_ART_WIDTH && ny < BUST_ART_HEIGHT && solid(ny * BUST_ART_WIDTH + nx);
      if (edge(x - 1, y) || edge(x + 1, y) || edge(x, y - 1) || edge(x, y + 1)) put(i, OUTLINE);
    }
  }
  ctx.putImageData(out, 0, 0);
  bigCtx.drawImage(art, 0, 0, big.width, big.height);
  return { dataUrl: big.toDataURL("image/png"), large: false };
}

/** 흉상 노드의 배경을 도트로 바꾼다. 실패하면 원본을 그대로 둔다. */
/** onReady: 그림을 쓸 수 있게 된 뒤(도트 변환을 붙였든, 해당 없어 원본을 쓰든, 실패했든) 한 번 부른다. */
export function applyPixelBust(node: HTMLElement, url: string, onReady?: () => void): void {
  node.dataset.bustSrc = url;
  // 칸 크기는 그림이 풀리기 전에 정한다 — 늦게 정하면 처음 뜰 때 88x92 칸이 128x128 로 한 번 커진다.
  if (LARGE_BUST_PATH.test(url)) node.dataset.bustLarge = "1";
  else delete node.dataset.bustLarge;
  const apply = (rendered: RenderedBust | null): void => {
    if (rendered && node.dataset.bustSrc === url && node.closest('[data-monster-style="emerald"]')) {
      node.style.backgroundImage = `url("${rendered.dataUrl}")`;
      node.dataset.bustPixel = "1";
      if (rendered.large) node.dataset.bustLarge = "1";
      else delete node.dataset.bustLarge;
    }
  };
  // 이미 풀린 흉상은 마이크로태스크에서 붙인다 — 노드가 화면에 붙은 뒤(에메랄드 판정), 첫 페인트 전이라 숨은 프레임이 없다.
  if (settled.has(url)) {
    queueMicrotask(() => {
      apply(settled.get(url) ?? null);
      onReady?.();
    });
    return;
  }
  void taskFor(url).then(apply).finally(() => onReady?.());
}
