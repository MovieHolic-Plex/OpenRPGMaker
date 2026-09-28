"""guard_barrier: 철벽 — 아군마다 육각 격자 돔이 솟아 닫히고 반짝인 뒤 옅어진다 (allAllies, 64px x 10)."""
import math

from lib_hero import BARRIER, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_barrier"
SIZE, FRAMES, PAL = 64, 10, BARRIER
CX, G = 32, 58
RX, RY = 26, 36   # dome half-width / height above the feet


def dome(c: Cell, grow=1.0):
    """Upper half-ellipse mask whose visible top rises with 'grow'."""
    m = c.ellipse(CX, G, RX, RY) & c.rect(0, 0, 63, G)
    return m & c.rect(0, G - RY * grow - 1, 63, 63)


def paint(c: Cell, m, f, strong=True):
    edge = m & ~erode(m)
    grid = c.hexgrid(5, ox=CX, oy=G) & erode(m, 2)
    c.put(c.dith(erode(m, 2), f), "k")                         # faint fill
    c.put(grid, "d" if strong else "k")
    c.put(dilate(edge), "m")
    c.put(edge, "l")
    hl = c.arcband(CX, G, RX - 5, RY - 5, 205, 245, 3) & m    # glassy highlight upper left
    c.put(hl, "p")


def draw(c: Cell, f: int) -> None:
    base = c.ellipse(CX, G, RX + 2, 4) & ~c.ellipse(CX, G, RX - 3, 2)
    if f == 0:  # ground rune ring
        c.ramp(c.ring(CX, G, RX, 4, 1), ("d", "m", "l"))
        radial(c, CX, G, RX, 6, rot=f * 30, size=1, cols=("m", "l", "w"), sy=0.18)
        return
    c.ramp(c.ring(CX, G, RX, 4, 1), ("d", "m", "l"))
    if f <= 3:  # rising: the hex wall grows from the ground up
        grow = (0.3, 0.6, 0.9)[f - 1]
        paint(c, dome(c, grow), f)
        top = G - RY * grow
        c.put(c.line([(CX - RX * 0.9, top), (CX + RX * 0.9, top)]) & c.ellipse(CX, G, RX, RY), "w")
    elif f == 4:  # closes with a flash at the apex
        paint(c, dome(c), f)
        c.spark(CX, G - RY, 5, ("l", "p", "w"))
        rays(c, CX, G - RY, 6, 3, 10, 2, rot=-90, cols=("m", "l", "w"))
    elif f == 5:  # peak: bright shell
        m = dome(c)
        paint(c, m, f)
        c.put(dilate(m & ~erode(m)), "p")
        c.put(m & ~erode(m), "w")
    elif f <= 7:
        paint(c, dome(c), f, strong=f == 6)
        c.spark(CX + (-14 if f == 6 else 12), G - 24 + (f - 6) * 10, 3, ("l", "p", "w"))
    else:  # fading: dither away
        m = dome(c)
        paint(c, m, f, strong=False)
        c.thin(f)
        if f == 9:
            c.thin(0, c.rect(0, 0, 63, G - 12))
        radial(c, CX, G - 20, 20, 5, rot=f * 40, size=1, cols=("m", "l", "w"))


if __name__ == "__main__":
    run([KEY])

