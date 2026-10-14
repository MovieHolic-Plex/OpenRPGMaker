"""검수 장면: 문자 격자 바닥 + 조각 배치를 원본 해상도로 그린다(굽기 전, 조각 그림을 바로 씀).

바닥 문자: ~ 깊은 바다 · w 얕은 물 · s 모래 · g 풀 · p 흙길 · v 모래길 · q 방파제 포석 · c 포석 · r 바위땅 · d 갑판 · b 판자 부두 · F 성벽 윗면
          실내: 1 배 바닥 · 2 술집 마루 · 3 갈대 돗자리 · 4 동굴 바닥 · 5 보물 바닥 · S/T/H/C 벽 천장(배/술집/오두막/동굴)
"""
import numpy as np
from PIL import Image
import pi_core as C
import pi_terrain as TR

LAND = set('sgpvqcrFdb')
AUTO = {  # 문자 → (조각 id, 이어지는 문자, 덩이 여부)
    '~': ('at-deep', set('~'), True),
    's': ('at-beach', LAND, True),
    'g': ('at-grass', set('gpvqcrFb'), True),
    'p': ('at-path', set('psvqc'), True),
    'v': ('at-sandpath', set('vspqc'), True),
    'q': ('at-quay', set('qcsgpvrFb'), False),
    'b': ('at-boardwalk', set('bqcsgd'), False),
    'F': ('at-fortwall', set('F'), False),
    'S': ('at-wall-ship', set('S'), False), 'T': ('at-wall-tavern', set('T'), False),
    'H': ('at-wall-hut', set('H'), False), 'C': ('at-wall-cave', set('C'), False),
}
PLAIN = {'w': ('water', 0), 'c': ('cobble', 0), 'r': ('rockfloor', 0), 'd': ('deck', 0),
         '1': ('floor-ship', 0), '2': ('floor-tavern', 0), '3': ('floor-reed', 0), '4': ('floor-cave', 0), '5': ('floor-cave', 1)}
_cache = {}


def piece_img(pid):
    if pid not in _cache: _cache[pid] = C.render(C.PIECES[pid])
    return _cache[pid]


def cell_of(pid, cx, cy):
    a = piece_img(pid); return a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]


def mask_at(grid, x, y, conn, eight):
    H, Wd = len(grid), len(grid[0])
    def on(dx, dy):
        xx, yy = x + dx, y + dy
        if not (0 <= xx < Wd and 0 <= yy < H): return True
        return grid[yy][xx] in conn
    m = 0
    for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))):
        if on(dx, dy): m |= bit
    if eight:
        for bit, (dx, dy) in ((16, (1, -1)), (32, (1, 1)), (64, (-1, 1)), (128, (-1, -1))):
            if on(dx, dy): m |= bit
    return m


def ground(grid, variety=True):
    H, Wd = len(grid), len(grid[0])
    out = np.zeros((H * 16, Wd * 16, 4), np.uint8)
    for y in range(H):
        for x in range(Wd):
            ch = grid[y][x]
            if ch in AUTO:
                pid, conn, eight = AUTO[ch]
                m = mask_at(grid, x, y, conn | {ch}, eight)
                if eight:
                    i = TR.BLOB_MASKS.index(TR.canon(m)); cell = cell_of(pid, i % 8, i // 8)
                    if ch == 's' and m == 255 and variety and C.hsh(x, y, 1) % 9 == 0: cell = cell_of('sand', 1 + C.hsh(x, y, 2) % 2, 0)
                    if ch == 'g' and m == 255 and variety and C.hsh(x, y, 3) % 11 == 0: cell = cell_of('grass', 1, 0)
                else:
                    cell = cell_of(pid, (m & 15) % 4, (m & 15) // 4)
            elif ch in PLAIN:
                pid, v = PLAIN[ch]; cell = cell_of(pid, v, 0)
            else:
                cell = cell_of('water', 0, 0)
            out[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = cell
    return out


def place(canvas, pid, tx, ty, f=0):
    p = C.PIECES[pid]; a = C.render(p, f)
    h, w = a.shape[:2]; y0, x0 = ty * 16, tx * 16
    H, Wd = canvas.shape[:2]
    for j in range(h):
        yy = y0 + j
        if not 0 <= yy < H: continue
        row = a[j]; m = row[:, 3] == 255
        xs = np.nonzero(m)[0]
        for i in xs:
            xx = x0 + i
            if 0 <= xx < Wd: canvas[yy, xx] = row[i]


def faces(grid, canvas, face_of=None):
    """벽 천장(S/T/H/C/F) 남쪽 가장자리 아래 두 줄에 wall-face-* 를 붙인다(그 두 줄이 바닥일 때)."""
    face_of = face_of or {'S': 'wall-face-ship', 'T': 'wall-face-tavern', 'H': 'wall-face-hut', 'C': 'wall-face-cave', 'F': 'wall-face-fort'}
    H, Wd = len(grid), len(grid[0])
    for y in range(H - 1):
        for x in range(Wd):
            ch = grid[y][x]
            if ch in face_of and grid[y + 1][x] != ch:
                v = 0 if C.hsh(x, y, 5) % 3 else (1 + C.hsh(x, y, 6) % 3)
                for r in range(2):
                    if y + 1 + r < H:
                        canvas[(y + 1 + r) * 16:(y + 2 + r) * 16, x * 16:(x + 1) * 16] = cell_of(face_of[ch], v, r)


def render(grid, items, path=None, z=1, face=True, variants=None):
    g = [list(r) for r in grid]
    cv = ground(g)
    if face: faces(g, cv)
    for it in items:
        place(cv, *it)
    im = Image.fromarray(cv, 'RGBA')
    if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    if path: im.save(path)
    return im
