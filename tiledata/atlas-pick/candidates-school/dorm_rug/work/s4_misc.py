import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

# ───────── dorm_rug 32x32 decal ─────────
def rug_rect(b):
    c = C(32, 32)
    x0, x1, y0, y1 = 2, 29, 4, 27          # 술 자리 1px 바깥
    base = 4 + b; edge = 2 - (1 if b else 0)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c.px(x, y, 'vlinen', base)
    # 가로 줄무늬: 4줄 단위 (sakura, vblue 번갈아)
    for y in range(y0 + 3, y1 - 2, 6):
        c.hl(x0 + 2, y, x1 - x0 - 3, 'sakura', 3 + b); c.hl(x0 + 2, y + 1, x1 - x0 - 3, 'sakura', 4 + b)
        c.hl(x0 + 2, y + 3, x1 - x0 - 3, 'vblue', 3 + b)
    # 테두리: 윗/왼쪽 밝게, 아래/오른쪽 어둡게
    c.hl(x0, y0, x1 - x0 + 1, 'vlinen', 6); c.vl(x0, y0, y1 - y0 + 1, 'vlinen', 6)
    c.hl(x0, y1, x1 - x0 + 1, 'vlinen', edge); c.vl(x1, y0, y1 - y0 + 1, 'vlinen', edge)
    # 짧은 변 술(위/아래 y0-1, y1+1 은 x 짝수)
    for x in range(x0 + 1, x1, 2):
        c.px(x, y0 - 1, 'vlinen', 5); c.px(x, y1 + 1, 'vlinen', 3)
    # 모서리 둥글게
    for (x, y) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]: c.clear(x, y)
    return c
def rugA():
    return rug_rect(0)
def rugB():
    c = rug_rect(-1)   # 밑 면 어둡게 
    # 진한 짙은 테두리 한 줄 + 바닥 그림자
    c.hl(3, 5, 25, 'vblue', 3); c.hl(3, 26, 25, 'vblue', 2); c.vl(3, 5, 22, 'vblue', 3); c.vl(28, 5, 22, 'vblue', 2)
    for x in range(4, 30): c.px(x, 29, '-')
    for x in range(30, 31): pass
    return c
def rugC():
    c = C(32, 32)
    rings = [(14, 11, 'vlinen', 4), (12, 9.4, 'sakura', 3), (10, 7.6, 'vlinen', 5), (8, 6.0, 'vblue', 3), (6, 4.4, 'vlinen', 4), (4, 3.0, 'sakura', 4)]
    for rx, ry, r, t in rings:
        c.ell(15.5, 16, rx, ry, r, t)
    # 바깥 테두리 1줄(아래 오른쪽 어둡게)
    for y in range(32):
        for x in range(32):
            v = c.at(x, y)
            if v and v[0] == 'vlinen' and v[1] == 4:
                dx = (x - 15.5) / 14.0; dy = (y - 16) / 11.0
                if dx*dx + dy*dy > 0.85:
                    c.px(x, y, 'vlinen', 6 if (x + y < 30) else 2)
    for x in range(8, 24): c.px(x, 28, '-')
    return c

if __name__ == '__main__':
    write_item(rugA(), 'dorm_rug', 'A', '기숙사 침대 밑 러그: 연한 면 소재 가로 줄무늬(벚꽃분홍·푸른 줄), 짧은 변 술, 둥근 모서리, 위·왼 밝은 테두리')
    write_item(rugB(), 'dorm_rug', 'B', '어두운 남색 테두리 안쪽 두르기 + 아래 짙은 단 + 바닥 그림자 한 줄로 명암 강화')
    write_item(rugC(), 'dorm_rug', 'C', '재해석: 직사각 대신 타원 러그, 동심원 링 5겹(분홍·파랑 교대)')
