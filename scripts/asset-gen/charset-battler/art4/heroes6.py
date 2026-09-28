"""새 주인공 6명 전투 도트 — 직업 개성판 (2026-09-28).

    python3 scripts/asset-gen/charset-battler/art4/heroes6.py [actor3-0 ...]
    python3 scripts/asset-gen/charset-battler/build.py actor3-0 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py actor3-0 ...

대상: 사무라이 actor3-0 · 닌자 actor3-2 · 무도가 actor3-5 · 음유시인 actor3-6 · 드루이드 actor3-4 · 마녀 actor4-7.
몸(머리·몸통·다리·팔·마법 빛)은 기존 손도트 원본(art2/art3)을 repaint_weapons 의 'clean' 재생으로 다시 얻는다.
옛 장비만 빠지고 팔은 원래 층 순서대로 남는다. 핵심 포즈는 팔 관절 좌표만 옮긴다(positions 매핑).
그 위에 직업 장비(weapons.py 의 katana·kunai·lute·druid_staff·witch_staff 격자)와 직업 도트(칼집·베기 궤적·
수리검·타격 섬광·기공·음표·잎·마력 반짝임)를 좌표로 찍는다. 이미지 생성·축소·회전·보간 없음.
repaint_weapons.py 는 이 여섯 명을 건너뛴다(여기가 정본).
"""
import sys, json, math
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parent
sys.path.insert(0, str(LIB))
from PIL import Image, ImageDraw
import weapon_sources as sources
import repaint_weapons as rw
from cb_lib import POSES, CAST_TYPES, SRC_DIR, ROOT, blank, place, walk_frame, validate
from weapons import POSE_ANGLES, PALETTE, SPRITES, stamp, fitting_hand

IDS = ['actor3-0', 'actor3-2', 'actor3-5', 'actor3-6', 'actor3-4', 'actor4-7']
ROLE = {'actor3-0': 'samurai', 'actor3-2': 'ninja', 'actor3-5': 'monk',
        'actor3-6': 'bard', 'actor3-4': 'druid', 'actor4-7': 'witch'}
KIND = {'samurai': 'katana', 'ninja': 'kunai', 'monk': None, 'bard': 'lute',
        'druid': 'druid_staff', 'witch': 'witch_staff'}
UPRIGHT = ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak')
EVIDENCE = Path(ROOT) / '.omo/hero6'
C = {k: v for k, v in PALETTE.items()}
# 직업 도트 전용 색(음표·기공·잎). 알파 255.
FX = {
    'ink': (30, 24, 34, 255), 'white': (255, 255, 255, 255),
    'fire': (236, 84, 40, 255), 'ice': (112, 203, 255, 255), 'thunder': (255, 225, 90, 255),
    'heal': (147, 234, 98, 255), 'dark': (165, 88, 224, 255), 'arcane': (74, 233, 208, 255),
    'support': (255, 144, 199, 255), 'chi': (96, 214, 255, 255), 'gold': (253, 214, 96, 255),
}


# ── 도트 도구 ────────────────────────────────────────────────────────────────────
def put(im, x, y, c, over=True):
    x, y = int(x), int(y)
    if 0 < x < 47 and 0 < y <= 44 and (over or not im.getpixel((x, y))[3]):
        im.putpixel((x, y), c)


def line(im, a, b, c, over=True):
    x, y = a; x1, y1 = b
    dx, dy = abs(x1 - x), -abs(y1 - y); sx = 1 if x < x1 else -1; sy = 1 if y < y1 else -1; err = dx + dy
    while True:
        put(im, x, y, c, over)
        if (x, y) == (x1, y1):
            break
        e2 = 2 * err
        if e2 >= dy: err += dy; x += sx
        if e2 <= dx: err += dx; y += sy


def arc(im, center, r, t0, t1, c, over=False):
    """왼쪽을 보는 규약의 각도(0 왼쪽, 90 위)로 원호. 몸 위에는 찍지 않는다(over=False)."""
    cx, cy = center
    seen = set()
    for i in range(0, 64):
        t = math.radians(t0 + (t1 - t0) * i / 63)
        p = (round(cx - r * math.cos(t)), round(cy - r * math.sin(t)))
        if p not in seen:
            seen.add(p); put(im, *p, c, over)


def glyph(im, at, rows, pal, over=True):
    x0, y0 = at
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                put(im, x0 + x, y0 + y, pal[ch], over)


# 8분음표(색 도트만, 윤곽은 outlined 가 붙인다): 기둥 x=3, 깃발 오른쪽, 머리 왼쪽 아래 2×2.
NOTE = ['...c..', '...cc.', '...c.c', '...c..', '.ccc..', '.cc...']
SHURIKEN = ['..k..', '.kLk.', 'kLDLk', '.kLk.', '..k..']
SHURIKEN_BIG = ['...k...', '..kLk..', '.kMLMk.', 'kLLDLLk', '.kMLMk.', '..kLk..', '...k...']
LEAF = ['.N', 'Nn', 'n.']


def outlined(im, at, rows, pal):
    """색 도트를 찍고 상하좌우 빈칸에 어두운 윤곽을 두른다(몸 위에는 윤곽을 찍지 않는다)."""
    x0, y0 = at
    pts = {(x0 + x, y0 + y): pal[ch] for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != '.'}
    for (x, y) in pts:
        for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + ex, y + ey) not in pts:
                put(im, x + ex, y + ey, FX['ink'], over=False)
    for (x, y), c in pts.items():
        put(im, x, y, c)


def note(im, at, color):
    outlined(im, at, NOTE, {'c': color})


# ── 장비 ────────────────────────────────────────────────────────────────────────
SAYA_HI = (104, 92, 118, 255)


def sheathed_katana(im, hand, empty=False):
    """허리에 찬 카타나. 칼자루는 손 앞(왼쪽 위)으로, 칼집은 허리 뒤로 완만히 내려간다.
    empty=True 는 칼을 뽑은 뒤 남은 빈 칼집(입구 금테만)."""
    hx, hy = hand
    if not empty:
        # 자루: 흰 감개/검은 마름모가 번갈아, 끝에 금 머리장식.
        for i, (dx, dy) in enumerate([(-1, -1), (-2, -1), (-3, -2), (-4, -2), (-5, -3)]):
            put(im, hx + dx, hy + dy, C['H'] if i % 2 == 0 else C['k'])
            put(im, hx + dx, hy + dy + 1, C['k'])
        put(im, hx - 6, hy - 3, C['g']); put(im, hx - 6, hy - 4, C['g'])
        for dy in (-2, -1, 0, 1):
            put(im, hx + 2, hy + dy, C['g'])
    else:
        for dy in (-1, 0, 1):
            put(im, hx, hy + dy, C['g'])
    x0 = hx + 3 if not empty else hx + 1
    end = (hx + 15, hy + 4)
    line(im, (x0, hy - 1), (end[0], end[1] - 1), SAYA_HI)
    line(im, (x0, hy), end, C['k'])
    line(im, (x0, hy + 1), (end[0] - 1, end[1] + 1), C['k'])
    put(im, end[0] + 1, end[1], C['g']); put(im, end[0] + 1, end[1] - 1, C['g'])
    return [(hx - 6, hy - 4), end]


def weapon_head(points, colors):
    ps = [(x, y) for x, y, c in points if c in colors]
    return (round(sum(p[0] for p in ps) / len(ps)), round(sum(p[1] for p in ps) / len(ps))) if ps else None


# ── 직업별 설계 ──────────────────────────────────────────────────────────────────
# moves: 그 포즈의 팔·손 관절 좌표 옮기기(옛 좌표 → 새 좌표). weapons: (종류, 각도, 손).
# 손 None 은 기록된 무기 손(옮긴 뒤 좌표). 각도 None 은 기본 규칙.
def staff_angle(pid, hand):
    if pid.startswith('cast_'):
        return 90 if hand[1] < 28 else 135 if hand[0] >= 24 else 45
    return POSE_ANGLES[pid]


def design(role, pid):
    d = dict(moves={}, weapons=None, fx=[])
    cast = pid.startswith('cast_')
    if role == 'samurai':
        if pid in ('idle', 'walk_a', 'walk_b', 'walk_c', 'weak'):
            # 발도 자세: 칼자루에 손을 얹고 선다.
            d['weapons'] = [('sheathed', 0, None)]
        elif pid in ('defend', 'guard_hit'):
            d['weapons'] = [('katana', 90, None)]
        elif pid == 'attack_windup':
            # 발도 직전: 칼자루에 손, 다른 손은 칼집을 잡고 몸을 낮춘다.
            d['moves'] = {(31, 32): (24, 36), (32, 27): (20, 37), (26, 35): (27, 38), (29, 30): (25, 40)}
            d['weapons'] = [('sheathed', 0, (20, 37))]
        elif pid == 'attack_strike':
            # 뽑는 순간: 팔을 앞으로 곧게, 칼날은 수평. 다른 손은 칼집 자리(허리)로.
            d['moves'] = {(24, 28): (20, 33), (19, 24): (17, 33), (21, 33): (23, 36), (19, 29): (25, 38)}
            d['weapons'] = [('katana', 0, (17, 33)), ('saya', 0, (23, 38))]
            d['fx'] = [('streak', [(2, 30, 12), (4, 36, 13)])]
        elif pid == 'attack':
            # 올려 베기 끝: 칼끝이 왼쪽 위, 수평 → 사선 궤적.
            d['moves'] = {(20, 34): (19, 31), (15, 33): (15, 27)}
            d['weapons'] = [('katana', 45, (15, 27)), ('saya', 0, (23, 38))]
            d['fx'] = [('arc', (15, 27), 14, -8, 40)]
        elif pid == 'skill':
            # 발도 섬광: 수평으로 뻗은 칼 + 두 줄 잔광 + 큰 초승달.
            d['moves'] = {(22, 29): (20, 32), (17, 26): (17, 32)}
            d['weapons'] = [('katana', 0, (17, 32)), ('saya', 0, (23, 37))]
            d['fx'] = [('arc', (17, 32), 15, -40, 40), ('streak', [(3, 27, 14), (2, 38, 14)])]
        elif pid == 'attack_follow':
            d['weapons'] = [('katana', None, None), ('saya', 0, (23, 38))]
        elif cast:
            d['weapons'] = [('katana', None, None)]
    elif role == 'ninja':
        back = {'attack_windup': (34, 33), 'attack_strike': (31, 33), 'attack': (31, 34),
                'attack_follow': (31, 34), 'skill': (31, 34)}
        if pid in ('idle', 'walk_a', 'walk_b', 'walk_c'):
            # 곧게 서서 한 손을 앞으로 뻗어 쿠나이를 겨눈다.
            d['moves'] = {(22, 36): (20, 34), (18, 35): (15, 33)}
            d['weapons'] = [('kunai', 0, (15, 33))]
        elif pid in UPRIGHT:
            d['weapons'] = [('kunai', 90 if pid in ('defend', 'guard_hit') else 270, None)]
        elif pid == 'skill':
            # 수리검 던지기: 앞손은 비우고 별 두 장이 날아간다. 뒷손은 역수 쿠나이.
            d['weapons'] = [('kunai', 270, back[pid])]
            d['fx'] = [('shuriken', (4, 18), True), ('shuriken', (0, 26), False), ('dots', [(13, 25), (15, 25), (11, 23)])]
        elif pid in back:
            d['weapons'] = [('kunai', None, None), ('kunai', 270, back[pid])]
            if pid == 'attack':
                d['fx'] = [('arc', (12, 32), 9, -35, 35)]
        elif cast:
            d['weapons'] = [('kunai', 270, None)]
    elif role == 'monk':
        d['weapons'] = []
        if pid == 'attack':
            d['fx'] = [('burst', (8, 32))]
        elif pid == 'attack_strike':
            d['fx'] = [('streak', [(20, 27, 5), (21, 31, 4)])]
        elif pid == 'attack_follow':
            # 정권 뒤 이어지는 앞차기: 앞다리를 허리 높이로 뻗는다(legs 로 다시 그린다).
            d['legs'] = {'front': ((17, 37), (11, 34))}
            d['fx'] = [('burst', (6, 31))]
        elif pid == 'skill':
            d['fx'] = [('chi', (7, 28))]
    elif role == 'bard':
        # 류트 각도: 격자의 머리(줄감개) 방향. 몸통은 반대편이다.
        if pid in ('idle', 'walk_a', 'walk_b', 'walk_c'):
            d['moves'] = {(22, 36): (20, 35), (18, 35): (17, 32)}
            d['weapons'] = [('lute', 45, (17, 32))]
            d['fx'] = [('strum', (24, 38))]
        elif pid in ('defend', 'guard_hit'):
            d['weapons'] = [('lute', 90, None)]
        elif pid == 'attack_windup':
            d['weapons'] = [('lute', 315, None)]
        elif pid == 'attack_strike':
            d['weapons'] = [('lute', 270, None)]
        elif pid == 'attack':
            d['weapons'] = [('lute', 180, None)]
            d['fx'] = [('burst', (4, 33))]
        elif pid == 'attack_follow':
            d['weapons'] = [('lute', 135, None)]
        elif pid in ('victory', 'victory_b'):
            d['weapons'] = [('lute', 270, None)]
            d['fx'] = [('notes', 'support', 2 if pid == 'victory' else 3)]
        elif pid == 'skill':
            d['weapons'] = [('lute', 45, None)]
            d['fx'] = [('notes', 'support', 3)]
        elif cast:
            ct = pid.split('_')[1]
            step = int(pid[-1]) if pid[-1].isdigit() else {'charge': 1, 'raise': 2, 'release': 3}[pid.split('_')[-1]]
            if not pid[-1].isdigit():
                ct = 'arcane'
            d['weapons'] = [('lute', 45, None)]
            d['fx'] = [('notes', ct, step)]
        else:
            d['weapons'] = [('lute', 45 if pid not in ('dead',) else 0, None)]
    elif role in ('druid', 'witch'):
        d['weapons'] = [(KIND[role], None, None)]
        if pid in ('victory', 'victory_b', 'skill'):
            d['fx'] = [('leaves' if role == 'druid' else 'hexsparks',)]
    return d


# ── 그리기 ───────────────────────────────────────────────────────────────────────
def fx_draw(im, body, fx, ctx):
    kind = fx[0]
    if kind == 'arc':
        _, c, r, t0, t1 = fx
        arc(im, c, r, t0, t1, C['H']); arc(im, c, r - 1, t0 + 6, t1 - 6, C['L'])
    elif kind == 'streak':
        for x, y, n in fx[1]:
            for i in range(n):
                if i % 5 != 4:
                    put(im, x + i, y, C['H'] if i < n // 2 else C['L'], over=False)
    elif kind == 'shuriken':
        _, at, big = fx
        glyph(im, at, SHURIKEN_BIG if big else SHURIKEN, {'k': C['D'], 'L': C['L'], 'M': C['M'], 'D': C['D']})
    elif kind == 'dots':
        for p in fx[1]:
            put(im, *p, C['L'], over=False)
    elif kind == 'burst':
        x, y = fx[1]
        for dx, dy, c in [(0, 0, 'white'), (-1, 0, 'gold'), (1, 0, 'gold'), (0, -1, 'gold'), (0, 1, 'gold'),
                          (-3, 0, 'white'), (0, -3, 'white'), (0, 3, 'white'), (-2, -2, 'gold'), (-2, 2, 'gold'), (2, -2, 'gold'), (2, 2, 'gold')]:
            put(im, x + dx, y + dy, FX[c], over=False)
    elif kind == 'chi':
        x, y = fx[1]
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                r2 = dx * dx + dy * dy
                if r2 <= 2: put(im, x + dx, y + dy, FX['white'])
                elif r2 <= 5: put(im, x + dx, y + dy, FX['chi'])
                elif r2 <= 10: put(im, x + dx, y + dy, C['j'])
        for p in [(x + 5, y - 3), (x + 4, y + 4), (x - 1, y - 5)]:
            put(im, *p, FX['chi'], over=False)
    elif kind == 'strum':
        ctx['hand'](im, fx[1])
    elif kind == 'notes':
        ct, step = fx[1], fx[2]
        hx, hy = fx[3] if len(fx) > 3 else ctx['free_hand']
        # 튕긴 손에서 음표가 앞(왼쪽) 위로 퍼진다. 단계가 오를수록 수가 늘고 멀리 간다.
        spots = {1: [(hx - 9, hy - 9)], 2: [(hx - 7, hy - 6), (hx - 14, hy - 12)],
                 3: [(hx - 10, hy - 11), (hx - 17, hy - 6), (hx - 16, hy - 17)]}[step]
        for x, y in spots:
            x = max(1, min(40, x)); y = max(2, min(36, y))
            note(im, (x, y), FX[ct] if ct in FX else FX['support'])
    elif kind == 'leaves':
        for at in [(8, 12), (36, 16), (5, 24)]:
            outlined(im, at, LEAF, {'N': C['N'], 'n': C['n']})
    elif kind == 'hexsparks':
        hx, hy = ctx.get('head') or (20, 14)
        for dx, dy, c in [(-4, -2, 'P'), (3, -4, 'P'), (-2, 3, 'p'), (4, 2, 'P'), (0, -6, 'P'), (-5, 1, 'p')]:
            put(im, hx + dx, hy + dy, C[c], over=False)
        for dx, dy in [(0, -6)]:
            for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, hx + dx + ex, hy + dy + ey, C['p'], over=False)


def arm_calls(cid):
    """칸별 최상위 팔 호출의 관절 목록(그리기는 그대로 한다). 음유시인 연주 자세를 잡을 때 쓴다."""
    calls, depth, patches = {}, [0], []

    def wrap(fn):
        def call(self, im, *a, **k):
            if depth[0] == 0:
                pts = a[0] if len(a) == 1 else [p for p in a if isinstance(p, (tuple, list)) and len(p) == 2 and not isinstance(p[0], (tuple, list))]
                calls.setdefault(sources.CURRENT, []).append([tuple(p) for p in pts])
            depth[0] += 1
            try:
                return fn(self, im, *a, **k)
            finally:
                depth[0] -= 1
        return call
    for cls in rw.classes():
        if 'arm' in cls.__dict__:
            fn = cls.__dict__['arm']; patches.append((cls, fn)); cls.arm = wrap(fn)
    try:
        sources.render(cid)
    finally:
        for cls, fn in reversed(patches):
            cls.arm = fn
    return calls


def cast_step(pid):
    if pid in ('cast_charge', 'cast_raise', 'cast_release'):
        return 'arcane', ('cast_charge', 'cast_raise', 'cast_release').index(pid) + 1
    parts = pid.split('_')
    return parts[1], int(parts[2])


def bard_play(arms, step):
    """류트 연주 3단계. 뒷팔(기록된 무기 손) = 목 잡는 손, 앞팔 = 줄 튕기는 손.
    1 가슴 앞 사선 류트, 손은 울림통 위 · 2 류트를 곧게 치켜들고 튕긴 손을 높이 뿌림 · 3 류트를 앞으로 눕혀 겨누고 손은 아래로 쓸어내림."""
    back, front = arms[-2], arms[-1]
    sb, sf = back[0], front[0]
    ox = sf[0] - 27
    plan = {
        1: dict(neck=[(sb[0] - 2, 37), (17 + ox, 34)], strum=[(sf[0] - 3, 38), (22 + ox, 38)], angle=45),
        2: dict(neck=[(sb[0] - 3, 30), (18 + ox, 25)], strum=[(sf[0] + 3, 29), (31 + ox, 24)], angle=90),
        3: dict(neck=[(sb[0] - 5, 33), (12 + ox, 32)], strum=[(sf[0] - 4, 38), (21 + ox, 38)], angle=0),
    }[step]
    moves = {}
    for old, new in zip(back[1:], plan['neck']):
        moves[old] = new
    for old, new in zip(front[1:], plan['strum']):
        moves.setdefault(old, new)
    return moves, plan['neck'][-1], plan['strum'][-1], plan['angle']


def render(cid):
    role = ROLE[cid]
    records = {}
    with rw.equipment_pass('record', records):
        sources.render(cid)
    for n, pid in enumerate(('cast_charge', 'cast_raise', 'cast_release'), 1):
        records[pid] = records.get(f'cast_arcane_{n}', [])
    if cid == 'actor3-6':
        records['skill'] = records.get('cast_support_3', [])
    designs, positions = {}, {}
    pids = [p[0] for p in POSES] + [f'cast_{ct}_{n}' for ct, _ in CAST_TYPES for n in (1, 2, 3)]
    calls = arm_calls(cid) if role == 'bard' else {}
    for pid in pids:
        designs[pid] = design(role, pid)
        if role == 'bard' and (pid.startswith('cast_') or pid == 'skill'):
            src = 'cast_support_3' if pid == 'skill' else pid
            if src in ('cast_charge', 'cast_raise', 'cast_release'):
                src = 'cast_arcane_%d' % cast_step(src)[1]
            ct, step = cast_step(src)
            moves, neck, strum, angle = bard_play(calls[src], step)
            designs[pid]['moves'] = moves
            designs[pid]['weapons'] = [('lute', angle, neck)]
            designs[pid]['fx'] = [('notes', ct, step, strum)]
        if designs[pid]['moves']:
            positions[pid] = dict(designs[pid]['moves'])
    # 그리기 원본의 칸 캐시: 공용 칸(cast_charge 등)은 cast_arcane_n 과 같은 그림이라 같은 이동을 쓴다.
    for n, pid in enumerate(('cast_charge', 'cast_raise', 'cast_release'), 1):
        if f'cast_arcane_{n}' in positions:
            positions[pid] = positions[f'cast_arcane_{n}']
    g, m, artist = sources.artist(cid)
    patched = []
    if role == 'bard':
        # 음유시인은 손끝 마법 빛 대신 음표를 띄운다.
        cls = type(artist)
        patched.append((cls, 'spark', cls.__dict__['spark'])); cls.spark = lambda self, *a, **k: 0
    kicks = {pid: d['legs'] for pid, d in designs.items() if d.get('legs')}
    if kicks:
        painter = next(c for c in type(artist).__mro__ if 'leg' in c.__dict__)
        leg = painter.__dict__['leg']
        def kick_leg(self, im, hip, knee, foot, back=False, _leg=leg):
            spec = kicks.get(sources.CURRENT)
            if spec and not back:
                knee, foot = spec['front']
            return _leg(self, im, hip, knee, foot, back)
        patched.append((painter, 'leg', leg)); painter.leg = kick_leg
    try:
        with rw.equipment_pass('clean', {}, positions):
            bodies = sources.render(cid)
    finally:
        for cls, name, fn in reversed(patched):
            setattr(cls, name, fn)
    report, out = {}, {}
    for pid in pids:
        body = bodies[pid]
        if pid == 'front':
            out[pid] = body; report[pid] = []; continue
        d = designs[pid]
        old = list(dict.fromkeys(records.get(pid, [])))
        if pid in UPRIGHT:
            old = old[-1:]
        grip = old[-1] if old else None
        if grip is not None:
            grip = d['moves'].get(grip, grip)
            if pid == 'guard_hit':
                grip = (grip[0] + 2, grip[1])
        kind = KIND[role]
        weapons = d['weapons'] if d['weapons'] is not None else ([(kind, None, None)] if kind else [])
        im = body.copy(); placed = []
        for wk, angle, hand in weapons:
            hand = hand or grip
            if pid == 'dead':
                hand = (30, 42) if wk == 'katana' else (21, 42)
            if hand is None:
                hand = (32, 36)
            if wk in ('sheathed', 'saya'):
                sheathed_katana(im, hand, empty=wk == 'saya')
                h = hand
                if wk == 'saya':
                    placed.append(dict(kind=wk, angle=0, grip=list(h), moved=False))
                    continue
            else:
                if angle is None:
                    angle = staff_angle(pid, hand) if wk in ('druid_staff', 'witch_staff', 'katana') and pid.startswith('cast_') else (0 if pid == 'dead' else POSE_ANGLES[pid] if pid in POSE_ANGLES else 45)
                    if wk == 'kunai' and pid.startswith('cast_'):
                        angle = 270
                h = fitting_hand(wk, angle, hand)
                pts = stamp(im, wk, angle, h)
                head = weapon_head(pts, (C['P'], C['N'], C['J']))
                if head: report.setdefault('_head', {})[pid] = head
            contact = pid == 'dead' or any(body.getpixel((x, y))[3] for y in range(h[1] - 1, h[1] + 2) for x in range(h[0] - 1, h[0] + 2))
            if not contact:
                # repaint_weapons 와 같은 보정: 빈손으로 그려진 옛 칸(아이템 등)에 어깨에서 이어지는 팔뚝을 찍는다.
                pal = sources.cb_lib.palette(cid)
                skin = min(pal, key=lambda c: sum((c[i] - v) ** 2 for i, v in enumerate((231, 160, 109)))) + (255,)
                dr = ImageDraw.Draw(body)
                shoulder = (27, 34) if h[0] >= 24 else (23, 34)
                elbow = ((shoulder[0] + h[0]) // 2, max(35, h[1]))
                dr.line([shoulder, elbow, h], fill=C['D'], width=3)
                dr.line([elbow, h], fill=skin, width=1)
                dr.rectangle((h[0] - 1, h[1] - 1, h[0] + 1, h[1] + 1), fill=skin)
                keep = im.copy(); im = body.copy(); im.alpha_composite(keep)
                for x, y, c in SPRITES[wk, angle % 360].pixels():
                    put(im, h[0] + x, h[1] + y, c)
                contact = True
            assert contact, (cid, pid, wk, angle, h, 'no hand at grip')
            if pid != 'dead':
                for y in range(h[1] - 1, h[1] + 2):
                    for x in range(h[0] - 1, h[0] + 2):
                        c = body.getpixel((x, y))
                        if c[3]:
                            im.putpixel((x, y), c)
            placed.append(dict(kind=wk, angle=angle, grip=list(h), moved=list(hand) != list(h)))
        ctx = dict(hand=lambda img, at: artist.hand(img, at), free_hand=None, head=report.get('_head', {}).get(pid))
        # 음표는 무기를 쥐지 않은 손(앞으로 뻗은 손) 쪽에 띄운다: 그 포즈에서 가장 왼쪽의 손.
        ctx['free_hand'] = (min(8 + 12, (grip or (20, 30))[0]), (grip or (20, 30))[1])
        for fx in d['fx']:
            fx_draw(im, body, fx, ctx)
        out[pid] = im
        report[pid] = placed
    report.pop('_head', None)
    return out, report


def save(cid, frames):
    target = Path(SRC_DIR) / cid
    backup = EVIDENCE / 'before' / cid
    backup.mkdir(parents=True, exist_ok=True)
    for name, im in frames.items():
        src = target / f'{name}.png'
        if not (backup / f'{name}.png').exists() and src.exists():
            Image.open(src).save(backup / f'{name}.png')
        issues = validate(cid, name, im)
        assert not issues, (cid, name, issues)
        assert {c[3] for c in im.getdata()} <= {0, 255}
        im.save(src, optimize=True)


def board(path, source_dir, poses):
    s, cw = 4, 192
    out = Image.new('RGB', (80 + cw * len(poses), 16 + (cw + 4) * len(IDS)), (40, 43, 54))
    d = ImageDraw.Draw(out)
    for c, p in enumerate(poses):
        d.text((80 + c * cw + 4, 2), p, fill=(235, 235, 240))
    for r, cid in enumerate(IDS):
        y = 16 + r * (cw + 4)
        d.text((4, y + 80), ROLE[cid], fill=(235, 235, 240)); d.text((4, y + 94), cid, fill=(160, 160, 170))
        for c, p in enumerate(poses):
            x = 80 + c * cw
            d.rectangle((x, y, x + cw - 2, y + cw - 1), fill=(56, 60, 74))
            f = Path(source_dir) / cid / f'{p}.png'
            if f.exists():
                im = Image.open(f).convert('RGBA').resize((cw, cw), Image.Resampling.NEAREST)
                out.paste(im, (x, y), im)
            d.line((x, y + 45 * s, x + cw - 2, y + 45 * s), fill=(120, 80, 84))
    out.save(path)


REVIEW = ['idle', 'walk_b', 'attack_windup', 'attack_strike', 'attack', 'attack_follow', 'skill',
          'victory', 'defend', 'hit', 'item', 'cast_charge', 'cast_raise', 'cast_release', 'dead']


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or IDS
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    audit = {}
    for cid in ids:
        assert cid in IDS, cid
        frames, report = render(cid)
        if '--dry' not in sys.argv:
            save(cid, frames)
        else:
            dry = EVIDENCE / 'dry' / cid; dry.mkdir(parents=True, exist_ok=True)
            for n, im in frames.items():
                im.save(dry / f'{n}.png')
        audit[cid] = dict(role=ROLE[cid], weapon=KIND[ROLE[cid]], frames=len(frames), placements=report)
        print(cid, ROLE[cid], len(frames), 'frames', flush=True)
    (HERE / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=1) + '\n')
    src = EVIDENCE / 'dry' if '--dry' in sys.argv else Path(SRC_DIR)
    board(EVIDENCE / 'after.png', src, REVIEW)
    if (EVIDENCE / 'before').exists():
        board(EVIDENCE / 'before_board.png', EVIDENCE / 'before', REVIEW)


if __name__ == '__main__':
    main()

