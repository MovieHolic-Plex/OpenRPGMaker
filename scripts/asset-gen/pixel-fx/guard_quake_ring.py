"""guard_quake_ring: 지진 충격파 — 무대 바닥을 따라 퍼지는 거대한 흙 고리와 갈라짐, 화면 흙먼지 (screen, 128px x 8)."""
import math

from lib_hero import EARTH, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_quake_ring"
SIZE, FRAMES, PAL = 128, 8, EARTH
CX, G = 64, 92   # the floor line sits a little below the centre when the sheet is drawn centred on stage
R = [8, 20, 34, 48, 58, 62, 63, 63]


def ring(c: Cell, rx, w, cols, dither=None):
    shock(c, CX, G, rx, max(3, rx * 0.26), w, cols, dither)


def cracks(c: Cell, reach, cols):
    m = c.empty()
    for k in range(8):
        a = math.radians(k * 45 + 22)
        pts = [(CX, G)]
        for j in range(1, 5):
            r = reach * j / 4
            jit = 3 * math.sin(k * 3 + j * 1.7)
            pts.append((CX + math.cos(a) * r + jit, G + math.sin(a) * r * 0.26 + jit * 0.3))
        m |= c.line(pts, 1)
    c.put(dilate(m), cols[0], "over")
    c.put(m, cols[1], "over")


def spray(c: Cell, rx, h, t):
    """Dirt kicked up just behind the travelling ring."""
    for k in range(10):
        a = math.radians(180 + k * 18 + 9)
        x = CX + math.cos(a) * rx
        y = G + math.sin(a) * rx * 0.26
        c.put(c.rect(x - 1, y - h - (k % 3) * 2, x, y - h + 1), "l", "over")
        c.put(c.rect(x - 1, y - h - (k % 3) * 2 - 2, x, y - h - (k % 3) * 2 - 1), "p", "over")
    debris(c, "quake_ring", 16, CX, G - 4, t, (40, 80), ang=(200, 340), grav=60, size=1, cols=("d", "m", "l"), mode="over")


def draw(c: Cell, f: int) -> None:
    r = R[f]
    if f == 0:
        c.ramp(c.ellipse(CX, G, 10, 4), ("k", "r", "o", "y"))
        rays(c, CX, G - 4, 5, 6, 26, 5, rot=-90, cols=("d", "m", "l"))
        return
    cracks(c, min(60, r + 6), ("k", "r") if f < 5 else ("k", "d"))
    if f <= 4:
        ring(c, r + 6, 3, ("d", "m", "l"), dither=0)
        ring(c, r, 5, ("k", "d", "m", "l", "p") if f != 3 else ("k", "m", "l", "p", "w"))
        spray(c, r, 5 + f, f * 0.2)
    else:
        ring(c, r, 3, ("d", "m"), dither=f)
        debris(c, "quake_ring", 16, CX, G - 4, f * 0.2, (40, 80), ang=(200, 340), grav=60, size=0, cols=("d", "m", "l"), mode="over")
        for i, (x, s) in enumerate(((20, 6), (46, 7), (82, 7), (108, 6))):
            c.cloud(x, G - 4 - (f - 5) * 2, s + (f - 5) * 1.5, f"qr{i}", ("k", "d", "m", "l"), floor=G + 6)
        c.thin(f, c.rect(0, 0, 127, 127) if f >= 6 else c.rect(0, 0, 127, G - 14))


# QA 2026-09-28: 칸 경계에서 직선으로 잘리던 가장자리를 디더로 걷는다(fx_edge.py). 그림 수식은 위 draw 그대로.
from fx_edge import fade_edges  # noqa: E402

_draw_body = draw


def draw(c, f):
    _draw_body(c, f)
    fade_edges(c, T=6, B=6, L=6, R=6)


if __name__ == "__main__":
    run([KEY])

