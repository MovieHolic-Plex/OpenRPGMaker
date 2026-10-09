# 복사본(원본 eastern-castle/ek_ground.py, 2026-10-08) — 읽기 전용 원본을 건드리지 않으려고 이 폴더에 둔다. 경로만 한 단 깊게 고쳤다.
# 동양풍 성·닌자 마을 — 바닥·벽면·오토타일.
# 풀 = 버들항 ground.render(칩셋 풀 타일 섞기) 그대로, 흙길 = 칩셋 흙(16,224) 그대로, 물 = 버들항 water6 + 운하 테(v6pieces.canal6).
# 새 바닥은 칩셋 결을 밝기 순위대로 옮긴다: 흰 자갈(칩셋 모래 64,224 → suna 램프), 갈퀴 자국 모래(같은 결 + 물결 줄),
# 판석 길(돌담 막돌 규칙의 윗면판), 다다미(짚 결 + 테두리 띠), 마루 널(나무 램프 긴 널). 자체 노이즈로 발명한 얼룩 없음.
# 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8): 대나무 울타리(위층·막힘), 판석 오솔길(아래층·걷기), 자갈 마당 연석(아래층·걷기).
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ek_base import *
from ek_base import _hash
import ground as G
import v6pieces, water6

SUNAa = A(SUNA); STa = A(ST); TATa = A(TATAMI); WDa = A(WD); KUROa = A(KURO); KAWa = A(KAWARA)


# ---------------------------------------------------------------- 화소 톤 함수 (지도·표본 공용)
def suna_k(X, Y, seed=3):
    """흰 자갈 마당: 칩셋 모래(64,224) 결을 suna 톤 3.6~5.4 로(선형), 드문 굵은 자갈 점(빛 6 + 아래 그늘 3)."""
    t = chip_tones_lin(64, 224, 3.6, 5.4)
    T = t[Y % 16, X % 16].astype(int)
    pb = hash2(X // 2, Y // 2, seed) > .965
    T = np.where(pb, 6, T)
    T = np.where(np.roll(pb, 1, 0) & ~pb, 3, T)
    return np.clip(T, 1, 6)


def raked_k(X, Y, seed=4):
    """갈퀴 자국 모래(마른 정원): suna 결 위에 4px 간격 물결 줄(줄 아래 그늘 톤 −1, 위 빛 +1). 주기 48(이음새 없음)."""
    T = suna_k(X, Y, seed)
    ph = (Y + np.round(1.2 * np.sin(X * 2 * np.pi / 48.0 * 2))).astype(int)
    T = np.where(ph % 4 == 0, np.maximum(T - 1, 3), T)
    T = np.where(ph % 4 == 1, np.minimum(T + 1, 6), T)
    return np.clip(T, 1, 6)


def flag_k(X, Y, seed=6):
    """판석 길(이시다타미): 돌담 막돌 규칙(크기 제각각 네모 돌, 틈 1px)을 윗면으로 — 돌은 한 단 밝게."""
    f = np.vectorize(lambda x, y: ishigaki_k(int(x), int(y), seed, 5, hw=18, hh=12))
    return f(X, Y)


def tatami_k(X, Y):
    """다다미: 48x48 마다 같은 깔기(가로 32x16 둘 · 세로 16x32 하나 · 가로 32x16 · 반 장 16x16).
    짚 결 = 결 방향으로 1px 줄(빛 5 · 4 엇갈림) + 짚 마디 점, 긴 변 2px 테두리 띠(검은 칠 톤 3/2), 짧은 변 줄눈 1px."""
    PX = X % 48; PY = Y % 48
    # 판 정의: (x0,y0,w,h,가로?)
    mats = [(0, 0, 32, 16, True), (0, 16, 32, 16, True), (32, 0, 16, 32, False), (0, 32, 32, 16, True), (32, 32, 16, 16, False)]
    T = np.zeros(X.shape, int); M = np.zeros(X.shape, int)   # M: 0 다다미 · 1 테두리
    for (x0, y0, w, h, hor) in mats:
        sel = (PX >= x0) & (PX < x0 + w) & (PY >= y0) & (PY < y0 + h)
        lx = PX - x0; ly = PY - y0
        if hor:
            weave = np.where((lx + (ly % 2)) % 2 == 0, 5, 4)
            edge = (ly <= 1) | (ly >= h - 2)
            short = (lx == 0) | (lx == w - 1)
        else:
            weave = np.where((ly + (lx % 2)) % 2 == 0, 5, 4)
            edge = (lx <= 1) | (lx >= w - 2)
            short = (ly == 0) | (ly == h - 1)
        knot = (hash2(X // 2, Y // 2, 41) > .93)
        k = np.where(knot, weave - 1, weave)
        k = np.where(short, 3, k)
        k = np.where(edge, np.where((ly == 0) | (lx == 0) if hor else (lx == 0), 3, 2), k)
        T = np.where(sel, k, T); M = np.where(sel & edge, 1, M)
    return np.clip(T, 1, 6), M


def tatami_rgb(X, Y):
    T, M = tatami_k(X, Y)
    return np.where(M[..., None] == 1, KUROa[T + 1], TATa[T])


def board_rgb(X, Y, seed=9):
    """마루 널(대청): 가로 긴 널(폭 5px, 길이 40~64 엇갈림), 널마다 톤 흔들림(4·5), 널 사이 1px 줄눈(2), 널 위 모 +1, 드문 옹이,
    닦인 마루라 결은 가늘고 밝다(버들항 나무 램프)."""
    row = Y // 5; ly = Y % 5
    L = 48
    off = (hash2(row, 0, seed) * L).astype(int)
    col = (X + off) // L; lx = (X + off) % L
    h = hash2(col, row, seed + 1)
    T = np.where(h > .6, 5, 4)
    T = np.where(h < .15, 3, T)
    T = np.where(ly == 0, np.minimum(T + 1, 6), T)
    T = np.where(ly == 4, 2, T)
    T = np.where(lx == 0, 2, T)
    gr = (hash2(X // 6, Y, seed + 3) > .82) & (ly > 0) & (ly < 4)
    T = np.where(gr, np.maximum(T - 1, 2), T)
    kn = (hash2(X // 3, row, seed + 5) > .985) & (ly == 2)
    T = np.where(kn, 2, T)
    return WDa[np.clip(T, 1, 6)]


# ---------------------------------------------------------------- 벽면·천장 표본
def wall_face_px(X, Y, Hh, style='fusuma', seed=0):
    """실내 북쪽 벽 앞면(높이 Hh px): 맨 위 4px 검은 칠 들보(나게시) · 회벽 띠(8px) · 아래 = 맹장지(fusuma: 금 구름 무늬 종이 + 검은 테 +
    둥근 손잡이) 또는 장지(shoji: 나무 살 + 흰 종이) 또는 회벽(plaster), 맨 아래 2px 문지방(나무). 기둥 48px 마다."""
    out = np.zeros(X.shape + (3,), np.uint8)
    PL_ = A(PL); WAS = A(WASHI); GLD = A(GOLD)
    top = Y < 4
    band = (Y >= 4) & (Y < 12)
    sill = Y >= Hh - 2
    body = ~top & ~band & ~sill
    out[top] = KUROa[np.where(Y[top] == 0, 4, np.where(Y[top] < 3, 3, 1))]
    bk = np.where(Y == 4, 2, np.where(hash2(X, Y, seed) < .04, 3, 4))
    out[band] = PL_[bk[band]]
    px_ = X % 48
    if style == 'fusuma':
        pn = px_ // 24; lx = px_ % 24; ly = Y - 12; ph = Hh - 14
        frame = (lx == 0) | (lx == 23) | (ly == 0) | (ly == ph - 1)
        cloud = (np.sin((X + pn * 7) / 5.0) + np.sin(Y / 3.0 + X / 11.0)) > 1.1
        k = np.where(cloud, 5, np.where(ly < ph // 2, 6, 5))
        col = np.where(cloud[..., None], GLD[k], WAS[k])
        col = np.where(frame[..., None], KUROa[np.where(lx == 0, 4, 2)], col)
        knob = ((lx == 20) | (lx == 3)) & (np.abs(ly - ph // 2) <= 1)
        col = np.where(knob[..., None], KUROa[2], col)
        out[body] = col[body]
    elif style == 'shoji':
        lx = px_ % 24; ly = Y - 12
        bar = (lx % 6 == 0) | (ly % 7 == 0) | (lx == 23)
        col = np.where(bar[..., None], WDa[np.where(lx % 6 == 0, 4, 3)], WAS[np.where(ly < 10, 6, 5)])
        out[body] = col[body]
    else:
        k = np.where(hash2(X, Y, seed + 1) < .04, 4, 5)
        out[body] = PL_[k[body]]
    out[sill] = WDa[np.where(Y[sill] == Hh - 2, 5, 2)]
    post = (px_ >= 46)
    pk = np.where(px_ == 46, 4, 2)
    out = np.where((post & ~sill)[..., None], WDa[pk], out)
    return out


def face_sample(style, w=48, rows=3):
    Y, X = np.mgrid[0:rows * 16, 0:w]
    return Image.fromarray(wall_face_px(X, Y, rows * 16, style), 'RGB').convert('RGBA')


def ceiling_rgb(X, Y):
    """격자 천장(고텐조): 16px 격자 검은 칠 살(2px, 위·왼 빛 한 줄) + 판(짙은 나무 톤 1~2). 실내 지붕 밑 어둠 띠·벽 둘레에 깐다."""
    lx = X % 16; ly = Y % 16
    bar = (lx < 2) | (ly < 2)
    k = np.where(bar, np.where((lx == 0) | (ly == 0), 3, 2), np.where((lx + ly) % 7 == 0, 2, 1))
    return np.where(bar[..., None], KUROa[k], WDa[np.clip(k, 1, 2)])


def ishigaki_sample(w=48, rows=3, seed=11):
    tc = TC(w, rows * 16, seed); ishigaki_face(tc, 0, 0, w, rows * 16, seed=seed, batter=0); return tc.img()


# ---------------------------------------------------------------- 바닥 표본 3x3(48x48, 결 주기 16/48 → 이음새 없음)
def _img(rgb): return Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA')


def ground_suna():
    Y, X = np.mgrid[0:48, 0:48]; return _img(SUNAa[suna_k(X, Y)])


def ground_raked():
    Y, X = np.mgrid[0:48, 0:48]; return _img(SUNAa[raked_k(X, Y)])


def ground_tatami():
    Y, X = np.mgrid[0:48, 0:48]; return _img(tatami_rgb(X, Y))


def ground_board():
    Y, X = np.mgrid[0:48, 0:48]; return _img(board_rgb(X, Y))


def ground_flagpath():
    """판석 길 표본: 48 주기로 감기도록 좌표를 48 로 접는다(돌 경계가 맞물리게 두 번 그려 가장자리 줄눈을 맞춘다)."""
    Y, X = np.mgrid[0:48, 0:48]; return _img(STa[flag_k(X, Y)])


# ---------------------------------------------------------------- 오토타일
def _composed(draw):
    cells = []
    for n in range(16):
        tc = TC(32, 32, n); draw(tc, n)
        cells.append(tc.fin(.6).crop((8, 8, 24, 24)))
    return sheet_from_cells(cells)


def takegaki_cell(tc, n):
    """대나무 울타리(시호리가키풍): 칸 가운데 굵은 대 기둥 + 이웃 쪽으로 뻗는 울타리.
    동서 = 앞에서 본 가는 대 살(2px, 촘촘히) + 가로 묶음대 둘(검은 새끼 매듭 점), 남북 = 위에서 본 울타리 윗면 줄(대 마디 점)."""
    o = 8
    hasN, hasE, hasS, hasW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    for (on, x0, x1) in ((hasW, 0, o + 7), (hasE, o + 9, 32)):
        if not on: continue
        for x in range(x0, x1):
            for y in range(o + 2, o + 15):
                k = 5 if x % 2 == 0 else 3
                if (y + x * 3) % 9 == 0: k = 2                               # 대 마디
                tc.px(x, y, 'take', k)
            tc.px(x, o + 1, 'take', 6 if x % 2 == 0 else 4)
            for yy in (o + 5, o + 11):
                tc.px(x, yy, 'take', 4); tc.px(x, yy + 1, 'take', 1)
                if x % 5 == 2: tc.px(x, yy, 'kuro', 3); tc.px(x, yy + 1, 'kuro', 1)
    for (on, y0, y1) in ((hasN, 0, o + 6), (hasS, o + 9, 32)):
        if not on: continue
        for y in range(y0, y1):
            tc.px(o + 6, y, 'take', 5); tc.px(o + 7, y, 'take', 4); tc.px(o + 8, y, 'take', 2)
            if y % 4 == 0: tc.px(o + 7, y, 'take', 2)
    for y in range(o, o + 15):                                                 # 굵은 대 기둥
        tc.px(o + 6, y, 'take', 6); tc.px(o + 7, y, 'take', 4); tc.px(o + 8, y, 'take', 2)
        if y % 6 == 3: tc.px(o + 6, y, 'take', 3); tc.px(o + 7, y, 'take', 2)
    tc.px(o + 7, o - 1, 'take', 5)


def autotile_takegaki(): return _composed(takegaki_cell)


def _edge_sheet(shade, inset=0.0, jag=0.0, rad=3.0, seed=1):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m = edge_depth(n, inset=inset, jag=jag, rad=rad, seed=seed + n)
        rgb, al = shade(X, Y, m, n)
        cells.append(Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(al, 255, 0).astype(np.uint8)]), 'RGBA'))
    return sheet_from_cells(cells)


def flagpath_shade(X, Y, m, n):
    """판석 오솔길(아래층, 풀 위에 덧그림): 칸 안 = 판석(돌담 막돌 규칙 윗면, 칸 좌표 그대로 → 이웃 칸과 줄눈이 맞물린다),
    이웃 없는 쪽은 들쭉날쭉 끝(풀이 먹어 든다) + 끝 1px 그늘. 바깥은 투명."""
    T = np.vectorize(lambda x, y: ishigaki_k(int(x) + n * 7, int(y) + n * 3, 6, 5, hw=14, hh=10))(X, Y)
    al = m >= 0
    T = np.where(m < 1.0, np.maximum(T - 1, 1), T)
    return STa[T].astype(int), al


def autotile_flagpath(): return _edge_sheet(flagpath_shade, inset=1.5, jag=1.4, rad=4.0, seed=3)


def sunabed_shade(X, Y, m, n):
    """자갈 마당 연석(아래층, 흰 자갈 칸 위에 덧그림): 이웃 없는 쪽 3px 에 작은 둥근 돌 줄(빛 6·5 · 아래 그늘 2), 그 안 1px 그늘.
    안쪽 투명 — 밑의 흰 자갈이 보인다."""
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    band = (m >= -.5) & (m < 3.0)
    pebble = ((X // 3 + Y // 3) % 2 == 0)
    t = np.where(m < .8, 6, np.where(m < 2.0, 5, 3))
    t = np.where(pebble, t, np.maximum(t - 1, 2))
    rgb = np.where(band[..., None], STa[t].astype(int), rgb); al |= band
    sh = (m >= 3.0) & (m < 4.0)
    rgb = np.where(sh[..., None], SUNAa[2].astype(int), rgb); al |= sh
    return rgb, al


def autotile_sunabed(): return _edge_sheet(sunabed_shade, inset=0.0, jag=0.0, rad=3.0)


# ---------------------------------------------------------------- 지도 바닥 합성
def compose(W, H, M, water, seed=4):
    """M: 칸 마스크 — 'dirt'(흙길), 'suna'(흰 자갈), 'raked'(갈퀴 모래), 'flag'(판석), 'tatami', 'board'(마루), 'ceil'(천장/바깥 어둠).
    풀은 버들항 ground.render, 흙은 칩셋 흙, 물은 버들항 운하 테 + water6. 포장 가장자리 2px 턱."""
    Wp, Hp = W * 16, H * 16
    K = lambda m: np.kron(m, np.ones((16, 16))).astype(bool)
    pav = K(M['suna'] | M['raked'] | M['flag'] | M['tatami'] | M['board'] | M['ceil'])
    grass, lab = G.render(Wp, Hp, [], pav | K(M['dirt']), seed=seed)
    out = np.array(grass)[..., :3].astype(int)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    import fr_ground as FG
    dm = FG.soft_mask(K(M['dirt']), seed + 3, 3.0, 6.0)
    d = tiled(chip_tex(16, 224), Wp, Hp).astype(int)
    out = np.where(dm[..., None], d, out)
    ring = ~dm & ndi.binary_dilation(dm, iterations=2) & (hash2(X, Y, seed + 41) > .55)
    out = np.where(ring[..., None], (d * .86).astype(int), out)
    for key, fn in (('suna', lambda: SUNAa[suna_k(X, Y)]), ('raked', lambda: SUNAa[raked_k(X, Y)]),
                    ('tatami', lambda: tatami_rgb(X, Y)), ('board', lambda: board_rgb(X, Y)), ('ceil', lambda: ceiling_rgb(X, Y))):
        km = K(M[key])
        if km.any(): out = np.where(km[..., None], fn().astype(int), out)
    km = K(M['flag'])
    if km.any():
        ys, xs = np.nonzero(km)
        T = np.vectorize(lambda x, y: ishigaki_k(int(x), int(y), 6, 5, hw=18, hh=12))(xs, ys)
        out[ys, xs] = STa[T]
    # 포장 가장자리 턱(풀·흙 쪽): 위 모 밝게, 아래 끝 그늘 (자갈·판석만)
    ped = K(M['suna'] | M['raked'] | M['flag'])
    edge = ped & ~ndi.binary_erosion(ped, iterations=1)
    out = np.where(edge[..., None], STa[3].astype(int), out)
    sh = ~pav & np.roll(ped, 1, 0)
    out = np.where(sh[..., None], (out * .75).astype(int), out)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    if water.any():
        wl = water.tolist(); nat = np.zeros_like(water).tolist()
        img.alpha_composite(v6pieces.canal6(wl, nat))
        flow = [['S' if water[y, x] and (x > 0 and not water[y, x - 1] or x < W - 1 and not water[y, x + 1]) and (y > 0 and water[y - 1, x]) and (y < H - 1 and water[y + 1, x]) else 'still'
                 for x in range(W)] for y in range(H)]
        WA = water6.Water(wl, flow)
        img.alpha_composite(Image.fromarray(WA.frame(0), 'RGBA'))
    return img
