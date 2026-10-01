#!/usr/bin/env python3
"""F1: 동·서를 향한 고원 가장자리에 3칸 폭 정면 벽이 그려지는 문제.

원인(코드 추적, 자세한 것은 terrain-audit.md 「F1 원인」):
  terrain_v4.Map4._compute_faces 는 **열 단위**다. 칸 (x,y) 의 높이 Hh 가 바로 아래 (x,y+1) 보다 높으면 그 아래 n(2~3)칸을 벽(face)으로 만든다.
  고원 가장자리가 남북으로 길고 한 열씩 계단처럼 옮겨 가면(예: x65 y38 → x66 y40 → x67 y42), 계단 한 칸마다 「자기 열의 남쪽 벽」이
  2~3칸 높이로 하나씩 생겨 대각선으로 이어진 띠가 된다. cliff_v8._plateau_level 은 face 칸을 가우시안(SIG_FACE)으로 번지게 해
  이 띠를 이어 붙이므로, 동·서를 향한 가장자리가 2~3칸 폭의 정면 벽으로 보인다. 3/4 에서 동·서를 향한 면은 높이를 가지지 않는다.

수정(f1 규칙): 위 칸 (x,y) 이 동쪽 또는 서쪽 이웃보다 높으면(= 그 칸이 고원의 동/서 가장자리 끝) 그 열의 벽 높이를 1칸으로 줄인다.
  곧게 이어진 남쪽 가장자리의 가운데 열들은 그대로 2~3칸. 모서리 열과 대각선 계단 열만 1칸이 된다.
  Hh·G 는 그대로이고 face 칸 수만 줄어든다 → 줄어든 칸은 낮은 땅(걸을 수 있는 칸)으로 돌아간다.

  python3 terrain_f1.py f1only|f1t   → /tmp/fx34/base_f1only.npy|base_f1t.npy (+ .json)
"""
import os
import sys
from pathlib import Path

os.environ['CITY_TAG'] = 'v8'
HERE = Path(__file__).resolve().parent
# [worldmap-kit 복사본] 경로 삽입 제거
import numpy as np  # noqa: E402
import terrain_v4 as V  # noqa: E402


def is_flank(Hh, G, x, y, a):
    """(x,y) 고원 칸이 동/서 가장자리 끝인가: 좌우 이웃 중 하나가 더 낮거나 물."""
    W = Hh.shape[1]
    for xx in (x - 1, x + 1):
        if xx < 0 or xx >= W:
            return True
        if G[y, xx] < 10 or Hh[y, xx] < a:
            return True
    return False


def compute_faces_f1(self):
    H, W = self.H, self.W
    for x in range(W):
        for y in range(H - 1):
            a, b = self.Hh[y, x], self.Hh[y + 1, x]
            if b < a and self.G[y, x] >= 10 and not self.RAMP[y + 1, x] and self.G[y + 1, x] >= 10 and (x, y + 1) not in self.face:
                n = 3 if (a - b == 1 and V.hh(x // 4, y // 3, 71) % 5 < 2) else 2
                if is_flank(self.Hh, self.G, x, y, a):
                    n = 1
                cells = []
                for j in range(n):
                    yy = y + 1 + j
                    if yy >= H or self.Hh[yy, x] != b or self.G[yy, x] < 10 or self.RAMP[yy, x]:
                        break
                    cells.append((x, yy))
                if len(cells) >= 1:
                    rock = self.rock_at(x, y)
                    for j, c in enumerate(cells):
                        self.face[c] = (j, len(cells), rock)
    # 2판: 이웃(8방향)에 다른 벽이 없는 1칸 벽은 외톨이 조각이라 지운다(x65,y38 등) — 가장자리는 테두리 선만 남는다
    for (x, y), (j, n, rock) in list(self.face.items()):
        if n == 1 and not any((x + dx, y + dy) in self.face for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy)):
            del self.face[(x, y)]


def render(name, with_t):
    import make_map_icons_v9 as MM
    V.Map4._compute_faces = compute_faces_f1
    if with_t:
        import terrain_fix
        terrain_fix.install_patch()
    MM.CACHE = Path('/tmp/fx34') / name
    return MM.base_image(force=True)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'f1only'
    render('base_' + mode, mode == 'f1t')
    print('done', mode)
