from w5_icons import *
RED_A = ('3', '4', '5', '2'); BLU_A = ('b', 'c', 'd', 'a')
RED_B = ('2', '4', '5', '1'); BLU_B = ('b', 'd', 'e', 'a')

def crenel(c, x0, x1, y, col, out, step=4):
    for x in range(x0, x1 + 1):
        if (x - x0) % step in (0, 1): c.put(x, y, col); c.put(x, y - 1, col) if False else None

def wall_front(c, x0, x1, ytop, ybot, mode):
    """앞 성벽: 위 윗면 한 줄 밝게, 톱니, 벽면 3단"""
    W = x1 - x0 + 1
    hi, lit, mid, dark, out = ('s', 't', 'u', 'v', 'k') if mode == 'A' else ('S', 's', 't', 'u', 'k')
    # 톱니(흉벽)
    for x in range(x0, x1 + 1):
        if (x - x0) % 4 in (0, 1):
            c.put(x, ytop - 2, hi if mode == 'B' else lit); c.put(x, ytop - 1, lit)
        c.put(x, ytop, hi)
    for y in range(ytop + 1, ybot + 1):
        for x in range(x0, x1 + 1):
            f = (x - x0) / max(1, W - 1)
            if mode == 'A': col = lit if y < ybot - 3 else mid
            else:
                col = lit if f < 0.35 else (mid if f < 0.75 else dark)
                if y >= ybot - 2: col = dark if col != dark else out
            c.put(x, y, col)
    c.hl(x0, x1, ybot, out)
    # 벽돌줄
    for y in (ytop + 3, ytop + 6):
        if y < ybot:
            for x in range(x0 + 1, x1, 4):
                c.put(x + (2 if y == ytop + 6 else 0), y, mid if mode == 'A' else dark)
    # 남쪽 성문(어두운 아치)
    gx = x0 + W // 2 - 2
    c.rect(gx, ytop + 3, gx + 3, ybot, 'K')
    c.hl(gx + 1, gx + 2, ytop + 2, 'K'); c.put(gx, ytop + 3, 'k'); c.put(gx + 3, ytop + 3, 'k')
    c.hl(gx + 1, gx + 2, ytop + 4, 'B'); c.rect(gx + 1, ytop + 5, gx + 2, ybot, 'E')

def side_wall(c, x0, x1, ytop, ybot, mode, left):
    hi, lit, mid, dark, out = ('s', 't', 'u', 'v', 'k') if mode == 'A' else ('S', 's', 't', 'u', 'k')
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            c.put(x, y, lit if (x - x0) * 2 < (x1 - x0 + 1) else mid)
    c.hl(x0, x1, ytop, hi)
    for x in range(x0, x1 + 1):
        if (x - x0) % 2 == 0: c.put(x, ytop - 1, lit)
    c.rect(x0 if left else x1, ytop + 1, x0 if left else x1, ybot, out if mode == 'B' else mid)

# ---------- A ----------
def roofs(c, spec, RED, BLU):
    for (x0, x1, yb, h, col) in spec:
        r = RED if col == 'r' else BLU
        gable(c, x0, x1, yb, h, r[0], r[1], r[2], r[3], under=r[2])

def town(mode):
    c = Cv(32, 32)
    RED, BLU = (RED_A, BLU_A) if mode == 'A' else (RED_B, BLU_B)
    # 뒷 성벽
    c.rect(3, 9, 28, 12, 'u'); c.hl(3, 28, 9, 't')
    for x in range(3, 29):
        if (x - 3) % 4 in (0, 1): c.put(x, 8, 't'); c.put(x, 7, 't')
    roofs(c, [(4, 11, 15, 5, 'r'), (13, 19, 14, 5, 'b'), (21, 28, 15, 5, 'r')], RED, BLU)
    # 가운데 줄 지붕(더 크고 앞)
    roofs(c, [(3, 12, 21, 7, 'b'), (11, 20, 22, 8, 'r'), (19, 28, 21, 7, 'b')], RED, BLU)
    # 벽면 겉(지붕 아래 흰 벽 한 줄)
    for (x0, x1) in ((4, 11), (12, 19), (20, 27)):
        c.hl(x0, x1, 22, 'q')
    side_wall(c, 0, 2, 12, 30, mode, True)
    side_wall(c, 29, 31, 12, 30, mode, False)
    wall_front(c, 1, 30, 22, 30, mode)
    return c

c = town('A')
save('town', 'A', c, '', 'oprn 아틀라스 결 — 평평한 돌 성벽(윗줄 밝게·톱니), 안쪽 붉은·푸른 지붕 여섯 채가 빽빽, 남쪽 가운데 어두운 아치 성문')
c = town('B'); c.shadow()
save('town', 'B', c, '', '빛·부피 — 성벽 왼쪽 밝고 오른쪽·아랫단 어둡게 3단, 윗면 가장 밝은 줄, 톱니, 발치 반투명 그림자, 어두운 아치 성문')

# ---------- C: 실루엣 — 네 모서리 원통 망루 + 가운데 큰 지붕 뭉치
c = Cv(32, 32)
RED, BLU = RED_B, BLU_B
roofs(c, [(9, 15, 15, 6, 'r'), (16, 22, 15, 6, 'r')], RED, BLU)
roofs(c, [(6, 25, 23, 11, 'b')], RED, BLU)
roofs(c, [(4, 12, 24, 7, 'r'), (19, 27, 24, 7, 'r')], RED, BLU)
def turret(c, x0, x1, ytop, ybot, roofh, RB):
    for y in range(ytop, ybot + 1):
        for x in range(x0, x1 + 1):
            f = (x - x0) / (x1 - x0)
            c.put(x, y, 's' if f < .3 else ('t' if f < .65 else 'u'))
    c.hl(x0, x1, ybot, 'v')
    c.rect(x0, ytop, x0, ybot, 's'); c.rect(x1, ytop, x1, ybot, 'k')
    c.put((x0 + x1) // 2, ytop + 2, 'w'); c.put((x0 + x1) // 2, ytop + 3, 'w')
    gable(c, x0 - 1, x1 + 1, ytop - 1, roofh, RB[0], RB[1], RB[2], RB[3], under=RB[2])
turret(c, 0, 5, 14, 29, 8, BLU); turret(c, 26, 31, 14, 29, 8, BLU)
# 앞 성벽(낮게) 두 조각 + 가운데 성문
for x0, x1 in ((6, 12), (19, 25)):
    for x in range(x0, x1 + 1): 
        for y in range(25, 30): c.put(x, y, 's' if x - x0 < 3 else 't')
        c.put(x, 24, 'S' if (x - x0) % 3 else 't')
    c.hl(x0, x1, 30, 'k')
c.rect(13, 21, 18, 30, 'v'); c.rect(13, 21, 13, 30, 's'); c.rect(18, 21, 18, 30, 'u')
c.hl(13, 18, 20, 'S')
for x in (13, 15, 17): c.put(x, 19, 'S'); c.put(x, 20, 's')
c.rect(14, 24, 17, 30, 'K'); c.hl(15, 16, 23, 'K'); c.rect(15, 26, 16, 30, 'E'); c.hl(15, 16, 25, 'B')
c.hl(6, 12, 30, 'k'); c.hl(19, 25, 30, 'k'); c.hl(0, 31, 31, '.')
c.shadow()
save('town', 'C', c, '', '실루엣 재해석 — 네 모서리 푸른 뾰족 망루 + 가운데 푸른 큰 지붕 뭉치, 낮은 앞 성벽과 문루, 멀리서 뾰족 지붕 셋으로 읽힘')
