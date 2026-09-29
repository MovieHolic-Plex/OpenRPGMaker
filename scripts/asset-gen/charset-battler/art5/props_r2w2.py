"""r2w2(a3 People1·p1) 소품 격자 — rig_r2w2.CUSTOM 에 덧붙인다 (2026-09-29).

좌표계는 rig_r2w2.Painter: u = 손에서 앞(끝) 쪽, v = 옆(0도일 때 +v 가 위). 정수 좌표의 선·다각형·원만 쓴다.
"""
import math
import rig_r2w2 as R
from rig_r2w2 import PC

PC.update(dict(
    leaf=(92, 176, 68, 255), leaf_d=(40, 104, 44, 255), leaf_l=(170, 226, 110, 255),
    petal=(255, 128, 170, 255), petal_d=(200, 60, 110, 255), petal_l=(255, 206, 226, 255),
    cover=(120, 40, 44, 255), cover_d=(70, 20, 28, 255), page=(250, 244, 222, 255),
    gun=(52, 54, 64, 255), gun_l=(140, 146, 160, 255), grip=(110, 64, 36, 255),
    tea=(248, 248, 250, 255), tea_d=(170, 176, 196, 255),
))


def draw_book(p):
    """펼쳐 든 책: 손은 책등 아래."""
    p.poly([(0, -1), (7, -1), (7, 6), (0, 6)], 'cover')
    p.poly([(1, 0), (6, 0), (6, 5), (1, 5)], 'page')
    for v in (1, 3):
        p.seg(2, v, 5, v, 'paper_d')
    p.seg(0, -1, 0, 6, 'cover_d')
    p.dot(6, 5, 'gold')


def draw_pickaxe(p):
    p.seg(-8, 0, 12, 0, 'wood')
    p.seg(-8, 1, 12, 1, 'wood_d')
    p.seg(-8, -1, 11, -1, 'wood_l')
    # 머리: 자루 끝에서 양쪽으로 휘어진 쇠 날(한쪽 뾰족·한쪽 넓적)
    pts = [(11, -1), (13, -4), (14, -7), (12, -9), (13, -5), (11, -3)]
    p.poly([(11, -2), (13, -2), (15, -6), (14, -9), (13, -9), (12, -5)], 'iron')
    p.poly([(11, 2), (13, 2), (14, 5), (12, 7), (11, 6)], 'iron')
    p.seg(13, -3, 14, -8, 'iron_l')
    p.seg(13, 3, 13, 5, 'iron_l')
    p.disc(12, 0, 1.4, 'iron')
    p.dot(12, 0, 'steel_l')


def draw_pitchfork(p):
    p.seg(-9, 0, 12, 0, 'wood')
    p.seg(-9, 1, 12, 1, 'wood_d')
    p.seg(12, -3, 12, 4, 'iron', 1)
    for v in (-3, 0, 3):
        p.seg(12, v, 18, v, 'iron_l', 1)
        p.dot(19, v, 'steel_h')
    p.seg(12, 0, 13, 0, 'iron')


def draw_cane(p):
    """촌장 지팡이: 곧은 막대 + 끝에 둥근 옹이 손잡이와 붉은 끈."""
    p.seg(-4, 0, 16, 0, 'wood')
    p.seg(-4, 1, 16, 1, 'wood_d')
    p.disc(-5, 0, 1.8, 'wood_l')
    p.dot(-5, -1, 'straw_l')
    p.seg(0, 1, 0, 4, 'red', 1)
    p.dot(0, 5, 'red_d')


def draw_herbs(p):
    """약초 다발: 짧은 줄기 묶음 + 잎 부채꼴."""
    p.seg(-2, 0, 4, 0, 'green_d')
    p.seg(-2, 1, 4, 1, 'green_d')
    p.seg(1, -1, 1, 2, 'rope', 1)
    for i, a in enumerate((-40, -20, 0, 20, 40)):
        t = math.radians(a)
        u, v = 4 + 6 * math.cos(t), 6 * math.sin(t)
        p.seg(4, 0, u, v, 'leaf_d')
        p.disc(u, v, 1.3, 'leaf' if i % 2 else 'leaf_l')
    p.dot(10, 0, 'petal_l')


def draw_ladle(p):
    """할머니 약 국자(탕약 휘젓기)."""
    p.seg(-5, 0, 9, 0, 'wood')
    p.seg(-5, 1, 9, 1, 'wood_d')
    p.disc(11, 0, 2.4, 'wood_d')
    p.disc(11, -0.5, 1.4, 'leaf')
    p.dot(11, -1, 'leaf_l')


def draw_revolver(p):
    """리볼버: 손(@)=손잡이, 총신이 앞으로."""
    p.poly([(-1, 0), (1, 0), (2, 4), (-1, 4)], 'grip')
    p.seg(0, 3, 1, 3, 'wood_d')
    p.poly([(-1, -1), (4, -1), (4, 1), (-1, 1)], 'gun')
    p.disc(3, 0, 1.4, 'gun_l')
    p.seg(4, -1, 10, -1, 'gun')
    p.seg(4, 0, 10, 0, 'gun_l')
    p.dot(10, -1, 'steel_h')
    p.dot(-1, -2, 'gun')
    p.dot(3, 2, 'gun')


def draw_tray(p):
    """은쟁반 + 찻잔. 쟁반은 v 축(위)을 따라 평평하게, 손은 쟁반 밑."""
    p.seg(-5, 1, 6, 1, 'silver')
    p.seg(-5, 2, 6, 2, 'tea_d')
    p.poly([(-2, 2), (2, 2), (2, 6), (-2, 6)], 'tea')
    p.seg(-2, 6, 2, 6, 'tea_d')
    p.dot(3, 4, 'tea_d')
    p.seg(-1, 3, 1, 3, 'wood')


def draw_basket(p):
    """꽃바구니: 둥근 손잡이 + 바구니에 꽃."""
    p.ring(0, -3, 3, 'straw_d')
    p.poly([(-4, -4), (4, -4), (3, -9), (-3, -9)], 'straw')
    p.seg(-3, -6, 3, -6, 'straw_d')
    for u, c in ((-3, 'petal'), (-1, 'yellow'), (1, 'petal_l'), (3, 'petal')):
        p.disc(u, -3.5, 1.2, c)
    p.dot(0, -3, 'leaf')


def draw_bouquet(p):
    """꽃다발 지팡이(꽃집 아가씨 무기): 리본 묶은 줄기 + 꽃 머리."""
    p.seg(-4, 0, 7, 0, 'leaf_d')
    p.seg(-4, 1, 7, 1, 'green_d')
    p.seg(1, -2, 1, 3, 'petal_d', 1)
    p.dot(1, 4, 'petal')
    p.disc(10, 0, 3, 'petal')
    p.disc(9, -2, 1.5, 'petal_l')
    p.disc(11, 2, 1.5, 'yellow')
    p.disc(12, -1, 1.2, 'petal_d')
    p.dot(10, 0, 'white')
    p.disc(7, 3, 1, 'leaf')
    p.disc(7, -3, 1, 'leaf_l')


def draw_short_sword(p):
    """견습 기사 짧은 검(나무 손잡이·넓은 코등이)."""
    p.seg(-3, 0, -1, 0, 'wood', 2)
    p.seg(0, -3, 0, 3, 'brass', 1)
    p.dot(0, -3, 'brass_l')
    p.poly([(1, -1.5), (11, -1.5), (13, 0), (11, 1.5), (1, 1.5)], 'steel_l')
    p.seg(1, 0, 12, 0, 'steel_h')
    p.seg(1, 1, 11, 1, 'steel')


def draw_buckler(p):
    """견습 기사 작은 방패(파랑 바탕·노란 십자)."""
    p.disc(0, 0, 4, 'iron')
    p.disc(0, 0, 3, 'blue')
    p.seg(-2, 0, 2, 0, 'yellow', 1)
    p.seg(0, -2, 0, 2, 'yellow', 1)
    p.dot(0, 0, 'white')


def draw_slim_blade(p):
    """검객 가는 장검: 긴 외날 + 청색 감개."""
    p.seg(-4, 0, -1, 0, 'blue_d', 2)
    p.dot(-4, 0, 'brass')
    p.seg(0, -2, 0, 2, 'brass', 1)
    p.poly([(1, -1), (17, -1), (19, 0), (17, 1), (1, 1)], 'steel_l')
    p.seg(1, -1, 18, -1, 'steel_h')
    p.seg(1, 1, 17, 1, 'steel')


def draw_prayer_staff(p):
    """승려 선장(짧은 금고리 지팡이)."""
    p.seg(-8, 0, 13, 0, 'wood_d')
    p.seg(-8, -1, 13, -1, 'wood')
    p.ring(15, 0, 2.5, 'gold')
    p.dot(15, 0, 'brass_l')
    p.dot(15, 3, 'brass_d')
    p.dot(15, -3, 'brass_d')


def draw_potion_red(p):
    p.disc(0, -3, 2.2, 'red')
    p.dot(-1, -4, 'petal_l')
    p.seg(0, 0, 0, -1, 'silver')
    p.dot(0, 1, 'wood')


def draw_tea_cup(p):
    p.poly([(-2, 0), (2, 0), (2, -3), (-2, -3)], 'tea')
    p.seg(-2, 0, 2, 0, 'tea_d')
    p.dot(3, -2, 'tea_d')
    p.dot(0, -4, 'white')
    p.dot(1, -5, 'paper_d')


R.CUSTOM.update(dict(book=draw_book, pickaxe=draw_pickaxe, pitchfork=draw_pitchfork, cane=draw_cane, herbs=draw_herbs,
                     ladle=draw_ladle, revolver=draw_revolver, tray=draw_tray, basket=draw_basket, bouquet=draw_bouquet,
                     short_sword=draw_short_sword, buckler=draw_buckler, slim_blade=draw_slim_blade,
                     prayer_staff=draw_prayer_staff, potion_red=draw_potion_red, tea_cup=draw_tea_cup))

