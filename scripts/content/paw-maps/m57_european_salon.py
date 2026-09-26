import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 22, 16
m = Map('m57_european_salon', '유럽풍 응접 살롱', W, H, 'interior',
        '장미 카펫 살롱. 북쪽 기둥 두 개가 선 이젤 벽감, 북벽 레이스 커튼, 서벽 유리장·옷장(남서 모서리 따냄), 북동 그랜드피아노, 카펫 위 소파·탁자·안락의자, 새장·조각상.')
rows = ['#' * W,
        '#' * 8 + '.' * 6 + '#' * 8] + \
       ['#' + '.' * 20 + '#'] * 11 + \
       ['###' + '.' * 18 + '#'] * 2 + \
       ['#' * 10 + 'DD' + '#' * 10]
WALL = auto('SA-Wall03.png')
m.layout(rows, {'.': auto('SA-FloorT02.png')}, auto('SA-WallA02.png'), [WALL, WALL, WALL])
m.fill(5, 7, 12, 7, auto('SA-Carpet-Rose01.png'))
# north bay: two slim pillars at its front corners, easels against its back wall
m.image('Eu-PillarMV01.png', 8, 1, (1, 0, 47, 144)); m.image('Eu-PillarMV01.png', 12, 1, (1, 0, 47, 144))
m.image('Eu-Easel01.png', 10, 4, (1, 45, 63, 96))
# lace curtains on the main north wall either side of the bay
m.image('Eu-Lace01.png', 3, 2, (0, 0, 96, 60)); m.image('Eu-Lace01.png', 15, 2, (0, 0, 96, 60))
# west wall furniture (whole alpha components of Eu-FurnitureMV01)
m.image('Eu-FurnitureMV01.png', 1, 4, (0, 8, 96, 128))       # glass cabinet
m.image('Eu-FurnitureMV01.png', 1, 9, (3, 170, 88, 276))     # wardrobe, above the SW notch
# grand piano, NE corner (whole left body)
m.image('Eu-GlandPiano.png', 18, 5, (8, 18, 94, 130))
# sofa set on the rug: sofa facing south, low table centred under it, armchairs either side
m.image('Eu-Sofa01.png', 8, 7, (0, 0, 180, 57))              # three-seat sofa
m.over.append((282, 10 * 32, sheet('Eu-Sofa02.png').crop((31, 62, 158, 114)))); m.used.add('Eu-Sofa02.png')   # low table
m.image('Eu-Sofa01.png', 7, 10, (0, 128, 30, 182)); m.image('Eu-Sofa01.png', 13, 10, (90, 128, 120, 182))  # armchairs
# birdcages, statue, second sofa by the SE wall (door lane x10-11 kept clear)
m.image('Eu-Cage02.png', 5, 5, (0, 0, 96, 128))
m.image('Eu-Cage01.png', 18, 10, (0, 0, 96, 128))
m.image('Eu-Statue01.png', 4, 11, (0, 24, 52, 128))
m.image('Eu-Sofa02.png', 14, 13, (0, 131, 128, 189))          # whole second sofa (arm, seats, arm)
m.save()
