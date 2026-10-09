# 제국 도시 바닥 — 버들항 땅 섞기(ground.render: 칩셋 풀 타일)·칩셋 흙(16,224) 그대로, 그리고 칩셋 판석(192,176)·둥근 돌(208,160)
# 결을 밝기 순위 그대로 회색 석재 램프로 옮긴 포석, 미래 폐허 기계 재질 규약의 강철판 바닥(16x16 판·리벳·미끄럼 돌기)과
# 콘크리트(fr_ground.concrete_px)를 쓴다. 자체 노이즈로 발명한 바닥 없음 — 칩셋의 점·결이 남는다.
# 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8): 철제 울타리(위층·막힘), 대로 가장자리 연석(아래층), 경계 표시 띠(아래층).
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ec_base import *
from ec_base import _hash
import ground as G
import fr_ground as FG

GSTa = A(GST)


# ---------------------------------------------------------------- 화소 톤 함수 (지도·표본 공용, per = 주기)
def flag_k(X, Y, seed=3, per=None, sl=32):
    """회색 판석(광장·큰 길): 32x32 네모 큰 판(벽돌 줄쌓기가 아니다 — 넓게 깔아도 벽으로 읽히지 않게), 판 안 결 = 칩셋 모래흙(64,224)
    밝기를 톤 4~5 로 좁게, 줄눈 1px 톤 2(아래·오른), 판 위·왼 모 톤 5~6, 판마다 결 위치를 옮겨 반복을 숨긴다, 드문 가는 금."""
    t = chip_tones_lin(64, 224, 3.6, 5.2)
    PX = X % per if per else X; PY = Y % per if per else Y
    sx = PX // sl; sy = PY // sl; lx = X % sl; ly = Y % sl; e = sl - 1
    ox = (hash2(sx, sy, seed) * 16).astype(int); oy = (hash2(sx, sy, seed + 1) * 16).astype(int)
    T = t[(Y + oy) % 16, (X + ox) % 16].astype(int)
    T = np.where((lx == e) | (ly == e), 2, T)
    T = np.where(((lx == 0) | (ly == 0)) & (lx != e) & (ly != e), np.minimum(T + 1, 6), T)
    T = np.where(((lx == e - 1) | (ly == e - 1)) & (lx != e) & (ly != e), np.maximum(T - 1, 3), T)
    hc = hash2(sx, sy, seed + 5)
    u = (lx + (hc * 11).astype(int)) % sl
    cr = (hc < .12) & (np.abs(ly - (u * (.35 + hc) + sl * .2 + 2 * np.sin(u / 3.0 + hc * 7)).astype(int)) == 0) & (lx > 3) & (lx < sl - 4) & (ly < sl - 3)
    T = np.where(cr, 3, T)
    return np.clip(T, 1, 6)


def cobble_k(X, Y, seed=5):
    """회색 둥근 돌(보도·마당): 칩셋 둥근 돌(208,160) 결을 톤 2~5 로."""
    t = chip_tones_lin(208, 160, 2.2, 4.9)
    T = t[Y % 16, X % 16].copy()
    h = hash2(X // 16, Y // 16, seed)
    T = T + np.where(h < .06, -1, 0)
    return np.clip(T, 1, 6)


def plate_rgb(Wp, Hp, seed=9, per=None):
    """철판 대로 바닥: 기계 재질 규약의 바닥판(16x16 한 칸, 모서리 리벳 넷, 줄눈 아래·오른 톤 1 · 위·왼 +1).
    미래 폐허 마당보다 한 단 밝은 회청(쓰는 도시, 닦인 판), 판 다섯에 하나만 미끄럼 돌기, 녹은 줄눈 곁에 아주 조금."""
    tc = TC(Wp, Hp, seed)
    panels(tc, 0, 0, Wp, Hp, 'steel', 3, 16, 16, face='top', seed=seed, vary=0, joint=1)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    PX = X % per if per else X; PY = Y % per if per else Y
    hp = hash2(PX // 16, PY // 16, seed + 3)
    tc.t = np.where((hp < .1) & (tc.t > 1) & (tc.t < 6), tc.t - 1, tc.t)
    tread = (hash2(PX // 16, PY // 16, seed + 2) < .2) & ((X % 16) > 2) & ((X % 16) < 13) & ((Y % 16) > 2) & ((Y % 16) < 13)
    d1 = tread & ((X + Y) % 4 == 0) & ((X - Y) % 8 < 3)
    tc.t = np.where(d1, np.minimum(tc.t + 1, 6), tc.t)
    d2 = tread & ((X + Y) % 4 == 1) & ((X - Y) % 8 < 3)
    tc.t = np.where(d2, np.maximum(tc.t - 1, 1), tc.t)
    sc = (hash2(PX, PY, seed + 7) > .975) & (tc.t > 1) & (tc.t < 6)            # 바퀴 긁힘 점
    tc.t = np.where(sc, tc.t - 1, tc.t)
    pass                                                                  # 닦인 판: 녹 없음
    tc.grain(.03)
    return np.array(tc.img())[..., :3]


def soot_conc(X, Y, seed=7, per=None):
    """그을린 콘크리트(공장 마당): 칩셋 모래흙(64,224) 결을 콘크리트 램프 톤 3~5 로(선형), 32px 판 줄눈(−1, 군데 메워짐),
    판마다 톤 흔들림은 6%만, 그을음은 작은 점 덩이(4px)로 드물게, 기름 얼룩 점. 넓게 깔아도 바둑판·얼룩무늬가 되지 않게."""
    t = chip_tones_lin(64, 224, 3.0, 5.0)
    T = t[Y % 16, X % 16].astype(int)
    PX = X % per if per else X; PY = Y % per if per else Y
    h = hash2(PX // 32, PY // 32, seed)
    T = T + np.where(h < .03, -1, 0)
    jn = ((Y % 32 == 31) | (X % 32 == 31)) & (hash2(PX // 4, PY // 4, seed + 6) > .15)
    T = np.where(jn, np.maximum(T - 1, 2), T)
    T = np.where(((Y % 32 == 0) | (X % 32 == 0)) & ~jn & (hash2(PX // 3, PY // 3, seed + 7) > .5), np.minimum(T + 1, 6), T)
    sp = (hash2(PX // 4, PY // 4, seed + 21) > .93) & (hash2(PX, PY, seed + 22) > .35)
    T = np.where(sp, np.maximum(T - 1, 1), T)
    return np.clip(T, 1, 6)


# ---------------------------------------------------------------- 바닥 표본 3x3(48x48, 이음새 없음: 결은 16 주기)
def _sample(T, ramp): return Image.fromarray(A(ramp)[T], 'RGB').convert('RGBA')


def ground_ironplate(seed=9):
    return Image.fromarray(plate_rgb(48, 48, seed, per=48), 'RGB').convert('RGBA')


def ground_graystone(seed=3):
    """표본 3x3칸: 지도는 32px 판이지만 48 로 이어 붙도록 표본은 24px 판 2x2 로(결·줄눈 규칙 같음)."""
    Y, X = np.mgrid[0:48, 0:48]
    return _sample(flag_k(X, Y, seed, per=48, sl=24), GST)


def ground_cobble(seed=5):
    """회색 둥근 돌 마당(창고 바닥·뒷마당): 칩셋 둥근 돌(208,160) 결을 회색 석재 램프로(길은 버들항 거리 돌 그대로 쓴다)."""
    Y, X = np.mgrid[0:48, 0:48]
    return _sample(cobble_k(X, Y, seed), GST)


def ground_sootyard(seed=7):
    Y, X = np.mgrid[0:48, 0:48]
    return _sample(soot_conc(X, Y, seed, per=48), CONC)


# ---------------------------------------------------------------- 오토타일 16변형
def _composed(draw):
    """draw(tc, n) 가 32x32 톤 캔버스(가운데 16x16 이 칸, 둘레 8px 여백)에 그린다 → 윤곽 → 가운데를 자른다."""
    cells = []
    for n in range(16):
        tc = TC(32, 32, n); draw(tc, n)
        cells.append(tc.fin(.6).crop((8, 8, 24, 24)))
    return sheet_from_cells(cells)


def fence_cell(tc, n):
    """철제 울타리: 칸 가운데 각진 강철 기둥(공 머리) + 이웃 쪽으로 뻗는 창살 울타리.
    동서 = 앞에서 본 창살(3px 간격 세로 살 + 창끝 + 가로대 둘), 남북 = 위에서 본 가로대 줄(살 머리 점)."""
    o = 8
    hasN, hasE, hasS, hasW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    for (on, x0, x1) in ((hasW, 0, o + 7), (hasE, o + 9, 32)):
        if not on: continue
        for x in range(x0, x1):
            tc.px(x, o + 6, 'steel', 5); tc.px(x, o + 7, 'steel', 2)          # 위 가로대
            tc.px(x, o + 12, 'steel', 4); tc.px(x, o + 13, 'steel', 1)        # 아래 가로대
            if x % 3 == 1:                                                    # 세로 살 + 창끝
                for y in range(o + 3, o + 15): tc.px(x, y, 'steel', 4 if y < o + 12 else 3)
                tc.px(x, o + 2, 'steel', 6); tc.px(x - 1, o + 3, 'steel', 5); tc.px(x + 1, o + 3, 'steel', 3)
    for (on, y0, y1) in ((hasN, 0, o + 6), (hasS, o + 9, 32)):
        if not on: continue
        for y in range(y0, y1):
            tc.px(o + 6, y, 'steel', 5); tc.px(o + 7, y, 'steel', 4); tc.px(o + 8, y, 'steel', 2)
            if y % 3 == 0: tc.px(o + 7, y, 'steel', 6); tc.px(o + 7, y + 1, 'steel', 1)
    alone = not (hasN or hasE or hasS or hasW)
    for y in range(o + 2, o + 15):                                             # 기둥
        tc.px(o + 6, y, 'steel', 5); tc.px(o + 7, y, 'steel', 4); tc.px(o + 8, y, 'steel', 2)
    tc.ell(o + 7.5, o + 1.5, 1.8 if not alone else 2.4, 1.8 if not alone else 2.4, 'steel', lambda x, y: 6 if x < o + 7 else 4)
    for x in range(o + 5, o + 10): tc.px(x, o + 15, 'gst', 3 if x < o + 9 else 2)  # 받침 돌


def autotile_ironfence(): return _composed(fence_cell)


def _edge_sheet(shade, inset=0.0, jag=0.0, rad=3.0, seed=1):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m = edge_depth(n, inset=inset, jag=jag, rad=rad, seed=seed)
        rgb, al = shade(X, Y, m, n)
        cells.append(Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(al, 255, 0).astype(np.uint8)]), 'RGBA'))
    return sheet_from_cells(cells)


def curb_shade(X, Y, m, n):
    """대로 가장자리 연석(아래층, 대로 칸 위에 덧그림): 이웃이 없는 쪽 4px — 회색 마름 연석 윗면(빛 모 6 · 5 · 4, 8px 마다 이음)
    + 1px 어두운 도랑. 안쪽(대로)은 투명 — 밑의 철판이 보인다. 모퉁이는 반지름 3 으로 둥글다."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    band = (m >= -0.5) & (m < 3.0)
    t = np.where(m < .6, 6, np.where(m < 1.6, 5, 4))
    joint = ((X % 8 == 7) & ((n & 1) == 0) & (Y < 4)) | ((X % 8 == 7) & ((n & 4) == 0) & (Y > 11)) | \
            ((Y % 8 == 7) & ((n & 8) == 0) & (X < 4)) | ((Y % 8 == 7) & ((n & 2) == 0) & (X > 11))
    t = np.where(joint & band, 3, t)
    rgb = np.where(band[..., None], GSTa[t].astype(int), rgb); al |= band
    gut = (m >= 3.0) & (m < 4.0)
    rgb = np.where(gut[..., None], A(STEEL)[1].astype(int), rgb); al |= gut
    return rgb, al


def autotile_curb(): return _edge_sheet(curb_shade, inset=0.0, jag=0.0, rad=3.0)


def hazard_shade(X, Y, m, n):
    """경계 표시 띠(아래층, 격납고 앞·위험 구역 바닥에 칠한 노랑·검정 사선 4px, 12% 벗겨짐 — 글자 없음). 안쪽 투명."""
    rgb = np.zeros((16, 16, 3), int)
    band = (m >= 0.5) & (m < 4.5)
    on = (((X + Y) // 3) % 2 == 0)
    t = np.where(on, 4, 1)
    worn = hash2(X, Y, 61) < .12
    col = np.where(on[..., None], A(WARN)[np.where(worn, 3, 4)].astype(int), A(CABLE)[np.where(worn, 3, 2)].astype(int))
    rgb = np.where(band[..., None], col, rgb)
    rim = (m >= 0.5) & (m < 1.3)
    rgb = np.where((rim & on)[..., None], A(WARN)[5].astype(int), rgb)
    return rgb, band


def autotile_hazard(): return _edge_sheet(hazard_shade, inset=0.0, jag=0.0, rad=1.0)


# ---------------------------------------------------------------- 지도 바닥 합성
def compose(W, H, M, seed=4):
    """M: 칸 단위 마스크 — 'plate'(철판 대로), 'flag'(회색 판석), 'cob'(둥근 돌), 'soot'(그을린 콘크리트), 'dirt'(흙길), 'lawn'(풀).
    풀은 버들항 ground.render, 흙은 칩셋 흙. 포장 가장자리는 버들항처럼 2px 턱(빛 모 + 그늘)."""
    Wp, Hp = W * 16, H * 16
    K = lambda m: np.kron(m, np.ones((16, 16))).astype(bool)
    pav = K(M['plate'] | M['flag'] | M['cob'] | M['soot'])
    grass, lab = G.render(Wp, Hp, [], pav | K(M['dirt']), seed=seed)
    out = np.array(grass)[..., :3].astype(int)
    out = (out * np.array([.94, .96, .98])).astype(int)                     # 도시 그을음: 풀빛을 한 단 차갑게
    Y, X = np.mgrid[0:Hp, 0:Wp]
    # 흙길(성 밖) — 칩셋 흙 + 가장자리 흔들기
    dm = FG.soft_mask(K(M['dirt']), seed + 3, 3.0, 6.0)
    d = tiled(chip_tex(16, 224), Wp, Hp).astype(int)
    out = np.where(dm[..., None], (d * .94).astype(int), out)
    ring = ~dm & ndi.binary_dilation(dm, iterations=2) & (hash2(X, Y, seed + 41) > .55)
    out = np.where(ring[..., None], (d * .82).astype(int), out)
    # 포장
    lay = [('soot', lambda: A(CONC)[soot_conc(X, Y, seed + 5)]), ('cob', lambda: tiled(chip_tex(160, 160), Wp, Hp)),
           ('flag', lambda: GSTa[flag_k(X, Y, seed + 7)]), ('plate', lambda: plate_rgb(Wp, Hp, seed + 9))]
    for key, fn in lay:
        km = K(M[key])
        if km.any(): out = np.where(km[..., None], fn().astype(int), out)
    # 포장 가장자리 턱(풀·흙 쪽): 위 모 밝게, 아래 끝 그늘
    edge = pav & ~ndi.binary_erosion(pav, iterations=1)
    out = np.where(edge[..., None], GSTa[2].astype(int), out)
    top = pav & ~np.roll(pav, 1, 0) & ~edge
    out = np.where(top[..., None], GSTa[5].astype(int), out)
    sh = ~pav & np.roll(pav, 1, 0)
    out = np.where(sh[..., None], (out * .7).astype(int), out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
