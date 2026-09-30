#!/usr/bin/env python3
"""일본 세트 「현재 후보(강남 결)」 비교판 — jp_style_demo.py 와 같은 칸 배치(32×24칸, 512×384px)를 이미 만들어 둔 후보·킷 조각으로 조립한다.

  python3 scripts/content/atlas-pick/jp_style_gangnam.py     # → tiledata/atlas-pick/style-demo-jp2/street/dm1-gangnam.png

새로 그리는 것이 없다: candidates-jp 의 후보 PNG(konbini_front j3-A 등)와 킷 예제(kit_shopfront/k2-A.ex-row15 등)를
바닥(현대 시트 3076 보도·3136 아스팔트) 위에 놓기만 한다. 비교 전용 — 새 결의 산출물이 아니다.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from common import *          # noqa
from PIL import Image

CAND = os.path.join(BASE, 'candidates-jp')
OUT = os.path.join(BASE, 'style-demo-jp2/street')
PAVE, ASPH = 3076, 3136
T = 16
cv = Image.new('RGBA', (512, 384))
sheet = Image.open(MODERN_SHEET).convert('RGBA')

def tile(t): return sheet.crop(((t % 30) * T, (t // 30) * T, (t % 30) * T + T, (t // 30) * T + T))
def fill(x, y, w, h, t):
    for j in range(y, y + h, T):
        for i in range(x, x + w, T): cv.alpha_composite(tile(t), (i, j))
def img(rel): return Image.open(os.path.join(CAND, rel)).convert('RGBA')
def put(rel, x, y, crop=None, tiles=None):
    im = img(rel)
    if crop: im = im.crop(crop)
    cv.alpha_composite(im, (x, y))
def tiled(rel, x, y, w, h):
    im = img(rel)
    for j in range(y, y + h, im.height):
        for i in range(x, x + w, im.width):
            cv.alpha_composite(im.crop((0, 0, min(im.width, x + w - i), min(im.height, y + h - j))), (i, j))

# 바닥
fill(0, 0, 512, 128, PAVE); fill(0, 128, 512, 64, ASPH); fill(0, 192, 512, 16, PAVE)
fill(0, 208, 512, 112, PAVE); fill(0, 320, 512, 16, ASPH); fill(0, 336, 512, 48, PAVE)

# 1) 가게 줄(0~96): 킷 예제 row15(가게 15칸)와 그 위 윗층은 kit_bldg 8층 예제의 층을 잘라 쓴다
floors = img('kit_bldg/k1-A.ex-b8f4.png').crop((0, 96, 128, 144))
for i in range(0, 240, 128): cv.alpha_composite(floors.crop((0, 0, min(128, 240 - i), 48)), (i, 0))
put('kit_shopfront/k2-A.ex-row15.png', 0, 48)
put('kit_bldg/k1-A.ex-b4f2.png', 240, 0)
put('zakkyo_building/j5-A.png', 304, 16)
put('kit_bldg/k1-B.ex-b4f2.png', 352, 0)
cv.alpha_composite(floors.crop((0, 0, 96, 48)), (416, 0))
put('ramen_front/j5-A.png', 416, 48); put('kit_shopfront/k2-A.ex-closed3.png', 480, 48, crop=(0, 0, 32, 48))

# 2) 보도(96~128)
put('vending_drink/r1-A.png', 336, 96); put('standing_sign/j4-A.png', 76, 96); put('mamachari/j5-B.png', 24, 108)
put('potted_plants/j2-A.png', 176, 108);

# 3) 차도(128~192): 횡단보도 · 맨홀
for j in (128, 160): put('crosswalk_jp/j3-C.png', 224, j)
put('manhole_jp/j1-C.png', 104, 176)

# 4) 아래 보도(192~208): 신호등 킷
put('jp_signal/j5-A.png', 272, 160)

# 5) 낮은 건물 지붕(208~320): 지붕 후보 + 벽 후보를 세 동으로
for (x0, w) in ((0, 176), (184, 168), (360, 152)):
    tiled('house_roof/j1-A.png', x0, 208, w, 64)
    tiled('house_wall/j1-A.png', x0, 272, w, 48)
tiled('ac_unit/j5-A.png', 90, 224, 16, 16)
fill(176, 208, 8, 112, ASPH); fill(352, 208, 8, 112, ASPH)

# 6) 골목 · 철도(336~384) · 전신주
tiled('power_lines/j3-A.png', 0, 320, 512, 16)
for y in (352, 368): tiled('rail_track/j5-A.png', 0, y, 512, 16)
for x in (96, 432): put('utility_pole/j5-A.png', x, 320)

os.makedirs(OUT, exist_ok=True)
cv.save(os.path.join(OUT, 'dm1-gangnam.png'))
print('ok', cv.size)
