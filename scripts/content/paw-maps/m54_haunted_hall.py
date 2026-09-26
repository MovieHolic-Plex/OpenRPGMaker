import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 24, 18
m = Map('m54_haunted_hall', '폐저택 유령 홀', W, H, 'interior',
        '어두운 벽·목재 바닥 홀. 북쪽 거울 벽감(앱스)과 붉은 러너, 기울어진 샹들리에, 좌우 기둥, 핏자국, 해골, 망가진 곰인형, 버려진 축제 가판대(창고로 쓰인 홀).')
rows = ['########################',
        '#########......#########',
        '#########......#########',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#.....#..........#.....#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '#......................#',
        '####..............######',
        '####..............######',
        '####..............######',
        '###########DD###########']
WALL = auto('SA-Wall02.png')
m.layout(rows, {'.': auto('SA-FloorM01.png')}, auto('SA-WallA01.png'), [WALL, WALL])
m.fill(10, 3, 4, H - 4, auto('SA-Carpet08ST.png'))            # red runner from the door up into the apse
# apse: empty mirror frame against the back wall, tilted chandelier hanging over the runner
m.rect('BlackMagic02.png', 0, 3, 3, 3, 10, 1)
m.image('Chandelier.png', 10, 6, (0, 0, 96, 80))
m.image('SC-Candle01.png', 9, 1, (0, 0, 32, 64)); m.image('SC-Candle01.png', 14, 1, (0, 0, 32, 64))
# blood stains on the floor (pixel boxes from alpha components)
for (x, y, box) in ((5, 11, (0, 0, 34, 28)), (15, 12, (63, 37, 96, 59)), (12, 15, (0, 64, 32, 96)), (8, 7, (64, 64, 96, 96)), (17, 6, (64, 96, 96, 128))):
    m.image('Bloodstain01.png', x, y, box)
# skulls and bones
m.chip('skull02.png', 1, 11)                                   # heap against the west wall
m.rect('skull01.png', 0, 0, 1, 1, 6, 13); m.rect('skull01.png', 2, 1, 1, 1, 16, 15)
m.rect('Skull.png', 0, 0, 1, 1, 21, 9); m.rect('Skull.png', 1, 1, 1, 1, 5, 5)
# broken teddies slumped at the pillar feet
m.rect('horrorbear.png', 1, 1, 1, 1, 6, 11); m.rect('horrorbear.png', 0, 1, 1, 1, 17, 11)
# skull sofa and tall vase against the west wing wall
m.rect('sofa-skull.png', 1, 0, 3, 2, 2, 5)
m.image('sofa-skull.png', 1, 5, (0, 112, 32, 192))
# abandoned festival stalls pushed against the east wall
m.chip('demise02.png', 19, 5, 3, 0, 3, 3); m.chip('demise01.png', 19, 11, 0, 0, 3, 3)
# the ghost child in the apse and a skeleton by the door
m.image('PikoC-Girl01.png', 12, 9, (0, 0, 32, 48))
m.image('SC-Skeleton01.png', 7, 14, (0, 0, 32, 48))
m.save()
