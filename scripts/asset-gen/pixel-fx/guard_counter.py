"""guard_counter: 반격 태세 — 세운 검의 번뜩임, 붉은 눈빛 기세, 몸을 감싸는 날카로운 테두리 (user, 64px x 8)."""
import math

from lib_hero import COUNTER, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_counter"
SIZE, FRAMES, PAL = 64, 8, COUNTER
BX, G = 40, 58     # upright sword in front of the body (right hand side)


def blade(c: Cell, glint_y=None, hot=False):
    m = c.poly([(BX - 2, 10), (BX + 2, 10), (BX + 2, 40), (BX - 2, 40)]) | c.poly([(BX - 2, 10), (BX, 5), (BX + 2, 10)])
    c.put(dilate(m), "k", "over")
    c.put(m, "l" if hot else "m", "over")
    c.put(c.rect(BX - 1, 7, BX - 1, 39), "w", "over")
    c.put(c.rect(BX - 7, 40, BX + 7, 42), "d", "over")
    c.put(c.rect(BX - 7, 40, BX + 7, 40), "l", "over")
    c.put(c.rect(BX - 1, 43, BX + 1, 49), "r0", "over")
    if glint_y is not None:
        c.spark(BX, glint_y, 4, ("l", "w", "w"), "over")


def outline(c: Cell, grow, cols, dither=None):
    """Red fighting spirit: sharp flame shards rising around the 48px battler, spreading with 'grow'."""
    m = c.empty()
    for k, (x, h) in enumerate(((14, 24), (20, 36), (48, 34), (52, 22))):
        dx = (x - 32) / 16 * grow
        hh = h - grow * 2
        m |= c.poly([(x + dx - 2, G), (x + dx + (1 if k % 2 else -1) * 2, G - hh), (x + dx + 2, G)])
    if dither is not None:
        c.put(c.dith(dilate(m), dither), cols[0])
        return
    # hollow shards: solid dark rim, bright inner edge, dithered core so the battler stays readable
    c.put(dilate(m) & ~m, cols[0])
    c.put(m & ~erode(m), cols[-1])
    c.put(c.dith(erode(m), 0), cols[0])
    # thin red ground ring that ties the shards to the feet
    c.put(c.ring(32, G, 20 + grow, 3, 1), cols[0])


def draw(c: Cell, f: int) -> None:
    if f == 0:
        outline(c, 6, ("r0",), dither=0)
        blade(c)
    elif f == 1:
        outline(c, 3, ("r0", "r"))
        blade(c, glint_y=38)
    elif f == 2:
        outline(c, 1, ("r", "rl"))
        blade(c, glint_y=26)
    elif f == 3:  # the flash runs to the tip
        outline(c, 1, ("r", "rl"))
        blade(c, glint_y=12, hot=True)
        rays(c, BX, 8, 4, 3, 13, 2, rot=45, cols=("l", "w"))
    elif f == 4:  # peak: eye-glint and angular burst
        outline(c, 2, ("rl", "w"))
        blade(c, hot=True)
        c.ramp(c.burst(BX, 8, 12, 3, 4, rot=0), ("l", "w", "w"))
        c.ramp(c.poly([(24, 20), (30, 18), (28, 21)]), ("r", "rl"))   # sharp eye streak
    elif f == 5:
        outline(c, 4, ("r", "rl"))
        blade(c, glint_y=20)
        for k, y in enumerate((22, 34, 46)):
            c.put(c.line([(10 - k, y), (16, y - 4)], 1) | c.line([(54 + k, y), (48, y - 4)], 1), "r")
    elif f == 6:
        outline(c, 6, ("r0", "r"), dither=1)
        blade(c)
    else:
        outline(c, 8, ("r0",), dither=0)
        blade(c)
        c.thin(1, c.rect(0, 0, BX - 4, 63) | c.rect(BX + 4, 0, 63, 63))
        for k in range(5):
            c.spark(12 + k * 10, 20 + (k * 17) % 30, 1 if k % 2 else 0, ("r", "rl", "w"))


if __name__ == "__main__":
    run([KEY])

