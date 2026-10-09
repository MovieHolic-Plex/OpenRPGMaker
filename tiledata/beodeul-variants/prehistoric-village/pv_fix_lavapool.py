# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-lavapool 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: wl.edge_depth(inset 0.8, jag 1.5) 윤곽 — 들여쓰기가 얕아 출렁임이 칸 끝에 눌려 서·동 변이 곧았다(bad 0.631, 곧은 줄 68/80px).
#   새 판: 같은 화가(pv_auto2.autotile_lavapool: 3x3 창 + vf_lava.paint, 검붉은 스코리아 둑)에 윤곽만 공용 깊이장
#   autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 6.5, 들여쓰기 2.2 — 1칸 폭 용암 틈에도 용암이 남게)로 바꿔 칠한다.
#   덮어쓰는 파일: parts/autotile-lavapool.png 하나(이름 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import pv_auto2 as A2
from autotile_edge import edge_fields


def autotile_lavapool():
    old = A2._edge_mask
    A2._edge_mask = lambda n, inset, jag, rad, seed: edge_fields(n, inset, jag, rad, seed)[0] >= 0
    try:
        return A2.autotile_lavapool(seed=83, inset=2.2, jag=2.2, rad=6.5)
    finally:
        A2._edge_mask = old


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-lavapool.png')
    autotile_lavapool().save(out); print('wrote', out)
