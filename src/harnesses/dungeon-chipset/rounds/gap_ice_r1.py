"""gap-ice-r1 — 얼음 동굴 두 조각(줄 공통). 항목 gap.ice_floor(얼음 바닥 ↔ 얼음굴 바닥) · gap.ice_rock(얼음 바위 채움: 서리 윗면 + 언 바위 앞면).

조수는 지금 버들항 칩셋으로 얼음 동굴을 아예 못 짓는다(거부한다). 이 판의 두 조각 + 얼음굴 바닥(얼음 바닥 오토타일의 바깥,
meta 'autotiles' 의 ground)으로 얼음 동굴 한 벌이 된다. 얼음은 세 줄 어디에도 속하지 않는 별도 재료라 후보는 A1·A2 두 벌.

  A1 「빙하」 — 바닥 = 차가운 회청색 자갈(vrock: 바탕 2 · 덩이 1·3 · 돌은 빛 6·4 → 3 → 그늘 1, 돌 사이 서리 I).
                얼음 = 한 단 낮은 빙하 얼음(ice 1 바탕, 가운데로 깊은 ice 0 자리, 북·서 쪽 옅은 광택 띠, 긴 금·기포 무리는 변형).
                가장자리 = 바닥과 얼음 사이 어두운 녹은 물 줄(k) + 얇게 솟은 얼음 턱(북·서 밝음 P, 남·동 그늘 Q).
                벽 윗면 = 서리 낀 회색 판돌(crock 5 바탕, 판마다 왼·위 서리 6·Z, 오른·아래 4, 금 2·3 속 눈 S), 바닥 쪽 가장자리는 깨진 돌 끝 + 서리.
                앞면 = 처마 끝 밝은 서리 턱에서 길이가 제각각인 고드름이 매달리고(대부분 짧고 몇 개만 길다) 사이로 바위가 보인다.
  A2 「청빙」 — 바닥 = 얼어 갈라진 검푸른 흙(iron 1 바탕, 손으로 그은 금 o + 빛 받는 턱 h, 서리 딱지 G·F).
                얼음 = 밝고 탁한 판 얼음(iron 5 서리빛 바탕에 ice 2 푸른 자리, 광택 띠·하얀 균열면·불투명 서리 무리는 변형).
                가장자리 = 바닥에 핀 서리 술(X) + 한 겹 턱(북·서 밝음 P, 남·동 그늘 Q). 이중 테 없음.
                벽 윗면 = 서리 앉은 검푸른 화산암(vrock 3 바탕, 4·F 빛 면, 2 그늘, 금 1 + 서리 턱).
                앞면 = 밝은 서리 턱 아래 가는 서리 고드름(제각각), 결정은 벽 줄의 왼끝 마구리에 한 무리만(드문 강조).

모든 화소는 이 파일의 행 문자열·손으로 고른 덧그림 자리·손으로 찍은 금 꼭짓점에서 온다(손 도트). 조립 도구는 cave-r1·edges-r1 것.
  - 틀 = 32×32 기호 틀 + 16×16 안 모서리 + 16×16 몸통. ',' = 그 칸 자리의 얼음굴 바닥 화소, 대문자 결 글자는 칸 좌표 16×16 결 표.
  - 몸통 변형 = 본바탕 + 칸 경계를 넘는 공통 덧그림 + 변형마다 다른 안쪽 덧그림(둘레 밖) — 아무 순서로 붙어도 이어진다.
  - 가장자리 굴곡은 손으로 적은 표(사분면 경계 0). 한 변의 두 토막 모양을 서로 다르게 해 같은 물결이 반복돼 보이지 않게.
  - 3/4: 바위 윗면 → 남쪽 앞면 2단(32px). 옆면 없음. 빛은 왼쪽 위. 먹 윤곽 없이 재질 명암.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
from cave_r1 import (autotile_cv, check_frame, face_run, floor_frame, frame, hcat,  # noqa: E402
                     strips, variants_sheet, a2_plus)
from edges_r1 import fill, inner4, uni, wobble  # noqa: E402
from dot import Cv, grid, legend  # noqa: E402

WAVE = 'gap'
T = 16


# ================================================================================================ 도구
def sq(rows, w=16, h=16, name=''):
    assert len(rows) == h and all(len(r) == w for r in rows), (name, len(rows), [len(r) for r in rows])
    return rows


def stamp(rows, sprites, wrap=True, inner=False):
    """행 + 손 덧그림 [(행, x, y)] ('.' = 그대로). wrap = 16 주기로 감김. inner = 둘레 1px 안(1~14)에만 — 변형끼리 이어지게."""
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    for sp, x, y in sprites:
        for dy, r in enumerate(sp):
            for dx, ch in enumerate(r):
                if ch == '.':
                    continue
                X, Y = x + dx, y + dy
                if inner:
                    assert 1 <= X <= w - 2 and 1 <= Y <= h - 2, f'안쪽 덧그림 ({X},{Y}) 이 둘레에 닿았다'
                if wrap:
                    X, Y = X % w, Y % h
                g[Y][X] = ch
    return [''.join(r) for r in g]


def body_set(base, common, variants, leg):
    """본몸통 + 변형 — 모두 base + common(칸 경계를 넘어도 됨) 위에 각자의 안쪽 덧그림."""
    root = stamp(base, common)
    return [grid(stamp(root, v, inner=True), leg) for v in variants]


def face_from(mid, left, right, leg):
    """앞면 가운데 16×32(16칸 주기) + 끝 마구리 덧그림 [(행, x, y)](x 0~7 = 마구리 칸 안) → dot.Face."""
    sq(mid, 16, 32, 'face')
    cv = Cv(32, 32)
    p = grid(mid, leg, 16, 32)
    cv.paste(p, 8, 0)
    cv.paste(p.crop(0, 0, 8, 32), 0, 0)
    cv.paste(p.crop(8, 0, 8, 32), 24, 0)
    for ox, sps in ((0, left), (24, right)):
        for sp, x, y in sps:
            for dy, r in enumerate(sp):
                for dx, ch in enumerate(r):
                    if ch != '.':
                        assert 0 <= x + dx < 8, (x, dx)
                        cv.put(ox + x + dx, y + dy, leg[ch])
    return dot.Face(cv)


def col(s):
    return [c for c in s]


def check_wob(p):
    for k, v in p.items():
        assert len(v) == 32 and all(v[i] == 0 for i in (0, 7, 8, 15, 16, 23, 24, 31)), k
    return p


# ================================================================================================ A1 「빙하」
# 글자: 얼음 d m b c W = ice 0~4 · 서리 I = iron 5 · 눈 S = rim 6 · 밝은 서리 Z = stone 5
#       바닥 a s g p = vrock 1~4(242c38 384454 566577 7a7f86) · 녹은 물 줄 k = vrock 1 · 바위 1~6 = crock 1~6
L1 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            I=('iron', 5), S=('rim', 6), Z=('stone', 5), k=('vrock', 1),
            a=('vrock', 1), s=('vrock', 2), g=('vrock', 3), p=('vrock', 4),
            **{str(i): ('crock', i) for i in range(1, 7)})

# ---- 얼음굴 바닥 — 회청색 자갈. 바탕 s, 젖은 덩이 a, 마른 덩이 g. 돌: 왼·위 빛 6·p, 몸 g, 아래 그늘 a.
G1_BASE = sq([
    'ssssassssssssgss', 'ssaaaassssgggsss', 'sssaasssssggsssa', 'ssssssssssssssaa',
    'asssssssssssssss', 'aasssggssssassss', 'sssssgggsssaasss', 'ssssssgsssaaasss',
    'sssssssssssassss', 'ssgssssssssssssg', 'sgggsssassssgggs', 'ssgssaaaasssssgs',
    'sssssssaasssssss', 'ssssssssssssssss', 'ssasssssssgsssss', 'saaassssssggssss'], name='G1')
PA = ['.6pp.', '6ppgg', 'pggga', '.gaa.']          # 큰 돌
PB = ['.6p.', '6pgg', 'pgga', '.aa.']              # 중간 돌
PC = ['6p.', 'pga', '.a.']                         # 작은 돌
PD = ['.6ppp.', 'pppggg', '.aaaa.']                # 납작 돌
PE = ['p', 'a']                                    # 잔돌
FR = ['I']
FR2 = ['I.', 'II']
FR3 = ['.I', 'I.']
G1_COMMON = [(PB, 14, 13), (PC, 7, 15), (FR, 0, 7), (PE, 15, 3)]          # 칸 경계를 넘는 돌(모든 몸통 같음)
G1_VARS = [
    [(PA, 3, 3), (PC, 10, 2), (PD, 7, 9), (FR2, 9, 6), (FR, 2, 10), (PE, 5, 12), (FR, 12, 11)],
    [(PD, 2, 4), (PB, 9, 7), (PC, 4, 10), (FR2, 7, 3), (FR, 11, 12), (PE, 12, 3)],
    [(PC, 3, 2), (PA, 7, 6), (PE, 11, 3), (PB, 2, 10), (FR, 12, 11), (FR3, 5, 5)],
    [(PB, 4, 4), (PD, 6, 10), (PC, 11, 5), (FR2, 2, 8), (FR, 9, 3), (PE, 12, 12)],
]
G1_N = [3, 3, 3, 4, 4, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 4, 4, 3, 3, 3, 3, 2, 2, 3, 3, 3]
G1_W = [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2]
G_INNER = (['12......' + '....2111', '22......' + '......22', '2.......' + '.......2']
           + ['.' * 16] * 10 + ['.' * 16, '1.......' + '.' * 8, '12......' + '.' * 8])

# ---- 얼음 몸통 — ice 1 바탕, 깊은 ice 0 덩이(부드럽게), 옅은 광택 점 b 는 드물게.
ICE1_MAIN = sq(['m' * 16] * 4 + ['mmmmmmmmmmmmdmmm'] + ['m' * 16] * 6 + ['mmmdmmmmmmmmmmmm'] + ['m' * 16] * 4, name='ICE1')
# 깊은 자리·금·기포·광택은 변형마다 다른 자리에 — 칸을 해시로 고르므로 격자 무늬가 생기지 않는다.
ICE1_VARS = [
    [],
    [(['..dd..', '.dddd.', 'ddddd.', '.ddd..'], 3, 4), (['dd', '.d'], 10, 10)],                     # 깊은 자리 A
    [(['Wc..........', '.dWc........', '..ddWcc.....', '.....dddWc..', '........ddWc', '..........dd'], 2, 4),
     (['W.', 'dc', '.d'], 6, 9)],                                                            # 긴 금(위 빛 · 아래 그늘) + 곁금
    [(['bc', '.b'], 4, 5), (['c'], 7, 4), (['bc'], 6, 8), (['c', 'b'], 9, 7), (['c'], 5, 10), (['b'], 10, 10)],   # 갇힌 기포 무리
    [(['.......bcb', '.....bccb.', '...bccb...', '.bcbb.....', 'bb........'], 3, 5)],         # 광택 띠
    [(['.ddd...', 'dddddd.', '.dddddd', '..ddd..'], 6, 7), (['bc'], 3, 3)],                  # 깊은 자리 B
    [(['.dd', 'ddd', '.d.'], 9, 3), (['c'], 4, 10), (['bc'], 5, 11)],                         # 작은 깊은 자리 + 기포
]
ICE1_FROZEN = [
    sq([   # 큰 돌 — 얼음 아래 회색 돌(위 밝음 6 · 아래 그늘 3), 둘레 깊은 얼음 d
        'mmmmmmmmmmmm', 'mmmmmmmmmmmm', 'mmmddddddmmm', 'mmd666655dmm', 'md65665554dm', 'md5655c544dm',
        'md5554c443dm', 'md44544433dm', 'mmd333332dmm', 'mmmddddddmmm', 'mmmmmmmmmbmm', 'mmmmmmmmmmmm'], 12, 12),
    sq([   # 작은 돌 둘
        'mmmmmmmmmmmm', 'mmddddmmmmmm', 'md6655dmmmmm', 'md5c54dmmmmm', 'md4433dmmmmm', 'mmddddmmmmmm',
        'mmmmmmmddddm', 'mmmmmmd6655d', 'mmmmmmd5c43d', 'mmmmmmd4432d', 'mmmmmmmddddm', 'mmmmmmmmmmmm'], 12, 12),
]

# ---- 얼음 가장자리 결(칸 좌표) — P 밝은 턱(W, 끊김 c·I) · L 광택(b, c 점) · N 옅어짐(m/b) · Q 그늘 턱(d, 끊김 m) · M 그늘 안(m/d)
P1_TEX = ['WWcWWWWcWWIWWWcW', 'WcWWIWWWcWWWWcWW', 'WWWcWWcWWWWcWWWI', 'cWWWWcWWWIWWcWWW'] * 4
L1_TEX = ['bbcbbbbcbbbmbbcb', 'bcbbbmbbbcbbbbbc', 'cbbbcbbbbbbcbmbb', 'bbmbbbcbbcbbbbbb'] * 4
N1_TEX = ['mbmmbmmmbmmmbmmm', 'mmmbmmbmmmmbmmbm', 'bmmmmmmbmbmmmmmb', 'mmbmmbmmmmmmbmmm'] * 4
Q1_TEX = ['ddmdddddmddddmdd', 'dddddmdddddmdddd', 'mddddddmddddddmd', 'dddmddddddmddddd'] * 4
M1_TEX = ['mmdmmmmmmdmmmmmm', 'mmmmmmdmmmmmmdmm', 'dmmmmmmmmmmdmmmm', 'mmmmdmmmmmmmmmmd'] * 4

# 얼음 틀 A1: 바깥 → 안 = ',' 바닥 · k 녹은 물 줄 · P 밝은 턱 · L 광택 · N 옅어짐(북·서) / Q 그늘 턱 · M(남·동)
IF1_N = ',kPLN...'
IF1_S = ',kQM....'
IF1_NW = [',,,,,,,,', ',,,,,kkk', ',,,kkPPP', ',,kPPLLL', ',kPLLNNN', ',kPLN...', ',kPLN...', ',kPLN...']
IF1_NE = [',,,,,,,,', 'kkk,,,,,', 'PPPkk,,,', 'LLLPQk,,', 'NNNMQQk,', '...MMQk,', '....MQk,', '....MQk,']
IF1_SW = [',kPLN...', ',kPLN...', ',kPLNN..', ',kPLMMM.', ',,kQMMMM', ',,kkQQQQ', ',,,,kkkk', ',,,,,,,,']
IF1_SE = ['....MQk,', '....MQk,', '....MQk,', '...MMQk,', 'MMMMQQk,', 'QQQQQk,,', 'kkkkk,,,', ',,,,,,,,']
IF1_FRAME = frame(IF1_NW, IF1_NE, IF1_SW, IF1_SE, uni(IF1_N), uni(IF1_S), uni(IF1_N), uni(IF1_S))
IF1_INNER = inner4([',kP.....', 'kPL.....', 'PLN.....', 'LN......', 'N.......'] + ['........'] * 3,
                   ['....PQk,', '.....MQk', '......MQ', '.......M'] + ['........'] * 4,
                   ['........'] * 4 + ['M.......', 'QM......', 'kQM.....', ',kQ.....'],
                   ['........'] * 4 + ['.......M', '......MQ', '.....MQk', '.....Qk,'])
check_frame('A1 얼음 틀', IF1_FRAME, IF1_INNER, strict_inner=False)
WOB_ICE1 = check_wob({
    'N': [0, 0, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    'S': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
    'W': [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0],
    'E': [0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]})

# ---- 바위 윗면 — 서리 낀 회색 판돌. 판(5 바탕)마다 왼·위 끝 서리 6·Z·I, 오른·아래 4, 판 사이 금 3·2, 금 속 눈 S.
TOP1_MAIN = sq([
    '5556655554455555', '55Z6655544455665', '5556555554555566', '4555554455555555',
    '44555444455Z6555', '5455555455666555', '5555555555565554', '5566555445555544',
    '5Z66555444555554', '5565555545556655', '55554455555Z6665', '5554444555556655',
    '4555445556555555', '44555555Z6655544', '5555555556555554', '5566555555544555'], name='TOP1')
TOP1_VARS = [
    [],
    [(['..SS..', '.SSSZ.', 'SSZZ66', '.6655.'], 3, 7)],                                   # 눈 더미(판 위)
    [(['.Z6.', 'Z665', '6554', '.44.'], 10, 8), (['S'], 9, 12)],                           # 서리 앉은 돌덩이
    [(['3.....', 'S3....', '.23...', '..S3..', '...23.'], 2, 7)],                          # 금 + 금 속 눈
    [(['ZZ', 'Z6'], 11, 2), (['I'], 4, 9), (['S.', '.S'], 12, 9)],                         # 서리 조각
]
# 틀: 북·서 = 바닥 홈 , → 깨진 돌 끝 서리 R(+ 둘째 줄 B) → 몸통. 동 = 바닥 → 그늘 돌 끝 D. 남(처마) = 띠 없이 몸통 그대로(앞면 턱이 받음).
R1_TEX = ['Z6SZ66Z5ZS6Z6IZ6', '6ZZ5Z6SZ6Z56ZZ6S', 'Z5I6ZZ6SZ6ZZ5Z6Z', 'S6Z6Z5ZZ6IZ6ZS6Z'] * 4
B1_TEX = ['5656556556655565', '6556565655565656', '5565655656556556', '6555665556565565'] * 4
D1_TEX = ['3423343243342334', '2433234334233243', '3342432343324342', '4233342234433432'] * 4
_TN1 = lambda k, m: 'R' if k == 0 else 'B'  # noqa: E731
_TE1 = lambda k, m: 'D'  # noqa: E731
TOP1_N = strips([(1, 2), (0, 2), (0, 1), (1, 3), (2, 3), (1, 2), (2, 4), (1, 2),
                 (1, 2), (2, 3), (3, 4), (2, 4), (1, 2), (0, 1), (0, 2), (1, 2)], _TN1, ',')
TOP1_W = strips([(1, 2), (1, 3), (2, 3), (1, 2), (0, 1), (1, 2), (2, 3), (1, 2),
                 (1, 2), (0, 2), (1, 2), (2, 4), (3, 4), (2, 3), (1, 2), (1, 2)], _TN1, ',')
TOP1_E = strips([(1, 2), (1, 2), (2, 3), (2, 3), (1, 2), (0, 1), (1, 2), (1, 2),
                 (1, 2), (2, 3), (1, 3), (1, 2), (0, 2), (1, 2), (2, 3), (1, 2)], _TE1, ',')
TOP_S0 = strips([(0, 0)] * 16, _TE1, ',')
TOP1_NW = [',,,,,,,,', ',,,,,,RR', ',,,RRR..', ',,RB....', ',R......', ',R......', ',R......', ',R......']
TOP1_NE = [',,,,,,,,', 'RR,,,,,,', '..RD,,,,', '....D,,,', '.....D,,', '......D,', '......D,', '......D,']
TOP1_SW = [',R......'] * 8
TOP1_SE = ['......D,'] * 8
TOP1_FRAME = frame(TOP1_NW, TOP1_NE, TOP1_SW, TOP1_SE, TOP1_N, TOP_S0, TOP1_W, TOP1_E)
TOP1_INNER = inner4([',R......', 'R.......'] + ['........'] * 6,
                    ['......D,', '.......D'] + ['........'] * 6,
                    ['........'] * 8, ['........'] * 8)
check_frame('A1 바위 윗면 틀', TOP1_FRAME, TOP1_INNER, strict_inner=False)
WOB_TOP1 = check_wob({
    'N': [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 1, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0],
    'E': [0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]})

# ---- 앞면 — 0행 = 처마 끝 밝은 서리 턱(Z 6 S 끊김). 고드름은 그 턱에서 매달린다(왼 c · 오른 b, 끝 W):
#   열 4~5 길게 9(위 6행만 두 겹) · 열 10~11 짧게 3 · 열 14 1 — 한 칸에 긴 것 하나 + 짧은 것, 사이는 맨 바위.
#   사이는 바위(위 4·5 → 아래 2·1), 8행에 가로 턱 금. 10행부터는 바탕 + 손으로 놓은 바윗덩이(왼·위 5, 아래 1). 30~31행 접지 그늘 + 서리.
FACE1_TOP = [
    'Z6SZ5ZZS6Z5Z6ZSZ',
    '4554cb4544cb55W4',
    '5444cb4344c34434',
    '4434cb3443W34443',
    '3443cb2354443435',
    '5543cb4244334544',
    '4433cb3233323433',
    '3323c23133423323',
    '2332c11121112332',
    '3233W45544544233',
]
FACE1_BASE = FACE1_TOP + ['3' * 16] * 4 + ['2' * 16] * 16 + ['2131113121131121', 'a11a11a11a1I1a11']
LB = ['.55.', '5443', '4332', '.21.']
LM = ['54.', '432', '.21']
LS = ['5', '2']
FACE1_MID = sq(stamp(FACE1_BASE, [
    (LB, 1, 10), (LM, 9, 10), (LS, 14, 12), (['1'], 6, 13), (['I'], 7, 12), (LB, 5, 15), (LM, 12, 16),
    (LS, 2, 18), (LB, 9, 20), (LM, 1, 22), (LS, 14, 21), (LM, 11, 25), (LS, 6, 25), (['I'], 15, 19),
    (['11'], 4, 27), (LS, 0, 27)], wrap=True), 16, 32, 'FACE1')
FACE1_L = [(col('Z' + '5' * 9 + '4' * 20 + '21'), 0, 0)]
FACE1_R = [(col('5' + '2' * 9 + '1' * 22), 7, 0), (col('.' + '3' * 9 + '2' * 20 + '..'), 6, 0)]

# ================================================================================================ A2 「청빙」
# 글자: 얼음 d m b c W = ice 0~4 · 서리 F = iron 5 · 서리 그늘 G = iron 4
#       바닥 o n h = iron 0·1·2 · 바위 1~4 = vrock 1~4(242c38 384454 566577 7a7f86)
L2 = legend(d=('ice', 0), m=('ice', 1), b=('ice', 2), c=('ice', 3), W=('ice', 4),
            F=('iron', 5), G=('iron', 4), o=('iron', 0), n=('iron', 1), h=('iron', 2),
            **{str(i): ('vrock', i) for i in range(1, 5)})

# ---- 얼음굴 바닥 — 얼어 갈라진 검푸른 흙. 바탕 n, 마른 결 h, 손으로 그은 금(o, 오른·아래 턱 h), 서리 딱지 G·F.
G2_BASE = sq([
    'nnnhhnnnnnnnnnnn', 'nnnhhhnnnnnoonnn', 'nonnnnnnhhnnnnnn', 'noonnnnnhhnnnnnn',
    'nnnnnhhnnnnnnhhn', 'nnnnnhnnnonnnhhn', 'nhhnnnnnnoonnnnn', 'nhhhnnnnnnnnnnnn',
    'nnnnnnnhhhnnnonn', 'nnnonnnnhhnnnnnn', 'nnnoonnnnnnnhhnn', 'nhnnnnnnnnnnhhhn',
    'nhhnnhhnnonnnnnn', 'nnnnnhhnnnnnnnnn', 'nnonnnnnnnnhhnon', 'nnnhnnnnnnnnnnnn'], name='G2')
CR1 = ['o.....', 'hoo...', '.hhoo.', '...hho']        # 얼어 갈라진 금(아래 빛 받는 턱 h)
CR2 = ['.o.', 'oh.', 'oh.', '.oh', '.oh']
FC1 = ['.GF', 'GGG', '.G.']
FC2 = ['FG', 'G.']
FC3 = ['F']
G2_COMMON = [(FC3, 1, 6)]
G2_VARS = [
    [(FC1, 8, 2), (CR1, 2, 9), (FC3, 13, 5)],
    [(CR2, 10, 3), (FC2, 3, 5), (FC3, 8, 12)],
    [(FC1, 4, 11), (CR1, 7, 3), (FC3, 12, 9)],
    [(FC2, 7, 10), (CR2, 3, 2), (FC3, 12, 12)],
    [(FC3, 6, 6)],
]
G2_N = [3, 3, 4, 4, 3, 3, 2, 3, 3, 3, 3, 4, 4, 3, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 3]
G2_W = [2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 2, 2, 2]

# ---- 얼음 몸통 — 밝고 탁한 판 얼음: 서리빛 F 바탕에 푸른 ice 2 자리(b), 광택 c·W 는 드물게.
ICE2_MAIN = sq(['F' * 16] * 3 + ['FFFFbFFFFFFFFFFF'] + ['F' * 16] * 7 + ['FFFFFFFFFFFbFFFF'] + ['F' * 16] * 4, name='ICE2')
ICE2_VARS = [
    [],
    [(['.bbb.', 'bbbbb', 'bbbbF', '.bb..'], 3, 3), (['bb'], 10, 11)],                         # 푸른 자리 A
    [(['WW..........', 'cWWc........', '.mcWWc......', '..mmcWWc....', '....mmcWWc..', '......mmcW..',
       '........mm..'], 1, 4)],                                                              # 하얀 균열면(아래 그늘 m)
    [(['.c.', 'cbc', '.b.'], 4, 5), (['c'], 7, 4), (['c', 'b'], 8, 7), (['.c', 'cb'], 5, 9), (['c'], 10, 9)],  # 갇힌 공기 무리
    [(['........cW', '......cWc.', '....cWc...', '..cWc.....', 'cWc.......'], 3, 5)],         # 광택 띠
    [(['..WW..', '.WWcW.', 'WcWWcW', '.cWWc.', '..cc..'], 4, 5), (['W'], 11, 10)],            # 불투명 서리 무리
    [(['..bb...', '.bbbbb.', 'bbbbbbb', '.bbbb..'], 5, 7), (['c'], 3, 3)],                    # 푸른 자리 B
]
ICE2_FROZEN = [
    sq([
        'FFFFFFFFFFFF', 'FFFFbbbbFFFF', 'FFFbmmmmbFFF', 'FFbm3443mbFF', 'Fbm344432mbF', 'Fbm33W332mbF',
        'Fbm233221mbF', 'FFbm2211mbFF', 'FFFbmmmmbFFF', 'FFFFbbbbFFFF', 'FFFFFFFFFcFF', 'FFFFFFFFFFFF'], 12, 12),
    sq([
        'FFFFFFFFFFFF', 'FbbbbFFFFFFF', 'bmmmmbFFFFFF', 'bm43mbFFFFFF', 'bm32mbFFFFFF', 'bbmmbbFFFFFF',
        'FFFFFFFbbbbF', 'FFFFFFbmmmmb', 'FFFFFbm443mb', 'FFFFFbm3W2mb', 'FFFFFFbmmmbF', 'FFFFFFFbbbFF'], 12, 12),
]

# ---- 얼음 가장자리 결 A2 — P 밝은 턱(W/c) · L 광택(c/F) · Q 그늘 턱(m, 끊김 G). X = 바닥에 핀 서리 술(바닥 + F·G 점).
P2_TEX = ['WcWWWcWWWWcWWcWW', 'WWWcWWWcWWWWcWWW', 'cWWWWWcWWcWWWWWc', 'WWcWWcWWWWWcWWcW'] * 4
L2_TEX = ['cFcccFccFcccFccc', 'ccFcccccFccFcccF', 'FccFccFccccccFcc', 'cccccFccFcFccccF'] * 4
Q2_TEX = ['mmGmmmmmmGmmmmmm', 'mmmmGmmmmmmmGmmm', 'GmmmmmmGmmmmmmmG', 'mmmmmmGmmmGmmmmm'] * 4
X2_SPECKS = [(['F'], 1, 2), (['G'], 6, 1), (['F'], 10, 3), (['G'], 14, 2), (['F'], 3, 7), (['G'], 12, 6),
             (['F'], 8, 9), (['G'], 2, 12), (['F'], 13, 11), (['G'], 6, 14), (['F'], 11, 15), (['F'], 15, 8)]
IF2_N = ',XPL....'
IF2_S = ',XQ.....'
IF2_NW = [',,,,,,,,', ',,,,,XXX', ',,,XXPPP', ',,XPPLLL', ',XPL....', ',XPL....', ',XPL....', ',XPL....']
IF2_NE = [',,,,,,,,', 'XXX,,,,,', 'PPPXX,,,', 'LLLPQX,,', '....QQX,', '.....QX,', '.....QX,', '.....QX,']
IF2_SW = [',XPL....', ',XPL....', ',XPL....', ',XPQ....', ',,XQQ...', ',,XXQQQQ', ',,,,XXXX', ',,,,,,,,']
IF2_SE = ['.....QX,', '.....QX,', '.....QX,', '....QQX,', '...QQX,,', 'QQQQX,,,', 'XXXX,,,,', ',,,,,,,,']
IF2_FRAME = frame(IF2_NW, IF2_NE, IF2_SW, IF2_SE, uni(IF2_N), uni(IF2_S), uni(IF2_N), uni(IF2_S))
IF2_INNER = inner4([',XP.....', 'XPL.....', 'PL......', 'L.......'] + ['........'] * 4,
                   ['.....QX,', '......QX', '.......Q'] + ['........'] * 5,
                   ['........'] * 5 + ['P.......', 'XQ......', ',XQ.....'],
                   ['........'] * 5 + ['.......Q', '......QX', '.....QX,'])
check_frame('A2 얼음 틀', IF2_FRAME, IF2_INNER, strict_inner=False)
WOB_ICE2 = check_wob({
    'N': [0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0],
    'S': [0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    'W': [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0],
    'E': [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 2, 2, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0]})

# ---- 바위 윗면 — 서리 앉은 검푸른 화산암. 바탕 3, 빛 면 4(왼·위 F 서리), 그늘 2, 손으로 그은 금(1, 왼·위 2 · 오른·아래 서리 G).
TOP2_RAW = sq([
    '3333323333333333', '3F43322333F43333', '3423333333423332', '3333332233333322',
    '2333333333334333', '2233F43333342333', '3333423333333333', '3333333322333F43',
    '3333333222333423', '33F4333333333333', '3342333333332233', '3333333F43333223',
    '3333223423333333', '3322233333333333', '33333333333F4333', '3333333333342233'], name='TOP2')
TOP2_MAIN = TOP2_RAW
TOP2_VARS = [
    [],
    [(['..GF..', '.GFFF4', 'GFF443', '.4433.'], 9, 8)],                                # 서리 덮인 혹
    [(['1G.....', '.21G...', '...21G.', '.....2G'], 3, 2)],                           # 짧은 금 + 서리 턱
    [(['FF.', 'FGF', '.G.'], 11, 11), (['F'], 4, 12)],                                # 서리 조각
    [(['.4.', '4F4', '.2.'], 12, 2), (['.43', '432'], 3, 11)],                         # 맨 바위 혹
]
R2_TEX = ['4FG4F44GF4F44GF4', 'F44GF4F4G44F4F4G', '4GF44F4G4F4G44F4', 'GF4F4G44F4GF4F44'] * 4
D2_TEX = ['2121122121211212', '1221212112212121', '2112121221121212', '1212211212212121'] * 4
_TN2 = lambda k, m: 'R'  # noqa: E731
_TE2 = lambda k, m: 'D'  # noqa: E731
TOP2_N = strips([(1, 2), (1, 3), (2, 3), (2, 3), (1, 2), (0, 1), (0, 2), (1, 2),
                 (1, 2), (1, 2), (0, 2), (1, 2), (2, 3), (3, 4), (2, 3), (1, 2)], _TN2, ',')
TOP2_W = strips([(1, 2), (2, 3), (1, 2), (0, 1), (1, 2), (1, 3), (2, 3), (1, 2),
                 (1, 2), (1, 2), (2, 4), (2, 3), (1, 2), (0, 2), (0, 1), (1, 2)], _TN2, ',')
TOP2_E = strips([(1, 2), (0, 1), (1, 2), (2, 3), (3, 4), (2, 3), (1, 2), (1, 2),
                 (1, 2), (1, 3), (1, 2), (0, 1), (1, 2), (2, 3), (2, 3), (1, 2)], _TE2, ',')
TOP2_NW = [',,,,,,,,', ',,,,,,RR', ',,,,RR..', ',,,R....', ',,R.....', ',R......', ',R......', ',R......']
TOP2_NE = [',,,,,,,,', 'RR,,,,,,', '..RRD,,,', '.....D,,', '......D,', '......D,', '......D,', '......D,']
TOP2_SW = [',R......'] * 8
TOP2_SE = ['......D,'] * 8
TOP2_FRAME = frame(TOP2_NW, TOP2_NE, TOP2_SW, TOP2_SE, TOP2_N, TOP_S0, TOP2_W, TOP2_E)
TOP2_INNER = inner4([',R......', 'R.......'] + ['........'] * 6,
                    ['......D,', '.......D'] + ['........'] * 6,
                    ['........'] * 8, ['........'] * 8)
check_frame('A2 바위 윗면 틀', TOP2_FRAME, TOP2_INNER, strict_inner=False)
WOB_TOP2 = check_wob({
    'N': [0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    'S': [0] * 32,
    'W': [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    'E': [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0]})

# ---- 앞면 — 0행 밝은 서리 턱(4 F G 끊김), 1행 턱 밑, 2행 턱 그늘. 가는 서리 고드름(왼 c · 오른 F, 끝 W):
#   열 9~10 길게 8(위 2행만 두 겹) · 열 2 짧게 3 · 열 13 짧게 2. 사이는 바위(3 → 2). 9행부터 바탕 2 + 바윗덩이(왼·위 4, 아래 1).
#   30~31행 접지 그늘(1) + 서리 점. 결정 무리는 왼끝 마구리에만 하나(드문 강조).
FACE2_TOP = [
    '4FF4G4FF44F44FF4',
    '34c343434cF34c33',
    '23c232323cF22W23',
    '32W322332c332332',
    '232234432c233432',
    '323333223c324332',
    '233223343c223322',
    '323322332c322332',
    '223223223W232232',
]
FACE2_BASE = FACE2_TOP + ['2' * 16] * 21 + ['1211112111211121', '11111111F1111111']
LB2 = ['.43.', '4332', '3221', '.11.']
LM2 = ['43', '31']
LW2 = ['.443.', '43322', '.111.']
FACE2_MID = sq(stamp(FACE2_BASE, [
    (LW2, 11, 9), (LM2, 4, 10), (LB2, 0, 13), (LM2, 8, 14), (LB2, 12, 16), (LW2, 4, 18), (LM2, 1, 20),
    (LB2, 9, 22), (LM2, 14, 24), (LW2, 2, 25), (LM2, 11, 27), (['G'], 7, 21), (['G'], 15, 13)], wrap=True), 16, 32, 'FACE2')
CRY2 = ['..W...', '..cd..', '.Wcd.W', '.cmdcd', 'Wcmdcd', 'cmd1md', '1111d1']
FACE2_L = [(col('F' + '4' * 12 + '3' * 17 + '21'), 0, 0), (CRY2, 1, 19)]
FACE2_R = [(col('3' + '1' * 31), 7, 0)]


# ================================================================================================ 조립
def ground_parts(n):
    if n == 1:
        return G1_BASE, G1_COMMON, G1_VARS, L1, G1_N, G1_W, legend(**{'1': ('vrock', 1), '2': ('vrock', 1)})
    return G2_BASE, G2_COMMON, G2_VARS, L2, G2_N, G2_W, legend(**{'1': ('vrock', 1), '2': ('vrock', 1)})


def ground(n):
    """얼음굴 바닥 오토타일(벽 밑 그늘 북·서) + 몸통 변형."""
    base, common, vs, leg, N_, W_, shade = ground_parts(n)
    bs = body_set(base, common, vs, leg)
    fr = grid(floor_frame(N_, W_, '1', '2'), shade, 32, 32)
    inn = grid(G_INNER, shade, 16, 16)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_floor(n):
    g = ground(n)
    if n == 1:
        leg, prof, main, vs = L1, WOB_ICE1, ICE1_MAIN, ICE1_VARS
        tx = {',': g.body, 'P': grid(P1_TEX, leg), 'L': grid(L1_TEX, leg), 'N': grid(N1_TEX, leg),
              'Q': grid(Q1_TEX, leg), 'M': grid(M1_TEX, leg)}
        fr_rows, inn_rows = IF1_FRAME, IF1_INNER
    else:
        leg, prof, main, vs = L2, WOB_ICE2, ICE2_MAIN, ICE2_VARS
        base, common, _, _, _, _, _ = ground_parts(2)
        x = grid(stamp(stamp(base, common), X2_SPECKS), leg)
        tx = {',': g.body, 'X': x, 'P': grid(P2_TEX, leg), 'L': grid(L2_TEX, leg), 'Q': grid(Q2_TEX, leg)}
        fr_rows, inn_rows = IF2_FRAME, IF2_INNER
    fr, inn = fill(fr_rows, inn_rows, leg, tx)
    wobble(fr, g.body, prof)
    bs = body_set(main, [], vs, leg)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def frozen_tiles(n):
    main, fz, leg = (ICE1_MAIN, ICE1_FROZEN, L1) if n == 1 else (ICE2_MAIN, ICE2_FROZEN, L2)
    out = []
    for c in fz:
        rows = list(main)
        for i, r in enumerate(c):
            rows[2 + i] = main[2 + i][:2] + r + main[2 + i][14:]
        out.append(grid(rows, leg))
    return out


def rock_top(n):
    g = ground(n)
    if n == 1:
        leg, fr_rows, inn_rows, prof, main, vs = L1, TOP1_FRAME, TOP1_INNER, WOB_TOP1, TOP1_MAIN, TOP1_VARS
        tx = {',': g.body, 'R': grid(R1_TEX, leg), 'B': grid(B1_TEX, leg), 'D': grid(D1_TEX, leg)}
    else:
        leg, fr_rows, inn_rows, prof, main, vs = L2, TOP2_FRAME, TOP2_INNER, WOB_TOP2, TOP2_MAIN, TOP2_VARS
        tx = {',': g.body, 'R': grid(R2_TEX, leg), 'D': grid(D2_TEX, leg)}
    fr, inn = fill(fr_rows, inn_rows, leg, tx)
    wobble(fr, g.body, prof)
    bs = body_set(main, [], vs, leg)
    return autotile_cv(bs[0], fr, inn, bs[1:])


def ice_face(n):
    if n == 1:
        return face_from(FACE1_MID, FACE1_L, FACE1_R, L1)
    return face_from(FACE2_MID, FACE2_L, FACE2_R, L2)


# ================================================================================================ 장면 — 얼음 동굴 두 방(18×12)
# '#' 얼음 바위 · '.' 얼음굴 바닥 · 'i' 얼음 바닥. 북벽은 10칸 곧게 이어져(반복 판단용), 가운데 바위 덩이가 두 방을 나눈다.
# 왼쪽 큰 얼음판(안쪽 칸에 얼음 속 돌), 오른쪽 아래 얼음판, 왼쪽 아래 바위 턱.
SCENE = [
    '##################',
    '##################',
    '##################',
    '#..........####..#',
    '#.iiiiii...####..#',
    '#iiiiiiii..####..#',
    '#iiiiiiii..####..#',
    '#.iiiiii.........#',
    '#..ii......iiii..#',
    '###.......iiiiii.#',
    '###.......iiiii..#',
    '##################',
]
FROZEN_AT = [(3, 5, 0), (6, 6, 1), (12, 9, 0)]   # (칸 x, 칸 y, 얼음 속 돌 번호) — 안쪽(마스크 255) 칸만
ACTOR_AT = (9, 5)


def actor_cv():
    return dot.Cv.of(dot.actor1_frame(1, 0, 0))


def scene(n, actor=True):
    g = [r.replace('i', 'w') for r in SCENE]
    assert not dot.structure_errors(g), dot.structure_errors(g)
    cv = dot.render_cave(g, rock_top(n), ice_face(n), ground(n), water=ice_floor(n))
    fz = frozen_tiles(n)
    for x, y, k in FROZEN_AT:
        assert dot.mask_at(g, x, y, lambda ch, X, Y: ch == 'w') == 255, (x, y)
        cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = fz[k].a
    if actor:
        cx, cy = ACTOR_AT
        cv.paste(actor_cv(), cx * T - 4, cy * T - 14)
    return cv, g


# ================================================================================================ 후보
NOTES = {
    'A1': '「빙하」 — 한 단 낮은 빙하 얼음(가운데 깊은 자리, 북·서 광택 띠, 녹은 물 줄 + 얇게 솟은 턱) · 회청색 자갈 바닥 · '
          '서리 낀 회색 판돌 윗면(깨진 돌 끝 서리) + 서리 턱에서 길이 제각각 고드름이 매달린 바위 앞면',
    'A2': '「청빙」 — 밝고 탁한 판 얼음(광택 띠·하얀 균열면·서리 무리, 바닥에 핀 서리 술 + 한 겹 턱) · 얼어 갈라진 검푸른 흙 바닥 · '
          '서리 앉은 검푸른 화산암 윗면 + 서리 턱·가는 서리 고드름 앞면(결정은 벽 줄 왼끝에 한 무리)',
}


def cand_ice_floor(n):
    def fn():
        at = ice_floor(n)
        gr = ground(n)
        v, _ = scene(n)
        fz = frozen_tiles(n)
        tiles = {f'얼음 속 돌 {i + 1}': t for i, t in enumerate(fz)}
        return hcat(a2_plus(at), a2_plus(gr)), {
            'kind': 'autotile', 'autotiles': {'ice': at, 'ground': gr}, 'tiles': tiles, 'vignette': v,
            'note': NOTES[f'A{n}'] + ' — 원본 = 얼음 바닥 A2(+몸통 변형 4) | 얼음굴 바닥 A2(+변형 3)',
            'extras': [('얼음 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('바닥 몸통 8×8 (변형 섞음)', dot.mosaic(gr, 8, 8), 2),
                       ('얼음 속 돌 칸', hcat(*fz), 4), ('얼음 바닥 47 변형', variants_sheet(at), 2)]}
    return fn


def cand_ice_rock(n):
    def fn():
        at = rock_top(n)
        f = ice_face(n)
        v, g = scene(n)
        return hcat(a2_plus(at), f.b), {
            'kind': 'autotile', 'autotiles': {'ceil': at}, 'faces': {'face': f}, 'vignette': v, 'grid': g, 'rim_check': True,
            'note': NOTES[f'A{n}'] + ' — 원본 = 바위 윗면 A2(+몸통 변형 4) | 앞면 32×32',
            'extras': [('윗면 몸통 8×8 (변형 섞음)', dot.mosaic(at, 8, 8), 2), ('앞면 8칸 이어 붙임(끝 마구리 포함)', face_run(f, 8), 3),
                       ('윗면 47 변형', variants_sheet(at), 2)]}
    return fn


CANDIDATES = {
    'gap.ice_floor': {'A1': cand_ice_floor(1), 'A2': cand_ice_floor(2)},
    'gap.ice_rock': {'A1': cand_ice_rock(1), 'A2': cand_ice_rock(2)},
}

SCENE_LEAD = ('같은 번호의 얼음 바위(윗면·앞면)·얼음 바닥·얼음굴 바닥만으로 깐 18×12 얼음 동굴 — 북벽 10칸 곧은 줄(반복 판단), '
              '가운데 바위 덩이로 나뉜 두 방, 얼음판 안 얼음 속 돌, 왼쪽 아래 바위 턱, Actor1. 맵 가장자리는 잘린 것.')
