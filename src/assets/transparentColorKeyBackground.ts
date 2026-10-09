import { applyTransparentColorKey } from "@/assets/transparentColorKey";

const transparentImageCache = new Map<string, Promise<string>>();

class TransparentColorKeyBackgroundError extends Error {
  constructor(readonly imagePath: string, message: string) {
    super(`${message}: ${imagePath}`);
    this.name = "TransparentColorKeyBackgroundError";
  }
}

export function applyTransparentColorKeyBackground(target: HTMLElement, imagePath: string): void {
  target.dataset.transparentColorKeyPath = imagePath;
  target.dataset.transparentColorKey = "pending";
  target.style.backgroundImage = "none";
  void transparentColorKeyDataUrl(imagePath)
    .then((dataUrl) => {
      if (target.dataset.transparentColorKeyPath !== imagePath) return;
      target.style.backgroundImage = `url("${dataUrl}")`;
      target.dataset.transparentColorKey = "applied";
    })
    .catch(() => {
      if (target.dataset.transparentColorKeyPath !== imagePath) return;
      target.style.backgroundImage = `url("${imagePath}")`;
      target.dataset.transparentColorKey = "fallback";
    });
}

export function transparentColorKeyDataUrl(imagePath: string): Promise<string> {
  const cached = transparentImageCache.get(imagePath);
  if (cached) return cached;
  const next = createTransparentColorKeyDataUrl(imagePath);
  transparentImageCache.set(imagePath, next);
  return next;
}

function createTransparentColorKeyDataUrl(imagePath: string): Promise<string> {
  return loadImage(imagePath).then((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || canvas.width <= 0 || canvas.height <= 0) {
      throw new TransparentColorKeyBackgroundError(imagePath, "투명색 처리용 캔버스를 만들 수 없습니다");
    }
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyTransparentColorKey(imageData.data);
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  });
}

function loadImage(imagePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new TransparentColorKeyBackgroundError(imagePath, "이미지를 로드할 수 없습니다"));
    image.src = imagePath;
  });
}
