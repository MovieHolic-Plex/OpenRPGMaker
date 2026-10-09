"""EasyRPG World 개선판 생성기 (원본 public/assets/easyrpg-chipset-world.png, CC BY 4.0).

칸 배치는 그대로. 모든 픽셀은 규칙·좌표로 직접 정한다(생성 모델·트레이싱 없음).
  python3 make_world_plus.py            -> world-plus.png, changes.json
단계: 산 재조명 → 땅 킷 기하 재생성(둥근 발자국·테두리·입체 띠) → 바다 해안 재생성
      → 아이콘 정리 → 전체 톤 다운(1회).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from wm_lib import (CELL, COLS, ROWS, PINK, load_sheet, cell, put_cell, hexc, mute_block,
                    footprint, cellmap_full, cellmap_iso, cellmap_inner)
from wm_asm import ROLE, kcell, assemble, extract_kit, canvases_from
from wm_relight import luma, smooth_masked

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[2] / 'public' / 'assets' / 'easyrpg-chipset-world.png'
Q = CELL // 2


def kit_at(a, c0, r0):
    return a[r0 * CELL:(r0 + 4) * CELL, c0 * CELL:(c0 + 3) * CELL].copy()


def put_kit(a, c0, r0, kit):
    a[r0 * CELL:(r0 + 4) * CELL, c0 * CELL:(c0 + 3) * CELL] = kit


def lerp(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def shade(c, k):
    return tuple(int(max(0, min(255, round(v * k)))) for v in c)


# ------------------------------------------------------------------ 산 재조명
TONES = [hexc(x) for x in ['4f2e21', '65442a', '714e29', '8c5a21', '987046', 'a77b4b', 'b99664', 'd7aa73']]
TONE_L = np.array([0.299 * r + 0.587 * g + 0.114 * b for r, g, b in TONES])
GRASS = {(0x41, 0x9d, 0x39), (0x5b, 0xa6, 0x44), (0x3c, 0x8f, 0x4b)}
SNOW_S1, SNOW_S2, SNOW_S3 = hexc('f0faff'), hexc('cfecec'), hexc('8fb8c4')


def relight_canvas(cv, snow=True):
    H, W, _ = cv.shape
    mass = ~np.array([[tuple(int(v) for v in cv[y, x]) in GRASS for x in range(W)] for y in range(H)])
    Lo = luma(cv.astype(float))
    outl = mass & (Lo < 40)
    m = mass & ~outl
    Ls = smooth_masked(Lo, m, 0.8)
    P = np.pad(Ls, 1, mode='edge')
    emb = P[2:, 2:] - P[:-2, :-2]
    Ln = Ls + 0.9 * emb
    Ln = (Ln - Ln[m].mean()) * 1.18 + Ln[m].mean()
    idx = np.abs(Ln[..., None] - TONE_L[None, None, :]).argmin(-1)
    o = cv.copy()
    o[m] = np.array(TONES, np.uint8)[idx][m]
    if snow:
        for y in range(H):
            for x in range(W):
                if not m[y, x]:
                    continue
                ly = y % 16 - 2
                lx = x % 16 - 7.5
                if 0 <= ly <= 2 and abs(lx) <= ly * 0.6 + 0.6:
                    o[y, x] = SNOW_S1 if lx < 0.5 and ly < 2 else SNOW_S2
    return o


def do_mountain(a, log):
    grass = cell(a, 0, 8)
    kit = kit_at(a, 3, 12)
    cv = canvases_from(kit, grass)
    new = {k: relight_canvas(v, snow=False) for k, v in cv.items()}
    nk = extract_kit(new, cell(a, 4, 12))
    put_kit(a, 3, 12, nk)



def wobble_mask(F, seed, amp=2):
    """발자국 가장자리를 16px 주기의 잔물결로 깎아 유기적으로 만든다(변을 따라 16px 마다 같은 모양 → 이음매 없음)."""
    H, W = F.shape
    rng = np.random.default_rng(seed)
    def prof():
        p = rng.random(16)
        p = np.convolve(np.concatenate([p, p, p]), [0.25, 0.5, 0.25], 'same')[16:32]
        p = (p - p.min()) / (p.max() - p.min() + 1e-9)
        return np.floor(p * (amp + 0.999)).astype(int)
    wt, wb, wl, wr = prof(), prof(), prof(), prof()
    du = np.zeros((H, W), int); dd = np.zeros((H, W), int); dl = np.zeros((H, W), int); dr = np.zeros((H, W), int)
    for y in range(H):
        du[y] = np.where(F[y], (du[y - 1] + 1) if y else 1, 0)
    for y in range(H - 1, -1, -1):
        dd[y] = np.where(F[y], (dd[y + 1] + 1) if y < H - 1 else 1, 0)
    for x in range(W):
        dl[:, x] = np.where(F[:, x], (dl[:, x - 1] + 1) if x else 1, 0)
    for x in range(W - 1, -1, -1):
        dr[:, x] = np.where(F[:, x], (dr[:, x + 1] + 1) if x < W - 1 else 1, 0)
    xs = np.arange(W) % 16; ys = np.arange(H) % 16
    G = F.copy()
    G &= ~(du <= wt[xs][None, :]) | (du > 6)
    G &= ~(dd <= wb[xs][None, :]) | (dd > 6)
    G &= ~(dl <= wl[ys][:, None]) | (dl > 6)
    G &= ~(dr <= wr[ys][:, None]) | (dr > 6)
    return G

# ------------------------------------------------------------------ 땅 킷(기하 재생성)
def edt_in(F):
    return ndimage.distance_transform_cdt(F, metric='taxicab')


def render_land(kit, outside, rim_col, inset=1, rad=4, bevel=True, seed=1, amp=2, shadow=True):
    """kit(48x64) 의 body 질감을 그대로 쓰되 발자국·테두리를 기하 규칙으로 다시 그린 5x5 캔버스 3개."""
    body = kcell(kit, 'body')
    out = {}
    for kind, cmf in (('iso', cellmap_iso), ('inner', cellmap_inner), ('full', cellmap_full)):
        cm = cmf()
        if kind == 'iso':
            F = footprint(cm, inset=2, rad=5, notch=False)
        else:
            F = wobble_mask(footprint(cm, inset=inset, rad=rad), seed, amp)
        H, W = F.shape
        outc = np.tile(outside, (5, 5, 1)).astype(np.uint8)
        bod = np.tile(body, (5, 5, 1)).astype(np.uint8)
        cv = outc.copy()
        cv[F] = bod[F]
        din = ndimage.distance_transform_cdt(np.pad(F, 1, constant_values=False), metric='taxicab')[1:-1, 1:-1]
        dout = ndimage.distance_transform_cdt(np.pad(~F, 1, constant_values=False), metric='taxicab')[1:-1, 1:-1]
        # 바깥 접경: 그림자(우·하 쪽만) — 육지가 살짝 떠 보이게
        if shadow:
            sh = np.zeros_like(F)
            sh[1:, 1:] = F[:-1, :-1]                       # 좌상 광원 → 그림자는 우하로
            sh &= ~F
            for y in range(H):
                for x in range(W):
                    if sh[y, x]:
                        cv[y, x] = shade(tuple(cv[y, x]), 0.9)
        # 안쪽 띠: 1px 테두리 + 좌상 밝은띠/우하 어두운띠
        for y in range(H):
            for x in range(W):
                if not F[y, x]:
                    continue
                if din[y, x] == 1:
                    cv[y, x] = rim_col
                elif bevel and din[y, x] == 2:
                    up = not F[y - 1, x] if y > 0 else True
                    lf = not F[y, x - 1] if x > 0 else True
                    dn = not F[y + 1, x] if y < H - 1 else True
                    rt = not F[y, x + 1] if x < W - 1 else True
                    if (up or lf) and not (dn or rt):
                        cv[y, x] = tuple(int(min(255, v * 1.10 + 6)) for v in cv[y, x])
                    elif (dn or rt) and not (up or lf):
                        cv[y, x] = shade(tuple(cv[y, x]), 0.88)
        out[kind] = cv
    return out


LAND = {  # 이름: (킷 열, 행, 바깥 칸(열,행), 테두리색)
    'dirt': (6, 0, (0, 8), hexc('573719')),
    'sand': (9, 0, (0, 8), hexc('86713a')),
    'marsh': (6, 4, (0, 8), hexc('33266a')),
    'snow': (9, 4, (0, 8), hexc('86bcc8')),
}


def do_land(a, log):
    for name, (c0, r0, (oc, orr), rim) in LAND.items():
        kit = kit_at(a, c0, r0)
        cv = render_land(kit, cell(a, oc, orr), rim, rad=7, amp=1, seed=sum(map(ord, name)) % 97 + 3)
        nk = extract_kit(cv, kit[0:CELL, CELL:2 * CELL])
        put_kit(a, c0, r0, nk)


# ------------------------------------------------------------------ 바다 해안
def sea_kit(a, f, c_off):
    """바다(또는 눈 해안) 프레임 열 f 의 5칸 세로줄을 킷 배열(48x64)로 바꾼다(엔진 규칙과 같은 역할 배치)."""
    col = f + c_off
    r0, r1, r2, r3, body = (cell(a, col, r) for r in (0, 1, 2, 3, 4))
    kit = np.zeros((4 * CELL, 3 * CELL, 3), np.uint8)

    def put(role, t):
        c, r = ROLE[role]
        kit[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = t
    put('iso', r0); put('inner', r3)
    for r_ in ('nw', 'ne', 'sw', 'se'):
        put(r_, r0)
    put('n', r2); put('s', r2); put('w', r1); put('e', r1); put('body', body)
    kit[0:CELL, CELL:2 * CELL] = body
    return kit


def render_sea(kit, f, outside, lip, shadow_col, foam_a, foam_b, shallow):
    body = kcell(kit, 'body')
    out = {}
    for kind, cmf in (('iso', cellmap_iso), ('inner', cellmap_inner), ('full', cellmap_full)):
        cm = cmf()
        F = wobble_mask(footprint(cm, inset=3, rad=8, notch=True), 11 + f * 0, 1)
        H, W = F.shape
        cv = np.tile(outside, (5, 5, 1)).astype(np.uint8)
        bod = np.tile(body, (5, 5, 1)).astype(np.uint8)
        cv[F] = bod[F]
        din = ndimage.distance_transform_cdt(np.pad(F, 1, constant_values=False), metric='taxicab')[1:-1, 1:-1]
        dout = ndimage.distance_transform_cdt(np.pad(~F, 1, constant_values=False), metric='taxicab')[1:-1, 1:-1]
        for y in range(H):
            for x in range(W):
                if F[y, x]:
                    d = din[y, x]
                    if d == 1:
                        # 물거품: 4칸 주기(칸 16px 과 맞물림), 프레임마다 한 칸씩 흐른다
                        cv[y, x] = foam_a if (x + y + f) % 4 in (0, 1) else foam_b
                    elif d == 2:
                        cv[y, x] = shallow[0] if (x - y + f * 2) % 8 < 5 else tuple(cv[y, x])
                    elif d == 3:
                        cv[y, x] = shallow[1] if tuple(cv[y, x]) == shallow[2] else tuple(cv[y, x])
                else:
                    d = dout[y, x]
                    if d == 1:
                        cv[y, x] = lip
                    elif d == 2:
                        cv[y, x] = shade(tuple(cv[y, x]), 0.93)
        out[kind] = cv
    return out


def sea_back(a, f, c_off, canv, variant):
    """5x5 캔버스 → 시트 세로줄 5칸(행0 모서리, 행1 세로변, 행2 가로변, 행3 오목, 행4 몸통)."""
    col = f + c_off
    nk = extract_kit(canv, variant)
    def q(role, qx, qy):
        t = kcell(nk, role)
        return t[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q]
    r0 = np.zeros((CELL, CELL, 3), np.uint8)
    for (role, qx, qy) in (('nw', 0, 0), ('ne', 1, 0), ('sw', 0, 1), ('se', 1, 1)):
        r0[qy * Q:(qy + 1) * Q, qx * Q:(qx + 1) * Q] = q(role, qx, qy)
    r2 = np.zeros_like(r0)
    r2[0:Q] = kcell(nk, 'n')[0:Q]; r2[Q:] = kcell(nk, 's')[Q:]
    r1 = np.zeros_like(r0)
    r1[:, 0:Q] = kcell(nk, 'w')[:, 0:Q]; r1[:, Q:] = kcell(nk, 'e')[:, Q:]
    r3 = kcell(nk, 'inner')
    put_cell(a, col, 0, r0); put_cell(a, col, 1, r1); put_cell(a, col, 2, r2); put_cell(a, col, 3, r3)


def do_sea(a, log):
    grass = cell(a, 0, 8)
    snow = cell(a, 10, 6)
    for f in range(3):
        kit = sea_kit(a, f, 0)
        cv = render_sea(kit, f, grass, shade(hexc('419d39'), 0.72), None, hexc('5cb8ff'), hexc('208ef8'),
                        (hexc('065298'), hexc('065298'), hexc('093989')))
        sea_back(a, f, 0, cv, kcell(kit, 'body'))
        kit = sea_kit(a, f, 3)
        cv = render_sea(kit, f, snow, hexc('74d1d2'), None, hexc('f0faff'), hexc('5cb8ff'),
                        (hexc('065298'), hexc('065298'), hexc('093989')))
        sea_back(a, f, 3, cv, kcell(kit, 'body'))


def tidy_icons(a, log):
    """아이콘(열 18~23, 행 8~15) 보수적 정리: 고립 점 제거, 핀홀 메우기.
    - 분홍이 아닌 픽셀이 8방향 이웃 어디에도 불투명 이웃이 없으면 분홍으로(떠 있는 점).
    - 분홍 픽셀이 4방향 이웃 넷 모두 같은 불투명색이면 그 색으로 메움(구멍).
    """
    changed = set()
    for r0 in range(8, 16):
        for c0 in range(18, 24):
            t = cell(a, c0, r0)
            m = ~np.all(t == PINK, axis=2)
            new = t.copy()
            H, W = m.shape
            for y in range(H):
                for x in range(W):
                    if m[y, x]:
                        nb = 0
                        for dy in (-1, 0, 1):
                            for dx in (-1, 0, 1):
                                if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and m[y + dy, x + dx]:
                                    nb += 1
                        if nb == 0:
                            new[y, x] = PINK
                    else:
                        ns = [tuple(t[y + dy, x + dx]) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))
                              if 0 <= y + dy < H and 0 <= x + dx < W and m[y + dy, x + dx]]
                        if len(ns) == 4 and len(set(ns)) == 1:
                            new[y, x] = ns[0]
            if not np.array_equal(new, t):
                put_cell(a, c0, r0, new)
                changed.add(r0 * COLS + c0)
    log.append(('icons_tidied', sorted(changed)))


def mute_region(c, r):
    if c <= 11:
        return not (3 <= c <= 5 and 4 <= r <= 7)
    if 18 <= c <= 23:
        return True
    return False


def main():
    a = load_sheet(SRC)
    orig = a.copy()
    log = []
    do_mountain(a, log)
    if '--land' in sys.argv:   # v1 실험: 땅 킷 기하 재생성. 가장자리가 각진 모서리·얇은 안쪽 테두리로 원본의 둥근 해안선을 잃어 기본은 끔(원본 칸 유지 + 톤다운만)
        do_land(a, log)
    if '--sea' in sys.argv:   # 실험: 바다 해안 기하 재생성. QA 결과 원본보다 각져 보여 기본은 끔(원본 지오메트리 유지 + 톤다운만)
        do_sea(a, log)
    tidy_icons(a, log)
    pre = a.copy()
    for r in range(ROWS):
        for c in range(COLS):
            if mute_region(c, r):
                put_cell(a, c, r, mute_block(cell(a, c, r)))
    Image.fromarray(a).save(HERE / 'world-plus.png')
    tidied = set(log[-1][1])
    cells = []
    for r in range(ROWS):
        for c in range(COLS):
            o, p, f = cell(orig, c, r), cell(pre, c, r), cell(a, c, r)
            if np.array_equal(o, f):
                continue
            if not np.array_equal(o, p):
                kind = 'tidied' if (r * COLS + c) in tidied else 'redrawn'
            else:
                kind = 'palette-only'
            zone = ('sea' if c <= 2 and r <= 7 else 'snow-shore' if 3 <= c <= 5 and r <= 3 else
                    'icon' if c >= 18 and r >= 8 else 'cliff' if c >= 18 and r <= 7 else 'land-kit')
            cells.append(dict(cell=r * COLS + c, col=c, row=r, kind=kind, zone=zone,
                              diffPixels=int(np.any(o != f, axis=2).sum())))
    kinds = {}
    for e in cells:
        kinds[e['kind']] = kinds.get(e['kind'], 0) + 1
    zones = {}
    for e in cells:
        zones.setdefault(e['zone'], {}).setdefault(e['kind'], 0)
        zones[e['zone']][e['kind']] += 1
    json.dump(dict(source='public/assets/easyrpg-chipset-world.png', output='world-plus.png',
                   totalCells=COLS * ROWS, changedCells=len(cells), kinds=kinds, zones=zones,
                   cells=cells), open(HERE / 'changes.json', 'w'), ensure_ascii=False, indent=1)
    print('changed', len(cells), kinds, zones)


if __name__ == '__main__':
    main()
