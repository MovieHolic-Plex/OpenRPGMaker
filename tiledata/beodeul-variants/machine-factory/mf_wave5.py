# 기계 공장 — 웨이브 5 보정 패스(2026-10-08): 시그니처 땅 덩이 오토타일 셋 + 바닥 변형 + 바닥 장식.
# 규칙(WAVE-BRIEF-4): 땅 덩이는 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8), 이웃이 없는 쪽은 불규칙한 가장자리.
# 가장자리 들쭉날쭉은 16 주기 1차원 사인 합 잡음을 **모든 변형에 같은 씨앗**으로 써서 이웃 칸끼리 윤곽이 이어진다(eastern-castle 과 같은 방식).
# 칸 모서리 쪽은 들임을 0.8px 로 줄여 오목 모서리(이웃 둘은 있고 대각선이 빈 칸)에서 테가 끊기지 않게 한다.
# 재질은 future-ruins 기계 램프(fr_base)·fr_mat 톤 캔버스를 그대로 쓰고, 새 램프는 기름(oil)·냉각수(cool) 둘 — 같은 7단 규칙.
import numpy as np
from PIL import Image
from mf_kit import *
from mf_kit import _hash
import fr_mat as FM
import fr_base as FB
from fr_base import STEEL, RUST, CONC, CABLE, WARN, hash2, sheet_from_cells

OIL = [FB.hx(c) for c in ('#040408', '#0a0a10', '#121219', '#1a1a24', '#262434', '#3a3650', '#6a6488')]     # 기름(푸른 흑, 빛은 보랏빛)
COOL = [FB.hx(c) for c in ('#041418', '#08282e', '#0e4248', '#16626a', '#26908e', '#5cc8bc', '#c4f4ea')]    # 냉각수(밝은 청록, 스스로 빛남)
SHEEN = [FB.hx(c) for c in ('#3c2a5a', '#2a4a66', '#2e5a4a', '#5a5228', '#6a3a46')]                     # 기름 무지개 막(보라·파랑·초록·황·자주, 어둡게)
for name, ramp in (('oil', OIL), ('cool', COOL)):
    if name not in FM.MID:
        FM.MATS.append(name); FM.MID[name] = len(FM.MATS) - 1; FM.RAMP_OF[name] = ramp
_LUT = np.zeros((len(FM.MATS), 7, 3), np.uint8)
for n, i in FM.MID.items():
    if n in FM.RAMP_OF:
        r = FM.RAMP_OF[n]
        for k in range(7): _LUT[i, k] = r[min(k, len(r) - 1)]
FM.LUT = _LUT

OILa = np.array(OIL, int); COOLa = np.array(COOL, int); STEELa = np.array(STEEL, int); RUSTa = np.array(RUST, int)
CONCa = np.array(CONC, int); CABLEa = np.array(CABLE, int); WARNa = np.array(WARN, int); SHEENa = np.array(SHEEN, int)
AMBa = np.array(FB.SIGNAL['amber'], int)
X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


# ================================================================ 가장자리 거리
def edges(n, inset, jag, rad, seed):
    """m = 이웃 없는 바깥 경계에서 안쪽까지 거리(px, 음수 = 바깥), mN = 북쪽 경계 거리(북쪽이 비었을 때만), mS 도 같이."""
    X, Y = X16, Y16
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    xx = np.arange(16) + .5
    def J(s_):
        v = sum(a * np.sin(2 * np.pi * f * xx / 16.0 + _hash(s_, f, 91) * 6.283) for f, a in ((1, 1.0), (2, .55), (3, .35), (5, .18)))
        return v / 1.6 * jag
    wr = np.clip(np.minimum(xx, 16 - xx) / 5.0, 0, 1)
    I = lambda j_: .8 + (np.maximum(inset + j_, 0) - .8) * wr
    jN = I(J(seed + 1)); jS = I(J(seed + 2)); jW = I(J(seed + 3)); jE = I(J(seed + 4))
    d = {'N': Y - jN[X], 'S': (15 - Y) - jS[X], 'W': X - jW[Y], 'E': (15 - X) - jE[Y]}
    m = np.full((16, 16), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    mN = d['N'] if miss['N'] else np.full((16, 16), 99.0)
    mS = d['S'] if miss['S'] else np.full((16, 16), 99.0)
    return m, mN, mS


def _cell(rgb, al):
    a = al if al.dtype != bool else np.where(al, 255, 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(a, 0, 255).astype(np.uint8)]), 'RGBA')


BAY = np.tile(np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0, (4, 4))


def per16(X, Y, sc, seed):
    """주기 16 값 잡음(격자 sc, 16 의 약수)."""
    g = 16 // sc
    fx = (X % 16) / sc; fy = (Y % 16) / sc
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int); tx = fx - x0; ty = fy - y0
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
    def h(i, j): return hash2(i % g, j % g, seed)
    return (h(x0, y0) * (1 - tx) + h(x0 + 1, y0) * tx) * (1 - ty) + (h(x0, y0 + 1) * (1 - tx) + h(x0 + 1, y0 + 1) * tx) * ty


# ================================================================ ① 기름 웅덩이(걷기, 미끄럽다)
def oil_cell(n, seed=71):
    """얕은 기름 웅덩이: 속 = 푸른 흑 기름(아주 고른 톤 2 + 드문 어둠), 굽이치는 무지개 막(보라·파랑·초록·황 가는 띠)과
    북서쪽 빛 점, 가장자리 = 기름이 두껍게 고인 어두운 테 1px + 바닥이 젖어 어두워진 반투명 띠(밑 바닥이 비친다) +
    바깥으로 튄 기름 방울. 바닥 재질을 가리지 않는다(반투명 띠는 밑 철판·콘크리트 결을 그대로 보인다)."""
    m, mN, mS = edges(n, inset=2.8, jag=2.4, rad=6.5, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    body = m >= 0
    t = np.where(hash2(X // 2, Y, seed + 1) > .93, 1, 2)
    t = np.where(body & (m < 1.0), 1, t)                                          # 고인 테(두꺼운 기름)
    t = np.where(body & (m >= 1.0) & (m < 1.8) & (hash2(X, Y, seed + 2) > .55), 3, t)   # 테 안쪽 얇은 빛(액면이 휜다)
    rgb = np.where(body[..., None], OILa[np.clip(t, 1, 6)], rgb)
    # 무지개 막: 16 주기 굽이 띠, 가장자리에서 2px 이상 안쪽만
    ph = Y + 2.4 * np.sin(2 * np.pi * X / 16.0 + _hash(seed, 3, 7) * 6.28) + 1.5 * np.sin(4 * np.pi * X / 16.0 + 1.3)
    band = np.mod(np.floor(ph), 8)
    on = per16(X, Y, 8, seed + 4) > .42
    sheen = body & (m > 2.2) & on & (band <= 1)
    col = (np.floor(X / 5.0 + Y / 9.0).astype(int)) % 5
    rgb = np.where(sheen[..., None], SHEENa[col], rgb)
    sheen2 = body & (m > 2.2) & on & (band == 2) & (hash2(X, Y, seed + 5) > .5)
    rgb = np.where(sheen2[..., None], OILa[4], rgb)
    # 빛 점(북서쪽에서 비친 천장 등) — 가장자리 칸에만, 칸마다 자리 다르게
    if n != 15 and _hash(n, 1, seed) > .25:
        px_ = 3 + int(_hash(n, 2, seed) * 9); py_ = 3 + int(_hash(n, 3, seed) * 8)
        if m[py_, px_] > 2.5 and m[py_, px_ + 1] > 2.5:
            rgb[py_, px_] = OILa[6]; rgb[py_, px_ + 1] = OILa[5]; rgb[py_ + 1, px_] = OILa[4]
    al = np.where(body, 255, 0)
    wet = (m < 0) & (m >= -2.0)
    wa = np.where(m >= -1.0, 130, 80)
    wa = np.where(wet & (BAY > np.clip((m + 2.0) / 2.0, 0, 1) * .9 + .1), 0, wa)            # 바깥으로 갈수록 디더로 성기게
    rgb = np.where(wet[..., None], OILa[1], rgb); al = np.where(wet, wa, al)
    drop = (m < -2.2) & (m > -4.5) & (hash2(X, Y, seed + 7) > .955)                  # 튄 방울
    rgb = np.where(drop[..., None], OILa[1], rgb); al = np.where(drop, 230, al)
    return _cell(rgb, al)


def autotile_oil(): return sheet_from_cells([oil_cell(n) for n in range(16)])


# ================================================================ ② 꺼진 바닥 냉각수 웅덩이(막힘)
def coolant_cell(n, seed=83):
    """바닥 철판이 꺼져 냉각수가 고인 구덩이: 이웃 없는 쪽 = 찢긴 철판 턱(윗면 빛 받은 강철 모 + 들쭉날쭉 찢긴 끝 + 리벳),
    북쪽 턱 밑은 3/4 로 보이는 속 벽(콘크리트 두께 → 그늘)이 액면으로 내려가고, 남·서·동 턱은 액면에 바로 닿아 어두운 물 닿는 줄.
    속 = 밝은 청록 냉각수(스스로 빛남, 고른 톤 3 + 잔물결 줄 + 거품 점). 가장자리 칸 바닥에 녹 번짐 점."""
    m, mN, mS = edges(n, inset=2.6, jag=2.6, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    LIP = 2.4
    north = (mN < m + 1.4) & (mN < 9)
    wstart = np.where(north, LIP + 3.0, LIP)
    liq = m >= wstart
    t = np.where(hash2(X // 2, Y, seed + 1) > .9, 2, 3)
    rip = (np.mod(Y + np.floor(2 * np.sin(2 * np.pi * X / 16.0 + 1.1)), 6) == 0) & (per16(X, Y, 8, seed + 2) > .5)
    t = np.where(rip, 4, t)
    t = np.where(liq & (m < wstart + 1.0) & ~north, 4, t)                          # 남·서·동 물가 밝은 띠(얕은 곳)
    t = np.where(liq & north & (m < wstart + 2.0), 1, t)                           # 북쪽 턱 그늘
    t = np.where(liq & north & (m >= wstart + 2.0) & (m < wstart + 3.0), 2, t)
    bub = liq & (hash2(X, Y, seed + 3) > .975) & (m > wstart + 1.5)
    t = np.where(bub, 6, t)
    rgb = np.where(liq[..., None], COOLa[np.clip(t, 1, 6)], rgb); al |= liq
    # 찢긴 철판 턱(윗면): 바깥 끝 1px 밝은 모, 속 쪽 1px 어둡게(찢긴 끝), 칸마다 리벳 하나
    lip = (m >= 0) & (m < LIP)
    lt = np.where(m < .9, 5, np.where(m < 1.7, 4, 2))
    lt = np.where(lip & (hash2(X, Y, seed + 5) > .8) & (m > 1.0), 3, lt)
    rgb = np.where(lip[..., None], STEELa[lt], rgb); al |= lip
    rus = lip & (hash2(X // 2, Y // 2, seed + 6) > .7) & (m > .9)                   # 찢긴 끝에 녹
    rgb = np.where(rus[..., None], RUSTa[np.where(hash2(X, Y, seed + 7) > .5, 3, 2)], rgb)
    # 북쪽 속 벽(콘크리트 두께 + 그늘) — 턱 아래에서 액면까지
    face = north & (m >= LIP) & (m < wstart)
    ft = np.where(m < LIP + 1.0, 4, np.where(m < LIP + 2.0, 2, 1))
    ft = np.where(face & (hash2(X, Y, seed + 8) > .85), ft - 1, ft)
    rgb = np.where(face[..., None], CONCa[np.clip(ft, 1, 6)], rgb); al |= face
    glow_ = face & (m >= wstart - 1.0)                                                 # 액면 빛이 벽 밑을 청록으로 물들인다
    rgb = np.where(glow_[..., None], COOLa[2], rgb)
    wl = liq & ~north & (m < wstart + .6)                                              # 남·서·동 턱 밑 물 닿는 어두운 줄
    rgb = np.where(wl[..., None], COOLa[2], rgb)
    # 턱 바깥: 액이 튄 젖은 점(반투명 없이 드문 점)
    sp = (m < 0) & (m > -2.5) & (hash2(X, Y, seed + 9) > .9)
    rgb = np.where(sp[..., None], COOLa[3], rgb); al |= sp
    a = np.where(al, 255, 0)
    return _cell(rgb, a)


def autotile_coolant(): return sheet_from_cells([coolant_cell(n) for n in range(16)])


# ================================================================ ③ 전선 그을음(걷기)
def scorch_cell(n, seed=97):
    """합선으로 그을린 바닥: 속 = 반투명 검댕(밑 철판 결·리벳이 비친다) + 갈라진 숯 딱지(불투명 검정·재 회색 점),
    가장자리 = 강철 열 변색 띠(안쪽 푸른 보라 → 바깥 볏짚 황, 디더로 옅어짐), 가장자리 칸 몇 곳에 아직 붉은 불씨 점."""
    m, mN, mS = edges(n, inset=1.8, jag=2.8, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    core = m >= 2.6
    soot = per16(X, Y, 4, seed + 1) * .6 + per16(X, Y, 2, seed + 2) * .4
    ca = np.where(soot > .5, 205, 165)
    rgb = np.where(core[..., None], CABLEa[np.where(soot > .62, 0, 1)], rgb); al = np.where(core, ca, al)
    crust = core & (per16(X, Y, 4, seed + 3) > .55) & (m > 3.6)                       # 숯 딱지(불투명)
    ct = np.where(hash2(X, Y, seed + 4) > .8, 3, 1)
    crk = crust & (np.mod(X + Y * 2 + (hash2(X // 3, Y // 3, seed + 5) * 3).astype(int), 7) == 0)
    ct = np.where(crk, 0, ct)
    rgb = np.where(crust[..., None], CABLEa[ct], rgb); al = np.where(crust, 255, al)
    ash = core & (hash2(X, Y, seed + 6) > .93)
    rgb = np.where(ash[..., None], CONCa[4], rgb); al = np.where(ash, 255, al)
    # 열 변색 띠: m 1.2..2.6 = 푸른 보라(강철 열 빛깔), 0..1.2 = 청동, -1.2..0 = 볏짚 황(디더)
    b1 = (m >= 1.2) & (m < 2.6)
    rgb = np.where(b1[..., None], np.array(FB.hx('#2c2a52')), rgb); al = np.where(b1, 150, al)
    b2 = (m >= 0) & (m < 1.2)
    rgb = np.where(b2[..., None], np.array(FB.hx('#6a4a3a')), rgb); al = np.where(b2, 125, al)
    b3 = (m >= -1.4) & (m < 0)
    on3 = BAY < np.clip((m + 1.4) / 1.4, 0, 1) * .8 + .1
    rgb = np.where((b3 & on3)[..., None], np.array(FB.hx('#8a7848')), rgb); al = np.where(b3 & on3, 95, np.where(b3, 0, al))
    # 불씨(가장자리 칸 일부)
    if n != 15 and _hash(n, 1, seed) > .45:
        for i in range(1 + int(_hash(n, 2, seed) * 2)):
            px_ = 3 + int(_hash(n, 3 + i, seed) * 10); py_ = 3 + int(_hash(n, 6 + i, seed) * 10)
            if m[py_, px_] < 3.0: continue
            rgb[py_, px_] = AMBa[5]; al[py_, px_] = 255
            for (dx, dy, k) in ((1, 0, 3), (0, 1, 2), (-1, 0, 2)):
                if 0 <= px_ + dx < 16 and 0 <= py_ + dy < 16: rgb[py_ + dy, px_ + dx] = FB.SIGNAL['red'][k]; al[py_ + dy, px_ + dx] = 255
    return _cell(rgb, al)


def autotile_scorch(): return sheet_from_cells([scorch_cell(n) for n in range(16)])
