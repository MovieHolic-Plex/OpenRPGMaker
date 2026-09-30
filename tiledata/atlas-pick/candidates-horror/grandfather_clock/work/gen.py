import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/floor_creaky/work')
from h3_shapes import *
LG = L(mahog='0123456', murk='efghijk', moon='lmnopq', void='abcd', dust='STUVWXY', sheet='rstuvwx', tarn='yzABCD', blood='EFGHIJ')
def clock(k=1):
    hi, mid, lo, ol, dk = (5, 3, 2, 1, 0) if k == 1 else (6, 4, 1, 0, 0)
    g = G(16, 32); M = '0123456'
    # 관(몸통)
    for y in range(16, 27):
        g.h(4, 11, y, M[mid]); g.put(4, y, M[ol]); g.put(5, y, M[hi]); g.put(11, y, M[dk]); g.put(10, y, M[lo])
    # 머리 상자
    for y in range(6, 16):
        g.h(2, 13, y, M[mid]); g.put(2, y, M[ol]); g.put(3, y, M[hi]); g.put(13, y, M[dk]); g.put(12, y, M[lo])
    g.h(2, 13, 15, M[ol]); g.h(3, 12, 16, M[lo] if k == 1 else M[ol])
    # 둥근 머리(페디먼트)
    for y, (a, b) in enumerate([(6, 9), (4, 11), (3, 12), (2, 13), (2, 13)]):
        g.h(a, b, y, M[mid]); g.put(a, y, M[ol]); g.put(b, y, M[dk]);
        if y > 0: g.put(a + 1, y, M[hi]); g.put(b - 1, y, M[lo])
    g.h(6, 9, 0, M[hi]); g.h(2, 13, 5, M[hi]); g.put(2, 5, M[ol]); g.put(13, 5, M[dk]); g.h(3, 12, 6, M[lo] if k == 1 else M[ol])
    g.pts(M[hi + 0 if hi < 7 else 6], 7, 1, 8, 1) if False else None
    # 문자판
    ell(g, 7.5, 10.5, 4.2, 4.2, 'v', lambda x, y: 'v' if (x + y) % 9 else 'u')
    ell(g, 7.5, 10.5, 4.2, 4.2, 'v')
    for (x, y) in ((7, 6), (8, 6), (3, 10), (3, 11), (12, 10), (12, 11), (7, 15), (8, 15)):
        pass
    for x in range(3, 13):
        for y in range(6, 16):
            dx, dy = x - 7.5, y - 10.5
            r = dx * dx + dy * dy
            if r <= 17.6:
                g.put(x, y, 'w' if k == 1 else 'x')
                if dx < 0 or dy < 0: g.put(x, y, 'w' if k == 1 else 'x')
                else: g.put(x, y, 'u' if k == 1 else 'v')
            if 17.6 < r <= 26 and 3 <= x <= 12 and 6 <= y <= 15 and r <= 22.5:
                g.put(x, y, 'A')            # 놋쇠 테(tarn 3)
    # 로마 숫자 대신 12·3·6·9 점
    for (x, y) in ((7, 7), (8, 7), (5, 10), (10, 10), (7, 13), (8, 13)): pass
    g.pts('c', 7, 6, 8, 6, 4, 10, 11, 10, 4, 11, 11, 11, 7, 15, 8, 15) if False else None
    # 멈춘 바늘(4시 20분 부근): 분침 위, 시침 오른쪽 아래
    g.pts('a', 7, 7, 7, 8, 7, 9, 8, 10, 7, 10, 8, 11, 9, 11, 10, 12)
    g.pts('b', 8, 9) if False else None
    # 창(유리문)
    g.rect(5, 17, 10, 25, 'f'); g.h(5, 10, 17, 'e'); g.v(5, 17, 25, 'e'); g.h(5, 10, 25, 'e'); g.v(10, 17, 25, 'e')
    g.rect(6, 18, 9, 24, 'g' if k == 1 else 'f'); g.pts('h', 6, 18, 6, 19, 7, 18) if k == 1 else g.pts('j', 6, 18, 6, 19, 7, 18, 6, 20)
    # 멈춘 추(tarn): 왼쪽으로 기울어 멈춤
    g.pts('B', 8, 18, 7, 19, 7, 20, 6, 21, 6, 22)
    g.pts('C', 5 + 1, 23, 7, 23, 6, 24, 7, 24) if False else None
    g.rect(6, 23, 7, 24, 'C'); g.pts('B', 6, 23); g.pts('y', 7, 24)
    # 아래 받침
    for y in range(27, 32):
        g.h(3, 12, y, M[mid]); g.put(3, y, M[ol]); g.put(4, y, M[hi]); g.put(12, y, M[dk]); g.put(11, y, M[lo])
    g.h(2, 13, 26, M[hi]); g.put(2, 26, M[ol]); g.put(13, 26, M[dk])
    g.h(3, 12, 31, M[dk]); g.h(5, 10, 29, M[ol]); g.h(5, 10, 30, M[lo]) ; g.v(5, 29, 30, M[ol]) if False else None
    return g
def crack(g):
    for x, y in ((9, 18), (9, 19), (8, 20), (8, 21), (9, 22), (9, 23)): g.put(x, y, 'p')
    g.pts('a', 10, 19, 9, 21, 10, 22) 
def dust(g): 
    g.pts('W', 6, 0, 8, 0, 3, 5, 5, 5, 11, 5); g.pts('X', 7, 0, 4, 5)
    g.pts('V', 6, 26, 9, 26, 12, 26)
A = clock(1); crack(A); dust(A)
B = clock(2); crack(B)
B.pts('~', 13, 30, 14, 30, 15, 30, 14, 31, 15, 31, 13, 31, 2, 31, 1, 31); B.pts('-', 15, 29, 15, 28); B.pts('6', 3, 7, 3, 8, 4, 8); B.pts('6', 5, 3)
C = clock(1); dust(C)
# 창 안: 추 대신 어둠 속의 눈 한 쌍
for x, y in ((8, 18), (7, 19), (7, 20), (6, 21), (6, 22)): C.put(x, y, 'f')
C.rect(6, 23, 7, 24, 'f')
C.rect(6, 18, 9, 24, 'a'); 
C.pts('x', 6, 19, 9, 19, 6, 20, 9, 20)
C.pts('G', 6, 20, 9, 20)
C.pts('s', 6, 21, 9, 21)
notes = {'A': ('v5 시계를 묵힘: 멈춘 바늘·왼쪽으로 기운 채 멈춘 추, 유리에 금 한 줄, 머리·받침 위에 먼지', A),
         'B': ('빛 대비 강화: 왼쪽 결 최고 밝기·오른쪽 최암, 윤곽 최암, 바닥 오른쪽 접촉 그림자', B),
         'C': ('추가 멈춘 것이 아니라 유리 안 어둠에서 흰 눈 한 쌍이 밖을 본다 — 추는 없다', C)}
finish('grandfather_clock', notes, LG)
