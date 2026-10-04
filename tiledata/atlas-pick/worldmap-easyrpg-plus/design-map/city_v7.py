"""v7 성곽 도시 — 팔각 성벽. 원본 어두운 성(World.png 20-21,10-11)의 벽 모듈 열을 그대로 쓰되
대각 구간은 모듈 열을 한 칸씩 아래로 밀어(전단) 45도로 잇는다. 새 색 없음. 생성 이미지·트레이싱 없음. (EasyRPG RTP, CC BY 4.0)
원본 모듈: 흉벽 3행 + 벽돌 + 문 줄. 측벽은 윗면만(모듈 행을 세워 가로 8칸), 앞벽은 흉벽 7행 + 벽돌 9행(16행)."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
from city_v6 import *            # house/cobble/bush/dither_grass/nobush/ship/quay ...
from ext2_castle import *
import numpy as np

WM = None


def paste(dst, src, x, y, over=True):
    """경계 밖을 잘라내는 붙이기(분홍은 투명)."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(w, W - x), min(h, H - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    s = src[sy0:sy1, sx0:sx1]
    sub = dst[y + sy0:y + sy1, x + sx0:x + sx1]
    m = ~is_key(s)
    sub[m] = s[m]


def put(a, h, x, y):
    paste(a, h, x, y)


def wm():
    global WM
    if WM is None:
        WM = wall_module()
    return WM


FRONT_ROWS = list(range(0, 7)) + list(range(13, 22))      # 16행
BACK_ROWS = list(range(0, 7)) + list(range(13, 18))       # 12행


def wcol(x, row):
    """벽 모듈 열 2..5(주기 4)에서 x 에 해당하는 열의 한 줄."""
    return wm()[row, 2 + (x % 4)]


def sheared(length, rows, slope):
    """45도 대각 벽. slope=+1 이면 오른쪽으로 갈수록 내려간다. 반환: (length+len(rows)+1)행 x length열."""
    h = length + len(rows) + 1
    a = blank(length, h)
    for x in range(length):
        off = x if slope > 0 else length - 1 - x
        for i, r in enumerate(rows):
            a[off + i, x] = wcol(x, r)
        a[off + len(rows), x] = K
    return a


def side_strip(height, width=8):
    """측벽 윗면: 벽 모듈 행 0..(width-1) 을 세워서 가로 width 칸. 왼쪽 가장자리가 흉벽 이빨, 오른쪽에 외곽선."""
    a = blank(width, height)
    for y in range(height):
        for i in range(width - 1):
            c = wm()[i, 2 + (y % 4)]
            if not (c == PINKA).all():
                a[y, i] = c
        a[y, width - 1] = K
    return a


def wall_layer(W, H, g):
    """벽 윤곽 전체(탑·성채 제외)를 한 장에 그린다. g: 기하 딕셔너리."""
    a = blank(W, H)
    cx, nh, run = g['cx'], g['nh'], g['run']
    ytop, ys = g['ytop'], g['ys']
    sx0, sw = g['sx0'], g['sw']
    flat = g.get('flat')
    fw = front_wall(2 * nh, 0)
    fw = np.concatenate([fw[:7], fw[13:]], axis=0)
    fwid = fw.shape[1]
    xf0 = cx - fwid // 2
    ffw = None
    if flat:   # 남쪽은 대각 없이 통짜 앞벽(부두와 맞닿는 항구 성곽)
        ffw = front_wall(W - 2 * (sx0 + sw) + 2, 0)
        ffw = np.concatenate([ffw[:7], ffw[13:15], ffw[15 + g.get('slim', 0):]], axis=0)
    # 북벽 (뒷벽 안쪽 면) — 가운데를 성채가 가린다
    for x in range(xf0, xf0 + fwid):
        for i, r in enumerate(BACK_ROWS):
            px(a, x, ytop + i, wcol(x - xf0, r))
        px(a, x, ytop + len(BACK_ROWS), K)
    xl_in, xr_out = sx0 + sw, W - sx0          # 측벽 안쪽/바깥
    xr0 = xr_out - sw
    ny = ytop + run                             # 측벽 윗면이 시작하는 y
    sy = ys - run                               # 남쪽 대각이 측벽과 만나는 y
    if flat:
        sy = ys + 4
    # 측벽
    for x0 in (sx0, xr0):
        s = side_strip(sy - ny + 8, sw)
        paste(a, s, x0, ny)
    # 북동·북서 대각 (뒷벽 면)
    d_ne = sheared(xr0 - (xf0 + fwid), BACK_ROWS, +1)
    paste(a, d_ne, xf0 + fwid, ytop)
    d_nw = sheared(xf0 - xl_in, BACK_ROWS, -1)
    paste(a, d_nw, xl_in, ytop)
    # 남쪽 대각 (앞벽 면). 위쪽으로 올라가므로 slope 부호 반대
    if flat:
        paste(a, ffw, cx - ffw.shape[1] // 2, ys)
    else:
        d_se = sheared(xr0 - (xf0 + fwid), FRONT_ROWS, -1)
        paste(a, d_se, xf0 + fwid, sy)
        d_sw = sheared(xf0 - xl_in, FRONT_ROWS, +1)
        paste(a, d_sw, xl_in, sy)
        paste(a, fw, xf0, ys)
    return a, dict(xf0=xf0, fwid=fwid, xl_in=xl_in, xr0=xr0, ny=ny, sy=sy)


def yard_mask(layer, seed):
    """벽이 아닌 칸을 시드에서 4연결로 채운 마당 마스크."""
    H, W = layer.shape[:2]
    free = is_key(layer)
    m = np.zeros((H, W), bool)
    st = [seed]
    while st:
        x, y = st.pop()
        if not (0 <= x < W and 0 <= y < H) or m[y, x] or not free[y, x]:
            continue
        m[y, x] = True
        st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return m


def city(W, H, g, keep, keep_xy, towers, roads, slots, plaza=None, bushes=(), extra=None, seed=None):
    """roads: [(x0,y0,x1,y1)] 돌길 사각형들. slots: [(x,y,kind,wide)] 후보 집 자리."""
    a = blank(W, H)
    layer, info = wall_layer(W, H, g)
    pre = layer.copy()
    paste(pre, keep, *keep_xy)
    for t, (tx, ty) in towers:
        paste(pre, t, tx, ty)
    ymask = yard_mask(pre, seed or (g['cx'], (g['ytop'] + g['ys']) // 2))
    dither_grass(a, ymask)
    roadm = np.zeros((H, W), bool)
    for (x0, y0, x1, y1) in roads:
        roadm[y0:y1 + 1, x0:x1 + 1] = True
    roadm &= ymask
    ys_, xs_ = np.nonzero(roadm)
    for y, x in zip(ys_, xs_):
        a[y, x] = SAND[1] if (x + y) % 2 else SAND[2]
    placed = []
    for x, y, kind, wd in slots:
        h = nobush(house(kind, wd))
        hw = h.shape[1]
        pts = [(x + 1, y + 3), (x + hw - 2, y + 3), (x + 1, y + 13), (x + hw - 2, y + 13)]
        if all(ymask[py, px_] and not roadm[py, px_] for px_, py in pts):
            put(a, h, x, y)
            placed.append((x, y))
    for bx, by in bushes:
        if ymask[by + 2, bx + 1] and ymask[by + 2, bx + 2] and not roadm[by + 2, bx + 1]:
            bush(a, bx, by)
    if extra:
        extra(a, ymask, roadm)
    paste(a, layer, 0, 0)
    paste(a, keep, *keep_xy)
    for t, (tx, ty) in towers:
        paste(a, t, tx, ty)
    return a, placed


def well(a, x, y):
    """광장 우물(원본 돌 색 + 물빛 8ca9a3) 8x6."""
    pat = ['.KKKKKK.', 'KbbbbbbK', 'KbWWWWbK', 'KbWWWWbK', 'KbbbbbbK', '.KKKKKK.']
    col = {'K': K, 'b': hexc('6a607b'), 'W': hexc('8ca9a3')}
    for dy, r in enumerate(pat):
        for dx, c in enumerate(r):
            if c != '.':
                px(a, x + dx, y + dy, col[c])
    for dx in range(1, 7):
        px(a, x + dx, y + 5, hexc('363540'))


def kind_of(x, y):
    return ('red', 'brown', 'slate', 'red')[(x // 13 + y // 11) % 4]


def capital():
    W = H = 96
    g = dict(cx=48, nh=19, run=15, ytop=14, ys=80, sx0=6, sw=8)
    keep = keep_plain(1, 3)
    kx = 48 - keep.shape[1] // 2
    t = fat_tower(0)
    tw, th = t.shape[1], t.shape[0]
    # 탑: 측벽 끝 네 곳(대각과 측벽이 꺾이는 자리)
    tow = []
    for tx, by in ((27, 33), (W - 27, 33), (25, 93), (W - 25, 93)):
        tow.append((t, (tx - tw // 2, by - th + 1)))
    roads = [(45, 26, 50, 79), (14, 54, 81, 58), (39, 52, 56, 62)]
    slots = []
    for y, xs in ((27, (17, 30, 54, 67)), (38, (17, 30, 54, 67)), (63, (17, 30, 54, 67))):
        for x in xs:
            slots.append((x, y, kind_of(x, y), 0))
    def extra(a, ym, rm):
        well(a, 44, 54)
    return city(W, H, g, keep, (kx, 1), tow, roads, slots, extra=extra,
                bushes=((13, 50), (24, 59), (36, 50), (58, 50), (72, 50), (38, 60), (57, 60), (13, 62)))[0]


def short_tower():
    t = fat_tower(0)
    return t[list(range(0, 8)) + list(range(18, 31))]


def fort():
    W = H = 64
    g = dict(cx=32, nh=12, run=4, ytop=10, ys=48, sx0=2, sw=6)
    keep = keep_plain(0, 2)
    kx = 32 - keep.shape[1] // 2
    t = short_tower()
    tw, th = t.shape[1], t.shape[0]
    tow = [(t, (tx - tw // 2, by - th + 1)) for tx, by in ((10, 30), (W - 10, 30), (10, 63), (W - 10, 63))]
    roads = [(30, 24, 33, 47), (11, 36, 52, 39)]
    slots = [(x, y, k, 0) for x, y, k in ((15, 28, 'red'), (37, 28, 'brown'), (15, 41, 'slate'), (37, 41, 'red'))]
    return city(W, H, g, keep, (kx, 0), tow, roads, slots,
                bushes=((22, 33), (42, 33), (24, 42), (38, 42)))[0]


def harbor():
    W, H = 80, 64
    g = dict(cx=40, nh=15, run=8, ytop=3, ys=36, sx0=3, sw=6, flat=True, slim=2)
    keep = keep_plain(1, 1)
    kx = 40 - keep.shape[1] // 2
    t = short_tower()
    tw, th = t.shape[1], t.shape[0]
    tow = [(t, (tx - tw // 2, by - th + 1)) for tx, by in ((9, 26), (W - 9, 26), (9, 54), (W - 9, 54))]
    roads = [(38, 19, 41, 35)]
    slots = [(x, y, k, 0) for x, y, k in ((17, 19, 'red'), (51, 19, 'brown'), (25, 26, 'slate'))]
    a = city(W, H, g, keep, (kx, 0), tow, roads, slots, bushes=((14, 31), (33, 31), (47, 31), (63, 31)), seed=(40, 28))[0]
    quay(a, 0, 80, 50)
    ship(a, 40, 46)
    return a


if __name__ == '__main__':
    from PIL import Image
    os.makedirs('/tmp/w7', exist_ok=True)
    bgc = np.array((60, 60, 60), dtype=np.uint8)
    for n, f in (('capital', capital), ('fort', fort), ('harbor', harbor)):
        a = f(); b = a.copy(); b[is_key(a)] = bgc
        Image.fromarray(b).resize((a.shape[1] * 6, a.shape[0] * 6), Image.NEAREST).save('/tmp/w7/%s.png' % n)
