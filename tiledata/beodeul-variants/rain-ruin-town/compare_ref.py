# 비교 시트: [버들항 기준 크롭(낮) | 같은 크롭을 이 장소의 밤비 등급 night() 로 옮긴 것 | 이 장소 크롭], 모두 2배.
# 「같은 게임 그림인가」를 재질별로 본다: 집·지붕·벽, 옹벽·계단·폭포, 광장, 부두·물, 그리고 어두운 장소(늪 던전)와 톤 비교.
import os, sys
RR = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, RR)
from rr_base import night
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(RR, '..', '..', '..'))
CITY = Image.open(ROOT + '/tiledata/beodeul-city/render/city6_base.png').convert('RGBA')
SWAMP = Image.open(ROOT + '/tiledata/beodeul-variants/swamp-dungeon/render-1x.png').convert('RGBA')
MINE = Image.open(RR + '/render-1x.png').convert('RGBA')
CW, CH = 240, 176
ROWS = [
    ('beodeul city6_base: houses, roofs, cobble', CITY, (930, 700), 'rain-ruin-town: lower street houses, shop, ruin', (232, 548)),
    ('beodeul: retaining wall, stair, waterfall', CITY, (480, 380), 'rain-ruin-town: walls, falls, arch footbridge', (640, 344)),
    ('beodeul: plaza (fountain)', CITY, (930, 560), 'rain-ruin-town: fountain plaza, double lamps', (290, 420)),
    ('beodeul: quay, water', CITY, (520, 1380), 'rain-ruin-town: quay, dock, sewer outlet', (0, 690)),
    ('beodeul: houses (stair house ref)', CITY, (180, 900), 'rain-ruin-town: stair houses, laundry (east lane)', (770, 232)),
    ('swamp-dungeon (dark-tone ref)', SWAMP, (300, 200), 'rain-ruin-town: hilltop theatre, clock tower', (256, 8)),
]
def lab(d, x, y, t): d.text((x + 4, y + 2), t, fill=(240, 240, 240, 255))
W = 3 * CW * 2 + 2 * 10; Hh = len(ROWS) * (CH * 2 + 18)
o = Image.new('RGBA', (W, Hh), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
for i, (la, src, (sx, sy), lb, (mx, my)) in enumerate(ROWS):
    y = i * (CH * 2 + 18)
    a = src.crop((sx, sy, sx + CW, sy + CH))
    b = night(a) if src is CITY else a
    c = MINE.crop((mx, my, mx + CW, my + CH))
    for k, (im, t) in enumerate(((a, la), (b, ('same crop + night() grade' if src is CITY else '(already dark place)')), (c, lb))):
        x = k * (CW * 2 + 10)
        o.alpha_composite(im.resize((CW * 2, CH * 2), Image.NEAREST), (x, y + 16))
        lab(d, x, y, t)
o.convert('RGB').save(RR + '/compare-ref.png')
print(o.size)
