"""던전 칩셋 기계 관문. 깨진 것만 거른다 — 통과는 합격이 아니다(시점·화풍·읽힘은 사람이 시트에서 본다).

FAIL
  P 팔레트 잠금   불투명 화소는 palette.json 색만, 반투명은 그림자 (12,14,20,α88) 하나만
  Z 크기         16 배수, 항목 계약 크기
  Q 불투명       아래층 그림(오토타일 47 변형·앞면 조합·계단·문)은 전부 불투명 — 종류 cave-set·autotile·face
  F 윗면         기물: 선언한 윗면 줄이 앞면보다 밝다 / 동굴: 모든 앞면 윗단 위 칸 아래 2줄에 테두리(어둠 아님)
                 / 물: 북쪽 물가 띠가 몸통과 다르다(물로 떨어지는 앞면)
  S 이음         몸통 6×6 반복·앞면 가운데 가로 반복·가장자리 띠 반복에서 칸 경계 차이가 칸 안 차이(중앙값)의 1.5배·+8 을 넘지 않는다
  G 구조         동굴 격자: 앞면 위에 천장이 있다(dot.structure_errors). cave-set 과 meta['rim_check'] 가 켜진 천장·앞면 후보(F 동굴 검사도 같이)
  A 장면         물·용암(meta['frames']): 4장면, 47 변형마다 장면끼리 바뀌는 화소는 물·용암 램프(meta['liquid'])뿐(물가 화소 동일),
                 이웃 장면끼리 몸통이 다르다(멈춘 그림 아님). 장면마다 Q·S 도 본다
  K 상태         얼음 깨짐(meta['states']): 47 변형마다 칸 둘레 2px 가 상태끼리 같다(깨진 칸이 이웃과 이어진다), 상태끼리 몸통이 다르다
  J 키트 이음     다리(종류 kit, meta['kit']): 가로 조각 서끝|가운데|가운데|동끝 이 맞닿는 열, 세로 조각 북끝|가운데|가운데|남끝 이
                 맞닿는 행의 투명 모양이 같다 + 가운데 조각 반복 이음(S)
WARN
  R 색만 바꾼 후보  같은 항목 후보끼리 밝기 윤곽선이 90% 넘게 겹침
  OUTLINE 먹 윤곽   외곽선 규칙(사용자 2026-10-08, seed rules.outline): 가장자리 화소 중 먹(밝기 ≤ INK_LUMA) 비율 > OUTLINE_INK_MAX,
                   또는 기물의 빛 쪽(위·왼) 가장자리 중 먹·재질 0단 비율 > OUTLINE_LIT_MAX(빙 두른 어두운 윤곽).
                   기물(objects·object 의 parts) = 실루엣 바깥 1px · 다리 키트 = 칸 안 투명과 맞닿은 실루엣(큰 구조라 먹만) ·
                   지형 오토타일 = 한 변만 끊긴 변형 넷에서 몸통과 달라진 가장자리 띠(몸통이 어둠인 천장·낭떠러지는 재지 않는다) ·
                   앞면 = 끝 마구리(가운데 조각과 달라진 화소)·아랫단 밑 2줄
  CONTRAST 묻힘    크기 ≤2칸 기물 part 를 그 줄 대표 바닥(style-r1 그 글자 동굴 바닥 몸통) 위에 놓았을 때 그늘 쪽(아래·오른)
                   실루엣 가장자리 평균 밝기와 바닥 평균 밝기 차 < CONTRAST_MIN (harness.py 가 줄 바닥을 준다)
  ※ 옛 O(기물 가장자리 70% 이상 어두움, FAIL)는 외곽선 규칙과 반대라 지웠다(2026-10-08).
"""
import numpy as np

import dot

LUM = np.array([0.299, 0.587, 0.114])
FIRE = {dot.C('fire', i) for i in range(len(dot.RAMPS['fire']))} | {dot.C('lava', i) for i in range(len(dot.RAMPS['lava']))}
VOID = {dot.C('void', i) for i in range(len(dot.RAMPS['void']))}


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
    return seam_big(dot.tiled(tile, nx, ny), tile.w, tile.h, axes)


def seam_big(cv, w, h, axes='xy'):
    """이미 깐 그림 cv 에서 w×h 칸 경계 차이 / 칸 안 차이."""
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


def autotile_checks(name, at):
    """47 변형 불투명·팔레트, 몸통·가장자리 띠 이음."""
    vs = at.variants()
    holes = sum(opaque(v.a) for v in vs.values())
    bad = set()
    for v in list(vs.values()) + at.bodies:
        bad |= palette_bad(v.a)[0]
    holes += sum(opaque(b.a) for b in at.bodies[1:])
    seams, info = [], []
    if len(at.bodies) > 1:   # 몸통 변형: 엔진과 같은 해시로 8×8 섞어 깔고 경계를 본다
        res = seam_big(dot.mosaic(at, 8, 8), 16, 16)
        seams += [f'{name} 몸통 변형 섞음 {ax} 경계 {b:.1f} > 안쪽 {i:.1f}' for ax, b, i, f in res if f]
        info.append(', '.join(f'{name} 변형 섞음 {ax} {b:.1f}/{i:.1f}' for ax, b, i, _ in res))
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
        more = [(f'{nm} {lab}{i}', at) for key, lab in (('frames', '장면'), ('states', '상태'))
                for nm, ats in meta.get(key, {}).items() for i, at in enumerate(ats) if i]
        for name, at in list(meta.get('autotiles', {}).items()) + more:
            n, hl, b, s, i = autotile_checks(name, at)
            nvar += n
            holes += hl
            pbad |= b
            seams += s
            info += i
        for name, t in meta.get('tiles', {}).items():   # 16칸 주기 아래층 조각(낭떠러지 먼 벽 단 등): 불투명·팔레트·가로 반복
            holes += opaque(t.a)
            pbad |= palette_bad(t.a)[0]
            b, i = _seam_res(name, t, 'x')
            seams += b
            info.append(i)
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
    for bank in ('water', 'lava', 'chasm'):
        if kind == 'autotile' and bank in meta.get('autotiles', {}):
            at = meta['autotiles'][bank]
            n_edge = at.tile(dot.E | dot.W | dot.S | dot.SE | dot.SW).a[:4]
            body = at.body.a[:4]
            diff = float(np.abs(lum(n_edge) - lum(body)).mean())
            res.append(_r('F', 'FAIL', diff > 15, f'{bank} 북쪽 가장자리 띠와 몸통 차이 {diff:.0f}(>15 이어야 앞면이 보임)'))
    for name, ats in meta.get('frames', {}).items():
        res.append(frames_check(name, ats, meta.get('liquid', [])))
    for name, ats in meta.get('states', {}).items():
        res.append(states_check(name, ats))
    if kind == 'kit':
        res += kit_checks(meta['kit'])
    ol = check_outline(kind, meta)
    if ol:
        res.append(ol)
    if kind in ('objects', 'object'):
        for name, (t0, t1) in meta.get('top_rows', {}).items():
            pa = arr(meta['parts'][name])
            m = pa[:, :, 3] == 255
            L = lum(pa)
            top = L[t0:t1 + 1][m[t0:t1 + 1]]
            front = L[t1 + 1:][m[t1 + 1:]]
            ok = len(top) > 0 and len(front) > 0 and top.mean() > front.mean() and (t1 - t0 + 1) >= 3
            res.append(_r('F', 'FAIL', ok, f'{name} 윗면 {t1 - t0 + 1}줄 밝기 {top.mean():.0f} vs 앞면 {front.mean():.0f}'))
    return res


def _masks():
    return sorted({dot.canon(m) for m in range(256)})


def frames_check(name, ats, liquid, want=4):
    """장면 오토타일 목록 → A 결과. 장면끼리 바뀌는 화소가 liquid 램프 색만인지(47 변형 모두), 이웃 장면 몸통이 다른지."""
    allowed = {dot.C(r, i) for r in liquid for i in range(len(dot.RAMPS[r]))}
    bad, n = [], len(ats)
    for m in _masks():
        ts = [a.tile(m).a for a in ats]
        diff = np.zeros(ts[0].shape[:2], bool)
        for t in ts[1:]:
            diff |= (t != ts[0]).any(axis=2)
        for t in ts:
            cols = {tuple(int(v) for v in p[:3]) for p in t[diff]}
            if cols - allowed:
                bad.append(m)
                break
    still = [i for i in range(n) if (ats[i].body.a == ats[(i + 1) % n].body.a).all()]
    ok = n == want and not bad and not still
    return _r('A', 'FAIL', ok, f'{name} 장면 {n}(={want}) · 물가 화소 동일 {47 - len(bad)}/47 변형'
              + (f' · 멈춘 장면 {still}' if still else ' · 장면마다 몸통이 움직임'))


def states_check(name, ats):
    """상태 오토타일 목록 → K 결과. 47 변형마다 칸 둘레 2px 가 상태끼리 같은지, 상태끼리 몸통이 다른지."""
    ring = np.ones((16, 16), bool)
    ring[2:14, 2:14] = False
    bad = []
    for m in _masks():
        ts = [a.tile(m).a for a in ats]
        if any((t[ring] != ts[0][ring]).any() for t in ts[1:]):
            bad.append(m)
    same = [i for i in range(1, len(ats)) if (ats[i].body.a == ats[i - 1].body.a).all()]
    ok = not bad and not same
    return _r('K', 'FAIL', ok, f'{name} 상태 {len(ats)} · 둘레 2px 동일 {47 - len(bad)}/47 변형'
              + (f' · 같은 상태 {same}' if same else ''))


def kit_checks(kit):
    """다리 키트 이음(J)과 가운데 조각 반복(S)."""
    def alpha(c):
        return c.a[:, :, 3] > 0
    bad = []
    hw, hm, he = kit['h']
    for a, b, nm in ((hw, hm, '서끝|가운데'), (hm, hm, '가운데|가운데'), (hm, he, '가운데|동끝')):
        if (alpha(a)[:, 15] != alpha(b)[:, 0]).any():
            bad.append(nm)
    vn, vm, vs = kit['v']
    for a, b, nm in ((vn, vm, '북끝|가운데'), (vm, vm, '가운데|가운데'), (vm, vs, '가운데|남끝')):
        if (alpha(a)[15] != alpha(b)[0]).any():
            bad.append(nm)
    out = [_r('J', 'FAIL', not bad, '가로·세로 조각 맞닿는 줄 모양 같음' if not bad else '어긋남 ' + ', '.join(bad))]
    hb, hi = _seam_res('가로 가운데', hm, 'x')
    vb, vi = _seam_res('세로 가운데', vm, 'y')
    out.append(_r('S', 'FAIL', not hb and not vb, ('이음 없음 — ' if not hb and not vb else '; '.join(hb + vb) + ' — ') + hi + ' · ' + vi))
    return out


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


# ------------------------------------------------------------------------------------------------ 외곽선 규칙 (WARN)
# 사용자 결정 2026-10-08 — 시연 http://mdc-server:18301/outline-before-after.html 을 보고
#   「1 3 4 5 7 8 은 외곽선이 없는 게 나은데」 → 「그래 그렇게하고」.
#   지형(바닥·벽면·천장·물·용암)과 기물 모두 먹 윤곽 없이 재질 자신의 명암으로(빛 받는 위·왼 = 밝은 단, 그늘 아래·오른 = 어두운 단).
#   바닥과 밝기가 비슷한 작은 기물(1~2칸: 석순·잔돌·상자)만 그늘 쪽을 그 재질의 가장 어두운 단 + 진한 접지 그림자. 먹은 쓰지 않는다.
#   큰 구조(벽 덩어리·절벽·다리)도 바깥 실루엣은 재질 어두운 단, 먹이 아니다.
#
# 먹 = 밝기 ≤ INK_LUMA. 던전 팔레트에는 따로 된 ink 가 없다 — 시연은 「먹」으로 void 0(#0e0a14)을 썼다. 근거(palette.json,
#   luma = 0.299R + 0.587G + 0.114B): void 0.048·0.073·0.085, brick 0단 0.087, crock 0단 0.097, vrock 0단 0.104 —
#   시연 돌바닥 C1 이 vrock 0단 띠를 「먹과 거의 같은 밝기 0.10」이라 규칙 위반으로 짚었다. 그다음 어두운 색은 pool 0단 0.138 ·
#   iron 0단 0.142 · wood 0단 0.143 으로 0.104 와 0.138 사이에 틈이 있어 0.12 로 자른다.
INK_LUMA = 0.12
# 가장자리 먹 비율 상한. 시연 after(그늘 쪽만 먹) 석순·잔돌은 46~52%, before·「외곽선 없음」은 0%(재질 0단 윤곽은 먹이 아니다).
# 접지 그림자 쪽 한두 화소·일부러 찍은 어두운 틈은 남을 수 있어 0.15 까지 둔다.
OUTLINE_INK_MAX = 0.15
# 빛 쪽(위·왼) 가장자리가 먹·재질 0단(palette.py: 단 0 = 그 재료의 윤곽색)으로 빙 둘러졌는지. 규칙: 빛 쪽은 재질 밝은 단.
# 시연 before 잔돌(stone 0 윤곽)·석순(rim 0 윤곽)은 빛 쪽 100%, after(그늘 쪽만 먹) 24~28%, 「외곽선 없음」 0~20%. 반 넘게 어두우면 경고.
OUTLINE_LIT_MAX = 0.5
# 묻힘 기준. 시연 잔돌 B1: stone 0단 윤곽(0.21)과 B 줄 흙바닥(0.38) 차 0.17 은 바닥 반점(cfloor 0, 0.24)에 묻혔다고 했고,
# 같은 잔돌 「외곽선 없음」 안은 그늘 쪽 0.38 vs 바닥 0.38 (차 0.00) — 형태가 바닥에 녹는다. 시연 석순 A1 「외곽선 없음」은 0.11.
# 예외 규칙(그늘 쪽 = 재질 가장 어두운 단)을 따르면 잔돌이 stone 0단 0.21 → 차 0.18 이 된다. 「0단까지 내려도 0.15 미만」이면
# 접지 그림자를 진하게 하거나 재질을 바꿔야 하는 자리라 0.15 로 둔다. 지시 예시 0.12 는 석순 0.11 을 겨우 잡고 0.12~0.15 를 놓친다.
CONTRAST_MIN = 0.15
CONTRAST_CELLS = 2

TONE_OF = {}
for _name, _ramp in dot.RAMPS.items():
    for _i, _c in enumerate(_ramp):
        TONE_OF.setdefault(_c, (_name, _i))


def is_ink(c):
    """팔레트 색 c(RGB 튜플)가 먹(밝기 ≤ INK_LUMA)인가."""
    return float(np.dot(c, LUM)) / 255.0 <= INK_LUMA


def _sil(m, pad_transparent=True):
    """(가장자리, 빛 쪽, 그늘 쪽) — m 은 불투명 마스크. pad_transparent=False 면 칸 밖을 불투명으로 본다(반복 조각)."""
    p = np.pad(m, 1, constant_values=not pad_transparent)
    up, dn, lf, rt = p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]
    return m & ~(up & dn & lf & rt), m & (~up | ~lf), m & (~dn | ~rt)


def _count(a, mask):
    """mask 화소 중 (센 화소, 먹, 먹·0단) — 불꽃·용암 화소는 빛이라 뺀다."""
    n = ink = dark = 0
    for y, x in zip(*np.nonzero(mask)):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in FIRE:
            continue
        n += 1
        k = is_ink(c)
        ink += k
        r = TONE_OF.get(c)
        dark += k or bool(r and r[1] == 0)
    return n, ink, dark


def _ink_share(a):
    op = a[:, :, 3] == 255
    n, ink, _ = _count(a, op)
    return ink / max(n, 1)


def check_outline(kind, meta):
    """OUTLINE(WARN). 대상 조각이 없으면 None."""
    pieces = []   # (이름, 배열, 가장자리 마스크, 빛 쪽 마스크 또는 None)
    if kind in ('objects', 'object'):
        for name, part in meta.get('parts', {}).items():
            pa = arr(part)
            e, lit, _ = _sil(pa[:, :, 3] == 255)
            pieces.append((name, pa, e, lit & e))
    if kind == 'kit':   # 다리 = 큰 구조: 바깥 실루엣이 재질 어두운 단이어도 된다 → 먹만 본다(빛 쪽 검사 없음)
        for side in ('h', 'v'):
            for i, cv in enumerate(meta['kit'].get(side, [])):
                e, _, _ = _sil(cv.a[:, :, 3] == 255, pad_transparent=False)
                pieces.append((f'다리 {side}{i}', cv.a, e, None))
    # 지형 오토타일: 「바깥 테두리 띠」 = 한 변만 끊긴 변형에서 몸통과 달라진 화소(그 변 쪽 반 칸 안) — 후보가 찍은 가장자리 띠 그대로.
    # 띠 깊이가 줄마다 달라(바깥 몇 px 는 이웃 흙이 비치기도 한다) 고정 2px 로는 시연 돌바닥 C1 의 vrock 0단 테두리를 놓쳤다(9% vs 30%).
    for name, at in meta.get('autotiles', {}).items():
        if _ink_share(at.body.a) >= 0.5:   # 몸통이 어둠(천장 어둠·낭떠러지 바닥) — 어둠이 재질이라 재지 않는다
            continue
        b = at.body.a
        for side, mask, sl in (('북', dot.E | dot.W | dot.S | dot.SE | dot.SW, np.s_[:8, :]),
                               ('남', dot.E | dot.W | dot.N | dot.NE | dot.NW, np.s_[8:, :]),
                               ('서', dot.N | dot.S | dot.E | dot.NE | dot.SE, np.s_[:, :8]),
                               ('동', dot.N | dot.S | dot.W | dot.NW | dot.SW, np.s_[:, 8:])):
            t = at.tile(mask).a
            band = np.zeros(t.shape[:2], bool)
            band[sl] = True
            pieces.append((f'{name} {side}변', t, band & (t != b).any(axis=2) & (t[:, :, 3] == 255), None))
    # 벽 앞면(큰 구조): 끝 마구리 = 끝 조각에서 가운데 조각과 달라진 화소(끝 쪽 반 칸 안) · 밑 = 아랫단 맨 아래 2줄(바닥 닿는 선)
    for name, f in meta.get('faces', {}).items():
        mid = f.tile(0, False, False).a
        for lab, t, sl in (('왼끝', f.tile(0, True, False).a, np.s_[:, :8]), ('오른끝', f.tile(0, False, True).a, np.s_[:, 8:])):
            band = np.zeros(t.shape[:2], bool)
            band[sl] = True
            pieces.append((f'{name} 앞면 {lab}', t, band & (t != mid).any(axis=2), None))
        bot = f.tile(1, False, False).a
        band = np.zeros(bot.shape[:2], bool)
        band[-2:] = True
        pieces.append((f'{name} 앞면 밑', bot, band, None))
    if not pieces:
        return None
    bad, total, tink = [], 0, 0
    for name, a, e, lit in pieces:
        n, ink, _ = _count(a, e)
        total += n
        tink += ink
        fi = ink / max(n, 1)
        why = []
        if fi > OUTLINE_INK_MAX:
            why.append(f'먹 {fi:.0%}')
        if lit is not None:
            nl, _, dl = _count(a, lit)
            fl = dl / max(nl, 1)
            if fl > OUTLINE_LIT_MAX:
                why.append(f'빛 쪽 먹·0단 {fl:.0%}')
        if why:
            bad.append(f'{name} ' + '·'.join(why))
    head = f'가장자리 {total}화소 중 먹 {tink / max(total, 1):.0%}'
    if bad:
        return _r('OUTLINE', 'WARN', False, head + f' — 상한(먹 {OUTLINE_INK_MAX:.0%}·빛 쪽 {OUTLINE_LIT_MAX:.0%}) 넘음: ' + '; '.join(bad)
                  + ' — 먹 윤곽 대신 재질 명암으로(빛 쪽 밝은 단, 그늘 쪽 어두운 단)')
    return _r('OUTLINE', 'WARN', True, head + f' · 조각 {len(pieces)}개 상한 안')


def check_contrast(meta, floor):
    """CONTRAST(WARN): 크기 ≤ CONTRAST_CELLS 칸 기물 part 의 그늘 쪽(아래·오른) 실루엣 가장자리 평균 밝기 vs 줄 바닥 몸통 평균 밝기.
    그늘 쪽만 보는 까닭: 규칙대로 빛 쪽을 밝게, 그늘 쪽을 어둡게 칠하면 가장자리 전체 평균은 바닥과 비슷해져 묻힘을 못 가린다.
    floor = 바닥 몸통 배열(16×16 RGBA). 대상이 없으면 None."""
    if floor is None or meta.get('kind') not in ('objects', 'object'):
        return None
    fl = float(lum(floor)[floor[:, :, 3] == 255].mean()) / 255.0
    out, bad = [], []
    for name, part in meta.get('parts', {}).items():
        pa = arr(part)
        m = pa[:, :, 3] == 255
        if not m.any():
            continue
        ys, xs = np.nonzero(m)
        cells = -(-(xs.max() - xs.min() + 1) // 16) * -(-(ys.max() - ys.min() + 1) // 16)
        if cells > CONTRAST_CELLS:
            continue
        _, _, shade = _sil(m)
        keep = np.array([tuple(int(v) for v in pa[y, x, :3]) not in FIRE for y, x in zip(*np.nonzero(shade))])
        if not keep.any():
            continue
        el = float(lum(pa)[shade][keep].mean()) / 255.0
        d = abs(el - fl)
        msg = f'{name}({cells}칸) 그늘 쪽 {el:.2f} vs 바닥 {fl:.2f} 차 {d:.2f}'
        out.append(msg)
        if d < CONTRAST_MIN:
            bad.append(msg)
    if not out:
        return None
    if bad:
        return _r('CONTRAST', 'WARN', False, '바닥에 묻힘(하한 %.2f): ' % CONTRAST_MIN + '; '.join(bad)
                  + ' — 그늘 쪽을 재질 가장 어두운 단으로, 접지 그림자를 진하게(먹은 쓰지 않는다)')
    return _r('CONTRAST', 'WARN', True, '; '.join(out))
