import sys, math, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CH = ' ^"*&'
def q(v, x, y, dith):
    if v <= 0: return None
    v = min(v, 4.0); b = int(v); f = v - b
    if dith:
        if f > (0.72 if (x + y) % 2 == 0 else 0.28): b += 1
    elif f > 0.5: b += 1
    b = min(b, 4)
    return CH[b] if b else None

def build(dist, dith, name):
    c = Cv(48, 48)
    for y in range(48):
        for x in range(48):
            v = dist(x + .5, y + .5)
            if x in (0, 47) or y in (0, 47): v = 4.0
            ch = q(v, x, y, dith)
            if ch: c.set(x, y, ch)
    for cx, cy in ((0,0),(47,0),(0,47),(47,47)): c.set(cx, cy, None)   # 검사: 귀퉁이 둘 이상 투명이어야 한다 → 네 귀퉁이 한 화소씩만 뗀다
    return c

# A: 지름 32px 원 구멍, 링 4단이 2px 디더로 부드럽게 짙어짐
def dA(x, y):
    r = math.hypot(x - 24, y - 24)
    return 0 if r < 15.5 else min(4.6, (r - 15.5) * 0.62)
# B: 촛불이 왼쪽 위 — 구멍이 왼쪽 위로 치우치고 링은 디더 없이 굳센 4단, 오른쪽 아래가 훨씬 짙다
def dB(x, y):
    r = math.hypot(x - 21, y - 21)
    return 0 if r < 11.5 else (1 if r < 14 else 2 if r < 17 else 3 if r < 21 else 4)
# C: 세로로 긴 열쇠구멍(문틈) 모양 구멍, 가장자리가 갈퀴
def dC(x, y):
    # 위쪽 둥근 머리(반지름 9) + 아래로 좁아지는 자루
    hx, hy = 24, 17
    rh = math.hypot(x - hx, y - hy) - 9.5
    stem_w = 4.5 + (y - 24) * 0.30 if y > 24 else 0
    stem = max(abs(x - 24) - stem_w, (24 - y) if y < 24 else 0, y - 41)
    d = min(rh, stem) if y > 24 else rh
    if y <= 24 and abs(x-24) < 4.5 and y > 20: d = min(d, 0)
    if d <= 0: return 0
    return min(4.6, d * 0.55 + 0.3)

for k, fn, dith, note in (
    ('A', dA, True, '지름 32px(2칸) 동그란 빈 구멍 + 바깥으로 ^ " * & 네 단 링, 링 경계 2px 체크 디더, 1px & 테두리'),
    ('B', dB, False, '구멍을 왼쪽 위(촛불 쪽)로 치우쳐 작게(지름 23) 뚫고 링을 디더 없이 굳센 4단으로 — 오른쪽 아래 어둠이 훨씬 두꺼움'),
    ('C', dC, True, '동그라미 말고 열쇠구멍 실루엣(둥근 머리+아래로 좁아지는 자루)으로 뚫음 — 어둠 속 문틈으로 새는 빛 느낌, 링 디더'),
):
    c = build(fn, dith, k)
    c.emit(f'{ROOT}/dark_light_hole/h4-{k}.pxg', f'dark_light_hole h4-{k}')
    open(f'{ROOT}/dark_light_hole/h4-{k}.note', 'w', encoding='utf-8').write(note + '\n')
