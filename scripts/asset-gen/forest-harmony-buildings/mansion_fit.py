import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from fhlib import *
from collections import Counter
meta = json.load(open(f'{OUT}/mansion-ref.json')); K = meta['scale']; bx, by, bw, bh = meta['box']
# 원본 집 칸들의 색(지붕·벽·목재·창·문) — 가까운 색 잠금용
HOUSE_TILES = [374,375,376,377,404,405,354,355,384,385,15,16,17,45,46,47,75,76,77,12,13,14,42,43,44,72,73,74,85,87,359,329]
pal = sorted({tuple(int(v) for v in p[:3]) for t in HOUSE_TILES for p in np.array(tile(t)).reshape(-1, 4) if p[3] > 200})
pal = np.array(pal)
def lab(rgb):
    c = np.asarray(rgb, float) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]]) / [0.9505, 1.0, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
print('원본 집 팔레트', len(pal), '색')
for i in sys.argv[1:]:
    r = Image.open(f'{OUT}/mansion-c{i}-raw.png').convert('RGBA'); b = Image.new('RGBA', r.size, (255, 0, 255, 255)); b.alpha_composite(r)
    a = np.array(b.convert('RGB')).astype(int)
    bg = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110)
    # 상자 좌표 그대로 2px 칸 중앙 표본 → 320×480
    H, W = bh // K, bw // K
    ys = by + np.arange(H) * K; xs = bx + np.arange(W) * K
    blk = a[ys[:, None], xs[None, :]]            # 2×2 블록 왼쪽 위(블록 안 균일성은 아래서 잰다)
    blk = np.median(np.stack([a[ys[:, None] + dy, xs[None, :] + dx] for dy in (0, 1) for dx in (0, 1)]), 0).astype(int)
    m = ~np.stack([bg[ys[:, None] + dy, xs[None, :] + dx] for dy in (0, 1) for dx in (0, 1)]).any(0)
    art = np.zeros((H, W, 4), np.uint8); art[m, :3] = blk[m]; art[m, 3] = 255
    Image.fromarray(art).save(f'{OUT}/mansion-c{i}-px.png')
    # 가까운 원본 색 잠금
    lk = art.copy(); v = blk[m]; d = ((lab(v)[:, None] - lab(pal)[None]) ** 2).sum(-1); lk[m, :3] = pal[d.argmin(1)]
    Image.fromarray(lk).save(f'{OUT}/mansion-c{i}-lock.png')
    # 측정: 상자 채움, 2×2 블록 균일성(모델이 도트 격자에 맞췄나), 문 크기, 색 수, 잠금 오차
    yy, xx = np.nonzero(m)
    q = np.stack([a[ys[:, None] + dy, xs[None, :] + dx] for dy in (0, 1) for dx in (0, 1)])
    uni = float((np.abs(q - q[0]).sum(-1).max(0) < 24)[m].mean())
    lum = art[..., :3].astype(int) @ [0.299, 0.587, 0.114]
    lab_, n_ = ndimage.label((lum < 20) & m)
    doors = sorted([(int(sl[1].stop - sl[1].start), int(sl[0].stop - sl[0].start)) for sl in ndimage.find_objects(lab_) if (sl[1].stop - sl[1].start) >= 6 and (sl[0].stop - sl[0].start) >= 8], key=lambda t: -t[0] * t[1])[:3]
    err = float(np.sqrt(d.min(1)).mean())
    print(f'c{i}: 상자 채움 가로 {(xx.max()-xx.min()+1)/W*100:.0f}% 세로 {(yy.max()-yy.min()+1)/H*100:.0f}% | 2px 블록 균일 {uni*100:.0f}% | 검은 입구(도트 w×h) {doors} (원본 문 16×32) | 색 {len(Counter(map(tuple, art[m][:, :3])))}개 → 잠금 {len(pal)}색, 평균 오차 ΔE {err:.1f}')
