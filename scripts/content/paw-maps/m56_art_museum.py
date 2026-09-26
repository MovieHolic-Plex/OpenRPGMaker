import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

W, H = 30, 18
m = Map('m56_art_museum', '미술관 명화 전시실', W, H, 'interior',
        'T자 평면 갤러리: 넓은 북쪽 명화 회랑(명화 8점)과 좁은 남쪽 입구 홀. 기둥·조각, 가운데 유리 진열장·천구의, 입구에서 이어지는 붉은 관람 러너.')
rows = ['#' * W] + ['#' + '.' * (W - 2) + '#'] * 10 + ['#' * 6 + '.' * 18 + '#' * 6] * 6 + ['#' * 14 + 'DD' + '#' * 14]
WALL = auto('SA-Wall03.png')
m.layout(rows, {'.': auto('SA-FloorS03.png')}, auto('SA-WallD01.png'), [WALL, WALL, WALL])
m.fill(12, 9, 6, 8, auto('SA-Carpet05.png'))                  # viewing runner from the door
# paintings on the north gallery wall (80px-wide ones use a pixel offset so they sit centred in 3 cells)
for n, x in (('Botticelli.png', 2), ('Vermeer.png', 6), ('Millais-Ophelia01.png', 9), ('monnalisa.png', 13),
             ('Olympia.png', 16), ('odalisque.png', 20), ('Pantocrator.png', 23), ('Millais-Ophelia02.png', 26)):
    if n == 'monnalisa.png': m.rect(n, 0, 0, 2, 2, x, 1)
    elif n in ('Millais-Ophelia01.png', 'Millais-Ophelia02.png', 'Olympia.png'):
        m.over.append((x * 32 + 8, 32, sheet(n))); m.used.add(n)
    else: m.chip(n, x, 1)
# pillars: gallery ends and the shoulders of the entrance hall (whole 1x3 columns)
m.rect('Eu-Pillar01.png', 0, 0, 1, 3, 1, 4); m.rect('Eu-Pillar01.png', 2, 0, 1, 3, 28, 4)
m.rect('Eu-Pillar01.png', 1, 0, 1, 3, 6, 11); m.rect('Eu-Pillar01.png', 3, 0, 1, 3, 23, 11)
# sculptures in the gallery wings
m.image('Eu-Statue01.png', 3, 5, (52, 24, 144, 128))   # whole central figure on its plinth (alpha-gap box)
m.image('Statue02.png', 26, 5, (0, 0, 36, 64))         # standing figure (component 3,2,31,59)
m.image('Statue02MV.png', 25, 8, (0, 0, 52, 96))       # MV-size figure
# central glass showcase and the armillary sphere
m.image('Showcase01.png', 9, 5, (0, 0, 160, 96))
m.chip('ArmillarySphere.png', 17, 5)
# entrance hall: second showcase on the west side, thinker and a figure on the east
m.image('Showcase01.png', 7, 12, (0, 96, 160, 208))
m.chip('Le Penseur.png', 21, 12)
m.image('Statue02.png', 19, 13, (64, 0, 96, 66))       # second figure (component 67,0,26,66)
# visitors and a guard
m.image('PikoC-Girl01.png', 14, 10, (32, 144, 64, 192))
m.image('SC-CTsunagi01.png', 22, 15, (32, 0, 64, 48))
m.save()
