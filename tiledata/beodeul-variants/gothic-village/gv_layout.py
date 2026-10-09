# 고딕 마을 데모 맵 배치(64x48). 구역·앵커·동선은 plan.md. 결정적.
# 칠하는 순서(조수가 따라 할 순서): ① 맨 바탕 표본 → ② 오토타일 덩이 → ③ 건물·소품 → 바닥 덧그림.
# 길·광장·밭 경계는 오토타일(투명 들쭉날쭉 가장자리)이 맡고, 바탕 표본(자갈·진흙)은 덩이의 깊은 속(이웃 8칸이 모두 덩이)에만 깐다.
from gv_map import *

W, H = 64, 48

def blob(cx, cy, rx, ry, seed, jag=0.28):
    out = []
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d < 1 + (vnoise(x, y, 2.2, seed) - 0.5) * jag * 2: out.append((x, y))
    return out

def hstreet(x0, x1, y, seed, w=2):
    """동서 골목: 폭 w, 군데군데 한 칸씩 부풀거나 좁아진다(자로 그은 띠 금지)."""
    out = []
    for x in range(x0, x1 + 1):
        a = vnoise(x, 0, 3.0, seed); b = vnoise(x, 5, 2.0, seed + 1)
        top = y - (1 if a > 0.70 else 0); bot = y + w - 1 + (1 if b > 0.72 else 0)
        out += [(x, yy) for yy in range(top, bot + 1)]
    return out

def vstreet(x, y0, y1, seed, w=2):
    out = []
    for y in range(y0, y1 + 1):
        a = vnoise(0, y, 3.0, seed); b = vnoise(5, y, 2.0, seed + 1)
        l = x - (1 if a > 0.72 else 0); r = x + w - 1 + (1 if b > 0.72 else 0)
        out += [(xx, y) for xx in range(l, r + 1)]
    return out

def deep(cells):
    S = set(cells)
    return [(x, y) for (x, y) in S if all((x + dx, y + dy) in S for dx in (-1, 0, 1) for dy in (-1, 0, 1))]

def build():
    M = Map(W, H)
    R = M.rect
    # ================================================================ 구역 마스크(길·광장·밭)
    SQUARE = blob(30.5, 28.2, 8.0, 4.6, 11, 0.20)                                     # 우물 광장
    ROAD = set(SQUARE)
    ROAD.update(vstreet(29, 31, 47, 12, 4))                                             # 남쪽 큰길(폭 4)
    ROAD.update(vstreet(29, 18, 24, 13, 4))                                             # 광장 → 교회 마당
    ROAD.update(hstreet(0, 22, 28, 14)); ROAD.update(hstreet(38, 63, 28, 15))          # 동서 거리
    ROAD.update(hstreet(1, 27, 41, 16)); ROAD.update(hstreet(34, 62, 41, 17))          # 남쪽 골목
    ROAD.update(vstreet(50, 15, 27, 18)); ROAD.update(vstreet(12, 30, 40, 19)); ROAD.update(vstreet(46, 30, 40, 20))
    ROAD.update(vstreet(9, 12, 27, 21))                                                 # 거리 → 묘지기 오두막
    ROAD = {c for c in ROAD if 0 <= c[0] < W and 0 <= c[1] < H}
    YARD = set(R(25, 19, 36, 22)) | set(R(48, 13, 52, 15)) | set(R(52, 4, 58, 7))     # 판석 마당(건물·울타리에 붙은 네모)
    ROAD -= YARD
    FIELD = set(blob(8.0, 44.6, 7.6, 3.0, 21, 0.25)) | set(blob(56.5, 44.6, 6.5, 3.0, 22, 0.25)) | set(blob(49.5, 10.0, 6.4, 5.6, 23, 0.3)) \
        | set(blob(10.0, 13.0, 5.6, 2.6, 24, 0.3))
    FIELD -= ROAD; FIELD -= YARD
    # ================================================================ ① 맨 바탕 표본
    M.paint('ground-mudcobble', deep(ROAD))
    M.paint('ground-churchflag', YARD)
    M.paint('ground-mire', deep(FIELD))
    # ================================================================ ② 오토타일 덩이
    M.auto_set('autotile-mudlane', ROAD)
    M.auto_set('autotile-mudpatch', FIELD)
    for (cx, cy, rx, ry, sd) in ((24.0, 31.0, 2.4, 1.5, 31), (37.5, 25.0, 2.0, 1.3, 32), (6.0, 44.5, 3.2, 1.4, 33), (19.5, 29.6, 1.8, 1.1, 34),
                                 (57.0, 44.0, 2.6, 1.3, 35), (43.0, 29.0, 1.6, 1.0, 36), (34.5, 45.5, 1.8, 1.1, 37), (11.5, 13.0, 2.2, 1.2, 38)):
        M.auto_set('autotile-mire', blob(cx, cy, rx, ry, sd, 0.35))
    for (cx, cy, rx, ry, sd) in ((44.5, 9.0, 3.2, 2.6, 41), (59.5, 12.0, 2.6, 3.0, 42), (4.0, 6.5, 4.0, 2.4, 43), (17.0, 4.0, 3.4, 2.0, 44),
                                 (24.5, 44.0, 2.6, 2.0, 45), (61.0, 33.0, 2.2, 3.0, 46), (38.5, 7.5, 2.6, 2.2, 47), (21.0, 10.5, 2.2, 1.8, 48),
                                 (19.5, 15.0, 3.2, 2.6, 49), (39.5, 13.0, 2.0, 1.6, 50)):
        M.auto_set('autotile-leafbone', [c for c in blob(cx, cy, rx, ry, sd, 0.4) if c not in ROAD])
    for (cx, cy, rx, ry, sd) in ((14.5, 9.0, 3.2, 2.2, 51), (40.0, 13.0, 3.0, 2.4, 52), (60.0, 21.5, 3.0, 2.0, 53), (2.5, 35.0, 2.2, 3.0, 54),
                                 (21.0, 46.0, 3.4, 1.6, 55), (61.0, 38.0, 2.4, 1.6, 56), (20.5, 16.0, 2.6, 2.0, 57), (56.5, 18.5, 2.6, 1.4, 58),
                                 (4.5, 15.0, 2.6, 2.0, 59), (37.5, 2.5, 3.0, 1.6, 60), (19.5, 1.5, 3.4, 1.6, 61), (8.0, 8.0, 2.4, 1.4, 62)):
        cells = [c for c in blob(cx, cy, rx, ry, sd, 0.4) if c not in ROAD and c not in FIELD and M.base[c[1]][c[0]] == 'ground-deadgrass']
        M.auto_set('autotile-dewgrass', cells)
    F = [(x, 15) for x in range(42, 63) if not (49 <= x <= 51)] + [(42, y) for y in range(1, 16)] + [(62, y) for y in range(1, 16)] + [(x, 1) for x in range(42, 63)]
    M.auto_set('autotile-ironfence', F)
    M.auto_set('autotile-ironfence', [(24, y) for y in range(19, 23)] + [(37, y) for y in range(19, 23)])
    M.auto_set('autotile-ironfence', [(x, 10) for x in range(5, 17)] + [(5, y) for y in range(10, 18)] + [(16, y) for y in range(10, 18)] + [(x, 17) for x in range(5, 17) if x not in (9, 10, 11)])   # 묘지기 마당 울타리
    for (x, y) in list(F): M.occ.add((x, y))
    # ================================================================ ③ 건물
    M.put('church-spire', 24, 18); M.marks['church_door'] = (30, 19)
    ch = np.array(KT.pad16(KT.img('church-spire')))[:, :, 3] > 0                       # 교회 그림이 덮는 칸만 예약(신랑 지붕 뒤 빈 하늘 칸은 비움)
    for j in range(ch.shape[0] // 16):
        for i in range(ch.shape[1] // 16):
            if ch[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16].mean() > 0.05: M.occ.add((24 + i, 18 - (ch.shape[0] // 16 - 1) + j))
    M.put('house-gable-tall', 2, 27); M.put('house-cross-gable', 7, 27, force=True); M.put('house-gable-small', 15, 27, force=True)
    M.put('tavern-house', 19, 27, force=True); M.marks['tavern'] = (20, 28)
    M.put('house-stair', 38, 27, force=True); M.put('house-gable-wide', 44, 27, force=True); M.put('house-gable-small', 52, 27, force=True); M.put('house-crooked', 58, 27, force=True)
    M.put('cottage-gable', 2, 40, force=True); M.put('house-boarded', 7, 40, force=True); M.put('house-gable-tall', 14, 40, flip=True, force=True)
    M.put('house-crooked', 19, 40, flip=True, force=True); M.put('house-gable-small', 23, 40, force=True)
    M.put('house-gable-small', 34, 40, force=True); M.put('house-gable-wide', 39, 40, force=True); M.put('house-cross-gable', 48, 40, force=True); M.put('cottage-gable', 56, 40, force=True)
    M.put('cottage-gable', 8, 13, force=True); M.marks['keeper_hut'] = (9, 14)                     # 묘지기 오두막(북서 마당)
    # ================================================================ 묘지
    M.put('cemetery-gate', 49, 15, force=True); M.marks['cemetery_gate'] = (50, 16)
    M.block[15][50] = False; M.marks['gate_event'] = (50, 15)                                   # 대문 가운데 칸 = 문 이벤트(지도에서는 열림)
    M.put('crypt-mausoleum', 54, 6, force=True); M.marks['crypt'] = (55, 7)
    M.put('dead-tree-crows', 43, 10); M.put('dead-tree-large', 58, 12); M.put('dead-tree-crooked', 60, 5)
    M.put('tomb-obelisk', 48, 8); M.put('statue-mourner', 51, 11)
    graves = [('tomb-cross-stone', 44, 4), ('tomb-cracked', 46, 4), ('tomb-cracked', 49, 3), ('cross-crooked', 51, 3), ('tomb-broken', 58, 3),
              ('tomb-cross-stone', 45, 7), ('tomb-cracked', 47, 12), ('grave-mound', 44, 13), ('cross-crooked', 46, 14),
              ('tomb-cross-stone', 54, 10), ('tomb-cracked', 56, 10), ('tomb-broken', 53, 14), ('grave-mound', 55, 13), ('cross-crooked', 57, 14),
              ('tomb-obelisk', 60, 9), ('tomb-cracked', 59, 14), ('tomb-cross-stone', 50, 6), ('grave-mound', 46, 9), ('tomb-cracked', 57, 9),
              ('tomb-cross-stone', 61, 3), ('tomb-broken', 47, 2), ('grave-mound', 59, 7)]
    for (n, x, y) in graves: M.put(n, x, y)
    M.put('coffin-trestle', 52, 9)
    # ================================================================ 광장·큰길·교회 마당
    M.put('well-roofed', 30, 28); M.marks['well'] = (30, 29)
    M.put('notice-column', 23, 26); M.put('bench-iron', 33, 31); M.put('lamp-double', 25, 30); M.put('lamp-double', 35, 26, flip=True)
    M.put('cart-tarp', 37, 31); M.put('barrels-stack', 22, 32)
    M.put('lamppost-gas', 28, 36); M.put('lamppost-gas', 34, 38); M.put('lamppost-gas', 28, 44)
    M.put('lamp-double', 25, 21); M.put('lamp-double', 35, 21, flip=True)
    M.put('coffin-trestle', 33, 22)
    M.put('wayside-shrine', 34, 46); M.put('dead-tree-crows', 24, 46, force=True)
    M.marks['south_gate'] = (30, 47)
    # 북쪽 바깥: 고목 숲 덩이(서·동)·묘지기 마당
    for (n, x, y) in (('dead-tree-large', 1, 7), ('dead-tree-crooked', 5, 5), ('dead-tree-large', 14, 5), ('dead-sapling', 11, 4), ('dead-tree-crooked', 19, 9),
                      ('dead-bush', 3, 9), ('stump-dead', 12, 6), ('dead-tree-large', 35, 9), ('dead-tree-crooked', 39, 6), ('dead-bush', 22, 13),
                      ('dead-sapling', 20, 5), ('dead-tree-large', 17, 3), ('dead-tree-crooked', 0, 3), ('dead-sapling', 2, 18), ('dead-tree-crooked', 37, 15),
                      ('stump-dead', 40, 10), ('dead-bush', 18, 17), ('dead-sapling', 21, 19), ('dead-tree-large', 21, 3), ('dead-bush', 8, 2),
                      ('dead-tree-large', 38, 3), ('dead-sapling', 36, 13), ('dead-bush', 41, 17), ('dead-tree-crooked', 3, 23), ('dead-bush', 1, 21),
                      ('dead-sapling', 22, 22), ('dead-bush', 39, 19), ('dead-tree-large', 18, 24)):
        M.put(n, x, y)
    for (n, x, y) in (('grave-mound', 13, 12), ('cross-crooked', 13, 11), ('well-dry', 6, 16), ('crates-tarp', 13, 16), ('scarecrow-tattered', 7, 11),
                      ('crow-post', 15, 13), ('rain-barrel', 12, 14), ('fence-fallen', 6, 13)):
        M.put(n, x, y, force=n == 'fence-fallen')
    # 교회 서쪽 옛 무덤 터 · 교회와 묘지 사이 돌담·고목
    for (n, x, y) in (('tomb-cracked', 17, 13), ('cross-crooked', 19, 12), ('tomb-broken', 21, 14), ('tomb-cross-stone', 18, 15), ('grave-mound', 20, 17),
                      ('tomb-cracked', 22, 16), ('cross-crooked', 16, 16), ('dead-bush', 35, 17), ('tomb-cracked', 37, 11), ('dead-tree-crows', 38, 9),
                      ('tomb-cracked', 40, 14), ('dead-bush', 35, 12), ('stump-dead', 23, 9), ('dead-sapling', 24, 1), ('dead-bush', 33, 1), ('dead-tree-crooked', 9, 1),
                      ('dead-bush', 26, 0), ('stump-dead', 4, 1), ('grave-wall-long', 27, 1), ('dead-tree-large', 32, 5), ('dead-tree-crooked', 35, 4),
                      ('tomb-cracked', 39, 2), ('dead-bush', 41, 4), ('dead-tree-large', 12, 3), ('dead-bush', 15, 1), ('stump-dead', 7, 3),
                      ('dead-sapling', 3, 4), ('tomb-broken', 1, 13), ('dead-bush', 0, 16), ('dead-tree-crooked', 14, 22), ('dead-bush', 10, 21),
                      ('crows-ground', 5, 20), ('dead-sapling', 6, 23), ('tomb-cross-stone', 28, 4), ('tomb-cracked', 30, 3), ('cross-crooked', 33, 3),
                      ('dead-bush', 29, 6), ('tomb-broken', 19, 7), ('dead-bush', 16, 6), ('tomb-cracked', 22, 5), ('dead-sapling', 9, 11)):
        M.put(n, x, y)
    # 남쪽 밭(서)·뒷마당(동)
    M.put('scarecrow-tattered', 9, 45); M.put('crow-post', 4, 46); M.put('crow-post', 14, 44)
    M.put('fence-fallen', 11, 47, force=True)
    M.put('well-dry', 58, 46); M.put('coffin-trestle', 52, 46); M.put('dead-tree-large', 61, 47, force=True)
    M.put('crates-tarp', 44, 45); M.put('rain-barrel', 47, 44); M.put('dead-sapling', 41, 46); M.put('dead-bush', 18, 46); M.put('dead-tree-crooked', 37, 47)
    # 거리 소품
    for (n, x, y) in (('rain-barrel', 6, 26), ('barrels-stack', 50, 26), ('crates-tarp', 13, 39), ('rain-barrel', 33, 39), ('lamppost-gas', 10, 31), ('lamppost-gas', 54, 31),
                      ('lamppost-gas', 17, 44), ('lamppost-gas', 44, 43), ('dead-sapling', 63, 31), ('dead-bush', 62, 35), ('dead-tree-crooked', 61, 25),
                      ('dead-bush', 1, 31), ('dead-sapling', 0, 37), ('wayside-shrine', 1, 26), ('dead-bush', 26, 38), ('dead-bush', 36, 34), ('stump-dead', 21, 36),
                      ('bench-iron', 40, 31), ('crates-tarp', 26, 34), ('dead-sapling', 63, 44), ('dead-bush', 55, 37), ('barrels-stack', 31, 38)):
        M.put(n, x, y)
    # ================================================================ 바닥 덧그림
    deco = [('crows-ground', 31, 25), ('crows-ground', 8, 42), ('crows-ground', 47, 6), ('leaves-scatter', 27, 33), ('leaves-scatter', 40, 30),
            ('leaves-scatter', 20, 30), ('bones-scatter', 45, 11), ('bones-scatter', 59, 8), ('puddle-mud', 30, 40), ('puddle-mud', 41, 29),
            ('puddle-mud', 9, 29), ('fog-bank', 44, 6), ('fog-bank', 54, 12), ('fog-small', 39, 14), ('fog-bank', 2, 11), ('fog-small', 21, 44),
            ('fog-small', 60, 37), ('drygrass-tuft', 6, 36), ('drygrass-tuft', 37, 36), ('weeds-crack', 30, 34), ('weeds-crack', 32, 21),
            ('leaves-scatter', 16, 46), ('crows-ground', 56, 36), ('drygrass-tuft', 52, 34), ('drygrass-tuft', 24, 36), ('fog-small', 27, 15),
            ('leaves-scatter', 6, 19), ('crows-ground', 16, 20), ('fog-bank', 33, 0), ('drygrass-tuft', 59, 34), ('leaves-scatter', 2, 34),
            ('cobweb-big', 7, 14), ('fog-small', 18, 33), ('drygrass-tuft', 43, 34)]
    for (n, x, y) in deco: M.put(n, x, y, force=True)
    return M
