# 동양풍 성·닌자 마을(eastern-castle) 공용 바탕.
# 버들항 파이프라인(scripts/content/lib/city_v6: 팔레트·pz.fin 윤곽·칩셋 타일·ground.render·water6) 과
# 미래 폐허의 톤 캔버스 규약(fr_base·fr_mat: 「재질 번호 + 톤 0~6」 → 램프)을 그대로 불러 쓰고(파일은 읽기만),
# 이 장소에 처음 나오는 재질만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기, 그림자는 보랏빛으로 식고 빛은 데운다)으로 더한다:
#   kawara 짙은 회청 기와(버들항 칩셋 파란 기와 타일 결을 밝기 순위대로 옮긴다)
#   kuro   검게 칠한 판자(성 아래 단 판벽·문)          shu   붉은 칠(주칠: 도리이·다리 난간·칠기)
#   take   대나무(누런 초록)                             tatami 다다미 짚(누런 연두)
#   suna   흰 자갈(성 마당 모래·자갈)                    washi 장지 종이(따뜻한 흰색)
#   kaya   초가(버들항 칩셋 thatch 램프 그대로)          gold  금 장식(버들항 straw 램프)
# 흰 회벽 = 버들항 회벽(plaster) 램프, 나무 = 버들항 나무(wood) 램프, 돌 = 버들항 돌(stone) 램프, 잎 = 칩셋 잎 램프.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
_HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(_HERE, '..'))
sys.path.insert(0, os.path.join(VAR, 'future-ruins'))
sys.path.insert(0, VAR)
import numpy as np
from PIL import Image
import fr_mat
from fr_base import *                                   # noqa  (hash2·smooth·tnoise·recolor·chip_tex·A·edge_depth·Parts·pad16·flip·new·hx …)
from fr_base import _hash, vnoise, ROOT
from fr_mat import TC, box, cyl_k, MID, MATS
import palette as _pal

HERE = _HERE


def _r(*cs): return [hx(c) for c in cs]
KAWARA = _r('#0c0e16', '#181c28', '#232a3a', '#30394c', '#424d64', '#5a6680', '#8290aa')   # 짙은 회청 기와
KURO   = _r('#0a080e', '#141018', '#1e1822', '#2a222e', '#382e3c', '#4a3e4c', '#625464')   # 검게 칠한 판자
SHU    = _r('#2a0a10', '#5a1414', '#8e2018', '#bc3420', '#d8542a', '#ea8040', '#f6b47a')   # 주칠(붉은 칠)
TAKE   = _r('#0c1c12', '#1a3418', '#2a5222', '#3e702c', '#5a9036', '#86b44c', '#c0d880')   # 대나무
TATAMI = _r('#22200e', '#3e3a1a', '#5c5626', '#7a7436', '#98924a', '#b4ae62', '#d2cc8a')   # 다다미 짚
SUNA   = _r('#26242c', '#48444c', '#6e6a6a', '#928c86', '#b2aca2', '#cac4b8', '#e2dcd0')   # 흰 자갈
WASHI  = _r('#3a3230', '#6a6058', '#968c7e', '#bcb2a0', '#d8d0bc', '#ebe4d2', '#f8f4e8')   # 장지 종이
KAYA   = _r(_pal.OUT_CHIP['thatch'], *_pal.RAMPS_CHIP['thatch'])                             # 초가(칩셋)
GOLD   = _r(_pal.OUT_CHIP['straw'], *_pal.RAMPS_CHIP['straw'])                               # 금(칩셋 straw)
INK    = _r('#0c0c12', '#1c1c24', '#2e2e38', '#44444e', '#5e5e68', '#7c7c84', '#a0a0a6')   # 먹(병풍·족자 그림)
NEW = {'kawara': KAWARA, 'kuro': KURO, 'shu': SHU, 'take': TAKE, 'tatami': TATAMI, 'suna': SUNA, 'washi': WASHI,
       'kaya': KAYA, 'gold': GOLD, 'ink': INK}
for n in NEW:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEW.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP = dict(fr_mat.RAMP_OF); RAMP.update(NEW)


def rgb_of(mat, k): return RAMP[mat][max(0, min(6, int(k)))]


# ================================================================ 칩셋 결 → 톤 배열
_TT = {}
def chip_tones(tx, ty, lo, hi):
    """칩셋 16x16 타일의 밝기 순위를 톤 lo..hi 로(점·결이 그대로 남는다)."""
    key = (tx, ty, lo, hi)
    if key not in _TT:
        _, t = recolor(chip_tex(tx, ty), STEEL, lo, hi); _TT[key] = t.astype(int)
    return _TT[key]


def chip_tones_lin(tx, ty, lo, hi):
    key = ('lin', tx, ty, lo, hi)
    if key not in _TT:
        l = lum(chip_tex(tx, ty).astype(np.float64)); a, b = l.min(), l.max()
        _TT[key] = np.clip(np.rint(lo + (l - a) / max(1, b - a) * (hi - lo)), 0, 6).astype(int)
    return _TT[key]


# ================================================================ 기와 지붕
# 버들항 칩셋 파란 기와(뒤 경사 256,224 빛 · 앞 경사 272,224 그늘)는 세로 기와 줄 + 줄마다 빛 점이다 — 일본 기와(둥근 수키와 줄)와 같은 결.
def kawara_k(x, y, front=True):
    """기와 한 화소의 톤: front = 앞 경사(보는 쪽, 한 단 어둡다), 뒤 경사는 빛."""
    if front: return int(chip_tones(272, 224, 1, 5)[y % 16, x % 16])
    return int(chip_tones(256, 224, 2, 6)[y % 16, x % 16])


def _sori(u):
    """처마 휨: u = 0(가운데) .. 1(끝) → 위로 휘는 px 비율."""
    return max(0.0, u) ** 2.4


def jroof(tc, x0, y0, W, H, kind='hip', yb=.42, e=None, sori=3, flare=2, ridge=True, oni=True, mat='kawara', gold=False,
          ends='LR', gable=None):
    """일본 기와 지붕(3/4 위에서 본다): 뒤 경사(빛) · 앞 경사(그늘) · 양 끝 삼각(서 빛·동 그늘, 모임지붕/팔작지붕).
    처마선은 양 끝에서 sori px 만큼 위로 휘고 flare px 바깥으로 뻗는다. 마룻대 3px + 양 끝 귀면 기와(oni) 돌출.
    kind='gable' 이면 양 끝 삼각이 없다(맞배: 양 끝은 박공 널 두 줄). 팔작(irimoya) = 모임 + 위쪽 끝에 작은 박공 띠.
    gable: 앞 경사에 얹는 박공(치도리 하후) 목록 [(cx, w, h)] — 앞을 보는 흰 삼각 + 기와 테."""
    e = e if e is not None else min(W // 3, int(H * .95))
    if kind == 'gable': e = 0
    el = e if 'L' in ends else 0; er = e if 'R' in ends else 0
    YB = H * yb
    for y in range(H):
        f = (y + .5) / H
        for x in range(-flare, W + flare):
            xx = x + .5
            # 처마 휨: 아래쪽 줄에서 양 끝일수록 위로 올라간다(아래 끝 줄을 깎는다), 위쪽은 바깥으로 뻗는다
            u = abs(xx - W / 2.0) / (W / 2.0)
            lift = sori * _sori(u)
            if y > H - 1 - lift: continue
            if x < 0 or x >= W:
                if y < H - 1 - lift - 3 or y > H - 1 - lift: continue      # 뻗은 처마 끝은 아래 3줄만
            xl = el * (1 - f); xr = W - er * (1 - f)
            if el and xx < el and y < YB * (1 - xx / el): continue
            if er and xx > W - er and y < YB * (1 - (W - xx) / er): continue
            if xx < xl:   k = kawara_k(y, x) + 1                              # 서 끝(결은 세로로 돈다)
            elif xx > xr: k = kawara_k(y, x) - 1
            elif y < YB:  k = kawara_k(x, y, front=False)
            else:         k = kawara_k(x, y, front=True) - (1 if y > H - 4 - lift else 0)
            m = mat
            if el and xx < el and abs(y - YB * (1 - xx / el)) < 1: m, k = mat, 6       # 추녀마루(빛)
            if er and xx > W - er and abs(y - YB * (1 - (W - xx) / er)) < 1: m, k = mat, 3
            if el and abs(xx - xl) < 1 and y > 0 and y >= YB * .6: m, k = mat, 5
            if er and abs(xx - xr) < 1 and y > 0 and y >= YB * .6: m, k = mat, 2
            if y >= H - 2 - lift: k = 2 if y == H - 2 - lift else 1                       # 처마 끝 기와(막새) 줄
            if y == H - 2 - lift and (x % 4 == 1): k = 4                                   # 막새 둥근 점
            if kind == 'gable' and (x < 1 or x >= W - 1): m, k = 'wood', (5 if x < 1 else 2)
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    if ridge:                                                                          # 마룻대(3px, 위 빛 · 아래 그늘)
        rl = el if el else 0; rr = W - er if er else W
        ry = int(round(YB)) - 1
        for x in range(int(rl), int(rr)):
            tc.px(x0 + x, y0 + ry - 1, mat, 6); tc.px(x0 + x, y0 + ry, mat, 4); tc.px(x0 + x, y0 + ry + 1, mat, 2)
            if x % 3 == 0: tc.px(x0 + x, y0 + ry, mat, 5)
        if oni:                                                                        # 귀면 기와(마룻대 양 끝 솟은 덩이)
            for (ex, side) in ((int(rl), -1), (int(rr) - 1, 1)):
                c = 'gold' if gold else mat
                for j in range(5):
                    for i in range(3):
                        xx = ex + i - 1
                        tc.px(x0 + xx, y0 + ry - 1 - j, c, (6 if i == 0 else 4 if i == 1 else 2) if j < 4 else 3)
                if gold:                                                               # 금 꼬리 장식(지느러미처럼 바깥으로 휜다)
                    for j in range(3): tc.px(x0 + ex + side * 2, y0 + ry - 4 - j, 'gold', 5 - j)
                    tc.px(x0 + ex + side * 3, y0 + ry - 6, 'gold', 4)
    for (cx, gw, gh) in (gable or ()):
        chidori(tc, x0 + cx, y0 + int(YB) + 1, gw, gh)


def chidori(tc, cx, ytop, w, h, mat='kawara'):
    """치도리 하후: 앞 경사에 얹은 앞을 보는 박공 — 흰 회벽 삼각 + 그 위 기와 테(ㅅ자, 왼 빛·오른 그늘) + 아래 끝 휜 처마."""
    half = w / 2.0
    for j in range(h):
        hw = half * (j + 1) / h
        for x in range(int(cx - hw), int(cx + hw) + 1):
            d = x + .5 - cx
            if abs(d) > hw: continue
            edge = abs(d) > hw - 3
            if edge: tc.px(x, ytop + j, mat, 6 if d < 0 else 2)                         # 기와 테
            elif abs(d) > hw - 4: tc.px(x, ytop + j, 'wood', 2)                         # 박공 널 그늘
            else:
                k = 5 if d < 0 else 4
                if j > h - 4: k = 3
                tc.px(x, ytop + j, 'plaster', k)
    for x in range(int(cx - half) - 1, int(cx + half) + 2):                              # 아래 처마 줄(휜 끝)
        u = abs(x + .5 - cx) / (half + 1)
        y = ytop + h - int(round(1.5 * u * u))
        tc.px(x, y, mat, 2); tc.px(x, y + 1, mat, 1)
    tc.px(int(cx), ytop - 1, mat, 6); tc.px(int(cx) - 1, ytop, mat, 6)                  # 꼭지
    for j in range(2, 5): tc.px(int(cx), ytop + j, 'gold', 5 if j == 2 else 4)           # 박공 꼭지 금 장식(게 눈)


# ================================================================ 벽
def plaster_wall(tc, x0, y0, x1, y1, seed=0, posts=24, beam=True, base_k=5):
    """흰 회벽(앞면): 버들항 회벽 램프 톤 4~5, 오른쪽 2px 그늘, 위 처마 그늘 2px, 드문 얼룩 점. posts px 마다 나무 기둥(위·아래 벽에 묻힘).
    beam = 위쪽 가로 인방(나무)."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            k = base_k
            if x >= x1 - 2: k -= 1
            if x < x0 + 1: k += 1
            if y < y0 + 2: k -= 2                                       # 처마 그늘
            elif y < y0 + 3: k -= 1
            h = _hash(x, y, seed + 3)
            if h < .04: k -= 1
            tc.px(x, y, 'plaster', clamp(k, 1, 6))
    if posts:
        for px_ in range(int(x0) + posts // 2, int(x1) - 2, posts):
            for y in range(int(y0) + 2, int(y1)):
                tc.px(px_, y, 'wood', 4); tc.px(px_ + 1, y, 'wood', 2)
    if beam:
        for x in range(int(x0), int(x1)):
            tc.px(x, y0 + 3, 'wood', 4 if x < x1 - 2 else 3); tc.px(x, y0 + 4, 'wood', 2)


def board_wall(tc, x0, y0, x1, y1, mat='kuro', seed=0, bw=4, base=3, battens=16):
    """판벽(앞면): 세로 널 bw px, 널마다 톤 흔들림, 왼쪽 모 +1, 오른쪽 줄 −1, 가로 띠목(battens px 마다)."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            col = (x - x0) // bw; lx = (x - x0) % bw
            k = base + (1 if _hash(col, 0, seed + 5) > .7 else 0) - (1 if _hash(col, 1, seed + 5) < .15 else 0)
            if lx == 0: k += 1
            elif lx == bw - 1: k -= 1
            if x >= x1 - 2: k -= 1
            if _hash(x, y, seed + 6) < .05: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    if battens:
        for yy in range(int(y0) + battens // 2, int(y1) - 1, battens):
            for x in range(int(x0), int(x1)): tc.px(x, yy, mat, base + 2); tc.px(x, yy + 1, mat, 1)


def lattice_window(tc, x0, y0, w=6, h=7, kind='bars'):
    """성 창(격자창·화살 틈): 나무 틀(왼 빛 · 오른 그늘), 속 어둠, 세로 살(2px 간격). 아래 턱 그늘 1px."""
    for y in range(y0 - 1, y0 + h + 1):
        for x in range(x0 - 1, x0 + w + 1):
            if x0 <= x < x0 + w and y0 <= y < y0 + h:
                if kind == 'bars' and (x - x0) % 2 == 1: tc.px(x, y, 'wood', 4 if y > y0 else 3)
                else: tc.px(x, y, 'dark', 2 if y < y0 + 2 else 1)
            else:
                tc.px(x, y, 'wood', 5 if (x < x0 or y < y0) else 2)
    for x in range(x0 - 1, x0 + w + 1): tc.px(x, y0 + h + 1, 'plaster', 2)


def sama(tc, x, y, kind='tri'):
    """흙벽 총안(사마): 작은 세모·네모·동그라미 구멍(속 어둠 + 아래 오른쪽 빛 테)."""
    pts = {'tri': [(0, 2), (1, 2), (2, 2), (1, 1), (1, 0)], 'sq': [(0, 0), (1, 0), (0, 1), (1, 1)],
           'circ': [(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)]}[kind]
    for (i, j) in pts: tc.px(x + i, y + j, 'dark', 1)
    mx = max(i for i, _ in pts); my = max(j for _, j in pts)
    for i in range(mx + 2): tc.px(x + i, y + my + 1, 'plaster', 6)


def ishigaki_k(X, Y, seed=0, base=4, hw=13, hh=6):
    """돌담(이시가키) 톤: 크기가 조금씩 다른 네모진 막돌(폭 8~hw, 높이 4~hh) 줄쌓기, 틈 1px 어둠(톤 1),
    돌마다 위·왼 모 +1, 아래·오른 모 −1, 돌 안 칩셋 돌 결(드문 −1). 행 높이·돌 폭은 해시로 정한다(이음새 없음, 32 주기)."""
    # 줄: 높이 4~hh, 행 경계는 Y 해시로 정한다
    row = 0; yy = 0; ry0 = 0
    while True:
        rh = 4 + int(_hash(row, 0, seed + 1) * (hh - 3))
        if yy + rh > Y: ry0 = yy; break
        yy += rh; row += 1
    ly = Y - ry0
    off = int(_hash(row, 1, seed + 2) * 9)
    xx = 0; col = 0; cx0 = 0
    XX = X + off
    while True:
        cw = 8 + int(_hash(col, row, seed + 3) * (hw - 7))
        if xx + cw > XX: cx0 = xx; break
        xx += cw; col += 1
    lx = XX - cx0
    if ly == rh - 1 or lx == cw - 1: return 1
    h = _hash(col, row, seed + 4)
    k = base + (1 if h > .78 else 0) - (1 if h < .16 else 0)
    if ly == 0 or lx == 0: k += 1
    elif ly == rh - 2 or lx == cw - 2: k -= 1
    else:
        g = chip_tones(336, 336, 0, 6)[Y % 16, X % 16]
        if g <= 1 and _hash(X, Y, seed + 5) < .45: k -= 1
    return clamp(k, 1, 6)


def ishigaki_face(tc, x0, y0, x1, y1, seed=0, batter=0, base=4, mat='stone'):
    """돌담 앞면. batter = 위로 갈수록 안으로 드는 기울기(px, 양쪽 각각) — 성 기단 사다리꼴."""
    Hh = y1 - y0
    for y in range(int(y0), int(y1)):
        f = (y - y0) / max(1, Hh - 1)
        ins = int(round(batter * (1 - f) ** 1.6))                       # 아래로 갈수록 휘어 넓어진다(오기 곡선)
        for x in range(int(x0) + ins, int(x1) - ins):
            k = ishigaki_k(x - x0, y - y0, seed, base)
            if x >= x1 - ins - 2: k -= 1
            if x < x0 + ins + 1: k += 1
            if y == y0: k = 5 if k > 1 else k
            tc.px(x, y, mat, clamp(k, 1, 6))


def put_img(dst, src, x, y): dst.alpha_composite(src, (int(x), int(y)))


def leaf_tex():
    """버들항 덤불 그림(칩셋 결)의 잎 톤 표본: 덤불 32x32 를 밝기 순위로 1..6 톤 배열로."""
    if 'leaf' not in _TT:
        import bdv
        b = np.array(bdv.trees('bush')[0])
        a = b[..., 3] > 200
        l = lum(b[..., :3].astype(np.float64))
        vals = np.unique(l[a]); rk = np.searchsorted(vals, l) / max(1, len(vals) - 1)
        t = np.clip(np.rint(1 + rk * 5), 1, 6).astype(int)
        t = np.where(a, t, 0)
        _TT['leaf'] = t
    return _TT['leaf']
