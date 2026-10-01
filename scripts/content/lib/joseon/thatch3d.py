"""바람의나라 초가 연구형: 위아래가 모두 둥근 납작한 방석 지붕. 세로로 일어난 짚결, 허리의 가로 띠, 둘레 불규칙한 털.

연구 요점(harness/BARAM_STUDY.md): 사다리꼴 금지. 초가는 슈퍼타원 방석, 색은 붉은 주황(어두운 갈색 → 주황 → 연한 황갈),
짚결은 세로로 일어난 짧은 획이고 끝이 곡선으로 휜다. 아래쪽 한 단 불룩한 띠가 있고 그 아래는 그늘(디더).
"""
import math
from tk import *

_A = [(69, 42, 23), (99, 55, 18), (136, 90, 38), (162, 110, 54), (194, 117, 54), (198, 146, 80), (220, 170, 76)]
TONE = [c for c in _A]


def dome(W, H, seed=0, squash=1.0):
    cv = Cv(W, H)
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0 + 1
    rx, ry = W / 2.0 - 1, H / 2.0 - 1
    off = [int(rnd(x, 1, seed + 2) * 6) for x in range(W)]
    ln = [3 + int(rnd(x, 2, seed + 3) * 5) for x in range(W)]
    for y in range(H):
        for x in range(W):
            u = (x - cx) / rx
            v = (y - cy) / ry
            e = abs(u) ** 2.7 + abs(v) ** 2.3
            wob = (rnd(x, y, seed + 11) - 0.5) * 0.10
            if e > 1 + wob:
                continue
            # 빛: 왼쪽 위 — 연속값을 2×2 순서 디더로 끊어 띠(줄무늬)가 생기지 않게 한다
            lit = -(u * 0.5 + v * 0.7)
            f = 3.2 + lit * 2.6
            bayer = ((x % 2) * 2 + (y % 2) * 3) % 4 / 4.0 - 0.375
            base = int(round(f + bayer * 0.9))
            # 세로로 일어난 짚결
            run = (y + off[x]) // ln[x]
            j = rnd(x, run, seed + 5)
            if j < 0.20:
                base += 1
            elif j > 0.80:
                base -= 1
            # 둘레 불룩한 단: 윤곽(등고선)을 따라 도는 호. 바깥 호는 어두운 홈+밝은 둔덕, 안쪽 위 호는 얕게
            if 0.76 <= e < 0.84 and v > -0.05:                    # 아래쪽 둘레 홈: 체크 디더로 부드럽게
                if (x + y) % 2 == 0 or e < 0.79:
                    base = min(base, 1)
            elif 0.70 <= e < 0.76 and v > 0.0 and (x + y) % 2 == 0:
                base = min(base, 2)
            elif 0.40 <= e < 0.45 and v < 0.0 and (x % 3 != 0):
                base = min(base, 2)                                # 위쪽 얕은 주름
            if v > 0.70 and (x + y) % 2 == 0:
                base -= 1                                   # 아래 그늘 디더
            if e > 0.92:
                base -= 1                                   # 가장자리 털
            cv.put(x, y, TONE[max(0, min(6, base))])
    return cv
