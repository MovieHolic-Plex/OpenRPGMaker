#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 — 지형 쌍 경계 키트 시트.

쌍(A 아래, B 위)마다 6개 조각을 같은 렌더러로 찍는다: 직선 띠 2(가로/세로)·볼록 모서리·오목 모서리·계단 대각·1칸 섬+반도.
16px 오토타일 시트가 아니라 '쌍 × 모양'을 픽셀 단위로 그린 견본이다 — 같은 모양도 놓인 위치가 다르면 잡음이 달라 변형이 된다.
  pairkit-v5.png   지도에 실제로 나오는 32쌍 × 6조각
  pairmatrix-v5.png  땅 18종 전체 153쌍 × 계단 1조각
"""
import sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import terrain_v4 as V
import boundary_v5 as B5
from PIL import Image, ImageDraw, ImageFont

FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf', 13)
FONT_S = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf', 11)


class FakeMap:
    def __init__(self, G):
        self.G = G.astype(np.int16)
        self.H, self.W = G.shape
        self.Hh = np.zeros_like(self.G)


# 6x6 칸 조각 안쪽 4x4 에 B 를 놓는 모양(행,열)
def _rect(r0, r1, c0, c1):
    return {(r, c) for r in range(r0, r1) for c in range(c0, c1)}


SHAPES = [
    ('직선 띠(가로)', _rect(2, 4, 0, 4)),
    ('직선 띠(세로)', _rect(0, 4, 1, 3)),
    ('볼록 모서리', _rect(1, 4, 1, 4) - {(1, 1)} | {(1, 1)}),
    ('오목 모서리', _rect(0, 4, 0, 4) - _rect(0, 2, 0, 2)),
    ('계단 대각', {(r, c) for r in range(4) for c in range(4) if c >= 3 - r}),
    ('1칸 섬+반도', {(0, 0), (2, 2), (2, 3), (3, 2), (3, 3), (0, 3)}),
]
SHAPES[2] = ('볼록 모서리', _rect(2, 4, 2, 4))


def kit_map(a, b):
    n = len(SHAPES)
    G = np.full((6, 6 * n), a, np.int16)
    for i, (_, cells) in enumerate(SHAPES):
        for r, c in cells:
            G[1 + r, 6 * i + 1 + c] = b
    return FakeMap(G)


def name(g):
    return V.NAMES[g]


def real_pairs():
    import make_map_v5 as m
    M, _, _ = m.build_v5(cities=False)
    G, H = M.G, M.Hh
    pairs = {}
    for dy, dx in ((0, 1), (1, 0)):
        a = G[:G.shape[0] - dy, :G.shape[1] - dx]
        b = G[dy:, dx:]
        ha = H[:G.shape[0] - dy, :G.shape[1] - dx]
        hb = H[dy:, dx:]
        ok = (a >= 10) & (b >= 10) & (a != b) & (ha == hb)
        for x, y in zip(a[ok], b[ok]):
            k = tuple(sorted((int(x), int(y)), key=lambda g: V.PRI[g]))
            pairs[k] = pairs.get(k, 0) + 1
    return sorted(pairs, key=lambda k: (V.PRI[k[0]], V.PRI[k[1]]))


def build_kit():
    pairs = real_pairs()
    per = 2
    rows = (len(pairs) + per - 1) // per
    cw, ch = 6 * 16 * len(SHAPES), 6 * 16 + 18
    W = cw * per + 8 * (per - 1)
    sheet = Image.new('RGB', (W, rows * ch), (24, 26, 34))
    d = ImageDraw.Draw(sheet)
    for i, (a, b) in enumerate(pairs):
        img = B5.render_ground_v5(kit_map(a, b))
        cx, cy = (i % per) * (cw + 8), (i // per) * ch
        d.text((cx + 2, cy + 1), f'{name(a)}  ←  {name(b)}', font=FONT, fill=(230, 232, 240))
        sheet.paste(Image.fromarray(img), (cx, cy + 18))
    return sheet, pairs


def build_matrix():
    order = sorted(V.NAMES, key=lambda g: V.PRI[g])
    n = len(order)
    cell = 5
    lab = 62
    cw = cell * 16
    sheet = Image.new('RGB', (lab + n * cw, lab + n * cw), (24, 26, 34))
    d = ImageDraw.Draw(sheet)
    stair = {(0, 2), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2)}
    for ri, a in enumerate(order):
        G = np.full((cell, cell * n), a, np.int16)
        for ci, b in enumerate(order):
            if ci <= ri:
                continue
            for r, c in stair:
                G[1 + r, ci * cell + 1 + c] = b
        img = B5.render_ground_v5(FakeMap(G))
        im = Image.fromarray(img)
        # 대각선 아래(ci<=ri)는 어둡게 비운다
        sheet.paste(im, (lab, lab + ri * cw))
        for ci in range(ri + 1):
            d.rectangle([lab + ci * cw, lab + ri * cw, lab + (ci + 1) * cw - 1, lab + (ri + 1) * cw - 1], fill=(24, 26, 34))
        d.text((2, lab + ri * cw + 30), name(a)[:5], font=FONT_S, fill=(230, 232, 240))
    for ci, b in enumerate(order):
        d.text((lab + ci * cw + 2, 24 + (ci % 2) * 14), name(b)[:5], font=FONT_S, fill=(230, 232, 240))
    return sheet, n * (n - 1) // 2


if __name__ == '__main__':
    k, pairs = build_kit()
    k.save(HERE / 'pairkit-v5.png')
    m, cnt = build_matrix()
    m.save(HERE / 'pairmatrix-v5.png')
    print('kit', k.size, len(pairs), 'pairs x', len(SHAPES), '=', len(pairs) * len(SHAPES), '| matrix', m.size, cnt)
