"""building-kit 기계 관문. 깨진 것만 거른다 — 통과는 합격이 아니다(시점·화풍·읽힘은 독립 검수와 사람이 본다).

부품(세트 조각)마다
  P 팔레트 잠금   불투명 화소는 palette.json 색만, 반투명은 그림자 (12,14,20,α88) 하나만            FAIL
  Z 크기          조각이 선언한 at/size 칸과 화소가 정확히 같고, 세트 그림이 시드 size 와 같다          FAIL
  Q 불투명 계약    roof: 윗줄 불투명(조각이 qTopRow:false 면 안 봄)·불투명 비율 ≥ qMin(기본 0.90)
                  slope(박공 정면·외쪽 사면 띠)·gable(앞 박공·외쪽 앞): 전부 불투명
                  roofend(뒤 끝·골): 맨 아래 행 불투명, 위 귀퉁이가 투명(^ 꼭대기), 불투명 ≥ 40%
                  wall·band·base: 발자국 안이 전부 불투명(조각이 inset 을 선언하면 그 바깥 화소만 처마 자리로 빼고 본다)
                  / extra: 위 귀퉁이 투명·채움 0.15~0.95                                                   FAIL
  F 윗면 띠       윗면이 있는 조각(roof, top 을 선언한 extra)의 선언 띠가 2행 이상·폭 50% 이상이고
                  바로 아래(앞 모서리) 줄보다 밝다. 벽에는 윗면이 없다 — 벽의 지붕 비율은 조립 A6 이 본다 FAIL
  S 반복 이음      tileable(x·y·xy) 조각의 감은 이음(마지막 열→첫 열, 마지막 행→첫 행)이 안쪽 열 경계 중 가장 큰 차 + 8(0~255 밝기) 이하    FAIL
  J 세트 이음      시드 joins 로 맞닿는 두 조각의 맞닿는 열(줄) 밝기 차가 두 조각 안쪽 경계 최대 차 + 8 이하 FAIL
  G 바닥 닿음      foot:true 조각(기단)의 불투명 맨 아래 행이 칸 아래 경계다                          FAIL
  Y 줄 재료       후보 불투명 화소의 8% 이상을 차지하는 램프가 그 줄 style-r1 조각에 쓰인 램프 ∪ extraRamps 안  FAIL
  R 색만 바꾼 후보  같은 항목 후보끼리 실루엣이 같고(IoU>0.97) 밝기 배치 상관이 0.92 초과             FAIL
WARN
  OUTLINE 먹 윤곽   외곽선 규칙(seed rules.outline, 던전·무림과 같은 정의): 가장자리 먹 비율 > 0.15,
                  또는 extra 의 빛 쪽(위·왼) 가장자리 먹·재질 0~1단 비율 > 0.50
  CONTRAST 묻힘    ≤2칸 extra 를 그 줄 대표 바닥 위에 놓았을 때 그늘 쪽(아래·오른) 가장자리 밝기 차 < 0.15
  T 가는 줄        extra 폭 1px 화소 비율 > 0.14
  L 빛 방향        extra 오른쪽 반이 왼쪽 반보다 0.06 넘게 밝다(빛은 왼쪽 위)
  N 1px 잡티       네 이웃이 모두 같은 색인데 혼자 다른 화소 비율 > 0.03
"""
import numpy as np

import dot

LUM = np.array([0.299, 0.587, 0.114])
INK_LUMA = 0.12
OUTLINE_INK_MAX = 0.15
OUTLINE_LIT_MAX = 0.5
LIT_DARK_STEP = 1
CONTRAST_MIN = 0.15
CONTRAST_CELLS = 2
SOLID_KINDS = ('roof', 'wall', 'band', 'base')


def _r(code, level, ok, msg):
    return {'code': code, 'level': level, 'ok': bool(ok), 'msg': msg}


def arr(x):
    return x.a if isinstance(x, dot.Cv) else np.array(x.convert('RGBA'))


def palette_bad(a, pal):
    allowed = {dot.hx(c) for c in pal['allowed']}
    sh_rgb, sh_a = tuple(pal['shadow']['rgb']), int(pal['shadow']['alpha'])
    op = a[a[:, :, 3] == 255][:, :3]
    bad = {tuple(int(v) for v in c) for c in np.unique(op, axis=0)} - allowed if len(op) else set()
    semi = a[(a[:, :, 3] > 0) & (a[:, :, 3] < 255)]
    bad_semi = [p for p in semi if tuple(p[:3]) != sh_rgb or p[3] != sh_a]
    return bad, len(bad_semi)


def opaque(a):
    return int((a[:, :, 3] < 255).sum())


def lum(a):
    return a[:, :, :3].astype(float) @ LUM


def seam(tile, nx=6, ny=6, axes='xy'):
    return seam_big(dot.tiled(tile, nx, ny), tile.w, tile.h, axes)


def seam_big(cv, w, h, axes='xy'):
    L = lum(cv.a)
    out = []
    if 'x' in axes:
        d = np.abs(np.diff(L, axis=1)).mean(axis=0)
        b = np.array([d[i] for i in range(len(d)) if (i + 1) % w == 0]).mean()
        inner = np.median([d[i] for i in range(len(d)) if (i + 1) % w != 0])
        out.append(('가로', b, inner, b > max(1.5 * inner, inner + 8)))
    if 'y' in axes:
        d = np.abs(np.diff(L, axis=0)).mean(axis=1)
        b = np.array([d[i] for i in range(len(d)) if (i + 1) % h == 0]).mean()
        inner = np.median([d[i] for i in range(len(d)) if (i + 1) % h != 0])
        out.append(('세로', b, inner, b > max(1.5 * inner, inner + 8)))
    return out


def _seam_res(name, tile, axes='xy'):
    res = seam(tile, axes=axes)
    bad = [f'{name} {ax} 경계 {b:.1f} > 안쪽 {i:.1f}' for ax, b, i, f in res if f]
    return bad, ', '.join(f'{name} {ax} {b:.1f}/{i:.1f}' for ax, b, i, _ in res)


def _edge_pair(A, B, axis):
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
    A, B = _edge_pair(arr(a_im), arr(b_im), axis)
    la, lb = lum(A), lum(B)
    oa, ob = A[:, :, 3] == 255, B[:, :, 3] == 255
    both = oa[:, -1] & ob[:, 0]
    if both.sum() < 4:
        return True, 0.0, 0.0
    seam_v = float(np.abs(la[both, -1] - lb[both, 0]).mean())
    lim = max(_inner_max(la, oa), _inner_max(lb, ob)) + 8.0
    return seam_v <= lim, seam_v, lim


def piece_crops(item, im):
    out = {}
    for pc in item.get('pieces', []):
        x, y = pc['at'][0] * dot.T, pc['at'][1] * dot.T
        w, h = pc['size'][0] * dot.T, pc['size'][1] * dot.T
        out[pc['id']] = (im.crop((x, y, x + w, y + h)), pc)
    return out


def item_joins(item):
    return [tuple(j) for j in item.get('joins', [])]


def open_sides(item, pid):
    sides = {'N', 'S', 'W', 'E'}
    for a, b, ax in item_joins(item):
        if a == pid:
            sides.discard('E' if ax == 'x' else 'S')
        if b == pid:
            sides.discard('W' if ax == 'x' else 'N')
    return sides


def _eave_px(pc, w):
    n = int(pc.get('inset') or 0)
    role = pc.get('role')
    if n <= 0 or role not in ('l', 'r'):
        return ()
    return tuple(range(0, min(n, w))) if role == 'l' else tuple(range(max(0, w - n), w))

def check_piece(pc, im, pal, open_sides_=None):
    a = arr(im)
    h, w = a.shape[:2]
    kind = pc.get('kind', 'wall')
    res = []
    bad, nsemi = palette_bad(a, pal)
    res.append(_r('P', 'FAIL', not bad and not nsemi,
                  f'{pc["id"]} 잠금 안' if not bad and not nsemi else
                  f'{pc["id"]} 팔레트 밖 {len(bad)}색 {sorted("#%02x%02x%02x" % c for c in bad)[:6]} · 허용 안 된 반투명 {nsemi}'))
    ew, eh = pc['size'][0] * dot.T, pc['size'][1] * dot.T
    res.append(_r('Z', 'FAIL', (w, h) == (ew, eh), f'{pc["id"]} {w}×{h} (계약 {ew}×{eh})'))

    op = a[:, :, 3] == 255
    if kind == 'roof':
        qmin = float(pc.get('qMin', 0.9))
        need_top = pc.get('qTopRow', True)
        ok = (bool(op[0].all()) or not need_top) and op.mean() >= qmin
        res.append(_r('Q', 'FAIL', ok, f'{pc["id"]} 윗줄 불투명 {bool(op[0].all())}{"" if need_top else "(안 봄)"}, 불투명 {op.mean():.0%} (하한 {qmin:.0%})'))
    elif kind in ('slope', 'gable'):
        ok = bool(op.all())
        what = '사면 띠(반복)' if kind == 'slope' else '앞 박공(삼각 벽 + 모서리 사면)'
        res.append(_r('Q', 'FAIL', ok, f'{pc["id"]} {what} ' + ('전부 불투명' if ok else f'투명·반투명 화소 {int((~op).sum())}')))
    elif kind == 'roofend':
        corners = [op[0, 0], op[0, w - 1]]
        ok = bool(op[-1].all()) and not all(corners) and op.mean() >= 0.4
        res.append(_r('Q', 'FAIL', ok, f'{pc["id"]} 뒤 끝 — 맨 아래 행 불투명 {bool(op[-1].all())}, '
                      f'위 귀퉁이 투명 {not all(corners)}(꼭대기 ^ 모양), 불투명 {op.mean():.0%}(하한 40%)'))
    elif kind in ('wall', 'band', 'base'):
        eave = _eave_px(pc, w)
        body = [i for i in range(w) if i not in eave]
        ok = bool(op[:, body].all())
        msg = '전부 불투명' if not eave else f'안쪽 불투명, 바깥 {len(eave)}px 은 처마 자리(선언 inset)'
        res.append(_r('Q', 'FAIL', ok, f'{pc["id"]} ' + (msg if ok else f'투명·반투명 화소 {int((~op).sum())} — 처마 자리 밖')))
    else:
        corners = [a[0, 0, 3], a[0, w - 1, 3]]
        fill = op.mean()
        ok = all(c != 255 for c in corners) and 0.15 <= fill <= 0.95
        res.append(_r('Q', 'FAIL', ok, f'{pc["id"]} 위 귀퉁이 투명 {all(c != 255 for c in corners)}, 채움 {fill:.0%}'))

    top = pc.get('top')
    if top or (kind == 'roof' and not pc.get('spire')):
        y0, y1 = top if top else (0, h // dot.T - 1)
        y0, y1 = y0 * dot.T, y1 * dot.T
        rows = list(range(y0, y1))
        ys = np.nonzero(op.any(axis=1))[0]
        xs = np.nonzero(op.any(axis=0))[0]
        bw = (xs.max() - xs.min() + 1) if len(xs) else 1
        cover = float(np.mean([op[y].sum() / bw for y in rows])) if rows else 0.0
        band = op[y0:y1]
        L = lum(a)
        top_mean = float(L[y0:y1][band].mean()) if band.any() else 0.0
        edge_rows = [y for y in (y1 - 1, y1, y1 + 1) if 0 <= y < h and op[y].any()]
        edge_mean = min(float(L[y][op[y]].mean()) for y in edge_rows) if edge_rows else 255.0
        ok = len(rows) >= 2 and cover >= 0.5 and top_mean - edge_mean >= 12
        res.append(_r('F', 'FAIL', ok, f'{pc["id"]} 윗면 {y0 // dot.T}~{y1 // dot.T - 1}행({len(rows)}행) 폭 {cover:.0%}, 밝기 {top_mean:.0f} vs 앞 모서리 {edge_mean:.0f}'))

    if pc.get('foot'):
        ys = np.nonzero(op.any(axis=1))[0]
        bot = int(ys.max()) if len(ys) else -1
        res.append(_r('G', 'FAIL', bot == h - 1, f'{pc["id"]} 불명확 맨 아래 행 {bot} (칸 아래 경계 {h - 1})' if bot != h - 1
                      else f'{pc["id"]} 바닥에 닿음'))

    axes = ''.join(ax for ax in 'xy' if ax in (pc.get('tileable') or ''))
    if axes:
        b, i = _seam_res(pc['id'], dot.Cv.of(im), axes)
        res.append(_r('S', 'FAIL', not b, ('이음 없음 — ' if not b else '; '.join(b) + ' — ') + i))

    L = lum(a)
    if kind == 'extra':
        pad = np.pad(op, 1)
        lf, rt, up, dn = pad[1:-1, :-2], pad[1:-1, 2:], pad[:-2, 1:-1], pad[2:, 1:-1]
        thin = op & (~(lf | rt) | ~(up | dn))
        tr = thin.sum() / max(op.sum(), 1)
        res.append(_r('T', 'WARN', tr <= 0.14, f'{pc["id"]} 폭 1px 화소 {tr:.0%}'))
        xs = np.nonzero(op.any(axis=0))[0]
        mid = (xs.min() + xs.max() + 1) / 2
        X = np.arange(w)[None, :].repeat(h, 0)
        lm, rm = op & (X < mid), op & (X >= mid)
        d = float(L[rm].mean() - L[lm].mean()) if lm.any() and rm.any() else 0.0
        res.append(_r('L', 'WARN', d <= 0.06 * 255, f'{pc["id"]} 오른쪽−왼쪽 밝기 {d:+.0f}'))

    key = a[:, :, 0].astype(np.int32) * 65536 + a[:, :, 1].astype(np.int32) * 256 + a[:, :, 2]
    key = np.where(op, key, -1)
    if h > 2 and w > 2:
        c = key[1:-1, 1:-1]
        u, d_, l_, r_ = key[:-2, 1:-1], key[2:, 1:-1], key[1:-1, :-2], key[1:-1, 2:]
        lone = (c >= 0) & (u == d_) & (u == l_) & (u == r_) & (u >= 0) & (c != u)
        nr = lone.sum() / max(op.sum(), 1)
        res.append(_r('N', 'WARN', nr <= 0.03, f'{pc["id"]} 혼자 다른 1px {int(lone.sum())}개 ({nr:.1%})'))

    res.append(check_outline(kind, a, pc.get('tileable') or '', open_sides_, pal, lit_check=kind == 'extra'))
    return res


def _merge(per):
    out, order, by = [], [], {}
    for pid, r in per:
        if r['code'] not in by:
            order.append(r['code'])
            by[r['code']] = []
        by[r['code']].append((pid, r))
    for code in order:
        rs = by[code]
        bad = [(pid, r) for pid, r in rs if not r['ok']]
        msg = '; '.join(f'{r["msg"]}' for _, r in bad) if bad else f'조각 {len(rs)}개 통과'
        out.append(_r(code, rs[0][1]['level'], not bad, msg))
    return out


def check_item(item, im, pal, meta=None):
    """세트 항목 하나(부품 묶음)의 관문 — R 은 판 단위(check_recolor), Y 는 harness 가 check_line_material 로."""
    crops = piece_crops(item, im)
    per = [('세트', _r('Z', 'FAIL', im.size == (item['size'][0] * dot.T, item['size'][1] * dot.T),
                       f'세트 {im.width}×{im.height} (계약 {item["size"][0] * dot.T}×{item["size"][1] * dot.T})'))]
    for pid, (cim, pc) in crops.items():
        per += [(pid, r) for r in check_piece(pc, cim, pal, open_sides(item, pid))]
    res = _merge(per)
    bad = []
    for a, b, ax in item_joins(item):
        if a not in crops or b not in crops:
            bad.append(f'{a}→{b}: 조각이 없다')
            continue
        ok, s, lim = check_join(crops[a][0], crops[b][0], ax)
        if not ok:
            bad.append(f'{a}→{b}({ax}) {s:.1f}>{lim:.1f}')
    res.append(_r('J', 'FAIL', not bad, '세트 이음 어긋남 ' + ', '.join(bad) if bad else f'세트 이음 {len(item_joins(item))}쌍 통과'))
    return res


def check_recolor(cands):
    letters = sorted(cands)
    hits = {L: [] for L in letters}
    arrays = {L: arr(cands[L]) for L in letters}
    for i, a in enumerate(letters):
        for b in letters[i + 1:]:
            A, B = arrays[a], arrays[b]
            if A.shape != B.shape:
                continue
            ma, mb = A[:, :, 3] == 255, B[:, :, 3] == 255
            iou = (ma & mb).sum() / max((ma | mb).sum(), 1)
            both = ma & mb
            if both.sum() < 16:
                continue
            la, lb = lum(A)[both], lum(B)[both]
            corr = float(np.corrcoef(la, lb)[0, 1]) if la.std() > 1e-6 and lb.std() > 1e-6 else 1.0
            if iou > 0.97 and corr > 0.92:
                hits[a].append(f'{b}(상관 {corr:.2f})')
                hits[b].append(f'{a}(상관 {corr:.2f})')
    return {L: _r('R', 'FAIL', not hits[L], f'{",".join(hits[L])} 와 구조가 같다(색만 바꿈)' if hits[L] else '다른 후보와 구조가 다르다')
            for L in letters}


def ramp_shares(im, pal):
    tone_of = {}
    for name, ramp in pal['ramps'].items():
        for i, c in enumerate(ramp):
            tone_of.setdefault(dot.hx(c), (name, i))
    a = arr(im)
    op = a[:, :, 3] == 255
    n = int(op.sum())
    cnt = {}
    for y, x in zip(*np.nonzero(op)):
        r = tone_of.get(tuple(int(v) for v in a[y, x, :3]))
        k = r[0] if r else '?'
        cnt[k] = cnt.get(k, 0) + 1
    return {k: v / max(n, 1) for k, v in cnt.items()}


def check_line_material(im, ref_ims, extra=(), pal=None, share=0.08, ref_share=0.01):
    allowed = set(extra)
    for r in ref_ims:
        allowed |= {k for k, v in ramp_shares(r, pal).items() if v >= ref_share}
    main = {k: v for k, v in ramp_shares(im, pal).items() if v >= share}
    off = sorted(k for k in main if k not in allowed)
    msg = (f'줄 재료 밖 램프 {", ".join(f"{k} {main[k]:.0%}" for k in off)} (허용 {",".join(sorted(allowed))})' if off
           else f'주 재료 {",".join(sorted(main))} ⊆ 줄 재료')
    return _r('Y', 'FAIL', not off, msg)


def tone_of(pal):
    out = {}
    for name, ramp in pal['ramps'].items():
        for i, c in enumerate(ramp):
            out.setdefault(dot.hx(c), (name, i))
    return out


def dominant_ramp(a, pal, share=0.2):
    op = a[:, :, 3] == 255
    if not op.any():
        return None
    tones = tone_of(pal)
    cnt = {}
    for y, x in zip(*np.nonzero(op)):
        r = tones.get(tuple(int(v) for v in a[y, x, :3]))
        if r:
            cnt[r[0]] = cnt.get(r[0], 0) + 1
    if not cnt:
        return None
    name = max(cnt, key=cnt.get)
    return name if cnt[name] / int(op.sum()) >= share else None


def is_ink(c, tones, own=None):
    """먹 = 밝기 ≤ INK_LUMA 이면서 그 조각의 주 재질(20% 이상) 램프가 아닌 색.
    재질 자신의 가장 어두운 단은 명암이지 먹이 아니다(외곽선 규칙)."""
    r = tones.get(c)
    if r and own and r[0] == own:
        return False
    return float(np.dot(c, LUM)) / 255.0 <= INK_LUMA


def _rings(op, kind, tileable, open_sides_):
    h, w = op.shape
    p = np.pad(op, 1) if kind == 'extra' else np.pad(op, 1, constant_values=True)
    up, dn, lf, rt = p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
    edge = op & ~(up & dn & lf & rt)
    lit = op & (~up | ~lf)
    shade = op & (~dn | ~rt)
    if kind != 'extra':
        sides = set(open_sides_) if open_sides_ is not None else {'N', 'S', 'W', 'E'}
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


def check_outline(kind, a, tileable, open_sides_, pal, lit_check=True):
    rgb, op = a[:, :, :3], a[:, :, 3] == 255
    edge, lit, _ = _rings(op, kind, tileable, open_sides_)
    n = int(edge.sum())
    if n == 0:
        return _r('OUTLINE', 'WARN', True, '바깥 변 없음(반복·맞물림 변뿐)')
    tones = tone_of(pal)
    own = dominant_ramp(a, pal)
    ink = sum(is_ink(tuple(int(v) for v in rgb[y, x]), tones, own) for y, x in zip(*np.nonzero(edge)))
    fi = ink / n
    ok = fi <= OUTLINE_INK_MAX
    msg = f'가장자리 {n}화소 중 먹 {fi:.0%}(상한 {OUTLINE_INK_MAX:.0%})'
    if kind == 'extra' and lit_check:
        lit = lit & edge
        nl = int(lit.sum())
        dark = 0
        for y, x in zip(*np.nonzero(lit)):
            c = tuple(int(v) for v in rgb[y, x])
            r = tones.get(c)
            if is_ink(c, tones, own) or (r and r[1] <= LIT_DARK_STEP):
                dark += 1
        fl = dark / max(nl, 1)
        msg += f', 빛 쪽(위·왼) {nl}화소 중 먹·0~{LIT_DARK_STEP}단 {fl:.0%}(상한 {OUTLINE_LIT_MAX:.0%})'
        ok = ok and fl <= OUTLINE_LIT_MAX
    return _r('OUTLINE', 'WARN', ok, msg + ('' if ok else ' — 먹 윤곽 대신 재질 명암으로(빛 쪽 밝은 단, 그늘 쪽 어두운 단)'))


def check_contrast(im, floor_im, cells):
    if cells > CONTRAST_CELLS or floor_im is None:
        return None
    a = arr(im)
    op = a[:, :, 3] == 255
    if not op.any():
        return None
    _, _, shade = _rings(op, 'extra', '', None)
    L = lum(a)
    f = arr(floor_im)
    fo = f[:, :, 3] == 255
    fl = float(lum(f)[fo].mean())
    el = float(L[shade].mean())
    d = abs(el - fl)
    ok = d >= CONTRAST_MIN * 255
    return _r('CONTRAST', 'WARN', ok, f'그늘 쪽 가장자리 밝기 {el:.0f} vs 줄 바닥 {fl:.0f} (차 {d:.0f}, 하한 {CONTRAST_MIN * 255:.0f})'
                + ('' if ok else ' — 바닥에 묻힌다: 그늘 쪽을 재질 가장 어두운 단으로, 접지 그림자를 진하게(먹은 쓰지 않는다)'))
