import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'wall_stone_block', 'work'))
from hf7_lib import *

def frame(g, post, lintel, sill, bands, bars, bar_tones, top=5):
    # 기둥 (x0-1 왼쪽, x14-15 오른쪽) y2-31
    for y in range(2, 32):
        g.put(0, y, 'i', post[0]); g.put(1, y, 'i', post[1]); g.put(14, y, 'i', post[2]); g.put(15, y, 'i', post[3])
    # 창살 : bars = [(x, w)] 각 창살은 위·아래 띠 사이 y5..28
    for bx, bw in bars:
        for k in range(bw):
            for y in range(top, 29): g.put(bx + k, y, 'i', bar_tones[k])
    # 위 인방 y2-4, 아래 문턱 y29-31
    for y, t in zip((2, 3, 4), lintel): g.hline(0, y, 16, 'i', t)
    for y, t in zip((29, 30, 31), sill): g.hline(0, y, 16, 'i', t)
    # 가로 띠
    for y0, tones in bands:
        for j, t in enumerate(tones): g.hline(0, y0 + j, 16, 'i', t)
    # 창살 머리(인방 아래 바로 그림자)
    return g

def padlock(g, x, y, body, shackle, mat='b'):
    g.hline(x + 1, y, 2, 'i', shackle); g.put(x, y + 1, 'i', shackle - 1); g.put(x + 3, y + 1, 'i', shackle - 1)
    g.hline(x + 1, y, 2, 'i', shackle)
    g.rect(x, y + 2, 4, 3, mat, body); g.hline(x, y + 2, 4, mat, body + 1); g.put(x + 3, y + 4, mat, body - 1); g.put(x + 1, y + 3, mat, 1)

def A():
    g = G(16, 32)
    frame(g, (4, 2, 3, 1), (5, 3, 1), (4, 2, 1), [(8, (4, 2)), (21, (4, 2))], [(3, 1), (6, 1), (9, 1), (12, 1)], [4])
    for bx in (3, 6, 9, 12): g.put(bx, 5, 'i', 5); g.put(bx, 28, 'i', 3)
    padlock(g, 6, 13, 3, 4)
    return g, {'i': 'viron', 'b': 'vbrass'}

def B():
    g = G(16, 32)
    frame(g, (5, 3, 4, 2), (6, 4, 1), (5, 3, 1), [(8, (5, 4, 2)), (21, (5, 4, 2))], [(3, 2), (7, 2), (11, 2)], [6, 4])
    padlock(g, 6, 13, 4, 6)
    return g, {'i': 'viron', 'b': 'vbrass'}

def C():
    g = G(16, 32)
    frame(g, (4, 2, 3, 1), (5, 3, 1), (4, 2, 1), [(8, (4, 2)), (21, (4, 2))], [(3, 1), (6, 1), (9, 1), (12, 1)], [4])
    for bx in (3, 6, 9, 12): g.put(bx, 5, 'i', 5); g.put(bx, 28, 'i', 3)
    padlock(g, 6, 13, 3, 4)
    # 녹 : 띠와 창살 교차점, 창살 아래로 흐른 녹물, 기둥 얼룩
    g.pts('r', [(3, 8, 4), (4, 8, 3), (6, 9, 3), (9, 8, 4), (12, 9, 3), (3, 21, 4), (6, 22, 3), (12, 21, 4),
                (3, 10, 3), (3, 11, 2), (3, 12, 2), (9, 10, 3), (9, 11, 2), (12, 23, 3), (12, 24, 2), (12, 25, 2),
                (0, 12, 3), (1, 13, 3), (14, 20, 3), (15, 21, 2), (0, 26, 3), (1, 26, 2)])
    g.pts('i', [(6, 17, 2), (9, 15, 2), (6, 24, 2), (3, 25, 2)])
    return g, {'i': 'viron', 'b': 'vbrass', 'r': 'rust'}

NOTES = {
 'A': 'A(v5 식구·깨끗): 쇠창살 문. 굵은 기둥 2px + 인방 + 창살 4개(1px)·가로 띠 둘·황동 자물쇠 한 점. 창살 사이 투명',
 'B': 'B(어둠에서 읽힘): 창살 3개를 2px 굵게, 밝은 쪽 6/어두운 쪽 4로 어두운 바닥·벽 앞에서도 살이 보이게. 띠 3px',
 'C': 'C(재질·무늬): A 구조에 녹(rust) 얼룩·교차점 녹·창살 밑으로 흐른 녹물·긁힌 흠',
}
if __name__ == '__main__':
    for c, f in (('A', A), ('B', B), ('C', C)):
        g, mats = f(); emit('door_cell', c, 16, 32, mats, g, NOTES[c], layer='main')
