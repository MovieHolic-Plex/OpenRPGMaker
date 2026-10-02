// 컷신 미리보기 합성 — 타임라인의 몇몇 시각을 골라 그림을 쌓아 한 장의 접촉 시트로 만든다.
// 업로드(프로젝트 안) 그림만 그린다. 번들 그림·맵 위 이동은 그리지 못하므로 자리표시 상자로 표시한다.
import { decodeImage, encodePng, resize, type RgbaImage } from "@/editor/cutsceneArt/imageProcess";
import type { Project } from "@/project/types";
import { type CutsceneTimeline, type PictureSnapshot } from "./timeline";

export const PREVIEW_CELL_GAP = 4;
const BACKGROUND = [34, 34, 34] as const;

function blank(width: number, height: number, rgb: readonly [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function blend(dst: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  const k = Math.min(1, a);
  dst[i] = dst[i]! * (1 - k) + r * k;
  dst[i + 1] = dst[i + 1]! * (1 - k) + g * k;
  dst[i + 2] = dst[i + 2]! * (1 - k) + b * k;
  dst[i + 3] = 255;
}

/** 그림 한 장을 (x,y) 왼쪽 위를 기준으로 배율·회전해 얹는다(런타임 CSS 와 같은 기준). */
export function drawPicture(frame: RgbaImage, snapshot: PictureSnapshot, source: RgbaImage | null): void {
  const s = snapshot.scale / 100;
  const sw = Math.max(1, Math.round((source?.width ?? 48) * s));
  const sh = Math.max(1, Math.round((source?.height ?? 48) * s));
  const scaled = source ? resize(source, sw, sh) : placeholder(sw, sh);
  const theta = (snapshot.rotation * Math.PI) / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const opacity = snapshot.opacity / 255;
  const corners = [[0, 0], [sw, 0], [0, sh], [sw, sh]].map(([u, v]) => [snapshot.x + u! * cos - v! * sin, snapshot.y + u! * sin + v! * cos] as const);
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))));
  const x1 = Math.min(frame.width - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))));
  const y1 = Math.min(frame.height - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - snapshot.x, dy = y + 0.5 - snapshot.y;
      const u = Math.floor(dx * cos + dy * sin), v = Math.floor(-dx * sin + dy * cos);
      if (u < 0 || v < 0 || u >= sw || v >= sh) continue;
      const si = (v * sw + u) * 4;
      blend(frame.data, (y * frame.width + x) * 4, scaled.data[si]!, scaled.data[si + 1]!, scaled.data[si + 2]!, (scaled.data[si + 3]! / 255) * opacity);
    }
  }
}

function placeholder(width: number, height: number): RgbaImage {
  const image = blank(width, height, [120, 120, 140]);
  for (let i = 0; i < width * height; i += 1) image.data[i * 4 + 3] = 140;
  return image;
}

function overlay(frame: RgbaImage, r: number, g: number, b: number, a: number): void {
  for (let i = 0; i < frame.width * frame.height; i += 1) blend(frame.data, i * 4, r, g, b, a);
}

function badge(frame: RgbaImage, slot: number, rgb: readonly [number, number, number]): void {
  for (let y = 4; y < 12; y += 1) for (let x = 4 + slot * 12; x < 12 + slot * 12; x += 1) blend(frame.data, (y * frame.width + x) * 4, rgb[0], rgb[1], rgb[2], 1);
}

export interface PreviewSources {
  get(resourceId: string): RgbaImage | null;
}

export async function loadPreviewSources(project: Project, resourceIds: Iterable<string>): Promise<PreviewSources> {
  const decoded = new Map<string, RgbaImage | null>();
  for (const id of new Set(resourceIds)) {
    const dataUrl = project.assets.uploaded[id]?.dataUrl;
    try {
      decoded.set(id, dataUrl ? await decodeImage(dataUrl) : null);
    } catch {
      decoded.set(id, null);
    }
  }
  return { get: (id) => decoded.get(id) ?? null };
}

export function renderFrame(timeline: CutsceneTimeline, t: number, viewport: { readonly width: number; readonly height: number }, sources: PreviewSources): RgbaImage {
  const frame = blank(viewport.width, viewport.height, [0, 0, 0]);
  for (const snapshot of timeline.snapshotAt(t)) drawPicture(frame, snapshot, sources.get(snapshot.resourceId));
  let slot = 0;
  for (const mark of timeline.marks) {
    if ((mark.kind === "flash" || mark.kind === "shake") && t >= mark.t && t <= mark.t + mark.durationMs) {
      if (mark.kind === "flash") overlay(frame, 255, 255, 255, 0.7 * (1 - (t - mark.t) / Math.max(1, mark.durationMs)));
      badge(frame, slot, mark.kind === "flash" ? [255, 255, 255] : [255, 160, 40]);
      slot += 1;
    }
  }
  return frame;
}

/** 시각 목록 → 3열 접촉 시트(PNG dataURL). */
export async function renderContactSheet(project: Project, timeline: CutsceneTimeline, times: readonly number[], viewport: { readonly width: number; readonly height: number }): Promise<string> {
  const resourceIds = times.flatMap((t) => timeline.snapshotAt(t).map((snapshot) => snapshot.resourceId));
  const sources = await loadPreviewSources(project, resourceIds);
  const cols = Math.min(3, times.length);
  const rows = Math.ceil(times.length / cols);
  const sheet = blank(cols * (viewport.width + PREVIEW_CELL_GAP) + PREVIEW_CELL_GAP, rows * (viewport.height + PREVIEW_CELL_GAP) + PREVIEW_CELL_GAP, BACKGROUND);
  times.forEach((t, index) => {
    const frame = renderFrame(timeline, t, viewport, sources);
    const ox = PREVIEW_CELL_GAP + (index % cols) * (viewport.width + PREVIEW_CELL_GAP);
    const oy = PREVIEW_CELL_GAP + Math.floor(index / cols) * (viewport.height + PREVIEW_CELL_GAP);
    for (let y = 0; y < viewport.height; y += 1) {
      sheet.data.set(frame.data.subarray(y * viewport.width * 4, (y + 1) * viewport.width * 4), ((oy + y) * sheet.width + ox) * 4);
    }
  });
  return encodePng(sheet);
}
