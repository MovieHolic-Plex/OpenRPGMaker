"""던전 칩셋 기계 관문. 깨진 것만 거른다 — 통과는 합격이 아니다(시점·화풍·읽힘은 사람이 시트에서 본다).

FAIL
  P 팔레트 잠금   불투명 화소는 palette.json 색만, 반투명은 그림자 (12,14,20,α88) 하나만
  Z 크기         16 배수, 항목 계약 크기
  Q 불투명       아래층 그림(오토타일 47 변형·앞면 조합·계단·문)은 전부 불투명
  O 윤곽         윗층 기물 가장자리 화소의 70% 이상이 어두움(불꽃 화소 제외)
  F 윗면         기물: 선언한 윗면 줄이 앞면보다 밝다 / 동굴: 모든 앞면 윗단 위 칸 아래 2줄에 테두리(어둠 아님)
                 / 물: 북쪽 물가 띠가 몸통과 다르다(물로 떨어지는 앞면)
  S 이음         몸통 6×6 반복·앞면 가운데 가로 반복·가장자리 띠 반복에서 칸 경계 차이가 칸 안 차이(중앙값)의 1.5배·+8 을 넘지 않는다
  G 구조         동굴 격자: 앞면 위에 천장이 있다(dot.structure_errors)
WARN
  R 색만 바꾼 후보  같은 항목 후보끼리 밝기 윤곽선이 90% 넘게 겹침
"""
import numpy as np

import dot

LUM = np.array([0.299, 0.587, 0.114])
FIRE = {dot.C('fire', i) for i in range(len(dot.RAMPS['fire']))} | {dot.C('lava', i) for i in range(len(dot.RAMPS['lava']))}
VOID = {dot.C('void', i) for i in range(len(dot.RAMPS['void']))}
DARK_LUM = 75


def _r(code, level, ok, msg):
    return {'code': code, 'level': level, 'ok': bool(ok), 'msg': msg}


def arr(x):
    return x.a if isinstance(x, dot.Cv) else np.array(x.convert('RGBA'))


def palette_bad(a):
    op = a[a[:, :, 3] == 255][:, :3]
    bad = {tuple(int(v) for v in c) for c in np.unique(op, axis=0)} - dot.ALLOWED if len(op) else set()
    semi = a[(a[:, :, 3] > 0) & (a[:, :, 3] < 255)]
    bad_semi = [p for p in semi if tuple(p[:3]) != dot.SHADOW or p[3] != dot.SHADOW_A]
    return bad, len(bad_semi)


def opaque(a):
    return int((a[:, :, 3] < 255).sum())


def lum(a):
    return a[:, :, :3].astype(float) @ LUM


def seam(tile, nx=6, ny=6, axes='xy'):
    """칸 반복에서 경계 차이 / 칸 안 차이. 반환 [(축, 경계, 안쪽 중앙값, 튐?)]"""
    big = dot.tiled(tile, nx, ny).a
    L = lum(big)
    out = []
    w, h = tile.w, tile.h
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


def autotile_checks(name, at):
    """47 변형 불투명·팔레트, 몸통·가장자리 띠 이음."""
    vs = at.variants()
    holes = sum(opaque(v.a) for v in vs.values())
    bad = set()
    for v in vs.values():
        bad |= palette_bad(v.a)[0]
    seams, info = [], []
    for nm, tile, axes in ((f'{name} 몸통', at.body, 'xy'),
                           (f'{name} 북변', at.tile(dot.E | dot.W | dot.S | dot.SE | dot.SW), 'x'),
                           (f'{name} 남변', at.tile(dot.E | dot.W | dot.N | dot.NE | dot.NW), 'x'),
                           (f'{name} 서변', at.tile(dot.N | dot.S | dot.E | dot.NE | dot.SE), 'y'),
                           (f'{name} 동변', at.tile(dot.N | dot.S | dot.W | dot.NW | dot.SW), 'y')):
        b, i = _seam_res(nm, tile, axes)
        seams += b
        info.append(i)
    return len(vs), holes, bad, seams, info


def face_checks(name, face):
    combos = [face.tile(lv, lo, ro) for lv in (0, 1) for lo in (False, True) for ro in (False, True)]
    holes = sum(opaque(c.a) for c in combos)
    mid = dot.Cv(16, 32)
    mid.a[:16] = face.tile(0, False, False).a
    mid.a[16:] = face.tile(1, False, False).a
    b, i = _seam_res(f'{name} 가운데', mid, 'x')
    return holes, b, i


def outline_ratio(a):
    m = a[:, :, 3] == 255
    if not m.any():
        return 1.0, 0
    pad = np.pad(m, 1)
    edge = m & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    ys, xs = np.nonzero(edge)
    cnt = dark = 0
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in FIRE:
            continue
        cnt += 1
        if float(np.dot(a[y, x, :3], LUM)) < DARK_LUM:
            dark += 1
    return (dark / cnt if cnt else 1.0), cnt


def check_one(item, im, meta):
    a = arr(im)
    res = []
    bad, nsemi = palette_bad(a)
    res.append(_r('P', 'FAIL', not bad and not nsemi,
                  '팔레트 밖 색 없음' if not bad and not nsemi else
                  f'팔레트 밖 {len(bad)}색 {sorted("#%02x%02x%02x" % c for c in bad)[:6]} · 허용 안 된 반투명 {nsemi}'))
    h, w = a.shape[:2]
    sw, sh = item['size']
    kind = meta.get('kind')
    zok = w % 16 == 0 and h % 16 == 0
    if kind in ('tile', 'face-insert'):
        zok = zok and w <= sw * 16 and h <= sh * 16
    res.append(_r('Z', 'FAIL', zok, f'{w}×{h}' + ('' if zok else f' — 16 배수·시드 {sw}×{sh}칸 이내여야')))

    if kind in ('cave-set', 'autotile', 'face'):
        holes, pbad, seams, info, nvar = 0, set(), [], [], 0
        for name, at in meta.get('autotiles', {}).items():
            n, hl, b, s, i = autotile_checks(name, at)
            nvar += n
            holes += hl
            pbad |= b
            seams += s
            info += i
        for name, f in meta.get('faces', {}).items():
            hl, s, i = face_checks(name, f)
            holes += hl
            seams += s
            info.append(i)
        res.append(_r('Q', 'FAIL', holes == 0 and not pbad,
                      f'오토타일 변형 {nvar}개·앞면 조합 불투명' if holes == 0 and not pbad
                      else f'투명 화소 {holes} · 팔레트 밖 {len(pbad)}'))
        res.append(_r('S', 'FAIL', not seams, ('이음 없음 — ' if not seams else '; '.join(seams) + ' — ') + ' · '.join(info)))
    elif kind in ('tile', 'face-insert'):
        res.append(_r('Q', 'FAIL', opaque(a) == 0, '전부 불투명' if opaque(a) == 0 else f'투명 화소 {opaque(a)}'))

    if kind == 'cave-set' or meta.get('rim_check'):
        errs = dot.structure_errors(meta['grid'])
        res.append(_r('G', 'FAIL', not errs, '앞면 위 천장 있음' if not errs else '; '.join(errs[:4])))
        k = dot.classify(meta['grid'])
        V = meta['vignette'].a
        miss = []
        for y, row in enumerate(k):
            for x, kk in enumerate(row):
                if kk == 'hi' and y > 0:
                    strip = V[y * 16 - 2:y * 16, x * 16:x * 16 + 16]
                    voidish = sum(tuple(int(v) for v in p[:3]) in VOID for p in strip.reshape(-1, 4))
                    if voidish > strip.shape[0] * strip.shape[1] * 0.5:
                        miss.append(f'({x},{y})')
        res.append(_r('F', 'FAIL', not miss, '모든 앞면 위에 벽 윗면 테두리' if not miss else '윗면 없는 앞면 ' + ' '.join(miss)))
    if kind == 'autotile' and 'water' in meta.get('autotiles', {}):
        at = meta['autotiles']['water']
        n_edge = at.tile(dot.E | dot.W | dot.S | dot.SE | dot.SW).a[:4]
        body = at.body.a[:4]
        diff = float(np.abs(lum(n_edge) - lum(body)).mean())
        res.append(_r('F', 'FAIL', diff > 15, f'북쪽 물가 띠와 몸통 차이 {diff:.0f}(>15 이어야 앞면이 보임)'))
    if kind in ('objects', 'object'):
        for name, part in meta['parts'].items():
            pa = arr(part)
            ratio, n = outline_ratio(pa)
            res.append(_r('O', 'FAIL', ratio >= 0.7, f'{name} 가장자리 어두움 {ratio:.0%} ({n}화소, 불꽃 제외)'))
        for name, (t0, t1) in meta.get('top_rows', {}).items():
            pa = arr(meta['parts'][name])
            m = pa[:, :, 3] == 255
            L = lum(pa)
            top = L[t0:t1 + 1][m[t0:t1 + 1]]
            front = L[t1 + 1:][m[t1 + 1:]]
            ok = len(top) > 0 and len(front) > 0 and top.mean() > front.mean() and (t1 - t0 + 1) >= 3
            res.append(_r('F', 'FAIL', ok, f'{name} 윗면 {t1 - t0 + 1}줄 밝기 {top.mean():.0f} vs 앞면 {front.mean():.0f}'))
    return res


def check_recolor(cands):
    """{글자: PIL} → {글자: 결과}. 같은 크기끼리 밝기 윤곽선 겹침."""
    def edges(im):
        L = lum(np.array(im.convert('RGBA')))
        e = (np.abs(np.diff(L, axis=0))[:, :-1] > 18) | (np.abs(np.diff(L, axis=1))[:-1, :] > 18)
        return e
    out = {}
    E = {k: edges(v) for k, v in cands.items()}
    for k in cands:
        worst = 0.0
        for j in cands:
            if j == k or E[j].shape != E[k].shape:
                continue
            inter = (E[k] & E[j]).sum()
            uni = (E[k] | E[j]).sum() or 1
            worst = max(worst, inter / uni)
        out[k] = _r('R', 'WARN', worst <= 0.9, f'다른 후보와 윤곽 겹침 최대 {worst:.0%}')
    return out
