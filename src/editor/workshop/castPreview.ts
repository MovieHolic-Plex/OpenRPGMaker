// src/editor/workshop/castPreview.ts
/**
 * 캐릭터 묶음(char-gen 등, content.characters 가 있는 묶음)의 미리 보기 — 「사람」 결과를 사람답게 보여 준다(2026-10-22).
 *
 * 전에는 묶음 안 그림 파일을 그대로 늘어놓았다: 걷는 칩 시트(288×256, 8명 × 12프레임)를 통째로 0.8배 흐리게 줄이고,
 * 700px 초상도 흐리게 줄여 물건용 갈색 바닥 위에 올렸다. 그래서 잘 그린 칩도 「싸구려 스프라이트 시트」로 읽혔다.
 * 이제는 사람 하나에 한 칸: 앞모습 칩을 정수 배율로 키워 걷게 하고, 짝 얼굴(48×48)이 있으면 정수 배율로 곁에 둔다.
 * 시트·초상 파일은 그대로 다 들어간다 — 화면에서만 사람 단위로 묶는다. 배율은 정수만 쓴다(도트가 번지지 않게).
 */
import type { StorePackManifest } from "@/assetStore/format";
import { sniffMime } from "@/assetStore/sniff";
import { el } from "@/util/dom";

export interface CastMember {
  readonly label: string;
  readonly sheet: Uint8Array;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly characterIndex: number;
  readonly face: Uint8Array | null;
  /** 짝 상반신(기본 표정) 그림 — 크다(700px 안팎). 화면에는 정수 배율로 줄여(칸 평균) 보인다. */
  readonly bust: Uint8Array | null;
  /** 짝 초상(상반신·전신·얼굴) 그림 수 */
  readonly portraits: number;
  /** 상반신 표정 수 */
  readonly expressions: number;
}

/** 묶음의 사람 목록. 캐릭터 설명이 없거나 시트를 못 찾으면 빈 목록(그때는 파일 미리 보기로 돌아간다). */
export function packCast(manifest: StorePackManifest, blobs: ReadonlyMap<string, Uint8Array>): CastMember[] {
  const assets = manifest.content.assets;
  const out: CastMember[] = [];
  for (const character of manifest.content.characters ?? []) {
    const asset = assets[character.asset];
    const sheet = asset ? blobs.get(asset.blob) : undefined;
    if (!asset || !sheet || !sniffMime(sheet)?.startsWith("image/")) continue;
    const meta = asset.meta as { width?: number; height?: number } | undefined;
    const size = pngSize(sheet) ?? { width: meta?.width ?? 0, height: meta?.height ?? 0 };
    if (!size.width || !size.height) continue;
    const portraits = character.portraits;
    const faceAsset = portraits?.face ? assets[portraits.face] : undefined;
    const face = faceAsset ? blobs.get(faceAsset.blob) ?? null : null;
    const bustId = portraits?.bust?.base ?? Object.values(portraits?.bust ?? {})[0];
    const bustAsset = bustId ? assets[bustId] : undefined;
    const bust = bustAsset ? blobs.get(bustAsset.blob) ?? null : null;
    const busts = Object.keys(portraits?.bust ?? {}).length + Object.values(portraits?.extra ?? {}).filter((x) => x.bust).length;
    const fulls = Object.keys(portraits?.full ?? {}).length + Object.values(portraits?.extra ?? {}).filter((x) => x.full).length;
    out.push({
      label: character.label, sheet, sheetWidth: size.width, sheetHeight: size.height, characterIndex: character.characterIndex,
      face, bust, portraits: busts + fulls + (face ? 1 : 0), expressions: busts,
    });
  }
  return out;
}

/** PNG 머리에서 크기를 읽는다(디코드 없이). */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * 시트에서 한 사람의 칸(RPG Maker 2000/2003 CharSet: 8명 = 4열×2행, 한 사람 = 3프레임×4방향).
 * 한 사람짜리 시트(가로:세로 = 3:4 의 3×4 격자)도 받는다.
 */
export function charsetBlock(sheetWidth: number, sheetHeight: number, index: number): { x: number; y: number; frameW: number; frameH: number } {
  // 한 사람 = 3×4 칸, 프레임 3:4 → 한 사람 시트는 9:16, 8명 시트(4열×2행)는 9:8.
  const single = sheetWidth * 16 === sheetHeight * 9;
  const cols = single ? 1 : 4, rows = single ? 1 : 2;
  const blockW = Math.floor(sheetWidth / cols), blockH = Math.floor(sheetHeight / rows);
  const i = Math.max(0, Math.min(cols * rows - 1, index));
  return { x: (i % cols) * blockW, y: Math.floor(i / cols) * blockH, frameW: Math.floor(blockW / 3), frameH: Math.floor(blockH / 4) };
}

/** 생성기가 붙인 id(「desert-merchant」)를 사람 이름처럼(「Desert merchant」). 사람이 지은 이름(공백·한글)은 그대로. */
export function castName(label: string): string {
  const trimmed = label.trim();
  if (!/^[a-z0-9]+([-_][a-z0-9]+)*$/.test(trimmed)) return trimmed;
  const words = trimmed.split(/[-_]+/);
  return [words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1), ...words.slice(1)].join(" ");
}

/** 줄마다 같은 수가 되게 열 수를 정한다(7명이면 4+3 — 마지막 줄에 한 명만 남지 않게). */
export function balancedColumns(count: number, maxColumns: number): number {
  if (count <= 0) return 1;
  const rows = Math.ceil(count / Math.max(1, maxColumns));
  return Math.ceil(count / rows);
}

const decoded = new WeakMap<Uint8Array, Promise<ImageBitmap>>();
function decode(bytes: Uint8Array): Promise<ImageBitmap> {
  let pending = decoded.get(bytes);
  if (!pending) {
    pending = createImageBitmap(new Blob([bytes.slice()], { type: sniffMime(bytes) ?? "image/png" }));
    decoded.set(bytes, pending);
  }
  return pending;
}

/** 앞모습(아래 방향) 걷기 프레임 순서: 선 자세 → 왼발 → 선 자세 → 오른발 */
const WALK = [1, 0, 1, 2] as const;
const DOWN_ROW = 2;
const STEP_MS = 190;
/** 한 줄 최대 사람 수(대화창 폭 기준) */
const MAX_COLUMNS = 6;
/** 상반신 줄임 목표 높이(px) — 정수 배율(칸 평균)이라 실제는 이 이하 */
const BUST_TARGET = 176;

/** 화면 배율: 칩은 3배, 얼굴은 2배(정수만). */
const CHIP_SCALE = 3;
const FACE_SCALE = 2;

function pixelCanvas(width: number, height: number, className: string): HTMLCanvasElement {
  const canvas = el("canvas", { class: className, attrs: { width: String(width), height: String(height), "aria-hidden": "true" } }) as HTMLCanvasElement;
  return canvas;
}

function drawFrame(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, block: ReturnType<typeof charsetBlock>, col: number, scale: number): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(bitmap, block.x + col * block.frameW, block.y + DOWN_ROW * block.frameH, block.frameW, block.frameH, 0, 0, block.frameW * scale, block.frameH * scale);
}

/**
 * 큰 그림을 정수 배율로 줄인다: k×k 칸의 평균(불투명 칸만) — 아무 배율로 흐리게 줄이지 않는다.
 * 1px 결로 그린 700px 상반신을 1/4 로 줄이면 칸 하나가 원본 16칸의 평균이라 결이 고르게 남는다.
 */
function reduceInteger(bitmap: ImageBitmap, target: number): HTMLCanvasElement | null {
  const k = Math.max(1, Math.ceil(Math.max(bitmap.width, bitmap.height) / target));
  const src = document.createElement("canvas");
  src.width = bitmap.width;
  src.height = bitmap.height;
  const sctx = src.getContext("2d");
  if (!sctx) return null;
  sctx.drawImage(bitmap, 0, 0);
  const data = sctx.getImageData(0, 0, src.width, src.height).data;
  const w = Math.floor(src.width / k), h = Math.floor(src.height / k);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return null;
  const image = octx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = 0; dy < k; dy += 1) {
        for (let dx = 0; dx < k; dx += 1) {
          const o = ((y * k + dy) * src.width + (x * k + dx)) * 4;
          const alpha = data[o + 3]!;
          a += alpha;
          if (alpha > 0) { r += data[o]! * alpha; g += data[o + 1]! * alpha; b += data[o + 2]! * alpha; n += alpha; }
        }
      }
      const t = (y * w + x) * 4;
      if (n > 0) { image.data[t] = r / n; image.data[t + 1] = g / n; image.data[t + 2] = b / n; }
      image.data[t + 3] = a / (k * k);
    }
  }
  octx.putImageData(image, 0, 0);
  out.className = "workshop-cast-bust";
  out.setAttribute("aria-hidden", "true");
  return out;
}

/** 한 사람 칸: 무대(밝은 바탕 + 발밑 그림자) 위에 걷는 앞모습. 초상이 있으면 상반신(없으면 얼굴)을 곁에. 이름·초상 수. */
function memberCard(member: CastMember, order: number, timers: Set<number>): HTMLElement {
  const block = charsetBlock(member.sheetWidth, member.sheetHeight, member.characterIndex);
  const chip = pixelCanvas(block.frameW * CHIP_SCALE, block.frameH * CHIP_SCALE, "workshop-cast-chip");
  const stage = el("div", { class: "workshop-cast-stage", children: [chip] });
  const art = el("div", { class: "workshop-cast-art", children: [stage] });
  const portrait = member.bust ?? member.face;
  if (portrait) {
    const frame = el("div", { class: "workshop-cast-portrait" + (member.bust ? " is-bust" : " is-face") });
    art.prepend(frame);
    void decode(portrait).then((bitmap) => {
      if (member.bust) {
        const reduced = reduceInteger(bitmap, BUST_TARGET);
        if (reduced) frame.append(reduced);
        return;
      }
      const face = pixelCanvas(bitmap.width * FACE_SCALE, bitmap.height * FACE_SCALE, "workshop-cast-face");
      const ctx = face.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0, face.width, face.height);
      frame.append(face);
    }, () => undefined);
  }
  void decode(member.sheet).then((bitmap) => {
    const ctx = chip.getContext("2d");
    if (!ctx) return;
    // 사람마다 걸음 위상을 어긋나게 — 다 같이 발맞춰 걸으면 기계 같다.
    let step = order % WALK.length;
    drawFrame(ctx, bitmap, block, WALK[step]!, CHIP_SCALE);
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { drawFrame(ctx, bitmap, block, 1, CHIP_SCALE); return; }
    const timer = window.setInterval(() => {
      if (!chip.isConnected) { window.clearInterval(timer); timers.delete(timer); return; }
      step = (step + 1) % WALK.length;
      drawFrame(ctx, bitmap, block, WALK[step]!, CHIP_SCALE);
    }, STEP_MS + (order % 3) * 12);
    timers.add(timer);
  }, () => undefined);
  const name = castName(member.label);
  const meta = member.portraits ? (member.expressions ? `초상 ${member.portraits}장 · 표정 ${member.expressions}가지` : `초상 ${member.portraits}장`) : "";
  return el("figure", {
    class: "workshop-cast-member" + (portrait ? " has-portrait" : ""),
    dataset: { testid: "workshop-cast-member" },
    children: [
      art,
      el("figcaption", {
        children: [
          el("strong", { text: name, attrs: { translate: "no", title: member.label } }),
          ...(meta ? [el("span", { text: meta })] : []),
        ],
      }),
    ],
  });
}

/** 사람 줄 세우기. 걷기 타이머는 칸이 화면에서 빠지면 스스로 멈춘다(dispose 로 바로 멈출 수도 있다). */
export function castLineup(cast: readonly CastMember[]): { root: HTMLElement; dispose(): void } {
  const timers = new Set<number>();
  const portraits = cast.some((member) => member.bust || member.face);
  const columns = balancedColumns(cast.length, portraits ? 2 : MAX_COLUMNS);
  const root = el("div", {
    class: "workshop-cast" + (portraits ? " has-portraits" : ""),
    dataset: { testid: "workshop-cast" },
    attrs: { style: `--cast-columns: ${columns}` },
    children: cast.map((member, order) => memberCard(member, order, timers)),
  });
  return { root, dispose: () => { for (const timer of timers) window.clearInterval(timer); timers.clear(); } };
}

/**
 * 작업 줄 작은 그림(52px 칸): 첫 사람 앞모습의 머리~가슴(20줄)을 정수 2배로. 얼굴 그림(48×48)은 생성기가 이미 부드럽게 줄인
 * 그림이라 칩 옆에 두면 흐려 보인다(2026-10-22 적대 검수) — 모든 묶음을 같은 칩 자르기로 맞춘다.
 * 시트를 통째로 줄이지 않는다.
 */
export async function castThumbDataUrl(cast: readonly CastMember[]): Promise<string | null> {
  const first = cast[0];
  if (!first) return null;
  const bitmap = await decode(first.sheet);
  const block = charsetBlock(first.sheetWidth, first.sheetHeight, first.characterIndex);
  const probe = document.createElement("canvas");
  probe.width = block.frameW;
  probe.height = block.frameH;
  const pctx = probe.getContext("2d");
  if (!pctx) return null;
  pctx.drawImage(bitmap, block.x + block.frameW, block.y + DOWN_ROW * block.frameH, block.frameW, block.frameH, 0, 0, block.frameW, block.frameH);
  const data = pctx.getImageData(0, 0, block.frameW, block.frameH).data;
  let top = 0;
  findTop: for (; top < block.frameH; top += 1) for (let x = 0; x < block.frameW; x += 1) if (data[(top * block.frameW + x) * 4 + 3]! > 0) break findTop;
  top = Math.max(0, top - 2);
  const scale = Math.max(1, Math.floor(56 / block.frameW));
  // 56px 칸을 위아래로 꽉 채운다(2배 × 28줄) — 잘린 곳이 칸 아래 가장자리에 닿아야 일부러 자른 상반신으로 읽힌다.
  const rows = Math.min(block.frameH - top, Math.floor(56 / scale));
  const canvas = document.createElement("canvas");
  canvas.width = block.frameW * scale;
  canvas.height = rows * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(probe, 0, top, block.frameW, rows, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
