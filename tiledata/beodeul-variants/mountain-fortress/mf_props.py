# 산악 요새 소품·식생 — 버들항 C 볼륨 페인터(px2.C) + 버들항 소품 함수(pi.sack·woodpile 결, _lib-5 fir/lump, vprops.pine·snowcap)로 그린다.
# 새 재료: 산 바위(mrock, mf_ground.MR) — 칩셋 돌 램프와 같은 7단. 3/4 시점, 빛 왼쪽 위. 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5')); sys.path.insert(0, os.path.join(HERE, '..'))
from PIL import Image
import mf_ground as G
import mf_stone as S
import pz, px2
from px2 import C, PAL, GRAIN, _hash, vnoise
import pi
import parts5 as P5
import parts5b as P5b
from parts5b import lump, slab
import vprops as V
GRAIN['mrock'] = (0.12, 2.0)
fin = pz.fin

def snowy(im, depth=2, seed=1): return V.snowcap(im, depth, seed)

# ================================================================ 바위·봉우리 — 깎인 면(facet) 바위
import numpy as np
LX, LY, LZ = -0.55, -0.65, 0.75
def facet_rock(W, H, blobs, seed=1, snow=0.0, moss=0.0, top_bias=0.0):
    """여러 타원 덩이(blobs=[(cx, cy, rx, ry, height)])를 합친 실루엣을, 지터 격자 면(약 5px)으로 쪼개 면마다 법선을 준다.
    면 밝기 = 빛(왼쪽 위) · 법선 → 산 바위 램프 2~6. 면 경계: 아래오른 쪽 1화소 어둡게(금), 윗면 쪽 면 위 눈(snow 비율)."""
    Y, X = np.mgrid[0:H, 0:W].astype(float)
    hgt = np.full((H, W), -1.0)
    for (cx, cy, rx, ry, h) in blobs:
        d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
        n = np.vectorize(lambda x, y: vnoise(x, y, 3.0, seed))(X, Y)
        inside = d + (n - 0.5) * 0.35 < 1
        hh = np.where(inside, h * np.sqrt(np.clip(1 - d, 0, 1)) + cy * 0.0, -1)
        hgt = np.maximum(hgt, np.where(inside, hh + (H - cy) * 0.02, -1))
    m = hgt >= 0
    # 면: 지터 격자 보로노이
    bid, d1, d2 = G.worley(W, H, 6, seed + 3, None, jit=0.95)
    edge = (d2 - d1) < 0.9
    o = np.zeros((H, W, 4), np.uint8)
    ids = np.unique(bid[m])
    tone = np.zeros((H, W))
    for i in ids:
        sel = m & (bid == i)
        if not sel.any(): continue
        ys, xs = np.nonzero(sel); cx, cy = xs.mean(), ys.mean()
        # 이 면이 속한 덩이 중심 쪽 법선(구 모양) + 흔들림
        best = None
        for (bx, by, rx, ry, h) in blobs:
            dd = ((cx + 0.5 - bx) / rx) ** 2 + ((cy + 0.5 - by) / ry) ** 2
            if best is None or dd < best[0]: best = (dd, bx, by, rx, ry)
        _, bx, by, rx, ry = best
        nx = (cx + 0.5 - bx) / rx; ny = (cy + 0.5 - by) / ry * 0.8 - 0.35 - top_bias
        nx += (_hash(int(i) % 9973, 1, seed) - 0.5) * 0.9; ny += (_hash(int(i) % 9973, 2, seed) - 0.5) * 0.7
        nz = math.sqrt(max(0.05, 1 - min(0.95, nx * nx + ny * ny)))
        L = math.sqrt(nx * nx + ny * ny + nz * nz); nx, ny, nz = nx / L, ny / L, nz / L
        sh = max(0, nx * LX + ny * LY + nz * LZ)
        tone[sel] = 1.9 + sh * 4.1
        if snow > 0 and ny < -0.42 and _hash(int(i) % 9973, 5, seed) < snow: tone[sel] = 10 + sh   # 눈 면
    T = np.clip(np.rint(tone), 1, 6).astype(int)
    rgb = G.MRa[T]
    snowm = tone >= 10
    rgb = np.where(snowm[..., None], np.where((tone > 10.55)[..., None], np.array(G.SN[6]), np.array(G.SN[5])), rgb)
    # 면 경계 금: 경계 화소 중 아래·오른쪽 면 쪽만 어둡게
    e2 = edge & m & ~snowm
    rgb = np.where(e2[..., None], (rgb * 0.78).astype(np.uint8), rgb)
    o[..., :3] = rgb; o[..., 3] = np.where(m, 255, 0)
    im = Image.fromarray(o, 'RGBA')
    im = fin(im)
    return im

def _with_shadow(im, rx=None):
    W, H = im.size; out = Image.new('RGBA', (W, H)); sp = out.load()
    rx = rx or W * 0.44
    for y in range(H - 5, H):
        for x in range(W):
            if ((x + 0.5 - W / 2) / rx) ** 2 + ((y + 0.5 - (H - 2.5)) / 2.4) ** 2 <= 1: sp[x, y] = (14, 30, 8, 100)
    out.alpha_composite(im); return out

def crag(v=0, seed=101):
    """바위 봉우리(뾰족 솟은 바위, 2x3칸): 깎인 면 바위 셋이 위로 좁아지고 윗면에 눈."""
    if v == 0: blobs = [(16, 34, 14, 11, 9), (14, 21, 9, 10, 8), (13, 9, 5, 8, 6)]
    else: blobs = [(15, 35, 14, 10, 9), (19, 22, 8, 11, 8), (9, 27, 6, 7, 5), (20, 9, 4.5, 8, 6)]
    return _with_shadow(facet_rock(32, 48, blobs, seed, snow=0.5), 13)

def outcrop(seed=111):
    """넓은 바위 둔덕(3x2칸): 깎인 면 바위 두 덩이, 윗면 눈."""
    return _with_shadow(facet_rock(48, 32, [(18, 17, 16, 12, 8), (35, 21, 11, 9, 6), (8, 24, 6, 6, 4)], seed, snow=0.5), 21)

def snowrock(size='m', seed=121):
    """눈 얹은 바위: l=3x2, m=2x2, s=1x1. 깎인 면 바위 + 윗면 눈 덮개."""
    if size == 'l': im = facet_rock(48, 32, [(20, 18, 17, 12, 8), (37, 22, 9, 8, 5)], seed, snow=0.75, top_bias=0.15)
    elif size == 'm': im = facet_rock(32, 32, [(15, 19, 13, 11, 8), (24, 24, 6, 6, 4)], seed, snow=0.75, top_bias=0.15)
    else: im = facet_rock(16, 16, [(8, 9, 6.5, 5.5, 4)], seed, snow=0.75, top_bias=0.15)
    return _with_shadow(snowy(im, 1, seed))

def boulders(seed=131):
    """바위 두 개(2x1칸): 큰 것 하나 작은 것 하나, 눈 없음, 윗면에 이끼 점."""
    im = facet_rock(32, 16, [(11, 9, 9.5, 6.5, 5), (25, 11, 6, 4.5, 3)], seed)
    p = im.load()
    for (x, y) in ((7, 4), (8, 4), (10, 3), (12, 3), (9, 5)):
        if p[x, y][3]: p[x, y] = G.LAWN[2] + (255,)
    return _with_shadow(im)

def rockfall(seed=141):
    """낙석 더미(3x2칸): 절벽 발치에 쏟아진 모난 돌 여럿."""
    im = facet_rock(48, 32, [(14, 20, 9, 8, 6), (30, 17, 10, 10, 7), (42, 24, 5.5, 5, 4), (22, 26, 6, 4.5, 3), (6, 26, 4, 3.5, 3)], seed)
    p = im.load()
    for (x, y) in ((2, 29), (9, 30), (37, 29), (45, 28), (18, 30)):
        p[x, y] = G.MR[5] + (255,); p[x + 1, y] = G.MR[4] + (255,); p[x, y + 1] = G.MR[2] + (255,)
    return _with_shadow(im, 22)

def scree_mtn(v=0, seed=151):
    """잔자갈(1x1칸, 걷는 장식): 산 바위 잔돌 여남은 개."""
    im = Image.new('RGBA', (16, 16)); p = im.load()
    M = G.MR
    spots = ((3, 9), (6, 11), (9, 8), (11, 12), (13, 9), (5, 6), (8, 13)) if v == 0 else ((2, 11), (5, 8), (8, 11), (10, 7), (12, 11), (7, 5))
    for (x, y) in spots:
        big = _hash(x, y, seed + v) > 0.5
        p[x, y] = M[6] + (255,); p[x + 1, y] = M[5] + (255,)
        p[x, y + 1] = M[4] + (255,); p[x + 1, y + 1] = M[3] + (255,)
        if big: p[x + 2, y + 1] = M[3] + (255,); p[x - 1, y + 1] = M[4] + (255,); p[x, y + 2] = M[2] + (255,); p[x + 1, y + 2] = M[2] + (255,)
        else: p[x, y + 2] = M[2] + (255,)
    return im

def snow_patch(w=2, h=1, seed=161):
    """눈 자국(걷는 장식): 바위 바닥 위 녹다 남은 눈 덩이, 가장자리 들쭉날쭉, 아래 그늘."""
    import numpy as np
    W, H = w * 16, h * 16
    Y, X = np.mgrid[0:H, 0:W]
    cx, cy = W / 2, H / 2
    n = np.array([[vnoise(x, y, 5, seed) for x in range(W)] for y in range(H)])
    r = ((X + 0.5 - cx) / (W * 0.46)) ** 2 + ((Y + 0.5 - cy) / (H * 0.40)) ** 2
    m = (r + (n - 0.5) * 0.9) < 0.75
    m[H - 1, :] = False
    return G.snow_layer(m, seed)

# ================================================================ 나무·풀
def fir_snow(n=3, seed=171):
    """눈 덮인 전나무: 버들항 변형 눈마을 소나무(vprops.pine) 결 그대로, 층 수·씨앗을 바꾼 변형."""
    im = V.pine(n, seed)
    return im if isinstance(im, Image.Image) else fin(im)

def fir_dusted(w=32, h=48, tiers=4, seed=181):
    """눈가루 앉은 전나무(아래 비탈): 깊은 숲길 전나무(_lib-5 fir) 결 그대로, 단마다 윗가장자리 몇 화소에 눈."""
    im = P5.fir(w, h, tiers, seed); px = im.load(); W, H = im.size
    for x in range(W):
        for y in range(1, H - 8):
            a = px[x, y]; up = px[x, y - 1]
            if a[3] > 200 and (up[3] < 200 or (sum(up[:3]) < sum(a[:3]) - 60)) and x < W * 0.62 and _hash(x, y, seed) > 0.35:
                px[x, y] = G.SN[6] + (255,)
                if y + 1 < H and px[x, y + 1][3] > 200 and _hash(x, y, seed + 1) > 0.5: px[x, y + 1] = G.SN[4] + (255,)
    return im

def juniper(seed=191):
    """고산 노간주 덤불(1x1칸): 낮고 짙은 침엽 덩이, 윗면 눈 점."""
    c = C(16, 16, seed=seed); c.shadow(8, 14, 6.8, 1.2)
    c.group(1); lump(c, 8, 4, 6.8, 2.5, 6, 'pine', top=4, front=(3, 2), seed=seed, tex=0.4, edge=1.1)
    for (x, y) in ((4, 5), (5, 4), (8, 4), (9, 5), (11, 5)):
        if c.m[y][x]: c.tone(x, y, 'snow', 6)
    return fin(c)

def dead_snag(seed=201):
    """말라 죽은 산 전나무(2x3칸): 껍질 벗겨진 줄기, 짧게 부러진 가지, 꼭대기 부러짐, 가지 위 눈."""
    c = C(32, 48, seed=seed); c.shadow(16, 46, 8, 1.8)
    c.new()
    for y in range(6, 46):
        hw = 1.5 + (y - 6) / 40 * 1.6
        for x in range(int(16 - hw), int(16 + hw + 1)):
            t = 5 if x < 16 - hw * 0.3 else (4 if x < 16 + hw * 0.4 else 2)
            c.tone(x, y, 'bark', t)
    for (y, d, L) in ((14, -1, 7), (19, 1, 8), (25, -1, 9), (30, 1, 7), (36, -1, 6), (11, 1, 5)):
        c.new()
        for i in range(L):
            x = 16 + d * (2 + i); yy = y - i // 3
            c.tone(x, yy, 'bark', 4 if d < 0 else 3)
            if i == L - 1 or i % 3 == 0: c.tone(x, yy - 1, 'snow', 6)
    for (x, y) in ((15, 5), (16, 4), (17, 6)): c.tone(x, y, 'bark', 3)
    return fin(c)

# ================================================================ 길 표지
def cairn_mark(seed=211):
    """돌탑 길 표지(1x2칸): 납작한 산 바위 다섯 장을 쌓았고 꼭대기에 눈."""
    im = facet_rock(16, 32, [(8, 26, 6.8, 3.6, 3), (7.5, 20.5, 5.4, 3.2, 3), (8.5, 15.5, 4.4, 2.8, 2.5), (8, 11, 3.4, 2.5, 2), (7.6, 7, 2.4, 2.4, 2)], seed)
    return _with_shadow(snowy(im, 1, seed), 6.5)

def waymarker(seed=221):
    """깎은 돌 길표 기둥(1x2칸): 네모 기둥, 앞면에 계단 홈 세 줄(기하 무늬, 글자 없음), 갓돌 위 눈."""
    W, H = 16, 32; o = Image.new('RGBA', (W, H)); px = o.load()
    for y in range(4, 30):
        for x in range(4, 12):
            c = S.stone(x, y, k=0.9, bw=8, bh=7, seed=seed)
            if x == 4: c = S.mul(G.ST[6], 0.9)
            if x >= 10: c = S.mul(c, 0.72)
            if y >= 28: c = S.mul(G.ST[2], 0.9)
            px[x, y] = c + (255,)
    for j, y in enumerate((10, 15, 20)):
        for x in range(6 + j % 2, 10 - (j + 1) % 2):
            px[x, y] = S.mul(G.ST[2], 0.9) + (255,); px[x, y + 1] = S.mul(G.ST[5], 0.9) + (255,)
    for y in range(1, 4):
        for x in range(3, 13): px[x, y] = (G.SN[6] if y == 1 else (G.SN[5] if y == 2 else S.mul(G.ST[3], 0.9))) + (255,)
    return fin(o)

# ================================================================ 대장간
def forge_hearth(seed=231):
    """대장간 화덕(3x3칸): 마름돌 화덕 몸통(윗면 = 숯불 바닥, 붉게 달아오름), 앞면 아치 아궁이(불빛), 뒤쪽 돌 굴뚝(칸 하나 폭, 연기),
    왼쪽 가죽 풀무(나무 판 + 주름 가죽 + 손잡이)."""
    W, H = 48, 48; o = Image.new('RGBA', (W, H)); px = o.load(); put = S.put
    K = S.K
    for y in range(0, 22):                                                 # 굴뚝(뒤, 가운데 오른쪽)
        for x in range(24, 38):
            c = S.stone(x, y, k=K * 0.95, bw=7, bh=5, seed=seed)
            if x == 24: c = S.mul(G.ST[6], K)
            if x >= 36: c = S.mul(c, 0.7)
            if y < 3: c = S.mul(G.ST[5] if y < 2 else G.ST[2], K) if 25 <= x < 37 else c
            if y < 2 and 27 <= x < 35: c = (20, 18, 22)                     # 굴뚝 구멍
            put(px, W, H, x, y, c)
    for y in range(18, 30):                                                # 화덕 윗면(숯불)
        for x in range(8, 46):
            c = S.top_face(x, y) if (x < 11 or x > 42 or y < 20 or y > 27) else None
            if c is None:
                h = _hash(x, y, seed + 1)
                c = S.FIRE[4] if h > 0.75 else (S.FIRE[3] if h > 0.4 else (S.FIRE[2] if h > 0.15 else (40, 28, 26)))
                if h > 0.95: c = S.FIRE[6]
            put(px, W, H, x, y, c)
    for y in range(30, 46):                                                # 화덕 앞면
        for x in range(8, 46):
            c = S.stone(x, y - 30, k=K, seed=seed + 2)
            if x == 8: c = S.mul(G.ST[6], K)
            if x >= 44: c = S.mul(c, 0.7)
            if y == 30: c = S.mul(G.ST[2], K)
            if y >= 44: c = S.mul(G.ST[2], K)
            put(px, W, H, x, y, c)
    cx, sy = 27, 40                                                        # 아궁이
    for y in range(32, 44):
        for x in range(19, 36):
            if y < sy - 3 and math.hypot((x + 0.5 - cx) / 8.5, (y - (sy - 3)) / 6) > 1: continue
            d = math.hypot((x + 0.5 - cx) / 8.5, (y - 41) / 9)
            c = S.FIRE[5] if d < 0.35 else (S.FIRE[4] if d < 0.6 else (S.FIRE[3] if d < 0.85 else S.FIRE[1]))
            put(px, W, H, x, y, c)
    for y in range(32, 44):
        for x in range(17, 38):
            if px[x, y][:3] in [S.FIRE[i] for i in range(7)]: continue
            if math.hypot((x + 0.5 - cx) / 10.5, (y - (sy - 3)) / 8) < 1 and y < 42:
                put(px, W, H, x, y, S.mul(G.ST[5] if x < cx else G.ST[3], K))
    im = fin(o); ip = im.load()
    # 풀무(왼쪽): 나무 판 둘 사이 주름 가죽
    WD = S.WD
    for y in range(26, 42):
        for x in range(0, 9):
            k = (y - 26) / 16
            if x > 2 + k * 6: continue
            put(ip, W, H, x, y, WD[5] if x < 2 else ((110, 70, 48) if (y % 3) else (72, 44, 30)))
    for x in range(0, 9): put(ip, W, H, x, 25, WD[6]); put(ip, W, H, x, 42, WD[2])
    for y in range(20, 26): put(ip, W, H, 1, y, WD[4])
    # 연기
    for i, (x, y) in enumerate(((30, -0), (31, 0))):
        pass
    sm = Image.new('RGBA', (W, 18)); sp = sm.load()
    for y in range(18):
        for x in range(W):
            r = math.hypot((x - 31 - math.sin(y * 0.5) * 2) / (2.5 + (17 - y) * 0.25), 1)
            if r < 1.05 and _hash(x, y, seed + 9) > 0.35:
                sp[x, y] = (196, 200, 206, 150 + int(60 * y / 18))
    out = Image.new('RGBA', (W, 64)); out.alpha_composite(sm, (0, 0)); out.alpha_composite(im, (0, 16))
    return out

def anvil_block(seed=241):
    """큰 모루(2x1칸): 깎은 돌 받침 위 쇠 모루(뿔 왼쪽), 옆에 망치 한 자루."""
    c = C(32, 16, seed=seed); c.shadow(16, 14, 13, 1.4)
    c.group(1); c.box(9, 8, 14, 2, 5, 'stone', top=0.85, front=0.5)
    c.group(2); c.box(8, 3, 16, 2, 2, 'iron', top=0.95, front=0.6)
    c.poly([(2, 4), (8, 3), (8, 6)], 'iron', 0.8)
    c.group(3); c.box(12, 7, 8, 0, 1, 'iron', front=0.45)
    c.group(4); c.new(); c.line(25, 13, 29, 6, 'wood', 4); c.box(27, 4, 4, 1, 2, 'iron', top=0.9, front=0.6)
    return fin(c)

def quench_trough(seed=251):
    """담금질 물통(2x1칸): 돌 구유에 어두운 물, 김 한 줄."""
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 14, 1.3)
    c.group(1); c.box(2, 3, 28, 3, 8, 'stone', top=0.9, front=0.5)
    for y in range(4, 6):
        for x in range(5, 27): c.tone(x, y, 'teal', 1 if y == 4 else 2)
    for x in range(5, 27): c.tone(x, 3, 'stone', 2)
    im = fin(c); p = im.load()
    for y in range(0, 4):
        x = 18 + int(math.sin(y) * 1.5)
        p[x, y] = (210, 214, 220, 170)
    return im

def tool_rack(seed=261):
    """연장 걸이(2x2칸): 나무 틀 두 기둥 + 가로대, 망치·집게·줄이 걸려 있다."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 14, 1.6)
    c.group(1)
    for x in (4, 26):
        c.new()
        for y in range(4, 30): c.tone(x, y, 'wood', 5); c.tone(x + 1, y, 'wood', 3)
    c.group(2); c.box(3, 5, 26, 1, 2, 'wood', top=0.9, front=0.55)
    c.group(3)
    for i, (x, kind) in enumerate(((9, 'h'), (14, 't'), (19, 'h'), (23, 'f'))):
        c.new()
        L = 15 if kind != 'f' else 12
        for y in range(8, 8 + L): c.tone(x, y, 'wood' if kind == 'h' else 'iron', 4 if kind == 'h' else 3)
        if kind == 'h':
            for xx in range(x - 2, x + 3): c.tone(xx, 8 + L, 'iron', 4 if xx < x + 1 else 2); c.tone(xx, 9 + L, 'iron', 2)
        elif kind == 't':
            for y in range(8, 8 + L): c.tone(x + 2, y, 'iron', 4)
            c.tone(x + 1, 8 + L, 'iron', 2)
    c.group(4); c.box(2, 28, 28, 1, 1, 'wood', top=0.6, front=0.4)
    return fin(c)

def grindstone(seed=271):
    """숫돌 바퀴(2x2칸): 나무 틀에 세운 둥근 숫돌(가운데 쇠 축), 손잡이, 아래 물받이."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 13, 1.6)
    c.group(1); c.box(5, 22, 22, 2, 5, 'wood', top=0.85, front=0.5)
    c.group(2); c.new()
    for y in range(4, 26):
        for x in range(6, 26):
            d = math.hypot((x + 0.5 - 16) / 10, (y + 0.5 - 15) / 10.5)
            if d > 1: continue
            t = 5 if (x - 16) + (y - 15) < -6 else (4 if (x - 16) + (y - 15) < 4 else 3)
            if d > 0.86: t = 2 if x > 16 else 4
            c.tone(x, y, 'mrock', t)
    c.group(3); c.new(); c.tone(16, 15, 'iron', 5); c.tone(17, 15, 'iron', 2); c.line(17, 15, 27, 12, 'iron', 4); c.line(27, 12, 27, 8, 'wood', 4)
    return fin(c)

def _logend(c, x, y, k):
    c.group(k); c.new()
    for yy in range(int(y - 3), int(y + 4)):
        for xx in range(int(x - 3), int(x + 4)):
            r = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
            if r <= 3.1: c.tone(xx, yy, 'bark' if r > 2.2 else 'wood', 2 if r > 2.2 else (3 if r < 0.9 else (5 if (r * 2) % 2 < 1 else 4)))

def woodpile_tall(w=3, seed=281):
    """장작 더미(높게, w x 2칸): 쪼갠 장작 마구리를 네 줄로 쌓고 양끝을 말뚝이 받친다, 위에 눈 조금(버들항 장작 결 그대로)."""
    W = w * 16; c = C(W, 32, seed=seed); c.shadow(W / 2, 30, W / 2 - 1, 1.6)
    k = 0
    for row in range(4):
        y = 27 - row * 6
        n = (W - 8) // 6
        for i in range(n):
            x = 6 + i * 6 + (3 if row % 2 else 0)
            if x > W - 5: continue
            if row == 3 and (i == 0 or i >= n - 1): continue
            k += 1; _logend(c, x, y, k)
    c.group(99)
    for x in (1, W - 3):
        c.new()
        for y in range(6, 31): c.tone(x, y, 'bark', 5); c.tone(x + 1, y, 'bark', 3)
    im = fin(c)
    return snowy(im, 1, seed)

def log_bundle(seed=291):
    """통나무 묶음(2x1칸): 껍질 있는 통나무 셋을 눕혀 밧줄로 묶었다, 마구리가 왼쪽."""
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 15, 1.3)
    for i, (y, x0) in enumerate(((10, 3), (10, 9), (5, 6))):
        c.group(i + 1); c.hcyl(x0 if i < 2 else 6, 29, y if i < 2 else y, 2.6, 'bark', endcap='L', capmat='wood')
    c.group(9); c.new()
    for y in range(2, 14): c.tone(20, y, 'rope', 5); c.tone(21, y, 'rope', 3)
    return fin(c)

def sacks_heap(seed=301):
    """포대 더미(3x2칸): 숯·곡식 자루 일곱 개를 피라미드로 쌓았다(버들항 자루 결)."""
    c = C(48, 32, seed=seed); c.shadow(24, 30, 22, 1.8)
    pos = [(7, 25), (17, 26), (27, 25.5), (37, 26), (12, 19), (23, 19.5), (33, 19), (18, 13), (28, 13.5)]
    for i, (x, y) in enumerate(pos):
        pi.sack(c, x, y, i + 1, (0.06 if i % 2 else -0.06) - (0.05 if y > 20 else 0))
    # 숯 자루 두 개는 거뭇하다
    for y in range(c.h):
        for x in range(c.w):
            if c.m[y][x] == 'cream' and c.id[y][x] in (c.grp and (3, 7)) and False: pass
    return fin(c)

def sacks_stack(seed=311):
    """나무 깔판 위 포대(2x2칸): 깔판 + 자루 넷, 맨 위 하나는 눕혔다."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 15, 1.6)
    c.group(1); c.box(1, 25, 30, 2, 3, 'wood', top=0.8, front=0.5)
    for i, (x, y) in enumerate(((7, 20), (16, 20.5), (25, 20), (11, 13), (21, 13.5))):
        pi.sack(c, x, y, i + 2, -0.04 if i % 2 else 0.05)
    return fin(c)

def coal_heap(seed=321):
    """숯 더미(2x1칸): 검은 숯 덩이 무더기, 윗면에 몇 점 반짝임."""
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 14, 1.3)
    c.group(1); lump(c, 16, 3, 13.5, 3, 7, 'coal', top=4, front=(3, 2), seed=seed, tex=0.5, edge=1.4)
    for y in range(c.h):
        for x in range(c.w):
            if c.m[y][x] and _hash(x, y, seed) > 0.9: c.tone(x, y, 'coal', 6)
            elif c.m[y][x] and _hash(x // 2, y // 2, seed + 1) > 0.8: c.tone(x, y, 'coal', 1)
    return fin(c)

def ore_heap(seed=331):
    """광석 더미(2x1칸): 산 바위 조각 사이에 금빛·은빛 광맥이 박힌 덩이."""
    c = C(32, 16, seed=seed); c.shadow(16, 14.5, 14, 1.3)
    for i, (cx, yt, rx, h) in enumerate(((10, 6, 8, 6), (22, 4, 9, 8), (16, 9, 5, 4))):
        c.group(i + 1); lump(c, cx, yt, rx, 2, h, 'mrock', top=5, front=(4, 3), seed=seed + i, tex=0.3, edge=1.2)
    for (x, y, m) in ((8, 8, 'gold'), (9, 8, 'gold'), (20, 6, 'gold'), (24, 9, 'iron'), (25, 9, 'iron'), (14, 11, 'gold'), (27, 6, 'gold')):
        if c.m[y][x]: c.tone(x, y, m, 6 if m == 'gold' else 5); c.tone(x, y + 1, m, 4 if m == 'gold' else 3) if c.m[y + 1][x] else None
    return fin(c)

def ore_cart(seed=341):
    """광석 수레(2x2칸): 나무 짐칸(쇠 모서리띠) 가득 광석, 작은 쇠바퀴 넷 중 앞 둘이 보인다."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 14, 1.6)
    c.group(1); c.box(3, 9, 26, 4, 12, 'wood', top=0.8, front=0.55)
    for y in range(13, 25):
        c.tone(3, y, 'iron', 4); c.tone(28, y, 'iron', 2)
    for x in range(3, 29): c.tone(x, 13, 'iron', 5); c.tone(x, 24, 'iron', 2)
    c.group(2)
    for i, (cx, yt, rx, h) in enumerate(((9, 5, 6, 4), (17, 3, 7, 6), (24, 6, 5, 3))):
        c.group(2 + i); lump(c, cx, yt, rx, 2, h, 'mrock', top=5, front=(4, 3), seed=seed + i, tex=0.3, edge=1.0)
    for (x, y) in ((8, 7), (16, 5), (22, 8), (18, 6)): c.tone(x, y, 'gold', 6)
    for k, wx in enumerate((8, 24)):
        c.group(10 + k); c.new()
        for y in range(23, 31):
            for x in range(wx - 4, wx + 4):
                d = math.hypot(x + 0.5 - wx, y + 0.5 - 27)
                if d <= 3.6: c.tone(x, y, 'iron', 4 if d > 2.4 and x < wx else (2 if d > 2.4 else 3))
        c.tone(wx, 27, 'iron', 6)
    return fin(c)

def weapon_rack(seed=351):
    """창 세움대(2x2칸): 나무 받침에 창 셋·도끼 하나를 세웠다, 날은 쇠."""
    c = C(32, 32, seed=seed); c.shadow(16, 30, 14, 1.6)
    c.group(1); c.box(2, 22, 28, 2, 4, 'wood', top=0.85, front=0.5)
    c.group(2); c.box(3, 12, 26, 1, 1, 'wood', top=0.9, front=0.5)
    for i, x in enumerate((7, 13, 19)):
        c.group(3 + i); c.new()
        for y in range(4, 24): c.tone(x, y, 'wood', 5 if i % 2 else 4)
        c.tone(x, 1, 'iron', 6); c.tone(x, 2, 'iron', 5); c.tone(x - 1, 3, 'iron', 4); c.tone(x, 3, 'iron', 5); c.tone(x + 1, 3, 'iron', 2)
    c.group(7); c.new()
    for y in range(6, 24): c.tone(25, y, 'wood', 4)
    for y in range(5, 11):
        for x in range(26, 30 - abs(y - 8) // 2): c.tone(x, y, 'iron', 5 if y < 8 else 3)
    return fin(c)

def ice_icicles(seed=361):
    """고드름 줄(2x1칸, 위층 장식): 바위 턱 아래로 늘어진 고드름 — 절벽 앞면 위쪽에 붙인다."""
    im = Image.new('RGBA', (32, 16)); p = im.load()
    IC = [px2.hx(c) for c in PAL['ice']]
    for x in range(1, 31):
        L = 2 + int(_hash(x // 2, 1, seed) * 11) if x % 2 == 0 else 1 + int(_hash(x, 2, seed) * 4)
        for y in range(L):
            t = 6 if y < 2 else (5 if x % 3 else 4)
            if y == L - 1: t = 4
            p[x, y] = IC[t] + (255,)
        p[x, 0] = G.SN[6] + (255,)
    return im

# ================================================================ 성벽 끝이 산 바위에 묻힌다(깎인 면 바위 덩이가 벽 끝을 덮는다)
def wall_end(n=3, side='W', seed=1):
    """성벽 n칸 x 3줄 + 한쪽 끝을 덮는 깎인 면 바위 덩이(벽 높이보다 조금 높다). 성벽 줄의 끝을 산에 잇는다."""
    wall = S.wall_seg(n, seed=seed)
    W, H = wall.size
    rk = facet_rock(30, H, [(10 if side == 'W' else 20, H * 0.62, 13, H * 0.42, 9), (6 if side == 'W' else 24, H * 0.3, 8, H * 0.32, 7)], seed + 50, snow=0.4)
    if side == 'E': pass
    x = 0 if side == 'W' else W - 30
    wall.alpha_composite(rk, (x, 0))
    return wall
