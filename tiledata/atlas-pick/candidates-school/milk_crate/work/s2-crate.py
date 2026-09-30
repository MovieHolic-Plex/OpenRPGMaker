import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LEG():
    L = {}
    for i in range(7): L[chr(ord('0') + i)] = ('vblue', i)     # 0..6
    for i in range(7): L[chr(ord('a') + i)] = ('vwhite', i)    # a..g
    for i in range(7): L[chr(ord('p') + i)] = ('vred', i)      # p..v
    L['m'] = ('vblue', 2)
    return L

def crate(tag):
    c = C(16, 16); L = LEG(); B = tag == 'B'
    O = '1'
    hi, side, low = ('5', '4', '3') if not B else ('4', '3', '2')
    # 윗면: 테두리 + 안쪽 어두운 속 + 우유팩 머리
    c.rect(1, 3, 14, 6, O); c.rect(2, 4, 12, 4, hi); c.hl(2, 4, 12, '6' if not B else '5')
    c.rect(3, 5, 10, 3, '0')
    for i in range(4):
        x = 3 + i * 3
        c.rect(x, 5, 2, 3, 'e' if not B else 'd'); c.hl(x, 5, 2, 'g' if not B else 'f'); c.vl(x + 1, 6, 2, 'c')
    # 앞면 격자
    c.rect(1, 9, 14, 6, O); c.rect(2, 9, 12, 5, side)
    c.hl(2, 9, 12, hi); c.vl(2, 10, 4, hi)
    c.vl(13, 10, 4, low)
    for x in (4, 7, 10):
        c.rect(x, 10, 2, 3, '0')
    c.hl(2, 13, 12, low)
    for x in range(2, 15): c.put(x, 15, '~')
    c.put(15, 14, '-'); c.put(15, 13, '-')
    return c, L

def crate_C():
    """실루엣: 빨강 상자, 둥근 모서리, 우유팩이 위로 삐죽"""
    c = C(16, 16); L = LEG(); O = 'q'
    # 팩 머리가 상자 위로 솟음
    for i in range(4):
        x = 3 + i * 3
        c.rect(x, 0, 2, 4, 'e'); c.vl(x, 0, 4, 'f'); c.vl(x + 1, 0, 4, 'c'); c.put(x, 0, 'g'); c.put(x + 1, 0, 'e')
        c.hl(x, 1, 2, 'c')
    c.rect(1, 4, 14, 4, 'q'); c.rect(2, 5, 12, 2, 'r'); c.hl(2, 5, 12, 't'); c.vl(2, 5, 2, 't')
    c.put(1, 4, '.'); c.put(14, 4, '.')
    c.rect(1, 8, 14, 7, 'q'); c.rect(2, 8, 12, 6, 'r'); c.vl(2, 8, 6, 's'); c.vl(13, 8, 6, 'q')
    c.hl(2, 8, 12, 't')
    for x in (4, 7, 10):
        c.rect(x, 10, 2, 3, 'p')
    c.hl(2, 13, 12, 'q'); c.hl(2, 14, 12, 'q')
    c.put(1, 14, '.'); c.put(14, 14, '.')
    for x in range(2, 15): c.put(x, 15, '~')
    c.put(15, 14, '-'); c.put(15, 13, '-')
    return c, L

NOTE = {
 'A': '우유 상자 A: 파랑(vblue) 격자 플라스틱 상자, 윗면이 ¾ 보이고 안에 흰 우유팩 다섯 개 머리, 앞면에 격자 구멍 셋. 빛은 왼쪽 위, 오른쪽 아래가 한 단 어둡다.',
 'B': '명암 강조: 윗면과 앞면을 한 단 눌러 대비를 키우고 오른쪽 외곽을 짙게, 격자 구멍을 깊게.',
 'C': '실루엣 재해석: 빨강(vred) 상자, 모서리를 깎아 둥글게, 우유팩 머리를 위로 삐죽 솟게 해서 한 색 실루엣만으로도 팩 든 상자.',
}
if __name__ == '__main__':
    out = []
    for tag in 'AB':
        c, L = crate(tag); out.append(save('milk_crate', tag, c, L, NOTE[tag]))
    c, L = crate_C(); out.append(save('milk_crate', 'C', c, L, NOTE['C']))
    check(out)
