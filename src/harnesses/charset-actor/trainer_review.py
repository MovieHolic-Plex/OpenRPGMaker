#!/usr/bin/env python3
"""몬스터 트레이너 칩 눈 검수용 그림 — 베이스(왼쪽)와 후보(오른쪽)를 같은 배율로 12프레임 격자(행=위·오른쪽·아래·왼쪽, 열=걸음 0·1·2)로 놓는다.

  python3 trainer_review.py RUN KEY [--scale 7] --out /tmp/x.png
기계 지표(partedit 불변 검사)는 이 그림을 대신하지 못한다 — 손에 쥔 장비·튀어나온 픽셀·네 방향이 같은 사람인지는 사람이 8배 그림으로 본다.
"""
import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

OUT = Path(os.environ.get('CTFF6_PART_OUT', H.ROOT / 'qa-runs' / 'harnesses' / 'ct-ff6-part'))
BG = (92, 140, 70, 255)


def grid_image(pal, frames, scale):
    gap = 2
    im = Image.new('RGBA', (3 * (24 + gap), 4 * (32 + gap)), BG)
    for di, d in enumerate(C.DIRS):
        for f in range(3):
            im.alpha_composite(C.frame_rgba(pal, frames[(d, f)]), (f * (24 + gap), di * (32 + gap)))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('run')
    ap.add_argument('key')
    ap.add_argument('--scale', type=int, default=7)
    ap.add_argument('--out', required=True)
    ap.add_argument('--chips-dir', default=None)
    a = ap.parse_args()
    root = Path(a.chips_dir) if a.chips_dir else OUT / a.run
    cd = root / a.key
    meta = json.loads((cd / 'meta.json').read_text())
    pal, _, frames = C.load(cd / 'chip.chr.txt')
    bp, bf = H.base_of(meta['base'].split('@')[0])
    left, right = grid_image(bp, bf, a.scale), grid_image(pal, frames, a.scale)
    sheet = Image.new('RGB', (left.width + right.width + 12, left.height + 14), (24, 24, 24))
    sheet.paste(left, (0, 14))
    sheet.paste(right, (left.width + 12, 14))
    ImageDraw.Draw(sheet).text((2, 1), f'{a.key}  base {meta["base"]}  (왼쪽 베이스 / 오른쪽 후보)', fill=(255, 255, 255))
    sheet.save(a.out)
    print(a.out, sheet.size)


if __name__ == '__main__':
    main()
