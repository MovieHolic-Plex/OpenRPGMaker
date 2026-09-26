import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 20, 16
m = Map('m55_dark_ritual', '흑마술 의식의 방', W, H, 'interior',
        '석재 바닥 의식실. 북쪽 앱스에 바포메트 그림, 중앙 완성 제단(BlackMagic01), 서쪽 벽감의 해부 표본 탁자(Organs), 점등 샹들리에·키 큰 촛대(BlackMagic02), 거미.')
rows = ['####################',
        '#######......#######',
        '#######......#######',
        '###..............###',
        '###..............###',
        '#.................##',
        '#.................##',
        '#.................##',
        '#.................##',
        '#....#............##',
        '#....#.............#',
        '#....#.............#',
        '#....#.............#',
        '##.................#',
        '###...............##',
        '#########DD#########']
WALL = auto('SA-Wall01.png')
m.layout(rows, {'.': auto('SA-Floor-Stone01.png')}, auto('SA-WallA02.png'), [WALL, WALL])
m.fill(6, 6, 8, 7, auto('SA-Carpet09.png'))                     # ritual carpet under the altar
m.chip('Bophomet.png', 8, 1)                                     # painting on the apse wall
m.rect('BlackMagic02.png', 0, 0, 3, 3, 8, 3)                     # lit chandelier hanging in the apse
m.rect('BlackMagic01.png', 1, 7, 2, 1, 9, 6)                     # horned skull ornament at the altar head
m.rect('BlackMagic01.png', 0, 0, 3, 3, 8, 7)                     # complete altar 1-1
for x in (6, 12):
    m.rect('BlackMagic02.png', 0, 6, 1, 2, x, 7)                 # tall candlesticks flanking the altar
m.rect('BlackMagic02.png', 1, 7, 1, 1, 7, 11); m.rect('BlackMagic02.png', 2, 7, 1, 1, 12, 11)   # small candles
# anatomy corner: second altar/bench and organ jars in the west alcove behind the half wall
m.rect('BlackMagic01.png', 3, 0, 3, 3, 1, 7)
for i, (sx, sy) in enumerate(((0, 0), (1, 1), (2, 2), (3, 3))):
    m.rect('Organs.png', sx, sy, 1, 1, 1 + i, 11)
m.rect('BlackMagic01.png', 3, 5, 3, 2, 6, 13)                    # dissected specimens row
# utensils/symbols table set along the NE wall, skull stands below it
m.rect('BlackMagic01.png', 0, 9, 6, 1, 11, 5)
m.rect('BlackMagic01.png', 0, 10, 2, 1, 16, 7)
# spiders (first frame of each sprite sheet): big one lurking in the SE corner, small one near the alcove
m.chip('SB-Spider01.png', 15, 11, 0, 0, 2, 2)
m.image('SB-Spider04.png', 3, 13, (0, 0, 32, 40))
m.save()
