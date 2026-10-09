# 비교 시트 compare-ref.png: 같은 2배율로 [버들항 기준 크롭 | 폐허 마을 크롭].
#   1줄 = 버들항 반목조 집 동네(city6_base) | 폐허 마을 서쪽 폐가들
#   2줄 = 버들항 대성당·포석 광장(city6_base) | 불탄 교회·광장
#   3줄 = 초원 하이로드 무너진 망루(기준작) | 폐허 마을 묘지 담·지하 입구
#   python3 compare_ref.py
import os
from PIL import Image, ImageDraw
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
mine = 'beodeul-variants/ruined-village/render-1x.png'
rows = [(crop('beodeul-city/render/city6_base.png', (220, 1040, 540, 1280)), crop(mine, (120, 300, 440, 540)), '버들항 반목조 집 | 폐가(꺼진 지붕·깨진 창)'),
        (crop('beodeul-city/render/city6_base.png', (1290, 80, 1610, 320)), crop(mine, (380, 100, 700, 340)), '버들항 대성당·포석 | 불탄 교회·금 간 포석'),
        (crop('beodeul-variants/plains-highroad/render-1x.png', (430, 80, 750, 320)), crop(mine, (640, 20, 960, 260)), '초원 하이로드 망루 | 묘지 담·지하 묘소')]
o = Image.new('RGB', (1296, sum(a.height for a, b, t in rows) + 30 * len(rows)), (20, 20, 24)); d = ImageDraw.Draw(o); y = 0
for a, b, t in rows:
    d.text((6, y + 8), t.encode('ascii', 'ignore').decode() or ' ', fill=(220, 220, 220))
    o.paste(a, (0, y + 24)); o.paste(b, (656, y + 24)); y += a.height + 30
o.save(R + 'beodeul-variants/ruined-village/compare-ref.png')
