"""체육관 장치·소품 — 본 시트 가구 규칙(통일 외곽선 i2_ol · 윗면 하이라이트 1px · 오른쪽 2px/아래 3px 반투명 그림자).

장치 문법(에디터 조수용 — 이벤트로 바뀌는 칸은 두 상태를 모두 칸으로 둔다. 맵에는 지금 상태를 깔고, 이벤트가 다른 상태로 바꾼다):
- 밟는 스위치는 모두 「바닥과 같은 높이의 둥근 판」이다(테두리 2단 + 가운데 기호, 솟지 않는다): 밸브 gy_valve(물방울) → gy_valve_on,
  혼불 문양 gy_sigil(위층, 불꽃) → gy_sigil_on. 솟은 것은 막힌 물체로 읽힌다.
- 막는 장치와 풀린 상태: 가라앉은 징검돌 gy_stone_sunk(막힘) → gy_stone_up(걷는다 — 레인 줄 위의 돌이면 양옆 줄 칸을 끝 부표 gy_lane_end_e/w 로 바꾼다) · 퀴즈 문 gy_qdoor_t/f(셔터, 막힘) → gy_qdoor_open_t/f(문틀만) ·
  숨은 다리 gy_ibridge_hid(막힘) → gy_ibridge_h/v · 자르기 나무 gy_cuttree(막힘) → 지운다 · 격파 판 gy_boards(막힘) → gy_boards_broken(걷는다) ·
  괴력 바위 = 본 시트 g2_boulder0/1(막힘, 밀린다 — 이 시트는 그리지 않는다) → 용암 칸에 밀어 넣으면 gy_lava_fill(걷는다) · 금 간 얼음 gy_crack(걷는다, 지나면 떨어짐) → gy_ice_hole.
- 회전문(검방울): 가운데 축 gy_turn_pivot(팔이 가로일 때)·gy_turn_pivot_v(세로일 때 — 축 양옆 팔 토막이 팔 방향을 따른다) + 팔 gy_turn_h/gy_turn_h_w(가로, 바깥 끝 기둥이 동/서)·gy_turn_v/gy_turn_v_n(세로, 바깥 끝 기둥이 남/북). 팔 칸으로 직각 방향에서 걸어 들어가면 팔 둘이 90도 돈다.
- 김 구멍 gy_vent_f0..3(4프레임 김, 바닥과 같은 높이의 꺼진 구멍 — 밟으면 떨어진다) · 칸막이 아래 칸은 gy_vent_s_f0..3. 김 이은 칸 gy_vent_up 은 위 칸이 다른 김 구멍이면 두지 않는다(김이 위 구멍 테를 덮어 한 칸에 김 기둥이 둘 섰다).
- 어둠(무로): 바닥 위층 gy_dark_l<m>(걷는다)·gy_dark_l<m>_w(벽 위, 막힘). m = 밝은 이웃 칸 마스크(N1 E2 S4 W8 NE16 SE32 SW64 NW128, 대각은 옆 두 변이 어두울 때만) — 밝은 쪽에서 칸 안으로 빛이 번진다. 둘레에 밝은 칸이 없으면 gy_dark(= l0). 위층이 통행을 정하므로 벽 위에는 반드시 _w 를 쓴다.
- 관장 단은 관마다 다르다: 불 gyd_dais_fire(벽돌 단) · 얼음 gyd_dais_ice(결정 원판) · 유령 gyd_dais_ghost(제단) · 에스퍼 gyd_dais_psy(3×3 원판) ·
  풀 gyd_dais_grass(꽃 무대) · 격투 gyd_dais_dojo(방석 2×2) · 드래곤 gyd_dais_dragon(3×3 돌계단). 물관은 단이 없다(섬 위에 선다)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
from interior2 import F, C, SHADOW, _shade  # noqa: E402
import gyms_common as gc  # noqa: E402


def _blob(f, cx, cy, rx, ry, ramp, hi=(0.9, 0.15, -0.75)):
    """왼쪽 위가 밝은 둥근 덩이(4톤)."""
    for y in range(f.h):
        for x in range(f.w):
            dd = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if dd <= 1:
                l = -((x - cx) / rx + (y - cy) / ry)
                f.p(x, y, ramp[3] if l > hi[0] else ramp[2] if l > hi[1] else ramp[1] if l > hi[2] else ramp[0])


# ---- 바닥과 같은 높이의 밟는 판(공통 문법) ----------------------------------------------------------
def button(base_im, ring, plate, symbol, on=False, ol=None):
    """둥근 판(지름 13px): 바닥에 박힌 테두리 2단(바깥 최암 · 안쪽 밝은 위/어두운 아래) + 납작한 판면 + 가운데 기호. on 이면 판면이 한 단 밝고 기호가 빛난다."""
    im = base_im.copy()
    for y in range(T):
        for x in range(T):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
            if d <= 6.6:
                if d > 5.6:
                    c = ol or ring[0]
                elif d > 4.7:
                    c = ring[2] if y < 8 else ring[1]
                else:
                    c = plate[2] if on else plate[1]
                    if not on and y >= 10 and d > 3.6:
                        c = plate[0]
                im.putpixel((x, y), c)
    for (x, y), lit in symbol:
        im.putpixel((x, y), lit if on else plate[0])
    return im


def valve(P, on=False):
    """밸브(바닥 판, 밟으면 징검돌이 떠오르는 이벤트 자리): 강철 테 + 파란 판 + 물방울 기호."""
    gl, st = P["i2_glass"], P["i2_steel"]
    drop = [((8, 4), gl[2]), ((7, 5), gl[2]), ((8, 5), gl[2]), ((7, 6), gl[2]), ((8, 6), gl[2]), ((9, 6), gl[2]), ((6, 7), gl[2]),
            ((7, 7), gl[2]), ((8, 7), gl[2]), ((9, 7), gl[2]), ((6, 8), gl[2]), ((7, 8), gl[2]), ((8, 8), gl[2]), ((9, 8), gl[2]), ((7, 9), gl[2]), ((8, 9), gl[2])]
    plate = [P["i2_blue"][0], P["i2_blue"][1], P["i2_blue"][2]]
    return button(gc.floor(P, "deck"), [C(P, "i2_ol"), st[0], st[2]], plate, drop, on)


def sigil(P, on=False):
    """혼불 문양(판석 위층, 밟으면 숨은 다리가 나타나는 이벤트 자리): 판석에 새긴 고리 2단 + 가운데 불꽃 기호. on = 보랏빛으로 타오른다."""
    sg, gs = P["gy_sigil"], P["gy_gst"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 8)
            if 5.8 < d <= 6.8:
                im.putpixel((x, y), sg[1] if on else gs[0])
            elif 4.6 < d <= 5.4:
                im.putpixel((x, y), sg[0] if on else gs[3])
    flame = [(8, 4), (7, 5), (8, 5), (7, 6), (8, 6), (9, 6), (6, 7), (7, 7), (8, 7), (9, 7), (7, 8), (8, 8), (9, 8), (8, 9)]
    for x, y in flame:
        im.putpixel((x, y), sg[2] if on and y < 8 else sg[1] if on else gs[3])
    return im


# ---- 관장 단(관마다 다른 모양) --------------------------------------------------------------------
def dais_fire(P):
    """불관 단(3×2, 걷는다): 붉은 벽돌 받침 두 단 위 크림 판 + 가운데 불꽃 문양. 왼쪽 끝은 칸 끝(x=0)까지 — 방 벽에 붙여 놓는다(QA-L2 M10)."""
    cr, br, og, yl = P["gy_cream"], P["gy_brick"], P["i2_orange"], P["i2_yellow"]
    f = F(3, 2)
    f.r(0, 3, 45, 18, cr[2]); f.r(0, 3, 45, 3, cr[3]); f.r(1, 3, 1, 18, cr[3])
    for k, (cx, h) in enumerate(((19, 7), (24, 11), (29, 7))):
        for t in range(h):
            y = 15 - t; w = max(0.6, 2.6 * (1 - t / h) + 0.3)
            for x in range(48):
                if abs(x + 0.5 - cx) <= w:
                    f.p(x, y, og[1] if t < h * 0.6 else yl[1])
    f.r(0, 19, 45, 29, br[1])
    for y in (19, 24):
        f.r(0, y, 45, y, br[2])
    for y0 in (19, 24):
        for x in range(0, 46):
            if (x + (4 if y0 == 24 else 0)) % 8 == 0:
                f.r(x, y0 + 1, x, y0 + 4, br[0])
    f.r(0, 29, 45, 29, br[0])
    return f.done(P, floor_y=0)


def dais_ice(P):
    """얼음관 단(3×2, 걷는다): 타원 얼음 원판(두께 4px) + 가운데 눈꽃."""
    ic, st = P["gy_ice"], P["gy_ist"]
    f = F(3, 2)
    f.ell(24, 19, 22, 10, st[0]); f.ell(24, 16, 22, 10, ic[1]); f.ell(22, 14, 17, 7, ic[2]); f.ell(18, 12, 7, 3, ic[3])
    for a in range(6):
        r = math.radians(a * 60)
        f.line(24, 16, round(24 + 7 * math.cos(r)), round(16 + 4.2 * math.sin(r)), P["i2_white"][2])
    return f.done(P, floor_y=0)


def dais_ghost(P):
    """유령관 제단(3×2, 걷는다): 다리 없는 판석 단 두 층(위 1px 밝은 모서리) + 가운데 보라 천이 윗면에서 앞면 끝까지 흘러내린 띠."""
    st, sg = P["g2_stone"], P["gy_sigil"]
    f = F(3, 2)
    f.r(2, 2, 45, 18, st[2]); f.r(2, 2, 45, 2, st[3]); f.r(2, 2, 2, 18, st[3])
    f.r(2, 19, 45, 23, st[1]); f.r(2, 19, 45, 19, st[0])                 # 위 층 앞면
    f.r(0, 24, 47, 25, st[3]); f.r(0, 26, 47, 30, st[1]); f.r(0, 30, 47, 30, st[0])   # 아래 층(한 단 넓다)
    f.r(16, 2, 31, 30, sg[0]); f.r(16, 2, 31, 3, sg[1]); f.r(17, 4, 17, 29, sg[1])
    for x in range(16, 32, 3):                                             # 천 끝 술
        f.p(x, 30, sg[2])
    return f.done(P, floor_y=0)


def dais_psy(P):
    """에스퍼관 원판(3×3, 걷는다): 회색 원판 두께 4px + 분홍 고리 + 가운데 눈 문양."""
    st, pf = P["g2_stone"], P["gy_psyface"]
    f = F(3, 3)
    f.ell(24, 27, 21, 14, st[0]); f.ell(24, 24, 21, 14, st[2]); f.ell(22, 22, 15, 9, st[3])
    _ring_draw(f, 24, 24, 15, 9.6, pf[1], 1.6)
    f.ell(24, 24, 6, 3.4, P["i2_white"][2]); f.ell(24, 24, 2.6, 2.6, pf[0])
    return f.done(P, floor_y=0)


def _ring_draw(f, cx, cy, rx, ry, c, w):
    for y in range(f.h):
        for x in range(f.w):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if 1 - w / rx <= d <= 1:
                f.p(x, y, c)


def dais_grass(P):
    """풀관 꽃 무대(3×2, 걷는다): 나무 판 무대 + 앞 가장자리를 두른 꽃 줄(분홍·흰·노랑). 오른쪽 끝은 칸 끝까지 — 방 오른쪽 벽에 붙여 놓는다(QA-L3 P8)."""
    wd, lf = P["gy_wood"], P["gy_hedge"]
    f = F(3, 2)
    f.r(2, 3, 47, 20, wd[2]); f.r(2, 3, 47, 3, wd[3])
    for y in range(4, 21, 4):
        f.r(2, y, 47, y, wd[1])
    f.r(2, 21, 47, 26, wd[1]); f.r(2, 21, 47, 21, wd[0])
    cols = [P["i2_c_flower"], (P["i2_white"][1], P["i2_white"][2]), (P["i2_yellow"][1], P["i2_yellow"][2])]
    for k, x in enumerate(range(5, 45, 6)):
        f.ell(x, 27.5, 2.6, 2, lf[2])
        d, l = cols[k % 3][0], cols[k % 3][1]
        f.r(x - 1, 23, x + 1, 25, d); f.p(x, 23, l)
    return f.done(P, floor_y=0)


def dais_dojo(P):
    """도장 방석(1×1, 걷는다): 다다미 위 자주 방석 — 부푼 윗면(가운데 한 톤 밝음) · 앞면 3px(아래 최암) · 가운데 꿰맨 금 점 · 네 귀 술. 관장이 이 위에 선다."""
    pf, gd = P["gy_psyface"], P["i2_gold"]
    f = F(1, 1)
    f.r(2, 2, 13, 10, pf[1]); f.r(2, 2, 13, 2, pf[2]); f.r(2, 2, 2, 10, pf[2])
    f.ell(7.5, 6, 4.2, 2.6, pf[2])
    f.r(2, 11, 13, 12, pf[0]); f.r(3, 13, 12, 13, pf[0])
    f.r(7, 6, 8, 6, gd[1]); f.p(7, 7, gd[0])
    for x, y in ((3, 3), (12, 3), (3, 11), (12, 11)):          # 네 귀 금 술 — 가장자리 px 는 done() 외곽선이 덮으므로 한 칸 안쪽
        f.p(x, y, gd[1])
    return f.done(P, floor_y=0)


def dais_dragon(P):
    """용관 돌계단 단(3×3, 걷는다): 밝은 회색 돌 윗판(2칸) + 앞 계단 세 단(디딤 밝음 · 챌판 어둠) + 가운데로 흘러내린 붉은 깔개."""
    st, dw, gd = P["g2_stone"], P["gy_dwall"], P["i2_gold"]
    f = F(3, 3)
    f.r(1, 1, 46, 22, st[2]); f.r(1, 1, 46, 1, st[3]); f.r(1, 1, 1, 22, st[3])
    for k in range(3):
        y = 23 + k * 8
        x0, x1 = 1 + k * 3, 46 - k * 3
        f.r(x0, y, x1, y + 2, st[3 if k == 0 else 2]); f.r(x0, y + 3, x1, y + 7, st[0])
    f.r(17, 1, 30, 47, dw[1]); f.r(17, 1, 17, 47, dw[2]); f.r(30, 1, 30, 47, dw[0])
    for k in range(3):
        f.r(17, 26 + k * 8, 30, 30 + k * 8, dw[0])
    f.r(18, 4, 29, 4, gd[1]); f.r(18, 19, 29, 19, gd[1])
    return f.done(P, floor_y=0)


# ---- 물 체육관 -----------------------------------------------------------------------------------
def stone_sunk(P):
    """가라앉은 징검돌(물 위층, 막힘): 떠오른 돌과 같은 타원 실루엣이 수면 아래 비친다 — 물보다 한 단 진한 몸 ·
    윗면 둘레에 수면에 비친 연회색 고리 1px(돌 윗면 밝은 톤을 물빛과 반씩)."""
    pl, st = P["gy_pool"], P["g2_stone"]
    ring = tuple((a + b) // 2 for a, b in zip(st[2][:3], pl[2][:3])) + (255,)
    im = px.new()
    for y in range(T):
        for x in range(T):
            d = ((x + 0.5 - 8) / 6.4) ** 2 + ((y + 0.5 - 9.5) / 4.4) ** 2
            if 0.72 < d <= 1.0:
                im.putpixel((x, y), ring if y <= 10 else pl[0])
            elif d <= 0.72:
                im.putpixel((x, y), pl[0] if y > 9 else pl[1])
    return im                                                      # 둘레 흰 물결 점은 뺐다 — 돌 윤곽에 붙어 돌에서 튄 점으로 보였다(QA-L5 N11)


def stone_up(P):
    """떠오른 징검돌(물 위층, 걷는다): 회색 돌판 윗면 + 앞면 2px + 물 위 흰 물결 고리."""
    st, wt = P["g2_stone"], P["i2_white"]
    f = F(1, 1)
    f.ell(8, 11, 7.6, 4.4, wt[1])
    f.ell(8, 9.5, 6.4, 4.4, st[1]); f.ell(8, 8.4, 6.2, 3.8, st[2]); f.ell(6.6, 7.2, 2.6, 1.4, st[3])
    return f.done(P, shadow=False)


def dive(P):
    """다이빙대(1×3 위층, 막힘) — 위에서 본 판: 위 칸(둘레 위)은 판 밑동과 양옆 쇠 죔쇠 둘, 판이 아래 두 칸 물 쪽으로 길게 튀어나오고 끝이 둥글다
    (물 위로 판 길이의 절반 넘게 — 둘레 위에만 있으면 흰 기둥·수건으로 읽혔다, QA-L5 N12).
    판 윗면은 한 단 밝은 흰 판 + 왼쪽 1px 하이라이트(판 두께) · 홈은 뿌리와 끝 두 줄만(사다리 가로대 오독 방지). 물 위에 판 그늘이 비스듬히 떨어진다."""
    wt, st = P["i2_white"], P["i2_steel"]
    f = F(1, 3)
    f.r(3, 4, 12, 33, wt[2]); f.ell(7.5, 33, 4.6, 3.0, wt[2])
    f.r(3, 4, 3, 33, wt[1]); f.r(12, 5, 12, 33, wt[1])
    for y in (8, 31):
        f.r(5, y, 10, y, wt[0])
    for x0 in (1, 12):
        f.r(x0, 6, x0 + 2, 11, st[1]); f.r(x0, 6, x0 + 2, 6, st[2])
    im = f.done(P, floor_y=48, shadow=False)
    for y in range(34, 39):                                        # 물 위 판 그늘(비스듬히 아래 오른쪽)
        for x in range(5 + (y - 34), 13 + (y - 34)):
            if 0 <= x < 16 and im.getpixel((x, y))[3] == 0:
                im.putpixel((x, y), SHADOW)
    return im


def ladder(P, side):
    """수영장 사다리(물 칸 위층, 막힘): 둘레 가장자리에 걸친 레일 둘 + 가로대 둘 + 둘레 위로 올라온 손잡이 고리.
    side = 사다리가 붙은 둘레의 방향(n: 물 칸 북쪽이 둘레 · w/e: 서·동쪽이 둘레)."""
    st, pl = P["i2_steel"], P["gy_pool"]
    f = F(1, 1)
    for a in (4, 10):
        f.r(a, 0, a + 1, 9, st[2]); f.r(a + 1, 1, a + 1, 9, st[1])
        f.r(a, 0, a + 1, 0, st[0])
    f.r(5, 4, 10, 4, st[1]); f.r(5, 8, 10, 8, st[1]); f.r(4, 11, 11, 11, pl[0])
    im = f.done(P, shadow=False)
    if side == "w":
        im = im.transpose(px.Image.ROTATE_90).transpose(px.Image.FLIP_TOP_BOTTOM)
    elif side == "e":
        im = im.transpose(px.Image.ROTATE_270)
    return im


def stone_sunk_lane(P):
    """레인 줄이 지나는 가라앉은 징검돌(물 위층, 막힘): 물속 돌 위로 수면의 레인 줄이 그대로 지나간다(줄이 돌 칸에서 끊겼다, I1 X9)."""
    im = stone_sunk(P)
    im.alpha_composite(lane(P))
    return im


def lane(P):
    """경영 레인 줄(물 위층, 막힘): 빨강·흰 부표가 번갈아 떠 있는 가로 줄."""
    rd, wt = P["i2_red"], P["i2_white"]
    f = F(1, 1)
    f.r(0, 8, 15, 8, P["i2_steel"][0])
    for k, cx in enumerate((2, 6, 10, 14)):
        c = rd if k % 2 == 0 else wt
        f.ell(cx, 8.5, 2.2, 2.4, c[1]); f.p(cx - 1, 7, c[2])
    return f.done(P, shadow=False)


def lane_end(P, side):
    """레인 줄 끝 칸(물 위층, 막힘): 떠오른 징검돌 바로 옆에서 줄이 끝난다 — 돌 쪽 가장자리에 줄을 매는 큰 끝 부표(빨강 몸 + 흰 띠, 최암 윤곽)를 달고
    줄은 그 부표에 매여 멈춘다(떠오른 돌이 줄을 끝 처리 없이 끊어 「지웠다」로 읽혔다, I3 Z4). side = 끝 부표가 붙는 쪽(e: 돌이 동쪽 · w: 서쪽).
    잔 부표는 gy_lane 과 같은 자리·같은 번갈이라 옆 줄 칸과 이어진다."""
    rd, wt = P["i2_red"], P["i2_white"]
    m = (lambda x: x) if side == "e" else (lambda x: 15 - x)
    f = F(1, 1)
    a, b = sorted((m(0), m(10)))
    f.r(a, 8, b, 8, P["i2_steel"][0])                         # 줄은 끝 부표 안까지만
    for k, cx in ((0, 2), (1, 6)) if side == "e" else ((0, 10), (1, 14)):
        c = rd if k % 2 == 0 else wt
        f.ell(cx, 8.5, 2.2, 2.4, c[1]); f.p(cx - 1, 7, c[2])
    cx = 12.5 if side == "e" else 3.5                          # 끝 부표: 6×7 — 잔 부표보다 한 둘레 크다
    f.ell(cx, 8.5, 3.0, 3.4, rd[1])
    for y in (8, 9):
        for x in range(int(cx - 2.5), int(cx + 3.5)):
            if f.im.getpixel((x, y))[3]:
                f.p(x, y, wt[1])
    f.p(int(cx) - 1, 6, rd[2]); f.p(int(cx) - 2, 7, rd[2])     # 왼쪽 위 빛
    im = f.done(P, shadow=False)
    return im


def porthole(P):
    """둥근 창(1×2 캔버스, 뒷벽 위): 강철 테 + 물빛 유리 + 사선 반사."""
    st, gl = P["i2_steel"], P["i2_glass"]
    f = F(1, 2)
    f.ell(8, 13, 6, 6, st[1]); f.ell(8, 13, 4.4, 4.4, gl[1]); f.ell(7.6, 12.6, 1.6, 1.4, gl[2])
    f.p(6, 15, gl[2]); f.p(5, 14, gl[0])
    return f.done(P, shadow=False)


# ---- 불 체육관 -----------------------------------------------------------------------------------
def vent_up(P, frame):
    """김 구멍 바로 위 칸(위층, 장식 — 걷는다): 정본 분기공 위 칸 `dungeon_cavern.vent(P, "t")` 의 김 실을 프레임에 맞춰 이어 올린다.
    아래 칸 김이 다 자란 프레임(3)에만 위 칸 아래쪽 6px 이 보인다 — 한 칸에서 김이 잘리지 않게(I2 대조표 X8)."""
    import dungeon_cavern as dc
    im = dc.vent(P, "t")
    keep = {0: T, 1: T, 2: T, 3: 10}[frame]
    for y in range(keep):
        for x in range(T):
            im.putpixel((x, y), (0, 0, 0, 0))
    return im


def _f0_wisp(x, y):
    """f0 김 촉: 정본 김 실 두 가닥(x7~8 · x9~10, 각 2px 폭) 중 왼쪽은 구멍 테에 붙은 7~8행, 오른쪽은 1px 위로 띄운 6~7행.
    두 가닥이 4×2px 한 덩이로 붙어 「구멍 위 하얀 마개」로 읽혔다(I4 W4). 두 자리 모두 f1(5~8행)의 같은 가닥 안이라 f0 → f1 이 이어 자란다."""
    return (x <= 8 and 7 <= y <= 8) or (x >= 9 and 6 <= y <= 7)


def vent(P, frame, shaded=False):
    """김 나는 구멍(바닥 칸, 밟으면 떨어진다): 구멍 테·김 모양은 정본 던전 분기공 `dungeon_cavern.vent(P, "b")`(어두운 타원 틈 + 붉은 속 테 + 흰 김 실 두 가닥)
    을 체육관 벽돌 바닥 위에 얹는다(통합 검수 I1 X5). 바닥과 같은 높이로 걷는다. 김은 프레임마다 구멍 위로 2 → 4 → 6 → 9px 로 자란다."""
    import dungeon_cavern as dc
    base = gc.floor(P, "hot")
    if shaded:
        base = gc.under_wall(base)
    ov = dc.vent(P, "b")
    top = {0: 6, 1: 5, 2: 3, 3: 0}[frame]                          # f0 에도 김 촉 2px — 정지 그림·스크린샷에서 검은 구멍만 보여 「떨어지는 구멍」으로만 읽혔다(I3 Z8)
    # 김(반투명)은 이 프레임 높이까지만. 섞을 때 칸마다 다른 바닥 색과 섞으면 색 수가 불어나(+86) 시트 색 상한을 넘으므로,
    # 바닥 대표 톤 하나와 두 단(옅음·짙음)으로만 섞는다 — 김 실의 모양·두 톤은 정본 그대로.
    rep = max(base.getcolors(1 << 16))[1]
    out = base.copy().convert("RGBA")
    for y in range(T):
        for x in range(T):
            c = ov.getpixel((x, y))
            if c[3] == 255:
                out.putpixel((x, y), c)
            elif c[3] > 0 and y >= top and (frame or _f0_wisp(x, y)):
                a = 0.5 if c[3] < 170 else 0.8
                out.putpixel((x, y), tuple(round(rep[i] * (1 - a) + c[i] * a) for i in range(3)) + (255,))
    return out


def brazier(P):
    """불꽃 화로(1×2, 막힘): 돌 받침 + 쇠 그릇(테 하이라이트) + 세 갈래 불꽃(빨강→주황→노랑 심)."""
    st, rd, og, yl = P["g2_stone"], P["i2_red"], P["i2_orange"], P["i2_yellow"]
    f = F(1, 2)
    f.r(4, 22, 11, 29, st[1]); f.r(4, 22, 11, 22, st[2]); f.r(5, 23, 5, 28, st[2]); f.r(4, 29, 11, 29, st[0])
    f.r(1, 15, 14, 21, P["gy_bas"][1]); f.r(1, 15, 14, 15, P["gy_bas"][3]); f.r(2, 20, 13, 21, P["gy_bas"][0])
    for cx, h in ((5, 9), (8, 13), (11, 8)):
        for k in range(h):
            y = 15 - k
            wd = max(0.6, 2.4 * (1 - k / h) + 0.4)
            for x in range(16):
                if abs(x + 0.5 - cx - 0.5 * math.sin(k * 0.9)) <= wd:
                    f.p(x, y, rd[1] if k < 2 else og[1])
    f.ell(8, 12, 2, 3.4, yl[1]); f.ell(8, 13, 1.2, 1.8, yl[2])
    return f.done(P, floor_y=24)


def quiz(P):
    """퀴즈 기계(1×2, 막힘): 흰 몸체 · 위 화면에 「?」 · 빨강·파랑 단추 · 앞 통풍 줄 · 옆 손잡이."""
    wt, gl, rd, bl, gr = P["i2_white"], P["i2_glass"], P["i2_red"], P["i2_blue"], P["i2_gray"]
    f = F(1, 2)
    f.r(1, 3, 13, 29, wt[1]); f.r(1, 3, 13, 4, wt[2]); f.r(2, 5, 2, 27, wt[2]); f.r(1, 28, 13, 29, wt[0])
    f.r(3, 6, 11, 14, gr[0]); f.r(4, 7, 10, 13, gl[0])
    for x, y in ((6, 8), (7, 8), (8, 8), (8, 9), (7, 10), (7, 12)):
        f.p(x, y, wt[2])
    f.r(3, 17, 5, 18, rd[1]); f.r(9, 17, 11, 18, bl[1]); f.p(3, 17, rd[2]); f.p(9, 17, bl[2])
    for y in (21, 23, 25):
        f.r(4, y, 10, y, gr[1])
    f.r(14, 10, 15, 20, gr[1]); f.r(14, 10, 15, 10, gr[2])
    return f.done(P, floor_y=18)


def qdoor(P, part: str, open_: bool = False):
    """퀴즈 문(칸막이 틈 1×2, 이벤트로 열린다). 닫힘: 윗칸 = 칸막이 윗면 같은 크림 문틀 + 아래 주황 표시등 줄, 아랫칸 = 앞면 높이의 강철 셔터(세로 홈 · 아래 굽).
    열림: 크림 문기둥 둘만 남고 가운데는 바닥(걷는다) — 칸막이 앞면 그늘이 그대로 이어진다."""
    cr, og, st, ol = P["gy_cream"], P["i2_orange"], P["i2_steel"], C(P, "i2_ol")
    fl = gc.floor(P, "hot")
    im = (gc.under_wall(fl) if part == "f" else fl).copy() if open_ or part == "t" else px.new()   # 닫힌 윗칸도 0행은 바닥 벽돌(투명이면 검은 선, QA-L5 N10)
    if part == "t":
        if not open_:
            px.rect(im, 0, 1, 15, 15, ol); px.rect(im, 1, 2, 14, 15, cr[2]); px.rect(im, 1, 2, 14, 2, cr[3])
            px.rect(im, 2, 13, 13, 14, og[1]); px.rect(im, 2, 13, 13, 13, og[2])
        else:
            for x0 in (0, 13):
                px.rect(im, x0, 1, x0 + 2, 15, ol); px.rect(im, x0 + 1, 2, x0 + 1, 15, cr[2])
    else:
        if not open_:
            im = gc.under_wall(fl).copy()
            px.rect(im, 0, 0, 15, 14, ol)
            px.rect(im, 1, 0, 14, 4, cr[2]); px.rect(im, 1, 5, 14, 5, ol)
            px.rect(im, 1, 6, 14, 12, st[1])
            for x in range(1, 15):
                if x % 3 == 0:
                    px.rect(im, x, 6, x, 12, st[0])
                elif x % 3 == 1:
                    px.rect(im, x, 6, x, 12, st[2])
            px.rect(im, 1, 13, 14, 13, cr[0])
            px.rect(im, 0, 15, 15, 15, _shade(fl.getpixel((0, 15)), gc.SH))
        else:
            for x0 in (0, 13):
                px.rect(im, x0, 0, x0 + 2, 14, ol); px.rect(im, x0 + 1, 0, x0 + 1, 13, cr[1])
    return im


# ---- 얼음 체육관 --------------------------------------------------------------------------------

def ice_hole(P):
    """깨진 얼음(위층, 떨어진 뒤 상태): 칸 가운데 비대칭으로 들쭉날쭉한 검푸른 구멍(북쪽 안 벽 한 톤 밝음) + 둘레 흰 깨진 얼음 테 1px."""
    ic, rk = P["gy_ice"], P["gy_irock"]
    rad = [6.2, 5.0, 6.6, 5.6, 4.6, 6.0, 5.2, 6.4, 5.4, 4.8, 6.2, 5.8]   # 30도마다 반지름(손으로 고른 들쭉날쭉)
    im = px.new()
    for y in range(T):
        for x in range(T):
            dx, dy = x + 0.5 - 8, y + 0.5 - 8.5
            a = (math.degrees(math.atan2(dy, dx)) + 360) % 360
            i = int(a // 30); t = (a % 30) / 30
            r = rad[i] * (1 - t) + rad[(i + 1) % 12] * t
            d = math.hypot(dx, dy * 1.12)
            if d <= r - 1:
                im.putpixel((x, y), rk[1] if dy < -r * 0.45 else rk[0])
            elif d <= r:
                im.putpixel((x, y), ic[3])
    return im



def crystal(P):
    """얼음 결정 조각(1×2, 막힘): 돌 받침 위 세 갈래 육각 결정(밝은 면 · 어두운 면 · 흰 날)."""
    ic, st = P["gy_ice"], P["gy_ist"]
    f = F(1, 2)
    f.r(3, 24, 12, 29, st[1]); f.r(3, 24, 12, 24, st[3]); f.r(3, 29, 12, 29, st[0])
    for cx, top, w in ((8, 3, 3), (4.5, 11, 2), (11.5, 9, 2)):
        for y in range(int(top), 24):
            hw = w if y > top + w else (y - top)
            for x in range(16):
                dx = x + 0.5 - cx
                if abs(dx) <= hw:
                    f.p(x, y, ic[3] if dx < -hw / 3 else ic[2] if dx < hw / 3 else ic[1])
    return f.done(P, floor_y=25)


# ---- 유령 체육관 --------------------------------------------------------------------------------
def ibridge_hidden(P):
    """숨은 다리 자리(낭떠러지 위층, 막힘 — 혼불 문양 이벤트로 나타난다): 어둠 속 희미한 판 모서리 점 넷."""
    ab = P["gy_abyss"]
    im = px.new()
    for x, y in ((2, 3), (13, 3), (2, 12), (13, 12)):
        px.put(im, x, y, ab[2])
    return im


def ibridge(P, d):
    """나타난 다리(낭떠러지 위층, 걷는다): 다리 방향으로 길게 이어진 빛나는 판 세 줄(판 사이 1px 틈으로 어둠이 비친다) · 양옆 빛 테. 가로 줄눈 없음(사다리 오독 방지)."""
    sg, ab = P["gy_sigil"], P["gy_abyss"]
    im = px.new()
    for s_ in range(1, 15):
        k, r = divmod(s_ - 1, 5)
        if r == 4:
            c = ab[1]
        else:
            c = sg[2] if r == 0 else sg[1] if r < 3 else sg[0]
        for t in range(T):
            x, y = (t, s_) if d == "h" else (s_, t)
            im.putpixel((x, y), c)
    return im


def candelabra(P):
    """세 갈래 촛대(위층, 막힘): 칸 폭 12px 받침 + 기둥 + 가로 팔 + 굵은 흰 초 셋(3px) + 보라 혼불."""
    gd, wt, sg = P["i2_gold"], P["i2_white"], P["gy_sigil"]
    f = F(1, 1)
    f.r(3, 13, 12, 14, gd[1]); f.r(7, 9, 8, 12, gd[1])
    f.r(1, 8, 14, 9, gd[1])
    for x in (1, 6, 11):
        f.r(x, 4, x + 3, 8, wt[1]); f.r(x + 1, 4, x + 1, 7, wt[2])
        f.ell(x + 2, 2.2, 1.8, 2.2, sg[1]); f.p(x + 2, 2, sg[2])
    return f.done(P, floor_y=10)


def lamp(P):
    """혼불 등(1×2, 막힘): 검은 쇠 기둥 + 육각 등갓 + 보라 불꽃."""
    gw, sg = P["gy_gwall"], P["gy_sigil"]
    f = F(1, 2)
    f.r(6, 14, 9, 28, gw[0]); f.r(6, 14, 6, 28, gw[2]); f.r(4, 28, 11, 29, gw[1])
    f.r(3, 4, 12, 13, gw[1]); f.r(4, 5, 11, 12, sg[0]); f.ell(8, 9, 2.6, 3.2, sg[1]); f.ell(8, 9.5, 1.2, 1.8, sg[2])
    f.r(2, 2, 13, 3, gw[2]); f.r(5, 1, 10, 1, gw[2])
    return f.done(P, floor_y=26)


# ---- 에스퍼 체육관 -------------------------------------------------------------------------------
def warp(P, on=False):
    """워프 판(바닥 칸, 짝 판으로 옮기는 이동 이벤트 자리): 바닥에 박힌 강철 네모 판 · 시안 겹사각 · 가운데 흰 점. on = 겹사각이 희게 빛난다."""
    im = gc.floor(P, "psy")
    st, ar, ol = P["i2_steel"], P["g2_arc"], C(P, "i2_ol")
    hi = ar[2] if on else ar[1]
    px.rect(im, 1, 1, 14, 14, ol); px.rect(im, 2, 2, 13, 13, st[1]); px.rect(im, 2, 2, 13, 2, st[2])
    px.rect(im, 3, 3, 12, 12, ar[0]); px.rect(im, 4, 4, 11, 11, hi); px.rect(im, 5, 5, 10, 10, ar[0])
    px.rect(im, 6, 6, 9, 9, hi); px.rect(im, 7, 7, 8, 8, ar[2])
    return im


def orb(P):
    """수정 구슬(1×2, 막힘): 금 받침대 + 분홍빛 구슬(사선 반사 · 아래 진한 톤)."""
    gd, pf = P["i2_gold"], P["gy_psyface"]
    f = F(1, 2)
    f.r(5, 20, 10, 27, gd[0]); f.r(5, 20, 5, 27, gd[1]); f.r(3, 27, 12, 29, gd[0]); f.r(3, 27, 12, 27, gd[1])
    f.ell(8, 13, 6, 6, pf[1]); f.ell(8, 14.5, 5, 4, pf[0]); f.ell(8, 12, 4.6, 4.2, pf[1]); f.ell(6, 10.5, 2, 1.6, pf[2])
    f.p(5, 10, P["i2_white"][2])
    return f.done(P, floor_y=24)


# ---- 풀·벌레 체육관 -------------------------------------------------------------------------------
def turn(P, part: str):
    """회전문(위층, 막힘 — 직각 방향에서 밀면 90도 도는 이벤트, 검방울 문법).
    pivot = 위에서 본 작은 회색 쇠기둥 머리(원작 회전문 축 — 흰 원판·노란 심을 두면 달걀 프라이·데이지로 읽혔다, I2 Y8), h/v = 초록 테 안에 흰 마디 넷이 이어진 가는 막대 팔 + 바깥 끝 반원 화살 무늬."""
    lf, wt, gd = P["gy_hedge"], P["i2_white"], P["i2_gold"]
    f = F(1, 1)
    if part in ("pivot", "pivot_v"):
        # 축 양옆에 팔과 같은 줄무늬 토막(팔 칸 끝 → 축 공까지) — 팔이 축에서 3~4px 떨어져 떠 보였다(I3 Z5). pivot = 팔 가로 · pivot_v = 팔 세로.
        st = P["i2_steel"]
        vert = part == "pivot_v"
        put = (lambda x, y, c: f.p(y, x, c)) if vert else f.p
        for x in list(range(0, 5)) + list(range(11, 16)):
            for y in range(6, 11):
                put(x, y, lf[1] if 7 <= y <= 9 else lf[2])
            if x in (1, 2, 13, 14):
                for y in (7, 8, 9):
                    put(x, y, wt[1])
        f.ell(8, 8.6, 4.4, 4.2, st[0]); f.ell(8, 8.0, 3.6, 3.4, st[1]); f.ell(7.2, 7.2, 1.8, 1.5, st[2]); f.p(6, 6, st[2])
        f.r(7, 8, 8, 9, st[0])                                   # 축 구멍(팔이 끼는 자리) — 작고 어둡게
        im = f.done(P, floor_y=10)
        for e in (0, 15):                                          # 팔 칸과 맞닿는 칸 끝은 윤곽을 빼고 줄무늬를 잇는다(이음매 = 팔 칸 끝 윤곽 1px)
            for y in (7, 8, 9):
                im.putpixel((y, e) if vert else (e, y), lf[1])
        return im
    # 팔 — 바깥 끝(축 반대쪽)에 끝 기둥(반원 화살 발)을 단다. h = 동쪽 끝(축 오른쪽 팔) · h_w = 서쪽 끝(축 왼쪽 팔) ·
    # v = 남쪽 끝(축 아래 팔) · v_n = 북쪽 끝(축 위 팔). 한 칸을 양쪽에 같이 쓰면 바깥 한 끝에 기둥이 없었다(I4 W3).
    # 세로 팔은 가로 팔을 돌리지 않고 따로 그린다 — 돌리면 그림자까지 돌아 팔 왼쪽에 졌다(I4 W2). 그림자는 done() 이 모양 뒤에
    # 오른쪽 2px·아래 3px 로 붙인다(축 gy_turn_pivot_v 와 같은 방향). 남쪽 끝 팔은 발 밑 그림자가 칸 안에 들게 막대를 12행에서 끝낸다.
    if part in ("h", "h_w"):
        east = part == "h"
        f.r(0, 6, 15, 10, lf[1])
        for k in range(4):
            x0 = 1 + k * 4 if east else 13 - k * 4
            f.r(x0, 7, x0 + 1, 9, wt[1]); f.p(x0, 7, wt[2])
        f.r(0, 6, 15, 6, lf[2])                                   # 윗변 밝은 줄(왼쪽 위 빛)
        ce, co = (14, 15) if east else (1, 0)
        for y in (4, 5, 11, 12):                                  # 끝 반원 화살(돌아가는 방향 표시) = 끝 기둥 발
            f.p(ce, y, lf[0])
        f.p(co, 4, lf[0]); f.p(co, 12, lf[0])
        return f.done(P, floor_y=8)
    south = part == "v"
    y1 = 12 if south else 15                                      # 남쪽 끝 팔은 12행에서 끝(발 밑 3px 그림자가 칸 안)
    f.r(6, 0, 10, y1, lf[1])
    for k in range(4):                                            # 흰 마디 — 가로 팔과 같은 4px 간격(축 칸 토막의 마디와 이어진다)
        y0 = 1 + k * 4 if south else 13 - k * 4
        if not south or y0 + 1 <= y1 - 2:          # 남쪽 끝 팔은 발 자리(11~12행) 앞까지만
            f.r(7, y0, 9, y0 + 1, wt[1]); f.p(7, y0, wt[2])
    f.r(6, 0, 6, y1, lf[2])                                       # 왼변 밝은 줄(왼쪽 위 빛)
    ce, co = (y1 - 1, y1) if south else (1, 0)
    for x in (4, 5, 11, 12):
        f.p(x, ce, lf[0])
    f.p(4, co, lf[0]); f.p(12, co, lf[0])
    return f.done(P, floor_y=0)


def pot(P):
    """꽃 화분(1×1, 막힘): 붉은 토분 + 분홍 꽃 덩이."""
    wd, fl, lf = P["i2_orange"], P["i2_c_flower"], P["gy_hedge"]
    f = F(1, 1)
    f.r(4, 9, 11, 14, wd[1]); f.r(4, 9, 11, 9, wd[2]); f.r(5, 14, 10, 14, wd[0])
    f.ell(8, 6, 5, 3.6, lf[2]); f.ell(6, 5, 2, 1.6, fl[0]); f.ell(10, 5.5, 2, 1.6, fl[0]); f.p(6, 4, fl[1]); f.p(10, 5, fl[1]); f.ell(8, 3.4, 1.6, 1.2, fl[1])
    return f.done(P, floor_y=8)


# ---- 격투 도장 ----------------------------------------------------------------------------------
def scroll(P):
    """족자(1×2 캔버스, 뒷벽 위): 위·아래 나무 축 · 흰 종이 · 먹 글씨(굵은 획 세 개)."""
    wd, wt, ol = P["i2_wood"], P["i2_white"], C(P, "i2_ol")
    f = F(1, 2)
    f.r(3, 4, 12, 26, wt[2]); f.r(3, 4, 3, 26, wt[1]); f.r(12, 4, 12, 26, wt[0])
    f.r(2, 3, 13, 4, wd[1]); f.r(2, 26, 13, 27, wd[1]); f.r(7, 1, 8, 2, wd[0])
    for x0, y0, x1, y1 in ((6, 8, 9, 8), (7, 9, 7, 15), (5, 13, 10, 17), (6, 19, 9, 22), (8, 20, 8, 23)):
        f.line(x0, y0, x1, y1, ol)
    return f.done(P, shadow=False)


def sandbag(P):
    """샌드백(1×2, 막힘): 천장 사슬 · 가죽 원통(밝은 왼쪽 · 가운데 띠 둘) · 아래 둥근 바닥."""
    cd, st = P["i2_card"], P["i2_steel"]
    f = F(1, 2)
    f.r(7, 0, 8, 5, st[1]); f.p(7, 1, st[2]); f.p(8, 3, st[0])
    f.r(3, 6, 12, 26, cd[1]); f.ell(8, 26, 4.6, 2.4, cd[1]); f.r(3, 6, 12, 7, cd[2]); f.r(4, 8, 4, 25, cd[2]); f.r(11, 8, 12, 25, cd[0])
    f.r(3, 11, 12, 12, P["i2_red"][0]); f.r(3, 20, 12, 21, P["i2_red"][0])
    return f.done(P, floor_y=26)


def boards(P, broken=False):
    """격파 판(1×1). 막힘 = 칸 폭의 3분의 1씩 되는 넓은 회색 받침돌 두 개 위에 나무 판 세 장 — 윗면 + 앞면에 판 세 겹의 두께가 보이고 가운데 세로 금(격파 이벤트로 깬다).
    깨진 뒤(걷는다) = 낮은 받침돌(윗면 2줄) 위에 바깥쪽으로 기운 판 반쪽 둘(쪼개진 끝 톱니) + 틈 바닥의 크림 부스러기."""
    wd, st, ol = P["gy_wood"], P["g2_stone"], C(P, "i2_ol")
    f = F(1, 1)
    for x0 in (0, 10):
        f.r(x0, 9, x0 + 5, 14, st[1]); f.r(x0, 9, x0 + 5, 9, st[3]); f.r(x0, 13, x0 + 5, 14, st[0])
    if not broken:
        f.r(0, 2, 15, 5, wd[3]); f.r(0, 2, 15, 2, P["i2_white"][1])
        for k in range(3):
            y = 6 + k
            f.r(0, y, 15, y, wd[1] if k % 2 == 0 else wd[2])
        f.r(0, 9, 15, 9, wd[0])
        for x, y in ((8, 2), (7, 3), (8, 4), (8, 5), (7, 6), (8, 7), (7, 8), (8, 9)):
            f.p(x, y, ol)
        return f.done(P, floor_y=8)
    # 깨진 뒤: 판 반쪽 둘이 화면의 주인 — 받침돌은 낮게 가라앉아 윗면 2줄만 보이고(회색 두 덩이 + 가운데 조각이 아령으로 읽혔다, I3 Z9),
    # 크림 판 반쪽(7×5, 최암 윤곽)이 각 받침 위에서 바깥쪽으로 기운다(쪼개진 안쪽 끝이 1px 들린다). 쪼개진 끝은 윗면·앞면 두 톱니,
    # 두 반쪽 사이 틈으로 바닥이 보이고 거기 크림 부스러기 셋. 윤곽은 손으로 둔다(자동 윤곽은 비탈 판을 실처럼 깎았다).
    half = {                        # 왼쪽 반쪽 x0..6 (오른쪽은 좌우 거울). o 윤곽 · W 윗면 · m/d 앞면 · . 비움
        7: "...ooo.",
        8: "oooWWWo",
        9: "oWWWWWW",                   # 끝 W = 쪼개진 윗면 톱니
        10: "oWWmmmo",
        11: "ommdddd",                  # 끝 d = 쪼개진 앞면 톱니
        12: "ooooooo",
    }
    col = {"o": C(P, "i2_ol"), "W": wd[3], "m": wd[2], "d": wd[1]}
    fs = F(1, 1)
    for x0 in (0, 11):
        fs.r(x0, 12, x0 + 4, 15, st[1]); fs.r(x0 + 1, 13, x0 + 3, 13, st[2])   # 받침 윗면 빛은 한 단만(밝은 회색 줄이 눈에 띄면 받침이 다시 주인이 된다)
    im = fs.done(P, floor_y=8)
    for y, row in half.items():
        for i, ch in enumerate(row):
            if ch != ".":
                im.putpixel((i, y), col[ch]); im.putpixel((15 - i, y), col[ch])
    for y in range(8, 13):                                          # 쪼개진 틈: 들린 끝 밑 그늘(바닥 결과 판이 이어져 보이지 않게)
        for x in (7, 8):
            im.putpixel((x, y), SHADOW)
    for x, y, c in ((7, 14, wd[3]), (8, 13, wd[3]), (6, 15, wd[2]), (9, 15, wd[3])):   # 부스러기(윤곽 없이 바닥 위)
        im.putpixel((x, y), c)
    return im


def light_mask(m: int) -> int:
    """빛 이웃 마스크 정규화: 대각 빛은 그 옆 두 변이 모두 어두울 때만 센다(옆 변이 밝으면 그 변의 경사가 이긴다)."""
    from px import N, E, S, W, NE, SE, SW, NW
    out = m & (N | E | S | W)
    for d, a, b in ((NE, N, E), (SE, S, E), (SW, S, W), (NW, N, W)):
        if m & d and not m & (a | b):
            out |= d
    return out


LIGHT_MASKS = sorted({light_mask(m) for m in range(256)})


def dark_light(m: int, amax: int = 240, a0: int = 40, span: float = 14):
    """어둠 덮개(바닥 위층, 무로식): 빛이 드는 이웃(m 비트 = 밝은 이웃 칸) 쪽에서 픽셀 거리로 알파가 a0 → amax 로 올라간다.
    span = 번짐 깊이(px) — 맵은 입구·출구 둘레만 깊게(14), 나머지 둘레는 칸 해시로 3·5px 를 섞어 곧은 띠를 깬다. 알파는 4단(40·100·170·240)을 2×2 순서 디더로 섞는다 — 칸 단위 네모 조각이 아니라 칸 안에서 번지는 빛 가장자리(QA-L1 N4). m=0 은 온 어둠."""
    from px import N, E, S, W, NE, SE, SW, NW
    lv = [a0, 100, 170, amax]
    bay = [[0.125, 0.625], [0.875, 0.375]]
    im = px.new()
    for y in range(T):
        for x in range(T):
            ts = []
            if m & N: ts.append(y + 0.5)
            if m & S: ts.append(T - y - 0.5)
            if m & W: ts.append(x + 0.5)
            if m & E: ts.append(T - x - 0.5)
            if m & NE: ts.append(math.hypot(T - x - 0.5, y + 0.5))
            if m & SE: ts.append(math.hypot(T - x - 0.5, T - y - 0.5))
            if m & SW: ts.append(math.hypot(x + 0.5, T - y - 0.5))
            if m & NW: ts.append(math.hypot(x + 0.5, y + 0.5))
            u = min(1.0, max(0.0, (min(ts) - 0.5) / span)) if ts else 1.0
            q = u * 3
            i = min(2, int(q))
            a = lv[i + 1] if q - i > bay[y % 2][x % 2] else lv[i]
            im.putpixel((x, y), (8, 6, 16, a))
    return im


def dark(alpha):
    """단색 반투명 덮개(옛 어둠 — 지금 맵은 dark_light 를 쓴다)."""
    im = px.new()
    px.rect(im, 0, 0, 15, 15, (8, 6, 16, alpha))
    return im


# ---- 드래곤 체육관 ------------------------------------------------------------------------------
def dragon(P):
    """용 석상(2×3, 막힘): 받침 단 위에 앉은 용 — 뒤로 휜 굵은 뿔 둘 · 긴 목에 비늘 줄 · 몸 양옆 접은 날개(뼈대 셋) · 붉은 눈. 청록 돌 4톤."""
    dr, st, rd = P["gy_dragon"], P["gy_slab"], P["i2_red"]
    f = F(2, 3)
    f.r(2, 36, 29, 45, st[2]); f.r(2, 36, 29, 37, st[3]); f.r(2, 44, 29, 45, st[0]); f.r(2, 38, 2, 43, st[3])
    for sx in (-1, 1):                                            # 날개: 어깨에서 위·바깥 끝으로 솟고 아래 변이 물결(박쥐 날개)인 막 + 뼈대 셋
        tip = (16 + sx * 15, 5); sh_ = (16 + sx * 4, 20)
        for y in range(4, 32):
            for x in range(32):
                u = (x + 0.5 - sh_[0]) * sx
                if u < 0:
                    continue
                top = sh_[1] + (tip[1] - sh_[1]) * min(1, u / 11)          # 위 변: 어깨 → 끝
                scal = 26 - u * 0.7 + 2.2 * abs(math.sin(u * math.pi / 4))  # 아래 변: 물결
                if u <= 12 and top <= y + 0.5 <= scal:
                    f.p(x, y, dr[1])
        for k in range(3):
            f.line(sh_[0], sh_[1], round(16 + sx * (15 - k * 4)), 5 + k * 6, dr[0])
    _blob(f, 16, 29, 9.5, 7.5, dr)                                # 몸
    _blob(f, 16, 18, 3.8, 7.5, dr)                                # 목
    for y in range(13, 25, 3):                                    # 목 비늘 줄
        f.r(14, y, 17, y, dr[1])
    _blob(f, 16, 9.5, 5.6, 4.4, dr)                               # 머리
    _blob(f, 16, 13, 3.4, 2.2, dr)                                # 주둥이
    for sx in (-1, 1):                                            # 뒤로 휜 굵은 뿔
        for k in range(6):
            x = 16 + sx * (3 + k); y = 6 - k * 0.8 + (k * k) * 0.12
            f.r(round(x) - (sx < 0), round(y), round(x) + (sx > 0) * 0, round(y) + 1, dr[2] if k < 4 else dr[3])
    f.p(13, 9, rd[1]); f.p(19, 9, rd[1]); f.p(13, 10, rd[0]); f.p(19, 10, rd[0])
    return f.done(P, floor_y=38)


def lava_fill(P):
    """용암에 빠진 바위(위층, 걷는다): 밀어 넣은 g2_boulder 가 용암 높이로 칸을 거의 채우며 평평하게 박힌 윗면 — 좌우·아래 1px 용암 빛 테만 남는다
    (작은 돌이면 징검돌로 읽혔다, I1 X9). 판판한 윗면 한 톤 · 위 1px 밝은 모서리 · 갈래 금 두 줄."""
    bs, lv = P["g2_stone"], P["dg_lava"]
    im = px.new()
    for y in range(1, T):
        for x in range(T):
            cut = (x in (0, 15) and y in (1, 15)) or (x in (0, 15) and y in (2, 14) and False)
            if x in (0, 15) or y in (1, 15):
                # 네 변 모두 뜨거운 테 1px: 왼쪽·위 = 주황, 오른쪽·아래 = 노랑(왼쪽 위가 점 둘뿐이라 비대칭이었다, I3 Z10)
                im.putpixel((x, y), lv[3] if (x == 15 or y == 15) else lv[2])
            elif (x, y) in ((1, 1), (14, 1), (1, 14), (14, 14)):
                im.putpixel((x, y), lv[1])
            else:
                im.putpixel((x, y), bs[3] if y == 2 else bs[2] if y <= 6 else bs[1])
    # 금: 불규칙한 갈래 금 두 줄(곡선 하나는 「C」 글자로 읽혔다, I2 Y9) — 위 왼쪽에서 비스듬히 내려가다 갈라지는 금 + 오른쪽 아래 짧은 금
    for x, y in ((4, 4), (5, 5), (5, 6), (6, 7), (7, 7), (7, 8), (8, 9), (6, 8), (5, 9), (11, 10), (12, 11), (12, 12)):
        im.putpixel((x, y), bs[0])
    for x, y in ((5, 4), (6, 6), (8, 8), (12, 10)):                     # 금 위쪽 밝은 1px(깨진 모서리)
        im.putpixel((x, y), bs[3])
    return im


def lbridge(P, d):
    """용암 위 돌다리(위층, 걷는다): 양옆 난간(1px 밝은 위 · 기둥 8px 마다) · 다리 방향으로 이어진 판 줄눈 둘(가로 줄눈 없음 — 사다리·선로 오독 방지)."""
    sl, ol = P["gy_slab"], C(P, "i2_ol")
    im = px.new()
    for t in range(T):
        for s in range(T):
            if s in (0, 15):
                c = ol
            elif s in (1, 14):
                c = sl[0] if t % 8 in (0, 1) else sl[3]
            elif s in (2, 13):
                c = sl[0]
            else:
                c = sl[0] if s in (6, 10) else sl[3] if s == 3 else sl[2]
            x, y = (t, s) if d == "h" else (s, t)
            im.putpixel((x, y), c)
    return im
