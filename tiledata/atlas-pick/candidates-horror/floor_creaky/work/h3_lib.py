"""h3 도우미 — 글자 격자 → pxgrid (@mat + @mblock + @tblock). 손으로 정한 칸 데이터를 옮겨 적는 표기 도구일 뿐(보간·난수 없음)."""
import os, subprocess, sys
MAT = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
TONES = '0123456789abcde'
SINGLE = '~-%?$^"*&+!'
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
CAND = ROOT + '/tiledata/atlas-pick/candidates-horror'

class G:
    def __init__(s, w, h, fill='.'):
        s.w, s.H = w, h; s.g = [[fill] * w for _ in range(h)]
    def put(s, x, y, c, wrap=False):
        if wrap: x %= s.w; y %= s.H
        if 0 <= x < s.w and 0 <= y < s.H: s.g[y][x] = c
    def get(s, x, y): return s.g[y % s.H][x % s.w]
    def pts(s, c, *xy):
        for i in range(0, len(xy), 2): s.put(xy[i], xy[i + 1], c)
    def row(s, x, y, txt, wrap=False):
        for i, c in enumerate(txt):
            if c != ' ': s.put(x + i, y, c, wrap)
    def block(s, x, y, lines, wrap=False):
        for j, t in enumerate(lines): s.row(x, y + j, t, wrap)
    def h(s, x0, x1, y, c, wrap=False):
        for x in range(x0, x1 + 1): s.put(x, y, c, wrap)
    def v(s, x, y0, y1, c, wrap=False):
        for y in range(y0, y1 + 1): s.put(x, y, c, wrap)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1): s.h(x0, x1, y, c)
    def rows(s): return [''.join(r) for r in s.g]
    def copy(s):
        n = G(s.w, s.H); n.g = [r[:] for r in s.g]; return n

def emit(rows, legend, title=''):
    H = len(rows); W = len(rows[0])
    assert all(len(r) == W for r in rows), [len(r) for r in rows]
    ramps = sorted({v[0] for v in legend.values()})
    mat = {r: MAT[i] for i, r in enumerate(ramps)}
    out = [f'// {title}', f'@size {W} {H}', '@cell 16', '@palette palette.pal', '@layer main']
    out += [f'@mat {mat[r]} {r} 0' for r in ramps]
    mb, tb, sb = [], [], []
    for r in rows:
        m = t = s = ''
        for ch in r:
            if ch in legend:
                rp, tone = legend[ch]; m += mat[rp]; t += TONES[tone]; s += '.'
            elif ch in SINGLE:
                m += '.'; t += '.'; s += ch
            else:
                assert ch == '.', f'범례에 없는 글자 {ch!r}'
                m += '.'; t += '.'; s += '.'
        mb.append(m); tb.append(t); sb.append(s)
    out += ['@mblock 0 0'] + mb + ['@tblock 0 0'] + tb
    if any(set(x) - {'.'} for x in sb):
        out += ['@layer shadow', '@block 0 0'] + sb
    return '\n'.join(out) + '\n'

def save(slug, dirn, g, legend, note):
    """g: G, dirn 'A'|'B'|'C' → h3-X.pxg + .note"""
    p = f'{CAND}/{slug}/h3-{dirn}'
    open(p + '.pxg', 'w').write(emit(g.rows(), legend, f'{slug} h3-{dirn}'))
    open(p + '.note', 'w').write(note.strip() + '\n')
    return p + '.pxg'

def check(slug, dirn):
    p = f'{CAND}/{slug}/h3-{dirn}.pxg'
    r = subprocess.run(['python3', ROOT + '/scripts/content/atlas-pick/horror_check.py', p], capture_output=True, text=True, cwd=ROOT)
    r2 = subprocess.run(['python3', ROOT + '/scripts/content/atlas-pick/horror_context.py', p], capture_output=True, text=True, cwd=ROOT)
    print(r.stdout.strip(), r.stderr.strip()[-300:]); 
    if r2.returncode: print('ctx', r2.stdout[-200:], r2.stderr[-300:])

def sheet(slug, dirs='ABC', scale=10, name='sheet.png'):
    """후보 나란히(자기 확인용, work/ 에 저장)"""
    from PIL import Image
    ims = []
    for d in dirs:
        f = f'{CAND}/{slug}/h3-{d}.png'
        if os.path.exists(f): ims.append(Image.open(f).convert('RGBA'))
    W = sum(i.width * scale + 12 for i in ims); H = max(i.height for i in ims) * scale
    out = Image.new('RGBA', (W, H), (40, 40, 48, 255)); x = 0
    for i in ims:
        b = i.resize((i.width * scale, i.height * scale), Image.NEAREST); out.paste(b, (x, 0), b); x += b.width + 12
    out.save(f'{CAND}/{slug}/work/{name}')
