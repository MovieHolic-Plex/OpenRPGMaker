"""w5 묶음(3x4) 조립 도우미. 몸통 결(body/body_alt 16x16 글자 격자)과 손으로 적은 가장자리 굴곡표만 받는다.
가장자리 칸의 안쪽 절반은 몸통 글자 그대로(=사분면 합성에서 몸통과 화소 단위로 같다). 테는 굴곡표와 style() 이 놓는다."""
import math, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '../../../../../scripts/content/atlas-pick')))
from pxg_emit import emit

LAYOUT = [['isolated', 'body_alt', 'inner'], ['corner_nw', 'edge_n', 'corner_ne'], ['edge_w', 'body', 'edge_e'], ['corner_sw', 'edge_s', 'corner_se']]
EMPTY = {'isolated': '', 'body': '', 'body_alt': '', 'inner': '', 'edge_n': 'n', 'edge_s': 's', 'edge_w': 'w', 'edge_e': 'e',
         'corner_nw': 'nw', 'corner_ne': 'ne', 'corner_sw': 'sw', 'corner_se': 'se'}

def sample(tab, t):
    return tab[int(t) % len(tab)]

def cell(role, tiles, P, style):
    """P = dict: p(16 굴곡표), R(외딴 반지름 표, 각도별), rr(모서리 반지름 표, 각도별), notch(안쪽 모서리 노치 반지름)."""
    base = tiles['body_alt'] if role == 'body_alt' else tiles['body']
    E = EMPTY[role]; out = []
    for y in range(16):
        row = ''
        for x in range(16):
            px, py = x + .5, y + .5
            ch = base[y][x]; depth = 99.0; nx = ny = 0.0
            if role == 'isolated':
                d = math.hypot(px - 8, py - 8); ang = (math.atan2(py - 8, px - 8) + math.pi) / (2 * math.pi)
                depth = sample(P['R'], ang * len(P['R'])) - d; nx, ny = (px - 8) / max(d, .1), (py - 8) / max(d, .1)
            elif role == 'inner':
                for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)):
                    d = math.hypot(px - cx, py - cy)
                    if d - P['notch'] < depth: depth = d - P['notch']; nx, ny = (cx - px) / max(d, .1), (cy - py) / max(d, .1)
            elif E:
                cand = []
                v = [c for c in E if c in 'ns']; h = [c for c in E if c in 'we']
                if v and h:
                    inq = ((x < 8) == (h[0] == 'w')) and ((y < 8) == (v[0] == 'n'))
                    if inq:
                        d = math.hypot(px - 8, py - 8); ang = (math.atan2(py - 8, px - 8) + math.pi) / (2 * math.pi)
                        cand.append((sample(P['rr'], ang * len(P['rr'])) - d, (px - 8) / max(d, .1), (py - 8) / max(d, .1)))
                if not cand:
                    for s in E:
                        if s == 'n': cand.append((py - P['p'][x], 0, -1))
                        if s == 's': cand.append((16 - py - P['p'][x], 0, 1))
                        if s == 'w': cand.append((px - P['p'][y], -1, 0))
                        if s == 'e': cand.append((16 - px - P['p'][y], 1, 0))
                depth, nx, ny = min(cand, key=lambda t: t[0])
            light = (-nx - ny) / 1.414          # 양수 = 왼쪽 위를 보는 테(빛 받는 쪽)
            row += style(x, y, depth, light, ch, role) if depth < 99 else ch
        out.append(row)
    return out

def build(tiles, P, style, legend, title):
    rows = [''] * 64
    for cy in range(4):
        for cx in range(3):
            c = cell(LAYOUT[cy][cx], tiles, P, style)
            for y in range(16): rows[cy * 16 + y] += c[y]
    return emit(rows, legend, title), rows
