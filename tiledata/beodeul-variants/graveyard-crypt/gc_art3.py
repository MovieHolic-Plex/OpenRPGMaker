# 공동묘지 조각 3: 지하 묘소 소품·장식·안개·울타리 문
from gc_kit import *
from gc_kit import _hash, _pn1
from gc_art1 import moss
BL = (110, 210, 200); BL2 = (60, 150, 160)       # 묘지 푸른 불꽃

def sarcophagus_carved(seed=11):
    """조각 석관 2x2: 능선 뚜껑(위에서 본 면) + 앞면 부조 홈 세 줄, 뚜껑에 십자 부조. 아래 1줄 막힘(몸통)."""
    cv = Cv(32, 32)
    slab(cv, 1, 6, 31, 28, 11, ST, seed)
    # 뚜껑 능선: 윗면 가운데 밝은 띠
    for x in range(4, 28): cv.px(x, 9, ST[6] if x < 12 else ST[5]); cv.px(x, 10, ST[5] if x < 20 else ST[4])
    for y in range(8, 16): cv.px(16, y, ST[5]); cv.px(17, y, ST[3])
    for x in range(12, 22): cv.px(x, 11, ST[5]); cv.px(x, 12, ST[3])               # 십자 가로대
    for x in range(1, 31): cv.px(x, 17, ST[2]); cv.px(x, 18, ST[5] if x < 8 else ST[3])      # 뚜껑 처마
    for x in (6, 12, 18, 24):                                                      # 앞면 홈
        for y in range(20, 26): cv.px(x, y, ST[1]); cv.px(x + 1, y, ST[4] if x < 12 else ST[3])
    mk = Mk(32, 32); mk.rect(1, 6, 31, 28); moss(cv, mk, seed, .22)
    return shadow_under(fin(cv), 16, 28, 15, 2, 75)

def coffin_wood(seed=12):
    """나무 관 2x2: 육각 뚜껑 윗면(좁은 머리, 넓은 어깨) + 앞면 널. 못 박힌 십자 끈."""
    cv = Cv(32, 32)
    for y in range(7, 17):
        for x in range(1, 31):
            hw = 14 + 0 * y
            sh = 0 if 5 <= x <= 26 else (2 if x < 5 else 3)
            if y < 7 + sh or y > 16 - sh // 2: continue
            k = 5 if (y == 7 or x < 4) else 4
            if x > 24: k = 3
            if (x // 3 + y) % 4 == 0: k -= 1
            cv.px(x, y, WD[clamp(k)])
    for y in range(17, 27):
        for x in range(2, 30):
            k = 4 if x < 6 else (3 if x < 24 else 2)
            if y == 17: k = 5 if x < 20 else 3
            if y > 24: k = 1
            if (y - 17) % 4 == 3: k -= 1
            if _hash(x, y, seed) < .08: k += 1
            cv.px(x, y, WD[clamp(k)])
    for y in range(7, 27): cv.px(10, y, IRON[3]); cv.px(11, y, IRON[1]) if y > 16 else cv.px(11, y, IRON[2])   # 쇠띠
    for (x, y) in ((8, 10), (13, 10), (8, 14), (13, 14)): cv.px(x, y, IRON[4])
    for x in range(1, 31): cv.px(x, 27, WD[0])
    return shadow_under(fin(cv), 16, 27, 14, 2, 75)

def candelabra(seed=13):
    """촛대 1x2: 사각 받침 + 가는 기둥 + 가지 세 갈래 + 푸른 불꽃."""
    cv = Cv(16, 32); mk = Mk(16, 32); mk.rect(4, 24, 12, 30)
    vol(cv, mk, IRON, 4, 12, 4, seed)
    for x in range(4, 12): cv.px(x, 24, IRON[5] if x < 8 else IRON[4])
    for y in range(11, 25): cv.px(7, y, IRON[4]); cv.px(8, y, IRON[2])
    for (x, y) in ((4, 14), (4, 13), (5, 15), (6, 15), (11, 14), (11, 13), (10, 15), (9, 15), (5, 16), (10, 16)): cv.px(x, y, IRON[3] if x < 8 else IRON[2])
    for cx, cy in ((4, 9), (7, 6), (11, 9)):
        for y in range(cy + 1, cy + 4): cv.px(cx, y, BONE[4]); cv.px(cx + 1, y, BONE[2])
        cv.px(cx, cy, BL); cv.px(cx, cy - 1, (200, 250, 240)); cv.px(cx + 1, cy, BL2)
        if cy < 8: cv.px(cx, cy - 2, BL2)
    cv.hline(3, 13, 12, IRON[4]) if False else None
    return shadow_under(fin(cv, .7), 8, 30, 5, 1.4, 70)

def statue_angel(seed=14):
    """날개 천사 석상 2x3: 가운데 인물, 양쪽으로 접힌 날개, 사각 받침. 받침 두 칸이 막힘, 위는 걷기+가림."""
    cv = Cv(32, 48); mk = Mk(32, 48)
    mk.ell(16, 11, 3.8, 4.2); mk.poly([(11, 38), (12, 16), (20, 16), (21, 38)])
    mk.poly([(11, 18), (3, 10), (2, 26), (6, 34), (11, 32)]); mk.poly([(21, 18), (29, 10), (30, 26), (26, 34), (21, 32)])
    mk.rect(5, 38, 27, 42); mk.rect(2, 42, 30, 47)
    vol(cv, mk, ST, 2, 30, 4, seed, grain=.09)
    for y in range(9, 14):
        for x in range(13, 19): cv.px(x, y, ST[2]) if y > 10 else None
    for x in range(13, 19): cv.px(x, 6, ST[6]) 
    for (x, y) in ((14, 11), (17, 11)): cv.px(x, y, ST[1])
    for i in range(5):                                          # 깃털 결
        for x0, sg in ((3, 1), (28, -1)):
            for t in range(6 + i * 3): cv.px(x0 + sg * (i % 2), 12 + i * 4 + t // 3, ST[5 if sg > 0 else 3]) if t % 2 == 0 and False else None
    for y in range(14, 33, 4):
        for x in range(4, 11): cv.px(x, y, ST[5] if x < 8 else ST[3])
        for x in range(22, 29): cv.px(x, y, ST[3] if x < 25 else ST[2])
    for y in range(20, 36): cv.px(16, y, ST[4]); cv.px(17, y, ST[2])          # 옷주름
    for x in range(5, 27): cv.px(x, 38, ST[5] if x < 14 else ST[4])
    for x in range(2, 30): cv.px(x, 42, ST[4] if x < 9 else ST[3])
    mk2 = Mk(32, 48); mk2.rect(2, 12, 30, 47); moss(cv, mk2, seed, .3)
    return shadow_under(fin(cv), 16, 47, 14, 2, 75)

def gargoyle(seed=15):
    """웅크린 가고일 1x1(+받침): 날개 접고 앉은 돌 짐승, 뿔 두 개."""
    cv = Cv(16, 24); mk = Mk(16, 24)
    mk.rect(2, 18, 14, 23); mk.ell(8, 12, 4.4, 5); mk.ell(8, 6, 3.4, 3); mk.poly([(4, 6), (3, 1), (6, 4)]); mk.poly([(12, 6), (13, 1), (10, 4)])
    mk.poly([(3, 10), (0, 15), (5, 17)]); mk.poly([(13, 10), (16, 15), (11, 17)])
    vol(cv, mk, ST, 0, 16, 4, seed, grain=.1)
    for (x, y) in ((6, 6), (10, 6)): cv.px(x, y, RD[4]); cv.px(x, y + 1, RD[2])
    cv.hline(6, 11, 9, ST[1]); cv.px(7, 10, ST[6]); cv.px(9, 10, ST[6])
    for x in range(2, 14): cv.px(x, 18, ST[5] if x < 7 else ST[4])
    return shadow_under(fin(cv), 8, 23, 7, 1.4, 70)

def bone_pile(seed=16):
    """해골 쌓임 1x1: 맨 위 해골 하나, 아래 정강이뼈 X, 둥글게."""
    cv = Cv(16, 16)
    for (x0, y0, x1, y1) in ((2, 13, 13, 9), (3, 9, 12, 13)):
        for t in range(0, 12):
            x = x0 + (x1 - x0) * t // 11; y = y0 + (y1 - y0) * t // 11
            cv.px(x, y, BONE[4]); cv.px(x, y + 1, BONE[1])
        cv.px(x0 - 1, y0, BONE[3]); cv.px(x1 + 1, y1, BONE[3])
    for (cx, cy) in ((5, 10), (11, 11)):
        cv.ell(cx, cy, 2.6, 2.2, lambda x, y: BONE[4] if x < cx else BONE[3]); cv.px(cx - 1, cy, DK); cv.px(cx + 1, cy, DK)
    cv.ell(8, 6, 3.4, 3.0, lambda x, y: BONE[4] if (x < 8 and y < 6) else BONE[4]); cv.px(7, 6, DK); cv.px(9, 6, DK); cv.px(8, 8, BONE[1]); cv.hline(6, 11, 9, BONE[2])
    return shadow_under(fin(cv, .7), 8, 15, 7, 1.2, 60)

def cobweb(seed=17):
    """벽 모서리 거미줄 1x1 (왼쪽 위에서 퍼진다, 반투명 흰 선)."""
    cv = Cv(16, 16); C0 = (214, 220, 232)
    for k in range(0, 16): cv.px(k, 0, C0) if k < 14 else None; cv.px(0, k, C0) if k < 14 else None
    for k in range(0, 15): cv.px(k, k, C0)
    for k in range(0, 14): cv.px(k, k // 2, C0); cv.px(k // 2, k, C0)
    for r in (4, 8, 11):
        for a in range(0, 90, 6):
            x = int(r * math.cos(math.radians(a)) * 1.0); y = int(r * math.sin(math.radians(a)))
            cv.px(x, y, (190, 198, 214))
    im = cv.im; p = im.load()
    for y in range(16):
        for x in range(16):
            if p[x, y][3]: p[x, y] = p[x, y][:3] + (150,)
    return im

def wall_cross(seed=18):
    """벽 앞면 십자 부조 1x1: 음각 홈 + 밝은 모서리."""
    cv = Cv(16, 16)
    for y in range(2, 14):
        cv.px(7, y, ST[1]); cv.px(8, y, ST[1]); cv.px(6, y, ST[4]) if y > 5 and y < 9 else None
    for x in range(4, 12): cv.px(x, 6, ST[1]); cv.px(x, 7, ST[1]); cv.px(x, 5, ST[4])
    for y in range(2, 14): cv.px(6, y, ST[4]) if not 5 <= y <= 7 else None
    cv.hline(5, 11, 14, ST[1])
    im = cv.im; p = im.load()
    for y in range(16):
        for x in range(16):
            if p[x, y][3]: p[x, y] = p[x, y][:3] + (230,)
    return im

def wall_sconce(seed=19):
    """벽 횃불꽂이 1x1: 쇠 고리 + 푸른 불꽃."""
    cv = Cv(16, 16)
    for y in range(9, 15): cv.px(7, y, IRON[3]); cv.px(8, y, IRON[1])
    for x in range(5, 11): cv.px(x, 8, IRON[4] if x < 8 else IRON[2])
    cv.px(5, 7, IRON[3]); cv.px(10, 7, IRON[2])
    fl = [(7, 2, BL2), (7, 3, BL), (8, 3, BL), (6, 4, BL2), (7, 4, (200, 250, 240)), (8, 4, BL), (9, 4, BL2), (6, 5, BL2), (7, 5, BL), (8, 5, BL), (9, 5, BL2), (7, 6, BL2), (8, 6, BL2), (7, 7, (30, 70, 80))]
    for x, y, c in fl: cv.px(x, y, c)
    return cv.im

def wall_niche_stack(seed=20):
    """납골 칸 2단 1x2: 벽에 판 직사각 구멍 둘, 속에 관 끝·뼈가 보인다."""
    cv = Cv(16, 32)
    for (y0, kind) in ((2, 0), (18, 1)):
        for y in range(y0, y0 + 12):
            for x in range(2, 14):
                if y == y0 or x == 2: cv.px(x, y, ST[1]); continue
                cv.px(x, y, (12, 8, 16) if y > y0 + 2 else (26, 18, 30))
        for x in range(1, 15): cv.px(x, y0 + 12, ST[4] if x < 8 else ST[3]); cv.px(x, y0 + 13, ST[2])
        for x in range(1, 15) : cv.px(x, y0 - 1, ST[1]) if y0 > 0 else None
        if kind == 0:
            for x in range(4, 13): cv.px(x, y0 + 8, WD[4]); cv.px(x, y0 + 9, WD[3]); cv.px(x, y0 + 10, WD[2])
            cv.px(4, y0 + 8, WD[5])
        else:
            for x in range(4, 13): cv.px(x, y0 + 10, BONE[3]) if x % 3 else None
            cv.ell(7, y0 + 8, 2.2, 2, lambda x, y: BONE[4]); cv.px(6, y0 + 8, DK); cv.px(8, y0 + 8, DK)
    return cv.im

def iron_door(seed=21):
    """지하 묘소 철문 1x2(앞면 장식): 아치 문틀 + 세로 띠 철판 + 고리 손잡이 + 큰 자물쇠."""
    cv = Cv(16, 32)
    for y in range(3, 32):
        for x in range(1, 15):
            if y < 6 and not (3 <= x <= 12 if y == 3 else 2 <= x <= 13 if y == 4 else True): continue
            fr = x in (1, 14) or y in (3, 4, 5)
            if fr: cv.px(x, y, ST[4] if x < 8 else ST[3]); continue
            k = 3 if x < 8 else 2
            if (x - 2) % 3 == 0: k = 1
            if y % 8 == 0: k += 1
            cv.px(x, y, IRON[clamp(k + 1, 1, 5)])
    for y in range(9, 30, 8):
        for x in range(2, 14): cv.px(x, y, IRON[1]); cv.px(x, y + 1, IRON[4] if x < 8 else IRON[2])
    cv.ell(8, 18, 2.5, 2.5, lambda x, y: GD[4] if x < 8 else GD[3]); cv.px(8, 18, DK); cv.px(8, 19, DK)
    cv.px(4, 8, IRON[5]); cv.px(11, 8, IRON[5]); cv.px(4, 26, IRON[5]); cv.px(11, 26, IRON[5])
    return cv.im

def crypt_stairs(seed=22):
    """지하로 내려가는 계단 입구 2x2(32x32): 돌 테두리 + 아래로 갈수록 좁고 어두워지는 다섯 단(윗면 밝은 줄 + 어두운 수직면). 걷기 가능."""
    cv = Cv(32, 32)
    for y in range(32):
        for x in range(32):
            if x < 3 or x > 28 or y < 3:
                k = 5 if (x < 3 or y < 3) and x < 16 else 4
                if x > 28 and y > 2: k = 3
                cv.px(x, y, ST[k]); continue
            b = (y - 3) // 6; ly = (y - 3) % 6
            dark = 1.0 - .17 * b
            if ly < 2: c = ST[5 if b < 2 else 4]; c = mul(c, dark)                  # 단 윗면(밝음)
            else: c = mul(ST[2], dark * (.85 if ly > 3 else 1.0))                  # 수직면(어두움)
            if _hash(x, y, seed) < .08: c = mul(c, 1.12)
            # 안쪽 벽 그림자: 좌우 가장자리 2px 와 아래로 갈수록 가운데 어둠
            if x < 5 or x > 26: c = mul(c, .62)
            if b >= 3: c = mix(c, DK, .35 * (b - 2))
            cv.px(x, y, c)
    for x in range(0, 32): cv.px(x, 0, ST[6] if x < 20 else ST[5])
    for y in range(0, 32): cv.px(0, y, ST[6]); cv.px(31, y, ST[2])
    return pz.fin(cv.im, .66)

def wilted_flowers(seed=23):
    """시든 꽃다발 1x1: 갈색 줄기, 붉은 시든 머리 둘, 끈."""
    cv = Cv(16, 16)
    for (x, y) in ((6, 12), (7, 11), (8, 12), (9, 11), (7, 12)): cv.px(x, y, WD[3])
    for k in range(5, 12): cv.px(7 - (11 - k) // 3, k, LF[1]); cv.px(9 + (11 - k) // 4, k, LF[1])
    for cx, cy in ((5, 6), (10, 5), (8, 8)):
        for dx, dy in ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)): cv.px(cx + dx, cy + dy, RD[1] if (dx + dy) % 2 else RD[2])
        cv.px(cx, cy, GD[4])
    cv.hline(5, 11, 12, RD[4]) 
    return shadow_under(fin(cv, .7), 8, 14, 5, 1, 50)

def raven_tomb(seed=24):
    """비석 위 까마귀 1x1: 작은 비석 머리에 앉은 검은 새."""
    cv = Cv(16, 16); mk = Mk(16, 16); mk.rect(3, 9, 13, 15); mk.ell(8, 9, 5, 2.4)
    vol(cv, mk, ST, 3, 13, 4, seed)
    for x in range(4, 13): cv.px(x, 8, ST[5] if x < 8 else ST[4])
    bk = [(14, 10, 22), (28, 24, 40), (50, 44, 66), (84, 78, 100)]
    for (x, y, k) in ((6, 4, 1), (7, 4, 1), (8, 4, 1), (9, 4, 1), (5, 5, 1), (6, 5, 1), (7, 5, 2), (8, 5, 1), (9, 5, 1), (10, 5, 0),
                      (5, 6, 1), (6, 6, 2), (7, 6, 2), (8, 6, 1), (9, 6, 1), (10, 6, 0), (11, 6, 0), (6, 7, 1), (7, 7, 1), (8, 7, 1), (9, 7, 0), (4, 6, 0), (3, 7, 0)):
        cv.px(x, y, bk[k])
    cv.px(9, 3, bk[1]); cv.px(10, 3, bk[0]); cv.px(11, 4, GD[4]); cv.px(10, 4, bk[2]); cv.px(9, 4, (200, 60, 40)) if False else None
    cv.px(7, 8, GD[3]); cv.px(9, 8, GD[3])
    return shadow_under(fin(cv, .7), 8, 15, 7, 1.2, 60)

def gate_pillar(seed=25):
    """묘지 문기둥 1x3: 네모 돌기둥, 윗면 뚜껑 + 가고일 대신 구슬 장식, 쇠 경첩. 아랫줄 막힘."""
    cv = Cv(16, 48); mk = Mk(16, 48); mk.rect(3, 12, 13, 44); mk.rect(1, 44, 15, 47); mk.rect(2, 8, 14, 12)
    vol(cv, mk, ST, 1, 15, 4, seed, grain=.09)
    for x in range(2, 14): cv.px(x, 8, ST[6] if x < 8 else ST[5]); cv.px(x, 11, ST[2])
    for x in range(1, 15): cv.px(x, 44, ST[5] if x < 8 else ST[4])
    cv.ell(8, 5, 3, 3, lambda x, y: ST[6] if (x < 8 and y < 5) else ST[5])               # 구슬
    for y in range(14, 42, 6): cv.px(5, y, ST[1]); cv.px(10, y + 2, ST[1])
    for (x, y) in ((12, 22), (12, 23), (12, 34), (12, 35)): cv.px(x, y, IRON[3])
    mk2 = Mk(16, 48); mk2.rect(3, 12, 13, 47); moss(cv, mk2, seed, .25)
    return shadow_under(fin(cv), 8, 47, 7, 1.5, 70)

def gate_arch_top(seed=26, w=4):
    """문기둥 사이를 잇는 쇠 아치 4x1(64x16, 위층 장식): 굽은 쇠 띠 + 매달린 창끝 + 가운데 금빛 십자. 아래는 비어 지나갈 수 있다."""
    W = w * 16; cv = Cv(W, 16)
    for x in range(0, W):
        t = (x - (W - 1) / 2) / (W / 2.0)
        y = int(round(8 - 5 * (1 - t * t)))
        cv.px(x, y + 3, IRON[1]); cv.px(x, y + 2, IRON[4] if x < W / 2 else IRON[3]); cv.px(x, y + 1, IRON[5] if x < W / 2 else IRON[4])
        if x % 5 == 2 and 4 < x < W - 5:
            for yy in range(y + 4, y + 8): cv.px(x, yy, IRON[3] if x < W / 2 else IRON[2])
            cv.px(x, y + 8, IRON[5])
    c = W // 2
    for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (-2, 1), (-1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (0, 3), (1, 3)): cv.px(c + dx - 0, dy, GD[5] if dx < 1 else GD[4])
    return pz.fin(cv.im, .66)

def fog_patch(seed=27, w=32):
    """안개 덩이(반투명 푸른 흰색, 1x1 또는 2x1): 바닥 위에 얹는다. 위층 아님, 걷기."""
    im = new(w, 16); p = im.load()
    for y in range(16):
        for x in range(w):
            n = pn(x + seed * 7, y * 1.4, 5, seed, 32) * .7 + pn(x, y, 2.2, seed + 2, 32) * .3
            dx = (x + .5 - w / 2) / (w / 2); dy = (y + .5 - 8) / 8
            e = 1 - (dx * dx * .8 + dy * dy)
            a = (n - .35) * e * 2.1
            if a > .14:
                aa = 40 if a < .3 else (72 if a < .5 else 100)
                p[x, y] = (206, 222, 238, aa)
    return im

def pumpkin_lantern(seed=28):
    """잭 랜턴 1x1: 주황 호박에 세모 눈·톱니 입, 속 불빛."""
    cv = Cv(16, 16)
    OR = [(86, 28, 8), (150, 54, 14), (214, 100, 24), (240, 140, 40), (255, 190, 70)]
    cv.ell(8, 10, 6.4, 4.8, lambda x, y: OR[3] if (x < 6 and y < 10) else (OR[2] if x < 11 else OR[1]))
    for x in (4, 7, 10): 
        for y in range(6, 15): cv.px(x, y, OR[1] if y % 2 else OR[2]) if False else None
    for x in range(5, 12): cv.px(x, 15 - (1 if x in (5, 11) else 0), OR[0])
    for (x, y) in ((5, 8), (6, 8), (6, 7), (9, 8), (10, 8), (9, 7)): cv.px(x, y, (255, 230, 120))
    for x in range(5, 12): cv.px(x, 11, (255, 210, 90)) if x % 2 else cv.px(x, 12, (255, 210, 90))
    cv.px(8, 4, LF[1]); cv.px(8, 3, LF[1]); cv.px(9, 3, LF[2])
    return shadow_under(fin(cv, .7), 8, 15, 6, 1.2, 60)

if __name__ == '__main__':
    fns = [sarcophagus_carved, coffin_wood, candelabra, statue_angel, gargoyle, bone_pile, cobweb, wall_cross, wall_sconce, wall_niche_stack, iron_door, crypt_stairs, wilted_flowers, raven_tomb, gate_pillar, gate_arch_top, fog_patch, pumpkin_lantern]
    items = [(f.__name__, f()) for f in fns]
    b = board(items, 9, 4); b.save('../../beodeul-kits/_out-B/t3.png'); print(b.size)
