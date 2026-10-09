import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save

def disc(c, cx, cy, rx, ry, base, hl, ring):
    c.ell(cx, cy, rx + 0.6, ry + 0.6, ring)
    c.ell(cx, cy, rx, ry, base)
    c.px(int(cx) - 1, int(cy) - 1, hl); c.px(int(cx), int(cy) - 1, hl)

def lamp(c, x, y, kind, glow=False):
    key = 'kgreen:4' if kind == 'g' else 'akachin:4'
    hi = 'kgreen:5' if kind == 'g' else 'akachin:5'
    c.rect(x, y, 2, 2, key); c.px(x, y, hi)
    if glow:
        for (dx, dy) in ((-1, 0), (2, 0), (0, -1), (1, -1), (0, 2), (1, 2)):
            if c.get(x + dx, y + dy) is None: c.px(x + dx, y + dy, '%')

def flap(c, x, y, h, col, hl, dark):
    """통로 쪽으로 나온 둥근 문 날개: 세로로 선 작은 판."""
    c.rect(x, y, 2, h, col); c.v_(x, y, h, hl); c.v_(x + 1, y, h, dark)
    c.px(x, y - 1, hl); c.px(x + 1, y - 1, dark) if False else None

def unit(c, x, w, P, gate_lamps, lit=False):
    ty, th, fh = P['ty'], P['th'], P['fh']
    fy = ty + th
    b = P['body']; T, F, S = P['tones']
    c.rect(x, ty, w, th, f'{b}:{T}')                 # 윗면
    c.h_(x, ty, w, f'{b}:{T+1}')
    c.v_(x, ty, th, f'{b}:{T+1}')
    c.v_(x + w - 1, ty, th, f'{b}:{F}')
    c.rect(x, fy, w, fh, f'{b}:{F}')                   # 앞면
    c.v_(x, fy, fh, f'{b}:{F+1}')
    c.v_(x + w - 1, fy, fh, f'{b}:{S}')
    c.h_(x, fy, w, f'{b}:{T-1}')                       # 윗면-앞면 모서리 그늘
    # 앞면: 카드 투입구 + 라벨 띠
    c.h_(x + 2, fy + 3, w - 4, 'mmetal:1')
    c.h_(x + 2, fy + 4, w - 4, f'{b}:{S}')
    c.rect(x + 3, fy + 6, w - 6, 2, P['label'])
    c.h_(x + 3, fy + fh - 2, w - 6, f'{b}:{S}')
    # IC 원판 (윗면 가운데)
    disc(c, x + w / 2 - 0.5, ty + th * 0.45, P['dr'], P['dr'] * 0.75, 'kblue:3', 'kblue:5', 'kblue:1')
    # 통로 등: 통로 쪽 윗면 모서리
    ly = ty + th - 3
    if 'L' in gate_lamps: lamp(c, x + 1, ly - 2, gate_lamps['L'], lit)
    if 'R' in gate_lamps: lamp(c, x + w - 3, ly - 2, gate_lamps['R'], lit)
    # 문 날개 (앞 끝, 통로 쪽)
    if P.get('flap'):
        if 'R' in gate_lamps: flap(c, x + w, fy - 1, P['flap'], 'kblue:3', 'kblue:5', 'kblue:1')
        if 'L' in gate_lamps and gate_lamps['L'] == 'r': flap(c, x - 2, fy - 1, P['flap'], 'kblue:3', 'kblue:5', 'kblue:1')

def build(P, xs, w, shadow_rows=2, strong=False, lit=False):
    c = Cv(48, 32)
    lamps = [{'R': 'g'}, {'L': 'g', 'R': 'r'}, {'L': 'r'}]
    for x, lp in zip(xs, lamps): unit(c, x, w, P, lp, lit)
    outline(c, {'mmetal': 1, 'mwhite': 0, 'mconc': 1, 'kblue': 0, 'kgreen': 0, 'akachin': 1}, keys=('mmetal', 'mwhite', 'mconc', 'kblue', 'akachin', 'kgreen'))
    bot = P['ty'] + P['th'] + P['fh']
    for r in range(shadow_rows):
        for xx, x0 in zip([0] * 3, xs):
            for x in range(x0 + 1 + r, x0 + w + 3 + (2 if strong else 0)):
                if c.get(x, bot + 1 + r) is None: c.px(x, bot + 1 + r, '~' if r == 0 else '-')
    return c

xs = [2, 19, 36]
def A():
    P = dict(ty=8, th=9, fh=10, body='mmetal', tones=(5, 3, 2), label='kgreen:3', dr=1.7, flap=5)
    return build(P, xs, 10)
def B():
    P = dict(ty=8, th=9, fh=10, body='mmetal', tones=(6, 2, 1), label='kgreen:3', dr=1.7, flap=5)
    return build(P, xs, 10, shadow_rows=3, strong=True, lit=True)
def C():
    P = dict(ty=5, th=8, fh=14, body='mwhite', tones=(4, 2, 1), label='kblue:3', dr=3, flap=8)
    return build(P, [3, 20, 37], 9, shadow_rows=2)

N = {'A': '강남 결: 회색 금속 상자 세 대·두 통로, 윗면 밝게/앞면 한 단 어둡게/오른쪽 더 어둡게, 파란 IC 원판, 통로 쪽 초록·빨강 등, 앞 끝 파란 문 날개, 오른쪽 아래 그림자.',
     'B': '입체 강화: 윗면은 매우 밝고 앞·옆면 깊게 어둡게, IC 판·등 주변 % 불빛 번짐, 상자 아래 ~ - 그림자 3줄.',
     'C': '실루엣 재해석: 흰 도장 슬림·키 큰 개찰기(폭 9 · 높이 27), 파란 라벨 띠와 더 큰 IC 원판, 긴 문 날개.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'station_gate', L, N[L])
