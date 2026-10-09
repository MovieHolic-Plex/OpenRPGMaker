# 비교 시트 compare-ref.png: 같은 2배율로 [버들항·기존 동굴 기준 크롭 | 일반 암석 동굴 크롭].
#   1줄: 버들항 city6_base 절벽·돌계단·자갈길 | 동굴 입구 아치  2줄: 바다 동굴(sea-cave) | 석순 회랑  3줄: 광산 갱도(mine-tunnels) | 지하 호수·징검돌
#   4줄: 버들항 성 석재 | 갈림길·다리
import os
from PIL import Image, ImageDraw, ImageFont
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf', 13)
except Exception: FONT = None
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
mine = 'beodeul-variants/rock-cave/render-1x.png'
rows = [('버들항 절벽·돌계단 (city6_base)', crop('beodeul-city/render/city6_base.png', (60, 400, 380, 560)), '동굴 입구 아치', crop(mine, (40, 400, 360, 560))),
        ('바다 동굴 (sea-cave)', crop('beodeul-variants/sea-cave/render-1x.png', (40, 20, 360, 200)), '석순 회랑', crop(mine, (24, 20, 344, 200))),
        ('광산 갱도 (mine-tunnels)', crop('beodeul-variants/mine-tunnels/render-1x.png', (40, 150, 360, 330)), '지하 호수·징검돌', crop(mine, (420, 70, 740, 250))),
        ('버들항 성 석재 (city6_base)', crop('beodeul-city/render/city6_base.png', (120, 0, 440, 180)), '갈림길·다리', crop(mine, (240, 230, 560, 410)))]
Wd = rows[0][1].width
o = Image.new('RGB', (Wd * 2 + 16, sum(a.height + 22 for _, a, _, b in rows)), (20, 20, 24)); d = ImageDraw.Draw(o); y = 0
for la, a, lb, b in rows:
    d.text((4, y + 3), la, fill=(220, 220, 228), font=FONT); d.text((Wd + 20, y + 3), lb, fill=(220, 220, 228), font=FONT)
    o.paste(a, (0, y + 20)); o.paste(b, (Wd + 16, y + 20)); y += a.height + 22
o.save(R + 'beodeul-variants/rock-cave/compare-ref.png')
print(o.size)
