#!/usr/bin/env python3
"""원본 16px 합성(<접두>-1x.png)을 3×3 격자로 잘라 ×4 확대(verify-shots/jp-city/<접두>-crop-<행><열>.png). 눈 판정용."""
import sys, os
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
d = os.path.join(ROOT, 'verify-shots/jp-city'); pre = sys.argv[1]
im = Image.open(os.path.join(d, pre + '-1x.png'))
W, H = im.size; cw, ch = W // 3, H // 3
for r in range(3):
    for c in range(3):
        box = (c * cw, r * ch, min(W, (c + 1) * cw + 16), min(H, (r + 1) * ch + 16))   # 칸 하나만큼 겹쳐 이음새를 본다
        im.crop(box).resize(((box[2] - box[0]) * 4, (box[3] - box[1]) * 4), Image.NEAREST).save(os.path.join(d, f'{pre}-crop-{r}{c}.png'))
print('ok')
