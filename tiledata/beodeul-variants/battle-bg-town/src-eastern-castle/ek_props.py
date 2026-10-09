# 동양풍 성·닌자 마을 — 소품·식생(야외)과 실내 기물. 3/4(윗면 + 앞면), 빛 왼쪽 위, 톤 캔버스 + pz.fin 윤곽.
# 잎 결은 버들항 덤불 그림의 밝기 순위를 그대로 쓴다(leaf_tex) — 소나무 잎뭉치·대나무 잎에 칩셋 점·결이 남는다.
import math
import numpy as np
from ek_base import *
from ek_base import _hash


def _shadow(im, cx, cy, rx, ry, a=60): return shadow_under(im, cx, cy, rx, ry, a)


def foliage(tc, cx, cy, rx, ry, seed=0, mat='leaf', shift=0, flat=False, blades=0):
    """잎 덩이: 타원(flat = 아래가 평평한 구름 모양) 안을 버들항 덤불 잎 톤으로 채운다.
    위·왼쪽 +1(빛), 아래 1/3 −1, 가장자리는 해시로 들쭉날쭉. blades = 아래 끝에 늘어진 잎 줄기 수(대나무)."""
    LT = leaf_tex()
    ox = int(_hash(seed, 1, 3) * 16); oy = int(_hash(seed, 2, 3) * 16)
    for y in range(int(cy - ry - 2), int(cy + ry + 2)):
        for x in range(int(cx - rx - 2), int(cx + rx + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if flat and dy > 0: dy *= 1.8
            d = dx * dx + dy * dy
            jag = .82 + .3 * _hash(x // 2, y // 2, seed + 7)
            if d > jag: continue
            t = LT[(y + oy) % 32, (x + ox) % 32]
            if t == 0: t = 3
            k = int(t) + shift
            if dy < -.35 and dx < .2: k += 1
            if dy > .35: k -= 1
            if d > .7 and dy > 0: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    for i in range(blades):
        bx = cx + (_hash(i, seed, 11) - .5) * rx * 1.9; by = cy + ry * (.2 + .5 * _hash(i, seed, 12))
        L = 3 + int(_hash(i, seed, 13) * 4); sd = 1 if _hash(i, seed, 14) > .5 else -1
        for j in range(L): tc.px(bx + sd * (j // 2), by + j, mat, 3 if j < L - 1 else 2)


# ================================================================ 식생
def bamboo(seed=0, n=6, w=3, h=6):
    """대나무 덤불 w x h 칸: 줄기 n 개(3px, 왼 빛·오른 그늘, 마디마다 어두운 줄 + 밝은 턱), 살짝 기운다.
    위 절반에 잎 덩이 셋~넷 + 늘어진 잎 줄. 맨 아랫줄만 막힌다(줄기 밑동), 위는 걷기 + 가림."""
    W, H = w * 16, h * 16
    tc = TC(W, H, seed)
    culms = []
    for i in range(n):
        x = 4 + (W - 10) * (i + .3 + .4 * _hash(i, seed, 1)) / n
        lean = (_hash(i, seed, 2) - .5) * 6
        top = int(H * (.05 + .25 * _hash(i, seed, 3)))
        culms.append((x, lean, top))
    # 뒤 잎(어두운) 먼저
    for j in range(3):
        fx = W * (.25 + .5 * _hash(j, seed, 5)); fy = H * (.18 + .22 * j)
        foliage(tc, fx, fy, W * .30, H * .11, seed + j, shift=-1, blades=4)
    for (x, lean, top) in culms:
        node = 9 + int(_hash(int(x), seed, 4) * 4)
        for y in range(top, H - 1):
            f = (H - y) / H
            cx = x + lean * f
            for i in range(3):
                k = (5, 4, 2)[i]
                if (y - top) % node == 0: k = 2 if i < 2 else 1
                elif (y - top) % node == 1: k = 6 if i == 0 else 5
                tc.px(cx + i - 1, y, 'take', k)
        for i in range(-1, 3): tc.px(x + i - 1, H - 1, 'take', 2)
    for j in range(2):
        fx = W * (.3 + .4 * _hash(j, seed, 6)); fy = H * (.12 + .26 * j)
        foliage(tc, fx, fy, W * .26, H * .09, seed + 9 + j, shift=0, blades=5)
    im = tc.fin(.6)
    return _shadow(im, W // 2, H - 2, W // 2 - 3, 3, 60)


def bamboo_young(seed=0):
    """어린 대나무(죽순 곁 가는 줄기 둘 + 잎 줄) 1x3칸 — 덤불 가장자리를 부드럽게 끝낼 때."""
    W, H = 16, 48
    tc = TC(W, H, seed)
    for i, (x, top) in enumerate(((5, 10), (10, 18))):
        for y in range(top, H - 1):
            k = 4 if (y - top) % 8 else 2
            tc.px(x, y, 'take', 5 if (y - top) % 8 else 2); tc.px(x + 1, y, 'take', k - 1)
    foliage(tc, 8, 12, 7, 6, seed, shift=0, blades=4)
    foliage(tc, 10, 22, 5, 3, seed + 3, shift=-1, blades=2)
    return _shadow(tc.fin(.6), 8, H - 2, 6, 2, 50)


def matsu(seed=0, flip_=False):
    """정원 소나무 4x5칸: 굽은 줄기(나무 램프, 비늘 껍질 점) + 옆으로 뻗은 가지 셋 끝마다 평평한 구름 잎뭉치(짙은 청록 소나무 잎).
    밑동 칸 둘만 막힌다. flip_ = 좌우 바꿈."""
    W, H = 64, 80
    tc = TC(W, H, seed)
    # 줄기: S자로 굽는다
    pts = []
    for y in range(H - 1, 18, -1):
        f = (H - y) / (H - 18)
        x = 30 + math.sin(f * 2.6 + seed) * 7 + f * 4
        pts.append((x, y, 4.0 - f * 1.6))
    for (x, y, r) in pts:
        for i in range(int(-r), int(r) + 1):
            u = (i + r) / (2 * r)
            k = 5 if u < .3 else (4 if u < .6 else (3 if u < .85 else 2))
            if _hash(int(x + i), y, seed + 3) < .12: k -= 1
            tc.px(x + i, y, 'wood', k)
    pads = [(.82, -1, 20, 7), (.55, 1, 22, 7), (.35, -1, 18, 6), (.12, 0, 16, 7)]
    for (fy, side, rx, ry) in pads:
        y = int(H - 1 - fy * (H - 18) - 4); x0 = [p for p in pts if p[1] == y]
        bx = x0[0][0] if x0 else 30
        ex = bx + side * (rx * .9) if side else bx
        for t in range(0, 101, 4):                                           # 가지
            u = t / 100.0
            tc.px(bx + (ex - bx) * u, y - 2 * math.sin(u * math.pi) + 2, 'wood', 3)
    for (fy, side, rx, ry) in pads:
        y = int(H - 1 - fy * (H - 18) - 4); x0 = [p for p in pts if p[1] == y]
        bx = x0[0][0] if x0 else 30
        ex = bx + side * (rx * .9) if side else bx
        foliage(tc, ex, y - 3, rx, ry, seed + int(fy * 10), shift=-1, flat=True)
        foliage(tc, ex - 2, y - 5, rx * .7, ry * .55, seed + int(fy * 10) + 5, shift=0, flat=True)
    im = tc.fin(.6)
    im = _shadow(im, 32, H - 2, 12, 3, 60)
    return flip(im) if flip_ else im


def azalea(seed=0):
    """둥글게 다듬은 철쭉 덤불 2x2칸(분홍 꽃 점). 정원·사당 곁 덩이로."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    foliage(tc, 16, 19, 14, 10, seed, shift=0)
    for i in range(18):
        x = 4 + int(_hash(i, seed, 1) * 24); y = 11 + int(_hash(i, seed, 2) * 14)
        if tc.get(x, y): tc.px(x, y, 'redl', 5 if y < 18 else 4); tc.px(x + 1, y, 'redl', 6 if y < 16 else 4)
    return _shadow(tc.fin(.6), 16, 29, 13, 3, 55)


def garden_rock(seed=0, w=2):
    """정원 바위 w x 1칸(이끼 낀 윗면 + 앞면 돌 결). 마른 정원 모래 위 덩이 셋으로."""
    W, H = w * 16, 20
    tc = TC(W, H, seed)
    for y in range(2, H):
        for x in range(1, W - 1):
            u = (x + .5) / W; top = 2 + int(6 * (abs(u - .45 - .1 * _hash(seed, 0, 1)) ** 1.5) * 3)
            if y < top: continue
            if y > H - 2 and (x < 3 or x > W - 4): continue
            k = ishigaki_k(x, y, seed, 4, hw=30, hh=16)
            if y < top + 4: k = 5 if x < W * .6 else 4
            if x > W * .7: k -= 1
            m = 'stone'
            if y < top + 3 and _hash(x // 2, y, seed + 4) < .45: m = 'leaf'; k = 3 + (1 if x < W * .5 else 0)
            tc.px(x, y, m, clamp(k, 1, 6))
    return _shadow(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 2, 55)


# ================================================================ 돌·나무 소품
def toro(seed=0, lit=True):
    """돌 등롱(가스가형) 1x3칸: 받침 · 기둥 · 중대 · 불집(창에 불빛) · 갓(끝이 휜 지붕) · 보주. 밑동만 막힌다."""
    W, H = 16, 48
    tc = TC(W, H, seed)
    def slab(x0, x1, y0, y1, top=1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                k = 6 if y < y0 + top else (4 if x < x1 - 2 else 3)
                if y == y1 - 1: k = 2
                tc.px(x, y, 'stone', k)
    slab(3, 13, 42, 48, 2)                                                   # 받침
    for y in range(28, 42):                                                  # 기둥(원통)
        for x in range(6, 10): tc.px(x, y, 'stone', (5, 4, 3, 2)[x - 6])
        if y in (33, 34): [tc.px(x, y, 'stone', 3) for x in range(6, 10)]
    slab(3, 13, 24, 28, 1)                                                   # 중대
    for y in range(16, 24):                                                  # 불집
        for x in range(4, 12):
            if 6 <= x < 10 and 18 <= y < 22: tc.px(x, y, 'amber' if lit else 'dark', 5 if lit and y < 20 else (4 if lit else 1))
            else: tc.px(x, y, 'stone', 5 if x < 6 else (4 if x < 10 else 3))
    for y in range(9, 16):                                                   # 갓(위로 갈수록 좁고 끝이 휜다)
        hw = 3 + (y - 9) * .9
        for x in range(int(8 - hw), int(8 + hw)):
            k = 5 if x < 7 else (4 if x < 10 else 3)
            if y >= 14: k = 2 if y == 15 else 3
            tc.px(x, y, 'stone', k)
    tc.px(1, 13, 'stone', 4); tc.px(14, 13, 'stone', 3)                     # 휜 귀
    tc.ell(8, 6.5, 2.4, 3, 'stone', lambda X, Y: 6 if X < 8 else 3)          # 보주
    tc.px(8, 2, 'stone', 5)
    im = tc.fin(.6)
    return _shadow(im, 8, 46, 6, 2, 55)


def chozubachi(seed=0):
    """손 씻는 돌 물확(조즈바치) 2x2칸: 네모 돌 물통(윗면 물 + 앞면 결) + 대나무 홈통과 국자, 물방울."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for y in range(14, 30):
        for x in range(4, 28):
            if y < 20:
                if 7 <= x < 25 and 15 <= y < 19: tc.px(x, y, 'glass', 3 if y < 17 else 2)
                else: tc.px(x, y, 'stone', 6 if y == 14 else 5)
            else:
                k = ishigaki_k(x, y, seed + 2, 4, hw=24, hh=12)
                if x >= 26: k -= 1
                if y == 29: k = 1
                tc.px(x, y, 'stone', k)
    for x in range(14, 30):                                                  # 대나무 홈통
        tc.px(x, 9, 'take', 5); tc.px(x, 10, 'take', 3)
        if x % 7 == 0: tc.px(x, 9, 'take', 2)
    for y in range(9, 30): tc.px(29, y, 'take', 4); tc.px(30, y, 'take', 2)
    for y in range(11, 15): tc.px(14, y, 'glass', 5, 200)
    for x in range(7, 15): tc.px(x, 13, 'take', 4)                            # 국자
    tc.ell(6, 14, 2, 1.4, 'take', 3)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 55)


def saisen_box(seed=0):
    """시주함(사이센바코) 1x1칸: 나무 상자 윗면 살(가로 막대) + 앞면 판. 글자 없음."""
    tc = TC(16, 16, seed)
    box(tc, 1, 4, 15, 16, 5, 'wood', 4, seed)
    for x in range(2, 14, 2): tc.px(x, 5, 'dark', 1); tc.px(x, 6, 'dark', 1)
    for x in range(1, 15): tc.px(x, 9, 'gold', 4)
    return tc.fin(.6)


def komainu(seed=0, flip_=False):
    """사당 지킴 짐승 돌상(고마이누) 1x2칸: 돌 받침 + 앉은 네발짐승(갈기 덩이·앞발·꼬리 말림). 사람 아님."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for y in range(24, 32):
        for x in range(1, 15): tc.px(x, y, 'stone', 6 if y == 24 else (4 if x < 13 else 3) if y < 31 else 2)
    tc.ell(8, 18, 5, 6, 'stone', lambda X, Y: 5 if X < 7 else (4 if X < 10 else 3))      # 몸
    tc.ell(6, 10, 4.5, 4.5, 'stone', lambda X, Y: 6 if X < 5 and Y < 10 else (4 if X < 8 else 3))   # 머리·갈기
    for (x, y) in ((4, 9), (7, 9)): tc.px(x, y, 'dark', 1)                  # 눈(점 둘)
    tc.px(5, 12, 'dark', 2); tc.px(6, 12, 'dark', 2)
    for y in range(19, 24): tc.px(5, y, 'stone', 5); tc.px(6, y, 'stone', 3)                  # 앞발
    for i in range(4): tc.px(12 + (i % 2), 9 + i, 'stone', 5 - i // 2)                        # 꼬리 말림
    tc.ell(12.5, 8.5, 2, 2, 'stone', lambda X, Y: 5)
    im = tc.fin(.6)
    im = _shadow(im, 8, 30, 6, 2, 50)
    return flip(im) if flip_ else im


def ema_rack(seed=0):
    """나무 소원 판(에마) 걸이 2x2칸: 지붕 얹은 걸이 틀 + 오각 나무 판 열 개(글자 없음, 붉은 끈)."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for px_ in (3, 27):
        for y in range(6, 32): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for x in range(1, 31): tc.px(x, 4, 'ita', 5); tc.px(x, 5, 'ita', 3); tc.px(x, 6, 'ita', 1)
    for x in range(0, 32): tc.px(x, 3, 'ita', 6) if 1 < x < 30 else None
    for row, y0 in enumerate((10, 19)):
        for x in range(5, 27): tc.px(x, y0 - 1, 'wood', 3)
        for i in range(5):
            x0 = 6 + i * 4 + (row * 2)
            for y in range(y0, y0 + 6):
                for x in range(x0, x0 + 3 + (1 if y > y0 else 0)):
                    tc.px(x, y, 'wood', 5 if y < y0 + 2 else 4)
            tc.px(x0 + 1, y0 - 1, 'redl', 4)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 50)


def tawara(seed=0, n=3):
    """쌀가마(타와라) 더미 2x2칸: 짚 원통 가마(끝 둥근 마개 + 새끼줄 세 줄) 아래 둘 위 하나."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    def bale(x0, y0, w=15, h=10):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                v = (y - y0 + .5) / h
                k = cyl_k(v)
                if (x - x0) in (3, 7, 11): k = max(1, k - 2)
                if x < x0 + 2:
                    k = 5 if v < .6 else 3
                tc.px(x, y, 'kaya', clamp(k, 1, 6))
        tc.ell(x0 + 1, y0 + h / 2, 1.5, h / 2 - .5, 'kaya', lambda X, Y: 6 if Y < y0 + h / 2 else 4)
    bale(1, 21); bale(16, 21)
    if n >= 3: bale(8, 12)
    return _shadow(tc.fin(.6), 16, 30, 14, 2, 55)


def taru(seed=0):
    """술통(새끼줄로 감은 나무 통) 1x2칸: 위 뚜껑 원(윗면) + 몸 통널 + 짚 거적 감싼 띠."""
    W, H = 16, 28
    tc = TC(W, H, seed)
    for y in range(8, 27):
        for x in range(1, 15):
            u = (x - 1 + .5) / 14; k = cyl_k(u)
            m = 'kaya' if 12 <= y < 22 else 'wood'
            if m == 'kaya' and (x % 3 == 0): k -= 1
            if y in (11, 22): m, k = 'kaya', 2
            tc.px(x, y, m, clamp(k, 1, 6))
    tc.ell(8, 8, 7, 3, 'wood', lambda X, Y: 5 if Y < 8 else 4)
    for x in range(3, 13): tc.px(x, 8, 'wood', 3) if x % 4 == 0 else None
    return _shadow(tc.fin(.6), 8, 26, 7, 2, 55)


def firewood(seed=0):
    """장작 더미 2x1칸(통나무 마구리 원이 앞으로 보이게 쌓은 더미 + 위 덮은 짚 거적)."""
    W, H = 32, 22
    tc = TC(W, H, seed)
    for row in range(3):
        for i in range(5 - (row % 2)):
            cx = 4 + i * 6 + (3 if row % 2 else 0); cy = H - 4 - row * 5
            tc.ell(cx, cy, 3, 2.6, 'wood', lambda X, Y: 5 if X < cx else 3)
            tc.px(cx, cy, 'wood', 6); tc.px(cx - 1, cy, 'wood', 6)
    for x in range(1, W - 1):
        for y in range(2, 6): tc.px(x, y, 'kaya', 5 if y == 2 else (4 if y < 5 else 2)) if (x + y) % 5 else tc.px(x, y, 'kaya', 3)
    return _shadow(tc.fin(.6), 16, H - 2, 14, 2, 55)


def makiwara(seed=0):
    """주먹 단련 기둥(마키와라) 1x2칸: 땅에 박은 나무 기둥 + 위쪽 짚 감은 덩이 + 새끼줄."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for y in range(4, 31):
        for x in range(6, 10): tc.px(x, y, 'wood', (5, 4, 3, 2)[x - 6])
    for y in range(6, 15):
        for x in range(4, 12):
            k = cyl_k((x - 4 + .5) / 8)
            if y in (8, 12): k = 2
            tc.px(x, y, 'kaya', k)
    tc.px(6, 3, 'wood', 6); tc.px(7, 3, 'wood', 5); tc.px(8, 3, 'wood', 4)
    return _shadow(tc.fin(.6), 8, 30, 4, 2, 50)


def mokujin(seed=0):
    """나무 대련 기둥(팔 막대 셋이 꽂힌 굵은 통나무) 1x2칸 — 얼굴 없는 기둥."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for y in range(3, 31):
        for x in range(4, 12): tc.px(x, y, 'wood', (5, 5, 4, 4, 3, 3, 2, 2)[x - 4] - (1 if _hash(x, y, seed) < .08 else 0))
    tc.ell(8, 3, 4, 1.6, 'wood', lambda X, Y: 6 if X < 8 else 4)
    for (y, side) in ((9, -1), (11, 1), (19, 1)):
        for i in range(5):
            x = 8 + side * (4 + i); tc.px(x, y - (i // 3), 'wood', 4 if side < 0 else 3); tc.px(x, y + 1 - (i // 3), 'wood', 2)
    return _shadow(tc.fin(.6), 8, 30, 5, 2, 50)


def target_board(seed=0):
    """표창 과녁(짚 둥근 과녁판 + 나무 받침 다리 셋) 1x2칸. 동심원 둘 + 가운데 붉은 점, 꽂힌 표창 둘(작은 쇠 십자)."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for (x0, x1) in ((4, 2), (11, 13)):
        for y in range(16, 32): tc.px(x0 + (x1 - x0) * (y - 16) / 16, y, 'wood', 3)
    for y in range(18, 32): tc.px(8, y, 'wood', 4)
    tc.ell(8, 11, 7, 7, 'kaya', lambda X, Y: 5 if X + Y < 19 else 4)
    tc.ell(8, 11, 4.6, 4.6, 'washi', 5)
    tc.ell(8, 11, 2.8, 2.8, 'kaya', 3)
    tc.ell(8, 11, 1.4, 1.4, 'redl', 4)
    for (x, y) in ((5, 8), (11, 13)):
        tc.px(x, y, 'steel', 6); tc.px(x - 1, y, 'steel', 4); tc.px(x + 1, y, 'steel', 3); tc.px(x, y - 1, 'steel', 5); tc.px(x, y + 1, 'steel', 2)
    return _shadow(tc.fin(.6), 8, 30, 6, 2, 50)


def weapon_rack(seed=0):
    """봉·창 걸이 2x2칸: 나무 틀 두 가로대에 기댄 긴 봉 다섯(끝 쇠 촉 둘). 칼·글자 없음."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for px_ in (2, 28):
        for y in range(6, 32): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for yy in (10, 24):
        for x in range(2, 30): tc.px(x, yy, 'wood', 4); tc.px(x, yy + 1, 'wood', 1)
    for i in range(5):
        x = 6 + i * 5
        top = 2 + (i % 2) * 2
        for y in range(top, 30): tc.px(x, y, 'wood', 5 if i % 2 else 4); tc.px(x + 1, y, 'wood', 2)
        if i in (1, 3):
            for y in range(top - 2, top + 2): tc.px(x, y, 'steel', 6 if y < top else 4); tc.px(x + 1, y, 'steel', 3)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 50)


def chochin_post(seed=0):
    """붉은 종이 등(초친) 걸린 나무 기둥 1x3칸(글자 없음): 기둥 + 가로 팔 + 등(둥근 통, 위아래 검은 테, 가로 살 줄, 불빛)."""
    W, H = 16, 48
    tc = TC(W, H, seed)
    for y in range(4, 47): tc.px(3, y, 'wood', 5); tc.px(4, y, 'wood', 3); tc.px(5, y, 'wood', 2)
    for x in range(3, 13): tc.px(x, 6, 'wood', 4); tc.px(x, 7, 'wood', 2)
    for y in range(10, 24):
        hw = 4.6 * math.sin((y - 9.5) / 14.5 * math.pi) + 1
        for x in range(int(10 - hw), int(10 + hw) + 1):
            u = (x + .5 - (10 - hw)) / (2 * hw)
            k = 6 if u < .3 else (5 if u < .6 else 4)
            if (y - 10) % 3 == 2: k -= 1
            tc.px(x, y, 'redl', clamp(k, 1, 6))
    for x in range(8, 13): tc.px(x, 9, 'kuro', 4); tc.px(x, 24, 'kuro', 3)
    tc.px(10, 8, 'kuro', 2)
    return _shadow(tc.fin(.6), 4, 46, 3, 2, 45)


def drying_rack(seed=0):
    """곶감·무청 말림대 2x2칸: 기둥 둘 + 가로 장대 + 매단 곶감 줄 넷(주황 알) + 아래 짚 멍석."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for px_ in (2, 28):
        for y in range(3, 31): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for x in range(1, 31): tc.px(x, 4, 'wood', 5); tc.px(x, 5, 'wood', 2)
    for i in range(5):
        x = 7 + i * 5
        for y in range(6, 8 + 3 * 4): tc.px(x, y, 'kaya', 3)
        for j in range(4):
            y = 8 + j * 4
            tc.ell(x, y, 1.8, 1.6, 'redl', lambda X, Y: 6 if X < x else 4)
    for x in range(4, 28):
        for y in range(27, 31): tc.px(x, y, 'kaya', 4 if (x + y) % 3 else 3)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 50)


def stepping_stone(seed=0):
    """디딤돌(토비이시) 1x1칸 땅 장식: 납작한 둥근 돌 둘(윗면 밝음 + 앞 모 그늘)."""
    tc = TC(16, 16, seed)
    for (cx, cy, rx, ry) in ((6, 6, 4.5, 3), (11, 11.5, 3.8, 2.6)):
        cx += (_hash(seed, 1, 1) - .5) * 2
        tc.ell(cx, cy, rx, ry, 'stone', lambda X, Y: 6 if Y < cy - 1 and X < cx else (5 if Y < cy + 1 else 3))
    return tc.fin(.7)


def stone_steps(w=3, rows=3, seed=0):
    """돌계단(이시단) w x rows칸: 단마다 윗면(밝음 6px) + 챌면(어둠 2px) + 디딤돌 이음, 양옆 막돌 볼. 바닥 위 — 시트 모양 그대로."""
    W, H = w * 16, rows * 16
    tc = TC(W, H, seed)
    step = 8
    for y in range(H):
        j = y // step; ly = y % step
        for x in range(W):
            if x < 4 or x >= W - 4:
                k = ishigaki_k(x, y, seed + 5, 4, hw=10, hh=6)
                if x >= W - 4: k -= 1
                tc.px(x, y, 'stone', clamp(k, 1, 6)); continue
            sw = 10 + int(_hash(j, 0, seed) * 6); col = (x + j * 5) // sw; lx = (x + j * 5) % sw
            if ly < 5:
                k = 6 if ly == 0 else (5 if ly < 3 else 4)
                if lx == sw - 1: k = 3
            else: k = 2 if ly < 7 else 1
            if x >= W - 6 and k > 2: k -= 1
            tc.px(x, y, 'stone', k)
    return tc.fin(.6)


def kura(w=4, seed=0):
    """흰 회벽 곳간(구라) w칸 x 5줄: 두꺼운 흰 벽 + 아래 해삼벽(검은 기와판에 흰 줄눈 마름모 격자) + 작은 높은 창(쇠 덧문) +
    두꺼운 흙 문(흰 문짝 + 검은 테), 기와 맞배 지붕."""
    W, H = w * 16, 80
    tc = TC(W, H, seed)
    wall_top = 34; wall_bot = H - 2
    for y in range(wall_top, wall_bot):
        for x in range(4, W - 4):
            if y < wall_bot - 18:
                k = 5 if x < W - 6 else 4
                if y < wall_top + 2: k = 3
                if _hash(x, y, seed + 2) < .03: k -= 1
                tc.px(x, y, 'plaster', k)
            else:
                X = x - 4; Y = y - (wall_bot - 18)
                on = ((X + Y) % 6 == 0) or ((X - Y) % 6 == 0)
                tc.px(x, y, 'plaster' if on else 'kawara', 5 if on else (3 if x < W - 6 else 2))
    for x in range(4, W - 4): tc.px(x, wall_bot - 19, 'plaster', 6); tc.px(x, wall_bot - 18, 'plaster', 3)
    # 문(흰 흙 문 + 검은 테)
    dx = W // 2 - 8
    for y in range(wall_bot - 26, wall_bot):
        for x in range(dx - 2, dx + 18):
            if dx <= x < dx + 16 and y >= wall_bot - 24: tc.px(x, y, 'kuro', 2 if x < dx + 8 else 1)
            else: tc.px(x, y, 'kuro', 4 if x < dx else 3)
    for x in range(dx + 1, dx + 7):
        for y in range(wall_bot - 23, wall_bot):
            tc.px(x, y, 'plaster', 4 if x < dx + 6 else 3)                  # 반쯤 연 흰 문짝
    # 높은 창(쇠 덧문)
    for cx in (12, W - 20):
        for y in range(wall_top + 6, wall_top + 13):
            for x in range(cx, cx + 8): tc.px(x, y, 'kuro', 4 if (x - cx) % 3 else 2)
    jroof(tc, 0, wall_top + 6 - 34, W, 34, kind='gable', yb=.40, sori=2, flare=2)
    tc.grain(.02, mats=('plaster',))
    return tc.fin(.6)


# ================================================================ 실내 기물
def zen_table(seed=0, tea=True):
    """낮은 상(검은 칠 + 붉은 칠 윗면 테) 2x1칸 + 찻주전자·찻잔 둘."""
    W, H = 32, 20
    tc = TC(W, H, seed)
    for y in range(6, 18):
        for x in range(2, 30):
            if y < 11: k = 5 if y == 6 or x == 2 else 4; m = 'kuro'
            else: k = 2 if x < 5 or x > 26 else 1; m = 'kuro'
            if y >= 12 and 5 <= x <= 26: continue                               # 다리 사이 비움
            tc.px(x, y, m, k)
    for x in range(3, 29): tc.px(x, 7, 'shu', 4)
    if tea:
        tc.ell(10, 5, 3, 2.4, 'ink', lambda X, Y: 5 if X < 10 else 3); tc.px(13, 4, 'ink', 4); tc.px(14, 3, 'ink', 4)
        for x0 in (18, 23):
            for y in range(4, 7):
                for x in range(x0, x0 + 3): tc.px(x, y, 'washi', 6 if y == 4 else 4)
    return tc.fin(.6)


def zabuton(seed=0, mat='redl'):
    """방석 1x1칸(땅 장식에 가깝다 — 걷기): 네모 솜 방석(가운데 술 점), 위·왼 빛."""
    tc = TC(16, 16, seed)
    for y in range(3, 14):
        for x in range(2, 14):
            k = 4
            if y < 5 or x < 4: k = 5
            if y > 11 or x > 11: k = 3
            tc.px(x, y, mat, k)
    tc.px(8, 8, 'gold', 5); tc.px(7, 8, 'gold', 4)
    return tc.fin(.7)


def andon(seed=0):
    """종이 등(안돈) 1x2칸: 나무 네모 틀 + 장지 종이 앞면(불빛 노랑) + 아래 받침 다리."""
    W, H = 16, 32
    tc = TC(W, H, seed)
    for y in range(6, 26):
        for x in range(3, 13):
            if x in (3, 12) or y in (6, 25) or y == 15: tc.px(x, y, 'kuro', 4 if x == 3 else 2)
            else: tc.px(x, y, 'amber', 6 if y < 12 and x < 8 else 5)
    for x in range(3, 13): tc.px(x, 5, 'kuro', 5)
    for (x) in (4, 11):
        for y in range(26, 31): tc.px(x, y, 'kuro', 3)
    im = tc.fin(.6)
    g = Image.new('RGBA', im.size, (0, 0, 0, 0))
    return im


def byobu(seed=0, w=3):
    """병풍(접은 여섯 폭) w x 2칸: 폭마다 앞으로/뒤로 꺾인 면(밝음/어둠), 금박 바탕 + 먹 소나무·산 그림(글자 없음), 검은 칠 테."""
    W, H = w * 16, 32
    tc = TC(W, H, seed)
    n = 6; pw = W / n
    for y in range(2, H - 1):
        for x in range(W):
            i = int(x / pw); lx = x - i * pw
            fold = (i % 2 == 0)
            if y in (2, 3) or y >= H - 3: tc.px(x, y, 'kuro', 4 if y == 2 else 2); continue
            if lx < 1: tc.px(x, y, 'kuro', 3 if fold else 1); continue
            k = (5 if fold else 4) + (1 if y < 10 else 0)
            m = 'gold'
            # 먹 그림: 산 능선과 소나무 가지(폭을 건너 이어진다)
            ridge = H * .55 + 5 * math.sin(x / 7.0 + seed) + 3 * math.sin(x / 2.7)
            if y > ridge: m, k = 'ink', (4 if fold else 3)
            if abs(y - (H * .3 + 3 * math.sin(x / 4.0))) < 1 and (x // 3) % 3: m, k = 'ink', 2
            if m == 'gold' and _hash(x, y, seed) < .05: k -= 1
            tc.px(x, y, m, clamp(k, 1, 6))
    return _shadow(tc.fin(.6), W // 2, H - 2, W // 2 - 2, 2, 45)


def tokonoma(seed=0):
    """도코노마(벽 감실) 2x3칸 — 북쪽 벽면 조각: 나무 테 감실 + 족자(먹 산수, 글자 없음) + 아래 마루 판 위 꽃병(꽃꽂이)."""
    W, H = 32, 48
    tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            if x < 3 or x >= W - 3: tc.px(x, y, 'wood', 5 if x < 2 else (3 if x < 3 else 2)); continue
            if y < 4: tc.px(x, y, 'wood', 4 if y < 3 else 2); continue
            if y >= H - 8: tc.px(x, y, 'wood', 5 if y == H - 8 else (4 if y < H - 2 else 2)); continue
            tc.px(x, y, 'plaster', 3 if y < 8 else 4)
    for y in range(6, H - 12):                                               # 족자
        for x in range(10, 22):
            if y < 8 or y >= H - 14: tc.px(x, y, 'kuro', 3); continue
            if x in (10, 21): tc.px(x, y, 'gold', 3); continue
            k = 6
            m = 'washi'
            if y > 20 + 3 * math.sin(x / 2.0 + seed): m, k = 'ink', 4
            if y > 26: m, k = 'ink', 3
            tc.px(x, y, m, k)
    tc.ell(24, H - 11, 2.5, 3, 'shu', lambda X, Y: 5 if X < 24 else 3)       # 꽃병
    for (x, y) in ((23, H - 16), (25, H - 17), (24, H - 18), (26, H - 15)): tc.px(x, y, 'leaf', 4)
    tc.px(24, H - 19, 'redl', 5); tc.px(26, H - 17, 'redl', 5)
    return tc.fin(.6)


def katana_kake(seed=0):
    """칼걸이(가타나카케) 2x1칸: 검은 칠 받침 + 칼집 두 자루(검은 칠 칼집 · 금 코등이 점), 글자 없음."""
    W, H = 32, 20
    tc = TC(W, H, seed)
    for y in range(14, 20):
        for x in range(4, 28): tc.px(x, y, 'kuro', 5 if y == 14 else (3 if x < 26 else 2))
    for px_ in (7, 24):
        for y in range(4, 14): tc.px(px_, y, 'kuro', 4); tc.px(px_ + 1, y, 'kuro', 2)
    for (y, x0, x1) in ((6, 3, 29), (10, 4, 28)):
        for x in range(x0, x1): tc.px(x, y, 'kuro', 3); tc.px(x, y + 1, 'kuro', 1)
        tc.px(x0 + 6, y, 'gold', 5); tc.px(x0 + 6, y + 1, 'gold', 3)
        for x in range(x0, x0 + 6): tc.px(x, y, 'washi' if x % 2 else 'kuro', 3)
    return tc.fin(.6)


def yoroi(seed=0):
    """갑옷 장식(요로이카자리) 2x2칸: 검은 칠 받침 궤 위 갑옷 몸통(붉은 끈 비늘 줄) + 투구(얼굴 자리는 빈 어둠, 사람 얼굴 없음) + 금 뿔 장식."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    box(tc, 3, 22, 29, 32, 3, 'kuro', 3, seed)
    for y in range(12, 22):                                                  # 몸통(비늘 줄)
        for x in range(9, 23):
            k = 4 if x < 13 else (3 if x < 20 else 2)
            m = 'kuro'
            if (y - 12) % 3 == 2: m, k = 'redl', 3 if x < 16 else 2
            tc.px(x, y, m, k)
    for y in range(13, 21):                                                  # 어깨 판(소데)
        for x in list(range(5, 9)) + list(range(23, 27)):
            tc.px(x, y, 'kuro' if (y - 13) % 3 else 'redl', 4 if x < 9 else 2)
    tc.ell(16, 8, 5, 4, 'kuro', lambda X, Y: 5 if X < 15 else 3)             # 투구
    for x in range(10, 23): tc.px(x, 11, 'kuro', 4)
    for x in range(13, 19): tc.px(x, 10, 'dark', 0)                         # 얼굴 자리(빈 어둠)
    for (x, y) in ((13, 3), (12, 2), (11, 1), (19, 3), (20, 2), (21, 1)): tc.px(x, y, 'gold', 6)   # 금 뿔 장식
    tc.px(16, 4, 'gold', 5)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 45)


def tansu(seed=0):
    """서랍장(단스) 2x2칸: 나무 몸 + 서랍 셋 + 검은 쇠 손잡이·모서리 쇠.)"""
    W, H = 32, 32
    tc = TC(W, H, seed)
    box(tc, 2, 6, 30, 32, 4, 'wood', 4, seed)
    for row, y0 in enumerate((12, 19, 25)):
        for x in range(4, 28): tc.px(x, y0 - 1, 'wood', 2)
        for cx in (10, 21):
            tc.px(cx, y0 + 2, 'kuro', 2); tc.px(cx + 1, y0 + 2, 'kuro', 2); tc.px(cx, y0 + 1, 'kuro', 3)
    for (x, y) in ((2, 10), (28, 10), (2, 29), (28, 29)):
        for i in range(2):
            for j in range(2): tc.px(x + i, y + j, 'kuro', 3)
    return _shadow(tc.fin(.6), 16, 30, 13, 2, 45)


def hibachi(seed=0):
    """화로(히바치) 1x1칸: 둥근 도기 화로(윗면 재 + 숯불 점) + 쇠 젓가락."""
    W, H = 16, 16
    tc = TC(W, H, seed)
    for y in range(5, 15):
        for x in range(2, 14):
            if y < 9:
                if ((x + .5 - 8) / 6) ** 2 + ((y + .5 - 7) / 2) ** 2 <= 1:
                    inner = ((x + .5 - 8) / 4.5) ** 2 + ((y + .5 - 7) / 1.4) ** 2 <= 1
                    tc.px(x, y, 'suna' if inner else 'shu', 3 if inner else 5)
            else:
                tc.px(x, y, 'shu', cyl_k((x - 2 + .5) / 12))
    tc.px(7, 7, 'redl', 6); tc.px(9, 7, 'redl', 5); tc.px(8, 6, 'amber', 6)
    for i in range(5): tc.px(11 + i // 3, 2 + i, 'steel', 4)
    return tc.fin(.6)


def ikebana(seed=0):
    """꽃꽂이 수반 1x1칸(받침 위 낮은 도기 + 소나무 가지·붉은 꽃)."""
    tc = TC(16, 16, seed)
    for y in range(11, 15):
        for x in range(3, 13): tc.px(x, y, 'ink', 4 if y == 11 else (3 if x < 11 else 2))
    for i in range(7): tc.px(8 - i // 2, 10 - i, 'wood', 3)
    foliage(tc, 5, 4, 3, 2, seed, shift=-1, flat=True)
    tc.px(10, 7, 'redl', 5); tc.px(11, 8, 'redl', 4); tc.px(9, 6, 'redl', 6)
    return tc.fin(.6)
