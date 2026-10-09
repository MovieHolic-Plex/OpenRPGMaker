# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-claypan 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: ww_fix.edge_depth2(inset 2.0, jag 1.6) — 출렁임이 얕아 서·동 변이 곧았고(bad 0.511, 곧은 줄 72/80px),
#   남쪽 2px 앞면이 칸 밑줄까지 닿아 규약 위반 2.
#   새 판: 같은 화가(ww_fix.claypan_sheet: 크림 점토판·굽은 금·가장자리 짧은 금·북쪽 밝은 모·남쪽 2px 앞면)에
#   윤곽만 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7, 들여쓰기 3.2)로 바꿔 칠한다.
#   덮어쓰는 파일: parts/autotile-claypan.png 하나(이름 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import ww_fix as FX
from autotile_edge import edge_fields


def claypan_sheet(seed=37, inset=3.2, jag=3.0, rad=7.0):
    old = FX.edge_depth2
    FX.edge_depth2 = lambda n, inset_=0, jag_=0, rad_=0, seed=seed, **_: edge_fields(n, inset, jag, rad, seed)[0]
    try:
        return FX.claypan_sheet(seed=seed)
    finally:
        FX.edge_depth2 = old


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-claypan.png')
    claypan_sheet().save(out); print('wrote', out)
