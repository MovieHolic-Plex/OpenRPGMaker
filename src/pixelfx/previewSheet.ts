// 조수 preview_pixel_fx 의 장면 그림 — 효과 하나를 시간순 8칸으로 실제 렌더러에서 그린다(편집기 전용, 런타임은 안 쓴다).
import { loadPixelFxModule } from "@/pixelfx/modules";
import { PixelFxRenderer } from "@/pixelfx/renderer";
import { normalizePixelFxSpec } from "@/project/pixelFxSpec";

const FRAMES = 8;
const MAX_CELL = 200;

export async function pixelFxPreviewImages(data: unknown): Promise<{ dataUrl: string; label: string }[]> {
  const spec = normalizePixelFxSpec((data as { spec?: unknown } | undefined)?.spec);
  if (!spec || typeof document === "undefined") return [];
  try {
    const mod = await loadPixelFxModule(spec.effectId);
    if (!mod) return [];
    const renderer = new PixelFxRenderer(mod, spec);
    const { width, height } = renderer.layout;
    const scale = Math.max(0.5, Math.min(2, MAX_CELL / Math.max(width, height)));
    const cellW = Math.round(width * scale);
    const cellH = Math.round(height * scale);
    const frame = document.createElement("canvas");
    frame.width = width;
    frame.height = height;
    const frameCtx = frame.getContext("2d");
    const canvas = document.createElement("canvas");
    canvas.width = cellW * FRAMES + (FRAMES + 1) * 4;
    canvas.height = cellH + 8;
    const ctx = canvas.getContext("2d");
    if (!ctx || !frameCtx) return [];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const image = frameCtx.createImageData(width, height);
    const total = renderer.durationSec;
    let t = 0;
    for (let i = 0; i < FRAMES; i += 1) {
      const target = (total * (i + 0.5)) / FRAMES;
      while (t < target) { const dt = Math.min(1 / 30, target - t); renderer.advance(dt); t += dt; }
      image.data.fill(0);
      renderer.paintComposite("all", image);
      frameCtx.putImageData(image, 0, 0);
      const x = 4 + i * (cellW + 4);
      ctx.fillStyle = "#1e222c";
      ctx.fillRect(x, 4, cellW, cellH);
      ctx.drawImage(frame, x, 4, cellW, cellH);
    }
    return [{ dataUrl: canvas.toDataURL("image/png"), label: `픽셀 효과 「${spec.effectId}」 시간순 ${FRAMES}칸(왼쪽→오른쪽, ${total.toFixed(1)}초, ${width}×${height} 게임 화소)` }];
  } catch {
    return [];
  }
}
