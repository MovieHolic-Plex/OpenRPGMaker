/**
 * 『강호의 철련』 설린 걷기 칩·흉상·전투/오프닝 배경.
 * 생성 그림이 아니다. pngjs 로 칸을 찍는다. 산출물은 src/project/flagship/ironLotusArt.ts.
 *
 *   node scripts/content/iron-lotus-art.mjs
 */
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const CLEAR = [0, 0, 0, 0];
const HAIR = [214, 224, 232, 255];
const HAIR_D = [128, 146, 166, 255];
const SKIN = [236, 214, 196, 255];
const SKIN_D = [196, 156, 140, 255];
const VISOR = [72, 244, 224, 255];
const VISOR_H = [220, 255, 250, 255];
const VISOR_D = [16, 96, 108, 255];
const COAT = [32, 40, 72, 255];
const COAT_L = [58, 70, 112, 255];
const COAT_D = [16, 20, 40, 255];
const SEAM = [150, 255, 232, 255];
const METAL = [176, 186, 198, 255];
const BOOT = [14, 16, 26, 255];

function png(w, h) {
  return new PNG({ width: w, height: h, colorType: 6 });
}
function px(im, x, y, c) {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height || !c || c[3] === 0) return;
  const i = (im.width * y + x) << 2;
  im.data[i] = c[0];
  im.data[i + 1] = c[1];
  im.data[i + 2] = c[2];
  im.data[i + 3] = c[3];
}
function rect(im, x, y, w, h, c) {
  for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) px(im, x + xx, y + yy, c);
}
function ellipse(im, cx, cy, rx, ry, c) {
  const rrx = rx * rx || 1;
  const rry = ry * ry || 1;
  for (let y = -ry; y <= ry; y += 1) {
    for (let x = -rx; x <= rx; x += 1) {
      if ((x * x) / rrx + (y * y) / rry <= 1) px(im, cx + x, cy + y, c);
    }
  }
}
function scale(src, factor) {
  const out = png(src.width * factor, src.height * factor);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const i = (src.width * y + x) << 2;
      const c = [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
      rect(out, x * factor, y * factor, factor, factor, c);
    }
  }
  return out;
}
function b64(im) {
  return `data:image/png;base64,${PNG.sync.write(im).toString("base64")}`;
}

/** RM2000 한 칸 24×32. 모자 없음. 은발, 청록 바이저, 남색 무복, 가슴의 심. */
function drawFrame(im, ox, oy, facing, frame) {
  const leg = frame === 0 ? -1 : frame === 2 ? 1 : 0;
  const side = facing === "left" || facing === "right";
  const flip = facing === "right";
  const at = (x, y, c) => px(im, ox + (flip ? 23 - x : x), oy + y, c);
  const box = (x, y, w, h, c) => {
    for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) at(x + xx, y + yy, c);
  };
  if (facing === "up") {
    box(7, 2, 10, 4, HAIR);
    box(6, 5, 12, 6, HAIR);
    box(8, 6, 8, 3, HAIR_D);
    box(11, 4, 2, 2, SEAM);
    box(6, 12, 12, 11, COAT);
    box(7, 12, 10, 2, COAT_L);
    box(11, 14, 2, 7, SEAM);
    box(8, 23 + (leg < 0 ? 0 : 0), 3, 7, BOOT);
    box(13, 23, 3, 7, BOOT);
    if (leg < 0) box(7, 28, 3, 2, BOOT);
    if (leg > 0) box(14, 28, 3, 2, BOOT);
    box(5, 14, 2, 6, COAT_D);
    box(17, 14, 2, 6, COAT_D);
    return;
  }
  if (side) {
    box(9, 2, 7, 3, HAIR);
    box(8, 5, 8, 7, HAIR);
    box(10, 8, 5, 4, SKIN);
    box(9, 9, 2, 2, VISOR);
    box(8, 10, 2, 1, VISOR_H);
    at(14, 6, METAL);
    at(15, 6, SEAM);
    box(8, 13, 8, 10, COAT);
    box(9, 13, 6, 1, SEAM);
    box(11, 16, 2, 2, SEAM);
    box(10, 23, 3, 7, BOOT);
    if (leg !== 0) box(9 + (leg > 0 ? 2 : 0), 28, 3, 2, BOOT);
    box(7, 15, 2, 5, COAT_D);
    return;
  }
  box(7, 1, 10, 3, HAIR);
  box(6, 4, 12, 4, HAIR);
  box(8, 7, 8, 5, SKIN);
  box(7, 8, 2, 4, HAIR_D);
  box(15, 8, 2, 4, HAIR_D);
  box(8, 9, 8, 2, VISOR_D);
  box(8, 9, 8, 1, VISOR);
  box(9, 9, 2, 1, VISOR_H);
  box(11, 12, 2, 1, SKIN_D);
  box(5, 6, 2, 2, METAL);
  box(17, 6, 2, 2, METAL);
  at(5, 6, SEAM);
  at(18, 6, SEAM);
  box(6, 13, 12, 10, COAT);
  box(8, 13, 8, 1, SEAM);
  box(10, 16, 4, 3, COAT_L);
  box(11, 16, 2, 2, SEAM);
  box(4, 14, 2, 6, COAT_D);
  box(18, 14, 2, 6, COAT_D);
  box(8, 23, 3, 7, BOOT);
  box(13, 23, 3, 7, BOOT);
  if (leg < 0) { box(7, 27, 3, 3, BOOT); box(14, 24, 3, 6, BOOT); }
  if (leg > 0) { box(14, 27, 3, 3, BOOT); box(7, 24, 3, 6, BOOT); }
  if (leg === 0) { box(8, 28, 3, 2, BOOT); box(13, 28, 3, 2, BOOT); }
}

function charset() {
  const im = png(288, 256);
  const facings = ["down", "left", "right", "up"];
  for (let row = 0; row < 4; row += 1) {
    for (let frame = 0; frame < 3; frame += 1) drawFrame(im, frame * 24, row * 32, facings[row], frame);
  }
  return im;
}

function bustCell() {
  const im = png(96, 128);
  // 걷기 칩과 같은 실루엣: 단발, 청록 바이저, 남색 무복, 가슴의 심. 둥근 헬멧으로 그리지 않는다.
  ellipse(im, 48, 42, 30, 32, HAIR);
  ellipse(im, 48, 36, 24, 14, HAIR_D);
  rect(im, 20, 34, 10, 22, HAIR);
  rect(im, 66, 34, 10, 22, HAIR);
  ellipse(im, 48, 50, 16, 18, SKIN);
  rect(im, 30, 46, 36, 8, VISOR_D);
  rect(im, 30, 47, 36, 4, VISOR);
  rect(im, 34, 47, 8, 2, VISOR_H);
  rect(im, 44, 58, 8, 2, SKIN_D);
  rect(im, 16, 42, 8, 12, METAL);
  rect(im, 18, 46, 4, 4, SEAM);
  rect(im, 72, 42, 8, 12, METAL);
  rect(im, 74, 46, 4, 4, SEAM);
  rect(im, 14, 78, 68, 44, COAT);
  rect(im, 22, 72, 52, 10, COAT_L);
  rect(im, 26, 74, 44, 3, SEAM);
  rect(im, 40, 92, 16, 14, COAT_D);
  rect(im, 44, 96, 8, 8, SEAM);
  rect(im, 8, 86, 10, 28, COAT_D);
  rect(im, 78, 86, 10, 28, COAT_D);
  return scale(im, 2);
}

function sky(im, top, bottom) {
  for (let y = 0; y < im.height; y += 1) {
    const t = y / (im.height - 1);
    const c = top.map((v, i) => i === 3 ? 255 : Math.round(v + (bottom[i] - v) * t));
    rect(im, 0, y, im.width, 1, c);
  }
}
function stalk(im, x, y0, y1, w, color, node) {
  rect(im, x, y0, w, y1 - y0, color);
  for (let y = y0 + 10; y < y1 - 4; y += 14) rect(im, x - 1, y, w + 2, 2, node);
}

function bambooBackdrop() {
  const im = png(320, 180);
  sky(im, [8, 18, 16], [28, 64, 48]);
  rect(im, 0, 132, 320, 48, [28, 36, 24, 255]);
  rect(im, 0, 148, 320, 32, [42, 36, 24, 255]);
  rect(im, 108, 150, 104, 30, [58, 46, 30, 255]);
  for (let i = 0; i < 28; i += 1) {
    const x = 6 + ((i * 37) % 308);
    const back = i % 3 === 0;
    const y0 = back ? 8 + (i % 5) * 4 : 28 + (i % 4) * 6;
    stalk(im, x, y0, 168, back ? 3 : 5, back ? [12, 36, 28, 255] : [22, 78, 48, 255], back ? [18, 48, 36, 255] : [48, 120, 72, 255]);
    if (!back && i % 2 === 0) {
      rect(im, x - 6, y0 + 16, 6, 2, [36, 110, 64, 255]);
      rect(im, x + 5, y0 + 28, 7, 2, [36, 110, 64, 255]);
    }
  }
  ellipse(im, 250, 28, 14, 14, [220, 230, 210, 255]);
  return im;
}

function templeBackdrop() {
  const im = png(320, 180);
  sky(im, [8, 10, 22], [18, 22, 40]);
  rect(im, 0, 120, 320, 60, [48, 46, 52, 255]);
  rect(im, 40, 108, 240, 14, [62, 58, 64, 255]);
  rect(im, 70, 96, 180, 14, [54, 50, 58, 255]);
  rect(im, 96, 78, 128, 20, [36, 28, 32, 255]);
  rect(im, 86, 70, 148, 10, [92, 28, 32, 255]);
  rect(im, 78, 64, 164, 8, [120, 36, 36, 255]);
  rect(im, 150, 40, 20, 26, [70, 64, 60, 255]);
  for (let i = 0; i < 6; i += 1) rect(im, 108 + i * 22, 100, 8, 18, [24, 20, 28, 255]);
  ellipse(im, 46, 100, 8, 8, [255, 170, 70, 255]);
  ellipse(im, 274, 100, 8, 8, [255, 170, 70, 255]);
  rect(im, 120, 140, 80, 8, [90, 82, 70, 255]);
  return im;
}

function townBackdrop() {
  const im = png(320, 180);
  sky(im, [28, 18, 36], [196, 104, 64]);
  rect(im, 0, 108, 320, 72, [54, 40, 32, 255]);
  rect(im, 70, 128, 180, 52, [72, 52, 36, 255]);
  const houses = [[8, 70, 54, 58], [62, 62, 48, 66], [214, 66, 50, 62], [264, 74, 48, 54]];
  for (const [x, y, w, h] of houses) {
    rect(im, x, y, w, h, [42, 32, 36, 255]);
    rect(im, x - 4, y - 8, w + 8, 10, [92, 36, 32, 255]);
    for (let wy = y + 12; wy < y + h - 10; wy += 14) {
      for (let wx = x + 8; wx < x + w - 8; wx += 14) rect(im, wx, wy, 5, 6, [255, 196, 110, 255]);
    }
  }
  ellipse(im, 28, 96, 6, 6, [255, 186, 80, 255]);
  ellipse(im, 292, 100, 6, 6, [255, 186, 80, 255]);
  ellipse(im, 160, 36, 16, 16, [255, 214, 150, 255]);
  return im;
}

const charsetUrl = b64(charset());
const bustUrl = b64(bustCell());
const bambooUrl = b64(bambooBackdrop());
const templeUrl = b64(templeBackdrop());
const townUrl = b64(townBackdrop());

const out = `/** 기계로 찍은 설린 칩·흉상·배경. 생성기는 scripts/content/iron-lotus-art.mjs. 생성 그림 없음. */
import type { Project, UploadedAsset } from "@/project/types";

export const IL_SEOLRIN_CHARSET_ID = "oprn-charset-il-seolrin";
export const IL_SEOLRIN_FACE_ID = "oprn-face-il-seolrin-bust-base";
export const IL_BACKDROP_BAMBOO_ID = "oprn-backdrop-il-bamboo";
export const IL_BACKDROP_TEMPLE_ID = "oprn-backdrop-il-temple";
export const IL_BACKDROP_TOWN_ID = "oprn-backdrop-il-town";

const CHARSET_URL = ${JSON.stringify(charsetUrl)};
const FACE_URL = ${JSON.stringify(bustUrl)};
const BAMBOO_URL = ${JSON.stringify(bambooUrl)};
const TEMPLE_URL = ${JSON.stringify(templeUrl)};
const TOWN_URL = ${JSON.stringify(townUrl)};

function put(project: Project, asset: UploadedAsset): void {
  project.assets.uploaded[asset.id] = { ...asset, meta: { ...asset.meta } };
}

export function installIronLotusArt(project: Project): void {
  put(project, { id: IL_SEOLRIN_CHARSET_ID, name: "설린 · 은발 기계 소녀", kind: "charset", dataUrl: CHARSET_URL, meta: { width: 288, height: 256, frameWidth: 24, frameHeight: 32 } });
  put(project, { id: IL_SEOLRIN_FACE_ID, name: "설린 흉상", kind: "picture", dataUrl: FACE_URL, meta: { width: 192, height: 256 } });
  put(project, { id: IL_BACKDROP_BAMBOO_ID, name: "청죽림 밤", kind: "backdrop", dataUrl: BAMBOO_URL, meta: { width: 320, height: 180 } });
  put(project, { id: IL_BACKDROP_TEMPLE_ID, name: "운무산 사원 밤", kind: "backdrop", dataUrl: TEMPLE_URL, meta: { width: 320, height: 180 } });
  put(project, { id: IL_BACKDROP_TOWN_ID, name: "유하진 해질녘", kind: "backdrop", dataUrl: TOWN_URL, meta: { width: 320, height: 180 } });
}
`;

writeFileSync(new URL("../../src/project/flagship/ironLotusArt.ts", import.meta.url), out);
console.log("wrote ironLotusArt.ts", { charset: charsetUrl.length, bust: bustUrl.length, bamboo: bambooUrl.length });
