#!/usr/bin/env python3
"""비닐하우스 밑그림: 반원통(비닐 터널)을 우리 3/4 투영으로 1배 렌더한다.

투영: 점 (x, y=북쪽, z=위) → 화면 sx = x, sy = 바닥 − c·y − z  (c = 바닥면 깊이 압축, 기본 0.65).
그래서 길이 방향(y)에 수직인 갈비대 하나하나가 높이 r 의 온전한 반원 ∩ 로 찍히고, c·Δy 만큼 위로 올라가며 쌓인다.
빛은 북서 위에서(왼쪽 위), 그림자는 남동 바닥에 떨어진다.

  python3 tunnel_underdraw.py ns <out.png> [--c 0.65]   # 남북 터널, 4×7 칸(64×112), 남쪽 끝면(∩)과 문 자리
  python3 tunnel_underdraw.py ew <out.png> [--c 0.65]   # 동서 터널, 7×4 칸(112×64). 이 투영은 sx = x 라 서쪽 끝면은 폭 0(옆선)이 된다.
출력은 회색 값 지도(밝을수록 빛) + 갈비대 선 + 그림자. 키트 칸 경계는 빨간 점선으로 표시하고, 바깥 여백까지 그린다(그림자가 칸 밖으로 나가는지 보려고).
"""
import argparse, math
from PIL import Image

PAD = 12
LIGHT = (-0.55, 0.45, 0.70)  # 북서 위
n = math.sqrt(sum(v * v for v in LIGHT)); LIGHT = tuple(v / n for v in LIGHT)


def lam(nx, ny, nz):
    return max(0.0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])


def render(kind, c, rib=10.0):
    if kind == 'ns':
        KW, KH = 64, 112
        r = 30.0                    # 반지름(옆자락 1px 씩 여유)
        cx = KW / 2
        base = KH - 3               # 남쪽 끝 바닥 줄(화면)
        L = (base - r - 2) / c      # 북쪽 갈비대 꼭대기가 칸 맨 위에 닿는 길이
    else:
        KW, KH = 112, 64
        r = 22.0
        base = KH - 3
        L = KW - 6                  # x 방향 길이
    W, H = KW + 2 * PAD, KH + 2 * PAD
    im = Image.new('RGB', (W, H), (150, 140, 120))
    px = im.load()

    def ground(sx, sy):
        # 바닥 점 복원 후 빛 쪽으로 쏴서 그림자 판정
        if kind == 'ns':
            gx, gy = sx - cx, (base - sy) / c
        else:
            gx, gy = sx, (base - sy) / c   # ew: 원통 축은 x, 단면 중심 y=r
        for t in [i * 0.5 for i in range(1, 200)]:
            x, y, z = gx + t * LIGHT[0], gy + t * LIGHT[1], t * LIGHT[2]
            if kind == 'ns':
                if 0 <= y <= L and x * x + z * z <= r * r:
                    return True
            else:
                if 3 <= x <= 3 + L and (y - r) ** 2 + z * z <= r * r:
                    return True
        return False

    for j in range(H):
        for i in range(W):
            sx, sy = i - PAD + 0.5, j - PAD + 0.5
            col = None
            if kind == 'ns':
                x = sx - cx
                if abs(x) < r:
                    zt = math.sqrt(r * r - x * x)
                    # 남쪽 끝면(y=0): sy = base − z, 0 ≤ z ≤ zt
                    if base - zt <= sy <= base:
                        v = 0.25 + 0.5 * lam(0, -1, 0)
                        col = v
                        if base - zt <= sy < base - zt + 1.2:
                            col = 0.85   # 끝 아치 파이프
                    else:
                        y = (base - sy - zt) / c
                        if 0 <= y <= L:
                            v = 0.2 + 0.8 * lam(x / r, 0, zt / r)
                            if (y % rib) < 1.0 / c or y > L - 1.0 / c:
                                v = min(1.0, v + 0.25)   # 갈비대
                            col = v
            else:
                x = sx - 3
                if 0 <= x <= L:
                    # 단면: y = r + r·cosφ, z = r·sinφ → sy = base − c·y − z. 위쪽 면(카메라 쪽 보이는 쪽)을 찾는다.
                    best = None
                    for k in range(0, 721):
                        ph = math.pi * k / 720
                        yy, zz = r + r * math.cos(ph), r * math.sin(ph)
                        s = base - c * yy - zz
                        if abs(s - sy) < 0.5:
                            # 보이는 면: 카메라 시선(남쪽 위)에 대해 앞쪽 = 화면에서 아래에 찍히는 쪽 — 가장 남쪽(작은 y) 해를 고른다
                            if best is None or yy < best[0]:
                                best = (yy, zz, ph)
                    if best:
                        yy, zz, ph = best
                        v = 0.2 + 0.8 * lam(0, math.cos(ph), math.sin(ph))
                        if (x % rib) < 1.0 or x > L - 1:
                            v = min(1.0, v + 0.25)
                        col = v
            if col is None:
                g = (150, 140, 120)
                if ground(sx, sy):
                    g = (95, 88, 76)
                px[i, j] = g
            else:
                q = int(40 + 200 * col)
                px[i, j] = (q, q, q + 6)
    # 키트 칸 경계 점선
    for i in range(0, KW, 2):
        px[PAD + i, PAD] = (220, 40, 40); px[PAD + i, PAD + KH - 1] = (220, 40, 40)
    for j in range(0, KH, 2):
        px[PAD, PAD + j] = (220, 40, 40); px[PAD + KW - 1, PAD + j] = (220, 40, 40)
    return im


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['ns', 'ew'])
    ap.add_argument('out')
    ap.add_argument('--c', type=float, default=0.65)
    a = ap.parse_args()
    render(a.kind, a.c).save(a.out)
