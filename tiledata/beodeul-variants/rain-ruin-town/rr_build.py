# 비 내리는 수직 폐허 도시 — 건물 키트(지도와 조각 내보내기가 같이 쓴다). 결정적.
# 집은 버들항 블록(pj 벽 칸 · ph2 가파른 지붕 · pv 바깥 계단/발코니 · castle6 마름돌/아치 창 · pj.spire)으로 낮 재료로 조립한 뒤
# night() 로 밤비 톤에 옮기고, 켜진 창·젖은 기와 빛 맺힘·빗물 얼룩·밑동 이끼를 밤 공간에서 덧칠한다.
from rr_base import *
from pj_demo import storeyrows as SR

SHUT = [hx(c) for c in ('#14222a', '#1e3a40', '#2a5254', '#3a6a68', '#4f8680', '#6ea49a', '#94c4b6')]   # 바랜 청록 덧문(낮)
SHUT2 = [hx(c) for c in ('#26140e', '#4a2418', '#6e3424', '#8e4a32', '#a86444', '#c48660', '#dcac86')]  # 바랜 적갈 덧문(낮)
CLOTH = [[hx(c) for c in s] for s in (('#2a2030', '#4c3c52', '#6e5c74', '#8e7e94', '#b0a2b4', '#d2c8d4', '#eee8ee'),
                                      ('#1c2a22', '#2e4436', '#44604c', '#5e7e64', '#7e9c80', '#a2bca2', '#cadccc'),
                                      ('#3a1e14', '#5c2e1e', '#80442a', '#a2603c', '#bc8058', '#d6a47e', '#ecc8a8'),
                                      ('#202838', '#34405a', '#4c5c7e', '#6a7c9e', '#8e9ebc', '#b4c2d6', '#dce4ee'))]

def body(st, gs, up, low, storeys):
    """storeys 층 벽: 위층들은 st(반목조/돌), 맨 아래층은 gs. up/low = 칸 종류 문자열(l r m n p w d s f)."""
    if storeys == 1: rows = SR(gs, low, 'eave', 'base')
    else:
        rows = SR(st, up, 'eave', 'jetty')
        for _ in range(storeys - 2): rows += SR(st, up, 'plain', 'jetty')
        rows += SR(gs, low, 'plain', 'base')
    return pj.assemble(rows, pv.L()).crop((0, 0, len(low) * 16, storeys * 32))

def glass_boxes(im, x0, y0, x1, y1):
    """낮 그림 칸 범위 안 유리 화소 묶음의 테두리 상자들(창 하나 = 상자 하나)."""
    p = im.load(); pts = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = p[x, y]
            if a > 200 and is_glass((r, g, b)): pts.append((x, y))
    if not pts: return None
    xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

def shutters(px, W, Hh, box, col, seed, state='open'):
    """창 양옆 덧문(낮 재료): 널 세 줄 + 가로대, 왼쪽 밝음. state='open' 양쪽, 'L' 왼쪽만, 'hang' 오른쪽이 경첩 하나로 처짐, 'shut' 닫힘."""
    x0, y0, x1, y1 = box; h = y1 - y0 + 2
    def leaf(xa, w, tilt=0):
        for y in range(h):
            for i in range(w):
                x = xa + i + (int(y * tilt) if tilt else 0); yy = y0 - 1 + y
                t = (5, 4, 3, 2)[min(3, i)] if w > 3 else (5, 3, 2)[i]
                if y in (0, h - 1): t = 2
                elif (y - 1) % 4 == 3: t = max(1, t - 1)
                if y == h // 2: t = 3 if i else 4
                put(px, W, Hh, x, yy, col[t])
    if state == 'shut':
        leaf(x0, (x1 - x0) // 2); leaf(x0 + (x1 - x0) // 2, x1 - x0 - (x1 - x0) // 2); return
    if state in ('open', 'L', 'hang'): leaf(x0 - 4, 3)
    if state == 'open': leaf(x1 + 1, 3)
    if state == 'hang': leaf(x1 + 1, 3, tilt=0.18)

def wet_roof(im, y0, y1, seed, dens=0.22):
    """젖은 기와: 지붕 띠(y0..y1) 안 기와 줄 윗모에 하늘빛 맺힘(밤 그림)."""
    px = im.load(); W, Hh = im.size; pts = []
    for y in range(max(1, y0), min(Hh, y1)):
        for x in range(W):
            p = px[x, y]; q = px[x, y - 1]
            if p[3] < 200: continue
            if (q[3] < 100 or lum3(q) < lum3(p) - 14) and H(x, y, seed) < dens * (1.4 if x < W * 0.5 else 0.7): pts.append((x, y))
    sheen_top(px, W, Hh, pts, seed, 0.55)

def finish_house(day, roof_rows, wall_top, lit=(), seed=1, moss=True, stains=True):
    """낮 집 그림 -> 밤 집: 등급, 켜진 창(상자 목록), 젖은 기와, 빗물 얼룩, 밑동 이끼·잔풀."""
    day = slate(day)
    im = night(day); px = im.load(); W, Hh = im.size
    for b in lit: relight_glass(day, im, b, seed)
    wet_roof(im, 0, roof_rows, seed)
    if stains: drip_stains(px, W, Hh, 0, W, wall_top, Hh - 2, seed + 5, 0.16, 0.2)
    if moss: moss_foot(px, W, Hh, 0, W, Hh - 1, seed + 7, 7, 0.45)
    ntufts(px, W, Hh, 0, W, Hh - 1, seed + 9, 0.35, 3)
    return im

# ---------------------------------------------------------------- ① 바깥 계단·발코니 3층 집
IR = [ST[1], ST[1], ST[2], ST[2], ST[3], ST[4], ST[5]]          # 쇠 난간(낮 재료: 칩셋 돌 어두운 단)

def stone_stair_side(rise=32, run=5, step=4, depth=7, up='L', seed=1):
    """벽을 따라 오르는 돌 바깥 계단(옆에서 본 긴 면): 디딤판 윗면(밝음, depth px) + 그 밑을 꽉 채운 마름돌 옆면,
    계단 코 한 줄 그늘, 디딤판 위로 쇠 난간(기둥 + 경사 손잡이). up='L' 이면 오른쪽 아래에서 왼쪽 위로 오른다."""
    n = rise // step; W = n * run + 3; Hh = rise + depth + 12; o = Image.new('RGBA', (W, Hh)); px = o.load()
    yb = Hh - 1
    def xi(i): return (W - 1 - (i + 1) * run) if up == 'L' else i * run
    for i in range(n):
        x0 = xi(i); yt = yb - depth - (i + 1) * step + 1
        for x in range(x0, x0 + run + (1 if i == n - 1 else 0)):
            for y in range(yt, yb + 1):
                if y < yt + depth:
                    c = ST[6] if y == yt else (ST[5] if y < yt + depth - 2 else ST[4])
                    if H(x, y, seed) > 0.92: c = ST[4]
                elif y == yt + depth: c = ST[2]                                       # 계단 코 그늘
                else:
                    c = castle6.ash(x + seed * 7, y, bw=10, bh=5, seed=seed)
                    if y > yb - 2: c = ST[2]
                put(px, W, Hh, x, y, c)
        e = x0 if up == 'L' else x0 + run - 1                                         # 디딤판 끝 모(빛 반대쪽 그늘)
        for y in range(yt, yt + depth): put(px, W, Hh, e if up != 'L' else x0 + run - 1 if False else e, y, ST[4])
    # 쇠 난간: 디딤판 앞모 위 9px, 기둥 두 디딤판마다, 손잡이는 기둥 머리를 잇는 경사선
    tops = []
    for i in range(0, n, 2):
        x = xi(i) + run // 2; yt = yb - depth - (i + 1) * step + 1 + depth - 2
        for y in range(yt - 9, yt): put(px, W, Hh, x, y, IR[3])
        tops.append((x, yt - 10))
    xe = xi(n - 1) + (0 if up == 'L' else run); tops.append((xe, yb - depth - n * step + 1 + depth - 12))
    tops.sort()
    for (xa, ya), (xb, yb_) in zip(tops, tops[1:]):
        for x in range(xa, xb + 1):
            y = int(round(ya + (yb_ - ya) * (x - xa) / max(1, xb - xa)))
            put(px, W, Hh, x, y, IR[5]); put(px, W, Hh, x, y + 1, IR[2])
    return o

def iron_landing(w=48, D=8, seed=1):
    """2층 돌 층계참·발코니: 판석 윗면(D px, 앞으로 갈수록 밝게) + 앞 두께 3px + 까치발 돌 둘 + 쇠 난간(손잡이·가는 살)."""
    Hh = D + 3 + 6; o = Image.new('RGBA', (w, Hh)); px = o.load()
    for y in range(D):
        for x in range(w):
            c = ST[5] if (x // 8 + y // 4) % 2 else ST[4]
            if y == 0: c = ST[3]
            if x % 8 == 7: c = ST[3]
            put(px, w, Hh, x, y, c)
    for x in range(w):
        for y in range(D, D + 3): put(px, w, Hh, x, y, ST[6] if y == D else (ST[4] if y == D + 1 else ST[2]))
    for x0 in (4, w - 8):
        for y in range(D + 3, Hh):
            k = y - D - 3
            for x in range(x0 + k // 2, x0 + 4 - k // 2): put(px, w, Hh, x, y, ST[5] if x == x0 + k // 2 else ST[3])
    return o

def iron_rail_front(w=48, h=9):
    """발코니 앞 쇠 난간(낮 재료): 위 손잡이 2px, 아래 띠 1px, 살 3px 간격, 양끝 기둥 굵게."""
    o = Image.new('RGBA', (w, h)); px = o.load()
    for x in range(w):
        put(px, w, h, x, 0, IR[5]); put(px, w, h, x, 1, IR[2]); put(px, w, h, x, h - 2, IR[3])
        if x % 3 == 1 or x in (0, 1, w - 2, w - 1):
            for y in range(2, h - 2): put(px, w, h, x, y, IR[4] if x % 3 == 1 else IR[3])
    return o

def balconette(w=14):
    """창 앞 작은 쇠 발코니: 좁은 돌 받침 + 둥근 배 난간."""
    Hh = 12; o = Image.new('RGBA', (w, Hh)); px = o.load()
    for x in range(w):
        put(px, w, Hh, x, 8, ST[6]); put(px, w, Hh, x, 9, ST[4]); put(px, w, Hh, x, 10, ST[2])
        put(px, w, Hh, x, 1, IR[5]); put(px, w, Hh, x, 2, IR[2])
        if x % 3 == 1 or x in (0, w - 1):
            for y in range(3, 8): put(px, w, Hh, x + (1 if (y in (4, 5) and x < w // 2) else (-1 if y in (4, 5) and x > w // 2 else 0)), y, IR[4])
    return o

def stair_house(seed=11, wc=6, roof='sto', st='tim', gs='sto', laundry=True, lit_idx=((1, 4), (0, 1))):
    """3층 돌·반목조 집: 오른쪽 땅에서 1층 벽을 따라 왼쪽으로 오르는 돌 바깥 계단(쇠 난간) → 2층 돌 층계참·발코니(2층 문 앞, 빨래) ,
    3층 창 앞 작은 쇠 발코니, 창마다 덧문, 창 두 개에 불이 켜졌다. 지붕은 젖은 청회색 슬레이트."""
    W = wc * 16; Rh = 44; pad = 16; S = 3
    up3 = 'l' + ''.join('w' if i % 2 == 1 else 'p' for i in range(1, wc - 1)) + 'r'
    up2 = list('l' + 'p' * (wc - 2) + 'r'); up2[1] = 'w'; up2[2] = 'd'
    if wc >= 6: up2[wc - 2] = 'w'
    up2 = ''.join(up2)
    low = list('l' + 'p' * (wc - 2) + 'r'); low[1] = 'd'; low = ''.join(low)
    rows = SR(st, up3, 'eave', 'jetty') + SR(st, up2, 'plain', 'jetty') + SR(gs, low, 'plain', 'base')
    b = pj.assemble(rows, pv.L()).crop((0, 0, W, S * 32))
    day = Image.new('RGBA', (W, pad + Rh + b.height + 2))
    day.alpha_composite(ph2.steep_hip(roof, W, Rh), (0, pad)); day.alpha_composite(b, (0, pad + Rh))
    day = ph2.volume(day, pad + Rh)
    ph2.chimney(day, 1 * 16, pad - 12 + int(Rh * 0.25), roof)
    base = pad + Rh + b.height - 1; wy = pad + Rh
    px = day.load(); Wd, Hd = day.size
    boxes = {}
    for s in range(S):
        for i in range(wc):
            bx = glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if bx: boxes[(s, i)] = bx
    for k, (key, bx) in enumerate(sorted(boxes.items())):
        st_ = ('open', 'L', 'open', 'hang', 'open', 'shut')[(k + seed) % 6]
        if key in lit_idx and st_ == 'shut': st_ = 'open'
        shutters(px, Wd, Hd, bx, SHUT if (k + seed) % 3 else SHUT2, seed + k, st_)
    sst = stone_stair_side(rise=32, run=5, step=4, depth=7, up='L', seed=seed)
    land = iron_landing(16 * 3 + 6, 8, seed)
    lx = 16 - 2
    day.alpha_composite(land, (lx, base - 32 - 4))
    day.alpha_composite(sst, (W - sst.width, base - sst.height + 2))
    rail = iron_rail_front(land.width - 2, 9)
    day.alpha_composite(rail, (lx + 1, base - 32 - 4 + 8 - 9 + 1))
    if laundry: _laundry_on_rail(day, lx + 3, base - 32 - 4 + 2, 30, seed)
    for (s, i) in ((0, 3),):
        if (s, i) in boxes:
            x0, y0, x1, y1 = boxes[(s, i)]; bc = balconette(x1 - x0 + 6); day.alpha_composite(bc, (x0 - 3, y1 - 6))
    lit = [boxes[k] for k in lit_idx if k in boxes]
    im = finish_house(day, pad + Rh, wy, lit, seed)
    return im

def cloth_shape(kind, col):
    """빨래 한 장(낮 재료): 'shirt' 셔츠(어깨·소매·몸판·옷깃), 'sheet' 홑청(아래가 물결, 세로 주름), 'pants' 바지(두 다리), 'towel' 수건(술)."""
    if kind == 'shirt':
        w, h = 11, 11; o = Image.new('RGBA', (w, h)); p = o.load()
        for y in range(h):
            for x in range(w):
                if y < 4: ok = True
                else: ok = 3 <= x < 8
                if y < 4 and (x < 1 or x > 9) and y > 2: ok = False
                if not ok: continue
                t = 5 if x < 4 else (4 if x < 7 else 3)
                if y == 0: t = 6
                if y == h - 1: t = 2
                if x in (3, 7) and y >= 4: t = 2
                p[x, y] = col[t] + (255,)
        p[5, 0] = col[1] + (255,); p[5, 1] = col[2] + (255,)
    elif kind == 'sheet':
        w, h = 13, 12; o = Image.new('RGBA', (w, h)); p = o.load()
        for x in range(w):
            hb = h - 1 - (1 if (x // 3) % 2 else 0)
            for y in range(hb + 1):
                t = 6 if y == 0 else (5 if x % 4 == 0 else 4)
                if x % 4 == 3: t = 3
                if y == hb: t = 2
                p[x, y] = col[t] + (255,)
    elif kind == 'pants':
        w, h = 8, 11; o = Image.new('RGBA', (w, h)); p = o.load()
        for y in range(h):
            for x in range(w):
                if y >= 4 and x in (3, 4): continue
                t = 4 if x < 3 else 3
                if y == 0: t = 5
                if y == h - 1: t = 1
                p[x, y] = col[t] + (255,)
    else:
        w, h = 7, 9; o = Image.new('RGBA', (w, h)); p = o.load()
        for y in range(h):
            for x in range(w):
                if y == h - 1 and x % 2: continue
                t = 5 if y < 2 else (4 if x < 4 else 3)
                if y == h - 2: t = 2
                p[x, y] = col[t] + (255,)
    return o

def _laundry_on_rail(im, x0, y0, w, seed):
    """발코니 난간·줄에 널어 둔 빨래(낮 재료): 셔츠·홑청·바지·수건이 섞여 처졌고 위에 빨래집게(나무 1px)."""
    px = im.load(); W, Hh = im.size; x = x0; k = 0
    kinds = ('shirt', 'sheet', 'towel', 'pants')
    while True:
        kd = kinds[(k * 3 + seed) % 4]; col = CLOTH[(k + seed) % 4]
        c = cloth_shape(kd, col)
        if x + c.width > x0 + w: break
        im.alpha_composite(c, (x, y0))
        put(px, W, Hh, x + 1, y0, WD[5]); put(px, W, Hh, x + c.width - 2, y0, WD[5])
        x += c.width + 1 + int(H(k, seed, 2) * 3); k += 1

# ---------------------------------------------------------------- ② 박공 정면 좁은 3층 집 (발코니 + 다락 불빛)
def gable_tall(seed=21, wc=4, st='tim', gs='sto', balcony=True, lit=((0, 1), (2, 2)), storeys=3, roof='sto'):
    """박공이 앞을 향한 좁은 3층 집: 2층 앞에 쇠 난간 발코니(빨래), 1층 문 위 차양 없는 처마 등, 다락 둥근 창에 불."""
    Wp = wc * 16; G = int(Wp * 0.42) // 2 * 2; roofH = 2 * 16 + G
    g = pv.gable_end(roof, Wp, roofH, G, window=True, timber=True)
    up = 'l' + ''.join('w' if i in (1, wc - 2) else 'p' for i in range(1, wc - 1)) + 'r'
    low = list('l' + 'p' * (wc - 2) + 'r'); low[wc // 2] = 'd'; low = ''.join(low)
    b = body(st, gs, up, low, storeys)
    day = Image.new('RGBA', (Wp, roofH + b.height + 2)); day.alpha_composite(g, (0, 0)); day.alpha_composite(b, (0, roofH))
    px = day.load(); Wd, Hd = day.size; wy = roofH; base = roofH + b.height - 1
    boxes = {}
    for s in range(storeys):
        for i in range(wc):
            bx = glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if bx: boxes[(s, i)] = bx
    for k, (key, bx) in enumerate(sorted(boxes.items())):
        shutters(px, Wd, Hd, bx, SHUT2 if seed % 2 else SHUT, seed + k, ('open', 'hang', 'L', 'open')[(k + seed) % 4])
    if balcony and storeys >= 2:
        land = iron_landing(Wp - 12, 7, seed); day.alpha_composite(land, (6, base - 32 - 4))
        day.alpha_composite(iron_rail_front(Wp - 14, 9), (7, base - 32 - 4 + 7 - 9 + 1))
        _laundry_on_rail(day, 10, base - 32 - 4 + 2, Wp - 22, seed + 3)
    att = glass_boxes(day, 0, roofH - G, Wp, roofH)
    lits = [boxes[k] for k in lit if k in boxes] + ([att] if att else [])
    im = finish_house(day, roofH - G, roofH, lits, seed)
    return im

# ---------------------------------------------------------------- ③ 지붕 꺼진 폐가 (2층, 판자 창)
def ruin_house(seed=31, wc=5, st='sto', gs='sto'):
    """비에 꺼진 2층 돌집: 슬레이트 용마루가 내려앉고 앞 경사에 큰 구멍(서까래), 창은 판자로 막히거나 깨졌다. 불은 없다."""
    W = wc * 16; Rh = 44; pad = 16
    base_roof = ph2.steep_hip('sto', W, Rh)
    roof, _ = RH._sag(base_roof, ((W * 0.55, W * 0.3, 8),))
    rp = roof.load()
    m = RH._blob(W, Rh, ((W * 0.58, 24, W * 0.17, 9),), seed); m &= (np.array(roof)[:, :, 3] > 0); m[Rh - 3:, :] = False
    RH._hole_paint(rp, W, Rh, m, seed, 'v', 5, False, (1,), wall_st=st)
    up = 'l' + ''.join('w' if i % 2 == 1 else 'p' for i in range(1, wc - 1)) + 'r'
    low = list('l' + 'p' * (wc - 2) + 'r'); low[2] = 'd'
    if wc >= 4: low[1] = 'w'
    if wc >= 5: low[wc - 2] = 'w'
    low = ''.join(low)
    b = body(st, gs, up, low, 2)
    day = Image.new('RGBA', (W, pad + Rh + b.height)); day.alpha_composite(roof, (0, pad)); day.alpha_composite(b, (0, pad + Rh))
    day = ph2.volume(day, pad + Rh)
    RH.chimney_broken(day, (wc - 2) * 16, pad - 4 + int(Rh * 0.25), seed)
    px = day.load(); Wd, Hd = day.size; wy = pad + Rh
    for s in range(2):
        for i in range(wc):
            bx = glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if not bx: continue
            x0, y0, x1, y1 = bx
            RH.broken_window(px, Wd, Hd, x0, y0, x1 - x0, y1 - y0, seed + i + s, 'L' if (i + s) % 3 == 0 else None, (i + s) % 2 == 1)
    for i, ch in enumerate(low):
        if ch == 'd':
            doorway_box = (i * 16 + 3, wy + 32 + 8)
            RH.doorway(px, Wd, Hd, doorway_box[0], doorway_box[1], 10, 23, seed, 'boarded')
    RH.crack(px, Wd, Hd, W // 3, wy + 4, 14, seed); RH.crack(px, Wd, Hd, W - 20, wy + 36, 10, seed + 1)
    im = finish_house(day, pad + Rh, wy, (), seed)
    px = im.load()
    RH._ivy_dead(px, W, im.height, 6, im.height - 2, wy - 6, seed) if False else None
    return im

# ---------------------------------------------------------------- ④ 셔터 내린 가게 집 (찢긴 차양)
def shop_house(seed=41, wc=5, st='tim', gs='sto', lit=((0, 1),), roof='sto'):
    """2층 가게 집: 1층 가게 창은 나무 셔터로 닫혔고 찢긴 줄무늬 차양에서 빗물이 떨어진다. 문 위 쇠 간판 걸이(그림 없는 빈 판), 2층 창 하나에 불."""
    W = wc * 16; Rh = 44; pad = 16
    up = 'l' + ''.join('w' if i % 2 == 1 else 'p' for i in range(1, wc - 1)) + 'r'
    low = list('l' + 'p' * (wc - 2) + 'r'); low[1] = 'd'; low[2] = 'w'; low[3] = 'w'; low = ''.join(low)
    b = body(st, gs, up, low, 2)
    day = Image.new('RGBA', (W, pad + Rh + b.height)); day.alpha_composite(ph2.steep_hip(roof, W, Rh, ends='L'), (0, pad)); day.alpha_composite(b, (0, pad + Rh))
    day = ph2.volume(day, pad + Rh)
    ph2.chimney(day, (wc - 2) * 16, pad - 12 + int(Rh * 0.25), roof)
    px = day.load(); Wd, Hd = day.size; wy = pad + Rh
    boxes = {}
    for s in range(2):
        for i in range(wc):
            bx = glass_boxes(day, i * 16, wy + s * 32, i * 16 + 16, wy + s * 32 + 32)
            if bx: boxes[(s, i)] = bx
    for (s, i), bx in boxes.items():
        if s == 1 and i in (2, 3): shutters(px, Wd, Hd, bx, SHUT2, seed + i, 'shut')
        else: shutters(px, Wd, Hd, bx, SHUT, seed + i, 'open' if i % 2 else 'L')
    # 찢긴 차양(가게 창 위): 줄무늬 천 경사, 앞 끝은 들쭉날쭉 찢겼다
    ax0, ax1 = 2 * 16 - 2, 4 * 16 + 2; ay = wy + 32 + 2
    for y in range(9):
        for x in range(ax0, ax1):
            if y >= 6 and H(x // 2, seed, 5) < 0.45 + 0.1 * (y - 6): continue
            stripe = ((x - ax0) // 4) % 2
            c = (CLOTH[2] if stripe else CLOTH[3])[5 - y // 3]
            if y == 0: c = WD[2]
            put(px, Wd, Hd, x, ay + y, c)
    # 간판 걸이: 벽에서 나온 쇠 막대 + 빈 판(글자 없음)
    sx = 1 * 16 + 12; sy = wy + 32 - 4
    for x in range(sx, sx + 9): put(px, Wd, Hd, x, sy, ST[2])
    for y in range(sy + 1, sy + 10):
        for x in range(sx + 2, sx + 9):
            put(px, Wd, Hd, x, y, WD[5] if x == sx + 2 or y == sy + 1 else (WD[3] if (y - sy) % 3 else WD[2]))
    lit = [boxes[k] for k in lit if k in boxes]
    im = finish_house(day, pad + Rh, wy, lit, seed)
    return im

# ---------------------------------------------------------------- ⑤ 언덕 위 시계탑 (앞면 시계, 글자 없음, 첨탑)
ASHS = lambda X, Y, seed=0: castle6.ash(X, Y, bw=12, bh=6, seed=seed)

def clock_face(px, W, Hh, cx, cy, r, seed=1):
    """시계판(낮 재료): 돌 테(왼쪽 위 밝음) + 바랜 크림 판 + 12 눈금 점(숫자 없음) + 시침·분침(쇠) + 가운데 축."""
    CR = [hx(c) for c in ['#2b203f'] + list(pv.palette.RAMPS_CHIP['plaster'])] if hasattr(pv, 'palette') else None
    import palette as _pal
    CR = [hx(c) for c in ['#2b203f'] + _pal.RAMPS_CHIP['plaster']]
    for y in range(int(cy - r - 3), int(cy + r + 4)):
        for x in range(int(cx - r - 3), int(cx + r + 4)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r - 1:
                t = 5 if (x + 0.5 - cx) + (y + 0.5 - cy) < -r * 0.3 else 4
                if d > r - 2.2: t = 3
                put(px, W, Hh, x, y, CR[t])
            elif d <= r + 1.2: put(px, W, Hh, x, y, ST[6] if (x + 0.5 < cx and y + 0.5 < cy + 2) else ST[3])
            elif d <= r + 2.6: put(px, W, Hh, x, y, ST[2] if (x + 0.5 > cx or y + 0.5 > cy) else ST[5])
    for k in range(12):
        a = k / 12 * 2 * math.pi
        x = int(round(cx + math.sin(a) * (r - 3.2) - 0.5)); y = int(round(cy - math.cos(a) * (r - 3.2) - 0.5))
        put(px, W, Hh, x, y, ST[1])
        if k % 3 == 0: put(px, W, Hh, x + (1 if k == 9 else 0) - (1 if k == 3 else 0), y + (1 if k == 0 else 0) - (1 if k == 6 else 0), ST[1])
    for (ang, ln, c) in ((-1.05, r * 0.5, ST[1]), (0.5, r * 0.78, ST[2])):       # 시침(짧고 굵게)·분침 — 멈춘 시각
        for i in range(int(ln) + 1):
            x = int(round(cx + math.sin(ang) * i - 0.5)); y = int(round(cy - math.cos(ang) * i - 0.5))
            put(px, W, Hh, x, y, c)
            if ln < r * 0.6: put(px, W, Hh, x + 1, y, c)
    put(px, W, Hh, int(cx - 0.5), int(cy - 0.5), ST[6]); put(px, W, Hh, int(cx + 0.5), int(cy - 0.5), ST[3])

def clock_tower(seed=51, wc=3):
    """언덕 위 시계탑: 회색 마름돌 네모 탑(모서리 큰 돌·층 띠돌), 아래 아치 문, 가는 아치 창 둘, 꼭대기 쪽 시계판(숫자 없음),
    그 위 종실(쌍 아치 열린 창 · 종), 처마 돌림띠 위로 슬레이트 네모뿔 첨탑과 쇠 꼭지. 비 얼룩·이끼."""
    W = wc * 16; Hb = 128; sp = pj.spire('sto', wc, 4); Hs = sp.height
    Hh = Hs - 6 + Hb; day = Image.new('RGBA', (W, Hh)); px = day.load()
    y0 = Hs - 6                                                  # 몸통 윗선
    for y in range(y0, Hh):
        for x in range(W):
            z = Hh - 1 - y                                       # 땅에서 높이
            c = ASHS(x + seed, y, seed)
            if x < 4 or x >= W - 4:                              # 모서리 큰 돌(번갈아 긴/짧은 돌)
                q = (z // 8) % 2; e = x if x < 4 else W - 1 - x
                if (q == 0 and e < 4) or (q == 1 and e < 3):
                    c = ST[6] if e == 0 and x < 4 else (ST[5] if x < 4 else ST[4])
                    if z % 8 == 7: c = ST[3]
            if z in (40, 41, 84, 85) or y in (y0 + 6, y0 + 7): c = ST[6] if z in (41, 85) or y == y0 + 6 else ST[4]   # 띠돌 윗면
            if z in (38, 39, 82, 83) or y == y0 + 8: c = ST[3]                                                  # 띠돌 그늘
            if y < y0 + 6: c = ST[5] if y < y0 + 2 else (ST[4] if y < y0 + 4 else ST[3])                       # 처마 돌림띠
            if z < 3: c = ST[3] if z == 2 else ST[2]
            put(px, W, Hh, x, y, c)
    cx = W / 2
    # 아래 아치 문(어두운 문간 + 나무 문 반쯤 열림)
    door = castle6.big_door(12, 22); day.alpha_composite(door, (int(cx - door.width / 2), Hh - door.height - 2))
    castle6.arch_window(px, W, Hh, int(cx) - 3, Hh - 1 - 74, 6, 14)
    # 시계(띠돌 84 위)
    clock_face(px, W, Hh, cx, Hh - 1 - 102, 12, seed)
    # 종실: 몸통 맨 위 아래로 열린 쌍 아치(어둠 속 종)
    for ox in (-9, 3):
        castle6.arch_window(px, W, Hh, int(cx) + ox, y0 + 10, 6, 10)
    for ox in (-9, 3):
        for y in range(y0 + 12, y0 + 21):
            for x in range(int(cx) + ox, int(cx) + ox + 6): put(px, W, Hh, x, y, DK[1] if y < y0 + 16 else DK[2])
        bx = int(cx) + ox + 3
        for j in range(5):
            for i in range(-1 - j // 2, 2 + j // 2):
                put(px, W, Hh, bx + i, y0 + 15 + j, R('bronze')[5 if i < 0 else 3])
    day.alpha_composite(sp, (0, 0))
    day = slate(outline_in(day))
    im = night(day); p = im.load()
    drip_stains(p, W, Hh, 0, W, y0 + 8, Hh - 4, seed, 0.16, 0.26)
    moss_foot(p, W, Hh, 0, W, Hh - 1, seed + 2, 10, 0.5)
    wet_roof(im, 0, Hs - 4, seed, 0.3)
    # 종실 안 등불 하나(희미하게) — 시계탑이 밤에도 읽힌다
    glow(p, W, Hh, cx - 6, y0 + 17, 5, 0.25)
    ntufts(p, W, Hh, 0, W, Hh - 1, seed + 4, 0.4, 3)
    return im

# ---------------------------------------------------------------- ⑥ 무너진 극장 (언덕 위)
def theatre_ruin(seed=61, wc=9):
    """낡은 극장: 넓은 마름돌 정면 2층(높은 아치 창 줄), 가운데 기둥 현관(박공 · 기둥 넷 · 어두운 큰 문),
    지붕은 젖은 슬레이트인데 가운데가 크게 꺼져 서까래와 텅 빈 객석 안이 보인다. 오른쪽 모서리는 계단꼴로 무너져 돌무더기."""
    W = wc * 16; Rh = 48; pad = 6; F = 72
    base_roof = ph2.steep_hip('sto', W, Rh)
    roof, _ = RH._sag(base_roof, ((W * 0.5, W * 0.28, 10),))
    rp = roof.load()
    m = RH._blob(W, Rh, ((W * 0.48, 26, W * 0.2, 11), (W * 0.66, 30, W * 0.08, 7)), seed); m &= (np.array(roof)[:, :, 3] > 0); m[Rh - 4:, :] = False
    RH._hole_paint(rp, W, Rh, m, seed, 'v', 5, False, (1, 3), wall_st='sto')
    Hh = pad + Rh + F
    day = Image.new('RGBA', (W, Hh)); day.alpha_composite(roof, (0, pad))
    fac = Image.new('RGBA', (W, F)); fp = fac.load()
    for y in range(F):
        for x in range(W):
            c = ASHS(x, y, seed + 3)
            if y in (0, 1): c = ST[6] if y == 0 else ST[4]
            if y in (36, 37): c = ST[6] if y == 36 else ST[4]
            if y == 38: c = ST[3]
            if y >= F - 5: c = ST[(5, 4, 4, 3, 2)[y - (F - 5)]]
            put(fp, W, F, x, y, c)
    for k in range(wc):
        if 3 <= k <= 5: continue
        for s in range(2):
            castle6.arch_window(fp, W, F, k * 16 + 5, 6 + s * 36, 6, 22 if s == 1 else 20)
    fac = outline_in(fac)
    day.alpha_composite(fac, (0, pad + Rh))
    day = ph2.volume(day, pad + Rh)
    por = roman.portico(5)                                      # 가운데 현관(5칸 = 80px), 아래 8px 는 땅선 밑으로
    pp = por.load()
    for y in range(26, 56):                                     # 현관 속 큰 문: 어둠 + 한 짝 기운 문
        for x in range(26, 54):
            if 26 + 2 <= x < 54 - 2 and y >= 30:
                put(pp, por.width, por.height, x, y, DK[1] if y < 40 else DK[2])
    for y in range(32, 56):
        for x in range(28, 40):
            sh = int((y - 32) * 0.12)
            put(pp, por.width, por.height, x + sh, y, WD[4] if (x - 28) % 4 else WD[2])
    for k in range(4): roman.column(pp, por.width, por.height, int(7 + k * (por.width - 14) / 3), 23, 55, 6)
    day.alpha_composite(por, ((W - por.width) // 2, Hh - por.height + 8 - 8))
    # 오른쪽 모서리 무너짐: 계단꼴로 벽을 지우고 그 밑에 마름돌 무더기
    dp = day.load()
    for x in range(W - 26, W):
        cut = pad + Rh - 6 + int((x - (W - 26)) * 1.9 // 4 * 4)
        for y in range(0, min(Hh - 10, cut)):
            dp[x, y] = (0, 0, 0, 0)
        yy = min(Hh - 10, cut)
        if dp[x, yy][3]: dp[x, yy] = ST[6] + (255,); dp[x, min(Hh - 1, yy + 1)] = ST[5] + (255,)
    for i in range(40):
        rx = W - 30 + int(H(i, seed, 1) * 30); ry = Hh - 3 - int(H(i, seed, 2) * 14 * (1 - abs(rx - (W - 14)) / 18.0))
        for j in range(3):
            for k_ in range(4):
                put(dp, W, Hh, rx + k_, ry + j, ST[6] if j == 0 and k_ < 2 else (ST[4] if j == 0 else ST[3] if j == 1 else ST[2]))
    day = slate(outline_in(day))
    im = night(day); p = im.load()
    drip_stains(p, W, Hh, 0, W, pad + Rh + 2, Hh - 6, seed, 0.18, 0.24)
    moss_foot(p, W, Hh, 0, W, Hh - 1, seed + 2, 9, 0.5)
    wet_roof(im, pad, pad + Rh, seed, 0.25)
    # 덩굴: 정면 왼쪽 위로 기어오른 담쟁이(밤 공간 잎)
    NLF = [N(c) for c in R('leaf')]
    for (x0, top) in ((10, 50), (22, 30), (W - 42, 40)):
        xx = x0
        for y in range(Hh - 4, Hh - 4 - top, -1):
            i = Hh - 4 - y
            if i % 4 == 0: xx = x0 + int((H(i, seed, x0) - 0.5) * 4)
            put(p, W, Hh, xx, y, NLF[2])
            if i % 2: put(p, W, Hh, xx - 1, y, NLF[4]); put(p, W, Hh, xx + 1, y - 1, NLF[3])
    ntufts(p, W, Hh, 0, W, Hh - 1, seed + 4, 0.45, 4)
    return im

BUILDINGS = ['stair_house', 'gable_tall', 'ruin_house', 'shop_house', 'clock_tower', 'theatre_ruin']
