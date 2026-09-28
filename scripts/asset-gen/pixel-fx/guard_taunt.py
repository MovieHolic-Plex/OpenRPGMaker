"""guard_taunt: 도발 — 몸에서 치솟는 붉은 기세, 머리 위 분노 표식과 느낌표 (user, 64px x 8)."""
import math

from lib_hero import TAUNT, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_taunt"
SIZE, FRAMES, PAL = 64, 8, TAUNT
BASE, HEAD = 58, 18
H = [6, 16, 26, 32, 30, 24, 16, 8]


def aura(c: Cell, f):
    for k, x in enumerate((14, 21, 28, 36, 43, 50)):
        bell = 1 - abs(x - 32) / 24
        h = H[f] * (0.5 + 0.5 * bell) * (0.8 + 0.2 * math.sin(k * 2 + f * 1.7))
        c.ramp(c.flame(x, BASE, h, 4, 2 * math.sin(k + f)), ("k", "d", "m", "l"))


def vein(c: Cell, x, y, s):
    """Classic cross-popping anger mark: four bent strokes."""
    m = c.empty()
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        m |= c.line([(x + dx * s, y + dy * 1), (x + dx * s, y + dy * s), (x + dx * 1, y + dy * s)], 2)
    c.ramp(m, ("d", "m", "l"), mode="over")


def bang(c: Cell, x, y, h):
    c.ramp(c.poly([(x - 2, y - h), (x + 2, y - h), (x + 1, y - 3), (x - 1, y - 3)]) | c.rect(x - 1, y - 1, x + 1, y + 1), ("k", "y", "w"), mode="over")


def draw(c: Cell, f: int) -> None:
    aura(c, f)
    if f in (2, 3, 4):
        shock(c, 32, BASE - 2, 16 + f * 3, 5 + f, 2 if f == 3 else 1, ("d", "m", "l") if f == 3 else ("d", "m"))
    if f >= 1:
        s = (2, 4, 5, 4, 4, 4, 3)[f - 1]
        vein(c, 42, HEAD - (1 if f % 2 else 0), s)
    if 2 <= f <= 6:
        bang(c, 22, HEAD + 2 - (f == 3), 9)
    if f == 3:  # peak pulse
        rays(c, 32, HEAD + 8, 8, 16, 28, 3, rot=f * 11, cols=("d", "m", "l"))
    for k in range(6):
        y = BASE - 6 - ((f * 7 + k * 11) % 40)
        c.spark(12 + k * 8, y, 1 if (k + f) % 2 else 0, ("d", "l", "p"))
    if f == 7:
        c.thin(0)


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=3, B=3)


if __name__ == "__main__":
    run([KEY])

