"""버들항 던전 천장 테두리(47 모양) — 변형 던전 렌더(tiledata/beodeul-variants/_lib3/dlib.py `ceiling`)와 같은 함수로 칸을 만든다.

천장(검은 허공)이 바닥·벽 앞면과 닿는 쪽에 밝은 윗면 띠(BAND 8px, 벽 두께)가 생긴다 — 방이 종이에서 오려 낸 것처럼
보이지 않고 벽 위에 두께가 보인다(3/4 탑뷰). 마스크 = 오토타일 엔진 규약(이웃이 천장이면 비트가 선다: N1 E2 S4 W8 NE16 SE32 SW64 NW128).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, os.path.join(ROOT, 'tiledata/beodeul-variants/_lib3'))
import dlib  # noqa: E402

N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128


def canonical(mask):
    """대각선 비트는 양옆 직선 이웃이 둘 다 천장일 때만 뜻이 있다(dlib.ceiling 의 depth 규칙과 같다). 47 모양으로 접는다."""
    m = mask & 15
    if (mask & NE) and (m & N) and (m & E): m |= NE
    if (mask & SE) and (m & S) and (m & E): m |= SE
    if (mask & SW) and (m & S) and (m & W): m |= SW
    if (mask & NW) and (m & N) and (m & W): m |= NW
    return m


SHAPES = sorted({canonical(m) for m in range(256)})
assert len(SHAPES) == 47, len(SHAPES)


def open8(mask):
    """dlib.ceiling 인자 (N,E,S,W,NE,SE,SW,NW) — 그 방향이 열린(천장이 아닌) 칸인가."""
    return tuple(not (mask & b) for b in (N, E, S, W, NE, SE, SW, NW))


def tile(mask, seed=0):
    return dlib.ceiling(open8(canonical(mask)), seed=seed, cave=False).convert('RGBA')
