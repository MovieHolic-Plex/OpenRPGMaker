"""초가 지붕 — 사용자 지정 기준(~/third-party-assets/baram/thatch2.png): 어두운 갈색 짚이 두툼한 방석 세 단으로 쌓인다.

기준에서 읽은 것:
 - 색은 채도 낮은 어두운 갈색 하나(주황 아님). 톤 폭이 좁다(램프 6단 중 중간 3단이 대부분).
 - 형태: 위쪽 좁고 낮은 뒷단(등마루) → 넓은 몸통 단 → 가장 넓고 불룩한 아랫단(처마 말림). 알약처럼 둥근 가로로 긴 덩어리.
 - 결: 가늘고 긴 세로 짚 가닥이 털처럼 빽빽, 단 경계에 얕은 가로 골. 위 모서리에 은은한 하이라이트, 아랫단은 어둡다.
"""
import math
from tk import *

# 허용 색 안에서 고른 갈색 램프(어두움 → 밝음)
BR = list(RGB['thatch8'][:6])


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
    ln = [3 + int(rnd(x, 5, seed + 1) * 6) for x in range(W)]
    off = [int(rnd(x, 6, seed + 2) * 12) for x in range(W)]
    fr = [int(rnd(x // 2, 8, seed + 3) * 4) for x in range(W)]       # 아래 처마 짚 끝 길이 편차
    for y in range(H):
        t = y / max(1.0, H - 1)
        dy = min(y, H - 1 - y)
        yc = (y + 0.5) / H * 2 - 1                  # -1(위) .. 1(아래)
        n = 2.1 if yc < 0 else 2.7                  # 어깨를 둥글게(윗 평탄부를 줄인다)
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
            if y >= H - 2 and rnd(x, y, seed + 11) < 0.35:
                continue                              # 짚 끝이 들쭉날쭉
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
            if t > 0.74: base -= 0.7                   # 아래 앞사면은 한 톤 어둡다(처마 안쪽 그늘)
            if abs(u) < 0.6 and y in (3, 4): base -= 0.7   # 용마름: 마루를 덮은 어두운 띠 + 위 밝은 줄
            if abs(u) < 0.6 and y in (1, 2): base += 0.4
            cv.put(x, y, BR[max(0, min(5, int(round(base))))])
    return cv


# 바람의나라 초가 색: 허용 팔레트 안의 주황 갈색 램프(어두움 → 밝음)
BR2 = list(RGB['thatch8'])


def dome3(W, H, seed=0):
    """초가 지붕 v3 — 바람의나라 초가의 '쌓은 방석' 구조.
    윗단(좁음) · 가운뎃단 · 아랫단(가장 넓고 불룩)이 계단식으로 겹치고, 단마다 위가 밝고 아래가 어둡다.
    위 단이 아래 단 위로 드리워 그 밑에 짙은 그늘 띠가 지고, 단 아랫가장자리는 긴 짚 가닥이 털처럼 늘어진다.
    결: 4~9px 긴 세로 짚 가닥, 밝은 가닥과 어두운 틈이 뚜렷."""
    cv = Cv(W, H)
    cx = (W - 1) / 2.0
    tiers = [  # (y0, y1, 폭 비율) — 아래부터 그린다
        (int(H * 0.50), H, 1.00),
        (int(H * 0.18), int(H * 0.68), 0.96),
        (0, int(H * 0.36), 0.86),
    ]
    ln = [4 + int(rnd(x, 5, seed + 1) * 6) for x in range(W)]
    off = [int(rnd(x, 6, seed + 2) * 11) for x in range(W)]
    fr = [int(rnd(x, 8, seed + 3) * 4) for x in range(W)]
    owner = [[-1] * W for _ in range(H)]
    for ti, (y0, y1, wf) in enumerate(tiers):
        hb = y1 - y0
        wb = W * wf
        for x in range(W):
            u = (x - cx) / (wb / 2.0)
            if abs(u) > 1: continue
            # 단의 위·아래 경계(슈퍼타원): 가운데가 가장 불룩
            k = (1 - abs(u) ** 2.6) ** (1 / 2.6)
            top = y0 + (1 - k) * hb * 0.55
            bot = y1 - 1 - (1 - k) * hb * (0.45 if ti == 0 else 0.30)
            bot_f = bot + fr[x] * (0.0 if ti == 0 else 0.8) + (0 if ti == 0 else 1)
            for y in range(int(round(top)), min(H, int(round(bot_f)) + 1)):
                if ti == 0 and y >= H - 2 and rnd(x, y, seed + 11) < 0.35:
                    continue                                  # 맨 아랫단 가장자리: 짚 끝이 들쭉날쭉
                t = (y - y0) / max(1.0, hb - 1)
                t = max(0.0, min(1.0, t))
                base = 5.6 - 3.0 * t - 0.55 * u
                if y > bot + 0.5: base -= 1.2                   # 늘어진 짚 끝(털)은 한 톤 어둡다
                run = (y + off[x]) // ln[x]
                j = rnd(x, run, seed + 7 + ti)
                base += 1.1 if j > 0.78 else (-1.0 if j < 0.2 else (0.45 if j > 0.55 else 0.0))
                if x % 2 == 0: base -= 0.35
                if abs(u) > 0.93: base -= 0.8                   # 좌우 가장자리 어두움
                if y <= top + 0.8: base += 0.5                  # 단 윗가장자리 반사
                cv.put(x, y, BR2[max(0, min(7, int(round(base))))])
                owner[y][x] = ti
    # 위 단이 아래 단에 드리운 그늘 띠(단 밑 2행)
    for ti in (1, 2):
        for x in range(W):
            ys = [y for y in range(H) if owner[y][x] == ti]
            if not ys: continue
            yb = max(ys)
            for d, tone in ((1, 1), (2, 2), (3, 3)):
                y = yb + d
                if y < H and owner[y][x] in (ti - 1,):
                    cur = cv.a[y, x, :3]
                    idx = min(range(8), key=lambda i: sum((int(cur[c]) - BR2[i][c]) ** 2 for c in range(3)))
                    cv.put(x, y, BR2[max(0, idx - (3 - d) - 1)])
    return cv
