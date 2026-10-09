# 시계탑 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0, 가로 4칸씩).
# 땅 덩이 셋(장르 steampunk 공통 이름): oil-slick 기름 번짐(걷기) · brass-dust 놋쇠 가루(걷기) · rust-puddle 녹물 덩이(걷기).
# 가장자리 들쭉날쭉은 machine-factory/mf_wave5.edges(16 주기 사인 합 잡음을 모든 변형에 같은 씨앗으로, 모서리 들임 0.8px)를
# 읽기만 해서 쓴다 — 이웃 칸끼리 윤곽이 이어지고 덩이가 둥글게 끝난다(직각 없음).
# 구조 둘: gear-pit 톱니 구덩이(막힘, ck_base.pit_cell) · brass-rail 놋쇠 난간(위층, 막힘, mf_auto.rail_cell 과 같은 꼴을 놋쇠로).
import numpy as np
from PIL import Image
from ck_base import *
from ck_base import _hash
import mf_wave5 as W5
from mf_wave5 import edges, per16, _cell, BAY
from fr_base import hash2, sheet_from_cells
from gc_kit import autotile_sheet

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))
OILW = [FB.hx(c) for c in ('#060404', '#120c0a', '#1e1612', '#2a201a', '#3a2e24', '#5a4a36', '#8a7656')]   # 기계 기름(따뜻한 갈흑, 빛은 호박빛)
SHEEN = [FB.hx(c) for c in ('#4a2e52', '#2e4a5e', '#3a5a3a', '#6a5a24', '#6a3a2a')]
RUSTW = [FB.hx(c) for c in ('#1a0806', '#3a140a', '#5c2410', '#7e3a18', '#a25826', '#c47a3e', '#e2a46a')]  # 녹물(주황 갈색 물)
OILa = np.array(OILW, int); SHa = np.array(SHEEN, int); RWa = np.array(RUSTW, int)
BRa = np.array(FB.BRASS, int); RUa = np.array(FB.RUST, int)


# ================================================================ ① 기름 번짐(걷기, 미끄럽다)
def oil_cell(n, seed=171):
    """기계에서 샌 따뜻한 갈흑 기름: 속 = 고른 톤 2(드문 비침 3), 칸마다 다른 짧은 무지개 막 활, 북서쪽 테 안 호박빛 반사 끊긴 줄,
    가장자리 = 두껍게 고인 어두운 테 1px + 바닥이 젖어 어두워진 반투명 띠(밑 바닥 결이 비친다, 바깥으로 디더) + 튄 방울."""
    m, mN, mS = edges(n, inset=2.6, jag=2.6, rad=6.5, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    body = m >= 0
    mot = per16(X, Y, 8, seed + 1) * .6 + per16(X, Y, 4, seed + 2) * .4
    t = np.where(mot > .7, 3, 2)
    t = np.where(body & (m < 1.0), 1, t)
    nw = body & (m >= 1.0) & (m < 2.0) & ((mN < m + 1.0) | ((n & 8) == 0) & (X < 8))
    t = np.where(nw & (hash2(X // 2, Y // 2, seed + 10) > .3), 5, t)
    sl = body & (m >= 1.0) & (m < 1.9) & (mS < m + 1.0)
    t = np.where(sl & (hash2(X, Y, seed + 4) > .4), 4, t)
    rgb = np.where(body[..., None], OILa[np.clip(t, 1, 6)], rgb)
    if n != 15:
        L = 8
        cx = 3 + _hash(n, 5, seed) * 8; cy = 4 + _hash(n, 6, seed) * 7; ang = _hash(n, 7, seed) * 3.14; bend = (_hash(n, 8, seed) - .5) * .5
        for i in range(L):
            a_ = ang + bend * i
            x_ = int(round(cx + np.cos(a_) * (i - L / 2))); y_ = int(round(cy + np.sin(a_) * (i - L / 2) * .6))
            if 0 <= x_ < 16 and 0 <= y_ < 16 and m[y_, x_] > 2.0: rgb[y_, x_] = SHa[min(4, i * 5 // L)]
    al = np.where(body, 255, 0)
    wet = (m < 0) & (m >= -2.0)
    wa = np.where(m >= -1.0, 150, 95)
    wa = np.where(wet & (BAY > np.clip((m + 2.0) / 2.0, 0, 1) * .9 + .1), 0, wa)
    rgb = np.where(wet[..., None], OILa[1], rgb); al = np.where(wet, wa, al)
    drop = (m < -2.2) & (m > -4.5) & (hash2(X, Y, seed + 7) > .955)
    rgb = np.where(drop[..., None], OILa[1], rgb); al = np.where(drop, 230, al)
    return _cell(rgb, al)


# ================================================================ ② 놋쇠 가루(걷기)
def dust_cell(n, seed=183):
    """톱니가 갈려 쌓인 놋쇠 가루: 속 = 반투명 금빛 가루막(밑 바닥이 비친다) 위 밝은 낟알 점·작은 줄밥 더미(2px, 윗면 밝고 아래 그늘),
    가장자리로 갈수록 낟알이 성기게(디더), 바깥 테 1~2px 에는 흩날린 낟알만."""
    m, mN, mS = edges(n, inset=2.2, jag=3.0, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    core = m >= 1.6
    film = per16(X, Y, 4, seed + 1)
    fa = np.clip(70 + (m - 1.6) * 30, 70, 150).astype(int)
    rgb = np.where(core[..., None], BRa[np.where(film > .55, 3, 2)], rgb); al = np.where(core, fa, al)
    gr = hash2(X, Y, seed + 2)
    dens = np.clip((m + 1.5) / 4.0, 0, 1)
    speck = (gr > 1 - .35 * dens) & (m > -1.5)
    rgb = np.where(speck[..., None], BRa[np.where(hash2(Y, X, seed + 3) > .5, 5, 4)], rgb); al = np.where(speck, 255, al)
    hi = speck & (hash2(X, Y, seed + 4) > .85) & (m > 1)
    rgb = np.where(hi[..., None], BRa[6], rgb)
    # 줄밥 더미(속 칸에 1~2개, 가장자리 칸엔 0~1개)
    for i in range(2 if n == 15 else 1):
        px_ = 3 + int(_hash(n, 11 + i, seed) * 10); py_ = 3 + int(_hash(n, 14 + i, seed) * 10)
        if m[py_, px_] < 3.2: continue
        for (dx, dy, k) in ((0, 0, 5), (1, 0, 4), (-1, 1, 4), (0, 1, 3), (1, 1, 3), (2, 1, 2), (0, 2, 1), (1, 2, 1)):
            x_, y_ = px_ + dx, py_ + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = BRa[k]; al[y_, x_] = 255
    return _cell(rgb, al)


# ================================================================ ③ 녹물 덩이(걷기, 얕은 물)
def rust_cell(n, seed=197):
    """새는 관에서 고인 얕은 녹물: 속 = 주황 갈색 물(고른 톤 3, 흐린 잔물결 줄 4), 북쪽 테 안 천장 빛 반사 줄(5),
    가장자리 = 물이 마르며 남긴 진한 녹 테(1px 톤 2) + 바깥 바닥에 번진 반투명 녹 얼룩 띠(디더) + 마른 녹 점."""
    m, mN, mS = edges(n, inset=2.4, jag=2.8, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    body = m >= 0.8
    t = np.where(hash2(X // 2, Y, seed + 1) > .9, 2, 3)
    rip = (hash2(X // 3 + n * 7, Y, seed + 2) > (.88 if n != 15 else .97)) & (np.mod(Y, 3) == 0)
    t = np.where(rip, 4, t)
    t = np.where(body & (m < 1.8), 2, t)
    nw = body & (m >= 1.8) & (m < 2.8) & ((mN < m + 1.0) | ((n & 8) == 0) & (X < 8))
    t = np.where(nw & (hash2(X // 2, Y // 2, seed + 10) > .35), 5, t)
    rgb = np.where(body[..., None], RWa[np.clip(t, 1, 6)], rgb); al = np.where(body, 235, al)
    rim = (m >= 0) & (m < .8)
    rgb = np.where(rim[..., None], RUa[2], rgb); al = np.where(rim, 255, al)
    st = (m < 0) & (m >= -2.2)
    sa = np.where(m >= -1.1, 120, 80)
    sa = np.where(st & (BAY > np.clip((m + 2.2) / 2.2, 0, 1) * .9 + .1), 0, sa)
    rgb = np.where(st[..., None], RUa[3], rgb); al = np.where(st, sa, al)
    dot = (m < -1.0) & (m > -4.0) & (hash2(X, Y, seed + 7) > .95)
    rgb = np.where(dot[..., None], RUa[2], rgb); al = np.where(dot, 220, al)
    return _cell(rgb, al)


def autotile_oil(): return sheet_from_cells([oil_cell(n) for n in range(16)])
def autotile_dust(): return sheet_from_cells([dust_cell(n) for n in range(16)])
def autotile_rust(): return sheet_from_cells([rust_cell(n) for n in range(16)])
def autotile_pit(): return pit_sheet()


# ================================================================ 놋쇠 난간(위층, 막힘)
def rail_cell(m, N, E, S, W):
    """놋쇠 손잡이 관(빛 받은 윗변) + 가운데 가는 관 + 8px 마다 무쇠 기둥(놋쇠 머리) + 참나무 발 막이 판, 끝·모서리 = 둥근 머리 기둥."""
    tc = TC(16, 16, 5)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            tc.px(x, 3, 'brass', 6); tc.px(x, 4, 'brass', 4); tc.px(x, 5, 'brass', 2)
            tc.px(x, 8, 'brass', 4); tc.px(x, 9, 'brass', 2)
            tc.px(x, 12, 'oak', 4); tc.px(x, 13, 'oak', 3); tc.px(x, 14, 'oak', 2)
            if x % 8 in (3, 4):
                for y in range(6, 15):
                    if y in (8, 9): continue
                    tc.px(x, y, 'steel', 4 if x % 8 == 3 else 2)
                tc.px(x, 2, 'brass', 6 if x % 8 == 3 else 4)
    if vt:
        ya = 0 if N else 4; yb = 16 if S else 11
        for y in range(ya, yb):
            tc.px(6, y, 'brass', 6); tc.px(7, y, 'brass', 5); tc.px(8, y, 'brass', 3); tc.px(9, y, 'steel', 1)
            if y % 8 == 6:
                for x in range(5, 10): tc.px(x, y, 'brass', 5 if x < 7 else 3)
                for x in range(5, 10): tc.px(x, y + 1, 'steel', 2)
    if m not in (5, 10):
        for y in range(3, 15):
            for x in range(6, 10):
                k = 4 if x < 8 else 2
                if y == 14: k = 1
                tc.px(x, y, 'steel', k)
        tc.ell(7.5, 2.5, 2.4, 2.2, 'brass', lambda x, y: 6 if (x < 7.5 and y < 2.5) else 4)
    return MK.fin_nb(tc.img(), N, E, S, W, .62)


def rail_sheet(): return autotile_sheet(rail_cell)
