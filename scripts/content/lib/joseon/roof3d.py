"""바람의나라 연구에서 뽑은 기와 지붕(나비 날개 팔작). 팔레트는 tk 램프(버들항 잠금)만 쓴다.

연구 요점(harness/BARAM_STUDY.md):
 - 가운데 앞사면은 세로 기왓골이 촘촘, 양옆 날개면은 다른 방향 결(가로·사선).
 - 날개 끝이 바깥·위로 치켜 올라 오목한 곡선 윤곽(앙곡), 처마 아랫선도 가운데가 낮고 끝이 높은 곡선.
 - 추녀마루가 굵고 밝은 선으로 면을 가른다. 용마루는 얇은 밝은 띠, 양끝에 둥근 마루 끝(치미).
 - 막새: 처마 끝에 둥근 점이 한 줄. 아래로 갈수록 어둡게, 그림자는 체크무늬 디더.
좌표: 지붕 이미지 W×H(px). 빛은 왼쪽 위.
"""
import math
from tk import *


def _ramp(style):
    return {'giwa': RGB['giwa'], 'brown': RGB['earth'], 'dg': RGB['dgreen']}.get(style, RGB['dgreen'])


def roof(W, H, style='giwa', wing=22, seed=0):
    """W×H 지붕. 몸채는 폭 전체, 용마루 띠는 날개 안쪽에서만. 날개는 위 모서리에 얹힌 오목한 면(가로 결, 밝은 가장자리선)."""
    cv = Cv(W, H)
    G = _ramp(style)
    hi, mid, lo, dk = G[4], G[3], G[2], G[1]          # 바람의나라 기와는 어둡고 골 대비가 선명하다
    line = G[6] if style == 'giwa' else G[6]
    ridge_h = 6
    lift = 9                                          # 처마 아랫선: 가운데가 가장 낮고 양끝이 들린다
    wt0, wt1 = 1.0, 0.13 * H                 # 날개 위 가장자리: 바깥(tip) → 몸채 쪽
    wb0, wb1 = 0.88 * H, 0.62 * H            # 날개 아래 가장자리: 바깥 → 몸채 쪽

    def wing_top(u):                          # u: 0(바깥)..1(몸채), 오목하게 처졌다가 안쪽에서 급히 내려온다
        return wt0 + (wt1 - wt0) * (u ** 0.85)

    def wing_bot(u):
        return wb0 + (wb1 - wb0) * (1 - (1 - u) ** 1.7)

    for y in range(H):
        for x in range(W):
            d = min(x, W - 1 - x)
            left = x < W / 2
            u = d / max(1.0, wing)
            bot = H - 1 - lift * ((1 - (2.0 * x / (W - 1) - 1) ** 2) * -1 + 1) ** 1.0 if False else (H - 1 - lift * (2.0 * x / (W - 1) - 1) ** 2)
            if y > bot:
                continue
            if d < wing:
                if y < wing_top(u):
                    continue                  # 날개 위쪽 허공(오목)
                if y < wing_bot(u):           # 날개 면: 가로 결
                    k = (y + (d // 3)) % 4
                    col = [mid, lo, mid, hi][k] if left else [lo, dk, lo, mid][k]
                    cv.put(x, y, col)
                    continue
            elif y < ridge_h:
                col = hi if y < 2 else (mid if y < 4 else lo)
                cv.put(x, y, col)
                continue
            # 몸채: 세로 기왓골
            k = x % 4
            col = [hi, mid, dk, mid][k]
            if y % 6 == 5 and k in (1, 3):
                col = lo
            if y > H - 10:
                col = [mid, lo, dk, lo][k]
            if y < ridge_h + 1 and d >= wing:
                col = lo
            cv.put(x, y, col)
    # 날개 가장자리선(밝은 곡선): 위·아래 가장자리와 몸채쪽 세로선
    for sgn in (1, -1):
        for d in range(0, wing):
            u = d / max(1.0, wing)
            x = d if sgn == 1 else W - 1 - d
            for yy, c in ((int(round(wing_top(u))), hi), (int(round(wing_bot(u))), hi)):
                if 0 <= yy < H and cv.a[yy, x, 3]:
                    cv.put(x, yy, line)
        xi = wing if sgn == 1 else W - 1 - wing
        for y in range(ridge_h - 1, int(wb1) + 1):
            if cv.a[y, xi, 3]:
                cv.put(xi, y, line)
        # 치미: 용마루 끝에 앉은 뭉툭한 마감 기와(바깥 윗끝이 말려 오른다)
        shape = {0: (0, 2, 'tip'), 1: (0, 4, 'hi'), 2: (0, 5, 'face'), 3: (0, 5, 'face'), 4: (0, 5, 'face'), 5: (1, 5, 'dark')}
        for yy, (k0, k1, kind) in shape.items():
            for k in range(k0, k1):
                xx = xi + sgn * k
                if not (0 <= xx < W): continue
                if kind == 'tip': col = G[6]
                elif kind == 'hi': col = G[6] if k < 2 else G[5]
                elif kind == 'dark': col = G[2]
                else: col = G[5] if k < 2 else (G[4] if k < 4 else G[3])
                if k == k1 - 1 and kind == 'face': col = G[2]       # 안쪽 가장자리 그늘
                cv.put(xx, yy, col)
    # 날개 끝 갈고리: 바깥 위쪽 모서리 두 화소를 위로 말아 올린다
    for sgn in (1, -1):
        x0 = 0 if sgn == 1 else W - 1
        for dy, dx, c in ((0, 0, line), (-1, 0, hi), (0, 1 * sgn, line)):
            xx, yy = x0 + dx, max(0, 1 + dy)
            if 0 <= xx < W:
                cv.put(xx, yy, c)
    # 막새: 처마 끝에 점 한 줄
    for x in range(2, W - 2, 4):
        yb = int(H - 1 - lift * (2.0 * x / (W - 1) - 1) ** 2)
        cv.put(x, yb, G[5]); cv.put(x + 1, yb, G[4])
        cv.put(x, max(0, yb - 1), dk)
    return cv
