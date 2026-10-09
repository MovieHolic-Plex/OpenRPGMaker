# 비교 시트 compare-ref.png: 같은 2배율로 [버들항 기준 크롭 | 고대 숲 크롭].
#   윗줄 = 깊은 숲길(deep-forest-path) 숲 질감 | 고대 숲 거목·길,  아랫줄 = 버들항 성 석재·계단(city6_base) | 고대 숲 유적.
#   python3 compare_ref.py [숲 x0,y0,x1,y1] [유적 x0,y0,x1,y1]   (고대 숲 render-1x 좌표, 320x240)
import os, sys
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
args = sys.argv[1:] if len(sys.argv) >= 3 else ['220,528,540,768', '690,130,1010,370']
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.NEAREST)
mine = 'beodeul-variants/ancient-forest/render-1x.png'
rows = [(crop('beodeul-variants/deep-forest-path/render-1x.png', (330, 230, 650, 470)), crop(mine, tuple(map(int, args[0].split(','))))),
        (crop('beodeul-city/render/city6_base.png', (120, 0, 440, 240)), crop(mine, tuple(map(int, args[1].split(',')))))]
o = Image.new('RGB', (1296, sum(a.height for a, b in rows) + 16 * len(rows)), (20, 20, 24)); y = 0
for a, b in rows:
    o.paste(a, (0, y)); o.paste(b, (656, y)); y += a.height + 16
o.save(R + 'beodeul-variants/ancient-forest/compare-ref.png')
