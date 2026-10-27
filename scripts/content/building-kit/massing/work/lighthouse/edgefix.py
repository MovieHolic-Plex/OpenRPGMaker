"""바깥 윤곽의 먹색(거의 검정) 화소를 그 재질의 어두운 단으로 바꾼다(감독 메모: 윤곽은 재질의 어두운 단).
윤곽 = 투명('.')이나 캔버스 끝에 4방으로 닿는 화소. 밝기 < THRESH 인 것만, 재질(램프)별 어두운 단으로."""
import json
import os

_PAL = None


def _lum(h):
    h = h.lstrip('#')
    r, g, b = int(h[:2], 16), int(h[2:4], 16), int(h[4:], 16)
    return 0.299 * r + 0.587 * g + 0.114 * b


def _pal():
    global _PAL
    if _PAL is None:
        here = os.path.dirname(os.path.abspath(__file__))
        p = os.path.join(here, '..', '..', '..', '..', '..', '..', 'harness-data', 'building-kit', 'massing', 'palette.json')
        _PAL = json.load(open(p))['legend']
    return _PAL


GREY = set('TUVWXYZabcdefghijklmnopqrs')
RED = set('789%&+=?<')
PURP = set('6!@#$*')
WOOD = set('/|:;,_-αβγδεζηθικλμνξπρσ')
PLAS = set('tuvwxyz012345J')
BLUE = set('ABCDEFGHI')
GREEN = set('MNOPQRS')
GOLD = set('KLτ')
DARK = [(GREY, 'X'), (RED, '&'), (PURP, '*'), (WOOD, 'δ'), (PLAS, 'J'), (BLUE, 'F'), (GREEN, 'M'), (GOLD, 'τ')]
THRESH = 66


def material_edges(c, thresh=THRESH, dark=None, skip=None):
    pal = _pal()
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch == '.' or _lum(pal[ch]) >= thresh:
                continue
            if skip and skip(x, y):
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < c.w and 0 <= ny < c.h) or c.get(nx, ny) == '.':
                    edge = True
                    break
            if not edge:
                continue
            rep = None
            for s, d in (dark or DARK):
                if ch in s:
                    rep = d
                    break
            if rep:
                pts.append((x, y, rep))
    for x, y, ch in pts:
        c.put(x, y, ch)
    return len(pts)
