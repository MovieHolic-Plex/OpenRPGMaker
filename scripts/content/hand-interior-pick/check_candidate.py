#!/usr/bin/env python3
"""후보 검사: .pxg 를 pxgrid 로 다시 구워(.png·-x4.png·.txt) 자동 검사를 돌리고 <후보>.check.json 을 남긴다.

  python3 scripts/content/hand-interior-pick/check_candidate.py tiledata/hand-interior/pick/candidates/<slug>/w1-A.pxg [...]
  python3 scripts/content/hand-interior-pick/check_candidate.py --slug <slug>     # 그 기물의 후보 전부
  python3 scripts/content/hand-interior-pick/check_candidate.py --all             # 모든 후보
  python3 scripts/content/hand-interior-pick/check_candidate.py --worker w1       # 그 작업자 후보 전부

합/불(hard, 하나라도 걸리면 「불합격」 — 제출은 되지만 고르는 화면에 빨갛게 뜬다):
  size      캔버스 = v5 칸 자리(패딩 포함)와 같은 크기 (candidates/<slug>/resize.json 이 있으면 그 캔버스. 그땐 anchor·폭 비교 생략)
  bg        투명 배경(네 귀퉁이 중 셋 이상 투명, 칸을 꽉 채운 불투명 그림 금지 — flat 깔개 제외)
  pad       패딩 줄(padTop, 그림 위 투명 여백)에 불투명 화소 없음
  anchor    바닥 접지선: 불투명 화소의 맨 아래 줄이 v5 와 ±1px (걸이(hang)는 ±2)
  palette   색 = 공통 팔레트(palette/v5.pal) ∪ v5 기물 381개가 쓰는 색. 반투명은 그 안의 (색, 알파) 만
  mark      실루엣 표시색 # 이 남지 않음
  surface   탁상 물건 자리(surface.rect_px)가 전부 불투명 — 윗면이 비면 위에 놓은 물건이 뜬다
  refmap    REFMAP 칸과 95% 이상 닮은 16px 칸 0 (팩이 없는 기계에서는 건너뜀)
참고(soft): pxlint --tile 16 합/불·걸린 항목, 불투명 폭 차(v5 대비 ±3px 넘으면 경고), 색 수.
"""
import argparse, glob, json, os, sys, warnings
warnings.filterwarnings("ignore")
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
sys.path.insert(0, PXGRID); sys.path.insert(0, HARNESS)

_ALLOWED = None
def allowed():
    """허용 색: 공통 팔레트 + v5 기물이 쓰는 모든 (RGB, 알파)."""
    global _ALLOWED
    if _ALLOWED is None:
        import pxgrid
        pal, _ = pxgrid.load_palette(SHARED_PAL)
        s = {tuple(c) for k, c in pal.items() if k != '#'}
        a = np.array(v5_atlas())
        for o in load_meta(include_new=False)['objects']:   # 새 기물은 아틀라스에 그림이 없다
            t = o['atlas']; c = a[t['y']:t['y'] + t['h'], t['x']:t['x'] + t['w'] * t['frames']].reshape(-1, 4)
            s |= set(map(tuple, c[c[:, 3] > 0].tolist()))
        _ALLOWED = s
    return _ALLOWED

_REF = None
def refmap():
    """REFMAP 48px 칸(시트 + 조립 맵) → 16px(LANCZOS·NEAREST) 캐시. 팩은 상용 제3자 자료: 읽기만, 캐시는 저장소 밖."""
    global _REF
    if _REF is None:
        sys.path.insert(0, os.path.join(ROOT, 'tiledata/hand-interior/refmap-study'))
        cache = os.path.expanduser('~/.cache/oprn-hand-interior-pick/refmap16.npz')
        if os.path.exists(cache):
            z = np.load(cache); _REF = (z['r48'], z['l16'], z['n16'])
        else:
            import checkr
            if not os.path.isdir(checkr.PACK):
                _REF = False; return _REF
            R48, _, _ = checkr.refs()
            l16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.LANCZOS)) for c in R48])
            n16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.NEAREST)) for c in R48])
            os.makedirs(os.path.dirname(cache), exist_ok=True); np.savez_compressed(cache, r48=R48, l16=l16, n16=n16)
            _REF = (R48, l16, n16)
    return _REF

def refmap_check(a):
    R = refmap()
    if R is False:
        return dict(skipped='REFMAP 팩 없음')
    import checkr
    H, W = a.shape[:2]
    cells = [a[y:y + 16, x:x + 16] for y in range(0, H, 16) for x in range(0, W, 16)]
    cells = [c for c in cells if (c[..., 3] > 0).mean() >= 0.10]
    if not cells:
        return dict(cells=0, atLeast95=0, max=0.0)
    Q = np.stack(cells); Qb = np.stack([np.array(Image.fromarray(c).resize((48, 48), Image.NEAREST)) for c in Q])
    best = np.zeros(len(Q))
    for A, B, T in ((Q, R[1], 16), (Q, R[2], 16), (Qb, R[0], 48)):
        b, _, _ = checkr.best_match(A, B, T); best = np.maximum(best, b)
    return dict(cells=len(Q), atLeast95=int((best >= .95).sum()), max=round(float(best.max()), 3))

def bbox(a):
    ys, xs = (a[..., 3] == 255).nonzero()
    return None if not len(xs) else [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]

def check(pxg, quiet=False):
    import pxgrid, pxlint
    d = os.path.dirname(os.path.abspath(pxg)); s = os.path.basename(d); name = os.path.basename(pxg)
    base = os.path.splitext(os.path.abspath(pxg))[0]
    o = objects_by_slug().get(s)
    res = dict(file=os.path.relpath(pxg, ROOT), id=o['id'] if o else None, hard=[], warn=[])
    if o and o.get('new'): res['new'] = True; res['skipped'] = 'v5 비교(바닥선·폭·키) 생략: 새 기물은 v5 그림이 없다. 캔버스는 new/items.json 기준'
    m = WORKER_RE.match(name)
    if not m: res['warn'].append(f'파일 이름이 <작업자>-<방향>.pxg 꼴이 아니다(w1-A.pxg): {name}')
    if not o:
        res['hard'].append(f'폴더 이름 {s} 이 v5 기물·새 기물(new/items.json) slug 가 아니다'); return finish(res, base, quiet)
    try:
        _, im = pxgrid.render(pxg, base + '.png')
    except SystemExit as e:
        res['hard'].append(f'pxgrid 오류: {e}'); return finish(res, base, quiet)
    a = np.array(im.convert('RGBA')); H, W = a.shape[:2]
    v5 = np.array(v5_slot(o)); t = o['atlas']; G = geom(o); rz = G['resized']; pad = G['padTop']
    if rz: res['resized'] = dict(canvas=rz['canvas'], footprint=G['footprint'], why=rz['why'])
    if [W, H] != G['canvas']:
        res['hard'].append(f'size: {W}x{H} ≠ ' + (f'resize.json 캔버스 {G["canvas"][0]}x{G["canvas"][1]}' if rz else f'v5 칸 자리 {t["w"]}x{t["h"]}')); return finish(res, base, quiet)
    corners = [a[0, 0, 3], a[0, -1, 3], a[-1, 0, 3], a[-1, -1, 3]]
    if o['kind'] != 'flat' and (sum(c == 0 for c in corners) < 2 or (a[..., 3] == 255).all()):
        res['hard'].append('bg: 배경이 투명하지 않다(귀퉁이 둘 이상이 불투명)')
    if pad and (a[:pad, :, 3] > 0).any():
        res['hard'].append(f'pad: 위 {pad}px 패딩 줄에 그림이 있다(그림 높이는 v5 와 같아야 한다)')
    b, b5 = bbox(a), bbox(v5)
    if b is None:
        res['hard'].append('anchor: 불투명 화소가 없다')
    elif o.get('new'):
        # v5 와 견줄 바닥선이 없다: 발이 놓이는 기물은 캔버스 맨 아래 줄 근처에서 끝나야 칸에 앉는다(참고 경고)
        if o['kind'] in ('floor', 'wall') and b[3] < H - 3: res['warn'].append(f'접지: 맨 아래 불투명 줄 y={b[3]} — 캔버스 바닥 y={H - 1} 에서 {H - 1 - b[3]}px 떠 있다')
    elif b5 and rz:
        pass   # 크기를 바꾼 기물: v5 바닥선·폭은 더 이상 기준이 아니다
    elif b5:
        tol = 2 if o['kind'] == 'hang' else 1
        if abs(b[3] - b5[3]) > tol:
            res['hard'].append(f'anchor: 맨 아래 불투명 줄 y={b[3]} (v5 y={b5[3]}, 허용 ±{tol}) — 바닥 접지선을 맞춰라')
        dw = (b[2] - b[0]) - (b5[2] - b5[0])
        if abs(dw) > 3: res['warn'].append(f'폭: 불투명 폭이 v5 보다 {dw:+d}px')
        if b[1] < b5[1] - 2 and o['kind'] in ('floor',): res['warn'].append(f'키: 위 끝 y={b[1]} (v5 y={b5[1]}) — 낮은 가구가 솟았다')
    al = allowed(); px = a.reshape(-1, 4); px = px[px[:, 3] > 0]
    bad = {tuple(c) for c in map(tuple, px.tolist()) if c not in al}
    if bad:
        res['hard'].append('palette: v5 밖 색 %d개 %s' % (len(bad), ', '.join('#%02x%02x%02x/%d' % c for c in list(bad)[:6])))
    if any(tuple(c[:3]) == (0xe0, 0x40, 0xc0) for c in map(tuple, px.tolist())):
        res['hard'].append('mark: 실루엣 표시색 # 이 남았다')
    if o.get('surface'):
        x0, y0, x1, y1 = o['surface']['rect_px']
        if (a[pad + y0:pad + y1 + 1, x0:x1 + 1, 3] < 255).any():
            res['hard'].append(f'surface: 탁상 물건 자리 {o["surface"]["rect_px"]} 에 빈 화소가 있다')
    rc = refmap_check(a); res['refmap'] = rc
    if rc.get('atLeast95'): res['hard'].append(f'refmap: REFMAP 과 95% 이상 닮은 칸 {rc["atLeast95"]}개')
    try:
        lint = pxlint.lint_array(a[pad:], 16, json.load(open(os.path.join(d, 'info.json'))).get('material'), 'object', pxlint.load_stats(), keep_defects=False)
        res['lint'] = dict(pass_=lint['pass'], failed=lint.get('failed', []))
        res['lint']['pass'] = res['lint'].pop('pass_')
    except Exception as e:  # pxlint 는 참고 표시만
        res['lint'] = dict(error=str(e)[:200])
    res['colors'] = len({tuple(c) for c in map(tuple, px.tolist())}); res['v5_colors'] = len({tuple(c) for c in map(tuple, v5.reshape(-1, 4)[v5.reshape(-1, 4)[:, 3] > 0].tolist())})
    res['bbox'] = b; res['v5_bbox'] = b5
    note = base + '.note'
    res['note'] = open(note, encoding='utf-8').read().strip().split('\n')[0] if os.path.exists(note) else ''
    if not res['note']: res['warn'].append('메모 없음: <후보>.note 에 한 줄')
    full_note = open(note, encoding='utf-8').read() if os.path.exists(note) else ''
    res['hard'] += top_claim_check(a[pad:], o, full_note, res)
    return finish(res, base, quiet)

EDGE_T, EDGE_ROW, COVER_MIN = 40, 0.75, 0.5   # 가로 윤곽선 = 위 줄과 밝기가 40 넘게 다른 칸이 75% 이상인 줄 · 띠 평균 채움 50%

def band_profile(a):
    """줄마다 (채움 = 불투명 폭 / 물건 폭, 가로 윤곽 = 위 줄과 밝기가 크게 다른 칸 비율)."""
    A = a[..., 3] > 0; L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    xs = np.where(A.any(0))[0]; w = max(1, xs.max() - xs.min() + 1) if len(xs) else 1
    out = []
    for y in range(a.shape[0]):
        both = A[y] & A[y - 1] if y else np.zeros_like(A[y])
        e = (np.abs(L[y] - L[y - 1]) >= EDGE_T) & both if y else both
        out.append((A[y].sum() / w, e.sum() / max(1, both.sum())))
    return out

def top_claim_check(a, o, note, res):
    """꼭대기 면 결정적 검사(2026-10-02). 바닥·벽 앞 기물은 메모에 `꼭대기 윗면 N행(y=a~b)` 를 적어야 하고,
    N ≥ 규칙(common.top_min), N = b−a+1, 그 띠가 한 덩이 면이어야 한다(평균 채움 50% 이상, 띠 안을 가로지르는 윤곽선 없음).
    옆모습 기차(지붕 2~4행 + 옆면)를 「윗면 14행」이라 적으면 띠가 지붕 밑 윤곽선을 가로지른다 → 불합격.
    무엇이 윗면인지는 검수(따로 잰 top_y)가 맞대어 본다 — 이 검사는 거짓 범위를 거르는 문이다."""
    need = top_min(o)
    if need is None: return []
    claim = parse_top_claim(note)
    if not claim: return [f'top: 메모에 `꼭대기 윗면 N행(y=a~b)` 가 없다 — 이 기물은 {need}행 이상({top_rule_text(o)})']
    n, y0, y1 = claim; H = a.shape[0]; errs = []
    res['topClaim'] = dict(rows=n, y=[y0, y1], need=need)
    if y1 < y0 or y1 >= H: return [f'top: 메모의 범위 y={y0}~{y1} 가 캔버스(0~{H - 1}) 밖이거나 거꾸로다']
    if abs((y1 - y0 + 1) - n) > 1: errs.append(f'top: 메모의 {n}행과 범위 y={y0}~{y1}({y1 - y0 + 1}행)이 다르다')
    if y1 - y0 + 1 < need: errs.append(f'top: 꼭대기 윗면 {y1 - y0 + 1}행 < {need}행 — {top_rule_text(o)}')
    p = band_profile(a)
    cover = sum(p[y][0] for y in range(y0, y1 + 1)) / (y1 - y0 + 1)
    if cover < COVER_MIN: errs.append(f'top: 메모의 윗면 y={y0}~{y1} 가 비어 있다(평균 채움 {cover:.0%} < {COVER_MIN:.0%}) — 면이 아니라 허공·장식이다')
    cuts = [y for y in range(y0 + 2, y1) if p[y][0] >= COVER_MIN and p[y][1] >= EDGE_ROW]
    if cuts: errs.append(f'top: 메모의 윗면 y={y0}~{y1} 를 가로 윤곽선 y={cuts[0]} 이 가로지른다 — 그 아래는 옆면이다(옆모습을 윗면이라 적었다)')
    res['topBand'] = dict(cover=round(cover, 2), cuts=cuts[:6])
    return errs


def finish(res, base, quiet):
    res['ok'] = not res['hard']
    atomic_write(base + '.check.json', json.dumps(res, ensure_ascii=False, indent=1) + '\n')
    if not quiet:
        lint = res.get('lint', {})
        print(('합격 ' if res['ok'] else '불합격 ') + res['file'] + (' [새 기물: v5 비교 생략]' if res.get('new') else ''), '| pxlint16', ('합' if lint.get('pass') else '불 ' + ','.join(lint.get('failed', [])[:4])),
              '| refmap max', res.get('refmap', {}).get('max'))
        for h in res['hard']: print('   ✗', h)
        for w in res['warn']: print('   ·', w)
    return res

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='*'); ap.add_argument('--slug'); ap.add_argument('--all', action='store_true')
    ap.add_argument('--worker'); ap.add_argument('--quiet', action='store_true'); a = ap.parse_args()
    files = list(a.files)
    if a.slug: files += sorted(glob.glob(os.path.join(CAND, a.slug, '*.pxg')))
    if a.all or a.worker: files += sorted(glob.glob(os.path.join(CAND, '*', f'{a.worker or "*"}-*.pxg')))
    files = [f for f in files if WORKER_RE.match(os.path.basename(f)) or f in a.files]
    if not files: raise SystemExit('검사할 후보가 없다')
    rs = [check(f, a.quiet) for f in files]
    print(f'{sum(r["ok"] for r in rs)}/{len(rs)} 합격')
    sys.exit(0 if all(r['ok'] for r in rs) else 1)

if __name__ == '__main__':
    main()
