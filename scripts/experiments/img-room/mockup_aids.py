#!/usr/bin/env python3
"""조건 V 보조 자료(코드 분석 — 조수에게 «보조»로만 준다, 맵은 조수가 깐다):
  python3 mockup_aids.py <prep dir> <task>     (repo 루트에서)
  1) 목업의 타일 격자(칸 크기·시작점)를 화소 경계의 주기(푸리에, 36~58px)로 찾는다 — GPT 그림은 칸이 정확히 맞지 않아 대략이다.
  2) mockup-native.png: 칸마다 16×16 으로 줄인 목업(맵 그림과 같은 칸 크기).
  3) mockup-grid.png: native ×3 에 칸 선·칸 좌표(x 위, y 왼쪽)를 그린 그림 — 조수에게 붙이는 보조 그림.
  4) cells.json: 칸 분류(void/floor/wall, 칩셋 바닥·벽 견본과의 최근접 — 대략), 글 칸 지도(cells.txt).
  5) grid-overlay.png: 원본 목업 위에 찾은 격자를 그린 그림(사람 확인용).
판정은 하지 않는다 — 계산 지표(fidelity.py)와 보조 자료가 같은 분류기를 쓴다."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cellclass import Classifier, T

PREP, TASK = sys.argv[1], sys.argv[2]
try: FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
except Exception: FONT = ImageFont.load_default()

def fourier(sig, period):
    x = np.arange(len(sig)); z = np.sum((sig - sig.mean()) * np.exp(-2j * np.pi * x / period)) / np.sqrt(len(sig))
    return abs(z), float((-np.angle(z) / (2 * np.pi) * period) % period)

def grid(gx, gy, lo=36.0, hi=58.0):
    """칸 경계의 화소 튐 — x·y 경사 합의 푸리에 세기가 [lo,hi] 에서 가장 큰 주기(두 축 공통). 위상 = 그 주기 성분의 각."""
    gx = gx / gx.mean(); gy = gy / gy.mean()
    ps = np.arange(lo, hi, 0.1)
    sx = np.array([fourier(gx, p)[0] for p in ps]); sy = np.array([fourier(gy, p)[0] for p in ps])
    tot = sx / sx.mean() + sy / sy.mean(); s = float(ps[int(np.argmax(tot))])
    return s, fourier(gx, s)[1], fourier(gy, s)[1], float(tot.max())

def main():
    im = Image.open(f"{PREP}/mockup.png").convert("RGB"); a = np.asarray(im).astype(np.float32)
    g = a.mean(axis=2)
    gx = np.abs(np.diff(g, axis=1)).sum(axis=0); gy = np.abs(np.diff(g, axis=0)).sum(axis=1)
    s, px, py, strength = grid(gx, gy)
    W = int((im.width - px) // s); H = int((im.height - py) // s)
    native = Image.new("RGB", (W * T, H * T))
    for y in range(H):
        for x in range(W):
            box = (px + x * s, py + y * s, px + (x + 1) * s, py + (y + 1) * s)
            native.paste(im.crop(tuple(int(round(b)) for b in box)).resize((T, T), Image.BOX), (x * T, y * T))
    native.save(f"{PREP}/mockup-native.png")
    clf = Classifier(TASK)
    cls = clf.classify(native)
    # 바깥 void 를 잘라 내기 — 내용이 있는 칸의 경계 상자(1칸 여유)
    ys, xs = np.nonzero(cls != 0)
    x0, x1, y0, y1 = max(0, xs.min() - 1), min(W - 1, xs.max() + 1), max(0, ys.min() - 1), min(H - 1, ys.max() + 1)
    crop = native.crop((x0 * T, y0 * T, (x1 + 1) * T, (y1 + 1) * T)); crop.save(f"{PREP}/mockup-native.png")
    cls = cls[y0:y1 + 1, x0:x1 + 1]; W, H = x1 - x0 + 1, y1 - y0 + 1
    # 보조 그림: ×3, 칸 선, 좌표
    k, m = 3, 18
    big = crop.resize((W * T * k, H * T * k), Image.NEAREST)
    aid = Image.new("RGB", (big.width + m, big.height + m), (20, 20, 24)); aid.paste(big, (m, m)); d = ImageDraw.Draw(aid)
    for x in range(W + 1):
        X = m + x * T * k; d.line([(X, m), (X, aid.height)], fill=(255, 255, 255) if x % 5 == 0 else (150, 150, 150), width=1)
        if x < W: d.text((X + 3, 3), str(x), fill=(255, 230, 120) if x % 5 == 0 else (200, 200, 200), font=FONT)
    for y in range(H + 1):
        Y = m + y * T * k; d.line([(m, Y), (aid.width, Y)], fill=(255, 255, 255) if y % 5 == 0 else (150, 150, 150), width=1)
        if y < H: d.text((1, Y + 3), str(y), fill=(255, 230, 120) if y % 5 == 0 else (200, 200, 200), font=FONT)
    aid.save(f"{PREP}/mockup-grid.png")
    # 사람 확인용: 원본 위 격자
    ov = im.copy(); d = ImageDraw.Draw(ov)
    for x in range(int((im.width - px) // s) + 1): X = px + x * s; d.line([(X, 0), (X, im.height)], fill=(0, 255, 200), width=1)
    for y in range(int((im.height - py) // s) + 1): Y = py + y * s; d.line([(0, Y), (im.width, Y)], fill=(0, 255, 200), width=1)
    ov.save(f"{PREP}/grid-overlay.png")
    ch = {0: " ", 1: ".", 2: "#"}
    rows = ["    " + "".join(str(x % 10) for x in range(W))] + [f"{y:>3} " + "".join(ch[int(c)] for c in row) for y, row in enumerate(cls)]
    open(f"{PREP}/cells.txt", "w").write("\n".join(rows) + "\n")
    json.dump({"cellPx": s, "phase": [px, py], "crop": [int(x0), int(y0)], "w": int(W), "h": int(H), "strength": strength,
               "cells": ["".join(ch[int(c)] for c in row) for row in cls]}, open(f"{PREP}/cells.json", "w"), indent=1)
    print(json.dumps({"cellPx": round(s, 2), "phase": [round(px, 1), round(py, 1)], "w": int(W), "h": int(H)}))

if __name__ == "__main__":
    main()
