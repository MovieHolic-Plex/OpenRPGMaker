"""sf_station 줄 B(사이버 네온 거리) 조각 v2 — Opus 손 도트 다시 그리기(2026-10-14). 같은 id 로 Sonnet 초안(sf_base·sf_street)을 대신한다.
건물 문법: 사다리꼴 옥상(난간 턱 + 장비·물탱크·환기, 그림자 떨어뜨림) + 층 띠 있는 판 벽(texture_face) + 창(window: 꺼진 창 다수·따뜻한 불빛 일부)
         + 창 밑 실외기 + 옆으로 튀어나온 세로 간판(글자 없는 도형) 빛 번짐 + 1층 상가(진열창·차양·문). 네온은 램프 2~3단 + 벽 번짐(halo)."""
from sf_kit import *
from sf2_outdoor import roof_unit, roof_grille

S = dict(group='street', line='B')
NEON = ('magenta', 'cyan', 'violet', 'orange')


def ac_unit(c, x, y):
    """창 밑 실외기: 작은 상자(윗면 + 팬 원)."""
    c.R(x, y, 6, 1, K('hull', 2)); c.R(x, y + 1, 6, 3, K('hull', -1)); c.ell(x + 2, y + 2, 1, 1, K('cable', 0)); c.HL(x, y + 4, 6, K('shadow', 1))


def blade_sign(c, x, y, h, col, under, s=0):
    """옆으로 튀어나온 세로 간판(글자 없는 도형 띠): 어두운 판 + 램프 테 + 안쪽 막대·점 무늬 + 벽 빛 번짐."""
    halo(c, x, y, 6, h, col, under, r=2)
    c.R(x, y, 6, h, K('cable', -1)); c.VL(x, y, h, K(col, 3)); c.VL(x + 5, y, h, K(col, 1)); c.HL(x, y, 6, K(col, 3)); c.HL(x, y + h - 1, 6, K(col, 0))
    for j in range(y + 2, y + h - 2, 3):
        k = hsh(j, s, 2) % 3
        if k == 0: c.HL(x + 2, j, 2, K(col, 2))
        elif k == 1: c.P(x + 2, j, K(col, 3)); c.P(x + 3, j + 1, K(col, 2))
        else: c.HL(x + 1, j, 4, K(col, 1))
    c.R(x + 6, y + 2, 1, 2, K('hull', 0)); c.R(x + 6, y + h - 4, 1, 2, K('hull', 0))   # 벽 고정쇠


def vneon(c, x, y, h, col, under):
    """벽에 붙은 세로 네온 관: 번짐 + 밝은 심 + 어두운 끝."""
    halo(c, x, y, 2, h, col, under, r=2)
    c.R(x, y, 2, h, K(col, 1)); c.VL(x, y, h, K(col, 3)); c.P(x, y, K(col, 0)); c.P(x, y + h - 1, K(col, 0))


def storefront(c, x, y, w, h, col, wall, ft, door_col='cyan', awn=None, s=0):
    """1층 상가: 어두운 틀 + 진열창(안쪽 빛 + 진열 상품 점) + 가운데 문 + 차양(위)."""
    c.R(x, y, w, h, K('cable', -1)); c.HL(x, y, w, K(wall, ft - 2))
    dw = 8; dx = x + w // 2 - dw // 2
    for sx, sw in ((x + 1, dx - x - 2), (dx + dw + 1, x + w - (dx + dw + 1) - 1)):
        if sw < 3: continue
        for j in range(h - 2):
            c.HL(sx, y + 1 + j, sw, K(col, 2 if j == 0 else 1 if j < h - 4 else 0))
        for k in range(sw // 3):
            px = sx + 1 + k * 3
            if px < sx + sw - 1: c.R(px, y + h - 4, 2, 2, K(NEON[(k + s) % 4], 3 if k % 2 else 2))
        c.line(sx + 1, y + h - 3, sx + min(sw - 1, 5), y + 2, K('glow', 0)) if sw > 6 else None
    c.R(dx, y + 1, dw, h - 1, K('glass', -1)); c.R(dx + 1, y + 2, dw - 2, h - 2, K(door_col, -1)); c.HL(dx + 1, y + 2, dw - 2, K(door_col, 2)); c.VL(dx + dw // 2, y + 2, h - 2, K('cable', -1))
    if awn:
        c.R(x - 1, y - 3, w + 2, 3, K(awn, 2)); c.HL(x - 1, y - 3, w + 2, K(awn, 3))
        for i in range(x - 1, x + w + 1, 4): c.R(i, y, 2, 1, K(awn, 0))
        c.HL(x - 1, y - 1, w + 2, K(awn, -1))


def tower(c, W, H, roof, ins, wall, floors, cols, accent, accent2, s=0, ft=-2, roofmat='conc', shop_col='orange', awn='magenta', blades=True, ac=True, door_col='cyan', top_items=None):
    """네온 거리 고층: W,H 픽셀. floors×cols 창. 옥상 장비는 top_items(None 이면 기본 셋)."""
    x0, w = 1, W - 2
    front = H - 2 - roof
    tcube(c, x0, 1, w, roof, front, wall, ins=ins, tt=2, ft=ft, topmat=roofmat, ol=False, s=s)
    c.HL(x0 + ins, 1, w - 2 * ins, K(roofmat, 3))
    for r in range(1, roof - 1):
        l = int(round(ins * (1 - r / max(1, roof - 1)))); c.P(x0 + l + 1, 1 + r, K(roofmat, 3)); c.P(x0 + w - l - 2, 1 + r, K(roofmat, 0))
    fy = 1 + roof
    shop_h = 13
    body_h = front - shop_h - 6
    fh = max(9, body_h // floors)
    texture_face(c, x0, fy + 1, w, front - 1, wall, ft, seam=0, band=fh, seed=s, grime=4, light=2)
    under = {K(wall, ft + d) for d in (-2, -1, 0, 1, 2)}
    neon_top = fy + 1
    c.HL(x0, neon_top, w, K(accent, 2)); c.HL(x0, neon_top + 1, w, K(accent, -1))   # 옥상 턱 아래 네온 띠
    cw = (w - 16) // cols
    ww = max(4, cw - 4); wh = max(4, fh - 5)
    for f in range(floors):
        for q in range(cols):
            wx = x0 + 8 + q * cw + (cw - ww) // 2; wy = fy + 4 + f * fh
            v = hsh(q, f, s)
            col = None if v % 100 < 45 else ('orange' if (v >> 5) % 3 else (accent2 if (v >> 7) % 2 else 'yellow'))
            window(c, wx, wy, ww, wh, col, seed=v, sill=K(wall, ft + 2), blinds=bool((v >> 9) % 3 == 0))
            if ac and (v >> 11) % 4 == 0 and wy + wh + 2 < fy + front - shop_h - 4: ac_unit(c, wx + (ww - 6) // 2, wy + wh + 2)
    if blades:
        blade_sign(c, x0 + 1, fy + 6, min(30, body_h - 4), accent, under, s)
        blade_sign(c, x0 + w - 7, fy + 10, min(24, body_h - 8), accent2, under, s + 1)
    sy = fy + front - shop_h - 2
    storefront(c, x0 + 3, sy + 3, w - 6, shop_h - 2, shop_col, wall, ft, door_col, awn, s)
    c.HL(x0, fy + front - 2, w, K('conc', 1)); c.HL(x0, fy + front - 1, w, K('conc', -2))
    # 옥상 장비
    items = top_items if top_items is not None else [('unit', 0.15, 0.25), ('tank', 0.6, 0.3), ('grille', 0.35, 0.5)]
    for kind, fx, fy_ in items:
        ix = x0 + int(w * fx); iy = 2 + int((roof - 2) * fy_)
        if kind == 'unit': roof_unit(c, ix, iy, 12, 4, 3, 'hull', roofmat)
        elif kind == 'tank': cyl(c, ix + 4, iy + 2, 4, 2, 4, 'rust', tt=2, ft=0, ol=False); c.R(ix + 1, iy + 9, 8, 1, K(roofmat, -1))
        elif kind == 'grille': roof_grille(c, ix, iy, 10, 4, roofmat)
        elif kind == 'sign': 
            box2(c, ix, iy, 18, 3, 5, 'navy', topmat=accent, tt=1, ft=-1); c.HL(ix + 1, iy + 4, 16, K(accent, 3)); c.R(ix + 2, iy + 5, 14, 2, K(accent, 1))
        elif kind == 'dish': c.ell(ix + 3, iy + 2, 3, 2, K('white', 2)); c.P(ix + 3, iy + 2, K('hull', 0)); c.R(ix + 2, iy + 4, 2, 3, K('hull', 0))
    return fy, front


@piece2('street-tower-s', '소형 네온 타워(옥상 장비 + 층 띠 판 벽 + 창·실외기 + 세로 간판 + 1층 상가)', 4, 6, 'structure', solid=[(x, y) for x in range(4) for y in (4, 5)], tags=['건물', '타워', '네온'], desc='거리 소형 고층. 문은 1층 가운데.', **S)
def _(c): tower(c, 64, 96, 16, 6, 'navy', 4, 3, 'magenta', 'cyan', s=1); c.outline()


@piece2('street-tower-m', '중형 네온 타워(옥상 간판 슬랩 + 창 격자 + 세로 간판 둘 + 1층 상가)', 5, 8, 'structure', solid=[(x, y) for x in range(5) for y in (6, 7)], tags=['건물', '타워', '네온'], desc='거리 중형 고층. 문은 1층 가운데.', **S)
def _(c): tower(c, 80, 128, 18, 7, 'violet', 6, 4, 'cyan', 'magenta', s=2, top_items=[('sign', .3, .15), ('tank', .72, .35), ('grille', .08, .45)]); c.outline()


@piece2('street-tower-l', '대형 네온 타워(넓은 옥상 장비 + 층층 창 + 세로 간판 + 1층 상가)', 6, 10, 'structure', solid=[(x, y) for x in range(6) for y in (8, 9)], tags=['건물', '타워', '네온'], desc='거리 대형 고층. 문은 1층 가운데.', **S)
def _(c): tower(c, 96, 160, 20, 8, 'navy', 8, 5, 'magenta', 'orange', s=3, top_items=[('unit', .12, .2), ('sign', .45, .1), ('tank', .78, .35), ('dish', .3, .55)]); c.outline()


@piece2('street-apartment', '네온 아파트 블록(옥상 물탱크 + 발코니 난간 창 + 빨래 없는 실외기 + 1층 상가)', 5, 6, 'structure', solid=[(x, y) for x in range(5) for y in (4, 5)], tags=['건물', '아파트'], desc='주거 블록. 문은 1층 가운데.', **S)
def _(c):
    fy, front = tower(c, 80, 96, 16, 6, 'conc', 4, 4, 'orange', 'violet', s=4, ft=-1, blades=False, awn='orange', shop_col='cyan', top_items=[('tank', .1, .2), ('unit', .55, .25), ('grille', .3, .6)])
    for f in range(4):
        y = fy + 4 + f * ((front - 19) // 4) + 7
        c.HL(6, y, 68, K('conc', 3)); c.HL(6, y + 1, 68, K('conc', -2))
        for x in range(6, 74, 3): c.P(x, y - 1, K('conc', 2))
    c.outline()


@piece2('street-capsule-hotel', '캡슐 호텔(깊은 옥상 + 작은 둥근 캡슐 창 격자 + 1층 로비)', 5, 5, 'structure', solid=[(x, y) for x in range(5) for y in (3, 4)], tags=['건물', '호텔'], desc='캡슐 호텔. 문은 1층 가운데.', **S)
def _(c):
    x0, w, roof = 1, 78, 20
    tcube(c, x0, 1, w, roof, 57, 'hull', ins=9, tt=2, ft=-2, topmat='conc', ol=False)
    roof_unit(c, 14, 4, 12, 5, 3, 'hull', 'conc'); roof_grille(c, 50, 6, 14, 6, 'conc')
    fy = 1 + roof
    texture_face(c, x0, fy + 1, w, 56, 'hull', -2, seam=0, band=9, seed=5)
    c.HL(x0, fy + 1, w, K('cyan', 2)); c.HL(x0, fy + 2, w, K('cyan', -1))
    for r in range(4):
        for q in range(8):
            x = 7 + q * 8; y = fy + 5 + r * 9; v = hsh(q, r, 5)
            c.ell(x + 2, y + 2, 2, 2, K('hull', -3)); c.ell(x + 2, y + 2, 1, 1, K(('orange', 'cyan', 'violet')[v % 3], 2) if v % 5 else K('glass', -1)); c.P(x + 1, y + 1, K('glow', 0) if v % 5 else K('glass', 1))
    under = {K('hull', -2 + d) for d in (-2, -1, 0, 1, 2)}
    blade_sign(c, 2, fy + 6, 26, 'violet', under, 5)
    storefront(c, 6, fy + 43, 68, 10, 'cyan', 'hull', -2, 'violet', 'cyan', 5)
    c.HL(x0, fy + 55, w, K('conc', 1)); c.HL(x0, fy + 56, w, K('conc', -2))
    c.outline()


def lowshop(c, W, H, roof, ins, wall, roofmat, ft=-2, s=0):
    tcube(c, 1, 1, W - 2, roof, H - 2 - roof, wall, ins=ins, tt=2, ft=ft, topmat=roofmat, ol=False, s=s)
    c.HL(1 + ins, 1, W - 2 - 2 * ins, K(roofmat, 3))
    fy = 1 + roof
    texture_face(c, 1, fy + 1, W - 2, H - 3 - roof, wall, ft, seam=8, band=0, seed=s, grime=3, light=2)
    c.HL(1, H - 3, W - 2, K('conc', 1)); c.HL(1, H - 2, W - 2, K('conc', -2))
    return fy, {K(wall, ft + d) for d in (-2, -1, 0, 1, 2)}


@piece2('street-noodle-shop', '국수 가게(옥상 굴뚝 + 따뜻한 주황 간판 상자 + 붉은 등 줄 + 진열창 + 차양)', 4, 4, 'structure', solid=[(x, y) for x in range(4) for y in (2, 3)], tags=['건물', '가게', '음식'], desc='네온 국수 가게. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 64, 64, 14, 5, 'rust', 'conc', -2, 6)
    cyl(c, 16, 6, 3, 1, 5, 'hull', tt=2, ft=-1, ol=False); c.ell(16, 6, 2, 1, K('cable', -1))
    roof_unit(c, 36, 4, 12, 4, 3, 'hull', 'conc')
    halo(c, 10, fy + 4, 44, 9, 'orange', under, 2)
    c.R(10, fy + 4, 44, 9, K('cable', -1)); c.HL(10, fy + 4, 44, K('orange', 3)); c.HL(10, fy + 12, 44, K('orange', 0))
    for i in range(5): c.ell(16 + i * 8, fy + 8, 2, 2, K('orange', 2)); c.P(15 + i * 8, fy + 7, K('glow', 0))
    for i in range(7): c.R(6 + i * 8, fy + 16, 3, 3, K('magenta', 1)); c.P(7 + i * 8, fy + 16, K('magenta', 3)); c.P(7 + i * 8, fy + 15, K('cable', 0))
    storefront(c, 5, fy + 26, 54, 19, 'orange', 'rust', -2, 'orange', 'magenta', 6)
    c.outline()


@piece2('street-arcade', '게임 아케이드(옥상 슬랩 + 색 바뀌는 네온 막대 간판 + 화면 벽 + 입구)', 5, 4, 'structure', solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '아케이드', '네온'], desc='오락실. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 80, 64, 14, 6, 'violet', 'conc', -2, 7)
    box2(c, 28, 3, 24, 4, 5, 'navy', topmat='cyan', tt=1, ft=-1); c.HL(29, 7, 22, K('cyan', 3))
    roof_grille(c, 9, 5, 12, 5, 'conc'); roof_unit(c, 58, 4, 12, 4, 3, 'hull', 'conc')
    halo(c, 5, fy + 3, 70, 10, 'magenta', under, 2)
    c.R(5, fy + 3, 70, 10, K('cable', -2))
    for i in range(0, 68, 6):
        col = NEON[(i // 6) % 3]; c.R(6 + i, fy + 4, 5, 8, K(col, 1)); c.HL(6 + i, fy + 4, 5, K(col, 3)); c.P(8 + i, fy + 7, K('glow', 0))
    for k, x in enumerate((7, 18, 56, 67)): monitor(c, x, fy + 18, 8, 10, NEON[k % 3], ('wave', 'graph', 'radar', 'map')[k], k, 'hull')
    storefront(c, 30, fy + 26, 20, 19, 'violet', 'violet', -2, 'magenta', None, 7)
    c.outline()


@piece2('street-club', '나이트클럽(보라 옥상 + 큰 마젠타 간판 상자 + 원형 창 둘 + 줄 선 입구 + 레이저 띠)', 5, 4, 'structure', solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '클럽', '네온'], desc='밤 클럽. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 80, 64, 14, 6, 'navy', 'violet', -2, 8)
    roof_unit(c, 10, 4, 12, 4, 3, 'cable', 'violet'); roof_unit(c, 58, 4, 12, 4, 3, 'cable', 'violet')
    halo(c, 16, fy + 3, 48, 12, 'magenta', under, 2)
    c.R(16, fy + 3, 48, 12, K('magenta', -2)); c.R(17, fy + 4, 46, 10, K('magenta', 1)); c.HL(17, fy + 4, 46, K('magenta', 3)); c.HL(17, fy + 13, 46, K('magenta', -1))
    for i in range(20, 60, 5): c.R(i, fy + 7, 3, 4, K('glow', 0) if (i // 5) % 2 else K('violet', 3))
    for x in (10, 70):
        halo(c, x - 5, fy + 21, 10, 10, 'cyan', under, 1)
        c.ell(x, fy + 26, 5, 5, K('hull', -3)); c.ell(x, fy + 26, 4, 4, K('violet', -1)); c.ell(x, fy + 26, 2, 2, K('cyan', 2)); c.P(x - 1, fy + 25, K('glow', 0))
    for k in range(3): c.line(30 + k * 8, fy + 16, 26 + k * 10, fy + 24, K(('cyan', 'magenta', 'green')[k], 2))
    storefront(c, 28, fy + 26, 24, 19, 'magenta', 'navy', -2, 'magenta', 'violet', 8)
    c.outline()


@piece2('street-clinic', '네온 진료소(흰 옥상 + 큰 시안 십자 램프 + 맑은 창 + 입구 차양)', 4, 4, 'structure', solid=[(x, y) for x in range(4) for y in (2, 3)], tags=['건물', '병원'], desc='거리 진료소. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 64, 64, 14, 5, 'white', 'white', -2, 9)
    roof_unit(c, 8, 4, 12, 4, 3, 'hull', 'white'); roof_grille(c, 42, 5, 12, 5, 'white')
    halo(c, 26, fy + 3, 12, 12, 'cyan', under, 2)
    c.R(26, fy + 3, 12, 12, K('cable', -1)); c.R(30, fy + 4, 4, 10, K('cyan', 2)); c.R(27, fy + 7, 10, 4, K('cyan', 2)); c.HL(30, fy + 4, 4, K('cyan', 3)); c.HL(27, fy + 7, 10, K('cyan', 3)); c.P(31, fy + 8, K('glow', 1))
    for x0 in (6, 46): window(c, x0, fy + 6, 12, 8, 'cyan', frame=K('hull', -3), sill=K('white', 2))
    storefront(c, 6, fy + 26, 52, 19, 'cyan', 'white', -2, 'cyan', 'cyan', 9)
    c.outline()


@piece2('street-data-center', '데이터 센터(옥상 냉각기 셋 + 램프 칸 벽 + 녹색 띠 + 보안 문)', 6, 5, 'structure', solid=[(x, y) for x in range(6) for y in (3, 4)], tags=['건물', '서버'], desc='데이터 센터. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 96, 80, 16, 7, 'cable', 'conc', 0, 10)
    for x in (12, 40, 68): roof_unit(c, x, 4, 16, 6, 4, 'hull', 'conc'); grille(c, x + 2, 5, 12, 4, 'hull', 1)
    for r in range(3):
        for q in range(7):
            x = 8 + q * 12; y = fy + 5 + r * 13
            raised(c, x, y, 9, 10, 'hull', -2)
            for k in range(3): c.P(x + 2 + k * 2, y + 3, K(('green', 'cyan', 'orange')[(q + r + k) % 3], 3)); c.P(x + 2 + k * 2, y + 6, K(('cyan', 'green', 'magenta')[(q + r + k) % 3], 1))
    vneon(c, 3, fy + 4, 44, 'green', under); vneon(c, 91, fy + 4, 44, 'cyan', under)
    c.R(41, fy + 44, 14, 17, K('hull', -3)); raised(c, 42, fy + 45, 6, 16, 'hull', 0); raised(c, 48, fy + 45, 6, 16, 'hull', -1); c.P(47, fy + 52, K('green', 3))
    c.outline()


@piece2('street-drone-garage', '드론 차고(옥상 이륙 패드 + 큰 셔터 + 주황 등 + 옆 창)', 5, 4, 'structure', solid=[(x, y) for x in range(5) for y in (2, 3)], tags=['건물', '드론', '차고'], desc='드론 차고. 셔터는 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 80, 64, 15, 6, 'hull', 'conc', -2, 11)
    c.ell(40, 8, 12, 5, K('conc', 0)); c.ell(40, 8, 10, 4, K('yellow', 1)); c.ell(40, 8, 8, 3, K('conc', 1)); c.R(38, 7, 4, 2, K('yellow', 2))
    for (x, y) in ((27, 8), (53, 8), (40, 3), (40, 13)): c.P(x, y, K('cyan', 3))
    c.R(14, fy + 8, 52, 36, K('hull', -3)); c.R(16, fy + 10, 48, 33, K('cable', 1))
    for j in range(fy + 11, fy + 42, 3): c.HL(16, j, 48, K('hull', -1)); c.HL(16, j + 1, 48, K('cable', -1))
    hazard(c, 16, fy + 41, 48, 2)
    for x in (8, 70): halo(c, x, fy + 10, 2, 22, 'orange', under, 2); c.R(x, fy + 10, 2, 22, K('orange', 2)); c.VL(x, fy + 10, 22, K('orange', 3))
    c.R(20, fy + 3, 40, 3, K('orange', 1)); c.HL(20, fy + 3, 40, K('orange', 3))
    c.outline()


@piece2('street-transit-station', '환승 정거장(넓은 유리 천창 지붕 + 시안 띠 + 출입 게이트 + 노선 화면)', 6, 4, 'structure', solid=[(x, y) for x in range(6) for y in (2, 3)], tags=['건물', '정거장', '교통'], desc='네온 환승 정거장. 문은 정면 가운데.', **S)
def _(c):
    fy, under = lowshop(c, 96, 64, 16, 8, 'navy', 'hull', -2, 12)
    for i in range(6):
        x = 14 + i * 12
        c.R(x, 4, 9, 9, K('glass', 0)); c.HL(x, 4, 9, K('glass', 2)); c.HL(x, 12, 9, K('hull', -1)); c.P(x + 2, 6, K('glow', 0))
    c.HL(2, fy + 1, 92, K('cyan', 3)); c.HL(2, fy + 2, 92, K('cyan', 0))
    for x0 in (8, 70): window(c, x0, fy + 8, 18, 12, 'cyan', frame=K('hull', -3), sill=K('navy', 1))
    monitor(c, 38, fy + 6, 20, 7, 'green', 'map', 4, 'hull')
    for k in range(4):
        gx = 30 + k * 10; c.R(gx, fy + 30, 6, 14, K('hull', 0)); c.HL(gx, fy + 30, 6, K('hull', 2)); c.P(gx + 2, fy + 32, K(('green', 'cyan')[k % 2], 3))
    c.R(28, fy + 24, 40, 5, K('cable', -1)); c.HL(28, fy + 24, 40, K('cyan', 2))
    c.outline()


# ───────────────────────── 탈것 ─────────────────────────
def hovercar(c, mat, accent, s=0, taxi=False):
    """호버 차(3/4): 넓은 지붕 윗면(밝음, 둥근 끝) 한가운데 유리 캐노피(사방에 차체 테) + 밝은 턱 + 어두운 옆판(문 이음·띠·전조등·후미등) + 밑 추진 빛 + 그림자."""
    drop_shadow(c, 24, 29, 21, 2, 1)
    y0, top, side = 4, 14, 7
    for j in range(top):
        k = (3, 2, 1, 1)[j] if j < 4 else 0
        c.HL(2 + k, y0 + j, 44 - 2 * k, K(mat, 3 if j < 2 else 2 if j < 10 else 1))
    c.HL(5, y0, 38, K(mat, 1))
    c.VL(2, y0 + 4, top - 4, K(mat, 3)); c.VL(45, y0 + 4, top - 4, K(mat, 0))
    # 캐노피(가운데, 사방 테)
    cx0, cy0, cw, ch = 14, y0 + 3, 20, 8
    for j in range(ch):
        k = (2, 1, 0, 0, 0, 0, 1, 2)[j]
        c.HL(cx0 + k, cy0 + j, cw - 2 * k, K('glass', (3, 2, 1, 0, 0, -1, -1, -2)[j]))
    c.HL(cx0 + 3, cy0, cw - 6, K('glow', 0)); c.line(cx0 + 4, cy0 + 6, cx0 + 7, cy0 + 2, K('glass', 3))
    c.HL(cx0 + 2, cy0 + ch, cw - 4, K(mat, 0))
    c.HL(5, y0 + 11, 7, K(mat, 3)); c.HL(36, y0 + 11, 7, K(mat, 0))          # 보닛·트렁크 결
    c.R(38, y0 + 2, 5, 2, K(accent, 2))                                        # 뒤 날개 등
    fy = y0 + top
    c.HL(2, fy, 44, K(mat, 3))                                                 # 턱
    for j in range(1, side):
        c.HL(2 if j < side - 1 else 3, fy + j, 44 if j < side - 1 else 42, K(mat, -1 if j < 4 else -2))
    c.HL(2, fy + 1, 44, K(mat, -3))
    c.HL(3, fy + 3, 42, K(accent, 1))
    for dx in (16, 31): c.VL(dx, fy + 1, side - 2, K(mat, -3))
    c.R(2, fy + 1, 2, 2, K('yellow', 3)); c.P(2, fy + 3, K('glow', 1)); c.R(44, fy + 1, 2, 2, K('magenta', 2))
    for px in (7, 35):
        c.R(px, fy + side, 6, 1, K(accent, 3)); c.R(px + 1, fy + side + 1, 4, 1, K(accent, 1))
    if taxi:
        box2(c, 19, 0, 10, 3, 3, 'cable', topmat='yellow', tt=2, ft=0); c.R(20, 3, 8, 1, K('yellow', 3))
        for i in range(4, 44, 4): c.R(2 + i, fy + 4, 2, 1, K('cable', -2)); c.R(4 + i, fy + 5, 2, 1, K('cable', -2))
    c.outline()


@piece2('pod-car', '호버 포드(둥근 차체 윗면 + 유리 캐노피 + 옆 띠·문 이음 + 밑 추진 빛 + 그림자)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '차'], desc='세워 둔 호버 차. 왼쪽이 앞.', **S)
def _(c): hovercar(c, 'magenta', 'cyan', 1)


@piece2('street-pod-car-cyan', '시안 호버 포드(둥근 차체 윗면 + 유리 캐노피 + 밑 추진 빛)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '차'], desc='세워 둔 호버 차. 왼쪽이 앞.', **S)
def _(c): hovercar(c, 'cyan', 'magenta', 2)


@piece2('street-pod-taxi', '호버 택시(노란 넓은 지붕 윗면 + 가운데 캐노피 + 지붕 표지 상자 + 옆 체크 띠)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['탈것', '택시'], desc='호버 택시. 왼쪽이 앞.', **S)
def _(c): hovercar(c, 'yellow', 'cyan', 3, taxi=True)


@piece2('street-pod-truck', '화물 호버 트럭(높은 화물칸 윗면·옆 골판 + 앞 낮은 캐빈 + 창 + 밑 추진 빛)', 4, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1), (3, 1)], tags=['탈것', '트럭'], desc='호버 화물 트럭. 왼쪽이 캐빈.', **S)
def _(c):
    drop_shadow(c, 32, 29, 30, 2, 1)
    fy = box2(c, 20, 2, 42, 8, 16, 'hull', topmat='hull', tt=2, ft=-1, tex='plate', seed=4)
    for x in range(22, 60, 3): c.VL(x, fy + 2, 12, K('hull', -2))
    c.R(26, fy + 4, 22, 6, K('orange', 0)); c.HL(26, fy + 4, 22, K('orange', 2)); c.R(28, fy + 6, 4, 2, K('cable', -1)); c.R(34, fy + 6, 10, 1, K('cable', -1))
    hazard(c, 20, fy + 14, 42, 2)
    box2(c, 2, 10, 20, 6, 10, 'orange', tt=2, ft=-1)
    canopy(c, 4, 11, 12, 4, 0)
    c.R(3, 18, 6, 4, K('glass', 0)); c.HL(3, 18, 6, K('glass', 2))
    c.R(2, 17, 2, 2, K('yellow', 3))
    for px in (6, 26, 50): c.R(px, 26, 6, 1, K('cyan', 3)); c.R(px + 1, 27, 4, 1, K('cyan', 1))
    c.outline()


@piece2('street-hover-bike', '호버 바이크(날렵한 차체 윗면 6줄 + 안장 윗면 + 앞 바람막이 + 어두운 옆 + 밑 네온 빛 + 그림자)', 2, 1, 'other', solid=[(0, 0), (1, 0)], tags=['탈것', '바이크'], desc='세워 둔 호버 바이크. 왼쪽이 앞.', **S)
def _(c):
    drop_shadow(c, 16, 14, 13, 1, 1)
    rows = ((7, 23), (5, 26), (4, 28), (3, 29), (3, 29), (3, 29))
    for j, (a, b) in enumerate(rows): c.HL(a, 2 + j, b - a, K('violet', 3 if j < 2 else 2))
    for j, (a, b) in enumerate(((3, 29), (4, 28), (6, 26))): c.HL(a, 8 + j, b - a, K('violet', -1 - j))
    c.HL(3, 8, 26, K('violet', -3))
    c.R(13, 3, 9, 3, K('cable', 1)); c.HL(13, 3, 9, K('cable', 3)); c.HL(13, 5, 9, K('cable', -1))
    c.R(5, 3, 4, 3, K('glass', 1)); c.HL(5, 3, 4, K('glass', 3))
    c.R(3, 9, 2, 1, K('cyan', 3)); c.P(28, 9, K('magenta', 3)); c.HL(9, 9, 12, K('cyan', 1))
    c.HL(6, 11, 6, K('cyan', 3)); c.HL(20, 11, 6, K('cyan', 3)); c.HL(7, 12, 4, K('cyan', 1)); c.HL(21, 12, 4, K('cyan', 1))
    c.outline()


@piece2('street-cargo-drone', '화물 드론(몸통 윗면 + 회전날개 원 넷(흐린 날 원) + 매단 화물 상자 + 그림자)', 2, 1, 'structure', solid=[(0, 0), (1, 0)], tags=['드론'], desc='내려앉은 화물 드론.', **S)
def _(c):
    drop_shadow(c, 16, 14, 11, 1, 1)
    for x, y in ((6, 3), (26, 3)):
        c.ell(x, y, 5, 2, K('hull', 1)); c.ell(x, y, 4, 1, K('glass', 1)); c.P(x, y, K('cable', -1)); c.HL(x - 4, y, 9, K('glow', 0))
    c.line(6, 4, 12, 6, K('cable', 0)); c.line(26, 4, 20, 6, K('cable', 0))
    fy = box2(c, 10, 4, 12, 3, 3, 'white', tt=2, ft=-1); c.P(15, 5, K('cyan', 3)); c.P(16, 5, K('cyan', 3))
    box2(c, 11, 10, 10, 2, 3, 'orange', tt=1, ft=-1, round_top=False); c.VL(16, 12, 3, K('orange', -3))
    c.outline()


# ───────────────────────── 간판·광고 ─────────────────────────
@piece2('neon-sign-tower', '네온 간판 탑(위 두꺼운 덮개 윗면 5줄 + 램프 상자 앞면 도형 + 기둥 + 받침)', 1, 3, 'box', solid=[(0, 2)], tags=['간판', '네온'], desc='길가 세로 간판 탑. 맨 아래 칸만 막힘.', **S)
def _(c):
    drop_shadow(c, 8, 45, 5, 1, 1)
    c.R(6, 31, 4, 13, K('hull', -1)); c.VL(6, 31, 13, K('hull', 1)); c.R(4, 42, 8, 3, K('hull', -2)); c.HL(4, 42, 8, K('hull', 1))
    fy = box2(c, 1, 1, 14, 6, 24, 'cable', topmat='hull', tt=2, ft=0)
    grille(c, 3, 2, 10, 3, 'hull', 1)
    halo(c, 1, fy, 14, 24, 'magenta', {K('cable', d) for d in (-3, -2, -1, 0, 1)}, 1)
    c.R(2, fy + 1, 12, 22, K('magenta', -2)); c.R(3, fy + 2, 10, 20, K('magenta', 0)); c.VL(3, fy + 2, 20, K('magenta', 3)); c.HL(3, fy + 2, 10, K('magenta', 3))
    for k, y in enumerate(range(fy + 5, fy + 20, 6)):
        if k % 2: c.ell(8, y + 1, 2, 2, K('glow', 0)); c.P(8, y + 1, K('magenta', 1))
        else: c.R(5, y, 6, 2, K('cyan', 3)); c.R(6, y + 2, 4, 1, K('cyan', 1))
    c.outline()


def stall(c, awn='magenta', goods='orange'):
    for x in (3, 27): c.R(x, 12, 2, 14, K('hull', -1))
    for j in range(9):
        for i in range(30):
            col = awn if (i // 4) % 2 == 0 else 'white'
            c.P(1 + i, 2 + j, K(col, 2 if j < 6 else 0))
    c.HL(1, 2, 30, K(awn, 3)); c.HL(1, 10, 30, K(awn, -1))
    for i in range(1, 31, 4): c.R(i, 11, 2, 1, K(awn, 0))
    for i, x in enumerate(range(5, 28, 5)): c.P(x, 13, K('cable', 0)); c.P(x, 14, K(('yellow', 'cyan')[i % 2], 3))
    fy = box2(c, 1, 18, 30, 5, 8, 'rust', topmat='conc', tt=2, ft=-1)
    for k, x in enumerate(range(4, 28, 6)):
        c.ell(x + 1, 20, 2, 1, K('white', 2)); c.HL(x, 20, 3, K(goods if k % 2 else 'green', 2))
    c.HL(3, fy + 3, 26, K(awn, 2)); c.HL(3, fy + 4, 26, K(awn, 0))
    drop_shadow(c, 16, 30, 14, 1, 1)
    c.outline()


@piece2('street-market-stall-a', '네온 노점(줄무늬 차양 지붕 윗면 + 매달린 전구 + 진열대 위 그릇 + 앞 판)', 2, 2, 'box', solid=[(0, 1), (1, 1)], tags=['노점', '가게'], desc='거리 음식 노점. 아래 줄이 막힘.', **S)
def _(c): stall(c)


@piece2('street-market-stall-b', '네온 노점 B(시안 차양 + 꼬치 진열 + 앞 판 네온 띠)', 2, 2, 'box', solid=[(0, 1), (1, 1)], tags=['노점', '가게'], desc='거리 노점. 아래 줄이 막힘.', **S)
def _(c):
    stall(c, 'cyan', 'magenta')


@piece2('street-kiosk', '정보 키오스크(넓은 윗면 + 위 홀로 지도판 + 앞 화면 둘 + 받침)', 2, 2, 'box', solid=[(0, 1), (1, 1)], tags=['키오스크', '안내'], desc='거리 안내 단말. 아래 줄이 막힘.', **S)
def _(c):
    drop_shadow(c, 16, 30, 13, 1, 1)
    c.R(6, 3, 20, 9, K('cyan', -1)); c.R(7, 4, 18, 7, K('cyan', 0))
    for i in range(8, 24, 4): c.VL(i, 4, 7, K('cyan', 1))
    c.HL(7, 4, 18, K('cyan', 3)); c.P(15, 7, K('glow', 1)); c.P(19, 6, K('magenta', 3))
    c.R(14, 11, 4, 4, K('cyan', -2))
    fy = box2(c, 3, 14, 26, 4, 12, 'navy', topmat='hull', tt=2, ft=0)
    monitor(c, 5, fy + 2, 10, 7, 'cyan', 'map', 1, 'cable'); monitor(c, 17, fy + 2, 10, 7, 'green', 'lines', 2, 'cable')
    c.outline()


@piece2('street-neon-billboard', '네온 광고판(두꺼운 판 윗면 + 램프 테 + 도형 광고(산·해·띠) + 두 다리 기단)', 3, 2, 'box', solid=[(0, 1), (1, 1), (2, 1)], tags=['광고', '네온'], desc='길가 광고판. 아래 줄이 막힘.', **S)
def _(c):
    drop_shadow(c, 24, 30, 20, 1, 1)
    for x in (10, 36): c.R(x, 20, 3, 9, K('hull', -1)); c.VL(x, 20, 9, K('hull', 1)); c.R(x - 2, 28, 7, 2, K('hull', -2))
    fy = box2(c, 1, 0, 46, 6, 17, 'cable', topmat='hull', tt=2, ft=-1); grille(c, 4, 1, 12, 3, 'hull', 1); grille(c, 32, 1, 12, 3, 'hull', 1)
    c.R(2, fy + 1, 44, 15, K('violet', -3))
    for j in range(13):
        c.HL(3, fy + 2 + j, 42, K(('violet', 'magenta', 'orange')[min(2, j // 5)], 1 - (j % 5) // 2))
    c.ell(30, fy + 7, 3, 3, K('yellow', 3)); c.ell(30, fy + 7, 1, 1, K('glow', 0))
    for i in range(42):
        h = 3 + (hsh(i // 3, 0, 9) % 4)
        c.VL(3 + i, fy + 15 - h, h, K('navy', -1))
    c.HL(2, fy + 1, 44, K('cyan', 3)); c.HL(2, fy + 15, 44, K('cyan', 1)); c.VL(2, fy + 1, 15, K('cyan', 3)); c.VL(45, fy + 1, 15, K('cyan', 1))
    c.outline()


@piece2('street-neon-arrow', '화살표 간판 상자(윗면 + 어두운 앞판 위 주황 램프 화살표 도형 + 받침)', 1, 1, 'box', solid=[(0, 0)], tags=['간판', '네온'], desc='길 안내 화살표 간판.', **S)
def _(c):
    fy = box2(c, 1, 0, 14, 5, 9, 'cable', topmat='hull', tt=2, ft=0)
    for j, (a, b) in enumerate(((7, 9), (3, 11), (3, 12), (3, 11), (7, 9))):
        c.HL(a, fy + 2 + j, b - a, K('orange', 3 if j == 2 else 2))
    c.P(11, fy + 4, K('glow', 0))
    c.R(7, 14, 2, 2, K('hull', -1)); c.HL(3, 2, 10, K('hull', 3))
    c.outline()


@piece2('street-holo-ad', '홀로 광고(바닥 투사기 단 윗면 + 떠 있는 반투명 시안 광고 상(도형) + 투사 빛살)', 2, 3, 'box', solid=[(0, 2), (1, 2)], tags=['홀로그램', '광고'], desc='홀로그램 광고 기둥. 맨 아래 줄만 막힘.', **S)
def _(c):
    fy = box2(c, 5, 34, 22, 5, 7, 'hull', topmat='navy', tt=1, ft=-1)
    c.ell(16, 36, 7, 2, K('cyan', 1)); c.ell(16, 36, 4, 1, K('glow', 0))
    for x in range(10, 23, 3): c.line(16, 35, x, 24, K('cyan', 0))
    for j in range(20):
        a = 4 if j % 3 else 5
        c.HL(a, 4 + j, 32 - 2 * a, K('cyan', 1 if j % 3 else -1))
    c.HL(4, 4, 24, K('cyan', 3)); c.HL(4, 23, 24, K('cyan', 2))
    c.ell(16, 12, 5, 5, K('magenta', 2)); c.ell(16, 12, 3, 3, K('magenta', 3)); c.P(15, 11, K('glow', 0))
    c.R(8, 19, 16, 2, K('glow', 0))
    leds(c, 8, fy + 3, 6, s=1)
    c.outline()


@piece2('street-sign-vertical', '세로 네온 간판(두꺼운 판 윗면 + 램프 테 + 칸마다 도형 + 고정 다리)', 1, 2, 'box', solid=[(0, 1), (0, 0)], tags=['간판', '네온'], desc='세로 간판. 두 칸 모두 막힘.', **S)
def _(c):
    fy = box2(c, 2, 0, 12, 6, 24, 'cable', topmat='hull', tt=2, ft=-1); c.HL(3, 2, 10, K('hull', 3)); c.HL(4, 3, 8, K('cyan', 1))
    c.R(3, fy + 1, 10, 22, K('cyan', -2)); c.VL(3, fy + 1, 22, K('cyan', 3)); c.VL(12, fy + 1, 22, K('cyan', 1)); c.HL(3, fy + 1, 10, K('cyan', 3))
    for k, y in enumerate(range(fy + 4, fy + 20, 5)):
        col = ('magenta', 'yellow', 'cyan', 'violet')[k % 4]
        if k % 2: c.R(5, y, 6, 3, K(col, 2)); c.HL(5, y, 6, K(col, 3))
        else: c.ell(8, y + 1, 2, 1, K(col, 3)); c.P(8, y + 1, K('glow', 0))
    c.R(6, 30, 4, 2, K('hull', -2))
    c.outline()


@piece2('street-neon-bars-wall', '벽면 네온 막대 간판(벽에 붙은 어두운 판 + 색 막대 램프 + 벽 번짐)', 2, 1, 'wall_mounted', solid=[], tags=['간판', '벽'], desc='벽에 거는 네온 간판. 바닥을 막지 않는다.', **S)
def _(c):
    for j in range(4, 13):
        for i in range(1, 31):
            if abs(i - 16) / 15 + abs(j - 8) / 5 < 1.25: c.P(i, j, K('magenta', -3))
    c.R(3, 5, 26, 7, K('cable', -2)); c.HL(3, 5, 26, K('cable', 1)); c.HL(3, 11, 26, K('cable', -3))
    for i, x in enumerate(range(5, 27, 4)):
        col = ('magenta', 'cyan', 'yellow')[i % 3]; c.R(x, 7, 3, 3, K(col, 2)); c.P(x, 7, K(col, 3)); c.P(x + 1, 8, K('glow', 0))
    c.P(3, 4, K('hull', 0)); c.P(28, 4, K('hull', 0))


@piece2('street-neon-ring-wall', '벽면 네온 링 간판(벽 번짐 + 이중 링 램프 + 가운데 점)', 1, 1, 'wall_mounted', solid=[], tags=['간판', '벽'], desc='벽에 거는 둥근 네온.', **S)
def _(c):
    c.ell(8, 8, 7, 7, K('cyan', -3)); c.ell(8, 8, 6, 6, K('cable', -2))
    c.ell(8, 8, 5, 5, K('cyan', 2)); c.ell(8, 8, 4, 4, K('cable', -2)); c.ell(8, 8, 2, 2, K('magenta', 2)); c.P(8, 8, K('glow', 0))
    c.P(5, 4, K('cyan', 3)); c.P(4, 5, K('cyan', 3))


@piece2('street-neon-flat-strip', '바닥 네온 유도선(아스팔트에 박힌 빛 띠 + 화살 점선)', 2, 1, 'flat', solid=[], tags=['바닥', '네온'], desc='길바닥 유도선.', **S)
def _(c):
    c.R(0, 6, 32, 4, K('cyan', -3)); c.HL(0, 7, 32, K('cyan', 1)); c.HL(0, 8, 32, K('cyan', 3))
    for x in range(2, 32, 8): c.P(x, 7, K('glow', 0)); c.P(x + 1, 8, K('glow', 0))


# ───────────────────────── 거리 소품 ─────────────────────────
def vending2(c, mat, glow, s=0):
    """자판기: 깊은 윗면 + 앞면 진열 유리(칸마다 색 캔) + 오른쪽 버튼 줄 + 아래 꺼내는 곳 + 빛 번짐."""
    fy = box2(c, 1, 0, 14, 7, 23, mat, topmat='hull', tt=2, ft=-1)
    grille(c, 3, 2, 10, 2, 'hull', 1); c.HL(1, 6, 14, K(mat, 3))
    c.R(2, fy + 2, 9, 14, K('cable', -2)); c.R(3, fy + 3, 7, 12, K(glow, 0)); c.HL(3, fy + 3, 7, K(glow, 3))
    for r in range(3):
        c.HL(3, fy + 6 + r * 4, 7, K('cable', -1))
        for q in range(3): c.R(3 + q * 2 + (r % 2), fy + 4 + r * 4, 1, 2, K(('magenta', 'yellow', 'green', 'orange')[(q + r + s) % 4], 2))
    c.P(4, fy + 4, K('glow', 0))
    for j in range(4): c.P(12, fy + 3 + j * 2, K(('green', 'orange', 'cyan', 'magenta')[j], 3))
    c.R(12, fy + 12, 2, 3, K('cable', -2))
    c.R(3, fy + 18, 9, 3, K('cable', -3)); c.HL(3, fy + 18, 9, K(mat, -3))
    c.outline()


@piece2('vending', '자판기(깊은 윗면 + 빛나는 진열창 + 색 캔 + 버튼 줄 + 꺼내는 곳)', 1, 2, 'tall_furniture', solid=[(0, 1), (0, 0)], tags=['자판기'], desc='거리 자판기.', **S)
def _(c): vending2(c, 'magenta', 'cyan', 0)


@piece2('street-vending-cyan', '시안 자판기(깊은 윗면 + 빛나는 진열창 + 색 캔 + 버튼)', 1, 2, 'tall_furniture', solid=[(0, 1), (0, 0)], tags=['자판기'], desc='거리 자판기.', **S)
def _(c): vending2(c, 'cyan', 'yellow', 1)


@piece2('street-atm-kiosk', '현금 단말기 부스(윗면 + 차양 턱 + 화면 + 키패드 + 카드 투입구)', 1, 2, 'tall_furniture', solid=[(0, 1), (0, 0)], tags=['단말기'], desc='거리 현금 단말기.', **S)
def _(c):
    fy = box2(c, 1, 2, 14, 5, 24, 'navy', topmat='hull', tt=2, ft=0)
    c.R(1, fy, 14, 2, K('green', 1)); c.HL(1, fy, 14, K('green', 3))
    c.R(2, fy + 3, 12, 11, K('cable', -1)); monitor(c, 3, fy + 4, 10, 6, 'green', 'lines', 2, 'cable')
    for r in range(2):
        for q in range(3): c.P(5 + q * 2, fy + 11 + r * 2, K('hull', 2))
    c.R(4, fy + 16, 8, 1, K('cable', -3)); c.P(11, fy + 16, K('green', 3))
    c.R(3, fy + 19, 10, 3, K('navy', -2))
    c.outline()


@piece2('street-trash-bin', '네온 쓰레기통(위에서 보이는 둥근 뚜껑 윗면 + 투입 구멍 + 원통 몸통 + 시안 띠)', 1, 1, 'round_body', solid=[(0, 0)], tags=['쓰레기통'], desc='거리 쓰레기통.', **S)
def _(c):
    drop_shadow(c, 8, 14, 6, 1, 1)
    for y in range(5, 14):
        for x in range(2, 15):
            u = (x - 8) / 6
            if abs(u) <= 1: c.P(x, y, K('hull', 0 if u < -0.5 else -2 if u > 0.5 else -1))
    c.ell(8, 13, 6, 1, K('hull', -3))
    c.HL(2, 10, 13, K('cyan', 2)); c.HL(2, 11, 13, K('cyan', 0))
    c.ell(8, 5, 6, 4, K('hull', 2)); c.ell(8, 5, 5, 3, K('hull', 3)); c.ell(8, 5, 3, 2, K('cable', -2)); c.HL(6, 4, 4, K('cable', -3))
    c.HL(5, 2, 6, K('glow', 0))
    c.outline()


@piece2('street-bench-neon', '네온 벤치(널 앉는 면 윗면 + 등받이 + 금속 다리 + 밑 네온 빛)', 2, 1, 'low_furniture', solid=[(0, 0), (1, 0)], tags=['벤치'], desc='거리 벤치.', **S)
def _(c):
    drop_shadow(c, 16, 14, 14, 1, 1)
    box2(c, 2, 1, 28, 2, 4, 'hull', tt=1, ft=-1)                               # 등받이
    fy = box2(c, 1, 6, 30, 4, 2, 'rust', topmat='rust', tt=2, ft=-1)
    for x in range(2, 30, 6): c.VL(x + 5, 6, 4, K('rust', 0))
    for x in (4, 26): c.R(x, fy + 2, 2, 3, K('hull', -2))
    c.HL(6, 13, 20, K('magenta', 3)); c.HL(8, 14, 16, K('magenta', 1))
    c.outline()


@piece2('street-planter-neon', '네온 화분 상자(콘크리트 상자 윗면 테 + 흙 + 둥근 잎 덩이 + 앞 띠 등)', 1, 1, 'organic', solid=[(0, 0)], tags=['화분', '식물'], desc='거리 화분.', **S)
def _(c):
    fy = box2(c, 1, 7, 14, 3, 6, 'conc', tt=1, ft=-1)
    c.R(2, 8, 12, 1, K('rust', -2))
    for (x, y, r) in ((5, 6, 3), (10, 5, 4), (8, 3, 3)):
        c.ell(x, y, r, r - 1, K('plant', -1)); c.ell(x - 1, y - 1, r - 1, r - 2, K('plant', 1)); c.P(x - 1, y - 2, K('plant', 3))
    c.HL(3, fy + 3, 10, K('cyan', 3))
    c.outline()


@piece2('street-lamp-post', '가로등(받침 + 가는 기둥 + 위 넓은 등 머리(윗면 5줄·아래 발광면) + 땅 빛 웅덩이)', 1, 2, 'column', solid=[(0, 1)], tags=['가로등'], desc='거리 가로등. 아래 칸만 막힘.', **S)
def _(c):
    c.ell(8, 29, 6, 2, K('cyan', -2)); c.ell(8, 29, 4, 1, K('cyan', -1))
    c.R(7, 9, 2, 19, K('hull', -1)); c.VL(7, 9, 19, K('hull', 1))
    c.R(5, 26, 6, 4, K('hull', -2)); c.HL(5, 26, 6, K('hull', 1)); c.HL(5, 29, 6, K('hull', -3))
    fy = box2(c, 2, 0, 12, 5, 3, 'hull', tt=2, ft=-1)
    c.HL(4, 2, 8, K('hull', 3))
    c.R(3, fy + 1, 10, 2, K('cyan', 2)); c.HL(3, fy + 2, 10, K('glow', 0))
    for j in range(fy + 3, fy + 7): c.HL(3 + (j - fy - 3), j, 10 - 2 * (j - fy - 3), K('cyan', -3 + (fy + 6 - j) // 2))
    c.outline()


@piece2('street-bollard', '발광 볼라드(위에서 보이는 둥근 윗면 램프 + 짧은 원통 + 고리 띠)', 1, 1, 'round_body', solid=[(0, 0)], tags=['볼라드'], desc='거리 볼라드.', **S)
def _(c):
    drop_shadow(c, 8, 14, 4, 1, 1)
    for y in range(5, 14):
        for x in range(4, 13):
            u = (x - 8) / 4
            if abs(u) <= 1: c.P(x, y, K('hull', 0 if u < -0.5 else -2 if u > 0.5 else -1))
    c.HL(4, 9, 9, K('yellow', 2)); c.HL(4, 10, 9, K('yellow', 0))
    c.ell(8, 5, 4, 3, K('hull', 2)); c.ell(8, 5, 3, 2, K('yellow', 1)); c.ell(8, 4, 2, 1, K('yellow', 3)); c.P(7, 4, K('glow', 0))
    c.outline()


@piece2('street-barrier-stripe', '줄무늬 차단 바리케이드(두꺼운 가로대 윗면 + 위험 사선 앞면 + 다리 + 경광등)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['바리케이드'], desc='도로 차단막.', **S)
def _(c):
    drop_shadow(c, 16, 14, 14, 1, 1)
    fy = box2(c, 1, 1, 30, 5, 6, 'hull', topmat='hull', tt=2, ft=0)
    c.HL(2, 3, 28, K('orange', 1))
    hazard(c, 1, fy, 30, 5)
    c.HL(1, fy + 5, 30, K('cable', -2))
    for x in (4, 25): c.R(x, fy + 6, 3, 4, K('hull', -2)); c.HL(x - 1, fy + 9, 5, K('hull', -1))
    for x in (3, 28): c.R(x, 0, 2, 2, K('orange', 3)); c.P(x, 0, K('glow', 0))
    c.outline()


@piece2('street-manhole', '맨홀 뚜껑(바닥 둥근 철판 + 테 + 격자 홈 + 바랜 빛)', 1, 1, 'flat', solid=[], tags=['바닥'], desc='길바닥 맨홀.', **S)
def _(c):
    c.ell(8, 8, 6, 5, K('cable', -2)); c.ell(8, 8, 5, 4, K('hull', -1))
    for x in range(4, 13, 2): c.VL(x, 5, 7, K('cable', -1))
    c.HL(4, 8, 9, K('cable', -2)); c.ell(8, 8, 1, 1, K('hull', 1)); c.P(5, 5, K('hull', 1)); c.P(6, 4, K('hull', 1))


@piece2('street-ac-cluster', '실외기 묶음(상자 둘 윗면 팬 격자 + 앞 그릴 + 배관)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['실외기'], desc='건물 옆 실외기.', **S)
def _(c):
    for x0, s in ((1, 0), (16, 1)):
        fy = box2(c, x0, 2, 15, 5, 8, 'white', tt=1, ft=-1)
        c.ell(x0 + 7, 4, 4, 1, K('cable', -1)); c.HL(x0 + 4, 4, 7, K('hull', -1)); c.P(x0 + 7, 4, K('hull', 1))
        grille(c, x0 + 2, fy + 2, 11, 4, 'hull', -1)
    c.R(4, 13, 24, 1, K('cable', 0)); c.HL(4, 14, 24, K('shadow', 1))
    c.outline()


@piece2('street-transit-stop', '정류장 쉼터(유리 지붕 윗면 + 시안 등 + 유리 뒷벽 + 안 벤치 + 노선 화면)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['정류장'], desc='거리 정류장. 아래 줄이 막힘.', **S)
def _(c):
    drop_shadow(c, 24, 30, 22, 1, 1)
    for x in (3, 43): c.R(x, 8, 2, 22, K('hull', -1)); c.VL(x, 8, 22, K('hull', 1))
    pane(c, 6, 9, 36, 13, 'glass', 0)
    c.R(1, 1, 46, 7, K('glass', 1)); c.HL(1, 1, 46, K('hull', 2)); c.HL(1, 7, 46, K('hull', -2))
    for x in range(5, 46, 8): c.VL(x, 2, 5, K('hull', 0))
    c.HL(2, 8, 44, K('cyan', 3))
    monitor(c, 30, 11, 9, 7, 'orange', 'lines', 3, 'cable')
    box2(c, 8, 21, 20, 2, 3, 'rust', tt=2, ft=-1)
    c.R(9, 26, 2, 3, K('hull', -2)); c.R(25, 26, 2, 3, K('hull', -2))
    c.outline()


@piece2('street-crate-pile', '화물 상자 더미(크고 작은 상자 세 개 윗면·띠·표식)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['상자'], desc='쌓인 화물 상자.', **S)
def _(c):
    drop_shadow(c, 16, 14, 14, 1, 1)
    fy = box2(c, 1, 3, 14, 4, 8, 'orange', tt=1, ft=-1); c.VL(7, fy, 8, K('orange', -3)); c.R(3, fy + 2, 3, 2, K('cable', -1))
    fy = box2(c, 15, 5, 16, 3, 7, 'hull', tt=2, ft=-1); hazard(c, 15, fy + 4, 16, 2)
    fy = box2(c, 4, 0, 9, 3, 3, 'green', tt=1, ft=-1); c.HL(5, 1, 7, K('green', 3))
    c.outline()


@piece2('street-puddle-neon', '네온 웅덩이(젖은 바닥 웅덩이 + 비친 마젠타·시안 띠 + 테 밝은 반사)', 1, 1, 'flat', solid=[], tags=['바닥', '물'], desc='길바닥 물웅덩이.', **S)
def _(c):
    c.ell(8, 9, 7, 4, K('navy', -2)); c.ell(8, 9, 6, 3, K('navy', -1))
    c.HL(4, 8, 6, K('magenta', 1)); c.HL(6, 10, 7, K('cyan', 1)); c.P(5, 8, K('magenta', 3)); c.P(11, 10, K('cyan', 3))
    c.HL(4, 6, 4, K('glass', 1))


@piece2('street-drone-pad', '드론 이륙 패드(낮은 단 윗면 + 노란 원·십자 표식 + 모서리 램프 + 앞 띠)', 2, 2, 'box', solid=[(0, 1), (1, 1)], tags=['드론', '패드'], desc='거리 드론 패드. 아래 줄이 막힘.', **S)
def _(c):
    fy = box2(c, 1, 4, 30, 21, 5, 'hull', topmat='conc', tt=0, ft=-1)
    c.ell(16, 14, 11, 8, K('yellow', 1)); c.ell(16, 14, 9, 6, K('conc', 0))
    c.R(15, 9, 2, 11, K('yellow', 2)); c.R(10, 13, 12, 2, K('yellow', 2)); c.HL(15, 9, 2, K('yellow', 3)); c.ell(16, 14, 1, 1, K('cyan', 3))
    for (x, y) in ((3, 6), (28, 6), (3, 23), (28, 23)): c.P(x, y, K('cyan', 3)); c.P(x, y + 1, K('cyan', 0))
    hazard(c, 1, fy + 1, 30, 3)
    c.outline()
