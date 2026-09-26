import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 22, 16
m = Map('m59_temple_hall', '석가여래 본당', W, H, 'interior',
        '다다미 본당. 북쪽 목재 단 위 금불상 두 좌와 녹불상, 좌우 장식 항아리, 동쪽 범종, 참배 돗자리, 촛불.')
room(m, 'SA-WallD01.png', 'SA-Wall02.png', 'SA-Goza01.png', face=2)
m.fill(3, 3, 16, 4, auto('SA-Floor-T12.png'))               # altar platform
m.fill(8, 7, 6, 7, auto('SA-Carpet08.png'))                 # red worship aisle
# three buddhas on the platform (whole 3x4 figures)
m.image('syakanyorai.png', 9, 2, (0, 0, 96, 128))           # gold, centre
m.image('syakanyorai2.png', 4, 2, (0, 0, 96, 128))          # green, left
m.image('syakanyorai.png', 14, 2, (96, 0, 192, 128))        # gold variant, right
# ornamental jars and candles flanking the aisle
m.chip('tubo.png', 3, 8); m.chip('tubo.png', 17, 8)
m.image('SC-Candle03.png', 6, 7, (0, 0, 32, 64)); m.image('SC-Candle03.png', 15, 7, (0, 0, 32, 64))
# temple bell in the SE, 
m.chip('kane.png', 18, 12)
# worshippers
m.image('SC-CTsunagi01.png', 10, 10, (32, 144, 64, 192)); m.image('PikoC-Girl01.png', 12, 11, (32, 144, 64, 192))
m.save()
