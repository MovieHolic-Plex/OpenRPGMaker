"""나무 그리기 — 높이장(heightfield) 조명 방식.

덩어리(잎 무더기)들을 반구 높이장의 합집합으로 쌓고, 법선과 빛 방향의 내적을 5톤으로 끊는다.
- 낱 덩이마다 왼쪽 위가 밝게 → 기준 그림처럼 잎 무더기마다 밝은 면이 흩어진다.
- 덩이가 겹친 틈(높이 차)은 어둡게(주변 최대 높이 - 내 높이) → 그림자 틈.
- 윤곽은 빛의 반대쪽(오른쪽·아래) 가장자리에만 진하게, 빛 쪽 가장자리는 윤곽 없이 잎색 그대로.
- 질감은 저주파 값 잡음으로 경계를 흔들어 낱알이 아니라 덩이로 끊기게 한다.
모든 픽셀은 계산으로 정해지지만 그림의 구조(덩이 배치·톤 경계)는 레시피가 정한다 — 기준 그림 픽셀을 쓰지 않는다.
"""
from __future__ import annotations

import math
import random

import px

Color = tuple[int, int, int, int]


class Field:
    def __init__(self, w: int, h: int) -> None:
        self.w, self.h = w, h
        self.z = [[0.0] * w for _ in range(h)]

    def lump(self, cx: float, cy: float, rx: float, ry: float, height: float, flat: float = 1.0) -> None:
        """타원 반구(높이 height)를 max 로 얹는다. flat<1 이면 윗면이 납작."""
        for y in range(max(0, int(cy - ry) - 1), min(self.h, int(cy + ry) + 2)):
            for x in range(max(0, int(cx - rx) - 1), min(self.w, int(cx + rx) + 2)):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                d2 = dx * dx + dy * dy
                if d2 >= 1:
                    continue
                zz = height * (1 - d2) ** (0.5 * flat)
                if zz > self.z[y][x]:
                    self.z[y][x] = zz

    def mask(self) -> list[list[bool]]:
        return [[v > 0.05 for v in row] for row in self.z]


def value_noise(w: int, h: int, scale: float, seed: str) -> list[list[float]]:
    r = random.Random(seed)
    gw, gh = int(w / scale) + 3, int(h / scale) + 3
    grid = [[r.random() for _ in range(gw)] for _ in range(gh)]
    out = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            fx, fy = x / scale, y / scale
            ix, iy = int(fx), int(fy)
            tx, ty = fx - ix, fy - iy
            tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
            a = grid[iy][ix] * (1 - tx) + grid[iy][ix + 1] * tx
            b = grid[iy + 1][ix] * (1 - tx) + grid[iy + 1][ix + 1] * tx
            out[y][x] = a * (1 - ty) + b * ty
    return out


def clean_mask(m: list[list[bool]], rounds: int = 1) -> list[list[bool]]:
    """외톨이 점·1px 가시 제거, 1px 구멍 메움."""
    h, w = len(m), len(m[0])
    for _ in range(rounds):
        n = [row[:] for row in m]
        for y in range(h):
            for x in range(w):
                nb = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and m[y + dy][x + dx])
                if m[y][x] and nb <= 1:
                    n[y][x] = False
                if not m[y][x] and nb >= 3:
                    n[y][x] = True
        m = n
    return m


LIGHT = (-0.55, -0.65, 0.52)


def shade(field: Field, ramp: list[Color], noise_seed: str, shares: tuple[float, float, float, float, float], noise_amp: float = 0.2,
          ao_amp: float = 0.9, ao_radius: int = 3, vertical: float = 0.0, outline_dark: bool = True):
    """높이장 → 5톤 그림. ramp = [최암, 암, 중, 명, 최명], shares = 각 톤의 목표 비중(합 1 — 기준 그림에서 잰 값).
    조명값을 분위수로 끊어 톤 분포가 목표와 같게 만든다(경계 모양은 법선·잡음이 정한다). 반환 (이미지, 마스크)."""
    w, h = field.w, field.h
    m = clean_mask(field.mask(), 2)
    z = field.z
    nz = value_noise(w, h, 3.2, noise_seed)
    nz2 = value_noise(w, h, 6.5, noise_seed + "b")
    norm = math.sqrt(sum(c * c for c in LIGHT))
    L = tuple(c / norm for c in LIGHT)
    im = px.new(w, h)

    def zz(x: int, y: int) -> float:
        return z[y][x] if 0 <= x < w and 0 <= y < h and m[y][x] else 0.0

    lights: dict[tuple[int, int], float] = {}
    for y in range(h):
        for x in range(w):
            if not m[y][x]:
                continue
            gx = (zz(x + 1, y) - zz(x - 1, y)) / 2
            gy = (zz(x, y + 1) - zz(x, y - 1)) / 2
            nx_, ny_, nz_ = -gx, -gy, 1.0
            ln = math.sqrt(nx_ * nx_ + ny_ * ny_ + nz_ * nz_)
            light = (nx_ * L[0] + ny_ * L[1] + nz_ * L[2]) / ln
            light += (nz[y][x] - 0.5) * noise_amp + (nz2[y][x] - 0.5) * noise_amp
            light -= vertical * (y / h)
            # 틈: 주변에서 가장 높은 곳과의 차가 클수록 어둡게
            mx = 0.0
            for dy in range(-ao_radius, ao_radius + 1):
                for dx in range(-ao_radius, ao_radius + 1):
                    mx = max(mx, zz(x + dx, y + dy))
            light -= ao_amp * max(0.0, (mx - z[y][x]) / max(mx, 1e-6)) * 0.5
            lights[(x, y)] = light
    order = sorted(lights.values())
    n = len(order)
    cuts, acc = [], 0.0
    for sh in shares[:-1]:
        acc += sh
        cuts.append(order[min(n - 1, int(acc * n))])
    for (x, y), light in lights.items():
        tone = sum(1 for c in cuts if light > c)
        im.putpixel((x, y), ramp[tone])
    # 윤곽: 빛 반대쪽(오른쪽·아래)이 비어 있는 가장자리는 최암, 빛 쪽 가장자리는 중간톤 이상으로 눌러 선 없이 끝낸다
    out = im.copy()
    for y in range(h):
        for x in range(w):
            if not m[y][x]:
                continue
            empty_r = x + 1 >= w or not m[y][x + 1]
            empty_d = y + 1 >= h or not m[y + 1][x]
            empty_l = x == 0 or not m[y][x - 1]
            empty_u = y == 0 or not m[y - 1][x]
            if empty_r or empty_d:
                out.putpixel((x, y), ramp[0] if outline_dark else ramp[1])
            elif empty_l or empty_u:
                c = out.getpixel((x, y))
                if c in (ramp[0], ramp[1]):
                    out.putpixel((x, y), ramp[2])
    return out, m


def cluster_canopy(w: int, h: int, centers: list[tuple[float, float, float]], ramp: list[Color], seed: str, lit_bias: float = 0.0, vslope: float = 0.65, hslope: float = 0.0):
    """잎 무더기(클러스터) 방식. 뒤→앞(위→아래) 순서로 덩이를 얹고, 덩이마다 왼쪽 위 밝은 면·오른쪽 아래 어두운 면·
    오른쪽 아래 가장자리 진한 선을 준다. 아래 덩이가 위 덩이를 덮으면서 틈 선이 생긴다.
    centers = [(cx, cy, r)] — 호출자가 돔 안에 흩뿌려 준다. 반환 (이미지, 마스크)."""
    r = random.Random(seed)
    im = px.new(w, h)
    mask = [[False] * w for _ in range(h)]
    order = sorted(centers, key=lambda c: c[1] + r.uniform(-1.5, 1.5))
    # 덩이 가장자리 흔들림: 각도별 반지름 보정
    for cen in order:
        cx, cy, rad = cen[0], cen[1], cen[2]
        asp = cen[3] if len(cen) > 3 else 1.0
        wob = [r.uniform(-0.28, 0.28) for _ in range(8)]
        kind = r.random()
        base_lit = lit_bias + (0.24 if kind < 0.3 else -0.2 if kind > 0.7 else 0.0) - vslope * max(0.0, (cy - h * 0.15) / h) + hslope * (w * 0.5 - cx) / w
        for y in range(int(cy - rad) - 2, int(cy + rad) + 3):
            for x in range(int(cx - rad) - 2, int(cx + rad) + 3):
                if not (0 <= x < w and 0 <= y < h):
                    continue
                dx, dy = (x + 0.5 - cx) / asp, y + 0.5 - cy
                d = math.hypot(dx, dy)
                ang = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * 8
                i0 = int(ang) % 8; i1 = (i0 + 1) % 8; t = ang - int(ang)
                rr = rad * (1 + wob[i0] * (1 - t) + wob[i1] * t)
                if d > rr:
                    continue
                hx, hy = dx + 0.38 * rr, dy + 0.42 * rr   # 밝은 면의 중심은 덩이 중심의 왼쪽 위
                light = 1.0 - math.hypot(hx, hy) / (rr * 1.3) - 0.12 + base_lit
                tone = 4 if light > 0.5 else 3 if light > 0.2 else 2 if light > -0.2 else 1
                if d > rr - 1.15:
                    # 덩이 둘레: 오른쪽 아래는 최암 틈 선, 나머지는 자기 톤보다 한 단 어둡게(이웃 덩이와 경계가 보이도록)
                    tone = 0 if (dx * 0.6 + dy * 0.8) > 0.18 * rr else max(1, tone - 1)
                c = ramp[tone]
                im.putpixel((x, y), c)
                mask[y][x] = True
    mask = clean_mask(mask, 2)
    out = px.new(w, h)
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            c = im.getpixel((x, y))
            if c[3] == 0:
                c = ramp[2]
            empty_r = x + 1 >= w or not mask[y][x + 1]
            empty_d = y + 1 >= h or not mask[y + 1][x]
            empty_l = x == 0 or not mask[y][x - 1]
            empty_u = y == 0 or not mask[y - 1][x]
            if empty_r or empty_d:
                c = ramp[0] if (empty_d or y > h * 0.5) else ramp[1]
            elif (empty_l or empty_u) and c not in (ramp[0], ramp[1]) and (x * 7 + y * 13) % 5 < 2:
                c = ramp[1]                    # 빛 쪽 가장자리도 군데군데 윤곽(기준 그림이 그렇다 — 윤곽 0 이면 번져 보인다)
            out.putpixel((x, y), c)
    return out, mask
