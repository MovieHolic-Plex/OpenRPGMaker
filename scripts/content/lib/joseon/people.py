"""Actor1 캐릭터를 조선 데모 지도 위에 올려 눈으로 확인한다(사용자: 「actor1 에 있는 캐릭터 올려서 확인해」).
시트·칩셋에는 들어가지 않는다 — 척도(문 높이 32px 대비 사람 키 32px)와 읽힘을 보는 확인용 합성 그림.
Actor1: 4x2 캐릭터 블록, 블록당 72x128 = 3프레임(24px) x 4방향행 [위, 오른쪽, 정면, 왼쪽]. 배경 청록 키."""
import os
import numpy as np
from PIL import Image

SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'public', 'assets', 'easyrpg', 'charset', 'Actor1.png'))
_a = np.array(Image.open(SRC).convert('RGBA'))
_a[(_a[..., :3] == _a[0, 0, :3]).all(axis=2)] = 0
UP, RIGHT, FRONT, LEFT = 0, 1, 2, 3


def frame(char, row, col=1):
    bx, by = (char % 4) * 72, (char // 4) * 128
    return Image.fromarray(_a[by + row * 32: by + row * 32 + 32, bx + col * 24: bx + col * 24 + 24].copy(), 'RGBA')


# (칸 x, 칸 y, 캐릭터 0..7, 방향, 걸음 프레임 0..2) — 발이 칸 아래쪽에 닿는다
PEOPLE = [
    (6, 5, 0, FRONT, 1), (6, 13, 3, RIGHT, 0), (5, 24, 1, FRONT, 2),         # 서쪽 골목
    (13, 12, 2, FRONT, 1), (18, 17, 5, UP, 0), (14, 22, 6, FRONT, 1),        # 양반댁 안·대문
    (14, 24, 4, FRONT, 1), (9, 26, 7, RIGHT, 2), (19, 25, 3, LEFT, 0),       # 대문 앞길·큰길
    (26, 26, 0, RIGHT, 1), (31, 25, 1, RIGHT, 2), (36, 26, 5, LEFT, 0),      # 큰길·다리
    (35, 31, 2, FRONT, 1), (38, 31, 6, FRONT, 1), (46, 31, 7, FRONT, 1),     # 시장
    (38, 18, 4, UP, 0), (39, 21, 3, FRONT, 1), (44, 11, 5, FRONT, 1),        # 누각 길·관아 마당
    (22, 9, 0, FRONT, 1), (8, 27, 2, FRONT, 1),                              # 동쪽 골목·연못 길
    (42, 45, 1, UP, 2), (43, 43, 6, FRONT, 0), (43, 40, 7, UP, 1),           # 성문 안팎
]


def overlay(img, people=PEOPLE, T=16):
    out = img.convert('RGBA')
    for (tx, ty, ch, d, fr) in people:
        sp = frame(ch, d, fr)
        x, y = tx * T + (T - 24) // 2, (ty + 1) * T - 32 + 1
        # 발밑 그림자
        sh = Image.new('RGBA', (14, 5), (0, 0, 0, 0))
        px = sh.load()
        for yy in range(5):
            for xx in range(14):
                if ((xx - 6.5) / 6.5) ** 2 + ((yy - 2) / 2.2) ** 2 <= 1: px[xx, yy] = (12, 17, 16, 90)
        out.alpha_composite(sh, (tx * T + 1, (ty + 1) * T - 4))
        out.alpha_composite(sp, (x, y))
    return out
