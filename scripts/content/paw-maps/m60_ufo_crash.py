import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

import random
W, H = 32, 24
m = Map('m60_ufo_crash', 'UFO 불시착 황무지', W, H, 'exterior',
        '기복 있는 황무지에 UFO 가 빛기둥을 내리고, 모아이 석상 원형 배치, SF 원통 장치와 원형 기단, 자갈·이끼 지면, 돌 경계와 도랑(Ditch02).')
rnd = random.Random(60)
m.fill(0, 0, W, H, auto('SA-GroundY01.png'))
def blob(cx, cy, rx, ry):
    return [(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.25 * rnd.random()]
m.cells(blob(15, 13, 7, 5), auto('SA-Undulation01.png'))        # scorched impact crater
m.cells(blob(4, 4, 4, 3), auto('SA-Moss01.png'))
m.cells(blob(27, 19, 4, 3), auto('SA-Stone01.png'))
m.fill(0, 20, 10, 2, auto('SA-Ditch02.png')); m.fill(8, 22, 2, 2, auto('SA-Ditch02.png'))   # 2-wide irrigation ditch (frame 0)
m.fill(0, 18, 8, 2, auto('SA-StFence02.png'))                                                  # stone bank above it
# UFO hovering over the crater with its tractor beam
m.image('UFO-Light01.png', 13, 11, (0, 0, 96, 128))
m.chip('UFO01.png', 11, 6)
# moai ring around the crater (distinct colours/directions)
for i, (x, y) in enumerate(((6, 9), (24, 9), (6, 15), (24, 15), (10, 18), (20, 18))):
    m.rect('moai.png', i, 0 if i < 4 else 3, 1, 3, x, y)
# alien machinery: cylinder device and round bases
m.rect('sf.png', 3, 0, 3, 4, 26, 2)
m.rect('sf.png', 0, 4, 3, 2, 26, 7)
m.rect('sf.png', 0, 6, 3, 2, 2, 11)
# onlookers
m.image('SC-CTsunagi01.png', 18, 21, (32, 96, 64, 144)); m.image('PikoC-Girl01.png', 16, 21, (32, 96, 64, 144))
m.image('SC-Owl01.png', 3, 3, (32, 0, 64, 48))
m.save()
