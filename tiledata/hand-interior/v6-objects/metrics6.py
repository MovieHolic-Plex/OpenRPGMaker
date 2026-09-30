# 수치: 안쪽 명도차 · 큰 차 비율 · 체크 디더 비율 · 색 수 + EasyRPG/Tibo 칸 대조
import numpy as np, glob
from PIL import Image
def L(a): return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
def stats(ims):
    """ims: RGBA 이미지 목록. 안쪽 = 불투명이고 4이웃이 모두 불투명(윤곽 한 줄을 뺀 면)."""
    diffs = []; dith = 0; inner = 0; cols = set()
    for im in ims:
        a = np.array(im.convert('RGBA')).astype(int); al = a[..., 3] > 128
        for c in a[al][:, :3]: cols.add(tuple(c))
        h, w = al.shape
        pad = np.zeros((h + 2, w + 2), bool); pad[1:-1, 1:-1] = al
        inn = al & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
        l = L(a)
        for dy, dx in ((0, 1), (1, 0)):
            m = inn[:h - dy, :w - dx] & inn[dy:, dx:]
            diffs.extend(np.abs(l[:h - dy, :w - dx] - l[dy:, dx:])[m].tolist())
        rgb = a[..., :3]
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if not inn[y, x]: continue
                inner += 1
                p = rgb[y, x]; lf, rt, up, dn = rgb[y, x - 1], rgb[y, x + 1], rgb[y - 1, x], rgb[y + 1, x]
                if (lf == rt).all() and (up == dn).all() and (lf == up).all() and not (p == lf).all(): dith += 1
    d = np.array(diffs) if diffs else np.zeros(1)
    return {'meanDiff': round(float(d.mean()), 1), 'bigDiffPct': round(float((d > 40).mean() * 100), 1),
            'ditherPct': round(dith / max(1, inner) * 100, 1), 'colors': len(cols), 'innerPx': inner}

def ref_cells():
    out = []; srcs = []
    srcs += ['public/assets/easyrpg-chipset-interior.png', 'public/assets/easyrpg-chipset-interior-transparent.png']
    srcs += sorted(glob.glob('public/assets/tibo-interior/*.png'))
    for f in srcs:
        a = np.array(Image.open(f).convert('RGBA')).astype(int)
        h, w = a.shape[:2]
        for y in range(0, h - 15, 16):
            for x in range(0, w - 15, 16):
                c = a[y:y + 16, x:x + 16]
                if (c[..., 3] > 128).sum() >= 20: out.append(c)
    return np.stack(out), srcs

def cells_of(im):
    a = np.array(im.convert('RGBA')).astype(int); h, w = a.shape[:2]; out = []
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            c = np.zeros((16, 16, 4), int); blk = a[y:y + 16, x:x + 16]; c[:blk.shape[0], :blk.shape[1]] = blk
            if (c[..., 3] > 128).sum() >= 20: out.append(c)
    return out

def similarity(cell, R):
    """cell 과 R 의 모든 칸: (둘 중 하나라도 불투명한 화소) 가운데 둘 다 불투명하고 색 차 ≤12 인 비율의 최댓값"""
    ao = cell[..., 3] > 128; bo = R[..., 3] > 128
    close = (np.abs(R[..., :3] - cell[None, ..., :3]).max(-1) <= 12) & ao[None] & bo
    union = (ao[None] | bo).sum((1, 2))
    return float((close.sum((1, 2)) / np.maximum(1, union)).max())
