"""party-pixel — 비인간형 파티원 전투 시트(9칸)용 공용 리그. retro2003 로스터 b1(Animal 8), b2~b5 가 같이 쓴다.

규격(src/assets/pixelEnemySheets.ts 머리 주석과 같다): 셀 cell(48|64) 정사각 3열×3행,
 (0,0)(1,0)(2,0) idle a·b·c / (0,1) windup · (1,1) move · (2,1) attack / (0,2) recover · (1,2) hit · (2,2) dead.
**왼쪽(적 쪽)을 본다.** 그림은 오른쪽을 보는 좌표계에서 그린 뒤 프레임마다 좌우 반전한다
(빛은 오른쪽 위에서 오도록 뒤집어 두어서 반전 뒤에는 왼쪽 위 빛이 된다).
모든 픽셀은 Pillow 프리미티브와 수식으로 찍는다 — 걷기 칩 원본은 색·디자인 기준으로만 본다.

사족보행 리그: 몸통 타원 합집합 + 2관절 다리(IK) + 종별 머리·꼬리 함수. 종 파일이 spec 을 채우고 run(spec) 을 부른다.
산출: public/assets/generated/party-pixel/<chip>.png, 검수: .omo/r2w5/b1/<chip>/ (preview·cycle.gif·scale.png·validation.json).
"""
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts/asset-gen/pixel-enemy'))
from PIL import Image, ImageDraw, ImageOps  # noqa: E402
import beast_lib as B  # noqa: E402
from beast_lib import blob, mass, tube, bez, dot, ipt, polar  # noqa: E402,F401
from pe_lib import Pen, NAMES, BG  # noqa: E402,F401

# 빛: 그리는 좌표계(오른쪽 보기)에서는 오른쪽 위 → 반전 뒤 왼쪽 위.
B.light = lambda dx, dy, size: -(-dx * 0.62 + dy * 0.78) / max(size, 1)

QA = ROOT / '.omo/r2w5/b1'
OUT = ROOT / 'public/assets/generated/party-pixel'


def ax(pt, ang, d, perp=0.0):
    """pt 에서 각도 ang(도, +는 아래) 방향으로 d, 옆으로 perp(+는 몸 아래쪽) 만큼 간 점."""
    a = math.radians(ang)
    return (pt[0] + math.cos(a) * d - math.sin(a) * perp, pt[1] + math.sin(a) * d + math.cos(a) * perp)


def rot(x, y, ang):
    a = math.radians(ang)
    return (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a))


def layer(p, fn, skip=('o',)):
    """fn(tmp) 로 그린 것을, p 에 이미 칠해진 픽셀(윤곽 제외) 위에만 덮는다 — 줄무늬·얼룩·배 무늬용."""
    tmp = Pen(p.im.width, {k: '%02x%02x%02x' % v[:3] for k, v in p.pal.items()})
    fn(tmp)
    skipc = {p.pal[k] for k in skip if k in p.pal}
    w, h = p.im.size
    src, dst = tmp.im.load(), p.im.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] and dst[x, y][3] and dst[x, y] not in skipc:
                dst[x, y] = src[x, y]


def limb(p, hip, foot, l1, l2, front, r0, r1, r2, base, shade, edge='o', bend=1.0):
    """2관절 다리. front=True 면 무릎이 앞, False 면 뒷다리 오금이 뒤."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = math.hypot(dx, dy) or 0.01
    d = min(d, l1 + l2 - 0.2)
    ux, uy = dx / math.hypot(dx, dy or 0.01), dy / math.hypot(dx, dy or 0.01)
    fx, fy = hip[0] + ux * d, hip[1] + uy * d
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0)) * bend
    px, py = -uy, ux   # 아래로 향한 다리면 (-1, 0) = 뒤쪽
    s = -1 if front else 1
    knee = (hip[0] + ux * a + px * h * s, hip[1] + uy * a + py * h * s)
    pts = []
    n1 = max(2, int(l1 * 1.6))
    for i in range(n1):
        t = i / n1
        pts.append((hip[0] + (knee[0] - hip[0]) * t, hip[1] + (knee[1] - hip[1]) * t, r0 + (r1 - r0) * t))
    n2 = max(2, int(l2 * 1.6))
    for i in range(n2 + 1):
        t = i / n2
        pts.append((knee[0] + (fx - knee[0]) * t, knee[1] + (fy - knee[1]) * t, r1 + (r2 - r1) * t))
    tube(p, pts, base, edge, shade)
    return knee, (fx, fy)


class Rig:
    def __init__(self, spec, pose):
        self.spec, self.pose = spec, pose
        c = spec['cell']
        self.cell = c
        self.G = c - 4
        stand = spec['stand']
        self.cx = spec['cx'] + pose.get('dx', 0)
        self.cy = self.G - stand - spec['hip'][1] + pose.get('dy', 0)
        self.tilt = pose.get('tilt', 0)

    flat = 1.0

    def hpt(self, lx, ly):
        """머리 중심: 자세의 hdx/hdy 를 더한 몸 좌표. 쓰러진 자세는 head_abs 로 바닥 위 절대 위치를 준다."""
        ha = self.pose.get('head_abs')
        if ha:
            return (self.cx + ha[0], self.G - ha[1])
        return self.pt(lx + self.pose.get('hdx', 0), ly + self.pose.get('hdy', 0))

    def pt(self, lx, ly):
        x, y = rot(lx, ly * self.flat, self.tilt)
        return (self.cx + x, self.cy + y)


def eye_x(p, ex, ey, c='o'):
    p.line([(ex - 1, ey - 1), (ex + 1, ey + 1)], c)
    p.line([(ex - 1, ey + 1), (ex + 1, ey - 1)], c)


def draw_frame(spec, name):
    if spec.get('draw'):
        return spec['draw'](name)
    pose = dict(spec['poses'][name])
    if name == 'dead':
        return dead_lying(spec)
    return draw_pose(spec, pose)


def dead_lying(spec):
    """쓰러진 자세: 리그를 납작하게(flat) 눌러 배를 바닥에 붙이고, 다리 넷을 바닥 따라 뻣뻣하게 뻗고, 머리는 바닥에 얹는다."""
    d = dict(spec.get('dead_pose', {}))
    fl = d.pop('flat', 0.7)
    pose = dict(dx=d.pop('dx', 0), tilt=d.pop('tilt', 0), tail=d.pop('tail', -25), hang=d.pop('hang', 12), mouth=1, eye='x', flat=fl,
                head_abs=d.pop('head_abs', (10, 5)), out=True)
    bottom = max(ly * fl + b * fl for (lx, ly, a, b, ang) in spec['body'])
    pose['dy'] = spec['stand'] + spec['hip'][1] - bottom
    return draw_pose(spec, pose)


def draw_pose(spec, pose):
    p = Pen(spec['cell'], spec['pal'])
    R = Rig(spec, pose)
    R.p = p
    R.flat = pose.get('flat', 1.0)
    name = pose.get('name')
    feet = pose.get('feet', [(0, 0)] * 4)
    up = pose.get('out')
    hf = R.pt(*spec['hip_fore'])
    hr = R.pt(*spec['hip_rear'])
    if up:
        feet = [(0, -99)] * 4
    lf, lh = spec['leg_fore'], spec['leg_hind']
    G = R.G
    def leg(hip, fx, lift, l, front, far):
        if up:
            L_ = l[0] + l[1]
            sgn = 1 if front else -1
            k_ = spec.get('out_k', 1.0)
            foot = (hip[0] + sgn * L_ * k_ * (0.86 if far else 0.98), hip[1] + (-1.6 if far else 0.6))
            base, shade = (spec['far'] if far else spec['near'])
            knee, fp = limb(p, hip, foot, l[0], l[1], front, l[2], l[3], l[4], base, shade, bend=0.35)
            spec['foot'](p, fp, front, far, 0)
            return
        foot = (hip[0] + fx + (spec['foot_dx_fore'] if front else spec['foot_dx_hind']), G - lift - l[4] - 1)
        base, shade = (spec['far'] if far else spec['near'])
        knee, fp = limb(p, hip, foot, l[0], l[1], front, l[2], l[3], l[4], base, shade, bend=spec.get('bend', 1.0))
        spec['foot'](p, fp, front, far, lift)
        R.fp[(front, far)] = fp
    R.fp = {}
    if spec.get('pre'):
        spec['pre'](p, R)
    # 먼 쪽 다리 → 몸 → 가까운 쪽 다리 → 머리
    hfx = (hf[0] - 1.5, hf[1]); hrx = (hr[0] - 1.5, hr[1])
    leg(hfx, feet[0][0], feet[0][1], lf, True, True)
    leg(hrx, feet[1][0], feet[1][1], lh, False, True)
    if spec.get('behind'):
        spec['behind'](p, R)
    mass(p, [(R.pt(a_, b_)[0], R.pt(a_, b_)[1], c_, d_ * R.flat, e_ + R.tilt) for a_, b_, c_, d_, e_ in spec['body']],
         fn=spec.get('shade', B.shade3), light_c=R.pt(*spec['light_c']), light_r=spec['light_r'])
    if spec.get('body_detail'):
        spec['body_detail'](p, R)
    leg(hf, feet[2][0], feet[2][1], lf, True, False)
    leg(hr, feet[3][0], feet[3][1], lh, False, False)
    spec['head'](p, R)
    if spec.get('post'):
        spec['post'](p, R)
    return p


def lying_base(spec):
    return Pen(spec['cell'], spec['pal'])


def fit(im, cell):
    """칸 안에 안 들어온 프레임은 넘친 만큼만 밀어 넣는다(가로는 1px 여유, 바닥은 cell-4 행까지)."""
    box = im.getbbox()
    if not box:
        return im
    dx = 0
    if box[0] < 1:
        dx = 1 - box[0]
    elif box[2] > cell - 1:
        dx = cell - 1 - box[2]
    dy = 0
    if box[3] > cell - 3:
        dy = (cell - 3) - box[3]
    if not (dx or dy):
        return im
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    return out


def build(chip, spec):
    cell = spec['cell']
    frames = []
    for n in NAMES:
        pen = draw_frame(spec, n)
        frames.append(fit(ImageOps.mirror(pen.im), cell))
    sheet = Image.new('RGBA', (cell * 3, cell * 3))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    palette = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    assert len(palette) <= 16, f'{chip}: {len(palette)} colours'
    assert set(sheet.getchannel('A').tobytes()) == {0, 255}
    report = {'chip': chip, 'cell': cell, 'colours': len(palette), 'frames': {}}
    bad = []
    for n, im in zip(NAMES, frames):
        box = im.getbbox()
        if not (box and box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= cell - 3):
            bad.append((n, box))
        report['frames'][n] = {'bbox': list(box), 'size': [box[2] - box[0], box[3] - box[1]]}
    # 인접 idle 칸이 달라야 한다
    for a, b in ((0, 1), (1, 2), (0, 2)):
        assert frames[a].tobytes() != frames[b].tobytes(), f'{chip}: idle {a}/{b} identical'
    OUT.mkdir(parents=True, exist_ok=True)
    (QA / chip).mkdir(parents=True, exist_ok=True)
    out = OUT / f'{chip}.png'
    sheet.save(out)
    with Image.open(out) as s:
        assert s.tobytes() == sheet.tobytes()
    # 검수판: 4배, 칸마다 라벨과 바닥선
    z = 4 if cell == 48 else 3
    board = Image.new('RGBA', sheet.size, BG)
    board.alpha_composite(sheet)
    board = board.convert('RGB').resize((cell * 3 * z, cell * 3 * z), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(board)
    for i, n in enumerate(NAMES):
        x, y = i % 3 * cell * z, i // 3 * cell * z
        d.text((x + 6, y + 6), n, fill='#d6cddc')
        d.line((x + 4, y + (cell - 3) * z, x + cell * z - 5, y + (cell - 3) * z), fill='#39465e')
        d.rectangle((x, y, x + cell * z - 1, y + cell * z - 1), outline='#586078')
    board.save(QA / chip / 'preview.png')
    seq = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 0, 7, 0, 8]
    ms = [180] * 8 + [300, 240, 300, 240, 400, 300, 400, 1100]
    gifs = []
    for i in seq:
        im = Image.new('RGBA', (cell, cell), BG)
        im.alpha_composite(frames[i])
        gifs.append(im.convert('RGB').resize((cell * 4, cell * 4), Image.Resampling.NEAREST))
    gifs[0].save(QA / chip / 'cycle.gif', save_all=True, append_images=gifs[1:], duration=ms, loop=0, disposal=2)
    (QA / chip / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(chip, 'colours', len(palette), 'idle', report['frames']['idle_a']['size'])
    if bad:
        print('BBOX VIOLATION', bad)
        sys.exit(1)
    return sheet, frames


def run(chip, spec):
    build(chip, spec)


def std_head(p, R, c):
    """공용 머리. c: rest(lx,ly) skull(a,b) tk(몸 기울기 따라가는 비율)
    ears[(far, d, perp, dir_deg, length, halfwidth, key, inner)] muzzle(d, perp, a, b, keys) nose(d, perp, key, w)
    eye(d, perp, key) jaw(d, perp, a, b, keys) tongue key, before(fn) / after(fn) 는 (p, R, hc, ang)."""
    pose = R.pose
    hc = R.hpt(*c['rest'])
    ang = pose.get('hang', 0) + R.tilt * c.get('tk', 0.5)
    mouth = pose.get('mouth', 0)
    eye = pose.get('eye', 'o')
    if c.get('before'):
        c['before'](p, R, hc, ang)
    back = pose.get('ears', 0)
    for far, d, perp, dr, ln, hw, key, inner in sorted(c.get('ears', []), key=lambda e: not e[0]):
        base = ax(hc, ang, d, perp)
        tip = ax(base, ang + (dr if not back else 196), ln, 0)
        p.poly([ipt(ax(base, ang, 0, -hw)), ipt(tip), ipt(ax(base, ang, 0, hw))], key, 'o')
        if inner and not far and ln > 4:
            ti = ax(base, ang + (dr if not back else 196), ln * 0.62, 0)
            p.poly([ipt(ax(base, ang, 0.3, -hw * 0.5)), ipt(ti), ipt(ax(base, ang, 0.3, hw * 0.5))], inner)
    sa, sb = c['skull']
    blob(p, hc[0], hc[1], sa, sb, ang)
    if c.get('muzzle'):
        d, perp, a, b, keys = c['muzzle']
        mz = ax(hc, ang, d, perp)
        blob(p, mz[0], mz[1], a, b, ang, keys=keys)
    if mouth and c.get('jaw'):
        d, perp, a, b, keys = c['jaw']
        jaw = ax(hc, ang + 12 + 6 * (mouth - 1), d, perp)
        blob(p, jaw[0], jaw[1], a, b, ang + 12 + 6 * (mouth - 1), keys=keys)
        m0 = ax(hc, ang, d - a * 0.6, perp - b * 0.9)
        p.line([ipt(m0), ipt(ax(m0, ang + 8, a * 1.7, 0.3))], 'o')
        if c.get('tongue'):
            tg = ax(hc, ang + 20, d + a * 0.4, perp + b * 0.9)
            p.box((int(tg[0]) - 1, int(tg[1]), int(tg[0]) + 1, int(tg[1]) + 1), c['tongue'])
        if c.get('fang') and mouth > 1:
            for k in (0.3, 0.75):
                f0 = ax(hc, ang, d - a * 0.6 + a * 1.5 * k, perp - b * 0.7)
                p.line([ipt(f0), ipt((f0[0], f0[1] + 2))], c['fang'])
    if c.get('nose'):
        d, perp, key, w = c['nose']
        n = ax(hc, ang, d, perp)
        x, y = int(round(n[0])), int(round(n[1]))
        p.box((x - w + 1, y - 1, x, y), key)
    d, perp, key = c['eye']
    ey = ax(hc, ang, d, perp)
    ex, eyy = ipt(ey)
    if eye == 'x':
        eye_x(p, ex, eyy, c.get('eyec', 'o'))
    elif eye == 'c':
        p.line([(ex - 1, eyy + 1), (ex + 1, eyy + 1)], c.get('eyec', 'o'))
    else:
        p.box((ex, eyy, ex + 1, eyy + 1), c.get('eyec', 'o'))
        if c.get('eyehi'):
            dot(p, ex, eyy, c['eyehi'])
        if eye == 'a' or pose.get('angry'):
            p.line([(ex - 2, eyy - 2), (ex + 2, eyy - 1)], 'o')
    if c.get('after'):
        c['after'](p, R, hc, ang)
    return hc, ang


# ---- 공용 자세표(48 셀 강아지 기준 px; 종 파일이 덮어쓴다) ----
def default_poses():
    return {
        'idle_a':  dict(dy=0, tilt=0, hdx=0, hdy=0, hang=0, tail=0, feet=[(2, 0), (-1, 0), (-2, 0), (1, 0)]),
        'idle_b':  dict(dy=0, tilt=0, hdx=0, hdy=1, hang=4, tail=14, feet=[(2, 0), (-1, 0), (-2, 0), (1, 0)]),
        'idle_c':  dict(dy=1, tilt=0, hdx=0, hdy=1, hang=6, tail=-6, feet=[(2, 0), (-1, 0), (-2, 0), (1, 0)]),
        'windup':  dict(dx=-3, dy=2, tilt=5, hdx=-2, hdy=2, hang=14, tail=30, feet=[(4, 0), (-5, 0), (2, 0), (-3, 0)], mouth=0),
        'move':    dict(dx=1, dy=-5, tilt=-4, hdx=3, hdy=-1, hang=-6, tail=-20, feet=[(8, 3), (-8, 3), (5, 5), (-5, 5)], mouth=1),
        'attack':  dict(dx=4, dy=0, tilt=4, hdx=4, hdy=1, hang=10, tail=-30, feet=[(6, 0), (-4, 0), (3, 0), (-1, 0)], mouth=2),
        'recover': dict(dx=-2, dy=0, tilt=-2, hdx=-1, hdy=-1, hang=-4, tail=10, feet=[(4, 0), (-2, 0), (0, 0), (-4, 1)], mouth=0),
        'hit':     dict(dx=-3, dy=-1, tilt=-7, hdx=-3, hdy=-2, hang=-14, tail=40, feet=[(-1, 0), (-4, 0), (1, 1), (-5, 2)], mouth=2, eye='c'),
        'dead':    dict(),
    }
