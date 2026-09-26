import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 24, 18
m = Map('m54_haunted_hall', '폐저택 유령 홀', W, H, 'interior',
        '어두운 벽·목재 바닥 홀에 붉은 러너, 기울어진 샹들리에, 핏자국, 해골, 망가진 곰인형, 버려진 축제 가판대(창고로 쓰인 홀).')
room(m, 'SA-WallA01.png', 'SA-Wall02.png', 'SA-FloorM01.png')
m.fill(10, 3, 4, H - 4, auto('SA-Carpet08ST.png'))            # central red runner from the door
# wall: portrait + candles; hanging chandelier over the runner
m.image('Chandelier.png', 10, 5, (0, 0, 96, 80))
m.image('SC-Candle01.png', 7, 1, (0, 0, 32, 64)); m.image('SC-Candle01.png', 16, 1, (0, 0, 32, 64))
m.rect('BlackMagic02.png', 0, 3, 3, 3, 10, 0)                 # empty mirror frame on the north wall
# blood stains on the floor (pixel boxes from alpha components)
for (x, y, box) in ((5, 8, (0, 0, 34, 28)), (15, 11, (63, 37, 96, 59)), (12, 14, (0, 64, 32, 96)), (7, 13, (64, 64, 96, 96)), (18, 6, (64, 96, 96, 128))):
    m.image('Bloodstain01.png', x, y, box)
# skulls and bones
m.chip('skull02.png', 1, 14)                                   # heap in the SW corner
m.rect('skull01.png', 0, 0, 1, 1, 6, 11); m.rect('skull01.png', 2, 1, 1, 1, 17, 14)
m.rect('Skull.png', 0, 0, 1, 1, 20, 9); m.rect('Skull.png', 1, 1, 1, 1, 4, 5)
# broken teddies on the side tables
m.rect('horrorbear.png', 1, 1, 1, 1, 3, 3); m.rect('horrorbear.png', 0, 1, 1, 1, 16, 4)
# skull sofa facing the fire-less hall, west wall
m.rect('sofa-skull.png', 1, 0, 3, 2, 2, 7)
m.image('sofa-skull.png', 1, 3, (0, 112, 32, 192))                # tall vase beside it
# abandoned festival stalls pushed against the east wall
m.chip('demise01.png', 18, 11, 0, 0, 3, 3); m.chip('demise02.png', 18, 3, 3, 0, 3, 3)
# the ghost child and a skeleton
m.image('PikoC-Girl01.png', 12, 9, (0, 0, 32, 48))
m.image('SC-Skeleton01.png', 8, 4, (0, 0, 32, 48))
m.save()
