# 조각 미리보기(QA 전용): 판석 바닥 위에 조각을 늘어놓고 확대 저장.
import sys
from tc_base import *
def sheet(items, path, scale=4, floor='tc_flag', gap=16):
    W = sum(-(-im.width // 16) * 16 + gap for _, im in items) + gap
    H = max(im.height for _, im in items) + 2 * gap
    W = -(-W // 16) * 16; H = -(-H // 16) * 16
    o = Image.new('RGBA', (W, H))
    fl = SAMPLES[floor]
    for y in range(0, H, 48):
        for x in range(0, W, 48): o.alpha_composite(fl, (x, y))
    x = gap
    for n, im in items:
        o.alpha_composite(im, (x, H - gap - im.height)); x += -(-im.width // 16) * 16 + gap
    o.resize((W * scale, H * scale), Image.NEAREST).save(path)
