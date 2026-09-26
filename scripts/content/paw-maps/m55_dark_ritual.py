import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 20, 16
m = Map('m55_dark_ritual', '흑마술 의식의 방', W, H, 'interior',
        '석재 바닥 의식실. 북벽 바포메트 그림, 중앙 완성 제단(BlackMagic01), 해부 표본 탁자(Organs), 점등 샹들리에·키 큰 촛대(BlackMagic02), 거미.')
room(m, 'SA-WallA02.png', 'SA-Wall01.png', 'SA-Floor-Stone01.png')
m.fill(6, 6, 8, 7, auto('SA-Carpet09.png'))                     # ritual carpet under the altar
m.chip('Bophomet.png', 8, 0)                                     # painting on the north wall
m.rect('BlackMagic01.png', 0, 0, 3, 3, 8, 6)                     # complete altar 1-1
m.rect('BlackMagic01.png', 1, 7, 2, 1, 9, 5)                     # horned skull ornament above altar
m.rect('BlackMagic02.png', 0, 0, 3, 3, 8, 3)                     # lit chandelier hanging above
for x in (6, 12):
    m.rect('BlackMagic02.png', 0, 6, 1, 2, x, 6)                 # tall candlesticks flanking the altar
m.rect('BlackMagic02.png', 1, 7, 1, 1, 7, 11); m.rect('BlackMagic02.png', 2, 7, 1, 1, 12, 11)   # small candles
# anatomy bench along the west wall
m.rect('BlackMagic01.png', 3, 0, 3, 3, 1, 3)                     # second altar/bench 1-2
for i, (sx, sy) in enumerate(((0, 0), (1, 1), (2, 2), (3, 3))):
    m.rect('Organs.png', sx, sy, 1, 1, 1 + i, 9)
m.rect('BlackMagic01.png', 3, 5, 3, 2, 1, 12)                    # dissected specimens row
m.rect('BlackMagic01.png', 0, 9, 6, 1, 13, 3)                    # altar utensils/symbols table set
m.rect('BlackMagic01.png', 0, 10, 2, 1, 16, 5)                  # skull stands
# spiders: big one lurking in the SE corner, small one on the floor
m.chip('SB-Spider01.png', 11, 10)
m.chip('SB-Spider04.png', 2, 13)
m.save()
