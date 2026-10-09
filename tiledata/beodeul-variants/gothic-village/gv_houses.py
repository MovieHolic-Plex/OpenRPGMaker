# 고딕 마을 집 키트 — 버들항 블록(pj 벽 칸 · pv 박공 · ph2 가파른 지붕)으로 낮 재료 조립 → 고딕 마감(gfinish).
# 뾰족 박공(가파른 G), 흑갈 목골 + 회색 회벽 위층, 돌 1층, 판자로 닫은 창, 몇 집은 검붉은 문, 창 한두 개만 호박빛. 결정적.
from gv_build import *
from gv_church import RED_D, lancet

def board_up(px, W, Hh, box, seed, tilt=0):
    """창을 판자로 막는다: 가로 판자 2~3장(밝은 윗모·그늘 아랫모·결), 판자 끝 못, 한 장은 살짝 기운다."""
    x0, y0, x1, y1 = box; h = y1 - y0; n = 3 if h >= 9 else 2
    for k in range(n):
        yy = y0 + int((k + 0.5) * h / n) - 1
        tk = (tilt if k == 1 else 0)
        for x in range(x0 - 1, x1 + 1):
            dy = int(round((x - x0) * tk))
            put(px, W, Hh, x, yy + dy, ROT[5]); put(px, W, Hh, x, yy + dy + 1, ROT[4] if (x + k) % 5 else ROT[3]); put(px, W, Hh, x, yy + dy + 2, ROT[2])
        put(px, W, Hh, x0, yy + 1, ST[2]); put(px, W, Hh, x1 - 1, yy + 1 + int(round((x1 - 1 - x0) * tk)), ST[2])

def dark_glass(px, W, Hh, box):
    """불 꺼진 창: 유리 화소를 짙은 남색으로(빛 반사 한 점만)."""
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = get(px, W, Hh, x, y)
            if p[3] > 200 and is_glass(p[:3]): put(px, W, Hh, x, y, GLASS[1] if (x + y) % 7 else GLASS[2])

def red_wood(day, x0, y0, x1, y1):
    """칸 범위 안 나무(문) 화소를 검붉은 램프로."""
    px = day.load()
    for y in range(max(0, y0), min(day.height, y1)):
        for x in range(max(0, x0), min(day.width, x1)):
            p = px[x, y]
            if p[3] > 200 and p[0] > p[1] + 10 and p[1] >= p[2] - 6 and lum3(p) < 150: px[x, y] = ramp_fit(p, RED_D) + (255,)

def board_gable(day, x0, W, top, G, seed):
    """박공 삼각 벽을 세로 널판(흑갈, 2화소 널 + 밝은 모, 아래 끝 들쭉날쭉)으로 덮는다. 다락 창 자리는 남긴다."""
    px = day.load(); gx = x0 + W / 2
    for y in range(top, top + G):
        half = (y - top + 1) / G * (W / 2)
        for x in range(x0, x0 + W):
            d = abs(x + 0.5 - gx)
            if d > half - 3: continue
            p = px[x, y]
            if p[3] > 200 and is_glass(p[:3]): continue
            if p[3] > 200 and abs(x + 0.5 - gx) < 6 and y > top + G * 0.38 and y < top + G * 0.38 + 9: continue
            k = (x - x0) % 3
            t = 4 if k == 0 else (3 if k == 1 else 1)
            if H(x // 3, y // 9, seed) > 0.8: t = max(1, t - 1)
            px[x, y] = BEAM_D[t + 1 if t < 5 else t] + (255,)

def _decorate(day, boxes, plan, seed):
    """plan: 상자 순서별 'lit'/'board'/'shut'/'dark'/'open'. 반환: 켜진 창 상자 목록."""
    px = day.load(); Wd, Hd = day.size; lits = []
    for k, (key, bx) in enumerate(sorted(boxes.items())):
        a = plan[k % len(plan)]
        if a == 'lit': lits.append(bx); RB.shutters(px, Wd, Hd, bx, RB.SHUT2, seed + k, 'open')
        elif a == 'board': dark_glass(px, Wd, Hd, bx); board_up(px, Wd, Hd, bx, seed + k, 0.12 if k % 2 else -0.1)
        elif a == 'shut': RB.shutters(px, Wd, Hd, bx, RB.SHUT, seed + k, 'shut')
        elif a == 'hang': dark_glass(px, Wd, Hd, bx); RB.shutters(px, Wd, Hd, bx, RB.SHUT2, seed + k, 'hang')
        else: dark_glass(px, Wd, Hd, bx)
    return lits

def gable_house(seed=1, wc=4, storeys=3, ratio=0.78, st='tim', gs='sto', roof='sto', plan=('dark', 'board', 'lit', 'shut'), red=True, door_i=None):
    """박공이 앞을 향한 좁고 높은 집: 가파른 뾰족 박공(다락 창), 위층은 목골 반목조(층마다 내밀기), 1층 돌, 문 하나."""
    Wp = wc * 16; G = int(Wp * ratio) // 2 * 2; roofH = 2 * 16 + G
    g = pv.gable_end(roof, Wp, roofH, G, window=True, timber=True)
    up = 'l' + ''.join('w' if i in (1, wc - 2) or (wc >= 5 and i == wc // 2) else 'p' for i in range(1, wc - 1)) + 'r'
    low = list('l' + 'w' * (wc - 2) + 'r'); di = door_i if door_i is not None else (wc // 2 if wc % 2 else wc // 2 - (seed % 2)); low[di] = 'd'
    if wc >= 4: low[1 if di != 1 else 2] = 'p'
    low = ''.join(low)
    b = RB.body(st, gs, up, low, storeys)
    day = Image.new('RGBA', (Wp, roofH + b.height + 2)); day.alpha_composite(g, (0, 0)); day.alpha_composite(b, (0, roofH))
    board_gable(day, 0, Wp, roofH - G, G, seed)
    wy = roofH; base = roofH + b.height - 1
    boxes = {}
    for s in range(storeys):
        for i in range(wc):
            bx = RB.glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if bx: boxes[(s, i)] = bx
    att = RB.glass_boxes(day, 0, roofH - G, Wp, roofH)
    lits = _decorate(day, boxes, plan, seed)
    if att and seed % 3 == 0: lits.append(att)
    elif att: dark_glass(day.load(), Wp, day.height, att)
    if red: red_wood(day, di * 16, base - 32, di * 16 + 16, base + 1)
    return RB.finish_house(day, roofH - G, roofH, lits, seed)

def cross_gable_house(seed=7, wc=7, st='tim', gs='sto', roof='sto', plan=('board', 'dark', 'lit', 'dark', 'shut', 'board')):
    """긴 2층 집: 가파른 우진각 지붕 가운데에 앞으로 튀어나온 뾰족 박공(교차 박공) 하나, 굴뚝, 1층 돌·2층 목골."""
    W = wc * 16; Rh = 50; pad = 16
    hip = ph2.steep_hip(roof, W, Rh)
    gw = 3 * 16; G = 44; gH = Rh - 6
    cg = pv.gable_end(roof, gw, gH, G, window=True, timber=True)
    up = 'l' + ''.join('w' if i % 2 == 1 else 'p' for i in range(1, wc - 1)) + 'r'
    low = list('l' + 'w' * (wc - 2) + 'r'); low[wc // 2] = 'd'; low[1] = 'p'; low[wc - 2] = 'p'; low = ''.join(low)
    b = RB.body(st, gs, up, low, 2)
    day = Image.new('RGBA', (W, pad + Rh + b.height)); day.alpha_composite(hip, (0, pad)); day.alpha_composite(b, (0, pad + Rh))
    day.alpha_composite(cg, ((W - gw) // 2, pad + Rh - gH))
    board_gable(day, (W - gw) // 2, gw, pad + Rh - G, G, seed)
    day = ph2.volume(day, pad + Rh)
    ph2.chimney(day, (wc - 2) * 16 + 4, pad - 12 + int(Rh * 0.25), roof)
    wy = pad + Rh; boxes = {}
    for s in range(2):
        for i in range(wc):
            bx = RB.glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if bx: boxes[(s, i)] = bx
    lits = _decorate(day, boxes, plan, seed)
    att = RB.glass_boxes(day, (W - gw) // 2, pad, (W + gw) // 2, wy)
    if att: lits.append(att)
    red_wood(day, (wc // 2) * 16, wy + 32, (wc // 2) * 16 + 16, day.height)
    return RB.finish_house(day, pad + Rh, wy, lits, seed)

def cottage(seed=13, wc=4, roof='sto', plan=('lit', 'board')):
    """낮은 단층 오두막: 가파른 박공(다락 창), 돌 벽, 창 둘(하나는 판자), 문."""
    return gable_house(seed, wc, 1, 0.74, 'sto', 'sto', roof, plan, red=(seed % 2 == 0))

def crooked_house(seed=17):
    """기운 좁은 3층 집: 3칸 폭 뾰족 박공 집이 오른쪽으로 살짝 기울었다(위층이 더 밀림), 창은 거의 판자."""
    im = gable_house(seed, 3, 3, 0.86, 'tim', 'sto', 'sto', ('board', 'dark', 'board', 'lit', 'board'), red=False, door_i=1)
    return RH._lean(im, 0.06)

def boarded_house(seed=31):
    """비어 버린 2층 돌집(동결 사본의 지붕 꺼진 집): 슬레이트 용마루가 꺼지고 창은 판자, 문은 판자로 막힘."""
    return RB.ruin_house(seed, 5)

def stair_house(seed=11):
    """바깥 돌계단이 2층으로 오르는 3층 집(빨래 없음)."""
    return RB.stair_house(seed, 6, laundry=False, lit_idx=((1, 4),))

def tavern(seed=41):
    """여관·주점: 2층 가게 집, 1층 셔터와 찢긴 차양, 문 위 빈 간판 걸이(글자 없음), 2층 창 하나에 불."""
    return RB.shop_house(seed, 5)
