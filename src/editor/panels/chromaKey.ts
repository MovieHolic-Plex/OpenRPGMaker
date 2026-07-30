
import { applyAutoTransparencyKey } from "@/assets/transparentColorKey";

export interface MagentaChromaKeyOptions {
  readonly minRed?: number;
  readonly maxGreen?: number;
  readonly minBlue?: number;
}

const DEFAULT_MAGENTA_CHROMA_KEY_OPTIONS: Required<MagentaChromaKeyOptions> = {
  minRed: 220,
  maxGreen: 80,
  minBlue: 180,
};

export function isMagentaChromaKeyPixel(
  red: number,
  green: number,
  blue: number,
  options: MagentaChromaKeyOptions = {}
): boolean {
  const resolved = { ...DEFAULT_MAGENTA_CHROMA_KEY_OPTIONS, ...options };
  return red > resolved.minRed && green < resolved.maxGreen && blue > resolved.minBlue;
}

export function applyMagentaChromaKey(image: HTMLImageElement, options?: MagentaChromaKeyOptions): void {
  const apply = (): void => {
    if (image.dataset.chromaKeyed === "true") return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index] ?? 0;
      const green = pixels.data[index + 1] ?? 0;
      const blue = pixels.data[index + 2] ?? 0;
      if (isMagentaChromaKeyPixel(red, green, blue, options)) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    image.dataset.chromaKeyed = "true";
    image.src = canvas.toDataURL("image/png");
  };
  if (image.complete) {
    apply();
    return;
  }
  image.addEventListener("load", apply, { once: true });
}

export function applyMagentaChromaKeyToImageData(imageData: ImageData, options?: MagentaChromaKeyOptions): void {
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    if (isMagentaChromaKeyPixel(red, green, blue, options)) data[index + 3] = 0;
  }
}


/**
 * 자동 투명색 처리를 HTMLImageElement 에 적용한다.
 * `applyMagentaChromaKey` 와 동일 패턴이지만, 마젠타만 제거하지 않고
 * `applyAutoTransparencyKey`(표준 키 + 테두리 배경색 자동 감지)를 쓴다.
 * 배경이 이미 투명 PNG 면 no-op, 단색 배경(마젠타/녹성/검은 등)이면 자동 키아웃.
 */
export function applyAutoChromaKey(image: HTMLImageElement): void {
  const apply = (): void => {
    if (image.dataset.autoChromaKeyed === "true") return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    applyAutoTransparencyKey(imageData.data, width, height);
    context.putImageData(imageData, 0, 0);
    image.dataset.autoChromaKeyed = "true";
    image.src = canvas.toDataURL("image/png");
  };
  if (image.complete && image.naturalWidth > 0) {
    apply();
    return;
  }
  image.addEventListener("load", apply, { once: true });
}

const autoKeyedUrlCache = new Map<string, string>();

/**
 * URL → 자동 키 처리된 dataURL 을 반환한다 (URL 단위 메모이제이션).
 * CSS background-image 로 스프라이트 시트를 표시하는 호출지점(editor 미리보기/썸네일)
 * 용도. 원본이 이미 투명 PNG 면 원본 URL 을 그대로 돌려주어 dataURL 변환 비용을 피한다.
 * 단색 배경 시트면 키 처리된 PNG dataURL 을 돌려준다.
 */
export function getAutoKeyedDataUrl(url: string): Promise<string> {
  const cached = autoKeyedUrlCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width <= 0 || height <= 0) {
        autoKeyedUrlCache.set(url, url);
        resolve(url);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        autoKeyedUrlCache.set(url, url);
        resolve(url);
        return;
      }
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, width, height);
      applyAutoTransparencyKey(imageData.data, width, height);
      context.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      autoKeyedUrlCache.set(url, dataUrl);
      resolve(dataUrl);
    }, { once: true });
    image.addEventListener("error", () => {
      autoKeyedUrlCache.set(url, url);
      resolve(url);
    }, { once: true });
    image.src = url;
  });
}

/**
 * CSS background-image 엘리먼트에 자동 키 처리를 비동기 적용한다.
 * 즉시 원본 URL 을 배경으로 세팅하고, 키 처리가 끝나면 dataURL 로 교체한다.
 * 투명 PNG 면 캐시가 원본 URL 을 돌려주어 교체가 no-op 가 된다 (깜빡임 없음).
 */
export function applyAutoChromaKeyToBackground(element: HTMLElement, url: string): void {
  if (!url) return;
  void getAutoKeyedDataUrl(url).then((keyedUrl) => {
    if (keyedUrl !== url && element.isConnected) {
      element.style.backgroundImage = `url("${keyedUrl}")`;
    }
  });
}
