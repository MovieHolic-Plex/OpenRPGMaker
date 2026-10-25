#!/usr/bin/env python3
"""modern_city 한국 업무 지구 거리 소품 — 지하철 출구 번호 표지·한글 세로 간판·가로수 보호판을 코드 손 도트로 그린다(2026-10-24).

modern4 팔레트(src/harnesses/modern-chipset/palette.py)의 잠긴 램프만 쓴다. 윤곽은 ink(순검정 아님), 빛은 좌상.
글자는 Galmuri9(SIL OFL 1.1, public/assets/fonts) 를 1비트 마스크로 찍은 뒤 손으로 고른 램프로 칠한다 — 지어낸 이름만 쓴다(실제 상표 없음).
생성 이미지·트레이싱 없음.

  python3 scripts/content/modern-city-street/art_kr.py OUT.png   # 6배 미리보기
"""
import io, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import palette as PAL   # noqa: E402

_R = {name: [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in cols] for name, _ch, cols, _d in PAL.build()}
ROAD, SLATE, ROOF, MINT, TEAL, BLUE, BRICK, WINE, AMBER, LEAF, BODY, WHITE, INK, AZALEA = (
    _R[k] for k in ('road', 'slate', 'roof', 'mint', 'teal', 'blue', 'brick', 'wine', 'amber', 'leaf', 'body', 'white', 'ink', 'azalea'))
SHADOW = (11, 18, 36, 90)
O = INK[0]


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def canvas(w, h): return np.zeros((h, w, 4), np.uint8)


def put(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = (*c[:3], c[3] if len(c) > 3 else 255)


def rect(a, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(a, x, y, c)


def ttop(a, x0, x1, y0, rows, face, back, rim):
    """3/4 윗면: 모서리가 둥글게 들어간 판(안쪽 2·1·0 칸), 뒤쪽 줄은 밝게, 앞 모서리는 rim. 반환 = 앞면 시작 행."""
    for j in range(rows):
        ins = 2 if j == 0 else 1 if j < 3 else 0
        c = back if j < 2 else rim if j == rows - 1 else face
        for x in range(x0 + ins, x1 - ins + 1): put(a, x, y0 + j, c)
        put(a, x0 + ins, y0 + j, O); put(a, x1 - ins, y0 + j, O)
    for x in range(x0 + 2, x1 - 1): put(a, x, y0, O)
    for x in range(x0, x1 + 1): put(a, x, y0 + rows, O)
    return y0 + rows + 1


# 손으로 찍은 한글 9×9 — 자모 사이 1칸 틈(Argon r9: 글꼴 글자는 «국»의 ㅜ 줄기가 받침 ㄱ 에 붙고 «카»의 ㅋ 이 휘어 1배에서 안 읽혔다).
HANGUL = {
    '카': ["#####..#.", "....#..#.", "....#..#.", "#####..##", "....#..#.", "....#..#.", "...#...#.", "..#....#.", ".#.....#."],
    '페': ['......#.#', '#####.#.#', '.#.#..#.#', '.#.#..#.#', '.#.#.##.#', '.#.#..#.#', '.#.#..#.#', '#####.#.#', '......#.#'],
    '편': ["#####..#.", ".#.#..##.", ".#.#...#.", ".#.#..##.", "#####..#.", ".........", ".#.......", ".#.......", ".#######."],
    '의': ["..##...#.", ".#..#..#.", ".#..#..#.", ".#..#..#.", "..##...#.", ".......#.", "######.#.", ".......#.", ".......#."],
    '국': [".#######.", ".......#.", ".........", "#########", "....#....", ".........", ".#######.", ".......#.", ".......#."],
    '밥': ["#...#..#.", "#####..##", "#...#..#.", "#####..#.", ".........", ".#.....#.", ".#######.", ".#.....#.", ".#######."],
    '약': [".###...#.", "#...#..##", "#...#..#.", "#...#..##", ".###...#.", ".........", ".#######.", ".......#.", ".......#."],
}


def hangul_mask(ch):
    return np.array([[c == '#' for c in row] for row in HANGUL[ch]])


_FONT = None


def font():
    """Galmuri9 (OFL) — woff2 를 메모리에서 TTF 로 풀어 PIL 에 넘긴다."""
    global _FONT
    if _FONT is None:
        from fontTools.ttLib import TTFont
        t = TTFont(os.path.join(ROOT, 'public/assets/fonts/Galmuri9.woff2')); t.flavor = None
        buf = io.BytesIO(); t.save(buf); buf.seek(0)
        _FONT = ImageFont.truetype(buf, 10)
    return _FONT


def glyph_mask(text):
    """글자 하나의 1비트 마스크(잉크 영역만 잘라서)."""
    im = Image.new('L', (24, 24), 0); ImageDraw.Draw(im).text((4, 4), text, font=font(), fill=255)   # 여유 캔버스 — 16칸에 (1,0) 으로 찍으면 오른쪽 획이 잘렸다
    m = np.asarray(im) > 127
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def stamp(a, mask, x0, y0, c, shade=None):
    """마스크를 (x0,y0) 에 찍는다. shade 가 있으면 글자 아랫줄 한 화소 그림자(입체 글자판)."""
    h, w = mask.shape
    for y in range(h):
        for x in range(w):
            if not mask[y, x]: continue
            if shade is not None and (y + 1 >= h or not mask[y + 1, x]): put(a, x0 + x, y0 + y + 1, shade)
    for y in range(h):
        for x in range(w):
            if mask[y, x]: put(a, x0 + x, y0 + y, c)


# 손으로 찍은 4×6 숫자(번호판 x 5..8) — 왼쪽 빛줄(x=4)·오른쪽 그늘(x=10)과 한 칸씩 떨어진다(Argon r11). «4»는 사선 어깨가 있는 꼴(Argon r14: 3칸 «4»가 «ɥ»로 읽혔다).
DIGITS = {
    1: ["..#.", ".##.", "..#.", "..#.", "..#.", ".###"],
    2: [".##.", "#..#", "...#", "..#.", ".#..", "####"],
    3: ["###.", "...#", ".##.", "...#", "...#", "###."],
    4: ["..#.", ".##.", "#.#.", "####", "..#.", "..#."],
}


def digit_mask(n):
    return np.array([[ch == '#' for ch in row] for row in DIGITS[n]])


def base_plate(a, y0, rows=4):
    """땅에 놓인 받침판 — 위에서 본 윗면(뒤 밝게, 좌상 빛)·앞 모서리 한 줄·바닥 그림자."""
    for j in range(rows):
        for x in range(0, 16): put(a, x, y0 + j, SLATE[4] if j == 0 else SLATE[3] if x < 8 else SLATE[2])
        put(a, 0, y0 + j, O); put(a, 15, y0 + j, O)
    for x in range(16): put(a, x, y0 + rows, SLATE[1])
    for x in range(16): put(a, x, min(31, y0 + rows + 1), O)


# ---------------------------------------------------------------- 지하철 출구 번호 기둥(1×2)
def ellipse_plate(a, cx, cy, rx, ry, top, back, rim, thick=2):
    """위에서 본 타원 판: 윗면(뒤쪽 밝게) + 앞 두께 띠(rim) + 윤곽. 반환 = 판 아래 첫 행."""
    H = a.shape[0]
    for y in range(H):
        for x in range(a.shape[1]):
            dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            d = dx * dx + dy * dy
            dy2 = (y + .5 - cy - thick) / ry
            d2 = dx * dx + dy2 * dy2
            if d <= 1:
                put(a, x, y, back if dy < -0.35 and dx < 0.3 else top if dx < 0.45 else rim)
            elif d2 <= 1 and y + .5 > cy:
                put(a, x, y, INK[2] if dx > 0.5 else rim)
    # 윤곽
    m = a[..., 3] > 0
    reg = np.zeros_like(m)
    for y in range(H):
        for x in range(a.shape[1]):
            dx = (x + .5 - cx) / rx
            for t in (0, thick):
                dy = (y + .5 - cy - t) / ry
                if dx * dx + dy * dy <= 1.0: reg[y, x] = True
    for y in range(H):
        for x in range(a.shape[1]):
            if reg[y, x] and any(not (0 <= y + v < H and 0 <= x + u < a.shape[1]) or not reg[y + v, x + u]
                                 for u, v in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(a, x, y, O)
    return int(cy + ry + thick) + 1


def subway_exit(n):
    """지하철 출구 기둥 3/4 (r13 = r7 구성, Argon r9 지적 고침: 받침 밖 허공에 칠한 그늘 제거·몸통 9칸으로 넓혀 갓 비율 줄임·숫자 4×6 획 정리) — 몸통보다 양옆 4칸 넓은 타원 갓: 위에서 본 윗판(뒤쪽 밝게, 좌상 빛)과 앞 두께 3줄(청록 노선 띠,
    오른쪽 끝 그늘)·처마 그늘. 가는 몸통에 노란 번호판, 땅에는 윗면이 앞 모서리보다 밝은 타원 받침(Argon r6: 받침 명암 역전·갓 앞 두께 1줄)."""
    a = canvas(16, 32)
    x0, x1 = 3, 10                                            # r18: 몸통 7칸(Argon r17: 갓 15칸이 자판기보다 넓어 버섯·나사 머리로 읽혔다) — 갓 13칸, 6칸 튀어나옴
    # 받침 먼저(몸통이 위를 덮는다): 윗면 SLATE 4(뒤)·3(앞), 앞 두께 SLATE 1, 윤곽.
    b = canvas(16, 32); ellipse_plate(b, 7.0, 27.6, 6.2, 2.3, SLATE[3], SLATE[4], SLATE[1], thick=1)
    m = b[..., 3] > 0; a[m] = b[m]
    for y in range(10, 27):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            if y < 21: c = AMBER[4] if x == x0 + 1 else AMBER[3] if x == x0 + 2 else AMBER[2] if x < x1 - 1 else AMBER[1]
            else: c = SLATE[4] if x == x0 + 1 else SLATE[3] if x == x0 + 2 else SLATE[2] if x < x1 - 1 else SLATE[1]
            put(a, x, y, c)
    for x in range(x0 + 1, x1): put(a, x, 21, O)
    stamp(a, digit_mask(n), 5, 13, INK[1])   # 몸통 안 6칸에 숫자 4칸 — 양옆 1칸 여백(Argon r17: «3» 이 윤곽에 붙어 «B» 로 읽혔다)
    for y in range(22, 29):                                   # 몸통 오른쪽 그늘이 받침 윗면에 진다(받침 윗면 칸에만)
        if a[y, x1 + 1, 3] and tuple(a[y, x1 + 1, :3]) in (tuple(SLATE[3]), tuple(SLATE[4])): put(a, x1 + 1, y, SLATE[2])
    # 갓: 위에서 본 타원 윗판(뒤 WHITE 2·앞 WHITE 1) + 곧은 옆면 3줄(청록 띠, 오른쪽 끝 그늘) + 평평한 아래 윤곽 — 기둥 축(x=7)에 맞춘 원판.
    # Argon r14: 두 타원을 겹친 갓은 y=5 에서 허리가 잘록해 «구름 두 덩이»로 읽혔고, 표지 고리는 축에서 반 칸 밀렸고, 아래 윤곽이 목에 홈을 냈다.
    # 관문 r15: 아래가 평평하게 끝난 갓은 «타원 판»이 아니다(위아래 둥글림 false) — 곧은 옆면 아래를 낮은 반타원으로 다시 오므린다(렌즈형 원판, 허리 잘록 없음).
    cx, rx, ry, top_y, rim, ry2 = 7.0, 7.0, 4.8, 0, 1, 3.0
    cy = top_y + ry
    reg = np.zeros((32, 16), bool)
    for y in range(top_y, 12):
        for x in range(16):
            dx = (x + .5 - cx) / rx
            if y + .5 <= cy:
                dy = (y + .5 - cy) / ry
                inside = dx * dx + dy * dy <= 1
            elif y + .5 <= cy + rim:
                inside = abs(dx) <= 1                          # 곧은 옆면
            else:
                dy = (y + .5 - cy - rim) / ry2
                inside = dx * dx + dy * dy <= 1                # 아래 둥글림
            reg[y, x] = inside
    yb = max(y for y in range(32) if reg[y].any())            # 갓 아래 윤곽 줄
    for y in range(32):
        for x in range(16):
            if not reg[y, x]: continue
            dx = (x + .5 - cx) / rx
            edge = any(not (0 <= y + v < 32 and 0 <= x + u < 16) or not reg[y + v, x + u] for u, v in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge: put(a, x, y, O)
            elif y + .5 <= cy + 0.6: put(a, x, y, WHITE[2] if (y + .5 < cy - 0.8 and dx < 0.3) else WHITE[1] if dx < 0.5 else SLATE[4])
            else: put(a, x, y, TEAL[4] if dx < -0.6 else TEAL[3] if dx < 0.5 else TEAL[1])
    for x in range(x0 + 1, x1): put(a, x, yb + 1, INK[2])    # 처마 그늘(목 전체 한 줄, 홈 없음)
    put(a, x0, yb + 1, O); put(a, x1, yb + 1, O)
    for y in range(yb + 2, 10):                               # 처마 밑 목: 몸통 색으로 이어 붙인다
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1): put(a, x, y, INK[2] if y == yb + 2 else AMBER[1] if x >= x1 - 1 else AMBER[2])   # r18: 처마 그늘 줄은 오른쪽 끝까지 한 색(Argon r17: (10,10) 노란 화소가 그늘을 깎았다)
    # 받침 앞 두께·윗면에 좌상 빛 명암(Argon r11: 받침 앞줄이 한 색으로 평평했다)
    for y in range(24, 31):
        for x in range(16):
            c = tuple(a[y, x, :3]) if a[y, x, 3] else None
            if c == tuple(SLATE[1]): put(a, x, y, SLATE[2] if x < 6 else SLATE[1] if x < 11 else SLATE[0])
            elif c == tuple(SLATE[3]) and x >= 10: put(a, x, y, SLATE[2])
            elif c == tuple(SLATE[3]) and x <= 4: put(a, x, y, SLATE[4])        # r18: 받침 윗면 왼쪽 빛(Argon r17: 받침이 한 색으로 평평)
    if not a[31, :, 3].any():                                 # 발밑을 칸 바닥(y=31)에 — 기준 조각처럼 땅에 붙인다(Argon r14: 1칸 떠 있었다)
        a[1:] = a[:-1].copy(); a[0] = 0
    return a


# ---------------------------------------------------------------- 세로 간판 기둥(1×2) — 한국 거리 입간판
SIGNS = [
    # id 꼬리, 글자 두 개, 바탕 램프, 글자 색
    ('kr-sign-cafe', '카페', BRICK, WHITE[2]),
    ('kr-sign-conv', '편의', BLUE, WHITE[2]),
    ('kr-sign-food', '국밥', (WINE[1], WINE[2], AZALEA[0], AZALEA[1]), AMBER[4]),   # r18: WINE 바닥(#2d010f)은 윤곽보다 어두워 옆면이 먹칠됐다(Argon r17)
    ('kr-sign-pharm', '약국', LEAF, WHITE[2]),
]


def vertical_sign(chars, ramp, ink):
    """세로 상자형 입간판 3/4 (r16) — 자판기 기준 조각(ref-3)과 같은 상자 구성으로 다시 짰다.
    관문 r15: 옆면 1줄·평평한 덮개는 «정면 입면»(4판 중 3~4)으로 읽혔다. 그래서 오른쪽 옆면을 2줄(밝은 줄·짙은 줄)로 넓혀 위끝부터 발밑까지 잇고,
    덮개 윗면은 4줄(뒤 밝게·좌상 둥근 귀)에 옆면 모서리까지 꺾여 들어가게 했다. 앞면은 간판 색 한 면, 글자 양옆 바탕 1칸(빛줄 없음 — Argon r11: 글자가 빛줄에 붙음).
    발밑 받침은 앞면보다 한 칸 넓은 판(윗면 한 줄)."""
    a = canvas(16, 32)
    dark, mid = ramp[0], ramp[1] if len(ramp) > 1 else ramp[0]
    side_hi = ramp[0]
    top = ramp[-1]
    side_lo = tuple(int(c * 0.62) for c in ramp[0][:3])
    fx0, fx1 = 1, 11                                          # 앞면 칸(글자 9칸 + 양옆 1칸)
    s0, s1 = 12, 13                                           # 옆면 2줄
    # 덮개 윗면: 0 = 윤곽, 1..4 = 윗면, 5 = 앞 모서리 윤곽
    for x in range(2, 12): put(a, x, 0, O)
    put(a, 1, 1, O); put(a, 12, 1, O)
    for x in range(2, 12): put(a, x, 1, WHITE[2])
    for y in (2, 3, 4):
        put(a, 0, y, O)
        for x in range(1, 12): put(a, x, y, WHITE[2] if y == 2 and x < 8 else WHITE[1] if y < 4 else SLATE[4])
        put(a, 12, y, SLATE[3]); put(a, 13, y, SLATE[2] if y > 2 else O)
        put(a, 14 if y > 2 else 13, y, O)
    put(a, 1, 2, WHITE[2])
    for x in range(0, 12): put(a, x, 5, O)                     # 윗면 앞 모서리(앞면과 갈린다)
    for y in range(5, 30):                                    # 옆면 2줄(밝은 줄·짙은 줄)이 위끝부터 발밑까지
        put(a, s0, y, side_hi); put(a, s1, y, side_lo); put(a, 14, y, O)
    # 앞면 = 안에서 불이 켜진 간판 상자(관문 r16 화풍: 「몸이 거의 한 색, 명암 3단」). 칸마다 위가 밝고 아래로 어두워지는 빛,
    # 1칸 틀(왼쪽·위 밝게, 오른쪽·아래 어둡게), 글자 아래 한 화소 그림자로 5단 명암을 낸다.
    hi = top
    face = [mix(mid, top, 0.38), mix(mid, top, 0.18), mid, mix(mid, dark, 0.2), mix(mid, dark, 0.38)]   # 글자(밝은 색)와 대비를 지키게 바탕은 mid 둘레에서만 움직인다
    frame_lo = mix(mid, dark, 0.55)
    for y in range(6, 30):
        put(a, 0, y, O)
        for x in range(fx0, fx1 + 1): put(a, x, y, mid)
    for (y0, y1) in ((6, 17), (19, 29)):
        for y in range(y0 + 1, y1):
            k = min(4, (y - y0 - 1) * 5 // max(1, y1 - y0 - 1))
            for x in range(fx0 + 1, fx1): put(a, x, y, face[k])
        for x in range(fx0, fx1 + 1): put(a, x, y0, hi if x < fx1 else frame_lo); put(a, x, y1, frame_lo)
        for y in range(y0, y1 + 1): put(a, fx0, y, hi if y < y1 else frame_lo); put(a, fx1, y, frame_lo)
    for x in range(fx0, fx1 + 1): put(a, x, 18, dark)          # 두 칸 사이 띠
    glyph_shade = mix(mid, dark, 0.8)
    for i, ch in enumerate(chars):
        stamp(a, hangul_mask(ch), fx0 + 1, 8 if i == 0 else 20, ink, shade=glyph_shade)   # 글자 8..16 · 띠 18 · 글자 20..28
    for x in range(fx0, fx1 + 1): put(a, x, 29, dark)          # 앞면 아래 모서리 그늘
    for y in range(6, 30, 4): put(a, s0, y, mix(side_hi, top, 0.35))   # 옆면 이음매(금속 상자 결)
    for x in range(1, 14): put(a, x, 30, SLATE[4] if x < 6 else SLATE[3] if x < 12 else SLATE[2])   # 받침 윗면
    put(a, 0, 30, O); put(a, 14, 30, O)
    for x in range(0, 15): put(a, x, 31, O)
    return a


# ---------------------------------------------------------------- 가로수 보호판(1×1, 바닥)
def tree_grate():
    """보도에 박힌 정사각 주철 가로수 보호판(r18) — 닫힌 잉크 윤곽, 좌상 턱 밝게·우하 턱 어둡게(좌상 빛, Argon r17: 우하가 밝아 빛이 뒤집혀 보였다).
    무늬는 흙 구멍을 두른 2×2 물빠짐 구멍 여덟(3칸 간격, 서로·흙 테와 한 칸 이상 떨어져 귀에서도 안 닿는다 — r17: 변과 나란한 슬롯이 귀에서 맞닿아
    겹사각형으로 읽혔다). 구멍마다 위·왼 안벽은 잉크, 아래·오른 안벽은 철 그늘. 가운데 흙 구멍은 철 테 + 위·왼 그늘 + 흩뿌린 알갱이(대각선 줄 없음)."""
    a = canvas(16, 16)
    iron, iron_hi, iron_lo, iron_dk = SLATE[2], SLATE[3], SLATE[1], SLATE[0]
    for y in range(16):
        for x in range(16): put(a, x, y, iron)
    for t in range(16):
        put(a, t, 0, O); put(a, 0, t, O); put(a, t, 15, O); put(a, 15, t, O)
    for t in range(1, 15):
        put(a, t, 1, iron_hi); put(a, 1, t, iron_hi)
        put(a, t, 14, iron_lo); put(a, 14, t, iron_lo)
    put(a, 14, 1, iron); put(a, 1, 14, iron)
    holes = [(x, y) for x in (2, 7, 12) for y in (2, 7, 12) if (x, y) != (7, 7)]
    for (x, y) in holes:
        put(a, x, y, O); put(a, x + 1, y, O); put(a, x, y + 1, O); put(a, x + 1, y + 1, iron_dk)
    soil, soil_hi, soil_lo = (0x8a, 0x6a, 0x47), (0xa8, 0x86, 0x5c), (0x5a, 0x45, 0x31)
    for y in range(5, 11):
        for x in range(5, 11):
            if x in (5, 10) or y in (5, 10): put(a, x, y, iron_dk)
    for t in range(5, 11): put(a, t, 10, iron_hi); put(a, 10, t, iron_hi)     # 테 아래·오른 = 빛을 받은 안벽
    put(a, 5, 10, iron_dk); put(a, 10, 5, iron_dk)
    for y in range(6, 10):
        for x in range(6, 10): put(a, x, y, soil)
    for x in range(6, 10): put(a, x, 6, soil_lo)
    for y in range(6, 10): put(a, 6, y, soil_lo)
    for (x, y) in ((8, 7), (7, 9), (9, 8)): put(a, x, y, soil_hi)
    return a


PIECES = [
    ('mc-prop-kr-exit-1', '지하철 출구 번호 표지 1', 'column', 1, 2, lambda: subway_exit(1)),
    ('mc-prop-kr-exit-2', '지하철 출구 번호 표지 2', 'column', 1, 2, lambda: subway_exit(2)),
    ('mc-prop-kr-exit-3', '지하철 출구 번호 표지 3', 'column', 1, 2, lambda: subway_exit(3)),
    ('mc-prop-kr-exit-4', '지하철 출구 번호 표지 4', 'column', 1, 2, lambda: subway_exit(4)),
    *[(f'mc-prop-{sid}', f'세로 입간판 「{t}」', 'other', 1, 2, (lambda t=t, r=r, i=i: vertical_sign(t, r, i))) for sid, t, r, i in SIGNS],
    ('mc-prop-kr-tree-grate', '가로수 보호판(주철)', 'flat', 1, 1, tree_grate),
]


def piece_images():
    return [(pid, ko, kind, w, h, Image.fromarray(fn(), 'RGBA')) for pid, ko, kind, w, h, fn in PIECES]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kr-art.png'
    ims = piece_images(); S = 6
    W = sum(im.width * S + 16 for *_r, im in ims) + 16
    sheet = Image.new('RGBA', (W, 32 * S + 32), (72, 78, 86, 255))
    x = 16
    for *_r, im in ims: sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 16)); x += im.width * S + 16
    sheet.save(out); print(out, sheet.size)
