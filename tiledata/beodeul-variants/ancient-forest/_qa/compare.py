# 비교 시트: [버들항 기준 | 고대 숲] 같은 배율(2x)
import sys
from PIL import Image, ImageDraw
R='/home/main/.t3/worktrees/rpg-zzu/t3code-40fedf8f/tiledata/'
def crop(p, box): return Image.open(R + p).convert('RGB').crop(box).resize(((box[2]-box[0])*2, (box[3]-box[1])*2), Image.NEAREST)
rows = [(crop('beodeul-variants/deep-forest-path/render-1x.png', (330, 230, 650, 470)), crop('beodeul-variants/ancient-forest/render-1x.png', tuple(map(int, sys.argv[1].split(',')))), '버들항 깊은 숲길 | 고대 숲'),
        (crop('beodeul-city/render/city6_base.png', (120, 0, 440, 240)), crop('beodeul-variants/ancient-forest/render-1x.png', tuple(map(int, sys.argv[2].split(',')))), '버들항 석재(성·계단) | 고대 숲 유적')]
W = 1280 + 16; Hh = sum(a.height for a, b, t in rows) + 16 * len(rows)
o = Image.new('RGB', (W, Hh), (20, 20, 24)); y = 0; d = ImageDraw.Draw(o)
for a, b, t in rows:
    o.paste(a, (0, y)); o.paste(b, (656, y)); y += a.height + 16
o.save(R + 'beodeul-variants/ancient-forest/' + (sys.argv[3] if len(sys.argv) > 3 else 'compare-ref.png'))
