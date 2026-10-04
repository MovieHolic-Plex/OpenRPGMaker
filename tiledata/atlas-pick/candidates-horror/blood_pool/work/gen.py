import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/blood_pool/work')
from blood import *
SLUG = 'blood_pool'
def pool():
    m = ell_mask(6, 7, 4.6, 3.6) | ell_mask(9.5, 8.5, 4.6, 3.6) | ell_mask(12, 11.5, 2.4, 2.2) | ell_mask(4, 5, 2.2, 1.8)
    return m
def drops(g, mask, tone='3'):
    for x, y in ((13, 3), (14, 5), (2, 11)):
        g.put(x, y, tone)
        if (x, y+1) not in mask and (x, y+1) != (14, 5): pass
# A
a = G(16, 16); m = pool(); paint(a, m)
a.pts('5', 5, 4, 6, 4); a.pts('5', 3, 6)
a.pts('4', 7, 4, 4, 5)
a.pts('2', 10, 10, 11, 11, 9, 10)
a.pts('3', 13, 2, 14, 4, 2, 11)
a.pts('$', 13, 3, 14, 5, 2, 12, 3, 11, 1, 11)
# B: 강한 대비
b = G(16, 16); paint(b, m, hi='5', mid='2', edge='1', low='0', glint='5')
for x, y in m:
    if (x+1, y) in m and (x, y+1) in m and (x-1, y-1) in m and (x, y-1) in m and (x-1,y) in m: b.put(x, y, '2' if x+y < 13 else '1')
b.pts('5', 4, 4, 5, 4, 6, 4, 3, 6, 4, 5); b.pts('4', 7, 4, 3, 5, 2, 7)
b.pts('3', 5, 5, 6, 5, 4, 6)
b.pts('3', 13, 2, 14, 4, 2, 11); b.pts('$', 13, 3, 14, 5, 2, 12, 3, 11, 1, 11)
for x, y in ((14, 12), (15, 12), (15, 13), (14, 14), (13, 14), (12, 14), (11, 14)):
    if b.get(x, y) == '.': b.put(x, y, '-')
# C: 웅덩이 속에서 올려다보는 눈
c = G(16, 16); paint(c, m, mid='3')
c.pts('5', 5, 4, 6, 4); c.pts('4', 7, 4, 4, 5)
for x in range(6, 11): c.put(x, 8, 'e')
for x in range(6, 11): c.put(x, 9, 'e')
for x in (7, 8, 9): c.put(x, 7, 'd')
for x in (7, 8, 9): c.put(x, 10, 'c')
c.pts('a', 6, 8, 10, 8, 6, 9, 10, 9)
c.pts('5', 8, 8, 8, 9); c.pts('1', 8, 8, 8, 9); c.pts('0', 8, 8)
c.pts('g', 7, 8); c.pts('2', 10, 10, 11, 11, 9, 11)
c.pts('3', 13, 2, 14, 4, 2, 11); c.pts('$', 13, 3, 14, 5, 2, 12, 3, 11, 1, 11)
notes = {
 'A': ('고인 피: 왼위→오른아래로 흘러 기운 웅덩이(가운데 blood 3 단, 테 2 단), 윗테 반짝임 두 점, 오른아래 혀처럼 뻗은 자리, 튄 방울 셋, 바깥 $ 번짐', a),
 'B': ('빛 대비 강화: 왼위 테 5 단으로 번쩍, 오른아래는 0~1 단으로 검붉게 가라앉고 바깥에 접지 그림자 반투명', b),
 'C': ('웅덩이 한가운데 눈이 떠서 올려다본다(흰자 sheet, 붉은 홍채는 핏빛 blood 5→0 동공)', c),
}
finish(SLUG, notes, LG)
