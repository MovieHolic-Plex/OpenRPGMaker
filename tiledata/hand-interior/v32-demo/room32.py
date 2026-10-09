# 32px 판 데모 방: 벽(회벽 + 판자 징두리)·바닥(널마루)을 32px 로 새로 그리고, 32px 소품을 같은 배치로 놓는다.
# 구조 규칙은 v5 room2 와 같다(북쪽이 막힌 칸 아래 두 줄 = 벽면, 안쪽에 닿은 막힌 칸 = 천장 띠). 벽면은 2칸 = 64px.
# 벽·바닥 색은 v5 색 줄(회벽 PLAST · 널마루 PLANK · 나무 WOOD)을 그대로 쓴다: 사용자가 v5 벽·바닥이 낫다고 했다.
# 저장소 루트에서: python3 tiledata/hand-interior/v32-demo/room32.py OUTDIR
import sys, os
sys.path.insert(0, 'tiledata/hand-interior/v32-demo')
from PIL import Image
from draw32 import H
from layout import PLAN, ITEMS
import objs32 as O

def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
PLANK = [hx(c) for c in ('#6a4630', '#7c5638', '#8a6442', '#96704c', '#a27c56')]
PLAST = [hx(c) for c in ('#8a7a60', '#a8987a', '#b8a888', '#c6b696', '#d2c4a4', '#ddd0b2')]
WOOD = [hx(c) for c in ('#000000', '#411e05', '#63310b', '#6d3b15', '#9a5435', '#9e684b', '#b77246', '#d59147')]
BR = [hx(c) for c in ('#2e2630', '#463a44', '#5a4c56', '#6c5c66', '#7c6c74', '#8e7e84')]
CAP = (hx('#221e28'), hx('#1b1820')); VOID = (16, 14, 22)
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])

def plank(X, Y, seed=3):
    """널마루 32px: 판 높이 8(결 면 7 + 이음 1), 길이 64 엇갈림, 판마다 기본 단. 결은 드물게 한 단, 판 끝 못 두 점."""
    row = Y // 8; ly = Y % 8
    if ly == 7: return PLANK[1] if H(X // 2, row, seed) < 0.85 else PLANK[0]
    off = int(H(row, 0, seed + 1) * 64); L = 64
    k = (X + off) // L; lx = (X + off) % L
    if lx == 0: return PLANK[1]
    if lx == 1: return PLANK[2]
    base = 3 if H(row, k, seed + 7) < 0.5 else 2
    t = base
    if ly == 0: t = min(4, base + 1)                      # 판 윗모서리가 빛을 받는다
    if lx == 3 and ly == 3: return PLANK[1]                # 못 (판 끝 한 점, 옅게)
    g = H((X + off) // 6, Y, seed + 2)                    # 결: 가로로 긴 한 단 (드물게)
    if g < 0.07 and 1 <= ly <= 5: t = base - 1 if base == 3 else base + 1
    return PLANK[max(1, min(4, t))]

def plaster(X, fy, seed=9):
    """벽면 32px (fy 0..63): 들보 → 회벽 → 가운데 띠 → 판자 징두리(8px 판) → 굽도리"""
    if fy < 6: return [WOOD[1], WOOD[1], WOOD[2], WOOD[3], WOOD[4], WOOD[3]][fy]
    if fy == 6: return PLAST[0]
    if fy < 28:
        if X % 128 < 6 and fy > 6:                        # 기둥 (4칸마다)
            return [WOOD[5], WOOD[4], WOOD[4], WOOD[3], WOOD[2], WOOD[1]][X % 128]
        t = 4 if fy > 10 else 3
        if H(X // 3, fy // 3, seed) < 0.12: t -= 1         # 옅은 얼룩 (두 톤, 드물게)
        if H(X, fy, seed + 1) < 0.03: t += 1
        return PLAST[t]
    if fy == 28: return WOOD[7]
    if fy == 29: return WOOD[6]
    if fy == 30: return WOOD[3]
    if fy == 31: return WOOD[1]
    if fy >= 58: return [WOOD[6], WOOD[4], WOOD[3], WOOD[2], WOOD[1], WOOD[1]][fy - 58]
    bx = X % 8                                            # 징두리 판: 왼쪽 밝게, 오른쪽 어둡게, 가운데 한 톤
    if bx == 0: return WOOD[6]
    if bx == 7: return WOOD[2]
    if bx == 6: return WOOD[3]
    return WOOD[5] if H(X // 8, fy // 5, seed + 4) < 0.18 and bx in (2, 3, 4) else WOOD[4]

def analyse(plan):
    Hh = len(plan); W = max(len(r) for r in plan)
    g = [[(plan[y][x] if x < len(plan[y]) else '#') != '#' for x in range(W)] for y in range(Hh)]
    def inn(x, y): return 0 <= x < W and 0 <= y < Hh and g[y][x]
    face = [[0] * W for _ in range(Hh)]
    for y in range(Hh):
        for x in range(W):
            if not g[y][x]: continue
            if not inn(x, y - 1): face[y][x] = 1
            elif face[y - 1][x] == 1: face[y][x] = 2
    top = [[(not g[y][x]) and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) for x in range(W)] for y in range(Hh)]
    return W, Hh, g, face, top, inn

def render(plan, S=32):
    W, Hh, g, face, top, inn = analyse(plan)
    im = Image.new('RGBA', (W * S, Hh * S)); px = im.load()
    for cy in range(Hh):
        for cx in range(W):
            for ly in range(S):
                for lx in range(S):
                    X, Y = cx * S + lx, cy * S + ly
                    if g[cy][cx] and face[cy][cx]:
                        fy = ly + (face[cy][cx] - 1) * S
                        c = plaster(X, fy)
                        if fy < 8: c = mul(c, 0.62 + 0.05 * fy)          # 천장 띠 밑 그늘
                    elif g[cy][cx]:
                        c = plank(X, Y)
                        if cy > 0 and face[cy - 1][cx] and ly < 6: c = mul(c, 0.6 + 0.07 * ly)   # 벽 발치 그늘
                    elif top[cy][cx]:
                        c = CAP[(X + Y) % 2]
                        s_in = inn(cx, cy + 1); n_in = inn(cx, cy - 1); w_in = inn(cx - 1, cy); e_in = inn(cx + 1, cy)
                        if s_in and ly >= 24: c = [BR[5], BR[5], BR[4], BR[4], BR[2], BR[2], BR[0], BR[0]][ly - 24]
                        if n_in and ly <= 3: c = [BR[0], BR[0], BR[3], BR[3]][ly]
                        if w_in and lx <= 5: c = [BR[0], BR[0], BR[4], BR[4], BR[3], BR[3]][lx]
                        if e_in and lx >= 26: c = [BR[3], BR[3], BR[2], BR[2], BR[0], BR[0]][lx - 26]
                        if (cy == 0 or (not inn(cx, cy - 1) and not top[cy - 1][cx])) and ly < 2: c = VOID
                    else: c = VOID
                    px[X, Y] = c + (255,)
    return im

FOOT = {}   # 이름 -> (fw, fh)   v5 칸 점유
def foot():
    if not FOOT:
        for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects'):
            if p not in sys.path: sys.path.insert(0, p)
        import room16
        for n, f in room16.objects(False).items(): FOOT[n] = (f.fw, f.fh, f.kind)
    return FOOT

def obj32(n, t=0):
    if n == 'fireplace': return O.fireplace(t)
    return {'dining 2x2': O.dining, 'chair S': lambda: O.chair('S'), 'chair N': lambda: O.chair('N'), 'barrel': O.barrel,
            'water jar': O.jar, 'double bed red': lambda: O.bed(64, 'red'), 'bed blue': lambda: O.bed(32, 'blue', 6),
            'bookshelf 2w': O.bookshelf, 'wardrobe': O.wardrobe, 'clock': O.clock, 'sofa': O.sofa, 'armchair': O.armchair}[n]()

def room(t=0, S=32):
    base = render(PLAN, S); F = foot(); draw = []
    for n, x, y in ITEMS:
        im = obj32(n, t); fw, fh, kind = F[n]
        up = im.height - fh * S
        draw.append(((y + fh) * S, im, x * S, y * S - up))
    for _, im, X, Y in sorted(draw, key=lambda d: d[0]): base.alpha_composite(im, (X, Y))
    return base

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    im = room(); im.save(f'{out}/room32.png'); print(im.size)
    fr = [room(t).convert('RGB') for t in range(4)]
    fr[0].save(f'{out}/room32-anim.webp', save_all=True, append_images=fr[1:], duration=180, loop=0, lossless=True)
