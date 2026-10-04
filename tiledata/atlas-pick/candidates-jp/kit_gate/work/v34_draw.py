"""kit_gate v34-A (3/4 재작도) — k4-A 기반 · 윗면 판(밝은 단)+앞면 분리. 원본 후보 A 파생 — — 강남(현대 칩셋) 결: 밝은 윗면 띠 + 단단한 회색 몸통, 진한 금속 윤곽, 오른쪽 아래 한 단 어둡게."""
from k4_lib import *
S = Sheet()
def M(n): return ('mmetal', n)
def C(n): return ('mconc', n)
def W(n): return ('mwhite', n)
def GL(n): return ('mglass', n)
def DG(n): return ('mdglass', n)
def B(n): return ('kblue', n)
def GR(n): return ('kgreen', n)
def R(n): return ('akachin', n)
def PV(n): return ('mpave', n)
def GN(n): return ('mgran', n)
def OR(n): return ('korange', n)
def LQ(n): return ('lacq', n)
SH, SL = '~', '-'

# ── 바닥: 조용한 화강 타일, 줄눈 8px 주기(x=0,y=0 과 x=8,y=8 은 아니고 x=7/15,y=7/15 줄눈) ──
p = S.part('floor')
for y in range(16):
    for x in range(16):
        base = PV(5) if ((x // 8) + (y // 8)) % 2 == 0 else PV(4)
        p.px(x, y, base)
for i in range(16):
    p.px(7, i, PV(2)); p.px(15, i, PV(2)); p.px(i, 7, PV(2)); p.px(i, 15, PV(2))
    if i < 7: p.px(i, 6, PV(6)); p.px(6, i, PV(6))          # 줄눈 왼·위 밝은 변
    if 8 <= i < 15: p.px(i, 14, PV(6)); p.px(14, i, PV(6))
for (x, y) in ((2, 3), (11, 2), (4, 11), (12, 12)): p.px(x, y, PV(3))   # 손 점 얼룩(4 곳)
# 줄눈 교차 어둡게
for (x, y) in ((7, 7), (15, 15), (7, 15), (15, 7)): p.px(x, y, PV(0))


# ── 3/4: 기계 = 윗면 판(밝은 W, 뒤 끝선·앞 가장자리 하이라이트) + 앞면(M, 판 밑 그림자) ──
# 32px 기계 기준 y: 7 뒤 끝선 · 8 뒤 테두리 · 9~16 판 · 17 앞 하이라이트 · 18 립 · 19 판 밑 그림자 · 20~28 앞면 · 29 밑선 · 30~31 바닥 그림자
def plate(p, y):
    p.px(3, y, M(1)); p.px(4, y, W(3))
    for x in range(5, 11): p.px(x, y, W(2))
    p.px(11, y, W(1)); p.px(12, y, M(1))
def backedge(p, y):                       # y 에 뒤 끝선, y+1 에 뒤 테두리(둥근 모서리)
    p.row(y, 5, 10, M(1))
    p.px(4, y + 1, M(1)); p.px(11, y + 1, M(1))
    for x in range(5, 11): p.px(x, y + 1, W(1))
def shadow(p, y, a='~', b='-'):
    p.px(13, y, a); p.px(14, y, b)
def frontedge(p, y0):                     # 앞 하이라이트(y0) · 립(y0+1) · 판 밑 그림자(y0+2)
    p.px(3, y0, M(1)); p.row(y0, 4, 11, W(4)); p.px(12, y0, M(1))
    p.px(3, y0 + 1, M(1)); p.row(y0 + 1, 4, 11, M(6)); p.px(12, y0 + 1, M(1))
    p.px(3, y0 + 2, M(1)); p.px(4, y0 + 2, M(3)); p.row(y0 + 2, 5, 10, M(2)); p.px(11, y0 + 2, M(1)); p.px(12, y0 + 2, M(1))
    for k in range(3): shadow(p, y0 + k)

p = S.part('gm_t')
backedge(p, 7); shadow(p, 8)
for y in range(9, 16): plate(p, y); shadow(p, y)
p.px(12, 8, M(1))

p = S.part('gm_m')
for y in range(16): plate(p, y); shadow(p, y)
p.row(7, 5, 10, W(1))                     # 덮개 이음 한 줄

def front(p, kind):
    plate(p, 0); shadow(p, 0)
    frontedge(p, 1)
    for y in range(4, 13):
        p.px(3, y, M(1)); p.px(4, y, M(5)); p.row(y, 5, 10, M(4)); p.px(11, y, M(2)); p.px(12, y, M(1))
        shadow(p, y)
    p.row(13, 3, 12, M(0)); shadow(p, 13)
    p.row(14, 4, 13, SH); p.row(15, 5, 14, SL)
    if kind == 'in':
        p.rect(5, 5, 6, 4, DG(1)); p.row(5, 5, 10, DG(0))
        for (x, y) in ((7, 5), (8, 5), (7, 6), (8, 6), (6, 7), (7, 7), (8, 7), (9, 7), (7, 8), (8, 8)): p.px(x, y, GR(4))
        p.px(7, 8, GR(3)); p.px(8, 8, GR(3))
        p.rect(6, 10, 4, 2, B(3)); p.row(10, 6, 9, B(4)); p.px(7, 11, W(3)); p.px(8, 11, B(2))
    elif kind == 'out':
        p.rect(5, 5, 6, 6, DG(1))
        ring = ['.rrrr.', 'rr..rr', 'rwwwwr', 'rwwwwr', 'rr..rr', '.rrrr.']
        p.art(5, 5, ring, {'r': R(4), 'w': W(3)})
        p.px(6, 6, R(3)); p.px(9, 9, R(2))
        p.row(11, 6, 9, M(0))             # 표 나오는 틈
    else:
        p.rect(5, 5, 6, 6, B(1)); p.rect(6, 6, 4, 4, B(3)); p.row(6, 6, 9, B(4))
        p.rect(6, 7, 4, 2, W(3)); p.px(9, 8, W(1)); p.px(7, 8, B(2)); p.px(8, 8, B(2))
        p.px(7, 11, B(2)); p.px(8, 11, B(2))
for s_, k_ in (('gm_b_in', 'in'), ('gm_b_out', 'out'), ('gm_b_ic', 'ic')): front(S.part(s_), k_)

# ── 통로 덧칠 ──
p = S.part('lane_t')
p.px(0, 14, M(5)); p.px(1, 14, M(2)); p.px(0, 15, M(2)); p.px(15, 14, M(5)); p.px(14, 14, M(2)); p.px(15, 15, M(2))
p.row(15, 1, 2, SL)
p = S.part('lane_m')
for y in range(16): p.px(0, y, SL)
p = S.part('lane_b')
for x in range(0, 4):
    p.px(x, 6, GL(6) if x < 3 else M(6)); p.px(x, 7, GL(4)); p.px(x, 8, M(1))
for x in range(12, 16):
    p.px(x, 6, GL(6) if x > 12 else M(6)); p.px(x, 7, GL(4)); p.px(x, 8, M(1))
p.row(9, 1, 3, SL); p.row(9, 12, 14, SL)
for y in range(16): p.px(0, y, SL) if y not in (6, 7, 8) else None


# ── 끝 막음(유리+쇠): 기계와 같은 32px 기준선 — 판 y9~16 · 하이라이트 17 · 립 18 · 그림자 19 · 유리 20~28 ──
def endcap(p, left):
    backedge(p, 7)
    for y in range(8, 16): shadow(p, y)
    for y in range(9, 17): plate(p, y)
    p.px(12, 8, M(1))
    frontedge(p, 17)
    for y in range(20, 29):
        p.px(3, y, M(1)); p.px(12, y, M(1)); p.px(4, y, M(5)); p.px(11, y, M(2))
        frame = y in (20, 24, 28)
        for x in range(5, 11):
            p.px(x, y, M(4) if frame else GL(5 if x < 8 else 4))
        if not frame:
            p.px(5, y, GL(6)); p.px(10, y, GL(3))
        shadow(p, y)
    p.row(29, 3, 12, M(0)); shadow(p, 29); p.row(30, 4, 13, SH); p.row(31, 5, 14, SL)
    p.px(13 if left else 2, 22, M(3)); p.px(13 if left else 2, 26, M(3))   # 경첩
endcap(S.part('end_l'), True); endcap(S.part('end_r'), False)

# ── 낮은 칸막이(x 반복): 얇은 벽 — 윗면 5행(뒤 끝선 y7·테두리 y8·판 y9~12) + 하이라이트 13 + 립 14 + 그림자 15 + 콘크리트 16~22 + 난간 23~24 + 유리 25~28 ──
p = S.part('fence')
for x in range(16):
    p.px(x, 7, M(1)); p.px(x, 8, W(1))
    for y in range(9, 13): p.px(x, y, W(2))
    p.px(x, 13, W(4)); p.px(x, 14, M(6)); p.px(x, 15, M(2))
    for y in range(16, 23): p.px(x, y, C(4))
    p.px(x, 23, M(7)); p.px(x, 24, M(5))
    for y in range(25, 29): p.px(x, y, GL(4))
    p.px(x, 29, M(0)); p.px(x, 30, SH); p.px(x, 31, SL)
for y in range(16, 23): p.px(7, y, C(3)); p.px(8, y, C(5))
for y in range(9, 13): p.px(7, y, W(1)); p.px(8, y, W(3))
for y in range(25, 29): p.px(7, y, M(2)); p.px(8, y, GL(6))

# ── 머리 위 안내판: 판 윗면(밝은 단) + 앞면 ──
def sign(p, kind):
    l = kind == 'l'; r = kind == 'r'
    x0 = 3 if l else 0; x1 = 12 if r else 15
    for x in range(x0, x1 + 1):
        p.px(x, 3, LQ(1))
        p.px(x, 4, LQ(4)); p.px(x, 5, LQ(4))
        p.px(x, 6, LQ(6))
        for y in (7, 8, 9, 10, 11): p.px(x, y, LQ(0))
        p.px(x, 12, LQ(2)); p.px(x, 13, SL)
    for x in range(x0, x1 + 1):
        if x % 4 in (1, 2): p.px(x, 8, OR(4)); p.px(x, 10, OR(3))
        if x % 4 == 1: p.px(x, 9, OR(4))
    if l:
        for y in range(0, 3): p.px(5, y, M(3))
    if r:
        for y in range(0, 3): p.px(10, y, M(3))
for k_ in 'lmr': sign(S.part('disp_' + k_), k_)

S.save('v34-A', 'kit_gate v34-A 3/4 재작도')
