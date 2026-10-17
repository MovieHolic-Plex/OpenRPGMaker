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


def normalize_8heads_full(im: Image.Image, chin_ratio: float = 0.19, collar_ratio: float = 0.222, target_heads: float = 7.6, body_widen: float = 0.88) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    h, w, _ = arr.shape
    chin_y = chin_ratio * h
    collar_y = collar_ratio * h
    target_h = 1000
    target_head_h = target_h / target_heads
    head_scale = target_head_h / chin_y
    target_collar_y = collar_y * head_scale
    body_scale_y = (target_h - target_collar_y) / (h - collar_y)
    body_scale_x = body_scale_y * body_widen
    y_band0, y_band1 = max(0, int(chin_y - 0.01 * h)), min(h, int(collar_y + 0.02 * h))
    xs = np.where((arr[y_band0:y_band1, :, 3] > 128).any(axis=0))[0]
    cx_src = float(xs.min() + xs.max()) / 2.0 if len(xs) else w / 2.0
    target_w = int(round(w * max(body_scale_x, head_scale) + 16))
    cx_dst = target_w * (cx_src / w)
    ys_dst = np.arange(target_h, dtype=np.float64)
    ys_src = np.where(ys_dst <= target_collar_y, ys_dst / head_scale, collar_y + (ys_dst - target_collar_y) / body_scale_y)
    ys_src_idx = np.clip(np.round(ys_src).astype(np.int32), 0, h - 1)
    u = np.clip((ys_dst - (target_collar_y - 4.0)) / 32.0, 0.0, 1.0)
    scale_x = head_scale + (body_scale_x - head_scale) * (0.5 - 0.5 * np.cos(np.pi * u))
    xs_src_idx = np.round(cx_src + (np.arange(target_w, dtype=np.float64)[None, :] - cx_dst) / scale_x[:, None]).astype(np.int32)
    valid_x = (xs_src_idx >= 0) & (xs_src_idx < w)
    out_arr = arr[ys_src_idx[:, None], np.clip(xs_src_idx, 0, w - 1)]
    out_arr[~valid_x] = (0, 0, 0, 0)
    out_im = Image.fromarray(out_arr, "RGBA")
    bbox = out_im.getbbox()
    return out_im.crop(bbox) if bbox else out_im


def save(src: Path, dst: Path):
    cleaned = clean(Image.open(src))
    if dst.name.startswith("full-"):
        cleaned = normalize_8heads_full(cleaned)
    q = cleaned.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
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
