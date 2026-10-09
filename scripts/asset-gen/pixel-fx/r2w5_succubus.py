"""서큐버스(succubus) 이펙트 1종 — b5. 색: 분홍 하트, 자홍 테, 흰 반짝.
입맞춤(투사체 32px 루프: 왼쪽으로 날아가는 하트, 뒤에 반짝이 꼬리). 첫 칸은 왼쪽(적 쪽)을 본다."""
from lib_r2w5 import *

P_KISS = Pal(P=['#6a1a4a', '#c8408a', '#ff8ac8', '#ffd0e8'], W=['#ffffff'])


@sheet('succubus_kiss', 32, 4, 'projectile', P_KISS, peak=[0, 1, 2])
def succubus_kiss(c, f):
    P, W = P_KISS.P, P_KISS.W[0]
    s = [1.9, 2.1, 1.9, 1.7][f]
    bob = [0, -1, 0, 1][f]
    heart(c, 11, 15 + bob, s, P[2], P[3], P[0])
    # 꼬리(오른쪽 = 뒤)
    for k in range(4):
        x = 20 + k * 3
        y = 15 + bob + math.sin(f * 1.6 + k) * 2
        if (k + f) % 2 == 0: c.px(x, y, W)
        else: c.px(x, y, P[1])
    c.px(8, 11 + bob, W)

