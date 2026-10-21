"""폴른 스타 실내 — 식은 화로·지붕까지 트인 관측 틈·옛 별지기의 별 렌즈.

- cold brazier: 네 화로의 방 퍼즐의 「꺼진 화로」. 켜진 상태는 v5 lava brazier(6441/6442) 그대로 쓰고, 꺼진 상태는 같은 삼각대·사발을
  화소 그대로 가져와 사발 속 용암만 숯·재로 바꾼다(켜고 끌 때 그림이 튀지 않게 실루엣이 같다).
- dome slit tall: 천문대 큰 방 북벽 관측 틈을 천장 띠까지 2줄 올려 「지붕이 트인 틈」으로 읽히게 한 2×4 걸이(위 2줄 = 천장, 아래 2줄 = 벽면).
- star lens: 옛 별지기의 방 한가운데 돌 원통 받침 위 놋쇠 굴대에 물린 큰 둥근 렌즈(윗면이 하늘을 본다). 결전 뒤 빛을 쏘아 올린다.
빛은 왼쪽 위. 색은 실내 공통 팔레트 v6 램프만.
"""
import math, os
from PIL import Image
from iplib import REG, K, cyl, ring, Cv, hnoise, line, ROOT, box

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


def _seal_frame(c):
    """바닥에 박힌 돌 테두리(2×2 칸, 위에서 본 3/4) — 바깥 윤곽 · 한 톤 윗면 3줄 · 앞(남) 턱 2줄. 닫힘/열림이 같은 테두리를 쓴다.
    따뜻한 잿빛(linen 램프)으로 바닥보다 한 단 밝게만 — 버튼처럼 빛을 나누지 않는다(VQA r4)."""
    x0, y0, x1, y1 = 1, 2, 30, 30
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if min(x - x0, y - y0, x1 - x, y1 - y) > 3: continue
            k = 2
            if y1 - y <= 1: k = 1                               # 앞 턱(남쪽 면)
            elif hnoise(x, y, 41) > .86: k = 1
            elif hnoise(x, y, 43) > .9: k = 3
            c.p(x, y, K('linen', k))
    for (x, y) in ((9, 3), (9, 4), (21, 3), (21, 4), (2, 14), (3, 14), (28, 17), (29, 17), (13, 27), (13, 28), (24, 27), (24, 28)):
        c.p(x, y, K('linen', 1))                                # 마름돌 이음
    c.hl(x0 + 1, x1 - 1, y0 + 1, K('linen', 3))                 # 바깥 모서리에 걸린 얇은 빛 한 줄(위)
    c.hl(x0, x1, y0, K('linen', 0)); c.vl(x0, y0, y1, K('linen', 0)); c.vl(x1, y0, y1, K('linen', 0)); c.hl(x0, x1, y1, K('linen', 0))


@REG.piece('star seal', '별 봉인 돌뚜껑(닫힘, 2×2)', 'gimmick', 'flat', 2, 2, 0, 'flat',
           '바닥에 박힌 돌 테두리 속 내려가는 돌계단을 검은 돌 뚜껑이 덮었다 — 뚜껑 한가운데 다섯 갈래 별 모양 홈(금테, 속은 보랏빛), 둘레에 룬 점.',
           ['던전', '유적', '천문대', '봉인'],
           '서고·지하 입구 바닥. 양옆에 봉인석(seal stone) 한 쌍. 열쇠로 열면 같은 칸을 star seal open 으로 바꿔 낀다.', ['seal stone', 'star seal open'], use=('seal',))
def star_seal(c):
    _seal_frame(c)
    # 검은 돌 뚜껑(봉인석과 같은 black 램프) — 테두리 안쪽에 딱 맞게, 이음 한 줄
    for y in range(6, 27):
        for x in range(5, 27):
            k = 2 if hnoise(x, y, 19) < .86 else 3
            c.p(x, y, K('black', k))
    c.hl(5, 26, 6, K('black', 4)); c.vl(5, 6, 25, K('black', 4))
    c.hl(5, 26, 26, K('black', 1)); c.vl(26, 6, 26, K('black', 1))
    c.hl(4, 27, 5, K('black', 1)); c.vl(4, 5, 27, K('black', 1)); c.hl(4, 27, 27, K('linen', 0)); c.vl(27, 5, 27, K('black', 1))
    # 둥근 홈 테(룬 둘레)
    cx, cy = 15.5, 16
    ring(c, cx, cy, 9, 8, K('black', 1))
    ring(c, cx, cy - .6, 9, 8, K('black', 5))
    for a in range(0, 360, 45):                      # 룬 점 여덟
        r = math.radians(a + 22)
        c.p(int(round(cx + 9 * math.cos(r))), int(round(cy + 8 * math.sin(r))), K('purple', 4))
    # 다섯 갈래 별 홈 — 속은 보랏빛, 가장자리 금테(왼쪽 위 밝음)
    pts = []
    for i in range(10):
        r = 7.4 if i % 2 == 0 else 3.1
        a = math.radians(-90 + 36 * i)
        pts.append((cx + r * math.cos(a), cy + .4 + r * math.sin(a) * .92))
    def inside(px, py):
        n = False
        for i in range(10):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % 10]
            if (ya > py) != (yb > py) and px < xa + (py - ya) * (xb - xa) / (yb - ya): n = not n
        return n
    fill = set((x, y) for y in range(6, 27) for x in range(5, 27) if inside(x + .5, y + .5))
    for (x, y) in fill:
        border = any((x + dx, y + dy) not in fill for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if border:
            c.p(x, y, K('gold', 5 if (x < cx and y < cy + 1) else 3))
        else:
            c.p(x, y, K('purple', 3 if (x + y) % 3 else 4))
    c.p(15, 16, K('purple', 6)); c.p(16, 16, K('purple', 5)); c.p(15, 17, K('purple', 5))


@REG.piece('star seal open', '별 봉인 돌계단(열림, 2×2)', 'gimmick', 'flat', 2, 2, 0, 'flat',
           '돌 뚜껑이 걷힌 바닥 돌계단 입구 — star seal 과 같은 돌 테두리 속으로 마름돌 계단이 북쪽 어둠 아래로 내려간다.',
           ['던전', '유적', '천문대', '계단'],
           'star seal 이 열린 뒤 같은 칸. 이동 이벤트는 이 칸 위에.', ['star seal', 'seal stone'], use=('travel',))
def star_seal_open(c):
    """v5 「stairs down」(3960~3963) 구멍 속 계단을 화소 그대로 옮겨 나무 램프를 테두리와 같은 따뜻한 돌(linen)로 바꿔 칠한다 —
    v5 계단과 같은 디딤판 구조(밝은 앞 모서리·디딤판·그늘 줄, 안쪽 좌우 벽)라 1배에서 「내려가는 계단」으로 읽힌다(VQA r6: 손으로 그린 판은 화덕·창살로 읽혔다)."""
    _seal_frame(c)
    src = Image.new('RGBA', (32, 32))
    for i, (x, y) in zip((3960, 3961, 3962, 3963), ((0, 0), (16, 0), (0, 16), (16, 16))): src.paste(_sheet_tile(i), (x, y))
    remap = {(8, 8, 10): K('black', 0), (42, 24, 11): K('black', 1), (58, 34, 16): K('black', 2), (65, 30, 5): K('linen', 0),
             (99, 49, 11): K('linen', 1), (109, 59, 21): K('linen', 1), (154, 84, 53): K('linen', 2), (158, 104, 75): K('linen', 2),
             (183, 114, 70): K('linen', 3)}
    for y in range(5, 28):
        for x in range(4, 28): c.p(x, y, K('black', 0))
    # 먼 단 둘(어둠에 잠김) — v5 계단 위에 이어 붙인다
    for x in range(6, 26):
        c.p(x, 8, K('black', 3)); c.p(x, 9, K('black', 1))
        c.p(x, 10, K('linen', 0)); c.p(x, 11, K('black', 3)); c.p(x, 12, K('black', 1))
    c.hl(4, 27, 5, K('linen', 0))
    for sy in range(14, 28):                                   # v5 구멍 14~27줄 → 13~26줄
        for sx in range(5, 27):
            r, g, b, a = src.getpixel((sx, sy))
            if a: c.p(sx, sy - 1, remap.get((r, g, b), K('linen', 1)))
    for y in range(6, 27):                                     # 바깥 한 칸 안벽
        c.p(4, y, K('black', 1)); c.p(27, y, K('black', 0))
    for y in range(8, 13): c.p(5, y, K('black', 2)); c.p(26, y, K('black', 1))


def _great_brazier(c, oy, lit):
    """큰 화로(2칸 폭): 밝은 마름돌 받침 위 넓은 쇠 사발. oy = 그림 윗단 여백(켜짐은 불꽃 자리 16px 더)."""
    c.shadow(3, oy + 26, 29, oy + 31)
    # ① 마름돌 받침(3/4 상자) — 어두운 바닥에서 떠 보이게 밝은 돌
    box(c, 6, oy + 20, 20, 3, 7, 'stone', t0=5, f0=4)
    for x in (12, 19):
        c.vl(x, oy + 24, oy + 25, K('stone', 2))
    for x in (9, 16, 22):
        c.vl(x, oy + 27, oy + 29, K('stone', 2))
    c.hl(7, 24, oy + 26, K('stone', 2))
    # ② 짧은 쇠 다리 셋(사발 → 받침 윗면)
    for x in (9, 16, 22):
        c.vl(x, oy + 17, oy + 21, K('iron', 2)); c.vl(x + 1, oy + 17, oy + 21, K('iron', 1))
    # ③ 쇠 사발 몸(반 타원, 왼쪽 위 밝음) + 놋쇠 띠
    cx, cy = 16, oy + 9
    for y in range(cy, oy + 19):
        t = (y - cy) / 10
        half = 14 * math.sqrt(max(0, 1 - t * t * .9))
        for x in range(int(cx - half), int(math.ceil(cx + half)) + 1):
            u = (x - cx) / max(1, half)
            k = 4 if u < -.55 else 3 if u < -.1 else 2 if u < .45 else 1
            if y >= oy + 16: k -= 1
            c.p(x, y, K('iron', k))
    for x in range(4, 29):
        u = (x - cx) / 13.5
        if abs(u) > 1: continue
        y = int(round(cy + 4 + 1.6 * math.sqrt(1 - u * u)))
        c.p(x, y, K('brass', 5 if u < -.2 else 4 if u < .4 else 2)); c.p(x, y + 1, K('brass', 1))
        if x % 6 == 3: c.p(x, y, K('brass', 6))
    # ④ 사발 테(위에서 본 타원) + 속
    c.ell(cx, cy, 14, 4.2, None, only=lambda x, y: K('iron', 1))
    ring(c, cx, cy, 14, 4.2, K('iron', 4))
    for x in range(3, 16):
        for y in range(int(cy) - 5, int(cy)):
            if c.get(x, y) == K('iron', 4): c.p(x, y, K('iron', 5))
    for x in range(int(cx) + 3, 30):
        for y in (cy, cy + 1, cy + 2, cy + 3):
            if c.get(x, y) == K('iron', 4) and y >= cy: c.p(x, y, K('iron', 3))
    inner = lambda x, y: ((x - cx) / 12.2) ** 2 + ((y - cy) / 3.0) ** 2 <= 1
    for y in range(cy - 4, cy + 4):
        for x in range(2, 30):
            if not inner(x, y): continue
            h = hnoise(x, y, 61 if lit else 53)
            if lit:
                k = 6 if h > .85 else 5 if h > .55 else 4 if h > .25 else 3
                c.p(x, y, K('orange', k) if not (h < .12) else K('orange', 2))
            else:
                col = K('stone', 4) if h > .82 else K('stone', 3) if h > .62 else K('black', 3) if h > .3 else K('black', 2)
                c.p(x, y, col)
    if not lit:
        for (x, y) in ((8, cy), (9, cy), (14, cy - 1), (15, cy - 1), (15, cy), (21, cy + 1), (22, cy), (11, cy + 2), (18, cy + 2)):
            c.p(x, y, K('black', 1))
        c.p(15, cy, K('orange', 2)); c.p(21, cy + 1, K('orange', 1))


@REG.piece('great brazier', '큰 꺼진 화로(2칸, 돌 받침)', 'puzzle', 'floor', 2, 1, 16, 'other',
           '밝은 마름돌 받침 위 놋쇠 띠를 두른 넓은 쇠 사발 — 사발 속엔 잿빛 재와 식은 숯, 꺼져 가는 불씨 둘. 불붙인 모습은 great brazier lit.',
           ['퍼즐', '화로', '지하'],
           '화로 순서 퍼즐 방 돌 단 네 모서리. 같은 자리에서 great brazier lit(켜짐)와 바꿔 낀다.', ['great brazier lit'], use=('search',))
def great_brazier(c):
    _great_brazier(c, 0, False)


@REG.piece('great brazier lit', '큰 켜진 화로(2칸, 돌 받침, 불꽃)', 'puzzle', 'floor', 2, 1, 32, 'other',
           '같은 돌 받침·쇠 사발에 숯이 벌겋게 달아오르고 사발 위로 두 칸 폭 불꽃이 한 칸 높이 솟는다.',
           ['퍼즐', '화로', '지하'],
           'great brazier 와 같은 자리(불꽃 줄이 한 줄 위).', ['great brazier'], use=('search',))
def great_brazier_lit(c):
    _great_brazier(c, 16, True)
    # 불꽃: 높이가 다른 혀 셋(가운데 왼쪽이 가장 높다), 혀 사이는 비우고 끝은 살짝 기운다. 흰 심은 사발 바로 위 하나.
    F = [
        ".............2..................",
        "............232.................",
        "............2432................",
        ".............242................",
        ".............32.................",
        "............232.................",
        "...........2432.......2.........",
        "...........242.......232........",
        "..........1432.......2432.......",
        ".....2....2432........242.......",
        "....232...2442.......1332.......",
        "....242..24432.......2432.......",
        ".....23..24542......24442.......",
        ".....232124542.....124432.......",
        "....12432245432...12445432......",
        "....2443224544321224454321......",
        "...124433445554332344554322.....",
        "...2344344555544434455544321....",
        "..12344455565554445556544332....",
        "..23444555666555555565554332....",
        "..233444555555555555555443322...",
    ]
    COL = {'1': K('orange', 2), '2': K('orange', 3), '3': K('orange', 4), '4': K('orange', 5), '5': K('orange', 6), '6': K('yellow', 6)}
    for j, row in enumerate(F):
        for x, ch in enumerate(row):
            if ch in COL: c.p(x, 4 + j, COL[ch])
    for (x, y) in ((9, 5), (20, 3), (25, 8)):
        c.p(x, y, K('orange', 4))
