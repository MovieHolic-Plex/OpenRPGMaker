# 제국 도시 보정 패스(2026-10-08) — 지붕 모양·색 변형. 기존 주택(검은/회청 슬레이트 모임·박공)만으로는 거리가 한 지붕이었다.
# 새 지붕 넷 + 새 벽 하나를 같은 7단 램프 규칙으로 더한다(기존 조각·이름은 그대로):
#   verd  녹청 구리 지붕(관청·장교 집) — 버들항 슬레이트 결을 녹청 램프로, 마룻대는 덜 바랜 구리(갈색)
#   corr  골판 함석 박공 지붕(노동자 집) — 세로 골 4px(빛·중간·그늘·중간), 판마다 아연(zinc)/녹(rust) 섞어 덧댄 판, 녹 줄 흘러내림
#   mans  망사르드 지붕(3층 장교 집) — 위 얕은 경사(밝음) + 테 몰딩 + 아래 가파른 경사(그늘)에 지붕창(박공 갓 · 유리) 줄
#   flat  평지붕(공장 사무동·아파트) — 앞 난간 갓돌, 윗면 타르 + 자갈 점, 옥상 물탱크(강철 원통 · 다리)·채광창·환기 갓
#   brk   그을린 벽돌 벽(노동자 집 1층) — 8x4 벽돌 줄쌓기, 줄눈 회색, 드문 검게 탄 벽돌
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 윤곽 한 겹(pz.fin). 결정적.
import math
import numpy as np
import fr_mat
from ec_base import *
from ec_base import _hash
from ec_build import iron_door, eave_shadow


def _r(*cs): return [hx(c) for c in cs]
VERD = _r('#081814', '#0e2a24', '#164036', '#20584a', '#33735e', '#4f9278', '#7cb49a')   # 녹청(바랜 구리)
COPR = _r('#140a06', '#2e170c', '#4c2814', '#6c3c1e', '#8c542a', '#ac703c', '#cc9460')   # 구리(마룻대·홈통)
ZINC = _r('#0e1014', '#1c2026', '#2c3138', '#40464e', '#585f68', '#767e86', '#9ea6ac')   # 함석·아연(골판)
TAR  = _r('#0a0a0c', '#151417', '#211f22', '#2e2b2d', '#3d3a3a', '#514d4b', '#6c6762')   # 타르 평지붕 + 자갈
BRK  = _r('#120808', '#261210', '#3c1c16', '#54281e', '#6c3828', '#864c38', '#a46a52')   # 그을린 벽돌
NEW = {'verd': VERD, 'copr': COPR, 'zinc': ZINC, 'tar': TAR, 'brk': BRK}
for n in NEW:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEW.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEW)


# ================================================================ 벽돌 벽
def brick_face(tc, x0, y0, x1, y1, seed=0):
    """그을린 벽돌 줄쌓기(8x4, 줄마다 반 장): 줄눈 1px 회색 석재 톤 3, 벽돌 톤 3~4, 위 모 +1, 드문 탄 벽돌 톤 2, 오른 끝 그늘."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            X, Y = x - x0, y - y0
            row = Y // 4; ly = Y % 4; off = (row % 2) * 4; lx = (X + off) % 8; col = (X + off) // 8
            if ly == 3 or lx == 7: tc.px(x, y, 'gst', 3 if ly == 3 else 2); continue
            h = _hash(col, row, seed + 5)
            k = 4 if h > .45 else 3
            if h < .07: k = 2
            if h > .93: k = 5
            if ly == 0: k += 1
            if x >= x1 - 2: k -= 1
            tc.px(x, y, 'brk', clamp(k, 1, 6))


# ================================================================ 지붕 넷
def roof_corr(tc, x0, y0, W, H, seed=0, yb=.42):
    """골판 함석 박공(마룻대 동서): 뒤 경사(빛)·앞 경사(그늘), 세로 골 4px, 16px 판마다 아연/녹, 판 이음 가로 겹침 줄, 녹 줄."""
    YB = int(H * yb)
    rib = (1, 0, -1, 0)
    for x in range(W):
        sheet = x // 16
        mat = 'rust' if _hash(sheet, 3, seed) < .35 else 'zinc'
        lap = int(H * (.55 + _hash(sheet, 4, seed) * .25))                 # 앞 경사 판 겹침 줄 위치
        streak = _hash(x // 2, 5, seed) > .82
        for y in range(H):
            if y < YB: k = 5 + rib[x % 4]; m = mat if mat == 'zinc' else ('zinc' if _hash(sheet, 6, seed) < .5 else mat)
            else: k = 3 + rib[x % 4]; m = mat
            if y < YB and y >= YB - 3 and m == 'zinc' and streak: m = 'rust'; k -= 1
            if y > YB and m == 'zinc' and streak and y < YB + 4 + int(_hash(x, 7, seed) * 8): m = 'rust'; k = 3 + rib[x % 4]
            if y == lap: k = 1
            if y == lap - 1: k += 1
            if y > H - 4: k -= 1
            if abs(y - YB) <= 1: m, k = 'steel', (5 if y < YB else 2)       # 마룻대 강철 덮개
            if y == 0: m, k = 'steel', 6
            if x < 2: m, k = 'steel', (5 if x == 1 else 1)                  # 박공널
            if x >= W - 2: m, k = 'steel', (2 if x == W - 2 else 1)
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    for x in range(W):
        tc.px(x0 + x, y0 + H - 1, 'steel', 1)


def roof_mansard(tc, x0, y0, W, H, mat='roofb', seed=0, dormers=(), top=.36):
    """망사르드: 위 얕은 경사(밝은 결, 뒤로 누움) → 구리 테 몰딩 → 아래 가파른 경사(그늘 결). 양 끝은 짧은 사선(추녀).
    dormers = 지붕창 칸 번호(16px 칸 가운데)."""
    tf = chip_tones(272, 224, 1, 4); tb = chip_tones(256, 240, 3, 6)
    YT = int(H * top); e = 6
    for y in range(H):
        ins = e * (1 - y / H) if y >= YT else e + 3 * (1 - y / max(1, YT))
        for x in range(W):
            if x + .5 < ins or x + .5 > W - ins: continue
            if y < YT: k = tb[y % 16, x % 16]; m = mat
            else: k = tf[y % 16, x % 16] - (1 if y > H - 4 else 0); m = mat
            if abs(x + .5 - ins) < 1.2: m, k = 'copr', (5 if y < YT else 4)
            if abs(x + .5 - (W - ins)) < 1.2: m, k = 'copr', 2
            if y in (YT - 1, YT): m, k = 'copr', (6 if y == YT - 1 else 3)          # 테 몰딩(구리)
            if y == YT + 1: k = 1
            if y == 0: m, k = 'copr', 5
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    for x in range(W):
        if tc.get(x0 + x, y0 + H - 1): tc.px(x0 + x, y0 + H - 1, mat, 1)
    for c in dormers:                                                     # 지붕창: 앞면 상자 + 유리 + 박공 갓(위 삼각)
        dx = x0 + c * 16 + 3; dy = y0 + YT + 3; dw = 10; dh = H - YT - 6
        for y in range(dy, dy + dh):
            for x in range(dx, dx + dw):
                k = 5 if x == dx else (2 if x >= dx + dw - 1 else 4)
                tc.px(x, y, 'gst', k)
        for y in range(dy + 3, dy + dh - 1):
            for x in range(dx + 2, dx + dw - 2): tc.px(x, y, 'glass', 2 if y < dy + dh // 2 else 1)
        tc.px(dx + 2, dy + 4, 'glass', 5); tc.px(dx + 3, dy + 4, 'glass', 4)
        for x in range(dx + 2, dx + dw - 2): tc.px(x, dy + dh - 1, 'gst', 6)
        for j in range(5):                                                # 박공 갓
            for x in range(dx - 1 + j, dx + dw + 1 - j): tc.px(x, dy - 1 - (4 - j) + 4 - 4 + (j - j), 'copr', 0)
        for j in range(5):
            y = dy - 5 + j
            for x in range(dx + 4 - j - 1, dx + 6 + j + 1): tc.px(x, y, mat, 5 if x < dx + 5 else 3)
            tc.px(dx + 4 - j - 1, y, 'copr', 5); tc.px(dx + 6 + j, y, 'copr', 2)
        tc.hline(dx - 1, dx + dw + 1, dy, 'copr', 2)


def roof_flat(tc, x0, y0, W, H, seed=0, tank=None, skylight=None, vents=()):
    """평지붕: 위 뒤 난간(가는 갓돌) · 윗면 타르(자갈 점, 물 고인 얼룩) · 앞 난간 갓돌(윗면 밝음 + 앞모) .
    tank = 물탱크 x, skylight = 채광창 x, vents = 환기 갓 x 들."""
    for y in range(H):
        for x in range(W):
            if y < 3: m, k = 'gst', (6 if y == 0 else (5 if y == 1 else 3))         # 뒤 난간 갓돌
            elif y >= H - 5:                                              # 앞 난간: 갓돌 윗면 2 · 앞모 3
                j = y - (H - 5); m, k = 'gst', (6, 5, 4, 3, 2)[j]
                if j >= 2 and x % 16 == 15: k = 2
            else:
                m = 'tar'; h = hash2(x, y, seed + 3)
                k = 3 if hash2(x // 3, y // 2, seed + 4) > .3 else 2
                if h > .9: k = 5
                elif h > .8: k = 4
                if y == 3: k = 1                                          # 뒤 난간 밑 그늘
                if y < 6 and hash2(x, y, seed) > .5: k = max(1, k - 1)
            if x < 2: m, k = 'gst', (5 if x == 1 else 2)
            if x >= W - 2: m, k = 'gst', (2 if x == W - 2 else 1)
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    if skylight is not None:                                              # 채광창(낮은 유리 상자, 윗면 유리 · 앞 철 테)
        sx = x0 + skylight; sy = y0 + 6
        for y in range(sy, sy + 8):
            for x in range(sx, sx + 14):
                if y < sy + 5: tc.px(x, y, 'glass', 4 if (x - sx + y - sy) % 7 < 2 else 2)
                else: tc.px(x, y, 'steel', 4 if x < sx + 8 else 3)
        tc.hline(sx, sx + 14, sy, 'steel', 6)
    for vx in vents:
        box(tc, x0 + vx, y0 + 6, x0 + vx + 8, y0 + 12, 3, 'steel', base=3); tc.hline(x0 + vx - 1, x0 + vx + 9, y0 + 5, 'steel', 5)


def water_tank(seed=0):
    """옥상 물탱크(지도·조각 공용 덧그림): 강철 원통(테 셋, 원뿔 갓) + 각진 강철 다리 넷 + 사다리. 22x34."""
    tc = TC(22, 34, seed)
    for y in range(4, 24):
        for x in range(2, 20):
            t = (x - 2) / 17.0
            k = cyl_k(t)
            if (y - 4) in (5, 11, 17): k = max(1, k - 2)
            tc.px(x, y, 'steel', k)
    for j in range(5):                                                    # 원뿔 갓
        for x in range(2 + j * 2, 20 - j * 2): tc.px(x, 4 - j, 'steel', 6 if x < 11 else 4)
    for x in range(1, 21): tc.px(x, 4, 'steel', 5); tc.px(x, 24, 'steel', 1)
    for lx in (3, 8, 13, 18):                                             # 다리
        for y in range(25, 34): tc.px(lx, y, 'steel', 4 if lx < 11 else 2)
    tc.line(3, 26, 8, 32, 'steel', 3); tc.line(18, 26, 13, 32, 'steel', 2)
    for y in range(10, 34, 3): tc.px(20, y, 'steel', 5)                   # 사다리 살
    tc.vline(21, 8, 34, 'steel', 2)
    return tc.fin(.6)


# ================================================================ 집 몸채(ec_build.house 와 같은 규칙) + 지붕 고르기
def house_v(wc=4, storeys=2, seed=0, door=None, roof='verd', style='hip', upper='iron', lower='stone', lit=(), shutters=True,
            chim=True, ends=True, awning=False, dormers=None, tank=None, skylight=None, vents=()):
    """style: 'hip'(모임·박공 끝, roof 재질 = verd/roofb/roofk/zinc), 'corr'(골판 함석 박공), 'mans'(망사르드), 'flat'(평지붕)."""
    W = wc * 16; SH = 30
    if style == 'flat': Rh = 22; chim = False
    elif style == 'mans': Rh = 42
    else: Rh = (40 if wc >= 4 else 36) if storeys > 1 else (34 if wc >= 4 else 30)
    extra = 34 - 12 if tank is not None else 0
    pad = (14 if chim else 2) + extra
    body = storeys * SH + 6
    H = pad + Rh + body
    tc = TC(W, H, seed)
    yb = pad + Rh
    d = door if door is not None else (wc // 2 if wc % 2 else wc // 2 - (1 if _hash(seed, 1, 3) < .5 else 0))
    for s in range(storeys):
        y0 = yb + s * SH; y1 = y0 + SH
        if s < storeys - 1 and upper == 'iron': iron_face(tc, 2, y0, W - 2, y1, seed=seed + s, base=3, oy=s * 5)
        elif s < storeys - 1 and upper == 'brick': brick_face(tc, 2, y0, W - 2, y1, seed + s)
        elif s == storeys - 1 and lower == 'brick': brick_face(tc, 2, y0, W - 2, y1, seed + s)
        else: stone_face(tc, 2, y0, W - 2, y1, 16, 8, seed + s * 7, base=4)
        if s > 0: string_course(tc, 2, W - 2, y0)
    plinth(tc, 2, W - 2, H - 6, 6, seed=seed)
    for s in range(storeys):
        y0 = yb + s * SH
        for c in range(wc):
            if s == storeys - 1 and c == d: continue
            window(tc, c * 16 + 5, y0 + 8 + (2 if s > 0 else 0), 6, 11 if s < storeys - 1 else 10, lit=(s, c) in lit,
                   seed=seed + c, shutter=shutters and _hash(s, c, seed + 9) < .35)
    iron_door(tc, d * 16 + 2, H - 6 - 21, 12, 21, seed)
    if awning:
        ax0, ax1, ay = d * 16 - 2, d * 16 + 18, H - 6 - 27
        mat = 'verd' if roof == 'verd' else 'steel'
        for x in range(ax0, ax1):
            tc.px(x, ay, mat, 6 if x < ax0 + 8 else 5); tc.px(x, ay + 1, mat, 4); tc.px(x, ay + 2, mat, 2)
        for bx in (ax0 + 1, ax1 - 2):
            for j in range(3, 6): tc.px(bx, ay + j, 'steel', 3)
    eave_shadow(tc, 2, W - 2, yb, 4 if style != 'flat' else 2)
    if style == 'hip': roof_hip(tc, 0, pad, W, Rh, roof, ends=ends, cap=('copr' if roof == 'verd' else 'steel'))
    elif style == 'corr': roof_corr(tc, 0, pad, W, Rh, seed)
    elif style == 'mans': roof_mansard(tc, 0, pad, W, Rh, roof, seed, dormers=dormers if dormers is not None else range(wc))
    elif style == 'flat': roof_flat(tc, 0, pad, W, Rh, seed, skylight=skylight, vents=vents)
    cx = None
    if chim:
        e = min(W // 3, int(Rh * .9)) if (ends and style == 'hip') else 8
        cx = (W - e - 10) if d < wc / 2 else e + 2
        chimney(tc, cx, pad - 6, 8, 18)
    tc.grain(.03, mats=('gst', 'brk'))
    im = tc.fin(.6)
    if tank is not None:
        im.alpha_composite(water_tank(seed), (tank, pad - extra + 0))
    if chim:
        im.alpha_composite(steam(12, 12, seed + 2, 110), (cx - 2, max(0, pad - 20)))
    return im


# ---------------------------------------------------------------- 조각(이름 새로)
def house_verdigris(seed=201): return house_v(4, 2, seed, roof='verd', style='hip', lit=((0, 2),), awning=True)
def house_verdigris_gable(seed=202): return house_v(5, 2, seed, door=2, roof='verd', style='hip', ends=False, lit=((0, 0), (0, 4)))
def house_mansard(seed=203): return house_v(4, 3, seed, door=1, roof='roofb', style='mans', lit=((0, 2), (1, 0)), chim=True)
def house_mansard_verd(seed=204): return house_v(3, 2, seed, door=1, roof='verd', style='mans', lit=((0, 1),))
def house_corrugated(seed=205): return house_v(4, 1, seed, roof='zinc', style='corr', lower='brick', shutters=False)
def house_corrugated3(seed=206): return house_v(3, 1, seed, roof='zinc', style='corr', lower='brick', shutters=False, chim=False)
def house_flatroof(seed=207): return house_v(5, 2, seed, door=1, style='flat', upper='brick', tank=44, vents=(10,), lit=((0, 3),))
def house_flatroof_sky(seed=208): return house_v(4, 2, seed, door=2, style='flat', skylight=6, vents=(42,), lit=((0, 0),))
def house_zinc_hip(seed=209): return house_v(4, 1, seed, roof='zinc', style='hip', lower='brick')
