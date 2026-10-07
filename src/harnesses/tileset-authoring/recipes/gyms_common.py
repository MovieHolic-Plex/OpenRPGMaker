"""체육관 공용 조각 — 바닥 10벌·뒷벽 8벌·관마다 다른 칸막이 앞면·생울타리(나무 줄)·노랑시티식 방 벽·바닥 오토타일(물·용암·낭떠러지·얼음판).

칠하는 문법(에디터 조수용):
- 방 뼈대: 맨 위 두 줄 = 뒷벽(gy_wall_<관>_up/dn, 양 끝 _l/_r) · 맨 왼쪽/오른쪽 열 = i2_edge_r/l · 맨 아래 줄 = i2_edge_t(모서리 _rt/_lt) ·
  아래 줄 가운데 = g2_edge_mat 와 그 위 gy_mat_<바닥>. 뒷벽 바로 아래 바닥 줄은 gy_fl_<바닥>_s(한 톤 그늘).
- 바닥: gy_fl_<바닥>0/1 을 (x+y)%2 로 번갈아 깐다. 칸막이 바로 아래 칸은 _s, 칸막이 바로 동쪽은 _e(곧은 4px 그늘), 둘 다면 _se.
- 올린 칸막이(gy_pb_fire/ice/dojo, gy_hedge): 칸막이 그룹을 칠하면 엔진 오토타일이 윗면/앞면을 고른다. 가로 칸막이는 두 줄(윗면 + 앞면), 세로 팔은 한 칸 폭.
  관마다 앞면이 다르다 — 불: 크림 기둥 + 붉은 띠(용암마을) · 얼음: 서리 방울 진 하늘색 · 도장: 진갈색 세로 널. 풀관은 같은 모양의 「한 칸 한 그루」 나무 줄.
- 에스퍼 방 벽(노랑시티): 방마다 자기 뒷벽 두 줄(gy_wall_psy_up/dn) · 방 사이 세로 벽은 gy_psyv(한 칸, 흰 윗면 + 오른쪽 연보라 옆면의 솟은 얇은 벽), 벽 줄을 지나는 자리는 gy_psyv_up/dn(같은 벽이 방 벽 위로 이어진다), 아래가 바닥인 남쪽 끝은 gy_psyv_s(앞면).
- 넓은 막힘 바닥(gy_pool 물 · gy_lava 용암 · gy_abyss 낭떠러지)은 47변형 + 4프레임. 둑 바깥 픽셀은 이웃 걷는 바닥(크림 판 · 큰 판석 · 유령 판석)과 이어진다.
  셋 다 「북쪽 변이 열린 칸」에 걷는 바닥의 앞면(두께)이 보인다 — 물은 물속 벽, 용암은 현무암 단면, 낭떠러지는 판석 단면. 즉 길은 솟아 있고 물·용암·어둠은 낮다.
- 얼음판(gy_ice, 미끄럼)은 칸마다 1px 테가 있어 미끄러질 칸 수를 셀 수 있고, 북쪽 첫 줄에 칸막이 그늘 띠가 내려앉는다.
gym2 의 함수는 import 만 한다(공유 파일 수정 금지)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, NW, SE, SW, T  # noqa: E402
import gym2 as g2  # noqa: E402
from interior2 import F, C, SHADOW, _shade  # noqa: E402

SH = 0.84                                   # 벽 아래·칸막이 앞 그늘(본 시트와 같은 한 톤)


def from_fn(fn):
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), fn(x, y))
    return im


# ---- 바닥(16 주기 — 오토타일 바깥 픽셀이 이웃 바닥 칸과 이어진다) -------------------------------------
def floor(P, kind: str, v: int = 0):
    if kind == "deck":                       # 수영장 바닥: 8px 네모 타일 · 진한 줄눈 1px · 타일 왼쪽 위 밝은 ㄱ
        g, b, l, hi = P["gy_deck"]
        def f(x, y):
            if x % 8 == 7 or y % 8 == 7:
                return g
            if (x % 8 == 0 or y % 8 == 0) and not (v and (x // 8, y // 8) == [(0, 0), (1, 0), (0, 1), (1, 1)][v % 4]):
                return l
            return b
        return from_fn(f)
    if kind == "rim":                        # 수영장 둘레·물 위 길: 무늬 없는 크림 타일 · 16px 마다 옅은 줄눈 1px · 왼쪽 위 밝은 ㄱ
        d, g, b, l = P["gy_rim"]
        im = from_fn(lambda x, y: g if (x == 15 or y == 15) else l if (x == 0 or y == 0) else b)
        for (ax, ay) in [(), ((9, 6),), ((4, 10),), ((12, 3),)][v % 4]:   # 변형: 가는 금 2px — 변형마다 다른 자리(격자 방지)
            px.put(im, ax, ay, g); px.put(im, ax + 1, ay + 1, g)
        return im
    if kind == "hot":                        # 불관 벽돌 포장(용암마을 1층): 8×4 벽돌 엇갈림 · 줄눈 한 톤 · 벽돌 위 밝은 줄 · 조용히
        mo, b, l, hi = P["gy_hot"]
        def f(x, y):
            row = y // 4
            if y % 4 == 3 or (x + (4 if row % 2 else 0)) % 8 == 7:
                return mo
            if y % 4 == 0:
                return l
            lit = (row, (x + (4 if row % 2 else 0)) // 8) == [None, (1, 0), (3, 1), (2, 1)][v % 4]
            return hi if lit else b
        return from_fn(f)
    if kind == "ist":                        # 얼음관 돌 바닥: 16px 흰 판 + 연보라 마름모 테(소토폴리스 문법)
        d, b, l, hi = P["gy_ist"]
        def f(x, y):
            dd = abs(x - 7.5) + abs(y - 7.5)
            if x == 15 or y == 15:
                return d
            if 4.5 < dd < 6:
                return b
            return hi if dd <= 4.5 and v % 2 == 0 else l
        return from_fn(f)
    if kind == "gst":                        # 유령관 판석: 8×8 어긋난 돌 · 진한 줄눈 · 돌 위쪽 밝은 줄
        g, b, l, hi = P["gy_gst"]
        def f(x, y):
            off = 4 if (y // 8) % 2 else 0
            if y % 8 == 7 or (x + off) % 8 == 7:
                return g
            if y % 8 == 0:
                return l
            return b
        im = from_fn(f)
        for ax, ay in [(), ((9, 3), (2, 12)), ((4, 11), (13, 2)), ((11, 13),)][v % 4]:
            px.put(im, ax, ay, l); px.put(im, ax + 1, ay, l)
        return im
    if kind == "psy":                        # 에스퍼관: 가로 널 줄무늬(4px 주기) + 8px 어긋난 이음(노랑시티)
        d, b, l, hi = P["gy_psy"]
        def f(x, y):
            k = y % 4
            if k == 3:
                return d
            if k == 0:
                return l
            if (x + (y // 4) * 5) % 16 == 0:
                return d
            return b
        return from_fn(f)
    if kind == "turf":                       # 풀관 바닥 = 본 시트 풀(monster_overworld.grass_tex) 그대로 — 실내라도 같은 풀(통합 검수 I1 X6)
        import monster_overworld as mo
        return mo.grass_tex(P, v % 4)
    if kind == "wood":                       # 도장 마루(노랑시티 도장): 가로 널 4px · 널 사이 한 톤 줄 · 엇갈린 이음 · 결 표시는 성기게
        d, b, l, hi = P["gy_wood"]
        def f(x, y):
            k = y % 4
            if k == 3:
                return d
            if (x + (y // 4) * 6) % 16 == 0:
                return d
            return l if k == 0 else b
        im = from_fn(f)
        for ax, ay in [(), ((5, 6),), ((11, 10),), ((2, 13), (13, 1))][v % 4]:   # 옹이: 변형마다 다른 자리
            px.put(im, ax, ay, d); px.put(im, ax + 1, ay, l)
        return im
    if kind == "tatami":                     # 다다미: 16px 한 장 · 위·왼쪽 진한 테 1px(이웃과 격자) · 가로 짜임 2px 주기
        d, b, l, hi = P["gy_tatami"]
        def f(x, y):
            if x == 0 or y == 0:
                return d
            if x == 1 or y == 1:
                return hi
            return l if (y % 2 == 0) ^ (v % 2 == 1) else b
        return from_fn(f)
    if kind == "bas":                        # 용관 바닥 큰 판석(뒷벽 현무암 벽돌과 다른 재료): 16px 판 · 진한 줄눈 · 왼쪽 위 밝은 테
        g, b, l, hi = P["gy_slab"]
        im = from_fn(lambda x, y: g if (x == 15 or y == 15) else hi if (x == 0 or y == 0) else b)
        for ax, ay in [(), ((6, 9), (11, 4)), ((3, 4), (10, 11)), ((8, 6),)][v % 4]:
            px.put(im, ax, ay, l); px.put(im, ax + 1, ay, l)
        return im
    raise KeyError(kind)


def under_wall(im):
    return g2.under_wall(im)


def east_shadow(im, top=False):
    """칸막이·세로 벽 바로 동쪽 바닥: 왼쪽 4px 곧은 그늘 띠(칸마다 같은 폭 — 계단처럼 끊기지 않는다). top 이면 위 8px 도."""
    out = im.copy()
    for y in range(T):
        for x in range(T):
            if x < 4 or (top and y < 8):
                out.putpixel((x, y), _shade(im.getpixel((x, y)), SH))
    return out


def mat(P, kind: str):
    """입구 파란 유리 매트(본 시트 g2_mat 과 같은 그림) — 그 체육관 바닥 위."""
    im = floor(P, kind)
    gl = P["i2_glass"]
    px.rect(im, 1, 4, 14, 14, C(P, "i2_ol")); px.rect(im, 2, 5, 13, 13, gl[1])
    for y in (6, 8, 10, 12):
        px.rect(im, 3, y, 12, y, gl[0])
    px.rect(im, 3, 5, 6, 5, gl[2])
    return im


# ---- 뒷벽(32px 세로 띠) -----------------------------------------------------------------------------
def _col(P, style):
    ce, ol = P["i2_ceil"], C(P, "i2_ol")
    def head(Y):
        return ce[1] if Y <= 1 else ce[0] if Y == 2 else None
    if style == "pool":                      # 블루관: 크림 가로 줄무늬 · 파란 걸레받이(수영장 타일)
        w, dk = P["gy_wpool"], P["gy_deck"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 24: return w[0] if (Y - 3) % 4 == 3 else w[2] if (Y - 3) % 4 == 0 else w[1]
            if Y == 25: return ol
            if Y <= 29: return dk[2] if Y == 26 else dk[0] if x % 8 == 7 else dk[1]
            if Y == 30: return dk[0]
            return ol
    elif style == "fire":                    # 불관: 위 불꽃 프리즈(8px 주기) · 붉은 벽돌 · 크림 걸레받이
        br, fl = P["gy_brick"], P["i2_orange"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 9:
                k = x % 8
                h = 9 - (3 - abs(k - 3.5)) * 1.6
                return fl[2] if Y >= h + 2 else fl[1] if Y >= h else br[0]
            if Y == 10: return ol
            if Y <= 27:
                r = (Y - 11) // 4
                if (Y - 11) % 4 == 3 or (x + (r % 2) * 4) % 8 == 7:
                    return br[0]
                return br[2] if (Y - 11) % 4 == 0 else br[1]
            if Y <= 30: return br[0] if Y == 30 else P["gy_cream"][0]
            return ol
    elif style == "ice":                     # 얼음관: 연보라 벽 위로 고드름 · 아래 얼음 띠
        ic, st = P["gy_ice"], P["gy_ist"]
        def col(x, Y):
            if head(Y): return head(Y)
            k = x % 8
            drip = 3 + [5, 3, 1, 4, 6, 2, 1, 3][k]
            if Y <= drip: return ic[3] if Y <= 4 else ic[2]
            if Y <= 24: return st[1] if (x % 8 == 0) else st[2]
            if Y == 25: return ol
            if Y <= 29: return ic[1] if Y == 26 else ic[0]
            if Y == 30: return st[0]
            return ol
    elif style == "ghost":                   # 유령관: 어두운 세로 널 · 보라 몰딩 · 검은 걸레받이
        gw = P["gy_gwall"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 5: return gw[3] if Y == 3 else gw[2]
            if Y == 6: return ol
            if Y <= 27: return gw[0] if x % 8 == 7 else gw[2] if x % 8 == 0 else gw[1]
            if Y <= 30: return gw[0]
            return ol
    elif style == "psy":                     # 에스퍼관(노랑시티 방 벽): 연보라 판넬 · 주황 굽 · 짙은 걸레받이
        lv, org = P["g2_lav"], P["i2_orange"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 22: return lv[3] if Y == 3 else lv[2] if x % 4 else lv[1]
            if Y == 23: return ol
            if Y <= 26: return org[2] if Y == 24 else org[1]
            if Y <= 30: return lv[0] if Y == 30 else lv[1]
            return ol
    elif style == "grass":                   # 풀관(무지개시티 문법): 연분홍 벽 · 위 흰 물결 · 아래 분홍 띠
        pk, wt = P["pink"], P["i2_white"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 5:
                return wt[1] if Y < 4 + (1 if x % 8 < 4 else 0) else pk[2]
            if Y <= 24: return pk[2] if (x % 8) else pk[1]
            if Y == 25: return ol
            if Y <= 29: return pk[0] if Y == 29 else pk[1]
            if Y == 30: return pk[0]
            return ol
    elif style == "dojo":                    # 도장: 연두 회벽(위) · 나무 걸레받이 널(아래)
        pl, wd = P["gy_plaster"], P["gy_wood"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 4: return wd[1] if Y == 4 else wd[2]
            if Y <= 19: return pl[2] if Y == 5 else pl[1] if (x * 3 + Y * 5) % 23 else pl[0]
            if Y == 20: return wd[0]
            if Y <= 29: return wd[0] if x % 8 == 7 else wd[2] if Y == 21 else wd[1]
            if Y == 30: return wd[0]
            return ol
    elif style == "dragon":                  # 용관: 현무암 큰 벽돌 · 붉은 띠 · 진한 굽(바닥 판석과 다른 재료)
        bs, dw = P["gy_bas"], P["gy_dwall"]
        def col(x, Y):
            if head(Y): return head(Y)
            if Y <= 6: return dw[2] if Y == 3 else dw[1] if (x % 8) < 6 else dw[0]
            if Y == 7: return ol
            if Y <= 26:
                r = (Y - 8) // 7
                if (Y - 8) % 7 == 6 or (x + (r % 2) * 8) % 16 == 15:
                    return bs[0]
                return bs[2] if (Y - 8) % 7 == 0 else bs[1]
            if Y <= 29: return dw[2] if Y == 27 else dw[1]
            if Y == 30: return bs[0]
            return ol
    else:
        raise KeyError(style)
    return col


def wall(P, style, part):
    col = _col(P, style)
    y0 = 0 if part == "up" else T
    return from_fn(lambda x, y: col(x, y0 + y))


def corner_wall(P, style, part, side):
    im = wall(P, style, part)
    x = 0 if side == "l" else T - 1
    for y in range(T):
        im.putpixel((x, y), C(P, "i2_ol"))
    return im


# ---- 노랑시티식 방 벽 조각 -----------------------------------------------------------------------
def psy_vwall(P, part: str):
    """방 사이 세로 벽(막힘, 노랑시티) — 방 벽 줄과 같은 높이로 솟은 얇은 벽을 위에서 본 3/4 꼴(I4 W8: 가운데 남색이 홈으로 읽혔다).
    열 구성(body·기둥 공통, 위가 윗면): x1 외곽선 · x2 흰 빛 테(왼쪽 위 빛) · x3~9 흰 윗면(가로 방 벽 천장 띠와 같은 흰 재료) ·
    x10 윗면 오른쪽 그늘 1px · x11 외곽선(윗면 모서리) · x12~13 오른쪽 옆면(가로 방 벽 앞면과 같은 연보라, 빛 반대쪽이라 한 단 어둡게) · x14 외곽선.
    동쪽 바닥은 맵에서 _e 그늘(오른쪽 아래로 지는 그림자). up/dn = 방 벽 두 줄을 지나는 자리 — 같은 열 구성이 천장 띠(0~2행) 아래로 이어진다(굽 띠로 끊지 않는다).
    s = 아래가 바닥인 남쪽 끝: 윗면 끝(6행 외곽선) 아래에 가로 방 벽과 같은 앞면(연보라 판넬 · 주황 굽 · 짙은 걸레받이)."""
    wt, lv, org, ol = P["i2_white"], P["g2_lav"], P["i2_orange"], C(P, "i2_ol")
    def col(x, y):
        if x in (1, 11, 14):
            return ol
        if x == 2:
            return wt[2]
        if x <= 9:
            return wt[1]
        if x == 10:
            return wt[0]
        return lv[1] if x == 12 else lv[0]                    # 옆면: 빛 반대쪽 — 바깥으로 한 단 더 어둡게(줄눈 점은 난간 리벳처럼 보여 뺐다)
    def front(x, y):                                       # 남쪽 끝 앞면(7~15행) — 가로 방 벽 col(_col "psy") 의 축소판
        if x in (1, 14) or y in (6, 15):
            return ol
        if y == 7:
            return lv[3]
        if y <= 10:
            return lv[2] if x % 4 else lv[1]
        if y == 11:
            return ol
        if y <= 13:
            return org[2] if y == 12 else org[1]
        return lv[0]
    if part in ("body", "s"):
        im = floor(P, "psy")
        for y in range(T):
            for x in range(1, 15):
                im.putpixel((x, y), front(x, y) if part == "s" and y >= 6 else col(x, y))
        return im
    im = wall(P, "psy", part)
    y0 = 0 if part == "up" else T
    for y in range(T):
        if y0 + y <= 2:                                    # 천장 띠는 가로 벽 그대로(벽 윗면이 같은 높이)
            continue
        for x in range(1, 15):
            im.putpixel((x, y), col(x, y0 + y))
    return im


# ---- 올린 칸막이(gym2 모양, 관마다 다른 앞면) ---------------------------------------------------------
_SENT = [(1, 2, 3, 255), (4, 5, 6, 255)]


def block(P, m: int, top: str, face_fn, floor_im):
    """gym2.block_cell 의 모양(윗면·처마턱·앞면·굽)을 그대로 쓰고 앞면 본체만 face_fn(x, y, 첫줄?) 로 다시 칠한다.
    앞면 본체 픽셀은 표지 색으로 그려 받아 찾는다 — 모양 계산은 gym2 하나뿐이다."""
    P2 = dict(P)
    P2["g2_wall"] = P[top]
    P2["g2_salmon"] = list(_SENT)
    im = g2.block_cell(P2, m, "teal")
    mask = g2.block_mask(m)
    me_face = not (m & S)
    for y in range(T):
        for x in range(T):
            c = im.getpixel((x, y))
            if c in _SENT:
                im.putpixel((x, y), face_fn(x, y, c == _SENT[0]))
            elif not mask[y][x]:
                f = floor_im.getpixel((x, y))
                im.putpixel((x, y), _shade(f, SH) if me_face and y == T - 1 else f)
    return im


def face_fire(P):
    """불관 칸막이 앞면(용암마을): 크림 면 + 가운데 붉은 띠 2px(위 밝은 줄) + 아래 크림 한 톤. 칸마다 세로 이음은 없다 — 16px 눈금이 보였다(I1 X9, 본 시트 칸막이 앞면도 민 띠)."""
    cr, br = P["gy_cream"], P["gy_brick"]
    def fn(x, y, first):
        if first:
            return cr[3]
        if y in (9, 10):
            return br[2] if y == 9 else br[1]
        return cr[1] if y >= 12 else cr[2]
    return fn


def face_ice(P):
    """얼음관 칸막이 앞면: 하늘색 얼음 면 + 위에서 흘러내린 흰 서리 방울(5px 주기) + 아래 진한 줄."""
    ic = P["gy_ice"]
    def fn(x, y, first):
        drip = [3, 1, 2, 0, 1][x % 5]
        if first or y < 7 + drip:
            return ic[3]
        return ic[0] if y >= 12 else ic[2] if x % 5 == 3 else ic[1]
    return fn


def face_dojo(P):
    """도장 칸막이 앞면: 진갈색 세로 널(4px 주기, 이음 한 톤) · 위 밝은 줄 — 나무 판벽."""
    dk = P["gy_dkwood"]
    def fn(x, y, first):
        if first:
            return dk[2]
        return dk[0] if x % 4 == 3 else dk[1]
    return fn


def hedge(P, m: int, floor_im):
    """나무 줄 칸막이(무지개시티·검방울): 같은 칸막이 모양 안에 칸마다 둥근 나무 한 그루.
    윗면 칸 = 둥근 수관(왼쪽 위 밝음, 테는 잎의 최암 톤), 앞면 칸 = 수관 아랫부분 + 짧은 줄기 + 줄기 둘레 진한 그늘. 그루 사이 틈은 최암 톤 — 칸 수가 읽힌다."""
    wall_, kind = g2._virtual(m)
    lf, tr = P["gy_hedge"], P["i2_wood"]
    ol = lf[0]
    me_face = not (m & S)
    # 세로 팔(한 칸 폭) 칸: 벽 모양 폭에 맞춘 둥근 관목 한 그루 — 수관 원이 벽 모양 양옆에 잘려 각진 녹색 상자로 보였다(I2 Y8).
    row = [wall_[T + 8][T + x] for x in range(T)]
    narrow = not (row[0] and row[T - 1]) and any(row)
    if narrow:
        lx = row.index(True); rx = T - 1 - row[::-1].index(True)
        cx0, rw = (lx + rx + 1) / 2, (rx - lx + 1) / 2 - 0.2
    else:
        cx0, rw = 8.0, None
    im = px.new()
    for y in range(T):
        for x in range(T):
            X, Y = T + x, T + y
            if not wall_[Y][X]:
                c = floor_im.getpixel((x, y))
                im.putpixel((x, y), _shade(c, SH) if me_face and y == T - 1 else c)
                continue
            edge = any(not wall_[Y + dy][X + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            cy, r = (6.0, 6.6) if me_face else (8.0, 7.6)
            if rw is not None:
                r = min(r, rw)
            dx, dy = x + 0.5 - cx0, y + 0.5 - cy
            d = math.hypot(dx, dy * (1.1 if me_face else 1.0))
            if edge:
                c = ol
            elif d <= r:
                l = -(dx + dy) / r
                c = lf[4] if (l > 0.95 and d > r * 0.35) else lf[3] if l > 0.25 else lf[2] if l > -0.6 else lf[1]
                if d > r - 1:
                    c = ol
                for bx, by in ((5, cy - 2), (10, cy + 1)):        # 잎 덩이 아래 그늘 1px — 수관에 덩이 결
                    if abs(x - bx) <= 1 and y == round(by) + 2 and c not in (ol, lf[4]):
                        c = lf[1]
            elif me_face and int(cx0) - 1 <= x <= int(cx0) and y >= cy + r - 1:
                c = tr[0] if x == int(cx0) else tr[1]
            else:
                c = ol
            im.putpixel((x, y), c)
    return im


# ---- 바닥 오토타일(물·용암·낭떠러지·얼음판) ------------------------------------------------------
AUTOTILE = {
    "gy_pool": ("gy-pool", 2, 2, 0),         # 물(안) / 둘레 크림 판(밖)
    "gy_lava": ("gy-lava", 1, 1, 0),         # 둑을 얇게(들임 1px) — 한 칸 폭 용암도 칸을 거의 채운다(QA1-35, 자체 검수 1-24)
    "gy_abyss": ("gy-abyss", 1, 0, 0),       # 낭떠러지 — 모서리를 둥글리지 않는다(아치 문 오독, QA1-20)
    "gy_ice": ("gy-ice", 1, 3, 0),
}


def at_mask(kind, m):
    name, depth, radius, amp = AUTOTILE[kind]
    return px.inside_mask(m, name, depth, radius, amp)


FAR = 99


def _dist_out(inside, x, y, m, lim=8):
    """안쪽 칸 (x,y) 에서 가장 가까운 바깥 픽셀까지의 거리(4방향, 칸 밖은 마스크 비트로). 없으면 FAR."""
    for d in range(1, lim):
        for dx, dy in ((0, -d), (0, d), (-d, 0), (d, 0)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < T and 0 <= yy < T:
                if not inside[yy][xx]:
                    return d
            else:
                bit = N if yy < 0 else S if yy >= T else W if xx < 0 else E
                if not m & bit:
                    return d
    return FAR


def _dist_dir(inside, x, y, m, dx, dy, lim=12):
    """한 방향으로 바깥 픽셀까지의 거리. 이웃 칸이 이어져 있으면(마스크 비트) 그쪽으로는 끝이 없다(FAR)."""
    for d in range(1, lim):
        xx, yy = x + dx * d, y + dy * d
        if 0 <= xx < T and 0 <= yy < T:
            if not inside[yy][xx]:
                return d
        else:
            bit = N if yy < 0 else S if yy >= T else W if xx < 0 else E
            return d if not m & bit else FAR
    return FAR


POOL_SEEDS = px.torus_seeds("gy-pool-net", 4)
LAVA_SEEDS = px.torus_seeds("gy-lava-net", 2)


def _orbit(seeds, f, amp=1.2):
    return [((sx + amp * math.cos(math.pi / 2 * f + i * 1.3)) % T, (sy + amp * math.sin(math.pi / 2 * f + i * 1.3)) % T) for i, (sx, sy) in enumerate(seeds)]


def pool_cell(P, m, f, alt=0):
    """수영장 물: 둘레 크림 판(밖) → 경계 1px = 크림 최암 톤 → 북쪽 변이 열린 칸은 물속 벽(진한 파랑 4px + 한 단 3px — 길이 물 위로 솟은 깊이),
    서쪽 변이 열린 칸은 물속 벽 2px + 2px → 연한 물 바탕 + 성긴 밝은 결 + 프레임마다 도는 반짝임 2px."""
    pl, rim = P["gy_pool"], P["gy_rim"]
    ground = floor(P, "rim")
    ins = at_mask("gy_pool", m)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if not ins[y][x]:
                im.putpixel((x, y), ground.getpixel((x, y))); continue
            d = _dist_out(ins, x, y, m)
            dn = _dist_dir(ins, x, y, m, 0, -1)
            dw = _dist_dir(ins, x, y, m, -1, 0)
            if d == 1:
                c = rim[0]
            elif dn <= 5:
                c = pl[0]
            elif dw <= 3:
                c = pl[0]
            elif dn <= 8 or dw <= 5:
                c = pl[1]
            else:
                d1, d2, _, _ = px.voronoi(_orbit(POOL_SEEDS, f), x + 0.5, y + 0.5)
                c = pl[3] if d2 - d1 < 0.7 and (x * 3 + y) % 4 == 0 else pl[2]
                sx, sy = [(4, 10), (11, 4), (8, 13), (12, 9)][f]
                if alt:                                          # 속 변형: 반짝임 자리를 칸마다 옮긴다 — 같은 높이 흰 대시 줄(I2 Y6)
                    ox, oy = [(0, 0), (5, -6), (-3, 3), (6, 2), (-2, -7), (3, -3), (-5, 1)][alt % 7]
                    sx, sy = (sx + ox - 1) % 12 + 2, (sy + oy - 1) % 12 + 2
                if m == 255 and (x, y) in ((sx, sy), (sx + 1, sy)):   # 반짝임은 속 칸에만(가장자리 칸은 같은 변형이 줄지어 흰 대시 줄이 됐다, I2 Y6)
                    c = pl[4]
            im.putpixel((x, y), c)
    return im


def _reground(draw, P, ramp_key, ground, shade=None):
    """정본 함수 그림에서 바탕(그 시트의 바닥)만 체육관 바닥으로 바꾼다 — 그림은 정본 그대로, 픽셀 복사 없음.
    바탕 램프(ramp_key)만 다른 색으로 바꿔 한 번 더 그리고 달라진 화소 = 바탕. shade 가 있으면 원래 그 자리 색이 shade 인 화소(테 밖 그늘)는
    체육관 바닥을 한 단 어둡게 한다(얼음이 바닥보다 살짝 낮다는 정본 문법을 바탕만 바꿔 지킨다)."""
    a = draw(P)
    probe = dict(P); probe[ramp_key] = [(255, 0, 255, 255)] * len(P[ramp_key])
    b = draw(probe)
    out = a.copy()
    for y in range(T):
        for x in range(T):
            if a.getpixel((x, y)) != b.getpixel((x, y)):
                g = ground.getpixel((x, y))
                out.putpixel((x, y), px.tint(g, 0.84) if shade is not None and a.getpixel((x, y))[:3] == shade[:3] else g)
    return out


def lava_cell(P, m, f, bubble=None):
    """용암: 정본 `dungeon_cavern.lava_cell` (흐름 결·굳은 껍질 판·둑 안 뜨거운 테·현무암 둑) 을 그대로 부르고, 둑 밖 바탕(던전 재 바닥)만
    체육관 현무암 판석으로 바꾼다. 마스크도 던전 웅덩이 마스크(dungeon_kit.pool_mask)다."""
    import dungeon_cavern as dc
    return _reground(lambda Q: dc.lava_cell(Q, m, f, bubble), P, "dg_ash", floor(P, "bas"))


def abyss_cell(P, m, f):
    """어둠 낭떠러지: 판석(밖) → 북쪽 변이 열린 칸은 판석 단면(위 1px 밝은 모서리 · 4px 앞면 · 8px 마다 세로 이음 · 아래 1px 최암) →
    나머지 변은 최암 1px → 무늬 없는 검정 + 칸마다 안개 점 한두 개(프레임마다 옮긴다). 바닥 줄눈이 비치지 않는다."""
    ab, gs = P["gy_abyss"], P["gy_gst"]
    ground = floor(P, "gst")
    ins = at_mask("gy_abyss", m)
    im = px.new()
    sh_ = (m * 7) % 11
    fog = [] if m == 255 else [((fx + sh_) % 13 + 1, fy) for fx, fy in [[(3, 9), (11, 12)], [(5, 10), (12, 11)], [(7, 9), (13, 12)], [(9, 10), (2, 12)]][f]][:1 + (m % 2)]
    for y in range(T):
        for x in range(T):
            if not ins[y][x]:
                im.putpixel((x, y), ground.getpixel((x, y))); continue
            d = _dist_out(ins, x, y, m)
            dn = _dist_dir(ins, x, y, m, 0, -1)
            if dn == 1:
                c = gs[3]
            elif dn <= 5:
                c = gs[0] if x % 8 == 7 else gs[2] if dn == 2 else gs[1]
            elif dn == 6:
                c = gs[0]
            elif d == 1:
                c = gs[0]
            else:
                c = ab[0]
                for fx, fy in fog:
                    if (x, y) in ((fx, fy), (fx + 1, fy)):
                        c = ab[2]
                    elif (x, y) == (fx + 2, fy):
                        c = ab[1]
            im.putpixel((x, y), c)
    return im


def ice_cell(P, m):
    """얼음판(미끄럼): 정본 `dungeon_cavern.ice_cell` (사선 줄무늬 2톤 · 둘레 1px 얼음 테 · 테 밖 1px 그늘, 흰 점 없음) 을 그대로 부르고,
    바탕(던전 눈 바닥)만 체육관 돌 바닥의 민 판 톤으로 바꾼다(돌 바닥 칸의 줄눈까지 따라오면 둘레에 16px 눈금이 찍혔다, QA-L6 N13).
    칸 줄눈은 덧그리지 않는다 — 체육관만 바둑판 얼음이 되어 던전·기후 얼음과 갈렸다(통합 검수 I1 X7). 미끄러질 칸 수는 멈춤 바위 자리로 읽는다."""
    import dungeon_cavern as dc
    plain = px.new()
    px.fill(plain, P["gy_ist"][2])
    return _reground(lambda Q: dc.ice_cell(Q, m), P, "dg_snow", plain, shade=P["dg_snow"][1])