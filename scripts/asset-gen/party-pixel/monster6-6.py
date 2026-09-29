"""monster6-6 키메라(class_chimera, 물리) 15칸 — 사자 이빨·염소 번개·뱀 독, 삼중 브레스. 셀 64(큰 몸), motion dash."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

FIRE = ('fireL', 'fire', 'fireD')
VENOM = ('snake', 'snake', 'snakeD')


def dust(cv, m):
    for a in (4, 9, 13):
        L.puff(cv, a, -1, 1.6, ('goatL', 'goat', 'horn'), ol=False)


def claw(cv, m):
    x, y = m['mouth']
    for d in (-3, 0, 3):
        L.line(cv, (x - 2, y - 5 + d), (x - 9, y + d), 'goatL')
    L.spark(cv, x - 9, y, 2, 'fireL')


def hurt(cv, m):
    L.spark(cv, -12, -24, 3, 'fireL', 'fireD')
    L.xspark(cv, -16, -18, 2, 'fire')


def charge3(cv, m):
    L.ball(cv, *[m['mouth'][0] - 2, m['mouth'][1]], 1.6, FIRE)
    x, y = m['goat']
    L.spark(cv, x, y - 4, 2, 'bolt', 'goatL')
    x, y = m['snake']
    L.ball(cv, x - 2, y, 1.4, VENOM)


def raise3(cv, m):
    x, y = m['mouth']
    L.ring(cv, x, y, 4, 'fire')
    x, y = m['goat']
    L.zigzag(cv, x, y - 3, x - 2, y - 14, 4, 1.5, 'bolt')
    x, y = m['snake']
    L.ring(cv, x, y, 3.5, 'snake')


def breath3(cv, m):
    x, y = m['mouth']
    L.cone(cv, x - 1, y, 16, 5, FIRE)
    x, y = m['goat']
    L.zigzag(cv, x - 1, y, x - 26, y + 2, 6, 2, 'bolt', seed=4)
    x, y = m['snake']
    L.beam(cv, x - 1, y, x - 12, y - 4, 2, VENOM)
    L.dots(cv, x - 16, y - 7, x - 8, y - 1, 4, 'snake', seed=6)


def pounce(cv, m):
    L.speed(cv, 10, -10, [8, 12, 8], 'goat', 3)


def roar(cv, m):
    x, y = m['mouth']
    for r, c in ((6, 'fireL'), (10, 'fire'), (14, 'fireD')):
        L.arc(cv, x, y, r, 130, 230, c)
    L.rays(cv, 0, -12, 17, 21, 10, 'fire', 0.2)


def fin_back(cv, m):
    for r, c in ((20, 'fireD'), (16, 'fire')):
        L.ring(cv, 0, -14, r, c, 1.4)
    L.rays(cv, 0, -14, 21, 25, 14, 'fireL', 0.1)


def fin_over(cv, m):
    x, y = m['mouth']
    L.cone(cv, x - 1, y, 20, 7, FIRE)
    L.disc(cv, x - 8, y, 2.5, 'fireL')
    gx, gy = m['goat']
    L.zigzag(cv, gx - 1, gy, gx - 28, gy - 4, 6, 2.5, 'bolt', seed=8)
    L.zigzag(cv, gx - 1, gy, gx - 24, gy + 6, 5, 2, 'goatL', seed=9)
    sx, sy = m['snake']
    L.beam(cv, sx - 1, sy, sx - 14, sy - 6, 2.5, VENOM)
    for a, b in ((-24, -34), (20, -36), (-2, -40)):
        L.spark(cv, a, b, 2, 'fireL', 'fire')


FRAMES = [
    F(),
    F(bob=1, snake=1),
    F(head=-1, snake=-1, goat=-1),
    F(crouch=1, lean=4, mouth=1, snake=1, goat=1),
    F(step=-1, lean=-3, dx=-2, snake=-1, over=dust),
    F(step=1, lean=-4, mouth=2, dx=-3, eye=2, over=claw),
    F(lean=-1, crouch=1, snake=1),
    F(lean=5, eye=1, mouth=1, dx=2, snake=2, goat=1, over=hurt),
    F(eye=1, mouth=1, rot='flip'),
    F(crouch=1, eye=2, mouth=1, snake=-1, over=charge3),
    F(head=-2, goat=-2, snake=-2, eye=2, mouth=2, over=raise3),
    F(lean=-2, eye=2, mouth=2, snake=0, over=breath3),
    F(step=1, dy=-8, lean=-3, mouth=1, over=pounce),
    F(head=-2, mouth=3, eye=2, goat=-1, snake=-2, over=roar),
    F(head=-2, mouth=3, eye=2, goat=-2, snake=-2, back=fin_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(6, 64, FRAMES) else 1)
