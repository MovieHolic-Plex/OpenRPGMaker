import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/village/work')
from cyl_w5 import *

def tower(mode, x0=3, x1=12, ytop=11, roof=None, roofh=10, cren=False):
    c = Cv(16, 32)
    cyl(c, x0, x1, ytop, 30, mode, roof=roof, roofh=roofh, crenel=cren)
    # 아래 창 하나 더
    mx = (x0 + x1) // 2
    c.put(mx, ytop + 9, 'K'); c.put(mx, ytop + 10, 'K')
    # 기단
    c.hl(x0 - 1, x1 + 1, 30, 'u' if mode == 'A' else 'v'); c.hl(x0 - 1, x1 + 1, 29, 'S' if mode == 'B' else 's')
    door(c, mx - 1, 24, 30, 3) if False else None
    c.rect(mx - 1, 25, mx, 30, 'K'); c.hl(mx - 1, mx, 24, 'K'); c.put(mx - 1, 26, 'B') if False else None
    return c

B_, R_ = BLU, RED
c = tower('A', roof=B_['A'], roofh=11)
save('tower', 'A', c, '', 'oprn 아틀라스 결 — 평평한 돌 원통 탑, 창 둘, 푸른 원뿔 지붕, 어두운 문, 그림자 없음')
c = tower('B', roof=B_['B'], roofh=11); c.shadow()
save('tower', 'B', c, '', '빛·부피 — 왼쪽 밝고 오른쪽 어두운 원통, 돌 줄 마디, 푸른 원뿔 지붕, 발치 반투명 그림자')
# C: 지붕 없이 톱니 흉벽 + 붉은 깃발, 위로 갈수록 굵어지는 망루
c = Cv(16, 32)
cyl(c, 4, 11, 14, 30, 'B', crenel=True)
for y in range(6, 14):
    for x in range(2, 14):
        f = (x - 2) / 11
        c.put(x, y, 'S' if f < .2 else ('s' if f < .5 else ('t' if f < .8 else 'u')))
c.rect(13, 6, 13, 13, 'k'); c.rect(2, 6, 2, 13, 'S')
for x in range(2, 14):
    if (x - 2) % 3 == 0:
        c.put(x, 5, 't'); c.put(x, 4, 's')
c.hl(2, 13, 13, 'v'); c.hl(2, 13, 14, 'k') if False else None
c.put(5, 9, 'K'); c.put(5, 10, 'K'); c.put(10, 9, 'K'); c.put(10, 10, 'K')
flag(c, 7, 0, 4, 'F', 'f')
c.rect(7, 25, 8, 30, 'K'); c.hl(7, 8, 24, 'K')
c.shadow()
save('tower', 'C', c, '', '실루엣 재해석 — 지붕 대신 위가 굵은 톱니 망루와 붉은 깃발, 가는 몸통, 멀리서 못처럼 보임')
