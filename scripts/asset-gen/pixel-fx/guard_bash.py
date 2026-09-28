"""guard_bash: 방패 치기 — 오른쪽에서 들이받는 방패 실루엣, 충격 별, 머리 위 도는 기절 별 (target, 64px x 8)."""
import math

from lib_hero import SHIELD, Cell, dilate, erode, shift, radial, rays, shock, debris, run

KEY = "guard_bash"
SIZE, FRAMES, PAL = 64, 8, SHIELD
HIT = (30, 36)


def shield(c: Cell, cx, cy, s=1.0, dither=None):
    m = c.heater(cx, cy, 16 * s, 22 * s)
    if dither is not None:
        c.put(c.dith(dilate(m), dither), "m")
        return
    c.put(dilate(m), "k", "over")
    c.put(m, "d", "over")
    c.put(erode(m) & ~shift(erode(m), 2, 2), "l", "over")
    c.put(erode(m, 2) & shift(erode(m, 2), 2, 2), "m", "over")
    c.put(c.rect(cx - 1, cy - 11 * s + 3, cx + 1, cy + 7 * s), "o", "over")      # boss stripe
    c.put(c.rect(cx - 5 * s, cy - 3, cx + 5 * s, cy - 1), "o", "over")


def dizzy(c: Cell, f):
    for k in range(3):
        a = math.radians(f * 50 + k * 120)
        x, y = HIT[0] + math.cos(a) * 12, 14 + math.sin(a) * 4
        c.ramp(c.star5(x, y, 3), ("o", "y", "p"))


def draw(c: Cell, f: int) -> None:
    if f == 0:
        shield(c, 56, HIT[1], 0.9)
        for y in (28, 36, 44):
            c.put(c.line([(63, y), (60, y)]), "l")
    elif f == 1:
        shield(c, 44, HIT[1])
        for y in (26, 34, 42, 48):
            c.put(c.line([(63, y), (54, y)]), "l")
    elif f == 2:  # contact: squashed impact star behind the shield rim
        c.ramp(c.burst(*HIT, 20, 6, 7, rot=0), ("o", "y", "p", "w"))
        shield(c, 38, HIT[1])
    elif f == 3:  # peak
        c.ramp(c.burst(*HIT, 26, 9, 8, rot=22), ("d", "l", "p", "w"))
        c.ramp(c.disc(*HIT, 7), ("p", "w"))
        shock(c, *HIT, 20, 16, 2, ("m", "l", "w"))
        shield(c, 42, HIT[1])
    elif f == 4:
        c.ramp(c.burst(*HIT, 12, 5, 6, rot=10), ("o", "y", "p"))
        shock(c, *HIT, 26, 22, 1, ("d", "m"), dither=0)
        shield(c, 48, HIT[1], 0.95, dither=0)
        debris(c, "bash", 10, *HIT, 0.5, (26, 44), ang=(120, 240), size=2, cols=("m", "l", "w"))
    else:
        debris(c, "bash", 10, *HIT, 0.5 + (f - 4) * 0.3, (26, 44), ang=(120, 240), size=1 if f < 7 else 0, cols=("m", "l", "w"))
        dizzy(c, f)
        if f == 7:
            c.thin(1)


if __name__ == "__main__":
    run([KEY])

