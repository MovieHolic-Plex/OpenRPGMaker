"""tithe-barn — 십일조 헛간(덩어리 모형 M02). 12×6 칸(192×96). 다시 돌리면 같은 그림. 난수·잡음 없음.
M02 그대로: 한 장으로 이어진 큰 초가(이엉) 모임지붕(가운데 단·턱 없음, 양 끝 모임 사선, 둥근 처마) +
낮은 버들항 잔돌 벽(부벽 넷) + 가운데 수레 포치(남북 박공 작은 초가 지붕이 골로 큰 지붕에 붙는다, ㉚ h124_0 규약) — 문은 포치의 수레 널문 하나.
이엉 결: 가는 짚 가닥(세로) + 묶음 줄(줄 높이·어긋남·가닥 밝기는 길이가 서로소인 손 표) — 16px 도장 반복 없음."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas  # noqa: E402

W, H = 192, 96
c = Canvas(12, 6)

# ---------------------------------------------------------------- 이엉 색(짚: 금빛 → 갈색). 어두운 → 밝은
# 면마다 (그늘 틈, 어두운 가닥, 가운데, 밝은 가닥, 끝 반짝)
FACE = {
    'front': ('η', 'μ', 'ξ', 'σ', 'L'),
    'lit':   ('η', 'μ', 'ξ', 'σ', 'L'),
    'dark':  ('α', 'δ', 'ε', 'η', 'μ'),
    'plit':  ('η', 'μ', 'ξ', 'σ', 'L'),
    'pdark': ('-', 'δ', 'ε', 'ζ', 'η'),
}
COURSE_H = [6, 5, 7, 6, 5, 6, 7, 5, 6, 6, 5, 7]                 # 묶음 줄 높이(손 순서)
COURSE_OFF = [0, 3, 1, 4, 2, 5, 1, 3, 0, 4, 2, 5, 3]            # 줄마다 가닥 어긋남
STRAND = ('2132312023213302132120312231'                         # 가닥 밝기 0..3(길이 37 — 16 과 서로소)
          '021320132')
TIPS = ('1101101110110111011010111011011101101'                  # 줄 끝 가닥이 아래로 처지는가(길이 41)
        '1011')
WORN = ('0000100000000200000010000000000300000000010000002000000'  # 1 밝은 새 짚 · 2 묵어 어두움 · 3 이끼(길이 59)
        '0000')


BUNDLE_W = [6, 5, 7, 6, 4, 7, 5, 6, 8, 5, 6, 7, 5]               # 이엉 묶음 너비(손 순서, 길이 13)
UP = {}


def thatch(inside, x0, x1, y0, y1, face, seed=0, slant=0.0, fade=None):
    """inside(x,y) 화소에 이엉: 줄(course)마다 묶음(bundle)이 늘어서고, 묶음 끝은 아래가 둥글게 처진다(가장자리 1px 짧음).
    묶음 속은 세로 짚 가닥(밝기는 손 표). slant: 가닥 기울기. fade(y): +1 이면 한 단 밝게, -1 이면 한 단 어둡게."""
    gap, dk, mid, lt, tip = FACE[face]
    ladder = [gap, dk, mid, lt, tip]
    k = seed
    cy = y0
    while cy <= y1:
        ch_h = COURSE_H[k % len(COURSE_H)]
        off = COURSE_OFF[k % len(COURSE_OFF)] * 2 + k
        for r in range(ch_h):
            y = cy + r
            if y > y1:
                break
            for x in range(x0, x1 + 1):
                if not inside(x, y):
                    continue
                xs = int(round(x + off + slant * (y - y0)))
                # 묶음 찾기
                q = xs % 79
                bi = 0
                acc = 0
                while acc + BUNDLE_W[(bi + k) % len(BUNDLE_W)] <= q:
                    acc += BUNDLE_W[(bi + k) % len(BUNDLE_W)]
                    bi += 1
                bw = BUNDLE_W[(bi + k) % len(BUNDLE_W)]
                u = q - acc
                edge = u == 0 or u == bw - 1
                s = int(STRAND[(xs * 3 + k * 7) % len(STRAND)])
                t = (1, 2, 3, 2)[s]                         # 가닥: 어두운/가운데/밝은
                if edge:
                    t -= 1                                  # 묶음 사이 결
                if r == 0:
                    t -= 1                                  # 윗 줄 끝 밑 그늘
                if r == ch_h - 2 and s != 2:
                    t += 1 if not edge else 0               # 묶음 끝 밝은 짚
                if r == ch_h - 1:
                    t = 0 if edge else (2 if TIPS[(xs + k * 5) % len(TIPS)] == '1' else 1)
                w = WORN[(bi * 7 + k * 11 + seed) % len(WORN)]
                if w == '1' and r < ch_h - 1:
                    t += 1
                elif w == '2' and r < ch_h - 1:
                    t -= 1
                if fade:
                    t += fade(y)
                col = ladder[max(0, min(4, t))]
                if w == '3' and 1 <= r < ch_h - 1 and 1 <= u < bw - 1:
                    col = 'N' if (x + r) % 3 else 'M'
                c.put(x, y, col)
        cy += ch_h
        k += 1


# ---------------------------------------------------------------- 1) 큰 초가 모임지붕
R_Y, E_Y = 5, 57                     # 용마루 · 처마 마지막 줄
RL, RR = 40, 151                     # 용마루 양 끝
X0, X1 = 0, 191
KNEE = R_Y + 34                      # 바깥 윤곽: 용마루 끝 → knee 까지 사선(둥글게), 그 아래 처마까지 세로


def lx(y):                           # 왼 모임 마루
    return RL - (y - R_Y) * (RL - 6) / (E_Y - R_Y)


def rx(y):
    return RR + (y - R_Y) * (X1 - 6 - RR) / (E_Y - R_Y)


def out_l(y):
    t = min(1.0, (y - R_Y) / (KNEE - R_Y))
    t = 1 - (1 - t) ** 1.6                # 위는 가파르게, knee 근처에서 둥글게 눕는다
    return X0 + (RL - 3 - X0) * (1 - t)


def out_r(y):
    t = min(1.0, (y - R_Y) / (KNEE - R_Y))
    t = 1 - (1 - t) ** 1.6
    return X1 - (X1 - RR - 3) * (1 - t)


thatch(lambda x, y: lx(y) < x < rx(y), X0, X1, R_Y + 3, E_Y, 'front', seed=0,
       fade=lambda y: 1 if y < R_Y + 16 and (y * 7) % 5 < 2 else (-1 if y > E_Y - 10 and (y * 5) % 7 < 2 else 0))
thatch(lambda x, y: out_l(y) - 0.5 <= x <= lx(y), X0, X1, R_Y + 1, E_Y, 'lit', seed=3, slant=0.6)
thatch(lambda x, y: rx(y) <= x <= out_r(y) + 0.5, X0, X1, R_Y + 1, E_Y, 'dark', seed=7, slant=-0.6)
# 모임 마루: 둥근 짚 마루(왼 빛 받는 밝은 선 · 오른 그늘 선) — 2px
for y in range(R_Y + 2, E_Y - 1):
    x = int(round(lx(y)))
    c.put(x - 1, y, 'σ' if y % 4 else 'L')
    c.put(x, y, 'ξ')
    c.put(x + 1, y, 'μ' if y % 3 else 'η')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, 'η')
    c.put(xr, y, 'ε')
    c.put(xr + 1, y, 'δ' if y % 3 else 'α')
# 용마루 덮개(짚 마루 + 엇갈린 꺾쇠 띠 — 이엉지붕의 마루 장식)
RIDGE_A = 'μξμμξξμξσμξμμξμξξμσμξμμξξ'          # 마루 짚 윗줄(손, 길이 25)
RIDGE_B = 'ξσσξξσξσσξξσξξσσξσLξσξξσσξ'          # 마루 짚 둘째 줄(손, 길이 26)
RIDGE_T = 'δδεδδδαδδεδδδδαδεδδδ'                # 마루 윗 테(손, 길이 20)
for x in range(RL - 3, RR + 4):
    i = x - RL + 3
    c.put(x, R_Y, RIDGE_T[i % len(RIDGE_T)])
    c.put(x, R_Y + 1, RIDGE_A[i % len(RIDGE_A)])
    c.put(x, R_Y + 2, RIDGE_B[(i * 3) % len(RIDGE_B)])
    c.put(x, R_Y + 3, 'η' if (i * 5) % 11 else 'ζ')
    c.put(x, R_Y + 4, 'ε' if (i * 7) % 13 > 3 else 'δ')
PEG_GAP = [7, 6, 8, 7, 5, 9, 6, 8, 7, 6, 9, 5, 8]  # 꺾쇠 간격(손 순서)
PEG_W = [3, 3, 4, 3, 2, 3, 4, 3, 3, 2, 4]         # 꺾쇠 엇갈림 폭(손 순서)
x = RL
kp = 0
while x + 6 < RR:
    pw = PEG_W[kp % len(PEG_W)]
    for d in range(4):
        dy = d if d < 2 else 3 - d
        c.put(x + d, R_Y + 1 + dy, 'ε' if (kp + d) % 3 else 'δ')
        c.put(x + d + pw, R_Y + 1 + dy, 'ζ')
    x += PEG_GAP[kp % len(PEG_GAP)]
    kp += 1
# 처마: 두툼한 둥근 이엉 끝(밝은 짚 끝 → 아래 그늘) — 처진 끝은 손 표로
for x in range(X0, X1 + 1):
    t = TIPS[(x * 3) % len(TIPS)]
    lit_side = x < 60
    dark_side = x > 150
    a, b = ('σ', 'ξ') if lit_side else (('η', 'ε') if dark_side else ('ξ', 'μ'))
    c.put(x, E_Y - 1, a if x % 3 else b)
    c.put(x, E_Y, b)
    c.put(x, E_Y + 1, ('ε' if dark_side else 'η') if t == '1' else 'δ')
    c.put(x, E_Y + 2, 'δ' if t == '1' and x % 2 else '-')
# 처마 양 끝 둥글게(모서리 화소 깎기)
for (x, y) in [(0, E_Y + 2), (1, E_Y + 2), (0, E_Y + 1), (191, E_Y + 2), (190, E_Y + 2), (191, E_Y + 1)]:
    c.put(x, y, '.')

# ---------------------------------------------------------------- 2) 낮은 벽(버들항 잔돌: 따뜻한 회갈 돌 + 짙은 보라 줄눈)
WX0, WX1 = 3, 188
WY0, GY = E_Y + 3, 93                 # 벽 첫 줄 · 벽 마지막 줄(94·95 는 기초)
ST_W = [4, 3, 5, 4, 6, 3, 4, 5, 3, 4, 6, 4, 3, 5, 4, 3, 5, 6, 4]           # 돌 너비(줄눈 포함, 손 순서)
ST_F = 'vwvvxpvwvvlvwvvhvxwvvqvwvpvvkvwvvl'                             # 돌 바탕(손 순서)
ST_HI = {'v': 'p', 'w': 'p', 'x': 'p', 'p': 'r', 'l': 'q', 'q': 'r', 'h': 'k', 'k': 'n'}
ST_LO = {'v': 't', 'w': 'v', 'x': 'v', 'p': 'x', 'l': 'f', 'q': 'o', 'h': 'e', 'k': 'i'}
ST_CH = [3, 3, 2, 3, 3, 4, 3, 2, 3]                                       # 줄 높이(줄눈 포함)


def stones(x0, y0, x1, y1, start=0, shade=None, skip=None):
    k = 0
    y = y0
    n = start * 5
    while y <= y1:
        ch_h = ST_CH[(k + start) % len(ST_CH)]
        x = x0 - (k * 2 + start) % 4
        wi = (k * 7 + start) % len(ST_W)
        while x <= x1:
            sw = ST_W[wi % len(ST_W)]
            wi += 1
            f = ST_F[n % len(ST_F)]
            n += 1
            for j in range(ch_h):
                for i in range(sw):
                    px, py = x + i, y + j
                    if px < x0 or px > x1 or py > y1 or (skip and skip(px, py)):
                        continue
                    if j == ch_h - 1:
                        col = 'J' if (px + k) % 6 else 'C'
                    elif i == sw - 1:
                        col = 'J' if j % 2 == 0 else 'C'
                    else:
                        col = f
                        if j == 0 and i < min(2, sw - 2):
                            col = ST_HI.get(f, f)
                        sh = shade(px, py) if shade else 0
                        if sh < 0:
                            col = ST_LO.get(col, col)
                        elif sh > 0 and j > 0:
                            col = ST_HI.get(col, col)
                    c.put(px, py, col)
            x += sw
        y += ch_h
        k += 1


stones(WX0, WY0, WX1, GY, start=2,
       shade=lambda x, y: (-1 if y < WY0 + 3 or x > WX1 - 10 else 0) + (1 if x < WX0 + 8 else 0))
for x in range(WX0, WX1 + 1):                     # 처마 밑 그늘 두 줄
    c.put(x, WY0, '-' if x % 5 else '_')
    c.put(x, WY0 + 1, 'J' if x % 3 else 'C')

# 부벽 넷(돌 기둥, 위는 비스듬한 갓돌로 벽에 기댄다) — 너비·높이 손으로 다르게
for kb, (bx, bw, top, lit) in enumerate(((26, 7, 70, True), (62, 6, 72, True), (138, 6, 71, False), (168, 7, 69, False))):
    stones(bx, top + 3, bx + bw - 1, GY, start=kb * 3 + 1,
           shade=lambda x, y, bx=bx, bw=bw: -1 if x >= bx + bw - 2 else 1)
    for i in range(bw):                              # 비스듬한 갓돌(윗면이 보인다): 밝은 윗면 → 앞 모 → 그늘
        c.put(bx + i, top, 'p' if i < bw - 2 else 'x')
        c.put(bx + i, top + 1, ('x' if i < bw // 2 else 'v') if lit else ('v' if i < bw // 2 else 'u'))
        c.put(bx + i, top + 2, 'J' if i % 3 else 'C')
    for y in range(top + 3, GY + 1):                 # 부벽 테: 왼 밝은 모 · 오른 그늘 줄눈
        if c.get(bx, y) not in 'JC':
            c.put(bx, y, 'p' if lit else 'w')
        c.put(bx + bw - 1, y, 'J' if y % 3 else 'C')
    for y in range(top + 3, GY + 1):                 # 부벽이 벽에 지는 그늘(오른쪽 1~2px)
        c.put(bx + bw, y, 'C' if y % 2 else '6')
        if c.get(bx + bw + 1, y) in ST_LO:
            c.put(bx + bw + 1, y, ST_LO[c.get(bx + bw + 1, y)])


# 환기 틈(좁은 세로 틈) 다섯 — 높이·반짝 다르게
def slit(x, y, h, glint):
    for j in range(h):
        c.put(x - 1, y + j, 'p' if j else 'r')
        c.put(x, y + j, 'C' if j else 'J')
        c.put(x + 1, y + j, 'A' if j != glint else '^')
        c.put(x + 2, y + j, 'C')
        c.put(x + 3, y + j, 'h' if j else 'k')
    for i in range(-1, 4):
        c.put(x + i, y + h, 'r' if i < 1 else 'k')
        c.put(x + i, y + h + 1, 'J')


slit(14, 70, 13, 2)
slit(45, 72, 11, 4)
slit(80, 71, 12, 3)
slit(150, 72, 10, 2)
slit(178, 70, 12, 5)
# 덧문 닫힌 작은 들창 하나(오른쪽, 들보에 도르래)
for j in range(11):
    for i in range(10):
        if i in (0, 9) or j in (0, 10):
            ch = 'η' if (i == 0 or j == 0) else 'β'
        else:
            ch = ('θ' if i < 5 else 'η') if (i % 3) else 'ε'
            if j in (3, 7):
                ch = 'ζ'
        c.put(122 + i, 70 + j, ch)
for i in range(1, 9):
    c.put(122 + i, 76 - abs(i - 4) // 2, 'σ' if i < 5 else 'ξ')   # 덧문 Z 띠(밝은 사선)
for i in range(-1, 11):
    c.put(122 + i, 81, 'r' if i < 5 else 'k')
    c.put(122 + i, 82, 'J')
c.put(129, 75, 'k')

# 기초: 짙은 돌 두 줄(땅에 붙는다)
for x in range(WX0, WX1 + 1):
    c.put(x, GY + 1, 'a' if x % 7 == 0 else ('e' if x % 5 else 'h'))
    c.put(x, GY + 2, 'X' if x % 6 else 'W')
for (x, ch) in ((5, 'N'), (6, 'O'), (40, 'N'), (71, 'O'), (133, 'N'), (186, 'N'), (160, 'O')):
    c.put(x, GY, ch)

# ---------------------------------------------------------------- 3) 가운데 수레 포치(남북 박공 초가, ㉚ h124_0)
PC = 104                              # 포치 가운데(왼 사면은 PC-1 까지)
PX0, PX1 = 81, 126                    # 포치 지붕 바깥
PWX0, PWX1 = 88, 119                  # 포치 벽
P_TOP = 18                            # 포치 지붕 뒤 꼭짓점(큰 지붕 속으로 골이 시작)
G_APEX, G_BASE = 38, 61               # 앞 박공 꼭짓점 · 박공 밑변(삼각벽 아래 끝)
P_EAVE = 61                           # 포치 지붕 처마 끝(양옆)


def yv(x):                            # 골: 꼭짓점에서 양옆 처마 쪽으로
    return P_TOP + abs(x + 0.5 - PC) * (P_EAVE - 4 - P_TOP) / (PC - PX0)


def yg(x):                            # 박공 처마(삼각 테 윗선)
    return G_APEX + abs(x + 0.5 - PC) * (G_BASE - 3 - G_APEX) / (PC - PWX0 + 2)


def in_porch_roof(x, y):
    return PX0 <= x <= PX1 and y >= yv(x) and y < yg(x) and y <= P_EAVE


# 사면: 왼 밝음 · 오른 그늘, 가닥은 세로(용마루와 나란히)
thatch(lambda x, y: in_porch_roof(x, y) and x < PC, PX0, PC - 1, P_TOP, P_EAVE, 'plit', seed=5, slant=0)
thatch(lambda x, y: in_porch_roof(x, y) and x >= PC, PC, PX1, P_TOP, P_EAVE, 'pdark', seed=9, slant=0)
# 사면 바깥 아래 끝: 둥근 처마(양옆 세로로 내려와 큰 처마와 만난다)
for y in range(int(yv(PX0)), P_EAVE + 1):
    for x in (PX0, PX0 + 1):
        if c.get(x, y) != '.':
            c.put(x, y, 'σ' if x == PX0 + 1 and y % 3 else 'ξ')
    for x in (PX1 - 1, PX1):
        if c.get(x, y) != '.':
            c.put(x, y, 'ε' if x == PX1 - 1 else 'δ')
# 골(포치 지붕이 큰 지붕과 만나는 짙은 선 2px)
for x in range(PX0, PX1 + 1):
    y0 = int(round(yv(x)))
    lit = x < PC
    c.put(x, y0, 'δ' if lit else '-')
    c.put(x, y0 + 1, 'ε' if lit else 'α')
    c.put(x, y0 - 1, 'η' if lit else 'δ')
# 용마루(남북): 꼭짓점 → 박공 꼭대기 세로선(왼 밝음 · 오른 그늘)
for y in range(P_TOP, G_APEX + 1):
    c.put(PC - 1, y, 'σ' if y % 3 else 'L')
    c.put(PC, y, 'η' if y % 3 else 'ε')
# 앞 박공 삼각벽: 세로 널(왼 밝음 · 오른 그늘) + 둥근 비둘기 구멍
for y in range(G_APEX + 2, G_BASE + 1):
    for x in range(PWX0, PWX1 + 1):
        if y < yg(x) + 2:
            continue
        u = x - PWX0
        ch = '-' if u % 4 == 3 else ('θ' if u % 4 == 0 else ('η' if (y + u) % 7 else 'ζ'))
        if x >= PC:
            ch = {'θ': 'η', 'η': 'ζ', 'ζ': 'ε', '-': '_'}[ch]
        c.put(x, y, ch)
# 박공 테: 두툼한 이엉 끝(3px, 밝은 짚 끝 → 그늘)
for x in range(PX0, PX1 + 1):
    y1 = int(round(yg(x)))
    if y1 > G_BASE:
        continue
    lit = x < PC
    c.put(x, y1 - 1, 'σ' if lit else 'ξ')
    c.put(x, y1, 'ξ' if lit else 'μ')
    c.put(x, y1 + 1, 'η' if lit else 'ε')
    if y1 + 2 <= G_BASE:
        c.put(x, y1 + 2, 'δ' if lit else 'α')
c.rows(PC - 2, G_APEX - 1, ['.σξ.', 'σξμη'])        # 박공 꼭대기 짚 마감
for (dx, dy, ch) in [(0, 0, 'ζ'), (1, 0, 'ζ'), (-1, 1, 'ζ'), (0, 1, 'A'), (1, 1, 'A'), (2, 1, '_'),
                     (-1, 2, 'ζ'), (0, 2, 'A'), (1, 2, 'B'), (2, 2, '_'), (0, 3, '_'), (1, 3, '_')]:
    c.put(PC - 1 + dx, 50 + dy, ch)
# 박공 밑 들보(삼각벽 밑변) — 벽에 건너지른 굵은 보
for x in range(PWX0 - 1, PWX1 + 2):
    c.put(x, G_BASE + 1, 'θ' if x % 8 else 'η')
    c.put(x, G_BASE + 2, 'η')
    c.put(x, G_BASE + 3, '-')
# 포치 벽: 잔돌 기둥(문 양옆)
PWY = G_BASE + 4
stones(PWX0, PWY, PWX1, GY, start=6, shade=lambda x, y: (1 if x < PWX0 + 3 else 0) - (1 if x > PWX1 - 3 else 0))
for (x0, lit) in ((PWX0, True), (PWX1 - 4, False)):  # 포치 모서리 귀돌
    for kq, (yy, hh) in enumerate([(PWY, 5), (PWY + 5, 5), (PWY + 10, 6), (PWY + 16, 5), (PWY + 21, 4)]):
        ww = 5 if kq % 2 == 0 else 3
        xs = x0 if lit else x0 + (5 - ww)
        for j in range(hh):
            for i in range(ww):
                if yy + j > GY:
                    continue
                if j == hh - 1:
                    ch = 'J'
                elif j == 0:
                    ch = 'p' if lit else 'x'
                else:
                    ch = ('x' if lit else 'v') if (i + j) % 5 else ('w' if lit else 't')
                c.put(xs + i, yy + j, ch)
# 수레 널문(두 짝, 열 6 = 96..111 안): 문틀 96·111, 널 97..110
DX0, DX1, DY = 97, 110, 69
for y in range(DY - 2, GY + 1):
    c.put(DX0 - 1, y, 'ε' if y % 6 else 'δ')
    c.put(DX1 + 1, y, '_')
for x in range(DX0 - 1, DX1 + 2):                 # 문 위 나무 인방
    c.put(x, DY - 2, 'θ' if x % 6 else 'η')
    c.put(x, DY - 1, '-')
for y in range(DY, GY + 1):
    for x in range(DX0, DX1 + 1):
        i = x - DX0
        leaf = 0 if i < 7 else 1
        u = i - 7 * leaf
        if u == 0:
            ch = 'ζ' if leaf == 0 else '_'
        elif u == 6:
            ch = '-' if leaf == 0 else 'δ'
        elif u in (2, 4):
            ch = 'ε' if leaf == 0 else 'δ'
        else:
            ch = ('θ' if leaf == 0 else 'η') if (y + u) % 9 else ('η' if leaf == 0 else 'ζ')
        c.put(x, y, ch)
for leaf in (0, 1):                               # 가로 띠 둘 + Z 사선(밝은)
    x0 = DX0 + 7 * leaf
    for yy in (DY + 3, GY - 4):
        for i in range(1, 6):
            c.put(x0 + i, yy, 'ξ' if leaf == 0 else 'θ')
            c.put(x0 + i, yy + 1, 'ε')
    span = (GY - 5) - (DY + 5)
    for s in range(span + 1):
        xx = x0 + 1 + round(4 * s / span) if leaf == 0 else x0 + 5 - round(4 * s / span)
        c.put(xx, GY - 6 - s, 'σ' if leaf == 0 else 'ξ')
    c.put(x0 + (1 if leaf == 0 else 5), DY + 3, 'k')
    c.put(x0 + (1 if leaf == 0 else 5), GY - 4, 'k')
c.put(DX0 + 5, 82, 'X')                           # 고리 손잡이 둘
c.put(DX0 + 8, 82, 'X')
c.put(DX0 + 5, 83, 'k')
c.put(DX0 + 8, 83, 'i')
for x in range(DX0 - 2, DX1 + 3):                 # 문턱 돌(밝게)
    c.put(x, GY + 1, 'r' if x % 4 else 'm')
    c.put(x, GY + 2, 'Z')

# ---------------------------------------------------------------- 4) 마감
import importlib.util as _iu  # noqa: E402
for _n in ('fixups', 'edgefix'):
    _sp = _iu.spec_from_file_location(_n + '_tb', os.path.join(os.path.dirname(os.path.abspath(__file__)), _n + '.py'))
    globals()[_n] = _iu.module_from_spec(_sp)
    _sp.loader.exec_module(globals()[_n])
fixups.finalize(c)
print('  먹 윤곽 → 재질 어두운 단', edgefix.material_edges(c))

walk = []
for cy in range(6):
    r = ''
    for cx in range(12):
        op = any(c.g[y][x] != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cx == 6 and cy in (4, 5):
            r += 'D'
        else:
            r += 'X' if cy >= 3 else '*'
    walk.append(r)
print('\n'.join(walk))
meta = {'name': '십일조 헛간', 'massing': 'M02', 'material': 'wood',
        'refs': ['bd-house-h124_0', 'bd-house-smithy_town'], 'walk': walk}
fails, warns = c.save('tithe-barn', meta)
print('fails', fails, 'warns', warns)
