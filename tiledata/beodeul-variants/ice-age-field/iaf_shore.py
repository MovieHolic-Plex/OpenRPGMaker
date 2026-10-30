# 빙하기 설원 보정 4차 — 4비트(위1·오른2·아래4·왼8) 덩이 붓의 물가 윤곽 공용 함수. 결정적.
#
# 문제(적대 검수 ice-age-field.md 2·3번): 4비트 붓은 대각 이웃을 모른다. 그래서
#   · 칸 끝(칸 경계)에서 물가 깊이가 c0>0 이면, 오목 모서리(위·왼 이웃은 덩이, 왼위 대각은 밖)에서
#     옆 칸의 c0 폭 홈이 속 칸(15번) 앞에서 곧게 잘리고 윤곽이 끊긴다.
#   · 쪽마다 같은 물결 하나를 쓰면 같은 쪽 둑이 16px 마다 똑같이 되풀이된다.
# 설계:
#   1. 물가 깊이는 칸 끝에서 정확히 0 이다(맨 끝 화소가 곧 윤곽 화소). 오목 모서리에서는 위 칸의 왼쪽 물가와
#      왼 칸의 위쪽 물가가 칸 꼭짓점에서 대각으로 만나 윤곽이 이어지고, 속 칸은 아무것도 몰라도 된다.
#   2. 끝에서 0 으로 갈 때 기울기 k(≈0.7)로 내려간다(평평하게 붙지 않는다) — 오목 모서리의 눈 꼭짓점이
#      90° 가 아니라 약 140° 로 무뎌져 비스듬한 물가가 되고, 흰 가시가 생기지 않는다.
#   3. 칸 가운데 물결(만·곶)은 변형 번호 n 과 쪽마다 위상·크기를 달리한다 — 모서리 칸·곧은 칸·외톨이 칸이
#      섞이면 같은 물결이 되풀이되지 않는다.
#   4. 둑 꾸밈 띠(둑 앞면·그늘·얕은 띠)도 칸 끝으로 갈수록 얇아진다(gain) — 끝 화소에서 띠가 곧게 잘리지 않는다.
#   5. 꾸밈은 모두 덩이 안쪽(m ≥ 0)에만 그린다 — 칸 밖 1px 테는 칸 경계에서 끊기므로 쓰지 않는다.
import math
import numpy as np
from iaf_base import hash2, N_, E_, S_, W_

X, Y = np.meshgrid(np.arange(16), np.arange(16))
_T = np.arange(16, dtype=float)
R_END = np.minimum(_T, 15 - _T)                         # 가장 가까운 칸 끝까지 화소 수 (0 … 7)


def _softmin(a, b, s=0.6):
    return -s * np.log(np.exp(-a / s) + np.exp(-b / s))


def profile(n, side, seed, base=3.4, amp=1.6, k=0.72, c0=0.0):
    """변형 n 의 한 쪽 물가 깊이(길이 16, 칸 안쪽 +px). 끝 = 0, 끝 기울기 k, 가운데는 변형마다 다른 물결."""
    h = lambda i: hash2(n * 7 + 'NESW'.index(side), i, seed)
    p1, p2, p3 = h(1) * 6.283, h(2) * 6.283, h(3) * 6.283
    a1 = amp * (0.55 + 0.45 * h(4)); a2 = amp * (0.25 + 0.35 * h(5)); a3 = amp * 0.18
    b = base * (0.85 + 0.3 * h(6))
    t = (_T + 0.5) * (2 * math.pi / 16)
    raw = a1 * np.sin(t * (0.5 + h(7)) + p1) + a2 * np.sin(2 * t + p2) + a3 * np.sin(3.3 * t + p3)
    raw = raw / max(1e-6, np.abs(raw).max())
    # 곶(+)은 크게, 만(-)은 얕게 — 깊이가 바닥에 붙어 곧은 줄이 되지 않게
    wave = b + amp * np.where(raw > 0, raw, 0.45 * raw)
    d = c0 + _softmin(k * R_END, wave - c0)
    d[0] = d[15] = c0
    return d


def gain(d, base):
    """둑 꾸밈 띠 굵기 비율(칸 끝에서 0.3, 물가가 깊어질수록 1)."""
    return np.clip(0.3 + 0.7 * d / max(1.0, base * 0.8), 0.3, 1.0)


def shore(n, seed, base=3.4, amp=1.6, rad=10.0, k=0.72, c0=0.0):
    """이웃 없는 쪽마다 깊이장 → 합친 깊이 m(안쪽 +, 둥근 바깥 모서리), 가장 가까운 빈 쪽 near(0 N,1 E,2 S,3 W),
    화소마다 꾸밈 띠 굵기 비율 g(가장 가까운 쪽의 gain), 쪽별 깊이장 D."""
    miss = {'N': not (n & N_), 'E': not (n & E_), 'S': not (n & S_), 'W': not (n & W_)}
    pr = {s: profile(n, s, seed, base, amp, k, c0) for s in 'NESW'}
    d = {'N': Y - pr['N'][X], 'S': (15 - Y) - pr['S'][X], 'W': X - pr['W'][Y], 'E': (15 - X) - pr['E'][Y]}
    # 꾸밈 띠는 칸 끝으로 갈수록 얇게 — 단 그 끝이 바깥 모서리(옆 쪽도 빔)면 둥근 모서리 띠를 온전히 둔다
    lo, hi = _T < 8, _T >= 8
    def gfix(s, a, b):
        g_ = gain(pr[s], base)
        if miss[a]: g_ = np.where(lo, 1.0, g_)
        if miss[b]: g_ = np.where(hi, 1.0, g_)
        return g_
    gs = {'N': gfix('N', 'W', 'E')[X], 'S': gfix('S', 'W', 'E')[X], 'W': gfix('W', 'N', 'S')[Y], 'E': gfix('E', 'N', 'S')[Y]}
    big = np.full((16, 16), 99.0)
    D = {s: (d[s] if miss[s] else big) for s in 'NESW'}
    m = np.minimum.reduce([D[s] for s in 'NESW'])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            ca = (Y if a == 'N' else 15 - Y).astype(float); cb = (X if b == 'W' else 15 - X).astype(float)
            sel = (ca < rad) & (cb < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - ca, rad - cb)), m)
    near = np.argmin(np.stack([D['N'], D['E'], D['S'], D['W']]), 0)
    g = np.choose(near, [gs['N'], gs['E'], gs['S'], gs['W']])
    return m, near, g, D
