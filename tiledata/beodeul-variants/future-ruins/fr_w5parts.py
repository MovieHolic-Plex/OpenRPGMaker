# 미래 폐허 웨이브 5 보정 — 차량 잔해 변형 · 건물 변형 조각(기존 car_wreck · ruin_block 와 같은 기계 재질 규약, 3/4 시점, 빛 왼쪽 위).
# 새 이름으로만 더한다(기존 조각 이름·그림 유지). 글자·숫자·상표 없음.
import math
from fr_mat import *
from fr_base import _hash, vnoise
from fr_props import cyl, rebar, conc_chunk
import fr_struct as S


def _moss(tc, x0, x1, y0, y1, seed, thr=.6, top=None):
    for y in range(y0, y1):
        for x in range(x0, x1):
            g = tc.get(x, y)
            if g and g[0] not in ('dark', 'glass') and vnoise(x, y, 3, seed) > thr: tc.px(x, y, 'sick', 3 + (1 if (top is not None and y < top) else 0))


def _wheelwell(tc, x0, x1, ybot, tire=False):
    cx = (x0 + x1) / 2
    for y in range(ybot - 7, ybot + 1):
        for x in range(x0, x1):
            if ((x + .5 - cx) / 4.2) ** 2 + ((y + .5 - ybot) / 5) ** 2 <= 1: tc.px(x, y, 'dark', 1)
    if tire:                                                          # 바람 빠진 타이어(납작한 아래 반원) + 녹슨 휠 점
        for y in range(ybot - 4, ybot + 1):
            for x in range(x0 + 1, x1 - 1):
                if ((x + .5 - cx) / 3.6) ** 2 + ((y + .5 - ybot) / 3.6) ** 2 <= 1: tc.px(x, y, 'cable', 3 if y == ybot - 4 else 2)
        tc.px(int(cx), ybot - 2, 'rust', 4); tc.px(int(cx) - 1, ybot - 2, 'rust', 3)


# ================================================================ 차량 잔해 변형
def car_burnt(seed=0):
    """불탄 차 잔해 3x2(48x32): car_wreck 과 같은 각진 차체지만 도장이 타 버려 녹·그을음만 남았다 — 유리 없는 검은 창 구멍,
    지붕이 열에 꺼져 내려앉았고, 문 하나가 떨어져 속이 비친다. 바퀴 자리는 녹슨 휠 테만. 아랫줄만 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    tc.poly([(12, 5), (34, 5), (37, 12), (9, 12)], 'rust', 3)            # 내려앉은 지붕(가운데가 꺼짐)
    for x in range(13, 33):
        tc.px(x, 5, 'rust', 4)
        if 17 <= x <= 28: tc.px(x, 7, 'rust', 2); tc.px(x, 8, 'rust', 2)
    tc.poly([(9, 12), (37, 12), (39, 15), (7, 15)], 'dark', 1)          # 유리 없는 창 띠
    for x in (16, 26):
        tc.vline(x, 12, 15, 'rust', 3)                                # 창기둥
    tc.poly([(34, 5), (44, 9), (44, 13), (37, 12)], 'dark', 2)          # 앞유리 구멍
    tc.line(35, 6, 43, 10, 'rust', 3)
    tc.poly([(44, 9), (47, 12), (47, 16), (44, 13)], 'rust', 3)
    for y in range(15, 28):
        for x in range(4, 47):
            k = 4 if x < 7 else (3 if x < 44 else 2)
            if y == 15: k = 4
            if y >= 26: k = 1
            if x in (19, 31) and y < 25: k = 1
            mat = 'rust' if vnoise(x, y, 4, seed + 2) > .38 else 'cable'      # 녹 + 그을음 얼룩
            tc.px(x, y, mat, clamp(k - (1 if mat == 'cable' else 0), 1, 6))
    for y in range(16, 25):                                           # 떨어진 문: 속(어두운 실내·스프링)
        for x in range(20, 31): tc.px(x, y, 'dark', 1 if y > 17 else 2)
    for x in range(21, 30, 3): tc.vline(x, 19, 24, 'rust', 2)
    tc.poly([(4, 15), (9, 12), (9, 15)], 'rust', 3)
    _wheelwell(tc, 8, 16, 28); _wheelwell(tc, 35, 43, 28)
    for (x, y) in ((11, 26), (39, 26)): tc.px(x, y, 'rust', 5)            # 휠 테 남은 점
    for y in range(9, 16):                                            # 위로 번진 그을음(창 위)
        for x in range(10, 40):
            g = tc.get(x, y)
            if g and g[0] == 'rust' and _hash(x, y, seed + 7) < .25: tc.px(x, y, 'cable', 2)
    tc.grain(.05)
    return tc.fin(.6, shadow=(26, 28, 22, 3, 70))


def sedan_wreck(seed=0, mat='paint'):
    """낮은 승용차 잔해 3x2(48x32): 둥근 지붕의 작은 해치백(바랜 붉은 도장 또는 바랜 황토), 깨진 뒷유리, 납작한 타이어 하나 남음,
    본닛이 열려 들렸다. 지붕·본닛 윗면 이끼. 아랫줄만 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    tc.poly([(14, 8), (30, 8), (34, 14), (10, 14)], mat, 5)              # 둥근 지붕
    for x in range(15, 30): tc.px(x, 8, mat, 6)
    tc.px(14, 9, mat, 5); tc.px(30, 9, mat, 4)
    tc.poly([(10, 14), (34, 14), (36, 17), (8, 17)], 'glass', 3)         # 옆창 띠
    for x in range(10, 22):
        if _hash(x, 15, seed) < .5: tc.px(x, 15, 'dark', 2)               # 깨진 뒤 창
    tc.vline(22, 14, 17, mat, 3)
    tc.px(27, 15, 'glass', 6); tc.px(28, 15, 'glass', 5)
    tc.poly([(34, 9), (42, 4), (44, 6), (36, 14)], mat, 4)               # 들린 본닛(앞으로 열려 하늘 쪽)
    tc.line(35, 10, 42, 5, mat, 6)
    tc.poly([(36, 14), (44, 14), (46, 18), (34, 18)], 'dark', 1)          # 열린 엔진 칸
    tc.px(39, 16, 'steel', 4); tc.px(41, 16, 'rust', 4)
    for y in range(17, 28):
        for x in range(4, 47):
            k = 4 if x < 7 else (3 if x < 44 else 2)
            if y == 17: k = 5
            if y == 21: k -= 1
            if y >= 26: k = 2
            if x == 22 and y < 25: k = 2
            tc.px(x, y, mat, clamp(k, 1, 6))
    tc.poly([(4, 17), (10, 14), (10, 17)], mat, 4)
    _wheelwell(tc, 8, 16, 28, tire=True); _wheelwell(tc, 35, 43, 28)
    tc.px(12, 20, 'steel', 6); tc.px(26, 20, 'steel', 6)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 3, mats=(mat,))
    _moss(tc, 14, 34, 8, 14, seed + 6, .58, top=10)
    tc.grain(.04)
    return tc.fin(.6, shadow=(26, 28, 22, 3, 70))


def car_flipped(seed=0):
    """뒤집힌 차 3x2(48x32): 배를 하늘로 드러낸 차 — 윗면은 검은 차대(가로 뼈대·굴대 둘·배기관·연료통), 바람 빠진 바퀴 넷이 위로 섰다.
    앞면은 거꾸로 선 차 옆구리(도장 띠가 위, 찌그러진 창 띠가 땅에 눌림). 아랫줄만 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    # 차대(윗면, 3/4 로 보이는 밑바닥)
    for y in range(6, 15):
        for x in range(5, 44):
            k = 3 if y < 8 else 2
            if x in (5, 6): k += 1
            tc.px(x, y, 'cable', k)
    for x in range(6, 43): tc.px(x, 6, 'cable', 4)
    for (x0, x1) in ((9, 40),):                                       # 가로 뼈대
        tc.hline(x0, x1, 9, 'steel', 3); tc.hline(x0, x1, 12, 'steel', 2)
    for x in (13, 36): tc.vline(x, 7, 14, 'steel', 3); tc.vline(x + 1, 7, 14, 'steel', 1)   # 굴대
    tc.hline(16, 34, 13, 'rust', 3); tc.hline(16, 34, 14, 'rust', 2)    # 배기관
    tc.rect(20, 7, 28, 11, 'rust', 3); tc.hline(20, 28, 7, 'rust', 4)   # 연료통
    rustify(tc, 0, 0, W, H, amount=.5, seed=seed + 2, mats=('steel',))
    # 위로 선 바퀴 넷(앞 둘은 크게, 뒤 둘은 차대 뒤쪽에 반쯤)
    for (cx, cy, r) in ((11, 6, 4.2), (37, 6, 4.2), (13, 4, 3.0), (35, 4, 3.0)):
        for y in range(int(cy - r - 1), int(cy + r + 1)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = ((x + .5 - cx) / r) ** 2 + ((y + .5 - cy) / (r * .8)) ** 2
                if d <= 1: tc.px(x, y, 'cable', 5 if y < cy - r * .5 else (4 if d > .45 else 2))
        tc.px(int(cx), int(cy), 'steel', 5); tc.px(int(cx) + 1, int(cy), 'rust', 3)
    # 앞면: 거꾸로 선 옆구리(위 = 문턱 도장 띠, 아래 = 눌린 창 띠·지붕)
    for y in range(15, 28):
        for x in range(4, 45):
            k = 4 if x < 7 else (3 if x < 42 else 2)
            if y == 15: k = 5
            if y in (21,): k -= 1
            mat = 'plaster'
            if y >= 22: mat = 'glass' if y < 25 else 'plaster'; k = (2 if _hash(x, y, seed + 5) < .5 else 3) if mat == 'glass' else 2
            if x in (19, 31) and y < 21: k = 2
            tc.px(x, y, mat, clamp(k, 1, 6))
    for x in range(4, 45):                                            # 눌린 지붕 끝(땅에 닿은 들쭉날쭉)
        if _hash(x, 27, seed + 6) < .5: tc.px(x, 27, 'plaster', 1)
    for (x0, x1) in ((8, 16), (35, 43)):                             # 휠하우스(위쪽, 거꾸로)
        cx = (x0 + x1) / 2
        for y in range(15, 20):
            for x in range(x0, x1):
                if ((x + .5 - cx) / 4.2) ** 2 + ((y + .5 - 15) / 4.6) ** 2 <= 1: tc.px(x, y, 'dark', 1)
    rustify(tc, 0, 14, W, H, amount=.35, seed=seed + 3, mats=('plaster',))
    tc.grain(.04)
    return tc.fin(.6, shadow=(26, 28, 22, 3, 70))


def bus_wreck(seed=0):
    """버스 잔해 6x3(96x48): 긴 지붕 윗면(바랜 크림, 환풍구 둘, 이끼 덩이·쌓인 잎), 옆구리 앞면에 창 일곱(깨진 유리·빈 구멍),
    가운데 접이문 열림, 바랜 청록 띠 도장(글자 없음), 바퀴 없이 주저앉아 앞쪽이 기울었다. 아래 2줄 막힘, 지붕 줄은 걷기 + 가림."""
    W, H = 96, 48; tc = TC(W, H, seed)
    def tilt(x): return int(round((x - 4) * 0.035))                  # 앞(오른쪽)으로 갈수록 1~3px 내려앉음
    for x in range(4, 92):                                            # 지붕 윗면
        d = tilt(x)
        for y in range(8 + d, 20 + d):
            k = 5 if y > 8 + d else 6
            if x >= 90: k = 4
            tc.px(x, y, 'plaster', k)
    for (vx) in (24, 60):                                             # 환풍구(낮은 상자)
        d = tilt(vx)
        for y in range(10 + d, 15 + d):
            for x in range(vx, vx + 9): tc.px(x, y, 'steel', 5 if y == 10 + d else (3 if y < 14 + d else 2))
        tc.hline(vx + 1, vx + 8, 12 + d, 'steel', 2)
    for x in range(4, 92):                                            # 옆구리 앞면
        d = tilt(x)
        for y in range(20 + d, 43 + d):
            ly = y - (20 + d)
            k = 4 if x < 7 else (3 if x < 89 else 2)
            if ly == 0: k = 5
            mat = 'plaster'
            if 3 <= ly <= 11: mat = 'glass'                           # 창 줄
            elif 13 <= ly <= 15: mat = 'cyan'; k = 3 if ly == 13 else 2   # 바랜 청록 띠
            if ly >= 21: k = 2
            tc.px(x, y, mat, clamp(k, 1, 6))
    for i in range(7):                                                # 창틀·깨짐
        wx0 = 8 + i * 11
        if 50 <= wx0 <= 58: continue
        d = tilt(wx0)
        tc.vline(wx0 - 1, 23 + d, 32 + d, 'plaster', 4); tc.vline(wx0 + 9, 23 + d, 32 + d, 'plaster', 2)
        h = _hash(i, 3, seed)
        for y in range(23 + d, 32 + d):
            for x in range(wx0, wx0 + 9):
                u = x - wx0; v = y - (23 + d)
                if h < .45 and (u + v * .8) > 3 + h * 6: tc.px(x, y, 'dark', 1 if v > 2 else 2)
                elif h < .7 and v > 4 and _hash(x, y, seed + 2) < .6: tc.px(x, y, 'dark', 2)
                elif (u + v) == 5: tc.px(x, y, 'glass', 6)
    d = tilt(52)                                                      # 열린 접이문
    for y in range(22 + d, 41 + d):
        for x in range(51, 59): tc.px(x, y, 'dark', 1 if y > 24 + d else 2)
    tc.vline(51, 22 + d, 41 + d, 'steel', 4); tc.vline(58, 22 + d, 41 + d, 'steel', 2)
    tc.hline(52, 58, 38 + d, 'steel', 3)                              # 계단 디딤
    for (x0, x1) in ((12, 22), (72, 82)):                             # 빈 휠하우스
        cx = (x0 + x1) / 2; yb = 43 + tilt(int(cx))
        for y in range(yb - 8, yb + 1):
            for x in range(x0, x1):
                if ((x + .5 - cx) / 5.2) ** 2 + ((y + .5 - yb) / 6) ** 2 <= 1: tc.px(x, y, 'dark', 1)
    for y in range(20, 40):                                           # 앞 끝(오른쪽) 범퍼·깨진 전조등
        d = tilt(91)
        if 20 + d <= y < 43 + d: tc.px(91, y, 'plaster', 2)
    tc.px(90, 37 + tilt(90), 'amber', 2); tc.px(89, 37 + tilt(89), 'amber', 3)
    rustify(tc, 0, 0, W, H, amount=.4, seed=seed + 3, mats=('plaster', 'cyan'))
    _moss(tc, 8, 88, 8, 20, seed + 6, .56, top=12)
    for (x, y) in ((40, 14), (44, 12), (70, 16), (16, 11)):           # 지붕에 떨어진 잔해 조각
        tc.px(x, y + tilt(x), 'conc', 3); tc.px(x + 1, y + tilt(x), 'conc', 4)
    tc.grain(.04)
    return tc.fin(.6, shadow=(48, 44, 44, 4, 70))


# ================================================================ 건물 변형
def ruin_office_glass(seed=0):
    """유리 외벽 사무 건물 그루터기 5x8(80x128): 강철 창살(가로 띠 ·세로 멀리언) 격자에 청록 유리판, 절반은 깨져 검은 속과 콘크리트
    바닥판이 드러났다. 왼쪽 위가 비스듬히 무너져 휜 멀리언이 삐죽, 맨 위 남은 바닥 윗면, 1층은 기둥만 남은 열린 로비. 앞면 7줄 막힘."""
    W, H = 80, 128; tc = TC(W, H, seed)
    x0, x1, base_y = 2, 78, 127
    def ytop(x):
        f = (x1 - x) / (x1 - x0)
        drop = max(0, f - .45) / .55
        return int(8 + drop * 54 + (vnoise(x, 0, 4, seed) - .5) * 6)
    FL = 18                                                           # 층 높이
    for x in range(x0, x1):
        yt = ytop(x)
        for y in range(yt, base_y + 1):
            fy = base_y - y; ly = fy % FL; fl = fy // FL
            if y < yt + 6 and yt <= 12: tc.px(x, y, 'conc', 6 if y == yt else 5); continue      # 남은 맨 위 윗면
            if y < yt + 2: tc.px(x, y, 'conc', 2); continue
            if fy < 22:                                               # 1층 로비(열림)
                tc.px(x, y, 'dark', 1 if fy < 18 else 2); continue
            if ly in (16, 17):                                        # 층 띠(강철 가로 띠)
                tc.px(x, y, 'steel', 5 if ly == 17 else 3); continue
            col = (x - x0) // 12; lx = (x - x0) % 12
            if lx == 0: tc.px(x, y, 'steel', 4); continue             # 멀리언
            if lx == 11: tc.px(x, y, 'steel', 2); continue
            h = _hash(col, fl, seed + 3)
            if h < .42 or (y < yt + 14):                              # 깨진 칸: 속 어둠 + 아래 바닥판 단면
                k = 1 if ly > 4 else 2
                tc.px(x, y, 'dark', k)
                if ly in (0, 1): tc.px(x, y, 'conc', 3)
                continue
            u = lx / 11.0; v = (FL - 2 - ly) / (FL - 2.0)
            k = 3 + (1 if v < .3 else 0) - (1 if v > .8 else 0)
            dg = lx + (FL - 2 - ly)
            if abs(dg - 9) < 1: k = 6
            elif abs(dg - 12) < .6: k = 5
            if h > .85: k -= 1                                        # 때 낀 칸
            tc.px(x, y, 'glass', clamp(k, 1, 6))
    for xc in range(x0, x1, 15):                                      # 로비 기둥
        if xc + 4 > x1: break
        for y in range(base_y - 21, base_y + 1):
            for x in range(xc, xc + 4): tc.px(x, y, 'conc', 4 if x == xc else (2 if x == xc + 3 else 3))
    tc.hline(x0, x1, base_y - 22, 'conc', 5); tc.hline(x0, x1, base_y - 21, 'conc', 3)
    for i in range(6):                                                # 무너진 윗선의 휜 멀리언·철근
        x = x0 + 2 + int(_hash(i, 2, seed) * 40); y = ytop(x)
        if y > 16:
            if i % 2: rebar(tc, x, y, x - 2 - int(_hash(i, 4, seed) * 3), y - 5 - int(_hash(i, 5, seed) * 5))
            else: tc.line(x, y, x + 3, y - 7, 'steel', 4)
    for (x, y) in ((18, 120), (40, 122), (58, 119)):                  # 로비 안 깨진 유리 반짝임
        tc.px(x, y, 'glass', 5)
    _moss(tc, x0, x1, base_y - 34, base_y + 1, seed + 8, .62)
    rustify(tc, 0, 0, W, H, amount=.22, seed=seed + 4, mats=('steel',))
    tc.grain(.04, mats=('conc', 'glass'))
    return tc.fin(.6)


def ruin_block_open(seed=0):
    """앞벽이 떨어진 건물 4x7(64x112): 3층 건물의 앞벽이 통째로 무너져 층마다 바닥판(윗면 빛·두께)과 어두운 방 속이 드러났다 —
    늘어진 전선·쓰러진 장 그림자·매달린 바닥 끝 철근. 양옆 벽기둥만 서 있고 발치에 무너진 앞벽 잔해 더미. 앞면 6줄 막힘."""
    W, H = 64, 112; tc = TC(W, H, seed)
    x0, x1, base_y = 2, 62, 111
    top = 10
    for y in range(top, base_y + 1):                                  # 뒤벽(어두운 방 속)
        for x in range(x0 + 5, x1 - 5): tc.px(x, y, 'dark', 2 if (y // 6) % 2 else 1)
    for (xa, xb) in ((x0, x0 + 6), (x1 - 6, x1)):                    # 양옆 벽기둥(외벽 단면)
        for y in range(top - 2, base_y + 1):
            for x in range(xa, xb):
                k = 4 if x == xa else (2 if x == xb - 1 else 3)
                tc.px(x, y, 'plaster', k)
        tc.hline(xa, xb, top - 2, 'plaster', 6)
    for f in range(4):                                                # 층 바닥판: 윗면 3px + 두께 3px, 앞 끝이 깨져 들쭉날쭉
        yb = base_y - 6 - f * 26
        for x in range(x0 + 5, x1 - 5):
            j = int(_hash(x // 3, f, seed + 2) * 3)
            for y in range(yb - 3, yb + 3 - (1 if j == 2 else 0)):
                k = 5 if y < yb - 1 else (3 if y < yb + 1 else 2)
                if y == yb - 3: k = 6
                tc.px(x, y, 'conc', k)
        for i in range(3):                                            # 바닥 끝에 매달린 철근
            x = x0 + 9 + int(_hash(i, f, seed + 5) * (x1 - x0 - 18))
            tc.vline(x, yb + 3, yb + 6 + int(_hash(i, f, seed + 6) * 4), 'rust', 3)
    for f in range(1, 4):                                             # 방 속 소품 그림자(쓰러진 장·의자 다리)
        yb = base_y - 6 - f * 26
        sx = x0 + 10 + int(_hash(f, 1, seed) * 26)
        tc.rect(sx, yb - 14, sx + 8, yb - 3, 'wood', 2); tc.hline(sx, sx + 8, yb - 14, 'wood', 3)
        cx = x0 + 34 + int(_hash(f, 2, seed) * 10)
        tc.line(cx, yb - 20, cx + 4, yb - 8, 'cable', 3)              # 천장에서 늘어진 전선
    tc.rect(x0 + 5, top - 2, x1 - 5, top + 3, 'conc', 4); tc.hline(x0 + 5, x1 - 5, top - 2, 'conc', 6)   # 지붕판 단면
    # 발치 잔해 더미(무너진 앞벽): 1층 앞을 반쯤 가린다
    for (cx, cy, w, h, sd) in ((x0 + 2, base_y - 14, 16, 13, 1), (x0 + 16, base_y - 10, 18, 10, 2), (x0 + 32, base_y - 15, 15, 14, 3),
                               (x0 + 45, base_y - 9, 14, 9, 4), (x0 + 24, base_y - 18, 10, 8, 5)):
        conc_chunk(tc, cx, cy, w, h, 4, seed + sd)
    rebar(tc, x0 + 20, base_y - 18, x0 + 23, base_y - 26); rebar(tc, x0 + 40, base_y - 15, x0 + 37, base_y - 22)
    _moss(tc, x0, x1, base_y - 30, base_y + 1, seed + 8, .6)
    tc.grain(.05, mats=('conc', 'plaster'))
    return tc.fin(.6)


def ruin_block_vine(seed=0):
    """덩굴에 덮인 건물 3x6(48x96): 기존 ruin_block 그루터기(3층, 바랜 크림) 앞면을 오염 덩굴이 위에서 아래로 덮었다 —
    창 위로 늘어진 덩굴 줄기, 잎 덩이(윗면 빛), 꼭대기 무너진 윗면엔 덤불. 앞면 5줄 막힘."""
    from PIL import Image
    import numpy as np
    from fr_base import SICK, hash2, smooth
    im = S.ruin_block(3, 2, .35, seed=seed + 40, wall='plaster')
    a = np.array(im).copy(); Hh, Ww = a.shape[:2]
    Y, X = np.mgrid[0:Hh, 0:Ww]
    op = a[..., 3] > 0
    ys = np.where(op.any(1))[0]; ytop = ys.min() if len(ys) else 0
    # 덩굴 커튼: 열마다 늘어진 길이가 다르다
    cov = np.clip(1.25 - X / (Ww * 0.62), 0, 1)                     # 왼쪽(그늘진 벽)에서 오른쪽으로 옅어진다
    reach = (smooth(Ww, 1, 6, seed + 1)[0] * 0.55 + 0.12) * (Hh - ytop) * cov[0]
    vine = op & ((Y - ytop) < reach[X]) & (smooth(Ww, Hh, 4, seed + 2) > .46)
    vine &= ~((smooth(Ww, Hh, 3, seed + 7) > .7) & ((Y - ytop) > reach[X] * .5))   # 덩이 사이 틈으로 벽이 비친다
    edge_low = vine & ~np.roll(vine, -1, 0)
    SK = np.array(SICK, np.uint8)
    t = np.where(smooth(Ww, Hh, 2, seed + 3) > .55, 4, 3)
    t = np.where(hash2(X, Y, seed + 4) > .85, 5, t)
    t = np.where(vine & ~np.roll(vine, 1, 0), 5, t)                  # 잎 덩이 윗면 빛
    a[vine, :3] = SK[t][vine]
    a[edge_low, :3] = SK[1]                                           # 잎 덩이 아래 그늘
    side = vine & (~np.roll(vine, 1, 1) | ~np.roll(vine, -1, 1))
    a[side & ~edge_low, :3] = SK[2]
    st = op & ~vine & (hash2(X // 2, 0, seed + 5) > .8) & ((Y - ytop) < reach[X] + 14) & (hash2(X, Y, seed + 6) > .25)
    a[st, :3] = SK[2]                                                 # 늘어진 덩굴 줄기
    return Image.fromarray(a, 'RGBA')


def gas_canopy(seed=0):
    """버려진 주유소 지붕 6x4(96x64): 네 기둥 위 넓은 지붕판(윗면 이끼·고인 빗물 얼룩, 바랜 붉은 띠 테두리 — 글자·상표 없음),
    오른쪽 앞 기둥이 꺾여 지붕 귀퉁이가 처졌다. 밑에 주유기 둘(빈 화면·늘어진 호스). 기둥·주유기 칸만 막힘, 지붕 밑은 걷기."""
    W, H = 96, 64; tc = TC(W, H, seed)
    # 기둥(뒤 둘은 짧게 보인다 — 3/4)
    for (px_, y0, y1, k) in ((12, 22, 60, 3), (76, 22, 60, 3)):
        for y in range(y0, y1):
            for x in range(px_, px_ + 5): tc.px(x, y, 'steel', 4 if x == px_ else (2 if x == px_ + 4 else k))
    for y in range(22, 52):                                           # 꺾인 오른쪽 앞 기둥(기울어 짧다)
        x = 80 + int((y - 22) * 0.14)
        for i in range(5): tc.px(x + i, y, 'steel', 4 if i == 0 else (2 if i == 4 else 3))
    def sag(x): return int(max(0, (x - 60) / 36.0) ** 2 * 7)          # 오른쪽 끝이 처진다
    for x in range(2, 94):                                            # 지붕판 윗면 + 붉은 띠 앞면
        s_ = sag(x)
        for y in range(2 + s_, 16 + s_):
            k = 5 if y > 2 + s_ else 6
            if y >= 14 + s_: k = 4
            tc.px(x, y, 'conc', k)
        for y in range(16 + s_, 23 + s_):
            ly = y - 16 - s_
            tc.px(x, y, 'paint', 5 if ly == 0 else (4 if ly < 3 else (3 if ly < 5 else 2)))
        if x in (2, 93):
            for y in range(2 + s_, 23 + s_): tc.px(x, y, 'paint', 3)
    for y in range(23, 25):                                           # 지붕 밑 그늘 띠
        for x in range(4, 92):
            if not tc.get(x, y + sag(x)): tc.px(x, y + sag(x), 'dark', 2)
    # 주유기 둘
    for (bx, sd) in ((30, 1), (54, 2)):
        for y in range(38, 60):
            for x in range(bx, bx + 10):
                k = 5 if y == 38 else (4 if x < bx + 2 else (2 if x >= bx + 8 else 3))
                if y >= 58: k = 1
                tc.px(x, y, 'plaster', k)
        tc.rect(bx + 2, 41, bx + 8, 46, 'dark', 1); tc.px(bx + 3, 42, 'glass', 3)    # 빈 화면
        tc.rect(bx + 2, 49, bx + 8, 51, 'paint', 3)
        tc.line(bx + 9, 48, bx + 12, 56, 'cable', 3); tc.line(bx + 12, 56, bx + 11, 60, 'cable', 2)   # 늘어진 호스
        tc.rect(bx - 2, 59, bx + 12, 62, 'conc', 3); tc.hline(bx - 2, bx + 12, 59, 'conc', 5)       # 받침 섬
    rustify(tc, 0, 18, W, H, amount=.35, seed=seed + 3, mats=('steel', 'plaster'))
    rustify(tc, 0, 12, W, 24, amount=.3, seed=seed + 4, mats=('paint',))
    _moss(tc, 4, 92, 2, 15, seed + 6, .6, top=6)
    for x in range(10, 90):                                           # 빗물 얼룩(지붕 윗면 어두운 덩이)
        for y in range(4, 14):
            if vnoise(x, y, 5, seed + 9) > .72 and tc.get(x, y + sag(x)) and tc.get(x, y + sag(x))[0] == 'conc': tc.shift(x, y + sag(x), -1)
    tc.grain(.04)
    return tc.fin(.6, shadow=(48, 61, 40, 3, 60))
