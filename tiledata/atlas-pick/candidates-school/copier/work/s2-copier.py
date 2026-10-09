import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LEG():
    L = {}
    for i in range(7): L[chr(ord('0') + i)] = ('locker', i)   # 0..6
    for i in range(6): L[chr(ord('a') + i)] = ('cream', i)     # a..f
    for i in range(6): L[chr(ord('g') + i)] = ('mwhite', i)    # g..l  (g=darkest)
    for i in range(6): L[chr(ord('p') + i)] = ('washi', i)     # p..u
    for i in range(8): L[chr(ord('A') + i)] = ('mdglass', i)   # A..H
    L['v'] = ('vgreen', 3); L['V'] = ('vgreen', 5); L['m'] = ('vred', 3)
    return L

def copier(tag):
    c = C(16, 32); L = LEG()
    B = tag == 'B'
    hi, mid, sh, dk = ('l', 'k', 'i', 'g') if not B else ('k', 'i', 'h', 'g')
    face = 'j' if not B else 'i'
    O = '1'
    # 윗면(유리 덮개) — 윗면이 ¾ 보이는 상자
    c.rect(1, 4, 13, 9, O); c.rect(2, 5, 11, 7, mid)
    c.hl(2, 5, 11, hi); c.vl(2, 5, 7, hi)
    c.hl(2, 11, 11, sh); c.vl(12, 5, 7, sh) if B else None
    c.rect(3, 6, 8, 5, 'C'); c.hl(3, 6, 8, 'F'); c.vl(3, 6, 5, 'E')
    c.put(9, 7, 'G'); c.put(8, 8, 'G'); c.put(7, 9, 'F')  # 유리 반사 대각
    c.hl(4, 10, 7, 'B')
    # 조작판 띠
    c.rect(1, 13, 13, 4, O); c.rect(2, 14, 11, 2, '3' if not B else '2')
    c.hl(2, 14, 11, '5' if not B else '4')
    c.rect(3, 15, 4, 1, 'D'); c.put(9, 15, 'v'); c.put(11, 15, 'm')
    if B: c.hl(2, 16, 11, dk)
    # 몸통 앞면
    c.rect(1, 17, 13, 12, O); c.rect(2, 17, 11, 11, face)
    c.vl(2, 17, 11, hi if not B else mid); c.vl(12, 17, 11, sh)
    if B: c.vl(11, 17, 11, sh)
    # 종이 서랍 둘
    for y0 in (18, 23):
        c.rect(3, y0, 8, 4, '4' if not B else '3'); c.hl(3, y0, 8, '5' if not B else '4')
        c.hl(3, y0 + 3, 8, '2' if not B else '1'); c.vl(3, y0, 4, '5' if not B else '4')
        c.hl(6, y0 + 1, 3, '1')   # 손잡이 홈
    c.hl(2, 28, 11, dk)
    # 다리
    c.rect(2, 29, 2, 1, O); c.rect(11, 29, 2, 1, O)
    # 옆 출력 트레이 + 종이 한 장
    c.rect(13, 14, 3, 1, O)
    c.rect(13, 15, 3, 3, '4' if not B else '3'); c.hl(13, 15, 3, '5' if not B else '4'); c.hl(13, 17, 3, O)
    c.rect(14, 12, 2, 3, 'u' if not B else 't'); c.hl(14, 12, 2, 'u'); c.vl(15, 13, 2, 's')
    # 그림자
    for x in range(2, 15):
        c.put(x, 30, '~')
    for x in range(4, 16): c.put(x, 31, '-') if B else None
    if not B: c.put(15, 30, '-')
    return c, L

def copier_C():
    """실루엣: 위로 튀어나온 자동급지기(혹) + 왼쪽 넓은 종이 받침 + 굵은 한 덩어리"""
    c = C(16, 32); L = LEG(); O = '1'
    # 자동급지기(뚜껑 위 혹)
    c.rect(3, 1, 9, 5, O); c.rect(4, 2, 7, 3, 'k'); c.hl(4, 2, 7, 'l'); c.vl(4, 2, 3, 'l'); c.hl(4, 4, 7, 'i')
    c.rect(5, 0, 5, 2, 'u'); c.hl(5, 0, 5, 'u'); c.hl(5, 1, 5, 's')  # 종이 더미가 솟아 있음
    # 윗면
    c.rect(1, 6, 14, 6, O); c.rect(2, 7, 12, 4, 'k'); c.hl(2, 7, 12, 'l'); c.vl(2, 7, 4, 'l')
    c.rect(4, 8, 7, 2, 'C'); c.hl(4, 8, 7, 'F'); c.put(9, 9, 'G')
    # 조작판
    c.rect(1, 12, 14, 3, O); c.rect(2, 13, 12, 1, '3'); c.rect(3, 13, 4, 1, 'D'); c.put(10, 13, 'v'); c.put(12, 13, 'm')
    # 몸통
    c.rect(1, 15, 14, 14, O); c.rect(2, 15, 12, 13, 'j'); c.vl(2, 15, 13, 'k'); c.vl(13, 15, 13, 'h')
    c.hl(2, 27, 12, 'h')
    # 서랍 셋(굵은 줄)
    for y0 in (17, 21, 25):
        c.rect(3, y0, 10, 3, '4'); c.hl(3, y0, 10, '5'); c.hl(3, y0 + 2, 10, '2'); c.hl(7, y0 + 1, 2, '1')
    c.rect(2, 29, 3, 1, O); c.rect(11, 29, 3, 1, O)
    for x in range(2, 16): c.put(x, 30, '~')
    for x in range(4, 16): c.put(x, 31, '-')
    return c, L

NOTE = {
 'A': '복합기 A: 흰(mwhite) 몸통 + 유리 덮개(mdglass, 대각 반사)가 윗면으로 보이는 상자, 조작판 띠에 초록 점, 종이 서랍(locker) 둘, 오른쪽 출력 트레이에 종이 한 장. 빛은 왼쪽 위, 오른쪽 아래가 한 단 어둡다. staff_desks A(회색 쇠 + cream)와 같은 덩어리 명암.',
 'B': '명암 강조: 몸통 앞면을 한 단 눌러 어둡게, 오른쪽 옆면을 두 열 어둡게, 서랍도 눌러 앞면-윗면 대비를 크게. 바닥 그림자를 두 줄로 짙게. staff_desks B 와 같은 눌린 명암.',
 'C': '실루엣 재해석: 뚜껑 위 자동급지기 혹과 종이 더미가 위로 튀고, 서랍이 세 줄 굵은 띠로 쌓임. 한 색 실루엣만 봐도 급지기 달린 복합기. staff_desks C 처럼 키를 높인 덩어리.',
}
if __name__ == '__main__':
    out = []
    for tag in 'AB':
        c, L = copier(tag); out.append(save('copier', tag, c, L, NOTE[tag]))
    c, L = copier_C(); out.append(save('copier', 'C', c, L, NOTE['C']))
    check(out)
