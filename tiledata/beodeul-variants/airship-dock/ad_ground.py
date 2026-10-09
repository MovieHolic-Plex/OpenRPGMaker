# 비행선 정박 부두 — 바닥 표본 6종(48x48, 3x3 이어 붙여도 이음새 없음). 모두 이 팩 안에 들어간다(버들항 풀·길 칸 없이도 닫힌다).
#   ground-highland-grass : 절벽 위 고지 풀밭(버들항 칩셋 잔디·들풀을 48px 주기 덩이로 섞고, 바람에 누운 풀포기)
#   ground-cliff-rock     : 맨 바위 고원(칩셋 자갈 흙 결을 버들항 돌 램프로, 판 바위 금·이끼 점)
#   ground-cobble-road    : 포석 길(칩셋 회색 둥근 포석 결 그대로, 48px 주기 바큇자국 그늘)
#   ground-cinder-yard    : 석탄재 깔린 마당(칩셋 자갈 흙 결을 그을린 재 램프로, 석탄 부스러기)
#   ground-dock-planks    : 지상 부두 널(남북으로 놓인 바랜 널 + 48px 마다 리벳 쇠 띠)
#   ground-iron-deck      : 기중기·계류 탑 받침 리벳 강철판(16px 판, 놋쇠 띠 48px)
from ad_base import *

def chip16(x, y): return ground.tex(x, y)          # 16x16 RGB 칩셋 결
LAWN = chip16(0, 128); MEAD = chip16(304, 304); SHADE = chip16(112, 2144)
DIRTP = chip16(16, 224); DIRT = chip16(64, 224); COBB = chip16(160, 96); GRAVP = chip16(352, 304)
ROCKT = recolor_arr(DIRTP.astype(float), ST, 3, 5)
CINDT = recolor_arr(DIRTP.astype(float), ST, 2, 4)

def pn(X, Y, sc, seed, period=48): return vnoise(X, Y, sc, seed, per=max(1, int(period / sc)))

def grass_px(X, Y, seed=0):
    """고지 풀: 잔디 바탕에 들풀 덩이(48 주기) + 드문 그늘 풀, 체크 디더 경계."""
    n = pn(X, Y, 16, 401 + seed) * .7 + pn(X, Y, 8, 402 + seed) * .3
    lx, ly = X % 16, Y % 16
    th = ((X + Y) % 2) * .04
    if n + th > .60: c = MEAD[ly, lx]
    elif n + th < .16: c = SHADE[ly, lx]
    else: c = LAWN[ly, lx]
    c = tuple(int(v) for v in c)
    # 바람에 누운 풀포기(동쪽으로 눕는 3px 잎) — 48 주기 고정 자리
    h = hash2((X % 48) // 6, (Y % 48) // 6, 409 + seed)
    if h > .80:
        ox = int(hash2((X % 48) // 6, (Y % 48) // 6, 410) * 3); oy = int(hash2((X % 48) // 6, (Y % 48) // 6, 411) * 3)
        u, v = (X % 6) - ox, (Y % 6) - oy
        if (u, v) in ((0, 2), (1, 1), (2, 1)): c = LF[5]
        elif (u, v) in ((0, 3), (1, 2)): c = LF[3]
    return c

def rock_px(X, Y, seed=0):
    """맨 바위: 자갈 흙 결을 돌 램프로 옮긴 바탕 + 큰 판 바위 금(48 주기 잡음의 등고선 한 줄) + 드문 이끼."""
    c = tuple(int(v) for v in ROCKT[Y % 16, X % 16])
    n = pn(X, Y, 12, 421 + seed)
    if abs(n - .5) < .022: c = ST[2]                                          # 판 바위 금
    elif abs(n - .5) < .045 and n > .5: c = mix(c, ST[5], .5)                 # 금 위쪽 모 빛
    m = pn(X, Y, 8, 423 + seed)
    if m > .76 and hash2(X % 48, Y % 48, 424) > .55: c = LF[3] if hash2(Y % 48, X % 48, 425) < .6 else LF[2]
    return c

def cobble_px(X, Y, seed=0):
    c = tuple(int(v) for v in COBB[Y % 16, X % 16])
    n = pn(X, Y, 16, 431 + seed)
    if n > .66: c = mul(c, .9)                                                 # 밟혀 짙어진 자리
    return c

def cinder_px(X, Y, seed=0):
    c = tuple(int(v) for v in CINDT[Y % 16, X % 16])
    h = hash2(X % 48, Y % 48, 441 + seed)
    if h > .985: c = COAL[1]
    elif h > .975: c = COAL[4]
    n = pn(X, Y, 12, 443 + seed)
    if n > .7: c = mix(c, COAL[2], .35)
    return c

_PL = terrain.CH.crop((288, 80, 336, 128)).convert('RGB')
_PLA = np.array(_PL).astype(int).sum(axis=2); _PLV = np.unique(_PLA)
def plank_px(X, Y, seed=0):
    """지상 부두 널: 칩셋 세로 널(48x48) 밝기 순위를 PLANK 2..5 로, 널마다 바램 다르게, 48px 마다 리벳 박은 쇠 띠(가로)."""
    lx, ly = X % 48, Y % 48
    if ly in (22, 23, 24):                                                      # 쇠 띠(윗줄 빛·아랫줄 그늘)
        k = {22: 5, 23: 4, 24: 2}[ly]
        if ly == 23 and lx % 8 == 3: k = 6
        return STEEL[k]
    if ly == 25: return PLANK[1]
    v = _PLA[ly, lx]; r = np.searchsorted(_PLV, v) / max(1, len(_PLV) - 1)
    t = 2 + int(round(r * 3.2))
    if hash2(lx // 6, 0, 451 + seed) < .3: t -= 1
    c = PLANK[clamp(t)]
    if pn(X, Y, 8, 452) > .8: c = mix(c, (52, 44, 40), .35)                   # 젖은 얼룩
    return c

def iron_px(X, Y, seed=0):
    lx, ly = X % 48, Y % 48
    row, col = ly // 16, lx // 16; u, v = lx % 16, ly % 16
    h = hash2(col, row, 461 + seed)
    k = 3 + (1 if h > .7 else 0) - (1 if h < .2 else 0)
    if v == 15 or u == 15: k = 1
    elif v == 0 or u == 0: k += 1
    if (u, v) in ((2, 2), (13, 2), (2, 13), (13, 13)): return STEEL[6]
    if (u, v) in ((3, 3), (14, 3), (3, 14), (14, 14)): return STEEL[1]
    if (u + 2 * v) % 7 == 0 and 4 < u < 12 and 4 < v < 12: k -= 1             # 미끄럼 돌기
    c = STEEL[clamp(k)]
    if pn(X, Y, 16, 463) > .78 and hash2(X % 48, Y % 48, 464) < .5: c = mix(c, RUST[3], .4)   # 녹 점
    return c

GROUNDS = [
    ('ground-highland-grass', grass_px, '절벽 위 고지 풀밭', '버들항 칩셋 잔디·들풀·그늘 풀을 48px 덩이로 섞고 바람에 누운 풀포기를 찍은 고지 풀밭 3×3 표본.',
     '맵 전체 아래층 바탕(맨 먼저 채운다). 길·마당 둘레, 절벽 가장자리 풀 술 밑.'),
    ('ground-cliff-rock', rock_px, '맨 바위 고원', '칩셋 자갈 흙 결을 버들항 돌 램프로 옮긴 회색 바위에 판 바위 금·이끼 점 3×3 표본.',
     '절벽 가까운 바위 고원·계류 탑 둘레. 풀밭 위에 덩이로(사각형 금지 — 가장자리는 풀밭과 엇갈리게 칸을 들쭉날쭉).'),
    ('ground-cobble-road', cobble_px, '포석 길', '버들항 칩셋 회색 둥근 포석 결에 밟혀 짙어진 자리 3×3 표본.',
     '마을 쪽에서 부두로 들어오는 길(폭 2~3칸)·관제 오두막 앞. 끝은 마당(cinder)·부두 널과 잇는다.'),
    ('ground-cinder-yard', cinder_px, '석탄재 마당', '칩셋 자갈 흙 결을 그을린 재 램프로 옮기고 석탄 부스러기를 흩은 짙은 회갈 마당 3×3 표본.',
     '석탄 창고·짐 기중기 둘레 작업 마당. 위에 autotile-coal-dust 를 덩이로.'),
    ('ground-dock-planks', plank_px, '지상 부두 널', '남북으로 놓인 바랜 회갈 널(칩셋 널 결) + 48px 마다 리벳 박은 쇠 띠 3×3 표본.',
     '절벽 끝 부두 마당·잔교 뿌리 바닥. 위에 autotile-plank-puddle(빗물)을 덩이로.'),
    ('ground-iron-deck', iron_px, '리벳 강철 받침', '16px 강철판(모서리 리벳·미끄럼 돌기·판마다 톤)과 녹 번짐 3×3 표본.',
     '계류 탑·기중기·급수탑 밑 받침 바닥(물체 발자국보다 1칸 넓게). 맵 바탕으로 넓게 깔지 않는다.'),
]

def ground_img(fn): return mk(lambda x, y: fn(x, y), 48, 48)
def cell_of_ground(fn, cx, cy): return mk(lambda x, y: fn(cx * 16 + x, cy * 16 + y))
