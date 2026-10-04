/** RGBA 픽셀 버퍼. 브라우저(ImageData)와 노드(pngjs) 양쪽에서 같은 모양으로 쓴다. */
export type RgbaImage = {
  width: number;
  height: number;
  /** 행 우선 RGBA, 길이 width*height*4 */
  data: Uint8ClampedArray;
};

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneImage(image: RgbaImage): RgbaImage {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

export function pixelAt(image: RgbaImage, x: number, y: number): Rgba {
  const i = (y * image.width + x) * 4;
  const d = image.data;
  return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
}

export function setPixel(image: RgbaImage, x: number, y: number, rgba: Rgba): void {
  const i = (y * image.width + x) * 4;
  image.data[i] = rgba[0];
  image.data[i + 1] = rgba[1];
  image.data[i + 2] = rgba[2];
  image.data[i + 3] = rgba[3];
}

export function isOpaque(image: RgbaImage, x: number, y: number): boolean {
  return image.data[(y * image.width + x) * 4 + 3]! > 0;
}

export function rgbKey(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

export function keyRgb(key: number): Rgb {
  return [(key >> 16) & 255, (key >> 8) & 255, key & 255];
}

export type Box = { x: number; y: number; width: number; height: number };

/** 불투명 픽셀을 감싸는 상자. 전부 투명이면 null. */
export function opaqueBounds(image: RgbaImage): Box | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function cropImage(image: RgbaImage, box: Box): RgbaImage {
  const out = createImage(box.width, box.height);
  for (let y = 0; y < box.height; y += 1) {
    const src = ((box.y + y) * image.width + box.x) * 4;
    out.data.set(image.data.subarray(src, src + box.width * 4), y * box.width * 4);
  }
  return out;
}

export function cropToInk(image: RgbaImage): RgbaImage {
  const box = opaqueBounds(image);
  if (!box) throw new Error("그림에 불투명 픽셀이 없다");
  return cropImage(image, box);
}

/** 최근접 정수 확대 */
export function scaleNearest(image: RgbaImage, factor: number): RgbaImage {
  const out = createImage(image.width * factor, image.height * factor);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      setPixel(out, x, y, pixelAt(image, Math.floor(x / factor), Math.floor(y / factor)));
    }
  }
  return out;
}

/** 단색 바탕 위에 그림을 놓는다 (알파 0/255 가정). */
export function composeOn(background: Rgba, width: number, height: number, image: RgbaImage, left: number, top: number): RgbaImage {
  const out = createImage(width, height);
  for (let i = 0; i < width * height; i += 1) out.data.set(background, i * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const p = pixelAt(image, x, y);
      if (p[3] > 0 && left + x >= 0 && left + x < width && top + y >= 0 && top + y < height) setPixel(out, left + x, top + y, p);
    }
  }
  return out;
}
