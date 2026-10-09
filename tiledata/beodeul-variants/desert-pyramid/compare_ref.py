# 비교 시트 compare-ref.png: 같은 2배율로 [기준 크롭 | 사막 피라미드 크롭] 세 줄.
#   1 = 버들항 성 석재(city6_base) | 피라미드 마름돌·입구
#   2 = 사막 오아시스(desert-oasis) 오아시스·집 | 이 맵 오아시스·시장
#   3 = 버들항 절벽·풀(city6_base) | 이 맵 고분 터·절벽
#   python3 compare_ref.py   (상자 좌표는 아래 BOX, render-1x 화소)
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
BOX = {'pyr': (600, 150, 820, 315), 'oasis': (470, 560, 690, 725), 'necro': (120, 40, 340, 205)}
REF = [('beodeul-city/render/city6_base.png', (120, 0, 340, 165), 'beodeul city6_base (castle stone)', 'pyr', 'desert-pyramid: pyramid gate'),
       ('beodeul-variants/desert-oasis/render-1x.png', (180, 280, 400, 445), 'desert-oasis (same desert set)', 'oasis', 'desert-pyramid: oasis + market'),
       ('beodeul-city/render/city6_base.png', (0, 420, 220, 585), 'beodeul city6_base (cliff + grass)', 'necro', 'desert-pyramid: tombs + cliff')]
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
mine = 'beodeul-variants/desert-pyramid/render-1x.png'
rows = [(crop(p, b), crop(mine, BOX[k]), la, lb) for (p, b, la, k, lb) in REF]
pw = rows[0][0].width; ph = rows[0][0].height
o = Image.new('RGB', (pw * 2 + 24, (ph + 22) * len(rows) + 8), (24, 24, 28)); d = ImageDraw.Draw(o)
for i, (a, b, la, lb) in enumerate(rows):
    y = 8 + i * (ph + 22)
    d.text((8, y), la, fill=(230, 230, 230)); d.text((pw + 16, y), lb, fill=(230, 230, 230))
    o.paste(a, (8, y + 14)); o.paste(b, (pw + 16, y + 14))
o.save(HERE + '/compare-ref.png')
print(o.size)
