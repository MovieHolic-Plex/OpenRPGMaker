"""h2 작도 도우미: 캔버스에 (램프,단)을 놓고 pxg 로 내보낸다. 도형 채우기 헬퍼는 내 작도 편의일 뿐, 색은 전부 내가 정한다."""
import os, math
POOL = list('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
LIT = set('~-%?^"*&+!$')
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror'

class C:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [[None] * w for _ in range(h)]
    def px(s, x, y, c):
        """c = (ramp,tier) 또는 반투명 글자 또는 None(지움)"""
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = c
    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def hl(s, x0, x1, y, c):
        for x in range(x0, x1 + 1): s.px(x, y, c)
    def vl(s, x, y0, y1, c):
        for y in range(y0, y1 + 1): s.px(x, y, c)
    def line(s, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
        while True:
            s.px(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; x0 += sx
            if e2 <= dx: e += dx; y0 += sy
    def ell(s, cx, cy, rx, ry, c, only_empty=False):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    if not only_empty or s.get(x, y) is None: s.px(x, y, c)
    def art(s, x0, y0, rows, leg):
        """rows: 문자열 줄들. '.'=건드리지 않음, leg[ch]=(램프,단)|반투명글자|None(지움)"""
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == '.': continue
                if ch in leg: s.px(x0 + i, y0 + j, leg[ch])
                elif ch in LIT: s.px(x0 + i, y0 + j, ch)
                else: raise SystemExit(f'art: legend 에 없는 글자 {ch!r} ({i},{j})')
    def outline(s, c_fn, only=None):
        """불투명 칸의 바깥 이웃(빈칸)에 c 를 놓는다(윗·왼쪽은 c_fn('ul'), 아래·오른쪽은 c_fn('dr') 로 다른 색 가능)"""
        add = []
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] is None:
                    for dx, dy, k in ((-1, 0, 'ul'), (0, -1, 'ul'), (1, 0, 'dr'), (0, 1, 'dr')):
                        n = s.get(x + dx, y + dy)
                        if n is not None and not isinstance(n, str):
                            add.append((x, y, c_fn(n, k))); break
        for x, y, c in add: s.px(x, y, c)
    def save(s, slug, name, note, tile=False):
        used = {}
        letter = {}
        rows = []
        for y in range(s.h):
            r = ''
            for x in range(s.w):
                c = s.g[y][x]
                if c is None: r += '.'
                elif isinstance(c, str): r += c
                else:
                    if c not in letter:
                        letter[c] = POOL[len(letter)]
                    r += letter[c]
            rows.append(r)
        out = [f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal']
        for (rp, t), l in letter.items(): out.append(f'@mat {l} {rp} {t}')
        out.append('@mblock 0 0'); out += rows
        d = f'{ROOT}/{slug}'
        open(f'{d}/{name}.pxg', 'w').write('\n'.join(out) + '\n')
        open(f'{d}/{name}.note', 'w').write(note + '\n')
        return rows

def run(slug, name):
    import subprocess
    r = subprocess.run(['python3', 'scripts/content/atlas-pick/horror_check.py', f'tiledata/atlas-pick/candidates-horror/{slug}/{name}.pxg'], cwd='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick', capture_output=True, text=True)
    print(r.stdout + r.stderr)
    r = subprocess.run(['python3', 'scripts/content/atlas-pick/horror_context.py', f'tiledata/atlas-pick/candidates-horror/{slug}/{name}.pxg'], cwd='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick', capture_output=True, text=True)
    print(r.stdout[-300:] + r.stderr[-300:])
