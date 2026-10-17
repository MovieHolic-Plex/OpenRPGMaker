// player/modernCityTransitTexture.ts
// modern_city 차량 키트(mc-veh-*)를 이미 로드된 tex_modern_city 시트에서 읽어,
// 바퀴 스포크 4상 회전 · 차체 1px 서스펜션 바운스(타이어·그림자 접지 고정) · 경광등/방향지시등/브레이크등 ·
// 버스 중앙 폴딩 도어 개폐 · 원본 칩셋(mc-veh-car-front-a* / mc-veh-car-back-a* + 원본 경광등/택시갓 이식)
// 기반 남북(up/down) 프레임을 갖춘 Phaser 캔버스 텍스처로 조립한다.
import type Phaser from "phaser";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createModernCityTileset, MODERN_CITY_TEXTURE } from "@/project/defaults/modernCity";
import type { TransitVehicleDef } from "@/project/mapTransit";
import type { StructureKitDef } from "@/project/types";
import { renderHandNsFrame } from "./modernCityNsGrids";

const TILE = 16;
const TILES_PER_ROW = 48;

interface KitPair {
  readonly back: string;
  readonly front: string;
  readonly beacon?: "police" | "emergency" | "taxi";
  readonly dualBounce?: boolean;
}

const KIT_META: Readonly<Record<string, KitPair>> = {
  "mc-veh-police-a": { back: "mc-veh-car-back-a", front: "mc-veh-car-front-a", beacon: "police" },
  "mc-veh-taxi-b": { back: "mc-veh-car-back-a", front: "mc-veh-car-front-a", beacon: "taxi" },
  "mc-veh-car2-c-red": { back: "mc-veh-car-back-a-red", front: "mc-veh-car-front-a-red" },
  "mc-veh-sedan-a-navy": { back: "mc-veh-car-back-a-navy", front: "mc-veh-car-front-a-navy" },
  "mc-veh-sedan-a-white": { back: "mc-veh-car-back-a-white", front: "mc-veh-car-front-a-white" },
  "mc-veh-sedan-a-black": { back: "mc-veh-car-back-a-black", front: "mc-veh-car-front-a-black" },
  "mc-veh-car2-c-beige": { back: "mc-veh-car-back-a-beige", front: "mc-veh-car-front-a-beige" },
  "mc-veh-car2-c-green": { back: "mc-veh-car-back-a-green", front: "mc-veh-car-front-a-green" },
  "mc-veh-sedan-a": { back: "mc-veh-car-back-a", front: "mc-veh-car-front-a" },
  "mc-veh-van-a": { back: "mc-veh-car-back-a-white", front: "mc-veh-car-front-a-white" },
  "mc-veh-truck-a": { back: "mc-veh-car-back-a-white", front: "mc-veh-car-front-a-white", dualBounce: true },
  "mc-veh-ambulance-a": { back: "mc-veh-car-back-a-white", front: "mc-veh-car-front-a-white", beacon: "emergency" },
  "mc-veh-firetruck-b": { back: "mc-veh-car-back-a-red", front: "mc-veh-car-front-a-red", beacon: "emergency" },
  "mc-veh-bus-a": { back: "mc-veh-car-back-a-green", front: "mc-veh-car-front-a-green" },
};

let cachedDefaultKits: Readonly<Record<string, StructureKitDef>> | null = null;

function findKit(id: string): StructureKitDef | undefined {
  cachedDefaultKits ??= Object.fromEntries((createModernCityTileset().structureKits ?? []).map((k) => [k.id, k]));
  return cachedDefaultKits[id];
}

function extractKitImageData(
  src: CanvasImageSource,
  kit: StructureKitDef,
  targetW: number,
  targetH: number,
): ImageData {
  const rawW = kit.width * TILE;
  const rawH = kit.height * TILE;
  const scratch = document.createElement("canvas");
  scratch.width = rawW;
  scratch.height = rawH;
  const sctx = scratch.getContext("2d")!;
  sctx.imageSmoothingEnabled = false;
  for (let r = 0; r < kit.rows.length; r += 1) {
    const row = kit.rows[r]!;
    for (const arr of [row.tiles, row.upperTiles ?? []]) {
      for (let c = 0; c < arr.length; c += 1) {
        const tid = arr[c] ?? -1;
        if (tid < 0) continue;
        const sx = (tid % TILES_PER_ROW) * TILE;
        const sy = Math.floor(tid / TILES_PER_ROW) * TILE;
        sctx.drawImage(src, sx, sy, TILE, TILE, c * TILE, r * TILE, TILE, TILE);
      }
    }
  }
  const raw = sctx.getImageData(0, 0, rawW, rawH);
  let yMax = rawH - 1;
  for (let y = rawH - 1; y >= 0; y -= 1) {
    let any = false;
    for (let x = 0; x < rawW; x += 1) {
      if ((raw.data[(y * rawW + x) * 4 + 3] ?? 0) > 0) { any = true; break; }
    }
    if (any) { yMax = y; break; }
  }
  const out = new ImageData(targetW, targetH);
  const shiftY = (targetH - 2) - yMax;
  const shiftX = Math.floor((targetW - rawW) / 2);
  for (let y = 0; y < rawH; y += 1) {
    const dy = y + shiftY;
    if (dy < 0 || dy >= targetH) continue;
    for (let x = 0; x < rawW; x += 1) {
      const dx = x + shiftX;
      if (dx < 0 || dx >= targetW) continue;
      const si = (y * rawW + x) * 4;
      const di = (dy * targetW + dx) * 4;
      out.data[di] = raw.data[si]!;
      out.data[di + 1] = raw.data[si + 1]!;
      out.data[di + 2] = raw.data[si + 2]!;
      out.data[di + 3] = raw.data[si + 3]!;
    }
  }
  return out;
}

function setPx(img: ImageData, x: number, y: number, r: number, g: number, b: number, a = 255): void {
  const rx = Math.round(x), ry = Math.round(y);
  if (rx < 0 || ry < 0 || rx >= img.width || ry >= img.height) return;
  const i = (ry * img.width + rx) * 4;
  if (a >= 255 || (img.data[i + 3] ?? 0) === 0) {
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  } else {
    const t = a / 255;
    img.data[i] = Math.round(img.data[i]! * (1 - t) + r * t);
    img.data[i + 1] = Math.round(img.data[i + 1]! * (1 - t) + g * t);
    img.data[i + 2] = Math.round(img.data[i + 2]! * (1 - t) + b * t);
    img.data[i + 3] = Math.max(img.data[i + 3]!, a);
  }
}

function mirrorHorizontal(src: ImageData): ImageData {
  const { width: w, height: h } = src;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * w + x) * 4;
      const di = (y * w + (w - 1 - x)) * 4;
      out.data[di] = src.data[si]!;
      out.data[di + 1] = src.data[si + 1]!;
      out.data[di + 2] = src.data[si + 2]!;
      out.data[di + 3] = src.data[si + 3]!;
    }
  }
  return out;
}

interface Box { x0: number; y0: number; x1: number; y1: number }

/** 불투명 화소의 테두리 사각(끝 포함). 위로 1px 더 — 서스펜션 바운스가 잘리지 않게. */
function opaqueBox(img: ImageData): Box {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: img.width - 1, y1: img.height - 1 } : { x0, y0: Math.max(0, y0 - 1), x1, y1 };
}

/**
 * 동서 프레임을 칸 칸수(길이 L칸 × 2칸 = L·16 × 32px)에 맞춘다 — 원본 키트(5~8칸 × 3칸)를 면적 평균으로 줄여
 * 아래 1px 띄워 바닥에 앉히고 가로 가운데. 남북 프레임(32 × L·16)과 길이·폭이 같아 90° 돌아도 크기가 튀지 않는다.
 */
function fitToFrame(src: ImageData, box: Box, targetW: number, targetH: number): ImageData {
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const s = Math.min(1, targetW / bw, (targetH - 1) / bh);
  const ow = Math.max(1, Math.round(bw * s)), oh = Math.max(1, Math.round(bh * s));
  const ox = Math.floor((targetW - ow) / 2), oy = targetH - 1 - oh;
  const out = new ImageData(targetW, targetH);
  for (let y = 0; y < oh; y += 1) {
    const sy0 = box.y0 + y / s, sy1 = box.y0 + (y + 1) / s;
    for (let x = 0; x < ow; x += 1) {
      const sx0 = box.x0 + x / s, sx1 = box.x0 + (x + 1) / s;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy += 1) {
        const wy = Math.min(yy + 1, sy1) - Math.max(yy, sy0);
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx += 1) {
          const wgt = wy * (Math.min(xx + 1, sx1) - Math.max(xx, sx0));
          area += wgt;
          if (xx < 0 || yy < 0 || xx >= src.width || yy >= src.height) continue;
          const i = (yy * src.width + xx) * 4;
          const al = (src.data[i + 3]! / 255) * wgt;
          r += src.data[i]! * al; g += src.data[i + 1]! * al; b += src.data[i + 2]! * al; a += al;
        }
      }
      if (area <= 0 || a / area < 0.5) continue;
      const di = ((oy + y) * targetW + ox + x) * 4;
      out.data[di] = Math.round(r / a); out.data[di + 1] = Math.round(g / a); out.data[di + 2] = Math.round(b / a); out.data[di + 3] = 255;
    }
  }
  return out;
}

function buildEwFrame(
  base: ImageData,
  kitId: string,
  meta: KitPair | undefined,
  phase: number,
  brake: boolean,
  openDoor: boolean,
): ImageData {
  const { width: w, height: h } = base;
  const out = new ImageData(w, h);
  const archY = h - 9;
  const moving = !brake && !openDoor;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * w + x) * 4;
      const a = base.data[si + 3]!;
      if (a === 0) continue;
      let dy = 0;
      if (moving && a >= 200 && y < archY) {
        if (meta?.dualBounce) {
          dy = (x >= 58 && phase === 1) || (x < 58 && phase === 3) ? -1 : 0;
        } else {
          dy = phase === 1 || phase === 3 ? -1 : 0;
        }
      }
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      const di = (ny * w + x) * 4;
      out.data[di] = base.data[si]!;
      out.data[di + 1] = base.data[si + 1]!;
      out.data[di + 2] = base.data[si + 2]!;
      out.data[di + 3] = a;
    }
  }
  if (moving && phase > 0) {
    const wheelXs = kitId === "mc-veh-firetruck-b" ? [19, 30, w - 18] : [18, w - 18];
    const wy = h - 6;
    const angles: readonly [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = angles[phase & 3]!;
    for (const wx of wheelXs) {
      setPx(out, wx, wy, 195, 205, 220);
      setPx(out, wx + dx, wy + dy, 225, 232, 244);
      setPx(out, wx - dx, wy - dy, 120, 130, 145);
      setPx(out, wx - dy, wy + dx, 70, 76, 88);
    }
  }
  if (meta?.beacon === "police") {
    const redLeft = (phase & 1) === 0;
    const cL = redLeft ? [255, 50, 65] : [55, 165, 255];
    const cR = redLeft ? [55, 165, 255] : [255, 50, 65];
    for (let x = 35; x <= 38; x += 1) setPx(out, x, 17, cL[0]!, cL[1]!, cL[2]!);
    for (let x = 39; x <= 42; x += 1) setPx(out, x, 17, cR[0]!, cR[1]!, cR[2]!);
  } else if (meta?.beacon === "emergency") {
    const flash = (phase & 1) === 0;
    const c = flash ? [255, 45, 55] : [255, 240, 215];
    for (let x = w - 28; x <= w - 22; x += 1) setPx(out, x, 16, c[0]!, c[1]!, c[2]!);
  } else if (meta?.beacon === "taxi") {
    const lit = (phase & 1) === 0;
    for (let x = 36; x <= 41; x += 1) setPx(out, x, 18, 255, lit ? 220 : 185, 65);
    if (moving && (phase === 1 || phase === 2)) {
      setPx(out, w - 6, h - 10, 255, 190, 40);
      setPx(out, w - 5, h - 10, 255, 210, 70);
    }
  }
  if (moving) {
    setPx(out, w - 5, h - 11, 255, 248, 200);
    setPx(out, w - 4, h - 11, 255, 245, 180, 180);
  }
  if (brake) {
    for (let y = h - 13; y <= h - 10; y += 1) {
      setPx(out, 5, y, 255, 40, 55);
      setPx(out, 4, y, 255, 50, 65, 150);
    }
  }
  if (openDoor && kitId === "mc-veh-bus-a") {
    for (let y = 23; y <= 42; y += 1) {
      for (let x = 56; x <= 66; x += 1) {
        if (y <= 24) setPx(out, x, y, 255, 242, 185);
        else if (y >= 39) setPx(out, x, y, 52, 58, 70);
        else setPx(out, x, y, 24, 28, 36);
      }
      setPx(out, 55, y, 42, 72, 58);
      setPx(out, 67, y, 42, 72, 58);
    }
  }
  return out;
}

/**
 * 남북(up/down) 기본 스프라이트:
 * 100% 원본 modern-city-chipset.png 의 mc-veh-car-front-a* / mc-veh-car-back-a* 화소를 그대로 쓰되,
 * 경찰차(mc-veh-police-a)는 원본 흰색 지붕(mc-veh-car-front/back-a-white) + 원본 경찰차 경광등 화소(mc-veh-police-a y=15..19)를 이식하고,
 * 택시(mc-veh-taxi-b)는 원본 택시 표시등 화소(mc-veh-taxi-b y=15..19)를 지붕 중앙에 이식한다.
 */
const CAR_GRAY_RAMP: readonly (readonly [number, number, number])[] = [
  [103, 106, 119],
  [117, 120, 134],
  [132, 135, 148],
  [148, 150, 161],
  [161, 163, 172],
  [175, 177, 184],
  [188, 189, 195],
];
const TAXI_BODY_RAMP: readonly (readonly [number, number, number])[] = [
  [14, 23, 32],
  [25, 39, 55],
  [25, 39, 55],
  [40, 61, 83],
  [40, 61, 83],
  [54, 81, 106],
  [54, 81, 106],
];
const POLICE_LOWER_RAMP: readonly (readonly [number, number, number])[] = [
  [25, 39, 55],
  [25, 39, 55],
  [40, 61, 83],
  [40, 61, 83],
  [54, 81, 106],
  [54, 81, 106],
  [54, 81, 106],
];

function findGrayRampRank(r: number, g: number, b: number): number {
  for (let i = 0; i < CAR_GRAY_RAMP.length; i += 1) {
    const c = CAR_GRAY_RAMP[i]!;
    if (c[0] === r && c[1] === g && c[2] === b) return i;
  }
  return -1;
}

function buildOriginalChipsetNsBase(
  _srcImg: CanvasImageSource,
  base: ImageData,
  sideRight: ImageData,
  meta: KitPair | undefined,
  _dir: "up" | "down",
): ImageData {
  const { width: w, height: h } = base;
  const out = new ImageData(new Uint8ClampedArray(base.data), w, h);
  if (meta?.beacon === "police" || meta?.beacon === "taxi") {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if ((out.data[i + 3] ?? 0) === 0) continue;
        const rank = findGrayRampRank(out.data[i]!, out.data[i + 1]!, out.data[i + 2]!);
        if (rank < 0) continue;
        if (meta.beacon === "taxi") {
          const c = y === 36 ? ([200, 154, 43] as const) : TAXI_BODY_RAMP[rank]!;
          out.data[i] = c[0];
          out.data[i + 1] = c[1];
          out.data[i + 2] = c[2];
        } else if (y >= 37) {
          const c = POLICE_LOWER_RAMP[rank]!;
          out.data[i] = c[0];
          out.data[i + 1] = c[1];
          out.data[i + 2] = c[2];
        }
      }
    }
  }
  if (meta?.beacon === "police") {
    for (let x = 20; x <= 27; x += 1) setPx(out, x, 6, 9, 17, 37, 255);
    for (let sy = 15; sy <= 17; sy += 1) {
      for (let sx = 34; sx <= 43; sx += 1) {
        const si = (sy * sideRight.width + sx) * 4;
        if ((sideRight.data[si + 3] ?? 0) < 200) continue;
        setPx(out, sx - 15, sy - 8, sideRight.data[si]!, sideRight.data[si + 1]!, sideRight.data[si + 2]!, 255);
      }
    }
  } else if (meta?.beacon === "taxi") {
    for (let sy = 15; sy <= 17; sy += 1) {
      for (let sx = 35; sx <= 42; sx += 1) {
        const si = (sy * sideRight.width + sx) * 4;
        if ((sideRight.data[si + 3] ?? 0) < 200) continue;
        setPx(out, sx - 15, sy - 8, sideRight.data[si]!, sideRight.data[si + 1]!, sideRight.data[si + 2]!, 255);
      }
    }
  } else if (meta?.beacon === "emergency") {
    for (let x = 16; x <= 31; x += 1) {
      setPx(out, x, 9, x < 24 ? 235 : 245, x < 24 ? 45 : 240, x < 24 ? 55 : 235);
      setPx(out, x, 10, x < 24 ? 190 : 215, x < 24 ? 30 : 210, x < 24 ? 40 : 210);
    }
  }
  return out;
}

function buildNsFrame(
  base: ImageData,
  meta: KitPair | undefined,
  dir: "up" | "down",
  phase: number,
  brake: boolean,
): ImageData {
  const { width: w, height: h } = base;
  const out = new ImageData(w, h);
  const tireY = h - 7;
  const moving = !brake;
  const bob = moving && (phase === 1 || phase === 3) ? -1 : 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * w + x) * 4;
      const a = base.data[si + 3]!;
      if (a === 0) continue;
      const ny = y + (a >= 200 && y < tireY ? bob : 0);
      if (ny < 0 || ny >= h) continue;
      const di = (ny * w + x) * 4;
      out.data[di] = base.data[si]!;
      out.data[di + 1] = base.data[si + 1]!;
      out.data[di + 2] = base.data[si + 2]!;
      out.data[di + 3] = a;
    }
  }
  if (meta?.beacon === "police" && (phase & 1) === 1) {
    for (let y = 7; y <= 9; y += 1) {
      for (let dx = 0; dx < 10; dx += 1) {
        const si = (y * w + (28 - dx)) * 4;
        if ((base.data[si + 3] ?? 0) === 0) continue;
        setPx(out, 19 + dx, y + bob, base.data[si]!, base.data[si + 1]!, base.data[si + 2]!, base.data[si + 3]!);
      }
    }
  }
  if (dir === "down" && moving) {
    for (const lx of [9, 10, w - 11, w - 10]) setPx(out, lx, h - 8 + bob, 255, 248, 200);
  }
  if (brake) {
    for (const lx of [9, 10, 11, w - 12, w - 11, w - 10]) {
      setPx(out, lx, h - 9, 255, 40, 55);
      setPx(out, lx, h - 8, 255, 40, 55);
    }
  }
  return out;
}

export function ensureModernCityVehicleTexture(
  _scene: PlaySceneContext,
  phaser: Phaser.Scene,
  def: TransitVehicleDef,
  key: string,
): boolean {
  if (!def.image.startsWith("mc-kit:")) return false;
  if (!phaser.textures.exists(MODERN_CITY_TEXTURE)) {
    void ensureSceneImageTexture(phaser, MODERN_CITY_TEXTURE, "/assets/modern-city/modern-city-chipset.png");
    return false;
  }
  const kitId = def.image.slice("mc-kit:".length);
  const sideKit = findKit(kitId);
  if (!sideKit) return false;
  const meta = KIT_META[kitId];
  const backKit = findKit(meta?.back ?? "mc-veh-car-back-a") ?? sideKit;
  const frontKit = findKit(meta?.front ?? "mc-veh-car-front-a") ?? sideKit;

  const srcImg = phaser.textures.get(MODERN_CITY_TEXTURE).getSourceImage() as CanvasImageSource;
  // 원본 키트 크기로 꾸민 뒤(바퀴·경광등·문 좌표가 원본 기준) 칸 프레임으로 줄인다.
  const rawW = sideKit.width * TILE;
  const rawH = 48;
  const ewW = def.frames.right?.w ?? def.length * TILE;
  const ewH = def.frames.right?.h ?? 32;
  const isBus = kitId === "mc-veh-bus-a";
  const nsW = def.frames.up?.w ?? 32;
  const nsH = def.frames.up?.h ?? def.length * TILE;

  const baseRight = extractKitImageData(srcImg, sideKit, rawW, rawH);
  const leftKit = findKit(`${kitId}-l`);
  const baseLeftMirrored = leftKit ? mirrorHorizontal(extractKitImageData(srcImg, leftKit, rawW, rawH)) : baseRight;
  const baseUp = buildOriginalChipsetNsBase(srcImg, extractKitImageData(srcImg, backKit, nsW, nsH), baseRight, meta, "up");
  const baseDown = buildOriginalChipsetNsBase(srcImg, extractKitImageData(srcImg, frontKit, nsW, nsH), baseRight, meta, "down");
  const boxRight = opaqueBox(baseRight);
  const boxLeft = opaqueBox(mirrorHorizontal(baseLeftMirrored));

  const canvas = document.createElement("canvas");
  canvas.width = def.width;
  canvas.height = def.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const right = (p: number, brake: boolean, open: boolean): ImageData => fitToFrame(buildEwFrame(baseRight, kitId, meta, p, brake, open), boxRight, ewW, ewH);
  const left = (p: number, brake: boolean, open: boolean): ImageData => fitToFrame(mirrorHorizontal(buildEwFrame(baseLeftMirrored, kitId, meta, p, brake, open)), boxLeft, ewW, ewH);
  // Row 0 (right) & Row 1 (left — uses chipset's native <kitId>-l art)
  ctx.putImageData(right(0, false, false), 0, 0);
  ctx.putImageData(left(0, false, false), 0, ewH);
  for (let p = 0; p < 4; p += 1) {
    ctx.putImageData(right(p, false, false), ewW * (p + 1), 0);
    ctx.putImageData(left(p, false, false), ewW * (p + 1), ewH);
  }
  ctx.putImageData(right(0, true, false), ewW * 5, 0);
  ctx.putImageData(left(0, true, false), ewW * 5, ewH);
  if (isBus) {
    ctx.putImageData(right(0, false, true), ewW * 6, 0);
    ctx.putImageData(left(0, false, true), ewW * 6, ewH);
  }
  // Row 2 (up) & Row 3 (down)
  const upY = ewH * 2;
  const downY = upY + nsH;
  const makeNs = (dir: "up" | "down", base: ImageData, p: number, brake: boolean): ImageData =>
    renderHandNsFrame(kitId, dir, nsW, nsH, p, brake) ?? buildNsFrame(base, meta, dir, p, brake);
  ctx.putImageData(makeNs("up", baseUp, 0, false), 0, upY);
  ctx.putImageData(makeNs("down", baseDown, 0, false), 0, downY);
  for (let p = 0; p < 4; p += 1) {
    ctx.putImageData(makeNs("up", baseUp, p, false), nsW * (p + 1), upY);
    ctx.putImageData(makeNs("down", baseDown, p, false), nsW * (p + 1), downY);
  }
  ctx.putImageData(makeNs("up", baseUp, 0, true), nsW * 5, upY);
  ctx.putImageData(makeNs("down", baseDown, 0, true), nsW * 5, downY);
  const tex = phaser.textures.addCanvas(key, canvas);
  tex?.setFilter(1);
  return Boolean(tex);
}
