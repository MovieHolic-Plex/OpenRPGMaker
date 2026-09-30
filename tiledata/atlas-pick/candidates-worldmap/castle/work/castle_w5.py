import sys; sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap/village/work')
from cyl_w5 import *


def castle(mode):
    c = Cv(32, 32)
    B, R = BLU[mode], RED[mode]
    wallseg(c, 8, 23, 20, 30, mode)
    cyl(c, 1, 7, 16, 30, mode, roof=B, roofh=9)
    cyl(c, 24, 30, 16, 30, mode, roof=B, roofh=9)
    cyl(c, 10, 21, 10, 21, mode, roof=B, roofh=9)
    flag(c, 15, 0, 4, 'F', 'f')
    door(c, 14, 24, 30)
    return c


def castleC():
    """실루엣 재해석: 가늘고 높은 주탑, 붉은 지붕 곁탑 둘"""
    c = Cv(32, 32)
    B, R = BLU['B'], RED['B']
    wallseg(c, 3, 28, 24, 30, 'B')
    cyl(c, 2, 6, 18, 30, 'B', roof=R, roofh=6)
    cyl(c, 25, 29, 18, 30, 'B', roof=R, roofh=6)
    cyl(c, 12, 19, 9, 30, 'B', roof=B, roofh=8)
    c.hl(12, 19, 20, 'k')
    flag(c, 15, 0, 3, 'G', 'H')
    door(c, 14, 25, 30)
    c.shadow()
    return c


c = castle('A')
save('castle', 'A', c, '', 'oprn 아틀라스 결 — 평평한 돌 주탑과 곁탑 둘, 푸른 원뿔 지붕, 앞 성벽과 어두운 성문, 붉은 깃발 하나')
c = castle('B'); c.shadow()
save('castle', 'B', c, '', '빛·부피 — 왼쪽 밝고 오른쪽 어두운 원통 탑, 푸른 원뿔 지붕, 성벽 톱니, 발치 반투명 그림자')
save('castle', 'C', castleC(), '', '실루엣 재해석 — 가늘고 아주 높은 주탑 + 낮은 붉은 곁탑, 멀리서 세로로 솟은 실루엣')
