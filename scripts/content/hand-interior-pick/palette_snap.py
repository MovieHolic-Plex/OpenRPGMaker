#!/usr/bin/env python3
"""그림을 실내 공통 팔레트(palette/v6.pal)로 옮긴다 — 화소마다 OKLab 에서 가장 가까운 팔레트 색, 알파는 그대로(2026-10-03).

시트 굽기(build_tileset.py)가 시트·예제 맵 그림을 쓰기 직전에 부른다. 바닥·벽·천장·옛 기물·새 기물이 한 팔레트를 쓰게 하는 곳은
여기 하나다(작업자가 v5 옛 색을 써도 굽기에서 맞춰진다). 팔레트 색끼리는 제자리로 가므로 두 번 옮겨도 같다.
  python3 scripts/content/hand-interior-pick/palette_snap.py in.png out.png
"""
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from common import PXGRID, SHARED_PAL  # noqa: E402

_PAL = {}


def colors(path=SHARED_PAL):
    """팔레트의 불투명 색(RGB). 실루엣 표시색 '#' 은 뺀다(최종본에 남으면 안 되는 색)."""
    if path not in _PAL:
        sys.path.insert(0, PXGRID); import pxgrid
        pal, _ = pxgrid.load_palette(path)
        _PAL[path] = sorted({tuple(c[:3]) for k, c in pal.items() if k != '#'})
    return _PAL[path]


def _oklab(rgb):
    c = rgb.astype(float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], 1)


def snap(im, path=SHARED_PAL):
    """→ (옮긴 그림, 바뀐 화소 수)."""
    P = np.array(colors(path), dtype=np.uint8); PL = _oklab(P)
    a = np.asarray(im.convert('RGBA')).copy(); m = a[..., 3] > 0
    if not m.any(): return Image.fromarray(a, 'RGBA'), 0
    px = a[m]; cs, inv = np.unique(px[:, :3], axis=0, return_inverse=True)
    to = P[((_oklab(cs)[:, None] - PL[None]) ** 2).sum(-1).argmin(1)]
    new = to[inv.reshape(-1)]; n = int((new != px[:, :3]).any(1).sum())
    px[:, :3] = new; a[m] = px
    return Image.fromarray(a, 'RGBA'), n


if __name__ == '__main__':
    out, n = snap(Image.open(sys.argv[1]))
    out.save(sys.argv[2]); print(sys.argv[2], '바뀐 화소', n)
