#!/usr/bin/env python3
"""wasteland_ruins 조각 전체 진입점.
  python3 wl_all.py preview OUT.png [id…]   4배 미리보기 판(모든 조각, 어두운 흙 바탕)
  python3 wl_all.py samples OUT.png         관문 표본(지형 깔기·오토타일 조립) 판
  python3 wl_all.py gate [--todo] [id…]     tiledata/wasteland-ruins/_gate/<id>.png + items.jsonl 쓰기(--todo: 영수증 pass 아닌 것만)
  python3 wl_all.py status [-v]             영수증만 읽어 pass/refer/fail/none (모델 호출 없음)
  python3 wl_all.py palette                 모든 조각·표본 팔레트 검사
관문 판정 자체는 저장소 뿌리에서: npm run -s harness -- object-gate review --batch tiledata/wasteland-ruins/_gate/items.jsonl
"""
import json, os, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wl_core as C
from PIL import Image

MODS = ['wl_ground', 'wl_slab', 'wl_ruins', 'wl_props', 'wl_ruins_b', 'wl_ruins_c', 'wl_shanty']
for _m in MODS:
    if os.path.exists(os.path.join(C.HERE, _m + '.py')):
        importlib.import_module(_m)


def _load_legacy():
    """r63: 크기 보정 다시 그림이 3/4 관문을 못 넘은 조각은 r62 그림(관문 통과·허용된 해시)을 그대로 쓴다 — legacy_r62/ids.json 의 id 만.
    legacy_r62/lg_*.py 는 origin/main(#3488) 의 모듈 사본이다. 다시 그린 그림이 관문을 넘으면 그 id 를 ids.json 에서 빼고, 비면 폴더째 지운다."""
    d = os.path.join(C.HERE, 'legacy_r62'); f = os.path.join(d, 'ids.json')
    if not os.path.exists(f): return
    ids = json.load(open(f))
    if not ids: return
    import importlib.util
    cur = C.PIECES; C.PIECES = {}
    try:
        for name in ('ruins', 'props', 'ruins_b', 'ruins_c', 'shanty'):
            spec = importlib.util.spec_from_file_location('lg_' + name, os.path.join(d, 'lg_%s.py' % name))
            mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        leg = C.PIECES
    finally:
        C.PIECES = cur
    for i in ids: cur[i] = leg[i]


_load_legacy()


_BLEND = None


def unshadow(a):
    """표본 화소 중 «허용 그림자(SHADOW_RGBA)를 팔레트 색 위에 섞은 값»(decal_sample 과 같은 식·버림)과 정확히 같은 것만 그 밑 팔레트 색으로 되돌린다."""
    global _BLEND
    import numpy as np
    if _BLEND is None:
        sr, sg, sb, sa = C.SHADOW_RGBA; al = np.float32(sa) / np.float32(255.0); _BLEND = {}
        for v in C.ALLOWED:
            base = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], np.uint8)
            mix = (base * (1 - al) + np.array([sr, sg, sb], np.float32) * al).astype(np.uint8)
            _BLEND.setdefault(tuple(int(x) for x in mix), tuple(int(x) for x in base))
    a = a.copy()
    for y, x in zip(*np.nonzero(a[..., 3] == 255)):
        k = tuple(int(v) for v in a[y, x, :3])
        v = (k[0] << 16) | (k[1] << 8) | k[2]
        if v not in C.ALLOWED and k in _BLEND: a[y, x, :3] = _BLEND[k]
    return a


def main():
    a = sys.argv[1:] or ['status']; cmd = a[0]
    args = [x for x in a[1:] if not x.startswith('-')]
    if cmd == 'preview':
        out = args[0] if args else '/tmp/wl-preview.png'; only = set(args[1:]) or None
        ims = [Image.fromarray(C.render(p, f), 'RGBA') for p in C.PIECES.values() if not only or p['id'] in only for f in range(p['frames'])]
        C.board(ims, out, W=int(os.environ.get('W', 400)), z=int(os.environ.get('Z', 4)), bg=(96, 74, 58, 255)); print(out); return
    if cmd == 'samples':
        out = args[0] if args else '/tmp/wl-samples.png'
        ims = [Image.fromarray(C.gate_array(p), 'RGBA') for p in C.PIECES.values() if p['sample']]
        C.board(ims, out, W=int(os.environ.get('W', 420)), z=int(os.environ.get('Z', 3))); print(out); return
    if cmd == 'palette':
        bad = []
        for p in C.PIECES.values():
            for f in range(p['frames']):
                bad += C.palette_issues(C.render(p, f), p['id'])
                g = C.gate_array(p, f)
                if p['sample']: g = unshadow(g)                       # 표본 안 그림자는 흙 위에 섞여 구워진다 — 정확히 «허용 그림자 × 팔레트 색» 섞임인 화소만 되돌린다
                bad += C.palette_issues(g, p['id'] + '(표본)')
        print('\n'.join(bad) or 'palette ok: %d pieces, 0 off-palette' % len(C.PIECES)); return
    if cmd == 'status':
        cnt = {}
        for p in C.PIECES.values():
            s = C.status_of(p); cnt[s] = cnt.get(s, 0) + 1
            if s != 'pass' or '-v' in a:
                sha, r = C.receipt_of(p)
                print(s.upper().ljust(5), p['id'].ljust(16), p['kind'].ljust(14), sha[:16], '; '.join((r or {}).get('reasons') or [])[:160])
        print(cnt); return
    if cmd == 'gate':
        only = set(args) or None
        ps = [p['id'] for p in C.PIECES.values() if (not only or p['id'] in only) and ('--todo' not in a or C.status_of(p) != 'pass')]
        rows, bad = C.export(set(ps))
        for b in bad: print('  x', b)
        path = os.environ.get('GATE_ITEMS') or os.path.join(C.GATE_DIR, 'items.jsonl')     # GATE_ITEMS: 작업자마다 따로(동시 실행)
        open(path, 'w').write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
        print('%d images -> %s' % (len(rows), path)); return
    print(__doc__)


if __name__ == '__main__': main()
