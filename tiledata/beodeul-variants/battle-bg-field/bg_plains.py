# 전투 배경 1 — 초원 하이로드 (plains-highroad). 바닥·물체 = src-plains/ 의 복사한 그림 함수
# (버들항 city_v6 땅·흙길 오토타일·참나무/덤불·망루 폐허·들꽃·키 큰 풀).
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-plains'))
import numpy as np
from PIL import Image
import bgkit as K
from bdA import Scene, tree_look
import plains_auto as PA
import plains_pieces as PP

SLUG = 'plains-highroad'
CW, CH = 40, 23
SEED = 19            # 땅 잡음 씨앗: 배틀러 자리에 그늘 풀 덩이가 가장 적은 값(1~59 탐색)


def road_layer(road):
    sheet = PA.dirt_road()
    def on(x, y): return 0 <= y < CH and (x < 0 or x >= CW or road[y][x])
    lay = Image.new('RGBA', (CW * 16, CH * 16))
    for y in range(CH):
        for x in range(CW):
            if road[y][x]:
                n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
                lay.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
    return lay


def backdrop():
    b = K.canvas()
    K.sky(b, [(44, '#6aa0dc'), (92, '#8cbce6'), (132, '#b4dcf4'), (176, '#d4ecf6')])
    CL = ['#8cbce6', '#c8e4f4', '#eef8ff', '#f7fdff']
    K.cloud(b, 96, 58, 96, 24, CL, seed=3)
    K.cloud(b, 318, 34, 60, 15, CL, seed=5)
    K.cloud(b, 540, 72, 120, 28, CL, seed=7)
    K.cloud(b, 420, 112, 54, 9, ['#b4dcf4', '#c8e4f4', '#eef8ff', '#f7fdff'], seed=9, flat=True)
    K.cloud(b, 232, 122, 40, 7, ['#b4dcf4', '#c8e4f4', '#eef8ff', '#f7fdff'], seed=11, flat=True)
    # 먼 산(푸른 회색) → 먼 언덕(옅은 초록) → 가까운 언덕(풀색). 왼쪽 위 빛.
    K.ridge(b, 150, 34, ['#5a7a8e', '#7a98aa', '#8fb0c0', '#b0ccd8'], seed=21, sc=90, sc2=23,
            peaks=[(60, 52, 70), (250, 40, 60), (600, 58, 80)], tex=0.05)
    K.ridge(b, 166, 18, ['#3f7a2c', '#5e9a5a', '#78b06a', '#9ccc84'], seed=31, sc=70, sc2=15, tex=0.10)
    # 먼 언덕 위 무너진 망루 실루엣(작게 새로 찍음: 원탑 + 계단꼴로 무너진 윗부분 + 아치 구멍)
    tower_silhouette(b, 186, 150)
    return b


def tower_silhouette(b, x0, ybot):
    """먼 망루 실루엣: 원경 산보다 한 단 짙은 단색 몸 + 왼쪽 빛 테, 위는 계단꼴로 무너지고 화살구멍·아치 입구가 뚫렸다."""
    a = np.array(b)
    D, M, L = (K.hx(c) for c in ('#3e5a6e', '#5a7a8e', '#7a98aa'))
    w, h = 11, 28
    tops = [3, 1, 0, 0, 1, 2, 2, 5, 7, 10, 12]
    for i in range(w):
        for j in range(tops[i], h):
            y = ybot - h + j; x = x0 + i
            c = L if i < 3 else M
            if i == w - 1 or (i >= 8 and j < tops[i] + 2): c = D
            a[y, x, :3] = c
    for j in range(18, 28):                                   # 아치 입구
        for i in (4, 5, 6):
            if j > 19 or i == 5: a[ybot - h + j, x0 + i, :3] = D
    for j in (9, 10, 11): a[ybot - h + j, x0 + 5, :3] = D     # 화살구멍
    # 서쪽으로 뻗은 낮은 성벽 토막(끝은 계단꼴로 무너짐)
    for i in range(20):
        hh = 6 if i > 6 else (2 + i * 4 // 7)
        for j in range(hh):
            a[ybot - 1 - j, x0 - 20 + i, :3] = L if j == hh - 1 else M
    b.paste(Image.fromarray(a, 'RGBA'))


def build():
    s = Scene('bg-plains', CW, CH, seed=SEED)
    rng = random.Random(7202)
    # ---------------------------------------------------------- 흙길(하이로드): 왼쪽 뒤에서 내려와 가운데를 가로지른다
    road = [[False] * CW for _ in range(CH)]
    def ry(x): return 15
    for x in range(CW):
        for y in (ry(x), ry(x) + 1): road[y][x] = True
    s.overlays.append((road_layer(road), 0, 0))
    G = {n: getattr(PP, n)() for n in ('flowers_red', 'flowers_yellow', 'flowers_white', 'flowers_blue', 'tallgrass_a', 'tallgrass_b',
                                         'tallgrass_c', 'boulder', 'rockpile', 'rocks_small', 'thorn_bush', 'berry_bush', 'stump_s',
                                         'watchtower_ruin', 'ruin_wall_w', 'rubble_heap', 'rubble_small', 'fallen_block', 'ruin_chips',
                                         'oak_old', 'signpost_fork', 'waystone', 'dead_tree', 'menhir', 'mushrooms')}
    FL = [G['flowers_red'], G['flowers_yellow'], G['flowers_white'], G['flowers_blue']]
    TG = [G['tallgrass_a'], G['tallgrass_b'], G['tallgrass_c']]
    def side(x): return x * 16 < 112 or x * 16 >= 576        # 배틀러 자리 밖(양옆)

    # ---------------------------------------------------------- 뒤쪽 줄(지평선 10~11줄): 왼쪽 숲 덩이, 오른쪽 무너진 망루+성벽+잔해
    s.tree('oakA', 0, 10, look=0); s.tree('oakB', 3, 11, look=2); s.tree('bushD', 5, 10, look=1)
    s.at(G['oak_old'], -1, 13, block=None)
    s.tree('bushC', 9, 10, look=3); s.tree('bushE', 13, 10, look=0)
    # 망루: 오른쪽 뒤. 성벽 토막이 망루 밑으로 1칸 겹쳐 서쪽으로 뻗다가 잔해로 끝난다(원 지도와 같은 결합)
    TX = 30
    s.at(G['ruin_wall_w'], TX - 6, 10, block=None)
    s.at(G['watchtower_ruin'], TX, 10, block=None, sorty=11 * 16 + 2)
    s.at(PP.ruin_steps(), TX + 1, 11, block=None, shadow=False)
    s.at(G['rubble_heap'], TX - 8, 10, block=None, dx=4)
    s.at(G['rubble_small'], TX - 3, 11, block=None, dx=-6, shadow=False)
    s.at(G['fallen_block'], TX + 4, 11, block=None, dx=2, shadow=False)
    s.at(G['ruin_chips'], TX - 1, 11, block=None, shadow=False)
    s.tree('bushE', TX + 5, 10, look=2); s.tree('oakB', 37, 10, look=1); s.tree('bushC', 35, 11, look=0)
    s.at(G['dead_tree'], 21, 10, block=None)
    # ---------------------------------------------------------- 양옆 가장자리(앞쪽): 바위·덤불·이정표·키 큰 풀
    s.at(G['signpost_fork'], 2, 15, block=None)
    s.at(G['waystone'], 4, 17, block=None)
    s.at(G['boulder'], 1, 19, block=None)
    s.at(G['thorn_bush'], 5, 20, block=None, shadow=False)
    s.tree('bushD', -1, 22, look=3)
    s.at(G['rockpile'], 36, 17, block=None, shadow=False)
    s.at(G['berry_bush'], 37, 20, block=None, shadow=False)
    s.at(G['boulder'], 35, 21, block=None, dx=6)
    s.tree('bushE', 38, 22, look=1)
    s.at(G['stump_s'], 6, 13, block=None, shadow=False)
    s.at(G['menhir'], 37, 14, block=None)
    s.at(G['mushrooms'], 34, 19, block=None, shadow=False)
    # 들꽃·키 큰 풀 덩이: 양옆 + 뒤쪽 띠(배틀러 자리 위·아래 끝만)
    for (cx, cy, r) in ((3, 12.5, 2.0), (36.5, 12.5, 2.2), (2, 17.5, 1.8), (37, 18.5, 2.0), (12, 11.6, 1.2), (19, 11.6, 1.1), (26, 11.8, 1.0), (2.5, 21.5, 1.5), (37.5, 21.5, 1.4)):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r * 1.4) - 1, int(cx + r * 1.4) + 2):
                if not (0 <= x < CW and 11 <= y < CH - 1) or road[y][x]: continue
                if not side(x) and y > 11: continue
                d = ((x - cx) / (r * 1.4)) ** 2 + ((y - cy) / r) ** 2
                if d > 0.9 + (rng.random() - 0.5) * 0.5: continue
                if rng.random() < 0.6:
                    t = rng.choice(TG)
                    s.at(t if t.width == 16 else TG[0], x, y, block=None, dx=rng.randrange(-2, 3), dy=rng.randrange(-1, 2), shadow=False)
                if rng.random() < 0.85:
                    s.at(FL[(x // 3 + y // 2) % 4], x, y, block=None, dx=rng.randrange(-3, 4), dy=rng.randrange(-3, 4), shadow=False)
    # 앞 모서리 키 큰 풀(화면 아래 가림 띠 바로 위)
    for x in list(range(0, 7)) + list(range(36, 40)):
        if rng.random() < 0.7:
            s.at(TG[rng.randrange(3)] if x not in (6, 39) else TG[0], x, 20, block=None, dx=rng.randrange(-2, 3), shadow=False)
    s.canopies += []
    im = s.render()
    hz = K.horizon_line(seed=5, base=174, amp=3)
    out = K.compose(backdrop(), im, s.objs, hz, rim='#3f7a2c', tufts=['#4b8232', '#58a035', '#73b83e'], seed=5)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
