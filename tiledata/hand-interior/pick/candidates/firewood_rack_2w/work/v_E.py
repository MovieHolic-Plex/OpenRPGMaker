from w34_gen import *
cv = Cv()
skids(cv, 2, 45)
back = ('Q', 'I', 'G')
# 뒤: 좌상→우하 로 기댄 통나무(어둡게), 위쪽(왼쪽) 끝 마구리
for k, (x, top, ln) in enumerate([(5, 10, 9), (12, 7, 11), (19, 9, 10), (26, 6, 11), (33, 9, 10), (40, 11, 6)]):
    log(cv, (x, top), (x + ln, 25), r=2.4, caps=('a',), seed=k, bark=back)
# 앞: 좌하→우상 통나무가 엇갈려 얹힘
for k, (x, top, ln) in enumerate([(3, 14, 9), (11, 17, 10), (19, 13, 10), (27, 16, 10), (35, 12, 9)]):
    log(cv, (x, 27), (x + ln, top), r=2.7, caps=('b',), seed=k + 3)
save(cv, 'E', '뒤는 \\ 앞은 / 로 엇갈려 기댄 X자 더미: 통나무가 서로 가로질러 얹히고 양쪽 대각선 끝마다 나이테 마구리가 보임')
