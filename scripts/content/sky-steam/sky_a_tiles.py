"""줄 A 하늘섬 — 오토타일(구름 바다 평면·섬 풀 윗면·섬 가장자리 절벽 앞면) + 애니메이션 프레임.
terrain = 평면 바닥/절벽 면 타일 묶음(칸 하나씩 export). 절벽 앞면은 상단에 풀 가장자리 3줄(밝은 윗면 띠) + 아래 바위."""
from __future__ import annotations
from sky_a_lib import *
import math


def _wrap_noise(x, y, s, per=16):
    return hn(x % per, y % per, s)


@piece('sky-a-cloud-sea', '구름 바다 바닥', 4, 1, 'terrain', 'A', tags=['autotile', 'cloud'])
def _(c):                                                      # 이어 붙는 4변형(16 주기 잡음, 가장자리 투명 없음)
    for v in range(4):
        for y in range(16):
            for x in range(16):
                r = _wrap_noise(x, y, v * 7 + 1); r2 = _wrap_noise(x // 2, y // 2, v * 5 + 9, 8)
                t = 1 + (1 if r2 > .62 else 0) + (1 if r > .93 else 0) - (1 if r2 < .25 else 0) - (1 if r < .05 else 0)
                c.P(v * 16 + x, y, K('cloud', t))


@piece('sky-a-grass-top', '섬 풀 윗면', 4, 1, 'terrain', 'A', tags=['autotile', 'grass'])
def _(c):
    for v in range(4):
        for y in range(16):
            for x in range(16):
                r = _wrap_noise(x, y, v * 3 + 2); r2 = _wrap_noise(x // 3, y // 2, v + 4, 6)
                t = 1 + (1 if r2 > .6 else 0) + (1 if r > .9 else 0) - (1 if r < .08 else 0)
                c.P(v * 16 + x, y, K('grass', t))
                if r > .96: c.P(v * 16 + x, y, K('cloud', 3))


def _cliff(c, x0, kind):
    """kind: mid|left|right — 위 6줄 풀 윗면 띠(앞 가장자리 어두운 입술), 아래 10줄 지층 바위 앞면."""
    for y in range(16):
        for x in range(16):
            gx = x0 + x
            if y < 6:
                r = _wrap_noise(x, y, 3); t = 1 + (1 if y < 3 else 0) + (1 if r > .9 else 0) - (1 if y == 5 else 0) * 3
                c.P(gx, y, K('grass', t))
            else:
                r = _wrap_noise(x, y, 9); t = 0 - (y - 6) // 4 - (1 if (x + (y // 5) * 3) % 7 == 0 else 0) - (1 if y % 5 == 0 else 0) + (1 if r > .9 else 0)
                c.P(gx, y, K('rock', t))
    if kind == 'left':
        for y in range(16): c.P(x0, y, K('rock', -4)); c.P(x0 + 1, y, K('rock', -3) if y > 5 else K('grass', -2))
    if kind == 'right':
        for y in range(16): c.P(x0 + 15, y, K('rock', -4)); c.P(x0 + 14, y, K('rock', -3) if y > 5 else K('grass', -2))


@piece('sky-a-island-edge', '섬 가장자리 절벽 앞면', 3, 1, 'terrain', 'A', tags=['autotile', 'cliff'])
def _(c):
    _cliff(c, 0, 'left'); _cliff(c, 16, 'mid'); _cliff(c, 32, 'right')


@piece('sky-a-cloud-edge', '구름 바다 가장자리', 3, 1, 'terrain', 'A', tags=['autotile', 'cloud'])
def _(c):                                                      # 위 8줄은 하늘로 투명한 솜털 윤곽, 아래는 구름 바닥
    for v in range(3):
        for x in range(16):
            top = 5 + int(3 * hn((v * 16 + x) // 2, 2, 5))
            for y in range(top, 16):
                r = _wrap_noise(x, y, v + 3); t = 1 + (1 if y < top + 2 else 0) + (1 if r > .93 else 0) - (1 if y > 13 else 0)
                c.P(v * 16 + x, y, K('cloud', t))


# ── 애니메이션: 프레임별로 export 되어 모든 프레임이 통과해야 한다
if __name__ == '__main__': run_cli('A')
