#!/usr/bin/env python3
"""월드맵 키트 팔레트 층 — 지형 그림(아이콘 없음)의 색만 OKLab 에서 바꾼다.

출처: 재배색 실험 `design-map/recolor_v9.py`(브랜치 worktree-agent-a1daf2ae1670c7e08, 커밋 4e54b4030)의 색 변환(OKLab·role 규칙·지역 강도장)을 가져와
  (1) 아이콘을 지형에서 떼어 냈으므로 'icon' role 을 없애고, (2) 규칙을 코드 안 dict 대신 palettes/<id>.json 표로 옮겼다.
  지형 코드는 건드리지 않는다. 같은 지도·같은 도트 모양에서 「색 표」만 바뀐다.

role: 지형 픽셀의 색마다 「어느 칸 종류에서 나왔나」를 센 표(색 -> role). 지형 코드 배열(바닥/물체/절벽/길)에서 자동으로 만든다.
규칙(한 role 의 dict): ramp/pos, hue/hue_amt, dh, cs, co, ct, lk, lo, tint — palettes 스키마는 docs/palette-schema.md.
"""
import collections
import json
from pathlib import Path

import numpy as np

W, H = 96, 72
TS = 16

GROUP_OF_SEM = {
    'g0': 'sea', 'g1': 'river', 'g2': 'lava', 'g3': 'toxic',
    'g10': 'grass', 'g11': 'farm', 'g27': 'grass', 'g24': 'grass', 'g12': 'savanna', 'g13': 'sand', 'g14': 'sand',
    'g15': 'dirt', 'g16': 'badlands', 'g17': 'ash', 'g18': 'ash', 'g19': 'swamp', 'g20': 'swamp', 'g21': 'tundra',
    'g22': 'snow', 'g23': 'snow', 'g25': 'ash', 'g26': 'ash',
    'o1': 'forest', 'o2': 'forest', 'o3': 'forest', 'o4': 'deadwood', 'o5': 'forest',
    'o6': 'mount', 'o7': 'mount', 'o8': 'volcano', 'o9': 'badlands',
    'face': 'rock', 'road': 'road',
}
GROUPS = ['sea', 'river', 'lava', 'toxic', 'grass', 'farm', 'savanna', 'sand', 'dirt', 'badlands', 'ash', 'swamp', 'tundra',
          'snow', 'forest', 'deadwood', 'mount', 'volcano', 'rock', 'road']
GID = {g: i for i, g in enumerate(GROUPS)}
GNAME = {'sea': '바다', 'river': '강·호수', 'lava': '용암', 'toxic': '독수', 'grass': '초원·정글 바닥', 'farm': '밀밭', 'savanna': '사바나',
         'sand': '사막·모래언덕', 'dirt': '황무지', 'badlands': '붉은 협곡·메사', 'ash': '화산재·현무암', 'swamp': '늪', 'tundra': '툰드라',
         'snow': '설원·빙하', 'forest': '숲(활엽·침엽·정글)', 'deadwood': '고사목', 'mount': '산', 'volcano': '화산', 'rock': '절벽·고원 면',
         'road': '길·다리'}
RULE_KEYS = {'ramp', 'pos', 'hue', 'hue_amt', 'dh', 'cs', 'co', 'ct', 'lk', 'lo', 'tint'}
LIGHT_KEYS = {'lk', 'lo', 'cs', 'sh_a', 'sh_b', 'hi_a', 'hi_b', 'a', 'b'}


# ───────────────────────────── 1. 색 -> role ─────────────────────────────
def tile_sem(M, info):
    sem = np.empty((H, W), object)
    for y in range(H):
        for x in range(W):
            g, o, h = int(M.G[y, x]), int(M.O[y, x]), int(M.Hh[y, x])
            s = 'g%d' % g
            if o:
                s = 'o%d' % o
            elif h:
                s = 'h'
            if (x, y) in M.face:
                s = 'face'
            sem[y, x] = s
    road = info['road'] | info['foot']
    for (x, y) in info['bridge']:
        road[y, x] = True
    sem[road & (sem != 'h')] = 'road'
    return sem


def key_of(a):
    a = a.astype(np.int64)
    return (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]


def build_roles(img, M, info):
    """색마다 가장 많이 나온 칸 종류(role)를 센다. 반환: (ukeys 정렬된 색 키, role 번호, 칸별 그룹 번호, 색×role 픽셀 수)."""
    sem = tile_sem(M, info)
    grp_t = np.zeros((H, W), np.int16)
    for y in range(H):
        for x in range(W):
            s = sem[y, x]
            grp_t[y, x] = GID['rock' if s == 'h' else GROUP_OF_SEM[s]]
    gp = np.repeat(np.repeat(grp_t, TS, 0), TS, 1)
    ukeys, inv = np.unique(key_of(img).ravel(), return_inverse=True)
    cnt = np.zeros((len(ukeys), len(GROUPS)), np.int64)
    np.add.at(cnt, (inv, gp.ravel()), 1)
    return ukeys, cnt.argmax(1).astype(np.int16), grp_t, cnt


def role_purity(img, ukeys, role, grp_t):
    idx = np.searchsorted(ukeys, key_of(img).ravel())
    gp = np.repeat(np.repeat(grp_t, TS, 0), TS, 1)
    return float((role[idx].reshape(gp.shape) == gp).mean())


# ───────────────────────────── 2. OKLab ─────────────────────────────
def _srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255.0


def to_oklab(rgb):
    r, g, b = [_srgb_to_lin(rgb[..., i].astype(np.float64)) for i in range(3)]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def from_oklab(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return np.stack([_lin_to_srgb(r), _lin_to_srgb(g), _lin_to_srgb(bb)], -1)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64)


def lab_of_hex(h):
    return to_oklab(hexrgb(h)[None, :])[0]


# ───────────────────────────── 3. 규칙 ─────────────────────────────
def apply_rule(lab, rule, Lmean, Lrange):
    L, a, b = lab[..., 0].copy(), lab[..., 1].copy(), lab[..., 2].copy()
    if 'ramp' in rule:
        t = np.clip((L - Lrange[0]) / max(Lrange[1] - Lrange[0], 1e-6), 0, 1)
        rl = to_oklab(np.stack([hexrgb(h) for h in rule['ramp']]))
        pos = np.array(rule['pos']) if 'pos' in rule else np.linspace(0, 1, len(rl))
        return np.stack([np.interp(t, pos, rl[:, 0]), np.interp(t, pos, rl[:, 1]), np.interp(t, pos, rl[:, 2])], -1)
    C = np.hypot(a, b)
    h = np.arctan2(b, a)
    if 'hue' in rule:
        tgt = np.deg2rad(rule['hue'])
        dh = np.arctan2(np.sin(tgt - h), np.cos(tgt - h))
        h = h + dh * rule.get('hue_amt', 1.0)
    if 'dh' in rule:
        h = h + np.deg2rad(rule['dh'])
    C = C * rule.get('cs', 1.0) + rule.get('co', 0.0) * (C > 0.004)
    L = (L - Lmean) * rule.get('ct', 1.0) + Lmean
    L = L * rule.get('lk', 1.0) + rule.get('lo', 0.0)
    a, b = C * np.cos(h), C * np.sin(h)
    if 'tint' in rule:
        th, ta = rule['tint']
        tl = lab_of_hex(th)
        a = a * (1 - ta) + tl[1] * ta
        b = b * (1 - ta) + tl[2] * ta
    return np.stack([L, a, b], -1)


def apply_light(lab, light):
    if not light:
        return lab
    L, a, b = lab[..., 0].copy(), lab[..., 1].copy(), lab[..., 2].copy()
    sh = np.clip(1 - L / 0.7, 0, 1)
    hi = np.clip((L - 0.45) / 0.45, 0, 1)
    a = a + light.get('sh_a', 0) * sh + light.get('hi_a', 0) * hi + light.get('a', 0)
    b = b + light.get('sh_b', 0) * sh + light.get('hi_b', 0) * hi + light.get('b', 0)
    C = np.hypot(a, b) * light.get('cs', 1.0)
    h = np.arctan2(b, a)
    a, b = C * np.cos(h), C * np.sin(h)
    L = L * light.get('lk', 1.0) + light.get('lo', 0.0)
    return np.stack([L, a, b], -1)


def _wpercentile(v, w, q):
    o = np.argsort(v)
    cw = np.cumsum(w[o]) / w.sum()
    return float(v[o][min(np.searchsorted(cw, q), len(v) - 1)])


def lut_lab(colors, role, rules, light, px=None):
    """색표(n,3) + role -> (규칙을 다 적용한 OKLab, 원래 OKLab).
    px(색별 화소 수)를 주면 role 의 밝기 범위·평균을 화소 가중으로 잡는다: ramp 는 role 의 밝기 2%~98% 구간을 램프 전체에 펴므로,
    화면의 대부분을 차지하는 몇 가지 색이 램프의 서로 다른 단에 놓인다(드문 하이라이트 한 색이 범위를 늘려 지형 전체를 한 단으로 뭉치지 않는다)."""
    lab = to_oklab(colors.astype(np.float64))
    out = np.zeros_like(lab)
    for gi, g in enumerate(GROUPS):
        m = role == gi
        if not m.any():
            continue
        sub = lab[m]
        rule = rules.get(g, {})
        if not rule:
            out[m] = sub
            continue
        if px is not None and px[m].sum() > 0:
            w = px[m].astype(np.float64)
            Lm = float((sub[:, 0] * w).sum() / w.sum())
            Lr = (_wpercentile(sub[:, 0], w, .02), _wpercentile(sub[:, 0], w, .98))
        else:
            Lm, Lr = sub[:, 0].mean(), (sub[:, 0].min(), sub[:, 0].max())
        out[m] = apply_rule(sub, rule, Lm, Lr)
    return apply_light(out, light), lab


def _rgb(lab):
    return np.clip(np.rint(from_oklab(lab)), 0, 255).astype(np.uint8)


# ───────────────────────────── 4. 지역 강도장(regional 팔레트) ─────────────────────────────
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + .5) / 16


def smooth_noise(scale, salt, shape=(H * TS, W * TS)):
    gy, gx = int(H / scale) + 3, int(W / scale) + 3
    g = np.random.RandomState(salt).rand(gy, gx)
    ys, xs = np.mgrid[0:shape[0], 0:shape[1]]
    fx, fy = xs / (TS * scale), ys / (TS * scale)
    i0, j0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - i0, fy - j0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = g[j0, i0] * (1 - tx) + g[j0, i0 + 1] * tx
    b = g[j0 + 1, i0] * (1 - tx) + g[j0 + 1, i0 + 1] * tx
    return a * (1 - ty) + b * ty


def region_field(seeds, warp=3.0, seed=40, core=.45):
    ys, xs = np.mgrid[0:H * TS, 0:W * TS]
    X, Y = xs / TS, ys / TS
    X = X + (smooth_noise(6, seed) - .5) * 2 * warp + (smooth_noise(2.5, seed + 1) - .5) * warp * .6
    Y = Y + (smooth_noise(6, seed + 2) - .5) * 2 * warp + (smooth_noise(2.5, seed + 3) - .5) * warp * .6
    f = np.zeros_like(X)
    for (sx, sy, r, w) in seeds:
        d = np.hypot(X - sx, Y - sy) / r
        v = np.clip((1 - d) / (1 - core), 0, 1)
        f = np.maximum(f, v * v * (3 - 2 * v) * w)
    return np.clip(f, 0, 1)


def coast_follow(f, G, reach=9.0):
    import scipy.ndimage as ndi
    land = np.repeat(np.repeat(G >= 10, TS, 0), TS, 1)
    d, (iy, ix) = ndi.distance_transform_edt(~land, return_indices=True)
    g = f[iy, ix] * np.clip(1 - d / (reach * TS), 0, 1) ** 1.5
    return np.where(land, f, g)


def quant_levels(f, nlev, width=.5):
    ys, xs = np.mgrid[0:f.shape[0], 0:f.shape[1]]
    u = f * (nlev - 1)
    return np.clip(np.floor(u + (BAYER4[ys % 4, xs % 4] - .5) * width + .5).astype(int), 0, nlev - 1)


# ───────────────────────────── 5. 팔레트 파일 ─────────────────────────────
def load_palette(path, palettes_dir=None):
    """palettes/<id>.json 을 읽고 검사한다. regional 은 base 팔레트의 규칙을 물려받는다."""
    path = Path(path)
    p = json.loads(path.read_text())
    if p.get('schema') != 'worldmap-palette/1':
        raise ValueError('%s: schema 가 worldmap-palette/1 이 아니다' % path)
    if p.get('id') != path.stem:
        raise ValueError('%s: id(%s) 가 파일 이름과 다르다' % (path, p.get('id')))
    base = None
    if 'regional' in p:
        base_id = p['regional']['base']
        base = load_palette((palettes_dir or path.parent) / (base_id + '.json'), palettes_dir)
        p.setdefault('roles', base['roles'])
        p.setdefault('light', base.get('light', {}))
    for g, rule in (p.get('roles') or {}).items():
        if g not in GID:
            raise ValueError('%s: 알 수 없는 role %r (허용: %s)' % (path, g, ', '.join(GROUPS)))
        bad = set(rule) - RULE_KEYS
        if bad:
            raise ValueError('%s: role %s 의 알 수 없는 연산 %s' % (path, g, sorted(bad)))
    bad = set(p.get('light') or {}) - LIGHT_KEYS
    if bad:
        raise ValueError('%s: light 의 알 수 없는 키 %s' % (path, sorted(bad)))
    return p


def is_identity(p):
    return not p.get('roles') and not p.get('light') and 'regional' not in p


def recolor_terrain(img, ukeys, role, palette, G=None):
    """지형 그림(RGB uint8)에 팔레트를 적용한다. 색 -> 색 대응이므로 지형의 명암 단계 수는 줄 수만 있고 늘지 않는다."""
    if is_identity(palette):
        return img.copy(), dict(levels=None)
    colors = np.stack([(ukeys >> 16) & 255, (ukeys >> 8) & 255, ukeys & 255], -1).astype(np.uint8)
    idx = np.searchsorted(ukeys, key_of(img).ravel()).reshape(img.shape[:2])
    px = np.bincount(idx.ravel(), minlength=len(ukeys))
    full, orig = lut_lab(colors, role, palette.get('roles', {}), palette.get('light', {}), px)
    if 'regional' not in palette:
        lut = _rgb(full)
        return lut[idx], dict(levels=None)
    rg = palette['regional']
    nlev = rg.get('levels', 5)
    f = coast_follow(region_field([tuple(s) for s in rg['seeds']], rg.get('warp', 3.0), rg.get('seed', 40), rg.get('core', .45)), G, rg.get('reach', 9.0))
    luts = np.stack([_rgb(orig * (1 - i / (nlev - 1)) + full * (i / (nlev - 1))) for i in range(nlev)])
    lvl = quant_levels(f, nlev, rg.get('width', .5))
    return luts[lvl, idx], dict(levels=[int((lvl == i).sum()) for i in range(nlev)], field=f)


def tint_icon(arr, palette, amount, key=(255, 103, 139), shadow_key=(254, 103, 139)):
    """아이콘 색을 팔레트 「빛」(light)쪽으로 amount(0..1)만큼 옮긴다. 키색(투명·그림자)은 그대로. role 규칙은 쓰지 않는다."""
    if amount <= 0 or is_identity(palette) or not palette.get('light'):
        return arr
    out = arr.copy()
    solid = ~(np.all(arr == np.array(key, np.uint8), axis=2) | np.all(arr == np.array(shadow_key, np.uint8), axis=2))
    px = arr[solid]
    ukeys, inv = np.unique(key_of(px), return_inverse=True)
    cols = np.stack([(ukeys >> 16) & 255, (ukeys >> 8) & 255, ukeys & 255], -1).astype(np.uint8)
    lab = to_oklab(cols.astype(np.float64))
    graded = apply_light(lab, palette['light'])
    new = _rgb(lab * (1 - amount) + graded * amount)
    out[solid] = new[inv]
    return out


def palette_summary(img, ukeys, role, cnt_by_role=None):
    """role 별 (색 수, 밝기 단 수)를 센다 — 팔레트가 지형 종류의 명암을 뭉개지 않았는지 보는 숫자."""
    colors_idx = np.searchsorted(ukeys, key_of(img).ravel())
    px = np.bincount(colors_idx, minlength=len(ukeys))
    lab = to_oklab(np.stack([(ukeys >> 16) & 255, (ukeys >> 8) & 255, ukeys & 255], -1).astype(np.float64))
    out = {}
    for gi, g in enumerate(GROUPS):
        m = (role == gi) & (px > 0)
        if m.any():
            out[g] = dict(colors=int(m.sum()), L=[float(lab[m][:, 0].min()), float(lab[m][:, 0].max())], px=int(px[m].sum()))
    return out
