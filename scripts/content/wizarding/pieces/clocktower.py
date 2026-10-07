"""시계탑 기어실(clocktower) — 황동 톱니(큰·중·작, 정적+회전 8프레임)·축·크랭크·시계탑 석벽·기어 개방벽·보·발코니·발판·
통로·난간·계단·문 3상태·기름 얼룩·윤활통·공구함·공구 걸이판·작업 발판·문자판 뒷면.
  python3 scripts/content/wizarding/pieces/clocktower.py   → 검사 + tiledata/wizarding/review/clocktower.png
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module, darker   # noqa: E402
from _clocktower_wall import wall_face, plinth, cap, wall_n_base, arch_mask, dilate, CUTS   # noqa: E402

MODULE = 'clocktower'
SP = 'clocktower'
ST = 'stone'
BR = 'brass'
WD = 'wood'
IR = 'iron'


def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 톱니바퀴 ─────────────────────────
def gear_front_mask(w, h, cx, cy, rt, rr, teeth, phase):
    """정면 원판 실루엣: (x,y)→ 'b'(몸) 또는 't'(이빨)."""
    pitch = 360.0 / teeth
    m = {}
    for y in range(h):
        for x in range(w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > rt: continue
            if d <= rr:
                m[(x, y)] = 'b'; continue
            ang = (math.degrees(math.atan2(dy, dx)) - phase) % pitch
            u = abs(ang / pitch - 0.5)
            hw = 0.30 - 0.11 * (d - rr) / max(1.0, rt - rr)
            if u <= hw: m[(x, y)] = 't'
    return m


def gear_disc(c, cx, cy, rt, rr, teeth, phase, spokes=4, thick=3, hub=4, web_in=4, spoke_w=1.6):
    """벽에 선 황동 원판(정면) + 위쪽 두께 면. phase 는 도(회전)."""
    W, H = c.w, c.h
    fm = gear_front_mask(W, H, cx, cy, rt, rr, teeth, phase)
    # 두께: 앞 원판을 위로 1..thick px 민 것의 합집합
    band = set()
    for k in range(1, thick + 1):
        for (x, y) in fm:
            if (x, y - k) not in fm: band.add((x, y - k))
    for (x, y) in band:
        top = (x, y + 1) in band or (x, y + 1) in fm
        # 두께 면: 위쪽 가장자리는 밝고(윗면) 앞쪽은 그늘
        nb = 0
        while (x, y - nb - 1) in band: nb += 1
        c.P(x, y, K(BR, 4) if nb == 0 and (x + y) % 9 else K(BR, 3) if nb < thick else K(BR, 2))
    # 앞면
    for (x, y), kd in fm.items():
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        d = math.hypot(dx, dy) or 1.0
        n = (dx + dy) / (d * 1.4142)
        if kd == 't':
            c.P(x, y, K(BR, 4) if n < -0.35 else K(BR, 3) if n < 0.4 else K(BR, 2))
            continue
        col = K(BR, 3)
        if d > rr - 2.0:                     # 테두리 고리
            col = K(BR, 5) if n < -0.45 else K(BR, 4) if n < 0.25 else K(BR, 3) if n < 0.65 else K(BR, 2)
        elif d > rr - web_in:                # 안쪽 홈(위·왼쪽은 그늘, 아래·오른쪽은 빛)
            col = K(BR, 1) if n < -0.1 else K(BR, 3)
        else:                                # 웹(살판)
            col = K(BR, 2)
            # 살(스포크)
            ang = math.degrees(math.atan2(dy, dx)) - phase
            sp = 360.0 / spokes
            a = (ang % sp)
            a = min(a, sp - a)                       # 가장 가까운 살 방향과의 각
            perp = d * math.sin(math.radians(a))     # 중심선에서의 수직 거리
            if a < 90 and perp <= spoke_w and d > hub:
                col = K(BR, 4) if n < -0.2 else K(BR, 3)
                if perp > spoke_w - 1.0 and n > 0.2: col = K(BR, 2)
        if d <= hub:                         # 허브
            col = K(BR, 5) if n < -0.5 else K(BR, 4) if n < 0.2 else K(BR, 3)
            if d > hub - 1.0 and n > 0.3: col = K(BR, 2)
        if d <= max(1.2, hub * 0.42):        # 축 구멍
            col = K(BR, 0) if n < 0.2 else K(BR, 1)
        c.P(x, y, col)
    # 앞 원판과 두께 면의 경계는 한 단 어둡게(구분)
    for (x, y) in fm:
        if (x, y - 1) in band and (x, y - 1) not in fm:
            c.P(x, y, K(BR, 1) if fm[(x, y)] == 't' else K(BR, 1))
    c.outline()


# (이름, 크기칸, 중심 y, 외경 rt, 뿌리 rr, 이빨수, 두께, 허브, 살수)
GEARS = {
    'L': dict(n=4, cy=34, rt=28.5, rr=23.5, teeth=16, thick=3, hub=5, web_in=4, spokes=4, sw=1.9),
    'M': dict(n=3, cy=26, rt=21.5, rr=17.5, teeth=12, thick=3, hub=4, web_in=4, spokes=4, sw=1.6),
    'S': dict(n=2, cy=18, rt=13.5, rr=10.5, teeth=8, thick=2, hub=3, web_in=3, spokes=4, sw=1.2),
}
ROT = 360.0 / 4 / 8     # 한 바퀴(살 4개 대칭) 90도를 8프레임으로


def _gear(c, key, phase):
    g = GEARS[key]
    s = g['n'] * 16
    gear_disc(c, s / 2.0, g['cy'], g['rt'], g['rr'], g['teeth'], phase, spokes=g['spokes'], thick=g['thick'],
              hub=g['hub'], web_in=g['web_in'], spoke_w=g['sw'])


def _walk(n): return [['S'] * n for _ in range(n)]


@REG.piece('wz-clock-gear-l', '큰 황동 톱니(4×4)', 4, 4, _walk(4), 'architecture', SP,
           desc='벽에 선 4×4 큰 황동 톱니. 정면 원판에 위쪽 두께 면이 보이고 이빨이 굵게 읽힌다. 정지.',
           rules='기어실 벽 앞에 놓는다. 회전판 wz-clock-gear-l-spin 과 같은 크기.', tags=['톱니', '황동', '시계탑', '큰'], role='prop')
def _gl(c): _gear(c, 'L', 6.0)


@REG.piece('wz-clock-gear-m', '중간 황동 톱니(3×3)', 3, 3, _walk(3), 'architecture', SP,
           desc='3×3 중간 황동 톱니. 큰 톱니와 맞물리는 크기. 정지.',
           rules='큰·작은 톱니와 가장자리를 맞물려 놓는다.', tags=['톱니', '황동', '시계탑', '중간'], role='prop')
def _gm(c): _gear(c, 'M', 3.0)


@REG.piece('wz-clock-gear-s', '작은 황동 톱니(2×2)', 2, 2, _walk(2), 'architecture', SP,
           desc='2×2 작은 황동 톱니. 정지.', rules='큰 톱니 사이 빈틈이나 축 끝에 놓는다.', tags=['톱니', '황동', '시계탑', '작은'], role='prop')
def _gs(c): _gear(c, 'S', 2.0)


@REG.piece('wz-clock-gear-l-spin', '큰 톱니(회전)', 4, 4, _walk(4), 'architecture', SP,
           desc='큰 황동 톱니가 8프레임으로 돈다. 프레임마다 이빨과 살이 실제로 돌아간다.', rules='정지판과 같은 크기. 8프레임 루프.',
           tags=['톱니', '회전', '시계탑'], role='prop', frames=8, fps=8)
def _gls(c, f): _gear(c, 'L', f * ROT)


@REG.piece('wz-clock-gear-m-spin', '중간 톱니(회전)', 3, 3, _walk(3), 'architecture', SP,
           desc='중간 황동 톱니 회전 8프레임. 큰 톱니와 반대 방향으로 돌리려면 놓을 때 짝을 맞춘다.', rules='8프레임 루프.',
           tags=['톱니', '회전', '시계탑'], role='prop', frames=8, fps=8)
def _gms(c, f): _gear(c, 'M', -f * ROT)


@REG.piece('wz-clock-gear-s-spin', '작은 톱니(회전)', 2, 2, _walk(2), 'architecture', SP,
           desc='작은 황동 톱니 회전 8프레임.', rules='8프레임 루프.', tags=['톱니', '회전', '시계탑'], role='prop', frames=8, fps=8)
def _gss(c, f): _gear(c, 'S', f * ROT)


# ───────────────────────── 축 · 크랭크 ─────────────────────────
@REG.piece('wz-clock-axle-h', '맞물림 축(가로)', 1, 1, ['S'], 'architecture', SP,
           desc='가로로 가로지르는 황동 막대 축. 양끝 쇠 받침과 중간 고리. 톱니 허브 사이를 잇는다.',
           rules='가로로 이어 놓는다(좌우 끝이 이어짐).', tags=['축', '황동', '시계탑'], role='prop')
def _axh(c):
    for x in range(16):
        c.R(x, 6, 1, 5, K(BR, 3))
    c.HL(0, 6, 16, K(BR, 5)); c.HL(0, 7, 16, K(BR, 4)); c.HL(0, 9, 16, K(BR, 2)); c.HL(0, 10, 16, K(BR, 1))
    c.R(6, 4, 4, 9, K(IR, 3)); c.HL(6, 4, 4, K(IR, 4)); c.VL(6, 5, 7, K(IR, 4)); c.VL(9, 5, 8, K(IR, 1)); c.HL(6, 12, 4, K(IR, 1))
    c.P(7, 8, K(IR, 1)); c.P(8, 8, K(IR, 1))
    for x in (1, 14): c.P(x, 8, K(BR, 5))
    c.outline()
    for x in (0, 15):                       # 이어지는 가장자리: 윤곽이 밖으로 새지 않게 막대 위아래 윤곽을 가로로 이음
        c.P(x, 5, K(BR, 0)); c.P(x, 11, K(BR, 0))


@REG.piece('wz-clock-axle-v', '맞물림 축(세로)', 1, 1, ['S'], 'architecture', SP,
           desc='세로 황동 막대 축. 위아래 끝에 쇠 받침.', rules='세로로 이어 놓는다.', tags=['축', '황동', '시계탑'], role='prop')
def _axv(c):
    for y in range(16):
        c.R(5, y, 6, 1, K(BR, 3))
    c.VL(5, 0, 16, K(BR, 5)); c.VL(6, 0, 16, K(BR, 4)); c.VL(9, 0, 16, K(BR, 2)); c.VL(10, 0, 16, K(BR, 1))
    c.R(3, 6, 10, 4, K(IR, 3)); c.HL(3, 6, 10, K(IR, 4)); c.HL(4, 6, 8, K(IR, 4)); c.HL(3, 9, 10, K(IR, 1)); c.VL(12, 7, 3, K(IR, 1))
    c.P(7, 7, K(IR, 1)); c.P(7, 8, K(IR, 1))
    c.outline()
    for y in (0, 15):
        c.P(4, y, K(BR, 0)); c.P(11, y, K(BR, 0))


@REG.piece('wz-clock-crank', '구동 연결부(크랭크 2×1)', 2, 1, [['S', 'S']], 'architecture', SP,
           desc='가로 2칸 크랭크: 왼쪽 축 허브에서 팔이 뻗어 오른쪽 끝에 손잡이 막대가 달렸다.',
           rules='축 끝이나 톱니 허브에 붙인다.', tags=['크랭크', '구동', '시계탑'], role='prop')
def _crank(c):
    c.ellipse(8, 8, 6, 6, K(BR, 3))
    c.ellipse(8, 8, 6, 6, K(BR, 5), fill=False)
    c.ellipse(8.5, 9, 4.5, 4.5, K(BR, 3))
    c.R(5, 5, 6, 6, K(BR, 4)); c.HL(5, 5, 6, K(BR, 5)); c.VL(10, 6, 5, K(BR, 2)); c.HL(5, 10, 6, K(BR, 2))
    c.R(7, 7, 2, 2, K(BR, 0))
    c.R(12, 6, 14, 5, K(BR, 3)); c.HL(12, 6, 14, K(BR, 5)); c.HL(12, 7, 14, K(BR, 4)); c.HL(12, 9, 14, K(BR, 2)); c.HL(12, 10, 14, K(BR, 1))
    c.R(24, 3, 6, 11, K(WD, 3)); c.HL(24, 3, 6, K(WD, 5)); c.VL(24, 4, 9, K(WD, 4)); c.VL(29, 4, 9, K(WD, 1)); c.HL(25, 13, 5, K(WD, 1))
    c.R(22, 5, 2, 7, K(IR, 3)); c.VL(22, 5, 7, K(IR, 4)); c.VL(23, 5, 7, K(IR, 2))
    c.outline()


# ───────────────────────── 석벽 · 기어 개방벽 ─────────────────────────
@REG.piece('wz-clock-wall', '시계탑 석벽(1×4)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='시계탑 안쪽 북벽 1칸. 0행은 벽 윗면, 1~3행은 공용 성벽과 같은 큰 석재 정면. 가로로 이어 칠한다.',
           rules='기어실 북쪽에 가로로 이어 칠한다. 군데군데 기어 개방벽·문·공구 걸이판으로 바꾼다.', tags=['석벽', '시계탑'], role='wall', repeat=True)
def _cwall(c):
    wall_n_base(c)
    c.outline()


def _hole_mask(cx, cy, r):
    m = set()
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                m.add((x, y))
    return m


@REG.piece('wz-clock-wall-gear', '기어 개방벽(2×4)', 2, 4, ['SS', 'SS', 'SS', 'SS'], 'architecture', SP,
           desc='석벽에 둥근 구멍을 뚫어 그 안에서 황동 톱니가 보인다. 구멍 둘레는 밝은 돌 테, 안쪽은 그늘진 어둠.',
           rules='석벽 사이에 끼운다. 뒤에서 도는 기어를 암시할 때.', tags=['기어', '벽', '구멍', '시계탑'], role='wall')
def _wall_gear(c):
    wall_n_base(c, 0, 32)
    cx, cy, r = 16.0, 36.0, 13.0
    M = _hole_mask(cx, cy, r)
    for (x, y) in M:                                     # 구멍 안: 깊은 어둠(night 0~1)
        c.P(x, y, K('night', 0) if (x + 0.5 - cx) + (y + 0.5 - cy) < 6 else K('night', 1))
    # 안쪽 톱니: gear-s 와 같은 이빨 기하(gear_front_mask) — 10이빨·바퀴 테·4살·허브와 축 구멍, 살 사이는 뚫려 어둠이 보인다.
    # 중심을 구멍보다 위에 두어 윗이빨은 구멍 테 뒤로 숨는다.
    gx, gy, rt, rr, ph = 16.0, 33.0, 11.5, 8.5, 9.0
    fm = gear_front_mask(32, 64, gx, gy, rt, rr, 10, ph)
    metal = {}
    for (x, y), kd in fm.items():
        dx, dy = x + 0.5 - gx, y + 0.5 - gy
        d = math.hypot(dx, dy)
        if kd == 't' or d > rr - 2.5: metal[(x, y)] = 'r'; continue
        if d <= 3.2: metal[(x, y)] = 'h'; continue
        a = (math.degrees(math.atan2(dy, dx)) - ph) % 90.0
        a = min(a, 90.0 - a)
        if d * math.sin(math.radians(a)) <= 1.1: metal[(x, y)] = 's'
    for (x, y), kd in metal.items():
        if (x, y) not in M or math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r - 0.6: continue
        tl = (x - 1, y) not in metal or (x, y - 1) not in metal
        br = (x + 1, y) not in metal or (x, y + 1) not in metal
        base = 3 if kd == 's' else 4
        col = K(BR, 5) if tl and not br else K(BR, 2) if br and not tl else K(BR, 3) if tl and br else K(BR, base)
        d = math.hypot(x + 0.5 - gx, y + 0.5 - gy)
        if d <= 1.3: col = K(BR, 0)                      # 축 구멍
        if y < cy - r + 4: col = darker(col)              # 위 테가 드리운 그늘
        c.P(x, y, col)
    for (x, y), kd in metal.items():                     # 바퀴 아래·오른쪽 두께 그늘(뒤 어둠 위)
        for ox, oy in ((0, 1), (1, 1)):
            q = (x + ox, y + oy)
            if q not in metal and q in M and math.hypot(q[0] + 0.5 - cx, q[1] + 0.5 - cy) <= r - 0.6:
                c.P(q[0], q[1], K(BR, 1))
    for (x, y) in M:                                     # 구멍 안쪽 1px 가장자리: 아래·오른쪽은 빛 받은 돌 두께
        d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        if d > r - 1.0:
            n = ((x + 0.5 - cx) + (y + 0.5 - cy)) / (d * 1.414)
            if n > 0.35: c.P(x, y, K(ST, 3))
            elif n < -0.35: c.P(x, y, K('night', 0))
    for (x, y) in dilate(M, 2) - dilate(M, 1):           # 돌 테
        n = ((x + 0.5 - cx) + (y + 0.5 - cy))
        c.P(x, y, K(ST, 5) if n < 0 else K(ST, 4))
    for (x, y) in dilate(M, 1) - M:
        c.P(x, y, K(ST, 1))
    c.outline()


# ───────────────────────── 보 · 발코니 · 바닥 ─────────────────────────
@REG.piece('wz-clock-beam', '노출 오크 보(1×1)', 1, 1, ['C'], 'architecture', SP,
           desc='머리 위를 가로지르는 굵은 오크 들보. 윗면 빛, 앞면 어둠, 가장자리 쇠 못. 좌우로 이어진다.',
           rules='통로·발코니 위에 가로로 이어 칠한다(캐릭터 위로 덮임).', tags=['보', '오크', '시계탑'], role='prop', repeat=True)
def _beam(c):
    c.R(0, 3, 16, 3, K(WD, 5)); c.HL(0, 3, 16, K(WD, 5)); c.HL(0, 4, 16, K(WD, 5)); c.HL(0, 5, 16, K(WD, 4))
    c.R(0, 6, 16, 6, K(WD, 3)); c.HL(0, 6, 16, K(WD, 4)); c.HL(0, 10, 16, K(WD, 2)); c.HL(0, 11, 16, K(WD, 1))
    for x in (3, 11): c.VL(x, 7, 3, K(WD, 2))                        # 결 틈
    for x in (2, 13): c.P(x, 8, K(IR, 4)); c.P(x + 1, 8, K(IR, 2)) if False else None
    c.P(2, 8, K(IR, 4)); c.P(13, 8, K(IR, 4)); c.P(2, 9, K(IR, 2)); c.P(13, 9, K(IR, 2))
    c.HL(0, 2, 16, K(WD, 0)); c.HL(0, 12, 16, K(WD, 0))               # 윗·아랫 윤곽(가로 이음 유지)


def _plank_floor(c, y0, y1, seed):
    """1px 틈 있는 가로 판재. 판마다 이음 위치 다름(x 16 주기)."""
    pw = 4
    for k, y in enumerate(range(y0, y1, pw)):
        tone = (3, 3, 4, 3)[(k + seed) % 4]
        h = min(pw, y1 - y)
        c.R(0, y, 16, h, K(WD, tone))
        c.HL(0, y, 16, K(WD, tone + 1) if tone < 5 else K(WD, 5))
        c.HL(0, y + h - 1, 16, K(WD, 1))
        cut = (5 + k * 7 + seed * 3) % 16
        c.VL(cut, y + 1, h - 2, K(WD, 2))
        c.P((cut + 7) % 16, y + 1, K(WD, 4)) if k % 2 == 0 else None
        if (k + seed) % 3 == 0: c.P((cut + 3) % 16, y + 2, K(WD, 2))


@REG.piece('wz-clock-balcony', '정비 발코니(3×2)', 3, 2, ['FFF', 'SSS'], 'architecture', SP,
           desc='3칸 폭 오크 정비 발코니. 윗줄은 오크 판 바닥(걸을 수 있음), 아랫줄은 앞 난간과 판 두께 면·쇠 받침. 난간 사이로 판 바닥이 보인다.',
           rules='기어실 벽을 따라 높이 둔다. 윗줄 바닥 위로 걷는다. 난간(아랫줄)은 막힌다.', tags=['발코니', '난간', '오크', '시계탑'], role='terrain')
def _balcony(c):
    for tx in range(3):                                 # 위 줄: 바닥 판
        sub = Cv(16, 16); _plank_floor(sub, 0, 16, 0); c.blit(sub, tx * 16, 0)
    for tx in range(3):                                 # 아랫줄: 바닥 판 연장
        sub = Cv(16, 16); _plank_floor(sub, 0, 16, 1); c.blit(sub, tx * 16, 16)
    c.HL(0, 16, 48, K(WD, 1))                           # 위·아래 줄 사이 살짝 어두운 이음
    c.R(0, 17, 48, 1, K(WD, 2))
    c.R(0, 26, 48, 6, K(WD, 3))                         # 판 두께 면(앞 보)
    c.HL(0, 26, 48, K(WD, 5)); c.HL(0, 27, 48, K(WD, 4)); c.HL(0, 30, 48, K(WD, 2)); c.HL(0, 31, 48, K(WD, 1))
    for x in (6, 20, 34, 44): c.R(x, 27, 2, 3, K(IR, 3)); c.P(x, 27, K(IR, 4))
    for px in (0, 22, 45):                              # 난간 기둥
        c.R(px, 18, 3, 10, K(WD, 4)); c.VL(px, 18, 10, K(WD, 5)); c.VL(px + 2, 18, 10, K(WD, 2)); c.HL(px, 17, 3, K(WD, 5))
        c.P(px + 1, 16, K(WD, 5)); c.P(px, 16, K(WD, 4)); c.P(px + 2, 16, K(WD, 3))
    c.R(0, 19, 48, 3, K(WD, 4)); c.HL(0, 19, 48, K(WD, 5)); c.HL(0, 21, 48, K(WD, 2))   # 윗 레일
    c.R(0, 24, 48, 2, K(WD, 3)); c.HL(0, 24, 48, K(WD, 4)); c.HL(0, 25, 48, K(WD, 1))   # 아랫 레일
    for px in (0, 22, 45):
        c.R(px, 18, 3, 10, K(WD, 4)); c.VL(px, 18, 10, K(WD, 5)); c.VL(px + 2, 18, 10, K(WD, 2))
        c.P(px, 17, K(WD, 5)); c.P(px + 1, 17, K(WD, 5)); c.P(px + 2, 17, K(WD, 4))
        c.P(px + 1, 22, K(IR, 4))
    c.R(12, 17, 20, 2, K(WD, 3)) if False else None
    for x in range(8, 44, 7):                           # 가운데 세로 살
        if not (20 <= x <= 25): c.VL(x, 22, 2, K(WD, 2))


@REG.piece('wz-clock-grate', '금속 발판 바닥(1×1)', 1, 1, ['F'], 'architecture', SP,
           desc='어두운 무쇠빛 철판 바닥. 16×8 판을 반 장씩 엇갈려 깔고, 판 사이 낮은 대비 이음과 드문 닳은 자국만 있다. 이음새 없이 반복.',
           rules='기어실 바닥 전체에 깐다. 밝은 석벽보다 훨씬 어두워 벽과 바닥이 갈린다. 리벳 철판 통로(floor-plate)로 동선을 낸다.',
           tags=['금속', '철판', '바닥', '시계탑'], role='terrain', repeat=True)
def _grate(c):
    c.R(0, 0, 16, 16, K(ST, 1))                          # 바탕: 따뜻한 짙은 회색(푸른 기 없음)
    c.HL(0, 7, 16, K(ST, 0)); c.HL(0, 15, 16, K(ST, 0))  # 판 이음(가로)
    c.VL(11, 0, 7, K(ST, 0)); c.VL(3, 8, 7, K(ST, 0))    # 판 이음(세로, 반 장 엇갈림)
    for x, y, w in ((5, 3, 3), (13, 11, 2), (7, 12, 2)):  # 드문 닳은 자국
        for i in range(w): c.P((x + i) % 16, y, K(ST, 2))


@REG.piece('wz-clock-floor-plate', '리벳 철판 통로(1×1)', 1, 1, ['F'], 'architecture', SP,
           desc='한 칸짜리 두꺼운 철판 디딤판. 네 귀에 리벳, 왼위 모서리에 빛, 오른아래 이음 그늘. 바닥 철판보다 한 단 밝다.',
           rules='철판 바닥 위에 줄지어 깔아 정비 동선을 낸다(가로·세로 반복).', tags=['금속', '리벳', '통로', '바닥', '시계탑'], role='terrain', repeat=True)
def _floor_plate(c):
    c.R(0, 0, 16, 16, K(ST, 2))
    c.HL(0, 0, 15, K(ST, 3)); c.VL(0, 0, 15, K(ST, 3))   # 빛 받는 모서리
    c.HL(0, 15, 16, K(ST, 1)); c.VL(15, 0, 16, K(ST, 1)) # 이음 그늘
    for x, y in ((2, 2), (12, 2), (2, 12), (12, 12)):
        c.P(x, y, K(ST, 4)); c.P(x + 1, y + 1, K(ST, 1))
    for x, y, w in ((5, 6, 3), (8, 9, 3)):                # 닳은 디딤 자국
        c.HL(x, y, w, K(ST, 3))


@REG.piece('wz-clock-walkway', '오크 정비 통로(1×1)', 1, 1, ['F'], 'architecture', SP,
           desc='닳은 오크 판재 통로. 판마다 색 차이와 못 자국, 틈. 이음새 없이 반복.', rules='발코니와 기어 사이 통로에 깐다.',
           tags=['오크', '통로', '바닥', '시계탑'], role='terrain', repeat=True)
def _walkway(c):
    _plank_floor(c, 0, 16, 2)
    for (x, y) in ((1, 1), (14, 5), (3, 9), (12, 13)): c.P(x, y + 1, K(IR, 3)) if False else None
    for (x, y) in ((2, 2), (14, 6), (1, 10), (13, 14)): c.P(x, y, K(WD, 1))


# ───────────────────────── 난간 ─────────────────────────
def _rail_h(c, end):
    xr = 13 if end else 16
    c.R(0, 4, xr, 3, K(WD, 4)); c.HL(0, 4, xr, K(WD, 5)); c.HL(0, 6, xr, K(WD, 2))       # 윗 레일
    c.R(0, 9, xr, 2, K(WD, 3)); c.HL(0, 9, xr, K(WD, 4)); c.HL(0, 10, xr, K(WD, 1))      # 아랫 레일
    px = 11 if end else 6
    c.R(px, 2, 4, 14, K(WD, 4)); c.VL(px, 2, 14, K(WD, 5)); c.VL(px + 3, 2, 14, K(WD, 2)); c.HL(px, 2, 4, K(WD, 5)); c.HL(px, 15, 4, K(WD, 1))
    if end:
        c.R(px - 1, 0, 6, 2, K(WD, 5)); c.HL(px - 1, 0, 6, K(WD, 5)); c.HL(px - 1, 1, 6, K(WD, 3)); c.P(px + 4, 1, K(WD, 2))
    else:
        c.P(px + 1, 6, K(IR, 4)); c.P(px + 1, 9, K(IR, 4))
        for x in (0, 15): pass
    c.R(0, 13, 16 if not end else 15, 2, K(WD, 2)) if False else None
    c.outline()


@REG.piece('wz-clock-rail', '난간(가로 1×1)', 1, 1, ['S'], 'architecture', SP,
           desc='오크 난간 가로 한 칸: 윗·아랫 레일을 가로로 잇고 가운데 기둥에 쇠 못. 좌우로 이어진다.', rules='발코니·통로 가장자리에 가로로 이어 놓는다.',
           tags=['난간', '오크', '시계탑'], role='fence')
def _rail(c): _rail_h(c, False)


@REG.piece('wz-clock-rail-end', '난간(끝 1×1)', 1, 1, ['S'], 'architecture', SP,
           desc='난간 끝 기둥: 왼쪽에서 레일이 오고 오른쪽 끝에 머리장식 달린 굵은 기둥이 선다.', rules='난간 줄의 오른쪽 끝에 놓는다.',
           tags=['난간', '끝', '시계탑'], role='fence')
def _rail_end(c): _rail_h(c, True)


# ───────────────────────── 계단 ─────────────────────────
@REG.piece('wz-clock-stair', '정비 계단(2×2)', 2, 2, ['FF', 'FF'], 'architecture', SP,
           desc='정면으로 오르는 직선 오크 계단 2×2. 디딤판 8px 네 단, 양옆 석재 받침. 위로.', rules='발코니 앞이나 통로 끝에 붙인다.',
           tags=['계단', '오크', '시계탑'], role='terrain')
def _stair(c):
    sw = 3
    c.R(0, 0, 32, 32, K(ST, 1))
    for i in range(4):
        y0 = i * 8
        for x in range(sw, 32 - sw):
            c.P(x, y0, K(WD, 5)); c.P(x, y0 + 1, K(WD, 5)); c.P(x, y0 + 2, K(WD, 4)); c.P(x, y0 + 3, K(WD, 4))
            for y in range(y0 + 4, y0 + 8):
                c.P(x, y, K(WD, 3) if y < y0 + 7 else K(WD, 1))
            c.P(x, y0 + 4, K(WD, 2))
        for x in (10, 20): c.P(x, y0 + 2, K(WD, 3))
        for x in (5, 26): c.P(x, y0 + 5, K(IR, 4))
        for y in range(y0, y0 + 8): c.P(sw, y, K(WD, 2) if y > y0 + 3 else K(WD, 4)); c.P(31 - sw, y, K(WD, 1))
    for y in range(32):
        c.P(sw - 1, y, K(ST, 1)); c.P(32 - sw, y, K(ST, 1))
    c.R(0, 0, sw - 1, 32, K(ST, 4)); c.R(32 - sw + 1, 0, sw - 1, 32, K(ST, 2))
    for y in range(0, 32, 8): c.HL(0, y + 7, sw - 1, K(ST, 3)); c.HL(32 - sw + 1, y + 7, sw - 1, K(ST, 1))
    c.VL(0, 0, 32, K(ST, 1)); c.VL(31, 0, 32, K(ST, 1))


# ───────────────────────── 문 3상태 ─────────────────────────
def door_frame(c):
    wall_n_base(c)
    M = arch_mask(8, 24, 12, 63, 7)            # 개구부 24~63 = 40px
    for (x, y) in dilate(M, 2) - dilate(M, 1):
        c.P(x, y, K(ST, 5) if (x + y) % 4 else K(ST, 4))
    for (x, y) in dilate(M, 1) - M:
        c.P(x, y, K(ST, 2))
    return M


COG7 = ('..#.#..',
        '.#####.',
        '#######',
        '.##o##.',
        '#######',
        '.#####.',
        '..#.#..')


def cog_emblem(c, x0, y0):
    """문짝 위 황동 톱니 문장: 7×7 손 도트(이빨 8개 1px 돌출, 가운데 1px 구멍) + BR0 윤곽."""
    S = {(x, y) for y, row in enumerate(COG7) for x, ch in enumerate(row) if ch != '.'}
    for (x, y) in S:                                           # 윤곽(바깥 1px, 대각 제외)
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + ox, y + oy) not in S: c.P(x0 + x + ox, y0 + y + oy, K(BR, 0))
    for (x, y) in S:
        tl = (x - 1, y) not in S or (x, y - 1) not in S
        br = (x + 1, y) not in S or (x, y + 1) not in S
        col = K(BR, 5) if tl and not br else K(BR, 2) if br and not tl else K(BR, 3) if tl and br else K(BR, 4)
        c.P(x0 + x, y0 + y, col)
    c.P(x0 + 3, y0 + 3, K(BR, 0))                                # 축 구멍
    c.P(x0 + 3, y0 + 2, K(BR, 2)); c.P(x0 + 2, y0 + 3, K(BR, 2))  # 구멍 위·왼 그늘
    c.P(x0 + 4, y0 + 3, K(BR, 5)); c.P(x0 + 3, y0 + 4, K(BR, 5))  # 구멍 아래·오른 빛


def oak_leaf(c, M):
    for (x, y) in M:
        t = (x - 2) % 3
        col = K(WD, 4) if t == 0 else K(WD, 3) if t == 1 else K(WD, 2)
        if x == 2: col = K(WD, 5)
        if x == 13: col = K(WD, 2)
        if hsh(x, y, 4) < 0.04: col = K(WD, 2)
        c.P(x, y, col)
    for by in (28, 54):                                        # 철 띠
        for x in range(2, 14):
            if (x, by) in M:
                c.P(x, by, K(IR, 4)); c.P(x, by + 1, K(IR, 3)); c.P(x, by + 2, K(IR, 1))
        c.P(4, by, K(IR, 2)); c.P(9, by, K(IR, 2))
    for (x, y) in M:
        if (x, y - 1) not in M: c.P(x, y, K(WD, 2))
    cog_emblem(c, 5, 33)
    c.R(11, 47, 2, 3, K(BR, 4)); c.P(11, 47, K(BR, 5)); c.P(12, 49, K(BR, 2))     # 손잡이


@REG.piece('wz-clock-door-closed', '시계탑 문(닫힘)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='오크 판문 1×4, 첨두 석재 문틀. 문짝에 철 띠 둘과 황동 톱니 문장. 닫힘.', rules='북벽에 끼운다. 상태 묶음 clock-door.',
           tags=['문', '시계탑'], role='wall', states='clock-door')
def _door_c(c):
    M = door_frame(c); oak_leaf(c, M)


@REG.piece('wz-clock-door-open', '시계탑 문(열림)', 1, 4, ['S', 'C', 'C', 'C'], 'architecture', SP,
           desc='문이 안쪽으로 열려 어두운 계단통이 보인다. 통행.', rules='열린 칸은 통행. 상태 묶음 clock-door.', tags=['문', '시계탑'],
           role='wall', states='clock-door')
def _door_o(c):
    M = door_frame(c)
    for (x, y) in M:
        c.P(x, y, K('night', 0) if y < 32 else K('night', 1))
    for x in range(6, 11):                                       # 안쪽 층계 희미한 빛
        for y in range(44, 58):
            if (x, y) in M and (y % 4) in (0, 1): c.P(x, y, K('night', 2))
    for (x, y) in M:
        if y >= 58: c.P(x, y, K(ST, 3))
        if y >= 62: c.P(x, y, K(ST, 4))
    for y in range(24, 63):                                      # 열린 문짝(옆면)
        if (3, y) in M or (2, y) in M:
            c.P(2, y, K(WD, 4)); c.P(3, y, K(WD, 3)); c.P(4, y, K(WD, 2)) if (4, y) in M else None
    c.R(2, 30, 3, 2, K(IR, 3)); c.R(2, 52, 3, 2, K(IR, 3))


@REG.piece('wz-clock-door-locked', '시계탑 문(잠김)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', SP,
           desc='닫힌 문에 쇠 가로막대와 황동 자물쇠. 잠김.', rules='상태 묶음 clock-door.', tags=['문', '잠김', '시계탑'], role='wall', states='clock-door')
def _door_l(c):
    M = door_frame(c); oak_leaf(c, M)
    c.R(0, 42, 16, 3, K(IR, 3)); c.HL(0, 42, 16, K(IR, 4)); c.HL(0, 44, 16, K(IR, 1))
    for x in (2, 13): c.P(x, 43, K(IR, 4))
    c.R(6, 46, 4, 5, K(BR, 3)); c.HL(6, 46, 4, K(BR, 5)); c.VL(9, 47, 4, K(BR, 1)); c.P(7, 48, K(BR, 0))
    c.R(7, 44, 2, 2, K(IR, 2))


# ───────────────────────── 기름 얼룩 f ─────────────────────────
def _blob(c, pts, rim=True):
    """pts: 칸 집합. 납작한 기름 막: 몸은 거의 검은 남색(night 0), 가장자리만 한 단 밝게(night 1). 입체 명암 없음."""
    S = set(pts)
    for (x, y) in S:
        edge = any((x + ox, y + oy) not in S for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        c.P(x, y, K('night', 1) if (edge and rim) else K('night', 0))
    return S


@REG.piece('wz-clock-oil-a', '기름 얼룩(웅덩이)', 1, 1, ['f'], 'surfaces', SP,
           desc='바닥에 번진 둥근 기름 웅덩이. 짙은 갈색 몸에 위왼쪽 번들한 반사점과 가장자리 방울 두엇. 바닥 위에 덧칠.',
           rules='기계·윤활통 주변 바닥에 덧칠한다. 걸어 지난다.', tags=['기름', '얼룩', '시계탑'], role='terrain')
def _oil_a(c):
    rows = {5: (5, 9), 6: (3, 12), 7: (2, 13), 8: (1, 14), 9: (2, 14), 10: (3, 12), 11: (5, 10)}   # 넓고 얇게 퍼진 불규칙 웅덩이
    pts = {(x, y) for y, (x0, x1) in rows.items() for x in range(x0, x1 + 1)}
    pts |= {(11, 5), (12, 5), (13, 6), (1, 9), (11, 11), (12, 12), (13, 12), (6, 12), (7, 12)}
    pts -= {(14, 9), (2, 10)}
    _blob(c, pts)
    pts2 = {(0, 12), (1, 12), (14, 4)}                                                       # 튄 방울
    for q in pts2: c.P(q[0], q[1], K('night', 1))
    c.HL(5, 7, 2, K('glow', 3)); c.P(7, 7, K(BR, 4))                                         # 기름 막 무지개 반사
    c.P(9, 9, K('glow', 3)); c.P(10, 9, K(BR, 4))
    c.P(12, 8, K('water', 3))


@REG.piece('wz-clock-oil-b', '기름 얼룩(흘린 줄기)', 1, 1, ['f'], 'surfaces', SP,
           desc='기울어 흐른 기름 줄기: 위쪽이 굵고 아래로 가늘어지며 끝에 방울. 바닥 위에 덧칠.', rules='기어 아래·기름 통 옆에 줄기로 덧칠한다.',
           tags=['기름', '얼룩', '시계탑'], role='terrain')
def _oil_b(c):
    pts = set()
    for y in range(0, 12):                                    # 위(흘러나온 쪽)는 넓고 아래로 가늘게
        w = 7 - (y * 5) // 12
        cx = 6 + (y * 2) // 11
        for x in range(cx - w // 2, cx - w // 2 + w):
            pts.add((x, y))
    pts -= {(3, 0), (8, 0)}
    pts |= {(9, 2), (2, 1)}
    for y in range(11, 16):                                   # 끝 방울 웅덩이
        for x in range(5, 12):
            if ((x - 7.8) / 3.2) ** 2 + ((y - 13.2) / 2.1) ** 2 <= 1: pts.add((x, y))
    _blob(c, pts)
    for y in range(1, 8): c.P(5 + (y * 2) // 11, y, K('glow', 3) if y < 5 else K('water', 3))   # 1px 반사선
    c.P(8, 13, K(BR, 4)); c.P(9, 13, K('glow', 3))


# ───────────────────────── 소품 ─────────────────────────
@REG.piece('wz-clock-oilcan', '윤활통(1×1)', 1, 1, ['S'], 'furniture', SP,
           desc='긴 주둥이 달린 황동 기름통. 둥근 몸통 위에 뚜껑 면이 보이고 왼쪽 손잡이 고리, 오른쪽으로 비스듬히 올라가는 주둥이.',
           rules='기계·바닥 가장자리에 둔다.', tags=['윤활통', '황동', '시계탑'], role='prop')
def _oilcan(c):
    # 원통 깡통(폭 10): 윗면 타원 3px, 꼭대기 가운데서 1px 주둥이가 오른쪽 위로 길게, 왼쪽에 고리 손잡이
    for y in range(7, 15):                                    # 몸통 x3..12
        c.HL(4, y, 8, K(BR, 3)); c.P(3, y, K(BR, 2)); c.P(12, y, K(BR, 1))
        c.P(5, y, K(BR, 5)); c.P(10, y, K(BR, 2)); c.P(11, y, K(BR, 2))          # 좁은 세로 1px 반사
    c.HL(4, 15, 8, K(BR, 1)); c.HL(4, 14, 8, K(BR, 2)); c.P(5, 14, K(BR, 4))   # 둥근 밑
    c.HL(3, 11, 10, K(BR, 2)); c.HL(4, 12, 1, K(BR, 3))       # 몸통 테 띠
    c.HL(5, 5, 6, K(BR, 4)); c.HL(4, 6, 8, K(BR, 4)); c.HL(4, 7, 8, K(BR, 3)) # 윗면 타원(5~7)
    c.P(3, 6, K(BR, 3)); c.P(12, 6, K(BR, 2)); c.HL(5, 5, 2, K(BR, 5))
    c.R(7, 5, 2, 2, K(BR, 2)); c.P(7, 5, K(BR, 1))            # 주둥이 뿌리(꼭지)
    c.P(8, 4, K(BR, 3)); c.P(9, 3, K(BR, 4)); c.P(10, 2, K(BR, 4)); c.P(11, 1, K(BR, 4)); c.P(12, 0, K(BR, 5))   # 가는 주둥이
    c.P(9, 4, K(BR, 1)); c.P(10, 3, K(BR, 2)); c.P(11, 2, K(BR, 2)); c.P(12, 1, K(BR, 2))
    for (x, y) in ((2, 7), (1, 7), (0, 8), (0, 9), (0, 10), (1, 11), (2, 11)): c.P(x, y, K(BR, 4))   # 고리 손잡이(왼쪽)
    c.P(1, 7, K(BR, 5)); c.P(0, 10, K(BR, 2)); c.P(1, 11, K(BR, 2)); c.P(2, 11, K(BR, 2))
    c.outline()


@REG.piece('wz-clock-toolchest', '정비 공구 상자(1×1)', 1, 1, ['S'], 'furniture', SP,
           desc='오크 공구 상자. 윗면이 보이고 앞면에 쇠 모서리 보강대와 쇠 걸쇠, 뚜껑 틈으로 렌치 자루가 삐져나온다.',
           rules='발코니·기계 곁에 둔다.', tags=['상자', '공구', '시계탑'], role='prop')
def _toolchest(c):
    c.R(1, 4, 14, 3, K(WD, 5)); c.HL(1, 6, 14, K(WD, 4))                                      # 윗면(4~6)
    c.R(1, 7, 14, 8, K(WD, 3)); c.VL(1, 7, 8, K(WD, 4)); c.VL(14, 7, 8, K(WD, 2)); c.HL(1, 14, 14, K(WD, 1))
    c.HL(1, 7, 14, K(WD, 2))
    for y0 in (8, 11):                                                                          # 서랍 2단
        c.R(2, y0, 12, 3, K(WD, 3)); c.HL(2, y0, 12, K(WD, 4)); c.HL(2, y0 + 2, 12, K(WD, 2))
        c.R(7, y0 + 1, 2, 1, K(IR, 4)); c.P(7, y0 + 1, K(IR, 5)); c.P(8, y0 + 1, K(IR, 3))       # 작은 쇠 손잡이
    c.HL(2, 13, 12, K(WD, 2))
    for x in (2, 13):                                                                           # 위 가로 손잡이 막대(기둥 + 막대)
        c.VL(x, 1, 4, K(IR, 3)); c.P(x, 1, K(IR, 4))
    c.HL(2, 0, 12, K(IR, 4)); c.HL(3, 0, 3, K(IR, 5)); c.HL(3, 1, 10, K(IR, 1))
    c.R(3, 5, 1, 1, K(IR, 3)); c.R(12, 5, 1, 1, K(IR, 3))
    c.outline()
    for x in range(3, 13): c.P(x, 2, (0, 0, 0, 0)); c.P(x, 3, (0, 0, 0, 0))                    # 막대 밑은 비운다


@REG.piece('wz-clock-stool', '작업 발판(1×1)', 1, 1, ['S'], 'furniture', SP,
           desc='둥근 오크 앉는 판에 세 다리가 벌어진 낮은 작업 의자. 윗면 빛, 옆면 어둠.', rules='기계 곁에 놓는다.',
           tags=['의자', '발판', '시계탑'], role='prop')
def _stool(c):
    for x0, x1 in ((3, 5), (11, 13)):                            # 다리
        c.R(x0, 8, 2, 7, K(WD, 3)); c.VL(x0, 8, 7, K(WD, 4)); c.VL(x1 - 1, 9, 6, K(WD, 2))
    c.R(7, 9, 2, 6, K(WD, 2)); c.VL(7, 9, 6, K(WD, 3)); c.HL(3, 12, 10, K(WD, 1)) if False else None
    c.HL(4, 12, 8, K(WD, 2))
    c.ellipse(7.5, 6.5, 6.5, 3.6, K(WD, 3)); c.ellipse(7.5, 5.5, 6.5, 3.3, K(WD, 5)); c.ellipse(7.5, 5.5, 4.6, 2.2, K(WD, 4))
    c.HL(4, 4, 4, K(WD, 5)); c.P(11, 6, K(WD, 3)); c.P(8, 5, K(WD, 3))
    c.outline()


def _tool_outline(c, S, tone=1):
    """공구 S 를 판과 분리: 왼위 빛이므로 오른쪽·아래 둘레에 IR 0~1 윤곽(판 위 그림자), 왼·위 둘레는 판보다 한 단 밝은 오크 테."""
    for (x, y) in S:
        for ox, oy in ((1, 0), (0, 1), (1, 1)):
            q = (x + ox, y + oy)
            if q not in S: c.P(q[0], q[1], K(IR, tone))
    for (x, y) in S:
        for ox, oy in ((-1, 0), (0, -1)):
            q = (x + ox, y + oy)
            if q not in S and c.get(*q) == K(WD, 3): c.P(q[0], q[1], K(WD, 2))


@REG.piece('wz-clock-toolrack', '공구 걸이판(1×2)', 1, 2, ['S', 'S'], 'furniture', SP,
           desc='석벽에 붙인 오크 걸이판 1×2. 위에 렌치·망치·집게가 걸려 있고 아래 갈고리줄에 톱니바퀴 한 개.', rules='석벽(wz-clock-wall) 위에 얹는다.',
           tags=['공구', '벽', '시계탑'], role='wall')
def _toolrack(c):
    wall_face(c, 0, 16, 0, (6, 7, 6, 7, 6), CUTS)
    c.R(1, 3, 14, 24, K(WD, 3)); c.VL(1, 3, 24, K(WD, 5)); c.VL(14, 3, 24, K(WD, 1)); c.HL(1, 3, 14, K(WD, 5)); c.HL(1, 26, 14, K(WD, 1))
    for y in (9, 17): c.HL(2, y, 12, K(WD, 2))                                     # 판자 이음
    for (x, y) in ((2, 4), (13, 4), (2, 25), (13, 25)): c.P(x, y, K(IR, 4))       # 못
    # 렌치(x2..5): 위는 고리 끝, 아래 끝에 2px 벌린 U 턱. 자루 1px
    W = {(3, y) for y in range(8, 13)} | {(2, 5), (3, 5), (4, 5), (2, 6), (4, 6), (2, 7), (3, 7), (4, 7)} \
        | {(2, 13), (3, 13), (4, 13), (5, 13), (2, 14), (5, 14), (2, 15), (5, 15)}
    _tool_outline(c, W)
    for (x, y) in W: c.P(x, y, K(IR, 4))
    c.P(3, 6, K(IR, 0)); c.P(2, 5, K(IR, 5)); c.P(4, 7, K(IR, 3))                  # 위 고리 끝(걸이 구멍)
    c.P(2, 13, K(IR, 5)); c.P(2, 14, K(IR, 5)); c.P(5, 15, K(IR, 3))               # 아래 U 턱
    # 망치(x6..9): 굵은 쇠 머리 4×2, 오크 자루 2px
    Hm = {(x, y) for y in (5, 6) for x in range(6, 10)} | {(x, y) for y in range(7, 16) for x in (7, 8)}
    _tool_outline(c, Hm)
    for (x, y) in Hm:
        if y <= 6: c.P(x, y, K(IR, 5) if y == 5 else K(IR, 3))
        else: c.P(x, y, K(WD, 5) if x == 7 else K(WD, 4))
    c.P(9, 6, K(IR, 2)); c.P(8, 15, K(WD, 3))
    # 집게(x10..13): 위 턱이 모이고 축 아래로 두 다리가 V 로 벌어진다
    Pl = {(11, 5), (12, 5), (11, 6), (12, 6), (11, 7), (12, 7)}
    legs = ((11, 12), (11, 12), (10, 13), (10, 13), (10, 13), (10, 13), (10, 13))
    for y, (lx, rx) in zip(range(8, 15), legs):
        Pl.add((lx, y)); Pl.add((rx, y))
    _tool_outline(c, Pl)
    for (x, y) in Pl: c.P(x, y, K(IR, 4) if x <= 11 else K(IR, 3))
    c.P(11, 5, K(IR, 5)); c.P(11, 8, K(BR, 5)); c.P(12, 8, K(BR, 3))                # 축 리벳
    for y in (12, 13, 14): c.P(10, y, K('red', 3)); c.P(13, y, K('red', 2))          # 손잡이 덧씌움
    gx, gy = 5, 19                                     # 8×8 칸 안: 지름 6 원 + 1px 이빨 6개(위는 갈고리 자리)
    GR = ('..##..',
          '.####.',
          '##..##',
          '##..##',
          '.####.',
          '..##..')
    S = {(gx + 1 + x, gy + 1 + y) for y, row in enumerate(GR) for x, ch in enumerate(row) if ch == '#'}
    S |= {(gx + 3, gy + 7), (gx + 4, gy + 7)}                                          # 아래 이빨
    S |= {(gx, gy + 2), (gx, gy + 5), (gx + 7, gy + 2), (gx + 7, gy + 5)}             # 좌우 비스듬한 이빨 4
    S |= {(gx + 3, gy), (gx + 4, gy)}                                                  # 위 이빨(갈고리에 걸림)
    for (x, y) in S:
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):                              # 황동 톱니는 갈색 윤곽(판과 구분, 덜 날카롭게)
            q = (x + ox, y + oy)
            if q not in S and not (gx + 1 < q[0] < gx + 6 and gy + 1 < q[1] < gy + 6): c.P(q[0], q[1], K(BR, 0))
    c.R(gx + 3, gy + 3, 2, 2, K(BR, 0)); c.P(gx + 4, gy + 4, K(BR, 1))               # 가운데 구멍
    for (x, y) in S:
        tl = (x - 1, y) not in S or (x, y - 1) not in S
        br = (x + 1, y) not in S or (x, y + 1) not in S
        c.P(x, y, K(BR, 5) if tl and not br else K(BR, 2) if br and not tl else K(BR, 4))
    c.VL(gx + 3, gy - 2, 2, K(IR, 4)); c.P(gx + 4, gy - 2, K(IR, 3))                  # 갈고리
    c.outline()


# ───────────────────────── 큰 시계 문자판 뒷면 ─────────────────────────
GLYPH = {'I': ('#', '#', '#', '#', '#'),
         'X': ('#.#', '#.#', '.#.', '#.#', '#.#'),
         'V': ('#.#', '#.#', '#.#', '#.#', '.#.')}


def _numeral(c, cx, y0, text, col):
    """거울상 로마 숫자: 글자 순서를 뒤집고 각 글리프도 좌우 반전(I·X·V 는 대칭이라 순서만)."""
    text = text[::-1]
    widths = [len(GLYPH[ch][0]) for ch in text]
    w = sum(widths) + len(text) - 1
    x = int(round(cx - w / 2))
    for ch, gw in zip(text, widths):
        for yy, row in enumerate(GLYPH[ch]):
            for xx, v in enumerate(row[::-1]):
                if v == '#': c.P(x + xx, y0 + yy, col)
        x += gw + 1


def _dial_back(c):
    wall_n_base(c, 0, 64)                                         # 배경: wz-clock-wall 과 같은 석벽(윗면+큰 블록+굽돌)
    cx, cy = 32.0, 32.0
    for y in range(64):
        for x in range(64):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            nrm = ((x + 0.5 - cx) + (y + 0.5 - cy)) / max(d * 1.414, 0.5)
            if 30.5 >= d > 29.5:                                  # 돌 테 그늘
                c.P(x, y, K(ST, 1))
            elif 29.5 >= d > 26.5:                                # 황동 테
                c.P(x, y, K(BR, 5) if nrm < -0.5 else K(BR, 4) if nrm < 0.0 else K(BR, 3) if nrm < 0.5 else K(BR, 2))
            elif 26.5 >= d > 25.5:
                c.P(x, y, K(BR, 1))
            elif d <= 25.5:                                       # 유리 뒤 문자판: 3단(가장자리 한 단 어둡게, 왼위는 테 그림자)
                col = K('linen', 2)
                if d > 22.5: col = K('linen', 1)
                if d > 23.5 and nrm < -0.3: col = K('linen', 0)
                c.P(x, y, col)
    for h in range(12):                                           # 눈금(뒤에서 비쳐 iron 2). 3·6·9·12 자리는 숫자가 대신한다
        if h % 3 == 0: continue
        a = math.radians(h * 30)
        ux, uy = math.sin(a), -math.cos(a)
        for t in range(40, 45):
            r = t / 2
            c.P(int(cx + ux * r), int(cy + uy * r), K(IR, 2))
    ink = K(IR, 1)
    _numeral(c, 32, 10, 'XII', ink)                               # 위: XII → 'IIX'
    _numeral(c, 32, 50, 'VI', ink)                                # 아래: VI → 'IV'
    _numeral(c, 13, 30, 'III', ink)                               # 3시는 뒤에서 보면 왼쪽
    _numeral(c, 51, 30, 'IX', ink)                                # 9시는 오른쪽: IX → 'XI'

    def hand(deg, ln, wd, tone):
        a = math.radians(deg); ux, uy = math.sin(a), -math.cos(a)
        for t in range(0, int(ln * 2)):
            r = t / 2
            for w in range(-(wd // 2), wd // 2 + 1):
                c.P(int(cx + ux * r - uy * w), int(cy + uy * r + ux * w), K(IR, tone))
    hand(55, 11, 3, 1)                                            # 시침(거울상: 10시10분 → 1시50분)
    hand(300, 18, 1, 0)                                           # 분침
    hand(180, 5, 1, 0)                                            # 꼬리
    c.ellipse(32, 32, 3.2, 3.2, K(BR, 3)); c.ellipse(31.5, 31.5, 1.6, 1.6, K(BR, 5)); c.P(33, 33, K(BR, 1))
    for (x0, y0, n) in ((15, 21, 5), (19, 15, 4), (40, 46, 3)):  # 유리 반사: 왼위→오른아래로 놓인 짧은 1px 빗금
        for k in range(n):
            if c.get(x0 + k, y0 - k) in (K('linen', 2), K('linen', 1)): c.P(x0 + k, y0 - k, K('linen', 4))


@REG.piece('wz-clock-dial-back', '큰 시계 문자판 뒷면(4×4)', 4, 4, ['SSSS'] * 4, 'architecture', SP,
           desc='유리 뒤에서 본 큰 시계 문자판. 석벽 틀 안에 황동 테 둥근 문자판, 눈금은 좌우가 뒤집힌 거울상, 바늘도 반대쪽을 가리킨다. 반투명 아님.',
           rules='기어실 북벽 높이에 4×4 한 장으로 얹는다.', tags=['시계', '문자판', '시계탑'], role='wall')
def _dial(c):
    _dial_back(c)


# ───────────────────────── 예제 ─────────────────────────
def _place_gears():
    pl = []
    for x in range(14): pl.append(('wz-clock-wall', x, 0))
    pl += [('wz-clock-wall-gear', 1, 0), ('wz-clock-wall-gear', 10, 0), ('wz-clock-dial-back', 5, 0),
           ('wz-clock-door-closed', 13, 0) if False else ('wz-clock-door-locked', 13, 0), ('wz-clock-toolrack', 3, 1)]
    pl += [('wz-clock-floor-plate', x, 11) for x in range(14)] + [('wz-clock-floor-plate', 13, y) for y in range(4, 6)]
    pl += [('wz-clock-walkway', x, 5) for x in range(7, 13)] + [('wz-clock-walkway', x, 4) for x in range(7, 13)]
    pl += [('wz-clock-oil-a', 5, 9), ('wz-clock-oil-b', 7, 10), ('wz-clock-oil-a', 11, 11)]
    pl += [('wz-clock-gear-l-spin', 0, 5), ('wz-clock-gear-m-spin', 3, 7), ('wz-clock-gear-s-spin', 5, 6)]
    pl += [('wz-clock-axle-h', 6, 8), ('wz-clock-axle-v', 2, 9), ('wz-clock-crank', 4, 10)] if False else []
    pl += [('wz-clock-rail', 7, 6), ('wz-clock-rail-end', 8, 6), ('wz-clock-balcony', 9, 6), ('wz-clock-stair', 12, 6)]
    pl += [('wz-clock-oilcan', 9, 10), ('wz-clock-toolchest', 11, 10), ('wz-clock-stool', 13, 10)]
    pl += [('wz-clock-beam', x, 4) for x in range(0, 7)]
    return pl


REG.example('wz-clock-example-gears', '시계탑 기어실 예제', SP, 14, 12, 'wz-clock-grate', _place_gears(),
            desc='기어실: 북벽에 큰 시계 문자판 뒷면·기어 개방벽·공구 걸이판·잠긴 문. 바닥은 어두운 철판·아래쪽 리벳 철판 통로, 왼쪽에 맞물려 도는 황동 톱니 셋, 오른쪽에 오크 통로·난간·발코니·계단과 공구 소품.')


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
