# 선술집 지하·주방(european-tavern-cellar) 공용 바탕 — 결정적(다시 돌리면 같은 그림).
# 장르: tiledata/beodeul-kits/genres/european-streets.md (4 — 어두운 석조 실내).
# 그리기 도우미는 합격 장소의 계보(airship as_kit → tower-interior ti_kit → graveyard-crypt gc_kit/gc_ext/gc_map → _lib3 dlib)를
# 읽기만 하고 그대로 쓴다(Cv·Mk·vol·wbox·vcyl·hcyl·stone_box·topell·cyl_k·fin·Kit·KMap·foot·mk_floor).
# 돌 색은 같은 장르의 석조 시가지(european-quarter-stone/eq_base.py)의 램프 값을 복사해 맞춘다(그 파일은 읽기만).
# 새 재료(포도주·구리·짚·마늘·고기·치즈·불꽃·재)는 같은 7단 규칙(0 윤곽 .. 6 밝음)으로 칠한다. 3/4 시점, 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'airship'))
sys.path.insert(0, os.path.join(_ME, '..', '..', 'beodeul-kits'))
from as_kit import *                                     # noqa: F401,F403
from as_kit import _hash, _pn1
import as_kit as AK
import dlib, pz
from PIL import Image, ImageDraw
import numpy as np
HERE = _ME

def R7(*cs): return [hx(c) for c in cs]
# ---------------------------------------------------------------- 석조 시가지와 같은 램프(eq_base.py 에서 값 복사)
ASH   = R7('#17171c', '#2c2c33', '#414148', '#57575d', '#6e6e72', '#88878a', '#a4a2a0')   # 회색 마름돌 벽
TRIM  = R7('#222228', '#3f3f45', '#5c5c61', '#7a797c', '#979694', '#b3b0aa', '#cdc9c0')   # 밝은 돌(창틀·갓돌)
IRON  = R7('#08090c', '#121419', '#1c1f26', '#272b33', '#343944', '#464c58', '#606776')   # 검은 쇠
GLASS = R7('#0a0d13', '#121821', '#1b2530', '#26343f', '#384a56', '#55707c', '#8aa4ac')
WOOD  = R7('#120a07', '#20140d', '#2e1d13', '#3e281a', '#503424', '#644430', '#7c5a40')   # 짙은 문 나무
BARK  = R7('#0d0907', '#1a120d', '#271b14', '#35251b', '#443023', '#553e2e', '#6a503c')   # 통 나무
AMBER = R7('#2a1a08', '#583812', '#86581e', '#ad7a2e', '#c99a44', '#ddb868', '#eed49a')   # 등불·켜진 창
COB   = R7('#141519', '#25272c', '#36383e', '#484a50', '#5b5d62', '#706f72', '#888684')   # 회색 포석
FLAG  = R7('#1d1c1e', '#302f32', '#434246', '#57565a', '#6b6a6c', '#807e7e', '#989592')   # 판석(조금 따뜻)
GRAV  = R7('#1a1816', '#2c2925', '#3e3a34', '#514b43', '#645d53', '#797064', '#90867a')   # 자갈
PUD   = R7('#07090e', '#0e131b', '#161e28', '#202b37', '#2e3c4a', '#46586a', '#70869a')   # 고인 물
BRICK = R7('#180d0b', '#2b1814', '#40231c', '#533024', '#663c2e', '#7c4c3a', '#94624c')   # 바랜 붉은 벽돌
# ---------------------------------------------------------------- 실내 새 재료(같은 7단 규칙)
OAK   = R7('#140c08', '#2a1a10', '#40281a', '#563824', '#6c4a30', '#866040', '#a07a52')   # 선술집 가구 참나무
FIRE  = R7('#2a0c04', '#6a1a06', '#b03a0a', '#e06a14', '#f5a030', '#fcd660', '#fff4c0')
COP   = R7('#1e0e08', '#4a2010', '#74361a', '#9a5028', '#bc6e3a', '#d8935a', '#ecc08a')   # 구리 냄비
SACK  = R7('#2a2016', '#4a3a28', '#66543a', '#806c4c', '#9a8660', '#b4a07a', '#ccbc98')   # 삼베 자루
GAR   = R7('#3a3430', '#6e6660', '#9a928a', '#bdb6ac', '#d8d2c8', '#ece8e0', '#fbf9f4')   # 마늘·흰 그릇
MEAT  = R7('#2a0e0c', '#561c16', '#7e3022', '#a04634', '#bc644c', '#d4886a', '#e8b094')   # 햄·소시지
BOT   = R7('#08140e', '#10261a', '#1a3a26', '#275034', '#386a46', '#548a60', '#80b088')   # 초록 병
WINE  = R7('#1a0610', '#360a1a', '#561226', '#741c32', '#922c40', '#ae4654', '#c86a70')   # 포도주
CHZ   = R7('#3a2a08', '#6a5014', '#967420', '#bc9a34', '#d6ba50', '#e8d27a', '#f6eab0')   # 치즈
STRAW = R7('#221c0e', '#3c321a', '#564a26', '#706232', '#8a7a40', '#a29252', '#b8aa6a')   # 짚
ASHG  = R7('#1c1a1a', '#363232', '#504a48', '#6a6462', '#86807c', '#a29c96', '#bdb8b0')   # 재
HERB  = R7('#0c140a', '#18240f', '#243616', '#32481e', '#425c28', '#587434', '#728e46')   # 말린 허브
CLAY  = R7('#1e120c', '#3a2216', '#583420', '#76482c', '#92603a', '#ac7a4e', '#c49868')   # 질그릇
LINEN = R7('#3c3832', '#68625a', '#8e877c', '#aca498', '#c4bcae', '#d8d2c4', '#ece8dc')   # 창 커튼·행주
VOIDC = [(6, 6, 9), (9, 9, 12), (12, 12, 16)]                                            # 검은 바깥(미탐색)
SHADE = (10, 10, 14)

def lum3(c): return .3 * c[0] + .59 * c[1] + .11 * c[2]

# ---------------------------------------------------------------- 바닥 4종 (48x48 주기 표본 — 3x3 이어 붙여도 이음새 없음)
def _vor(X, Y, g, per, seed, jit=.8):
    """주기 48 로 감기는 흔든 격자 보로노이: (가장 가까운 점 id, 경계까지 거리, 점 좌표)."""
    best = 1e9; sec = 1e9; bid = None; bc = (0, 0)
    gx = X // g; gy = Y // g
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx = gx + i; cy = gy + j
            kx = cx % per; ky = cy % per
            px = cx * g + g * (.5 - jit / 2) + _hash(kx, ky, seed) * g * jit
            py = cy * g + g * (.5 - jit / 2) + _hash(kx, ky, seed + 1) * g * jit
            d = (X + .5 - px) ** 2 + ((Y + .5 - py) * 1.15) ** 2
            if d < best: sec = best; best = d; bid = (kx, ky); bc = (px, py)
            elif d < sec: sec = d
    return bid, math.sqrt(sec) - math.sqrt(best), bc

def _flag_joint(X, Y):
    return _vor(X % 48, Y % 48, 12, 4, 1100, 1.0)[1] < 1.0

def flag_px(X, Y):
    """판석: 크기가 제각각인 넓적한 막돌 판석(흔든 격자 12px 보로노이, 벽의 네모 마름돌과 결이 다르다).
    줄눈 1단, 돌마다 톤(2~3단, 드물게 4 — 실내라 어둡다), 줄눈 바로 아래·오른쪽은 한 단 밝은 턱, 위·왼쪽은 한 단 어둡다(빛 왼쪽 위).
    잔 점·닳은 반들거림."""
    bid, e, bc = _vor(X, Y, 12, 4, 1100, 1.0)
    if e < 1.0: return FLAG[1]
    h = _hash(*bid, 1101)
    t = 3 if h < .5 else (2 if h < .88 else 4)
    if _flag_joint(X, Y - 1) or _flag_joint(X - 1, Y): t = min(4, t + 1)
    elif _flag_joint(X, Y + 1) or _flag_joint(X + 1, Y): t -= 1
    r = _hash(X, Y, 1102)
    if r < .09: t -= 1
    elif r > .96: t += 1
    c = FLAG[clamp(t, 1, 6)]
    if pn(X, Y, 6, 1103) > .82: c = mix(c, FLAG[clamp(t + 1, 1, 6)], .4)               # 닳아 반들거림
    return c
mk_floor('tc_flag', flag_px)

def cobble_px(X, Y):
    """자갈(둥근 조약돌) 바닥: 주기 48 으로 감기는 점 무리(흔든 격자)의 보로노이 — 돌마다 둥글고 위·왼쪽이 밝으며
    틈은 어둡다. 돌 크기 4~7px, 색은 COB(회) 에 GRAV(갈) 이 드문드문."""
    best = 1e9; sec = 1e9; bid = None; bc = (0, 0)
    gx = X // 6; gy = Y // 6
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx = gx + i; cy = gy + j
            kx = cx % 8; ky = cy % 8
            px = cx * 6 + 1 + _hash(kx, ky, 1111) * 4; py = cy * 6 + 1 + _hash(kx, ky, 1112) * 4
            d = (X + .5 - px) ** 2 + (Y + .5 - py) ** 2
            if d < best: sec = best; best = d; bid = (kx, ky); bc = (px, py)
            elif d < sec: sec = d
    edge = math.sqrt(sec) - math.sqrt(best)
    if edge < .9: return COB[1]
    ramp = COB if _hash(*bid, 1113) < .78 else GRAV
    t = 3 if _hash(*bid, 1114) < .55 else 4
    dx = X + .5 - bc[0]; dy = Y + .5 - bc[1]
    if dx + dy < -2.2: t += 1
    elif dx + dy > 2.2: t -= 1
    if edge < 1.8: t -= 1
    if _hash(X, Y, 1115) < .04: t += 1
    return ramp[clamp(t, 1, 6)]
mk_floor('tc_cobble', cobble_px)

def wet_px(X, Y):
    """젖은 돌: 판석과 같은 짜임인데 한 단 어둡고 푸른 물빛으로 젖었다. 돌 위 얇은 물막(덩이)에는 하늘빛 가로 반사 줄과
    물방울 점. 포도주 저장고 낮은 쪽·우물 둘레."""
    c = flag_px(X, Y)
    t = min(range(7), key=lambda k: sum(abs(c[i] - FLAG[k][i]) for i in range(3)))
    c = mix(FLAG[max(1, t - 1)], PUD[max(1, t - 1)], .5)
    if t <= 1: return c
    w = pn(X, Y, 8, 1121) * .7 + pn(X, Y, 4, 1125) * .3
    if w > .6:
        c = mix(c, PUD[3], .6)
        if _hash(X // 3, Y, 1122) > .9 and (Y % 3 == 0): c = PUD[5]
        elif _hash(X, Y, 1123) > .985: c = PUD[6]
    elif w > .56: c = mix(c, PUD[2], .5)
    elif _hash(X, Y, 1124) > .985: c = PUD[4]
    return c
mk_floor('tc_wet', wet_px)

def brick_px(X, Y):
    """주방 벽돌 바닥: 4x8 벽돌 청어뼈(헤링본) 짜임, 줄눈 1단, 벽돌마다 톤, 불 쪽에서 묻은 그을음 얼룩."""
    u = (X + Y) % 16; v = (X - Y) % 16
    bx = (X // 4); by = (Y // 4)
    horiz = ((X // 8) + (Y // 4)) % 2 == 0
    if horiz:
        lx = (X + (Y // 4) % 2 * 4) % 8; ly = Y % 4; cid = ((X + (Y // 4) % 2 * 4) // 8, Y // 4)
        if ly == 3 or lx == 7: return BRICK[1]
    else:
        lx = X % 4; ly = (Y + (X // 4) % 2 * 4) % 8; cid = (X // 4, (Y + (X // 4) % 2 * 4) // 8, 7)
        if lx == 3 or ly == 7: return BRICK[1]
    h = _hash(cid[0] % 12, cid[1] % 12, 1131)
    t = 3 if h < .5 else (4 if h < .78 else 2)
    if lx == 0 or ly == 0: t += 1
    c = mix(BRICK[clamp(t, 1, 6)], ASH[clamp(t, 1, 6)], .38)
    if pn(X, Y, 12, 1132) > .74: c = mix(c, ASHG[1], .35)
    if _hash(X, Y, 1133) < .03: c = BRICK[max(1, t - 1)]
    return c
mk_floor('tc_brick', brick_px)

# ---------------------------------------------------------------- 벽 앞면 (dlib.face_px 에 끼운다)
def ashlar_px(X, Y, H, damp=False, soot=0.0):
    """지하 마름돌 벽: 16x8 돌을 줄마다 반 어긋나게(참고 그림의 회갈 돌벽 결). 돌마다 톤, 위·왼쪽 모서리 밝고 줄눈 어둡다.
    damp: 아래로 갈수록 젖어 검고 초록 이끼·석회 자국. soot: 위쪽 그을음."""
    row = Y // 8; ly = Y % 8; off = (row % 2) * 8
    col = (X + off) // 16; lx = (X + off) % 16
    if ly == 7 or lx == 15: c = ASH[1]
    else:
        h = _hash(col % 24, row, 1201)
        t = 3 if h < .45 else (2 if h < .75 else 4)
        if ly == 0 or lx == 0: t += 1
        elif ly == 6: t -= 1
        r = _hash(X, Y, 1202)
        if r < .05: t -= 1
        elif r > .97: t += 1
        c = ASH[clamp(t, 1, 6)]
        if _hash(col % 24, row, 1203) < .2: c = mix(c, GRAV[t], .45)                   # 갈색 도는 돌
    if damp:
        wet = max(0.0, (Y - (H - 26)) / 26.0)
        if wet > 0: c = mix(c, PUD[1], .35 * wet)
        m = vnoise(X * 1.2, Y * 2, 3, 1204)
        if wet > .3 and m > .8 - .1 * wet: c = mix(c, HERB[3], .5)
        if _hash(X // 2, 0, 1205) < .1 and 6 < Y < H - 6 and _hash(X // 2, Y // 3, 1206) < .5: c = mix(c, TRIM[4], .25)   # 석회 줄
    if soot > 0:
        s = max(0.0, 1 - Y / (H * .7)) * soot
        if s > 0: c = mix(c, SHADE, .55 * s)
    return c

def plaster_px(X, Y, H):
    """주방 벽: 위는 회칠(그을려 누렇게 바랜 회벽, 벗겨진 곳에 돌이 보인다), 아래 2/5 는 마름돌 징두리."""
    rail = int(H * .55)
    if Y >= rail:
        c = ashlar_px(X, Y - rail, H - rail)
        if Y == rail: c = TRIM[2]
        elif Y == rail + 1: c = ASH[1]
        return c
    n = pn(X, Y, 6, 1211)
    c = LINEN[2] if n < .55 else mix(LINEN[1], LINEN[2], .5)
    if _hash(X, Y, 1212) < .05: c = LINEN[1]
    peel = vnoise(X, Y, 7, 1213)
    if peel > .74: c = ashlar_px(X, Y, H)                                               # 벗겨진 회칠 → 돌
    elif peel > .71: c = LINEN[1]
    c = mix(c, (40, 32, 26), .38 + .3 * (1 - Y / max(1, rail)))                               # 위로 갈수록 그을음
    return c

FACES = {'tc_cellar': lambda X, Y, H: ashlar_px(X, Y, H),
         'tc_damp': lambda X, Y, H: ashlar_px(X, Y, H, damp=True),
         'tc_kitchen': lambda X, Y, H: plaster_px(X, Y, H)}
for k in FACES: dlib.FACE_BASE[k] = ASH[3]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in FACES: return _prev_face(style, X, Y, H, seed, capL, capR)
    c = FACES[style](X, Y, H)
    if Y == 0: c = TRIM[3]                                                             # 천장 턱 밑 그늘 띠
    elif Y == 1: c = mul(c, .62)
    elif Y == 2: c = mul(c, .78)
    elif Y == 3: c = mul(c, .9)
    if Y == H - 1: c = SHADE
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .76)
    if capL and X % 16 == 0: c = mix(c, TRIM[5], .3)
    if capL and X % 16 == 1: c = mix(c, TRIM[5], .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

_tf = {}
def tc_face_tile(style, x, n, capL, capR, H):
    """벽 앞면 한 칸: 돌 줄이 이웃 칸과 이어지게 실제 칸 x 로 칠한다(dlib.face_tile 은 칸마다 흔든다)."""
    key = (style, x % 24, n, capL, capR, H)
    if key not in _tf: _tf[key] = mk(lambda xx, yy: dlib.face_px(style, (x % 24) * 16 + xx, n * 16 + yy, H, 3, capL, capR))
    return _tf[key]

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: tc_face_tile(style, i, j, i == 0, i == w - 1, h * T))

# ---------------------------------------------------------------- 천장(벽 너머): 얇은 돌 윗면 띠(5px) + 검은 바깥
BANDW = 5
_cc = {}
def cellar_ceiling(open8, seed=0):
    key = (open8, seed % 4)
    if key in _cc: return _cc[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = BANDW
    def depth(x, y):
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    def f(x, y):
        X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
        b = depth(x, y)
        if b is None:
            r = _hash(X, Y, 1301)
            return VOIDC[0] if r < .7 else (VOIDC[1] if r < .96 else VOIDC[2])
        d, side = b
        # 벽 윗면 = 쌓은 돌 윗면(가로 줄눈 결)
        row = (Y // 4); lx = (X + row % 2 * 6) % 12
        c = ASH[4] if _hash(row, (X + row % 2 * 6) // 12, 1302) < .6 else ASH[3]
        if lx == 0: c = ASH[2]
        if d == 0: c = TRIM[5] if side in ('N', 'W') else ASH[4]
        elif d == 1: c = mix(c, TRIM[4], .3)
        if d == t - 1: c = SHADE
        elif d == t - 2: c = mix(c, SHADE, .35)
        return c
    im = mk(f); _cc[key] = im; return im

def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return cellar_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)

# ---------------------------------------------------------------- 작은 도우미
def hflip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
def R(r, k): return r[clamp(k, 0, len(r) - 1)]

def box3(cv, x0, y0, x1, y1, top, ramp, seed=0, grain=.05, k0=0, planks=0, vplanks=0):
    """3/4 상자(윗면 top 행 + 앞면). 윗면은 왼쪽 위 밝고, 앞면은 왼쪽 밝고 오른쪽·아래 어둡다. planks: 윗면 가로 널 간격, vplanks: 앞면 세로 널 간격."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top:
                k = 5 if (y == y0 or x == x0) else 4
                if x >= x1 - 1: k = 3
                if planks and (y - y0) % planks == planks - 1 and y < y0 + top - 1: k -= 1
            else:
                k = 4 if x < x0 + 2 else (3 if x < x1 - 2 else 2)
                if y == y0 + top: k = 2
                if vplanks and (x - x0) % vplanks == vplanks - 1: k = 2
                if y >= y1 - 1: k = 1
            if _hash(x, y, seed + 4) < grain: k += 1 if _hash(y, x, seed + 5) < .5 else -1
            cv.px(x, y, ramp[clamp(k + k0, 1, len(ramp) - 1)])

def blob_ell(cv, cx, cy, rx, ry, ramp, base=4, seed=0, hi=True):
    """둥근 덩이(자루·빵·치즈): 왼쪽 위 밝고 오른쪽 아래 어둡다."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            k = base
            s = dx + dy
            if s < -.7: k += 1
            if hi and s < -1.0 and d > .3: k += 1
            if s > .6: k -= 1
            if d > .72 and dy > 0: k -= 1
            if _hash(x, y, seed + 3) < .05: k -= 1
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])

def shadow_floor(cv, x0, x1, y, k=2):
    """물체 밑 바닥 그늘 한 줄(반투명 아님 — 짙은 단색)."""
    for x in range(x0, x1): cv.px(x, y, SHADE)
