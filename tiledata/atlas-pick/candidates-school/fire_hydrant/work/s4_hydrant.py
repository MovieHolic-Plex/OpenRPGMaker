import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

def body(c, b, glow):
    # 상자 x2..13, y1..29
    for y in range(1, 30):
        for x in range(2, 14): c.px(x, y, 'vred', 3)
    c.hl(2, 1, 12, 'vred', 5 + b); c.vl(2, 1, 29, 'vred', 4 + b)
    c.vl(13, 2, 28, 'vred', 1); c.hl(3, 29, 11, 'vred', 1)
    c.hl(2, 1, 1, 'vred', 6)
    for (x, y) in [(2, 1), (13, 1), (2, 29), (13, 29)]: c.clear(x, y) if False else None
    # 표시등: 둥근 램프 y3..6
    for (x, y, t) in [(6,3,4),(7,3,6),(8,3,5),(9,3,3),(5,4,4),(6,4,6),(7,4,6),(8,4,5),(9,4,4),(10,4,3),(5,5,4),(6,5,5),(7,5,5),(8,5,4),(9,5,3),(10,5,2),(6,6,3),(7,6,3),(8,6,2),(9,6,2)]:
        c.px(x, y, 'vyellow' if False else 'vred', t)
    c.px(6, 4, 'vwhite', 6)
    if glow:
        for (x, y) in [(4, 4), (4, 5), (11, 4), (11, 5), (7, 2), (8, 2)]: c.px(x, y, '%')
    # 문 y8..27 오목
    c.rect(4, 8, 8, 19, 'vred', 2 + b if b < 0 else 2)
    c.hl(4, 8, 8, 'vred', 1); c.vl(4, 8, 19, 'vred', 1)
    c.hl(4, 27, 8, 'vred', 4); c.vl(11, 9, 18, 'vred', 4)
    # 흰 띠 (글자 없음) y15..17
    c.hl(5, 15, 6, 'vwhite', 6 if b > 0 else 5); c.hl(5, 16, 6, 'vwhite', 4); c.hl(5, 17, 6, 'vwhite', 2)
    # 손잡이
    c.vl(10, 21, 3, 'vbrass', 5); c.px(10, 21, 'vbrass', 6); c.px(10, 23, 'vbrass', 2)
    # 문 자물쇠 구멍
    c.px(9, 20, 'vblack', 1)
    for x in range(3, 14): c.px(x, 30, '-')

def A():
    c = C(16, 32); body(c, 0, False); return c
def B():
    c = C(16, 32); body(c, 1, True)
    # 왼쪽 강한 하이라이트, 오른쪽 짙은 그늘 
    c.vl(3, 9, 18, 'vred', 4); c.vl(12, 9, 18, 'vred', 0)
    for x in range(3, 15): c.px(x, 31, '~')
    return c
def Cc():
    c = C(16, 32)
    for y in range(1, 30):
        for x in range(2, 14): c.px(x, y, 'vred', 3)
    c.hl(2, 1, 12, 'vred', 5); c.vl(2, 1, 29, 'vred', 4); c.vl(13, 2, 28, 'vred', 1); c.hl(3, 29, 11, 'vred', 1)
    c.hl(4, 3, 8, 'vred', 1) if False else None
    # 둥근 유리 창 y5..14 (호스 코일이 보임)
    c.ell(7.5, 11, 4.8, 5, 'vred', 1)
    c.ell(7.5, 11, 3.8, 4, 'vglass', 2)
    for (x, y, t) in [(5,9,4),(6,8,4),(7,8,4),(9,9,3),(10,11,3),(9,13,3),(6,13,4),(5,12,3),(5,10,4)]:
        c.px(x, y, 'vwhite', t)
    c.px(6, 9, '&'); c.px(5, 9, '&')
    for (x, y) in [(6,11),(7,11),(8,11),(7,10),(7,12)]: c.px(x, y, 'vwhite', 2)
    # 아래 문: 흰 띠 없음, 점검 판넬 
    c.rect(4, 18, 8, 10, 'vred', 2); c.hl(4, 18, 8, 'vred', 1); c.vl(4, 18, 10, 'vred', 1); c.hl(4, 27, 8, 'vred', 4); c.vl(11, 19, 8, 'vred', 4)
    c.hl(5, 22, 6, 'vwhite', 5); c.hl(5, 23, 6, 'vwhite', 3)
    c.vl(10, 24, 2, 'vbrass', 5)
    for x in range(3, 14): c.px(x, 30, '-')
    return c

if __name__ == '__main__':
    write_item(A(), 'fire_hydrant', 'A', '소화전함: 붉은 상자, 위 둥근 표시등, 오목 문+흰 띠(글자 없음), 놋 손잡이, 한 줄 그림자')
    write_item(B(), 'fire_hydrant', 'B', '명암 강화: 왼쪽 밝은 줄·오른쪽 짙은 그늘, 표시등 % 빛무리, 흰 띠 밝게, 반투명 바닥 그림자')
    write_item(Cc(), 'fire_hydrant', 'C', '재해석: 문 위쪽 둥근 유리창(호스 코일이 보임) + 아래 점검판')
