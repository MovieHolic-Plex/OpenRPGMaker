# 대초원 오토타일 2종(16변형, 번호 = 위1·오른2·아래4·왼8) + 바닥 표본 3종.
#  autotile-gametrail  짐승이 밟아 다진 흙길(아래층 투명 덧그림): 굽 자국 + 가장자리에 마른 풀 잔털
#  autotile-drygrass   빽빽한 키 큰 마른 풀 덩이(아래층, 걷기·사람 아래): 세로 줄기 결, 윗가장자리는 이삭 끝이 들쭉날쭉
import math
from vc_base import *
from wl import edge_depth, sheet_from_cells, tone_img
from vc_base import _dry_col, DRY_LOOK
import plains_auto as PA

E = P('trail'); DRYP = P('dry'); OLP = P('olive')

def _auto(shader, seed, inset, jag, rad):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = edge_depth(n, inset, jag, rad, seed)
        rgb, alpha = shader(X, Y, m, n, seed)
        a = np.where(alpha, 255, 0).astype(np.uint8)
        cells.append(Image.fromarray(np.dstack([np.asarray(rgb).astype(np.uint8), a]), 'RGBA'))
    return sheet_from_cells(cells)

# ---------------------------------------------------------------- 짐승 흙길
def trail_shader(X, Y, m, n, seed):
    sd = seed * 3
    base = tnoise(16, 16, 8, sd) * 0.6 + tnoise(16, 16, 4, sd + 1) * 0.4
    T = 4 + np.rint((base - 0.5) * 2.4)
    h = hash2(X, Y, sd + 5)
    T = np.where(h > 0.94, 6, np.where(h < 0.06, 3, T))
    # 굽 자국: 갈라진 두 점 짝(4x4 격자마다 하나 꼴, 길이 주기 16)
    ox = (hash2(X // 5, Y // 5, sd + 8) * 3).astype(int); oy = (hash2(X // 5, Y // 5, sd + 9) * 3).astype(int)
    hv = (hash2(X // 5, Y // 5, sd + 7) > 0.62)
    lx = X % 5 - ox; ly = Y % 5 - oy
    hoof = hv & (ly == 0) & ((lx == 0) | (lx == 2))
    T = np.where(hoof, 2, T); T = np.where(hv & (ly == 1) & ((lx == 0) | (lx == 2)), 3, T)
    T = np.where((m >= 0) & (m < 1.0) & ((X + Y) % 2 == 0), 3, np.where((m >= 0) & (m < 2.0), np.minimum(T, 4), T))
    rgb = E[np.clip(T, 0, 6).astype(int)]
    tuft = (m < 0.6) & (m > -2.2) & (hash2(X, Y, sd + 11) > 0.62 + 0.06 * np.abs(m))
    tcol = DRYP[(hash2(X, Y, sd + 12) * 4 + 2).astype(int).clip(2, 5)]
    rgb = np.where(tuft[..., None], tcol, rgb)
    return rgb, (m >= 0) | tuft

def game_trail(): return _auto(trail_shader, 21, 2.6, 2.4, 6.0)

# ---------------------------------------------------------------- 빽빽한 마른 풀
def grass_tone(X, Y, sd):
    off = (hash2(X, X * 0 + 3, sd) * 7).astype(int)
    v = (Y + off) % 7
    T = np.select([v == 0, v <= 2, v <= 4, v == 5], [6, 5, 4, 3], 2)
    T = np.where(hash2(X, Y, sd + 1) > 0.9, T - 1, T)
    lean = (X + (Y // 3)) % 5 == 0
    return np.where(lean, np.maximum(T - 1, 2), T)

def drygrass_shader(X, Y, m, n, seed):
    sd = seed * 5
    T = grass_tone(X, Y, sd)
    # 윗가장자리(이웃 없는 북쪽)는 이삭 끝이 위로 삐죽: m 대신 북쪽 깊이만 더 들쭉날쭉
    tipcut = (hash2(X, Y // 2, sd + 4) * 2.4)
    alpha = (m >= 0) | ((m > -tipcut) & (Y < 8) & ((n & 1) == 0) & ((X % 2) == 0))
    T = np.where((m >= 0) & (m < 1.0), np.where((X % 2) == 0, 6, 2), T)
    rgb = DRYP[np.clip(T, 0, 6).astype(int)]
    low = (m >= 1.0) & (Y > 11) & (hash2(X, Y, sd + 8) > 0.55)                 # 밑동 올리브 초록
    rgb = np.where(low[..., None], OLP[3], rgb)
    return rgb, alpha

def dry_grass(): return _auto(drygrass_shader, 23, 2.4, 2.6, 6.0)

# ---------------------------------------------------------------- 바닥 표본 3x3칸(48x48), 이어 붙여도 이음새 없음
def _recolor_tile(tile, ramp, lo=1, hi=6):
    a = np.array(tile.convert('RGB')).astype(float)
    l = a[:, :, 0] * 0.3 + a[:, :, 1] * 0.59 + a[:, :, 2] * 0.11
    order = np.argsort(np.argsort(l.reshape(-1))).reshape(l.shape) / (l.size - 1)
    T = np.rint(lo + order * (hi - lo)).astype(int)
    return T

def ground_veldt():
    """마른 초원 바닥: 버들항 잔디 타일(칩셋 0,128)의 결을 마른 풀 색으로 옮겨 3x3 으로 잇고, 잔 풀 끝·씨앗 점을 찍는다."""
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    t = np.array(pz.chip(0, 128, 16, 16).convert('RGB'))
    rgb = np.tile(t, (3, 3, 1)).astype(int)
    out = rgb.copy()
    for c in np.unique(rgb.reshape(-1, 3), axis=0):
        m = (rgb == c).all(-1); out[m] = _dry_col(tuple(int(v) for v in c), *DRY_LOOK[0])
    tip = (hash2(X, Y, 401) > 0.955); out = np.where(tip[..., None], DRYP[6], out)
    tip2 = np.roll(tip, 1, 0); out = np.where(tip2[..., None], DRYP[3], out)
    grn = (hash2(X // 2, Y // 2, 402) > 0.96); out = np.where(grn[..., None], OLP[4], out)
    return Image.fromarray(out.astype(np.uint8), 'RGB').convert('RGBA')

def ground_sand():
    """경기장 모래: 칩셋 모래 타일(64,224) 결을 밝은 모래 램프로(밝기 순위 보존) + 갈퀴로 쓴 얕은 줄 + 잔 자갈."""
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    T0 = _recolor_tile(pz.chip(64, 224, 16, 16), None, 3, 5)
    T = np.tile(T0, (3, 3))
    T = np.where(hash2(X, Y, 411) > 0.97, 6, T)
    rake = ((Y + (tnoise(S, S, 12, 412) * 3).astype(int)) % 12 == 0) & (hash2(X // 6, Y, 413) > 0.3)
    T = np.where(rake, 3, T); T = np.where(np.roll(rake, 1, 0), np.minimum(T + 1, 6), T)
    peb = (hash2(X // 2, Y // 2, 414) > 0.975) & ((X + Y) % 2 == 0); T = np.where(peb, 2, T)
    return tone_img(T, 'sandA')

def ground_trail():
    S = 48; X, Y = np.meshgrid(np.arange(S), np.arange(S))
    n = tnoise(S, S, 12, 421) * 0.5 + tnoise(S, S, 6, 422) * 0.5
    T = np.rint(3.0 + n * 2.4 + (hash2(X, Y, 423) - 0.5) * 0.8).astype(int).clip(3, 6)
    hv = hash2(X // 4, Y // 4, 424) > 0.6
    T = np.where(hv & (Y % 4 == 1) & ((X % 4 == 0) | (X % 4 == 2)), 2, T)
    return tone_img(T, 'trail')

from wl import tone_img

def grass_patch(mask, seed=31, Wc=None, Hc=None):
    """지도용 마른 풀 덩이(아래층): 칸 마스크를 화소 단위로 흔들어(주기 잡음) 들쭉날쭉한 덩이로, 줄기 결 + 윗가장자리 이삭 끝."""
    Hc = len(mask); Wc = len(mask[0]); Wp, Hp = Wc * 16, Hc * 16
    m0 = np.kron(np.array(mask, bool), np.ones((16, 16), bool))
    disk = np.hypot(*np.mgrid[-7:8, -7:8]) <= 7.2
    m0 = ndi.binary_opening(m0, structure=disk)                           # 칸 모서리를 둥글린다
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((tnoise(Wp, Hp, 16, seed) - 0.5) * 18 + (tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 5).astype(int)
    dy = np.rint((tnoise(Wp, Hp, 16, seed + 2) - 0.5) * 14 + (tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 4).astype(int)
    m = m0[np.clip(Y + dy, 0, Hp - 1), np.clip(X + dx, 0, Wp - 1)]
    T = grass_tone(X, Y, seed * 5)
    # 윗가장자리: 위 화소가 밖이면 줄기 끝을 1~4 화소 위로 뽑는다(짝수 열만, 이삭 6)
    up = m & ~np.roll(m, 1, 0)
    tips = np.zeros_like(m); tipT = np.zeros(m.shape, int)
    L = (hash2(X, Y, seed + 7) * 5).astype(int)
    ys, xs = np.where(up & (X % 2 == 0))
    for yy, xx, ll in zip(ys, xs, L[ys, xs]):
        for k in range(1, ll + 1):
            if yy - k >= 0: tips[yy - k, xx] = True; tipT[yy - k, xx] = 6 if k == ll else 5
    T = np.where(tips, tipT, T)
    inner = ndi.binary_erosion(m, iterations=2)
    low = m & np.roll(~m, -1, 0)                                      # 아래 가장자리 밑동 그늘(1화소, 짝수 열만)
    T = np.where(low & (X % 3 != 0), 3, T)
    a = (m | tips)
    rgb = DRYP[np.clip(T, 0, 6)]
    base = m & (Y % 7 >= 5) & (hash2(X, Y, seed + 9) > 0.6)
    rgb = np.where(base[..., None], OLP[3], rgb)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(a, 255, 0).astype(np.uint8)]), 'RGBA')
from scipy import ndimage as ndi

def paving_soft(mask, joins=None, seed=41):
    """옛 돌길·앞마당 판석(아래층): 버들항 칩셋 판석 결, 굵은 연석 없이 가장자리 1화소만 어둡고 바깥 1~2화소에 마른 풀 잔털."""
    Hc = len(mask); Wc = len(mask[0]); Wp, Hp = Wc * 16, Hc * 16
    m = np.kron(np.array(mask, bool), np.ones((16, 16), bool))
    jm = np.kron(np.array(joins, bool), np.ones((16, 16), bool)) if joins is not None else np.zeros_like(m)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    T = np.array(pz.chip(192, 176, 16, 16).convert('RGB'))
    rgb = np.tile(T, (Hc, Wc, 1)).astype(int)
    for cy in range(Hc):                                               # 칸마다 판석 결을 뒤집어 16px 반복을 깬다
        for cx in range(Wc):
            k = int(hash2(np.array(cx), np.array(cy), seed + 5) * 4)
            t = T[:, ::-1] if k & 1 else T
            t = t[::-1] if k & 2 else t
            rgb[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16] = t
    edge = m & ~ndi.binary_erosion(m, border_value=1) & ~ndi.binary_dilation(jm)
    rgb = np.where(edge[..., None], (rgb * 0.80).astype(int), rgb)
    worn = m & (hash2(X // 3, Y // 3, seed) > 0.93); rgb = np.where(worn[..., None], (rgb * 0.86).astype(int), rgb)
    out = ndi.binary_dilation(m, iterations=2) & ~m & ~jm
    tuft = out & (hash2(X, Y, seed + 1) > 0.66)
    rgb = np.where(tuft[..., None], DRYP[(hash2(X, Y, seed + 2) * 3 + 3).astype(int).clip(3, 5)], rgb)
    crack_in = m & ~edge & (hash2(X, Y, seed + 3) > 0.985); rgb = np.where(crack_in[..., None], DRYP[4], rgb)   # 판석 틈의 마른 풀
    a = np.where(m | tuft, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA')
from vc_base import ST

def earth_patch(mask, seed=51, amp=9, open_r=7.2):
    """밟혀 드러난 흙 바닥 덩이(아래층): 칸 마스크를 화소 단위로 흔들어 들쭉날쭉하게, 다진 흙 결 + 굽 자국, 가장자리 풀 잔털."""
    Hc = len(mask); Wc = len(mask[0]); Wp, Hp = Wc * 16, Hc * 16
    m0 = np.kron(np.array(mask, bool), np.ones((16, 16), bool))
    if open_r:
        disk = np.hypot(*np.mgrid[-7:8, -7:8]) <= open_r
        m0 = ndi.binary_closing(ndi.binary_opening(m0, structure=disk), structure=disk)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx = np.rint((tnoise(Wp, Hp, 8, seed) - 0.5) * amp + (tnoise(Wp, Hp, 4, seed + 1) - 0.5) * 4).astype(int)
    dy = np.rint((tnoise(Wp, Hp, 8, seed + 2) - 0.5) * amp + (tnoise(Wp, Hp, 4, seed + 3) - 0.5) * 4).astype(int)
    m = m0[np.clip(Y + dy, 0, Hp - 1), np.clip(X + dx, 0, Wp - 1)]
    tex = np.array(ground_trail().convert('RGB'))
    rgb = tex[Y % 48, X % 48].astype(int)
    inner = ndi.binary_erosion(m, iterations=1, border_value=1)
    e1 = m & ~inner
    rgb = np.where(e1[..., None], E[3], rgb)
    near = ndi.binary_dilation(m, iterations=2) & ~m
    tuft = near & (hash2(X, Y, seed + 9) > 0.7)
    rgb = np.where(tuft[..., None], DRYP[(hash2(X, Y, seed + 10) * 3 + 3).astype(int).clip(3, 5)], rgb)
    spr = m & (hash2(X, Y, seed + 11) > 0.985); rgb = np.where(spr[..., None], DRYP[5], rgb)
    a = np.where(m | tuft, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), 'RGBA')
