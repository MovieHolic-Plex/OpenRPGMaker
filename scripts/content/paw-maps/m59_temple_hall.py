import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 22, 16
m = Map('m59_temple_hall', '석가여래 본당', W, H, 'interior',
        '다다미 본당. 북쪽으로 들어간 내진(앱스)의 목재 단 위 금불상 두 좌와 녹불상, 좌우 장식 항아리·촛불, 외진의 기둥 두 개, 동남 범종, 참배 돗자리.')
rows = ['#' * W] + \
       ['###' + '.' * 16 + '###'] * 2 + \
       ['#' + '.' * 20 + '#'] * 7 + \
       ['#' + '.' * 4 + '#' + '.' * 10 + '#' + '.' * 4 + '#'] + \
       ['#' + '.' * 20 + '#'] * 3 + \
       ['##' + '.' * 18 + '##'] + \
       ['#' * 10 + 'DD' + '#' * 10]
WALL = auto('SA-Wall02.png')
m.layout(rows, {'.': auto('SA-Goza01.png')}, auto('SA-WallD01.png'), [WALL, WALL])
m.fill(3, 3, 16, 4, auto('SA-Floor-T12.png'))               # altar platform filling the apse front
m.fill(8, 7, 6, 8, auto('SA-Carpet08.png'))                 # red worship aisle to the door
# three buddhas standing against the apse back wall (whole 3x4 figures)
m.image('syakanyorai.png', 9, 2, (0, 0, 96, 128))           # gold, centre
m.image('syakanyorai2.png', 4, 2, (0, 0, 96, 128))          # green, left
m.image('syakanyorai.png', 14, 2, (96, 0, 192, 128))        # gold variant, right
# ornamental jars and candles flanking the aisle at the platform edge
m.chip('tubo.png', 3, 8); m.chip('tubo.png', 17, 8)
m.image('SC-Candle03.png', 6, 7, (0, 0, 32, 64)); m.image('SC-Candle03.png', 15, 7, (0, 0, 32, 64))
# temple bell in the SE corner
m.chip('kane.png', 18, 12)
# worshippers on the aisle
m.image('SC-CTsunagi01.png', 10, 10, (32, 144, 64, 192)); m.image('PikoC-Girl01.png', 12, 11, (32, 144, 64, 192))
m.save()
