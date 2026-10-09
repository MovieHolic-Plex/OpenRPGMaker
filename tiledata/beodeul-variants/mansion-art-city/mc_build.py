# 저택·예술 도시 건물: 버들항 회벽 집 블록(v6pieces.stucco_facade 의 회벽 결·모서리 돌·창 틀 규칙, ph2.steep_hip 지붕,
# portico6 현관·temple6 박공)을 그대로 따라 그리고, 귀족풍으로만 바꾼다 — 짙은 붉은 기와(nob), 금 장식(칩셋 금 램프),
# 포도주빛 덧문, 피아노 노빌레(2층) 높은 아치 창과 금 쐐기돌, 처마 금 띠, 지붕 난간과 금 항아리.
from mc_base import *
from mc_base import _hash
PL = v6pieces.PLASTER


def ctex(X, Y): return v6pieces.ctex(*PL, X, Y)


# ------------------------------------------------------------------ 지붕
def roof(W, Rh, ends=True, e=None):
    return nob_roof(ph2.steep_hip('tim', W, Rh, e=e, ends=ends))


def gold_finial(px, W, H, cx, y, h=6):
    """금 꼭지(공 + 받침): 지붕 마룻대·박공 꼭대기."""
    for j in range(h):
        hw = (1, 2, 2, 1, 1, 2)[j % 6]
        for x in range(cx - hw, cx + hw):
            put(px, W, H, x, y + j, GOLD[6 if x < cx - 1 and j < 3 else (5 if x < cx else 3)])
    put(px, W, H, cx - 1, y, GOLD[6])


def urn(px, W, H, cx, yb):
    """난간 위 금 항아리(5x7)."""
    rows = [(1,), (2,), (3,), (3,), (2,), (1,), (2,)]
    for j, (hw,) in enumerate(rows):
        y = yb - 7 + j
        for x in range(cx - hw, cx + hw + 1):
            t = 6 if x < cx - hw + 1 and j < 4 else (5 if x <= cx else (4 if x < cx + hw else 3))
            if j == 6: t = 3
            put(px, W, H, x, y, GOLD[t])


def balustrade(px, W, H, x0, x1, y0, R_=None, urns=()):
    """돌 난간(위 갓 3px · 난간동자 6px · 아래 띠 2px), 크림 회벽 램프. urns: 그 x 에 금 항아리."""
    R_ = R_ or CRM
    for x in range(x0, x1):
        for j, t in enumerate((6, 5, 3)): put(px, W, H, x, y0 + j, R_[t])
        k = (x - x0) % 4
        for j in range(3, 9):
            if k < 3 and not (j in (5, 6) and k != 1): put(px, W, H, x, y0 + j, R_[(5, 4, 2)[k] if j not in (5, 6) else 4])
            elif k == 3: put(px, W, H, x, y0 + j, mul(R_[2], .7))
        put(px, W, H, x, y0 + 9, R_[5]); put(px, W, H, x, y0 + 10, R_[2])
    for cx in urns: urn(px, W, H, cx, y0)


# ------------------------------------------------------------------ 앞면
def window(px, W, H, x0, y0, wh, arch=False, gold=True, shutter='wine', lit=False):
    """버들항 창 규칙(크림 돌 테·창턱·가운데 창살·왼쪽 위 반짝) + 귀족풍: 아치 머리와 금 쐐기돌, 포도주빛 덧문."""
    for y in range(y0 - 2, y0 + wh + 2):
        for x in range(x0 - 1, x0 + 7):
            if y < y0: c = CRM[6] if y == y0 - 2 else CRM[4]
            elif y >= y0 + wh: c = CRM[5] if y == y0 + wh else CRM[3]
            elif x in (x0 - 1, x0 + 6): c = CRM[6] if x == x0 - 1 else CRM[4]
            else:
                c = GL[1] if y < y0 + wh // 2 else GL[2]
                if lit: c = GOLD[4] if y < y0 + wh // 2 else GOLD[3]
            if x == x0 + 2 and y0 <= y < y0 + wh: c = CRM[5]
            if arch and y < y0 + 3 and x0 - 1 <= x <= x0 + 6:                       # 반원 머리: 모서리를 벽으로 되돌린다
                r = math.hypot(x + .5 - (x0 + 3), (y0 + 3 - (y + .5)) * 1.3)
                if r > 4.2: continue
                if r > 3.1: c = CRM[6] if x < x0 + 3 else CRM[4]
            put(px, W, H, x, y, c)
    if not lit: put(px, W, H, x0, y0 + 2, GL[3]); put(px, W, H, x0, y0 + 3, GL[3])
    if gold:                                                                       # 금 쐐기돌
        ky = y0 - 3 if not arch else y0 - 2
        for x in (x0 + 2, x0 + 3):
            put(px, W, H, x, ky, GOLD[5] if x == x0 + 2 else GOLD[4]); put(px, W, H, x, ky + 1, GOLD[3])
    if shutter:
        S = R[shutter]
        for y in range(y0 + (2 if arch else 0), y0 + wh):
            for x in (x0 - 3, x0 - 2, x0 + 7, x0 + 8):
                put(px, W, H, x, y, S[4] if (y - y0) % 3 else S[2])
            put(px, W, H, x0 - 3, y, S[5])


def door(px, W, H, x0, y0, yb, dw=10):
    """금 문틀의 2짝 문(포도주빛 판, 금 손잡이), 위 부채꼴 채광창."""
    for y in range(y0 - 3, yb):
        for x in range(x0 - 1, x0 + dw + 1):
            edge = x in (x0 - 1, x0 + dw) or y == y0 - 3
            if y < y0:
                c = GL[1] if not edge else GOLD[5]
                if not edge and (x - x0) % 3 == 1: c = GOLD[3]
            else:
                if edge: c = GOLD[5] if x < x0 + dw // 2 else GOLD[3]
                else:
                    c = WINE[4] if (x - x0) % 5 else WINE[2]
                    if (y - y0) % 7 == 0: c = WINE[2]
                    if x in (x0 + dw // 2 - 1, x0 + dw // 2): c = WINE[1]
            put(px, W, H, x, y, c)
    put(px, W, H, x0 + dw // 2 - 2, y0 + 9, GOLD[6]); put(px, W, H, x0 + dw // 2 + 1, y0 + 9, GOLD[5])


def quoin(px, W, H, x0, y0, y1, left=True):
    for y in range(y0, y1):
        blk = (y - y0) // 5; w = 5 if blk % 2 == 0 else 3
        for i in range(w):
            x = x0 + i if left else x0 - i
            c = CRM[5] if (y - y0) % 5 else CRM[3]
            if (y - y0) % 5 == 1: c = CRM[6]
            put(px, W, H, x, y, c)


def facade(wc, storeys, door_at=None, tall=32, arch_storey=None, skip=(), shutter='wine', lit=(), rustic=True, dw=10, seed=0):
    """귀족 회벽 앞면: 칩셋 회벽(248,16) 결 + 모서리 돌 + 층 띠(맨 위 처마 아래 금 띠 1px) + 맨 아래층 돌 줄눈(러스티카).
    arch_storey 층은 아치 창(높게), lit 은 (층,칸) 불 켠 창."""
    W = wc * 16; H = storeys * tall; o = new(W, H); px = o.load()
    for y in range(H):
        for x in range(W):
            c = ctex(x, y)
            if y % tall == 0 and y > 0: c = CRM[6]
            elif y % tall == 1 and y > 1: c = CRM[3]
            if rustic and y >= H - tall and (y - (H - tall)) % 6 == 5 and y < H - 4: c = mix(c, CRM[3], .55)     # 아래층 돌 줄눈
            if y >= H - 4: c = CRM[(5, 4, 4, 2)[y - (H - 4)]]
            put(px, W, H, x, y, c)
    for x in range(W): put(px, W, H, x, 0, GOLD[4] if x % 4 else GOLD[3]); put(px, W, H, x, 1, CRM[3])
    quoin(px, W, H, 0, 2, H - 4, True); quoin(px, W, H, W - 1, 2, H - 4, False)
    for s in range(storeys):
        for k in range(wc):
            if door_at is not None and s == storeys - 1 and k == door_at:
                x0 = k * 16 + 3 - (dw - 10) // 2; y0 = s * tall + (9 if tall >= 32 else 7)
                door(px, W, H, x0, y0, H - 4, dw); continue
            if (s, k) in skip or k in skip: continue
            arch = (s == arch_storey)
            x0 = k * 16 + 5; y0 = s * tall + (7 if arch else 9); wh = min(15 if arch else 12, tall - 13)
            window(px, W, H, x0, y0, wh, arch=arch, shutter=shutter, lit=(s, k) in lit)
    return o


def house(wc, storeys, door_at=None, Rh=40, chim=True, ends=True, tall=32, arch_storey=None, shutter='wine', skip=(), lit=(),
          rail=False, seed=0, dw=10):
    """귀족 회벽 집: 짙은 붉은 기와 모임지붕 + 귀족 앞면 + ph2.volume(처마 그늘) + 칩셋 굴뚝."""
    f = facade(wc, storeys, door_at, tall, arch_storey, skip, shutter, lit, dw=dw, seed=seed)
    pad = 16 if chim else 0
    im = new(wc * 16, pad + Rh + f.height)
    im.alpha_composite(roof(wc * 16, Rh, ends), (0, pad)); im.alpha_composite(f, (0, pad + Rh))
    im = ph2.volume(im, pad + Rh); ch = []
    if chim:
        for cx in ([16, wc * 16 - 32] if wc >= 6 else [0 if (door_at or 0) > 0 else (wc - 1) * 16]):
            ch.append(ph2.chimney(im, cx, pad - 12 + int(Rh * .25), 'tim'))
    return dict(im=pz.fin(im), door=door_at, chim=ch, above=pad, roof=pad + Rh)


# ------------------------------------------------------------------ 박공(앞으로 내민 삼각 지붕벽)
def front_gable(W, G, sun=True, band=4):
    """정면 박공(가운데 내민 칸 위의 삼각 벽): 크림 박공판 + 처마돌림(빛 왼쪽) + 박공 위 기와 띠(왼 빛·오른 그늘) + 금 해살 원판(글자 없음) + 금 꼭지."""
    RH = G + band + 6; o = new(W, RH); px = o.load(); gx = W / 2; top = RH - G
    lit = nob_roof(pj.nstex('tim', 'l', W, RH)).load(); dk = nob_roof(pj.nstex('tim', 'r', W, RH)).load()
    for y in range(RH):
        for x in range(W):
            d = abs(x + .5 - gx)
            half = gx * (y - top + 1) / G                       # 박공판 반폭
            if d > half + band * gx / G: continue
            if d > half: c = (lit if x < gx else dk)[x, y]; c = mul(c, 1.08) if d > half + band * gx / G - 1.5 else c
            elif d <= half - 3: c = mix(ctex(x, y), CRM[4], .35)
            elif d <= half - 1.5: c = CRM[3] if x < gx else CRM[2]
            else: c = CRM[6] if x < gx else CRM[4]
            put(px, W, RH, x, y, c)
    for x in range(W):                                           # 박공 밑 수평 처마(엔타블러처 윗선)
        put(px, W, RH, x, RH - 2, CRM[6] if x < W - 2 else CRM[4]); put(px, W, RH, x, RH - 1, GOLD[4] if x % 3 else GOLD[3])
    if sun:
        cy = top + int(G * .62); cx = int(gx)
        for y in range(cy - 5, cy + 5):
            for x in range(cx - 7, cx + 7):
                r = math.hypot((x + .5 - gx) / 3.6, (y + .5 - cy) / 2.8)
                ang = math.atan2(y + .5 - cy, x + .5 - gx)
                if r <= 1: put(px, W, RH, x, y, GOLD[5] if (x < cx and y < cy) else (GOLD[4] if r < .6 else GOLD[3]))
                elif r <= 2.0 and int((ang + 3.2) * 8 / math.pi) % 2 == 0 and y <= cy + 1: put(px, W, RH, x, y, GOLD[4] if x < cx else GOLD[3])
    gold_finial(px, W, RH, int(gx), max(0, top - 9), 6)
    return o


def portico(wc=5):
    """귀족 현관(내민 기둥 현관 + 위 발코니 난간): portico6 의 기둥 넷·엔타블러처·계단 둘을 그대로 쓰고, 박공 지붕 대신
    평평한 발코니(돌 난간 + 금 항아리 둘). 기둥 머리·엔타블러처 띠는 금."""
    po = v6pieces.portico6(wc)
    W, H = po.size; px = po.load(); gx = W // 2
    for y in range(0, 28):
        for x in range(W): px[x, y] = (0, 0, 0, 0)
    for y in range(20, 28):                                      # 발코니 바닥 윗면(크림 판석, 뒤로 갈수록 그늘)
        for x in range(1, W - 1): put(px, W, H, x, y, CRM[5] if y < 22 else (CRM[4] if (x // 8 + y) % 2 else mix(CRM[4], CRM[5], .5)))
    balustrade(px, W, H, 0, W, 17, urns=(3, W - 4))
    for x in range(W):
        if px[x, 31][3]: px[x, 31] = GOLD[4] + (255,) if x % 3 else GOLD[3] + (255,)
    xs = [8, 8 + (W - 16) // 3, W - 8 - (W - 16) // 3, W - 8]
    for cx in xs:
        for x in range(cx - 3, cx + 3): put(px, W, H, x, 35, GOLD[5] if x < cx else GOLD[3])
    return po


# ------------------------------------------------------------------ 앵커 1: 귀족 저택
def mansion():
    """17칸 대칭 저택: 날개 4칸(2층, 지붕 난간 + 금 항아리) + 가운데 9칸(3층, 2층은 아치 창, 정면 박공 5칸 + 금 해살) +
    현관 5칸(기둥 넷·금 머리), 굴뚝 둘. 문은 가운데 칸."""
    cw, ww = 9, 4
    c = house(cw, 3, door_at=4, Rh=48, arch_storey=1, lit=((1, 1), (1, 7), (2, 3), (2, 5)), dw=10)
    wl = house(ww, 2, Rh=40, chim=False, arch_storey=1, lit=((1, 2),))
    wr = house(ww, 2, Rh=40, chim=False, arch_storey=1, lit=((1, 1),))
    W = (cw + 2 * ww) * 16; base = c['im'].height; H = base + 8
    im = new(W, H)
    # 날개 지붕 앞에 난간(처마선) — 날개 지붕을 조금 가리고 금 항아리
    for wim, x in ((wl, 0), (wr, W - ww * 16)):
        w_ = wim['im'].copy(); p = w_.load(); ww_ = w_.width; hh = w_.height
        balustrade(p, ww_, hh, 0, ww_, wim['roof'] - 10, urns=(3, ww_ - 4))
        im.alpha_composite(w_, (x, base - hh))
    im.alpha_composite(c['im'], (ww * 16, 0))
    gw = 5 * 16; g = front_gable(gw, 26)
    im.alpha_composite(pz.fin(g), (ww * 16 + (cw * 16 - gw) // 2, c['roof'] - g.height + 3))
    po = portico(5)
    pp = po.load()
    for y in range(28 + 12, 28 + 34):                                               # 현관 뒤 문이 보이게 가운데를 연다
        for x in range(33, 48): pp[x, y] = (0, 0, 0, 0)
    im.alpha_composite(pz.fin(po), (ww * 16 + (cw * 16 - 80) // 2, H - po.height))
    door_cell = ww + 4
    return dict(im=im, door=door_cell, chim=[(x + ww * 16, y) for x, y in c['chim']], above=c['above'], below=8)


# ------------------------------------------------------------------ 앵커 2: 화랑(그림 전시관)
def framed(px, W, H, x0, y0, w, h, kind=0):
    """금 액자 속 그림(글자·얼굴 없음): 0 풍경(하늘·언덕·나무) 1 바다·노을 2 꽃병 정물 3 추상 색면."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1):
                c = GOLD[5] if (x == x0 or y == y0) else GOLD[3]; put(px, W, H, x, y, c); continue
            u = (x - x0 - 1) / max(1, w - 3); v = (y - y0 - 1) / max(1, h - 3)
            if kind == 0:
                c = R['sky'][5] if v < .45 else (LF[4] if v < .45 + .25 * (1 - u) else LF[3])
                if .25 < u < .45 and .2 < v < .6: c = LF[2]
            elif kind == 1:
                c = R['fire'][5] if v < .3 else (R['fire'][4] if v < .5 else (R['sky'][3] if v < .8 else R['sky'][2]))
                if abs(u - .62) < .12 and abs(v - .32) < .14: c = R['fire'][6]
            elif kind == 2:
                c = WINE[2]
                if abs(u - .5) < .18 and v > .55: c = R['sky'][4] if u < .5 else R['sky'][3]
                if math.hypot(u - .5, v - .35) < .28: c = R['red'][4] if (x + y) % 3 else R['gold'][5]
            else:
                c = R['navy'][3] if u < .5 else R['ochre'][4]
                if v > .6: c = R['red'][3]
            put(px, W, H, x, y, c)


def gallery():
    """화랑 9칸 2층: 짙은 붉은 기와 모임지붕 위 유리 채광 지붕(천창), 1층 큰 아치 진열창 넷(안에 금 액자 그림),
    가운데 금 문틀 큰 문 + 진홍 걸개 둘, 2층 금 액자 원형 간판(붓·팔레트 그림, 글자 없음)."""
    wc = 9; tall = 32; Rh = 44
    f = facade(wc, 2, door_at=4, tall=tall, arch_storey=None, skip=((1, 0), (1, 1), (1, 2), (1, 3), (1, 5), (1, 6), (1, 7), (1, 8)), dw=12)
    W = wc * 16; px = f.load(); H_ = f.height
    for i, k in enumerate((0, 2, 6, 8) if False else (1, 2, 6, 7)):                # 1층 큰 아치 진열창
        x0 = k * 16 - 4 + (4 if k in (2, 7) else 0); y0 = tall + 6; w_ = 16; h_ = 22
        for y in range(y0 - 2, y0 + h_ + 2):
            for x in range(x0 - 1, x0 + w_ + 1):
                r = math.hypot(x + .5 - (x0 + w_ / 2), (y0 + 7 - (y + .5)) * 1.0)
                if y < y0 + 7 and r > w_ / 2 + 1: continue
                if y >= y0 + h_: c = CRM[5] if y == y0 + h_ else CRM[3]
                elif (y < y0 + 7 and r > w_ / 2 - .2) or x in (x0 - 1, x0 + w_): c = CRM[6] if x < x0 + w_ / 2 else CRM[4]
                else: c = mix(GL[1], WINE[1], .3)
                put(px, W, H_, x, y, c)
        framed(px, W, H_, x0 + 3, y0 + 7, 10, 9, i)
        put(px, W, H_, x0 + w_ // 2, y0 - 2, GOLD[5]); put(px, W, H_, x0 + w_ // 2 - 1, y0 - 2, GOLD[4])
        put(px, W, H_, x0 + 1, y0 + 6, GL[3])
    for k in (0, 1, 2, 3, 5, 6, 7, 8):                                              # 2층 낮은 창(작은 사각)
        if k in (3, 5): continue
        window(px, W, H_, k * 16 + 5, 8, 12, arch=False, shutter=None)
    # 2층 가운데: 금 원형 간판(팔레트 + 붓)
    cx, cy = 4 * 16 + 8, 15
    for y in range(cy - 11, cy + 11):
        for x in range(cx - 13, cx + 13):
            r = math.hypot((x + .5 - cx) / 12.5, (y + .5 - cy) / 10.5)
            if r > 1: continue
            if r > .82: c = GOLD[5] if (x < cx and y < cy) else GOLD[3]
            else:
                c = WINE[3] if r < .78 else GOLD[2]
                pr = math.hypot((x + .5 - cx + 1) / 7.5, (y + .5 - cy) / 5.5)
                if pr < 1 and not (math.hypot(x + .5 - (cx + 3), y + .5 - (cy + 2)) < 2.2): c = R['ochre'][5] if x < cx else R['ochre'][4]
                for (dx, dy, m) in ((-3, -2, 'red'), (0, -3, 'sky'), (3, -1, 'leaf'), (-4, 1, 'gold')):
                    if math.hypot(x + .5 - (cx + dx), y + .5 - (cy + dy)) < 1.4: c = R[m][4]
                if abs((x - cx) - (y - cy) * -1.2 - 6) < .8 and cy - 8 < y < cy + 2 and x > cx + 2: c = WD[5]
            put(px, W, H_, x, y, c)
    # 걸개(진홍, 문장 없음)
    for bx in (3 * 16 + 4, 5 * 16 + 4):
        for y in range(tall + 2, tall + 22):
            for x in range(bx, bx + 8):
                dd = abs(x + .5 - (bx + 4))
                if y > tall + 18 and (y - (tall + 18)) > (4 - dd) * 1.2 - .5: continue
                k = 5 if x == bx + 1 else (4 if x < bx + 4 else 3)
                c = R['red'][k] if x not in (bx, bx + 7) else GOLD[4]
                if y == tall + 2: c = GOLD[5]
                put(px, W, H_, x, y, c)
    pad = 16
    im = new(W, pad + Rh + H_)
    rf = roof(W, Rh, True); rp = rf.load()
    # 유리 채광 지붕(마룻대를 따라 3칸): 쇠 살 + 하늘빛 유리
    for y in range(4, 18):
        for x in range(3 * 16, 6 * 16):
            if rp[x, y][3] == 0: continue
            if (x - 48) % 8 == 0 or y in (4, 17): c = ST[2] if y > 4 else ST[5]
            else: c = R['sky'][4] if y < 9 else R['sky'][3]
            if (x - 48) % 8 == 1 and y < 10: c = R['sky'][6]
            put(rp, W, Rh, x, y, c)
    im.alpha_composite(rf, (0, pad)); im.alpha_composite(f, (0, pad + Rh))
    im = ph2.volume(im, pad + Rh)
    ch = [chimney(im, 16, pad - 12 + int(Rh * .25))]
    return dict(im=pz.fin(im), door=4, chim=ch, above=pad)


# ------------------------------------------------------------------ 거리 집(예술가 집·화방·카페)
def awning(wc, cols=('wine', 'cream')):
    """줄무늬 차양(roman.awning 과 같은 기하, 색만 포도주·크림)."""
    W = wc * 16; H = 14; o = new(W, H); px = o.load()
    a, b = R[cols[0]], R[cols[1]]
    for y in range(H):
        for x in range(W):
            band = (x // 6) % 2 == 0; Rr = a if band else b
            if y < 2: c = Rr[6] if y == 0 else Rr[5]
            elif y < 10: c = Rr[5] if y < 5 else Rr[4]
            else:
                if (x % 6) > 4 - abs(y - 12): continue
                c = Rr[3]
            if x < 1: c = mul(c, 1.1)
            put(px, W, H, x, y, c)
    return pz.fin(o)


def townhouse(wc, storeys, door_at, seed=0, kind='house', shutter='wine'):
    """예술 거리 집: kind = house(덧문·꽃 상자) · atelier(맨 위층 큰 북향 창 — 화가 작업실) · shop(화방: 차양 + 진열창 + 금 액자 걸이 간판) · cafe(차양 + 잔 간판)."""
    import random
    r = random.Random(seed)
    lit = {(s, k) for s in range(storeys) for k in range(wc) if r.random() < .12}
    skip = set()
    if kind in ('shop', 'cafe'): skip |= {(storeys - 1, k) for k in range(wc) if k != door_at}
    if kind == 'atelier': skip |= {(0, k) for k in range(wc)}
    h = house(wc, storeys, door_at, Rh=36 + 4 * (wc >= 5), chim=wc >= 4, arch_storey=(0 if storeys >= 2 and kind == 'house' and r.random() < .5 else None),
              shutter=shutter, skip=skip, lit=lit, seed=seed)
    im = h['im'].copy(); px = im.load(); W, H = im.size; base = H - 4; fy = h['roof']
    if kind == 'atelier':                                                            # 북향 큰 창(위층 전체, 쇠 살)
        y0 = fy + 6; y1 = fy + 26
        for y in range(y0, y1):
            for x in range(6, W - 6):
                c = GL[1] if y < (y0 + y1) // 2 else GL[2]
                if (x - 6) % 7 == 0 or y in (y0, y1 - 1, (y0 + y1) // 2): c = ST[2]
                if (x - 7) % 7 == 0 and y < y0 + 4: c = GL[3]
                put(px, W, H, x, y, c)
        for x in range(4, W - 4): put(px, W, H, x, y1, CRM[5]); put(px, W, H, x, y1 + 1, CRM[3])
    if kind in ('shop', 'cafe'):
        ys = base - 26
        for k in range(wc):
            if k == door_at: continue
            x0 = k * 16 + 2; x1 = k * 16 + 14
            for y in range(ys, base - 3):
                for x in range(x0, x1):
                    c = GL[1] if y < ys + 9 else GL[2]
                    if x in (x0, x1 - 1) or y == ys: c = WD[4] if x < x1 - 1 else WD[2]
                    put(px, W, H, x, y, c)
            if kind == 'shop':                                                       # 진열창 속 금 액자 그림
                framed(px, W, H, x0 + 2, ys + 4, 8, 8, (k + seed) % 4)
            else:                                                                    # 카페 창: 따뜻한 불빛과 잔
                for y in range(ys + 2, ys + 8):
                    for x in range(x0 + 1, x1 - 1): put(px, W, H, x, y, GOLD[4] if y < ys + 5 else GOLD[3])
            for x in range(x0 - 1, x1 + 1): put(px, W, H, x, base - 3, CRM[5]); put(px, W, H, x, base - 2, CRM[3])
        aw = awning(wc)
        im.alpha_composite(aw, (0, ys - 12))
        px = im.load()
    if kind == 'house':                                                             # 꽃 상자(2층 창 아래)
        for k in range(wc):
            if (k + seed) % 2 or storeys < 2: continue
            x0 = k * 16 + 3; y = fy + 32 - 8
            for x in range(x0, x0 + 10):
                put(px, W, H, x, y, WD[4]); put(px, W, H, x, y + 1, WD[2])
                put(px, W, H, x, y - 1, (R['red'][4] if (x + k) % 3 == 0 else (R['pink'][5] if (x + k) % 3 == 1 else LF[4])))
                if x % 2: put(px, W, H, x, y - 2, LF[3])
    sign = None
    if kind == 'shop': sign = sign_frame()
    if kind == 'cafe': sign = sign_cup()
    if sign is not None:
        sx = (door_at + 1) * 16 + 1
        if sx + 18 > W: sx = door_at * 16 - 19
        im.alpha_composite(sign, (max(0, sx), base - 44))
    return dict(im=im, door=door_at, chim=h['chim'], above=h['above'])


def sign_bracket(draw_board):
    c = C(20, 20, 941)
    for x in range(0, 19): c.tone(x, 1, 'iron', 4 if x < 10 else 3)
    c.line(1, 6, 7, 2, 'iron', 3)
    c.new(); c.box(4, 4, 14, 1, 13, 'gold', front=.6)
    for y in range(5, 18): c.tone(4, y, 'gold', 5); c.tone(17, y, 'gold', 2)
    for x in range(4, 18): c.tone(x, 4, 'gold', 6); c.tone(x, 17, 'gold', 2)
    c.new(); draw_board(c)
    return pz.fin(c)


def sign_frame():
    """화방 간판: 쇠 팔에 매단 금 액자, 속에 산 풍경(글자 없음)."""
    def d(c):
        for y in range(6, 16):
            for x in range(6, 16):
                v = (y - 6) / 9; u = (x - 6) / 9
                if v < .45: c.tone(x, y, 'sky', 5)
                elif v < .45 + .3 * (1 - abs(u - .5) * 2): c.tone(x, y, 'leaf', 4)
                else: c.tone(x, y, 'leaf', 3)
        c.tone(12, 8, 'gold', 6)
    return sign_bracket(d)


def sign_cup():
    """카페 간판: 금 판 속 김 나는 잔(roman.SIGN_CAFE 와 같은 그림을 포도주 판 위에)."""
    def d(c):
        for y in range(6, 16):
            for x in range(6, 16): c.tone(x, y, 'wine', 3)
        rows, key = roman.SIGN_CAFE; c.lit(rows, 8, 7, key)
    return sign_bracket(d)


# ------------------------------------------------------------------ 저택 담·문
def gate_pier():
    """귀족 문기둥: gate_pier6(회벽 + 모서리 돌 + 기와 갓)을 짙은 붉은 기와로, 위는 금 공 꼭지."""
    p = v6pieces.gate_pier6(urn=False); p = nob_roof(p)
    o = new(16, 60); o.alpha_composite(p, (0, 8)); px = o.load()
    for j, hw in enumerate((2, 3, 4, 4, 4, 3, 2, 1, 2, 3)):
        y = 13 + j
        for x in range(8 - hw, 8 + hw):
            put(px, 16, 60, x, y, GOLD[6] if (x < 7 and j < 5) else (GOLD[5] if x < 8 else GOLD[3]))
    return pz.fin(o)


def estate_wall_noble(maskgrid):
    return nob_roof(v6pieces.estate_wall(maskgrid))
