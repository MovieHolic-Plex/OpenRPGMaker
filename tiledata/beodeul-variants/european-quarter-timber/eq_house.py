# 목골 구시가 건물 조립 — 지붕(eq_roof) + 층 벽(eq_wall) + 덧붙이(다락창·굴뚝·내닫이 탑·차양·간판). 결정적.
# 벽은 지붕보다 양쪽 2화소 안으로 들어간다(버들항 ph2.volume 규칙: 처마가 벽 위로 나오고 벽 윗줄에 그늘).
# 층 순서: storeys 는 아래층부터. (mat, kinds, opts) — mat: brick/stone/timber, kinds: 칸 글자(eq_wall.storey 참조).
from eq_base import *
import eq_wall as WL, eq_roof as RF

def _walls(im, ytop, W, storeys, seed, eave_shadow, box_col='red', shutter='grn', ov=2):
    """storeys(아래층부터)를 ytop(맨 윗층 위변)부터 칠한다. 아래층부터 칠해야 위층 내밀기 그늘이 아래층 위에 앉는다."""
    n = len(storeys); wc = W // 16
    for s in range(n):                          # s=0 맨 아래층
        mat, kinds = storeys[s][:2]; o = storeys[s][2] if len(storeys[s]) > 2 else {}
        y = ytop + (n - 1 - s) * 32
        WL.storey(im, ov, y, wc, kinds, mat, seed + s * 7, jetty=o.get('jetty', mat == 'timber' and s > 0),
                  eave=(s == n - 1 and eave_shadow), box_col=o.get('box', box_col), shutter=o.get('shutter', shutter), wpx=W - 2 * ov, base=(s == 0))
    return ytop + n * 32

def awning(im, x0, x1, y, col='red', depth=7, seed=1):
    """줄무늬 차양: 벽에서 나와 앞으로 기운 천(위 밝음), 앞 끝 물결 술."""
    px = im.load(); W, Hh = im.size; A = AWN[col]; B = AWN['crm']
    for j in range(depth):
        for x in range(x0, x1):
            st = ((x - x0) // 3) % 2
            Rm = A if st else B
            t = 5 - (j * 3) // depth
            put(px, W, Hh, x, y + j, Rm[max(2, t)])
    for x in range(x0, x1):
        st = ((x - x0) // 3) % 2; Rm = A if st else B
        put(px, W, Hh, x, y + depth, Rm[3]);
        if (x - x0) % 3 != 2: put(px, W, Hh, x, y + depth + 1, Rm[2])
        put(px, W, Hh, x, y - 1, BEAM[2])
    for x in range(x0, x1): put(px, W, Hh, x, y + depth + 2, mul(get(px, W, Hh, x, y + depth + 2), 0.6)); put(px, W, Hh, x, y + depth + 3, mul(get(px, W, Hh, x, y + depth + 3), 0.8))

SIGNS = {}
def sign_icon(px, W, Hh, x, y, kind):
    """간판 그림 기호(글자 없음) 7x7 안: bread 빵·mug 잔·bed 침대·anvil 모루·key 열쇠·boot 장화·fish 생선·scale 저울·herb 약초."""
    G_ = GOLD; I_ = IRON
    pts = {
        'bread': [(1, 4), (2, 3), (3, 3), (4, 3), (5, 4), (1, 5), (2, 5), (3, 5), (4, 5), (5, 5), (2, 4), (3, 4), (4, 4)],
        'mug': [(1, 2), (2, 2), (3, 2), (4, 2), (1, 3), (1, 4), (1, 5), (2, 5), (3, 5), (4, 5), (4, 3), (4, 4), (5, 3), (6, 4), (5, 5), (2, 3), (3, 3)],
        'bed': [(0, 2), (0, 3), (0, 4), (0, 5), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (6, 5), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (2, 2)],
        'anvil': [(0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (1, 3), (2, 3), (3, 3), (4, 3), (2, 4), (3, 4), (1, 5), (2, 5), (3, 5), (4, 5), (6, 2)],
        'key': [(1, 2), (2, 2), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (5, 4), (6, 5)],
        'boot': [(2, 1), (3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (2, 4), (3, 4), (4, 4), (2, 5), (3, 5), (4, 5), (5, 5)],
        'scale': [(3, 1), (3, 2), (0, 2), (1, 2), (2, 2), (4, 2), (5, 2), (6, 2), (0, 3), (6, 3), (0, 4), (1, 4), (5, 4), (6, 4), (3, 3), (3, 4), (2, 5), (3, 5), (4, 5)],
        'herb': [(3, 1), (2, 2), (4, 2), (3, 2), (1, 3), (3, 3), (5, 3), (3, 4), (3, 5), (2, 4), (4, 4)],
        'cloth': [(1, 1), (5, 1), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (2, 3), (3, 3), (4, 3), (2, 4), (3, 4), (4, 4), (2, 5), (3, 5), (4, 5)],
    }[kind]
    col = {'bread': G_, 'mug': G_, 'bed': CREAM, 'anvil': I_, 'key': G_, 'boot': WD, 'scale': G_, 'herb': LEAF, 'cloth': AWN['blu']}[kind]
    for (a, b) in pts: put(px, W, Hh, x + a, y + b, col[5] if b < 4 else col[3])

def hanging_sign(im, x, y, kind, side='R', board=WD):
    """벽에서 나온 쇠 막대 + 매달린 나무 판(그림 기호만). x 는 벽 위 막대 뿌리."""
    px = im.load(); W, Hh = im.size; d = 1 if side == 'R' else -1
    for i in range(12): put(px, W, Hh, x + d * i, y, IRON[4] if i % 4 else IRON[2])
    for i in range(4): put(px, W, Hh, x + d * i, y + 1 + i, IRON[2])
    bx = x + d * 2 if side == 'R' else x - 11
    for yy in range(y + 2, y + 13):
        for xx in range(bx, bx + 10):
            t = 4 if xx > bx and yy > y + 2 else 5
            if xx == bx + 9 or yy == y + 12: t = 2
            put(px, W, Hh, xx, yy, board[t])
    put(px, W, Hh, bx + 2, y + 1, IRON[3]); put(px, W, Hh, bx + 7, y + 1, IRON[3])
    sign_icon(px, W, Hh, bx + 1, y + 3, kind)

def finish(im, roof_bottom, ov=2, tuft_seed=None):
    """벽 옆 2화소 비우기(처마 내밀기) + 처마 밑 그늘 4줄 + 버들항 마감(실루엣 안쪽 1화소 어둡게)."""
    im = ph2.volume(im, roof_bottom, o=ov, shadow=4)
    return fin(im)

# ---------------------------------------------------------------- 박공이 길 쪽(앞)을 향한 집
def gable_house(wc, storeys, run=26, G=None, seed=1, peak=True, attic='o', chimneys=(), dormers_side=(), oriel=None, signs=(), awnings=(),
                box_col='red', shutter='grn', extra=None, mat='tile', gmat='timber'):
    W = wc * 16; G = G or (int(W * 0.46) // 2 * 2); pad = 14
    roof = RF.gable_front(W, run, G, mat=mat, peak=peak, seed=seed, attic=attic, gmat=gmat)
    wall_h = len(storeys) * 32
    Hh = pad + roof.height + wall_h
    im = Image.new('RGBA', (W, Hh)); ytop = pad + roof.height
    im.alpha_composite(roof, (0, pad))
    _walls(im, ytop, W, storeys, seed, False, box_col, shutter)
    im = ph2.volume(im, ytop, o=2, shadow=0)
    for (cx, cy, h) in chimneys:                         # 굴뚝 밑동은 지붕 경사 위(cy = 지붕 위 y)
        c = RF.chimney(h, 8, seed + cx); im.alpha_composite(c, (cx, pad + cy - c.height + 3))
    for (ax0, ax1, s, col) in awnings: awning(im, ax0, ax1, ytop + wall_h - 32 * (s + 1) + 6, col, seed=seed)
    for (sx, s, kind, side) in signs: hanging_sign(im, sx, ytop + wall_h - 32 * (s + 1) + 2, kind, side)
    if oriel:
        side, s0, n = oriel
        o = RF.oriel(20, n, 'slate', seed)
        ox = -4 if side == 'L' else W - o.width + 4
        oy = ytop + wall_h - 32 * (s0 + n) - 26 + 4
        o2 = Image.new('RGBA', im.size); o2.alpha_composite(o, (ox, oy)); im.alpha_composite(o2)
    if extra: extra(im, ytop)
    return fin(im), dict(roof_bottom=ytop, wall_h=wall_h)

# ---------------------------------------------------------------- 처마가 길과 나란한 집(동서 용마루)
def eave_house(wc, storeys, Rh=46, ends='LR', seed=1, dormers=(), chimneys=(), signs=(), awnings=(), box_col='red', shutter='grn',
               gables=(), extra=None, mat='tile', pad=16):
    """gables: 앞으로 솟은 박공 날개 (col, wcols) — 날개 지붕 용마루가 큰 용마루 높이에서 시작해 앞 박공으로 끝난다(골짜기 삼각)."""
    W = wc * 16
    roof = RF.eave_front(W, Rh, ends, mat)
    wall_h = len(storeys) * 32; Hh = pad + Rh + wall_h
    im = Image.new('RGBA', (W, Hh)); ytop = pad + Rh
    for (cx, cy, h) in chimneys:
        if cy < 4: c = RF.chimney(h, 8, seed + cx); im.alpha_composite(c, (cx, pad + cy - c.height + 8))
    im.alpha_composite(roof, (0, pad))
    _walls(im, ytop, W, storeys, seed, True, box_col, shutter)
    im = ph2.volume(im, ytop, o=2, shadow=4)
    for (cx, cy, h) in chimneys:
        if cy >= 4: c = RF.chimney(h, 8, seed + cx); im.alpha_composite(c, (cx, pad + cy - c.height + 8))
    for (dx, dy) in dormers:
        d = RF.dormer(mat); im.alpha_composite(d, (dx, pad + dy))
    for (gc, gw) in gables:                                        # 앞으로 솟은 박공(벽면 위로 처마선을 깨고 올라간다)
        Wg = gw * 16; G = min(Rh - 12, int(Wg * 0.5) // 2 * 2); run = Rh - G
        g = RF.gable_front(Wg, run, G, mat=mat, peak=False, seed=seed + gc, attic='w' if gw >= 3 else 'o')
        gp = g.load()
        for y in range(run):                                       # 큰 지붕 위 골짜기 삼각만 남긴다(꼭지 = 큰 용마루)
            half = Wg / 2 * (y + 1) / run
            for x in range(Wg):
                dd = abs(x + 0.5 - Wg / 2)
                if dd > half: gp[x, y] = (0, 0, 0, 0)
                elif dd > half - 1.5: gp[x, y] = BEAM[1] + (255,)
        layer = Image.new('RGBA', im.size); layer.alpha_composite(g, (gc * 16, pad)); im.alpha_composite(layer)
    for (ax0, ax1, s, col) in awnings: awning(im, ax0, ax1, ytop + wall_h - 32 * (s + 1) + 6, col, seed=seed)
    for (sx, s, kind, side) in signs: hanging_sign(im, sx, ytop + wall_h - 32 * (s + 1) + 2, kind, side)
    if extra: extra(im, ytop)
    return fin(im), dict(roof_bottom=ytop, wall_h=wall_h)

def balcony(im, x0, x1, y, seed=1):
    """나무 발코니(층 바닥 y 에 걸친다): 마루 판 3화소 + 난간 살(2화소 간격) + 손잡이, 밑에 까치발 둘."""
    px = im.load(); W, Hh = im.size
    for x in range(x0, x1):
        put(px, W, Hh, x, y, WD[5]); put(px, W, Hh, x, y + 1, WD[4]); put(px, W, Hh, x, y + 2, WD[2])
        put(px, W, Hh, x, y - 9, WD[6] if x < (x0 + x1) // 2 else WD[5]); put(px, W, Hh, x, y - 8, WD[3])
        if (x - x0) % 3 == 0:
            for yy in range(y - 7, y): put(px, W, Hh, x, yy, WD[4]); put(px, W, Hh, x + 1, yy, WD[2])
    for bx in (x0 + 2, x1 - 4):
        for j in range(5):
            put(px, W, Hh, bx + j // 2, y + 3 + j, WD[3]); put(px, W, Hh, bx + 1 + j // 2, y + 3 + j, WD[1])
