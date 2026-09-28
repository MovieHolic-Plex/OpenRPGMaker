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

    def pt(self, lx, ly):
        x, y = rot(lx, ly, self.tilt)
        return (self.cx + x, self.cy + y)


def draw_frame(spec, name):
    pose = dict(spec['poses'][name])
    if name == 'dead':
        return spec['dead'](spec)
    p = Pen(spec['cell'], spec['pal'])
    R = Rig(spec, pose)
    R.p = p
    feet = pose.get('feet', [(0, 0)] * 4)
    hf = R.pt(*spec['hip_fore'])
    hr = R.pt(*spec['hip_rear'])
    lf, lh = spec['leg_fore'], spec['leg_hind']
    G = R.G
    def leg(hip, fx, lift, l, front, far):
        foot = (hip[0] + fx + (spec['foot_dx_fore'] if front else spec['foot_dx_hind']), G - lift - l[4] - 1)
        base, shade = (spec['far'] if far else spec['near'])
        knee, fp = limb(p, hip, foot, l[0], l[1], front, l[2], l[3], l[4], base, shade, bend=spec.get('bend', 1.0))
        spec['foot'](p, fp, front, far, lift)
    if spec.get('pre'):
        spec['pre'](p, R)
    # 먼 쪽 다리 → 몸 → 가까운 쪽 다리 → 머리
    hfx = (hf[0] - 1.5, hf[1]); hrx = (hr[0] - 1.5, hr[1])
    leg(hfx, feet[0][0], feet[0][1], lf, True, True)
    leg(hrx, feet[1][0], feet[1][1], lh, False, True)
    if spec.get('behind'):
        spec['behind'](p, R)
    mass(p, [(R.pt(a_, b_)[0], R.pt(a_, b_)[1], c_, d_, e_ + R.tilt) for a_, b_, c_, d_, e_ in spec['body']],
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


def build(chip, spec):
    cell = spec['cell']
    frames = []
    for n in NAMES:
        pen = draw_frame(spec, n)
        frames.append(ImageOps.mirror(pen.im))
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
