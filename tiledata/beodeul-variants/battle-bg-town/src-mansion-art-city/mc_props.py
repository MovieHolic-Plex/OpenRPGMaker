# 저택·예술 도시 소품 — 버들항 소품 화가(pz.C = px2.C 볼륨 + 재질 결 → 칩셋 7단)와 pz.fin 안쪽 윤곽을 그대로 쓴다.
# 그리는 법은 pz.lamp_double·bench_park·statue_sage·pf.fountain 과 같다(그림자 타원 → 덩이별 group → box/cylinder/ellipsoid/tone).
# 새 재질: marble(크림 대리석) · wine(포도주) · boxw(회양목) · navy·ochre·sky(그림 물감). 사람 얼굴·글자·상표 없음.
from mc_base import *
from mc_base import _hash
import pz as _pz


def _fin(c): return pz.fin(c)


# ================================================================ 그림 물감(캔버스 속)
def paint(c, x0, y0, w, h, kind, seed=0):
    """캔버스 그림: 0 풍경 1 바다·노을 2 꽃병 3 추상 색면 4 밤 하늘. 큰 붓 자국 덩이(2px)로."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x - x0 + .5) / w; v = (y - y0 + .5) / h; j = _hash(x // 2, y // 2, seed) < .25
            if kind == 0:
                m, t = ('sky', 5 if v < .25 else 4) if v < .5 else (('leaf', 4) if v < .5 + .22 * (1 - u) else ('leaf', 3))
                if .55 < u < .8 and .25 < v < .62: m, t = 'boxw', 3 if u < .67 else 2
            elif kind == 1:
                m, t = ('fire', 5) if v < .35 else (('fire', 4) if v < .5 else (('sky', 3) if v < .78 else ('navy', 3)))
                if math.hypot(u - .35, (v - .36) * 1.4) < .16: m, t = 'fire', 6
                if v > .5 and (y - y0) % 2 == 0 and j: t += 1
            elif kind == 2:
                m, t = 'wine', 2
                if abs(u - .5) < .2 and v > .58: m, t = 'sky', 4 if u < .5 else 3
                if math.hypot(u - .5, v - .38) < .3: m, t = ('red', 4) if (x + y) % 3 else ('gold', 5)
                if math.hypot(u - .3, v - .3) < .1: m, t = 'pink', 5
            elif kind == 3:
                m, t = ('navy', 3) if u < .45 else ('ochre', 4)
                if v > .62: m, t = 'red', 3
                if .3 < u < .6 and .28 < v < .5: m, t = 'cream', 6
            else:
                m, t = 'navy', 2 if v > .5 else 3
                if _hash(x, y, seed + 9) < .08: m, t = 'gold', 6
                if math.hypot(u - .72, v - .3) < .12: m, t = 'gold', 5
            if j and kind != 4: t = clamp(t + (1 if (x + y) % 2 else -1))
            c.tone(x, y, m, clamp(t))


def canvas(c, x0, y0, w, h, kind, seed=0, frame='wood'):
    """캔버스(나무 틀 1px, 위·왼 밝음) + 그림."""
    c.new()
    for x in range(x0, x0 + w): c.tone(x, y0, frame, 5); c.tone(x, y0 + h - 1, frame, 2)
    for y in range(y0, y0 + h): c.tone(x0, y, frame, 5); c.tone(x0 + w - 1, y, frame, 2)
    paint(c, x0 + 1, y0 + 1, w - 2, h - 2, kind, seed)


# ================================================================ 화가 소품
def easel(kind=0, seed=0):
    """나무 이젤(세 다리 A자 + 받침대) 위 캔버스 — 1×2."""
    c = C(16, 32, 501 + seed); c.shadow(8, 30, 6.5, 1.5)
    c.group(1); c.new()
    for y in range(9, 31):                                   # 앞 다리 둘(벌어짐) + 뒤 다리
        t = (y - 9) / 21
        c.tone(int(round(5 - 3 * t)), y, 'wood', 5); c.tone(int(round(10 + 3 * t)), y, 'wood', 3)
    for y in range(6, 28): c.tone(8, y, 'wood', 2)
    c.group(2); canvas(c, 2, 4, 12, 13, kind, seed)
    c.group(3); c.new()
    for x in range(1, 15): c.tone(x, 17, 'wood', 5 if x < 8 else 4); c.tone(x, 18, 'wood', 2)
    c.tone(7, 3, 'wood', 4); c.tone(8, 3, 'wood', 3)
    return _fin(c)


def easel_set():
    """화가 자리: 이젤 + 둥근 의자 + 의자 위 팔레트·붓 통 — 2×2."""
    c = C(32, 32, 511); c.shadow(16, 29, 13, 2)
    c.group(1); c.new()
    for y in range(9, 30):
        t = (y - 9) / 20
        c.tone(int(round(6 - 3 * t)), y, 'wood', 5); c.tone(int(round(11 + 3 * t)), y, 'wood', 3)
    for y in range(6, 27): c.tone(9, y, 'wood', 2)
    c.group(2); canvas(c, 2, 4, 14, 12, 0, 3)
    c.group(3); c.new()
    for x in range(1, 17): c.tone(x, 16, 'wood', 5 if x < 9 else 4); c.tone(x, 17, 'wood', 2)
    c.group(4); c.cylinder(24, 22, 26, 5, 'wood', capry=2)                      # 둥근 의자
    c.new()
    for y in range(27, 31): c.tone(20, y, 'wood', 3); c.tone(28, y, 'wood', 2)
    c.group(5); c.new()                                                          # 팔레트(콩 모양)
    for y in range(19, 23):
        for x in range(20, 28):
            if math.hypot((x + .5 - 24) / 4, (y + .5 - 21) / 1.8) <= 1 and not math.hypot(x + .5 - 26, y + .5 - 21) < 1: c.tone(x, y, 'ochre', 5 if y < 21 else 4)
    for (x, m) in ((21, 'red'), (23, 'sky'), (25, 'leaf'), (22, 'gold')): c.tone(x, 20 + (x % 2), m, 5)
    c.group(6); c.new()                                                          # 붓 통
    for y in range(14, 20):
        for x in range(29, 32): c.tone(x, y, 'iron', 5 if x == 29 else 3)
    for (x, y, m) in ((29, 11, 'wood'), (30, 12, 'wood'), (31, 10, 'wood')):
        for k in range(3): c.tone(x, y + k, m, 4)
    return _fin(c)


def canvas_stack(seed=0):
    """벽·노점 곁에 기대 세운 캔버스 넷(뒷면 틀 둘 + 그림 앞면 둘) — 1×1(위로 4px)."""
    c = C(16, 20, 521 + seed); c.shadow(8, 18.5, 7.5, 1.4)
    c.group(1); c.new()
    for y in range(2, 18):
        for x in range(1, 9):
            edge = x in (1, 8) or y in (2, 17)
            c.tone(x, y, 'cloth' if not edge else 'wood', 5 if edge and x == 1 else (3 if edge else 6 if (x + y) % 5 else 5))
    for y in range(2, 18): c.tone(4, y, 'wood', 3)
    c.group(2); canvas(c, 5, 4, 10, 13, (seed + 1) % 4, seed)
    c.group(3); canvas(c, 3, 9, 9, 9, (seed + 2) % 4, seed + 7)
    return _fin(c)


def painter_stall(seed=0):
    """그림 노점: 포도주·크림 줄무늬 차양 + 기둥 둘, 탁자 위 작은 금 액자 셋, 앞에 기대 세운 캔버스 둘 — 3×2(위로 차양 1칸 더)."""
    c = C(48, 48, 531 + seed); c.shadow(24, 45, 22, 2)
    c.group(1); c.new()
    for y in range(8, 46):
        for x in (3, 44): c.tone(x, y, 'wood', 4); c.tone(x + 1, y, 'wood', 2)
    c.group(2); c.new()
    for y in range(2, 13):                                                        # 차양(줄무늬, 앞쪽으로 처짐)
        for x in range(1, 47):
            band = (x // 6) % 2 == 0; m = 'wine' if band else 'cream'
            t = 6 if y < 4 else (5 if y < 9 else 4)
            if y >= 10:
                if (x % 6) > 4 - abs(y - 11): continue
                t = 3
            if x < 2: t += 1
            c.tone(x, y, m, clamp(t))
    c.group(3); c.box(4, 26, 40, 5, 9, 'wood', bias=.02)                           # 탁자(윗면 + 앞면 천)
    c.new()
    for y in range(31, 40):
        for x in range(4, 44): c.tone(x, y, 'wine', 4 if (x // 4) % 2 else 3)
    for x in range(4, 44): c.tone(x, 31, 'gold', 5 if x % 3 else 4)
    c.group(4)
    for i, x0 in enumerate((7, 18, 30)):                                          # 작은 금 액자(서 있는 받침)
        c.new()
        w, h = (9, 10) if i != 1 else (10, 12)
        y0 = 27 - h
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1): c.tone(x, y, 'gold', 6 if (x == x0 or y == y0) else 3)
        paint(c, x0 + 1, y0 + 1, w - 2, h - 2, (i + seed) % 4, seed + i)
    c.group(5); canvas(c, 2, 34, 11, 12, (seed + 3) % 4, seed + 4)
    c.group(6); canvas(c, 36, 33, 10, 13, (seed + 1) % 5, seed + 5)
    return _fin(c)


def art_screen(seed=0):
    """접이식 그림 진열판: 두 폭 나무 판(포도주 천) 위 금 액자 넷 — 2×2."""
    c = C(32, 32, 541 + seed); c.shadow(16, 30, 14, 1.8)
    c.group(1); c.new()
    for y in range(3, 29):
        for x in range(1, 31):
            left = x < 16
            t = 4 if left else 3
            if x in (1, 16): t = 5
            if x in (15, 30): t = 2
            c.tone(x, y, 'wine', t)
        c.tone(1, y, 'wood', 5); c.tone(30, y, 'wood', 2); c.tone(15, y, 'wood', 3); c.tone(16, y, 'wood', 5)
    for x in range(1, 31): c.tone(x, 2, 'wood', 6 if x < 16 else 5); c.tone(x, 3, 'wood', 4)
    for x in (3, 13, 18, 28):
        for y in range(29, 32): c.tone(x, y, 'wood', 3)
    c.group(2)
    for i, (x0, y0, w, h) in enumerate(((3, 6, 10, 9), (5, 17, 7, 9), (18, 6, 9, 8), (19, 16, 10, 10))):
        c.new()
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1): c.tone(x, y, 'gold', 6 if (x == x0 or y == y0) else 3)
        paint(c, x0 + 1, y0 + 1, w - 2, h - 2, (i + seed) % 5, seed + i)
    return _fin(c)


def poster_column():
    """광고 기둥(둥근 기둥에 붙인 공연·전시 포스터 — 색면만, 글자 없음) + 짙은 초록 돔 갓과 금 꼭지 — 1×3."""
    c = C(16, 48, 551); c.shadow(8, 46, 7, 1.5)
    c.group(1); c.cylinder(8, 41, 44, 6.5, 'iron', capry=2)
    c.group(2); c.new()
    for y in range(12, 42):
        for x in range(2, 15):
            dx = (x + .5 - 8) / 6.5
            if abs(dx) > 1: continue
            t = 5 if dx < -.35 else (4 if dx < .3 else 2)
            m = 'cream'
            col = int((x - 2) // 4.4); row = (y - 12) // 10
            pal = (('wine', 'ochre', 'sky'), ('navy', 'red', 'leaf'), ('ochre', 'wine', 'navy'))[row % 3]
            m = pal[col % 3]
            if (y - 12) % 10 in (0, 9) or (x - 2) % 5 == 4: m = 'cream'
            if (y - 12) % 10 in (3, 4) and 4 < x < 12 and m != 'cream': t = clamp(t + 2)
            c.tone(x, y, m, clamp(t))
    c.group(3); c.new()
    for y in range(6, 13):
        hw = (2, 4, 5, 6, 7, 7, 7)[y - 6]
        for x in range(8 - hw, 8 + hw):
            dx = (x + .5 - 8) / max(1, hw); t = 5 if dx < -.3 else (4 if dx < .3 else 2)
            if y == 12: t = 2
            c.tone(x, y, 'boxw', t)
    c.new(); c.tone(7, 4, 'gold', 6); c.tone(8, 4, 'gold', 4); c.tone(7, 5, 'gold', 5); c.tone(8, 5, 'gold', 3); c.tone(7, 3, 'gold', 5)
    return _fin(c)


# ================================================================ 조각
def plinth(c, x0, y0, w, d, h, mat='marble', gold=True):
    """대리석 받침(윗면 d줄 + 앞면 h줄), 앞면 위 금 띠."""
    c.box(x0, y0, w, d, h, mat, front=.6)
    for x in range(x0, x0 + w): c.tone(x, y0 + d, mat, 6); c.tone(x, y0 + d + h - 1, mat, 2)
    if gold:
        c.new()
        for x in range(x0 + 1, x0 + w - 1): c.tone(x, y0 + d + 2, 'gold', 5 if x < x0 + w // 2 else 4)


def sculpture_spiral():
    """추상 조각: 받침 위 대리석 나선 띠(빛 왼쪽 위) — 1×2."""
    c = C(16, 32, 561); c.shadow(8, 30, 7, 1.4)
    c.group(1); plinth(c, 2, 21, 12, 2, 8)
    c.group(2); c.new()
    for y in range(1, 22):                                                       # 두꺼운 나선 띠(앞을 지나는 띠는 밝고 뒤는 어둡다)
        a = (y - 1) / 21 * 2.4 * math.pi
        rad = 5.2 - (y - 1) / 21 * 2.2
        for k in range(-1, 2):
            xx = 8 + math.sin(a) * rad + k
            front = math.cos(a) > -.1
            t = (6 if math.sin(a) < -.2 else 5) if front else 3
            if k == 1: t -= 1
            c.tone(int(round(xx)), y, 'marble', clamp(t))
            c.tone(int(round(xx)), y + 1, 'marble', clamp(t - 1))
    return _fin(c)


def sculpture_ring():
    """추상 조각: 대리석 받침 위 기울어진 금 고리 — 1×2."""
    c = C(16, 32, 562); c.shadow(8, 30, 7, 1.4)
    c.group(1); plinth(c, 2, 21, 12, 2, 8, gold=False)
    c.group(2); c.new()
    for y in range(2, 22):
        for x in range(1, 15):
            r = math.hypot((x + .5 - 8) / 6.2, (y + .5 - 11) / 9.5)
            if .72 < r <= 1:
                t = 6 if (x < 7 and y < 10) else (5 if x < 8 else (4 if y < 14 else 3))
                c.tone(x, y, 'gold', t)
    c.new()
    for x in range(7, 10): c.tone(x, 20, 'gold', 3)
    return _fin(c)


def bust_pedestal():
    """흉상 받침: 가는 대리석 기둥 받침 위 얼굴 없는 흉상(머리 덩이 + 어깨 + 월계관 금) — 1×2."""
    c = C(16, 32, 563); c.shadow(8, 30, 6, 1.3)
    c.group(1); c.box(3, 26, 10, 1, 4, 'marble')
    c.group(2); c.new()
    for y in range(14, 27):
        for x in range(5, 11): c.tone(x, y, 'marble', (5, 5, 4, 4, 3, 2)[x - 5])
    c.group(3); c.box(4, 12, 8, 1, 2, 'marble', bias=.05)
    c.group(4); c.new()
    for y in range(7, 13):
        hw = (3, 4, 5, 5, 6, 6)[y - 7]
        for x in range(8 - hw, 8 + hw):
            dx = (x + .5 - 8) / hw; c.tone(x, y, 'marble', 5 if dx < -.3 else (4 if dx < .35 else 2))
    c.group(5); c.ellipsoid(8, 4.5, 2.9, 3.3, 'marble', amb=.35, bias=.08)
    c.new()
    for x in range(5, 11): c.tone(x, 2 + (abs(x - 8) > 1), 'leaf', 4 if x < 8 else 3)
    return _fin(c)


def statue_muse():
    """광장 큰 조각상: 계단 받침(대리석 + 금 띠) 위 옷자락 늘어진 형상이 한 팔로 금 월계관을 든다(얼굴 없음) — 2×4."""
    c = C(32, 64, 571); c.shadow(16, 61.5, 15, 2)
    c.group(1); c.box(2, 50, 28, 3, 9, 'marble', front=.58)
    for x in range(2, 30): c.tone(x, 53, 'marble', 6); c.tone(x, 58, 'marble', 2)
    c.new()
    for x in range(4, 28): c.tone(x, 55, 'gold', 5 if x < 16 else 4)
    c.group(2); c.box(6, 44, 20, 2, 4, 'marble', bias=.06)
    c.group(3); c.new()
    def rw(y):
        if y < 22: return 3 + (y - 17) * 1.1
        if y < 30: return 7.2 - (y - 22) * .2
        return 5.6 + (y - 30) * .45
    for y in range(17, 46):
        w = rw(y)
        for x in range(int(14 - w), int(14 + w) + 1):
            u = (x + .5 - 14) / w; t = 6 if u < -.5 else (5 if u < -.1 else (4 if u < .4 else 2))
            if y >= 30 and (x - 14 + (y // 6)) % 4 == 0: t -= 1                    # 옷 주름
            c.tone(x, y, 'marble', clamp(t))
    c.group(4); c.ellipsoid(14, 13.5, 3.4, 3.8, 'marble', amb=.38, bias=.08)
    c.group(5); c.new()                                                          # 든 팔(오른쪽 위로)
    for i in range(12):
        x = 18 + i // 2; y = 22 - i
        c.tone(x, y, 'marble', 5); c.tone(x + 1, y, 'marble', 3)
    c.group(6); c.new()                                                          # 금 월계관(고리)
    for y in range(4, 11):
        for x in range(19, 29):
            r = math.hypot((x + .5 - 24) / 4.6, (y + .5 - 7.5) / 3.2)
            if .55 < r <= 1: c.tone(x, y, 'gold', 6 if (x < 24 and y < 8) else (5 if x < 25 else 3))
    c.new()                                                                      # 다른 팔이 든 옷자락
    for y in range(24, 36): c.tone(8 - (y - 24) // 5, y, 'marble', 5 if y < 30 else 4)
    return _fin(c)


def statue_winged():
    """날개 조각상: 둥근 받침 위 크게 편 두 날개와 옷자락 형상(얼굴 없음, 승리의 여신류 일반 어휘) — 2×3."""
    c = C(32, 48, 572); c.shadow(16, 45.5, 13, 2)
    c.group(1); c.cylinder(16, 36, 42, 10, 'marble', capry=3.2)
    c.new()
    for x in range(7, 26): c.tone(x, 40, 'gold', 5 if x < 16 else 4)
    c.group(2); c.new()                                                          # 날개 둘(뒤): 깃 줄이 아래로 비스듬
    for side in (-1, 1):
        for y in range(3, 27):
            span = 12 - abs(y - 9) * .55 if y < 9 else 12 - (y - 9) * .62
            if span < 1: continue
            for i in range(int(span)):
                x = 16 + side * (3 + i)
                feather = (i + y // 2) % 4 == 0
                t = (5 if side < 0 else 3) - (1 if feather else 0) + (1 if y < 8 else 0)
                c.tone(x, y + i // 4, 'marble', clamp(t))
    c.group(3); c.new()
    def rw(y):
        if y < 18: return 2.4 + (y - 13) * .7
        if y < 26: return 4.2 - (y - 18) * .15
        return 3 + (y - 26) * .75
    for y in range(13, 37):
        w = rw(y)
        for x in range(int(16 - w), int(16 + w) + 1):
            u = (x + .5 - 16) / w; t = 6 if u < -.45 else (5 if u < 0 else (4 if u < .45 else 2))
            if y > 27 and (x + y // 3) % 4 == 0: t -= 1
            c.tone(x, y, 'marble', clamp(t))
    c.group(4); c.ellipsoid(16, 9.5, 2.7, 3.1, 'marble', amb=.38, bias=.08)
    c.new()
    for i in range(7): c.tone(19 + i // 2, 15 - i, 'marble', 4)                  # 앞으로 든 팔
    c.tone(23, 7, 'gold', 6); c.tone(23, 8, 'gold', 4); c.tone(22, 7, 'gold', 5)  # 손에 든 금 별
    return _fin(c)


# ================================================================ 분수
def fountain_grand():
    """광장 큰 분수: 팔각 같은 둥근 큰 수반(대리석 테 + 금 띠, 물결), 가운데 두 단 받침 접시(물 흘러내림), 꼭대기 금 솔방울 — 4×4."""
    c = C(64, 64, 581); c.shadow(32, 61, 31, 2.5)
    cx, cy, rx, ry = 32, 44, 30, 13
    c.group(1); c.new()
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(1, 64):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; r = dx * dx + dy * dy
            if r <= 1: c.setv(x, y, 'marble', .95 - .08 * dy)
    c.group(2); c.new()
    for y in range(cy - ry + 2, cy + ry - 1):
        for x in range(4, 61):
            dx = (x + .5 - cx) / (rx - 4); dy = (y + .5 - cy + .5) / (ry - 3); r = math.sqrt(dx * dx + dy * dy)
            if r <= 1:
                t = 2 if dy < -.45 else 3
                for r0 in (.38, .72):
                    if r0 < r < r0 + .07: t = 4
                c.tone(x, y, 'teal', t)
    for x in range(2, 63):                                                        # 앞 수반 벽(곡면) + 금 띠
        dx = (x + .5 - cx) / rx
        if abs(dx) > 1: continue
        yt = int(cy + ry * math.sqrt(1 - dx * dx))
        for j in range(7):
            v = c.shade(dx, .1, math.sqrt(1 - dx * dx), .3) + (_hash((x + (4 if j >= 4 else 0)) // 8, j // 4, 581) - .5) * .12
            if j == 2: c.tone(x, yt + j, 'gold', 5 if dx < 0 else 4); continue
            if j == 6: c.tone(x, yt + j, 'marble', 2); continue
            c.setv(x, yt + j, 'marble', v)
    c.group(3); c.cylinder(32, 30, 44, 4.5, 'marble', capry=1.6)                  # 받침 기둥
    c.group(4); c.new()                                                           # 아래 접시
    for y in range(24, 33):
        for x in range(18, 47):
            dx = (x + .5 - 32) / 14; dy = (y + .5 - 27) / 4
            if dx * dx + dy * dy <= 1:
                if y < 27: c.tone(x, y, 'teal', 4 if (x + y) % 5 else 5)
                else: c.tone(x, y, 'marble', 6 if dx < -.3 else (5 if dx < .3 else 3))
    for x in range(19, 46):
        dx = (x + .5 - 32) / 14
        if abs(dx) <= 1: c.tone(x, 27 + int(4 * math.sqrt(1 - dx * dx)), 'gold', 5 if dx < 0 else 3)
    c.group(5); c.cylinder(32, 16, 24, 2.6, 'marble', capry=1)
    c.group(6); c.new()                                                           # 위 접시
    for y in range(12, 18):
        for x in range(24, 41):
            dx = (x + .5 - 32) / 8; dy = (y + .5 - 14) / 2.6
            if dx * dx + dy * dy <= 1: c.tone(x, y, 'teal', 4) if y < 14 else c.tone(x, y, 'marble', 6 if dx < 0 else 3)
    c.group(7); c.ellipsoid(32, 8, 2.8, 4, 'gold', amb=.3, bias=.12)              # 금 솔방울
    c.new()
    for (x0, y0, y1) in ((20, 28, 42), (44, 28, 42), (25, 16, 26), (39, 16, 26), (30, 9, 13), (34, 9, 13)):   # 떨어지는 물줄기
        for y in range(y0, y1):
            c.tone(x0, y, 'teal', 5 if y % 3 else 6); c.tone(x0 + (1 if x0 < 32 else -1), y, 'teal', 4)
    for (x, y) in ((19, 42), (21, 43), (45, 42), (43, 43), (26, 26), (38, 26)):
        c.tone(x, y, 'teal', 6); c.tone(x + 1, y, 'teal', 6)
    return _fin(c)


def fountain_garden():
    """정원 분수: 낮은 둥근 연못(회양목 둘레 없이 대리석 테), 가운데 금 물고기 조각이 물을 뿜는다 — 3×3."""
    c = C(48, 48, 582); c.shadow(24, 45.5, 23, 2)
    cx, cy, rx, ry = 24, 32, 22, 10
    c.group(1); c.new()
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(1, 48):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1: c.setv(x, y, 'marble', .95 - .08 * dy)
    c.group(2); c.new()
    for y in range(cy - ry + 2, cy + ry - 1):
        for x in range(4, 45):
            dx = (x + .5 - cx) / (rx - 3.5); dy = (y + .5 - cy + .5) / (ry - 2.8); r = math.sqrt(dx * dx + dy * dy)
            if r <= 1:
                t = 2 if dy < -.45 else 3
                if .45 < r < .53 or .8 < r < .86: t = 4
                c.tone(x, y, 'teal', t)
    for x in range(2, 47):
        dx = (x + .5 - cx) / rx
        if abs(dx) > 1: continue
        yt = int(cy + ry * math.sqrt(1 - dx * dx))
        for j in range(5):
            if j == 4: c.tone(x, yt + j, 'marble', 2); continue
            c.setv(x, yt + j, 'marble', c.shade(dx, .1, math.sqrt(1 - dx * dx), .3))
    c.group(3); c.cylinder(24, 26, 32, 3, 'marble', capry=1.2)
    c.group(4); c.new()                                                           # 금 물고기(꼬리 위로)
    for y in range(14, 27):
        hw = max(1, int(3.2 - abs(y - 21) * .35))
        for x in range(24 - hw, 24 + hw + 1): c.tone(x, y, 'gold', 6 if x < 24 and y < 21 else (5 if x <= 24 else 3))
    for (x, y) in ((21, 13), (22, 14), (26, 13), (25, 14)): c.tone(x, y, 'gold', 4)
    c.new()
    for y in range(6, 14): c.tone(24, y, 'teal', 6 if y < 9 else 5)
    for i in range(7):
        c.tone(23 - i, 7 + i * 2, 'teal', 5); c.tone(25 + i, 7 + i * 2, 'teal', 4)
    return _fin(c)


# ================================================================ 거리·정원 소품
def lamp_gilt():
    """금 가로등: 검은 쇠 기둥(금 테 둘), 금 등롱(유리 불빛), 꼭대기 금 공 — 1×3."""
    c = C(16, 48, 591); c.shadow(8, 46, 5, 1.3)
    c.group(1); c.box(4, 41, 8, 2, 3, 'iron'); c.box(5, 38, 6, 1, 3, 'iron', bias=.05)
    c.new()
    for x in range(5, 11): c.tone(x, 39, 'gold', 5 if x < 8 else 4)
    c.group(2); c.new()
    for y in range(14, 38): c.tone(7, y, 'iron', 3); c.tone(8, y, 'iron', 1)
    for y in (22, 30): c.tone(7, y, 'gold', 5); c.tone(8, y, 'gold', 3)
    c.group(3); c.new()
    for y in range(4, 14):
        hw = (1, 2, 3, 3, 3, 3, 3, 3, 2, 2)[y - 4]
        for x in range(8 - hw - 1, 8 + hw):
            edge = x in (8 - hw - 1, 8 + hw - 1) or y in (4, 5, 12, 13)
            if edge: c.tone(x, y, 'gold', 5 if x < 8 else 3)
            else: c.tone(x, y, 'fire', 6 if (x <= 7 and y < 10) else 5)
    c.new(); c.tone(7, 2, 'gold', 6); c.tone(8, 2, 'gold', 4); c.tone(7, 3, 'gold', 5); c.tone(8, 3, 'gold', 3)
    return _fin(c)


def lamp_gilt_double():
    """쌍등 금 가로등: pz.lamp_double 과 같은 기하에 금 팔·금 등롱 — 2×3."""
    c = C(32, 48, 592); c.shadow(16, 45.6, 6, 1.3)
    c.group(1); c.box(12, 40, 8, 2, 4, 'iron'); c.box(13, 37, 6, 1, 3, 'iron', bias=.05)
    c.new()
    for x in range(13, 19): c.tone(x, 38, 'gold', 5 if x < 16 else 4)
    c.group(2); c.new()
    for y in range(9, 37): c.tone(15, y, 'iron', 3); c.tone(16, y, 'iron', 1)
    for y in (20, 30): c.tone(15, y, 'gold', 5); c.tone(16, y, 'gold', 3)
    c.group(3); c.new()
    for x in range(5, 27): c.tone(x, 9, 'gold', 5 if x < 16 else 4); c.tone(x, 10, 'gold', 2)
    c.line(8, 11, 13, 15, 'iron', 3); c.line(23, 11, 18, 15, 'iron', 2)
    c.tone(15, 7, 'gold', 6); c.tone(16, 7, 'gold', 4); c.tone(15, 6, 'gold', 5); c.tone(16, 6, 'gold', 4)
    for cx, g in ((6, 4), (25, 5)): _pz.lantern(c, cx, 11, g)
    return _fin(c)


def cafe_table(seed=0):
    """카페 탁자: 포도주 식탁보 둥근 탁자 + 쇠 의자 둘(등받이 둥근 테) + 잔 둘·꽃 한 송이 — 2×2."""
    c = C(32, 32, 601 + seed); c.shadow(16, 29, 14, 2)
    c.group(1)
    for sx in (2, 25):                                                           # 비스트로 의자(등받이 테 + 둥근 방석 + 다리)
        c.new()
        for y in range(10, 19):
            c.tone(sx, y, 'iron', 4); c.tone(sx + 4, y, 'iron', 2)
        for x in range(sx, sx + 5): c.tone(x, 10, 'iron', 5 if x < sx + 3 else 3); c.tone(x, 14, 'iron', 3)
        c.new()
        for x in range(sx - 1, sx + 6): c.tone(x, 19, 'wine', 5 if x < sx + 3 else 4); c.tone(x, 20, 'wine', 3)
        for x in range(sx - 1, sx + 6): c.tone(x, 21, 'iron', 2)
        for y in range(22, 28): c.tone(sx, y, 'iron', 3); c.tone(sx + 4, y, 'iron', 2)
    c.group(2); c.new()
    for y in range(12, 27):                                                      # 탁자 천(윗면 타원 + 늘어진 앞)
        for x in range(7, 25):
            dx = (x + .5 - 16) / 9
            if abs(dx) > 1: continue
            ytop = 15 - 3 * math.sqrt(1 - dx * dx); ybot = 15 + 3 * math.sqrt(1 - dx * dx)
            if y < ytop: continue
            if y <= ybot: c.tone(x, y, 'wine', 5 if dx < .2 else 4)
            elif y < 23 + (1 if (x % 4 == 0) else 0): c.tone(x, y, 'wine', 3 if (x % 4) else 2)
    for x in range(8, 24):
        dx = (x + .5 - 16) / 9
        if abs(dx) <= 1: c.tone(x, int(15 + 3 * math.sqrt(1 - dx * dx)), 'gold', 5 if x < 16 else 4)
    for y in range(24, 29): c.tone(15, y, 'iron', 3); c.tone(16, y, 'iron', 2)
    c.group(3); c.new()
    for (x, y) in ((11, 13), (19, 14)):                                          # 잔
        c.tone(x, y, 'cream', 6); c.tone(x + 1, y, 'cream', 6); c.tone(x, y + 1, 'cream', 4); c.tone(x + 1, y + 1, 'cream', 3)
    c.tone(16, 11, 'red', 5); c.tone(16, 12, 'leaf', 4); c.tone(15, 12, 'leaf', 3)
    return _fin(c)


def cafe_parasol(seed=0):
    """카페 파라솔: 포도주·크림 여덟 폭 파라솔(금 꼭지) 아래 탁자와 의자 — 3×3(위 2줄은 걷기·가림)."""
    c = C(48, 48, 611 + seed)
    t = cafe_table(seed + 3)
    c.group(1); c.new()
    for y in range(8, 34): c.tone(23, y, 'iron', 4); c.tone(24, y, 'iron', 2)
    c.group(2); c.new()
    for y in range(1, 15):
        hw = 2 + y * 1.6
        for x in range(int(24 - hw), int(24 + hw) + 1):
            seg = int((x - 24) / 4.2 + 10) % 2; m = 'wine' if seg else 'cream'
            tt = 6 if x < 20 else (5 if x < 25 else 4)
            if y >= 12: tt -= 2
            if y >= 13 and (x % 6) > 3: continue
            c.tone(x, y, m, clamp(tt))
    c.new(); c.tone(23, 0, 'gold', 6); c.tone(24, 0, 'gold', 4); c.tone(23, 1, 'gold', 5); c.tone(24, 1, 'gold', 3)
    o = new(48, 48); o.alpha_composite(t, (8, 16)); o.alpha_composite(_fin(c))
    return o


def terrace_planter():
    """테라스 꽃 상자 난간: 긴 나무 상자 위 붉은·분홍 꽃과 잎 덩이(카페 테라스 가장자리) — 2×1."""
    c = C(32, 16, 621); c.shadow(16, 15, 15, 1)
    c.group(1); c.box(1, 7, 30, 2, 6, 'wood')
    c.new()
    for x in range(1, 31): c.tone(x, 9, 'gold', 5 if x % 4 else 4)
    c.group(2); c.new()
    for x in range(2, 30):
        for y in range(2, 8):
            if vnoise(x, y, 2.2, 622) * 6 + abs(y - 5) > 5.2: continue
            c.tone(x, y, 'leaf', 4 if y < 5 else 3)
    c.new()
    for i, x in enumerate(range(3, 29, 3)):
        m = ('red', 'pink', 'gold')[i % 3]; y = 3 + (i * 7) % 3
        c.tone(x, y, m, 5); c.tone(x + 1, y, m, 4); c.tone(x, y + 1, m, 4)
    return _fin(c)


def bench_marble():
    """대리석 긴 의자: 받침 둘 위 판(윗면 + 앞 모서리), 금 없음 — 2×1."""
    c = C(32, 16, 631); c.shadow(16, 14.5, 15, 1.5)
    c.group(1); c.box(4, 9, 5, 1, 5, 'marble'); c.box(23, 9, 5, 1, 5, 'marble')
    c.group(2); c.box(1, 3, 30, 4, 3, 'marble', bias=.04)
    for x in range(1, 31): c.tone(x, 3, 'marble', 6)
    return _fin(c)


def urn_flowers():
    """꽃 항아리: 대리석 받침 위 금 테 돌 항아리에 붉은 꽃 — 1×2."""
    c = C(16, 32, 641); c.shadow(8, 30, 6, 1.3)
    c.group(1); c.box(3, 24, 10, 2, 5, 'marble')
    c.group(2); c.new()
    for y in range(13, 24):
        hw = (6, 6, 5, 5, 4, 4, 3, 2, 2, 3, 4)[y - 13]
        for x in range(8 - hw, 8 + hw):
            dx = (x + .5 - 8) / hw; t = 6 if dx < -.4 else (5 if dx < .1 else (4 if dx < .5 else 2))
            c.tone(x, y, 'marble', t)
    for x in range(2, 14): c.tone(x, 13, 'gold', 5 if x < 8 else 4)
    c.group(3); c.new()
    for y in range(5, 14):
        for x in range(2, 14):
            if math.hypot((x + .5 - 8) / 6, (y + .5 - 10) / 4.4) > 1: continue
            c.tone(x, y, 'leaf', 4 if x < 8 else 3)
    for (x, y, m) in ((5, 7, 'red'), (8, 6, 'red'), (11, 8, 'pink'), (6, 10, 'pink'), (10, 11, 'red'), (8, 9, 'gold')):
        c.tone(x, y, m, 5); c.tone(x + 1, y, m, 4); c.tone(x, y + 1, m, 3)
    return _fin(c)


def topiary(kind='spiral'):
    """정원 회양목 다듬기: spiral(세 단 나선 원뿔) · ball(공) · cone(원뿔), 금 테 포도주 화분 — 1×2 / 1×1."""
    if kind == 'ball':
        c = C(16, 16, 651); c.shadow(8, 15, 6, 1)
        c.group(1); c.box(4, 11, 8, 1, 4, 'wine')
        for x in range(4, 12): c.tone(x, 12, 'gold', 5)
        c.group(2); c.ellipsoid(8, 6.5, 6, 5.5, 'boxw', amb=.25, bump=.5)
        return _fin(c)
    c = C(16, 32, 652 if kind == 'spiral' else 653); c.shadow(8, 30, 6, 1.3)
    c.group(1); c.box(3, 24, 10, 2, 5, 'wine')
    c.new()
    for x in range(3, 13): c.tone(x, 26, 'gold', 5 if x < 8 else 4)
    c.group(2)
    if kind == 'spiral':
        for (cy, r) in ((20, 5.5), (14, 4.4), (9, 3.4), (4.5, 2.4)):
            c.ellipsoid(8, cy, r, r * .78, 'boxw', amb=.25, bump=.4)
    else:
        c.new()
        for y in range(2, 25):
            hw = .6 + (y - 2) * .26
            for x in range(int(8 - hw), int(8 + hw) + 1):
                u = (x + .5 - 8) / max(.6, hw); c.setv(x, y, 'boxw', .9 - .55 * (u + .6) * .7)
    return _fin(c)


def parterre_bed(seed=0):
    """회양목 화단: 낮게 다듬은 회양목 테(윗면 + 앞면) 안에 장미 덩이 — 3×2."""
    c = C(48, 32, 661 + seed); c.shadow(24, 30, 23, 1.5)
    c.group(1); c.new()
    for y in range(4, 28):
        for x in range(1, 47):
            edge = x < 5 or x >= 43 or y < 8 or y >= 22
            if not edge:
                c.tone(x, y, 'dirt', 3 if (x + y) % 4 else 2); continue
            if y >= 24: c.setv(x, y, 'boxw', .45 - (y - 24) * .05)              # 앞면
            else: c.setv(x, y, 'boxw', .9 if y < 6 or x < 3 else .78)
    c.group(2)
    r = __import__('random').Random(seed)
    for i in range(7):
        x = 9 + i * 5 + r.randint(-1, 1); y = 13 + r.randint(-2, 3)
        c.ellipsoid(x, y, 3, 2.6, 'leaf', amb=.3, bump=.5)
    c.new()
    for i in range(14):
        x = 7 + r.randint(0, 33); y = 11 + r.randint(0, 7); m = ('red', 'pink', 'red', 'cream')[i % 4]
        c.tone(x, y, m, 5); c.tone(x + 1, y, m, 4); c.tone(x, y + 1, m, 3)
    return _fin(c)


def rose_arch():
    """장미 아치: 쇠 아치 두 기둥(아랫줄만 막힘)과 그 위를 덮은 장미 넝쿨 — 3×3(가운데 아래는 걷는 길)."""
    c = C(48, 48, 671); c.shadow(6, 46, 4, 1); c.shadow(42, 46, 4, 1)
    c.group(1); c.new()
    for y in range(12, 47):
        for x in (5, 41): c.tone(x, y, 'iron', 4); c.tone(x + 1, y, 'iron', 2)
    for x in range(5, 43):
        dx = (x + .5 - 24) / 18.5
        if abs(dx) <= 1: y = int(14 - 10 * math.sqrt(1 - dx * dx)); c.tone(x, y, 'iron', 4); c.tone(x, y + 1, 'iron', 2)
    c.group(2)
    r = __import__('random').Random(5)
    pts = []
    for k in range(26):
        a = k / 25 * math.pi
        pts.append((24 - math.cos(a) * 18.5, 14 - math.sin(a) * 10))
    for y in range(16, 40, 4): pts += [(5.5, y), (41.5, y)]
    for (x, y) in pts:
        c.ellipsoid(x + r.uniform(-1, 1), y + r.uniform(-1, 1), 3.2, 2.8, 'leaf', amb=.3, bump=.6)
    c.new()
    for (x, y) in pts[::2]:
        xx = int(x + r.uniform(-2, 2)); yy = int(y + r.uniform(-2, 1)); m = 'red' if r.random() < .7 else 'pink'
        c.tone(xx, yy, m, 5); c.tone(xx + 1, yy, m, 4); c.tone(xx, yy + 1, m, 3)
    return _fin(c)


def sundial():
    """해시계: 대리석 기둥 받침 위 금 원판과 비스듬한 금 바늘 — 1×2."""
    c = C(16, 32, 681); c.shadow(8, 30, 6, 1.3)
    c.group(1); c.box(3, 25, 10, 1, 4, 'marble')
    c.group(2); c.new()
    for y in range(12, 25):
        for x in range(5, 11): c.tone(x, y, 'marble', (5, 5, 4, 4, 3, 2)[x - 5])
    c.group(3); c.new()
    for y in range(6, 13):
        for x in range(1, 15):
            r = math.hypot((x + .5 - 8) / 7, (y + .5 - 9) / 3.2)
            if r <= 1: c.tone(x, y, 'gold' if r < .85 else 'marble', (5 if x < 8 else 4) if r < .85 else 4)
    for i in range(6): c.tone(8 + i // 2, 9 - i, 'gold', 6 if i < 3 else 3)
    for k in range(6):
        a = k / 6 * math.pi
        c.tone(int(8 - math.cos(a) * 5.5), int(9 - math.sin(a) * 2.2), 'gold', 2)
    return _fin(c)


def carriage_noble():
    """귀족 마차: roman.carriage 의 기하를 검은 옻칠 몸통 + 금 테 + 포도주 창 커튼으로 다시 칠한다 — 3×2."""
    im = roman.carriage(0, 'red')
    a = np.array(im).astype(int); r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    body = (r_ > g_ + 40) & (r_ > b_ + 30) & (a[..., 3] > 0)
    out = recolor_lum(im, [hx(x) for x in px2.PAL['navy']], 1, 4, mask=body)
    o = np.array(out)
    edge = body & ~np.roll(body, 1, 0)
    o[edge, :3] = GOLD[5]
    return Image.fromarray(o, 'RGBA').copy()


def gate_iron():
    """금 꼭지 쇠 대문(3×2): 안쪽으로 활짝 열어 문기둥 곁에 붙인 두 짝(좁게 보인다) + 위 둥근 금 아치 장식.
    세 칸 모두 걷는 길(짝은 문기둥에 붙어 있다). 양옆에 gate_pier 를 둔다."""
    c = C(48, 32, 691)
    c.group(1); c.new()
    for side in (0, 1):
        x0 = 0 if side == 0 else 42
        for x in range(x0, x0 + 6):
            for y in range(8, 31):
                if (x - x0) % 2 == 0: c.tone(x, y, 'iron', 3 if side == 0 else 2)
            for yy in (10, 20, 30): c.tone(x, yy, 'iron', 4)
            if (x - x0) % 2 == 0: c.tone(x, 7, 'gold', 6 if side == 0 else 4); c.tone(x, 6, 'gold', 5)
        for y in range(13, 18):
            for x in range(x0 + 1, x0 + 5):
                d = math.hypot(x + .5 - (x0 + 3), y + .5 - 15.5)
                if 1 < d < 2.3: c.tone(x, y, 'gold', 5)
    c.group(2); c.new()
    for x in range(0, 48):
        dx = (x + .5 - 24) / 23
        if abs(dx) <= 1:
            y = int(8 - 7 * math.sqrt(1 - dx * dx)); c.tone(x, y, 'gold', 6 if x < 24 else 4); c.tone(x, y + 1, 'iron', 3)
            for yy in range(y + 2, 9):
                if x % 3 == 0: c.tone(x, yy, 'iron', 2)
    for x in range(0, 48): c.tone(x, 9, 'iron', 4); c.tone(x, 10, 'iron', 2)
    c.new()
    for y in range(0, 3): c.tone(23, y, 'gold', 6); c.tone(24, y, 'gold', 4)
    return _fin(c)
