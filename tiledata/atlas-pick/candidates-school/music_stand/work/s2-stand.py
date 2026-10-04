import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LG():
    return {'0': ('vblack', 0), '1': ('vblack', 1), '2': ('vblack', 2), '3': ('vblack', 3), '4': ('vblack', 4), '5': ('vblack', 5),
            'p': ('washi', 5), 'q': ('washi', 4), 'r': ('washi', 3), 's': ('washi', 1),
            'i': ('viron', 3), 'j': ('viron', 5), 'h': ('viron', 6), 'g': ('viron', 2)}

def base(c, tone_face, hi, lo, shade):
    # 사다리꼴 판(위 좁고 아래 넓음) + 악보 턱
    poly(c, [(4, 1), (11, 1), (13, 7), (2, 7)], '0')
    poly(c, [(5, 2), (10, 2), (12, 6), (3, 6)], tone_face)
    c.hl(5, 2, 6, hi); line(c, 5, 2, 3, 6, hi)
    line(c, 10, 2, 12, 6, lo) if False else None
    # 종이
    poly(c, [(5, 2), (10, 2), (11, 6), (4, 6)], 'p')
    c.vl(10, 3, 2, 'q'); c.hl(4, 6, 8, 'q'); c.put(11, 5, 'q')
    for (x, y, w) in ((6, 3, 4), (5, 5, 5)):
        c.hl(x, y, w, 'r')
    # 턱: 앞으로 튀어나온 어두운 띠 + 밝은 위 줄
    c.rect(1, 7, 14, 2, '0'); c.hl(2, 7, 12, hi); c.hl(2, 8, 12, shade)

def legs(c, lc, dc):
    c.vl(8, 9, 4, 'i'); c.vl(7, 9, 4, lc); c.vl(9, 9, 4, dc)
    c.hl(6, 12, 5, 'i')
    line(c, 7, 13, 2, 14, lc); line(c, 9, 13, 14, 14, dc); c.vl(8, 13, 2, 'g')
    c.put(2, 14, dc); c.put(14, 14, '0')

def stand_A():
    c = C(16, 16); L = LG()
    base(c, '2', '4', '1', '1'); legs(c, 'j', 'g')
    for x in range(2, 15):
        if c.get(x, 15) == '.': c.put(x, 15, '~')
    return c, L

def stand_B():
    c = C(16, 16); L = LG()
    base(c, '1', '5', '0', '0'); legs(c, 'h', 'g')
    c.put(8, 9, '0'); c.put(9, 9, '0'); c.put(7, 9, '0')
    for x in range(2, 16):
        if c.get(x, 15) == '.': c.put(x, 15, '~')
    for x in range(9, 16):
        if c.get(x, 14) == '.': c.put(x, 14, '-')
    return c, L

def stand_C():
    """실루엣: 굵은 삼각 A자 다리 + 종이 크게, 판은 위로 갈수록 크게(뒤로 젖힌 판이 넓게 읽힘)"""
    c = C(16, 16); L = LG()
    poly(c, [(1, 1), (14, 1), (12, 8), (3, 8)], '0')
    poly(c, [(2, 2), (13, 2), (11, 7), (4, 7)], '3')
    c.hl(2, 2, 12, '5')
    poly(c, [(3, 2), (12, 2), (11, 6), (4, 6)], 'p')
    c.hl(4, 6, 8, 'q'); c.vl(12, 2, 3, 'q')
    for (x, y, w) in ((4, 3, 7), (5, 5, 5)):
        c.hl(x, y, w, 'r')
    c.hl(3, 8, 10, '5'); c.hl(3, 9, 10, '0')
    c.vl(8, 10, 3, 'j'); c.vl(9, 10, 3, 'g')
    line(c, 8, 12, 2, 15, 'j'); line(c, 9, 12, 14, 15, 'g'); c.vl(8, 13, 3, 'i'); c.vl(9, 13, 3, 'g')
    for x in range(3, 14):
        if c.get(x, 15) == '.': c.put(x, 15, '-')
    return c, L

NOTE = {
 'A': '보면대 A: 검정 판(외곽 0단·면 2단·왼쪽 위 4단)에 악보 종이 washi 한 장(오른쪽·아래 그늘, 오선 두 줄 점선), 악보 턱 한 줄, 쇠 기둥 세 단, 세 발. 피아노 A와 같은 vblack 톤 사다리.',
 'B': '명암 강조: 판 면 1단·왼쪽 위 5단 광택, 기둥 위에 판 그림자 2칸, 발치 ~ - 그림자. 피아노 B와 같은 눌린 명암.',
 'C': '실루엣: 폭 넓은 사다리꼴 판과 A자 다리로 세 발이 뚜렷하게 갈라짐. 피아노 C처럼 굵은 덩어리 위주.',
}
if __name__ == '__main__':
    out = []
    for tag, f in (('A', stand_A), ('B', stand_B), ('C', stand_C)):
        c, L = f(); out.append(save('music_stand', tag, c, L, NOTE[tag]))
    check(out)
