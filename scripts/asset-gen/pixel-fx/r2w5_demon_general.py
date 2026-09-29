"""마장군(demon_general) 이펙트 1종 — b5. 색: 보라 마검, 검은 하늘, 붉은 균열, 금 테 손잡이.
종말의 검(갈라진 하늘에서 거대한 보랏빛 대검이 내려와 땅에 박히며 붉은 균열과 검은 기둥이 솟음)."""
from lib_r2w5 import *

P_DOOM = Pal(K=['#06040c', '#140a24', '#281640'], M=['#2a1450', '#5a2a8a', '#a070e0', '#e0c8ff'], R=['#6b2926', '#c83a3a', '#ff7a5a'], Y=['#966517', '#e0b040'])


@sheet('demon_general_doom_sky', 128, 12, 'screen', P_DOOM, peak=[3, 7, 9])
def demon_general_doom_sky(c, f):
    K, M, R, Y = P_DOOM.K, P_DOOM.M, P_DOOM.R, P_DOOM.Y
    c.rect(0, 0, 127, 127, K[0]); c.dither(lambda cc: cc.rect(0, 40 - f % 3 * 4, 127, 127, K[1]), f); c.rect(0, 100, 127, 127, K[2])
    # 하늘 균열
    if f >= 1:
        c.line(jag(20, 4, 108, 10, 8, 4, rng('doomcrack', 1)), R[1], 2)
        c.dither(lambda cc: cc.line(jag(20, 4, 108, 10, 8, 4, rng('doomcrack', 1)), R[2], 4), f)
    if f <= 3:      # 하늘이 갈라지며 보라 빛이 새어 나옴
        for k in range(6):
            a = math.radians(60 + k * 12)
            c.line([(64, 4), (64 + math.cos(a) * (30 + f * 16), 4 + math.sin(a) * (30 + f * 16))], M[1] if k % 2 else M[0], 2)
        c.disc(64, 6, 6 + f * 3, M[2], 3 + f)
    t = min(1, max(0, (f - 1) / 5))
    tipy = lerp(-10, 102, t * t)
    top = tipy - 96
    # 대검
    c.poly([(58, top + 20), (70, top + 20), (70, tipy - 12), (64, tipy), (58, tipy - 12)], M[1])
    c.poly([(58, top + 20), (63, top + 20), (63, tipy - 4), (58, tipy - 12)], M[2])
    c.line([(64, top + 22), (64, tipy - 6)], M[3])
    c.rect(46, top + 14, 82, top + 20, Y[0]); c.rect(46, top + 14, 82, top + 15, Y[1])
    c.rect(61, top, 67, top + 14, K[2]); c.disc(64, top - 2, 4, Y[1])
    if f >= 6:
        rr = (f - 5) * 10
        for k in range(7):     # 붉은 균열이 바닥에 퍼짐
            a = math.radians(180 + k * 30)
            pts = jag(64, 104, 64 + math.cos(a) * rr * 1.4, 104 + math.sin(a) * rr * .3, 4, 2, rng('floor', k))
            c.line(pts, R[1], 2)
        for k in range(4):     # 검은 기둥
            x = 20 + k * 30
            h = min(80, (f - 5) * 16) - (k % 2) * 10
            c.rect(x - 3, 104 - h, x + 3, 104, M[0]); c.line([(x - 1, 104 - h), (x - 1, 104)], M[1])
        c.ring(64, 104, rr, M[2], 2, rr * .25)

