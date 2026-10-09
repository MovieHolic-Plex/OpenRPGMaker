# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-frozenlake 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: wl.edge_depth(inset 1.6, jag 1.4) — 들여쓰기·출렁임이 얕아 5×5 호수가 네모(bad 0.575, 곧은 줄 68/80px).
#   새 판: 같은 화가(ice_terrain._terrain_cell: paint_lake 짙은 얼음 결 + 바깥 1px 어두운 윤곽 + 안쪽 밝은 입술)에
#   윤곽만 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 바꿔 칠한다.
#   덮어쓰는 파일: parts/autotile-frozenlake.png 하나(이름 그대로 — 키트는 새 칸으로 갈아끼워진다).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import ice_terrain as IT
from autotile_edge import edge_fields

SEED = 17


def autotile_frozenlake(seed=SEED, inset=2.6, jag=2.8, rad=7.0):
    old = IT.edge_depth
    IT.edge_depth = lambda n, inset, jag, rad, seed: (edge_fields(n, inset, jag, rad, seed)[0], None)
    try:
        return IT._sheet_by(lambda n: IT._terrain_cell(n, lambda X, Y: IT.paint_lake(X, Y, 5, cracks=False), seed, inset, jag, rad, 'deepice', (0, 5)))
    finally:
        IT.edge_depth = old


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-frozenlake.png')
    autotile_frozenlake().save(out); print('wrote', out)
