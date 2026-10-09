# 자연 숲 마당 구조물·생활 소품(손 도트, 3/4 시점, 빛 왼쪽 위): 통나무 오두막(회색 판벽·창·검은 문)·나무 상자·통·장작 더미·
# 도끼 그루터기·꽃 상자·표지판 말뚝·채소(당근·양배추·순무·새싹). 결정적.
from nfc_base import *
from px2 import _hash
import nfc_veg as V

PLc = R7('nfplank'); WAc = R7('nfwater'); CAc = R7('nfcan'); RKc = R7('nfrock'); CRc = R7('nfcrate'); VGc = R7('nfveg')


class Pix:
    """간단한 화소 캔버스(재료 7단 톤으로 찍기)."""
    def __init__(s, w, h):
        s.im = Image.new('RGBA', (w, h)); s.p = s.im.load(); s.w, s.h = w, h
    def t(s, x, y, mat, k):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.p[x, y] = R7(mat)[max(0, min(6, int(k)))] + (255,)
    def get(s, x, y): return s.p[x, y] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)


# ================================================================ 통나무 오두막(7x6칸)
def cabin(seed=2101):
    """7x6칸 오두막: 위 3줄 = 회색 세로 널 지붕(용마루 가로 널·처마 그늘), 아래 3줄 = 가로 통나무 판벽, 양 끝 모서리 기둥,
    네 칸 유리 창 둘(짙은 청록 유리·회색 창틀·창턱), 가운데(4째 칸) 검은 문간(문틀 기둥·상인방·돌 문턱), 밑 주춧돌 줄, 모서리 담쟁이."""
    W, H = 112, 96
    P_ = Pix(W, H)
    # --- 지붕 (y 0..45): 세로 널 6px, 위가 빛 받아 밝다
    for y in range(4, 44):
        for x in range(0, W):
            bx = (x + (3 if (x // 6) % 3 == 1 else 0)) % 6
            k = 5 if bx == 0 else (4 if bx < 3 else (3 if bx < 5 else 1))
            if y > 30: k -= 1
            if y > 40: k -= 1
            if _hash(x, y // 3, seed) > 0.93: k -= 1
            if _hash(x // 6, y // 9, seed + 1) > 0.85 and bx in (1, 2): k += 1     # 널마다 결 얼룩
            P_.t(x, y, 'nfplank', max(1, k))
    for x in range(0, W):                                               # 용마루 가로 널(윗면 밝음 + 앞모)
        P_.t(x, 1, 'nfplank', 6 if x % 9 else 4); P_.t(x, 2, 'nfplank', 5); P_.t(x, 3, 'nfplank', 3); P_.t(x, 4, 'nfplank', 1)
        P_.t(x, 0, 'nfplank', 4)
    for x in range(0, W):                                               # 처마 끝 널 + 처마 밑 그늘
        P_.t(x, 44, 'nfplank', 4 if x % 6 else 2); P_.t(x, 45, 'nfplank', 1)
    # --- 벽 (y 46..91): 가로 통나무 5px 줄
    for y in range(46, 92):
        ly = (y - 46) % 5
        for x in range(3, W - 3):
            k = (5 if ly == 0 else (4 if ly < 3 else (3 if ly == 3 else 1)))
            if _hash(x // 5, (y - 46) // 5, seed + 2) > 0.8 and ly in (1, 2): k -= 1
            if _hash(x, y, seed + 3) > 0.95: k += 1
            if y < 50: k -= 2                                            # 처마 그늘
            P_.t(x, y, 'nfplank', max(1, k))
    for x0 in (3, W - 9):                                               # 모서리 기둥(통나무 끝)
        for y in range(46, 92):
            for i in range(6):
                k = (5 if i < 2 else (4 if i < 4 else 2)) - (2 if y < 50 else 0)
                P_.t(x0 + i, y, 'nfplank', max(1, k))
        for y in range(48, 92, 5):
            for i in range(1, 5): P_.t(x0 + i, y, 'nfplank', 2)
    # --- 창 둘
    for wx in (16, 78):
        wy = 58
        for y in range(wy - 2, wy + 16):
            for x in range(wx - 2, wx + 18):
                P_.t(x, y, 'nfplank', 5 if (x < wx or y < wy) else 3)
        for y in range(wy, wy + 14):
            for x in range(wx, wx + 16):
                col = (x - wx) // 8; row = (y - wy) // 7; lx = (x - wx) % 8; ly = (y - wy) % 7
                if lx == 7 or ly == 6: P_.t(x, y, 'nfplank', 4 if lx == 7 else 3); continue
                k = 2 if (lx + ly) > 5 else 3
                if lx == 1 and ly == 1: k = 6
                elif lx < 3 and ly < 2: k = 5
                P_.t(x, y, 'nfwater', k)
        for x in range(wx - 3, wx + 19): P_.t(x, wy + 16, 'nfplank', 6); P_.t(x, wy + 17, 'nfplank', 2)
    # --- 문간(4째 칸, x 48..63) — 문틀 기둥 x 45..47 · 64..66, 상인방 y 52..55
    for y in range(52, 92):
        for x in range(45, 67):
            if 48 <= x < 64 and y >= 56:
                k = 0 if y < 84 else 1
                if y >= 86 and (x + y) % 5 == 0: k = 2                     # 안쪽 마룻바닥 희미하게
                P_.t(x, y, 'nfcan', k)
            elif y < 56:
                P_.t(x, y, 'nfplank', 6 if y == 52 else (5 if y == 53 else (3 if y == 54 else 1)))
            else:
                i = x - 45 if x < 48 else x - 64
                P_.t(x, y, 'nfplank', (5, 4, 2)[i])
    # --- 문턱 돌 + 주춧돌 줄
    for x in range(3, W - 3):
        k = 4 if ((x // 7) % 2) else 5
        if x % 7 == 6: k = 1
        P_.t(x, 92, 'nfrock', k + 1); P_.t(x, 93, 'nfrock', k); P_.t(x, 94, 'nfrock', k - 1); P_.t(x, 95, 'nfrock', 1)
    for x in range(46, 66): P_.t(x, 91, 'nfrock', 6); P_.t(x, 92, 'nfrock', 5)
    im = pz.fin(P_.im, 0.62)
    # --- 모서리 담쟁이(왼쪽 기둥·오른쪽 창가)
    c = C(W, H, seed=seed + 5); c.new()
    for (x0, y0, L) in ((6, 40, 34), (98, 46, 24), (40, 44, 16)):
        x = x0
        for k in range(L):
            y = y0 + k; x += (1 if _hash(k, 1, seed + x0) > 0.6 else (-1 if _hash(k, 2, seed + x0) > 0.7 else 0))
            c.tone(x, y, 'nfveg', 3)
            if k % 3 == 0: c.tone(x - 1, y, 'nfveg', 5); c.tone(x + 1, y + 1, 'nfveg', 4); c.tone(x, y + 1, 'nfveg', 2)
    im.alpha_composite(c.img(False))
    return im


# ================================================================ 나무 상자 · 통
def crate(seed=2201):
    """바랜 나무 상자(1x1): 윗면 판 3줄(밝음) + 앞면 테두리 널 + Z 버팀대."""
    P_ = Pix(16, 16)
    for y in range(1, 5):
        for x in range(1, 15): P_.t(x, y, 'nfcrate', 6 if (x % 5 == 1) else 5)
    for y in range(5, 15):
        for x in range(1, 15):
            edge = x < 3 or x > 12 or y < 7 or y > 12
            k = 4 if edge else 3
            dz = abs((x - 3) - (12 - y) * 10 / 6)                          # 대각 버팀대
            if not edge and dz < 1.6: k = 5
            if x == 14 or y == 14: k = 2
            P_.t(x, y, 'nfcrate', k)
    for x in range(1, 15): P_.t(x, 5, 'nfcrate', 3)
    return pz.fin(P_.im, 0.62)


def crate_stack():
    """상자 더미(2x2): 아래 둘 + 위 하나(왼쪽으로 치우침)."""
    im = Image.new('RGBA', (32, 32))
    a = crate(2201); b = crate(2211); c_ = crate(2221)
    im.alpha_composite(a, (0, 16)); im.alpha_composite(b, (15, 16)); im.alpha_composite(c_, (4, 3))
    return im


def barrel(seed=2301):
    """세운 나무 통(1x1): 타원 뚜껑(테 짙음·판 밝음) + 볼록한 통 몸(세로 널 명암) + 쇠테 두 줄."""
    c = C(16, 16, seed=seed); c.shadow(8, 15, 6.5, 1.4, 90)
    c.group(1); c.new()
    for y in range(4, 15):
        bulge = 6.2 + 0.8 * math.sin(math.pi * (y - 4) / 10)
        for x in range(int(8 - bulge), int(8 + bulge) + 1):
            u = (x + 0.5 - (8 - bulge)) / (2 * bulge)
            k = 5 if u < 0.25 else (4 if u < 0.5 else (3 if u < 0.78 else 2))
            if int((x - 2) * 1.0) % 3 == 2: k -= 1
            if y in (6, 7, 11, 12): k = (3 if y in (6, 11) else 1) if u < 0.6 else 1; c.tone(x, y, 'nfplank', k); continue
            c.tone(x, y, 'nfcrate', max(1, k - 1))
    for y in range(1, 6):
        for x in range(2, 15):
            dx = (x + 0.5 - 8.5) / 6.4; dy = (y + 0.5 - 3.5) / 2.4
            r = dx * dx + dy * dy
            if r <= 1: c.tone(x, y, 'nfcrate', 2 if r > 0.6 else (5 if dx + dy < 0 else 4))
    return F(c)


def barrel_stack():
    """통 더미(2x2): 아래 둘 + 위 하나."""
    im = Image.new('RGBA', (32, 32))
    im.alpha_composite(barrel(2301), (0, 16)); im.alpha_composite(barrel(2311), (15, 16)); im.alpha_composite(barrel(2321), (8, 4))
    return im


# ================================================================ 장작 더미 · 도끼 그루터기 · 꽃 상자
def woodpile(seed=2401):
    """장작 더미(2x1): 단면(크림색 나이테)이 보이게 세 단으로 쌓은 통나무, 양끝 말뚝."""
    c = C(32, 16, seed=seed); c.shadow(16, 15, 15, 1.4, 90)
    c.group(1)
    rows = [(14, 6), (9.5, 5), (5, 4)]
    for r, (cy, n) in enumerate(rows):
        for i in range(n):
            cx = 16 - (n - 1) * 2.6 + i * 5.2
            c.new()
            for y in range(int(cy - 3), int(cy + 3)):
                for x in range(int(cx - 3), int(cx + 3)):
                    dx = (x + 0.5 - cx) / 2.6; dy = (y + 0.5 - cy) / 2.5
                    rr = dx * dx + dy * dy
                    if rr <= 1: c.tone(x, y, 'nfcrate' if rr < 0.55 else 'nfbark', (5 if rr < 0.15 else (4 if rr < 0.55 else 3)) if rr < 0.55 else (4 if dx + dy < 0 else 2))
    c.new()
    for y in range(2, 16): c.tone(1, y, 'nfbark', 4); c.tone(2, y, 'nfbark', 2); c.tone(29, y, 'nfbark', 4); c.tone(30, y, 'nfbark', 2)
    return F(c)


def chop_block(seed=2451):
    """도끼 박힌 그루터기(1x1)."""
    im = V.stump(seed)
    c = C(16, 16, seed=seed); c.new()
    for k in range(7): c.tone(9 + k // 2, 5 - k, 'nfbark', 5 if k % 2 else 4)       # 자루
    for (x, y, t) in ((6, 5, 5), (7, 5, 6), (8, 5, 5), (6, 6, 4), (7, 6, 4), (8, 6, 3)): c.tone(x, y, 'nfrock', t)   # 날
    im.alpha_composite(F(c))
    return im


def planter(seed=2501):
    """꽃 상자(1x1): 나무 화분 상자에 자줏빛 꽃 무리."""
    c = C(16, 16, seed=seed); c.new()
    for y in range(9, 15):
        for x in range(2, 14): c.tone(x, y, 'nfcrate', 5 if y == 9 else (4 if x < 9 else 3))
    for x in range(2, 14): c.tone(x, 10, 'nfcrate', 3)
    c.new()
    for i in range(14):
        x = 3 + _hash(i, 1, seed) * 10; y = 3 + _hash(i, 2, seed) * 6
        c.tone(int(x), int(y), 'pink', 5 if _hash(i, 3, seed) > 0.5 else 4); c.tone(int(x), int(y) + 1, 'nfveg', 3)
    for x in range(3, 13): c.tone(x, 8, 'nfveg', 4 if x % 2 else 3)
    return F(c)


# ================================================================ 표지판 말뚝
def sign_post(seed=2601, arrow=False):
    """표지판 말뚝(1x2칸): 땅에 박은 말뚝 + 판자(글자 없음 — 나뭇결·못만). arrow = 화살 모양 판(오른쪽)."""
    c = C(16, 32, seed=seed); c.shadow(8, 30.5, 4, 1.2, 80)
    c.group(1); c.new()
    for y in range(8, 31): c.tone(7, y, 'nfbark', 5); c.tone(8, y, 'nfbark', 3)
    c.group(2); c.new()
    for y in range(8, 16):
        for x in range(1, 15):
            if arrow:
                tip = 15 - abs(y - 11.5) * 1.2
                if x > tip: continue
            k = 5 if y == 8 else (4 if y < 12 else 3)
            if y == 15: k = 2
            if (x + y * 3) % 7 == 0: k -= 1
            c.tone(x, y, 'nfcrate', k)
    c.tone(3, 10, 'nfrock', 2); c.tone(12 if not arrow else 10, 10, 'nfrock', 2)
    return F(c)


# ================================================================ 채소(밭 이랑 칸 하나에 한 포기)
def crop(kind, seed=2701):
    """carrot = 깃털 잎 + 흙 위로 비친 주황 머리, cabbage = 둥근 연녹 결구(겉잎 짙게), turnip = 흰 뿌리 + 잎, sprout = 새싹 셋."""
    c = C(16, 16, seed=seed)
    if kind == 'carrot':
        c.new()
        for (x, y) in ((6, 11), (7, 11), (8, 11), (9, 11), (7, 12), (8, 12)): c.tone(x, y, 'nfcarrot', 5 if x < 8 else 4)
        c.tone(7, 13, 'nfcarrot', 3)
        for ang in (-2.4, -1.9, -1.57, -1.2, -0.7):
            for i in range(1, 8):
                x = 7.5 + math.cos(ang) * i; y = 10.5 + math.sin(ang) * i
                c.tone(int(round(x)), int(round(y)), 'nfveg', 5 if ang < -1.5 else 4)
                if i % 2 == 0: c.tone(int(round(x)) + 1, int(round(y)), 'nfveg', 3)
    elif kind == 'cabbage':
        c.ellipsoid(8, 9, 6.5, 5.2, 'nfveg', bias=-0.1, bump=0.4)
        c.ellipsoid(8, 8.5, 3.8, 3.2, 'lily', bias=0.1)
        c.new()
        for a in range(6):
            ang = a * 1.05
            for k in range(1, 4): c.tone(int(8 + math.cos(ang) * k * 1.3), int(8.5 + math.sin(ang) * k), 'lily', 3)
    elif kind == 'turnip':
        c.ellipsoid(8, 11, 3.8, 3.2, 'nfflower', bias=0.05)
        c.new(); c.tone(8, 14, 'pink', 4); c.tone(6, 9, 'pink', 5); c.tone(7, 9, 'pink', 5)
        for ang in (-2.2, -1.57, -0.9):
            for i in range(1, 7):
                c.tone(int(round(8 + math.cos(ang) * i * 0.9)), int(round(8 + math.sin(ang) * i)), 'nfveg', 5 if ang < -1.5 else 4)
                c.tone(int(round(8 + math.cos(ang) * i * 0.9)) + 1, int(round(8 + math.sin(ang) * i)), 'nfveg', 3)
    else:
        for (x0, y0) in ((4, 11), (8, 8), (11, 12)):
            c.new()
            c.tone(x0, y0 + 1, 'nfveg', 2); c.tone(x0, y0, 'nfveg', 3)
            c.tone(x0 - 1, y0 - 1, 'nfveg', 5); c.tone(x0 - 2, y0 - 1, 'nfveg', 4); c.tone(x0 + 1, y0 - 1, 'nfveg', 4); c.tone(x0 + 2, y0 - 2, 'nfveg', 5)
    return F(c)


if __name__ == '__main__':
    import nfc_ground as G
    ims = [cabin(), crate(), crate_stack(), barrel(), barrel_stack(), woodpile(), chop_block(), planter(), sign_post(), sign_post(2611, True),
           crop('carrot'), crop('cabbage'), crop('turnip'), crop('sprout')]
    gt = G.ground_grass(); soil = G.ground_garden_soil()
    W = sum(i.width + 6 for i in ims); H = 100
    o = Image.new('RGBA', (W, H))
    for yy in range(0, H, 48):
        for xx in range(0, W, 48): o.alpha_composite(gt, (xx, yy))
    x = 0
    for i in ims:
        if i.width == 16 and i.height == 16 and ims.index(i) >= 10: o.alpha_composite(soil.crop((0, 0, 16, 16)), (x, H - 16))
        o.alpha_composite(i, (x, H - i.height)); x += i.width + 6
    o.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'struct.png')); print('ok')
