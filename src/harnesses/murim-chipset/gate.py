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
  T 가는 줄         object 폭 1px 화소 비율 > 0.14                                            WARN
  L 빛 방향         object 오른쪽 반이 왼쪽 반보다 밝음(> 0.06)                                 WARN
  N 1px 잡티        네 이웃이 모두 같은 색인데 혼자 다른 화소 비율 > 0.03                         WARN
"""
import numpy as np

from tk import ALLOWED, INK, PAL, RAMPS, SHADOW, SHADOW_A, T, luma

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
        ok = bool(op[0].all()) and op.mean() >= 0.9
        out.append(_res('Q', 'FAIL', ok, f'윗줄 불투명 {bool(op[0].all())}, 불투명 {op.mean():.0%}'))
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
