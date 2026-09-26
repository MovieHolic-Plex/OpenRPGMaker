import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

def room(m, ceil, wall, floor, face=2):
    """dark ceiling rim all round, `face` rows of front wall under the top rim, floor inside"""
    m.fill(0, 0, m.w, m.h, auto(ceil))
    m.fill(1, 1, m.w - 2, face, auto(wall))
    m.fill(1, 1 + face, m.w - 2, m.h - 2 - face, auto(floor))

W, H = 30, 18
m = Map('m56_art_museum', '미술관 명화 전시실', W, H, 'interior',
        '밝은 벽·대리석 바닥 갤러리. 북벽에 명화 8점, 좌우 벽에 기둥과 조각, 가운데 유리 진열장·천구의, 붉은 관람 러그.')
room(m, 'SA-WallD01.png', 'SA-Wall03.png', 'SA-FloorS03.png', face=3)
m.fill(8, 10, 14, 4, auto('SA-Carpet05.png'))
# paintings (80px-wide ones use a pixel box so they sit centred in 3 cells)
pics = [('Botticelli.png', 3), ('Vermeer.png', 2), ('Millais-Ophelia01.png', 3), ('monnalisa.png', 2),
        ('Olympia.png', 3), ('odalisque.png', 2), ('Pantocrator.png', 3), ('Millais-Ophelia02.png', 3)]
x = 2
for n, w in pics:
    if n == 'monnalisa.png': m.rect(n, 0, 0, 2, 2, x, 1)
    elif n in ('Millais-Ophelia01.png', 'Millais-Ophelia02.png', 'Olympia.png'):
        m.over.append((x * 32 + 8, 32, sheet(n))); m.used.add(n)
    else: m.chip(n, x, 1)
    x += w + 1
# pillars framing the side walls (whole 1x3 columns)
for i, px in enumerate((1, 28)):
    m.rect('Eu-Pillar01.png', i * 2, 0, 1, 3, px, 4)
    m.rect('Eu-Pillar01.png', 1 + i * 2, 0, 1, 3, px, 12)
# sculptures on plinths along the side walls
m.image('Eu-Statue01.png', 3, 5, (52, 24, 144, 128))   # whole central figure on its plinth (alpha-gap box)
m.chip('Le Penseur.png', 3, 12)
m.image('Statue02.png', 26, 5, (0, 0, 36, 64))         # standing figure (component 3,2,31,59)
m.image('Statue02.png', 26, 12, (64, 0, 96, 66))       # second figure (component 67,0,26,66)
m.image('Statue02MV.png', 25, 8, (0, 0, 52, 96))       # MV-size figure
# central glass showcases and the armillary sphere
m.image('Showcase01.png', 9, 6, (0, 0, 160, 96))
m.chip('ArmillarySphere.png', 17, 6)
m.image('Showcase01.png', 12, 14, (0, 96, 160, 208))
# visitors and a guard
m.image('PikoC-Girl01.png', 14, 11, (32, 144, 64, 192))
m.image('SC-CTsunagi01.png', 20, 12, (32, 0, 64, 48))
m.save()
