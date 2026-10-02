"""초가 지붕 — 사용자 지정 기준(~/third-party-assets/baram/thatch2.png): 어두운 갈색 짚이 두툼한 방석 세 단으로 쌓인다.

기준에서 읽은 것:
 - 색은 채도 낮은 어두운 갈색 하나(주황 아님). 톤 폭이 좁다(램프 6단 중 중간 3단이 대부분).
 - 형태: 위쪽 좁고 낮은 뒷단(등마루) → 넓은 몸통 단 → 가장 넓고 불룩한 아랫단(처마 말림). 알약처럼 둥근 가로로 긴 덩어리.
 - 결: 가늘고 긴 세로 짚 가닥이 털처럼 빽빽, 단 경계에 얕은 가로 골. 위 모서리에 은은한 하이라이트, 아랫단은 어둡다.
"""
import math
from tk import *

# 허용 색 안에서 고른 갈색 램프(어두움 → 밝음)
BR = [(58, 42, 32), (84, 55, 25), (116, 76, 42), (136, 90, 38), (162, 110, 54), (174, 124, 80)]


def _prof(t):
    """세로 위치 t(0 위 .. 1 아래)에서의 반폭 비율: 뒷단 좁게 → 몸통 → 아랫단 가장 넓게."""
    pts = [(0.00, 0.56), (0.10, 0.70), (0.22, 0.86), (0.36, 0.95), (0.58, 0.99), (0.74, 1.00), (1.00, 0.74)]
    for (a, wa), (b, wb) in zip(pts, pts[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            k = k * k * (3 - 2 * k)
            return wa + (wb - wa) * k
    return pts[-1][1]


def dome(W, H, seed=0, squash=1.0):
    cv = Cv(W, H)
    cx = (W - 1) / 2.0
    # 가닥: 열마다 길이 5~10 짜리 조각으로 끊어 톤을 흔든다
    ln = [5 + int(rnd(x, 5, seed + 1) * 6) for x in range(W)]
    off = [int(rnd(x, 6, seed + 2) * 9) for x in range(W)]
    for y in range(H):
        t = y / max(1.0, H - 1)
        hw = (W / 2.0 - 0.5) * _prof(t)
        # 위·아래 끝은 둥글게(알약): 가장자리 행은 폭을 줄인다
        edge = min(y, H - 1 - y)
        er = (0.62, 0.78, 0.88, 0.94, 0.98) if y < H / 2 else (0.40, 0.62, 0.76, 0.85, 0.91, 0.95, 0.98)
        if edge < len(er):
            hw *= er[edge]
        for x in range(W):
            dx = x - cx
            if abs(dx) > hw:
                continue
            u = dx / max(1.0, hw)                              # -1..1
            # 단 구분
            tier = 0 if t < 0.20 else (1 if t < 0.64 else 2)
            base = (2.3, 3.5, 2.5)[tier]
            # 빛: 왼쪽 위가 살짝 밝다
            base += -0.55 * u * (1 if tier == 1 else 0.6) + (0.35 if t < 0.30 else 0.0) - 0.25 * (t if tier else 0)
            if tier == 2:
                base -= 0.25 + 0.55 * (t - 0.64) / 0.36          # 아랫단은 아래로 갈수록 어둡다
            # 세로 가닥 결
            run = (y + off[x]) // ln[x]
            j = rnd(x, run, seed + 7)
            base += 0.9 if j > 0.80 else (-0.7 if j < 0.16 else (0.35 if j > 0.58 else 0.0))
            if x % 3 == 0:
                base -= 0.25                                   # 가닥 사이 어두운 틈
            # 단 경계의 얕은 가로 골(살짝 휘어진 선)
            for tb, wd in ((0.20, 0.03), (0.64, 0.035)):
                curve = 0.018 * (1 - u * u)
                if abs(t - (tb + curve)) < wd:
                    base -= 0.55
            # 가장자리 털: 윤곽 1px 안쪽은 어둡게, 불규칙하게 삐져나온 가닥은 밝게 한두 개
            if abs(dx) > hw - 1.2:
                base -= 0.8
            tone = int(round(base))
            cv.put(x, y, BR[max(0, min(5, tone))])
    # 윗단 하이라이트 띠(은은하게): 몸통 단 위 모서리에 밝은 가닥 몇 개
    for x in range(int(cx - W * 0.30), int(cx + W * 0.18)):
        if rnd(x, 3, seed + 9) < 0.35:
            y0 = int(H * 0.24)
            if cv.a[y0, x, 3]:
                cv.put(x, y0, BR[4])
    return cv


def dome2(W, H, seed=0):
    """초가 지붕 v2 — 바람의나라 초가(thatch.png·thatch2.png)처럼 낮고 넓은 둥근 모서리 방석.
    위는 거의 평평하고 밝으며 아래로 갈수록 어둡다. 가는 세로 짚 가닥(톤 ±1)과 단 사이 얕은 골, 아래 처마는 짚 끝이 들쭉날쭉 늘어진다."""
    cv = Cv(W, H)
    cx = (W - 1) / 2.0
    r = H * 0.62                                    # 모서리 둥글기
    ln = [6 + int(rnd(x, 5, seed + 1) * 8) for x in range(W)]
    off = [int(rnd(x, 6, seed + 2) * 12) for x in range(W)]
    fr = [int(rnd(x // 2, 8, seed + 3) * 4) for x in range(W)]       # 아래 처마 짚 끝 길이 편차
    for y in range(H):
        t = y / max(1.0, H - 1)
        dy = min(y, H - 1 - y)
        yc = (y + 0.5) / H * 2 - 1                  # -1(위) .. 1(아래)
        n = 2.5 if yc < 0 else 3.4                  # 위는 둥글게, 아래는 네모에 가깝게
        hw = (W / 2.0) * (1 - abs(yc) ** n) ** (1.0 / n) if abs(yc) < 1 else 0
        hw = min(hw, W / 2.0 - 0.5)
        for x in range(W):
            dx = x - cx
            if abs(dx) > hw:
                continue
            u = dx / max(1.0, W / 2.0)
            # 아래 처마는 가운데가 조금 더 처지고 끝이 들쭉날쭉
            low = H - 1 - 2.0 * u * u - fr[x] * (1 if y > H - 6 else 0)
            if y > low:
                continue
            base = 3.9 - 1.5 * t                       # 위 밝음 → 아래 어두움
            base += -0.45 * u                          # 빛은 왼쪽 위
            for tb in (0.36, 0.68):                    # 방석 세 단의 경계: 어두운 골 + 바로 아래 밝은 입술
                curve = 0.03 * (1 - u * u)
                d = t - (tb + curve)
                if -0.03 < d < 0.0: base -= 0.6
                elif 0.0 <= d < 0.04: base += 0.3
            run = (y + off[x]) // ln[x]
            j = rnd(x, run, seed + 7)
            base += 0.95 if j > 0.74 else (-0.8 if j < 0.2 else (0.4 if j > 0.55 else 0.0))
            if x % 2 == 0: base -= 0.35                 # 가닥 사이 틈
            if abs(dx) > hw - 1.0 or y == 0: base -= 0.45
            if y > H - 3: base -= 0.5
            cv.put(x, y, BR[max(0, min(5, int(round(base))))])
    return cv
