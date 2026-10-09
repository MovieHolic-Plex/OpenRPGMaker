// 참고문서 그림에 번호를 찍는 5×7 숫자 글꼴. 브라우저·Node 어디서나 같은 RGBA 버퍼에 그린다
// (Node 쪽에는 글꼴 렌더러가 없다). 번호 → 이름 대응은 그림 설명 글이 준다.

import type { RgbaImage } from "./bake";

const GLYPHS: Record<string, readonly string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

/** (x, y) 에 검은 바탕 노란 숫자를 찍는다. scale 배로 키운다. */
export function drawNumber(image: RgbaImage, x: number, y: number, value: number, scale = 2): void {
  const text = String(value);
  const width = (text.length * 6 + 1) * scale;
  const height = 9 * scale;
  const put = (px: number, py: number, rgb: readonly [number, number, number]) => {
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
    const i = (py * image.width + px) * 4;
    image.data[i] = rgb[0]; image.data[i + 1] = rgb[1]; image.data[i + 2] = rgb[2]; image.data[i + 3] = 255;
  };
  for (let py = 0; py < height; py += 1) for (let px = 0; px < width; px += 1) put(x + px, y + py, [0, 0, 0]);
  [...text].forEach((ch, index) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    glyph.forEach((row, gy) => {
      [...row].forEach((bit, gx) => {
        if (bit !== "1") return;
        for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
          put(x + (1 + index * 6 + gx) * scale + sx, y + (1 + gy) * scale + sy, [255, 230, 0]);
        }
      });
    });
  });
}
