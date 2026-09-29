"""monster6-4 바실리스크(class_basilisk, 마법) 15칸 — 볏 세우기·석화 시선·독니. 셀 48, motion breath."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import pp15_nm6 as L
from pp15_nm6 import F

STONE = ('eyeG', 'stone', 'stoneD')


def bite(cv, m):
    x, y = m['mouth']
    L.arc(cv, x - 1, y, 5, 120, 240, 'belly')
    L.spark(cv, x - 6, y, 2, 'eyeG')


def dust(cv, m):
    L.dots(cv, 0, -3, 14, 0, 6, 'bellyD', seed=5)


def hurt(cv, m):
    L.spark(cv, -12, -22, 2, 'crown', 'crest')
    L.xspark(cv, -15, -17, 1, 'crest')


def eye_ring(cv, m):
    x, y = m['eye']
    L.ring(cv, x, y, 3.5, 'eye')
    L.rays(cv, x, y, 5, 8, 8, 'eyeG')


def crown_glow(cv, m):
    x, y = m['eye']
    L.ring(cv, x + 1, y - 3, 7, 'eyeG')
    L.ring(cv, x + 1, y - 3, 10, 'crown')
    L.rays(cv, x + 1, y - 3, 11, 14, 10, 'eye')


def gaze(cv, m):
    """석화 시선: 눈에서 왼쪽으로 뻗는 초록 빛줄기 둘 + 끝에서 굳어 가는 돌 조각."""
    x, y = m['eye']
    L.line(cv, (x - 1, y), (x - 18, y - 3), 'eyeG')
    L.line(cv, (x - 1, y), (x - 18, y + 3), 'eyeG')
    L.line(cv, (x - 2, y), (x - 17, y), 'eye')
    for a, b, s_ in ((-14, -1, 2.2), (-18, 3, 1.8), (-17, -4, 1.5)):
        L.shard(cv, x + a, y + b, s_, 180, STONE)
    L.spark(cv, x, y, 2, 'eyeG', 'eye')


def poison(cv, m):
    x, y = m['mouth']
    L.ball(cv, x - 5, y + 1, 2, ('scL', 'sc', 'scD'))
    L.dots(cv, x - 10, y - 3, x - 2, y + 4, 4, 'scL', seed=9)


def jump_dust(cv, m):
    L.dots(cv, -4, 2, 12, 6, 8, 'bellyD', seed=13)


def crest_up(cv, m):
    L.rays(cv, -6, -18, 10, 14, 9, 'crest', 0.2)
    for a, b in ((-14, -24), (4, -26)):
        L.spark(cv, a, b, 1, 'crown')


def fin_back(cv, m):
    L.ring(cv, -4, -20, 12, 'crown', 1.4)
    L.ring(cv, -4, -20, 16, 'eyeG', 1.2)
    L.rays(cv, -4, -20, 17, 21, 12, 'eye', 0.1)


def fin_over(cv, m):
    x, y = m['eye']
    for d in (-6, -3, 0, 3, 6):
        L.line(cv, (x - 1, y), (x - 18, y + d), 'eyeG' if d % 2 else 'eye')
    for a, b, s_ in ((-13, -5, 2.4), (-16, 4, 2.8), (-18, -1, 2)):
        L.shard(cv, x + a, y + b, s_, 180, STONE)
    L.spark(cv, x, y, 3, 'eyeG', 'eye')
    for a, b in ((-20, -30), (10, -34)):
        L.spark(cv, a, b, 1, 'eye')


FRAMES = [
    F(),
    F(bob=1, tail=1),
    F(head=-1, tail=-1),
    F(head=1, lean=4, crouch=1, mouth=1, tail=1),
    F(step=-1, head=0, lean=-2, dx=-2, over=dust),
    F(head=1, lean=-4, mouth=2, dx=-2, over=bite),
    F(head=0, lean=-1, tail=1, crouch=1),
    F(head=-1, lean=5, eye=1, mouth=1, dx=2, over=hurt),
    F(eye=1, mouth=1, rot='flip'),
    F(head=-1, eye=2, crouch=1, over=eye_ring),
    F(head=-3, eye=2, mouth=1, tail=-1, back=crown_glow),
    F(head=-1, lean=-2, eye=2, over=gaze),
    F(step=1, dy=-8, tail=1, head=-2, lean=-2, over=jump_dust),
    F(head=-3, eye=2, mouth=2, tail=-1, back=crest_up, over=poison),
    F(head=-3, eye=2, mouth=2, tail=1, back=fin_back, over=fin_over),
]

if __name__ == '__main__':
    sys.exit(0 if L.build(4, 48, FRAMES) else 1)
