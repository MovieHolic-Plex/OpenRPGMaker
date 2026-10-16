#!/usr/bin/env python3
"""후보 칩이 이미 있는 Scarloxy 칩(뼈대 10 + 설치분)과 얼마나 다른가. 사용: scarloxy_distinct.py CHIP.png [...]
실루엣(알파>0) 화소 중 가장 가까운 기존 칩과 L1 색차 60 초과인 비율(12프레임 평균, 걷기 가운데 칸)이다. 0.55 미만이면 「같은 사람 색만 다름」으로 본다."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]


def chars(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(int)
    out = []
    for r in range(a.shape[0] // 128):
        for c in range(a.shape[1] // 72):
            out.append(a[r * 128:(r + 1) * 128, c * 72:(c + 1) * 72])
    return out


def existing():
    res = []
    for p in sorted((ROOT / 'public/assets/scarloxy').glob('scarloxy-charset-people*.png')):
        res += [(f'{p.stem}#{i}', c) for i, c in enumerate(chars(p))]
    for p in sorted((ROOT / 'public/assets/generated/charsets').glob('ScarloxyPeople*.png')):
        res += [(f'{p.stem}#{i}', c) for i, c in enumerate(chars(p)) if c[:, :, 3].any()]
    return res


def score(chip, ref):
    tot = hit = 0
    for fr in range(4):
        for col in range(3):
            y, x = fr * 32, col * 24
            a, b = chip[y:y + 32, x:x + 24], ref[y:y + 32, x:x + 24]
            m = a[:, :, 3] > 0
            tot += m.sum()
            diff = (np.abs(a[:, :, :3] - b[:, :, :3]).sum(axis=2) > 60) | (b[:, :, 3] == 0)
            hit += (m & diff).sum()
    return hit / max(1, tot)


def nearest(img_path, exclude=()):
    chip = np.array(Image.open(img_path).convert('RGBA')).astype(int)
    best = (9, '')
    for name, ref in existing():
        if name in exclude:
            continue
        s = score(chip, ref)
        if s < best[0]:
            best = (s, name)
    return best


if __name__ == '__main__':
    for p in sys.argv[1:]:
        s, n = nearest(p)
        print(f'{p}: 가장 가까운 {n} 와 다른 화소 {s:.2f}')
