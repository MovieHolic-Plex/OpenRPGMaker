#!/usr/bin/env python3
"""몬스터 수집 캠페인 타이틀 키아트 — 시작 마을 풍경별 변형(풀밭·사막·눈)을 코드 손 도트로 찍는다.

왜(2026-10-14): 타이틀이 테마와 상관없이 늘 해안 사슴 그림(생성 이미지, coast 정본으로 그대로 둔다)이었다.
변형 셋은 생성 이미지를 쓰지 않는다 — 모든 픽셀을 좌표·수식으로 찍는다(240×160 GBA 화면 한 장, 런타임이 480×320 무대에 픽셀 그대로 키운다).
화풍은 몬스터 칩셋 GBA 다시 그리기(#2314·#2319)와 같다: 민트 풀·덩이 수관·1px 짙은 윤곽·4×4 순서 디더 하늘·왼쪽 위 빛.
구도 규칙(사슴 그림과 같다): 왼쪽 위 하늘은 비워 둔다(제목·메뉴 자리), 주인공 몬스터는 오른쪽 1/3 언덕 위.
몬스터볼 모양(빨강·흰 반쪽 공)은 쓰지 않는다.

사용: python3 scripts/content/monster-title-art.py [--out public/assets/emerald-monster] [--preview /tmp/x]
출력: title-<meadow|desert|snow>.png (240×160) + title-<…>-asset.json (UploadedAsset, id = emeraldMonsterTitleArt.ts 의 MONSTER_TITLE_ART_IDS)
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path

from PIL import Image

W, H = 240, 160
BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


def hx(s: str):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def hh(x: int, y: int, k: int = 0) -> float:
    h = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65536


class Canvas:
    def __init__(self):
        self.im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        self.px = self.im.load()

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[x, y] = c

    def get(self, x, y):
        return self.px[int(x), int(y)]

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.p(x, y, c)

    def dither_v(self, y0, y1, ramp, x0=0, x1=W - 1):
        """y0..y1 에 ramp 색 띠를 위→아래 순서 디더로 잇는다(GBA 하늘)."""
        n = len(ramp) - 1
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0) * n
            i = min(n - 1, int(t)); f = t - i
            for x in range(x0, x1 + 1):
                self.p(x, y, ramp[i + 1] if f * 16 > BAYER[y % 4][x % 4] + 0.5 else ramp[i])

    def disc(self, cx, cy, r, c, keep=None):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if math.hypot(x + .5 - cx, y + .5 - cy) <= r and (keep is None or keep(x, y)):
                    self.p(x, y, c)

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if (ay <= y + .5 < by) or (by <= y + .5 < ay):
                    xs.append(ax + (y + .5 - ay) * (bx - ax) / (by - ay))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))):
                    self.p(x, y, c)


def ridge(seed: int, base: float, amps, x: float) -> float:
    y = base
    for k, (amp, per) in enumerate(amps):
        y += amp * math.sin(x / per * 2 * math.pi + seed * 1.7 + k * 2.3)
    return y


def fill_ridge(cv: Canvas, top_fn, ramp, light_from_left=True, outline=None, tex=None):
    """top_fn(x) 아래를 채운다. 윗변 1px 은 밝게(빛), 기울기가 오른쪽 아래로 가면 한 톤 어둡게."""
    for x in range(W):
        t = top_fn(x)
        slope = top_fn(x + 1) - top_fn(x - 1)
        for y in range(max(0, int(math.ceil(t))), H):
            d = y - t
            c = ramp[1]
            if d < 1.2:
                c = outline if outline is not None and slope > 1.2 else ramp[2] if slope < 0.4 else ramp[1]
            elif slope > 0.9 and d < 6:
                c = ramp[0]
            if tex:
                c = tex(x, y, d, c) or c
            cv.p(x, y, c)


def cloud(cv: Canvas, cx, cy, w, ramp, seed):
    """덩이 구름: 둥근 덩이 여럿 · 아래 평평 · 왼쪽 위 밝음 · 아래 한 줄 그늘."""
    blobs = []
    n = max(3, int(w / 7))
    for k in range(n):
        bx = cx - w / 2 + (k + .5) * w / n
        r = 3.2 + 3.4 * math.sin(math.pi * (k + .5) / n) + hh(k, seed) * 1.5
        blobs.append((bx, cy - r * .55, r))
    for y in range(int(cy - 12), int(cy + 3)):
        for x in range(int(cx - w / 2 - 6), int(cx + w / 2 + 6)):
            inside = any(math.hypot(x + .5 - bx, (y + .5 - by) * 1.15) <= r for bx, by, r in blobs) and y <= cy
            if not inside:
                continue
            light = min(-(x + .5 - bx) * .5 - (y + .5 - by) for bx, by, r in blobs if math.hypot(x + .5 - bx, (y + .5 - by) * 1.15) <= r + .01)
            c = ramp[2] if y >= cy - 1 else ramp[0] if light > 1.5 else ramp[1]
            cv.p(x, y, c)


def lumpy_tree(cv: Canvas, cx, base_y, r, leaf, trunk, outline):
    """GBA 덩이 수관 나무(칩셋 forest.crown 과 같은 문법을 크게): 덩이 다섯 · 왼쪽 위 밝음 · 둘레 1px 짙은 윤곽 · 짧은 줄기."""
    clumps = ((0, -.55, .62, 1), (-.48, -.12, .55, 1), (.48, -.12, .55, 0), (-.3, .32, .52, 0), (.34, .34, .52, -1))
    cy = base_y - r * 1.05
    tone = {}
    for k, (dx, dy, rad, bias) in enumerate(clumps):
        ccx, ccy, rr = cx + dx * r, cy + dy * r, rad * r
        for y in range(int(ccy - rr - 1), int(ccy + rr + 2)):
            for x in range(int(ccx - rr - 1), int(ccx + rr + 2)):
                ex, ey = x + .5 - ccx, y + .5 - ccy
                d = math.hypot(ex, ey)
                if d > rr:
                    continue
                lt = -(ex * .62 + ey * .78) / rr + (hh(x // 2, y // 2, 7 + k) - .5) * .4
                t = 4 if lt > .6 else 3 if lt > .12 else 2 if lt > -.45 else 1
                t = max(1, min(4, t + bias))
                if d > rr - 1.2 and ex * .6 + ey * .8 > .15 * rr:
                    t = 1
                tone[(x, y)] = t
    tw = max(2, int(r * .28))
    for y in range(int(cy + r * .6), int(base_y) + 1):
        for x in range(int(cx - tw / 2), int(cx + tw / 2) + 1):
            rel = (x - (cx - tw / 2)) / max(1, tw)
            cv.p(x, y, trunk[2] if rel < .35 else trunk[1] if rel < .8 else trunk[0])
    for (x, y), t in tone.items():
        edge = any((x + a, y + b) not in tone for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        cv.p(x, y, outline if edge else leaf[t])


def pine(cv: Canvas, cx, base_y, h, ramp, snow, outline, trunk):
    """눈 덮인 전나무: 층 셋 · 각 층 윗면에 눈 · 왼쪽 밝음 · 둘레 윤곽."""
    w = h * .42
    mask = {}
    tiers = 3
    for k in range(tiers):
        top = base_y - h + k * h * .27
        bot = top + h * .42
        half = w * (.55 + .2 * k)
        for y in range(int(top), int(bot) + 1):
            f = (y - top) / max(1, bot - top)
            hw = half * f
            for x in range(int(cx - hw), int(cx + hw) + 1):
                lx = (x + .5 - cx) / max(1, hw)
                c = ramp[2] if lx < -.25 else ramp[1] if lx < .45 else ramp[0]
                if y - top < 2 + (1 - abs(lx)) * 2.2 or (f > .78 and hh(x, k, 3) < .35 and y > bot - 2):
                    c = snow[1] if lx < .2 else snow[0]
                mask[(x, y)] = c
    for y in range(int(base_y - h * .1), int(base_y) + 1):
        for x in range(int(cx - 1), int(cx + 1)):
            cv.p(x, y, trunk)
    for (x, y), c in mask.items():
        edge = any((x + a, y + b) not in mask for a, b in ((1, 0), (-1, 0), (0, 1)))
        cv.p(x, y, outline if edge and (x + 1, y) not in mask and c not in snow else c)


def outline_mask(cv: Canvas, mask: dict, outline):
    for (x, y), c in mask.items():
        edge = any((x + a, y + b) not in mask for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        cv.p(x, y, outline if edge else c)


# ============================================================ 풀밭(기본) ====
def meadow() -> Image.Image:
    cv = Canvas()
    sky = [hx(c) for c in ("#5aa8e8", "#78bcf0", "#98d0f4", "#bfe4f6", "#e2f4f2")]
    cv.dither_v(0, 92, sky)
    cl = [hx("#ffffff"), hx("#e8f2fa"), hx("#b8d2ea")]
    cloud(cv, 160, 30, 44, cl, 1); cloud(cv, 214, 46, 30, cl, 2); cloud(cv, 104, 58, 26, cl, 3)
    # 먼 산(푸른 회색) → 먼 언덕(청록) → 가까운 언덕(민트)
    far = [hx("#6f98b4"), hx("#86aec6"), hx("#a2c4d6")]
    fill_ridge(cv, lambda x: ridge(1, 78, ((6, 90), (3, 37)), x), far)
    hill = [hx("#3e9a78"), hx("#5cb48e"), hx("#86cca6")]
    fill_ridge(cv, lambda x: ridge(2, 92, ((5, 120), (2.5, 41)), x), hill)
    # 먼 언덕 위 숲 띠(작은 덩이 나무)
    leaf_far = [hx("#1f5a3c"), hx("#2f7a4c"), hx("#3f9456"), hx("#58ac66"), hx("#7cc47a")]
    for k, x in enumerate(range(-4, W + 8, 9)):
        if 40 < x < 120:
            continue
        lumpy_tree(cv, x + hh(k, 1) * 4, ridge(2, 92, ((5, 120), (2.5, 41)), x) + 6, 5.5 + hh(k, 2) * 2, leaf_far, [hx("#4a2c16"), hx("#6a4022"), hx("#8a5a32")], hx("#1a4430"))
    # 작은 마을: 빨간 지붕 집 셋(멀리)
    for k, (x, rw) in enumerate(((64, 12), (80, 10), (95, 13))):
        y = ridge(2, 92, ((5, 120), (2.5, 41)), x) - 1
        cv.rect(x - rw // 2, y - 6, x + rw // 2, y, hx("#f0e6c8"))
        cv.rect(x - rw // 2, y, x + rw // 2, y, hx("#b8a07a"))
        cv.poly([(x - rw / 2 - 2, y - 6), (x, y - 12), (x + rw / 2 + 2, y - 6)], hx("#c84838"))
        for xx in range(int(x - rw / 2 - 2), int(x + rw / 2 + 3)):
            cv.p(xx, y - 6, hx("#8a2c24"))
        cv.p(x - 2, y - 3, hx("#5a8ac8")); cv.p(x + 2, y - 3, hx("#5a8ac8"))
    # 가까운 풀밭(본 시트 민트 풀 램프) — 1px 점 결
    grass = [hx("#2e8a5e"), hx("#4fb489"), hx("#7acaa3"), hx("#a6dcc2")]

    def gtex(x, y, d, c):
        if d > 2 and hh(x, y, 5) < .07:
            return grass[3]
        if d > 2 and hh(x, y, 6) < .035:
            return grass[0]
        return None
    near = lambda x: ridge(3, 118, ((7, 150), (2, 33)), x) - (x - 150) * .06
    fill_ridge(cv, near, [grass[1], grass[2], grass[3]], tex=gtex)
    # 흙길이 앞에서 마을 쪽으로 굽는다(길 B 흙색)
    dirt = [hx("#b8a878"), hx("#cdbd8c"), hx("#ddd0a4")]
    for y in range(H):
        t = (y - 100) / 60
        if t < 0:
            continue
        cx = 82 + 30 * t * t + 10 * math.sin(t * 3)
        hw = 2 + 16 * t
        top = near(int(cx))
        if y < top + 1:
            continue
        for x in range(int(cx - hw), int(cx + hw) + 1):
            e = abs(x + .5 - cx) / hw
            cv.p(x, y, dirt[0] if e > .88 else dirt[2] if (e < .3 and hh(x, y, 9) < .2) else dirt[1])
    # 키 큰 풀 다발(외곽선 있는 포기) — 앞쪽
    tuft = [hx("#1e6a44"), hx("#2e8a5e"), hx("#4fb489"), hx("#7acaa3")]
    for k in range(26):
        x = int(hh(k, 11) * W); y = int(126 + hh(k, 12) * 32)
        if abs(x - (82 + 30 * ((y - 100) / 60) ** 2)) < 6 + 16 * (y - 100) / 60:
            continue
        for b in range(3):
            bx = x + (b - 1) * 3
            for yy in range(5):
                cv.p(bx, y - yy, tuft[2] if yy < 3 else tuft[3])
                cv.p(bx + 1, y - yy + 1, tuft[1])
            cv.p(bx, y - 5, tuft[0]); cv.p(bx - 1, y - 3, tuft[0])
    # 꽃
    for k in range(18):
        x = int(hh(k, 21) * 120); y = int(124 + hh(k, 22) * 30)
        col = (hx("#f07a9a"), hx("#ffffff"), hx("#f4d04a"))[k % 3]
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            cv.p(x + dx, y + dy, col)
        cv.p(x, y, hx("#f4d04a") if k % 3 != 2 else hx("#c8601c"))
    # 오른쪽 언덕 위 큰 나무 한 그루 + 그 아래 주인공 몬스터(잎 귀 여우)
    leaf = [hx("#2f4d12"), hx("#3b8a3c"), hx("#5eae4c"), hx("#92cf68"), hx("#c0ee96")]
    trunk = [hx("#4a2c16"), hx("#764824"), hx("#9c6638"), hx("#c08a52")]
    base = near(196)
    lumpy_tree(cv, 196, base + 2, 26, leaf, trunk, hx("#24400e"))
    # 나무 밑 그늘
    for x in range(170, 224):
        for y in range(int(base + 1), int(base + 5)):
            if ((x - 197) / 28) ** 2 + ((y - base - 2) / 3.2) ** 2 <= 1:
                c = cv.get(x, y)
                cv.p(x, y, (int(c[0] * .78), int(c[1] * .84), int(c[2] * .82), 255))
    fx = 150
    fy = near(fx) + 6
    for x in range(fx - 10, fx + 20):                                         # 발밑 그늘
        for y in range(int(fy - 1), int(fy + 2)):
            if ((x - fx - 4) / 13) ** 2 + ((y - fy) / 1.6) ** 2 <= 1:
                c = cv.get(x, y); cv.p(x, y, (int(c[0] * .8), int(c[1] * .86), int(c[2] * .84), 255))
    fox(cv, fx, fy)
    return cv.im


def fox(cv: Canvas, x0, foot):
    """시작 몬스터 한 마리(잎 귀 여우, 왼쪽을 보고 앉음): 크림 배 · 귤빛 몸 · 잎 꼬리 · 1px 갈색 윤곽."""
    o, d, m, l, cr, lf = hx("#5a2c14"), hx("#c45a24"), hx("#e88438"), hx("#f6b25e"), hx("#fbe8c4"), hx("#5eae4c")
    mask = {}

    def blob(cx, cy, rx, ry, col_fn):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    mask[(x, y)] = col_fn(x, y, (x + .5 - cx) / rx, (y + .5 - cy) / ry)
    shade = lambda x, y, u, v: l if u + v < -.6 else m if u + v < .55 else d
    # 꼬리(잎 모양, 뒤쪽 오른쪽 위로 말림)
    for y in range(int(foot - 24), int(foot - 3)):                         # 잎 꼬리: 비스듬히 선 잎 한 장(가운데 잎맥)
        for x in range(int(x0 + 6), int(x0 + 22)):
            u = (x + .5 - (x0 + 14)) * .8 + (y + .5 - (foot - 13)) * .6
            v = -(x + .5 - (x0 + 14)) * .6 + (y + .5 - (foot - 13)) * .8
            if (u / 4.6) ** 2 + (v / 10.5) ** 2 <= 1:
                mask[(x, y)] = hx("#92cf68") if abs(u) < .7 else lf if u < 0 else hx("#3b8a3c")
    blob(x0 + 4, foot - 7, 8, 6.5, shade)                                 # 몸
    blob(x0 + 1, foot - 5, 4, 4.5, lambda x, y, u, v: cr)                 # 배
    blob(x0 - 2, foot - 16, 6, 5.2, shade)                                # 머리
    blob(x0 - 6, foot - 13, 3.2, 2.4, lambda x, y, u, v: cr)              # 주둥이
    for ex, sgn in ((-5, -1), (1, 1)):                                    # 귀(잎 귀 끝)
        for k in range(7):
            w = max(0, 3 - k * .45)
            for xx in range(int(x0 + ex + sgn * k * .4 - w), int(x0 + ex + sgn * k * .4 + w) + 1):
                mask[(xx, int(foot - 20 - k))] = lf if k > 3 else m
    for k in range(3):                                                    # 앞발
        mask[(int(x0 - 2), int(foot - k))] = m; mask[(int(x0 + 1), int(foot - k))] = d
    outline_mask(cv, mask, o)
    cv.p(x0 - 4, foot - 17, hx("#20140c")); cv.p(x0 - 4, foot - 18, hx("#ffffff"))   # 눈
    cv.p(x0 - 9, foot - 14, hx("#20140c"))                                            # 코


# ============================================================== 사막 =====
def desert() -> Image.Image:
    cv = Canvas()
    sky = [hx(c) for c in ("#3a2a6a", "#6a3a7a", "#b04a6a", "#e8784a", "#f8b05a", "#fcd88a")]
    cv.dither_v(0, 96, sky)
    # 큰 해(지평선에 반쯤) + 가로 띠 그림자
    sun_c = (64, 88)
    cv.disc(*sun_c, 22, hx("#fff0b0"))
    cv.disc(*sun_c, 19, hx("#fff8d8"))
    for k, y in enumerate((72, 78, 83, 87)):
        cv.rect(40, y, 90, y + (1 if k < 2 else 2), hx("#f8b05a"))
    # 먼 메사(평평한 바위 탁자) — 보라 실루엣
    mesa = [hx("#5a3a6a"), hx("#7a4a7a"), hx("#9a5a7a")]

    def mesa_top(x):
        for a, b, h in ((120, 168, 66), (176, 196, 74), (8, 30, 76)):
            if a <= x <= b:
                return h + (0 if a + 3 < x < b - 3 else 4 * (1 - min(x - a, b - x) / 3))
        return 90
    fill_ridge(cv, mesa_top, mesa)
    # 모래 언덕 겹 셋(먼 것은 붉고 어둡게, 가까울수록 밝은 금빛) — 바람 쪽(왼쪽)이 밝고 능선 넘어 그늘
    dunes = [
        (1, 92, ((5, 70), (2, 23)), [hx("#9a4a3a"), hx("#c46a44"), hx("#e08a54")]),
        (2, 104, ((8, 96), (3, 31)), [hx("#b8683a"), hx("#dc8c48"), hx("#f0b060")]),
        (3, 124, ((10, 140), (3, 37)), [hx("#c88040"), hx("#eaa652"), hx("#f8cc7a")]),
    ]
    for seed, base, amps, ramp in dunes:
        f = (lambda s, b, a: (lambda x: ridge(s, b, a, x)))(seed, base, amps)

        def tex(x, y, d, c, f=f, ramp=ramp):
            xs = x + d * .9                                                  # 아래로 갈수록 왼쪽 표면을 본다 — 그늘 경계가 사선(기둥이 안 선다)
            sl = f(xs + 2) - f(xs - 2)
            if sl > .35 and d < 40:
                return ramp[0] if d > 1.2 else ramp[1]                      # 능선 넘어 그늘 면
            if d > 3 and (y + int(f(x) * .5) + (x // 7)) % 6 == 0 and hh(x, y, 4) < .55:
                return ramp[0] if c == ramp[1] else ramp[1]                 # 바람 결
            return None
        fill_ridge(cv, f, ramp, tex=tex)
    # 반쯤 묻힌 유적 기둥 둘(크림 돌, 윗면 보임)
    stone = [hx("#6a4a3a"), hx("#a88a6a"), hx("#d8c49a"), hx("#f0e2bc")]
    for x, h, w in ((92, 26, 7), (106, 16, 7)):
        base = ridge(2, 104, ((8, 96), (3, 31)), x) + 2
        cv.rect(x, base - h, x + w, base, stone[1])
        cv.rect(x + 1, base - h, x + 2, base, stone[2])
        cv.rect(x + w - 1, base - h, x + w, base, stone[0])
        cv.rect(x - 1, base - h - 3, x + w + 1, base - h - 1, stone[3])
        cv.rect(x - 1, base - h - 1, x + w + 1, base - h - 1, stone[1])
        for yy in range(int(base - h), int(base), 5):
            cv.rect(x, yy, x + w, yy, stone[0])
    # 선인장 둘(왼쪽 앞)
    cac = [hx("#1e5a3a"), hx("#2e7a4a"), hx("#4a9a5a"), hx("#7ac07a")]
    for x0, h in ((22, 22), (44, 14)):
        b = ridge(3, 124, ((10, 140), (3, 37)), x0) + 3
        mask = {}
        for y in range(int(b - h), int(b) + 1):
            for x in range(x0 - 2, x0 + 3):
                mask[(x, y)] = cac[3] if x == x0 - 1 else cac[2] if x <= x0 + 1 else cac[1]
        for side, arm_y, arm_h in ((-1, b - h * .55, h * .35), (1, b - h * .7, h * .3)):
            ax = x0 + side * 5
            for x in range(min(ax, x0), max(ax, x0) + 1):
                for y in (int(arm_y), int(arm_y) + 1):
                    mask[(x, y)] = cac[2]
            for y in range(int(arm_y - arm_h), int(arm_y) + 2):
                for x in (ax - 1, ax, ax + 1):
                    mask[(x, y)] = cac[3] if x == ax - 1 else cac[2] if x == ax else cac[1]
        outline_mask(cv, mask, cac[0])
    # 주인공: 오른쪽 모래 언덕 위 큰 갑충(유적장수) — 등 껍데기 금빛 무늬 · 뿔이 빛난다
    scarab(cv, 192, ridge(3, 124, ((10, 140), (3, 37)), 192) + 1)
    # 앞 모래에 바람 흔적 점
    for k in range(40):
        x, y = int(hh(k, 31) * W), int(140 + hh(k, 32) * 20)
        cv.p(x, y, hx("#fbe0a0"))
    return cv.im


def scarab(cv: Canvas, cx, foot):
    o = hx("#2a1a2a")
    shell = [hx("#3a3a6a"), hx("#4a5aa0"), hx("#6a84c8"), hx("#9ab8ea")]
    gold = [hx("#a86a1a"), hx("#e0a838"), hx("#fce27a")]
    mask = {}
    # 다리(뒤 그늘)
    for k, (lx, ly) in enumerate(((-16, 0), (-6, 1), (6, 1), (16, 0))):
        for t in range(5):
            xx = int(cx + lx + t * (1 if lx > 0 else -1) * .4)
            mask[(xx, int(foot - 5 + t))] = hx("#2a2a4a"); mask[(xx + 1, int(foot - 5 + t))] = hx("#3a3a6a")
    # 등 껍데기(넓은 타원, 가운데 갈라진 줄)
    rx, ry, cy = 24, 13, foot - 14
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            if u * u + v * v > 1 or y > foot - 4:
                continue
            l = -(u * .6 + v * .8)
            c = shell[3] if l > .55 else shell[2] if l > .05 else shell[1] if l > -.5 else shell[0]
            if abs(x + .5 - cx) < 1 and v > -.6:
                c = shell[0]
            ring = abs(math.hypot(u * 1.0, v * 1.4) - .62) < .07 and v < .5
            if ring:
                c = gold[1] if l > 0 else gold[0]
            mask[(x, y)] = c
    # 머리 + 뿔(왼쪽, 금빛 끝이 빛남)
    for y in range(int(cy - 4), int(cy + 7)):
        for x in range(int(cx - rx - 8), int(cx - rx + 4)):
            if ((x + .5 - (cx - rx - 2)) / 7) ** 2 + ((y + .5 - (cy + 2)) / 5.5) ** 2 <= 1:
                mask[(x, y)] = shell[1] if y > cy + 2 else shell[2]
    for k in range(14):
        x = int(cx - rx - 6 - k * .8); y = int(cy - k * .9 + (k * k) * .02)
        for w in range(3 if k < 5 else 2 if k < 11 else 1):
            mask[(x, y + w)] = gold[2] if k > 10 else gold[1] if k > 4 else gold[0]
    outline_mask(cv, mask, o)
    cv.p(cx - rx - 4, cy + 1, hx("#fce27a"))                                   # 눈 빛
    for r, col in ((3.5, gold[2]),):                                            # 뿔 끝 빛무리
        tip = (cx - rx - 17, cy - 13)
        for y in range(int(tip[1] - 5), int(tip[1] + 6)):
            for x in range(int(tip[0] - 5), int(tip[0] + 6)):
                d = math.hypot(x - tip[0], y - tip[1])
                if d < 1.2:
                    cv.p(x, y, hx("#ffffff"))
                elif d < r and (x == tip[0] or y == tip[1]):
                    cv.p(x, y, col)


# ================================================================ 눈 =====
def snow() -> Image.Image:
    cv = Canvas()
    sky = [hx(c) for c in ("#0c1430", "#142048", "#1c3060", "#2a4a7a", "#3a6a92")]
    cv.dither_v(0, 104, sky)
    # 별
    for k in range(70):
        x, y = int(hh(k, 41) * W), int(hh(k, 42) * 70)
        cv.p(x, y, hx("#ffffff") if k % 5 == 0 else hx("#b8c8f0"))
        if k % 11 == 0:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                cv.p(x + dx, y + dy, hx("#6a84c0"))
    # 오로라 띠 두 줄(초록·청록, 세로 줄무늬로 흔들림)
    au = [hx("#2a7a6a"), hx("#3aa88a"), hx("#6ae0b0"), hx("#b8fcd8")]
    for band, (y0, amp, ph, span) in enumerate(((22, 9, 0.0, (40, 236)), (38, 7, 1.7, (90, 230)))):
        for x in range(*span):
            cy = y0 + amp * math.sin(x / 34 + ph) + 3 * math.sin(x / 11 + ph * 2)
            fade = min(1, (x - span[0]) / 30, (span[1] - x) / 30)
            hgt = int((9 + 3 * math.sin(x / 17 + ph)) * fade)
            for k in range(hgt):
                y = int(cy + k)
                t = k / max(1, hgt)
                if t > .6 and (t - .6) * 40 > BAYER[y % 4][x % 4]:
                    continue                                                   # 아래로 디더 페이드
                c = au[3] if t < .12 else au[2] if t < .35 else au[1] if t < .7 else au[0]
                if t < .5 and (x // 2) % 3 == 0:
                    c = au[min(3, au.index(c) + 1)]                           # 위쪽 빛줄(세로 결)
                cv.p(x, y, c)
    # 달
    cv.disc(52, 30, 11, hx("#f4f6ff"))
    cv.disc(48, 28, 3, hx("#d8dcf0")); cv.disc(56, 35, 2, hx("#d8dcf0")); cv.disc(55, 24, 1.5, hx("#e4e8f8"))
    # 먼 눈 산(윗면 흰 눈 · 빛 반대쪽 푸른 그늘)
    mtn = lambda x: ridge(5, 86, ((12, 130), (6, 47), (2, 17)), x)
    snow_r = [hx("#5a7aa8"), hx("#9ab8d8"), hx("#e8f2ff")]

    def mtex(x, y, d, c):
        sl = mtn(x + 1) - mtn(x - 1)
        if d < 10 + 4 * math.sin(x / 5):
            return snow_r[2] if sl < 0 else snow_r[1]
        return hx("#3a4a78") if sl > 0 else hx("#4a5e8a")
    fill_ridge(cv, mtn, snow_r, tex=mtex)
    # 가까운 눈밭(흰 바탕 + 푸른 그늘 결) — 오른쪽 언덕이 솟는다
    near = lambda x: 118 - 16 * math.exp(-((x - 196) / 46) ** 2) + 3 * math.sin(x / 23)
    sn = [hx("#8aa8d0"), hx("#c8daf0"), hx("#f4f8ff")]

    def stex(x, y, d, c):
        if d > 2 and (int(y * 1.0 + 5 * math.sin(x / 13)) % 9 == 0) and hh(x, y, 8) < .6:
            return sn[1]
        if d > 2 and hh(x, y, 9) < .04:
            return sn[0]
        return sn[2] if d > 1.2 else None
    fill_ridge(cv, near, sn, tex=stex)
    # 전나무 숲(왼쪽 앞·가운데)
    pr = [hx("#163a3a"), hx("#1e5a4a"), hx("#2e7a5a")]
    sr = [hx("#c8daf0"), hx("#ffffff")]
    for k, (x, h) in enumerate(((8, 40), (24, 30), (40, 44), (60, 26), (118, 22), (132, 30))):
        pine(cv, x, near(x) + 3, h, pr, sr, hx("#0c2428"), hx("#3a2418"))
    # 작은 마을 불빛(눈 덮인 지붕 집 둘)
    for x in (82, 98):
        y = near(x) + 1
        cv.rect(x - 6, y - 7, x + 6, y, hx("#8a5a3a"))
        cv.rect(x - 6, y, x + 6, y, hx("#5a3a2a"))
        cv.poly([(x - 8, y - 7), (x, y - 14), (x + 8, y - 7)], hx("#f4f8ff"))
        for xx in range(x - 8, x + 9):
            cv.p(xx, y - 7, hx("#9ab8d8"))
        cv.rect(x - 2, y - 4, x, y - 2, hx("#fcd86a")); cv.p(x - 2, y - 4, hx("#fff4c0"))
    # 주인공: 오른쪽 언덕 위를 나는 설월학 — 넓은 날개, 흰 몸, 푸른 끝
    crane(cv, 184, 74)
    return cv.im


def crane(cv: Canvas, cx, cy):
    """설월학(왼쪽으로 날아감, 날개를 위로 들었다): 다각형 날개 둘(뒷날개 어둡게) · 첫째 깃 끝 푸름 · 깃 홈 · 흰 몸 · 앞으로 뻗은 목 · 붉은 정수리 · 뒤로 뻗은 다리."""
    o = hx("#18284a")
    w = [hx("#7a9ac8"), hx("#b8d0f0"), hx("#eef4ff"), hx("#ffffff")]
    tip = [hx("#2a4a8a"), hx("#4a6aaa")]
    mask = {}

    def poly_mask(pts):
        cvm = {}
        ys = [q[1] for q in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if (ay <= y + .5 < by) or (by <= y + .5 < ay):
                    xs.append(ax + (y + .5 - ay) * (bx - ax) / (by - ay))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))):
                    cvm[(x, y)] = True
        return cvm

    def wing(pts, lead, tone, tip_x):
        """pts: 날개 다각형, lead: 앞전 직선(두 점) — 앞전에서 멀수록 어둡다. tip_x 보다 바깥(끝)은 첫째 깃."""
        (ax, ay), (bx, by) = lead
        L = math.hypot(bx - ax, by - ay)
        for (x, y) in poly_mask(pts):
            dist = abs((bx - ax) * (ay - y - .5) - (ax - x - .5) * (by - ay)) / L
            c = w[tone + 1] if dist < 2 else w[tone] if dist < 6 else w[tone - 1]
            outer = (x - tip_x) * (1 if tip_x > cx else -1) > 0
            if outer and dist > 2.5:
                c = tip[1] if dist < 6 else tip[0]
                if (x + y) % 5 == 0:
                    continue                                                   # 첫째 깃 사이 홈
            mask[(x, y)] = c
    # 뒷날개: 몸 뒤에서 위·오른쪽으로
    wing([(cx + 2, cy - 3), (cx + 38, cy - 38), (cx + 41, cy - 27), (cx + 31, cy - 15), (cx + 16, cy + 1)],
         ((cx + 2, cy - 3), (cx + 38, cy - 38)), 1, cx + 27)
    for y in range(int(cy - 7), int(cy + 8)):                                  # 몸
        for x in range(int(cx - 14), int(cx + 15)):
            if ((x + .5 - cx) / 14) ** 2 + ((y + .5 - cy) / 6.5) ** 2 <= 1:
                mask[(x, y)] = w[3] if y < cy - 1 else w[2] if y < cy + 2 else w[1]
    # 앞날개: 몸 위에서 위·왼쪽으로 크게
    wing([(cx + 4, cy - 4), (cx - 22, cy - 46), (cx - 9, cy - 39), (cx + 3, cy - 26), (cx + 13, cy - 1)],
         ((cx + 4, cy - 4), (cx - 22, cy - 46)), 2, cx - 11)
    for k in range(15):                                                        # 목(왼쪽 앞으로 곧게)
        x, y = int(cx - 12 - k), int(cy - 2 - k * .25)
        for dy in range(4):
            mask[(x, y + dy - 1)] = w[3] if dy < 2 else w[2]
    hxc, hyc = int(cx - 29), int(cy - 5)
    for y in range(hyc - 4, hyc + 4):
        for x in range(hxc - 4, hxc + 5):
            if (x + .5 - hxc) ** 2 + (y + .5 - hyc) ** 2 <= 12:
                mask[(x, y)] = w[3]
    for k in range(16):
        mask[(int(cx + 13 + k), int(cy + 2 + k * .15))] = hx("#5a6a8a")        # 다리
    outline_mask(cv, mask, o)
    for x in range(hxc - 1, hxc + 2):
        cv.p(x, hyc - 3, hx("#d84848")); cv.p(x, hyc - 2, hx("#d84848"))     # 붉은 정수리
    cv.p(hxc + 2, hyc - 1, hx("#c8daf0"))
    for k in range(7):
        cv.p(hxc - 4 - k, hyc + (1 if k > 3 else 0), hx("#e0a838"))           # 부리(윤곽 뒤에 찍는다 — 1px 이라 윤곽에 먹힌다)
    cv.p(hxc - 1, hyc, hx("#18284a"))


THEMES = {
    "meadow": (meadow, "oprn_emerald_title_meadow", "별빛섬 · 풀잎 언덕의 아침"),
    "desert": (desert, "oprn_emerald_title_desert", "별빛섬 · 유리모래 사막의 노을"),
    "snow": (snow, "oprn_emerald_title_snow", "별빛섬 · 서리꽃 고개의 오로라"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/assets/emerald-monster")
    ap.add_argument("--preview", default=None, help="3배 미리보기를 이 폴더에 쓴다")
    ap.add_argument("--only", default=None)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for key, (fn, aid, name) in THEMES.items():
        if a.only and key != a.only:
            continue
        im = fn().convert("RGB")
        buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
        data = buf.getvalue()
        (out / f"title-{key}.png").write_bytes(data)
        asset = {"id": aid, "name": name, "kind": "picture",
                 "dataUrl": "data:image/png;base64," + base64.b64encode(data).decode(),
                 "meta": {"width": W, "height": H}}
        (out / f"title-{key}-asset.json").write_text(json.dumps(asset, ensure_ascii=False))
        colours = len(im.getcolors(65536) or [])
        print(f"{key}: {W}x{H} {len(data)}B colours={colours} sha256={hashlib.sha256(data).hexdigest()[:16]}")
        if a.preview:
            Path(a.preview).mkdir(parents=True, exist_ok=True)
            im.resize((W * 3, H * 3), Image.NEAREST).save(Path(a.preview) / f"title-{key}-3x.png")


if __name__ == "__main__":
    main()
