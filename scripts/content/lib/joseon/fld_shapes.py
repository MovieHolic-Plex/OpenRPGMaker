"""지도 빌더 공용 모양 도구(demo_field.py · demo_cave.py): 잡음, 유기적 윤곽, 곡선 붓, 다수결 다듬기.

모두 칸(타일) 좌표의 정수 칸 집합을 만든다. 직사각·계단 팔각형 대신 둥글고 불규칙한 윤곽이 나오게 하는 것이 목적이다.
"""
import math
import random
from tk import rnd


def vnoise(x, y, seed, sc=5.0):
    """격자 값 잡음의 쌍선형 보간(0..1): 덩이가 둥글게 섞여 직사각형 패치가 안 생긴다."""
    fx, fy = x / sc, y / sc
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = rnd(x0, y0, seed), rnd(x0 + 1, y0, seed)
    c, d = rnd(x0, y0 + 1, seed), rnd(x0 + 1, y0 + 1, seed)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def organic(cx, cy, rx, ry, seed, lobes=(2, 3, 5), amp=(0.20, 0.14, 0.08), bounds=None):
    """극좌표 반지름을 저주파 사인 몇 개로 흔든 둥글고 불규칙한 윤곽. bounds=(w, h) 안의 칸만."""
    ph = [rnd(k, seed, 61) * 6.283 for k in range(len(lobes))]
    out = set()
    for y in range(int(cy - ry * 1.6) - 1, int(cy + ry * 1.6) + 2):
        for x in range(int(cx - rx * 1.6) - 1, int(cx + rx * 1.6) + 2):
            a = math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx)
            r = 1.0 + sum(am * math.sin(lb * a + p) for lb, am, p in zip(lobes, amp, ph))
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if d <= r and (bounds is None or (0 <= x < bounds[0] and 0 <= y < bounds[1])):
                out.add((x, y))
    return out


def smooth(cells, rounds=2, bounds=None):
    """집합 윤곽의 1칸 가시·홈을 다수결(3×3 중 5칸 이상)로 다듬는다."""
    cells = set(cells)
    for _ in range(rounds):
        cand = {(x + dx, y + dy) for (x, y) in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        new = set()
        for (x, y) in cand:
            n = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (x + dx, y + dy) in cells)
            if n >= 5:
                new.add((x, y))
        cells = new
    if bounds:
        cells = {c for c in cells if 0 <= c[0] < bounds[0] and 0 <= c[1] < bounds[1]}
    return cells


def curve_cells(points, width=2, wob=0.0, seed=0, bounds=None):
    """웨이포인트를 부드러운 곡선(Catmull-Rom)으로 잇고 width×width 붓으로 칠한 칸 목록(순서 유지)."""
    pts = [(float(x), float(y)) for (x, y) in points]
    pts = [pts[0]] + pts + [pts[-1]]
    cells, seen = [], set()
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        n = max(4, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 2))
        for k in range(n + 1):
            t = k / float(n)
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t * t + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t ** 3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t * t + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t ** 3)
            if wob:
                x += (vnoise(int(x * 3), int(y * 3), seed + 7, 4.0) - 0.5) * wob
            cx, cy = int(math.floor(x)), int(math.floor(y))
            for ox in range(width):
                for oy in range(width):
                    c = (cx + ox, cy + oy)
                    if c not in seen and (bounds is None or (0 <= c[0] < bounds[0] and 0 <= c[1] < bounds[1])):
                        seen.add(c); cells.append(c)
    return cells


def squircle(cx, cy, rx, ry, seed=0, n=3.0, amp=0.10, sc=3.5, bounds=None):
    """모서리가 둥근 네모(초타원, 지수 n) 윤곽을 잡음으로 살짝 흔든 칸 집합: 방 윤곽이 대각 계단 대신 긴 직선 변과 둥근 모서리가 되어, 벽 앞면이 한 칸짜리 계단으로 쪼개지지 않는다."""
    out = set()
    for y in range(int(cy - ry * 1.4) - 1, int(cy + ry * 1.4) + 2):
        for x in range(int(cx - rx * 1.4) - 1, int(cx + rx * 1.4) + 2):
            u, v = abs(x + 0.5 - cx) / rx, abs(y + 0.5 - cy) / ry
            lim = 1.0 + (vnoise(x, y, seed + 31, sc) - 0.5) * 2 * amp
            if u ** n + v ** n <= lim and (bounds is None or (0 <= x < bounds[0] and 0 <= y < bounds[1])):
                out.add((x, y))
    return out
