# 증기 도시 소품: 가스등·거리 시계·증기 배출구·관·석탄 마차·석탄 더미·통·상자·벤치·광고 기둥 등.
# 3/4 시점(윗면 + 앞면), 빛 왼쪽 위, 7단 램프, pz.fin 윤곽. 키 큰 것은 밑동 줄만 막힘(SPEC §2).
from sc_base import *
from sc_base import _hash
import dprops as D
import fr_props as FP


def glow(o, cx, cy, r=8, a=60):
    g = D.glow(o.width, SIGNAL['amber'][5], a, cx, cy, r)
    o2 = Image.new('RGBA', o.size, (0, 0, 0, 0)); o2.alpha_composite(g); o2.alpha_composite(o); return o2


# ---------------------------------------------------------------- 가스등
def lantern(tc, cx, y0, w=8, h=8):
    """가스등 머리: 무쇠 갓(위 뾰족 + 놋쇠 꼭지) · 호박빛 유리(왼위 밝음) · 무쇠 살 · 아래 받침 접시."""
    x0 = cx - w // 2
    for j in range(3):
        tc.hline(x0 + 2 - j, x0 + w - 2 + j, y0 + j, 'steel', 4 if j == 0 else (3 if j == 1 else 2))
    tc.px(cx - 1, y0 - 1, 'brass', 6); tc.px(cx, y0 - 1, 'brass', 3)
    for y in range(y0 + 3, y0 + 3 + h):
        for x in range(x0, x0 + w):
            k = 6 if (x < x0 + 3 and y < y0 + 6) else (5 if x < x0 + w // 2 + 1 else 4)
            tc.px(x, y, 'amber', k)
        tc.px(x0, y, 'steel', 3); tc.px(x0 + w - 1, y, 'steel', 1); tc.px(cx, y, 'steel', 2)
    tc.hline(x0 - 1, x0 + w + 1, y0 + 3 + h, 'brass', 5); tc.hline(x0, x0 + w, y0 + 4 + h, 'steel', 1)


def gas_lamp(seed=0):
    """가스등 1x3칸(16x48): 검은 무쇠 기둥(가운데 테 둘, 사다리 걸이 가로대) + 받침 + 놋쇠 꼭지 등. 밑동만 막힘, 위 걷기+가림."""
    tc = TC(16, 48, seed)
    for y in range(14, 44): tc.px(7, y, 'steel', 4); tc.px(8, y, 'steel', 2)
    for yy in (24, 34): tc.hline(6, 10, yy, 'steel', 4); tc.hline(6, 10, yy + 1, 'steel', 1)
    tc.hline(3, 13, 16, 'steel', 3); tc.px(3, 15, 'brass', 5); tc.px(12, 15, 'brass', 3)      # 사다리 걸이
    for y in range(40, 47):
        for x in range(4, 12): tc.px(x, y, 'steel', 4 if y == 40 else (3 if x < 8 else 1))
    tc.hline(4, 12, 47, 'steel', 0)
    lantern(tc, 8, 3, 8, 8)
    im = tc.fin(.65, shadow=(8, 46, 4, 1.4, 60))
    return glow(im, 8, 9, 8, 60)


def gas_lamp_double(seed=0):
    """쌍 가스등 2x3칸(32x48): 굵은 기둥 + 휜 가로 팔 양쪽 끝에 등 둘(광장·대로 모퉁이). 밑동 가운데만 막힘."""
    tc = TC(32, 48, seed)
    for y in range(12, 44): tc.px(15, y, 'steel', 4); tc.px(16, y, 'steel', 3); tc.px(17, y, 'steel', 1)
    for y in range(38, 47):
        for x in range(11, 21): tc.px(x, y, 'steel', 4 if y == 38 else (3 if x < 16 else 1))
    tc.hline(11, 21, 47, 'steel', 0)
    for x in range(6, 26):
        y = 12 - int(round(math.sin((x - 6) / 19 * math.pi) * 3))
        tc.px(x, y, 'steel', 4); tc.px(x, y + 1, 'steel', 1)
    tc.ell(16, 9, 2, 2, 'brass', lambda x, y: 6 if x < 16 else 3)
    for cx in (6, 26):
        tc.vline(cx, 12, 15, 'steel', 3)
        lantern(tc, cx, 14, 7, 7)
    im = tc.fin(.65, shadow=(16, 46, 5, 1.6, 60))
    im = glow(im, 6, 19, 7, 55); return glow(im, 26, 19, 7, 55)


def street_clock(seed=0):
    """거리 시계 1x3칸: 무쇠 기둥 + 위 놋쇠 둥근 시계(양면 중 앞면, 숫자 없음, 바늘 둘) + 갓. 밑동만 막힘."""
    tc = TC(16, 48, seed)
    for y in range(18, 44): tc.px(7, y, 'steel', 4); tc.px(8, y, 'steel', 2)
    for yy in (22, 30): tc.hline(6, 10, yy, 'brass', 5); tc.hline(6, 10, yy + 1, 'brass', 2)
    for y in range(40, 47):
        for x in range(4, 12): tc.px(x, y, 'steel', 4 if y == 40 else (3 if x < 8 else 1))
    tc.hline(4, 12, 47, 'steel', 0)
    for y in range(4, 18):
        for x in range(1, 15):
            d = math.hypot(x + .5 - 8, y + .5 - 11)
            if d <= 4.8: tc.px(x, y, 'stone', 6 if (x < 7 and y < 10) else 5)
            elif d <= 6.4: tc.px(x, y, 'brass', 6 if (x < 7 and y < 10) else (4 if x < 9 else 2))
    tc.px(7, 8, 'steel', 1); tc.px(7, 9, 'steel', 1); tc.px(7, 10, 'steel', 1); tc.px(8, 10, 'steel', 1); tc.px(9, 10, 'steel', 1)
    for (x, y) in ((7, 6), (3, 10), (12, 10), (7, 14)): tc.px(x, y, 'steel', 2)
    tc.hline(5, 11, 3, 'steel', 3); tc.px(7, 2, 'brass', 6); tc.px(8, 2, 'brass', 3)
    return tc.fin(.65, shadow=(8, 46, 4, 1.4, 60))


# ---------------------------------------------------------------- 증기 배출구·관
def vent_grate(tc, x0, y0, w=12, h=6):
    """바닥 배출구 창살(위에서 본 놋쇠 테 + 어두운 살 사이)."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = y in (y0, y0 + h - 1) or x in (x0, x0 + w - 1)
            if edge: tc.px(x, y, 'brass', 5 if (y == y0 or x == x0) else 2)
            else: tc.px(x, y, 'dark', 1 if (x - x0) % 2 else 2)


def steam_vent(seed=0):
    """증기 배출구 1x2칸: 땅에 박힌 놋쇠 창살 상자(낮은 몸통) + 위로 솟는 흰 김. 몸통 칸 막힘(뜨겁다), 김 칸 걷기+가림."""
    o = Image.new('RGBA', (16, 32), (0, 0, 0, 0))
    tc = TC(16, 32, seed)
    for y in range(22, 31):
        for x in range(1, 15):
            if y < 25: tc.px(x, y, 'steel', 5 if y == 22 else 4)
            else: tc.px(x, y, 'steel', 3 if x < 8 else 2)
    vent_grate(tc, 2, 22, 12, 3)
    for x in range(3, 13, 3): tc.px(x, 27, 'brass', 5)
    tc.hline(1, 15, 31, 'steel', 0)
    o.alpha_composite(tc.fin(.6))
    o.alpha_composite(steam_cloud(16, 22, seed + 3, 200), (0, 0))
    return o


def vent_floor(seed=0):
    """바닥 증기 창살 1x1(걷기, 땅 장식): 자갈에 박힌 놋쇠 테 창살 + 새어 나오는 김 한 줌."""
    tc = TC(16, 16, seed)
    vent_grate(tc, 2, 5, 12, 8)
    for x in range(2, 14): tc.px(x, 13, 'steel', 1)
    im = tc.fin(.5)
    im.alpha_composite(steam_cloud(10, 7, seed + 1, 150), (4, 0))
    return im


def manhole_brass(seed=0):
    """놋쇠 테 맨홀 1x1(걷기, 땅 장식): 무쇠 뚜껑 + 동심 홈 + 놋쇠 테(왼위 빛). 글자 없음."""
    tc = TC(16, 16, seed)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + .5 - 8, (y + .5 - 8) * 1.25)
            if d <= 5.2: tc.px(x, y, 'steel', 3 if int(d) % 2 else 2)
            elif d <= 6.6: tc.px(x, y, 'brass', 5 if (x < 8 and y < 8) else 3)
            elif d <= 7.4: tc.px(x, y, 'steel', 1)
    tc.px(6, 6, 'steel', 4)
    return tc.fin(.4)


def drain_grate(seed=0):
    """도랑 창살 1x1(걷기): 연석 옆 무쇠 가로 창살."""
    tc = TC(16, 16, seed)
    for y in range(4, 12):
        for x in range(3, 13):
            if y in (4, 11) or x in (3, 12): tc.px(x, y, 'steel', 4 if (y == 4 or x == 3) else 1)
            else: tc.px(x, y, 'dark' if y % 2 else 'steel', 1 if y % 2 else 3)
    return tc.fin(.4)


def standpipe(seed=0):
    """증기 세움관 1x2칸: 땅에서 솟은 구리 관 + 놋쇠 밸브 바퀴 + 압력계 + 꺾여 다시 땅으로. 밑동만 막힘."""
    tc = TC(16, 32, seed)
    pipe_v(tc, 5, 8, 30, 4, 'rust', step=10)
    pipe_v(tc, 12, 14, 30, 4, 'rust', step=10)
    pipe_h(tc, 5, 13, 9, 4, 'rust', flange=False)
    for (x, y) in ((3, 7), (10, 7)):
        for i in range(4): tc.px(x + i, y, 'rust', 5); tc.px(x + i, y + 4, 'rust', 2)
    valve_wheel(tc, 9, 6, 4, 2, 'brass'); tc.vline(9, 7, 9, 'brass', 3)
    gauge(tc, 5, 18, 2, seed)
    tc.hline(1, 15, 30, 'gst', 4); tc.hline(1, 15, 31, 'gst', 1)
    return tc.fin(.6, shadow=(8, 30, 6, 1.5, 55))


def pipe_hump(seed=0):
    """땅을 넘는 관 2x1칸: 자갈에서 올라와 낮게 넘어가 다시 땅으로 들어가는 놋쇠 관(이음 테·받침 쇠). 칸 막힘(낮은 걸림)."""
    tc = TC(32, 16, seed)
    pipe_h(tc, 6, 26, 7, 4, 'brass', step=10)
    for x in (4, 26):
        pipe_v(tc, x + 1, 7, 15, 4, 'brass', flange=False)
        tc.hline(x - 2, x + 5, 15, 'gst', 2)
    for x in (12, 20): tc.vline(x, 9, 15, 'steel', 3); tc.vline(x + 1, 9, 15, 'steel', 1)
    valve_wheel(tc, 16, 3, 4, 2, 'brass'); tc.vline(16, 4, 5, 'brass', 3)
    for x in (4, 26): tc.ell(x + 1, 15, 3.5, 1.2, 'dark', 1)               # 관이 들어가는 땅 구멍
    return tc.fin(.6, shadow=(16, 15, 12, 1.2, 50))


def pipe_arch(w=6, seed=0):
    """길 위를 건너는 관 다리 w x 3칸: 양쪽 검은 무쇠 기둥(가새) + 위 굵은 구리 관 + 가는 놋쇠 관 + 가운데 밸브와 김 한 줌.
    기둥 밑동 칸만 막힘 — 관 아래로 지나간다(위 줄 걷기+가림)."""
    W = w * 16; H = 48
    tc = TC(W, H, seed)
    for lx in (3, W - 9):
        for y in range(10, 46):
            tc.px(lx, y, 'steel', 4); tc.px(lx + 1, y, 'steel', 3); tc.px(lx + 2, y, 'steel', 3); tc.px(lx + 3, y, 'steel', 1)
        for j in range(0, 30, 8): tc.line(lx, 14 + j, lx + 3, 18 + j, 'steel', 2)
        for x in range(lx - 2, lx + 6): tc.px(x, 46, 'gst', 4); tc.px(x, 47, 'gst', 1)
    pipe_h(tc, 0, W, 9, 8, 'rust', step=24)
    pipe_h(tc, 0, W, 17, 4, 'brass', step=16)
    valve_wheel(tc, W // 2, 3, 4, 2, 'brass'); tc.vline(W // 2, 4, 6, 'brass', 3)
    im = tc.fin(.6)
    im.alpha_composite(steam_cloud(12, 10, seed + 4, 160), (W // 2 + 6, 0))
    return im


# ---------------------------------------------------------------- 석탄
def coal_mound(tc, x0, y0, w, h, seed=0):
    """석탄 산: 3x3 덩이 낱알(윗왼 빛 면 톤 4~5, 오른아래 그늘 1~2, 드문 반짝 6)을 쌓은 무더기 — 매끈한 검은 돔이 아니다.
    산 위쪽은 빛을 더 받고(+1) 아래 끝은 그늘(−1)."""
    cx = x0 + w / 2.0
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x + .5 - cx) / (w / 2.0); v = (y + .5 - y0) / h
            top = 1 - math.sqrt(max(0, 1 - u * u))
            if v < top * .9: continue
            bx, by = (x + (y // 3) % 2) // 3, y // 3; lx, ly = (x + (y // 3) % 2) % 3, y % 3
            h0 = hash2(bx, by, seed + 3)
            k = 3 if h0 > .4 else 2
            if (lx, ly) == (0, 0): k += 2
            elif lx == 0 or ly == 0: k += 1
            elif (lx, ly) == (2, 2): k -= 1
            if h0 > .9 and (lx, ly) == (0, 0): k = 6
            if u < -.15 and v < .55: k += 1
            if v > .82: k -= 1
            tc.px(x, y, 'coal', ck(k))


def coal_cart(seed=0, flip=False):
    """석탄 마차 3x2칸(48x32): 나무 짐칸(널 결 + 무쇠 테·모서리 놋쇠) 위 석탄 산, 무쇠 살 바퀴 둘(테 + 살 여섯 + 놋쇠 굴대),
    앞으로 뻗은 끌채 둘(말·사람 없음). 짐칸·바퀴 줄(아래 1줄) 막힘."""
    W, H = 48, 32
    tc = TC(W, H, seed)
    coal_mound(tc, 6, 2, 34, 12, seed)
    for y in range(12, 24):                                               # 짐칸 앞면
        for x in range(4, 42):
            k = 4 if (y - 12) % 4 == 0 else (3 if x < 30 else 2)
            if (x - 4) % 12 == 11: k = 1
            tc.px(x, y, 'wood', k)
    tc.hline(3, 43, 11, 'steel', 4); tc.hline(3, 43, 12, 'steel', 2); tc.hline(4, 42, 23, 'steel', 1)
    for x in (4, 41): tc.vline(x, 12, 24, 'brass', 5 if x == 4 else 2)
    for (cx, cy) in ((13, 25), (34, 25)):                                 # 바퀴
        for t in range(0, 360, 8):
            a = math.radians(t)
            for rr in (5.6, 6.4):
                tc.px(round(cx - .5 + math.cos(a) * rr), round(cy - .5 + math.sin(a) * rr), 'steel', 4 if (t > 150 and t < 300) else 2)
        for i in range(6):
            a = i * math.pi / 3
            for rr in np.linspace(1, 5, 5): tc.px(round(cx - .5 + math.cos(a) * rr), round(cy - .5 + math.sin(a) * rr), 'wood', 3)
        tc.ell(cx, cy, 1.5, 1.5, 'brass', 5)
    for y in (17, 20): tc.line(42, y, 47, y + 2, 'wood', 4)               # 끌채
    tc.grain(.03, mats=('wood', 'coal'))
    im = tc.fin(.6, shadow=(24, 31, 20, 2, 60))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def coal_heap(seed=0, w=32, h=24):
    """석탄 더미 2x2칸: 땅에 쏟아 쌓은 산 + 흘러내린 덩이. 아래 줄 막힘."""
    tc = TC(w, h + 8, seed)
    coal_mound(tc, 1, 6, w - 2, h, seed)
    for i in range(10):
        x = int(hash2(i, 1, seed) * (w - 2)) + 1; y = h + 2 + int(hash2(i, 2, seed) * 5)
        tc.px(x, y, 'coal', 4); tc.px(x + 1, y, 'coal', 2)
    return tc.fin(.55, shadow=(w // 2, h + 5, w // 2 - 2, 2, 55))


def coal_sacks(seed=0):
    """석탄 자루 셋 2x1칸: 거친 삼베(나무 결 바랜 톤) + 묶은 목 + 위로 비친 석탄. 칸 막힘."""
    tc = TC(32, 20, seed)
    for i, (cx, h) in enumerate(((8, 13), (17, 15), (25, 12))):
        for y in range(20 - h, 19):
            hw = 5 - (1 if y < 20 - h + 3 else 0)
            for x in range(cx - hw, cx + hw):
                k = 5 if x < cx - 2 else (4 if x < cx + 2 else 3)
                if (x + y) % 5 == 0: k -= 1
                tc.px(x, y, 'drab', k)
        tc.hline(cx - 2, cx + 2, 20 - h + 2, 'wood', 2)
        for x in range(cx - 2, cx + 2): tc.px(x, 20 - h, 'coal', 3 if x < cx else 2)
    return tc.fin(.6, shadow=(16, 19, 13, 1.5, 55))


def coal_barrow(seed=0):
    """석탄 외바퀴 손수레 1x1(옆에서 본 꼴): 왼쪽 앞 바퀴(무쇠 테 + 놋쇠 굴대) · 사다리꼴 나무 통(널 줄, 무쇠 테) 위 석탄 덩이 ·
    오른쪽 뒤로 뻗은 손잡이 둘 + 받침 다리. 칸 막힘."""
    tc = TC(16, 16, seed)
    coal_mound(tc, 4, 2, 9, 4, seed)
    for y in range(5, 10):                                                # 통(사다리꼴, 아래가 좁다)
        for x in range(3 + (y - 5) // 2, 14 - (y - 5)):
            k = 5 if y == 5 else (4 if (y - 5) % 2 else 3)
            if x >= 13 - (y - 5): k = 2
            tc.px(x, y, 'wood', k)
    tc.hline(3, 14, 5, 'steel', 4)
    for t in range(0, 360, 20):                                           # 바퀴
        a = math.radians(t); tc.px(round(4.5 + math.cos(a) * 2.6), round(12 + math.sin(a) * 2.6), 'steel', 5 if t > 150 and t < 300 else 3)
    tc.px(4, 12, 'brass', 6)
    tc.line(12, 7, 15, 9, 'wood', 5); tc.line(12, 8, 15, 10, 'wood', 3)  # 손잡이
    tc.vline(11, 10, 14, 'steel', 3)                                     # 받침 다리
    return tc.fin(.6, shadow=(8, 15, 6, 1, 55))


# ---------------------------------------------------------------- 통·상자·벤치·잡물
def oil_barrels(seed=0):
    """기름통 무리 2x2칸: 검은 무쇠 통 셋(놋쇠 테 둘·윗면 뚜껑 마개) + 앞에 누운 통 하나. 아래 줄 막힘."""
    tc = TC(32, 32, seed)
    for (cx, by, mat) in ((9, 22, 'steel'), (22, 20, 'steel'), (15, 30, 'rust')):
        FP.cyl(tc, cx, by - 13, 5.5, 2.4, 11, mat, top=mat, base=-1 if mat == 'steel' else 0, seed=seed)
        for yy in (by - 9, by - 4):
            for x in range(int(cx - 5), int(cx + 6)): tc.px(x, yy, 'brass', cyl_k((x - cx + 5.5) / 11))
        tc.px(int(cx) + 2, by - 14, 'brass', 5)
    return tc.fin(.6, shadow=(16, 30, 13, 2, 55))


def crates_brass(seed=0):
    """나무 짐 상자 더미 2x2칸: 상자 셋(널 결 + 놋쇠 모서리 쇠 + 윗면 밝음), 기계 부품 상자. 아래 줄 막힘."""
    tc = TC(32, 32, seed)
    def crate(x0, y0, w, h, top):
        for y in range(y0, y0 + top):
            for x in range(x0, x0 + w): tc.px(x, y, 'wood', 6 if x < x0 + w - 2 else 5)
        for y in range(y0 + top, y0 + h):
            for x in range(x0, x0 + w):
                k = 4 if (y - y0 - top) % 4 == 0 else 3
                if x >= x0 + w - 2: k -= 1
                tc.px(x, y, 'wood', k)
        for (x, y) in ((x0, y0 + top), (x0 + w - 2, y0 + top), (x0, y0 + h - 2), (x0 + w - 2, y0 + h - 2)):
            tc.rect(x, y, x + 2, y + 2, 'brass', 5)
        tc.line(x0 + 1, y0 + top + 1, x0 + w - 2, y0 + h - 2, 'wood', 2)
    crate(2, 14, 14, 16, 4); crate(15, 16, 15, 14, 4); crate(7, 2, 13, 13, 4)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 55))


def iron_bench(seed=0):
    """무쇠 벤치 2x1칸: 나무 널 앉음판·등판(놋쇠 볼트) + 꽃무늬 없는 무쇠 다리 둘. 칸 막힘."""
    tc = TC(32, 18, seed)
    for y in range(2, 8):
        for x in range(3, 29): tc.px(x, y, 'wood', 5 if y % 3 == 2 else (4 if x < 20 else 3))
    for y in range(9, 12):
        for x in range(2, 30): tc.px(x, y, 'wood', 6 if y == 9 else 4)
    for x in (4, 27):
        for y in range(1, 17): tc.px(x, y, 'steel', 4 if x == 4 else 2); tc.px(x + 1, y, 'steel', 2)
        tc.px(x, 16, 'steel', 1); tc.px(x - 1, 16, 'steel', 3)
    for x in (8, 16, 24): tc.px(x, 4, 'brass', 6)
    return tc.fin(.6, shadow=(16, 17, 13, 1.2, 50))


def bollard_iron(seed=0):
    """무쇠 말뚝 1x1: 둥근 머리 + 놋쇠 띠. 칸 막힘."""
    tc = TC(16, 16, seed)
    FP.cyl(tc, 8, 3, 3.2, 1.4, 10, 'steel', top='steel', base=-1, seed=seed)
    for x in range(5, 12): tc.px(x, 7, 'brass', cyl_k((x - 4.8) / 6.4))
    return tc.fin(.6, shadow=(8, 15, 4, 1, 50))


def steam_hydrant(seed=0):
    """증기 소화전 1x1: 놋쇠 몸통(둥근 뚜껑·양옆 마개·볼트 테) + 무쇠 받침. 칸 막힘."""
    tc = TC(16, 16, seed)
    FP.cyl(tc, 8, 4, 3.6, 1.6, 8, 'brass', top='brass', seed=seed)
    for x in (3, 13):
        tc.rect(x - 1, 7, x + 2, 10, 'brass', 4 if x == 3 else 2)
    tc.hline(3, 14, 13, 'steel', 3); tc.hline(3, 14, 14, 'steel', 1)
    tc.px(8, 2, 'brass', 6)
    return tc.fin(.6, shadow=(8, 15, 5, 1, 50))


def pillar_box(seed=0):
    """무쇠 우편 기둥 1x2칸: 붉은 도장 원통 + 둥근 지붕 갓 + 투입구(어둠 줄, 글자 없음) + 받침. 밑동만 막힘."""
    tc = TC(16, 32, seed)
    FP.cyl(tc, 8, 8, 5, 2, 20, 'paint', top='paint', seed=seed)
    for x in range(3, 14): tc.px(x, 6, 'paint', 6 if x < 8 else 4)
    tc.hline(5, 11, 13, 'dark', 1); tc.hline(5, 11, 14, 'paint', 2)
    tc.hline(3, 14, 25, 'brass', 4)
    tc.hline(2, 15, 30, 'steel', 3); tc.hline(2, 15, 31, 'steel', 1)
    return tc.fin(.6, shadow=(8, 31, 6, 1.4, 55))


def poster_column(seed=0):
    """광고 기둥 1x3칸: 둥근 기둥에 그림 벽보 셋(무늬만 — 글자·상표 없음: 톱니 그림·비행선 실루엣·줄무늬), 구리 둥근 지붕 + 놋쇠 꼭지. 밑동만 막힘."""
    tc = TC(16, 48, seed)
    FP.cyl(tc, 8, 14, 6, 2, 28, 'plaster', top='plaster', base=-1, seed=seed)
    for y in range(18, 40):                                              # 벽보(색 판 + 그림 기호)
        for x in range(3, 14):
            if 19 <= y < 27 and 3 <= x < 8: tc.px(x, y, 'warn', 4 if x < 5 else 3)
            elif 21 <= y < 31 and 8 <= x < 13: tc.px(x, y, 'paint', 4 if x < 10 else 3)
            elif 30 <= y < 38 and 4 <= x < 11: tc.px(x, y, 'cyan', 2 if (y // 2) % 2 else 1)
    tc.ell(5, 23, 1.5, 1.5, 'steel', 1)                                  # 톱니 기호(점)
    tc.hline(9, 12, 25, 'steel', 1); tc.hline(10, 12, 24, 'steel', 1)    # 비행선 실루엣
    for y in range(8, 15):                                               # 구리 지붕
        hw = 2 + (y - 8)
        for x in range(8 - hw, 8 + hw): tc.px(x, y, 'rust', 6 if x < 7 else (4 if x < 10 else 3))
    tc.px(7, 6, 'brass', 6); tc.px(7, 7, 'brass', 4)
    tc.hline(1, 15, 44, 'steel', 3); tc.hline(1, 15, 45, 'steel', 1)
    return tc.fin(.6, shadow=(8, 45, 6, 1.4, 55))


def gear_scrap(seed=0):
    """버린 톱니 더미 2x1칸: 큰 녹슨 구리 톱니(살 넷) + 작은 놋쇠 톱니가 기대어 있고 앞에 쇠막대 하나. 칸 막힘."""
    tc = TC(32, 20, seed)
    gear_face(tc, 11, 10, 7, 8, 'rust', .2, spokes=4, hub_mat='brass')
    gear_face(tc, 24, 13, 5, 7, 'brass', .5, spokes=3, hub_mat='steel')
    tc.line(4, 18, 29, 17, 'steel', 4); tc.line(4, 19, 29, 18, 'steel', 1)
    return tc.fin(.6, shadow=(16, 19, 13, 1.2, 50))


def wheel_lean(seed=0):
    """벽에 기댄 마차 바퀴 1x1: 두꺼운 무쇠 테(2px, 윗왼 빛 5) + 밝은 나무 살 여섯(톤 5) + 놋쇠 굴대 — 어두운 바닥에서도 고리가 읽힌다. 칸 막힘."""
    tc = TC(16, 16, seed)
    cx, cy = 8, 8
    for t in range(0, 360, 5):
        a = math.radians(t)
        for rr in (6.0, 7.0):
            tc.px(round(cx - .5 + math.cos(a) * rr), round(cy - .5 + math.sin(a) * rr), 'steel', (5 if t > 150 and t < 300 else 3) - (1 if rr > 6.5 else 0))
    for i in range(6):
        a = i * math.pi / 3 + .26
        for rr in (2, 3, 4, 5): tc.px(round(cx - .5 + math.cos(a) * rr), round(cy - .5 + math.sin(a) * rr), 'wood', 5 if math.cos(a) < 0 else 4)
    tc.ell(cx, cy, 1.6, 1.6, 'brass', lambda x, y: 6 if x < cx else 4)
    return tc.fin(.6, shadow=(8, 15, 5, 1, 50))


# ---------------------------------------------------------------- 광장·거리 랜드마크 소품
def steam_fountain(seed=0):
    """증기 분수 3x3칸(48x48): 둥근 회색 석재 수반(테 윗면 빛 + 앞면 마름돌) 안에 김 서린 물, 가운데 놋쇠 기둥(톱니 장식 고리)
    꼭대기에서 흰 김이 솟는다. 수반 아래 2줄 막힘, 김 위 칸 걷기+가림."""
    W, H = 48, 56
    tc = TC(W, H, seed)
    cx, cy = 24, 38
    for y in range(26, 54):                                               # 수반 테(윗면 타원) + 앞면
        for x in range(1, 47):
            u = (x + .5 - cx) / 22.5; v = (y + .5 - cy) / 10.0
            if u * u + v * v <= 1:
                inner = (x + .5 - cx) ** 2 / 19.0 ** 2 + (y + .5 - cy + .5) ** 2 / 7.6 ** 2 <= 1
                if inner:
                    k = 3 if hash2(x // 3, y, seed + 2) > .4 else 4
                    if (y + int(math.sin(x / 3.0) * 1.2)) % 4 == 0: k = 5
                    if y < cy - 4: k = 2                                    # 북쪽 테 그늘
                    tc.px(x, y, 'cond', k)
                else:
                    tc.px(x, y, 'gst', 6 if (y < cy and x < cx) else (5 if y < cy else 4))
            elif u * u <= 1 and cy <= y < cy + 15 and (u * u + ((y - 6 + .5 - cy) / 10.0) ** 2) <= 1:
                k = ashlar_k(x, y, 8, 5, seed + 3, 4)
                if x > cx + 14: k -= 1
                if y >= cy + 13: k = 2
                tc.px(x, y, 'gst', ck(k))
    for y in range(8, 38):                                                # 놋쇠 기둥
        for x in range(21, 27):
            tc.px(x, y, 'brass', cyl_k((x - 21 + .5) / 6))
    for yy in (14, 26):
        for x in range(19, 29): tc.px(x, yy, 'brass', cyl_k((x - 19 + .5) / 10)); tc.px(x, yy + 1, 'brass', 1)
    gear_face(tc, 24, 20, 3, 8, 'steel', .2, spokes=3, hub_mat='brass')
    tc.ell(24, 7, 3.5, 1.6, 'brass', 6)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6, shadow=(24, 53, 22, 3, 60))
    im.alpha_composite(steam_cloud(26, 18, seed + 5, 210), (11, 0))
    return im


def gear_monument(seed=0):
    """톱니 기념비 2x3칸(32x48): 계단 두 단 회색 석재 받침(윗면 보임) 위에 세운 큰 놋쇠 톱니(바퀴살 다섯, 녹청 점), 작은 검은 톱니가 맞물림.
    받침 아래 1줄 막힘, 위 걷기+가림."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for (y0, y1, x0, x1) in ((40, 48, 1, 31), (34, 40, 5, 27)):
        for y in range(y0, y1):
            for x in range(x0, x1):
                r = y - y0
                k = 6 if r == 0 else (5 if r == 1 else ashlar_k(x, y, 10, 4, seed, 4))
                if x >= x1 - 2: k -= 1
                if y == y1 - 1: k = 2
                tc.px(x, y, 'gst', ck(k))
    gear_face(tc, 15, 19, 11, 14, 'brass', .1, spokes=5, hub_mat='steel')
    gear_face(tc, 26, 30, 4, 8, 'steel', .4, spokes=3, hub_mat='brass')
    return tc.fin(.6, shadow=(16, 47, 14, 2, 60))


def steam_engine(seed=0):
    """증기 기관(거리 펌프) 3x2칸(48x32): 누운 구리 실린더 + 피스톤 막대 + 검은 무쇠 큰 플라이휠(살 여섯) + 굴뚝 짧은 관과 김, 받침 석재.
    아래 1줄 막힘(몸통), 위 걷기+가림."""
    W, H = 48, 36
    tc = TC(W, H, seed)
    for y in range(30, 36):
        for x in range(1, 47): tc.px(x, y, 'gst', 6 if y == 30 else (4 if y < 34 else 2))
    for y in range(18, 30):                                               # 실린더
        k = cyl_k((y - 18 + .5) / 12)
        for x in range(4, 24):
            m = 'brass' if (x - 4) % 9 in (0, 1) else 'rust'
            tc.px(x, y, m, k)
    tc.hline(24, 34, 23, 'steel', 5); tc.hline(24, 34, 24, 'steel', 2)  # 피스톤 막대
    gear_face(tc, 36, 18, 9, 0, 'steel', 0, spokes=6, hub_mat='brass') if False else None
    for t in range(0, 360, 4):                                            # 플라이휠(테)
        a = math.radians(t)
        for rr in (9.5, 10.5, 11.2):
            tc.px(round(36 - .5 + math.cos(a) * rr), round(18 - .5 + math.sin(a) * rr), 'steel', 5 if (t > 150 and t < 300) else (3 if rr > 11 else 4))
    for i in range(6):
        a = i * math.pi / 3 + .3
        for rr in np.linspace(2, 9, 8): tc.px(round(36 - .5 + math.cos(a) * rr), round(18 - .5 + math.sin(a) * rr), 'brass', 4 if math.cos(a) < 0 else 3)
    tc.ell(36, 18, 2, 2, 'brass', 5)
    pipe_v(tc, 10, 4, 18, 4, 'steel', flange=False)
    tc.hline(7, 14, 4, 'steel', 6)
    gauge(tc, 18, 13, 2, seed)
    im = tc.fin(.6, shadow=(24, 35, 22, 2, 55))
    im.alpha_composite(steam_cloud(14, 12, seed + 3, 180), (3, 0))
    return im


def water_tower(seed=0):
    """급수탑 2x4칸(32x64): 리벳 검은 철 원통 물탱크(놋쇠 띠·원뿔 구리 갓) + 무쇠 다리 넷·가새 + 내려오는 구리 급수관(꺾임 주둥이).
    다리 밑동 줄만 막힘."""
    W, H = 32, 64
    tc = TC(W, H, seed)
    FP.cyl(tc, 16, 10, 13, 4, 20, 'steel', top='steel', base=-2, seed=seed)
    for j in range(7):
        for x in range(3 + j * 2, 29 - j * 2):
            k = 5 if x < 16 else 3
            if (x - 16) % 5 == 0: k += 1
            tc.px(x, 9 - j, 'rust', k)
    for by in (18, 28):
        for x in range(3, 29): tc.px(x, by, 'brass', cyl_k((x - 3 + .5) / 26))
    for lx in (5, 12, 19, 26):
        for y in range(34, 62): tc.px(lx, y, 'steel', 4 if lx < 16 else 2)
    tc.line(5, 38, 12, 52, 'steel', 2); tc.line(26, 38, 19, 52, 'steel', 2); tc.hline(5, 27, 46, 'steel', 3)
    for lx in (5, 12, 19, 26): tc.hline(lx - 1, lx + 2, 62, 'gst', 3); tc.hline(lx - 1, lx + 2, 63, 'gst', 1)
    pipe_v(tc, 16, 34, 52, 4, 'rust', step=8)
    for x in range(16, 23): tc.px(x, 52, 'rust', 5); tc.px(x, 53, 'rust', 3); tc.px(x, 54, 'rust', 2)
    return tc.fin(.6, shadow=(16, 62, 14, 2, 55))


def kiosk(seed=0):
    """신문 판매대 2x3칸(32x48): 구리 둥근 지붕(녹청 줄 + 놋쇠 꼭지) + 팔각 무쇠 몸통(진열 창 둘에 호박빛, 글자 없음) + 앞 판매 턱.
    아래 2줄 막힘, 지붕 걷기+가림."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    import sc_build as _B
    _B.roof_copper_pyramid(tc, 2, 4, 28, 14, seed)
    tc.hline(1, 31, 18, 'brass', 5); tc.hline(1, 31, 19, 'brass', 2)
    tc.px(15, 1, 'brass', 6); tc.vline(16, 1, 5, 'brass', 3)
    for y in range(20, 44):
        for x in range(3, 29):
            k = 3 if (x - 3) % 8 else 1
            if x < 5: k = 4
            if x > 26: k = 1
            tc.px(x, y, 'steel', k)
    for (x0, x1) in ((6, 14), (18, 26)):
        for y in range(23, 33):
            for x in range(x0, x1): tc.px(x, y, 'amber', 4 if y < 27 else 3)
        tc.hline(x0, x1, 28, 'steel', 2)
    for y in range(34, 37):
        for x in range(2, 30): tc.px(x, y, 'wood', 6 if y == 34 else (4 if y == 35 else 2))
    for x in (7, 12, 20, 24): tc.px(x, 33, 'plaster', 6); tc.px(x + 1, 33, 'plaster', 4)   # 진열된 종이 묶음(무늬 없음)
    tc.hline(2, 30, 44, 'gst', 4); tc.hline(2, 30, 45, 'gst', 1)
    return tc.fin(.6, shadow=(16, 45, 14, 2, 55))


def tree_grate(seed=0):
    """가로수 2x3칸(32x48): 버들항 칩셋 둥근 활엽수 수관(336,512 원본) + 줄기(밑변과 같은 폭) + 무쇠 나무 창살 받침.
    줄기 칸(아래 1줄 가운데)만 막힘, 수관 걷기+가림."""
    tc = TC(32, 48, seed)
    for y in range(26, 44):
        tc.px(14, y, 'wood', 4); tc.px(15, y, 'wood', 4); tc.px(16, y, 'wood', 3); tc.px(17, y, 'wood', 2)
    tc.px(13, 43, 'wood', 3); tc.px(18, 43, 'wood', 2)
    for y in range(42, 47):                                               # 나무 창살(무쇠 사각 판)
        for x in range(6, 26):
            edge = y in (42, 46) or x in (6, 25)
            if 13 <= x <= 18 and y < 45: continue
            tc.px(x, y, 'steel', (4 if (y == 42 or x == 6) else 1) if edge else (2 if (x + y) % 2 else 3))
    im = tc.fin(.6, shadow=(16, 46, 10, 2, 60))
    im.alpha_composite(pz.chip(336, 512, 32, 32), (0, 0))
    return im
