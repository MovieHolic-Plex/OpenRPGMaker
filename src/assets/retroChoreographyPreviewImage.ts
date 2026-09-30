// assets/retroChoreographyPreviewImage.ts
// preview_choreography 의 그림 한 장. 연출의 층마다 한 줄, 그 시트의 프레임을 고르게 뽑아 가로로 이어 붙인다.
// 긴 변 768px 이하. 브라우저(캔버스)가 없는 환경(헤드리스 테스트)에서는 빈 배열 — 텍스트 층 목록은 도구 결과에 이미 있다.
import { withInlineAsset } from "@/assets/inlineAssetStore";

export const RETRO_PREVIEW_MAX_SIDE = 768;
export const RETRO_PREVIEW_MAX_COLS = 6;
const LABEL_W = 28;
const MAX_CELL = 112;

export interface RetroPreviewLayerRow {
  readonly index: number;
  readonly sheet: string;
  readonly frame: number;
  readonly frames: number;
}

/** 시트 한 장에서 뽑을 프레임 번호(고르게, 처음과 끝 포함). */
export function retroPreviewFrameIndexes(frames: number, cols: number): number[] {
  if (frames <= 0) return [];
  const count = Math.min(frames, cols);
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) => Math.round((i * (frames - 1)) / (count - 1)));
}

/** 칸 크기: 행·열 수에 맞춰 긴 변이 768 을 넘지 않게 줄인다. */
export function retroPreviewCellSize(rows: number, cols: number): number {
  const fit = Math.floor((RETRO_PREVIEW_MAX_SIDE - LABEL_W) / Math.max(1, Math.max(rows, cols)));
  return Math.max(24, Math.min(MAX_CELL, fit));
}

async function loadSheet(sheet: string): Promise<ImageBitmap | HTMLImageElement> {
  const url = withInlineAsset(`/assets/generated/pixel-fx/${sheet}.png`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`이펙트 시트를 불러오지 못했습니다: ${sheet} (HTTP ${response.status})`);
  return createImageBitmap(await response.blob());
}

export async function retroChoreographyPreviewImages(data: unknown): Promise<{ dataUrl: string; label: string }[]> {
  const payload = data as { id?: string; name?: string; layers?: readonly RetroPreviewLayerRow[] } | undefined;
  const layers = payload?.layers?.filter((layer) => layer.frames > 0) ?? [];
  if (layers.length === 0 || typeof document === "undefined" || typeof createImageBitmap === "undefined") return [];
  try {
    const cols = Math.min(RETRO_PREVIEW_MAX_COLS, Math.max(...layers.map((layer) => layer.frames)));
    const cell = retroPreviewCellSize(layers.length, cols);
    const canvas = document.createElement("canvas");
    canvas.width = LABEL_W + cols * cell;
    canvas.height = layers.length * cell;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < layers.length; row++) {
      const layer = layers[row]!;
      const y = row * cell;
      ctx.fillStyle = row % 2 ? "#1b1e26" : "#181b22";
      ctx.fillRect(0, y, canvas.width, cell);
      ctx.fillStyle = "#e8ecf4";
      ctx.font = "bold 14px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(String(layer.index), 8, y + cell / 2);
      const sheet = await loadSheet(layer.sheet);
      retroPreviewFrameIndexes(layer.frames, cols).forEach((frameIndex, col) => {
        ctx.drawImage(sheet, frameIndex * layer.frame, 0, layer.frame, layer.frame, LABEL_W + col * cell, y, cell, cell);
      });
      ctx.strokeStyle = "#2b3040";
      ctx.strokeRect(0.5, y + 0.5, canvas.width - 1, cell - 1);
    }
    return [{ dataUrl: canvas.toDataURL("image/png"), label: `연출 「${payload?.name ?? payload?.id ?? ""}」 층별 프레임(줄=층 번호, 왼쪽에서 오른쪽으로 재생 순)` }];
  } catch {
    return [];
  }
}
