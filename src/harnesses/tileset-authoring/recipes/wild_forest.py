"""숲 미로 — 원작 상록숲(fr ViridianForest)·등화숲(em PetalburgWoods) 배치도를 그려 잰 장소 문법.

장소 문법(원작에서 잰 것):
- 맵 전체가 **2×2 그루 숲 격자**다. 그루는 2칸 높이 안에 수관과 줄기가 다 들어가고, 줄기는 둘째 줄 안에서 수관 아래 끝에 덮인다.
  막는 칸은 모두 잎(또는 줄기)으로 칠해져 있어 「보이는 통로 폭 = 걷는 폭」이다. 세로로 붙은 그루는 아래 그루 수관이 위 그루 밑동을
  덮어 이음매 없는 숲벽이 된다. 줄기·발밑 그늘은 숲 덩이 맨 아랫줄에만 보인다.
- 걷는 땅은 그 사이를 꺾어 도는 통로다. 세로 통로 2칸, 가로 통로 2~4칸. 큰길은 하나이고(입구 → 출구), 갈래는 막다른 곳으로 끝난다.
- 통로의 넓은 구간마다 **키 큰 풀 덩이가 통로 폭 끝까지** 막아 선다(조우를 피할 수 없다). 덩이는 모서리 1~2칸이 깎인 계단형이다.
- 짧은 흙 턱(남쪽으로만 뛰어내림)이 갈래 입구를 끝까지 가른다 — 한 방향 지름길. 턱 양 끝은 나무에 붙는다.
- 바닥 변화: 흙 바닥 띠(원작 Viridian 5곳)는 큰길을 따라, 흰 꽃 무리(4곳)·버섯은 막다른 곳과 공터 가장자리에.
- 빛 드는 공터는 밝은 풀 덩이 — 칠 규칙은 본 시트 밝은 공터(outdoor2.clearing)를 숲 빛 램프로, 모양은 진흙과 같은 둥근 덩이(sun_mask —
  바깥 귀 칸 전체 사분원·가장자리 3±2px 물결, I4 W4: 직사각형 둘을 붙인 칸 계단이었다). 쉼터·아이템 자리.
- 숲 흙길은 본 시트 모래길(monster_overworld.sand_path)을 숲 흙 램프로, 들꽃은 본 시트 들꽃(outdoor2.flowers)을 숲 바닥 위에,
  키 큰 풀 덩이의 남·동·서 이웃 칸 위층에는 본 시트 잎끝(outdoor2.tall_fringe, 숲 풀 램프 — wtall_fringe_s/e/w)을 얹는다.
- 입구·출구는 숲 벽에 난 2칸 틈(관문 건물 자리).

깔기 순서(에디터 조수용): 바닥 wfl0~3 → 흙길 wdirt·빛 공터 wsun 칠하기 → 키 큰 풀 wtall0/1(덩이, 모서리 깎기, 둘레 이웃 칸 위층에 wtall_fringe_s/e/w) → 그루 wood_<4비트>
(위 1·아래 2·왼 4·오 8 — 이웃 그루가 있는 쪽 비트) 를 2×2 로 찍고, 위에 그루가 없는 그루는 바로 위 칸 위층에 wood_cap0/1(수관 머리,
걸을 수 있다 — 주인공이 수관 뒤를 지나간다) → 턱 wledge_s_* → 소품(그루터기·통나무·버섯 mush0~5·흰 꽃 wflower0~2·작은 나무 cuttree).
마감: 맵 안에서 끝나는 흙길 끝 칸(바깥 귀 둘이 열린 칸)은 wdirt_end<마스크>(둥근 끝 — 두 칸 폭 길이 반원으로 닫힌다),
키 큰 풀 덩이의 바깥 귀는 wtall<v>rw<귀 비트>(1 왼위·2 오른위·4 왼아래·8 오른아래, 반지름 11 로 깎은 칸 — 정본 wild_tall),
옆 잎끝은 두 벌 wtall_fringe_<e|w>_v<n>(칸 해시로 섞는다), 귀에 닿은 잎끝은 끝을 자른 wtall_fringe_s_<a|b|ab>·wtall_fringe_<e|w>_v<n>_<a|b|ab>
(배치는 node/wild_round.mts roundTall).

타일: wfl0~3 숲 바닥, wtall0/1 숲 키 큰 풀(조우), wsun_at 빛 공터(오토타일), wdirt_at 숲 흙길(오토타일), wood_0~f(2×2 그루 16벌),
wood_cap0/1 수관 머리(위층·통과), wtall_fringe_s/e/w 풀숲 잎끝(위층·통과), wledge_s_mid/mid1/l/r 숲 흙 턱, stump·flog(2×1)·cuttree 막는 소품, mush0~5 버섯(1~3송이 배치 6벌),
wflower0~2 들꽃(본 시트 꽃 두 송이 — 흰 꽃 둘·노란 꽃 하나)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import wild_common as wc  # noqa: E402

SUN = ("forest-sun", 3, -1, 2)        # 빛 공터 가장자리 3±2px, 바깥 모서리는 칸 전체 사분원·안쪽 모서리는 1/4 타원 홈(I4 W4 — 진흙과 같은 둥근 덩이)


def sun_mask(m):
    """숲 빛 공터 마스크 = 진흙과 같은 둥근 덩이 규칙(wc.round_patch_mask), 값만 SUN."""
    return wc.round_patch_mask(m, *SUN)


def sun_clearing(P, m: int, ground_px):
    """숲 빛 공터 오토타일(걷는 땅): 칠 규칙은 본 시트 밝은 공터 outdoor2.clearing 그대로(안 밝은 풀 · 경계 안 2px 중간 톤 띠 · 바깥 풀 자락),
    모양만 둥근 덩이(sun_mask) — 직사각형 둘을 붙인 칸 계단으로 읽혔다(I4 W4). P: grass_light(빛 램프)·grass(바깥 자락 톤)."""
    cg, g = P["grass_light"], P["grass"]
    inside = sun_mask(m)
    narrow = (not m & px.E and not m & px.W) or (not m & px.N and not m & px.S)
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
                    if not all(nb2) and table[y][x] < (0.25 if narrow else 0.7):
                        c = cg[1]
            else:
                c = ground_px(x, y)
                if any(nb.values()) and table[y][x] < 0.45:
                    c = g[1]
            im.putpixel((x, y), c)
    return im

def floor(P, v: int):
    return wc.quiet_floor("wfl", P["wfloor"], v)


def log(P, part: int):
    """쓰러진 통나무(2×1, 투명 바탕): 가로로 누운 줄기. 왼쪽 끝은 잘린 면(나이테), 위는 밝은 껍질, 아래는 그늘, 이끼 점."""
    tr, lf, wd = P["trunk"], P["leaf"], P["wood"]
    im = px.new()
    for x in range(T):
        X = part * T + x
        if X < 2 or X > 30:
            continue
        for y in range(4, 13):
            ry = y - 4                                     # 0..8
            if X <= 5:                                     # 잘린 면(타원)
                ex = (X - 4.0) / 2.6
                ey = (ry - 4.0) / 4.6
                if ex * ex + ey * ey > 1.0:
                    continue
                rr = ((X - 4.0) / 1.6) ** 2 + ((ry - 4.0) / 2.6) ** 2
                c = tr[0] if ex * ex + ey * ey > 0.7 else wd[3] if rr > 0.9 else wd[2] if rr > 0.35 else tr[2]
            else:
                if X == 30 and ry in (0, 8):
                    continue
                c = tr[3] if ry == 1 else tr[2] if ry <= 3 else tr[1] if ry <= 6 else tr[0]
                if ry == 0 or ry == 8 or X == 30:
                    c = tr[0]
                if ry in (3, 6) and (X * 5) % 7 < 3:
                    c = tr[1] if ry == 3 else tr[0]
                if ry == 1 and X % 9 in (2, 3):
                    c = lf[3]
                if ry == 2 and X % 9 == 3:
                    c = lf[2]
            im.putpixel((x, y), c)
        if 3 <= X <= 30:
            for y in (13, 14):
                if y == 13 or X % 2:
                    im.putpixel((x, y), wc.SHADOW)
    return im


def stump(P):
    """그루터기(투명 바탕): 윗면 타원(나이테 2줄), 앞면 껍질 4px, 뿌리 둘, 밑 그림자."""
    tr, wd = P["trunk"], P["wood"]
    im = px.new()
    for x in range(2, 15):
        px.put(im, x, 14, wc.SHADOW)
    for y in range(T):
        for x in range(T):
            ex, ey = (x - 7.5) / 5.6, (y - 6.0) / 3.0
            body = 2 <= x <= 13 and 6 <= y <= 12
            top = ex * ex + ey * ey <= 1.0
            if top:
                rr = ((x - 7.5) / 3.6) ** 2 + ((y - 6.0) / 1.9) ** 2
                c = tr[0] if ex * ex + ey * ey > 0.72 else wd[3] if rr > 1.0 else wd[2] if rr > 0.4 else tr[2]
                im.putpixel((x, y), c)
            elif body:
                c = tr[2] if x <= 4 else tr[1] if x <= 10 else tr[0]
                if x in (2, 13) or y == 12:
                    c = tr[0]
                if x == 7 and y > 8:
                    c = tr[0]
                im.putpixel((x, y), c)
    for x, y in ((1, 12), (1, 13), (2, 13), (14, 12), (14, 13), (13, 13)):
        px.put(im, x, y, tr[0] if y == 13 else tr[1])
    return im


MUSH = [".rRr.", "rRwRr", "oooo.", ".sS.", ".sS."]
# 버섯 배치 6벌(1~3송이, 자리 다름) — 같은 배치가 되풀이되지 않게 섞어 쓴다
MUSH_SPOTS = [((2, 4), (9, 8), (4, 10)), ((8, 2), (3, 7), (10, 10)), ((6, 6),), ((3, 9), (10, 4)), ((9, 9),), ((2, 3), (7, 9))]


def mushrooms(P, v: int, floor_px):
    """버섯 무리(걸을 수 있는 바닥 장식): 숲 바닥 위에 갓 둘~셋(빨강 갓·흰 점 또는 갈색 갓). 갓 윤곽은 갓의 최암."""
    red = P["mush_red"]
    brown = P["trunk"]
    cap = red if v % 2 == 0 else [brown[0], brown[2], brown[3]]
    stem = P["plaster"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), floor_px(x, y))
    spots = MUSH_SPOTS[v]
    for sx, sy in spots:
        # 갓 5×3 + 대 2×2
        for dx in range(5):
            for dy in range(3):
                if dy == 0 and dx in (0, 4):
                    continue
                c = cap[1]
                if dy == 2 or dx == 4 or (dy == 0):
                    c = cap[0] if dy == 2 or dx == 4 else cap[1]
                if dy == 1 and dx in (1, 2):
                    c = cap[2]
                px.put(im, sx + dx, sy + dy, c)
        if v % 2 == 0:
            px.put(im, sx + 1, sy + 1, stem[1])
        for dy in (3, 4):
            px.put(im, sx + 1, sy + dy, stem[1]); px.put(im, sx + 2, sy + dy, stem[0])
        px.put(im, sx + 3, sy + 4, P["wfloor"][0])
    return im


def cut_tree(P):
    """작은 나무(1×1, 투명 바탕, 자르기 이벤트 자리): 잎 덩이 셋(윗왼쪽 빛, 최암 윤곽) + 짧은 줄기 + 발밑 그림자."""
    lf = px.ramp(P["_leaf_hex"])
    t = P["trunk"]
    im = px.new()
    for x in range(3, 13):
        px.put(im, x, 15, P["wfloor"][0])
    for y in range(11, 15):
        for x in (7, 8):
            px.put(im, x, y, t[2] if x == 7 else t[0])
    shape = [(8.0, 6.0, 5.2), (4.6, 8.6, 3.6), (11.4, 8.6, 3.6)]
    inside = wc.lobes(shape)
    wc.shade_obj(im, inside, lf[3], lf[2], lf[1], lf[0], 6, 5, 6, lf[4])
    for x, y in ((7, 9), (8, 9), (5, 10), (10, 10)):
        if inside(x, y):
            px.put(im, x, y, lf[1])
    return im


# ---- 흙길 둥근 끝(I3 Z4 — 맵 안에서 끝나는 남북 흙길이 네모로 뚝 끊겼다) ------------------------------------------
END_MASKS = (4 | 2 | 32, 4 | 8 | 64, 1 | 2 | 16, 1 | 8 | 128, 4, 1)   # 길 끝 칸: 북끝 왼·오른(S|E|SE · S|W|SW), 남끝 왼·오른, 한 칸 폭 북끝·남끝


def dirt_end(P, m: int):
    """흙길 끝 칸 = 본 시트 모래길(monster_overworld.sand_path)과 같은 칠(안 = 흙 덩이 결, 가장자리 안 1px = 짙은 흙·풀 점,
    바깥 1px = 풀 술)인데 바깥 모서리(두 변이 열린 귀)만 칸 전체 사분원으로 깎는다 — 두 칸 폭 길 끝이 반원으로 닫힌다.
    변의 깎임(깊이·흔들림)은 모래길과 같아서 옆·뒤 칸 이음매가 그대로 맞는다. 바탕 풀은 wc.ground_as 로 바꾼 칸(숲 바닥)."""
    import monster_overworld as mo
    name, depth, _radius, amp = mo.AUTOTILE_PARAMS["sand"]
    s, g = P["sand"], P["grass"]
    inside = px.inside_mask(m, name, depth, -1, amp)
    tex = mo.sand_tex(P, 0)
    h = px.rng("sandfringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                c = tex.getpixel((x, y))
                if not all(nb.values()):
                    r = table[y][x]
                    c = s[0] if r < 0.5 else g[3] if r < 0.62 else g[0] if r < 0.7 else c
            else:
                c = mo._GRASS0[(x, y)]
                if any(nb.values()):
                    r = table[y][x]
                    c = g[4] if r < 0.35 else g[0] if r < 0.6 else c
            im.putpixel((x, y), c)
    return im
