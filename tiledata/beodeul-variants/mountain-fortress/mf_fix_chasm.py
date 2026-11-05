# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-chasm 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판(mf_ground.chasm_cell): 칸 전체를 불투명하게 칠하고 테를 칸 끝 2~4px 곧은 띠로 — 이어 붙이면 네모 구멍(bad 1.0, 규약 위반 32).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 윤곽을 잡고, 윤곽 밖은 투명(밑 땅이 보인다).
#   재질은 옛 판 그대로: 북쪽이 땅이면 맞은편 바위벽(cliff_px 산 바위 결)이 윤곽을 따라 아래로 어둠에 잠기고(3/4),
#   남쪽이 땅이면 가까운 쪽 턱(돌 램프 4·5 + 어두운 금), 서쪽 볼은 밝게·동쪽 볼은 그늘. 바닥은 어둠 + 옅은 안개 점.
#   덮어쓰는 파일: parts/autotile-chasm.png 하나(이름 그대로 — 막힘 규칙·이름은 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
import mf_ground as G
from mfwl import hash2, tnoise1, sheet_from_cells
from roman import ST, mul
from autotile_edge import edge_fields

DK = [(10, 12, 18), (16, 19, 26), (24, 28, 36), (34, 39, 48)]
RW = 2.0                                   # 남·동·서 테(깎인 돌 턱) 폭


def chasm_cell(n, seed=23):
    m, dN, dE, dS, dW = edge_fields(n, inset=2.6, jag=2.8, rad=7.0, seed=seed)
    hasN = bool(n & 1)
    wallh = 8.0 + (tnoise1(16, 8, seed + 7) - 0.5) * 3.0          # 맞은편 벽 높이(주기 16 — 이웃 칸과 이어진다)
    o = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            if m[y, x] < 0: continue
            c = DK[0] if hasN else DK[1]
            if (x * 7 + y * 13) % 23 == 0 and hash2(x, y, seed) > 0.5: c = DK[2]          # 안개 점
            s_, e_, w_, n_ = dS[y, x], dE[y, x], dW[y, x], dN[y, x]
            side = min(s_, e_, w_)
            if n_ < 2.0 and n_ <= side:                                                    # 맞은편(북쪽) 땅 끝 모서리
                c = ST[5] if n_ < 1.0 else ST[3]
            elif side < RW + 0.8:
                if s_ == side:                                                              # 가까운 쪽 턱: 바깥 돌 → 밝은 모 → 어두운 금
                    c = ST[4] if s_ < 1.0 else (ST[5] if s_ < 2.0 else ST[1])
                elif w_ == side:                                                            # 서쪽 볼(빛)
                    c = ST[5] if w_ < 1.0 else (ST[4] if w_ < 2.0 else ST[2])
                else:                                                                       # 동쪽 볼(그늘)
                    c = ST[2] if e_ < 1.0 else (ST[3] if e_ < 2.0 else ST[1])
            elif n_ < 2.0 + wallh[x]:                                                       # 맞은편 바위벽: 아래로 어둠에 잠긴다
                fy = n_ - 2.0
                cc = G.cliff_px(x + 100, y, int(fy) + 4, 40, 6, 0, seed)
                c = mul(cc, 1.0 - 0.75 * (fy / wallh[x]) ** 1.4)
            o[y, x, :3] = tuple(int(v) for v in c[:3]); o[y, x, 3] = 255
    return Image.fromarray(o, 'RGBA')


def autotile_chasm(): return sheet_from_cells([chasm_cell(n) for n in range(16)])


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-chasm.png')
    autotile_chasm().save(out); print('wrote', out)
