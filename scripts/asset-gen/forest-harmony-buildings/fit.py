"""생성 원본 → 제작 틀 강제 + 후검수.  python3 fit.py fh-smithy-c1 fh-inn-c2 ...
틀이 이긴다: ① 윤곽 = 틀 사각형(AI 가 밖에 그린 것은 버림) ② 구역마다 원본 칩셋 팔레트를 원본과 같은 비중으로
(AI 그림은 구역 안 밝기 순위만 쓰인다) ③ 문·창 = 원본 칩셋 타일 ④ 통행 = 틀 passmap.
후검수는 틀을 지켰는지(자리·배율·비율·칠함·문 유지·가짜 문 없음) — 틀 강제가 가려 버릴 위반을 먼저 잡는다.
출력 <id>-art.png(원 해상도), <id>-check.json"""
import json, re, sys
import numpy as np
from PIL import Image
from fhlib import *

LUM = np.array([0.299, 0.587, 0.114])

def load(n):
    a = np.array(Image.open(f'{OUT}/{n}-raw.png').convert('RGBA')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = ((r > 170) & (b > 170) & (g < 110) & (abs(r - b) < 70)) | (a[..., 3] < 128)
    return a, bg

def bbox(mask, min_frac):
    rows = np.nonzero(mask.sum(1) >= mask.shape[1] * 0 + min_frac[0])[0]
    cols = np.nonzero(mask.sum(0) >= min_frac[1])[0]
    return int(cols[0]), int(rows[0]), int(cols[-1] + 1), int(rows[-1] + 1)

def rank_lock(vals, pal, w):
    """vals(n×3) 를 밝기 순위대로 팔레트(pal, 비중 w)에 배정. 결과 색 분포 = 원본 분포."""
    order = np.argsort(vals @ LUM, kind='stable')
    pidx = np.argsort(pal @ LUM)
    edges = np.cumsum(w[pidx]) * len(vals)
    out = np.zeros_like(vals)
    ranks = np.empty(len(vals), int); ranks[order] = np.arange(len(vals))
    slot = np.searchsorted(edges, ranks + 0.5)
    out[:] = pal[pidx[np.minimum(slot, len(pal) - 1)]]
    return out

def lab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]])
    xyz /= [0.9505, 1.0, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

TIMBER = np.array([[132, 92, 31], [96, 52, 8], [67, 29, 0]])

def near_lock(vals, pal, w):
    """vals 를 구역 팔레트의 가장 가까운 색(Lab)으로. 밝기(L)만 원본 구역의 평균·폭에 맞춘다 —
    명암 배치는 AI 것, 명암 단계는 원본 것. 목재색은 닻: 원 색에서 목재가 가장 가까운 픽셀은 목재로 두고
    나머지(재료) 픽셀만 재료색끼리 맞춘다(회벽 속 기둥이 회색으로 떠오르지 않게)."""
    lv, lp = lab(vals), lab(pal)
    is_t = (pal[:, None, :] == TIMBER[None]).all(-1).any(1)
    d0 = ((lv[:, None, :] - lp[None]) ** 2).sum(-1)
    tpx = is_t[d0.argmin(1)] if is_t.any() and not is_t.all() else np.zeros(len(vals), bool)
    out = np.zeros_like(vals)
    for sel, keep in ((tpx, is_t), (~tpx, ~is_t if not is_t.all() else is_t)):
        if not sel.any(): continue
        p, pw = pal[keep], w[keep] / w[keep].sum()
        if keep is not is_t and os.environ.get('LOCK', 'rank') == 'rank':
            # 재료 픽셀: 밝기 순위로 원본 본체 칸과 같은 색 비중(무늬 밀도 = 원본, 무늬 자리 = AI)
            out[sel] = rank_lock(vals[sel], p, pw); continue
        lvs, lps = lv[sel].copy(), lp[keep]
        d = ((lvs[:, None, :] - lps[None]) ** 2 * [1.5, 1, 1]).sum(-1)
        out[sel] = p[d.argmin(1)]
    return out

LOCK = near_lock

def dark_blocks(dark, min_w, min_h):
    """문 크기 이상의 어두운 직사각 덩어리(가짜 문) 개수 — 어두운 목재 띠·기둥은 폭이나 높이가 모자라 안 걸린다."""
    H, W = dark.shape; hits = 0
    ii = np.zeros((H + 1, W + 1), int); ii[1:, 1:] = dark.cumsum(0).cumsum(1)
    for y in range(H - min_h + 1):
        for x in range(W - min_w + 1):
            s = ii[y + min_h, x + min_w] - ii[y, x + min_w] - ii[y + min_h, x] + ii[y, x]
            if s >= 0.85 * min_w * min_h: hits += 1
    return hits

ROOF_FAMILIES = {'roof-orange': [374, 375, 376, 377, 404, 405, 354, 355, 384, 385], 'roof-blue': [406, 407, 436, 437, 467, 356, 357, 386, 387]}

def pattern_lock(s, b, z, samp, pals, fixed):
    """무늬 = 원본 본체 칸 반복, 명암 = AI(구역 평균 대비 3×3 평활 밝기 → 팔레트 ±단), 목재 자리 = AI."""
    from scipy import ndimage
    H, W = z.shape
    wall = s['kits']['wall'][b['wall']]; roofp = s['kits']['roof'][b['roof']]
    tex_of = {1: roofp, 4: wall['wall'], 5: wall['base']}
    lum = samp @ LUM
    art = np.zeros((H, W, 4), np.uint8)
    tim = pals[3][0]
    for zz in (1, 4, 5, 3):
        m = z == zz
        if not m.any(): continue
        if zz == 3:
            art[m, :3] = near_lock(samp[m].astype(float), *pals[3]); art[m, 3] = 255; continue
        tid = s['textures'][tex_of[zz]]
        tt = np.array(tile(tid))[..., :3].astype(int)
        texc = tt[np.arange(H)[:, None] % 16, np.arange(W)[None, :] % 16]     # 칸 격자에 맞춘 원본 무늬
        pal = np.unique(tt.reshape(-1, 3), axis=0); order = pal[np.argsort(pal @ LUM)]
        if zz == 1:
            # 지붕: 형태 원본 칸의 무늬 그대로(용마루·처마·사선 끝) — 지붕색이 바뀌면 같은 밝기 순위의 색으로
            orig = np.array(house_render(b['form']))[..., :3].astype(int)
            fam = {n: np.array(sorted({tuple(c) for tt_ in fams for c in np.array(tile(tt_))[..., :3].reshape(-1, 3)[np.array(tile(tt_))[..., 3].reshape(-1) > 200]}, key=lambda c: np.dot(c, LUM))) for n, fams in ROOF_FAMILIES.items()}
            src_f = 'roof-blue' if any(tuple(c) in {tuple(x) for x in fam['roof-blue']} for c in orig[m][:50]) else 'roof-orange'
            fs, ft = fam[src_f], fam[roofp]
            cmap = {tuple(c): ft[min(len(ft) - 1, round(i * (len(ft) - 1) / max(1, len(fs) - 1)))] for i, c in enumerate(fs)}
            texc = np.array([[cmap.get(tuple(orig[y, x]), orig[y, x]) for x in range(W)] for y in range(H)])
            order = np.array(sorted({tuple(c) for c in texc[m]}, key=lambda c: np.dot(c, LUM)))
        idx = {tuple(c): i for i, c in enumerate(order)}
        # 구역 안 밝기 편차(평활) — 잔무늬가 아니라 큰 명암만 남긴다
        R = 5; lz = np.where(m, lum, 0.0); cnt = ndimage.uniform_filter(m.astype(float), R); sm = ndimage.uniform_filter(lz, R) / np.maximum(cnt, 1e-6)
        mu, sd = sm[m].mean(), sm[m].std() + 1e-6
        d = (sm - mu) / sd
        step = np.where(d < -2.2, -2, np.where(d < -1.3, -1, np.where(d > 1.8, 1, 0)))
        if zz != 1: step = np.where(d < -2.2, -1, 0)   # 벽: 원본 무늬 위에 명암을 얹으면 잡점이 된다 — 짙은 그늘만
        # 벽 속 목재: 원 색이 재료색보다 목재색에 가까우면 목재(통나무 벽은 목재와 색이 겹쳐 닻을 쓰지 않는다)
        is_tim = np.zeros((H, W), bool)
        if zz in (4, 5) and b['wall'] != 'log':
            lv = lab(samp[m]); dm = ((lv[:, None] - lab(order)[None]) ** 2).sum(-1).min(1); dt = ((lv[:, None] - lab(tim)[None]) ** 2).sum(-1).min(1)
            is_tim[m] = dt < dm
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            if is_tim[y, x]:
                art[y, x, :3] = near_lock(samp[y:y + 1, x].astype(float), *pals[3])[0]
            else:
                i = idx[tuple(texc[y, x])]
                art[y, x, :3] = order[int(np.clip(i + step[y, x], 0, len(order) - 1))]
            art[y, x, 3] = 255
    fm = fixed[..., 3] > 0
    art[fm] = fixed[fm]
    return art

def fit(n):
    bid = re.sub(r'-c\d+$', '', n)
    s, b = building(bid)
    z, fixed, pm = zone_map(s, b)
    fr = json.load(open(f'{OUT}/{bid}-frame.json'))
    H, W = z.shape; k = fr['layout']['scale']
    fx, fy, fw, fh = fr['layout']['frame']; split = fr['layout']['split']
    sil = z > 0
    ys, xs = np.nonzero(sil)                       # 틀 윤곽의 bbox(형태 모서리가 비어 있을 수 있다)
    ex0, ey0 = fx + xs.min() * k, fy + ys.min() * k
    ew, eh = (xs.max() - xs.min() + 1) * k, (ys.max() - ys.min() + 1) * k
    a, bg = load(n)
    left = ~bg[:, :split]
    # 가장 큰 연결 덩어리의 bbox(떠돌이 점 무시, 뾰족한 박공 꼭대기는 포함)
    from scipy import ndimage
    lab_, n_ = ndimage.label(left)
    big = lab_ == (np.bincount(lab_.ravel())[1:].argmax() + 1)
    ys_, xs_ = np.nonzero(big)
    x0, y0, x1, y1 = int(xs_.min()), int(ys_.min()), int(xs_.max() + 1), int(ys_.max() + 1)
    bw, bh = x1 - x0, y1 - y0
    sx, sy = bw / ew, bh / eh
    inside = np.zeros_like(left); m2 = 2 * k   # 틀 자리(±2도트) 기준 — 검출 bbox 가 삐져나온 그림을 삼키지 않게
    inside[max(0, ey0 - m2):ey0 + eh + m2, max(0, ex0 - m2):ex0 + ew + m2] = True
    out_frac = float((left & ~inside).sum() / max(1, left.sum()))
        # 칸 중앙 표본(틀 좌표 → 원본 좌표, 등록된 bbox 기준)
    rr = max(1, int(k * 0.3))
    samp = np.zeros((H, W, 3), int); sbg = np.zeros((H, W), bool)
    gx0, gy0 = xs.min(), ys.min(); gw, gh = xs.max() - gx0 + 1, ys.max() - gy0 + 1
    for j in range(H):
        cy = int(y0 + (j - gy0 + 0.5) * bh / gh)
        for i in range(W):
            cx = int(x0 + (i - gx0 + 0.5) * bw / gw)
            if not (0 <= cy < a.shape[0] and 0 <= cx < a.shape[1]): sbg[j, i] = True; continue
            blk = a[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1, :3].reshape(-1, 3)
            samp[j, i] = np.median(blk, 0)
            sbg[j, i] = bg[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1].mean() > 0.5
    fill = float((~sbg & sil).sum() / sil.sum())
    spill = float((~sbg & ~sil).sum() / max(1, (~sil).sum())) if (~sil).any() else 0.0
    gray = np.zeros((H, W, 3), int)
    for zz, c in GRAY.items(): gray[z == zz] = c
    lum = samp @ LUM
    def painted(zz): return float(np.abs(samp[z == zz] - gray[z == zz]).mean()) if (z == zz).any() else None
    wallz = np.isin(z, [4, 5, 9])
    pals = zone_palettes(s, b)
    def pal_dist(zz):
        m = z == zz
        if not m.any(): return None
        p = pals[zz][0]
        d = np.sqrt(((samp[m][:, None, :] - p[None]) ** 2).sum(-1)).min(1)
        return round(float(d.mean()), 1)
    # 지붕 구역에 벽색을 칠했나(박공·벽을 틀과 다른 자리에 그림) — 틀 강제가 지붕 강조색으로 덮어 버리므로 먼저 잡는다
    rm = z == 1
    lr = lab(samp[rm]); d_roof = ((lr[:, None] - lab(pals[1][0])[None]) ** 2).sum(-1).min(1); d_wall = ((lr[:, None] - lab(pals[4][0])[None]) ** 2).sum(-1).min(1)
    roof_as_wall = float(((d_wall < d_roof * 0.5) & (lr[:, 0] > 72)).mean())   # 밝은 벽색(회벽·박공)만 — 어두운 통나무·돌색은 지붕 그늘과 겹친다
    info = dict(roof_as_wall=round(roof_as_wall, 4), bbox=[x0, y0, bw, bh], expect=[int(ex0), int(ey0), int(ew), int(eh)], spill=round(spill, 4), fixed_diff=round(float(np.abs(samp[z == 7] - fixed[z == 7][:, :3]).mean()), 1) if (z == 7).any() else 0, scale=[round(sx, 3), round(sy, 3)],
                outside=round(out_frac, 4), fill=round(fill, 4),
                painted={ZONES[zz]: (round(painted(zz), 1) if painted(zz) is not None else None) for zz in (1, 4)},
                wall_std=round(float(lum[z == 4].std()), 1),
                wall_dark=dark_blocks((lum < 45) & wallz, 10, 20),
                pal_dist={ZONES[zz]: pal_dist(zz) for zz in pals})
    checks = {
        '자리(±2도트)': abs(x0 - ex0) <= 2 * k and abs(y0 - ey0) <= 2 * k,
        '배율(±3%)': abs(sx - 1) <= 0.03 and abs(sy - 1) <= 0.03,
        '비율 유지(±3%)': abs(sy / sx - 1) <= 0.03,
        '틀 밖에 안 그림': out_frac <= 0.02,
        '틀을 다 칠함': fill >= 0.97,
        '윤곽 안 빈칸 유지': spill <= 0.03,
        '지붕을 칠함': (info['painted']['roof'] or 0) >= 30,
        '벽을 칠함': (info['painted']['wall'] or 0) >= 30 or info['wall_std'] >= 10,
        '문·창 유지': info['fixed_diff'] <= 45,
        '가짜 문 없음': info['wall_dark'] == 0,
        '지붕 자리에 벽 없음': roof_as_wall <= 0.05,
        '구역 색 계열': all(v is None or v <= 60 for v in info['pal_dist'].values()),
    }
    checks = {kk: bool(v) for kk, v in checks.items()}
    # -- 틀 강제 --
    if os.environ.get('LOCK', 'pattern') == 'pattern':
        art = pattern_lock(s, b, z, samp, pals, fixed)
        Image.fromarray(art, 'RGBA').save(f'{OUT}/{n}-art.png')
        res = dict(id=n, building=bid, **{'pass': all(checks.values())}, checks=checks, **info, **pm)
        json.dump(res, open(f'{OUT}/{n}-check.json', 'w'), ensure_ascii=False)
        return res
    art = np.zeros((H, W, 4), np.uint8)   # 틀 윤곽 밖은 투명(AI 가 그렸어도 버림)
    for zz, (p, w) in pals.items():
        m = z == zz
        if m.any(): art[m, :3] = LOCK(samp[m].astype(float), p, w); art[m, 3] = 255
    fm = fixed[..., 3] > 0
    # 창 칸의 투명 여백은 벽으로 이미 칠해져 있다. 창·문 그림은 원본 그대로 덮는다.
    art[fm] = fixed[fm]
    Image.fromarray(art, 'RGBA').save(f'{OUT}/{n}-art.png')
    res = dict(id=n, building=bid, **{'pass': all(checks.values())}, checks=checks, **info, **pm)
    json.dump(res, open(f'{OUT}/{n}-check.json', 'w'), ensure_ascii=False)
    return res

if __name__ == '__main__':
    for n in sys.argv[1:]:
        r = fit(n)
        bad = [kk for kk, v in r['checks'].items() if not v]
        print(('통과 ' if r['pass'] else '탈락 ') + n, bad, 'scale', r['scale'], 'bbox', r['bbox'], 'exp', r['expect'], 'painted', r['painted'], 'fixed', r['fixed_diff'], 'spill', r['spill'], 'dark', r['wall_dark'], 'pal', r['pal_dist'])
