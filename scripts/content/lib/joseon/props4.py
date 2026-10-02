"""3/4 시점 소품: 모든 덩어리는 윗면(밝음) + 앞면(왼쪽 밝고 오른쪽 어두움) 으로 그린다. 정면 입면도 금지."""
from tk import *
from build import outline
from trees import ground_shadow


def slab(c, x0, y0, w, hf, top, ramp, topt=(6, 5), face=(5, 4, 3, 2)):
    """직육면체: y0..y0+top-1 = 윗면(뒤쪽 밝음), 그 아래 hf 줄 = 앞면(왼쪽 밝음→오른쪽 어둡게). 폭 w."""
    for y in range(top):
        for x in range(w):
            c.put(x0 + x, y0 + y, ramp[topt[0] if y < top - 1 else topt[1]])
    for y in range(hf):
        for x in range(w):
            f = x / max(1, w - 1)
            t = face[0] if f < 0.25 else (face[1] if f < 0.6 else (face[2] if f < 0.88 else face[3]))
            if y == 0: t = max(2, t - 1)                      # 윗면 바로 밑 모서리 그늘
            c.put(x0 + x, y0 + top + y, ramp[t])


def lantern():
    """석등 16×32, 3/4: 지대석·하대석(연꽃) 윗면이 보이고, 팔각 화사석은 앞 두 면(밝은 면·어두운 면)+불창, 옥개석은 윗 경사면이 밝게 보인다."""
    c = Cv(T, 2 * T)
    S = RGB['stone']; Wd = RGB['wood']
    ground_shadow(c, 9, 30, 6, 1.5, 70)
    slab(c, 2, 25, 12, 3, 2, S, (6, 5), (5, 4, 3, 2))               # 지대석
    slab(c, 3, 22, 10, 2, 2, S, (6, 5), (5, 4, 3, 2))               # 하대석
    for x in range(4, 12, 2): c.put(x, 22, S[6]); c.put(x + 1, 23, S[5])   # 연꽃 잎결
    for y in range(15, 22):                                           # 간주석(장구형): 좌 밝음 우 어둠
        t = abs(y - 18.0)
        hw = 1 + int(t * 0.35)
        for x in range(8 - hw - 1, 8 + hw + 1):
            c.put(x, y, S[5] if x < 8 - hw // 2 else (S[4] if x < 8 + hw // 2 else S[3]))
    slab(c, 4, 12, 8, 2, 2, S, (6, 5), (5, 4, 3, 2))               # 상대석
    # 팔각 화사석: 앞면 = 밝은 왼면(5) + 정면 불창 + 어두운 오른면(3)
    for y in range(6, 12):
        for x in range(5, 11):
            c.put(x, y, S[5] if x < 7 else (S[4] if x < 9 else S[3]))
    for y in range(7, 11):
        c.put(7, y, RGB['earth'][1]); c.put(8, y, RGB['orange'][5] if y > 7 else RGB['orange'][6])
    c.put(6, 6, S[6]); c.put(7, 6, S[6]); c.put(8, 6, S[5])            # 윗가장자리
    # 옥개석: 윗 경사면(밝음 3줄) + 두툼한 앞 처마(어둡게), 모서리 살짝 들림
    for dy, (a, b) in enumerate(((5, 11), (3, 13), (2, 14))):
        for x in range(a, b):
            c.put(x, 2 + dy, S[6] if dy == 0 else (S[6] if x < 8 else S[5]))
    for dy, (a, b) in enumerate(((1, 15), (1, 15))):
        for x in range(a, b):
            c.put(x, 5 + dy, S[5] if x < 6 else (S[4] if x < 11 else S[3]))
    c.put(0, 5, S[5]); c.put(15, 5, S[4])
    for y in (0, 1): c.put(7, y, S[6]); c.put(8, y, S[5])             # 보주
    c.put(7, 2, S[6])
    outline(c)
    return c


def jangseung(female=False):
    """장승 16×32, 3/4: 통나무 윗면이 보이고(머리 위 둥근 면), 얼굴은 앞면, 몸통은 왼쪽 밝은 원통. 챙 없는 작은 벙거지."""
    c = Cv(T, 2 * T)
    W = RGB['wood']; E = RGB['earth']; R = RGB['red']
    ground_shadow(c, 9, 30, 7, 1.8, 70)
    # 몸통(원통): 왼쪽 밝음 → 오른쪽 어둠
    for y in range(11, 29):
        for x in range(4, 12):
            f = (x - 4) / 7
            c.put(x, y, W[5] if f < 0.2 else (W[4] if f < 0.5 else (W[3] if f < 0.8 else W[2])))
    # 머리: 윗면 타원(밝음) + 앞면(얼굴)
    for y in range(3, 6):                                           # 윗면
        hw = 3 + (1 if y > 3 else 0)
        for x in range(8 - hw, 8 + hw):
            c.put(x, y, W[6] if y == 3 else W[5])
    for y in range(6, 14):
        for x in range(4, 12):
            f = (x - 4) / 7
            c.put(x, y, W[5] if f < 0.25 else (W[4] if f < 0.65 else W[3]))
    # 벙거지(여: 흙빛 머릿수건): 윗면 + 앞 띠, 챙은 한 칸 안 넘음
    hat = E if female else W
    for x in range(4, 12): c.put(x, 5, hat[3]); c.put(x, 6, hat[2])
    for x in range(5, 11): c.put(x, 4, hat[5])
    # 얼굴: 눈 둘(흰자+눈동자), 코 능선, 입
    for x in (5, 6): c.put(x, 8, hx('#f7fdff')); c.put(x, 9, hx('#f7fdff'))
    for x in (9, 10): c.put(x, 8, hx('#f7fdff')); c.put(x, 9, hx('#f7fdff'))
    c.put(6, 9, W[0]); c.put(9, 9, W[0]); c.put(5, 7, W[1]); c.put(6, 7, W[1]); c.put(9, 7, W[1]); c.put(10, 7, W[1])
    c.vl(7, 9, 12, W[6]); c.vl(8, 9, 12, W[3])
    if female:
        for x in (6, 7, 8, 9): c.put(x, 12, R[3])
    else:
        for x in range(5, 11): c.put(x, 12, W[0])
        c.put(6, 12, hx('#f7fdff')); c.put(9, 12, hx('#f7fdff'))
    # 명문: 붉은 세로 글자 한 줄(획 2×3 두 칸)
    for gy in (15, 20, 25):
        c.hl(7, 10, gy, R[3]); c.vl(8, gy, gy + 3, R[3]); c.put(7, gy + 2, R[2]); c.put(9, gy + 2, R[2])
    # 땅에 박은 흙무더기(윗면 보임)
    for x in range(2, 14): c.put(x, 29, E[5] if x < 7 else E[4]); c.put(x, 30, E[3])
    for x in range(3, 13): c.put(x, 28, E[5])
    outline(c)
    return c


def sotdae():
    """솟대 16×32, 3/4: 장대(원통, 왼쪽 밝음), 끝에 목이 위로 곧은 오리: 몸통 윗면이 밝게 보이고 부리는 앞쪽을 향한다. 아래 흙무더기 윗면."""
    c = Cv(T, 2 * T)
    W = RGB['wood']; E = RGB['earth']; O = RGB['orange']
    ground_shadow(c, 9, 30, 6, 1.6, 70)
    for y in range(12, 29):
        c.put(7, y, W[5]); c.put(8, y, W[4]); c.put(9, y, W[2])
    for y in (17, 23): c.hl(6, 11, y, W[2])
    # 오리(옆모습, 왼쪽을 본다): 타원 몸통 + 위로 솟은 꼬리, 목은 앞(왼쪽)으로 휘어 올라가 머리와 부리
    body = [(4, 11, 5), (3, 12, 4), (3, 12, 4), (4, 11, 3)]               # (x0,x1) per row, rows 7..10
    rows = {7: (5, 12), 8: (3, 13), 9: (3, 13), 10: (4, 12), 11: (6, 11)}
    for y, (xa, xb) in rows.items():
        for x in range(xa, xb):
            t = 6 if y == 7 else (5 if y == 8 else (4 if y == 9 else (3 if y == 10 else 2)))
            if x > xb - 3 and y >= 9: t = max(2, t - 1)
            c.put(x, y, W[t])
    for dx, dy in ((13, 6), (13, 5), (12, 5)):                              # 꼬리 깃
        c.put(dx, dy, W[5]); 
    c.put(13, 7, W[4])
    for y in range(3, 8): c.put(4, y, W[5]); c.put(5, y, W[4])           # 목
    c.put(3, 2, W[6]); c.put(4, 2, W[6]); c.put(5, 2, W[5]); c.put(4, 3, W[5])  # 머리 윗면
    c.put(3, 3, W[5]); c.put(5, 3, W[3]); c.put(4, 1, W[5])
    c.put(2, 3, O[4]); c.put(1, 3, O[4]); c.put(2, 4, O[3])               # 부리(왼쪽 앞)
    c.put(4, 3, W[0])                                                      # 눈
    for x in range(2, 14): c.put(x, 29, E[5] if x < 7 else E[4]); c.put(x, 30, E[3])
    for x in range(3, 13): c.put(x, 28, E[5])
    outline(c)
    return c


def laundry():
    """빨랫줄 32×32, 3/4: 기둥(원통) 위에 윗면 마개, 줄은 두 점 사이 처짐, 옷은 줄에 걸려 앞면이 보이고 윗부분이 줄 위로 접힌 두께, 땅에 그림자."""
    c = Cv(2 * T, 2 * T)
    W = RGB['wood']; B = RGB['dblue']; R = RGB['red']; St = RGB['stone']
    ground_shadow(c, 16, 30, 14, 1.8, 70)
    for x in (3, 28):
        for y in range(8, 30):
            c.put(x, y, W[5]); c.put(x + 1, y, W[3])
        c.put(x, 7, W[6]); c.put(x + 1, 7, W[5])                       # 기둥 윗면
    for x in range(4, 28):
        c.put(x, 9 + (1 if 10 < x < 21 else 0) + (1 if 13 < x < 18 else 0), W[2])
    for x0, (lt, dk, top), hh in ((7, (St[6], St[5], St[4]), 11), (14, (B[5], B[4], B[3]), 9), (21, (R[4], R[3], R[2]), 10)):
        for x in range(x0, x0 + 5):                                    # 줄 위로 접힌 윗단(두께 2줄)
            c.put(x, 10, top); c.put(x, 11, lt if x < x0 + 3 else dk)
        for y in range(12, 11 + hh):
            for x in range(x0, x0 + 5):
                c.put(x, y, lt if (x - x0) < 3 else dk)
        for x in range(x0 + 1, x0 + 5): c.put(x, 11 + hh, SHADOW, 90)    # 옷 아래 그림자
    outline(c)
    return c


def fence_h():
    """싸리울타리 16×16, 3/4: 막대 끝마다 윗면 1px, 가로 묶음띠 윗면과 앞면, 땅 그림자."""
    c = Cv(T, T)
    W = RGB['wood']; S = RGB['straw']
    for x in range(0, T, 3):
        top = 3 + int(rnd(x, 1, 5) * 3)
        c.put(x, top - 1, W[6]); c.put(x + 1, top - 1, W[5])           # 막대 윗면
        for y in range(top, 15):
            c.put(x, y, W[5]); c.put(x + 1, y, W[3])
    for y, (a, b) in ((7, (S[5], S[3])), (12, (S[5], S[3]))):
        for x in range(T):
            c.put(x, y, a); c.put(x, y + 1, b)
    for x in range(T): c.put(x, 15, SHADOW, 90)
    return c
