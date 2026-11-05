# 비교 시트 compare-ref.png: 같은 2배율로 [버들항 기준 크롭 | 산악 요새 크롭].
#   1줄: 버들항 성 석재(city6_base) | 석문·감시탑      2줄: 버들항 성벽·계단(city6_base) | 성벽·성문 통로·도개교
#   3줄: 산길 고개 절벽(mountain-pass, 버들항 terrain 절벽) | 산악 요새 절벽·지그재그 길   4줄: 눈마을(snowfield) 눈·전나무 | 윗비탈 눈·전나무
#   0줄: 바다 절벽 길(coast-cliff-road, 버들항 terrain 절벽이 물로 떨어진다) | 성벽 아래 골짜기 낭떠러지 띠·도개교
#   python3 compare_ref.py
import os
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
mine = 'beodeul-variants/mountain-fortress/render-1x.png'
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
rows = [(crop('beodeul-variants/coast-cliff-road/render-1x.png', (100, 520, 420, 690)), crop(mine, (380, 280, 700, 450))),
        (crop('beodeul-city/render/city6_base.png', (120, 0, 440, 200)), crop(mine, (400, 60, 720, 260))),
        (crop('beodeul-city/render/city6_base.png', (120, 200, 440, 400)), crop(mine, (380, 230, 700, 430))),
        (crop('beodeul-variants/mountain-pass/render-1x.png', (150, 170, 470, 370)), crop(mine, (200, 500, 520, 700))),
        (crop('beodeul-variants/snowfield/render-1x.png', (0, 0, 320, 200)), crop(mine, (820, 380, 1140, 580)))]
o = Image.new('RGB', (1296, sum(a.height for a, b in rows) + 16 * len(rows)), (20, 20, 24)); y = 0
for a, b in rows:
    o.paste(a, (0, y)); o.paste(b, (656, y)); y += a.height + 16
o.save(R + 'beodeul-variants/mountain-fortress/compare-ref.png')
