"""포즈 표(무기 유형별)와 렌더러. 규격·리그는 rig.py 머리 주석."""
import math, sys
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent))
from PIL import Image
from rig import *  # noqa
import rig
from cb_lib import POSES, CAST_TYPES

# 각 항목: legs 걷기 패턴 0/1/2, lean 윗몸 기울임(+ 뒤), crouch 줄 빼기, spread 보폭, dx/dy 몸 이동,
#          hand 어깨 기준 손 위치(dx, dy), ang 무기 각도, hand2/ang2 다른 손(없으면 안 그린다)
def P(legs=1, lean=0, crouch=0, spread=0, dx=0, dy=0, hand=(-5, 6), ang=60, hand2=None, ang2=None, bend=1, weapon=True):
    return dict(legs=legs, lean=lean, crouch=crouch, spread=spread, dx=dx, dy=dy, hand=hand, ang=ang, hand2=hand2, ang2=ang2, bend=bend, weapon=weapon)


# 한 손 근접(검·도끼·철퇴·몽둥이·환도·레이피어)
MELEE = {
    'idle': P(1, 0, hand=(-5, 6), ang=55),
    'walk_a': P(0, 0, hand=(-5, 6), ang=50), 'walk_b': P(1, 0, hand=(-5, 6), ang=55), 'walk_c': P(2, 0, hand=(-5, 5), ang=60),
    'attack': P(2, -3, spread=2, dx=-2, hand=(-8, -1), ang=0),
    'attack_windup': P(0, 3, dx=2, hand=(3, -8), ang=125),
    'attack_strike': P(1, -1, dx=-1, hand=(-7, -7), ang=32),
    'attack_follow': P(2, -4, spread=2, dx=-2, hand=(-7, 6), ang=322),
    'hit': P(1, 3, dx=3, hand=(-2, 7), ang=78),
    'defend': P(1, -1, crouch=3, dx=1, hand=(-7, 1), ang=85),
    'victory': P(1, 0, dy=-1, hand=(-4, -11), ang=90),
    'victory_b': P(1, -1, dy=-3, hand=(-8, -9), ang=68, hand2=(6, -9)),
    'item': P(1, 0, hand=(-7, -2), ang=90),
    'weak': P(1, -1, crouch=5, hand=(-3, 8), ang=258),
    'evade': P(0, 3, dx=6, hand=(1, 5), ang=100),
    'guard_hit': P(1, 1, crouch=3, dx=3, hand=(-7, 1), ang=85),
    'skill': P(2, -2, spread=2, dx=-1, hand=(-7, -9), ang=55),
    'dying': P(1, 3, crouch=4, dx=2, hand=(2, 8), ang=240),
    'revive': P(1, 0, crouch=3, hand=(-3, 8), ang=255),
    'cast_charge': P(1, 0, hand=(-4, 1), ang=90),
    'cast_raise': P(1, 0, hand=(-2, -13), ang=100),
    'cast_release': P(2, -2, dx=-2, hand=(-9, -1), ang=0),
}
# 긴 자루(창·지팡이)
POLE = {
    'idle': P(1, 0, hand=(-5, 3), ang=88),
    'walk_a': P(0, 0, hand=(-5, 3), ang=86), 'walk_b': P(1, 0, hand=(-5, 3), ang=88), 'walk_c': P(2, 0, hand=(-5, 3), ang=90),
    'attack': P(2, -3, spread=2, dx=-2, hand=(-8, 1), ang=0),
    'attack_windup': P(0, 3, dx=2, hand=(-2, 2), ang=8),
    'attack_strike': P(1, -1, dx=-1, hand=(-6, 1), ang=4),
    'attack_follow': P(2, -4, spread=2, dx=-2, hand=(-7, 5), ang=335),
    'hit': P(1, 3, dx=3, hand=(-1, 5), ang=84),
    'defend': P(1, -1, crouch=3, dx=1, hand=(-6, 1), ang=48),
    'victory': P(1, 0, dy=-1, hand=(-5, -10), ang=90),
    'victory_b': P(1, -1, dy=-3, hand=(-8, -10), ang=72, hand2=(6, -9)),
    'item': P(1, 0, hand=(-7, -2), ang=90),
    'weak': P(1, -1, crouch=5, hand=(-4, 6), ang=98),
    'evade': P(0, 3, dx=6, hand=(1, 4), ang=104),
    'guard_hit': P(1, 1, crouch=3, dx=3, hand=(-6, 1), ang=48),
    'skill': P(2, -2, spread=2, dx=-1, hand=(-6, -10), ang=62),
    'dying': P(1, 3, crouch=4, dx=2, hand=(2, 6), ang=110),
    'revive': P(1, 0, crouch=3, hand=(-4, 6), ang=100),
    'cast_charge': P(1, 0, hand=(-4, 1), ang=90),
    'cast_raise': P(1, 0, hand=(-2, -12), ang=98),
    'cast_release': P(2, -2, dx=-2, hand=(-9, -1), ang=15),
}
# 손에 쥐는 작은 물건(카드·주사위·구슬·지팡이 대신 완드·홀·자루·지팡이 손잡이)
SMALL = {
    'idle': P(1, 0, hand=(-5, 5), ang=25),
    'walk_a': P(0, 0, hand=(-5, 5), ang=20), 'walk_b': P(1, 0, hand=(-5, 5), ang=25), 'walk_c': P(2, 0, hand=(-5, 4), ang=30),
    'attack': P(2, -3, spread=2, dx=-2, hand=(-8, -1), ang=0),
    'attack_windup': P(0, 3, dx=2, hand=(4, -9), ang=100),
    'attack_strike': P(1, -1, dx=-1, hand=(-6, -8), ang=20),
    'attack_follow': P(2, -4, spread=2, dx=-2, hand=(-8, 4), ang=340),
    'hit': P(1, 3, dx=3, hand=(-2, 7), ang=70),
    'defend': P(1, -1, crouch=3, dx=1, hand=(-6, -2), ang=70, hand2=(-5, 1)),
    'victory': P(1, 0, dy=-1, hand=(-4, -11), ang=88),
    'victory_b': P(1, -1, dy=-3, hand=(-8, -9), ang=68, hand2=(6, -9)),
    'item': P(1, 0, hand=(-7, -2), ang=90),
    'weak': P(1, -1, crouch=5, hand=(-3, 8), ang=250),
    'evade': P(0, 3, dx=6, hand=(1, 5), ang=100),
    'guard_hit': P(1, 1, crouch=3, dx=3, hand=(-6, -2), ang=70, hand2=(-5, 1)),
    'skill': P(2, -2, spread=2, dx=-1, hand=(-7, -9), ang=50),
    'dying': P(1, 3, crouch=4, dx=2, hand=(2, 8), ang=240),
    'revive': P(1, 0, crouch=3, hand=(-3, 8), ang=255),
    'cast_charge': P(1, 0, hand=(-4, 1), ang=80),
    'cast_raise': P(1, 0, hand=(-2, -13), ang=96),
    'cast_release': P(2, -2, dx=-2, hand=(-9, -1), ang=10),
}
TABLES = {'melee': MELEE, 'pole': POLE, 'small': SMALL}

# 시전 종류 7 × 단계 3 (손 위치·자세). 빛은 종류 색. 첫째 손(무기 손) 기준, hand2 는 다른 손.
CASTP = {
    'fire': [P(1, 2, hand=(3, 2), ang=70, hand2=(2, 4)), P(1, 0, dx=0, hand=(-4, 0), ang=80, hand2=(-3, 2)), P(2, -3, spread=2, dx=-2, hand=(-9, 0), ang=5, hand2=(-8, 2))],
    'ice': [P(1, 0, hand=(-5, 2), ang=60, hand2=(-4, 4)), P(1, 0, hand=(-2, -12), ang=100, hand2=(-3, 10)), P(1, -1, hand=(-3, -13), ang=100, hand2=(-9, 1))],
    'thunder': [P(1, 2, crouch=2, hand=(5, -1), ang=100), P(1, 0, hand=(-1, -14), ang=92), P(2, -3, spread=2, dx=-2, hand=(-8, 6), ang=310)],
    'heal': [P(1, -1, hand=(-3, 1), ang=90, hand2=(-3, 3)), P(1, 0, dy=-1, hand=(-5, -9), ang=90, hand2=(6, -8)), P(1, -2, dx=-1, hand=(-10, 1), ang=15, hand2=(-6, 3))],
    'dark': [P(1, 1, crouch=2, hand=(-4, -6), ang=60), P(1, 3, crouch=1, hand=(8, 1), ang=170), P(2, -3, spread=2, dx=-2, hand=(-10, -1), ang=350, hand2=(-6, -3))],
    'arcane': [P(1, 0, hand=(-4, 2), ang=90), P(1, 0, hand=(-1, -13), ang=100), P(2, -2, dx=-2, hand=(-10, -1), ang=0)],
    'support': [P(1, 0, hand=(-4, -8), ang=80), P(1, -1, hand=(-10, -1), ang=20), P(1, -2, dx=-1, hand=(-6, -7), ang=40, hand2=(-3, 1))],
}
CAST_FX = {'fire': ('rd1', 'or2'), 'ice': ('bl1', 'st3'), 'thunder': ('gd1', 'gd2'), 'heal': ('gr1', 'gr2'),
           'dark': ('pu1', 'pu2'), 'arcane': ('bl1', 'pu2'), 'support': ('rd1', 'rd2')}
WLEN = {'sword': 16, 'rapier': 18, 'scimitar': 15, 'axe': 15, 'spear': 24, 'club': 13, 'mace': 15, 'staff': 26, 'wand': 12,
        'scepter': 13, 'boomerang': 8, 'cards': 6, 'dice': 5, 'orb': 6, 'bag': 6, 'cane': 15, 'bottle': 5, 'harp': 14, 'fan': 7, 'shield': 5}


def burst(im, at, cols=('wh', 'gd2', 'gd1')):
    x, y = at
    pen = Pen(im)
    pen.put(x, y, COL[cols[0]])
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        pen.put(x + dx, y + dy, COL[cols[1]])
    for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3), (-2, -2), (2, 2), (-2, 2), (2, -2)):
        pen.put(x + dx, y + dy, COL[cols[2]])
    pen.flush(outline=False)


def sweep(im, H, r, a0, a1, cols=('st3', 'st2')):
    """궤적 점선(몸 위에는 찍지 않는다)."""
    pen = Pen(im)
    n = 24
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = H[0] - r * math.cos(a), H[1] - r * math.sin(a)
        c = COL[cols[0]] if i > n * .4 else COL[cols[1]]
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < CELL and 0 <= yi < CELL and not im.getpixel((xi, yi))[3] and i % 4 != 3:
            pen.put(x, y, c)
    pen.flush(outline=False)


def spec_defaults(spec):
    spec = dict(spec)
    spec.setdefault('arch', 'melee')
    spec.setdefault('wargs', {})
    spec.setdefault('off', None)
    spec.setdefault('oargs', {})
    spec.setdefault('over', {})
    spec.setdefault('extra', {})
    return spec


def build_pose(body, spec, name, cast=None):
    """name = 포즈 id 또는 cast_<type>_<n>. 반환: 48×48 RGBA."""
    sp = spec
    table = TABLES[sp['arch']]
    if name == 'front':
        return finish(place_front(body))
    if name == 'dead':
        return finish(place_dead(body, sp))
    if cast:
        ct, step = cast
        d = dict(CASTP[ct][step - 1])
        base = table['cast_charge']
        d['ang'] = d['ang'] if sp['arch'] != 'melee' else d['ang']
        d['weapon'] = True
    else:
        d = dict(table[name])
    d.update(sp['over'].get(name, {}))
    if name == 'front':
        return finish(place_front(body))
    if name == 'dead':
        return finish(place_dead(body, sp))
    pose = body.compose(legs=d['legs'], lean=d['lean'], crouch=d['crouch'], spread=d['spread'], dx=d['dx'], dy=d['dy'],
                        upper=1)
    S = pose.S
    kind = sp['weapon']
    lift = 0
    shift = 0
    for _ in range(6):
        if shift:
            pose = body.compose(legs=d['legs'], lean=d['lean'], crouch=d['crouch'], spread=d['spread'], dx=d['dx'] + shift, dy=d['dy'], upper=1)
            S = pose.S
        rig.OOB[0] = rig.OOB[1] = rig.OOB[2] = 0
        im = pose.im.copy()
        H = (S[0] + d['hand'][0], S[1] + d['hand'][1] - lift)
        # 다른 손(방패·쌍검·맨손)
        if d['hand2'] is not None or sp['off']:
            h2 = d['hand2'] or {'shield': (-4, 3)}.get(sp['off'], (-5, 4))
            if sp['off'] == 'shield' and name in ('defend', 'guard_hit'):
                h2 = (-7, 1)
            H2 = (S[0] + h2[0], S[1] + h2[1])
            H2 = draw_arm(body, im, S, H2, bend=1)
            if sp['off']:
                a2 = d['ang2'] if d['ang2'] is not None else (90 if sp['off'] == 'shield' else 90 + (d['ang'] - 90) * 0.6 + 10)
                if sp['off'] == 'shield':
                    weapon_stamp(im, 'shield', (H2[0] - 1, H2[1]), 0, **sp['oargs'])
                else:
                    weapon_stamp(im, sp['off'], H2, a2, **sp['oargs'])
            draw_fist(body, im, H2)
        if name == 'item':
            Hh = draw_arm(body, im, S, H, bend=1)
            weapon_stamp(im, 'bottle', Hh, 90)
            draw_fist(body, im, Hh)
        else:
            Hh = draw_arm(body, im, S, H, bend=d['bend'])
            weapon_stamp(im, kind, Hh, d['ang'], **sp['wargs'])
            draw_fist(body, im, Hh)
        if rig.OOB[0] > 0 and shift < 10:
            shift += rig.OOB[0] + 1
            continue
        if rig.OOB[2] > 0 and shift > -10:
            shift -= rig.OOB[2] + 1
            continue
        break
    # 효과: 궤적·섬광·시전 빛
    L = WLEN.get(kind, 12)
    tip = (Hh[0] + dirv(d['ang'])[0] * L, Hh[1] + dirv(d['ang'])[1] * L)
    if cast:
        c0, c1 = CAST_FX[cast[0]]
        glow(im, tip if cast[1] != 1 else (Hh[0] - 2, Hh[1] - 1), COL[c0], 2, COL[c1])
        if cast[1] == 3:
            sparkle(im, (tip[0] - 3, tip[1]), COL[c1], 3)
    elif name in ('attack',) and sp['arch'] in ('melee', 'pole'):
        burst(im, (tip[0] - 3, tip[1]))
    elif name == 'attack_strike' and sp['arch'] == 'melee':
        sweep(im, Hh, L, 128, 20)
    elif name == 'attack_follow' and sp['arch'] == 'melee':
        sweep(im, Hh, L, 40, 320)
    elif name == 'hit':
        pen = Pen(im)
        x, y = pose.head
        for dx, dy in ((-8, -2), (-7, 2), (-9, 6)):
            pen.put(x + dx, y + dy, COL['wh'])
            pen.put(x + dx + 1, y + dy, COL['gd2'])
        pen.flush(outline=False)
    fx = sp['extra'].get(name)
    if fx:
        fx(im, pose, Hh, tip, d)
    return finish(im)


def place_front(body):
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    bb = body.D.getbbox()
    cx = (bb[0] + bb[2]) // 2
    im.alpha_composite(body.D, (CENTER_X - cx, GROUND_Y + 1 - bb[3]))
    return im


def place_dead(body, sp):
    D = body.D
    lying = D.rotate(-90, expand=True)   # 머리 오른쪽
    bb = lying.getbbox()
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    im.alpha_composite(lying, (CENTER_X - (bb[0] + bb[2]) // 2, GROUND_Y + 1 - bb[3]))
    return im


def render_all(chip, spec, sh=None, hip=None, skirt=False, skin=None, sleeve=None):
    spec = spec_defaults(spec)
    body = Body(chip, sh=sh, hip=hip, skirt=skirt, skin=skin, sleeve=sleeve)
    out = {}
    for pid, *_ in POSES:
        out[pid] = build_pose(body, spec, pid)
    for ct, _ in CAST_TYPES:
        for step in (1, 2, 3):
            out[f'cast_{ct}_{step}'] = build_pose(body, spec, f'cast_{ct}_{step}', cast=(ct, step))
    # 공용 시전 칸(cast_charge/raise/release)은 arcane 3단계와 같은 자리
    return out, body


# ── 묶음 실행 ──────────────────────────────────────────────────────────────────────
REVIEW_POSES = ['idle', 'attack_windup', 'attack', 'hit', 'skill', 'cast_release']


def save_chip(chip, frames):
    from cb_lib import SRC_DIR, validate
    target = Path(SRC_DIR) / chip
    target.mkdir(parents=True, exist_ok=True)
    problems = {}
    for name, im in frames.items():
        issues = validate(chip, name, im)
        if issues:
            problems[name] = issues
        assert {c[3] for c in im.getdata()} <= {0, 255}, (chip, name)
        im.save(target / f'{name}.png', optimize=True)
    return problems


def review_board(path, chips, source, poses=REVIEW_POSES, s=4):
    from PIL import ImageDraw
    cw = 48 * s
    W = 96 + cw * len(poses)
    out = Image.new('RGB', (W, 14 + (cw + 2) * len(chips)), (40, 43, 54))
    d = ImageDraw.Draw(out)
    for c, p in enumerate(poses):
        d.text((96 + c * cw + 4, 2), p, fill=(235, 235, 240))
    for r, (chip, label) in enumerate(chips):
        y = 14 + r * (cw + 2)
        d.text((4, y + cw // 2 - 8), label, fill=(235, 235, 240)); d.text((4, y + cw // 2 + 6), chip, fill=(160, 160, 170))
        for c, p in enumerate(poses):
            x = 96 + c * cw
            d.rectangle((x, y, x + cw - 2, y + cw - 1), fill=(56, 60, 74))
            im = source[chip][p].resize((cw, cw), Image.NEAREST)
            out.paste(im, (x, y), im)
            d.line((x, y + 45 * s, x + cw - 2, y + 45 * s), fill=(120, 80, 84))
    out.save(path)


def run_batch(batch, specs, argv):
    """specs: [(chip, label, spec, kwargs)]. --dry 는 .omo/r2w3/<batch>/dry 에만 쓴다."""
    import cb_lib
    from cb_lib import ROOT, SRC_DIR, OUT_DIR, CAST_DIR, build_sheet, build_cast_sheet, board, cast_board
    ev = Path(ROOT) / '.omo/r2w3' / batch
    ev.mkdir(parents=True, exist_ok=True)
    only = [a for a in argv if not a.startswith('--')]
    dry = '--dry' in argv
    frames_all, bad = {}, {}
    for chip, label, spec, kw in specs:
        if only and chip not in only:
            continue
        frames, body = render_all(chip, spec, **kw)
        frames_all[chip] = frames
        if dry:
            d = ev / 'dry' / chip
            d.mkdir(parents=True, exist_ok=True)
            for n, im in frames.items():
                im.save(d / f'{n}.png')
            continue
        prob = save_chip(chip, frames)
        if prob:
            bad[chip] = prob
        os_makedirs = __import__('os').makedirs
        os_makedirs(OUT_DIR, exist_ok=True); os_makedirs(CAST_DIR, exist_ok=True)
        sheet, rep = build_sheet(chip)
        sheet.save(Path(OUT_DIR) / f'{chip}.png', optimize=True)
        board(chip, sheet).save(Path(SRC_DIR) / chip / '_board.png')
        csheet, crep = build_cast_sheet(chip)
        csheet.save(Path(CAST_DIR) / f'{chip}.png', optimize=True)
        cast_board(chip, csheet).save(Path(SRC_DIR) / chip / '_cast_board.png')
        for k, v in list(rep.items()) + list(crep.items()):
            if v:
                bad.setdefault(chip, {})[k] = v
        print(chip, label, 'ok' if chip not in bad else bad[chip], flush=True)
    chips = [(c, l) for c, l, *_ in specs if c in frames_all]
    if chips:
        half = (len(chips) + 3) // 4
        review_board(ev / 'battle_a.png', chips[:4], frames_all)
        if len(chips) > 4:
            review_board(ev / 'battle_b.png', chips[4:], frames_all)
    return frames_all, bad
