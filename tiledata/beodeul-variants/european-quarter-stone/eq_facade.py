# 석조 유럽 시가지 — 정면 문법(16px 칸 = 한 칸 폭의 「베이」). 건물은 그리지 않고 조립한다:
#   지붕(맨사르드: 아연 윗지붕 + 검은 슬레이트 가파른 면 + 다락창) → 코니스 → 위층(층마다 32px: 창·발코니·기둥) → 1층(36px: 문·진열창·차양)
# 모든 층 높이·창 높이·처마선은 이 파일의 상수 하나로 정한다(같은 줄의 건물끼리 처마선이 맞는다).
from eq_base import *

STOREY = 32          # 위층 한 층
GROUND = 40          # 1층(돌 기단 포함, 위층보다 높다)
CORNICE = 6          # 처마 코니스
MANS = 30            # 맨사르드 가파른 면
MTOP = 8             # 맨사르드 윗지붕(위에서 본 얕은 면)

# ---------------------------------------------------------------- 벽 바탕
def wall_tones(W, Hh, seed=0, rust=False):
    """마름돌 벽 밝기 단: 칩셋 마름돌 블록 결(줄눈 포함)을 3~5단으로. rust=True 면 1층 띠 홈(깊은 가로 줄눈)."""
    t = tex_tones(*ASHLAR_AT, W, Hh, 110, 225, 2, 5, dx=seed * 5)
    Y, X = np.mgrid[0:Hh, 0:W]
    n = tnoise(max(16, -(-W // 16) * 16), max(16, -(-Hh // 16) * 16), 16, 900 + seed)[:Hh, :W]
    t = np.where((n > 0.70) & (t > 2), t - 1, t)                                   # 큰 얼룩(비 맞은 자리) 한 단 어둡게
    t = np.where((hash2(X, Y, 901 + seed) > 0.985) & (t < 5), t + 1, t)           # 잔 밝은 점
    if rust:
        t = np.where((Y % 8) == 7, 1, t)
        t = np.where((Y % 8) == 0, np.minimum(t + 1, 5), t)
    return t

class Facade:
    """정면 하나를 그리는 판. 좌표는 그림 안 화소. 바탕 램프는 ASH(또는 BRICK)."""
    def __init__(s, bays, storeys, roof='mansard', base_ramp=None, seed=1, ground=GROUND):
        s.bays = bays; s.n = storeys; s.W = bays * 16; s.seed = seed; s.roof = roof
        s.ground = ground
        s.top_pad = 14                                                          # 굴뚝 머리 자리
        s.roofH = (MTOP + MANS) if roof == 'mansard' else (40 if roof == 'hip' else 34)
        s.y_cor = s.top_pad + s.roofH                                           # 코니스 윗줄
        s.y_wall = s.y_cor + CORNICE                                            # 위층 벽 시작
        s.y_gf = s.y_wall + (storeys - 1) * STOREY                              # 1층 시작
        s.Hh = s.y_gf + ground
        s.Hh = -(-s.Hh // 16) * 16; s.base = s.Hh - 1                            # 밑변(왼쪽 아래 기준 정렬)
        s.y_gf = s.base + 1 - ground; s.y_wall = s.y_gf - (storeys - 1) * STOREY
        s.y_cor = s.y_wall - CORNICE; s.y_roof = s.y_cor - s.roofH
        s.im = Image.new('RGBA', (s.W, s.Hh)); s.px = s.im.load()
        s.ramp = base_ramp or ASH
        s.windows = []                                                          # (x0,y0,x1,y1) 유리 상자
    def P(s, x, y, c): put(s.px, s.W, s.Hh, x, y, c)
    def G(s, x, y): return get(s.px, s.W, s.Hh, x, y)
    def storey_top(s, k):
        """k=0 이 1층, 1..n-1 이 위층(아래부터). 그 층 윗줄 y."""
        return s.y_gf if k == 0 else s.y_gf - k * STOREY
    def fill_wall(s):
        Hw = s.base + 1 - s.y_wall
        t = wall_tones(s.W, Hw, s.seed)
        tg = wall_tones(s.W, s.ground, s.seed + 3, rust=True)
        t[Hw - s.ground:] = tg
        R = np.array(s.ramp)
        a = R[t]
        for y in range(Hw):
            for x in range(s.W): s.P(x, s.y_wall + y, a[y, x])
        # 층 띠(string course): 위층 바닥선마다 2화소 밝은 돌
        for k in range(1, s.n):
            y = s.storey_top(k) + STOREY - 1
            if k == 1: y = s.y_gf - 1
            for x in range(s.W):
                s.P(x, y - 1, TRIM[3]); s.P(x, y, ASH[1])
        # 1층 위 띠(더 두껍게)와 기단 물끊기
        for x in range(s.W):
            s.P(x, s.y_gf - 3, TRIM[6]); s.P(x, s.y_gf - 2, TRIM[4]); s.P(x, s.y_gf - 1, TRIM[2]); s.P(x, s.y_gf, ASH[1])
            s.P(x, s.base - 2, TRIM[4]); s.P(x, s.base - 1, TRIM[3]); s.P(x, s.base, ASH[1])
        # 양 끝 모서리 돌(퀸): 2화소, 엇갈린 큰 돌
        for y in range(s.y_wall, s.base - 2):
            q = ((y - s.y_wall) // 6) % 2
            s.P(0, y, TRIM[4] if (y - s.y_wall) % 6 else TRIM[2]); s.P(1, y, TRIM[3] if q else TRIM[4])
            s.P(s.W - 1, y, ASH[1]); s.P(s.W - 2, y, TRIM[2] if (y - s.y_wall) % 6 else ASH[1])
            if q: s.P(2, y, TRIM[3]); s.P(s.W - 3, y, TRIM[2])
    # ---- 기둥(벽기둥, 위층만)
    def pilaster(s, x, y0=None, y1=None):
        y0 = s.y_wall if y0 is None else y0; y1 = (s.y_gf - 4) if y1 is None else y1
        for y in range(y0, y1):
            s.P(x, y, TRIM[5]); s.P(x + 1, y, TRIM[4]); s.P(x + 2, y, TRIM[3]); s.P(x + 3, y, ASH[1])
        for dx in range(-1, 5):                                                  # 기둥머리
            s.P(x + dx, y0, TRIM[6]); s.P(x + dx, y0 + 1, TRIM[4]); s.P(x + dx, y0 + 2, TRIM[2])
    # ---- 창
    def window(s, bx, k, kind='sash', h=None, lit=False, shut=None, box=False, hood=None):
        """bx 베이, k 층(0=1층). sash=6칸 내리닫이 창, french=바닥까지 내려오는 창문(발코니 뒤), arch=반원 창(1층)."""
        x0 = bx * 16 + 4; x1 = x0 + 8
        top = s.storey_top(k)
        y0 = top + (6 if k else 7); hh = h or (18 if kind != 'french' else 23)
        if k == 0: hh = h or 18
        y1 = y0 + hh
        # 돌 테두리(밝은 돌) + 안쪽 그늘(위·왼)
        for y in range(y0 - 1, y1 + 1):
            for x in (x0 - 2, x0 - 1, x1, x1 + 1):
                s.P(x, y, TRIM[5] if x == x0 - 2 else TRIM[4] if x == x0 - 1 else TRIM[3] if x == x1 else TRIM[1])
        # 상인방(머릿돌) — 3화소, 가운데 쐐기돌
        for x in range(x0 - 3, x1 + 3):
            s.P(x, y0 - 4, TRIM[6]); s.P(x, y0 - 3, TRIM[5]); s.P(x, y0 - 2, TRIM[3])
        for y in range(y0 - 5, y0 - 1): s.P(x0 + 3, y, TRIM[6] if y < y0 - 3 else TRIM[4]); s.P(x0 + 4, y, TRIM[4] if y < y0 - 3 else TRIM[2])
        if hood == 'pedi':                                                      # 세모 창머리(주층)
            cx = x0 + 4
            for j in range(4):
                for x in range(x0 - 3 + j * 2 - j, x1 + 3 - j * 2 + j):
                    d = abs(x + 0.5 - cx)
                    if d <= 6.5 - j * 2: s.P(x, y0 - 5 - j, TRIM[6] if (x < cx and d > 5 - j * 2) else TRIM[4] if d > 5 - j * 2 else TRIM[3])
        elif hood == 'flat':                                                    # 처마 돌림 창머리
            for x in range(x0 - 4, x1 + 4): s.P(x, y0 - 6, TRIM[6]); s.P(x, y0 - 5, TRIM[4])
        if kind == 'arch':
            for x in range(x0 - 2, x1 + 2):
                d = abs(x + 0.5 - (x0 + 4));
                for y in range(y0 - 4, y0 + 1):
                    if (x + 0.5 - (x0 + 4)) ** 2 + ((y - y0 - 1) * 1.6) ** 2 > 30: s.P(x, y, s.ramp[3])
        # 유리
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = GLASS[1] if (y - y0) < 3 else GLASS[2]
                if lit: c = AMBER[3] if (x + y) % 5 else AMBER[4]
                s.P(x, y, c)
        # 하늘 비침(왼쪽 위 사선 두 줄)
        if not lit:
            for i in range(4):
                s.P(x0 + 1 + i, y0 + 4 - i, GLASS[5]); s.P(x0 + 1 + i, y0 + 5 - i, GLASS[4])
            s.P(x0 + 5, y0 + hh // 2 + 2, GLASS[4])
        # 창살: 가운데 세로 + 가로 둘(6칸)
        for y in range(y0, y1): s.P(x0 + 3, y, TRIM[5]); s.P(x0 + 4, y, TRIM[3])
        for f in (1 / 3, 2 / 3) if kind != 'french' else (0.28, 0.56, 0.8):
            yy = y0 + int(hh * f)
            for x in range(x0, x1): s.P(x, yy, TRIM[4])
        for x in range(x0, x1): s.P(x, y0, TRIM[1])                            # 위 그늘
        # 창턱
        if kind != 'french':
            for x in range(x0 - 2, x1 + 2): s.P(x, y1 + 1, TRIM[6]); s.P(x, y1 + 2, TRIM[3]); s.P(x, y1 + 3, ASH[1])
        if box:                                                                 # 창가 화분(제라늄)
            for x in range(x0 - 1, x1 + 1):
                s.P(x, y1 + 2, WOOD[4]); s.P(x, y1 + 3, WOOD[3]); s.P(x, y1 + 4, WOOD[1])
                if (x + bx) % 2 == 0: s.P(x, y1 + 1, FLOWR[5] if x % 4 else FLOWR[3])
                else: s.P(x, y1 + 1, LEAF[4]); s.P(x, y1, LEAF[3] if x % 3 == 0 else s.G(x, y1))
        if shut:                                                                # 덧창(양옆 판)
            for y in range(y0, y1):
                for x in (x0 - 4, x0 - 3, x1 + 2, x1 + 3):
                    s.P(x, y, shut[4] if (y - y0) % 3 else shut[2])
                s.P(x0 - 5, y, shut[1]); s.P(x1 + 4, y, shut[1])
        s.windows.append((x0, y0, x1, y1))
    # ---- 발코니(철 난간)
    def balcony(s, b0, b1, k, slab=True):
        """b0..b1(포함) 베이, k 층 바닥선 위에 철 난간. 바닥판은 앞으로 3화소."""
        yb = s.storey_top(k) + STOREY - 2 if k else s.y_gf - 2
        x0 = b0 * 16 + 1; x1 = (b1 + 1) * 16 - 1
        if slab:
            for x in range(x0 - 1, x1 + 1):
                s.P(x, yb, TRIM[6]); s.P(x, yb + 1, TRIM[4]); s.P(x, yb + 2, TRIM[2]); s.P(x, yb + 3, ASH[1])
            for bx in range(b0, b1 + 1):                                        # 받침돌(까치발)
                for xx in (bx * 16 + 3, bx * 16 + 12):
                    s.P(xx, yb + 3, TRIM[4]); s.P(xx + 1, yb + 3, TRIM[2]); s.P(xx, yb + 4, TRIM[3]); s.P(xx + 1, yb + 4, ASH[1]); s.P(xx, yb + 5, TRIM[2])
        rt = yb - 9
        for x in range(x0, x1):
            s.P(x, rt, IRON[5]); s.P(x, rt + 1, IRON[3]); s.P(x, yb - 1, IRON[3])
            if (x - x0) % 3 == 0:
                for y in range(rt + 2, yb - 1): s.P(x, y, IRON[4] if y < rt + 4 else IRON[3])
                s.P(x + 1, rt + 4, IRON[1])
            elif (x - x0) % 3 == 1:
                s.P(x, rt + 5, IRON[2])
        for y in range(rt, yb): s.P(x0, y, IRON[5]); s.P(x1 - 1, y, IRON[2])
    def balconette(s, bx, k):
        """창 하나 앞 작은 쇠 난간(타운하우스)."""
        x0 = bx * 16 + 2; x1 = x0 + 12; yb = s.storey_top(k) + STOREY - 6
        for x in range(x0, x1):
            s.P(x, yb - 6, IRON[5]); s.P(x, yb, IRON[3])
            if (x - x0) % 2 == 0:
                for y in range(yb - 5, yb): s.P(x, y, IRON[4] if (y + x) % 4 else IRON[2])
        for x in range(x0 - 1, x1 + 1): s.P(x, yb + 1, TRIM[5]); s.P(x, yb + 2, TRIM[2])
    # ---- 코니스
    def cornice(s):
        y = s.y_cor
        for x in range(s.W):
            s.P(x, y, TRIM[6]); s.P(x, y + 1, TRIM[5])
            s.P(x, y + 2, TRIM[4] if x % 3 else TRIM[2]); s.P(x, y + 3, TRIM[3] if x % 3 else TRIM[1])  # 이빨 장식
            s.P(x, y + 4, TRIM[2]); s.P(x, y + 5, ASH[1])
    # ---- 맨사르드 지붕
    def mansard(s, dormers=(), chimneys=(), ends=True):
        yt = s.y_roof; yf = yt + MTOP; yc = s.y_cor
        face = tex_tones(*SLATEF_AT, s.W, MANS, 35, 205, 1, 4)
        top = tex_tones(*SLATE_AT, s.W, MTOP, 35, 205, 2, 5, dy=4)
        e = 5 if ends else 0
        for y in range(yt, yc):
            for x in range(s.W):
                if y < yf:
                    t = top[y - yt, x]; c = ZINC[t]
                    if y == yt: c = ZINC[6]
                    elif y == yt + 1: c = ZINC[4]
                    if y == yf - 1: c = ZINC[2]
                else:
                    j = y - yf; t = face[j, x]
                    if j < 3: t = min(4, t + 1)                                 # 꺾인 모(맨사르드 어깨) 살짝 밝게
                    c = SLATE[t]
                    if j == 0: c = ZINC[5]
                    if j == MANS - 1: c = SLATE[1]
                # 양 끝 경사(맨사르드 끝면): 왼쪽 밝게·오른쪽 어둡게
                if e:
                    k = (y - yt) / (yc - yt); edge = e * (1 - k)
                    if x < edge or x > s.W - 1 - edge:
                        continue
                    if x < edge + 1: c = ZINC[5]
                    elif x > s.W - 2 - edge: c = SLATE[1]
                s.P(x, y, c)
        for bx in dormers: s.dormer(bx)
        for (bx, dx) in chimneys: s.chimney(bx * 16 + dx)
    def dormer(s, bx, kind=None):
        """맨사르드 면에서 튀어나온 다락창: 밝은 돌 테·세모(또는 둥근) 박공 지붕·창 하나. 베이 가운데 12화소."""
        kind = kind or ('round' if (bx + s.seed) % 3 == 0 else 'pedi')
        x0 = bx * 16 + 2; x1 = x0 + 12; yb = s.y_cor; yt = yb - 21
        for y in range(yt + 6, yb):
            for x in range(x0, x1):
                c = TRIM[3]
                if x in (x0, x0 + 1): c = TRIM[5] if x == x0 else TRIM[4]
                if x in (x1 - 1, x1 - 2): c = TRIM[1] if x == x1 - 1 else TRIM[2]
                s.P(x, y, c)
        gx0, gx1 = x0 + 3, x1 - 3
        for y in range(yt + 8, yb - 2):
            for x in range(gx0, gx1):
                s.P(x, y, GLASS[1] if y < yt + 11 else GLASS[2])
        s.P(gx0 + 1, yt + 10, GLASS[5]); s.P(gx0 + 2, yt + 9, GLASS[4])
        for y in range(yt + 8, yb - 2): s.P(gx0 + 2, y, TRIM[4]) if False else s.P((gx0 + gx1) // 2, y, TRIM[4])
        s.P(gx0, yt + 13, TRIM[4]); s.P(gx1 - 1, yt + 13, TRIM[4])
        for x in range(gx0, gx1): s.P(x, yt + 13, TRIM[4]); s.P(x, yb - 2, TRIM[6]); s.P(x, yb - 1, TRIM[3])
        cx = (x0 + x1) / 2
        if kind == 'pedi':                                                      # 세모 박공
            for y in range(yt, yt + 7):
                half = (y - yt + 1) * 7 / 7
                for x in range(x0 - 1, x1 + 1):
                    d = abs(x + 0.5 - cx)
                    if d <= half: s.P(x, y, (TRIM[6] if x < cx else TRIM[4]) if d > half - 2 else TRIM[3])
            for x in range(x0 - 1, x1 + 1): s.P(x, yt + 7, TRIM[2])
        else:                                                                   # 둥근 박공
            for y in range(yt, yt + 7):
                for x in range(x0 - 1, x1 + 1):
                    d = ((x + 0.5 - cx) / 7.0) ** 2 + ((y - yt - 7) / 7.0) ** 2
                    if d <= 1.0: s.P(x, y, TRIM[6] if d > 0.62 and x < cx else TRIM[4] if d > 0.62 else TRIM[3])
            for x in range(x0 - 1, x1 + 1): s.P(x, yt + 7, TRIM[2])
        for y in range(yt + 7, yb): s.P(x1, y, SLATE[0])                        # 오른쪽 그늘
    def chimney(s, x):
        """윗지붕 위로 솟은 굴뚝 머리(돌, 갓돌, 연통 둘)."""
        y1 = s.y_roof + MTOP - 2; y0 = s.y_roof - 11
        for y in range(y0, y1):
            for xx in range(x, x + 8):
                c = ASH[4] if xx == x else ASH[3] if xx < x + 6 else ASH[1]
                if (y - y0) % 4 == 3: c = ASH[2] if xx < x + 6 else ASH[1]
                s.P(xx, y, c)
        for xx in range(x - 1, x + 9): s.P(xx, y0, TRIM[6]); s.P(xx, y0 + 1, TRIM[3])
        for (px_, c) in ((x + 1, BRICK[4]), (x + 5, BRICK[3])):
            for y in range(y0 - 3, y0):
                s.P(px_, y, c); s.P(px_ + 1, y, BRICK[2])
            s.P(px_, y0 - 3, BRICK[1]); s.P(px_ + 1, y0 - 3, BRICK[1])
    # ---- 박공 없는 우진각 슬레이트 지붕(낮은 집)
    def hip(s, chimneys=()):
        import ph2
        Rh = s.roofH; y0 = s.y_cor - Rh
        r = ph2.steep_hip('sto', s.W, Rh)
        r = regrade(r, SLATE, 30, 200, 1, 5)
        s.im.alpha_composite(r, (0, y0))
        for (bx, dx) in chimneys:
            x = bx * 16 + dx; yy = y0 + 4
            for y in range(yy - 10, yy + 6):
                for xx in range(x, x + 8): s.P(xx, y, ASH[4] if xx == x else ASH[3] if xx < x + 6 else ASH[1])
            for xx in range(x - 1, x + 9): s.P(xx, yy - 10, TRIM[6]); s.P(xx, yy - 9, TRIM[3])
    # ---- 1층 요소
    def door(s, bx, wide=1, kind='double', step=True, color=None):
        """1층 문: double=쌍여닫이(반원 채광창), single=외짝. bx 시작 베이, wide 베이 수."""
        W_ = wide * 16; x0 = bx * 16 + (2 if wide == 1 else 4); x1 = bx * 16 + W_ - (2 if wide == 1 else 4)
        yb = s.base - 3; yt = s.y_gf + 3
        cx = (x0 + x1) / 2; rr = (x1 - x0) / 2
        Wd = color or WOOD
        for y in range(yt - 2, yb + 1):
            for x in range(x0 - 2, x1 + 2):
                inside = x0 <= x < x1 and y >= yt + rr * 0.6 or (x0 <= x < x1 and (x + 0.5 - cx) ** 2 + ((y - yt - rr * 0.6) * 1.0) ** 2 <= rr * rr)
                ring = (x0 - 2 <= x < x1 + 2) and ((x + 0.5 - cx) ** 2 + ((y - yt - rr * 0.6)) ** 2 <= (rr + 2) ** 2 or y >= yt + rr * 0.6)
                if inside:
                    fan = y < yt + rr * 0.6 + 1
                    if fan: c = GLASS[2] if (int(math.atan2(y - yt - rr * 0.6, x + 0.5 - cx) * 3) % 2) else GLASS[1]
                    else:
                        u = x - x0
                        c = Wd[4] if u % 5 == 1 else Wd[3] if u % 5 in (2, 3) else Wd[2]
                        if kind == 'double' and abs(x + 0.5 - cx) < 1: c = Wd[1]
                        if (y - yt) % 9 == 0: c = Wd[1]
                    s.P(x, y, c)
                elif ring:
                    s.P(x, y, TRIM[5] if x < cx else TRIM[3])
        for x in range(x0, x1):
            s.P(x, int(yt + rr * 0.6) + 1, TRIM[4])
        s.P(int(cx) - 2, yb - 10, AMBER[5]); s.P(int(cx) + 1, yb - 10, AMBER[5])  # 손잡이(놋쇠)
        if step:
            for x in range(x0 - 3, x1 + 3): s.P(x, yb + 1, TRIM[6]); s.P(x, yb + 2, TRIM[3])
    def shopfront(s, b0, b1, frame=None):
        """b0..b1 베이: 큰 진열창(나무 틀, 아래 판벽). 문은 따로."""
        Wd = frame or WOOD
        x0 = b0 * 16 + 1; x1 = (b1 + 1) * 16 - 1; yt = s.y_gf + 9; yb = s.base - 3
        for y in range(yt - 1, yb + 1):
            for x in range(x0, x1):
                if y > yb - 6:
                    c = Wd[3] if (x - x0) % 8 not in (0, 7) else Wd[1]
                    if y == yb - 5: c = Wd[5]
                else:
                    c = GLASS[2] if (y - yt) > 3 else GLASS[1]
                    if (x - x0) % 16 in (0, 15): c = Wd[4] if (x - x0) % 16 == 0 else Wd[1]
                    if y == yt - 1: c = Wd[2]
                s.P(x, y, c)
            s.P(x0, y, Wd[5]); s.P(x1 - 1, y, Wd[1])
        for x in range(x0 + 2, x1 - 2, 5):                                     # 하늘 비침
            for i in range(3): s.P(x + i, yt + 3 - i, GLASS[5])
        return (x0, yt, x1, yb - 6)
    def awning(s, b0, b1, A=None, B_=None, scallop=True, y=None):
        """줄무늬 차양: 1층 윗선에 붙어 앞으로 비스듬히 나온다(위에서 본 윗면 + 앞 늘어진 술)."""
        A = A or AWN_R; B_ = B_ or AWN_C
        x0 = b0 * 16; x1 = (b1 + 1) * 16; y0 = (y if y is not None else s.y_gf + 1)
        D = 9
        for yy in range(y0, y0 + D + 4):
            for x in range(x0, x1):
                st = ((x - x0) // 3) % 2
                R_ = A if st == 0 else B_
                if yy < y0 + D:
                    k = 5 - (yy - y0) * 3 // D
                    c = R_[max(2, k)]
                    if yy == y0: c = IRON[2]
                else:
                    j = yy - y0 - D
                    if scallop and j == 3 and (x - x0) % 3 != 1: continue
                    c = R_[3] if j < 2 else R_[2]
                    if j == 0: c = R_[5]
                s.P(x, yy, c)
        for x in range(x0, x1):                                                # 차양 밑 그늘 띠
            for j in range(3):
                p = s.G(x, y0 + D + 4 + j)
                if p[3]: s.P(x, y0 + D + 4 + j, mul(p, 0.62 + 0.12 * j))
        for x in (x0, x1 - 1):                                                  # 철 팔
            for yy in range(y0, y0 + D + 2): s.P(x, yy, IRON[3] if x == x0 else IRON[1])
    def sign(s, x, y, icon, ramp=None, hang=True):
        """벽에 매단 간판(글자 없음, 그림 기호). icon: bed·cup·loaf·key·bottle·crown·scissors."""
        Rr = ramp or WOOD
        if hang:
            for xx in range(x - 4, x + 6): s.P(xx, y - 3, IRON[4]); s.P(xx, y - 2, IRON[2])
            s.P(x - 4, y - 4, IRON[3]); s.P(x - 4, y - 1, IRON[3]); s.P(x, y - 1, IRON[2]); s.P(x + 5, y - 1, IRON[2])
        bw, bh = 12, 9; x0 = x - 3; y0 = y
        for yy in range(y0, y0 + bh):
            for xx in range(x0, x0 + bw):
                c = Rr[4] if yy == y0 or xx == x0 else Rr[1] if yy == y0 + bh - 1 or xx == x0 + bw - 1 else Rr[2]
                s.P(xx, yy, c)
        I = ICONS[icon]; ix = x0 + 2; iy = y0 + 2
        for j, row in enumerate(I):
            for i, ch in enumerate(row):
                if ch == '#': s.P(ix + i, iy + j, AMBER[5])
                elif ch == '+': s.P(ix + i, iy + j, AMBER[3])
    def lamp(s, x, y):
        """벽등(쇠 팔에 매단 유리 등, 켜짐)."""
        for xx in range(x, x + 4): s.P(xx, y, IRON[3])
        for yy in range(y + 1, y + 6):
            for xx in range(x + 2, x + 6): s.P(xx, yy, AMBER[5] if yy in (y + 2, y + 3) else AMBER[3])
        for xx in range(x + 1, x + 7): s.P(xx, y + 1, IRON[4]); s.P(xx, y + 6, IRON[2])
    def drainpipe(s, x, y0=None, y1=None):
        """빗물 홈통: 처마 깔때기에서 땅까지 내려오는 쇠관(2화소 + 이음 쇠띠)."""
        y0 = s.y_cor + 2 if y0 is None else y0; y1 = s.base if y1 is None else y1
        for xx in range(x - 1, x + 3): s.P(xx, y0, IRON[4]); s.P(xx, y0 + 1, IRON[2])
        for y in range(y0 + 2, y1 + 1):
            s.P(x, y, IRON[4]); s.P(x + 1, y, IRON[2])
            if (y - y0) % 12 == 0: s.P(x - 1, y, IRON[3]); s.P(x + 2, y, IRON[1])
        s.P(x + 2, y1, IRON[3]); s.P(x + 3, y1, IRON[2])
    def done(s, k=0.62):
        return fin(s.im, k)

ICONS = {
 'bed':    ["........", "#.......", "#.++....", "#.++####", "########", "#......#"],
 'cup':    ["..#.#...", "........", ".######.", ".#####.#", ".######.", "..####.."],
 'loaf':   ["........", "..####..", ".#+#+##.", "########", ".######.", "........"],
 'key':    [".##.....", "#..#....", "#..#####", ".##..#.#", "........", "........"],
 'bottle': ["...##...", "...##...", "..####..", "..#++#..", "..####..", "..####.."],
 'crown':  ["#..#..#.", "##.#.##.", "#######.", "#+#+#+#.", "#######.", "........"],
 'scissor':["#....#..", ".#..#...", "..##....", "..##....", ".#..#...", "##..##.."],
 'boot':   ["...##...", "...##...", "...##...", "...###..", "..#####.", "..######"],
}
