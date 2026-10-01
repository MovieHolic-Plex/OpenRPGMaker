// 컷신 그림 후처리 — 생성 이미지를 «움직일 수 있는 그림»으로 만든다.
//   · sprite  : 단색(마젠타) 배경 → 투명, 여백 잘라내기, 긴 변 줄이기
//   · backdrop: 뷰포트 비율로 가운데 잘라내기, 2배 해상도로 줄이기
// 순수 픽셀 함수 + 코덱 두 갈래(브라우저 캔버스 / 노드 pngjs). 노드에서는 PNG 만 읽는다 —
// 헤드리스 하네스가 JPEG 응답을 PNG 로 바꿔 건넨다(scripts/qa-game/lib/headlessImage.mts).

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface KeyColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// 노드 전용 경로(pngjs 3.4 는 진짜 Buffer 를 요구한다). 앱 타입 설정에는 Buffer 선언이 없어 globalThis 로 느슨하게 접근한다 —
// 이 분기는 캔버스가 없는 노드(헤드리스 하네스)에서만 탄다.
interface NodeBufferStatic { from(data: string | Uint8Array, encoding?: string): Uint8Array & { toString(encoding: string): string } }
const nodeBuffer = (): NodeBufferStatic => (globalThis as unknown as { Buffer: NodeBufferStatic }).Buffer;
const base64ToBytes = (base64: string): Uint8Array => nodeBuffer().from(base64, "base64");
const bytesToBase64 = (bytes: Uint8Array): string => nodeBuffer().from(bytes).toString("base64");

const hasCanvas = (): boolean => typeof document !== "undefined" && typeof createImageBitmap === "function";

/** dataURL → RGBA. 브라우저는 캔버스, 노드는 pngjs(PNG 한정). */
export async function decodeImage(dataUrl: string): Promise<RgbaImage> {
  if (hasCanvas()) {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: pixels.width, height: pixels.height, data: pixels.data };
  }
  if (!/^data:image\/png;base64,/u.test(dataUrl)) throw new Error("이 환경에서는 PNG 그림만 처리할 수 있습니다.");
  const specifier = "pngjs";
  const { PNG } = (await import(/* @vite-ignore */ specifier)) as { PNG: { sync: { read(buffer: unknown): { width: number; height: number; data: Uint8Array } } } };
  const png = PNG.sync.read(base64ToBytes(dataUrl.slice(dataUrl.indexOf(",") + 1)));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

export async function encodePng(image: RgbaImage): Promise<string> {
  if (hasCanvas()) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 만들 수 없습니다.");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    return canvas.toDataURL("image/png");
  }
  const specifier = "pngjs";
  const { PNG } = (await import(/* @vite-ignore */ specifier)) as {
    PNG: { sync: { write(png: unknown): Uint8Array } } & (new (options: { width: number; height: number }) => { data: Uint8Array });
  };
  const png = new PNG({ width: image.width, height: image.height });
  png.data.set(image.data);
  return `data:image/png;base64,${bytesToBase64(PNG.sync.write(png))}`;
}

/** 네 모서리 띠의 중앙값 색 — 생성기가 «단색 배경» 지시를 지켰다면 그 색이 배경이다. */
export function estimateBackgroundKey(image: RgbaImage): KeyColor {
  const { width, height, data } = image;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.03));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const push = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  };
  for (const [x0, y0] of [[0, 0], [width - band, 0], [0, height - band], [width - band, height - band]] as const) {
    for (let y = y0; y < y0 + band; y += 1) for (let x = x0; x < x0 + band; x += 1) push(x, y);
  }
  const median = (values: number[]): number => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  return { r: median(rs), g: median(gs), b: median(bs) };
}

const distance = (data: Uint8ClampedArray, i: number, key: KeyColor): number =>
  Math.hypot(data[i]! - key.r, data[i + 1]! - key.g, data[i + 2]! - key.b);

/**
 * 가장자리에서 이어진 «배경색과 비슷한 영역»만 투명하게 만든다(그림 속 같은 색 물체는 살린다).
 * JPEG 번짐을 고려해 경계 한 겹은 거리에 비례해 반투명으로 풀고 배경색 물을 뺀다.
 */
export function chromaKeyFromBorder(image: RgbaImage, key: KeyColor = estimateBackgroundKey(image), hard = 105, soft = 150): RgbaImage {
  const { width, height } = image;
  const data = new Uint8ClampedArray(image.data);
  const background = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (background[p] || distance(data, p * 4, key) > hard) return;
    background[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x += 1) { visit(x, 0); visit(x, height - 1); }
  for (let y = 0; y < height; y += 1) { visit(0, y); visit(width - 1, y); }
  while (queue.length > 0) {
    const p = queue.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
  }
  for (let p = 0; p < width * height; p += 1) {
    if (background[p]) data[p * 4 + 3] = 0;
  }
  // 경계 한 겹: 배경에 닿은 픽셀을 거리로 풀어 준다.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (background[p]) continue;
      const touches = (x > 0 && background[p - 1]) || (x < width - 1 && background[p + 1]) || (y > 0 && background[p - width]) || (y < height - 1 && background[p + width]);
      if (!touches) continue;
      const d = distance(data, p * 4, key);
      if (d >= soft) continue;
      const alpha = Math.max(0, Math.min(1, (d - hard * 0.6) / (soft - hard * 0.6)));
      const i = p * 4;
      if (alpha > 0.05) {
        // 배경색이 섞인 만큼 빼서 마젠타 테두리를 없앤다.
        data[i] = Math.max(0, Math.min(255, (data[i]! - (1 - alpha) * key.r) / alpha));
        data[i + 1] = Math.max(0, Math.min(255, (data[i + 1]! - (1 - alpha) * key.g) / alpha));
        data[i + 2] = Math.max(0, Math.min(255, (data[i + 2]! - (1 - alpha) * key.b) / alpha));
      }
      data[i + 3] = Math.round(alpha * data[i + 3]!);
    }
  }
  despillKey(data, width, height, background);
  return { width, height, data };
}

/** 마젠타 기운: 빨강·파랑이 초록보다 얼마나 센가. 사람 피부·갈색·남색은 0 아래이거나 낮다. */
const pinkness = (data: Uint8ClampedArray, i: number): number => Math.min(data[i]!, data[i + 2]!) - data[i + 1]!;

/**
 * 배경색이 번진 자리를 지운다 — 생성기가 헤드라이트 빛줄기·유리 반사를 마젠타 위에 그리면 «거의 배경색» 이 아니라
 * 분홍빛 반투명으로 남아 단색 판정을 빠져나갔다(2026-10-02 조수 시험: 트럭 앞의 분홍 빛줄기·앞유리 보라색).
 *  1) 배경에서 분홍빛이 이어지는 영역은 분홍 정도에 비례해 투명하게(빛줄기 제거),
 *  2) 어디든 아주 센 마젠타 점은 지우고(프롬프트가 소품 안의 마젠타를 금지한다),
 *  3) 남은 분홍·보라 기운은 색만 눌러 회청색으로 만든다(앞유리 보존).
 */
function despillKey(data: Uint8ClampedArray, width: number, height: number, background: Uint8Array): void {
  const halo = new Uint8Array(width * height);
  const queue: number[] = [];
  const consider = (p: number): void => {
    if (halo[p] || background[p] || pinkness(data, p * 4) <= 30) return;
    halo[p] = 1;
    queue.push(p);
  };
  for (let p = 0; p < width * height; p += 1) {
    if (!background[p]) continue;
    const x = p % width;
    if (x > 0) consider(p - 1);
    if (x < width - 1) consider(p + 1);
    if (p >= width) consider(p - width);
    if (p < width * (height - 1)) consider(p + width);
  }
  while (queue.length > 0) {
    const p = queue.pop()!;
    const x = p % width;
    if (x > 0) consider(p - 1);
    if (x < width - 1) consider(p + 1);
    if (p >= width) consider(p - width);
    if (p < width * (height - 1)) consider(p + width);
  }
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (background[p] || data[i + 3] === 0) continue;
    const pink = pinkness(data, i);
    if (halo[p]) {
      data[i + 3] = Math.round(data[i + 3]! * Math.max(0, Math.min(1, 1 - (pink - 30) / 45)));
    } else if (pink > 110) {
      data[i + 3] = 0;
    }
    if (pink > 40 && data[i + 3] !== 0) {
      const g = data[i + 1]!;
      data[i] = Math.min(data[i]!, g + 30);
      data[i + 2] = Math.min(data[i + 2]!, g + 30);
    }
  }
}

/** 투명이 아닌 영역으로 자른다(pad 칸 여유). 전부 투명이면 null. */
export function cropToOpaqueBounds(image: RgbaImage, pad = 2): RgbaImage | null {
  const { width, height, data } = image;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width - 1, maxX + pad), y1 = Math.min(height - 1, maxY + pad);
  return crop(image, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

export function crop(image: RgbaImage, x0: number, y0: number, w: number, h: number): RgbaImage {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const from = ((y0 + y) * image.width + x0) * 4;
    out.set(image.data.subarray(from, from + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** 가로세로 비율(aspect = 가로/세로)에 맞춰 가운데를 자른다. */
export function coverCrop(image: RgbaImage, aspect: number): RgbaImage {
  const current = image.width / image.height;
  if (Math.abs(current - aspect) < 0.005) return image;
  if (current > aspect) {
    const w = Math.round(image.height * aspect);
    return crop(image, Math.round((image.width - w) / 2), 0, w, image.height);
  }
  const h = Math.round(image.width / aspect);
  return crop(image, 0, Math.round((image.height - h) / 2), image.width, h);
}

/** 알파 가중 평균으로 줄이거나(상자 필터) 늘린다(이중선형). 가장자리가 마젠타·검정으로 번지지 않는다. */
export function resize(image: RgbaImage, width: number, height: number): RgbaImage {
  if (width === image.width && height === image.height) return image;
  const out = new Uint8ClampedArray(width * height * 4);
  const sx = image.width / width;
  const sy = image.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const fx0 = x * sx, fx1 = (x + 1) * sx, fy0 = y * sy, fy1 = (y + 1) * sy;
      let r = 0, g = 0, b = 0, a = 0, weight = 0;
      const ix0 = Math.floor(fx0), ix1 = Math.min(image.width, Math.ceil(fx1));
      const iy0 = Math.floor(fy0), iy1 = Math.min(image.height, Math.ceil(fy1));
      for (let iy = iy0; iy < iy1; iy += 1) {
        const wy = Math.min(fy1, iy + 1) - Math.max(fy0, iy);
        for (let ix = ix0; ix < ix1; ix += 1) {
          const wx = Math.min(fx1, ix + 1) - Math.max(fx0, ix);
          const w = wx * wy;
          const i = (iy * image.width + ix) * 4;
          const pa = image.data[i + 3]! / 255;
          r += image.data[i]! * pa * w; g += image.data[i + 1]! * pa * w; b += image.data[i + 2]! * pa * w;
          a += pa * w; weight += w;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = weight > 0 ? (a / weight) * 255 : 0;
    }
  }
  return { width, height, data: out };
}

/** 긴 변이 maxSide 를 넘으면 비율대로 줄인다. */
export function fitWithin(image: RgbaImage, maxSide: number): RgbaImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxSide) return image;
  const k = maxSide / longest;
  return resize(image, Math.max(1, Math.round(image.width * k)), Math.max(1, Math.round(image.height * k)));
}

export interface ProcessedArt {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

/** 움직일 소품·인물: 단색 배경 제거 → 여백 제거 → 긴 변 maxSide. */
export async function processSpriteArt(sourceDataUrl: string, maxSide = 384): Promise<ProcessedArt> {
  const keyed = chromaKeyFromBorder(await decodeImage(sourceDataUrl));
  const cropped = cropToOpaqueBounds(keyed);
  if (!cropped) throw new Error("배경을 지운 뒤 남은 그림이 없습니다 — 단색 배경이 아니거나 그림이 비었습니다.");
  const fitted = fitWithin(cropped, maxSide);
  return { dataUrl: await encodePng(fitted), width: fitted.width, height: fitted.height };
}

/** 전체화면 배경: 뷰포트 비율로 가운데를 자르고 가로 targetWidth 로 맞춘다. */
export async function processBackdropArt(sourceDataUrl: string, viewport: { readonly width: number; readonly height: number }, targetWidth = viewport.width * 2): Promise<ProcessedArt> {
  const covered = coverCrop(await decodeImage(sourceDataUrl), viewport.width / viewport.height);
  const width = Math.min(covered.width, Math.round(targetWidth));
  const height = Math.round(width * (viewport.height / viewport.width));
  const fitted = resize(covered, width, height);
  return { dataUrl: await encodePng(fitted), width: fitted.width, height: fitted.height };
}
