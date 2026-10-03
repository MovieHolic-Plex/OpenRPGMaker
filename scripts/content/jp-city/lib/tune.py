"""Actor1/버들항 화풍 맞춤 패스 — modern3 램프 안에서만: (1) 재질 램프 치환(회청 → 크림/따뜻), (2) 강한 경계 윤곽."""
import os, sys
import jpenv
import numpy as np
from modern_style_bible_proof import RAMPS, rgb
import post
IDX = {}
for n, r in RAMPS.items():
    for i, h in enumerate(r): IDX.setdefault(rgb(h), (n, i))

def remap(a, mp):
    """mp: {원 램프: 새 램프}. 단 번호는 비율로 대응."""
    out = a.copy(); h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            if not a[y, x, 3]: continue
            n = IDX.get(tuple(int(v) for v in a[y, x, :3]))
            if n and n[0] in mp:
                src, dst = RAMPS[n[0]], RAMPS[mp[n[0]]]
                j = round(n[1] * (len(dst) - 1) / max(len(src) - 1, 1))
                out[y, x, :3] = rgb(dst[j])
    return out

def ink(a, edge=3, inner=2, soft=1, skip=('kawara',)):
    """경계 윤곽: 투명과 닿는 픽셀 -edge 단(안쪽 윤곽), 램프가 바뀌는 곳은 아래·오른쪽 이웃이 다르면 -inner, 위·왼쪽이 다르면 -soft."""
    h, w = a.shape[:2]; out = a.copy()
    fam = lambda x, y: (post.fam(a, x, y) if 0 <= x < w and 0 <= y < h else None)
    for y in range(h):
        for x in range(w):
            if not a[y, x, 3]: continue
            f = fam(x, y); d = 0
            if f in skip:
                if any(fam(x + dx, y + dy) is None for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1))): out[y, x, :3] = post.step(a[y, x], -2)
                continue
            for dx, dy, k in ((1, 0, inner), (0, 1, inner), (-1, 0, soft), (0, -1, soft)):
                g = fam(x + dx, y + dy)
                if g is None: d = max(d, edge)
                elif g != f: d = max(d, k)
            if d and y < h - 1: out[y, x, :3] = post.step(a[y, x], -d)
    return out
