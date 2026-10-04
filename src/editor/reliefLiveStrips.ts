// 편집기 절벽 띠 — 높이 붓 한 번에 바뀐 곳만 다시 굽고 다시 올린다.
//
// 런타임(player/reliefStrips.ts)은 맵을 열 때 한 번 굽고 줄 띠를 페이지 텍스처에 쌓는다. 편집기는 붓 표본마다 relief 가 바뀌므로
// 같은 방식이면 표본마다 맵 전체를 굽고(100×100 약 0.8초) 페이지 전체를 다시 올린다(2026-10-03 실측: 120표본 드래그 13.9초,
// 최대 2.5초 멈춤). 여기서는
//   1) 전체 그림 버퍼(RGBA·주인 줄·윗면/벽)를 들고 있다가 바뀐 칸 둘레 창만 굽어 덮어쓰고(relief/window.ts — 전체 굽기와 화소 일치),
//   2) 띠를 (줄, 윗면/벽, 256px 열 묶음) 단위 텍스처로 나눠 덮어쓴 사각형에 걸린 띠만 다시 올린다.
// 줄 depth 계약은 그대로다: 줄 Y 의 윗면 = Y × EDIT_RELIEF_ROW_DEPTH, 벽 = + 7(editSceneRender.ts).
import type Phaser from "phaser";
import { reliefIsFlat } from "@/project/relief/edit";
import { renderRelief, type ReliefGroundSurface } from "@/project/relief/render";
import { reliefRenderOptions } from "@/project/relief/screen";
import { RELIEF_TILE, type ReliefData } from "@/project/relief/types";
import { applyReliefPatch, emptyReliefImage, planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefImage, type ReliefScene } from "@/project/relief/window";

/** 띠를 가로로 자르는 폭(px, 16px 그림 기준). 붓 한 번이 건드리는 띠 수와 텍스처 수 사이의 타협. */
const COLUMN = 256;
/** 캔버스 크기 눈금 — 띠 상자가 조금 자라도 텍스처를 새로 만들지 않고 고쳐 쓴다. */
const STEP = 32;
let scratch = new Uint32Array(0);

interface Strip {
  key: string;
  canvas: HTMLCanvasElement;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  /** 띠 상자(전체 그림 px, 끝 미포함). 붓질 중에는 넓어지기만 한다 — 전체 굽기 때 다시 꼭 맞춘다. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ReliefLiveStripsHost {
  readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  /** 띠 이미지 이름(타일 다시 그리기가 지우지 않게 하는 표식) */
  readonly name: string;
  /** 줄·띠(1 윗면, 2 벽)의 depth */
  depthOf(row: number, part: 1 | 2): number;
}

export interface ReliefLiveStripsStats {
  readonly mode: "clear" | "same" | "window" | "full";
  readonly strips: number;
}

export class ReliefLiveStrips {
  private image: ReliefImage | null = null;
  /** image 를 만든 굽기 입력 — 다음 relief 와 견줘 바뀐 창을 찾는다 */
  private scene: ReliefScene | null = null;
  private tileSize = 0;
  private readonly strips = new Map<number, Strip>();
  private serial = 0;
  private groundAlpha = 1;
  private groundTint: number | null = null;
  /** 굽기 방식별 횟수(진단·회귀 e2e 용, EditScene 이 window.__oprnEditReliefStats 로 내보낸다). */
  readonly counts = { full: 0, window: 0, same: 0, clear: 0 };

  constructor(private readonly host: ReliefLiveStripsHost) {}

  /** Keep editor inactive-layer cues when relief owns the native lower plane. */
  setGroundAppearance(alpha: number, tint: number | null): void {
    if (alpha === this.groundAlpha && tint === this.groundTint) return;
    this.groundAlpha = alpha; this.groundTint = tint;
    for (const [key, strip] of this.strips) if (Math.floor(key / this.columns()) % 2 === 0) this.styleGround(strip.image);
  }
  private styleGround(image: Phaser.GameObjects.Image): void {
    image.setAlpha(this.groundAlpha);
    if (this.groundTint === null) image.clearTint(); else image.setTint(this.groundTint);
  }

  /** relief 를 그린다. 같은 맵 크기·절벽 양식이면 바뀐 창만 다시 굽는다(평지에 처음 칠할 때도). */
  sync(relief: ReliefData | undefined, tileSize: number, forceFull = false, ground?: ReliefGroundSurface): ReliefLiveStripsStats {
    const stats = this.syncInner(relief, tileSize, forceFull, ground);
    this.counts[stats.mode]++;
    return stats;
  }

  private syncInner(relief: ReliefData | undefined, tileSize: number, forceFull: boolean, ground?: ReliefGroundSurface): ReliefLiveStripsStats {
    if (!relief || reliefIsFlat(relief)) {
      this.clear();
      return { mode: "clear", strips: 0 };
    }
    const scene: ReliefScene = { grids: reliefGrids(relief), opts: reliefRenderOptions(relief, ground) };
    if (tileSize !== this.tileSize) this.clear();
    // 이전 그림이 없으면 평지 그림에서 시작한다 — 빈 맵에 처음 칠한 붓도 창으로 굽는다
    const sameSize = this.image?.W === relief.width && this.image.H === relief.height;
    const base = sameSize ? this.image! : emptyReliefImage(relief.width, relief.height);
    const plan = forceFull ? null : planReliefPatch(sameSize ? this.scene : null, scene, base);
    if (plan === "same") {
      this.scene = scene;
      return { mode: "same", strips: 0 };
    }
    if (plan) {
      if (!sameSize) this.clear();
      this.image = base;
      this.tileSize = tileSize;
      const { shift, rows } = applyReliefPatch(base, scene, plan);
      this.scene = scene;
      // pad 가 바뀌면 그림이 세로로 밀렸다 — 띠 상자만 옮긴다(월드 위치·캔버스 내용은 그대로)
      if (shift) for (const strip of this.strips.values()) { strip.y0 += shift; strip.y1 += shift; }
      return { mode: "window", strips: this.redrawRects(rows, plan.windows) };
    }
    const next = reliefImageFromRender(renderRelief(scene.grids.eff, scene.opts), relief.width, relief.height);
    // 그림 폭이 바뀌면 띠 번호(열 묶음 수)가 달라진다 — 옛 띠를 다 버린다
    if (!sameSize) this.clear();
    this.image = next;
    this.scene = scene;
    this.tileSize = tileSize;
    return { mode: "full", strips: this.rebuildAll() };
  }

  /** 띠·텍스처를 모두 버린다. */
  clear(): void {
    for (const strip of this.strips.values()) this.destroyStrip(strip);
    this.strips.clear();
    this.image = null;
    this.scene = null;
  }

  /** 씬이 내려가 이미지가 이미 파괴됐을 때 — 참조만 버리고 텍스처를 지운다. */
  forget(): void {
    for (const strip of this.strips.values()) if (this.host.scene.textures.exists(strip.key)) this.host.scene.textures.remove(strip.key);
    this.strips.clear();
    this.image = null;
    this.scene = null;
  }

  private columns(): number {
    return Math.ceil((this.image?.PW ?? 0) / COLUMN);
  }

  private stripKey(row: number, part: number, column: number): number {
    return (row * 2 + (part - 1)) * this.columns() + column;
  }

  /** 전체 굽기 뒤: 화소를 한 번 훑어 띠 상자를 꼭 맞게 다시 잡는다. */
  private rebuildAll(): number {
    const image = this.image!;
    const boxes = new Map<number, [number, number, number, number]>();
    const { PW, SH, owner, part } = image;
    for (let sy = 0; sy < SH; sy++) {
      for (let sx = 0; sx < PW; sx++) {
        const i = sy * PW + sx, p = part[i]!;
        if (!p) continue;
        const k = this.stripKey(owner[i]!, p, (sx / COLUMN) | 0);
        const box = boxes.get(k);
        if (!box) boxes.set(k, [sx, sy, sx + 1, sy + 1]);
        else {
          if (sx < box[0]) box[0] = sx;
          if (sx >= box[2]) box[2] = sx + 1;
          if (sy >= box[3]) box[3] = sy + 1;
        }
      }
    }
    for (const [k, strip] of this.strips) if (!boxes.has(k)) { this.destroyStrip(strip); this.strips.delete(k); }
    let added = false;
    for (const [k, box] of boxes) added = this.drawStrip(k, box[0], box[1], box[2], box[3], true) || added;
    if (added) this.host.layer.sort("depth");
    return boxes.size;
  }

  /** 창 덮어쓰기 뒤: 덮어쓴 사각형들에 걸린 (줄, 띠, 열 묶음)만 다시 올린다. */
  private redrawRects(rows: ReadonlySet<number>, rects: readonly { x0: number; y0: number; x1: number; y1: number }[]): number {
    const image = this.image!;
    const { PW, owner, part } = image;
    // 덮어쓴 사각형 안 새 화소의 상자 — 띠 상자는 이것과 옛 상자의 합집합으로 넓힌다
    const fresh = new Map<number, [number, number, number, number]>();
    const keys = new Set<number>();
    for (const { x0, y0, x1, y1 } of rects) {
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = sy * PW + sx, p = part[i]!;
          if (!p) continue;
          const k = this.stripKey(owner[i]!, p, (sx / COLUMN) | 0);
          const box = fresh.get(k);
          if (!box) fresh.set(k, [sx, sy, sx + 1, sy + 1]);
          else {
            if (sx < box[0]) box[0] = sx;
            if (sy < box[1]) box[1] = sy;
            if (sx >= box[2]) box[2] = sx + 1;
            if (sy >= box[3]) box[3] = sy + 1;
          }
        }
      }
      const c0 = (x0 / COLUMN) | 0, c1 = ((x1 - 1) / COLUMN) | 0;
      for (const row of rows) for (const p of [1, 2]) for (let c = c0; c <= c1; c++) keys.add(this.stripKey(row, p, c));
    }
    let count = 0, added = false;
    for (const k of keys) {
      const old = this.strips.get(k), box = fresh.get(k);
      if (!old && !box) continue;
      const bx0 = Math.min(old?.x0 ?? Infinity, box?.[0] ?? Infinity), by0 = Math.min(old?.y0 ?? Infinity, box?.[1] ?? Infinity);
      const bx1 = Math.max(old?.x1 ?? -Infinity, box?.[2] ?? -Infinity), by1 = Math.max(old?.y1 ?? -Infinity, box?.[3] ?? -Infinity);
      added = this.drawStrip(k, bx0, by0, bx1, by1, false) || added;
      count++;
    }
    if (added) this.host.layer.sort("depth");
    return count;
  }

  /**
   * 띠 하나를 버퍼에서 캔버스로 옮겨 올린다. 화소가 하나도 없으면 띠를 버린다. 새 이미지를 만들었으면 true.
   * tight 이면 캔버스를 상자 크기에 맞춰 줄인다(전체 굽기). 아니면 모자랄 때만 키운다.
   */
  private drawStrip(k: number, x0: number, y0: number, x1: number, y1: number, tight: boolean): boolean {
    const image = this.image!;
    const { PW, pad, owner, part } = image;
    const cols = this.columns();
    const row = Math.floor(k / cols / 2), p = Math.floor(k / cols) % 2 + 1;
    const w = x1 - x0, h = y1 - y0;
    const cw = Math.ceil(w / STEP) * STEP, ch = Math.ceil(h / STEP) * STEP;
    const strip = this.strips.get(k);
    const reuse = strip && strip.canvas.width >= cw && strip.canvas.height >= ch && (!tight || (strip.canvas.width === cw && strip.canvas.height === ch));
    const tw = reuse ? strip.canvas.width : cw, th = reuse ? strip.canvas.height : ch;
    // 띠 화소 버퍼는 하나를 고쳐 쓴다(붓 표본마다 띠 수십 장 — 새로 만들면 GC 가 쌓인다)
    if (scratch.length < tw * th) scratch = new Uint32Array(Math.ceil(tw * th * 1.25));
    const dst = scratch.subarray(0, tw * th);
    dst.fill(0);
    const pixels = new ImageData(new Uint8ClampedArray(dst.buffer, 0, tw * th * 4), tw, th);
    const src = new Uint32Array(image.rgba.buffer, image.rgba.byteOffset, image.rgba.length >> 2);
    let any = false;
    for (let sy = y0; sy < y1; sy++) {
      const base = sy * PW, out = (sy - y0) * tw - x0;
      for (let sx = x0; sx < x1; sx++) {
        const i = base + sx;
        if (part[i] !== p || owner[i] !== row) continue;
        dst[out + sx] = src[i]!;
        any = true;
      }
    }
    if (!any) {
      if (strip) { this.destroyStrip(strip); this.strips.delete(k); }
      return false;
    }
    const scale = this.tileSize / RELIEF_TILE;
    if (reuse && strip) {
      strip.canvas.getContext("2d")?.putImageData(pixels, 0, 0);
      strip.texture.refresh();
      Object.assign(strip, { x0, y0, x1, y1 });
      strip.image.setPosition(x0 * scale, (y0 - pad) * scale).setScale(scale);
      return false;
    }
    // 새 캔버스는 다 그린 뒤에 텍스처로 올린다 — 빈 캔버스로 만든 텍스처는 나중에 refresh 해도 화면에 안 나온다(characterShadow.ts).
    // willReadFrequently: Phaser 캔버스 텍스처는 만들 때 getImageData 를 부른다. GPU 캔버스면 그때마다 되읽기로 멈춘다
    // (2026-10-03 실측: 띠 139장 만들기에 약 2초). CPU 캔버스로 두면 복사 한 번이다.
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    canvas.getContext("2d", { willReadFrequently: true })?.putImageData(pixels, 0, 0);
    const textures = this.host.scene.textures;
    const texKey = `__oprn_relief_live_${++this.serial}`;
    const texture = textures.addCanvas(texKey, canvas);
    if (!texture) return false;
    texture.setFilter(1);
    if (strip) {
      const oldKey = strip.key;
      strip.image.setTexture(texKey);
      if (textures.exists(oldKey)) textures.remove(oldKey);
      Object.assign(strip, { key: texKey, canvas, texture, x0, y0, x1, y1 });
      strip.image.setPosition(x0 * scale, (y0 - pad) * scale).setScale(scale);
      return false;
    }
    const img = this.host.scene.add.image(x0 * scale, (y0 - pad) * scale, texKey).setOrigin(0, 0).setScale(scale);
    if (p === 1) this.styleGround(img);
    img.setName(this.host.name).setDepth(this.host.depthOf(row, p as 1 | 2));
    this.host.layer.add(img);
    this.strips.set(k, { key: texKey, canvas, texture, image: img, x0, y0, x1, y1 });
    return true;
  }

  private destroyStrip(strip: Strip): void {
    strip.image.destroy();
    if (this.host.scene.textures.exists(strip.key)) this.host.scene.textures.remove(strip.key);
  }
}
