/**
 * 화풍 보조 지표 — 영수증에 남기는 참고 숫자(통과 근거 아님). 규칙·판정은 이 값을 읽지 않는다.
 * 버들항 실측(2026-10-14): 16px 칸당 고유색 중앙값 10, p90 약 44, 가장 어두운 5% 화소의 V 약 57(0..255).
 */
import type { ObjectGateAuxMetrics } from '../../_core/objectGate';

const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : 0);

export function auxMetrics(width: number, height: number, rgba: Uint8Array, tile = 16): ObjectGateAuxMetrics {
  const counts: number[] = [];
  for (let ty = 0; ty < height; ty += tile) for (let tx = 0; tx < width; tx += tile) {
    const colors = new Set<number>(); let opaque = 0;
    for (let y = ty; y < Math.min(height, ty + tile); y++) for (let x = tx; x < Math.min(width, tx + tile); x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3]! < 128) continue;
      opaque++; colors.add((rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!);
    }
    if (opaque >= tile * tile * 0.5) counts.push(colors.size);
  }
  counts.sort((a, b) => a - b);
  const vs: number[] = []; let edge = 0, edgeDark = 0;
  const opaqueAt = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && rgba[(y * width + x) * 4 + 3]! >= 128;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!opaqueAt(x, y)) continue;
    const i = (y * width + x) * 4, v = Math.max(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    vs.push(v);
    if (!opaqueAt(x - 1, y) || !opaqueAt(x + 1, y) || !opaqueAt(x, y - 1) || !opaqueAt(x, y + 1)) { edge++; if (v < 40) edgeDark++; }
  }
  vs.sort((a, b) => a - b);
  const dark = vs.slice(0, Math.max(1, Math.floor(vs.length * 0.05)));
  return {
    tileColorsMedian: quantile(counts, 0.5), tileColorsP90: quantile(counts, 0.9),
    darkV5: dark.length ? Math.round(dark.reduce((a, b) => a + b, 0) / dark.length) : 0,
    nearBlackEdge: edge ? Math.round((edgeDark / edge) * 100) / 100 : 0, opaqueTiles: counts.length,
  };
}
