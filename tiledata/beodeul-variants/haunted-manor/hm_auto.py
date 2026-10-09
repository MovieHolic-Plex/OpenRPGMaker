# 폐가 저택 오토타일 5종 (4x4 = 16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0).
# 시그니처 땅 덩이 3종(WAVE-BRIEF-4 규칙 1: 가장자리 불규칙·둥글게, 직각 금지):
#   autotile-dust-drift   먼지 쌓인 바닥 덩이(걷기, 아래층) — 회갈 먼지가 낮게 쌓인 더미, 가장자리 성긴 알갱이, 남쪽 둔덕 그늘
#   autotile-cobweb       바닥 거미줄 덩이(걷기, 아래층) — 먼지 낀 흰 실이 그물처럼 덮인 자리, 가장자리 늘어진 실 끝
#   autotile-mildew       곰팡이·물 얼룩(걷기, 아래층) — 스며든 물이 마르며 남긴 검푸른 얼룩, 밝은 물때 테, 속 곰팡이 점
# 길·울타리 2종:
#   autotile-carpet-worn  낡은 검붉은 카펫 띠(걷기, 아래층) — 바랜 테 무늬, 해진 구멍, 끝은 풀린 술
#   autotile-banister     부서진 나무 난간(막힘, 위층) — 손잡이 윗면 + 난간동자(몇 개 빠짐), 끝·모서리 네모 기둥
# 가장자리 들쭉날쭉은 변마다 주기 16 사인 합 잡음을 모든 변형에 같은 씨앗으로 써서(최종 탑 ft_wave5.edges 와 같은 규칙,
# 여기에 순수 파이썬 복사본) 이웃 칸끼리 윤곽이 이어진다. 속 결은 칸 안 좌표만 써서 어떤 칸끼리 붙어도 이음새가 없다.
from hm_kit import *
from hm_kit import _hash


def _J(seed, jag):
    out = []
    for xi in range(16):
        xx = xi + .5
        v = sum(a * math.sin(2 * math.pi * f * xx / 16.0 + _hash(seed, f, 91) * 6.283) for f, a in ((1, .6), (2, .9), (3, .45), (4, .2)))
        out.append(v / 1.6 * jag)
    return out


_EC = {}


def edges(n, inset, jag, rad, seed):
    """(m, mN, mS): m[y][x] = 덩이 경계에서 안쪽까지 px(음수 = 바깥), mN/mS = 비어 있는 북/남 변까지 거리(아니면 99)."""
    key = (n, inset, jag, rad, seed)
    if key in _EC: return _EC[key]
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    def I(j):
        out = []
        for i in range(16):
            wr = min(1.0, max(0.0, min(i + .5, 16 - i - .5) / 5.0))
            out.append(.8 + (max(inset + j[i], 0) - .8) * wr)
        return out
    jN = I(_J(seed + 1, jag)); jS = I(_J(seed + 2, jag)); jW = I(_J(seed + 3, jag)); jE = I(_J(seed + 4, jag))
    m = [[99.0] * 16 for _ in range(16)]; mN = [[99.0] * 16 for _ in range(16)]; mS = [[99.0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = {'N': y - jN[x], 'S': (15 - y) - jS[x], 'W': x - jW[y], 'E': (15 - x) - jE[y]}
            v = 99.0
            for k in 'NESW':
                if miss[k]: v = min(v, d[k])
            for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
                if miss[a] and miss[b]:
                    da, db = d[a], d[b]
                    if da < rad and db < rad: v = min(v, rad - math.hypot(rad - da, rad - db))
            m[y][x] = v
            if miss['N']: mN[y][x] = d['N']
            if miss['S']: mS[y][x] = d['S']
    _EC[key] = (m, mN, mS)
    return _EC[key]


def vl(x, y, sc, seed):
    """칸 안 주기 16 값 잡음."""
    return vnoise(x, y, sc, seed, per=max(1, int(16 / sc)))


def hl(x, y, seed): return _hash(x % 16, y % 16, seed)


def sheet_of(cellfn):
    sh = new(64, 64)
    for n in range(16): sh.alpha_composite(cellfn(n), (n % 4 * T, n // 4 * T))
    return sh


# ================================================================ 먼지 더미 (걷기)
def dust_cell(n, seed=801):
    m, mN, mS = edges(n, 2.4, 2.3, 7.5, seed)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y][x]
            clump = vl(x * 2.0, y * 2.0, 2, seed + 1) * .65 + hl(x, y, seed + 2) * .35
            if v < 0:
                if v > -1.6 and clump < (1.6 + v) / 1.6 * .45: p[x, y] = DU[2] + (200,)   # 바깥 성긴 알갱이
                continue
            if clump > min(1.0, (v + .4) / 2.6) * .95 + .03: continue                  # 얇은 가장자리는 바닥이 비친다
            k = 3
            h = hl(x, y, seed + 5)
            if h > .9: k = 4
            elif h < .08: k = 2
            if v < 1.4: k = min(k, 2)
            if mS[y][x] < 1.0: k = 1                                                    # 남쪽 둔덕 앞 그늘
            elif 1.4 <= v < 2.3 and mS[y][x] > 3: k = 4                                 # 북·서 둔덕 윗모 빛
            p[x, y] = DU[clamp(k, 1, 5)] + (255,)
    return im


# ================================================================ 거미줄 (걷기)
def _strand(x, y):
    """칸 안 주기 16 의 엉킨 실: 기울기가 다른 실 네 가닥(휘어짐 포함). 0 = 없음, 1 = 실, 2 = 두 실이 만나는 매듭."""
    P = 2 * math.pi / 16
    hits = 0
    if (x + y + int(round(1.6 * math.sin(y * P + .7)))) % 16 == 3: hits += 1
    if (x - y + 32 + int(round(1.4 * math.sin(x * P + 2.1)))) % 16 == 11 and (x + 2 * y) % 16 < 7: hits += 1   # 끊긴 실(반만)
    if (y + int(round(2.0 * math.sin(x * P + 4.0)))) % 16 == 8 and (x * 5 + 3) % 16 > 5: hits += 1
    return hits


def cobweb_cell(n, seed=821):
    """먼지 낀 반투명 거미줄 막(바닥이 비친다, 짙고 옅은 결) 위로 엉킨 실 네 가닥(기울기·휨이 달라 그물 격자가 아니다),
    실이 만나는 매듭은 밝다. 가장자리 밖으로 실 끝이 늘어진다."""
    m, mN, mS = edges(n, 2.0, 2.6, 7.0, seed)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y][x]
            if v < -3.0: continue
            st = _strand(x, y)
            if v < 0:
                if st and hl(x, y, seed + 4) < (3.0 + v) / 3.0: p[x, y] = WEB[0] + (150,)
                continue
            f = vl(x, y, 4, seed + 3)
            veil = (34 if v < 1.5 else 52) + (34 if f > .58 else 0)
            p[x, y] = (DU[5] if f > .58 else DU[4]) + (veil,)
            if st == 1: p[x, y] = (WEB[2] if v > 2 else WEB[1]) + (240,)
            elif st >= 2: p[x, y] = WEB[3] + (255,)
    return im


# ================================================================ 곰팡이·물 얼룩 (걷기)
def mildew_cell(n, seed=841):
    """물 얼룩: 속은 고르게 젖어 한 단 어두운 반투명(바닥 결이 비친다), 가장자리 안쪽에 짙은 물때 고리 한 줄과 바깥 밝은 마른 테,
    속에 드문 곰팡이 점(덩이 3~4px). 큰 얼룩 무늬(위장무늬)는 쓰지 않는다."""
    m, mN, mS = edges(n, 2.2, 3.2, 7.5, seed)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y][x]
            if v < 0:
                if v > -1.0 and hl(x, y, seed + 1) < .3: p[x, y] = MO[2] + (80,)
                continue
            if v < 1.0: p[x, y] = MO[5] + (110,); continue                              # 마른 테(밝음)
            if v < 2.0: p[x, y] = MO[0] + (150,); continue                              # 물때 고리(짙음)
            p[x, y] = MO[1] + (105,)
            sp = vl(x * 2.0, y * 2.0, 2, seed + 3)
            if sp > .82 and v > 3: p[x, y] = MO[3] + (200,)                              # 곰팡이 점 덩이
            elif sp > .78 and v > 3: p[x, y] = MO[2] + (170,)
    return im


# ================================================================ 낡은 카펫 띠 (걷기, 길)
def carpet_cell(n, seed=861):
    """테두리는 칸 변에서 일정한 띠(이웃과 이어짐)지만 바깥 1~2px 는 올이 풀려 들쭉날쭉. 띠 = 짙은 가장자리 + 흐린 놋쇠빛 실 한 줄 +
    짙은 띠. 속: 바랜 검붉은 바탕(두 톤 결)에 드문 닳은 자리와 해진 구멍(바닥이 비친다)."""
    im = new(); p = im.load()
    N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    jN = _J(seed + 1, 1.0); jS = _J(seed + 2, 1.0); jW = _J(seed + 3, 1.0); jE = _J(seed + 4, 1.0)
    for y in range(16):
        for x in range(16):
            d = 99.0
            if not W: d = min(d, x - 1 - max(0, jW[y]))
            if not E: d = min(d, 14 - x - max(0, jE[y]))
            if not N: d = min(d, y - 1 - max(0, jN[x]))
            if not S: d = min(d, 14 - y - max(0, jS[x]))
            if d < 0:
                if d > -1.5 and hl(x, y, seed + 5) < .3: p[x, y] = CR[2] + (255,)         # 풀린 올
                continue
            c = CR[3] if (x + y * 2) % 5 else mix(CR[3], CR[2], .5)
            if d < 1: c = CR[1]
            elif d < 2: c = mix(BRS[3], CR[3], .35)
            elif d < 3: c = CR[2]
            wv = vl(x, y, 4, seed + 6)
            if wv > .74 and d > 3: c = mix(c, DU[3], .28)                                  # 닳은 자리
            if vl(x * 1.4, y * 1.4, 3, seed + 7) > .88 and d > 3: continue                 # 해진 구멍
            p[x, y] = tuple(c) + (255,)
            if not S and y >= 14 and x % 2 == 0 and d < 99: p[x, y] = (0, 0, 0, 0)          # 남쪽 끝 술
    return im


# ================================================================ 부서진 난간 (막힘, 위층)
def banister_cell(n, seed=881):
    cv = Cv(16, 16)
    N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            for y in range(2, 6): cv.px(x, y, GW[5] if y == 2 else (GW[4] if y < 4 else (GW[3] if y == 4 else GW[1])))   # 손잡이(윗면 + 두께)
            if x % 4 == 1 and _hash(x // 4, n, seed + 1) > .22:                    # 난간동자(몇 개 빠짐)
                for y in range(6, 14):
                    w = 1 if y in (8, 11) else 0
                    cv.px(x, y, GW[4]); cv.px(x + 1, y, GW[2])
                    if w: cv.px(x - 1, y, GW[3])
            cv.px(x, 14, GW[3]); cv.px(x, 15, GW[1])                                   # 바닥 턱
    if vt:
        ya = 0 if N else 6; yb = 16 if S else 10
        for y in range(ya, yb):
            for x in range(5, 11): cv.px(x, y, GW[5] if x == 5 else (GW[4] if x < 8 else (GW[3] if x < 10 else GW[1])))
    if not (n in (10, 5)):                                                           # 끝·모서리·외톨이: 네모 기둥 + 둥근 머리
        for y in range(1, 15):
            for x in range(5, 11): cv.px(x, y, GW[5] if x == 5 else (GW[4] if x < 8 else (GW[3] if x < 10 else GW[2])))
        for x in range(4, 12): cv.px(x, 3, GW[5]); cv.px(x, 4, GW[3])
        for (x, y) in ((7, 0), (8, 0), (6, 1), (7, 1), (8, 1), (9, 1)): cv.px(x, y, GW[5] if x < 8 else GW[3])
        for x in range(5, 11): cv.px(x, 15, GW[1])
    return pz.fin(cv.im, .62)


def autotile_dust(): return sheet_of(dust_cell)
def autotile_cobweb(): return sheet_of(cobweb_cell)
def autotile_mildew(): return sheet_of(mildew_cell)
def autotile_carpet(): return sheet_of(carpet_cell)
def autotile_banister(): return sheet_of(banister_cell)
