"""hero_dust: 돌진 흙먼지 — 발밑에서 뒤(오른쪽)로 차오르는 먼지 (user, 64px x 6). 수호자 돌격과 공유."""
import math

from lib_hero import DUST, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_dust"
import random

SIZE, FRAMES, PAL = 64, 6, DUST
FEET = 56
R = random.Random("hero_dust")
PUFFS = [(R.uniform(24, 36), R.uniform(10, 26), R.uniform(2, 9), R.uniform(3.5, 6.5)) for _ in range(7)]
PEBBLES = [(R.uniform(26, 36), R.uniform(14, 30), R.uniform(-30, -16)) for _ in range(6)]
SIZE_CURVE = [0.45, 0.8, 1.05, 1.15, 1.05, 0.8]


def draw(c: Cell, f: int) -> None:
    t = f / 5
    # speed streaks behind the runner on the first beats
    if f <= 2:
        for k, y in enumerate((FEET - 2, FEET - 7, FEET - 12)):
            x0 = 30 + f * 6 + k * 3
            c.put(c.line([(x0, y), (x0 + 12 - f * 3, y)]), "l" if k == 0 else "m", "over")
    for x0, vx, vy, r0 in sorted(PUFFS, key=lambda p: -p[1]):
        x = x0 + vx * t * 1.6
        y = FEET - 2 - vy * t * 1.4 - r0 * 0.3
        r = r0 * SIZE_CURVE[f]
        c.puff(x, y, r, ("k", "d", "m", "l"), "over")
        if f <= 2:
            c.puff(x - r * 0.6, y + r * 0.4, r * 0.5, ("d", "m", "l", "p"), "over")
    for x0, vx, vy in PEBBLES:
        x = x0 + vx * t
        y = FEET - 3 + vy * t + 46 * t * t
        if y < FEET:
            c.put(c.rect(x, y, x + 1, y + 1), "p", "over")
            c.put(c.rect(x + 1, y + 1, x + 1, y + 1), "d", "over")
    if f == 0:
        c.spark(28, FEET - 1, 2, ("l", "p", "w"), "over")
    if f >= 4:
        c.thin(f)
    if f == 5:
        c.thin(0, c.rect(0, 0, 63, FEET - 12))


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, R=4)


if __name__ == "__main__":
    run([KEY])

