import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 26, 16
m = Map('m61_event_hall', '할로윈·크리스마스 파티 홀', W, H, 'interior',
        '두 행사 홀을 반씩: 서쪽 할로윈(관·광대 인형·호박 러그), 동쪽 크리스마스(트리·선물·가랜드·케이크), 북벽 두 기둥벽 사이 가운데 광대 긴 탁자 파티석, 남쪽 두 모서리 따냄.')
rows = ['#' * W] + ['#' + '.' * 24 + '#'] * 2 + \
       ['#' + '.' * 9 + '#' + '.' * 4 + '#' + '.' * 9 + '#'] + \
       ['#' + '.' * 24 + '#'] * 9 + \
       ['####' + '.' * 18 + '####'] * 2 + \
       ['#' * 12 + 'DD' + '#' * 12]
WALL = auto('SA-Wall03.png')
m.layout(rows, {'.': auto('SA-FloorT04.png')}, auto('SA-WallA01.png'), [WALL, WALL])
m.fill(2, 4, 7, 9, auto('SA-Carpet12.png'))                # halloween rug
m.fill(17, 4, 7, 9, auto('SA-Carpet02.png'))               # christmas rug
# west: coffins (closed/open), pierrot dolls and red chairs
m.rect('Halloween.png', 0, 0, 1, 2, 1, 3); m.rect('Halloween.png', 1, 0, 1, 2, 2, 3); m.rect('Halloween.png', 0, 2, 1, 2, 3, 3)
m.rect('pierrot2.png', 0, 0, 1, 2, 5, 3); m.rect('pierrot2.png', 1, 0, 1, 2, 6, 3); m.rect('pierrot2.png', 2, 0, 1, 2, 7, 3)
m.rect('pierrot2.png', 0, 3, 2, 2, 4, 8)                    # square table
m.rect('pierrot2.png', 4, 0, 1, 2, 3, 8); m.rect('pierrot2.png', 3, 0, 1, 2, 6, 8)   # chairs either side
m.image('SC-Candle01.png', 8, 1, (0, 0, 32, 64))
# centre, between the two wall piers: long party table with presents and the cake
m.rect('pierrot2.png', 2, 2, 3, 3, 11, 5)
m.rect('present2.png', 0, 0, 1, 1, 11, 6); m.rect('present2.png', 2, 0, 1, 1, 13, 6)
m.rect('christmasdeco.png', 1, 1, 1, 1, 12, 6)              # cake on the long table
m.rect('christmasdeco.png', 0, 0, 1, 1, 12, 1); m.rect('christmasdeco.png', 2, 0, 1, 1, 13, 1)   # wreaths above the table
# east: christmas tree, presents and wall garlands
m.image('SC-ChristmasTree01.png', 20, 3, (0, 0, 96, 128))   # first 96x128 frame (whole tree)
m.chip('present.png', 17, 4); m.chip('present.png', 21, 11)
m.rect('present2.png', 1, 0, 1, 1, 18, 11)
m.rect('christmasdeco.png', 0, 2, 3, 1, 16, 1)              # garland + stockings on the wall
# guests
m.image('SC-Santa01.png', 18, 8, (0, 0, 32, 48)); m.image('PikoC-Teddy005.png', 14, 10, (0, 0, 32, 48))
m.over.append((8 * 32 - 16, 10 * 32, sheet('SC-Skeleton01.png').crop((0, 0, 64, 96)))); m.used.add('SC-Skeleton01.png')   # whole first frame
m.save()
