# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-pool·autotile-crack 가장자리를 둥글고 울퉁불퉁하게.
#   pool 옛 판(rc_base.pool_cell): _rag(진폭 2~3) 들여쓰기 + 볼록 모서리 반지름 6 — 변이 곧아 5×5 덩이가 네모(bad 0.56, 곧은 줄 62/80px).
#   pool 새 판: 윤곽만 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 바꾸고
#     재질은 옛 판 그대로 — 어두운 물 + 가로 잔물결(water_px), 북쪽 바위 둑 앞면 5줄(3/4), 남쪽 밝은 물가, 서쪽 밝음·동쪽 어두움.
#   crack 옛 판(rc_base.crack_cell): 잔돌만 흩어 덩이 윤곽이 없었다 — 이음매 튐 12px, 규약 위반 4.
#   crack 새 판: 같은 윤곽 안을 자갈 바닥 결(floor_gravel_fn, 주기 16)로 깔고 바깥 1px 은 한 단 어둡게(땅에 묻힌 테),
#     그 위에 옛 판 잔돌·짧은 금(15번 칸 그림)을 윤곽 안에서만 얹는다. 걷기·이름 그대로.
#   덮어쓰는 파일: parts/autotile-pool.png · parts/autotile-crack.png (이름 그대로 — 키트는 새 칸으로 갈아끼워진다).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
import rc_base as B
from rc_base import RK, WT, mix, new, autotile_sheet
from autotile_edge import edge_fields


def pool_cell(mk, N, E, S, W, seed=17):
    m, dN, dE, dS, dW = edge_fields(mk, inset=2.6, jag=2.8, rad=7.0, seed=seed)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            if m[y, x] < 0: continue
            n_, s_, w_, e_ = int(dN[y, x]), int(dS[y, x]), int(dW[y, x]), int(dE[y, x])
            c = B.water_px(x, y)
            if n_ < 5:                                                          # 둑 앞면 → 물에 닿는 어두운 띠
                c = (RK[4], RK[3], RK[2], WT[0], mix(c, WT[0], .5))[n_]
            if s_ < 3:
                c = (RK[5], WT[4], mix(c, WT[4], .4))[s_]
            if n_ >= 3:
                if w_ == 0: c = RK[4]
                elif w_ == 1: c = mix(c, WT[0], .4)
                if e_ == 0: c = RK[2]
                elif e_ == 1: c = mix(c, WT[0], .5)
            p[x, y] = tuple(int(v) for v in c[:3]) + (255,)
    return im


_GRAVEL = B.floor_gravel_fn(21, P=16)
_PEBBLES = None


def crack_cell(mk, N, E, S, W, seed=38):
    global _PEBBLES
    if _PEBBLES is None: _PEBBLES = B.crack_cell(15, True, True, True, True).load()      # 옛 판 속 칸 = 잔돌·금 전부
    m, dN, dE, dS, dW = edge_fields(mk, inset=2.4, jag=2.8, rad=7.0, seed=seed)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < 0: continue
            c = _GRAVEL(x, y)
            if c in RK: c = RK[min(5, RK.index(c) + 1)]                             # 자갈 결을 한 단 밝게(동굴 바닥 4단과 어울리게)
            q = _PEBBLES[x, y]
            if q[3] and v >= 1.0: c = q[:3]                                         # 잔돌·금은 윤곽 안에서만
            if v < 1.0:                                                             # 땅에 묻힌 바깥 테: 남·동은 그늘, 북·서는 한 단만
                k = RK.index(c) if c in RK else 3
                sh = 1 if min(dS[y, x], dE[y, x]) <= min(dN[y, x], dW[y, x]) else 0
                c = RK[max(1, k - sh)]
            p[x, y] = tuple(int(t) for t in c[:3]) + (255,)
    return im


def sheets(): return dict(pool=autotile_sheet(pool_cell), crack=autotile_sheet(crack_cell))


if __name__ == '__main__':
    for k, im in sheets().items():
        out = os.path.join(HERE, 'parts', 'autotile-%s.png' % k)
        im.save(out); print('wrote', out)
