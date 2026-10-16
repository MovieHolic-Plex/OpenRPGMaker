#!/usr/bin/env python3
"""현대 연애 칩 초상: pick.json(기본 후보) + emo-pick.json(표정 후보) → public/assets/shared/portraits/<줄기>/{bust,full}-<표정>.png
분홍 테두리 제거·여백 자르기·128색(기존 finalize.py 와 같은 계약). 사용: modern_finalize.py [stem ...]"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".omo/asset-gen-tmp/portraits/modern"
DST = ROOT / "public/assets/shared/portraits"


def clean(im):
    a = np.array(im.convert("RGBA")).astype(int); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mag = np.minimum(r, b) - g
    al = np.where(al < 128, 0, 255)
    for _ in range(3):
        solid = al > 0; edge = solid & ~ndimage.binary_erosion(solid)
        kill = edge & (mag > 40) & (r > 120) & (b > 120)
        if not kill.any(): break
        al[kill] = 0
    lab, n = ndimage.label(al > 0); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s <= 40: al[lab == i] = 0
    a[..., 3] = al
    out = Image.fromarray(a.astype(np.uint8), "RGBA")
    return out.crop(out.getbbox())


def save(src: Path, dst: Path):
    q = clean(Image.open(src)).quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    dst.parent.mkdir(parents=True, exist_ok=True); q.save(dst, optimize=True); return dst.stat().st_size


def main():
    pick = json.loads((WORK / "pick.json").read_text()); epick = json.loads((WORK / "emo-pick.json").read_text()) if (WORK / "emo-pick.json").exists() else {}
    only = sys.argv[1:]; tot = n = 0
    for stem, cand in pick.items():
        if only and stem not in only: continue
        d = WORK / stem
        for kind in ("full", "bust"):
            tot += save(d / f"{kind}-{cand}.png", DST / stem / f"{kind}-base.png"); n += 1
        for emo, ec in epick.get(stem, {}).items():
            for kind in ("full", "bust"):
                tot += save(d / f"{kind}-{emo}-{ec}.png", DST / stem / f"{kind}-{emo}.png"); n += 1
    print(n, "files", round(tot / 1e6, 2), "MB")


main()
