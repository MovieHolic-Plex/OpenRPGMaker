import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')
M = lambda t: P('mahog', t)

def box(c, d):
    lit = d == 'B'
    # 뚜껑(열려 뒤로 섬)
    c.rect(3, 5, 12, 9, M(4))
    c.hl(3, 12, 5, M(6 if lit else 5)); c.vl(3, 5, 9, M(6 if lit else 5))
    c.vl(12, 5, 9, M(2)); 
    c.rect(4, 6, 11, 8, P('murk', 3))
    # 거울 하이라이트 대각
    c.set(5, 8, P('murk', 5 if lit else 4)); c.set(6, 7, P('murk', 5 if lit else 4)); c.set(7, 6, P('murk', 5 if lit else 4))
    if d == 'B':
        c.set(4, 8, P('murk', 6)); c.set(5, 7, P('murk', 6)); c.set(6, 6, P('murk', 6))
    # 금
    c.set(10, 6, P('murk', 1)); c.set(9, 7, P('murk', 1)); c.set(10, 8, P('murk', 1))
    # 상자 윗면(쟁반)
    c.rect(2, 10, 13, 11, M(2))
    c.hl(2, 13, 10, M(6 if lit else 5))
    c.rect(3, 11, 12, 11, M(1) if False else M(2))
    # 상자 앞면
    c.rect(2, 12, 13, 14, M(4))
    c.hl(2, 13, 12, M(5)); c.hl(2, 13, 14, M(2))
    c.vl(13, 12, 14, M(2)) 
    if lit: c.vl(2, 12, 14, M(6))
    # 자물쇠 촉
    c.set(7, 13, P('vbrass', 3)); c.set(8, 13, P('vbrass', 2))
    # 발
    c.set(3, 15, M(2)); c.set(12, 15, M(2))
    # 태엽 열쇠(옆)
    c.set(14, 12, P('tarn', 4)); c.set(15, 11, P('tarn', 5)); c.set(15, 13, P('tarn', 3)); c.set(14, 11, P('tarn', 3)); c.set(14, 13, P('tarn', 3))
    c.set(13, 12, P('tarn', 3))

def dancer(c, d):
    b = lambda t: P('bisque', t)
    hi = 6 if d == 'B' else 5
    c.set(7, 8, b(hi)); c.set(7, 9, b(4))
    c.set(6, 9, b(3)) if False else None
    c.hl(5, 9, 10, b(hi - 1)); c.hl(6, 8, 11, b(3) if False else b(2))
    c.set(8, 9, b(3))

def music(d):
    c = Cv(16, 16)
    if d == 'C':
        # 작은 상자 + 위로 길게 뒤틀려 늘어난 무용수
        c.rect(3, 12, 12, 14, M(4)); c.hl(3, 12, 12, M(5)); c.hl(3, 12, 14, M(2)); c.vl(12, 12, 14, M(2))
        c.rect(3, 11, 12, 11, M(2)); c.hl(3, 12, 11, M(5))
        c.set(4, 15, M(2)); c.set(11, 15, M(2))
        c.set(7, 13, P('vbrass', 3)); c.set(8, 13, P('vbrass', 2))
        c.set(13, 13, P('tarn', 4)); c.set(14, 12, P('tarn', 5)); c.set(14, 14, P('tarn', 3)); c.set(13, 12, P('tarn', 3)); c.set(13, 14, P('tarn', 3))
        b = lambda t: P('bisque', t)
        # 다리(길게) — 치마 아래 발끝
        c.vl(7, 9, 10, b(3)); c.vl(8, 9, 10, b(2))
        c.hl(5, 10, 8, b(5)); c.hl(6, 9, 7, b(4)); c.hl(6, 9, 9, b(3)) if False else None
        # 몸통·목이 옆으로 꺾이며 위로
        c.vl(8, 4, 6, b(4)); c.set(9, 3, b(4)); c.set(9, 2, b(4))
        # 머리(뒤로 꺾여 얼굴이 아래를 봄)
        c.rect(9, 0, 11, 1, b(5)); c.set(10, 1, P('void', 0)); c.set(9, 0, b(6)); c.set(11, 1, b(3))
        # 팔: 하나는 위로 쭉, 하나는 아래로 늘어짐
        c.line(8, 5, 4, 2, b(4)); c.line(8, 5, 13, 8, b(3)); c.set(13, 9, b(3)); c.set(13, 10, b(3))
        return c
    box(c, d)
    dancer(c, d)
    if d == 'A':
        # 낡음: 뚜껑 귀퉁이 빠짐 + 한 발 없음
        c.set(3, 5, None); c.set(12, 15, None)
    if d == 'B':
        for (x, y) in ((14, 15), (13, 15), (12, 15), (11, 15), (10, 15), (14, 14), (15, 15)):
            if not c.get(x, y): c.set(x, y, '~')
        for (x, y) in ((4, 15), (5, 15), (6, 15), (7, 15), (8, 15), (9, 15)):
            if not c.get(x, y): c.set(x, y, '-')
        # 달빛
        for (x, y) in ((1, 4), (2, 3), (1, 5)):
            c.set(x, y, '?')
    return c

N = {
 'A': 'v5 상자 자리(아래 2/3): 뚜껑 열린 마호가니 상자, 거울에 금, 무용수 한 점 기둥과 치마, 옆 태엽, 귀퉁이 빠지고 발 한 짝 없음',
 'B': '왼쪽 위 빛: 왼쪽 면·뚜껑 테 밝게, 거울에 밝은 대각 하이라이트, 무용수 왼쪽이 밝음, 상자 오른쪽 아래로 ~ - 그림자',
 'C': '뚜껑 없이 무용수만 위로 길게 늘어나 몸이 꺾이고 머리가 뒤로 젖혀 얼굴이 검다 — 팔 하나는 위로, 하나는 아래로 늘어짐',
}
for d in 'ABC':
    music(d).emit(f'{CH}/music_box/h4-{d}.pxg', f'music_box h4-{d}')
    open(f'{CH}/music_box/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')
