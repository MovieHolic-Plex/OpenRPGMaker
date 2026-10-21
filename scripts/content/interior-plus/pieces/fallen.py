"""폴른 스타 실내 — 식은 화로·지붕까지 트인 관측 틈·옛 별지기의 별 렌즈.

- cold brazier: 네 화로의 방 퍼즐의 「꺼진 화로」. 켜진 상태는 v5 lava brazier(6441/6442) 그대로 쓰고, 꺼진 상태는 같은 삼각대·사발을
  화소 그대로 가져와 사발 속 용암만 숯·재로 바꾼다(켜고 끌 때 그림이 튀지 않게 실루엣이 같다).
- dome slit tall: 천문대 큰 방 북벽 관측 틈을 천장 띠까지 2줄 올려 「지붕이 트인 틈」으로 읽히게 한 2×4 걸이(위 2줄 = 천장, 아래 2줄 = 벽면).
- star lens: 옛 별지기의 방 한가운데 돌 원통 받침 위 놋쇠 굴대에 물린 큰 둥근 렌즈(윗면이 하늘을 본다). 결전 뒤 빛을 쏘아 올린다.
빛은 왼쪽 위. 색은 실내 공통 팔레트 v6 램프만.
"""
import math, os
from PIL import Image
from iplib import REG, K, cyl, ring, Cv, hnoise, line, ROOT

SHEET = os.path.join(ROOT, 'public', 'assets', 'atlas-interior', 'interior-chipset.png')


def _sheet_tile(i):
    im = Image.open(SHEET).convert('RGBA')
    return im.crop(((i % 48) * 16, (i // 48) * 16, (i % 48) * 16 + 16, (i // 48) * 16 + 16))


ORANGE = {(0xa8, 0x4d, 0x0a), (0xe0, 0x6a, 0x10), (0xea, 0x8e, 0x3f), (0xf4, 0xb3, 0x70), (0xff, 0xf8, 0xb0), (0xff, 0xd8, 0xa0)}


@REG.piece('cold brazier', '꺼진 화로(삼각대 쇠 화로, 숯·재)', 'puzzle', 'floor', 1, 1, 0, 'other',
           '불이 꺼진 세발 쇠 화로 — 열린 사발 테 안에 잿빛 재와 식은 숯 덩이, 숯 틈에 꺼져 가는 불씨. 불붙인 모습은 lava brazier.',
           ['퍼즐', '화로', '지하'],
           '화로 순서 퍼즐 방 바닥. 같은 칸에서 lava brazier(켜짐)와 바꿔 낀다.', ['lava brazier'], use=('search',))
def cold_brazier(c):
    src = _sheet_tile(6442)   # v5 lava brazier 아래 칸(삼각대·사발) — 5줄 아래(사발 몸·삼각대)는 화소 그대로
    for y in range(5, 16):
        for x in range(16):
            r, g, b, a = src.getpixel((x, y))
            if a: c.p(x, y, (r, g, b))
    RIM_L, RIM, RIM_D, RIM_DD = (0x76, 0x80, 0x8a), (0x4a, 0x54, 0x60), (0x36, 0x3e, 0x47), (0x22, 0x28, 0x2e)
    # 열린 사발 테(위에서 본 타원): 뒷테 1줄(밝음) · 양옆 · 앞 입술 4줄(밝음)
    for x in range(2, 14): c.p(x, 1, RIM_L if x < 9 else RIM)
    c.p(13, 1, RIM_D); c.p(14, 2, RIM_DD); c.p(14, 3, RIM_DD); c.p(1, 2, RIM); c.p(1, 3, RIM_L)
    for x in range(1, 14): c.p(x, 4, RIM_L if x < 6 else RIM if x < 11 else RIM_D)
    c.p(14, 4, RIM_DD)
    # 사발 속(2~3줄): 옅은 잿빛 재 바탕
    ASH = (0xb8, 0xb0, 0xa4); ASH_D = (0x94, 0x8c, 0x82); ASH_L = (0xd6, 0xd0, 0xc6)
    for y in (2, 3):
        for x in range(2, 14):
            h = hnoise(x, y, 53)
            c.p(x, y, ASH_L if (y == 2 and h > .7) else ASH_D if (y == 3 and h > .5) or x == 13 else ASH)
    # 식은 숯 덩이 넷(검정 — 윗면만 조금 밝다) + 꺼져 가는 불씨 둘(켜진 화로의 가장 어두운 주황)
    CH, CH_T = (0x1a, 0x1c, 0x22), (0x3a, 0x3c, 0x44)
    for (x, y) in ((3, 3), (4, 3), (7, 2), (8, 2), (8, 3), (11, 3), (12, 3), (10, 2)):
        c.p(x, y, CH)
    for (x, y) in ((3, 2), (7, 1 + 1), (12, 2)):
        pass
    c.p(4, 2, CH_T); c.p(11, 2, CH_T)
    c.p(8, 3, (0xa8, 0x4d, 0x0a)); c.p(12, 3, (0x7a, 0x38, 0x08))


@REG.piece('dome slit tall', '지붕까지 트인 관측 틈(2×3, 천장 1줄 + 벽면 2줄)', 'observatory', 'hang', 2, 0, 0, 'wall_mounted',
           '천문대 북벽을 바닥 문턱부터 천장 띠까지 세로로 가른 관측 틈 — 돌 문설주가 천장 속까지 올라가고 틈 사이로 밤하늘(달·별), 천장 가장자리 선 위에 놋쇠 돔 레일, 벽면 높이에서 양옆으로 연 나무 덧문.',
           ['천문대', '관측실', '관측 틈'],
           '천문대 큰 방 북벽. 맨 위 줄이 천장 줄, 아래 두 줄이 벽면이다(y = 천장 줄). 바로 아래에 큰 망원경.', ['great telescope'], rows=3)
def dome_slit_tall(c):
    W, H = 32, 48
    # 하늘(틈 속): 위가 깊고 아래로 조금 밝다 — 띠 경계는 두 줄 섞어 부드럽게
    for y in range(0, 44):
        k = 0 if y < 10 else 1 if y < 22 else 2 if y < 34 else 3
        for x in range(8, 24):
            kk = k
            if y in (9, 21, 33) and (x + y) % 2 == 0: kk = k + 1        # 띠 경계 한 줄 섞기
            if y in (10, 22, 34) and (x + y) % 2 == 1: kk = k - 1
            h = hnoise(x, y, 77)
            if h > .93: kk = kk + 1
            elif h < .05 and kk > 0: kk = kk - 1
            if x == 8: kk = max(0, kk - 1)
            c.p(x, y, K('blue', kk))
    for (x, y, col) in ((11, 4, K('white', 6)), (20, 8, K('yellow', 5)), (14, 18, K('white', 5)), (21, 20, K('white', 6)),
                        (10, 25, K('yellow', 5)), (18, 29, K('white', 5)), (12, 35, K('white', 6)), (21, 38, K('yellow', 5)), (15, 41, K('white', 5))):
        c.p(x, y, col)
    for (x, y) in ((16, 24), (16, 25), (15, 25), (17, 25), (16, 26)): c.p(x, y, K('blue', 6))
    c.p(16, 25, K('white', 6))
    c.ell(17, 4, 3.2, 3.2, None, only=lambda x, y: K('yellow', 6))
    c.ell(18.6, 3, 3, 3, None, only=lambda x, y: K('blue', 0))
    # 돌 문설주 둘: 천장 줄(0~11)은 천장처럼 어둡게, 벽면(16~)은 밝은 마름돌
    for x0 in (4, 24):
        for y in range(0, 46):
            j = (y // 8) % 2
            dark = 3 if y < 12 else 0
            c.p(x0, y, K('stone', 1)); c.p(x0 + 1, y, K('stone', max(1, 6 - j - dark))); c.p(x0 + 2, y, K('stone', max(1, 4 + (1 if hnoise(x0, y, 5) > .7 else 0) - dark))); c.p(x0 + 3, y, K('stone', max(1, 2 + j - dark)))
            if y % 8 == 7: c.hl(x0 + 1, x0 + 3, y, K('stone', 1 + j))
    # 놋쇠 돔 레일 — 천장 가장자리 선(12~15) 위에 가로로 걸친다
    c.hl(3, 28, 12, K('brass', 1)); c.hl(4, 27, 13, K('brass', 6)); c.hl(4, 27, 14, K('brass', 4)); c.hl(3, 28, 15, K('brass', 1))
    for x in range(8, 24, 4): c.p(x, 14, K('brass', 2))
    # 문설주 중간 놋쇠 띠
    for x0 in (4, 24): c.hl(x0, x0 + 3, 28, K('brass', 5)); c.hl(x0, x0 + 3, 29, K('brass', 2))
    # 벽면 높이: 양옆으로 연 나무 덧문(판자 + 쇠띠)
    for x0, x1 in ((0, 3), (28, 31)):
        for y in range(19, 43):
            for x in range(x0, x1 + 1):
                k = 5 if x == x0 + 1 else 4 if x == x1 - 1 else 3
                if hnoise(x, y // 3, 9) > .82: k -= 1
                if x == x0 or x == x1: k = 1
                c.p(x, y, K('wood', k))
        for y in (23, 37): c.hl(x0, x1, y, K('iron', 4))
        c.hl(x0, x1, 18, K('wood', 1)); c.hl(x0, x1, 43, K('wood', 1))
    # 돌 문턱
    c.hl(2, 29, 44, K('stone', 6)); c.hl(2, 29, 45, K('stone', 4)); c.hl(2, 29, 46, K('stone', 2)); c.hl(2, 29, 47, K('stone', 1))


@REG.piece('star lens', '별 렌즈(옛 별지기의 큰 렌즈, 4×2)', 'observatory', 'floor', 4, 2, 48, 'other',
           '룬 띠를 두른 둥근 돌 받침 위, 놋쇠 굴대 두 팔에 물린 사람 키보다 큰 둥근 렌즈 — 렌즈 윗면이 하늘(천장)을 보며 속에 푸른 별빛이 고였다.',
           ['지하', '신전', '렌즈', '중심 기물'],
           '옛 별지기의 방 한가운데. 발밑 4×2칸은 막힌다. 앞(남쪽)에 2줄 비운다.', ['statue', 'candelabra'], use=('read',))
def star_lens(c):
    # 캔버스 64×80. 발밑 = y48..79(4×2).
    c.shadow(4, 72, 60, 79)
    # ① 둥근 돌 받침(원통) + 금빛 룬 띠 + 마름돌 결
    cy = cyl(c, 32, 52, 25, 7, 15, 'stone', t0=5, body=(6, 5, 4, 4, 3, 2, 1))
    for x in range(6, 59):
        u = (x - 32) / 25.5
        if abs(u) > 1: continue
        bow = 7 * math.sqrt(1 - u * u)
        c.p(x, int(round(cy + 2 + bow * .45)), K('stone', 2 if u > .2 else 3))
        for y in range(int(cy) + 1, int(cy + 15 + bow)):
            if hnoise(x, y, 23) > .91 and len(c.get(x, y) or ()) == 3: c.p(x, y, K('stone', 3 if u > 0 else 4))
        y = int(round(cy + 9 + bow))                 # 룬 띠(앞으로 휜다)
        c.p(x, y, K('gold', 4 if u < .3 else 3)); c.p(x, y + 1, K('gold', 2))
        if x % 5 == 2 and abs(u) < .85: c.p(x, y, K('gold', 6)); c.p(x, y - 1, K('gold', 5))
    for (x, y0, y1) in ((16, 3, 8), (32, 4, 9), (46, 3, 8), (24, 12, 16), (40, 12, 16)):
        for y in range(int(cy) + y0, int(cy) + y1): c.p(x, y, K('stone', 2))
    c.ell(32, cy, 25, 7, None, only=lambda x, y: (K('stone', 6 if (x - 32) < -8 and y < cy else 5 if (x - 32) < 10 else 4)) if hnoise(x, y, 31) < .92 else K('stone', 4))
    ring(c, 32, cy, 25, 7, K('stone', 3))
    ring(c, 32, cy, 21, 5.6, K('stone', 4))
    # ② 놋쇠 굴대: 받침 윗면 가운데 원판 + 두 팔(바깥으로 벌어져 오른다)
    c.ell(32, cy, 8, 2.6, None, only=lambda x, y: K('brass', 5 if x < 31 else 3))
    ring(c, 32, cy, 8, 2.6, K('brass', 2))
    for (xa, xb) in ((26, 10), (38, 54)):
        for i in range(0, 33):
            t = i / 32
            x = round(xa + (xb - xa) * t); y = round(cy - 1 - 33 * t)
            left = xa < 32
            c.p(x - 1, y, K('brass', 6 if left else 4)); c.p(x, y, K('brass', 5 if left else 3)); c.p(x + 1, y, K('brass', 3 if left else 2)); c.p(x + 2, y, K('brass', 1))
    # ③ 렌즈(위를 본 둥근 원판 — 3/4 로 납작한 타원). 테 = 놋쇠 + 옆면 두께, 속 = 유리(왼쪽 위 밝음), 가운데 별빛
    lx, ly, rx, ry = 32, 20, 21, 12
    for y in range(int(ly - ry) - 1, int(ly + ry) + 6):
        for x in range(int(lx - rx) - 1, int(lx + rx) + 2):
            inside = ((x - lx) / (rx + .5)) ** 2 + ((y - ly) / (ry + .5)) ** 2 <= 1
            if not inside:
                if ((x - lx) / (rx + .5)) ** 2 + ((y - ly - 4) / (ry + .5)) ** 2 <= 1 and y > ly:
                    c.p(x, y, K('brass', 4 if x < lx - 8 else 3 if x < lx + 8 else 2))
                    if y % 2 == 0 and x % 6 == 0: c.p(x, y, K('brass', 1))
                continue
            d = ((x - lx) / rx) ** 2 + ((y - ly) / ry) ** 2
            if d > .80:
                c.p(x, y, K('brass', 6 if (x < lx and y < ly) else 5 if y < ly else 4)); continue
            v = (x - lx) / rx + (y - ly) / ry
            k = 5 if v < -1.0 else 4 if v < -.4 else 3 if v < .2 else 2 if v < .8 else 1
            if hnoise(x, y, 61) > .92: k += 1
            c.p(x, y, K('glass', k))
    ring(c, lx, ly, rx * .82, ry * .82, K('brass', 2))
    for a in range(0, 360, 30):                        # 테 리벳
        r = math.radians(a)
        c.p(int(round(lx + rx * .9 * math.cos(r))), int(round(ly + ry * .9 * math.sin(r))), K('brass', 6 if a > 180 else 3))
    # 속 별빛(가운데 여덟 갈래 별 + 둘레 빛 점)
    for i in range(-4, 5):
        c.p(lx + i, ly, K('ice', 6 if abs(i) < 2 else 5)); c.p(lx, ly + int(i * .7), K('ice', 6 if abs(i) < 2 else 5))
    for i in (-2, -1, 1, 2): c.p(lx + i, ly + i, K('ice', 4)); c.p(lx + i, ly - i, K('ice', 4))
    c.p(lx, ly, K('white', 6))
    for (x, y) in ((22, 16), (42, 23), (27, 26), (39, 14), (19, 22), (45, 18)): c.p(x, y, K('glass', 6))
    line(c, 17, 17, 23, 11, K('white', 6)); line(c, 18, 19, 21, 16, K('glass', 6))     # 왼쪽 위 반사광
    # 굴대 축 단추(렌즈 양옆)
    for x in (10, 54):
        c.rect(x - 2, 18, x + 2, 22, K('brass', 4)); c.hl(x - 2, x + 1, 18, K('brass', 6)); c.vl(x - 2, 18, 21, K('brass', 5)); c.p(x, 20, K('brass', 1))
    c.outline()
