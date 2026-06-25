// MCGA 헥스 좌표 → 픽셀 변환 + SVG 렌더링 도우미.
// axial 좌표계(q,r) → pointy-top 헥스 픽셀.

export interface HexPixel {
  x: number;
  y: number;
}

/** 헥스 한 변의 길이(반지름). 튜닝 포인트. */
const HEX_SIZE = 34;

/** axial → pointy-top 픽셀 중심. */
export function axialToPixel(q: number, r: number): HexPixel {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = HEX_SIZE * (3 / 2) * r;
  return { x, y };
}

/** pointy-top 헥스 폴리곤 포인트 (SVG points 문자열). */
export function hexPoints(cx: number, cy: number, size = HEX_SIZE): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // pointy-top: 각도 30°부터 시작
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    const x = cx + size * Math.cos(angleRad);
    const y = cy + size * Math.sin(angleRad);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/** SVG 뷰박스 계산 — 모든 헥스가 보이도록. */
export function computeViewBox(
  coords: { q: number; r: number }[]
): { viewBox: string; width: number; height: number } {
  if (coords.length === 0) {
    return { viewBox: "0 0 100 100", width: 100, height: 100 };
  }
  const pixels = coords.map((c) => axialToPixel(c.q, c.r));
  const xs = pixels.map((p) => p.x);
  const ys = pixels.map((p) => p.y);
  const minX = Math.min(...xs) - HEX_SIZE - 10;
  const maxX = Math.max(...xs) + HEX_SIZE + 10;
  const minY = Math.min(...ys) - HEX_SIZE - 10;
  const maxY = Math.max(...ys) + HEX_SIZE + 10;
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    viewBox: `${minX} ${minY} ${width} ${height}`,
    width,
    height,
  };
}
