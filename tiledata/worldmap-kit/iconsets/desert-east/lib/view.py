#!/usr/bin/env python3
"""python3 view.py out.png 배율 이름,...  — 아이콘을 초록 땅 위에 확대해 나란히."""
import sys
import importlib
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from show import on_ground, zoom  # noqa: E402


def registry():
    reg = {}
    for m in ('scenes_a', 'scenes_b', 'scenes_c', 'scenes_d'):
        try:
            reg.update(importlib.import_module(m).ICONS)
        except ImportError:
            pass
    return reg


if __name__ == '__main__':
    out, z = sys.argv[1], int(sys.argv[2])
    names = sys.argv[3].split(',')
    reg = registry()
    ims = []
    for n in names:
        a, st = reg[n]()
        ims.append((n, zoom(on_ground(a), z)))
        print(n, a.shape[:2], st['all'])
    W = sum(i.width + 12 for _, i in ims)
    H = max(i.height for _, i in ims) + 16
    s = Image.new('RGB', (W, H), (30, 30, 34))
    d = ImageDraw.Draw(s)
    x = 0
    for n, im in ims:
        s.paste(im, (x, 16))
        d.text((x + 2, 2), n, fill=(230, 230, 230))
        x += im.width + 12
    s.save(out)
