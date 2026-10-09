from bunk import *
# ---- B : 센 명암. 사다리 왼쪽, 빨강/초록 이불, 왼쪽 기둥 밝고 오른쪽 기둥 어둡다
c = C(32, 48)
bunk(c, 6, 0, ('vpine', 5, 3, 1, 0), 'vred', 'vgreen', hi=6, lo=0)
# 위 칸 아래·아래 칸 아래 그림자 (어두운 속)
for (y, h) in ((21, 5), (41, 4)):
    for j in range(h):
        for i in range(9, 29): c.px(i, y+j, '~')
    for i in range(9, 29): c.px(i, y+h, '-')
c.shadow(6, 46, 27, 2)
c.save(out('bunk_bed','B'), '센 명암: 왼쪽 기둥 밝은 소나무·오른쪽 기둥 어둡게, 빨강/초록 이불, 칸 밑 짙은 그늘, 사다리는 왼쪽')
