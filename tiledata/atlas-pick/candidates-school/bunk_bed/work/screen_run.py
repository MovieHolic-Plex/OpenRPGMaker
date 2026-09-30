from screen import *
# A: 흰 접이 칸막이, 하늘색 단
c = four('viron', P('vwhite', 6), P('vwhite', 5), P('vwhite', 3), hem=P('vglass', 5))
fin(c, 'A', 'v5 결: 바퀴 달린 4폭 접이 칸막이, 회색 철 틀에 흰 커튼, 폭마다 명암 번갈아 접힘, 위쪽 하늘색 단')
# B: 센 명암
c = four('viron', P('vwhite', 6), P('vwhite', 5), P('vwhite', 1), hem=None)
for i in range(4):
    x0 = 2 + 7 * i
    if i >= 2:
        for y in range(5, 25):
            for x in range(x0 + 1, x0 + 6):
                if c.get(x, y) != '.': pass
fin(c, 'B', '센 명암: 흰 커튼의 밝은 폭과 어두운 폭이 크게 대비, 철 틀 짙음, 폭마다 뚜렷한 접힘')
# C: 3폭 삼면 (가운데 넓고 양옆 뒤로 접힘)
c = C(32, 32)
# 뒤 양옆 폭(좁고 낮게)
panel(c, 1, 6, 6, 24, 'viron', P('vwhite', 5), P('vwhite', 3), P('vwhite', 2))
panel(c, 25, 6, 6, 24, 'viron', P('vwhite', 5), P('vwhite', 3), P('vwhite', 1))
# 가운데 넓은 폭(앞)
panel(c, 7, 18, 2, 26, 'viron', P('vwhite', 6), P('vwhite', 5), P('vwhite', 3), hem=P('vglass', 4))
# 가운데 폭 세로 주름 추가
for x in (12, 18):
    c.vl(x, 6, 18, P('vwhite', 4))
fin(c, 'C', '실루엣 다르게: 3폭 삼면 칸막이, 가운데 넓은 폭이 앞으로 나오고 양옆 좁은 폭이 뒤로 접혀 물러남')
