"""guard_fortress_wall: 요새 — 무대 바닥에서 거대한 방패벽이 솟아 금빛으로 빛나고 앞으로 쓰러져 짓누른다 (screen, 128px x 12)."""
import math

from lib_hero import FORT, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_fortress_wall"
SIZE, FRAMES, PAL = 128, 12, FORT
G = 112
XS = [16, 40, 64, 88, 112]
RISE = [0, 18, 46, 72, 80, 80, 80, 80, 80, 0, 0, 0]


def tower(c: Cell, x, h, lean=0.0, glow=False):
    """One tower shield (22px wide) whose top is h px above the ground; lean shears it forward (left)."""
    if h < 2:
        return
    top = G - h
    w = 11
    sh = lean * h
    pts = [(x - w - sh, top + 4), (x - sh, top), (x + w - sh, top + 4), (x + w, G), (x - w, G)]
    m = c.poly(pts)
    c.put(dilate(m), "k", "over")
    c.put(m, "d", "over")
    c.put(erode(m) & ~shift(erode(m), 3, 0), "l", "over")
    c.put(erode(m, 2) & shift(erode(m, 2), 3, 0), "m", "over")
    trim = m & ~erode(m, 2)
    c.put(trim & c.rect(0, top, 127, top + 6), "g" if glow else "gd", "over")
    boss_y = round(top + h * 0.4)
    c.ramp(c.disc(x - sh * 0.6, boss_y, 4), ("gd", "g", "y") if not glow else ("g", "y", "w"), mode="over")
    c.put(c.line([(x - sh * 0.8, top + 8), (x - sh * 0.1, G - 6)]) & erode(m, 2), "p" if glow else "l", "over")


def dirt(c: Cell, t, n=12):
    debris(c, "fortress_dirt", n, 64, G - 2, t, (50, 90), ang=(200, 340), grav=60, size=1, cols=("b0", "b1", "b2"), mode="over")


def draw(c: Cell, f: int) -> None:
    if f == 0:  # warning: gold seams glow along the floor
        for x in XS:
            c.ramp(c.rect(x - 11, G - 1, x + 11, G + 1), ("gd", "g", "y"))
            c.spark(x, G - 3, 2, ("g", "y", "w"))
        return
    if f <= 3:  # rising wall + dirt spray
        for i, x in enumerate(XS):
            tower(c, x, max(0, RISE[f] - abs(i - 2) * 6))
        c.ramp(c.rect(0, G, 127, G + 3), ("b0", "b1", "b2"), mode="over")
        dirt(c, f * 0.22)
        return
    if f == 4:  # glint runs across the complete wall
        for x in XS:
            tower(c, x, 80)
        c.spark(18 + 0 * 24, G - 64, 6, ("g", "y", "w"), "over")
        rays(c, 64, G - 88, 7, 6, 24, 4, rot=-90 - 60, cols=("gd", "g", "y"))
        return
    if f == 5:  # peak: gold radiance
        rays(c, 64, G - 40, 12, 34, 70, 6, rot=0, cols=("gd", "g", "y"))
        for x in XS:
            tower(c, x, 80, glow=True)
        return
    if f <= 7:  # topples forward
        lean = (0.18, 0.42)[f - 6]
        for x in XS:
            tower(c, x, 80 - (f - 5) * 12, lean)
        for x in (10, 34, 58, 82, 106):
            c.put(c.line([(x, 18 + f * 4), (x - 4, 32 + f * 4)]), "l")
        return
    if f == 8:  # slam: flat slab hits the floor, dust sheet
        c.ramp(c.rect(0, G - 10, 127, G), ("k", "d", "m", "l"), mode="over")
        c.put(c.rect(0, G - 10, 127, G - 9), "g", "over")
        shock(c, 64, G, 63, 10, 3, ("b0", "b1", "b2"))
        dirt(c, 0.3, 18)
        return
    for i, (x, r) in enumerate(((14, 9), (44, 11), (78, 12), (112, 10))):
        c.cloud(x, G - 6 - (f - 9) * 4, r + (f - 9) * 2, f"fw{i}", ("b0", "b1", "b2", "p"), floor=G + 2)
    dirt(c, 0.3 + (f - 8) * 0.25, 18)
    c.thin(f, c.rect(0, 0, 127, 127) if f >= 10 else c.rect(0, 0, 127, G - 18))
    if f == 11:  # last embers of gold settle on the floor seams
        for x in XS:
            c.put(c.dith(c.rect(x - 9, G - 1, x + 9, G), 0), "gd", "over")


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=8, B=8, L=8, R=8)


if __name__ == "__main__":
    run([KEY])

