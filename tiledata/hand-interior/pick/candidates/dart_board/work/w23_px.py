"""w23 작도 도우미: 글자 격자 + 재료 열쇠 -> .pxg. 색은 손으로 정한다(램프:단), 도형 채움은 실루엣 마스크 계산에만 쓴다."""
import math, string
class G:
    def __init__(s, w=32, h=32):
        s.w, s.h = w, h
        s.g = [[None]*w for _ in range(h)]
    def set(s, x, y, k):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = k
    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def mask(s):
        return {(x, y) for y in range(s.h) for x in range(s.w) if s.g[y][x] and s.g[y][x] not in ('~', '-')}
    def write(s, path, note=''):
        keys = []
        for row in s.g:
            for k in row:
                if k and k not in keys and k not in ('~', '-'): keys.append(k)
        letters = [c for c in string.ascii_letters if c not in 'x']  # 글자 배정
        m = {k: letters[i] for i, k in enumerate(keys)}
        out = [f'// {note}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal']
        for k, c in m.items():
            r, l = k.split(':'); out.append(f'@mat {c} {r} {l}')
        out.append('@mblock 0 0')
        for row in s.g:
            out.append(''.join('.' if not k else (k if k in '~-' else m[k]) for k in row))
        open(path, 'w').write('\n'.join(out) + '\n')
    def dump(s):
        keys = {}
        for row in s.g:
            print(''.join('.' if not k else (k if k in '~-' else k.split(':')[0][0]) for k in row))

def shadow(g, dx=1, dy=1, far=2):
    """벽에 떨어지는 그림자: 실루엣을 (dx,dy)만큼 옮겨 ~ , 한 칸 더 옮겨 - (아래·오른쪽)."""
    m = g.mask()
    for k, ch in ((far, '-'), (1, '~')):
        for (x, y) in m:
            xx, yy = x + dx*k, y + dy*k
            if g.get(xx, yy) is None and (xx, yy) not in m:
                g.set(xx, yy, ch)
    # ~ 가 - 를 덮도록 재적용
    for (x, y) in m:
        xx, yy = x + dx, y + dy
        if g.get(xx, yy) in (None, '-') and (xx, yy) not in m: g.set(xx, yy, '~')
