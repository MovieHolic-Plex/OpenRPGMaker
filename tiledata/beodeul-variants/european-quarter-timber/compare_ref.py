# 비교 시트: [버들항 기준 크롭 | 목골 구시가 크롭 | 셋째 칸(사용자 참고 그림 구조·이전 판·전투 배경)], 모두 2배.
# 「같은 게임 그림인가」를 재질별로 본다: 목골집·지붕, 광장·분수·좌판, 거리·가로수, 텃밭·잔디. 마지막 줄들은 고치기 전 판과 지금.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CITY = Image.open(ROOT + '/tiledata/beodeul-city/render/city6_base.png').convert('RGBA')
MINE = Image.open(HERE + '/render-1x.png').convert('RGBA')
REF = '/home/main/.t3/userdata/attachments/dc78f2d6-d896-472c-b215-621c0fc777a7-b50746ae-70ee-459e-8b5b-7ebede02f178.png'
USER = Image.open(REF).convert('RGBA') if os.path.exists(REF) else None
HIST = HERE + '/_qa/hist'
CW, CH = 240, 176
def old(n):
    p = f'{HIST}/{n}.png'
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
V1 = old('v1'); V2 = old('v2')
ROWS = [
    (('beodeul city6_base: half-timber houses, cobble street', CITY, (1050, 400)), ('timber quarter: north row houses', MINE, (0, 20)),
     ('user reference (structure only, not traced)', USER, (330, 0)) if USER else None),
    (('beodeul city6_base: forum plaza, fountain, stalls', CITY, (880, 560)), ('timber quarter: plaza, fountain, stalls', MINE, (350, 280)),
     ('timber quarter: chapel + guild hall', MINE, (350, 110))),
    (('beodeul city6_base: houses, lawn, trees', CITY, (40, 1080)), ('timber quarter: main street, south row', MINE, (0, 420)),
     ('timber quarter: gardens, cottages', MINE, (0, 680))),
    (('v1: flat light cobble (gray carpet)', V1, (0, 420)), ('v2: cobble with stone highlights, darker puddle rim', V2, (0, 420)), ('now', MINE, (0, 420))),
    (('v1: boxy dirt yards behind cottages', V1, (0, 680)), ('v2', V2, (0, 680)), ('now: yards removed, garden filled', MINE, (0, 680))),
]
if os.path.exists(HERE + '/battle-bg.png'):
    BB = Image.open(HERE + '/battle-bg.png').convert('RGBA')
    ROWS.append((('battle-bg: skyline of gables, plaza floor', BB, (200, 60)), ('battle-bg: left edge (lamp, tree, stall)', BB, (0, 184)),
                 ('map: same game? (plaza + houses)', MINE, (330, 200))))
ROWS = [[c for c in r if c is not None and c[1] is not None] for r in ROWS]
def lab(d, x, y, t): d.text((x + 4, y + 2), t, fill=(240, 240, 240, 255))
W = 3 * (CW * 2 + 10); Hh = len(ROWS) * (CH * 2 + 18)
o = Image.new('RGBA', (W, Hh), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
for i, row in enumerate(ROWS):
    y = i * (CH * 2 + 18)
    for k, (t, src, (sx, sy)) in enumerate(row):
        x = k * (CW * 2 + 10)
        o.alpha_composite(src.crop((sx, sy, sx + CW, sy + CH)).resize((CW * 2, CH * 2), Image.NEAREST), (x, y + 16)); lab(d, x, y, t)
o.convert('RGB').save(HERE + '/compare-ref.png')
print(o.size)
