# 사막 성 외관 조각 — 성벽(앞면·옆 통로)·둥근 탑·문루·본관(돔)·무너진 벽(모래 폭포)·모래 속 내림 계단·바깥 망루 잔해.
# 석재 = dp_art.sash(버들항 성 마름돌 castle6.ash 구조, 사암 램프). 3/4(윗면 + 앞면), 빛 왼쪽 위, pz.fin 안쪽 윤곽. 결정적.
import math
from dc_base import *

# ---------------------------------------------------------------- 공통: 앞면 한 화소(마름돌 + 층 띠 + 받침돌)
def _face(x, y, top, bot, seed, k=1.0, plinth=7):
    """앞면 화소: top~bot(포함) 사이. 위 3px 은 처마 그늘, 아래 plinth px 는 굵은 받침돌(밖으로 1px 벌어짐), 맨 아래 그늘."""
    if y >= bot - plinth + 1:
        z = y - (bot - plinth + 1)
        c = mix(stone(x, y, bw=24, bh=7, seed=seed + 3), SS[5], 0.18)
        if z == 0: c = SS[6]
        if y >= bot - 1: c = SS[3] if y == bot - 1 else SS[2]
    else:
        c = mul(stone(x, y - top, seed=seed), 0.93)                  # 앞면은 윗면(판석)보다 한 단 어둡다
        if y - top < 3: c = mul(c, (0.7, 0.8, 0.9)[y - top])
    return mul(c, k) if k != 1.0 else c

# ================================================================ 성벽 앞면 (n칸 x 5줄)
def wall_front(n=4, seed=0, slits=True, buried=None, breach=None, banners=()):
    """성벽 n칸 x 5줄: 줄 0~1 = 성벽 위 통로(뒤 낮은 턱 + 판석 + 앞 가장자리 성가퀴), 줄 2~4 = 햇빛 받은 사암 앞면(층 띠 하나,
    화살 구멍, 굵은 받침돌, 발치 그늘). buried = 기둥마다 묻힌 높이(px) 함수 — 아래층 반원 창 머리가 모래 위로 보인다.
    breach = (x0, x1) 화소 — 그 폭의 성가퀴·윗단이 무너져 계단꼴로 깨졌다(모래 폭포 자리)."""
    W, H = n * 16, 80; px = Px(W, H)
    top, bot = 24, 79
    brk = {}
    if breach:
        bx0, bx1 = breach
        for x in range(bx0, bx1):
            u = (x - bx0) / max(1, bx1 - bx0 - 1)
            depth = int(14 + 16 * math.sin(math.pi * u) + (H_(x // 4, 7, seed) - 0.5) * 8)
            brk[x] = depth                                              # 깨진 윗선: 통로 윗면에서 depth px 아래까지 사라짐
    for y in range(H):
        for x in range(W):
            if y < 2: c = SS[5] if y == 0 else SS[3]
            elif y < 16: c = slab(x, y, seed)
            elif y < top: c = None
            else: c = _face(x, y, top, bot, seed)
            if c is not None: px.put(x, y, c)
    merlons(px, 16, 0, W)
    for y in range(top, top + 3):                                       # 성가퀴 밑 그늘
        for x in range(W): px.shift(x, y, 0.78)
    string_course(px, 0, W, 44)
    if slits:
        for k in range(n):
            if k % 2 == 1 and not (breach and breach[0] - 4 <= k * 16 + 7 <= breach[1] + 4): slit(px, k * 16 + 7, 53, 9)
    for (bx, col) in banners:                                          # 걸린 천(무늬 없음)
        _pennant(px, bx, 26, 26, col)
    if breach:
        for x, d in brk.items():
            yb = 2 + d                                                  # 새 윗선
            for y in range(0, yb): px.put(x, y, (0, 0, 0), 0)
            px.put(x, yb, SS[6]); px.put(x, yb + 1, SS[5]); px.put(x, yb + 2, SS[3])
            for y in range(yb + 3, min(bot - 8, yb + 9)):               # 깨진 단면(거친 속돌)
                if H_(x // 3, y // 3, seed + 5) > 0.45: px.put(x, y, mix(SS[3], BR[3], 0.4))
    im = fin_sel(px.im, 'S')                                            # 보정: 안뜰·이웃 성벽 쪽 회색 테 없음
    if buried:
        ip = Px(W, H); ip.paste(im, 0, 0)
        # 아래층 반원 창 머리: 받침돌 바로 위, 불규칙한 간격. 모래가 대부분 덮어 머리만 보인다
        for k, wx in enumerate(range(10, W - 16, 52)):
            wx2 = wx + int(H_(k, 5, seed) * 14) - 7
            if 0 <= wx2 < W - 12: arch_open(ip, wx2, 52, 9, 20, lattice=(k % 2 == 1))
        sand_bank(ip, 0, W, H, buried, seed + 11)
        im = ip.im
    return im

def _pennant(px, x0, y0, h, col='crimson'):
    """벽에 건 긴 천(무늬 없는 두 색 띠, 아래 끝 갈래). 상표·문장 없음."""
    R = RAMPS[col]; B2 = INDIGO if col == 'crimson' else CRIMSON
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + 8):
            u = x - x0
            if y > y0 + h - 4 and abs(u - 3.5) < (y - (y0 + h - 4)) * 1.2: continue
            c = R[5] if u < 2 else (R[4] if u < 6 else R[3])
            if u in (1, 6) and y > y0 + 1: c = B2[4] if u == 1 else B2[3]
            if (y - y0) % 7 == 6: c = mul(c, 0.86)
            px.put(x, y, c)
    for x in range(x0 - 1, x0 + 9): px.put(x, y0, WOOD[5] if x < x0 + 4 else WOOD[3]); px.put(x, y0 - 1, WOOD[2])

def wall_front_buried():
    """모래에 묻힌 성벽(4x5): 서쪽 언덕이 앞면 아래 절반을 덮었고 아래층 반원 창 머리만 모래 위로 보인다."""
    return wall_front(4, 21, buried=lambda x: int(30 + 9 * math.sin(x / 13.0 + 0.4) + 4 * math.sin(x / 4.3)))

def wall_front_breach():
    """무너진 성벽 + 모래 폭포(6x5): 성가퀴와 윗단이 계단꼴로 무너졌고, 안뜰에 쌓인 모래가 깨진 틈으로 넘쳐 앞면을 타고 흘러내려
    발치에 모래 둔덕을 만든다. 흐르는 모래는 세로 결(밝은 줄·그늘 줄)과 튀는 알갱이."""
    W = 96; im = wall_front(6, 31, slits=True, breach=(28, 74))
    px = Px(W, 80); px.paste(im, 0, 0)
    _sandfall(px, 30, 72, 16, 80, 31)
    return px.im

def _sandfall(px, x0, x1, ytop, ybot, seed):
    """흘러내리는 모래: 깨진 틈 입술(밝은 마루)에서 넘친 모래가 굵은 줄기 하나와 가는 줄기 둘로 앞면을 타고 흐른다.
    줄기 안 세로 결(빛 6·5 / 바탕 4 / 그늘 3·2), 왼쪽 가장자리 밝은 테·오른쪽 가장자리 그늘 테(벽과 갈라 보이게),
    비스듬히 내려가는 흐름 마디, 아래로 갈수록 넓게 퍼지고 튀는 알갱이."""
    lipw = (x1 - x0)
    streams = [(x0 + lipw * 0.5, lipw * 0.27, 1.0), (x0 + lipw * 0.13, lipw * 0.08, 0.8), (x0 + lipw * 0.88, lipw * 0.07, 0.62)]
    for y in range(ytop, ybot):
        v = (y - ytop) / max(1, ybot - ytop)
        if y - ytop < 4:
            for x in range(x0, x1):
                if H_(x, y, seed + 1) > 0.2 + 0.2 * (y - ytop): px.put(x, y, SA[6] if y - ytop == 0 else (SA[5] if x < x1 - 6 else SA[4]))
            continue
        for (cx, hw0, reach) in streams:
            if v > reach: continue
            hw = hw0 * (0.9 + 0.12 * math.sin(v * 5 + cx) + (1.8 * (v - reach + 0.2) / 0.2 if v > reach - 0.2 else 0))
            xl, xr = int(cx - hw), int(cx + hw)
            for x in range(xl, xr + 1):
                u = (x - xl) / max(1, xr - xl)
                st = H_(x, 3, seed + 3)
                t = 5 if st > 0.55 else (4 if st > 0.2 else 3)
                if u < 0.22: t = min(6, t + 1)
                elif u > 0.78: t = max(2, t - 1)
                if (y - int(x * 0.5) + int(st * 7)) % 10 < 1: t = min(6, t + 1)
                if x == xl: t = 6
                elif x == xr: t = 2
                px.put(x, y, SA[t])
            px.shift(xr + 1, y, 0.72); px.shift(xr + 2, y, 0.86)          # 줄기 오른쪽 그늘(벽에 진다)
        for k in range(3):
            if H_(y, k, seed + 6) > 0.8:
                cx, hw0, _ = streams[k]
                px.put(int(cx + (H_(y, k, seed + 7) - 0.5) * hw0 * 4), y, SA[5])

def sand_cone(w=64, h=32, seed=41):
    """모래 둔덕(4x2): 모래 폭포가 떨어진 자리·벽 밑에 쌓인 원뿔 더미. 꼭대기는 밝고 튄 자국, 오른쪽 아래 그늘."""
    px = Px(w, h)
    for y in range(h):
        for x in range(w):
            dx = (x + 0.5 - w / 2) / (w / 2 - 1); dy = (h - 1 - y) / (h - 2)
            prof = (1 - abs(dx) ** 1.6) * (0.96 + 0.08 * math.sin(x / 3.0 + seed))
            if dy > prof: continue
            lum = 0.5 + 0.55 * (prof - dy) * 0 + 0.35 * (-dx) + 0.45 * (dy / max(0.05, prof)) * (1 - abs(dx))
            c = sand_tone(x, y, lum, seed)
            if abs(dy - prof) < 0.07: c = SA[6] if dx < 0.2 else SA[5]
            if ((dy * 14 + dx * 3) % 3) < 0.4 and dy < prof - 0.15: c = SA[3] if dx > 0 else SA[4]
            px.put(x, y, c)
    return px.im

# ================================================================ 성벽 옆 통로(위에서 본 띠) — 옆면 없음
def wall_side(hc=12, seed=5, side='W'):
    """동·서 성벽(2칸 폭 x hc줄): 위에서 내려다본 통로 판석 띠, 바깥 가장자리엔 성가퀴 돌기(윗면 밝음 + 남쪽 앞모 그늘),
    안쪽 가장자리엔 낮은 턱. 옆면은 보이지 않는다(3/4). 안뜰 쪽으로 3px 그림자는 지도에서 그린다."""
    W, H = 32, hc * 16; px = Px(W, H)
    outer = range(0, 6) if side == 'W' else range(W - 6, W)
    inner = (W - 3, W) if side == 'W' else (0, 3)
    for y in range(H):
        for x in range(W):
            c = slab(x, y + seed * 7, seed)
            if inner[0] <= x < inner[1]: c = SS[6] if (x == inner[0] if side == 'W' else x == 0) else SS[4]
            if x in outer:
                ph = y % 10
                if ph < 6:                                              # 성가퀴 돌(윗면)
                    c = SS[6] if ph == 0 else (SS[5] if ph < 4 else SS[4])
                    if (side == 'W' and x == 5) or (side == 'E' and x == W - 6): c = SS[3]
                else:                                                   # 총안: 앞(남) 돌의 그늘 + 바깥 낮은 턱
                    c = SS[3] if ph == 6 else (SS[2] if ph == 7 else mix(SS[4], SS[3], 0.4))
            if (side == 'W' and x == 0) or (side == 'E' and x == W - 1): c = mul(c, 0.62)   # 바깥 가장자리: 성벽 밖으로 떨어지는 턱(짙은 사암)
            px.put(x, y, c)
    return fin_sel(px.im, '')                                           # 보정: 둘레 윤곽 없음(안뜰 쪽 회색 테가 원인이었다)

# ================================================================ 둥근 탑 (4x8칸)
def round_tower(seed=0, bury=None, flip=False):
    """모서리 둥근 탑(4x8): 꼭대기 둥근 성가퀴 고리(윗면 판석 + 앞 반쪽 돌기), 원통 몸통(돌 줄이 앞으로 휘고, 왼쪽 밝고 오른쪽 어둡다),
    층 띠 고리, 화살 구멍, 살창 반원 창, 아래 벌어진 받침돌. bury = 몸통 밑을 덮은 모래 높이(px) 함수."""
    W, H = 64, 128; px = Px(W, H)
    cx, rx = 32.0, 27.5; ty, ry = 16.0, 10.0; yb = 116
    def bend(x): return math.sqrt(max(0.0, 1 - ((x + 0.5 - cx) / rx) ** 2))
    # 몸통
    for x in range(W):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        b = bend(x); U = int(round(math.asin(max(-1, min(1, dx))) * rx * 1.15 + 80))
        lum = 0.9 + 0.22 * (-dx) - 0.2 * dx * dx
        y0 = int(ty + ry * b); y1 = int(yb + 5 * b)
        for y in range(y0, y1 + 1):
            yy = y - 6 * b                                              # 돌 줄이 가운데로 휜다(볼록한 앞면)
            if y >= y1 - 8:
                c = mix(stone(U, int(yy), bw=22, bh=7, seed=seed + 3), SS[5], 0.15)
                if y == y1 - 8: c = SS[6]
                if y >= y1 - 1: c = SS[2]
            else:
                c = stone(U, int(yy), seed=seed)
                if y - y0 < 3: c = mul(c, (0.66, 0.78, 0.9)[y - y0])
            px.put(x, y, mul(c, max(0.62, min(1.1, lum))))
        # 층 띠 고리
        ys = int(54 + 6 * b)
        for j, cc in enumerate((SS[6], SS[5], SS[3], SS[2])): px.put(x, ys + j, mul(cc, max(0.66, min(1.1, lum))))
    # 꼭대기: 고리 윗면 + 속 바닥(어둡다) + 앞 성가퀴
    px.ell(cx, ty, rx, ry, lambda x, y, dx, dy: slab(x, y, seed + 1) if dx * dx + dy * dy > 0.55 else None)
    px.ell(cx, ty + 1, rx - 6, ry - 3.6, lambda x, y, dx, dy: mix(slab(x, y, seed + 2), SS[3], 0.55) if dy < -0.2 else mix(slab(x, y, seed + 2), SS[4], 0.35))
    px.ell(cx, ty, rx, ry, lambda x, y, dx, dy: (SS[6] if dy < 0 and dx < 0.3 else SS[5]) if dx * dx + dy * dy > 0.86 else None)
    for x in range(int(cx - rx) + 1, int(cx + rx)):                    # 앞 반쪽 성가퀴 돌기(9px 마다 5px)
        b = bend(x); yr = int(ty + ry * b)
        if (x + 3) % 9 < 5:
            for j in range(5):
                c = SS[6] if j == 0 else (SS[5] if j < 3 else SS[4])
                if (x + 3) % 9 == 4: c = SS[3]
                px.put(x, yr - 4 + j, c)
    slit(px, 30, 66, 10); slit(px, 14, 30, 8); slit(px, 46, 30, 8)
    arch_open(px, 27, 86, 9, 15, lattice=True)
    im = px.fin()
    if bury:
        ip = Px(W, H); ip.paste(im, 0, 0); sand_bank(ip, 0, W, H, bury, seed + 7); im = ip.im
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im

def round_tower_buried():
    """반쯤 묻힌 둥근 탑(4x8): 서쪽 모래 언덕이 몸통 아래 절반을 덮어 살창 창도 반만 보인다."""
    return round_tower(seed=7, bury=lambda x: int(44 + 10 * math.sin(x / 11.0) + 3 * math.sin(x / 3.7) - 0.18 * x))

# ================================================================ 문루 (8x9칸)
def gatehouse():
    """성문 문루(8x9): 양쪽 네모 탑(꼭대기 판석 + 성가퀴, 붉은 천, 화살 구멍, 층 띠) 사이 낮은 통로 위 성가퀴,
    가운데 2칸 폭 반원 아치(쐐기돌, 올린 쇠창살 이빨, 안쪽으로 열어 젖힌 두 나무 문짝, 깊은 그늘), 아치 위 갈매기 띠.
    가운데 두 열이 걷는 통로."""
    W, H = 128, 144; px = Px(W, H)
    TL, TR = (0, 44), (84, 128)
    # 가운데 벽체(통로 위)
    for y in range(36, H):
        for x in range(36, 92):
            if y < 38: c = SS[5] if y == 36 else SS[3]
            elif y < 50: c = slab(x, y, 61)
            elif y < 58: c = None
            else: c = _face(x, y, 58, H - 1, 61, plinth=6)
            if c is not None: px.put(x, y, c)
    merlons(px, 50, 36, 92)
    for y in range(58, 61):
        for x in range(36, 92): px.shift(x, y, 0.78)
    chevron(px, 44, 84, 64, 4)
    for y in range(58, H - 1):                                          # 왼쪽 탑이 가운데 벽체에 드리운 그늘
        for x in range(44, 50): px.shift(x, y, 0.72 + 0.04 * (x - 44))
    # 탑 둘
    for (x0, x1), sd in ((TL, 71), (TR, 73)):
        for y in range(H):
            for x in range(x0, x1):
                if y < 2: c = SS[5] if y == 0 else SS[3]
                elif y < 14: c = slab(x, y, sd)
                elif y < 22: c = None
                else: c = _face(x, y, 22, H - 1, sd, plinth=8)
                if c is not None: px.put(x, y, c)
                if x == x0 and y >= 20: px.put(x, y, SS[6])
                if x >= x1 - 2 and y >= 20: px.shift(x, y, 0.8)
        merlons(px, 14, x0, x1, step=11, mw=7)
        for y in range(22, 25):
            for x in range(x0, x1): px.shift(x, y, 0.78)
        string_course(px, x0, x1, 70)
        slit(px, x0 + 21, 82, 10)
        slit(px, x0 + 12, 34, 8); slit(px, x0 + 30, 34, 8)
        arch_open(px, x0 + 17, 104, 10, 18, lattice=True)
    _pennant(px, 18, 46, 22, 'crimson'); _pennant(px, 102, 46, 22, 'crimson')
    # 아치(48..79)
    cx = 64.0; ax0, ax1 = 48, 80; spring = 100; r = 16.0
    def opn(x, y, rr=r): return ax0 - (rr - r) <= x < ax1 + (rr - r) and (y >= spring or math.hypot(x + 0.5 - cx, spring - (y + 0.5)) <= rr)
    for y in range(70, H):
        for x in range(40, 88):
            if opn(x, y):
                d = (y - (spring - r)) / (H - (spring - r))
                c = mix(DARK7[1], DARK7[3], 0.0)
                if x < ax0 + 3: c = mix(SS[2], DARK7[3], 0.5)            # 왼 볼(빛이 조금 든다)
                elif x >= ax1 - 3: c = DARK7[1]
                if y >= H - 12: c = mix(mix(SA[2], DARK7[2], 0.55 - (y - (H - 12)) * 0.04), SA[3], 0.0)   # 통로 바닥(모래, 안쪽 그늘)
                px.put(x, y, c)
            elif opn(x, y, r + 4) and y < spring + 4:
                ang = math.degrees(math.atan2(spring - (y + 0.5), x + 0.5 - cx))
                c = SS[6] if x < cx else SS[4]
                if int(ang + 180) % 18 < 2: c = SS[2]
                px.put(x, y, c)
    for x in range(ax0 + 2, ax1 - 2):                                   # 올린 쇠창살 이빨
        if (x - ax0) % 5 == 2 and opn(x, spring - 10):
            top = int(spring - math.sqrt(max(0, r * r - (x + 0.5 - cx) ** 2)))
            for y in range(top + 1, spring - 6): px.put(x, y, STEEL[3])
            px.put(x, spring - 6, STEEL[5]); px.put(x, spring - 5, STEEL[2])
    for y in range(spring - 8, spring - 6):
        for x in range(ax0 + 1, ax1 - 1): px.put(x, y, STEEL[2] if y == spring - 7 else STEEL[4])
    for (dx0, dx1) in ((ax0, ax0 + 6), (ax1 - 6, ax1)):                 # 열어 젖힌 문짝(통로 볼에 붙음)
        for y in range(spring - 2, H - 6):
            for x in range(dx0, dx1):
                u = x - dx0
                c = WOOD[4] if u < 2 else WOOD[3]
                if (y - spring) % 12 in (3, 4): c = STEEL[3] if (y - spring) % 12 == 3 else STEEL[2]
                if dx0 > cx: c = mul(c, 0.7)
                px.put(x, y, c)
    return fin_sel(px.im, 'NESW')   # 보정: 모래 위 회색 테 대신 짙은 사암 윤곽

# ================================================================ 본관(돔 지붕 큰 집, 18x12칸)
def keep_hall():
    """본관(18x12): 가운데 높은 북(드럼) 위 반구 돔(세로 갈빗대 여덟, 왼쪽 위 밝음, 놋쇠 꼭지), 평지붕 판석 + 앞 성가퀴,
    양 끝 네모 망루(성가퀴). 앞면 두 층: 위층 살창 반원 창 다섯, 층 띠, 아래층 가운데 큰 문(쇠 징 박은 두 짝 나무 문, 닫힘,
    문틀 쐐기돌, 위 갈매기 띠) + 양옆 살창 창 넷, 기둥 붙임(벽기둥) 여섯, 굵은 받침돌. 문 앞에 모래가 쌓였다."""
    W, H = 288, 192; px = Px(W, H)
    fy0 = 74                                                            # 앞면 시작
    # 지붕 판석(뒤 턱 포함)
    for y in range(40, fy0):
        for x in range(0, W):
            if y < 42: c = SS[5] if y == 40 else SS[3]
            elif y < 66: c = slab(x, y, 81)
            else: c = None
            if c is not None: px.put(x, y, c)
    # 드럼 + 돔
    dcx, drx = 144.0, 34.0
    for x in range(int(dcx - drx), int(dcx + drx) + 1):
        dx = (x + 0.5 - dcx) / drx
        if abs(dx) > 1: continue
        b = math.sqrt(1 - dx * dx); lum = 0.92 + 0.2 * (-dx) - 0.18 * dx * dx
        U = int(math.asin(dx) * drx * 1.1 + 200)
        for y in range(int(34 + 4 * b), int(60 + 4 * b)):
            c = stone(U, int(y - 4 * b), bw=12, bh=6, seed=83)
            if y - (34 + 4 * b) < 2: c = SS[6]
            px.put(x, y, mul(c, max(0.62, min(1.1, lum))))
        for wy in (42,):                                                # 드럼 작은 창(8칸)
            if int(U) % 16 in (6, 7, 8) and abs(dx) < 0.85:
                for y in range(int(wy + 4 * b), int(wy + 4 * b) + 9): px.put(x, y, DARK7[2] if int(U) % 16 != 6 else DARK7[3])
    drx2, dry = 31.0, 30.0
    for y in range(4, 40):
        for x in range(int(dcx - drx2), int(dcx + drx2) + 1):
            dx = (x + 0.5 - dcx) / drx2; dy = (36 - (y + 0.5)) / dry
            if dx * dx + dy * dy > 1: continue
            nz = math.sqrt(max(0, 1 - dx * dx - dy * dy))
            lum = 0.35 + 0.75 * max(0, -0.55 * dx + 0.45 * dy + 0.7 * nz)
            t = 6 if lum > 1.0 else (5 if lum > 0.84 else (4 if lum > 0.62 else (3 if lum > 0.42 else 2)))
            ang = math.atan2(dx, nz + 1e-6)
            if abs((ang / (math.pi / 8)) % 1 - 0.5) > 0.44 and dy < 0.9: t = max(1, t - 1)    # 갈빗대 홈
            if H_(x, y, 85) > 0.95: t = max(2, t - 1)
            px.put(x, y, SS[t] if t < 6 else mix(SS[6], SA[6], 0.5))
    for y in range(0, 7):                                               # 놋쇠 꼭지
        for x in range(141, 148):
            if abs(x + 0.5 - 144.5) <= (1 + y * 0.45 if y < 4 else 2.5 - (y - 4) * 0.4) + 0.5:
                px.put(x, y, BRASS[6] if x < 144 else (BRASS[4] if x < 146 else BRASS[3]))
    # 양 끝 망루(지붕 위로 솟음)
    for (x0, x1) in ((0, 40), (248, 288)):
        for y in range(24, fy0):
            for x in range(x0, x1):
                if y < 26: c = SS[5] if y == 24 else SS[3]
                elif y < 34: c = slab(x, y, 87)
                elif y < 42: c = None
                else: c = stone(x, y, seed=88)
                if y >= 42 and x == x0: c = SS[6]
                if y >= 42 and x >= x1 - 2: c = mul(c, 0.8)
                if c is not None: px.put(x, y, c)
        merlons(px, 34, x0, x1)
        slit(px, x0 + 19, 50, 9)
    merlons(px, 66, 40, 248)
    # 앞면
    for y in range(fy0, H):
        for x in range(W):
            px.put(x, y, _face(x, y, fy0, H - 1, 89, plinth=9))
    for y in range(fy0, fy0 + 3):
        for x in range(40, 248): px.shift(x, y, 0.78)
    string_course(px, 0, W, 122)
    for x0 in (0, 248):                                                 # 망루 앞면 줄(앞으로 나온 모서리)
        for y in range(fy0, H - 9):
            px.put(x0, y, SS[6]); px.put(x0 + 39, y, mul(SS[3], 0.9)); px.put(x0 + 38, y, mul(px.get(x0 + 38, y)[:3], 0.85))
    for bx in (40, 92, 196, 248 - 6):                                   # 벽기둥
        for y in range(fy0 + 3, H - 9):
            for x in range(bx, bx + 6):
                c = SS[5] if x < bx + 2 else (SS[4] if x < bx + 4 else SS[3])
                if (y - fy0) % 16 == 15: c = mul(c, 0.85)
                px.put(x, y, c)
    for wx in (56, 76, 112, 166, 206, 226):                             # 위층 창
        arch_open(px, wx, 88, 8, 20, lattice=True)
    for wx in (14, 56, 76, 206, 226, 262):                              # 아래층 창
        arch_open(px, wx, 136, 8, 22, lattice=True)
    arch_open(px, 14, 88, 8, 18, lattice=True); arch_open(px, 266, 88, 8, 18, lattice=True)
    # 큰 문
    cx = 144.0; dx0, dx1 = 128, 160; spring = 152; r = 16.0
    for y in range(126, H - 2):
        for x in range(118, 170):
            inside = dx0 <= x < dx1 and (y >= spring or math.hypot(x + 0.5 - cx, spring - (y + 0.5)) <= r)
            frame = (dx0 - 6 <= x < dx1 + 6) and (y >= spring or math.hypot(x + 0.5 - cx, spring - (y + 0.5)) <= r + 6)
            if inside:
                u = x - dx0; leaf = 0 if u < 16 else 1
                c = WOOD[4] if (u % 16) < 2 and leaf == 0 else (WOOD[3] if (u % 4) else WOOD[2])
                if leaf == 1: c = mul(c, 0.86)
                if u in (15, 16): c = WOOD[1]
                if (y - spring) % 10 == 4 and y > spring - 8: c = STEEL[3]
                if (y - spring) % 10 == 5 and y > spring - 8: c = STEEL[2]
                if (y - spring) % 10 == 4 and (u % 6) == 3: c = STEEL[6]
                if u in (12, 19) and spring + 14 <= y <= spring + 17: c = BRASS[5] if u == 12 else BRASS[3]   # 문고리
                px.put(x, y, c)
            elif frame:
                ang = math.degrees(math.atan2(spring - (y + 0.5), x + 0.5 - cx))
                c = SS[6] if x < cx else SS[4]
                if y < spring and int(ang + 180) % 20 < 3: c = SS[2]
                if y >= spring and (y - spring) % 9 == 8: c = SS[3]
                px.put(x, y, c)
    chevron(px, 122, 166, 128, 4)
    im = fin_sel(px.im, 'NESW')   # 보정: 안뜰 쪽 회색 테 대신 짙은 사암 윤곽
    ip = Px(W, H); ip.paste(im, 0, 0)
    sand_bank(ip, 110, 180, H, lambda x: int(9 + 5 * math.sin((x - 110) / 70 * math.pi) + 2 * math.sin(x / 3.1)), 91)
    sand_bank(ip, 0, 52, H, lambda x: int(22 - 0.35 * x + 3 * math.sin(x / 4.0)), 92)
    sand_bank(ip, 236, 288, H, lambda x: int(4 + 0.3 * (x - 236) + 2 * math.sin(x / 3.3)), 93)
    return ip.im

def keep_door_cols(): return (8, 9)

# ================================================================ 성벽 끝 무너진 토막 (3x5)
def wall_end_rubble(seed=3):
    """성벽 끝 무너진 토막(3x5): 왼쪽은 온전한 높이(통로 판석·성가퀴 하나), 오른쪽으로 단이 계단꼴로 무너지고 떨어진 마름돌·
    모래 더미로 땅까지 잇는다. 벽이 허공에서 끊기지 않는다."""
    W, H = 48, 80; px = Px(W, H)
    def top_at(x):
        if x < 12: return 24
        blk = (x - 12) // 7                                             # 무너진 단: 돌 한 장(7px) 마다 한 줄(8px)씩 낮아진다
        return 24 + 8 * blk + int(H_(blk, 1, seed) * 4) + (2 if (x - 12) % 7 == 6 else 0)
    for x in range(W):
        yt = int(top_at(x))
        if yt >= H - 12: continue
        for y in range(yt, H):
            c = _face(x, y, 24, H - 1, seed)
            if y == yt: c = SS[6]
            elif y == yt + 1: c = SS[5]
            elif y < yt + 5 and x > 12: c = mix(c, BR[3], 0.35)
            px.put(x, y, c)
    for y in range(0, 24):
        for x in range(0, 13):
            if y < 2: c = SS[5] if y == 0 else SS[3]
            elif y < 16: c = slab(x, y, seed)
            else: continue
            px.put(x, y, c)
    merlons(px, 16, 0, 13)
    string_course(px, 0, 22, 44)
    im = px.fin()
    ip = Px(W, H); ip.paste(im, 0, 0)
    for (bx, by, bw, bh, s) in ((26, 58, 10, 7, 1), (36, 66, 9, 6, 2), (20, 68, 11, 7, 3), (33, 72, 12, 6, 4)):
        PY._block(ip.p, W, H, bx, by, bw, bh, 300 + s)
    sand_bank(ip, 14, W, H, lambda x: int(6 + 5 * math.sin((x - 14) / 34 * math.pi)), seed + 9)
    return ip.im

# ================================================================ 모래 속 내림 계단 (4x4)
def sand_stairwell():
    """모래 속으로 내려가는 계단 입구(4x4): 모래 바닥에 뚫린 사암 계단 구멍 — 양옆·뒤 낮은 난간벽(윗면 갓돌), 남쪽이 입구,
    북쪽으로 내려갈수록 어두워지는 디딤 8단, 맨 안쪽은 반원 아치 문(어둠). 디딤과 양 귀퉁이에 모래가 흘러들었다.
    가운데 두 열이 걷는 칸(맨 윗줄 아치 칸 = 지하 이동 칸)."""
    W, H = 64, 64; px = Px(W, H)
    # 뒤 벽(구멍 북쪽 안벽 앞면) + 아치 문
    for y in range(4, 26):
        for x in range(8, 56):
            c = mul(stone(x, y, bw=14, bh=6, seed=401), 0.62 + 0.01 * (y - 4))
            px.put(x, y, c)
    arch_open(px, 22, 8, 20, 18)
    # 디딤 8단(위 = 깊고 어둡다, 아래 = 밝다)
    for i in range(8):
        y0 = 26 + i * 4; k = 0.42 + i * 0.075
        for y in range(y0, y0 + 4):
            for x in range(10, 54):
                c = SS[5] if y == y0 else (SS[4] if y < y0 + 3 else SS[2])
                if x < 13: c = mix(c, SS[6], 0.3)
                if x > 50: c = mul(c, 0.85)
                if H_(x, y, 403) > 0.94: c = mix(c, SA[4], 0.6)
                px.put(x, y, mul(c, k))
    # 양옆 난간벽(위에서 본 갓돌 + 안쪽 볼 그늘)
    for (x0, x1, inner) in ((0, 10, 'R'), (54, 64, 'L')):
        for y in range(0, H):
            for x in range(x0, x1):
                u = x - x0
                c = slab(x, y, 405)
                if (inner == 'R' and u >= 8) or (inner == 'L' and u <= 1): c = mul(SS[3], 0.75)
                if y >= H - 4: c = _face(x, y, H - 4, H - 1, 405, plinth=0)
                if u == 0 and inner == 'R': c = mix(c, SS[6], 0.4)
                px.put(x, y, c)
    for y in range(0, 4):                                               # 뒤 난간 갓돌
        for x in range(0, W): px.put(x, y, slab(x, y, 406) if y < 3 else SS[3])
    im = fin_sel(px.im, 'NESW')   # 보정: 모래 위 회색 테 대신 짙은 사암 윤곽
    ip = Px(W, H); ip.paste(im, 0, 0)
    # 흘러든 모래: 디딤 가장자리·아래 귀퉁이
    for i in range(8):
        y0 = 26 + i * 4
        for x in range(10, 54):
            amt = (H_(x // 3, i, 407) * 0.6 + (0.5 if x < 18 or x > 47 else 0)) * (i / 8.0 + 0.3)
            if amt > 0.55 and px.on(x, y0): ip.put(x, y0, SA[5] if amt > 0.8 else SA[4]); ip.put(x, y0 + 1, SA[3])
    sand_bank(ip, 0, 14, H, lambda x: int(10 - 0.5 * x), 408)
    sand_bank(ip, 50, 64, H, lambda x: int(3 + 0.55 * (x - 50)), 409)
    return ip.im

# ================================================================ 바깥 망루 잔해 (3x4)
def watchtower_stump():
    """바깥 망루 잔해(3x4): 모래 언덕 위로 비죽 나온 둥근 망루 그루터기 — 윗선이 들쭉날쭉 무너졌고 속이 어둡게 보인다,
    화살 구멍 하나, 밑동을 모래가 덮었다, 떨어진 마름돌."""
    W, H = 48, 64; px = Px(W, H)
    cx, rx = 24.0, 18.5
    tops = {}
    for x in range(W):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        b = math.sqrt(1 - dx * dx)
        yt = int(14 + 10 * (H_(int((x + 3) / 5), 2, 611)) + 6 * max(0, dx) - 2 * b)
        tops[x] = yt
        lum = 0.92 + 0.22 * (-dx) - 0.2 * dx * dx
        U = int(math.asin(dx) * rx * 1.15 + 40)
        for y in range(yt, int(56 + 4 * b)):
            c = stone(U, int(y - 5 * b), seed=612)
            if y == yt: c = SS[6]
            elif y == yt + 1: c = SS[4]
            px.put(x, y, mul(c, max(0.62, min(1.1, lum))))
    # 속(무너진 위로 보이는 안쪽 어둠: 뒤 안벽)
    px.ell(cx, 18, rx - 4, 6, lambda x, y, dx, dy: (mul(SS[2], 0.7) if dy > -0.2 else SS[3]) if y < tops.get(x, 0) + 6 and y > tops.get(x, 99) - 1 else None)
    slit(px, 26, 34, 9)
    im = px.fin()
    ip = Px(W, H); ip.paste(im, 0, 0)
    sand_bank(ip, 0, W, H, lambda x: int(14 + 6 * math.sin(x / 9.0 + 1) + 2 * math.sin(x / 3.0)), 613)
    PY._block(ip.p, W, H, 34, 52, 9, 6, 614); PY._block(ip.p, W, H, 4, 54, 8, 6, 615)
    return ip.im

# ================================================================ 길 표지 화톳불 기둥 (1x3)
def road_pylon():
    """길 표지 화톳불 기둥(1x3): 네모 사암 기둥(윗면 갓돌, 갈매기 띠 하나), 꼭대기 놋쇠 그릇에 타는 불. 성문으로 오는 길 양옆에."""
    W, H = 16, 48; px = Px(W, H)
    for y in range(14, 46):
        for x in range(3, 13):
            c = stone(x, y, bw=10, bh=6, seed=621)
            if x == 3: c = SS[6]
            if x >= 11: c = mul(c, 0.8)
            if y in (14, 15): c = SS[6] if y == 14 else SS[5]
            if y >= 43: c = SS[3] if y == 43 else SS[2]
            px.put(x, y, c)
    chevron(px, 4, 12, 24, 3)
    for y in range(10, 14):
        for x in range(2, 14):
            hw = 6 - (13 - y) * 0.6
            if abs(x + 0.5 - 8) <= hw: px.put(x, y, BRASS[5] if x < 7 else (BRASS[4] if x < 10 else BRASS[2]))
    for y in range(1, 10):
        for x in range(4, 12):
            hw = (y - 0.5) * 0.45 if y < 7 else 3.2
            if abs(x + 0.5 - 8 + (0.6 if y < 4 else 0)) <= hw:
                px.put(x, y, FIRE[6] if (y > 6 and abs(x + 0.5 - 8) < 1.5) else (FIRE[5] if y > 4 else FIRE[4]))
    im = px.fin()
    ground_shadow(im, 9, 46, 6, 1.5)
    return im
