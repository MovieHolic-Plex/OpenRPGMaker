"""보트 창고(boathouse) — 검은 호수 진수장: 물·물가·부두·진수대·목조 보트 창고·학생용 목조 보트.
  python3 scripts/content/wizarding/pieces/boathouse.py   → 검사 + tiledata/wizarding/review/boathouse.png
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, RAMPS, run_module, CLEAR   # noqa: E402

MODULE = 'boathouse'
SP = 'boathouse'
W, WD, ST, SL, DT, FI, BR, RD = (RAMPS[k] for k in ('water', 'wood', 'stone', 'slate', 'dirt', 'fire', 'brass', 'red'))
WOOD = 'wood'


def ks(r, i): return r[max(0, min(len(r) - 1, i))]
def kw(i): return K(WOOD, max(0, min(5, i)))
def kb(i): return BR[max(0, min(len(BR) - 1, i))]


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


def px(c, x, y, col):
    c.P(x % 16, y % 16, col)


# ───────────────────────── 물 ─────────────────────────
def _dash(c, y, x0, n, cols, off=0):
    for i in range(n):
        px(c, x0 + off + i, y, cols[0] if i in (0, n - 1) else cols[1])


def water_deep(c, f=0):
    """깊은 물 16×16, 4프레임: 빛 줄무늬가 프레임마다 4px 씩 흘러 16px 주기로 이어진다."""
    c.R(0, 0, 16, 16, W[2])
    # 깊은 그늘 줄(반대 방향으로 흐름)
    for y, x0, n, d in ((5, 3, 6, -1), (11, 10, 5, -1), (14, 1, 4, 1)):
        _dash(c, y, x0, n, (W[1], W[1]), off=d * 4 * f)
    # 바탕 얕은 결 — 움직이지 않는 어두운 점 몇 개
    for x, y in ((6, 0), (13, 3), (1, 9), (8, 13)):
        px(c, x, y, W[1])
    # 밝은 물마루(가장자리 W3, 가운데 W4)
    for y, x0, n, d in ((2, 1, 5, 1), (7, 9, 4, -1), (12, 4, 5, 1)):
        _dash(c, y, x0, n, (W[3], W[4]), off=d * 4 * f)
    # 반짝임: 프레임마다 다른 한 점
    gx, gy = ((3, 2), (10, 7), (7, 12), (3, 2))[f % 4]
    if f % 2 == 0: px(c, gx + (4 * f if f < 3 else 0), gy, W[5])


def water_shallow(c, f=0):
    """얕은 물 16×16, 4프레임: 바닥 자갈이 비치고 밝은 결이 흐른다."""
    c.R(0, 0, 16, 16, W[3])
    for x, y, w, h in ((2, 3, 3, 2), (10, 9, 3, 2), (6, 13, 2, 1), (13, 1, 2, 1)):     # 비치는 바닥 자갈(고정)
        c.R(x % 16, y, w, h, W[2])
        px(c, x, y, W[3])
    for y, x0, n, d in ((1, 5, 4, 1), (6, 12, 5, -1), (10, 2, 4, 1), (14, 9, 5, -1)):
        _dash(c, y, x0, n, (W[4], W[4]), off=d * 4 * f)
    for y, x0, d in ((4, 9, 1), (12, 6, -1)):
        px(c, x0 + d * 4 * f + 1, y, W[5])


@REG.piece('wz-lake-water-deep', '검은 호수 깊은 물', 1, 1, ['X'], 'surfaces', SP,
           '깊고 어두운 호수 물 한 칸(통행 불가). 4프레임으로 빛 줄무늬가 오른쪽·왼쪽으로 번갈아 흐른다.',
           rules='호수 안쪽 전체에 깐다. 물가 가까이는 얕은 물 wz-lake-water-shallow 와 오토타일 wz-lake-shore 로 섞는다.',
           tags=['물', '호수', '깊은 물'], role='water', frames=4, fps=4)
def _deep(c, f): water_deep(c, f)


@REG.piece('wz-lake-water-shallow', '호수 얕은 물', 1, 1, ['X'], 'surfaces', SP,
           '호숫가의 얕은 물 한 칸. 바닥 자갈이 비치고 밝은 결이 흐른다(4프레임, 통행 불가).',
           rules='물가·부두 아래·진수대 끝에 깐다.', tags=['물', '얕은 물'], role='water', frames=4, fps=4)
def _shallow(c, f): water_shallow(c, f)


# ───────────────────────── 물가 자갈 / 물가 오토타일 ─────────────────────────
def pebble_tone(x, y):
    """16 주기 자갈 질감 → 단 번호(2 그늘·3 바탕·4 자갈·5 자갈 빛)."""
    gx, gy = x % 16, y % 16
    cx, cy = gx // 4, gy // 4
    h = hsh(cx, cy, 5)
    lx, ly = (gx + int(hsh(cx, cy, 7) * 3)) % 4, (gy + int(hsh(cx, cy, 9) * 3)) % 4
    if h < 0.42:                                    # 이 칸에 자갈 하나: 2×2~3×2 알
        big = h < 0.2
        if (lx in (0, 1) or (big and lx == 2)) and ly in (1, 2):
            if lx == 0 and ly == 1: return 5
            if ly == 2 and lx >= 1: return 2 if big and lx == 2 else 4
            return 4
        if ly == 3 and lx in (1, 2): return 2
    return 3


def _pebble_cv():
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16): c.P(x, y, ST[pebble_tone(x, y)])
    return c


@REG.piece('wz-lake-pebble', '호숫가 자갈 땅', 1, 1, ['F'], 'surfaces', SP,
           '물가의 젖은 자갈 땅 한 칸(걸을 수 있음). 오토타일 wz-lake-shore 의 바깥 질감과 같다.',
           rules='호수 둘레 땅에 깐다. 물과 맞닿는 줄은 wz-lake-shore 오토타일이 만든다.', tags=['자갈', '물가', '땅'], role='terrain')
def _pebble(c): c.blit(_pebble_cv(), 0, 0)


def _sd_box(x, y, lo, hi, r):
    cx, cy = (lo + hi) / 2, (lo + hi) / 2
    hx = (hi - lo) / 2 - r
    qx, qy = abs(x - cx) - hx, abs(y - cy) - hx
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r      # 안쪽이 음수


def _shore_px(c, x, y, depth, water16):
    """depth = 물 쪽 양수 거리(px). 물이면 물가 거품·얕은 단·속 질감, 땅이면 젖은 자갈."""
    if depth >= 0:
        if depth < 1: c.P(x, y, W[4])
        elif depth < 2: c.P(x, y, W[3])
        else: c.P(x, y, water16.get(x % 16, y % 16))
    else:
        L = -depth
        t = pebble_tone(x, y)
        if L < 1.2: t = max(0, t - 2)         # 물에 닿은 젖은 줄: 가장 어둡다
        elif L < 2.2: t = max(1, t - 1)
        c.P(x, y, ST[t])


def _interior16():
    c = Cv(16, 16); water_deep(c, 0); return c


@REG.autotile('wz-lake-shore', '호수 물가', 'surfaces', SP,
              '호수 물 오토타일. 안쪽은 호수 물, 바깥은 젖은 자갈 물가(거품 줄·젖은 자갈 두 단).',
              rules='물 영역을 칠하면 가장자리가 저절로 물가가 된다(통행 불가 물).', pc='solidfloor', role='water', tags=['물', '물가', '호수', '오토타일'])
def _shore():
    wat = _interior16()
    p = Cv(48, 48)
    for y in range(48):
        for x in range(48):
            _shore_px(p, x, y, -_sd_box(x + 0.5, y + 0.5, 4, 44, 4), wat)
    ic = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            d = min(math.hypot(x + 0.5 - cx, y + 0.5 - cy) - 4 for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)))
            _shore_px(ic, x, y, d, wat)
    return p, ic


@REG.piece('wz-lake-shore-edge-n', '호수 물가 북쪽 줄', 1, 1, ['X'], 'surfaces', SP,
           '북쪽이 땅, 남쪽이 물인 물가 한 줄(오토타일 윗변과 같은 그림, 통행 불가 물). 예제·북쪽 물가에 쓴다.',
           rules='땅이 위, 호수가 아래일 때 물가 줄로 깐다.', tags=['물가', '물'], role='water')
def _shore_n(c):
    p, _ = _shore()
    c.a[:] = p.a[0:16, 16:32]


# ───────────────────────── 부두·진수대 ─────────────────────────
def deck_h(c, ox=0, oy=0, w=16, h=16, seed=3):
    """가로 판자 갑판(16 주기): 판 4px, 판마다 톤·이음 위치가 다르다. (ox,oy)는 절대 기준 어긋남."""
    for y in range(h):
        row = ((y + oy) % 16) // 4
        ly = (y + oy) % 4
        tone = (3, 4, 3, 2)[row]
        cut = int(hsh(row, 1, seed) * 12) + 2
        for x in range(w):
            gx = (x + ox) % 16
            col = K(WOOD, tone)
            if ly == 3: col = K(WOOD, 1)                    # 판 사이 틈
            elif ly == 0: col = K(WOOD, tone + 1)           # 윗 모서리 빛
            elif gx == cut: col = K(WOOD, 1)                 # 판 이음
            elif ly == 1 and hsh(gx // 3, row, seed + 1) < 0.18: col = K(WOOD, tone + 1)   # 결
            elif ly == 2 and hsh(gx // 4, row, seed + 2) < 0.15: col = K(WOOD, tone - 1)
            c.P(x, y, col)


def deck_v(c, ox=0, oy=0, w=16, h=16, seed=4):
    d = Cv(16, 16); deck_h(d, 0, 0, 16, 16, seed)
    for y in range(h):
        for x in range(w):
            c.P(x, y, d.get((y + oy) % 16, (x + ox) % 16))


@REG.piece('wz-lake-dock-h', '부두 갑판(가로 판자)', 1, 1, ['F'], 'surfaces', SP,
           '호수 위 부두 갑판 한 칸(가로 판자, 걸을 수 있음). 길게 이어 깔 수 있다.',
           rules='동서로 뻗은 부두 몸통에 깐다. 남쪽 끝은 wz-lake-dock-end 와 이음띠를 놓는다.', tags=['부두', '판자', '갑판'], role='terrain')
def _dock_h(c): deck_h(c)


@REG.piece('wz-lake-dock-v', '부두 갑판(세로 판자)', 1, 1, ['F'], 'surfaces', SP,
           '호수 위 부두 갑판 한 칸(세로 판자, 걸을 수 있음). 물가에서 호수로 뻗는 길에 쓴다.',
           rules='남북으로 뻗은 부두에 깐다.', tags=['부두', '판자', '갑판'], role='terrain')
def _dock_v(c): deck_v(c)


@REG.piece('wz-lake-dock-end', '부두 끝(마구리 판)', 1, 1, ['F'], 'surfaces', SP,
           '부두 남쪽 끝 한 칸: 갑판 판자 위에 끝을 막는 가로 마구리 판이 놓인다(걸을 수 있음).',
           rules='부두 맨 앞 줄에 깐다. 바로 아래에 wz-lake-dock-band(단차 띠)를 놓는다.', tags=['부두', '끝'], role='terrain')
def _dock_end(c):
    deck_v(c, 0, 0, 16, 11, 4)
    c.R(0, 11, 16, 5, K(WOOD, 3))                             # 마구리 판(윗면)
    c.HL(0, 11, 16, K(WOOD, 5)); c.HL(0, 12, 16, K(WOOD, 4))
    c.HL(0, 13, 16, K(WOOD, 3)); c.HL(0, 14, 16, K(WOOD, 2)); c.HL(0, 15, 16, K(WOOD, 1))
    for x in (4, 11): c.P(x, 12, K(WOOD, 2)); c.P(x, 13, K(WOOD, 2))        # 못
    c.P(9, 13, K(WOOD, 4))


@REG.piece('wz-lake-dock-band', '부두 단차 띠(갑판 옆면)', 1, 1, ['X'], 'surfaces', SP,
           '부두 끝 바로 아래에 놓는 단차 띠: 갑판 앞 옆면(둥근 판자 마구리)과 그 아래 물 그림자(통행 불가).',
           rules='wz-lake-dock-end 의 바로 아래 칸에 깐다. 그 아래에 말뚝 띠 wz-lake-dock-piles 를 잇는다.', tags=['부두', '단차'], role='terrain')
def _dock_band(c):
    for y in range(16):
        for x in range(16):
            if y < 8:                                   # 판자 옆면: 위가 밝고 아래로 어두워짐
                t = (4, 3, 3, 3, 2, 2, 1, 1)[y]
                col = K(WOOD, t)
                if y in (3, 4) and x % 8 == 3: col = K(WOOD, 1)       # 판 사이 틈(세로)
                if y == 0: col = K(WOOD, 5) if x % 8 else K(WOOD, 4)
                c.P(x, y, col)
            else:
                c.P(x, y, W[1] if y < 12 else W[2])
    for x in range(16):                                  # 물에 비친 갑판 그림자(들쭉날쭉)
        if hsh(x, 3, 9) < 0.55: c.P(x, 8, W[0]); c.P(x, 9, W[0])
    for x in (1, 5, 8, 12): c.HL(x, 13, 3, W[3])
    c.HL(9, 15, 3, W[3]); c.HL(2, 11, 2, W[3])


@REG.piece('wz-lake-dock-piles', '부두 말뚝 띠', 1, 1, ['X'], 'surfaces', SP,
           '부두 아래 물에 박힌 말뚝 띠: 갑판 밑 그늘과 말뚝 두 개, 말뚝 밑동에 물결(통행 불가).',
           rules='단차 띠 아래에 놓거나, 부두 옆 물가 쪽 단차 면에 쓴다.', tags=['부두', '말뚝'], role='terrain')
def _dock_piles(c):
    c.R(0, 0, 16, 16, W[1])
    c.R(0, 0, 16, 4, W[0]); 
    for x in range(16):
        if hsh(x, 1, 2) < 0.4: c.P(x, 4, W[0])
    c.R(0, 12, 16, 4, W[2])
    for cx in (3, 12):
        for y in range(0, 14):
            for dx in range(4):
                t = (4, 3, 2, 1)[dx]
                col = K(WOOD, t)
                if y % 5 == 4 and dx < 3: col = K(WOOD, max(1, t - 1))
                c.P(cx - 1 + dx, y, col)
        c.HL(cx - 2, 13, 6, W[3]); c.HL(cx - 3, 14, 8, W[4]); c.HL(cx - 1, 15, 4, W[3])    # 밑동 물결
    for x in (6, 8): c.HL(x, 9, 2, W[3])
    c.HL(5, 14, 2, W[3]); c.HL(9, 12, 3, W[3])


def wet_plank_cv(seed=6):
    c = Cv(16, 16); deck_h(c, 0, 0, 16, 16, seed)
    for y in range(16):                                    # 젖은 결: 한 단 어둡게 + 물방울 빛
        for x in range(16):
            col = c.get(x, y)
            if col in (K(WOOD, 4), K(WOOD, 5)): c.P(x, y, K(WOOD, 3))
            elif col == K(WOOD, 3): c.P(x, y, K(WOOD, 2))
    for x, y in ((12, 5), (3, 12)):
        c.P(x, y, W[3]); c.P(x + 1, y, W[3])
    return c


@REG.piece('wz-lake-plank-wet', '젖은 판자 바닥', 1, 1, ['F'], 'surfaces', SP,
           '물가 창고 바닥의 젖은 판자 한 칸(어둡고 물방울이 빛난다, 걸을 수 있음).',
           rules='창고 안쪽·진수대 위쪽·부두 가장자리에 깐다.', tags=['판자', '젖은', '바닥'], role='terrain')
def _wet(c): c.blit(wet_plank_cv(), 0, 0)


@REG.piece('wz-lake-railing', '부두 난간', 1, 1, ['S'], 'furniture', SP,
           '부두 가장자리 나무 난간 한 칸: 말뚝 둘과 가로대 두 줄(막힘). 옆으로 이어 놓는다.',
           rules='부두 물가 쪽 줄에 이어 놓는다(진수대 입구는 비운다).', tags=['난간', '부두'], role='prop')
def _rail(c):
    c.R(0, 5, 16, 2, K(WOOD, 4)); c.HL(0, 5, 16, K(WOOD, 5)); c.HL(0, 7, 16, K(WOOD, 2))     # 윗가로대(윗면+앞면)
    c.R(0, 10, 16, 2, K(WOOD, 3)); c.HL(0, 10, 16, K(WOOD, 4)); c.HL(0, 12, 16, K(WOOD, 1))   # 아랫가로대
    for x0 in (1, 12):
        c.R(x0, 3, 3, 11, K(WOOD, 3)); c.VL(x0, 3, 11, K(WOOD, 4)); c.VL(x0 + 2, 3, 11, K(WOOD, 2))
        c.HL(x0, 2, 3, K(WOOD, 5)); c.HL(x0, 3, 3, K(WOOD, 4))                                 # 말뚝 머리
        c.HL(x0, 14, 3, K(WOOD, 1))
    for x in range(16): c.P(x, 15, K(WOOD, 0)) if x in (0, 1, 2, 3, 12, 13, 14, 15) else None
    c.outline()


@REG.piece('wz-lake-ramp', '진수대(젖은 판자 경사)', 2, 3, ['FF', 'FF', 'FF'], 'surfaces', SP,
           '보트를 물로 미는 진수대: 양옆 보에 얹힌 긴 판자 경사. 아래로 갈수록 젖어 어두워지고 맨 아래는 물에 잠긴다(걸을 수 있음).',
           rules='창고 큰 입구 앞에서 물까지 놓는다. 위가 땅 쪽, 아래가 물 쪽.', tags=['진수대', '경사', '보트'], role='terrain')
def _ramp(c):
    wet = wet_plank_cv(7)
    for y in range(48):
        for x in range(32):
            if x < 3 or x >= 29:                          # 양옆 보(기둥 줄)
                edge = x in (0, 31)
                t = 1 if edge else (4 if x in (1, 29) else 3) if y < 24 else (2 if not edge else 1)
                c.P(x, y, K(WOOD, t))
            else:
                src = wet.get(x % 16, ((y * 3 // 4) if False else y) % 16) if False else None
                if (x - 3) % 6 == 5: col = K(WOOD, 1)                 # 세로 판자 틈
                else:
                    tone = 4 if y < 14 else 3 if y < 30 else 2
                    if (x - 3) % 6 in (0,): tone += 1
                    col = K(WOOD, tone)
                    if hsh((x - 3) // 6, y // 5, 8) < 0.12 and (y % 5) in (1, 2): col = K(WOOD, tone - 1)
                c.P(x, y, col)
    for y in range(8, 48, 8):                              # 가로 미끄럼 쐐기(발판 살)
        for x in range(3, 29):
            c.P(x, y, K(WOOD, 2 if y < 30 else 1)); 
        c.HL(3, y + 1, 26, K(WOOD, 4 if y < 30 else 3))
    for y in range(36, 48):                                 # 아래쪽: 물이 차오름
        lim = 36 + int(3 * hsh(0, 0, 3))
        for x in range(32):
            wl = 39 + int(1.3 * math.sin(x * 0.35) + hsh(x, 1, 4))
            if y >= wl + (0 if 3 <= x < 29 else 2):
                c.P(x, y, W[3] if y < wl + 2 else (W[2] if y < 44 else W[1]))
    for x in range(32):
        wl = 39 + int(1.3 * math.sin(x * 0.35) + hsh(x, 1, 4))
        if wl < 48 and 3 <= x < 29: c.P(x, wl, W[4])
    for x, y in ((6, 44), (20, 46), (13, 42), (26, 43)): c.HL(x, y, 3, W[4])
    for y in range(0, 32, 5): c.P(1, y + 2, K(WOOD, 5)); c.P(30, y + 2, K(WOOD, 1))


@REG.piece('wz-lake-bollard', '계선주(밧줄 감김)', 1, 1, ['S'], 'furniture', SP,
           '배를 매는 낮은 말뚝 한 칸: 굵은 나무 기둥 윗부분에 밧줄이 둥글게 감겨 있다(막힘).',
           rules='부두 가장자리·진수대 옆에 놓는다.', tags=['계선주', '밧줄', '부두'], role='prop')
def _bollard(c):
    c.ellipse(8, 14, 5, 1, K(WOOD, 0))
    c.cylinder(8, 2, 3, 10, 2, WOOD, 3)                                 # 굵은 말뚝(폭 6)
    for y in (6, 9):                                                    # 밧줄 두 바퀴: 면 전체에 밝은 띠 + 아랫줄 그림자
        for x in range(4, 12):
            f = (x - 4) / 7
            c.P(x, y, K('dirt', 5 if f < 0.35 else 4 if f < 0.7 else 3))
            c.P(x, y + 1, K('dirt', 3 if f < 0.5 else 2))
        c.P(5 + (y % 3), y, K('dirt', 3)); c.P(9 - (y % 3), y, K('dirt', 3))
    c.R(6, 11, 2, 2, K('dirt', 4)); c.P(6, 13, K('dirt', 3))             # 늘어진 밧줄 끝
    c.outline()


@REG.piece('wz-lake-ropehook', '밧줄 걸이(밧줄 꾸러미)', 1, 1, ['S'], 'furniture', SP,
           '벽·기둥에 박은 쇠 갈고리에 밧줄 한 사리가 걸린 소품 한 칸(막힘).',
           rules='창고 벽 앞이나 부두 기둥 쪽에 붙인다.', tags=['밧줄', '갈고리'], role='prop')
def _hook(c):
    # 벽에 붙인 판자(어둡게 눌러 밧줄이 떠 보이게)
    c.R(2, 1, 12, 14, K(WOOD, 2)); c.HL(2, 1, 12, K(WOOD, 4)); c.HL(2, 2, 12, K(WOOD, 3)); c.VL(2, 1, 14, K(WOOD, 3))
    c.VL(13, 2, 13, K(WOOD, 1)); c.HL(3, 14, 10, K(WOOD, 1)); c.HL(3, 8, 10, K(WOOD, 1))
    for x, y in ((4, 13), (11, 13)): c.P(x, y, K('iron', 2))                                  # 판자 못(어두운 머리)
    # 밧줄 사리: 황마 갈색 두 가닥 고리(타원 띠), 가운데로 판자가 보인다. 꼬임은 대각선 밝은 줄.
    JUTE = [K(WOOD, 3), K(WOOD, 4), K(WOOD, 5), K('linen', 2)]
    cx, cy, ox, oy, hx_, hy_ = 7.5, 8.9, 4.7, 5.0, 2.0, 2.5
    for y in range(3, 16):
        for x in range(2, 14):
            ro = math.hypot((x - cx) / ox, (y - cy) / oy)
            ri = math.hypot((x - cx) / hx_, (y - cy) / hy_)
            if ro > 1.0 or ri <= 1.0: continue
            ang = math.atan2(y - cy, x - cx)
            s_ = (math.hypot(x - cx, y - cy) - math.hypot(hx_ * math.cos(ang), hy_ * math.sin(ang))) / max(0.1,
                 math.hypot(ox * math.cos(ang), oy * math.sin(ang)) - math.hypot(hx_ * math.cos(ang), hy_ * math.sin(ang)))
            lit = math.cos(ang - math.radians(225))                      # 왼쪽 위 굽이가 밝다
            t = 2 if lit > 0.3 else 1 if lit > -0.45 else 0
            if 0.40 < s_ < 0.62: t -= 1                                    # 두 가닥 사이 홈
            elif (x - y) % 3 == 0: t += 1                                  # 꼬임(대각선 짧은 반사)
            c.P(x, y, JUTE[max(0, t)])
    # 늘어진 밧줄 끝(사리 아래로 한 가닥, 끝은 풀린 올)
    c.R(9, 13, 2, 2, K(WOOD, 4)); c.P(9, 13, K(WOOD, 5)); c.P(10, 14, K(WOOD, 3))
    c.P(9, 15, K(WOOD, 4)); c.P(11, 15, K(WOOD, 3))
    # 걸이 못: 판 위쪽 가운데, 밧줄 고리가 여기에 걸려 있다
    c.P(7, 3, K('iron', 4)); c.P(8, 3, K('iron', 3)); c.P(7, 4, K('iron', 3)); c.P(8, 4, K('iron', 2))
    c.outline()


@REG.piece('wz-lake-lamp-post', '안전 등불 기둥', 1, 2, ['C', 'S'], 'furniture', SP,
           '선착장 안전 등불 기둥(1×2): 나무 기둥 위 황동 틀 등불에 불꽃이 켜져 있다. 위 칸은 지나가며 가려지고 아래 칸은 막힌다.',
           rules='부두 끝·진수대 양옆에 하나씩 세운다.', tags=['등불', '기둥', '안전'], role='prop')
def _lamp(c):
    c.ellipse(8, 30, 5, 1, K(WOOD, 0))
    c.R(6, 12, 4, 18, K(WOOD, 3)); c.VL(6, 12, 18, K(WOOD, 4)); c.VL(9, 12, 18, K(WOOD, 2))
    for y in (16, 23): c.HL(6, y, 4, K(WOOD, 2))
    c.R(4, 26, 8, 4, K(WOOD, 3)); c.HL(4, 26, 8, K(WOOD, 4)); c.HL(4, 29, 8, K(WOOD, 1))        # 밑받침
    # 등: 황동 틀 + 불꽃
    c.R(4, 5, 8, 8, K('brass', 2)); c.R(5, 6, 6, 6, FI[2]); c.R(6, 7, 4, 4, FI[3]); c.P(7, 8, FI[4]); c.P(8, 8, FI[4])
    c.HL(4, 5, 8, K('brass', 4)); c.VL(4, 5, 8, K('brass', 4)); c.VL(11, 5, 8, K('brass', 1)); c.HL(4, 12, 8, K('brass', 1))
    c.R(5, 3, 6, 2, K('brass', 3)); c.HL(6, 2, 4, K('brass', 4)); c.P(7, 1, K('brass', 3)); c.P(8, 1, K('brass', 2))
    c.P(5, 7, K('brass', 1)); c.P(10, 7, K('brass', 1))
    c.outline()


@REG.piece('wz-lake-dock-join', '물-부두 접합(옆면)', 1, 1, ['X'], 'surfaces', SP,
           '부두 몸통의 옆 가장자리 한 칸: 왼쪽은 호수 물, 오른쪽은 갑판 옆면과 말뚝(통행 불가). 부두와 물이 세로로 만나는 줄에 쓴다.',
           rules='부두가 남북으로 뻗을 때 물 쪽 변에 깐다(오른쪽이 부두). 왼쪽 변이 부두면 좌우를 뒤집어 쓰지 말고 반대 변은 난간으로 가린다.', tags=['부두', '접합'], role='terrain')
def _join(c):
    d = Cv(16, 16); water_deep(d, 0)
    c.blit(d, 0, 0)
    for y in range(16):
        for x in range(9, 16):
            f = x - 9
            t = (5, 4, 4, 3, 3, 2, 2)[f]
            col = K(WOOD, t)
            if y % 8 == 7: col = K(WOOD, 1)
            c.P(x, y, col)
    c.VL(8, 0, 16, K(WOOD, 0)); 
    for y in range(16):                                   # 물에 비친 그림자 + 거품
        if hsh(y, 5, 5) < 0.6: c.P(7, y, W[0]); 
        if y % 4 == 1: c.P(6, y, W[4]); c.P(5, y, W[3])
    for y in (3, 11): c.HL(10, y, 3, K(WOOD, 1))


def oar_shape(c, x0, y0, x1, y1, blade_end=1, bw=3, bl=7):
    """노: (x0,y0)-(x1,y1) 자루(2px, 윗결 밝음) + blade_end 쪽 끝에 넓은 날."""
    n = max(abs(x1 - x0), abs(y1 - y0)) + 1
    dx, dy = (x1 - x0) / max(1, n - 1), (y1 - y0) / max(1, n - 1)
    px_, py_ = -dy, dx
    L = (dx * dx + dy * dy) ** .5 or 1
    px_, py_ = px_ / L, py_ / L
    for i in range(n):
        x, y = x0 + dx * i, y0 + dy * i
        end = (n - 1 - i) if blade_end else i
        wd = bw if end < bl else 1
        for k in range(-(wd // 2) if wd > 1 else 0, (wd // 2) + 1 if wd > 1 else 1):
            c.P(round(x + px_ * k), round(y + py_ * k), K(WOOD, 5 if end < bl and k <= 0 else 4 if end < bl else 4))
        c.P(round(x), round(y + 1) if abs(dx) > abs(dy) else round(y), K(WOOD, 2 if end >= bl else 3))
    ex, ey = (x1, y1) if blade_end else (x0, y0)
    c.P(round(ex), round(ey), K(WOOD, 2))


@REG.piece('wz-lake-oar-single', '노(한 자루)', 2, 1, ['ff'], 'furniture', SP,
           '바닥·부두에 놓인 노 한 자루(눕힘, 날이 오른쪽). 통행은 막지 않는 덧그림.',
           rules='부두 갑판·창고 바닥 위에 얹어 놓는다. 보트 안에 쓰지 않는다(보트 상태 조각 사용).', tags=['노', '보트'], role='prop')
def _oar1(c):
    c.R(0, 0, 32, 16, CLEAR) if False else None
    oar_shape(c, 1, 10, 30, 7, 1, 5, 8)
    c.R(1, 9, 3, 3, K(WOOD, 3)); c.P(1, 9, K(WOOD, 5))                 # 손잡이 마디
    c.outline()


@REG.piece('wz-lake-oar-crossed', '노(교차 두 자루)', 2, 2, ['ff', 'ff'], 'furniture', SP,
           '엇갈려 기대 놓은 노 두 자루(덧그림). 창고 벽 앞이나 부두 끝에 놓는다.',
           rules='창고 벽 앞 바닥에 얹는다.', tags=['노', '보트'], role='prop')
def _oar2(c):
    for ox in (0, 1):
        oar_shape(c, 2 + ox, 28, 26 + ox, 3, 1, 5, 9)
        oar_shape(c, 28 + ox, 28, 4 + ox, 4, 1, 5, 9)
    c.outline()


# ───────────────────────── 보트 창고 건물(남쪽 정면) ─────────────────────────
ROOFH, WALLH = 32, 48          # 지붕 2줄 + 벽 3줄


def _slate_px(x, y, row_off=0):
    """슬레이트 비늘: 4px 줄, 8px 비늘이 줄마다 4px 어긋남(16 주기)."""
    r = y // 4; ly = y % 4
    xx = (x + (4 if r % 2 else 0)) % 8
    tone = (3, 2, 3, 4, 3)[(r * 3 + (xx // 8)) % 5] if False else (3, 2, 3, 2)[(r + (x + (4 if r % 2 else 0)) // 8) % 4]
    if ly == 3: return ks(SL, 1)                  # 비늘 아랫단 그림자
    if xx == 0: return ks(SL, 1)                  # 비늘 사이 틈
    if ly == 0: return ks(SL, min(4, tone + 1))   # 윗단 빛
    return ks(SL, tone)


def _bh_render(cols):
    wt = len(cols); W_ = wt * 16; H = ROOFH + WALLH
    c = Cv(W_, H)
    # 지붕: 슬레이트
    for y in range(ROOFH):
        for x in range(W_):
            c.P(x, y, _slate_px(x, y))
    # 용마루(맨 위): 목재 덮개
    c.R(0, 0, W_, 4, kw( 4)); c.HL(0, 0, W_, kw( 5)); c.HL(0, 3, W_, kw( 2))
    for x in range(0, W_, 8): c.P(x + 3, 1, kw( 3)); c.P(x + 4, 2, kw( 3))
    # 처마 끝(앞): 두꺼운 목재 보 + 아래로 그림자
    c.R(0, ROOFH - 4, W_, 4, kw( 4)); c.HL(0, ROOFH - 4, W_, kw( 5)); c.HL(0, ROOFH - 2, W_, kw( 3)); c.HL(0, ROOFH - 1, W_, kw( 1))
    for x in range(0, W_, 4): c.P(x + 1, ROOFH - 3, kw( 3))
    # 벽: 세로 판벽
    y0 = ROOFH
    for y in range(y0, H):
        for x in range(W_):
            bx = x % 6
            tone = (4, 3, 4, 3, 4, 3)[(x // 6) % 6] if False else (4 if (x // 6) % 2 == 0 else 3)
            col = kw( tone)
            if bx == 5: col = kw( 1)                      # 판 사이 틈
            elif bx == 0: col = kw( tone + 1)
            elif hsh(x // 6, y // 7, 11) < 0.12 and y % 7 in (2, 3): col = kw( tone - 1)
            c.P(x, y, col)
    # 처마 그림자(벽 위)
    for x in range(W_):
        c.P(x, y0, kw( 0)); c.P(x, y0 + 1, kw( 1)); 
        if x % 2: c.P(x, y0 + 2, kw( 2))
    # 기초석(맨 아래 줄): 큰 불규칙 돌
    fnd = Cv(W_, 6); fnd.stone_blocks(0, 0, W_, 6, 'stone', 3, (3, 3), seed=5)
    c.blit(fnd, 0, H - 6)
    c.HL(0, H - 7, W_, kw( 1))
    # 열별 장식
    for i, k in enumerate(cols):
        x = i * 16
        if k in ('L', 'R'):
            ex = x if k == 'L' else x + 15
            for y in range(ROOFH, H - 6):                        # 모서리 기둥(굵은 목재)
                for d in range(3):
                    xx = x + d if k == 'L' else x + 15 - d
                    c.P(xx, y, kw( (4, 3, 2)[d] if k == 'L' else (2, 3, 4)[d]))
            c.VL(x if k == 'L' else x + 15, 0, ROOFH, kw( 0))   # 박공 가장자리
            c.VL(x + 1 if k == 'L' else x + 14, 0, ROOFH, kw(5 if k == 'L' else 2))
        if k == 'M':
            # 덧창 달린 작은 창
            wx, wy = x + 4, y0 + 8
            c.R(wx - 1, wy - 1, 10, 14, kw( 1))
            c.R(wx, wy, 8, 12, kw( 5)); c.R(wx + 1, wy + 1, 6, 10, kw( 2))
            c.R(wx + 1, wy + 1, 6, 10, W[2]); c.R(wx + 1, wy + 1, 3, 5, W[4]); c.P(wx + 1, wy + 1, W[5]); c.P(wx + 2, wy + 2, W[5])
            c.VL(wx + 4, wy + 1, 10, kw( 3)); c.HL(wx + 1, wy + 6, 6, kw( 3))
            c.HL(wx - 1, wy + 12, 10, kw( 4)); c.HL(wx - 1, wy + 13, 10, kw( 1))        # 창턱
    # 큰 물쪽 개구부
    dcols = [i for i, k in enumerate(cols) if k == 'D']
    if dcols:
        dx0, dx1 = dcols[0] * 16 + 2, dcols[-1] * 16 + 14           # 열린 폭
        oy = y0 + 6                                                  # 개구부 위
        # 상인방 보 + 받침 쐐기
        c.R(dx0 - 2, oy - 5, dx1 - dx0 + 4, 5, kw( 3)); c.HL(dx0 - 2, oy - 5, dx1 - dx0 + 4, kw( 5)); c.HL(dx0 - 2, oy - 1, dx1 - dx0 + 4, kw( 1))
        for x in range(dx0, dx1, 7): c.P(x + 2, oy - 3, kw( 2)); c.P(x + 3, oy - 3, kw( 2))
        # 안쪽: 어두운 지붕 밑
        c.R(dx0, oy, dx1 - dx0, H - oy, kw( 0))
        for y in range(oy, H):
            for x in range(dx0, dx1):
                f = (y - oy) / (H - oy)
                if hsh(x // 3, y // 3, 12) < 0.10 + 0.1 * f: c.P(x, y, kw( 1))
        # 서까래 두 줄
        for x in range(dx0 + 3, dx1 - 2, 11): c.R(x, oy, 2, 12, kw( 2)); c.VL(x, oy, 12, kw( 3))
        # 안쪽 벽의 호수 빛 반사(작은 물결 창)
        mid = (dx0 + dx1) // 2
        c.R(mid - 9, oy + 9, 18, 10, W[1])
        for k_ in range(4): c.HL(mid - 8 + (k_ * 5) % 7, oy + 11 + k_ * 2, 6, W[2] if k_ % 2 else W[3])
        c.HL(mid - 6, oy + 10, 4, W[4])
        # 안쪽 바닥(젖은 판재 경사, 열린 앞줄): 마지막 한 줄
        fl = wet_plank_cv(7)
        c.tile(fl, dx0, H - 16, dx1 - dx0, 16)
        for x in range(dx0, dx1): c.P(x, H - 16, kw( 1)); 
        for x in range(dx0, dx1, 3): c.P(x, H - 15, kw( 1))
        # 문설주
        for y in range(oy - 5, H):
            for d in range(2):
                c.P(dx0 - 1 - d + (0), y, kw( (1, 3)[d])) if False else None
        c.VL(dx0 - 1, oy, H - oy, kw( 1)); c.VL(dx1, oy, H - oy, kw( 1))
        c.VL(dx0, oy, H - 16 - oy, kw( 2)); c.VL(dx1 - 1, oy, H - 16 - oy, kw( 0))
        # 상인방 위 문패 등불 걸이
        c.R(mid - 1, oy - 8, 2, 3, kb( 3)); c.R(mid - 3, oy - 12 + 3, 6, 4, kb( 2)); c.R(mid - 2, oy - 9 + 0, 4, 2, FI[3]); c.P(mid - 1, oy - 9, FI[4])
    return c


def _bh_slice(cols, i0, n, rows=None):
    big = _bh_render(cols)
    return big.a[:, i0 * 16:(i0 + n) * 16].copy()


def _put(c, a):
    c.a[:a.shape[0], :a.shape[1]] = a


KIT7 = ['L', 'M', 'D', 'D', 'D', 'M', 'R']
KIT5 = ['L', 'D', 'D', 'D', 'R']

_BH_ROWS = ['C', 'S', 'S', 'S', 'S']


@REG.piece('wz-lake-boathouse', '목재 보트 창고(폭 7, 완성형)', 7, 5, ['CCCCCCC', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSFFFSS'], 'architecture', SP,
           '검은 호수 가의 목재 보트 창고 남쪽 정면(폭 7칸 완성형): 슬레이트 지붕 두 줄, 세로 판벽·덧창 달린 창, 가운데 3칸 큰 물쪽 개구부와 젖은 판재 바닥. 개구부 맨 앞 칸으로 드나든다.',
           rules='진수대(wz-lake-ramp)를 개구부 바로 앞에 이어 놓는다. 땅 쪽 판자 길과 이어진다.', tags=['보트 창고', '건물', '완성형'], role='building')
def _bh7(c): _put(c, _bh_slice(KIT7, 0, 7))


@REG.piece('wz-lake-boathouse-5', '목재 보트 창고(폭 5, 소형)', 5, 5, ['CCCCC', 'SSSSS', 'SSSSS', 'SSSSS', 'SFFFS'], 'architecture', SP,
           '폭 5칸 소형 보트 창고 정면: 양쪽 모서리 기둥 사이에 3칸 큰 개구부. 창 달린 벽 칸을 덧대면 폭 7이 된다.',
           rules='더 넓게 쓰려면 양옆 벽 칸 wz-lake-bh-wall 을 덧댄다.', tags=['보트 창고', '건물', '소형'], role='building')
def _bh5(c): _put(c, _bh_slice(KIT5, 0, 5))


@REG.piece('wz-lake-bh-end-l', '보트 창고 왼쪽 끝(1×5)', 1, 5, ['C', 'S', 'S', 'S', 'S'], 'architecture', SP,
           '보트 창고 왼쪽 끝 기둥 열(지붕 두 줄+모서리 기둥+기초석).', rules='조립: 끝-왼, 벽 칸 0~2개, 개구부 3칸, 벽 칸 0~2개, 끝-오른.', tags=['보트 창고', '부품'], role='building')
def _bhl(c): _put(c, _bh_slice(KIT7, 0, 1))


@REG.piece('wz-lake-bh-wall', '보트 창고 벽 칸(1×5, 창)', 1, 5, ['C', 'S', 'S', 'S', 'S'], 'architecture', SP,
           '보트 창고의 벽 한 열: 슬레이트 지붕, 세로 판벽, 덧창 달린 창. 가로로 반복해 폭을 늘린다.', rules='끝 기둥과 개구부 사이에 필요한 만큼 반복.', tags=['보트 창고', '부품'], role='building')
def _bhw(c): _put(c, _bh_slice(KIT7, 1, 1))


@REG.piece('wz-lake-bh-door', '보트 창고 큰 물쪽 개구부(3×5)', 3, 5, ['CCC', 'SSS', 'SSS', 'SSS', 'FFF'], 'architecture', SP,
           '보트 창고의 3칸 큰 개구부 열: 상인방과 등불, 어두운 안쪽, 안쪽 벽에 비치는 호수 빛, 젖은 판재 바닥(맨 아래 줄 걸을 수 있음).', rules='진수대와 이어진다.', tags=['보트 창고', '부품', '개구부'], role='building')
def _bhd(c): _put(c, _bh_slice(KIT7, 2, 3))


@REG.piece('wz-lake-bh-end-r', '보트 창고 오른쪽 끝(1×5)', 1, 5, ['C', 'S', 'S', 'S', 'S'], 'architecture', SP,
           '보트 창고 오른쪽 끝 기둥 열.', rules='조립의 오른쪽 끝에 놓는다.', tags=['보트 창고', '부품'], role='building')
def _bhr(c): _put(c, _bh_slice(KIT7, 6, 1))


# ───────────────────────── 학생용 목조 보트(4방향 × 빈 것/노 걸친 것) ─────────────────────────
BOAT_L = 56


def _hw(u):
    t = u / BOAT_L
    if t < 0 or t > 1: return -1
    if t < 0.45: return 5 + 5.5 * math.sin(math.pi / 2 * t / 0.45)
    return 10.5 * (1 - ((t - 0.45) / 0.55) ** 1.7) ** 0.9


def boat_cv(dirn, oars):
    vert = dirn in ('up', 'down')
    w, h = (32, 64) if vert else (64, 32)
    c = Cv(w, h)

    def uv(x, y):
        if dirn == 'right': return x + .5 - 4, y + .5 - 14.5
        if dirn == 'left': return 60 - (x + .5), y + .5 - 14.5
        if dirn == 'down': return y + .5 - 4, x + .5 - 16
        return 60 - (y + .5), x + .5 - 16

    def xy(u, v):
        if dirn == 'right': return int(u + 4), int(v + 14.5)
        if dirn == 'left': return int(60 - u), int(v + 14.5)
        if dirn == 'down': return int(v + 16), int(u + 4)
        return int(v + 16), int(60 - u)

    O, I = set(), set()
    for y in range(h):
        for x in range(w):
            u, v = uv(x, y)
            hw = _hw(u)
            if hw >= 0 and abs(v) <= hw: O.add((x, y))
            if hw - 2.2 >= 0.6 and abs(v) <= hw - 2.2 and u >= 2.6: I.add((x, y))
    D = 3 if vert else 4
    filled = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in O: continue
            for k in range(1, D + 1):
                if (x, y - k) in O:
                    c.P(x, y, kw({1: 3, 2: 2, 3: 1, 4: 1}[k])); filled.add((x, y))
                    break
    for y in range(h):
        for x in range(w):
            if (x, y) in filled or (x, y) in O: continue
            if (x, y - D - 1) in O and x % 3 != 1: c.P(x, y, ks(W, 1))
    for (x, y) in O:
        if (x, y) in I: continue
        if (x - 1, y) not in O or (x, y - 1) not in O: col = kw(5)
        elif (x + 1, y) not in O or (x, y + 1) not in O: col = kw(3)
        else: col = kw(4)
        c.P(x, y, col)
    for (x, y) in I:
        if (x, y - 1) not in I or (x, y - 2) not in I: col = kw(2)
        elif (x, y + 1) not in I: col = kw(0)
        elif (y % 4 == 0 and not vert) or (x % 4 == 0 and vert): col = kw(0)
        else: col = kw(1)
        c.P(x, y, col)
    for uc in (15, 27, 39):
        cx_, cy_ = xy(uc, 0)
        for (x, y) in I:
            u, v = uv(x, y)
            if abs(u - uc) > 2.1: continue
            d = (x - cx_) if not vert else (y - cy_)
            col = kw(5) if d <= -1 else kw(4) if d == 0 else kw(3) if d == 1 else kw(0)
            c.P(x, y, col)
    if not oars:
        bx, by = xy(7, 0)
        for dx, dy, cc in ((0, 0, 1), (1, 0, 3), (-1, 0, 2), (0, 1, 2), (1, 1, 3), (0, -1, 3), (-1, 1, 2), (1, -1, 2)):
            c.P(bx + dx, by + dy, ks(DT, cc))
    else:
        for (uc, sgn) in ((21, 1), (33, -1)):
            cx_, cy_ = xy(uc, 0)
            if not vert:
                oar_shape(c, cx_ + 2 * sgn, 29, cx_ - 2 * sgn, 1, 1, 3, 7)
            else:
                oar_shape(c, 30, cy_ + 2 * sgn, 2, cy_ - 2 * sgn, 1, 3, 7)
    lx, ly = xy(BOAT_L - 8, 0)
    c.R(lx - 2, ly - 4, 5, 5, OL)
    c.R(lx - 1, ly - 3, 3, 3, kb(3))
    c.P(lx, ly - 2, ks(FI, 4)); c.P(lx - 1, ly - 3, kb(5)); c.P(lx, ly, kw(2)); c.P(lx, ly + 1, kw(2))
    c.outline()
    return c


def _boat_reg(dirn, label, oars):
    vert = dirn in ('up', 'down')
    w, h = (2, 4) if vert else (4, 2)
    pid = 'wz-lake-boat-%s%s' % (dirn, '-oars' if oars else '')
    nm = '학생 보트(%s, %s)' % (label, '노 걸침' if oars else '빈 보트')
    walk = ['S' * w] * h
    desc = ('학생용 목조 보트, 뱃머리가 %s을 향한다. 뱃전·좌석 3개%s·선수 등불. 물 위에 놓는다.'
            % (label, '·가로로 걸쳐 둔 노 두 자루' if oars else '·고물의 밧줄 사리'))

    @REG.piece(pid, nm, w, h, walk, 'vehicles', SP, desc,
               rules='물 타일 위에 놓는다. 방향 4개 x 상태 2개(states=boat)는 크기·피벗이 같아 서로 바꿔 끼울 수 있다.',
               tags=['보트', '배', '호수'], role='prop', states='boat')
    def _b(c, _d=dirn, _o=oars):
        c.blit(boat_cv(_d, _o), 0, 0)


for _d, _l in (('up', '위'), ('down', '아래'), ('left', '왼쪽'), ('right', '오른쪽')):
    for _o in (False, True):
        _boat_reg(_d, _l, _o)

# ───────────────────────── 예제: 호숫가 보트 창고와 부두 ─────────────────────────
def _ex_dock():
    pl = []
    for y in range(0, 5):                                  # 자갈 호숫가
        for x in range(0, 16): pl.append(('wz-lake-pebble', x, y))
    for x in range(0, 16):                                 # 물가 줄과 얕은 물
        if x in (7, 8, 13): continue
        pl.append(('wz-lake-shore-edge-n', x, 5))
        pl.append(('wz-lake-water-shallow', x, 6))
    pl += [('wz-lake-water-shallow', 7, 8), ('wz-lake-water-shallow', 8, 8)]
    pl.append(('wz-lake-ramp', 7, 5))
    pl.append(('wz-lake-pebble', 9, 4))
    for y in range(5, 10): pl.append(('wz-lake-dock-v', 13, y))   # 부두
    pl.append(('wz-lake-dock-end', 13, 10))
    pl.append(('wz-lake-dock-piles', 13, 11))
    for y in range(6, 10):
        pl.append(('wz-lake-dock-join', 12, y)); pl.append(('wz-lake-dock-join', 14, y))
    pl.append(('wz-lake-boathouse', 5, 0))
    pl.append(('wz-lake-plank-wet', 9, 5))
    pl += [('wz-lake-lamp-post', 12, 3), ('wz-lake-bollard', 14, 4), ('wz-lake-bollard', 13, 4),
           ('wz-lake-ropehook', 4, 3), ('wz-lake-oar-crossed', 1, 2), ('wz-lake-oar-single', 2, 4)]
    pl += [('wz-lake-boat-right', 1, 8), ('wz-lake-boat-up-oars', 10, 8)]
    return pl


REG.example('wz-lake-example-dock', '호숫가 보트 창고와 부두', 'boathouse', 16, 14, 'wz-lake-water-deep', _ex_dock(),
            desc='검은 호수 위로 자갈 호숫가, 진수대가 이어진 보트 창고, 말뚝 부두와 보트 두 척.')


# ───────────────────────── 여기부터 다음 묶음 ─────────────────────────

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
