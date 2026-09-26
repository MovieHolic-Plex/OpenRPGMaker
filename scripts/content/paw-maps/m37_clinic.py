import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pawlib import *

CEIL = auto('SA-WallA01.png')
def room(m, sheet, walls, floor, doors=()):
    """XP ceiling ring, north wall face rows (walls = tile ids top->bottom), floor, south door gap columns."""
    m.fill(0, 0, m.w, m.h, CEIL)
    for i, t in enumerate(walls): m.fill(1, 1 + i, m.w - 2, 1, tile(sheet, t))
    top = 1 + len(walls)
    m.fill(1, top, m.w - 2, m.h - top - 1, floor)
    for x in doors: m.fill(x, m.h - 1, 1, 1, floor)
    return top
def door(m, name, x, y, fw=32, fh=64):
    """closed frame 0 of a PAW door sprite sheet at cell (x,y); bottom row sits on the wall base"""
    m.image(name, x, y, (0, 0, fw, fh))

S = 'ST-Hospital-I01.png'
m = Map('m37_clinic', '동네의원 대기실과 진찰실', 16, 12, 'interior', '서쪽 접수·TV·대기 의자, 북동 진찰 침상·모니터·가림막')
room(m, S, (17, 25), tile(S, 1), doors=(6, 7))
m.fill(6, 9, 2, 2, auto('SA-Floor-T12.png'))            # entrance mat
m.recipe(S, 'clinic-reception', 1, 3)
m.recipe(S, 'clinic-poster', 2, 1)
m.recipe(S, 'clinic-tv', 4, 1)
m.recipe(S, 'clinic-clock', 7, 1)
m.recipe(S, 'clinic-medicine', 8, 1)
m.recipe(S, 'clinic-window', 10, 1)
door(m, 'SC-Door05.png', 13, 1)
m.fill(8, 3, 7, 3, auto('SA-Floor-T01.png'))           # exam area vinyl
m.recipe(S, 'clinic-privacy-side', 7, 2)
m.recipe(S, 'clinic-exam-couch', 9, 3)
m.recipe(S, 'clinic-monitor', 11, 3)
m.recipe(S, 'clinic-stool', 11, 6)
m.recipe(S, 'clinic-privacy', 7, 6)
m.recipe(S, 'clinic-privacy', 9, 6)
for x, y in ((1, 7), (2, 7), (4, 7), (5, 7), (4, 9), (1, 9)):
    m.recipe(S, 'clinic-waiting-bench', x, y)
m.recipe(S, 'clinic-plant', 14, 8)
m.save()
