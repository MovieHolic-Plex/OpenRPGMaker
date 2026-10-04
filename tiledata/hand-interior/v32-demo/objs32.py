# 32px 실내 소품 12종. 16px 판을 확대하지 않고 32px 칸(칸당 4배 화소)에 맞춰 처음부터 그렸다.
# 크기·칸 점유는 v5 와 같다(화소는 2배): 이미지 = v5 크기 × 2, 솟는 높이(up) × 2.
import math
from draw32 import C, H, grain, band_tone, cyl_rows

# ------------------------------------------------------------------ 공통: 나무 윗면
def slab(c, x0, y0, x1, y1, m='wood', base=4, seed=1, r=2, dens=0.05):
    """위에서 본 판: 둥근 모서리, 위·왼쪽 안쪽 1px 밝게, 오른쪽·아래 안쪽 한 단 어둡게, 결은 성기게."""
    c.rrect(x0, y0, x1, y1, m, base, r)
    grain(c, x0 + 3, y0 + 3, x1 - 3, y1 - 2, m, base - 1, seed, dens)
    for x in range(x0 + r, x1 - r + 1): c.set(x, y0 + 1, m, base + 2)
    for y in range(y0 + r, y1 - r + 1): c.set(x0 + 1, y, m, base + 1)
    for y in range(y0 + r, y1 - 1): c.set(x1 - 1, y, m, base - 1)
    for x in range(x0 + r, x1 - r + 1): c.set(x, y1 - 1, m, base - 1)
    c.set(x0 + r - 1, y0 + 1, m, base + 1); c.set(x0 + 1, y0 + r - 1, m, base + 1)

def leg(c, x0, x1, y0, y1, m='wood', base=3):
    """다리: 세로 띠 명암 (왼쪽 밝게)"""
    w = x1 - x0 + 1
    for x in range(x0, x1 + 1):
        u = (x - x0 + .5) / w
        t = base + 1 if u < 0.4 else (base if u < 0.7 else base - 1)
        c.vl(x, y0, y1, m, t)

# ------------------------------------------------------------------ 식탁 2×2 (v5 구도: 윗면 위주)
def dining():
    c = C(64, 64)
    c.shadow_ell(7, 62, 6, 2); c.shadow_ell(57, 62, 6, 2)
    for x in range(5, 59): c.set(x, 56, 'shd')
    # 윗면 (1..50): 한 장처럼 조용하게. 테두리 2px 밝은 테(위·왼쪽 밝게, 오른쪽·아래 한 단 어둡게)가 두께를 준다.
    c.rrect(1, 1, 62, 50, 'wood', 4, 2)
    grain(c, 7, 7, 56, 44, 'wood', 3, 31, 0.045, 7, 18, 9)
    grain(c, 8, 8, 55, 43, 'wood', 5, 61, 0.012, 4, 9, 12)
    for y in (18, 34):                                # 판 이음새: 한 단 어두운 실선만 (서랍처럼 보이지 않게)
        for x in range(6, 58):
            if H(x // 9, y, 2) < 0.8: c.set(x, y, 'wood', 3)
    # 밝은 테 2px (v5 식탁처럼 네 변 모두) + 안쪽 한 단 어두운 선. 위·왼쪽이 가장 밝다.
    for x in range(3, 61):
        c.set(x, 2, 'wood', 6); c.set(x, 3, 'wood', 5); c.set(x, 4, 'wood', 3)
        c.set(x, 48, 'wood', 5); c.set(x, 47, 'wood', 5); c.set(x, 46, 'wood', 3)
    for y in range(3, 48):
        c.set(2, y, 'wood', 6); c.set(3, y, 'wood', 5); c.set(4, y, 'wood', 3)
        c.set(61, y, 'wood', 5); c.set(60, y, 'wood', 5); c.set(59, y, 'wood', 3)
    for y in range(5, 46): c.set(4, y, 'wood', 3); c.set(59, y, 'wood', 3)
    for x in range(4, 60): c.set(x, 4, 'wood', 3); c.set(x, 46, 'wood', 3)
    c.hl(3, 60, 49, 'wood', 3)
    for x, y in ((14, 10), (45, 40)):                 # 옹이 (작게, 두 단)
        c.hl(x, x + 2, y, 'wood', 2); c.set(x + 1, y - 1, 'wood', 3); c.set(x + 1, y + 1, 'wood', 3)
    # 앞 모서리: 앞판 4px → 판 밑 그늘 1px
    c.rect(2, 51, 61, 54, 'wood', 3)
    c.hl(3, 60, 51, 'wood', 4)
    c.hl(2, 61, 54, 'wood', 2)
    c.hl(3, 60, 55, 'wood', 1)
    leg(c, 3, 7, 55, 61); leg(c, 56, 60, 55, 61)
    c.rect(10, 55, 11, 57, 'wood', 1); c.rect(52, 55, 53, 57, 'wood', 1)
    c.outline()
    c.set(3, 1, 'wood', 1); c.set(60, 1, 'wood', 1)
    return c.img()

# ------------------------------------------------------------------ 의자 (남향 = 탁자 북쪽, 등받이가 뒤)
def chair(face='S'):
    c = C(32, 32)
    x0, x1 = 6, 25
    if face == 'S':
        c.shadow_ell(16, 30.5, 11, 2)
        # 등받이: 기둥 둘 + 둥근 윗가로대 + 가운데 세로 판 하나 (틈은 곧은 세로 틈)
        for x in (x0, x1 - 2): leg(c, x, x + 2, 2, 15, 'wood', 4)
        c.rrect(x0, 1, x1, 6, 'wood', 4, 2)
        c.hl(x0 + 2, x1 - 2, 2, 'wood', 6); c.hl(x0 + 1, x1 - 1, 3, 'wood', 5); c.hl(x0 + 1, x1 - 1, 6, 'wood', 2)
        for sx in (11, 15, 19):                             # 세로 살 셋 (3px, 가운데가 밝다)
            leg(c, sx, sx + 2, 7, 13, 'wood', 4)
        c.hl(x0 + 1, x1 - 1, 13, 'wood', 3)                 # 아래 가로대
        # 앉는 판 (위에서 본 사다리꼴: 앞이 넓다)
        for y in range(14, 23):
            k = (y - 14) / 8; a = int(round(x0 + 1 - k * 1.5)); b = int(round(x1 - 1 + k * 1.5))
            c.hl(a, b, y, 'wood', 4)
        c.hl(x0 + 1, x1 - 1, 15, 'wood', 5)
        for y in range(16, 22): c.set(int(round(x0 + 1 - (y - 14) / 8 * 1.5)) + 1, y, 'wood', 5)
        grain(c, x0 + 3, 17, x1 - 3, 20, 'wood', 3, 9, 0.10, 3, 7, 5)
        c.hl(x0 - 1, x1 + 1, 22, 'wood', 5)             # 앞 모서리 입술
        c.hl(x0 - 1, x1 + 1, 23, 'wood', 2); c.hl(x0, x1, 24, 'wood', 1)
        # 다리: 앞다리 3px, 뒷다리는 안쪽에 짧게
        leg(c, x0 - 1, x0 + 1, 24, 30); leg(c, x1 - 1, x1 + 1, 24, 30)
        c.vl(x0 + 3, 24, 27, 'wood', 1); c.vl(x1 - 3, 24, 27, 'wood', 1)
        c.hl(x0 + 2, x1 - 2, 27, 'wood', 2)             # 가로대
    else:
        # 북향: 등받이 뒷면이 앞에 온다. 방석은 등받이 위로 조금만 보인다.
        c.shadow_ell(16, 30.5, 11, 2)
        for y in range(4, 12):
            c.hl(x0, x1, y, 'wood', 4)
        c.hl(x0 + 1, x1 - 1, 4, 'wood', 5)
        grain(c, x0 + 3, 6, x1 - 3, 9, 'wood', 3, 13, 0.1, 3, 6, 5)
        # 등받이 윗가로대 (둥근 볏): 가운데가 솟는다
        for x in range(x0, x1 + 1):
            u = abs(x - 15.5) / 10.5; top = 9 + int(round(u * u * 2))
            for y in range(top, 15): c.set(x, y, 'wood', 3)
            c.set(x, top, 'wood', 5); c.set(x, top + 1, 'wood', 4)
        c.hl(x0 + 1, x1 - 1, 14, 'wood', 2)
        # 뒷면 판: 통판 한 장 (가로살 없이), 가운데 세로 결, 양옆 기둥
        c.rect(x0 + 3, 15, x1 - 3, 23, 'wood', 3)
        for x in range(x0 + 5, x1 - 4):
            if H(x, 0, 17) < 0.25: c.vl(x, 16, 22, 'wood', 2)
        c.vl(x0 + 3, 15, 23, 'wood', 4)
        for x in (x0, x1 - 2): leg(c, x, x + 2, 9, 30, 'wood', 4)
        c.hl(x0 + 3, x1 - 3, 23, 'wood', 1)             # 판 밑 그늘
        c.hl(x0 + 3, x1 - 3, 24, 'wood', 2)             # 아래 가로대
        c.vl(x0 + 4, 25, 28, 'wood', 1); c.vl(x1 - 4, 25, 28, 'wood', 1)   # 저편 앞다리 (어둡게, 짧게)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 통
def barrel():
    c = C(32, 32)
    c.shadow_ell(16, 30, 13, 2.2)
    rows = []
    for j in range(22):                               # 배가 부른 몸통 (y 7..28)
        u = j / 21; rows.append(10.5 + 2.2 * math.sin(math.pi * u))
    cyl_rows(c, 16, rows, 'wood', 4, 7)
    # 널판 이음: 세로 줄, 자리 흐트러뜨림, 배 따라 휘게
    for k, px in enumerate((-8.5, -4, 0.5, 5, 9)):
        px += (H(k, 1, 3) - .5) * 1.2
        for j in range(1, 21):
            u = j / 21; x = int(round(16 + px * (1 + 0.2 * math.sin(math.pi * u))))
            c.shade(x, 7 + j, -1)
    # 테 두 줄 (쇠): 세로 띠 명암, 윗줄 밝게
    for yh in (11, 23):
        for dy in range(3):
            y = yh + dy; hw = rows[y - 7]
            xa = int(math.floor(16 - hw + .5)); xb = int(math.ceil(16 + hw - .5)) - 1
            for x in range(xa, xb + 1):
                u = (x - xa + .5) / (xb - xa + 1)
                c.set(x, y, 'iron', band_tone(u, 5 if dy == 0 else 4) - (1 if dy == 2 else 0))
        c.set(11, yh, 'iron', 6)                      # 반사광 한 점
    # 뚜껑: 타원 (가로 반지름 = 몸통 윗줄 반폭)
    rx, ry, cy = rows[0] + 0.2, 4.2, 7
    c.ell(16, cy, rx, ry, 'wood', 3)
    c.ell(16, cy - 0.3, rx - 1.6, ry - 1.2, 'wood', 4)
    for y in range(c.h):
        for x in range(c.w):
            if c.get(x, y) == ('wood', 4) and y < cy and ((x + .5 - 16) / (rx - 1.6)) ** 2 + ((y + .5 - cy + .3) / (ry - 1.2)) ** 2 > 0.55:
                c.set(x, y, 'wood', 5)
    for x in (12, 20):                                # 뚜껑 널판 줄
        for y in range(4, 10):
            if c.get(x, y) and c.get(x, y)[1] >= 4: c.set(x, y, 'wood', 3)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 항아리 (물독, 천 덮개)
def jar():
    c = C(32, 32)
    c.shadow_ell(16, 30, 11, 2)
    prof = {}
    for y in range(9, 30):                            # 어깨에서 불룩(y≈18), 밑은 넓고 납작하게 앉는다
        u = (y - 9) / 20
        prof[y] = 7 + 6 * math.sin(math.pi * min(1.0, u * 1.35)) ** 0.8 if u < 0.62 else 13 - (u - 0.62) * 13
    cyl_rows(c, 16, [prof[y] for y in range(9, 30)], 'clay', 5, 9)
    c.hl(11, 20, 29, 'clay', 1)
    # 어깨 무늬 띠 (한 단 어둡게, 점선 흐트러뜨림)
    for x in range(5, 28):
        if c.get(x, 14) and H(x, 14, 4) < 0.75: c.shade(x, 14, -1)
    # 목 + 입술
    cyl_rows(c, 16, [7, 6.5, 6.5], 'clay', 5, 7)
    # 천 덮개: 둥근 머리 + 늘어진 자락 + 끈
    c.ell(16, 6, 9, 4.5, 'blue', 4)
    c.ell(14.5, 4.8, 5.5, 2.2, 'blue', 5)
    c.set(12, 3, 'blue', 6); c.set(13, 3, 'blue', 6)
    for k, x in enumerate(range(7, 26)):              # 자락: 끝이 들쭉날쭉
        dl = 2 + int(H(x // 2, 0, 8) * 3)
        for y in range(9, 9 + dl): c.set(x, y, 'blue', 3 if x > 16 else 4)
    for x in range(7, 26, 3): c.set(x, 10, 'blue', 2)   # 자락 주름
    c.hl(8, 24, 9, 'straw', 4); c.set(8, 9, 'straw', 2); c.set(24, 9, 'straw', 2)   # 끈
    c.set(23, 10, 'straw', 3); c.set(23, 11, 'straw', 2)
    c.outline(soft=('straw',))
    c.set(10, 17, 'clay', 6)                          # 반사 한 점
    return c.img()

# ------------------------------------------------------------------ 침대 (W = 32 1인 / 64 2인), 높이 76 = 2칸 + 솟는 12
def pillow(c, a, b, y0, y1, seed):
    """베개: 둥근 모서리, 가운데 볼록(밝게), 가장자리 두 단, 가운데 눌린 주름 하나"""
    c.rrect(a, y0, b, y1, 'linen', 4, 3)
    c.rrect(a + 2, y0 + 1, b - 2, y1 - 3, 'linen', 5, 3)
    c.rrect(a + 4, y0 + 2, b - 6, y0 + 5, 'linen', 6, 2)
    c.hl(a + 3, b - 3, y1 - 1, 'linen', 3)
    m = (a + b) // 2 + int((H(a, seed, 1) - .5) * 4)     # 눌린 자국
    c.set(m - 1, y0 + 6, 'linen', 4); c.set(m, y0 + 7, 'linen', 4); c.set(m + 1, y0 + 7, 'linen', 4); c.set(m + 2, y0 + 6, 'linen', 4)
    for x in (a, b):                                     # 모서리 뿔
        c.set(x, y0 + 1, 'linen', 3); c.set(x, y1 - 1, 'linen', 3)

def bed(W=64, cloth='red', seed=4):
    c = C(W, 76)
    c.shadow_ell(4, 75, 4, 1.5); c.shadow_ell(W - 5, 75, 4, 1.5)
    # 머리판: 양 기둥(둥근 꼭지) + 가운데 판 (윗가로대가 살짝 둥글게 솟음)
    for px in (1, W - 6):
        leg(c, px, px + 4, 4, 22, 'wood', 4)
        c.ell(px + 2.5, 3.5, 3.2, 3, 'wood', 4); c.set(px + 1, 2, 'wood', 6); c.set(px + 2, 2, 'wood', 5)
    for x in range(6, W - 6):
        u = abs(x - (W - 1) / 2) / ((W - 12) / 2); t0 = 5 + int(round(u * u * 3))
        for y in range(t0, 22): c.set(x, y, 'wood', 3)
        c.set(x, t0, 'wood', 5); c.set(x, t0 + 1, 'wood', 4)
    c.rrect(9, 11, W - 10, 19, 'wood', 2, 1)              # 안쪽 판 (움푹)
    c.hl(10, W - 11, 19, 'wood', 4)                        # 안쪽 판 아래 모서리 빛
    grain(c, 10, 13, W - 11, 17, 'wood', 1, seed, 0.05, 4, 8, 6)
    c.hl(6, W - 7, 21, 'wood', 1)
    # 틀 옆 난간 (요 양쪽)
    for y in range(22, 66):
        c.set(1, y, 'wood', 4); c.set(2, y, 'wood', 3); c.set(W - 3, y, 'wood', 3); c.set(W - 2, y, 'wood', 2)
    # 요 (베개 밑)
    c.rect(3, 22, W - 4, 40, 'linen', 3)
    c.hl(3, W - 4, 22, 'linen', 1); c.hl(3, W - 4, 23, 'linen', 2)
    ps = [(5, W - 6)] if W <= 32 else [(5, W // 2 - 2), (W // 2 + 1, W - 6)]
    for k, (a, b) in enumerate(ps): pillow(c, a, b, 23, 36, seed + k)
    c.hl(4, W - 5, 37, 'linen', 2)                          # 베개 밑 그림자
    # 접어 내린 흰 시트 (두께 있는 한 겹)
    c.rect(3, 39, W - 4, 44, 'linen', 5)
    c.hl(3, W - 4, 39, 'linen', 6); c.hl(3, W - 4, 43, 'linen', 4); c.hl(3, W - 4, 44, 'linen', 3)
    for x in range(6, W - 6, 7): c.set(x + int(H(x, 1, seed) * 3), 41, 'linen', 4)   # 시트 잔주름
    # 이불: 난간 너머로 부푼 몸통. 누운 몸 자리(가운데 왼쪽)가 볼록 → 밝고, 양옆으로 흘러내리며 어두워진다.
    # 단 경계는 한 줄씩 엇갈려 부드럽게(천 규칙: 경계만 성기게 디더, 가운데는 한 톤).
    # 누운 몸 자리 = 세로로 긴 둔덕. 가로 방향으로만 명암(원통처럼), 경계는 줄마다 천천히 물결쳐 딱딱하지 않게.
    bodies = [(0.28, 0.25), (0.73, 0.24)] if W > 32 else [(0.44, 0.36)]
    for y in range(45, 67):
        wob = 0.035 * math.sin(y * 0.45 + seed) + 0.012 * math.sin(y * 1.3)
        fall = max(0, (y - 57) / 10) * 0.35                                   # 발치 쪽은 낮아진다
        for x in range(1, W - 1):
            u = (x - 1) / (W - 3)
            v = max(0.0, max(1 - abs(u - cu - wob) / hw for cu, hw in bodies)) - fall
            side = min(u, 1 - u)
            t = 2 if side < 0.05 else 3
            if v > 0.25: t = 4
            if v > 0.72: t = 5
            c.set(x, y, cloth, t)
    c.hl(2, W - 3, 45, cloth, 5); c.hl(2, W - 3, 46, cloth, 4)   # 이불 윗단 (시트 밑 접힘)
    # 주름: 몸 자리 옆에서 난간 쪽으로 비스듬히 흘러내리는 긴 골 (그늘 한 줄 + 바로 위 빛 한 줄)
    folds = [(0.10, 49, -1, 7), (0.92, 50, 1, 7), (0.49, 56, -1, 6)] if W > 32 else [(0.74, 49, 1, 7), (0.14, 52, -1, 5)]
    for (u0, y0, dirx, ln) in folds:
        x0 = int(1 + u0 * (W - 3))
        for j in range(ln):
            x = x0 + dirx * (j // 2 if j < ln // 2 else j - ln // 4); y = y0 + j
            if c.mat(x, y) == cloth and y < 64:
                c.shade(x, y, -1)
                if c.mat(x - dirx, y) == cloth: c.shade(x - dirx, y, 1)
    # 누비 선: 이불 끝단 따라 바늘땀 (흐트러뜨림 없이 고르게 — 바느질은 고르다)
    for x in range(4, W - 4, 3): c.set(x, 63, cloth, 2)
    c.hl(1, W - 2, 65, cloth, 4); c.hl(1, W - 2, 66, cloth, 2)
    # 앞자락 (발치 판 위로 늘어짐), 끝이 물결
    for x in range(1, W - 1):
        d = 67 + (1 if H(x // 3, 0, seed) < 0.4 else 0)
        for y in range(67, d + 1): c.set(x, y, cloth, 2)
    # 발치 판: 윗면 1줄 밝게 + 앞판 + 다리
    c.hl(0, W - 1, 69, 'wood', 5); c.hl(0, W - 1, 70, 'wood', 4)
    c.rect(0, 71, W - 1, 72, 'wood', 3); c.hl(0, W - 1, 73, 'wood', 1)
    leg(c, 0, 3, 73, 75); leg(c, W - 4, W - 1, 73, 75)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 책장 2칸 (64×76, 솟는 44)
BOOKC = ['red', 'blue', 'green', 'linen', 'clay', 'red', 'blue', 'straw', 'green', 'iron']
def book(c, x, yb, w, h, col, lean=0, seed=0):
    """책 등: 왼쪽 1px 밝게, 오른쪽 1px 어둡게, 윗단 한 줄 밝게(책머리), 등 글자 띠 = 짙은 띠 + 금박 점"""
    base = 3
    for yy in range(yb - h, yb):
        sh = lean if yy < yb - h // 2 else 0
        for xx in range(x, x + w):
            t = base
            if xx == x: t = base + 1
            elif xx == x + w - 1 and w >= 3: t = base - 1
            c.set(xx + sh, yy, col, t)
    c.hl(x + lean, x + w - 1 + lean, yb - h, col, base + 2 if col != 'linen' else base + 1)
    if h >= 8 and w >= 3:
        by = yb - h + 2 + int(H(x, yb, seed) * 2)
        c.hl(x + lean, x + w - 1 + lean, by, col, 1)
        c.hl(x + lean, x + w - 1 + lean, by + 3, col, 1)
        c.set(x + w // 2 + lean, by + 1 + (h > 11) * 1 + 1, 'brass', 4)     # 제목 금박
        c.hl(x, x + w - 1, yb - 3, col, 2)                                   # 아래 띠

def shelf_books(c, x0, x1, yb, hmax, seed):
    x = x0; last = None; pot = False
    while x <= x1:
        r = H(x, yb, seed)
        if r < 0.07 and x > x0 + 2:
            x += 2; continue
        if r > 0.93 and x + 9 <= x1:                     # 눕힌 책 더미
            for j in range(3):
                col = BOOKC[int(H(x, j, seed + 3) * 8)]
                w = 9 - j * 2 + (j == 1); xa = x + (j % 2)
                c.rect(xa, yb - 3 * j - 3, xa + w - 1, yb - 3 * j - 1, col, 3)
                c.hl(xa, xa + w - 1, yb - 3 * j - 3, col, 5); c.vl(xa, yb - 3 * j - 3, yb - 3 * j - 1, col, 2)
                c.hl(xa + 1, xa + w - 2, yb - 3 * j - 2, 'linen', 5)          # 책장 종이 단면
            x += 11; continue
        if r > 0.86 and x + 6 <= x1 and not pot:         # 작은 항아리 하나 (칸마다 많아야 하나)
            pot = True
            cyl_rows(c, x + 3, [1.5, 2.5, 3, 3, 2.5], 'clay', 4, yb - 5); c.hl(x + 1, x + 4, yb - 6, 'clay', 5)
            x += 8; continue
        w = [2, 3, 3, 4, 4, 5][int(H(x, yb + 9, seed) * 6)]
        w = min(w, x1 - x + 1)
        if w < 2: break
        h = max(7, hmax - int(H(x, yb + 2, seed) * 5))
        col = BOOKC[int(H(x, yb + 4, seed) * len(BOOKC))]
        if col == last: col = BOOKC[(BOOKC.index(col) + 3) % len(BOOKC)]
        last = col
        lean = 1 if (H(x, yb + 6, seed) < 0.10 and x + w + 1 <= x1) else 0
        book(c, x, yb, w, h, col, lean, seed)
        x += w + lean

def bookshelf(W=64, seed=8):
    c = C(W, 76)
    c.rect(0, 0, W - 1, 75, 'wood', 2)
    slab(c, 0, 0, W - 1, 7, 'wood', 4, seed, 1, 0.05)      # 윗판
    c.hl(0, W - 1, 8, 'wood', 1)
    for y in range(8, 75):                                  # 옆판: 왼쪽 밝게, 오른쪽 어둡게
        c.set(1, y, 'wood', 4); c.set(2, y, 'wood', 3); c.set(3, y, 'wood', 3); c.set(W - 2, y, 'wood', 2); c.set(W - 3, y, 'wood', 3)
    comps = [(10, 27), (31, 48), (52, 66)]
    for a, b in comps:
        c.rect(4, a, W - 5, b, 'wood', 1)                   # 칸 안 (어둡게)
        c.hl(4, W - 5, a, 'wood', 0); c.hl(4, W - 5, a + 1, 'wood', 0)   # 선반 밑 그늘
        shelf_books(c, 4, W - 5, b + 1, b - a - 2, seed + a)
        c.hl(3, W - 4, b + 1, 'wood', 5); c.hl(3, W - 4, b + 2, 'wood', 3); c.hl(3, W - 4, b + 3, 'wood', 2)
    c.rect(4, 70, W - 5, 73, 'wood', 3); c.hl(4, W - 5, 70, 'wood', 4)   # 밑판
    c.hl(0, W - 1, 74, 'wood', 1)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 옷장 (32×64, 솟는 32)
def wardrobe():
    c = C(32, 64)
    c.shadow_ell(16, 63, 15, 1.5)
    c.rect(1, 5, 30, 60, 'wood', 2)
    # 머리 몰딩: 위에서 본 윗면 + 돌출 턱
    slab(c, 0, 0, 31, 5, 'wood', 4, 11, 1, 0.0)
    c.hl(0, 31, 6, 'wood', 5); c.hl(0, 31, 7, 'wood', 2); c.hl(1, 30, 8, 'wood', 1)
    # 문 두 짝: 틀 3단, 가운데 두 장의 도드라진 판 (빛: 위·왼쪽 밝게, 아래·오른쪽 어둡게)
    for dx0, dx1 in ((2, 15), (16, 29)):
        c.rect(dx0, 9, dx1, 54, 'wood', 3)
        c.vl(dx0, 9, 54, 'wood', 4)
        for py0, py1 in ((12, 30), (34, 51)):
            a, b = dx0 + 3, dx1 - 3
            c.rect(a, py0, b, py1, 'wood', 4)
            c.hl(a, b, py0, 'wood', 2); c.vl(a, py0, py1, 'wood', 2)          # 패인 골 (위·왼쪽 그늘)
            c.hl(a, b, py1, 'wood', 5); c.vl(b, py0, py1, 'wood', 5)          # 골 반대쪽 빛
            c.rect(a + 2, py0 + 2, b - 2, py1 - 2, 'wood', 4)
            c.hl(a + 2, b - 2, py0 + 2, 'wood', 5); c.vl(a + 2, py0 + 2, py1 - 2, 'wood', 5)
            c.hl(a + 2, b - 2, py1 - 2, 'wood', 3); c.vl(b - 2, py0 + 2, py1 - 2, 'wood', 3)
            grain(c, a + 4, py0 + 4, b - 4, py1 - 4, 'wood', 3, py0 + dx0, 0.0)
            for y in range(py0 + 4, py1 - 3):                                  # 세로 결 한 줄
                if H(dx0, y // 5, 3) < 0.6: c.set(a + 4 + int(H(dx0, py0, 5) * (b - a - 8)), y, 'wood', 3)
    c.vl(15, 9, 54, 'wood', 1); c.vl(16, 9, 54, 'wood', 2)                    # 문 사이 틈
    for x in (13, 18):                                                         # 손잡이 (놋쇠, 반사 한 점)
        c.rect(x, 30, x + 1, 33, 'brass', 3); c.set(x, 30, 'brass', 5); c.set(x + 1, 33, 'brass', 1)
    # 밑 몰딩 + 발
    c.hl(1, 30, 55, 'wood', 1); c.rect(0, 56, 31, 58, 'wood', 3); c.hl(0, 31, 56, 'wood', 5); c.hl(1, 30, 59, 'wood', 1)
    leg(c, 1, 4, 60, 62); leg(c, 27, 30, 60, 62)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 괘종시계 (32×64, 솟는 32)
def clock():
    c = C(32, 64)
    c.shadow_ell(16, 63, 10, 1.5)
    # 머리: 둥근 박공 + 시계판 상자
    for x in range(6, 26):
        u = abs(x - 15.5) / 10; t0 = 1 + int(round(u * u * 4))
        for y in range(t0, 8): c.set(x, y, 'wood', 3)
        c.set(x, t0, 'wood', 5); c.set(x, t0 + 1, 'wood', 4)
    c.set(15, 0, 'brass', 4); c.set(16, 0, 'brass', 3)                          # 꼭지
    c.hl(6, 25, 8, 'wood', 5); c.hl(6, 25, 9, 'wood', 2)
    c.rect(7, 10, 24, 25, 'wood', 3); c.vl(7, 10, 25, 'wood', 4); c.vl(24, 10, 25, 'wood', 2)
    # 시계판: 놋쇠 테 + 크림 판 + 눈금 12 + 바늘
    c.ell(16, 17.5, 7, 7, 'brass', 3)
    c.ell(16, 17.5, 6, 6, 'linen', 6)
    for y in range(c.h):                                                         # 판 아래·오른쪽 한 단 어둡게 (볼록)
        for x in range(c.w):
            if c.get(x, y) == ('linen', 6) and (x - 16) + (y - 17.5) > 5: c.set(x, y, 'linen', 5)
    for k in range(12):
        a = k * math.pi / 6; x = int(round(16 + 4.9 * math.sin(a) - .5)); y = int(round(17.5 - 4.9 * math.cos(a) - .5))
        c.set(x, y, 'iron', 2 if k % 3 else 0)
    for j in range(4): c.set(16, 17 - j, 'iron', 0)                             # 분침 12시
    for j in range(3): c.set(16 + j, 17 + j // 2, 'iron', 1)                     # 시침 4시쯤
    c.set(15, 13, 'brass', 5); c.set(12, 16, 'brass', 5)                         # 테 반사
    c.hl(7, 24, 26, 'wood', 5); c.hl(6, 25, 27, 'wood', 3); c.hl(7, 24, 28, 'wood', 1)
    # 허리: 좁은 몸통 + 유리 창 속 진자
    c.rect(9, 29, 22, 51, 'wood', 3); c.vl(9, 29, 51, 'wood', 4); c.vl(22, 29, 51, 'wood', 2)
    c.rect(12, 31, 19, 48, 'wood', 1)
    c.rect(13, 32, 18, 47, 'glass', 0)
    c.vl(15, 32, 42, 'brass', 2); c.vl(16, 32, 42, 'brass', 3)                   # 진자 막대
    c.ell(16, 43, 2.6, 2.6, 'brass', 3); c.set(15, 42, 'brass', 5); c.set(17, 44, 'brass', 1)
    c.vl(13, 32, 38, 'glass', 2); c.set(14, 33, 'glass', 3)                      # 유리 비침 (왼쪽 위 한 줄)
    c.hl(12, 19, 48, 'wood', 4)
    # 밑단
    c.hl(8, 23, 52, 'wood', 5); c.rect(7, 53, 24, 59, 'wood', 3); c.vl(7, 53, 59, 'wood', 4); c.vl(24, 53, 59, 'wood', 2)
    c.rrect(10, 55, 21, 58, 'wood', 2, 1); c.hl(11, 20, 58, 'wood', 4)
    c.hl(6, 25, 60, 'wood', 4); c.hl(6, 25, 61, 'wood', 1)
    leg(c, 6, 8, 62, 62); leg(c, 23, 25, 62, 62)
    c.outline()
    return c.img()

# ------------------------------------------------------------------ 소파 (64×32) · 안락의자 (32×32)
# 천 가구는 부위마다 한 단씩: 틀·앞자락 2단, 등받이 3단, 팔걸이 윗면 4단, 방석 4~5단. 부위 안은 두 톤.
def upholstered(W, cloth, seats, seed=3):
    c = C(W, 32)
    c.shadow_ell(W / 2, 30.5, W / 2 - 1, 1.8)
    aw = 7                                              # 팔걸이 폭
    # 등받이: 윗면(둥근 등마루) + 앞면, 단추 누빔
    c.rrect(1, 2, W - 2, 15, cloth, 3, 4)
    for x in range(4, W - 4): c.set(x, 3, cloth, 5); c.set(x, 4, cloth, 4)
    c.hl(3, W - 4, 5, cloth, 4)
    for k in range(seats):                               # 등받이 판 사이 솔기 + 판마다 부푼 가운데
        a = aw + k * ((W - 2 * aw) // seats); b = a + (W - 2 * aw) // seats - 1
        c.hl(a + 3, b - 3, 7, cloth, 4)
        if k: c.vl(a, 5, 13, cloth, 2); c.vl(a + 1, 6, 13, cloth, 4)
    c.hl(2, W - 3, 14, cloth, 2)                          # 등받이 밑 그늘 (방석과 만나는 골)
    # 팔걸이: 말린 윗면 (가로 원통 → 세로로 명암), 앞 끝은 둥근 말림
    for ax0 in (0, W - aw):
        for y in range(6, 27):
            for x in range(ax0, ax0 + aw):
                u = (x - ax0 + .5) / aw
                t = 4 if u < 0.35 else (5 if u < 0.6 else (4 if u < 0.8 else 3))
                if ax0 > 0: t = 4 if u < 0.25 else (3 if u < 0.75 else 2)
                c.set(x, y, cloth, t if y < 21 else t - 1)
        c.hl(ax0 + 1, ax0 + aw - 2, 6, cloth, 5)
        c.rrect(ax0, 20, ax0 + aw - 1, 26, cloth, 3, 2)   # 말림 앞면
        c.hl(ax0 + 1, ax0 + aw - 2, 21, cloth, 4)          # 말림 앞면 윗단 빛
    # 방석: 볼록, 앞 모서리 두툼
    n = seats; span = W - 2 * aw
    for k in range(n):
        a = aw + k * span // n; b = aw + (k + 1) * span // n - 1
        c.rrect(a, 14, b, 23, cloth, 4, 2)
        c.rrect(a + 2, 15, b - 2, 20, cloth, 5, 2)
        c.hl(a + 3, b - 4, 15, cloth, 6 if cloth != 'green' else 6)
        c.hl(a + 1, b - 1, 22, cloth, 3); c.hl(a + 1, b - 1, 23, cloth, 2)
        if k: c.vl(a, 14, 23, cloth, 1)                # 방석 사이 골
    # 앞자락: 주름 잡힌 치마 (세로 주름, 간격 흐트러뜨림)
    c.rect(1, 24, W - 2, 27, cloth, 2)
    c.hl(1, W - 2, 24, cloth, 3)
    x = 3
    while x < W - 3:
        c.vl(x, 25, 27, cloth, 1); c.set(x + 1, 25, cloth, 3)
        x += 5 + int(H(x, 0, seed) * 3)
    # 나무 발
    for fx in (2, W - 5):
        leg(c, fx, fx + 2, 28, 29, 'wood', 3)
    c.outline()
    return c.img()

def sofa(): return upholstered(64, 'green', 2)
def armchair(): return upholstered(32, 'red', 1, 7)

# ------------------------------------------------------------------ 벽난로 (64×64, 솟는 32)
def fireplace(t=0):
    c = C(64, 64)
    # 돌 둘레: 한 장씩 (윗줄 밝게, 아랫줄 어둡게, 장마다 색 조금씩), 줄눈은 한 단 어둡게
    c.rect(2, 8, 61, 56, 'stone', 1)
    rows = [(9, 16), (17, 24), (25, 32), (33, 40), (41, 48), (49, 55)]
    for ri, (y0, y1) in enumerate(rows):
        x = 3 - (ri % 2) * 5
        while x < 61:
            w = 9 + int(H(x, ri, 5) * 6)
            a, b = max(3, x), min(60, x + w - 2)
            if b - a >= 2:
                base = [3, 4, 4, 3, 5][int(H(a, ri, 6) * 5)] - (1 if ri >= 4 else 0)
                c.rrect(a, y0, b, y1 - 1, 'stone', base, 1)
                c.hl(a + 1, b - 1, y0, 'stone', base + 1)
                c.vl(a, y0 + 1, y1 - 2, 'stone', base + 1)
                c.hl(a + 1, b, y1 - 1, 'stone', base - 1)
                if H(a, y0, 9) < 0.5: c.set(a + 2 + int(H(a, 1, 9) * (b - a - 3)), y0 + 3, 'stone', base - 1)   # 흠 한 점
            x += w
    # 불 아궁이: 아치 입구 (돌 한 켜 테두리 + 속 그을음)
    ax0, ax1, ay0, ay1 = 15, 48, 20, 52
    cx = (ax0 + ax1) / 2; rx = (ax1 - ax0) / 2
    for y in range(ay0 - 3, ay1 + 1):
        for x in range(ax0 - 3, ax1 + 4):
            yy = y - (ay0 + 8)
            inside_arch = y >= ay0 + 8 or ((x + .5 - cx) / (rx + 3)) ** 2 + (yy / 11) ** 2 <= 1
            if not inside_arch: continue
            inner = (ax0 <= x <= ax1) and (y >= ay0 + 8 or ((x + .5 - cx) / rx) ** 2 + (yy / 8) ** 2 <= 1)
            if inner:
                d = (y - ay0) / (ay1 - ay0)
                c.set(x, y, 'iron', 0 if d < 0.55 else 1)
            else:
                c.set(x, y, 'stone', 5 if y < ay0 + 10 else 4)   # 아치 테 돌 (밝게)
    for y in range(ay0 + 8, ay1 + 1):
        c.set(ax0, y, 'stone', 1); c.set(ax1, y, 'stone', 2)
    # 장작: 가로로 누운 통나무 둘 + 비스듬한 하나, 마구리는 둥근 나이테
    for (x0, x1, y0) in ((20, 42, 47), (24, 45, 44)):
        for y in range(y0, y0 + 4):
            for x in range(x0, x1 + 1): c.set(x, y, 'wood', [3, 2, 1, 1][y - y0])
        c.ell(x0 + 1.5, y0 + 2, 2.2, 2.2, 'wood', 4); c.set(x0 + 1, y0 + 2, 'wood', 2)
    # 불꽃: 가운데 높고 양옆 낮은 혀 여러 개 (밝은 속 → 붉은 바깥)
    for k, (fx, fh, fw) in enumerate(((32, 22, 6), (26, 14, 4), (38, 15, 4), (22, 9, 3), (42, 9, 3))):
        ph = math.sin((t / 4 + k * .37) * 2 * math.pi)
        hh = fh + ph * 1.5
        for y in range(int(46 - hh), 46):
            v = (46 - y) / hh
            half = fw * max(0.0, 1 - v) ** 0.7 * (1 + 0.15 * math.sin(y * 0.9 + k))
            sway = math.sin(v * 3 + t + k) * 1.2 * v
            for x in range(int(fx - half + sway), int(fx + half + sway) + 1):
                e = abs(x - fx - sway) / max(half, 0.6)
                tone = 5 if e < 0.35 and v < 0.6 else (4 if e < 0.6 else (3 if e < 0.85 else 2))
                if v > 0.8: tone = min(tone, 3)
                c.set(x, y, 'fire', tone)
    for x in range(21, 44):                              # 불씨 줄
        if H(x, t, 4) < 0.5: c.set(x, 51, 'fire', 3 if H(x, t, 5) < 0.5 else 1)
    # 선반 (나무 앞 가로보): 윗면 + 앞면, 양 끝 받침
    slab(c, 0, 0, 63, 5, 'wood', 4, 3, 1, 0.03)
    c.rect(0, 6, 63, 8, 'wood', 3); c.hl(0, 63, 6, 'wood', 5); c.hl(0, 63, 9, 'wood', 1)
    for bx in (3, 57):
        c.rect(bx, 10, bx + 3, 13, 'wood', 3); c.set(bx, 10, 'wood', 4); c.hl(bx, bx + 3, 13, 'wood', 1)
    # 화로 앞 받침돌 (바닥 쪽으로 튀어나온 넓은 판)
    c.rrect(0, 55, 63, 62, 'stone', 4, 1)
    c.hl(1, 62, 56, 'stone', 6); c.hl(1, 62, 57, 'stone', 5)
    for x in (16, 34, 50): c.vl(x, 57, 61, 'stone', 2)
    c.hl(1, 62, 61, 'stone', 2)
    c.outline(soft=('fire',))
    return c.img()
