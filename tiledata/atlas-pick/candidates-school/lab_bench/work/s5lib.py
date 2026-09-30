"""s5 작도 도우미: 캔버스에 (램프:단) 글자를 사각형·점으로 놓고 pxg(@mat/@mblock/@tblock)로 내보낸다."""
import os
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school'
DIRECT = set('~-%&')
class C:
    def __init__(s, w, h, legend):
        s.w, s.h, s.leg = w, h, legend
        s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = ch
    def rect(s, x, y, w, h, ch):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, ch)
    def hl(s, x, y, n, ch): s.rect(x, y, n, 1, ch)
    def vl(s, x, y, n, ch): s.rect(x, y, 1, n, ch)
    def pts(s, ch, *xy):
        for i in range(0, len(xy), 2): s.px(xy[i], xy[i + 1], ch)
    def bevel(s, x, y, w, h, base, hi=None, lo=None):
        # 빛 왼쪽 위: 윗줄·왼줄 hi, 아랫줄·오른줄 lo
        s.rect(x, y, w, h, base)
        if hi: s.hl(x, y, w, hi); s.vl(x, y, h, hi)
        if lo: s.hl(x, y + h - 1, w, lo); s.vl(x + w - 1, y, h, lo)
    def rows(s): return [''.join(r) for r in s.g]
    def show(s): print('\n'.join(s.rows()))
    def emit(s, slug, name, note):
        mats = {}; letters = 'abcdefghijklmnopqrstuvwxyz'
        M = []; T = []
        for r in s.g:
            m = ''; t = ''
            for ch in r:
                if ch == '.': m += '.'; t += '.'
                elif ch in DIRECT: m += ch; t += '.'
                else:
                    ramp, tone = s.leg[ch].split(':')
                    if ramp not in mats: mats[ramp] = letters[len(mats)]
                    m += mats[ramp]; t += tone
            M.append(m); T.append(t)
        d = os.path.join(ROOT, slug)
        out = ['// s5 후보 — %s.pxg' % name, '@size %d %d' % (s.w, s.h), '@cell 16', '@palette palette.pal']
        for ramp, l in mats.items(): out.append('@mat %s %s' % (l, ramp))
        out.append('@mblock 0 0'); out += M
        out.append('@tblock 0 0'); out += T
        open(os.path.join(d, name + '.pxg'), 'w').write('\n'.join(out) + '\n')
        open(os.path.join(d, name + '.note'), 'w').write(note.strip() + '\n')
