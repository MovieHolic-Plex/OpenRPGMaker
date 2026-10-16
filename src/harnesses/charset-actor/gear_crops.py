#!/usr/bin/env python3
"""장비 검수용 8배 걷기 크롭: 칩 하나의 4방향×3걸음을 같은 배율로 가로로 늘어놓는다(수정 전/후 나란히 비교용)."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
from PIL import Image  # noqa: E402

BG = (92, 140, 70, 255)


def crop_image(chip_txt, scale=8, dirs=('down', 'up', 'right', 'left')):
    pal, _, frames = C.load(chip_txt)
    im = Image.new('RGBA', (3 * (C.FW + 1) * scale, len(dirs) * (C.FH + 1) * scale), BG)
    for r, d in enumerate(dirs):
        for f in (0, 1, 2):
            fr = C.frame_rgba(pal, frames[(d, f)]).resize((C.FW * scale, C.FH * scale), Image.NEAREST)
            im.alpha_composite(fr, (f * (C.FW + 1) * scale, r * (C.FH + 1) * scale))
    return im.convert('RGB')


if __name__ == '__main__':
    crop_image(sys.argv[1]).save(sys.argv[2])
