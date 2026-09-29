"""꼬마 오거(ogre_kid) 이펙트 1종 — b3. 색: 저녁 하늘 보라·주황, 거인 그림자 검갈색, 나무 몽둥이 갈색, 충격 노랑.
거인의 한 방(지평선 너머 거대한 오거 그림자가 몽둥이를 들어 적진에 내리친다)."""
from lib_r2w5 import *

P_GIANT = Pal(S=['#2a1a3a', '#5a2a4a', '#a04a3a', '#e08a4a'], K=['#1a0e0a', '#3c291d'], W=['#7a4a24', '#a8703a'], Y=['#ffd23a', '#fff6b0'], E=['#ff5a3a'])


@sheet('ogre_kid_giant_sky', 128, 12, 'screen', P_GIANT, peak=[3, 7, 9])
def ogre_kid_giant_sky(c, f):
    S, K, W, Y, E = P_GIANT.S, P_GIANT.K, P_GIANT.W, P_GIANT.Y, P_GIANT.E[0]
    c.rect(0, 0, 127, 127, S[0]); c.dither(lambda cc: cc.rect(0, 40 - f % 3 * 4, 127, 127, S[1]), f); c.rect(0, 64 - f % 2 * 3, 127, 127, S[1])
    c.dither(lambda cc: cc.rect(0, 84, 127, 127, S[2]), 1); c.rect(0, 100, 127, 127, S[3])
    up = max(0, 40 - f * 10) + (f % 2) * 2
    for k in range(5):
        x = (k * 31 - f * 7) % 150 - 10
        c.disc(x, 30 + k * 8, 10, S[2], 3)
    bx, by = 80, 130 + up
    # 거인 실루엣(몸·머리)
    c.disc(bx, by - 30, 30, K[1], 34)
    c.disc(bx - 4, by - 72, 16, K[1], 15)
    c.px(bx + 2, by - 74, E); c.px(bx + 3, by - 74, E); c.px(bx - 8, by - 74, E); c.px(bx - 7, by - 74, E)
    # 팔 + 몽둥이: 칸 0~5 들어올림, 6~8 내려찍음
    ang = [-60, -80, -100, -120, -130, -135, -60, 10, 40, 40, 40, 40][f]
    sh = (bx - 18, by - 52)
    a = math.radians(ang + 180)
    hand = (sh[0] + math.cos(a) * 22, sh[1] + math.sin(a) * 22)
    c.line([sh, hand], K[0], 9)
    tip = (hand[0] + math.cos(a) * 44, hand[1] + math.sin(a) * 44)
    c.line([hand, tip], W[0], 8); c.line([hand, tip], W[1], 3)
    c.disc(tip[0], tip[1], 9, W[0]); c.disc(tip[0] - 2, tip[1] - 2, 4, W[1])
    if f == 6:
        for k in range(4):
            c.line([(tip[0] + 8 + k * 3, tip[1] - 10 + k * 6), (tip[0] + 20 + k * 3, tip[1] - 16 + k * 6)], Y[1])
    if f >= 7:
        rr = (f - 6) * 10
        c.disc(tip[0], 112, rr, Y[0], rr * .35); c.disc(tip[0], 112, rr * .6, Y[1], rr * .2)
        for k in range(8):
            q = math.radians(200 + k * 20)
            d = rr + 6
            c.rect(tip[0] + math.cos(q) * d, 108 + math.sin(q) * d * .5, tip[0] + math.cos(q) * d + 2, 110 + math.sin(q) * d * .5, W[1])

