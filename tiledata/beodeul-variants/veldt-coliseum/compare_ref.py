# 비교 시트 compare-ref.png: 같은 2배율로 [버들항 기준 크롭 | 대초원·투기장 크롭] 네 줄.
#   1 버들항 성 석재(city6_base)            | 투기장 바깥 앞면·정문·앞마당
#   2 버들항 성 앞 계단·판석(city6_base)     | 경기장 안·관중석·지도자 발코니
#   3 초원 하이로드 풀밭(plains-highroad)    | 대초원 야영 흔적·마른 풀 덩이
#   4 지하 묘소 방(castle-catacombs)         | 지하 대기실(쇠창살 감방·무기 걸이)
#   python3 compare_ref.py
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
mine = 'beodeul-variants/veldt-coliseum/render-1x.png'
ROWS = [
    ('beodeul city6_base: castle stone (ref)', crop('beodeul-city/render/city6_base.png', (120, 0, 440, 240)),
     'veldt-coliseum: outer arcade, gate, forecourt', crop(mine, (736, 250, 1056, 490))),
    ('beodeul city6_base: stairs + paving (ref)', crop('beodeul-city/render/city6_base.png', (120, 230, 440, 470)),
     'veldt-coliseum: arena, seating, leader balcony', crop(mine, (736, 40, 1056, 280))),
    ('plains-highroad: meadow field (ref)', crop('beodeul-variants/plains-highroad/render-1x.png', (780, 560, 1100, 800)),
     'veldt-coliseum: dry veldt, hide tents, tall grass', crop(mine, (40, 480, 360, 720))),
    ('castle-catacombs: crypt room (ref)', crop('beodeul-variants/castle-catacombs/render-1x.png', (40, 260, 360, 452)),
     'veldt-coliseum: holding cells + waiting hall', crop(mine, (336, 784, 656, 976))),
]
o = Image.new('RGB', (1296, sum(a.height + 14 for _, a, _, b in ROWS) + 8), (20, 20, 24)); d = ImageDraw.Draw(o); y = 4
for la, a, lb, b in ROWS:
    d.text((4, y), la, fill=(220, 220, 220)); d.text((660, y), lb, fill=(220, 220, 220)); y += 12
    o.paste(a, (0, y)); o.paste(b, (656, y)); y += a.height + 2
o.save(os.path.join(HERE, 'compare-ref.png'))
print(o.size)
