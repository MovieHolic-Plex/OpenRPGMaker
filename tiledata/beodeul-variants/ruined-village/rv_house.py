# 폐허 마을 폐가 — 버들항 집과 같은 결(칩셋 기와 짝 질감 pj.pairtex/nstex, 버들항 벽 칸 pv.walls, ph2 가파른 지붕 형태)로
# 새로 지은 폐가. 기존 집 그림을 잘라 구멍을 내는 것이 아니라, 지붕 꺼짐(용마루가 휘어 내려앉음)·서까래가 드러난 구멍·
# 깨진 창(어두운 속·유리 조각·처진 덧문)·떨어진 문·회벽이 떨어져 드러난 외(욋가지)·그을음·덩굴을 처음부터 그린다.
from rv_base import *

# ================================================================ 지붕: 꺼짐 + 구멍
def _sag(base, sags):
    """용마루가 내려앉는다: 열 x 의 처짐 s(x) 가 위쪽(용마루)에서 가장 크고 처마(아래 끝)에서 0."""
    W, Hh = base.size; src = base.load(); o = Image.new('RGBA', (W, Hh)); px = o.load()
    for x in range(W):
        s = 0.0
        for (cx, hw, amp) in sags:
            t = (x + 0.5 - cx) / hw
            if abs(t) < 1: s += amp * 0.5 * (1 + math.cos(math.pi * t))
        for y in range(Hh):
            yy = y - s * (1 - y / Hh) ** 0.8
            if yy < 0: continue
            px[x, y] = src[x, min(Hh - 1, int(yy))]
    return o, src

def _blob(W, Hh, ells, seed, jag=1.6):
    """구멍 마스크: 타원 합 + 가장자리 잡음(깨진 기와 선)."""
    m = np.zeros((Hh, W), bool)
    for y in range(Hh):
        for x in range(W):
            for (cx, cy, rx, ry) in ells:
                n = (vnoise(x, y, 2.2, seed) - 0.5) * jag + (vnoise(x, y, 5.0, seed + 3) - 0.5) * jag
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1 + n * 0.35: m[y, x] = True; break
    return m

def _hole_paint(px, W, Hh, mask, seed, rafters='v', step=5, burnt=False, broken=(), purlin=True, floor_light=True, wall_st='tim'):
    """구멍 속을 3/4 로 그린다: 위쪽 = 맞은편 뒷벽 안쪽 면(그늘진 회벽), 아래 = 집 안 바닥(무너진 기와·판자 더미, 들어온 빛).
    그 위에 서까래(2화소, 왼쪽 밝음, 5화소 간격)가 경사 따라 내려가고, 몇 개는 부러져 끝이 쪼개졌거나 비스듬히 처졌다.
    구멍 테 = 같은 기와의 깨진 단면(위·왼은 밝게, 아래·오른은 어둡게) 1화소 + 늘어진 기와 이빨."""
    ys, xs = np.nonzero(mask)
    if len(ys) == 0: return
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    orig = {(x, y): px[x, y] for y in range(max(0, y0 - 1), min(Hh, y1 + 2)) for x in range(max(0, x0 - 1), min(W, x1 + 2))}
    tim = CH if burnt else WD
    wall = pj.tex(wall_st + '.wall', 64, 64).load()
    for x in range(x0, x1 + 1):
        col = [y for y in range(y0, y1 + 1) if mask[y, x]]
        if not col: continue
        ta, tb = col[0], col[-1]; hh = tb - ta + 1
        wall_end = ta + max(2, int(hh * 0.38))
        for y in col:
            if y < wall_end:                                   # 맞은편 뒷벽 안쪽(그늘)
                c = mul(wall[x % 64, (y * 2) % 64], 0.42 if not burnt else 0.3)
                if y - ta < 2: c = DK[1]                       # 남은 지붕이 드리운 그늘
                if burnt and H(x // 2, y, seed + 8) > 0.6: c = CH[1]
            elif y == wall_end:
                c = DK[1]                                      # 벽과 바닥이 만나는 그늘 선
            else:                                              # 바닥: 아래(처마 쪽)로 갈수록 들어온 빛
                f = (y - wall_end) / max(1, tb - wall_end)
                c = mix(DK[2], (ROT if not burnt else ASH)[3], 0.15 + 0.5 * f)
                h_ = H(x // 2, y // 2, seed + 1)
                if h_ > 0.80: c = mix(CLAY[3], DK[2], 0.25) if not burnt else ASH[4]   # 떨어진 기와 조각
                elif h_ < 0.10: c = (ROT if not burnt else CH)[4]                    # 판자 부스러기
                if H(x, y, seed + 3) > 0.92: c = mul(c, 1.25)
            put(px, W, Hh, x, y, c)
    # 서까래
    if rafters == 'v':
        xs_r = list(range(x0 + 1 + int(H(seed, 9) * step), x1, step))
        for k, rx in enumerate(xs_r):
            if H(k, seed, 77) < 0.18: continue                 # 빠져 나간 서까래
            col = [y for y in range(y0, y1 + 1) if mask[y, rx]]
            if not col: continue
            ta, tb = col[0], col[-1]
            stop = tb + 1
            if k in broken or H(k, seed, 78) < 0.25: stop = ta + int((tb - ta) * (0.4 + 0.35 * H(k, seed)))
            slant = 0.12 if H(k, seed, 79) > 0.5 else -0.08
            for y in range(ta, stop):
                xx = int(round(rx + (y - ta) * slant))
                for i, tt in ((0, 5), (1, 3)):
                    if 0 <= xx + i < W and mask[y, xx + i]:
                        c = tim[tt] if H(xx + i, y, seed + 4) < 0.9 else tim[tt - 1]
                        put(px, W, Hh, xx + i, y, c)
                if 0 <= xx + 2 < W and mask[y, xx + 2] and y > ta + 1: put(px, W, Hh, xx + 2, y, mul(get(px, W, Hh, xx + 2, y), 0.6))  # 서까래 그림자
            if stop <= tb:
                xx = int(round(rx + (stop - ta) * slant))
                put(px, W, Hh, xx, stop, tim[6]); put(px, W, Hh, xx + 1, stop, tim[4]); put(px, W, Hh, xx, stop + 1, tim[3])
        # 비스듬히 떨어진 서까래 하나(바닥에 걸쳤다)
        if x1 - x0 > 12:
            ax, ay = x0 + 2, y1 - 2; bx, by = x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.45
            n = int(math.hypot(bx - ax, by - ay))
            for i in range(n):
                x = int(round(ax + (bx - ax) * i / n)); y = int(round(ay + (by - ay) * i / n))
                if 0 <= x < W and 0 <= y < Hh and mask[y, x]:
                    put(px, W, Hh, x, y, tim[5]); 
                    if y + 1 < Hh and mask[y + 1, x]: put(px, W, Hh, x, y + 1, tim[2])
        if purlin:                                             # 부러진 도리: 왼쪽 반만
            py = y0 + int((y1 - y0) * 0.3)
            for x in range(x0, x0 + int((x1 - x0) * 0.55)):
                if mask[py, x]: put(px, W, Hh, x, py, tim[5]); put(px, W, Hh, x, py + 1, tim[3])
    else:   # 남북 용마루(박공 정면) 경사: 서까래가 가로
        for k, ry in enumerate(range(y0 + 1 + int(H(seed, 9) * step), y1, step)):
            if H(k, seed, 77) < 0.18: continue
            stop = x1 + 1 if not (k in broken or H(k, seed, 78) < 0.3) else x0 + int((x1 - x0) * (0.4 + 0.4 * H(k, seed)))
            for x in range(x0, stop):
                for j, tt in ((0, 5), (1, 3)):
                    if 0 <= ry + j < Hh and mask[ry + j, x]: put(px, W, Hh, x, ry + j, tim[tt])
    # 깨진 기와 단면 테
    for (x, y), q in orig.items():
        if not (0 <= x < W and 0 <= y < Hh) or mask[y, x] or q[3] < 200: continue
        nb = [(dx, dy) for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < Hh and mask[y + dy, x + dx]]
        if not nb: continue
        if (0, 1) in nb or (1, 0) in nb: c = mul(q, 1.28) if not burnt else CH[3]
        else: c = mul(q, 0.5) if not burnt else CH[1]
        put(px, W, Hh, x, y, c)
    # 늘어진 기와 이빨(구멍 윗가장자리에서 1~3화소)
    for x in range(x0, x1 + 1):
        col = [y for y in range(y0, y1 + 1) if mask[y, x]]
        if not col or H(x // 2, seed, 21) < 0.6: continue
        yb = col[0]; q = orig.get((x, yb - 1), (120, 60, 40, 255))
        for j in range(1 + int(H(x // 2, seed, 22) * 3)):
            if yb + j <= y1 and mask[yb + j, x]: put(px, W, Hh, x, yb + j, mul(q, 1.1 if j == 0 else 0.8))

def roof_ruin(st, W, Rh, sags=(), holes=(), seed=1, ends=True, burnt=False, broken=(), weeds=()):
    base = ph2.steep_hip(st, W, Rh, ends=ends)
    if st == 'sto': base = roman.terracotta(base, seed)
    o, _ = _sag(base, sags) if sags else (base.copy(), None)
    px = o.load()
    if holes:
        mask = _blob(W, Rh, holes, seed)
        mask &= (np.array(o)[:, :, 3] > 0)
        # 처마 끝 두 줄은 남긴다(벽 위 처마선이 끊기지 않게)
        mask[Rh - 3:, :] = False
        _hole_paint(px, W, Rh, mask, seed, 'v', 5, burnt, broken, wall_st=st)
    # 이끼·잡초: 처마 쪽 기와 줄에 군데군데
    for (x, y) in weeds: weeds_on(px, W, Rh, [(x, y)], seed + x, 0.35)
    for y in range(Rh):
        for x in range(W):
            p = px[x, y]
            if p[3] and H(x // 3, y // 2, seed + 40) > 0.93 and y > Rh * 0.45:
                px[x, y] = mix(p[:3], MOSS[3 if lum(p) < 120 else 4], 0.55) + (255,)
    return o

# ================================================================ 벽: 깨진 창 · 떨어진 문 · 떨어진 회벽
def broken_window(px, W, Hh, x0, y0, w=9, h=11, seed=1, shutter=None, boarded=False, burnt=False):
    """창틀(나무) + 어두운 집 속 + 남은 유리 조각(모서리 삼각) + 부러진 창살 + 처진 덧문/판자 덧댐."""
    fr = CH if burnt else WD
    for y in range(h):
        for x in range(w):
            X, Y = x0 + x, y0 + y
            if x in (0, w - 1) or y in (0, h - 1):
                c = fr[5] if (x == 0 or y == 0) else fr[2]
                if H(X, Y, seed) > 0.85: c = fr[3]
            else:
                c = DK[1] if y < 3 else DK[2]
                if H(X, Y, seed + 1) > 0.93: c = DK[3]
            put(px, W, Hh, X, Y, c)
    # 남은 유리 조각: 왼쪽 위 / 오른쪽 아래 삼각
    for y in range(1, 3):
        for x in range(1, 4 - y):
            put(px, W, Hh, x0 + x, y0 + y, GLASS[2] if (x + y) % 3 else GLASS[3])
    for y in range(h - 3, h - 1):
        for x in range(w - 1 - (y - (h - 4)), w - 1):
            put(px, W, Hh, x0 + x, y0 + y, GLASS[1] if (x + y) % 2 else GLASS[2])
    # 부러진 창살: 가로 살은 왼쪽 반만, 세로 살은 위 2/3만
    mx = x0 + w // 2; my = y0 + h // 2
    for y in range(y0 + 1, y0 + int(h * 0.62)): put(px, W, Hh, mx, y, fr[4])
    put(px, W, Hh, mx + 1, y0 + int(h * 0.62), fr[5])
    for x in range(x0 + 1, mx): put(px, W, Hh, x, my, fr[4])
    put(px, W, Hh, mx, my + 1, fr[3])
    # 창턱(이 빠짐)
    for x in range(x0 - 1, x0 + w + 1):
        if H(x, seed, 5) > 0.2: put(px, W, Hh, x, y0 + h, fr[5]); put(px, W, Hh, x, y0 + h + 1, fr[2])
    if boarded:                                           # 판자 두 장을 엇갈려 못 박음
        for (ya, yb) in ((y0 + 2, y0 + h - 4), (y0 + h - 3, y0 + 3)):
            for k in range(w + 3):
                x = x0 - 1 + k; y = int(round(ya + (yb - ya) * k / (w + 2)))
                put(px, W, Hh, x, y, ROT[5]); put(px, W, Hh, x, y + 1, ROT[4]); put(px, W, Hh, x, y + 2, ROT[2])
            put(px, W, Hh, x0, ya + 1, ST[3]); put(px, W, Hh, x0 + w - 1, yb + 1, ST[3])
    if shutter == 'L':                                    # 왼쪽 덧문: 경첩 하나만 남아 아래로 기울었다(널 세 줄, 테두리)
        for y in range(h + 1):
            for i in range(4):
                x = x0 - 5 + i - y // 5; yy = y0 + 1 + y
                t = (2, 5, 4, 2)[i]
                if y in (0, h): t = 2
                elif y % 4 == 2 and 0 < i < 3: t = 3
                put(px, W, Hh, x, yy, (ROT if not burnt else CH)[t])
    elif shutter == 'R':
        for y in range(h):
            for i in range(3):
                put(px, W, Hh, x0 + w + i, y0 + y, (ROT[4], ROT[3], ROT[2])[i] if (y // 3) % 2 or i else ROT[5])

def doorway(px, W, Hh, x0, y0, w=10, h=22, seed=1, kind='gone', burnt=False):
    """문간: kind='gone' 문짝이 떨어져 어둠만, 'hang' 경첩 하나로 기운 문짝, 'boarded' 판자로 막은 문."""
    fr = CH if burnt else WD
    for y in range(h):
        for x in range(w):
            X, Y = x0 + x, y0 + y
            if x == 0 or y == 0: c = fr[5]
            elif x == w - 1: c = fr[2]
            else:
                c = DK[1] if y < h * 0.4 else DK[2]
                if y >= h - 3: c = mix(DK[3], ROT[2], 0.4)                       # 문턱 안 먼지
            put(px, W, Hh, X, Y, c)
    if kind == 'hang':                                     # 왼 경첩에 매달린 문짝: 아래가 오른쪽으로 쏠림
        for y in range(2, h - 1):
            sh = int((y - 2) * 0.28)
            for i in range(w - 3):
                x = x0 + 1 + i + sh
                if x >= x0 + w + 2: continue
                c = ROT[4] if i % 3 else ROT[2]
                if i == 0: c = ROT[5]
                if y in (6, h - 6): c = ST[2]
                put(px, W, Hh, x, y0 + y, c if not burnt else char_px(c, 0.7, seed, x, y))
    elif kind == 'boarded':
        for k, yy in enumerate((4, 9, 15)):
            for x in range(x0 - 1, x0 + w + 1):
                y = y0 + yy + (1 if (x - x0) > w // 2 and k == 1 else 0)
                put(px, W, Hh, x, y, ROT[5]); put(px, W, Hh, x, y + 1, ROT[4]); put(px, W, Hh, x, y + 2, ROT[2])
            put(px, W, Hh, x0, y0 + yy + 1, ST[3]); put(px, W, Hh, x0 + w - 1, y0 + yy + 1, ST[3])

def plaster_loss(px, W, Hh, cx, cy, rx, ry, seed):
    """회벽이 떨어져 드러난 욋가지(가로 나뭇가지 줄) 자국: 가장자리는 밝은 회벽 단면, 속은 가로 외."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (vnoise(x, y, 2.0, seed) - 0.5) * 0.7
            p = get(px, W, Hh, x, y)
            if p[3] < 200 or lum(p) < 150: continue          # 나무 기둥 위는 건드리지 않음(밝은 회벽만)
            if d < 0.75:
                c = WD[3] if y % 3 == 0 else (WD[2] if y % 3 == 2 else ROT[3])
                if H(x // 4, y // 3, seed) > 0.8: c = DK[2]
                put(px, W, Hh, x, y, c)
            elif d < 1.0:
                put(px, W, Hh, x, y, mix(p[:3], (255, 246, 226), 0.35) if y < cy else mix(p[:3], (120, 98, 80), 0.45))

def crack(px, W, Hh, x, y, n, seed, dx=1):
    for i in range(n):
        p = get(px, W, Hh, x, y)
        if p[3] > 200: put(px, W, Hh, x, y, mul(p, 0.55))
        y += 1; x += dx if H(i, seed) > 0.55 else 0

def stain(px, W, Hh, x0, x1, y0, y1, seed, k=0.12):
    """빗물 얼룩: 세로로 흘러내린 거무스름한 줄."""
    for x in range(x0, x1):
        if H(x, seed) > 0.22: continue
        ln = int((y1 - y0) * (0.3 + 0.7 * H(x, seed, 1)))
        for y in range(y0, y0 + ln):
            p = get(px, W, Hh, x, y)
            if p[3] > 200: put(px, W, Hh, x, y, mul(p, 1 - k * (1 - (y - y0) / max(1, ln))))

def chimney_broken(im, x, y, seed=1):
    """무너진 굴뚝: 버들항 굴뚝(윗토막+아랫토막)을 세우고 머리를 들쭉날쭉 부순다 — 깨진 윗선 아래 어두운 연도, 벽돌 단면."""
    L = ph2.L(); c = Image.new('RGBA', (16, 32)); c.alpha_composite(L['tim.chimney.top'], (0, 0)); c.alpha_composite(L['tim.chimney.bot'], (0, 16))
    p = c.load()
    for xx in range(16):
        cut = 5 + int(H(xx // 3, seed) * 6)
        for yy in range(cut): p[xx, yy] = (0, 0, 0, 0)
        if p[xx, cut][3]:
            p[xx, cut] = mul(p[xx, cut], 1.3) + (255,)
            if 5 <= xx <= 10: p[xx, cut + 1] = DK[1] + (255,)      # 연도 속
    im.alpha_composite(c, (x, y))

# ================================================================ 폐가 조립
def _foot(im, seed, dry=0.5):
    """벽 밑동: 잡초·잔해(기와 조각·판자)·땅 그림자. 그림 아래 3화소에 얹는다(칸 밖으로 안 나감)."""
    p = im.load(); W, Hh = im.size
    for x in range(W):
        if p[x, Hh - 1][3] and H(x // 3, seed, 31) > 0.62:
            put(p, W, Hh, x, Hh - 2, CLAY[4] if x % 3 else CLAY[3]); put(p, W, Hh, x, Hh - 1, CLAY[2])
    tufts(p, W, Hh, 0, W, Hh - 1, seed + 3, 0.5, 6, dry)
    tufts(p, W, Hh, 0, W, Hh - 1, seed + 4, 0.35, 3, dry)

def ruin_house(st='tim', wc=6, kinds='lwpdwr', sags=((40, 26, 9),), holes=((40, 22, 13, 9),), seed=1, gs=None,
               windows=None, door='gone', burnt=False, chim=None, plaster=(), ivy=(), weeds=(), webs=(), broken=(1,), soot_k=0.0):
    W = wc * 16; Rh = 44; pad = 16
    roof = roof_ruin(st, W, Rh, sags, holes, seed, burnt=burnt, broken=broken, weeds=weeds)
    body_k = kinds.replace('w', 'p').replace('d', 'p')
    body = pv.walls(gs or st, body_k, 1, gs or st)
    im = Image.new('RGBA', (W, pad + Rh + 32)); im.alpha_composite(roof, (0, pad)); im.alpha_composite(body, (0, pad + Rh))
    im = ph2.volume(im, pad + Rh)
    if chim is not None: chimney_broken(im, chim * 16, pad - 4 + int(Rh * 0.25), seed)
    px = im.load(); Wp, Hp = im.size; wy = pad + Rh
    for (x, y, rx, ry) in plaster: plaster_loss(px, Wp, Hp, x, wy + y, rx, ry, seed + x)
    win = windows or {}
    for i, ch in enumerate(kinds):
        X = i * 16
        if ch == 'w':
            o = win.get(i, {})
            broken_window(px, Wp, Hp, X + 4, wy + 6, 8, 10, seed + i, o.get('shutter'), o.get('boarded', False), burnt)
            if burnt or soot_k: soot(px, Wp, Hp, X + 4, X + 12, wy - 4, wy + 7, seed + i, 0.85 if burnt else soot_k, up=False)
        if ch == 'd':
            doorway(px, Wp, Hp, X + 3, wy + 8, 10, 23, seed + i, door, burnt)
            if burnt or soot_k: soot(px, Wp, Hp, X + 3, X + 13, wy - 2, wy + 9, seed + i, 0.8 if burnt else soot_k, up=False)
    stain(px, Wp, Hp, 0, Wp, wy + 4, wy + 26, seed + 7)
    for (x, n) in ((W // 3 + 3, 9), (W - 20, 7)): crack(px, Wp, Hp, x, wy + 5, n, seed + x)
    for (x, top) in ivy: _ivy_dead(px, Wp, Hp, x, wy + 30, wy - top, seed + x)
    for (x, y, r, cn) in webs: cobweb(px, Wp, Hp, x, y, r, seed + x, cn)
    if burnt:
        for y in range(Hp):
            for x in range(Wp):
                q = px[x, y]
                if q[3] > 200 and y >= wy and H(x // 3, y // 3, seed + 50) > 0.55: px[x, y] = char_px(q, 0.35, seed, x, y) + (255,)
    im = fin(im)
    _foot(im, seed, 0.55)
    return im

def _ivy_dead(px, W, Hh, x, y1, y0, seed):
    """벽을 탄 덩굴: 아래는 초록, 위로 갈수록 시들어 갈색."""
    xx = x
    for y in range(y1, y0, -1):
        i = y1 - y
        if i % 5 == 0: xx = x + int((H(i, 1, seed) - 0.5) * 3)
        f = i / max(1, y1 - y0)
        dead = f > 0.55 and H(i, seed, 2) < 0.7
        dk, md, lt = (ROT[2], HAY[3], HAY[4]) if dead else (LEAF[2], LEAF[3], LEAF[4])
        put(px, W, Hh, xx, y, dk)
        if i % 2 == 1:
            s = 1 if (i // 2) % 2 == 0 else -1
            put(px, W, Hh, xx + s, y, md); put(px, W, Hh, xx + 2 * s, y, lt); put(px, W, Hh, xx + s, y - 1, lt)
            if H(i, 4, seed) < 0.5: put(px, W, Hh, xx + 2 * s, y - 1, md)

# ---------------------------------------------------------------- 박공 정면 폐가
def gable_ruin(st='tim', wc=4, depth=2, seed=3, gs=None, kinds=None, hole_gable=(30, 0.55, 7, 6), hole_roof=((14, 22, 8, 6),),
               door='hang', windows=None, burnt=False, ivy=(), webs=(), soot_k=0.0, lean=0):
    """박공이 앞을 향한 집: 지붕 왼쪽 경사에 구멍(가로 서까래), 박공벽 삼각에 뚫린 구멍(부서진 외·어둠)."""
    W = wc * 16; G = int(W * 0.42) // 2 * 2; roofH = depth * 16 + G
    g = pv.gable_end(st, W, roofH, G, window=False)
    if st == 'sto': g = roman.terracotta(g, seed)
    gp = g.load(); top = roofH - G
    if hole_roof:
        m = _blob(W, roofH, hole_roof, seed)
        m &= (np.array(g)[:, :, 3] > 0)
        for y in range(top, roofH):                     # 박공벽 삼각 안은 지붕 구멍이 아니다
            half = (y - top + 1) / G * (W / 2)
            for x in range(W):
                if abs(x + 0.5 - W / 2) <= half: m[y, x] = False
        _hole_paint(gp, W, roofH, m, seed, 'h', 5, burnt, broken=(1,), purlin=False, wall_st=st)
    if hole_gable:                                       # 박공벽 구멍: 위쪽 꼭짓점 아래, 외 부스러기
        hx_, fy, rx, ry = hole_gable
        cy = top + G * fy
        for y in range(top, roofH):
            half = (y - top + 1) / G * (W / 2) - 3
            for x in range(W):
                if abs(x + 0.5 - W / 2) > half: continue
                d = ((x + 0.5 - hx_) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (vnoise(x, y, 1.8, seed + 7) - 0.5) * 0.8
                if d < 1:
                    c = DK[1] if d < 0.6 else DK[2]
                    if (y % 3 == 1) and H(x // 3, y, seed) > 0.45 and d > 0.25: c = (ROT if not burnt else CH)[3]   # 남은 외
                    put(gp, W, roofH, x, y, c)
                elif d < 1.35:
                    q = gp[x, y]; put(gp, W, roofH, x, y, mix(q[:3], (255, 244, 222), 0.4) if y < cy else mul(q, 0.7))
    k = kinds or ('l' + 'p' * (wc - 2) + 'r')
    body = pv.walls(gs or st, k.replace('w', 'p').replace('d', 'p'), 1, gs or st)
    im = Image.new('RGBA', (W, roofH + 32)); im.alpha_composite(g, (0, 0)); im.alpha_composite(body, (0, roofH))
    px = im.load(); Wp, Hp = im.size; wy = roofH
    win = windows or {}
    for i, ch in enumerate(k):
        X = i * 16
        if ch == 'w':
            o = win.get(i, {})
            broken_window(px, Wp, Hp, X + 4, wy + 6, 8, 10, seed + i, o.get('shutter'), o.get('boarded', False), burnt)
            if burnt or soot_k: soot(px, Wp, Hp, X + 4, X + 12, wy - 6, wy + 7, seed + i, 0.85 if burnt else soot_k, up=False)
        if ch == 'd':
            doorway(px, Wp, Hp, X + 3, wy + 8, 10, 23, seed + i, door, burnt)
    stain(px, Wp, Hp, 0, Wp, wy + 2, wy + 26, seed + 7)
    crack(px, Wp, Hp, W // 2 + 5, wy + 4, 10, seed)
    for (x, t) in ivy: _ivy_dead(px, Wp, Hp, x, wy + 30, wy - t, seed + x)
    for (x, y, r, cn) in webs: cobweb(px, Wp, Hp, x, y, r, seed + x, cn)
    if burnt:
        for y in range(Hp):
            for x in range(Wp):
                q = px[x, y]
                if q[3] > 200 and H(x // 3, y // 3, seed + 50) > 0.5: px[x, y] = char_px(q, 0.4, seed, x, y) + (255,)
    im = fin(im)
    _foot(im, seed + 1, 0.55)
    if lean:
        im = _lean(im, lean)
    return im

def _lean(im, k):
    """기운 집: 위로 갈수록 오른쪽(+)으로 밀린다(밑동 고정)."""
    W, Hh = im.size; o = Image.new('RGBA', (W, Hh)); s = im.load(); d = o.load()
    for y in range(Hh):
        sh = int(round(k * (Hh - 1 - y) / Hh))
        for x in range(W):
            xx = x - sh
            if 0 <= xx < W: d[x, y] = s[xx, y]
    return o
