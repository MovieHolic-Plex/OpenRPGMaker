from tray import *
# A
c = landscape(4, 5, 2, 3, ((('vgreen',4),('vgreen',5)), (('vyellow',4),('vyellow',5)), (('vred',3),('vred',4),('vred',5)), (('vwhite',5),('vwhite',6),('vwhite',3)), (('morange',3),('morange',4),('morange',1))))
fin(c, 'A', 'v5 결: 스테인리스 식판 다섯 칸, 흰 밥·주황 국·초록 나물·노란 계란·붉은 김치 점, 아래에 숟가락')
# B 강한 명암: 어두운 판, 밝은 음식
c = landscape(3, 5, 0, 2, ((('vgreen',3),('vleaf',6)), (('vyellow',4),('vyellow',6)), (('vred',3),('vred',5),('vred',6)), (('vwhite',6),('vwhite',6),('vwhite',2)), (('morange',2),('morange',4),('morange',0))))
fin(c, 'B', '센 명암: 어두운 강철 판에 음식만 환하게, 판 위 왼쪽에 흰 광택 띠, 깊은 아래 그늘')
# C 세로 식판 (실루엣)
c = C(16, 16)
c.rect(3, 0, 10, 13, ('tray', 4)) if False else None
c.rect(3, 1, 10, 13, ('tray', 4))
c.hl(3, 1, 10, ('tray', 5)); c.vl(3, 1, 13, ('tray', 5)); c.hl(3, 13, 10, ('tray', 2)); c.vl(12, 1, 13, ('tray', 2))
c.px(3, 1, '.'); c.px(12, 1, '.'); c.px(3, 13, '.'); c.px(12, 13, '.')
# 세로형 칸: 위 큰 칸 둘(밥·국), 아래 작은 세 칸
c.rect(4, 2, 4, 5, ('tray', 3)); c.rect(9, 2, 3, 5, ('tray', 3))
c.rect(4, 8, 2, 4, ('tray', 3)); c.rect(6, 8, 2, 4, ('tray', 3)); c.rect(9, 8, 3, 4, ('tray', 3))
c.rect(4, 2, 4, 5, ('vwhite', 5)); c.hl(4, 2, 3, ('vwhite', 6)); c.hl(4, 6, 4, ('vwhite', 3))
c.rect(9, 2, 3, 5, ('morange', 3)); c.hl(9, 2, 2, ('morange', 4)); c.hl(9, 6, 3, ('morange', 1)); c.px(10, 4, ('morange', 4))
c.rect(4, 8, 2, 4, ('vgreen', 4)); c.px(4, 8, ('vgreen', 5))
c.rect(6, 8, 2, 4, ('vyellow', 4)); c.px(6, 8, ('vyellow', 5))
c.rect(9, 8, 3, 4, ('vred', 3)); c.px(9, 8, ('vred', 4)); c.px(11, 10, ('vred', 5))
# 젓가락 두 개 (판 옆)
c.vl(1, 2, 11, ('hinoki', 4)); c.vl(2, 3, 10, ('hinoki', 2))
fin(c, 'C', '실루엣 다르게: 세로로 세운 식판(위 큰 칸 둘·아래 작은 칸 셋), 왼쪽에 나란한 젓가락 두 개', y=14, x=2, w=11)
