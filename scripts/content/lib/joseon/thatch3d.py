"""16px 초가 지붕: 둥근 어깨, 낮은 용마름, 세로 짚 다발, 두꺼운 처마 단.

몸채는 blocks.house의 독립 벽 블록을 쓴다. 이 모듈은 지붕만 생성한다.
색은 잠긴 램프에서 고르고 빛은 왼쪽 위. 외곽선은 assemble에서 inset 처리.
"""
import math
from tk import Cv, RGB, rnd

TONE = [RGB['earth'][1], RGB['wood'][3], RGB['earth'][4],
        RGB['persimmon'][3], RGB['earth'][5], RGB['persimmon'][5], RGB['straw'][5]]


def dome(W, H, seed=0, squash=1.0):
    cv = Cv(W, H)
    cx, rx = (W - 1) / 2, (W - 5) / 2
    for x in range(2, W - 2):
        u = (x - cx) / rx
        bend = 1 - math.sqrt(max(0, 1 - abs(u) ** 2.6))
        top = int(round(3 + 19 * bend))
        bottom = int(round(H - 2 - 14 * bend))
        bottom -= 1 if rnd(x // 2, 5, seed) < .17 else 0
        cap = 10 + int(3 * u*u) if abs(u) < .7 else top - 1
        roll = bottom - 8
        for y in range(top, bottom + 1):
            t = (y - top) / max(1, bottom - top)
            tone = 4.7 - t * 1.6 - u * 0.5 - abs(u) ** 3 * .6
            idx = int(round(tone))
            # 다발마다 시작점·길이가 다르고, 어깨에서는 끝이 바깥으로 휜다.
            bx = x // 3
            length = 4 + int(rnd(bx, 1, seed) * 4)
            offset = int(rnd(bx, 0, seed) * 11)
            run, phase = divmod(y + offset, length + 3)
            q = rnd(bx, run, seed + 3)
            strand = (x + int(u * t * 3)) % 3
            if phase < length and strand < 2:
                idx += 1 if q < .5 else (-1 if phase < 2 else 0)
            if y <= cap:
                idx = 5 if y < cap - 2 else 3
                if strand == 2 or phase > length: idx -= 1
                if y == cap and q < .3: idx = 4
            if y >= roll:
                if y == roll and q > .3: idx = 3
                else:
                    idx = 4 if y < roll + 4 else 3
                    if phase < length and strand < 2: idx += 1 if q < .5 else 0
            cv.put(x, y, TONE[max(1, min(6, idx))])
    return cv
