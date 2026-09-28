"""Joint rig + review output for the humanoid/boss retro2003 monster set.

Every pixel is placed by code on the final grid (polygons, capped strokes, hand-typed
pixel grids). No image source is read except actor1-0, used ONLY on the scale board.
"""
import math, json
from PIL import Image, ImageDraw
from pe_lib import Pen, NAMES, ROOT, BG

def R(q): return (int(round(q[0])), int(round(q[1])))

def ik(a, t, l1, l2, bend=1):
    """Two-bone IK. Returns (joint, end). bend=+1/-1 picks the elbow/knee side."""
    ax, ay = a; tx, ty = t
    dx, dy = tx-ax, ty-ay; d = math.hypot(dx, dy) or 0.001
    d2 = max(abs(l1-l2)+0.01, min(l1+l2-0.01, d))
    base = math.atan2(dy, dx)
    c = (l1*l1+d2*d2-l2*l2)/(2*l1*d2)
    ang = base + bend*math.acos(max(-1.0, min(1.0, c)))
    j = (ax+l1*math.cos(ang), ay+l1*math.sin(ang))
    e = (ax+d2*math.cos(base), ay+d2*math.sin(base))
    return R(j), R(e)

def _stroke(p, pts, w, col):
    c = p.pal[col]
    if w <= 1:
        p.d.line(pts, fill=c); return
    if len(pts) > 1: p.d.line(pts, fill=c, width=w)
    r = (w-1)/2
    for x, y in pts: p.d.ellipse((x-r, y-r, x+r, y+r), fill=c)

def cap(p, pts, w, col, edge='o', lit=None, dark=None, lw=1):
    """Round-ended stroke with 1px outline and directional (top-left) side shading."""
    pts = [R(q) for q in pts]
    if edge: _stroke(p, pts, w+2, edge)
    _stroke(p, pts, w, col)
    if w < 3: return
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx-ax, by-ay)
        if L < 1: continue
        nx, ny = -(by-ay)/L, (bx-ax)/L
        if nx+ny > 0: nx, ny = -nx, -ny          # n points to the lit upper-left side
        ux, uy = (bx-ax)/L, (by-ay)/L
        for k in range(lw):
            off = w//2 - k
            for side, cc in ((1, lit), (-1, dark)):
                if not cc: continue
                ox, oy = nx*off*side, ny*off*side
                # shorten by 1px each end so shading never eats the outline cap
                a2 = (ax+ox+ux, ay+oy+uy); b2 = (bx+ox-ux, by+oy-uy)
                if L < 3: a2 = b2 = ((ax+bx)/2+ox, (ay+by)/2+oy)
                p.d.line([R(a2), R(b2)], fill=p.pal[cc])

def rot_grid(rows, turns=1):
    """Exact 90-degree CCW rotation of a pixel grid (no resampling)."""
    for _ in range(turns % 4):
        w = max(len(r) for r in rows); rows = [r.ljust(w, '.') for r in rows]
        rows = [''.join(rows[j][w-1-i] for j in range(len(rows))) for i in range(w)]
    return rows

def flip_grid(rows): return [r[::-1] for r in rows]

def put(p, x, y, rows):
    p.grid(int(x), int(y), rows)

# ---------------------------------------------------------------- review/QA
CYCLE = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 7, 8]
CYCLE_MS = [200]*8 + [320, 220, 360, 260, 420, 1200]

def _isolated(im):
    a = im.getchannel('A').load(); w, h = im.size; n = 0
    for y in range(h):
        for x in range(w):
            if a[x, y] and not any(0 <= x+dx < w and 0 <= y+dy < h and a[x+dx, y+dy]
                                   for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): n += 1
    return n

def _diff(a, b):
    pa, pb = a.load(), b.load(); w, h = a.size
    return sum(1 for y in range(h) for x in range(w) if pa[x, y] != pb[x, y])

def build(name, cell, colors, draw, flying=False):
    frames = [draw(n).im for n in NAMES]
    sheet = Image.new('RGBA', (cell*3, cell*3))
    for i, im in enumerate(frames): sheet.paste(im, (i%3*cell, i//3*cell))
    out = ROOT/f'public/assets/generated/pixel-enemies/{name}.png'
    qa = ROOT/f'.omo/pixel-enemy-{name}'
    out.parent.mkdir(parents=True, exist_ok=True); qa.mkdir(parents=True, exist_ok=True)
    errors = []
    palette = {c for _, c in sheet.getcolors(cell*cell*9) if c[3]}
    if sheet.size != (cell*3, cell*3): errors.append('size')
    if len(palette) > 16: errors.append(f'colors {len(palette)}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}: errors.append('alpha')
    base = cell-4
    rep = {'name': name, 'cell': cell, 'sheet': list(sheet.size), 'colors': len(palette),
           'alpha': sorted(set(sheet.getchannel('A').tobytes())), 'baseline': base,
           'flying': flying, 'frames': {}}
    for n, im in zip(NAMES, frames):
        box = im.getbbox()
        if not box: errors.append(f'{n} empty'); continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= base+1):
            errors.append(f'{n} bounds {box}')
        grounded = (n == 'dead') or not flying
        if grounded and n != 'move' and box[3] != base+1: errors.append(f'{n} baseline {box[3]-1}')
        if flying and n != 'dead' and box[3] > base-1: errors.append(f'{n} not airborne')
        iso = _isolated(im)
        if iso: errors.append(f'{n} isolated px {iso}')
        rep['frames'][n] = {'bbox': list(box), 'size': [box[2]-box[0], box[3]-box[1]], 'bottom': box[3]-1, 'isolated': iso}
    mind = None
    for i in range(9):
        for j in range(i+1, 9):
            d = _diff(frames[i], frames[j])
            if d == 0: errors.append(f'{NAMES[i]}=={NAMES[j]}')
            if mind is None or d < mind[0]: mind = (d, NAMES[i], NAMES[j])
    rep['min_pair_diff'] = list(mind)
    rep['errors'] = errors
    sheet.save(out)
    with Image.open(out) as saved:
        if saved.convert('RGBA').tobytes() != sheet.tobytes(): errors.append('reload mismatch')
    # preview: 4x, cell borders, names, baseline
    board = Image.new('RGBA', sheet.size, BG); board.alpha_composite(sheet)
    board = board.convert('RGB').resize((cell*12, cell*12), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(board)
    for q in range(0, cell*12, cell*4):
        d.line((q, 0, q, cell*12-1), fill='#586078'); d.line((0, q, cell*12-1, q), fill='#586078')
    for i, n in enumerate(NAMES):
        x, y = i%3*cell*4, i//3*cell*4
        d.text((x+6, y+5), n, fill='#d6cddc')
        d.line((x+2, y+(base+1)*4, x+cell*4-3, y+(base+1)*4), fill='#39465e')
    board.save(qa/'preview.png')
    # cycle.gif: #202840, 2x, idle twice -> windup -> move -> attack -> recover -> hit -> dead
    gif = []
    for i in CYCLE:
        im = Image.new('RGBA', (cell, cell), BG); im.alpha_composite(frames[i])
        gif.append(im.convert('RGB').resize((cell*2, cell*2), Image.Resampling.NEAREST))
    gif[0].save(qa/'cycle.gif', save_all=True, append_images=gif[1:], duration=CYCLE_MS, loop=0, disposal=2, optimize=False)
    with Image.open(qa/'cycle.gif') as g:
        dec = []
        for i in range(g.n_frames):
            g.seek(i); dec.extend([g.convert('RGB').tobytes()]*(g.info['duration']//10))
        exp = []
        for im, ms in zip(gif, CYCLE_MS): exp.extend([im.tobytes()]*(ms//10))
        if dec != exp: errors.append('gif mismatch')
    # scale: actor1-0 (0,0) 48px cell beside idle_a, same 4x, baselines aligned
    actor = Image.open(ROOT/'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
    top = 10; H = cell+top
    sc = Image.new('RGBA', (48+cell+8, H), BG)
    sc.alpha_composite(actor, (0, H-48)); sc.alpha_composite(frames[0], (56, H-cell))
    sc = sc.convert('RGB').resize((sc.width*4, H*4), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(sc)
    d.text((6, 6), 'actor1-0 4x', fill='#d6cddc'); d.text((56*4+6, 6), f'{name} 4x', fill='#d6cddc')
    d.line((0, (H-3)*4, sc.width, (H-3)*4), fill='#8c9d85'); sc.save(qa/'scale.png')
    ab = actor.getbbox(); mb = frames[0].getbbox()
    rep['scale'] = {'actor_body': [ab[2]-ab[0], ab[3]-ab[1]], 'idle_body': [mb[2]-mb[0], mb[3]-mb[1]],
                    'height_ratio': round((mb[3]-mb[1])/(ab[3]-ab[1]), 2)}
    (qa/'validation.json').write_text(json.dumps(rep, indent=2, ensure_ascii=False)+'\n')
    print(f"{name}: {sheet.size[0]}x{sheet.size[1]} colors={len(palette)} alpha={rep['alpha']} "
          f"idle={rep['scale']['idle_body']} ratio={rep['scale']['height_ratio']} "
          f"bottoms={[rep['frames'][n]['bottom'] for n in NAMES if n in rep['frames']]} "
          f"minDiff={mind[0]}({mind[1]}/{mind[2]}) errors={errors or 'none'}")
    if errors: raise SystemExit(1)
    return frames



# ---------------------------------------------------------------- humanoid parts
def limb(p, a, target, l1, l2, w, col, dark=None, lit=None, bend=1, edge='o'):
    """Upper+lower segment with IK; returns the end point actually reached."""
    j, e = ik(a, target, l1, l2, bend)
    cap(p, [a, j, e], w, col, edge=edge, lit=lit, dark=dark)
    return e, j

def boot(p, x, sole, w, h, col, lit=None, toe=2):
    """Right-facing boot/foot block whose outline sits exactly on the sole row."""
    p.poly([(x-w//2, sole-h), (x+w//2, sole-h), (x+w//2+toe, sole-1), (x+w//2+toe, sole), (x-w//2, sole)], col, 'o')
    if lit: p.line([(x-w//2+1, sole-h+1), (x+w//2-1, sole-h+1)], lit)

def leg_to(p, hip, foot, l1, l2, w, col, dark=None, lit=None, bw=4, bh=3, bcol='o', blit=None):
    """Leg that ends in a boot standing on foot=(x, sole)."""
    fx, sole = foot
    bend = -1 if fx >= hip[0] else 1
    e, j = limb(p, hip, (fx, sole-bh), l1, l2, w, col, dark=dark, lit=lit, bend=bend)
    boot(p, e[0], sole, bw, bh, bcol, blit)
    return e, j

