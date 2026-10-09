# kit_house v34-A — 3/4 재작도. k6_std.build() 를 그대로 쓰고 지붕(기와 비탈)만 위에서 본 판으로 바꾼다.
#  - 비탈: 행 중앙값이 같은 밝은 단(kawara 5) — 골은 1px 어두운 줄(주기 8), 세로 이음은 4px 마다 반 칸 엇갈림.
#  - 용마루: 윗 외곽선(어둡게) → 밝은 윗면 2줄 → 비탈로 이어지는 어두운 줄. 처마: 앞 모서리 밝은 선(막새) → 벽에 떨어지는 그늘.
#  - 벽: 창턱 = 윗면 밝은 1px + 앞면 + 벽에 진 그늘. 기초 = 윗면 밝은 턱 + 앞면.
# 실행: python3 v34_draw.py  →  ../v34-A.pxg
from k6_std import *

def kaw_hook(cl):
    def kaw(x, y):
        cy = y % 8
        if cy == 7: return cl('kawara', 4)                       # 가로 골(어두운 얇은 줄)
        joint = (x % 4 == 3) if cy < 4 else (x % 4 == 1)          # 엇갈린 세로 이음
        return cl('kawara', 4 if joint else 5)
    return kaw

S = dict(roof='kawara', wall='washi',
  row=[5, 5, 5, 5, 5, 5, 5, 4], col=[0, 0, 0, 0],
  ridge=[2, 6, 6, 4, 2], rim=[2, 6, 5, 3], mk=[6, 4, 4, 3, 2],
  eave=[1, 2, 3], top=[3, 4], lit=5, groove=3, base=4, corner=5, rdark=1,
  fd=[5, 4, 2],
  fr=[5, 3, 2, 6, 5], gl=[4, 3, 2, 5, 6], sill=[6, 3], fz=[4, 5], bar=2,
  rail=[6, 5, 3, 2, 4, 5],
  lin=[4, 3, 2], post=[3, 2], step=[5, 3, 2], pan=[3, 2], rail_d=[5, 3, 2], fd_=None,
  kaw=kaw_hook)
build(S)

# 창턱 밑 그늘: 창 부품(win_slide/win_small)의 창턱 바로 아래 1줄
for slug, y0, xs in (('win_slide', 28, range(16)), ('win_small', 23, range(3, 13))):
    p = P(slug)
    for x in xs: p.px(x, y0, cl('washi', 2))
export('v34-A.pxg', 'v34-A kit_house')
