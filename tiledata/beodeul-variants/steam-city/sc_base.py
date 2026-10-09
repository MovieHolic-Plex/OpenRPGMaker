# 증기 도시(steam-city) 공용 바탕 — 장르 규격 `tiledata/beodeul-kits/genres/steampunk.md` 를 따른다.
# 제국 도시(empire-city)의 바탕(ec_base: 미래 폐허 기계 재질 규약 fr_mat 톤 캔버스 TC·판 줄눈·리벳·관·유리 + 회색 석재 gst,
# 검은 지붕 roofk)과 지붕·벽돌(ec_roofs: brk 그을린 벽돌·verd·copr)을 읽기만 해서 불러 쓰고, 이 장소에 처음 나오는 재질만 7단으로 더한다:
#   coal  석탄·석탄 가루(검은 남회, 덩이 윗왼 빛)
#   oil   기름(남보라 검정)
#   cond  증기 고인 물(김 서린 회청 — 빗물보다 탁하고 밝다)
#   soot  그을음 낀 젖은 자갈(버들항 거리 돌 결을 어둡고 차갑게)
# 재질 언어: 그을린 붉은 벽돌(brk, 줄눈 회색 석재) + 검은 무쇠(steel 톤 0~3) + 놋쇠 반짝임(brass, 관 위 1/4 빛줄·리벳·계기 테)
#           + 구리(rust 톤 3~6, 녹청 점은 cyan 톤 2~3) + 호박빛 가스등(amber). 3/4 시점, 빛 왼쪽 위, 1칸 = 16px. 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
EC = os.path.join(VAR, 'empire-city')
sys.path.insert(0, EC)
import numpy as np
from PIL import Image, ImageDraw
from ec_base import *                       # noqa  (TC·panels·pipe_h·pipe_v·box·window·roof_hip·chimney·steam·smoke·hash2·tnoise …)
import fr_mat
from ec_base import _hash, vnoise
import ec_roofs as RF                       # brk·verd·copr·zinc·tar 재질 등록 + brick_face·roof_mansard·roof_corr
from ec_build import iron_door, eave_shadow, stack_body
import ec_ground as EG
import fr_props as FP
HERE = os.path.dirname(os.path.abspath(__file__))     # (* import 가 HERE 를 덮으므로 다시)


def _r(*cs): return [hx(c) for c in cs]
COAL = _r('#050507', '#0c0c10', '#141419', '#1d1d24', '#282830', '#36363f', '#4e4e5a')
OIL  = _r('#040408', '#09090f', '#100f18', '#1a1824', '#262334', '#38334a', '#57506e')
COND = _r('#0c141c', '#18242e', '#263642', '#38505a', '#527078', '#7c989c', '#b8ccc8')
SOOT = _r('#0a0b10', '#14161d', '#1f222a', '#2c3038', '#3c414a', '#535963', '#737a84')
SHEEN = [hx(c) for c in ('#8a7436', '#3a8482', '#76488a')]                       # 기름 막 무지개(탁하게)
NEW = {'coal': COAL, 'oil': OIL, 'cond': COND, 'soot': SOOT}
for n in NEW:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEW.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEW)


def ck(k, lo=1, hi=6): return max(lo, min(hi, int(k)))


# ================================================================ 벽돌 앞면 (8x4 줄쌓기)
def brick_wall(tc, x0, y0, x1, y1, seed=0, soot=0.0, mortar='gst'):
    """그을린 붉은 벽돌 줄쌓기: 벽돌 8x4(줄마다 반 장), 줄눈 1px(회색 석재 톤 2~3), 벽돌 톤 3~4(드문 2·5), 위 모 +1,
    오른 끝 그늘. soot = 위로 갈수록 그을음(톤 −1) 비율. 버들항 벽돌 칸의 결(점 하나 단위 명암)을 따른다."""
    for y in range(int(y0), int(y1)):
        f = (y - y0) / max(1, (y1 - y0))
        for x in range(int(x0), int(x1)):
            X, Y = x - x0, y - y0
            row = Y // 4; ly = Y % 4; off = (row % 2) * 4; lx = (X + off) % 8; col = (X + off) // 8
            if ly == 3 or lx == 7:
                tc.px(x, y, mortar, 3 if ly == 3 and lx != 7 else 2); continue
            h = _hash(col, row, seed + 5)
            k = 4 if h > .45 else 3
            if h < .07: k = 2
            if h > .94: k = 5
            if ly == 0 and lx < 6: k += 1
            if x >= x1 - 2: k -= 1
            if x < x0 + 1: k += 1
            if soot and _hash(col, row, seed + 9) < soot * (1 - f) * 1.4: k -= 1
            tc.px(x, y, 'brk', ck(k))


def brick_plinth(tc, x0, x1, y0, h=6, seed=0):
    """벽 아래 회색 석재 받침(위 모 6 → 아래 1)."""
    for j in range(h):
        for x in range(int(x0), int(x1)):
            k = (6, 4, 4, 3, 2, 1)[min(5, j)]
            if x < x0 + 1: k += 1
            if x >= x1 - 2: k -= 1
            if 0 < j < h - 1 and (x - x0) % 12 == 11: k = 2
            tc.px(x, y0 + j, 'gst', ck(k))


def cornice(tc, x0, x1, y, mat='gst'):
    """처마 돌림띠 3px(위 6 · 4 · 아래 그늘 1) + 아래 1px 그늘."""
    for x in range(int(x0), int(x1)):
        tc.px(x, y, mat, 6 if x > x0 else 5); tc.px(x, y + 1, mat, 4); tc.px(x, y + 2, mat, 2)
        if tc.get(x, y + 3) and tc.get(x, y + 3)[0] == 'brk': tc.shift(x, y + 3, -1)


def arch_window(tc, x0, y0, w=6, h=11, lit=False, seed=0, mat_frame='steel'):
    """반원 아치 창(벽돌 도시): 아치 머리 벽돌 테(톤 5 쐐기) + 검은 무쇠 창틀 + 유리(위 2 · 아래 1, 왼위 반짝) 또는 호박빛 불.
    아래 회색 석재 창턱."""
    r = w / 2.0; cx = x0 + r
    for y in range(y0 - 2, y0 + h + 1):
        for x in range(x0 - 1, x0 + w + 1):
            dy = y - (y0 + r)
            inside_arch = y >= y0 + r or ((x + .5 - cx) ** 2 + (dy + .5) ** 2) <= r * r
            outer = y >= y0 + r or ((x + .5 - cx) ** 2 + (dy + .5) ** 2) <= (r + 1.5) ** 2
            if not outer: continue
            if x0 <= x < x0 + w and y0 <= y < y0 + h and inside_arch:
                if lit: tc.px(x, y, 'amber', 4 if y < y0 + h // 2 else 3)
                else: tc.px(x, y, 'glass', 2 if y < y0 + h * .45 else 1)
            elif y < y0 + r + 1:
                tc.px(x, y, 'brk', 5 if x < cx else 4)                 # 아치 쐐기 벽돌
            else:
                tc.px(x, y, mat_frame, 4 if x < x0 else 1)
    if lit: tc.px(x0 + 1, y0 + 2, 'amber', 6); tc.px(x0 + 2, y0 + 2, 'amber', 5)
    else: tc.px(x0 + 1, y0 + 2, 'glass', 5); tc.px(x0 + 1, y0 + 3, 'glass', 4)
    for y in range(int(y0 + r), y0 + h): tc.px(x0 + w // 2, y, mat_frame, 2)   # 가운데 창살
    tc.hline(x0, x0 + w, int(y0 + r + 3), mat_frame, 2)
    for x in range(x0 - 2, x0 + w + 2): tc.px(x, y0 + h + 1, 'gst', 6 if x < x0 + w // 2 else 4); tc.px(x, y0 + h + 2, 'gst', 2)


def brass_pipe_v(tc, cx, y0, y1, dia=4, mat='brass', step=16, brackets=True):
    """벽을 타는 세로 관(지름 4px): 원통 6단, 16px 마다 이음 테(지름 +2), 이음 테 옆 검은 무쇠 벽 고정쇠."""
    pipe_v(tc, cx, y0, y1, dia, mat, step=step, flange=True)
    if brackets:
        for y in range(int(y0) + step // 2, int(y1) - 2, step):
            tc.px(cx - dia // 2 - 2, y, 'steel', 3); tc.px(cx + dia // 2 + 1, y, 'steel', 1)


def gear_face(tc, cx, cy, r, teeth, mat='steel', phase=0.0, spokes=4, thick=2, hub_mat='brass'):
    """남쪽을 향해 선 톱니 원판(machine-factory/mf_factory.gear_face 와 같은 기하): 이빨·테·바퀴살·굴대 + 위 두께 띠."""
    for y in range(int(cy - r - 4 - thick), int(cy + r + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy
            def inside(dx, dy):
                d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                return d <= r + (2.2 if math.cos(a * teeth + phase) > .2 else 0)
            d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if not inside(dx, dy):
                if any(inside(dx, dy + j) for j in range(1, thick + 1)):
                    tc.px(x, y, mat, 5 if dx < 0 else 4)
                continue
            light = -(dx * .7 + dy * .7) / max(1.0, d) * .5 + .5
            if d > r - 2.5: k = 4 + (1 if light > .62 else 0) - (1 if light < .32 else 0)
            elif d > r - 4.5: k = 2
            elif d < max(2.5, r * .22): tc.px(x, y, hub_mat, 5 if light > .5 else 3); continue
            else:
                sp = any(abs(math.sin(a - i * math.pi / spokes)) * d < 1.7 for i in range(spokes))
                if not sp: tc.px(x, y, 'dark', 1); continue
                k = 4 if light > .5 else 3
            tc.px(x, y, mat, k)
    tc.px(int(cx) - 1, int(cy) - 1, hub_mat, 6)


def gauge(tc, cx, cy, r=3, seed=0):
    """압력계: 놋쇠 테 + 흰(석재 톤 6) 판 + 검은 바늘(글자·눈금 숫자 없음, 눈금은 점 넷)."""
    tc.ell(cx, cy, r + 1, r + 1, 'brass', lambda x, y: 6 if (x < cx and y < cy) else (4 if x < cx + 1 else 2))
    tc.ell(cx, cy, r, r, 'stone', 6)
    a = -2.3 + _hash(seed, 3, 7) * 2.6
    for i in range(1, r + 1): tc.px(round(cx - .5 + math.cos(a) * i * .9), round(cy - .5 + math.sin(a) * i * .9), 'dark', 1)
    for t in (-2.6, -1.6, -.6, .4): tc.px(round(cx - .5 + math.cos(t) * (r - .5)), round(cy - .5 + math.sin(t) * (r - .5)), 'stone', 3)


def valve_wheel(tc, cx, cy, rx=4, ry=2, mat='brass'):
    """밸브 바퀴(위에서 비스듬히 본 테 + 살 넷)."""
    for t in range(0, 360, 12):
        a = math.radians(t)
        x = cx + math.cos(a) * rx; y = cy + math.sin(a) * ry
        tc.px(round(x - .5), round(y - .5), mat, 6 if (t > 160 and t < 290) else (4 if math.sin(a) < .3 else 2))
    tc.hline(cx - rx + 1, cx + rx, cy, mat, 3); tc.vline(cx, cy - ry + 1, cy + ry, mat, 3); tc.px(cx, cy, 'steel', 5)


def patina(tc, x0, y0, x1, y1, p=.06, seed=0, mats=('rust',)):
    """구리 위 녹청 점(cyan 톤 2~3) — 줄눈·아래 가장자리 쪽에 더 많이."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            g = tc.get(x, y)
            if not g or g[0] not in mats: continue
            q = p * (1.6 if g[1] <= 3 else 1.0)
            if hash2(x, y, seed + 91) < q: tc.px(x, y, 'cyan', 2 if hash2(y, x, seed + 92) < .55 else 3)


def steam_cloud(w=24, h=20, seed=0, a=200, dense=1.0):
    """증기 덩이(규격: 흰 회색 4~5단 손 도트 구름, 디더 없음): 둥근 덩이 셋~다섯을 겹친 윤곽, 윗왼 빛 톤 6, 아래 오른 톤 3.
    알파는 덩이 몸 a, 가장자리 한 줄 a*0.75 (번짐·그라데이션 없음)."""
    o = Image.new('RGBA', (w, h), (0, 0, 0, 0)); p = o.load()
    rng = np.random.RandomState(seed + 17)
    blobs = []
    n = 3 + int(rng.rand() * 3)
    for i in range(n):
        f = i / max(1, n - 1)
        bx = w * (.3 + .4 * rng.rand()); by = h * (.75 - .5 * f) + rng.rand() * 2
        br = min(w, h) * (.22 + .12 * rng.rand()) * (1.0 + .25 * f) * dense
        blobs.append((bx, by, br))
    R = [(232, 232, 236), (212, 214, 220), (186, 190, 198), (160, 166, 176), (134, 140, 152)]
    for y in range(h):
        for x in range(w):
            best = None
            for (bx, by, br) in blobs:
                d = math.hypot(x + .5 - bx, (y + .5 - by) * 1.15) / br
                if d <= 1 and (best is None or d < best[0]): best = (d, bx, by, br)
            if best is None: continue
            d, bx, by, br = best
            lx = (x + .5 - bx) / br; ly = (y + .5 - by) / br
            sh = -(lx * .6 + ly * .8)
            k = 0 if sh > .55 else (1 if sh > .15 else (2 if sh > -.3 else 3))
            if d > .86: k = min(4, k + 1)
            al = a if d <= .86 else int(a * .75)
            p[x, y] = R[k] + (al,)
    return o


def soft_puff(w=16, h=14, seed=0, a=170): return steam_cloud(w, h, seed, a)


def pad_to(im, W, H):
    """그림을 W x H 판의 왼쪽 아래(가로 가운데)에 놓는다."""
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o.alpha_composite(im, ((W - im.width) // 2, H - im.height)); return o
