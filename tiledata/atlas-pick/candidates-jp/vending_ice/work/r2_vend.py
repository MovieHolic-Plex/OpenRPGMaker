"""r2 자판기 2종(아이스크림·가챠) 2×2(32×32) 작도. r1 (vending_drink/work/r1_vend.py) 의 식구 치수를 그대로 따른다.
 윗면 판 y=1..3 · 앞면 x=3..24 · 오른 옆면 x=25..28(4px) · 간판 띠 y=4..6 · 견본 창 x=4..17,y=7..17 · 조작열 x=19..23
 배출구 y=20..25 · 발판 y=27..28 · 그림자 y=29..30(B 는 29..31) · C 는 머리 상자 x=1..30,y=0..7.
색은 (램프, 단)을 손으로 놓는다 — 계산·보간 없음."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import Grid, C, sh

def spec(kind, d):
    if kind == 'ice':
        s = dict(body='mwhite', F=3, T=5, S=2, O=('mwhite', 0), OD=('mmetal', 2), hdr=('kblue', 4), glass=('kblue', 4), panel=('kblue', 2))
        if d == 'B': s.update(F=3, T=5, S=1, glass=('kblue', 5), OD=('mmetal', 1))
    else:
        s = dict(body='mwhite', F=2, T=4, S=1, O=('mwhite', 0), OD=('mmetal', 2), hdr=('mred', 3), glass=('mglass', 5), panel=('mmetal', 4))
        if d == 'B': s.update(F=3, T=5, S=0, glass=('mglass', 6), OD=('mmetal', 1))
    s['d'] = d; s['kind'] = kind
    return s

def frame(s):
    d = s['d']; g = Grid(32, 32)
    body = s['body']; F = C(body, s['F']); T = C(body, s['T']); S = C(body, s['S'])
    O, OD = s['O'], s['OD']
    hx0, hx1 = (1, 30) if d == 'C' else (2, 29)
    hy_sign = 4; hh = 4 if d == 'C' else 3
    g.hl(hx0 + 1, 0, hx1 - hx0 - 1, O)
    fx0 = hx0 + 1; fx1 = 24 if d != 'C' else 25
    sx0 = fx1 + 1; sx1 = 28 if d != 'C' else 29
    g.hl(fx0, 1, sx1 - fx0 + 1, sh(T, 1)); g.hl(fx0, 2, sx1 - fx0 + 1, T); g.hl(fx0, 3, sx1 - fx0 + 1, T)
    g.px(sx1, 1, T); g.px(sx1, 2, sh(T, -1)); g.px(sx1, 3, sh(T, -1))
    g.vl(hx0, 1, hh + 3, O); g.vl(hx1, 1, hh + 3, OD)
    H = s['hdr']
    for r in range(hh):
        tone = [1, 0, -1, -2][r] if hh == 4 else [1, 0, -1][r]
        g.hl(fx0, hy_sign + r, fx1 - fx0 + 1, sh(H, tone))
        g.hl(sx0, hy_sign + r, sx1 - sx0 + 1, sh(H, -2 - (1 if r == hh - 1 else 0)))
    by0 = hy_sign + hh
    if d == 'C':
        g.hl(3, by0, 22, sh(F, -2)); g.hl(26, by0, 3, sh(S, -2)); by0 += 1
    g.rect(3, by0, 22, 26 - by0 + 1, F); g.rect(25, by0, 4, 26 - by0 + 1, S)
    if d == 'C': g.hl(26, by0 - 1, 3, sh(S, -2))
    g.vl(3, by0, 26 - by0 + 1, sh(F, 1)); g.vl(24, by0, 26 - by0 + 1, sh(F, -1))
    g.vl(25, by0, 26 - by0 + 1, sh(S, 1)); g.vl(28, by0, 26 - by0 + 1, sh(S, -1))
    g.vl(2, by0, 26 - by0 + 1, O); g.vl(29, by0, 26 - by0 + 1, OD)
    g.hl(3, 26, 22, sh(F, -1)); g.hl(25, 26, 4, sh(S, -1))
    g.hl(3, 27, 22, ('mmetal', 3)); g.hl(25, 27, 4, ('mmetal', 2)); g.px(2, 27, O); g.px(29, 27, OD)
    g.hl(3, 28, 22, ('mmetal', 1)); g.hl(25, 28, 4, ('mmetal', 0)); g.px(2, 28, sh(O, -1) if d != 'C' else O); g.px(29, 28, OD)
    wy = by0 if d == 'C' else 7
    return g, F, S, by0, wy, fx0, fx1, sx0, sx1, hy_sign, hh

def window_frame(g, wy, fr):
    gh = 9
    g.rect(4, wy, 14, gh + 2, fr)
    g.hl(4, wy, 14, sh(fr, 2)); g.hl(4, wy + gh + 1, 14, sh(fr, -1)); g.vl(17, wy, gh + 2, sh(fr, -1))
    return wy + 1, gh

def outlet(g, fr, tone_flap=None):
    dy = 20
    g.hl(4, dy, 14, sh(fr, 2))
    g.rect(5, dy + 1, 12, 5, ('lacq', 0))
    g.hl(5, dy + 1, 12, ('lacq', 3)); g.hl(5, dy + 2, 12, ('lacq', 2))
    g.vl(4, dy + 1, 5, sh(fr, 1)); g.vl(17, dy + 1, 5, sh(fr, -2))

def shadow(g, d, glow):
    if d == 'B':
        if glow:
            g.hl(4, 29, 10, '%'); g.hl(6, 30, 6, '%')
            g.hl(14, 29, 18, '~'); g.hl(12, 30, 20, '~'); g.hl(18, 31, 14, '-')
        else:
            g.hl(3, 29, 29, '~'); g.hl(5, 30, 27, '~'); g.hl(8, 31, 24, '-')
    else:
        g.hl(4, 29, 28, '~'); g.hl(6, 30, 26, '-')

def buttons(g, cy, colors):
    for i in range(4):
        bx = 20 + (i % 2) * 2; by = cy + 4 + (i // 2) * 3
        c = colors[i]
        g.rect(bx, by, 2, 2, c); g.px(bx, by, sh(c, 1)); g.hl(bx, by + 1, 2, sh(c, -1))

def display(g, cy, disp):
    g.rect(20, cy + 1, 3, 2, ('lacq', 1)); g.hl(20, cy + 1, 3, disp); g.px(22, cy + 2, sh(disp, -2))

def slots(g, cy):
    g.hl(20, cy + 10, 4, ('mmetal', 6)); g.hl(20, cy + 11, 4, ('mmetal', 3)); g.hl(21, cy + 11, 2, ('lacq', 0))
    g.hl(20, cy + 13, 4, ('mmetal', 5)); g.hl(20, cy + 14, 4, ('lacq', 0))

def panel(g, cy, P):
    g.rect(19, cy, 5, 26 - cy, C(*P)); g.vl(19, cy, 26 - cy, sh(C(*P), -1))

# ───────── 아이스크림 ─────────
CONES = [('sakura', 4), ('washi', 4), ('taxi', 4), ('kgreen', 4), ('akachin', 4), ('kblue', 5)]
def ice(d):
    s = spec('ice', d)
    g, F, S, by0, wy, fx0, fx1, sx0, sx1, hy, hh = frame(s)
    # 간판: 얼음 결정 점 세 개 + 아이스크림 콘 두 개(글자 없음)
    yy = hy + 1
    g.hl(fx0 + 3, yy, 4, ('washi', 5)); g.hl(fx0 + 8, yy, 2, ('sakura', 4)); g.hl(fx0 + 11, yy, 2, ('taxi', 4)); g.hl(fx0 + 14, yy, 4, ('washi', 5))
    fr = ('mmetal', 3)
    gy0, gh = window_frame(g, wy, fr)
    glass = s['glass']
    g.rect(5, gy0, 12, gh, glass)
    g.hl(5, gy0, 12, sh(glass, 1))              # 위 서리 한 줄
    for i, x in enumerate([5, 8, 12, 15]): g.px(x, gy0, ('mwhite', 4))   # 성에 점
    # 아이스크림 그림 2줄×3: 덩이 2×2 + 콘 1줄
    order = [0, 1, 2, 3, 4, 5] if d != 'C' else [1, 0, 2, 4, 3, 5]
    for r in range(2):
        y = gy0 + 1 + r * 4
        for k, x in enumerate([6, 10, 14]):
            c = CONES[order[r * 3 + k]]
            g.rect(x, y, 2, 2, c); g.px(x, y, sh(c, 1)); g.hl(x, y + 1, 2, sh(c, -1))
            g.px(x, y + 2, ('hinoki', 4)); g.px(x + 1, y + 2, ('hinoki', 2))
        if r == 0: g.hl(5, y + 3, 12, sh(fr, 1))   # 선반
    cy = wy
    panel(g, cy, s['panel'])
    display(g, cy, ('neonc', 4))
    buttons(g, cy, [CONES[0], CONES[2], CONES[3], CONES[5]])
    slots(g, cy)
    outlet(g, fr)
    g.rect(20, 23, 4, 3, ('lacq', 0)); g.hl(20, 23, 4, ('mmetal', 5)); g.hl(20, 24, 4, ('lacq', 2))
    if d == 'B':
        # 서리 낀 차가운 빛: 유리 아래 얇은 밝은 번짐
        g.hl(5, gy0 + gh - 1, 12, sh(glass, 1))
    shadow(g, d, glow=(d == 'B'))
    return g

# ───────── 가챠 ─────────
CAPS = [('taxi', 4), ('sakura', 4), ('kblue', 4), ('kgreen', 4), ('akachin', 4), ('korange', 4)]
def capsule(g, x, y, c, big=False):
    if big:
        g.rect(x, y, 3, 3, c); g.px(x, y, sh(c, 1)); g.px(x + 1, y, sh(c, 1)); g.hl(x, y + 2, 3, ('washi', 4)); g.px(x + 2, y + 2, ('washi', 3))
        g.px(x + 2, y, sh(c, -1)); g.px(x + 2, y + 1, sh(c, -1)); g.px(x, y + 1, sh(c, 0))
    else:
        g.hl(x, y, 2, c); g.px(x, y, sh(c, 1)); g.px(x + 1, y, sh(c, -1))
        g.hl(x, y + 1, 2, ('washi', 4)); g.px(x + 1, y + 1, ('washi', 3))

def gacha(d):
    s = spec('gacha', d)
    g, F, S, by0, wy, fx0, fx1, sx0, sx1, hy, hh = frame(s)
    yy = hy + 1
    g.hl(fx0 + 3, yy, 3, ('washi', 4)); g.hl(fx0 + 7, yy, 3, ('taxi', 4)); g.hl(fx0 + 11, yy, 3, ('washi', 4)); g.hl(fx0 + 15, yy, 3, ('taxi', 4))
    fr = ('mmetal', 3)
    gy0, gh = window_frame(g, wy, fr)
    glass = s['glass']
    g.rect(5, gy0, 12, gh, glass)
    # 둥근 창: 네 모서리 두 칸씩 틀 색으로 깎는다
    for (cx, cy_) in [(5, gy0), (16, gy0), (5, gy0 + gh - 1), (16, gy0 + gh - 1)]:
        g.px(cx, cy_, sh(fr, 0))
    g.px(6, gy0, sh(fr, 0)); g.px(15, gy0, sh(fr, 0))
    g.px(6, gy0 + gh - 1, sh(fr, -1)); g.px(15, gy0 + gh - 1, sh(fr, -1))
    g.hl(7, gy0 + 1, 3, sh(glass, 2))            # 유리 하이라이트
    if d != 'C':
        for r in range(3):
            y = gy0 + 1 + r * 3
            for k in range(4):
                x = (6 if r % 2 == 0 else 5) + k * 3
                if r == 0 and k == 3 and False: continue
                capsule(g, x, y, CAPS[(k * 2 + r * 3 + (k // 2)) % 6])
    else:
        for r in range(2):
            y = gy0 + 1 + r * 4
            for k in range(3):
                capsule(g, 6 + k * 4, y, CAPS[(k + r * 3) % 6], big=True)
            if r == 0: g.hl(5, y + 3, 12, sh(fr, 1))
    cy = wy
    panel(g, cy, s['panel'])
    # 다이얼: 5×5 은색 원(옆 한 칸이 손잡이), 아래 동전 구멍
    D = [(1, 0, 3), (2, 0, 4), (3, 0, 3), (0, 1, 3), (1, 1, 5), (2, 1, 6), (3, 1, 5), (4, 1, 2), (0, 2, 4), (1, 2, 6), (2, 2, 2), (3, 2, 6), (4, 2, 3),
         (0, 3, 3), (1, 3, 5), (2, 3, 6), (3, 3, 5), (4, 3, 2), (1, 4, 2), (2, 4, 1), (3, 4, 2)]
    for dx, dy_, t in D: g.px(19 + dx, cy + 2 + dy_, ('mmetal', t))
    g.hl(20, cy + 4, 3, ('lacq', 1)) if False else None
    g.px(21, cy + 4, ('lacq', 1))
    g.hl(20, cy + 8, 4, ('taxi', 4)); g.hl(20, cy + 9, 4, ('taxi', 2))     # 동전 100엔 표시 띠
    g.hl(20, cy + 11, 4, ('mmetal', 6)); g.hl(20, cy + 12, 4, ('mmetal', 3)); g.hl(21, cy + 12, 2, ('lacq', 0))
    # 캡슐 배출구(둥근 뚜껑)
    fr2 = fr
    dy = 20
    g.hl(4, dy, 14, sh(fr, 2))
    g.rect(5, dy + 1, 12, 5, ('lacq', 0))
    g.hl(5, dy + 1, 12, ('lacq', 3)); g.hl(5, dy + 2, 12, ('lacq', 2))
    g.vl(4, dy + 1, 5, sh(fr, 1)); g.vl(17, dy + 1, 5, sh(fr, -2))
    capsule(g, 10, dy + 4, CAPS[2]) if d == 'B' else None
    g.rect(20, 23, 4, 3, ('lacq', 0)); g.hl(20, 23, 4, ('mmetal', 5)); g.hl(20, 24, 4, ('lacq', 2))
    shadow(g, d, glow=(d == 'B'))
    return g

NOTES = {
 ('ice', 'A'): '강남 자판기 결: 흰 몸통 앞면 3단·윗면 판 3px 5단·오른 옆면 4px 한 단 어둡게. 파란 간판 띠에 색 점, 하늘색 서리 유리 안에 아이스크림 2줄×3(덩이 2×2+콘), 오른 조작열(맛 버튼 4·동전·지폐), 아래 배출구, 발치 그림자 2줄',
 ('ice', 'B'): '명암 강화: 앞면 3단·윗면 5단·옆면 1단, 유리 한 단 밝게+아랫줄 서리 번짐, 왼쪽 바닥에 차가운 불빛 %와 오른쪽 접지 그림자 3줄',
 ('ice', 'C'): '실루엣 재해석: 파란 머리 간판 상자가 몸통보다 좌우 1px 튀어나오고(x=1..30) 창은 그 아래, 맛 순서를 바꾼 아이스크림 3열',
 ('gacha', 'A'): '강남 자판기 결: 흰 몸통 앞면 2단·붉은 간판 띠(노랑·흰 점), 둥근 유리 창 안에 2×2 캡슐(윗 색·아랫 흰) 5열 4단, 오른 조작열에 은색 다이얼·동전 띠·구멍, 아래 배출구',
 ('gacha', 'B'): '명암 강화: 앞면 3단·윗면 5단·옆면 0단, 유리 한 단 밝게, 왼쪽 바닥에 유리 빛 %와 접지 그림자 3줄, 배출구 안에 캡슐 하나',
 ('gacha', 'C'): '실루엣 재해석: 붉은 머리 간판 상자가 좌우 1px 튀어나오고 창 안엔 3×3 큰 캡슐 2단×3, 은색 다이얼',
}
FAM = {
 'A': ' || 식구 공통(r1 치수 그대로): 32×32, 윗면 판 3px(y=1..3)·앞면 x=3..24·오른 옆면 4px(x=25..28)·간판 띠 3줄(y=4..6)·견본 창 x=4..17·조작열 x=19..23·배출구 y=20..25·발판 2줄·접지 그림자 2줄',
 'B': ' || 식구 공통(r1 치수 그대로): A 와 같은 치수, 그림자만 3줄(y=29..31)+왼쪽 불빛 번짐 %; 톤은 윗면 5단',
 'C': ' || 식구 공통(r1 치수 그대로): 머리 간판 상자 x=1..30·y=0..7(4줄), 몸통 y=9..26, 옆면 4px, 나머지 A 와 같음',
}
if __name__ == '__main__':
    for kind, slug, fn in [('ice', 'vending_ice', ice), ('gacha', 'vending_gacha', gacha)]:
        for d in 'ABC':
            p = os.path.abspath(os.path.join(HERE, '..', '..', slug, f'r2-{d}.pxg'))
            fn(d).emit(p, NOTES[(kind, d)] + FAM[d], header=f'{slug} r2-{d}')
