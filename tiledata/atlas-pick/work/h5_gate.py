from h5_common import *
def pillar(c, x0, left):
    # 몸통 x0+1..x0+7, 받침 x0..x0+8
    c.rect(x0+1, 9, 7, 35, 'k')
    c.vl(x0+1, 9, 35, 'l' if left else 'k'); c.vl(x0+2, 9, 35, 'k')
    c.vl(x0+7, 9, 35, 'i'); c.vl(x0+6, 9, 35, 'j')
    for y in range(11, 44, 4): c.hl(x0+1, y, 7, 'i')       # 돌 줄눈
    for y in range(13, 44, 8): c.px(x0+4, y, 'i')
    # 머리 공 y0..7
    c.rect(x0+2, 1, 5, 5, 'k'); c.hl(x0+3, 0, 3, 'l'); c.hl(x0+3, 6, 3, 'i')
    c.px(x0+2, 1, 'l'); c.px(x0+6, 1, 'j'); c.px(x0+2, 5, 'j'); c.px(x0+6, 5, 'h')
    c.px(x0+3, 1, 'm'); c.px(x0+3, 2, 'm'); c.px(x0+2, 2, 'm')
    c.px(x0+6, 3, 'h'); c.px(x0+6, 4, 'h'); c.px(x0+5, 5, 'h')
    # 갓
    c.rect(x0, 7, 9, 2, 'l'); c.hl(x0, 7, 9, 'm'); c.hl(x0, 8, 9, 'i')
    c.px(x0+8, 7, 'j')
    # 받침
    c.rect(x0, 42, 9, 6, 'j'); c.hl(x0, 42, 9, 'm'); c.hl(x0, 47, 9, 'g'); c.hl(x0, 46, 9, 'h')
    c.vl(x0+8, 43, 5, 'h'); c.vl(x0, 43, 4, 'l')
    # 이끼
    for (dx, dy, ch) in ((1, 12, 'p'), (1, 13, 'o'), (2, 40, 'p'), (6, 32, 'o'), (2, 44, 'o'), (3, 44, 'p'), (7, 9, 'p')): c.px(x0+dx, dy, ch)
def bars(c, xa, xb, ytop, ybot, step=4, tone=('5','2')):
    for x in range(xa, xb, step):
        for y in range(ytop, ybot): c.px(x, y, tone[0]); c.px(x+1, y, tone[1])
        c.px(x, ytop-1, '6'); c.px(x+1, ytop-1, '3'); c.px(x, ytop-2, '4') 
def gate_base(c):
    pillar(c, 0, True); pillar(c, 39, False)
    # 아치띠: 기둥 안쪽에서 중앙으로 올라가는 두 겹 곡선
    import math
    for x in range(9, 39):
        t = (x - 23.5) / 14.5
        y = int(round(10 - 6 * math.sqrt(max(0, 1 - t*t)))) if abs(t) <= 1 else 10
        c.px(x, y, '6'); c.px(x, y+1, '5'); c.px(x, y+2, '2')
    # 아치 안 소용돌이 장식 (중앙)
    for (x, y, ch) in ((23, 6, '6'), (24, 6, '5'), (22, 7, '4'), (25, 7, '4'), (22, 8, '5'), (25, 8, '5'), (23, 9, '3'), (24, 9, '3'), (24, 8, '6'), (21, 8, '3'), (26, 8, '3')): c.px(x, y, ch)
    # 위·아래 가로띠
    for x in range(9, 39):
        c.px(x, 14, '6'); c.px(x, 15, '2'); c.px(x, 36, '6'); c.px(x, 37, '2')
    # 왼쪽 문짝 (닫힘) x10..21
    bars(c, 10, 22, 16, 44)
    c.hl(9, 30, 13, '5'); c.hl(9, 31, 13, '2')      # 중간띠
    # 오른쪽 문짝 (안쪽으로 열림, 좁고 어둡게) x30..37 → 폭 좁힘
    for x in range(30, 38, 3):
        for y in range(16, 44): c.px(x, y, '3'); c.px(x+1, y, '1')
        c.px(x, 15, '4'); c.px(x, 14, '3')
    # 열린 문의 둘레 (원근): 위 아래 띠가 비스듬히 올라감
    for x in range(27, 38):
        c.px(x, 14, '4'); c.px(x, 15, '1'); c.px(x, 36, '4'); c.px(x, 37, '1')
    for x in range(22, 30):
        c.px(x, 14, '.'); c.px(x, 15, '.'); c.px(x, 36, '.'); c.px(x, 37, '.')
    # 걸쇠/경첩
    for y in (17, 34): c.px(9, y, 'e'); c.px(38, y, 'b')
    # 녹
    for (x, y) in ((12, 22), (17, 27), (11, 40), (19, 19), (32, 30)): c.px(x, y, 'c')
    # 걸어 다니는 길 한 줄 (돌판)
    for x in range(22, 30): c.px(x, 46, 'i'); c.px(x, 47, 'g')
    for x in range(23, 29): c.px(x, 45, 'j') if x % 2 else None

# ---- A
c = C(48, 48); gate_base(c)
# 끊어진 사슬: 왼쪽 문짝 손잡이에서 늘어짐 (tarn)
for (x, y, ch) in ((21, 24, '('), (21, 25, ')'), (20, 26, '('), (21, 27, ')'), (20, 28, '(')): c.px(x, y, ch)
c.px(20, 29, '.') 
save('cemetery_gate', 'h5-A', c, L, '돌기둥 둘(둥근 갓)+철문. 왼 문짝 닫힘, 오른 문짝 안쪽으로 열려 좁고 어둡다. 위에 반원 아치띠와 소용돌이, 문에 끊어진 사슬, 가운데 통로 돌판')

# ---- B
c = C(48, 48); gate_base(c)
for (x, y, ch) in ((21, 24, '('), (21, 25, ')'), (20, 26, '('), (21, 27, ')'), (20, 28, '(')): c.px(x, y, ch)
for y in range(9, 44): c.px(1, y, 'm'); 
for y in range(2, 8): c.px(2, y, 'm')
for y in range(10, 44): c.px(46, y, 'g')
for x in range(9, 22): c.px(x, 14, '6'); c.px(x, 13, '4') if False else None
for y in range(16, 44): c.px(10, y, '6')
# 열린 문틈 안은 어둡게 눌림
for x in range(22, 30):
    for y in range(16, 44):
        if c.g[y][x] == '.': c.px(x, y, '%') if False else None
# 접지 그림자 (반투명) 오른쪽으로 길게
for x in range(9, 48):
    c.px(x, 47, '~') if c.g[47][x] == '.' else None
for x in range(9, 22): c.px(x, 46, '~') if c.g[46][x] == '.' else None
# 빛 새는 틈: 통로에 % 빛줄
for y in range(16, 44):
    if y % 2 == 0: c.px(22, y, '%')
for x in range(23, 30):
    c.px(x, 45, '%') if c.g[45][x] == '.' else None
save('cemetery_gate', 'h5-B', c, L, '달빛이 왼쪽 기둥 왼면·왼 문짝 첫 살만 훑고 오른쪽은 깊게 눌림. 열린 틈으로 빛줄(%)이 새고 접지 그림자가 반투명으로 길다')

# ---- C : 문 뒤에서 팔이 뻗은 실루엣 + 위로 뒤틀린 창살
c = C(48, 48); gate_base(c)
# 오른 문짝을 아예 벗겨내 어두운 틈 + 휘어 잡은 손가락 (dust)
for x in range(30, 38):
    for y in range(16, 44): c.px(x, y, '.')
bars(c, 30, 38, 16, 22, step=3, tone=('3', '1'))            # 위쪽 조각만 남음
for (x, y, ch) in ((28, 22, 'N'), (29, 22, 'N'), (29, 23, 'O'), (30, 23, 'N'), (31, 22, 'M'), (31, 23, 'N'),
                   (30, 24, 'O'), (32, 24, 'N'), (32, 23, 'M'), (33, 24, 'O'), (33, 25, 'O'), (28, 23, 'M')):
    c.px(x, y, ch)
for (x, y) in ((29, 26), (30, 27), (29, 28), (29, 29), (30, 30)): c.px(x, y, 'S')       # 팔 자리 핏자국
# 아치 소용돌이 대신 뒤틀린 X
for (x, y, ch) in ((21, 6, '5'), (22, 7, '5'), (25, 7, '5'), (26, 6, '5')): c.px(x, y, ch)
# 왼 문짝 살이 안쪽으로 몰림
for y in range(16, 30): c.px(15, y, '.'); c.px(16, y, '.')
for y in range(16, 30):
    c.px(14 if y > 22 else 15, y, '5'); c.px(15 if y > 22 else 16, y, '2')
# 끊어진 사슬은 바닥까지 늘어짐
for (x, y, ch) in ((21, 24, '('), (21, 25, ')'), (20, 26, '('), (21, 27, ')'), (20, 28, '('), (20, 29, ')'), (21, 30, '('), (21, 31, ')')): c.px(x, y, ch)
for (x, y) in ((21, 32), (21, 33), (22, 34)): c.px(x, y, 'S')
save('cemetery_gate', 'h5-C', c, L, '오른 문짝이 뜯겨 나간 자리에 창백한 손이 창살을 잡고 있고 핏자국이 팔 아래로 이어진다. 왼 문짝 살은 안쪽으로 휘고 사슬은 바닥까지 늘어짐')
