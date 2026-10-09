# 산중 무림 문파 — 절벽·폭포·잔도·구름다리·수련 동굴·돌계단·돌 난간.
# 절벽 앞면 = mountain-fortress 절벽(terrain.render 바위 버팀 갈비 결 + 칩셋 바위 타일 결)과 같은 구조를 산 화강암 램프(GRAN)로:
# 세로 갈비(약 7px, 흔들림) 왼쪽 빛 · 오른쪽 그늘 · 사이 어두운 금, 갈비마다 가로 지층 금, 위 턱 밑 그늘, 발치 어둠 + 이끼 줄·고사리.
import math
import numpy as np
from PIL import Image
from ws_base import *
from ws_base import _hash
from fr_ground import vn_arr

ROCKT = []
for (tx, ty) in ((336, 336), (352, 352), (352, 336)):
    l = lum(chip_tex(tx, ty).astype(np.float64)); ROCKT.append((l - l.mean()) / (l.std() + 1e-6))


def cliff_k(X, Y, fy, FH, cx, seed=5):
    """절벽 앞면 한 화소의 톤(1..6): X,Y 전역 화소, fy = 띠 안 높이(0 = 위 턱), FH = 띠 높이 px, cx = 칸 x."""
    lx, ly = X % 16, Y % 16
    tt = ROCKT[1 + int(_hash(cx, Y // 16, 5) * 2)][(ly + cx * 5) % 16, lx]
    xx = X + int(round(3 * math.sin(Y * .21 + seed)))
    rib = xx // 7; u = (xx % 7) / 7.0
    shade = .36 * (.5 - u) + .2 * (_hash(rib, 0, seed + 4) - .5)
    t = 3.3 + shade * 4.6 + tt * .55 + .4 * (fy / max(1, FH - 1))
    if u > .86: t = 1.7 + tt * .3
    sc = int(_hash(rib, 1, seed + 3) * 40)
    if (fy + sc) % 23 == 0 and u < .86: t = 2.0
    elif (fy + sc) % 23 == 1 and u < .86: t += .9
    if fy < 4: t = min(t, 1.8 + fy * .45)
    if fy >= FH - 3: t = 1.4 if fy == FH - 1 else t - 1.0
    return int(max(1, min(6, round(t))))


def cliff_paint(tc, x0, y0, w, h, seed=5, ox=0, oy=0, ends='', moss=.5):
    """절벽 앞면을 톤 캔버스에(w,h px). ox,oy = 전역 화소 기준(이웃 조각과 결이 이어진다). ends 'W'/'E' = 끝을 둥글게 어둡게.
    위 3px 는 윗단 땅 끝 턱(밝은 모 + 풀 술), 갈비 사이 금을 따라 이끼 줄, 드문 고사리·늘어진 뿌리."""
    for y in range(h):
        for x in range(w):
            X, Y = x + ox, y + oy
            cx = X // 16
            if 'W' in ends and x < 4 and y > (4 - x) ** 2 * .6 + 2 and x < 1 + (h - y) // 40: pass
            if y < 3:                                                              # 윗단 턱
                lip = 2 + int(_hash(X // 3, 0, seed + 41) * 2.4)
                if y < lip:
                    tc.px(x0 + x, y0 + y, 'leaf' if _hash(X, y, seed + 2) < .55 else 'gran', 5 if y == 0 else 4); continue
            k = cliff_k(X, Y, y, h, cx, seed)
            m_ = 'gran'
            if k <= 2 and y > 6 and y < h - 4 and _hash(X // 2, Y // 3, seed + 7) < moss * .5: m_, k = 'koke', 3
            if 'W' in ends and x < 3: k = max(1, k - (3 - x))
            if 'E' in ends and x >= w - 3: k = max(1, k - (x - w + 4))
            tc.px(x0 + x, y0 + y, m_, k)
    # 고사리·풀 술(턱 아래 늘어짐) + 발치 잔돌
    for i in range(w // 12 + 1):
        fx = int(_hash(i, ox + oy, seed + 9) * (w - 4)) + 2
        L = 3 + int(_hash(i, 2, seed + 9) * 5)
        for j in range(L): tc.px(x0 + fx + (j // 3) * (1 if i % 2 else -1), y0 + 3 + j, 'leaf', 4 if j < L - 1 else 3)
    for i in range(w // 8):
        rx = int(_hash(i, 5, seed + 11) * (w - 3))
        tc.px(x0 + rx, y0 + h - 2, 'gran', 5); tc.px(x0 + rx + 1, y0 + h - 2, 'gran', 4); tc.px(x0 + rx, y0 + h - 1, 'gran', 3)


def cliff_band(tops, bots, ox, seed=5):
    """칸 열마다 위·아래 줄이 다른 절벽 띠 그림(RGBA, 폭 = 열 수 x 16, 높이 = (max bots − min tops) x 16).
    tops[c]/bots[c] = 열 c 의 첫 칸 줄 / 마지막 칸 줄 + 1(전역 칸 줄). 위 끝은 화소 단위로 ±2px 물결, 열 높이가 바뀌는 곳은
    높은 쪽 옆면이 둥글게 어두워진다(직각 계단 대신 바위 모서리). ox = 전역 x 칸(이웃 띠와 결이 이어진다)."""
    n = len(tops); T0 = min(tops); B1 = max(bots)
    Wp = n * 16; Hp = (B1 - T0) * 16
    tc = TC(Wp, Hp, seed)
    for x in range(Wp):
        c = x // 16; X = ox * 16 + x
        wob = int(round(1.6 * math.sin(X / 5.3 + seed) + .8 * math.sin(X / 2.1)))
        tp = tops[c] * 16 + wob; bp = bots[c] * 16
        cl = tops[c - 1] if c > 0 else tops[c]; cr = tops[c + 1] if c < n - 1 else tops[c]
        lx = x % 16
        for Y in range(max(tp, T0 * 16), bp):
            fy = Y - tp; FH = bp - tp
            if fy < 3:
                lip = 2 + int(_hash(X // 3, 0, seed + 41) * 2.4)
                if fy < lip:
                    tc.px(x, Y - T0 * 16, 'leaf' if _hash(X, fy, seed + 2) < .55 else 'gran', 5 if fy == 0 else 4); continue
            k = cliff_k(X, Y, fy, FH, X // 16, seed)
            m_ = 'gran'
            if k <= 2 and 6 < fy < FH - 4 and _hash(X // 2, Y // 3, seed + 7) < .25: m_, k = 'koke', 3
            # 이웃 열이 더 낮게 시작하면(이쪽이 튀어나온 바위) 그 옆 4px 를 둥글게 어둡게
            if cl > tops[c] and lx < 4 and Y < cl * 16 + 4: k = max(1, k - (4 - lx) // 2) if lx else 1
            if cr > tops[c] and lx > 11 and Y < cr * 16 + 4: k = max(1, k - (lx - 11) // 2) if lx < 15 else 1
            if c == 0 and 'W' in 'W' and ox == 0 and lx < 1: pass
            tc.px(x, Y - T0 * 16, m_, k)
    for i in range(n // 2 + 1):                                                    # 늘어진 풀 술·고사리
        fx = int(_hash(i, ox, seed + 9) * (Wp - 4)) + 2; c = fx // 16
        L = 3 + int(_hash(i, 2, seed + 9) * 6)
        for j in range(L): tc.px(fx + (j // 3) * (1 if i % 2 else -1), (tops[c] - T0) * 16 + 3 + j, 'leaf', 4 if j < L - 1 else 3)
    return tc.img(), T0


def cliff_face(w=4, rows=3, seed=5, ends='', ox=0, oy=0):
    tc = TC(w * 16, rows * 16, seed); cliff_paint(tc, 0, 0, w * 16, rows * 16, seed, ox, oy, ends); return tc.fin(.6)


def cliff_end(side='W', rows=3, seed=5):
    """절벽 끝 1칸: 앞면이 둥글게 꺾여 들어가며 어두워지고, 바깥쪽은 투명(옆 땅이 보인다)."""
    tc = TC(16, rows * 16, seed); H = rows * 16
    for y in range(H):
        cut = int(round(5 * (1 - math.sin(min(1, y / (H * .5)) * math.pi / 2)))) + 2
        for x in range(16):
            xe = x if side == 'W' else 15 - x
            if xe < cut: continue
            k = cliff_k(x, y, y, H, 0, seed)
            if xe < cut + 3: k = max(1, k - (cut + 3 - xe))
            if y < 2: k = 5
            tc.px(x, y, 'gran', k)
    return tc.fin(.6)


def face_cliff_sample():
    """절벽 앞면 표본 3x3(가로로 이어 붙여도 결이 이어진다 — 갈비 7px 주기는 48 과 어긋나므로 표본만 48 로 접어 만든다)."""
    tc = TC(48, 48, 5); cliff_paint(tc, 0, 0, 48, 48, 5); return tc.img()


# ================================================================ 폭포
def waterfall(rows=4, w=3, frame=0, seed=8):
    """절벽을 타고 떨어지는 폭포 w칸 x rows줄: 위 턱에서 물이 둥글게 넘고(밝은 휘어짐), 세로 물줄기(청록 → 흰 줄, 프레임마다 4px 아래로),
    양옆 가장자리는 젖은 바위(어둠) 위로 물보라 점, 맨 아래 한 줄은 거품 덩이(웅덩이 위로 번진다)."""
    W, H = w * 16, rows * 16 + 16
    tc = TC(W, H, seed)
    for x in range(2, W - 2):
        edge = x < 4 or x >= W - 4
        L = 7 + int(_hash(x, 0, seed) * 9); off = int(_hash(x, 1, seed) * 32); spd = 4 + (x % 3 == 0) * 2
        bright = _hash(x, 2, seed) > .55
        for y in range(H - 14):
            if y < 4:
                tc.px(x, y, 'mist' if y < 2 else 'mizu', 6 if y < 2 else 5); continue
            ph = (y - frame * spd + off) % (L + 6)
            if ph < L:                                                             # 흰 물줄기(머리 밝고 꼬리 엷게)
                f = ph / L
                if bright: m_, k = ('mist', 6 if f < .5 else 5)
                else: m_, k = ('mizu', 6 if f < .3 else 5)
            else: m_, k = ('mizu', 4 if (x + y // 3) % 2 else 3)
            if edge: m_, k = ('mizu', 2 if ph > L else 3)
            tc.px(x, y, m_, k, 235 if edge else 255)
    for i in range(24):                                                              # 물보라 + 아래 거품
        x = int(_hash(i, frame, seed + 3) * W); y = H - 18 + int(_hash(i, 2, seed + 3) * 14)
        r = 1 + int(_hash(i, 3, seed + 3) * 3)
        for dy in range(-r, r + 1):
            for dx in range(-r - 1, r + 2):
                if dx * dx * .6 + dy * dy <= r * r: tc.px(x + dx, y + dy, 'mist', 6 if dy < 0 else 5, 230)
    for x in range(W):
        if _hash(x, frame, seed + 5) < .5: tc.px(x, H - 1, 'mist', 4, 200)
    return tc.img()


def waterfall_strip(rows=4, w=3):
    fr = [waterfall(rows, w, f) for f in range(4)]
    o = Image.new('RGBA', (fr[0].width * 4, fr[0].height))
    for i, f in enumerate(fr): o.alpha_composite(f, (i * f.width, 0))
    return o


# ================================================================ 잔도(棧道)
def jando(w=4, seed=9, cliff=False):
    """절벽 잔도 w칸 x 2줄: 윗줄 = 절벽에 박은 널 길(가로 널 · 1px 틈, 앞 끝 밝은 모) + 앞쪽 낮은 나무 난간(기둥 16px 마다 · 가로대 둘),
    아랫줄 = 널 밑 받침(절벽 구멍에 꽂은 들보 머리 + 비스듬한 버팀대) — cliff=True 면 받침 뒤로 절벽 앞면을 함께 그린다."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    if cliff: cliff_paint(tc, 0, 0, W, H, seed + 1, 0, 16, moss=.3)
    for x in range(W):                                                              # 널(깊이 9px 윗면 + 3px 앞면)
        b = (x // 5); lx = x % 5
        for y in range(5, 14):
            k = 5 if _hash(b, 0, seed) > .5 else 4
            if lx == 4: k = 2
            elif lx == 0: k += 1
            if y == 5: k = 6
            tc.px(x, y, 'wood', clamp(k, 1, 6))
        for y in range(14, 17): tc.px(x, y, 'wood', 3 if y == 14 else 2)
    for bx in range(6, W, 16):                                                       # 받침 들보 + 버팀대
        for y in range(17, 22):
            for i in range(4): tc.px(bx + i, y, 'wood', (5, 4, 3, 2)[i])
        for j in range(12):
            tc.px(bx + 4 + j * .6, 17 + j, 'wood', 4); tc.px(bx + 5 + j * .6, 17 + j, 'wood', 2)
        for i in range(-1, 5): tc.px(bx + i, 22, 'dark', 1)
    for px_ in range(2, W, 16):                                                      # 난간
        for y in range(0, 14): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 3)
    for x in range(W):
        tc.px(x, 2, 'wood', 5); tc.px(x, 3, 'wood', 3)
        tc.px(x, 8, 'wood', 4)
    return tc.fin(.6)


def rope_bridge(w=5, seed=10):
    """구름다리(골짜기 위 출렁다리) w칸 x 2줄: 가운데가 처진 널(널마다 틈 · 끈 묶음 점), 위 손잡이 밧줄 둘(포물선), 세로 끈, 양 끝 굵은 말뚝."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    sag = lambda x: 4 * (1 - ((x - W / 2.0) / (W / 2.0)) ** 2)
    for x in range(4, W - 4):
        s_ = int(round(sag(x)))
        if (x - 4) % 4 == 3: continue
        for y in range(14 + s_, 22 + s_):
            k = 5 if y == 14 + s_ else (4 if _hash(x // 4, 0, seed) > .4 else 3)
            if y >= 20 + s_: k = 2
            tc.px(x, y, 'wood', k)
    for (yo, k) in ((4, 4), (22, 3)):
        for x in range(2, W - 2):
            tc.px(x, yo + int(round(sag(x) * 1.2)), 'take' if False else 'soil', 5 if k == 4 else 4)
    for x in range(8, W - 6, 6):
        for y in range(4 + int(sag(x) * 1.2), 14 + int(sag(x))): tc.px(x, y, 'soil', 4)
    for px_ in (0, W - 5):
        for y in range(0, 26):
            for i in range(5): tc.px(px_ + i, y, 'wood', (6, 5, 4, 3, 2)[i] if y > 0 else 6)
    return tc.fin(.6)


# ================================================================ 수련 동굴 입구
def cave_mouth(seed=11):
    """절벽에 뚫린 수련 동굴 입구 3x3칸(48x48): 둥근 아치 어둠(안쪽으로 짙어진다) + 입구 테 바위 덩이(빛 받는 윗면), 이끼·늘어진 덩굴,
    문턱 앞 납작 돌. 둘레는 같은 절벽 결이라 절벽 띠에 겹쳐 놓는다."""
    W, H = 48, 48
    tc = TC(W, H, seed)
    cliff_paint(tc, 0, 0, W, H, seed, 0, 0, moss=.6)
    cx, top = 24, 14
    for y in range(top - 4, H):
        for x in range(6, 42):
            d = ((x + .5 - cx) / 15.0) ** 2 + ((y + .5 - (top + 12)) / 14.0) ** 2 if y < top + 12 else ((x + .5 - cx) / 15.0) ** 2
            if d <= 1.0:
                inner = ((x + .5 - cx) / 12.0) ** 2 + ((y + .5 - (top + 13)) / 12.0) ** 2 if y < top + 13 else ((x + .5 - cx) / 12.0) ** 2
                if inner <= 1.0: tc.px(x, y, 'dark', 1 if inner < .55 else 2)
                else:
                    k = 5 if x < cx - 4 else (4 if x < cx + 4 else 3)
                    if y > top + 10: k -= 1
                    tc.px(x, y, 'gran', k)
    for i in range(5):                                                              # 덩굴
        vx = 12 + int(_hash(i, 1, seed) * 24); L = 4 + int(_hash(i, 2, seed) * 8)
        for j in range(L): tc.px(vx, top - 2 + j, 'leaf', 4 if j % 3 else 5)
    for x in range(14, 34):
        tc.px(x, H - 3, 'stone', 6 if x < 30 else 4); tc.px(x, H - 2, 'stone', 4); tc.px(x, H - 1, 'stone', 2)
    return tc.fin(.6)


# ================================================================ 가파른 돌계단(절벽을 깎은 계단)
def steep_stair(w=3, rows=3, seed=12):
    """절벽 띠를 뚫고 오르는 가파른 돌계단 w칸 x rows줄: 3px 디딤판(빛 6·5) + 2px 챌판(그늘), 단마다 돌 이음, 디딤판 끝 이끼 점,
    양옆 3px 깎인 바위 볼(왼 빛 · 오른 그늘). 시트 모양 그대로 쓴다(돌리지 않는다)."""
    W, H = w * 16, rows * 16
    tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            if x < 3 or x >= W - 3:
                e = x if x < 3 else W - 1 - x
                tc.px(x, y, 'gran', (2, 5, 4)[e] if x < 3 else (1, 3, 2)[e]); continue
            s_ = y % 5
            k = (6, 5, 4, 2, 1)[s_]
            if (x + (y // 5) * 7) % 16 == 0 and s_ < 3: k = 3
            if s_ == 2 and _hash(x // 2, y // 5, seed) > .85: tc.px(x, y, 'koke', 4); continue
            tc.px(x, y, 'stone', k)
    return tc.fin(.6)


# ================================================================ 돌 난간
def stone_rail(w=4, seed=13, end=''):
    """돌 난간 w칸 x 1줄(높이 16): 16px 마다 기둥(위 연꽃 봉오리 머리), 기둥 사이 판석 + 가운데 둥근 구멍(그늘), 위 둥근 손스침 돌.
    end 'W'/'E' = 그 끝에 기둥을 하나 더."""
    W, H = w * 16, 16
    tc = TC(W, H, seed)
    for x in range(W):
        lx = x % 16
        post = lx in (0, 1, 2)
        for y in range(4, H):
            if post: k = (6, 5, 3)[lx] if y > 4 else 6
            else:
                k = 5 if y < 7 else (4 if y < H - 2 else 2)
                if 6 <= lx <= 11 and 8 <= y <= 12 and ((lx - 8.5) ** 2 / 9 + (y - 10) ** 2 / 5) <= 1: k = 2
            if y == H - 1: k = 1
            tc.px(x, y, 'stone', k)
        if not post: tc.px(x, 5, 'stone', 6); tc.px(x, 6, 'stone', 4)
    for px_ in list(range(0, W, 16)) + ([W - 3] if 'E' in end else []):
        for (dx, dy, k) in ((1, 1, 6), (0, 2, 6), (1, 2, 5), (2, 2, 4), (0, 3, 5), (1, 3, 4), (2, 3, 3)): tc.px(px_ + dx, dy, 'stone', k)
    return tc.fin(.6)


if __name__ == '__main__':
    import os
    ims = [cliff_face(4, 3), cliff_end('W'), cliff_end('E'), waterfall(4), jando(4), rope_bridge(5), cave_mouth(), steep_stair(), stone_rail(4)]
    W = sum(i.width for i in ims) + 12 * (len(ims) + 1); H = max(i.height for i in ims) + 24
    o = Image.new('RGBA', (W, H), (70, 120, 60, 255)); x = 12
    for im in ims: o.alpha_composite(im, (x, H - 12 - im.height)); x += im.width + 12
    o.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(HERE, '_qa', 'cliff.png')); print('ok')
