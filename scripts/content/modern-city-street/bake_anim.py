#!/usr/bin/env python3
"""modern_city 움직이는 거리 소품(신호등·보행자 신호·철도 건널목·점멸 화살표판)과 택시 승강장을 번들 시트 끝에 덧붙여 굽는다 — 덧붙이기 전용, 앞 번호 불변.

  python3 scripts/content/modern-city-street/bake_anim.py [--dry]        # 굽기(시트·정의·핀)
  python3 scripts/content/modern-city-street/bake_anim.py board OUT.png  # 키트 전 프레임 QA 판(3배)

움직임은 타일셋 animationStrips(baseTile·frames·fps, 프레임 = 연속 칸)다. 키트 칸 가운데 프레임마다 그림이 바뀌는 칸만 스트립(연속 칸 N개)을
받고, 바뀌지 않는 칸은 낱칸 하나(또는 기존 칸 번호 그대로)다. 같은 그림이 되풀이되는 프레임도 스트립 안에서는 제 칸을 따로 갖는다 —
그래서 이 칸들은 내용 해시가 아니라 `anim:<키트>:<x>,<y>:<프레임>` 이름으로 pins.json 에 번호를 고정한다.

신호 주기는 project/mapTransit.ts 의 TRANSIT_SIGNAL(초록 7초 · 황색/전적색 1.5초, 한 바퀴 17초)과 같다: 2fps × 34프레임.
  - 차량 신호 ew(시뮬레이션 시계 기준): 초록 0~7초 → 황색 7~8.5초 → 빨강 8.5~17초.  ns: 빨강 0~8.5초 → 초록 8.5~15.5초 → 황색 15.5~17초.
  - 보행자 신호 ew(동서 차량 초록과 같이 건넌다 = 남북 길을 가로지르는 횡단보도): 보행 0~5초 → 점멸 5~7초 → 정지 7~17초.  ns 는 8.5초 늦게.
타일 움직임은 맵을 그릴 때 0프레임에서, 시계는 미리 돌리기 90초 뒤에서 시작하므로 0프레임 = 시계 5초(SIG_T0)로 굽는다.

순서: bake_tileset.py(거리) → bake_interior.apply() → bake_green.apply() → 이 apply(). bake_tileset.py main 이 이어 부른다.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import numpy as np                                  # noqa: E402
from PIL import Image                               # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DEF = os.path.join(ROOT, 'src/assets/modernCityTileset.json')
SHEET = os.path.join(ROOT, 'src/assets/modernCitySheet.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/street-anim/baked.json')
REPORT = os.path.join(ROOT, 'tiledata/modern-city/street-anim/bake-report.json')
KIT_GROUP = 'mc:prop:street-anim'
T = 16

# 시트 팔레트(신호등·표지 칸에서 읽은 값)
INK, LIGHT, STEEL, STEEL2, NAVY, NAVY2, NAVY3 = '#091125', '#e4e9e8', '#c1cfcc', '#738a90', '#36516a', '#283d53', '#192737'
POLE, POLE2, POLE3 = '#61767d', '#516268', '#3d4b51'
SHADOW = (9, 17, 37, 96)
LAMP = {  # 2×2 렌즈: [[좌상, 우상], [좌하, 우하]] — 켜짐은 좌상 하이라이트, 꺼짐은 같은 색상의 짙은 유리
    'R1': [['#ffd0c8', '#ff5a4a'], ['#e8303c', '#b81c34']], 'R0': [['#5a2030', '#4a1828'], ['#3e1422', '#30101c']],
    'Y1': [['#fff2b0', '#ffd04a'], ['#f0b020', '#c88a10']], 'Y0': [['#4e4024', '#44361e'], ['#3a2e18', '#2e2412']],
    'G1': [['#d0ffe0', '#5ef0a0'], ['#2ed080', '#18a060']], 'G0': [['#1e3a30', '#1a3228'], ['#162a22', '#12221c']],
}
PED_ON = {'R': '#ff5a4a', 'G': '#5ef0a0'}
PED_OFF = {'R': '#3a1622', 'G': '#16302a'}
YEL = ['#3a2a08', '#c88a10', '#f0b020', '#ffd04a', '#fff2b0']           # 건널목 차단봉·표지 노랑
BLK = '#141a24'
AMBER_ON, AMBER_OFF = ['#fff2b0', '#ffc030', '#e08a10'], ['#3a2e18', '#2e2412', '#241c10']


def hx(c):
    if isinstance(c, tuple): return c
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = hx(c) if c is not None else (0, 0, 0, 0)
    def R(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): s.P(xx, yy, c)
    def paste(s, im, x, y):
        b = np.asarray(im.convert('RGBA'))
        for yy in range(b.shape[0]):
            for xx in range(b.shape[1]):
                if b[yy, xx, 3]: s.P(x + xx, y + yy, tuple(int(v) for v in b[yy, xx]))
    def img(s): return Image.fromarray(s.a.copy(), 'RGBA')


_CHIP = None
def chip_tile(t):
    global _CHIP
    if _CHIP is None: _CHIP = Image.open(PNG).convert('RGBA')
    return _CHIP.crop(((t % 48) * T, (t // 48) * T, (t % 48) * T + T, (t // 48) * T + T))


# ------------------------------------------------------------------ 신호 주기(0.5초 프레임 34개 = TRANSIT_SIGNAL 17초)
# 맵에 들어오면 타일 움직임은 0프레임부터 돌고, 시뮬레이션 시계는 createTransitSim 의 미리 돌리기(90초) 뒤에서 시작한다
# → 0프레임 = 시계 90 % 17 = 5초. transitSignalAxis 와 같은 식(동서 초록 0~7 · 전적 7~8.5 · 남북 초록 8.5~15.5 · 전적).
SIG_FRAMES, SIG_FPS, SIG_T0 = 34, 2, 90 % 17
def _sig_t(axis, f):
    t = (f / SIG_FPS + SIG_T0) % 17
    return (t - 8.5) % 17 if axis == 'ns' else t


def car_phase(axis, f):
    t = _sig_t(axis, f)
    return 'G' if t < 7 else 'Y' if t < 8.5 else 'R'


def ped_phase(axis, f):
    t = _sig_t(axis, f)
    if t < 5: return 'G'
    if t < 7: return 'G' if f % 2 == 0 else '-'      # 0.5초 간격 점멸
    return 'R'


def car_signal(axis, f):
    """1×3(16×48) — 기존 mc-prop-signal-a 칸 그림 위에 렌즈 셋(빨강 y11 · 황색 y16 · 초록 y21)을 켜고 끈다."""
    c = Cv(16, 48)
    for i, t in enumerate((7409, 7410, 7411)): c.paste(chip_tile(t), 0, i * T)
    ph = car_phase(axis, f)
    for key, y in (('R', 11), ('Y', 16), ('G', 21)):
        lens = LAMP[key + ('1' if ph == key else '0')]
        for dy in range(2):
            for dx in range(2): c.P(7 + dx, y + dy, lens[dy][dx])
    return c.img()


def ped_signal(axis, f):
    """1×3 — 기존 보행자 신호(7524·7525·7526) 위 창(빨강 사람)·아래 창(초록 사람)을 켜고 끈다."""
    c = Cv(16, 48)
    for i, t in enumerate((7524, 7525, 7526)): c.paste(chip_tile(t), 0, i * T)
    ph = ped_phase(axis, f)
    for y in range(16, 16 + 7):
        for x in range(5, 11): c.P(x, y, INK) if y != 16 + 3 else None
    red = [(7, 0), (8, 0), (6, 1), (7, 1), (8, 1), (9, 1), (6, 2), (9, 2)]           # 서 있는 사람(머리·팔·다리 3줄)
    walk = [(8, 4), (9, 4), (6, 5), (7, 5), (8, 5), (6, 6), (9, 6)]                    # 걷는 사람
    for (x, y) in red: c.P(x, 16 + y, PED_ON['R'] if ph == 'R' else PED_OFF['R'])
    for (x, y) in walk: c.P(x, 16 + y, PED_ON['G'] if ph == 'G' else PED_OFF['G'])
    return c.img()


# ------------------------------------------------------------------ 철도 건널목(4×4 = 64×64, 노란·검정 차단봉 48px, 경보등 적색 교대 점멸)
XING_FPS = 1
# 10초: 대기 1 → 경보 → 내려감 → 닫힘 5초 → 올라감. 움직이는 칸 14개 × 프레임 수만큼 시트 칸을 먹는다 — 시트가 4096px(256줄) 한도에 거의 닿아 10프레임으로 줄였다.
XING_SEQ = ['up0', 'up1', 'mid2', 'dn1', 'dn2', 'dn1', 'dn2', 'dn1', 'mid1', 'up2']
PIVOT = (14, 50)
ARM = 48


def arm_line(c, ang):
    """피벗에서 각도 ang(0=수평 오른쪽, 90=수직 위)로 길이 48 · 굵기 3 의 차단봉을 그린다. 노랑·검정 6px 띠, 끝에 빨간 반사판."""
    px, py = PIVOT; ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = {}
    steps = ARM * 3
    for i in range(steps + 1):
        d = i / 3
        for w in (-1, -0.5, 0, 0.5, 1):
            x = round(px + ca * d + sa * w); y = round(py - sa * d + ca * w)
            seg = int(d // 6) % 2
            col = YEL[3] if seg == 0 else BLK
            if w < 0: col = YEL[4] if seg == 0 else '#2a3240'
            if w > 0: col = YEL[1] if seg == 0 else BLK
            if d > ARM - 3: col = '#e8303c' if w >= 0 else '#ff8a7a'
            if (x, y) not in pts or w == 0: pts[(x, y)] = col
    # 1px 먹 외곽
    for (x, y) in list(pts):
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in pts and 0 <= nx < c.w and 0 <= ny < c.h and not c.a[ny, nx, 3]: c.P(nx, ny, INK)
    for (x, y), col in pts.items(): c.P(x, y, col)


def xing(state, mirror=False):
    c = Cv(64, 64)
    # 땅 그림자(기둥 밑)
    for x in range(1, 14): c.P(x, 63, SHADOW)
    for x in range(2, 13): c.P(x, 62, SHADOW)
    ang = {'up0': 90, 'up1': 90, 'up2': 90, 'mid1': 45, 'mid2': 45, 'dn1': 0, 'dn2': 0}[state]
    lamp = {'up0': 0, 'up1': 1, 'up2': 2, 'mid1': 1, 'mid2': 2, 'dn1': 1, 'dn2': 2}[state]   # 0 꺼짐, 1 왼쪽 켜짐, 2 오른쪽 켜짐
    arm_line(c, ang)
    # 기둥(x 5..8) + 받침
    c.R(4, 8, 6, 54, INK); c.R(5, 8, 4, 54, POLE); c.R(5, 8, 1, 54, STEEL); c.R(8, 8, 1, 54, POLE3)
    c.R(2, 58, 10, 4, INK); c.R(3, 58, 8, 3, STEEL2); c.R(3, 58, 8, 1, STEEL); c.R(3, 60, 8, 1, POLE3)
    # 차단기 구동함(피벗 둘레, 기둥 오른쪽)
    c.R(9, 45, 9, 11, INK); c.R(10, 46, 7, 9, YEL[2]); c.R(10, 46, 7, 1, YEL[4]); c.R(10, 53, 7, 2, YEL[1]); c.P(PIVOT[0], PIVOT[1], INK)
    # X 표지(노랑·검정 띠, 꼭대기)
    for i in range(11):
        for (x, y) in ((1 + i, 1 + i), (11 - i, 1 + i)):
            c.P(x - 1, y, INK); c.P(x + 1, y, INK)
    for i in range(11):
        for (x, y) in ((1 + i, 1 + i), (11 - i, 1 + i)):
            c.P(x, y, YEL[3] if (i // 2) % 2 == 0 else BLK)
    # 경보등 막대 + 적색 램프 둘(교대)
    c.R(0, 16, 14, 3, INK); c.R(1, 17, 12, 1, POLE2)
    for k, lx in enumerate((0, 9)):
        on = lamp == k + 1
        c.R(lx, 19, 5, 6, INK)
        c.R(lx + 1, 20, 3, 4, '#ff5a4a' if on else '#4a1828'); c.P(lx + 1, 20, '#ffd0c8' if on else '#5a2030'); c.R(lx + 1, 23, 3, 1, '#b81c34' if on else '#30101c')
        c.R(lx, 18, 5, 1, NAVY3)                                                             # 차양
    # 방향 표시판(↔ 화살표, 검정 바탕)
    c.R(2, 27, 10, 5, INK); c.R(3, 28, 8, 3, BLK)
    on = lamp != 0
    for x in range(4, 10): c.P(x, 29, '#ffc030' if on else '#3a2e18')
    c.P(4, 28, '#ffc030' if on else '#3a2e18'); c.P(9, 28, '#ffc030' if on else '#3a2e18'); c.P(4, 30, '#ffc030' if on else '#3a2e18'); c.P(9, 30, '#ffc030' if on else '#3a2e18')
    im = c.img()
    return im.transpose(Image.FLIP_LEFT_RIGHT) if mirror else im


# ------------------------------------------------------------------ 점멸 화살표판(2×2 = 32×32, 공사 트레일러)
ARROW_FPS = 4
def arrow_board(f, mirror=False):
    c = Cv(32, 32)
    for x in range(3, 30): c.P(x, 31, SHADOW)
    # 다리·바퀴
    c.R(5, 22, 2, 8, INK); c.R(25, 22, 2, 8, INK); c.P(5, 22, POLE); c.P(25, 22, POLE)
    c.R(3, 27, 6, 4, INK); c.R(4, 28, 4, 2, '#2a3240'); c.R(23, 27, 6, 4, INK); c.R(24, 28, 4, 2, '#2a3240')
    c.R(2, 21, 28, 3, INK); c.R(3, 22, 26, 1, YEL[2])                                       # 차대(노랑)
    for x in range(3, 29, 4): c.R(x, 22, 2, 1, BLK)
    # 판(검정, 먹 외곽) 2..29 × 2..19
    c.R(1, 1, 30, 20, INK); c.R(2, 2, 28, 18, BLK); c.R(2, 2, 28, 1, '#2a3240')
    # 램프 격자 3열 화살표(>>>): 프레임 0 = 모두 꺼짐, 1..3 = 1·2·3 개 켜짐(오른쪽으로 흐름)
    lit = f % 4
    for k in range(3):
        on = k < lit
        x0 = 5 + k * 8
        for i in range(5):
            for (x, y) in ((x0 + i, 5 + i), (x0 + i, 15 - i)):
                c.P(x, y, AMBER_ON[1] if on else AMBER_OFF[1])
                c.P(x + 1, y, AMBER_ON[2] if on else AMBER_OFF[2])
        if on: c.P(x0, 5, AMBER_ON[0]); c.P(x0, 15, AMBER_ON[0])
    im = c.img()
    return im.transpose(Image.FLIP_LEFT_RIGHT) if mirror else im


# ------------------------------------------------------------------ 택시 승강장 표지(1×3, 정지)
def taxi_stand():
    c = Cv(16, 48)
    for x in range(4, 13): c.P(x, 47, SHADOW)
    c.R(7, 14, 3, 32, INK); c.R(8, 14, 1, 32, POLE)                                         # 기둥
    c.R(5, 44, 7, 3, INK); c.R(6, 44, 5, 2, STEEL2); c.R(6, 44, 5, 1, STEEL)
    c.R(1, 1, 15, 14, INK); c.R(2, 2, 13, 12, YEL[3]); c.R(2, 2, 13, 1, YEL[4]); c.R(2, 13, 13, 1, YEL[1])
    # 택시 그림문자(앞모습): 지붕등 → 앞유리 → 차체 · 전조등 → 바퀴. 글자 대신 그림으로 읽힌다.
    c.R(7, 3, 3, 2, INK); c.R(8, 3, 1, 1, LIGHT)                                           # 지붕 표시등
    c.R(4, 5, 9, 1, INK); c.R(3, 6, 11, 3, INK); c.R(5, 6, 7, 2, '#7fb6d0'); c.P(5, 6, '#c8ecf6')   # 지붕선 · 앞유리
    c.R(2, 9, 13, 3, INK); c.R(3, 9, 11, 2, '#1e2a36')                                      # 차체
    c.P(4, 9, '#fff2b0'); c.P(12, 9, '#fff2b0'); c.R(6, 10, 5, 1, STEEL2)                  # 전조등 · 그릴
    c.R(3, 12, 2, 1, INK); c.R(12, 12, 2, 1, INK)                                           # 바퀴
    return c.img()


# ------------------------------------------------------------------ 키트 목록: (id, 이름, 칸 w, h, 프레임 그림 함수 목록, fps, 통행 격자, 설명, 배치 규칙)
def kits():
    star, solid = 'star', 'solid'
    pole3 = [[star], [star], [solid]]
    out = []
    for axis, ko in (('ew', '동서'), ('ns', '남북')):
        out.append((f'mc-anim-signal-{axis}', f'차량 신호등 ({ko} 차로 · 움직임)', 1, 3, [lambda f, a=axis: car_signal(a, f) for _ in range(1)], SIG_FRAMES, SIG_FPS, pole3,
                    f'3색 차량 신호등. {ko} 방향 차량용 — 초록 7초 · 황색 1.5초 · 빨강 8.5초(시뮬레이션 TRANSIT_SIGNAL 17초 주기와 같은 박자).',
                    f'교차로 모서리 보도, 맨 아랫줄(기둥 밑)이 보도에. {ko} 도로를 보는 모서리에 둔다. 반대 축은 mc-anim-signal-{"ns" if axis == "ew" else "ew"}.'))
        out.append((f'mc-anim-ped-signal-{axis}', f'보행자 신호등 ({ko} 차량과 함께 · 움직임)', 1, 3, [lambda f, a=axis: ped_signal(a, f)], SIG_FRAMES, SIG_FPS, pole3,
                    f'보행자 신호. {ko} 차량이 초록일 때 그와 나란한 횡단보도를 건넌다 — 보행 5초 · 초록 점멸 2초 · 정지 10초.',
                    '횡단보도 끝 보도 모서리, 맨 아랫줄이 보도에.'))
    xing_grid = [[star] * 4 for _ in range(4)]; xing_grid[3][0] = solid
    for mir, side, ko in ((False, 'a', '차단봉 오른쪽'), (True, 'b', '차단봉 왼쪽')):
        g = [list(r) for r in xing_grid]
        if mir: g[3][0], g[3][3] = star, solid
        out.append((f'mc-anim-rail-crossing-{side}', f'철도 건널목 차단기 ({ko} · 움직임)', 4, 4, [lambda f, m=mir: xing(XING_SEQ[f], m)], len(XING_SEQ), XING_FPS, g,
                    f'건널목 경보기 + 차단기(노랑·검정 띠 48px). 10초 한 바퀴: 대기 1초 → 적색 경보등 교대 점멸 → 내려감(45°) → 닫힘 5초(전철 통과) → 올라감. X 표지·방향 화살표판.',
                    '선로를 가로지르는 차도 옆 보도, 기둥 칸(맨 아랫줄 ' + ('오른쪽' if mir else '왼쪽') + ' 끝)이 보도에, 차단봉 3칸이 차로 위로. 길 건너편에는 반대쪽(-' + ('a' if mir else 'b') + ')을 둔다.'))
    for mir, side, ko in ((False, 'r', '오른쪽'), (True, 'l', '왼쪽')):
        out.append((f'mc-anim-arrow-board-{side}', f'공사 점멸 화살표판 ({ko} 합류 · 움직임)', 2, 2, [lambda f, m=mir: arrow_board(f, m)], 4, ARROW_FPS, [[star, star], [solid, solid]],
                    f'도로 공사 트레일러 화살표판. 호박색 램프 화살표 셋이 {ko}으로 차례로 켜진다(4프레임 · 1초).',
                    '공사 구간 차로 끝, 라바콘(mc-prop-cone-*) 줄 앞. 맨 아랫줄(바퀴)이 차로에.'))
    out.append(('mc-prop-taxi-stand-a', '택시 승강장 표지', 1, 3, [lambda f: taxi_stand()], 1, 0, pole3,
                '노란 표지판에 택시 앞모습 그림문자(지붕 표시등·앞유리·전조등). 택시 노선 정차점(stops)을 이 앞 차로에 두면 택시가 서서 손님을 기다린다.',
                '보도 연석 쪽, 맨 아랫줄이 보도에. 정차 차로는 표지 앞 바깥 차로.'))
    return out


def kit_frames(kit):
    kid, _ko, w, h, fns, n, fps, _g, _d, _r = kit
    fn = fns[0]
    return [fn(f) for f in range(n)]


def cells_of(im, w, h):
    a = np.asarray(im)
    return [[a[y * T:(y + 1) * T, x * T:(x + 1) * T] for x in range(w)] for y in range(h)]


def board(path, z=3):
    """QA 판: 키트마다 한 줄, 프레임 전부(고유 프레임만) 3배."""
    rows = []
    for kit in kits():
        fr = kit_frames(kit); uniq = []
        for im in fr:
            if not any(np.array_equal(np.asarray(im), np.asarray(u)) for u in uniq): uniq.append(im)
        rows.append((kit[0], uniq))
    W = max(sum(u.width + 6 for u in us) for _k, us in rows) + 8
    H = sum(max(u.height for u in us) + 10 for _k, us in rows) + 8
    b = Image.new('RGBA', (W, H), (88, 92, 102, 255)); y = 4
    for _k, us in rows:
        x = 4
        for u in us: b.alpha_composite(u, (x, y)); x += u.width + 6
        y += max(u.height for u in us) + 10
    b.resize((W * z, H * z), Image.NEAREST).save(path)
    return [(k, len(us)) for k, us in rows]


# ------------------------------------------------------------------ 굽기
def apply(root=ROOT, dry=False):
    data = json.load(open(DEF, encoding='utf-8'))
    pins = json.load(open(PINS, encoding='utf-8'))
    own = json.load(open(OWN, encoding='utf-8')) if os.path.exists(OWN) else {'version': 1, 'cells': {}}
    count0, tpr = data['count'], data['tilesPerRow']
    # 이 굽기 소유 칸이 이미 있으면(다시 굽기) 그 번호를 그대로 쓴다. 처음이면 지금 끝에서 시작한다.
    count = max([count0] + [v + 1 for v in own['cells'].values()])
    mine = {}; strips = []; kit_defs = []

    def slot(name):
        nonlocal count
        if name in own['cells']: return own['cells'][name]
        tid = count; count += 1; own['cells'][name] = tid; pins['cells'][name] = tid
        return tid

    for kit in kits():
        kid, ko, w, h, _fns, n, fps, grid, desc, rules = kit
        frames = [cells_of(im, w, h) for im in kit_frames(kit)]
        rows = []
        for y in range(h):
            r = []
            for x in range(w):
                seq = [fr[y][x] for fr in frames]
                if not seq[0][:, :, 3].any() and all(not s[:, :, 3].any() for s in seq): r.append(-1); continue
                pc = grid[y][x]
                moving = any(not np.array_equal(seq[0], s) for s in seq[1:])
                if moving:
                    # 연속 칸 n 개 — 앞 프레임 번호를 다시 쓰면 안 되니 이름 둘을 한꺼번에 잡는다
                    ids = [slot(f'anim:{kid}:{x},{y}:{f}') for f in range(n)]
                    assert ids == list(range(ids[0], ids[0] + n)), (kid, x, y, ids[:3])
                    for f, tid in enumerate(ids): mine[tid] = (seq[f], pc, f'{ko} ({x + 1},{y + 1}) 움직임 {f + 1}/{n}', kid)
                    strips.append(dict(baseTile=ids[0], frames=n, fps=fps)); r.append(ids[0])
                else:
                    tid = slot(f'anim:{kid}:{x},{y}:s'); mine[tid] = (seq[0], pc, f'{ko} ({x + 1},{y + 1})', kid); r.append(tid)
            rows.append(r)
        kit_defs.append(dict(id=kid, kind='section', name=ko, width=w, height=h, tileSize=16, rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows], learnedFrom='db-authored',
                             ai=dict(description=desc[:400], placementRules=rules, tags=['modern-city', 'prop-street', '움직임' if n > 1 else '표지', ko], role='prop',
                                     repeatability='fixed', layerHome='upper', themes=['현대 도시'], origin='ai', confidence='high')))
    # 시트
    old = Image.open(PNG).convert('RGBA'); rows_n = math.ceil(count / tpr)
    assert rows_n * 16 <= 4096, rows_n
    sheet = Image.new('RGBA', (tpr * 16, max(rows_n * 16, old.height)), (0, 0, 0, 0)); sheet.paste(old, (0, 0))
    for tid, (cell, *_r) in mine.items():
        x, y = (tid % tpr) * 16, (tid // tpr) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y)); sheet.paste(Image.fromarray(np.ascontiguousarray(cell), 'RGBA'), (x, y))
    a0 = np.asarray(old); a1 = np.asarray(sheet)[:old.height]
    changed = [t for t in range(min(count0, (old.height // 16) * tpr)) if t not in mine and not np.array_equal(
        a0[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16], a1[(t // tpr) * 16:(t // tpr) * 16 + 16, (t % tpr) * 16:(t % tpr) * 16 + 16])]
    assert not changed, ('앞 번호 그림이 바뀌었다', changed[:10])
    # 정의
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        while len(data[key]) < count:
            data[key].append(dict(SOLID) if key == 'passability' else 'lower' if key == 'priority' else 0 if key == 'terrain' else dict(label='', description='사용하지 않는 칸.', source='unknown'))
    for tid, (_cell, pc, label, kid) in mine.items():
        solid = pc == 'solid'
        data['passability'][tid] = dict(SOLID) if solid else dict(PASS); data['priority'][tid] = 'upper'; data['terrain'][tid] = 0
        data['tileMeta'][tid] = dict(label=label, description=f'{PCNOTE[pc]}. 키트 {kid} 로 찍는다(낱칸으로 칠하지 않는다).', role='prop', passage=pc, defaultLayer='upper',
                                     tags=['modern-city', 'prop-street', kid], source='bundled-default', confidence='high', repeatability='fixed', layerBacking='none')
    data['count'] = max(data['count'], count)
    bases = {s['baseTile'] for s in strips}
    data['animationStrips'] = [s for s in data.get('animationStrips', []) if s['baseTile'] not in bases and not (min(mine) <= s['baseTile'] <= max(mine))] + strips
    data['tileGroups'] = [g for g in data['tileGroups'] if g['id'] != KIT_GROUP]
    data['tileGroups'].append(dict(id=KIT_GROUP, name='소품 · 움직이는 거리 소품(신호·건널목·화살표판)', role='prop', defaultLayer='upper', tileIds=sorted(mine),
                                   description='신호등·보행자 신호(17초 주기)·철도 건널목 차단기·공사 점멸 화살표판·택시 승강장 키트 칸. 움직이는 칸은 animationStrips 첫 칸만 키트에 쓴다.',
                                   placementRules='키트째 위층에 찍는다. 낱칸으로 칠하지 않는다.', source='bundled-default', confidence='high', layerHome='upper'))
    ids = {k['id'] for k in kit_defs}
    data['structureKits'] = [k for k in data['structureKits'] if k['id'] not in ids] + kit_defs
    report = dict(count_before=count0, count_after=data['count'], owned_cells=len(mine), strips=len(strips), kits=[k['id'] for k in kit_defs], sheet=[sheet.width, sheet.height])
    if dry: return report
    sheet.save(PNG, optimize=True)
    wr = lambda p, o, **kw: open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, **kw) + '\n')   # noqa: E731
    wr(DEF, data, separators=(',', ':'))
    wr(SHEET, dict(count=data['count'], tilesPerRow=tpr), separators=(',', ': '))
    pins['count'] = max(pins.get('count', 0), data['count'])
    wr(PINS, pins, separators=(',', ':'))
    os.makedirs(os.path.dirname(OWN), exist_ok=True)
    own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
    wr(OWN, own, indent=0)
    wr(REPORT, report, indent=1)
    return report


PCNOTE = {'solid': '막힘(위층)', 'star': '솟은 칸 ★(통행 가능·사람 위에 그림)'}

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'board':
        print(board(sys.argv[2]))
    else:
        print(json.dumps(apply(dry='--dry' in sys.argv), ensure_ascii=False, indent=1))
