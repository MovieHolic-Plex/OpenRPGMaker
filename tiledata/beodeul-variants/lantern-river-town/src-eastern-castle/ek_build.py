# 복사본(원본 eastern-castle/ek_build.py, 2026-10-08) — 읽기 전용 원본을 건드리지 않으려고 이 폴더에 둔다. 경로만 한 단 깊게 고쳤다.
# 동양풍 성·닌자 마을 — 건물(3/4: 윗면 지붕 + 앞면 벽, 옆면 없음). 톤 캔버스(TC)에 칠한 뒤 pz.fin 윤곽.
# 천수각(층층 기와 지붕·흰 회벽·검은 판벽·돌 기단), 성문 망루(야구라몬), 모서리 망루, 흙벽(도베이), 초가 민가, 널지붕 민가,
# 도장, 물레방아 오두막, 작은 사당, 도리이, 우물, 숨은 문 판벽.
import math
from ek_base import *
from ek_base import _hash


def _win_row(tc, x0, x1, y, n, w=6, h=7, kind='bars'):
    """벽 폭에 창 n 개를 고르게(창은 벽 칸 가운데)."""
    span = x1 - x0
    for i in range(n):
        cx = x0 + span * (i + .5) / n
        lattice_window(tc, int(cx - w / 2), y, w, h, kind)


# ================================================================ 천수각
def tenshu(seed=1):
    """앵커 ①: 3층 천수각 (11x12칸). 맨 아래 = 휜 돌 기단(3줄, 위로 갈수록 좁다) + 기단 문.
    1층 = 아래 검은 판벽 + 위 흰 회벽 + 격자창 다섯, 1층 처마(치도리 박공 둘), 2층 = 흰 벽 + 창 넷 + 처마(가운데 큰 박공),
    3층 = 흰 벽 + 창 셋 + 난간, 꼭대기 팔작지붕 + 금 귀면 장식. 지붕 결은 버들항 칩셋 파란 기와를 짙은 회청으로."""
    W, H = 176, 192
    tc = TC(W, H, seed)
    bt = H - 48                                                             # 기단 윗면
    # --- 3층(맨 위) 먼저: 뒤에 있는 것부터 그린다
    r3h = 34; t3h = 22; t2h = 26; t1h = 30; r1h = 22; r2h = 20
    t1_top = bt - t1h
    r1_top = t1_top + 6 - r1h
    t2_bot = r1_top + 3; t2_top = t2_bot - t2h
    r2_top = t2_top + 6 - r2h
    t3_bot = r2_top + 3; t3_top = t3_bot - t3h
    r3_top = t3_top + 8 - r3h
    # 꼭대기 지붕
    jroof(tc, 42, r3_top, 92, r3h, kind='hip', yb=.40, e=24, sori=3, flare=3, gold=True)
    # 3층 벽
    plaster_wall(tc, 54, t3_top + 8, 122, t3_bot, seed=seed + 3, posts=17)
    _win_row(tc, 56, 120, t3_top + 12, 3, 8, 7)
    for x in range(52, 124):                                                 # 난간(마루 끝 붉은 칠 난간 — 검은 칠)
        tc.px(x, t3_bot - 4, 'kuro', 4 if x < 120 else 3); tc.px(x, t3_bot - 3, 'kuro', 1)
        if x % 6 == 0:
            for y in range(t3_bot - 3, t3_bot): tc.px(x, y, 'kuro', 3)
    # 2층 처마(가운데 큰 박공)
    # 2층 벽
    plaster_wall(tc, 34, t2_top, 142, t2_bot, seed=seed + 2, posts=18)
    _win_row(tc, 36, 140, t2_top + 7, 4, 8, 8)
    jroof(tc, 24, r2_top, 128, r2h, kind='hip', yb=0.0, e=12, sori=3, flare=3, ridge=False, gable=[(64, 40, 16)])
    # 1층
    board_wall(tc, 14, t1_top + 18, 162, bt, 'kuro', seed=seed + 1, bw=4, base=3, battens=0)
    plaster_wall(tc, 14, t1_top, 162, t1_top + 18, seed=seed + 1, posts=20, beam=False)
    for x in range(14, 162): tc.px(x, t1_top + 17, 'wood', 4); tc.px(x, t1_top + 18, 'wood', 2)   # 판벽 위 띠
    _win_row(tc, 16, 160, t1_top + 6, 5, 8, 8)
    jroof(tc, 4, r1_top, 168, r1h, kind='hip', yb=0.0, e=14, sori=4, flare=3, ridge=False, gable=[(40, 32, 13), (128, 32, 13)])
    # 기단(돌담)
    ishigaki_face(tc, 0, bt, W, H, seed=seed + 7, batter=12, base=4)
    for x in range(12, W - 12): tc.px(x, bt, 'stone', 6); tc.px(x, bt + 1, 'stone', 5)    # 기단 윗면 모
    # 기단 문(어두운 문길 + 검은 칠 문짝 + 위 돌 인방)
    dx0 = 76
    for y in range(H - 26, H):
        for x in range(dx0, dx0 + 24):
            k = 2 if x < dx0 + 12 else 1
            if (x - dx0) in (0, 23): k = 4
            elif (x - dx0) % 4 == 0: k = 3
            if y in (H - 20, H - 9): k = 4
            m = 'kuro'
            if (x - dx0) in (5, 18) and y in (H - 20, H - 9): m, k = 'gold', 5          # 문 쇠장식(금 징)
            tc.px(x, y, m, k)
    for x in range(dx0 - 3, dx0 + 27):
        tc.px(x, H - 28, 'stone', 6); tc.px(x, H - 27, 'stone', 3)
    tc.grain(.03, mats=('plaster', 'stone'))
    return tc.fin(.6)


# ================================================================ 흙벽(도베이)
def dobei(n=4, seed=0, sama_kinds=('tri', 'sq', 'circ')):
    """성 흙벽 가로 토막 n칸 x 2줄(32px): 위 = 작은 맞배 기와 덮개(윗면 결 6px + 마룻대 + 처마 끝 줄), 앞 = 흰 회벽 + 아래 검은 판벽 띠,
    총안(세모·네모·동그라미) 칸마다 하나. 이어 찍으면 이음새 없음(결 주기 16)."""
    W = n * 16; H = 32
    tc = TC(W, H, seed)
    # 덮개 기와(위에서 본 맞배: 뒤 경사 3px · 마룻대 · 앞 경사 5px)
    for x in range(W):
        tc.px(x, 0, 'kawara', 5); tc.px(x, 1, 'kawara', kawara_k(x, 1, False))
        tc.px(x, 2, 'kawara', 6); tc.px(x, 3, 'kawara', 3)
        for y in range(4, 9): tc.px(x, y, 'kawara', kawara_k(x, y, True) - (1 if y > 6 else 0))
        tc.px(x, 9, 'kawara', 1)
        if x % 4 == 1: tc.px(x, 8, 'kawara', 4)
    for y in range(10, H):
        for x in range(W):
            if y < 23:
                k = 5 if y > 11 else 3
                if _hash(x, y, seed + 2) < .04: k -= 1
                tc.px(x, y, 'plaster', k)
            elif y == 23: tc.px(x, y, 'wood', 4)
            else:
                lx = x % 4; k = 3 + (1 if lx == 0 else 0) - (1 if lx == 3 else 0)
                if y == H - 1: k = 1
                tc.px(x, y, 'kuro', k)
    for i in range(n):
        sama(tc, i * 16 + 6, 15, sama_kinds[(i + seed) % len(sama_kinds)])
    tc.grain(.02, mats=('plaster',))
    return tc.fin(.6)


def dobei_ns(n=4, seed=0):
    """남북으로 달리는 흙벽(위에서 본 덮개 기와 줄만, 폭 12px) n칸. 남쪽 끝은 dobei 앞면과 맞닿는다."""
    W = 16; H = n * 16
    tc = TC(W, H, seed)
    for y in range(H):
        for x in range(2, 14):
            if x == 2: k = 6
            elif x < 7: k = kawara_k(y, x, False)
            elif x == 7: k = 6
            elif x == 8: k = 3
            elif x < 13: k = kawara_k(y, x, True) - 1
            else: k = 1
            tc.px(x, y, 'kawara', clamp(k, 1, 6))
    return tc.fin(.6)


# ================================================================ 망루
def yagura(seed=0, flip_=False):
    """모서리 망루(스미야구라) 5x6칸: 돌 기단 2줄 + 1층 흰 벽(아래 검은 판벽, 창 둘) + 1층 처마 + 2층 벽(창 둘) + 팔작지붕(치도리 박공)."""
    W, H = 80, 96
    tc = TC(W, H, seed)
    bt = H - 30
    t1h = 24; r1h = 14; t2h = 18; r2h = 26
    t1_top = bt - t1h; r1_top = t1_top + 5 - r1h
    t2_bot = r1_top + 3; t2_top = t2_bot - t2h
    r2_top = t2_top + 7 - r2h
    jroof(tc, 12, r2_top, 56, r2h, kind='hip', yb=.40, e=16, sori=3, flare=2, gable=[(28, 22, 9)])
    plaster_wall(tc, 18, t2_top + 6, 62, t2_bot, seed=seed + 2, posts=0)
    _win_row(tc, 20, 60, t2_top + 9, 2, 7, 6)
    board_wall(tc, 8, t1_top + 15, 72, bt, 'kuro', seed=seed + 1, battens=0)
    plaster_wall(tc, 8, t1_top, 72, t1_top + 15, seed=seed + 1, posts=0, beam=False)
    for x in range(8, 72): tc.px(x, t1_top + 14, 'wood', 4); tc.px(x, t1_top + 15, 'wood', 2)
    _win_row(tc, 10, 70, t1_top + 5, 2, 8, 7)
    jroof(tc, 2, r1_top, 76, r1h, kind='hip', yb=0.0, e=8, sori=3, flare=2, ridge=False)
    ishigaki_face(tc, 0, bt, W, H, seed=seed + 7, batter=6, base=4)
    for x in range(6, W - 6): tc.px(x, bt, 'stone', 6)
    tc.grain(.03, mats=('plaster', 'stone'))
    im = tc.fin(.6)
    return flip(im) if flip_ else im


def yaguramon(seed=0):
    """앵커 ②: 성문 망루(야구라몬) 7x6칸. 양쪽 돌담 기단 위에 2층 망루가 문길을 건너 얹힌다.
    아래: 가운데 3칸 문길(검은 칠 큰 문짝 두 짝이 안쪽으로 열림, 금 징, 굵은 가로 들보), 양옆 돌담. 위: 흰 회벽(창 셋) + 팔작지붕."""
    W, H = 112, 96
    tc = TC(W, H, seed)
    bt = H
    gx0, gx1 = 32, 80                                                        # 문길 (3칸)
    # 위층 망루
    r_h = 30; t_h = 22
    t_bot = H - 40; t_top = t_bot - t_h; r_top = t_top + 8 - r_h
    jroof(tc, 4, r_top, 104, r_h, kind='hip', yb=.40, e=24, sori=4, flare=3, gold=False, gable=[(52, 30, 12)])
    plaster_wall(tc, 10, t_top + 8, 102, t_bot, seed=seed + 2, posts=23)
    _win_row(tc, 14, 98, t_top + 11, 3, 10, 7)
    # 위층 바닥 들보(검은 칠 굵은 가로대) + 아래 처마 그늘
    for x in range(6, 106):
        for y in range(t_bot, t_bot + 6):
            k = 4 if y == t_bot else (3 if y < t_bot + 4 else 1)
            if x >= 104: k -= 1
            tc.px(x, y, 'kuro', k)
    # 양옆 돌담 기단
    ishigaki_face(tc, 0, t_bot + 6, gx0, H, seed=seed + 7, batter=0, base=4)
    ishigaki_face(tc, gx1, t_bot + 6, W, H, seed=seed + 8, batter=0, base=4)
    # 문길: 속 어둠(안쪽 마당이 살짝 보이는 그늘) + 열린 문짝 둘 + 문 기둥
    for y in range(t_bot + 6, H):
        for x in range(gx0, gx1):
            tc.px(x, y, 'dark', 2 if y < t_bot + 14 else 3)
        for x in (gx0, gx0 + 1, gx0 + 2, gx1 - 3, gx1 - 2, gx1 - 1):          # 문 기둥(굵은 나무)
            k = 5 if x in (gx0, gx1 - 3) else (4 if x in (gx0 + 1, gx1 - 2) else 2)
            tc.px(x, y, 'wood', k)
    for side in (0, 1):                                                      # 열린 문짝(안으로 젖혀져 비스듬히 보이는 좁은 면)
        x0 = gx0 + 3 if side == 0 else gx1 - 13
        for y in range(t_bot + 8, H - 1):
            for x in range(x0, x0 + 10):
                k = 3 if side == 0 else 2
                if (x - x0) % 3 == 0: k += 1
                if y in (t_bot + 14, H - 10): k = 4
                m = 'kuro'
                if y in (t_bot + 14, H - 10) and (x - x0) % 3 == 1: m, k = 'gold', 5
                tc.px(x, y, m, k)
    # 문 앞 문턱(돌)
    for x in range(gx0, gx1): tc.px(x, H - 1, 'stone', 4)
    tc.grain(.03, mats=('plaster', 'stone'))
    return tc.fin(.6)


# ================================================================ 마을 집
def thatch_roof(tc, x0, y0, W, H, seed=0, yb=.45, ends=True, ridge_cap=True):
    """초가 지붕(모임): 칩셋 thatch 램프, 짚 결 = 위에서 아래로 흐르는 가는 세로 결(2px 엇갈림) + 아래 끝 두툼한 처마(둥글게 깎은 끝).
    마룻대 = 대나무 덮개(가로 막대 + 묶은 매듭 X)."""
    e = min(W // 3, int(H * .9)) if ends else 0
    YB = H * yb
    for y in range(H):
        f = (y + .5) / H
        for x in range(W):
            xx = x + .5
            xl = e * (1 - f); xr = W - e * (1 - f)
            if e and xx < e and y < YB * (1 - xx / e): continue
            if e and xx > W - e and y < YB * (1 - (W - xx) / e): continue
            # 둥근 모서리: 아래 끝 양 귀를 깎는다
            if y > H - 4 and (x < (H - y) - 1 or x > W - (H - y)): continue
            gr = _hash(x // 2, (y + (x % 2) * 3) // 5, seed + 1)
            k = 4 + (1 if gr > .7 else 0) - (1 if gr < .25 else 0)
            if xx < xl: k += 1
            elif xx > xr: k -= 2
            elif y < YB: k += 1
            else: k -= (1 if y > YB + 3 else 0)
            if y >= H - 3: k = 3 if y == H - 3 else (2 if y == H - 2 else 1)       # 두툼한 처마 끝
            if y == H - 4 and (x + seed) % 3 == 0: k = 5
            tc.px(x0 + x, y0 + y, 'kaya', clamp(k, 1, 6))
    if ridge_cap:
        ry = int(YB) - 1
        for x in range(int(e * .1) + 2, W - int(e * .1) - 2):
            tc.px(x0 + x, y0 + ry - 1, 'take', 5); tc.px(x0 + x, y0 + ry, 'take', 3); tc.px(x0 + x, y0 + ry + 1, 'kaya', 1)
        for x in range(int(e * .1) + 6, W - int(e * .1) - 6, 7):                 # 묶은 매듭(X)
            tc.px(x0 + x, y0 + ry - 2, 'take', 4); tc.px(x0 + x + 1, y0 + ry - 2, 'take', 2)
            tc.px(x0 + x, y0 + ry + 2, 'kaya', 2)


def shoji_door(tc, x0, y0, w, h, ajar=False):
    """장지문(나무 살 + 종이). ajar = 반쯤 열려 속 어둠이 보인다."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx, ly = x - x0, y - y0
            if lx in (0, w - 1) or ly in (0, h - 1): tc.px(x, y, 'wood', 4 if lx == 0 or ly == 0 else 2); continue
            if ajar and lx >= w // 2: tc.px(x, y, 'dark', 2); continue
            if lx % 4 == 0 or ly % 5 == 0: tc.px(x, y, 'wood', 3)
            else: tc.px(x, y, 'washi', 5 if ly < h // 2 else 4)


def minka(w=5, seed=0, roof='thatch', door=2, lit=False, engawa=True):
    """민가 w칸 x 5줄: 초가(roof='thatch') 또는 널지붕(roof='plank' — 돌로 눌러 둔 판자 지붕).
    앞면 = 흙벽(회벽 톤 3~4, 아래 판벽) + 나무 기둥 + 장지문 + 작은 격자창, 마루(엔가와) 한 줄."""
    W = w * 16; H = 80
    tc = TC(W, H, seed)
    wall_top = 44; wall_bot = H - 4
    rh = 46 if roof == 'thatch' else 40
    # 벽
    for y in range(wall_top, wall_bot):
        for x in range(4, W - 4):
            if y < wall_top + 14:
                k = 4 if x < W - 6 else 3
                if y < wall_top + 3: k = 2
                if _hash(x, y, seed + 4) < .05: k -= 1
                tc.px(x, y, 'plaster', k)
            else:
                lx = (x - 4) % 5; k = 3 + (1 if lx == 0 else 0) - (1 if lx == 4 else 0)
                if x >= W - 6: k -= 1
                tc.px(x, y, 'wood', clamp(k, 1, 6))
    for px_ in list(range(4, W - 4, 16)) + [W - 6]:                            # 기둥
        for y in range(wall_top, wall_bot): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    # 장지문 (door 칸 = 왼쪽부터 칸 번호)
    dx = door * 16 + 1
    shoji_door(tc, dx, wall_top + 6, 14, wall_bot - wall_top - 6, ajar=True)
    # 창
    for i in range(w):
        if i == door or i == 0 and w <= 3: continue
        if (i + seed) % 2 == 0:
            cx = i * 16 + 4
            for y in range(wall_top + 5, wall_top + 12):
                for x in range(cx, cx + 9):
                    on = (x - cx) % 2 == 1
                    tc.px(x, y, 'wood' if on else ('amber' if lit else 'dark'), 3 if on else (4 if lit else 2))
    # 마루(엔가와): 앞 낮은 널 마루 + 받침 돌
    if engawa:
        for x in range(2, W - 2):
            tc.px(x, wall_bot, 'wood', 5); tc.px(x, wall_bot + 1, 'wood', 4)
            tc.px(x, wall_bot + 2, 'wood', 2); tc.px(x, wall_bot + 3, 'dark', 2)
        for x in range(3, W - 3, 12):
            tc.px(x, wall_bot + 3, 'stone', 4); tc.px(x + 1, wall_bot + 3, 'stone', 3)
    # 지붕
    if roof == 'thatch':
        thatch_roof(tc, 0, wall_top + 8 - rh, W, rh, seed=seed + 5, yb=.46)
    else:
        plank_roof(tc, 0, wall_top + 6 - rh, W, rh, seed=seed + 5)
    tc.grain(.03, mats=('plaster',))
    im = tc.fin(.6)
    return im


def plank_roof(tc, x0, y0, W, H, seed=0, yb=.38):
    """널지붕(맞배): 가로로 겹친 너와 판(줄마다 4px, 판 폭 6~10), 판마다 톤 흔들림, 누름돌(둥근 돌)과 누름대(가로 막대).
    양 끝은 박공 널(나무)."""
    YB = int(H * yb)
    for y in range(H):
        for x in range(W):
            row = y // 4; off = (row * 5) % 8
            col = (x + off) // 8; lx = (x + off) % 8
            h = _hash(col, row, seed + 2)
            if y < YB: k = 5 + (1 if h > .75 else 0) - (1 if h < .2 else 0)
            else: k = 3 + (1 if h > .75 else 0) - (1 if h < .2 else 0)
            if y % 4 == 3: k -= 1
            if lx == 7: k -= 1
            if y >= H - 2: k = 1 if y == H - 1 else 2
            if x < 2: k = 5 if x == 0 else 4
            if x >= W - 2: k = 1
            tc.px(x0 + x, y0 + y, 'wood', clamp(k, 1, 6))
    for x in range(1, W - 1):                                                  # 마룻대
        tc.px(x0 + x, y0 + YB - 1, 'wood', 6); tc.px(x0 + x, y0 + YB, 'wood', 2)
    for yy in (YB + 5, YB + 14):                                               # 누름대 + 누름돌
        if yy >= H - 3: continue
        for x in range(2, W - 2): tc.px(x0 + x, y0 + yy, 'wood', 5); tc.px(x0 + x, y0 + yy + 1, 'wood', 1)
        for x in range(5 + (yy % 7), W - 6, 11):
            tc.ell(x0 + x + 2, y0 + yy - 1, 2.6, 1.9, 'stone', lambda X, Y: 5 if Y < y0 + yy - 1 and X < x0 + x + 2 else 3)
    for y in range(2, YB):                                                     # 뒤 경사 위 누름돌 한 줄
        pass


def dojo(seed=0):
    """도장(수련장) 8x6칸: 넓은 기와 맞배+팔작 지붕(가운데 큰 박공), 앞면 = 나무 기둥 사이 장지문 여섯(가운데 둘 열림),
    높은 툇마루 + 돌 계단 셋, 처마 밑 걸린 판(글자 없음, 그냥 나무판)."""
    W, H = 128, 96
    tc = TC(W, H, seed)
    wall_top = 52; wall_bot = H - 10
    jroof(tc, 0, wall_top + 10 - 58, W, 58, kind='hip', yb=.42, e=26, sori=4, flare=2, gable=[(64, 46, 18)])
    # 처마 밑 그늘 띠 + 벽
    for y in range(wall_top + 10, wall_bot):
        for x in range(6, W - 6):
            tc.px(x, y, 'wood', 2 if y < wall_top + 13 else 3)
    xs = [6 + i * 19 for i in range(7)]
    for i in range(6):
        shoji_door(tc, xs[i] + 2, wall_top + 13, 17, wall_bot - wall_top - 13, ajar=(i in (2, 3)))
    for px_ in xs + [W - 8]:
        for y in range(wall_top + 10, wall_bot): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    # 툇마루 + 받침
    for x in range(2, W - 2):
        tc.px(x, wall_bot, 'wood', 6); tc.px(x, wall_bot + 1, 'wood', 5); tc.px(x, wall_bot + 2, 'wood', 4)
        for y in range(wall_bot + 3, H - 1): tc.px(x, y, 'dark', 2 if (x % 14) > 2 else 1)
        tc.px(x, H - 1, 'dark', 1)
    for x in range(4, W - 4, 14):
        for y in range(wall_bot + 3, H): tc.px(x, y, 'wood', 3); tc.px(x + 1, y, 'wood', 2)
    for j, (sx0, sx1) in enumerate(((50, 78), (46, 82))):                     # 돌 계단(가운데)
        y = wall_bot + 3 + j * 3
        for x in range(sx0, sx1):
            for yy in range(y, y + 3): tc.px(x, yy, 'stone', 6 if yy == y else (4 if x < sx1 - 2 else 3))
    # 처마 밑 판(글자 없는 나무 판)
    for y in range(wall_top + 4, wall_top + 12):
        for x in range(54, 74):
            k = 5 if y == wall_top + 4 else (4 if x < 72 else 3)
            if y == wall_top + 11: k = 2
            tc.px(x, y, 'wood', k)
    tc.grain(.02, mats=('washi',))
    return tc.fin(.6)


def mill_hut(seed=0):
    """물레방아 오두막 4x4칸(널지붕 집). 물레방아 바퀴는 따로(water_wheel) — 오두막 동쪽 벽에 붙여 개울 위에 놓는다."""
    W, H = 64, 64
    tc = TC(W, H, seed)
    wall_top = 32; wall_bot = H - 2
    board_wall(tc, 4, wall_top, W - 4, wall_bot, 'wood', seed=seed + 1, bw=5, base=3, battens=12)
    shoji_door(tc, 10, wall_top + 8, 14, wall_bot - wall_top - 8, ajar=True)
    for y in range(wall_top + 6, wall_top + 13):
        for x in range(36, 50): tc.px(x, y, 'wood' if (x - 36) % 3 == 0 else 'dark', 3 if (x - 36) % 3 == 0 else 1)
    plank_roof(tc, 0, wall_top + 4 - 34, W, 34, seed=seed + 4)
    return tc.fin(.6)


def water_wheel(seed=0, frame=0):
    """물레방아 바퀴(앞에서 비스듬히, 지름 44px) 3x4칸: 나무 테 두 겹 + 바큇살 여덟 + 물받이 판 + 굴대(나무 받침), 아래로 떨어지는 물."""
    W, H = 48, 64
    tc = TC(W, H, seed)
    cx, cy, R = 24, 30, 21
    a0 = frame * math.pi / 16
    for y in range(H):
        for x in range(W):
            d = math.hypot((x + .5 - cx), (y + .5 - cy) * 1.0)
            if R - 3 <= d <= R:
                ang = math.atan2(y + .5 - cy, x + .5 - cx)
                k = 4 if ang < -1.2 or ang > 2.4 else (3 if ang < .8 else 2)
                if d > R - 1: k -= 1
                tc.px(x, y, 'wood', k)
            elif R - 7 <= d < R - 5:
                tc.px(x, y, 'wood', 3)
    for i in range(8):                                                          # 바큇살
        a = a0 + i * math.pi / 4
        for r in range(3, R - 2):
            tc.px(cx + math.cos(a) * r, cy + math.sin(a) * r, 'wood', 4 if math.cos(a) < 0 else 3)
    for i in range(16):                                                         # 물받이 판(바깥 테에 돋은 판)
        a = a0 + i * math.pi / 8
        for r in range(R, R + 3):
            for t in (-1, 0, 1):
                x = cx + math.cos(a) * r - math.sin(a) * t * .9; y = cy + math.sin(a) * r + math.cos(a) * t * .9
                tc.px(x, y, 'wood', 5 if t < 0 else 2)
    tc.ell(cx, cy, 4, 4, 'wood', lambda X, Y: 5 if X < cx else 2)              # 굴대
    tc.px(cx - 1, cy - 1, 'wood', 6)
    for y in range(cy + 4, H):                                                  # 받침 기둥
        tc.px(cx - 1, y, 'wood', 4); tc.px(cx, y, 'wood', 3); tc.px(cx + 1, y, 'wood', 2)
    for y in range(H - 18, H):                                                  # 떨어지는 물(물받이에서 흘러내림)
        for x in range(4, 12):
            if _hash(x, y // 2, seed + frame) < .55: tc.px(x, y, 'glass', 5 if (x + y) % 3 else 6, 210)
    return tc.fin(.6)


def hokora(seed=0):
    """작은 사당(호코라) 3x3칸: 돌 받침 2단 + 나무 사당(맞배 기와 지붕, 앞 격자문 + 금 방울 끈), 앞 붉은 칠 테."""
    W, H = 48, 48
    tc = TC(W, H, seed)
    for j, (a, b, y0, y1) in enumerate(((4, 44, 38, 48), (8, 40, 32, 38))):     # 돌 받침 두 단
        for y in range(y0, y1):
            for x in range(a, b):
                k = 6 if y == y0 else (4 if x < b - 2 else 3)
                if y == y1 - 1: k = 2
                if (x - a) % 10 == 9 and y > y0: k = 2
                tc.px(x, y, 'stone', k)
    for y in range(18, 32):                                                     # 사당 몸
        for x in range(12, 36):
            if x in (12, 13, 34, 35): tc.px(x, y, 'shu', 4 if x < 20 else 2)
            elif y < 21: tc.px(x, y, 'wood', 2)
            else:
                lx = x - 14
                tc.px(x, y, 'wood' if lx % 3 == 0 or y % 4 == 0 else 'dark', 4 if lx % 3 == 0 else 1)
    for y in range(22, 30): tc.px(24, y, 'redl', 4)                             # 방울 끈
    tc.ell(24, 22, 2, 2, 'gold', lambda X, Y: 6 if X < 24 else 4)
    jroof(tc, 6, 2, 36, 20, kind='gable', yb=.42, sori=2, flare=2, oni=True)
    return tc.fin(.6)


def torii(seed=0, w=4):
    """도리이(붉은 칠 문) w칸 x 4줄: 기둥 둘(원통 음영 + 검은 밑동 감싸개), 위 갓돌(검게 칠한 가사기 — 양 끝이 위로 휜다) + 붉은 시마기,
    아래 꿰뚫은 가로대(누키), 가운데 받침(글자 없는 빈 판)."""
    W, H = w * 16, 64
    tc = TC(W, H, seed)
    pl, pr = 10, W - 14                                                       # 기둥 왼쪽 x
    for (px_) in (pl, pr):
        for y in range(10, H):
            for i in range(4):
                k = (5, 4, 3, 2)[i]
                m = 'kuro' if y > H - 7 else 'shu'
                tc.px(px_ + i, y, m, k)
        for i in range(-1, 5): tc.px(px_ + i, H - 7, 'kuro', 4)
    for x in range(2, W - 2):                                                 # 가사기(위 갓돌, 양 끝 휨)
        u = abs(x + .5 - W / 2.0) / (W / 2.0)
        lift = int(round(3 * u ** 2.5))
        for j in range(3): tc.px(x, 3 - lift + j, 'kuro', (5, 3, 1)[j])
        for j in range(3): tc.px(x, 6 - lift + j, 'shu', (5, 4, 2)[j]) if 4 <= x < W - 4 else None
    for x in range(6, W - 6):                                                 # 누키(아래 가로대)
        tc.px(x, 18, 'shu', 5); tc.px(x, 19, 'shu', 4); tc.px(x, 20, 'shu', 2)
    for y in range(9, 18):                                                    # 가운데 받침(빈 판)
        for x in range(W // 2 - 3, W // 2 + 3):
            tc.px(x, y, 'shu', 4 if x < W // 2 + 2 else 2)
    return tc.fin(.6)


def well(seed=0):
    """우물(이도) 3x3칸: 돌 테(3/4 윗면 + 앞면, 속은 어두운 물), 위 작은 맞배 지붕(기둥 둘), 도르래와 두레박."""
    W, H = 48, 48
    tc = TC(W, H, seed)
    cx, cy = 24, 36
    for y in range(28, 46):                                                   # 돌 테
        for x in range(8, 40):
            d = ((x + .5 - cx) / 16) ** 2 + ((y + .5 - cy) / 7) ** 2
            if y < cy and d <= 1:
                inner = ((x + .5 - cx) / 12) ** 2 + ((y + .5 - cy) / 4.5) ** 2 <= 1
                if inner: tc.px(x, y, 'water', 1 if y < cy - 2 else 2); continue
                tc.px(x, y, 'stone', 6 if x < cx else 5)
            elif y >= cy and abs(x + .5 - cx) <= 16:
                k = 4 if x < cx + 10 else 3
                if (x + (y // 4) * 4) % 8 == 7: k = 2
                if y % 4 == 3: k = 2
                if y == 45: k = 1
                tc.px(x, y, 'stone', k)
    for px_ in (10, 36):                                                      # 기둥
        for y in range(12, 34): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 2)
    for x in range(10, 38): tc.px(x, 16, 'wood', 4); tc.px(x, 17, 'wood', 2)
    tc.ell(24, 17, 3, 3, 'wood', lambda X, Y: 5 if X < 24 else 2)             # 도르래
    for y in range(20, 30): tc.px(24, y, 'thatch' if 'thatch' in MID else 'wood', 4)
    for y in range(28, 33):                                                   # 두레박
        for x in range(21, 28): tc.px(x, y, 'wood', 4 if x < 26 else 2)
    jroof(tc, 4, 0, 40, 16, kind='gable', yb=.40, sori=2, flare=2, oni=False)
    return tc.fin(.6)


def plank_fence(n=4, seed=0, door=None, door_open=False):
    """숨은 마을 판자벽 n칸 x 2줄: 세로 널 판벽(위 끝 들쭉날쭉 끝 + 덮개 각목) + 기둥 4칸마다.
    door = 회전 숨은 문 칸 번호(겉모습은 판벽과 같고 이음만 0.5px 다르다 — 「아는 사람만 보이는 가는 세로 틈」).
    door_open = 회전 중(문 판이 옆으로 돌아서 가운데 막대만 보이고 양옆 틈이 어둡다)."""
    W, H = n * 16, 32
    tc = TC(W, H, seed)
    for y in range(3, H):
        for x in range(W):
            col = x // 4; lx = x % 4
            top = 3 + int(_hash(col, 0, seed + 1) * 2)
            if y < top: continue
            k = 3 + (1 if _hash(col, 1, seed + 2) > .6 else 0) - (1 if _hash(col, 2, seed + 2) < .2 else 0)
            if lx == 0: k += 1
            elif lx == 3: k -= 1
            if y == top: k = 5
            if y >= H - 2: k = 1 if y == H - 1 else 2
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for yy in (8, 22):                                                        # 띠목
        for x in range(W): tc.px(x, yy, 'wood', 4); tc.px(x, yy + 1, 'wood', 1)
    for px_ in range(0, W, 32):                                               # 기둥
        for y in range(1, H): tc.px(px_, y, 'wood', 5); tc.px(px_ + 1, y, 'wood', 4); tc.px(px_ + 2, y, 'wood', 2)
    if door is not None:
        dx0 = door * 16
        if door_open:
            for y in range(5, H - 1):
                for x in range(dx0 + 1, dx0 + 15):
                    tc.px(x, y, 'dark', 1 if abs(x - (dx0 + 8)) > 1 else 0)
                tc.px(dx0 + 7, y, 'wood', 5); tc.px(dx0 + 8, y, 'wood', 3); tc.px(dx0 + 9, y, 'wood', 2)   # 돌아선 판(옆에서 본 두께)
        else:
            for y in range(6, H - 2):                                          # 가는 세로 틈 두 줄(문 테두리)
                tc.px(dx0 + 1, y, 'wood', 1); tc.px(dx0 + 14, y, 'wood', 1)
            tc.px(dx0 + 12, 16, 'wood', 6); tc.px(dx0 + 12, 17, 'wood', 2)    # 옹이처럼 보이는 손잡이 홈
    return tc.fin(.6)


def bridge_ns(rows=3, w=4, seed=0):
    """해자 다리(남북) w칸 x rows줄: 판자 바닥(가로 널, 위에서 본다) + 양쪽 붉은 칠 난간(기둥 머리 금 장식 의보주) + 아래 남쪽 끝 다리 앞면(교각 그늘)."""
    W, H = w * 16, rows * 16 + 8
    tc = TC(W, H, seed)
    for y in range(0, rows * 16):
        for x in range(4, W - 4):
            ly = y % 4; k = 4 + (1 if _hash(x // 9, y // 4, seed + 1) > .7 else 0)
            if ly == 3: k = 2
            if ly == 0: k += 1
            if x >= W - 6: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for y in range(rows * 16, H):                                             # 남쪽 끝 앞면(다리 턱 + 교각)
        for x in range(4, W - 4):
            k = 3 if y < rows * 16 + 3 else 1
            if y >= rows * 16 + 3 and (x - 4) % 16 in (0, 1, 2): k = 3
            tc.px(x, y, 'wood' if k > 1 else 'dark', k)
    for side, x0 in ((0, 1), (1, W - 5)):                                     # 난간
        for y in range(-2, rows * 16 + 2):
            for i in range(4):
                if y < 0: continue
                k = (5, 4, 3, 2)[i] if side == 0 else (4, 3, 2, 1)[i]
                if i in (0, 3) and y % 16 not in (0, 1, 2, 3, 4): continue           # 기둥 사이에는 가운데 두 줄(가로대)만
                tc.px(x0 + i, y, 'shu', k)
        for py in range(0, rows * 16 + 1, 16):
            yy = min(py, rows * 16 - 1)
            tc.ell(x0 + 2, yy + 1, 2.2, 2.2, 'gold', lambda X, Y: 6 if X < x0 + 2 else 4)
    return tc.fin(.6)


def plank_bridge(seed=0):
    """개울 위 작은 널다리(동서) 3x2칸: 통나무 둘 위에 가로 널."""
    W, H = 48, 24
    tc = TC(W, H, seed)
    for y in range(4, 16):
        for x in range(W):
            lx = x % 6; k = 4 + (1 if _hash(x // 6, 0, seed) > .6 else 0)
            if lx == 5: k = 2
            if y == 4: k += 1
            if y >= 14: k -= 1
            tc.px(x, y, 'wood', clamp(k, 1, 6))
    for y in range(16, 22):
        for x in range(W): tc.px(x, y, 'wood', 3 if y < 18 else 1) if (x < 6 or x > W - 7) else tc.px(x, y, 'dark', 2) if y < 18 else None
    return tc.fin(.6)
