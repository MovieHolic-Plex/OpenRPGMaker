import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'wall_stone_block', 'work'))
from hf7_lib import *

def glow(g, cx, cy, r, top=2):
    """빛 번짐 %: 원판 안의 빈칸(main 이 안 그린 칸)만. 손으로 정한 반지름 규칙."""
    out = [['.'] * 16 for _ in range(16)]
    for y in range(top, 16):
        for x in range(16):
            if g.m[y][x] == '.' and (x - cx) ** 2 + (y - cy) ** 2 <= r * r: out[y][x] = '%'
    return out

def emit_torch(cand, g, mats, gl, note):
    emit('torch_wall', cand, 16, 16, mats, g, note)
    p = f'{CAND}/torch_wall/hf7-{cand}.pxg'
    s = open(p, encoding='utf-8').read()
    s += '@layer shadow\n@block 0 0\n' + '\n'.join(''.join(r) for r in gl) + '\n'
    open(p, 'w', encoding='utf-8').write(s)

def lantern(g, iron, flame, hi, lo, big):
    ir = [
     "......4554......", ".....244442.....", ".....3....2.....", ".....3....2.....", ".....3....2.....",
     ".....3....2.....", ".....3....2.....", ".....355552.....", ".......33.......", ".......32.......", "......3443......", "......2332......"]
    # y2.. 로 놓음
    g.rows(0, 2, 'i', ir)
    for y in range(4, 10): g.hline(6, y, 4, 'i', 0)
    fl = [".......3........", ".......54.......", "......3553......", "......4554......", ".......44......."] if not big else \
         [".......4........", "......354.......", "......3553......", ".....355553.....", "......4554......"]
    g.rows(0, 5, 'f', fl)
    g.hline(6, 9, 4, 'i', 1)
    return g

def A():
    g = G(16, 16); lantern(g, 'i', 'f', 5, 2, False)
    return g, {'i': 'viron', 'f': 'flame'}, glow(g, 7.5, 7.5, 6.6)
def B():
    g = G(16, 16); lantern(g, 'i', 'f', 6, 3, True)
    # 밝은 쪽 창살을 한 단 밝게
    for y in range(4, 10): g.put(5, y, 'i', 5)
    g.hline(5, 9, 6, 'i', 5)
    return g, {'i': 'viron', 'f': 'flame'}, glow(g, 7.5, 7, 7.4)
def C():
    g = G(16, 16)
    # 나무 횃불 : 불꽃 y2-6, 감은 머리 y7-8, 쇠고리 y9, 자루 y10-14
    g.rows(0, 2, 'f', ["........4.......", ".......354......", ".......3553.....", "......355553....", "......3455543...", ".......4554....."])
    g.rows(0, 8, 'w', ["......3443......", "......2332......"])
    g.rows(0, 10, 'i', [".....345543.....", "......1..1......"])
    g.rows(0, 12, 'w', ["......4321......", "......4321......", "......3210......"])
    g.pts('w', [(7, 9, 5)])
    g.pts('r', [(6, 12, 2), (8, 13, 2)])
    return g, {'f': 'flame', 'w': 'rot', 'i': 'viron', 'r': 'rust'}, glow(g, 7.5, 6, 6.6)
NOTES = {
 'A': 'A(v5 식구·깨끗): 쇠 벽등롱 — 뚜껑·네 기둥·바닥판·걸이. 작은 불꽃(flame 3~5) 한 프레임 + 주변 % 빛 번짐 원판(반지름 6.6). 위 2줄 비움',
 'B': 'B(어둠에서 읽힘): 불꽃을 크게(폭 6px) + 등롱 왼쪽 살을 밝게 5, 번짐 반지름 7.4로 주변 벽이 확실히 밝아짐',
 'C': 'C(재질·무늬): 나무 횃불 — 기름 먹은 rot 머리·쇠고리·그을린 자루 + 녹 점, 위쪽 큰 불꽃, 번짐 6.6',
}
if __name__ == '__main__':
    for c, f in (('A', A), ('B', B), ('C', C)):
        g, mats, gl = f(); emit_torch(c, g, mats, gl, NOTES[c])
