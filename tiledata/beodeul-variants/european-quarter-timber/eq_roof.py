# 목골 구시가 지붕 — 버들항 칩셋 지붕 칸 쌍(pj.pairtex 빛 받는 뒤 경사·그늘 앞 경사, pj.nstex 남북 용마루 경사)을 그대로 쓰고
# 붉은 기와를 갈색 기와 램프 TILE 로 옮긴다(밝기 순위 유지 → 칩셋 기와 결 그대로). 결정적.
from eq_base import *
import eq_wall as WL

_RT = {}
def rtex(kind, W, Hh, mat='tile'):
    """kind: front back nsl nsr. mat: tile(갈색 기와) / slate(청회 슬레이트)."""
    k = (kind, W, Hh, mat)
    if k not in _RT:
        if kind in ('front', 'back'): im = pj.pairtex('tim', kind, W, Hh)
        else: im = pj.nstex('tim', 'l' if kind == 'nsl' else 'r', W, Hh)
        recolor(im, lambda r, g, b: True, TILE if mat == 'tile' else SLATE)
        _RT[k] = im
    return _RT[k]

def gable_front(W, run, G, mat='tile', peak=True, lattice='x', seed=1, attic='o', oriel_cut=None, gmat='timber'):
    """남북 용마루 박공집 지붕(위에서 본 두 경사 + 앞 삼각 박공벽): 높이 run+G.
    위 run 화소 = 지붕 윗면(왼쪽 빛 경사·오른쪽 그늘 경사·용마루 마루), peak=True 면 맨 위에 먼 박공 끝 뾰족(버들항 FF 관용).
    아래 G 화소 = 앞 박공 삼각(목골 회벽: 가운데 기둥·빗대·다락 창, 박공널 2화소)."""
    Hh = run + G; im, px = mk(W, Hh); gx = W / 2
    lit = rtex('nsl', W, Hh, mat).load(); dk = rtex('nsr', W, Hh, mat).load()
    pk = G if peak else 0
    for y in range(Hh):
        for x in range(W):
            d = x + 0.5 - gx
            if y < pk and abs(d) > gx * (y + 1) / pk: continue
            c = (lit if d < 0 else dk)[x, y]
            k = 1.0 if d < 0 else 0.9
            if abs(d) < 1 and y < run: c = mul(c, 1.3) if d < 0 else mul(c, 0.55); k = 1.0
            px[x, y] = mul(c, k) + (255,)
    # 박공 삼각 벽
    gt = WL._tex('plaster' if gmat == 'timber' else 'stone', W, G); gpx = gt.load()
    for y in range(G):
        half = (y + 1) / G * gx
        for x in range(W):
            dd = abs(x + 0.5 - gx)
            if dd <= half - 2: px[x, run + y] = gpx[x, y]
            elif dd <= half: px[x, run + y] = (BEAM[5] if x < gx else BEAM[2]) + (255,)
    # 박공 목골: 가운데 기둥, 대들보, 빗대
    if gmat == 'stone':
        if attic == 'rose' and G >= 22:
            cy = run + G * 0.6; cx = gx; rr = min(7.5, G * 0.3)
            for y in range(int(cy - rr - 2), int(cy + rr + 2)):
                for x in range(int(cx - rr - 2), int(cx + rr + 2)):
                    d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                    if d <= rr - 1.5:
                        a = math.atan2(y + 0.5 - cy, x + 0.5 - cx); spoke = abs(math.sin(a * 4)) < 0.28 or d < 1.6
                        put(px, W, Hh, x, y, STN[4] if spoke else (FLWR['red'][3] if (d < rr * 0.55) else GLASS[3 if y > cy else 2]))
                    elif d <= rr + 0.6: put(px, W, Hh, x, y, STN[6] if y < cy else STN[3])
        elif attic == 'o' and G >= 18:
            WL.window(px, W, Hh, int(gx) - 2, run + int(G * 0.4), 5, 8, frame=STN, arch=True, seed=seed)
        for y in range(run, Hh):
            half = (y - run + 1) / G * gx
            for x in range(W):
                if abs(abs(x + 0.5 - gx) - (half - 3)) < 1: put(px, W, Hh, x, y, STN[5] if x < gx else STN[2])
        return im
    yb = Hh - 3
    for x in range(W):
        if abs(x + 0.5 - gx) <= (yb - run + 1) / G * gx - 2: put(px, W, Hh, x, yb, BEAM[4]); put(px, W, Hh, x, yb + 1, BEAM[2])
    for y in range(run + 4, Hh - 2): WL.post(px, W, Hh, int(gx) - 1, y, y + 1)
    if lattice and G >= 20:
        ym = run + int(G * 0.55)
        for x in range(W):
            if abs(x + 0.5 - gx) <= (ym - run + 1) / G * gx - 2: put(px, W, Hh, x, ym, BEAM[4]); put(px, W, Hh, x, ym + 1, BEAM[2])
        for s in (-1, 1):
            xa = gx + s * ((ym - run) / G * gx - 3); WL.brace(px, W, Hh, int(xa), ym + 2, int(gx + s * 4), Hh - 4)
            if W >= 80:
                xb = gx + s * ((Hh - 4 - run) / G * gx - 6); WL.brace(px, W, Hh, int(gx + s * 10), ym + 2, int(xb), Hh - 4)
    if attic == 'o' and G >= 18:
        ay = run + int(G * 0.28)
        WL.window(px, W, Hh, int(gx) - 3, ay, 6, 6, seed=seed)
    elif attic == 'w' and G >= 26:
        ay = run + int(G * 0.62) - 1
        for s in (-1, 1): WL.window(px, W, Hh, int(gx + s * 9) - 3, ay, 6, 8, seed=seed + s)
    # 박공널(바깥 2화소) — 지붕 윗면 쪽
    for y in range(Hh):
        if y < pk:
            h = gx * (y + 1) / pk; xl = int(gx - h); xr = int(gx + h) - 1
            put(px, W, Hh, xl, y, WD[4]); put(px, W, Hh, xl + 1, y, WD[3]); put(px, W, Hh, xr, y, WD[1]); put(px, W, Hh, xr - 1, y, WD[2])
        elif y < run:
            put(px, W, Hh, 0, y, WD[4]); put(px, W, Hh, 1, y, WD[3]); put(px, W, Hh, W - 2, y, WD[2]); put(px, W, Hh, W - 1, y, WD[1])
    return im

def eave_front(W, Rh, ends='LR', mat='tile'):
    """동서 용마루 처마집 지붕(앞 경사가 보이는 가파른 지붕, 끝은 hip 또는 박공널) — ph2.steep_hip 의 칩셋 기와를 갈색으로."""
    st = 'tim'
    im = ph2.steep_hip(st, W, Rh, ends=ends if ends else False)
    recolor(im, lambda r, g, b: not (abs(r - g) < 18 and abs(g - b) < 18 and r < 90) and r > b + 6, TILE if mat == 'tile' else SLATE)
    return im

def dormer(mat='tile'):
    """앞 경사 위 다락창(작은 남북 용마루 + 박공 + 창) — pv.dormer 를 갈색 기와·회벽·목골로."""
    d = pv.dormer('tim').copy(); px = d.load(); W, Hh = d.size
    for y in range(Hh):
        for x in range(W):
            p = px[x, y]
            if p[3] < 10: continue
            r, g, b = p[:3]
            if (r, g, b) in ((28, 40, 60), (48, 86, 98)): px[x, y] = GLASS[2 if (r, g, b) == (28, 40, 60) else 4] + (255,)
            elif r > 150 and g > 130 and b > 110: px[x, y] = ramp_fit(p, PLAS) + (255,)
            elif r > g + 20 and r > b + 20 and y < 12: px[x, y] = ramp_fit(p, TILE if mat == 'tile' else SLATE) + (255,)
            else: px[x, y] = ramp_fit(p, BEAM) + (255,)
    return d

def chimney(h=22, w=8, seed=1):
    """벽돌 굴뚝(윗면 갓돌 + 연통 구멍), 오른쪽 그늘."""
    im, px = mk(w + 4, h + 4); W, Hh = im.size
    WL.brick_fill(px, W, Hh, 2, 4, 2 + w, 4 + h, seed)
    for y in range(4, 4 + h):
        put(px, W, Hh, 2 + w - 1, y, mul(get(px, W, Hh, 2 + w - 1, y), 0.7)); put(px, W, Hh, 2 + w - 2, y, mul(get(px, W, Hh, 2 + w - 2, y), 0.85))
    for x in range(0, w + 4):
        put(px, W, Hh, x, 1, STN[6] if x < (w + 4) // 2 else STN[5]); put(px, W, Hh, x, 2, STN[4]); put(px, W, Hh, x, 3, STN[2])
    for x in range(3, w + 1): put(px, W, Hh, x, 0, STN[5])
    for x in range(4, w): put(px, W, Hh, x, 1, DARK[1]); put(px, W, Hh, x, 0, DARK[2])
    return im

def cone(W, Hh, mat='slate', base_ry=3):
    """둥근/팔각 내닫이창·탑 꼭대기 원뿔 지붕: 빛 왼쪽, 처마 타원 테, 꼭지 쇠 장식."""
    im, px = mk(W, Hh); ax = W / 2; tex = rtex('front', W, Hh, mat).load(); Rm = SLATE if mat == 'slate' else TILE
    yb = Hh - 1 - base_ry
    for y in range(2, Hh):
        for x in range(W):
            if y <= yb: half = ax * (y - 2) / max(1, yb - 2)
            else: half = ax * math.sqrt(max(0, 1 - ((y - yb) / (base_ry + 0.5)) ** 2))
            d = x + 0.5 - ax
            if abs(d) > half: continue
            c = tex[x, y]; f = d / max(1, half)
            k = 1.15 - 0.55 * (f + 1) / 2
            if y > yb - 1: c = WD[4] if d < 0 else WD[2]; k = 1
            elif abs(abs(d) - half) < 1: c = Rm[1] if d > 0 else Rm[5]; k = 1
            px[x, y] = mul(c, k) + (255,)
    for y in range(0, 4): put(px, W, Hh, int(ax), y, IRON[4] if y else IRON[5])
    put(px, W, Hh, int(ax) - 1, 1, IRON[3]); put(px, W, Hh, int(ax) + 1, 1, IRON[2])
    return im

def oriel(w=20, storeys=1, mat='slate', seed=1, cone_h=22):
    """내닫이 탑(모퉁이에 매달린 팔각 창 탑): 세 면(왼 빛·앞·오른 그늘) 목골 회벽에 창, 밑은 까치발 받침이 좁아지고, 위는 원뿔 지붕."""
    body_h = storeys * 32 - 6; Hh = cone_h + body_h + 10; im, px = mk(w, Hh); W = w
    by0 = cone_h - 2; by1 = by0 + body_h
    pl = WL._tex('plaster', w, body_h).load()
    sx = 4                                                                 # 옆면 폭
    for y in range(by0, by1):
        for x in range(w):
            c = pl[x, y - by0]
            if x < sx: c = mul(c, 1.04)
            elif x >= w - sx: c = mul(c, 0.72)
            px[x, y] = c[:3] + (255,)
    for y in range(by0, by1):
        for xx in (0, sx, w - sx - 1, w - 1):
            put(px, W, Hh, xx, y, BEAM[4] if xx < w // 2 else BEAM[2])
        put(px, W, Hh, sx + 1, y, BEAM[3]); put(px, W, Hh, w - sx - 2, y, BEAM[1])
    for s in range(storeys):
        ty = by0 + s * 32
        for x in range(w): put(px, W, Hh, x, ty, BEAM[4]); put(px, W, Hh, x, ty + 1, BEAM[2])
        WL.window(px, W, Hh, sx + 3, ty + 4, w - 2 * sx - 6, 11, seed=seed)
        for y in range(ty + 5, ty + 14): put(px, W, Hh, 1, y, GLASS[3]); put(px, W, Hh, 2, y, GLASS[2]); put(px, W, Hh, w - 3, y, GLASS[1])
    for x in range(w): put(px, W, Hh, x, by1 - 1, BEAM[3]); put(px, W, Hh, x, by1, BEAM[1])
    for j in range(10):                                                    # 까치발 받침(아래로 좁아짐)
        y = by1 + 1 + j; half = (w / 2 - 1) * (1 - j / 10.5)
        for x in range(w):
            d = x + 0.5 - w / 2
            if abs(d) <= half: put(px, W, Hh, x, y, BEAM[5 if d < -half + 2 else (2 if d > half - 2 else 3)] if j % 3 else BEAM[4])
    c = cone(w + 4, cone_h + 2, mat)
    im2 = Image.new('RGBA', (w + 4, Hh + 2)); im2.alpha_composite(im, (2, 2)); im2.alpha_composite(c, (0, 0))
    return im2
