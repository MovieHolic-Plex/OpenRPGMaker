from h5_common import *
# tin '0123456' (0 dark) rust 'abcdef' grave 'ghijklm' tarn '()[]{}'
def fence(c, mode='A'):
    for k in range(8):
        x = 4*k+1
        bend = (mode != 'B' and k == 3)
        for y in range(1, 15):
            dx = 1 if (bend and 7 <= y <= 10) else 0
            c.px(x+dx, y, '5'); c.px(x+1+dx, y, '2')
        c.px(x, 0, '6'); c.px(x+1, 0, '3')
        c.px(x, 1, '6'); c.px(x+1, 1, '4')
        c.px(x-1 if x>0 else 31, 2, '2'); c.px(x+2, 2, '1')      # 창끝 날개
        c.px(x, 14, '3'); c.px(x+1, 14, '1')
    for x in range(32):
        c.px(x, 5, '6'); c.px(x, 6, '2'); c.px(x, 11, '6'); c.px(x, 12, '2')
    for (x, y) in ((6, 5), (11, 6), (20, 11), (26, 12), (2, 12), (29, 5), (15, 5), (17, 11)):
        c.px(x, y, 'd' if y in (5, 11) else 'b')
    for (x, y) in ((7, 9), (23, 9), (12, 3), (28, 8)): c.px(x, y, 'c')
c = C(32, 16); fence(c)
c.hl(0, 15, 32, '.')
save('iron_fence', 'h5-A', c, L, '창끝 쇠살 8개 · 위아래 가로띠 · 한 살이 휘고 녹 점 · 좌우 이음매에서 띠 높이 같음')

c = C(32, 16); fence(c, 'B')
for k in range(8):
    x = 4*k+1
    for y in range(2, 14): c.px(x, y, '6')
    c.px(x+1, 3, '5')
for x in range(32): c.px(x, 5, '6'); c.px(x, 6, '1'); c.px(x, 12, '0')
for x in range(32):
    c.px(x, 15, '~')
    if x % 4 in (3, 0): c.px(x, 14, '~')
for x in (0, 4, 8, 12, 16, 20, 24, 28): c.px(x, 15, '~')
save('iron_fence', 'h5-B', c, L, '왼쪽 위 달빛에 살 왼쪽 한 줄이 환하고 오른쪽·가로띠 아래는 깊게 눌림, 바닥에 살 그림자 반투명')

# C: 창끝이 뒤틀려 손가락처럼 굽고 살 하나가 빠지고 띠에서 피가 흐름
c = C(32, 16); fence(c)
for k in (1, 5):
    x = 4*k+1
    for y in range(0, 15):
        c.px(x, y, '.'); c.px(x+1, y, '.')
    c.px(x-1, 4, '.') 
    for y in range(6, 15):
        c.px(x+2 if y < 10 else x+1, y, '3')          # 휜 살 (가늘고 어두움)
    c.px(x+2, 5, '4'); c.px(x+3, 4, '5'); c.px(x+3, 3, '6')
for x in range(32):
    c.px(x, 5, '6'); c.px(x, 6, '2')
for x in range(29, 32): c.px(x, 11, '.'); c.px(x, 12, '.')   # 아래 띠 끊김 (타일 연결 위해 왼쪽은 유지)
for x in range(29, 32): c.px(x, 11, '6'); c.px(x, 12, '2')
for (x, y) in ((16, 7), (16, 8), (16, 9), (15, 9), (16, 10), (23, 7), (23, 8), (23, 9), (23, 10)):
    c.px(x, y, 'T' if y % 2 else 'U')
c.px(16, 10, 'V') 
save('iron_fence', 'h5-C', c, L, '쇠살 두 개가 사라진 자리에 가는 살이 손가락처럼 휘어 뻗고 띠에서 피가 흐르는 울타리')
