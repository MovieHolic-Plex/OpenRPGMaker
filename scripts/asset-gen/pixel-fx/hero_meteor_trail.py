"""hero_meteor_trail: 낙하참 궤적 — 머리가 왼쪽인 불타는 혜성 루프 (projectile, 32px x 4). hero_meteor_impact 와 같은 팔레트."""
import math

from lib_hero import METEOR, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_meteor_trail"
SIZE, FRAMES, PAL = 32, 4, METEOR
HX, HY = 8, 17


def draw(c: Cell, f: int) -> None:
    wob = (0, 2, -1, 1)[f]
    # outer tail, flickering tongues behind the head
    c.ramp(c.poly([(HX, HY - 6), (HX, HY + 6), (31, HY + 1 + wob), (24, HY - 1)]), ("r", "d", "m"), rim=False)
    for k, (x, y, h) in enumerate(((20, HY - 5, 6), (26, HY + 4, 5), (14, HY + 6, 4))):
        yy = y + ((f + k) % 2) * 2 - 1
        c.ramp(c.poly([(x - 4, yy), (x + 4 + (f + k) % 3, yy - 1), (x - 1, yy + (2 if k % 2 else -2))]), ("d", "m"), rim=False)
    c.ramp(c.poly([(HX, HY - 3), (HX, HY + 3), (22, HY + wob // 2)]), ("m", "l", "p"), rim=False)
    c.ramp(c.disc(HX + 1, HY, 5), ("r", "d", "m", "l", "p", "w"))
    # sparks shed behind
    for k in range(3):
        x = 16 + ((f * 5 + k * 7) % 15)
        y = HY - 8 + ((k * 11 + f * 3) % 16)
        c.spark(x, y, 0, ("l", "l", "p"))
    c.put(c.rect(HX - 1, HY - 1, HX, HY), "w")


if __name__ == "__main__":
    run([KEY])

