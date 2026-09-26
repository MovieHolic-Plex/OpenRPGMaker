import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 24, 16
m = Map('m58_samurai_hall', '천수각 무사의 대청', W, H, 'interior',
        '어두운 목재 대청. 상단 단상에 병풍 두 폭, 좌우 갑옷 전시, 성 모형 두 점(oshiro 흰 성·oshiromv 검은 성)을 받침 위에, 칼 꽂힌 바위, 붉은 러너.')
room(m, 'SA-WallD01.png', 'SA-Wall01.png', 'SA-Floor06.png', face=2)
m.fill(4, 3, 16, 3, auto('SA-Floor-T12.png'))              # raised dais floor
m.fill(10, 6, 4, H - 7, auto('SA-Carpet08.png'))            # red runner to the dais
# folding screens on the dais
m.image('byobu.png', 7, 2, (0, 0, 96, 96)); m.image('byobu.png', 14, 2, (0, 96, 64, 192))
# armour on both side walls
m.image('Wa-Yoroi01.png', 1, 3, (0, 0, 48, 64)); m.image('Wa-Yoroi01.png', 21, 3, (63, 0, 112, 64))
m.image('Wa-Yoroi01.png', 1, 6, (63, 0, 112, 64)); m.image('Wa-Yoroi01.png', 21, 6, (0, 0, 48, 64))
# castle models on stands in the lower hall (whole castles)
m.image('oshiro.png', 1, 10, (0, 64, 128, 128))
m.image('oshiromv.png', 15, 10, (0, 96, 192, 192))
# legendary sword stuck in a rock, centre of the dais
m.over.append((10 * 32 + 16, 3 * 32, sheet('sword.png').crop((0, 0, 96, 96)))); m.used.add('sword.png')   # centred half a cell right
# retainers
m.image('SC-CFundosi01.png', 9, 9, (32, 0, 64, 48)); m.image('SC-CFundosi01.png', 14, 9, (32, 0, 64, 48))
m.save()
