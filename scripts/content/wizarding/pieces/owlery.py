"""올빼미탑(owlery) — 둥근 탑 벽 8방향·창·난간·바닥·횃대·우편함·계단·문·예제.
  python3 scripts/content/wizarding/pieces/owlery.py   → 검사 + tiledata/wizarding/review/owlery.png
# 8각 둥근 탑(위·아래 직선, 모서리는 4px 계단식 곡선으로 이어 지름 14칸, 옆 직선).
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'owlery'
SP = 'owlery'
ST = 'stone'
TH = 11          # 벽 윗면 세로 두께(대각도 같다 — 북벽과 이어진다)
FH = 18          # 대각·남벽 면 높이


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 벽 공통 ─────────────────────────
def face_col(x, y, base=3, yo=0):
    """큰 석재 블록 정면 한 점. x 는 16 주기(가로로 이어짐)."""
    yy0 = y + yo
    ci = (yy0 + 2) // 7
    yy = (yy0 + 2) % 7
    k1 = (ci * 5 + 2) % 16
    k2 = (ci * 5 + 10) % 16
    lx = x % 16
    seg = (lx >= k1) + (lx >= k2)
    bid = (ci * 3 + seg) % 11
    r = hsh(bid, ci, 3)
    tone = base + (-1 if r < 0.25 else (1 if r > 0.88 else 0))
    col = K(ST, tone)
    if yy == 0: col = K(ST, tone + 1)
    elif yy == 6: col = K(ST, 2)
    elif lx in (k1, k2): col = K(ST, 2)
    elif lx in ((k1 + 1) % 16, (k2 + 1) % 16): col = K(ST, tone + 1)
    if hsh(x, y + yo, 9) < 0.03 and yy not in (0, 6): col = K(ST, tone - 1)
    return col


def paint(c, mask, yo=0):
    """mask[(x,y)] = 'b' 윗면 · 'f' 정면 · 'i' 옆 안쪽면. 윗면 위·왼 모서리 밝게, 앞 모서리 어둡게."""
    for (x, y), k in mask.items():
        if k == 'b':
            col = K(ST, 4)
            up = mask.get((x, y - 1)); lf = mask.get((x - 1, y)); dn = mask.get((x, y + 1))
            if y > 0 and up != 'b': col = K(ST, 5)
            elif x > 0 and lf != 'b': col = K(ST, 5)
            elif dn in ('f', 'i') or (dn is None and y < c.h - 1): col = K(ST, 3)
            else:
                v = hsh(x, y, 21)
                if v < 0.06: col = K(ST, 5)
                elif v < 0.12: col = K(ST, 3)
            c.P(x, y, col)
        elif k == 'f':
            col = face_col(x, y, 3, yo)
            if mask.get((x + 1, y)) is None and x < c.w - 1: col = K(ST, 2) if col != K(ST, 2) else K(ST, 1)
            c.P(x, y, col)
        else:
            col = K(ST, 2)
            if y % 7 == 6: col = K(ST, 1)
            elif mask.get((x - 1, y)) == 'b': col = K(ST, 3)
            c.P(x, y, col)


def wall_nw_mask(mirror=False):
    """북서: 윗면 띠가 4px 계단으로 오른쪽 위→왼쪽 아래로 내려가고, 왼쪽은 서벽 띠로 이어진다."""
    m = {}
    for y in range(48):
        for x in range(16):
            u = 15 - x if mirror else x
            yu = 4 * ((15 - u) // 4)
            if u <= 9 and y >= yu: m[(x, y)] = 'b'
            elif yu <= y < yu + TH: m[(x, y)] = 'b'
            elif u >= 10 and yu + TH <= y < yu + TH + FH: m[(x, y)] = 'f'
            elif 10 <= u <= 13 and y >= yu + TH + FH: m[(x, y)] = 'i'
    return m


def wall_sw_mask(mirror=False):
    m = {}
    for y in range(48):
        for x in range(16):
            u = 15 - x if mirror else x
            yu = 4 * (u // 4) + 4
            if u <= 9 and y < yu + TH: m[(x, y)] = 'b'
            elif yu <= y < yu + TH: m[(x, y)] = 'b'
            elif yu + TH <= y < yu + TH + FH: m[(x, y)] = 'f'
            elif 10 <= u <= 13 and y < yu: m[(x, y)] = 'i'
    return m


def band_mask_ew(mirror=False):
    m = {}
    for y in range(16):
        for x in range(16):
            u = 15 - x if mirror else x
            if u <= 9: m[(x, y)] = 'b'
            elif u <= 13: m[(x, y)] = 'i'
    return m


def _seams(c, mirror=False, y0=0, y1=None):
    """서·동 벽 윗면 띠에 석판 이음선(8px 간격) — 평면 띠로 보이지 않게."""
    y1 = c.h if y1 is None else y1
    for y in range(y0, y1):
        if y % 8 == 7:
            for u in range(1, 9):
                x = 15 - u if mirror else u
                if c.get(x, y)[3] and c.get(x, y) == K(ST, 4): c.P(x, y, K(ST, 3))
        if y % 8 == 0:
            for u in range(1, 9):
                x = 15 - u if mirror else u
                if c.get(x, y)[3] and c.get(x, y) == K(ST, 4): c.P(x, y, K(ST, 5))


# ───────────────────────── 탑 벽 8방향 ─────────────────────────
WALLS = {}


def _wall_n_draw(c, deco=None):
    for x in range(16):
        for y in range(0, TH):
            col = K(ST, 4)
            if y == 0: col = K(ST, 5)
            elif y == TH - 1: col = K(ST, 3)
            else:
                v = hsh(x, y, 21)
                if v < 0.06: col = K(ST, 5)
                elif v < 0.12: col = K(ST, 3)
                if x % 16 in (7, 15) and 2 <= y <= TH - 3: col = K(ST, 3)
            c.P(x, y, col)
        for y in range(TH, 58):
            c.P(x, y, face_col(x, y, 3, 0))
        # 걸레받이
        for y in range(58, 64):
            col = K(ST, 2)
            if y == 58: col = K(ST, 3)
            elif y >= 62: col = K(ST, 1)
            elif x % 16 in (5, 12): col = K(ST, 1)
            c.P(x, y, col)
    c.HL(0, 0, 16, K(ST, 1))
    if deco: deco(c)


@REG.piece('wz-owl-wall-n', '탑 벽 북(N)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='올빼미탑 북쪽 벽 1×4. 0행 윗면 두께, 1~3행 안쪽을 향한 큰 석재 블록 정면+걸레받이. 가로로 이어 깐다.',
           rules='탑 벽 위 직선(6칸)에 깐다. 양 끝은 NW·NE 대각 조각과 이어진다.', tags=['벽', '탑', '둥근벽'], role='wall', repeat=True)
def _n(c): _wall_n_draw(c)


def _stamp(c, x0, y0, rows, cmap):
    """문자 그림 찍기: rows 의 각 글자를 cmap 색으로('.'은 건너뜀)."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != '.': c.P(x0 + dx, y0 + dy, cmap[ch])


def _guano(c):
    # 윗면 가장자리에 걸친 불규칙 흰 덩이 2개(흰+연회백, 아래 1px 따뜻한 회색 그늘) + 가늘어지는 흐름자국 1px
    cm = {'W': K('snow', 3), 'B': K('snow', 2), 'S': K('linen', 1)}
    _stamp(c, 1, 9, ['..WW...',
                     '.WWWBW.',
                     'WBBBBBS',
                     '.SBBBS.',
                     '..SBS..',
                     '...B...',
                     '...S...',
                     '....S..'], cm)
    _stamp(c, 10, 10, ['.WW..',
                       'WWBW.',
                       'BBBBS',
                       '.SBS.',
                       '..S..'], cm)
    c.P(9, 11, K('snow', 2)); c.P(15, 12, K('linen', 1))      # 튄 자국


def _beam(c):
    # 안쪽 마감: 가로 오크 보와 쇠 꺾쇠
    for x in range(16):
        c.P(x, 28, K('wood', 1))
        for y in range(29, 33):
            c.P(x, y, K('wood', 4 if y == 29 else 3 if y < 32 else 2))
        c.P(x, 33, K('wood', 1))
        if hsh(x, 3, 2) < 0.2: c.P(x, 30, K('wood', 2))
    for bx in (3, 12):
        c.R(bx, 34, 2, 5, K('iron', 2)); c.P(bx, 34, K('iron', 3)); c.P(bx, 38, K('iron', 1))
        c.P(bx, 30, K('iron', 3)); c.P(bx + 1, 30, K('iron', 1))


@REG.piece('wz-owl-wall-n-stained', '탑 벽 북(새똥 얼룩)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽에 흰 새똥 줄무늬가 흘러내린 변형 1×4. 가로 이음은 일반 북벽과 같다.', rules='일반 북벽 사이사이에 섞는다.',
           tags=['벽', '탑', '새똥'], role='wall', repeat=True)
def _n2(c): _wall_n_draw(c, _guano)


@REG.piece('wz-owl-wall-n-beam', '탑 안쪽 마감(오크 보)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북벽 안쪽 마감: 석재 정면을 가로지르는 오크 보와 쇠 꺾쇠. 가로로 이어 깔 수 있다.', rules='일반 북벽 사이에 끼우거나 연속으로 깐다.',
           tags=['벽', '탑', '보', '안쪽마감'], role='wall', repeat=True)
def _n3(c): _wall_n_draw(c, _beam)


@REG.piece('wz-owl-wall-nw', '탑 벽 북서(NW)', 1, 3, ['S', 'S', 'S'], 'architecture', SP,
           desc='북벽에서 서쪽 벽으로 꺾이는 4px 계단식 곡선 1×3. 오른쪽 위가 북벽 윗면에 이어지고 왼쪽 아래는 서벽 띠로 내려간다.',
           rules='북 직선 왼쪽 끝 옆에서 왼쪽 아래로 한 칸씩 계단처럼 4개(NW) 잇고, 맨 아래는 서벽(W)으로 이어진다.',
           tags=['벽', '탑', '둥근벽'], role='wall')
def _nw(c):
    paint(c, wall_nw_mask(False)); _seams(c, False, 20); c.outline()


@REG.piece('wz-owl-wall-ne', '탑 벽 북동(NE)', 1, 3, ['S', 'S', 'S'], 'architecture', SP,
           desc='북벽에서 동쪽 벽으로 꺾이는 4px 계단식 곡선 1×3(NW 거울, 빛은 왼쪽 위 그대로).',
           rules='북 직선 오른쪽 끝 옆에서 오른쪽 아래로 4개 잇고, 맨 아래는 동벽(E)으로 이어진다.',
           tags=['벽', '탑', '둥근벽'], role='wall')
def _ne(c):
    paint(c, wall_nw_mask(True)); _seams(c, True, 20); c.outline()


@REG.piece('wz-owl-wall-w', '탑 벽 서(W)', 1, 1, ['S'], 'architecture', SP,
           desc='서쪽 직선 벽 1×1. 위에서 본 윗면 띠와 안쪽 얇은 면.', rules='세로로 이어 깐다. 위·아래는 NW·SW 조각과 이어진다.',
           tags=['벽', '탑', '둥근벽'], role='wall', repeat=False)
def _w(c):
    paint(c, band_mask_ew(False)); _seams(c, False); c.outline()


@REG.piece('wz-owl-wall-e', '탑 벽 동(E)', 1, 1, ['S'], 'architecture', SP,
           desc='동쪽 직선 벽 1×1(W 거울).', rules='세로로 이어 깐다.', tags=['벽', '탑', '둥근벽'], role='wall', repeat=False)
def _e(c):
    paint(c, band_mask_ew(True)); _seams(c, True); c.outline()


@REG.piece('wz-owl-wall-sw', '탑 벽 남서(SW)', 1, 3, ['S', 'S', 'S'], 'architecture', SP,
           desc='서벽에서 남벽으로 꺾이는 4px 계단식 곡선 1×3. 아래로 낮게 잘린 바깥 면이 남벽과 이어진다.',
           rules='서벽(W) 아래에서 오른쪽 아래로 4개 잇고 남 직선(S)으로 이어진다.', tags=['벽', '탑', '둥근벽'], role='wall')
def _sw(c):
    paint(c, wall_sw_mask(False)); _seams(c, False, 0, 20); c.outline()


@REG.piece('wz-owl-wall-se', '탑 벽 남동(SE)', 1, 3, ['S', 'S', 'S'], 'architecture', SP,
           desc='동벽에서 남벽으로 꺾이는 4px 계단식 곡선 1×3(SW 거울).', rules='동벽(E) 아래에서 왼쪽 아래로 4개 잇는다.',
           tags=['벽', '탑', '둥근벽'], role='wall')
def _se(c):
    paint(c, wall_sw_mask(True)); _seams(c, True, 0, 20); c.outline()


@REG.piece('wz-owl-wall-s', '탑 벽 남(S, 낮게 잘린 면)', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='남쪽 직선 벽 1×2. 아래쪽 벽은 낮게 잘려 윗면+바깥 면 두 줄만 보인다(플레이어는 그 위를 못 넘는다).',
           rules='탑 아래 직선(6칸)에 깐다. 양 끝은 SW·SE 대각과 이어진다.', tags=['벽', '탑', '둥근벽'], role='wall', repeat=True)
def _s(c):
    m = {}
    for x in range(16):
        for y in range(32):
            if y < TH: m[(x, y)] = 'b'
            elif y < TH + FH: m[(x, y)] = 'f'
    paint(c, m)
    for x in range(16): c.P(x, TH + FH - 1, K(ST, 1))
    c.HL(0, 0, 16, K(ST, 1))


# ───────────────────────── 바닥·바깥 ─────────────────────────
def flag_tile(tone_seed=0, band=None, vertical=False):
    """16×16 이음새 없는 포석(세로 3줄 6·5·5, 줄마다 16 주기로 경계). band: (y0,y1) 가로 띠."""
    c = Cv(16, 16)
    rows = ((0, 6, (0, 9)), (6, 5, (5, 13)), (11, 5, (2, 10)))
    for (y0, rh, cuts) in rows:
        cs = sorted(cuts)
        for i, k in enumerate(cs):
            k2 = cs[(i + 1) % len(cs)]
            ln = (k2 - k) % 16 or 16
            r = hsh(k, y0, 5 + tone_seed)
            tone = 3 + (-1 if r < 0.25 else (1 if r > 0.85 else 0))
            for dx in range(ln):
                x = (k + dx) % 16
                for dy in range(rh):
                    y = y0 + dy
                    col = K(ST, tone)
                    if dy == 0 or dx == 0: col = K(ST, tone + 1)
                    if dy == rh - 1 or dx == ln - 1: col = K(ST, 2)
                    c.P(x, y, col)
        if hsh(y0, 3, 7 + tone_seed) < 0.9:
            c.P(int(hsh(y0, 1, 4 + tone_seed) * 12) + 2, y0 + 2, K(ST, 2))
    return c


@REG.piece('wz-owl-floor', '탑 바닥 포석', 1, 1, ['F'], 'surfaces', SP,
           desc='올빼미탑 바닥 큰 포석. 이음새 없이 반복되는 3줄 석판.', rules='탑 안쪽 전체에 깐다.', tags=['바닥', '포석', '탑'], role='terrain', repeat=True)
def _floor(c):
    c.blit(flag_tile(0), 0, 0)


def _band_tile(vertical):
    c = flag_tile(1)
    # 가운데 어두운 홈 띠: 짧은 돌 + 황동 줄 한 가닥
    t = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            if 4 <= y <= 11:
                tone = 2 + (1 if hsh(x // 5, y // 4, 3) > 0.6 else 0)
                col = K(ST, tone)
                if (x % 8 == 0): col = K(ST, 1)
                elif y in (4, 5): col = K(ST, tone + 1)
                if y == 11: col = K(ST, 1)
                t.P(x, y, col)
    for x in range(16):
        t.P(x, 3, K(ST, 1))
        if x % 6 != 5:
            t.P(x, 6, K('brass', 4)); t.P(x, 7, K('brass', 3)); t.P(x, 8, K('brass', 2))
    if vertical:
        o = Cv(16, 16)
        for y in range(16):
            for x in range(16):
                p = t.get(y, x)
                if p[3]: o.P(x, y, p)
        t = o
    c.blit(t, 0, 0)
    return c


@REG.piece('wz-owl-floor-band', '둥근 포석 띠 바닥(가로)', 1, 1, ['F'], 'surfaces', SP,
           desc='탑 바닥의 가운데 어두운 돌띠와 황동 줄. 벽 안쪽·난간 둘레를 도는 띠로 쓴다(가로).', rules='가로로 이어 깐다.',
           tags=['바닥', '띠', '탑'], role='terrain', repeat=True)
def _fb(c): c.blit(_band_tile(False), 0, 0)


@REG.piece('wz-owl-floor-band-v', '둥근 포석 띠 바닥(세로)', 1, 1, ['F'], 'surfaces', SP,
           desc='위 띠 바닥의 세로판. 동·서 가장자리에서 세로로 이어 깐다.', rules='세로로 이어 깐다.',
           tags=['바닥', '띠', '탑'], role='terrain', repeat=True)
def _fbv(c): c.blit(_band_tile(True), 0, 0)


@REG.piece('wz-owl-void', '탑 바깥 어둠', 1, 1, ['X'], 'surfaces', SP,
           desc='탑 벽 바깥 빈 곳을 메우는 어두운 칸(아무것도 안 보인다).', rules='탑 둥근 벽 밖 전부에 먼저 깐다.',
           tags=['바깥', '어둠'], role='terrain', repeat=True)
def _void(c):
    c.R(0, 0, 16, 16, OL2)
    for y in range(16):
        for x in range(16):
            if hsh(x, y, 4) < 0.03: c.P(x, y, OL)


@REG.piece('wz-owl-pit', '중앙 빈 구멍', 1, 1, ['X'], 'surfaces', SP,
           desc='탑 한가운데 아래층으로 뚫린 구멍. 어두운 푸른 밤빛, 난간 안쪽에 깐다.', rules='둥근 난간 안쪽에 깐다.',
           tags=['구멍', '난간'], role='terrain', repeat=True)
def _pit(c):
    c.R(0, 0, 16, 16, K('night', 1))
    for y in range(16):
        for x in range(16):
            v = hsh(x, y, 8)
            if v < 0.06: c.P(x, y, K('night', 2))
            elif v < 0.14: c.P(x, y, OL2)


# ───────────────────────── 바닥 덧그림 ─────────────────────────
def _feather(c, x, y, ln=7, flip=False, tone=3):
    # 깃털 한 장: 대각 깃대+양쪽 날개
    for k in range(ln):
        px = x + (ln - 1 - k if flip else k); py = y + k // 2 + (k % 2) * 0
        c.P(px, py, K('night', 2))
    for k in range(1, ln - 1):
        px = x + (ln - 1 - k if flip else k); py = y + k // 2
        c.P(px, py - 1, K('linen', tone)); c.P(px, py + 1, K('linen', tone - 1 if tone > 1 else 1))
    c.P(x + (0 if not flip else ln - 1), y + 1, K('linen', 1))


@REG.piece('wz-owl-feathers', '떨어진 깃털', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 떨어진 깃털 두세 장(투명 덧그림).', rules='횃대 아래·창가 바닥 위에 흩뿌린다.', tags=['깃털', '바닥덧그림'], role='terrain')
def _feathers(c):
    _feather(c, 2, 3, 7, False, 4); _feather(c, 8, 9, 6, True, 3); _feather(c, 3, 11, 5, False, 3)


def _splat(c, x0, y0, rows):
    """새똥 한 점: W 흰 · B 연회백 · S 연회색 그늘(아래·오른쪽) · d 회갈색 알갱이."""
    cm = {'W': K('snow', 3), 'B': K('snow', 2), 'S': K('linen', 1), 'd': K('brass', 2)}
    _stamp(c, x0, y0, rows, cm)


@REG.piece('wz-owl-droppings', '새똥 얼룩', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥의 흰 새똥 얼룩 몇 점(투명 덧그림).', rules='횃대 바로 아래 바닥 위에 깐다.', tags=['새똥', '바닥덧그림'], role='terrain')
def _drop(c):
    _splat(c, 1, 2, ['.W...W',
                     'WWBd..',
                     '.BBBS.',
                     '..SS..'])
    _splat(c, 8, 7, ['..W...',
                     '.WWBW.',
                     'WWBBBS',
                     '.dBBS.',
                     '..BS..',
                     '...S.B'])
    _splat(c, 2, 11, ['W....',
                      '.WB..',
                      '.BdS.',
                      '..S..'])


@REG.piece('wz-owl-pellets', '올빼미 펠릿과 깃털', 1, 1, ['f'], 'surfaces', SP,
           desc='회갈색 펠릿(소화 안 된 털 뭉치) 두 개와 깃털 한 장(투명 덧그림).', rules='횃대 아래 바닥에 가끔.', tags=['펠릿', '깃털', '바닥덧그림'], role='terrain')
def _pel(c):
    for (x, y) in ((3, 4), (9, 10)):
        c.R(x, y, 4, 2, K('dirt', 4)); c.HL(x, y, 3, K('dirt', 5)); c.HL(x + 1, y + 2, 3, K('dirt', 2)); c.P(x + 3, y + 1, K('dirt', 3))
        c.P(x - 1, y + 1, K('dirt', 3))
    _feather(c, 8, 3, 6, True, 3)



# ───────────────────────── 깊은 비행 창 ─────────────────────────
def _arch_in(x, y, cx=7.5, top=21, ah=7, hw=6.0, bot=54):
    """창 구멍 안 점인가 — 반원 아치 + 직사각."""
    if y < top or y > bot: return False
    if y < top + ah:
        dy = (top + ah) - (y + 0.5)
        r = hw * math.sqrt(max(0.0, 1 - (dy / ah) ** 2))
        return abs(x + 0.5 - (cx + 0.5)) <= r
    return abs(x + 0.5 - (cx + 0.5)) <= hw


def _stalk(c, pts, hi=4, lo=2):
    """굵은 짚 줄기 한 가닥: 윗단 밝게, 바로 아래 한 단 어둡게(2px 두께)."""
    for (x, y) in pts: c.P(x, y + 1, K('brass', lo))
    for (x, y) in pts: c.P(x, y, K('brass', hi))


def _window_deco(c, straw=True):
    ins = {(x, y) for x in range(16) for y in range(64) if _arch_in(x, y)}
    ins_big = {(x, y) for x in range(16) for y in range(64) if _arch_in(x, y, hw=7.5, top=19, ah=8, bot=57)}
    # 아치 둘레 쐐기돌(밝게)
    for (x, y) in ins_big:
        if (x, y) not in ins:
            col = K(ST, 5) if (x + y // 3) % 5 else K(ST, 4)
            if y > 45: col = K(ST, 4)
            c.P(x, y, col)
    for (x, y) in ins_big:
        nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        if (x, y) not in ins and any(q not in ins_big for q in nb): c.P(x, y, K(ST, 2))
    # 안쪽: 밤하늘(아래로 밝아지는 남색 띠) + 깊은 창턱 바닥
    for (x, y) in ins:
        if y < 39: col = K('night', 1)
        elif y < 46: col = K('water', 1)
        elif y < 50: col = K('water', 2)
        else: col = K(ST, 3) if y > 50 else K(ST, 2)     # 창 터널 바닥(밖 가장자리 그늘 1px)
        c.P(x, y, col)
    for (sx, sy, sc) in ((4, 27, 3), (10, 25, 2), (9, 34, 3)):    # 불규칙 별 1px
        c.P(sx, sy, K('snow', sc))
    xs = sorted({x for (x, y) in ins})
    lx0, rx1 = xs[0], xs[-1]
    for (x, y) in ins:       # 안쪽 벽두께: 왼쪽 문설주 2px 밝게 · 오른쪽 2px 그늘 · 위 안쪽 그늘
        if (x - 1, y) not in ins: c.P(x, y, K(ST, 5))
        elif (x - 2, y) not in ins: c.P(x, y, K(ST, 4))
        if (x + 1, y) not in ins: c.P(x, y, K(ST, 1))
        elif (x + 2, y) not in ins: c.P(x, y, K(ST, 2))
        if (x, y - 1) not in ins: c.P(x, y, K(ST, 2))
    for y in range(50, 55):                      # 터널 바닥과 문설주가 만나는 모서리
        if (lx0, y) in ins: c.P(lx0 + 1, y, K(ST, 4))
    # 창턱: 윗면 밝은 1px + 윗면 + 앞면 한 단 어둡게
    for x in range(1, 15):
        c.P(x, 55, K(ST, 5)); c.P(x, 56, K(ST, 4)); c.P(x, 57, K(ST, 3)); c.P(x, 58, K(ST, 2))
    c.P(0, 55, K(ST, 4)); c.P(15, 56, K(ST, 2)); c.P(15, 57, K(ST, 2))
    if straw:
        # 3~4가닥 굵은 줄기 묶음이 창턱에 가로로 누워 있고, 한 가닥이 앞으로 늘어진다
        def seg(x0, y0, x1, y1):
            n = max(abs(x1 - x0), abs(y1 - y0))
            return sorted({(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n)) for k in range(n + 1)})
        _stalk(c, seg(5, 55, 12, 49), 3, 1)          # 뒤로 기운 가닥
        _stalk(c, seg(2, 52, 9, 55), 4, 2)           # 앞으로 기운 가닥(교차)
        _stalk(c, seg(3, 54, 13, 53), 5, 2)
        _stalk(c, seg(7, 51, 11, 52), 4, 2)
        for (x, y, k) in ((1, 51, 3), (13, 48, 4), (14, 52, 4), (10, 50, 3), (4, 51, 4)): c.P(x, y, K('brass', k))   # 튀어나온 가는 끝
        c.P(13, 53, K('brass', 5)); c.P(12, 49, K('brass', 4))
        for (x, y, k) in ((12, 57, 3), (12, 58, 3), (13, 59, 2)): c.P(x, y, K('brass', k))   # 늘어진 가닥
        c.P(13, 58, K(ST, 1)); c.P(14, 59, K(ST, 1))

@REG.piece('wz-owl-window', '깊은 비행 창(짚 깔림)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='북쪽 벽에 깊이 판 아치 창 1×4. 올빼미가 드나드는 열린 창으로, 안쪽 벽두께와 문턱 위에 짚이 깔려 있다.',
           rules='북벽 사이에 끼운다. 밖은 밤하늘. 창 아래 바닥에 짚 더미·깃털을 둔다.', tags=['창', '비행창', '아치'], role='wall')
def _win(c): _wall_n_draw(c, lambda cc: _window_deco(cc, True))


@REG.piece('wz-owl-window-bare', '깊은 비행 창(빈 문턱)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='같은 아치 창, 문턱에 짚 없음.', rules='북벽 사이에 끼운다.', tags=['창', '비행창', '아치'], role='wall')
def _winb(c): _wall_n_draw(c, lambda cc: _window_deco(cc, False))


# ───────────────────────── 둥근 석조 난간 ─────────────────────────
def _cap_h(c, x0, x1):
    for x in range(x0, x1 + 1):
        c.P(x, 3, K(ST, 5)); c.R(x, 4, 1, 3, K(ST, 4)); c.P(x, 7, K(ST, 3))
        c.P(x, 2, K(ST, 1))
    c.HL(x0, 8, x1 - x0 + 1, K(ST, 1))


def _balusters_h(c, x0, x1):
    for x in range(x0, x1 + 1):
        k = x % 4
        if k in (1, 2):
            for y in range(9, 13):
                c.P(x, y, K(ST, 5) if (k == 1) else K(ST, 3))
            if k == 1: c.P(x, 10, K(ST, 4)); c.P(x, 11, K(ST, 4))
            if k == 2: c.P(x, 10, K(ST, 2)); c.P(x, 11, K(ST, 2))
        for y in range(9, 13):
            if k in (0, 3): c.P(x, y, None) if False else None
    for x in range(x0, x1 + 1):
        c.P(x, 13, K(ST, 3)); c.P(x, 14, K(ST, 2)); c.P(x, 15, K(ST, 1))


def _post(c, cx, cy):
    c.R(cx - 3, cy - 3, 7, 3, K(ST, 4)); c.HL(cx - 3, cy - 3, 7, K(ST, 5)); c.R(cx - 3, cy, 7, 5, K(ST, 3))
    c.VL(cx + 3, cy - 3, 8, K(ST, 2)); c.HL(cx - 3, cy + 4, 7, K(ST, 2))
    c.R(cx - 3, cy, 1, 5, K(ST, 4))
    c.outline_rect(cx - 3, cy - 4, 7, 9, K(ST, 1)) if False else None


@REG.piece('wz-owl-rail-h', '난간(가로)', 1, 1, ['S'], 'furniture', SP,
           desc='둥근 석조 난간의 가로 구간 1×1. 윗면 손잡이(밝음)와 병 모양 기둥들, 받침. 가로로 이어 깐다.',
           rules='중앙 구멍 둘레의 위·아래 변에 깐다. 모서리는 rail-corner-*.', tags=['난간', '석재'], role='fence', repeat=True)
def _rh(c):
    _cap_h(c, 0, 15); _balusters_h(c, 0, 15)
    for y in range(9, 13):
        pass


@REG.piece('wz-owl-rail-v', '난간(세로)', 1, 1, ['S'], 'furniture', SP,
           desc='석조 난간의 세로 구간 1×1. 위에서 본 폭 6px 윗면 띠와 중간 기둥머리.', rules='중앙 구멍 둘레의 좌·우 변에 깐다.',
           tags=['난간', '석재'], role='fence', repeat=True)
def _rv(c):
    for y in range(16):
        c.P(5, y, K(ST, 5)); c.P(6, y, K(ST, 4)); c.P(7, y, K(ST, 4)); c.P(8, y, K(ST, 4)); c.P(9, y, K(ST, 3)); c.P(10, y, K(ST, 2))
    c.VL(4, 0, 16, K(ST, 1)); c.VL(11, 0, 16, K(ST, 1))
    c.R(3, 6, 9, 4, K(ST, 4)); c.HL(3, 6, 9, K(ST, 5)); c.HL(3, 9, 9, K(ST, 2)); c.VL(11, 6, 4, K(ST, 2)); c.VL(2, 6, 4, K(ST, 1)); c.HL(3, 5, 9, K(ST, 1)); c.HL(3, 10, 9, K(ST, 1)); c.VL(12, 6, 4, K(ST, 1))


def _corner(c, east, south):
    """east: True 면 구간이 오른쪽(동)으로 뻗는다, False 면 왼쪽. south: True 면 아래로, False 면 위로."""
    x0, x1 = (8, 15) if east else (0, 8)
    _cap_h(c, x0, x1); _balusters_h(c, x0, x1)
    ys = (8, 15) if south else (0, 8)
    for y in range(ys[0], ys[1] + 1):
        c.P(5, y, K(ST, 5)); c.P(6, y, K(ST, 4)); c.P(7, y, K(ST, 4)); c.P(8, y, K(ST, 4)); c.P(9, y, K(ST, 3)); c.P(10, y, K(ST, 2))
        c.P(4, y, K(ST, 1)); c.P(11, y, K(ST, 1))
    _post(c, 8, 4)
    c.R(4, 2, 7, 3, K(ST, 4)); c.HL(4, 2, 7, K(ST, 5)); c.HL(4, 1, 7, K(ST, 1)); c.VL(3, 2, 6, K(ST, 1)); c.VL(11, 2, 6, K(ST, 1))
    c.R(4, 5, 7, 3, K(ST, 3)); c.VL(10, 2, 6, K(ST, 2)); c.HL(4, 8, 7, K(ST, 1))


@REG.piece('wz-owl-rail-corner-nw', '난간 모서리(북서)', 1, 1, ['S'], 'furniture', SP,
           desc='난간 모서리 기둥 1×1. 동쪽과 남쪽으로 구간이 뻗는다.', rules='중앙 구멍 북서 모서리.', tags=['난간', '모서리'], role='fence')
def _cnw(c): _corner(c, True, True)


@REG.piece('wz-owl-rail-corner-ne', '난간 모서리(북동)', 1, 1, ['S'], 'furniture', SP,
           desc='난간 모서리 기둥. 서쪽과 남쪽으로 구간이 뻗는다.', rules='중앙 구멍 북동 모서리.', tags=['난간', '모서리'], role='fence')
def _cne(c): _corner(c, False, True)


@REG.piece('wz-owl-rail-corner-sw', '난간 모서리(남서)', 1, 1, ['S'], 'furniture', SP,
           desc='난간 모서리 기둥. 동쪽과 북쪽으로 구간이 뻗는다.', rules='중앙 구멍 남서 모서리.', tags=['난간', '모서리'], role='fence')
def _csw(c): _corner(c, True, False)


@REG.piece('wz-owl-rail-corner-se', '난간 모서리(남동)', 1, 1, ['S'], 'furniture', SP,
           desc='난간 모서리 기둥. 서쪽과 북쪽으로 구간이 뻗는다.', rules='중앙 구멍 남동 모서리.', tags=['난간', '모서리'], role='fence')
def _cse(c): _corner(c, False, False)


# ───────────────────────── 횃대 ─────────────────────────
def _bar(c, x0, x1, y, ring=True):
    for x in range(x0, x1 + 1):
        c.P(x, y - 1, K('wood', 1))
        c.P(x, y, K('wood', 5)); c.P(x, y + 1, K('wood', 4)); c.P(x, y + 2, K('wood', 3)); c.P(x, y + 3, K('wood', 1))
        if hsh(x, y, 6) < 0.15: c.P(x, y + 1, K('wood', 3))
    c.P(x0, y, K('wood', 1)); c.P(x0, y + 2, K('wood', 1)); c.P(x1, y, K('wood', 1)); c.P(x1, y + 2, K('wood', 2))
    c.P(x1, y + 1, K('wood', 2))
    # 끈 묶음
    c.VL(x0 + 2, y, 3, K('linen', 3)); c.VL(x1 - 2, y, 3, K('linen', 3))


def _post_v(c, cx, y0, y1):
    for y in range(y0, y1 + 1):
        c.P(cx - 2, y, K('wood', 1)); c.P(cx - 1, y, K('wood', 4)); c.P(cx, y, K('wood', 3)); c.P(cx + 1, y, K('wood', 2)); c.P(cx + 2, y, K('wood', 1))
        if hsh(y, 7, 3) < 0.2: c.P(cx - 1, y, K('wood', 3))
    c.P(cx - 1, y0, K('wood', 5)); c.P(cx, y0, K('wood', 4))


def _foot(c, cx, y, w):
    for yy in range(y, y + 6):
        for xx in range(cx - w, cx + w + 1):
            dx = xx - cx
            if yy < y + 3:
                col = K('wood', 5) if yy == y else K('wood', 4)
            else:
                col = K('wood', 3) if dx < w - 2 else K('wood', 2)
            c.P(xx, yy, col)
    c.HL(cx - w, y + 6, 2 * w + 1, K('wood', 1)); c.HL(cx - w + 1, y - 1, 2 * w - 1, K('wood', 1))
    c.VL(cx - w - 1, y, 6, K('wood', 1)); c.VL(cx + w + 1, y, 6, K('wood', 1))


def _droppings_on(c, pts):
    for (x, y) in pts:
        c.P(x, y, K('linen', 4)); c.P(x + 1, y, K('linen', 3)); c.P(x, y + 1, K('linen', 2))


@REG.piece('wz-owl-perch-1x3', '올빼미 횃대(1×3)', 1, 3, ['C', 'C', 'S'], 'furniture', SP,
           desc='나무 기둥에 가로 횃대 3단을 건 올빼미 횃대 1×3. 위 두 칸은 머리 위(통행), 밑동만 막는다.',
           rules='창가·탑 벽 앞 바닥에 놓는다. 아래 바닥에 새똥·깃털 덧그림을 곁들인다.', tags=['횃대', '올빼미'], role='prop')
def _p13(c):
    _post_v(c, 8, 4, 40)
    _bar(c, 0, 15, 8); _bar(c, 2, 13, 20); _bar(c, 0, 15, 31)
    _droppings_on(c, [(3, 9), (11, 21), (5, 32)])
    _foot(c, 8, 40, 6)
    c.R(6, 42, 5, 3, K('wood', 2)) if False else None


@REG.piece('wz-owl-perch-2x3', '올빼미 횃대(2×3)', 2, 3, ['CC', 'CC', 'SS'], 'furniture', SP,
           desc='가운데 기둥에 긴 가로 횃대 3단을 건 큰 올빼미 횃대 2×3.', rules='탑 안쪽 중앙·벽 앞에 놓는다.', tags=['횃대', '올빼미'], role='prop')
def _p23(c):
    _post_v(c, 16, 4, 40)
    _bar(c, 2, 29, 8); _bar(c, 4, 27, 19); _bar(c, 2, 29, 30)
    c.line(16, 13, 6, 19, K('wood', 2)); c.line(16, 13, 26, 19, K('wood', 2))
    _droppings_on(c, [(7, 9), (22, 20), (11, 31), (26, 31)])
    _foot(c, 16, 40, 9)


# ───────────────────────── 소품 ─────────────────────────
@REG.piece('wz-owl-water-dish', '올빼미 물그릇', 1, 1, ['S'], 'furniture', SP,
           desc='얕은 돌 그릇에 물이 담긴 올빼미 물그릇 1×1.', rules='횃대 곁 바닥에 놓는다.', tags=['물그릇'], role='prop')
def _dish(c):
    c.ellipse(8, 12, 6.5, 3, K(ST, 2))
    c.R(2, 8, 13, 4, K(ST, 3)); c.VL(2, 8, 4, K(ST, 4)); c.VL(14, 8, 4, K(ST, 2))
    c.ellipse(8, 11.5, 6.5, 3, K(ST, 3), True)
    c.R(2, 8, 13, 3, K(ST, 3)); c.VL(2, 8, 3, K(ST, 4)); c.VL(14, 8, 3, K(ST, 2))
    c.ellipse(8, 8, 7, 3.5, K(ST, 5))
    c.ellipse(8, 8.5, 5.5, 2.5, K(ST, 2))
    c.ellipse(8, 8.5, 4.5, 2, K('water', 3))
    c.HL(5, 8, 4, K('water', 4)); c.P(6, 7, K('water', 5)); c.P(10, 9, K('water', 2)); c.P(11, 8, K('water', 2))
    c.outline()


def _env(c, x, y, w=8, h=5, tilt=0, wax=True):
    c.R(x, y, w, h, K('linen', 5))
    c.HL(x, y, w, K('linen', 4) if False else K('linen', 5))
    c.line(x, y, x + w // 2, y + h // 2, K('linen', 3)); c.line(x + w - 1, y, x + w // 2, y + h // 2, K('linen', 3))
    c.HL(x, y + h - 1, w, K('linen', 3)); c.VL(x + w - 1, y, h, K('linen', 3))
    c.outline_rect(x - 1, y - 1, w + 2, h + 2, K('dirt', 1)) if False else None
    c.HL(x - 1, y - 1, w + 2, K('linen', 1)); c.HL(x - 1, y + h, w + 2, K('linen', 1)); c.VL(x - 1, y, h, K('linen', 1)); c.VL(x + w, y, h, K('linen', 1))
    if wax:
        c.P(x + w // 2, y + h // 2, K('red', 3)); c.P(x + w // 2 - 1, y + h // 2, K('red', 4)); c.P(x + w // 2, y + h // 2 + 1, K('red', 2))


@REG.piece('wz-owl-letters', '봉인된 편지 더미', 1, 1, ['f'], 'furniture', SP,
           desc='붉은 밀랍으로 봉인된 편지 몇 통이 쌓인 더미 1×1(바닥 덧그림).', rules='우편함·횃대 옆 바닥이나 선반 위에.', tags=['편지', '우편'], role='prop')
def _let(c):
    _env(c, 2, 8, 9, 5); _env(c, 5, 5, 9, 5); _env(c, 1, 3, 8, 5, wax=True)
    c.P(12, 11, K('red', 3)); c.R(10, 12, 4, 2, K('linen', 4)); c.HL(10, 12, 4, K('linen', 5))


@REG.piece('wz-owl-mail-sack', '우편 자루', 1, 1, ['S'], 'furniture', SP,
           desc='주둥이를 묶은 삼베 우편 자루 1×1, 편지 끝이 삐져나와 있다.', rules='우편함 곁 바닥에.', tags=['자루', '우편'], role='prop')
def _sack(c):
    c.ellipse(8, 10.5, 6.5, 4.5, K('dirt', 5))
    c.ellipse(8, 11, 6, 4, K('dirt', 5))
    for y in range(7, 15):
        for x in range(1, 15):
            if c.opaque(x, y):
                col = K('dirt', 5)
                if x >= 10: col = K('dirt', 4)
                if x >= 12: col = K('dirt', 3)
                if y >= 13: col = K('dirt', 3)
                if x <= 3 and y < 12: col = K('dirt', 5)
                c.P(x, y, col)
    for (x, y) in ((5, 10), (6, 11), (9, 9), (4, 12), (8, 13)): c.P(x, y, K('dirt', 4))
    c.R(6, 3, 5, 5, K('dirt', 5)); c.VL(10, 3, 5, K('dirt', 4)); c.VL(6, 3, 5, K('dirt', 5))
    c.HL(5, 7, 7, K('linen', 3)); c.HL(5, 8, 7, K('linen', 2)); c.P(6, 8, K('linen', 4))
    _env(c, 7, 0, 4, 3, wax=False) if False else None
    c.R(7, 1, 3, 2, K('linen', 5)); c.P(8, 1, K('red', 3)); c.HL(7, 3, 3, K('linen', 2))
    c.outline()


@REG.piece('wz-owl-straw', '짚 더미', 1, 1, ['f'], 'furniture', SP,
           desc='바닥에 쌓인 노란 짚 더미 1×1(바닥 덧그림).', rules='횃대 아래·창가 바닥에 깐다.', tags=['짚'], role='terrain')
def _straw(c):
    # 둔덕: 불규칙 실루엣(가장자리 흔들림) · 왼쪽 위 밝은 윗면 · 아래 3~4px 어두운 앞면 · 긴 결 · 튀어나온 가닥
    m = set()
    for y in range(3, 15):
        for x in range(1, 15):
            dx = (x - 7.5) / 6.6; dy = (y - 9.0) / 5.0
            j = (hsh(x, y, 31) - 0.5) * 0.35
            if dx * dx + dy * dy <= 1.0 + j: m.add((x, y))
    ybot = {}
    for (x, y) in m: ybot[x] = max(ybot.get(x, -1), y)
    for (x, y) in m:
        d = ybot[x] - y
        if d == 0: col = K('brass', 1)
        elif d <= 2: col = K('brass', 2)
        elif d == 3: col = K('brass', 3) if (x + y) % 3 else K('brass', 2)
        else:
            u = (x - 5.5) / 5.0; v = (y - 6.5) / 3.2
            col = K('brass', 4) if u * u + v * v <= 1.0 else K('brass', 3)
        c.P(x, y, col)
    # 윗면 긴 결(3~5px): 밝은 결은 왼쪽, 그늘 결은 오른쪽
    for (x0, y0, x1, y1, k) in ((3, 6, 7, 5, 5), (4, 8, 8, 7, 5), (6, 4, 9, 4, 5), (9, 7, 12, 8, 2), (8, 9, 12, 10, 2), (2, 9, 5, 9, 5)):
        c.line(x0, y0, x1, y1, K('brass', k))
    # 앞면: 아래로 늘어진 줄기 결
    for (x, k) in ((3, 3), (6, 3), (9, 1), (12, 1)):
        yb = ybot.get(x)
        if yb: c.P(x, yb - 2, K('brass', k)); c.P(x, yb - 1, K('brass', k if k == 1 else 2))
    # 바깥으로 튀어나온 짚 가닥 1px(여러 방향, 실루엣 깨기)
    for (pts, k) in (([(1, 6), (0, 5)], 4), ([(4, 2), (3, 1)], 4), ([(9, 2), (10, 1)], 5), ([(14, 6), (15, 5)], 3),
                     ([(15, 10)], 2), ([(0, 11), (1, 12)], 3), ([(13, 14), (14, 15)], 1), ([(6, 15)], 2)):
        for (x, y) in pts:
            if (x, y) not in m: c.P(x, y, K('brass', k))


@REG.piece('wz-owl-mailbox', '우편 분류함(2×2)', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='오크 칸막이 우편 분류함 2×2. 칸 6개(3×2)마다 편지가 꽂혀 있다.', rules='탑 북벽 앞에 붙인다.', tags=['우편함', '분류함'], role='prop')
def _mbox(c):
    c.R(1, 3, 30, 6, K('wood', 5)); c.HL(1, 3, 30, K('wood', 5)); c.R(1, 8, 30, 1, K('wood', 4))
    c.R(1, 9, 30, 19, K('wood', 3)); c.R(1, 9, 1, 19, K('wood', 4)); c.VL(30, 9, 19, K('wood', 2))
    c.R(1, 28, 30, 3, K('wood', 2)); c.HL(1, 30, 30, K('wood', 1))
    for r in range(2):
        for k in range(3):
            x = 3 + k * 9; y = 11 + r * 8
            c.R(x, y, 8, 7, K('wood', 1)); c.HL(x, y, 8, K('wood', 2))
            c.R(x + 1, y + 2, 5, 5, K('linen', 5) if (r + k) % 2 == 0 else K('linen', 4))
            c.HL(x + 1, y + 2, 5, K('linen', 3)); c.P(x + 3, y + 4, K('red', 3))
            if (r * 3 + k) % 3 == 1:
                c.R(x + 2, y + 1, 4, 2, K('linen', 5)); c.P(x + 4, y + 2, K('red', 2))
    for x in (2, 11, 20, 29): c.VL(x, 11, 16, K('wood', 4) if x < 29 else K('wood', 2))
    c.HL(2, 19, 28, K('wood', 4))
    c.outline_rect(1, 2, 30, 29, K('wood', 1)) if False else None
    c.outline()


# ───────────────────────── 계단 ─────────────────────────
def _stair_up(c):
    """정면으로 오르는 돌계단: 단마다 디딤판 3px(밝게)+코 그림자 1px+챌판 4px. 위로 갈수록 좁고 밝다.
    좌우 옆벽은 단마다 넓어져 안쪽 윤곽이 지그재그로 꺾인다."""
    c.R(0, 0, 32, 32, K(ST, 1))
    tread = {0: (4, 5, 5), 1: (4, 5, 5), 2: (3, 4, 5), 3: (3, 4, 4)}
    riser = {0: 3, 1: 3, 2: 3, 3: 2}
    for i in range(4):
        y0 = i * 8
        e = 3 + (3 - i)            # 옆벽 폭(위 단일수록 넓다)
        for x in range(e, 32 - e):
            for r, t in enumerate(tread[i]):
                col = K(ST, t)
                if x == e: col = K(ST, min(5, t + 1))
                elif x >= 32 - e - 2: col = K(ST, t - 1)
                c.P(x, y0 + r, col)
            c.P(x, y0 + 3, K(ST, 1))                     # 코 그림자
            for y in range(y0 + 4, y0 + 8):
                col = K(ST, riser[i] if y < y0 + 7 else riser[i] - 1)
                if x >= 32 - e - 2: col = K(ST, riser[i] - 1)
                c.P(x, y, col)
            if hsh(x, i, 4) < 0.07 and e < x < 32 - e - 3: c.P(x, y0 + 1, K(ST, tread[i][1] - 1))   # 드문 마모점
        for jx in ((9 + 7 * i) % 13 + e + 2, (17 + 5 * i) % 9 + 16):      # 챌판 석재 이음
            if e < jx < 32 - e - 1: c.VL(jx, y0 + 4, 3, K(ST, riser[i] - 1))
        # 옆벽: 단마다 위 3px 갓돌(윗면) + 아래 앞면, 안쪽 모서리 진하게
        for x in list(range(0, e)) + list(range(32 - e, 32)):
            left = x < e
            for y in range(y0, y0 + 8):
                if y < y0 + 3: col = K(ST, 4 if left else 3)
                elif y == y0 + 3: col = K(ST, 2)
                else: col = K(ST, 3 if left else 2)
                if y == y0: col = K(ST, 5 if left else 4)
                c.P(x, y, col)
        c.VL(e - 1, y0, 8, K(ST, 2)); c.VL(32 - e, y0, 8, K(ST, 1))
        c.P(e - 1, y0 + 3, K(ST, 1))
    c.VL(0, 0, 32, K(ST, 1)); c.VL(31, 0, 32, K(ST, 1))
    c.VL(1, 0, 32, K(ST, 4)); c.HL(0, 31, 32, K(ST, 1))


def _stair_down(c):
    """바닥에 뚫린 내려가는 계단: 둘레 바닥 테두리(밝은 1px 가장자리), 단마다 밝은 디딤판+코 그림자,
    북쪽(위)으로 갈수록 어둡고, 좌우 안쪽 벽은 단마다 넓어져 지그재그."""
    c.R(0, 0, 32, 32, K(ST, 0))
    # 둘레 테두리(바닥 높이)
    for y in range(32):
        for x in range(32):
            if x <= 2 or x >= 29 or y <= 1 or y >= 28:
                col = K(ST, 3)
                if (x + 3 * (y // 8)) % 11 == 0 and y % 8 != 7: col = K(ST, 2)
                if y % 8 == 7 and (x <= 2 or x >= 29): col = K(ST, 2)
                c.P(x, y, col)
    c.HL(2, 1, 28, K(ST, 4)); c.HL(0, 0, 32, K(ST, 2))
    c.VL(2, 1, 28, K(ST, 5)); c.VL(29, 1, 28, K(ST, 4))
    c.HL(2, 28, 28, K(ST, 5)); c.HL(0, 31, 32, K(ST, 2))
    c.VL(0, 0, 32, K(ST, 2)); c.VL(31, 0, 32, K(ST, 2))
    # 북쪽 안벽(구멍 너머 벽 정면, 가장 어둡다)
    c.R(3, 2, 26, 3, K('night', 0)); c.HL(3, 2, 26, K(ST, 1))
    tone = {0: (1, 2), 1: (2, 3), 2: (3, 4), 3: (4, 5)}      # (디딤판, 코 밝은 가장자리)
    for i in range(4):
        y0 = 5 + 6 * i
        hh = 6 if i < 3 else 5
        t, hi = tone[i]
        w = 1 + (3 - i)              # 안쪽 옆벽 폭(깊을수록 넓다)
        for y in range(y0, y0 + hh):
            for x in range(3, 29):
                if x < 3 + w: col = K('night', 0) if i < 2 else K(ST, 0)
                elif x > 28 - w: col = K(ST, 1) if i < 2 else K(ST, 2)
                else:
                    r = y - y0
                    col = K(ST, hi) if r == 0 else (K(ST, max(0, t - 2)) if r == hh - 1 else K(ST, t))
                    if r in (1, 2, 3, 4) and x >= 28 - w - 1: col = K(ST, max(0, t - 1))
                c.P(x, y, col)
        c.VL(3 + w, y0 + 1, hh - 2, K(ST, max(0, t - 1)))          # 옆벽과 디딤판 사이 그늘
        c.P(3 + w - 1, y0, K(ST, 1)); c.P(28 - w + 1, y0, K(ST, 2) if i >= 2 else K(ST, 1))
        jx = (11, 19, 14, 22)[i]
        c.VL(jx, y0 + 1, hh - 2, K(ST, max(0, t - 1)))     # 석판 이음(단마다 다른 자리)


@REG.piece('wz-owl-stair-up', '탑 계단(위, 정면)', 2, 2, ['FF', 'FF'], 'architecture', SP,
           desc='정면으로 오르는 직선 돌계단 2×2(나선 아님). 디딤판 8px 4단. 위로.', rules='탑 벽 앞이나 중앙 공터 가장자리에 붙인다.',
           tags=['계단', '위'], role='terrain')
def _su(c): _stair_up(c)


@REG.piece('wz-owl-stair-down', '탑 계단(아래, 정면)', 2, 2, ['FF', 'FF'], 'architecture', SP,
           desc='정면으로 내려가는 직선 돌계단 2×2. 아래로 갈수록 어두워진다.', rules='탑 벽 앞에 붙인다.', tags=['계단', '아래'], role='terrain')
def _sd(c): _stair_down(c)


# ───────────────────────── 문(3상태) ─────────────────────────
def _door_cut(x, y):
    """문 구멍(안): x 2..13, y 24..63, 위쪽 모서리 둥글게."""
    if y < 24 or x < 2 or x > 13: return False
    if y < 28:
        return not ((x in (2, 13) and y < 26) or (x in (3, 12) and y < 25) or (x in (2, 13) and y == 26 and False))
    return True


def _door_frame(c):
    for y in range(18, 64):
        for x in range(0, 16):
            if not _door_cut(x, y) and (_door_cut(x, y + 0) or True):
                pass
    # 돌 문틀: 구멍 둘레 2px 밝은 돌 + 위 이마돌
    for y in range(20, 64):
        for x in range(0, 16):
            if _door_cut(x, y): continue
            near = any(_door_cut(x + dx, y + dy) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
            if near:
                col = K(ST, 5) if (x < 8 or y < 24) else K(ST, 4)
                if (x + y // 4) % 7 == 0: col = K(ST, 4)
                c.P(x, y, col)
    for y in range(20, 64):
        for x in range(0, 16):
            if _door_cut(x, y): continue
            nb = [(x + 1, y), (x - 1, y), (x, y - 1), (x, y + 1)]
            if c.opaque(x, y) and any(_door_cut(*q) for q in nb): c.P(x, y, K(ST, 2))


def _door_leaf(c, locked=False):
    for y in range(24, 62):
        for x in range(2, 14):
            if not _door_cut(x, y): continue
            col = K('wood', 4) if x % 3 != 2 else K('wood', 2)
            if x % 3 == 0: col = K('wood', 5)
            c.P(x, y, col)
    for y in range(24, 62):
        for x in range(2, 14):
            if not _door_cut(x, y): continue
            if x % 3 == 2: c.P(x, y, K('wood', 2))
    for y in (31, 49):
        for x in range(2, 14):
            c.P(x, y, K('iron', 3)); c.P(x, y + 1, K('iron', 2)); c.P(x, y + 2, K('iron', 1))
        c.P(3, y, K('iron', 5)); c.P(12, y, K('iron', 5)); c.P(3, y + 1, K('iron', 4)); c.P(12, y + 1, K('iron', 4))
    c.P(11, 41, K('iron', 5)); c.P(11, 42, K('iron', 3)); c.P(10, 42, K('iron', 3)); c.P(10, 43, K('iron', 2)); c.P(11, 43, K('iron', 2))
    for y in range(24, 62): c.P(2, y, K('wood', 5)) if _door_cut(2, y) else None
    c.HL(2, 61, 12, K('wood', 1))
    if locked:
        c.R(2, 38, 12, 2, K('iron', 4)); c.HL(2, 38, 12, K('iron', 5)); c.HL(2, 40, 12, K('iron', 1))
        c.R(6, 42, 5, 5, K('brass', 4)); c.HL(6, 42, 5, K('brass', 5)); c.VL(10, 42, 5, K('brass', 2)); c.HL(6, 47, 5, K('brass', 1))
        c.HL(7, 40, 3, K('brass', 3)); c.VL(7, 39, 3, K('iron', 3)); c.VL(9, 39, 3, K('iron', 3)); c.P(8, 44, K('brass', 1))


@REG.piece('wz-owl-door-closed', '탑 문(닫힘)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='탑 벽돌에 끼운 석재 문틀의 오크 판문 1×4. 닫힘.', rules='북벽에 끼운다. 상태 묶음 owl-door.', tags=['문'], role='wall', states='owl-door')
def _dc(c):
    _wall_n_draw(c); _door_frame(c); _door_leaf(c)


@REG.piece('wz-owl-door-open', '탑 문(열림)', 1, 4, ['S', 'C', 'C', 'C'], 'architecture', SP,
           desc='문이 안쪽으로 열려 어두운 계단통이 보인다. 통행.', rules='열린 칸은 통행. 상태 묶음 owl-door.', tags=['문'], role='wall', states='owl-door')
def _do(c):
    _wall_n_draw(c); _door_frame(c)
    for y in range(24, 64):
        for x in range(2, 14):
            if _door_cut(x, y):
                c.P(x, y, OL2 if y < 56 else K(ST, 2))
    for y in range(26, 62):
        c.P(3, y, K('wood', 3)); c.P(2, y, K('wood', 5)); c.P(4, y, K('wood', 2))
    for y in range(58, 64):
        for x in range(2, 14):
            if _door_cut(x, y): c.P(x, y, K(ST, 3) if y % 2 else K(ST, 2))
    c.P(5, 34, K('iron', 3)); c.P(5, 50, K('iron', 3))


@REG.piece('wz-owl-door-locked', '탑 문(잠김)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='닫힌 문에 쇠 가로막대와 황동 자물쇠. 잠김.', rules='상태 묶음 owl-door.', tags=['문', '잠김'], role='wall', states='owl-door')
def _dl(c):
    _wall_n_draw(c); _door_frame(c); _door_leaf(c, True)


# ───────────────────────── 예제: 둥근 탑 안 ─────────────────────────
def _tower_place():
    P = []
    A = P.append
    # 바닥(탑 안쪽만) — 바깥은 floor 인 wz-owl-void
    for y in range(1, 15):
        L = max(1, 6 - y) if y <= 5 else (1 if y <= 9 else y - 8)
        L = min(L, 5)
        for x in range(L, 16 - L):
            A(('wz-owl-floor', x, y))
    # 중앙 난간 둘레 포석 띠
    for x in range(4, 12):
        A(('wz-owl-floor-band', x, 5)); A(('wz-owl-floor-band', x, 12))
    for y in range(6, 12):
        A(('wz-owl-floor-band-v', 4, y)); A(('wz-owl-floor-band-v', 11, y))
    for y in range(7, 11):
        for x in range(6, 10): A(('wz-owl-pit', x, y))
    # 바닥 덧칠
    for (p, x, y) in (('feathers', 7, 12), ('droppings', 3, 8), ('pellets', 12, 11), ('feathers', 10, 5), ('droppings', 8, 5),
                      ('straw', 6, 5), ('straw', 9, 5), ('pellets', 3, 11), ('feathers', 12, 6), ('letters', 4, 9), ('straw', 11, 10)):
        A(('wz-owl-' + p, x, y))
    # 가구
    A(('wz-owl-stair-down', 2, 6)); A(('wz-owl-mailbox', 2, 8)); A(('wz-owl-mail-sack', 4, 10)); A(('wz-owl-water-dish', 11, 7))
    A(('wz-owl-stair-up', 11, 5))
    A(('wz-owl-perch-1x3', 11, 8)); A(('wz-owl-perch-2x3', 12, 7))
    # 난간
    A(('wz-owl-rail-corner-nw', 5, 6)); A(('wz-owl-rail-corner-ne', 10, 6)); A(('wz-owl-rail-corner-sw', 5, 11)); A(('wz-owl-rail-corner-se', 10, 11))
    for x in range(6, 10): A(('wz-owl-rail-h', x, 6)); A(('wz-owl-rail-h', x, 11))
    for y in range(7, 11): A(('wz-owl-rail-v', 5, y)); A(('wz-owl-rail-v', 10, y))
    # 둥근 벽: 북 직선(5~10) 뒤 → 대각 → 옆 → 남 직선
    top = ['wz-owl-wall-n', 'wz-owl-window', 'wz-owl-wall-n-beam', 'wz-owl-door-closed', 'wz-owl-window-bare', 'wz-owl-wall-n-stained']
    for i, p in enumerate(top): A((p, 5 + i, 1))
    for i in range(4):
        A(('wz-owl-wall-nw', 4 - i, 1 + i)); A(('wz-owl-wall-ne', 11 + i, 1 + i))
    for y in (7, 8): A(('wz-owl-wall-w', 1, y)); A(('wz-owl-wall-e', 14, y))
    for i in range(4):
        A(('wz-owl-wall-sw', 1 + i, 9 + i)); A(('wz-owl-wall-se', 14 - i, 9 + i))
    for x in range(5, 11): A(('wz-owl-wall-s', x, 13))
    return P


REG.example('wz-owl-example-tower', '올빼미탑 예제', SP, 16, 16, 'wz-owl-void', _tower_place(),
            desc='지름 14칸 둥근 탑 안. 계단식 곡선 벽, 비행 창, 문, 횃대, 우편함, 중앙 난간과 빈 구멍, 위·아래 계단.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
