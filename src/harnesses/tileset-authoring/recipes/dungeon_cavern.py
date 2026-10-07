"""던전 시트 — 동굴 계열 세 장소: 얼음 동굴(여울동굴 얼음방·얼음폭포 동굴·물보라섬) · 용암 동굴(불꽃길·마그마 아지트·루비길) · 해저 동굴.

원작에서 잰 장소 문법(pret 렌더를 눈으로 읽은 것, 픽셀 복사 없음):
- 공통: 벽은 위에서 본 암반 윗면 + 남쪽으로 드러난 앞면 한 줄(본 시트 동굴 벽). 안쪽 벽은 **두 칸 이상 두께**로 깐다 — 한 줄 벽은 앞면만 남아
  낮은 울타리로 읽힌다(적대 검수 QA1-1·2). 올라가는 사다리는 **벽 앞면에 기댄 나무 사다리**(`<p>_ladder`, 벽 앞면 칸의 위층에 얹는다 — 위층 통행 O 가 벽을 덮는다),
  내려가는 사다리는 **바닥의 검은 구멍 속 사다리**(`<p>_hole`), 굴 입구는 **벽 앞면에 뚫린 검은 아치**(`<p>_door`, 역시 벽 앞면 칸 위층), 맵 아래 출구는
  **바닥 아래 변의 밝은 반원**(`<p>_exit`, 아래 벽 줄의 틈에 놓는다). 바닥은 대각 잔결 + 2px 자갈(가로 결은 마루·아스팔트로 읽혔다).
- 얼음 동굴: 벽은 파란 암반, 윗면은 눈결(물결 무늬는 물로 읽혀 지웠다). 걷는 땅은 점 무늬 눈, 얼음은 사선(/) 줄무늬 판 — 테는 얼음 중간톤 1px,
  눈 쪽에 1px 그늘(얼음이 살짝 낮다). 얼음 위 바위(면을 나눈 획이 있는 덩이)가 미끄럼을 멈춘다. 눈 더미는 윤곽이 옅은 낮은 흰 덩이(막힘).
  얼음 판은 입구·출구가 각각 한 칸 틈이고, 판 안에서 멈출 수 있는 곳은 바위 앞뿐이다.
- 못 모양(용암·물): 칸 격자 직사각이 아니라 줄마다 1칸씩 들쭉날쭉한 덩이 — 모서리는 45° 계단, 곧은 변은 4칸 남짓까지, 벽 혀가 밀고 들어온다.
  섬은 2×2 정사각 대신 비정형 3칸 이상(정사각 섬은 상자·해치로 읽혔다, QA-L1 N1·N4). 대각 벽은 1칸씩 비켜 쌓지 말고 2~3칸 곧은 벽 + 둥근 끝(N5).
- 용암 동굴: 벽은 장밋빛 화산암, 바닥은 그보다 한 단 어두운 적갈 + 드문 흰 재 점. 용암은 **평평한 적주황 한 톤**에 2~3칸마다 기포 하나(4프레임),
  바닥보다 낮은 못이라 북쪽 변만 둑 앞면(어두운 3px + 회색 윗선)이고 남·동·서는 회색 1px 선. 용암을 건너는 길은 식은 껍질 판(`lv_cb`) —
  용암 그룹이 이 칸을 「이어진 이웃」으로 봐서 둑 없이 붙고, 판 사이로 붉은 빛 금이 가늘게 비친다. 분기공은 바닥의 갈라진 틈 + 가는 증기 실 두 가닥.
- 해저 동굴: 벽·바닥이 같은 회갈 계열(벽 윗면이 밝다). 물은 해안 시트 바다와 같은 그물 물결(coast.sea_px 를 읽기만 한다 — 같은 게임의 물, 4프레임),
  북쪽만 둑 앞면, 나머지는 1px 선. 해초는 물가 칸에만, 조개(가리비)·고인 물은 마른 바닥에. 웅덩이 속 바위섬은 파도타기 자리.
본 시트 cave.py 함수를 램프만 바꾼 P 로 불러 벽·석순을 얻는다(dungeon_kit.cave_walls·lifted)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
import cave  # noqa: E402
import outdoor2 as o2  # noqa: E402
import dungeon_kit as dk  # noqa: E402
import gym2 as g2  # noqa: E402
import coast  # noqa: E402  (해안 시트 바다 물결 sea_px 를 읽기만 한다 — 같은 게임의 물)

ICE = ("dg-ice-sheet", 1, 2, 0)          # 얼음 판: 모서리만 살짝 둥근 판(원작 얼음은 각진 판)
AUTOTILE_PARAMS = {"ice": ICE}


def autotile_masks(kind: str) -> dict:
    if kind == "pool":
        return dk.pool_masks()
    if kind == "block2":
        return dk.block2_masks()
    name, depth, radius, amp = AUTOTILE_PARAMS[kind]
    return {m: px.inside_mask(m, name, depth, radius, amp) for m in px.ALL47}


def _snow_tops(P, key):
    """얼음 벽 윗면: 물결 획 없는 눈결 — 바탕 + 밝은 2px 덩이 + 드문 1px 그늘 점(cave._TOP 에 미리 채워 cave.wall_cell 이 쓰게 한다)."""
    w = P[key]
    out = {}
    for v in range(6):
        out[v] = px.clumps(f"dg-icetop{v}", w[3], [(w[4], 9 + v % 3, 2)])          # 어두운 1px 점 없음(QA-L2 N29)
    return out


# ==== 얼음 동굴 ==================================================================================
def snow(P, v: int):
    """눈 바닥: 바탕 + 밝은 두 톤 덩이(조용하게). 원작 얼음 동굴 바닥의 점 무늬를 2px 덩이로."""
    s = P["dg_snow"]
    return px.clumps(f"dg-snow{v}", s[2], [(s[3], 12 + 2 * v, 3), (s[4], 2 + v // 2, 2)])


def ice_cell(P, m: int):
    """얼음 판 오토타일: 안은 사선(/) 줄무늬 2톤(흰 점 없음 — 칸마다 같은 점이 격자를 드러냈다), 둘레 1px 는 얼음 중간톤 테,
    바깥 눈 쪽 1px 는 그늘(얼음이 바닥보다 살짝 낮다)."""
    s, c = P["dg_snow"], P["dg_ice"]
    inside = px.inside_mask(m, *ICE)
    sn = snow(P, 0)
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                k = (x + y) % 8
                col = c[0] if not all(nb.values()) else (c[2] if k < 2 else c[1])
            else:
                col = s[1] if any(nb.values()) else sn.getpixel((x, y))
            im.putpixel((x, y), col)
    return im


def _line(x0, y0, x1, y1):
    pts, dx, dy = [], abs(x1 - x0), -abs(y1 - y0)
    sx, sy, err = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1), abs(x1 - x0) - abs(y1 - y0)
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy; x0 += sx
        if e2 <= dx:
            err += dx; y0 += sy


def ice_crack(P):
    """금 간 얼음(위층 덧그림, 밟으면 깨져 떨어지는 덫 자리): 칸 가운데 한 점에서 길이가 다른 금 다섯 갈래(3·5·6·7px)가 칸 가장자리 1~2px 앞까지
    뻗는 거미줄 금 + 갈래를 잇는 짧은 고리 금 둘. 가운데 2×2 는 한 단 더 어둡게(움푹), 긴 금 두 갈래 아래쪽에 흰 1px 깨진 면.
    금 둘레 2px 은 얼음 바탕색으로 덮어 사선 결을 끊는다 — 「깨진 판」으로 보이게(QA-L3 N28). 칸 테(바깥 1px)는 건드리지 않는다."""
    ice, wall, lit = P["dg_ice"], P["dg_icewall"], P["dg_snow"][4]
    im = px.new()
    cx, cy = 8, 8
    rays = [(2, 3), (14, 5), (12, 13), (3, 12), (9, 4)]
    crack = set()
    for ex, ey in rays:
        crack.update(_line(cx, cy, ex, ey))
    for (ax, ay), (bx, by) in (((5, 6), (6, 10)), ((11, 7), (10, 11))):      # 갈래 사이 고리 금
        crack.update(_line(ax, ay, bx, by)[1:-1])
    near = {(x + dx, y + dy) for x, y in crack for dx in range(-2, 3) for dy in range(-2, 3)}
    for x, y in near:
        if 1 <= x <= 14 and 1 <= y <= 14:
            im.putpixel((x, y), ice[1])
    for x, y in crack:
        im.putpixel((x, y), wall[2])
    for x, y in ((7, 7), (8, 7), (7, 8), (8, 8)):
        im.putpixel((x, y), wall[1])
    for ex, ey in rays[:2]:                                                     # 긴 두 갈래 아래 깨진 면
        for x, y in _line(cx, cy, ex, ey)[2:-1]:
            if (x, y + 1) not in crack and y + 1 <= 14:
                im.putpixel((x, y + 1), lit)
    return im


def ice_rough(P):
    """거친 얼음(위층 덧그림, 미끄럼 멈춤): 얼음 판 위의 각진 서리 판 — 둘레 1px 얼음 최암, 속은 눈 2톤의 거친 알갱이(원작 갯바위 얼음방의 사각 거친 칸)."""
    c, s_ = P["dg_ice"], P["dg_snow"]
    r = px.rng("dg-ice-rough")
    im = px.new()
    for y in range(2, 14):
        for x in range(2, 14):
            if (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
                continue
            edge = x in (2, 13) or y in (2, 13)
            im.putpixel((x, y), c[0] if edge else (s_[3] if r.random() < 0.55 else s_[1] if r.random() < 0.3 else s_[2]))
    return im


def ice_rock(P, v: int):
    """얼음 바위(위층, 막힘 — 미끄럼을 멈춘다): 본 시트 바위 덩이(흰 윗면 램프) + 면을 나누는 진한 획 둘 — 윤곽 옅은 눈 더미와 구별된다."""
    rk = P["dg_icerock"]
    im = o2.boulder(dk.recolor(P, rock="dg_icerock"), v)
    strokes = ((7, 4), (7, 5), (8, 6), (8, 7), (11, 9), (10, 10)) if v == 0 else ((6, 5), (7, 6), (7, 7), (10, 8), (11, 9), (5, 9))
    for x, y in strokes:
        if im.getpixel((x, y))[3] == 255:
            im.putpixel((x, y), rk[1])
    return im


def ice_crystal(P):
    """얼음 결정 무더기(1×1, 막힘): 비대칭 — 가운데 큰 결정(머리 위로 2px 더), 오른쪽은 크게 기울고 왼쪽은 낮다. 면마다 3톤, 윤곽 얼음 벽 최암, 밑동에 붙은 반투명 그림자 1px + 오른쪽 2px."""
    c, w, s_ = P["dg_ice"], P["dg_icewall"], P["dg_snow"]
    im = px.new()
    def shard(cx, ty, by, hw, lean):
        for y in range(ty, by + 1):
            k = y - ty
            half = min(hw, 0.6 + k * 0.75)
            mid = cx + lean * (by - y) / max(1, by - ty)
            for x in range(T):
                d = x + 0.5 - mid
                if abs(d) <= half:
                    im.putpixel((x, y), c[3] if d < -half * 0.34 else c[2] if d < half * 0.34 else c[1])
    shard(4.0, 8, 13, 1.8, -1.0)
    shard(12.0, 4, 13, 2.0, 3.2)
    shard(7.6, 0, 13, 2.8, -0.4)
    a = [[im.getpixel((x, y))[3] == 255 for x in range(T)] for y in range(T)]
    for y in range(T):
        for x in range(T):
            if a[y][x] and any(not (0 <= x + dx < T and 0 <= y + dy < T) or not a[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                im.putpixel((x, y), w[0] if (x >= 8 or y >= 11) else w[1])
    for x, y in ((7, 2), (7, 3), (3, 10), (11, 6)):
        if a[y][x]:
            im.putpixel((x, y), s_[4])
    # 그림자는 결정 밑동 바로 아래 줄(y=14)에 붙인다(QA-L4 N32). 예전 눈더미가 밑동 두 줄을 바닥색으로 덮어 그림자가 1px 떠 보였다.
    # 밑동 바로 아래 한 줄 + 오른쪽 2px 은 반투명 그림자(밑동 윤곽선이 이미 최암이라 선을 더 긋지 않는다).
    xs = [x for x in range(T) if im.getpixel((x, 13))[3] == 255]
    if xs:
        for x in range(xs[0] + 1, min(T, xs[-1] + 3)):
            im.putpixel((x, 14), dk.SHADOW)
        for x in (xs[-1] + 1, xs[-1] + 2):
            if x < T and im.getpixel((x, 13))[3] == 0:
                im.putpixel((x, 13), dk.SHADOW)
    return im


def snow_drift(P):
    """눈 더미(1×1, 막힘): 낮게 깔린 흰 덩이 셋 — 윤곽은 눈의 가장 진한 톤(바위의 남색 윤곽과는 구별), 밑 반투명 그림자."""
    s = P["dg_snow"]
    inside = dk.lobes_inside([(8, 11.5, 6.6, 3.4), (4.6, 12.2, 3.4, 2.6), (11.8, 12.2, 3.4, 2.6), (8.6, 9.4, 3.2, 2.2)])
    im = px.new()
    return dk.shade_blob(im, inside, [s[0], s[1], s[3], s[4]], s[0], shadow=True)     # 윤곽·그늘 한 단 진하게 — 흰 눈 바닥 위에서 원 크기로 안 보였다(I1 X6)


# ==== 용암 동굴 ==================================================================================
def ash(P, v: int):
    """용암 동굴 바닥: 벽과 같은 적갈 계열 한 단 어두운 톤, 대각 잔결 + 자갈. 변형 0~3 은 재 점 없음,
    4·5 는 밝은 재 덩이 하나(3px)를 칸 안쪽 서로 다른 자리((5,9)·(11,4))에 — 맵은 9~11칸에 하나꼴로만 쓴다(칸마다 같은 자리 점은 별 격자가 됐다, QA-L1 N3)."""
    f = P["dg_ash"]
    if v >= 4:
        im = dk.cave_floor2("dg-ash", f, v - 4)
        x, y = ((5, 9), (11, 4))[v - 4]
        im.putpixel((x, y), f[4]); im.putpixel((x + 1, y), f[4]); im.putpixel((x, y + 1), f[3])   # 재 덩이 3px(바닥 밝은 덩이 톤) + 밑 그늘 —
        im.putpixel((x + 1, y + 1), f[0])                                                         # 흰 점은 1px·2px 모두 별·먼지로 읽혔다(I1 X6 · I2 Y1)
        return im
    return dk.cave_floor2("dg-ash", f, v)


# ---- 용암 -------------------------------------------------------------------------------------------------
# 원 크기에서 「주황 페인트 판」으로 읽히지 않게 세 겹으로 그린다(감독 d10 지적):
#  1) 표면 결 — 민 바탕 위에 속 변형마다 다른 자리의 물결 자국·기포 쌍(성기게, 칸 테두리 1px 은 민 바탕). 물결은 1px 흔들리고 기포 쌍은 깜빡인다(4프레임 = 한 바퀴).
#     옛 16px 토러스 띠는 칸 테두리 결이 모든 변형에서 같아 「^」 격자로 보였다(QA-I4 W1) — _MARKS 머리말.
#  2) 굳은 껍질 판 — 어두운 적갈 판(5~9px 폭, 칸의 6~7%) + 위·왼쪽 빛 새는 밝은 1px 테 · 아래·오른쪽 그늘 1px · 판을 가르는 빛 금. 모양 넷, 자리는 판마다 토러스 시드.
#  3) 둑 안쪽 뜨거운 테 — 둑에서 1px 은 밝은 노랑주황, 2px 은 한 단 밝게, 3px 은 골을 지운다(lava_cell 이 그린다).
# 굳은 껍질 판 모음(bubble=("k", j) 의 j → 모양 j % 12, 칸 안 자리는 j 마다 토러스 시드).
# 0~3 중(15~17px, 칸의 6~7%) · 4~9 소(7~8px) · 10~11 대(25px). 크기 섞기와 자리 흩뿌리기는 놓는 쪽(맵 전체 좌표)이 정한다 —
# 칸 해시로 고르는 엔진 속 변형에 넣으면 같은 판이 같은 칸 자리에 줄지어 선다(체육관 QA-L6 N14).
_CRUST_SHAPES = [
    ["xxx....", "xxxxxx.", ".xxxxxx", "...xx.."],                       # 중 0
    [".xx...", "xxxxx.", "xxxxxx", "..xxx."],                           # 중 1
    ["xxxx.....", ".xxxxxx..", "....xxxxx"],                            # 중 2
    ["..xxx", ".xxxx", "xxxx.", "xxx..", ".x..."],                      # 중 3
    ["xxx.", ".xxx", "..xx"],                                           # 소 4
    ["xx..", "xxxx", ".xx."],                                           # 소 5
    [".xxxx", "xxxx."],                                                 # 소 6
    ["xxx", "xxx", ".x."],                                              # 소 7
    ["xxxxx", "..xx."],                                                 # 소 8
    [".xx", "xxx", "xx."],                                              # 소 9
    ["..xxxxx..", "xxxxxxxx.", ".xxxxxxxx", "...xxxx.."],               # 대 10
    ["xxxx....", "xxxxxxx.", ".xxxxxxx", "..xxxxx.", "....xx.."],       # 대 11
]
CRUST_SMALL, CRUST_MID, CRUST_LARGE = (4, 5, 6, 7, 8, 9), (0, 1, 2, 3), (10, 11)
_LAVA_CRUST: dict = {}


def _lava_crust(j):
    """껍질 판 j 의 칸 안 자리 → {(x, y): 'l'(빛 새는 위·왼쪽 테) | 'r'(아래·오른쪽 테) | 'b'(판 몸) | 'd'(판 몸 그늘)}.
    판은 칸 경계에 걸치지 않는다(이웃 칸에 반쪽이 안 생긴다). 자리는 판마다 토러스 시드."""
    if j not in _LAVA_CRUST:
        rows = _CRUST_SHAPES[j % len(_CRUST_SHAPES)]
        w, h = len(rows[0]), len(rows)
        sx, sy = px.torus_seeds(f"dg-lava-crust-{j}", 1)[0]
        x0 = 2 + int(sx * 7) % max(1, T - 3 - w)
        y0 = 2 + int(sy * 7) % max(1, T - 3 - h)
        body = {(x0 + i, y0 + k) for k, r in enumerate(rows) for i, ch in enumerate(r) if ch == "x"}
        out = {}
        for x, y in body:
            out[(x, y)] = "d" if ((x + 1, y) not in body or (x, y + 1) not in body) else "b"
        for x, y in body:                                                  # 테: 판 바깥 1px
            for dx, dy in ((0, -1), (-1, 0), (0, 1), (1, 0)):
                q = (x + dx, y + dy)
                if q not in body and 0 < q[0] < T - 1 and 0 < q[1] < T - 1:
                    out.setdefault(q, "l" if dx < 0 or dy < 0 else "r")
        _LAVA_CRUST[j] = out
    return _LAVA_CRUST[j]


def _crust_crack(j):
    """판 몸을 가로지르는 빛 새는 금 한 줄(판 왼쪽 위 → 오른쪽 아래로 비스듬히 3~5px)."""
    body = [q for q, v in _lava_crust(j).items() if v in ("b", "d")]
    if not body:
        return set()
    xs = sorted({x for x, _ in body}); ys = sorted({y for _, y in body})
    mx, my = xs[len(xs) // 2], ys[len(ys) // 2]
    pts = {(mx - 2, my - 1), (mx - 1, my - 1), (mx, my), (mx + 1, my), (mx + 2, my + 1)} if j % 2 == 0 else {(mx - 1, my - 1), (mx, my), (mx, my + 1), (mx + 1, my + 1)}
    return {q for q in pts if _lava_crust(j).get(q) == "b"}


# 표면 결 — 칸마다 다른 자리에 성기게 놓는 물결 자국(QA-I4 W1). 옛 결은 칸 주기 토러스라 테두리 3px 이 모든 변형에서 같았고,
# 밝은 「^」 삼각과 아래 사선이 16px 마다 같은 자리에 서서 2배에서도 격자로 보였다. 지금은 칸 테두리 1px 이 민 바탕(lv[0])이고
# 자국은 속 변형 열쇠마다 자리·모양·개수가 다르다 — 이웃 칸과의 이음매는 민 바탕끼리라 그대로, 줄·격자를 만드는 공통 무늬가 없다.
# 원작 magma 문법: 평평한 빨강 위에 작은 무늬가 칸마다 다른 자리에 성기게.
# 모양 기호: h = 밝은 주황 lv[1], y = 노랑 lv[2](빛 마디), d = 한 단 어두운 골(tint 0.84). 밝은 줄 바로 아래(오른쪽 아래)에 골이 진다 — 왼쪽 위 빛.
def _ripple(n: int, up: bool, glint: bool):
    """물결 자국 하나(가로 n px): 밝은 주황 1px 곡선(가운데가 한 칸 솟거나 꺼진 활) + 그 바로 아래 한 단 어두운 골.
    glint 면 꼭대기 한 점이 노랑."""
    top = [0 if (i == 0 or i == n - 1) else (1 if 0 < i < n - 1 else 0) for i in range(n)]
    if n >= 6:                                                           # 긴 물결은 두 번 굽는다(~)
        top = [0, 1, 1, 0, 0, 1, 1, 0, 1][:n] if not up else [1, 0, 0, 1, 1, 0, 0, 1, 0][:n]
    elif not up:
        top = [1 - t for t in top]
    rows = [["."] * n for _ in range(3)]
    for i, t in enumerate(top):
        yy = 1 - t
        rows[yy][i] = "h"
    for i, t in enumerate(top):
        yy = 1 - t
        if rows[yy + 1][i] == ".":
            rows[yy + 1][i] = "d"
    if glint:
        i = next(i for i, t in enumerate(top) if t == 1)
        rows[0][i] = "y"
    return ["".join(r) for r in rows]


_MARKS = [_ripple(n, up, g) for n in (4, 5, 7, 9) for up in (True, False) for g in (False, True)] + [
    ["yh..", "....", "..hy"],                    # 기포 쌍(원작 magma 의 엇갈린 두 점) — 1px 점은 잡티로 읽혀 2px 짧은 줄
    ["..hy", "....", "yh.."],
]
_RIPPLES = len(_MARKS) - 2
_LAVA_MARKS: dict = {}


def _lava_marks(key):
    """속 변형 열쇠 → 자국 목록 [(x0, y0, 모양 번호, 위상)]. 칸 테두리 1px 밖으로 안 나가고, 기포·껍질 판 자리와 겹치지 않는다.
    가장자리 칸(마스크 ≠ 255)은 lava_cell 이 ("e", 마스크, 변형) 열쇠를 준다 → _edge_marks. 꽉 찬 칸 at255(민 칸)은 "m255"."""
    if key is None:
        return []
    if key[0] == "e":
        return _edge_marks(key[1], key[2])
    if key in _LAVA_MARKS:
        return _LAVA_MARKS[key]
    r = px.rng(f"dg-lava-marks-{key}")
    busy = set()
    if key[0] == "k":
        busy = {q for q in _lava_crust(key[1])}
    elif key[0] not in ("c", "m"):
        bx, by = key
        busy = {(bx + dx, by + dy) for dx in range(-2, 4) for dy in range(-2, 4)}
    n = r.choice((2, 3, 3, 3, 4))
    out, taken = [], set(busy)
    for _ in range(120):
        if len(out) >= n:
            break
        pair = r.random() < 0.18 and not any(m[2] >= _RIPPLES for m in out)        # 기포 쌍은 칸에 많아야 하나
        k = _RIPPLES + r.randrange(2) if pair else r.choice((0, 1, 2, 3, 4, 5, 6, 7) + tuple(range(8, _RIPPLES)) * 2)   # 긴 물결을 더 자주
        rows = _MARKS[k]
        w, h = len(rows[0]), len(rows)
        x0, y0 = r.randint(1, T - 1 - w - 1), r.randint(1, T - 1 - h)   # 자국이 흔들려 1px 오른쪽으로 가도 테두리 1px 안
        box = {(x0 + i, y0 + j) for i in range(-2, w + 3) for j in range(-1, h + 1)}
        if box & taken:
            continue
        # 한 칸 안 자국끼리 세로로 줄 서면 사다리로 읽힌다 — 가로 범위가 2px 넘게 겹치면 6px 이상 떨어뜨린다
        if any(min(x0 + w, ox + len(_MARKS[ok][0])) - max(x0, ox) > 1 and abs(y0 - oy) < 6 for ox, oy, ok, _ in out):
            continue
        taken |= box
        out.append((x0, y0, k, r.randrange(4)))
    _LAVA_MARKS[key] = out
    return out


# 가장자리 칸 자국(QA-I5 V2): 옛 가장자리 47종은 민 바탕이라 웅덩이마다 1칸 폭 민무늬 띠가 생겼고, 2칸 폭 수로는 통째로 주황 바닥이었다.
# 이제 가장자리 칸에도 잔물결 0~1 · 기포 쌍 0~1 을 성기게 찍는다. 자리는 둑(물 밖 칸)에서 7px 이상 — 뜨거운 테(1~3px)에서 4px 넘게 안쪽 —
# 이라 테·둑 그림은 그대로이고, 칸 테두리 1px 은 민 바탕이라 이음매도 그대로다. 곧은 변(55·205·110·155)은 둑을 따라 같은 칸이 줄지어 서므로
# 변형 LAVA_EDGE_VARIANTS 벌을 두고(쇼케이스가 칸 위치 해시로 섞는다), 변형마다 자국 수·모양·둑에서의 거리·변을 따른 자리가 다르다.
LAVA_EDGE_VARIANTS = {55: 3, 205: 3, 110: 3, 155: 3}
_LAVA_EDGE: dict = {}


def _edge_marks(m: int, v: int):
    """가장자리 칸(마스크 m, 변형 v) 자국 목록 — _lava_marks 와 같은 꼴. 둑에서 7px 안 든 점(Chebyshev)만 쓴다(자국이 흔들려 1px 옮겨도)."""
    if (m, v) in _LAVA_EDGE:
        return _LAVA_EDGE[(m, v)]
    ins = dk.pool_mask(m, **dk.POOL)
    def wet(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        if y >= T:
            return bool(m & S) and ins[T - 1][min(T - 1, max(0, x))]
        if y < 0:
            return bool(m & N) and ins[0][min(T - 1, max(0, x))]
        if x >= T:
            return bool(m & E) and ins[min(T - 1, max(0, y))][T - 1]
        return bool(m & W) and ins[min(T - 1, max(0, y))][0]
    safe = {(x, y) for y in range(1, T - 1) for x in range(1, T - 1)
            if all(wet(x + dx, y + dy) for dx in range(-6, 7) for dy in range(-6, 7))}
    r = px.rng(f"dg-lava-edge-{m}-{v}")
    straight = m in LAVA_EDGE_VARIANTS
    vertical = m in (55, 205)                                            # 둑이 세로로 선 변 — 변을 따른 축은 y
    # 곧은 변 변형 셋: 0 = 기포 쌍 하나(체육관처럼 한 벌만 구우면 이것이 16px 마다 선다 — 가장 덜 띄는 점 둘),
    # 1 = 잔물결 하나, 2 = 짧은 물결 + 기포 쌍. 셋은 변을 따른 자리(위·가운데·아래 셋째 몫)와 둑에서의 거리(가까이·멀리·아무데나)가 다르다.
    if straight:
        plan = (("p",), ("r",), ("r", "p"))[v % 3]
        band = (v % 3, (v + 2) % 3)                                    # 변을 따른 자리 몫(첫 자국, 둘째 자국)
    else:
        plan = r.choice((("r",), ("p",), ("r",), ()))
        band = None
    out, taken = [], set()
    for n_, kind in enumerate(plan):
        cands = []
        for k in ((_RIPPLES, _RIPPLES + 1) if kind == "p" else tuple(range(0, 8 if vertical else 12))):   # 가장자리는 짧은 물결(4·5px, 가로 변은 7px 까지)
            rows = _MARKS[k]
            w, h = len(rows[0]), len(rows)
            for y0 in range(1, T - h):
                for x0 in range(1, T - w - 1):
                    if band is not None:
                        along = (y0 + h / 2) if vertical else (x0 + w / 2)
                        if int(along * 3 // T) != band[n_]:
                            continue
                    cells = {(x0 + i, y0 + j) for i in range(w + 1) for j in range(h)}
                    box = {(x0 + i, y0 + j) for i in range(-2, w + 3) for j in range(-1, h + 1)}
                    if cells <= safe and not (box & taken):
                        cands.append((x0, y0, k, w, h, box))
        if not cands:
            continue
        if straight and v % 3 < 2:                                     # 둑에서의 거리: 0 은 가까이, 1 은 멀리
            perp = lambda c: (c[0] if m == 55 else -c[0]) if vertical else (c[1] if m == 110 else -c[1])
            cands.sort(key=perp)
            lo = min(perp(c) for c in cands); hi = max(perp(c) for c in cands)
            cands = [c for c in cands if perp(c) == (lo if v % 3 == 0 else hi)]
        x0, y0, k, w, h, box = cands[r.randrange(len(cands))]
        taken |= box
        out.append((x0, y0, k, r.randrange(4)))
    _LAVA_EDGE[(m, v)] = out
    return out


def _flow(P, x, y, f, key=None):
    """표면 한 점: 민 바탕 lv[0] 위에 열쇠마다 다른 자리의 물결 자국. 물결은 프레임마다 0·0·1·1px 옆으로 흔들리고(위상은 자국마다),
    기포 쌍은 노랑 → 주황으로 깜빡인다 — 4프레임이 한 바퀴, 자리는 모든 프레임에서 같다."""
    lv = P["dg_lava"]
    for x0, y0, k, ph in _lava_marks(key):
        rows = _MARKS[k]
        bob = k < _RIPPLES
        sx = x0 + ((0, 0, 1, 1)[(f + ph) % 4] if bob else 0)
        i, j = x - sx, y - y0
        if 0 <= j < len(rows) and 0 <= i < len(rows[0]):
            ch = rows[j][i]
            if ch == "h":
                return lv[1]
            if ch == "y":
                return lv[2] if bob or (f + ph) % 4 < 2 else lv[1]
            if ch == "d":
                return px.tint(lv[0], 0.84)
    return lv[0]


def lava_px(P, x, y, f, bubble=None, mark_key=None):
    """용암 한 점: 표면 결(_flow) 위에 bubble 에 따라 기포 또는 껍질 판.
    bubble=(bx, by): 그 자리 기포(4프레임: 점 → c 자 → 큰 c → 잔 점). ("c", k): 표면 결만. ("k", j): 굳은 껍질 판 j(판은 흐르지 않는다).
    표면 결 자국 자리는 bubble 이 열쇠다. bubble 이 없으면 mark_key(꽉 찬 민 칸은 "m255", 가장자리 칸은 None = 자국 없음)."""
    lv, cr = P["dg_lava"], P["dg_crust"]
    c = _flow(P, x, y, f, bubble if bubble is not None else mark_key)
    if bubble and bubble[0] == "k":
        part = _lava_crust(bubble[1]).get((x % T, y % T))
        if part == "b":
            c = lv[0] if (x % T, y % T) in _crust_crack(bubble[1]) else cr[1]
        elif part == "d":
            c = cr[0]
        elif part == "l":
            c = lv[3] if (x + 2 * y) % 5 == 0 else lv[2]
        elif part == "r":
            c = px.tint(lv[0], 0.84)                                     # 아래·오른쪽은 판이 용암에 드리운 그늘(떠 있는 판)
        return c
    if bubble and bubble[0] != "c":
        bx, by = bubble
        dx, dy = x - bx, y - by
        if f == 0 and (dx, dy) in ((0, 0), (1, 0)):
            c = lv[2]
        elif f == 1 and (dx, dy) in ((0, 0), (1, 0), (-1, 1), (2, 1), (0, 1)):
            c = lv[3] if (dx, dy) == (0, 0) else lv[2]
        elif f == 2 and (dx, dy) in ((0, -1), (1, -1), (-1, 0), (2, 0), (-1, 1), (2, 1), (0, 2), (1, 2)):
            c = lv[3] if dy < 0 else lv[2]
        elif f == 3 and (dx, dy) in ((-1, 1), (2, 2)):
            c = lv[1]
    return c


def lava_cell(P, m: int, f: int, bubble=None):
    """용암 웅덩이 한 칸(오토타일 마스크 m, 프레임 f 0~3). bubble 은 lava_px 와 같다 — 체육관도 이 함수로 굽는다:
    가장자리·민 칸 lava_cell(P, m, f) · 기포 칸 lava_cell(P, 255, f, (bx, by)) · 껍질 판 칸 lava_cell(P, 255, f, ("k", j)) — j 는 CRUST_SMALL/MID/LARGE.
    가장자리 칸은 둑에서 떨어진 안쪽에 성긴 자국이 있다(_edge_marks). 곧은 변 m ∈ LAVA_EDGE_VARIANTS 는 lava_cell(P, m, f, ("e", v)) 로
    변형 v(0 = 기본 칸과 같음)를 굽고, 쇼케이스가 칸 위치 해시로 섞는다 — 같은 칸이 둑을 따라 줄지어 서지 않게.
    껍질 판 칸은 칸 해시 속 변형에 넣지 말고 맵 좌표 포아송 흩뿌리기로 놓는다(소 많이 · 중 가끔 · 대 드물게, monster_dungeon.mts scatterCrust).
    P 에 dg_lava · dg_crust · dg_lvwall · dg_lvedge · dg_ash 가 있어야 한다. 둑 바로 안쪽 3px 은 뜨거운 테."""
    w, lv = P["dg_lvwall"], P["dg_lava"]
    dark = px.tint(lv[0], 0.84)
    edge_v = 0
    if bubble is not None and bubble[0] == "e":
        edge_v, bubble = bubble[1], None
    mark_key = "m255" if m == 255 else ("e", m, edge_v)
    ins = dk.pool_mask(m, **dk.POOL)
    def wet(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        if y >= T:
            return bool(m & S) and ins[T - 1][min(T - 1, max(0, x))]
        if y < 0:
            return bool(m & N) and ins[0][min(T - 1, max(0, x))]
        if x >= T:
            return bool(m & E) and ins[min(T - 1, max(0, y))][T - 1]
        return bool(m & W) and ins[min(T - 1, max(0, y))][0]
    def liquid(x, y):
        d = next((k for k in (1, 2, 3) if any(not wet(x + dx, y + dy) for dx in range(-k, k + 1) for dy in range(-k, k + 1)
                                                if max(abs(dx), abs(dy)) == k)), 0)
        base = lava_px(P, x, y, f, bubble, mark_key)
        if d == 1:
            return lv[2]
        if d == 2:
            return lv[1] if base in (lv[0], dark) else base
        if d == 3 and base == dark:
            return lv[0]
        return base
    return dk.sunken_pool(m, ash(P, 0), liquid, [w[0], w[1], w[2]], P["dg_lvedge"][0], P["dg_lvedge"][1])


_CB_SEEDS = px.torus_seeds("dg-crust-bridge", 4)
# 속 변형 씨앗: 바탕 씨앗(넷)에서 3.5px 넘게 떨어진 빈 자리만 쓴다 — 가까우면 두 판 사이가 통째로 금 색이 되어 검은 구덩이가 된다(QA-L3 N20 atin0_2).
_CB_EXTRA = [[], [(4, 5)], [(10.5, 7)], [(5, 10.5)], [(12, 12)], [(4, 5), (12.5, 11.5)], [(5.5, 8), (11, 3)]]
# 가장자리 변형(용암 쪽 윤곽): 행 3~12 의 용암 파먹기 깊이(0~2px)와 열린 변 곁 판 씨앗(서쪽 열린 칸 / 동쪽 열린 칸 따로 — 바탕 씨앗이 좌우 대칭이 아니다).
_CB_RIM = [
    (0, 1, 1, 2, 1, 0, 0, 1, 1, 0),
    (1, 1, 0, 0, 1, 2, 2, 1, 0, 0),
    (0, 0, 1, 1, 1, 0, 1, 2, 1, 1),
]
_CB_RIM_SEEDS = {"w": [[(4, 5), (4.5, 10)], [(4.5, 7.5)], [(4, 4.5), (4, 8.5), (5, 12)]],
                 "e": [[(11.5, 3.5), (12.5, 10.5)], [(11, 7)], [(12, 3), (11.5, 8), (13, 12.5)]]}


def crust_cell(P, m: int, v: int = 0, alt=None):
    """식은 껍질 판 다리(오토타일, 걷는다): 어두운 적갈 판 조각(감싼 보로노이 — 금이 칸을 넘어 이어진다, 칸 둘레 테 없음).
    판마다 밝기 두 단(들썩이는 판), 금은 어둡다. 다리 끝(북·남이 빈 변)은 어두운 2px 끝선, 용암과 맞닿는 동·서 변은 붉은 빛 1px.
    v = 속 변형 1~6: 씨앗을 하나둘 더해 판 모양이 달라진다. 이웃 칸과 닿는 변 2px 띠는 바탕 씨앗만으로 그려 이음매는 그대로(QA-L2 N20).
    빛은 바탕에 없다(덧그림만). alt = 0~2: 용암 쪽 변 윤곽 변형 — 행 3~12 에서 용암이 0~2px 파고들어 판 가장자리가 들쭉날쭉하고,
    그 변 곁에 판 씨앗을 더해 판 크기도 바뀐다(QA-L3 N20)."""
    c, lv = P["dg_crust"], P["dg_lava"]
    im = px.new()
    extra = list(_CB_EXTRA[v] if v < len(_CB_EXTRA) else [])
    rim = [0] * T
    if alt is not None:
        rim[3:13] = _CB_RIM[alt]
        extra += _CB_RIM_SEEDS["w" if not m & W else "e"][alt]
    for y in range(T):
        for x in range(T):
            seam = y <= 1 or y >= T - 2 or (m & W and x <= 1) or (m & E and x >= T - 2)
            seeds = list(_CB_SEEDS) + ([] if seam else extra)
            d1, d2, i, (vx, vy) = px.voronoi(seeds, x + 0.5, y + 0.5)
            if d2 - d1 < 0.9:
                col = c[0]
            elif vx + vy < -1.6:
                col = c[2]
            else:
                col = c[1] if i % 2 == 0 else px.tint(c[1], 0.88)
            dw = x if not m & W else (T - 1 - x if not m & E else 99)
            if (not m & N and y < 2) or (not m & S and y > T - 3):
                col = c[0]
            elif dw < rim[y]:
                col = lv[0]
            elif dw == rim[y]:
                col = lv[1]
            im.putpixel((x, y), col)
    return im


def crust_glow(P, v: int):
    """껍질 판 덧그림(위층, 장식): 판 사이로 붉은 빛이 새는 짧은 틈 한 줄 + 들뜬 판 귀퉁이 밝은 2px — 가장자리 열(속 변형이 안 닿는 칸)의 반복을 깬다."""
    c, lv = P["dg_crust"], P["dg_lava"]
    im = px.new()
    pts = ((4, 5), (5, 6), (6, 6), (7, 7)) if v == 0 else ((9, 10), (10, 10), (11, 9), (12, 9), (8, 11)) if v == 1 else ((5, 11), (6, 11), (7, 10))
    for x, y in pts:
        im.putpixel((x, y), lv[1]); px.put(im, x, y + 1, c[0])
    bx, by = ((10, 3), (3, 9), (11, 5))[v]
    im.putpixel((bx, by), c[2]); im.putpixel((bx + 1, by), c[2]); im.putpixel((bx, by + 1), c[0])
    return im


def cinder(P):
    """불씨 바닥(걷는다, 용암 둑 곁에만): 재 바닥에 붉은 불씨 셋, 하나는 노란 하이라이트."""
    im = ash(P, 1)
    lv = P["dg_lava"]
    for k, (x, y) in enumerate(((4, 5), (10, 9), (6, 12))):
        im.putpixel((x, y), lv[3] if k == 1 else lv[1]); im.putpixel((x + 1, y), lv[0]); im.putpixel((x, y + 1), P["dg_ash"][0])
    return im


def vent(P, part: str):
    """분기공(1×2, 막힘): 아래 칸은 바닥과 같은 톤의 갈라진 틈(어두운 타원 + 붉은 속 테 1px, 받침 원반 없음),
    위 칸까지 흰·옅은 회색 2톤의 가는 증기 실 두 가닥이 S 자로 오른다."""
    a, lv = P["dg_ash"], P["dg_lava"]
    im = px.new()
    threads = []
    if part == "b":
        for y in range(T):
            for x in range(T):
                d = ((x + 0.5 - 8) / 5.6) ** 2 + ((y + 0.5 - 11.5) / 2.6) ** 2
                if d <= 1.0:
                    im.putpixel((x, y), lv[0] if d > 0.62 and y >= 11 else a[0])
        im.putpixel((4, 10), a[0]); im.putpixel((12, 12), a[0]); im.putpixel((13, 12), a[0])
        y_range = range(0, 11)
    else:
        y_range = range(2, T)
    for k, (bx, ph, amp) in enumerate(((6.0, 0.0, 1.5), (10.0, 3.1, 1.2))):
        for y in y_range:
            yy = y + (T if part == "b" else 0)
            if k == 1 and yy < 17:                                       # 둘째 가닥은 짧은 김 — 두 가닥이 교차해 고리를 만들지 않게
                continue
            x = bx + amp * math.sin(yy * 0.35 + ph)
            fade = 1 - (32 - yy) / 32.0
            al = int(110 + 120 * fade) if part == "b" else int(60 + 70 * (yy / 16.0))
            for dx in (0, 1):
                xx = int(round(x)) + dx
                if 0 <= xx < T and im.getpixel((xx, y))[3] == 0:
                    im.putpixel((xx, y), (250, 248, 246, al) if dx == 0 else (210, 204, 204, al))
    return im


def ember_rock(P, v: int):
    """불씨 바위(1×1, 막힘): 낮고 납작한 화산암 덩이(밀 바위보다 낮다) + 금 사이 주황 불빛."""
    rk, lv = P["dg_lvrock"], P["dg_lava"]
    inside = dk.lobes_inside([(8, 11, 6.4, 3.4), (4.6, 12, 3.2, 2.4), (11.6, 11.6, 3.4, 2.8)] if v == 0 else [(7.5, 11.2, 6.0, 3.6), (12, 12, 2.8, 2.2)])
    im = dk.shade_blob(px.new(), inside, [rk[0], rk[1], rk[2], rk[3]], rk[0])
    for x, y in (((5, 11), (6, 11), (7, 12), (10, 10), (11, 11)) if v == 0 else ((5, 10), (6, 11), (9, 11), (10, 12), (8, 10))):
        if im.getpixel((x, y))[3] == 255:
            im.putpixel((x, y), lv[2] if (x + y) % 3 else lv[3])
    return im


def sea_floor(P, v: int):
    return dk.cave_floor2("dg-sefloor", P["dg_sefloor"], v)


def sea_px(P, x, y, f, opt=None):
    """물 한 점 = 해안 시트 바다(coast.sea_px: 본 시트 연못과 같은 그물 물결, 바다 램프)를 그대로 읽는다 — 같은 게임의 물.
    opt: None = 기본, 정수 v = 반짝임 속 변형, "deep" = 깊은 단."""
    return coast.sea_px(P, x, y, f, deep=opt == "deep", v=opt if isinstance(opt, int) else 0)


def sea_cell(P, m: int, f: int, opt=None):
    w, s = P["dg_sewall"], P["dg_sefloor"]
    return dk.sunken_pool(m, sea_floor(P, 0), lambda x, y: sea_px(P, x, y, f, opt), [w[0], w[1], w[2]], s[0], w[3])


def seaweed(P, v: int):
    """해초(1×1, 막힘, 물가 칸에만): 바닥에서 솟은 잎 줄기 — 줄기마다 물결치며 끝이 가늘다, 왼쪽 면 밝음, 윤곽은 해초 최암."""
    g = P["dg_weed"]
    im = px.new()
    stems = [(4.5, 12, 0.0), (8.5, 14, 1.7), (12, 10, 3.1)] if v == 0 else [(5.5, 13, 0.8), (10.5, 11, 2.4)]
    for bx, hgt, ph in stems:
        for k in range(hgt):
            y = 14 - k
            t = k / hgt
            cx = bx + 1.3 * math.sin(k * 0.55 + ph)
            half = 1.6 * (1 - t) + 0.5
            for x in range(T):
                if abs(x + 0.5 - cx) <= half:
                    im.putpixel((x, y), g[2] if x + 0.5 < cx else g[1])
    a = [[im.getpixel((x, y))[3] == 255 for x in range(T)] for y in range(T)]
    for y in range(T):
        for x in range(T):
            if a[y][x] and any(not (0 <= x + dx < T and 0 <= y + dy < T) or not a[y + dy][x + dx] for dx, dy in ((1, 0), (0, 1))):
                im.putpixel((x, y), g[0])
    for x in range(2, 15):
        if a[14][x] and im.getpixel((x, 15))[3] == 0:
            im.putpixel((x, 15), dk.SHADOW)
    return im


_SCALLOP = [
    "..ooooooo..",
    ".oLLmLmLLo.",
    "oLLmLLLmLLo",
    "oLmLLmLLmLo",
    ".omLLmLLmo.",
    "..omLmLmo..",
    ".ooooooooo.",
    "oLLLoooLLLo",
    "ooooo.ooooo",
]


def scallop(P, v: int):
    """가리비 껍데기(1×1, 걷는다): 손으로 찍은 11×9 — 둥근 부채(방사 줄 = 분홍·크림 번갈아) + 밑동 양옆으로 뻗은 경첩 귀.
    귀가 부채 밑보다 넓어야 버섯·잔으로 안 읽힌다. v0 은 바닥 오른쪽 아래, v1 은 둘(작은 것은 귀 없이)."""
    s = P["dg_shell"]
    key = {"o": s[0], "m": s[1], "L": s[2]}
    im = px.new()
    def put(x0, y0, rows):
        px.stamp(im, x0, y0, rows, key)
        for x in range(x0 + 1, x0 + len(rows[0]) + 1):
            y = y0 + len(rows)
            if 0 <= x < T and y < T and im.getpixel((x, y))[3] == 0:
                im.putpixel((x, y), dk.SHADOW)
    if v == 0:
        put(3, 4, _SCALLOP)
    else:
        put(1, 2, _SCALLOP)
        put(9, 9, [".ooooo.", "oLmLmLo", "oLmLmLo", ".omLmo.", "oLoooLo", "ooo.ooo"])
    return im


def coral(P):
    """산호(1×1, 막힘, 물가 바닥): 좁은 밑동에서 비스듬히 갈라진 가지 셋 — 높이가 3·5·7px 로 다르고 끝마다 둥근 혹,
    회갈 바위 받침. 산호 주황·연분홍 2톤 + 진한 산호색 윤곽. (끝 높이가 같으면 성가퀴로 읽혔다, QA-L2 N26.)"""
    s, rk = P["dg_coral"], P["dg_serock"]
    im = px.new()
    base = dk.lobes_inside([(8, 13.4, 5.0, 1.8)])
    dk.shade_blob(im, base, [rk[1], rk[2], rk[3], rk[4]], rk[0])
    lobes = [(8, 11.6, 3.4, 1.8),                                         # 밑동(좁다)
             (5.0, 9.6, 1.2, 2.2), (4.2, 7.6, 1.2, 1.2), (3.0, 6.0, 1.8, 1.6),   # 왼쪽 낮은 가지(비스듬히) + 혹
             (7.6, 7.6, 1.2, 3.4), (7.4, 3.4, 1.9, 1.7),                    # 가운데 높은 가지 + 혹
             (10.8, 9.8, 1.2, 1.8), (12.0, 8.4, 1.2, 1.2), (13.0, 7.2, 1.6, 1.5)]   # 오른쪽 중간 가지 + 혹
    inside = dk.lobes_inside(lobes)
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            e = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            c = s[0] if (e[1] or e[2]) else s[3] if (e[0] or e[3]) and x < 8 else s[2] if x < 9 else s[1]
            im.putpixel((x, y), c)
    return im


def puddle(P):
    """얕은 물 고임(1×1, 걷는다): 젖은 바닥에 찌그러진 물 덩이(왼쪽이 넓다) — 윗변에 젖은 바닥 테 1px(어두운 흙), 아래 두께 띠 1px, 속은 웅덩이와 같은 물결."""
    im = sea_floor(P, 2)
    f = P["dg_sefloor"]
    ins = dk.lobes_inside([(6.4, 9.2, 4.6, 2.9), (10.6, 9.8, 3.0, 2.0)])
    for y in range(T):
        for x in range(T):
            if ins(x, y):
                im.putpixel((x, y), sea_px(P, x, y + 1, 0) if ins(x, y - 1) else f[1])
            elif ins(x, y - 1):
                im.putpixel((x, y), f[0])
    return im


def isle_mask(m: int):
    """물 위 바위섬 땅 마스크(안 = 땅): 열린 변에서 북 1·서 1·동 1·남 4px 안으로(남쪽 4px 는 물로 떨어지는 앞면 자리),
    바깥 귀는 5px 45° 깎음(웅덩이 바깥 윤곽과 같은 문법), 안쪽 귀는 두 변 깎임이 겹치는 사각만 판다(이음매 불변)."""
    dN, dS, dW, dE, rad = 1, 4, 1, 1, 5
    ins = [[True] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if (not m & N and y < dN) or (not m & S and y > T - 1 - dS) or (not m & W and x < dW) or (not m & E and x > T - 1 - dE):
                ins[y][x] = False
    for bits, ax, ay, sx, sy in ((N | W, dW, dN, 1, 1), (N | E, T - 1 - dE, dN, -1, 1),
                                 (S | W, dW, T - 1 - dS, 1, -1), (S | E, T - 1 - dE, T - 1 - dS, -1, -1)):
        if m & bits:
            continue
        for y in range(T):
            for x in range(T):
                if (x - ax) * sx + (y - ay) * sy < rad:                    # 45° 깎음 — 같은 웅덩이 바깥 윤곽과 같은 문법(QA-L3 N30)
                    ins[y][x] = False
    for sides, diag, fa, fb in ((N | E, NE, lambda x, y: y < dN, lambda x, y: x > T - 1 - dE), (N | W, NW, lambda x, y: y < dN, lambda x, y: x < dW),
                                (S | E, SE, lambda x, y: y > T - 1 - dS, lambda x, y: x > T - 1 - dE), (S | W, SW, lambda x, y: y > T - 1 - dS, lambda x, y: x < dW)):
        if (m & sides) == sides and not m & diag:
            for y in range(T):
                for x in range(T):
                    if fa(x, y) and fb(x, y):
                        ins[y][x] = False
    return ins


def isle_masks() -> dict:
    return {m: isle_mask(m) for m in px.ALL47}


def isle_cell(P, m: int, f: int):
    """물 위 바위섬(오토타일, 걷는다 — 파도타기로 닿는 자리): 둥근 귀의 젖은 바닥 땅, 둘레 1px 밝은 바위 테(물 위로 솟은 땅),
    땅 남쪽은 물로 떨어지는 3px 앞면(위 밝음 → 물 곁 어둠), 땅 밖은 웅덩이와 같은 물(4프레임). 웅덩이 그룹이 이 그룹을 이어진 이웃으로 봐서
    둘레에 둑을 겹쳐 그리지 않는다 — 직각 L자 섬은 「물에 뚫린 네모 구멍」으로 읽혔다(QA-L2 N21)."""
    ins = isle_mask(m)
    fl, w = sea_floor(P, 1), P["dg_sewall"]
    def land(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        return False
    im = px.new()
    for y in range(T):
        for x in range(T):
            if ins[y][x]:
                edge = any(not land(x + dx, y + dy) and 0 <= x + dx < T and 0 <= y + dy < T for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)))
                im.putpixel((x, y), w[4] if edge and not land(x, y - 1) and 0 <= y - 1 else w[3] if edge else fl.getpixel((x, y)))
                continue
            bump = not m & S and (3 <= x <= 6 or 10 <= x <= 12)                # 앞면 혹 둘: 그 자리만 1px 더 내려온다(바위 턱 — 쟁반 오독 방지)
            k = next((k for k in ((1, 2, 3, 4) if bump else (1, 2, 3)) if land(x, y - k)), 0)
            if k:
                im.putpixel((x, y), ((w[2], w[1], w[1], w[0]) if bump else (w[2], w[1], w[0]))[k - 1])
            elif any(land(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                im.putpixel((x, y), P["dg_sefloor"][0])
            else:
                im.putpixel((x, y), sea_px(P, x, y, f))
    return im


# ==== 조립 =======================================================================================
def _cave_fixtures(sh, P, pre, wall_key, fl, light, exit_ol=None):
    wood = P["wood"]
    sh.add(f"{pre}_ladder", dk.wall_ladder(P, wall_key, wood))
    sh.add(f"{pre}_door", dk.wall_door(P, wall_key))
    sh.add(f"{pre}_hole", dk.floor_hole(fl, wood, P[wall_key][0], px.tint(P[wall_key][0], 0.45)))
    sh.add(f"{pre}_exit", dk.floor_exit(fl, light, exit_ol))


def _pool(sh, pre, P, draw, tiers=None):
    """웅덩이 47변형 × 4프레임 + 속 변형 <pre>_atin<단>_<v>_f<프레임>: tiers = {단: [기포 자리 또는 None(민 칸)]}.
    민 칸을 섞어 기포가 2~3칸에 하나꼴이 되게 한다(엔진이 칸 위치 해시로 고른다)."""
    for k in px.ALL47:
        if len(sh.tiles) % 4:
            sh.row_start()
        for f in range(4):
            sh.add(f"{pre}_at{k}_f{f}", draw(k, f, None))
        sh.ids[f"{pre}_at{k}"] = sh.ids[f"{pre}_at{k}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"{pre}_at{k}_f0"], frames=4, fps=3))
    for t, spots in (tiers or {}).items():
        for v, b in enumerate(spots):
            sh.row_start()
            for f in range(4):
                sh.add(f"{pre}_atin{t}_{v}_f{f}", draw(255, f, b))
            sh.anim.append(dict(baseTile=sh.ids[f"{pre}_atin{t}_{v}_f0"], frames=4, fps=3))
    sh.row_start()


def build(sh, P):
    # ---- 얼음 동굴 ----
    sh.section("얼음 동굴(눈 바닥·얼음 판 미끄럼·얼음 벽·얼음 바위·결정·석순·사다리·출구)")
    for v in range(4):
        sh.add(f"ic_snow{v}", snow(P, v))
    sh.add("ic_snow_s", dk.floor_shadow(snow(P, 0), P["dg_snow"][1]))
    sh.add("ic_crack", ice_crack(P))
    sh.add("ic_rough", ice_rough(P))
    for v in range(2):
        sh.add(f"ic_rock{v}", ice_rock(P, v))
    sh.add("ic_crystal", ice_crystal(P))
    sh.add("ic_drift", snow_drift(P))
    sh.add("ic_stal.0.0", dk.lifted(lambda Pc: cave.stalagmite(Pc, "t"), P, "dg_icewall"))
    sh.add("ic_stal.0.1", dk.lifted(lambda Pc: cave.stalagmite(Pc, "b"), P, "dg_icewall"))
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"ic_at{k}", ice_cell(P, k))
    sh.row_start()
    cave._TOP.clear(); cave._TOP.update(_snow_tops(P, "dg_icewall"))
    _cave_fixtures(sh, P, "ic", "dg_icewall", snow(P, 0), P["dg_exitlight"], P["dg_snow"][0])
    sh.row_start()
    # 얼음 벽: 푸른 얼음 바위 램프(윗면 = 눈 바닥보다 어두운 청색, 앞면 덩이 = 기후 설벽 앞면과 같은 청색대)
    dk.cave_walls(sh, P, "ic", "dg_icewall", snow(P, 0), [("dg_icewall", 2), ("dg_icewall", 3), ("dg_icewall", 4), ("dg_snow", 3), ("dg_snow", 4)])
    sh.end_section()

    # ---- 용암 동굴 ----
    sh.section("용암 동굴(적갈 바닥·용암 4프레임 기포·식은 껍질 판 다리·화산암 벽·분기공·불씨 바위·바위깨기 바위)")
    for v in range(6):
        sh.add(f"lv_fl{v}", ash(P, v))
    sh.add("lv_fl_s", dk.floor_shadow(ash(P, 0), P["dg_ash"][0]))
    sh.add("lv_cinder", cinder(P))
    sh.add("lv_vent.0.0", vent(P, "t"))
    sh.add("lv_vent.0.1", vent(P, "b"))
    for v in range(2):
        sh.add(f"lv_ember{v}", ember_rock(P, v))
    sh.add("lv_boulder", g2.boulder(P, 0))                              # 밀 바위 = 정본 gym2.boulder(g2_boulder0 과 같은 화소, I1 X3)
    sh.add("lv_cracked", dk.smash_rock(P, ash(P, 0), "dg_ash"))        # 깨는 바위 = 정본 cave.smash_rock(I1 X3)
    sh.add("lv_stal.0.0", dk.lifted(lambda Pc: cave.stalagmite(Pc, "t", "b"), P, "dg_lvwall"))
    sh.add("lv_stal.0.1", dk.lifted(lambda Pc: cave.stalagmite(Pc, "b", "b"), P, "dg_lvwall"))
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"lv_cb_at{k}", crust_cell(P, k))
    sh.ids["lv_cb"] = sh.ids["lv_cb_at255"]
    for v in range(6):
        sh.add(f"lv_cb_atin0_{v}", crust_cell(P, 255, v + 1))
    # 가장자리 열(서·동 변이 용암) 변형 셋씩: 테·칸 경계 금은 같고 칸 안쪽 판 모양만 다르다. 엔진 속 변형은 가장자리에 안 닿으므로
    # 손으로 섞는다(용암·다리 그룹이 connectTiles 로 이웃 취급) — 한 장 ×6 세로 반복을 깬다(QA-L3 N20).
    for k in (55, 205):
        for j in range(3):
            sh.add(f"lv_cb_alt{k}_{j}", crust_cell(P, k, (2, 4, 6)[j], alt=j))
    for v in range(3):
        sh.add(f"lv_cb_glow{v}", crust_glow(P, v))
    sh.row_start()
    _pool(sh, "lv", P, lambda k, f, b: lava_cell(P, k, f, b), tiers={0: [(5, 6), (11, 10), ("c", 1), ("c", 2), ("c", 6)], 1: [(7, 12), ("c", 7), (10, 5), ("c", 8), ("c", 3), ("c", 4)]})
    # 굳은 껍질 덩이 칸 셋(꽉 찬 용암 + 덩이 하나, 4프레임 — 덩이는 움직이지 않는다). 엔진 속 변형 밖이라 쇼케이스가 손으로 놓는다.
    # 껍질 판 칸 열둘(lv_crust{j}, j = 판 번호 — 0~3 중 · 4~9 소 · 10~11 대). 엔진 속 변형에는 넣지 않고 쇼케이스가 맵 좌표로 흩뿌린다.
    for j in range(len(_CRUST_SHAPES)):
        sh.row_start()
        for f in range(4):
            sh.add(f"lv_crust{j}_f{f}", lava_cell(P, 255, f, ("k", j)))
        sh.anim.append(dict(baseTile=sh.ids[f"lv_crust{j}_f0"], frames=4, fps=3))
    # 곧은 가장자리 자국 변형(QA-I5 V2): lv_ate<마스크>_<v>_f<프레임>, v = 1·2 (v0 은 lv_at<마스크>). 쇼케이스가 칸 해시로 섞는다.
    for k, n in LAVA_EDGE_VARIANTS.items():
        for v in range(1, n):
            sh.row_start()
            for f in range(4):
                sh.add(f"lv_ate{k}_{v}_f{f}", lava_cell(P, k, f, ("e", v)))
            sh.anim.append(dict(baseTile=sh.ids[f"lv_ate{k}_{v}_f0"], frames=4, fps=3))
    sh.row_start()
    _cave_fixtures(sh, P, "lv", "dg_lvwall", ash(P, 0), P["dg_exitlight"])
    sh.row_start()
    # 윗면 램프 dg_lvtop: 바탕은 dg_lvwall[1] 그대로, 잔돌·옆면 덩이 톤은 본 시트 cave_floor 와 같은 밝기 비(1.25·1.45·1.65배) —
    # 옛 램프(dg_lvwall 2~4)는 옆면 덩이 최대가 윗면의 2.8배라 세로 벽 옆면이 밝은 8px 점선 사슬로 보였다(QA-I5 V1).
    dk.cave_walls(sh, P, "lv", "dg_lvwall", ash(P, 0), "dg_lvtop")
    sh.end_section()

    # ---- 해저 동굴 ----
    sh.section("해저 동굴(젖은 바닥·물결 웅덩이 4프레임·회갈 벽·해초·가리비·산호)")
    for v in range(4):
        sh.add(f"se_fl{v}", sea_floor(P, v))
    sh.add("se_fl_s", dk.floor_shadow(sea_floor(P, 0), P["dg_sefloor"][0]))
    sh.add("se_puddle", puddle(P))
    for v in range(2):
        sh.add(f"se_weed{v}", seaweed(P, v))
        sh.add(f"se_shell{v}", scallop(P, v))
    sh.add("se_coral", coral(P))
    sh.add("se_rock", g2.boulder(P, 1))                                 # 밀 바위 = 정본 gym2.boulder v1
    sh.add("se_cracked", dk.smash_rock(P, sea_floor(P, 0), "dg_sefloor"))
    sh.add("se_stal.0.0", dk.lifted(lambda Pc: cave.stalagmite(Pc, "t"), P, "dg_sewall"))
    sh.add("se_stal.0.1", dk.lifted(lambda Pc: cave.stalagmite(Pc, "b"), P, "dg_sewall"))
    sh.row_start()
    _pool(sh, "se", P, lambda k, f, b: sea_cell(P, k, f, b), tiers={0: [1, 2], 1: ["deep"]})
    for k in px.ALL47:                                                  # 물 위 바위섬(47 × 4프레임)
        if len(sh.tiles) % 4:
            sh.row_start()
        for f in range(4):
            sh.add(f"se_isle_at{k}_f{f}", isle_cell(P, k, f))
        sh.ids[f"se_isle_at{k}"] = sh.ids[f"se_isle_at{k}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"se_isle_at{k}_f0"], frames=4, fps=3))
    sh.row_start()
    sh.add("se_hole_o", dk.floor_hole(px.new(), P["wood"], P["dg_sewall"][0], px.tint(P["dg_sewall"][0], 0.45)))
    _cave_fixtures(sh, P, "se", "dg_sewall", sea_floor(P, 0), P["dg_exitlight"])
    sh.row_start()
    # 윗면 램프 dg_setop: 용암과 같은 까닭으로 본 시트 밝기 비에 맞췄다(옛 램프는 2.9배, QA-I5 V1 — 1칸 벽 양옆 구슬 두 줄이 사다리로 읽혔다)
    dk.cave_walls(sh, P, "se", "dg_sewall", sea_floor(P, 0), "dg_setop")
    sh.end_section()
