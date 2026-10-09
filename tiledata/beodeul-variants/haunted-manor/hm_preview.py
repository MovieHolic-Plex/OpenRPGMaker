# 조각 미리보기(QA 용): 모듈의 조각 함수들을 저택 마루 위에 3배로 늘어놓는다.  python3 hm_preview.py hm_art1 [out]
import sys, os, inspect
from hm_kit import *
from PIL import ImageDraw


def board(items, out, scale=4, maxw=1100, bgtag='hm_boards'):
    """흐름 배치(조각마다 제 폭), 4배."""
    pos = []; x = y = 6; rowh = 0
    for n, im in items:
        w = im.width * scale; h = im.height * scale + 16
        if x + w > maxw and x > 6: x = 6; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += w + 10; rowh = max(rowh, h)
    bd = Image.new('RGBA', (maxw, y + rowh + 8), (28, 28, 34, 255)); d = ImageDraw.Draw(bd)
    s = SAMPLES[bgtag]
    for (n, im), (x, y) in zip(items, pos):
        bg = Image.new('RGBA', im.size)
        for yy in range(0, im.height, 48):
            for xx in range(0, im.width, 48): bg.alpha_composite(s, (xx, yy))
        bg.alpha_composite(im)
        bd.alpha_composite(bg.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y))
        d.text((x, y + im.height * scale + 2), n[:22], fill=(220, 220, 228, 255))
    bd.save(out)


if __name__ == '__main__':
    mod = __import__(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else '_qa/%s.png' % sys.argv[1]
    names = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    items = []
    for n, f in inspect.getmembers(mod, inspect.isfunction):
        if f.__module__ != mod.__name__ or n.startswith('_'): continue
        if names and n not in names: continue
        try: items.append((n, f()))
        except TypeError: pass
    board(items, out, scale=int(os.environ.get('SC', 4)))
    print(len(items), 'parts ->', out)
