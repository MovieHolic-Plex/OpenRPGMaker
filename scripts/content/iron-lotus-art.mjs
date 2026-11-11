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
  // 걷기 칩의 앞모습을 키운 것. 은발 단발, 눈 대신 청록 바이저, 남색 무복, 가슴의 심.
  const im = png(96, 128);
  rect(im, 28, 8, 40, 10, HAIR);
  rect(im, 22, 16, 52, 18, HAIR);
  rect(im, 26, 18, 44, 8, HAIR_D);
  rect(im, 34, 30, 28, 22, SKIN);
  rect(im, 24, 28, 8, 16, HAIR);
  rect(im, 64, 28, 8, 16, HAIR);
  rect(im, 32, 38, 32, 8, VISOR_D);
  rect(im, 32, 39, 32, 4, VISOR);
  rect(im, 36, 40, 8, 2, VISOR_H);
  rect(im, 44, 48, 8, 2, SKIN_D);
  rect(im, 18, 32, 6, 10, METAL);
  rect(im, 20, 35, 3, 3, SEAM);
  rect(im, 72, 32, 6, 10, METAL);
  rect(im, 73, 35, 3, 3, SEAM);
  rect(im, 40, 52, 16, 8, SKIN);
  rect(im, 18, 64, 60, 52, COAT);
  rect(im, 26, 60, 44, 10, COAT_L);
  rect(im, 30, 62, 36, 3, SEAM);
  rect(im, 40, 82, 16, 14, COAT_D);
  rect(im, 44, 86, 8, 8, SEAM);
  rect(im, 10, 72, 10, 28, COAT_D);
  rect(im, 76, 72, 10, 28, COAT_D);
  return scale(im, 2);
}

/** 파티 전투 시트 48px, 왼쪽을 본다. 3열×8행. */
function drawBattler(im, ox, oy, pose) {
  const lean = pose === "hit" ? 1 : pose === "attack" || pose === "strike" ? -1 : 0;
  const arm = pose === "attack" || pose === "strike" || pose === "skill" ? -4 : 0;
  const crouch = pose === "weak" ? 1 : 0;
  const leg = pose === "walkb" ? 1 : pose === "walkc" ? -1 : 0;
  const at = (x, y, c) => px(im, ox + x + lean, oy + y + crouch, c);
  const box = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) at(x + xx, y + yy, c); };
  if (pose === "dead" || pose === "dying") {
    box(2, 16, 20, 5, COAT);
    box(3, 14, 10, 4, HAIR);
    box(4, 15, 8, 2, VISOR);
    return;
  }
  box(7, 1, 10, 3, HAIR);
  box(6, 3, 12, 4, HAIR);
  box(8, 5, 8, 4, SKIN);
  box(7, 6, 10, 2, VISOR);
  box(5, 4, 2, 2, METAL);
  at(5, 4, SEAM);
  box(5, 9, 12, 8, COAT);
  box(6, 9, 10, 1, SEAM);
  box(9, 11, 3, 2, SEAM);
  box(2 + Math.max(-2, arm), 10, 5, 2, COAT_L);
  box(1 + Math.max(-2, arm), 10, 4, 1, SEAM);
  box(7, 17, 3, 5 + (leg > 0 ? 1 : 0), BOOT);
  box(12, 17, 3, 5 + (leg < 0 ? 1 : 0), BOOT);
}

function paintCell(im, ox, oy, draw) {
  const tmp = png(24, 24);
  draw(tmp);
  for (let y = 0; y < 24; y += 1) for (let x = 0; x < 24; x += 1) {
    const si = (y * 24 + x) * 4;
    const c = [tmp.data[si], tmp.data[si + 1], tmp.data[si + 2], tmp.data[si + 3]];
    if (!c[3]) continue;
    rect(im, ox + x * 2, oy + y * 2, 2, 2, c);
  }
}

function battlerSheet() {
  const im = png(144, 384);
  const poses = [
    "idle", "attack", "hit",
    "defend", "dead", "victory",
    "walka", "walkb", "walkc",
    "attack", "strike", "attack",
    "skill", "skill", "skill",
    "item", "weak", "evade",
    "guard", "skill", "victory",
    "dying", "revive", "front",
  ];
  poses.forEach((pose, i) => paintCell(im, (i % 3) * 48, Math.floor(i / 3) * 48, (cell) => drawBattler(cell, 0, 0, pose)));
  return im;
}

function drawFoe(im, ox, oy, kind, pose) {
  const lunge = pose === "attack" || pose === "move" ? 4 : pose === "hit" ? -3 : 0;
  const at = (x, y, c) => px(im, ox + Math.round((x + lunge) * 1.35) - 6, oy + Math.round(y * 1.2) - 4, c);
  const box = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) at(x + xx, y + yy, c); };
  if (pose === "dead") { box(8, 34, 32, 6, kind === "puppet" ? METAL : COAT_D); return; }
  if (kind === "snake") {
    box(18, 16, 16, 8, [40, 120, 60, 255]);
    box(28, 14, 8, 6, [70, 160, 80, 255]);
    box(34, 16, 3, 2, [180, 40, 40, 255]);
    box(10, 22, 22, 6, [30, 90, 48, 255]);
    box(8, 28, 14, 5, [24, 70, 40, 255]);
    return;
  }
  if (kind === "wolf") {
    box(10, 20, 26, 10, [28, 28, 34, 255]);
    box(30, 16, 10, 8, [40, 40, 48, 255]);
    box(36, 18, 4, 2, [200, 40, 40, 255]);
    box(12, 30, 5, 8, [16, 16, 20, 255]);
    box(28, 30, 5, 8, [16, 16, 20, 255]);
    return;
  }
  if (kind === "puppet") {
    box(16, 6, 16, 10, METAL);
    box(18, 9, 12, 3, VISOR);
    box(14, 16, 20, 16, [90, 98, 110, 255]);
    box(22, 20, 4, 4, SEAM);
    box(16, 32, 6, 8, BOOT);
    box(26, 32, 6, 8, BOOT);
    box(pose === "attack" ? 34 : 30, 18, 8, 3, SEAM);
    return;
  }
  const robe = kind === "assassin" ? [16, 12, 22, 255] : kind === "bandit" ? [92, 48, 32, 255] : [36, 28, 64, 255];
  const cloth = kind === "assassin" ? [8, 8, 12, 255] : [48, 32, 28, 255];
  box(18, 4, 12, 6, cloth);
  box(16, 8, 14, 8, SKIN);
  if (kind === "assassin") box(16, 10, 14, 3, [20, 20, 24, 255]);
  else box(18, 10, 8, 2, [40, 28, 24, 255]);
  box(14, 16, 18, 16, robe);
  box(pose === "attack" ? 32 : 28, 18, 10, 2, [210, 210, 220, 255]);
  box(16, 32, 5, 8, BOOT);
  box(24, 32, 5, 8, BOOT);
}

function foeSheet(kind) {
  const cell = 48;
  const im = png(cell * 5, cell * 4);
  const poses = ["idle", "idle", "idle", "windup", "move", "attack", "recover", "hit", "dead", "attack", "skill", "skill", "defend", "weak", "intro", "move", "hit", "attack", "weak", "skill"];
  poses.forEach((pose, i) => drawFoe(im, (i % 5) * cell, Math.floor(i / 5) * cell, kind, pose));
  return im;
}

function cellCrop(sheet, col, row, cell) {
  const out = png(cell, cell);
  for (let y = 0; y < cell; y += 1) for (let x = 0; x < cell; x += 1) {
    const si = ((row * cell + y) * sheet.width + col * cell + x) * 4;
    const di = (y * cell + x) * 4;
    out.data[di] = sheet.data[si];
    out.data[di + 1] = sheet.data[si + 1];
    out.data[di + 2] = sheet.data[si + 2];
    out.data[di + 3] = sheet.data[si + 3];
  }
  return out;
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
function endingBackdrop() {
  const im = townBackdrop();
  for (let i = 0; i < im.data.length; i += 4) {
    if (im.data[i + 3] === 0) continue;
    im.data[i] = Math.min(255, im.data[i] + 80);
    im.data[i + 1] = Math.min(255, im.data[i + 1] + 64);
    im.data[i + 2] = Math.min(255, im.data[i + 2] + 48);
  }
  return im;
}
const endingUrl = b64(endingBackdrop());
const battlerUrl = b64(battlerSheet());
const foes = ["snake", "assassin", "disciple", "bandit", "puppet", "wolf"].map((kind) => {
  const sheet = foeSheet(kind);
  return { kind, sheet: b64(sheet), portrait: b64(cellCrop(sheet, 0, 0, 48)) };
});

const out = `/** 기계로 찍은 설린 칩·흉상·배경. 생성기는 scripts/content/iron-lotus-art.mjs. 생성 그림 없음. */
import type { Project, UploadedAsset } from "@/project/types";

export const IL_SEOLRIN_CHARSET_ID = "oprn-charset-il-seolrin";
export const IL_SEOLRIN_FACE_ID = "oprn-face-il-seolrin-bust-base";
export const IL_BACKDROP_BAMBOO_ID = "oprn-backdrop-il-bamboo";
export const IL_BACKDROP_TEMPLE_ID = "oprn-backdrop-il-temple";
export const IL_BACKDROP_TOWN_ID = "oprn-backdrop-il-town";
export const IL_BACKDROP_ENDING_ID = "oprn-backdrop-il-ending";
export const IL_SEOLRIN_BATTLER_ID = "oprn-battle-il-seolrin";

const CHARSET_URL = ${JSON.stringify(charsetUrl)};
const FACE_URL = ${JSON.stringify(bustUrl)};
const BAMBOO_URL = ${JSON.stringify(bambooUrl)};
const TEMPLE_URL = ${JSON.stringify(templeUrl)};
const TOWN_URL = ${JSON.stringify(townUrl)};
const ENDING_URL = ${JSON.stringify(endingUrl)};
const BATTLER_URL = ${JSON.stringify(battlerUrl)};
const FOES = ${JSON.stringify(foes)} as readonly { kind: string; sheet: string; portrait: string }[];

function put(project: Project, asset: UploadedAsset): void {
  project.assets.uploaded[asset.id] = { ...asset, meta: { ...asset.meta } };
}

export function installIronLotusArt(project: Project): void {
  put(project, { id: IL_SEOLRIN_CHARSET_ID, name: "설린 · 은발 기계 소녀", kind: "charset", dataUrl: CHARSET_URL, meta: { width: 288, height: 256, frameWidth: 24, frameHeight: 32 } });
  put(project, { id: IL_SEOLRIN_FACE_ID, name: "설린 흉상", kind: "picture", dataUrl: FACE_URL, meta: { width: 192, height: 256 } });
  put(project, { id: IL_BACKDROP_BAMBOO_ID, name: "청죽림 밤", kind: "backdrop", dataUrl: BAMBOO_URL, meta: { width: 320, height: 180 } });
  put(project, { id: IL_BACKDROP_TEMPLE_ID, name: "운무산 사원 밤", kind: "backdrop", dataUrl: TEMPLE_URL, meta: { width: 320, height: 180 } });
  put(project, { id: IL_BACKDROP_TOWN_ID, name: "유하진 해질녘", kind: "backdrop", dataUrl: TOWN_URL, meta: { width: 320, height: 180 } });
  put(project, { id: IL_BACKDROP_ENDING_ID, name: "제1막 끝", kind: "backdrop", dataUrl: ENDING_URL, meta: { width: 320, height: 180 } });
  put(project, {
    id: IL_SEOLRIN_BATTLER_ID, name: "설린 전투", kind: "battleCharset", dataUrl: BATTLER_URL,
    meta: { width: 144, height: 384, frameWidth: 48, frameHeight: 48, frames: 24 },
  });
  for (const foe of FOES) {
    const id = ({
      snake: "generated-enemy-snake-viper",
      assassin: "generated-enemy-bandit-mask",
      disciple: "generated-enemy-orc-01",
      bandit: "generated-enemy-orc-warrior",
      puppet: "generated-enemy-slime-metal",
      wolf: "generated-enemy-wolf-dire",
    } as Record<string, string>)[foe.kind]!;
    const sheetId = \`\${id}-sheet\`;
    put(project, { id: sheetId, name: \`\${foe.kind} 시트\`, kind: "picture", dataUrl: foe.sheet, meta: { width: 240, height: 192, frameWidth: 48, frameHeight: 48, frames: 20 } });
    put(project, {
      id, name: foe.kind, kind: "monster", dataUrl: foe.portrait,
      meta: { width: 48, height: 48, pixelEnemySheet: { sheetResourceId: sheetId, cell: 48, motion: foe.kind === "snake" ? "dash" : foe.kind === "wolf" ? "dash" : foe.kind === "puppet" ? "stomp" : "shoot", idleFrameMs: 180, grid: "5x4" } },
    });
  }
}
`;

writeFileSync(new URL("../../src/project/flagship/ironLotusArt.ts", import.meta.url), out);
console.log("wrote ironLotusArt.ts", { charset: charsetUrl.length, bust: bustUrl.length, bamboo: bambooUrl.length });
