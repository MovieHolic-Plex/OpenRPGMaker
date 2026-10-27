"""gap-ice-r2 — 얼음 동굴 벽(gap.ice_rock) 다시 그림. 얼음 바닥은 고른 gap-ice-r1 A1(얼음 · 얼음굴 바닥)을 그대로 쓴다.

r1 A1·A2(gap-rock C2·B2 다시 칠하기)가 받은 반려 셋을 고친다:
  ① 앞면 = 채도 높은 납작한 청록에 고른 세로 줄 · 빗살 같은 고드름 · 16px 반복 → 장막·장난감처럼 보였다.
     → 어두운 바위 위에 두께가 제각각인 반투명 얼음(두께 표 · 굴절 빛 획 · 얼음 밑 그늘), 길이·간격이 다른 고드름,
       48px 주기 가운데 덩이(`-face-mid` 3칸 키트, 시공기가 벽 줄 첫 칸부터 센다) — 16px 마다 같은 무늬가 서지 않는다.
  ② 방 한가운데 홀로 선 얼음 벽 덩이에 윗면이 없어 앞면만 바닥에 떠 있었다.
     → 서리 낀 바위 윗면 오토타일(47 + 몸통 변형 8)을 벽 덩이 위 칸에 깐다. 한 칸 폭 앞면(홑칸)·양 끝 마구리를 따로 그린다.
  ③ 윗면이 납작한 회색이고 흰 테두리가 윤곽선처럼 읽혔다.
     → 윗면 = 검푸른 바위(vrock 3) 바탕에 낮은 대비 잔결(iron 2 · vrock 2)과 부드러운 서리 덩이(iron 3, 가운데만 iron 4).
       테두리 = 재질 자신의 단(빛 쪽 iron 3 → iron 2, 그늘 쪽 vrock 2) — 흰 단(iron 5 · ice 3~4 · rim 6)은 쓰지 않는다.

모든 화소는 이 파일의 행 문자열·열마다 적은 표(입술 깊이 · 얼음 밑변 · 두께)·손으로 고른 자리(고드름 · 빛 획 · 바위 결)에서 온다.
틀(옆선·모서리)은 고른 gap-rock-r1 의 옆선 표·귀 모양을 읽기만 한다. 3/4: 윗면 → 남쪽 앞면 2단(32px), 옆면 없음, 빛은 왼쪽 위.
  A1 「빙막」 — 두꺼운 얼음 막이 앞면 위쪽 절반 남짓을 덮고(밑변 9~21행 출렁임) 아래로 고드름. 윗면 = 둥근 서리 덩이.
  A2 「빙류」 — 얼음이 바위 틈을 따라 세로 혀로 흘러내리고(폭·길이 제각각) 혀 끝마다 고드름, 사이는 맨 바위. 윗면 = 결 따라 긴 서리 줄.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import a2_plus, autotile_cv, hcat, on_base, poly, variants_sheet  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402
import gap_ice_r1 as R1  # noqa: E402  읽기 전용 — 고른 얼음 바닥 A1 · 얼음굴 바닥 A1 · 얼음 속 돌
import gap_rock_r1 as GR  # noqa: E402  읽기 전용 — 옆선 표·귀 모양

WAVE = 'gap'
T = 16
MW = 48   # 앞면 가운데 덩이 폭(3칸)


# ================================================================================================ 윗면 — 서리 낀 바위
# B 바탕 vrock 3 · g 한 단 밝은 잔결 iron 2 · n 한 단 어두운 잔결 vrock 2 · h 서리 iron 3 · H 서리 속 iron 4(덩이마다 한두 화소)
TOP_LEG = legend(B=('vrock', 3), g=('iron', 2), n=('vrock', 2), h=('iron', 3), H=('iron', 4))
# 틀 글자(gap_rock_r1 줄 C 기호): 빛 쪽 m c b · 그늘 쪽 k d · 앞턱(아래부터) m c b · '0' 바닥 그늘 · ',' 바닥 몸통
FRAME_LEG = legend(m=('iron', 3), c=('iron', 2), b=('vrock', 3), k=('vrock', 2), d=('vrock', 3), **{'0': ('iron', 4)})


def sq(rows, w=16, h=16, name=''):
    assert len(rows) == h and all(len(r) == w for r in rows), (name, len(rows), [len(r) for r in rows])
    return rows


TOP_BASE = {
    1: sq([
        'BBBgBBBBBBBBnBBB',
        'BgBBBBBBgBBBBBBB',
        'BBBBBnBBBBBBBgBB',
        'BBBBBBBBBBgBBBBB',
        'gBBBBBBgBBBBBBBn',
        'BBBnBBBBBBBBBBBB',
        'BBBBBBBBBnBBgBBB',
        'BBgBBBBBBBBBBBBB',
        'BBBBBBgBBBBBBBBg',
        'BnBBBBBBBBBnBBBB',
        'BBBBBBBBgBBBBBBB',
        'BBBBgBBBBBBBBnBB',
        'BBBBBBBBBBBBBBBB',
        'BgBBBBnBBBgBBBBB',
        'BBBBBBBBBBBBBBgB',
        'BBBnBBBBgBBBBBBB'], name='TOP1'),
    2: sq([
        'BBBBBgBBBBBBBBBB',
        'BBnBBBBBBBBgBBBB',
        'BBBBBBBBgBBBBBnB',
        'gBBBBBBBBBBBBBBB',
        'BBBBgBBBBBnBBBBB',
        'BBBBBBBBBBBBBgBB',
        'BnBBBBBgBBBBBBBB',
        'BBBBBBBBBBBBBBBn',
        'BBBgBBBBBBgBBBBB',
        'BBBBBBnBBBBBBBBB',
        'BBBBBBBBBBBBgBBB',
        'BgBBBBBBBnBBBBBB',
        'BBBBBBgBBBBBBBBB',
        'BBBBnBBBBBBBBBgB',
        'BBgBBBBBBBBBBBBB',
        'BBBBBBBBBgBBnBBB'], name='TOP2'),
}

# 서리 덩이(둥근, A1): 위·왼 쪽이 밝고(H 한두 화소) 오른 아래가 바탕으로 풀린다. '.' = 그대로
FR_S = ['.hh.', 'hHhg', '.hg.']
FR_M = ['..hhh.', '.hHHhh', 'hhHhhg', '.hhhg.', '..gg..']
FR_L = ['...hhhh...', '.hhHHhhhg.', 'hhHHhhhhhg', 'hhhhhhhgg.', '.hhhhgg...', '...gg.....']
FR_W = ['..hhh...', '.hHhhhh.', 'hhhhhhhg', '.hhhggg.']
PIT = ['.g', 'nn']          # 서리 아래 얕은 틈
# 결 따라 긴 서리 줄(A2): 비스듬히 누운 2~3px 줄
ST_A = ['hhhh.....', '.hHHhhh..', '...hhhhhg', '......gg.']
ST_B = ['...hhhh', '.hhHhhg', 'hhhgg..']
ST_C = ['hhh...', '.hHhh.', '..hhhg']
ST_D = ['....hhh', '..hhHhg', 'hhhhg..', '.gg....']

# 몸통 변형(첫째 = 가장자리 칸이 쓰는 본몸통, 조용하게). 안쪽 덧그림은 둘레 1px 안(1~14)에만 — 아무 순서로 붙어도 이어진다.
TOP_STAMPS = {
    1: [
        [(FR_S, 9, 5)],
        [(FR_L, 2, 2), (PIT, 11, 11)],
        [(FR_M, 7, 7), (FR_S, 2, 11)],
        [(FR_W, 5, 2), (FR_M, 1, 9)],
        [(FR_M, 1, 4), (FR_L, 4, 8)],
        [(FR_S, 10, 2), (FR_W, 4, 9)],
        [(FR_L, 4, 3), (PIT, 2, 12)],
        [(FR_W, 1, 10), (FR_M, 8, 3)],
        [(FR_M, 8, 1), (FR_S, 3, 6), (FR_W, 6, 10)],
    ],
    2: [
        [(ST_C, 7, 6)],
        [(ST_A, 2, 2), (ST_C, 7, 10)],
        [(ST_B, 6, 7), (PIT, 2, 2)],
        [(ST_D, 7, 1), (ST_A, 1, 9)],
        [(ST_C, 2, 5), (ST_B, 7, 10)],
        [(ST_A, 5, 5)],
        [(ST_D, 2, 8), (ST_C, 8, 2)],
        [(ST_B, 1, 2), (ST_A, 5, 9)],
        [(ST_C, 8, 8), (ST_D, 3, 3)],
    ],
}


def stamp_in(rows, sprites):
    g = [list(r) for r in rows]
    for sp, x, y in sprites:
        for dy, r in enumerate(sp):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                X, Y = x + dx, y + dy
                assert 1 <= X <= 14 and 1 <= Y <= 14, f'안쪽 덧그림 ({X},{Y}) 이 둘레에 닿았다'
                g[Y][X] = ch
    return [''.join(r) for r in g]


ROCK_PROF = {1: GR.PROF1, 2: GR.PROF2}


def top_frame(n):
    fr, inner = GR.rock_frame('C', ROCK_PROF[n], soft=True)
    return fr, inner


def rock_top(n):
    floor = R1.ground(1)
    fr, inner = top_frame(n)
    frc, innc = on_base(floor.body, fr, inner, FRAME_LEG)
    bodies = [grid(stamp_in(TOP_BASE[n], s), TOP_LEG, 16, 16) for s in TOP_STAMPS[n]]
    return autotile_cv(bodies[0], frc, innc, bodies[1:])


# ================================================================================================ 앞면 — 어두운 바위 위 반투명 얼음
# 바위: x vrock 0 · k vrock 1 · r vrock 2(몸) · q iron 1(몸 둘째) · s vrock 3(바위 빛 턱) · 입술: l iron 3 · '0' iron 4(바닥 닿는 귀)
# 얼음은 반투명이다 — 같은 두께라도 밑 바위가 어두우면(k·x) 한 단 어둡게 비친다:
#   얇음 1 = tide 0 / tide 1 · 보통 2 = tide 1 / tide 2 · 두꺼움 3 = water 2 · 빛 가장자리 = 한 단 위 · 굴절 빛 획 = water 3 · 반짝 = ice 1
FACE_LEG = legend(x=('vrock', 0), k=('vrock', 1), r=('vrock', 2), q=('iron', 1), s=('vrock', 3), l=('iron', 3),
                  A=('tide', 0), B=('tide', 1), C=('tide', 2), D=('water', 2), E=('water', 3), F=('ice', 1),
                  **{'0': ('iron', 4)})
ICE = 'ABCDE'
DARK_ROCK = 'kx'


def _digits(s, n):
    assert len(s) == n, (len(s), n, s)
    return [int(c, 36) for c in s]


def rock_rows(W, lip, dark, beds, flecks):
    """맨 바위 W 열 32행: 몸 r(위) → 열마다 다른 깊이(dark)부터 k 섞임 → 맨 밑 넷 k·x. 층 금 beds, 손 잔점 flecks, 입술 lip."""
    LIP, DK = _digits(lip, W), _digits(dark, W)
    g = [['r'] * W for _ in range(32)]
    for y in range(32):
        for x in range(W):
            xx = x % 16   # 잔 섞임 자리는 16 주기(이음 열 15·31·47 이 같은 화소가 되게) — 큰 모양은 열마다 다른 dark 깊이가 정한다
            if y >= 28:
                g[y][x] = 'k' if (y < 30 or (xx * 7 + y) % 5) else 'x'
            elif y >= DK[x] + 2:
                g[y][x] = 'k' if (xx * 5 + y * 3) % 4 else 'r'
            elif y >= DK[x]:
                g[y][x] = 'k' if (xx * 3 + y) % 3 == 0 else 'r'
    for y0, offs in beds:
        for x, o in enumerate(offs):
            if o == '.':
                continue
            y = y0 + int(o)
            g[y - 1][x] = 's' if g[y - 1][x] == 'r' else g[y - 1][x]
            g[y][x] = 'x'
            g[y + 1][x] = 'k'
    for x, y, ch in flecks:
        g[y][x] = ch
    for x in range(W):
        for y in range(LIP[x]):
            g[y][x] = 'l'
        g[LIP[x]][x] = 'k'
    return g, LIP


def ice_over(g, LIP, masses, glints=(), sparks=(), icicles=()):
    """얼음 덩이를 바위 위에 얹는다. masses = [(x0, 밑변 표, 두께 표)] — 표는 열마다 한 글자(36진, 두께 0~3).
    덩이마다 입술 밑에서 밑변까지. 두께는 위 두 줄 한 단 더, 밑 두 줄 한 단 덜. 왼(빛) 끝 열은 한 단 밝게, 오른 끝 열은 한 단 어둡게.
    덩이 밑 바위 한 줄 = 얼음 그늘(k). 덩이 사이는 맨 바위 — 얼음이 앞면 전체를 덮지 않는다."""
    W = len(g[0])
    level = [[0] * W for _ in range(32)]
    bottom = {}
    for x0, bot, th in masses:
        B, Tk = [int(c, 36) for c in bot], [int(c, 36) for c in th]
        assert len(B) == len(Tk), (x0, bot, th)
        for j, (b, t) in enumerate(zip(B, Tk)):
            x = (x0 + j) % W
            top = LIP[x] + 1
            if b < top:
                continue
            bottom[x] = b
            for y in range(top, b + 1):
                k = t + (1 if y - top <= 1 else 0) - (1 if b - y <= 1 else 0)
                if j == 0:
                    k += 1
                elif j == len(B) - 1:
                    k -= 1
                level[y][x] = max(1, min(4, k))
    for y in range(32):
        for x in range(W):
            k = level[y][x]
            if not k:
                continue
            k = k - 1 if g[y][x] in DARK_ROCK and k < 3 else k
            g[y][x] = ICE[max(0, min(3, k)) if k < 4 else 3]
    for x, b in bottom.items():
        if b + 1 < 28 and g[b + 1][x] in 'rqs':
            g[b + 1][x] = 'k'
    for pts in glints:
        for x, y in poly(*pts):
            if g[y][x % W] in 'CD':
                g[y][x % W] = 'E'
    for x, y in sparks:
        assert g[y][x] in 'CDE', ('반짝은 두꺼운 얼음 위에만', x, y, g[y][x])
        g[y][x] = 'F'
    # 고드름: 그 열 밑변(없으면 입술) 바로 밑에서 늘어진다. 굵기 1~3 이 위쪽 40% 뒤 한 화소씩 준다. 빛 쪽 C, 가운데 D, 그늘 쪽 B, 끝 C.
    for x0, w, n in icicles:
        start = bottom.get(x0 % W, LIP[x0 % W]) + 1
        for i in range(n):
            y = start + i
            if y >= 30:
                break
            ww = w if i < n * 0.4 else max(1, w - 1) if i < n * 0.75 else 1
            for j in range(ww):
                X = (x0 + j) % W
                g[y][X] = 'C' if i == n - 1 else ('E' if j == 0 and ww > 1 else 'B' if j == ww - 1 and ww > 1 else 'D' if ww > 1 else 'C')
            X = (x0 + ww) % W
            if g[y][X] in 'rqs':
                g[y][X] = 'k'
    return g


def rows_cv(g):
    W = len(g[0])
    cv = Cv(W, 32)
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            cv.put(x, y, FACE_LEG[ch])
    return cv


def cap_edge(g, side):
    """끝 마구리: 바깥 열 = 바위 모서리(왼끝 빛 s, 오른끝 그늘 k)로 얼음 한 단 어둡게, 바닥 닿는 귀 2px 둥글게."""
    W = len(g[0])
    xo, xi = (0, 1) if side == 'L' else (W - 1, W - 2)
    for y in range(32):
        ch = g[y][xo]
        if ch in 'lkx0':
            continue
        if ch in ICE:
            g[y][xo] = ICE[max(0, ICE.index(ch) - 1)]
        elif y < 28:
            g[y][xo] = ('s' if y % 4 else 'r') if side == 'L' else 'k'
    for y, xs in ((30, (xo,)), (31, (xo, xi))):
        for x in xs:
            g[y][x] = '0'
    return g


# ---- 48 열 가운데 덩이. 시공기는 벽 줄 첫 칸(왼끝 마구리) 다음 칸부터 위상 1 → 2 → 0 … 으로 센다(compose.ts gapIcePhase).
#      그래서 왼끝 마구리 오른 반(덩이 열 8~15) 뒤엔 언제나 열 16 이 온다. 오른끝 마구리 왼 반(덩이 열 0~7) 앞에는 위상에 따라 열 15·31·47 이
#      오므로 그 셋은 같은 화소다(check_seam) — 맨 바위 + 입술 밑 얇은 막.
FACE = {
    1: dict(   # A1 「빙막」 — 크기·깊이가 다른 얼음 막 셋, 사이는 맨 바위
        lip='011100012210000001111000122100000110001221100010',
        dark='mmnnoppoonmmlmmmmnnnmmlllmnoooommmmlmmnnoponnmmm',
        beds=[(24, '0001111222211100' '0000011122222100' '0000000111100000')],
        flecks=[(2, 21, 'q'), (9, 23, 'q'), (19, 20, 'q'), (21, 24, 'q'), (24, 21, 's'), (33, 22, 'q'), (38, 23, 'q'), (44, 20, 's'),
                (5, 27, 'q'), (17, 26, 'q'), (30, 27, 'q'), (44, 26, 'q'), (17, 9, 'q'), (28, 14, 's'), (46, 9, 'q')],
        # 이음 열 15·31·47 은 덩이 안쪽(끝 열 아님)에 같은 밑변 a · 두께 2 로 둔다 — 덩이가 이음을 건너도 이어지고, 덩이 폭·틈은 제각각(24 · 15, 틈 3 · 6).
        masses=[(42, '7899aabcegijigecbbcbaa98', '112222333333332222222211'),
                (21, '89bdfgecbaaaca8', '122333322222321')],
        glints=[[(3, 5), (4, 8), (5, 11)], [(9, 4), (10, 7)], [(23, 4), (25, 8)], [(44, 3), (45, 5)]],
        sparks=[(5, 6), (25, 6)],
        icicles=[(44, 1, 3), (4, 2, 10), (8, 1, 4), (12, 1, 2), (19, 1, 3), (24, 2, 7), (27, 1, 3), (33, 1, 5), (38, 1, 5), (40, 1, 2)],
    ),
    2: dict(   # A2 「빙류」 — 바위 틈을 따라 내려온 세로 얼음 혀(폭·길이 제각각), 혀 끝 고드름, 사이 맨 바위 + 층 금 둘
        lip='001100011111000001011100001110000101100011100010',
        dark='hhhiijjiihhhgghhhhiiijjjiihhhgghhhiijjjiihhhgghh',
        beds=[(15, '0000111112221110' '0000000000111220' '0122221100000000'), (23, '000011100000000000111122222211100000000011110000')],
        flecks=[(1, 9, 'q'), (13, 12, 's'), (14, 18, 'q'), (17, 8, 'q'), (30, 11, 'q'), (29, 19, 's'), (34, 9, 'q'), (45, 13, 's'),
                (46, 20, 'q'), (3, 26, 'q'), (19, 27, 'q'), (29, 26, 'q'), (41, 27, 'q')],
        masses=[(8, '544545444554354454445544454434554445455454544554', '111111111111111111111111111111111111111111111111'),   # 입술 밑 얇은 막(열 8 부터 한 바퀴) — 이음 열 15·31·47 = 밑변 4
                (2, '7bfhe9', '123321'),          # 넓은 혀(열 2~7)
                (19, '8cgdb9', '123321'),         # 가는 혀(열 19~24)
                (26, '7a8', '121'),
                (36, '69dijf9', '1233321')],      # 긴 혀(열 36~42)
        glints=[[(3, 5), (4, 10), (5, 13)], [(20, 5), (21, 9)], [(38, 6), (39, 11), (40, 15)]],
        sparks=[(4, 7), (39, 8)],
        icicles=[(4, 2, 7), (10, 1, 2), (21, 2, 6), (27, 1, 3), (33, 1, 2), (39, 2, 8), (44, 1, 3)],
    ),
}
CAPS = {   # 끝 마구리 8열 덩이 — 왼끝은 덩이 열 8 앞, 오른끝은 덩이 열 7 뒤에 붙는다(Face.tile). 홑칸 = 왼끝 + 오른끝.
    1: dict(L=dict(lip='00111122', dark='mmmnnnnm', masses=[(2, '79bcc9', '122321')], icicles=[(4, 2, 6)], glints=[[(3, 4), (4, 6)]]),
            R=dict(lip='11100000', dark='mmmmmmmm', masses=[(0, 'db97', '2211')], icicles=[(1, 1, 5)], glints=[])),
    2: dict(L=dict(lip='00011111', dark='hhhhiiii', masses=[(3, '69ca', '1221')], icicles=[(4, 1, 4)], glints=[]),
            R=dict(lip='11000000', dark='hhhhhhhh', masses=[(0, 'b85', '221')], icicles=[(0, 2, 5)], glints=[[(0, 5), (0, 8)]])),
}


def check_seam(g):
    for y in range(32):
        assert g[y][15] == g[y][31] == g[y][47], ('이음 열 15·31·47 이 다르다', y, g[y][15], g[y][31], g[y][47])


def face_parts(n):
    """(48×32 가운데 덩이 Cv, dot.Face 32×32). Face 가운데 16열 = 덩이 열 0~15(바로 이어지는 쪽은 열 8|16 — 위 설명)."""
    f = FACE[n]
    g, LIP = rock_rows(MW, f['lip'], f['dark'], f['beds'], f['flecks'])
    g = ice_over(g, LIP, f['masses'], f['glints'], f['sparks'], f['icicles'])
    check_seam(g)
    caps = {}
    for side in 'LR':
        c = CAPS[n][side]
        beds = [(y0, offs[:8] if side == 'L' else offs[40:]) for y0, offs in f['beds']]
        cg, cl = rock_rows(8, c['lip'], c['dark'], beds, [])
        cg = ice_over(cg, cl, c['masses'], c['glints'], (), c['icicles'])
        caps[side] = cap_edge(cg, side)
    block = [caps['L'][y] + g[y][:16] + caps['R'][y] for y in range(32)]
    return rows_cv(g), dot.Face(rows_cv(block))


# ================================================================================================ 장면 — 얼음 동굴 18×12
# '#' 얼음 바위 · '.' 얼음굴 바닥 · 'i' 얼음 바닥. 북벽 16칸 곧은 줄(반복 판단) · 가운데 큰 덩이 · 홀로 선 2칸 덩이 · 1칸 기둥 ·
# 왼쪽 아래 바위 턱. 바닥은 고른 gap-ice-r1 A1.
SCENE = [
    '##################',
    '##################',
    '##################',
    '#..........####..#',
    '#.iiiiii...####..#',
    '#iiiiiiii..####..#',
    '#iiiiiiii........#',
    '#.iiiiii##....#..#',
    '###.ii..##....#..#',
    '###.....##.iii#i.#',
    '###.......iiii...#',
    '..........########',
]
FROZEN_AT = [(3, 5, 0), (12, 9, 1)]
ACTOR_AT = (5, 9)


def render_scene(g, top, mid, face, floor, water):
    """dot.render_cave 와 같되 앞면 가운데 칸은 48px 덩이를 벽 줄 첫 칸부터 센 위상으로(compose.ts 와 같은 규칙)."""
    cv = dot.render_cave(g, top, face, floor, water=water)
    k = dot.classify(g)
    H, Wd = len(g), len(g[0])
    for y in range(H):
        x = 0
        while x < Wd:
            kk = k[y][x]
            if kk not in ('hi', 'lo'):
                x += 1
                continue
            x0 = x
            while x < Wd and k[y][x] == kk:
                x += 1
            lv = 0 if kk == 'hi' else 1
            for c in range(x0 + 1, x - 1):
                ph = (c - x0) % 3   # compose.ts 와 같은 위상(벽 줄 첫 칸부터 센다 → 왼끝 다음 칸이 위상 1)
                cv.a[y * T:(y + 1) * T, c * T:(c + 1) * T] = mid.a[lv * T:(lv + 1) * T, ph * T:(ph + 1) * T]
    return cv


def scene(n, actor=True):
    g = [r.replace('i', 'w') for r in SCENE]
    assert not dot.structure_errors(g), dot.structure_errors(g)
    mid, face = face_parts(n)
    cv = render_scene(g, rock_top(n), mid, face, R1.ground(1), R1.ice_floor(1))
    fz = R1.frozen_tiles(1)
    for x, y, k in FROZEN_AT:
        cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = fz[k].a
    if actor:
        cx, cy = ACTOR_AT
        cv.paste(dot.Cv.of(dot.actor1_frame(1, 0, 0)), cx * T - 4, cy * T - 14)
    return cv, g


def mid_run(mid, face, n=9):
    """벽 줄 n 칸 이어 붙임(끝 마구리 + 48px 덩이) — 시공기 배치 그대로."""
    cv = Cv(n * T, 32)
    for i in range(n):
        if i == 0 or i == n - 1:
            t0, t1 = face.tile(0, i == 0, i == n - 1), face.tile(1, i == 0, i == n - 1)
            cv.a[:16, i * T:(i + 1) * T], cv.a[16:, i * T:(i + 1) * T] = t0.a, t1.a
        else:
            ph = i % 3
            cv.a[:, i * T:(i + 1) * T] = mid.a[:, ph * T:(ph + 1) * T]
    return cv


NOTES = {
    'A1': '「빙막」 — 검푸른 바위 윗면(vrock 3, 낮은 대비 잔결)에 부드러운 둥근 서리 덩이 · 재질 단 테두리(흰 테 없음). '
          '앞면 = 어두운 바위 위 두께가 출렁이는 반투명 얼음 막(밑변 10~21행, 굴절 빛 획) + 길이 2~11px 고드름 13개(간격 제각각), 48px 주기',
    'A2': '「빙류」 — 같은 바위 윗면에 결 따라 누운 서리 줄. 앞면 = 맨 바위 위로 폭·길이가 다른 세로 얼음 혀 셋이 흘러내리고 '
          '사이는 얇은 얼음 막, 혀 끝 고드름 · 바위 층 금 둘, 48px 주기',
}


def cand(n):
    def fn():
        at = rock_top(n)
        mid, face = face_parts(n)
        v, g = scene(n)
        return hcat(a2_plus(at), face.b, mid), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': face}, 'face_mid': mid, 'vignette': v, 'grid': g,
            'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 윗면 A2(+몸통 변형 8) | 앞면 표본 32×32(끝 마구리 + 가운데 16) | 가운데 덩이 48×32',
            'extras': [('윗면 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('벽 줄 9칸(끝 마구리 + 48px 덩이)', mid_run(mid, face, 9), 3),
                       ('홑칸 앞면', hcat(face.tile(0, True, True), face.tile(1, True, True)), 4), ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {'gap.ice_rock': {'A1': cand(1), 'A2': cand(2)}}

SCENE_LEAD = ('같은 번호의 얼음 바위(윗면·앞면)와 고른 얼음 바닥 A1·얼음굴 바닥 A1 로 깐 18×12 얼음 동굴 — 북벽 16칸 곧은 줄(반복 판단), '
              '가운데 큰 바위 덩이, 홀로 선 2칸 덩이와 1칸 기둥(윗면이 보여야 한다), 왼쪽 아래 바위 턱, Actor1. 맵 가장자리는 잘린 것.')
