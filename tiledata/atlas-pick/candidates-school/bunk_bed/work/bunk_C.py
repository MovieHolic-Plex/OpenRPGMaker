from bunk import *
c = C(32, 48)
bunk(c, 0, 26, ('viron', 5, 4, 2, 1), 'ai', 'jersey', hi=6)
# 강철 파이프 느낌: 위 칸 뒤 난간에 세로 살
for x in range(4, 23, 3):
    c.vl(x, 0, 5, ('viron', 4)); c.px(x, 0, ('viron', 6))
c.hl(3, 0, 20, ('viron', 5)); c.hl(3, 1, 20, ('viron', 3))
# 아래 칸 커튼(반쯤 걷은 천) 오른쪽
for x in range(19, 23):
    c.vl(x, 26, 11, ('washi', 3 if x % 2 else 4))
c.hl(19, 26, 4, ('washi', 5))
for j in range(21, 26):
    for i in range(3, 23):
        if c.get(i, j) == '.': c.px(i, j, '~')
for j in range(41, 45):
    for i in range(3, 23): c.px(i, j, '~')
c.shadow(0, 46, 30, 2)
c.save(out('bunk_bed','C'), '실루엣 다르게: 강철 파이프 이층(회색), 위 칸 세로 살 난간, 남색/자주 담요, 아래 칸 오른쪽에 걷은 커튼')
