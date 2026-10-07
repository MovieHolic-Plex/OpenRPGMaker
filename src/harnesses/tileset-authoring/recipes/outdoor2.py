"""야외 2차 — 적대 검수(2026-10-02, qa_town.md)가 지적한 빠진·틀린 야외 타일을 다시 찍는다.
기준: 낱장 그림의 화풍은 Scarloxy(주황 돌·노랑초록 풀·갈색 나무), 빠진 종류와 쓰임새는 원작 GBA 마을·도로 문법.
- 턱: 두꺼운 돌 덩어리가 아니라 Scarloxy 의 「~」 모양 가는 돌 띠(6px), 끝은 가늘어지며 아래로 말린다, 떨어지는 쪽에 풀 그늘 2px.
- 키 큰 풀: 사각을 꽉 칠하지 않는다 — 포기 둘(외곽선·3톤)이 서고 사이로 바탕 풀이 보인다.
- 꽃: 점 꽃이 아니라 꽃머리 7px 두 송이(외곽선·심·잎).
- 우편함·표지판(외곽선)·투명 바탕 바위/덤불(위층에 얹고 풀이 받친다).
- 밝은 공터 풀(두 톤 땅) 오토타일."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T, N, E, S, W  # noqa: E402

SHADOW = (0, 0, 0, 64)


def item_capsule(P):
    """도로 장치 뒤의 보상 자리: 작은 빨강·금속 캡슐. 기존 램프만, 좌표로 직접 그린다."""
    red, metal = P["roof_red"], P["steel"]
    im = px.new()
    def inside(x, y):
        return ((x - 7.5) / 4.5) ** 2 + ((y - 8) / 4.5) ** 2 <= 1
    for y in range(12, 14):
        for x in range(5, 13):
            if ((x - 9) / 4) ** 2 + ((y - 12.5) / 1.2) ** 2 <= 1:
                im.putpixel((x, y), SHADOW)
    for y in range(T):
        for x in range(T):
            if not inside(x, y): continue
            ramp = red if y < 8 else metal
            rim = any(not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)))
            light = x + y < 14
            im.putpixel((x, y), ramp[0] if rim else ramp[-1] if light else ramp[2])
    for x in range(4, 12): im.putpixel((x, 8), metal[0])
    for x in (7, 8):
        for y in (7, 8): im.putpixel((x, y), metal[-1])
    return im


def _grass(x, y):
    import monster_overworld as mo
    return mo._GRASS0[(x, y)]


def _base():
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), _grass(x, y))
    return im


def _rock(P, x, y):
    import monster_overworld as mo
    return mo.rock_px(P, x, y)


# ---- 턱 -------------------------------------------------------------------------------------
# 턱은 돌덩이 띠가 아니다(적대 검수 L1 N9 — 바위 고리와 같은 돌 띠라 막힌 테두리와 못 가른다). 원작 101번 도로 턱 문법:
# 풀 윗면이 이어지다 1px 밝은 가장자리에서 끝나고, 그 아래 흙 앞면이 둥글게 처진 입술선(8px 주기 처짐 + 최암 한 줄)으로 마감되며
# 떨어지는 쪽 풀에 2px 그늘이 진다. 돌덩이 무늬(보로노이)는 바위 고리 전용이다.
_LEDGE_WOB = (0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0)          # 윗선 흔들림(m0·m1 이 같아 이음매가 맞는다)


def _droop(i: int) -> int:
    """입술선 처짐: 8px 주기로 가운데가 2px 처진 둥근 자락."""
    u = (i + 2) % 8
    return (0, 1, 1, 2, 2, 1, 1, 0)[u]


def _ramp_at(r, i):
    """램프 길이가 테마마다 다르다(기후 시트는 4단) — 넘치는 단은 가장 밝은 단으로."""
    return r[min(i, len(r) - 1)]


def ledge(P, part: str):
    """남쪽으로 뛰어내리는 턱(한 칸). part: l(왼끝) m0 m1(가운데 두 변형 — 앞면 주름 자리만 다르다) r(오른끝).
    풀 윗면 → 1px 밝은 풀 가장자리 → 흙 앞면 3~5px(윗줄 밝음, 세로 주름) → 둥글게 처진 입술선 2px(암·최암) → 아래 풀 그늘 2px."""
    rk, g = P["rock"], P["grass"]
    rk = [_ramp_at(rk, i) for i in range(max(4, len(rk)))]
    g = [_ramp_at(g, i) for i in range(max(5, len(g)))]
    im = _base()
    crease = {"m0": (3, 9, 14), "m1": (1, 6, 12), "l": (8, 13), "r": (2, 7)}.get(part, (3, 9, 14))
    for x in range(T):
        if part == "l":
            t = min(1.0, max(0.0, (x - 1) / 5))
        elif part == "r":
            t = min(1.0, max(0.0, (T - 2 - x) / 5))
        else:
            t = 1.0
        if t <= 0.0:
            continue
        top = 5 + _LEDGE_WOB[x] + round(2.5 * (1 - t))                     # 끝으로 갈수록 윗선이 내려오고(말림)
        bot = 10 + _droop(x) - round(1.5 * (1 - t))                        # 아랫선은 올라와 가늘어진다
        bot = max(bot, top + 2)
        for y in range(top, bot + 1):
            if y == top:
                c = g[4] if t > 0.4 else g[3]                              # 풀이 빛을 받는 가장자리
            elif y == top + 1:
                c = rk[3]
            elif y == bot:
                c = rk[0]
            elif y == bot - 1:
                c = rk[1]
            else:
                c = rk[1] if x in crease and y < bot - 1 else rk[2]
            im.putpixel((x, y), c)
        for k, cc in ((1, g[0]), (2, g[1])):                               # 떨어지는 쪽 풀 그늘
            if bot + k < T and (k == 1 or (x + bot) % 2 == 0):
                im.putpixel((x, bot + k), cc)
    return im


def ledge_side(P, side: str):
    """동·서 턱(세로 한 칸): 남쪽 턱과 같은 문법을 옆으로 — 풀 윗면 끝 1px 밝은 가장자리 → 흙 앞면 3px(동쪽 면은 그늘, 서쪽 면은 빛) →
    최암 입술선(4px 주기로 1px 처짐) → 떨어지는 쪽(side) 풀 그늘 2px."""
    rk, g = P["rock"], P["grass"]
    rk = [_ramp_at(rk, i) for i in range(max(4, len(rk)))]
    g = [_ramp_at(g, i) for i in range(max(5, len(g)))]
    im = _base()
    for y in range(T):
        sag = (0, 1, 1, 0)[y % 4]
        if side == "e":                                                    # 서쪽이 높은 풀, 동쪽으로 떨어진다
            hl = 5 + _LEDGE_WOB[y]
            cols = [(hl, g[4]), (hl + 1, rk[2]), (hl + 2, rk[1]), (hl + 3, rk[1]), (hl + 4 + sag, rk[0])]
            if sag:
                cols.append((hl + 4, rk[1]))
            shade = [hl + 5 + sag, hl + 6 + sag]
        else:                                                              # 동쪽이 높은 풀, 서쪽으로 떨어진다
            hl = 10 - _LEDGE_WOB[y]
            cols = [(hl, g[4]), (hl - 1, rk[3]), (hl - 2, rk[2]), (hl - 3, rk[2]), (hl - 4 - sag, rk[0])]
            if sag:
                cols.append((hl - 4, rk[1]))
            shade = [hl - 5 - sag, hl - 6 - sag]
        for x, c in cols:
            px.put(im, x, y, c)
        for k, xx in enumerate(shade):
            if 0 <= xx < T and (k == 0 or (xx + y) % 2 == 0):
                im.putpixel((xx, y), g[0] if k == 0 else g[1])
    return im


# ---- 키 큰 풀 -------------------------------------------------------------------------------
TUFT = [
    ".o..o..o",
    "oLo.oLoL",
    "oLMoLMoM",
    "oLMMLMMo",
    "oMMMMMDo",
    ".oDMMDo.",
    "..oDDo..",
]


TUFT_B = [                                                                   # 잎끝 높이가 다른 포기(가운데 잎이 1px 높다)
    "...o..o.",
    "o.oLo.oL",
    "oLoLMoLM",
    "oLMMLMMo",
    "oMMMMMDo",
    ".oDMMDo.",
    "..oDDo..",
]


# GBA 2세대 키 큰 풀: 칸마다 포기 하나가 사방으로 잎을 뻗는다. 바탕 풀이 귀퉁이에 비치고, 모아 깔면 포기들이 맞닿아 풀숲이 된다.
# o = 짙은 올리브 윤곽, D = 짙은 잎, M = 잎, L = 빛 받은 잎끝(빛은 위). v=1 은 좌우를 뒤집고 1px 내려 같은 포기의 격자를 깬다.
TUFT_GBA = [                                                                 # 작은 포기(8×8) — 칸에 넷을 벽돌처럼 엇갈려 감아 찍는다
    "..o...o.",
    ".oLo.oLo",
    "oLMooLMo",
    "oMMLLMMo",
    ".oMMMMo.",
    "oDoMMoDo",
    ".oDDDDo.",
    "..oooo..",
]


def tall_grass(P, v: int):
    t = P["tall"]
    im = _base()
    key = {"o": t[0], "D": t[1], "M": t[2], "L": t[3]}
    spots = ((0, 0), (8, 0), (4, 8), (12, 8)) if not v else ((1, 1), (9, 0), (5, 8), (13, 9))
    for ox, oy in spots:
        for y, row in enumerate(TUFT_GBA):
            for x, ch in enumerate(row):
                if ch in key:
                    im.putpixel(((ox + x) % T, (oy + y) % T), key[ch])
    return im


_FRINGE = (1, 2, 1, 0, 2, 3, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0)           # 칸 변을 따라 잎끝이 넘어가는 길이(0~3px)


def tall_fringe(P, side: str):
    """GBA 풀숲은 포기 하나가 칸 안에서 끝난다 — 이웃 칸으로 넘어가는 잎끝이 없다(빈 위층 칸, 이름·칸 번호는 그대로 둔다)."""
    return px.new()


# ---- 꽃 -------------------------------------------------------------------------------------
FLOWER = [                                                            # 꽃잎 넷 + 가운데 심(L2 N39 — 둥근 네모가 사탕·동전으로 읽혔다)
    ".Ho P.".replace(" ", ""),
    "HPoPP",
    "oocoo",
    "DDoDD",
    ".DoD.",
]
# H = 빛 받은 꽃잎 점, P = 꽃잎, D = 아래 꽃잎(한 톤 어둡다), o = 꽃잎 사이 홈(꽃 진한 색), c = 심


def flowers(P, kind: str, frame: int = 0):
    """꽃밭 한 칸: 꽃머리 5×5 두 송이(외곽선·꽃잎·노란 심) + 잎 두 장. frame 1 은 꽃이 1px 흔들린다."""
    g = P["grass"]
    cols = {"pink": ("#c84a6a", "#f07a90"), "white": ("#a8a090", "#fffaf0"), "yellow": ("#c88a1e", "#f8d040"), "red": ("#a02830", "#e8505a")}
    o, p = px.hexc(cols[kind][0]), px.hexc(cols[kind][1])
    core = px.hexc("#f8e070") if kind != "yellow" else px.hexc("#fff8c0")
    im = _base()
    key = {"o": o, "P": p, "c": core, "H": px.tint(p, 1.12), "D": px.tint(p, 0.84)}
    for ox, oy in ((1, 1), (9, 8)):
        sx = ox + (1 if frame and ox == 1 else 0)
        for dy, row in enumerate(FLOWER):
            for dx, ch in enumerate(row):
                if ch in key:
                    px.put(im, sx + dx, oy + dy, key[ch])
        for (dx, dy, c) in ((0, 5, g[0]), (1, 5, g[0]), (3, 5, g[0]), (4, 5, g[0]), (2, 5, P["leaf"][1]), (2, 6, P["leaf"][1]),
                            (0, 6, P["leaf"][2]), (4, 6, P["leaf"][2])):
            px.put(im, ox + dx, oy + dy, c)
    return im


def flowerbed(P, kind: str, v: int = 0):
    """화단 한 칸: 꽃머리 넷(2×2, 각 6px — 외곽선·꽃잎·심) 사이로 잎만 보인다. 모아 깔면 꽃이 칸을 꽉 채운 화단."""
    cols = {"pink": ("#c84a6a", "#f07a90"), "red": ("#a02830", "#e8505a"), "white": ("#a8a090", "#fffaf0"), "yellow": ("#c88a1e", "#f8d040")}
    o, p = px.hexc(cols[kind][0]), px.hexc(cols[kind][1])
    core = px.hexc("#f8e070") if kind != "yellow" else px.hexc("#fff8c0")
    lf = P["leaf"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), lf[1] if (x + 2 * y) % 5 else lf[2])
    head = [r + "." for r in FLOWER] + ["..L..."]                      # 꽃잎 넷 + 심(L2 N39), 줄기 1px
    key = {"o": o, "P": p, "c": core, "L": lf[0], "H": px.tint(p, 1.12), "D": px.tint(p, 0.84)}
    spots = (((1, 1), (9, 0), (0, 9), (8, 8)), ((2, 0), (9, 2), (0, 8), (9, 9)), ((0, 2), (8, 1), (2, 9), (9, 8)))[v % 3]   # 변형마다 꽃 자리를 1~2px 흔든다(격자 티, L1 N14)
    for ox, oy in spots:
        for dy, row in enumerate(head):
            for dx, ch in enumerate(row):
                if ch in key:
                    px.put(im, ox + dx, oy + dy, key[ch])
    return im


# ---- 우편함 · 표지판 · 바위 · 덤불 -------------------------------------------------------------
def mailbox(P):
    """우편함(투명 바탕, 위층): 흰 둥근 상자(위가 밝고 아래가 그늘) + 빨간 깃발 + 나무 기둥 + 밑 그림자."""
    st, wd = P["steel"], P["wood"]
    im = px.new()
    px.rect(im, 4, 15, 11, 15, SHADOW)
    px.rect(im, 7, 9, 8, 14, wd[1]); px.rect(im, 7, 9, 7, 14, wd[2]); px.rect(im, 7, 14, 8, 14, wd[0])
    for y in range(2, 10):
        for x in range(3, 13):
            corner = (y == 2 and x in (3, 12)) or (y == 9 and x in (3, 12))
            if corner:
                continue
            edge = y in (2, 9) or x in (3, 12)
            c = st[0] if edge else st[3] if y < 5 else st[2] if y < 8 else st[1]
            im.putpixel((x, y), c)
    px.rect(im, 5, 5, 10, 5, st[1])                                         # 투입구
    px.rect(im, 12, 3, 13, 3, px.hexc("#c83838")); px.rect(im, 13, 3, 13, 6, px.hexc("#c83838")); px.put(im, 14, 3, px.hexc("#e86060"))
    return im


def sign(P, metal: bool = False):
    """표지판(투명 바탕, 위층): 판 14×9 에 외곽선 1px · 윗면 하이라이트 1px · 글자 줄 2줄, 기둥 3px, 밑 그림자. metal=True 는 도로용 회색 금속판."""
    r = P["steel"] if metal else P["wood"]
    o, d, m, l = (r[0], r[1], r[2], r[3])
    im = px.new()
    px.rect(im, 4, 15, 11, 15, SHADOW)
    px.rect(im, 6, 10, 9, 14, P["wood"][1]); px.rect(im, 6, 10, 6, 14, P["wood"][2]); px.rect(im, 9, 10, 9, 14, P["wood"][0])
    px.rect(im, 1, 1, 14, 10, o)
    px.rect(im, 2, 2, 13, 9, m)
    px.rect(im, 2, 2, 13, 2, l)
    px.rect(im, 2, 9, 13, 9, d)
    for y in (4, 6):
        px.rect(im, 4, y, 11 if y == 4 else 9, y, d)
    return im


def _lobes(shape):
    return lambda x, y: any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in shape)


def boulder(P, variant: int):
    """밀 수 있는 바위(투명 바탕, 위층): 덩이 2~3개, 외곽선(아래·오른쪽 최암, 위·왼쪽 한 단 어둠), 왼쪽 위 하이라이트, 밑 그림자."""
    rk = P["rock"]
    lobes = [[(7.5, 7.0, 5.4), (4.0, 9.6, 3.6), (11.4, 9.8, 3.6)], [(6.6, 5.8, 4.2), (5.2, 10.0, 4.2), (10.8, 9.4, 4.0)]][variant % 2]
    inside = _lobes(lobes)
    im = px.new()
    for x in range(2, 15):
        if inside(x, 12) or inside(x, 13):
            px.put(im, x, 14, SHADOW)
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            cx, cy, r = min(lobes, key=lambda l: (x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2)
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            light = -((x - cx) + (y - cy)) / r
            if edge[1] or edge[2]:
                c = rk[0]
            elif edge[0] or edge[3]:
                c = rk[1]
            else:
                c = rk[4] if light > 0.8 else rk[3] if light > 0.2 else rk[2] if light > -0.5 else rk[1]
            im.putpixel((x, y), c)
    return im


def bush(P, variant: int):
    """장식 관목(투명 바탕, 막힘 — 자르기 나무 cuttree 가 아니다, L7 N69): 낮고 넓은 잎 덩이 셋이 옆으로 겹친 무리.
    높이 7~8px(y6..13)·폭 14px, 줄기 없음, 밑 그늘 2줄(y14..15). 자르기 나무(키 큰 돔 + 4px 줄기)와 실루엣이 다르다."""
    lf = P["leaf"]
    shapes = ([(3.9, 10.9, 3.3), (8.1, 10.0, 3.8), (12.2, 11.0, 3.2)],
              [(3.7, 11.0, 3.2), (7.7, 10.1, 3.7), (12.0, 10.7, 3.4)])
    lobs = shapes[variant % 2]
    inside0 = _lobes(lobs)
    inside = lambda x, y: 1 <= x <= 14 and 5 <= y <= 13 and inside0(x, y)
    im = px.new()
    for y in (14, 15):                                               # 밑 그늘 2줄(가운데가 넓다)
        for x in range(2 if y == 14 else 4, 15 if y == 14 else 13):
            px.put(im, x, y, SHADOW)
    r = px.rng(f"shrub-{variant}")
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            # 덩이 사이 골: 가장 가까운 덩이가 바뀌는 자리를 한 단 어둡게(덩이 셋이 따로 읽히게)
            near = sorted(((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 - rr * rr, k) for k, (cx, cy, rr) in enumerate(lobs))
            seam = len(near) > 1 and abs(near[0][0] - near[1][0]) < 2.6 and y >= 9
            cx, cy, rr = lobs[near[0][1]]
            if edge[1] or edge[2]:
                c = lf[0]
            elif edge[0] or edge[3]:
                c = lf[1]
            elif seam:
                c = lf[1]
            else:
                light = -((x + 0.5 - cx) + (y + 0.5 - cy)) / rr
                c = lf[4] if light > 0.9 and r.random() < 0.6 else lf[3] if light > 0.2 else lf[2] if light > -0.6 else lf[1]
            im.putpixel((x, y), c)
    return im


# ---- 밝은 공터 풀(두 톤 땅) ------------------------------------------------------------------
def clearing(P, m: int):
    """밝은 공터 풀 오토타일: 안은 밝은 풀(1px 점 몇 개만), 경계는 2px 물결 + 한 줄 풀 자락. 원작 마을이 흙길 대신 동선을 그리는 방법."""
    import monster_overworld as mo
    cg, g = P["grass_light"], P["grass"]
    inside = px.inside_mask(m, "clearing", *mo.AUTOTILE_PARAMS["clearing"][1:])   # 가장자리 2±1px(L3 N44)
    narrow = (not m & E and not m & W) or (not m & N and not m & S)
    h = px.rng("clearing-fringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                c = cg[2]
                if (x * 5 + y * 11) % 23 == 0:
                    c = cg[3]
                elif (x * 7 + y * 3) % 29 == 0:
                    c = cg[1]
                if not all(nb.values()):
                    c = cg[1]
                else:
                    nb2 = [inside[yy][xx] if 0 <= xx < T and 0 <= yy < T else True for xx, yy in ((x + 2, y), (x - 2, y), (x, y + 2), (x, y - 2))]
                    if not all(nb2) and table[y][x] < (0.25 if narrow else 0.7):   # 1칸 샛길은 속 띠를 성기게 — 밝은 면이 칸 폭 대부분
                        c = cg[1]                                          # 경계 안쪽 2px 중간 톤 띠
                im.putpixel((x, y), c)
            else:
                c = mo._GRASS0[(x, y)]
                if any(nb.values()) and table[y][x] < 0.45:
                    c = g[1]
                im.putpixel((x, y), c)
    return im
