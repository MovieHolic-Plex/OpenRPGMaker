# 복사본(2026-10-08): airship/as_rig.py — 그물·등마루 씌운 기낭 완성 조각(rigged_*). 원본이 바뀌면 다시 복사한다.
# 비행선 보정 패스(2026-10-08, WAVE-BRIEF-4) — 기낭 윗면·로프·고정부 덧그림 조각.
# 기존 기낭 조각(envelope_tail/body/body_patched/nose)은 그대로 두고, 같은 칸에 겹쳐 그리는 투명 덧그림을 더한다:
#   envelope_rigging_tail / envelope_rigging / envelope_rigging_nose — 기낭 위를 덮는 삼 밧줄 그물(마름모, 원통 곡면을 따라 위·아래로 촘촘),
#     3/4 윗면 등마루(ridge, 기낭 윗면이 화면 위 윤곽보다 안쪽에 보이는 선)를 따라 놓인 널 통로와 먼 쪽 놋쇠 난간,
#     짐 띠의 놋쇠 죔쇠(그물 V 가 모이는 자리), 죔쇠에서 바닥 고리로 내려가는 매달기 줄.
#   envelope_valve — 등마루 통로 위 가스 빼는 놋쇠 밸브(둥근 덮개 윗면 + 테 + 당김줄 고리).
# 원통 기하: 화면 y = ECY - r·cos β (β = 화면 위 윤곽에서 잰 각), 등마루 β_r = acos(RIDGE), 곡면 위 길이 s = r(β - β_r).
# 그물 줄 = x = 32k ± A·s. A 를 짐 띠까지의 길이에 맞춰 V 꼭지가 32k+16(= 바닥 고리·매다는 줄 자리)에 떨어지게 한다.
import math
from as_kit import *
from as_kit import _hash
import as_env as EV

ECY, ER, ENV_H = EV.ECY, EV.ER, EV.ENV_H
RIDGE = 0.72                                   # 등마루 = ECY - 0.72 r (v ≈ 0.14, 가장 밝은 띠 안)
BAND = -0.58                                   # 짐 띠 = ECY + 0.58 r (as_env 의 v .79)
B_R = math.acos(RIDGE); B_B = math.acos(BAND)
A = 48.0 / (ER * (B_B - B_R))                  # 몸통에서 등마루 → 짐 띠 사이 그물 줄이 가로로 48px 간다 → V 꼭지 32k+16
L = 2000

def _kband(v):
    return 6 if v < .2 else (5 if v < .42 else (4 if v < .6 else 3))

def _env_mask(W, x_of, fin_poly=None):
    """기낭 천 화소(지느러미·윤곽 제외) 마스크."""
    m = [[False] * W for _ in range(ENV_H)]
    fm = Mk(W, ENV_H).poly(fin_poly) if fin_poly else None
    for y in range(ENV_H):
        for x in range(W):
            xg = x_of(x)
            if xg < 0 or EV.env_tone(xg, y, L) is None: continue
            if fm and fm.at(x, y): continue
            m[y][x] = True
    inner = [[False] * W for _ in range(ENV_H)]
    for y in range(1, ENV_H - 1):
        for x in range(W):
            if not m[y][x]: continue
            ok = m[y - 1][x] and m[y + 1][x] and (x == 0 or m[y][x - 1]) and (x == W - 1 or m[y][x + 1])
            inner[y][x] = ok
    return inner

def rigging(W, x_of, drops=(), fin_poly=None, walk=None):
    """W = 조각 폭, x_of(x) = 기낭 길이 좌표, drops = 매달기 줄 x(조각 기준), walk = (x0, x1) 등마루 통로 범위(조각 기준)."""
    cv = Cv(W, ENV_H); p = cv.im.load()
    inner = _env_mask(W, x_of, fin_poly)
    def geo(x, y):
        r = EV.env_r(x_of(x) + .5, L)
        if r < 4: return None
        cb = (ECY - (y + .5)) / r
        if abs(cb) >= 1: return None
        b = math.acos(cb)
        return r, b, (1 - cb) / 2
    # 1) 그물(등마루 ~ 짐 띠): 마름모 줄. 줄 바로 아래 한 화소는 천에 진 그늘.
    rope = set()
    for y in range(ENV_H):
        for x in range(W):
            if not inner[y][x]: continue
            g = geo(x, y)
            if not g: continue
            r, b, v = g
            if v < .045 or v > .785: continue
            s = r * (b - B_R)
            dsdy = 1.0 / max(math.sin(b), .18)
            half = .5 * max(1.0, A * dsdy)
            for sg in (1, -1):
                d = (x - sg * A * s) % 32.0
                if min(d, 32 - d) < half: rope.add((x, y)); break
    for (x, y) in rope:
        r, b, v = geo(x, y)
        k = _kband(v)
        far = b < B_R                                                   # 등마루 너머(먼 쪽) 줄은 한 단 옅게
        c = ROPE[clamp(k - (0 if far else 1), 1, 6)]
        if (x + y) % 3 == 0: c = ROPE[clamp(k - (1 if far else 2), 1, 6)]   # 꼬임 결
        cv.px(x, y, c)
        if (x, y + 1) not in rope and y + 1 < ENV_H and inner[y + 1][x] and not far:
            cv.px(x, y + 1, mul(CNV[clamp(k - 1, 1, 6)], .96))
    # 2) 짐 띠 놋쇠 죔쇠(V 꼭지마다, 32k+16) — 띠 위 3×4
    for x0 in range(16, W, 32):
        g = None
        for y in range(ENV_H):
            if inner[y][x0]:
                gg = geo(x0, y)
                if gg and gg[2] >= .79: g = (y, gg); break
        if not g or g[1][2] > .83 or g[1][0] < .8 * ER: continue          # 짐 띠 위·굵은 몸통에서만(꼬리·코 끝, 지느러미 밑 제외)
        yb = g[0]
        for dy in range(-1, 4):
            for dx in (-1, 0, 1):
                c = BR[6] if (dy == -1 and dx < 1) else (BR[5] if dx == -1 else (BR[4] if dx == 0 else BR[2]))
                if dy == 3: c = BR[2] if dx < 1 else BR[1]
                cv.px(x0 + dx, yb + dy, c)
        cv.px(x0, yb + 1, BR[1])                                         # 죔쇠 구멍
    # 3) 매달기 줄: 죔쇠에서 기낭 바닥 고리까지(바닥 그물 위를 곧게) — 왼쪽 빛 · 오른쪽 그늘 두 화소
    for x0 in drops:
        r = EV.env_r(x_of(x0) + .5, L)
        y0 = int(ECY - BAND * r) + 4; y1 = int(ECY + r) - 1
        for y in range(y0, y1):
            cv.px(x0, y, ROPE[4] if y % 3 else ROPE[5]); cv.px(x0 + 1, y, ROPE[2])
        for (dx, dy, c) in ((-1, 0, BR[5]), (0, 0, BR[6]), (1, 0, BR[4]), (2, 0, BR[2]), (0, 1, BR[3]), (1, 1, BR[2])):   # 바닥 놋쇠 심(thimble)
            cv.px(x0 + dx, y1 + dy - 1, c)
    # 4) 등마루 널 통로 + 먼 쪽 놋쇠 난간
    if walk:
        wx0, wx1 = walk
        posts = []
        for x in range(wx0, wx1):
            r = EV.env_r(x_of(x) + .5, L)
            yr = int(round(ECY - RIDGE * r))
            for dy, kind in ((-2, 'top0'), (-1, 'top'), (0, 'top'), (1, 'edge'), (2, 'shade')):
                y = yr + dy
                if not (0 <= y < ENV_H) or not inner[y][x]: continue
                if kind == 'shade': cv.px(x, y, mul(CNV[5], .82)); continue
                if kind == 'edge': c = WD[2] if x % 6 else WD[1]
                else:
                    c = WD[6] if kind == 'top0' else WD[5]
                    if x % 6 == 0: c = WD[3]                              # 널 이음
                    elif kind == 'top' and dy == 0 and _hash(x // 6, 3, 1601) < .5: c = WD[4]
                if x in (wx0, wx1 - 1): c = WD[1] if kind == 'edge' else WD[3]
                cv.px(x, y, c)
            if (x - wx0) % 16 == 4 or x == wx1 - 2: posts.append((x, yr))
        for (x, yr) in posts:                                            # 먼 쪽(북) 난간 기둥: 통로 뒤 끝에서 위로 5px
            for y in range(yr - 7, yr - 2):
                cv.px(x, y, BR[5] if y > yr - 7 else BR[6]); cv.px(x + 1, y, BR[3])
        for (a, b) in zip(posts, posts[1:]):                             # 처진 밧줄 손잡이
            (xa, ya), (xb, yb) = a, b
            for x in range(xa + 1, xb):
                t = (x - xa) / float(xb - xa)
                y = int(round(ya - 6 + (yb - ya) * t + 1.6 * math.sin(math.pi * t)))
                cv.px(x, y, ROPE[3] if x % 3 else ROPE[4])
    return cv.im

TAIL_FIN = [(22, 110), (98, 117), (46, 154), (8, 152)]          # as_env.envelope_tail 의 수평 지느러미(조각 좌표)
def rigging_tail(): return rigging(EV.TAIL, lambda x: x, drops=(), fin_poly=TAIL_FIN, walk=(102, EV.TAIL))
def rigging_body(): return rigging(EV.BODY, lambda x: 400 + x, drops=(16, 48, 80, 112), walk=(0, EV.BODY))
def rigging_nose(): return rigging(EV.NOSE, lambda x: L - EV.NOSE + x, drops=(16, 48), walk=(0, 40))

def valve():
    """가스 빼는 놋쇠 밸브 1×1(16x16): 둥근 덮개(3/4 — 윗면 타원 + 앞면 띠), 볼트 테, 꼭대기 당김줄 고리, 통로 위 그늘."""
    cv = Cv(16, 16)
    for x in range(3, 13): cv.px(x, 14, mul(CNV[5], .8))                  # 통로 위 그늘
    ellipse_fill(cv, 8, 12.5, 5.5, 2.2, lambda x, y, dx, dy, d: BR[2] if dy > .2 else BR[4])       # 아래 테(앞면)
    for y in range(8, 13):                                               # 덮개 몸통(세로 원통)
        for x in range(4, 13):
            cv.px(x, y, BR[clamp(cyl_k(x, 4, 13), 2, 6)])
    ellipse_fill(cv, 8.5, 8, 4.5, 2.0, lambda x, y, dx, dy, d: BR[6] if (dx < 0 and dy < .3) else BR[5])  # 윗면 타원
    for (x, y) in ((5, 11), (8, 12), (11, 11)): cv.px(x, y, I7[2])       # 볼트
    for (x, y, c) in ((8, 4, BR[5]), (9, 4, BR[4]), (7, 5, BR[5]), (10, 5, BR[3]), (8, 6, BR[4]), (9, 6, BR[2])): cv.px(x, y, c)   # 당김줄 고리
    return fin(cv, .72)

# ---------------------------------------------------------------- 적대 검수 보정(2026-10-08, qa/airship.md 4): 혼자 써도 되는 완성 조각
# 덧그림만으로는 기낭 조각과 정확히 겹칠 때만 성립한다(혼자 놓으면 그물 줄이 허공에서 끊긴다). envelope_rigging* 이름은 그대로 두고
# 내용을 「기낭 조각 + 그물·등마루 덧그림」을 합친 완성 그림으로 바꾼다 — 기낭 조각 대신 놓아도, 위에 겹쳐 놓아도 같은 그림.
def _over(base, ov):
    im = base.copy(); im.alpha_composite(ov); return im
def rigged_tail(): return _over(EV.envelope_tail(), rigging_tail())
def rigged_body(): return _over(EV.envelope_body(), rigging_body())
def rigged_body_patched(): return _over(EV.envelope_body_patched(), rigging_body())
def rigged_nose(): return _over(EV.envelope_nose(), rigging_nose())
