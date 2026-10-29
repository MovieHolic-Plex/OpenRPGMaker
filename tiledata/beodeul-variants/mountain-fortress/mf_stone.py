# 산악 요새 석조 조각 — 버들항 성 석재(castle6.ash: 마름돌 줄쌓기, 1px 줄눈, 돌마다 톤, 윗왼 밝은 모·아래오른 어두운 모, 칩셋 결)를
# 조금 어둡게(k) 써서 산 바위(mf_ground.MR)와 갈라 보이게 한다. 3/4 시점(윗면+앞면, 옆면 없음), 빛 왼쪽 위, pz.fin 안쪽 윤곽.
# 글자·문장·상표 없음 — 부조는 기하 무늬(갈매기·마름모·계단)만. 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import mf_ground as G                     # 경로·팔레트
import pz
from castle6 import ash, merlons, slit, arch_window
from roman import ST, mul, mix
from v6pieces import ctex
from px2 import _hash
import terrain
WD = terrain.WD
MR = G.MR
IRON = [(16, 18, 24), (38, 42, 52), (64, 70, 79), (94, 101, 114), (131, 139, 152), (173, 180, 192), (221, 226, 234)]
FIRE = [(58, 10, 4), (122, 28, 6), (192, 60, 12), (236, 108, 20), (252, 164, 44), (255, 216, 96), (255, 250, 200)]
K = 0.9                                   # 요새 돌 밝기(버들항 성보다 조금 어둡게)

def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(int(v) for v in c[:3]) + (a,)
def get(px, W, H, x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < H else (0, 0, 0, 0)
def H_(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 3, 9301)

def stone(X, Y, k=K, bw=16, bh=8, seed=0): return ash(X, Y, k, bw, bh, seed)
def top_face(X, Y, k=K):
    """마름돌 윗면(갓돌·성가퀴 윗면): 밝은 판석."""
    c = ctex(192, 176, X, Y); return mul(c, k * 1.02)
def coping(px, W, H, y0, x0, x1, k=K, depth=3):
    """갓돌: 윗면 depth 화소(밝음) + 앞 모서리 1화소 그늘."""
    for x in range(x0, x1):
        for j in range(depth):
            put(px, W, H, x, y0 + j, mul(ST[6] if j == 0 else ST[5], k))
        put(px, W, H, x, y0 + depth, mul(ST[3], k))

def chevron_band(px, W, H, x0, x1, y0, h, k=K, seed=0):
    """갈매기(<<<) 부조 띠: 홈은 어둡게, 솟은 면은 위쪽이 밝다."""
    for y in range(y0, y0 + h):
        for x in range(x0, x1):
            u = (x - x0 + abs(y - (y0 + h // 2)) * 1) % 8
            c = mul(ST[5], k) if u < 3 else (mul(ST[3], k) if u == 3 else mul(ST[4], k))
            if y == y0: c = mul(ST[6], k)
            if y == y0 + h - 1: c = mul(ST[2], k)
            put(px, W, H, x, y, c)

def diamond_band(px, W, H, x0, x1, y0, h, k=K):
    """마름모 줄 부조: 마름모마다 윗왼 반 밝음·아래오른 반 그늘, 가운데 오목."""
    cy = y0 + h / 2.0; r = h / 2.0 - 0.5; step = int(h + 1)
    for y in range(y0, y0 + h):
        for x in range(x0, x1):
            cx = x0 + ((x - x0) // step) * step + step / 2.0
            d = abs(x + 0.5 - cx) + abs(y + 0.5 - cy)
            if d <= r:
                c = mul(ST[6] if (x + 0.5 - cx) + (y + 0.5 - cy) < 0 else ST[3], k)
                if d < 1.6: c = mul(ST[2], k)
            else:
                c = mul(ST[4], k)
            if y == y0: c = mul(ST[5], k)
            if y == y0 + h - 1: c = mul(ST[2], k)
            put(px, W, H, x, y, c)

def rock_fringe(px, W, H, pts, seed=1):
    """석조 둘레를 바위가 덮는 들쭉날쭉한 띠(산에 박힌 느낌): pts = 띠를 그릴 (x,y) 화소들."""
    for (x, y) in pts:
        t = 3 + int(_hash(x // 3, y // 3, seed) * 3)
        c = MR[t]
        if _hash(x, y, seed + 1) < 0.15: c = MR[2]
        put(px, W, H, x, y, c)

# ================================================================ 거대 석문 (12x9칸)
def stone_gate():
    """바위산 절벽에 박힌 난쟁이 석문: 좌우 큰 사각 기둥(윗면 갓돌 보임), 기둥 사이 들보(갈매기 부조 띠),
    위로 계단꼴 박공 3단(단마다 밝은 윗면), 안쪽 움푹 들어간 벽(그늘)과 문틀(마름모 부조), 닫힌 두 짝 돌문(쇠띠·징·고리),
    아래 두 단 돌계단. 둘레는 산 바위가 덮어 절벽에 박혀 보인다."""
    W, H = 192, 144; o = new(W, H); px = o.load()
    PL0, PL1, PR0, PR1 = 10, 46, 146, 182            # 기둥 x
    yL = 30                                          # 들보 윗선(기둥 머리)
    # 계단 박공 3단 (윗면 + 앞면)
    for (x0, x1, yt, yb) in ((28, 164, 18, 30), (54, 138, 8, 18), (78, 114, 0, 8)):
        for y in range(yt, yb):
            for x in range(x0, x1):
                if y < yt + 3: c = top_face(x, y)                       # 윗면
                elif y == yt + 3: c = mul(ST[3], K)
                else: c = stone(x, y, seed=3)
                put(px, W, H, x, y, c)
        for y in range(yt + 4, yb):                                   # 박공 단 양끝 모(빛 왼쪽)
            put(px, W, H, x0, y, mul(ST[6], K)); put(px, W, H, x1 - 1, y, mul(ST[2], K))
    # 맨 위 단 가운데 계단 홈 무늬(기하)
    for y in range(3, 8):
        for x in range(88, 104):
            if (x - 88) % 4 == 0: put(px, W, H, x, y, mul(ST[2], K))
    # 들보(기둥 사이 + 기둥 위를 잇는 큰 돌)
    for y in range(yL, 56):
        for x in range(PL0, PR1):
            c = stone(x, y, bw=24, bh=9, seed=7)
            put(px, W, H, x, y, c)
    coping(px, W, H, yL - 1, PL0 - 2, PR1 + 2)
    chevron_band(px, W, H, PL1 + 2, PR0 - 2, 38, 9)
    for x in range(PL0, PR1): put(px, W, H, x, 55, mul(ST[2], K))
    # 기둥 (앞면, 머리 장식 띠, 받침)
    for (x0, x1) in ((PL0, PL1), (PR0, PR1)):
        for y in range(56, 128):
            for x in range(x0, x1):
                c = stone(x, y, bw=12, bh=10, seed=11 + x0)
                if x == x0: c = mul(ST[6], K)
                elif x == x0 + 1: c = mix(c, ST[6], 0.4)
                elif x >= x1 - 2: c = mul(c, 0.72)
                put(px, W, H, x, y, c)
        for y in range(56, 64):                                       # 머리 띠(기둥 머리 장식)
            for x in range(x0 - 2, x1 + 2):
                c = mul(ST[5] if y < 58 else (ST[3] if y == 63 else ST[4]), K)
                if (x - x0) % 6 == 0 and 58 <= y < 63: c = mul(ST[2], K)
                put(px, W, H, x, y, c)
        for x in range(x0 + 6, x1 - 6):                               # 세로 홈 두 줄(기둥 몸통 부조)
            if (x - x0 - 6) % 8 in (0,):
                for y in range(68, 116): put(px, W, H, x, y, mul(ST[2], K)); put(px, W, H, x + 1, y, mul(ST[5], K))
        for y in range(118, 130):                                     # 받침(조금 넓다)
            for x in range(x0 - 3, x1 + 3):
                c = top_face(x, y) if y < 121 else (mul(ST[3], K) if y == 121 else stone(x, y, bw=10, bh=4, seed=13))
                if y == 129: c = mul(ST[2], K)
                put(px, W, H, x, y, c)
    # 안쪽 벽(움푹 들어간 면: 그늘) + 문틀
    for y in range(56, 130):
        for x in range(PL1, PR0):
            c = stone(x, y, k=0.62, bw=16, bh=8, seed=17)
            if y < 60: c = mul(ST[1], 1.0)                             # 들보 밑 그늘
            put(px, W, H, x, y, c)
    for x in range(PL1, PL1 + 3):                                     # 왼 기둥 안쪽 볼(그늘), 오른 기둥 안쪽 볼(빛)
        for y in range(56, 130): put(px, W, H, x, y, mul(ST[2], 0.9))
    for x in range(PR0 - 3, PR0):
        for y in range(56, 130): put(px, W, H, x, y, mul(ST[4], 0.85))
    DX0, DX1, DY0 = 64, 128, 70                                       # 문 구멍
    for y in range(DY0 - 10, 130):                                    # 문틀(마름모 부조) 두께 6
        for x in range(DX0 - 7, DX1 + 7):
            if DX0 <= x < DX1 and y >= DY0: continue
            if y < DY0 - 10: continue
            c = stone(x, y, bw=8, bh=6, seed=19)
            if x < DX0 - 5: c = mul(ST[6], K)
            if x >= DX1 + 5: c = mul(ST[2], K)
            put(px, W, H, x, y, c)
    diamond_band(px, W, H, DX0 - 7, DX1 + 7, DY0 - 10, 8)
    for x in range(DX0 - 7, DX1 + 7): put(px, W, H, x, DY0 - 2, mul(ST[5], K)); put(px, W, H, x, DY0 - 1, mul(ST[2], K))
    # 돌문 두 짝: 어두운 산 바위 돌(MR 2~4), 짝마다 움푹한 판 두 칸(윗왼 그늘·아래오른 빛 = 판이 들어갔다),
    # 판 가운데 계단 마름모 부조, 쇠띠 둘(징 박힘), 고리 손잡이, 가운데 이음 금
    lw = (DX1 - DX0) // 2
    for y in range(DY0, 128):
        for x in range(DX0, DX1):
            leaf = 0 if x < DX0 + lw else 1
            lx = x - (DX0 + leaf * lw)
            t = 3
            if lx < 2: t = 5 if leaf == 0 else 4
            if lx >= lw - 2: t = 2
            if y < DY0 + 2: t = 2
            panels = ((DY0 + 5, DY0 + 24), (DY0 + 32, 121))
            for (p0, p1) in panels:
                if 5 <= lx < lw - 5 and p0 <= y < p1:
                    t = 2
                    if lx == 5 or y == p0: t = 1                        # 판 윗왼 = 그늘
                    elif lx == lw - 6 or y == p1 - 1: t = 4             # 판 아래오른 = 빛
                    else:
                        # 계단 마름모 부조(판 가운데)
                        cxp = lw / 2.0; cyp = (p0 + p1) / 2.0
                        d = abs(lx + 0.5 - cxp) / (lw / 2 - 7) + abs(y + 0.5 - cyp) / ((p1 - p0) / 2 - 3)
                        if d < 1.0:
                            ring = int(d * 3)
                            t = (4, 3, 4)[min(2, ring)] if (lx + 0.5 - cxp) + (y + 0.5 - cyp) < 0 else (3, 2, 3)[min(2, ring)]
                        elif _hash(x, y, 5) > 0.95: t = 3
            c = MR[t]
            if y in (DY0 + 27, DY0 + 28, 124, 125) or (y in (DY0 + 26, DY0 + 29) and False):   # 쇠띠
                c = IRON[4] if y in (DY0 + 27, 124) else IRON[2]
                if (lx % 6) == 3: c = IRON[6] if y in (DY0 + 27, 124) else IRON[3]
            put(px, W, H, x, y, c)
    for y in range(DY0, 128): put(px, W, H, (DX0 + DX1) // 2 - 1, y, MR[1]); put(px, W, H, (DX0 + DX1) // 2, y, MR[1])
    for (cx, cy) in ((90, 100), (102, 100)):                           # 고리 손잡이
        for a in range(0, 360, 30):
            x = int(round(cx + 3 * math.cos(math.radians(a)))); y = int(round(cy + 3.5 * math.sin(math.radians(a))))
            put(px, W, H, x, y, IRON[5] if a > 180 else IRON[2])
        put(px, W, H, cx, cy - 4, IRON[6])
    for x in range(DX0, DX1): put(px, W, H, x, 127, MR[1])
    # 계단 두 단(넓은 디딤판, 앞에서 본 챌판)
    for y in range(130, 144):
        for x in range(2, 190):
            s_ = (y - 130) % 7
            if (y < 137 and (x < 6 or x >= 186)): continue
            c = top_face(x, y) if s_ < 3 else (mul(ST[3], K) if s_ == 3 else stone(x, y, bw=12, bh=4, seed=23))
            if s_ == 6: c = mul(ST[2], K)
            put(px, W, H, x, y, c)
    # 둘레 바위: 박공·들보 위 모서리와 기둥 바깥으로 바위가 감싼다(들쭉날쭉)
    fr = []
    for y in range(0, 130):
        for x in range(W):
            if px[x, y][3]: continue
            near = any(px[xx, yy][3] for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= xx < W and 0 <= yy < H)
            if not near: continue
            d = int(2 + _hash(x // 4, y // 4, 31) * 4)
            for j in range(d):
                for xx, yy in ((x - j if x < 96 else x + j, y),):
                    if 0 <= xx < W and not px[xx, yy][3]: fr.append((xx, yy))
    im = pz.fin(o)
    ip = im.load()
    rock_fringe(ip, W, H, [p for p in fr if p[1] < 60 or p[0] < PL0 or p[0] >= PR1], 7)
    return im

# ================================================================ 감시탑 (3x7칸)
def gate_tower(flip=False, brazier=False, broken=False):
    """석문 양옆 네모 감시탑: 꼭대기 성가퀴(윗면 판석 + 앞 성가퀴 돌기), 몸통 마름돌, 층 띠 둘, 화살구멍 셋, 작은 아치 창(불빛),
    밑 받침이 넓어진다(경사 받침). broken=성가퀴 하나가 깨졌다, brazier=꼭대기 화로."""
    W, H = 48, 112; o = new(W, H); px = o.load()
    x0, x1 = 3, 45
    for y in range(0, 14):                                           # 꼭대기 윗면(판석) — 뒤 성가퀴 낮은 턱
        for x in range(x0, x1):
            c = top_face(x, y)
            if y < 2: c = mul(ST[5], K) if y == 0 else mul(ST[3], K)
            put(px, W, H, x, y, c)
    merlons(px, W, H, 8, x0, x1, step=8, mw=5, k=K)
    if broken:
        for y in range(8, 14):
            for x in range(x0 + 24, x0 + 29): px[x, y] = (0, 0, 0, 0)
        for (x, y) in ((x0 + 25, 12), (x0 + 26, 12), (x0 + 27, 13)): put(px, W, H, x, y, mul(ST[4], K))
    for y in range(14, 104):                                         # 몸통
        for x in range(x0, x1):
            c = stone(x, y, seed=41 + (7 if flip else 0))
            if x == x0: c = mul(ST[6], K)
            elif x >= x1 - 2: c = mul(c, 0.7)
            if y < 17: c = mul(ST[1], 1.0) if y == 14 else mul(c, 0.7)          # 성가퀴 밑 그늘
            put(px, W, H, x, y, c)
    for yb in (40, 72):                                              # 층 띠(돌출 돌림띠)
        for x in range(x0 - 1, x1 + 1):
            put(px, W, H, x, yb, mul(ST[6], K)); put(px, W, H, x, yb + 1, mul(ST[4], K)); put(px, W, H, x, yb + 2, mul(ST[2], K))
    for (x, y) in ((x0 + 10, 22), (x0 + 30, 22), (x0 + 20, 80)):       # 화살구멍
        slit(px, W, H, x, y, 10)
    arch_window(px, W, H, x0 + 18, 48, w=6, h=11, k=K)
    for y in range(96, 112):                                          # 경사 받침
        k_ = y - 96
        for x in range(x0 - k_ // 5, x1 + k_ // 5):
            c = stone(x, y, bw=12, bh=5, seed=43)
            if y == 96: c = mul(ST[5], K)
            if y >= 110: c = mul(ST[2], K) if y == 110 else mul(ST[1], 1)
            put(px, W, H, x, y, c)
    im = pz.fin(o)
    if brazier:
        b = brazier_iron(small=True); im.alpha_composite(b, (W // 2 - b.width // 2 - 1, 0))
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im

# ================================================================ 성벽 (윗면 통로 + 성가퀴 + 앞면 2줄)
def wall_seg(n=4, seed=0, slits=True, drain=False, end=None):
    """성벽 n칸 x 3줄: 줄 0 = 성벽 위 통로(판석, 뒤 낮은 턱), 앞 가장자리 성가퀴(윗면 밝음·홈 그늘), 줄 1~2 = 앞면 마름돌(줄눈·돌마다 톤),
    아래 받침 띠·발치 그늘. end='W'/'E' = 그쪽 끝이 바위에 묻힌다(산 바위 덩이가 벽 끝을 덮는다)."""
    W = n * 16; H = 48; o = new(W, H); px = o.load()
    for y in range(H):
        for x in range(W):
            if y < 2: c = mul(ST[5], K) if y == 0 else mul(ST[3], K)
            elif y < 11: c = top_face(x, y)
            elif y < 16: c = None
            elif y < H - 5: c = stone(x, y - 16, seed=seed)
            elif y < H - 2: c = mix(stone(x, y, bw=12, bh=4, seed=seed + 1), ST[4], 0.25)
            else: c = mul(ST[3], K) if y == H - 2 else mul(ST[2], K)
            if c is not None: put(px, W, H, x, y, c)
    merlons(px, W, H, 10, k=K)
    for y in range(16, 19):                                              # 성가퀴 밑 그늘
        for x in range(W):
            r, g, b, a = px[x, y]
            if a: px[x, y] = mul((r, g, b), 0.72) + (255,)
    if slits:
        for k in range(n):
            if k % 2 == 1: slit(px, W, H, k * 16 + 7, 22, 9)
    if drain:                                                            # 물 빠지는 홈(돌 주둥이 + 아래 젖은 자국)
        x = W // 2 - 2
        for j in range(4): put(px, W, H, x + j, 34, mul(ST[6], K)); put(px, W, H, x + j, 35, mul(ST[2], K))
        for y in range(36, H - 3):
            if _hash(x, y, 3) > 0.3: put(px, W, H, x + 1, y, mul(px[x + 1, y][:3], 0.7)); put(px, W, H, x + 2, y, mul(px[x + 2, y][:3], 0.8))
    im = pz.fin(o)
    if end:
        ip = im.load()
        for y in range(H):
            depth = 10 + int(6 * math.sin(y * 0.21) + _hash(y // 3, 1, 9) * 6)
            for j in range(depth):
                x = j if end == 'W' else W - 1 - j
                t = 3 + int(_hash(x // 3, y // 3, 5) * 3)
                if j == depth - 1: t = 2 if end == 'E' else 5
                put(ip, W, H, x, y, MR[t])
    return im

def wall_rubble_end(seed=3):
    """성벽 끝 무너진 토막(3x3): 왼쪽은 온전한 높이, 오른쪽으로 줄이 계단꼴로 무너지고 돌무더기로 끝난다."""
    W, H = 48, 48; o = new(W, H); px = o.load()
    def top_at(x): return 16 + max(0, (x - 14)) * 0.9 + (_hash(x // 5, 1, seed) * 4 if x > 14 else 0)
    for x in range(W):
        yt = int(top_at(x))
        if yt >= H - 8: continue
        for y in range(yt, H):
            if y < H - 5: c = stone(x, y - 16, seed=seed)
            elif y < H - 2: c = mix(stone(x, y, bw=12, bh=4, seed=seed + 1), ST[4], 0.25)
            else: c = mul(ST[3], K) if y == H - 2 else mul(ST[2], K)
            if y == yt: c = mul(ST[6], K)
            elif y == yt + 1: c = mul(ST[4], K)
            put(px, W, H, x, y, c)
    for y in range(0, 16):                                              # 왼쪽 끝은 통로 윗면과 성가퀴 하나가 남았다
        for x in range(0, 14):
            if y < 2: c = mul(ST[5], K) if y == 0 else mul(ST[3], K)
            elif y < 11: c = top_face(x, y)
            else: continue
            put(px, W, H, x, y, c)
    merlons(px, W, H, 10, 0, 14, k=K)
    im = pz.fin(o)
    rub = rubble_pile(26, 18, seed + 4)
    im.alpha_composite(rub, (W - 28, H - 18))
    return im

def rubble_pile(w=32, h=20, seed=5, k=K):
    """떨어진 마름돌 무더기: 크고 작은 각진 돌(윗면 밝음·앞면 결·아래 그늘), 사이 부스러기."""
    o = new(w, h); px = o.load()
    import random
    r = random.Random(seed)
    blocks = []
    for i in range(9):
        bw = r.randint(5, 10); bh = r.randint(3, 6)
        x = r.randint(0, w - bw); y = h - bh - int(r.random() * (h - bh) * (1 - abs(x + bw / 2 - w / 2) / (w / 2)) * 0.9)
        blocks.append((y + bh, x, y, bw, bh))
    for _, x, y, bw, bh in sorted(blocks):
        d = max(2, bh // 2)
        for yy in range(y, y + bh):
            for xx in range(x, x + bw):
                if (xx in (x, x + bw - 1)) and (yy in (y, y + bh - 1)) and r.random() < 0.7: continue
                c = mul(ST[6] if yy < y + 2 else (ST[5] if xx < x + bw - 2 else ST[4]), k) if yy < y + d else stone(xx, yy, k=k * 0.92, bw=bw, bh=bh, seed=seed)
                if yy == y + d: c = mul(ST[3], k)
                put(px, w, h, xx, yy, c)
    for i in range(14):
        x = r.randint(0, w - 2); y = r.randint(h // 2, h - 2)
        if px[x, y][3]: continue
        put(px, w, h, x, y, mul(ST[5], k)); put(px, w, h, x + 1, y, mul(ST[4], k)); put(px, w, h, x, y + 1, mul(ST[2], k))
    return pz.fin(o)

# ================================================================ 망루 (성벽 위 네모 돌출 탑, 3x5칸)
def bastion(seed=0):
    """성벽 모퉁이·중간 망루: 성벽보다 2줄 높고 앞으로 반 칸 튀어나왔다. 윗면 판석 + 성가퀴, 앞면 마름돌, 화살구멍 둘, 경사 받침."""
    W, H = 48, 80; o = new(W, H); px = o.load()
    x0, x1 = 2, 46
    for y in range(0, 14):
        for x in range(x0, x1):
            c = top_face(x, y)
            if y < 2: c = mul(ST[5], K) if y == 0 else mul(ST[3], K)
            put(px, W, H, x, y, c)
    merlons(px, W, H, 8, x0, x1, step=9, mw=6, k=K)
    for y in range(14, 72):
        for x in range(x0, x1):
            c = stone(x, y, seed=51 + seed)
            if x == x0: c = mul(ST[6], K)
            elif x >= x1 - 2: c = mul(c, 0.7)
            if y < 17: c = mul(c, 0.7)
            put(px, W, H, x, y, c)
    for x in range(x0 - 1, x1 + 1):
        put(px, W, H, x, 30, mul(ST[6], K)); put(px, W, H, x, 31, mul(ST[4], K)); put(px, W, H, x, 32, mul(ST[2], K))
    slit(px, W, H, x0 + 12, 40, 12); slit(px, W, H, x0 + 30, 40, 12)
    for y in range(64, 80):
        k_ = y - 64
        for x in range(x0 - k_ // 4, x1 + k_ // 4):
            c = stone(x, y, bw=12, bh=5, seed=53)
            if y == 64: c = mul(ST[5], K)
            if y >= 78: c = mul(ST[2], K) if y == 78 else mul(ST[1], 1)
            put(px, W, H, x, y, c)
    return pz.fin(o)

# ================================================================ 성문 통로(도개교 머리, 5x4칸)
def wall_gatehouse():
    """성벽 가운데 성문 통로: 3칸 폭 반원 아치(안쪽 어둠 + 올려 둔 쇠창살 이빨), 좌우 1칸 기둥, 위 성가퀴,
    아치 머리 양쪽에 도개교 쇠사슬이 들어가는 구멍(쇠 고리). 가운데 3칸이 걷는 통로."""
    W, H = 80, 64; o = new(W, H); px = o.load()
    cx = 40; ax0, ax1 = 16, 64; spring = 40; rx = 24; ry = 18
    def open_(x, y): return ax0 <= x < ax1 and y >= spring - ry and ((x + 0.5 - cx) ** 2 / rx ** 2 + (max(0, spring - (y + 0.5))) ** 2 / ry ** 2 < 1)
    for y in range(H):
        for x in range(W):
            if y < 2: c = mul(ST[5], K) if y == 0 else mul(ST[3], K)
            elif y < 11: c = top_face(x, y)
            elif y < 16: c = None
            else:
                if open_(x, y) and y >= 22: continue
                c = stone(x, y - 16, seed=61)
                e = (x + 0.5 - cx) ** 2 / (rx + 4) ** 2 + (max(0, spring - (y + 0.5))) ** 2 / (ry + 4) ** 2
                if e < 1 and not open_(x, y) and y < spring + 1:           # 아치 쐐기돌
                    ang = math.degrees(math.atan2(spring - (y + 0.5), x + 0.5 - cx)); c = mul(ST[6] if x < cx else ST[4], K)
                    if int(ang + 180) % 15 < 2: c = mul(ST[3], K)
                if y >= H - 3: c = mul(ST[3], K) if y == H - 3 else mul(ST[2], K)
            if c is not None: put(px, W, H, x, y, c)
    merlons(px, W, H, 10, k=K)
    for y in range(16, H):
        for x in range(ax0, ax1):
            if not open_(x, y) or y < 22: continue
            d = min(1, (y - 22) / 30)
            c = mul(ST[2], 0.55 + 0.25 * d)
            if not open_(x, y - 4): c = mul(ST[3], 0.8 if x < cx else 0.6)    # 아치 안 볼
            if y >= H - 10: c = mul(top_face(x, y), 0.5 + 0.03 * (y - (H - 10)))   # 통로 바닥(안쪽 그늘)
            put(px, W, H, x, y, c)
            if y < spring - 2 and open_(x, y - 4) and ((x - ax0) % 5 == 2 or (y - 22) % 5 == 2):   # 올려 둔 쇠창살
                put(px, W, H, x, y, IRON[3] if (x - ax0) % 5 == 2 else IRON[2])
    for x in range(ax0, ax1):
        if (x - ax0) % 5 == 2 and open_(x, spring - 2) and open_(x, spring - 6):
            put(px, W, H, x, spring - 2, IRON[5]); put(px, W, H, x, spring - 1, IRON[4])
    im = pz.fin(o); ip = im.load()
    for hx_ in (10, 70):                                                     # 쇠사슬 구멍 고리
        for a in range(0, 360, 40):
            put(ip, W, H, int(round(hx_ + 2.5 * math.cos(math.radians(a)))), int(round(26 + 2.5 * math.sin(math.radians(a)))), IRON[5] if a > 180 else IRON[2])
        put(ip, W, H, hx_, 26, (8, 8, 12))
    return im

# ================================================================ 쇠사슬 도개교 (3x5칸: 아래 4줄 = 골짜기 위 다리판, 위 1줄 = 성문으로 오르는 사슬)
def chain(px, W, H, x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for i in range(n + 1):
        t = i / max(1, n); x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t))
        k = i % 4
        if k == 0: put(px, W, H, x, y, IRON[5]); put(px, W, H, x + 1, y, IRON[2])
        elif k == 1: put(px, W, H, x, y, IRON[4])
        elif k == 2: put(px, W, H, x, y, IRON[3]); put(px, W, H, x - 1, y, IRON[5]); put(px, W, H, x + 1, y, IRON[1])
        else: put(px, W, H, x, y, IRON[4])

def drawbridge():
    """내린 도개교: 골짜기를 건너는 두꺼운 널(가로 널, 4px 마다 줄), 양옆 테 기둥(두꺼운 들보), 쇠띠 셋,
    바깥 끝(남) 모서리 쇠고리에서 성문 쪽(북) 위로 오르는 쇠사슬 둘, 남쪽 끝 널 두께 앞면과 골짜기로 지는 그늘."""
    W, H = 48, 80; o = new(W, H); px = o.load()
    top = 14
    for y in range(top, H - 3):
        for x in range(W):
            yy = y - top
            if x < 4 or x >= W - 4:
                e = x if x < 4 else W - 1 - x
                c = WD[2] if e == 0 else (WD[5] if x < 4 else WD[3]) if e < 3 else WD[4]
            else:
                c = WD[5] if yy % 5 else WD[2]
                if yy % 5 == 1: c = WD[6] if (x * 5 + yy) % 17 else WD[4]
                if yy % 5 == 4: c = WD[4]
                if (x * 7 + yy * 3) % 23 == 0: c = WD[3]
            if yy in (8, 32, 56) and 3 <= x < W - 3: c = IRON[4] if x % 6 else IRON[6]
            put(px, W, H, x, y, c)
    for y in range(H - 3, H):                                           # 남쪽 끝 널 두께
        for x in range(W): put(px, W, H, x, y, WD[3] if y == H - 3 else WD[2])
    for x in range(W): put(px, W, H, x, top, WD[2])
    for (x, y) in ((2, H - 6), (W - 3, H - 6)):                           # 바깥 끝 쇠고리
        put(px, W, H, x, y, IRON[6]); put(px, W, H, x, y + 1, IRON[3])
    im = pz.fin(o); ip = im.load()
    chain(ip, W, H, 2, H - 7, 3, 0)
    chain(ip, W, H, W - 3, H - 7, W - 4, 0)
    return im

# ================================================================ 골짜기 널다리 (4x2칸, 동서로 건넘)
def plank_bridge():
    """좁은 골짜기를 건너는 널다리: 세로 널(4px), 양옆 밧줄 난간(기둥 4개, 밧줄 처짐), 양끝 받침 돌."""
    W, H = 64, 32; o = new(W, H); px = o.load()
    y0, y1 = 12, 28
    for y in range(y0, y1):
        for x in range(4, W - 4):
            c = WD[5] if (x - 4) % 4 else WD[2]
            if (x - 4) % 4 == 1: c = WD[6] if (x + y) % 9 else WD[4]
            if y == y0: c = WD[6] if (x - 4) % 4 else WD[3]
            if y == y1 - 1: c = WD[2]
            put(px, W, H, x, y, c)
    for y in range(y1, y1 + 2):
        for x in range(4, W - 4): put(px, W, H, x, y, WD[3] if y == y1 else WD[1])
    for (x0, x1) in ((0, 6), (W - 6, W)):                                  # 받침 돌
        for y in range(y0 + 2, H):
            for x in range(x0, x1):
                c = MR[5] if y < y0 + 4 else MR[3]
                if y >= H - 2: c = MR[2]
                put(px, W, H, x, y, c)
    for py in (y0 - 1, y1 - 3):                                           # 기둥 + 밧줄
        for px_ in (6, W - 8):
            for y in range(py - 9, py + 1):
                put(px, W, H, px_, y, WD[5]); put(px, W, H, px_ + 1, y, WD[3])
            put(px, W, H, px_, py - 10, WD[6]); put(px, W, H, px_ + 1, py - 10, WD[5])
        for x in range(8, W - 8):
            sag = int(round(3 * math.sin(math.pi * (x - 8) / (W - 16))))
            y = py - 8 + sag
            put(px, W, H, x, y, (184, 148, 86)); put(px, W, H, x, y + 1, (110, 82, 40))
    return pz.fin(o)

# ================================================================ 바위 깎은 돌계단 (2x3칸) — 지도에서는 mf_ground.stair_rock 로 같은 그림
def stairs_rock(w=2):
    W, H = w * 16, 51; o = new(W, H); px = o.load()
    G.stair_rock(px, 0, 0, w, 3) if False else None
    for Y in range(0, H):
        for X in range(W):
            lx = X; s_ = Y % 5
            if lx < 3 or lx >= W - 3:
                e = lx if lx < 3 else W - 1 - lx
                c = MR[5] if e == 1 else (MR[3] if e == 2 else MR[1])
                if lx >= W - 3: c = MR[3] if e == 1 else (MR[2] if e == 2 else MR[1])
            else:
                c = ST[6] if s_ == 0 else (ST[5] if s_ < 3 else ST[2])
                if lx == 3 or lx == W - 4: c = mul(c, 0.72)
            if Y >= H - 2: c = MR[1]
            put(px, W, H, X, Y, c)
    out = new(W, 64); out.alpha_composite(o, (0, 64 - H)); return out

# ================================================================ 쇠 화로 (1x2칸)
def brazier_iron(small=False, seed=3):
    """세 발 쇠 화로: 가는 다리 셋, 둥근 쇠 그릇(테 밝음), 그 위 불꽃(불 램프, 위로 갈수록 밝고 가늘다)과 불티."""
    W, H = (16, 24) if small else (16, 32); o = new(W, H); px = o.load()
    by = H - 13
    for (x0, dx) in ((4, -1), (8, 0), (11, 1)):                             # 다리
        for j in range(10):
            x = x0 + (dx * j) // 5; y = by + 2 + j
            put(px, W, H, x, y, IRON[4] if dx <= 0 else IRON[2])
    for y in range(by - 2, by + 3):                                          # 그릇
        hw = 6 - max(0, y - by)
        for x in range(8 - hw, 8 + hw):
            c = IRON[5] if y == by - 2 else (IRON[3] if x < 8 else IRON[2])
            if y == by - 1: c = FIRE[2] if 8 - hw + 1 <= x < 8 + hw - 1 else IRON[4]
            put(px, W, H, x, y, c)
    fl = [(8, 0, 4.5), ]
    for y in range(by - 12, by - 1):                                         # 불꽃
        k = (by - 1 - y) / 11.0
        hw = 4.6 * (1 - k) ** 0.8 + 0.4
        sway = math.sin(y * 0.9 + seed) * 0.8 * k
        for x in range(0, W):
            d = abs(x + 0.5 - 8 - sway)
            if d > hw: continue
            t = 3 + int((1 - d / hw) * 2 + k * 1.5)
            put(px, W, H, x, y, FIRE[min(6, t)])
    for (x, y) in ((5, by - 15), (11, by - 13), (7, by - 18)):
        put(px, W, H, x, y, FIRE[5])
    return pz.fin(o)

def torch_post(seed=1):
    """길가 횃불 기둥(1x2칸): 깎은 돌 받침 + 나무 장대 + 기름 그릇 불꽃."""
    W, H = 16, 32; o = new(W, H); px = o.load()
    for y in range(24, 32):
        for x in range(4, 12):
            c = MR[5] if y < 26 else (MR[4] if x < 10 else MR[3])
            if y == 31: c = MR[2]
            put(px, W, H, x, y, c)
    for y in range(9, 24): put(px, W, H, 7, y, WD[5]); put(px, W, H, 8, y, WD[3])
    for y in range(7, 10):
        for x in range(5, 11): put(px, W, H, x, y, IRON[5] if y == 7 else IRON[3])
    for y in range(0, 7):
        k = (6 - y) / 6.0; hw = 2.6 * (1 - k) + 0.4
        for x in range(4, 12):
            d = abs(x + 0.5 - 8 - math.sin(y + seed) * 0.5 * k)
            if d <= hw: put(px, W, H, x, y, FIRE[min(6, 3 + int((1 - d / hw) * 2 + k * 1.5))])
    return pz.fin(o)
