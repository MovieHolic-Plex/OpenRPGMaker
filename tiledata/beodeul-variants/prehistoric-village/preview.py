# 조각 미리보기: 버들항 잔디 칸 위에 3배로 늘어놓는다(작업 확인용, _look/ 에 쓴다).  python3 preview.py 모듈 함수1 함수2 ...
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from pv_base import *
from PIL import ImageDraw


def sheet(items, scale=3, cols=6, out='_look/prev.png', bg_xy=(0, 128)):
    tile = terrain.CH.crop((bg_xy[0], bg_xy[1], bg_xy[0] + 16, bg_xy[1] + 16)).convert('RGBA')
    cw = max(i.width for _, i in items) + 8; ch = max(i.height for _, i in items) + 14
    rows = (len(items) + cols - 1) // cols
    W, Hh = cols * cw, rows * ch
    W = (W + 15) // 16 * 16; Hh = (Hh + 15) // 16 * 16
    bg = blank(W, Hh)
    for y in range(0, Hh, 16):
        for x in range(0, W, 16): bg.alpha_composite(tile, (x, y))
    for k, (n, im) in enumerate(items):
        x = (k % cols) * cw + 4; y = (k // cols) * ch + 4
        bg.alpha_composite(im, (x, y))
    big = bg.resize((W * scale, Hh * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for k, (n, im) in enumerate(items):
        x = (k % cols) * cw + 4; y = (k // cols) * ch + 4
        d.text((x * scale, (y + im.height + 1) * scale), n, fill=(255, 255, 255, 255))
    big.save(os.path.join(HERE, out))
    return big


if __name__ == '__main__':
    mod = importlib.import_module(sys.argv[1])
    names = sys.argv[2:]
    out = '_look/prev.png'
    if names and names[0].startswith('--out='): out = names.pop(0)[6:]
    items = [(n, getattr(mod, n)()) for n in names]
    im = sheet(items, cols=min(6, len(items)), out=out)
    print(im.size)
