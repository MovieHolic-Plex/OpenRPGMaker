# 비행선 정박 부두 — 16변형 오토타일 4종. 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (왼쪽 위 칸 0, 가로 4칸씩).
#   autotile-cloud-cliff  : 구름 낀 낭떠러지(막힘). 바닥 위에 덩이로 칠하면 그 덩이가 절벽 아래 구름 바다가 된다.
#                           북쪽 가(땅이 북쪽) = 3/4 로 보이는 바위 절벽 앞면(세로 골·아래로 어두워짐) → 절벽 밑동을 감싼 덩이 구름,
#                           동·서·남 가 = 바위 턱 한 줄 + 턱에 붙은 덩이 구름, 속 = 저 아래 하늘(두 톤 + 옅은 구름 줄).
#   autotile-coal-dust    : 바닥에 쏟아진 석탄 가루(걷기) — 석탄 창고·기중기 화구 둘레.
#   autotile-plank-puddle : 부두 널에 고인 빗물(걷기) — 젖어 짙어진 널 테, 하늘 비친 반투명 물, 잔물결.
#   autotile-iron-railing : 절벽 가 무쇠 난간(막힘, 위층) — 놋쇠 머리 기둥 + 두 가닥 가로대 + 세로 살.
# 가장자리는 airship as_blob.edge_taper(오목 모서리 네모 혹 없음)로 들쭉날쭉·둥글게 낸다. 결정적.
from ad_base import *

def _img(a): return Image.fromarray(np.asarray(a, dtype=np.uint8), 'RGBA').copy()

# ================================================================ 1. 구름 낀 낭떠러지
def _cap(t, per=8, r0=4.2, seed=0):
    """가장자리 방향 t(0..16, 16 주기)에서 덩이 구름 윗선 높이(0..~r): 8px 마다 원 덩이 둘이 겹친 꽃양배추 선."""
    best = 0.0; crease = False
    for k in (-1, 0, 1, 2):
        ci = (int(math.floor(t / per)) + k)
        c = ci * per + per / 2.0
        r = r0 + 1.2 * hash2(ci % 2, 0, 1511 + seed)
        d = abs(t + .5 - c)
        if d < r:
            h = math.sqrt(r * r - d * d) - r * .62
            if h > best: best = h
    # 두 덩이가 만나는 골(주름) = 칸 안 덩이 중심 사이
    for ci in range(-1, 3):
        c = ci * per
        if abs(t + .5 - c) < .8: crease = True
    return max(0.0, best), crease

def cliff_cell(n, seed=1501):
    m, side = AB.edge_taper(n, 1.6, 1.1, 6.0, seed, foot=.6, ramp=5.0)
    a = np.zeros((16, 16, 4), np.uint8)
    FE = 11.0                                                       # 북쪽 절벽 앞면이 끝나는 깊이(px)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < 0: continue
            c = SK[3]                                               # 속 = 저 아래 트인 하늘(한 톤, 드문 점)
            if hash2(x, y, seed + 21) > .986: c = SK[4]
            if sd == '':
                a[y, x] = c + (255,); continue
            t = x if sd in 'NS' else y
            sseed = {'N': 1, 'S': 2, 'E': 3, 'W': 4}[sd]
            cap, crease = _cap(t, seed=sseed)
            if sd == 'N':
                if v < 1.2:                                          # 턱(풀 끝·바위 모)
                    cc = LF[5] if hash2(x + n * 16, y, seed + 2) > .45 else ST[5]
                    a[y, x] = cc + (255,); continue
                top = FE - 1.0 - cap; bot = FE + 2.0 + .7 * cap
                if v < top:                                          # 바위 앞면: 세로 골(6px), 왼쪽 빛·오른쪽 그늘, 아래로 어둡게
                    fy = (v - 1.2) / (FE - 1.2)
                    xx = x + int(round(2 * tnoise1(16, 4, seed + 5)[y % 16]))
                    u = (xx % 6) / 6.0
                    k = 5 if u < .3 else (4 if u < .6 else 3)
                    if u > .84: k = 2
                    k -= int(fy * 2.6)
                    if (y + (xx // 6) * 3) % 5 == 0 and u < .7: k -= 1   # 가로 층리 금
                    if fy < .14: k = 2                               # 풀 처마 밑 그늘
                    a[y, x] = ST[clamp(k)] + (255,); continue
                if v < bot:                                          # 밑동을 감싼 구름 둑: 윗선 흰빛 → 몸 → 아래 라벤더 테
                    dd = v - top; db = bot - v
                    k = 6 if dd < 1.0 else (5 if dd < 2.6 else 4)
                    if crease and dd < 3: k = 4
                    if db < 1.6: k = 3
                    if db < .7: k = 2
                    if (x + y) % 2 and db < 2.2 and k == 4: k = 3
                    a[y, x] = CL[clamp(k)] + (255,); continue
                a[y, x] = c + (255,); continue
            lip = 1.3
            if v < lip:                                              # 바위 턱: 동쪽 땅 모 밝게, 서쪽 땅 그늘, 남쪽 땅 짙은 테
                k = {'E': 5, 'W': 2, 'S': 3}[sd]
                if v > .7: k -= 1
                a[y, x] = ST[clamp(k)] + (255,); continue
            w = 1.4 + cap * 1.3
            if v < lip + w:                                          # 턱에 붙은 구름 띠
                s_ = (v - lip) / w
                if sd in ('S', 'E'):                                 # 바깥(위·왼쪽)이 빛 받는 쪽
                    k = 6 if s_ > .72 else (5 if s_ > .42 else (4 if s_ > .18 else 3))
                else:
                    k = 6 if s_ < .25 else (5 if s_ < .55 else (4 if s_ < .82 else 2))
                if crease and .2 < s_ < .8: k = min(k, 4)
                a[y, x] = CL[clamp(k)] + (255,); continue
            a[y, x] = c + (255,)
    return _img(a)
def cliff_sheet(): return sheet16(cliff_cell)

# ================================================================ 2. 석탄 가루(걷기)
DUST = [(12, 11, 16), (22, 20, 26), (36, 34, 42), (58, 56, 66)]
def coal_cell(n, seed=1601):
    m, side = AB.edge_taper(n, 2.8, 2.4, 6.5, seed, foot=1.2, ramp=6.0)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -2.2: continue
            if v < 0:
                h = hash2(x + n * 16, y + n * 3, seed + 1)
                if h > .9: a[y, x] = DUST[2] + (230,)
                elif h > .86: a[y, x] = COAL[1] + (240,)
                continue
            if v < 1.0: a[y, x] = DUST[1] + (140,); continue
            if v < 1.8: a[y, x] = DUST[0] + (190,); continue
            c = DUST[0]; al = 215
            h3 = hash2(x, y, seed + 3)
            if h3 > .93: c = DUST[3]
            elif h3 > .8: c = DUST[2]
            elif h3 < .1: c = COAL[1]; al = 240
            if v < 2.6 and sd in ('N', 'W'): c = DUST[2]
            a[y, x] = c + (al,)
    im = _img(a); p = im.load()
    for i in range(5):                                            # 덩이 석탄알(2x2, 윗면 빛 한 점)
        lx = int(hash2(i, 1, seed + 11) * 13) + 1; ly = int(hash2(i, 2, seed + 11) * 13) + 1
        if m[ly, lx] < 2.4 or m[min(15, ly + 1), min(15, lx + 1)] < 2.4: continue
        p[lx, ly] = COAL[5] + (255,); p[lx + 1, ly] = COAL[3] + (255,)
        p[lx, ly + 1] = COAL[2] + (255,); p[lx + 1, ly + 1] = COAL[0] + (255,)
    return im
def coal_sheet(): return sheet16(coal_cell)

# ================================================================ 3. 부두 널 빗물 웅덩이(걷기)
WET = (46, 34, 32)
def puddle_cell(n, seed=1701):
    m, side = AB.edge_taper(n, 3.0, 2.2, 7.0, seed, foot=1.4, ramp=6.0)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -1.2: continue
            if v < 0:
                if hash2(x + n * 16, y, seed + 1) > .85: a[y, x] = WET + (90,)
                continue
            if v < 1.3: a[y, x] = WET + (125 if v > .5 else 80,); continue
            if v < 2.1:
                c = SK[0] if sd in ('N', 'W') else SK[4]
                a[y, x] = c + (215,); continue
            c = SK[2]; al = 170
            if v < 3.0 and sd == 'N': c = SK[1]
            col = (x + int(round(math.sin(2 * math.pi * y / 16) * 1.1))) % 6   # 널 결 따라 세로로 비친 하늘 줄
            if col == 1 and hash2(x // 6, y // 4, seed + 3) > .5: c = SK[3]; al = 195
            rp = (y + int(round(math.sin(2 * math.pi * x / 16) * 1.2))) % 8    # 바람 잔물결
            if rp == 3 and hash2(x // 4, y, seed + 4) > .6: c = SK[5]; al = 210
            a[y, x] = c + (al,)
    return _img(a)
def puddle_sheet(): return sheet16(puddle_cell)

# ================================================================ 4. 무쇠 난간(막힘, 위층)
IRN = STEEL
def fin_nb(im, N, E, S, W, k=.62):
    p = im.load(); W_, H_ = im.size; edge = []
    for y in range(H_):
        for x in range(W_):
            if p[x, y][3] < 200: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if (xx < 0 and W) or (xx >= W_ and E) or (yy < 0 and N) or (yy >= H_ and S): continue
                if not (0 <= xx < W_ and 0 <= yy < H_) or p[xx, yy][3] < 200: edge.append((x, y)); break
    for x, y in edge:
        r, g, b, al = p[x, y]; p[x, y] = (int(r * k), int(g * k), min(255, int(b * k * 1.1)), al)
    return im

def railing_cell(n):
    N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    tc = TC(16, 16, 1801)
    if E or W:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            tc.px(x, 3, 'brass', 6); tc.px(x, 4, 'brass', 4); tc.px(x, 5, 'steel', 1)       # 놋쇠 손잡이 띠
            tc.px(x, 10, 'steel', 3); tc.px(x, 11, 'steel', 1)                            # 아래 가로대
            if x % 4 == 1:                                                                # 세로 살(창끝 머리)
                for y in range(6, 14): tc.px(x, y, 'steel', 3 if y < 10 else 2)
                tc.px(x + 1, 13, 'steel', 1)
            if x % 8 == 5:                                                                # 소용돌이 장식 점
                tc.px(x, 7, 'steel', 4); tc.px(x + 1, 8, 'steel', 3); tc.px(x, 9, 'steel', 2)
    if N or S:
        ya = 0 if N else 5; yb = 16 if S else 10
        for y in range(ya, yb):
            tc.px(6, y, 'brass', 6); tc.px(7, y, 'brass', 5); tc.px(8, y, 'brass', 3); tc.px(9, y, 'steel', 2)
            if y % 4 == 2: tc.px(10, y, 'steel', 1)
    if n not in (5, 10):                                                                  # 기둥(무쇠 네모 + 놋쇠 공 머리)
        for y in range(4, 15):
            for x in range(6, 10):
                k = 4 if x == 6 else (3 if x < 9 else 2)
                if y == 14: k = 1
                tc.px(x, y, 'steel', k)
        tc.ell(8, 3, 2.6, 2.2, 'brass', lambda x, y: 6 if (x < 8 and y < 3) else (5 if x < 9 else 3))
        tc.px(6, 8, 'steel', 5); tc.px(6, 12, 'steel', 5)
    return fin_nb(tc.img().copy(), N, E, S, W, .62)
def railing_sheet(): return sheet16(railing_cell)

AUTOS = [
    ('autotile-cloud-cliff', cliff_sheet, '구름 낀 낭떠러지',
     '고원 바닥 위에 칠하는 낭떠러지 16변형(위 1·오른쪽 2·아래 4·왼쪽 8): 북쪽 가는 3/4 로 보이는 바위 절벽 앞면(세로 골, 아래로 어두워짐)과 밑동을 감싼 덩이 구름, '
     '동·서·남 가는 바위 턱 한 줄과 턱에 붙은 덩이 구름(왼쪽 위 흰빛·라벤더 그늘), 속은 저 아래 하늘 두 톤과 옅은 구름 줄.',
     '막힘(떨어지는 곳). 맵 동쪽·남쪽 끝을 덩이로 칠해 고원이 끝나는 곳을 만든다 — 땅 쪽 윤곽은 혹·만·코가 있게 불규칙하게(직선 6칸 이상·직사각형 금지), 1칸 외톨이·1칸 폭 띠 금지. '
     '덩이 위로 pier_span·pier_head(잔교)를 내밀어 걷게 하고, 하늘 칸에 cloud_puff 를 몇 개 띄운다. 맵 바깥은 같은 덩이로 친다.', 'lower', 'terrain', False),
    ('autotile-coal-dust', coal_sheet, '석탄 가루',
     '바닥에 쏟아진 석탄 가루 16변형: 짙은 잿가루 속 알갱이와 덩이 석탄알(윗면 빛 한 점), 반투명 얇은 가루 테, 칸 밖 드문 부스러기.',
     '걷기. 석탄 창고 입구·coal_heap·coal_cart·기중기 보일러 둘레 마당에 3칸 이상 덩이로(한쪽으로 끌린 모양). 사각형 채우기·1칸 외톨이 금지. 위층 투명 덧그림이라 밑 바닥이 비친다.',
     'lower', 'terrain', True),
    ('autotile-plank-puddle', puddle_sheet, '부두 널 빗물 웅덩이',
     '부두 널에 고인 얕은 빗물 16변형: 젖어 짙어진 널 테(반투명), 북·서 안쪽 둑 그늘과 남·동 밝은 물빛 테, 하늘이 비친 반투명 물(널 결 따라 세로 빛줄)과 바람 잔물결.',
     '걷기(얕다). ground-dock-planks 위, 잔교 뿌리·짐 더미 사이 빈 널에 2~3덩이. 붓으로 불규칙한 덩이(혹·만·코) — 사각형 채우기 금지, 1칸 폭 띠 금지.',
     'lower', 'terrain', True),
    ('autotile-iron-railing', railing_sheet, '절벽 가 무쇠 난간',
     '놋쇠 손잡이 띠 + 무쇠 아래 가로대 + 4px 마다 세로 살(소용돌이 장식), 끝·모서리·외톨이는 놋쇠 공 머리 무쇠 기둥 16변형. 남북 이음은 위에서 본 손잡이 띠.',
     '막힘(위층). 낭떠러지 턱 바로 안쪽 땅 칸에 한 줄로 두른다(잔교 뿌리·계단 자리 2칸은 끊어 끝 변형으로). 모든 변형 막힘.',
     'upper', 'fence', False),
]
