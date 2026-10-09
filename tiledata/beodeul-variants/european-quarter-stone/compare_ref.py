# 비교 시트: 같은 배율(2x)로 [버들항 기준 크롭 | 석조 유럽 시가지 크롭]. 석재·슬레이트 지붕·광장·바닥 결·윤곽 굵기·명암 단 수를 나란히.
#   python3 compare_ref.py  ->  compare-ref.png
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CITY = Image.open(ROOT + '/tiledata/beodeul-city/render/city6_base.png').convert('RGBA')
ME = Image.open(HERE + '/render-1x.png').convert('RGBA')
BB = Image.open(HERE + '/battle-bg.png').convert('RGBA') if os.path.exists(HERE + '/battle-bg.png') else None
PAIRS = [
    ('버들항 성: 석벽·슬레이트 지붕·창', CITY, (20, 20, 276, 212), '석조 시가지: 호텔·카페 줄(맨사르드·발코니·차양)', ME, (176, 96, 432, 288)),
    ('버들항 저택 광장: 분수·노점·판석', CITY, (880, 560, 1136, 752), '석조 시가지: 부채꼴 광장·분수·좌판', ME, (0, 448, 256, 640)),
    ('버들항 거리: 자갈길·집 앞', CITY, (900, 1100, 1156, 1292), '석조 시가지: T자 교차로·보도·젖은 포석', ME, (352, 288, 608, 480)),
    ('버들항 성 앞 계단·석물', CITY, (60, 140, 316, 332), '석조 시가지: 쇠 난간 안마당·녹는 눈·낙엽', ME, (592, 416, 848, 608)),
]
S = 2; PW, PH = 256 * S, 192 * S
rows = len(PAIRS) + (1 if BB else 0)
o = Image.new('RGBA', (PW * 2 + 30, rows * (PH + 30) + 10), (22, 22, 26, 255)); d = ImageDraw.Draw(o)
for r, (la, A, ba, lb, B, bb) in enumerate(PAIRS):
    y = 10 + r * (PH + 30)
    d.text((10, y), 'BEODEUL  ' + la.encode('ascii', 'ignore').decode() , fill=(230, 230, 230, 255))
    d.text((PW + 20, y), 'EQ-STONE', fill=(230, 230, 230, 255))
    o.alpha_composite(A.crop(ba).resize((PW, PH), Image.NEAREST), (10, y + 14))
    o.alpha_composite(B.crop(bb).resize((PW, PH), Image.NEAREST), (PW + 20, y + 14))
if BB:
    y = 10 + len(PAIRS) * (PH + 30)
    d.text((10, y), 'BATTLE-BG (left half) | MAP 2x crop', fill=(230, 230, 230, 255))
    o.alpha_composite(BB.crop((0, 0, 320, 240)).resize((PW, PH), Image.NEAREST), (10, y + 14))
    o.alpha_composite(ME.crop((352, 100, 608, 292)).resize((PW, PH), Image.NEAREST), (PW + 20, y + 14))
o.convert('RGB').save(HERE + '/compare-ref.png')
print(o.size)
