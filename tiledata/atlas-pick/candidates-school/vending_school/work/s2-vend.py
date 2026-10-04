import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LEG():
    L = {}
    for i in range(6): L[chr(ord('g') + i)] = ('mwhite', i)    # g..l
    for i in range(8): L[chr(ord('A') + i)] = ('mglass', i)    # A..H
    for i in range(7): L[chr(ord('0') + i)] = ('locker', i)    # 0..6
    L['b'] = ('vblue', 3); L['c'] = ('vblue', 5); L['d'] = ('vblue', 1)
    L['y'] = ('vyellow', 3); L['z'] = ('vyellow', 5); L['x'] = ('vyellow', 1)
    L['w'] = ('vwhite', 5); L['u'] = ('vwhite', 2)
    L['n'] = ('vblue', 2); L['N'] = ('vblue', 4)
    return L

def sample(c, x, y, kind, B):
    # 4x5 캔: 병(파랑=우유팩 흰, 노랑=주스)
    if kind == 'milk':
        c.rect(x, y, 2, 5, 'w'); c.vl(x + 1, y, 5, 'u'); c.hl(x, y + 2, 2, 'c'); c.hl(x, y, 2, 'u')
    elif kind == 'juice':
        c.rect(x, y, 2, 5, 'y'); c.vl(x, y, 5, 'z'); c.vl(x + 1, y, 5, 'x'); c.hl(x, y, 2, 'x')
    else:
        c.rect(x, y, 2, 5, 'b'); c.vl(x, y, 5, 'c'); c.vl(x + 1, y, 5, 'd'); c.hl(x, y, 2, 'd')

def vend(tag):
    c = C(16, 32); L = LEG(); B = tag == 'B'
    body, hi, sh, dk = ('j', 'l', 'i', 'g') if not B else ('i', 'k', 'h', 'g')
    O = '1'
    c.rect(1, 1, 14, 30, O); c.rect(2, 2, 12, 28, body)
    c.vl(2, 2, 28, hi); c.vl(13, 2, 28, sh)
    if B: c.vl(12, 2, 28, sh)
    # 윗띠(파랑)
    c.rect(2, 2, 12, 4, 'n'); c.hl(2, 2, 12, 'N'); c.hl(2, 5, 12, 'd')
    c.rect(4, 3, 8, 1, 'w'); c.hl(4, 3, 8, 'u') if B else None
    # 진열창
    c.rect(3, 7, 10, 13, O); c.rect(4, 8, 8, 11, 'B' if not B else 'A')
    c.hl(4, 8, 8, 'E' if not B else 'D'); c.vl(4, 8, 11, 'D')
    # 선반 두 줄
    kinds = (('milk', 'juice', 'blue'), ('juice', 'blue', 'milk'))
    for r, y in enumerate((9, 15)):
        for i, k in enumerate(kinds[r]):
            sample(c, 4 + i * 3, y, k, B)
        c.hl(4, y + 5, 8, '3')
    # 유리 반사 대각
    c.put(11, 9, 'F'); c.put(10, 10, 'F') if not B else None
    # 버튼줄
    for x in (4, 6, 8):
        c.rect(x, 21, 1, 1, 'y' if x == 4 else 'c' if x == 6 else 'z')
    # 동전구 + 배출구
    c.rect(10, 21, 2, 3, '2'); c.put(10, 21, '4'); c.put(11, 22, '0')
    c.rect(4, 24, 8, 4, O); c.rect(5, 25, 6, 2, '0' if not B else '0'); c.hl(5, 25, 6, '1')
    c.hl(2, 29, 12, dk)
    # 그림자
    for x in range(2, 15): c.put(x, 31, '~')
    for x in range(15, 16): c.put(x, 30, '-')
    return c, L

def vend_C():
    c = C(16, 32); L = LEG(); O = '1'
    # 실루엣: 윗부분이 살짝 좁은 둥근 어깨 + 큰 창 + 굵은 다리 없이 땅에 딱
    c.rect(2, 0, 12, 1, O); c.rect(1, 1, 14, 30, O)
    c.rect(2, 1, 12, 29, 'j'); c.vl(2, 1, 29, 'l'); c.vl(13, 1, 29, 'i')
    c.rect(2, 1, 12, 5, 'n'); c.hl(2, 1, 12, 'N'); c.hl(2, 5, 12, 'd')
    c.rect(4, 3, 8, 1, 'w')
    c.rect(3, 6, 10, 15, O); c.rect(4, 7, 8, 13, 'B'); c.hl(4, 7, 8, 'E'); c.vl(4, 7, 13, 'D')
    for r, y in enumerate((8, 14)):
        for i in range(3):
            sample(c, 4 + i * 3, y, ('milk', 'juice', 'blue')[(i + r) % 3], False)
        c.hl(4, y + 5, 8, '3')
    c.put(11, 8, 'F'); c.put(10, 9, 'F')
    c.rect(4, 22, 3, 2, 'y'); c.rect(9, 22, 3, 2, '2')
    c.rect(3, 25, 10, 5, O); c.rect(4, 26, 8, 3, '0'); c.hl(4, 26, 8, '1')
    c.hl(2, 29, 12, 'g')
    for x in range(2, 15): c.put(x, 31, '~')
    c.put(15, 30, '-')
    return c, L

NOTE = {
 'A': '학교 음료 자판기 A: 흰(mwhite) 몸통, 파란 윗띠, 밝은 진열창(mglass)에 우유·주스·파랑 캔 두 줄, 버튼 세 개와 동전구, 아래 어두운 배출구. 일본 세트 자판기와 같은 키(32).',
 'B': '명암 강조: 몸통 앞면을 한 단 눌러 어둡게 하고 오른쪽 옆을 두 열 어둡게, 진열창은 더 깊은 색으로 눌러 견본이 튀게.',
 'C': '실루엣 재해석: 윗면 어깨를 둥글게 깎고 진열창을 큰 창으로 키워 견본이 한눈에 보임. 배출구는 넓은 문. 한 색 실루엣은 어깨 둥근 직사각.',
}
if __name__ == '__main__':
    out = []
    for tag in 'AB':
        c, L = vend(tag); out.append(save('vending_school', tag, c, L, NOTE[tag]))
    c, L = vend_C(); out.append(save('vending_school', 'C', c, L, NOTE['C']))
    check(out)
