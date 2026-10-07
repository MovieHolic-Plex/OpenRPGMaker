"""style-r1 — 화풍 시험 판. 항목 5 × 후보 A·B·C. 모든 화소는 아래 행 문자열에서 온다(손 도트).

후보 방향:
  A 「버들항 정통 띠」 — 버들항 바다 동굴 그대로: 천장 너머 어둠 + 갈색 윗면 띠 + 밝은 끝선, 녹회색 돌 앞면, 갈색 반점 흙바닥.
  B 「바위 윗면」     — 어둠 대신 울퉁불퉁한 바위 윗면이 보이는 산 속 동굴. 큰 바윗덩이 앞면, 어두운 흙과 자갈 바닥.
  C 「검푸른 층리」   — 가는 회색 돌 테두리와 깊은 어둠, 가로 층리가 진 검푸른 화산암 앞면, 차가운 회색 자갈 바닥.

글자 범례는 후보마다 따로 둔다. '.' = 투명(오토타일 조각에서는 몸통 유지), '~' = 바닥 그림자.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402

WAVE = 'style'
T = 16


# ------------------------------------------------------------------------------------------------ 공용 조립
def overlay(base, rows, leg, w, h, base_off=(0, 0)):
    """base(16×16 몸통)를 w×h 로 깔고(base_off 만큼 밀어서) rows 를 덮는다. '.' 은 몸통."""
    cv = Cv(w, h)
    ox, oy = base_off
    for y in range(h):
        for x in range(w):
            cv.a[y, x] = base.a[(y - oy) % 16, (x - ox) % 16]
    return stamp(cv, rows, leg)


def autotile(body, frame_rows, inner_rows, leg):
    """A2 식: frame 32×32(가운데 16×16 = 몸통 자리, 모서리·변) + inner 16×16(네 귀 안 모서리). '.' = 몸통."""
    frame = overlay(body, frame_rows, leg, 32, 32, (8, 8))
    inner = overlay(body, inner_rows, leg, 16, 16)
    q = lambda c, qx, qy: c.crop(qx * 8, qy * 8, 8, 8)  # noqa: E731
    edge = {'N': frame.crop(8, 0, 16, 8), 'S': frame.crop(8, 24, 16, 8),
            'W': frame.crop(0, 8, 8, 16), 'E': frame.crop(24, 8, 8, 16)}
    outer = {'NW': q(frame, 0, 0), 'NE': q(frame, 3, 0), 'SW': q(frame, 0, 3), 'SE': q(frame, 3, 3)}
    inn = {'NW': q(inner, 0, 0), 'NE': q(inner, 1, 0), 'SW': q(inner, 0, 1), 'SE': q(inner, 1, 1)}
    at = dot.Autotile(frame.crop(8, 8, 16, 16), edge, outer, inn)
    at.frame_tile, at.inner_tile = frame, inner
    return at


def a2_block(at):
    """조각을 A2 블록 32×48 로 보인다: 윗줄 = 외딴 칸 · 안 모서리 칸, 아래 32×32 = 틀."""
    cv = Cv(32, 48)
    cv.paste(at.tile(0), 0, 0)
    cv.paste(at.inner_tile, 16, 0)
    cv.paste(at.frame_tile, 0, 16)
    return cv


def wrap_stamp(cv, rows, leg, x, y, period=16, x0=0, width=None):
    """가로 주기 period 로 감아 찍는다(반복 무늬 이음 보장). x0..x0+width 범위 안에서."""
    width = width or cv.w
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            X = x0 + (x + dx) % period
            while X < x0 + width:
                cv.put(X, y + dy, leg[ch])
                X += period
    return cv


def wrap2(cv, rows, leg, x, y):
    """가로·세로 모두 cv 크기 주기로 감아 찍는다(반복 몸통의 이음 보장)."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != '.':
                cv.put((x + dx) % cv.w, (y + dy) % cv.h, leg[ch])
    return cv


def face_block(p, leg, left_cap, right_cap):
    """16칸 주기 앞면 무늬 p(Cv 16×32) → 32×32 표본. left_cap/right_cap: {(x,y): 글자} 끝 마구리 덮기."""
    cv = Cv(32, 32)
    cv.paste(p, 0, 0)
    cv.paste(p, 16, 0)
    for (x, y), ch in left_cap.items():
        cv.put(x, y, leg[ch])
    for (x, y), ch in right_cap.items():
        cv.put(31 - x, y, leg[ch])
    return dot.Face(cv)


def cap_cols(cols, rows=32):
    """마구리: cols = ['열0 글자열(위→아래 32)', '열1 …'] → {(x,y):글자}. '.' 는 두기."""
    out = {}
    for x, col in enumerate(cols):
        assert len(col) == rows, (x, len(col))
        for y, ch in enumerate(col):
            if ch != '.':
                out[(x, y)] = ch
    return out


# ================================================================================================ 후보 A — 버들항 정통 띠
LA = legend(
    v=('void', 0), u=('void', 1), t=('void', 2),
    e=('rim', 0), d=('rim', 1), c=('rim', 2), b=('rim', 3), a=('rim', 4), k=('rim', 5), l=('rim', 6),
    f=('cfloor', 2),
    **{str(i): ('cfloor', i) for i in range(8)},
)
LA_FACE = legend(**{str(i): ('crock', i) for i in range(7)})

A_VOID = ['v' * 16] * 16   # 버들항 천장 어둠은 한 색(무늬 없음)
# 천장 틀: 바깥 끝선 l(바닥 쪽) · 갈색 띠 b c d a · 안쪽 어두운 선 e(물결) · 그 안은 어둠 몸통('.').
# 띠 안쪽 선 높이(열마다): 위 6 6 6 5 5 6 7 7 6 6 6 5 5 6 6 7 6 6 — 8·16·24 열에서는 늘 6(사분면 바꿔 끼움 이음).
A_CEIL_FRAME = [
    'ffllllllllllllllllllllllllllllff',
    'flbcbcbbdbcbbcabcbbcbcbbdbcbbclf',
    'lbcbacbcbbcbcbbcbcbacbcbbcbcbcbl',
    'lcbdbbcbacbbdbcbbcbdbbcbacbbdbcl',
    'lbcbbcbdbcbbcbacbcbbcbdbcbbcbacl',
    'lcbcbdcbcbeebcbbcbeebcbbcbdcbcbl',
    'lbdbcbeeee..ecbeee..eeceeecbdbcl',
    'lcbbcbe......ee.......e..ebcbcbl',
    'lbcdbce..................ecbcdbl',
    'lcbbcbe..................ebcbbcl',
    'lbcabe....................ebcbdl',
    'lcbdbce...................ecbcbl',
    'lbcbbcbe.................ebcbcbl',
    'lcbdbcbe................ecbbcdbl',
    'lbcbcbe..................ecbcbcl',
    'lcbacbe..................ebcacbl',
    'lbcbdce..................ecbdbcl',
    'lcbcbbe..................ebcbbcl',
    'lbdbce..................ecbcbdbl',
    'lcbbce..................ebcbcbcl',
    'lbcbcbe..................ecbdbcl',
    'lcbcbdbe..................ebcbcl',
    'lbdbcbe..................ebcbdcl',
    'lcbcbce..................ecbcbbl',
    'lbcbdbe.....ee......e....ebcbcbl',
    'lcbcbdeeee.ebceee..ebeeeeecbdbcl',
    'lbcbcbdbcbecbcbcbeecbcbcbcbcbcbl',
    'lcbdbcbbcabcbdbcbbcbcabcbdbcbbcl',
    'lbcbbcbdbcbbcbacbcbbcbdbcbbcbacl',
    'lcbcabcbbcbdbcbbcbcabcbbcbdbcbcl',
    'flbcbbcbdbcbbcbcbbcbdbcbbcbcbclf',
    'ffllllllllllllllllllllllllllllff',
]
# 안 모서리: 대각 칸만 바닥일 때 띠가 귀를 돌아 나간다.
A_CEIL_INNER = [
    'lcbcbce..ecbcbcl',
    'cbdbcbe..ebcbdbc',
    'bcbcbe....ebcbcb',
    'cbcbe......ebcbc',
    'bdbe........ebdb',
    'cbe..........ebc',
    'ee............ee',
    '................',
    '................',
    'ee............ee',
    'cbe..........ebc',
    'bdbe........ebdb',
    'cbcbe......ebcbc',
    'bcbcbe....ebcbcb',
    'cbdbcbe..ebcbdbc',
    'lcbcbce..ecbcbcl',
]
A_FLOOR = [
    '2222211220222552',
    '2522111122222255',
    '5552211112227225',
    '5522221112202222',
    '2220222222272222',
    '2222722222111122',
    '1222202221111112',
    '1122222221111012',
    '1122255222211122',
    '2222555522222202',
    '2722255522202222',
    '2202222222222272',
    '2222227222222022',
    '2211122222552222',
    '2111112225555222',
    '2221122202552222',
]
# 바닥 틀: 북쪽(앞면 밑) 그늘 2줄, 서쪽 벽 그늘 1~2열(빛이 왼쪽 위). 동·남은 몸통 그대로.
A_FLOOR_FRAME = (
    ['11011111101111011111011110111110',
     '1.1.1..1.1..1.1..1..1.1..1.1..1.']
    + ['1' + ('1' if y % 2 else '.') + '.' * 30 for y in range(2, 32)]
)
A_FLOOR_INNER = ['11' + '.' * 14, '1' + '.' * 15] + ['.' * 16] * 14

# 앞면 돌(손으로 찍은 돌 셋) — 16칸 주기로 감아 찍는다.
A_STONE_BIG = ['.54443..', '5433332.', '4333322.', '4332221.', '.322211.', '..1110..']
A_STONE_MED = ['.5443.', '543322', '433221', '.32211', '..110.']
A_STONE_SML = ['.44.', '4322', '.21.']


def a_face():
    cv = Cv(16, 32)
    bg = [
        '0000000000000000',
        '1111111121111111',
    ] + [
        ('1112111111111211' if y % 3 == 0 else '1111111111211111' if y % 3 == 1 else '1211111111111112')
        for y in range(2, 30)
    ] + ['1111111111111111', '0000000000000000']
    stamp(cv, bg, LA_FACE)
    for rows, x, y in ((A_STONE_BIG, 1, 1), (A_STONE_MED, 10, 2), (A_STONE_SML, 7, 7), (A_STONE_MED, 12, 8),
                       (A_STONE_BIG, 2, 10), (A_STONE_SML, 10, 13), (A_STONE_MED, 6, 16), (A_STONE_BIG, 12, 17),
                       (A_STONE_SML, 2, 23), (A_STONE_BIG, 6, 22), (A_STONE_MED, 14, 25), (A_STONE_SML, 3, 27)):
        wrap_stamp(cv, rows, LA_FACE, x, y)
    left = cap_cols(['0' * 32, '.1' + '.' * 29 + '0'])
    right = cap_cols(['0' * 32, '.' * 31 + '0'])
    return face_block(cv, LA_FACE, left, right)



def cave_a():
    ceil = autotile(grid(A_VOID, LA), A_CEIL_FRAME, A_CEIL_INNER, LA)
    floor = autotile(grid(A_FLOOR, LA), A_FLOOR_FRAME, A_FLOOR_INNER, LA)
    return {'ceil': ceil, 'face': a_face(), 'floor': floor}


# ================================================================================================ 후보 B — 바위 윗면
# 천장 대신 바윗덩이 윗면이 보인다(산 속 동굴). 회색 돌 램프: o p q r s h (어두움→밝음), 바닥 흙 0~7, 바닥색 f.
LB = legend(
    o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), h=('stone', 5),
    f=('cfloor', 1), F=('cfloor', 0),
    **{str(i): ('cfloor', i) for i in range(8)},
)
LB_FACE = legend(**{str(i): ('crock', i) for i in range(7)})
# 윗면 = 거친 바위 덩어리. 틈(p)이 비스듬히 흐르고 틈의 왼쪽 위만 빛(s), 아래쪽은 그늘(q). 틈은 가장자리에서 이어진다.
B_TOP = [
    'rrrrrqrrrrrrrrpr',
    'rrrrqprrrrrrrpqr',
    'rrrqpsrrrrrrpqrr',
    'rrqprrrrrrrpqrrr',
    'qqprrrrqrrrpqrrr',
    'pprrrrrrrrrrpqrr',
    'rrrrrrrrrrrrrrpp',
    'rrsrrrrqqrrrrrrq',
    'rrrrrrqpprrrrrrr',
    'rrrrrqpsrrrrsrrr',
    'rqrrqprrrrrrrrrr',
    'rrrqprrrrrrrqrrr',
    'rrqpsrrrrrrqprrr',
    'rrpqrrrrrrqpsrrr',
    'rrrpqrrrrqprrrrr',
    'rrrrprrrqprrrrrr',
]


# 윗면은 바닥보다 한 단 어둡게 — 글자를 한 단 내려 찍는다(r→q, s→r, q→p, p→o).
LB_TOP = legend(o=('stone', 0), p=('stone', 0), q=('stone', 1), r=('stone', 2), s=('stone', 3))


def b_top():
    return grid(B_TOP, LB_TOP)


# 테두리: 바닥과 만나는 북·서·동 가장자리는 어두운 윤곽 o(군데군데 들어간 홈), 동쪽은 그늘 q,
# 앞면 위 남쪽 가장자리는 빛 받는 턱 h s.
B_CEIL_FRAME = (
    ['fffooooooooffooooooffoooooooofff',
     'ffo........oo......oo........off',
     'fo............................of']
    + ['o' + '.' * 29 + ('q' if y % 2 else '.') + 'o' for y in range(3, 10)]
    + ['fo' + '.' * 28 + 'qo', 'fo' + '.' * 28 + '.o']
    + ['o' + '.' * 29 + ('q' if y % 2 else '.') + 'o' for y in range(12, 19)]
    + ['o' + '.' * 28 + 'qof', 'o' + '.' * 28 + '.of']
    + ['o' + '.' * 29 + ('q' if y % 2 else '.') + 'o' for y in range(21, 29)]
    + ['o' + 'r.s.r.rs.r.s.rs.r.s.r.rs.r.s.' + 'qo',
       'o' + 'srsrssrsrsrrsrssrsrsrsrssrsrs' + 'qo',
       'o' + 'hhshhhshhshhhshhshhhshhshhhsh' + 'ho']
)
B_CEIL_INNER = (['fo' + '.' * 12 + 'of', 'o' + '.' * 14 + 'o'] + ['.' * 16] * 12
                + ['.' * 16, 'o' + '.' * 14 + 'o'])
B_FLOOR = [
    '1111211111112111',
    '1121111012111111',
    '1111111111111211',
    '1211110111112111',
    '1111111211111110',
    '0111211111211111',
    '1111111111111121',
    '1112111101111111',
    '1111111111211111',
    '1211101111111211',
    '1111111121111111',
    '1101111111110111',
    '1111121111111111',
    '1211111112111121',
    '1111011111111111',
    '1111111211101111',
]
B_PEBBLE = ['.rr.', 'rrqq', '.qp.']
B_PEB_S = ['rq', 'qp']
B_FLOOR_FRAME = (
    ['00000000000000000000000000000000',
     '0.0.00.0.0.00.0..0.00.0.0.00.0.0',
     '0' + '.' * 31]
    + ['0' + ('0' if y % 2 else '.') + '.' * 30 for y in range(3, 32)]
)
B_FLOOR_INNER = ['000' + '.' * 13, '00' + '.' * 14, '0' + '.' * 15] + ['.' * 16] * 13
B_FACE_BIG = ['..5554..', '.555443.', '55444332', '54443332', '54433322', '54433322', '44333222', '.433222.',
              '.332221.', '..1111..']
B_FACE_MED = ['.5543.', '554432', '544332', '443322', '.33221', '..111.']
B_FACE_SML = ['.554.', '54432', '.3321', '..11.']


def b_floor():
    cv = grid(B_FLOOR, LB)
    for rows, x, y in ((B_PEBBLE, 2, 2), (B_PEBBLE, 10, 9), (B_PEB_S, 5, 12)):
        wrap2(cv, rows, LB, x, y)
    return cv


def b_face():
    cv = grid(['0000000000000000', '1111111111111111']
              + [('1101111111110111' if y % 4 == 0 else '1111111011111111' if y % 4 == 2 else '1' * 16)
                 for y in range(2, 30)] + ['1111111111111111', '0000000000000000'], LB_FACE)
    for rows, x, y in ((B_FACE_BIG, 0, 2), (B_FACE_MED, 9, 1), (B_FACE_SML, 7, 11), (B_FACE_MED, 11, 9),
                       (B_FACE_BIG, 3, 13), (B_FACE_SML, 13, 17), (B_FACE_MED, 10, 20), (B_FACE_BIG, 14, 22),
                       (B_FACE_SML, 1, 23), (B_FACE_MED, 5, 24)):
        wrap_stamp(cv, rows, LB_FACE, x, y)
    left = cap_cols(['0' * 32, '.1' + '.' * 29 + '0'])
    right = cap_cols(['0' * 32, '.' * 31 + '0'])
    return face_block(cv, LB_FACE, left, right)


def cave_b():
    ceil = autotile(b_top(), B_CEIL_FRAME, B_CEIL_INNER, LB)
    floor = autotile(b_floor(), B_FLOOR_FRAME, B_FLOOR_INNER, LB)
    return {'ceil': ceil, 'face': b_face(), 'floor': floor}


# ================================================================================================ 후보 C — 검푸른 층리
# 깊은 어둠 + 가는 울퉁불퉁 돌 테두리(화산암 램프 0~4), 가로 층리 앞면, 차가운 회색 자갈 바닥(판석 램프 a~g).
LC = legend(
    v=('void', 0),
    g=('cata', 3),
    **{str(i): ('vrock', i) for i in range(5)},
)
LC_FLOOR = legend(a=('cata', 0), b=('cata', 1), c=('cata', 2), d=('cata', 3), e=('cata', 4), f=('cata', 5), h=('cata', 6))


# ================================================================================================ 후보 C — 검푸른 층리
# 깊은 어둠 + 울퉁불퉁한 돌 혹 테두리(화산암 램프 0~4), 가로 층리 앞면, 차가운 회색 자갈 바닥(판석 램프 a~h).
LC = legend(v=('void', 0), g=('cata', 3), **{str(i): ('vrock', i) for i in range(5)})
LC_FLOOR = legend(a=('cata', 0), b=('cata', 1), c=('cata', 2), d=('cata', 3), e=('cata', 4), f=('cata', 5),
                  h=('cata', 6), **{str(i): ('cata', i) for i in range(7)})
# 혹 한 단위 = 8칸(가운데가 깊이 4, 끝 열은 깊이 2). 8·16·24 열·행은 늘 골짜기라 사분면을 바꿔 끼워도 이어진다.
C_N1 = ['23444432', '12333321', '.122221.', '..1111..']
C_N2 = ['23423432', '12211321', '.11..21.', '.....1..']
C_S1 = ['........', '..1111..', '.123321.', '13344331', '23333322']
C_S2 = ['........', '..1..1..', '.131.31.', '13431331', '23332322']
C_W1 = ['21...', '331..', '4321.', '4331.', '4321.', '4321.', '331..', '21...']
C_W2 = ['21...', '3321.', '431..', '21...', '331..', '4321.', '331..', '21...']
C_E1 = ['...12', '..123', '.1233', '.1233', '.1223', '.1233', '..123', '...12']
C_E2 = ['...12', '.1223', '..123', '...12', '..123', '.1233', '..122', '...12']
C_NW = ['gg344332', 'g3443321', '3443321.', '443321..', '43321...', '3321....', '321.....', '21......']
C_NE = ['233433gg', '1233332g', '.1233332', '..123333', '...12333', '....1233', '.....123', '......12']
C_SW = ['21......', '331.....', '4321....', '44321...', '433321..', '3344321.', '34443321', '23333322']
C_SE = ['......12', '.....123', '....1233', '...12333', '..132233', '.1343223', '13443323', '23333222']


def c_frame():
    """혹 단위를 이어 붙인 32×32 틀. 북·남·서·동 가운데는 서로 다른 혹 두 개(같은 혹 반복 금지)."""
    rows = []
    for y in range(8):
        mid = (C_N1[y] + C_N2[y]) if y < 4 else '.' * 16
        rows.append(C_NW[y] + mid + C_NE[y])
    for y in range(8, 24):
        w, e = (C_W1, C_E2) if y < 16 else (C_W2, C_E1)
        rows.append(w[y % 8] + '.' * 22 + e[y % 8])
    for y in range(24, 32):
        k = y - 27
        mid = (C_S2[k] + C_S1[k]) if k >= 0 else '.' * 16
        rows.append(C_SW[y - 24] + mid + C_SE[y - 24])
    return rows


C_CEIL_INNER = (['321.....' + '.....122', '21......' + '......12', '1.......' + '.......1']
                + ['.' * 16] * 10
                + ['1.......' + '.......1', '21......' + '......12', '321.....' + '.....122'])
C_FLOOR = [
    '3323332323332333',
    '2333233332333232',
    '3332333233233333',
    '3233323333332323',
    '3333333323333332',
    '2323233333323333',
    '3333332323333233',
    '3233333333233333',
    '3332323333333323',
    '2333333232333333',
    '3323333333332333',
    '3333233323333323',
    '2333333333233333',
    '3332333233333233',
    '3233323333323333',
    '3333333333333332',
]
C_PEB = ['.55.', '5444', '.411']
C_PEB_S = ['54', '41']
C_PEB_F = ['554', '411']
C_FLOOR_FRAME = (
    ['00000000000000000000000000000000',
     '1010110101101011010110101101011' + '0',
     '0' + '.' * 31]
    + ['0' + ('1' if y % 2 else '.') + '.' * 30 for y in range(3, 32)]
)
C_FLOOR_INNER = ['001' + '.' * 13, '01' + '.' * 14, '0' + '.' * 15] + ['.' * 16] * 13
C_FACE = [   # 굵은 층 셋, 물결치는 경계(0 틈 · 1 아랫면 그늘 · 4 윗턱 빛), 세로 금 하나
    '1111111111111111',
    '2222222222222222',
    '3332333333333233',
    '3333333323333333',
    '2333333333333332',
    '3333332223333333',
    '2233321112233332',
    '1122210001123321',
    '0011104440012210',
    '4400043334401104',
    '3344433333340043',
    '3333333333334433',
    '3333323333313333',
    '3233333333213333',
    '3333333333331323',
    '3332233333333333',
    '3221123333223333',
    '2110012332112233',
    '1004401221001122',
    '0443340110440011',
    '4333334004334400',
    '3333333443333344',
    '3323333333333333',
    '3333333233333323',
    '3322333332233333',
    '2211233221123332',
    '1100122110012221',
    '0044011004401110',
    '4433400443340004',
    '3333344333334443',
    '1111111111111111',
    '0000000000000000',
]


def c_floor():
    cv = grid(C_FLOOR, LC_FLOOR)
    for rows, x, y in ((C_PEB, 1, 1), (C_PEB, 9, 6), (C_PEB, 4, 11), (C_PEB, 12, 13), (C_PEB_S, 7, 2),
                       (C_PEB_S, 14, 9), (C_PEB_S, 2, 7), (C_PEB_S, 10, 14), (C_PEB_F, 12, 1), (C_PEB_F, 6, 8)):
        wrap2(cv, rows, LC_FLOOR, x, y)
    return cv


def c_face():
    cv = grid(C_FACE, LC)
    left = cap_cols(['0' * 32, '.' * 32])
    right = cap_cols(['0' * 32, '.' * 32])
    return face_block(cv, LC, left, right)


def cave_c():
    ceil = autotile(grid(A_VOID, LA), c_frame(), C_CEIL_INNER, LC)
    floor = autotile(c_floor(), C_FLOOR_FRAME, C_FLOOR_INNER, LC_FLOOR)
    return {'ceil': ceil, 'face': c_face(), 'floor': floor}


# ================================================================================================ 물 가장자리 (style.water)
# 물칸끼리만 이어진 것으로 본다. 북쪽 물가 = 바닥이 물로 떨어지는 짧은 앞면(3/4), 남·동·서 = 바닥 끝 턱.
LWA = legend(a=('water', 0), b=('water', 1), c=('water', 2), d=('water', 3), e=('water', 4),
             **{str(i): ('cfloor', i) for i in range(8)})
WA_BODY = [
    'bbccbbbbbbbbbbbb',
    'bbbbbbbbbabbbbbb',
    'bbbbbbecbbbbbbbb',
    'aabbbbbbbbbbccbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbccbbbbbbbbe',
    'bbbbbbbbbbbbaabb',
    'bccbbbbbbbbbbbbb',
    'bbbbbbbbbbccbbbb',
    'bbbbebbbbbbbbbbb',
    'bbbbbbbbbbbbbbcc',
    'bbaabbbbccbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbebbb',
    'ccbbbbbbbbbbbbbb',
    'bbbbbbbccbbbbbbb',
]
WA_FRAME = (
    ['5' * 32,
     '2' + '1' * 30 + '2',
     '2' + '0' * 30 + '2',
     '2' + 'a' * 29 + 'c2']
    + ['2a' + '.' * 28 + 'c2' for _ in range(4, 30)]
    + ['2a' + 'c' * 29 + '2',
       '1' * 32]
)
WA_INNER = (['55a' + '.' * 10 + 'a55', '10a' + '.' * 10 + 'a01', 'aa' + '.' * 13 + 'c']
            + ['.' * 16] * 10
            + ['c' + '.' * 14 + 'c', '2c' + '.' * 12 + 'c2', '11' + '.' * 12 + '11'])

LWB = legend(a=('pool', 0), b=('pool', 1), c=('pool', 2), d=('pool', 4), e=('pool', 5),
             o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3),
             **{str(i): ('cfloor', i) for i in range(8)})
WB_BODY = [
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbccbbbbb',
    'bbabbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbabb',
    'bbbbccbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'abbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbdbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbabbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbcccbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbab',
]
# 북쪽 물가 = 바위 둑 앞면(밝은 위턱 r q, 바위 p, 밑 그늘 o a). 혹은 8칸마다 같은 높이로 맞춘다.
WB_FRAME = (
    ['0rrqrrq00rqrrqr00rrqrqr00qrrqr00'.replace('0', 'r'),
     'qqpqqpqqqpqqpqqqqpqqpqqqqpqqpqqq',
     'ppopppoppppoppopppoppppoppopppop',
     'oooaoooooooaoooooooaoooooooaoooo',
     'oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao']
    + ['oa' + '.' * 29 + 'o' for _ in range(5, 30)]
    + ['oa' + 'c' * 29 + 'o',
       '1' * 32]
)
WB_INNER = (['rq' + '.' * 12 + 'qr', 'po' + '.' * 12 + 'op', 'oa' + '.' * 12 + 'ao', 'a' + '.' * 14 + 'a']
            + ['.' * 16] * 10 + ['c' + '.' * 14 + 'c', '1' + '.' * 14 + '1'])

LWC = legend(a=('water', 0), b=('water', 1), c=('water', 2), d=('water', 3), e=('water', 4),
             **{str(i): ('cata', i) for i in range(7)})
WC_BODY = [
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbcbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbcbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbcbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bcbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
]
# 얕은 물가: 둑 쪽으로 갈수록 밝아지는 띠(c → d), 북쪽은 판석 둑 앞면(5 위턱 · 2 · 1 · 0)과 그늘 a.
WC_FRAME = (
    ['5' * 32,
     '2' * 32,
     '1' * 32,
     '0' + 'a' * 30 + '0',
     '0' + 'b' * 29 + 'd0']
    + ['0dc' + '.' * 26 + 'cd0' if y % 3 else '0dc' + '.' * 25 + 'ccd0' for y in range(5, 28)]
    + ['0dcc' + 'c' * 24 + 'ccd0',
       '0d' + 'cbcbccbcbcccbcbcbcccbcbccbcb' + 'd0',
       '0' + 'd' * 30 + '0',
       '1' * 32]
)
WC_INNER = (['520' + '.' * 10 + '025', '10a' + '.' * 10 + 'a01', 'ab' + '.' * 12 + 'ba']
            + ['.' * 16] * 10
            + ['cc' + '.' * 12 + 'cc', 'dc' + '.' * 12 + 'cd', '1d' + '.' * 12 + 'd1'])


def water_set(letter):
    if letter == 'A':
        return autotile(grid(WA_BODY, LWA), WA_FRAME, WA_INNER, LWA)
    if letter == 'B':
        return autotile(grid(WB_BODY, LWB), WB_FRAME, WB_INNER, LWB)
    return autotile(grid(WC_BODY, LWC), WC_FRAME, WC_INNER, LWC)


POOL_GRID = [
    '##########',
    '##########',
    '##########',
    '#........#',
    '#..www...#',
    '#.wwwww..#',
    '#..ww.w..#',
    '##.......#',
    '##########',
]


def water_candidate(letter):
    def fn():
        cave = CAVES[letter]()
        wat = water_set(letter)
        vign = dot.render_cave(POOL_GRID, cave['ceil'], cave['face'], cave['floor'], water=wat)
        meta = {'kind': 'autotile', 'vignette': vign, 'grid': POOL_GRID, 'autotiles': {'water': wat},
                'context': '바닥·벽은 같은 글자 동굴 후보(맥락)'}
        return a2_block(wat), meta
    return fn


# ================================================================================================ 내려가는 계단 2×2 (style.stairs_down)
# 북쪽(멀리)으로 내려간다. 디딤판은 윗면만 보이고 멀수록(위로 갈수록) 어둡다. 사람이 남쪽 끝에서 들어선다.
LSA = legend(c=('rim', 2), b=('rim', 3), d=('rim', 1), l=('rim', 6), v=('void', 0),
             W=('crock', 1), X=('crock', 2), Y=('crock', 3), Z=('crock', 4),
             o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), h=('stone', 5))


def _rows_in(frame_l, frame_r, inner):
    return [frame_l + r + frame_r for r in inner]


STAIRS_A = (
    ['cbcdcbccbcdcbccbcdcbccbcdcbccbcd',
     'cbbcbdbcbbcbdbcbbcbdbcbbcbdbcbbc',
     'cbllllllllllllllllllllllllllllbc']
    + _rows_in('cbl', 'lbc', [
        'WWWWWWWWWWWWWWWWWWWWWWWWWW',
        'YZYYXYYZYYYXYZYYYXYYZYYXYY',
        'XYYXXYXYYXYXXYYXYYXYXXYXYX',
        'XXWXXXXXWXXXXXXWXXXXXWXXXX',
        'WWWWWWWWWWWWWWWWWWWWWWWWWW',
        'vvvvvvvvvvvvvvvvvvvvvvvvvv',
        'vvvvvvvvvvvvvvvvvvvvvvvvvv',
        'oooooooooooooooooooooooooo',
        'oopppppppppppqpppppppppppp',
        'oppppqppppppppppppppqppppp',
        'oopppppppppppppppppppppppp',
        'oooooooooooooooooooooooooo',
        'opqqqqqqqrqqqqqqqqqqqrqqqq',
        'opqqqqqqqqqqqqqrqqqqqqqqqq',
        'oppqqqqqqqqqqqqqqqqqqqqqqq',
        'oopppppppppppppppppppppppp',
        'oqrrrrrsrrrrrrrrrrsrrrrrrr',
        'oqrrrrrrrrrrrrsrrrrrrrrrrr',
        'oqqrrrrrrrrrrrrrrrrrrrrrrr',
        'opqqqqqqqqqqqqqqqqqqqqqqqq',
        'orssssshssssssssssshssssss',
        'orssssssssssssshssssssssss',
        'orrsssssssssssssssssssssss',
        'opqqqqqqqqqqqqqqqqqqqqqqqq',
        'oshhhhhhhhshhhhhhhhhhhhshh',
        'oshhhhhshhhhhhhhhhshhhhhhh',
        'oshhhhhhhhhhhhhhhhhhhhhhhh',
        'osssssssssssssssssssssssss',
        'orrrrrrrrrrrrrrrrrrrrrrrrr',
    ])
)

LSB = dict(LB, v=dot.C('void', 0))
STAIRS_B = [
    '11112111111101111111211111111211',
    '12111111211111111111111121111111',
    '111oooooooooooooooooooooooooo111',
    '11oqrrqrrqrqrrqrrqrrqrqrrqrrqo11',
] + _rows_in('1o', 'o1', [
    'qqpqqqpqqpqqqpqqpqqqpqqqpqqq',
    'pppoppppoppppopppoppppoppppp',
    'vvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvvvvvvvvvvvvvv',
    'ooovvoooooooovvvooooooooovvo',
    'oppppppppqppppppppppqppppppo',
    'opppqpppppppppqppppppppppppv',
    'oopppppppppppppppppppppppppo',
    'ooooooooqoooooooooooqooooooo',
    'oqqqqqrqqqqqqqqqqrqqqqqqqqqo',
    'oqqqqqqqqqqqrqqqqqqqqqqqqqqo',
    'opqqqqqqqqqqqqqqqqqqqqqrqqqo',
    'ooppqqpppqqpppppqqpppppqqppo',
    'oooooooooooorooooooooooooooo',
    'oqrrrrsrrrrrrrrrrrrsrrrrrrro',
    'oqrrrrrrrrrrrrsrrrrrrrrrrrro',
    'oqrrrrrrrrrrrrrrrrrrrrrsrrro',
    'oqqrrqqqrrqqqqrrrqqqrrqqrrqo',
    'oooooooooosoooooooooooooooso',
    'orsssshssssssssssshsssssssso',
    'orssssssssssshssssssssssssso',
    'orsssssssssssssssssssshsssso',
    'orsssshssssssssssssssssssso1'[:-1] + 'o',
    'orrssrrrssrrrsssrrrssrrrsrro',
    'oqqqqqqqqqqqqqqqqqqqqqqqqqqo',
    'oooooooooooooooooooooooooooo',
]) + [
    '11o0oo1o0o0oo1oo0oo1o0oo0oo0o011'.replace('0', '1'),
    '12111111121111111112111111121111',
]

LSC = legend(a=('cata', 0), b=('cata', 1), c=('cata', 2), d=('cata', 3), e=('cata', 4), f=('cata', 5), g=('cata', 6),
             v=('void', 0), **{str(i): ('vrock', i) for i in range(5)})
_PL = 'affeb'     # 왼쪽 난간 윗면(바깥 윤곽 a · 빛 받는 윗면 f e · 안쪽 그늘 b)
_PR = 'ceefa'
STAIRS_C = (
    ['affgfb' + '22222222222222222222' + 'cfgffa',
     'affffb' + '34443344434434444334' + 'ceffea',
     'aefffb' + '33333333333333333333' + 'ceffea',
     'affeeb' + '33233332333333233333' + 'cefffa',
     'afeffb' + '22222222222222222222' + 'ceefea',
     'affffb' + '11111111111111111111' + 'cfeffa',
     'affeeb' + '00000000000000000000' + 'ceffea',
     'aefffb' + 'vvvvvvvvvvvvvvvvvvvv' + 'cfeffa',
     'affffb' + 'vvvvvvvvvvvvvvvvvvvv' + 'ceffea',
     'affefb' + 'aaaaaaaaaaaaaaaaaaaa' + 'cefffa',
     'afeffb' + 'abbbbbbbbbbbbbbbbbbb' + 'ceeffa',
     'affffb' + 'abbbbbbcbbbbbbbbbcbb' + 'cfeffa',
     'affeeb' + 'aaaaaaaaaaaaaaaaaaaa' + 'ceffea',
     'aefffb' + 'abcccccccccdccccccccc'[:20] + 'ceffea',
     'affffb' + 'abcccdcccccccccccccc' + 'cfeffa',
     'affefb' + 'aaabbbbbbbbbbbbbbbbb' + 'cefffa',
     'afeffb' + 'acdddddddeddddddddde' + 'ceeffa',
     'affffb' + 'acddddddddddddedddd d'.replace(' ', '') + 'cfeffa',
     'affeeb' + 'abcccccccccccccccccc' + 'ceffea',
     'aefffb' + 'adeeeeeeeeeefeeeeeee' + 'ceffea',
     'affffb' + 'adeeeeefeeeeeeeeeeee' + 'cfeffa',
     'affefb' + 'acdddddddddddddddddd' + 'cefffa',
     'afeffb' + 'aefffffffffgffffffff' + 'ceeffa',
     'affffb' + 'aeffffgfffffffffffgf' + 'cfeffa',
     'affeeb' + 'adeeeeeeeeeeeeeeeeee' + 'ceffea',
     'aefffb' + 'afggggggggfggggggggg' + 'ceffea',
     'affffb' + 'afgggfgggggggggggfgg' + 'cfeffa',
     'affefb' + 'afgggggggggggggggggg' + 'cefffa',
     'acccca' + 'aeffffffffffffffffff' + 'acccca',
     'acbcca' + 'adeeeeeeeeeeeeeeeeee' + 'accbca',
     'abbbba' + 'adeeeeeeeeeeeeeeeeee' + 'abbbba',
     'aaaaaa' + 'acdddddddddddddddddd' + 'aaaaaa']
)


def stairs_candidate(letter):
    def fn():
        rows, leg = {'A': (STAIRS_A, LSA), 'B': (STAIRS_B, LSB), 'C': (STAIRS_C, LSC)}[letter]
        cv = grid(rows, leg, 32, 32)
        cave = CAVES[letter]()
        g = ['#########', '#########', '#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########']
        vign = dot.render_cave(g, cave['ceil'], cave['face'], cave['floor'])
        vign.paste(cv, 3 * 16, 4 * 16)
        return cv, {'kind': 'tile', 'vignette': vign, 'context': '바닥·벽은 같은 글자 동굴 후보(맥락)'}
    return fn


# ================================================================================================ 벽돌 벽의 문 (style.door)
# 맥락 벽돌 앞면(후보 아님 — built 묶음에서 따로 고른다): 8×4 벽돌, 한 줄씩 4칸 엇갈림, 16칸 주기.
LBR = legend(**{str(i): ('brick', i) for i in range(7)})
_C1 = ['1111111111111111', '1555455515545555', '1443444314443434', '1333333313332333']
_C2 = ['1111111111111111', '5515554555155455', '4314434444314443', '3313333333313333']
BRICK_FACE = ['0000000000000000'] + (_C1 + _C2) * 3 + _C1 + ['1111111111111111', '2222222222222222', '0000000000000000']


def brick_face():
    cv = grid(BRICK_FACE, LBR)
    return face_block(cv, LBR, cap_cols(['0' * 32]), cap_cols(['0' * 32]))


LDOOR = legend(o=('stone', 0), p=('stone', 1), q=('stone', 2), r=('stone', 3), s=('stone', 4), h=('stone', 5),
               W=('wood', 0), X=('wood', 1), Y=('wood', 2), Z=('wood', 3), U=('wood', 4), T=('wood', 5),
               n=('iron', 0), i=('iron', 1), j=('iron', 3), k=('iron', 4), v=('void', 0),
               G=('gold', 4), H=('gold', 2),
               a=('cata', 0), b=('cata', 1), c=('cata', 2), d=('cata', 3), e=('cata', 4), f=('cata', 5), g=('cata', 6))


def _pad(rows, left, width=32):
    return [('.' * left + r).ljust(width, '.') for r in rows]


# A: 둥근 아치 나무문(한 칸 반 폭) — 쇠띠 둘·쇠고리
_LEAF = 'oUZXUZXUZXUo'
DOOR_A = ['.' * 32] * 3 + _pad([
    '....oorrssrroo....',
    '..oorsshhssrroo...',
    '.orshoWWWWWWohrqo.',
    'orshoXYYYYYYXoqrqo',
] + ['orsh' + ('oUZXUZXUZXo' if y % 2 else 'oZUXZUXZUXo')[:10] + 'srqo' for y in range(7, 11)]
  + ['orsh' + 'ojjjjjjjjo' + 'srqo', 'orsh' + 'oiiiiiiiio' + 'srqo']
  + ['orsh' + 'oUZXUZXUZo' + 'srqo' for _ in range(13, 17)]
  + ['orsh' + 'oUZXUkjUZo' + 'srqo', 'orsh' + 'oUZXUijUZo' + 'srqo']
  + ['orsh' + 'oUZXUZXUZo' + 'srqo' for _ in range(19, 22)]
  + ['orsh' + 'ojjjjjjjjo' + 'srqo', 'orsh' + 'oiiiiiiiio' + 'srqo']
  + ['orsh' + 'oUZXUZXUZo' + 'srqo' for _ in range(24, 30)]
  + ['orsh' + 'oWWWWWWWWo' + 'srqo', 'orrrrrrrrrrrrrrrro.'[:18]], 7)

# B: 쇠창살문(아치, 1.5칸 폭) — 창살 사이로 안쪽 어둠
_BARS = 'vkjvvvkjvvvkjvvvkj'
DOOR_B = (['.' * 32,
           '.........oorrrssssrrroo.........',
           '......oorrsshhhhhhhhssrroo......',
           '....orsshhovvvvvvvvvvohhssro....',
           '...orshhovvvvvvvvvvvvvvohhsro...',
           '..orsho' + 'v' * 18 + 'oqqro..']
          + ['..orsho' + ('jjjjjjjjjjjjjjjjjj' if y in (10, 20) else 'iiiiiiiiiiiiiiiiii' if y in (11, 21) else _BARS) + 'oqqro..'
             for y in range(6, 29)]
          + ['..orsho' + 'vkvvvvkvvvvkvvvvkv' + 'oqqro..',
             '..orsho' + 'vvvvvvvvvvvvvvvvvv' + 'oqqro..',
             '..o' + 'r' * 26 + 'o..'])

# C: 평평한 상인방 아래 쌍여닫이(두 칸 가까이) — 판석 상인방·문설주, 금고리
_PL1 = 'WYZUZYZUZW'
DOOR_C = (['.' * 32, '.' * 32,
           '...' + 'o' * 26 + '...',
           '...o' + 'g' * 24 + 'o...',
           '...o' + 'feffefffeffffeffefffeffe' + 'o...',
           '...o' + 'dddcdddddcddddddcdddddcd' + 'o...',
           '...o' + 'cdddddcddddddcddddcddddd' + 'o...',
           '...o' + 'cccccccccccccccccccccccc' + 'o...',
           '...' + 'o' * 26 + '...']
          + ['...ofd' + ('WjjjjjjjjW' * 2 if y in (12, 24) else 'WiiiiiiiiW' * 2 if y in (13, 25)
                         else 'WYZUZYZUGW' + 'WGZUZYZUZW' if y == 18 else 'WYZUZYZUHW' + 'WHZUZYZUZW' if y == 19
                         else _PL1 * 2) + 'cbo...' for y in range(9, 30)]
          + ['...o' + 'e' * 24 + 'o...', '...o' + 'c' * 24 + 'o...'])


def door_insert(rows):
    """맥락 벽돌 앞면 2×2(32×32) 위에 문 행을 덮는다. '.' = 벽돌."""
    cv = Cv(32, 32)
    cv.a[:, 0:16] = grid(BRICK_FACE, LBR).a
    cv.a[:, 16:32] = grid(BRICK_FACE, LBR).a
    return stamp(cv, rows, LDOOR)


def door_candidate(letter):
    def fn():
        rows = {'A': DOOR_A, 'B': DOOR_B, 'C': DOOR_C}[letter]
        cv = door_insert(rows)
        cave = CAVES[letter]()
        g = ['########', '########', '########', '#......#', '#......#', '#......#', '########']
        vign = dot.render_cave(g, cave['ceil'], brick_face(), cave['floor'])
        vign.paste(cv, 3 * 16, 1 * 16)
        return cv, {'kind': 'face-insert', 'vignette': vign,
                    'context': '벽돌 앞면은 맥락(후보 아님), 천장·바닥은 같은 글자 동굴 후보'}
    return fn


# ================================================================================================ 보물상자 + 횃불 (style.chest_torch)
# 윗층 기물. 빛은 왼쪽 위, 바닥 그림자 '~'. 상자는 뚜껑 윗면 3줄 이상.
LOBJ = legend(W=('wood', 0), X=('wood', 1), Y=('wood', 2), Z=('wood', 3), U=('wood', 4), T=('wood', 5),
              n=('iron', 0), i=('iron', 1), j=('iron', 3), k=('iron', 4),
              G=('gold', 4), H=('gold', 2),
              A=('fire', 0), B=('fire', 1), C=('fire', 2), D=('fire', 3), E=('fire', 4), F=('fire', 5),
              o=('gold', 0), **{str(i): ('gold', i) for i in range(1, 6)},
              P=('red', 0), Q=('red', 1), R=('red', 2), S=('red', 3), V=('red', 4),
              a=('cata', 0), b=('cata', 1), c=('cata', 2), d=('cata', 3), e=('cata', 4), f=('cata', 5), g=('cata', 6),
              q=('vrock', 0), r=('vrock', 1), s=('vrock', 2), t=('vrock', 3), u=('vrock', 4),
              L=('glow', 2), M=('glow', 5))
CHEST_A = [
    '................',
    '..WWWWWWWWWWWW..',
    '.WTTjTTTTTTjTTW.',
    '.WTUjUTUUTUjUTW.',
    '.WUUjUUUUUUjUUW.',
    '.WZZiZZZZZZiZZW.',
    '.WWWnWWWWWWnWWW.',
    '.WYYjYYGGYYjYYW.',
    '.WYZjZZHGZZjZYW.',
    '.WYZjZZZZZZjZYW.',
    '.WXYiYYYYYYiYXW.',
    '.WXXiXXXXXXiXXW.',
    '.WWWWWWWWWWWWWW.',
    '..~~~~~~~~~~~~~.',
    '................',
    '................',
]
TORCH_A = [   # 벽걸이 횃불 — 앞면에 붙인다
    '................',
    '.......D........',
    '......DE........',
    '......EFD.......',
    '.....DFFE.......',
    '.....EFFED......',
    '.....BEFEB......',
    '......BDB.......',
    '.....nWYWn......',
    '......WZW.......',
    '......WYW.......',
    '....njjjjjn.....',
    '......nkn.......',
    '......nin.......',
    '.......n........',
    '................',
]
CHEST_B = [   # 금테 두른 붉은 상자, 둥근 뚜껑
    '................',
    '...oooooooooo...',
    '..o5444444445o..',
    '.o3VSSSSSSSSV3o.',
    '.o3SSRSSSSRSS3o.',
    '.o2RRRRRRRRRR2o.',
    '.o144444444441o.',
    '.o111111111111o.',
    '.o3QQQ3443QQQ3o.',
    '.o3QQQ3o13QQQ3o.',
    '.o3PQQ3443QQP3o.',
    '.o3PPPPPPPPPP3o.',
    '.o233333333332o.',
    '..oooooooooooo..',
    '...~~~~~~~~~~~~.',
    '................',
]
TORCH_B = [   # 바닥에 세우는 쇠 화로
    '.......E........',
    '......EF........',
    '.....DFFE.......',
    '....DEFFED......',
    '....BDEFEDB.....',
    '...BCDDEDDCB....',
    '..nkjjjjjjjjin..',
    '..njiiiiiiiijn..',
    '...nijjjjjjin...',
    '....nniiiinn....',
    '......nijn......',
    '......nijn......',
    '.....njijjn.....',
    '....nj.nn.jn....',
    '...nn..~~..nn~..',
    '................',
]
CHEST_C = [   # 쇠띠 두른 돌 궤, 청록 보석 자물쇠
    '................',
    '..qqqqqqqqqqqq..',
    '.qutuuuuuuuutuq.',
    '.qkkkkkkkkkkkkq.',
    '.qtuttttutttutq.',
    '.qssssssssssssq.',
    '.qjjjjjjjjjjjjq.',
    '.qiiiiiiiiiiiiq.',
    '.qtjsttLLttsjtq.',
    '.qsjssLMMLssjsq.',
    '.qsjsssLLsssjsq.',
    '.qrjrrrrrrrrjrq.',
    '.qqqqqqqqqqqqqq.',
    '..~~~~~~~~~~~~~.',
    '................',
    '................',
]
TORCH_C = [   # 돌 받침 벽 횃불
    '................',
    '.......D........',
    '......DE........',
    '......EFD.......',
    '.....DFFED......',
    '.....BEFEB......',
    '....agfffga.....',
    '....adeeeda.....',
    '.....adeda......',
    '......ada.......',
    '......aca.......',
    '.....abcba......',
    '......aaa.......',
    '................',
    '................',
    '................',
]
PAIRS = {'A': (CHEST_A, TORCH_A, 'wall'), 'B': (CHEST_B, TORCH_B, 'floor'), 'C': (CHEST_C, TORCH_C, 'wall')}


def chest_torch(letter):
    ch, tr, _ = PAIRS[letter]
    return grid(ch, LOBJ, 16, 16), grid(tr, LOBJ, 16, 16)


def chest_candidate(letter):
    def fn():
        chest, torch = chest_torch(letter)
        cv = Cv(32, 16)
        cv.paste(chest, 0, 0)
        cv.paste(torch, 16, 0)
        cave = CAVES[letter]()
        g = ['########', '########', '########', '#......#', '#......#', '#......#', '########']
        vign = dot.render_cave(g, cave['ceil'], cave['face'], cave['floor'])
        vign.paste(chest, 3 * 16 + 8, 4 * 16)
        if PAIRS[letter][2] == 'wall':
            vign.paste(torch, 2 * 16, 1 * 16 + 6)
            vign.paste(torch, 5 * 16, 1 * 16 + 6)
        else:
            vign.paste(torch, 1 * 16, 3 * 16)
            vign.paste(torch, 6 * 16, 3 * 16)
        return cv, {'kind': 'objects', 'parts': {'chest': chest, 'torch': torch}, 'vignette': vign,
                    'torch_mount': PAIRS[letter][2], 'top_rows': {'chest': [2, 4] if letter != 'B' else [2, 5]}}
    return fn


# ================================================================================================ 조립·후보 표
CAVE_GRID = [
    '##########',
    '##########',
    '##########',
    '###...####',
    '#.....##.#',
    '#........#',
    '##.##....#',
    '##########',
]


def cave_sheet(parts):
    """후보 원본(해시 대상): [천장 A2 32×48][앞면 32×32(아래)][바닥 A2 32×48] = 96×48."""
    cv = Cv(96, 48)
    cv.paste(a2_block(parts['ceil']), 0, 0)
    cv.paste(parts['face'].b, 32, 16)
    cv.paste(a2_block(parts['floor']), 64, 0)
    return cv


def cave_candidate(make):
    def fn():
        parts = make()
        vign = dot.render_cave(CAVE_GRID, parts['ceil'], parts['face'], parts['floor'])
        meta = {'kind': 'cave-set', 'parts': parts, 'vignette': vign, 'grid': CAVE_GRID,
                'autotiles': {'ceil': parts['ceil'], 'floor': parts['floor']}, 'faces': {'face': parts['face']}}
        return cave_sheet(parts), meta
    return fn


CAVES = {'A': cave_a, 'B': cave_b, 'C': cave_c}

CANDIDATES = {
    'style.cave': {k: cave_candidate(v) for k, v in CAVES.items()},
    'style.water': {k: water_candidate(k) for k in 'ABC'},
    'style.stairs_down': {k: stairs_candidate(k) for k in 'ABC'},
    'style.door': {k: door_candidate(k) for k in 'ABC'},
    'style.chest_torch': {k: chest_candidate(k) for k in 'ABC'},
}
