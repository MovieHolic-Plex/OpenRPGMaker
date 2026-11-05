# 빙하기 설원 보정 4차 — autotile-iceedge(언 호수 물가) 다시 그리기. 결정적.
#  3차 판의 반려(적대 검수 qa/ice-age-field.md):
#   ① 속 칸(15번)이 한 톤 + 16px 점 격자로 퇴보 — 큰 판 균열·얕은/깊은 명암이 사라졌다.
#   ② 오목 모서리에서 물가 윤곽이 끊기고 칸 경계가 곧게 잘림(흰 가시).
#   ③ 같은 쪽 둑이 16px 마다 같은 물결.
#  4차 판:
#   · 물가 윤곽은 iaf_shore(칸 끝 깊이 0·끝 기울기 0.7·변형마다 다른 위상) — 대각 이웃을 모르는 붓에서도 오목 모서리에서
#     윗 칸·옆 칸 물가가 칸 꼭짓점에서 대각으로 이어진다. 둑 꾸밈은 모두 덩이 안쪽에만.
#   · 속 얼음 7단: 깊은 곳(2)·바탕(3)·얕은 결(4)이 주기 16 잡음 + 디더로 고르게 섞이고(빽빽한 결이라 칸 격자가 안 보인다),
#     판 균열(1 짙은 금 + 바로 아래 5 밝은 턱)이 칸 경계를 건너 이어지는 열린 그물(판 2×2 개, 경계 일부만 금),
#     드문 반짝 사선(6)·갇힌 기포(5). 물가 쪽은 얕은 띠(4·5)가 디더로 바탕에 녹는다(칸 끝에서 얇아진다).
#  물가 규칙(옛 판과 같은 뜻): 북쪽 둑 = 눈 마루(6)·둑 앞면(4·3)·둑 밑 얼음 그늘(1·2), 서쪽 = 눈(5)·짙은 얼음 윤곽(1)·그늘(2),
#  남쪽 = 눈 턱 밝은 테(6)·밝은 얼음 턱(5), 동쪽 = 눈(5)·밝은 얼음(4).
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (0 외톨이 · 15 속 칸).
import numpy as np
from PIL import Image
from iaf_base import P, hash2, tnoise, voro, shift, sheet_from_cells, BAY
from iaf_shore import shore, X, Y

SNa = P('snow'); ICa = P('ice')
B4 = BAY[Y % 4, X % 4]
BASE, AMP, RAD, K, C0 = 3.0, 1.6, 10.0, 0.45, 1.0
# 금이 있는 물가 변형: 곧은 쪽 4개 중 둘(14 북·7 남) + 모서리·곶 몇(6·9·3·12 중 둘, 1·4·8·2 중 둘) — 섞여 깔리면 띄엄띄엄 이어진다
CRACKED = {14, 7, 6, 9, 1, 8}


def _line(T, pts, tone, lip=None, lipdy=1):
    """꺾은선 금(1px) + 바로 아래 밝은 턱."""
    on = np.zeros((16, 16), bool)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / max(1, n)); y = round(y0 + (y1 - y0) * i / max(1, n))
            on[y % 16, x % 16] = True
    T[on] = tone
    if lip is not None:
        l = np.roll(on, lipdy, 0) & ~on
        T[l] = np.maximum(T[l], lip)
    return on


def _bluepts(n, seed, tries=30):
    """주기 16 원환 위의 고른 점(최선 후보 표본) — 잔 결이 뭉치지도 줄 서지도 않게."""
    r = np.random.default_rng(seed); pts = []
    for _ in range(n):
        best = None
        for _ in range(tries):
            p = r.integers(0, 16, 2)
            d = min([min(abs(p[0] - q[0]), 16 - abs(p[0] - q[0])) ** 2 + min(abs(p[1] - q[1]), 16 - abs(p[1] - q[1])) ** 2 for q in pts] or [99])
            if best is None or d > best[0]: best = (d, p)
        pts.append(best[1])
    return pts


def _inner_tone(seed):
    """속 얼음 톤(주기 16 — 속 칸끼리 이어진다). 깊은 얼음: 바탕 3 위에 짙은 잔물결(2, 1~3px) 여덟 · 밝은 결(4, 2~4px) 셋 · 반짝 사선(5·6) 하나 · 잔 알갱이를
    고른 점으로 흩는다. 한 칸에 눈에 띄는 무늬(금 조각·그늘 덩이)를 두면 넓은 호수에서 벽지처럼 되풀이된다(4차 시험 8종) —
    고른 잔 결만 두면 칸 격자가 안 읽힌다. 큰 판 균열은 물가 칸(변형마다 다른 금)과 ice_crack·pressure_ridge 물체가 맡는다."""
    T = np.full((16, 16), 3, int)
    dark = [[(0, 0)], [(0, 0), (1, 0)], [(0, 0), (1, 0), (2, 1)], [(0, 0), (1, 1)]]      # 짙은 잔물결: 점·2px·꺾인 3px·사선
    light = [[(0, 0), (1, 0), (2, 0)], [(0, 0), (1, 0)], [(0, 0), (1, 0), (2, 1), (3, 1)]]  # 밝은 결: 가로·짧은·사선 4px
    pts = _bluepts(12, seed, tries=5)
    for i, (x, y) in enumerate(pts):
        if i < 8:
            for (dx, dy) in dark[i % 4]: T[(y + dy) % 16, (x + dx) % 16] = 2
        elif i < 11:
            for (dx, dy) in light[i % 3]: T[(y + dy) % 16, (x + dx) % 16] = 4
        else:
            T[y, x] = 5; T[y, (x + 1) % 16] = 6; T[(y - 1) % 16, (x + 2) % 16] = 5
    T = np.where((hash2(X, Y, seed + 5) > 0.985) & (T == 3), 4, T)                    # 잔 알갱이
    T = np.where((hash2(X, Y, seed + 6) > 0.985) & (T == 3), 2, T)
    return T


def _crack(n, m, near, seed, bank):
    """물가 칸의 판 균열(변형마다 다른 자리·각도·길이): 둑에서 비스듬히 호수 속으로 뻗는 긴 금(7~12px, 한 번 꺾임) + 짧은 가지.
    물가 칸이 섞이며 각도가 다른 금이 물가를 따라 이어져, 물가 판이 갈라진 모양이 된다(속 칸에는 눈에 띄는 무늬를 두지 않는다).
    칸 끝 1px 에 닿지 않는다(옆 칸에서 잘린 금이 안 생긴다)."""
    on = np.zeros((16, 16), bool)
    if n in (0, 15): return on
    miss = [k for k, b in enumerate((1, 2, 4, 8)) if not (n & b)]
    r = np.random.default_rng(seed * 31 + n * 7 + 3)
    if n not in CRACKED: return on                                        # 물가 칸 절반만 — 모든 칸에 금이 있으면 비늘 무늬가 된다
    side = miss[int(r.integers(0, len(miss)))]
    ix = {0: (0, 1), 1: (-1, 0), 2: (0, -1), 3: (1, 0)}[side]; lat = (abs(ix[1]), abs(ix[0]))
    sgn = 1 if r.random() < 0.5 else -1
    t0 = int(r.integers(2, 6)) if sgn > 0 else int(r.integers(10, 14))
    x, y = {0: (t0, 0), 1: (15, t0), 2: (t0, 15), 3: (0, t0)}[side]
    for _ in range(16):
        if m[y, x] >= bank[y, x] + 0.4: break
        x += ix[0]; y += ix[1]
    slope = r.uniform(0.45, 1.0); bend = int(r.integers(3, 6)); slope2 = r.uniform(0.0, 0.5)
    fx, fy = float(x), float(y); pts = []
    for k in range(int(r.integers(7, 13))):
        xi, yi = int(round(fx)), int(round(fy))
        if not (1 <= xi <= 14 and 1 <= yi <= 14) or m[yi, xi] < 0: break
        pts.append((xi, yi))
        sl = slope if k < bend else slope2
        # 한 걸음에 안쪽 1 + 옆 sl — 화소가 띄지 않게 큰 쪽을 1 로 맞춘다
        dx, dy = ix[0] + lat[0] * sgn * sl, ix[1] + lat[1] * sgn * sl
        mx = max(abs(dx), abs(dy)); fx += dx / mx; fy += dy / mx
    for (xi, yi) in pts: on[yi, xi] = True
    if len(pts) >= 6:
        bx, by = pts[bend]
        for k in range(1, int(r.integers(3, 5))):
            qx, qy = bx + lat[0] * (-sgn) * k, by + lat[1] * (-sgn) * k + ix[1] * (k // 2)
            qx += ix[0] * (k // 2)
            if 1 <= qx <= 14 and 1 <= qy <= 14 and m[qy, qx] >= bank[qy, qx]: on[qy, qx] = True
    return on


def iceedge_sheet(seed=41):
    cells = []
    T0 = _inner_tone(7)                     # 시드 셋(48·7·21) 중 넓은 호수에서 줄무늬가 가장 덜 읽힌 결
    H_ = hash2(X, Y, seed + 13)
    for n in range(16):
        m, near, g, D = shore(n, seed, BASE, AMP, RAD, k=K, c0=C0)
        a = m >= 0
        bank = np.choose(near, [4.6, 2.2, 2.2, 2.2]) * np.maximum(g, 0.45)
        sh = m - bank
        T = T0.copy()
        # 물가 얕은 띠: 둑 다음 2.5px 는 4, 그다음 6px 는 짙은 결이 옅어지고 밝은 결이 늘며 바탕으로 녹는다(칸 끝에서 얇아진다)
        T = np.where(a & (sh >= 0) & (sh < 2.5 * g), 4, T)
        f = np.clip(1 - (sh - 2.5 * g) / (6.0 * g + 1e-6), 0, 1)            # 1 물가 쪽 → 0 속
        fade = a & (sh >= 2.5 * g) & (f > 0)
        T = np.where(fade & (T == 2) & (H_ < f * 1.2), 3, T)
        T = np.where(fade & (T == 3) & (H_ < f * 0.55), 4, T)
        T = np.where(a & (sh >= 0) & (sh < 1.0) & (near == 2), 5, T)        # 남쪽 밝은 얼음 턱 바로 안
        # 판 균열(짙은 금 1 + 아래 밝은 턱 5)
        cr = _crack(n, m, near, seed, bank) & a & (sh >= 0.0)
        T = np.where(cr, 1, T)
        lip = np.roll(cr, 1, 0) & ~cr & a & (sh >= 0)
        T = np.where(lip, 4, T)
        rgb = ICa[np.clip(T, 0, 6)].copy()
        # 북쪽 둑: 눈 마루 6 · 둑 앞면 4 → 3 · 둑 밑 얼음 그늘 1 · 그늘 끝 2(잔 디더)
        sel = a & (near == 0)
        rgb = np.where((sel & (m < 1.0))[..., None], SNa[6], rgb)
        rgb = np.where((sel & (m >= 1.0) & (m < 1.0 + 1.6 * g))[..., None], SNa[4], rgb)
        rgb = np.where((sel & (m >= 1.0 + 1.6 * g) & (m < 1.0 + 2.6 * g))[..., None], SNa[3], rgb)
        rgb = np.where((sel & (m >= 1.0 + 2.6 * g) & (m < 2.0 + 2.6 * g))[..., None], ICa[1], rgb)
        rgb = np.where((sel & (m >= 2.0 + 2.6 * g) & (m < 3.0 + 2.6 * g) & (H_ < 0.6))[..., None], ICa[2], rgb)
        # 서쪽: 눈 5 · 짙은 얼음 윤곽 1 · 그늘 2(잔 디더)
        sel = a & (near == 3)
        rgb = np.where((sel & (m < 1.0))[..., None], SNa[5], rgb)
        rgb = np.where((sel & (m >= 1.0) & (m < 2.0))[..., None], ICa[1], rgb)
        rgb = np.where((sel & (m >= 2.0) & (m < 2.0 + 1.2 * g) & (H_ < 0.6))[..., None], ICa[2], rgb)
        # 남쪽: 눈 턱 밝은 테 6 · 밝은 얼음 턱 5
        sel = a & (near == 2)
        rgb = np.where((sel & (m < 1.0))[..., None], SNa[6], rgb)
        rgb = np.where((sel & (m >= 1.0) & (m < 2.0))[..., None], ICa[5], rgb)
        # 동쪽: 눈 5 · 얼음 윤곽 2
        sel = a & (near == 1)
        rgb = np.where((sel & (m < 1.0))[..., None], SNa[5], rgb)
        rgb = np.where((sel & (m >= 1.0) & (m < 2.0))[..., None], ICa[2], rgb)
        out = np.zeros((16, 16, 4), np.uint8); out[..., :3] = rgb; out[..., 3] = np.where(a, 255, 0)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


if __name__ == '__main__':
    import os
    import iaf_auto2 as AU
    HERE = os.path.dirname(os.path.abspath(__file__))
    iceedge_sheet().save('/tmp/iaf/iceedge-new.png')
