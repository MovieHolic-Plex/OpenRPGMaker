# 자연 숲 마당 데모 맵(64x48) — 조수가 따라 할 칠 순서: ① 맨 바탕 표본 → ② 땅 덩이 오토타일(길·풀숲·연못) + 줄기 벽
# → ③ 땅 장식 → ④ 물체 → ⑤ 위층 오토타일(울타리·수관 테·수관 속 어둠).
# 구역: 북서 = 큰 나무 숲 마당 · 북동 = 오두막과 울타리 채소밭 · 남서 = 바위 풀숲 · 남동 = 돌 둘레 연못 · 가운데 = 네 갈래 교차 길(네 방향 출구).
import math, random
import numpy as np
from nfc_base import _hash, hash2
from nfc_scene import Scene

W, H = 64, 48


def wob(seed, n, amp, per):
    return [int(round(amp * math.sin(i / per + seed) + 0.6 * amp * math.sin(i / (per * 0.43) + seed * 2.1))) for i in range(n)]


def build(imgs):
    s = Scene(W, H)
    s.warn = []
    rng = random.Random(4207)
    # ---------------------------------------------------------------- 빈터 모양(열린 칸)
    opn = np.zeros((H, W), bool)
    BLOBS = {  # 이름: (cx, cy, rx, ry, 납작한 북쪽 줄기 벽(y_top, xl, xr) 또는 None)
        'yard':  (15.0, 13.5, 12.5, 8.5, (5, 5, 25)),
        'cabin': (47.5, 13.5, 13.5, 9.0, (4, 36, 59)),
        'rocks': (15.0, 35.5, 11.5, 8.0, None),
        'pond':  (47.5, 35.5, 13.0, 8.5, (26, 38, 58)),
    }
    for k, (cx, cy, rx, ry, top) in BLOBS.items():
        ph = _hash(len(k), 3, 77) * 6.28
        for y in range(H):
            for x in range(W):
                dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
                ang = math.atan2(dy, dx)
                r = 1 + 0.10 * math.sin(ang * 3 + ph) + 0.07 * math.sin(ang * 5 + ph * 2)
                if dx * dx + dy * dy <= r * r: opn[y, x] = True
    RY = [23 + v for v in wob(0.7, W, 1.0, 7.0)]                           # 동서 길 중심 줄
    CX = [31 + v for v in wob(1.9, H, 1.0, 6.0)]                           # 남북 길 중심 칸
    for x in range(W):
        for y in range(RY[x] - 2, RY[x] + 3): opn[y, x] = True
    for y in range(H):
        for x in range(CX[y] - 2, CX[y] + 4): opn[y, x] = True
    for y in range(H):                                                      # 교차점은 넓게
        for x in range(W):
            if (x - 32) ** 2 / 30.0 + (y - 24) ** 2 / 18.0 <= 1: opn[y, x] = True
    # 북쪽 줄기 벽: 덩이 위를 납작하게 자르고 두 줄을 줄기 벽으로
    trunk = np.zeros((H, W), bool)
    for k, (cx, cy, rx, ry, top) in BLOBS.items():
        if not top: continue
        yt, xl, xr = top
        for x in range(xl, xr + 1):
            if not opn[yt + 2, x]: continue
            for y in range(0, yt + 2):
                if abs(x - CX[y]) > 3: opn[y, x] = False
            trunk[yt, x] = trunk[yt + 1, x] = True
    # 외톨이 숲 칸·한 칸 틈 메우기(덩이가 1칸 폭 띠가 되지 않게)
    for _ in range(2):
        for y in range(H):
            for x in range(W):
                if opn[y, x] or trunk[y, x]: continue
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and opn[y + dy, x + dx])
                if n >= 3: opn[y, x] = True
    canopy = ~opn & ~trunk
    s.auto['canopy'] = {(x, y) for y in range(H) for x in range(W) if canopy[y, x]}
    def can(x, y): return not (0 <= x < W and 0 <= y < H) or canopy[y, x]
    s.auto['core'] = {(x, y) for (x, y) in s.auto['canopy'] if all(can(x + i, y + j) for i in (-2, -1, 0, 1, 2) for j in (-1, 0, 1)) and all(can(x + i, y + j) for i in (-1, 0, 1) for j in (-2, 2))}
    # ---------------------------------------------------------------- ① 바탕: 풀 + 풀 포기 많은 풀(잡음 덩이) + 수관 밑 그늘 풀
    for y in range(H):
        for x in range(W):
            n = 0.6 * math.sin(x / 4.3 + 1.1) * math.sin(y / 3.7 + 0.4) + 0.4 * (hash2(x // 3, y // 3, 51) - 0.5) * 2
            if n > 0.28: s.ground[y][x] = 'ground-grass-tufty'
            if canopy[y, x] or trunk[y, x]: s.ground[y][x] = 'ground-grass-shade'
    # ---------------------------------------------------------------- ② 길(맨땅 얼룩): 교차 길 + 곁길 + 마당 얼룩
    dirt = set()
    for x in range(W):
        for y in (RY[x], RY[x] + 1): dirt.add((x, y))
        if x and RY[x] != RY[x - 1]:
            for y in range(min(RY[x], RY[x - 1]), max(RY[x], RY[x - 1]) + 2): dirt.add((x, y))
    for y in range(H):
        for x in (CX[y], CX[y] + 1): dirt.add((x, y))
        if y and CX[y] != CX[y - 1]:
            for x in range(min(CX[y], CX[y - 1]), max(CX[y], CX[y - 1]) + 2): dirt.add((x, y))
    for y in range(20, 28):                                                 # 교차점 넓힘
        for x in range(28, 37):
            if (x - 32) ** 2 / 16.0 + (y - 24) ** 2 / 9.0 <= 1: dirt.add((x, y))
    def blob(cells, cx, cy, rx, ry, seed):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / rx; dy = (y - cy) / ry
                r = 1 + 0.18 * math.sin(math.atan2(dy, dx) * 3 + seed)
                if dx * dx + dy * dy <= r * r and 0 <= x < W and 0 <= y < H and opn[y, x]: cells.add((x, y))
    # 오두막 앞마당 → 동서 길(문 (43,10) 앞)
    for y in range(11, RY[43]): dirt.add((43, y)); dirt.add((44, y))
    blob(dirt, 43.5, 12.5, 3.2, 1.6, 1.3)
    # 숲 마당 맨땅 얼룩 두 군데(참고 그림의 마당 흙 얼룩)
    blob(dirt, 9.0, 12.0, 2.6, 2.0, 2.2); blob(dirt, 19.5, 17.5, 3.0, 1.8, 0.4)
    for y in range(18, RY[19]): dirt.add((19, y)); dirt.add((20, y))
    # 연못 쪽 곁길(교차 길 → 연못 서쪽 물가)
    for x in range(36, 41): dirt.add((x, 29)); dirt.add((x, 30))
    for y in range(RY[36] + 2, 30): dirt.add((36, y)); dirt.add((37, y))
    dirt = {c for c in dirt if 0 <= c[0] < W and 0 <= c[1] < H and opn[c[1], c[0]]}
    s.auto['dirt'] = dirt
    # 연못(돌 둘레) — 남동 구역
    pond = set()
    blob(pond, 48.5, 36.0, 6.6, 4.2, 0.9); blob(pond, 53.0, 33.6, 3.2, 2.2, 2.0)
    pond = {c for c in pond if c not in dirt and all(opn[c[1] + j, c[0] + i] for i in (-1, 0, 1) for j in (-1, 0, 1))}
    s.auto['pond'] = pond
    # 짙은 풀숲 덩이(걷기): 벽 가까이·바위 풀숲·연못 둘레
    tall = set()
    for (cx, cy, rx, ry, sd) in ((7, 33, 3.4, 2.4, 0.3), (20, 39, 3.0, 2.0, 1.4), (12, 40, 2.4, 1.6, 2.2), (57, 39, 2.6, 2.4, 0.8),
                                 (41, 39, 2.4, 1.7, 1.9), (25, 10, 2.4, 1.6, 0.6), (5, 16, 2.0, 2.4, 1.0), (59, 18, 2.0, 2.6, 2.6)):
        blob(tall, cx, cy, rx, ry, sd)
    s.auto['tall'] = {c for c in tall if c not in dirt and c not in pond and not trunk[c[1], c[0]]}
    # 채소밭: 울타리 고리(남쪽 가운데 문 틈) + 밭 이랑 흙
    GX0, GY0, GX1, GY1 = 49, 12, 56, 18
    fence = set()
    for x in range(GX0, GX1 + 1): fence.add((x, GY0)); fence.add((x, GY1))
    for y in range(GY0, GY1 + 1): fence.add((GX0, y)); fence.add((GX1, y))
    fence.discard((52, GY1)); fence.discard((53, GY1))
    s.auto['fence'] = fence
    for y in range(GY0 + 1, GY1):
        for x in range(GX0 + 1, GX1): s.ground[y][x] = 'ground-garden-soil'; s.auto['tall'].discard((x, y)); s.occ.add((x, y))
    for x in (52, 53):                                                      # 밭 문 → 동서 길
        for y in range(GY1, RY[x]): s.auto['dirt'].add((x, y))
    # 줄기 벽(칸에 깔린 벽 앞면 — 북쪽 수관 바로 밑 두 줄 + 수관 줄 하나)
    tw = imgs['face-trunk-wall']; te_l = imgs['trunk-wall-end-l']; te_r = imgs['trunk-wall-end-r']
    for y in range(H):
        for x in range(W):
            if trunk[y, x] and (y == 0 or not trunk[y - 1, x]):
                left = x == 0 or not trunk[y, x - 1]; right = x == W - 1 or not trunk[y, x + 1]
                if left: s.under.append((te_l, x * 16, (y - 1) * 16))
                elif right: s.under.append((te_r, x * 16, (y - 1) * 16))
                else: s.under.append((tw.crop(((x % 3) * 16, 0, (x % 3) * 16 + 16, 48)), x * 16, (y - 1) * 16))
                s.block[y, x] = s.block[y + 1, x] = True
                s.occ.add((x, y)); s.occ.add((x, y + 1))
    s.trunk = trunk; s.opn = opn
    # ---------------------------------------------------------------- ④ 앵커
    s.at('log-cabin', imgs['log-cabin'], 40, 9, block=[(i, j) for i in range(7) for j in (-2, -1, 0)])
    for x in range(40, 47):
        for y in range(4, 10): s.occ.add((x, y))
    s.marks['cabin_door'] = (43, 11)
    s.at('big-tree-a', imgs['big-tree-a'], 13, 13, block=[(1, 0), (2, 0)])
    for x in range(12, 18):
        for y in range(9, 14): s.occ.add((x, y))
    s.marks['big_tree'] = (15, 14)
    s.marks['pond_west'] = (40, 34)
    s.marks['garden'] = (52, 15)
    s.marks['rocks'] = (14, 35)
    # 오두막 곁: 상자 더미·통 더미·장작·도끼 그루터기·꽃 상자
    s.at('crate-stack', imgs['crate-stack'], 37, 9, block=[(0, 0), (1, 0)])
    s.at('crate', imgs['crate'], 37, 10, block='bottom')
    s.at('barrel-stack', imgs['barrel-stack'], 47, 9, block=[(0, 0), (1, 0)])
    s.at('barrel', imgs['barrel'], 47, 10, block='bottom')
    s.at('woodpile', imgs['woodpile'], 37, 12, block=[(0, 0), (1, 0)])
    s.at('chop-block', imgs['chop-block'], 39, 13, block='bottom')
    s.at('planter-box', imgs['planter-box'], 45, 11, block='bottom')
    s.at('sign-post', imgs['sign-post'], 46, 13, block='bottom')
    # 밭 작물(이랑 칸 가운데 한 포기씩)
    rows = {GY0 + 1: 'crop-carrot', GY0 + 2: 'crop-sprout', GY0 + 3: 'crop-cabbage', GY0 + 4: 'crop-turnip', GY0 + 5: 'crop-carrot'}
    for y, nm in rows.items():
        for x in range(GX0 + 1, GX1):
            if nm == 'crop-cabbage' and x % 2 == 0: continue
            s.decal(nm, imgs[nm], x, y)
    # 교차로 표지판 · 연못 물가
    s.at('sign-arrow', imgs['sign-arrow'], 28, RY[28] - 3, block='bottom'); s.marks['crossroad'] = (32, 24)
    s.at('sign-post', imgs['sign-post'], 36, RY[36] + 3, block='bottom')
    for (x, y) in ((pmin := min(pond))[0], pmin[1]), :
        pass
    pond_edge = sorted({(x + dx, y + dy) for (x, y) in pond for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - pond - dirt)
    for i, (x, y) in enumerate(pond_edge):
        if _hash(x, y, 91) > 0.80 and s.free(x, y): s.at('reeds', imgs['reeds'], x, y, block='bottom')
    for (x, y) in sorted(pond):
        if _hash(x, y, 93) > 0.86: s.decal('lily-pads', imgs['lily-pads'], x, y)
    # ---------------------------------------------------------------- ④ 식생(목적 있는 덩이)
    def put(nm, x, y, block='bottom', w=1, avoid=('dirt', 'pond', 'fence', 'canopy'), need=1, margin=0):
        if not all(s.free(x + i, y - j, avoid, margin) for i in range(w) for j in range(need)): return False
        if not all(0 <= x + i < W and opn[y, x + i] and not trunk[y, x + i] for i in range(w)): return False
        s.at(nm, imgs[nm], x, y, block=block)
        return True
    # 줄기 벽 앞 어린 전나무·가는 나무(참고: 북쪽 벽 앞에 듬성듬성)
    for x in range(W):
        for y in range(H):
            if trunk[y, x] and (y + 2 < H) and not trunk[y + 1, x] and trunk[y - 1, x] if y > 0 else False:
                pass
    front = [(x, y + 2) for y in range(H - 2) for x in range(W) if trunk[y, x] and not trunk[y - 1, x] and opn[y + 2, x]]
    rng.shuffle(front)
    for i, (x, y) in enumerate(front[:22]):
        nm = ('pine-young-a', 'pine-young-b', 'thin-fern-tree', 'pine-young-a', 'autumn-shrub-s')[i % 5]
        put(nm, x, y)
    # 숲 가장자리(수관 테 바로 앞) 덤불·낙엽 덤불·풀 포기
    edge = [(x, y) for y in range(H) for x in range(W) if opn[y, x] and not trunk[y, x] and any(can(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    rng.shuffle(edge)
    kinds = ['autumn-shrub-l', 'bush-round', 'pine-young-b', 'autumn-shrub-s', 'rock-mossy', 'sapling', 'pine-mid', 'grass-tuft-l']
    k = 0
    for (x, y) in edge:
        nm = kinds[k % len(kinds)]
        w = imgs[nm].width // 16
        if put(nm, x, y, w=w, block=('bottom' if nm not in ('grass-tuft-l',) else 'none'), margin=0): k += 1
        if k >= 34: break
    # 남서 바위 풀숲
    for (nm, x, y) in (('rock-l', 10, 34), ('rock-s', 13, 37), ('rock-mossy', 17, 32), ('rock-l', 21, 36), ('pebbles', 15, 35), ('stump', 8, 38),
                       ('log-fallen', 17, 40), ('mushrooms', 19, 41), ('pine-mid', 5, 38), ('sapling', 23, 33), ('autumn-shrub-l', 24, 40), ('rock-s', 6, 30)):
        if not put(nm, x, y, w=imgs[nm].width // 16, block=('none' if nm in ('pebbles', 'mushrooms') else 'bottom')): s.warn.append(('rocks', nm, x, y))
    # 연못 둘레 바위·별꽃
    for (nm, x, y) in (('rock-l', 55, 31), ('rock-s', 43, 32), ('rock-mossy', 53, 40), ('stump', 59, 35), ('autumn-shrub-l', 39, 36)):
        if not put(nm, x, y, w=imgs[nm].width // 16): s.warn.append(('pond', nm, x, y))
    # 땅 장식: 별꽃·작은 별꽃·고사리·풀 포기·버섯 — 빈 풀밭에 덩이로
    deco = ['starflower', 'starflowers-small', 'fern', 'grass-tuft-s', 'grass-tuft-s', 'starflower', 'fern', 'pebbles']
    cells = [(x, y) for y in range(H) for x in range(W) if opn[y, x] and not trunk[y, x]]
    rng.shuffle(cells)
    n = 0
    for (x, y) in cells:
        if not s.free(x, y, ('dirt', 'pond', 'fence', 'canopy')): continue
        if (x, y) in s.auto['tall']: continue
        if hash2(x // 4, y // 4, 61) < 0.45: continue                       # 덩이로 모이게
        nm = deco[n % len(deco)]
        s.decal(nm, imgs[nm], x, y); n += 1
        if n >= 70: break
    # 큰 풀 포기(땅 장식, 32x26) 몇 개
    m = 0
    for (x, y) in cells:
        if m >= 10: break
        if s.free(x, y) and s.free(x + 1, y) and (x, y) not in s.auto['tall'] and hash2(x // 5, y // 5, 63) > 0.6:
            s.decal('grass-tuft-l', imgs['grass-tuft-l'], x, y); s.occ.add((x + 1, y)); m += 1
    return s, RY, CX
