# 사막 성 지하 기계실 조각 — 대형 기어 문, 벽 톱니, 피스톤 기관, 보일러, 놋쇠 관, 밸브, 조종대, 바닥 톱니 구덩이, 톱니 상자,
# 모래 새는 틈, 모래 계단(오름) + 계단 아치, 부서진 기계, 쇠사슬 갈고리, 김 창살, 계기판, 벽 등.
# 기계 재질은 future-ruins 「기계 재질 규약」을 따른다: 강철·녹·놋쇠·전선 7단 램프, 판 줄눈(아래·오른 1px 홈, 위·왼 1px 빛 모),
# 리벳(모서리 2px 안, 긴 변 6px 간격, 톤 6 한 점 + 오른쪽 아래 톤 1), 관 지름 6px(이음 테 16px 마다, 폭 2)·12px(32px 마다, 폭 3),
# 원통 6단 음영, 녹은 줄눈·리벳 밑에서 아래로 흐른다. 글자·숫자·상표 없음(계기 눈금은 점만). 결정적.
import math
from dc_base import *
from dc_court import cyl_t

def K(mat, k): return RAMPS[mat][clamp(k, 0, 6)]

def panels(px, x0, y0, x1, y1, mat='steel', base=4, pw=16, ph=16, stagger=False, rivets=True, face='front', seed=0, rust=0.0):
    """강철판 면(규약 그대로). face='top' 이면 한 단 밝다. rust = 줄눈·리벳 밑 녹 번짐 정도."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            X = x - x0; Y = y - y0
            row = Y // ph; off = (row % 2) * (pw // 2) if stagger else 0
            col = (X + off) // pw; lx = (X + off) % pw; ly = Y % ph
            h = H_(col, row, seed + 11)
            k = base + (1 if face == 'top' else 0) + (1 if h > 0.88 else (-1 if h < 0.12 else 0))
            if face == 'front':
                if x >= x1 - 2: k -= 1
                if y >= y1 - 2: k -= 1
            m = mat
            if ly == ph - 1 or lx == pw - 1: k = 1
            elif ly == 0 or lx == 0: k += 1
            elif ly == ph - 2 or lx == pw - 2: k -= 1
            if rivets and pw >= 8 and ph >= 8:
                ri = lx in (2, pw - 3) and ly in (2, ph - 3)
                if pw > 20 and ly in (2, ph - 3) and lx % 6 == 2 and lx < pw - 3: ri = True
                if ri: k = 6
                elif (lx - 1 in (2, pw - 3) and ly - 1 in (2, ph - 3)): k = 1
            if rust and mat == 'steel' and k != 6:
                d = min(ph - 1 - ly, pw - 1 - lx)
                if H_(x // 2, y // 2, seed + 21) < rust * (0.9 if d < 3 else 0.25) or (lx in (3, pw - 2) and ly > 3 and H_(x, row, seed + 22) < rust * 0.6):
                    m = 'rust'
            px.put(x, y, K(m, k))

def box3(px, x0, y0, x1, y1, top, mat='steel', base=4, seed=0, rivets=True, rust=0.0):
    """3/4 강철 상자: 윗면 top 줄(판, 한 단 밝음) + 앞면 판(32x16 엇갈림)."""
    panels(px, x0, y0, x1, y0 + top, mat, base, pw=24, ph=max(4, top), face='top', seed=seed, rivets=False)
    for x in range(x0, x1): px.put(x, y0, K(mat, 6))
    panels(px, x0, y0 + top, x1, y1, mat, base - 1, pw=32, ph=16, stagger=True, rivets=rivets, seed=seed + 1, rust=rust)
    for x in range(x0, x1): px.put(x, y0 + top, K(mat, 2))

def pipe_h(px, x0, x1, cy, dia=6, mat='brass', flange=True, step=None):
    step = step or (16 if dia <= 8 else 32)
    top = int(round(cy - dia / 2))
    for y in range(top, top + dia):
        t = cyl_t((y - top + .5) / dia)
        for x in range(int(x0), int(x1)): px.put(x, y, K(mat, t))
    if flange:
        fw = 2 if dia <= 8 else 3
        for fx in range(int(x0) + step // 2, int(x1) - 1, step):
            for y in range(top - 1, top + dia + 1):
                t = cyl_t((y - top + 1.5) / (dia + 2))
                for i in range(fw): px.put(fx + i, y, K(mat, clamp(t + (1 if i == 0 else 0) - (1 if i == fw - 1 else 0))))

def pipe_v(px, cx, y0, y1, dia=6, mat='brass', flange=True, step=None):
    step = step or (16 if dia <= 8 else 32)
    left = int(round(cx - dia / 2))
    for x in range(left, left + dia):
        t = cyl_t((x - left + .5) / dia)
        for y in range(int(y0), int(y1)): px.put(x, y, K(mat, t))
    if flange:
        fw = 2 if dia <= 8 else 3
        for fy in range(int(y0) + step // 2, int(y1) - 1, step):
            for x in range(left - 1, left + dia + 1):
                t = cyl_t((x - left + 1.5) / (dia + 2))
                for i in range(fw): px.put(x, fy + i, K(mat, clamp(t + (1 if i == 0 else 0) - (1 if i == fw - 1 else 0))))

def gear(px, cx, cy, r, teeth, mat='brass', spokes=5, hub=None, phase=0.0, ry=None, holes=True):
    """정면(ry=None) 또는 누운(ry=납작) 톱니바퀴: 이(톤 빛 왼쪽 위), 테, 바퀴살 사이 구멍(어둠), 가운데 굴대."""
    ry = ry or r; sq = ry / r
    for y in range(int(cy - ry - 4), int(cy + ry + 5)):
        for x in range(int(cx - r - 4), int(cx + r + 5)):
            dx = x + 0.5 - cx; dy = (y + 0.5 - cy) / sq
            d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            tooth = (math.cos(a * teeth + phase) > 0.15)
            ro = r + (3 if tooth else 0)
            if d > ro: continue
            lit = -0.6 * dx / r - 0.6 * dy / r
            if d > r - 1: t = 5 if lit > 0 else 3                     # 이 끝
            elif d > r - 4: t = 6 if lit > 0.3 else (5 if lit > -0.3 else 3)   # 테
            elif d > r * 0.35 + 2:
                sa = (a * spokes / (2 * math.pi) + phase) % 1
                if holes and (0.18 < sa < 0.82): t = None                 # 살 사이 구멍
                else: t = 5 if lit > 0 else 4
            elif d > r * 0.35: t = 2
            else: t = 6 if (dx < 0 and dy < 0) else 4
            if t is None:
                px.put(x, y, DARK7[2] if dy < 0 else DARK7[1]); continue
            if d > r - 4 and d <= r - 3: t = clamp(t - 1)
            px.put(x, y, K(mat, t))
    px.put(cx - 1, cy - 1, K('steel', 6)); px.put(cx, cy, K('steel', 2))

def gear_flat(px, cx, cy, rx, ry, teeth, mat='brass', thick=2):
    """누운 톱니(위에서 본 3/4): 아래 두께 띠(앞면 그늘), 타원 윗면(왼쪽 위 밝음), 둘레 이(바깥으로 2px 네모 돌기), 안 홈 고리, 굴대."""
    R = RAMPS[mat]
    for k in range(teeth):                                              # 이(먼저 — 윗면이 안쪽을 덮는다)
        a = 2 * math.pi * k / teeth
        ex, ey = cx + (rx + 1.6) * math.cos(a), cy + (ry + 1.0) * math.sin(a)
        t = 5 if (math.cos(a) < 0.2 and math.sin(a) < 0.3) else 3
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            px.put(ex + dx - 0.5, ey + dy - 0.5, R[t])
            px.put(ex + dx - 0.5, ey + dy - 0.5 + thick, R[2])
    for y in range(int(cy - ry - 1), int(cy + ry + thick + 2)):         # 두께 띠
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy - thick) / ry
            if dx * dx + dy * dy <= 1 and y > cy: px.put(x, y, R[2] if dx > 0.3 else R[3])
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):                 # 윗면
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry; d = dx * dx + dy * dy
            if d > 1: continue
            t = 5 if (dx + dy < -0.3) else 4
            if d > 0.78: t = 6 if (dx < -0.2 and dy < 0.2) else 4
            if 0.36 < d < 0.48: t = 2                                     # 홈 고리
            if d < 0.08: t = 6 if dx < 0 else 3                           # 굴대
            elif d < 0.16: t = 2
            px.put(x, y, R[t])

def dial(px, cx, cy, r=4):
    """계기(눈금은 점만, 글자·숫자 없음): 놋쇠 테, 크림 판, 붉은 바늘."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > r + 1: continue
            if d > r - 0.5: px.put(x, y, BRASS[5] if x < cx else BRASS[3])
            else: px.put(x, y, mix(SA[6], (255, 255, 255), 0.3) if d < r - 1.5 else SA[5])
    for k in range(5):
        a = math.pi * (0.85 + k * 0.33); px.put(cx + math.cos(a) * (r - 1.6), cy + math.sin(a) * (r - 1.6), STEEL[2])
    px.line(cx, cy, cx + r * 0.6, cy - r * 0.55, CRIMSON[3])

def glow(im, cx, cy, rad, col, a=70):
    p = im.load(); W, H = im.size
    for y in range(max(0, int(cy - rad)), min(H, int(cy + rad) + 1)):
        for x in range(max(0, int(cx - rad)), min(W, int(cx + rad) + 1)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad
            if d < 1 and p[x, y][3] == 0: p[x, y] = tuple(col) + (int(a * (1 - d) ** 1.5),)
    return im

# ================================================================ 대형 기어 문 (6x4)
def gear_vault_door():
    """대형 기어 문(6x4): 벽 앞면 3줄을 뚫은 둥근 금고 문 — 놋쇠 큰 톱니 고리(이 스물넷, 리벳), 그 안 강철 문판(바퀴살 여섯 놋쇠 빗장,
    가운데 손잡이 바퀴), 둘레 사암 쐐기돌 틀, 아래 줄은 강철 문턱판. 앞면 칸·문턱 줄 모두 막힘(여는 이벤트)."""
    W, H = 96, 64; px = Px(W, H)
    cx, cy = 48.0, 30.0
    for y in range(0, 56):                                              # 쐐기돌 틀(정사각 둘레)
        for x in range(6, 90):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d < 33 or d > 39: continue
            a = math.degrees(math.atan2(y + 0.5 - cy, x + 0.5 - cx))
            c = SSD[5] if (x < cx and y < cy + 10) else SSD[3]
            if int(a + 180) % 20 < 2: c = SSD[1]
            if d > 38: c = SSD[1]
            px.put(x, y, c)
    gear(px, cx, cy, 29, 24, 'brass', spokes=24, holes=False)
    for y in range(int(cy - 24), int(cy + 25)):                         # 강철 문판
        for x in range(int(cx - 24), int(cx + 25)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > 23: continue
            a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            lit = -(x + 0.5 - cx) / 23 - (y + 0.5 - cy) / 23
            t = 4 + (1 if lit > 0.4 else (-1 if lit < -0.5 else 0))
            if d > 21.5: t = 2
            if abs(((a / (math.pi / 3)) + 0.5) % 1 - 0.5) < 0.09 and d > 7: px.put(x, y, BRASS[5] if lit > 0 else BRASS[3]); continue   # 빗장
            if abs(d - 15) < 0.6: t = 2
            elif abs(d - 14) < 0.6: t = 5
            px.put(x, y, K('steel', t))
    for k in range(24):                                                 # 고리 리벳
        a = k * math.pi / 12; px.put(cx + math.cos(a) * 26 - 0.5, cy + math.sin(a) * 26 - 0.5, BRASS[6])
    gear(px, cx, cy, 6, 8, 'steel', spokes=4)                           # 손잡이 바퀴
    for y in range(52, 63):                                             # 문턱판
        for x in range(10, 86):
            k = 5 if y == 52 else (4 if y < 58 else 3)
            if y == 62: k = 1
            if (x - 10) % 16 == 15: k = 1
            if y == 54 and (x - 10) % 16 in (2, 13): k = 6
            if x < 12: k += 1
            px.put(x, y, K('steel', k))
    im = px.fin()
    return im

# ================================================================ 벽 톱니 (3x3, 앞면 장식)
def wall_gear():
    """벽 톱니(3x3, 벽 앞면 장식): 리벳 박은 강철 받침판에 큰 놋쇠 톱니와 맞물린 작은 강철 톱니, 굴대 덮개."""
    W, H = 48, 48; px = Px(W, H)
    panels(px, 4, 4, 44, 44, 'steel', 3, pw=20, ph=20, seed=611, rust=0.25)
    gear(px, 20, 22, 14, 14, 'brass', spokes=5)
    gear(px, 37, 35, 7, 9, 'steel', spokes=4, phase=0.3)
    return px.fin()

# ================================================================ 피스톤 기관 (6x4)
def piston_engine():
    """피스톤 기관(6x4, 기계실 앵커): 리벳 강철 받침대(윗면 + 앞면), 위로 솟은 쌍 실린더(놋쇠 띠·피스톤 막대·위 가로보),
    오른쪽 큰 놋쇠 관성 바퀴(바퀴살 여섯)와 크랭크 막대, 실린더 옆 굵은 증기관, 받침대 앞 계기 둘·녹 흐름. 아래 2줄 막힘."""
    W, H = 96, 64; px = Px(W, H)
    # 관성 바퀴(뒤)
    gear(px, 74, 28, 20, 0, 'brass', spokes=6)
    # 받침대
    box3(px, 2, 38, 94, 63, 9, 'steel', 4, seed=621, rust=0.3)
    # 실린더 둘
    for (x0, sd) in ((10, 0), (32, 1)):
        for y in range(10, 40):
            for x in range(x0, x0 + 16):
                t = cyl_t((x - x0 + 0.5) / 16)
                m = 'steel'
                if (y - 10) % 10 in (0, 1): m = 'brass'
                px.put(x, y, K(m, t))
        px.ell(x0 + 8, 10, 8, 3, lambda x, y, dx, dy: K('steel', 6 if dx < 0 else 4))
        for y in range(2, 10): px.put(x0 + 7, y, STEEL[6]); px.put(x0 + 8, y, STEEL[3])   # 피스톤 막대
    for y in range(1, 5):                                               # 가로보
        for x in range(12, 50): px.put(x, y, K('steel', 6 if y == 1 else (4 if y < 4 else 2)))
    px.line(48, 3, 72, 22, STEEL[5], 2); px.line(48, 5, 72, 24, STEEL[2])     # 크랭크 막대
    px.ell(73, 23, 2.5, 2.5, lambda x, y, dx, dy: BRASS[6] if dx < 0 else BRASS[3])
    pipe_v(px, 6, 14, 40, 6, 'brass')
    pipe_h(px, 4, 12, 16, 6, 'brass', flange=False)
    dial(px, 22, 52, 4); dial(px, 44, 52, 4)
    im = px.fin()
    return im

# ================================================================ 보일러 (2x3)
def boiler():
    """보일러(2x3): 리벳 강철 세로 통(놋쇠 띠 둘, 둥근 윗면 돔, 안전 밸브), 계기 하나, 아래 화실 문 틈으로 주황 불빛. 아래 2줄 막힘."""
    W, H = 32, 48; px = Px(W, H)
    for y in range(8, 46):
        for x in range(2, 30):
            t = cyl_t((x - 2 + 0.5) / 28)
            m = 'steel'
            if y in (16, 17, 34, 35): m = 'brass'
            if (y - 8) % 9 == 4 and (x - 2) % 6 == 3: t = 6
            if y >= 44: t = 1
            px.put(x, y, K(m, t))
    px.ell(16, 8, 14, 5, lambda x, y, dx, dy: K('steel', 6 if (dx < -0.2 and dy < 0.3) else (5 if dx < 0.4 else 3)))
    for y in range(1, 6):
        for x in range(14, 19): px.put(x, y, BRASS[6] if x < 16 else BRASS[3])
    dial(px, 10, 24, 4)
    for y in range(36, 43):                                             # 화실 문
        for x in range(11, 23):
            c = STEEL[2] if (x in (11, 22) or y in (36, 42)) else (FIRE[5] if y in (39, 40) and 13 < x < 21 else STEEL[3])
            px.put(x, y, c)
    im = px.fin(); glow(im, 16, 41, 9, FIRE[4], 60); return im

# ================================================================ 관·밸브
def pipe_floor_h():
    """바닥 놋쇠 관 줄(3x1): 낮은 강철 받침 위로 나란히 지나는 놋쇠 관 둘(지름 6, 이음 테 16px 마다). 벽 앞면 아래를 따라 기계끼리 잇는다."""
    W, H = 48, 16; px = Px(W, H)
    for sx in (6, 38):
        for y in range(9, 15):
            for x in range(sx, sx + 5): px.put(x, y, K('steel', 5 if x == sx else 3))
    pipe_h(px, 0, 48, 5, 6, 'brass'); pipe_h(px, 0, 48, 11, 6, 'brass')
    return px.fin()

def pipe_wall_v():
    """벽 세로 관(1x3, 앞면 장식): 천장에서 내려와 바닥으로 꺾여 드는 놋쇠 관, 가운데 바퀴 밸브."""
    W, H = 16, 48; px = Px(W, H)
    pipe_v(px, 8, 0, 44, 6, 'brass')
    for y in range(40, 47):
        for x in range(4, 13): px.put(x, y, K('brass', cyl_t((y - 40) / 7.0)))
    px.ell(8, 22, 5.5, 2.4, lambda x, y, dx, dy: CRIMSON[5] if (dx * dx + dy * dy > 0.4) and dy < 0 else (CRIMSON[3] if dx * dx + dy * dy > 0.4 else None))
    return px.fin()

def valve_post():
    """바퀴 밸브(1x2): 바닥에서 솟은 놋쇠 관 토막 위 붉은 손잡이 바퀴(위에서 본 타원, 바퀴살 넷)."""
    W, H = 16, 32; px = Px(W, H)
    pipe_v(px, 8, 12, 28, 6, 'brass', flange=False)
    for y in range(26, 31):
        for x in range(3, 14): px.put(x, y, K('steel', 5 if x < 6 else 3) if y < 30 else STEEL[1])
    for y in range(5, 15):
        for x in range(1, 16):
            dx = (x + 0.5 - 8) / 7; dy = (y + 0.5 - 10) / 4
            d = dx * dx + dy * dy
            if 0.55 < d <= 1: px.put(x, y, CRIMSON[5] if dy < 0 else CRIMSON[3])
            elif d <= 0.55 and (abs(dx) < 0.12 or abs(dy) < 0.2): px.put(x, y, CRIMSON[4])
    px.put(8, 10, BRASS[6])
    im = px.fin(); ground_shadow(im, 8, 30.5, 5, 1.2); return im

def lever_console():
    """조종대(2x2): 강철 책상(비스듬한 윗판에 놋쇠 손잡이 레버 셋·계기 둘·청록/호박 표시등), 앞판 리벳. 아래 2줄 막힘."""
    W, H = 32, 32; px = Px(W, H)
    box3(px, 1, 10, 31, 31, 9, 'steel', 4, seed=631, rust=0.2)
    dial(px, 8, 14, 3); dial(px, 24, 14, 3)
    for (lx, ang) in ((13, -0.4), (16, 0.0), (19, 0.5)):
        x1 = lx + int(6 * math.sin(ang)); y1 = 3
        px.line(lx, 15, x1, y1 + 1, STEEL[5]); px.ell(x1 + 0.5, y1 + 0.5, 1.6, 1.6, lambda x, y, dx, dy: BRASS[6] if dx < 0 else BRASS[3])
    for (x, col) in ((6, FB.SIGNAL['cyan']), (26, FB.SIGNAL['amber'])):
        px.put(x, 24, col[5]); px.put(x + 1, 24, col[4]); px.put(x, 25, col[3]); px.put(x + 1, 25, col[2])
    im = px.fin(); glow(im, 6.5, 24.5, 5, FB.SIGNAL['cyan'][4], 45); return im

def floor_gear_pit():
    """바닥 톱니 구덩이(3x2): 바닥판에 뚫린 긴 틈 속에서 반쯤 드러나 도는 누운 놋쇠 큰 톱니, 틈 둘레 강철 테와 경고 띠. 칸 전체 막힘."""
    W, H = 48, 32; px = Px(W, H)
    for y in range(4, 30):
        for x in range(2, 46):
            c = STEEL[4] if (y < 6 or x < 4) else STEEL[2]
            if y >= 28 or x >= 44: c = STEEL[1]
            if (x + y) // 3 % 2 == 0 and (y < 6) and 8 < x < 40: c = FB.WARN[4]
            px.put(x, y, c)
    for y in range(7, 27):
        for x in range(5, 43): px.put(x, y, DARK7[1] if y < 12 else DARK7[2])
    gear_flat(px, 24, 16, 15, 6, 22, 'brass', thick=3)
    for y in range(7, 10):
        for x in range(5, 43): px.put(x, y, DARK7[1])                    # 뒤 안벽 그늘(톱니 위를 덮음)
    return px.fin()

def gear_crate():
    """톱니 상자(1x1): 뚜껑 열린 나무 상자 위로 비죽 나온 예비 놋쇠·강철 톱니."""
    W, H = 16, 16; px = Px(W, H)
    gear(px, 6, 5, 4, 7, 'brass', spokes=3); gear(px, 11, 6, 3, 6, 'steel', spokes=3)
    for y in range(7, 15):
        for x in range(1, 15):
            c = WOOD[5] if y == 7 else (WOOD[4] if x < 12 else WOOD[2])
            if y in (10, 11): c = WOOD[3] if y == 10 else WOOD[2]
            if x in (1, 14) and y > 7: c = WOOD[2]
            px.put(x, y, c)
    return px.fin()

# ================================================================ 모래 새는 틈 (2x3, 앞면 + 바닥)
def sand_leak():
    """모래 새는 틈(2x3): 벽 앞면에 갈라진 검은 틈(들쭉날쭉, 갈라진 돌 모서리 밝음)에서 가는 모래 줄기가 흘러내려 바닥에
    원뿔 둔덕을 쌓는다. 위 2줄은 앞면 장식, 아랫줄 둔덕은 걷는 장식(발이 빠진다)."""
    W, H = 32, 48; px = Px(W, H)
    pts = [(14, 2), (16, 7), (13, 12), (17, 17), (15, 22), (18, 26)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            px.put(x, y, DARK7[0]); px.put(x + 1, y, DARK7[1]); px.put(x - 1, y, SSD[5])
    for y in range(14, 40):                                             # 모래 줄기
        w = 1 + (y - 14) // 12
        for x in range(17 - w, 18 + w):
            if H_(x, y, 641) > 0.2: px.put(x + int(math.sin(y / 4.0)), y, SA[5] if x <= 17 else SA[3])
    im = px.im
    ip = Px(W, H); ip.paste(im, 0, 0)
    PY._sand_heap(ip.p, W, H, 17, 47, 14, 9, 642)
    return ip.im

# ================================================================ 모래 계단(오름) + 계단 아치
def stair_up_sand():
    """사암 오름 계단(4x4): 양옆 낮은 사암 난간벽 사이로 북쪽(위)으로 오르는 디딤 8단, 위로 갈수록 밝다(바깥 빛). 위에서 흘러든
    모래가 디딤 가장자리와 아래 두 단에 쌓였다. 가운데 2열 걷기(맨 윗줄 = 바깥 이동 칸), 양옆 난간 열 막힘."""
    W, H = 64, 64; px = Px(W, H)
    for i in range(8):
        y0 = i * 8; k = 1.0 - i * 0.045
        for y in range(y0, y0 + 8):
            for x in range(10, 54):
                j = y - y0
                c = SSD[6] if j == 0 else (SSD[5] if j < 4 else (SSD[4] if j < 6 else SSD[2]))
                if x < 13: c = mix(c, SSD[6], 0.3)
                if x > 50: c = mul(c, 0.85)
                if H_(x, y, 651) > 0.94: c = mix(c, SSD[3], 0.6)
                px.put(x, y, mul(mix(c, SS[5], max(0, 0.45 - i * 0.07)), k))
    for (x0, x1, inner) in ((0, 10, 'R'), (54, 64, 'L')):
        for y in range(H):
            for x in range(x0, x1):
                u = x - x0
                c = mix(slab(x, y, 652), SSD[5], 0.45)
                if (inner == 'R' and u >= 8) or (inner == 'L' and u <= 1): c = SSD[2]
                if u == 0 and inner == 'R': c = SSD[6]
                if y >= H - 4: c = SSD[3] if y < H - 1 else SSD[1]
                px.put(x, y, c)
    im = px.fin()
    ip = Px(W, H); ip.paste(im, 0, 0)
    for i in range(8):
        for x in range(10, 54):
            amt = H_(x // 3, i, 653) * 0.5 + (0.5 if (x < 20 or x > 44) else 0) + (0.4 if i < 2 else 0)
            if amt > 0.62: ip.put(x, i * 8, SA[5]); ip.put(x, i * 8 + 1, SA[4])
    PY._sand_heap(ip.p, W, H, 20, 63, 11, 5, 654); PY._sand_heap(ip.p, W, H, 46, 63, 8, 3, 655)
    return ip.im

def stair_arch_sand():
    """계단 아치(4x3, 앞면 장식): 벽 앞면에 뚫린 넓은 반원 아치 — 속은 위로 이어지는 계단과 위에서 드는 햇빛(밝은 모래빛),
    아치 머리에서 모래가 가늘게 흘러내린다. stair_up_sand 바로 위 앞면에 같은 열로 붙인다."""
    W, H = 64, 48; px = Px(W, H)
    cx = 32.0; spring = 22; r = 22.0
    for y in range(0, H):
        for x in range(4, 60):
            ins = 10 <= x < 54 and (y >= spring or math.hypot(x + 0.5 - cx, spring - (y + 0.5)) <= r)
            frm = 6 <= x < 58 and (y >= spring or math.hypot(x + 0.5 - cx, spring - (y + 0.5)) <= r + 4)
            if ins:
                k = y // 6
                c = mix(SS[6], SA[6], 0.4) if y < 14 else (SS[5] if (y % 6) < 3 else SS[3])
                if y >= 14: c = mul(c, 0.9 - (y - 14) * 0.006)
                if x < 13 or x > 50: c = mul(c, 0.7)
                px.put(x, y, c)
            elif frm:
                a = math.degrees(math.atan2(spring - (y + 0.5), x + 0.5 - cx))
                c = SSD[6] if x < cx else SSD[4]
                if y < spring and int(a + 180) % 18 < 2: c = SSD[1]
                if y >= spring: c = SSD[5] if x < cx else SSD[3]
                px.put(x, y, c)
    for y in range(4, 48):
        x = 30 + int(math.sin(y / 5.0) * 1.2)
        if H_(x, y, 661) > 0.25: px.put(x, y, SA[6]); px.put(x + 1, y, SA[4])
    return px.fin()

# ================================================================ 부서진 기계·소품
def machine_wreck():
    """부서진 기계(3x2): 넘어져 모래에 반쯤 묻힌 놋쇠 기계 상자 — 찌그러진 판·튀어나온 깨진 톱니·끊긴 관, 녹 번짐. 아랫줄 막힘."""
    W, H = 48, 32; px = Px(W, H)
    box3(px, 6, 8, 40, 30, 7, 'steel', 4, seed=671, rust=0.6)
    gear(px, 30, 9, 9, 11, 'brass', spokes=4, phase=0.7)
    for (x, y) in ((24, 2), (26, 3)): px.put(x, y, DARK7[0])
    pipe_h(px, 38, 46, 20, 6, 'brass', flange=False)
    for y in range(17, 24): px.put(46, y, BRASS[1])
    im = px.fin(); ip = Px(W, H); ip.paste(im, 0, 0)
    PY._sand_heap(ip.p, W, H, 12, 31, 13, 8, 672); PY._sand_heap(ip.p, W, H, 34, 31, 10, 4, 673)
    return ip.im

def chain_hook():
    """쇠사슬 갈고리(1x3, 위층 장식): 천장 도르래에서 늘어진 쇠사슬과 갈고리. 바닥 칸은 걷기, 그림이 캐릭터를 가린다."""
    W, H = 16, 48; px = Px(W, H)
    for y in range(0, 6):
        for x in range(3, 13): px.put(x, y, K('steel', 5 if x < 7 else 3) if y < 5 else STEEL[1])
    for y in range(6, 34):
        if (y // 3) % 2 == 0: px.put(7, y, STEEL[5]); px.put(8, y, STEEL[3])
        else: px.put(6, y, STEEL[4]); px.put(9, y, STEEL[2])
    for (x, y) in ((8, 34), (9, 35), (10, 36), (10, 37), (10, 38), (9, 39), (8, 40), (7, 40), (6, 39), (6, 38)):
        px.put(x, y, STEEL[5] if y < 38 else STEEL[3])
    return px.fin()

def steam_grate():
    """김 창살(1x1, 걷는 바닥 장식): 바닥 강철 창살 틈 아래 어둠과 가늘게 오르는 김."""
    W, H = 16, 16; px = Px(W, H)
    for y in range(3, 14):
        for x in range(2, 14):
            c = STEEL[4] if (y == 3 or x == 2) else STEEL[2]
            if 3 < y < 13 and 2 < x < 13 and (x % 3 == 0): c = DARK7[1]
            px.put(x, y, c)
    im = px.fin(); p = im.load()
    for (x, y, a) in ((6, 1, 90), (7, 0, 60), (9, 2, 80), (10, 1, 50), (5, 4, 60)):
        p[x, y] = (230, 236, 240, a)
    return im

def gauge_panel():
    """계기판(2x2, 앞면 장식): 강철 받침판의 놋쇠 관 묶음과 압력 계기 둘·작은 밸브 바퀴. 눈금은 점만."""
    W, H = 32, 32; px = Px(W, H)
    panels(px, 2, 2, 30, 30, 'steel', 3, pw=28, ph=28, seed=681, rust=0.2)
    pipe_h(px, 2, 30, 23, 6, 'brass', flange=False)
    pipe_v(px, 9, 14, 23, 4, 'brass', flange=False); pipe_v(px, 23, 14, 23, 4, 'brass', flange=False)
    dial(px, 9, 10, 5); dial(px, 23, 10, 5)
    return px.fin()

def wall_lamp():
    """벽 등(1x1, 앞면 장식): 놋쇠 받침 팔에 매단 유리 등과 호박빛. 기계실 벽 앞면 가운데 줄에 4~6칸 간격."""
    W, H = 16, 16; px = Px(W, H)
    for x in range(3, 9): px.put(x, 4, BRASS[5]); px.put(x, 5, BRASS[2])
    for y in range(3, 14):
        for x in range(7, 13):
            if y in (3, 13) or x in (7, 12): px.put(x, y, BRASS[4] if x < 10 else BRASS[2])
            else: px.put(x, y, FB.SIGNAL['amber'][6] if (y < 9 and x < 10) else FB.SIGNAL['amber'][4])
    im = px.fin(); glow(im, 10, 8, 8, FB.SIGNAL['amber'][4], 55); return im

# ================================================================ 관성 바퀴 받침·빔 펌프·저수 우물
def flywheel_stand():
    """관성 바퀴 받침(3x3): 리벳 강철 A자 받침 두 다리 위 굴대에 걸린 큰 놋쇠 바퀴(바퀴살 여섯), 아래 바닥 틈. 아래 2줄 막힘."""
    W, H = 48, 48; px = Px(W, H)
    for y in range(40, 47):
        for x in range(2, 46): px.put(x, y, DARK7[1] if 4 < x < 44 and y < 45 else STEEL[2])
    gear(px, 24, 22, 18, 0, 'brass', spokes=6)
    for (x0, x1) in ((6, 22), (42, 26)):                                # A자 다리
        px.line(x0, 46, x1, 22, STEEL[5], 2); px.line(x0 + 2, 46, x1 + 1, 23, STEEL[2])
    px.ell(24, 22, 3.5, 3.5, lambda x, y, dx, dy: STEEL[6] if dx < 0 and dy < 0 else STEEL[3])
    for y in range(44, 47):
        for x in range(2, 46): px.put(x, y, K('steel', 4 if y == 44 else 2))
    return px.fin()

def pump_engine():
    """빔 펌프(3x3): 돌 받침 위 기둥 꼭대기 굴대에 걸린 시소 들보 — 한쪽 끝은 세로 펌프 실린더 막대, 다른 끝은 크랭크 바퀴,
    실린더 아래로 내려가는 놋쇠 관. 펌프실 앵커. 아래 2줄 막힘."""
    W, H = 48, 48; px = Px(W, H)
    for y in range(36, 47):                                             # 돌 받침
        for x in range(2, 46):
            c = SSD[6] if y == 36 else (SSD[5] if y < 40 else stone(x, y, 0.6, bw=12, bh=5, seed=691))
            if y >= 45: c = SSD[1]
            px.put(x, y, c)
    for y in range(8, 37): px.put(23, y, STEEL[5]); px.put(24, y, STEEL[3]); px.put(25, y, STEEL[2])   # 가운데 기둥
    px.line(4, 13, 44, 7, STEEL[5], 3); px.line(4, 16, 44, 10, STEEL[2])   # 시소 들보
    px.ell(24.5, 10, 2.5, 2.5, lambda x, y, dx, dy: BRASS[6] if dx < 0 else BRASS[3])
    for y in range(18, 36):                                             # 펌프 실린더(왼쪽)
        for x in range(4, 14): px.put(x, y, K('brass' if (y - 18) % 8 < 2 else 'steel', cyl_t((x - 4 + 0.5) / 10)))
    for y in range(14, 18): px.put(8, y, STEEL[6]); px.put(9, y, STEEL[3])
    gear(px, 38, 26, 8, 0, 'steel', spokes=4)                           # 크랭크 바퀴(오른쪽)
    px.line(43, 9, 38, 24, STEEL[4])
    pipe_v(px, 9, 36, 47, 4, 'brass', flange=False)
    return px.fin()

def cistern_well():
    """저수 우물(2x2): 바닥에 뚫린 둥근 사암 테 우물 — 어두운 지하수(물빛 반짝임), 테 위 놋쇠 관 입구. 칸 전체 막힘."""
    W, H = 32, 32; px = Px(W, H)
    for x in range(W):
        dx = (x + 0.5 - 16) / 14
        if abs(dx) > 1: continue
        b = math.sqrt(1 - dx * dx)
        for y in range(int(16 + 8 * b), int(16 + 8 * b) + 6): px.put(x, y, mul(stone(x, y, bw=8, bh=3, seed=695), 0.62 + 0.15 * (-dx)))
    px.ell(16, 16, 14, 8, lambda x, y, dx, dy: (SSD[6] if dy < 0 else SSD[5]) if dx * dx + dy * dy > 0.55 else None)
    WT = [hx(c) for c in ('#04141c', '#08202c', '#0c3040', '#124456', '#1c5e6e', '#3c8890', '#8cc8c4')]
    px.ell(16, 16.5, 10, 5.2, lambda x, y, dx, dy: WT[1] if dy < -0.3 else (WT[3] if (H_(x, y, 696) > 0.9) else WT[2]))
    px.put(13, 17, WT[6]); px.put(14, 17, WT[5]); px.put(19, 18, WT[5])
    pipe_v(px, 26, 2, 14, 4, 'brass', flange=False)
    return px.fin()

def oil_drums():
    """기름통 둘(2x1): 리벳 테 두른 강철 드럼 — 하나는 바랜 경고 띠(무늬만), 하나는 녹 번짐, 윗면 마개. 막힘 1줄."""
    W, H = 32, 16; px = Px(W, H)
    for (x0, sd, warn) in ((2, 1, True), (17, 2, False)):
        for y in range(4, 15):
            for x in range(x0, x0 + 13):
                t = cyl_t((x - x0 + 0.5) / 13)
                m = 'steel'
                if y in (7, 12): t = clamp(t + 1)
                if warn and 8 <= y <= 10: m = None
                if not warn and H_(x // 2, y // 2, 701 + sd) < 0.35 and t != 6: m = 'rust'
                if m is None: px.put(x, y, FB.WARN[clamp(t)] if ((x + y) // 3) % 2 == 0 else CABLE[clamp(t - 1)])
                else: px.put(x, y, K(m, t))
        px.ell(x0 + 6.5, 4, 6.5, 2.2, lambda x, y, dx, dy: K('steel', 5 if dx < 0 else 4))
        px.put(x0 + 8, 3, STEEL[6]); px.put(x0 + 9, 4, STEEL[2])
    im = px.fin(); ground_shadow(im, 16, 14.8, 15, 1.4, 70); return im

def gear_train():
    """톱니 줄(4x2): 리벳 강철 낮은 틀(윗면이 열린 홈) 속에 누워 맞물린 놋쇠 톱니 셋(큰·중·작은), 가운데 세로 굴대 덮개. 칸 전체 막힘."""
    W, H = 64, 32; px = Px(W, H)
    box3(px, 1, 6, 63, 31, 16, 'steel', 4, seed=711, rust=0.25)
    for y in range(8, 21):
        for x in range(4, 60): px.put(x, y, DARK7[1] if y < 12 else DARK7[2])
    gear_flat(px, 16, 12, 10, 4.5, 16, 'brass')
    gear_flat(px, 34, 13, 6.5, 3, 11, 'brass')
    gear_flat(px, 49, 13, 5, 2.4, 9, 'steel')
    for y in range(0, 11): px.put(35, y, STEEL[6]); px.put(36, y, STEEL[3])
    px.ell(35.5, 1.5, 2.5, 1.5, lambda x, y, dx, dy: BRASS[6] if dx < 0 else BRASS[3])
    return px.fin()

def workbench():
    """작업대(3x2): 두꺼운 나무 윗판(윗면 결) 위 바이스·망치·렌치·놓인 톱니·기름등, 강철 다리와 아래 선반의 상자. 아래 2줄 막힘."""
    W, H = 48, 32; px = Px(W, H)
    for y in range(6, 14):                                              # 윗판
        for x in range(1, 47):
            c = WOOD[5] if y == 6 else (WOOD[4] if y < 11 else WOOD[3])
            if y < 11 and (x * 7 + y * 3) % 23 == 0: c = WOOD[3]
            if y >= 12: c = WOOD[2]
            if x >= 45: c = WOOD[2]
            px.put(x, y, c)
    for (x0) in (3, 41):                                                # 다리
        for y in range(14, 31): px.put(x0, y, STEEL[5]); px.put(x0 + 1, y, STEEL[3]); px.put(x0 + 2, y, STEEL[2])
    for y in range(22, 30):                                             # 아래 선반 상자
        for x in range(8, 22): px.put(x, y, WOOD[4] if y == 22 else (WOOD[3] if x < 20 else WOOD[2]))
    for x in range(6, 40): px.put(x, 21, STEEL[4]); px.put(x, 22, STEEL[2]) if not px.on(x, 22) else None
    box3(px, 6, 1, 15, 8, 3, 'steel', 4, seed=721, rivets=False)        # 바이스
    for y in range(3, 6): px.put(16, y, STEEL[6]); px.put(17, y, STEEL[3])
    px.line(20, 8, 28, 5, WOOD[5], 1); px.line(27, 4, 29, 6, STEEL[5], 2)  # 망치
    px.line(31, 9, 37, 7, STEEL[5], 1); px.put(37, 6, STEEL[6]); px.put(38, 7, STEEL[3])   # 렌치
    gear(px, 42, 8, 3, 6, 'brass', spokes=3)
    px.ell(24, 10, 2, 1.2, lambda x, y, dx, dy: BRASS[5])
    im = px.fin(); ground_shadow(im, 24, 30.8, 22, 1.4, 70); return im
