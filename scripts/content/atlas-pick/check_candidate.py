#!/usr/bin/env python3
"""생성 칩셋 조각 후보 검사: .pxg 를 pxgrid 로 다시 구워(.png·-x4.png·.txt) 자동 검사를 돌리고 <후보>.check.json 을 남긴다.

  python3 scripts/content/atlas-pick/check_candidate.py tiledata/atlas-pick/candidates-jp/<slug>/j1-A.pxg [...]
  python3 scripts/content/atlas-pick/check_candidate.py --set jp --slug <slug>    # 그 기물의 후보 전부
  python3 scripts/content/atlas-pick/check_candidate.py --set jp --worker j1      # 그 작업자 후보 전부
  python3 scripts/content/atlas-pick/check_candidate.py --set jp --all            # 세트의 모든 후보

합/불(hard, 하나라도 걸리면 「불합격」 — 제출은 되지만 고르는 화면에 빨갛게 뜬다):
  size      캔버스 = 기물 칸 수 × 16 (info.json canvas)
  bg        층이 투명 배경(object·wall·decal·over)이면 네 귀퉁이 중 둘 이상 투명, 칸을 꽉 채운 불투명 그림 금지
  ground    층이 ground(바닥)면 칸 전부 불투명(아래층에 깔린다 — 구멍이 있으면 검은 칸이 보인다)
  anchor    층이 object 면 맨 아래 불투명 줄이 캔버스 아래 3px 안(바닥에 선다 — 떠 있으면 불합격)
  palette   색 = 세트 팔레트(palette.pal) 안. 반투명은 팔레트에 적힌 (색, 알파)만
  mark      실루엣 표시색 # 이 남지 않음
  easyrpg   현대 시트 0~2729 칸(EasyRPG 계열, 폐기)과 95% 이상 닮은 16px 칸 0
  refmap    REFMAP(제3자 상용 팩) 칸과 95% 이상 닮은 16px 칸 0 (팩이 없는 기계에서는 건너뜀)
참고(soft): pxlint --tile 16 합/불·걸린 항목, 색 수, 메모 없음.
"""
import argparse, glob, json, os, sys, warnings
warnings.filterwarnings("ignore")
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
sys.path.insert(0, PXGRID); sys.path.insert(0, HARNESS)

REFMAP_PACKS = [os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/' + p) for p in ('refmap-town-outside', 'refmap-interior')]
CACHE = os.path.expanduser('~/.cache/oprn-atlas-pick')

# ── 칸 닮음(tiledata/hand-interior/refmap-study/checkr.py 와 같은 정의) ──
def cells(a, T):
    Hh, W = a.shape[0] // T, a.shape[1] // T
    return a[:Hh * T, :W * T].reshape(Hh, T, W, T, 4).transpose(0, 2, 1, 3, 4).reshape(Hh * W, T, T, 4)

def desc(c, T):
    c = c.astype(np.float32); al = c[..., 3:4] / 255.0
    pre = np.concatenate([c[..., :3] * al, c[..., 3:4]], -1); k = T // 4
    return pre.reshape(len(c), 4, k, 4, k, 4).mean((2, 4)).reshape(len(c), -1)

def sim(a, b):
    """닮음 = 둘 중 하나라도 불투명한 화소 가운데 「둘 다 불투명이고 RGB 차 ≤ 8」 비율."""
    oa = a[..., 3] > 0; ob = b[..., 3] > 0
    union = oa[None] | ob; both = oa[None] & ob
    close = np.abs(a[None, ..., :3].astype(np.int16) - b[..., :3].astype(np.int16)).max(-1) <= 8
    return (both & close).sum((1, 2)) / np.maximum(union.sum((1, 2)), 1)

def best_match(Q, R, T, k=64):
    Dq = desc(Q, T); Dr = desc(R, T); rn = (Dr ** 2).sum(1); best = np.zeros(len(Q)); arg = np.zeros(len(Q), int)
    for i in range(len(Q)):
        d2 = (Dq[i] ** 2).sum() + rn - 2 * Dr @ Dq[i]
        top = np.argpartition(d2, min(k, len(R) - 1))[:k]
        ss = sim(Q[i], R[top]); j = int(ss.argmax()); best[i] = ss[j]; arg[i] = top[j]
    return best, arg

_EASY = None
def easy_cells():
    """현대 시트 0~2729 칸(EasyRPG 계열)."""
    global _EASY
    if _EASY is None:
        a = np.array(Image.open(MODERN_SHEET).convert('RGBA')); c = cells(a, 16)[:EASYRPG_LAST + 1]
        _EASY = c[[i for i in range(len(c)) if c[i][..., 3].any()]]
    return _EASY

_REF = None
def refmap():
    """REFMAP 48px 칸 → 16px(LANCZOS·NEAREST). 팩은 제3자 상용 자료: 읽기만, 캐시는 저장소 밖."""
    global _REF
    if _REF is None:
        cp = os.path.join(CACHE, 'refmap16.npz')
        if os.path.exists(cp):
            z = np.load(cp); _REF = (z['r48'], z['l16'], z['n16'])
        else:
            files = [f for p in REFMAP_PACKS if os.path.isdir(p) for f in sorted(glob.glob(os.path.join(p, '*.png')))]
            if not files:
                _REF = False; return _REF
            big = []
            for f in files:
                c = cells(np.array(Image.open(f).convert('RGBA')), 48); big.append(c[[i for i in range(len(c)) if c[i][..., 3].any()]])
            B = np.concatenate(big); _, ui = np.unique(B.reshape(len(B), -1), axis=0, return_index=True); R48 = B[np.sort(ui)]
            l16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.LANCZOS)) for c in R48])
            n16 = np.stack([np.array(Image.fromarray(c).resize((16, 16), Image.NEAREST)) for c in R48])
            os.makedirs(CACHE, exist_ok=True); np.savez_compressed(cp, r48=R48, l16=l16, n16=n16); _REF = (R48, l16, n16)
    return _REF

def content_cells(a):
    c = cells(a, 16); keep = [i for i in range(len(c)) if (c[i][..., 3] > 0).mean() >= 0.10]
    return c[keep] if keep else None

def easy_check(a):
    Q = content_cells(a)
    if Q is None: return dict(cells=0, atLeast95=0, max=0.0)
    b, _ = best_match(Q, easy_cells(), 16)
    return dict(cells=len(Q), atLeast95=int((b >= .95).sum()), max=round(float(b.max()), 3))

def refmap_check(a):
    R = refmap()
    if R is False: return dict(skipped='REFMAP 팩 없음')
    Q = content_cells(a)
    if Q is None: return dict(cells=0, atLeast95=0, max=0.0)
    Qb = np.stack([np.array(Image.fromarray(c).resize((48, 48), Image.NEAREST)) for c in Q]); best = np.zeros(len(Q))
    for A, B, T in ((Q, R[1], 16), (Q, R[2], 16), (Qb, R[0], 48)):
        b, _ = best_match(A, B, T); best = np.maximum(best, b)
    return dict(cells=len(Q), atLeast95=int((best >= .95).sum()), max=round(float(best.max()), 3))

_ALLOWED = {}
def allowed(palpath):
    if palpath not in _ALLOWED:
        import pxgrid
        pal, _ = pxgrid.load_palette(palpath)
        _ALLOWED[palpath] = {tuple(c) for k, c in pal.items() if k != '#'}
    return _ALLOWED[palpath]

def bbox(a):
    ys, xs = (a[..., 3] > 0).nonzero()
    return None if not len(xs) else [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]

def check(pxg, quiet=False):
    import pxgrid
    d = os.path.dirname(os.path.abspath(pxg)); name = os.path.basename(pxg)
    base = os.path.splitext(os.path.abspath(pxg))[0]
    st, s = set_of_path(pxg)
    it = items_by_slug(st).get(s) if st else None
    res = dict(file=os.path.relpath(pxg, ROOT), set=st, id=it['id'] if it else None, hard=[], warn=[])
    if not WORKER_RE.match(name): res['warn'].append(f'파일 이름이 <작업자>-<방향>.pxg 꼴이 아니다(j1-A.pxg): {name}')
    if not it:
        res['hard'].append(f'폴더 {s} 가 세트 {st} 의 기물 slug 가 아니다'); return finish(res, base, quiet)
    try:
        _, im = pxgrid.render(pxg, base + '.png')
    except SystemExit as e:
        res['hard'].append(f'pxgrid 오류: {e}'); return finish(res, base, quiet)
    a = np.array(im.convert('RGBA')); H, W = a.shape[:2]; layer = it['layer']
    want = canvas_for(st, it, os.path.splitext(name)[0]); sd = std_tag(st, s, os.path.splitext(name)[0])
    if [W, H] != want:
        res['hard'].append(f'size: {W}x{H} ≠ ' + (f'표준 캔버스 {want[0]}x{want[1]} (실제 비율 §12, 칸 {sd["cells"][0]}×{sd["cells"][1]})' if sd else f'기물 캔버스 {want[0]}x{want[1]} (칸 {it["cells"][0]}×{it["cells"][1]})')); return finish(res, base, quiet)
    if sd: res['std'] = dict(cells=sd['cells'], canvas=want)
    corners = [a[0, 0, 3], a[0, -1, 3], a[-1, 0, 3], a[-1, -1, 3]]
    # 16px/m: 폭 1.0m 물건은 캔버스 폭을 꽉 채우고, F+T 가 칸 높이와 같으면 캔버스 전체가 몸통이 된다 → 표준 후보(sd)가 그 크기 그대로면 귀퉁이 투명·전면 불투명 요구를 면제
    full_w = bool(sd) and sd['basis'].get('wpx') == W
    full_all = full_w and sd['basis'].get('F', 0) + sd['basis'].get('T', 0) == H
    if LAYERS[layer][1] and ((sum(c == 0 for c in corners) < 2 and not full_w) or ((a[..., 3] == 255).all() and not full_all)):
        res['hard'].append('bg: 배경이 투명하지 않다(귀퉁이 셋 이상이 불투명) — 이 층은 투명 배경 위에 그린다')
    if layer == 'ground' and (a[..., 3] < 255).any():
        res['hard'].append(f'ground: 바닥 칸에 투명·반투명 화소 {int((a[..., 3] < 255).sum())}개 — 바닥은 칸을 꽉 채운다(아스팔트·보도 바탕까지)')
    b = bbox(a)
    if b is None:
        res['hard'].append('anchor: 불투명 화소가 없다')
    elif layer == 'object' and b[3] < H - 3:
        res['hard'].append(f'anchor: 맨 아래 그림 줄 y={b[3]} (캔버스 높이 {H}) — 물체는 캔버스 아래 3px 안에 발을 딛는다')
    pal = os.path.join(d, 'palette.pal')
    if not os.path.exists(pal): pal = os.path.join(PAL_DIR, set_conf(st).get('palette') or f'{st}.pal')
    al = set(allowed(pal)); px = a.reshape(-1, 4); px = px[px[:, 3] > 0]
    for ref in ('v0.png', 'members.png'):   # 현재판이 있는 세트(현대): 현재판이 쓰는 색도 허용
        if os.path.exists(os.path.join(d, ref)):
            r = np.array(Image.open(os.path.join(d, ref)).convert('RGBA')).reshape(-1, 4); al |= set(map(tuple, r[r[:, 3] > 0].tolist()))
    bad = {tuple(c) for c in map(tuple, px.tolist()) if c not in al}
    if bad:
        res['hard'].append('palette: 팔레트 밖 색 %d개 %s' % (len(bad), ', '.join('#%02x%02x%02x/%d' % c for c in list(bad)[:6])))
    if any(tuple(c[:3]) == (0xe0, 0x40, 0xc0) for c in map(tuple, px.tolist())):
        res['hard'].append('mark: 실루엣 표시색 # 이 남았다')
    ec = easy_check(a); res['easyrpg'] = ec
    if ec['atLeast95']: res['hard'].append(f'easyrpg: 현대 시트 0~2729(EasyRPG 계열) 칸과 95% 이상 닮은 칸 {ec["atLeast95"]}개 — 옛 칸을 베끼지 마라')
    rc = refmap_check(a); res['refmap'] = rc
    if rc.get('atLeast95'): res['hard'].append(f'refmap: REFMAP 과 95% 이상 닮은 칸 {rc["atLeast95"]}개 — 제3자 화소 복사 금지')
    try:
        import pxlint
        lint = pxlint.lint_array(a, 16, None, 'object', pxlint.load_stats(), keep_defects=False)
        res['lint'] = {'pass': lint['pass'], 'failed': lint.get('failed', [])}
    except Exception as e:  # pxlint 는 참고 표시만
        res['lint'] = dict(error=str(e)[:200])
    res['colors'] = len({tuple(c) for c in map(tuple, px.tolist())}); res['bbox'] = b
    note = base + '.note'
    res['note'] = open(note, encoding='utf-8').read().strip().split('\n')[0] if os.path.exists(note) else ''
    if not res['note']: res['warn'].append('메모 없음: <후보>.note 에 한 줄')
    return finish(res, base, quiet)

def finish(res, base, quiet):
    res['ok'] = not res['hard']
    atomic_write(base + '.check.json', json.dumps(res, ensure_ascii=False, indent=1) + '\n')
    if not quiet:
        lint = res.get('lint', {})
        print(('합격 ' if res['ok'] else '불합격 ') + res['file'], '| pxlint16', ('합' if lint.get('pass') else '불 ' + ','.join(lint.get('failed', [])[:4])),
              '| easyrpg max', res.get('easyrpg', {}).get('max'), '| refmap max', res.get('refmap', {}).get('max'))
        for h in res['hard']: print('   ✗', h)
        for w in res['warn']: print('   ·', w)
    return res

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='*'); ap.add_argument('--set', default='jp'); ap.add_argument('--slug')
    ap.add_argument('--all', action='store_true'); ap.add_argument('--worker'); ap.add_argument('--quiet', action='store_true'); a = ap.parse_args()
    files = list(a.files); cd = cand_dir(a.set)
    if a.slug: files += sorted(glob.glob(os.path.join(cd, a.slug, '*.pxg')))
    if a.all or a.worker: files += sorted(glob.glob(os.path.join(cd, '*', f'{a.worker or "*"}-*.pxg')))
    files = [f for f in files if WORKER_RE.match(os.path.basename(f)) or f in a.files]
    if not files: raise SystemExit('검사할 후보가 없다')
    rs = [check(f, a.quiet) for f in files]
    print(f'{sum(r["ok"] for r in rs)}/{len(rs)} 합격')
    sys.exit(0 if all(r['ok'] for r in rs) else 1)

if __name__ == '__main__':
    main()
