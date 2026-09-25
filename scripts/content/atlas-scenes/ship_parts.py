"""Deck structures for vehicle_art ships: bowsprit, deckhouse (cabin with a door below), gun ports, stern lantern."""
from __future__ import annotations

from vehicle_art import Canvas, R_DEEP, R_HI, R_MID, R_DARK, R_WARM, BLACK, texture_tile

ROOF_LIGHT = (175, 142, 100)


def paint_bowsprit(c: Canvas, x_tip: int, y: int, length: int):
    """Spar sticking out forward (left) from the bow tip at (x_tip, y)."""
    for dx in range(0, length):
        x = x_tip - dx
        c.set(x, y - 2, R_DEEP)
        c.set(x, y - 1, R_HI)
        c.set(x, y, R_MID)
        c.set(x, y + 1, R_DARK)
        c.set(x, y + 2, R_DEEP)
    for dy in range(-3, 4):
        c.set(x_tip - length, y + dy, R_DEEP)
    # iron band + figurehead knob at the root
    for dy in range(-3, 4):
        c.set(x_tip - 2, y + dy, (120, 130, 136) if abs(dy) < 3 else (60, 66, 70))
        c.set(x_tip - 3, y + dy, (170, 182, 188) if abs(dy) < 3 else (60, 66, 70))


def paint_deckhouse(c: Canvas, x0: int, x1: int, y_roof: int, roof_h: int, wall_h: int, door_x: int | None,
                    windows=(), roof_tex=13):
    """A cabin on deck: plank roof (seen from above) with a rim, then its south wall with a door and windows."""
    tex = texture_tile(roof_tex)
    y_wall = y_roof + roof_h
    for y in range(y_roof, y_wall):
        for x in range(x0, x1):
            edge = x in (x0, x1 - 1) or y in (y_roof, y_wall - 1)
            rim = x in (x0 + 1, x1 - 2) or y == y_roof + 1
            c.set(x, y, R_DEEP if edge else (R_HI if rim and y == y_roof + 1 else (R_MID if rim else tex[y % 16][x % 16][:3])))
    for y in range(y_wall, y_wall + wall_h):
        for x in range(x0, x1):
            dy = y - y_wall
            if x in (x0, x1 - 1) or dy == wall_h - 1:
                col = BLACK if dy == wall_h - 1 else R_DEEP
            elif dy == 0:
                col = R_DEEP
            elif (x - x0) % 8 == 0:
                col = R_DEEP
            else:
                col = R_WARM if dy % 5 in (1, 2) else R_DARK
            c.set(x, y, col)
    for wx in windows:
        for y in range(y_wall + 3, y_wall + 8):
            for x in range(wx, wx + 6):
                edge = x in (wx, wx + 5) or y in (y_wall + 3, y_wall + 7)
                c.set(x, y, R_DEEP if edge else ((250, 214, 120) if y < y_wall + 5 else (214, 160, 70)))
    if door_x is not None:
        for y in range(y_wall + 1, y_wall + wall_h - 1):
            for x in range(door_x, door_x + 10):
                edge = x in (door_x, door_x + 9) or y == y_wall + 1
                c.set(x, y, R_DEEP if edge else ((34, 18, 8) if y > y_wall + 3 else (54, 30, 12)))
        # door frame highlight and step
        for x in range(door_x - 1, door_x + 11):
            c.set(x, y_wall + wall_h - 1, R_HI)


def paint_gunports(c: Canvas, xs, y: int, open_=True):
    """Square ports on the hull side face (y = top of the port)."""
    for x in xs:
        for dy in range(0, 7):
            for dx in range(0, 7):
                edge = dx in (0, 6) or dy in (0, 6)
                c.set(x + dx, y + dy, (40, 22, 8) if edge else ((10, 8, 8) if open_ else R_MID))
        if open_:
            # iron muzzle
            for dx in (2, 3, 4):
                c.set(x + dx, y + 3, (90, 100, 106))
                c.set(x + dx, y + 4, (60, 66, 70))
        # lid hanging above
        for dx in range(0, 7):
            c.set(x + dx, y - 2, R_HI)
            c.set(x + dx, y - 1, R_DARK)


def paint_gangway(c: Canvas, x: int, y0: int, y1: int):
    """Boarding plank from the deck edge down over the rail and hull side to the quay below (one tile wide)."""
    for y in range(y0, y1):
        for dx in range(1, 15):
            if dx in (1, 14):
                col = R_DEEP
            elif dx in (2, 13):
                col = (190, 160, 110) if (y // 3) % 2 else (150, 118, 80)
            else:
                k = (y - y0) % 5
                col = R_DEEP if k == 4 else (R_HI if k == 0 else R_MID)
            c.set(x + dx, y, col)


def paint_stern_lantern(c: Canvas, x: int, y: int):
    for dy in range(0, 8):
        for dx in range(-2, 3):
            edge = abs(dx) == 2 or dy in (0, 7)
            c.set(x + dx, y + dy, (40, 44, 48) if edge else ((255, 226, 120) if 2 <= dy <= 5 else (200, 150, 60)))
    c.set(x, y - 1, (40, 44, 48))
