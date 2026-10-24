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


# ---------------------------------------------------------------- 지하철 출구 번호 기둥(1×2)
def subway_exit(n):
    """한국 지하철 출구 표지 기둥 — 네모 기둥(상자) 3/4: 윗면 6줄(밝은 뚜껑, 앞 모서리 그늘)·앞면(청록 띠 + 노란 번호판)·몸통·땅 그림자."""
    a = canvas(16, 32)
    x0, x1 = 3, 12
    # 윗면 0..8행: 둥근 모서리 판, 뒤쪽 밝고 앞 모서리 그늘
    ttop(a, x0, x1, 0, 8, WHITE[0], WHITE[2], SLATE[3])
    for y in range(3, 6): put(a, x0 + 3, y, WHITE[1]); put(a, x1 - 3, y, SLATE[4])   # 윗판 위 낮은 테(위에서 본 뚜껑 홈)
    for x in range(x0 + 3, x1 - 2): put(a, x, 2, WHITE[1]); put(a, x, 6, SLATE[4])
    # 앞면: 청록 띠 8..10, 노란 번호판 11..18, 몸통 19..28
    for y in range(9, 29): put(a, x0, y, O); put(a, x1, y, O)
    for y in range(9, 11):
        for x in range(x0 + 1, x1): put(a, x, y, TEAL[4] if x <= x0 + 2 else TEAL[3] if x < x1 - 2 else TEAL[2])
    for x, y in ((7, 9), (8, 9), (6, 10), (9, 10)): put(a, x, y, WHITE[2])
    for y in range(11, 19):
        for x in range(x0 + 1, x1): put(a, x, y, AMBER[3] if x <= x0 + 1 else AMBER[1] if x < x1 - 2 else AMBER[0])
    stamp(a, digit_mask(n), 6, 12, INK[1])
    for x in range(x0 + 1, x1): put(a, x, 19, O)
    for y in range(20, 29):
        for x in range(x0 + 1, x1): put(a, x, y, SLATE[3] if x <= x0 + 1 else SLATE[2] if x < x1 - 2 else SLATE[1])
    for x in range(x0 + 1, x1): put(a, x, 28, SLATE[0])
    for x in range(x0, x1 + 1): put(a, x, 29, O)
    for x in range(x0 + 1, x1 + 3):
        if x < 16: put(a, x, 30, SHADOW)
    for x in range(x1 + 1, min(16, x1 + 3)):
        for y in range(9, 30): put(a, x, y, SHADOW) if y > 20 else None
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
    """세로로 선 상자형 입간판: 윗면(3줄)·앞면(글자 두 자)·작은 받침. 3/4 — 위 뚜껑이 면으로 보인다."""
    a = canvas(16, 32)
    x0, x1 = 1, 14
    dark, mid = ramp[0], ramp[1] if len(ramp) > 1 else ramp[0]
    lite = ramp[2] if len(ramp) > 2 else ramp[-1]
    top = ramp[-1]
    # 윗면 0..6행: 같은 상자의 윗판(바탕 램프 밝은 쪽), 둥근 모서리
    ttop(a, x0, x1, 0, 7, WHITE[0], WHITE[2], BODY[4])
    for x in range(x0 + 3, x1 - 2): put(a, x, 3, top); put(a, x, 4, lite)   # 윗판 가운데 색 띠(위에서 본 간판 머리)
    # 앞면 (8..27행)
    for y in range(8, 28):
        put(a, x0, y, O); put(a, x1, y, O)
        for x in range(x0 + 1, x1): put(a, x, y, lite if x == x0 + 1 else mid if x < x1 - 1 else dark)
    # 테두리 안쪽 밝은 선(빛 방향) + 글자
    for i, ch in enumerate(chars):
        m = glyph_mask(ch); h, w = m.shape
        stamp(a, m, x0 + 1 + (x1 - x0 - 1 - w) // 2, 9 + i * 10, ink, shade=dark)
    for x in range(x0, x1 + 1): put(a, x, 28, O)
    # 받침(앞면 1줄)
    for x in range(x0 + 1, x1): put(a, x, 29, SLATE[1])
    put(a, x0, 29, O); put(a, x1, 29, O)
    for x in range(x0, x1 + 1): put(a, x, 30, O)
    for x in (x1 + 1, x1 + 2):
        if x < 16: put(a, x, 29, SHADOW); put(a, x, 30, SHADOW)
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
