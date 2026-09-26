import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 24, 16
m = Map('m58_samurai_hall', '천수각 무사의 대청', W, H, 'interior',
        '어두운 목재 대청. 북쪽으로 들어간 상단 단상(앱스)에 병풍 두 폭과 칼 꽂힌 바위, 좌우 벽 갑옷 전시, 기둥 두 개, 성 모형 두 점(oshiro 흰 성·oshiromv 검은 성), 붉은 러너.')
rows = ['#' * W] + \
       ['####' + '.' * 16 + '####'] * 3 + \
       ['#' + '.' * 22 + '#'] * 4 + \
       ['#' * 1 + '.' * 5 + '#' + '.' * 10 + '#' + '.' * 5 + '#'] + \
       ['#' + '.' * 22 + '#'] * 5 + \
       ['##' + '.' * 20 + '##'] + \
       ['#' * 11 + 'DD' + '#' * 11]
WALL = auto('SA-Wall01.png')
m.layout(rows, {'.': auto('SA-Floor06.png')}, auto('SA-WallD01.png'), [WALL, WALL])
m.fill(4, 3, 16, 3, auto('SA-Floor-T12.png'))              # raised dais floor in the apse
m.fill(11, 6, 2, H - 7, auto('SA-Carpet08.png'))            # red runner from the door to the dais
# folding screens standing against the apse back wall, sword-in-rock between them
m.image('byobu.png', 5, 2, (0, 16, 96, 80)); m.image('byobu.png', 16, 2, (0, 112, 64, 176))
m.over.append((10 * 32 + 16, 3 * 32, sheet('sword.png').crop((0, 0, 96, 96)))); m.used.add('sword.png')   # centred on the runner axis
# armour stands against the side walls (below the wall faces of the dais shoulders)
m.image('Wa-Yoroi01.png', 1, 5, (0, 0, 48, 64)); m.image('Wa-Yoroi01.png', 21, 5, (63, 0, 112, 64))
m.image('Wa-Yoroi01.png', 1, 11, (63, 0, 112, 64)); m.image('Wa-Yoroi01.png', 21, 11, (0, 0, 48, 64))
# castle models on stands in the lower hall (whole castles)
m.image('oshiro.png', 3, 12, (0, 64, 128, 128))
m.image('oshiromv.png', 14, 11, (0, 96, 192, 192))
# retainers kneeling either side of the runner
m.image('SC-CFundosi01.png', 9, 7, (32, 0, 64, 48)); m.image('SC-CFundosi01.png', 14, 7, (32, 0, 64, 48))
m.save()
