"""점선 상자 실험: 기준 집(원본, 같은 배율) + 20×30칸 점선 상자. 1254² 마젠타, 배율 2(도트 1 = 2px)."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from fhlib import *
K, C, T = 2, 1254, 16
BW, BH = 20, 30
f = form('ref-castle-05')
im, src = form_render(f)          # 문은 위 칸 검정 + 359
house = Image.fromarray(im, 'RGBA')
ref = Image.new('RGB', (C, C), MAGENTA)
bw, bh = BW * T * K, BH * T * K
bx, by = 40, (C - bh) // 2
hx = bx + bw + 60; hy = by + bh - house.height * K
ref.paste(house.resize((house.width * K, house.height * K), Image.NEAREST), (hx, hy), house.resize((house.width * K, house.height * K), Image.NEAREST))
d = ImageDraw.Draw(ref)
for x in range(bx, bx + bw, 16):                                  # 점선(8px 선, 8px 빈칸)
    d.line([(x, by), (x + 7, by)], fill=(20, 20, 20), width=3); d.line([(x, by + bh - 1), (x + 7, by + bh - 1)], fill=(20, 20, 20), width=3)
for y in range(by, by + bh, 16):
    d.line([(bx, y), (bx, y + 7)], fill=(20, 20, 20), width=3); d.line([(bx + bw - 1, y), (bx + bw - 1, y + 7)], fill=(20, 20, 20), width=3)
ref.save(f'{OUT}/mansion-ref.png')
json.dump(dict(scale=K, box=[bx, by, bw, bh], cells=[BW, BH], house=[hx, hy, house.width * K, house.height * K]), open(f'{OUT}/mansion-ref.json', 'w'))
print(bx, by, bw, bh, hx, hy)
