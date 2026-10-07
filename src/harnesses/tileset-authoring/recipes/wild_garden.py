"""꽃 정원·열매밭 — 원작 117번 도로 꽃밭(em Route117, z_r117_fl)·123번 도로 열매밭(em Route123, z_r123_berry)을 그려 잰 장소 문법.

장소 문법(원작에서 잰 것):
- 꽃밭은 울타리로 두른 네모 구역 안을 **꽃이 칸을 꽉 채워** 깐다(꽃 사이로 잎만 보인다). 한 꽃밭은 두 색. 꽃머리 자리·색은 칸마다
  무작위(최소 간격 6.5px)라 대각 줄무늬·바둑판이 생기지 않는다. 가장자리는 부드러운 흙 테두리 2px 이고, 테두리에서 3px 안쪽에는 꽃머리를
  찍지 않는다(잘린 꽃 없음 — 빈자리는 작은 꽃봉오리).
- 열매밭은 울타리 안에 **부드러운 흙 1칸**을 한 칸씩 띄어 줄지어 두고, 흙마다 낮은 잎덤불이 선다(열매 2~3알). 덤불은 새싹 → 꽃 →
  열매 단계가 섞여 있고 빈 흙도 같은 받침 하나를 쓴다(덤불 타일은 흙 둔덕째 그려 둔덕이 둘레로 보인다). 덤불 칸은 막혀 있다(조사 이벤트 자리).
- 길은 마을과 같은 밝은 풀 길(clear_at) 또는 디딤돌(칸마다 둥글넓적한 판돌 하나 — 자갈 무더기가 아니다). 생울타리(다듬은 덤불 벽)는
  정원을 가르는 낮은 벽 — 윗면은 잎 덩이(세로로 이어지는 칸은 덩이가 칸 끝까지 이어져 칸마다 끊긴 띠가 보이지 않는다), 앞면 5px,
  끝은 둥글다. 정원 입구는 디딤돌 2칸.
- 정원 바깥 둘레에도 풀 덩이가 있어 야생 조우 지역으로 읽힌다.

깔기 순서(에디터 조수용): 바닥 grass0~3 → 길 clearing → 꽃밭 fbeda(분홍·흰)/fbedb(노랑·빨강) 오토타일(속 변형이 섞인다) → 울타리
fence_at(위층, 입구 2칸 비움) → 열매밭 soil_1 한 칸씩 띄어 → 덤불 berry_red/blue/yellow·berry_sprout·berry_bloom(1×1) →
생울타리 hedge_at<4비트>(위층) → 디딤돌 gstone0/1/2 → 바깥 풀 덩이 tall0/1(바깥 귀는 tall<v>rg<귀 비트> + 남 잎끝 tall_fringe_s_<a|b|ab> · 옆 잎끝 두 벌 tall_fringe_<e|w>_v<n>[_<a|b|ab>], 산 돌흙 위는 tall<v>rm<귀 비트> — 정본 wild_tall).

타일: fbeda_at·fbedb_at 꽃밭(오토타일 + 속 변형 6), fcarpet0~3 테두리 없는 꽃 카펫, soil_1 부드러운 흙, berry_* 열매 덤불(성장 단계),
hedge_at0~15 생울타리, gstone0/1/2 디딤돌."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, T  # noqa: E402
import wild_common as wc  # noqa: E402
import outdoor2 as o2  # noqa: E402

BED_HEAD = [r + "." for r in o2.FLOWER] + ["..L..."]                   # 꽃머리 = 본 시트 꽃밭(o2.flowerbed)과 같은 꽃잎 넷 + 심 + 줄기(QA-L5 G3 — 둥근 네모 단추·사탕이 아니게)


def _fkey(kind, lf):
    o, p = px.hexc(FLOWER_COLS[kind][0]), px.hexc(FLOWER_COLS[kind][1])
    core = px.hexc("#f8e070") if kind != "yellow" else px.hexc("#fff8c0")
    return {"o": o, "P": p, "c": core, "L": lf[0], "H": px.tint(p, 1.12), "D": px.tint(p, 0.84)}

HEAD = [".oo.", "oPPo", "oPco", ".oo."]
FLOWER_COLS = {"pink": ("#c84a6a", "#f07a90"), "white": ("#a8a090", "#fffaf0"), "yellow": ("#c88a1e", "#f8d040"),
               "red": ("#a02830", "#e8505a"), "violet": ("#584a93", "#a090d8")}
CARPETS = [("pink", "white"), ("yellow", "red"), ("violet", "white"), ("pink", "yellow", "violet", "red")]


def carpet(P, v: int, colors=None, jit: int = 0):
    """꽃밭 카펫(걸을 수 있다): 원작 117번 꽃밭처럼 칸마다 꽃머리 넷(2×2, 각 6px — 외곽선·꽃잎·노란 심) 이 잎 위에 꽉 찬다.
    변형마다 두 색이 엇갈린다(대각 둘씩). 주기 16 이라 이어 깔면 꽃이 바둑판처럼 고르게 선다."""
    lf = P["leaf"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), lf[1] if (x + 2 * y) % 5 else lf[2])
    a, b = colors or [("pink", "white"), ("yellow", "red"), ("violet", "white"), ("red", "yellow")][v]
    head = BED_HEAD
    spots = [((1, 1), (9, 0), (0, 9), (8, 8)), ((0, 0), (8, 1), (1, 8), (9, 9)), ((2, 0), (9, 2), (0, 8), (7, 9))][jit % 3]
    order = [(0, 3), (1, 2), (0, 1), (2, 3)][jit % 4]
    for k_, (ox, oy) in enumerate(spots):
        kind = a if k_ in order else b
        key = _fkey(kind, lf)
        for dy, row in enumerate(head):
            for dx, ch in enumerate(row):
                if ch in key:
                    im.putpixel(((ox + dx) % T, (oy + dy) % T), key[ch])
    return im


def soil(P, part: str, grass_px):
    """부드러운 흙 한 칸(걸을 수 있다, 열매 나무 이벤트 자리 — 원작 123번 흙 둔덕): 풀 위 낮고 둥근 흙더미, 윗면 부드러운 흙,
    아래 2px 는 한 단 어두운 흙 앞면 + 최암 한 줄, 밑으로 풀 그늘. 빈 칸·심은 칸 모두 이 받침 하나를 쓴다."""
    md, g = P["mud"], P["grass"]
    im = px.new()

    def inside(x, y):
        return ((x + 0.5 - 8) / 7.2) ** 2 + ((y + 0.5 - 8.6) / 5.4) ** 2 <= 1.0
    r = px.rng(f"soil-{part}")
    for y in range(T):
        for x in range(T):
            c = grass_px(x, y)
            if inside(x, y):
                if not inside(x, y + 1):
                    c = md[0]
                elif not inside(x, y + 2):
                    c = md[1]
                elif not inside(x, y - 1):
                    c = md[3]
                else:
                    c = md[2] if r.random() > 0.18 else md[3]
            elif inside(x, y - 1):
                c = g[0]
            im.putpixel((x, y), c)
    return im


BERRY = {"red": ("#a02830", "#e8505a", "#ffc0c4"), "blue": ("#1e3a8a", "#3858b0", "#a8c8f8"), "yellow": ("#c88a1e", "#f8d040", "#fff8c0")}


def berry_bush(P, kind: str, stage: str = "fruit"):
    """열매 덤불(1×1, 투명 바탕, 흙 칸 위에 찍는다, 통행 불가): 낮고 둥근 잎덤불(덩이 셋, 윗왼쪽 빛, 최암 윤곽) + 잎 사이 열매 2~3알.
    stage: sprout(새싹 두 잎) · bloom(작은 덤불 + 꽃 둘) · fruit(열매)."""
    lf, tr = P["leaf"], P["trunk"]
    b = [px.hexc(h) for h in BERRY[kind]]
    im = px.new()
    if stage == "sprout":
        for x, y, c in ((7, 9, tr[1]), (7, 8, lf[2]), (6, 7, lf[3]), (5, 7, lf[3]), (5, 6, lf[4]), (8, 7, lf[2]), (9, 6, lf[3]), (10, 6, lf[2]), (8, 6, lf[3])):
            px.put(im, x, y, c)
        for x in range(5, 11):
            px.put(im, x, 10, wc.SHADOW)
        return im
    small = stage == "bloom"
    shape = [(8, 5.8, 4.3), (5.2, 7.8, 3.0), (10.8, 7.8, 3.0)] if not small else [(8, 7.0, 3.6), (5.6, 8.6, 2.4), (10.4, 8.6, 2.4)]   # 흙 둔덕이 둘레로 보이게 작게
    inside = wc.lobes(shape)
    for x in range(4, 13):
        px.put(im, x, 11, wc.SHADOW)
    wc.shade_obj(im, inside, lf[3], lf[2], lf[1], lf[0], 6, 5, 6, lf[4])
    if small:
        for bx, by in ((6, 6), (10, 8)):
            px.put(im, bx, by, px.hexc("#fffaf0")); px.put(im, bx + 1, by, px.hexc("#f8d040"))
    else:
        for bx, by in ((5, 7), (10, 4), (8, 8)):
            px.put(im, bx, by, b[1]); px.put(im, bx + 1, by, b[0]); px.put(im, bx, by + 1, b[0]); px.put(im, bx + 1, by + 1, b[0])
            px.put(im, bx, by, b[2])
    return im


def hedge(P, m: int):
    """생울타리(4방향 마스크 16, 투명 바탕, 통행 불가): 다듬은 덤불 벽. 윗면 = 잎 덩이 두 줄(덩이마다 윗왼쪽 빛·최암 윤곽 — 칸
    주기 16 으로 이어진다), 남쪽이 끊기면 앞면 5px(세로 잎 결, 한 단 어둠) + 밑 그늘 1px, 끝은 반지름 3 으로 둥글다."""
    import math
    lf = P["leaf"]
    im = px.new()
    x0 = 0 if m & W else 1
    x1 = T - 1 if m & E else T - 2
    y0 = 0 if m & N else 1
    yb = T - 1 if m & S else 13
    face0 = T if m & S else 9
    rows_ = (3.5, 7.5, 11.5, 15.5) if m & S else (3.5, 7.5)            # 남쪽으로 이어지면 잎 덩이가 칸 끝까지 이어진다(세로 변이 칸마다 끊기지 않게)
    clumps = [(cx + (2 if row % 2 else 0), cy) for row, cy in enumerate(rows_) for cx in (1.5, 5.5, 9.5, 13.5)]

    def round_cut(x, y):
        r = 3
        for cond, cx, cy in ((not m & W and not m & N, x0 + r, y0 + r), (not m & E and not m & N, x1 - r, y0 + r),
                             (not m & W and not m & S, x0 + r, yb - r), (not m & E and not m & S, x1 - r, yb - r)):
            if cond and ((x < cx if cx < 8 else x > cx) and (y < cy if cy < 8 else y > cy)) and (x - cx) ** 2 + (y - cy) ** 2 > r * r + 0.5:
                return True
        return False
    for y in range(T):
        for x in range(T):
            if not (x0 <= x <= x1 and y0 <= y <= yb) or round_cut(x, y):
                continue
            if y >= face0:
                c = lf[1] if (x + (y // 2)) % 3 else lf[0]
                if y == face0:
                    c = lf[2]
                if y == yb:
                    c = lf[0]
            else:
                best = min(clumps, key=lambda q: min(abs(x - q[0]), T - abs(x - q[0])) ** 2 + min(abs(y - q[1]), T - abs(y - q[1]) if m & S else 99) ** 2)
                dx = (x - best[0] + 8) % T - 8
                dy = (y - best[1] + 8) % T - 8 if m & S else y - best[1]
                d = math.hypot(dx, dy)
                light = -(dx + dy) / 3.2
                c = lf[4] if light > 0.7 else lf[3] if light > -0.2 else lf[2]
                if d > 2.6 and (dx + dy) > 0:
                    c = lf[1]
            im.putpixel((x, y), c)
    for y in range(T):                                          # 바깥 윤곽(최암)
        for x in range(T):
            if im.getpixel((x, y))[3] == 0:
                continue
            nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            open_ = [not (0 <= a < T and 0 <= b_ < T) and not ((a < 0 and m & W) or (a >= T and m & E) or (b_ < 0 and m & N) or (b_ >= T and m & S))
                     or (0 <= a < T and 0 <= b_ < T and im.getpixel((a, b_))[3] == 0) for a, b_ in nb]
            if any(open_):
                im.putpixel((x, y), lf[0])
    if not m & S:
        for x in range(x0 + 1, x1 + 1):
            px.put(im, x, 14, wc.SHADOW)
    return im


FBED = ("flower-bed", 2, 4, 1)


def fbed_mask(m):
    return px.inside_mask(m, *FBED)


def flower_bed(P, m: int, grass_px, colors, jit: int = 0):
    """꽃밭(가장자리 오토타일, 걸을 수 있다): 안은 잎 바탕에 꽃머리(6px)를 칸마다 다른 자리에 넷~다섯(최소 간격 6.5px, 변형 jit),
    색 둘이 무작위로 섞인다(대각 줄무늬·바둑판이 생기지 않게). 꽃머리는 흙 테두리에서 3px 이상 떨어진 곳에만 통째로 찍고(잘린 꽃 없음),
    테두리 곁 빈자리는 잎 바탕 그대로 둔다(작은 봉오리 점은 반짝이로 읽혀 뺐다, QA-L7 G5). 가장자리 2px 는 부드러운 흙 테두리(안쪽 한 단 밝음 · 바깥 최암), 바깥은 풀."""
    md, lf = P["mud"], P["leaf"]
    inside = fbed_mask(m)
    dist = [[wc.dist_out(inside, m, x, y, 4) if inside[y][x] else 0 for x in range(T)] for y in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inside[y][x]:
                d = dist[y][x]
                c = md[1] if d == 1 else md[3] if d == 2 else (lf[1] if (x + 2 * y) % 5 else lf[2])
            else:
                c = grass_px(x, y)
                if px.neighbours4(inside, x, y, m)["n"]:
                    c = P["grass"][0]
            im.putpixel((x, y), c)
    head = BED_HEAD
    bud = [".o.", "oPo", ".L."]
    r = px.rng(f"fbed-{m}-{jit}-{colors[0]}")
    placed = []

    def fits(ox, oy, pat, need):
        return all(dist[oy + dy][ox + dx] >= need for dy, row in enumerate(pat) for dx, ch in enumerate(row) if ch != "." and 0 <= oy + dy < T and 0 <= ox + dx < T) \
            and all(0 <= ox + dx < T and 0 <= oy + dy < T for dy, row in enumerate(pat) for dx, ch in enumerate(row) if ch != ".")

    def stamp(ox, oy, pat, kind):
        key = _fkey(kind, lf)
        for dy, row in enumerate(pat):
            for dx, ch in enumerate(row):
                if ch in key:
                    im.putpixel((ox + dx, oy + dy), key[ch])
    if m != 255:
        # 가장자리 칸: 꽃머리를 8px 격자(칸 사이로 이어지는 심은 줄)에 한 색으로 — 같은 칸 무늬가 되풀이되는 대신
        # 테두리를 따라 가지런히 심은 꽃줄로 읽힌다(QA-L2 G1). 격자 사이 빈자리는 봉오리.
        for oy in (1, 9):
            for ox in (1, 9):
                # 격자 자리가 테두리에 걸리면 안쪽으로 3~4px 당겨 본다(한 줄짜리 꽃밭·옆 칸에도 꽃머리가 선다).
                # 꽃잎과 흙 테 사이에 잎 1px 이상(need 4) — 모서리 칸 꽃이 테에 닿아 넘쳐 보였다(QA-L6 G4)
                for ddx, ddy in ((0, 0), (0, 3), (0, -3), (3, 0), (-3, 0), (0, 4), (0, -4), (4, 0), (-4, 0), (3, 3), (-3, -3), (3, -3), (-3, 3)):
                    qx, qy = ox + ddx, oy + ddy
                    if 0 <= qx <= 10 and 0 <= qy <= 10 and fits(qx, qy, head, 4) and not any((qx - a) ** 2 + (qy - b) ** 2 < 6.5 ** 2 for a, b in placed):
                        placed.append((qx, qy))
                        stamp(qx, qy, head, colors[0])          # 가장자리는 한 색 꽃 테(심은 테두리) — 두 색 교대 규칙 배열이 아니게(QA-L4 G1)
                        break
        for oy in (5, 13):
            for ox in (6, 14):
                if fits(ox - 1, oy - 1, bud, 3) and not any(abs(ox - a - 2.5) < 4.5 and abs(oy - b - 2.5) < 4.5 for a, b in placed):
                    pass                                        # 봉오리 점은 찍지 않는다 — 1~2px 흰·빨강 점이 반짝이로 읽혔다(QA-L7 G5)
        return im
    for _ in range(60):
        ox, oy = r.randint(0, 10), r.randint(0, 10)
        if len(placed) >= 5 or any((ox - a) ** 2 + (oy - b) ** 2 < 6.5 ** 2 for a, b in placed) or not fits(ox, oy, head, 3):
            continue
        placed.append((ox, oy))
        stamp(ox, oy, head, colors[r.randrange(2)])
    buds = []
    for _ in range(40):
        ox, oy = r.randint(0, 13), r.randint(0, 13)
        if len(buds) >= 2 or any(abs(ox + 1 - a - 2.5) < 4.5 and abs(oy + 1 - b - 2.5) < 4.5 for a, b in placed) or any((ox - a) ** 2 + (oy - b) ** 2 < 16 for a, b in buds) \
                or not fits(ox, oy, bud, 3):
            continue
        buds.append((ox, oy))
        r.randrange(2)                                  # 봉오리 점은 찍지 않는다(QA-L7 G5) — 난수 순서는 그대로
    return im


def stepping(P, v: int, grass_px):
    """디딤돌(걸을 수 있다): 땅과 높이가 같은 납작한 판돌 하나(폭 11~12px, 높이 5~6px — 볼록한 돌덩이로 읽히지 않게, QA-L3 G2).
    윗면은 동굴 바닥 램프(회갈), 위·왼 가장자리 한 단 밝음 + 왼위 2px 햇빛, 아래 가장자리 1px 만 짙다. 그림자는 없다(땅에 묻혔다).
    모양 둘: 둥근 타원(v 0·2)과 귀가 각진 판석(v 1). 변형마다 자리·이 빠진 귀가 다르다."""
    cf = P["cave_floor"]
    hi = px.hexc("#dccb98")
    cx, cy, rx, ry, chip, ex = [(7.6, 8.0, 6.0, 3.0, (12, 6), 2.0), (8.2, 8.4, 5.7, 2.8, (3, 10), 3.2), (7.8, 7.6, 6.2, 3.1, (11, 10), 2.0)][v % 3]
    im = px.new()

    def ins(x, y):
        if (x, y) == chip:
            return False
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        return abs(dx) ** ex + abs(dy) ** ex <= 1.0
    for y in range(T):
        for x in range(T):
            c = grass_px(x, y)
            if ins(x, y):
                if not ins(x, y + 1):
                    c = cf[1]                                   # 아래 가장자리 1px
                elif not ins(x + 1, y):
                    c = cf[2]
                elif not ins(x - 1, y) or not ins(x, y - 1):
                    c = cf[4]
                elif (x - (cx - rx * 0.5)) ** 2 + ((y - (cy - ry * 0.45)) * 2) ** 2 < 3.0:
                    c = hi                                      # 왼위 햇빛
                else:
                    c = cf[3] if ((x * 5 + y * 3 + v) % 9) else cf[2]
            im.putpixel((x, y), c)
    return im
