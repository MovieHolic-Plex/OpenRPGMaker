# s3 작업자용 작은 도우미 — 격자 캔버스에 글자를 놓고 .pxg 로 쓴다. (도형 채우기는 평면 재료 덩이에만 쓰고 명암은 손으로 놓는다)
import os
class C:
    def __init__(s, W, H, mats):
        s.W, s.H, s.mats = W, H, mats
        s.g = [['.'] * W for _ in range(H)]
    def px(s, x, y, c):
        if 0 <= x < s.W and 0 <= y < s.H: s.g[y][x] = c
    def rect(s, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, c)
    def box(s, x, y, w, h, fill, tl, br):
        s.rect(x, y, w, h, fill)
        for i in range(x, x + w): s.px(i, y, tl); s.px(i, y + h - 1, br)
        for j in range(y, y + h): s.px(x, j, tl); s.px(x + w - 1, j, br)
        s.px(x + w - 1, y, br); s.px(x, y + h - 1, br if w == 1 else tl)
    def hl(s, x, y, n, c):
        for i in range(n): s.px(x + i, y, c)
    def vl(s, x, y, n, c):
        for j in range(n): s.px(x, y + j, c)
    def put(s, x, y, rows):
        for j, r in enumerate(rows.strip('\n').split('\n')):
            for i, ch in enumerate(r):
                if ch != ' ': s.px(x + i, y + j, ch)
    def shadow(s, x, y, w, h=2):
        # 발치 오른쪽 아래 그림자: 첫 줄 ~(속) 나머지 -(번짐). 이미 그림이 있는 칸은 건드리지 않는다
        for j in range(h):
            for i in range(w):
                if s.g[y + j][x + i] == '.': s.px(x + i, y + j, '~' if j == 0 else '-')
    def save(s, path, note, cell=16):
        head = ['@size %d %d' % (s.W, s.H), '@cell %d' % cell, '@palette palette.pal']
        head += ['@mat %s %s %d' % (k, v[0], v[1]) for k, v in s.mats.items()]
        head.append('@mblock 0 0')
        open(path, 'w').write('\n'.join(head + [''.join(r) for r in s.g]) + '\n')
        open(path.replace('.pxg', '.note'), 'w').write(note + '\n')
