"""murim-chipset 기계 관문. 깨진 것만 거른다 — 통과는 합격이 아니다(시점·화풍·읽힘은 사람이 본다).

관문 코드 (FAIL = 시트에 내보내지 않음, WARN = 시트에 표시만)
  P 팔레트 잠금     불투명 화소가 잠긴 색 밖 / 반투명이 그림자(ink·고정 alpha) 아님            FAIL
  Z 크기            칸 수 × 16px                                                             FAIL
  Q 불투명 계약      tile·wall: 전부 불투명 / roof: 윗줄 불투명 / object: 귀퉁이 투명·채움 비율   FAIL
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
                    앞 걸상 앉는 면이 탁자 받침(맨 아래 화소) 아래 바닥 틈 2~4px 뒤, 앞 걸상은 탁자와 한 화소도
                    겹치지 않음(받침 기둥에 꽂혀 보이지 않게), 좌·우 걸상이 탁자 다리(두께 띠 아래 화소)와 겹치지 않음. 기계 검사는 눈 판정을 대신하지 않는다   FAIL
  T 가는 줄         object 폭 1px 화소 비율 > 0.14                                            WARN
  OUTLINE 먹 윤곽   외곽선 규칙(사용자 2026-10-08): 가장자리 화소 중 먹(밝기 ≤ INK_LUMA) 비율 > OUTLINE_INK_MAX,
                    또는 object 의 빛 쪽(위·왼) 가장자리 중 먹·재질 0~1단 비율 > OUTLINE_LIT_MAX(빙 두른 어두운 윤곽).
                    object = 실루엣 바깥 1px, 지형(tile·wall·roof) = 반복 축·맞물림이 아닌 변의 바깥 테두리 띠 2px
                    (+ 칸 안 투명과 맞닿은 실루엣)                                                  WARN
  CONTRAST 묻힘     크기 ≤2칸 object 를 그 줄 대표 바닥 위에 놓았을 때 그늘 쪽(아래·오른) 실루엣 가장자리 평균 밝기와
                    바닥 평균 밝기 차 < CONTRAST_MIN (harness.py 가 줄 바닥을 골라 check_contrast 를 부른다)  WARN
  ※ 옛 O(object 가장자리 75% 이상 먹·0~1단, FAIL)는 외곽선 규칙과 반대라 지웠다(2026-10-08).
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


def check_one(item, im, meta, open_sides=None):
    """open_sides: 지형 조각의 바깥 변(세트 조각은 맞물림 변을 뺀 것, harness 가 준다). None 이면 반복 축이 아닌 네 변."""
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
    out.append(check_outline(kind, a, item.get('tileable') or '', open_sides, lit_check=item.get('outlineClass') != 'structure'))
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
    side_off = rules.get('sideSeatOffset', 0)  # 옆 걸상을 윗면 가운데보다 이 px 만큼 내려 앉힌다(감독 2026-10-09)
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
        d = sc - tc - side_off
        off_note = f' − 내림 {side_off}' if side_off else ''
        (bad if abs(d) > tol else ok_msgs).append(f'{side} 앉는 면 {sc:.1f} vs 탁자 윗면 가운데 {tc:.1f}{off_note} ({d:+.1f})')
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
    # 4) 앞 걸상: 탁자 받침(발) 아래 바닥 틈 g0~g1 px 뒤에 앉는 면 — 받침 기둥에 꽂혀 보이지 않게(감독 2026-10-08)
    fx, fy = place['front']['px']
    tys = np.nonzero((ta[:, :, 3] == 255).any(axis=1))[0]
    tfoot = ty + int(tys.max())
    if 'foot' in tmeta and ty + tmeta['foot'] != tfoot:
        bad.append(f'탁자 meta foot {ty + tmeta["foot"]} ≠ 탁자 맨 아래 화소 {tfoot}')
    gap = fy + s0 - tfoot - 1
    (bad if not (g0 <= gap <= g1) else ok_msgs).append(f'앞 걸상 바닥 틈 {gap}px (탁자 받침 아래 {tfoot}행 → 앉는 면 {fy + s0}행)')
    ys = np.nonzero((sa[:, :, 3] == 255).any(axis=1))[0]
    foot = fy + int(ys.max())
    if foot > Hh - 1:
        bad.append(f'앞 걸상 발 {foot}행이 견본 밖({Hh - 1}행까지)')
    # 5) 좌·우 걸상은 탁자 다리와, 앞 걸상은 탁자 어느 화소와도 겹치지 않는다
    legs = tmask.copy()
    legs[:band + 1, :] = False
    fm = np.zeros((Hh, W), bool)
    sop = sa[:, :, 3] == 255
    for j in range(sop.shape[0]):
        for i in range(sop.shape[1]):
            Y, X = fy + j, fx + i
            if sop[j, i] and 0 <= Y < Hh and 0 <= X < W:
                fm[Y, X] = True
    k = int((fm & tmask).sum())
    if k:
        bad.append(f'앞 걸상이 탁자와 {k}화소 겹친다(받침 기둥에 꽂혀 보인다)')
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


# ---------------------------------------------------------------------------- 외곽선 규칙 (WARN)
# 사용자 결정 2026-10-08 — 시연 http://mdc-server:18301/outline-before-after.html 을 보고
#   「1 3 4 5 7 8 은 외곽선이 없는 게 나은데」 → 「그래 그렇게하고」.
#   지형·기물 모두 먹 윤곽 없이 재질 자신의 명암(빛 받는 위·왼 = 밝은 단, 그늘 아래·오른 = 어두운 단)으로 형태를 읽게 한다.
#   바닥과 밝기가 비슷한 작은 기물(1~2칸)만 그늘 쪽을 그 재질의 가장 어두운 단 + 진한 접지 그림자로. 그래도 먹은 쓰지 않는다.
#
# 먹 = 밝기 ≤ INK_LUMA. 근거(palette.json, luma = 0.299R + 0.587G + 0.114B):
#   ink 0.056 과 재질 0단 mu 0.049 · wa 0.061 · zhuz 0.070 · cao 0.074 · zhu 0.079 는 눈으로 먹과 구별되지 않는다
#   (시연 murim_demo: 「0단은 먹과 밝기가 같아 다시 윤곽이 되므로 쓰지 않는다」). 그다음 어두운 색은 mu 1단 0.099 · song 0단 0.100 —
#   시연이 그늘 쪽에 쓴 재질의 어두운 단이다. 0.079 와 0.099 사이를 자른다.
INK_LUMA = 0.09
# 가장자리 먹 비율 상한. 시연 before(먹 1px 윤곽) 탁자·술독·계단 가장자리는 먹 95~100%, after(빛 쪽만 한 단 밝힌 sel-out) 60~81%,
# 「외곽선 없음」 안은 0%.
# 접지 그림자 쪽 한두 화소·문고리 같은 일부러 찍은 어두운 점은 남을 수 있어 0.15 까지 둔다.
OUTLINE_INK_MAX = 0.15
# 빛 쪽(위·왼) 가장자리가 먹·재질 어두운 단(0~1단 — 옛 관문 O 가 「어두운 윤곽」으로 친 단)으로 빙 둘러졌는지. 규칙: 빛 쪽은 재질 밝은 단.
# 시연 탁자·술독·계단 before(먹 윤곽)는 빛 쪽 100%, after(sel-out)는 47~60%(계단 100%), 「외곽선 없음」 안은 0%. 반 넘게 어두우면 경고.
OUTLINE_LIT_MAX = 0.5
LIT_DARK_STEP = 1
# 묻힘 기준. 시연 잔돌 B1: stone 0단 윤곽(밝기 0.21)과 B 줄 흙바닥(0.38) 차 0.17 은 바닥 반점(0.24)에 묻혔다고 했고,
# 같은 잔돌 「외곽선 없음」 안은 그늘 쪽 0.38 vs 바닥 0.38 (차 0.00) — 형태가 바닥에 녹는다. 예외 규칙(그늘 쪽 = 재질 가장 어두운 단)을
# 따르면 같은 잔돌이 0.18 이 된다. 「그늘 쪽을 재질 0단까지 내려도 0.15 미만」이면 접지 그림자를 진하게 하거나 재질을 바꿔야 하는 자리라
# 0.15 로 둔다(시연 석순 「외곽선 없음」 0.11 도 걸린다). 시드 예시값 0.12 는 석순 0.11 을 겨우 잡고 0.12~0.15 의 반쯤 묻힌 기물을 놓친다.
# 무림 실측: 시연 술독 A1 「외곽선 없음」 0.20 · 탁자 0.23 은 통과, inn-r1 술독 B2(황토 유약, 그늘 쪽 0.18 vs 붉은 마루 0.29) 0.10 은 경고.
# harness.py 가 기물 크기(≤2칸)·줄 바닥(seed outlineRule.contrastGround)을 고른다.
CONTRAST_MIN = 0.15
CONTRAST_CELLS = 2


def is_ink(c):
    """잠금 팔레트 색 c(RGB 튜플)가 먹인가 — ink 그 자체이거나 밝기 ≤ INK_LUMA."""
    return c == INK or float(luma(c)) <= INK_LUMA


def _rings(op, kind, tileable, open_sides):
    """(가장자리, 빛 쪽 가장자리, 그늘 쪽 가장자리) 마스크.
    object: 실루엣 바깥 1px(칸 밖은 투명으로 본다).
    지형(tile·wall·roof): 바깥 변 테두리 띠 2px — 반복 축의 변과 맞물림 변은 바깥이 아니다 — + 칸 안 투명과 맞닿은 실루엣(지붕 끝)."""
    h, w = op.shape
    if kind == 'object':
        p = np.pad(op, 1)
    else:
        p = np.pad(op, 1, constant_values=True)
    up, dn, lf, rt = p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
    edge = op & ~(up & dn & lf & rt)
    lit = op & (~up | ~lf)
    shade = op & (~dn | ~rt)
    if kind != 'object':
        sides = set(open_sides) if open_sides is not None else {'N', 'S', 'W', 'E'}
        if 'x' in tileable:
            sides -= {'W', 'E'}
        if 'y' in tileable:
            sides -= {'N', 'S'}
        band = np.zeros_like(op)
        if 'N' in sides:
            band[:2] = True
        if 'S' in sides:
            band[-2:] = True
        if 'W' in sides:
            band[:, :2] = True
        if 'E' in sides:
            band[:, -2:] = True
        edge = edge | (band & op)
    return edge, lit, shade


def check_outline(kind, a, tileable='', open_sides=None, lit_check=True):
    """OUTLINE(WARN): 가장자리 먹 비율, object 는 빛 쪽 가장자리의 먹·재질 0~1단 비율도.
    lit_check=False — 시드 outlineClass "structure"(계단·난간 같은 큰 구조): 바깥 실루엣이 재질 어두운 단이어도 되므로 먹만 본다."""
    rgb, op = a[:, :, :3], a[:, :, 3] == 255
    edge, lit, _ = _rings(op, kind, tileable, open_sides)
    n = int(edge.sum())
    if n == 0:
        return _res('OUTLINE', 'WARN', True, '바깥 변 없음(반복·맞물림 변뿐)')
    ink = sum(is_ink(tuple(int(v) for v in rgb[y, x])) for y, x in zip(*np.nonzero(edge)))
    fi = ink / n
    msg = f'가장자리 {n}화소 중 먹 {fi:.0%}(상한 {OUTLINE_INK_MAX:.0%})'
    ok = fi <= OUTLINE_INK_MAX
    if kind == 'object' and lit_check:
        lit = lit & edge
        nl = int(lit.sum())
        dark = 0
        for y, x in zip(*np.nonzero(lit)):
            c = tuple(int(v) for v in rgb[y, x])
            r = TONE_OF.get(c)
            if is_ink(c) or (r and r[1] <= LIT_DARK_STEP):
                dark += 1
        fl = dark / max(nl, 1)
        msg += f', 빛 쪽(위·왼) {nl}화소 중 먹·0~{LIT_DARK_STEP}단 {fl:.0%}(상한 {OUTLINE_LIT_MAX:.0%})'
        ok = ok and fl <= OUTLINE_LIT_MAX
    return _res('OUTLINE', 'WARN', ok, msg + ('' if ok else ' — 먹 윤곽 대신 재질 명암으로(빛 쪽 밝은 단, 그늘 쪽 어두운 단)'))


def check_contrast(im, floor_im, cells):
    """CONTRAST(WARN): 크기 ≤ CONTRAST_CELLS 칸 기물의 그늘 쪽(아래·오른) 실루엣 가장자리 평균 밝기 vs 바닥 평균 밝기.
    그늘 쪽만 보는 까닭: 규칙대로 빛 쪽을 밝은 단, 그늘 쪽을 어두운 단으로 칠하면 가장자리 전체 평균은 바닥과 비슷해져 묻힘을 못 가린다.
    묻힘이 문제 되는 곳이 바닥에 닿는 그늘 쪽이다(예외 규칙이 고치는 자리). 반환 None = 대상 아님."""
    if cells > CONTRAST_CELLS or floor_im is None:
        return None
    a = np.asarray(im.convert('RGBA'))
    op = a[:, :, 3] == 255
    if not op.any():
        return None
    _, _, shade = _rings(op, 'object', '', None)
    L = luma(a[:, :, :3])
    f = np.asarray(floor_im.convert('RGBA'))
    fo = f[:, :, 3] == 255
    fl = float(luma(f[:, :, :3])[fo].mean())
    el = float(L[shade].mean())
    d = abs(el - fl)
    ok = d >= CONTRAST_MIN
    return _res('CONTRAST', 'WARN', ok, f'그늘 쪽 가장자리 밝기 {el:.2f} vs 줄 바닥 {fl:.2f} (차 {d:.2f}, 하한 {CONTRAST_MIN:.2f})'
                + ('' if ok else ' — 바닥에 묻힌다: 그늘 쪽을 재질 가장 어두운 단으로, 접지 그림자를 진하게(먹은 쓰지 않는다)'))
