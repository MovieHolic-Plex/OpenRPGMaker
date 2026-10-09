# 전투 배경 2 — 고대 숲 (ancient-forest). 바닥·물체 = src-forest/af_art.py(복사) — 버들항 그늘 풀·이끼/낙엽 오토타일·거목·옛 제단.
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-forest'))
import numpy as np
from PIL import Image
import bgkit as K
import af_art as A
from af_art import Scene, terrain7

SLUG = 'ancient-forest'
CW, CH = 40, 23
SEED = 71
_sv = terrain7.sand_variants
terrain7.sand_variants = lambda: _sv(lawn_xy=(112, 2144))        # 숲길 흙 가장자리는 그늘 풀로 번진다(원 지도와 같다)


def trunk_column(seed, hw, h):
    """화면 위로 이어지는 거목 줄기 한 기둥(수관은 화면 밖): 원통 명암 껍질·이끼·덩굴 + 밑동 판근."""
    W_ = int(hw * 2 + 48); im = A.new(W_, h); px = im.load(); cx = W_ / 2
    tb = h - 7
    A.trunk(px, W_, h, cx, 0, tb, hw, hw + 7, seed)
    for (dx, dy, L, th) in ((-1.0, 0.2, 16, 5), (-0.6, 0.38, 11, 4), (1.0, 0.18, 15, 5), (0.6, 0.4, 10, 4)):
        A.root(px, W_, h, cx + dx * (hw + 2), tb - 4, dx, dy, L, th, seed)
    A.ivy(px, W_, h, int(cx - hw * 0.4), 10 + seed % 20, tb - 10, seed + 5)
    return im


def giants(seeds):
    return {sd: A.giant_tree(sd, wc, hc, lean=(sd % 3 - 1) * 2) for sd, wc, hc in seeds}


def backdrop(floor_img):
    """뒤 숲: 짙은 잎 바탕 → 먼 줄기 실루엣 → 그늘 속 거목 두 줄(버들항 그림자 곱하기) → 먼 바닥(그늘 바닥)."""
    b = K.canvas(K.hx('#071528'))
    a = np.array(b)
    a[:, :, :3] = K.hx('#143a27')
    # 잎 사이 빛 틈(하늘이 아니라 먼 잎에 비친 빛) — 작은 점 덩이, 위쪽에만
    rng = np.random.RandomState(4)
    for _ in range(26):
        x, y = rng.randint(0, 640), rng.randint(0, 60)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 0)):
            if rng.rand() < 0.8 and 0 <= x + dx < 640: a[y + dy, x + dx, :3] = K.hx('#4b8232') if rng.rand() < 0.6 else K.hx('#8fd24a')
    b = Image.fromarray(a, 'RGBA')
    # 먼 바닥: 실제 바닥 렌더를 두 번 그늘 곱하기(같은 질감, 더 깊은 그늘)
    fl = K.shade(floor_img, times=2)
    b.paste(fl.crop((0, 130, 640, 360)), (0, 130))
    # 그늘 속 거목 두 줄(먼 줄 = 두 번 곱하기, 가운데 줄 = 한 번)
    G = giants([(11, 6, 8), (12, 6, 8), (13, 5, 7), (14, 6, 8), (15, 6, 8), (16, 5, 7), (17, 6, 8)])
    # 숲 지붕: 거목 수관(윗부분)만 잘라 맨 위에 촘촘히 — 하늘 대신 잎 천장
    for i, (sd, x, y) in enumerate(((13, -40, -64), (15, 50, -70), (11, 140, -60), (16, 230, -72), (12, 320, -62), (17, 410, -70),
                                    (14, 500, -64), (13, 590, -60), (15, 0, -34), (12, 190, -40), (16, 380, -36), (11, 560, -38))):
        cr = G[sd].crop((0, 0, G[sd].width, int(G[sd].height * 0.55)))
        K.blit(b, K.shade(cr, times=2 if i < 8 else 1), x, y)
    for sd, x, yb in ((11, -30, 150), (13, 120, 146), (15, 250, 150), (16, 360, 146), (12, 470, 150), (17, 580, 148)):
        K.place(b, K.shade(G[sd], times=2), x, yb, shadow=False)
    # 「고목 줄기 벽」: 원 숲의 줄기 그림 함수(trunk·root·ivy)로 굵은 기둥을 세운다. 먼 줄 = 그늘 두 번, 가까운 줄 = 한 번.
    for i, (x, hw, yb, k) in enumerate(((10, 15, 158, 2), (96, 12, 156, 2), (196, 16, 160, 2), (300, 13, 156, 2), (430, 15, 158, 2),
                                        (530, 13, 157, 2), (620, 16, 160, 2), (40, 20, 170, 1), (150, 17, 168, 1), (246, 15, 166, 1),
                                        (392, 18, 168, 1), (482, 16, 167, 1), (590, 20, 170, 1))):
        K.blit(b, K.shade(trunk_column(30 + i, hw, yb + 8), times=k), x - hw - 22, -8)
    return b


def build():
    s = Scene('bg-forest', CW, CH, seed=SEED)
    rng = random.Random(7102)
    # ---------------------------------------------------------- 바닥: 그늘 풀(거목 수관 아래) + 이끼 깔개·낙엽 자리 + 제단으로 가는 옛 흙길
    s.canopies.append((0, -400, 640, 1300))                            # 숲 지붕 그늘이 바닥 전체를 덮는다(그늘 풀)
    moss = K.blob_mask(CW, CH, 2, 17, 3.2, 3.0, 3, jag=0.7)
    moss2 = K.blob_mask(CW, CH, 38, 17, 3.0, 3.2, 5, jag=0.7)
    moss3 = K.blob_mask(CW, CH, 20, 12.2, 3.0, 0.9, 6)
    litter = K.blob_mask(CW, CH, 6, 12.5, 2.2, 1.0, 7)
    litter2 = K.blob_mask(CW, CH, 33, 12.5, 2.0, 1.0, 8)
    M = [[(moss[y][x] or moss2[y][x] or moss3[y][x]) and y >= 12 for x in range(CW)] for y in range(CH)]
    L = [[(litter[y][x] or litter2[y][x]) and not M[y][x] for x in range(CW)] for y in range(CH)]
    # 이끼 방석: 외톨이 칸(오토타일 0번)·두 칸 짝을 양옆·뒤쪽에 흩는다(덩이 상자 금지)
    msheet = A.autotile_moss(); mlay = Image.new('RGBA', (CW * 16, CH * 16))
    def mcell(n): return msheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16))
    for (x, y, kind) in ((0, 14, 2), (1, 16, 0), (3, 17, 0), (0, 19, 2), (5, 15, 0), (2, 21, 0), (6, 19, 0),
                         (36, 14, 0), (38, 15, 2), (35, 17, 0), (37, 19, 2), (34, 21, 0), (33, 15, 0),
                         (10, 12, 0), (27, 12, 2), (31, 11, 0)):
        if kind == 2: mlay.alpha_composite(mcell(2), (x * 16, y * 16)); mlay.alpha_composite(mcell(8), (x * 16 + 16, y * 16))
        else: mlay.alpha_composite(mcell(0), (x * 16, y * 16))
    s.overlays.append((mlay, 0, 0))
    pav = Image.new('RGBA', (CW * 16, CH * 16)); pp = pav.load()
    def paved(X, Y):
        n = A.vnoise(X, Y, 14, 77) * 0.75 + A.vnoise(X, Y, 4, 78) * 0.25
        d = abs(X / 16 - 20) / 9.5 + max(0, Y / 16 - 11.2) / 1.6
        return Y >= 172 and n - d * 0.55 > 0.05
    for Y in range(140, 16 * 16):
        for X in range(8 * 16, 32 * 16):
            if paved(X, Y): pp[X, Y] = A.flag_tex(X, Y) + (255,)
    for Y in range(140, 16 * 16):
        for X in range(8 * 16, 32 * 16):
            if pp[X, Y][3] and not all(pp[X + dx, Y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): pp[X, Y] = A.ST[1] + (255,)
    s.overlays.append((pav, 0, 0))
    # ---------------------------------------------------------- 앞 줄 거목(양옆 = 「고목 줄기 벽」의 앞면)
    G = giants([(1, 7, 11), (3, 7, 11), (5, 6, 10), (7, 6, 10)])
    s.sprite(G[1], -40, 12 * 16 - G[1].height, (), shadow=True)
    s.sprite(G[5], 56, 11 * 16 - G[5].height + 4, (), shadow=True)
    s.sprite(G[3], 470, 11 * 16 - G[3].height + 2, (), shadow=True)
    s.sprite(G[7], 568, 12 * 16 - G[7].height + 6, (), shadow=True)
    # ---------------------------------------------------------- 앵커: 옛 제단(뒤 가운데) — 제단돌 + 화로 둘 + 부러진 기둥 + 수호상 + 잔해
    s.at(A.altar_stone(), 18, 10, block=None)
    s.at(A.brazier_stone(), 17, 10, block=None)
    s.at(A.brazier_stone(seed=18), 21, 10, block=None)
    s.at(A.pillar(4), 15, 10, block=None)
    s.at(A.pillar(4, broken=22, seed=24), 24, 10, block=None)
    s.at(A.statue_guardian(2), 12, 11, block=None, dx=4)
    s.at(A.statue_guardian(3).transpose(Image.FLIP_LEFT_RIGHT), 26, 11, block=None, dx=-4)
    s.at(A.blocks_fallen(2, 13), 22, 11, block=None, dx=6, shadow=False)
    s.at(A.rubble(19), 14, 11, block=None, dx=-2, shadow=False)
    s.at(A.pillar_drum(6), 25, 12, block=None, dx=10, shadow=False)
    # ---------------------------------------------------------- 양옆 가장자리 소품: 이끼 바위·고사리·빛 버섯·뿌리·통나무·그루터기
    s.at(A.boulder_moss(), 0, 15, block=None)
    s.at(A.fern_giant(12), 5, 13, block=None, dx=4)
    s.at(A.glow_mushroom_big(), 2, 18, block=None)
    s.at(A.root_tangle(), 4, 20, block=None, shadow=False)
    s.at(A.log_mossy(), 0, 21, block=None, shadow=False)
    s.at(A.stump_giant(), 36, 15, block=None, dx=-4)
    s.at(A.fern_giant(40), 35, 13, block=None, dx=6)
    s.at(A.glow_mushrooms(31), 37, 18, block=None, shadow=False)
    s.at(A.boulder_moss(False, 27), 35, 20, block=None, dx=10)
    s.at(A.glowbells(), 38, 20, block=None, shadow=False)
    s.at(A.root_tangle(44), 33, 21, block=None, dx=8, shadow=False)
    s.at(A.boulder_moss(False, 28), 29, 11, block=None, shadow=False)
    s.at(A.glowbells(36), 9, 11, block=None, shadow=False)
    im = s.render()
    hz = K.horizon_line(seed=9, base=176, amp=2)
    out = K.compose(backdrop(im), im, s.objs, hz, rim=None, tufts=['#205030', '#143a27'], seed=9)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
