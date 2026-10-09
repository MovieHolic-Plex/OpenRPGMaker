"""j2 작도 도우미 — 격자에 「램프:단」 열쇠를 손으로 놓고, 재료 글자(@mblock)+단 글자(@tblock) pxg 로 내보낸다.
보간·잡음 없음: 사각형/선/글자 도안으로 단을 직접 놓는다."""
import os
TONES = '0123456789abcde'
SINGLE = '~-%'

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [[None] * w for _ in range(h)]
    def px(s, x, y, k):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.g[y][x] = k
    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w):
                s.px(i, j, k)
    def h_(s, x, y, w, k): s.rect(x, y, w, 1, k)
    def v_(s, x, y, h, k): s.rect(x, y, 1, h, k)
    def art(s, x, y, rows, leg):
        """도안: 글자 → leg[글자] 열쇠. '.' 는 건드리지 않음, '_' 는 지움."""
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c == '.': continue
                if c == '_': s.px(x + i, y + j, None); continue
                s.px(x + i, y + j, leg[c])
    def erase(s, x, y, w, h):
        s.rect(x, y, w, h, None)
    def ell(s, cx, cy, rx, ry, k, only_empty=False):
        """타원(중심 cx,cy 반지름 rx,ry; 칸 중심 기준)."""
        for j in range(s.h):
            for i in range(s.w):
                if ((i + .5 - cx) / rx) ** 2 + ((j + .5 - cy) / ry) ** 2 <= 1:
                    if not only_empty or s.g[j][i] is None:
                        s.g[j][i] = k
    def edge(s, tone_of, keys=None):
        """안쪽 윤곽: 투명과 4방향으로 닿는 칸을 tone_of(ramp) 단으로. keys 가 있으면 그 램프만."""
        out = []
        for j in range(s.h):
            for i in range(s.w):
                k = s.g[j][i]
                if k is None or k in SINGLE: continue
                r = k.split(':')[0]
                if keys and r not in keys: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = s.get(i + dx, j + dy)
                    if n is None or n in SINGLE:
                        out.append((i, j, f'{r}:{tone_of(r, i, j, dx, dy)}')); break
        for i, j, k in out: s.g[j][i] = k
    def shade(s, x, y, w, h, d, only=None):
        """영역 안 램프칸을 d 단 옮김(손으로 고른 영역)."""
        for j in range(y, y + h):
            for i in range(x, x + w):
                k = s.get(i, j)
                if k is None or k in SINGLE: continue
                r, t = k.split(':')
                if only and r not in only: continue
                s.g[j][i] = f'{r}:{TONES[max(0, min(14, TONES.index(t) + d))]}'
    def blend_shadow(s, cells, k='~'):
        for (i, j) in cells:
            if s.get(i, j) is None: s.px(i, j, k)
    def bbox_bottom(s):
        for j in range(s.h - 1, -1, -1):
            if any(c is not None for c in s.g[j]): return j
    def save(s, path, cell=16, note=None, pal='palette.pal'):
        ramps = []
        for r in s.g:
            for k in r:
                if k and k not in SINGLE:
                    n = k.split(':')[0]
                    if n not in ramps: ramps.append(n)
        letters = 'abcdefghijklmnopqrstuvwxyz'
        assert len(ramps) <= 26, ramps
        L = {n: letters[i] for i, n in enumerate(ramps)}
        lines = [f'// j2 후보 — {os.path.basename(path)}', f'@size {s.w} {s.h}', f'@cell {cell}', f'@palette {pal}']
        for n in ramps: lines.append(f'@mat {L[n]} {n}')
        lines.append('@mblock 0 0')
        for r in s.g:
            lines.append(''.join('.' if k is None else (k if k in SINGLE else L[k.split(':')[0]]) for k in r))
        lines.append('@tblock 0 0')
        for r in s.g:
            lines.append(''.join('.' if (k is None or k in SINGLE) else k.split(':')[1] for k in r))
        open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        if note:
            open(path[:-4] + '.note', 'w', encoding='utf-8').write(note.strip() + '\n')
