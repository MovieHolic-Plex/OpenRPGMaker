"""눈 지역 — 눈 마을(본 시트 마을 문법)과 얼음 퍼즐 눈길(em ShoalCave_LowTideIceRoom 문법).

원작에서 잰 문법:
- 눈 마을: 걷는 땅은 다져진 눈길(snowpath, 새 눈보다 한 단 어둡다) — 둘레 고리 + 가운데 큰길(2칸) + 가로길. 집·센터·얼어붙은 연못은 새 눈(snow) 섬 위.
  마을을 눈 덮인 침엽수 숲 벽(sforest_)이 감싸고 출구는 숲 틈 2칸. 문 앞 칸은 비운다. 길가에 외톨이 침엽수(spine_a)·눈더미·얼어붙은 덤불.
- 지붕의 눈은 지붕 모양을 따라 덮는다: 먼 비탈 그늘 → 용마루가 묻힌 둥근 혹 → 앞 비탈(왼쪽 위 빛, 오른쪽 그늘) → 처마 끝 2px 눈 턱 → 드러난 지붕 한 띠 → 고드름.
  눈 윤곽은 눈의 가장 어두운 톤(#8e9ecc). 센터 같은 곡면 지붕도 곡선을 따른다(center_snow).
- 침엽수: 세 단 삼각 치마, 단마다 윗면에 눈 띠(왼쪽 흰 눈, 오른쪽 청회 그늘), 그 밑 짙은 녹청 잎, 밑단 뾰족한 잎 끝. 줄기는 채도 낮춘 암갈색.
- 얼음방: 얼음 판(ice, 사선 줄무늬)을 눈 벼랑(정본 두 그룹을 눈 색으로 — 윗면 icecliff + 앞면 두 줄 iceface)이 **바로** 감싼다. 드나드는 곳은 2칸 폭 틈 둘뿐.
  얼음 위에서는 들어온 방향으로 벽·바위까지 미끄러진다(slide ice). 얼음 바위(ice_rock — 정본 던전 ice_cave 얼음 바위 dungeon_cavern.ice_rock 를 그대로 부른다)가 멈춤 칸이다.
  견본 퍼즐: 얼음 14×8 · 바위 9개 · 남→북·북→남 모두 최소 11수. 도로를 막는 얼음방은 **양방향 모두** 풀려야 한다(한쪽만 풀리면 사람을 가둔다, L4 N3).
  바위 하나만 빼도 출구에 못 가는 배치가 좋은 퍼즐이다.
- 바닥 질감은 조용하게: 눈밭은 바탕 + 한 단 밝은 덩이 몇 개, 반짝임은 드문 변형에만. 눈길 경계는 윤곽선 없이 밝은 눈 턱 1px.
- 눈 턱(sledge_*)은 남쪽으로만 뛰어내린다. 눈 덮인 키 큰 풀(stall)은 들쭉날쭉한 덩이로 깐다(모서리 칸을 뺀다)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import climate_common as cc  # noqa: E402
import buildings as bd  # noqa: E402  (정본 지붕 높이 ROOF_H — 49 를 적지 않는다, 통합 I4 W1)

PARAMS = {
    "snowpath": ("snow-path", 3, 5, 2),
    "pond_outer": ("pond-outer", 0, 8, 0),
    "pond_inner": ("pond-inner", 6, 3, 0),
}


def snow_tex(P, v: int):
    """눈밭: 바탕(#dde6f4) + 한 단 밝은 덩이 몇 개만(조용하게 — 적대 검수 1차 17번 「지글거린다」). 흰 반짝임은 변형 3 에만 하나."""
    s = P["snow"]
    return px.clumps(f"snow{v}", s[4], [(s[5], 6 + v, 3)] + ([(s[6], 1, 1)] if v == 3 else []))   # 반짝임은 1px 하나(2×2 는 줄지어 점선이 됐다, L4 N1)


_SNOW0: dict = {}


def init(P):
    _SNOW0.clear(); _SNOW0.update(cc.tex_table(snow_tex(P, 0)))


def snow0(x, y):
    return _SNOW0[(x, y)]


def snowpath_tex(P, v: int = 0):
    """다져진 눈길 바탕: 한 단 어두운 눈(#cbd5ea) + 바탕 눈 덩이. 변형마다 덩이 자리가 달라 칸 격자가 안 보인다(1차 18번).
    더 어두운 점(#b4c2e0)은 넣지 않는다 — 칸마다 같은 x 에 찍혀 두 칸 폭 큰길 가운데 세로 점선(차선)으로 읽혔다(L2 N3)."""
    s = P["snow"]
    return px.clumps(f"snowpath{v}", s[3], [(s[4], 5 + v, 3)])


def snowpath(P, m: int, v: int = 0):
    """다져진 눈길: 안은 한 단 어두운 눈, 윤곽선은 없다 — 경계는 바깥 새 눈 쪽 1px 밝은 눈 턱(톤 차이만, 1차 5번 「도랑 같다」)."""
    s = P["snow"]
    tex = snowpath_tex(P, v)
    h = px.rng("snowpath-fringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    def rim_out(x, y, d):
        if d == 1:
            return s[5] if table[y][x] < 0.75 else None
        return None
    return cc.blob_tile(m, PARAMS["snowpath"], lambda x, y: tex.getpixel((x, y)), snow0, None, rim_out)




def pond(P, m: int):
    """얼어붙은 연못: 바깥 눈 → 눈 모자 쓴 돌 고리 → 짙은 얼음(금 선·반짝임). 돌 고리 안쪽 한 줄은 밝은 얼음 테."""
    pd, st, s = P["pond"], P["stone"], P["snow"]
    outer = px.inside_mask(m, *PARAMS["pond_outer"])
    inner = px.inside_mask(m, *PARAMS["pond_inner"])
    im = px.new()
    crack = {(3, 5), (4, 5), (5, 6), (6, 6), (7, 7), (7, 8), (8, 9), (6, 9), (5, 10), (11, 12), (12, 12), (12, 13), (13, 3), (13, 4)}
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = pd[2]
                band = (x + y) % 16
                if band in (0, 1, 2) or band == 9:
                    c = pd[3]                                        # 넓은 빛 띠 + 가는 빛 띠(얼음 광택)
                if (x, y) in crack:
                    c = pd[1]                                        # 얼음 금
                if not all(px.neighbours4(inner, x, y, m).values()):
                    c = pd[1]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                c = cc.stone_px(st, x, y, cap=s[6])
                if not all(px.neighbours4(outer, x, y, m).values()):
                    c = st[0]
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), snow0(x, y))
    return im


def masks(kind: str) -> dict:
    return cc.masks(PARAMS[kind])


# ---- 소품 -----------------------------------------------------------------------------------
def snowman(P):
    """눈사람(1×2): 큰 몸통 + 머리, 숯 눈 둘·당근 코·나뭇가지 팔, 밑 그림자. 위 칸은 머리(위층)."""
    s, tr = P["snow"], P["trunk"]
    cv = px.new(T, 2 * T)
    ramp = [s[1], s[2], s[3], s[5], s[6]]
    body = cc.lobes([(8.0, 24.2, 6.2)])
    head = cc.lobes([(8.0, 13.6, 4.4)])
    for y in range(2 * T):                                          # 그림자(오른쪽 2·아래 3)
        for x in range(T):
            if not body(x, y) and body(x - 2, y - 3) and y >= 24 and x <= T - 2 and y <= 2 * T - 2 and (x, y) != (T - 2, 2 * T - 2):   # 칸 끝 1px 안에서 끝난다(L8 K1)
                cv.putpixel((x, y), cc.SHADOW)
    for shape, cy, r in ((body, 24.2, 6.2), (head, 13.6, 4.4)):
        for y in range(2 * T):
            for x in range(T):
                if not shape(x, y):
                    continue
                edge = [not shape(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
                light = -((x - 8.0) + (y - cy)) / r
                if edge[1] or edge[2]:
                    c = ramp[0]
                elif edge[0] or edge[3]:
                    c = ramp[1]
                else:
                    c = ramp[4] if light > 0.75 else ramp[3] if light > 0.1 else ramp[2]
                cv.putpixel((x, y), c)
    for x in range(4, 13):                                          # 머리와 몸통 사이 목 그늘
        if head(x, 17) and body(x, 18):
            cv.putpixel((x, 18), ramp[1])
    coal = px.hexc("#30343c")
    for (x, y) in ((6, 12), (9, 12), (8, 21), (8, 24), (8, 27)):  # 눈 둘 + 단추 셋
        cv.putpixel((x, y), coal)
    cv.putpixel((8, 14), P["roof_orange"][3]); cv.putpixel((9, 14), P["roof_orange"][2]); cv.putpixel((10, 14), P["roof_orange"][1])
    for i, (x, y) in enumerate(((1, 19), (2, 20), (3, 21), (12, 21), (13, 20), (14, 19), (1, 18), (14, 18))):   # 나뭇가지 팔(칸 끝 1px 안으로 접는다, L8 K1)
        px.put(cv, x, y, tr[1] if i % 3 else tr[0])
    return cv


def icicles(P):
    """고드름 결정(통행 불가): 바닥에서 솟은 얼음 가시 다섯 — 가운데가 가장 크고, 가시마다 왼쪽 면 밝음·오른쪽 면 어둠, 밑에 눈 받침."""
    c, s = P["ice"], P["snow"]
    im = px.new()
    spikes = [(8, 1, 3.2), (4, 6, 2.2), (12, 5, 2.4), (6, 9, 1.6), (10.5, 9, 1.8)]
    for x in range(3, 15):
        for y in (14, 15):
            if (x, y) != (3, 15) and (x, y) != (14, 15):
                im.putpixel((x, y), cc.SHADOW)
    for cx, top, hw in spikes:
        for y in range(top, 14):
            half = hw * (y - top + 1) / (14 - top)
            for x in range(int(cx - half - 1), int(cx + half + 2)):
                u = (x + 0.5 - cx) / max(half, 0.5)
                if abs(u) > 1.0:
                    continue
                col = c[4] if u < -0.35 else c[3] if u < 0.2 else c[1]
                if u > 0.7 or y == 13:
                    col = c[0]
                px.put(im, x, y, col)
    for x in range(2, 14):                                          # 밑동 눈 받침
        for y in (12, 13):
            if abs(x - 8) <= (6 if y == 13 else 5):
                im.putpixel((x, y), s[5] if y == 12 and x < 9 else s[3] if y == 12 else s[2])
    im.putpixel((2, 13), s[1]); im.putpixel((13, 13), s[1])
    return im


def snow_sign(P):
    """눈 모자를 쓴 나무 표지판 — 본 시트 표지판(outdoor2.sign) 위에 눈 한 덩이."""
    import outdoor2 as o2
    s = P["snow"]
    im = o2.sign(P)
    for x in range(2, 14):                                          # 판 윗변 위로 눈 한 덩이(위가 밝고 아래 파란 그늘)
        im.putpixel((x, 0), s[2] if x in (2, 13) else s[5])
    for x in range(1, 15):
        im.putpixel((x, 1), s[1] if x in (1, 14) else s[6] if x < 9 else s[5])
    for x in (3, 4, 5, 9, 10):                                      # 녹아 늘어진 눈 끝
        im.putpixel((x, 2), s[3])
    return im


def snow_roof(P, im, n: int, seed: str, roof_key: str):
    """지붕에 쌓인 눈(집 그림의 지붕 bd.ROOF_H 행을 다시 그린다 — 원작 눈 마을 문법: 눈은 지붕 모양을 따라 덮이고 처마에서 두께가 보인다).
    행 좌표는 정본 지붕(buildings.roof_flat)의 구조에서 읽는다: 위쪽 벽돌 1..up, 용마루 띠 ry..ry+7, 줄눈 ry+8, 앞 기와 ry+9..H-4, 가장자리 띠 H-3..H-1
    (H = ROOF_H 33 이면 up 4 · ry 5, 옛 49 면 up 8 · ry 9). 49 를 적지 않는다(통합 I4 W1).
    눈 4톤(roof_snow: 윤곽 #8e9ecc · 그늘 · 바탕 · 왼쪽 위 빛), 윤곽은 눈의 가장 어두운 톤(지붕 색 아님).
    재 지붕(ash_roof)과 같은 「띠 + 덩이」 문법이고 지붕 결은 다시 그리지 않는다(I2 Y4 — 위 2/3 를 덮은 흰 판·양끝 둥근 고리는 두루마리처럼 읽혔다):
    - 먼 비탈(위쪽 벽돌) = 눈 띠, 아랫변이 물결쳐 그 밑으로 지붕 결이 드러난다. 용마루 윗줄에만 눈(물결 아랫변), 마개 자리도 같은 띠.
    - 앞 비탈 = 처마 쪽으로 볼록한 눈 덩이 2~3개(왼쪽 위 빛, 오른쪽 3분의 1 그늘), 덩이 사이 1~2px 틈으로 위 기와 줄이 비친다.
      덩이 윗변은 물결치며 위 모서리는 2px 둥글다. 용마루 눈 띠도 같은 틈에서 끊긴다(I3 Z1).
    - 덩이마다 윗변 높이·밑변 높이·볼록한 처짐이 다르고 가운데 덩이가 2~3px 좁다 — 같은 방석 세 장이 칸 경계 한 직선에 앉은 것처럼 읽혔다(I4 W1).
      밑변은 칸 경계(16·32행)에 닿지 않는다.
    - 덩이 아랫변은 2px 두께 눈 턱(그늘) + 윤곽 한 줄, 그 밑으로 본 지붕 기와 줄이 처마까지 드러난다(지붕 3톤으로 줄인다, I1 X5).
    - 처마 밑 고드름 몇 개(흰 → 그늘 끝)."""
    H = bd.ROOF_H
    up = 8 if H >= 49 else 4                                            # 정본 roof_flat 과 같은 식
    ry = 1 + up                                                         # 용마루 띠 첫 행
    F = ry + 8                                                          # 앞 비탈 첫 행(줄눈)
    rs = P["roof_snow"]
    ol, shade, body = rs[1], rs[2], rs[3]
    lite = body                                                         # 집 한 채 16색 한도: 거의 안 보이던 흰 빛(#fbfcff) 대신 한 단 그늘(mid)로 입체를 준다
    mid = P["snow"][4]                                                  # 바탕과 그늘 사이 한 단(눈밭 바탕색 — 새 색을 늘리지 않는다)
    rf = P[roof_key]
    w = n * T
    r = px.rng(f"snowroof3-{seed}")
    out = im.copy()
    remap = {rf[4][:3]: rf[3], rf[1][:3]: rf[2]}                       # 드러난 지붕 띠는 3톤(최암·중·명)만 — 집 한 채 색 16 한도
    for y in range(H):
        for x in range(w):
            c = out.getpixel((x, y))
            if c[3] and c[:3] in remap:
                out.putpixel((x, y), remap[c[:3]])
    for y in range(H - 3, H):
        for x in range(2, w - 2):
            out.putpixel((x, y), rf[2] if y == H - 3 else rf[3] if y == H - 2 else rf[0])
    def put(x, y, c):
        if 0 <= x < w and 0 <= y < H and out.getpixel((x, y))[3]:
            out.putpixel((x, y), c)
    # 먼 비탈: 눈이 덮되 아랫변이 물결쳐 그 밑으로 지붕이 드러난다(재 지붕과 같은 「띠」 문법, I2 Y4)
    ph = r.uniform(0, 6.28)
    fars = set()                                                        # 먼 비탈의 밝은 눈 덩이(2~4px, 왼쪽에 몰린다)
    for _ in range(1 + n // 3):
        cx, cy = r.randint(4, int(w * 0.45)), r.randint(1, max(1, up // 2))
        for dx in range(r.randint(3, 5)):
            fars.add((cx + dx, cy))
    for x in range(1, w - 1):
        if up >= 8:
            yb = 5 + round(1.3 * math.sin(x * 0.27 + ph) + 0.5 * math.sin(x * 0.71))   # 긴 물결(짧은 톱니는 장식 띠로 읽힌다)
        else:
            yb = up - (1 if math.sin(x * 0.27 + ph) + 0.4 * math.sin(x * 0.71) > 0.55 else 0)   # 짧은 지붕(4줄 벽돌): 거의 다 덮고 물결 골에서만 한 줄 드러난다
        for y in range(0, yb + 1):
            if y == 0 or x in (1, w - 2):
                c = ol
            elif y == yb:
                c = shade
            else:
                c = body if (x, y) in fars else mid if x < w * 0.6 else shade
            put(x, y, c)
    # 앞 비탈 덩이 자리(틈)를 먼저 정한다 — 용마루 눈 띠도 같은 틈에서 끊는다(I3 Z1). 가운데 덩이는 2~3px 좁게(I4 W1).
    k = 3 if n >= 4 else 2
    gaps = []
    edges = [1]
    for i in range(1, k):
        g = round(w * i / k) + (r.randint(-3, 3) if k == 2 else (r.randint(1, 2) if i == 1 else -r.randint(1, 2)))
        gw = r.choice((1, 2))
        gaps.append((g, g + gw)); edges += [g - 1, g + gw]
    edges.append(w - 2)
    lumps = [(edges[2 * i], edges[2 * i + 1]) for i in range(k)]
    # 용마루: 윗줄에만 눈이 얹힌다(물결 아랫변) — 양끝 마개 자리도 같은 띠, 둥근 고리는 그리지 않는다.
    # 띠는 지붕 끝에서 끝까지 곧은 한 줄이면 홈통처럼 읽혀서(I3 Z1) 덩이 틈 자리 1~2px 를 끊고, 끊긴 끝은 윤곽으로 닫는다.
    ph2 = r.uniform(0, 6.28)
    cut = set()
    for g0, g1 in gaps:
        for x in range(g0, g1):
            cut.add(x)
    for x in range(0, w):
        if x in cut:
            continue
        yb = ry + (2 if up >= 8 else 1) + round(0.8 * math.sin(x * 0.31 + ph2))
        end = x - 1 in cut or x + 1 in cut
        for y in range(ry, yb + 1):
            if (x in (0, w - 1) or end) and y in (ry, yb):
                continue                                                # 끝 마개·끊긴 끝 모서리는 둥글게
            c = ol if x in (0, w - 1) or end else shade if y == yb else body
            put(x, y, c)
    # 앞 비탈: 처마 쪽으로 볼록한 눈 덩이 2~3개, 덩이 사이 1~2px 틈으로 위 기와 줄이 비친다(I2 Y4). 덩이 밑으로 기와 줄이 처마까지 드러난다(I1 X5).
    # 덩이마다 윗변(0·1·2px)·밑변(서로 다른 높이)·처짐 폭이 다르다(I4 W1 — 세 덩이 밑변이 칸 경계 한 직선에 맞춘 같은 판이었다).
    depth = H - 3 - F                                                   # 앞 비탈 행 수(33 → 17, 49 → 29)
    dtop = r.sample([0, 1, 2], k)                                       # 덩이 윗변 차이
    dbot = r.sample([0, 1, 3], k) if depth < 24 else [r.randint(0, 2) for _ in range(k)]   # 덩이 밑변 차이(서로 다르게)
    bulge = r.sample([1.0, 1.4, 2.0], k)                                 # 처짐도 덩이마다(큰 볼록은 덩이를 구름 타원으로 만든다)
    lip = [-1] * w
    top = [99] * w
    for i, (x0, x1) in enumerate(lumps):
        base = F + (5 if depth < 24 else 9) + dbot[i]
        bw = x1 - x0 + 1
        t0 = (ry + 3 if depth < 24 else F) + dtop[i]                    # 짧은 지붕: 덩이가 용마루 띠 아랫단부터 덮는다 — 기와 한복판에 뜨면 구름으로 읽혔다
        ph3 = r.uniform(0, 6.28)
        for x in range(x0, x1 + 1):
            t = (x - x0 + 0.5) / bw
            lip[x] = base + round(bulge[i] * (1 - (2 * t - 1) ** 2)) - (1 if x in (x0, x1) else 0)   # 덩이 아랫변: 가운데가 처마 쪽으로 볼록, 양끝은 둥글게 올라간다
            if lip[x] + 1 in (T - 1, 2 * T - 1):
                lip[x] -= 1                                                 # 밑변 윤곽이 칸 경계 바로 위 줄에 서지 않게
            corner = 2 if x in (x0, x1) else 1 if x in (x0 + 1, x1 - 1) else 0
            top[x] = min(t0 + 2, max(t0 - 1, t0 + round(1.2 * math.sin(x * 0.32 + ph3)))) + corner   # 덩이마다 다른 높이 + 1~2px 물결
    streaks = set()
    for y0 in (F + 3, F + 5):
        xx = 5 + r.randint(0, 8)
        while xx < w - 12:
            ln = r.randint(4, 7)
            for i in range(ln):
                streaks.add((xx + i, y0))
            xx += ln + r.randint(9, 15)
    lites = set()
    for _ in range(3 + n):
        cx, cy = r.randint(4, int(w * 0.38)), r.randint(F + 2, F + 4)
        for dx in range(r.randint(3, 6)):
            lites.add((cx + dx, cy)); lites.add((cx + dx, cy + 1)) if dx % 2 else None
    for (x0, x1) in lumps:
        for x in range(x0, x1 + 1):
            for y in range(top[x], lip[x] + 2):
                edge = y == top[x] or (x in (x0, x1)) or (x - 1 >= x0 and y < top[x - 1]) or (x + 1 <= x1 and y < top[x + 1])
                if y == lip[x] + 1 or edge:
                    c = ol                                              # 윗변·옆변·아랫변 모두 눈 최암 윤곽(물결 윗변의 계단 옆면도)
                elif y >= lip[x] - 1:
                    c = shade                                           # 눈 턱(앞 두께 2px)
                elif x > w * 0.88 + (y - F - 1) * 0.2 or (x > w * 0.88 + (y - F - 1) * 0.2 - 1 and (x + y) % 2):
                    c = shade                                           # 오른쪽 끝 그늘(비스듬한 경계)
                elif y == lip[x] - 2 or x > w * 0.66 + (y - F - 1) * 0.3 or x == x1 - 1:
                    c = shade                                           # 앞 비탈 오른쪽 3분의 1·덩이 오른쪽 둥근 옆·처마 위 한 줄 = 청회 그늘(빛은 왼쪽 위)
                elif y == lip[x] - 3 or x > w * 0.66 + (y - F - 1) * 0.3 - 3 or (x, y) in streaks:
                    c = mid
                elif (x, y) in lites:
                    c = lite
                else:
                    c = body
                put(x, y, c)
    x = r.randint(4, 8)                                                 # 고드름: 처마 밑 2~4px
    while x < w - 4:
        ln = r.randint(2, 4)
        for k in range(ln):
            yy = H + k
            if out.getpixel((x, yy))[3]:
                out.putpixel((x, yy), lite if k < ln - 1 else shade)
        x += r.randint(9, 14)
    return out


def snow_cap(P, im, seed: str, depth: int = 8, ymax: int = 64, roof_ramp=None):
    """큰 건물(센터 등) 곡면 지붕에 눈: 열마다 지붕 맨 윗점부터 depth±2px 를 눈이 덮는다(지붕 곡선을 그대로 따른다).
    맨 윗점은 눈 윤곽(#8e9ecc — 지붕 진홍 윤곽을 덮는다), 그 밑 1px 빛, 바탕 눈, 아래 2px 그늘(눈 두께). 처마(지붕 램프 마지막 줄) 밑에 고드름."""
    rs = P["roof_snow"]
    ol, shade, body, lite = rs[1], rs[2], rs[3], rs[4]
    r = px.rng(f"snowcap2-{seed}")
    out = im.copy()
    w = im.width
    bumps = []
    x = 0
    while x < w:
        bw = r.randint(7, 11)
        for i in range(bw):
            t = (i + 0.5) / bw
            bumps.append(round(2.0 * (1 - (2 * t - 1) ** 2)))
        x += bw
    roofc = {tuple(c[:3]) for c in (roof_ramp or [])}
    eave = {}
    filled = [x for x in range(w) if any(im.getpixel((x, y))[3] == 255 for y in range(ymax))]
    xmin, xmax = min(filled), max(filled)
    mid = P["snow"][4]
    xm = xmin + (xmax - xmin) * 0.56                                    # 용마루 오른쪽 = 그늘 비탈
    xr = xmin + (xmax - xmin) * 0.86
    for x in range(w):
        ys = [y for y in range(ymax) if im.getpixel((x, y))[3] == 255]
        if not ys:
            continue
        top = ys[0]
        if top > ymax - 12:
            continue
        rys, gap = [], 0                                                # 처마 = 위에서 내려오며 처음 이어진 지붕 덩이의 아랫변만(그 밑 벽의 문장은 지붕 램프 색이라도 세지 않는다, L6 N1)
        for y in range(top, ymax):
            c = im.getpixel((x, y))
            if c[3] == 255 and c[:3] in roofc:
                rys.append(y); gap = 0
            elif rys:
                gap += 1
                if gap >= 3:
                    break
        if rys:
            eave[x] = max(rys)
        lo = top + depth + bumps[x]
        side = x in (xmin, xmax)
        for y in range(top, min(lo, ymax - 4) + 2):
            if im.getpixel((x, y))[3] != 255:
                continue
            c = rs[0] if (y == top or y == lo + 1 or side) else shade if lo - y <= 1 or (x > xr and lo - y <= 4) \
                else shade if x > xm or (x > xm - 1 and (x + y) % 2) else lite    # 덮개 위 면은 땅 눈보다 한 단 밝게, 오른쪽 비탈은 땅보다 한 단 짙은 청회, 윤곽은 최암(L2 N4·L3 N1)
            out.putpixel((x, y), c)
    xs = sorted(eave)
    if xs:
        x = xs[0] + r.randint(3, 6)
        while x < xs[-1] - 2:
            if x in eave and x + 1 in eave:
                ln = r.randint(3, 5)                                    # 고드름: 위 2px 폭 → 1px, 흰 몸 + 그늘 오른쪽 + 그늘 끝(벽 위에서도 보이게)
                for k in range(ln):
                    yy = eave[x] + 1 + k
                    if yy < im.height and out.getpixel((x, yy))[3]:
                        out.putpixel((x, yy), lite if k < ln - 1 else ol)
                    if k < 2 and yy < im.height and out.getpixel((x + 1, yy))[3]:
                        out.putpixel((x + 1, yy), shade if k == 0 else ol)
            x += r.randint(9, 14)
    return out


# ---- 눈 덮인 침엽수 = 정본 본 시트 침엽수(trees.pine_tiered, pine_a 와 같은 씨앗)를 눈 숲 램프로 + 단 어깨 눈 모자(통합 검수 I1 X2) ----
_PINE_SEED: list[str] = []


def base_pine_seed() -> str:
    """본 시트 pine_a 의 씨앗 — 본 시트와 같은 관문 표본 추출(monster_overworld.pick_by_gate)을 본 시트 시드로 다시 돌려 고른다(야생 pine_m 과 같은 그림)."""
    if not _PINE_SEED:
        import json
        import trees
        import monster_overworld as mo
        from pokemon_overworld import palette
        root = Path(__file__).resolve().parents[4]
        bs = json.loads((root / "harness-data/tileset-authoring/monster-overworld/seed.json").read_text())
        P2 = dict(palette(bs), _leaf_hex=bs["palette"]["leaf"])
        got, _ = mo.pick_by_gate(bs, P2, lambda sd: trees.pine_tiered(P2, seed=sd), "pine", 1)
        _PINE_SEED.append(got[0][0] if got else "pine-fallback")
    return _PINE_SEED[0]


def _snow_caps(P, im, ymax: int):
    """단 어깨 눈 모자: (1) 윗단 톱니 밑 그림자 줄(가로로 이어진 최암 줄) 바로 아래 = 아래 단 가지 윗면 2px, (2) 하늘에 드러난 단 어깨·꼭대기 1~2px 를
    눈으로 — 빛 받는 왼쪽은 흰 눈, 가운데 밝은 눈, 오른쪽 그늘 쪽은 덮지 않는다(잎이 비친다). 잎 모양·단 톱니·윤곽은 정본 그대로."""
    s = P["snow"]
    lf0 = None
    out = im.copy()
    op = lambda x, y: 0 <= x < im.width and 0 <= y < im.height and im.getpixel((x, y))[3] == 255
    cols = {}
    for y in range(im.height):
        for x in range(im.width):
            if op(x, y):
                c = im.getpixel((x, y))[:3]
                cols[c] = cols.get(c, 0) + 1
    dark = min(cols, key=lambda c: sum(c)) if cols else None          # 잎 최암(윤곽·그림자 줄)
    for x in range(im.width):
        u = (x + 0.5 - 16) / 12
        if u > 0.35:
            continue
        for y in range(1, min(ymax, im.height)):
            if not op(x, y) or im.getpixel((x, y))[:3] == dark:
                continue
            above = im.getpixel((x, y - 1))
            sky = above[3] == 0
            under_tier = above[3] == 255 and above[:3] == dark and (op(x - 1, y - 1) and im.getpixel((x - 1, y - 1))[:3] == dark
                                                                   or op(x + 1, y - 1) and im.getpixel((x + 1, y - 1))[:3] == dark)
            if not (sky or under_tier):
                continue
            n = 2 if (under_tier and u < 0.1) else 1
            for d in range(n):
                if op(x, y + d) and im.getpixel((x, y + d))[:3] != dark:
                    out.putpixel((x, y + d), s[6] if u < -0.25 else s[5])
    return out


def _pine_body(P):
    return dict(P, _leaf_hex=P["_pine_body_hex"], trunk=P["trunk_snow"])


def pine_crown(P, seed: str = "snow-pine"):
    """숲 벽 그루 수관(32×(32+LIFT)) = 정본 침엽수 trees.pine_tiered(본 시트 씨앗)의 잎만(발밑 그늘·줄기는 숲 조립이 그린다) + 단 어깨 눈 모자.
    반환 (그림, 마스크) — climate_forest.forest_canvas 의 crown_fn 계약."""
    import forest
    import trees
    real, first = trees.px, []

    class _Px:                                                       # pine_tiered 의 첫 px.put 대상(발밑 그늘·줄기 바탕)은 건너뛴다 — 잎만 남긴다
        def __getattr__(self, k):
            return getattr(real, k)

        def put(self, im, x, y, c):
            if not first:
                first.append(im)
            if im is first[0]:
                return
            real.put(im, x, y, c)
    trees.px = _Px()
    try:
        full = trees.pine_tiered(_pine_body(P), seed=base_pine_seed())
    finally:
        trees.px = real
    H_ = forest.STEP + forest.LIFT
    crown = _snow_caps(P, full.crop((0, 0, forest.STEP, H_)), H_)
    mask = [[crown.getpixel((x, y))[3] == 255 for x in range(forest.STEP)] for y in range(H_)]
    return crown, mask


def lone_pine(P):
    """길가 외톨이 침엽수(2×3) = 정본 본 시트 침엽수(야생 pine_m 과 같은 함수 monster_wild._pine_on — 발밑 그늘만 눈 그늘 두 톤)를
    눈 숲 램프로 그리고 단 어깨에 눈 모자. 투명 바탕(눈 위에 위층으로 찍는다)."""
    import monster_wild as mw
    s = P["snow"]
    im = mw._pine_on(_pine_body(P), base_pine_seed(), s[3], s[2])
    return _snow_caps(P, im, 36)


def frost_bush(P):
    """얼어붙은 덤불(1칸, 통행 불가 — 바닥 고드름 결정 대신): 짙은 녹청 둥근 덤불에 눈 모자, 잎 끝 몇 개만 눈 밖으로 나온다. 밑 그림자."""
    lf, s = px.ramp(P["_leaf_hex"]), P["snow"]
    shape = [(8.0, 9.2, 5.4), (4.6, 11.0, 3.6), (11.0, 10.8, 3.6)]           # 덩이가 칸 오른쪽·아래 끝(x·y=15)에 닿지 않게(L8 K1)
    im = cc.shade_lobes(px.new(), shape, [lf[0], lf[0], lf[1], lf[2], lf[2]], ol=lf[0])
    ins = cc.lobes(shape)
    for x in range(T):
        ys = [y for y in range(T) if ins(x, y)]
        if not ys:
            continue
        top = ys[0]
        th = 3 if 4 <= x <= 11 else 2
        for y in range(top, min(T, top + th)):
            u = (x - 8) / 6
            im.putpixel((x, y), s[6] if u < -0.1 else s[5] if u < 0.4 else s[3])
        if x % 3 == 0 and top + th < T and ins(x, top + th):
            im.putpixel((x, top + th), s[3])                        # 눈 방울
    return im


def snow_ledge(P, part: str):
    """눈 턱(남쪽으로만 뛰어내림 — 본 시트 턱 문법을 눈 재료로, 얼음방 벽 앞면의 축소판): 위 2px 흰 눈 턱(아랫변이 물결 진다) →
    그 아래 4px 청회 앞면(윗줄 #b4c2e0, 아랫줄 #8e9ecc, 고드름 같은 흰 세로 결 2~3개가 칸마다 다른 자리) → 맨 아래 1px 최암 청 윤곽(#6a78aa) →
    밑 땅에 1px 그늘. part: l(왼끝) m0 m1(가운데) r(오른끝) — 끝은 앞면이 낮아지며 둥글게 말려 들어간다."""
    s = P["snow"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), snow0(x, y))
    r = px.rng(f"sledge2-{part}")
    ol = P["ice_rock"][1]                                             # 맨 아랫선: 눈 최암보다 한 단 짙은 청(원 크기에서 또렷하게, L3 N4)
    lipw = [r.choice((0, 0, 1)) for _ in range(T)]                    # 눈 턱 아랫변 물결
    icx = {(r.randrange(1, 5) + 5 * i + (2 if part == "m1" else 0)) % T for i in range(3)}
    for x in range(T):
        t = min(1.0, max(0.0, (x - 1) / 5)) if part == "l" else min(1.0, max(0.0, (T - 2 - x) / 5)) if part == "r" else 1.0
        if t <= 0.0:
            continue
        if t < 0.25:                                                  # 끝 마감: 앞면을 둥글게 말아 넣는 윤곽 한 줄
            yc = round(4.0 + 2.5 * (1 - t) ** 1.4)
            for y in (yc + 1, yc + 2):
                im.putpixel((x, y), s[1] if y == yc + 1 else ol)
            if yc + 3 < T:
                im.putpixel((x, yc + 3), s[3])
            continue
        top = round(4.0 + 2.5 * (1 - t) ** 1.4)
        lip = top + 1 + lipw[x] * (1 if t > 0.6 else 0)               # 흰 눈 턱 마지막 줄
        fh = max(1, round(4 * t))                                     # 앞면 높이(끝으로 갈수록 낮다)
        bot = lip + fh + 1                                            # 최암 윤곽 줄
        for y in range(top, bot + 1):
            if y == top:
                c = s[6]
            elif y <= lip:
                c = s[5]
            elif y == bot:
                c = ol
            else:
                k = y - lip                                            # 앞면 안 줄(1 = 맨 위)
                c = s[2] if k <= 1 else s[1]
                if x in icx and k <= 2 and t > 0.7:
                    c = s[5] if k == 1 else s[3]                       # 고드름 결
            im.putpixel((x, y), c)
        if bot + 1 < T:
            im.putpixel((x, bot + 1), s[3])                          # 밑 그늘
    return im


def snow_ledge_side(P, side: str):
    """동·서 눈 턱(세로 한 칸): 세로로 선 눈 둑 — 흰 눈 턱 2px + 떨어지는 쪽 청회 앞면 2px + 최암 청 윤곽 1px, 그 밖 땅에 1px 그늘."""
    s = P["snow"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), snow0(x, y))
    cols = [s[6], s[5], s[2], s[1], s[0], s[3]]                       # 동쪽으로 떨어질 때 서→동 순서
    for y in range(T):
        for i, c in enumerate(cols):
            x = 5 + i if side == "e" else 10 - i
            im.putpixel((x, y), c)
    return im
