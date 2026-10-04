"""라미아(lamia) 이펙트 2종 — b5. 색: 청록 비늘·주황 무늬, 조임 흰 섬광, 독 초록, 사막 밤 하늘.
휘감기(대상을 청록 뱀 몸이 나선으로 감고 조여 흰 섬광) · 대사 강림(거대한 뱀 머리가 모래 폭풍 속에서 솟아 적진을 향해 아가리를 벌림)."""
from lib_r2w5 import *

P_COIL = Pal(T=['#0e2a30', '#235b63', '#20888e', '#5ab8b0'], M=['#ca8733'], W=['#ffffff', '#e0fff0'])


@sheet('lamia_coil', 64, 10, 'target', P_COIL, peak=[2, 5, 7])
def lamia_coil(c, f):
    T, M, W = P_COIL.T, P_COIL.M[0], P_COIL.W
    u = min(1, (f + 1) / 5)
    squeeze = [0, 0, 0, 0, 0, 1.5, 3, 4.5, 2, .5][f]
    rx = 16 - squeeze
    pts = []
    N = 60
    for i in range(int(N * u)):
        t = i / N
        a = t * math.tau * 2.4
        pts.append((CX + math.cos(a) * rx, 54 - t * 36 + math.sin(a) * 4))
    # 뒤쪽 반(사인이 음수)을 먼저, 앞쪽을 나중
    for front in (False, True):
        for a_, b_ in zip(pts, pts[1:]):
            ang = math.atan2(b_[1] - a_[1], b_[0] - a_[0])
            is_front = (a_[1] - (54 - 36 * (pts.index(a_) / N))) > 0
            if is_front != front: continue
            c.line([a_, b_], T[0], 7); c.line([a_, b_], T[2] if front else T[1], 5)
            if front: c.line([a_, b_], T[3] if f != 7 else W[1], 1)
    for i in range(4, len(pts), 8):
        x, y = pts[i]
        if (y - (54 - 36 * i / N)) > 0: c.rect(x, y, x + 1, y + 1, M)
    if pts:
        hx, hy = pts[-1]
        c.disc(hx, hy, 4, T[0]); c.disc(hx, hy, 3, T[2]); c.px(hx - 1, hy - 1, W[0])
    if f in (5, 6, 7):
        for k in range(6):
            a = k * math.tau / 6 + f
            c.line([(CX + math.cos(a) * (rx + 4), CY - 4 + math.sin(a) * 16), (CX + math.cos(a) * (rx + 9), CY - 4 + math.sin(a) * 20)], W[0])


P_SERP = Pal(N=['#1a1020', '#3a2030', '#6a3a2a'], D=['#a07040', '#d8b070'], T=['#0e2a30', '#235b63', '#20888e', '#5ab8b0'], M=['#ca8733'], R=['#a3355f'], W=['#ffffff'], E=['#ffe070'])


@sheet('lamia_serpent_sky', 128, 12, 'screen', P_SERP, peak=[3, 7, 10])
def lamia_serpent_sky(c, f):
    N, D, T, M, R, W, E = P_SERP.N, P_SERP.D, P_SERP.T, P_SERP.M[0], P_SERP.R[0], P_SERP.W[0], P_SERP.E[0]
    c.rect(0, 0, 127, 127, N[0]); c.dither(lambda cc: cc.rect(0, 50 - f % 3 * 4, 127, 127, N[1]), f); c.rect(0, 96, 127, 127, N[2])
    # 모래 폭풍 줄
    for k in range(8):
        y = 20 + k * 11
        x0 = (k * 31 + f * 14) % 160 - 20
        c.line([(x0, y), (x0 + 18, y + 1)], D[k % 2])
    rise = min(1, f / 6)
    by = 150 - rise * 70
    # 뱀 목(아래에서 S자로 솟음)
    body = [(96 + math.sin(t * 3 + f * .3) * 10, by + 40 - t * 70) for t in [i / 16 for i in range(17)]]
    for a_, b_ in zip(body, body[1:]):
        c.line([a_, b_], T[0], 20); c.line([a_, b_], T[1], 16); c.line([(a_[0] - 4, a_[1]), (b_[0] - 4, b_[1])], T[2], 6)
    for i in range(0, 17, 3):
        x, y = body[i]; c.rect(x - 1, y, x + 2, y + 2, M)
    hx, hy = body[-1]
    open_ = 0 if f < 7 else min(1, (f - 6) / 2)
    # 머리(왼쪽 = 적 쪽을 향함)
    c.disc(hx - 6, hy, 16, T[0], 11); c.disc(hx - 6, hy, 14, T[2], 9); c.disc(hx - 10, hy - 3, 7, T[3], 4)
    c.rect(hx - 4, hy - 7, hx - 1, hy - 4, E); c.px(hx - 3, hy - 6, N[0])
    if open_:
        c.poly([(hx - 20, hy + 2), (hx - 34, hy - 6 - open_ * 8), (hx - 4, hy + 2)], T[0])
        c.poly([(hx - 20, hy + 4), (hx - 34, hy + 10 + open_ * 8), (hx - 4, hy + 4)], T[0])
        c.poly([(hx - 20, hy + 3), (hx - 30, hy - 3 - open_ * 6), (hx - 30, hy + 8 + open_ * 6)], R)
        for sg in (-1, 1): tooth_(c, hx - 26, hy + 3 + sg * (4 + open_ * 5), sg, W)
        c.line([(hx - 30, hy + 3), (hx - 42, hy + 1)], R, 1); c.line([(hx - 42, hy + 1), (hx - 45, hy - 2)], R); c.line([(hx - 42, hy + 1), (hx - 45, hy + 4)], R)
    c.rect(0, 104, 127, 127, N[2])
    for k in range(10):
        x = (k * 13 + f * 5) % 128
        c.px(x, 104 + (k % 3), D[1])


def tooth_(c, x, y, sg, col):
    c.poly([(x - 2, y), (x, y - sg * 6), (x + 2, y)], col)

