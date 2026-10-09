"""국내성식 집 변형 세트 — ㄱ자·ㄷ자 몸채, 주막(ㅁ자 마당집) 키트, 상점 4종, 2층 기와집, 초가 변형, 구획 담.

모두 blocks.house/assemble 의 칸 조립 문법(블록 = 칸)을 쓰고, 폭(칸 수)·층수·날개 길이를 함수 인자로 바꿔 다시 조립한다.
색은 tk.RGB 램프만 쓴다(팔레트 잠금). 빛은 왼쪽 위(왼쪽 사면 밝음), 그림자는 오른쪽 아래.

[날개(꺾인 몸채) 3/4 문법]  깊이 방향으로 달리는 맞배 지붕을 정면-위에서 보면
  · 두 사면은 가운데 용마루 세로선을 기준으로 왼쪽(밝음)·오른쪽(어두움) 세로 띠이고, 기왓골도 세로로 달린다.
  · 위 경계(몸채 지붕과 만나는 골)와 아래 경계(박공 풍판)는 모두 가운데가 높은 ∧ 모양이다.
  · 박공(앞 벽 삼각형) 아래로 벽 두 행 + 기단이 이어진다. 날개 지붕이 몸채 벽 앞을 가리므로 사선 뒤 빈칸이 없다.
"""
import numpy as np
from tk import *
from build import outline, _snap_dark
import blocks as K
import roof3d
from props5 import box, cyl, ell, shadow_ell, jar

# ---------------------------------------------------------------- 램프·라이브러리
_DB = [RGB['wood'][0]] + RGB['wood'][0:6]          # 짙은 갈색 기와 램프(7단): 어두운 적갈색
RAMPS = {'giwa': RGB['giwa'], 'teal': RGB['dgreen'], 'brown': _DB}
roof3d_ramp_orig = roof3d._ramp


def _ramp_patched(style):
    return RAMPS['brown'] if style == 'dbrown' else roof3d_ramp_orig(style)


roof3d._ramp = _ramp_patched
BARAM = {'giwa': 'giwa', 'teal': 'dg', 'brown': 'dbrown'}      # roof_baram 스타일 이름
_LIBS = {}


def lib_for(ramp='giwa'):
    """블록 라이브러리. 지붕 램프만 바꾼 사본(기와 색 변형)."""
    if ramp not in _LIBS:
        saved = RGB['giwa']
        RGB['giwa'] = RAMPS[ramp]
        try:
            _LIBS[ramp] = K.library()
        finally:
            RGB['giwa'] = saved
    return _LIBS[ramp]


# ---------------------------------------------------------------- 공통 그리기 도구
def tile_px(x, y, tones):
    """세로 기왓골 4px 주기 + 8행마다 한 장 끝 마디(칸 높이 16 의 약수라 위아래로 이어 붙여도 이음이 없다)."""
    deep, dark, base, hi = tones
    k = x % 4
    col = [hi, base, dark, base][k]
    seg = y % 8
    if seg == 7 and k in (1, 2): col = dark if col == base else deep
    if seg == 0 and k in (0, 1): col = hi
    return col


def shade_part(cv, xa, xb, y0, y1, k=0.24):
    """벽 오른쪽을 어둡게(빛은 왼쪽 위). K.finish_house 와 같은 식을 한 부분(몸채·날개)의 벽 사각형에만 건다."""
    cache = {}
    for y in range(y0, min(cv.h, y1)):
        for x in range(xa, min(cv.w, xb + 1)):
            if cv.a[y, x, 3] != 255: continue
            t = (x - xa) / max(1, xb - xa)
            f = 1.0 - k * max(0.0, (t - 0.45) / 0.55) ** 1.4
            if f < 0.985:
                c = tuple(int(v) for v in cv.a[y, x, :3])
                kk = (c, round(f, 2))
                if kk not in cache: cache[kk] = _snap_dark(tuple(int(v * f) for v in c))
                cv.put(x, y, cache[kk])


def cast_right(cv, x_edge, y0, y1, width=7):
    """지붕 처마가 오른쪽 벽에 드리운 그림자: 가장자리 가까울수록 촘촘한 체크 디더."""
    for y in range(y0, min(cv.h, y1)):
        for x in range(x_edge, min(cv.w, x_edge + width)):
            if cv.a[y, x, 3] != 255: continue
            d = x - x_edge
            on = (d < 2) or (d < 4 and (x + y) % 2 == 0) or (d < width and (x % 2 == 0 and y % 2 == 0))
            if on:
                cv.a[y, x, :3] = _snap_dark(tuple(int(v * 0.74) for v in cv.a[y, x, :3]))


def ground_shadow(cv, x0, x1, y_base, drop=5, lean=7, tall=26):
    """건물 아래·오른쪽 땅 그림자. y_base = 기단 마지막 줄 y."""
    for y in range(y_base + 1, min(cv.h, y_base + 1 + drop)):
        for x in range(x0 + lean * (y - y_base) // drop, x1 + lean + 1):
            if 0 <= x < cv.w and cv.a[y, x, 3] == 0:
                cv.put(x, y, SHADOW, 90 - 12 * (y - y_base))
    for x in range(x1 + 1, min(cv.w, x1 + 1 + lean)):
        for y in range(y_base - tall, y_base + 1):
            if y >= 0 and cv.a[y, x, 3] == 0:
                cv.put(x, y, SHADOW, 70)


def paste_front(dst, core, x0=0, y0=0):
    """core 를 dst 위에 얹되 반투명 그림자는 dst 의 이미 칠한 화소와 섞지 않는다(섞으면 팔레트 밖 색이 생긴다)."""
    h, w = core.h, core.w
    for yy in range(h):
        for xx in range(w):
            p = core.a[yy, xx]
            if p[3] == 0: continue
            X, Y = x0 + xx, y0 + yy
            if not (0 <= X < dst.w and 0 <= Y < dst.h): continue
            if p[3] == 255 or dst.a[Y, X, 3] == 0:
                dst.a[Y, X] = p


def paste_rows(cv, rows, L, x0, y0):
    for y, row in enumerate(rows):
        for x, n in enumerate(row.split()):
            if n != '.': cv.paste(L[n], x0 + x * T, y0 + y * T)


# ---------------------------------------------------------------- 깊이 방향 맞배 지붕 띠(날개)
def gable_band(cv, x0, x1, yt, yb, y_e, G, kind='tile', top='valley', bottom='gable', wall=None, seed=0):
    """깊이 방향으로 달리는 맞배 지붕을 앞에서 본 띠. 폭 x0..x1-1 (처마 포함), 위쪽 ∧ 꼭짓점 yt, 아래쪽 ∧ 꼭짓점 yb,
    박공 벽 아래 처마선 y_e. top: 'cont'(위로 이어짐) | 'valley'(몸채 지붕과 만나는 골) | 'cap'(뒤 끝, 풍판+치미).
    bottom: 'cont'(아래로 이어짐/앞 건물에 가림) | 'gable'(박공+풍판). wall = (벽 x0, 벽 x1) 박공 벽 범위."""
    W = RGB['wood']; P = RGB['plaster']; E = RGB['earth']; S = RGB['thatch8']
    half = (x1 - x0) / 2.0
    rise = int(max(8, min(22, half * 0.52)))
    mid2 = (x0 + x1)
    cxi = (x0 + x1) // 2
    back = (G[3], G[4], G[5], G[6]); front = (G[1], G[2], G[3], G[4])
    ys_top, ys_bot = {}, {}
    def HB(x):
        u = abs(2 * x + 1 - mid2) / (2.0 * half)
        return rise * (u ** 1.7 if kind == 'thatch' else u)
    for x in range(x0, x1):
        hb = HB(x)
        left = (2 * x + 1) < mid2
        ya = 0 if top == 'cont' else int(round(yt + hb))
        yz = cv.h if bottom == 'cont' else int(round(yb + hb))
        ys_top[x], ys_bot[x] = ya, yz
        for y in range(ya, yz):
            if kind == 'tile':
                col = tile_px(x, y, back if left else front)
            else:
                run = (y + int(rnd(x, 3, seed + 2) * 8)) // 5
                j = rnd(x, run, seed + 7)
                base = 4.3 - (0.0 if left else 1.4) + (0.9 if j > 0.8 else (-0.8 if j < 0.2 else (0.3 if j > 0.55 else 0)))
                if x % 2 == 0: base -= 0.3
                if (y // 9) % 2 == 1 and y % 9 == 0: base -= 0.9          # 이엉 한 켜의 경계
                col = S[max(1, min(7, int(round(base))))]
            cv.put(x, y, col)
    # 용마루(세로) — 위 끝이 뒤 끝이면 치미, 아래 끝은 박공 꼭대기에서 끝난다
    ya_r = 0 if top == 'cont' else yt - (0 if top == 'valley' else 1)
    yz_r = cv.h if bottom == 'cont' else yb + 1
    if kind == 'tile':
        for j, col in enumerate((G[6], G[5], G[3], G[2])):
            for y in range(ya_r, yz_r):
                c2 = col
                if y % 8 == 7 and j in (1, 2): c2 = G[4] if j == 1 else G[1]
                cv.put(cxi - 2 + j, y, c2)
    else:
        ridge_idx = (3, 5, 6, 6, 5, 4, 3, 2)                  # 용마름: 마루를 덮은 둥근 짚 롤(가운데 밝고 양옆 어둡다)
        for j, idx in enumerate(ridge_idx):
            for y in range(ya_r, yz_r):
                i2 = idx - 1 if y % 7 == 6 else idx               # 7행마다 한 번 묶은 새끼줄 마디
                cv.put(cxi - 4 + j, y, S[max(1, i2)])
    # 골(위 경계)에 그림자 줄, 뒤 끝은 풍판
    for x in range(x0, x1):
        ya = ys_top[x]
        if top == 'valley' and ya > 0:
            if abs(x - cxi) > 2:
                cv.put(x, ya, G[1] if kind == 'tile' else S[1])
        elif top == 'cap':
            left = (2 * x + 1) < mid2
            cv.put(x, ya, W[5] if left else W[3]); cv.put(x, ya + 1, W[4] if left else W[2])
    if top == 'cap' and kind == 'tile':                    # 치미: 용마루 뒤 끝에 앉은 마감 기와
        for dx, dy, col in ((-2, -1, G[6]), (-1, -1, G[5]), (0, -1, G[5]), (1, -1, G[3]), (-2, -2, G[5]), (-1, -2, G[6]), (0, -2, G[4]),
                            (1, -2, G[2]), (-1, -3, G[6]), (0, -3, G[3])):
            cv.put(cxi + dx, yt + dy, col)
    # 바깥 처마 가장자리: 막새(기와) / 짚 끝
    for k, xe in enumerate((x0, x0 + 1, x1 - 2, x1 - 1)):
        for y in range(ys_top[xe], ys_bot[xe] + 1):
            if y >= cv.h: break
            if kind == 'tile':
                if k in (0, 1): col = G[5] if y % 4 < 2 else G[2]
                else: col = G[3] if y % 4 < 2 else G[1]
                if k in (1, 2): col = G[2] if y % 4 < 2 else G[1]
            else:
                col = S[2] if k in (0, 3) else (S[3] if y % 3 else S[2])
            if ys_top[xe] <= y < ys_bot[xe] or bottom == 'cont': cv.put(xe, y, col)
    if bottom != 'gable':
        return rise
    # 박공 풍판 + 박공 벽
    wx0, wx1 = wall if wall else (x0 + 8, x1 - 8)
    for x in range(x0, x1):
        yz = ys_bot[x]
        left = (2 * x + 1) < mid2
        if kind == 'tile':
            cv.put(x, yz, W[5] if left else W[3]); cv.put(x, yz + 1, W[4] if left else W[2])
        else:                                              # 초가 박공은 두툼한 짚 테두리
            for k in range(4):
                cv.put(x, yz + k, (S[3] if left else S[2]) if k < 3 else S[1])
        y0g = yz + (2 if kind == 'tile' else 4)
        for y in range(y0g, y_e):
            if wx0 <= x < wx1:
                q = rnd(x, y, 41 + seed)
                col = P[4] if q > 0.12 else P[3]
                if y - y0g < 2: col = P[2]                # 처마 그림자
                elif y - y0g < 4: col = P[3]
                if kind == 'thatch' and q < 0.04: col = E[6]
                cv.put(x, y, col)
            else:                                          # 처마 안쪽(서까래 밑)
                cv.put(x, y, W[1] if x % 3 else W[2])
    # 박공 가운데 대공(세로 기둥)과 도리
    if kind == 'tile':
        for y in range(ys_bot[cxi] + 2, y_e):
            cv.put(cxi - 1, y, W[5]); cv.put(cxi, y, W[4]); cv.put(cxi + 1, y, W[2])
        for x in range(wx0, wx1):
            cv.put(x, y_e - 4, W[4]); cv.put(x, y_e - 3, W[2])
    else:
        for y in range(ys_bot[cxi] + 5, y_e - 3):          # 초가 박공: 작은 환기창
            pass
        for x in range(wx0, wx1):
            cv.put(x, y_e - 4, E[3]); cv.put(x, y_e - 3, E[2])
    return rise


# ---------------------------------------------------------------- 몸채 조립(윤곽·그림자 없이 캔버스에 얹는다)
def house_into(cv, x0, y0, st, w, ku, kb, steps=(), roof='hip', ramp='giwa', rows=3, hip=True, chimi=True, wing=None, trim=False, over=0, paint=None):
    """blocks.house 로 조립한 집을 cv 의 (x0, y0) 에 얹는다. 윤곽은 마지막에 한 번만 두른다."""
    L = lib_for(ramp)
    rws = K.house(st, w, ku, kb, rows=rows, steps=steps, chimi=chimi, hip=hip)
    h, wt = len(rws), len(rws[0].split())
    t = Cv(wt * T, h * T)
    paste_rows(t, rws, L, 0, 0)
    if st == 'jc':
        K.thatch_baram(t, rows, over=over)
    elif roof == 'hip':
        K.roof_baram(t, rows, BARAM[ramp], wing=wing or (20 + 2 * min(w, 5)), trim=trim)
    if paint: paint(t)
    shade_part(t, T, (w + 1) * T - 1, rows * T, h * T)
    cv.paste(t, x0, y0)
    return t


def wing_walls(cv, x0, y0, st, ww, ku, kb, ramp='giwa', steps=()):
    """날개의 벽 두 행 + 기단. 날개 벽 x 범위 = x0+T .. x0+(ww+1)T."""
    L = lib_for(ramp)
    pl = ['.'] + [('jc.plinth' if st == 'jc' else 'plinth') + ('s' if i in steps else '') for i in range(ww)] + ['.']
    rws = ['. ' + ' '.join(f'{st}.u.{k}' for k in ku) + ' .', '. ' + ' '.join(f'{st}.b.{k}' for k in kb) + ' .', ' '.join(pl)]
    t = Cv((ww + 2) * T, 3 * T)
    paste_rows(t, rws, L, 0, 0)
    shade_part(t, T, (ww + 1) * T - 1, 0, 3 * T)
    cv.paste(t, x0, y0)


def add_wing(cv, xw, y_join, y_e, st, ww, ku, kb, ramp='giwa', steps=(), end='gable', top='valley', seed=0, kind=None, reach=28):
    """날개 한 채. xw = 날개 벽 시작 x(칸 정렬), y_e = 박공 아래 처마선(벽 위행 시작 y). 반환 = 날개 지붕 오른쪽 끝 x."""
    kind = kind or ('thatch' if st == 'jc' else 'tile')
    G = RAMPS[ramp]
    x0, x1 = xw - 8, xw + ww * T + 8
    rise = int(max(8, min(22, (x1 - x0) / 2.0 * 0.52)))
    yb = y_e - rise - 2
    if y_join is None:
        y_join = min(reach, yb - 14)
    if end == 'gable':
        gable_band(cv, x0, x1, y_join, yb, y_e, G, kind, top, 'gable', wall=(xw, xw + ww * T), seed=seed)
        wing_walls(cv, xw - T, y_e, st, ww, ku, kb, ramp, steps)
    else:
        gable_band(cv, x0, x1, y_join, yb, y_e, G, kind, top, 'cont', seed=seed)
    return x1


# ---------------------------------------------------------------- 부착 소품(굴뚝·댓돌·장독대) — 윤곽 전에 얹는다
def deco_chimney(cv, x, yb, h=44, ramp='giwa', width=9):
    """굴뚝: 황토를 쌓은 몸통 + 기와 모자. 벽 바깥에 서서 처마 위로 솟는다. yb = 땅선(몸통 맨 아래 y)."""
    E = RGB['earth']; G = RAMPS[ramp]
    ytop = yb - h
    shadow_ell(cv, x + width // 2 + 4, yb + 1, width * 0.8 + 3, 1.8, 70)
    box(cv, x, ytop + 9, width, 3, yb - ytop - 9, E, (6, 5), (5, 4, 3, 2))
    for y in range(ytop + 17, yb - 2, 5):                          # 흙 쌓은 켜
        for xx in range(x, x + width): cv.put(xx, y, E[2])
    box(cv, x - 1, ytop + 3, width + 2, 3, 6, G, (6, 5), (5, 4, 3, 2))             # 기와 모자
    box(cv, x + 2, ytop - 2, width - 4, 2, 3, G, (6, 5), (5, 4, 3, 2))


def deco_daetdol(cv, xc, y, w=18):
    """댓돌: 문 앞에 놓은 넓적한 돌 두 장 + 벗어 둔 짚신 한 켤레."""
    S = RGB['stone']; St = RGB['straw']; Wd = RGB['wood']
    box(cv, xc - w // 2, y + 3, w, 3, 2, S, (6, 5), (5, 4, 3, 1))
    box(cv, xc - w // 2 - 3, y + 7, w + 6, 3, 2, S, (6, 5), (5, 4, 3, 1))
    for dx in (-5, 2):
        for k in range(4): cv.put(xc + dx + k, y + 2, St[4 if k % 2 else 3])
        cv.put(xc + dx, y + 3, St[2]); cv.put(xc + dx + 3, y + 3, St[2])


def deco_jangdok(cv, x, y, n=3):
    """장독대: 막돌 낮은 단 + 항아리 n 개(크기·뚜껑 다름)."""
    S = RGB['stone']
    shadow_ell(cv, x + 14, y + 1, 15, 2.0, 70)
    box(cv, x, y, 27, 4, 3, S, (5, 4), (4, 3, 2, 1))
    for i, (cx, yb, hh, bl) in enumerate(((x + 6, y - 2, 11, 4.6), (x + 14, y - 3, 14, 5.4), (x + 21, y - 2, 9, 4.0), (x + 10, y + 1, 8, 3.6))[:n + 1]):
        jar(cv, cx, yb, hh, bl, lid=(i % 2 == 0))


def deco_stack(cv, x, y):
    """처마 밑 땔나무 단."""
    Wd = RGB['wood']
    for r in range(3):
        for k in range(6 - r):
            xx = x + r * 3 + k * 5
            ell(cv, xx + 2, y - r * 4, 2.6, 2.2, lambda a, b, u, v: Wd[5] if (u < 0 and v < 0) else (Wd[3] if u < 0.4 else Wd[2]))


# ---------------------------------------------------------------- 몸채 칸 구성
def bay_kinds(w, covered=(), door=None):
    """몸채 w칸의 위행·아래행 kind 문자열. covered = 날개에 가려지는 칸(회벽으로 비운다), 문은 door 칸(없으면 가운데 가림 제외)."""
    free = [i for i in range(w) if i not in covered and i not in (0, w - 1)]
    if door is None:
        door = free[len(free) // 2] if free else None
    ku, kb = [], []
    for i in range(w):
        if i == 0: ku.append('l'); kb.append('l')
        elif i == w - 1: ku.append('r'); kb.append('r')
        elif i in covered: ku.append('p'); kb.append('p')
        elif i == door: ku.append('d'); kb.append('d')
        else: ku.append('w'); kb.append('f')
    return ''.join(ku), ''.join(kb)


def wing_kinds(ww, door='d'):
    """날개 앞벽 칸 종류: 가운데 칸에 문(door), 나머지는 창, 오른쪽 끝은 기둥 칸."""
    mid = (ww - 1) // 2
    ku = ''.join(door if i == mid else 'w' for i in range(ww - 1)) + 'r'
    kb = ''.join(('d' if door == 'd' else 'g') if i == mid else 'f' for i in range(ww - 1)) + 'r'
    return ku, kb


def _body(cv, st, w, ramp, covered, roof, trim=False, door=None, over=0):
    ku, kb = bay_kinds(w, covered, door)
    if st == 'jc':
        house_into(cv, 0, 0, 'jc', w, ku, kb, (door if door is not None else w // 2,), ramp='giwa', chimi=False, hip=True, over=over)
    elif roof == 'hip':
        house_into(cv, 0, 0, 'jo', w, ku, kb, ((door if door is not None else w // 2),), ramp=ramp, chimi=True, hip=True, trim=trim)
    else:                                              # 맞배: 블록 지붕 그대로(풍판 끝)
        house_into(cv, 0, 0, 'jo', w, ku, kb, ((door if door is not None else w // 2),), roof='gable', ramp=ramp, chimi=True, hip=False)


# ---------------------------------------------------------------- 1. ㄱ자·ㄷ자 몸채
def finish_piece(core, deco=(), gl=None, door_x=None, yard_x=None, ramp='giwa', chimney_h=36, outline_it=True, chimney_x=None):
    """코어(윤곽 전)에 부착 소품을 붙이고 윤곽을 한 번 두른다.
    chimney: 오른쪽 벽 뒤에 서는 굴뚝(캔버스 오른쪽 한 칸 확장) · daetdol: 문 앞 댓돌 · jangdok: 마당 쪽 장독대 · stack: 땔나무.
    gl = 몸채 기단 맨 아래 y, door_x = 문 가운데 x, yard_x = 마당(앞 빈 땅) 왼쪽 끝 x."""
    deco = set(deco)
    gl = gl if gl is not None else core.h - 2
    pad_b = 16 if deco & {'daetdol', 'jangdok', 'stack'} else 0
    cv = Cv(core.w, core.h + pad_b)
    if 'chimney' in deco:
        deco_chimney(cv, chimney_x if chimney_x is not None else core.w - 15, gl - 1, chimney_h, ramp, 12)
    paste_front(cv, core, 0, 0)
    yx = yard_x if yard_x is not None else T + 6
    if 'daetdol' in deco:
        deco_daetdol(cv, door_x if door_x is not None else yx + 22, gl - 3)
    if 'jangdok' in deco:
        deco_jangdok(cv, yx, gl + 12)
    if 'stack' in deco:
        deco_stack(cv, yx + 30, gl + 9)
    if outline_it: outline(cv)
    return cv


def l_house(w=6, d=2, ww=2, side='l', ramp='giwa', kind='giwa', roof='hip', deco=(), trim=False):
    """ㄱ자 몸채: 몸채 w칸(앞면 남향) + 한쪽 끝에서 d칸(깊이 d*16px) 앞으로 꺾여 나온 날개 ww칸.
    날개 맞배 지붕이 몸채 앞사면 한가운데에서 시작해 앞(아래)으로 뻗고, 날개 박공 벽이 앞에 선다.
    kind: 'giwa' | 'thatch'.  roof: 몸채 지붕 'hip'(팔작) | 'gable'(맞배, 기와만).  deco: ('chimney','daetdol','jangdok','stack') 중."""
    st = 'jc' if kind == 'thatch' else 'jo'
    covered = range(0, ww + 1) if side == 'l' else range(w - ww - 1, w)
    cv = Cv((w + 2) * T, (6 + d) * T)
    door = (w + ww) // 2 if side == 'l' else (w - ww) // 2
    _body(cv, st, w, ramp, set(covered), roof, trim=trim, door=door, over=(8 if w >= 6 else 0))
    xw = T if side == 'l' else (w + 1 - ww) * T
    ku, kb = wing_kinds(ww)
    add_wing(cv, xw, None, (3 + d) * T, st, ww, ku, kb, 'giwa' if st == 'jc' else ramp, steps=(ww // 2,), end='gable', seed=3 + w)
    if side == 'l':
        cast_right(cv, xw + ww * T + 8, 3 * T, (3 + d) * T, 8)
    ground_shadow(cv, T, (w + 1) * T - 1, 6 * T - 1, drop=3, lean=5, tall=18)
    ground_shadow(cv, xw, xw + ww * T - 1, (6 + d) * T - 1, tall=14)
    yx = (xw + ww * T + 10) if side == 'l' else T + 6
    return finish_piece(cv, deco, 6 * T - 2, (door + 1) * T + 8 + T // 2, yx, ramp if st == 'jo' else 'brown', 36)


def u_house(w=7, dl=2, dr=3, wl=2, wr=2, ramp='giwa', kind='giwa', roof='hip', deco=(), trim=False, door_r='g'):
    """ㄷ자 몸채: 몸채 w칸 + 양 끝에서 앞으로 나온 두 날개(길이 dl·dr 가 달라 좌우 비대칭이 가능)."""
    st = 'jc' if kind == 'thatch' else 'jo'
    covered = set(range(0, wl + 1)) | set(range(w - wr - 1, w))
    d = max(dl, dr)
    cv = Cv((w + 2) * T, (6 + d) * T)
    door = (wl + 1 + w - wr - 2) // 2
    _body(cv, st, w, ramp, covered, roof, trim=trim, door=door, over=(8 if w >= 6 else 0))
    rp = 'giwa' if st == 'jc' else ramp
    xl, xr = T, (w + 1 - wr) * T
    add_wing(cv, xl, None, (3 + dl) * T, st, wl, *wing_kinds(wl), rp, end='gable', seed=1)
    add_wing(cv, xr, None, (3 + dr) * T, st, wr, *wing_kinds(wr, door=door_r), rp, end='gable', seed=5)
    cast_right(cv, xl + wl * T + 8, 3 * T, (3 + dl) * T, 7)
    ground_shadow(cv, xl, xl + wl * T - 1, (6 + dl) * T - 1, tall=14)
    ground_shadow(cv, xr, xr + wr * T - 1, (6 + dr) * T - 1, tall=14)
    ground_shadow(cv, T, (w + 1) * T - 1, 6 * T - 1, drop=3, lean=5, tall=0)
    return finish_piece(cv, deco, 6 * T - 2, (door + 1) * T + 8 + T // 2, xl + wl * T + 12, ramp if st == 'jo' else 'brown', 36)


# ---------------------------------------------------------------- 3. 상점 4종 (국내성 시설)
def clip_paste(cv, layer, keep_cols=True):
    """layer 의 불투명 화소를 cv 에 얹는다. 각 칸 왼쪽 기둥 3px 은 앞에 남긴다(상품은 기둥 뒤에 있다)."""
    for y in range(layer.h):
        for x in range(layer.w):
            if layer.a[y, x, 3] == 0: continue
            if keep_cols and x % T < 3 and cv.a[y, x, 3] == 255: continue
            cv.a[y, x] = layer.a[y, x]


def storefront(cv, b0, b1, top_y=54, floor_y=72):
    """열린 가게 앞: 어두운 안쪽 판자벽 + 마룻바닥(앞 가장자리 밝은 선). b0..b1 = 열린 칸 번호(칸 번호 i 는 캔버스 칸 i+1)."""
    W = RGB['wood']
    x0, x1 = (b0 + 1) * T, (b1 + 2) * T
    for y in range(top_y, floor_y + 4):
        for x in range(x0, x1):
            if x % T < 3: continue
            if y < top_y + 3: col = W[1]
            elif y < floor_y: col = W[2] if (x % 7 == 0 and y > top_y + 5) else W[1]
            else: col = [W[5], W[4] if (x // 4) % 2 else W[3], W[3], W[2]][y - floor_y]
            cv.put(x, y, col)
    return x0, x1


def counter(g, x0, x1, ytop, h=8, ramp='wood'):
    """판매대: 윗면(밝음) + 앞면(왼쪽 밝음 → 오른쪽 어두움)."""
    r = RGB[ramp]
    box(g, x0, ytop + 3, x1 - x0, 3, h, r, (6, 5), (5, 4, 3, 2))


def stump(g, cx, yc, rx=5, h=7):
    cyl(g, cx, yc, rx, h, RGB['wood'], (6, 5), (5, 4, 3, 2))
    g.put(cx - 1, yc, RGB['wood'][3]); g.put(cx, yc, RGB['wood'][3]); g.put(cx + 1, yc - 1, RGB['wood'][3])


def anvil_obj(g, cx, yb):
    """모루: 윗면 + 뾰족한 뿔 + 잘록한 허리 + 받침. yb = 받침 맨 아래 y."""
    S = RGB['giwa']
    for y in range(yb - 8, yb - 5):
        for x in range(cx - 5, cx + 5): g.put(x, y, S[6] if y == yb - 8 else (S[5] if x < cx + 1 else S[4]))
    for k, x in enumerate((cx - 6, cx - 7, cx - 8)): g.put(x, yb - 8 + k // 2, S[5]); g.put(x, yb - 7 + k // 2, S[3])
    for y in range(yb - 5, yb - 2):
        for x in range(cx - 3, cx + 3): g.put(x, y, S[4] if x < cx else S[3])
    for y in range(yb - 2, yb):
        for x in range(cx - 5, cx + 5): g.put(x, y, S[4] if x < cx else S[2])
    g.hl(cx - 5, cx + 5, yb, S[1])


def hang_meat(g, x, y0, ln, big=False):
    """고기 걸이: 가로대에서 늘어진 끈 + 갈고리 + 붉은 고기 덩이(흰 지방 줄, 뼈 마디)."""
    R = RGB['red']; P = RGB['plaster']; W = RGB['wood']
    for y in range(y0, y0 + 4): g.put(x, y, W[3])
    g.put(x - 1, y0 + 4, W[4]); g.put(x + 1, y0 + 4, W[4])
    rx, ry = (4.2, 6.5) if big else (3.4, 5.0)
    cy = y0 + 5 + ry
    ell(g, x, cy, rx, ry, lambda a, b, u, v: R[5] if (u < -0.15 and v < 0.1) else (R[4] if u < 0.45 else R[3]))
    for k in range(int(ry) - 1): g.put(x - 1 + k // 2 % 2 + 1, int(cy) - int(ry) + 2 + k, P[5] if k % 2 == 0 else P[4])
    g.put(x, int(cy + ry) - 1, P[6]); g.put(x + 1, int(cy + ry) - 1, P[5])


def hang_cloth(g, x, y0, ln, wd, ramp, band=None):
    """걸어 놓은 천: 위 막대에 말아 건 긴 천. 가로 주름 줄(왼쪽 밝음), 아랫단 둘레 접힘."""
    r = RGB[ramp]
    for yy in range(y0, y0 + 2):
        for xx in range(x - 1, x + wd + 1): g.put(xx, yy, RGB['wood'][5 if yy == y0 else 3])
    for yy in range(y0 + 2, y0 + ln):
        for xx in range(x, x + wd):
            f = (xx - x) / max(1, wd - 1)
            t = 5 if f < 0.3 else (4 if f < 0.7 else 3)
            if (xx - x) % 4 == 0 and yy > y0 + 3: t -= 1                 # 세로 주름 골
            if yy >= y0 + ln - 2: t -= 1
            col = r[max(1, t)]
            if band and (yy - y0) % 9 in (4, 5): col = RGB[band][max(1, t)]
            g.put(xx, yy, col)
    for xx in range(x, x + wd, 2): g.put(xx, y0 + ln, r[2])


def armor_stand(g, cx, yb, ramp='giwa', trim='red'):
    """갑옷 걸이: 나무 십자 걸이 위에 찰갑(작은 쇠비늘 가로줄)과 붉은 끈, 윗끝에 투구."""
    S = RGB[ramp]; Wd = RGB['wood']; R = RGB[trim]
    for y in range(yb - 20, yb): g.put(cx, y, Wd[4]); g.put(cx + 1, y, Wd[2])
    for x in range(cx - 8, cx + 9): g.put(x, yb - 17, Wd[4]); g.put(x, yb - 16, Wd[2])
    for y in range(yb - 16, yb - 5):                                    # 몸통 갑옷
        hw = 6 if y < yb - 9 else 5
        for x in range(cx - hw, cx + hw + 1):
            t = 5 if x < cx - 1 else (4 if x < cx + 3 else 3)
            if (y % 3) == 0: t -= 1
            g.put(x, y, S[max(1, t)])
    for y in range(yb - 16, yb - 5): g.put(cx, y, R[4]); g.put(cx + 1, y, R[3])             # 가운데 붉은 끈
    for x in range(cx - 6, cx + 8): g.put(x, yb - 9, R[3])
    ell(g, cx + 1, yb - 21, 4.0, 3.4, lambda a, b, u, v: S[6] if (u < -0.2 and v < 0) else (S[4] if u < 0.4 else S[3]))   # 투구
    g.put(cx + 1, yb - 25, R[5]); g.put(cx + 1, yb - 24, R[4])


def spear_rack(g, x0, yb, n=4):
    """창·칼 걸이: 가로대 둘 사이에 세워 둔 긴 자루(나무)와 쇠 끝."""
    S = RGB['giwa']; Wd = RGB['wood']; R = RGB['red']
    for i in range(n):
        x = x0 + 2 + i * 3
        for y in range(yb - 21 - (i % 2) * 2, yb): g.put(x, y, Wd[4]); g.put(x + 1, y, Wd[2])
        top = yb - 24 - (i % 2) * 2
        g.put(x, top, S[6]); g.put(x, top + 1, S[5]); g.put(x + 1, top + 1, S[3]); g.put(x, top + 2, S[4]); g.put(x, top + 3, R[4])
    for yy in (yb - 14, yb - 5):
        for x in range(x0, x0 + 3 * n + 2): g.put(x, yy, Wd[5]); g.put(x, yy + 1, Wd[2])


def shield_obj(g, cx, cy, r=6):
    Wd = RGB['wood']; R = RGB['red']; S = RGB['giwa']
    ell(g, cx, cy, r, r, lambda a, b, u, v: Wd[5] if u * u + v * v > 0.62 else (R[5] if (u < -0.2 and v < -0.2) else (R[4] if u < 0.4 else R[3])))
    g.put(cx, cy, S[6]); g.put(cx - 1, cy, S[5])


def furnace(g, x, yf, w=22, fire=True):
    """돌 화덕: 윗면 + 앞면 + 아궁이(불꽃). 윗면 위에 두꺼운 연통 후드."""
    S = RGB['stone']; P = RGB['persimmon']; W = RGB['wood']
    box(g, x, yf, w, 4, 14, S, (5, 4), (4, 3, 2, 1))
    ox0, ox1 = x + 4, x + w - 4
    for y in range(yf + 4, yf + 12):
        for xx in range(ox0, ox1):
            cx = (ox0 + ox1) / 2.0
            g.put(xx, y, W[1])
    if fire:
        for y in range(yf + 6, yf + 12):
            for xx in range(ox0 + 1, ox1 - 1):
                dx = abs(xx - (ox0 + ox1 - 1) / 2.0)
                hgt = 5.5 - dx * 0.9 + (1.2 if xx % 3 == 0 else 0)
                if yf + 12 - y <= hgt:
                    t = yf + 12 - y
                    g.put(xx, y, P[6] if t < 2 and dx < 2.5 else (P[5] if t < 3 else (P[4] if t < 4 else P[3])))
        g.hl(ox0, ox1, yf + 12, P[2])
    for xx in range(x + 2, x + w - 2): g.put(xx, yf + 3, S[3] if xx % 2 else S[2])
    box(g, x + 5, yf - 3, w - 10, 3, 5, S, (5, 4), (4, 3, 2, 1))             # 연통 후드


def _open_shop(cv, b0, b1, draw, top_y=54, floor_y=72):
    """열린 칸 칠하기: 안쪽을 비우고 draw(g) 가 그린 상품을 기둥 뒤에 깐다."""
    storefront(cv, b0, b1, top_y, floor_y)
    g = Cv(cv.w, cv.h)
    draw(g)
    clip_paste(cv, g)


def shop(kind='smithy', ramp=None, roof=None, w=None):
    """국내성 소형 기와 상점(7~9칸 × 7칸): 열린 앞면 + 진열 + 그림 간판 + 앞 평상.
    kind: smithy(대장간) | butcher(푸줏간) | cloth(포목상) | armory(갑옷·무기점).  w 로 폭(칸)을 바꿔 다시 조립한다(열린 칸·문·간판 자리는 비율로 따라간다)."""
    spec = {
        'smithy': dict(w=6, ramp='giwa', roof='gable', op=(1, 3), sign=4, door=5),
        'butcher': dict(w=5, ramp='brown', roof='hip', op=(2, 3), sign=1, door=4),
        'cloth': dict(w=6, ramp='teal', roof='hip', op=(1, 2), sign=4, door=3),
        'armory': dict(w=7, ramp='brown', roof='gable', op=(2, 4), sign=1, door=5),
    }[kind]
    w0 = spec['w']
    w = w or w0
    dw = w - w0                                               # 폭을 늘리면 열린 칸을 넓힌다
    op = (spec['op'][0], spec['op'][1] + dw)
    sg, dr = spec['sign'] + dw, spec['door'] + dw
    ramp = ramp or spec['ramp']; roof = roof or spec['roof']
    ku, kb = [], []
    for i in range(w):
        k = 'l' if i == 0 else ('r' if i == w - 1 else 'p')
        ku_ = kb_ = k
        if i == dr: ku_ = kb_ = 'd'
        elif op[0] <= i <= op[1] or i == sg: ku_ = kb_ = ('p' if k not in 'lr' else k)
        ku.append(ku_); kb.append(kb_)
    ku, kb = ''.join(ku), ''.join(kb)
    cv = Cv((w + 2) * T, 7 * T)

    def paint(t):
        _open_shop(t, op[0], op[1], lambda g: GOODS[kind](g, (op[0] + 1) * T, (op[1] + 2) * T))
        sign_board(t, (sg + 1) * T + 2, 56, ICONS[kind], 13, 21)
    house_into(cv, 0, 0, 'jo', w, ku, kb, (dr,), roof=roof, ramp=ramp, chimi=(roof == 'gable'), hip=(roof == 'hip'), paint=paint, wing=24)
    ground_shadow(cv, T, (w + 1) * T - 1, 6 * T - 1, drop=4, lean=7, tall=26)
    sx0, sx1 = (dr + 1) * T - 4, (dr + 2) * T + 4              # 문 앞 디딤돌 자리(평상이 겹치지 않게)
    px = (op[0] + 1) * T + 2                                  # 평상: 열린 칸 앞, 기단 아래
    if px < sx1 and px + 44 > sx0:
        px = T + 2 if T + 2 + 44 <= sx0 else sx1 + 2
    pyeongsang_small(cv, px, 6 * T + 6, 44, PS_GOODS[kind])
    outline(cv)
    return cv


def _goods_smithy(g, x0, x1):
    furnace(g, x0 + 5, 61, 22)
    stump(g, x1 - 13, 67, 5, 7)
    anvil_obj(g, x1 - 13, 66)
    W = RGB['wood']; S = RGB['giwa']
    for y in range(55, 66): g.put(x1 - 3, y, W[4]); g.put(x1 - 2, y, W[2])          # 걸린 망치 자루
    for xx in range(x1 - 6, x1 + 1): g.put(xx, 55, S[4]); g.put(xx, 56, S[3])


def _goods_butcher(g, x0, x1):
    counter(g, x0 + 4, x1 - 4, 63, 10)
    for k, x in enumerate(range(x0 + 10, x1 - 6, 12)):
        hang_meat(g, x, 54, 14, big=(k % 2 == 0))
    P = RGB['plaster']; S = RGB['giwa']; R = RGB['red']
    box(g, x1 - 20, 63, 9, 2, 2, RGB['wood'], (6, 5), (5, 4, 3, 2))           # 도마 위 고깃덩이
    ell(g, x1 - 16, 61, 3.4, 2.0, lambda a, b, u, v: R[5] if u < 0 else R[4])
    for y in range(59, 62): g.put(x1 - 11, y, S[5]); g.put(x1 - 10, y, S[4])  # 칼


def _goods_cloth(g, x0, x1):
    cols = [('blue', 'plaster'), ('red', None), ('plaster', 'red'), ('dgreen', None), ('persimmon', None), ('blue', None)]
    n = (x1 - x0 - 6) // 10
    for i in range(n):
        ramp, band = cols[i % len(cols)]
        hang_cloth(g, x0 + 5 + i * 10, 54, 14 + (i % 3) * 3, 8, ramp, band)
    counter(g, x0 + 4, x1 - 4, 66, 7)
    for i, ramp in enumerate(('red', 'blue', 'plaster')):                    # 판매대 위 접은 천 더미
        box(g, x0 + 7 + i * 12, 64, 9, 2, 3, RGB[ramp], (6, 5), (5, 4, 3, 2))


def _goods_armory(g, x0, x1):
    armor_stand(g, x0 + 11, 71, 'giwa', 'red')
    spear_rack(g, x0 + 24, 72, 4)
    shield_obj(g, x1 - 12, 62, 6)
    S = RGB['giwa']
    for k in range(5): g.put(x1 - 4, 56 + k * 2, S[5]); g.put(x1 - 3, 57 + k * 2, S[3])


GOODS = dict(smithy=_goods_smithy, butcher=_goods_butcher, cloth=_goods_cloth, armory=_goods_armory)
ICONS = dict(smithy=lambda c, x, y: _ic_anvil(c, x, y), butcher=lambda c, x, y: _ic_meat(c, x, y),
             cloth=lambda c, x, y: _ic_cloth(c, x, y), armory=lambda c, x, y: _ic_swords(c, x, y))


def _ps_smithy(cv, x, y, w):
    S = RGB['giwa']
    for i, (dx, dy) in enumerate(((4, 0), (10, -1), (16, 0))):                # 쇠토막 세 개
        box(cv, x + dx, y + dy, 7, 2, 3, S, (6, 5), (5, 4, 3, 2))


def _ps_butcher(cv, x, y, w):
    Wd = RGB['wood']; R = RGB['red']; P = RGB['plaster']
    box(cv, x + 6, y, 18, 3, 3, Wd, (6, 5), (5, 4, 3, 2))                       # 고기 담은 널 바구니
    for k in range(3): ell(cv, x + 10 + k * 5, y - 3, 2.6, 1.8, lambda a, b, u, v: R[5] if u < 0 else R[4])
    box(cv, x + 28, y, 9, 3, 3, P, (6, 5), (5, 4, 3, 2))


def _ps_cloth(cv, x, y, w):
    for i, ramp in enumerate(('blue', 'red', 'plaster', 'dgreen')):
        box(cv, x + 4 + i * 9, y - (i % 2), 8, 2, 4 - (i % 2), RGB[ramp], (6, 5), (5, 4, 3, 2))


def _ps_armory(cv, x, y, w):
    S = RGB['giwa']; R = RGB['red']
    for i in range(3):
        ell(cv, x + 8 + i * 11, y - 3, 4.2, 3.2, lambda a, b, u, v: S[6] if (u < -0.2 and v < 0) else (S[4] if u < 0.4 else S[3]))   # 투구 셋
        cv.put(x + 8 + i * 11, y - 6, R[4])


PS_GOODS = dict(smithy=_ps_smithy, butcher=_ps_butcher, cloth=_ps_cloth, armory=_ps_armory)


def pyeongsang_small(cv, x, yf, w=44, goods=None):
    """가게 앞 평상: 널마루 윗면 + 앞 귀틀 + 짧은 다리. goods(cv, x, yf, w) 가 윗면 위에 상품을 올린다."""
    W = RGB['wood']
    shadow_ell(cv, x + w // 2 + 4, yf + 8, w * 0.55, 1.9, 70)
    for lx in (x + 3, x + w - 6):
        for y in range(yf + 3, yf + 8): cv.put(lx, y, W[4]); cv.put(lx + 1, y, W[3]); cv.put(lx + 2, y, W[2])
    for y in range(yf - 7, yf):
        for xx in range(x, x + w):
            tone = 6 if (y == yf - 1 or xx == x) else (5 if (y % 4) else 4)
            cv.put(xx, y, W[tone])
    for xx in range(x, x + w):
        f = (xx - x) / max(1, w - 1)
        t = 4 if f < 0.3 else (3 if f < 0.7 else 2)
        cv.put(xx, yf, W[t]); cv.put(xx, yf + 1, W[t]); cv.put(xx, yf + 2, W[max(1, t - 1)])
    if goods: goods(cv, x, yf - 2, w)


def sign_board(cv, x, y, icon, w=13, h=22):
    """벽에 걸린 세로 간판(글자 대신 그림 상징): 나무 테두리 + 회벽색 바탕 + icon(cv, cx, cy). 윗가로대에서 끈 둘로 매단다."""
    W = RGB['wood']; P = RGB['plaster']
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            edge = yy in (y, y + h - 1) or xx in (x, x + w - 1)
            if edge: col = W[5] if (yy == y or xx == x) else W[2]
            else: col = P[4] if (xx + yy) % 7 else P[3]
            cv.put(xx, yy, col)
    for xx in range(x - 1, x + w + 1): cv.put(xx, y - 2, W[4]); cv.put(xx, y - 1, W[2])
    for xx in (x + 2, x + w - 3):
        cv.put(xx, y - 1, RGB['straw'][3]); cv.put(xx + 1, y - 1, RGB['straw'][2])
    icon(cv, x + w // 2, y + h // 2)


def _ic_anvil(cv, cx, cy):
    S = RGB['giwa']; W = RGB['wood']
    for y in range(cy - 2, cy + 2):
        for x in range(cx - 5, cx + 5): cv.put(x, y, S[6] if y == cy - 2 else (S[5] if x < cx else S[4]))
    for k, x in enumerate((cx - 6, cx - 7, cx - 8)): cv.put(x, cy - 2 + k // 2, S[5]); cv.put(x, cy - 1 + k // 2, S[3])
    for y in range(cy + 2, cy + 5):
        for x in range(cx - 3, cx + 3): cv.put(x, y, S[3] if x < cx else S[2])
    for x in range(cx - 5, cx + 5): cv.put(x, cy + 5, S[2]); cv.put(x, cy + 6, S[1])
    for k in range(8):                                      # 모루 위에 걸친 망치(자루 2px)
        cv.put(cx + 4 - k // 2, cy - 9 + k, W[4]); cv.put(cx + 5 - k // 2, cy - 9 + k, W[3])
    for y in range(cy - 10, cy - 7):
        for x in range(cx - 1, cx + 7): cv.put(x, y, S[5] if y == cy - 10 else S[3])


def _ic_meat(cv, cx, cy):
    R = RGB['red']; P = RGB['plaster']
    ell(cv, cx, cy, 5.5, 6.5, lambda a, b, u, v: R[5] if (u < -0.2 and v < 0) else (R[4] if u < 0.35 else R[3]))
    for (dx, dy) in ((-2, -3), (-1, -2), (0, -1), (1, 0), (2, 1)): cv.put(cx + dx, cy + dy, P[5]); cv.put(cx + dx + 1, cy + dy, P[4])
    for dx, dy in ((4, 5), (5, 5), (5, 6), (4, 6), (6, 6), (6, 7)): cv.put(cx + dx, cy + dy, P[6])      # 뼈 마디


def _ic_cloth(cv, cx, cy):
    B = RGB['blue']; R = RGB['red']; W = RGB['wood']
    for y in range(cy - 6, cy + 6):                         # 말아 놓은 천 두루마리 둘(왼쪽 청, 오른쪽 홍)
        for x in range(cx - 6, cx + 6):
            blue = x < cx
            r = B if blue else R
            col = r[5] if (x - cx) % 4 in (0, 1) else r[4]
            if y < cy - 4: col = r[6] if blue else r[5]
            if y > cy + 3: col = r[2]
            cv.put(x, y, col)
    for x in range(cx - 6, cx + 6): cv.put(x, cy - 7, W[5]); cv.put(x, cy + 6, W[3])


def _ic_swords(cv, cx, cy):
    S = RGB['giwa']; W = RGB['wood']; R = RGB['red']
    for k in range(-8, 8):                                   # 칼 두 자루 교차(2px 굵기)
        for sgn, col in ((1, S[6]), (-1, S[5])):
            x = cx + sgn * (k // 2)
            cv.put(x, cy + k, col); cv.put(x + 1, cy + k, S[3])
    for sgn in (1, -1):
        cv.put(cx - sgn * 4, cy - 9, W[4]); cv.put(cx - sgn * 4 + 1, cy - 9, W[3])
        cv.put(cx - sgn * 4, cy - 8, W[4])
    for x in range(cx - 4, cx + 5): cv.put(x, cy + 7, R[4]); cv.put(x, cy + 8, R[2])


# ---------------------------------------------------------------- 2. 주막·객주 ㅁ자 마당집 키트
# 마당(흙 yard 지형)을 가운데 두고: 뒤(북) = 안채(가로) + 양끝 꺾임(모서리), 양옆 = 세로 행랑, 앞(남) = 대문채·가로 행랑.
# 모든 조각은 칸 정렬이라 이어 붙이면 이음이 없다. 세로 행랑은 아래로 이어지다가 앞 행랑 지붕 뒤로 가려진다.
def hall_into(cv, x0, y0, n, ends='', ramp='giwa', ku=None, kb=None, steps=(), chimi=True, rows=3):
    """긴 가로 행랑 n칸을 cv 의 (x0, y0) 에 얹는다. ends: 'l'/'r'(맞배 풍판 끝 + 한 칸 처마). 끝이 아니면 이웃 조각과 이음 없이 이어진다."""
    L = lib_for(ramp)
    pl = 1 if 'l' in ends else 0
    pr = 1 if 'r' in ends else 0
    W = n + pl + pr
    rr = []
    for nm in ('ridge', 'front', 'eave'):
        rr.append([f'jo.roof.{nm}.' + ('l' if (i == 0 and pl) else ('r' if (i == W - 1 and pr) else 'm')) for i in range(W)])
    if chimi:
        if pl: rr[0][1] = 'jo.roof.ridge.cl'
        if pr: rr[0][W - 2] = 'jo.roof.ridge.cr'
    ku = ku or ''.join('w' if i % 2 else 'g' for i in range(n))
    kb = kb or ''.join('f' if i % 2 else 'g' for i in range(n))
    pad_l, pad_r = ['.'] * pl, ['.'] * pr
    plr = ['plinths' if i in steps else 'plinth' for i in range(n)]
    rows_ = [' '.join(r) for r in rr] + [' '.join(pad_l + [f'jo.u.{k}' for k in ku] + pad_r), ' '.join(pad_l + [f'jo.b.{k}' for k in kb] + pad_r),
                                       ' '.join(pad_l + plr + pad_r)]
    paste_rows(cv, rows_, L, x0, y0)
    if pr:
        shade_part(cv, x0 + (pl + n - 1) * T, x0 + (pl + n) * T - 1, y0 + 3 * T, y0 + 6 * T, 0.2)
    return W


def haengnang_h(n=4, ends='', ramp='brown', pattern='room', steps=()):
    """가로 행랑 조각. pattern: room(방문·창 번갈아) | store(널문 광) | window(살창 연속)."""
    ku = {'room': ''.join('d' if i % 2 == 0 else 'w' for i in range(n)), 'store': 'g' * n, 'window': 'w' * n, 'back': ''.join('w' if i % 3 == 1 else 'p' for i in range(n))}[pattern]
    kb = {'room': ''.join('d' if i % 2 == 0 else 'f' for i in range(n)), 'store': 'g' * n, 'window': 'f' * n, 'back': 'p' * n}[pattern]
    pl = 1 if 'l' in ends else 0; pr = 1 if 'r' in ends else 0
    cv = Cv((n + pl + pr) * T, 6 * T)
    hall_into(cv, 0, 0, n, ends, ramp, ku, kb, steps)
    outline(cv)
    return cv


def daecheong_paint(cv, x0, x1, top_y, floor_y):
    """대청(앞이 트인 마루칸): 밝은 마루판 + 뒤에 한지 장지문 두 짝씩. x0..x1 = 칸 경계 두 개 사이."""
    W = RGB['wood']; P = RGB['plaster']
    for y in range(top_y, floor_y + 4):
        for x in range(x0, x1):
            if x % T < 3: continue
            if y < top_y + 2: col = W[1]
            elif y < floor_y - 1:
                col = P[4] if (x + y) % 5 else P[3]
                if y < top_y + 5: col = P[2]
                if (x - x0) % 8 in (0, 1) or y in (top_y + 2, top_y + 3): col = W[3]            # 장지문 살
                if y == (top_y + floor_y) // 2 and (x - x0) % 8 > 1: col = W[4]
            else:
                col = [W[6], W[5], W[4], W[3], W[2]][min(4, y - floor_y + 1)] if y >= floor_y - 1 else W[4]
            cv.put(x, y, col)


def anchae(n=4, ends='', ramp='brown', lead=1):
    """안채(뒤 큰 건물) 가로 조각: 가운데 칸을 대청마루로 열고 양옆은 방문·창. 마당 쪽(남) 정면."""
    pl = 1 if 'l' in ends else 0
    ku = ''.join('w' if i in (0, n - 1) else 'd' for i in range(n)); kb = ''.join('f' if i in (0, n - 1) else 'd' for i in range(n))
    cv = Cv((n + pl + (1 if 'r' in ends else 0)) * T, 6 * T)
    hall_into(cv, 0, 0, n, ends, ramp, ku, kb, steps=(n // 2,))
    c0 = n // 2 - 1 if n % 2 == 0 else n // 2
    cnt = 2 if n % 2 == 0 else 1
    daecheong_paint(cv, (pl + c0) * T, (pl + c0 + cnt) * T, 54, 72)
    outline(cv)
    return cv


def daemun_hall(n=6, ends='lr', ramp='brown'):
    """대문채: 가로 행랑 가운데 두 칸이 열린 대문 통로(안마당이 비침) + 양옆 행랑방. 문턱 앞 흙 한 줄."""
    import village_gates as VG
    pl = 1 if 'l' in ends else 0; pr = 1 if 'r' in ends else 0
    ku = ''.join('g' if i % 2 == 0 else 'w' for i in range(n)); kb = ''.join('g' if i % 2 == 0 else 'f' for i in range(n))
    c0 = n // 2 - 1
    cv = Cv((n + pl + pr) * T, 6 * T)
    hall_into(cv, 0, 0, n, ends, ramp, ku, kb, steps=(c0, c0 + 1))
    cx = (pl + c0 + 1) * T
    VG.open_passage(cv, cx - 14, cx + 14, 52, 75, 95)
    shade_part(cv, (pl + n - 1) * T, (pl + n) * T - 1, 3 * T, 6 * T, 0.2) if False else None
    outline(cv)
    return cv


def corner(side='l', k=2, ww=2, d=3, ramp='brown'):
    """뒤 모서리(ㄱ): 가로 행랑 k칸 + 한쪽 끝에서 아래로 꺾여 내려가는 세로 행랑 지붕(ww칸 폭). 날개는 아래로 이어진다(세로 행랑 조각이 받는다)."""
    n = ww + k
    G = RAMPS[ramp]
    ends = 'l' if side == 'l' else 'r'
    H = max(6, 3 + d) * T
    cv = Cv((n + 1) * T, H)
    covered = set(range(0, ww)) if side == 'l' else set(range(n - ww, n))
    ku = ''.join('p' if i in covered else ('w' if i % 2 else 'd') for i in range(n))
    kb = ''.join('p' if i in covered else ('f' if i % 2 else 'd') for i in range(n))
    hall_into(cv, 0, 0, n, ends, ramp, ku, kb, steps=(), chimi=True)
    xw = T if side == 'l' else (n - ww) * T
    x0, x1 = xw - 8, xw + ww * T + 8
    half = (x1 - x0) / 2.0
    rise = int(max(8, min(22, half * 0.52)))
    gable_band(cv, x0, x1, 28, 28 + 60, H, G, 'tile', 'valley', 'cont')
    if side == 'l':
        cast_right(cv, x1, 3 * T, 6 * T, 8)
    outline(cv)
    return cv


def haengnang_v(length=3, ww=2, ramp='brown', top='cont', bottom='cont', door='d'):
    """세로 행랑 조각(깊이 방향으로 달리는 맞배 지붕 띠). top: cont(위 조각에서 이어짐)|valley|cap, bottom: cont(앞 행랑에 가려짐)|gable(박공+앞벽).
    폭 (ww+2)칸, 높이 length칸(+bottom=gable 이면 벽 3칸)."""
    G = RAMPS[ramp]
    gable = bottom == 'gable'
    H = (length + (3 if gable else 0)) * T
    cv = Cv((ww + 2) * T, H)
    x0, x1 = 8, (ww + 1) * T + 8
    rise = int(max(8, min(22, (x1 - x0) / 2.0 * 0.52)))
    y_e = length * T
    yb = y_e - rise - 2
    if gable:
        ku, kb = wing_kinds(ww, door)
        gable_band(cv, x0, x1, 12, yb, y_e, G, 'tile', top, 'gable', wall=(T, (ww + 1) * T))
        wing_walls(cv, 0, y_e, 'jo', ww, ku, kb, ramp, steps=(ww // 2,))
        ground_shadow(cv, T, (ww + 1) * T - 1, H - 1, tall=14)
    else:
        gable_band(cv, x0, x1, 12, yb, y_e, G, 'tile', top, 'cont')
    outline(cv)
    return cv


def jumak_madang(n_back=4, yard=3, ramp='brown', k=2, ww=2, wall='gn_mudg', props=True, gate='sarip'):
    """주막 ㅁ자 마당집 한 조합(키트 조립 예): 담이 마당을 두르고, 안에 안채·뒤 모서리 둘·세로 행랑 둘·앞 대문채가 칸 정렬로 선다.
    바닥은 yard(흙 마당), 담 밖은 풀. n_back = 안채 칸 수(가운데 마당 폭), yard = 마당 깊이(칸). 반환 Cv. (미리보기용 — 카탈로그 조각 아님)"""
    import ground as GR
    import catalog
    cat = catalog.objects_base()
    n = ww + k
    c_l = corner('l', k, ww, 3, ramp); c_r = corner('r', k, ww, 3, ramp)
    mid = anchae(n_back, '', ramp)
    total = 2 * n + n_back
    fr = daemun_hall(total, 'lr', ramp)
    yf = c_l.h + yard * T                              # 앞 대문채 지붕 윗줄 y(건물 좌표)
    vlen = (yf + T) - c_l.h
    wl = haengnang_v(vlen // T, ww, ramp); wr = haengnang_v(vlen // T, ww, ramp)
    W = c_l.w + mid.w + c_r.w
    B = Cv(W, yf + fr.h)                               # 건물만(투명 바탕)
    B.paste(c_l, 0, 0); B.paste(mid, c_l.w, 0); B.paste(c_r, c_l.w + mid.w, 0)
    B.paste(wl, 0, c_l.h); B.paste(wr, c_l.w + mid.w + (n - ww - 1) * T, c_l.h)
    B.paste(fr, 0, yf)
    cols = W // T + 2
    rows = B.h // T + 3
    cv = Cv(cols * T, rows * T)
    for ty in range(rows):
        for tx in range(cols):
            cv.paste(GR.yard((tx * 3 + ty) % 2), tx * T, ty * T)
    # 뒤쪽 담(건물 뒤), 건물, 앞 담
    ws = wall_set_for(wall)
    for tx in range(1, cols - 1):
        cv.paste(ws[f'{wall}_h{tx % 3}'], tx * T, 0)
    cv.paste(ws[f'{wall}_c_nw'], 0, 0); cv.paste(ws[f'{wall}_c_ne'], (cols - 1) * T, 0)
    for ty in range(1, rows - 1):
        cv.paste(ws[f'{wall}_v'], 0, ty * T); cv.paste(ws[f'{wall}_v1'], (cols - 1) * T, ty * T)
    cv.paste(B, T, T)
    if props:
        yx0 = T + (ww + 1) * T + 12                    # 마당 왼쪽 경계(왼쪽 세로 행랑 처마 끝 + 여유)
        yx1 = T + c_l.w + mid.w + (n - ww - 1) * T + 4  # 마당 오른쪽 경계
        ybot = T + yf - 4                              # 앞 대문채 지붕 윗끝
        free = yx1 - yx0
        items = [('jars', 32), ('well', 32), ('pyeongsang', 48)]
        while items and sum(w_ for _, w_ in items) + 8 * len(items) > free: items.pop()
        gap = (free - sum(w_ for _, w_ in items)) // (len(items) + 1) if items else 0
        x = yx0 + gap
        for nm, w_ in items:
            cv.paste(cat[nm], x, ybot - cat[nm].h)
            x += w_ + gap
    sy = (rows - 1) * T
    gap_c = cols // 2
    for tx in range(1, cols - 1):
        if abs(tx - gap_c) <= 1: continue
        cv.paste(ws[f'{wall}_h{tx % 3}'], tx * T, sy)
    cv.paste(ws[f'{wall}_c_sw'], 0, sy); cv.paste(ws[f'{wall}_c_se'], (cols - 1) * T, sy)
    gw = sarip_gate(3, 'mud') if gate == 'sarip' else samun('mud', ramp, 3)
    cv.paste(gw, (gap_c - 1) * T, sy if gate == 'sarip' else sy - 2 * T)
    return cv


_WS = {}


def wall_set_for(tag):
    if tag not in _WS:
        mat, cap = {'gn_mud': ('mud', 'thatch'), 'gn_mudg': ('mud', 'giwa'), 'gn_stone': ('stone', 'slab')}[tag]
        _WS[tag] = wall_set(mat, cap, tag)
    return _WS[tag]


# ---------------------------------------------------------------- 4. 2층 기와집 (누각형 / 객주형) — 단청 없는 일반 상가
def sacks_and_jars(g, x0, x1, floor_y):
    """객주 광: 곡식 자루 더미 + 옹기 + 짚 꾸러미."""
    P = RGB['plaster']; St = RGB['straw']; Wd = RGB['wood']
    for i, (dx, h, w) in enumerate(((3, 11, 11), (13, 9, 10), (8, 6, 10))):
        yb = floor_y - (0 if i < 2 else 9)
        box(g, x0 + dx, yb, w, 3, h, P, (6, 5), (5, 4, 3, 2))
        g.hl(x0 + dx + 2, x0 + dx + w - 2, yb - h + 3, St[4])
    jar(g, x1 - 16, floor_y, 12, 4.8, lid=True)
    jar(g, x1 - 8, floor_y + 1, 9, 3.8, lid=False)
    for k in range(3): g.put(x1 - 25 + k * 2, floor_y - 9 + k % 2, St[5]); g.put(x1 - 25 + k * 2, floor_y - 8 + k % 2, St[3])


def balcony_rail(cv, x0, x1, y):
    """2층 난간: 위 가로대 + 가는 살 + 아래 가로대(앞으로 튀어나온 마루 귀틀이 기와 처마 밑에 드리운다)."""
    W = RGB['wood']
    for x in range(x0, x1):
        cv.put(x, y, W[6]); cv.put(x, y + 1, W[5]); cv.put(x, y + 2, W[2])
        cv.put(x, y + 9, W[4]); cv.put(x, y + 10, W[3]); cv.put(x, y + 11, W[1])
    for x in range(x0 + 2, x1 - 1, 5):
        for yy in range(y + 3, y + 9): cv.put(x, yy, W[4]); cv.put(x + 1, yy, W[2])


def two_story(kind='nugak', w=5, ramp='giwa', roof='hip', deco=(), sign=True, floors=2):
    """다층 기와집(2~3층). kind: nugak(누각형: 맨 윗층이 사방 트인 마루+난간) | gaekju(객주형: 윗층 방+난간, 아래층 가게 앞 + 광).
    구성(칸 높이): 지붕 3 · [층 벽 2 + 아래 처마(부섭지붕) 2] × (층수-1) · 맨 아래층 벽 2 · 기단 1.  폭 w칸(+양옆 처마 1칸).
    roof: 'hip' 팔작 | 'gable' 맞배 · ramp: giwa 회청 · brown 짙은 갈색 · teal 청록."""
    L = lib_for(ramp)
    W = w + 2
    roofr = K.roof_rows('jo', W, 3)
    if roof == 'gable':
        r0 = roofr[0].split(); r0[1] = 'jo.roof.ridge.cl'; r0[W - 2] = 'jo.roof.ridge.cr'; roofr[0] = ' '.join(r0)
    pad = lambda s_: '. ' + s_ + ' .'
    se = lambda nm: ' '.join(f'jo.roof.{nm}.{"l" if i == 0 else ("r" if i == W - 1 else "m")}' for i in range(W))
    upper_u = 'l' + ''.join('d' if i % 2 else 'w' for i in range(w - 2)) + 'r'
    upper_b = 'l' + ''.join('d' if i % 2 else 'f' for i in range(w - 2)) + 'r'
    if kind == 'nugak':
        low_u = 'l' + ''.join(('g' if i == (w - 2) // 2 else ('w' if i % 2 else 'p')) for i in range(w - 2)) + 'r'
        low_b = 'l' + ''.join(('g' if i == (w - 2) // 2 else ('f' if i % 2 else 'p')) for i in range(w - 2)) + 'r'
    else:
        low_u = low_b = 'l' + ''.join('g' if i == 0 else 'p' for i in range(w - 2)) + 'r'
    rows = list(roofr)
    wall_rows = []                                          # (u 행 번호, 종류, ub 문자열)
    for f in range(floors):
        last = f == floors - 1
        if f:
            rows += [se('body'), se('eave')]
        r_u = len(rows)
        if f == 0 and kind == 'nugak':
            rows += [pad(' '.join('jo.u.p' for _ in range(w))), pad(' '.join('jo.u.p' for _ in range(w)))]
            wall_rows.append((r_u, 'open', None))
        elif last:
            rows += [pad(' '.join(f'jo.u.{k}' for k in low_u)), pad(' '.join(f'jo.b.{k}' for k in low_b))]
            wall_rows.append((r_u, 'low', None))
        else:
            rows += [pad(' '.join(f'jo.u.{k}' for k in upper_u)), pad(' '.join('jo.u.p' for _ in range(w)))]
            wall_rows.append((r_u, 'upper', upper_b))
    steps = {w // 2} if kind == 'nugak' else {w - 2}
    rows.append(' '.join(['.'] + [('plinths' if i in steps else 'plinth') for i in range(w)] + ['.']))
    nrow = len(rows)
    cv = Cv(W * T, nrow * T)
    paste_rows(cv, rows, L, 0, 0)
    for (r_u, typ, ub) in wall_rows:
        if typ == 'upper':
            for i, k in enumerate(ub):
                cv.paste(K.wall_block('jo', 'b', k, base=False), (i + 1) * T, (r_u + 1) * T)
    if roof == 'hip':
        K.roof_baram(cv, 3, BARAM[ramp], wing=22 + min(w, 6))
    for (r_u, typ, ub) in wall_rows:
        y0 = r_u * T
        if typ == 'open':
            open_upper(cv, w, y0, y0 + 2 * T, T)
        elif typ == 'upper':
            balcony_rail(cv, T + 3, (w + 1) * T - 2, y0 + T + 2)
        else:
            if kind == 'gaekju':
                g = Cv(cv.w, cv.h)
                b0, b1 = 2, w - 2
                x0, x1 = (b0 + 1) * T, (b1 + 2) * T
                top_y, fl = y0 + 6, y0 + 2 * T - 8
                for y in range(top_y, y0 + 2 * T - 4):
                    for x in range(x0, x1):
                        if x % T < 3: continue
                        Wd = RGB['wood']
                        cv.put(x, y, Wd[1] if y < top_y + 4 or x % 7 else Wd[2])
                for x in range(x0, x1):
                    if x % T < 3: continue
                    for j, c in enumerate((RGB['wood'][5], RGB['wood'][4], RGB['wood'][3], RGB['wood'][2])): cv.put(x, fl + j, c)
                sacks_and_jars(g, x0, x1, fl - 1)
                clip_paste(cv, g)
                if sign:
                    sign_board(cv, w * T + 2, y0 + 8, ICON_JAR, 13, 21)
        yw = y0
        shade_part(cv, T, (w + 1) * T - 1, yw, yw + (2 * T if typ != 'low' else 3 * T), 0.2)
    gy = nrow * T
    ground_shadow(cv, T, (w + 1) * T - 1, gy - 1, drop=5, lean=6, tall=20)
    low_r = wall_rows[-1][0]
    door_x = ((w // 2) + 1) * T + 9 if kind == 'nugak' else (w - 1) * T + 8 - 3 * T // 2 + T
    return finish_piece(cv, deco, gy - 2, door_x, T + 6, ramp, 44, chimney_x=(T - 9 if kind == 'gaekju' else None))


def ICON_JAR(cv, cx, cy):
    """객주 간판: 항아리 + 짚 꾸러미."""
    Wd = RGB['wood']
    jar(cv, cx, cy + 8, 15, 5.4, lid=True)
    cv.hl(cx - 7, cx + 8, cy + 9, Wd[3])


def open_upper(cv, bays, wall_y0, wall_y1, x0=16):
    """누각 윗층: 벽을 걷어 낸 트인 마루. 단청 없이 나무 기둥(보머리만 짙게) · 안쪽 어둠 · 마루 윗면 · 앞 난간."""
    E, W = RGB['earth'], RGB['wood']
    x1 = x0 + bays * T
    for y in range(wall_y0, wall_y1):
        for x in range(x0, x1):
            t = (y - wall_y0) / float(wall_y1 - wall_y0)
            col = E[0] if t < 0.45 else (E[1] if t < 0.7 else W[2])
            if t >= 0.7:
                col = W[4] if (x // 4) % 2 else W[3]
                if y == wall_y1 - 8: col = W[5]
            cv.a[y, x] = (*col, 255)
    for x in range(x0, x1):
        for y in range(wall_y0, wall_y0 + 4): cv.a[y, x] = (*E[0], 255)
    for i in range(bays + 1):
        cxp = x0 + i * T
        for y in range(wall_y0 - 1, wall_y1 - 7):
            rel = y - (wall_y0 - 1)
            for dx in range(5):
                xx = min(max(cxp - 2 + dx, x0 - 2), x1 + 1)
                tone = W[5] if dx == 1 else (W[4] if dx < 3 else W[2])
                if rel < 7 and rel % 4 < 2: tone = W[3] if dx < 3 else W[1]           # 보머리(창방이 얹히는 자리)
                cv.a[y, xx] = (*tone, 255)
        for dx in range(7):
            xx = cxp - 3 + dx
            for y in range(wall_y1 - 7, wall_y1 - 4): cv.a[y, xx] = (*RGB['stone'][5 if dx < 4 else 3], 255)
    for x in range(x0 + 4, x1 - 3):
        cv.a[wall_y1 - 12, x] = (*W[5], 255); cv.a[wall_y1 - 11, x] = (*W[3], 255)
        if x % 4 == 1:
            for y in range(wall_y1 - 10, wall_y1 - 7): cv.a[y, x] = (*W[4], 255)


# ---------------------------------------------------------------- 5. 초가 변형 (지붕 둥근 정도·이엉 줄무늬·굴뚝·창 위치가 다른 4종)
def _tidx(col, ramp):
    return min(range(len(ramp)), key=lambda i: sum((int(col[c]) - ramp[i][c]) ** 2 for c in range(3)))


def thatch_ropes(cv, x0, x1, y0, y1, mode='h', gap=7, seed=0):
    """이엉 새끼줄: 지붕 위를 가로질러 묶은 줄(어두운 줄 + 위 밝은 줄, 마디마다 조금 튀어나온 매듭). mode h=가로줄, d=사선 그물, v=세로줄."""
    R = RGB['thatch8']
    for y in range(y0, y1):
        for x in range(x0, x1):
            if cv.a[y, x, 3] != 255: continue
            on = False
            if mode == 'h': on = (y - y0) % gap == 0
            elif mode == 'd': on = ((x + y) % (gap + 2) == 0) or ((x - y) % (gap + 2) == 0)
            elif mode == 'v': on = (x - x0) % gap == 0 and y > y0 + 6
            if on:
                i = _tidx(cv.a[y, x, :3], R)
                cv.put(x, y, R[max(0, i - 2)])
                if mode == 'h' and cv.a[y - 1, x, 3] == 255 and (x // 5) % 2 == 0:
                    cv.put(x, y - 1, R[min(7, i + 1)])


def thatch_top(cv, R=3, over=0, hd=None, seed=None, ropes=None, gap=7, dx=0, wfac=1.0):
    """초가 지붕(위 R행을 바꾼다): thatch3d.dome3 방석 세 단. hd(지붕 높이)·wfac(폭 배율)·ropes 로 모양을 바꾼다."""
    import thatch3d
    H = R * T
    cv.a[:H, :, :] = 0
    hd = hd or max(30, min(42, int((cv.w + over) * 0.38)))
    Wd = int((cv.w - 12 + over) * wfac)
    d = thatch3d.dome3(Wd, hd, seed=seed if seed is not None else cv.w)
    x0 = (cv.w - Wd) // 2 + dx
    y0 = 51 - hd
    cv.paste(d, x0, y0)
    if ropes:
        thatch_ropes(cv, x0, x0 + Wd, y0 + int(hd * 0.36), y0 + hd - 3, ropes, gap)
    K.eave_fill(cv, H, thatch=True)
    K.dither_under(cv, H, 6)


def thatch_gable_top(cv, R=3, seed=0, ropes='d', gap=6):
    """맞배 초가 지붕(위 R행을 바꾼다): 용마름이 길게 얹힌 뾰족 지붕. 뒷사면(밝음)·앞사면(어두움)·양끝 박공 짚 테두리·처마 끝이 들쭉날쭉."""
    S = RGB['thatch8']
    H = R * T
    W = cv.w
    cv.a[:H, :, :] = 0
    xa, xb = 3, W - 4
    ridge0, ridge1 = 3, 11                  # 용마름 롤 y 범위
    split = 22                              # 뒷사면/앞사면 경계(마루 선)
    bottom = 49
    for y in range(ridge0, bottom + 1):
        t = (y - ridge0) / float(bottom - ridge0)
        inset = int(round(13 * (1 - t) ** 1.3))
        sag = 0
        for x in range(xa + inset, xb - inset + 1):
            u = (x - W / 2.0) / (W / 2.0)
            run = (y + int(rnd(x, 3, seed + 2) * 9)) // 5
            j = rnd(x, run, seed + 7)
            if y < ridge1:                   # 용마름: 위 밝고 아래 어둡다
                base = (6.3, 6.0, 5.4, 5.0, 4.6, 4.2, 3.8, 3.3)[min(7, y - ridge0)] - 0.5 * u
                if (x // 3 + y) % 5 == 0: base -= 0.7
            elif y < split:                  # 뒷사면(밝음)
                base = 5.2 - 0.5 * u - 0.05 * (y - ridge1)
            else:                            # 앞사면(어두움), 아래로 갈수록 어두워짐
                base = 4.3 - 0.45 * u - 1.6 * (y - split) / float(bottom - split)
            if y >= ridge1:
                base += 0.9 if j > 0.8 else (-0.9 if j < 0.18 else (0.3 if j > 0.55 else 0))
                if x % 2 == 0: base -= 0.3
            if x <= xa + inset + 1 or x >= xb - inset - 1: base -= 1.0       # 박공 짚 테두리
            if y == split and ridge1 <= y: base -= 1.1                         # 마루 그늘선
            ragged = y >= bottom - 1 and rnd(x, y, seed + 11) < 0.4
            if ragged: continue
            cv.put(x, y, S[max(0, min(7, int(round(base))))])
    if ropes:
        thatch_ropes(cv, xa + 8, xb - 8, split + 2, bottom - 2, ropes, gap)
    K.eave_fill(cv, H, thatch=True)
    K.dither_under(cv, H, 6)


def thatch_house(variant='a', deco=()):
    """초가 4종.
    a: 3칸 · 둥글고 높은 방석 지붕 · 가로 새끼줄 · 창 왼쪽, 문 가운데, 굴뚝 오른쪽 뒤
    b: 4칸 · 낮고 넓게 퍼진 지붕 · 사선 새끼줄 그물 · 방 두 개(창 둘)+문, 굴뚝 왼쪽
    c: 5칸 · 맞배(뾰족한 용마름) 지붕 · 박공 테두리 · 툇마루 열린 칸, 굴뚝 오른쪽
    d: 4칸 + 오른쪽에 낮은 헛간이 딸린 형 · 세로 줄 이엉 · 헛간 앞 짚단과 연장."""
    L = lib_for('giwa')
    if variant == 'a':
        w = 3; ku, kb = 'ldr', 'ldr'
        cv = Cv((w + 2) * T, 6 * T)
        house_into(cv, 0, 0, 'jc', w, 'wdr' if False else ku, kb, (1,), chimi=False, hip=True)
        thatch_top(cv, 3, 0, hd=40, seed=11, ropes='h', gap=8)
        shade_part(cv, T, (w + 1) * T - 1, 3 * T, 6 * T)
        deco2 = deco or ('chimney',)
        return _finish_thatch(cv, deco2, w, 'r')
    if variant == 'b':
        w = 4; ku, kb = 'lwwr'[:0] or 'lwdr', 'lfdr'
        ku, kb = 'lwdr', 'lfdr'
        ku = 'wwdr'; kb = 'ffdr'
        ku = 'l' + 'wd' + 'r'; kb = 'l' + 'fd' + 'r'
        cv = Cv((w + 2) * T, 6 * T)
        house_into(cv, 0, 0, 'jc', w, 'lwdr', 'lfdr', (2,), chimi=False, hip=True)
        thatch_top(cv, 3, 8, hd=31, seed=23, ropes='d', gap=7, wfac=1.0)
        for (gx, gy, r) in ((34, 30, 5.0), (52, 28, 4.2), (63, 33, 3.6)):          # 지붕 위에 올린 박
            P = RGB['plaster']
            ell(cv, gx, gy, r, r * 0.8, lambda a, b, u, v: P[6] if (u < -0.2 and v < -0.1) else (P[5] if u < 0.4 else P[3]))
            cv.put(int(gx), int(gy - r * 0.8) - 1, RGB['leaf'][3])
        shade_part(cv, T, (w + 1) * T - 1, 3 * T, 6 * T)
        return _finish_thatch(cv, deco or ('chimney',), w, 'l')
    if variant == 'c':
        w = 5
        cv = Cv((w + 2) * T, 6 * T)
        house_into(cv, 0, 0, 'jc', w, 'lwoor', 'lfoor', (2,), chimi=False, hip=True)
        thatch_gable_top(cv, 3, seed=5, ropes='d', gap=6)
        shade_part(cv, T, (w + 1) * T - 1, 3 * T, 6 * T)
        return _finish_thatch(cv, deco or ('chimney',), w, 'r')
    if variant == 'd':
        w, ws = 4, 2
        cv = Cv((w + ws + 2) * T, 6 * T)
        # 헛간(오른쪽): 낮은 지붕을 먼저 깔고 몸채가 그 위로 겹치게 한다
        import thatch3d
        shed = thatch3d.dome3(ws * T + 20, 27, seed=41)
        sx = (w + 1) * T - 4
        cv.paste(shed, sx, 51 - 27 + 1)
        thatch_ropes(cv, sx, sx + ws * T + 20, 51 - 27 + 12, 48, 'v', 6)
        for i in range(ws):
            for nm, yy in (('jc.u.p', 3), ('jc.b.p', 4), ('jc.plinth', 5)):
                cv.paste(L[nm], (w + 1 + i) * T, yy * T)
        _open_shop(cv, w, w + ws - 1, lambda g: _goods_shed(g, (w + 1) * T, (w + ws + 1) * T), 56, 72)
        shade_part(cv, (w + 1) * T, (w + ws + 1) * T - 1, 3 * T, 6 * T, 0.16)
        house_into(cv, 0, 0, 'jc', w, 'lwdr', 'lfdr', (2,), chimi=False, hip=True, over=0, paint=None)
        # 몸채 지붕을 세로줄 이엉으로 다시 얹는다(윗 R행만; 헛간 지붕은 건드리지 않게 몸채 폭만)
        body = Cv((w + 2) * T, 6 * T)
        house_into(body, 0, 0, 'jc', w, 'lwdr', 'lfdr', (2,), chimi=False, hip=True)
        thatch_top(body, 3, 0, hd=38, seed=31, ropes='v', gap=7)
        shade_part(body, T, (w + 1) * T - 1, 3 * T, 6 * T)
        cv.paste(body, 0, 0)
        ground_shadow(cv, T, (w + ws + 1) * T - 1, 6 * T - 1, drop=5, lean=7, tall=24)
        return _finish_thatch(cv, deco, w + ws, 'l', ws=ws)


def _goods_shed(g, x0, x1):
    """헛간 안: 짚단 더미 + 쟁기·지게 + 안쪽 어둠."""
    St = RGB['straw']; Wd = RGB['wood']
    for y in range(66, 72):
        for x in range(x0 + 3, x1 - 1):
            g.put(x, y, St[4] if (x + y) % 3 else St[3])
    for k, (dx, h) in enumerate(((4, 11), (13, 8), (22, 10))):
        ell(g, x0 + dx + 5, 70 - h // 2, 5.5, h / 2.0 + 1, lambda a, b, u, v: St[6] if (u < -0.2 and v < 0) else (St[5] if u < 0.45 else St[4]))
        g.hl(x0 + dx + 1, x0 + dx + 9, 70 - h // 2, St[2])
    for y in range(58, 72): g.put(x1 - 7, y, Wd[4]); g.put(x1 - 6, y, Wd[2])                 # 기대어 세운 지게
    for x in range(x1 - 12, x1 - 5): g.put(x, 62, Wd[4]); g.put(x, 68, Wd[3])


def _finish_thatch(cv, deco, w, chim_side, ws=0):
    deco = set(deco)
    pad_l = pad_r = 0
    pad_b = 16 if deco & {'daetdol', 'jangdok', 'stack'} else 0
    out = Cv(cv.w + pad_l + pad_r, cv.h + pad_b)
    gl = cv.h - 2
    if 'chimney' in deco:
        if chim_side == 'r':
            deco_chimney(out, (w + 1) * T - 3 + pad_l, gl - 1, 40, 'brown', 12)
        else:
            deco_chimney(out, T - 9, gl - 1, 40, 'brown', 12)
    paste_front(out, cv, pad_l, 0)
    wall_w = w * T
    if 'daetdol' in deco: deco_daetdol(out, pad_l + (w // 2 + 1) * T + 8 if w % 2 else pad_l + (w // 2) * T + T + 0, gl - 3)
    if 'jangdok' in deco: deco_jangdok(out, pad_l + 4, gl + 12)
    if 'stack' in deco: deco_stack(out, pad_l + 40, gl + 9)
    outline(out)
    return out


# ---------------------------------------------------------------- 6. 구획 담 세트 (집 한 채를 두르는 낮은 담, 1칸 높이)
# 가로 H · 세로 V · 모서리 NW NE SW SE · 사립문 · 삼문. 흙담(mud)과 돌담(stone) 두 재료. 16×16, 이어 붙여도 이음이 없다.
# 가로 담: 덮개 윗면 y2~5 + 덮개 앞끝 y6~7 + 앞면 y8~13 + 기단선 y14 + 그림자 y15.
# 세로 담: 덮개 윗면 폭 6px(x4~9) + 어두운 옆면 폭 3px(x10~12) + 오른쪽 땅 그림자. 모서리는 두 띠를 겹쳐 L 로 잇는다.
def _stone_face(c, x0, x1, y0, y1, var):
    S = RGB['stone']
    rows = [(0, 6, 11), (1, 5, 10), (2, 7, 12)][var % 3]
    n = 3
    bounds = [y0 + (y1 - y0) * i // n for i in range(n + 1)]
    cuts = [[(0, 5), (5, 11), (11, 16)], [(0, 7), (7, 12), (12, 16)], [(0, 4), (4, 9), (9, 16)], [(0, 6), (6, 16)]]
    for ri in range(n):
        a, b = bounds[ri], bounds[ri + 1]
        for (bx0, bx1) in cuts[(ri + var) % 4]:
            for yy in range(a, b):
                for xx in range(max(x0, bx0), min(x1, bx1)):
                    edge = xx == bx0 or yy == b - 1
                    if edge: tone = 2
                    elif yy == a: tone = 5 if xx < bx0 + (bx1 - bx0) * 0.7 else 4
                    else: tone = 4 if xx < bx0 + (bx1 - bx0) * 0.55 else 3
                    if xx > 11: tone = max(2, tone - 1)
                    if not edge and rnd(xx, yy, 73 + var) < 0.14: tone = max(2, tone - 1)
                    c.put(xx, yy, S[tone])


def _mud_face(c, x0, x1, y0, y1, var):
    E = RGB['earth']; S = RGB['stone']
    for y in range(y0, y1):
        for x in range(x0, x1):
            tone = 5 if y < y0 + 2 else (4 if y < y0 + 4 else 3)
            q = rnd(x, y, 31 + var)
            if q > 0.92: tone -= 1
            elif q < 0.05: tone = min(6, tone + 1)
            if x > 11: tone = max(1, tone - 1)
            c.put(x, y, E[tone])
    if var % 2:                                              # 박힌 막돌 몇 개와 금
        for (sx, sy) in ((3, y0 + 2), (10, y0 + 3), (7, y0 + 1)):
            if x0 <= sx < x1:
                c.hl(sx, sx + 3, sy, S[4]); c.hl(sx, sx + 3, sy + 1, S[3])
    else:
        for sx in range(x0 + 2 + var, x1, 6):
            for yy in range(y0 + 1, y1 - 1, 2): c.put(sx, yy, RGB['earth'][2])


def _cap_h(c, x0, x1, mat, var, cap):
    """가로 담 덮개(y2~7). mud: 짚 이엉 혹은 기와 · stone: 납작한 덮개돌."""
    S = RGB['straw']; G = RGB['giwa']; St = RGB['stone']
    for y in range(2, 8):
        for x in range(x0, x1):
            k = y - 2
            if cap == 'giwa':
                base = (G[6], G[5], G[5], G[3], G[4], G[2])[k] if (x % 4 in (0, 1)) else (G[5], G[4], G[4], G[2], G[3], G[1])[k]
                if k == 3: base = G[1]
            elif cap == 'thatch':
                base = (S[6], S[5], S[5], S[4], S[3], S[2])[k]
                if (x // 2 + y + var) % 5 == 0: base = S[max(1, S.index(base) - 1)] if base in S else base
            else:                                             # 덮개돌
                base = (St[5], St[5], St[4], St[4], St[3], St[2])[k]
                if x in ((6 + 5 * var) % 16, (13 + 3 * var) % 16) and k < 5: base = St[3]
            c.put(x, y, base)


def wall_h(mat='mud', var=0, cap=None):
    """가로 담 16×16."""
    cap = cap or ('thatch' if mat == 'mud' else 'slab')
    c = Cv(T, T)
    (_mud_face if mat == 'mud' else _stone_face)(c, 0, T, 8, 14, var)
    _cap_h(c, 0, T, mat, var, cap)
    for x in range(T): c.put(x, 14, RGB['earth'][1] if mat == 'mud' else RGB['stone'][1]); c.put(x, 15, SHADOW, 80)
    return c


def _vstrip(c, y0, y1, east, mat, cap, var=0, face=True):
    """세로 담 띠 y0..y1-1: 덮개 윗면(폭 6) + 옆면(폭 3). east=True 면 옆면이 오른쪽(바깥), False 면 왼쪽."""
    S = RGB['straw']; G = RGB['giwa']; St = RGB['stone']; E = RGB['earth']
    cx0 = 4 if not east else 4
    for y in range(y0, y1):
        for lx in range(6):
            x = 4 + lx
            if cap == 'giwa':
                col = (G[6], G[5], G[5], G[4], G[3], G[2])[lx]
                if y % 4 == 3: col = G[2] if lx in (2, 3) else col
            elif cap == 'thatch':
                col = (S[6], S[5], S[5], S[4], S[3], S[2])[lx]
                if (y + lx + var) % 5 == 0: col = S[max(1, S.index(col) - 1)]
            else:
                col = (St[5], St[5], St[4], St[4], St[3], St[2])[lx]
                if y % 7 == 3: col = St[3]
            c.put(x, y, col)
        if face:
            for lx in range(3):
                x = 10 + lx
                if mat == 'mud': col = (E[3], E[2], E[1])[lx] if (y + var) % 6 else E[2]
                else: col = (St[3], St[2], St[1])[lx] if (y + var) % 6 else St[2]
                c.put(x, y, col)


def _sh(c, x, y, al):
    if c.a[y, x, 3] == 0: c.put(x, y, SHADOW, al)


def wall_v(mat='mud', var=0, cap=None):
    cap = cap or ('thatch' if mat == 'mud' else 'slab')
    c = Cv(T, T)
    _vstrip(c, 0, T, True, mat, cap, var)
    for y in range(T): _sh(c, 13, y, 60); _sh(c, 14, y, 36)
    return c


def wall_corner(kind, mat='mud', var=0, cap=None):
    """모서리 16×16. NW/NE = 위쪽 모서리(가로 담이 한쪽으로, 세로 담이 아래로), SW/SE = 아래쪽 모서리(세로 담이 위에서 내려와 가로 담으로 꺾임)."""
    cap = cap or ('thatch' if mat == 'mud' else 'slab')
    c = Cv(T, T)
    west = kind[1] == 'W'
    hx0, hx1 = (4, T) if west else (0, 13)                  # 가로 담이 차지하는 x 범위
    fx0, fx1 = hx0, hx1
    (_mud_face if mat == 'mud' else _stone_face)(c, fx0, fx1, 8, 14, var)
    _cap_h(c, hx0, hx1, mat, var, cap)
    for x in range(hx0, hx1): c.put(x, 14, RGB['earth'][1] if mat == 'mud' else RGB['stone'][1]); c.put(x, 15, SHADOW, 80)
    if kind[0] == 'N':
        _vstrip(c, 7, T, True, mat, cap, var)
        for y in range(8, T): _sh(c, 13, y, 60); _sh(c, 14, y, 36)
    else:
        _vstrip(c, 0, 8, True, mat, cap, var)
        for y in range(0, 8): _sh(c, 13, y, 60); _sh(c, 14, y, 36)
    if west:                                                # 왼쪽 끝 마구리(둥글린 덮개 끝)
        c.a[2, 4, 3] = 0 if kind[0] == 'S' else c.a[2, 4, 3]
    return c


def wall_pier(mat='mud', cap=None):
    """담 끝 기둥(문 옆): 폭 10px 짧은 기둥 머리(덮개) + 앞면. 16×16."""
    cap = cap or ('thatch' if mat == 'mud' else 'slab')
    c = Cv(T, T)
    x0, x1 = 3, 13
    (_mud_face if mat == 'mud' else _stone_face)(c, x0, x1, 7, 14, 1)
    S = RGB['straw']; St = RGB['stone']; G = RGB['giwa']
    for y in range(1, 7):
        for x in range(x0, x1):
            k = y - 1
            if cap == 'giwa': col = (G[6], G[5], G[5], G[3], G[4], G[2])[k]
            elif cap == 'thatch': col = (S[6], S[5], S[5], S[4], S[3], S[2])[k]
            else: col = (St[5], St[5], St[4], St[4], St[3], St[2])[k]
            if x == x0 and k < 4 and cap == 'thatch': continue
            c.put(x, y, col)
    for x in range(x0, x1): c.put(x, 14, RGB['earth'][1] if mat == 'mud' else RGB['stone'][1]); c.put(x, 15, SHADOW, 80)
    return c


def sarip_gate(n=2, mat='mud', open_=True):
    """사립문 n×16: 두 담 기둥 사이가 훤히 열려 있다(문짝은 한쪽 기둥에 붙여 활짝 젖힌 가는 널 한 짝, 문간 바닥은 길/마당 그대로).
    기둥을 가장자리로 밀어 열린 폭 = n×16 - 20px 이상."""
    W = Cv(n * T, T)
    p = wall_pier(mat)
    W.paste(p, -3, 0); W.paste(p.hflip(), n * T - T + 3, 0)
    Wd = RGB['wood']; S = RGB['straw']
    x0 = 10
    for x in range(x0, x0 + 3):                                           # 젖혀진 문짝: 기둥 안쪽에 붙은 얇은 널(모서리가 보인다)
        for y in range(5, 14):
            col = S[5] if x == x0 else (S[4] if x == x0 + 1 else Wd[3])
            if (y - 5) % 4 == 3: col = Wd[3]
            W.put(x, y, col)
    for y in range(5, 14):
        W.put(x0 + 3, y, SHADOW, 60)
    return W


def samun(mat='stone', ramp='giwa', w=4):
    """삼문(작은 기와 담문) w칸×3칸: 양끝 담 기둥 위로 낮은 맞배 기와 지붕이 얹히고(앞사면+막새), 세 짝 판문(가운데 넓고 양옆 좁은)이 닫혀 있다."""
    L = lib_for(ramp)
    Wd = RGB['wood']
    cv = Cv(w * T, 3 * T)
    y0 = 2 * T
    for y in range(y0, 3 * T):                               # 기둥 사이 어두운 안쪽
        for x in range(0, w * T):
            cv.put(x, y, Wd[1])
    for x in range(2, w * T - 2):                            # 창방
        cv.put(x, y0, Wd[2]); cv.put(x, y0 + 1, Wd[5]); cv.put(x, y0 + 2, Wd[3])
    inner = w * T - 20
    wc = max(14, inner * 2 // 5)
    side = (inner - wc) // 2
    xs = [10, 10 + side, 10 + side + wc, 10 + inner]
    for k in range(3):
        a, b = xs[k], xs[k + 1]
        for y in range(y0 + 3, 3 * T - 3):
            for x in range(a, b):
                lx = (x - a) % 4
                col = Wd[5] if lx == 0 else (Wd[4] if lx < 3 else Wd[3])
                if x == a or x == b - 1: col = Wd[2]
                if y in (y0 + 7, 3 * T - 8): col = Wd[2]
                cv.put(x, y, col)
        for y in (y0 + 9,): cv.put(a + 2, y, RGB['straw'][5]); cv.put(b - 3, y, RGB['straw'][5])
    for side_x in (0, w * T - 10):                           # 담 기둥: 담 앞면이 문 양옆을 받친다
        tmp = Cv(T, 3 * T)
        (_mud_face if mat == 'mud' else _stone_face)(tmp, 0, 10, y0 + 2, 3 * T - 3, 1)
        for yy in range(3 * T):
            for xx in range(10):
                if tmp.a[yy, xx, 3]: cv.a[yy, side_x + xx] = tmp.a[yy, xx]
        for x in range(side_x, side_x + 10): cv.put(x, y0 + 1, RGB['stone'][2] if mat != 'mud' else RGB['earth'][2])
    for x in range(8, w * T - 8):                            # 문턱 돌
        cv.put(x, 3 * T - 3, RGB['stone'][4]); cv.put(x, 3 * T - 2, RGB['stone'][3]); cv.put(x, 3 * T - 1, RGB['stone'][2])
    K.roof_baram(cv, 2, BARAM[ramp], wing=12)
    for x in range(w * T):
        if cv.a[3 * T - 1, x, 3] == 0: cv.put(x, 3 * T - 1, SHADOW, 80)
    return cv


def wall_set(mat='mud', cap=None, tag=None):
    """한 재료·덮개의 담 세트 사전: 가로 3종 · 세로 2종 · 모서리 4종. cap: thatch(이엉)|giwa(기와)|slab(덮개돌)."""
    tag = tag or mat
    d = {f'{tag}_h0': wall_h(mat, 0, cap), f'{tag}_h1': wall_h(mat, 1, cap), f'{tag}_h2': wall_h(mat, 2, cap),
         f'{tag}_v': wall_v(mat, 0, cap), f'{tag}_v1': wall_v(mat, 1, cap)}
    for k in ('NW', 'NE', 'SW', 'SE'):
        d[f'{tag}_c_{k.lower()}'] = wall_corner(k, mat, 0, cap)
    return d


# ---------------------------------------------------------------- 카탈로그(조각 사전)
def objects():
    """catalog.objects() 에 덧붙는 조각들. 이름 접두 gn_ = 국내성식."""
    o = {}
    # 1. ㄱ자 / ㄷ자 몸채
    o['gn_l_giwa_6'] = l_house(6, 2, 2, 'l', 'giwa', deco=('chimney', 'daetdol'))
    o['gn_l_brown_5g'] = l_house(5, 2, 2, 'r', 'brown', roof='gable', deco=('jangdok', 'daetdol'))
    o['gn_l_teal_7'] = l_house(7, 3, 3, 'l', 'teal', deco=('stack',))
    o['gn_u_giwa_7'] = u_house(7, 2, 3, 2, 2, 'giwa', roof='gable', deco=('daetdol', 'jangdok'))
    o['gn_u_brown_8g'] = u_house(8, 3, 3, 2, 3, 'brown', roof='gable', deco=('daetdol',))
    o['gn_l_thatch_5'] = l_house(5, 2, 2, 'l', kind='thatch', deco=('chimney', 'daetdol'))
    o['gn_u_thatch_6'] = u_house(6, 2, 2, 2, 2, kind='thatch', deco=('chimney',))
    # 2. 주막 ㅁ자 마당집 키트
    o['gn_jm_corner_l'] = corner('l', 2, 2, 3, 'brown')
    o['gn_jm_corner_r'] = corner('r', 2, 2, 3, 'brown')
    o['gn_jm_anchae_4'] = anchae(4, '', 'brown')
    o['gn_jm_anchae_5'] = anchae(5, '', 'brown')
    o['gn_jm_daemun_6'] = daemun_hall(6, 'lr', 'brown')
    o['gn_jm_row_room_4'] = haengnang_h(4, 'lr', 'brown', 'room')
    o['gn_jm_row_store_5'] = haengnang_h(5, 'lr', 'giwa', 'store', steps=(2,))
    o['gn_jm_row_back_6'] = haengnang_h(6, 'lr', 'brown', 'back')
    o['gn_jm_row_v_3'] = haengnang_v(3, 2, 'brown')
    o['gn_jm_row_v_end'] = haengnang_v(3, 2, 'brown', bottom='gable')
    o['gn_jm_row_v_cap'] = haengnang_v(3, 2, 'giwa', top='cap', bottom='gable', door='g')
    # 3. 상점 4종
    for k in ('smithy', 'butcher', 'cloth', 'armory'):
        o[f'gn_shop_{k}'] = shop(k)
    # 4. 2층(3층) 기와집
    o['gn_g2_nugak_5'] = two_story('nugak', 5, 'giwa', 'hip')
    o['gn_g2_inn_6'] = two_story('gaekju', 6, 'brown', 'gable', deco=('chimney',))
    o['gn_g3_nugak_4t'] = two_story('nugak', 4, 'teal', 'gable', floors=3)
    o['gn_g3_inn_7'] = two_story('gaekju', 7, 'giwa', 'gable', deco=('jangdok',), floors=3)
    # 5. 초가 4종
    for v in 'abcd':
        o[f'gn_thatch_{v}'] = thatch_house(v)
    # 6. 구획 담
    o.update(wall_set('mud', 'thatch', 'gn_mud'))
    o.update(wall_set('mud', 'giwa', 'gn_mudg'))
    o.update(wall_set('stone', 'slab', 'gn_stone'))
    o['gn_sarip_mud'] = sarip_gate(2, 'mud')
    o['gn_sarip_stone'] = sarip_gate(3, 'stone')
    o['gn_samun_stone'] = samun('stone', 'giwa', 4)
    o['gn_samun_mud'] = samun('mud', 'brown', 5)
    return o
