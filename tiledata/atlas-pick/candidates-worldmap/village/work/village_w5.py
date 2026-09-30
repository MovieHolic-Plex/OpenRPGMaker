from w5_icons import *
WALL = ('p', 'q', 'r')
RED_A = ('3', '4', '5', '2'); BLU_A = ('b', 'c', 'd', 'a')
RED_B = ('2', '4', '5', '1'); BLU_B = ('b', 'd', 'e', 'a')
RED_C = ('2', '4', '5', '1'); BLU_C = ('b', 'd', 'e', 'a')

def yard(c, cells):
    for (x, y, ch) in cells: c.put(x, y, ch, over=False)

# A: 낮은 대비 세 채, 마당 흙
c = Cv(32, 16)
house(c, 2, 8, 13, 4, 5, RED_A, WALL)
house(c, 12, 9, 13, 4, 6, BLU_A, WALL)
house(c, 23, 7, 13, 3, 5, RED_A, WALL)
c.hl(10, 11, 14, 'x'); c.hl(21, 22, 14, 'x'); c.hl(4, 27, 15, 'x'); c.hl(9, 24, 14, 'z')
c.hl(5, 8, 15, 'z'); c.hl(15, 20, 15, 'z')
save('village', 'A', c, '', 'oprn 아틀라스 결 — 붉은·푸른 박공 지붕 세 채를 낮은 대비 평평한 면으로, 흙마당 한 줄, 그림자 없음')

# B: 부피·빛 — 지붕 마루 하이라이트, 벽 오른쪽 어둡게, 발치 그림자
c = Cv(32, 16)
house(c, 2, 8, 13, 4, 5, RED_B, WALL, shade_r=2)
house(c, 12, 9, 13, 4, 6, BLU_B, WALL, shade_r=2)
house(c, 23, 7, 13, 3, 5, RED_B, WALL, shade_r=2)
c.hl(10, 11, 14, 'x'); c.hl(21, 22, 14, 'x'); c.hl(9, 24, 14, 'z'); c.hl(4, 27, 15, 'z')
c.hl(11, 11, 14, 'X'); c.hl(20, 20, 14, 'X')
c.shadow()
save('village', 'B', c, '', '빛·부피 — 왼쪽 위 빛: 지붕 마루 밝은 줄+오른쪽 짙은 면, 벽 오른쪽 두 줄 그늘, 발치 반투명 그림자와 흙마당')

# C: 실루엣 재해석 — 높고 가파른 지붕이 집을 대표(벽은 낮게), 굴뚝 한 점
c = Cv(32, 16)
house(c, 2, 7, 13, 2, 8, RED_C, WALL, shade_r=1)
house(c, 11, 10, 13, 3, 10, BLU_C, WALL, shade_r=1)
house(c, 23, 7, 13, 2, 7, RED_C, WALL, shade_r=1)
c.rect(15, 1, 16, 2, '5')  # 굴뚝
c.hl(9, 10, 14, 'x'); c.hl(21, 22, 14, 'x'); c.hl(8, 24, 15, 'z')
c.shadow()
save('village', 'C', c, '', '실루엣 재해석 — 벽은 낮고 지붕은 높고 가파른 삼각(가운데 푸른 큰 집, 굴뚝), 멀리서도 지붕 세 삼각으로 읽힘')
