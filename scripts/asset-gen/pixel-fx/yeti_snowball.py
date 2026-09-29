"""예티 눈덩이 투사체 32x4 — 첫 칸 왼쪽 진행. 굴러가는 눈덩이 + 오른쪽으로 끌리는 눈가루."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from lib_nm6 import make, lerp, ease, rng  # noqa: E402

PAL = [(40, 46, 74), (255, 255, 255), (222, 230, 244), (166, 180, 212), (150, 222, 255), (74, 150, 226)]
OL, W, S, SD, IC, ICD = 1, 2, 3, 4, 5, 6


def draw(c, f, t):
    x, y = 12, 16
    for i, L in enumerate((6, 9, 5)):
        yy = y - 3 + i * 3 + (f % 2)
        c.fill(c.seg(x + 6, yy, x + 6 + L - f % 3, yy, 1), IC if i != 1 else ICD)
    c.fill(c.disc(x, y, 6), S)
    c.fill(c.disc(x - 1.5, y - 1.5, 3.5), W)
    c.fill(c.disc(x + 2, y + 2.5, 3) & ~c.disc(x - 1, y - 1, 5.5), SD)
    a = math.radians(f * 90)
    for k in range(3):
        b = a + k * 2.1
        c.px(x + math.cos(b) * 3.5, y + math.sin(b) * 3.5, SD)
    c.outline(OL)
    for k in range(3):
        c.px(26 - f * 2 + k * 3, 8 + ((f + k) * 5) % 16, W)


make('yeti_snowball', 32, 4, 'projectile', PAL, draw)

