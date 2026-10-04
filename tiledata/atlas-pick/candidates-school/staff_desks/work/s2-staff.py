import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LG():
    d = {}
    for i in range(7): d['lk'[0] + str(i)] = ('locker', i)   # l0..l6
    return d
def LEG():
    L = {}
    for i in range(7): L[chr(ord('0') + i)] = ('locker', i)   # 0..6 locker
    for i in range(6): L[chr(ord('a') + i)] = ('cream', i)     # a..f cream
    for i in range(6): L[chr(ord('p') + i)] = ('washi', i)     # p..u washi
    for i in range(8): L[chr(ord('A') + i)] = ('mdglass', i)   # A..H mdglass
    L['m'] = ('vred', 2); L['n'] = ('vred', 3); L['o'] = ('vred', 5)
    L['v'] = ('vgreen', 3); L['w'] = ('vblue', 4)
    return L

def paper(c, x, y, w, h, top, edge, dark):
    c.rect(x, y, w, h, top); c.hl(x, y + h - 1, w, edge); c.vl(x + w - 1, y, h, edge)
    c.hl(x + 1, y + 1, w - 3, dark) if h > 3 else None

def mug(c, x, y, body, hi, dark, handle):
    c.rect(x, y, 4, 4, body); c.vl(x, y, 4, hi); c.vl(x + 3, y, 4, dark); c.hl(x, y + 3, 4, dark)
    c.put(x + 4, y + 1, handle); c.put(x + 4, y + 2, handle)
    c.hl(x, y, 4, hi)

def monitor(c, x, y, w, h, bez, face, hi, dark):
    c.rect(x, y, w, h, bez); c.rect(x + 1, y + 1, w - 2, h - 3, face)
    c.hl(x + 1, y + 1, w - 2, hi); c.vl(x + 1, y + 1, h - 3, hi)
    c.hl(x, y + h - 2, w, dark)
    c.rect(x + w // 2 - 1, y + h, 3, 2, dark)
    c.put(x + w - 3, y + h - 3, 'v')  # 전원 불 점

def desk(tag):
    c = C(32, 32); L = LEG()
    B = tag == 'B'
    top, hi, lo = ('3', '5', '1') if B else ('4', '5', '2')
    # 먼 책상 윗면
    c.rect(1, 2, 30, 9, '0'); c.rect(2, 3, 28, 8, top)
    c.hl(2, 3, 28, hi); c.vl(2, 4, 7, hi)
    if B: c.hl(3, 9, 27, '2'); c.hl(2, 10, 28, '2')
    # 칸막이(낮은 판)
    c.rect(1, 11, 30, 4, '0'); c.hl(2, 11, 28, 'f'); c.hl(2, 12, 28, 'e'); c.hl(2, 13, 28, 'c' if B else 'd'); c.hl(2, 14, 28, 'a' if B else 'b')
    c.vl(2, 12, 2, 'f'); c.vl(29, 12, 2, 'b' if B else 'c')
    # 가까운 책상 윗면
    c.rect(1, 15, 30, 10, '0'); c.rect(2, 16, 28, 9, top)
    c.hl(2, 16, 28, '2' if B else '3'); c.vl(2, 17, 8, hi); c.hl(3, 17, 26, hi if B else '4'); c.hl(2, 24, 28, lo)
    if B: c.hl(3, 23, 27, '2')
    # 앞판 + 다리
    c.rect(1, 25, 30, 2, '0'); c.hl(2, 25, 28, '4' if B else '3'); c.hl(2, 26, 28, '1')
    for lx in (2, 27):
        c.rect(lx, 27, 3, 4, '2' if not B else '1'); c.vl(lx, 27, 4, '4'); c.vl(lx + 2, 27, 4, '1' if not B else '0'); c.hl(lx, 30, 3, '0')
    c.rect(17, 27, 9, 4, '1'); c.hl(17, 27, 9, '3'); c.hl(18, 29, 7, '3')
    c.rect(20, 28, 3, 1, '5'); c.rect(20, 30, 3, 1, '0')
    monitor(c, 18, 3, 10, 7, 'C', 'D', 'F', 'B')
    paper(c, 4, 5, 8, 5, 'u', 'r', 't')
    paper(c, 5, 18, 9, 5, 'u', 'q', 's')
    c.rect(7, 17, 8, 1, 'p'); c.hl(7, 17, 8, 'r')
    mug(c, 22, 18, 'n', 'o', 'm', 'm')
    if B:
        for x in range(3, 30):  # 칸막이 그림자가 먼 책상 위로
            if c.get(x, 10) == '2': pass
        for x in range(3, 29): c.put(x, 10, '1') if c.get(x, 10) in '23' else None
        c.hl(19, 25 - 25 + 24, 0, '0')
    for x in range(3, 31):
        if c.get(x, 31) == '.': c.put(x, 31, '~')
    for x in range(4, 31):
        for y in range(28, 31):
            if c.get(x, y) == '.': c.put(x, y, '~' if B else '-')
    for x in range(28, 32):
        for y in range(27, 31):
            if c.get(x, y) == '.': c.put(x, y, '-')
    return c, L

def desk_C():
    """실루엣: 서랍 기둥(페데스탈) 두 개가 가운데서 만나는 H꼴 + 솟은 모니터 + 높은 칸막이"""
    c = C(32, 32); L = LEG()
    # 모니터(뒷면, 높이 솟음) — 가운데 위
    c.rect(9, 1, 14, 9, 'C'); c.rect(10, 2, 12, 6, 'D'); c.hl(10, 2, 12, 'F'); c.vl(10, 2, 6, 'F')
    c.hl(9, 8, 14, 'B'); c.rect(14, 9, 4, 2, 'B'); c.put(20, 7, 'v')
    # 칸막이(높은 판) 가운데를 가르며 서 있음
    c.rect(1, 10, 30, 5, '0'); c.hl(2, 10, 28, 'f'); c.hl(2, 11, 28, 'e'); c.hl(2, 12, 28, 'd'); c.hl(2, 13, 28, 'c'); c.hl(2, 14, 28, 'b')
    c.vl(2, 11, 3, 'f'); c.vl(29, 11, 3, 'b')
    # 가까운 책상 윗면(넓게)
    c.rect(1, 15, 30, 9, '0'); c.rect(2, 16, 28, 8, '4'); c.hl(2, 16, 28, '3'); c.vl(2, 17, 7, '5'); c.hl(3, 17, 26, '5'); c.hl(2, 23, 28, '2')
    c.rect(1, 24, 30, 2, '0'); c.hl(2, 24, 28, '3'); c.hl(2, 25, 28, '1')
    # 서랍 기둥 둘
    for px in (2, 21):
        c.rect(px, 26, 9, 5, '0'); c.rect(px + 1, 26, 7, 4, '2'); c.hl(px + 1, 26, 7, '4'); c.vl(px + 1, 26, 4, '4'); c.vl(px + 7, 26, 4, '1')
        c.hl(px + 3, 28, 3, '5'); c.hl(px + 1, 29, 7, '1'); c.hl(px, 30, 9, '0')
    # 서류 더미 3단
    for i, (w, t) in enumerate(((10, 'u'), (9, 't'), (8, 's'))):
        y = 21 - i * 2 - 0
        paper(c, 4 + i, 18 + (2 - i) * 1 if False else 17 + (2 - i) * 2, w, 2, t, 'q', 'r')
    mug(c, 20, 18, 'w', 'w', 'w', 'w') if False else mug(c, 20, 18, 'n', 'o', 'm', 'm')
    for x in range(3, 31):
        if c.get(x, 31) == '.': c.put(x, 31, '~')
    for x in range(11, 21):
        for y in range(27, 31):
            if c.get(x, y) == '.': c.put(x, y, '-')
    for x in range(30, 32):
        for y in range(27, 31):
            if c.get(x, y) == '.': c.put(x, y, '-')
    return c, L

NOTE = {
 'A': '교무실 섬 A: 회색 쇠 책상(locker 4단 윗면·빛 5단·앞판 3단·외곽 0단) 두 개가 마주 붙고 사이에 cream 낮은 칸막이. 먼 책상에 모니터 뒷면(mdglass, 초록 전원 점)과 서류, 가까운 책상에 서류 더미와 빨간 머그. 윗면 ¾, 오른쪽 아래 그림자.',
 'B': '명암 강조: 윗면을 3단으로 눌러 어둡게 하고 빛 가장자리 5단만 세움, 칸막이 그림자가 먼 책상 윗면으로 드리우고, 책상 밑을 ~ 로 짙게 채움.',
 'C': '실루엣 재해석: 솟은 모니터가 위로 튀고 낮은 칸막이는 판 하나, 서랍 기둥 두 개로 책상을 받쳐 H꼴, 서류는 3단 계단 더미. 한 색 실루엣만 봐도 서랍 책상 섬.',
}
if __name__ == '__main__':
    out = []
    for tag in 'AB':
        c, L = desk(tag); out.append(save('staff_desks', tag, c, L, NOTE[tag]))
    c, L = desk_C(); out.append(save('staff_desks', 'C', c, L, NOTE['C']))
    check(out)
