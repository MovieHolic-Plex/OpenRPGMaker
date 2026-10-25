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
ROAD, SLATE, ROOF, MINT, TEAL, BLUE, BRICK, WINE, AMBER, LEAF, BODY, WHITE, INK = (
    _R[k] for k in ('road', 'slate', 'roof', 'mint', 'teal', 'blue', 'brick', 'wine', 'amber', 'leaf', 'body', 'white', 'ink'))
SHADOW = (11, 18, 36, 90)
O = INK[0]


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
    '카': ["#####..#.", "....#..#.", "#####..##", "....#..#.", "....#..#.", "....#..#.", ".......#.", ".......#.", ".......#."],
    '페': ['......#.#', '#####.#.#', '.#.#..#.#', '.#.#..#.#', '.#.#.##.#', '.#.#..#.#', '.#.#..#.#', '#####.#.#', '......#.#'],
    '편': ["#####..#.", ".#.#..##.", ".#.#...#.", ".#.#..##.", "#####..#.", ".........", ".#.......", ".#.......", ".#######."],
    '의': ['.###...#.', '#...#..#.', '#...#..#.', '#...#..#.', '.###...#.', '.......#.', '.......#.', '#####..#.', '.......#.'],
    '국': [".#######.", ".......#.", ".........", "#########", "....#....", ".........", ".#######.", ".......#.", ".......#."],
    '밥': ["#...#..#.", "#...#..##", "#####..#.", "#...#..#.", "#####..#.", ".#.....#.", ".#######.", ".#.....#.", ".#######."],
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


# 손으로 찍은 3×6 숫자(번호판용) — 번호판 안쪽 7칸에서 양옆 빛줄·그늘과 한 칸씩 떨어진다(Argon r11), 꺾임마다 획이 맞닿는다(Argon r9).
DIGITS = {
    1: [".#.", "##.", ".#.", ".#.", ".#.", "###"],
    2: ["###", "..#", "###", "#..", "#..", "###"],
    3: ["###", "..#", "###", "..#", "..#", "###"],
    4: ["#.#", "#.#", "#.#", "###", "..#", "..#"],
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
    x0, x1 = 3, 11
    # 받침 먼저(몸통이 위를 덮는다): 윗면 SLATE 4(뒤)·3(앞), 앞 두께 SLATE 1, 윤곽.
    b = canvas(16, 32); ellipse_plate(b, 7.5, 27.6, 6.6, 2.3, SLATE[3], SLATE[4], SLATE[1], thick=1)
    m = b[..., 3] > 0; a[m] = b[m]
    for y in range(10, 27):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            if y < 21: c = AMBER[4] if x == x0 + 1 else AMBER[3] if x == x0 + 2 else AMBER[2] if x < x1 - 1 else AMBER[1]
            else: c = SLATE[4] if x == x0 + 1 else SLATE[3] if x == x0 + 2 else SLATE[2] if x < x1 - 1 else SLATE[1]
            put(a, x, y, c)
    for x in range(x0 + 1, x1): put(a, x, 21, O)
    stamp(a, digit_mask(n), 6, 13, INK[1])                    # x 6..8: 왼쪽 빛줄(x=4)·오른쪽 그늘(x=10)과 한 칸 이상 떨어진다(Argon r11)
    for y in range(22, 29):                                   # 몸통 오른쪽 그늘이 받침 윗면에 진다(받침 윗면 칸에만)
        if a[y, x1 + 1, 3] and tuple(a[y, x1 + 1, :3]) in (tuple(SLATE[3]), tuple(SLATE[4])): put(a, x1 + 1, y, SLATE[2])
    # 갓: 윗판(뒤 WHITE 2·앞 WHITE 1) + 앞 두께 3줄(청록)
    g = canvas(16, 32); yb = ellipse_plate(g, 7.5, 3.9, 7.2, 3.7, WHITE[1], WHITE[2], TEAL[3], thick=3)
    m = g[..., 3] > 0; a[m] = g[m]
    for (x, y) in ((7, 2), (8, 2), (6, 3), (9, 3), (7, 4), (8, 4)): put(a, x, y, TEAL[2])   # 윗판의 지하철 표지
    for y in range(5, yb):
        for x in range(10, 16):
            if a[y, x, 3] and tuple(a[y, x, :3]) == TEAL[3]: put(a, x, y, TEAL[1])
    for x in range(x0 + 1, x1):                               # 처마 그늘 — 갓 윤곽과 몸통 사이에 남은 몸통 칸까지 덮는다
        for y in range(yb - 2, yb + 1):
            if a[y, x, 3] and tuple(a[y, x, :3]) in [tuple(c) for c in AMBER]: put(a, x, y, INK[2])
        put(a, x, yb, INK[2])
    # 받침 앞 두께·윗면에 좌상 빛 명암(Argon r11: 받침 앞줄이 한 색으로 평평했다)
    for y in range(24, 31):
        for x in range(16):
            c = tuple(a[y, x, :3]) if a[y, x, 3] else None
            if c == tuple(SLATE[1]): put(a, x, y, SLATE[2] if x < 6 else SLATE[1] if x < 11 else SLATE[0])
            elif c == tuple(SLATE[3]) and x >= 12: put(a, x, y, SLATE[2])
    return a


# ---------------------------------------------------------------- 세로 간판 기둥(1×2) — 한국 거리 입간판
SIGNS = [
    # id 꼬리, 글자 두 개, 바탕 램프, 글자 색
    ('kr-sign-cafe', '카페', BRICK, WHITE[2]),
    ('kr-sign-conv', '편의', BLUE, WHITE[2]),
    ('kr-sign-food', '국밥', WINE, AMBER[4]),
    ('kr-sign-pharm', '약국', LEAF, WHITE[2]),
]


def vertical_sign(chars, ramp, ink):
    """세로 상자형 입간판 3/4 (r14) — 자판기 기준 조각과 같은 상자 구성: 위에서 본 금속 덮개 윗면 5줄(뒤 밝게, 좌상 빛)·앞면(간판 색, 왼쪽 빛)·
    오른쪽 옆면 1줄(짙게, 윗면 오른쪽 끝도 옆면 색)·받침. r11 은 옆면 없는 납작한 판이라 «정면 입면»으로 읽혔다(관문).
    글자는 손 한글 9×9, 칸 사이는 바탕 틈 + 띠 + 틈(Argon r5: 두 자가 붙어 1배에서 안 읽힘)."""
    a = canvas(16, 32)
    x0, x1 = 0, 14                                            # 글자(9칸) 양옆에 바탕 한 칸씩(Argon r11: 글자가 빛줄·옆면에 0칸으로 붙음)
    sx = x1 - 1                                               # 옆면 1줄(sx), 앞면 x0+1..sx-1
    dark, mid = ramp[0], ramp[1] if len(ramp) > 1 else ramp[0]
    lite = ramp[2] if len(ramp) > 2 else ramp[-1]
    top = ramp[-1]
    # 윗면 = 밝은 금속 덮개(뒤 WHITE 2·앞 WHITE 1·앞 모서리 SLATE 4) — 앞면 간판 색과 분명히 갈라진다(r12: 같은 색 계열이라 «윗면 2행»으로 셌다, 관문).
    fy = ttop(a, x0, x1, 0, 6, WHITE[1], WHITE[2], SLATE[4])   # 윗면 0..5, 6 = 윤곽, 앞면 7 부터
    for y in range(1, 6):
        for x in range(sx - 1, x1):
            if a[y, x, 3] and tuple(a[y, x, :3]) != tuple(O[:3]): put(a, x, y, SLATE[3])   # 윗면 오른쪽 끝 = 그늘
    for x in range(x0 + 4, x1 - 4): put(a, x, 3, top)         # 덮개 위 간판 색 한 줄(어느 가게인지 위에서도 보인다)
    for y in range(fy, 30):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, sx): put(a, x, y, mid)
        put(a, sx, y, dark)                                   # 옆면
    for y in range(fy, 30): put(a, x0 + 1, y, lite)           # 앞면 왼쪽 빛
    px0, px1 = x0 + 1, sx - 1
    for x in range(px0 + 1, px1 + 1): put(a, x, 18, dark)     # 두 칸 사이 띠
    for i, ch in enumerate(chars):
        stamp(a, hangul_mask(ch), px0 + 2, 8 if i == 0 else 20, ink)   # 글자 8..16 · 틈 17 · 띠 18 · 틈 19 · 글자 20..28
    for x in range(x0 + 1, x1): put(a, x, 29, dark if x < sx else INK[2])   # 앞면 아래 모서리 그늘
    # 받침판: 윗면 한 줄(좌상 밝게)·윤곽
    for x in range(x0 + 1, x1): put(a, x, 30, SLATE[4] if x < 8 else SLATE[3])
    put(a, x0, 30, O); put(a, x1, 30, O)
    for x in range(x0, x1 + 1): put(a, x, 31, O)
    return a


# ---------------------------------------------------------------- 가로수 보호판(1×1, 바닥)
def tree_grate():
    """보도에 박힌 정사각 주철 가로수 보호판(r12) — 닫힌 잉크 윤곽, 1칸 고른 테(좌상 그늘·우하 빛 = 박힌 판), 동심 사각 슬롯 두 줄(네 귀는 막아 대각선으로 안 닿는다),
    가운데 흙 구멍은 짙은 잉크 테 + 철판보다 밝은 흙(Argon r11: 열린 우하 윤곽·흙과 철판 휘도 같음·테 2/1칸 치우침·슬롯 귀 대각선 붙음)."""
    a = canvas(16, 16)
    iron, iron_hi, iron_lo = SLATE[1], SLATE[2], SLATE[0]
    for y in range(16):
        for x in range(16): put(a, x, y, iron)
    for t in range(16):
        put(a, t, 0, O); put(a, 0, t, O); put(a, t, 15, O); put(a, 15, t, O)    # 닫힌 잉크 윤곽
    for t in range(1, 15):
        put(a, t, 1, iron_lo); put(a, 1, t, iron_lo)                           # 위·왼쪽 안 턱 = 그늘(박힌 판)
        put(a, t, 14, SLATE[3]); put(a, 14, t, SLATE[3])                       # 아래·오른쪽 안 턱 = 빛
    put(a, 1, 14, iron); put(a, 14, 1, iron)
    # 슬롯: 바깥 고리(k=3) 변마다 짧은 구멍 두 개(귀와 가운데는 살), 구멍 아래·오른쪽 턱은 빛.
    for (a0, a1) in ((4, 6), (9, 11)):
        for t in range(a0, a1 + 1):
            for (x, y) in ((t, 3), (t, 12), (3, t), (12, t)): put(a, x, y, O)
            for (x, y) in ((t, 13), (13, t)): put(a, x, y, iron_hi)      # 아래·오른쪽 고리 구멍의 바깥 턱 = 빛
    # 흙 구멍(6..9) + 잉크 테(5..10 고리는 k=5 슬롯이 맡는다) — 흙은 철판보다 분명히 밝게
    soil, soil_hi, soil_lo = (0x8a, 0x6a, 0x47), (0xa8, 0x86, 0x5c), (0x5a, 0x45, 0x31)
    for y in range(6, 10):
        for x in range(6, 10): put(a, x, y, soil if (x * 3 + y) % 4 else soil_hi)
    for x in range(6, 10): put(a, x, 6, soil_lo)                               # 위 턱 그늘
    for y in range(6, 10): put(a, 6, y, soil_lo)
    for y in range(5, 11):
        for x in range(5, 11):
            if (x in (5, 10) or y in (5, 10)): put(a, x, y, O)                 # 흙 구멍 잉크 테(닫힘)
    for t in range(5, 11): put(a, t, 11, iron_hi); put(a, 11, t, iron_hi)     # 테 아래·오른쪽 턱 = 빛
    put(a, 11, 11, iron_hi)
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
