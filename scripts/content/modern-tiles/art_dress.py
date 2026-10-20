"""modern_city 건물 그림자·기초 — 코드 손 도트. 2026-10-20 사용자 승인 시안(outline/src/dress.py)을 칸 오버레이로 옮겼다.
윤곽색 재매핑은 보류(이 파일에 없다).

빛은 왼쪽 위. 건물 그림자는 오른쪽 아래 두 단(안쪽 진하게 · 바깥 옅게, 반투명 남색 = 곱하기 근사):
  동쪽 열(건물 오른쪽 칸): 안쪽 3px · 바깥 5px, 건물 높이 35% 아래부터.
  남쪽 줄(건물 아래 칸 = 문 앞 접근칸 줄): 기초(콘크리트 3px, 문·유리 앞은 밝은 디딤판) + 접촉선 + 바깥 그늘.
  남동 모서리: 두 단 꺾임.
모두 2층(lowerOverlay)에 까는 투명 바닥 표시 칸(flat, 통행 가능, 사람 밑).
"""
from collections import Counter

import numpy as np
from PIL import Image

T = 16
SH = (9, 17, 37)          # 옛 그림자 칸과 같은 남색 — 곱하기 그림자 근사
A_IN, A_OUT = 118, 66
STONE = [(184, 178, 166), (150, 144, 134), (112, 106, 100), (66, 60, 58)]   # 밝음 · 몸 · 어둠 · 이음/윤곽
THRESH = (226, 222, 212)


def _cell():
    return np.zeros((T, T, 4), np.uint8)


def _sh(a, x, y, al):
    if 0 <= x < T and 0 <= y < T and a[y, x, 3] < al:
        a[y, x, :3] = SH; a[y, x, 3] = al


def img(a):
    return Image.fromarray(a, 'RGBA')


def east_mid():
    a = _cell()
    for y in range(T):
        for x in range(8):
            _sh(a, x, y, A_IN if x < 3 else A_OUT)
    return img(a)


def east_top():
    """동쪽 그림자 시작 칸: 안쪽은 y=6 부터, 바깥은 y=9 부터(비스듬히 떨어지는 끝)."""
    a = _cell()
    for y in range(T):
        for x in range(8):
            if x < 3 and y >= 6:
                _sh(a, x, y, A_IN)
            elif x >= 3 and y >= 9 + (x - 3) // 2:
                _sh(a, x, y, A_OUT)
            elif x >= 3 and y >= 7 and x < 5:
                _sh(a, x, y, A_OUT)
    return img(a)


def south_east():
    """건물 오른쪽 아래 모서리(접근칸 줄 오른쪽 이웃): 안쪽 3×2 + 바깥 L 자(오른쪽 8px · 아래 6px 까지)."""
    a = _cell()
    for y in range(6):
        for x in range(8):
            if x < 3 and y < 2:
                _sh(a, x, y, A_IN)
            elif not (x >= 6 and y >= 4):
                _sh(a, x, y, A_OUT)
    return img(a)


def wall_mask(kit_img):
    """건물 밑변 열마다 벽(True)/문·유리·셔터(False). 시안 add_plinth 와 같은 판정(밑에서 셋째 줄의 흔한 두 색 + 양 끝 열)."""
    B = np.array(kit_img.convert('RGBA')).astype(int)
    h, w = B.shape[:2]
    r = h - 3
    rowc = Counter(tuple(B[r, x, :3]) for x in range(w) if B[r, x, 3])
    wallc = {c for c, _n in rowc.most_common(2)} | {tuple(B[r, x, :3]) for x in (1, 2, w - 3, w - 2) if B[r, x, 3]}
    return [bool(B[h - 1, x, 3]) and (not B[r, x, 3] or tuple(B[r, x, :3]) in wallc) for x in range(w)], [bool(B[h - 1, x, 3]) for x in range(w)]


def plinth_row(kit_img):
    """접근칸 줄 오버레이 칸들(왼쪽 → 오른쪽, 키트 폭 칸 수). 기초 3px + 접촉선 + 남쪽 그늘(왼쪽 끝 3px 는 비움)."""
    wall, opq = wall_mask(kit_img)
    w = len(wall)
    xs = [x for x in range(w) if opq[x]]
    if not xs:
        return None
    x0, x1 = min(xs), max(xs)
    row = np.zeros((T, w, 4), np.uint8)

    def setc(x, y, c, al=255):
        row[y, x, :3] = c; row[y, x, 3] = al
    for x in range(w):            # 그늘(기초 아래 3줄) — 오른쪽으로 3px 밀린 그림자
        if x >= x0 + 3:
            for y, al in ((3, 104), (4, 74), (5, 52)):
                setc(x, y, SH, al)
    for x in range(x0, x1 + 1):
        end = x in (x0, x1)
        iswall = wall[x]
        setc(x, 0, STONE[3] if end else (STONE[0] if iswall else THRESH))
        setc(x, 1, STONE[3] if end else (STONE[3] if (iswall and (x - x0) % 8 == 5) else STONE[1] if iswall else STONE[0]))
        setc(x, 2, STONE[3])
        if row[3, x, 3] < 120:
            setc(x, 3, SH, 120)
    return [Image.fromarray(np.ascontiguousarray(row[:, c * T:(c + 1) * T]), 'RGBA') for c in range(w // T)]


def restyle_prop_shadow(cell):
    """옛 소품·나무 그림자 칸(납작 타원, 한 단 반투명) → 두 단(가장자리 옅게, 속 진하게)."""
    a = np.array(cell.convert('RGBA'))
    m = a[:, :, 3] > 0
    out = np.zeros_like(a)
    for y in range(T):
        for x in range(T):
            if not m[y, x]:
                continue
            edge = any(not (0 <= x + dx < T and 0 <= y + dy < T) or not m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            # 칸 경계에 닿은 화소는 이웃 칸에 이어지므로 가장자리로 보지 않는다
            edge = any((0 <= x + dx < T and 0 <= y + dy < T) and not m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            out[y, x, :3] = SH; out[y, x, 3] = 60 if edge else 108
    return Image.fromarray(out, 'RGBA')
