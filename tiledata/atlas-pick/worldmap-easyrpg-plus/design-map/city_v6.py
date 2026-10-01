"""v6 성곽 도시 — 원본 어두운 성(World.png 20-21,10-11)·마을 아이콘(22,8)의 모듈을 그대로 재배열한다.
새로 찍는 것은 원본에 있는 색만 쓴다. 생성 이미지·트레이싱 없음. (EasyRPG RTP, CC BY 4.0)"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from ext2_castle import *          # crop/blank/paste/px/rect/vstretch/hstretch, tower/fat_tower/wall_module/keep_plain ...
import numpy as np

# 원본에서 잰 색 (castle-study.md)
K = (0x11, 0x16, 0x18)
GRASS = [hexc('218238'), hexc('13522e'), hexc('40a837')]
SAND = [hexc('d59147'), hexc('9a5435'), hexc('b77246')]
STEP = hexc('9a5435')


def house_raw():
    """원본 붉은 지붕 집 (World.png 352,128) 의 집 몸체 — 열 2..11, 행 0..14."""
    a = crop(352, 128, 364, 143)
    a[:, :2] = PINKA
    # 열 11 은 옆 아이콘(기둥)과 겹친 줄 — 지붕 오른쪽 외곽선(351803 / 931d10)만 남긴다
    for y in range(a.shape[0]):
        if tuple(int(v) for v in a[y, 11]) not in (hexc('351803'), hexc('931d10')) or y < 5 or y > 9:
            a[y, 11] = PINKA
    return a[:, 0:12]


def swap(a, mapping):
    out = a.copy()
    for src, dst in mapping.items():
        m = (a == np.array(hexc(src), dtype=np.uint8)).all(axis=-1)
        out[m] = hexc(dst)
    return out


ROOF_RED = {}
ROOF_BROWN = {'c21919': '9a5435', '710d09': '6d3b15', 'de693b': 'd59147', '931d10': '6d3b15', 'd2432d': 'b77246', '690907': '351803'}
ROOF_SLATE = {'c21919': '666484', '710d09': '473f55', 'de693b': '8d8aac', '931d10': '473f55', 'd2432d': '8d8aac', '690907': '373740'}


def house(kind='red', wide=0):
    h = house_raw()
    if kind == 'brown':
        h = swap(h, ROOF_BROWN)
    elif kind == 'slate':
        h = swap(h, ROOF_SLATE)
    if wide:
        h = hstretch(h, 6, 7, wide)
    return h


def cobble(a, x0, y0, x1, y1, parity=0):
    """길/광장: 원본 성문 앞 돌바닥 느낌의 체크 디더(9a5435 / b77246)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(a, x, y, SAND[1] if (x + y + parity) % 2 else SAND[2])


def grass(a, m):
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        a[y, x] = GRASS[0] if (x * 7 + y * 3) % 5 else (GRASS[1] if (x + y) % 2 else GRASS[2])


def shadow_under(a, y, x0, x1):
    """탑·벽 밑 받침 그림자(1행, 원본 아이콘이 지형과 만나는 줄 111618 을 따른다)."""
    for x in range(x0, x1):
        if y < a.shape[0] and (a[y, x] == PINKA).all():
            a[y, x] = K


def nobush(h):
    out = h.copy()
    for g in ('218238', '40a837', '13522e', '7ac83c'):
        out[(h == np.array(hexc(g), dtype=np.uint8)).all(axis=-1)] = PINKA
    return out


def put(a, h, x, y):
    paste(a, h, x, y)


def dither_grass(a, m):
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        v = (x * 13 + y * 29 + (x * y) % 7) % 11
        a[y, x] = GRASS[2] if v == 0 else (GRASS[1] if v < 4 else GRASS[0])


def back_wall(width):
    """벽 모듈에서 문 줄을 뺀 뒷벽(흉벽+벽돌 18행), 가로로 늘림."""
    w = wall_module()[0:18]
    n = (width - 14) // 4
    w = hstretch(w, 2, 6, n // 2)
    w = hstretch(w, 10, 14, n - n // 2)
    return w


def bush(a, x, y):
    """원본 집 옆 덤불(13522e 외곽 / 218238 / 40a837 하이라이트) 4x3."""
    A, D, E = hexc('13522e'), hexc('218238'), hexc('40a837')
    pat = ['.AA.', 'ADEA', 'ADDA']
    for dy, r in enumerate(pat):
        for dx, c in enumerate(r):
            if c != '.':
                px(a, x + dx, y + dy, {'A': A, 'D': D, 'E': E}[c])


def capital(houses=True):
    W = H = 96
    a = blank(W, H)
    court = np.zeros((H, W), bool)
    court[24:84, 13:83] = True
    dither_grass(a, court)
    # 뒷벽 (두 뒤탑 사이)
    bw = back_wall(76)
    put(a, bw[:, :], 10, 24)
    # 뒤 성채
    put(a, core3(56, 50, 1, 1, 1), 20, 2)
    # 돌길: 앞문에서 성채 문까지
    cobble(a, 47, 49, 52, 71)
    if houses:
        rows = [
            (40, [(14, 'red', 0), (28, 'brown', 0), (55, 'slate', 0), (68, 'red', 0)]),
            (47, [(21, 'slate', 0), (34, 'red', 0), (54, 'brown', 0), (62, 'red', 0)]),
            (54, [(14, 'red', 0), (28, 'red', 0), (56, 'brown', 0), (69, 'slate', 0)]),
            (60, [(21, 'brown', 0), (34, 'slate', 0), (55, 'red', 0), (63, 'brown', 0)]),
        ]
        for y, lst in rows:
            for x, kind, wd in lst:
                put(a, nobush(house(kind, wd)), x, y)
        for bx, by in ((42, 46), (11 + 4, 70), (45, 66), (51, 66), (76, 66), (66, 70)):
            bush(a, bx, by)
    # 앞 성벽
    fw = front_wall(70, 0)
    put(a, fw, 13, 93 - fw.shape[0])
    # 뒤 모서리 탑 + 앞 모서리 탑 (원본 4탑이 위아래로 이어 서는 모양)
    t = fat_tower(1)
    th = t.shape[0]
    for x in (0, 82):
        put(a, t, x, 93 - 2 * th + 2)
        put(a, t, x, 94 - th)
    return a


def low_front(width, gate=True):
    """앞 성벽을 세로로 줄인 것(16행): 흉벽 줄+첫 띠는 그대로, 가운데 돌 줄을 덜어 문까지 붙인다."""
    fw = front_wall(width, 0)
    return np.concatenate([fw[:7], fw[13:]], axis=0)


def fort():
    W = H = 64
    a = blank(W, H)
    court = np.zeros((H, W), bool)
    court[24:50, 13:51] = True
    dither_grass(a, court)
    put(a, back_wall(38), 13, 18)
    k = keep_plain(0, 4)
    put(a, k, 14 + (36 - k.shape[1]) // 2, 0)
    cobble(a, 30, 38, 33, 49)
    for x, y, k2, wd in ((15, 27, 'red', 0), (38, 27, 'brown', 0)):
        put(a, nobush(house(k2, wd)), x, y)
    for bx, by in ((27, 36), (36, 41), (14, 40), (47, 38)):
        bush(a, bx, by)
    fw = low_front(38)
    put(a, fw, 13, 63 - fw.shape[0])
    t = fat_tower(0)
    th = t.shape[0]
    for x in (0, 50):
        put(a, t, x, 2)
        put(a, t, x, 64 - th)
    return a


def ship(a, x, y):
    """돛배(측면): 갈색 선체 + 기둥 + 흰 돛."""
    hull = [hexc('9a5435'), hexc('6d3b15'), hexc('d59147')]
    for dy, (x0, x1) in enumerate(((0, 17), (1, 16), (3, 14))):
        for xx in range(x0, x1):
            px(a, x + xx, y + 15 + dy, K if dy == 2 or xx in (x0, x1 - 1) else hull[dy % 2 if dy else 2])
    for xx in range(0, 17):
        px(a, x + xx, y + 14, K)
    for yy in range(3, 14):
        px(a, x + 8, y + yy, hexc('351803'))
    sail = [hexc('e8e4d8'), hexc('aec3b7')]
    for yy in range(4, 13):
        for xx in range(9, 9 + (yy - 2)):
            if xx < 16:
                px(a, x + xx, y + yy, sail[0] if xx < 9 + (yy - 2) - 2 else sail[1])
    for yy in range(5, 13):
        for xx in range(8 - (yy - 2) // 2, 8):
            px(a, x + xx, y + yy, sail[0] if xx < 7 else sail[1])
    px(a, x + 8, y + 2, hexc('c21919')); px(a, x + 9, y + 2, hexc('c21919'))


def harbor():
    W, H = 80, 64
    a = blank(W, H)
    court = np.zeros((H, W), bool)
    court[20:40, 13:67] = True
    dither_grass(a, court)
    put(a, back_wall(54), 13, 3)
    k = keep_plain(0, 5)
    put(a, k, 13 + (54 - k.shape[1]) // 2, 0)
    cobble(a, 38, 34, 41, 49)
    for x, y, k2, wd in ((15, 19, 'red', 1), (28, 19, 'brown', 0), (45, 19, 'slate', 0), (54, 19, 'red', 1)):
        put(a, nobush(house(k2, wd)), x, y)
    for bx, by in ((26, 32), (43, 33), (14, 32), (62, 31), (36, 22)):
        bush(a, bx, by)
    fw = low_front(54)
    put(a, fw, 13, 50 - fw.shape[0])
    t = fat_tower(0)
    th = t.shape[0]
    put(a, t, 0, 0); put(a, t, 66, 0)
    put(a, t, 0, 50 - th); put(a, t, 66, 50 - th)
    quay(a, 0, 80, 50)
    ship(a, 40, 46)
    return a


def quay(a, x0, x1, y0):
    """부두: 윗면(돌바닥) -> 앞면(어두운 돌) -> 말뚝 -> 물거품. 맨 아래 줄까지 내려가 바다와 맞닿는다."""
    top = [hexc('666484'), hexc('777394')]
    face = hexc('473f55'); face2 = hexc('373740'); foam = hexc('aec3b7')
    wood = hexc('6d3b15'); wood2 = hexc('9a5435')
    for y in range(y0, y0 + 4):
        for x in range(x0, x1):
            c = hexc('505362') if y == y0 + 3 else top[((x // 2) + y) % 2]
            px(a, x, y, c)
    for y in range(y0 + 4, y0 + 7):
        for x in range(x0, x1):
            px(a, x, y, face if (x + y) % 3 else face2)
    for x in range(x0, x1):
        px(a, x, y0 + 7, K)
    for x in range(x0 + 2, x1 - 1, 16):
        for y in range(y0 + 7, 64):
            px(a, x, y, K if y == 63 else wood2)
            px(a, x + 1, y, K if y == 63 else wood)
        px(a, x - 1, y0 + 7, K); px(a, x + 2, y0 + 7, K)
    for x in range(x0 + 6, x1 - 2, 16):
        px(a, x, 63, foam); px(a, x + 1, 62, foam)


if __name__ == '__main__':
    from PIL import Image
    os.makedirs('/tmp/w6', exist_ok=True)
    bgc = np.array((60, 60, 60), dtype=np.uint8)
    for n, f in (('capital', capital), ('fort', fort), ('harbor', harbor)):
        a = f(); b = a.copy(); b[is_key(a)] = bgc
        Image.fromarray(b).resize((a.shape[1] * 8, a.shape[0] * 8), Image.NEAREST).save('/tmp/w6/%s.png' % n)
