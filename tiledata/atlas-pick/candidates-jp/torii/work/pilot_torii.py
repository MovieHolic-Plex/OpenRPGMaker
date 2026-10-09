# 파일럿: 도리이 pilot-A/B/C (64×64, 4×4칸). 부재마다 사각형으로 글자 격자를 깐 뒤, 빛(왼쪽 위)·윤곽 단을 손으로 정한 규칙으로 놓는다.
#   python3 tiledata/atlas-pick/candidates-jp/torii/work/pilot_torii.py
import os, sys
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(D, '../../../../scripts/content/atlas-pick'))
from pxg_emit import emit

W = H = 64
def blank(): return [['.'] * W for _ in range(H)]
def rect(g, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < W and 0 <= yy < H: g[yy][xx] = c

L = {
    # 주홍 부재: 윤곽 1 · 그늘 2 · 몸통 3 · 빛 4 · 밝은 윗면 5
    '1': ('shu', 1), '2': ('shu', 2), '3': ('shu', 3), '4': ('shu', 4), '5': ('shu', 5), '6': ('shu', 6),
    # 검정 가사기·받침: 윤곽 0 · 몸통 2 · 윗면 4
    'k': ('lacq', 0), 'K': ('lacq', 2), 'Q': ('lacq', 3), 'q': ('lacq', 4), 'z': ('lacq', 5),
    # 돌 받침
    's': ('ishi', 1), 'S': ('ishi', 3), 'T': ('ishi', 4), 't': ('ishi', 5),
    # 액자 글자판
    'p': ('washi', 3), 'P': ('washi', 4), 'j': ('sumi', 1), 'm': ('moss', 2),
}

def beam(g, x, y, w, h, top=True):
    """가로 주홍 부재: 윗줄 밝은 윗면(5), 몸통 3, 아랫줄 그늘 2, 테 1(아래·오른)."""
    rect(g, x, y, w, h, '3')
    if top: rect(g, x, y, w, 1, '5')
    rect(g, x, y + h - 1, w, 1, '1'); rect(g, x + w - 1, y, 1, h, '1'); rect(g, x, y, 1, h, '2')
    if h >= 4: rect(g, x + 1, y + h - 2, w - 2, 1, '2')

def pillar(g, x, y, w, h, bright=True):
    """기둥: 왼 테 2, 왼 안쪽 빛 4, 몸통 3, 오른 그늘 2, 오른 테 1."""
    rect(g, x, y, w, h, '3'); rect(g, x, y, 1, h, '2'); rect(g, x + w - 1, y, 1, h, '1'); rect(g, x + w - 2, y, 1, h, '2')
    if bright: rect(g, x + 1, y, 1, h, '4')

def kasagi(g, y, x0, x1, lift=2, thick=4):
    """맨 위 검정 가사기: 가운데 곧고 양 끝이 lift 만큼 들린다(계단 1-2-3 늘어남)."""
    rect(g, x0 + 6, y, x1 - x0 - 12, thick, 'K'); rect(g, x0 + 6, y, x1 - x0 - 12, 1, 'q')
    for i, (dx, dy) in enumerate(((0, lift), (2, lift - 1 if lift > 1 else 0), (4, 0))):
        pass
    # 왼 끝: 바깥으로 갈수록 한 줄씩 올라간다(6칸을 3계단 × 2칸)
    for k in range(3):
        rect(g, x0 + 4 - 2 * k, y - k if k else y, 2, thick, 'K'); rect(g, x0 + 4 - 2 * k, y - k if k else y, 2, 1, 'q')
        rect(g, x1 - 6 + 2 * k, y - k if k else y, 2, thick, 'K'); rect(g, x1 - 6 + 2 * k, y - k if k else y, 2, 1, 'q')
    # 아래 테 윤곽 한 줄
    for xx in range(x0, x1):
        for yy in range(H - 1, -1, -1):
            if g[yy][xx] in 'Kq':
                g[yy][xx] = 'k'; break
    rect(g, x1 - 1, y - 2, 1, thick, 'k')

def base_stone(g, x, y, w, h):
    rect(g, x, y, w, h, 'Q'); rect(g, x, y, w, 1, 'z'); rect(g, x, y + h - 1, w, 1, 'k'); rect(g, x + w - 1, y, 1, h, 'k'); rect(g, x + 1, y + 1, 1, h - 2, 'q')

def plaque(g, x, y, w, h):
    rect(g, x, y, w, h, 'k'); rect(g, x + 1, y + 1, w - 2, h - 2, 'P'); rect(g, x + w - 2, y + 1, 1, h - 2, 'p'); rect(g, x + 1, y + h - 2, w - 2, 1, 'p')
    for yy in range(y + 3, y + h - 3, 3): rect(g, x + w // 2 - 1, yy, 2, 2, 'j')   # 세로 글자 자국 두세 덩이

def shadow(g, pts):
    for (x, y, w) in pts:
        for xx in range(x, x + w):
            if 0 <= xx < W and g[y][xx] == '.': g[y][xx] = '~' if xx < x + w - 2 else '-'

def A():
    """강남 조각 결: 부재 굵기 고르게, 한 단 명암, 받침은 검정 칠."""
    g = blank()
    kasagi(g, 6, 1, 63)
    beam(g, 4, 10, 56, 3, top=False)                  # 시마기
    beam(g, 3, 20, 58, 4)                             # 누키(기둥 밖으로 나옴)
    pillar(g, 11, 13, 6, 45); pillar(g, 47, 13, 6, 45)
    plaque(g, 28, 12, 8, 9)
    base_stone(g, 9, 57, 10, 4); base_stone(g, 45, 57, 10, 4)
    shadow(g, [(19, 60, 3), (55, 60, 3), (10, 61, 11), (46, 61, 11)])
    return g

def B():
    """명암·그림자 강화: 가사기 윗면 두 줄, 기둥 빛 두 줄, 누키 아래 그늘, 기둥 밑 돌 받침 + 긴 그림자."""
    g = blank()
    kasagi(g, 6, 1, 63, thick=5)
    rect(g, 7, 7, 50, 1, 'z')                                  # 가사기 두 번째 윗면
    beam(g, 4, 11, 56, 3, top=False)
    beam(g, 2, 20, 60, 5)
    rect(g, 3, 25, 58, 1, '.')
    pillar(g, 11, 14, 7, 44); pillar(g, 46, 14, 7, 44)
    for (x) in (12, 47): rect(g, x + 1, 14, 1, 44, '5')        # 기둥 왼 안쪽 밝은 줄 한 줄 더
    for (x) in (11, 46): rect(g, x, 25, 7, 2, '2')             # 누키 밑 그늘이 기둥에 드리움
    plaque(g, 28, 13, 8, 10)
    for (x) in (9, 44):
        rect(g, x, 56, 11, 5, 'S'); rect(g, x, 56, 11, 1, 't'); rect(g, x + 1, 57, 1, 3, 'T'); rect(g, x + 10, 56, 1, 5, 's'); rect(g, x, 60, 11, 1, 's')
        rect(g, x + 1, 58, 2, 1, 'm')
    shadow(g, [(20, 57, 3), (55, 57, 3), (20, 58, 4), (55, 58, 4), (20, 59, 5), (55, 59, 5), (10, 61, 14), (45, 61, 14), (12, 62, 12), (47, 62, 12)])
    return g

def C():
    """실루엣 재해석: 더 굵은 기둥이 안쪽으로 살짝 기운 판(위가 좁다), 가사기 끝이 크게 휜다, 액자 크게, 누키 한 칸 아래."""
    g = blank()
    kasagi(g, 7, 0, 64, lift=3, thick=5)
    for k in range(3):   # 끝 휨 한 단 더
        rect(g, 0, 4, 2, 2, 'K'); rect(g, 62, 4, 2, 2, 'K'); rect(g, 0, 4, 2, 1, 'q'); rect(g, 62, 4, 2, 1, 'q')
    beam(g, 5, 12, 54, 4, top=False)
    beam(g, 2, 24, 60, 4)
    for y in range(16, 58):   # 기울어진 기둥: 12줄마다 한 칸씩 바깥으로
        o = (y - 16) // 14
        for (x0) in (13 - o,):
            rect(g, x0, y, 7, 1, '3'); g[y][x0] = '2'; g[y][x0 + 1] = '4'; g[y][x0 + 5] = '2'; g[y][x0 + 6] = '1'
        x1 = 44 + o
        rect(g, x1, y, 7, 1, '3'); g[y][x1] = '2'; g[y][x1 + 1] = '4'; g[y][x1 + 5] = '2'; g[y][x1 + 6] = '1'
    beam(g, 2, 24, 60, 4)
    plaque(g, 27, 13, 10, 11)
    base_stone(g, 9, 57, 12, 4); base_stone(g, 44, 57, 12, 4)
    shadow(g, [(21, 60, 3), (56, 60, 3), (10, 61, 13), (45, 61, 13)])
    return g

notes = {
    'A': '강남 조각 결: 명신형 — 검정 가사기 양 끝 3계단 들림, 주홍 시마기·누키(기둥 밖으로), 기둥 한 단 빛, 가운데 액자, 검정 받침',
    'B': '명암 강화: 가사기 윗면 두 줄, 기둥 안쪽 밝은 줄 둘, 누키 밑 그늘이 기둥에 드리움, 돌 받침(이끼 점)과 오른쪽 아래 긴 그림자',
    'C': '실루엣 재해석: 기둥이 아래로 벌어진 판(위가 좁다), 가사기 끝을 크게 휨, 액자 크게, 누키를 한 칸 내림',
}
for k, fn in (('A', A), ('B', B), ('C', C)):
    g = fn(); rows = [''.join(r) for r in g]
    open(os.path.join(D, f'pilot-{k}.pxg'), 'w').write(emit(rows, L, f'torii pilot-{k}'))
    open(os.path.join(D, f'pilot-{k}.note'), 'w').write(notes[k] + '\n')
print('ok')
