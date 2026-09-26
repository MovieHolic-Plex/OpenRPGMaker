import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 26, 16
m = Map('m61_event_hall', '할로윈·크리스마스 파티 홀', W, H, 'interior',
        '두 행사 홀을 반씩: 서쪽 할로윈(관·광대 인형·호박 러그), 동쪽 크리스마스(트리·선물·가랜드·케이크), 가운데 광대 긴 탁자 파티석.')
room(m, 'SA-WallA01.png', 'SA-Wall03.png', 'SA-FloorT04.png', face=2)
m.fill(2, 4, 8, 10, auto('SA-Carpet12.png'))               # halloween rug
m.fill(16, 4, 8, 10, auto('SA-Carpet02.png'))              # christmas rug
# west: coffins (closed/open), pierrot dolls and red chairs
m.rect('Halloween.png', 0, 0, 1, 2, 1, 3); m.rect('Halloween.png', 1, 0, 1, 2, 2, 3); m.rect('Halloween.png', 0, 2, 1, 2, 3, 3)
m.rect('pierrot2.png', 0, 0, 1, 2, 5, 3); m.rect('pierrot2.png', 1, 0, 1, 2, 6, 3); m.rect('pierrot2.png', 2, 0, 1, 2, 7, 3)
m.rect('pierrot2.png', 0, 3, 2, 2, 4, 9)                    # square table
m.rect('pierrot2.png', 4, 0, 1, 2, 2, 9); m.rect('pierrot2.png', 3, 0, 1, 2, 7, 9)   # chairs either side
m.image('SC-Candle01.png', 8, 1, (0, 0, 32, 64))
# centre: long party table with bags of presents on it
m.rect('pierrot2.png', 2, 2, 3, 3, 11, 6)
m.rect('present2.png', 0, 0, 1, 1, 11, 7); m.rect('present2.png', 2, 0, 1, 1, 13, 7)
# east: christmas tree, presents, cake and wall garlands
m.image('SC-ChristmasTree01.png', 20, 2, (0, 0, 96, 128))   # first 96x128 frame (whole tree)
m.chip('present.png', 17, 5); m.chip('present.png', 23, 11)
m.rect('present2.png', 1, 0, 1, 1, 19, 12)
m.rect('christmasdeco.png', 0, 2, 3, 1, 16, 1)              # garland + stockings on the wall
m.rect('christmasdeco.png', 0, 0, 1, 1, 12, 1); m.rect('christmasdeco.png', 2, 0, 1, 1, 13, 1)   # wreaths
m.rect('christmasdeco.png', 1, 1, 1, 1, 12, 7)              # cake on the long table
# guests
m.image('SC-Santa01.png', 18, 8, (0, 0, 32, 48)); m.image('PikoC-Teddy005.png', 14, 10, (0, 0, 32, 48))
m.image('SC-Skeleton01.png', 8, 11, (0, 0, 32, 48))
m.save()
