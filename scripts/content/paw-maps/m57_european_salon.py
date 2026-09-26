import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 22, 16
m = Map('m57_european_salon', '유럽풍 응접 살롱', W, H, 'interior',
        '장미 카펫 살롱. 북벽 레이스 커튼·기둥, 서벽 가구장, 북동 그랜드피아노, 카펫 위 소파·탁자·안락의자, 새장·이젤·조각상.')
room(m, 'SA-WallA02.png', 'SA-Wall03.png', 'SA-FloorT02.png', face=3)
m.fill(5, 7, 12, 7, auto('SA-Carpet-Rose01.png'))
# north wall: lace curtains, two slim pillars around the centre bay
m.image('Eu-Lace01.png', 3, 1, (0, 0, 96, 60)); m.image('Eu-Lace01.png', 15, 1, (0, 0, 96, 60))
m.image('Eu-PillarMV01.png', 9, 1, (1, 0, 47, 144)); m.image('Eu-PillarMV01.png', 12, 1, (1, 0, 47, 144))
# west wall furniture (whole alpha components of Eu-FurnitureMV01)
m.image('Eu-FurnitureMV01.png', 1, 3, (0, 8, 96, 128))       # glass cabinet
m.image('Eu-FurnitureMV01.png', 1, 10, (3, 170, 88, 276))    # wardrobe
# grand piano, NE corner (whole left body)
m.image('Eu-GlandPiano.png', 17, 4, (8, 18, 94, 130))
# sofa set on the rug
m.image('Eu-Sofa01.png', 7, 7, (0, 0, 180, 57))             # three-seat sofa
m.image('Eu-Sofa02.png', 8, 10, (31, 62, 158, 114))        # low table
m.image('Eu-Sofa01.png', 6, 10, (0, 128, 30, 182)); m.image('Eu-Sofa01.png', 13, 9, (90, 128, 120, 182))  # armchairs

# birdcages, easel, statue
m.image('Eu-Cage01.png', 18, 11, (0, 0, 96, 128))
m.image('Eu-Cage02.png', 15, 12, (0, 0, 96, 128))
m.image('Eu-Easel01.png', 6, 3, (0, 43, 96, 96))
m.image('Eu-Statue01.png', 4, 12, (0, 24, 52, 128))
m.image('Eu-Sofa02.png', 8, 13, (0, 131, 160, 189))         # second sofa, south side
m.save()
