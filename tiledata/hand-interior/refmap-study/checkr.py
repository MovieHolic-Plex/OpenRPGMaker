# REFMAP 화소 0 검사: 견본 방·소품의 모든 32px 칸을 REFMAP 칸과 비교한다 (check_easyrpg.py 방식).
#   python3 tiledata/hand-interior/refmap-study/checkr.py  → tiledata/hand-interior/refmap-study/refmap-check.json
# REFMAP 은 48px 칸이다. 비교는 두 방식: (1) REFMAP 칸을 32px 로 줄여(LANCZOS·NEAREST) 우리 32px 칸과,
# (2) 우리 칸을 48px 로 늘려(NEAREST) REFMAP 48px 칸과. 참조: 팩 시트 7장 + 조립 맵 렌더 20장(모든 48px 칸).
# 방 밖 검은 칸(그림 10% 미만)은 뺀다.
# 닮음 = 두 칸 중 하나라도 불투명한 화소 가운데 「둘 다 불투명이고 RGB 차이 ≤ 8」 비율. 빈 칸은 뺀다. 4×4 서술자로 후보 64개를 먼저 고른다.
import glob, json, os, sys
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import roomr, propsr

PACK = os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/refmap-interior/')
MAPS = os.path.expanduser('~/.local/share/oprn/refmap-downloads/_work/refmap-interior/out/publish/')

def cells(im, T):
    a = np.array(im.convert('RGBA'))
    Hh, W = a.shape[0] // T, a.shape[1] // T
    return a[:Hh * T, :W * T].reshape(Hh, T, W, T, 4).transpose(0, 2, 1, 3, 4).reshape(Hh * W, T, T, 4)

def desc(c, T):
    c = c.astype(np.float32); al = c[..., 3:4] / 255.0
    pre = np.concatenate([c[..., :3] * al, c[..., 3:4]], -1)
    k = T // 4
    return pre.reshape(len(c), 4, k, 4, k, 4).mean((2, 4)).reshape(len(c), -1)

def sim(a, b):
    oa = a[..., 3] > 0; ob = b[..., 3] > 0
    union = oa[None] | ob; both = oa[None] & ob
    close = np.abs(a[None, ..., :3].astype(np.int16) - b[..., :3].astype(np.int16)).max(-1) <= 8
    return (both & close).sum((1, 2)) / np.maximum(union.sum((1, 2)), 1)

def ours():
    ims = {'room': roomr.room()}
    for n, p in propsr.all_props().items():
        pad = Image.new('RGBA', (-(-p.im.width // 32) * 32, -(-p.im.height // 32) * 32)); pad.alpha_composite(p.im, (0, 0))
        ims['prop:' + n] = pad
    out = []; src = []
    for k, im in ims.items():
        c = cells(im, 32)
        # 빈 칸과 방 밖 검은 칸(그림이 10% 미만)은 뺀다: 검정끼리는 누구와도 닮는다.
        keep = [i for i in range(len(c)) if ((c[i][..., 3] > 0) & (c[i][..., :3].max(-1) > 12)).mean() >= 0.10]
        out.append(c[keep]); src += [(k, int(i)) for i in keep]
    return np.concatenate(out), src

def refs():
    files = sorted(glob.glob(PACK + '*.png')) + sorted(glob.glob(MAPS + '*.png'))
    big = []; src = []
    for f in files:
        c = cells(Image.open(f), 48); keep = [i for i in range(len(c)) if c[i][..., 3].any()]
        big.append(c[keep]); src += [(os.path.basename(f), int(i)) for i in keep]
    B = np.concatenate(big)
    flat = B.reshape(len(B), -1); _, ui = np.unique(flat, axis=0, return_index=True); ui = np.sort(ui)
    return B[ui], [src[i] for i in ui], len(files)

def best_match(Q, R, TQ):
    Dq = desc(Q, TQ); Dr = desc(R, TQ); rn = (Dr ** 2).sum(1)
    best = np.zeros(len(Q)); arg = np.zeros(len(Q), int); exact = 0
    for s in range(0, len(Q), 128):
        q = Dq[s:s + 128]
        d2 = (q ** 2).sum(1)[:, None] + rn[None] - 2 * q @ Dr.T
        top = np.argpartition(d2, min(64, len(R) - 1), axis=1)[:, :64]
        for i in range(len(q)):
            ss = sim(Q[s + i], R[top[i]]); j = int(ss.argmax())
            best[s + i] = ss[j]; arg[s + i] = top[i][j]
            if (Q[s + i] == R[top[i]]).all((1, 2, 3)).any(): exact += 1
    return best, arg, exact

def main():
    Q, qsrc = ours(); R48, rsrc, nf = refs()
    report = dict(ourCells=int(len(Q)), refCells48=int(len(R48)), refFiles=nf, threshold=0.95, tolerance=8, modes={})
    small = {}
    for mode in ('LANCZOS', 'NEAREST'):
        rs = getattr(Image.Resampling, mode)
        small[mode] = np.stack([np.array(Image.fromarray(c).resize((32, 32), rs)) for c in R48])
    Qbig = np.stack([np.array(Image.fromarray(c).resize((48, 48), Image.NEAREST)) for c in Q])
    for name, (A, B, T) in {'ref48to32_LANCZOS': (Q, small['LANCZOS'], 32), 'ref48to32_NEAREST': (Q, small['NEAREST'], 32),
                            'ours32to48_NEAREST': (Qbig, R48, 48)}.items():
        best, arg, exact = best_match(A, B, T)
        content = np.array([((q[..., 3] > 0) & (q[..., :3].max(-1) > 12)).mean() for q in Q])
        bc = best[content >= 0.5]
        top = [dict(ours=qsrc[i], ref=rsrc[arg[i]], similarity=round(float(best[i]), 4), content=round(float(content[i]), 2)) for i in np.argsort(-best)[:6]]
        report['modes'][name] = dict(exactMatches=int(exact), atLeast95=int((best >= .95).sum()), atLeast90=int((best >= .90).sum()),
                                     atLeast80=int((best >= .80).sum()), atLeast50=int((best >= .50).sum()),
                                     maxSimilarity=round(float(best.max()), 4),
                                     maxSimilarityContent50=round(float(bc.max()), 4), contentCells50=int(len(bc)), meanSimilarity=round(float(best.mean()), 4), mostSimilar=top)
    out = os.path.join(D, 'refmap-check.json')
    open(out, 'w').write(json.dumps(report, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({k: {x: v[x] for x in ('exactMatches', 'atLeast95', 'atLeast90', 'atLeast80', 'maxSimilarity', 'maxSimilarityContent50', 'meanSimilarity')} for k, v in report['modes'].items()}, ensure_ascii=False))
    print(report['ourCells'], report['refCells48'])

if __name__ == '__main__':
    main()
