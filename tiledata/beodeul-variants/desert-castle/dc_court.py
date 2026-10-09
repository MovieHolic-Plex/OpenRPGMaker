# 사막 성 안뜰 조각 — 마른 분수, 기둥열(주랑), 기둥, 그늘 천막, 마른 화분, 돌 벤치, 항아리 걸이, 깃대, 화톳불 그릇, 모래 더미.
# 사암 = dp_art 램프·sash, 천 = 붉은/쪽빛/캔버스 7단. 3/4(윗면 + 앞면), 빛 왼쪽 위, pz.fin. 결정적.
import math
from dc_base import *

def cyl_t(u):
    """원통 6단(빛 왼쪽): u = 0(왼쪽 끝)..1(오른쪽 끝)."""
    if u < .12: return 4
    if u < .3: return 6
    if u < .46: return 5
    if u < .64: return 4
    if u < .82: return 3
    if u < .94: return 2
    return 3

# ================================================================ 기둥
def _column(px, x0, ybot, h, broken=0, seed=0, flute=True):
    """사암 기둥 하나(폭 12px): 네모 받침(윗면 2px + 앞면), 홈 새긴 원통 몸통, 둥근 받침목 + 네모 머리판(윗면 3px 밝음).
    broken>0 이면 머리 없이 위가 깨졌다(깨진 높이 px)."""
    w = 12
    for y in range(ybot - 6, ybot):                                     # 받침
        for x in range(x0 - 1, x0 + w + 1):
            c = SS[6] if y == ybot - 6 else (SS[5] if y == ybot - 5 else (SS[4] if x < x0 + w - 1 else SS[3]))
            if y == ybot - 1: c = SS[2]
            px.put(x, y, c)
    top = ybot - h + (0 if not broken else broken)
    for y in range(top + (0 if broken else 7), ybot - 6):
        for x in range(x0 + 1, x0 + w - 1):
            u = (x - x0 - 1) / (w - 2)
            if broken and y < top + int(H_(x, 1, seed) * 5) + (3 if x > x0 + 7 else 0): continue
            t = cyl_t(u)
            if flute and (x - x0) in (3, 6, 9): t = max(2, t - 1)
            if broken and y < top + 6 + int(H_(x, 1, seed) * 5) + (3 if x > x0 + 7 else 0) and H_(x, y, seed + 1) < 0.4: t = 6
            px.put(x, y, SS[t])
    if not broken:
        for y in range(top, top + 7):                                   # 머리판 + 받침목
            for x in range(x0 - 2, x0 + w + 2):
                j = y - top
                if j < 3: c = SS[6] if (j == 0 or x == x0 - 2) else SS[5]
                elif j < 5: c = SS[4] if x < x0 + w else SS[3]
                else:
                    if not (x0 <= x < x0 + w): continue
                    c = SS[5] if x < x0 + 4 else (SS[4] if x < x0 + 9 else SS[3])
                if j < 5 and x >= x0 + w + 1: c = SS[3]
                px.put(x, y, c)

def column():
    """사암 기둥(1x3): 네모 머리판·홈 새긴 원통·네모 받침. 안뜰 주랑·길 양옆에 열로."""
    px = Px(16, 48); _column(px, 2, 47, 44, seed=501)
    im = fin_sel(px.im); ground_shadow(im, 9, 46.5, 7, 1.5); return im   # 보정: 사암 회색 테 → 짙은 사암 윤곽

def column_broken_tall():
    """부러진 높은 기둥(1x3): 머리가 떨어지고 위가 들쭉날쭉 깨진 기둥, 밑에 떨어진 조각."""
    px = Px(16, 48); _column(px, 2, 47, 44, broken=12, seed=502)
    im = fin_sel(px.im); ip = Px(16, 48); ip.paste(im, 0, 0)   # 보정: 사암 회색 테 → 짙은 사암 윤곽
    PY._block(ip.p, 16, 48, 10, 42, 5, 4, 503); return ip.im

def column_toppled():
    """쓰러진 기둥(3x1): 옆으로 누운 홈 기둥 몸통, 왼쪽 끝에 네모 머리판, 오른쪽은 깨진 단면(동심 테)."""
    W, H = 48, 16; px = Px(W, H)
    for x in range(8, 44):
        for y in range(3, 13):
            v = (y - 3) / 9.0; t = cyl_t(v)
            if (x - 8) % 9 == 0: t = max(2, t - 1)
            px.put(x, y, SS[t])
    for y in range(4, 12):                                              # 깨진 단면
        for x in range(43, 47):
            d = math.hypot((x - 44.5) / 2.2, (y - 7.5) / 4.2)
            if d <= 1: px.put(x, y, SS[5] if d < 0.45 else (SS[4] if d < 0.8 else SS[3]))
    for y in range(1, 15):                                              # 머리판(누움)
        for x in range(1, 9):
            c = SS[6] if (y < 3 or x == 1) else (SS[5] if x < 5 else SS[3])
            if y >= 13: c = SS[2]
            px.put(x, y, c)
    im = fin_sel(px.im); ground_shadow(im, 26, 14.5, 18, 1.5, 70); return im   # 보정: 사암 회색 테 → 짙은 사암 윤곽

# ================================================================ 주랑(기둥열 + 들보 + 지붕판, 7x4)
def stoa():
    """안뜰 주랑(7x4): 네 기둥이 들보(갈매기 띠)와 얇은 지붕판을 받친다. 지붕판 윗면은 밝은 판석, 들보 밑 그늘이 바닥에 진다.
    벽(북쪽 성벽 앞면) 앞에 붙여 놓는다. 기둥 밑동 칸만 막히고 들보·지붕 칸은 걷기+가림."""
    W, H = 112, 64; px = Px(W, H)
    for y in range(0, 10):                                              # 지붕판 윗면
        for x in range(0, W):
            c = slab(x, y, 511)
            if y == 0: c = SS[6]
            if x == 0: c = mix(c, SS[6], 0.4)
            if x >= W - 2: c = SS[3]
            px.put(x, y, c)
    for y in range(10, 18):                                             # 들보 앞면
        for x in range(0, W):
            c = stone(x, y, bw=24, bh=8, seed=512)
            if y == 10: c = SS[3]
            px.put(x, y, c)
    chevron(px, 0, W, 12, 4)
    for x in range(0, W): px.put(x, 18, SS[2]); px.put(x, 19, mul(SS[2], 0.8))
    # 들보 밑 그늘 띠(기둥 사이로 보이는 벽 쪽 그늘) — 반투명
    for y in range(20, 30):
        for x in range(0, W): px.put(x, y, SHADOW, 60 - (y - 20) * 5)
    for i, cx in enumerate((4, 34, 64, 94)):
        _column(px, cx, 63, 44, seed=513 + i)
    im = fin_sel(px.im)   # 보정: 사암 회색 테 → 짙은 사암 윤곽
    return im

# ================================================================ 마른 분수(6x4)
def dry_fountain():
    """마른 분수(6x4): 둥근 사암 연못 둘레돌(윗면 갓돌 밝음 + 앞면 마름돌), 바닥은 말라 금 간 물때 자국과 날린 모래 더미,
    가운데 받침기둥 위 두 단 물그릇(마름, 이끼 자국), 꼭대기 꽃봉오리 장식. 칸 전체 막힘(가운데 그릇 받침까지)."""
    W, H = 96, 64; px = Px(W, H)
    cx, cy, rx, ry = 48.0, 38.0, 44.0, 17.0
    rimw = 5.0
    # 바깥 둘레 앞면(아래 반원 띠, 높이 9)
    for x in range(W):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        b = math.sqrt(1 - dx * dx); yr = cy + ry * b
        for y in range(int(yr), int(yr + 9)):
            c = stone(int(math.asin(dx) * rx + 100), y - int(yr), bw=12, bh=4, seed=521)
            lum = 0.92 + 0.2 * (-dx)
            if y == int(yr + 8): c = SS[2]
            px.put(x, y, mul(c, lum))
    # 둘레 갓돌 윗면 고리
    def ring(x, y, dx, dy):
        r = dx * dx + dy * dy
        inner = ((x + 0.5 - cx) / (rx - rimw)) ** 2 + ((y + 0.5 - cy) / (ry - rimw * 0.45)) ** 2
        if inner <= 1: return None
        c = slab(x, y, 522)
        if dy < 0 and inner < 1.18: c = SS[3]                           # 뒤쪽 안 볼(그늘)
        if r > 0.9 and dy < 0: c = SS[6]
        return c
    px.ell(cx, cy, rx, ry, ring)
    # 바닥(마름): 물때 자국 고리, 금, 모래 더미
    def basin(x, y, dx, dy):
        c = mix(SS[3], SA[3], 0.4)
        r = math.sqrt(dx * dx + dy * dy)
        if abs(r - 0.78) < 0.04: c = mix(SS[2], SS[3], 0.4)            # 옛 물높이 자국
        if dy < -0.55: c = mul(c, 0.82)                                 # 뒤 둘레 그늘
        if H_(x // 2, y, 523) > 0.93: c = SS[2]
        if (H_(x // 5, y // 3, 524) > 0.82) and ((x + y) % 3 == 0): c = SS[2]   # 마른 금
        return c
    px.ell(cx, cy + 0.5, rx - rimw, ry - rimw * 0.45, basin)
    for (hx_, hw, hh, sd) in ((22, 12, 6, 525), (70, 9, 4, 526), (40, 6, 3, 527)):   # 바닥 모래 더미
        PY._sand_heap(px.p, W, H, hx_, cy + 9, hw, hh, sd)
    # 가운데 받침기둥 + 두 단 그릇
    for y in range(18, 44):
        for x in range(44, 53):
            u = (x - 44) / 8.0; px.put(x, y, SS[cyl_t(u)])
    def bowl(bcx, by, brx, bry, depth, sd):
        for x in range(int(bcx - brx), int(bcx + brx) + 1):          # 그릇 앞면(아래로 좁아짐)
            dx = (x + 0.5 - bcx) / brx
            if abs(dx) > 1: continue
            b = math.sqrt(1 - dx * dx)
            for y in range(int(by + bry * b), int(by + bry * b + depth * b) + 1):
                px.put(x, y, SS[cyl_t((dx + 1) / 2)])
        px.ell(bcx, by, brx, bry, lambda x, y, dx, dy: SS[6] if dx * dx + dy * dy > 0.7 and dy < 0.2 else (SS[5] if dx * dx + dy * dy > 0.7 else (mix(SS[3], SA[4], 0.3) if dy > -0.3 else SS[2])))
    bowl(48.5, 30, 15, 5, 6, 528)
    for y in range(6, 28):
        for x in range(46, 51): px.put(x, y, SS[cyl_t((x - 46) / 4.0)])
    bowl(48.5, 13, 8, 3, 4, 529)
    px.ell(48.5, 6, 3.2, 4, lambda x, y, dx, dy: SS[6] if dx < 0 and dy < 0 else (SS[5] if dx < 0.3 else SS[3]))
    im = fin_sel(px.im)   # 보정: 사암 회색 테 → 짙은 사암 윤곽
    return im

# ================================================================ 그늘 천막(4x3)
def shade_canopy(stripe='crimson'):
    """그늘 천막(4x3): 네 나무 기둥에 붉은·흰 줄 천을 비스듬히 친 차양(윗면이 보이고 앞 가장자리는 물결 술), 밑에 깔개와
    방석 둘, 낮은 탁자 위 놋쇠 쟁반. 앞 기둥 두 칸만 막히고 천 밑은 걷는다(가림)."""
    W, H = 64, 48; px = Px(W, H)
    R = RAMPS[stripe]; CR = [mix(SA[i], (255, 250, 240), 0.35) for i in range(7)]
    # 깔개(그늘 속)
    for y in range(30, 44):
        for x in range(6, 58):
            c = mul(R[3], 0.7)
            if y in (31, 42) or x in (7, 56): c = mul(INDIGO[4], 0.75)
            if (x + y) % 6 == 0 and 33 < y < 40 and 10 < x < 54: c = mul(BRASS[4], 0.7)
            px.put(x, y, c)
    for (bx, by) in ((12, 33), (44, 34)):                               # 방석
        px.ell(bx, by, 5, 3, lambda x, y, dx, dy: mul(INDIGO[5] if dy < 0 else INDIGO[3], 0.8))
    px.ell(30, 36, 7, 3, lambda x, y, dx, dy: mul(BRASS[5] if dx < 0 else BRASS[3], 0.85))   # 쟁반
    # 천 그늘(반투명)
    for y in range(22, 46):
        for x in range(2, 62):
            if not px.on(x, y): px.put(x, y, SHADOW, 70)
    # 기둥
    for (x, y0, y1) in ((4, 8, 46), (58, 8, 46), (8, 2, 32), (54, 2, 32)):
        for y in range(y0, y1):
            px.put(x, y, WOOD[4]); px.put(x + 1, y, WOOD[2])
    # 천 윗면: 뒤(위) 가장자리 y2 → 앞 가장자리 y16, 줄무늬 세로, 앞에 물결 술
    for y in range(2, 22):
        for x in range(2, 62):
            fr = (y - 2) / 14.0
            if fr > 1.0:
                if y > 16 + 3 + 2 * math.sin(x * 0.785): continue      # 물결 술
                c = (R if ((x // 6) % 2 == 0) else CR)[3]
            else:
                c = (R if ((x // 6) % 2 == 0) else CR)[5 if fr < 0.4 else 4]
                if (y - 2) % 7 == 6: c = mul(c, 0.9)                    # 처짐 주름
                if x < 5: c = mix(c, (255, 255, 255), 0.2)
            px.put(x, y, c)
    im = px.fin()
    return im

# ================================================================ 소품
def dry_planter():
    """마른 화분(2x2): 네모 사암 화분(윗면 테 + 앞면 마름돌)에 말라 죽은 어린 야자 그루터기와 마른 잎."""
    W, H = 32, 32; px = Px(W, H)
    for y in range(14, 31):
        for x in range(2, 30):
            if y < 18: c = SS[6] if (y == 14 or x == 2) else SS[5]
            else: c = stone(x, y, bw=10, bh=5, seed=531)
            if 4 <= x < 28 and 15 <= y < 18: c = mix(SA[2], WOOD[2], 0.4)
            if x >= 28 and y >= 18: c = mul(c, 0.8)
            if y >= 30: c = SS[2]
            px.put(x, y, c)
    DRY = RP('dry')
    for y in range(6, 16):                                              # 그루터기
        for x in range(14, 18): px.put(x, y, WOOD[4] if x < 16 else WOOD[2])
    for k, (dx, dy) in enumerate(((-10, 4), (-7, -2), (8, -3), (11, 5), (2, -6))):   # 마른 잎(늘어짐)
        for i in range(10):
            f = i / 9.0
            x = 16 + dx * f; y = 7 + dy * f + 5 * f * f
            px.put(x, y, DRY[5 if k < 2 else 4]); px.put(x, y + 1, DRY[3])
    im = fin_sel(px.im); ground_shadow(im, 17, 30.5, 13, 1.5); return im   # 보정: 사암 회색 테 → 짙은 사암 윤곽

def stone_bench():
    """사암 돌 벤치(2x1): 두 네모 다리 위 두꺼운 좌판(윗면 밝음), 좌판 앞모 그늘."""
    W, H = 32, 16; px = Px(W, H)
    for y in range(3, 9):
        for x in range(1, 31):
            c = SS[6] if y == 3 or x == 1 else (SS[5] if y < 7 else SS[4])
            if y == 8: c = SS[3]
            if x >= 29: c = SS[3]
            px.put(x, y, c)
    for (x0) in (4, 23):
        for y in range(9, 15):
            for x in range(x0, x0 + 5): px.put(x, y, SS[5] if x == x0 else SS[3])
    im = fin_sel(px.im); ground_shadow(im, 16, 14.5, 14, 1.5, 70); return im   # 보정: 사암 회색 테 → 짙은 사암 윤곽

def amphora_rack():
    """항아리 걸이(2x2): 나무 틀 두 칸에 꽂은 끝 뾰족한 흙 항아리 넷(물·기름 저장), 하나는 깨져 바닥에 조각."""
    W, H = 32, 32; px = Px(W, H)
    CL = [hx(c) for c in ('#2c140c', '#5a2c18', '#86442a', '#a85e36', '#c47c48', '#dc9c64', '#f0c492')]
    for (x0, y0) in ((4, 4), (12, 6), (20, 4)):
        for y in range(y0, y0 + 20):
            v = (y - y0) / 19.0
            hw = 3.6 * math.sin(min(1, v * 1.25) * math.pi * 0.9) + 0.8 if v > 0.12 else 1.6
            for x in range(int(x0 + 4 - hw), int(x0 + 4 + hw) + 1):
                u = (x + 0.5 - (x0 + 4 - hw)) / (2 * hw + 1)
                t = cyl_t(u)
                if v < 0.12: t = 5 if x < x0 + 4 else 3
                px.put(x, y, CL[t])
    for y in range(12, 30):                                             # 틀
        px.put(2, y, WOOD[4]); px.put(3, y, WOOD[2]); px.put(28, y, WOOD[4]); px.put(29, y, WOOD[2])
    for x in range(2, 30):
        for (yy, t) in ((14, 5), (15, 3), (26, 5), (27, 2)): px.put(x, yy, WOOD[t])
    for (x, y) in ((8, 29), (11, 30), (14, 29)): px.put(x, y, CL[4]); px.put(x + 1, y, CL[2])
    im = px.fin(); ground_shadow(im, 16, 30.5, 13, 1.5); return im

def banner_pole():
    """깃대(1x3): 사암 받침돌에 세운 나무 장대, 위에서 늘어진 붉은 긴 천(무늬 없음, 끝이 해어졌다), 장대 꼭지 놋쇠."""
    W, H = 16, 48; px = Px(W, H)
    for y in range(4, 42): px.put(5, y, WOOD[5]); px.put(6, y, WOOD[2])
    for y in range(1, 4):
        for x in range(4, 8): px.put(x, y, BRASS[6] if x < 6 else BRASS[3])
    for y in range(6, 30):                                              # 천
        for x in range(7, 15):
            u = x - 7; sway = int(1.2 * math.sin(y / 5.0))
            if y > 25 and H_(x, y, 541) > 0.5: continue
            c = CRIMSON[5] if u < 2 else (CRIMSON[4] if u < 6 else CRIMSON[3])
            if u == 6: c = INDIGO[3]
            px.put(x + sway, y, c)
    for y in range(41, 47):
        for x in range(1, 12): px.put(x, y, SS[6] if y == 41 else (SS[4] if x < 10 else SS[3]))
    im = px.fin(); ground_shadow(im, 7, 46.5, 6, 1.4); return im

def brazier_bowl():
    """화톳불 그릇(1x2): 사암 받침 위 놋쇠 그릇에 타는 불과 불티. 안뜰·문 양옆에 쌍으로."""
    W, H = 16, 32; px = Px(W, H)
    for y in range(18, 31):
        for x in range(4, 12):
            c = SS[cyl_t((x - 4) / 7.0)]
            if y >= 29: c = SS[2]
            px.put(x, y, c)
    for y in range(13, 18):
        for x in range(1, 15):
            hw = 7 - (17 - y) * 0.4 if y > 14 else 7
            if abs(x + 0.5 - 8) <= hw: px.put(x, y, BRASS[6] if (y == 13 and x < 9) else (BRASS[5] if x < 7 else (BRASS[4] if x < 11 else BRASS[2])))
    for y in range(2, 13):
        for x in range(3, 13):
            hw = (y - 1) * 0.42 if y < 9 else 3.6
            if abs(x + 0.5 - 8 + (0.8 if y < 5 else 0)) <= hw:
                px.put(x, y, FIRE[6] if (y > 8 and abs(x + 0.5 - 8) < 1.6) else (FIRE[5] if y > 5 else FIRE[4]))
    px.put(5, 1, FIRE[5]); px.put(11, 3, FIRE[4])
    im = px.fin(); ground_shadow(im, 8, 30.5, 6, 1.4); return im

def sand_heap_s():
    """작은 모래 더미(2x1, 걷는 장식): 포석 위·벽 구석에 날려 쌓인 모래 둔덕."""
    W, H = 32, 16; px = Px(W, H)
    PY._sand_heap(px.p, W, H, 15, 15, 14, 7, 551)
    return px.im

def sand_heap_l():
    """큰 모래 더미(3x2, 걷는 장식): 벽 구석·무너진 틈 밑에 쌓인 넓은 둔덕, 마루에 잔물결."""
    W, H = 48, 32; px = Px(W, H)
    PY._sand_heap(px.p, W, H, 22, 31, 21, 13, 552)
    PY._sand_heap(px.p, W, H, 38, 31, 9, 6, 553)
    return px.im

def court_rug():
    """안뜰 깔개(3x2, 걷는 장식): 쪽빛 바탕에 붉은·금빛 테와 마름모 무늬(글자 없음), 모서리 술."""
    W, H = 48, 32; px = Px(W, H)
    for y in range(4, 28):
        for x in range(3, 45):
            c = INDIGO[3]
            if y in (5, 26) or x in (4, 43): c = CRIMSON[4]
            elif y in (6, 25) or x in (5, 42): c = BRASS[4]
            else:
                d = abs(x - 24) / 18.0 + abs(y - 15.5) / 9.0
                if abs(d - 0.7) < 0.08: c = CRIMSON[4]
                elif d < 0.25: c = BRASS[5]
                elif (x + y) % 8 == 0: c = INDIGO[4]
            if x < 8 and y < 10: c = mix(c, (255, 255, 255), 0.08)
            px.put(x, y, c)
    for y in (4, 27):
        for x in range(4, 44, 3): px.put(x, y - 1 if y == 4 else y + 1, CANVAS[5])
    return px.im
