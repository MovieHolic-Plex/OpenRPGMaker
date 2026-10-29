"""버들항 16변형 오토타일 공용 가장자리 깊이장 (칸 번호 = 위1 + 오른2 + 아래4 + 왼8).

저택·예술 도시 정원 연못(mansion-art-city/mc_fix.edge_depth)의 윤곽 — audit_autotile.py 기준 bad 0.18 — 을 그대로 옮겨
다른 장소 보정 스크립트가 같이 쓰게 한 것이다(결정적, numpy 만).

  edge_fields(n, inset, jag, rad, seed) -> (m, dN, dE, dS, dW)
      m  : 칸 안 깊이(화소). m < 0 이면 칸 밖(투명), m >= 0 이면 덩이 안.
      dX : 그 변 윤곽에서 안쪽으로 잰 거리(이웃이 있는 변은 99).
  윤곽은 변마다 주기 16 잡음 두 겹(큰 혹 + 잔 혹, 큰 혹 깊이는 아래를 받쳐 씨앗이 달라도 곧은 변이 나오지 않는다)이고, 칸 끝(0·15)에서는 얕게(≈0.5px) 모여
  오목 모서리 계단이 1px 안쪽으로 줄고 이웃 칸과 같은 높이로 이어진다. 이웃 없는 두 변이 만나는 볼록 모서리는 rad 로 둥글다.

  window_mask(mk, inset, jag, rad, seed) -> 48x48 bool
      3x3 창 가운데에 변형 mk, 이웃 칸은 같은 쪽 변이 빈 것으로 본 마스크(섬·용암 칠하기처럼 창 전체를 칠하고 가운데만 자르는 화가용).
"""
import numpy as np

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


def tnoise1(N, sc, seed):
    """주기 N 1차원 값 잡음(감김)."""
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + .5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def edge_fields(n, inset=3.2, jag=3.2, rad=7.5, seed=1):
    tt = (np.arange(16) + .5) / 16
    env = np.sin(np.pi * tt) ** 1.4

    def jj(k):
        sh = .55 + .45 * tnoise1(16, 8, seed * 10 + k)
        c = .45 + .55 * tnoise1(16, 16, seed * 10 + k + 3)       # 변마다 큰 혹 깊이(주기 16 이라 상수) — 너무 얕아 곧은 변이 되지 않게 아래를 받친다
        return .5 + (inset - .5 + jag * (c - .3)) * env * sh + (tnoise1(16, 4, seed * 10 + k + 5) - .5) * .9 - inset

    big = 99.0 + 0 * X16
    dN = np.where(n & 1, big, Y16 - (inset + jj(1)[X16]))
    dS = np.where(n & 4, big, (15 - Y16) - (inset + jj(2)[X16]))
    dW = np.where(n & 8, big, X16 - (inset + jj(3)[Y16]))
    dE = np.where(n & 2, big, (15 - X16) - (inset + jj(4)[Y16]))
    m = np.minimum(np.minimum(dN, dS), np.minimum(dW, dE))
    for a, b in ((dN, dW), (dN, dE), (dS, dW), (dS, dE)):
        if a.max() < 90 and b.max() < 90:
            sel = (a < rad) & (b < rad)
            rc = rad - np.hypot(rad - a, rad - b)
            m = np.where(sel, np.minimum(m, rc), m)
    return m, dN, dE, dS, dW


def window_mask(mk, inset=3.2, jag=3.2, rad=7.5, seed=1):
    mask = np.zeros((48, 48), bool)
    N, E, S, W = bool(mk & 1), bool(mk & 2), bool(mk & 4), bool(mk & 8)

    def cell(cx, cy, bits):
        mask[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16] |= edge_fields(bits, inset, jag, rad, seed)[0] >= 0
    cell(1, 1, mk)
    ew = (2 if E else 0) | (8 if W else 0); ns = (1 if N else 0) | (4 if S else 0)
    if N: cell(1, 0, 1 | 4 | ew)
    if S: cell(1, 2, 1 | 4 | ew)
    if E: cell(2, 1, 2 | 8 | ns)
    if W: cell(0, 1, 2 | 8 | ns)
    for (cx, cy, a, b) in ((2, 0, N, E), (2, 2, S, E), (0, 2, S, W), (0, 0, N, W)):
        if a and b: cell(cx, cy, 15)
    return mask
