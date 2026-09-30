import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'wall_stone_block', 'work'))
from hf7_lib import *

def build(mat, mold, base, mort, bases, lip, wain_dark, stain, stain_x, bevel_on=True, extra=None):
    g = G(32, 32, wrapx=True)
    for y, t in enumerate(mold): g.hline(0, y, 32, mat, t)
    g.hline(0, 29, 32, mat, base[0]); g.hline(0, 30, 32, mat, base[1]); g.hline(0, 31, 32, mat, base[1])
    ys = [4, 8, 12, 16]
    for r, y in enumerate(ys):
        g.hline(0, y - 1, 32, mat, mort)
        xs = 0 if r % 2 == 0 else 4
        blocks = [(8, bases[(r * 3 + i * 5) % len(bases)]) for i in range(4)]
        course(g, mat, y, 3, xs, blocks, mat, mort, mort_row=False)
    g.hline(0, 19, 32, mat, mort)
    # 징두리 윗 띠(20~21): 밝은 한 줄 + 그림자 한 줄
    g.hline(0, 20, 32, mat, lip[0]); g.hline(0, 21, 32, mat, lip[1])
    for r, y in enumerate([22, 26]):
        xs = 2 if r == 0 else 6
        blocks = [(8, max(1, bases[(r * 2 + i * 3) % len(bases)] - wain_dark)) for i in range(4)]
        course(g, mat, y, 3, xs, blocks, mat, mort - 0, mort_row=False)
    g.hline(0, 25, 32, mat, mort)
    # 물 얼룩: 벽면 줄(y4~19)을 한 단 어둡게
    for y in range(4, 20):
        m, t = g.get(stain_x, y)
        if t > mort: g.put(stain_x, y, m, t - stain)
        if y % 3 != 0:
            m, t = g.get(stain_x + 1, y)
            if t > mort + 1: g.put(stain_x + 1, y, m, t - 1)
    if extra: extra(g)
    return g

def A():
    return build('c', [1, 4, 2], (3, 0), 1, [2, 3, 2, 4], (3, 1), 1, 1, 13), {'c': 'vclay'}
def B():
    g = build('c', [0, 6, 4], (4, 0), 0, [4, 5, 4, 5], (5, 0), 1, 1, 13)
    return g, {'c': 'rot'}
def C():
    def ex(g):
        # 벽돌 하나 빠져 들어감(어두운 구멍) + 묵은 흰 얼룩 점 + 이끼
        g.rect(22, 12, 5, 3, 'c', 0); g.hline(22, 12, 5, 'c', 1)
        g.pts('c', [(3, 5, 5), (4, 5, 5), (18, 9, 2), (19, 9, 2), (29, 17, 5), (9, 13, 2)])
        g.pts('m', [(6, 18, 3), (7, 18, 3), (8, 18, 2), (6, 17, 2), (7, 17, 3), (7, 16, 2), (14, 27, 2), (15, 27, 3)])
    g = build('c', [1, 4, 2], (3, 0), 1, [3, 4, 3, 5], (4, 1), 1, 1, 13, extra=ex)
    return g, {'c': 'rot', 'm': 'hmoss'}
NOTES = {
 'A': 'A(v5 식구·깨끗): 붉은 갈색 잔벽돌 8×3 반 칸 엇갈림(vclay 2~4, 낮춰 칙칙하게), 징두리 띠 아래 한 단 어두운 벽돌, 물얼룩 세로 한 줄',
 'B': 'B(어둠에서 읽힘): rot 램프 벽돌 톤 4~5 밝게 + 줄눈 0 검정으로 한 줄 윤곽 뚜렷, 밑 벽돌은 한 단 어둡게 나눔',
 'C': 'C(재질·무늬): rot 램프 낡은 벽돌 + 빠져 들어간 벽돌 한 장·흰 곰팡이 점·이끼 한 곳·물얼룩',
}
if __name__ == '__main__':
    for c, f in (('A', A), ('B', B), ('C', C)):
        g, mats = f(); emit('wall_cellar_brick', c, 32, 32, mats, g, NOTES[c])
