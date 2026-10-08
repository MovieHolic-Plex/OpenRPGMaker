"""murim-chipset 기계 관문. 깨진 것만 거른다 — 통과는 합격이 아니다(시점·화풍·읽힘은 사람이 본다).

관문 코드 (FAIL = 시트에 내보내지 않음, WARN = 시트에 표시만)
  P 팔레트 잠금     불투명 화소가 잠긴 색 밖 / 반투명이 그림자(ink·고정 alpha) 아님            FAIL
  Z 크기            칸 수 × 16px                                                             FAIL
  Q 불투명 계약      tile·wall: 전부 불투명 / roof: 윗줄 불투명 / object: 귀퉁이 투명·채움 비율   FAIL
  O 먹 윤곽         object 실루엣 가장자리 화소의 75% 이상이 ink 또는 재질 램프 0~1단             FAIL
  F 윗면 행         wall·roof·object: meta['top'] 의 윗면 띠가 2행 이상·폭 50% 이상이고,
                    그 바로 아래(앞 모서리) 줄보다 밝다. 띠가 있다는 것만 본다 — 시점 판정 아님  FAIL
  S 반복 이음        tileable 축마다 감은 이음(마지막 열→첫 열)의 밝기 차가 안쪽 열 경계 중 가장 큰 차
                    + 0.02 를 넘지 않는다(줄눈·귀틀처럼 일부러 그은 선은 안쪽에도 있으므로 허용)        FAIL
  R 색만 바꾼 후보   같은 항목의 두 후보가 실루엣이 같고(IoU>0.97) 밝기 배치 상관이 0.92 초과          FAIL
  J 조각 맞물림      세트 항목(seed pieces)에서 시드 joins 로 이웃하는 두 조각의 맞닿는 열(줄) 밝기 차가
                    두 조각 안쪽 열 경계 중 가장 큰 차 + 0.02 이하. '@style' 은 그 줄의 style 조각       FAIL
  Y 줄 재료         후보 불투명 화소의 8% 이상을 차지하는 램프가 그 줄 style 조각(seed styleRef)에 쓰인
                    램프 ∪ 시드 extraRamps 안. 다른 줄의 재료로 그린 후보를 거른다(화풍 판정 아님)      FAIL
  G 바닥 닿음       시드 footOnEdge: 불투명 화소의 맨 아래 행이 칸 아래 경계(마지막 행)다 — 걸상·가구가 뜨지 않는다 FAIL
  K 배치 견본       시드 layout(탁자+걸상 배치): 후보 그림 = 같은 번호 탁자·걸상을 layout 대로 합성한 것(화소 일치),
                    좌·우 걸상 앉는 면 가운데 = 탁자 윗면 가운데 ±2px, 뒤 걸상 앉는 면이 탁자에 가리고도 절반 이상 보임,
                    앞 걸상 앉는 면 위 행 − 탁자 두께 띠 아래 행 = 2~4px, 앞 걸상 발 = 견본 맨 아래 행,
                    좌·우 걸상이 탁자 다리(두께 띠 아래 화소)와 겹치지 않음. 기계 검사는 눈 판정을 대신하지 않는다   FAIL
  T 가는 줄         object 폭 1px 화소 비율 > 0.14                                            WARN
  L 빛 방향         object 오른쪽 반이 왼쪽 반보다 밝음(> 0.06)                                 WARN
  N 1px 잡티        네 이웃이 모두 같은 색인데 혼자 다른 화소 비율 > 0.03                         WARN
"""
import numpy as np

from tk import ALLOWED, INK, PAL, RAMPS, SHADOW, SHADOW_A, T, Cv, compose_layout, luma

TONE_OF = {}
for _name, _ramp in RAMPS.items():
    for _i, _c in enumerate(_ramp):
        TONE_OF.setdefault(_c, (_name, _i))
TONE_OF[INK] = ('ink', 0)


def _res(code, level, ok, msg):
    return {'code': code, 'level': level, 'ok': bool(ok), 'msg': msg}


def check_one(item, im, meta):
    a = np.asarray(im.convert('RGBA'))
    h, w = a.shape[:2]
    rgb, al = a[:, :, :3], a[:, :, 3]
    op = al == 255
    out = []
    kind = item['kind']

    # P
    bad = 0
    cols = {tuple(int(v) for v in rgb[y, x]) for y, x in zip(*np.nonzero(op))}
    off = [c for c in cols if c not in ALLOWED]
    semi = (al > 0) & (al < 255)
    semi_bad = 0
    for y, x in zip(*np.nonzero(semi)):
        if al[y, x] != SHADOW_A or tuple(int(v) for v in rgb[y, x]) != SHADOW:
            semi_bad += 1
    bad = len(off) + semi_bad
    out.append(_res('P', 'FAIL', bad == 0, f'잠금 밖 색 {len(off)}종, 그림자 아닌 반투명 {semi_bad}화소' if bad else f'잠금 안 {len(cols)}색'))

    # Z
    ew, eh = item['size'][0] * T, item['size'][1] * T
    out.append(_res('Z', 'FAIL', (w, h) == (ew, eh), f'{w}×{h} (계약 {ew}×{eh})'))

    # Q
    if kind in ('tile', 'wall'):
        ok = bool(op.all())
        out.append(_res('Q', 'FAIL', ok, '전부 불투명' if ok else f'투명·반투명 화소 {int((~op).sum())}'))
    elif kind == 'roof':
        # 추녀 끝·용마루 끝 조각은 바깥이 투명하다 — 시드 조각의 qMin·qTopRow 로 완화(가운데 조각은 기본값 그대로)
        need_top = item.get('qTopRow', True)
        qmin = item.get('qMin', 0.9)
        ok = (bool(op[0].all()) or not need_top) and op.mean() >= qmin
        out.append(_res('Q', 'FAIL', ok, f'윗줄 불투명 {bool(op[0].all())}{"" if need_top else "(안 봄)"}, 불투명 {op.mean():.0%} (하한 {qmin:.0%})'))
    else:
        corners = [al[0, 0], al[0, w - 1], al[h - 1, 0], al[h - 1, w - 1]]
        corner_ok = all(c != 255 for c in corners[:2])  # 위 귀퉁이 둘은 반드시 비어야(받침이 바닥까지 꽉 찰 수는 있다)
        fill = op.mean()
        ok = corner_ok and 0.15 <= fill <= 0.95
        out.append(_res('Q', 'FAIL', ok, f'위 귀퉁이 투명 {corner_ok}, 채움 {fill:.0%}'))

    L = luma(rgb)

    # O
    if kind == 'object':
        pad = np.pad(op, 1)
        inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
        edge = op & ~inner
        n = int(edge.sum())
        dark = 0
        for y, x in zip(*np.nonzero(edge)):
            c = tuple(int(v) for v in rgb[y, x])
            r = TONE_OF.get(c)
            if r and (r[0] == 'ink' or r[1] <= 1):
                dark += 1
        frac = dark / max(n, 1)
        out.append(_res('O', 'FAIL', frac >= 0.75, f'가장자리 {n}화소 중 먹·어두운 단 {frac:.0%}'))

    # F
    if kind in ('wall', 'roof', 'object'):
        top = (meta or {}).get('top')
        if not top:
            out.append(_res('F', 'FAIL', False, "meta['top'] 없음 — 윗면 행을 선언해야 한다"))
        else:
            y0, y1 = top
            rows = list(range(y0, y1))
            ys = np.nonzero(op.any(axis=1))[0]
            xs = np.nonzero(op.any(axis=0))[0]
            bw = (xs.max() - xs.min() + 1) if len(xs) else 1
            cover = np.mean([op[y].sum() / bw for y in rows]) if rows else 0
            band = op[y0:y1]
            top_mean = float(L[y0:y1][band].mean()) if band.any() else 0.0
            edge_rows = [y for y in (y1 - 1, y1, y1 + 1) if 0 <= y < h and op[y].any()]
            edge_mean = min(float(L[y][op[y]].mean()) for y in edge_rows) if edge_rows else 1.0
            upper = True
            if kind == 'object' and len(ys):
                upper = y0 <= ys.min() + 0.5 * (ys.max() - ys.min())
            ok = len(rows) >= 2 and cover >= 0.5 and top_mean - edge_mean >= 0.05 and upper
            out.append(_res('F', 'FAIL', ok, f'윗면 {y0}~{y1 - 1}행({len(rows)}행) 폭 {cover:.0%}, 밝기 {top_mean:.2f} vs 앞 모서리 {edge_mean:.2f}'
                            + ('' if upper else ', 윗면이 실루엣 아래쪽에 있다')))

    # G
    if item.get('footOnEdge'):
        ys = np.nonzero(op.any(axis=1))[0]
        bot = int(ys.max()) if len(ys) else -1
        out.append(_res('G', 'FAIL', bot == h - 1, f'불투명 맨 아래 행 {bot} (칸 아래 경계 {h - 1})' + ('' if bot == h - 1 else f' — {h - 1 - bot}px 뜬다')))

    # S
    axes = item.get('tileable') or ''
    for ax in axes:
        if ax == 'x':
            wrap = float(np.abs(L[:, 0] - L[:, -1]).mean())
            inner = np.abs(np.diff(L, axis=1)).mean(axis=0)
        else:
            wrap = float(np.abs(L[0, :] - L[-1, :]).mean())
            inner = np.abs(np.diff(L, axis=0)).mean(axis=1)
        lim = float(inner.max()) + 0.02
        out.append(_res('S', 'FAIL', wrap <= lim, f'{ax}축 감은 이음 {wrap:.3f} (안쪽 최대 {inner.max():.3f})'))

    if kind == 'object':
        pad = np.pad(op, 1)
        lf, rt, up, dn = pad[1:-1, :-2], pad[1:-1, 2:], pad[:-2, 1:-1], pad[2:, 1:-1]
        thin = op & (~(lf | rt) | ~(up | dn))
        tr = thin.sum() / max(op.sum(), 1)
        out.append(_res('T', 'WARN', tr <= 0.14, f'폭 1px 화소 {tr:.0%}'))
        xs = np.nonzero(op.any(axis=0))[0]
        mid = (xs.min() + xs.max() + 1) / 2
        X = np.arange(w)[None, :].repeat(h, 0)
        lm, rm = op & (X < mid), op & (X >= mid)
        d = float(L[rm].mean() - L[lm].mean()) if lm.any() and rm.any() else 0.0
        out.append(_res('L', 'WARN', d <= 0.06, f'오른쪽−왼쪽 밝기 {d:+.2f}'))

    # N
    key = rgb[:, :, 0].astype(np.int32) * 65536 + rgb[:, :, 1].astype(np.int32) * 256 + rgb[:, :, 2]
    key = np.where(op, key, -1)
    c = key[1:-1, 1:-1]
    u, d_, l_, r_ = key[:-2, 1:-1], key[2:, 1:-1], key[1:-1, :-2], key[1:-1, 2:]
    lone = (c >= 0) & (u == d_) & (u == l_) & (u == r_) & (u >= 0) & (c != u)
    nr = lone.sum() / max(op.sum(), 1)
    out.append(_res('N', 'WARN', nr <= 0.03, f'혼자 다른 1px {int(lone.sum())}개 ({nr:.1%})'))
    return out


def check_recolor(cands):
    """cands: {글자: PIL 이미지}. 색만 바꾼 쌍을 찾는다: 실루엣이 같고 밝기 배치가 거의 같으면 같은 그림이다."""
    letters = sorted(cands)
    hits = {L: [] for L in letters}
    arr = {L: np.asarray(cands[L].convert('RGBA')) for L in letters}
    for i, a in enumerate(letters):
        for b in letters[i + 1:]:
            A, B = arr[a], arr[b]
            if A.shape != B.shape:
                continue
            ma, mb = A[:, :, 3] == 255, B[:, :, 3] == 255
            m_iou = (ma & mb).sum() / max((ma | mb).sum(), 1)
            both = ma & mb
            if both.sum() < 16:
                continue
            la, lb = luma(A[:, :, :3])[both], luma(B[:, :, :3])[both]
            corr = float(np.corrcoef(la, lb)[0, 1]) if la.std() > 1e-6 and lb.std() > 1e-6 else 1.0
            if m_iou > 0.97 and corr > 0.92:
                hits[a].append(f'{b}(상관 {corr:.2f})')
                hits[b].append(f'{a}(상관 {corr:.2f})')
    return {L: _res('R', 'FAIL', not hits[L], f'{",".join(hits[L])} 와 구조가 같다(색만 바꿈)' if hits[L] else '다른 후보와 구조가 다르다')
            for L in letters}


def _edge_pair(A, B, axis):
    """A 의 끝 열(줄)과 B 의 첫 열(줄)을 맞댄다. 길이가 다르면 짧은 쪽을 감아 늘린다(반복 조각)."""
    if axis == 'y':
        A, B = A.transpose(1, 0, 2), B.transpose(1, 0, 2)
    ha, hb = A.shape[0], B.shape[0]
    n = max(ha, hb)
    if ha != n:
        A = np.concatenate([A] * (n // ha + 1), axis=0)[:n]
    if hb != n:
        B = np.concatenate([B] * (n // hb + 1), axis=0)[:n]
    return A, B


def _inner_max(L, op):
    d = np.abs(np.diff(L, axis=1))
    both = op[:, 1:] & op[:, :-1]
    vals = [float(d[:, i][both[:, i]].mean()) for i in range(d.shape[1]) if both[:, i].sum() >= 4]
    return max(vals) if vals else 0.0


def check_join(a_im, b_im, axis):
    """조각 a 오른쪽(axis x) 또는 아래(axis y)에 b 를 붙였을 때 맞닿는 선이 안쪽 경계보다 튀지 않는지. (ok, 차, 한도)"""
    A, B = _edge_pair(np.asarray(a_im.convert('RGBA')), np.asarray(b_im.convert('RGBA')), axis)
    la, lb = luma(A[:, :, :3]), luma(B[:, :, :3])
    oa, ob = A[:, :, 3] == 255, B[:, :, 3] == 255
    both = oa[:, -1] & ob[:, 0]
    if both.sum() < 4:
        return True, 0.0, 0.0
    seam = float(np.abs(la[both, -1] - lb[both, 0]).mean())
    lim = max(_inner_max(la, oa), _inner_max(lb, ob)) + 0.02
    return seam <= lim, seam, lim


def ramp_shares(im):
    """불투명 화소에서 램프별 비율. ink 는 'ink'."""
    a = np.asarray(im.convert('RGBA'))
    op = a[:, :, 3] == 255
    n = int(op.sum())
    cnt = {}
    for y, x in zip(*np.nonzero(op)):
        r = TONE_OF.get(tuple(int(v) for v in a[y, x, :3]))
        k = r[0] if r else '?'
        cnt[k] = cnt.get(k, 0) + 1
    return {k: v / max(n, 1) for k, v in cnt.items()}


def check_line_material(im, ref_ims, extra=(), share=0.08, ref_share=0.01):
    """후보의 주 재료(불투명 8% 이상 램프)가 줄 style 조각에 쓰인 램프(1% 이상) ∪ extra 안인지."""
    allowed = {'ink'} | set(extra)
    for r in ref_ims:
        allowed |= {k for k, v in ramp_shares(r).items() if v >= ref_share}
    main = {k: v for k, v in ramp_shares(im).items() if v >= share}
    off = sorted(k for k in main if k not in allowed)
    msg = (f'줄 재료 밖 램프 {", ".join(f"{k} {main[k]:.0%}" for k in off)} (허용 {",".join(sorted(allowed))})' if off
           else f'주 재료 {",".join(sorted(main))} ⊆ 줄 재료')
    return _res('Y', 'FAIL', not off, msg)


def palette_report(joseon_palette_path):
    """잠금 팔레트 점검: 허용 색 = 램프 합집합, 단마다 밝기가 joseon_baram 램프 범위(±0.04) 안, 색상이 조선 램프와 구별되는지."""
    import json
    j = json.load(open(joseon_palette_path, encoding='utf-8'))['ramps']
    j7 = {k: v for k, v in j.items() if len(v) == 7}

    def hx(c):
        return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))

    env = []
    for t in range(7):
        ls = [float(luma(hx(v[t]))) for v in j7.values()]
        env.append((min(ls) - 0.04, max(ls) + 0.04))
    rep = {'ramps': {}, 'fail': []}
    union = {c for v in PAL['ramps'].values() for c in v} | {PAL['ink']} | {c for v in PAL['shared'].values() for c in v}
    if set(PAL['allowed']) != union:
        rep['fail'].append('allowed 가 램프 합집합과 다르다')
    for name, ramp in PAL['ramps'].items():
        ls = [float(luma(hx(c))) for c in ramp]
        out_of = [t for t, l in enumerate(ls) if not (env[t][0] <= l <= env[t][1])]
        mono = all(ls[i] < ls[i + 1] for i in range(6))
        mid = np.array(hx(ramp[3]) + hx(ramp[4]), float)
        dist = min(float(np.abs(mid - np.array(hx(v[3]) + hx(v[4]), float)).mean()) for v in j7.values())
        nearest = min(j7, key=lambda k: float(np.abs(mid - np.array(hx(j7[k][3]) + hx(j7[k][4]), float)).mean()))
        rep['ramps'][name] = {'luma': [round(l, 2) for l in ls], 'outOfEnvelope': out_of, 'monotone': mono,
                              'nearestJoseon': nearest, 'midDistance': round(dist, 1)}
        if out_of:
            rep['fail'].append(f'{name}: 단 {out_of} 밝기가 조선 범위 밖')
        if not mono:
            rep['fail'].append(f'{name}: 어두움→밝음 순서가 아니다')
    ink_l = float(luma(hx(PAL['ink'])))
    if ink_l > 0.08:
        rep['fail'].append(f'ink 밝기 {ink_l:.2f} > 0.08')
    rep['envelope'] = [(round(a, 2), round(b, 2)) for a, b in env]
    return rep


def _cv_of(im):
    a = np.asarray(im.convert('RGBA'))
    cv = Cv(a.shape[1], a.shape[0])
    cv.a[:] = a
    return cv


def _first_opaque_row(a):
    ys = np.nonzero((a[:, :, 3] == 255).any(axis=1))[0]
    return int(ys.min()) if len(ys) else None


def check_layout(item, set_im, parts):
    """K 배치 견본. parts = {part 이름: (PIL, meta)} — 같은 판·같은 후보 키의 탁자·걸상.
    table meta: ellipse=(y0, y1) 윗면 타원 행(윤곽 포함, y1 미포함), band=두께 띠 맨 아래 행.
    stool meta: seat=(y0, y1) 앉는 면 타원 행(윤곽 포함, y1 미포함)."""
    lay = item['layout']
    rules = lay.get('rules', {})
    tol = rules.get('sideSeatTol', 2)
    vis_min = rules.get('backSeatVisible', 0.5)
    g0, g1 = rules.get('frontGap', [2, 4])
    place = lay['place']
    names = lay['parts']
    tim, tmeta = parts[names['table']]
    sim, smeta = parts[names['stool']]
    bad, ok_msgs = [], []
    ta, sa = np.asarray(tim.convert('RGBA')), np.asarray(sim.convert('RGBA'))
    e0, e1 = tmeta['ellipse']
    s0, s1 = smeta['seat']
    if _first_opaque_row(ta) != e0:
        bad.append(f'탁자 윗면 타원 첫 행 {e0} ≠ 탁자 맨 위 화소 {_first_opaque_row(ta)}')
    if _first_opaque_row(sa) != s0:
        bad.append(f'걸상 앉는 면 첫 행 {s0} ≠ 걸상 맨 위 화소 {_first_opaque_row(sa)}')
    # 1) 화소 일치
    want = compose_layout(lay, {'table': _cv_of(tim), 'stool': _cv_of(sim)}, item['size']).img()
    same = np.array_equal(np.asarray(want), np.asarray(set_im.convert('RGBA')))
    if not same:
        bad.append('견본 그림이 탁자·걸상을 layout 대로 합성한 것과 다르다')
    tx, ty = place['table']['px']
    tc = ty + (e0 + e1 - 1) / 2
    band = ty + tmeta['band']
    # 2) 좌·우 앉는 면
    for side in ('left', 'right'):
        sx, sy = place[side]['px']
        sc = sy + (s0 + s1 - 1) / 2
        d = sc - tc
        (bad if abs(d) > tol else ok_msgs).append(f'{side} 앉는 면 {sc:.1f} vs 탁자 윗면 가운데 {tc:.1f} ({d:+.1f})')
    # 3) 뒤 걸상 앉는 면이 보이는 비율
    bx, by = place['back']['px']
    W, Hh = item['size'][0] * T, item['size'][1] * T
    seat = np.zeros((Hh, W), bool)
    seat_rows = sa[s0:s1, :, 3] == 255
    for j in range(seat_rows.shape[0]):
        for i in range(seat_rows.shape[1]):
            Y, X = by + s0 + j, bx + i
            if seat_rows[j, i] and 0 <= Y < Hh and 0 <= X < W:
                seat[Y, X] = True
    tmask = np.zeros((Hh, W), bool)
    top = ta[:, :, 3] == 255
    for j in range(top.shape[0]):
        for i in range(top.shape[1]):
            Y, X = ty + j, tx + i
            if top[j, i] and 0 <= Y < Hh and 0 <= X < W:
                tmask[Y, X] = True
    n = int(seat.sum())
    vis = float((seat & ~tmask).sum()) / max(n, 1)
    (bad if vis < vis_min else ok_msgs).append(f'뒤 걸상 앉는 면 {vis:.0%} 보임')
    # 4) 앞 걸상 간격·발
    fx, fy = place['front']['px']
    gap = fy + s0 - band
    (bad if not (g0 <= gap <= g1) else ok_msgs).append(f'앞 걸상 간격 {gap}px (띠 아래 {band}행 → 앉는 면 {fy + s0}행)')
    ys = np.nonzero((sa[:, :, 3] == 255).any(axis=1))[0]
    foot = fy + int(ys.max())
    if foot != Hh - 1:
        bad.append(f'앞 걸상 발 {foot}행 ≠ 견본 맨 아래 {Hh - 1}행')
    # 5) 좌·우 걸상 vs 탁자 다리
    legs = tmask.copy()
    legs[:band + 1, :] = False
    for side in ('left', 'right'):
        sx, sy = place[side]['px']
        m = np.zeros((Hh, W), bool)
        sop = sa[:, :, 3] == 255
        for j in range(sop.shape[0]):
            for i in range(sop.shape[1]):
                Y, X = sy + j, sx + i
                if sop[j, i] and 0 <= Y < Hh and 0 <= X < W:
                    m[Y, X] = True
        k = int((m & legs).sum())
        if k:
            bad.append(f'{side} 걸상이 탁자 다리와 {k}화소 겹친다')
    return _res('K', 'FAIL', not bad, '; '.join(bad) if bad else '배치 통과 — ' + ', '.join(ok_msgs))
