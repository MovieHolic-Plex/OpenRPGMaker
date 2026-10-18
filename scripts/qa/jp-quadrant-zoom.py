#!/usr/bin/env python3
"""렌더한 jp_city 거리 지도 PNG 를 4등분(NW·NE·SW·SE)해 정수배 확대 PNG 로 자른다 - 적대적 시각 검수(확대해서 칸 단위로 본다)용.

    python3 scripts/qa/jp-quadrant-zoom.py IN.png [IN2.png ...] --out DIR [--zoom 3]

출력 DIR/<입력 이름>-<NW|NE|SW|SE>-<zoom>x.png. 자르는 선은 16px 칸 경계에 맞춘다(칸이 반으로 잘리지 않게)."""
import argparse
import os

from PIL import Image

TILE = 16


def quadrants(im: Image.Image):
    cx = (im.width // TILE // 2) * TILE
    cy = (im.height // TILE // 2) * TILE
    return {
        "NW": (0, 0, cx, cy),
        "NE": (cx, 0, im.width, cy),
        "SW": (0, cy, cx, im.height),
        "SE": (cx, cy, im.width, im.height),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--zoom", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for path in a.inputs:
        im = Image.open(path).convert("RGBA")
        stem = os.path.splitext(os.path.basename(path))[0]
        for name, box in quadrants(im).items():
            q = im.crop(box)
            q = q.resize((q.width * a.zoom, q.height * a.zoom), Image.NEAREST)
            dst = os.path.join(a.out, f"{stem}-{name}-{a.zoom}x.png")
            q.save(dst)
            print(dst)


if __name__ == "__main__":
    main()
