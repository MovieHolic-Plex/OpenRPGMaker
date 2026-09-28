"""hero_flame_aura: 화염검 준비 — 시전자 몸을 감싸 솟는 불꽃과 불티 (user, 64px x 6). hero_flame_slash 와 같은 불 팔레트."""
import math

from lib_hero import FIRE, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "hero_flame_aura"
SIZE, FRAMES, PAL = 64, 6, FIRE
BASE = 58
XS = [13, 19, 25, 32, 39, 45, 51]
HEIGHT = [8, 20, 30, 34, 26, 14]


def tongues(c: Cell, f: int, scale: float, cols):
    for k, x in enumerate(XS):
        bell = 1 - abs(x - 32) / 26
        h = HEIGHT[f] * scale * (0.45 + 0.55 * bell) * (0.75 + 0.25 * math.sin(k * 1.9 + f * 2.3))
        lean = 3 * math.sin(k * 1.3 + f * 1.7)
        c.ramp(c.flame(x + math.sin(f + k) * 1.5, BASE, h, 4.5 - abs(x - 32) / 14, lean), cols)


def draw(c: Cell, f: int) -> None:
    if f == 0:  # sparks gather to the body
        radial(c, 32, 42, 22, 10, rot=15, size=1, cols=("d", "m", "l"))
    tongues(c, f, 1.0, ("r", "d", "m", "l"))
    tongues(c, f, 0.55, ("m", "l", "p", "w"))
    if 1 <= f <= 4:
        shock(c, 32, BASE - 1, 20 + f, 4, 1, ("d", "m", "l"))
    for i in range(10):
        x = 12 + (i * 23 + f * 3) % 40
        y = BASE - 8 - ((f * 9 + i * 13) % (18 + HEIGHT[f]))
        c.spark(x, y, 1 if (i + f) % 3 == 0 else 0, ("d", "l", "p"))
    if f == 5:
        c.thin(1, c.rect(0, 0, 63, BASE - 10))


if __name__ == "__main__":
    run([KEY])

