# 비교 시트 compare-ref.png: 같은 2배율로 [버들항 기준 크롭 | 늪 던전 크롭] 세 줄.
#   1줄 = 버들항 호수·잔교(city6_base) | 늪물·널다리      2줄 = 버들항 신전 석재(city6_base) | 가라앉은 사당·돌 단
#   3줄 = 깊은 숲길 숲 질감(deep-forest-path) | 맹그로브 섬·서쪽 숲
#   python3 compare_ref.py [물 x0,y0] [사당 x0,y0] [숲 x0,y0]   (늪 던전 render-1x 좌표, 각 320x240)
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
a = sys.argv[1:] if len(sys.argv) >= 4 else ['120,300', '640,140', '150,250']
def crop(p, x, y, w=320, h=240): return Image.open(R + p).convert('RGB').crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.NEAREST)
mine = 'beodeul-variants/swamp-dungeon/render-1x.png'
pt = lambda s_: tuple(int(v) for v in s_.split(','))
rows = [('beodeul city6_base: 호수·잔교', crop('beodeul-city/render/city6_base.png', 220, 1340), '늪 던전: 늪물·널다리', crop(mine, *pt(a[0]))),
        ('beodeul city6_base: 신전 석재', crop('beodeul-city/render/city6_base.png', 880, 500), '늪 던전: 가라앉은 사당', crop(mine, *pt(a[1]))),
        ('deep-forest-path: 숲', crop('beodeul-variants/deep-forest-path/render-1x.png', 330, 230), '늪 던전: 맹그로브 섬·숲', crop(mine, *pt(a[2])))]
from PIL import ImageFont
try: F = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 12)
except Exception: F = None
o = Image.new('RGB', (1296, sum(r[1].height + 18 for r in rows)), (20, 20, 24)); d = ImageDraw.Draw(o); y = 0
for la, A_, lb, B_ in rows:
    d.text((4, y + 1), la, fill=(230, 230, 230), font=F); d.text((660, y + 1), lb, fill=(230, 230, 230), font=F)
    o.paste(A_, (0, y + 16)); o.paste(B_, (656, y + 16)); y += A_.height + 18
o.save(os.path.join(HERE, 'compare-ref.png')); print(o.size)
