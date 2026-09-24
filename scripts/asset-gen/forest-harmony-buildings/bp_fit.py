"""설계도 검사 + 확정.  python3 bp_fit.py bp-l-house-c1 ...
설계도가 이긴다: '.'칸은 AI 가 뭘 그렸든 투명, X칸은 불투명(빈 구멍은 이웃 색으로 메움), 입구는 위 검정 + 아래 359.
검사: 칸 칠함(X≥90%)·칸 비움(.≤10%)·입구 유지·입구 경계(검정 번짐 ≤3도트)·가짜 문 없음·접근칸 통행(맵 입구에서 걸어서 닿음)·\n지붕/앞벽 구역(zones)과 처마선. 격자 맞춤은 참고치.
출력 <id>-art.png(원 해상도, 원본 27색 잠금), <id>-bp.json(통행·입구·층수·칸), <id>-bpcheck.json"""
import json, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from collections import deque
from fhlib import *
BP = json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))
T = BP['tile']
HOUSE_TILES = [374,375,376,377,404,405,354,355,384,385,15,16,17,45,46,47,75,76,77,12,13,14,42,43,44,72,73,74,85,87,359,329]
PAL = np.array(sorted({tuple(int(v) for v in p[:3]) for t in HOUSE_TILES for p in np.array(tile(t)).reshape(-1, 4) if p[3] > 200}))
LUM = np.array([0.299, 0.587, 0.114])
TIM = {(132, 92, 31), (96, 52, 8), (67, 29, 0)}
def lab(rgb):
    c = np.asarray(rgb, float) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]]) / [0.9505, 1.0, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def reach(pm, starts, margin=3):
    """설계도를 잔디밭 가운데 두고(사방 margin 칸), 맵 아래 가운데 입구에서 BFS. '.'·바깥 = 통행."""
    H, W = len(pm), len(pm[0]); MW, MH = W + 2 * margin, H + 2 * margin
    ok = lambda x, y: 0 <= x < MW and 0 <= y < MH and not (margin <= x < margin + W and margin <= y < margin + H and pm[y - margin][x - margin] in 'XD')   # . G A * = 통행
    seen = {(MW // 2, MH - 1)}; q = deque(seen)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and ok(*n): seen.add(n); q.append(n)
    return [(sx, sy) for sx, sy in starts if (sx + margin, sy + margin) in seen]

ROOF_TILES_ORANGE = (374, 375, 376, 377, 404, 405, 354, 355, 384, 385)
def roof_colors():
    rc = [tuple(int(v) for v in q[:3]) for t_ in ROOF_TILES_ORANGE for q in np.array(tile(t_)).reshape(-1, 4) if q[3] > 200]
    oc = {tuple(int(v) for v in q[:3]) for t_ in HOUSE_TILES if t_ not in ROOF_TILES_ORANGE for q in np.array(tile(t_)).reshape(-1, 4) if q[3] > 200}
    return np.array(sorted(set(rc) - oc))

def tone_roof(lk, samp, fg, form_id):
    """지붕 명암 비중 맞춤. AI 기와는 그늘이 옅어서 가장 가까운 색으로 잠그면 진한 보라 윤곽(원본 30%)이 0~11% 로 사라져 지붕이 밝고 납작해진다.
    지붕색으로 잠긴 픽셀만, AI 밝기 순서는 그대로 두고 명암 단(진보라·적갈·주황·크림)의 비중을 화풍 기준 집 지붕에 맞춘다. 단 안의 쌍둥이 색은 원래 잠긴 쪽."""
    roofc = roof_colors(); L = roofc @ LUM
    ref = np.array(house_render(form_id)); px = ref[ref[..., 3] > 200][:, :3]
    share = np.array([(px == c).all(-1).sum() for c in roofc], float); share /= share.sum()
    order = np.argsort(L); bands, cur = [], [order[0]]
    for i in order[1:]:
        if L[i] - L[cur[-1]] > 10: bands.append(cur); cur = [i]
        else: cur.append(i)
    bands.append(cur)
    m = (lk[:, :, None, :] == roofc[None, None]).all(-1).any(-1) & fg
    if m.sum() < 64: return lk, None
    lum = (samp @ LUM)[m]; rank = np.argsort(np.argsort(lum, kind='stable'), kind='stable') / max(1, m.sum() - 1)
    cut = np.cumsum([share[b].sum() for b in bands]); band_of = np.searchsorted(cut[:-1], rank, side='right')
    old = lk[m]; new = old.copy()
    for bi, b in enumerate(bands):
        sel = band_of == bi
        if not sel.any(): continue
        cols = roofc[b]; keep = np.array([any((o == c).all() for c in cols) for o in old[sel]])
        main = cols[np.argmax(share[b])]
        v = np.where(keep[:, None], old[sel], main); new[sel] = v
    out = lk.copy(); out[m] = new
    before = {"%d,%d,%d" % tuple(int(x) for x in c): round(float((old == c).all(-1).mean()), 3) for c in roofc}
    return out, dict(before=before, target=[round(float(share[b].sum()), 3) for b in bands])

def fit(n):
    bid = re.sub(r'-c\d+$', '', n); bp = next(b for b in BP['blueprints'] if b['id'] == bid)
    meta = json.load(open(f'{OUT}/{bid}-ref.json')); K = meta['scale']; ox, oy = meta['origin']
    m = bp['map']; H, W = len(m), len(m[0])
    r = Image.open(f'{OUT}/{n}-raw.png').convert('RGBA')
    rs = Image.open(f'{OUT}/{bid}-ref.png').size
    if r.size != rs: r = r.resize(rs, Image.LANCZOS)   # 뽑는 쪽마다 출력 크기가 다르다(gti 1024², Tibo 1254²) — 기준 이미지 좌표로 되돌린다
    b = Image.new('RGBA', r.size, (255, 0, 255, 255)); b.alpha_composite(r)
    a = np.array(b.convert('RGB')).astype(int)
    bg = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110)
    PH, PW = H * T, W * T
    ys = oy + np.arange(PH) * K; xs = ox + np.arange(PW) * K
    q = np.stack([a[ys[:, None] + dy, xs[None, :] + dx] for dy in range(K) for dx in range(K)])
    samp = np.median(q, 0).astype(int)
    fg = ~np.stack([bg[ys[:, None] + dy, xs[None, :] + dx] for dy in range(K) for dx in range(K)]).any(0)
    cov = fg.reshape(H, T, W, T).mean(axis=(1, 3))
    solid = np.array([[c in 'XDGA' for c in row] for row in m])   # 칠해야 하는 칸
    head = np.array([[c == '*' for c in row] for row in m])        # 머리 공간: 칠해도 안 칠해도 됨
    # 하늘 칸: 그 열의 가장 위 몸통 칸보다 위에 있는 '.' 칸(예배당 탑 옆). 지붕 위로 솟은 것은 여기로 올라와도 된다(상위·통행). 마당('.' 이 몸통 아래)은 아니다.
    topb = [min([y for y in range(H) if m[y][x] in 'XDGA'] or [H]) for x in range(W)]
    sky = np.array([[m[y][x] == '.' and y < topb[x] for x in range(W)] for y in range(H)])
    bad_fill = [(x, y, round(float(cov[y, x]), 2)) for y in range(H) for x in range(W) if solid[y, x] and cov[y, x] < 0.90]   # 가장자리 1도트(윤곽선) 여유
    bad_empty = [(x, y, round(float(cov[y, x]), 2)) for y in range(H) for x in range(W) if not solid[y, x] and not head[y, x] and not sky[y, x] and cov[y, x] > 0.10]
    lum = samp @ LUM
    dcell = np.array([[c == 'D' for c in row] for row in m]); dpx = np.kron(dcell, np.ones((T, T), bool))
    door_lum = float(lum[dpx].mean()) if dpx.any() else 0.0    # 문 없는 설계도(성문·닭장·소품)
    gcell = np.array([[c == 'G' for c in row] for row in m]); gpx = np.kron(gcell, np.ones((T, T), bool))
    gate_lum = float(lum[gpx].mean()) if gcell.any() else 0.0
    # 가짜 문: 입구 칸 밖의 어두운 덩어리(문 크기 이상). 입구 칸과 닿은 덩어리는 입구의 일부로 본다.
    dark = (lum < 22) & fg & ~ndimage.binary_dilation(dpx | gpx, iterations=3)
    lb, _ = ndimage.label(dark)
    def doorlike(i, sl):                           # 문 모양: 폭 9~40, 높이 ≥16, 세로가 폭의 0.9배 이상, 상자 70% 이상 검정
        w, h = sl[1].stop - sl[1].start, sl[0].stop - sl[0].start
        return 9 <= w <= 40 and h >= 16 and h >= 0.9 * w and (lb[sl] == i).mean() >= 0.7
    fakes = [(int(sl[1].start // T), int(sl[0].start // T), int(sl[1].stop - sl[1].start), int(sl[0].stop - sl[0].start))
             for i, sl in enumerate(ndimage.find_objects(lb), 1) if doorlike(i, sl)]
    # 입구: 세로로 이어진 D 칸의 맨 아래가 이벤트 칸, 그 아래가 접근칸
    doors = [dict(x=x, y=y, front=[x, y + 1]) for y in range(H) for x in range(W) if m[y][x] == 'D' and not (y + 1 < H and m[y + 1][x] == 'D')]
    fronts_ok_cell = [d for d in doors if d['front'][1] >= H or m[d['front'][1]][d['front'][0]] == '.']
    reached = reach(m, [tuple(d['front']) for d in doors])
    yard = [(x, y) for y in range(H) for x in range(W) if m[y][x] == '.']
    yard_unreached = sorted(set(yard) - set(reach(m, yard)))
    # 격자 맞춤(참고): 가로 목재 띠 시작 y%16, 밑변
    pal = PAL
    st = bp.get('style', BP['style'])
    if 'crop' in st:
        name, cx, cy, cw, ch = st['crop']
        sa = np.array(Image.open(f'{OUT}/ctx-{name}-before.png').convert('RGB').crop((cx * T, cy * T, (cx + cw) * T, (cy + ch) * T))).reshape(-1, 3)
        u_, cnt = np.unique(sa, axis=0, return_counts=True)
        acc = [tuple(int(v) for v in q[:3]) for t_ in (208, 209, 238, 239) for q in np.array(tile(t_)).reshape(-1, 4) if q[3] > 200]   # 원본 깃발 칸 색(빨강·금)
        pal = np.unique(np.vstack([u_[cnt >= 8], np.array(acc)]), axis=0)            # 참고 맵 일부가 화풍 기준이면 그 그림의 색만(집 팔레트를 섞으면 회색 돌이 분홍 돌로 끌려간다)
    lk = samp.copy(); d2 = ((lab(samp[fg])[:, None] - lab(pal)[None]) ** 2).sum(-1); lk[fg] = pal[d2.argmin(1)]
    roof_tone = None
    if 'form' in st: lk, roof_tone = tone_roof(lk, samp, fg, st['form'])
    tim = np.zeros((PH, PW), bool)
    for c in TIM: tim |= (lk == c).all(-1)
    band = [y for y in range(PH) if fg[y].sum() >= 48 and tim[y].sum() / max(1, fg[y].sum()) >= 0.45]
    starts = [y for y in band if y - 1 not in band]
    on_grid = [y for y in starts if y % T in (0, 1, 15)]
    # 입구 경계: 입구 칸과 이어진 검정(잠금 후 순검정)이 입구 칸 밖으로 번진 폭. ≤1 도트 = 윤곽 여유, 2~3 = 잘라 맞춤(기록), 4 이상 = 탈락(문 자리가 다름)
    blk = (lk == PAL[(PAL @ LUM).argmin()]).all(-1) & fg
    lbk, _ = ndimage.label(blk); dlab, nd = ndimage.label(dcell)
    door_edge, spill = [], np.zeros((PH, PW), bool)
    for gi in range(1, nd + 1):
        gp = np.kron(dlab == gi, np.ones((T, T), bool)); gy, gx = np.where(gp)
        ids = np.setdiff1d(np.unique(lbk[gp & blk]), [0])
        sp = np.isin(lbk, ids) & ndimage.binary_dilation(gp, iterations=8) & ~gp
        sy, sx = np.where(sp)
        side = dict(left=int(max(0, gx.min() - sx.min())) if sp.any() else 0, right=int(max(0, sx.max() - gx.max())) if sp.any() else 0,
                    top=int(max(0, gy.min() - sy.min())) if sp.any() else 0)
        door_edge.append(dict(cells=[int(gx.min() // T), int(gy.min() // T)], **side, px=int(sp.sum()))); spill |= sp
    door_over = max([max(e['left'], e['right'], e['top']) for e in door_edge] or [0])
    # 지붕/앞벽 구역: 지붕색(원본 지붕 칸에만 있는 8색) 비율. 처마선 = R 바로 아래 W 인 칸 경계, 칸마다 경계 위아래 12줄 창에서 지붕 줄 수로 오차를 잰다
    z = bp.get('zones'); zone = {}
    if z:
        rc = [tuple(int(v) for v in q[:3]) for t_ in (374, 375, 376, 377, 404, 405, 354, 355, 384, 385) for q in np.array(tile(t_)).reshape(-1, 4) if q[3] > 200]
        oc = {tuple(int(v) for v in q[:3]) for t_ in HOUSE_TILES if t_ not in (374, 375, 376, 377, 404, 405, 354, 355, 384, 385) for q in np.array(tile(t_)).reshape(-1, 4) if q[3] > 200}
        roofc = np.array(sorted(set(rc) - oc))
        isroof = (lk[:, :, None, :] == roofc[None, None]).all(-1).any(-1) & fg
        rf = isroof.reshape(H, T, W, T).mean(axis=(1, 3))
        R = np.array([[c == 'R' for c in row] for row in z]); Wz = np.array([[c == 'W' for c in row] for row in z])
        eave = []
        for y in range(1, H):
            for x in range(W):
                if z[y - 1][x] == 'R' and z[y][x] == 'W':
                    w0, w1 = max(0, y * T - 12), min(PH, y * T + 12)
                    prof = isroof[w0:w1, x * T:(x + 1) * T].mean(1)
                    eave.append((x, y, int((prof >= 0.5).sum() - (y * T - w0))))
        off = [e for e in eave if abs(e[2]) > 4]
        zone = dict(roof_in_R=round(float(rf[R].mean()), 2), roof_in_W=round(float(rf[Wz].mean()), 2), R_weak=int((rf[R] < 0.3).sum()), R_cells=int(R.sum()),
                    eave_cells=len(eave), eave_off=off[:12], eave_off_n=len(off))
    # 두 등급: 칸의 20% 넘게 어긋나면 탈락(가장 가까운 색으로 메우면 줄무늬 얼룩이 된다), 그 아래는 설계도로 잘라 맞춘다(스냅 — '.'칸은 지우고 X칸 구멍은 메움)
    hard_fill = [c for c in bad_fill if c[2] < 0.8]; hard_empty = [c for c in bad_empty if c[2] > 0.2]
    prop = bp.get('kind') == 'prop'   # 소품: 칸을 다 채우지 않는 물건. 칸 채움 대신 물건이 칸 안에 충분히 있는지만 본다
    x_cov = float(cov[solid].mean())
    checks = {
        **({'물건이 칸 안에(X 칸 평균 ≥0.3)': x_cov >= 0.3} if prop else {'모양 일치(20% 넘게 빈 X 칸 없음)': not hard_fill}),
        '모양 일치(20% 넘게 칠한 . 칸 없음)': not hard_empty,
        '입구 유지': door_lum <= 45,
        '가짜 문 없음': not fakes,
        '접근칸이 땅': len(fronts_ok_cell) == len(doors),
        '접근칸 도달': len(reached) == len(doors),
        '빈 땅 전부 도달(갇힌 마당 없음)': not yard_unreached,
        **({'성문 통로 어두움': gate_lum <= 70} if gcell.any() else {}),
        '입구 경계 일치(검정이 입구 칸 밖으로 4도트 이상 번지지 않음)': door_over <= 3,
        **({'지붕 구역이 지붕(평균 ≥0.6)': zone['roof_in_R'] >= 0.6, '앞벽 구역에 지붕 없음(평균 ≤0.12)': zone['roof_in_W'] <= 0.12,
            '처마선이 파란 선에(±4도트, 칸 90% 이상)': zone['eave_off_n'] <= 0.1 * zone['eave_cells']} if z else {}),
    }
    # ── 확정: 설계도대로 ──
    art = np.zeros((PH, PW, 4), np.uint8)
    spx = np.kron(solid, np.ones((T, T), bool))
    fill = lk.copy()
    hole = spx & ~fg
    if prop: pass                                  # 소품은 투명을 그대로 둔다(메우지 않음)
    elif hole.any():                                 # X칸 안 빈 픽셀은 가장 가까운 칠한 픽셀 색으로
        idx = ndimage.distance_transform_edt(~(fg & spx), return_distances=False, return_indices=True)
        fill[hole] = lk[idx[0][hole], idx[1][hole]]
    if spill.any():                                # 입구 밖으로 번진 검정은 가장 가까운 벽 픽셀 색으로(입구 칸만 검정)
        wall = fg & spx & ~spill & ~blk
        idx = ndimage.distance_transform_edt(~wall, return_distances=False, return_indices=True)
        fill[spill] = fill[idx[0][spill], idx[1][spill]]
    paint = (spx & fg) if prop else spx
    art[paint, :3] = fill[paint]; art[paint, 3] = 255
    # 옆 윤곽 접기: 몸통이 설계도보다 1도트 넓게 그려져 바깥 윤곽이 칸 밖으로 잘려 나가면, 그 윤곽색을 가장자리 픽셀에 얹는다.
    def side(dx):
        col = np.median(np.stack([a[ys[:, None] + dy, np.array([ox + dx * K + ddx])[None, :]][:, 0] for dy in range(K) for ddx in range(K)]), 0).astype(int)
        cfg = ~np.stack([bg[ys + dy, ox + dx * K + ddx] for dy in range(K) for ddx in range(K)]).any(0)
        return col, cfg
    folded = 0
    OLD = os.environ.get('BP_OLD_HEAD') == '1'       # 비교용: 머리 1줄 고정·윤곽 접기 없음(옛 규칙). 그림만 {n}-art-old.png 로 쓴다
    for dx, xi in (() if OLD else ((-1, 0), (PW, PW - 1))):
        col, cfg = side(dx)
        for y in np.where(cfg & spx[:, xi] & ((col @ LUM) < 70))[0]:
            if (art[y, xi, :3].astype(int) @ LUM) >= 70:
                art[y, xi, :3] = pal[((lab(col[y][None])[:, None] - lab(pal)[None]) ** 2).sum(-1).argmin()]; folded += 1
    # 머리 공간: 설계도 위로 E칸까지 더 본다. 몸통과 (8방향으로) 이어진 그림만 남기고, 위로 넘친 만큼 칸을 늘린다.
    E = 0 if OLD else 3
    eys = oy - E * T * K + np.arange(E * T) * K
    se = np.median(np.stack([a[eys[:, None] + dy, xs[None, :] + dx] for dy in range(K) for dx in range(K)]), 0).astype(int)
    fe = ~np.stack([bg[eys[:, None] + dy, xs[None, :] + dx] for dy in range(K) for dx in range(K)]).any(0)
    le = se.copy(); de = ((lab(se[fe])[:, None] - lab(pal)[None]) ** 2).sum(-1); le[fe] = pal[de.argmin(1)] if fe.any() else le[fe]
    hl = np.kron(head | sky, np.ones((T, T), bool))
    comb = np.vstack([fe, fg & (spx | hl)]); lbh, _ = ndimage.label(comb, structure=np.ones((3, 3)))
    body = np.vstack([np.zeros_like(fe), spx & fg])
    keep = np.isin(lbh, np.setdiff1d(np.unique(lbh[body]), [0])) & ~body
    ke, kh = keep[:E * T], keep[E * T:] & hl
    extra = int(np.ceil((E * T - np.where(ke.any(1))[0].min()) / T)) if ke.any() else 0
    clipped_top = bool(ke[0].any()) if E else False  # E칸으로도 모자라 맨 위에서 또 잘림
    if OLD: kh = np.kron(head, np.ones((T, T), bool)) & fg
    art[kh, :3] = lk[kh]; art[kh, 3] = 255
    if extra:
        top = np.zeros((extra * T, PW, 4), np.uint8); kk = ke[E * T - extra * T:]
        top[kk, :3] = le[E * T - extra * T:][kk]; top[kk, 3] = 255
        art = np.vstack([top, art])
    for d in doors:                                # 입구: 이어진 D 칸 중 맨 아래 = 359, 그 위 = 완전 검정
        x, y = d['x'], d['y'] + extra
        art[y * T:(y + 1) * T, x * T:(x + 1) * T] = np.array(tile(359))
        yy = y - 1
        while yy - extra >= 0 and m[yy - extra][x] == 'D':
            art[yy * T:(yy + 1) * T, x * T:(x + 1) * T] = (0, 0, 0, 255); yy -= 1
    if OLD: Image.fromarray(art).save(f'{OUT}/{n}-art-old.png'); return None
    Image.fromarray(art).save(f'{OUT}/{n}-art.png')
    # 실제 설계도: 늘린 머리 줄 + 그림이 올라온 하늘 칸을 '*' 로
    cell_has = lambda y, x: art[y * T:(y + 1) * T, x * T:(x + 1) * T, 3].any()
    meff = ['*' * W for _ in range(extra)] + [''.join('*' if sky[y, x] and cell_has(y + extra, x) else m[y][x] for x in range(W)) for y in range(H)]
    tiles = {art[y * T:(y + 1) * T, x * T:(x + 1) * T].tobytes() for y in range(H + extra) for x in range(W) if meff[y][x] != '.' and cell_has(y, x)}
    doors_eff = [dict(x=d['x'], y=d['y'] + extra, front=[d['front'][0], d['front'][1] + extra]) for d in doors]
    out = dict(id=n, w=W, h=H + extra, headExtra=extra, stories=bp['stories'], map=meff, passmap=[''.join('X' if c in 'XD' else '.' for c in row) for row in meff],
               layers=[''.join('U' if c in 'A*' else ('L' if c in 'XDG' else '-') for c in row) for row in meff], doors=doors_eff,
               tilesUsed=len(tiles), uniqueTiles=len(tiles))
    json.dump(out, open(f'{OUT}/{n}-bp.json', 'w'), ensure_ascii=False)
    res = dict(id=n, **{'pass': all(checks.values())}, checks=checks, snapped=len(bad_fill) + len(bad_empty), bad_fill=bad_fill[:12], bad_empty=bad_empty[:12], door_lum=round(door_lum, 1),
               fakes=fakes, roof_tone=roof_tone, door_edge=door_edge, door_over=door_over, zone=zone, doors=doors, reached=reached, yard_unreached=yard_unreached[:10], gate_lum=round(gate_lum, 1), beams_start=starts[:20], beams_on_grid=f'{len(on_grid)}/{len(starts)}',
               palette_dE=round(float(np.sqrt(d2.min(1)).mean()), 1), head_extra=extra, head_clipped_top=clipped_top, outline_folded=folded, **{k: out[k] for k in ('tilesUsed', 'uniqueTiles')})
    json.dump(res, open(f'{OUT}/{n}-bpcheck.json', 'w'), ensure_ascii=False)
    return res

if __name__ == '__main__':
    for n in sys.argv[1:]:
        r = fit(n); bad = [k for k, v in r['checks'].items() if not v]
        print(('통과 ' if r['pass'] else '탈락 ') + n, bad, '| 스냅한 칸', r['snapped'], '| X 못 칠함', r['bad_fill'][:4], '| 빈칸에 그림', r['bad_empty'][:5],
              '| 입구 밝기', r['door_lum'], '| 가짜 문(칸x,칸y,w,h)', r['fakes'][:4], '| 도달', r['reached'], '| 갇힌 땅', r['yard_unreached'][:3], '| 성문 밝기', r['gate_lum'], '| 입구 번짐', r['door_over'], [(e['left'], e['right'], e['top']) for e in r['door_edge']], '| 구역', r['zone'], '| 목재 띠 칸 경계', r['beams_on_grid'], r['beams_start'][:10], '| 머리 +칸', r['head_extra'], '맨위 잘림' if r['head_clipped_top'] else '', '| 옆 윤곽 접음', r['outline_folded'], '| ΔE', r['palette_dE'], '| 칸', r['tilesUsed'], '고유', r['uniqueTiles'])
