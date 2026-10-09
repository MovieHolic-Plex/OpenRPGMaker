# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-mist 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판(gc_atiles.mist_sheet): 들여쓰기 1 + _pn1 진폭 3 을 칸마다 같은 꼴로 — 짙은 안개(알파 70) 경계가 곧아 5×5 덩이가 네모(bad 0.615),
#   이웃 쪽 변 일부가 비어 규약 위반 2.
#   새 판: 윤곽은 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7).
#   재질은 옛 판 그대로 — 푸르스름한 흰 안개(206,222,238) 반투명, 바깥으로 옅어지는 세 단(36 → 64 → 78)과 속의 옅은 얼룩(_pn1 두 겹).
#   얼룩은 속(깊이 4 이상)에서만 옅게 해 가장자리 윤곽이 끊기지 않는다. 걷기·이름 그대로.
#   덮어쓰는 파일: parts/autotile-mist.png 하나.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
from gc_kit import new, T, autotile_sheet
from gc_kit import _pn1
from autotile_edge import edge_fields

SEED = 31


def mist_sheet(seed=None, inset=1.8, jag=2.8, rad=7.0):
    seed = SEED if seed is None else seed

    def cell(mk, N, E, S, W):
        m = edge_fields(mk, inset, jag, rad, seed)[0]
        im = new(); p = im.load()
        for y in range(T):
            for x in range(T):
                e = m[y, x]
                if e < 0: continue
                a = 78 if e > 3.2 else (64 if e > 1.4 else 36)
                n = _pn1(x + y * 3, 25) * .5 + _pn1(y + x * 2, 26) * .5
                if e > 4 and n < .3: a -= 12                                      # 속 얼룩(가장자리는 그대로)
                p[x, y] = (206, 222, 238, a)
        return im
    return autotile_sheet(cell)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-mist.png')
    mist_sheet().save(out); print('wrote', out)
