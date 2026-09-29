"""party-pixel 몬스터형 파티원 9칸 시트 공용 리그 — retro2003 로스터 b3(Monster1)·b5(Monster3).

규격은 pixelEnemySheets.ts 머리 주석과 같다(셀 48|64, 3열×3행 idle a·b·c / windup move attack / recover hit dead, 바닥 기준선 cell-4).
**왼쪽(적 쪽)을 본다.** 종 파일은 오른쪽을 보는 좌표계(앞 = +x)에서 그리고 build 가 칸마다 좌우 반전한다.
빛은 그리는 좌표계에서 오른쪽 위 → 반전 뒤 왼쪽 위. 모든 픽셀은 Pillow 프리미티브·수식으로 찍는다(걷기 칩은 색·디자인 기준으로만 본다).

  humanoid(p, n, S)  두 다리 사람형: 다리 IK·몸통 타원·머리·먼 팔/가까운 팔·무기 콜백. 자세는 BASE 표 + S['poses'] 덮어쓰기.
  lying(...)         쓰러짐 칸을 대기 칸의 정확한 90° 회전으로 만든다(선택).
  build(chip, batch, cell, pal, draw)  시트·검사(크기·알파 0/255·≤16색·빈 칸·칸끼리 다름·외톨이 픽셀)·검수판.
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
from beast_lib import blob, mass, tube, bez, dot, ipt  # noqa: E402,F401
from pe_lib import Pen, NAMES, BG  # noqa: E402,F401
from pe_rig import cap, ik  # noqa: E402,F401

B.light = lambda dx, dy, size: -(-dx * 0.62 + dy * 0.78) / max(size, 1)
OUT = ROOT / 'public/assets/generated/party-pixel'

# 각도: 도, 0 = 앞(오른쪽), 90 = 아래, -90 = 위. arm/farm = 가까운/먼 팔 방향, wpn = 무기 날 방향.
BASE = {
    'idle_a': dict(dx=0, dy=0, lean=0, arm=80, farm=95, wpn=-70, step=0, crouch=0, hdy=0, eye='o', mouth=0, fly=0),
    'idle_b': dict(dy=1, arm=84, farm=99, wpn=-66, fly=1),
    'idle_c': dict(dy=1, crouch=1, arm=88, farm=102, wpn=-62, fly=2),
    'windup': dict(dx=-2, lean=-2, arm=-130, farm=140, wpn=-165, crouch=1, fly=-2),
    'move': dict(dx=2, lean=2, arm=60, farm=125, wpn=-40, step=1, fly=-1),
    'attack': dict(dx=4, lean=3, arm=8, farm=150, wpn=25, step=1, mouth=1, fly=1),
    'recover': dict(dx=1, lean=1, arm=55, farm=112, wpn=75, crouch=1, fly=0),
    'hit': dict(dx=-3, lean=-3, arm=140, farm=205, wpn=-120, eye='x', mouth=1, fly=-1),
    'dead': dict(),
}


def pose(n, S=None):
    P = dict(BASE['idle_a'])
    P.update(BASE[n])
    if S:
        P.update(S.get('poses', {}).get(n, {}))
    P['name'] = n
    return P


def at(pt, deg, ln):
    a = math.radians(deg)
    return (pt[0] + math.cos(a) * ln, pt[1] + math.sin(a) * ln)


def arm(p, a, hand, ln, w, col, bend=1, fist=None):
    j, e = ik(a, hand, ln / 2 + .6, ln / 2 + .6, bend)
    cap(p, [a, j, e], w, col)
    if fist:
        x, y = ipt(e)
        p.box((x - 1, y - 1, x + 1, y + 1), 'o')
        p.box((x, y - 1, x + 1, y), fist)
    return e


def leg(p, hip, foot, L, w, col, boot):
    fx, G = foot
    ank = (fx, G - 2)
    bend = -1 if fx >= hip[0] else 1
    j, e = ik(hip, ank, L / 2 + .8, L / 2 + .8, bend)
    cap(p, [hip, j, e], w, col)
    x = int(round(e[0]))
    p.box((x - 2, G - 2, x + 3, G), 'o')
    p.box((x - 1, G - 2, x + 2, G - 1), boot)


def humanoid(p, n, S):
    P = pose(n, S)
    c = S['cell']
    G = c - 4
    cx = S.get('cx', c // 2) + P['dx']
    L, T = S['leg'], S['torso']
    hip = (cx, G - L + P['crouch'] - S.get('lift', 0) - (P['fly'] if S.get('flying') else 0))
    sh = (cx + P['lean'], hip[1] - T + P['dy'])
    st = P['step']
    J = dict(P=P, hip=hip, sh=sh, G=G, cx=cx, n=n)
    ff, fn_ = (cx - 2 - st * 3, G - S.get('lift', 0)), (cx + 2 + st * 3, G - S.get('lift', 0))
    if S.get('flying'):
        ff = (ff[0] - 1, hip[1] + L - 1)
        fn_ = (fn_[0] - 1, hip[1] + L)
    J['feet'] = (ff, fn_)
    if S.get('back'):
        S['back'](p, J)
    fsh = (sh[0] - 2, sh[1] + 1)
    J['fhand'] = arm(p, fsh, at(fsh, P['farm'], S['arm']), S['arm'], S['aw'], S['farc'], fist=S.get('ffist'))
    if L > 0:
        leg(p, (hip[0] - 1, hip[1]), ff, L, S['lw'], S['legfar'], S['boot_far'])
        leg(p, (hip[0] + 1, hip[1]), fn_, L, S['lw'], S['legc'], S['boot'])
    S['torso'](p, J) if callable(S.get('torso')) else None
    S['body'](p, J)
    hx, hy = sh[0] + S.get('neck', 1), sh[1] - S['hr'] + P['hdy'] + 1
    J['head'] = (hx, hy)
    S['head'](p, hx, hy, J)
    nsh = (sh[0] + 1, sh[1] + 1)
    J['nsh'] = nsh
    target = at(nsh, P['arm'], S['arm'])
    if S.get('weapon_back'):
        S['weapon_back'](p, target, P['wpn'], J)
    hand = arm(p, nsh, target, S['arm'], S['aw'], S['armc'])
    J['hand'] = hand
    if S.get('weapon'):
        S['weapon'](p, hand, P['wpn'], J)
    x, y = ipt(hand)
    p.box((x - 1, y - 1, x + 1, y + 1), 'o')
    p.box((x, y - 1, x + 1, y), S.get('fist', S['armc']))
    if S.get('front'):
        S['front'](p, J)
    return J


def torso_mass(p, J, tw, keys, extra=()):
    hip, sh = J['hip'], J['sh']
    mx, my = (hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2
    ang = math.degrees(math.atan2(sh[0] - hip[0], hip[1] - sh[1]))
    hh = (hip[1] - sh[1]) / 2 + 1.5
    parts = [(mx, my, tw, hh, ang)] + [(mx + a, my + b, w, h, ang) for a, b, w, h in extra]
    mass(p, parts, keys=keys)
    return mx, my, ang


def eyes(p, x, y, kind, col='o', hi=None):
    """오른쪽 보는 눈 한 개(측면). kind 'o' 뜸, 'x' 질끈."""
    if kind == 'x':
        p.line([(x - 1, y - 1), (x + 1, y + 1)], 'o')
        p.line([(x - 1, y + 1), (x + 1, y - 1)], 'o')
        return
    p.box((x, y - 1, x + 1, y), col)
    if hi:
        dot(p, x + 1, y - 1, hi)


def fit(im, cell, ground=False):
    box = im.getbbox()
    if not box:
        return im
    dx = 1 - box[0] if box[0] < 1 else (cell - 1 - box[2] if box[2] > cell - 1 else 0)
    dy = (cell - 3) - box[3] if (box[3] > cell - 3 or ground) else 0
    if not (dx or dy):
        return im
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    return out


def lying(im, cell):
    """대기 칸을 정확히 90° 돌려 뒤로 쓰러진 모양(반전 전 좌표: 머리가 뒤)."""
    r = im.transpose(Image.Transpose.ROTATE_90)
    box = r.getbbox()
    out = Image.new('RGBA', r.size)
    w = box[2] - box[0]
    out.paste(r.crop(box), ((cell - w) // 2, cell - 3 - (box[3] - box[1])))
    return out


def _isolated(im):
    a = im.getchannel('A').load()
    w, h = im.size
    kill = []
    for y in range(h):
        for x in range(w):
            if a[x, y] and not any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                kill.append((x, y))
    return kill


def build(chip, batch, cell, pal, draw, dead_lying=False, ground=True):
    qa = ROOT / f'.omo/r2w5/{batch}/{chip}'
    frames = []
    for n in NAMES:
        p = Pen(cell, pal)
        draw(p, n)
        for q in _isolated(p.im):
            p.im.putpixel(q, (0, 0, 0, 0))
        frames.append(p.im)
    if dead_lying:
        frames[8] = lying(frames[0], cell)
    frames = [fit(ImageOps.mirror(im), cell, ground=ground and n in ('idle_a', 'idle_b', 'idle_c', 'windup', 'recover', 'hit', 'dead')) for im, n in zip(frames, NAMES)]
    sheet = Image.new('RGBA', (cell * 3, cell * 3))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    errs = []
    palette = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    if len(palette) > 16:
        errs.append(f'colours {len(palette)}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errs.append('alpha')
    rep = {'chip': chip, 'cell': cell, 'colours': len(palette), 'frames': {}}
    for n, im in zip(NAMES, frames):
        box = im.getbbox()
        if not box:
            errs.append(f'{n} empty')
            continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= cell - 3):
            errs.append(f'{n} bounds {box}')
        rep['frames'][n] = {'bbox': list(box), 'size': [box[2] - box[0], box[3] - box[1]]}
    for i in range(9):
        for j in range(i + 1, 9):
            if frames[i].tobytes() == frames[j].tobytes():
                errs.append(f'{NAMES[i]}=={NAMES[j]}')
    OUT.mkdir(parents=True, exist_ok=True)
    qa.mkdir(parents=True, exist_ok=True)
    out = OUT / f'{chip}.png'
    sheet.save(out)
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
    board.save(qa / 'preview.png')
    seq = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 0, 7, 0, 8]
    ms = [180] * 8 + [300, 240, 300, 240, 400, 300, 400, 1100]
    gifs = []
    for i in seq:
        im = Image.new('RGBA', (cell, cell), BG)
        im.alpha_composite(frames[i])
        gifs.append(im.convert('RGB').resize((cell * 4, cell * 4), Image.Resampling.NEAREST))
    gifs[0].save(qa / 'cycle.gif', save_all=True, append_images=gifs[1:], duration=ms, loop=0, disposal=2)
    rep['errors'] = errs
    (qa / 'validation.json').write_text(json.dumps(rep, indent=2) + '\n')
    print(chip, cell, 'colours', len(palette), 'idle', rep['frames'].get('idle_a', {}).get('size'), 'errors', errs or 'none')
    if errs:
        sys.exit(1)
    return frames

