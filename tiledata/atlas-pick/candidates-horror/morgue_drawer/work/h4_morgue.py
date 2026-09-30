import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')
T = lambda t: P('tin', t)
G = lambda t: P('grave', t)
S = lambda t: P('sheet', t)
Bq = lambda t: P('bisque', t)
V = lambda t: P('void', t)

def door(c, x0, y0, d, mode='closed', label=True, lean=0):
    lit = d == 'B'
    w, h = 13, 13
    x1, y1 = x0 + w - 1, y0 + h - 1
    c.rect(x0, y0, x1, y1, T(3))
    c.hl(x0, x1, y0, T(6 if lit else 5))          # 차가운 윗테 광택
    c.hl(x0, x1, y0 + 1, T(4))
    c.vl(x0, y0, y1, T(5 if lit else 4)); c.vl(x1, y0, y1, T(1)); c.hl(x0, x1, y1, T(1))
    c.vl(x1 - 1, y0 + 2, y1 - 1, T(2))
    if lit:
        c.vl(x0 + 1, y0 + 2, y1 - 1, T(4))
    # 이름표 판
    if label:
        c.rect(x0 + 3, y0 + 3, x0 + 9, y0 + 5, S(4)); c.hl(x0 + 3, x0 + 9, y0 + 3, S(5)); c.hl(x0 + 3, x0 + 9, y0 + 5, S(2))
        c.vl(x0 + 9, y0 + 3, y0 + 5, S(2))
        c.hl(x0 + 4, x0 + 6 + lean, y0 + 4, V(1))
    # 손잡이 (가로 바)
    c.hl(x0 + 4, x0 + 8, y0 + 8, T(6 if lit else 5)); c.hl(x0 + 4, x0 + 8, y0 + 9, T(1)); c.set(x0 + 4, y0 + 9, T(2)); c.set(x0 + 8, y0 + 9, T(2))
    c.set(x0 + 3, y0 + 8, T(2)); c.set(x0 + 9, y0 + 8, T(2))
    # 문틈 선
    return

def open_drawer(c, x0, y0, d):
    lit = d == 'B'
    w, h = 13, 13
    x1, y1 = x0 + w - 1, y0 + h - 1
    # 어두운 안쪽
    c.rect(x0, y0, x1, y1, V(2))
    c.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 6, V(1))
    c.hl(x0, x1, y0, T(4)); c.vl(x0, y0, y1, T(3)); c.vl(x1, y0, y1, T(1))
    # 나온 쟁반
    c.rect(x0 + 1, y0 + 7, x1 - 1, y0 + 8, T(4 if not lit else 5)); c.hl(x0 + 1, x1 - 1, y0 + 7, T(6 if lit else 5))
    c.hl(x0 + 1, x1 - 1, y0 + 8, T(2))
    # 흰 천 덮인 몸: 발끝이 위로 솟음
    c.rect(x0 + 2, y0 + 3, x1 - 2, y0 + 7, S(4 if not lit else 5))
    c.hl(x0 + 2, x1 - 2, y0 + 7, S(2)); c.vl(x1 - 2, y0 + 3, y0 + 7, S(2))
    # 발끝 두 개(천 아래로 삐져나옴, 아래쪽으로)
    c.rect(x0 + 4, y0 + 2, x0 + 5, y0 + 4, S(5)); c.rect(x0 + 7, y0 + 2, x0 + 8, y0 + 4, S(4))
    c.hl(x0 + 2, x1 - 2, y0 + 5, S(3))
    # 문짝은 아래로 열려 앞으로 접힌 부분
    c.rect(x0, y0 + 9, x1, y1, T(3)); c.hl(x0, x1, y0 + 9, T(5 if not lit else 6)); c.vl(x0, y0 + 9, y1, T(4)); c.vl(x1, y0 + 9, y1, T(1)); c.hl(x0, x1, y1, T(1))
    # 삐져나온 맨발 (천 앞 아래로)
    c.rect(x0 + 4, y0 + 8, x0 + 5, y0 + 10, Bq(4)); c.rect(x0 + 7, y0 + 8, x0 + 8, y0 + 10, Bq(3))
    c.set(x0 + 4, y0 + 10, Bq(5)); c.set(x0 + 5, y0 + 10, Bq(3)); c.set(x0 + 7, y0 + 10, Bq(4)); c.set(x0 + 8, y0 + 10, Bq(2))
    c.vl(x0 + 6, y0 + 8, y0 + 10, Bq(1))
    c.set(x0 + 6, y0 + 11, V(2))
    # 손잡이는 문 아래
    c.hl(x0 + 4, x0 + 8, y1 - 1, T(5)) if False else None

def morgue(d):
    c = Cv(32, 32)
    # 벽 바탕
    c.rect(0, 0, 31, 31, G(3 if d != 'B' else 3))
    for y in range(32):
        for x in range(32):
            if (x * 7 + y * 13) % 11 == 0: c.set(x, y, G(2))
    # 프레임
    c.hl(0, 31, 0, G(5)); c.hl(0, 31, 1, G(4)); c.vl(0, 0, 31, G(4)); c.vl(31, 0, 31, G(1)); c.hl(0, 31, 31, G(1))
    c.hl(1, 30, 15, G(2)); c.hl(1, 30, 16, G(1)); c.vl(15, 1, 30, G(2)); c.vl(16, 1, 30, G(1))
    lean = 1
    door(c, 2, 2, d, lean=0); door(c, 17, 2, d, lean=2)
    door(c, 2, 17, d, lean=1)
    open_drawer(c, 17, 17, d)
    if d == 'A':
        # 낡음: 녹, 벽 얼룩
        for (x, y) in ((4, 13), (5, 13), (5, 12), (12, 4), (24, 12), (25, 13), (21, 12)):
            c.set(x, y, P('rust', 3))
        c.set(11, 12, P('rust', 2)); c.set(3, 11, T(2)); c.set(26, 10, T(2))
        for y in range(1, 6): c.set(29, y, P('rust', 2 if y > 2 else 3))
    if d == 'B':
        # 서랍 열린 곳에서 벽으로 차가운 빛, 오른쪽 아래 그림자는 프레임 안쪽에만(불투명 유지)
        for x in range(2, 14): c.set(x, 14, T(1))
        for x in range(17, 30): c.set(x, 14, T(1))
    return c

def morgue_c():
    # 실루엣 재해석: 네 문 모두 얼굴처럼 — 이름표=눈썹줄, 손잡이=입, 열린 칸은 벌어진 입
    c = Cv(32, 32)
    c.rect(0, 0, 31, 31, G(2))
    c.hl(0, 31, 0, G(4)); c.vl(0, 0, 31, G(3)); c.vl(31, 0, 31, G(1)); c.hl(0, 31, 31, G(1))
    c.hl(1, 30, 15, G(1)); c.vl(15, 1, 30, G(1))
    for (x0, y0, big) in ((2, 2, 0), (17, 2, 0), (2, 17, 0)):
        c.rect(x0, y0, x0 + 12, y0 + 12, T(2)); c.hl(x0, x0 + 12, y0, T(5)); c.vl(x0, y0, y0 + 12, T(3)); c.vl(x0 + 12, y0, y0 + 12, T(1)); c.hl(x0, x0 + 12, y0 + 12, T(1))
        c.rect(x0 + 2, y0 + 3, x0 + 4, y0 + 5, V(1)); c.rect(x0 + 8, y0 + 3, x0 + 10, y0 + 5, V(1))  # 눈
        c.set(x0 + 3, y0 + 4, T(4)); c.set(x0 + 9, y0 + 4, T(4))
        c.hl(x0 + 3, x0 + 9, y0 + 9, T(5)); c.hl(x0 + 3, x0 + 9, y0 + 10, T(1))
    # 열린 칸: 벌어진 입 + 흰 천 혀
    x0, y0 = 17, 17
    c.rect(x0, y0, x0 + 12, y0 + 12, V(2)); c.hl(x0, x0 + 12, y0, T(4)); c.vl(x0, y0, y0 + 12, T(3)); c.vl(x0 + 12, y0, y0 + 12, T(1))
    c.rect(x0 + 2, y0 + 3, x0 + 4, y0 + 5, S(3)); c.rect(x0 + 8, y0 + 3, x0 + 10, y0 + 5, S(3)); c.set(x0 + 3, y0 + 4, V(0)); c.set(x0 + 9, y0 + 4, V(0))
    c.rect(x0 + 3, y0 + 8, x0 + 9, y0 + 12, S(4)); c.hl(x0 + 3, x0 + 9, y0 + 8, S(5)); c.vl(x0 + 9, y0 + 8, y0 + 12, S(2))
    c.rect(x0 + 5, y0 + 10, x0 + 6, y0 + 12, Bq(4)); c.rect(x0 + 8, y0 + 11, x0 + 8, y0 + 12, Bq(3))
    return c

N = {
 'A': '네 칸 쇠 문(윗테 밝은 광택, 이름표 판에 짧은 획, 가로 손잡이), 오른쪽 아래 칸이 열려 흰 천 덮인 몸과 맨발 삐져나옴, 녹 얼룩',
 'B': '왼쪽 위 빛: 문 왼쪽 테와 윗테 크게 밝고 오른쪽 어둡게, 열린 칸 안쪽 깊게 어두움, 칸 사이 홈 그림자',
 'C': '네 칸이 얼굴: 이름표=눈 구멍 둘, 손잡이=입, 열린 칸은 벌어진 입에서 흰 천 혀와 발가락이 삐져나옴',
}
for d in 'AB':
    morgue(d).emit(f'{CH}/morgue_drawer/h4-{d}.pxg', f'morgue_drawer h4-{d}')
morgue_c().emit(f'{CH}/morgue_drawer/h4-C.pxg', 'morgue_drawer h4-C')
for d in 'ABC':
    open(f'{CH}/morgue_drawer/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')
