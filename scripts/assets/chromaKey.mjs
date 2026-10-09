// scripts/assets/chromaKey.mjs
/** RGBA 버퍼에서 #00FF00(±tol) 픽셀의 alpha를 0으로 만든다. 새 버퍼 반환. */
export function chromaKeyToAlpha(rgba, key = [0, 255, 0], tol = 24) {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const dr = out[i] - key[0], dg = out[i + 1] - key[1], db = out[i + 2] - key[2];
    if (dr * dr + dg * dg + db * db <= tol * tol * 3) out[i + 3] = 0;
  }
  return out;
}
