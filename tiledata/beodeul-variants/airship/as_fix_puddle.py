# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-deck-puddle 가장자리를 둥글고 울퉁불퉁하게.
#   옛 판: as_blob.edge_taper(inset 3.0, jag 2.0, 잡음 주기 4) — 혹이 잘아 1~2px 톱니뿐이라 큰 윤곽은 곧은 변,
#          5×5 덩이가 네모(bad 0.461, 곧은 줄 67/80px).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(정원 연못 윤곽: 큰 혹+잔 혹, 칸 끝은 얕게 모여 오목 모서리 계단 1px,
#          볼록 모서리 반지름 7)에 같은 웅덩이 화가(젖은 널 테 · 북서 둑 그늘/남동 물빛 테 · 하늘 비친 반투명 물 · 잔물결 줄)를 칠한다.
#   as_blob.puddle_cell 이 이 함수를 부르므로 make_airship.py 를 다시 돌리면 지도·조각·check-autotile 이 같이 새 판이 된다.
#   덮어쓰는 파일: parts/autotile-deck-puddle.png 하나(이름 그대로).
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from autotile_edge import edge_fields


def puddle_fields(n, seed=1201, inset=3.0, jag=3.0, rad=7.0):
    """m(깊이) 와 side(가장 가까운 빈 쪽 'N'/'E'/'S'/'W', 속은 '') — as_blob.edge_taper 와 같은 꼴."""
    m, dN, dE, dS, dW = edge_fields(n, inset=inset, jag=jag, rad=rad, seed=seed)
    st = np.stack([dN, dE, dS, dW]); k = np.argmin(st, 0)
    side = np.array(['N', 'E', 'S', 'W'])[k]
    side = np.where(st.min(0) > 90, '', side)
    return m, side


def puddle_cell(n, seed=1201):
    import as_blob as B
    m, side = puddle_fields(n, seed)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -1.0:
                continue
            if v < 0:                                                  # 칸 밖: 드문 물방울 튄 자국(젖은 점)
                if B.hash2(x + n * 16, y, seed + 1) > 0.86: a[y, x] = B.WET + (90,)
                continue
            if v < 1.3:                                                # 젖어 짙어진 널 테(반투명 — 널 결이 비친다)
                a[y, x] = B.WET + (120 if v > 0.5 else 80,); continue
            if v < 2.1:                                                # 물가: 북·서 안쪽은 둑 그늘, 남·동 안쪽은 밝은 물빛 테
                c = B.PUD[0] if sd in ('N', 'W') else B.PUD[3]
                a[y, x] = c + (215,); continue
            c = B.PUD[1]; al = 175                                     # 속: 하늘이 비친 반투명 물(널 이음이 희미하게 비친다)
            rp = (y + int(round(math.sin(2 * math.pi * x / 16) * 1.2))) % 8   # 바람 잔물결(16 주기)
            if rp == 2 and B.hash2(x // 5, y, seed + 3) > 0.55: c = B.PUD[3]; al = 200
            if rp == 2 and x % 5 == 2 and B.hash2(x // 5, y, seed + 3) > 0.85: c = B.PUD[4]; al = 220   # 구름 비친 긴 물빛 줄
            a[y, x] = c + (al,)
    return B._img(a)


if __name__ == '__main__':
    import as_blob as B
    out = os.path.join(HERE, 'parts', 'autotile-deck-puddle.png')
    B.sheet16(puddle_cell).save(out); print('wrote', out)
