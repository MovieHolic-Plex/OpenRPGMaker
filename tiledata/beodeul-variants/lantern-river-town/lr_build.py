# 등불 수향 마을 — 건물·구조물(3/4: 윗면 지붕 + 앞면 벽, 옆면 없음). 톤 캔버스(TC)에 칠한 뒤 pz.fin 윤곽.
# 2층 목조 객잔, 물가 찻집, 흰 벽 민가(마두벽 계단 박공), 아치 돌다리, 남북 돌다리, 널다리, 패루(문), 부두, 물가 돌계단.
# 지붕 = jroof(eastern-castle 복사본) — 회청 기와 + 처마 끝 들림(wuxia 규격 3: 양 끝 1~2px 가 아니라 sori 로 휘게, 치미는 작은 꼬리만).
import math
from lr_base import *
from lr_base import _hash


# ================================================================ 공용 부품
def lattice(tc, x0, y0, w, h, lit=False, pattern='grid'):
    """격자 창살(나무 살 + 종이). pattern='grid' 네모 살, 'ice' 빙렬 무늬(대각 살 엇갈림), 'round' 둥근 창(원 안 격자).
    lit = 종이에 불빛(저녁 장면용)."""
    cx, cy = x0 + w / 2.0, y0 + h / 2.0
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly = x - x0, y - y0
            if pattern == 'round' and ((x + .5 - cx) / (w / 2.0)) ** 2 + ((y + .5 - cy) / (h / 2.0)) ** 2 > 1: continue
            frame = lx in (0, w - 1) or ly in (0, h - 1)
            if pattern == 'round':
                frame = ((x + .5 - cx) / (w / 2.0)) ** 2 + ((y + .5 - cy) / (h / 2.0)) ** 2 > .72
            if frame: tc.px(x, y, 'wood', 4 if (lx == 0 or ly == 0 or x < cx) else 2); continue
            if pattern == 'ice': bar = (lx + ly) % 4 == 0 or (lx - ly) % 6 == 0
            else: bar = lx % 3 == 0 or ly % 3 == 0
            if bar: tc.px(x, y, 'wood', 3)
            else: tc.px(x, y, 'amber' if lit else 'washi', (5 if ly < h // 2 else 4) if lit else (5 if ly < h // 2 else 4))


def wood_wall(tc, x0, y0, x1, y1, seed=0, base=3, plank=5):
    """나무 판벽(앞면): 세로 널 plank px, 널마다 톤 흔들림, 왼 모 +1, 오른 줄 −1, 오른쪽 2px 그늘."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            col = (x - x0) // plank; lx = (x - x0) % plank
            k = base + (1 if _hash(col, 0, seed) > .72 else 0) - (1 if _hash(col, 1, seed) < .15 else 0)
            if lx == 0: k += 1
            elif lx == plank - 1: k -= 1
            if x >= x1 - 2: k -= 1
            if _hash(x, y, seed + 6) < .04: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))


def eave_shadow(tc, x0, x1, y, rows=3):
    """처마 밑 그늘(벽 위 rows 줄을 어둡게) — 이미 칠한 화소만."""
    for yy in range(y, y + rows):
        for x in range(x0, x1): tc.shift(x, yy, -2 if yy < y + rows - 1 else -1)


def double_door(tc, x0, y0, w, h, open_=True, mat='wood'):
    """두 짝 나무 문(문지방 + 문틀). open_ = 안쪽으로 열려 속 어둠(가운데)이 보인다."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly = x - x0, y - y0
            if lx in (0, w - 1) or ly == 0: tc.px(x, y, mat, 5 if (lx == 0 or ly == 0) else 2); continue
            if open_ and 3 <= lx < w - 3: tc.px(x, y, 'dark', 2 if ly < 4 else 1); continue
            k = 3 + (1 if lx % 4 == 1 else 0)
            if ly in (h // 3, 2 * h // 3): k = 2
            tc.px(x, y, mat, k)
    for x in range(x0 - 1, x0 + w + 1): tc.px(x, y0 + h, 'stone', 5); tc.px(x, y0 + h + 1, 'stone', 3)   # 돌 문지방


def railing(tc, x0, x1, y, h=6, mat='shu', step=8):
    """난간(앞면): 위 가로대 2px(빛·그늘) + 아래 가로대 + 살(step px 마다 기둥, 사이 짧은 살 2개)."""
    for x in range(int(x0), int(x1)):
        tc.px(x, y, mat, 5); tc.px(x, y + 1, mat, 3)
        tc.px(x, y + h - 1, mat, 3)
        lx = (x - x0) % step
        if lx == 0:
            for yy in range(y - 1, y + h): tc.px(x, yy, mat, 5); tc.px(x + 1, yy, mat, 2)
        elif lx in (3, 5):
            for yy in range(y + 2, y + h - 1): tc.px(x, yy, mat, 4)


def stone_base(tc, x0, y0, x1, y1, seed=0):
    """돌 기단(앞면): 화강암 장대석 줄쌓기(줄 4~5px), 위 갓돌 빛 2px."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if y < y0 + 2: k = 5 if y == y0 else 4
            else:
                row = (y - y0 - 2) // 5; ly = (y - y0 - 2) % 5
                off = int(_hash(row, 0, seed) * 20)
                lx = (x - x0 + off) % 20
                k = 4 if _hash((x - x0 + off) // 20, row, seed + 1) > .4 else 3
                if ly == 4 or lx == 19: k = 1
                elif ly == 0: k += 1
                if x >= x1 - 2: k -= 1
            tc.px(x, y, 'gran', clamp(k, 1, 6))


def hang_lanterns(tc, x0, x1, y, n, h=9, w=7):
    for i in range(n):
        cx = x0 + (x1 - x0) * (i + .5) / n
        for j in range(2): tc.px(int(cx), y + j, 'kuro', 3)
        red_lantern(tc, cx, y + 2, h=h, w=w)


# ================================================================ ① 2층 목조 객잔
def inn(seed=1):
    """앵커 ①: 2층 목조 객잔 8x8칸. 1층 = 주칠 기둥 다섯 사이 나무 판벽·격자창, 가운데 2칸 활짝 연 두 짝 문(속 어둠) + 위 편액(글자 없음),
    1층 처마(회청 기와 앞 경사, 끝이 휜다) 밑에 홍등 넷. 2층 = 주칠 난간 툇마루 + 빙렬 격자 장지 + 기둥, 꼭대기 팔작지붕(치미 꼬리).
    돌 기단 한 줄. 발자국: 아래 2줄(1층 벽) 막힘, 문 2칸 걷기."""
    W, H = 128, 128
    tc = TC(W, H, seed)
    gb = H - 3                                   # 1층 벽 밑
    g_top = gb - 30                              # 1층 벽 위
    e1_top = g_top - 14                          # 1층 처마 위
    f2_bot = e1_top + 6; f2_top = f2_bot - 24    # 2층 벽
    r_top = f2_top + 8 - 40                      # 꼭대기 지붕
    jroof(tc, 6, r_top, W - 12, 40, kind='hip', yb=.42, e=22, sori=5, flare=4, gold=False)
    # 2층
    wood_wall(tc, 12, f2_top + 6, W - 12, f2_bot, seed=seed + 2, base=3)
    for i in range(6):
        x = 14 + i * 17
        if i < 6: lattice(tc, x + 3, f2_top + 9, 12, 10, pattern='ice')
    for px_ in range(12, W - 12, 17): red_post(tc, px_, f2_top + 6, f2_bot, w=3, cap=False)
    eave_shadow(tc, 12, W - 12, f2_top + 6, 3)
    railing(tc, 10, W - 10, f2_bot - 7, h=7, step=10)
    # 1층 처마(앞 경사만) + 홍등
    jroof(tc, 0, e1_top, W, 18, kind='hip', yb=0.0, e=10, sori=4, flare=3, ridge=False)
    # 1층
    wood_wall(tc, 8, g_top, W - 8, gb, seed=seed + 1, base=3)
    eave_shadow(tc, 8, W - 8, g_top, 4)
    dx0 = 48
    double_door(tc, dx0, g_top + 8, 32, gb - g_top - 8, open_=True)
    for x in (12, 28, 86, 102): lattice(tc, x, g_top + 9, 13, 12, pattern='grid')
    for px_ in (8, 44, 80, W - 11): red_post(tc, px_, g_top, gb, w=3)
    plaque(tc, dx0 + 6, g_top + 1, 20, 6)
    hang_lanterns(tc, 14, W - 14, e1_top + 16, 4)
    stone_base(tc, 4, gb, W - 4, H, seed=seed + 5)
    tc.grain(.02, mats=('wood',))
    return tc.fin(.6)


# ================================================================ ② 물가 찻집(정자식)
def teahouse(seed=2):
    """앵커 ②: 물가 찻집 6x6칸. 사방이 트인 1층 정자식 집: 주칠 기둥 넷 + 낮은 난간 + 위 그물 살 띠(낙양), 안쪽에 찻상·의자 그림자,
    처마 끝이 크게 휜 팔작지붕 + 용마루 꼬리. 앞은 널 마루 툇단(물가 쪽). 발자국: 기둥 칸만 막힘(앞 기둥 둘), 가운데 2칸 걷기."""
    W, H = 96, 96
    tc = TC(W, H, seed)
    fb = H - 6; ft = fb - 30
    r_top = ft + 10 - 46
    jroof(tc, 0, r_top, W, 46, kind='hip', yb=.44, e=26, sori=7, flare=5)
    # 안쪽(그늘): 뒷벽 판벽 + 둥근 창 + 찻상
    for y in range(ft, fb):
        for x in range(8, W - 8): tc.px(x, y, 'wood', 2 if y < ft + 4 else 3)
    lattice(tc, 38, ft + 6, 20, 14, pattern='round')
    for (tx, ty) in ((18, fb - 9), (66, fb - 9)):                          # 찻상 + 의자(안쪽, 한 단 어둡다)
        for y in range(ty, ty + 3):
            for x in range(tx, tx + 12): tc.px(x, y, 'wood', 4 if y == ty else 2)
        for x in (tx + 1, tx + 10):
            for y in range(ty + 3, fb): tc.px(x, y, 'wood', 2)
        tc.px(tx + 4, ty - 1, 'jade', 5); tc.px(tx + 5, ty - 1, 'jade', 4); tc.px(tx + 5, ty - 2, 'jade', 5)
        tc.px(tx + 8, ty - 1, 'washi', 5)
    # 낙양(처마 밑 그물 살 띠)
    for y in range(ft, ft + 5):
        for x in range(8, W - 8):
            if y == ft or y == ft + 4 or (x + y) % 4 == 0: tc.px(x, y, 'shu', 4 if y == ft else 3)
    # 기둥 넷 + 낮은 난간(가운데는 비운다)
    for px_ in (8, 30, 63, W - 11): red_post(tc, px_, ft, fb, w=3)
    railing(tc, 10, 30, fb - 7, h=6, step=10); railing(tc, 66, W - 10, fb - 7, h=6, step=10)
    # 널 마루 툇단
    for y in range(fb, H):
        for x in range(2, W - 2):
            k = 5 if y == fb else (4 if y < fb + 3 else 2)
            if (x % 6 == 5) and y > fb: k = 2
            tc.px(x, y, 'wood', k)
    hang_lanterns(tc, 18, W - 18, ft + 5, 2, h=8, w=6)
    return tc.fin(.6)


# ================================================================ ③ 흰 벽 민가(마두벽)
def horse_head(tc, x0, w, y_eave, y_top, steps=3, flip_=False):
    """마두벽(계단식 박공 벽): 지붕 양 끝을 따라 솟은 흰 벽을 3/4 로 본다 — 벽 윗면 기와 갓(위에서 본 검은 띠)과
    단마다 앞을 보는 흰 턱(회벽 5px)이 번갈아 쌓여, 처마선(y_eave)에서 용마루 위(y_top)까지 계단 기둥처럼 오른다.
    단 앞 바깥 모서리에 기와 끝이 위로 휜 「말머리」(2px). x0 = 기둥 왼쪽, w = 벽 두께(px)."""
    span = y_eave - y_top
    seg = span / float(steps)
    for s in range(steps):
        yb = int(round(y_eave - s * seg)); yt = int(round(y_eave - (s + 1) * seg))
        rh = min(6, max(4, (yb - yt) // 2))
        for y in range(yb - rh, yb):                                        # 앞을 보는 흰 턱
            for x in range(x0, x0 + w):
                k = 5 if (x < x0 + w - 1) != flip_ else 4
                tc.px(x, y, 'plaster', k)
        for y in range(yt, yb - rh):                                        # 위에서 본 기와 갓(가운데 마루 빛 줄)
            for x in range(x0 - 1, x0 + w + 1):
                lx = x - x0
                k = 4 if lx == w // 2 else (3 if 0 <= lx < w else 2)
                if y == yt: k = 5
                if (y - yt) % 3 == 2 and 0 <= lx < w and lx != w // 2: k -= 1
                tc.px(x, y, 'kawara', k)
        hx_ = x0 - 2 if not flip_ else x0 + w + 1                             # 말머리(바깥으로 휜 기와 끝)
        tc.px(hx_, yb - rh - 1, 'kawara', 5); tc.px(hx_, yb - rh - 2, 'kawara', 6)
        tc.px(hx_ + (1 if not flip_ else -1), yb - rh - 1, 'kawara', 4)


def house_white(w=5, storeys=1, seed=3, door=None, gable_steps=2, canal=False):
    """흰 벽 민가 w칸: 흰 회벽(아래 회청 벽돌 띠), 검은 기와 맞배 지붕(처마 끝 막새 줄), 양 끝 마두벽 계단 박공,
    짙은 나무 두 짝 문(돌 문틀) + 작은 격자창(벽 칸 가운데). storeys=2 이면 2층에 나무 창 줄 + 작은 차양 기와.
    canal = 물가 집(문 대신 창, 아래 기단 돌이 한 줄 더 — 운하 둑에 바로 붙인다)."""
    W = w * 16
    wall_h = 30 if storeys == 1 else 54
    roof_h = 40
    H = wall_h + roof_h + 12 + (4 if canal else 0)
    H = (H + 15) // 16 * 16
    tc = TC(W, H, seed)
    wb = H - (8 if canal else 3); wt = wb - wall_h
    r_top = wt + 8 - roof_h
    jroof(tc, 4, r_top, W - 8, roof_h, kind='gable', yb=.40, sori=2, flare=2, ridge=True, oni=False)
    # 용마루 양 끝 작은 꼬리(치미 일반형)
    ry = r_top + int(round(roof_h * .40)) - 1
    for (ex, d) in ((5, -1), (W - 6, 1)):
        tc.px(ex, ry - 2, 'kawara', 5); tc.px(ex + d, ry - 3, 'kawara', 5); tc.px(ex + d * 2, ry - 4, 'kawara', 4)
    plaster_wall(tc, 2, wt, W - 2, wb, seed=seed + 1, posts=0, beam=False, base_k=5)
    for y in range(wb - 6, wb):                                              # 아래 회청 벽돌 띠(습기 막이)
        for x in range(2, W - 2):
            k = 4 if (y - (wb - 6)) % 3 else 1
            if (y - (wb - 6)) % 3 and ((x + (y // 3) * 4) % 8 == 0): k = 1
            if x >= W - 4: k -= 1
            tc.px(x, y, 'qing', clamp(k, 1, 6))
    for y in range(wb - wall_h // 2 - 20, wb - 6):                         # 빗물 얼룩 줄(드문 세로 회색)
        for x in range(2, W - 2):
            if _hash(x // 2, 0, seed + 9) > .93 and _hash(x, y // 3, seed + 10) > .4: tc.shift(x, y, -1)
    eave_shadow(tc, 2, W - 2, wt, 3)
    if gable_steps:
        y_top = r_top - 3
        horse_head(tc, 1, 5, wt + 4, y_top, steps=gable_steps + 1)
        horse_head(tc, W - 6, 5, wt + 4, y_top, steps=gable_steps + 1, flip_=True)
    if door is None: door = w // 2
    if not canal:
        dx0 = door * 16 - 4
        for y in range(wb - 23, wb):                                         # 돌 문틀
            for x in range(dx0 - 2, dx0 + 26):
                if dx0 <= x < dx0 + 24 and y >= wb - 21: continue
                tc.px(x, y, 'gran', 5 if (x < dx0 or y == wb - 23) else 4)
        double_door(tc, dx0, wb - 21, 24, 19, open_=(seed % 2 == 1), mat='kuro')
    wins = [i for i in range(w) if canal or abs(i - door) > 1 or (w <= 3 and i != door)]
    for i in wins:
        lattice(tc, i * 16 + 3, wb - 24 if storeys == 1 else wb - 22, 10, 9)
    if storeys == 2:
        y2 = wt + 6
        for i in range(w):
            lattice(tc, i * 16 + 2, y2, 12, 10, pattern='ice')
        for x in range(0, W):                                                # 1·2층 사이 작은 기와 차양
            u = abs(x + .5 - W / 2) / (W / 2)
            lift = int(round(2 * u ** 2.4))
            tc.px(x, y2 + 13 - lift, 'kawara', 5); tc.px(x, y2 + 14 - lift, 'kawara', 3); tc.px(x, y2 + 15 - lift, 'kawara', 2)
            tc.px(x, y2 + 16, 'plaster', 2)
    if canal:
        stone_base(tc, 0, wb, W, H, seed=seed + 4)
    tc.grain(.03, mats=('plaster',))
    return tc.fin(.6)


# ================================================================ ④ 아치 돌다리(동서로 건너는 다리, 남북 운하 위)
def arch_bridge(w=6, seed=4):
    """앵커 ③: 아치 돌다리 w칸 x 5칸(동서로 건넌다, 남북 운하 위). 가운데가 솟은 무지개다리:
    위 = 북쪽 난간(갓돌 윗면 + 앞을 보는 난간 판) → 다리 윗면 디딤 돌계단(가로 단 줄, 가운데로 오를수록 밝다) →
    남쪽 난간(난간 판 + 기둥 머리 봉오리, 앞면) → 남쪽 앞면 장대석 + 반원 아치(쐐기돌 테, 속 어둠 + 물에 비친 결).
    다리 윤곽(난간 위 선)이 가운데로 활처럼 솟는다. 양 끝 1칸은 둑 위. 걷기 = 2·3번째 줄(디딤, 2칸 폭 길과 잇는다), 1번째 줄(북 난간)·4·5번째 줄(남 난간·앞면) 막힘."""
    W, H = w * 16, 80
    tc = TC(W, H, seed)
    HP = 9
    hump = lambda x: int(round(HP * math.sin(math.pi * min(1, max(0, (x - 3) / (W - 6.0)))) ** .8))
    NR, DK, SR, FC = 14, 16, 48, 56                 # 북 난간 윗선 · 디딤 시작(1줄) · 남 난간 시작(3줄) · 앞면 시작 (솟음 0 기준)
    cx = W / 2.0; ar = min(21, W * .24); ay = H
    for x in range(W):
        hp = hump(x)
        # 남쪽 앞면 + 아치
        for y in range(FC - hp, H):
            dx = (x + .5 - cx) / ar; dy = (ay - (y + .5)) / ar
            r2 = dx * dx + dy * dy
            if r2 < 1:
                k = 1 if dy > .5 else 2
                m = 'dark' if dy > .35 else 'mizu'
                if m == 'mizu' and (x * 3 + y) % 7 == 0: k = 3
                tc.px(x, y, m, k); continue
            if r2 < 1.38:
                ang = math.atan2(dy, dx); vo = int((ang + 3.2) / .24)
                k = 5 if vo % 2 == 0 else 4
                if r2 > 1.3: k = 2
                if r2 < 1.05: k = 3
                tc.px(x, y, 'gran', k); continue
            row = (y - (FC - hp)) // 6; ly = (y - (FC - hp)) % 6
            off = int(_hash(row, 0, seed) * 22); lx = (x + off) % 22
            k = 4 if _hash((x + off) // 22, row, seed + 1) > .35 else 3
            if ly == 5 or lx == 21: k = 1
            elif ly == 0: k = 5 if row == 0 else 4
            if x >= W - 3: k -= 1
            if _hash(x, y, seed + 2) < .05: k -= 1
            m = 'koke' if (y > H - 9 and _hash(x // 2, y, seed + 3) < .35) else 'gran'
            tc.px(x, y, m, clamp(k, 1, 6))
        # 남쪽 난간(앞면 판): 위 갓 2px 빛, 판 가운데 오목 그늘, 기둥 사이
        for y in range(SR - hp, FC - hp):
            ly = y - (SR - hp)
            px_ = x % 16
            if ly < 2: k = 6 if ly == 0 else 5
            elif px_ in (0, 1, 2): k = 4 if px_ < 2 else 2
            elif 4 <= px_ <= 13 and 3 <= ly <= 5: k = 3
            else: k = 4
            if ly == FC - SR - 1: k = 2
            tc.px(x, y, 'gran', k)
        # 디딤 돌계단(가로 단 줄 5px, 가운데로 오를수록 밝다)
        for y in range(DK - hp, SR - hp):
            ly = (y - (DK - hp)) % 5
            u = 1 - abs(x + .5 - cx) / cx
            k = (4 if u < .45 else 5) if ly else 3
            if ly == 4: k = 3
            if _hash(x // 9, (y - (DK - hp)) // 5, seed + 5) < .18: k -= 1
            tc.px(x, y, 'gran', clamp(k, 1, 6))
        # 북쪽 난간: 갓돌 윗면(밝음) + 앞 판(디딤 위로 보이는 쪽, 그늘)
        for y in range(NR - hp - 4, DK - hp):
            ly = y - (NR - hp - 4)
            k = 6 if ly == 0 else (5 if ly < 3 else (3 if x % 16 > 2 else 4))
            if y == DK - hp - 1: k = 2
            tc.px(x, y, 'gran', k)
    for px_ in range(0, W, 16):                                                           # 기둥 머리 봉오리(남·북)
        q = min(W - 3, px_ + (0 if px_ == 0 else 0))
        for base in (NR - hump(q + 1) - 4, SR - hump(q + 1)):
            for y in range(base - 3, base + 1):
                tc.px(q, y, 'gran', 6); tc.px(q + 1, y, 'gran', 5); tc.px(q + 2, y, 'gran', 3)
            tc.px(q + 1, base - 4, 'gran', 6)
    q = W - 3
    for base in (NR - hump(q + 1) - 4, SR - hump(q + 1)):
        for y in range(base - 3, base + 1): tc.px(q, y, 'gran', 5); tc.px(q + 1, y, 'gran', 4); tc.px(q + 2, y, 'gran', 2)
        tc.px(q + 1, base - 4, 'gran', 5)
    tc.grain(.02, mats=('gran',))
    return tc.fin(.6)


def stone_bridge_ns(rows=6, w=3, seed=5):
    """남북 돌다리(동서 운하를 건넌다) w칸 x rows칸: 판석 디딤판(가로 결, 가운데가 솟아 밝다) + 양쪽 돌 난간(갓돌 띠 + 기둥 머리 봉오리, 4px),
    양 끝은 둑 위 땅에 그대로 닿고 남쪽 끝 3px 턱 그늘. 운하 폭 + 둑 2줄(양쪽 1줄씩)을 덮게 놓는다. 걷기 = 칸 전부."""
    W, H = w * 16, rows * 16
    tc = TC(W, H, seed)
    mid = H / 2.0
    for y in range(H):
        hl = 1 if abs(y + .5 - mid) < H * .3 else 0
        for x in range(4, W - 4):
            ly = y % 6
            k = (4 + hl) if ly else 5 + hl
            if ly == 5: k = 2
            if (x + (y // 6) * 7) % 15 == 0: k = 2
            if _hash(x // 7, y // 6, seed) < .2: k -= 1
            if x >= W - 6: k -= 1
            if y >= H - 3: k = 3 if y == H - 3 else 2
            tc.px(x, y, 'gran', clamp(k, 1, 6))
    for x0 in (0, W - 4):
        for y in range(H):
            for i in range(4):
                k = (5, 5, 4, 2)[i] if x0 == 0 else (4, 4, 3, 1)[i]
                if y % 16 in (0, 1, 2): k = (6, 6, 5, 3)[i] if x0 == 0 else (5, 5, 4, 2)[i]
                if y >= H - 2: k = 2
                tc.px(x0 + i, y, 'gran', k)
    return tc.fin(.6)


def plank_bridge_ew(w=4, seed=6):
    """작은 널다리(동서, 좁은 물길 위) w x 2칸: 통나무 받침 둘 위에 가로 널(들쭉날쭉 끝), 남쪽 앞면 그늘, 한쪽에 대나무 손잡이 줄."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    for y in range(8, 24):
        for x in range(W):
            lx = x % 6; k = 4 + (1 if _hash(x // 6, 0, seed) > .6 else 0) - (1 if _hash(x // 6, 1, seed) < .2 else 0)
            if lx == 5: k = 2
            top = 8 + int(_hash(x // 6, 2, seed) * 2)
            if y < top: continue
            if y == top: k += 1
            if y >= 22: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for y in range(24, 30):
        for x in range(W):
            if x < 8 or x >= W - 8: tc.px(x, y, 'wood', 3 if y < 26 else 2)
            elif y < 26: tc.px(x, y, 'dark', 2)
    for x in range(W):                                                        # 대나무 손잡이 줄(북쪽)
        tc.px(x, 5, 'take', 5); tc.px(x, 6, 'take', 3)
        if x % 16 == 2:
            for y in range(4, 12): tc.px(x, y, 'take', 4); tc.px(x + 1, y, 'take', 2)
    return tc.fin(.6)


# ================================================================ ⑤ 패루(마을 문)
def paifang(seed=7):
    """앵커 ④: 패루(마을 들머리 문) 6x6칸: 주칠 기둥 넷(가운데 둘 굵다) + 기둥 앞뒤 돌 고임(둥근 북 모양 받침돌),
    가로 들보 두 단(주칠 + 금 점 무늬) 사이 글자 없는 편액, 들보 위 공포 띠(초록·금 점 짜임) + 기와 지붕 셋(가운데 높고 크다, 처마 끝 들림).
    가운데 2칸 + 양옆 1칸씩 지나간다. 발자국: 기둥 밑 칸만 막힘."""
    W, H = 96, 96
    tc = TC(W, H, seed)
    gb = H - 1
    posts = ((4, 4), (26, 5), (65, 5), (88, 4))
    def bracket(x0, x1, y):
        for yy in range(y, y + 5):
            for x in range(x0, x1):
                lx = (x - x0) % 6
                if yy == y + 4: k, m = 1, 'dark'
                elif lx in (0, 1) and yy < y + 3: m, k = 'jade', 4 if lx == 0 else 3
                elif yy == y + 3: m, k = 'shu', 3
                elif lx == 3 and yy == y + 1: m, k = 'gold', 5
                else: m, k = 'jade', 2
                tc.px(x, yy, m, k)
    bracket(4, 30, 40); bracket(66, 92, 40); bracket(24, 72, 24)
    jroof(tc, 0, 26, 32, 16, kind='hip', yb=.36, e=9, sori=4, flare=3, oni=False)
    jroof(tc, 64, 26, 32, 16, kind='hip', yb=.36, e=9, sori=4, flare=3, oni=False)
    jroof(tc, 18, 4, 60, 22, kind='hip', yb=.38, e=14, sori=6, flare=4, oni=False)
    ry = 4 + int(22 * .38) - 1
    for (ex, d) in ((32, -1), (63, 1)):                                    # 용마루 끝 작은 꼬리
        tc.px(ex, ry - 2, 'kawara', 6); tc.px(ex + d, ry - 3, 'kawara', 5); tc.px(ex + d * 2, ry - 4, 'kawara', 4)
    for (y0, y1, x0, x1) in ((45, 50, 3, 93), (29, 34, 22, 74), (56, 61, 24, 72)):
        for y in range(y0, y1):
            for x in range(x0, x1):
                k = 5 if y == y0 else (4 if y < y1 - 1 else 1)
                tc.px(x, y, 'shu', k)
        for x in range(x0 + 3, x1 - 3, 5): tc.px(x, y0 + 2, 'gold', 5)
    plaque(tc, 36, 34, 24, 10)
    for i, (px_, w) in enumerate(posts):
        top = 29 if i in (1, 2) else 45
        red_post(tc, px_, top, gb - 7, w=w, cap=False)
        for (bx, by) in ((px_ - 4, gb - 9), ):                               # 받침 + 앞 돌 고임(둥근 북 돌)
            for y in range(gb - 7, gb + 1):
                for x in range(px_ - 2, px_ + w + 2):
                    k = 5 if y == gb - 7 else (4 if x < px_ + w else 3)
                    if y == gb: k = 2
                    tc.px(x, y, 'gran', k)
        if i in (1, 2):                                                      # 기둥 앞 둥근 북 돌(포고석) — 기둥과 같은 x, 앞(남)에
            cxd = px_ + w / 2.0
            for y in range(gb - 12, gb + 1):
                for x in range(int(cxd - 5), int(cxd + 5)):
                    dd = ((x + .5 - cxd) / 5.0) ** 2 + ((y + .5 - (gb - 7)) / 5.5) ** 2
                    if dd > 1 and y < gb - 2: continue
                    k = 6 if (x < cxd - 1 and y < gb - 8) else (5 if x < cxd + 1 else 3)
                    if y >= gb - 1: k = 2
                    if abs(dd - .55) < .08: k -= 1                            # 북 테 줄
                    tc.px(x, y, 'gran', k)
    return tc.fin(.6)


# ================================================================ ⑥ 부두·물가 돌계단
def dock(w=4, rows=2, seed=8, face=True):
    """나무 부두(잔교) w x rows칸 + 남쪽 앞면: 남북 널(ground-dock 과 같은 결), 가장자리 테 각목, 남쪽 앞면 말뚝 셋(물에 잠긴 밑 어둠), 계선주 둘.
    물 칸 위에 놓으면 그 칸이 걷기가 된다. face=False = 남쪽 둑에서 북으로 뻗은 잔교(앞면이 북쪽이라 안 보인다 — 말뚝 없이 널만)."""
    W, H = w * 16, rows * 16 + (10 if face else 0)
    tc = TC(W, H, seed)
    for y in range(rows * 16):
        for x in range(W):
            col = x // 6; lx = x % 6
            k = 4 + (1 if _hash(col, y // 20, seed) > .65 else 0) - (1 if _hash(col, y // 20, seed + 1) < .2 else 0)
            if lx == 0: k += 1
            if lx == 5: k = 1
            if x < 2 or x >= W - 2: k = 5 if x < 2 else 2
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for x in range(W if face else 0):                                         # 남쪽 테 각목 + 앞면
        tc.px(x, rows * 16, 'wood', 5); tc.px(x, rows * 16 + 1, 'wood', 3); tc.px(x, rows * 16 + 2, 'wood', 2)
    for px_ in ([3] + [W // 2 - 2] + [W - 7]) if face else []:
        for y in range(rows * 16 + 3, H):
            for i in range(4): tc.px(px_ + i, y, 'wood' if y < H - 3 else 'mizu', ((4, 3, 2, 1)[i]) if y < H - 3 else 1)
    for (bx, by) in ((4, 4), (W - 9, 4)):                                     # 계선주(쇠 머리 나무 말뚝)
        for y in range(by, by + 7):
            for i in range(5): tc.px(bx + i, y, 'wood', (5, 5, 4, 3, 2)[i])
        tc.ell(bx + 2.5, by, 2.8, 1.6, 'wood', lambda X, Y: 6 if X < bx + 2 else 4)
    return tc.fin(.6)


def canal_steps(w=3, seed=9):
    """물가 돌계단(빨래·배 타는 곳) w x 2칸: 둑 갓돌 아래로 물에 내려가는 화강암 계단 셋(윗면 빛 + 챌면 그늘, 맨 아래 단은 물에 젖어 어둡다),
    양옆 막돌 볼. 운하 북쪽 둑 칸 위에 놓는다(윗줄 = 둑, 아랫줄 = 물가). 걷기 = 윗줄 전부·아랫줄 가운데."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            if x < 4 or x >= W - 4:
                k = 4 if (x + y // 5) % 7 else 2
                if y % 5 == 4: k = 1
                if x >= W - 4: k -= 1
                tc.px(x, y, 'gran', clamp(k, 1, 6)); continue
            j = y // 8; ly = y % 8
            if j == 0 and ly < 3: k = 5
            elif ly < 5: k = 5 if ly == 0 else 4
            else: k = 2 if ly < 7 else 1
            if j >= 3: k = max(1, k - 1)
            if x >= W - 6 and k > 2: k -= 1
            m = 'gran'
            if j == 3 and ly >= 5: m, k = 'mizu', 2
            tc.px(x, y, m, k)
    for x in range(4, W - 4):                                                # 젖은 맨 아래 단 이끼
        if _hash(x, 0, seed + 3) < .35: tc.px(x, 26, 'koke', 3)
    return tc.fin(.6)


if __name__ == '__main__':
    import os
    import sys
    ims = [inn(), teahouse(), house_white(4, 1, 3), house_white(5, 2, 4), house_white(6, 2, 5, canal=True), house_white(3, 1, 6, gable_steps=1)]
    if 'b2' in sys.argv: ims = [arch_bridge(), stone_bridge_ns(), plank_bridge_ew(), paifang(), dock(), canal_steps()]
    Wt = sum(i.width for i in ims) + 10 * len(ims) + 10; Ht = max(i.height for i in ims) + 20
    o = Image.new('RGBA', (Wt, Ht), (92, 150, 70, 255)); x = 10
    for i in ims: o.alpha_composite(i, (x, Ht - 10 - i.height)); x += i.width + 10
    o.resize((o.width * 2, o.height * 2), Image.NEAREST).save(os.path.join(HERE, '_qa', 'build%s.png' % ('2' if 'b2' in sys.argv else '1'))); print('ok')
