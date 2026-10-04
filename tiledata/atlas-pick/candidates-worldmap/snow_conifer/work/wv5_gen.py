"""snow_conifer wv5 — conifer 와 같은 모양(FIR_*)에 층 윗변마다 wsnow 눈. 같은 글자끼리 한 식구."""
import os, sys, importlib.util
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '..', 'forest', 'work'))
from wv5lib import *
spec = importlib.util.spec_from_file_location('conifer_gen', os.path.join(HERE0, '..', '..', 'conifer', 'work', 'wv5_gen.py'))
cg = importlib.util.module_from_spec(spec); spec.loader.exec_module(cg)
OUT = os.path.join(HERE0, '..')

def snowy(st, top=6, under=4, deep=False):
    """위가 비어 있는 화소(층 어깨·정수리) 에 눈. deep 이면 그 밑 한 줄에도 왼쪽 밝은 눈."""
    px = dict(st['px']); ax = st['anchor'][0]
    for (x, y), v in st['px'].items():
        if v[0] != 'wpine' or v[1] < 2: continue
        if (x, y - 1) in st['px']: continue
        px[(x, y)] = ('wsnow', top if x <= ax else top - 2)
        if (x, y + 1) in st['px'] and st['px'][(x, y + 1)][1] >= 3 and (x <= ax or deep):
            px[(x, y + 1)] = ('wsnow', under if x <= ax else under - 1)
    return dict(w=st['w'], h=st['h'], px=px, anchor=st['anchor'])

def trunkS(cv, x, y, xb, yb):
    cg.trunkF(cv, x, y, xb, yb)
    if cv.get(x + 4, y + 5) is None: cv.put(x + 4, y + 5, ('wleaf', 2))   # 줄기 사이 초록 한 점
ROWS = cg.ROWS
def mk(a, b, **kw): return [snowy(s, **kw) for s in (a, b)]
SA1, SA2 = mk(cg.FA1, cg.FA2)
SB1, SB2 = mk(cg.FB1, cg.FB2, top=6, under=5, deep=True)
SC1, SC2 = mk(cg.FC1, cg.FC2, top=6, under=5)
def pick4(a, b): return lambda xb, yb: {(4, 4): a, (12, 4): b, (0, 12): b, (8, 12): a}[(xb, yb)]

if __name__ == '__main__':
    build_bundle(OUT, 'A', ROWS, pick4(SA1, SA2), pick4(SA2, SA1), [(SA1, 4, 4), (SA2, 11, 5), (SA1, 8, 9)], trunkS, ('wsnow', 4),
        'snow_conifer A — conifer A 모양 + 층 윗변 눈', 'A: conifer A 와 같은 3층 세모, 층 어깨 1px 눈(왼쪽 밝음), 바닥은 옅은 눈, 줄기 사이 초록 점.')
    build_bundle(OUT, 'B', ROWS, pick4(SB1, SB2), pick4(SB2, SB1), [(SB1, 4, 4), (SB2, 11, 5), (SB1, 8, 9)], trunkS, ('wsnow', 3),
        'snow_conifer B — 깊이: 두툼한 눈 얹힘', 'B: conifer B 의 4층 키 큰 세모, 어깨마다 2px 눈, 바닥은 푸른 눈그늘.', y_max=84)
    build_bundle(OUT, 'C', ROWS, pick4(SC1, SC2), pick4(SC2, SC1), [(SC1, 4, 5), (SC2, 11, 6), (SC1, 8, 10)], trunkS, ('wsnow', 5),
        'snow_conifer C — 작은 전나무 눈모자', 'C: conifer C 의 2층 작은 전나무에 눈모자, 바닥은 밝은 눈.')
