import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')
Pa = lambda t: P('paper', t)
S = lambda t: P('sheet', t)
V = lambda t: P('void', t)
D = lambda t: P('dust', t)

def note(d):
    c = Cv(16, 16)
    lit = d == 'B'
    if d == 'C':
        # 구겨진 공 모양의 쪽지가 펴지다 만 형태 + 가운데 큰 가로 획 (글씨가 아닌 눈 모양)
        pts = {}
        rows = {4: (5, 10), 5: (4, 12), 6: (3, 12), 7: (3, 13), 8: (3, 12), 9: (4, 12), 10: (4, 11), 11: (5, 10)}
        for y, (a, b) in rows.items():
            for x in range(a, b + 1): c.set(x, y, Pa(4))
        for y, (a, b) in rows.items():
            c.set(a, y, Pa(5)); c.set(b, y, Pa(2)); 
        for x in range(5, 11): c.set(x, 4, Pa(5)); c.set(x, 11, Pa(2))
        # 구김 선
        c.line(5, 6, 8, 9, Pa(2)); c.line(9, 5, 11, 8, Pa(3)); c.line(6, 10, 8, 8, Pa(3))
        # 가운데 세로로 긴 눈(획)
        c.rect(7, 6, 8, 9, V(1)); c.set(7, 7, S(5)); c.set(8, 8, S(5)) if False else None
        c.set(7, 7, S(5))
        c.set(13, 3, S(6)); c.set(13, 2, S(5)) if False else None
        return c
    # 종이 본체 (9x8) 살짝 기울어짐: 위쪽이 왼쪽으로 한 칸 밀림
    x0, y0 = 4, 4
    for y in range(8):
        sh = -1 if y < 3 else 0
        for x in range(9):
            xx = x0 + x + sh
            c.set(xx, y0 + y, S(4 if not lit else 5))
    # 테두리 (위·왼쪽 밝게, 아래·오른쪽 어둡게)
    for y in range(8):
        sh = -1 if y < 3 else 0
        c.set(x0 + sh, y0 + y, S(5 if lit else 4)) if False else None
        c.set(x0 + 8 + sh, y0 + y, S(2))
    for x in range(9):
        c.set(x0 + x - 1, y0, S(6 if lit else 5))
        c.set(x0 + x, y0 + 7, S(2))
    # 접힌 오른쪽 아래 모서리
    c.set(x0 + 8, y0 + 7, None); c.set(x0 + 7, y0 + 7, None); c.set(x0 + 8, y0 + 6, None)
    c.set(x0 + 7, y0 + 6, S(1)); c.set(x0 + 6, y0 + 6, S(5)); c.set(x0 + 7, y0 + 5, S(3)) if False else None
    c.set(x0 + 6, y0 + 7, S(2))
    # 누런 물듦
    for (x, y) in ((5, 10), (6, 10), (11, 6), (11, 7)):
        if c.get(x, y): c.set(x, y, P('paper', 5))
    if d == 'A':
        # 낡은 얼룩
        c.set(6, 9, P('paper', 3)); c.set(7, 9, P('paper', 3)); c.set(10, 8, P('paper', 3))
    # 짧은 가로 획 (가짜 글자 없이)
    c.hl(5, 9, 6, V(1)); c.hl(5, 10, 8, V(1)); c.hl(5, 7, 10, V(1)) if False else None
    c.hl(5, 8, 10, V(1)) if False else None
    # 반짝임 (오른쪽 위 모서리 1px)
    c.set(13, 3, S(6))
    if d == 'B':
        # 종이 오른쪽 아래로 그림자
        for x in range(6, 14):
            if not c.get(x, 12): c.set(x, 12, '~')
        for y in range(5, 12):
            if not c.get(13, y): c.set(13, y, '~')
        c.set(14, 12, '-')
        c.set(13, 3, S(6)); c.set(12, 3, '?') if False else None
        c.set(2, 3, '?'); c.set(3, 2, '?')
    return c

N = {
 'A': '9x8 누런 종이 한 장, 위쪽이 살짝 밀려 기울고 오른쪽 아래 모서리가 접힘, 짧은 가로 획 셋, 오른쪽 위 바깥에 반짝임 1px',
 'B': '왼쪽 위 빛으로 종이 윗변·왼변 밝게, 접힌 모서리와 아래쪽 어둡게, 오른쪽 아래로 ~ - 그림자, 왼쪽 위 ? 달빛',
 'C': '구겨져 펴지다 만 쪽지 한 덩이, 가운데 세로로 긴 검은 획 하나가 눈처럼 이쪽을 봄',
}
for d in 'ABC':
    note(d).emit(f'{CH}/note_paper/h4-{d}.pxg', f'note_paper h4-{d}')
    open(f'{CH}/note_paper/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')
