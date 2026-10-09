# 제국 도시 소품 — 광장(동상 받침·확성기 기둥·깃대·가로등), 성문 밖(서치라이트·모래주머니·바리케이드·대전차 장애물·초소),
# 병영·격납고(보급 상자·연료 통·보급 수레), 공장 지구(변압기·밸브 장치·관 다리·가스 탱크·석탄 더미·증기 기관 바퀴), 거리(벤치·볼라드·배수 창살).
# 톤 캔버스(fr_mat.TC)에 기계 재질 규약대로 찍는다. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위. 글자·문장·얼굴 없음.
import math
from ec_base import *
from ec_base import _hash, vnoise
from ec_build import stack_body, iron_door


# ================================================================ 광장 (앵커 ⑤)
def statue(seed=0):
    """광장 동상 5x7칸(80x112): 네 단 회색 마름돌 받침(단마다 윗면 + 앞면, 가운데 단 앞에 단색 걸개 없는 민 판) 위에
    얼굴 없는 투구 형상의 검은 청동 갑옷 전신 — 닫힌 투구(가로 눈 틈 하나, 얼굴 없음)·볏, 어깨 갑옷, 망토, 두 손을 앞에 꽂은 큰 칼 자루에.
    받침 아래 두 줄 막힘, 동상 칸은 걷기 + 가림."""
    W, H = 80, 112; tc = TC(W, H, seed)
    OX, OY = 16, 6                                                        # 동상 몸 그림의 자리 옮김
    # 받침 네 단 (맨 아래 = 넓은 디딤 단, 위로 좁아진다)
    tiers = [(1, 79, 100, 112), (10, 70, 86, 100), (18, 62, 72, 86), (24, 56, 62, 72)]
    for (x0, x1, y0, y1) in tiers:
        top = 5 if y1 - y0 > 12 else 4
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y < y0 + top:
                    k = 6 if (y == y0 or x == x0) else 5
                    if x >= x1 - 1: k = 4
                else:
                    k = ashlar_k(x - x0, y - y0 - top, 12, 6, seed + y0, 4)
                    if y == y0 + top: k = 2
                    if x < x0 + 1: k = 5
                    if x >= x1 - 2: k -= 1
                    if y >= y1 - 1: k = 1
                tc.px(x, y, 'gst', clamp(k, 1, 6))
    for y in range(76, 83):                                               # 가운데 단 앞 민 판(글자 없는 판)
        for x in range(30, 50): tc.px(x, y, 'steel', 4 if y > 76 else 6)
    tc.hline(30, 50, 83, 'steel', 1)
    for (x, y) in ((31, 77), (48, 77), (31, 81), (48, 81)): tc.px(x, y, 'steel', 6)
    for y in range(88, 98):                                               # 둘째 단 양옆 쇠 등잔 받침(불 없음)
        for x in (14, 64): tc.px(x, y, 'steel', 5); tc.px(x + 1, y, 'steel', 2)
    full = tc; tc = TC(48, 64, seed)                                      # 동상 몸은 작은 캔버스에 그려 옮긴다
    cx = 24
    tc.poly([(cx - 8, 25), (cx + 8, 25), (cx + 10, 56), (cx - 10, 56)], 'bronze', lambda x, y: 2 if x > cx + 3 else 3)   # 망토(뒤, 어둡다)
    for x in range(cx - 10, cx + 11): tc.px(x, 55, 'bronze', 1)
    for (lx, k) in ((cx - 6, 5), (cx + 1, 3)):                              # 다리(정강이 갑옷)
        tc.rect(lx, 42, lx + 5, 55, 'bronze', lambda x, y, lx=lx, k=k: k + (1 if x == lx else 0) - (1 if x == lx + 4 else 0))
        tc.hline(lx - 1, lx + 6, 55, 'bronze', 2); tc.hline(lx, lx + 5, 48, 'bronze', k + 1); tc.hline(lx, lx + 5, 49, 'bronze', 2)
    tc.poly([(cx - 8, 25), (cx + 8, 25), (cx + 6, 43), (cx - 6, 43)], 'bronze', lambda x, y: 6 if x < cx - 4 else (5 if x < cx else (4 if x < cx + 4 else 3)))  # 흉갑
    tc.hline(cx - 6, cx + 7, 34, 'bronze', 3); tc.hline(cx - 6, cx + 7, 38, 'bronze', 3)                  # 갑옷 띠
    tc.hline(cx - 7, cx + 7, 42, 'bronze', 2); tc.hline(cx - 7, cx + 7, 43, 'bronze', 5)                  # 허리띠
    tc.vline(cx - 1, 26, 33, 'bronze', 6)                                                               # 가슴 능선
    for (sx, sgn) in ((cx - 9, -1), (cx + 9, 1)):                                                       # 어깨 갑옷(겹 판)
        tc.ell(sx, 27, 4.5, 3.5, 'bronze', lambda x, y, sx=sx: 6 if (x < sx and y < 27) else (5 if x < sx + 1 else 3))
        tc.hline(int(sx - 4), int(sx + 4), 29, 'bronze', 2); tc.hline(int(sx - 3), int(sx + 3), 30, 'bronze', 4)
    for (ax, k) in ((cx - 11, 5), (cx + 9, 3)):                                                         # 팔(앞으로 모아 칼 자루를 쥔다)
        tc.poly([(ax, 29), (ax + 3, 29), (cx + (2 if ax > cx else -2), 40), (cx + (5 if ax > cx else -5), 41)], 'bronze', k)
    # 투구(닫힘, 얼굴 없음): 둥근 위 + 턱 가리개 + 가로 눈 틈 하나 + 볏
    tc.ell(cx, 17, 5.5, 6, 'bronze', lambda x, y: 6 if (x < cx - 1 and y < 15) else (5 if x < cx + 1 else 3))
    tc.rect(cx - 5, 17, cx + 6, 24, 'bronze', lambda x, y: 4 if x < cx else 3)
    tc.hline(cx - 4, cx + 5, 18, 'dark', 1)                                                             # 눈 틈(얼굴 아님)
    tc.hline(cx - 4, cx + 5, 19, 'bronze', 5)
    tc.vline(cx, 20, 24, 'bronze', 2)                                                                   # 가리개 능선
    for i in range(6): tc.px(cx - 1 + (i > 2), 10 - i, 'bronze', 5 - (i % 2)); tc.px(cx + 1 + (i > 2), 10 - i, 'bronze', 3)   # 볏
    # 칼: 몸 앞 가운데 꽂힌 큰 칼(칼날은 아래로 받침까지, 코등이 + 자루를 두 손이)
    for y in range(40, 57): tc.px(cx - 1, y, 'bronze', 6); tc.px(cx, y, 'bronze', 4); tc.px(cx + 1, y, 'bronze', 2)
    tc.hline(cx - 5, cx + 6, 39, 'bronze', 5); tc.hline(cx - 5, cx + 6, 40, 'bronze', 2)
    tc.rect(cx - 2, 35, cx + 3, 39, 'bronze', 3); tc.px(cx - 1, 34, 'bronze', 5); tc.px(cx, 34, 'bronze', 4)
    full.paste(tc, OX, OY)
    full.grain(.04, mats=('gst', 'bronze'))
    return full.fin(.6, shadow=(40, 110, 38, 3, 70))


def loudspeaker(seed=0):
    """확성기 기둥 2x4칸(32x64): 강철 기둥 꼭대기 십자 받침에 나팔 확성기 셋(왼·오른·앞 아래), 접속 함, 땅으로 내려가는 선.
    밑동 한 칸만 막힘, 위 칸 걷기 + 가림."""
    W, H = 32, 64; tc = TC(W, H, seed)
    for y in range(8, 60): tc.px(15, y, 'steel', 5); tc.px(16, y, 'steel', 4); tc.px(17, y, 'steel', 2)
    box(tc, 11, 58, 22, 64, 2, 'gst', base=4)
    tc.hline(6, 27, 9, 'steel', 5); tc.hline(6, 27, 10, 'steel', 2)       # 가로 받침
    def horn(x0, y0, d):                                                  # 나팔(좁은 목 → 넓은 입, 입은 어둡다)
        for i in range(9):
            r = 1.2 + i * .45
            x = x0 + d * i
            for j in range(-int(r), int(r) + 1):
                k = 5 if j < 0 else (4 if j == 0 else 3)
                if i == 8: k = 6 if j < 0 else 2
                tc.px(x, y0 + j, 'steel', k)
        for j in range(-4, 5):
            if abs(j) < 4: tc.px(x0 + d * 8 + d, y0 + j, 'dark', 1)
    horn(11, 7, -1); horn(20, 7, 1)
    for i in range(7):                                                    # 앞 아래로 향한 나팔(세로)
        r = 1 + i * .5
        for j in range(-int(r), int(r) + 1): tc.px(16 + j, 12 + i, 'steel', 5 if j < 0 else 3)
    tc.hline(13, 20, 19, 'dark', 1); tc.hline(14, 19, 20, 'steel', 2)
    box(tc, 18, 30, 25, 38, 2, 'steel', base=3)                           # 접속 함
    tc.px(20, 33, 'amber', 5)
    cable(tc, 24, 36, 26, 58, sag=1)
    hazard(tc, 14, 50, 19, 57, seed)
    tc.grain(.04, mats=('steel',))
    return tc.fin(.6, shadow=(16, 63, 6, 1.6, 60))


def lamp_iron(seed=0):
    """쇠 가로등 1x3칸(16x48): 각진 강철 기둥 + 받침 + 꼭대기 네모 등(호박색 유리, 갓) + 빛 번짐. 밑동만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    for y in range(12, 44): tc.px(7, y, 'steel', 5); tc.px(8, y, 'steel', 3); tc.px(9, y, 'steel', 2)
    for y in range(40, 47):
        for x in range(4, 13): tc.px(x, y, 'steel', 5 if y == 40 else (4 if x < 9 else 2))
    tc.hline(4, 13, 47, 'steel', 1)
    tc.hline(3, 13, 3, 'steel', 6); tc.hline(4, 12, 4, 'steel', 4); tc.hline(5, 11, 5, 'steel', 2)          # 갓
    for y in range(6, 12):
        for x in range(4, 12):
            k = 6 if (x < 7 and y < 8) else (5 if x < 9 else 4)
            tc.px(x, y, 'amber', k)
    for y in range(6, 12): tc.px(4, y, 'steel', 4); tc.px(11, y, 'steel', 2); tc.px(8, y, 'steel', 3)
    tc.hline(4, 12, 12, 'steel', 2)
    im = tc.fin(.65, shadow=(8, 46, 4, 1.4, 60))
    o = new(16, 48); o.alpha_composite(D.glow(16, SIGNAL['amber'][5], 60, 8, 9, 8), (0, 0)); o.alpha_composite(im)
    return o


def flagpole(seed=0):
    """깃대 2x6칸(32x96): 높은 강철 깃대(돌 받침), 꼭대기 쇠 공, 바람에 날리는 큰 단색 진홍 깃발(문장·글자 없음). 밑동 한 칸만 막힘."""
    W, H = 32, 96; tc = TC(W, H, seed)
    for y in range(4, 90): tc.px(6, y, 'steel', 5); tc.px(7, y, 'steel', 3)
    tc.ell(6.5, 3, 2, 2, 'steel', lambda x, y: 6 if x < 6 else 4)
    box(tc, 2, 86, 13, 96, 3, 'gst', base=4)
    for i in range(22):                                                   # 깃발(물결: 접힌 골은 어둡고 등은 밝다)
        ph = math.sin((i + seed * 3) / 3.2)
        dy = int(round(math.sin((i + seed * 3) / 3.2 - .9) * 2.2 * (i / 22)))
        base = 4 + int(round(ph * 1.7))
        L = 16 - int(i / 22 * 2)
        for j in range(L):
            k = base
            if j == 0: k += 1
            if j >= L - 1: k = 2
            if i >= 20: k -= 1
            tc.px(8 + i, 8 + j + dy, 'flag', clamp(k, 1, 6))
    tc.grain(.03, mats=('gst',))
    return tc.fin(.65, shadow=(7, 95, 6, 1.6, 60))


def bench_iron(seed=0):
    """강철 벤치 2x1칸: 판 앉음판 둘(윗면) + 등받이 판, 주물 다리. 칸 막힘."""
    W, H = 32, 16; tc = TC(W, H, seed)
    for x in range(2, 30):
        tc.px(x, 3, 'steel', 6); tc.px(x, 4, 'steel', 4); tc.px(x, 5, 'steel', 2)          # 등받이
        tc.px(x, 8, 'steel', 5); tc.px(x, 9, 'steel', 6); tc.px(x, 10, 'steel', 4); tc.px(x, 11, 'steel', 2)  # 앉음판
    for lx in (4, 26):
        for y in range(5, 15): tc.px(lx, y, 'steel', 3); tc.px(lx + 1, y, 'steel', 1)
    return tc.fin(.6, shadow=(16, 14, 13, 1.6, 55))


def bollard(seed=0):
    """쇠 볼라드 1x1칸: 둥근 머리 강철 기둥 + 흰 띠(바랜 경고) 하나. 칸 막힘."""
    tc = TC(16, 16, seed)
    FP.cyl(tc, 8, 3, 3, 1.4, 10, 'steel', seed=seed)
    for x in range(5, 11):
        g = tc.get(x, 7)
        if g: tc.px(x, 7, 'warn', 4 if x < 9 else 3); tc.px(x, 8, 'warn', 3 if x < 9 else 2)
    return tc.fin(.6, shadow=(8, 14, 4, 1.2, 55))


def drain_grate(seed=0):
    """배수 창살(바닥 장식) 1x1칸: 강철 틀 + 세로 살 + 어두운 속. 걷기, 사람 아래."""
    tc = TC(16, 16, seed)
    for y in range(4, 13):
        for x in range(3, 13):
            if y in (4, 12) or x in (3, 12): tc.px(x, y, 'steel', 5 if (y == 4 or x == 3) else 2)
            else: tc.px(x, y, 'steel', 4) if x % 2 else tc.px(x, y, 'dark', 1)
    return tc.img()


# ================================================================ 성문 밖·경비
def searchlight(seed=0, flip=False):
    """서치라이트 2x3칸(32x48): 회색 석재 받침 + 강철 기둥 + U자 갈퀴에 걸린 큰 원통 등(왼쪽 위를 향한다 — 앞 렌즈 원이 청백으로 빛나고,
    뒤 몸통은 원통 음영 + 냉각 테), 등 뒤 전선. 밑동 한 칸만 막힘. 빛줄기는 searchlight_beam(위층)."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 8, 38, 24, 48, 3, 'gst', base=4)
    for y in range(24, 39): tc.px(15, y, 'steel', 5); tc.px(16, y, 'steel', 3); tc.px(17, y, 'steel', 2)
    tc.ell(16, 25, 6, 2, 'steel', lambda x, y: 5 if x < 16 else 3)          # 회전 고리
    for i in range(10):                                                   # 몸통: 렌즈(왼 위)에서 오른 아래로 뻗은 원통
        cx = 14 + i * .9; cy = 13 + i * .6
        tc.ell(cx, cy, 8, 8, 'steel', lambda x, y, cx=cx, cy=cy: clamp(round(4 + (cx - x) * .25 + (cy - y) * .15), 1, 5))
    for i in (3, 6):                                                      # 냉각 테
        cx = 14 + i * .9; cy = 13 + i * .6
        for a in range(0, 360, 6):
            r = math.radians(a); x = cx + 8 * math.cos(r); y = cy + 8 * math.sin(r)
            if -60 < a < 150 or a > 300: tc.px(x, y, 'steel', 2)
    tc.ell(13, 12, 8, 8, 'steel', lambda x, y: 6 if (x < 12 and y < 11) else 4)      # 앞 테
    tc.ell(13, 12, 6.2, 6.2, 'glass', lambda x, y: 6 if (x < 13 and y < 12) else 5)
    for (x, y) in ((10, 9), (11, 9), (10, 10)): tc.px(x, y, 'plaster', 6)
    for y in range(18, 27):                                               # 갈퀴 팔
        tc.px(8, y, 'steel', 5); tc.px(9, y, 'steel', 3); tc.px(23, y, 'steel', 3); tc.px(24, y, 'steel', 2)
    tc.hline(8, 25, 26, 'steel', 4)
    cable(tc, 25, 20, 29, 44, sag=2)
    tc.grain(.03, mats=('steel',))
    im = tc.fin(.6, shadow=(16, 47, 9, 1.8, 60))
    o = new(W, H); o.alpha_composite(D.glow(24, (220, 248, 255), 70, 12, 12, 11), (1, 0)); o.alpha_composite(im)
    return o.transpose(Image.FLIP_LEFT_RIGHT) if flip else o


def searchlight_beam(seed=0, w=96, h=80):
    """서치라이트 빛줄기(위층 덧그림) 6x5칸: 오른쪽 아래 렌즈에서 왼쪽 위로 넓어지는 반투명 청백 띠(두 단 알파, 끝은 들쭉날쭉).
    걷기, 사람 위. 서치라이트 렌즈에 꼭짓점을 맞춘다."""
    o = new(w, h); p = o.load()
    ox, oy = w - 6, h - 6                                                 # 렌즈 자리(오른쪽 아래)
    ang = math.atan2(-(h - 10), -(w - 10)); spread = .16
    for y in range(h):
        for x in range(w):
            dx, dy = x + .5 - ox, y + .5 - oy
            r = math.hypot(dx, dy)
            if r < 4: continue
            a = math.atan2(dy, dx); da = abs((a - ang + math.pi) % (2 * math.pi) - math.pi)
            lim = spread * (1 + .1 * math.sin(r / 7.0 + seed))
            if da < lim and r < min(w, h) * 1.15 - vnoise(x, y, 6, seed) * 14:
                core = da < lim * .45
                al = (70 if core else 42) * (1 - r / (min(w, h) * 1.3))
                al = int(al // 8 * 8)
                if al > 0: p[x, y] = (226, 246, 255, al)
    return o


def sandbags(n=3, seed=0):
    """모래주머니 담 3x1칸(48x16): 두 단으로 엇갈려 쌓은 둥근 자루(바랜 황토 천, 묶은 주름), 윗단은 빛. 칸 막힘."""
    W, H = n * 16, 16; tc = TC(W, H, seed)
    for row, (y, off, k0) in enumerate(((9, 0, 4), (4, 5, 5))):
        for i in range(-1, n * 2 + 1):
            cx = i * 9 + 5 + off
            if cx < 3 or cx > W - 3: continue
            tc.ell(cx, y + 2, 5, 3.2, 'drab', lambda x, yy, cx=cx, y=y, k0=k0: k0 + (1 if (x < cx - 1 and yy < y + 2) else 0) - (1 if yy > y + 3 else 0))
            tc.px(cx + 4, y + 2, 'drab', 2); tc.px(cx - 4, y + 1, 'drab', k0 + 1)
    for x in range(W):
        if tc.get(x, 14): tc.px(x, 14, 'drab', 1)
    tc.grain(.06, mats=('drab',))
    return tc.fin(.6, shadow=(W / 2, 14, W / 2 - 2, 1.6, 55))


def barricade(seed=0):
    """철 바리케이드 2x1칸(32x16): X자 강철 다리 둘 위 가로 막대(노랑·검정 경고 사선), 막대 끝 붉은 반사판. 칸 막힘."""
    W, H = 32, 16; tc = TC(W, H, seed)
    for (lx) in (6, 24):
        for i in range(10):
            tc.px(lx - 4 + i * .8, 6 + i, 'steel', 4); tc.px(lx + 4 - i * .8, 6 + i, 'steel', 2)
    hazard(tc, 2, 3, 30, 8, seed)
    tc.hline(2, 30, 2, 'steel', 6); tc.hline(2, 30, 8, 'steel', 1)
    tc.px(3, 5, 'redl', 6); tc.px(28, 5, 'redl', 5)
    return tc.fin(.6, shadow=(16, 15, 13, 1.4, 55))


def hedgehog(seed=0):
    """대전차 장애물 1x1칸: 세 강철 형강이 서로 엇갈려 선 별 모양(윗면 빛 모, 녹 조금). 칸 막힘."""
    tc = TC(16, 16, seed)
    for (x0, y0, x1, y1, k) in ((2, 13, 13, 2, 4), (3, 3, 13, 14, 3), (8, 1, 8, 15, 5)):
        tc.line(x0, y0, x1, y1, 'steel', k, w=2)
    tc.hline(6, 11, 8, 'steel', 6); tc.px(8, 1, 'steel', 6)
    rustify(tc, 0, 0, 16, 16, amount=.25, seed=seed + 1)
    return tc.fin(.6, shadow=(8, 14, 6, 1.4, 55))


def sentry_box(seed=0):
    """초소 2x3칸(32x48): 강철 판 작은 경비 초소 — 검은 뾰족 지붕(강철 마룻대), 앞 창(어둠 + 반짝), 열린 문 틈, 붉은·흰 사선 받침.
    아래 두 줄 막힘, 지붕 줄 걷기 + 가림."""
    W, H = 32, 48; tc = TC(W, H, seed)
    roof_hip(tc, 0, 4, 32, 16, 'roofk', ends=True)
    panels(tc, 2, 20, 30, 44, 'steel', 3, 14, 12, stagger=False, rivets=True, face='front', seed=seed)
    for j in range(2):
        for x in range(2, 30): tc.shift(x, 20 + j, -1)
    for y in range(24, 32):
        for x in range(5, 15): tc.px(x, y, 'glass', 2 if y < 28 else 1)
    tc.px(6, 25, 'glass', 5); tc.px(7, 25, 'glass', 4)
    tc.hline(4, 16, 32, 'gst', 6); tc.hline(4, 16, 33, 'gst', 2)
    for y in range(24, 44):
        for x in range(19, 27): tc.px(x, y, 'dark', 1 if x > 20 else 2)
    tc.vline(18, 23, 44, 'steel', 5); tc.vline(27, 23, 44, 'steel', 2)
    for y in range(44, 48):
        for x in range(2, 30):
            tc.px(x, y, 'redl' if ((x + y) // 4) % 2 == 0 else 'plaster', 3 if y < 47 else 2)
    tc.grain(.03, mats=('steel',))
    return tc.fin(.6, shadow=(16, 47, 14, 2, 60))


# ================================================================ 병영·격납고 보급 (앵커 ②)
def crate(tc, x0, y0, w=14, h=12, top=5, seed=0, mat='drab'):
    """보급 상자 하나(3/4): 윗면(판 줄 + 빛) + 앞면(판자 결 + 강철 모서리쇠 + 가운데 띠 한 줄). 글자 없음."""
    for y in range(y0, y0 + top):
        for x in range(x0, x0 + w):
            k = 6 if (y == y0 or x == x0) else (5 if (x - x0) % 5 else 4)
            if x == x0 + w - 1: k = 4
            tc.px(x, y, mat, k)
    for y in range(y0 + top, y0 + top + h):
        for x in range(x0, x0 + w):
            k = 4 if (y - y0 - top) % 4 else 3
            if x < x0 + 1: k = 5
            if x >= x0 + w - 2: k -= 1
            if y == y0 + top: k = 2
            if y == y0 + top + h - 1: k = 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    for (cx, cy) in ((x0, y0 + top), (x0 + w - 2, y0 + top), (x0, y0 + top + h - 3), (x0 + w - 2, y0 + top + h - 3)):
        for dy in range(3):
            for dx in range(2): tc.px(cx + dx, cy + dy, 'steel', 5 if dx == 0 else 3)
    my = y0 + top + h // 2
    for x in range(x0 + 2, x0 + w - 2): tc.px(x, my, 'steel', 4); tc.px(x, my + 1, 'steel', 2)


def crates_stack(seed=0):
    """보급 상자 더미 2x2칸(32x32): 아래 둘 + 위 하나 엇갈려 쌓은 국방 황토 상자(강철 모서리쇠·띠). 아랫줄 막힘, 윗줄 걷기 + 가림."""
    tc = TC(32, 32, seed)
    crate(tc, 1, 13, 15, 12, 5, seed)
    crate(tc, 16, 14, 15, 11, 5, seed + 1)
    crate(tc, 7, 1, 15, 11, 5, seed + 2)
    tc.grain(.04, mats=('drab',))
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def crate_single(seed=0):
    """보급 상자 하나 1x1칸. 칸 막힘."""
    tc = TC(16, 16, seed)
    crate(tc, 1, 1, 14, 9, 5, seed)
    tc.grain(.04, mats=('drab',))
    return tc.fin(.6, shadow=(8, 15, 7, 1.4, 55))


def ammo_boxes(seed=0):
    """탄약 상자 줄 2x1칸: 낮고 긴 강철 상자 셋(뚜껑 걸쇠, 붉은 띠 한 줄). 칸 막힘."""
    tc = TC(32, 16, seed)
    for i, x0 in enumerate((1, 11, 21)):
        box(tc, x0, 3 + (i % 2), x0 + 10, 14, 4, 'steel', base=3, seed=seed + i)
        tc.hline(x0 + 1, x0 + 9, 9 + (i % 2), 'redl', 3)
        tc.px(x0 + 4, 7 + (i % 2), 'steel', 6)
    return tc.fin(.6, shadow=(16, 14, 14, 1.4, 55))


def drums_fuel(seed=0):
    """연료 통 무리 2x2칸(32x32): 회청 도장 드럼통 셋(붉은 띠, 테 두 줄, 뚜껑 마개) — 둘 뒤·하나 앞. 아랫줄 막힘."""
    tc = TC(32, 32, seed)
    for (cx, by) in ((9, 19), (22, 18), (15, 30)):
        FP.drum(tc, cx, by, 'steel', seed=seed + cx, rust=0)
        for x in range(cx - 5, cx + 5):
            g = tc.get(x, by - 7)
            if g: tc.px(x, by - 7, 'redl', 3 if x < cx else 2)
    tc.grain(.03)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def supply_cart(seed=0):
    """보급 수레 3x2칸(48x32): 강철 짐칸(윗면 + 앞면 판·리벳) 위에 상자 둘과 덮개 천(국방 황토), 바퀴 넷(앞 둘 보임), 끌채.
    아랫줄 막힘, 윗줄 걷기 + 가림."""
    W, H = 48, 32; tc = TC(W, H, seed)
    crate(tc, 6, 1, 14, 9, 4, seed); crate(tc, 21, 3, 12, 7, 4, seed + 1)
    for y in range(4, 14):                                                # 덮개 천(오른쪽)
        for x in range(33, 44):
            if y < 6 + (x - 33) * .2: continue
            tc.px(x, y, 'drab', 5 if y < 8 else (4 if (x + y) % 5 else 3))
    box(tc, 3, 13, 45, 24, 3, 'steel', base=3, seed=seed)
    for x in range(4, 44, 6): tc.px(x, 18, 'steel', 6)
    for (wx) in (10, 36):                                                 # 바퀴
        tc.ell(wx, 26, 5, 5, 'cable', lambda x, y, wx=wx: 3 if (x < wx and y < 26) else 2)
        tc.ell(wx, 26, 2, 2, 'steel', 5)
    for i in range(8): tc.px(2 - i * .3, 20 + i * .2, 'steel', 4)          # 끌채
    tc.grain(.04, mats=('drab',))
    return tc.fin(.6, shadow=(24, 30, 22, 2, 60))


# ================================================================ 공장 지구 (앵커 ③)
def transformer(seed=0):
    """변압기 함 2x2칸(32x32): 강철 함(윗면 + 통풍 살 앞면) 위 사기 애자 셋과 굵은 선, 번개 세모 그림판(글자 없음), 호박색 표시등.
    아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 2, 10, 30, 31, 5, 'steel', base=3, seed=seed)
    for y in range(18, 28):
        if y % 2 == 0:
            for x in range(5, 18): tc.px(x, y, 'steel', 1)
    for (x) in (8, 16, 24):                                               # 애자
        for i, t in enumerate((5, 6, 4, 5, 3, 4)): tc.px(x + (i % 2), 9 - i // 2, 'plaster', t)
        tc.px(x, 5, 'plaster', 6)
    cable(tc, 9, 6, 17, 6, sag=2); cable(tc, 17, 6, 25, 6, sag=3)
    tri = [(22, 18), (27, 26), (17, 26)]
    tc.poly(tri, 'warn', 5)
    tc.px(22, 21, 'cable', 1); tc.px(21, 22, 'cable', 1); tc.px(22, 23, 'cable', 1); tc.px(21, 24, 'cable', 1)
    tc.px(26, 14, 'amber', 6)
    tc.grain(.03)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def valve_station(seed=0):
    """밸브 장치 2x2칸(32x32): 땅에서 솟은 굵은 관 둘이 꺾여 이어지고, 붉은 바퀴 밸브 둘·압력계 하나, 이음에서 새는 김. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 1, 24, 31, 32, 3, 'gst', base=4)
    pipe_v(tc, 8, 6, 26, 8, 'steel', step=16)
    pipe_v(tc, 24, 10, 26, 8, 'steel', step=16)
    pipe_h(tc, 8, 25, 9, 6, 'brass', step=16)
    for (vx, vy) in ((8, 15), (24, 18)):
        tc.ell(vx, vy, 5, 5, 'redl', lambda x, y, vx=vx, vy=vy: 5 if (x < vx and y < vy) else 3)
        tc.ell(vx, vy, 3, 3, 'steel', 2)
        tc.px(vx, vy, 'redl', 5)
    FM.gauge(tc, 16, 17, 3, seed)
    tc.grain(.03)
    im = tc.fin(.6, shadow=(16, 30, 14, 2, 60))
    im.alpha_composite(steam(12, 10, seed + 4, 120), (17, 0))
    return im


def pipe_bridge(w=6, seed=0):
    """관 다리 6x5칸(96x80): 양 끝 강철 격자 기둥 둘 위로 굵은 관(지름 12)과 가는 놋쇠 관(지름 6)이 건너가고, 기둥에 사다리.
    기둥 밑동 칸만 막힘, 관 아래로 걸어 지나갈 수 있다(관 칸 걷기 + 가림)."""
    W, H = w * 16, 80; tc = TC(W, H, seed)
    for tx in (4, W - 16):                                                # 격자 기둥
        for y in range(18, 76):
            tc.px(tx, y, 'steel', 5); tc.px(tx + 1, y, 'steel', 4); tc.px(tx + 10, y, 'steel', 3); tc.px(tx + 11, y, 'steel', 2)
        for y0 in range(20, 74, 10):
            for i in range(10):
                tc.px(tx + 1 + i, y0 + i, 'steel', 4); tc.px(tx + 10 - i, y0 + i, 'steel', 2)
        box(tc, tx - 2, 72, tx + 14, 80, 3, 'gst', base=4)
    for x in range(2, W - 2): tc.px(x, 18, 'steel', 6); tc.px(x, 19, 'steel', 4); tc.px(x, 20, 'steel', 2)   # 받침 보
    pipe_h(tc, 0, W, 10, 12, 'steel', step=32)
    pipe_h(tc, 0, W, 24, 6, 'brass', step=16)
    tc.grain(.03)
    return tc.fin(.6)


def gas_tank(seed=0, h=44):
    """가스 저장 탱크 4x5칸(64x80): 회청 도장 큰 강철 원통(리벳 테, 녹 없음 — 쓰는 공장), 낮은 둥근 지붕·난간, 사다리, 받침 고리,
    붉은 띠 한 줄. 아래 두 줄 막힘, 위는 걷기 + 가림."""
    W, H = 64, 80; tc = TC(W, H, seed)
    cx, rx, ry = 32, 28, 10
    ytop = H - 8 - h - ry
    FP.cyl(tc, cx, H - 10, rx + 3, ry + 1.5, 6, 'gst', seed=seed)
    FP.cyl(tc, cx, ytop, rx, ry, h, 'steel', seed=seed + 1)
    for by in range(int(ytop) + 11, int(ytop) + h, 11):
        for x in range(cx - rx, cx + rx):
            u = (x + .5 - cx) / rx
            y = int(by + ry * math.sqrt(max(0, 1 - u * u)) * .9)
            g = tc.get(x, y)
            if g:
                tc.px(x, y, 'steel', g[1] + 1); tc.px(x, y + 1, 'steel', max(1, g[1] - 2))
                if (x - cx + rx) % 5 == 2: tc.px(x, y, 'steel', 6)
    by = int(ytop) + 22                                                   # 붉은 띠
    for x in range(cx - rx, cx + rx):
        u = (x + .5 - cx) / rx; y0 = int(by + ry * math.sqrt(max(0, 1 - u * u)) * .9)
        for j in range(3):
            g = tc.get(x, y0 + j)
            if g: tc.px(x, y0 + j, 'redl', clamp(g[1] - 1, 1, 5))
    for y in range(int(ytop) - int(ry) + 1, int(ytop) + int(ry)):
        for x in range(cx - rx, cx + rx):
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - ytop) / ry) ** 2
            if e <= 1:
                k = 5 if (x < cx and y < ytop) else 4
                if e < .25: k += 1
                if .82 < e: k = 3 if y < ytop else 4
                tc.px(x, y, 'steel', k)
    for a in range(200, 345, 9):
        r = math.radians(a); x = cx + (rx - 2) * math.cos(r); y = ytop + (ry - 1) * math.sin(r)
        tc.px(x, y - 3, 'steel', 5); tc.px(x, y - 2, 'steel', 3); tc.px(x, y - 1, 'steel', 2)
    lx = cx - 16
    for y in range(int(ytop) + 2, H - 10):
        tc.px(lx, y, 'steel', 5); tc.px(lx + 5, y, 'steel', 3)
        if (y - int(ytop)) % 4 == 0:
            for x in range(lx + 1, lx + 5): tc.px(x, y, 'steel', 4)
    tc.grain(.03)
    return tc.fin(.6, shadow=(cx, H - 4, rx + 2, 4, 70))


def coal_pile(seed=0):
    """석탄 더미 2x1칸(32x16): 검은 덩이 무더기(덩이마다 윗왼 빛 한 점), 둘레 흩어진 알. 칸 막힘."""
    tc = TC(32, 16, seed)
    for i in range(60):
        a = _hash(i, 1, seed); b = _hash(i, 2, seed)
        x = 3 + a * 26; yb = 15 - (1 - abs(a - .5) * 2) * 9 * b
        tc.ell(x, yb, 2.2, 1.6, 'cable', lambda xx, yy, x=x, yb=yb: 4 if (xx < x and yy < yb) else 2)
        tc.px(x - 1, yb - 1, 'cable', 6 if _hash(i, 3, seed) > .6 else 5)
    return tc.fin(.7, shadow=(16, 15, 14, 1.4, 55))


def steam_engine(seed=0):
    """증기 기관 3x3칸(48x48): 회색 석재 받침 위 큰 쇠 바퀴(바퀴살 여섯, 테 빛), 옆 눕힌 실린더와 피스톤 막대, 작은 굴뚝 김.
    아래 두 줄 막힘."""
    W, H = 48, 48; tc = TC(W, H, seed)
    box(tc, 2, 36, 46, 48, 4, 'gst', base=4)
    cx, cy, R = 15, 20, 15
    for y in range(cy - R - 1, cy + R + 2):
        for x in range(cx - R - 1, cx + R + 2):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if R - 3 < d <= R:
                k = 5 if (x < cx and y < cy) else (4 if x < cx + 4 else 2)
                if d > R - .8: k -= 1
                tc.px(x, y, 'steel', k)
            elif d < 3: tc.px(x, y, 'brass', 5 if x < cx else 3)
    for i in range(6):
        a = i * math.pi / 3 + .2
        for t in range(3, R - 2):
            x = cx + math.cos(a) * t; y = cy + math.sin(a) * t
            tc.px(x, y, 'steel', 4 if math.cos(a) < 0 else 3)
    FP.cyl(tc, 36, 22, 7, 3, 12, 'steel', seed=seed)                      # 실린더(세운)
    tc.line(cx + 2, cy + 2, 36, 32, 'brass', 5, w=2)                      # 피스톤 막대
    tc.ell(36, 32, 2, 2, 'brass', 4)
    stack_body(tc, 40, 6, 20, r=3, seed=seed + 2, bands=6)
    tc.grain(.03)
    im = tc.fin(.6, shadow=(24, 46, 22, 2.5, 60))
    im.alpha_composite(steam(12, 10, seed + 3, 120), (34, 0))
    return im


def wall_banner(seed=0):
    """벽 걸개 1x2칸(16x32, 덧그림): 쇠 막대에 늘어뜨린 단색 진홍 걸개(문장·글자 없음, 갈매기 끝). 벽 앞면 위에만, 걷기 무관."""
    tc = TC(16, 32, seed)
    flag_banner(tc, 3, 1, 10, 30)
    return tc.fin(.7)


# ================================================================ 화분 나무 · 철 화단 (도시의 초록 — 나무 그림은 버들항 칩셋 원본)
def tree_ironplanter(seed=0):
    """쇠 화분 가로수 2x3칸(32x48): 버들항 칩셋 둥근 활엽수 수관(원본 화소 그대로, 336,512) + 줄기 + 강철 네모 화분(리벳·흙).
    밑동 줄(화분)만 막힘, 수관 칸은 걷기 + 가림."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 5, 37, 27, 47, 4, 'steel', base=3, seed=seed)
    for x in range(7, 25): tc.px(x, 38, 'dark', 3); tc.px(x, 39, 'dark', 2)
    for (x, y) in ((7, 43), (24, 43)): tc.px(x, y, 'steel', 6)
    for y in range(24, 39): tc.px(15, y, 'wood', 4); tc.px(16, y, 'wood', 3); tc.px(17, y, 'wood', 2)
    im = tc.fin(.6, shadow=(16, 46, 12, 2, 60))
    im.alpha_composite(pz.chip(336, 512, 32, 32), (0, 0))
    return im


def hedge_trough(n=3, seed=0):
    """강철 화단 상자 n x 2칸: 리벳 강철 홈통 화분 + 버들항 칩셋 산울타리 결(가지런히 깎은 생울타리). 칸 막힘(아랫줄)."""
    W, H = n * 16, 32; tc = TC(W, H, seed)
    box(tc, 1, 18, W - 1, 32, 3, 'steel', base=3, seed=seed)
    for x in range(4, W - 4, 8): tc.px(x, 26, 'steel', 6)
    im = tc.fin(.6, shadow=(W / 2, 31, W / 2 - 2, 2, 55))
    h = pz.hedge(n); h = h if isinstance(h, Image.Image) else pz.fin(h)
    hh = h.crop((0, 0, min(W, h.width), h.height))
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(hh.crop((0, 0, W - 4, min(18, hh.height))), (2, 2))
    return o
