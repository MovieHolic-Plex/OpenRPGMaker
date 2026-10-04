from nurse import *
c, a, b = bed()
fin(c, 'A', 'v5 결: 흰 철제 침대, 흰 시트와 베개, 발치에 접은 자주 체육복 담요, 발치 난간, 다리 넷 중 앞 둘')
# B 센 명암: 검은 프레임, 오른쪽 그늘
c, a, b = bed(frame='viron', sheet=('vwhite', 5), sh_hi=6, sh_lo=1, pillow=('vwhite', 6), deep=True)
for y in range(12, 19):
    for x in range(9, 14):
        c.px(x, y, ('vwhite', 3))
for y in range(4, 9):
    c.px(11, y, ('vwhite', 3))
fin(c, 'B', '센 명암: 짙은 회색 철 프레임, 흰 시트 오른쪽이 깊은 그늘, 접힌 선이 뚜렷, 짙은 자주 담요')
# C 링거대가 붙은 침대 (실루엣: 오른쪽 위로 솟음)
c, a, b = bed(frame='vblue', sheet=('vwhite', 5), pillow=('vwhite', 6), iv=True)
# 링거대
c.vl(14, 3, 25, P('viron', 4)); c.vl(15, 4, 24, P('viron', 2))
c.hl(12, 0, 4, P('viron', 5)); c.hl(12, 1, 1, P('viron', 4))
c.rect(13, 1, 2, 4, P('vglass', 5)); c.hl(13, 1, 2, P('vglass', 6)); c.vl(14, 2, 3, P('vglass', 3))
c.px(14, 5, P('vglass', 2))
c.rect(12, 28, 4, 2, P('viron', 3)); c.hl(12, 28, 4, P('viron', 5))
c.px(15, 0, '.'); c.px(12, 0, '.') if False else None
fin(c, 'C', '실루엣 다르게: 하늘색 프레임 침대 옆에 링거 걸이대 하나(맑은 수액 주머니), 바퀴 달린 기둥이 오른쪽 위로 솟음', x1=15)
