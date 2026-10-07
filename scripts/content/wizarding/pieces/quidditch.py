"""퀴디치 경기장·선수 터널 (space quidditch). id 접두 wz-qd-.
  python3 scripts/content/wizarding/pieces/quidditch.py → 검사 + tiledata/wizarding/review/quidditch.png
"""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'quidditch'
SP = 'quidditch'
CAP = 12                                   # 높은 터널 벽 윗면 높이(px)
COURSES = [6, 6, 5, 6, 6, 5, 6, 6, 6]      # 앞면 돌 줄 높이(윗면 아래부터, 합 52) — 벽·아치·문이 줄을 맞춘다
HOUSES = {'g': ('house_g', '붉은 사자 기숙사'), 's': ('house_s', '초록 뱀 기숙사'),
          'r': ('house_r', '푸른 독수리 기숙사'), 'h': ('house_h', '노란 오소리 기숙사')}


# ───────────────────────── 공용 그리기 도우미 ─────────────────────────
def blocks_wrap(c, x, w, y0, rows, base, seed, ramp='stone'):
    """폭 w 로 이어 깔아도 이음새 없는 큰 석재 쌓기(가로 주기 = w). rows: 줄 높이 목록."""
    y = y0
    for r, rh in enumerate(rows):
        rnd = random.Random(seed * 131 + r * 17)
        ws, used = [], 0
        while used < w:
            bw = rnd.randint(8, 14)
            if w - used - bw < 6: bw = w - used
            ws.append(bw); used += bw
        pos = rnd.randint(0, w - 1)
        for bw in ws:
            tone = base + rnd.choice((0, 0, 0, 1, -1))
            segs = [(pos, bw)] if pos + bw <= w else [(pos, w - pos), (0, bw - (w - pos))]
            for k, (sx, sw) in enumerate(segs):
                c.R(x + sx, y, sw, rh, K(ramp, tone))
                c.HL(x + sx, y, sw, K(ramp, tone + 1))
                if k == 0: c.VL(x + sx, y, rh, K(ramp, tone + 1))
                c.HL(x + sx, y + rh - 1, sw, K(ramp, base - 2))
            ex = (pos + bw - 1) % w
            c.VL(x + ex, y, rh, K(ramp, base - 2))
            if rnd.random() < 0.4:
                c.P(x + (pos + rnd.randint(2, max(2, bw - 3))) % w, y + rnd.randint(1, max(1, rh - 3)), K(ramp, tone - 1))
            pos = (pos + bw) % w
        y += rh


def wall_top(c, x, w, h=CAP, y=0):
    """벽 윗면(위에서 본 돌판): 밝은 면 + 어긋난 이음 + 앞 모서리 빛·그늘."""
    c.R(x, y, w, h, K('stone', 4))
    c.HL(x, y, w, K('stone', 1))
    for i in range(x, x + w):
        gx = i % 16
        if gx == 5: c.VL(i, y + 1, 5, K('stone', 3))
        if gx == 12: c.VL(i, y + 7, h - 9, K('stone', 3))
    c.HL(x, y + 6, w, K('stone', 3))
    c.HL(x, y + h - 2, w, K('stone', 5))
    c.HL(x, y + h - 1, w, K('stone', 2))


def front_stone(c, x, w, y0, seed, base=3, h=None):
    rows = COURSES
    blocks_wrap(c, x, w, y0, rows, base, seed)


def flag_tile(base=2, seed=3):
    """터널 포석 16×16(가로 8줄 두 줄, 이음새 없음)."""
    t = Cv(16, 16); rnd = random.Random(seed)
    layout = [(0, 8, [(0, 9), (9, 7)]), (8, 8, [(0, 5), (5, 11)])]
    for y, h, bl in layout:
        for x, w in bl:
            tone = base + rnd.choice((0, 0, 1, -1))
            t.R(x, y, w, h, K('stone', tone))
            t.HL(x, y, w, K('stone', tone + 1)); t.VL(x, y, h, K('stone', tone + 1))
            t.HL(x, y + h - 1, w, K('stone', base - 2)); t.VL(x + w - 1, y, h, K('stone', base - 2))
    for x, y in ((3, 3), (12, 5), (7, 12), (14, 13)): t.P(x, y, K('stone', base - 1))
    return t


def grass_tile(kind='h', blades=True):
    """깎은 잔디 16×16: 8px 줄무늬 두 톤(h 가로, v 세로) + 드문 풀잎 짧은 획."""
    t = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            s = ((y // 8) if kind == 'h' else (x // 8)) % 2
            t.P(x, y, K('grass', 2 + s))
    if blades:
        for bx, by in ((3, 2), (11, 5), (6, 10), (13, 13), (1, 7), (9, 14)):
            band = ((by // 8) if kind == 'h' else (bx // 8)) % 2
            t.P(bx, by, K('grass', 1 + band)); t.P(bx, by - 1 if by else by + 1, K('grass', 1 + band))
    return t


def house_tiers(h):
    return HOUSES[h][0]


# ───────────────────────── 바닥 ─────────────────────────
@REG.autotile('wz-qd-pitch', '경기장 잔디(바깥 터널 포석)', 'surfaces', SP,
              desc='퀴디치 경기장 잔디 오토타일. 깎은 줄무늬 잔디가 안쪽, 가장자리는 어두운 풀 테두리를 두르고 바깥은 터널 포석.',
              rules='경기장 바닥 전체를 이 오토타일로 칠하고 둘레 바깥은 포석이 된다. 골대·울타리는 그 위에 얹는다.',
              pc='floor', role='terrain', tags=['경기장', '잔디', '퀴디치'])
def _pitch():
    g = grass_tile('h'); fl = flag_tile(2, 3)
    p = Cv(48, 48); p.tile(fl, 0, 0, 48, 48)
    m = 3                                           # 바깥 포석 폭
    p.tile(g, m, m, 48 - 2 * m, 48 - 2 * m)
    o = K('grass', 0)
    p.R(m, m, 42, 1, o); p.R(m, 48 - m - 1, 42, 1, o); p.R(m, m, 1, 42, o); p.R(48 - m - 1, m, 1, 42, o)
    p.R(m + 1, m + 1, 40, 1, K('grass', 1)); p.R(m + 1, m + 1, 1, 40, K('grass', 1))
    for (cx, cy) in ((m, m), (47 - m, m), (m, 47 - m), (47 - m, 47 - m)):   # 바깥 모서리 둥글림
        p.P(cx, cy, p.get(cx - 1 if cx > 24 else cx + 1, cy - 1 if cy > 24 else cy + 1) if False else K('stone', 2))
    ic = Cv(16, 16); ic.tile(g, 0, 0, 16, 16)
    for qx, qy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        ox, oy = qx * 8, qy * 8
        for j in range(8):
            for i in range(8):
                lx, ly = (i if qx == 0 else 7 - i), (j if qy == 0 else 7 - j)
                if lx < m and ly < m: ic.P(ox + i, oy + j, fl.get((ox + i) % 16, (oy + j) % 16))
                elif (lx == m and ly <= m) or (ly == m and lx <= m): ic.P(ox + i, oy + j, o)
    return p, ic


@REG.piece('wz-qd-grass-a', '관리 잔디(가로 줄무늬)', 1, 1, ['F'], 'surfaces', SP,
           desc='깎은 잔디 1칸. 8px 가로 줄무늬 두 톤. 어디든 이어 깐다.', rules='경기장 바닥 반복칸. grass-b 와 섞어 쓰지 않는다.',
           repeat=True, role='terrain', tags=['잔디', '경기장'])
def _grass_a(c): c.blit(grass_tile('h'), 0, 0)


@REG.piece('wz-qd-grass-b', '관리 잔디(세로 줄무늬)', 1, 1, ['F'], 'surfaces', SP,
           desc='깎은 잔디 1칸. 8px 세로 줄무늬 두 톤.', rules='경기장 바닥 반복칸. 골대 앞 구역 등 방향을 바꿀 때.',
           repeat=True, role='terrain', tags=['잔디', '경기장'])
def _grass_b(c): c.blit(grass_tile('v'), 0, 0)


@REG.piece('wz-qd-flag', '터널 포석', 1, 1, ['F'], 'surfaces', SP,
           desc='선수 터널 바닥 포석 1칸. 큰 판석 두 줄.', rules='터널·출입구 바닥 반복칸.', repeat=True, role='terrain',
           tags=['터널', '포석'])
def _flag(c): c.blit(flag_tile(2, 3), 0, 0)


CHALK = K('snow', 3)                        # 석회 표식 색(원·가로선·세로선 공통)


@REG.piece('wz-qd-mark-circle', '훈련 표식(원)', 3, 3, ['fff'] * 3, 'effects', SP,
           desc='잔디에 흰 석회로 그은 지름 약 44px 원과 가운데 점. 바닥 덧그림(캐릭터 아래).', rules='잔디 위에 덧그린다. 중앙 점이 선수 시작 위치.',
           role='terrain', tags=['훈련', '표식'])
def _mark_circle(c):
    cx = cy = 24                                    # 48px 칸 한가운데(23|24 사이) — 상하좌우 대칭
    for y in range(48):                             # 2px 두께 끊김 없는 석회 원(반지름 고정)
        for x in range(48):
            if 20.0 <= math.hypot(x + .5 - cx, y + .5 - cy) < 22.0: c.P(x, y, CHALK)
    c.ellipse(24, 24, 2, 2, CHALK)                  # 가운데 시작점
    c.R(10, 23, 5, 2, CHALK); c.R(33, 23, 5, 2, CHALK)   # 짧은 대시(선 굵기와 같은 2px)


@REG.piece('wz-qd-mark-line-h', '훈련 표식(가로선)', 1, 1, ['f'], 'effects', SP,
           desc='잔디에 석회로 그은 가로선 1칸. 이어 붙인다.', rules='가로로 반복. 원·세로선과 이어 쓴다.', repeat=True, role='terrain',
           tags=['훈련', '표식'])
def _mark_h(c):
    c.R(0, 7, 16, 2, CHALK)                         # 가운데 2px 흰 실선(원과 같은 굵기·색)


@REG.piece('wz-qd-mark-line-v', '훈련 표식(세로선)', 1, 1, ['f'], 'effects', SP,
           desc='잔디에 석회로 그은 세로선 1칸. 이어 붙인다.', rules='세로로 반복.', repeat=True, role='terrain', tags=['훈련', '표식'])
def _mark_v(c):
    c.R(7, 0, 2, 16, CHALK)                         # 가운데 2px 흰 실선(가로선과 같은 굵기·색)


# ───────────────────────── 터널: 벽·아치·문 ─────────────────────────
@REG.piece('wz-qd-tunnel-wall4', '터널 벽 1×4', 1, 4, ['S'] * 4, 'architecture', SP,
           desc='선수 터널 벽 1×4. 윗면 12px 돌판, 앞면 큰 비정형 돌. 가로로 이어 깐다.', rules='가로 반복. 아치·팀 문과 돌 줄이 맞는다.',
           repeat=True, role='wall', tags=['터널', '벽'])
def _wall4(c):
    front_stone(c, 0, 16, CAP, 5)
    wall_top(c, 0, 16)
    c.HL(0, CAP, 16, K('stone', 1))


@REG.piece('wz-qd-tunnel-wall1', '터널 벽 1×1', 1, 1, ['S'], 'architecture', SP,
           desc='낮은 터널 벽 한 칸. 윗면 5px + 앞면 돌 2줄.', rules='창틀·낮은 칸막이·끝막음에 쓴다.', repeat=True, role='wall',
           tags=['터널', '벽'])
def _wall1(c):
    blocks_wrap(c, 0, 16, 5, [6, 5], 3, 9)
    c.R(0, 0, 16, 5, K('stone', 4)); c.HL(0, 0, 16, K('stone', 1)); c.HL(0, 3, 16, K('stone', 5)); c.HL(0, 4, 16, K('stone', 2))
    c.VL(9, 1, 2, K('stone', 3))


def ring_stones(c, cx, cy, ri, ro, sectors, key_extra=2):
    """반원 아치 쐐기돌 띠(cx,cy 중심, 안쪽 반지름 ri, 바깥 ro). 가운데 쐐기돌은 더 밝고 튀어나온다."""
    mid = sectors // 2
    for y in range(int(cy - ro - key_extra - 1), int(cy)):
        for x in range(int(cx - ro - key_extra - 1), int(cx + ro + key_extra + 2)):
            dx, dy = x + .5 - cx, y + .5 - cy
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)                      # -pi(왼) .. 0(오른)
            sf = (a + math.pi) / (math.pi / sectors)
            si = min(sectors - 1, int(sf)); fr = sf - int(sf)
            out_r = ro + (key_extra if si == mid else 0)
            if ri <= r < out_r:
                tone = 5 if si == mid else (4 if si % 2 == 0 else 3)
                c.P(x, y, K('stone', tone))
                if min(fr, 1 - fr) * (math.pi / sectors) * r < 0.7: c.P(x, y, K('stone', 1))
                elif r < ri + 1.2: c.P(x, y, K('stone', max(tone - 2, 1)))


def torch(c, x, y, f=0):
    c.R(x, y + 3, 2, 3, K('iron', 2)); c.P(x - 1, y + 5, K('iron', 1)); c.P(x + 2, y + 5, K('iron', 1))
    c.R(x, y, 2, 3, K('fire', 2)); c.P(x, y - 1, K('fire', 3)); c.P(x + 1, y + 1, K('fire', 3)); c.P(x, y, K('fire', 4))


@REG.piece('wz-qd-tunnel-arch', '선수 터널 석조 아치 3×4', 3, 4,
           ['SCS', 'SCS', 'S.S', 'S.S'], 'architecture', SP,
           desc='경기장으로 나가는 큰 석조 아치 3×4. 가운데 칸이 열린 통로(폭 28px), 쐐기돌 아치 띠, 두 기둥에 횃불.',
           rules='터널 벽 1×4 한가운데에 끼운다. 아래는 터널 포석이 보이고 위쪽 아치는 머리 위를 덮는다. 가운데 열은 위아래로 끝까지 통행(위 두 칸은 사람 위 ★).',
           role='wall', tags=['터널', '아치', '입구'])
def _arch(c):
    front_stone(c, 0, 48, CAP, 11)
    wall_top(c, 0, 48)
    c.HL(0, CAP, 48, K('stone', 1))
    cx, cy, rx = 24, 36, 14
    for y in range(22, 64):
        for x in range(10, 38):
            if y >= cy or math.hypot(x + .5 - cx, y + .5 - cy) < rx: c.clear(x, y)
    ring_stones(c, cx, cy, rx, 17.5, 9)
    for y in range(cy, 64):                         # 기둥 모서리돌(번갈아 길고 짧게)
        k = (y - cy) // 6
        c.R(7, y, 3, 1, K('stone', 4 if k % 2 == 0 else 3)); c.R(38, y, 3, 1, K('stone', 4 if k % 2 == 0 else 3))
        if (y - cy) % 6 == 5: c.R(7, y, 3, 1, K('stone', 1)); c.R(38, y, 3, 1, K('stone', 1))
    for y in range(18, cy):                         # 안쪽 그늘(윗덮개 밑)
        for x in range(9, 39):
            if c.opaque(x, y):
                r = math.hypot(x + .5 - cx, y + .5 - cy)
                if r < rx + 1.2 and r >= rx - 0.1: c.P(x, y, K('stone', 1))
    for y in range(cy, 64):
        c.P(10, y, K('stone', 1)); c.P(11, y, K('stone', 2)) if False else None
    torch(c, 3, 40); torch(c, 43, 40)
    c.outline()


def emblem(c, cx, y, h):
    ramp = HOUSES[h][0]
    glyph = {'g': ["X.X.X", "XXXXX", ".XXX.", ".XXXX", ".XXX.", ".X.X.", "XX.XX"],
             's': [".XXX.", "XX...", "XXX..", ".XXX.", "..XXX", "...XX", ".XXX."],
             'r': ["X...X", "XX.XX", "XXXXX", ".XXX.", "..X..", ".XXX.", ".X.X."],
             'h': [".XXX.", "XX.XX", "X.X.X", "X.X.X", "XX.XX", ".XXX.", "..X.."]}[h]
    widths = [9, 9, 9, 9, 9, 9, 7, 7, 5, 3, 1]
    fill, border, gl = (3, 2, 0) if h == 'h' else (1, 3, 3)
    for j, w in enumerate(widths):
        x0 = cx - w // 2 - (0 if w % 2 else 0)
        c.R(cx - w // 2, y + j, w, 1, K(ramp, fill))
        c.P(cx - w // 2, y + j, K(ramp, border)); c.P(cx - w // 2 + w - 1, y + j, K(ramp, 0 if h != 'h' else 1))
    c.HL(cx - 4, y, 9, K(ramp, border))
    for j, row in enumerate(glyph):
        for i, ch in enumerate(row):
            if ch == 'X': c.P(cx - 2 + i, y + 2 + j, K(ramp, gl))
    for dx in (-5, 5):
        pass


def door_body(c, seed=21):
    """문 앞 벽(돌 앞면+윗면)과 문 구멍(반원 윗끝). 문 구멍 영역은 지운 채 돌려준다."""
    front_stone(c, 0, 32, CAP, seed)
    wall_top(c, 0, 32)
    c.HL(0, CAP, 32, K('stone', 1))
    cx, cy, rx = 16, 34, 12
    for y in range(22, 64):
        for x in range(4, 28):
            if y >= cy or math.hypot(x + .5 - cx, y + .5 - cy) < rx: c.clear(x, y)
    ring_stones(c, cx, cy, rx, 15, 7)
    for y in range(cy, 64):
        k = (y - cy) // 6
        t = 4 if k % 2 == 0 else 3
        c.R(1, y, 3, 1, K('stone', t)); c.R(28, y, 3, 1, K('stone', t))
        if (y - cy) % 6 == 5: c.R(1, y, 3, 1, K('stone', 1)); c.R(28, y, 3, 1, K('stone', 1))
    return cx, cy, rx


def in_door(x, y, cx=16, cy=34, rx=12):
    return 4 <= x < 28 and 22 <= y < 64 and (y >= cy or math.hypot(x + .5 - cx, y + .5 - cy) < rx)


def door_leaf(c, locked=False):
    for y in range(22, 64):
        for x in range(4, 28):
            if not in_door(x, y): continue
            pi = (x - 4) // 6
            tone = (3, 4, 3, 4)[pi]
            c.P(x, y, K('wood', tone))
            lx = (x - 4) % 6
            if lx == 5: c.P(x, y, K('wood', 1))
            elif lx == 0: c.P(x, y, K('wood', tone + 1))
            elif (x * 7 + y * 3) % 17 == 0: c.P(x, y, K('wood', tone - 1))
    for by in (31, 53):                              # 쇠 띠와 못
        for x in range(4, 28):
            if in_door(x, by): c.P(x, by, K('iron', 3)); c.P(x, by + 1, K('iron', 2)); c.P(x, by + 2, K('iron', 1))
        for x in (6, 12, 20, 25):
            c.P(x, by, K('iron', 4))
    c.R(4, 30, 2, 5, K('iron', 2)); c.R(4, 52, 2, 5, K('iron', 2))


@REG.piece('wz-qd-door-g', '선수 팀 문(붉은 사자·닫힘)', 2, 4, ['SS'] * 4, 'architecture', SP,
           desc='오크 팀 문 2×4 닫힌 상태. 쇠 띠·못, 붉은 방패에 금빛 사자 문장.', rules='터널 벽 1×4 사이 2칸 틈에 끼운다. states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '기숙사', '닫힘'])
def _door_g(c): _door_closed(c, 'g')


@REG.piece('wz-qd-door-s', '선수 팀 문(초록 뱀·닫힘)', 2, 4, ['SS'] * 4, 'architecture', SP,
           desc='오크 팀 문 2×4 닫힌 상태. 초록 방패에 은빛 뱀 문장.', rules='states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '기숙사', '닫힘'])
def _door_s(c): _door_closed(c, 's')


@REG.piece('wz-qd-door-r', '선수 팀 문(푸른 독수리·닫힘)', 2, 4, ['SS'] * 4, 'architecture', SP,
           desc='오크 팀 문 2×4 닫힌 상태. 푸른 방패에 청동빛 독수리 문장.', rules='states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '기숙사', '닫힘'])
def _door_r(c): _door_closed(c, 'r')


@REG.piece('wz-qd-door-h', '선수 팀 문(노란 오소리·닫힘)', 2, 4, ['SS'] * 4, 'architecture', SP,
           desc='오크 팀 문 2×4 닫힌 상태. 노란 방패에 검은 오소리 줄 문장.', rules='states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '기숙사', '닫힘'])
def _door_h(c): _door_closed(c, 'h')


def _door_closed(c, h):
    door_body(c); door_leaf(c)
    emblem(c, 16, 28, h)
    c.ellipse(23, 47, 2.5, 2.5, K('brass', 3), fill=False); c.P(23, 44, K('brass', 5)); c.R(22, 49, 3, 1, K('brass', 2))
    c.outline()


@REG.piece('wz-qd-door-open', '선수 팀 문(열림·공용)', 2, 4, ['SS', 'SS', 'CC', 'CC'], 'architecture', SP,
           desc='팀 문 열린 상태 2×4. 문짝이 안쪽으로 열려 왼쪽에 좁게 보이고 틈 안은 어둡다. 아래 두 줄은 통과 가능.',
           rules='열림은 기숙사 구분 없이 공용. states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '열림'])
def _door_open(c):
    door_body(c)
    for y in range(22, 64):
        for x in range(4, 28):
            if not in_door(x, y): continue
            if y < 40: c.P(x, y, K('iron', 1 if y < 36 else 2))
            elif y < 44: c.P(x, y, K('iron', 2))
    for y in range(22, 64):                          # 안쪽으로 열린 문짝(원근으로 좁음)
        top = 22 + (4 if y < 40 else 0)
        for x in range(4, 9):
            if in_door(x, y) and not (y < 26):
                c.P(x, y, K('wood', 3 if x < 7 else 2))
        c.P(8, y, K('wood', 1)) if in_door(8, y) and y >= 26 else None
    for by in (31, 53):
        for x in range(4, 9):
            if in_door(x, by): c.P(x, by, K('iron', 3))
    for y in range(44, 64):
        if y % 2 == 0: pass
    c.outline()


@REG.piece('wz-qd-door-locked', '선수 팀 문(잠김·공용)', 2, 4, ['SS'] * 4, 'architecture', SP,
           desc='팀 문 잠긴 상태 2×4. 문 위로 쇠사슬이 X 로 걸리고 가운데 황동 자물쇠.', rules='잠김은 공용. states 묶음 quidditch-team-door.',
           states='quidditch-team-door', role='wall', tags=['문', '잠김'])
def _door_locked(c):
    door_body(c); door_leaf(c)
    for i in range(24):
        x = 4 + i
        for yy in (30 + int(i * 1.3), 60 - int(i * 1.3)):
            if in_door(x, yy):
                c.P(x, yy, K('iron', 4 if i % 3 else 2)); c.P(x, yy + 1, K('iron', 1))
    c.R(12, 44, 8, 7, K('brass', 3)); c.R(12, 44, 8, 2, K('brass', 4)); c.HL(12, 50, 8, K('brass', 1)); c.VL(19, 44, 7, K('brass', 2))
    c.R(14, 41, 1, 3, K('iron', 3)); c.R(17, 41, 1, 3, K('iron', 3)); c.HL(14, 40, 4, K('iron', 4))
    c.P(15, 47, K('ink', 0)); c.P(16, 47, K('ink', 0)); c.P(15, 48, K('ink', 0))
    c.outline()



# ───────────────────────── 경기장 울타리·관중석 ─────────────────────────
def plank_run(c, x0, x1, hk, band=True):
    """가로 판자 울타리 몸(y 10..29): 판자 3줄, 사이 어두운 틈, 기숙사 천 띠(y 15..21)."""
    for r, y in enumerate((10, 15, 20, 25)):
        h = 5 if y < 25 else 4
        c.R(x0, y, x1 - x0, h, K('wood', 3))
        c.HL(x0, y, x1 - x0, K('wood', 4)); c.HL(x0, y + h - 1, x1 - x0, K('wood', 1))
        for gx in range(x0, x1):
            if (gx + r * 5) % 16 in (3, 4): c.P(gx, y + 2, K('wood', 2))
            if (gx + r * 7) % 16 == 11: c.P(gx, y + 1, K('wood', 5))
    c.HL(x0, 8, x1 - x0, K('wood', 5)); c.R(x0, 9, x1 - x0, 1, K('wood', 4))
    c.R(x0, 6, x1 - x0, 2, K('wood', 5)) if False else None
    if band:
        ramp = house_tiers(hk)
        c.R(x0, 14, x1 - x0, 8, K(ramp, 2)); c.HL(x0, 14, x1 - x0, K(ramp, 3)); c.HL(x0, 21, x1 - x0, K(ramp, 1))
        for gx in range(x0, x1):
            if gx % 8 == 2: c.VL(gx, 15, 6, K(ramp, 1))
            if gx % 8 == 6: c.VL(gx, 15, 3, K(ramp, 3))
        for gx in range(x0, x1):                    # 늘어진 아랫단
            if gx % 8 in (1, 2, 3): c.P(gx, 22, K(ramp, 1))


def fence_post(c, x, h0=5):
    """울타리 기둥 4px(오른쪽 어둡게) y h0..29, 윗면 뚜껑."""
    c.R(x, h0 + 2, 4, 25 - h0 + 2, K('wood', 3)); c.VL(x, h0 + 2, 25 - h0 + 2, K('wood', 4)); c.VL(x + 3, h0 + 2, 25 - h0 + 2, K('wood', 2))
    c.R(x - 1, h0, 6, 3, K('wood', 5)); c.HL(x - 1, h0 + 2, 6, K('wood', 3)); c.P(x + 4, h0 + 1, K('wood', 4))
    c.HL(x, 28, 4, K('wood', 1)); c.HL(x, 29, 4, K('wood', 0))


def v_arm(c, y0, y1):
    """세로 방향 울타리 윗면(위에서 본 가로대) y0..y1, 오른쪽 옆면 조금."""
    for y in range(y0, y1):
        c.R(5, y, 6, 1, K('wood', 5 if (y % 16) < 12 else 4))
        c.P(5, y, K('wood', 4)); c.P(10, y, K('wood', 3))
        c.VL(11, y, 1, K('wood', 2))
        if (y + 3) % 7 == 0: c.P(7, y, K('wood', 4)); c.P(8, y, K('wood', 4))
        if y % 16 == 15: c.HL(5, y, 6, K('wood', 3))


def fence_piece(c, west, east, north, south, hk='g'):
    cx = 6
    if north: v_arm(c, 0, 9)
    if west or east or (not north and not south):
        x0 = 0 if west else cx
        x1 = 16 if east else cx + 4
        plank_run(c, x0, x1, hk, band=True)
    else:
        c.R(5, 8, 6, 2, K('wood', 4))
    if south: v_arm(c, 24, 32)
    if west and east:
        fence_post(c, 6)
    else:
        fence_post(c, cx)
    c.outline()


def _reg_fence(pid, nm, desc, rules, w, e, n, s, hk='g', repeat=False, walk=('S', 'S'), tags=()):
    @REG.piece(pid, nm, 1, 2, list(walk), 'architecture', SP, desc=desc, rules=rules, repeat=repeat, role='fence',
               tags=['울타리', '경기장'] + list(tags))
    def _f(c): fence_piece(c, w, e, n, s, hk)


for _hk, (_r, _nm) in HOUSES.items():
    _reg_fence(f'wz-qd-fence-{_hk}', f'경기장 판자 울타리({_nm} 천 띠)',
               f'경기장 가장자리 1×2 가로 반복. 판자 세 줄과 기둥, 폭 8px {_nm} 색 천 띠.',
               '가로로 이어 깐다. 기둥이 16px 마다 하나 선다. 끝·모서리는 end/corner 조각.', True, True, False, False, _hk, repeat=True)
_reg_fence('wz-qd-fence-v', '경기장 울타리(세로)', '세로 방향 울타리 1×2. 위에서 본 가로대와 옆면, 오른쪽 옆에 천 띠.',
           '세로로 반복해 쌓는다.', False, False, True, True, repeat=True)
_reg_fence('wz-qd-fence-corner-sw', '경기장 울타리 모서리(남서)', '왼쪽 아래 모서리: 동쪽과 북쪽으로 이어진다.', '남서 구석에 둔다.',
           False, True, True, False)
_reg_fence('wz-qd-fence-corner-se', '경기장 울타리 모서리(남동)', '오른쪽 아래 모서리: 서쪽과 북쪽으로 이어진다.', '남동 구석에 둔다.',
           True, False, True, False)
_reg_fence('wz-qd-fence-corner-nw', '경기장 울타리 모서리(북서)', '왼쪽 위 모서리: 동쪽과 남쪽으로 이어진다.', '북서 구석에 둔다.',
           False, True, False, True)
_reg_fence('wz-qd-fence-corner-ne', '경기장 울타리 모서리(북동)', '오른쪽 위 모서리: 서쪽과 남쪽으로 이어진다.', '북동 구석에 둔다.',
           True, False, False, True)
_reg_fence('wz-qd-fence-end-w', '경기장 울타리 끝(왼쪽)', '가로 울타리의 왼쪽 끝 기둥.', '울타리 열의 왼쪽 끝.', False, True, False, False)
_reg_fence('wz-qd-fence-end-e', '경기장 울타리 끝(오른쪽)', '가로 울타리의 오른쪽 끝 기둥.', '울타리 열의 오른쪽 끝.', True, False, False, False)


@REG.piece('wz-qd-stands-front', '관중석 하단 정면 1×2', 1, 2, ['S', 'S'], 'architecture', SP,
           desc='관중석 아래쪽 정면 벽 1×2. 판자 세로 널 두 장과 X 가새, 위에 벤치 윗면 줄이 살짝 보인다.',
           rules='가로 반복. 울타리 뒤쪽 한 줄로 깐다.', repeat=True, role='wall', tags=['관중석', '경기장'])
def _stands(c):
    c.R(0, 0, 16, 5, K('wood', 4)); c.HL(0, 0, 16, K('wood', 5)); c.HL(0, 4, 16, K('wood', 2))
    for x in range(16):
        if x % 8 == 3: c.P(x, 2, K('wood', 3))
    c.R(0, 5, 16, 4, K('wood', 2)); c.HL(0, 5, 16, K('wood', 5)); c.HL(0, 8, 16, K('wood', 1))      # 벤치 앞판
    for i in range(2):
        x = i * 8
        c.R(x, 9, 8, 23, K('wood', 3))
        c.VL(x, 9, 23, K('wood', 4)); c.VL(x + 7, 9, 23, K('wood', 1))
        for y in (13, 20, 27):
            c.P(x + 2 + (y % 3), y, K('wood', 2))
        c.P(x + 3, 16, K('wood', 5)); c.P(x + 5, 24, K('wood', 5))
    for i in range(14):                                 # X 가새(대각선 두 줄, 가로 반복 안 깨지게 칸 안에서 닫는다)
        y = 11 + i
        if y < 28:
            c.P(1 + i, y, K('wood', 5)); c.P(14 - i, y, K('wood', 5))
            c.P(1 + i, y + 1, K('wood', 1)); c.P(14 - i, y + 1, K('wood', 1))
    c.HL(0, 29, 16, K('wood', 1)); c.HL(0, 30, 16, K('wood', 0)); c.R(0, 31, 16, 1, K('dirt', 1))
    for x in (2, 6, 10, 14): c.P(x, 10, K('iron', 3))


# ───────────────────────── 링 골대 ─────────────────────────
def hoop_canvas(tiles, ribbon):
    """폭 32, 높이 tiles*16 (링 2×2 + 기둥). 링 아래 가운데 기둥, 밑동은 받침 돌."""
    H = tiles * 16
    c = Cv(32, H)
    cx, cy, rx, ry = 15.5, 13.5, 11.5, 11.5
    # 기둥(링 아래~바닥): x 14..17
    c.R(14, 25, 4, H - 25 - 6, K('brass', 4))
    c.VL(14, 25, H - 31, K('brass', 5)); c.VL(17, 25, H - 31, K('brass', 2)); c.VL(16, 25, H - 31, K('brass', 3))
    for y in range(32, H - 8, 12):
        c.R(14, y, 4, 1, K('brass', 2))                 # 이음 띠
    # 받침
    bx, by = 10, H - 8
    c.R(bx, by, 12, 8, K('stone', 3)); c.R(bx, by, 12, 3, K('stone', 5)); c.HL(bx, by + 2, 12, K('stone', 3))
    c.VL(bx + 11, by + 3, 5, K('stone', 2)); c.HL(bx, H - 1, 12, K('stone', 1)); c.P(bx + 3, by + 5, K('stone', 2))
    # 링: 안쪽이 비어 있는 황동 고리(약간 위에서 본 타원)
    c.ellipse(cx, cy, rx, ry, K('brass', 4)); c.ellipse(cx, cy, rx - 2.3, ry - 2.3, K('ink', 0))
    for y in range(32):
        for x in range(32):
            dx, dy = x + .5 - cx, y + .5 - cy
            if math.hypot(dx / (rx - 2.3), dy / (ry - 2.3)) < 1.0: c.clear(x, y)
            elif math.hypot(dx / rx, dy / ry) < 1.0 and c.opaque(x, y):
                t = 4
                if dx + dy < -9: t = 5
                elif dx + dy > 10: t = 2
                elif dx + dy > 5: t = 3
                c.P(x, y, K('brass', t))
    c.P(7, 6, K('brass', 5)); c.P(8, 5, K('brass', 5))
    # 링을 기둥에 잇는 조임쇠
    c.R(13, 23, 6, 3, K('brass', 3)); c.HL(13, 23, 6, K('brass', 5)); c.HL(13, 25, 6, K('brass', 1))
    # 리본 (링 위쪽 오른쪽에 묶인 기숙사 색)
    r = house_tiers(ribbon)
    c.R(22, 3, 3, 2, K(r, 2)); c.P(25, 5, K(r, 2)); c.R(24, 6, 2, 4, K(r, 2)); c.P(24, 10, K(r, 1)); c.P(25, 9, K(r, 3)); c.P(23, 4, K(r, 3))
    c.outline()
    return c


def _hoop_walk(tiles):
    rows = ['CC', 'CC'] + ['CC'] * (tiles - 3) + ['SS']
    return rows


def _reg_hoop(n, tiles, ribbon, nm):
    @REG.piece(f'wz-qd-goal-{n}', f'링 골대 {nm}', 2, tiles, _hoop_walk(tiles), 'architecture', SP,
               desc=f'퀴디치 골대 하나. 기둥 {tiles - 2}칸 높이 위에 지름 약 23px 황동 링(2×2). 밑동은 돌 받침, 링과 기둥은 머리 위로 지나간다.',
               rules='링 칸·기둥 칸은 통과(C), 받침(밑동 줄)만 막힌다. 세 높이를 나란히 세워 쓴다.', role='prop', tags=['골대', '링', '경기장'])
    def _h(c): c.blit(hoop_canvas(tiles, ribbon), 0, 0)


_reg_hoop(4, 6, 'h', '(기둥 4칸, 2×6)')
_reg_hoop(5, 7, 'r', '(기둥 5칸, 2×7)')
_reg_hoop(6, 8, 'g', '(기둥 6칸, 2×8)')


@REG.piece('wz-qd-goal-kit', '링 골대 세 개 묶음 6×8', 6, 8, ['....CC', '..CCCC', 'CCCCCC', 'CCCCCC', 'CCCCCC', 'CCCCCC', 'CCCCCC', 'SSSSSS'], 'architecture', SP,
           desc='높이가 다른 골대 세 개(기둥 4·5·6칸)를 나란히 세운 묶음. 왼쪽부터 낮은 것, 오른쪽이 가장 높다.',
           rules='경기장 한쪽 끝에 통째로 세운다. 링 칸·기둥 칸은 통과, 밑동 줄만 막힌다.', role='prop', tags=['골대', '경기장', '키트'])
def _kit(c):
    for i, (t, rb) in enumerate(((6, 'h'), (7, 'r'), (8, 'g'))):
        c.blit(hoop_canvas(t, rb), i * 32, 128 - t * 16)


# ───────────────────────── 공 ─────────────────────────
def ball(c, cx, cy, r, ramp, base=3, spec=True):
    """윗왼쪽 빛을 받는 공(원). 빛 4단."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy)
            if d > r: continue
            l = -(dx * .6 + dy * .8) / max(r, 1)        # -1(그늘)..1(빛)
            t = base + (2 if l > .55 else 1 if l > .1 else 0 if l > -.45 else -1)
            c.P(x, y, K(ramp, t))
    if spec:
        c.P(int(cx - r * .45), int(cy - r * .5), K(ramp, base + 3))


def disc(cx, cy, r):
    """반지름 r 원의 화소 목록(픽셀 중심 판정)."""
    out = []
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if math.hypot(x + .5 - cx, y + .5 - cy) <= r: out.append((x, y))
    return out


def toned_ball(c, cx, cy, r, ol, dark, body, lit, lit_cut=.55, dark_cut=-.35):
    """색을 직접 고른 공: 1px 윤곽(ol) + 오른쪽 아래 그늘(dark) + 몸(body) + 왼쪽 위 빛(lit). 화소 목록을 돌려준다."""
    px = disc(cx, cy, r); ps = set(px)
    for x, y in px:
        if any((x + ox, y + oy) not in ps for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.P(x, y, ol); continue
        dx, dy = x + .5 - cx, y + .5 - cy
        l = -(dx * .6 + dy * .8) / max(r, 1)
        c.P(x, y, lit if l > lit_cut else body if l > dark_cut else dark)
    return ps


def sprite(c, x0, y0, rows, pal=None):
    """문자 지도로 찍기('.'=건너뜀)."""
    pal = pal or SPRITE_PAL
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': c.P(x0 + i, y0 + j, pal[ch])


SPRITE_PAL = {'w': K('snow', 3), 's': K('snow', 2), 'g': K('snow', 1),
              'Y': K('brass', 5), 'y': K('brass', 4), 'b': K('brass', 3), 'o': K('brass', 1)}
BALL6 = ['.oooo.',                     # 6px 둥근 공(왼쪽 위 빛)
         'oSlBBo',
         'olBBBo',
         'oBBBDo',
         'oBBDDo',
         '.oooo.']
QF6 = {'o': K('red', 1), 'S': K('skin', 3), 'l': K('red', 3), 'B': K('red', 3), 'D': K('red', 2)}
BL6 = {'o': K('iron', 0), 'S': K('iron', 4), 'l': K('iron', 2), 'B': K('iron', 1), 'D': K('iron', 0)}
SNITCH_S = ['w......w',                 # 8×5: 금 원 4px + 양옆 위로 펼친 은빛 날개 2~3px
            'sw.oo.ws',
            '.soYyos.',
            '..oyyb..',
            '...bb...']
QF = dict(ol=K('red', 1), dark=K('red', 2), body=K('red', 3), lit=K('red', 3))     # 퀘이플: 적갈 윤곽·진홍 몸
BL = dict(ol=K('iron', 0), dark=K('iron', 0), body=K('iron', 1), lit=K('iron', 2))   # 블러저: 거의 검은 쇠


def quaffle(c, cx, cy, r=3.2):
    toned_ball(c, cx, cy, r, **QF)


def bludger(c, cx, cy, r=3.2, strap=True):
    toned_ball(c, cx, cy, r, **BL)


def drop_shadow(c, x, y, w, h=2):
    for i in range(h):
        c.HL(x + i, y + i, w - 2 * i, K('iron', 1))


# ───────────────────────── 빗자루 ─────────────────────────
STRAW = [K('brass', 5), K('brass', 4), K('wood', 5), K('brass', 3)]   # 짚: 밝은 황토 3단 + 그늘


def broom_up(c, x, y0, yb, y1, tone=0):
    """세워 건 빗자루. x = 2px 손잡이 왼쪽 열, y0 손잡이 끝, yb 묶은 끈 줄, y1 짚 끝(바닥).
    손잡이(나무 2px) → 진한 끈 1px + 황동 고리 → 아래로 부채꼴로 퍼지는 짚 다발."""
    hl, hd = (K('wood', 4), K('wood', 3)) if tone == 0 else (K('wood', 3), K('wood', 2))
    c.VL(x, y0, yb - y0, hl); c.VL(x + 1, y0, yb - y0, hd); c.P(x, y0, K('wood', 5))
    n = y1 - yb - 1                                  # 짚 줄 수
    for i in range(n):
        yy = yb + 1 + i
        half = min(3, 1 + (i + 1) // 2)              # 폭 4 → 6 → (아래) 6
        x0, x1 = x - half + 1, x + half              # [x0, x1]
        for xx in range(x0, x1 + 1):
            k = xx - x0
            col = STRAW[0] if k <= 1 else STRAW[1] if xx <= x + 1 else STRAW[2]
            if xx == x1: col = STRAW[3]                                  # 오른쪽 그늘
            if xx in (x - 1, x + 2) and 0 < k < x1 - x0 and i > 1: col = STRAW[2]          # 세로 짚 결(고정 열)
            c.P(xx, yy, col)
        if i == n - 1:                               # 짚 끝: 들쭉날쭉
            for xx in range(x0, x1 + 1, 2): c.P(xx, yy, STRAW[3])
    c.R(x - 1, yb, 4, 1, K('wood', 1)); c.P(x, yb, K('brass', 4))       # 묶은 끈 1px + 황동 매듭


@REG.piece('wz-qd-broom-rack', '빗자루 랙 2×2', 2, 2, ['SS', 'SS'], 'furniture', SP,
           desc='벽 앞에 놓는 나무 빗자루 걸이. 위 가로대에 빗자루 네 자루가 손잡이를 걸고 짚 다발을 아래로 세워 서 있다.',
           rules='선수 터널 벽 앞이나 사물함 옆에 둔다.', role='prop', tags=['빗자루', '랙'])
def _rack(c):
    # 받침(낮은 나무 턱: 윗면 2px + 정면 3px)
    c.R(1, 26, 30, 2, K('wood', 4)); c.HL(1, 26, 30, K('wood', 5))
    c.R(1, 28, 30, 3, K('wood', 3)); c.HL(1, 30, 30, K('wood', 2))
    # 기둥 두 개(왼쪽 밝게)
    for x in (1, 28):
        c.R(x, 4, 3, 24, K('wood', 3)); c.VL(x, 4, 24, K('wood', 4)); c.VL(x + 2, 4, 24, K('wood', 2))
        c.R(x, 2, 3, 2, K('wood', 5))
    # 위 가로대(윗면 2px + 정면 2px)
    c.R(1, 4, 30, 2, K('wood', 5)); c.R(1, 6, 30, 2, K('wood', 3)); c.HL(1, 7, 30, K('wood', 2))
    # 빗자루 네 자루: 손잡이는 가로대 앞을 지나 위로 1~2px 나온다
    for i, x in enumerate((4, 11, 18, 25)):
        broom_up(c, x, 2, 15, 28, tone=i % 2)
        c.P(x - 1, 6, K('brass', 4)); c.P(x + 2, 6, K('brass', 2))        # 가로대 황동 걸이
    c.outline()


# ───────────────────────── 사물함 ─────────────────────────
def locker(c, hk):
    r = house_tiers(hk)
    c.R(1, 0, 14, 32, K(r, 2))
    # 윗면
    c.R(1, 0, 14, 4, K(r, 3)); c.HL(1, 0, 14, K(r, 3)); c.HL(1, 3, 14, K('iron', 4))
    # 문
    c.R(2, 4, 12, 25, K(r, 2)); c.VL(2, 4, 25, K(r, 3)); c.VL(13, 4, 25, K(r, 1))
    c.HL(2, 4, 12, K('iron', 4))
    # 환기 틈
    for k in range(4): c.HL(4, 7 + k * 2, 8, K(r, 0)); c.HL(4, 8 + k * 2, 8, K(r, 1)) if False else None
    for k in range(4): c.HL(4, 7 + k * 2, 8, K(r, 0))
    # 이름표(작은 황동판)
    c.R(5, 17, 6, 3, K('brass', 4)); c.HL(5, 17, 6, K('brass', 5)); c.HL(5, 19, 6, K('brass', 2))
    c.P(7, 18, K('wood', 2)); c.P(9, 18, K('wood', 2))
    # 손잡이
    c.R(11, 22, 2, 3, K('iron', 4)); c.VL(11, 22, 3, K('iron', 3)); c.P(12, 25, K('iron', 1))
    # 문 아랫단·발
    c.HL(2, 28, 12, K(r, 0)); c.R(1, 29, 14, 2, K('iron', 2)); c.HL(1, 29, 14, K('iron', 3)); c.R(2, 31, 3, 1, K('iron', 0)); c.R(11, 31, 3, 1, K('iron', 0))
    c.outline()
    c.HL(1, 0, 14, K(r, 3)) if False else None


for _hk, (_r, _nm) in HOUSES.items():
    def _mk(hk=_hk):
        def _f(c): locker(c, hk)
        return _f
    REG.piece(f'wz-qd-locker-{_hk}', f'선수 사물함({_nm} 색)', 1, 2, ['S', 'S'], 'furniture', SP,
              desc=f'1×2 철판 사물함. 문은 {_nm} 색, 환기 틈 네 줄과 황동 이름표, 철 손잡이.',
              rules='터널 벽 앞에 가로로 나란히 세운다.', role='prop', tags=['사물함'], repeat=False)(_mk())


# ───────────────────────── 볼 수납 상자 ─────────────────────────
def crate_body(c, lid_open):
    # 32×16: 상자 앞면 y 8..15 (+ 윗면 y 4..8 닫힘시 전체 y 2..15)
    if not lid_open:
        c.R(0, 3, 32, 6, K('wood', 5)); c.HL(0, 3, 32, K('wood', 5)); c.HL(0, 8, 32, K('wood', 3))        # 뚜껑 윗면
        for x in range(2, 30, 6): c.P(x + 1, 5, K('wood', 4)); c.P(x + 2, 6, K('wood', 4))
        c.R(0, 9, 32, 7, K('wood', 3)); c.HL(0, 9, 32, K('wood', 4)); c.VL(31, 9, 7, K('wood', 2))
        c.HL(0, 15, 32, K('wood', 1))
        # 가죽 끈 두 줄(윗면~앞면 세로로 가로지름)
        for x in (6, 22):
            c.R(x, 3, 4, 13, K('dirt', 5)); c.VL(x, 3, 13, K('dirt', 5)); c.VL(x + 3, 3, 13, K('dirt', 3))
            c.R(x, 10, 4, 3, K('brass', 4)); c.HL(x, 10, 4, K('brass', 5)); c.HL(x, 12, 4, K('brass', 2)); c.P(x + 1, 11, K('wood', 1))
        # 손잡이 가운데
        c.R(14, 11, 4, 2, K('iron', 3)); c.HL(14, 11, 4, K('iron', 4))
    else:
        # 뒤로 젖힌 뚜껑(안쪽 면)
        c.R(0, 0, 32, 3, K('wood', 2)); c.HL(0, 0, 32, K('wood', 3))
        for x in (6, 22): c.R(x, 0, 4, 3, K('dirt', 3))
        # 안쪽: 뒷벽 안면(어둡게) + 바닥(중간 갈색) — 검은 블러저가 묻히지 않게
        c.R(1, 3, 30, 6, K('wood', 2)); c.HL(1, 3, 30, K('wood', 1))
        for x in (8, 15, 22): c.VL(x, 3, 6, K('wood', 1)); c.P(x, 3, K('wood', 4))       # 칸막이 3개(윗단만 밝게)
        for x0, w in ((1, 7), (9, 6), (16, 6), (23, 8)): c.HL(x0, 8, w, K('wood', 1))          # 칸 바닥 그늘
        # 칸마다 다른 공
        sprite(c, 2, 3, BALL6, QF6)                                                   # 퀘이플: 붉은 가죽 + 반사
        for bx in (9, 16):                                                             # 블러저 둘: 검은 쇠 + 반사 + 끈 한 줄
            sprite(c, bx, 3, BALL6, BL6)
            c.HL(bx, 7, 6, K('wood', 3)); c.P(bx + 3, 7, K('brass', 4))
        sprite(c, 23, 3, SNITCH_S)                                                    # 스니치: 금 원 + 위로 펼친 은빛 날개
        sprite(c, 23, 3, SNITCH_S)                                                    # 스니치: 금 원 + 위로 접은 은빛 날개
        # 앞판
        c.R(0, 9, 32, 7, K('wood', 3)); c.HL(0, 9, 32, K('wood', 5)); c.VL(31, 10, 6, K('wood', 2)); c.HL(0, 15, 32, K('wood', 1))
        for x in (6, 22):
            c.R(x, 10, 4, 5, K('dirt', 5)); c.VL(x + 3, 10, 5, K('dirt', 3))
            c.R(x, 10, 4, 2, K('brass', 4)); c.HL(x, 11, 4, K('brass', 2)); c.P(x, 10, K('brass', 5))
    for x in (0, 31): c.VL(x, 3 if not lid_open else 0, 13 if not lid_open else 16, K('wood', 1))
    c.HL(0, 3 if not lid_open else 0, 32, K('wood', 1))
    # 접합 모서리 반복되는 못
    for x in (2, 14, 28):
        c.P(x, 13, K('iron', 3))


REG.piece('wz-qd-ball-crate', '볼 수납 상자(닫힘)', 2, 1, ['SS'], 'furniture', SP,
          desc='가죽 끈과 황동 버클로 묶인 2×1 나무 상자. 닫혀 있다.',
          rules='닫힘/열림 상태가 한 쌍. 열림은 wz-qd-ball-crate-open.', role='prop', tags=['상자', '공'], states='quidditch-ball-crate')(
    lambda c: crate_body(c, False))
REG.piece('wz-qd-ball-crate-open', '볼 수납 상자(열림)', 2, 1, ['SS'], 'furniture', SP,
          desc='뚜껑을 젖힌 볼 상자. 칸마다 퀘이플(붉은 가죽 공), 블러저 2개(끈에 묶인 검은 쇠공), 골든 스니치(금공과 은빛 날개)가 들어 있다.',
          rules='닫힘 상자와 같은 크기·같은 자리. 상태 전환으로 바꾼다.', role='prop', tags=['상자', '공'], states='quidditch-ball-crate')(
    lambda c: crate_body(c, True))


# ───────────────────────── 훈련 표적 ─────────────────────────
@REG.piece('wz-qd-target', '훈련 표적 1×2', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='나무 말뚝에 세운 고리 표적. 붉은·흰·황동 동심원 과녁판이 비스듬히 선 말뚝 위에 걸려 있다.',
           rules='경기장 가장자리나 훈련 구역에 둔다.', role='prop', tags=['표적', '훈련'])
def _target(c):
    # 말뚝(뒤) + 받침 발
    c.R(7, 14, 3, 15, K('wood', 3)); c.VL(7, 14, 15, K('wood', 4)); c.VL(9, 14, 15, K('wood', 2))
    c.R(2, 28, 12, 3, K('wood', 3)); c.HL(2, 28, 12, K('wood', 4)); c.HL(2, 30, 12, K('wood', 1)); c.VL(13, 29, 2, K('wood', 2))
    c.HL(4, 31, 10, K('iron', 1))
    # 과녁판 지름 14: 윗면 두께로 3/4 느낌(아래 1줄 두께)
    cx, cy = 8, 8
    c.ellipse(cx, cy + 1, 7, 7, K('wood', 2))
    for rad, col in ((7, K('wood', 5)), (6.2, K('red', 3)), (4.9, K('linen', 4)), (3.6, K('red', 3)), (2.2, K('brass', 5))):
        c.ellipse(cx, cy, rad, rad, col)
    c.P(5, 4, K('linen', 4)) if False else None
    c.P(cx - 1, cy - 1, K('brass', 5)); c.P(cx, cy, K('brass', 3))
    # 박힌 화살 대신 꽂힌 공 자국 둘
    c.P(11, 11, K('red', 1)); c.P(4, 10, K('red', 1))
    c.outline()


# ───────────────────────── 바닥에 둔 것들 (f) ─────────────────────────
@REG.piece('wz-qd-broom-lying', '눕혀 둔 빗자루 2×1', 2, 1, ['ff', ], 'furniture', SP,
           desc='바닥에 눕혀 둔 빗자루. 손잡이는 왼쪽, 솔은 오른쪽으로 나가며 발 둘레에 짧은 그림자가 진다.',
           rules='덧그림(f). 사물함 앞이나 랙 옆 바닥에 얹는다.', role='prop', tags=['빗자루'])
def _broom_lying(c):
    drop_shadow(c, 3, 11, 26, 2)
    # 손잡이(위 밝고 아래 어두움) y 6..8
    c.R(1, 6, 18, 2, K('wood', 4)); c.HL(1, 6, 18, K('wood', 5)); c.HL(1, 8, 18, K('wood', 2)); c.P(1, 6, K('wood', 5)); c.P(0, 7, K('wood', 2))
    for x in (6, 12): c.P(x, 7, K('wood', 3))
    c.R(18, 5, 2, 5, K('brass', 4)); c.VL(18, 5, 5, K('brass', 5)); c.VL(19, 5, 5, K('brass', 2))
    # 솔: 오른쪽으로 부채꼴
    for i in range(12):
        hh = 5 + i // 2
        y0 = 7 - hh // 2
        x = 20 + i
        c.R(x, y0, 1, hh, K('dirt', 5 if i % 3 != 2 else 4))
        c.P(x, y0 + hh - 1, K('dirt', 3)); c.P(x, y0, K('dirt', 5))
        if i % 4 == 1: c.P(x, y0 + hh // 2, K('dirt', 3))
    c.VL(31, 5, 5, K('dirt', 2)) if False else None
    c.outline()


@REG.piece('wz-qd-ball-quaffle', '퀘이플', 1, 1, ['f'], 'furniture', SP,
           desc='바닥에 놓인 퀘이플. 붉은 가죽 공, 윗면에 이음선과 바닥 그림자.', rules='덧그림(f). 한 칸에 한 개.', role='prop', tags=['공', '퀘이플'])
def _quaffle(c):
    drop_shadow(c, 3, 13, 10, 2)
    toned_ball(c, 8, 8, 5.4, **QF)                  # 10×10 둥근 붉은 가죽 공
    c.P(5, 5, K('skin', 3)); c.P(6, 5, K('skin', 2)); c.P(5, 6, K('skin', 2))       # 왼쪽 위 가죽 반사
    for x, y in ((9, 6), (6, 9), (10, 9)): c.P(x, y, K('red', 2))                     # 손잡이 홈 3개


@REG.piece('wz-qd-ball-bludger', '블러저', 1, 1, ['f'], 'furniture', SP,
           desc='바닥에 놓인 블러저. 검은 쇠공을 가죽 끈으로 묶어 둔 것.', rules='덧그림(f). 한 칸에 한 개.', role='prop', tags=['공', '블러저'])
def _bludger(c):
    drop_shadow(c, 3, 13, 10, 2)
    ps = toned_ball(c, 8, 8, 5.4, **BL)             # 10×10 거의 검은 쇠공
    for x in range(3, 13):                          # 쇠 띠: 위에서 본 적도선(가운데가 아래로 휜다)
        y = int(round(8 + 1.6 * math.sqrt(max(0., 1 - ((x + .5 - 8) / 5.4) ** 2))))
        if (x, y) in ps and (x, y - 1) in ps and (x, y + 1) in ps:
            c.P(x, y, K('iron', 2)); c.P(x, y - 1, K('iron', 0))
            if x in (5, 8, 11): c.P(x, y, K('iron', 3))          # 리벳
    c.P(5, 5, K('iron', 4)); c.P(6, 5, K('iron', 3)); c.P(5, 6, K('iron', 3))   # 좁은 금속 반사
    for i in range(9):                              # 끈은 대각선 한 줄(공 안에서만)
        x, y = 11 - i, 4 + i
        if (x, y) in ps and c.get(x, y) != K('iron', 0) or (x, y) in ps and i in (0, 8): c.P(x, y, K('wood', 3))


@REG.piece('wz-qd-ball-snitch', '골든 스니치', 1, 1, ['f'], 'furniture', SP,
           desc='바닥에 내려앉은 골든 스니치. 작은 금공과 양옆으로 접힌 은빛 날개.', rules='덧그림(f). 한 칸에 한 개.', role='prop', tags=['공', '스니치'])
def _snitch(c):
    drop_shadow(c, 4, 13, 8, 2)
    ball(c, 8, 8.5, 3.2, 'brass', 3, spec=False); c.P(7, 7, K('brass', 5)); c.P(6, 8, K('brass', 4))
    for sgn in (-1, 1):
        x0 = 8 + sgn * 4 - (1 if sgn < 0 else 0)
        for k in range(4):
            xx = 8 + sgn * (4 + k) - (1 if sgn < 0 else 0)
            c.P(xx, 7 - k // 2, K('iron', 4)); c.P(xx, 8 - k // 2, K('snow', 2)); c.P(xx, 9 - k // 2, K('snow', 1))
        c.P(8 + sgn * 7 - (1 if sgn < 0 else 0), 6 - 0, K('snow', 3))
    c.outline()


# ───────────────────────── 예제 ─────────────────────────
def _tunnel_place():
    pl = [('wz-qd-tunnel-arch', 6, 0)]
    for x in (3, 4, 5):
        pl.append(('wz-qd-tunnel-wall4', x, 0))
    for x in (9, 10, 11):
        pl.append(('wz-qd-tunnel-wall4', x, 0))
    pl += [('wz-qd-tunnel-wall4', 1, 0), ('wz-qd-tunnel-wall4', 2, 0), ('wz-qd-tunnel-wall4', 12, 0), ('wz-qd-tunnel-wall4', 13, 0)]
    pl += [('wz-qd-locker-g', 1, 4), ('wz-qd-locker-s', 2, 4), ('wz-qd-broom-rack', 12, 4), ('wz-qd-ball-crate-open', 13, 7)]
    # 골대 3개
    pl += [('wz-qd-goal-4', 2, 6), ('wz-qd-goal-6', 7, 4), ('wz-qd-goal-5', 12, 5)] if False else []
    pl += [('wz-qd-goal-5', 3, 5), ('wz-qd-goal-6', 7, 4), ('wz-qd-goal-4', 11, 6)]
    # 훈련 표식·표적·공
    pl += [('wz-qd-mark-circle', 8, 8), ('wz-qd-target', 1, 9), ('wz-qd-ball-quaffle', 5, 10), ('wz-qd-ball-bludger', 10, 10), ('wz-qd-broom-lying', 13, 10), ('wz-qd-ball-snitch', 5, 7)]
    # 울타리 경계
    pl += [('wz-qd-fence-corner-sw', 0, 12), ('wz-qd-fence-corner-se', 15, 12)]
    hk = ['g', 's', 'r', 'h']
    for i, x in enumerate(range(1, 15)):
        pl.append((f'wz-qd-fence-{hk[(i // 3) % 4]}', x, 12))
    for y in range(4, 12, 2):
        pl.append(('wz-qd-fence-v', 0, y)); pl.append(('wz-qd-fence-v', 15, y))
    return pl


REG.example('wz-qd-example-tunnel', '선수 터널과 경기장', SP, 16, 14, 'wz-qd-pitch', _tunnel_place(),
            desc='위쪽 석조 터널 아치에서 아래 경기장 잔디로 나온다. 골대 세 개, 훈련 표식, 사물함·빗자루 랙·볼 상자, 울타리 경계.')

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
