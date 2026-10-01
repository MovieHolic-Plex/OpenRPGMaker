"""월드맵 설계 데모 2단계 — 층 분리 렌더러와 새 칸 생성기.

원칙: 원본(EasyRPG World.png 개선판)의 조각을 다시 조립하거나, 원본 팔레트·질감·외곽선으로 손 도트를 찍는다.
생성 이미지·트레이싱 없음. 새 칸은 world-plus-terrain.png 에 모이고 칸마다 출처(reassembled / hand-pixel)를 남긴다.

층: 바닥(G: 풀·눈·모래·흙·늪·바다·강) → 물체(O: 숲·산 — 바닥 위에 핀 색으로 얹음) → 도로 → 다리 → 어귀 디더 → 사이트 아이콘.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

HERE = Path(__file__).resolve().parent
# [worldmap-kit 복사본] 원본 저장소 경로 삽입 제거(같은 폴더의 worldmap_easyrpg_plus 를 쓴다)
import worldmap_easyrpg_plus as wm  # noqa: E402

SEA, GRASS, DIRT, SAND, MARSH, SNOW, FOREST, MOUNT, SFOREST, SMOUNT = range(10)
RIVER = 10
ICE = 11
CELL, Q = 16, 8
KEY = np.array([255, 103, 139], np.uint8)
S = wm.Sheet(wm.PLUS)


def hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


def hh(x, y, salt=0):
    """결정적 해시(0..2^32)"""
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791) ^ 0x9E3779B9
    v &= 0xFFFFFFFF
    v ^= v >> 15
    v = (v * 2246822519) & 0xFFFFFFFF
    v ^= v >> 13
    v = (v * 3266489917) & 0xFFFFFFFF
    v ^= v >> 16
    return v


def rnd(x, y, salt=0):
    return hh(x, y, salt) / 4294967296.0


def cellarr(c, r):
    return S.cell(c, r).copy()


TEX = {
    GRASS: cellarr(*wm.GRASS_CELL),
    SNOW: cellarr(*wm.SNOW_CELL),
    SAND: cellarr(10, 2),
    DIRT: cellarr(7, 2),
    MARSH: cellarr(7, 6),
}
GROUND_OF = {FOREST: GRASS, MOUNT: GRASS, SFOREST: SNOW, SMOUNT: SNOW}
OBJ = (FOREST, MOUNT, SFOREST, SMOUNT)


def ground_of(k):
    return GROUND_OF.get(k, k)


# ───────────────────────── 둥근 덩이(blob) 커널 생성 ─────────────────────────
# 3x3 칸 가상 캔버스(48x48)에 덩이 마스크를 그린 뒤 9칸 조각으로 자른다. 좌표는 모두 명시적이다.
WOBBLE = [
    [0, 1, 2, 3, 2, 1, 0, 0],
    [0, 0, -1, -2, -3, -2, -1, 0],
    [0, -1, -2, -1, 1, 2, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 2, 3, 3, 2, 1, 0, 0],
    [0, 0, -2, -3, -3, -2, -1, 0],
    [0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, -1, -1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0],
]


def _kit_mask(m, r, pats):
    """48x48 bool 마스크. pats=(top,bottom,left,right) 각 WOBBLE 인덱스(가장자리 반 칸(8px)마다 0으로 끝난다)."""
    n = 48
    yy, xx = np.mgrid[0:n, 0:n]
    mk = np.zeros((n, n), bool)
    lo, hi = m, n - m
    for y in range(n):
        for x in range(n):
            px, py = x + .5, y + .5
            if px < lo or px > hi or py < lo or py > hi:
                continue
            ins = True
            # 코너 호
            for cx, cy, sx, sy in ((lo + r, lo + r, -1, -1), (hi - r, lo + r, 1, -1),
                                   (lo + r, hi - r, -1, 1), (hi - r, hi - r, 1, 1)):
                if (px - cx) * sx > 0 and (py - cy) * sy > 0:
                    if (px - cx) ** 2 + (py - cy) ** 2 > r * r:
                        ins = False
            mk[y, x] = ins
    # 곧은 가장자리 굴곡: 반 칸 단위 u=x%8
    out = mk.copy()
    for x in range(n):
        u = x % 8
        et = WOBBLE[pats[0]][u]
        eb = WOBBLE[pats[1]][u]
        if lo + r <= x + .5 <= hi - r:
            # 위 가장자리: 경계 y=lo → lo+et
            if et > 0:
                out[lo:lo + et, x] = False
            elif et < 0:
                out[lo + et:lo, x] = True
            if eb > 0:
                out[hi - eb:hi, x] = False
            elif eb < 0:
                out[hi:hi - eb, x] = True
    for y in range(n):
        u = y % 8
        el = WOBBLE[pats[2]][u]
        er = WOBBLE[pats[3]][u]
        if lo + r <= y + .5 <= hi - r:
            if el > 0:
                out[y, lo:lo + el] = False
            elif el < 0:
                out[y, lo + el:lo] = True
            if er > 0:
                out[y, hi - er:hi] = False
            elif er < 0:
                out[y, hi:hi - er] = True
    return out


def _tile_tex(tex, n=48):
    reps = (n + 15) // 16
    return np.tile(tex, (reps, reps, 1))[:n, :n]


def _paint(mask, fill, bg, style, salt, gx0=0, gy0=0):
    """마스크를 색으로 칠한다. 반환: rgb(n,n,3), alpha(n,n). bg=None 이면 바깥은 투명.
    style: dict(outline=rgb|None, rim=(rgb,p), dust=(rgb,p), holes=(rgb,p), spray=(rgb,p))"""
    n = mask.shape[0]
    rgb = np.zeros((n, n, 3), np.uint8)
    a = np.zeros((n, n), bool)
    fillt, bgt = _tile_tex(fill, n), (_tile_tex(bg, n) if bg is not None else None)
    rgb[mask] = fillt[mask]
    a[mask] = True
    if bgt is not None:
        rgb[~mask] = bgt[~mask]
        a[:] = True
    din = ndi.distance_transform_cdt(mask, metric='taxicab')  # 안쪽 거리(1=가장자리 픽셀)
    dout = ndi.distance_transform_cdt(~mask, metric='taxicab')  # 바깥 거리
    for y in range(n):
        for x in range(n):
            rr = rnd(x + gx0, y + gy0, salt)
            if mask[y, x]:
                if din[y, x] == 1:
                    if style.get('outline') is not None:
                        rgb[y, x] = style['outline']
                    elif style.get('rim') and rr < style['rim'][1]:
                        rgb[y, x] = style['rim'][0]
                elif din[y, x] == 2 and style.get('holes') and rr < style['holes'][1]:
                    rgb[y, x] = style['holes'][0]
            else:
                if dout[y, x] == 1 and style.get('dust') and rr < style['dust'][1]:
                    rgb[y, x] = style['dust'][0]
                    a[y, x] = True
                elif dout[y, x] == 2 and style.get('spray') and rr < style['spray'][1]:
                    rgb[y, x] = style['spray'][0]
                    a[y, x] = True
                elif dout[y, x] == 1 and style.get('outline_out') is not None:
                    rgb[y, x] = style['outline_out']
                    a[y, x] = True
    return rgb, a


def blob_kit(fill, bg, style, m=4, r=4, pats=(0, 1, 2, 3), salt=1, iso=None, inner_r=4):
    """3x4 덩이 세트(wm.ROLE 배치). 반환 dict role -> (rgb16x16x3, alpha16x16 bool)."""
    mask = _kit_mask(m, r, pats)
    rgb, a = _paint(mask, fill, bg, style, salt)
    kit = {}
    for role, (c, rr_) in wm.ROLE.items():
        if role in ('iso', 'inner'):
            continue
        cx, cy = c, rr_ - 1
        kit[role] = (rgb[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16].copy(),
                     a[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16].copy())
    # inner: 꽉 찬 칸 + 네 귀퉁이 홈
    im = np.ones((16, 16), bool)
    for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)):
        for y in range(16):
            for x in range(16):
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 < inner_r ** 2:
                    im[y, x] = False
    irgb, ia = _paint(im, fill, bg, style, salt + 7)
    kit['inner'] = (irgb, ia)
    # iso: 작은 덩이
    if iso is None:
        iso = (3, 6)
    om = np.zeros((16, 16), bool)
    cxy, rad = 8, iso[1]
    for y in range(16):
        for x in range(16):
            ang = np.arctan2(y + .5 - cxy, x + .5 - cxy)
            wob = 0.8 * np.sin(3 * ang + salt) + 0.5 * np.sin(5 * ang + 2 * salt)
            if np.hypot(x + .5 - cxy, y + .5 - cxy) <= rad + wob * (1 if iso[1] > 5 else 0.4):
                om[y, x] = True
    orgb, oa = _paint(om, fill, bg, style, salt + 13)
    kit['iso'] = (orgb, oa)
    kit['body'] = (_tile_tex(fill, 16).copy(), np.ones((16, 16), bool))
    return kit


def pick_role(v, h, d, qx, qy):
    return wm.role_of(v, h, d, qx, qy)


# ───────────────────────── 눈 녹는 경계 킷 ─────────────────────────
SNOW_STYLE = dict(
    rim=(hx('d3ecec'), 0.85),      # 안쪽 1px: 한 톤 어두운 눈
    holes=(hx('529543'), 0.12),    # 안쪽 2px: 풀이 군데군데 비침
    dust=(hx('e0f7f9'), 0.30),     # 바깥 1px: 눈 가루
    spray=(hx('d3ecec'), 0.08),    # 바깥 2px: 흩뿌린 눈
)
NV = 4  # 변형 개수
PATS = [(0, 1, 2, 4), (1, 2, 4, 5), (2, 0, 5, 1), (4, 5, 1, 2), (5, 4, 0, 2), (3, 0, 4, 1)]


def make_melt_kits():
    kits = []
    for v in range(NV):
        pats = PATS[v % len(PATS)]
        kits.append(blob_kit(TEX[SNOW], TEX[GRASS], SNOW_STYLE, m=5, r=4, pats=pats, salt=11 + v * 5, iso=(3, 6)))
    return kits


# ═════════════════════ 2단계: 층 분리 렌더러 ═════════════════════
FOREST_FAM = (FOREST, SFOREST)
MOUNT_FAM = (MOUNT, SMOUNT)
WATER = (SEA, RIVER, ICE)


def _fam(k):
    if k in FOREST_FAM:
        return 'f'
    if k in MOUNT_FAM:
        return 'm'
    return k


# ── 바닥 킷: 지면별 녹는 경계(알파 킷, 부모 바닥 위에 얹는다) ──
SAND_STYLE = dict(rim=(hx('b4a581'), 0.55), holes=(hx('689e4e'), 0.10), dust=(hx('cac88b'), 0.35), spray=(hx('c3ba89'), 0.10))
DIRT_STYLE = dict(rim=(hx('90704d'), 0.75), holes=(hx('689e4e'), 0.10), dust=(hx('ab8760'), 0.35), spray=(hx('9f7b53'), 0.08))
_MELT = {}


def melt_kits(ground):
    if ground in _MELT:
        return _MELT[ground]
    style = {SNOW: SNOW_STYLE, SAND: SAND_STYLE, DIRT: DIRT_STYLE}[ground]
    kits = []
    for v in range(NV):
        pats = PATS[v % len(PATS)]
        kits.append(blob_kit(TEX[ground], None, style, m=5, r=4, pats=pats, salt=11 + v * 5 + ground * 3, iso=(3, 6)))
    _MELT[ground] = kits
    return kits


def _tex_at(g, x0, y0):
    """지면 g 의 질감을 절대 픽셀 (x0,y0) 기준 8x8 조각으로(질감은 16 주기)."""
    t = TEX[g]
    ys = (np.arange(8) + y0) % 16
    xs = (np.arange(8) + x0) % 16
    return t[np.ix_(ys, xs)]


# ── 물체 킷: 원본 킷 칸에서 바닥 색을 지운 알파 ──
_OBJKEY = {}


def obj_cell(k, role):
    """(rgb16, alpha16) — 원본 킷 칸에서 바닥(그 물체의 가정 바닥)과 같으면서 칸 가장자리에 이어진 픽셀을 투명으로."""
    key = (k, role)
    if key in _OBJKEY:
        return _OBJKEY[key]
    cell = S.kcell(k, role).copy()
    if role == 'body':
        res = (cell, np.ones((16, 16), bool))
    else:
        tex = TEX[ground_of(k)]
        same_ = np.all(cell == tex, axis=2)
        lab, n = ndi.label(same_)
        border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
        border.discard(0)
        keyed = np.isin(lab, list(border)) if border else np.zeros_like(same_)
        res = (cell, ~keyed)
    _OBJKEY[key] = res
    return res


# ── 물 킷 재색 ──
_LAND_G = [hx('529543'), hx('44884a'), hx('689e4e')]
_LAND_SH = hx('235328')
_RIVER_MAP = {  # 바다 물색 → 강물색(밝고 초록기)
    '1a4182': '235a99', '195790': '2b78b8', '14386f': '1f5590', '1f70b1': '3b8fd0', '19487d': '2666a4',
    '3b95ec': '6cc0f0', '43a9e2': '7ed0ea', '60c1ed': '9adcf0', '271313': '3e210d',
}
_RIVER_MAP = {tuple(hx(k)): hx(v) for k, v in _RIVER_MAP.items()}
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])


_SNOW_EDGE = {(39, 19, 19): (84, 140, 166), (62, 33, 13): (84, 140, 166), (96, 69, 48): (123, 199, 199)}


def _recolor_land(q, g, px0, py0):
    if g == GRASS:
        return q
    tex = _tex_at(g, px0, py0)
    out = q.copy()
    for c in _LAND_G:
        m = np.all(q == c, axis=2)
        out[m] = tex[m]
    m = np.all(q == _LAND_SH, axis=2)
    out[m] = (tex[m] * (0.80 if g == SNOW else 0.72)).astype(np.uint8)
    if g == SNOW:   # 갈색 물가 윤곽은 눈 킷의 청록 윤곽(548ca6 / 7bc7c7)으로
        for c, r in _SNOW_EDGE.items():
            out[np.all(q == np.array(c, np.uint8), axis=2)] = r
    return out


def _recolor_river(q):
    out = q.copy()
    for a, b in _RIVER_MAP.items():
        m = np.all(q == np.array(a, np.uint8), axis=2)
        out[m] = b
    return out


def _blit_alpha(dst, src, a):
    dst[a] = src[a]
