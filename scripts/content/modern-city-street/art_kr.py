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
    im = Image.new('L', (16, 16), 0); ImageDraw.Draw(im).text((1, 0), text, font=font(), fill=255)
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
    """지하철 출구 기둥 3/4 — 몸통보다 훨씬 넓은 타원 갓(위에서 본 윗판·앞 두께·처마 그늘), 가는 몸통의 청록 띠·노란 번호판, 땅의 타원 받침."""
    a = canvas(16, 32)
    x0, x1 = 4, 11
    # 몸통 먼저(갓이 위를 덮는다)
    for y in range(9, 27):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            if y < 12: c = TEAL[4] if x == x0 + 1 else TEAL[3] if x < x1 - 2 else TEAL[2] if x < x1 - 1 else TEAL[1]
            elif y < 21: c = AMBER[3] if x == x0 + 1 else AMBER[2] if x == x0 + 2 else AMBER[1] if x < x1 - 1 else AMBER[0]
            else: c = SLATE[4] if x == x0 + 1 else SLATE[3] if x == x0 + 2 else SLATE[2] if x < x1 - 1 else SLATE[1]
            put(a, x, y, c)
    for x in range(x0 + 1, x1): put(a, x, 21, O)
    stamp(a, digit_mask(n), 6, 14, INK[1])
    # 받침(타원 판)
    b = canvas(16, 32); ellipse_plate(b, 8, 27.5, 7.5, 2.6, SLATE[3], SLATE[4], SLATE[1], thick=1)
    m = b[..., 3] > 0; a[m] = b[m]
    for x in range(x0, x1 + 1): put(a, x, 26, O)
    for x in range(x0 + 1, x1): put(a, x, 27, SHADOW[:3] and SLATE[1])
    # 갓(타원 판, 몸통보다 양옆 4칸씩 넓다)
    g = canvas(16, 32); yb = ellipse_plate(g, 8, 4.5, 8, 4.4, WHITE[1], WHITE[2], SLATE[3], thick=2)
    m = g[..., 3] > 0; a[m] = g[m]
    for (x, y) in ((7, 3), (8, 3), (6, 4), (9, 4), (7, 5), (8, 5)): put(a, x, y, TEAL[3])
    for x in range(x0 + 1, x1): put(a, x, yb, INK[2])   # 처마 그늘
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
    """원통형 회전 입간판 3/4: 위에서 본 타원 윗판(조명 덮개)·앞 두께·처마 그늘, 둥글게 감기는 몸통(글자 두 자), 타원 받침."""
    a = canvas(16, 32)
    x0, x1 = 1, 14
    dark, mid = ramp[0], ramp[1] if len(ramp) > 1 else ramp[0]
    lite = ramp[2] if len(ramp) > 2 else ramp[-1]
    for y in range(6, 28):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1):
            put(a, x, y, ramp[-1] if x == x0 + 1 else lite if x <= x0 + 3 else mid if x < x1 - 2 else dark)
    b = canvas(16, 32); ellipse_plate(b, 8, 29.0, 7.0, 1.9, mid, lite, dark, thick=1)
    m = b[..., 3] > 0; a[m] = b[m]
    for i, ch in enumerate(chars):
        mk = glyph_mask(ch); h, w = mk.shape
        stamp(a, mk, x0 + 1 + (x1 - x0 - 1 - w) // 2, 11 + i * 8, ink, shade=dark)
    g = canvas(16, 32); yb = ellipse_plate(g, 8, 3.6, 8, 3.5, SLATE[3], SLATE[4], SLATE[1], thick=2)
    m = g[..., 3] > 0; a[m] = g[m]
    for y in range(2, 5):
        for x in range(5, 11):
            if (x - 7.5) ** 2 / 9 + (y - 3.2) ** 2 / 2 <= 1: put(a, x, y, WHITE[1])
    for x in range(x0 + 1, x1): put(a, x, yb, dark)
    return a


# ---------------------------------------------------------------- 가로수 보호판(1×1, 바닥)
def tree_grate():
    """보도에 박힌 정사각 주철 보호판 — 가운데 둥근 구멍(흙)·방사형 살. 바닥 그림(flat)."""
    a = canvas(16, 16)
    for y in range(16):
        for x in range(16):
            edge = x in (0, 15) or y in (0, 15)
            put(a, x, y, INK[2] if edge else BODY[1] if (x + y) % 4 == 0 else BODY[0])
    # 살(가는 밝은 줄) — 좌상 빛
    for k in range(2, 14, 3):
        for t in range(1, 15):
            if abs(t - 7.5) > 2.6: put(a, k, t, BODY[3]); put(a, t, k, BODY[3])
    # 가운데 흙 구멍
    for y in range(16):
        for x in range(16):
            d = (x - 7.5) ** 2 + (y - 7.5) ** 2
            if d < 9: put(a, x, y, (0x4a, 0x38, 0x28) if (x + y) % 3 else (0x65, 0x4c, 0x39))
            elif d < 13: put(a, x, y, O)
    # 테두리 빛
    for t in range(1, 15): put(a, t, 1, BODY[4]); put(a, 1, t, BODY[4])
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
