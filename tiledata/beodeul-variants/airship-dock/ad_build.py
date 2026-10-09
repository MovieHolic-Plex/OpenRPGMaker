# 비행선 정박 부두 — 앵커 2: 짐 기중기 · 관제 오두막 · 석탄 창고 · 급수탑 · 작은 보일러 · 증기 견인차 · 바람에 휜 소나무 · 잔교 조각.
from ad_props import *

# ---------------------------------------------------------------- 증기 짐 기중기 (4x7) — 붐이 동쪽(낭떠러지 쪽)으로
def cargo_crane():
    W, H = 64, 112
    tc = TC(W, H, 501)
    box(tc, 0, 92, 46, 111, 6, 'steel', base=3, seed=1)                   # 회전 받침(리벳 강철)
    panels(tc, 0, 98, 46, 111, 'steel', base=3, pw=16, ph=13, seed=2)
    for x in range(4, 44, 6): tc.px(x, 95, 'brass', 6)                    # 회전 고리 톱니
    tc.hline(0, 46, 111, 'steel', 1)
    box(tc, 2, 70, 12, 93, 3, 'stone', base=3, seed=4)                    # 평형추(돌 덩이)
    tc.hline(2, 12, 80, 'stone', 2); tc.hline(2, 12, 86, 'stone', 2)
    # 보일러(구리 세운 통) + 굴뚝 + 김
    for y in range(52, 93):
        for x in range(12, 24): tc.px(x, y, 'rust', clamp(FM.cyl_k((x - 12 + .5) / 12) + 1))
    for yb in (60, 72, 84): tc.hline(12, 24, yb, 'brass', 5)
    tc.ell(18, 52, 6, 2, 'rust', 6)
    gauge(tc, 18, 66, 2.2)
    tc.rect(15, 85, 21, 92, 'dark', 2); tc.rect(16, 86, 20, 91, 'amber', 4); tc.px(17, 87, 'amber', 6)    # 화구 불빛
    pipe_v(tc, 18, 30, 52, 4, 'steel', flange=False)
    tc.hline(15, 22, 30, 'steel', 5)
    for (cx, cy, r) in ((17, 24, 3.4), (12, 18, 4.2), (7, 11, 4.8)):      # 김(톤 5~6 덩이, 반투명)
        tc.ell(cx, cy, r, r * .8, 'plaster', lambda x, y, cy=cy: 6 if y < cy else 5)
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if tc.get(x, y) and tc.get(x, y)[0] == 'plaster': tc.a[y, x] = 190
    # 운전실(나무 벽 + 놋쇠 테 창 + 타르 지붕)
    box(tc, 24, 66, 44, 93, 5, 'wood', base=4, seed=6)
    tc.rect(24, 62, 46, 67, 'tar', 4); tc.hline(23, 47, 62, 'tar', 6); tc.hline(23, 47, 66, 'tar', 2)
    glass_pane(tc, 28, 72, 40, 81)
    tc.hline(27, 41, 71, 'brass', 6); tc.hline(27, 41, 81, 'brass', 3); tc.vline(34, 72, 81, 'brass', 4)
    tc.vline(42, 76, 90, 'redl', 3)                                        # 손잡이 막대
    # 격자 붐: 운전실 앞에서 동쪽 위로
    bx0, by0, bx1, by1 = 40, 78, 60, 8
    L = math.hypot(bx1 - bx0, by1 - by0); n = int(L)
    nx, ny = (by1 - by0) / L, -(bx1 - bx0) / L                            # 붐 법선
    for i in range(n + 1):
        t = i / n; x = bx0 + (bx1 - bx0) * t; y = by0 + (by1 - by0) * t
        w = 3.6 * (1 - t * .45)
        tc.px(round(x + nx * w), round(y + ny * w), 'steel', 5)
        tc.px(round(x - nx * w), round(y - ny * w), 'steel', 3)
    for j in range(9):                                                     # 지그재그 버팀
        t0, t1 = j / 9, (j + 1) / 9
        s0 = 1 if j % 2 == 0 else -1
        w0 = 3.6 * (1 - t0 * .45); w1 = 3.6 * (1 - t1 * .45)
        tc.line(bx0 + (bx1 - bx0) * t0 + nx * w0 * s0, by0 + (by1 - by0) * t0 + ny * w0 * s0,
                bx0 + (bx1 - bx0) * t1 - nx * w1 * s0, by0 + (by1 - by0) * t1 - ny * w1 * s0, 'steel', 4)
    tc.ell(60, 8, 2.4, 2.4, 'brass', lambda x, y: 6 if x < 60 else 3)    # 붐 끝 도르래
    cable(tc, 46, 64, 59, 9, sag=1, mat='cable', w=1)                      # 당김줄
    tc.vline(61, 10, 58, 'cable', 2)                                       # 갈고리 줄
    tc.vline(60, 58, 61, 'steel', 5); tc.px(59, 61, 'steel', 4); tc.px(59, 62, 'steel', 3); tc.px(60, 63, 'steel', 3)
    tc.px(61, 63, 'steel', 2); tc.px(62, 62, 'steel', 2)
    return out(tc, sh=(23, 110, 22, 2))

# ---------------------------------------------------------------- 관제 오두막 (5x5)
def control_hut():
    W, H = 80, 80
    tc = TC(W, H, 511)
    # 지붕(박공: 뒤 경사 밝게, 용마루, 앞 경사 짙게) — 타르 펠트에 세로 덧댄 띠
    for y in range(6, 34):                                                  # 슬레이트 박공 지붕: 뒤 경사 밝게, 놋쇠 용마루, 앞 경사 한 단 짙게
        for x in range(2, 78):
            back = y < 18
            row = (y - 6) // 4 if back else (y - 20) // 4
            ly = (y - 6) % 4 if back else (y - 20) % 4
            lx = (x + (row % 2) * 4) % 8
            k = (5 if back else 3) + (1 if x < 5 else 0) - (1 if x > 74 else 0)
            if ly == 3 or lx == 7: k -= 2
            elif ly == 0: k += 1
            if y == 6: k = 6
            if y in (18, 19):
                tc.px(x, y, 'brass', 6 if y == 18 else 4); continue
            tc.px(x, y, 'slate', clamp(k))
    tc.hline(1, 79, 33, 'slate', 1); tc.hline(1, 79, 34, 'wood', 2)          # 처마 끝
    # 굴뚝 관 + 풍향계 + 신호등
    pipe_v(tc, 62, 0, 14, 4, 'steel', flange=False); tc.hline(59, 66, 0, 'steel', 5)
    tc.vline(20, 4, 18, 'brass', 4); tc.line(15, 6, 26, 6, 'brass', 6); tc.poly([(26, 4), (29, 6), (26, 8)], 'brass', 5)
    tc.poly([(14, 4), (16, 6), (14, 8), (17, 8), (17, 4)], 'brass', 3)
    amber_lamp(tc, 74, 28)
    # 벽: 위 = 나무 널 + 큰 관제 창 셋, 아래 = 벽돌
    for y in range(35, 56):
        for x in range(4, 76):
            k = 5 if x < 7 else (4 if x < 72 else 3)
            if (y - 35) % 4 == 3: k -= 1
            tc.px(x, y, 'wood', k)
    for wx in (8, 30, 52):
        tc.rect(wx - 1, 37, wx + 21, 53, 'brass', 4); tc.hline(wx - 1, wx + 21, 37, 'brass', 6)
        glass_pane(tc, wx, 38, wx + 20, 52)
        tc.vline(wx + 10, 38, 52, 'brass', 4); tc.hline(wx, wx + 20, 45, 'brass', 3)
    for y in range(56, 76):                                                 # 벽돌(4px 줄, 8px 엇갈림)
        for x in range(4, 76):
            row = (y - 56) // 4; ly = (y - 56) % 4; lx = (x + (row % 2) * 4) % 8
            k = 4 if x > 6 else 5
            if x > 71: k = 3
            if ly == 3 or lx == 7: k = 2
            elif ly == 0: k += 1
            tc.px(x, y, 'brick', clamp(k))
    tc.hline(4, 76, 56, 'brass', 5)
    box(tc, 33, 58, 47, 76, 0, 'wood', base=4, seed=3)                     # 문(나무 널 + 놋쇠 손잡이)
    for x in range(35, 47, 3): tc.vline(x, 58, 75, 'wood', 3)
    tc.hline(33, 47, 58, 'wood', 6); tc.px(44, 67, 'brass', 6); tc.px(44, 68, 'brass', 3)
    amber_lamp(tc, 52, 61)
    tc.rect(2, 76, 78, 80, 'stone', 3); tc.hline(2, 78, 76, 'stone', 5)    # 돌 기초
    tc.rect(30, 76, 50, 80, 'stone', 5); tc.hline(30, 50, 76, 'stone', 6)  # 문 앞 디딤돌
    return out(tc)

# ---------------------------------------------------------------- 석탄 창고 (6x5)
def coal_shed():
    W, H = 96, 80
    tc = TC(W, H, 521)
    # 골함석 지붕(한쪽으로 기운 외쪽 지붕) — 세로 골 4px
    for y in range(4, 30):
        for x in range(2, 94):
            u = (x - 2) % 4
            k = 5 if u == 0 else (4 if u < 3 else 2)
            if y < 6: k += 1
            if y > 26: k -= 1
            tc.px(x, y, 'steel', clamp(k))
    rustify(tc, 2, 4, 94, 30, amount=.35, seed=7)
    tc.hline(1, 95, 30, 'steel', 1)
    # 벽돌 앞벽 + 그을음
    for y in range(31, 76):
        for x in range(4, 92):
            row = (y - 31) // 4; ly = (y - 31) % 4; lx = (x + (row % 2) * 4) % 8
            k = 4 if x > 6 else 5
            if x > 87: k = 3
            if ly == 3 or lx == 7: k = 2
            elif ly == 0: k += 1
            m = 'brick'
            if vnoise(x, y, 6, 523) > .62 and y < 50: m = 'sooty'
            tc.px(x, y, m, clamp(k))
    # 큰 아치 입구(속은 어둡고 석탄 더미가 보인다)
    for y in range(38, 76):
        for x in range(26, 72):
            ax = (x - 49) / 23.0; ay = (y - 46) / 9.0
            if y < 46 and ax * ax + ay * ay > 1: continue
            tc.px(x, y, 'dark', 2 if y < 52 else 3)
    tc.ell(52, 74, 20, 10, 'coal', lambda x, y: 4 if x < 48 else 3)
    tc.ell(46, 70, 10, 6, 'coal', 5)
    for i in range(24):
        x = int(hash2(i, 1, 527) * 36) + 32; y = int(hash2(i, 2, 527) * 10) + 64
        if tc.get(x, y) and tc.get(x, y)[0] == 'coal': tc.px(x, y, 'coal', 6)
    for x in range(25, 73):                                                 # 아치 테(놋쇠 아닌 강철 띠)
        ax = (x - 49) / 23.5
        if abs(ax) <= 1:
            y = round(46 - 9.5 * math.sqrt(max(0, 1 - ax * ax)))
            tc.px(x, y, 'steel', 5); tc.px(x, y - 1, 'steel', 3)
    for y in range(46, 76): tc.px(25, y, 'steel', 5); tc.px(72, y, 'steel', 3)
    # 미닫이 나무 문(왼쪽으로 열림)
    box(tc, 8, 42, 24, 76, 0, 'plank', base=4, seed=9)
    for x in range(10, 24, 4): tc.vline(x, 42, 76, 'plank', 2)
    tc.line(9, 44, 23, 74, 'plank', 5); tc.hline(6, 26, 41, 'steel', 4)
    # 오른쪽 석탄 깔때기 + 홈통
    tc.poly([(76, 34), (90, 34), (86, 46), (80, 46)], 'steel', lambda x, y: 4 if x < 83 else 2)
    tc.hline(76, 91, 34, 'steel', 6)
    tc.rect(81, 46, 85, 64, 'steel', 3); tc.vline(81, 46, 64, 'steel', 5)
    tc.poly([(78, 64), (88, 64), (86, 70), (80, 70)], 'steel', lambda x, y: 3)
    tc.rect(2, 76, 94, 80, 'stone', 3); tc.hline(2, 94, 76, 'stone', 5)
    return out(tc)

# ---------------------------------------------------------------- 급수탑 (3x5)
def water_tank():
    W, H = 48, 80
    tc = TC(W, H, 531)
    for x in (6, 40):                                                      # 다리 넷(앞 둘이 보인다)
        tc.rect(x, 36, x + 3, 78, 'steel', 4); tc.vline(x, 36, 78, 'steel', 5); tc.vline(x + 2, 36, 78, 'steel', 2)
    tc.line(9, 44, 40, 72, 'steel', 3); tc.line(40, 44, 9, 72, 'steel', 2); tc.hline(9, 40, 58, 'steel', 3)
    for y in range(8, 40):                                                 # 리벳 강철 물통(세운 원통)
        for x in range(3, 45):
            k = FM.cyl_k((x - 3 + .5) / 42)
            if (y - 8) % 10 == 9: k -= 2
            if (y - 8) % 10 == 1 and (x - 3) % 5 == 2: k = 6
            tc.px(x, y, 'steel', clamp(k))
    tc.ell(24, 8, 21, 5, 'steel', lambda x, y: 6 if x < 20 else 4)
    tc.poly([(4, 8), (24, 0), (44, 8)], 'steel', lambda x, y: 5 if x < 24 else 3)   # 원뿔 뚜껑
    tc.px(24, 0, 'brass', 6)
    rustify(tc, 3, 8, 45, 40, amount=.3, seed=5)
    for y in range(10, 76, 3): tc.hline(30, 34, y, 'steel', 5)             # 사다리
    tc.vline(30, 10, 76, 'steel', 4); tc.vline(34, 10, 76, 'steel', 2)
    pipe_v(tc, 16, 40, 76, 4, 'rust', step=12)                             # 내림 관
    tc.rect(1, 76, 47, 80, 'stone', 3); tc.hline(1, 47, 76, 'stone', 5)
    return out(tc, sh=(24, 79, 22, 2))

# ---------------------------------------------------------------- 작은 보일러 (2x3)
def boiler_small():
    W, H = 32, 48
    tc = TC(W, H, 541)
    for y in range(14, 44):
        for x in range(3, 29): tc.px(x, y, 'rust', clamp(FM.cyl_k((x - 3 + .5) / 26) + 1))
    for yb in (20, 31, 41): tc.hline(3, 29, yb, 'brass', 5)
    tc.ell(16, 14, 13, 3.4, 'rust', lambda x, y: 6 if x < 13 else 4)
    pipe_v(tc, 20, 0, 14, 4, 'steel', flange=False); tc.hline(17, 24, 0, 'steel', 5)
    gauge(tc, 9, 25, 2.4)
    tc.rect(12, 33, 21, 41, 'dark', 2); tc.rect(13, 34, 20, 40, 'amber', 4); tc.px(14, 35, 'amber', 6); tc.px(15, 35, 'amber', 5)
    tc.rect(1, 44, 31, 48, 'steel', 3); tc.hline(1, 31, 44, 'steel', 5)
    tc.ell(24, 6, 3, 2.4, 'plaster', 6, ); tc.a[np.where(tc.m == FM.MID['plaster'])] = 180
    return out(tc)

# ---------------------------------------------------------------- 증기 견인차 (3x2, 동쪽을 향한다)
def steam_tractor():
    W, H = 48, 32
    tc = TC(W, H, 551)
    for y in range(10, 21):                                                # 누운 보일러
        for x in range(14, 40):
            t = (y - 10 + .5) / 11; tc.px(x, y, 'drab', clamp(FM.cyl_k(t) + 1))
    for xb in (20, 30): tc.vline(xb, 10, 21, 'brass', 5)
    tc.rect(38, 9, 42, 22, 'steel', 3)
    pipe_v(tc, 38, 0, 10, 4, 'steel', flange=False); tc.hline(35, 42, 0, 'steel', 5)
    tc.rect(4, 4, 16, 6, 'tar', 4); tc.vline(5, 6, 20, 'steel', 4); tc.vline(15, 6, 20, 'steel', 3)   # 운전석 차양
    tc.rect(6, 14, 15, 18, 'wood', 4)
    tc.ell(10, 22, 9.4, 9.4, 'steel', lambda x, y: 4 if (x < 10 and y < 22) else 2)                    # 큰 뒷바퀴(살)
    tc.ell(10, 22, 7, 7, 'dark', 1)
    for a in range(8):
        ang = a / 8 * math.pi; tc.line(10 - math.cos(ang) * 7, 22 - math.sin(ang) * 7, 10 + math.cos(ang) * 7, 22 + math.sin(ang) * 7, 'paint', 4)
    tc.ell(10, 22, 2, 2, 'brass', 6)
    tc.ell(38, 26, 5.4, 5.4, 'steel', lambda x, y: 4 if x < 38 else 2); tc.ell(38, 26, 2, 2, 'paint', 5)
    return out(tc)

# ---------------------------------------------------------------- 바람에 휜 소나무 (3x4)
def pine_windswept(seed=0):
    W, H = 48, 64
    tc = TC(W, H, 561 + seed)
    for y in range(36, 64):                                                # 줄기(밑변 2칸 폭 가운데, 동쪽으로 휜다)
        t = (64 - y) / 28.0; cx = 17 + t * t * 7
        for x in range(int(cx) - 2, int(cx) + 3):
            tc.px(x, y, 'wood', 4 if x < cx - .5 else (3 if x < cx + 1 else 2))
    tc.px(15, 63, 'wood', 2); tc.px(20, 63, 'wood', 2)
    blobs = ((26, 30, 15, 7), (18, 22, 13, 6), (34, 24, 11, 6), (24, 14, 12, 5.5), (32, 10, 9, 4.5), (14, 32, 8, 4))
    for (cx, cy, rx, ry) in blobs:                                          # 동쪽으로 납작하게 밀린 층층 수관
        tc.ell(cx, cy, rx, ry, 'leaf', lambda x, y, cx=cx, cy=cy: 5 if (x < cx - 2 and y < cy) else (4 if y < cy + 1 else 2))
    for i in range(60):
        x = int(hash2(i, 1, 563 + seed) * 44) + 2; y = int(hash2(i, 2, 563 + seed) * 32) + 6
        if tc.get(x, y) and tc.get(x, y)[0] == 'leaf':
            tc.px(x, y, 'leaf', 6 if y < 22 and x < 30 else 3); tc.px(x + 1, y, 'leaf', 5 if y < 22 else 2)
    return out(tc, sh=(18, 63, 9, 2))

# ---------------------------------------------------------------- 잔교 (나무·철) — 동서로 이어 붙인다
def _deck(tc, x0, x1, y0, y1, seed=0):
    """잔교 널: 동서로 누운 4px 널(줄마다 32px 이음 엇갈림) — 64px 주기라 이어 붙여도 맞는다."""
    for y in range(y0, y1):
        row = (y - y0) // 4; ly = (y - y0) % 4
        off = int(hash2(row, 0, 571) * 32)
        for x in range(x0, x1):
            xx = (x + off) % 32
            k = 4 + (1 if ly == 0 else 0) - (2 if ly == 3 else 0)
            if xx == 0: k = 2
            if xx == 2 and ly == 1: k = 6
            if hash2(x % 64, y, 572) < .05: k -= 1
            tc.px(x, y, 'plank', clamp(k))

def _girder_front(tc, x0, x1, y0, h=6):
    for x in range(x0, x1):
        tc.px(x, y0, 'brass', 5); tc.px(x, y0 + 1, 'steel', 4)
        for y in range(y0 + 2, y0 + h): tc.px(x, y, 'steel', 3 if y < y0 + h - 1 else 1)
        if x % 8 == 3: tc.px(x, y0 + 3, 'steel', 6); tc.px(x + 1, y0 + 4, 'steel', 1)

def _trestle(tc, x0, x1, y0, y1):
    """잔교 밑 쇠 버팀(아래로 갈수록 옅어져 구름 속으로)."""
    for xs in range(x0, x1, 32):
        for (a, b, k) in ((xs + 4, xs + 28, 3), (xs + 28, xs + 4, 2)):
            tc.line(a, y0, b, y1, 'steel', k)
        tc.vline(xs + 4, y0, y1, 'steel', 4); tc.vline(xs + 5, y0, y1, 'steel', 2)
        tc.vline(xs + 28, y0, y1, 'steel', 4); tc.vline(xs + 29, y0, y1, 'steel', 2)
    for y in range(y0, y1):
        al = int(255 * (1 - (y - y0) / (y1 - y0)) ** .8)
        for x in range(x0, x1):
            if tc.m[y, x]: tc.a[y, x] = min(tc.a[y, x], max(60, al))

def pier_span():
    W, H = 64, 48
    tc = TC(W, H, 581)
    _trestle(tc, 0, 64, 34, 48)
    _deck(tc, 0, 64, 2, 28)
    tc.hline(0, 64, 0, 'steel', 5); tc.hline(0, 64, 1, 'steel', 3)         # 북쪽 테 들보
    _girder_front(tc, 0, 64, 28, 6)
    return out(tc)

def pier_head():
    W, H = 48, 48
    tc = TC(W, H, 591)
    _trestle(tc, 0, 40, 34, 48)
    _deck(tc, 0, 42, 2, 28)
    tc.hline(0, 42, 0, 'steel', 5); tc.hline(0, 42, 1, 'steel', 3)
    _girder_front(tc, 0, 44, 28, 6)
    for y in range(0, 34):                                                 # 동쪽 끝 들보(옆으로 보이는 테)
        tc.px(42, y, 'steel', 4); tc.px(43, y, 'steel', 2)
    tc.px(42, 0, 'brass', 6); tc.px(43, 28, 'brass', 4)
    for (x, y) in ((8, 6), (8, 22), (34, 6), (34, 22)): tc.px(x, y, 'steel', 6); tc.px(x + 1, y + 1, 'steel', 1)
    return out(tc)

def pier_root():
    """잔교가 절벽에 걸리는 돌 받침(윗면 판석 + 아래로 내려가는 마름돌 앞면, 끝은 구름 속)."""
    W, H = 32, 48
    tc = TC(W, H, 601)
    for y in range(0, 28):
        for x in range(0, 32):
            row = y // 8; lx = (x + (row % 2) * 8) % 16; ly = y % 8
            k = 5 if (lx == 0 or ly == 0) else 4
            if lx == 15 or ly == 7: k = 2
            tc.px(x, y, 'stone', k)
    for y in range(28, 48):
        for x in range(0, 32):
            row = (y - 28) // 6; lx = (x + (row % 2) * 6) % 12; ly = (y - 28) % 6
            k = 4 if x < 20 else 3
            if lx == 11 or ly == 5: k = 1
            elif ly == 0: k += 1
            tc.px(x, y, 'stone', clamp(k))
    tc.hline(0, 32, 28, 'stone', 6)
    for y in range(36, 48):
        al = int(255 * (1 - (y - 36) / 12) ** .9)
        for x in range(32): tc.a[y, x] = max(40, al)
    return out(tc)

def gangway():
    """곤돌라로 오르는 탑승 사다리 다리(널 경사 + 밧줄 손잡이) — 동쪽이 높다."""
    W, H = 32, 32
    tc = TC(W, H, 611)
    for x in range(0, 32):
        yb = 26 - x * .45
        for y in range(int(yb) - 8, int(yb)):
            k = 5 if (y - (yb - 8)) < 2 else 4
            if x % 4 == 3: k = 2
            tc.px(x, y, 'plank', k)
        tc.px(x, int(yb), 'plank', 1); tc.px(x, int(yb) + 1, 'steel', 3)
    for (a, b) in ((0, 12), (31, -2)):
        pass
    rope(tc, 1, 10, 30, -1 + 3, 2, 4); rope(tc, 1, 24, 30, 14, 2, 3)
    for x in (2, 16, 29):
        y = int(26 - x * .45); tc.vline(x, y - 14, y - 7, 'steel', 4)
    return out(tc)
