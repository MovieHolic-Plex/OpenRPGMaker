"""화산재 지역 — em Route113(재 덮인 들판)·FallarborTown(재 덮인 마을)·LavaridgeTown(온천) 문법을 본 시트 화풍으로.

원작에서 잰 문법:
- 걷는 땅은 재가 덮인 풀(ash, 회황색 — 본 시트 풀처럼 덩이 두 톤). 마을 길은 다져진 흙길(ashpath). 재 덮인 키 큰 풀(atall)은 들쭉날쭉한 덩이.
- 북쪽은 화산 바위 벼랑(vcliff — 앞면 두 칸: 남쪽이 열린 칸 밑에 vcliff_face_*)이 마을을 감싸며 양옆으로 내려온다. 둘째 층 vcliff2 는 양 날개에만(가운데까지 겹치면 앞면 띠가 세 줄로 겹친다, L1 N1). 바위 무더기 봉우리 vcone·vcone_c 는 2×2 와 그 아래 한 칸이 같은 층 윗면인 곳에만.
  출구는 벼랑 사이 2칸 틈과 숲 벽(aforest_) 틈.
- 건물은 탁한 지붕 램프(roof_ash_orange·roof_ash_red)에 재가 쌓인다: 먼 비탈은 재가 거의 덮고, 용마루 윗줄·처마 띠 위에 재 줄, 앞 비탈엔 재 덩이 몇.
  센터는 본 시트 센터 그대로(빨간 지붕·십자) + 용마루 재 띠(center_ash, ash_cap). 건물 사이는 한 칸 이상 띄운다.
- 온천(spring): 짙은 회색 둥근 돌 고리 안 옅은 하늘빛 물, 잔잔한 결 + 드문 반짝임(속 변형은 기포). 김은 위층 steam 을 물 칸 몇 곳에 띄운다(서리 테 없음).
  온천 옆에 모래찜질 터(sandbath, 검은 화산 모래)와 찜질하는 사람 둔덕(sand_mound, 말 걸기 자리).
- 재 더미(ash_pile)는 낮고 넓은 부드러운 둔덕(윤곽선 없음, 가장자리 체커), 용암석(lava_rock)은 붉은 틈이 비치는 현무암. 증기 구멍(steam_vent, 1×2)은 정본 던전 분기공 dungeon_cavern.vent 를 현무암·용암빛 램프로 부른다.
- 나무는 본 시트 숲 수관 그루 하나(2×4, 야생 forest_o 와 같은 키)에 잿빛 잎, 줄기는 회갈색(atree_a)."""
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
    "ashpath": ("ash-path", 3, 5, 2),
    "spring_outer": ("spring-outer", 0, 8, 0),
    "spring_inner": ("spring-inner", 6, 3, 0),
    "sandbath": ("sand-bath", 3, -1, 2),
}

_ASH0: dict = {}


def ash_tex(P, v: int):
    a = P["ash"]
    return px.clumps(f"ash{v}", a[2], [(a[3], 9 + v, 4), (a[4], 3, 3)])    # 어두운 1px 점 없음(L4 K7) · 덩이 수를 절반으로 줄이고 폭을 키워 잡음 대신 덩이로(I1 X6)


def init(P):
    _ASH0.clear(); _ASH0.update(cc.tex_table(ash_tex(P, 0)))


def ash0(x, y):
    return _ASH0[(x, y)]


def ash_path(P, m: int):
    """다져진 흙길(꽃잎마을): 옅은 황토 면 + 한 단 밝은 작은 덩이 몇 개(짙은 점 없음 — 16px 마다 같은 자리 무늬가 세로 줄로 읽혀서 조용하게 둔다, L5 K4),
    경계 안쪽 1px 진한 흙 테, 바깥 재 쪽 1px 그늘."""
    d, a = P["ash_path"], P["ash"]
    tex = px.clumps("ashpath", d[2], [(d[3], 6, 2)])
    h = px.rng("ashpath-fringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    def rim_in(x, y, dd):
        if dd == 1:
            return d[1]
        if dd == 2 and table[y][x] < 0.35:
            return d[1]
        return None
    def rim_out(x, y, dd):
        return a[1] if dd == 1 and table[y][x] < 0.6 else None
    return cc.blob_tile(m, PARAMS["ashpath"], lambda x, y: tex.getpixel((x, y)), ash0, rim_in, rim_out)


def spring(P, m: int, f: int, v: int = 0):
    """온천(4프레임, 용암마을 문법): 바깥 재 → 짙은 회색 둥근 돌 고리 → 옅은 하늘빛 물. 물은 칸 위아래로 한 단씩 밝아지는 잔잔한 결(그물 무늬 없음)과
    드문 반짝임 하나가 프레임마다 깜빡인다. 흰 서리 테는 없다(물가 1px 은 한 단 진한 물빛). v 1~3 = 속 변형: 기포 무리가 프레임마다 올라온다.
    김은 물 칸에 그리지 않고 위층 물체(steam)로 띄운다."""
    hw, st = P["spring"], P["stone"]
    outer = px.inside_mask(m, *PARAMS["spring_outer"])
    inner = px.inside_mask(m, *PARAMS["spring_inner"])
    im = px.new()
    sparkle = [(3, 4), (11, 9), (6, 12), (13, 2)][f]
    bubbles = {1: [(4, 10), (5, 6), (9, 3)], 2: [(10, 11), (11, 7), (7, 4)], 3: [(6, 9), (12, 5), (3, 3)]}.get(v, [])
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                band = (y + (x // 6) + ((0, 3, 5, 2)[v % 4] if v else (m * 5) % 8)) % 8   # 변형·가장자리 마스크마다 결 높이를 엇갈린다(칸 반복이 안 보이게)
                c = hw[2] if band < 5 else hw[1]                          # 잔잔한 결: 넓은 밝은 띠 + 가는 그늘 띠(칸마다 이어진다)
                if (x, y) == sparkle and v == 0:
                    c = hw[3]
                for i, (bx, by) in enumerate(bubbles):
                    yy = (by - f * 2) % T
                    if (x, y) in ((bx, yy), (bx + 1, yy)) and i <= f % 3 + 1:
                        c = hw[3]
                    elif (x, y) == (bx, (yy + 1) % T) and i <= f % 3 + 1:
                        c = hw[1]
                if not all(px.neighbours4(inner, x, y, m).values()):
                    c = hw[0]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                c = cc.stone_px(st, x, y)
                if not all(px.neighbours4(outer, x, y, m).values()):
                    c = st[0]
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), ash0(x, y))
    return im


def steam(P, v: int):
    """온천 김(위층, 반투명): 물 면에서 솟는 가는 세로 아지랑이 두~세 가닥(1~2px 폭, 좌우로 흔들리며 위로 갈수록 옅어진다).
    둥근 김 덩이는 옅은 물빛 위에서 얼음 조각·거품으로 읽혀서 쓰지 않는다(L2 N7). 물 칸 위 또는 물 북쪽 돌 고리 칸에 얹는다."""
    w = P["snow"][6]
    im = px.new()
    strands = [[(5, 15, 15), (10, 14, 12)], [(7, 15, 14), (12, 15, 10)]][v % 2]   # (x, 밑 y, 길이) — 물 위쪽 줄에서 솟아 돌 고리 위로 지난다
    for i, (x0, yb, ln) in enumerate(strands):
        for k in range(ln):
            y = yb - k
            x = x0 + round(0.9 * math.sin(k * 0.45 + i * 1.9))
            a = int(170 * (1 - k / ln) + 40)
            im.putpixel((x, y), (w[0], w[1], w[2], a))
            if k < ln * 0.45:
                im.putpixel((x + 1, y), (w[0], w[1], w[2], a // 2))
    return im


def sandbath(P, m: int):
    """모래찜질 터(용암마을, 걷는 땅): 재 바닥보다 한 단 밝은 따뜻한 모래 면(sb[2]) + 밝은 알갱이 덩이(sb[3]), 경계는 재 쪽으로 톤만 바뀐다(윤곽선 없음).
    어두운 진흙색으로 칠하면 진흙탕에 디딤돌을 놓은 것처럼 읽힌다(L2 N6)."""
    sb, a = P["sandbath"], P["ash"]
    tex = px.clumps("sandbath", sb[2], [(sb[3], 7, 2)])               # 조용한 면(어두운 점은 칸마다 같은 자리에 찍혀 격자로 보여서 뺐다)
    def rim_in(x, y, d):
        return sb[1] if d == 1 and (x + y) % 2 else None
    def rim_out(x, y, d):
        return sb[1] if d == 1 and (x + y) % 2 == 0 else None
    return cc.blob_tile(m, PARAMS["sandbath"], lambda x, y: tex.getpixel((x, y)), ash0, rim_in, rim_out)


_BATHER = (                                                             # 모래 위로 내민 머리(손 격자) — O 윤곽 · h 머리칼 · H 머리 빛 · s 얼굴 빛 · k 얼굴 · d 얼굴 그늘 · e 눈
    "................",
    "......OOOO......",
    ".....OhhHhO.....",
    "....OhHhhhhO....",
    "....OhkkkkhO....",
    "....OsekkedO....",
    "....OskkkkdO....",
    ".....OskkdO.....",
)


_MOUND = (                                                              # 모래 둔덕(손 격자) — 0~4 찜질 모래 램프 sb[0..4](0 = 최암 윤곽) · s 오른쪽 아래 그늘 · . 투명
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..00........00..",                                                 # 어깨 혹 꼭대기(머리 윤곽에 붙는다)
    ".0443......3320.",
    "..032......220..",                                                 # 혹 밑 1px 홈 — 혹이 몸에서 떨어져 보인다(턱 입술은 따로 찍는다)
    ".04433333333210.",
    "0443333333332210",                                                 # 몸 = 넓은 가로 타원, 옆이 9~11행에서 가장 불룩하다
    "0433333333322110",
    ".03333333322110.",
    "..022222211110ss",                                                 # 밑이 둥글게 좁아진다
    "....00000000ss..",
    ".....ssssssss...",
)


def sand_mound(P):
    """모래찜질 하는 사람(1칸, 통행 불가 — 말 걸기 이벤트 자리, 원작 용암마을 모래찜질): 모래에 묻혀 머리만 내민 사람.
    몸 = 칸 아래 절반을 덮은 넓은 가로 타원 둔덕(손 격자 _MOUND, 16px 폭 — 윤곽 왼끝이 2·1·0·0·1·2·4 로 불룩했다가 밑에서 둥글게 좁아진다) +
    머리 양옆으로 솟은 어깨 두 혹(6~7행, 밑에 1px 홈). 명암은 왼쪽 위 빛: 윗면·왼쪽 sb[4] → 몸 sb[3] → 아래·오른쪽 sb[2]·sb[1], 둘레 최암 sb[0] 1px.
    머리(8×7, 손 격자 _BATHER): 짙은 머리칼(정수리 빛 한 점) + 살색 얼굴(왼쪽 빛·오른쪽 그늘) + 눈 두 점, 턱 밑을 모래 입술(밝은 모래 한 줄)이 감싼다.
    I2 Y5 — 납작한 타원은 조약돌로, I3 Z2 — 옆이 수직이고 밑이 평평한 몸은 상자·자루로 읽혔다."""
    sb, hb = P["sandbath"], P["bather"]
    pal = {"O": hb[0], "h": hb[1], "H": hb[2], "d": hb[3], "k": hb[4], "s": hb[5], "e": hb[0]}
    im = px.new()
    for y, row in enumerate(_MOUND):
        for x, ch in enumerate(row):
            if ch == "s":
                im.putpixel((x, y), (0, 0, 0, 56))                      # 오른쪽 아래 그늘
            elif ch != ".":
                im.putpixel((x, y), sb[int(ch)])
    for y, row in enumerate(_BATHER):
        for x, ch in enumerate(row):
            if ch != ".":
                im.putpixel((x, y), pal[ch])
    for x in range(5, 11):                                              # 턱 밑 모래 입술(머리를 감싼다)
        im.putpixel((x, 8), sb[0] if x in (5, 10) else sb[4])
    return im


def ash_roof(P, im, n: int, seed: str, roof_key: str):
    """재 덮인 지붕(꽃잎마을 문법): 탁한 지붕(이미 roof_ash_* 램프로 그렸다) 위에 재가 쌓인다 — 먼 비탈(위쪽 벽돌)은 재가 덮되 아랫변이
    물결치며 지붕이 드러나고(재 아랫줄은 그늘 재), 용마루 띠 윗줄과 끝 마개 윗부분에 재, 처마 띠 위에 끊긴 재 줄, 앞 비탈엔 기와 줄 윗면마다
    2~4px 가로 재 덩이. 지붕 몸(기와 줄)은 공통 지붕 함수 그대로 — 다시 그리지 않는다. 재 2톤, 윤곽선 없음.
    행 좌표는 정본 지붕 높이 bd.ROOF_H 에서 읽는다(위쪽 벽돌 1..up · 용마루 ry · 기와 ry+9 부터 5px 주기 · 처마 띠 위 H-4, 통합 I4 W1)."""
    H = bd.ROOF_H
    up = 8 if H >= 49 else 4                                            # 정본 roof_flat 과 같은 식
    ry = 1 + up
    ap = P["ash_pile"]
    lite, dark = ap[3], ap[2]
    w = n * T
    r = px.rng(f"ashroof2-{seed}")
    out = im.copy()
    def put(x, y, c):
        if 0 <= x < w and 0 <= y < H and out.getpixel((x, y))[3]:
            out.putpixel((x, y), c)
    # 지붕 결은 다시 그리지 않는다 — 공통 지붕 함수(buildings.roof_flat)를 재 램프로 부른 그림 그대로 두고 재만 얹는다(정본 원칙, L4 N4).
    ph = r.uniform(0, 6.28)
    yb0, amp = (6, 1.6) if up >= 8 else (3, 0.9)
    for x in range(2, w - 2):
        yb = min(up, yb0 + round(amp * math.sin(x * 0.42 + ph) + 0.6 * math.sin(x * 1.1)))
        for y in range(1, yb + 1):
            put(x, y, dark if y == yb else lite)
        put(x, ry, lite)                                                   # 용마루 윗줄
        if (x // 5) % 4:
            put(x, H - 4, lite)                                            # 처마 띠 위 재 줄
    for x0 in (0, w - 7):                                                  # 용마루 끝 마개(공통 지붕: 지붕 색 7px) 윗부분에 재
        for i in range(1, 6):
            for y in (ry, ry + 1):
                put(x0 + i, y, lite)
    # 앞 비탈 재: 기와 줄(공통 지붕 shingle_rows: ry+9 부터 5px 주기) 윗면에 2~4px 가로 덩이 — 줄을 가로지르는 블록으로 그리지 않는다(L5 N1)
    rows = list(range(ry + 9, H - 3, 5))
    for _ in range(5 + n):
        y = r.choice(rows)
        cx, ln = r.randint(4, w - 9), r.randint(2, 4)
        for i in range(ln):
            put(cx + i, y, lite)
        if ln >= 3:
            put(cx + 1, y + 1, lite)
    return out


def ash_cap(P, im, ymax: int = 64):
    """큰 건물 곡면 지붕 위 재: 열마다 지붕 맨 윗점 밑 2~4px 에 재가 얹힌다(위 줄 밝은 재, 아래 줄 그늘 재)."""
    ap = P["ash_pile"]
    out = im.copy()
    for x in range(im.width):
        ys = [y for y in range(ymax) if im.getpixel((x, y))[3] == 255]
        if not ys or ys[0] > ymax - 12:
            continue
        top = ys[0]
        oc, y0 = im.getpixel((x, top)), top
        while y0 < ymax - 1 and im.getpixel((x, y0)) == oc:            # 윤곽(맨 윗점과 같은 색 줄) 밑에서부터 — 비탈 계단 윤곽 바깥에 재 테가 비어지지 않게(L7 K3)
            y0 += 1
        th = 2 + (1 if (x // 5) % 3 == 0 else 0) + (1 if (x // 7) % 4 == 1 else 0)
        for y in range(y0, y0 + th):
            out.putpixel((x, y), ap[3] if y < y0 + th - 1 else ap[2])
    return out


def masks(kind: str) -> dict:
    return cc.masks(PARAMS[kind])


# ---- 소품 -----------------------------------------------------------------------------------
def ash_pile(P, v: int):
    """재 더미(통행 불가, 113번 도로 문법): 바닥에서 솟은 둥근 봉긋한 둔덕(밑은 평평, 위는 반원에 가깝다 — 높이 8~9px) —
    위쪽 40% 는 가장 밝은 재(ap[4]), 몸통은 밝은 재(a[4]), 밑 두 줄은 한 단 그늘 재(a[3]). 둘레는 바닥과 체커로 녹아 딱딱한 테가 없고,
    밑에만 반투명 접지 그림자. 납작한 타원은 디딤돌로 읽혀서 높이를 키웠다(L2 N9). v 마다 봉우리 자리가 다르다."""
    a, ap = P["ash"], P["ash_pile"]
    im = px.new()
    cx, base, rx, h, sk = [(8.0, 13.0, 6.2, 8.5, -0.8), (7.6, 13.0, 5.8, 9.0, 0.9)][v % 2]
    def half(yf):
        t = (base - yf) / h
        if t < 0 or t > 1:
            return -1.0
        return rx * (1 - t * t) ** 0.5
    def ins(x, y):
        hh = half(y + 0.5)
        if hh < 0:
            return False
        t = (base - (y + 0.5)) / h
        return abs(x + 0.5 - (cx + sk * t)) <= hh
    for y in range(T):
        for x in range(T):
            if ins(x, y):
                continue
            if y >= base - 1 and y <= base + 1 and abs(x + 0.5 - cx - 1) <= rx + 0.5:
                im.putpixel((x, y), (0, 0, 0, 56))
    for y in range(T):
        for x in range(T):
            if not ins(x, y):
                continue
            edge = any(not ins(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, -1)))
            if edge and (x + y) % 2 and y < base - 1:
                continue                                                  # 둘레 체커(바닥이 비친다)
            t = (base - (y + 0.5)) / h
            lx = (x + 0.5 - cx) / rx
            c = ap[4] if t > 0.6 and lx < 0.35 else a[4] if t > 0.22 else a[3]
            im.putpixel((x, y), c)
    return im


def lava_rock(P, v: int):
    """용암석(통행 불가): 검붉은 현무암 덩이, 오른쪽 아래 틈으로 붉게 달아오른 금이 비친다."""
    lv, gl = P["lava"], P["lava_glow"]
    shape = [[(7.6, 8.4, 5.6), (4.4, 10.8, 3.6), (11.6, 10.8, 3.4)], [(8.0, 8.0, 5.0), (11.4, 10.6, 3.6), (4.8, 11.0, 3.2)]][v % 2]
    im = cc.shade_lobes(px.new(), shape, [lv[0], lv[1], lv[2], lv[3], lv[3]], ol=lv[0])
    inside = cc.lobes(shape)
    cracks = [(9, 6), (9, 7), (8, 8), (8, 9), (9, 10), (10, 10), (6, 10), (7, 11)] if v == 0 else [(6, 6), (7, 7), (7, 8), (8, 9), (10, 8), (11, 9), (11, 10)]
    for i, (x, y) in enumerate(cracks):
        if inside(x, y) and inside(x + 1, y + 1):
            im.putpixel((x, y), gl[1] if i % 3 else gl[2])
            if inside(x + 1, y) and im.getpixel((x + 1, y))[:3] != gl[2][:3]:
                im.putpixel((x + 1, y), gl[0])
    return im


def ash_tree(P):
    """재 덮인 외톨이 둥근 나무(2×4) = 본 시트 숲 벽 조립(forest.forest_canvas)으로 그루 하나를 그린 것(야생 forest_o 와 같은 문법·같은 키 — I1 X4):
    솟은 수관 줄 + 수관 두 줄 + 줄기·그림자 줄. 잎은 잿빛 램프, 줄기는 회갈색(trunk_ash), 줄기 그림자는 재 바닥 최암. 바탕은 투명(재 땅 위 위층)."""
    import forest
    a = P["ash"]
    return forest.forest_canvas(dict(P, grass=[a[0], a[1]]), lambda x, y: (0, 0, 0, 0), 1, 1, "forest-crown")
