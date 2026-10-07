#!/usr/bin/env python3
"""에메랄드 전투 배경 6갈래를 코드 도트로 그린다(생성 이미지 아님).

출력: public/assets/emerald-monster/battle/<갈래>.png — 240×120 원본(GBA 화면 위 120줄, 아래 40줄은 문장 창).
런타임은 2배(480×240)로 pixelated 확대한다. 발판은 그림이 아니라 CSS(emeraldSurfaces.css)가 같은 팔레트로 그린다.
재실행: python3 scripts/content/emerald/draw-battle-backgrounds.py
"""
from pathlib import Path
import math
from PIL import Image

W, H = 240, 120
OUT = Path(__file__).resolve().parents[3] / "public/assets/emerald-monster/battle"


def hexc(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (W, H))
        self.px = self.img.load()

    def put(self, x, y, color):
        if 0 <= x < W and 0 <= y < H:
            self.px[x, y] = hexc(color) if isinstance(color, str) else color

    def rect(self, x0, y0, x1, y1, color):
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                self.put(x, y, color)

    def bands(self, y0, y1, colors):
        """위에서 아래로 같은 두께의 색 띠. 띠 사이는 한 줄 체크 디더로 잇는다."""
        n = len(colors)
        step = (y1 - y0) / n
        for y in range(y0, y1):
            i = min(n - 1, int((y - y0) / step))
            for x in range(W):
                c = colors[i]
                edge = y0 + (i + 1) * step
                if i + 1 < n and edge - y <= 1 and (x + y) % 2 == 0:
                    c = colors[i + 1]
                self.put(x, y, c)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.img.save(OUT / f"{name}.png")


def ground_stripes(cv, y0, base, stripe, accent=None, spacing=(3, 4, 5, 7, 9, 12)):
    """원근 줄무늬 바닥 — 아래로 갈수록 줄 사이가 넓어진다(GBA 바닥 줄 문법)."""
    cv.rect(0, y0, W, H, base)
    y = y0 + 2
    k = 0
    while y < H:
        for x in range(W):
            if (x // 2 + k) % 3 != 2:
                cv.put(x, y, stripe)
        if accent and k % 2 == 1:
            for x in range(k * 7 % 11, W, 23):
                cv.put(x, y - 1, accent)
                cv.put(x + 1, y - 1, accent)
        y += spacing[min(k, len(spacing) - 1)]
        k += 1


def blob_row(cv, base_y, radius, spread, colors, seed, height_jitter=3):
    """동그란 수관 줄(나무 실루엣). colors = (그늘, 몸, 밝은 테)."""
    shade, body, light = colors
    x = -radius
    i = seed
    while x < W + radius:
        r = radius - (i * 7 % 3)
        cy = base_y - r + (i * 5 % height_jitter)
        for yy in range(cy - r, base_y + 1):
            for xx in range(x - r, x + r + 1):
                d = (xx - x) ** 2 + (yy - cy) ** 2
                if yy > cy or d <= r * r:
                    lit = (xx - x) < 0 and (yy - cy) < -r // 3 and d >= (r - 2) ** 2
                    under = yy > base_y - 3
                    cv.put(xx, yy, light if lit else shade if under else body)
        x += spread + (i * 3 % 4)
        i += 1


def grass():
    cv = Canvas()
    cv.rect(0, 0, W, 48, "#e8f0c8")
    cv.bands(0, 34, ["#f8f8e8", "#f0f8d8", "#e8f0c8"])
    blob_row(cv, 40, 9, 13, ("#4c8848", "#68a858", "#90c878"), 1, 4)
    blob_row(cv, 44, 7, 11, ("#3c7038", "#58985a", "#80c070"), 4, 3)
    cv.rect(0, 44, W, 46, "#3c7038")
    ground_stripes(cv, 46, "#d8f0a8", "#c8e494", "#b8d880")
    return cv


def sand():
    cv = Canvas()
    cv.rect(0, 0, W, 48, "#f0dcb0")
    cv.bands(0, 30, ["#f8f0e0", "#f8e8c8", "#f0dcb0"])
    # 먼 모래 언덕 두 겹 — 부드러운 사인 능선, 해 그림자는 오른쪽.
    for layer, (base, amp, period, phase, body, shade, light) in enumerate([
        (36, 6, 70, 0.4, "#e8c890", "#d0a868", "#f8e0b0"),
        (44, 5, 54, 1.9, "#e0b878", "#c89858", "#f0d8a0"),
    ]):
        for x in range(W):
            top = int(base - amp * (0.5 + 0.5 * math.sin(x / period * 2 * math.pi + phase)))
            slope = math.cos(x / period * 2 * math.pi + phase)
            for y in range(top, 48):
                c = body
                if y == top:
                    c = light if slope > 0 else shade
                elif slope < -0.35 and (x + y) % 2 == 0:
                    c = shade
                cv.put(x, y, c)
    cv.rect(0, 46, W, 48, "#c89858")
    ground_stripes(cv, 48, "#f0e0b0", "#e8d098", "#d8bc80")
    return cv


def snow():
    cv = Canvas()
    cv.rect(0, 0, W, 48, "#c8e0f0")
    cv.bands(0, 34, ["#e8f4f8", "#d8ecf8", "#c8e0f0"])
    # 눈 덮인 산 — 삼각 봉우리, 눈 모자, 왼쪽 빛.
    peaks = [(18, 14, 30), (64, 8, 38), (112, 16, 28), (158, 6, 40), (210, 12, 32), (250, 10, 34)]
    for px, top, half in peaks:
        for y in range(top, 46):
            w = int((y - top) / (46 - top) * half)
            for x in range(px - w, px + w + 1):
                capline = top + (46 - top) * 0.38 + ((x * 3) % 5) - 2
                if y < capline:
                    c = "#f8f8f8" if x <= px else "#dde8f0"
                else:
                    c = "#a8b8d0" if x <= px else "#8898b8"
                cv.put(x, y, c)
    cv.rect(0, 44, W, 47, "#c0d4e8")
    ground_stripes(cv, 47, "#f0f8f8", "#e0ecf4", "#d0e0f0")
    return cv


def water():
    cv = Canvas()
    cv.rect(0, 0, W, 40, "#c8e8f8")
    cv.bands(0, 30, ["#e8f8f8", "#d8f0f8", "#c8e8f8"])
    # 먼 섬 한두 개.
    for cx, w, h in [(46, 22, 6), (178, 30, 8)]:
        for y in range(30 - h, 31):
            half = int(w * (1 - ((30 - y) / h) ** 2) ** 0.5)
            for x in range(cx - half, cx + half + 1):
                cv.put(x, y, "#78a868" if y < 30 - h // 2 else "#5c8c58")
    cv.bands(30, 40, ["#98d0f0", "#88c4e8"])
    cv.rect(0, 40, W, H, "#70b4e0")
    # 물결 대시 — 아래로 갈수록 길고 성기게.
    y, k = 42, 0
    while y < H:
        length = 3 + k
        gap = 9 + k * 2
        offset = (k * 13) % gap
        for x in range(offset, W, gap + length):
            for dx in range(length):
                cv.put(x + dx, y, "#b0e0f8")
            cv.put(x + length // 2, y + 1, "#5098d0")
        y += 4 + k
        k += 1
    return cv


def cave():
    cv = Canvas()
    cv.rect(0, 0, W, 48, "#584038")
    # 뒷벽 바위 결 — 가로 층과 어두운 틈.
    for y in range(4, 46, 7):
        for x in range(W):
            if (x + y * 3) % 29 < 22:
                cv.put(x, y, "#6c5244")
    for x in range(0, W, 17):
        for y in range(0, 46):
            if (x * 7 + y) % 13 < 2:
                cv.put(x + (y // 9) % 3, y, "#403028")
    # 종유석.
    for x in range(6, W, 19):
        length = 6 + (x * 5) % 11
        for y in range(length):
            half = max(0, (length - y) // 4)
            for dx in range(-half, half + 1):
                cv.put(x + dx, y, "#7a6050" if dx <= 0 else "#4c3830")
    cv.rect(0, 44, W, 48, "#403028")
    ground_stripes(cv, 48, "#a08870", "#907860", "#b8a088")
    return cv


def indoor():
    cv = Canvas()
    cv.rect(0, 0, W, 46, "#e8e0d0")
    # 벽 판넬: 세로 몰딩과 위 띠.
    cv.rect(0, 0, W, 6, "#c8b8a0")
    cv.rect(0, 6, W, 7, "#a89878")
    for x in range(10, W, 40):
        cv.rect(x, 12, x + 30, 38, "#f0e8d8")
        cv.rect(x, 12, x + 30, 13, "#c8c0b0")
        cv.rect(x, 12, x + 1, 38, "#c8c0b0")
        cv.rect(x + 29, 13, x + 30, 38, "#fffff0")
        cv.rect(x, 37, x + 30, 38, "#fffff0")
    cv.rect(0, 42, W, 44, "#a89878")
    cv.rect(0, 44, W, 46, "#887858")
    # 바닥 타일 — 원근 줄 + 세로 줄눈.
    cv.rect(0, 46, W, H, "#d8d0c0")
    y, k = 48, 0
    while y < H:
        for x in range(W):
            cv.put(x, y, "#c0b8a8")
        y += 4 + k * 2
        k += 1
    for x0 in range(-200, W + 200, 24):
        for y in range(46, H):
            x = int(W / 2 + (x0 - W / 2) * (1 + (y - 46) / 40))
            cv.put(x, y, "#c8c0b0")
    return cv


if __name__ == "__main__":
    for name, draw in [("grass", grass), ("sand", sand), ("snow", snow), ("water", water), ("cave", cave), ("indoor", indoor)]:
        draw().save(name)
        print("wrote", OUT / f"{name}.png")
