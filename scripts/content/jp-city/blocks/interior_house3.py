#!/usr/bin/env python3
"""jp_city 블록 interior_house3 — 일본 2층 단독주택 보강 8종(유리 식기장·세면화장대·유닛 배스·현관 꽃병·허리벽·나무 기둥·화장실 선반·배식 창).
  python3 scripts/content/jp-city/blocks/interior_house3.py     # selftest + tiledata/jp-city/blocks/interior_house3/_all-x3.png
그림은 object-gen 으로 만든 고른 PNG(tiledata/jp-city/interior/house3/)를 칸에 그대로 놓는다 — 그림·기록·관문은 interior/house3_picks.py.
3/4 관문(object-gate, 출구 bundle)을 통과한 조각만 등록한다. 막힌 조각은 HELD 로 남고 굽히지 않는다(분류표에서도 빠진다)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, run_block, ROOT   # noqa: E402
import house3_picks as H3                    # noqa: E402

BLOCK = 'interior_house3'
R = Registry(BLOCK, '일본 집 보강(object-gen)')


def _png(id_):
    import numpy as np
    from PIL import Image
    return np.array(Image.open(H3.png_path(id_)).convert('RGBA'))


def _paste(id_):
    """고른 그림을 캔버스 왼아래에 그대로(캔버스 = 그림 크기)."""
    png = _png(id_)
    def f(c, *a):
        H, W = c.a.shape[:2]; h, w = png.shape[:2]
        assert (w, h) == (W, H), (id_, '그림 크기 %dx%d ≠ 칸 %dx%d' % (w, h, W, H))
        c.a[:] = png
    return f


def _register():
    ok = set(H3.passed())
    for id_, it in H3.ITEMS.items():
        if id_ not in ok: continue
        if it['reg'] == 'obj':
            R.obj(id_, it['ko'], w=it['w'], h=it.get('h', 1), up=it.get('up', 0), kind=it['kind'], hrows=it.get('hrows', 2),
                  use=it.get('use', ()), desc=it['desc'], tags=it.get('tags', ()), place=it.get('place', ''))(_paste(id_))
        elif it['reg'] == 'wall':
            R.wall(id_, it['ko'], cols=it['cols'], tags=it.get('tags', ()), desc=it['desc'])(_paste(id_))
        elif it['reg'] == 'good':
            R.good(id_, it['ko'], desc=it['desc'])(_paste(id_))


_register()
HELD = H3.held()


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    for k, v in HELD.items(): print('  보류', k, '—', v)
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
