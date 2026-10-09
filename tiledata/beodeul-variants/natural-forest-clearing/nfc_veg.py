# 자연 숲 마당 식생 조각(손 도트, 버들항 px2 캔버스 + pz.fin 윤곽). 큰 나무(검은 수관+뿌리)·줄기 벽·어린 전나무·가는 고사리 나무·
# 덤불·낙엽 덤불·바위·풀 포기·별꽃·버섯·그루터기·통나무·갈대·연잎. 3/4 시점(윗면이 보이게), 빛 왼쪽 위. 결정적.
from nfc_base import *
from px2 import _hash
import nfc_auto as AU

CA = R7('nfcan')


# ================================================================ 공용: 잎 덩이(수관) 칠하기
def foliage(c, cx, cy, rx, ry, seed, mat='nfcan', core=1.0, rim=5.6, lobes=9, lobe_amp=0.16, fall=1.0, top_lit=True):
    """둥글고 울퉁불퉁한 잎 덩이: 둘레 반지름을 각도마다 흔들어 덩이 혹을 내고, 테(밝은 잎끝)에서 속(짙음/검정)으로 어두워진다.
    잎 비늘 결(nfc_auto.SCALE)로 잎 하나하나 빛·그늘. core = 속 톤(0 = 검정), rim = 테 톤."""
    c.new()
    ph = [_hash(k, 1, seed) * 6.28 for k in range(3)]
    def R(ang):
        return 1 + lobe_amp * (math.sin(ang * lobes + ph[0]) * 0.6 + math.sin(ang * (lobes + 4) + ph[1]) * 0.4)
    for y in range(int(cy - ry * 1.3) - 1, int(cy + ry * 1.3) + 2):
        for x in range(int(cx - rx * 1.3) - 1, int(cx + rx * 1.3) + 2):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            ang = math.atan2(dy, dx); d = math.hypot(dx, dy) / R(ang)
            if d > 1.0: continue
            depth = (1 - d) * min(rx, ry)                                 # 테에서 안쪽 깊이(px)
            lit = (-dx - dy) * 0.5 if top_lit else 0                       # 왼쪽 위 빛
            t = rim - depth * 0.42 * fall + lit * 1.2 + AU.SCALE[y % 16, x % 16] * 0.9 + (AU.LEAFN[y % 16, x % 16] - 0.5) * 0.7
            if dy > 0.55: t -= (dy - 0.55) * 2.2                          # 아래쪽 그늘
            t = max(core, t)
            if d > 0.93 and _hash(x, y, seed + 3) < 0.25: continue        # 테 1px 들쭉날쭉
            c.tone(x, y, mat, int(round(max(0, min(6, t)))))


def bark_trunk(c, x0, x1, ytop, ybot, seed, mat='nfbark', groove=4):
    """붉은 갈색 줄기(세로 결 홈): 왼쪽 밝음·오른쪽 그늘, 홈은 2단 짙게, 껍질 비늘 점."""
    c.new()
    w = x1 - x0
    for y in range(ytop, ybot):
        for x in range(x0, x1):
            u = (x - x0 + 0.5) / w
            t = 5 if u < 0.25 else (4 if u < 0.5 else (3 if u < 0.78 else 2))
            if (x - x0 + int(_hash(x // groove, y // 7, seed) * 2)) % groove == groove - 1: t -= 2
            if _hash(x, y, seed + 1) > 0.9: t += 1
            if _hash(x, y // 2, seed + 2) > 0.95: t -= 1
            c.tone(x, y, mat, max(1, min(6, t)))


def roots(c, cx, ybot, spread, seed, mat='nfbark', n=6):
    """뿌리: 밑동에서 좌우로 낮게 퍼지는 굵은 뿌리(위 밝음 아래 그늘), 끝은 가늘어진다."""
    c.new()
    for i in range(n):
        side = -1 if i % 2 == 0 else 1
        L = spread * (0.55 + 0.45 * _hash(i, 1, seed))
        x0 = cx + side * (2 + _hash(i, 2, seed) * 5)
        y0 = ybot - 3 - _hash(i, 3, seed) * 3
        for k in range(int(L)):
            f = k / L
            x = x0 + side * k; y = y0 + f * (2.5 + _hash(i, 4, seed) * 2) + math.sin(k * 0.6 + i) * 0.5
            th = max(1, int(round(3 * (1 - f))))
            for j in range(th):
                c.tone(int(round(x)), int(round(y)) + j, mat, (5 if j == 0 else (3 if j < th - 1 else 2)) - (1 if f > 0.7 else 0))


# ================================================================ 큰 나무(검은 수관 + 뿌리)
def big_tree(seed=1101, flip=False):
    c = C(64, 80, seed=seed); c.shadow(32, 76, 24, 4, 90)
    c.group(1)
    # 줄기 다발(셋이 붙은 굵은 줄기) y 40~76, 폭 ~24
    bark_trunk(c, 21, 31, 40, 76, seed + 1)
    bark_trunk(c, 29, 39, 38, 77, seed + 2)
    bark_trunk(c, 36, 44, 44, 75, seed + 3)
    roots(c, 32, 78, 18, seed + 4, n=8)
    # 수관(검은 속 + 회록 테) — 줄기 윗부분을 덮는다
    c.group(2)
    foliage(c, 32, 26, 30, 21, seed + 5, core=0, rim=5.4, fall=1.25)
    for (ox, oy, r) in ((-18, 8, 11), (19, 9, 10), (-4, 14, 12)):              # 아래 잎 덩이(수관 밑 테가 둥글게 겹친다)
        foliage(c, 32 + ox, 26 + oy, r * 1.15, r * 0.8, seed + 7 + ox, core=0, rim=4.4, fall=1.4)
    im = F(c)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


# ================================================================ 줄기 벽(북쪽 숲 가장자리)
def trunk_wall(seed=1201, W=48):
    """3x3칸(가로로 이어 찍는다, 48 감김): 줄 0 = 수관 그늘 속 줄기 윗부분(짙음), 줄 1~2 = 빽빽한 붉은 갈색 줄기 열 + 밑동 뿌리,
    맨 아래 몇 px 은 뿌리 사이로 땅이 보인다(투명). 수관 벽 오토타일의 남쪽 테가 줄 0 위를 덮는다."""
    c = C(W, 48, seed=seed)
    xs = []; x = 0
    while x < W:                                                          # 줄기 폭 6~9, 사이 0~1px
        w = 6 + int(_hash(len(xs), 1, seed) * 4); xs.append((x, w)); x += w + (1 if _hash(len(xs), 2, seed) > 0.6 else 0)
    for i, (x0, w) in enumerate(xs):
        bot = 42 + int(_hash(i, 3, seed) * 4)
        c.group(10 + i)
        bark_trunk(c, x0, min(W, x0 + w), 0, bot, seed + i * 7)
        for y in range(0, 20):                                             # 위쪽은 수관 그늘(두 단 어둡게)
            for xx in range(x0, min(W, x0 + w)):
                if c.m[y][xx]: c.fix[y][xx] = max(1, (c.fix[y][xx] or 3) - (2 if y < 12 else 1))
        for (dx, t) in ((-2, 3), (-1, 4), (w, 2), (w + 1, 2)):            # 밑동이 벌어진다
            for yy in range(bot - 3, bot):
                if 0 <= x0 + dx < W: c.tone(x0 + dx, yy, 'nfbark', t if yy > bot - 3 else t - 1)
    # 잎 그늘 술(위 끝): 짙은 수관 잎이 줄기 꼭대기를 덮는다(오토타일 테와 이어진다)
    c.group(99); c.new()
    for xx in range(W):
        h = 3 + int(2.5 * (1 + math.sin(2 * math.pi * xx / 12 + 0.6)) + _hash(xx, 1, seed) * 2)
        for y in range(h): c.tone(xx, y, 'nfcan', 1 if y < h - 1 else 2)
    # 줄기 사이 덩굴·고사리 조금
    for i in range(5):
        xx = int(_hash(i, 9, seed) * W); yy = 24 + int(_hash(i, 10, seed) * 14)
        for k in range(6): c.tone((xx + (k % 2)) % W, yy + k, 'nfgrass', 3 if k % 2 else 4)
    im = c.img(False)
    # 바깥 윤곽 없이(가로로 이어지므로) 아래만 윤곽: 줄기 밑변 1px 짙게
    p = im.load()
    for x in range(W):
        for y in range(47, 0, -1):
            if p[x, y][3]:
                r, g, b, a = p[x, y]; p[x, y] = (int(r * 0.62), int(g * 0.62), int(b * 0.62), a); break
    return im


def trunk_wall_end(seed=1301, right=False):
    """줄기 벽 끝(1x3칸): 굵은 줄기 하나가 길·빈터 쪽으로 뿌리를 뻗으며 벽이 끝난다(오른쪽 끝은 좌우 뒤집음)."""
    c = C(16, 48, seed=seed)
    c.group(1)
    bark_trunk(c, 2, 11, 0, 44, seed)
    for y in range(0, 18):
        for xx in range(2, 11):
            if c.m[y][xx]: c.fix[y][xx] = max(1, (c.fix[y][xx] or 3) - (2 if y < 10 else 1))
    roots(c, 7, 47, 9, seed + 2, n=4)
    c.group(2); c.new()
    for xx in range(0, 13):
        h = 4 + int(2 * math.sin(xx * 0.7) + 2)
        for y in range(h): c.tone(xx, y, 'nfcan', 1 if y < h - 1 else 2)
    im = F(c)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if right else im


if __name__ == '__main__':
    ims = [big_tree(), big_tree(1111, True), trunk_wall(), trunk_wall_end(), trunk_wall_end(1302, True)]
    W = sum(i.width for i in ims) + 8 * len(ims); H = max(i.height for i in ims)
    o = Image.new('RGBA', (W, H), (132, 150, 74, 255)); x = 0
    for i in ims: o.alpha_composite(i, (x, H - i.height)); x += i.width + 8
    o.resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(HERE, '_qa', 'veg1.png')); print('ok')
