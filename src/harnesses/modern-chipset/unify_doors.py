#!/usr/bin/env python3
"""건물 그림의 문(입구)을 계약 규격(style-building.md 6항) 표준 문 그림으로 덮어쓴다. 문 말고는 건드리지 않는다.

  unify_doors.py <in.png> <door_x0> <door_x1> <out.png> [--double]
화풍이 서로 다른 문(2px 짙은 틀·밝은 틀·나무문…)을 한 규격으로 맞추는 결정적 후처리다. 모델이 그리지 않는다.
"""
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette

def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
RAMPS = {name: [hexrgb(c) for c in cols] for name, _l, cols, _d in palette.build()}
INK = RAMPS['ink'][0]; WHITE = RAMPS['white'][1]; WHITE_D = RAMPS['white'][0]
TEAL = RAMPS['teal']; BODY = RAMPS['body']; AMBER = RAMPS['amber'][3]
DOOR_H = 30


def leaf(w):
    """한 짝: 폭 w, 높이 30. 바깥 1px 짙은 틀 + 안쪽 1px 흰 틀 + 위 유리 + 가로 문틀 + 아래 패널."""
    im = Image.new('RGBA', (w, DOOR_H), (0, 0, 0, 0)); px = im.load()
    for y in range(DOOR_H):
        for x in range(w):
            if x in (0, w - 1) or y == 0 or y == DOOR_H - 1: px[x, y] = INK
            elif x in (1, w - 2) or y == 1: px[x, y] = WHITE if x != w - 2 else WHITE_D
            elif y <= 18:
                t = x - 2 + (18 - y) // 3                                 # 대각 하이라이트
                px[x, y] = TEAL[4] if t in (3, 4) else (TEAL[3] if t < 3 else TEAL[2])
            elif y == 19: px[x, y] = WHITE_D
            elif y >= 26: px[x, y] = BODY[3]                              # 킥 플레이트
            else: px[x, y] = TEAL[2]
    return im


def door(double):
    if not double:
        d = leaf(16); d.putpixel((13, 15), AMBER); d.putpixel((13, 16), AMBER); return d
    d = Image.new('RGBA', (24, DOOR_H), (0, 0, 0, 0)); d.alpha_composite(leaf(12), (0, 0)); d.alpha_composite(leaf(12), (12, 0))
    for y in range(DOOR_H): d.putpixel((11, y), INK); d.putpixel((12, y), INK)
    for y in (15, 16): d.putpixel((9, y), AMBER); d.putpixel((14, y), AMBER)
    return d


def unify(im, x0, x1, double=None):
    im = im.convert('RGBA'); w, h = im.size
    if double is None: double = (x1 - x0) >= 21
    d = door(double); cx = (x0 + x1) // 2; px0 = max(0, min(w - d.width, cx - d.width // 2))
    out = im.copy()
    for y in range(h - DOOR_H, h):                      # 옛 문 흔적이 남지 않게 문 자리 양옆 2px 까지 벽 색으로 이웃에서 채운다
        for x in list(range(px0 - 2, px0)) + list(range(px0 + d.width, px0 + d.width + 2)):
            if 0 <= x < w and x0 - 3 <= x <= x1 + 3:
                src = out.getpixel((max(0, px0 - 3), y)) if x < px0 else out.getpixel((min(w - 1, px0 + d.width + 2), y))
                out.putpixel((x, y), src)
    out.alpha_composite(d, (px0, h - DOOR_H)); return out


if __name__ == '__main__':
    a = sys.argv[1:]; double = '--double' in a; a = [x for x in a if x != '--double']
    unify(Image.open(a[0]), int(a[1]), int(a[2]), True if double else None).save(a[3])
