# REFMAP 연구판 32px 소품 15종. 모두 drawr 의 수식으로 새로 그린다.
# 반환: Prop(im, fw, fh, kind)  kind: floor(바닥에 섬) / wall(북벽에 붙어 벽면 위로 솟음) / hang(벽면에 걸림) / flat(바닥에 깖)
#       이미지 아래 fh*32 가 발 칸, 그 위(up)는 뒤 칸 위로 솟는다.
import math
from drawr import Cv, H, cyl, dome, grain, clamp

S = 32
class Prop:
    def __init__(s, im, fw, fh, kind, ko):
        s.im, s.fw, s.fh, s.kind, s.ko = im, fw, fh, kind, ko
        s.up = im.height - fh * S if kind in ('floor', 'wall') else 0

# ---------------------------------------------------------------- 공통 부재
def top_face(c, x0, y0, x1, y1, m, base, plank=8, vertical=True, seed=1):
    """위에서 본 판: 판자 이음 한 단 어둡게, 결은 두 톤, 뒤(위)쪽 1px 밝은 테, 앞(아래)쪽 1px 어두운 테."""
    def f(x, y, u, v):
        k = (x - x0) if vertical else (y - y0)
        seam = (k % plank == plank - 1)
        idx = k // plank
        b = base + (H(idx, 3, seed) - .5) * 0.06 + (0.02 - 0.05 * v)      # 뒤가 조금 밝다
        if seam: return b - 0.10
        g = grain(y if vertical else x, x if vertical else y, seed + idx, 0.03, 11.0, 0.55)
        return b + g
    c.fill(x0, y0, x1, y1, m, f)
    for x in range(x0, x1 + 1): c.add(x, y0, 0.10)
    for y in range(y0, y1 + 1): c.add(x0, y, 0.05)

def front_face(c, x0, y0, x1, y1, m, base, lip=True):
    """앞면(세로면): 몸통보다 한 단 어둡고 아래로 갈수록 조금 더 어둡다. 윗단 1px 입술만 밝다."""
    c.fill(x0, y0, x1, y1, m, lambda x, y, u, v: base - 0.06 * v - (0.03 if u > 0.94 else 0))
    if lip:
        for x in range(x0, x1 + 1): c.add(x, y0, 0.12)

def post(c, x0, x1, y0, y1, m, base):
    """세로 기둥: 원통 명암"""
    w = x1 - x0 + 1
    c.fill(x0, y0, x1, y1, m, lambda x, y, u, v: cyl(u, base, 0.22))

def finish(c, cast=True, dx=3, dy=2, rows_from=None, contact=None):
    if cast: c.cast(dx, dy, rows_from)
    c.outline()
    if contact: c.contact(*contact)
    return c.img()

def loaf(c, cx, cy, rx, ry, cuts=2, seed=0):
    c.ell(cx, cy, rx, ry, 'crust', lambda x, y, dx, dy: dome(dx, dy, 0.58, 0.36))
    for k in range(cuts):                                                     # 칼집: 어두운 사선 + 밝은 속
        x0 = cx - rx * 0.5 + k * rx * 0.9 / max(1, cuts - 1 if cuts > 1 else 1)
        for j in range(-2, 3):
            c.add(x0 + j * 0.6, cy + j, -0.18); c.add(x0 + j * 0.6 + 1, cy + j, 0.16)

# ---------------------------------------------------------------- 1 식탁 2×2
def dining():
    c = Cv(64 + 4, 64)
    top_face(c, 1, 2, 62, 48, 'oak', 0.50, plank=8, vertical=True, seed=11)
    for x in range(2, 62): c.add(x, 3, 0.05)
    # 앞 두께 (윗면 아래 5px) → 다리
    front_face(c, 1, 49, 62, 53, 'oak', 0.30)
    for x in range(2, 62): c.put(x, 54, 'oak', 0.18)          # 판 밑 그늘
    for x0 in (2, 57):
        post(c, x0, x0 + 3, 54, 61, 'oak', 0.34)
    for x0 in (8, 51):                                        # 저편 다리 (어둡고 짧다)
        c.fill(x0, 54, x0 + 2, 57, 'oak', 0.14)
    # 탁자 위: 빵 도마 + 둥근 빵, 대접, 잔 (탁자로 읽히게 — REFMAP 탁자는 늘 무언가를 얹는다)
    c.fill(10, 16, 27, 27, 'pine', lambda x, y, u, v: 0.70 - 0.12 * v)
    for x in range(10, 28): c.put(x, 28, 'pine', 0.34)
    loaf(c, 18.5, 21, 6.5, 4.2, 2, 3)
    c.ell(41, 20, 6.5, 4.5, 'clay', lambda x, y, dx, dy: 0.34 + 0.1 * dy if dx * dx + dy * dy < 0.45 else 0.56 - 0.2 * dx)
    c.ell(41, 19.5, 4.2, 2.6, 'linen', lambda x, y, dx, dy: 0.84 - 0.1 * dy)          # 대접 속 반죽
    for x in range(36, 47): c.put(x, 25, 'clay', 0.30)
    c.ell(50, 33, 3, 2.4, 'iron', lambda x, y, dx, dy: 0.62 - 0.2 * dx)
    c.ell(50, 32.6, 1.8, 1.2, 'iron', 0.24)
    for x in range(48, 53): c.put(x, 35, 'iron', 0.3)
    im = finish(c, dx=4, dy=2, rows_from=40)
    return Prop(im, 2, 2, 'floor', '식탁')

# ---------------------------------------------------------------- 2 의자 (S: 탁자 북쪽, 등받이가 뒤 / N: 탁자 남쪽, 등받이가 앞)
def chair(face='S'):
    c = Cv(36, 36)
    def seat(y0):
        # 앉는 판: 위에서 본 둥근 모서리 사각 (앞이 조금 넓다), 가운데 살짝 볼록
        for y in range(y0, y0 + 9):
            k = (y - y0) / 8; a = 7 - k; b = 24 + k
            for x in range(int(a), int(b) + 1):
                if (y == y0 or y == y0 + 8) and (x <= a + 1 or x >= b - 1): continue
                u = (x - a) / (b - a)
                c.put(x, y, 'oak', 0.52 + 0.08 * math.cos((u - .4) * math.pi) - 0.05 * k)
        for x in range(6, 26): c.put(x, y0 + 9, 'oak', 0.30)          # 앞 두께
    if face == 'S':
        post(c, 8, 10, 4, 16, 'oak', 0.46); post(c, 21, 23, 4, 16, 'oak', 0.38)
        c.fill(8, 2, 23, 5, 'oak', lambda x, y, u, v: 0.60 - 0.16 * v)          # 윗가로대
        c.fill(9, 2, 22, 2, 'oak', 0.70)
        c.fill(8, 9, 23, 10, 'oak', 0.40)                                        # 가운데 가로살
        seat(14)
        post(c, 7, 9, 24, 30, 'oak', 0.36); post(c, 22, 24, 24, 30, 'oak', 0.30)
        c.fill(12, 24, 13, 27, 'oak', 0.16); c.fill(18, 24, 19, 27, 'oak', 0.16)
    else:
        # 탁자 남쪽 의자: 등받이 뒷면이 앞에 와서 앉는 판 위로 솟는다. 판은 기둥 사이·아래로만 보인다.
        seat(10)
        post(c, 8, 10, 2, 30, 'oak', 0.44); post(c, 21, 23, 2, 30, 'oak', 0.34)
        c.fill(8, 2, 23, 5, 'oak', lambda x, y, u, v: 0.58 - 0.16 * v)          # 윗가로대
        c.fill(9, 2, 22, 2, 'oak', 0.68)
        c.fill(11, 6, 20, 13, 'oak', lambda x, y, u, v: 0.40 - 0.06 * v)        # 등판 (통판)
        for x in range(11, 21): c.add(x, 6, -0.12)
        c.fill(8, 14, 23, 15, 'oak', 0.34)                                       # 아래 가로살
        c.fill(12, 21, 13, 27, 'oak', 0.16); c.fill(18, 21, 19, 27, 'oak', 0.16)
    im = finish(c, dx=3, dy=2, rows_from=20)
    return Prop(im, 1, 1, 'floor', '의자')

# ---------------------------------------------------------------- 3 침대 1×2 (32×76)
def bed():
    W = 32; c = Cv(W + 3, 76)
    # 머리판: 통나무 기둥 둘(둥근 꼭지) + 가로대 둘 (REFMAP 식 통나무 침대를 32px 로 줄인 비례)
    for x0 in (0, W - 5):
        post(c, x0, x0 + 4, 3, 20, 'pine', 0.50)
        c.ell(x0 + 2.5, 3, 2.6, 2.2, 'pine', lambda x, y, dx, dy: dome(dx, dy, 0.62, 0.3))
    for y0 in (5, 12):
        c.fill(5, y0, W - 6, y0 + 3, 'pine', lambda x, y, u, v: 0.56 - 0.18 * v)
    c.fill(5, 9, W - 6, 11, 'pine', 0.22); c.fill(5, 16, W - 6, 18, 'pine', 0.20)
    # 요 (머리판 밑부터): 흰 천, 가로로 부드럽게 둥글다
    def sheet(x, y, u, v): return 0.80 + 0.10 * math.cos((u - 0.42) * math.pi) - 0.06 * v
    c.fill(1, 19, W - 2, 64, 'linen', sheet)
    # 베개: 둥근 덩이 + 가운데 눌린 자국
    def pil(x, y, u, v):
        ex = abs(u - .5) * 2; ey = abs(v - .5) * 2
        if ex > 0.86 and ey > 0.6: return None                                  # 모서리 둥글게
        return 0.90 - 0.14 * max(0, u - 0.55) - 0.18 * max(0, v - 0.6) + 0.04 * (1 - ex)
    c.fill(4, 21, 27, 30, 'linen', pil)
    for x in range(10, 21): c.add(x, 25 + (1 if 13 <= x <= 17 else 0), -0.08)
    for x in range(5, 28): c.add(x, 31, -0.10)
    # 이불: 청록, 윗단을 흰 시트 위로 접어 내림. 누운 몸 자리를 둥근 둔덕으로.
    def quilt(x, y, u, v):
        body = math.exp(-((u - 0.46) / 0.26) ** 2) * (1 - 0.5 * v)
        return 0.40 + 0.22 * body - 0.10 * (1 if u > 0.92 or u < 0.06 else 0) - 0.05 * v
    c.fill(0, 38, W - 1, 66, 'teal', quilt)
    for x in range(0, W): c.put(x, 36, 'linen', 0.90); c.put(x, 37, 'linen', 0.74)   # 접힌 시트 끝
    for x in range(0, W): c.add(x, 38, 0.10)
    for k, (x0, y0) in enumerate(((6, 43), (18, 47), (9, 55))):                       # 주름 (골 + 윗빛)
        for j in range(5):
            c.add(x0 + j // 2, y0 + j, -0.10); c.add(x0 + j // 2 - 1, y0 + j, 0.06)
    for x in range(0, W): c.put(x, 66, 'teal', 0.22 if H(x // 3, 1, 5) < .6 else 0.28)
    # 발치 판
    c.fill(0, 67, W - 1, 69, 'pine', lambda x, y, u, v: 0.58 - 0.12 * v)
    c.fill(0, 70, W - 1, 72, 'pine', 0.30)
    post(c, 0, 3, 67, 75, 'pine', 0.44); post(c, W - 4, W - 1, 67, 75, 'pine', 0.36)
    im = finish(c, dx=3, dy=2, rows_from=30)
    return Prop(im, 1, 2, 'wall', '침대')

# ---------------------------------------------------------------- 4 책장 2칸 (64×80): 앞면이 주인공, 윗판은 6px
BOOKS = ['red', 'teal', 'green', 'linen', 'brass', 'oak', 'red', 'teal', 'clay']
def bookshelf():
    c = Cv(64 + 3, 80)
    top_face(c, 0, 0, 63, 5, 'oak', 0.56, plank=64, vertical=False, seed=4)
    front_face(c, 0, 6, 63, 79, 'oak', 0.42, lip=True)
    for x0, x1 in ((0, 3), (60, 63), (30, 33)):                   # 옆판·가운데 칸막이
        c.fill(x0, 6, x1, 77, 'oak', lambda x, y, u, v: 0.48 - 0.08 * u)
    shelves = [(9, 28), (31, 50), (53, 72)]
    for si, (ya, yb) in enumerate(shelves):
        for bx0, bx1 in ((4, 29), (34, 59)):
            c.fill(bx0, ya, bx1, yb, 'oak', lambda x, y, u, v: 0.10 + 0.05 * v)     # 칸 속 (어둡게)
            for x in range(bx0, bx1 + 1): c.lock.add((x, ya))
            x = bx0 + 1; k = int(H(si, bx0, 3) * 9)
            while x < bx1 - 1:
                w = 3 + int(H(x, si, 7) * 3); h = (yb - ya) - 2 - int(H(x, si, 8) * 6)
                if H(x, si, 9) < 0.12: x += 2; continue          # 빈 틈
                if x + w > bx1: break
                m = BOOKS[k % len(BOOKS)]; k += 1
                base = 0.42 + (H(x, si, 10) - .5) * 0.16
                for xx in range(x, x + w):
                    u = (xx - x + .5) / w
                    for yy in range(yb - h, yb + 1):
                        c.put(xx, yy, m, cyl(u, base, 0.18))
                for xx in range(x, x + w): c.add(xx, yb - h, 0.12)                        # 책머리
                if h > 10:                                                                 # 등 띠 두 줄
                    for xx in range(x, x + w):
                        c.add(xx, yb - h + 3, -0.16); c.add(xx, yb - 3, -0.16)
                x += w
        # 선반 판: 윗면 2px 밝게 + 앞모서리
        c.fill(0, yb + 1, 63, yb + 2, 'oak', 0.60); c.fill(0, yb + 3, 63, yb + 3, 'oak', 0.34)
    c.fill(0, 76, 63, 79, 'oak', lambda x, y, u, v: 0.34 - 0.1 * v)   # 굽도리
    im = finish(c, dx=3, dy=2, rows_from=60)
    return Prop(im, 2, 1, 'wall', '책장')

# ---------------------------------------------------------------- 5 옷장 1×1 (32×72)
def wardrobe():
    c = Cv(35, 72)
    top_face(c, 0, 0, 31, 4, 'oak', 0.54, plank=40, vertical=False, seed=6)
    c.fill(0, 5, 31, 7, 'oak', lambda x, y, u, v: 0.46 - 0.12 * v)            # 처마 몰딩
    front_face(c, 1, 8, 30, 67, 'oak', 0.40, lip=False)
    for x0, x1 in ((3, 14), (17, 28)):                                          # 문 두 짝: 판넬 안쪽이 한 단 들어감
        c.fill(x0, 10, x1, 64, 'oak', lambda x, y, u, v: 0.44 - 0.05 * v)
        for ya, yb in ((13, 34), (38, 61)):
            c.fill(x0 + 2, ya, x1 - 2, yb, 'oak', lambda x, y, u, v: 0.36 - 0.04 * v + (0.05 if u < .15 else 0))
            for x in range(x0 + 2, x1 - 1): c.add(x, ya, -0.10); c.add(x, yb + 1, 0.10)
    c.fill(15, 9, 16, 65, 'oak', 0.16)                                          # 문 틈
    for x in (13, 18):
        c.ell(x + .5, 36.5, 1.4, 1.4, 'brass', lambda x, y, dx, dy: dome(dx, dy, 0.64, 0.4))
    c.fill(0, 66, 31, 71, 'oak', lambda x, y, u, v: 0.34 - 0.14 * v)          # 굽
    c.fill(3, 70, 28, 71, 'oak', 0.12)
    im = finish(c, dx=3, dy=2, rows_from=56)
    return Prop(im, 1, 1, 'wall', '옷장')

# ---------------------------------------------------------------- 6 빵 가마 2칸 (64×84): 벽돌 몸, 아치 입, 돌 턱
def oven(t=0):
    c = Cv(67, 80)
    # 굴뚝 (벽면 위로)
    c.fill(22, 0, 41, 20, 'brick', lambda x, y, u, v: 0.44 + 0.12 * math.cos((u - .35) * math.pi) - 0.1 * (1 if u > .9 else 0))
    for y in range(0, 21, 5):
        for x in range(22, 42): c.add(x, y, -0.14)
    for y in range(0, 21):
        off = 0 if (y // 5) % 2 == 0 else 5
        for x in range(22 + off, 42, 10): c.add(x, y, -0.12)
    c.fill(20, 0, 43, 2, 'stone', lambda x, y, u, v: 0.62 - 0.2 * v)
    # 둥근 몸통: 반타원 돔 + 앞면 벽돌
    def brickv(x, y, base):
        row = (y - 18) // 5; off = 0 if row % 2 == 0 else 5
        if (y - 18) % 5 == 4: return base - 0.16
        if (x + off) % 10 == 0: return base - 0.14
        return base + (H((x + off) // 10, row, 4) - .5) * 0.12
    c.ell(32, 40, 31.5, 22, 'brick', lambda x, y, dx, dy: brickv(x, y, dome(dx, dy, 0.52, 0.22)), y1=62)
    c.fill(1, 40, 62, 62, 'brick', lambda x, y, u, v: brickv(x, y, cyl(u, 0.48, 0.20)))
    # 아치 입: 돌 테 + 속 불빛
    for y in range(34, 61):
        for x in range(15, 49):
            dx = (x + .5 - 32) / 17; dy = (y + .5 - 48) / 14
            if dy < 0 and dx * dx + dy * dy > 1: continue
            r = (x + .5 - 32) / 13.5; q = (y + .5 - 50) / 11
            inner = abs(r) <= 1 and (q > 0 or r * r + q * q <= 1)
            if inner:
                glow = 1 - min(1, abs(r)) * 0.6 - max(0, -q) * 0.5
                c.put(x, y, 'fire', clamp(0.30 + 0.45 * glow + (0.12 if (x + y + t) % 5 == 0 and y > 52 else 0)))
                c.lock.add((x, y))
            else:
                c.put(x, y, 'stone', 0.66 - 0.2 * max(0, dy) + (H(x // 4, y // 3, 7) - .5) * 0.1)
    for x in range(20, 45):                                                   # 불 앞 잉걸 줄
        y = 58 - int(H(x // 2, t, 9) * 2)
        c.put(x, y, 'fire', 0.86); c.lock.add((x, y))
    # 돌 턱 (앞): 윗면 + 앞면
    c.fill(0, 62, 63, 66, 'stone', lambda x, y, u, v: 0.70 - 0.08 * v + (H(x // 8, 0, 2) - .5) * 0.08)
    for x in range(0, 64, 8): c.fill(x, 62, x, 66, 'stone', 0.44)
    front_face(c, 0, 67, 63, 75, 'stone', 0.44)
    for x in range(0, 64, 16): c.fill(x, 67, x, 75, 'stone', 0.30)
    c.fill(0, 76, 63, 79, 'stone', 0.26)
    # 불빛이 턱에 비친다
    for y in range(62, 67):
        for x in range(18, 46):
            c.add(x, y, 0.10 * (1 - abs(x - 32) / 14))
    im = finish(c, dx=3, dy=2, rows_from=64)
    return Prop(im, 2, 1, 'wall', '빵 가마')

# ---------------------------------------------------------------- 7 통 (32×40)
def barrel():
    c = Cv(36, 40)
    rows = [10.2 + 2.4 * math.sin(math.pi * j / 27) for j in range(28)]
    for j, hw in enumerate(rows):
        y = 10 + j
        for x in range(int(16 - hw), int(16 + hw) + 1):
            u = (x - (16 - hw) + .5) / (2 * hw + 1)
            stave = (x - 16) / hw
            v = cyl(u, 0.44, 0.30) + (0.0 if abs(math.sin(stave * 5.2)) > 0.18 else -0.10)
            c.put(x, y, 'oak', v)
    for yh in (15, 31):                                                       # 쇠 테
        for dy in range(2):
            y = yh + dy; hw = rows[y - 10]
            for x in range(int(16 - hw), int(16 + hw) + 1):
                u = (x - (16 - hw) + .5) / (2 * hw + 1)
                c.put(x, y, 'iron', cyl(u, 0.50 - 0.14 * dy, 0.32))
    # 뚜껑: 몸통 윗줄 반폭과 같은 타원, 안쪽 판 밝게, 널 이음 두 줄
    c.ell(16, 10.5, rows[0] + .6, 4.6, 'oak', 0.30)
    c.ell(16, 10.3, rows[0] - 1.0, 3.4, 'pine', lambda x, y, dx, dy: 0.60 - 0.12 * dy - 0.06 * dx)
    for x in (12, 20):
        for y in range(8, 14):
            g = c.get(x, y)
            if g and g[0] == 'pine': c.add(x, y, -0.12)
    im = finish(c, dx=3, dy=2, rows_from=30)
    return Prop(im, 1, 1, 'floor', '통')

# ---------------------------------------------------------------- 8 항아리 (32×36)
def jar():
    c = Cv(36, 36)
    prof = {}
    for y in range(8, 34):
        u = (y - 8) / 25
        prof[y] = 5.0 + 1.5 * min(1, (y - 8) / 2) if y < 11 else 6.0 + 7.0 * math.sin(math.pi * (0.06 + 0.86 * (y - 11) / 22)) ** 0.75
    for y, hw in prof.items():
        for x in range(int(16 - hw), int(16 + hw) + 1):
            u = (x - (16 - hw) + .5) / (2 * hw + 1)
            vv = cyl(u, 0.50, 0.34) + (0.06 if y < 16 else 0) - (0.08 if y > 29 else 0)
            c.put(x, y, 'clay', vv)
    for x in range(0, 32):                                                    # 어깨 띠 (짙은 유약 선)
        if c.get(x, 16): c.add(x, 16, -0.14); c.add(x, 17, -0.08)
    c.ell(16, 7.5, 6.6, 2.6, 'clay', 0.40)                                    # 입술
    c.ell(16, 7.3, 4.6, 1.6, 'clay', 0.12)                                    # 입 속
    for x in range(10, 23): c.lock.add((x, 7))
    c.put(10, 20, 'clay', 0.86); c.put(10, 21, 'clay', 0.78)                  # 반사 한 점
    im = finish(c, dx=3, dy=2, rows_from=26)
    return Prop(im, 1, 1, 'floor', '항아리')

# ---------------------------------------------------------------- 9 밀가루 자루 (32×34)
def sack():
    c = Cv(36, 34)
    c.ell(16, 21, 12.5, 11, 'linen', lambda x, y, dx, dy: dome(dx, dy, 0.60, 0.34) + (0.03 if (x + y // 2) % 4 == 0 else 0))
    for y in range(6, 12):                                                             # 묶은 목: 끈 위로 천 귀가 벌어진다
        hw = 2.5 + max(0, (9 - y)) * 1.1
        for x in range(int(16 - hw), int(16 + hw) + 1):
            c.put(x, y, 'linen', cyl((x - (16 - hw) + .5) / (2 * hw + 1), 0.64, 0.26) - 0.04 * (y - 4))
    c.fill(13, 6, 19, 6, 'linen', 0.95)                                               # 입에 넘친 밀가루
    for x in range(13, 20): c.put(x, 10, 'straw', 0.30 + 0.14 * math.cos((x - 14) / 6 * math.pi))   # 끈
    for k in range(3):                                                                # 주름
        x0 = 8 + k * 7
        for j in range(6): c.add(x0 + j // 3, 16 + j, -0.09)
    im = finish(c, dx=3, dy=2, rows_from=24)
    return Prop(im, 1, 1, 'floor', '밀가루 자루')

# ---------------------------------------------------------------- 10 궤짝 (32×38)
def crate():
    c = Cv(36, 38)
    top_face(c, 1, 3, 30, 15, 'pine', 0.62, plank=5, vertical=False, seed=8)
    front_face(c, 1, 16, 30, 35, 'pine', 0.46)
    for y0 in (16, 21, 26, 31):
        for x in range(1, 31): c.add(x, y0, -0.10)
    for x0 in (1, 27):
        c.fill(x0, 16, x0 + 3, 35, 'pine', lambda x, y, u, v: 0.52 - 0.1 * v)
    for x in range(1, 31): c.add(x, 35, -0.12)
    for x, y in ((3, 18), (28, 18), (3, 33), (28, 33)): c.put(x, y, 'iron', 0.30)
    im = finish(c, dx=3, dy=2, rows_from=26)
    return Prop(im, 1, 1, 'floor', '궤짝')

# ---------------------------------------------------------------- 11 빵 진열대 2칸 (64×52): 판 위에 천, 빵 덩이·긴 빵·둥근 빵
def bread_counter():
    c = Cv(64 + 3, 52)
    top_face(c, 0, 10, 63, 29, 'pine', 0.58, plank=6, vertical=False, seed=5)
    c.fill(4, 12, 59, 27, 'linen', lambda x, y, u, v: 0.84 - 0.1 * v + (0.04 if (x // 4 + y // 4) % 2 else 0))   # 천 (체크)
    for x in range(4, 60): c.add(x, 27, -0.12)
    loaf(c, 14, 17, 8, 5, 3, 1)
    loaf(c, 32, 16, 6, 4.5, 2, 2)
    for k, x in enumerate((44, 51)):
        c.ell(x, 17, 4.2, 3.8, 'crust', lambda xx, yy, dx, dy: dome(dx, dy, 0.64, 0.34))
    # 긴 빵 (앞줄, 비스듬)
    for i in range(28):
        x = 18 + i; y = 24 - i * 0.12
        for dy in range(-2, 3):
            c.put(x, y + dy, 'crust', dome(0, dy / 2.8, 0.60, 0.34))
    for i in range(3): c.add(24 + i * 8, 23, -0.2); c.add(25 + i * 8, 22, 0.14)
    # 앞면: 판자 세로, 가운데 칸
    front_face(c, 0, 30, 63, 47, 'pine', 0.44)
    for x in range(0, 64, 8): c.fill(x, 31, x, 47, 'pine', 0.30)
    c.fill(0, 48, 63, 51, 'pine', lambda x, y, u, v: 0.30 - 0.1 * v)
    # 뒤 솟는 부분: 가격표 팻말
    c.fill(27, 2, 36, 8, 'pine', lambda x, y, u, v: 0.70 - 0.1 * v)
    c.fill(29, 4, 34, 4, 'oak', 0.24); c.fill(29, 6, 32, 6, 'oak', 0.3)
    c.fill(31, 9, 32, 9, 'oak', 0.3)
    im = finish(c, dx=3, dy=2, rows_from=40)
    return Prop(im, 2, 1, 'floor', '빵 진열대')

# ---------------------------------------------------------------- 12 벽 선반 2칸 (64×30, 걸림): 까치발 + 병·단지
def wall_shelf():
    c = Cv(64, 32)
    c.fill(0, 18, 63, 20, 'pine', lambda x, y, u, v: 0.66 - 0.2 * v)        # 판 윗면
    c.fill(0, 21, 63, 23, 'pine', 0.36)                                      # 판 앞
    for x0 in (6, 54):                                                       # 까치발 (삼각)
        for j in range(7):
            c.fill(x0, 24 + j, x0 + 3 - j // 2, 24 + j, 'pine', 0.40 - 0.03 * j)
    # 얹은 것: 작은 단지 둘, 병, 밀방망이
    for cx, m, hw, h in ((10, 'clay', 4.5, 11), (20, 'teal', 3.5, 13), (43, 'clay', 5, 9)):
        for y in range(18 - h, 18):
            v = (y - (18 - h)) / h; w = hw * (0.7 + 0.3 * math.sin(math.pi * min(1, v * 1.3)))
            for x in range(int(cx - w), int(cx + w) + 1):
                c.put(x, y, m, cyl((x - (cx - w) + .5) / (2 * w + 1), 0.52, 0.3))
        c.ell(cx, 18 - h + .5, hw * .7, 1.4, m, 0.3)
    for y in range(3, 18): c.fill(28, y, 30, y, 'glass', cyl(0.3, 0.5, 0.2) + (0.3 if y < 7 else 0))   # 병
    c.fill(28, 1, 30, 3, 'oak', 0.4)
    for x in range(33, 40): c.put(x, 17, 'oak', 0.52 - 0.04 * (x % 2))                   # 밀방망이 (옆에 누움)
    c.fill(34, 15, 38, 16, 'pine', 0.70)
    c.fill(50, 13, 61, 17, 'linen', lambda x, y, u, v: 0.82 - 0.2 * v)                 # 접은 행주
    im = finish(c, cast=False)
    return Prop(im, 2, 0, 'hang', '벽 선반')

# ---------------------------------------------------------------- 13 창 (32×40, 걸림): 나무 틀, 밝은 유리, 붉은 커튼
def window():
    c = Cv(32, 40)
    c.fill(4, 3, 27, 30, 'oak', 0.36)                                        # 틀
    c.fill(4, 3, 27, 4, 'oak', 0.52)
    for (x0, x1) in ((7, 14), (17, 24)):
        for (y0, y1) in ((6, 16), (18, 28)):
            c.fill(x0, y0, x1, y1, 'glass', lambda x, y, u, v: 0.94 - 0.3 * v - 0.1 * u + (0.08 if abs((x - x0) - (y - y0) * 0.8) < 1.2 else 0))
            for x in range(x0, x1 + 1): c.lock.add((x, y0))
    c.fill(3, 31, 28, 33, 'pine', lambda x, y, u, v: 0.70 - 0.2 * v)        # 창턱
    for side in (0, 1):                                                      # 커튼: 묶인 자락
        for y in range(1, 33):
            w = 5 - int(2.5 * math.exp(-((y - 20) / 4) ** 2))
            for i in range(w):
                x = i if side == 0 else 31 - i
                u = i / 5
                fold = 0.08 * math.sin((i + y * 0.1) * 2.1)
                c.put(x, y, 'red', 0.46 + (0.14 if side == 0 else 0.02) - 0.18 * u + fold)
        for x in range(0, 6): c.put(x if side == 0 else 31 - x, 20, 'brass', 0.5)
    c.fill(0, 0, 31, 1, 'oak', lambda x, y, u, v: 0.46 - 0.2 * v)           # 커튼 봉
    im = finish(c, cast=False)
    return Prop(im, 1, 0, 'hang', '창')

# ---------------------------------------------------------------- 14 깔개 3×2 (96×64, 깖)
def rug():
    c = Cv(96, 64)
    def f(x, y, u, v):
        bx = min(x - 2, 93 - x); by = min(y - 2, 61 - y); b = min(bx, by)
        if b < 0: return None
        if b < 2: return 0.30
        if b < 6:                                                            # 테두리 무늬: 마름모 띠
            k = ((x + y) // 3 + (x - y) // 3) % 4
            return 0.56 if k == 0 else 0.44
        if b < 7: return 0.28
        cxd = abs(x - 47.5) / 40; cyd = abs(y - 31.5) / 24                  # 가운데 마름모
        if abs(cxd + cyd - 0.55) < 0.05: return 0.62
        if cxd + cyd < 0.35: return 0.52 + 0.04 * (1 if (x + y) % 3 == 0 else 0)
        return 0.40 + (0.025 if H(x // 2, y // 2, 12) > 0.8 else 0)
    c.fill(0, 0, 95, 63, 'red', f)
    for y in range(4, 60, 2):                                                # 술 (양끝)
        c.put(0, y, 'linen', 0.72); c.put(1, y, 'linen', 0.62)
        c.put(95, y, 'linen', 0.62); c.put(94, y, 'linen', 0.54)
    c.outline(dark=0.8, lit=0.9)
    return Prop(c.img(), 3, 2, 'flat', '깔개')

# ---------------------------------------------------------------- 15 화분 (32×44)
def plant():
    c = Cv(36, 44)
    # 화분: 위가 넓은 토분, 입술 테
    for y in range(30, 42):
        v = (y - 30) / 11; hw = 9 - 2.5 * v
        for x in range(int(16 - hw), int(16 + hw) + 1):
            c.put(x, y, 'clay', cyl((x - (16 - hw) + .5) / (2 * hw + 1), 0.46, 0.3) - 0.06 * v)
    c.fill(6, 28, 25, 30, 'clay', lambda x, y, u, v: cyl(u, 0.60, 0.26) - 0.1 * v)
    c.fill(8, 27, 23, 27, 'oak', 0.14)                                       # 흙
    # 잎 덩이: 잎 하나하나 = 작은 타원, 명암은 덩이 전체 기준(왼쪽 위 밝게)
    leaves = []
    for k in range(26):
        a = (k / 26 + H(k, 1, 3) * 0.08) * math.pi * 2 * 3.0; r = (0.25 + 0.75 * H(k, 2, 3) ** 0.7) * 10
        leaves.append((15.5 + math.cos(a) * r * 1.05, 16 + math.sin(a) * r * 0.85, k))
    leaves.sort(key=lambda p: p[1])
    for lx, ly, k in leaves:
        ang = H(k, 5, 3) * math.pi
        for yy in range(int(ly - 4), int(ly + 5)):
            for xx in range(int(lx - 5), int(lx + 6)):
                dx = xx + .5 - lx; dy = yy + .5 - ly
                p = (dx * math.cos(ang) + dy * math.sin(ang)) / 4.6; q = (-dx * math.sin(ang) + dy * math.cos(ang)) / 2.0
                if p * p + q * q <= 1:
                    gx = (xx - 16) / 13; gy = (yy - 15) / 12
                    v = 0.52 - 0.28 * gx * 0.6 - 0.30 * gy * 0.7 + (0.10 if q < -0.3 else -0.04)
                    c.put(xx, yy, 'green', v)
    im_c = c
    im = finish(im_c, dx=3, dy=2, rows_from=34)
    return Prop(im, 1, 1, 'floor', '화분')

def all_props(t=0):
    return {'dining': dining(), 'chair S': chair('S'), 'chair N': chair('N'), 'bed': bed(), 'bookshelf': bookshelf(),
            'wardrobe': wardrobe(), 'oven': oven(t), 'barrel': barrel(), 'jar': jar(), 'sack': sack(), 'crate': crate(),
            'bread counter': bread_counter(), 'wall shelf': wall_shelf(), 'window': window(), 'rug': rug(), 'plant': plant()}
