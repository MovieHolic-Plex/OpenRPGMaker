# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-pit 가장자리를 둥글고 울퉁불퉁하게(무너져 꺼진 바닥).
#   옛 판(ti_art3.pit_cell): 칸 전체를 불투명하게 칠하고 테를 칸 끝 2~3px 곧은 띠로 — 이어 붙이면 네모 구멍(bad 1.0, 규약 위반 32).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 6.5)로 윤곽을 잡고 윤곽 밖은 투명(밑 바닥이 보인다).
#   재질은 옛 판 그대로: 북쪽이 바닥이면 구덩이 안벽 앞면(탑 마름돌 face_px)이 윤곽을 따라 아래로 어둠에 잠기고,
#   남쪽은 바닥 턱(밝은 모서리), 서쪽 볼 밝음·동쪽 볼 그늘, 바닥은 짙은 어둠과 희미한 쇠 가시 끝.
#   덮어쓰는 파일: parts/autotile-pit.png 하나(이름 그대로 — 막힘 규칙·이름은 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import ti_art3 as A3
from ti_art3 import *                                  # noqa  (ST, IR, dlib, mix, new, _hash, autotile_sheet)
from ti_kit import _hash
from autotile_edge import edge_fields, tnoise1


def pit_cell(mk, N, E, S, W, seed=37):
    m, dN, dE, dS, dW = edge_fields(mk, inset=2.6, jag=2.6, rad=6.5, seed=seed)
    wallh = 9.0 + (tnoise1(16, 8, seed + 7) - 0.5) * 3.0       # 안벽 높이(주기 16)
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            if m[y, x] < 0: continue
            X = x + mk * 16
            c = dlib.VOID[0] if _hash(X, y, 701) < .8 else dlib.VOID[1]
            sx = (x + 3) % 6
            if m[y, x] >= 3 and 9 <= y <= 12 and sx in (2, 3) and y >= 12 - (1 if sx == 2 else 2): c = IR[2] if sx == 2 else IR[1]   # 가시 끝
            s_, e_, w_, n_ = dS[y, x], dE[y, x], dW[y, x], dN[y, x]
            side = min(s_, e_, w_)
            if n_ < 2.0 and n_ <= side:                                            # 북쪽 바닥 끝 모서리
                c = ST[5] if n_ < 1.0 else ST[4]
            elif side < 2.8:
                if s_ == side: c = ST[3] if s_ < 1.0 else (ST[4] if s_ < 2.0 else ST[5])   # 남쪽 바닥 턱(안쪽이 밝은 모서리)
                elif w_ == side: c = ST[4] if w_ < 1.0 else ST[2]                        # 서쪽 볼
                else: c = ST[3] if e_ < 1.0 else ST[1]                                    # 동쪽 볼(그늘)
            elif n_ < 2.0 + wallh[x]:                                                     # 안벽 앞면: 아래로 어둠에 잠긴다
                fy = int(n_ - 2.0)
                c = mix(dlib.face_px('tower', X + 4000, fy, 11, 3, False, False), dlib.VOID[0], min(.92, .15 + fy * .08))
            p[x, y] = tuple(c[:3]) + (255,)
    return im


def pit_sheet(): return autotile_sheet(pit_cell)


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-pit.png')
    pit_sheet().save(out); print('wrote', out)
