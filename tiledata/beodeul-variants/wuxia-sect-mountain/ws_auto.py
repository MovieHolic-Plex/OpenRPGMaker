# 산중 무림 문파 — 땅 덩이 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 64x64 = 4x4칸).
# 가장자리는 ek_wave5.edges(두 겹 주기 사인 물결, 모든 변형에 같은 씨앗 → 이웃 칸 윤곽이 이어진다, 칸 모서리 들임 0.8px)로
# 불규칙하고 둥글게. 속 결은 16 주기(cobble per=16, 칸 좌표 % 16)라 어떤 칸끼리 붙어도 이음새가 없다.
#   ① autotile-mossflag   이끼 낀 돌판 덩이(걷기)   — 산문 앞·옛 마당의 깨진 판석이 이끼에 묻힌 땅
#   ② autotile-leafpile   낙엽 쌓임(걷기)           — 단풍(붉은·주황)과 은행(노랑) 잎이 두툼히 쌓인 더미
#   ③ autotile-mistgrass  안개 낀 풀 덩이(걷기)      — 짙은 산 풀 포기 위로 가로 안개 띠(반투명 2단)가 걸린 풀숲
#   ④ autotile-gorgepool  바위 기슭 계곡 웅덩이(막힘) — 폭포 밑 물웅덩이: 화강암 막돌 기슭 + 물가 흰 거품 + 북쪽 기슭 앞면
#   ⑤ autotile-trail      흙 산길 가장자리(걷기)    — 칩셋 흙 속 + 화강암 자갈·풀 포기가 먹어 든 끝
import numpy as np
from PIL import Image
from ws_base import *
from ws_base import _hash, _cell
from fr_ground import vn_arr
from fr_base import sheet_from_cells, cell_of

X, Y = X16, Y16
STa = np.array(ST, int)


def clip_(k): return max(1, min(6, int(k)))


# ================================================================ ① 이끼 낀 돌판 덩이
def slab_tone(X, Y, seed=101):
    """16 주기 깨진 판석: 가로 줄눈(y≈7, 1px 물결) 위·아래 줄의 세로 줄눈 자리를 엇갈려(위 x≈5, 아래 x≈12) 판 넷.
    판마다 톤(3·4·5), 위·왼 모 +1 · 아래·오른 모 −1, 칩셋 바위 결 잔 점, 판 하나에 짧은 금. 반환 (톤, 판 번호, 줄눈)."""
    hy = 7 + np.round(np.sin(2 * np.pi * X / 16.0 + 1.3) * .8).astype(int)
    top = Y < hy
    vx = np.where(top, 5 + (Y // 4) % 2 * 0, 12)
    vx = vx + np.where(top, np.round(np.sin(Y / 2.3)).astype(int) * 0, 0)
    lx = np.where(X >= vx, X - vx, X + 16 - vx)                                     # 판 안 x(감김)
    sid = np.where(top, 0, 2) + (X >= vx).astype(int)
    ly = np.where(top, Y, Y - hy)
    sh = np.where(top, hy, 16 - hy)
    sw = np.where(top, 16, 16)
    hv = np.array([_hash(i, 1, seed) for i in range(4)])[sid]
    k = 4 + (hv > .6).astype(int) - (hv < .15).astype(int)
    g = chip_tones_lin(336, 336, 0, 6)[Y % 16, X % 16]
    k = np.where((g <= 1) & (hash2(X, Y, seed + 2) < .55), k - 1, k)
    k = np.where((ly == 0) | (lx == 0), k + 1, k)
    k = np.where((ly == sh - 2) | (lx == sw - 2), k - 1, k)
    joint = (ly == sh - 1) | (lx == sw - 1)
    crack = (sid == int(_hash(2, 2, seed) * 4)) & (np.abs(lx - 3 - ly * 1.4) < .55) & (ly > 0) & (ly < sh - 2)
    k = np.where(crack, 2, k)
    return np.clip(k, 1, 6), sid, joint


def mossflag_cell(n, seed=101):
    """속 = 깨진 판석(slab_tone: 16 주기, 칸에 판 넷) — 줄눈은 이끼로 메워지고(1px 짙은 이끼),
    잡음 덩이 이끼 방석이 판 위를 군데군데 덮는다(위 끝 빛 · 아래 끝 그늘). 가장자리 = 판 끝이 들쭉날쭉 끊기며 이끼 테 → 바깥 이끼 점."""
    m, mN, mS = edges(n, inset=2.4, jag=2.6, rad=7.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    ct, sid, joint = cobble(X, Y, seed + 3, per=16, k=2)                           # 칸에 판 넷(흔든 중심) — 바른 격자가 아니라 깨진 판석
    st = np.where(joint, 1, np.clip(ct, 2, 5))
    g = chip_tones_lin(336, 336, 0, 6)[Y % 16, X % 16]
    st = np.where(~joint & (g <= 1) & (hash2(X, Y, seed + 2) < .6), st - 1, st)       # 칩셋 바위 결(잔 어둠 점)
    st = np.where(~joint & (g >= 6) & (hash2(X, Y, seed + 8) < .4), st + 1, st)
    inside = m >= 1.2
    st = np.where(m < 2.0, st - 1, st)                                              # 끝 판은 풀에 묻혀 어둡다
    rgb = np.where(inside[..., None], STa[np.clip(st, 1, 6)], rgb); al |= inside
    rgb = np.where((inside & joint & (hash2(X, Y, seed + 4) > .35))[..., None], KOKEa[np.where(X % 3 == 0, 3, 2)], rgb)
    # 판 모서리 이끼 방석(판 번호마다 한 모서리, 3~5px 둥근 덩이 — 위 끝 빛 · 아래 끝 그늘) + 가장자리 쪽 판은 이끼가 더 덮는다
    cush = np.zeros((16, 16), bool)
    edge_moss = (m < 3.2) & (vn_arr(X, Y, 4, seed + 5, per=16) > .45)
    cush = inside & (cush | edge_moss)
    up = np.roll(cush, 1, 0); dn = np.roll(cush, -1, 0)
    kt = np.where(~up, 5, np.where(~dn, 3, 4))
    rgb = np.where(cush[..., None], KOKEa[np.clip(kt, 1, 6)], rgb)
    rim = (m >= 0) & (m < 1.2)
    rgb = np.where(rim[..., None], KOKEa[np.where(hash2(X, Y, seed + 11) > .5, 4, 3)], rgb); al |= rim
    fr = (m >= -1.8) & (m < 0) & (hash2(X, Y, seed + 12) > .6)
    rgb = np.where(fr[..., None], KOKEa[np.where(Y % 2, 4, 5)], rgb); al |= fr
    if n != 15 and _hash(n, 1, seed) > .45:                                         # 가장자리 칸: 떨어진 돌 조각 하나
        px_ = 2 + int(_hash(n, 2, seed) * 11); py_ = 2 + int(_hash(n, 3, seed) * 11)
        if -2.5 < m[py_, px_] < -.5:
            for (dx, dy, k) in ((0, 0, 5), (1, 0, 4), (0, 1, 3), (1, 1, 2)): rgb[py_ + dy, px_ + dx] = STa[k]; al[py_ + dy, px_ + dx] = True
    return _cell(rgb, al)


# ================================================================ ② 낙엽 쌓임
def _leaf_stamp(rgb, al, x0, y0, kind, base, ramp):
    """잎 하나(3x3 단풍 별 · 3x2 은행 부채 · 2x2 마른 잎). 칸 안(감김 없이 16 주기 좌표에서 % 16)."""
    if kind == 0:   pts = ((1, 0, 1), (0, 1, 0), (1, 1, 1), (2, 1, 0), (1, 2, -1), (0, 2, -2), (2, 2, -2))
    elif kind == 1: pts = ((0, 0, 1), (1, 0, 1), (2, 0, 0), (0, 1, 0), (1, 1, 0), (2, 1, -1), (1, 2, -2))
    else:           pts = ((0, 0, 1), (1, 0, 0), (0, 1, 0), (1, 1, -1))
    for (dx, dy, d) in pts:
        xx, yy = (x0 + dx) % 16, (y0 + dy) % 16
        rgb[yy, xx] = ramp[clip_(base + d)]; al[yy, xx] = True


def leaf_carpet(seed=201):
    """16 주기 낙엽 깔개(속 칸 한 장): 짙은 흙 바탕 위에 잎을 세 겹(아래 어둡게 → 위 밝게) 찍는다."""
    rgb = SOILa[np.where(hash2(X, Y, seed) > .5, 3, 2)].copy(); al = np.ones((16, 16), bool)
    for layer, (base_d, cnt) in enumerate(((-1, 20), (0, 13), (1, 7))):
        for i in range(cnt):
            x0 = int(_hash(i, layer, seed + 1) * 16); y0 = int(_hash(i, layer, seed + 2) * 16)
            h = _hash(i, layer, seed + 3)
            ramp = AKIa if h < .5 else (GINKa if h < .8 else SOILa)
            base = (4 if h < .5 else 4 if h < .8 else 3) + base_d
            _leaf_stamp(rgb, al, x0, y0, int(_hash(i, layer, seed + 4) * 3), base, ramp)
    return rgb


_CARPET = None
def leafpile_cell(n, seed=211):
    """속 = 두툼한 낙엽 깔개(단풍·은행·마른 잎 세 겹). 북쪽 끝은 쌓인 더미의 위 모(한 단 밝은 잎 띠), 남쪽 끝은 잎 밑 그늘 한 줄.
    가장자리 = 들쭉날쭉 + 바깥으로 흩어진 잎(멀수록 드물게)."""
    global _CARPET
    if _CARPET is None: _CARPET = leaf_carpet()
    m, mN, mS = edges(n, inset=2.8, jag=2.8, rad=8.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    car = _CARPET.copy()
    north = (mN < m + 1.0) & (mN < 3.0)
    car = np.where((inside & north & (m < 2.0))[..., None], np.minimum(car + 24, 255), car)       # 더미 윗모 빛
    south = (mS < m + 1.0) & (mS < 1.0)
    car = np.where((inside & south)[..., None], SOILa[1], car)                                     # 더미 밑 그늘
    rgb = np.where(inside[..., None], car, rgb); al |= inside
    # 흩어진 잎(바깥 0~4px)
    for i in range(10):
        x0 = int(_hash(i, n, seed + 5) * 14); y0 = int(_hash(i, n, seed + 6) * 14)
        mm = m[min(15, y0 + 1), min(15, x0 + 1)]
        if not (-4.0 < mm < 0): continue
        if _hash(i, n, seed + 7) > (1.0 + mm / 4.0): continue
        h = _hash(i, n, seed + 8)
        _leaf_stamp(rgb, al, x0, y0, 2 if h > .6 else int(h * 3), 4, AKIa if h < .55 else GINKa)
    return _cell(rgb, al)


# ================================================================ ③ 안개 낀 풀 덩이
MISTGRASS = None
def _mg_ramp():
    """안개 낀 풀 램프: 칩셋 잎 램프 톤을 안개(청백) 쪽으로 40% 옮긴 7단 — 이슬 젖은 희뿌연 풀."""
    return np.array([(np.array(LEAFa[k]) * .6 + np.array(MISTa[min(6, k + 1)]) * .4).astype(int) for k in range(7)])


def mistgrass_cell(n, seed=301):
    """속 = 칩셋 잔디(0,128) 결을 안개 풀 램프로(불투명 — 희뿌연 풀밭이 덩이로 읽힌다) + 키 큰 산 풀 포기(16 주기 자리 일곱, 세 획 + 밑 그늘) +
    가로 안개 줄기(짧은 획 둘, 톤 6). 가장자리 = 들쭉날쭉 끝에서 밑 풀과 섞이는 디더 한 줄(2x2 엇갈림) + 바깥으로 삐친 풀 포기."""
    import ground as G
    m, mN, mS = edges(n, inset=2.4, jag=3.0, rad=8.0, seed=seed)
    MG = _mg_ramp()
    lawn = np.array(G.tex(0, 128))[..., :3].astype(np.float64)
    l = lum(lawn); vals = np.unique(l); rk = np.searchsorted(vals, l) / max(1, len(vals) - 1)
    T = np.clip(np.rint(3 + rk * 2.6), 1, 6).astype(int)
    rgb = MG[T].copy(); a = np.where(m >= 1.2, 255, 0)
    dith = (m >= 0) & (m < 1.2) & (((X // 2) + (Y // 2)) % 2 == 0)
    a = np.where(dith, 255, a)
    for i in range(7):
        tx = int(_hash(i, 1, seed + 1) * 16); ty = int(_hash(i, 2, seed + 1) * 16)
        if m[ty, tx] < -1.5: continue
        for (dx, dy, k) in ((0, 0, 2), (0, -1, 3), (-1, -1, 3), (1, -1, 3), (0, -2, 4), (-1, -3, 5), (1, -3, 4), (0, -3, 5)):
            xx, yy = (tx + dx) % 16, (ty + dy) % 16
            if m[yy, xx] < -1.5: continue
            rgb[yy, xx] = MG[k] if m[yy, xx] >= 1.2 else LEAFa[k]; a[yy, xx] = 255
    for i in range(2):
        sx0 = int(_hash(i, 1, seed + 21) * 16); sy0 = 3 + int(_hash(i, 2, seed + 21) * 10); ln = 4 + i * 3
        for dx in range(ln):
            xx = (sx0 + dx) % 16
            if m[sy0, xx] < 2.0: continue
            rgb[sy0, xx] = MISTa[6]
            if 0 < dx < ln - 1 and m[sy0 + 1, xx] >= 2.0: rgb[sy0 + 1, xx] = MG[5]
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a.astype(np.uint8)]), 'RGBA')


# ================================================================ ④ 바위 기슭 계곡 웅덩이
def gorgepool_cell(n, seed=401):
    """이웃 없는 쪽 = 화강암 막돌 기슭(둥근 바위 3x3/칸, 바위 사이 이끼). 북쪽 기슭은 바위 앞면이 물로 내려가며 그늘(3/4),
    남·서·동 기슭은 바위 윗면 + 물에 닿는 젖은 줄. 물가 1~2px = 흰 거품 점(폭포 웅덩이), 속 = 버들항 운하 물 톤(맑은 청록, 드문 잔물결)."""
    m, mN, mS = edges(n, inset=3.0, jag=2.4, rad=8.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    STONE = 5.0
    north = (mN < m + 1.6) & (mN < 10)
    wstart = np.where(north, STONE + 2.4, STONE)
    water = m >= wstart
    nz = vn_arr(X, Y, 8, seed + 3, per=16)
    wt = 3 - ((hash2(X // 2, Y, seed + 3) > .9) & (nz < .5)).astype(int)
    wt = np.where(water & north & (m < wstart + 2.5), 1, wt)
    wt = np.where(water & north & (m >= wstart + 2.5) & (m < wstart + 3.5), 2, wt)
    rip = (n != 15) & (((Y == 6) & (X >= 4) & (X < 8)) | ((Y == 12) & (X >= 9) & (X < 13)))
    wt = np.where(rip & (m > 7.5), 5, wt)
    rgb = np.where(water[..., None], MIZUa[np.clip(wt, 1, 6)], rgb); al |= water
    foam = water & ~north & (m < wstart + 1.1) & (hash2(X // 3, Y // 3, seed + 5) > .2)       # 물가 거품
    rgb = np.where(foam[..., None], MISTa[np.where((X + Y) % 3 == 0, 6, 5)], rgb)
    foam2 = water & ~north & (m >= wstart + 1.1) & (m < wstart + 2.0) & (hash2(X, Y, seed + 6) > .7)
    rgb = np.where(foam2[..., None], MIZUa[5], rgb)
    nfoam = water & north & (m >= wstart) & (m < wstart + .9) & (hash2(X, Y, seed + 7) > .5)
    rgb = np.where(nfoam[..., None], MISTa[4], rgb)
    ct, cid, gap = cobble(X, Y, seed + 9, per=16, k=3)
    band = (m >= 0) & (m < STONE)
    st = np.where(m < .9, np.maximum(ct - 1, 1), ct)
    rgb = np.where(band[..., None], GRANa[np.clip(st + 1, 1, 6)], rgb); al |= band
    moss = band & gap & (hash2(X, Y, seed + 11) > .4)
    rgb = np.where(moss[..., None], KOKEa[np.where(Y % 2 == 0, 4, 3)], rgb)
    face = north & (m >= STONE) & (m < STONE + 2.4)
    rgb = np.where(face[..., None], GRANa[np.where(gap, 1, np.where(m < STONE + 1.1, 3, 2))], rgb); al |= face
    lip = band & ~north & (m >= STONE - 1.0)
    rgb = np.where((lip & (ct <= 3))[..., None], GRANa[2], rgb)
    damp = (m >= -1.2) & (m < 0) & (hash2(X, Y, seed + 13) > .5)
    rgb = np.where(damp[..., None], LEAFa[2], rgb); al |= damp
    return _cell(rgb, al)


# ================================================================ ⑤ 흙 산길 가장자리
def trail_cell(n, seed=501):
    """속 = 칩셋 흙(ground-trail 과 같은 결). 이웃 없는 쪽: 풀이 먹어 든 들쭉날쭉 끝 + 끝 그늘, 끝을 따라 화강암 자갈(2x2~3x2, 빛 + 그늘),
    흙 위로 삐친 풀 포기, 바깥 2px 닳은 풀에 흙 알갱이."""
    import ws_ground as WG
    m, mN, mS = edges(n, inset=2.2, jag=2.4, rad=6.5, seed=seed)
    d = WG.trail_rgb(X, Y)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    rgb = np.where(inside[..., None], d, rgb); al |= inside
    rgb = np.where((inside & (m < 1.0))[..., None], SOILa[2], rgb)
    nw = (m >= 1.0) & (m < 2.0) & (mS < m + .5)
    rgb = np.where(nw[..., None], (d * .82).astype(int), rgb)
    spk = (m >= -2.2) & (m < 0) & (hash2(X, Y, seed + 1) > .72)
    rgb = np.where(spk[..., None], SOILa[np.where(hash2(X, Y, seed + 2) > .5, 3, 4)], rgb); al |= spk
    for i in range(2 + int(_hash(n, 2, seed) * 2)):                                 # 화강암 자갈
        px_ = 1 + int(_hash(n, 30 + i, seed) * 12); py_ = 1 + int(_hash(n, 40 + i, seed) * 13)
        if not (.6 <= m[py_, px_] < 3.4): continue
        w = 3 if _hash(n, 50 + i, seed) > .5 else 2
        for dx in range(w):
            for dy in range(2):
                k = 6 if (dx == 0 and dy == 0) else (5 if dy == 0 else 3)
                if dx == w - 1: k -= 1
                rgb[min(15, py_ + dy), min(15, px_ + dx)] = GRANa[k]
        for dx in range(w): rgb[min(15, py_ + 2), min(15, px_ + dx)] = SOILa[1]
    for i in range(2 + int(_hash(n, 1, seed) * 3)):                                 # 풀 포기
        tx = 1 + int(_hash(n, 10 + i, seed) * 14); ty = 2 + int(_hash(n, 20 + i, seed) * 13)
        if not (0.3 <= m[ty, tx] < 3.0): continue
        for (dx, dy, k) in ((0, 0, 3), (0, -1, 5), (-1, -1, 4), (1, -2, 6), (0, -2, 5)):
            x_, y_ = tx + dx, ty + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
    return _cell(rgb, al)


def autotile_mossflag(): return sheet_from_cells([mossflag_cell(n) for n in range(16)])
def autotile_leafpile(): return sheet_from_cells([leafpile_cell(n) for n in range(16)])
def autotile_mistgrass(): return sheet_from_cells([mistgrass_cell(n) for n in range(16)])
def autotile_gorgepool(): return sheet_from_cells([gorgepool_cell(n) for n in range(16)])
def autotile_trail(): return sheet_from_cells([trail_cell(n) for n in range(16)])

AUTOS = [('autotile-mossflag', autotile_mossflag, 'mossy flagstone (walk)'), ('autotile-leafpile', autotile_leafpile, 'fallen leaves pile (walk)'),
         ('autotile-mistgrass', autotile_mistgrass, 'misty grass (walk)'), ('autotile-gorgepool', autotile_gorgepool, 'gorge pool (blocked)'),
         ('autotile-trail', autotile_trail, 'mountain dirt trail (walk)')]
