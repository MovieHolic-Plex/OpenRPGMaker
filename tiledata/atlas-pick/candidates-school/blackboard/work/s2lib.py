"""s2 작업자 도우미: 글자 캔버스 + 범례 -> pxgrid(.pxg). 형식만 옮겨 적는다(보간·난수 없음).
 '.'=투명, '~ - % &' = 반투명 겹(투명 칸 위에만 놓는다)."""
import sys, os, subprocess
MAT = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
TONES = '0123456789abcde'
SINGLE = '~-%&'
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'

class C:
    def __init__(s, W, H, fill='.'):
        s.W, s.H = W, H; s.g = [[fill] * W for _ in range(H)]
    def put(s, x, y, ch):
        if 0 <= x < s.W and 0 <= y < s.H: s.g[y][x] = ch
    def get(s, x, y): return s.g[y][x]
    def rect(s, x, y, w, h, ch):
        for j in range(y, y + h):
            for i in range(x, x + w): s.put(i, j, ch)
    def hl(s, x, y, w, ch): s.rect(x, y, w, 1, ch)
    def vl(s, x, y, h, ch): s.rect(x, y, 1, h, ch)
    def blit(s, x, y, rows, skip=' '):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != skip: s.put(x + i, y + j, ch)
    def rows(s): return [''.join(r) for r in s.g]
    def sub(s, x, y, w, h): return [''.join(s.g[j][x:x + w]) for j in range(y, y + h)]

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

def save(slug, tag, c, legend, note, title=None):
    d = f'{ROOT}/tiledata/atlas-pick/candidates-school/{slug}'
    os.makedirs(d + '/work', exist_ok=True)
    p = f'{d}/s2-{tag}.pxg'
    open(p, 'w').write(emit(c.rows(), legend, title or f'{slug} s2-{tag}'))
    open(f'{d}/s2-{tag}.note', 'w').write(note + '\n')
    return p

def check(paths):
    for p in paths:
        r = subprocess.run(['python3', f'{ROOT}/scripts/content/atlas-pick/check_candidate.py', p], cwd=ROOT, capture_output=True, text=True)
        print((r.stdout + r.stderr).strip()[-700:])
