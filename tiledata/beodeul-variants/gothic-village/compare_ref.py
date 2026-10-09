# 비교 시트: [버들항·기준작 크롭 | 같은 크롭을 고딕 등급 gloom() 으로 옮긴 것 | 고딕 마을 크롭], 모두 2배.
# 「같은 게임 그림인가」를 재질별로 본다: 목골집·지붕, 교회 석조, 풀·나무, 묘지, 광장·길. 마지막 줄은 고치기 전 판(1판)과 지금.
import os, sys, subprocess, io
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from gv_base import gloom
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V = ROOT + '/tiledata/beodeul-variants'
CITY = Image.open(ROOT + '/tiledata/beodeul-city/render/city6_base.png').convert('RGBA')
RUIN = Image.open(V + '/ruined-village/render-1x.png').convert('RGBA')
GRAVE = Image.open(V + '/graveyard-crypt/render-1x.png').convert('RGBA')
RAIN = Image.open(V + '/rain-ruin-town/render-1x.png').convert('RGBA')
MINE = Image.open(HERE + '/render-1x.png').convert('RGBA')
OLD = HERE + '/_qa/hist/v1.png'
CW, CH = 240, 176
ROWS = [
    ('beodeul city6_base: half-timber houses', CITY, (930, 700), True, 'gothic-village: north row houses', (16, 270)),
    ('beodeul city6_base: church, square', CITY, (1290, 110), True, 'gothic-village: church + yard', (372, 120)),
    ('beodeul city6_base: lawn, trees', CITY, (40, 1080), True, 'gothic-village: NW dead grove, keeper yard', (0, 40)),
    ('graveyard-crypt (ref)', GRAVE, (0, 0), False, 'gothic-village: cemetery', (676, 0)),
    ('ruined-village (ref)', RUIN, (330, 300), False, 'gothic-village: well square', (360, 360)),
    ('rain-ruin-town (ref, night)', RAIN, (150, 0), False, 'gothic-village: south row, lane', (60, 480)),
]
def lab(d, x, y, t): d.text((x + 4, y + 2), t, fill=(240, 240, 240, 255))
rows = len(ROWS) + (1 if os.path.exists(OLD) else 0) + (1 if os.path.exists(HERE + '/battle-bg.png') else 0)
W = 3 * CW * 2 + 2 * 10; Hh = rows * (CH * 2 + 18)
o = Image.new('RGBA', (W, Hh), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
for i, (la, src, (sx, sy), grade, lb, (mx, my)) in enumerate(ROWS):
    y = i * (CH * 2 + 18)
    a = src.crop((sx, sy, sx + CW, sy + CH))
    b = gloom(a) if grade else a
    c = MINE.crop((mx, my, mx + CW, my + CH))
    for k, (im, t) in enumerate(((a, la), (b, 'same crop + gloom() grade' if grade else '(reference place as is)'), (c, lb))):
        x = k * (CW * 2 + 10)
        o.alpha_composite(im.resize((CW * 2, CH * 2), Image.NEAREST), (x, y + 16)); lab(d, x, y, t)
if os.path.exists(OLD):
    y = len(ROWS) * (CH * 2 + 18); old = Image.open(OLD).convert('RGBA')
    for k, (im, (mx, my), t) in enumerate(((old, (0, 0), 'v1 (before fixes): NW, grass/leaf patches'), (MINE, (0, 0), 'now: NW'), (old, (360, 360), 'v1: square (blocky cobble edge)'))):
        x = k * (CW * 2 + 10)
        o.alpha_composite(im.crop((mx, my, mx + CW, my + CH)).resize((CW * 2, CH * 2), Image.NEAREST), (x, y + 16)); lab(d, x, y, t)
if os.path.exists(HERE + '/battle-bg.png'):
    y = (rows - 1) * (CH * 2 + 18); bb = Image.open(HERE + '/battle-bg.png').convert('RGBA')
    for k, (im, (mx, my), t) in enumerate(((bb, (180, 0), 'battle-bg: fog skyline, spire'), (bb, (0, 176), 'battle-bg: cobble floor, left edge'), (MINE, (380, 200), 'map: church + yard + cobble (same game?)'))):
        x = k * (CW * 2 + 10)
        o.alpha_composite(im.crop((mx, my, mx + CW, my + CH)).resize((CW * 2, CH * 2), Image.NEAREST), (x, y + 16)); lab(d, x, y, t)
o.convert('RGB').save(HERE + '/compare-ref.png')
print(o.size)
