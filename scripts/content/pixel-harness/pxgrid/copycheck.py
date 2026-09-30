#!/usr/bin/env python3
"""REFMAP 화소 복사 0 검사: 시험 작도 final.png 의 모든 32px 칸을 REFMAP 48px 칸(시트 7장 + 조립 맵)과 비교한다.
48px 판은 REFMAP 48px 칸과 그대로·둘 다 32로 줄여서, 32px 판은 예전 세 방식. 방식·기준은 tiledata/hand-interior/refmap-study/checkr.py 와 같다(REFMAP 을 32로 줄여 LANCZOS·NEAREST, 우리를 48로 늘려 NEAREST,
닮음 = 둘 중 하나라도 불투명한 화소 중 「둘 다 불투명 + RGB 차 ≤ 8」 비율, 95% 이상이면 복사로 본다).
  python3 scripts/content/pixel-harness/pxgrid/copycheck.py   → copy-check.json
REFMAP 팩이 없는 기계에서는 건너뛴다(팩은 상용 제3자 자료라 저장소에 없다).
"""
import glob, json, os, sys
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
R0 = os.path.abspath(os.path.join(D, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(R0, 'tiledata/hand-interior/refmap-study'))
import checkr

def ours(trials, T):
    out, src = [], []
    files = sorted(glob.glob(os.path.join(D, trials, '*', 'out', 'final.png')) + glob.glob(os.path.join(D, trials, '*', 'out', 'final-?.png')))
    for f in files:
        im = Image.open(f).convert('RGBA'); n = f.split(os.sep)[-3] + '/' + os.path.basename(f)
        pad = Image.new('RGBA', (-(-im.width // T) * T, -(-im.height // T) * T)); pad.alpha_composite(im)
        c = checkr.cells(pad, T)
        for i in range(len(c)):
            if (c[i][..., 3] > 0).mean() >= 0.10:
                out.append(c[i]); src.append((n, i))
    return np.stack(out), src

def run(name, Q, qsrc, pairs):
    res = {}
    for mode, (A, B, T) in pairs.items():
        best, arg, exact = checkr.best_match(A, B, T)
        res[mode] = dict(exactMatches=int(exact), atLeast95=int((best >= .95).sum()), atLeast90=int((best >= .90).sum()),
                         atLeast50=int((best >= .50).sum()), maxSimilarity=round(float(best.max()), 4),
                         perCell=[dict(ours=qsrc[i], ref=rsrc[arg[i]], similarity=round(float(best[i]), 4)) for i in range(len(qsrc))])
    return dict(ourCells=len(qsrc), modes=res)

def main():
    global R48, rsrc
    if not os.path.isdir(checkr.PACK):
        print('REFMAP 팩 없음 — 건너뜀'); return
    R48, rsrc, nf = checkr.refs()
    rep = dict(refCells48=int(len(R48)), refFiles=nf, threshold=0.95, tolerance=8, sets={})
    small = lambda m: np.stack([np.array(Image.fromarray(c).resize((32, 32), getattr(Image.Resampling, m))) for c in R48])
    # 48px 판 (trials/)
    Q, qs = ours('trials', 48)
    Qs = np.stack([np.array(Image.fromarray(c).resize((32, 32), Image.LANCZOS)) for c in Q])
    rep['sets']['trials48'] = run('trials48', Q, qs, {'direct48': (Q, R48, 48), 'both32_LANCZOS': (Qs, small('LANCZOS'), 32)})
    # 32px 판 (trials32/)
    Q, qs = ours('trials32', 32)
    Qb = np.stack([np.array(Image.fromarray(c).resize((48, 48), Image.NEAREST)) for c in Q])
    rep['sets']['trials32'] = run('trials32', Q, qs, {'ref48to32_LANCZOS': (Q, small('LANCZOS'), 32), 'ref48to32_NEAREST': (Q, small('NEAREST'), 32),
                                                        'ours32to48_NEAREST': (Qb, R48, 48)})
    open(os.path.join(D, 'copy-check.json'), 'w').write(json.dumps(rep, ensure_ascii=False, indent=1) + '\n')
    for k, v in rep['sets'].items():
        print(k, '칸', v['ourCells'], json.dumps({m: {x: r[x] for x in ('exactMatches', 'atLeast95', 'atLeast90', 'atLeast50', 'maxSimilarity')} for m, r in v['modes'].items()}, ensure_ascii=False))
    print('REFMAP 48px 칸', rep['refCells48'])

if __name__ == '__main__':
    main()
