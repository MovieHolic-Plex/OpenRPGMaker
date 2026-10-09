# 녹청 지붕 — 버들항 칩셋 슬레이트 지붕 쌍(뒤 경사 빛 256,224/256,240 · 앞 경사 그늘 272,224 · 처마 272,240)의
# 기와 결(4px 기와 조각, 줄마다 엇갈림)을 밝기 순위 그대로 녹청 램프 VERD 로 옮긴다. 마룻대·추녀마루·물받이는 밝은 동판 VERDL.
# 형태는 버들항 ph2.steep_hip 과 같은 기하(뒤 경사·앞 경사·양 끝 삼각, 서 빛·동 그늘). 다락창·굴뚝·박공·원뿔 지붕. 결정적.
from vq_base import *
from vq_base import _h
import vq_wall as WL

def _lin(at):
    d = chip(*at); l = L(d); return np.clip(np.rint(1 + (l - l.min()) / max(1, l.max() - l.min()) * 5), 1, 6).astype(int)
TB0 = _lin(ROOF_BACK0); TB = _lin(ROOF_BACK); TF = _lin(ROOF_FRONT); TE = _lin(ROOF_EAVE)

def tile_k(x, y, face, yrel=0.0):
    """기와 한 화소의 단. face: back(빛) · front(그늘, yrel 0→1 로 처마 쪽 한 단 더 어둡게) · west(서 끝, 빛) · east(동 끝, 그늘)."""
    if face == 'back': return clamp(TB[y % 16, x % 16] - 1, 2, 6)
    if face == 'west': return clamp(TF[x % 16, y % 16] - 1, 2, 5)          # 결이 세로로 돈다
    if face == 'east': return clamp(TF[x % 16, y % 16] - 3, 1, 3)
    k = TF[y % 16, x % 16] - 2
    if yrel < .18: k += 1
    if yrel > .8: k -= 1
    return clamp(k, 1, 5)

def roof_hip(W, Rh, ends='LR', yb=.3, e=None, seed=1):
    """급경사 모임지붕(동서 용마루): 위 yb 까지 뒤 경사(빛), 마룻대(동판 3px), 아래 앞 경사(그늘, 처마 쪽 한 단 더),
    양 끝 삼각(서 빛·동 그늘, 추녀마루 동판). ends 에 없는 끝은 박공 끝(2px 동판 테). 맨 아래 처마 물받이 동판 2px."""
    pen = Pen(W, Rh)
    e = e if e is not None else min(W // 3, int(Rh * .85))
    el = e if 'L' in ends else 0; er = e if 'R' in ends else 0
    YB = Rh * yb
    for y in range(Rh):
        xl = el * (1 - (y + .5) / Rh); xr = W - er * (1 - (y + .5) / Rh)
        for x in range(W):
            xx = x + .5
            if el and xx < el and y < YB * (1 - xx / el): continue
            if er and xx > W - er and y < YB * (1 - (W - xx) / er): continue
            if xx < xl: R, k = VERD, tile_k(x, y, 'west')
            elif xx > xr: R, k = VERD, tile_k(x, y, 'east')
            elif y < YB: R, k = VERD, tile_k(x, y, 'back')
            else: R, k = VERD, tile_k(x, y, 'front', (y - YB) / max(1, Rh - YB))
            if el and xx < el and abs(y - YB * (1 - xx / el)) < 1: R, k = VERDL, 5
            if er and xx > W - er and abs(y - YB * (1 - (W - xx) / er)) < 1: R, k = VERDL, 3
            if el and abs(xx - xl) < 1 and y >= YB - 1: R, k = VERDL, 5
            if er and abs(xx - xr) < 1 and y >= YB - 1: R, k = VERDL, 2
            if abs(y + .5 - YB) < 1.5 and xl - .5 <= xx <= xr + .5: R, k = VERDL, (5 if y + .5 < YB else 3)
            if y == 0 and xl <= xx <= xr: R, k = VERDL, 4
            if not el and x < 2: R, k = VERDL, (5 if x == 1 else 2)
            if not er and x >= W - 2: R, k = VERDL, (3 if x == W - 2 else 1)
            pen.p(x, y, R, k)
    for x in range(W):                                                      # 처마 물받이
        if pen.g(x, Rh - 2)[3]: pen.p(x, Rh - 2, VERDL, 4 if x % 6 else 3); pen.p(x, Rh - 1, VERD, 1)
    # 마룻대 위 작은 동판 장식(수탉 대신 짧은 창끝 두 개)
    return pen

def dormer(kind='point', w=14, h=22, seed=1):
    """다락창(앞 경사 위에 얹는다, 아래 끝이 처마선 위 2~4px): point 뾰족 박공(녹청 작은 지붕 + 크림 앞면 + 덧문 창) ·
    round 둥근 황소눈 창(동판 덮개 아치) · wide 넓은 다락(쌍창). 그림 아래 3px 는 지붕 위 그늘."""
    pen = Pen(w, h)
    if kind == 'round':
        cx = w / 2.0; r = w / 2.0 - .5
        for y in range(h):
            for x in range(w):
                d = math.hypot(x + .5 - cx, y + .5 - (h - 6))
                if y < h - 6 and d > r: continue
                if y >= h - 3: continue
                if d > r - 2.2 or y >= h - 6: pen.p(x, y, VERDL, 5 if x < cx else 2)
                else: pen.p(x, y, VERDL, 4 if x < cx else 3)
        for y in range(h):
            for x in range(w):
                d = math.hypot(x + .5 - cx, y + .5 - (h - 7))
                if d <= r - 3.0 and y < h - 5:
                    if d <= r - 4.6: pen.p(x, y, GLASS, 2 if y < h - 9 else 1)
                    else: pen.p(x, y, TRIM, 5 if x < cx else 3)
        pen.p(int(cx) - 2, h - 11, GLASS, 5)
        for x in range(1, w - 1): pen.p(x, h - 3, VERD, 1); pen.p(x, h - 2, VERD, 2)
        return pen.im
    gx = w / 2.0
    rh = h * .5 if kind == 'point' else h * .42
    for y in range(int(rh) + 2):                                          # 작은 지붕(뾰족)
        half = (y + 1) / (rh + 1) * (gx + 1.5)
        for x in range(w):
            d = x + .5 - gx
            if abs(d) > half: continue
            if abs(abs(d) - half) < 1.2: pen.p(x, y, VERDL, 5 if d < 0 else 2)
            else: pen.p(x, y, VERD, tile_k(x + seed * 3, y, 'west' if d < 0 else 'east'))
    face_top = int(rh) - 1
    for y in range(face_top, h - 3):                                        # 앞면(크림 판 + 창)
        half = (y + 1) / (rh + 1) * (gx + 1.5) - 1.6
        for x in range(1, w - 1):
            d = x + .5 - gx
            if y < int(rh) + 2 and abs(d) > half: continue
            pen.p(x, y, CREAM, 5 if x < 3 else (4 if x < w - 3 else 3))
    ww = 6 if kind == 'point' else 4
    xs = [int(gx - ww / 2)] if kind == 'point' else [2, w - 2 - ww]
    for wx in xs:
        for y in range(face_top + 3, h - 4):
            for x in range(wx, wx + ww):
                pen.p(x, y, SHUT if kind == 'point' else GLASS, (4 if (y - face_top) % 2 else 2) if kind == 'point' else (2 if y < h - 7 else 1))
        for y in range(face_top + 2, h - 3): pen.p(wx - 1, y, TRIM, 5); pen.p(wx + ww, y, TRIM, 3)
        for x in range(wx - 1, wx + ww + 1): pen.p(x, face_top + 2, TRIM, 6); pen.p(x, h - 4, TRIM, 4)
    for x in range(0, w): pen.p(x, h - 3, VERDL, 3); pen.p(x, h - 2, VERD, 1)       # 다락 처마
    for y in range(int(rh) - 1, h - 3): pen.p(0, y, VERD, 2); pen.p(w - 1, y, VERD, 1)
    return fin(pen.im, .7)

def chimney(h=20, w=10, kind='stone', seed=1):
    """굴뚝: 갓돌 윗면(밝음) + 연통 구멍 둘(어둠) + 앞면(크림 마름돌 또는 벽돌) + 오른쪽 그늘. 아래 2px 는 지붕에 묻힌 그늘."""
    pen = Pen(w + 2, h)
    for y in range(4, h):
        for x in range(1, w + 1):
            if kind == 'brick':
                row = (y - 4) // 3; ly = (y - 4) % 3; lx = (x + (2 if row % 2 else 0)) % 5
                k = 2 if (ly == 2 or lx == 4) else 3 + (1 if _h(x // 5, row, seed) > .5 else 0)
                pen.p(x, y, BRICK, k)
            else:
                row = (y - 4) // 4; ly = (y - 4) % 4; lx = (x + (3 if row % 2 else 0)) % 6
                k = 3 if (ly == 3 or lx == 5) else 4 + (1 if _h(x // 6, row, seed) > .6 else 0) + (1 if ly == 0 else 0)
                pen.p(x, y, CREAM, k)
            if x >= w - 1: pen.dark(x, y, .7)
    for x in range(0, w + 2):                                               # 갓돌
        pen.p(x, 2, TRIM, 6 if x < (w + 2) // 2 else 5); pen.p(x, 3, TRIM, 3)
    for x in range(1, w + 1): pen.p(x, 1, TRIM, 5)
    for (a, b) in ((2, 4), (w - 3, w - 1)):
        for x in range(a, b): pen.p(x, 0, DARK, 2); pen.p(x, 1, DARK, 1)
        pen.p(a, 0, BRICK, 4)
    for x in range(1, w + 1): pen.dark(x, h - 1, .6); pen.dark(x, h - 2, .8)
    return fin(pen.im, .72)

def gable_front(W, run, G, seed=1, attic='round'):
    """박공이 길 쪽을 향한 집의 지붕(남북 용마루): 위 run = 지붕 윗면(왼 경사 빛·오른 경사 그늘, 가운데 동판 마룻대),
    아래 G = 앞 박공 삼각벽(크림 마름돌, 동판 박공널 2px, 가운데 둥근 다락창 또는 쌍창). 맨 위 먼 박공 끝 뾰족."""
    Hh = run + G; pen = Pen(W, Hh); gx = W / 2.0
    pk = max(6, G // 2)
    for y in range(Hh):
        for x in range(W):
            d = x + .5 - gx
            if y < pk and abs(d) > gx * (y + 1) / pk: continue
            if y >= run: continue
            if abs(d) < 1.5: pen.p(x, y, VERDL, 5 if d < 0 else 3); continue
            k = tile_k(y, x, 'back') if d < 0 else tile_k(y, x, 'east') + 1
            pen.p(x, y, VERD, clamp(k, 1, 6))
    for y in range(G):
        half = (y + 1) / G * gx
        for x in range(W):
            dd = abs(x + .5 - gx)
            if dd > half: continue
            yy = run + y
            if dd > half - 2.5: pen.p(x, yy, VERDL, (5 if x < gx else 2) if dd > half - 1.2 else (4 if x < gx else 3))
            else: pen.c(x, yy, (0, 0, 0))
    sub = Pen(W, G); WL.ashlar(sub, 0, 0, W, G, seed=seed + 5)
    for y in range(G):
        half = (y + 1) / G * gx - 2.5
        for x in range(W):
            if abs(x + .5 - gx) <= half: pen.c(x, run + y, sub.g(x, y)[:3])
    ay = run + int(G * .42)
    if attic == 'round':
        for y in range(ay - 5, ay + 6):
            for x in range(int(gx) - 6, int(gx) + 6):
                d = math.hypot(x + .5 - gx, y + .5 - ay)
                if d <= 3.6: pen.p(x, y, GLASS, 2 if y < ay else 1)
                elif d <= 5.2: pen.p(x, y, TRIM, 6 if (x < gx and y < ay + 1) else 3)
        pen.p(int(gx) - 2, ay - 2, GLASS, 5)
        for y in range(ay - 3, ay + 4): pen.p(int(gx), y, TRIM, 3)
    elif attic == 'pair':
        for s in (-1, 1): WL.window(pen, int(gx + s * 6) - 3, ay - 3, 6, 9, 'S', seed + s)
    for x in range(W):
        if abs(x + .5 - gx) <= gx - 1: pen.p(x, Hh - 1, TRIM, 3); pen.p(x, Hh - 2, TRIM, 5)
    return pen

def cone(W, Hh, seed=1):
    """원뿔 지붕(둥근 탑): 꼭지 동판 창끝, 왼쪽 빛·오른쪽 그늘 원통 음영, 기와 줄은 아래로 넓어진다. 맨 아래 처마 동판."""
    pen = Pen(W, Hh); cx = W / 2.0
    for y in range(4, Hh):
        f = (y - 3) / (Hh - 3); half = cx * (f ** .85)
        for x in range(W):
            d = (x + .5 - cx) / max(.5, half)
            if abs(d) > 1: continue
            tk = TF[(y * 2) % 16, int((d + 1) * 6) % 16]
            k = 4 - (d + .3) * 2.2 + (tk - 3) * .5
            if y > Hh - 3: pen.p(x, y, VERDL, 4 if d < 0 else 2); continue
            pen.p(x, y, VERD, clamp(int(round(k)), 1, 6))
    for y in range(0, 6): pen.p(int(cx), y, VERDL, 6 if y < 2 else 4)
    pen.p(int(cx) - 1, 3, VERDL, 5); pen.p(int(cx) + 1, 3, VERDL, 3)
    return pen
