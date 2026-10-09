# 전투 배경 6 — 늪 (swamp-dungeon). 바닥·물체 = src-swamp/ 의 복사한 그림 함수
# (늪 풀 swamp_ground·진흙·탁한 물 PWater/murk_water·좀개구리밥·물가 진흙 띠·맹그로브·낙우송·고사목·부들·연잎·안개 자락·가라앉은 사당).
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-swamp'))
import numpy as np
from PIL import Image
import bgkit as K
import sd_art as A
from sd_art import SwampScene

SLUG = 'swamp-dungeon'
CW, CH = 40, 23
FOG1 = [K.hx(c) for c in ('#1c2620', '#2a3630', '#3a4840', '#4e5e52', '#64746a', '#7c8a7a', '#98a492')]   # 가까운 안개 속
FOG2 = [K.hx(c) for c in ('#4a5a50', '#5a6a5e', '#647466', '#6e7e70', '#7c8a7a', '#8e9a88', '#a0aa96')]   # 먼 안개 속


def fogged(im, ramp, t0=1, t1=5):
    return A.remap(im, ramp, t0=t0, t1=t1)


def mist_band(b, y, h, col, seed, x0=0, x1=640, dens=0.5):
    """가로로 깔린 안개 띠: 위·아래 가장자리가 들쭉날쭉, 속은 단색, 가장자리 한 줄은 체크 디더."""
    a = np.array(b)
    xs = np.arange(640)
    top = np.rint(y + (K.n1(xs, 23, seed) - 0.5) * h * 0.8).astype(int)
    bot = np.rint(y + h + (K.n1(xs, 17, seed + 1) - 0.5) * h * 0.6).astype(int)
    for x in range(x0, x1):
        if K.n1(x, 41, seed + 2) < 1 - dens: continue
        t, bb = top[x], bot[x]
        for yy in range(max(0, t), min(360, bb)):
            edge = yy in (t, bb - 1)
            if edge and (x + yy) % 2: continue
            a[yy, x, :3] = col
    b.paste(Image.fromarray(a, 'RGBA'))


def backdrop():
    b = K.canvas()
    K.sky(b, [(44, '#4a5c50'), (92, '#5e7062'), (134, '#748474'), (176, '#8a9886')])
    CL = ['#5e7062', '#6e7e70', '#7c8a7a', '#8e9a88']
    K.cloud(b, 150, 40, 150, 18, CL, seed=41, flat=True)
    K.cloud(b, 500, 56, 130, 16, CL, seed=43, flat=True)
    # 먼 숲 줄(가장 옅은 안개): 낙우송·맹그로브 실루엣
    for i, (x, yb) in enumerate(((-10, 160), (60, 156), (150, 160), (420, 158), (500, 154), (590, 160))):
        t = A.bald_cypress(60 + i, hc=6) if i % 2 == 0 else A.mangrove(4, 5, 70 + i)
        K.place(b, fogged(t, FOG2, 2, 5), x, yb, shadow=False)
    mist_band(b, 134, 8, K.hx('#8e9a88'), 3, dens=0.45)
    # 앵커: 물에 잠긴 옛 사당(가운데 뒤, 안개 속)
    sh = fogged(A.shrine_sunken(), FOG1, 0, 5)
    K.place(b, sh, 272, 172, shadow=False)
    sp = fogged(A.spire_sunken(), FOG2, 1, 5)
    K.place(b, sp, 392, 170, shadow=False)
    for i, (x, yb) in enumerate(((20, 172), (110, 170), (470, 172), (560, 170))):
        t = A.mangrove(5, 6, 80 + i) if i % 2 == 0 else A.bald_cypress(90 + i, hc=6)
        K.place(b, fogged(t, FOG1, 0, 4), x, yb, shadow=False)
    mist_band(b, 160, 6, K.hx('#a0aa96'), 5, dens=0.55)
    return b


def build():
    s = SwampScene('bg-swamp', CW, CH, seed=83)
    rng = random.Random(8302)
    # ---------------------------------------------------------- 땅과 물: 가운데 진흙 섬(배틀러 자리), 뒤쪽 물길, 앞 양옆 탁한 웅덩이
    LAND = set()
    for y in range(CH):
        for x in range(CW):
            d = ((x - 19.5) / 17.5) ** 2 + ((y - 18.5) / 7.6) ** 2
            if d <= 1 + 0.35 * (K.h2(x, y, 7) - 0.5) and y >= 12: LAND.add((x, y))
    for y in range(11, CH):                                              # 앞 가운데는 끝까지 땅(화면 아래로 이어진다)
        for x in range(8, 32):
            if y >= 15: LAND.add((x, y))
    POOL_L = {(x, y) for y in range(CH) for x in range(CW) if ((x - 2.5) / 4.4) ** 2 + ((y - 20.5) / 2.6) ** 2 <= 1}
    POOL_R = {(x, y) for y in range(CH) for x in range(CW) if ((x - 37.5) / 4.0) ** 2 + ((y - 19.0) / 2.8) ** 2 <= 1}
    PUD = set()                                                          # 땅 위 탁한 물웅덩이(납작, 배틀러가 밟고 선다)
    for (cx, cy, rx, ry, sd) in ((12.5, 18.6, 3.4, 1.7, 61), (27.5, 20.2, 3.8, 1.6, 62)):
        PUD |= {(x, y) for y in range(CH) for x in range(CW) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.45 * (K.h2(x, y, sd) - 0.5)}
    LAND -= POOL_L | POOL_R | PUD
    MUDC = set()
    for (x, y) in LAND:                                                  # 진흙: 바깥 물가 띠만 — 땅 속 얼룩 금지(웅덩이 둘레는 물가 띠 그림이 맡는다)
        near = any((x + dx, y + dy) not in LAND and (x + dx, y + dy) not in PUD for dx in range(-1, 2) for dy in range(-1, 2))
        if near: MUDC.add((x, y))
    s.set_terrain(LAND, set(), MUDC)
    s.canopies.append((0, -400, 640, 1300))                             # 늪 숲 그늘: 바닥 풀은 그늘 풀
    # ---------------------------------------------------------- 물가: 맹그로브(뿌리가 물에)·고사목·부들·연잎·통나무
    s.at(A.mangrove(5, 6, 1), -1, 13, block=None)
    s.at(A.mangrove(4, 5, 13), 35, 13, block=None)
    s.at(A.bald_cypress(7), 7, 12, block=None)
    s.at(A.dead_tree(4, wet=True), 31, 11, block=None)
    s.at(A.dead_tree(5, wet=False), 4, 16, block=None, dx=4)
    s.at(A.mangrove(3, 4, 9), 37, 22, block=None)
    for (x, y, sd) in ((12, 12, 1), (27, 12, 2), (18, 11, 3), (23, 11, 4)):
        s.at(A.cattail(39 + sd, 4, 2), x, y, block=None, shadow=False)
    for (x, y, sd) in ((5, 19, 5), (7, 21, 6), (34, 17, 7), (32, 21, 8), (9, 14, 9), (30, 15, 10)):
        s.at(A.reed_tuft(41 + sd), x, y, block=None, shadow=False)
    for (x, y, sd, fl) in ((1, 19, 1, True), (3, 21, 2, False), (36, 18, 3, False), (38, 20, 4, True), (15, 11, 5, False), (25, 11, 6, True)):
        s.at(A.lily_cluster(43 + sd, fl), x, y, block=None, shadow=False)
    s.at(A.log_water(27), 20, 11, block=None, shadow=False)
    s.at(A.skull_stake(37), 6, 14, block=None)
    s.at(A.stone_lantern(21, lean=1), 36, 16, block=None, dx=4)
    s.at(A.stump_fungus(29), 2, 15, block=None, shadow=False)
    s.at(A.swamp_mushrooms(31), 35, 15, block=None, shadow=False)
    s.at(A.bones(35), 8, 22, block=None, shadow=False)
    s.at(A.rock_water(False, 41), 0, 22, block=None, shadow=False)
    s.top_overlays.append((A.fog_wisp(25, 6, 2), 0, 12 * 16))
    s.top_overlays.append((A.fog_wisp(26, 6, 2), 31 * 16, 12 * 16 + 6))
    s.top_overlays.append((A.wisp(23, 1), 4 * 16, 13 * 16))
    s.top_overlays.append((A.wisp(24, 2), 36 * 16, 15 * 16))
    im = s.render()
    hz = K.horizon_line(seed=19, base=176, amp=2)
    out = K.compose(backdrop(), im, s.objs, hz, rim=None, tufts=None, seed=19)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
