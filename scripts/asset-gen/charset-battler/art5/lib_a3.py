"""묶음 a3 Actor 전투 도트 엔진 — r2w1 의 lib_a12.py 사본 (2026-09-29, r2w2).

다른 묶음 파일과 병합이 부딪치지 않게 복사해 쓴다. 격자는 weapons_a3.py.

art4/heroes6.py 의 재생 방식을 역할 표(ROLES)로 일반화한 것이다.
  1. 옛 장비만 뺀 몸(art2/art3 손도트 원본을 repaint_weapons.equipment_pass('clean') 로 재생)을 얻는다.
  2. 직업 표(spec)가 포즈별로 무기 종류·각도·손, 팔 관절 이동, 직업 도트(fx)를 정한다.
  3. weapons.py + weapons_a12.py 격자를 stamp 하고, 그 위에 fx 를 좌표로 찍는다. 이미지 생성·축소·회전·보간 없음.
사용은 a1.py / a2.py 가 한다. 출력 id 는 걷기 칩 id 그대로(actor1-1 ...). actor3-0(마도사 옛 시트)은 절대 쓰지 않는다.
"""
import sys, json, math
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parent
sys.path.insert(0, str(LIB))
sys.path.insert(0, str(LIB / 'art4'))
import weapons_a3  # noqa: F401,E402  (격자 등록이 먼저다)
from PIL import Image, ImageDraw  # noqa: E402
import weapon_sources as sources  # noqa: E402
import repaint_weapons as rw  # noqa: E402
from cb_lib import POSES, CAST_TYPES, SRC_DIR, ROOT, validate  # noqa: E402
from weapons import POSE_ANGLES, PALETTE, SPRITES, stamp, fitting_hand  # noqa: E402
import heroes6 as h6  # noqa: E402
from heroes6 import put, line, arc, glyph, outlined, arm_calls, weapon_head, cast_step, FX  # noqa: E402

C = dict(PALETTE)
UPRIGHT = ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak')
STAFFLIKE = {'staff', 'flask_rod', 'summon_rod', 'fan_a3'}
BOWLIKE = {'bow', 'elf_bow'}
BLADES = {'sword', 'greatsword', 'dagger', 'war_axe', 'musket_a3', 'axe'}
PROTECTED = {'actor3-0'}  # 기본 배우 마도사의 옛 시트: 쓰지 않는다.
PIDS = [p[0] for p in POSES] + [f'cast_{ct}_{n}' for ct, _ in CAST_TYPES for n in (1, 2, 3)]
# 직업 도트 색(알파 255): 직업마다 이 표에서 골라 쓴다.
FX.update({
    'holy': (255, 240, 170, 255), 'red': (236, 70, 80, 255), 'violet': (170, 90, 240, 255), 'shadow': (74, 40, 110, 255),
    'time': (120, 226, 238, 255), 'wind': (200, 232, 255, 255), 'feather': (250, 250, 255, 255),
    'green': (120, 212, 110, 255), 'sea': (70, 160, 230, 255), 'ember': (255, 150, 60, 255), 'bone': (238, 232, 208, 255),
    'steel': (187, 208, 217, 255), 'blood': (200, 30, 50, 255), 'sand': (240, 210, 140, 255), 'pink': (255, 144, 199, 255),
})


def staff_angle(pid, hand):
    if pid.startswith('cast_'):
        return 90 if hand[1] < 28 else 135 if hand[0] >= 24 else 45
    return POSE_ANGLES[pid]


def default_angle(kind, pid, hand):
    """repaint_weapons.angle_for 와 같은 규칙 + 직업 장비 종류."""
    if kind in BOWLIKE:
        return 90 if pid == 'dead' else 0
    if pid == 'dying' and kind in BLADES:
        return 0
    if pid == 'dead':
        return 0
    if kind in STAFFLIKE and pid.startswith('cast_'):
        return staff_angle(pid, hand)
    if pid.startswith('cast_'):
        step = {'charge': 1, 'raise': 2, 'release': 3}.get(pid.split('_')[-1])
        if step is None:
            step = int(pid.split('_')[-1])
        return (45, 90, 45)[step - 1]
    return POSE_ANGLES[pid]


def dot_burst(im, at, keys=('white', 'gold'), r=3):
    x, y = at
    offs = [(0, 0, 0), (-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-r, 0, 0), (0, -r, 0), (0, r, 0), (r, 0, 0)]
    for dx, dy, k in offs:
        put(im, x + dx, y + dy, FX[keys[k]], over=False)


def sparkle(im, at, key, r=2):
    """네 꼭짓점 반짝임(몸 위에는 찍지 않는다)."""
    x, y = at
    put(im, x, y, FX['white'], over=False)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        put(im, x + dx, y + dy, FX[key], over=False)
    for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)):
        put(im, x + dx, y + dy, FX[key], over=False)


def shield_draw(im, center, dead=False):
    x, y = center
    if not dead:
        d = ImageDraw.Draw(im)
        d.line([(26, 34), (28, 36), center], fill=C['D'], width=3)
        d.line([(26, 34), (28, 36), center], fill=C['M'], width=1)
    rw.shield(im, center)


def fx_draw(im, body, fx, ctx):
    kind = fx[0]
    if kind in ('arc', 'streak', 'burst', 'chi', 'dots', 'shuriken'):
        h6.fx_draw(im, body, fx, ctx)
    elif kind == 'sparkle':
        _, at, key = fx
        sparkle(im, at, key)
    elif kind == 'motes':
        _, key, pts = fx
        for p in pts:
            put(im, *p, FX[key], over=False)
    elif kind == 'gloves':
        for (hx, hy) in ctx.get('hands', []):
            glove(im, hx, hy)
    elif kind == 'shield':
        shield_draw(im, fx[1], fx[2] if len(fx) > 2 else False)
    elif kind == 'feathers':
        for (x, y) in fx[1]:
            outlined(im, (x, y), ['.f', 'ff', 'f.'], {'f': FX['feather']})
    elif kind == 'clock':
        cx, cy = fx[1]
        r = fx[2] if len(fx) > 2 else 5
        n = 24
        for i in range(n):
            a = i * 2 * math.pi / n
            put(im, round(cx + math.cos(a) * r), round(cy + math.sin(a) * r), FX['time'], over=False)
        put(im, cx, cy, FX['white'], over=False)
        put(im, cx, cy - 2, FX['white'], over=False)
        put(im, cx + 2, cy, FX['time'], over=False)
    elif kind == 'gunsmoke':
        for i, (x, y) in enumerate(fx[1]):
            put(im, x, y, C['L'], over=False)
            put(im, x - 1, y - 1, C['H'], over=False)
    elif kind == 'call':
        fx[1](im, body, ctx)


def glove(im, hx, hy):
    """복싱 글러브: 손 자리에 붉은 4x4 덩이 + 하이라이트 + 흰 손목 띠."""
    rows = ['.RRR.', 'RrrRR', 'RrRRE', 'RRRRE', '.EEE.']
    pal = {'R': FX['red'], 'r': (255, 150, 150, 255), 'E': (120, 26, 48, 255)}
    for yy, row in enumerate(rows):
        for xx, ch in enumerate(row):
            if ch != '.':
                put(im, hx - 2 + xx, hy - 2 + yy, pal[ch])
    for dx in (-1, 0, 1):
        put(im, hx + 3 - 1 + dx * 0, hy + dx, FX['white'], over=False)


def render(cid, spec):
    """spec: kind(기본 무기), design(pid) -> dict(moves, weapons, fx, legs), 선택 hands_from_arms(bool)."""
    assert cid not in PROTECTED, cid
    records = {}
    with rw.equipment_pass('record', records):
        sources.render(cid)
    for n, pid in enumerate(('cast_charge', 'cast_raise', 'cast_release'), 1):
        records[pid] = records.get(f'cast_arcane_{n}', [])
    if cid in ('actor3-6', 'actor3-7'):
        records['skill'] = records.get('cast_support_3', [])
    designs, positions = {}, {}
    calls = arm_calls(cid) if spec.get('hands_from_arms') else {}
    for pid in PIDS:
        designs[pid] = spec['design'](pid)
        d = designs[pid]
        d.setdefault('moves', {}); d.setdefault('weapons', None); d.setdefault('fx', [])
        if d['moves']:
            positions[pid] = dict(d['moves'])
    for n, pid in enumerate(('cast_charge', 'cast_raise', 'cast_release'), 1):
        if f'cast_arcane_{n}' in positions:
            positions[pid] = positions[f'cast_arcane_{n}']
    g, m, artist = sources.artist(cid)
    patched = []
    if spec.get('no_shield'):
        # 원본 손도트의 방패(연금술사 칩이 옛 전사 설정을 물려받음)를 빼고 직업 장비만 들게 한다.
        # art2 는 Artist.shield, art3 는 self.artist.shield 로 같은 메서드를 부른다.
        seen = set()
        for mod in rw.source_modules():
            for obj in list(vars(mod).values()):
                if isinstance(obj, type):
                    for cls in obj.__mro__:
                        if 'shield' in cls.__dict__ and cls not in seen:
                            seen.add(cls)
                            patched.append((cls, 'shield', cls.__dict__['shield'])); cls.shield = lambda self, *a, **k: None
    kicks = {pid: d['legs'] for pid, d in designs.items() if d.get('legs')}
    if kicks:
        painter = next(c for c in type(artist).__mro__ if 'leg' in c.__dict__)
        leg = painter.__dict__['leg']

        def kick_leg(self, im, hip, knee, foot, *a, _leg=leg, **k):
            sp = kicks.get(sources.CURRENT)
            back = k.get('back', k.get('far', a[0] if a else False))
            if sp and not back:
                knee, foot = sp['front']
            return _leg(self, im, hip, knee, foot, *a, **k)
        patched.append((painter, 'leg', leg)); painter.leg = kick_leg
    try:
        with rw.equipment_pass('clean', {}, positions):
            bodies = sources.render(cid)
    finally:
        for cls, name, fn in reversed(patched):
            setattr(cls, name, fn)
    out, report = {}, {}
    kind = spec['kind']
    for pid in PIDS:
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
        weapons = d['weapons'] if d['weapons'] is not None else ([(kind, None, None)] if kind else [])
        im = body.copy(); placed = []
        for wk, angle, hand in weapons:
            hand = hand or grip
            if pid == 'dead':
                hand = (12, 40) if wk in BOWLIKE else (21, 42)
            if hand is None:
                hand = (32, 36)
            if angle is None:
                angle = default_angle(wk, pid, hand)
            h = fitting_hand(wk, angle, hand)
            if wk in BOWLIKE and pid in ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit'):
                h = (min(h[0], 13), h[1])
            stamp(im, wk, angle, h)
            contact = pid == 'dead' or any(body.getpixel((x, y))[3] for y in range(h[1] - 1, h[1] + 2) for x in range(h[0] - 1, h[0] + 2))
            if not contact:
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
            head = weapon_head([(h[0] + x, h[1] + y, c) for x, y, c in SPRITES[wk, angle % 360].pixels()], (C['H'],))
            if head and 'head' not in report.setdefault('_head', {}).get(pid, ()) and pid not in report['_head']:
                report['_head'][pid] = head
        hands = []
        if spec.get('hands_from_arms'):
            for joints in calls.get(pid, []):
                if joints:
                    p = joints[-1]
                    p = d['moves'].get(tuple(p), tuple(p))
                    if p not in hands:
                        hands.append(p)
        ctx = dict(hand=lambda img, at: artist.hand(img, at), free_hand=None, head=report.get('_head', {}).get(pid), hands=hands,
                   grip=placed[0]['grip'] if placed else None, pid=pid)
        ctx['free_hand'] = (min(20, (grip or (20, 30))[0]), (grip or (20, 30))[1])
        for fx in d['fx']:
            fx_draw(im, body, fx, ctx)
        out[pid] = im
        report[pid] = placed
    report.pop('_head', None)
    return out, report


def save(cid, frames, evidence):
    assert cid not in PROTECTED, cid
    target = Path(SRC_DIR) / cid
    target.mkdir(parents=True, exist_ok=True)
    backup = Path(evidence) / 'before' / cid
    backup.mkdir(parents=True, exist_ok=True)
    for name, im in frames.items():
        src = target / f'{name}.png'
        if not (backup / f'{name}.png').exists() and src.exists():
            Image.open(src).save(backup / f'{name}.png')
        issues = validate(cid, name, im)
        assert not issues, (cid, name, issues)
        assert {c[3] for c in im.getdata()} <= {0, 255}
        im.save(src, optimize=True)


def review_board(path, ids, source_dir, poses, scale=4):
    """확인판: 직업 × 포즈, 가로·세로 1900px 이하로 자동 분할하지 않는다 — 호출자가 poses 를 나눠 준다."""
    cw = 48 * scale
    out = Image.new('RGB', (70 + cw * len(poses), 16 + (cw + 2) * len(ids)), (40, 43, 54))
    d = ImageDraw.Draw(out)
    for c, p in enumerate(poses):
        d.text((70 + c * cw + 4, 2), p, fill=(235, 235, 240))
    for r, cid in enumerate(ids):
        y = 16 + r * (cw + 2)
        d.text((3, y + cw // 2), cid, fill=(235, 235, 240))
        for c, p in enumerate(poses):
            x = 70 + c * cw
            d.rectangle((x, y, x + cw - 2, y + cw - 1), fill=(56, 60, 74))
            f = Path(source_dir) / cid / f'{p}.png'
            if f.exists():
                im = Image.open(f).convert('RGBA').resize((cw, cw), Image.Resampling.NEAREST)
                out.paste(im, (x, y), im)
            d.line((x, y + 45 * scale, x + cw - 2, y + 45 * scale), fill=(120, 80, 84))
    assert out.size[0] <= 1900 and out.size[1] <= 1900, out.size
    out.save(path)
    return out.size


REVIEW_A = ['idle', 'walk_b', 'attack_windup', 'attack_strike', 'attack', 'attack_follow', 'skill']
REVIEW_B = ['victory', 'defend', 'hit', 'item', 'cast_charge', 'cast_raise', 'cast_release', 'dead']


def main(roles, batch, argv):
    ids = [a for a in argv if not a.startswith('--')] or list(roles)
    evidence = Path(ROOT) / '.omo/r2w2' / batch / 'battler'
    evidence.mkdir(parents=True, exist_ok=True)
    dry = '--dry' in argv
    audit = {}
    for cid in ids:
        frames, report = render(cid, roles[cid])
        if dry:
            d = evidence / 'dry' / cid
            d.mkdir(parents=True, exist_ok=True)
            for n, im in frames.items():
                im.save(d / f'{n}.png')
        else:
            save(cid, frames, evidence)
        audit[cid] = dict(role=roles[cid]['key'], weapon=roles[cid]['kind'], frames=len(frames))
        print(cid, roles[cid]['key'], len(frames), 'frames', flush=True)
    src = evidence / 'dry' if dry else Path(SRC_DIR)
    for tag, poses in (('a', REVIEW_A), ('b', REVIEW_B)):
        print(review_board(evidence / f'board_{tag}.png', ids, src, poses, scale=3 if len(poses) > 7 else 4))
    (evidence / 'audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=1) + '\n')
