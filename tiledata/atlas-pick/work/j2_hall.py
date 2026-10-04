import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save

def roofpoly(c, x0, x1, y0, y1, inset, rp, lit, shade, tile=3, line=1):
    """사다리꼴 지붕: 위 y0 에서 inset 만큼 좁고 아래 y1 은 x0..x1 폭. 타일 줄무늬."""
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, (y1 - y0))
        l = x0 + round(inset * (1 - t) ** 1.25)
        r = x1 - round(inset * (1 - t) ** 1.25)
        tone = lit if (y - y0) % tile != tile - 1 else line
        for x in range(l, r + 1):
            k = tone
            if x - l < 2: k = min(lit + 1, rp[1])
            if r - x < 3: k = shade if (y - y0) % tile != tile - 1 else max(0, shade - 1)
            c.px(x, y, f'{rp[0]}:{k}')

def karahafu(c, x0, x1, ytop, yside, ybot, rp, lit, shade, trim, tile=3):
    """가운데 곡선 박공 지붕(가라하후): 위 곡선, 양옆 아래로 처짐."""
    w = x1 - x0
    for x in range(x0, x1 + 1):
        u = (x - x0) / w
        top = ytop + round((yside - ytop) * (1 - math.cos(math.pi * min(1.0, abs(u - 0.5) * 2))) / 2)
        for y in range(top, ybot + 1):
            tone = lit if (y - top) % tile != tile - 1 else max(0, lit - 1)
            if x - x0 < 2: tone = lit + 1
            if x1 - x < 3: tone = shade
            c.px(x, y, f'{rp[0]}:{min(tone, rp[1])}')
        c.px(x, top, f'{trim}:5')          # 용마루 띠
        c.px(x, top + 1, f'{trim}:4'); c.px(x, top + 2, f'{trim}:2')
    # 아래 처마 받침(박공널)
    for x in range(x0, x1 + 1):
        c.px(x, ybot, f'{trim}:3'); c.px(x, ybot - 1, f'{trim}:4')

def shide(c, x, y, n=3):
    for i in range(n):
        yy = y + i * 2
        xx = x + (1 if i % 2 else 0)
        c.rect(xx, yy, 3, 2, 'washi:5'); c.px(xx, yy, 'washi:3') if i % 2 else c.px(xx + 2, yy + 1, 'washi:3')

def rope(c, xa, xb, y, sag, th=3):
    for x in range(xa, xb + 1):
        u = (x - xa) / (xb - xa)
        yy = y + round(sag * (1 - (2 * u - 1) ** 2))
        for j in range(th):
            k = 'hinoki:5' if j == 0 else 'hinoki:4' if j < th - 1 else 'hinoki:2'
            if (x // 2) % 2 == 0 and j == 1: k = 'hinoki:3'
            c.px(x, yy + j, k)
    return

def pillar(c, x, y0, y1, w, base, tones):
    c.rect(x, y0, w, y1 - y0 + 1, f'{base}:{tones[1]}')
    c.v_(x, y0, y1 - y0 + 1, f'{base}:{tones[0]}'); c.v_(x + w - 1, y0, y1 - y0 + 1, f'{base}:{tones[2]}')
    c.h_(x - 1, y0, w + 2, f'{base}:{tones[0]}'); c.h_(x - 1, y0 + 1, w + 2, f'{base}:{tones[2]}')   # 두공 받침

def lattice(c, x, y, w, h, frame, glow=False, cell=3):
    c.rect(x, y, w, h, 'washi:4')
    for i in range(0, w, cell): c.v_(x + i, y, h, 'hinoki:3')
    for j in range(0, h, cell): c.h_(x, y + j, w, 'hinoki:3')
    c.h_(x, y, w, f'{frame}:2'); c.h_(x, y + h - 1, w, f'{frame}:2')
    c.v_(x, y, h, f'{frame}:3'); c.v_(x + w - 1, y, h, f'{frame}:1')
    c.v_(x + w // 2, y, h, 'hinoki:2')
    if glow:
        for i in range(1, w - 1):
            for j in range(1, h - 1):
                if (i % cell) and (j % cell): c.px(x + i, y + j, 'washi:5')

def steps(c, xa, xb, y0, n=3, th=3):
    for s in range(n):
        y = y0 + s * th
        inset = (n - 1 - s) * 2
        l, r = xa + inset, xb - inset
        c.rect(l, y, r - l + 1, th, 'ishi:3')
        c.h_(l, y, r - l + 1, 'ishi:5'); c.h_(l, y + th - 1, r - l + 1, 'ishi:1')
        c.v_(l, y, th, 'ishi:4'); c.v_(r, y, th, 'ishi:2')

def hall(P):
    c = Cv(80, 64)
    L, R = P['L'], P['R']
    rp = P['roof']          # (ramp, maxtone)
    # 처마 밑 어둠 + 벽
    c.rect(L + 2, P['eave'] + 1, R - L - 3, P['floor'] - P['eave'], f'hinoki:{P["wall"]}')
    c.rect(L + 2, P['eave'] + 1, R - L - 3, 3, 'hinoki:0')                 # 처마 그늘
    # 지붕
    roofpoly(c, L - 3, R + 3, P['rt'], P['eave'], P['inset'], rp, P['lit'], P['shade'])
    # 처마 끝 띠
    c.h_(L - 3, P['eave'] + 1, R - L + 7, 'sumi:1'); c.h_(L - 3, P['eave'], R - L + 7, 'sumi:3')
    c.h_(L - 2, P['eave'] + 2, R - L + 5, 'sumi:0')
    if P.get('kara'):
        k = P['kara']; karahafu(c, k[0], k[1], k[2], k[3], k[4], rp, P['lit'], P['shade'], 'sumi')
    # 기둥
    for px_ in P['pillars']:
        pillar(c, px_, P['eave'] + 3, P['floor'], P['pw'], P['pbase'], P['ptone'])
    # 흰 벽 + 난간
    for (xa, xb) in P['walls']:
        c.rect(xa, P['eave'] + 4, xb - xa + 1, P['floor'] - P['eave'] - 3, f'washi:{P["wtone"]}')
        c.h_(xa, P['eave'] + 4, xb - xa + 1, f'washi:{P["wtone"]-2}')
        c.h_(xa, P['rail'], xb - xa + 1, 'shu:3'); c.h_(xa, P['rail'] + 1, xb - xa + 1, 'shu:2')
        c.h_(xa, P['rail'] - 1, xb - xa + 1, 'shu:5')
        for x in range(xa, xb + 1, 3): c.v_(x, P['rail'] + 2, P['floor'] - P['rail'] - 2, 'shu:3')
    # 격자문
    lx0, lx1 = P['door']
    lattice(c, lx0, P['dy'], lx1 - lx0 + 1, P['floor'] - P['dy'], 'hinoki', P.get('glow', False))
    # 마루 / 기단
    c.rect(L, P['floor'] + 1, R - L + 1, 2, 'hinoki:4'); c.h_(L, P['floor'] + 1, R - L + 1, 'hinoki:5'); c.h_(L, P['floor'] + 2, R - L + 1, 'hinoki:2')
    by = P['floor'] + 3
    c.rect(L - 2, by, R - L + 5, P['base'], 'mgran:3'); c.h_(L - 2, by, R - L + 5, 'mgran:5'); c.h_(L - 2, by + P['base'] - 1, R - L + 5, 'mgran:1')
    c.v_(L - 2, by, P['base'], 'mgran:4'); c.v_(R + 2, by, P['base'], 'mgran:2')
    for x in range(L + 2, R, 8): c.v_(x, by + 1, P['base'] - 2, 'mgran:2')
    steps(c, P['sx'][0], P['sx'][1], by + 1, 3, P['base'] // 3 if P['base'] >= 9 else 3)
    # 시메나와 + 시데
    xa, xb = P['rope']
    rope(c, xa, xb, P['ry'], P['sag'])
    for sx in P['shide']: shide(c, sx, P['ry'] + 4, 3)
    # 굵은 매듭 끝
    for sx in (xa, xb): c.rect(sx - 1, P['ry'], 3, 4, 'hinoki:5'); c.px(sx - 1, P['ry'], 'hinoki:6')
    return c, by + P['base']

def finish(c, ybot, P, strong=False):
    outline(c, {'kasa': 0, 'kawara': 0, 'hinoki': 0, 'shu': 0, 'washi': 1, 'mgran': 0, 'ishi': 0}, keys=('kasa', 'kawara', 'shu', 'mgran'))
    rows = 3 if strong else 2
    for r in range(rows):
        for x in range(P['L'] - 1 + r, P['R'] + 6 + (2 if strong else 0)):
            if c.get(x, ybot + r) is None and ybot + r < 64: c.px(x, ybot + r, '~' if r == 0 else '-')
    return c

def A():
    P = dict(L=6, R=73, rt=7, eave=25, inset=16, roof=('kasa', 4), lit=3, shade=2, wall=1,
             floor=46, pillars=(9, 32, 47, 68), pw=3, pbase='shu', ptone=(4, 3, 1), walls=[(13, 31), (50, 65)], wtone=4,
             rail=40, door=(35, 46), dy=31, base=12, sx=(26, 53), rope=(12, 67), ry=29, sag=2, shide=(20, 34, 45, 59),
             kara=(22, 57, 7, 15, 25))
    c, yb = hall(P); return finish(c, yb, P)
def B():
    P = dict(L=6, R=73, rt=7, eave=25, inset=16, roof=('kawara', 5), lit=3, shade=1, wall=0,
             floor=46, pillars=(9, 32, 47, 68), pw=3, pbase='hinoki', ptone=(5, 3, 1), walls=[(13, 31), (50, 65)], wtone=3,
             rail=40, door=(35, 46), dy=31, base=12, sx=(26, 53), rope=(12, 67), ry=29, sag=2, shide=(20, 34, 45, 59),
             kara=(22, 57, 7, 15, 25), glow=True)
    c, yb = hall(P)
    # 문 불빛 번짐
    for y in range(34, 45):
        for x in (35, 36, 44, 45):
            pass
    return finish(c, yb, P, strong=True)
def C():
    P = dict(L=12, R=67, rt=8, eave=26, inset=22, roof=('kasa', 4), lit=3, shade=1, wall=1,
             floor=46, pillars=(15, 35, 50, 61), pw=4, pbase='hinoki', ptone=(5, 4, 2), walls=[(20, 34), (52, 60)], wtone=4,
             rail=40, door=(39, 49), dy=31, base=12, sx=(28, 51), rope=(18, 61), ry=30, sag=3, shide=(26, 36, 47, 55),
             kara=(26, 53, 3, 14, 26))
    c, yb = hall(P); return finish(c, yb, P)

N = {'A': '강남 결: 녹청 동판 지붕에 타일 줄, 가운데 가라하후 곡선 박공, 주홍 기둥·난간, 처마 밑 시메나와와 흰 시데, 흰 격자문, 회색 돌 계단 세 단.',
     'B': '입체 강화: 짙은 기와 지붕·처마 아래 깊은 그늘, 격자문 안쪽이 밝게 보이는 불빛, 기단 그림자 3줄, 왼쪽은 밝고 오른쪽은 어둡게.',
     'C': '실루엣 재해석: 폭을 좁히고 지붕을 가파르게 세운 소형 배전, 굵은 히노키 기둥 셋과 시메나와가 크게 처지는 모습.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'shrine_hall', L, N[L])
