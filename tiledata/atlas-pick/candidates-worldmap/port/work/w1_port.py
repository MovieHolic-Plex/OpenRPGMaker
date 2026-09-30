"""w1 port 32x32 아이콘 생성기: 모양은 도형 함수로, 화소는 글자 격자로 내보낸다. 저장소 루트에서 실행."""
import sys
sys.path.insert(0, 'scripts/content/atlas-pick')
from pxg_emit import emit

class Cv:
    def __init__(s): s.g = [[None]*32 for _ in range(32)]
    def px(s, x, y, t):
        if 0 <= x < 32 and 0 <= y < 32: s.g[y][x] = t
    def rect(s, x0, y0, x1, y1, t):
        for y in range(y0, y1+1):
            for x in range(x0, x1+1): s.px(x, y, t)
    def hline(s, x0, x1, y, t):
        for x in range(x0, x1+1): s.px(x, y, t)
    def vline(s, x, y0, y1, t):
        for y in range(y0, y1+1): s.px(x, y, t)
    def mask(s): return [[c is not None for c in r] for r in s.g]
    def outline(s, before, t):
        """before = 이 부품을 그리기 전의 마스크가 아니라, 부품 자신의 화소 집합. 바깥과 닿는 화소를 t 로."""
        pass

def snap(c): return [[v for v in r] for r in c.g]

def outline_part(c, pts, t, only_out=True):
    S = set(pts)
    for (x, y) in pts:
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in S:
                c.px(x, y, t); break

def pts_of(fn):
    c = Cv(); fn(c); return [(x, y) for y in range(32) for x in range(32) if c.g[y][x] is not None]

R = lambda r, n: (r, n)

def roof(c, x0, x1, ytop, h, ramp, hi=4, mid=3, lo=2, eave=1, outl=0, light=True):
    """맞배지붕 앞면: 위가 좁고 아래가 넓은 사다리꼴. ytop..ytop+h-1"""
    pts = []
    for i in range(h):
        y = ytop + i
        inset = max(0, (h-1-i)//2 * 1) if h > 3 else 0
        a, b = x0 + (h-1-i)//2, x1 - (h-1-i)//2
        for x in range(a, b+1):
            if i == 0: t = hi
            elif i == h-1: t = eave
            elif i <= h//3: t = mid
            else: t = lo if i > h*2//3 else mid
            if light and x - a < 2 and 0 < i < h-1: t = min(hi, t+1)
            if x > b - 1 and 0 < i < h-1: t = max(eave, t-1)
            c.px(x, y, (ramp, t)); pts.append((x, y))
    outline_part(c, pts, (ramp, outl))

def walls(c, x0, x1, y0, y1, ramp='mwhite', t=3, outl=('mbrick', 0), shade_right=True):
    pts = []
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            tt = t
            if x == x0 and y < y1: tt = t+1
            if shade_right and x >= x1-1: tt = t-1
            if y == y1: tt = t-1
            c.px(x, y, (ramp, tt)); pts.append((x, y))
    outline_part(c, pts, outl)

def door(c, x0, y0, x1, y1):
    c.rect(x0, y0, x1, y1, ('mwood', 2)); c.vline(x0, y0, y1, ('mwood', 1)); c.hline(x0, x1, y0, ('mwood', 0)); c.px(x1, y0+2, ('wgold', 3))

def window(c, x0, y0, x1, y1, ramp='wroofb'):
    c.rect(x0, y0, x1, y1, (ramp, 3)); c.hline(x0, x1, y0, (ramp, 4)); c.hline(x0, x1, y1, (ramp, 1))

def pier(c, x0, x1, y, thick=3, hi=4, base=3, low=1, pil=(2, 8, 14)):
    for x in range(x0, x1+1):
        c.px(x, y, ('mwood', hi))
        for k in range(1, thick-1): c.px(x, y+k, ('mwood', base if (x % 5) else base-1))
        c.px(x, y+thick-1, ('mwood', low))
    c.hline(x0, x1, y-1, ('mwood', 0))  # 윗선
    for px_ in pil:
        if x0 <= px_ <= x1:
            c.vline(px_, y+thick, y+thick+3, ('mwood', 1)); c.px(px_, y+thick+4, ('mwood', 0))
            c.px(px_+1, y+thick, ('mwood', 2)); c.vline(px_+1, y+thick, y+thick+2, ('mwood', 2))

def boat(c, x0, y_top, w, sail_h, big=False, two=False):
    hull_y = y_top + sail_h + 1
    mast = x0 + w//2 - 1
    # 몸통(선체): 위가 넓고 아래가 좁다
    for i in range(4):
        a, b = x0 + i, x0 + w - 1 - i
        for x in range(a, b+1):
            t = 3 if i < 2 else 2
            if x - a < 2: t += 1
            if i == 0: t = 4 if x < mast else 3
            if x > b - 2 and i > 0: t -= 1
            c.px(x, hull_y + i, ('mwood', t))
        c.px(a-1 if i == 0 else a, hull_y+i, ('mwood', 0)); c.px(b+1 if i == 0 else b, hull_y+i, ('mwood', 0))
    c.hline(x0+3, x0+w-4, hull_y+4, ('mwood', 0))
    c.hline(x0, x0+w-1, hull_y-0, ('mwood', 5) if False else ('mwood', 4))
    # 돛대
    c.vline(mast, y_top-1, hull_y-1, ('mwood', 2))
    # 큰 돛: 돛대 왼쪽 세모(위 좁고 아래 넓다)
    for i in range(sail_h):
        y = y_top + i
        wd = 1 + i*(w//2 - 1)//max(1, sail_h-1)
        for k in range(wd):
            x = mast - 1 - k
            t = 6 if k == 0 else (5 if k < 2 else 4)
            if i > sail_h-2: t = 3
            c.px(x, y, ('mwhite', min(5, t)))
        c.px(mast - wd, y, ('mwhite', 1))
    # 작은 돛(오른쪽)
    for i in range(sail_h*2//3):
        y = y_top + 2 + sail_h//3 + i - 1
        wd = 1 + i*(w//2 - 3)//max(1, sail_h*2//3-1)
        for k in range(wd):
            c.px(mast + 1 + k, y, ('mwhite', 3 if k < 1 else 2))
    if two:
        pass
    return hull_y

def shadow(c, pts):
    for x, y in pts:
        if c.g[y][x] is None: c.g[y][x] = '-'

def finish(c, title):
    pool = iter('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    leg = {}; ch = {}
    rows = []
    for r in c.g:
        s = ''
        for v in r:
            if v is None: s += '.'
            elif v in ('-', '~', '%'): s += v
            else:
                if v not in ch:
                    k = next(pool); ch[v] = k; leg[k] = v
                s += ch[v]
        rows.append(s)
    return emit(rows, leg, title=title)

def variant_A():
    c = Cv()
    # 창고(왼쪽) + 집(오른쪽)
    roof(c, 1, 15, 2, 7, 'wroofr')
    walls(c, 2, 14, 9, 15)
    door(c, 6, 11, 8, 15); window(c, 11, 11, 12, 12)
    roof(c, 17, 30, 5, 6, 'wroofr')
    walls(c, 18, 29, 11, 15)
    window(c, 20, 12, 21, 13); door(c, 25, 12, 27, 15)
    # 부두
    pier(c, 0, 19, 17, thick=3, pil=(2, 9, 16))
    # 돛배
    boat(c, 20, 18, 11, 7)
    shadow(c, [(x, 20) for x in range(1, 21)] + [(x+1, 26) for x in range(22, 31)] + [(x, 27) for x in range(24, 31)])
    return finish(c, 'port w1-A')

def variant_B():
    c = Cv()
    roof(c, 0, 16, 1, 8, 'wroofb', hi=4, mid=3, lo=2, eave=0)
    walls(c, 1, 15, 9, 15, t=3)
    door(c, 5, 11, 8, 15); window(c, 11, 11, 13, 12, 'wroofb')
    # 처마 그림자(불투명 대신 반투명)
    for x in range(2, 15): c.px(x, 10, '~')
    roof(c, 18, 31, 4, 7, 'wroofr', hi=4, mid=3, lo=2, eave=0)
    walls(c, 19, 30, 11, 15, t=3)
    for x in range(20, 30): c.px(x, 12, '~')
    window(c, 21, 13, 22, 14, 'wroofb'); door(c, 26, 12, 28, 15)
    pier(c, 0, 20, 17, thick=4, hi=5, base=3, low=1, pil=(2, 8, 15))
    boat(c, 21, 19, 10, 6)
    shadow(c, [(x, 21) for x in range(1, 22)] + [(x+1, 27) for x in range(23, 31)] + [(x, 28) for x in range(24, 31)])
    return finish(c, 'port w1-B')

def variant_C():
    c = Cv()
    # 큰 창고 하나(가운데 지붕 높음) + 크레인 + 긴 부두 + 큰 돛배
    roof(c, 0, 20, 1, 9, 'wroofr')
    walls(c, 1, 19, 10, 15)
    door(c, 4, 11, 7, 15); door(c, 12, 11, 15, 15)
    window(c, 9, 12, 10, 13, 'wroofb')
    # 크레인 기둥
    c.vline(24, 4, 15, ('mwood', 2)); c.hline(24, 30, 4, ('mwood', 2)); c.hline(24, 30, 3, ('mwood', 0))
    c.vline(30, 5, 8, ('mwood', 1)); c.rect(29, 9, 31, 10, ('mbrick', 3)); c.hline(29, 31, 10, ('mbrick', 1))
    c.hline(21, 23, 15, ('mwood', 1))
    pier(c, 0, 23, 17, thick=3, pil=(3, 10, 17, 22))
    boat(c, 16, 19, 15, 6)
    shadow(c, [(x, 20) for x in range(1, 16)] + [(x+1, 27) for x in range(19, 31)] + [(x, 28) for x in range(21, 31)])
    return finish(c, 'port w1-C')

NOTES = {
 'A': '생성 계열 결 저대비: 붉은 지붕 창고+집 둘(흰 벽·갈색 문), 나무 부두 3단, 흰 돛배 한 척, 둘레는 투명, 그림자 반투명',
 'B': '명암 강화: 푸른 지붕 창고+붉은 지붕 집(색 대비), 처마 아래 반투명 그늘, 부두 4단 두껍게 최밝음 윗면, 돛배는 오른쪽',
 'C': '실루엣 재해석: 큰 창고 하나+문 둘, 크레인, 긴 부두 기둥 4개, 배를 아래쪽 넓게 키운 큰 돛배(2x2 안에서 부두-배 비중 늘림)',
}
if __name__ == '__main__':
    d = 'tiledata/atlas-pick/candidates-worldmap/port'
    for L, f in (('A', variant_A), ('B', variant_B), ('C', variant_C)):
        open(f'{d}/w1-{L}.pxg', 'w').write(f())
        open(f'{d}/w1-{L}.note', 'w').write(NOTES[L] + '\n')
