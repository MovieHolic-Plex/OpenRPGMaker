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


# 손으로 찍은 4×6 굵은 숫자(번호판용) — 글꼴 숫자는 판(7줄)보다 커서 넘쳤다.
DIGITS = {
    1: [".##.", "###.", ".##.", ".##.", ".##.", "####"],
    2: ["###.", "...#", "..##", ".##.", "##..", "####"],
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
    """지하철 출구 기둥 3/4 (r7) — 몸통보다 양옆 4칸 넓은 타원 갓: 위에서 본 윗판(뒤쪽 밝게, 좌상 빛)과 앞 두께 3줄(청록 노선 띠,
    오른쪽 끝 그늘)·처마 그늘. 가는 몸통에 노란 번호판, 땅에는 윗면이 앞 모서리보다 밝은 타원 받침(Argon r6: 받침 명암 역전·갓 앞 두께 1줄)."""
    a = canvas(16, 32)
    x0, x1 = 4, 11
    # 받침 먼저(몸통이 위를 덮는다): 윗면 SLATE 4(뒤)·3(앞), 앞 두께 SLATE 1, 윤곽.
    b = canvas(16, 32); ellipse_plate(b, 8, 27.4, 7.5, 2.5, SLATE[3], SLATE[4], SLATE[1], thick=1)
    m = b[..., 3] > 0; a[m] = b[m]
    for y in range(10, 28):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            if y < 21: c = AMBER[4] if x == x0 + 1 else AMBER[3] if x == x0 + 2 else AMBER[2] if x < x1 - 1 else AMBER[1]
            else: c = SLATE[4] if x == x0 + 1 else SLATE[3] if x == x0 + 2 else SLATE[2] if x < x1 - 1 else SLATE[1]
            put(a, x, y, c)
    for x in range(x0 + 1, x1): put(a, x, 21, O)
    stamp(a, digit_mask(n), 6, 13, INK[1])
    for y in range(22, 28): put(a, x1 + 1, y, SLATE[2])      # 몸통 오른쪽 그늘이 받침 윗면에 진다
    # 갓: 윗판(뒤 WHITE 2·앞 WHITE 1) + 앞 두께 3줄(청록)
    g = canvas(16, 32); yb = ellipse_plate(g, 8, 3.9, 8, 3.7, WHITE[1], WHITE[2], TEAL[3], thick=3)
    m = g[..., 3] > 0; a[m] = g[m]
    for (x, y) in ((7, 2), (8, 2), (6, 3), (9, 3), (7, 4), (8, 4)): put(a, x, y, TEAL[2])   # 윗판의 지하철 표지
    for y in range(5, yb):
        for x in range(10, 16):
            if a[y, x, 3] and tuple(a[y, x, :3]) == TEAL[3]: put(a, x, y, TEAL[1])
    for x in range(x0 + 1, x1): put(a, x, yb, INK[2])        # 처마 그늘
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
    """세로 상자형 입간판 3/4 (r10) — 위에서 본 윗면 6줄(뒤쪽 밝게, 좌상 빛, ttop)·앞면(간판 색, 오른쪽 두 줄 그늘)·낮은 받침판.
    원통+타원 갓(r9)은 관문이 「정면 입면」으로 읽었다 — 자판기·입간판 기준 조각처럼 상자 윗면을 면으로 보인다.
    글자는 한 자에 한 칸(9줄), 칸 사이는 바탕 틈 1줄 + 어두운 띠 1줄 + 틈 1줄(Argon r5: 두 자가 붙어 1배에서 안 읽힘)."""
    a = canvas(16, 32)
    x0, x1 = 1, 14
    dark, mid = ramp[0], ramp[1] if len(ramp) > 1 else ramp[0]
    lite = ramp[2] if len(ramp) > 2 else ramp[-1]
    top = ramp[-1]
    fy = ttop(a, x0, x1, 0, 6, lite, top, mid)               # 윗면 0..5(뒤 두 줄 밝게, 앞 모서리 mid), 6 = 윤곽, 앞면 7 부터
    for x in range(x0 + 3, x0 + 7): put(a, x, 1, WHITE[2])    # 윗면 좌상 하이라이트
    for x in range(x0 + 4, x1 - 3): put(a, x, 3, top)         # 윗면 가운데 조명 덮개 결
    for y in range(fy, 30):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            put(a, x, y, lite if x == x0 + 1 else mid if x < x1 - 2 else dark)
    for x in range(x0 + 1, x1): put(a, x, 29, dark)           # 앞면 아래 모서리 그늘
    for x in range(x0 + 2, x1 - 2): put(a, x, 18, dark)       # 두 칸 사이 띠(위아래 한 줄 바탕 틈)
    for i, ch in enumerate(chars):
        mk = glyph_mask(ch); h, w = mk.shape
        gy = (8 if i == 0 else 20) + (9 - h) // 2
        stamp(a, mk, x0 + 1 + (x1 - x0 - 3 - w + 1) // 2, gy, ink)
    # 받침판: 윗면 한 줄(좌상 밝게)·윤곽
    for x in range(x0 + 1, x1): put(a, x, 30, SLATE[4] if x < 9 else SLATE[3])
    put(a, x0, 30, O); put(a, x1, 30, O)
    for x in range(x0, x1 + 1): put(a, x, 31, O)
    return a


# ---------------------------------------------------------------- 가로수 보호판(1×1, 바닥)
def tree_grate():
    """보도에 박힌 정사각 주철 보호판(r7, 대비 높임·바깥 잉크 윤곽) — 밝은 테 판(좌상 빛)에 짙은 홈 동심 사각 두 줄, 가운데 흙 구멍과 짙은 테. 바닥 그림(flat)."""
    a = canvas(16, 16)
    for y in range(16):
        for x in range(16):
            put(a, x, y, BODY[3])
    for t in range(16):
        put(a, t, 0, O); put(a, 0, t, O); put(a, t, 15, O); put(a, 15, t, O)              # 바깥 잉크 윤곽
    for t in range(1, 15):
        put(a, t, 1, BODY[5]); put(a, 1, t, BODY[5]); put(a, t, 14, BODY[0]); put(a, 14, t, BODY[0])
    for t in range(2, 14):
        put(a, t, 2, BODY[4]); put(a, 2, t, BODY[4]); put(a, t, 13, BODY[1]); put(a, 13, t, BODY[1])
    # 홈: 동심 사각 두 줄(짙게) — 홈 아래·오른쪽 한 줄은 밝은 결(빛 받는 턱)
    for k in (3, 5):
        for t in range(k, 16 - k):
            for (x, y) in ((t, k), (k, t), (t, 15 - k), (15 - k, t)): put(a, x, y, INK[2])
        for t in range(k + 1, 15 - k):
            put(a, t, k + 1, BODY[5])                         # 홈 아래 밝은 턱(오른쪽 홈은 끊지 않는다)
    # 흙 구멍 + 짙은 테
    for y in range(16):
        for x in range(16):
            d = (x - 7.5) ** 2 + (y - 7.5) ** 2
            if d < 5.5: put(a, x, y, (0x5a, 0x45, 0x31) if (x * 3 + y) % 4 else (0x72, 0x58, 0x3f))
            elif d < 9: put(a, x, y, INK[1])
    for (x, y) in ((6, 6), (7, 6)): put(a, x, y, (0x86, 0x6a, 0x4c))
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
