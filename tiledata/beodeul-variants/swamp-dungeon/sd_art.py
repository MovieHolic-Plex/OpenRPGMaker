# 늪 던전 조각 — 버들항 파이프라인 재료로만 그린다. 다시 돌리면 같은 그림.
#   사당 = v6pieces.temple6(버들항 신전) 을 바래고 지붕을 이끼 슬레이트로, 기단은 물에 잠기고 오른쪽 지붕이 내려앉음
#   탑 첨두 = castle6.tower6(버들항 원탑) 꼭대기만 물 위로 · 오두막 = varlib.house(늪 마을 집) 을 무너뜨림
#   나무 = roman.clumps(칩셋 참나무 잎) 수관 + 칩셋 참나무 줄기 색 껍질 · 돌 = castle6.ash 마름돌·px2.C 칩셋 돌 램프
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from sd_terrain import *
import castle6, v6pieces, pv
from roman import clumps, TRV, CRM
sys.path.insert(0, os.path.join(HERE, '..', 'ancient-forest'))
_saved = {k: list(v) for k, v in px2.PAL.items()}
import af_art as AF                                   # 고대 숲의 껍질·뿌리·기둥·아치 그리기 함수(읽기만)
sys.path.insert(0, os.path.join(HERE, '..'))
import varlib                                         # 늪 마을 집(house) — pboat 가 PAL 윤곽을 바꾸므로 되돌린다
for k, v in _saved.items(): px2.PAL[k] = v
from px2 import C, _hash, vnoise

BK = AF.BK
def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def put(px, W, H, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H: px[x, y] = tuple(c[:3]) + (a,)
def weather(c, k=1.0): return AF.weather(c, k)
def moss_at(X, Y, seed): return AF.moss_at(X, Y, seed)
def lumi(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
SLM = [hxs(c) for c in ('#121812', '#1c261e', '#28362a', '#374836', '#4a5c44', '#627454', '#82926c')]   # 이끼 슬레이트(지붕)
BEARD = [(44, 56, 40), (70, 84, 58), (98, 112, 78), (128, 140, 100), (160, 168, 124)]                 # 늘어진 이끼 수염(회녹)
WISP = [(10, 40, 34), (28, 92, 78), (60, 160, 130), (120, 214, 176), (196, 246, 220), (240, 255, 246)]  # 도깨비불

def remap(im, ramp, sel=None, lo=None, hi=None, t0=1, t1=6):
    """선택 화소를 밝기 순서 그대로 ramp[t0..t1] 로 옮긴다(결은 그대로)."""
    o = im.copy(); p = o.load(); W, H = o.size
    pts = [(x, y) for y in range(H) for x in range(W) if p[x, y][3] and (sel is None or sel(x, y, p[x, y]))]
    if not pts: return o
    Ls = [lumi(p[x, y]) for x, y in pts]
    lo = min(Ls) if lo is None else lo; hi = max(Ls) if hi is None else hi
    for (x, y), L in zip(pts, Ls):
        t = t0 + (t1 - t0) * (L - lo) / max(1, hi - lo)
        p[x, y] = ramp[max(t0, min(t1, int(round(t))))] + (p[x, y][3],)
    return o

def age(im, k=1.0, keep=None):
    """초록(이끼·잎)이 아닌 화소를 녹회색으로 바랜다."""
    o = im.copy(); p = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = p[x, y]
            if not a or (keep and keep(r, g, b)): continue
            if g > r + 18 and g > b: continue
            p[x, y] = weather((r, g, b), k) + (a,)
    return o

DM = [(22, 40, 28), (32, 58, 34), (46, 78, 40), (64, 102, 46), (86, 128, 54)]     # 늪 이끼(어둡게): 돌·널 위
def moss_patch(px, W, H, x0, x1, y0, y1, seed, p=0.55):
    """이끼 덩이: 덩이 안쪽은 어두운 이끼, 위·왼쪽 가장자리 1화소만 밝게(빛 왼쪽 위)."""
    on = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] >= 200 and moss_at(x, y, seed) > p and y0 <= y < y1 and x0 <= x < x1
    pts = [(x, y) for y in range(max(0, y0), min(H, y1)) for x in range(max(0, x0), min(W, x1)) if on(x, y)]
    for (x, y) in pts:
        m = moss_at(x, y, seed)
        t = 2 if m > p + 0.08 else 1
        if not on(x, y - 1) or not on(x - 1, y): t = 3
        if not on(x, y + 1): t = 0
        px[x, y] = DM[t] + (255,)

def ivy(px, W, H, x, y0, y1, seed, only_on=True):
    """줄기를 타고 내려오는 덩굴(칩셋 잎 램프): 한 줄 + 잎 점."""
    xx = x
    for y in range(y0, y1):
        xx += (1 if _hash(y, 1, seed) < 0.16 else (-1 if _hash(y, 2, seed) < 0.16 else 0))
        if only_on and not (0 <= xx < W and 0 <= y < H and px[xx, y][3]): continue
        put(px, W, H, xx, y, DM[0])
        if _hash(y, 3, seed) < 0.40:
            s_ = 1 if _hash(y, 4, seed) < 0.5 else -1
            put(px, W, H, xx + s_, y, DM[2]); put(px, W, H, xx + s_, y - 1, DM[3])

def beard(px, W, H, x, y0, L, seed):
    """늘어진 회녹 이끼 수염(가지·처마에서): 굵기 1, 마디마다 옆으로 털."""
    for i in range(L):
        y = y0 + i; xx = x + (1 if (i // 4) % 2 and _hash(x, i // 4, seed) < 0.5 else 0)
        t = 3 if i < L * 0.4 else (2 if i < L * 0.8 else 1)
        if _hash(x, i, seed + 1) < 0.25: t += 1
        put(px, W, H, xx, y, BEARD[min(4, t)])
        if i % 3 == 1 and _hash(x, i, seed + 2) < 0.6: put(px, W, H, xx - 1, y, BEARD[max(0, t - 1)])

def waterline(im, yw, seed=1, wet=6, rings=True, keep_x=None):
    """yw 화소 줄 아래를 지운다(물에 잠김). 그 위 wet 줄은 젖어 어둡고(이끼 끼고), 물 닿는 곳에 잔물결 고리 화소."""
    o = im.copy(); p = o.load(); W, H = o.size
    xs = [x for x in range(W) if any(p[x, y][3] for y in range(max(0, yw - 3), min(H, yw + 1)))]
    for x in range(W):
        if keep_x and keep_x(x): continue
        for y in range(yw + 1, H): p[x, y] = (0, 0, 0, 0)
        for k in range(wet):
            y = yw - k
            if 0 <= y < H and p[x, y][3]:
                c = p[x, y][:3]; f = 0.58 + 0.07 * k
                c = mul(c, f)
                if k < 3 and _hash(x, y, seed) < 0.35: c = MOSS[1] if k else MURK[2]
                p[x, y] = c + (255,)
    if rings and xs:
        x0, x1 = min(xs), max(xs)
        for x in range(x0 - 2, x1 + 3):
            if keep_x and keep_x(x): continue
            for (dy, pr, col) in ((1, 0.75, MURK[5]), (2, 0.35, MURK[4])):
                y = yw + dy
                if 0 <= x < W and 0 <= y < H and _hash(x, dy, seed + 3) < pr and not p[x, y][3]:
                    p[x, y] = col + (255,)
    return o

# ================================================================ 앵커 1: 가라앉은 옛 사당 (6x6칸)
def shrine_sunken(seed=3):
    """버들항 신전(temple6) 이 늪에 가라앉았다: 기단·옆 계단은 물 밑, 가운데 윗계단 두 단만 앞 돌 단에 닿는다.
    지붕 기와는 이끼 슬레이트로 바래고 오른쪽 뒤가 내려앉아 서까래와 속 어둠이 보인다. 박공의 금 방패는 떨어져 나간 자리,
    처마에서 덩굴·이끼 수염이 늘어지고, 청동 문은 썩어 없어져 어두운 입구(속에서 도깨비불 빛)."""
    t = v6pieces.temple6(6); W, H = t.size                    # 96x112
    p = t.load()
    gx = W / 2
    # --- 지붕(y<52, 박공 삼각 제외) → 이끼 슬레이트
    def roofsel(x, y, c):
        if y >= 52: return False
        d = abs(x + 0.5 - gx); top = 32
        if y >= top and d <= gx * (y - top + 1) / 20 - 0.5: return False   # 박공 벽(tympanum)·처마
        return True
    t = remap(t, SLM, roofsel, t0=1, t1=6); p = t.load()
    # --- 금 방패·월계 → 떨어져 나간 자국(바랜 돌 + 금)
    cy = 32 + int(20 * 0.62); cx = int(gx)
    for y in range(cy - 5, cy + 5):
        for x in range(cx - 14, cx + 14):
            if not p[x, y][3]: continue
            r = math.hypot((x + 0.5 - gx) / 5.0, (y + 0.5 - cy) / 3.6)
            if r <= 1.15: p[x, y] = (CRM[2] if r > 0.85 else CRM[3]) + (255,)
            elif abs(x - cx) > 5 and lumi(p[x, y]) < 150 and p[x, y][1] > p[x, y][0]: p[x, y] = CRM[4] + (255,)
    # --- 바래기(돌·회반죽) — 이끼색은 그대로
    t = age(t, 1.0); p = t.load()
    # --- 속(신실 벽) 더 어둡게: 물에 잠긴 옛 사당 속
    for y in range(60, 92):
        for x in range(1, W - 1):
            r, g, b, a = p[x, y]
            if a and lumi((r, g, b)) < 120: p[x, y] = mul((r, g, b), 0.62) + (255,)
    # --- 청동 문 → 어두운 입구(2칸 폭 가까이), 문틀 돌은 남김, 바닥에 도깨비불 빛
    dx0 = int(gx) - 6
    for y in range(66, 92):
        for x in range(dx0, dx0 + 12):
            k = (y - 66) / 25
            c = (8, 16, 14) if k < 0.7 else ((12, 30, 26) if k < 0.88 else (24, 62, 52))
            if x == dx0 or x == dx0 + 11: c = (14, 24, 22)
            if y > 86 and abs(x + 0.5 - gx) < 3: c = WISP[2] if y > 88 else WISP[1]
            put(p, W, H, x, y, c)
    # --- 내려앉은 지붕(오른쪽 뒤): 들쭉날쭉한 구멍 + 서까래 + 속 어둠
    def hole(x, y):
        u = (x - 62) / 32.0; v = (y - 4) / 26.0
        e = (u - 0.5) ** 2 / 0.25 + (v - 0.45) ** 2 / 0.20
        return e + (vnoise(x, y, 3, seed) - 0.5) * 0.7 < 1.0 and y < 40 and x < W - 3
    for y in range(0, 42):
        for x in range(50, W - 2):
            if not hole(x, y) or not p[x, y][3]: continue
            c = (9, 12, 11) if y > 12 else (14, 18, 16)
            for bx in (68, 80):                                                                # 남은 서까래 두 대(비스듬, 부러짐)
                u = x - (bx + (y - 4) * 0.45)
                if 0 <= u < 2.2 and y < 30 - (bx - 68) * 0.6: c = BK[2] if u < 1.1 else BK[1]
            if 15 <= y <= 16 and 62 < x < 88 and _hash(x // 4, 0, seed) < 0.75: c = BK[2] if y == 15 else BK[0]   # 도리
            p[x, y] = c + (255,)
    for y in range(0, 40):                                     # 오른쪽 끝은 지붕째 떨어져 나가 윤곽이 깨진다
        for x in range(W - 12, W):
            if hole(x, y) and x + (vnoise(x, y, 2, seed + 3) - 0.5) * 6 > W - 7: p[x, y] = (0, 0, 0, 0)
    for y in range(0, 42):                                     # 구멍 가장자리: 깨진 기와 윗면(밝음)
        for x in range(50, W - 2):
            if hole(x, y) or not p[x, y][3]: continue
            if hole(x, y + 1) or hole(x - 1, y): p[x, y] = SLM[6] + (255,)
            elif hole(x, y - 1) or hole(x + 1, y): p[x, y] = SLM[1] + (255,)
    # --- 지붕 이끼 덩이·처마 이끼
    for y in range(0, 52):                                    # 지붕 이끼: 처마 쪽(아래)·용마루 곁에 작은 덩이
        for x in range(W):
            if not p[x, y][3] or not roofsel(x, y, None) or hole(x, y): continue
            m = vnoise(x, y, 4, seed + 4) * 0.7 + vnoise(x, y, 1.5, seed + 5) * 0.3
            lim = 0.80 - 0.14 * (y / 52.0) - (0.06 if abs(x + 0.5 - gx) < 4 else 0)
            if m > lim: p[x, y] = (DM[3] if m > lim + 0.07 else DM[2]) + (255,)
    # --- 물때(처마 밑 세로 줄) · 기둥 밑동 이끼
    for x in range(1, W - 1):
        if _hash(x, 0, seed + 6) < 0.28:
            L = 6 + int(_hash(x, 1, seed + 6) * 16)
            for y in range(60, 60 + L):
                if p[x, y][3] and lumi(p[x, y]) > 90: p[x, y] = mul(p[x, y], 0.82) + (255,)
    moss_patch(p, W, H, 0, W, 76, 92, seed + 7, 0.52)
    moss_patch(p, W, H, 0, W, 52, 58, seed + 8, 0.60)
    # --- 덩굴·이끼 수염(처마에서)
    for vx in (6, 31, 80):
        ivy(p, W, H, vx, 54, 54 + 10 + int(_hash(vx, 2, seed) * 18), seed + vx)
    for vx in (12, 24, 71, 86):
        beard(p, W, H, vx, 59, 5 + int(_hash(vx, 3, seed) * 7), seed + vx)
    # --- 잠김: 기단(y>=92) 지우고, 가운데 계단 윗 두 단만 남긴다(앞 돌 단과 이어짐)
    sx0, sx1 = W // 2 - 24, W // 2 + 24
    out = new(W, 96); out.alpha_composite(t.crop((0, 0, W, 96)))
    q = out.load()
    for y in range(90, 96):
        for x in range(W):
            if sx0 + 4 <= x < sx1 - 4:
                k = (y - 90) % 4
                c = CRM[(6, 5, 4, 3)[k]]
                c = weather(c, 1.1)
                if x < sx0 + 6 or x >= sx1 - 6: c = mul(c, 0.75)
                if moss_at(x, y, seed + 9) > 0.66: c = DM[2]
                q[x, y] = c + (255,)
            else:
                q[x, y] = (0, 0, 0, 0)
    out = waterline(out, 89, seed + 10, wet=7, keep_x=lambda x: sx0 + 4 <= x < sx1 - 4)
    return pz.fin(out)

# ================================================================ 앵커 2: 물에 잠긴 옛 탑 첨두 (3x5칸)
def spire_sunken(seed=5):
    """버들항 원탑(tower6)이 통째로 늪에 가라앉아 고깔 지붕과 맨 윗단(창 하나, 내민 돌 띠)만 물 위로 나왔다.
    슬레이트는 이끼 슬레이트로 바래고 한쪽 비늘이 떨어져 나갔으며, 꼭대기 쇠막대는 구부러졌다."""
    t = castle6.tower6(wc=3, body=40, cone=48, tiers=1, flag=None)
    W = t.width; Hc = 8 + 48 + 5 + 20
    t = t.crop((0, 0, W, Hc)); p = t.load(); H = Hc
    def roofsel(x, y, c):
        r, g, b, a = c
        return y < 61 and b > r + 8          # 보랏빛 슬레이트
    t = remap(t, SLM, roofsel, t0=1, t1=6)
    t = age(t, 1.0); p = t.load()
    for y in range(0, 10):                     # 꼭대기 쇠막대: 구부러짐
        for x in range(W):
            if p[x, y][3] and y < 9: p[x, y] = (0, 0, 0, 0)
    for i, (x, y) in enumerate(((23, 8), (23, 7), (23, 6), (24, 5), (25, 4), (26, 4))):
        put(p, W, H, x, y, (58, 54, 44) if i % 2 else (96, 88, 70)); put(p, W, H, x + 1, y + 1, (30, 28, 24))
    # 떨어져 나간 비늘(왼쪽 아래): 속 서까래
    for y in range(34, 50):
        for x in range(6, 22):
            e = ((x - 13) / 8.0) ** 2 + ((y - 42) / 6.0) ** 2 + (vnoise(x, y, 2.5, seed) - 0.5) * 0.6
            if e < 1 and p[x, y][3]:
                p[x, y] = ((10, 13, 12) if abs((x - 13) - (y - 42) * 0.5) > 1 else BK[2]) + (255,)
            elif e < 1.35 and p[x, y][3] and y < 42: p[x, y] = SLM[6] + (255,)
    for y in range(8, 62):
        for x in range(W):
            if not p[x, y][3] or not roofsel(x, y, (0, 0, 10, 1)) and y < 56: pass
            m = vnoise(x, y, 4, seed + 2) * 0.7 + vnoise(x, y, 1.7, seed + 3) * 0.3
            if p[x, y][3] and y < 60 and m > 0.78 - 0.12 * (y / 60.0) and lumi(p[x, y]) > 30: p[x, y] = (DM[2] if m < 0.80 else DM[3]) + (255,)
    moss_patch(p, W, H, 0, W, 60, 70, seed + 4, 0.5)
    for vx in (8, 37): beard(p, W, H, vx, 60, 6 + int(_hash(vx, 0, seed) * 6), seed + vx)
    ivy(p, W, H, 30, 64, H, seed + 7)
    out = new(W, 96); out.alpha_composite(t, (0, 92 - H))
    out = waterline(out, 91, seed + 8, wet=6)
    return pz.fin(out)

# ================================================================ 앵커 5: 안개 섬 오두막 폐허 (4x5칸)
def hut_ruin(seed=7):
    """늪 마을 널집(varlib.house 'wod', 묵은 이엉)이 버려져 무너졌다: 이엉 지붕 가운데가 내려앉아 서까래와 속 어둠,
    문짝은 떨어져 어두운 문간, 창은 깨져 검고, 오른쪽 아래 널벽 몇 장이 빠졌다. 지붕에 이끼, 처마에 이끼 수염."""
    im, nr, Hh = varlib.house('wod', [('lwdr', 'eave', 'base')], 3, None, 'swamp', seed, roofmat='thatchold')
    import pj
    im = pj.outlined(im); p = im.load(); W, H = im.size
    roof_h = nr * 16
    # 지붕 구멍(가운데 오른쪽)
    def hole(x, y):
        e = ((x - W * 0.60) / 11.0) ** 2 + ((y - roof_h * 0.50) / 9.0) ** 2 + (vnoise(x, y, 2.5, seed) - 0.5) * 0.9
        return e < 1.0
    for y in range(roof_h + 4):
        for x in range(W):
            if not p[x, y][3]: continue
            if hole(x, y):
                c = (12, 10, 8) if y > roof_h * 0.35 else (20, 16, 12)
                u = x - (W * 0.52 + (y - 6) * 0.5)
                if 0 <= u < 2: c = BK[2] if u < 1 else BK[1]                        # 남은 서까래
                if abs(y - roof_h * 0.62) < 1 and _hash(x // 3, 1, seed) < 0.7: c = BK[3]
                p[x, y] = c + (255,)
            elif hole(x, y + 1) or hole(x - 1, y) or hole(x + 1, y):
                r, g, b, a = p[x, y]; p[x, y] = (min(255, int(r * 1.25)), min(255, int(g * 1.2)), int(b * 1.1), 255)   # 짚 끝(밝다)
    # 이엉 이끼(아래쪽 처마로 갈수록)
    moss_patch(p, W, H, 0, W, int(roof_h * 0.3), roof_h + 2, seed + 1, 0.60)
    # 문·창 → 어둠
    for y in range(roof_h, H):
        for x in range(W):
            r, g, b, a = p[x, y]
            if not a: continue
            if b > r + 10 and b > 60:                                               # 창유리 → 깨진 어둠
                p[x, y] = ((14, 18, 20) if _hash(x, y, seed + 2) < 0.85 else (90, 110, 120)) + (255,)
    # 문짝 칸 찾기: 'lwdr' 에서 문 = 셋째 칸(x 32..47)
    dx0, dx1 = 32 + 4, 32 + 12
    for y in range(roof_h + 8, H - 2):
        for x in range(dx0, dx1):
            if p[x, y][3]: p[x, y] = ((10, 8, 8) if y > roof_h + 10 else (22, 16, 12)) + (255,)
    for y in range(roof_h + 12, H - 6):                                             # 한쪽 경첩에 매달린 문짝 한 장
        put(p, W, H, dx1, y, BK[3]); put(p, W, H, dx1 + 1, y, BK[2])
    # 빠진 널(오른쪽 아래)
    for y in range(H - 12, H - 3):
        for x in range(W - 13, W - 4):
            if p[x, y][3] and (y + x // 4) % 5 < 2 and _hash(x // 4, y // 3, seed + 3) < 0.6: p[x, y] = (14, 10, 8, 255)
    for vx in (3, W - 5): beard(p, W, H, vx, roof_h + 1, 5 + int(_hash(vx, 5, seed) * 5), seed + vx)
    ivy(p, W, H, 6, roof_h + 4, H - 2, seed + 4)
    return im

def hut_debris(seed=8):
    """무너진 널·서까래 더미(2x1칸): 썩은 널 세 장이 엇갈려 쌓이고 부러진 서까래 하나가 걸쳤다(윗면 밝음·앞면 어둠)."""
    c = C(32, 16, seed=1700 + seed); c.shadow(16, 13.5, 15, 2)
    c.group(1); c.box(2, 8, 26, 2, 3, 'wood', top=0.95, front=0.5)
    c.group(2); c.box(6, 5, 22, 2, 3, 'wood', top=1.0, front=0.55, bias=0.05)
    c.group(3); c.box(1, 10, 14, 2, 3, 'wood', top=0.9, front=0.5, bias=-0.04)
    im = pz.fin(c); p = im.load()
    for y in range(16):
        for x in range(32):
            if p[x, y][3]: p[x, y] = remap_px(p[x, y], WOOD) + (255,)
    for i in range(20):                                             # 부러진 서까래(비스듬, 걸침)
        x = 9 + i; y = 3 + int(i * 0.3)
        put(p, 32, 16, x, y, BK[4]); put(p, 32, 16, x, y + 1, BK[2]); put(p, 32, 16, x, y + 2, BK[0])
    for x in (12, 20, 25): put(p, 32, 16, x, 9, WOOD[1])               # 널 이음
    moss_patch(p, 32, 16, 0, 32, 0, 16, seed, 0.74)
    return pz.fin(im)

# ================================================================ 나무
def _crown(px, W, H, cx, cy, rx, ry, seed, step=9.0, dark=1, back=True):
    """참나무식 수관(고대 숲과 같은 방법): 격자 덩이 + 가장자리 들쭉날쭉 덩이. 늪이라 한 단 어둡게."""
    r = random.Random(seed)
    def layer(ox, oy, k, dk, sd, ring=True):
        cl = []; j = 0; y = cy - ry * k
        while y <= cy + ry * k:
            x = cx - rx * k + (j % 2) * step / 2
            while x <= cx + rx * k:
                dx = (x - cx) / (rx * k); dy = (y - cy) / (ry * k)
                if dx * dx + dy * dy <= 1.0:
                    cl.append((x + ox + (r.random() - 0.5) * 3, y + oy + (r.random() - 0.5) * 3, 7.0 + r.random() * 2, 5.8 + r.random() * 1.4))
                x += step
            y += step * 0.72; j += 1
        if ring:
            n = max(6, int(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / 10))
            for i in range(n):
                a = 2 * math.pi * (i + r.random() * 0.5) / n; q = 0.80 + r.random() * 0.16
                cl.append((cx + ox + math.cos(a) * rx * q, cy + oy + math.sin(a) * ry * q, 6.0 + r.random() * 2.5, 5.0 + r.random() * 1.6))
        cl = [c for c in cl if c[1] - c[3] >= 1 and c[0] - c[2] >= 0 and c[0] + c[2] <= W - 1]
        clumps(px, W, H, cl, dark=dk, seed=sd)
    if back: layer(5, -4, 0.82, dark + 1, seed + 1, ring=False)
    layer(0, 0, 0.70, dark, seed)

def _swampleaf(im, k=0.8):
    """수관 잎을 늪빛으로(칩셋 잎 결 그대로, 채도·명도만)."""
    o = im.copy(); p = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = p[x, y]
            if a and g > r + 10: p[x, y] = swamp_grass((r, g, b), k) + (a,)
    return o

def _proot(px, W, H, x0, y0, x1, y1, bend, th, seed):
    """맹그로브 받침뿌리: 줄기에서 바깥으로 활처럼 휘어 땅(물)에 꽂힌다. 위 가장자리 밝음, 아래 그늘."""
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.4) + 2
    for i in range(n):
        f = i / (n - 1)
        x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f - math.sin(f * math.pi) * bend
        t = max(1.0, th * (1 - f * 0.45))
        for k in range(-1, int(t) + 2):
            yy = int(round(y + k - t / 2)); xx = int(round(x))
            if k == -1 or k == int(t) + 1: c = BK[0]
            elif k == 0: c = BK[4]
            elif k < t * 0.6: c = BK[3]
            else: c = BK[2]
            if (k in (-1, int(t) + 1)) and 0 <= xx < W and 0 <= yy < H and px[xx, yy][3] and px[xx, yy][:3] != BK[0]: continue
            put(px, W, H, xx, yy, c)

def mangrove(wc=5, hc=6, seed=1, roots=8):
    """맹그로브: 낮게 퍼진 넓고 어두운 수관(칩셋 참나무 잎 덩이) 밑으로 짧은 줄기가 굵은 받침뿌리 여러 가닥으로 갈라져
    활처럼 휘어 물·진흙에 꽂힌다(뿌리 우리 사이로 바닥이 비친다). 이끼 수염·덩굴. 밑동 줄(아랫줄 가운데)만 막힘."""
    W, H = wc * 16, hc * 16; im = new(W, H); px = im.load(); cx = W / 2
    tb = H - 26; tt = int(H * 0.40)
    r = random.Random(seed + 40)
    ends = []
    order = sorted(range(roots), key=lambda i: abs(i - (roots - 1) / 2), reverse=True)   # 바깥 뿌리부터(뒤) → 가운데(앞)
    for i in order:
        f = (i + 0.5) / roots
        ex = 4 + f * (W - 8) + r.uniform(-2, 2)
        side = (ex - cx) / (W / 2)
        sx = cx + side * 6 + r.uniform(-1, 1)
        sy = tb + 2 + r.uniform(-3, 3)
        ey = H - 2 - r.uniform(0, 2)
        ends.append(ex)
        _proot(px, W, H, sx, sy, ex, ey, 6 + abs(side) * 7 + r.uniform(-1, 1), 4.6 - abs(side) * 1.6, seed + i)
    AF.trunk(px, W, H, cx, tt, tb + 4, 5.0, 8.0, seed)
    for (sx, ex, ey) in ((-2, -W * 0.27, tt - 4), (2, W * 0.26, tt - 2)):
        AF.branch(px, W, H, cx + sx, tt + 7, cx + ex, ey, 4, seed)
    for k, (bx, L) in enumerate(((cx - W * 0.33, 26), (cx + W * 0.30, 20))):     # 가지에서 내려오는 가는 기근
        x = bx
        for y in range(int(H * 0.40), min(H - 2, int(H * 0.40) + L)):
            x += (0.35 if _hash(k, y, seed) < 0.3 else (-0.35 if _hash(k, y, seed + 1) < 0.3 else 0))
            put(px, W, H, int(x), y, BK[2] if y % 4 else BK[3])
    _crown(px, W, H, W / 2, H * 0.30, W / 2 - 3, H * 0.27, seed, dark=1)
    for k in range(6):
        vx = int(6 + (W - 12) * (k + 0.5) / 6 + (_hash(k, 0, seed) - 0.5) * 6)
        top = int(H * 0.30 + H * 0.27 * math.sqrt(max(0, 1 - ((vx - W / 2) / (W / 2 - 3)) ** 2)) * 0.80)
        beard(px, W, H, vx, top, 7 + int(_hash(k, 1, seed) * 10), seed + k)
    ivy(px, W, H, int(cx - 3), tt + 2, tb, seed + 9)
    im = pz.fin(im); px = im.load()
    for ex in ends:
        for dx in (-3, -2, 2, 3):
            xx = int(ex) + dx
            if 0 <= xx < W and _hash(int(ex), dx, seed) < 0.6 and not px[xx, H - 1][3]: put(px, W, H, xx, H - 1, MURK[5])
    return _swampleaf(im, 0.85)

def bald_cypress(seed=2, hc=6):
    """낙우송: 밑동이 넓게 퍼진 골진 줄기(판근), 층진 좁은 수관(칩셋 잎 덩이), 이끼 수염. 둘레에 공기뿌리(무릎) 몇 개. 2x6칸."""
    W, H = 48, hc * 16; im = new(W, H); px = im.load(); cx = W / 2
    tb = H - 4
    for y in range(int(H * 0.30), tb + 1):                     # 줄기: 위는 가늘고 밑동에서 활짝(판근)
        f = (y - H * 0.30) / (tb - H * 0.30)
        hw = 3.0 + 9.0 * (f ** 4.0)
        x0 = int(round(cx - hw)); x1 = int(round(cx + hw))
        for x in range(x0, x1 + 1):
            c = AF.bark_px(x, y, x0, x1, seed)
            if f > 0.6 and (x - x0) % 4 == 3: c = BK[1]           # 판근 골
            put(px, W, H, x, y, c)
        put(px, W, H, x0 - 1, y, BK[0]); put(px, W, H, x1 + 1, y, BK[0])
    for (ccy, rx, ry, sd) in ((H * 0.42, 15, 9, 1), (H * 0.28, 13, 9, 2), (H * 0.15, 10, 8, 3)):
        cl = []
        rr = random.Random(seed + sd)
        for i in range(9):
            a = math.pi * (i / 8.0); 
            cl.append((cx + math.cos(a) * rx * 0.8 + rr.uniform(-2, 2), ccy - math.sin(a) * ry * 0.45 + rr.uniform(-1, 2), 6 + rr.random() * 2, 4.6 + rr.random()))
        cl.append((cx, ccy - 2, 8, 5))
        cl = [c for c in cl if c[0] - c[2] >= 0 and c[0] + c[2] <= W - 1 and c[1] - c[3] >= 0]
        clumps(px, W, H, cl, dark=1, seed=seed + sd)
    for k in range(4):
        vx = int(cx - 13 + k * 8 + _hash(k, 2, seed) * 3)
        beard(px, W, H, vx, int(H * 0.44), 6 + int(_hash(k, 3, seed) * 8), seed + 20 + k)
    for (kx, kh) in ((5, 5), (W - 7, 4), (cx - 15, 3)):          # 무릎 뿌리(작은 원뿔)
        kx = int(kx)
        for j in range(kh):
            for i in range(-(j // 2) - 1, (j // 2) + 1):
                put(px, W, H, kx + i, tb - kh + j + 1, BK[4] if i < 0 else BK[2])
        put(px, W, H, kx, tb - kh, BK[3])
    return _swampleaf(pz.fin(im), 0.85)

def dead_tree(seed=4, wet=False):
    """늪 고사목: 잎 없는 회갈 줄기, 부러진 우듬지, 가지 셋, 선반버섯, 늘어진 이끼 수염. wet=True 면 밑동이 물에 잠김. 2x4칸."""
    W, H = 32, 64; im = new(W, H); px = im.load(); cx = 15
    GB = [(30, 26, 22), (52, 46, 38), (74, 66, 54), (98, 88, 72), (122, 110, 90), (146, 134, 110)]
    for y in range(14, H - 3):
        f = (y - 14) / (H - 17); hw = 2.4 + 2.6 * f ** 2.5
        x0 = int(round(cx - hw)); x1 = int(round(cx + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0 + 0.5) / max(1, x1 - x0 + 1); t = 4.6 - u * 3.6
            if _hash(x, y // 3, seed) < 0.12: t -= 1.3
            put(px, W, H, x, y, GB[max(0, min(5, int(round(t))))])
        put(px, W, H, x0 - 1, y, GB[0]); put(px, W, H, x1 + 1, y, GB[0])
    for i, x in enumerate(range(cx - 2, cx + 3)):                # 부러진 우듬지(들쭉날쭉)
        for y in range(10 + int(_hash(x, 0, seed) * 4), 15): put(px, W, H, x, y, GB[4 - i % 3])
    for (x0, y0, x1, y1, th) in ((cx, 30, 3, 17, 2.4), (cx + 1, 24, 28, 12, 2.2), (cx, 40, 27, 31, 1.8), (6, 21, 2, 14, 1.2), (24, 16, 27, 9, 1.2)):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            f = i / max(1, n - 1); x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            t = max(1, int(round(th * (1 - f * 0.6))))
            for k in range(t + 1): put(px, W, H, int(round(x)), int(round(y)) + k, GB[0] if k == t else (GB[4] if k == 0 else GB[3]))
    for (fx, fy, fw) in ((cx - 5, 44, 4), (cx + 3, 36, 3)):       # 선반버섯
        for i in range(fw):
            put(px, W, H, fx + i, fy, (196, 150, 92)); put(px, W, H, fx + i, fy + 1, (150, 100, 58))
        put(px, W, H, fx - 1, fy + 1, (98, 64, 38)); put(px, W, H, fx + fw, fy + 1, (98, 64, 38))
    for vx, top in ((4, 15), (27, 11), (24, 33)): beard(px, W, H, vx, top, 6 + int(_hash(vx, 4, seed) * 6), seed + vx)
    im = pz.fin(im)
    if wet: im = waterline(im, H - 5, seed + 3, wet=5)
    return im

# ================================================================ 물에 잠긴 유적 조각
def sunken_arch(seed=7):
    """물에 잠긴 옛 아치(4x4칸): 고대 숲 「무너진 아치 문」(버들항 마름돌)의 다리가 늪에 잠겨 아치 고리와 기둥 윗부분만 나왔다."""
    im = age(AF.arch_ruined(seed), 0.6)
    im = waterline(im, 55, seed + 1, wet=6)
    p = im.load()
    for vx in (8, 52): beard(p, 64, 64, vx, 10 if vx < 30 else 24, 6 + int(_hash(vx, 0, seed) * 6), seed + vx)
    return im

def pillar_water(kind=0, seed=1):
    """물에 잠긴 옛 기둥(1x3칸): 받침은 물 밑, 기둥 몸만 나왔다. kind 0 = 온전(기둥머리), 1 = 중간에서 부러짐, 2 = 낮은 토막."""
    if kind == 0: im = AF.pillar(4, seed=seed)
    elif kind == 1: im = AF.pillar(4, broken=26, seed=seed)
    else: im = AF.pillar(4, broken=12, seed=seed)
    im = age(im, 1.4); q = im.load()
    for y in range(im.height):
        for x in range(16):
            if q[x, y][3]: q[x, y] = mul(q[x, y], 0.86) + (255,)
    moss_patch(q, 16, im.height, 0, 16, 30, 56, seed + 8, 0.50)
    im = waterline(im, 54, seed + 4, wet=7)
    out = new(16, 48); out.alpha_composite(im.crop((0, 9, 16, 57)), (0, 0))
    return out

def rock_water(big=True, seed=41):
    """물에 반쯤 잠긴 이끼 바위(칩셋 돌 둥근 덩이 + 윗면 이끼, 물 닿는 곳은 젖어 어둡다). 2x2 또는 1x1칸."""
    Wd, Hd = (32, 32) if big else (16, 16)
    c = C(Wd, Hd, seed=1300 + seed)
    if big:
        c.group(1); c.ellipsoid(13, 19, 11, 10, 'stone', amb=0.22, bump=0.5)
        c.group(2); c.ellipsoid(24, 23, 7, 6, 'stone', amb=0.22, bump=0.5, bias=-0.03)
    else:
        c.group(1); c.ellipsoid(8, 10, 6.5, 5.5, 'stone', amb=0.22, bump=0.5)
    im = AF.recolor_aged(pz.fin(c)); p = im.load()
    for y in range(Hd):
        for x in range(Wd):
            if not p[x, y][3] or p[x, y][:3] == ST[0]: continue
            m = moss_at(x, y, seed)
            lim = Hd * 0.42 + (m - 0.5) * Hd * 0.3
            if y < lim and m > 0.35: p[x, y] = (DM[4] if (m > 0.64 and y < lim - 3) else DM[3] if m > 0.5 else DM[2]) + (255,)
    return waterline(im, Hd - (5 if big else 4), seed + 2, wet=4)

def stepping_stones(seed=43):
    """물 위 디딤돌 셋(2x1칸, 바닥 소품): 납작한 이끼 돌이 수면에 겨우 나왔다."""
    W, H = 32, 16; im = new(W, H); p = im.load()
    for (cx, cy, rx, ry) in ((6, 9, 4.5, 2.6), (16, 6, 4.0, 2.3), (26, 10, 4.8, 2.6)):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if d > 1: continue
                lit = -((x + 0.5 - cx) / rx * 0.5 + (y + 0.5 - cy) / ry * 0.9)
                c = weather(ST[5] if lit > 0.3 else (ST[4] if lit > -0.3 else ST[3]), 1)
                if moss_at(x, y, seed) > 0.58: c = DM[3] if lit > 0 else DM[2]
                if d > 0.75 and y >= cy: c = MURK[2]
                put(p, W, H, x, y, c)
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if _hash(x, cy, seed) < 0.6: put(p, W, H, x, int(cy + ry) + 1, MURK[5])
    return pz.fin(im)

# ================================================================ 소품
def stone_lantern(seed=21, lean=0):
    """이끼 낀 돌 등롱(1x2칸): 받침·기둥·불집(창 안에 푸른 도깨비불)·지붕돌. 밑동 1칸 막힘."""
    c = C(16, 32, seed=1400 + seed); c.shadow(8, 29.5, 6, 1.5)
    c.group(1); c.box(3, 25, 10, 2, 4, 'stone', top=0.95, front=0.55)
    c.group(2); c.box(6, 15, 4, 1, 10, 'stone', top=0.95, front=0.62, bias=0.04)
    c.group(3); c.box(3, 9, 10, 2, 6, 'stone', top=0.98, front=0.6)
    c.group(4); c.box(1, 5, 14, 3, 2, 'stone', top=1.02, front=0.55, bias=0.05)
    c.group(5); c.box(6, 2, 4, 2, 1, 'stone', top=1.0, front=0.6)
    im = AF.recolor_aged(pz.fin(c)); p = im.load()
    for y in range(12, 16):                                   # 불집 창 + 도깨비불
        for x in range(6, 10):
            p[x, y] = (WISP[3] if (y == 13 and x in (7, 8)) else WISP[2] if y >= 13 else WISP[1]) + (255,)
    moss_patch(p, 16, 32, 0, 16, 4, 9, seed, 0.50)
    moss_patch(p, 16, 32, 0, 16, 24, 28, seed + 1, 0.48)
    if lean:
        o = new(16, 32); 
        for y in range(32):
            sh = int(round((31 - y) * lean / 31.0))
            for x in range(16):
                if p[x, y][3] and 0 <= x + sh < 16: o.putpixel((x + sh, y), p[x, y])
        im = o
    return im

def wisp(seed=23, n=1):
    """도깨비불(1x1칸, 공중 소품·사람 위): 푸른 초록 불덩이와 꼬리, 둘레에 성긴 빛 점(반투명)."""
    W, H = 16, 16; im = new(W, H); p = im.load()
    pts = [(8, 7)] if n == 1 else [(5, 9), (11, 5)]
    for (cx, cy) in pts:
        for y in range(cy - 4, cy + 5):
            for x in range(cx - 4, cx + 5):
                d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1)
                if d < 1.5: put(p, W, H, x, y, WISP[5])
                elif d < 2.6: put(p, W, H, x, y, WISP[4])
                elif d < 3.4: put(p, W, H, x, y, WISP[3])
                elif d < 4.6 and (x + y) % 2 == 0: put(p, W, H, x, y, WISP[2], 150)
        for k in range(1, 5):                                   # 꼬리(아래 오른쪽으로 흩어짐)
            put(p, W, H, cx + k // 2, cy + 3 + k, WISP[3] if k < 3 else WISP[2], 210 - k * 30)
    return im

def fog_wisp(seed=25, w=4, h=2):
    """안개 자락(사람 위 덧그림, 반투명): 가로로 길게 깔린 옅은 회녹 안개 띠 두세 줄. 속은 체크 디더, 가장자리는 성긴 점."""
    W, H = w * 16, h * 16; im = new(W, H); p = im.load()
    bands = [(H * 0.40, H * 0.22, 0.0), (H * 0.70, H * 0.16, 0.25)]
    for y in range(H):
        for x in range(W):
            v = 0.0
            for (cy, ry, ph) in bands:
                dx = (x + 0.5 - W / 2) / (W / 2); dy = (y + 0.5 - cy - math.sin(x * 0.12 + ph * 9 + seed) * 2.0) / ry
                v = max(v, 1 - dx * dx - dy * dy)
            v += (vnoise(x, y, 6, seed) - 0.5) * 0.6
            if v > 0.55 and (x + y) % 2 == 0: p[x, y] = (196, 210, 198, 84)
            elif v > 0.55: p[x, y] = (184, 200, 188, 60)
            elif v > 0.25 and (x + y) % 2 == 0: p[x, y] = (178, 196, 184, 58)
            elif v > 0.05 and x % 2 == 0 and y % 3 == 0: p[x, y] = (170, 190, 178, 46)
    return im

def log_water(seed=27):
    """물에 반쯤 잠긴 이끼 통나무(3x1칸): 윗등만 물 위, 끝 단면 나이테, 이끼."""
    im = AF.log_mossy(seed, 3); p = im.load()
    for y in range(16):
        for x in range(48):
            if p[x, y][3] and p[x, y][1] > p[x, y][0] + 15: p[x, y] = DM[2 + (y < 5)] + (255,)
    return waterline(im, 10, seed + 1, wet=3)

def stump_fungus(seed=29):
    """썩은 그루터기(1x1칸): 나이테 윗면, 껍질 옆면, 주황 선반버섯 두 층. 1칸 막힘."""
    W, H = 16, 16; im = new(W, H); p = im.load(); cx = 8
    for y in range(5, 15):
        hw = 5.5 + (y - 5) * 0.12
        x0, x1 = int(cx - hw), int(cx + hw)
        for x in range(x0, x1 + 1): put(p, W, H, x, y, AF.bark_px(x, y, x0, x1, seed))
    for y in range(2, 8):
        for x in range(2, 15):
            dx = (x + 0.5 - cx) / 6.0; dy = (y + 0.5 - 5) / 2.6; r2 = dx * dx + dy * dy
            if r2 > 1: continue
            c = (150, 116, 76) if int(math.sqrt(r2) * 4) % 2 == 0 else (124, 92, 58)
            if r2 > 0.8: c = BK[3]
            if r2 < 0.12: c = BK[1]
            put(p, W, H, x, y, c)
    for (fy, x0, x1) in ((9, 10, 15), (12, 11, 16)):
        for x in range(x0, x1):
            put(p, W, H, x, fy, (226, 160, 76) if x < x1 - 1 else (190, 120, 52)); put(p, W, H, x, fy + 1, (150, 86, 40))
    moss_patch(p, W, H, 0, 8, 8, 15, seed, 0.5)
    return pz.fin(im)

SHR = [(40, 24, 44), (70, 44, 74), (104, 72, 108), (140, 106, 140), (178, 150, 170), (214, 196, 206)]   # 독버섯 연보라
def swamp_mushrooms(seed=31):
    """독버섯 무리(1x1칸, 바닥 소품): 연보라 갓(윗면 밝음·밑 테 어둠)에 흰 점, 가는 흰 대."""
    W, H = 16, 16; im = new(W, H); p = im.load(); r = random.Random(seed)
    pts = sorted([(4 + r.randint(-1, 1), 12), (9 + r.randint(-1, 1), 14), (12, 10), (6, 9)][:3 + seed % 2], key=lambda q: q[1])
    for i, (x, y) in enumerate(pts):
        big = i % 2 == 0; st = 3 if big else 2; rx = 3 if big else 2
        for yy in range(y - st, y + 1): put(p, W, H, x, yy, (214, 206, 188) if yy < y else (150, 140, 124))
        cy = y - st - 1
        for xx in range(x - rx, x + rx + 1):
            put(p, W, H, xx, cy + 1, SHR[1]); put(p, W, H, xx, cy, SHR[3] if xx < x else SHR[2])
            if abs(xx - x) < rx: put(p, W, H, xx, cy - 1, SHR[4] if xx <= x else SHR[3])
        put(p, W, H, x - 1, cy - 1, SHR[5]); put(p, W, H, x + 1, cy, SHR[5])
    return pz.fin(im)

def toxic_bubbles(seed=33):
    """독 연못 거품(1x1칸, 물 위 소품): 크고 작은 거품 셋(밝은 테·윗 반짝), 터진 자리 고리."""
    W, H = 16, 16; im = new(W, H); p = im.load()
    for (cx, cy, r) in ((5, 9, 2.6), (11, 6, 1.8), (10, 12, 1.3)):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if d <= r: put(p, W, H, x, y, TOX[6] if (d > r - 0.9 and x < cx and y < cy) else (TOX[5] if d > r - 0.9 else TOX[3]))
        put(p, W, H, int(cx - r * 0.4), int(cy - r * 0.4), (240, 255, 220))
    for (x, y) in ((2, 13), (3, 14), (13, 14), (14, 13), (1, 4), (2, 3)): put(p, W, H, x, y, TOX[5])
    return im

def bones(seed=35):
    """흩어진 짐승 뼈(1x1칸, 바닥 소품): 갈비 몇 대와 긴 뼈 하나, 바랜 회백."""
    W, H = 16, 16; im = new(W, H); p = im.load()
    BN = [(70, 66, 56), (130, 124, 108), (176, 170, 150), (210, 204, 184), (232, 228, 210)]
    for i in range(12):                                         # 긴 뼈(비스듬)
        x = 2 + i; y = 12 - i // 3
        put(p, W, H, x, y, BN[3]); put(p, W, H, x, y + 1, BN[1])
    for (x, y) in ((1, 11), (1, 13), (14, 7), (14, 9)): put(p, W, H, x, y, BN[4])
    for k in range(4):                                          # 갈비(휜 짧은 선)
        x0 = 4 + k * 3
        for j in range(4):
            put(p, W, H, x0 + (1 if j == 0 else 0), 3 + j, BN[3] if j < 2 else BN[2]); put(p, W, H, x0 + 1, 3 + j, BN[1])
    return pz.fin(im)

def skull_stake(seed=37):
    """뿔 달린 짐승 머리뼈를 꽂은 썩은 말뚝(1x2칸): 늪 던전 경계 표시, 끈과 깃털. 밑동 1칸 막힘."""
    W, H = 16, 32; im = new(W, H); p = im.load()
    for y in range(10, 31):
        put(p, W, H, 7, y, WOOD[4]); put(p, W, H, 8, y, WOOD[3]); put(p, W, H, 9, y, WOOD[2])
    BN = [(70, 66, 56), (130, 124, 108), (176, 170, 150), (210, 204, 184), (232, 228, 210)]
    for y in range(4, 12):                                      # 머리뼈(앞에서 본 짐승 머리: 넓은 이마 → 좁은 주둥이)
        hw = 4 if y < 8 else 3 - (y - 8) // 2
        for x in range(8 - hw, 8 + hw + 1):
            c = BN[4] if x < 8 and y < 7 else (BN[3] if x < 9 else BN[2])
            put(p, W, H, x, y, c)
    for (x, y) in ((6, 6), (10, 6)): put(p, W, H, x, y, (20, 16, 14)); put(p, W, H, x, y + 1, (36, 30, 26))   # 눈구멍
    put(p, W, H, 8, 10, BN[1])
    for i in range(4):                                          # 뿔(바깥 위로 휨)
        put(p, W, H, 3 - i // 2, 5 - i, BN[3]); put(p, W, H, 12 + i // 2, 5 - i, BN[2])
    for y in range(14, 17): put(p, W, H, 6, y, (150, 60, 40)); put(p, W, H, 10, y + 1, (60, 90, 60))       # 끈·깃털
    im = pz.fin(im); p = im.load()
    for x in range(5, 12): 
        if not p[x, 31][3]: p[x, 31] = (14, 30, 8, 70)
    return im

REED = [hxs(c) for c in ('#1c2410', '#38401c', '#586028', '#7c8438', '#a0a44c', '#c4c46c', '#e4e090')]
def cattail(seed=39, n=5, h=2):
    """부들 덤불(1x2칸): 가는 잎 여러 장 + 갈색 이삭 방망이. 키 큰 부드러운 물체라 밑동 1칸만 막힘."""
    W, H = 16, h * 16; im = new(W, H); p = im.load(); r = random.Random(seed)
    for k in range(n + 3):                                      # 잎(휘어진 띠)
        x0 = 2 + r.randint(0, 11); top = r.randint(6, H - 12); lean = r.choice((-1, 0, 1))
        for y in range(top, H - 1):
            f = (H - 1 - y) / max(1, H - 1 - top)
            x = x0 + int(round(lean * f * f * 3))
            put(p, W, H, x, y, REED[4] if f > 0.6 else (REED[3] if f > 0.25 else REED[2]))
            if f < 0.4 and k % 2: put(p, W, H, x + 1, y, REED[2])
    for k in range(n):                                          # 이삭
        x = 3 + int((k + 0.5) * 10 / n) + r.randint(-1, 1); top = r.randint(1, 7)
        for y in range(top + 6, H - 1): put(p, W, H, x, y, REED[3] if y % 3 else REED[2])
        for y in range(top, top + 6):
            put(p, W, H, x, y, (126, 78, 44) if y < top + 2 else (98, 58, 32)); put(p, W, H, x + 1, y, (70, 40, 24))
        put(p, W, H, x, top - 1, REED[5]); put(p, W, H, x, top - 2, REED[4])
    return pz.fin(im)

def reed_tuft(seed=41):
    """작은 갈대 포기(1x1칸, 바닥 소품·걸음): 진흙·물가에 흩어 심는다."""
    W, H = 16, 16; im = new(W, H); p = im.load(); r = random.Random(seed)
    for k in range(7):
        x0 = 3 + r.randint(0, 9); top = r.randint(3, 9); lean = r.choice((-1, 1))
        for y in range(top, 15):
            f = (14 - y) / max(1, 14 - top); x = x0 + int(round(lean * f * f * 2))
            put(p, W, H, x, y, REED[5] if f > 0.7 else (REED[4] if f > 0.3 else REED[2]))
    return pz.fin(im)

def lily_cluster(seed=43, flower=True):
    """연잎 무리(2x1칸, 물 위 소품): 홈 파인 둥근 연잎 다섯(왼쪽 위 밝음), 분홍 연꽃 하나."""
    W, H = 32, 16; im = new(W, H); p = im.load(); r = random.Random(seed)
    LL = [(20, 58, 39), (44, 100, 56), (70, 138, 64), (110, 178, 86), (150, 208, 112)]
    pads = [(6, 8, 4.5), (15, 5, 3.6), (24, 9, 4.8), (12, 12, 3.2), (28, 4, 2.6)]
    for i, (cx, cy, rr) in enumerate(pads):
        ang0 = r.uniform(0, 6.28)
        for y in range(int(cy - rr * 0.7) - 1, int(cy + rr * 0.7) + 2):
            for x in range(int(cx - rr) - 1, int(cx + rr) + 2):
                dx = (x + 0.5 - cx) / rr; dy = (y + 0.5 - cy) / (rr * 0.65); d = dx * dx + dy * dy
                if d > 1: continue
                a = math.atan2(dy, dx)
                if abs(((a - ang0 + math.pi) % (2 * math.pi)) - math.pi) < 0.32 and d > 0.15: continue   # 홈
                t = 3 if (dx < 0 and dy < 0) else 2
                if d > 0.72: t = 1 if dy > 0 else 3
                if x == int(cx) and abs(dy) < 0.6: t = 1
                put(p, W, H, x, y, LL[t])
        for x in range(int(cx - rr), int(cx + rr) + 1):
            if _hash(x, i, seed) < 0.5: put(p, W, H, x, int(cy + rr * 0.65) + 1, MURK[5])
    if flower:
        fx, fy = 16, 4
        for (dx, dy, c) in ((0, 0, (255, 226, 238)), (-1, 0, (248, 170, 203)), (1, 0, (232, 120, 168)), (0, -1, (248, 170, 203)), (-2, 1, (232, 120, 168)),
                            (2, 1, (200, 90, 140)), (0, 1, (255, 236, 160)), (-1, -2, (248, 170, 203)), (1, -2, (232, 120, 168))):
            put(p, W, H, fx + dx, fy + dy, c)
    return im

def deck_post(seed=45, rope=False):
    """널다리 곁 물에 박힌 썩은 말뚝(1x2칸): 윗면 나이테, 이끼 띠, 물 닿는 곳 물결. rope=True 면 굵은 밧줄이 감겼다."""
    c = C(16, 32, seed=1500 + seed)
    c.group(1); c.cylinder(8, 6, 28, 3.2, 'wood', capry=1.4, amb=0.25)
    im = pz.fin(c); p = im.load()
    for y in range(32):
        for x in range(16):
            if p[x, y][3]: p[x, y] = remap_px(p[x, y], WOOD) + (255,)
    moss_patch(p, 16, 32, 0, 16, 19, 27, seed, 0.42)
    if rope:
        for y in (11, 13):
            for x in range(4, 13): put(p, 16, 32, x, y, (150, 128, 84) if (x + y) % 3 else (110, 90, 56)); put(p, 16, 32, x, y + 1, (88, 70, 44))
        for y in range(15, 22): put(p, 16, 32, 12 + (y - 15) // 3, y, (130, 108, 70))
    return waterline(im, 26, seed + 1, wet=4)

def remap_px(c, ramp):
    L = lumi(c); t = 1 + int(min(5, max(0, (L - 20) / 26)))
    return ramp[t]

def deck_broken_end(seed=47):
    """끊긴 널다리 끝(2x1칸): 왼쪽 칸은 성한 널다리(널다리 오토타일과 같은 널), 오른쪽 칸에서 들보가 부러져
    널 몇 장이 물속으로 비스듬히 처박혔고 부러진 말뚝 하나가 솟았다. 왼쪽 끝을 널다리 끝에 붙인다."""
    W, H = 32, 16; im = new(W, H); p = im.load()
    im.alpha_composite(deck_cell(8 | 2, 'h', 0, 0, seed).crop((0, 0, 16, 16)), (0, 0))
    q = deck_cell(8, 'h', 16, 0, seed).load()
    for y in range(16):                                         # 오른쪽 칸: 널이 부러져 아래로 처짐(오른쪽으로 갈수록 더)
        for x in range(16):
            if not q[x, y][3]: continue
            board = (16 + x) // 5
            drop = int(max(0, x - 2) * (0.35 + 0.15 * (board % 3)))
            if x > 11 and board % 2: continue                   # 끝에서 빠진 널
            yy = y + drop
            if yy >= 16: continue
            c = q[x, y][:3]
            if drop > 3: c = mul(c, 0.8)
            if yy >= 12 and drop > 2: c = mix(c, MURK[3], 0.5)    # 물에 잠기는 끝
            put(p, W, H, 16 + x, yy, c)
    for y in range(1, 13):                                      # 부러진 말뚝
        put(p, W, H, 26, y, WOOD[4]); put(p, W, H, 27, y, WOOD[3]); put(p, W, H, 28, y, WOOD[2])
    for x, y in ((26, 0), (28, 1)): put(p, W, H, x, y, WOOD[5])
    im = pz.fin(im); p = im.load()
    for x in range(18, 32):
        if _hash(x, 0, seed) < 0.5 and not p[x, 15][3]: p[x, 15] = MURK[5] + (255,)
    return im

def sunken_boat(seed=49):
    """가라앉은 나룻배(3x1칸): 뾰족한 뱃머리(왼쪽 위)만 물 위로 들리고 고물 쪽은 물에 잠겨 뱃전 끝만 보인다.
    두 뱃전 테(위 밝음)·늑골·바닥 널, 배 안에 고인 물, 앞쪽 뱃전 바깥면 2줄(3/4)."""
    W, H = 48, 16; im = new(W, H); p = im.load()
    bow = (3, 3); L = 40
    def rim(t):                                                    # t 0..1 뱃머리→고물: 위·아래 뱃전 y
        cx = bow[0] + t * L
        top = bow[1] + 1.0 * math.sqrt(t) * 2 + t * 1.0
        bot = bow[1] + 9.0 * math.sqrt(min(1, t * 1.8)) + t * 0.5
        return cx, top, bot
    for k in range(L * 3):
        t = k / (L * 3.0)
        cx, top, bot = rim(t)
        x = int(round(cx))
        sunk = t > 0.62
        for y in range(int(top) + 1, int(bot)):                    # 배 안
            if sunk: c = MURK[3] if (x + y) % 6 else MURK[5]
            elif t > 0.40: c = MURK[2] if (x + y) % 5 else MURK[4]
            else: c = WOOD[2] if x % 5 else WOOD[1]
            put(p, W, H, x, y, c)
        if not sunk or _hash(x, 0, seed) < 0.35:
            put(p, W, H, x, int(round(top)), WOOD[5]); put(p, W, H, x, int(round(top)) + 1, WOOD[3])
        if not sunk or _hash(x, 1, seed) < 0.25:
            put(p, W, H, x, int(round(bot)), WOOD[4]); put(p, W, H, x, int(round(bot)) + 1, WOOD[2])
            if t < 0.55: put(p, W, H, x, int(round(bot)) + 2, WOOD[1])
    for t in (0.18, 0.30, 0.42, 0.54):                               # 늑골
        cx, top, bot = rim(t); x = int(round(cx))
        for y in range(int(top) + 2, int(bot)): put(p, W, H, x, y, WOOD[3])
    moss_patch(p, W, H, 0, 26, 0, H, seed, 0.66)
    im = pz.fin(im); p = im.load()
    for x in range(26, 47):                                         # 잠긴 쪽 물결
        if _hash(x, 2, seed) < 0.5:
            _, top, bot = rim((x - 3) / 40.0)
            y = int(bot) + 2
            if 0 <= y < H and not p[x, y][3]: p[x, y] = MURK[5] + (255,)
    return im

def vine_curtain(seed=51, w=2):
    """늘어진 덩굴 발(2x2칸, 사람 위 덧그림): 가지에서 드리운 덩굴과 이끼 수염 여러 가닥."""
    W, H = w * 16, 32; im = new(W, H); p = im.load()
    for x in range(W): put(p, W, H, x, 1 + int(math.sin(x * 0.3) * 1.2), BK[3]); put(p, W, H, x, 2 + int(math.sin(x * 0.3) * 1.2), BK[1])
    for k in range(w * 4):
        vx = 2 + k * 4 + int(_hash(k, 0, seed) * 2)
        L = 10 + int(_hash(k, 1, seed) * 18)
        if k % 2: beard(p, W, H, vx, 3, L, seed + k)
        else:
            xx = vx
            for y in range(3, 3 + L):
                put(p, W, H, xx, y, DM[1])
                if y % 3 == 0: put(p, W, H, xx - 1, y, DM[3]); put(p, W, H, xx + 1, y + 1, DM[2])
    return im

def barrel_broken(seed=53):
    """깨진 나무통(1x1칸): 테가 풀려 널 몇 장이 벌어진 썩은 통, 안은 어둠. 1칸 막힘."""
    c = C(16, 16, seed=1600 + seed); c.shadow(8, 13.5, 6, 1.5)
    c.group(1); c.cylinder(8, 5, 13, 5.2, 'wood', capry=2.2, amb=0.22)
    im = pz.fin(c); p = im.load()
    for y in range(16):
        for x in range(16):
            if p[x, y][3]: p[x, y] = remap_px(p[x, y], WOOD) + (255,)
    for y in range(3, 8):
        for x in range(5, 12):
            if ((x + 0.5 - 8) / 4.2) ** 2 + ((y + 0.5 - 5) / 1.8) ** 2 < 1: p[x, y] = (12, 10, 8, 255)
    for y in (7, 11):
        for x in range(3, 14):
            if p[x, y][3] and (x < 9 or y == 11): p[x, y] = (70, 62, 54, 255)
    for (x, y) in ((11, 6), (12, 7), (12, 8), (11, 9)): p[x, y] = (0, 0, 0, 0)
    for x in range(12, 15): put(p, 16, 16, x, 13, WOOD[3]); put(p, 16, 16, x + 1, 12, WOOD[4])
    return pz.fin(im)
