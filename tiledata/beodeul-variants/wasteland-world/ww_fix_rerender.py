# 전수 감사 보정(2026-10-08) 다시 렌더 — 균열·점토판 오토타일만 새 판(ww_fix_crack·ww_fix_claypan)으로 갈아 끼워
#   render-1x/2x.png · check-autotile.png · compare-ref.png 를 다시 쓴다(다른 조각·partmeta 는 손대지 않는다).
#   compare-ref.png: 이전 판(HEAD render-1x) | 새 판, 달라진 화소가 가장 많은 곳 6군데를 2배로 + 마지막 줄 5x5 덩이(옛 | 새).
import os, sys, io, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw
import make_wasteland_world as M
import ww_auto as A, ww_fix as FX
import ww_fix_crack, ww_fix_claypan

REL = 'tiledata/beodeul-variants/wasteland-world/'


def git_img(path, rev='HEAD'):
    raw = subprocess.run(['git', 'show', f'{rev}:{REL}{path}'], cwd=HERE, capture_output=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGBA')


def diff_boxes(old, new, k=6, bw=240, bh=180):
    d = (np.abs(np.array(old.convert('RGB')).astype(int) - np.array(new.convert('RGB')).astype(int)).sum(2) > 0).astype(np.int64)
    ii = np.pad(d.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    H, W = d.shape; boxes = []
    for _ in range(k):
        best = None
        for y in range(0, H - bh + 1, 20):
            for x in range(0, W - bw + 1, 20):
                if any(not (x + bw <= bx or bx + bw <= x or y + bh <= by or by + bh <= y) for bx, by in boxes): continue
                v = ii[y + bh, x + bw] - ii[y, x + bw] - ii[y + bh, x] + ii[y, x]
                if best is None or v > best[0]: best = (v, x, y)
        if not best or best[0] == 0: break
        boxes.append((best[1], best[2]))
    return [(x, y, x + bw, y + bh) for x, y in boxes]


def blob(sheet, bg):
    out = Image.new('RGBA', (7 * 16, 7 * 16))
    for y in range(7):
        for x in range(7): out.alpha_composite(bg, (x * 16, y * 16))
    inn = lambda x, y: 1 <= x <= 5 and 1 <= y <= 5
    for y in range(1, 6):
        for x in range(1, 6):
            n = (1 if inn(x, y - 1) else 0) | (2 if inn(x + 1, y) else 0) | (4 if inn(x, y + 1) else 0) | (8 if inn(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
    return out


def compare(old, new, old_sheets, new_sheets, bg):
    pairs = [('BEFORE (%d,%d)' % b[:2], old.crop(b), 'AFTER crack/claypan autotile', new.crop(b)) for b in diff_boxes(old, new)]
    for k in ('crack', 'claypan'):
        p0 = Image.new('RGBA', (240, 180), (28, 28, 34, 255)); p0.alpha_composite(blob(old_sheets[k], bg), (64, 34))
        p1 = Image.new('RGBA', (240, 180), (28, 28, 34, 255)); p1.alpha_composite(blob(new_sheets[k], bg), (64, 34))
        pairs.append(('old autotile-%s 5x5' % k, p0, 'new autotile-%s 5x5' % k, p1))
    S2 = 2; pw, phh = 240 * S2, 180 * S2
    out = Image.new('RGBA', (pw * 2 + 30, (phh + 22) * len(pairs) + 8), (28, 28, 34, 255)); d = ImageDraw.Draw(out)
    for i, (la, a, lb, b) in enumerate(pairs):
        y = 8 + i * (phh + 22)
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        out.alpha_composite(a.resize((pw, phh), Image.NEAREST), (10, y + 14))
        out.alpha_composite(b.resize((pw, phh), Image.NEAREST), (pw + 20, y + 14))
    out.convert('RGB').save(os.path.join(HERE, 'compare-ref.png'))


if __name__ == '__main__':
    old_sheets = dict(M.SHEETS)
    new_sheets = dict(M.SHEETS); new_sheets['crack'] = ww_fix_crack.crack_sheet(); new_sheets['claypan'] = ww_fix_claypan.claypan_sheet()
    im = M.s.render(new_sheets)
    old = git_img('render-1x.png')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    bg = A.ground_redearth().crop((0, 0, 16, 16))
    compare(old, im, old_sheets, new_sheets, bg)
    FX.check_autotile({k: new_sheets[k] for k in ('crack', 'ashplain', 'claypan', 'toxpool')}, A.ground_redearth(),
                      os.path.join(HERE, 'check-autotile.png'), scale=3)
    print('rendered', im.size)
