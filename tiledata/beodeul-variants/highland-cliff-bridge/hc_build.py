# 고원 절벽과 하늘 다리 — 구조물: 회색 널판 다리(가로·세로, 난간 + 아래 트러스), 돌 계단, 계단식 밭 비탈(밭 이랑 경사 + 덩굴 비탈 둘).
# 3/4(윗면 + 앞면), 빛 왼쪽 위, 톤 캔버스 + pz.fin 윤곽. 다리 널판 = nuri(바랜 회색 널판), 계단 = 버들항 돌, 비탈 = dan 바위 + 잎 덩굴.
import math
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash
import hc_cliff as HC


def _picket(tc, x, ytop, ybot, seed, k0=4):
    """난간 말뚝 하나(2px 폭, 뾰족한 머리): 왼쪽 빛 · 오른쪽 그늘, 머리 1px."""
    tc.px(x, ytop, 'nuri', k0 + 1)
    for y in range(ytop + 1, ybot):
        tc.px(x, y, 'nuri', k0 + (1 if y < ytop + 3 else 0)); tc.px(x + 1, y, 'nuri', k0 - 1)


# ================================================================ 가로 다리(동서로 하늘을 건넌다) — 4줄: 뒤 난간 1 · 널판 바닥 2 · 앞 보 + 트러스 1
def bridge_h(w=7, seed=11, ends=True, part=None):
    """가로 널판 다리 w칸 x 4줄. 1줄 = 뒤 난간(말뚝 4px 간격 + 가로대 둘), 2·3줄 = 남북으로 놓인 널판 바닥(3px 널 + 짙은 틈, 널마다 톤 흔들림,
    못 점), 3줄 아래 끝 = 앞 난간 말뚝(바닥 앞 가장자리에 낮게), 4줄 = 바닥 앞 보(앞면 3px) + X자 트러스(16px 마다 세로 기둥) + 아래 현.
    ends = 양 끝에 굵은 끝 기둥. part = 'end_w' | 'mid' | 'end_e' 이면 그 1칸만(이어 찍는 조각)."""
    Wp, Hp = w * 16, 64
    tc = TC(Wp, Hp, seed)
    deck0, deck1 = 16, 44                          # 바닥 윗면 y 범위(널판)
    # 뒤 난간
    for x in range(1, Wp - 1, 4): _picket(tc, x, 3 + (x // 4) % 2, deck0 + 2, seed, 4)
    for y, k in ((6, 5), (7, 3), (12, 4), (13, 2)):
        for x in range(0, Wp): tc.px(x, y, 'nuri', k if tc.get(x, y) is None or x % 4 > 1 else k + 1)
    # 널판 바닥
    for y in range(deck0, deck1):
        for x in range(Wp):
            b = x // 4; lx = x % 4
            k = 5 - (1 if _hash(b, 1, seed) < .3 else 0) - (1 if lx == 2 and _hash(b, y // 9, seed + 5) < .5 else 0)
            if lx == 3: k = 3 if _hash(b, y // 5, seed + 6) > .5 else 2
            elif lx == 0: k += 1
            if y == deck0: k = 6 if lx != 3 else 3
            if y >= deck1 - 3: k -= 1
            if (y - deck0) in (4, 22) and lx == 1: k = 3                         # 못 점(가로 장선 자리)
            if _hash(x, y, seed + 3) < .05: k -= 1
            tc.px(x, y, 'nuri', clamp(k, 1, 6))
    # 바닥 앞 보(앞면)
    for y in range(deck1, deck1 + 4):
        for x in range(Wp): tc.px(x, y, 'nuri', (4, 3, 3, 1)[y - deck1] - (1 if (x // 16) % 2 and y > deck1 else 0))
    # 앞 난간(바닥 앞 가장자리에 서는 낮은 말뚝 + 가로대)
    for x in range(2, Wp - 1, 4): _picket(tc, x, deck1 - 7 + (x // 4) % 2, deck1 + 1, seed, 4)
    for x in range(Wp): tc.px(x, deck1 - 4, 'nuri', 5); tc.px(x, deck1 - 3, 'nuri', 3)
    # 트러스(X자 버팀대) + 아래 현
    yb0, yb1 = deck1 + 4, Hp - 4
    for c in range(w + 1):
        x0 = c * 16
        for y in range(yb0, yb1 + 2):
            tc.px(x0 - 1, y, 'nuri', 4); tc.px(x0, y, 'nuri', 2)
        if c < w:
            for t in range(17):
                u = t / 16
                for (xa, ya, xb, yb_) in ((x0 + 1, yb0, x0 + 15, yb1), (x0 + 15, yb0, x0 + 1, yb1)):
                    xx = xa + (xb - xa) * u; yy = ya + (yb_ - ya) * u
                    tc.px(xx, yy, 'nuri', 4 if xb > xa else 3); tc.px(xx, yy + 1, 'nuri', 2)
    for x in range(Wp): tc.px(x, yb1, 'nuri', 4); tc.px(x, yb1 + 1, 'nuri', 2)
    if ends:
        for xe in (0, Wp - 4):
            for y in range(1, deck1 + 4):
                for i in range(4): tc.px(xe + i, y, 'nuri', (5, 4, 3, 2)[i] if y > 2 else 6)
    im = tc.fin(.6)
    if part:
        o = {'end_w': 0, 'mid': 1, 'end_e': w - 1}[part]
        return im.crop((o * 16, 0, o * 16 + 16, Hp))
    return im


def bridge_h_part(part, seed=11):
    """이어 찍는 1칸 조각: 끝 기둥이 있는 서쪽 끝·가운데·동쪽 끝. 가운데를 여러 번 이어 다리 길이를 맞춘다."""
    full = bridge_h(3, seed, ends=True)
    o = {'end_w': 0, 'mid': 1, 'end_e': 2}[part]
    return full.crop((o * 16, 0, o * 16 + 16, 64))


# ================================================================ 세로 다리(남북으로 하늘을 건넌다) — 3칸 폭
def bridge_v(h=6, seed=13):
    """세로 널판 다리 3칸 x h줄: 가운데 = 동서로 놓인 널판(가로 널 4px + 틈), 양옆 = 난간(말뚝 머리가 위로 3px 솟고 가로대 2px),
    남쪽 끝 = 바닥 앞 보와 트러스 앞면 한 줄(3/4 에서 보이는 다리 끝면), 북쪽 끝 = 굵은 끝 기둥."""
    Wp, Hp = 48, h * 16
    tc = TC(Wp, Hp, seed)
    for y in range(0, Hp - 14):
        for x in range(6, 42):
            p = y // 4; ly = y % 4
            k = 4 + (1 if _hash(p, 0, seed) > .65 else 0) - (1 if _hash(p, 1, seed) < .2 else 0)
            if ly == 3: k = 1
            elif ly == 0: k += 1
            if x < 8: k += 1
            if x > 39: k -= 1
            if x in (12, 35) and ly == 1: k = 2
            tc.px(x, y, 'nuri', clamp(k, 1, 6))
    for side in (0, 1):
        x0 = 1 if side == 0 else 41
        for y in range(0, Hp - 12):                                              # 난간 가로대(위에서 본 두 줄)
            tc.px(x0 + 1, y, 'nuri', 5 if side == 0 else 4); tc.px(x0 + 2, y, 'nuri', 3)
            tc.px(x0 + 4, y, 'nuri', 4); tc.px(x0 + 5, y, 'nuri', 2)
        for y in range(2, Hp - 12, 8):                                          # 말뚝 머리
            for i in range(2):
                tc.px(x0 + 2 + i, y - 1, 'nuri', 6 - i); tc.px(x0 + 2 + i, y, 'nuri', 5 - i); tc.px(x0 + 2 + i, y + 1, 'nuri', 2)
    yb = Hp - 14
    for y in range(yb, yb + 4):
        for x in range(1, 47): tc.px(x, y, 'nuri', (4, 3, 3, 1)[y - yb])
    for x in range(1, 47, 8):
        for y in range(yb + 4, Hp - 2): tc.px(x, y, 'nuri', 4); tc.px(x + 1, y, 'nuri', 2)
    for t in range(41):
        u = t / 40; tc.px(2 + 44 * u, yb + 4 + 8 * abs(math.sin(u * math.pi * 3)), 'nuri', 3)
    for x in range(1, 47): tc.px(x, Hp - 2, 'nuri', 2)
    for y in range(0, 6):
        for x0 in (0, 42):
            for i in range(6): tc.px(x0 + i, y, 'nuri', (6, 5, 4, 4, 3, 2)[i])
    return tc.fin(.6)


# ================================================================ 돌 계단(절벽 앞면을 뚫고 내려간다) — 2칸 x 3줄
def stone_stairs(w=2, seed=15):
    """버들항 돌 계단: 디딤 4px(윗모 빛 · 디딤 · 챌면 그늘) 12단, 양옆 3px 절벽 바위 볼(dan) — 앞면 3줄을 대신한다. 걷기."""
    Wp, Hp = w * 16, 48
    tc = TC(Wp, Hp, seed)
    for y in range(Hp):
        for x in range(Wp):
            if x < 4 or x >= Wp - 4:
                e = x if x < 4 else Wp - 1 - x
                k = HC.cliff_k(x + 200, y, y, 48, 5) - (1 if e == 3 else 0)
                tc.px(x, y, 'dan', clamp(k, 1, 6)); continue
            s_ = (y + 1) % 4
            k = 5 if s_ == 0 else (4 if s_ < 3 else 2)
            if x == 4 or x == Wp - 5: k -= 2
            if _hash(x // 5, y // 4, seed) < .15 and s_ in (1, 2): k -= 1
            tc.px(x, y, 'stone', clamp(k, 1, 6))
    return tc.fin(.6)


# ================================================================ 계단식 밭 비탈 — 밭 이랑 경사(가운데, 걷기) + 덩굴 비탈(양옆, 막힘)
def terrace_ramp(w=3, seed=17):
    """밭 이랑으로 이은 경사 w칸 x 3줄: 6px 마다 한 단(디딤 = 흙 이랑 위 채소 잎 줄, 챌면 = 흙 앞면 2px 그늘) — 걸어서 내려간다."""
    Wp, Hp = w * 16, 48
    tc = TC(Wp, Hp, seed)
    for y in range(Hp):
        st = y // 6; ly = y % 6
        for x in range(Wp):
            if ly < 4: k = 3 + (1 if ly == 0 else 0)
            else: k = 2 if ly == 4 else 1
            if _hash(x, y, seed) < .08: k += 1
            tc.px(x, y, 'michi', clamp(k, 1, 6))
    for st in range(Hp // 6):                                                    # 채소 잎 줄(흙을 다 칠한 뒤 — 이랑을 거의 덮는다, 이랑마다 엇갈림)
        y = st * 6
        for i in range(Wp // 4 + 1):
            cx_ = i * 4 + (st % 2) * 2 - 1
            mat = 'leaf' if _hash(i, st, seed + 2) > .25 else 'nuren'
            for (dx, dy, k) in ((0, 0, 5), (1, 0, 6), (2, 0, 5), (-1, 1, 4), (0, 1, 5), (1, 1, 4), (2, 1, 4), (0, 2, 3), (1, 2, 3), (2, 2, 2)):
                if 0 <= cx_ + dx < Wp: tc.px(cx_ + dx, y + dy, mat, k)
    for y in range(Hp):                                                          # 가장자리 흙 두둑
        tc.px(0, y, 'michi', 2); tc.px(Wp - 1, y, 'michi', 2)
    return tc.fin(.6)


def vine_slope(side='w', seed=19):
    """덩굴 비탈 2칸 x 3줄: 대각선 아래 = 절벽 바위 앞면, 대각선 위 = 경사(가운데 이랑 쪽으로 내려가는 비탈)를 세로 덩굴 줄기가 덮는다
    (잎 램프 3~6 줄기 + 사이로 주황 흙). side='w' 는 이랑 서쪽(경사가 오른쪽 아래로), 'e' 는 거울."""
    Wp, Hp = 32, 48
    tc = TC(Wp, Hp, seed)
    for y in range(Hp):
        for x in range(Wp):
            xs = x if side == 'w' else Wp - 1 - x
            diag = xs * Hp / Wp                                                  # 대각선 y
            if y < diag - 1:
                vx = (x + int(2 * math.sin(y / 5 + x))) % 4
                if vx == 3: m_, k = 'dan', 3 if _hash(x, y // 2, seed) > .4 else 2
                else:
                    k = (4, 5, 3)[vx] - (1 if y > diag - 8 else 0) - (1 if _hash(x, y, seed + 1) < .12 else 0)
                    m_ = 'leaf' if _hash(x, y // 4, seed + 3) > .35 else 'nuren'
                    if _hash(x // 2, y // 3, seed + 2) < .1: m_, k = 'aki', 4
                tc.px(x, y, m_, clamp(k, 1, 6))
            elif y < diag + 1:
                tc.px(x, y, 'leaf', 2)
            else:
                k = HC.cliff_k(x + (300 if side == 'w' else 400), y, y, 48, 5)
                if y < diag + 4: k = max(1, k - 1)
                tc.px(x, y, 'dan', k)
    return tc.fin(.6)


if __name__ == '__main__':
    import os
    ims = [bridge_h(7), bridge_v(5), stone_stairs(), terrace_ramp(), vine_slope('w'), vine_slope('e'),
           bridge_h_part('end_w'), bridge_h_part('mid'), bridge_h_part('end_e')]
    W = sum(i.width + 6 for i in ims); H = max(i.height for i in ims)
    o = Image.new('RGBA', (W, H), (100, 124, 202, 255)); x = 0
    for i in ims: o.alpha_composite(i, (x, H - i.height)); x += i.width + 6
    o.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'build.png'))
