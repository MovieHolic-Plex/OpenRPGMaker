"""버들항 판석→다진 흙 오토타일(flag over dirt) 손 도트 원본 — 16px 칸, 3/4 탑뷰(평지), 버들항 시트 색만(yard_art.PAL).

신전 폐허 뜰에서 판석(beodeul_yard_flag)이 다진 흙 마당(beodeul_yard_dirt) 안에 놓일 때 쓰는 가장자리 벌.
기존 판석 가장자리는 바깥이 잔디이고 다듬은 연석 테가 있다 — 흙 마당 안에서는 「새로 깐 광장」으로 읽혔다(VQA r8·r9).
이 벌은 연석이 없다: 판석이 가장자리로 갈수록 깨지고 빠져서 흙으로 무너진다.

  - 바깥 띠(칸 변에서 HARD 화소)는 늘 다진 흙 — yard_art 다진 흙 몸통(DIRT["body"])의 같은 자리 화소 그대로라 흙 몸통 칸과 이음새가 없다.
  - 안쪽(칸 변에서 SOFT 화소 넘게)은 그 역할이 고른 판석 몸통의 배치도 그대로 — 판석 몸통 칸과 이음새가 없다(칸 사이 줄눈 길 BORDER_JOINTS 유지).
  - 사이 띠는 판석 한 장 단위로 손으로 고른다(BREAK): 남김 / 깨짐(흔들리는 깨진 선 안쪽만 남김) / 빠짐(흙).
    깨진 판석은 남은 화소로 다시 명암을 입히고(왼쪽 위 빛 · 오른쪽 아래 그늘) 깨진 면에 이 빠진 점을 찍는다.
  - 흙 위에는 손으로 고른 자리에 판석 조각·잔 부스러기(FRAG)를 흩고, 판석·조각 아래·오른쪽 흙에는 1화소 그늘(f · 0)을 둔다(살짝 가라앉은 판).
  - 가장자리 칸 사이 경계(칸 0열·15열, 0행·15행)는 바깥 띠에서는 흙, 안쪽에서는 몸통 줄눈 — 어느 두 칸을 붙여도 판석이 맞닿거나 잘리지 않는다.

역할·순서: yard_art.ORDER(body, body2..body8 = 판석 몸통 그대로, N, S, W, E, NW, NE, SW, SE, iso, inNW, inNE, inSE, inSW) 뒤에
ALT_ORDER(곧은 변 둘째~넷째 벌 N2 S2 W2 E2 N3 S3 W3 E3 N4 S4 W4 E4, 볼록 모서리 둘째 벌 NW2 NE2 SW2 SE2). 새 칸은 몸통 여덟을 뺀 29칸.
벌 고르기는 phase_role(role, x, y) — 곧은 변은 이웃 두 칸이 결코 같지 않고 일정한 주기가 없다. 굽는 쪽(감독·bake)은 이 함수를 그대로 쓴다.
이미지 생성·트레이싱·사람·글자 없음.

  python3 flag_dirt_art.py preview OUT.png   # 4배 확인판(모든 칸 + 표본 판)
  python3 flag_dirt_art.py gate DIR          # 3/4 관문용 표본 PNG + DIR/items.jsonl
  python3 flag_dirt_art.py check             # 팔레트·이음새 검사
API: tiles() -> {role: 16×16 RGBA}, rows() -> {role: 행 문자열}, ORDER, NEW_ROLES, phase_role(role, x, y),
     sample(flag_grid=None, dirt_grid=None) -> RGBA, gate_image() -> RGBA, gate_export(dir), GATE_NAME, GATE_KIND
"""
import json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import yard_art as A  # noqa: E402

T = A.T
PAL = A.PAL
img_of = A.img_of

ROLES = A.ROLES                 # body, N, S, W, E, NW, NE, SW, SE, iso, inNW, inNE, inSE, inSW
VARIANTS = A.VARIANTS           # body2..body8 — 판석 몸통 그대로
ALT_ORDER = [f"{d}{k}" for k in (2, 3, 4) for d in "NSWE"] + ["NW2", "NE2", "SW2", "SE2"]     # 곧은 변마다 넷째 벌까지(N2 S2 W2 E2 N3 … E4) + 볼록 모서리 둘째 벌
ORDER = A.ORDER + ALT_ORDER
EDGE_ROLES = [r for r in ROLES if r != "body"] + ALT_ORDER
NEW_ROLES = EDGE_ROLES      # 새로 그린 칸(몸통 여덟은 yard_art 판석 몸통과 같은 그림)

HARD = 2        # 칸 변에서 이만큼은 늘 흙(여기에 흔들림 JAG 를 더한다 — 깨진 선은 칸 안 3~11화소를 오간다)
SOFT = 12       # 칸 변에서 이만큼 넘게는 늘 판석 몸통(이웃 판석 몸통 칸과 줄눈 길이 맞는다)

# 역할마다 열린 쪽(흙 쪽): 변 N S W E, 오목 모서리 cNW…(그 모서리만)
OPEN = {"NW": "NW", "NE": "NE", "SW": "SW", "SE": "SE", "iso": "NSWE",
        "inNW": "cNW", "inNE": "cNE", "inSE": "cSE", "inSW": "cSW"}
OPEN.update({f"{d}{k}": d for d in "NSWE" for k in ("", "2", "3", "4")})
OPEN.update({f"{c}2": c for c in ("NW", "NE", "SW", "SE")})

# 역할마다 품을 판석 몸통(배치도) — 같은 변의 네 벌이 모두 다른 몸통, 모서리마다 또 다른 몸통
BODY_OF = {"N": "body", "N2": "body5", "N3": "body7", "N4": "body3",
           "S": "body3", "S2": "body6", "S3": "body8", "S4": "body2",
           "W": "body2", "W2": "body7", "W3": "body4", "W4": "body",
           "E": "body4", "E2": "body8", "E3": "body6", "E4": "body5",
           "NW": "body6", "NE": "body2", "SW": "body5", "SE": "body7", "iso": "body3",
           "NW2": "body4", "NE2": "body8", "SW2": "body", "SE2": "body3",
           "inNW": "body8", "inNE": "body4", "inSE": "body", "inSW": "body2"}

# 깨진 선 깊이(16 주기, 손으로 고름): 칸 변에서 HARD + 이 값까지가 흙. 변마다·벌마다 다른 표 — 긴 변이 되풀이돼 보이지 않게.
# 이웃 화소끼리 1 넘게 뛰지 않는다(가시·빗살 방지). 판석은 무게중심이 이 선 바깥이면 빠지고, 걸치면 깨지거나 통째로 남는다.
JAG = {   # 0..7 — 벌마다 깊게 팬 자리·얕은 자리가 다르다(1.5배 해서 칸 변에서 2~12화소)
    "N":  [1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 3, 2, 2, 1],
    "N2": [1, 1, 1, 2, 2, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 1],
    "N3": [2, 3, 5, 6, 7, 6, 5, 3, 2, 1, 1, 2, 2, 3, 2, 2],
    "N4": [1, 2, 2, 1, 1, 2, 3, 4, 5, 6, 7, 7, 6, 4, 3, 2],
    "S":  [2, 3, 3, 2, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 2],
    "S2": [1, 2, 4, 5, 6, 7, 6, 4, 3, 2, 2, 3, 3, 2, 2, 1],
    "S3": [1, 1, 2, 2, 3, 2, 2, 1, 1, 2, 3, 3, 2, 2, 1, 1],
    "S4": [2, 2, 3, 4, 3, 2, 3, 4, 6, 7, 7, 6, 5, 4, 3, 2],
    "W":  [2, 3, 4, 6, 7, 7, 6, 4, 3, 2, 2, 3, 3, 2, 2, 2],
    "W2": [1, 1, 2, 2, 1, 1, 2, 3, 3, 2, 1, 1, 2, 2, 1, 1],
    "W3": [1, 2, 2, 3, 3, 2, 2, 3, 4, 5, 6, 7, 6, 5, 3, 1],
    "W4": [2, 3, 5, 6, 5, 3, 2, 2, 3, 5, 6, 5, 4, 3, 2, 2],
    "E":  [1, 2, 2, 3, 4, 6, 7, 7, 6, 4, 3, 2, 2, 2, 1, 1],
    "E2": [2, 3, 3, 2, 2, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 2],
    "E3": [1, 2, 4, 6, 7, 6, 4, 3, 2, 2, 3, 4, 3, 2, 2, 1],
    "E4": [2, 2, 3, 3, 2, 2, 3, 5, 6, 7, 7, 6, 5, 3, 2, 2],
}
SIDE_JAG = {"N": "N", "S": "S", "W": "W", "E": "E"}       # 모서리·외딴 칸은 첫 벌 표를 쓴다
CORNER_R = 8    # 오목 모서리 홈 반지름(맨해튼) — 모서리를 비스듬히 깎아 네모 구멍이 아니라 둥근 패임으로
CORNER_JAG = [0, 2, 1, 3, 2, 0, 1, 2, 3, 1, 0, 2, 1, 3, 2, 1]


def depth(open_, x, y):
    """열린 쪽까지의 거리(가장 가까운 것). 모서리 홈은 맨해튼 거리의 반."""
    d = 99
    if open_.startswith("c"):
        cx = 0 if "W" in open_ else T - 1
        cy = 0 if "N" in open_ else T - 1
        return (abs(x - cx) + abs(y - cy)) // 2 + 1
    for c in ("N", "S", "W", "E"):
        if c in open_:
            d = min(d, {"N": y, "S": T - 1 - y, "W": x, "E": T - 1 - x}[c])
    return d


def hard_dirt(role, open_, x, y):
    """늘 흙인 화소: 흔들리는 깨진 선 바깥."""
    if open_ == "NSWE":     # 외딴 한 칸: 가운데 둥근 섬(손으로 고른 반지름) 바깥은 흙
        dx, dy = abs(x - 7.5), abs(y - 7.0)
        return max(dx, dy) > 5.5 or dx + dy > 8 + JAG["N"][x] % 2
    if open_.startswith("c"):
        cx = 0 if "W" in open_ else T - 1
        cy = 0 if "N" in open_ else T - 1
        return abs(x - cx) + abs(y - cy) < CORNER_R + CORNER_JAG[(x * 3 + y * 5) % T]
    for c in ("N", "S", "W", "E"):
        if c in open_:
            along = x if c in "NS" else y
            tab = JAG[role] if role in JAG else JAG[c + ("3" if role.endswith("2") else "")]
            dist = {"N": y, "S": T - 1 - y, "W": x, "E": T - 1 - x}[c]
            if dist < HARD + (tab[along] * 3 + 1) // 2: return True     # 표 값의 1.5배 — 깊게 패고 얕게 남는다
    if len(open_) >= 2:     # 볼록 모서리·외딴 칸: 모서리 쪽을 더 둥글게 깎는다
        for cx in ((0,) if "W" in open_ else ()) + ((T - 1,) if "E" in open_ else ()):
            for cy in ((0,) if "N" in open_ else ()) + ((T - 1,) if "S" in open_ else ()):
                if abs(x - cx) + abs(y - cy) < 2 * HARD + 9: return True
    return False


# 판석 한 장의 운명(손으로 고름). 키 = (역할, 판석 글자). 값: "keep" 남김 · "drop" 빠짐 · "break" 깨진 선 안쪽만 남김.
# 적지 않은 판석은 자동: 판석이 전부 안쪽(depth >= SOFT)이면 남김, 화소 반 넘게가 HARD+2 안쪽이면 빠짐, 나머지는 깨짐.
BREAK = {}


def _auto_fate(role, open_, pix):
    ds = [depth(open_, x, y) for x, y in pix]
    if min(ds) >= SOFT: return "keep"
    gone = sum(hard_dirt(role, open_, x, y) for x, y in pix)
    if gone * 3 > len(pix) * 2: return "drop"
    return "break"


# 흙 위의 판석 조각·부스러기(손으로 고른 자리). (글리프, x, y, 가족). 글리프 '#' = 판석 화소.
FRAG_GLYPH = {
    "f32": ["###", ".##"],
    "f33": [".##", "###", "##."],
    "f22": ["##", "##"],
    "f23": ["##", "##", ".#"],
    "f43": [".###", "####", "###."],
    "f34": [".#.", "###", "###", ".#."],
    "f12": ["#", "#"],
    "f31": ["###"],
    "f53": [".###.", "#####", "..##."],
}
FRAG = {   # 대부분의 칸은 조각이 없다 — 몇 벌에만 크기가 다른 조각 무리(흙 띠 안, 칸 변에서 떨어진 자리). 가족 warm/cool.
    "N": [("f53", 3, 2, "warm")],
    "N3": [("f31", 11, 1, "cool")],
    "S2": [("f43", 9, 12, "cool")],
    "S4": [("f23", 3, 12, "warm")],
    "W": [("f34", 1, 3, "cool"), ("f12", 3, 9, "warm")],
    "W4": [("f31", 1, 12, "warm")],
    "E2": [("f53", 10, 11, "warm")],
    "E3": [("f12", 13, 3, "cool")],
    "NW": [("f32", 2, 3, "cool")],
    "NE2": [("f33", 11, 1, "warm")],
    "SW": [("f43", 1, 11, "cool"), ("f12", 7, 13, "warm")],
    "SE2": [("f23", 12, 10, "warm")],
    "iso": [("f32", 12, 12, "cool"), ("f12", 2, 2, "warm")],
    "inNE": [("f31", 12, 1, "cool")],
    "inSW": [("f23", 1, 12, "warm")],
}

# 판석과 흙 사이에 돋은 잡풀(손으로 고른 자리, 잔디 색). 글리프 숫자 = 잔디 색, '~' = 포기 밑 흙 그늘.
WEED = [".7", "73", "~~"]
WEEDS = {"N": [(12, 4)], "N4": [(5, 3)], "S2": [(4, 11)], "S3": [(9, 12)], "W": [(2, 8)], "W3": [(1, 3)], "E2": [(12, 11)], "E4": [(13, 5)],
         "NE": [(5, 3)], "SW": [(10, 12)], "iso": [(4, 4)], "inSE": [(12, 12)]}

CHIP = "X"
CHIP_FAM = {"warm": "db*+DV", "cool": "dZb*+D"}     # 흙 위 조각: 가장 밝은 단(x·c)을 빼 흙 위 흰 점으로 튀지 않게, 아랫테는 짙게      # 깨진 면의 이 빠진 점


def _slabs(lay):
    out = {}
    for y in range(T):
        for x in range(T):
            c = lay[y][x]
            if c != ".": out.setdefault(c, set()).add((x, y))
    return out


EDGE_RAMP = {"cool": "dZb*+D", "warm": "db*+DV", "sunk": "db*+DV"}   # 가장자리 판: 가장 밝은 단을 빼고 흙에 물든 따뜻한 쪽으로 — 가라앉은 회청색 판은 쓰지 않는다
EDGE_ZONE = 7   # 열린 쪽에서 이만큼 안쪽 판석은 흙에 물든 판(EDGE_RAMP)으로 다시 칠한다


def _shade_edge(comp, fam):
    ramp = EDGE_RAMP[fam]
    out = dict(A.shade_unit(comp, ramp, flat=True))
    for (x, y) in comp:             # 오른쪽·아래 테를 한 단 더 짙게(왼쪽 위 빛, 흙으로 가라앉는 입술)
        if (x, y + 1) not in comp: out[(x, y)] = ramp[4]
        elif (x + 1, y) not in comp: out[(x, y)] = ramp[3]
    return out


def role_rows(role):
    if role == "body": return A.flag_body("body")
    if role in VARIANTS: return A.flag_body(role)
    open_ = OPEN[role]
    bname = BODY_OF[role]
    lay, fams, _marks = A.FLAG_SPEC[bname]
    body = A.flag_body(bname)
    dirt = A.DIRT["body"]
    out = [list(r) for r in dirt]          # 바탕 = 다진 흙 몸통 같은 자리 화소
    kept = set()                           # 판석으로 남은 화소
    salt = sum(map(ord, role))
    for i, (letter, pix) in enumerate(sorted(_slabs(lay).items())):
        gone = [p for p in pix if hard_dirt(role, open_, *p)]
        near = min(depth(open_, x, y) for x, y in pix)
        fate = BREAK.get((role, letter))
        if not fate:
            if not gone: fate = "keep"
            elif len(gone) * 2 >= len(pix): fate = "drop"
            elif near >= 2 and (salt + i) % 3 == 0: fate = "keep"      # 셋에 하나는 깨지지 않고 통째로 흙 쪽에 튀어나온 판
            else: fate = "break"
        if fate == "drop": continue
        if fate == "keep":
            comp = set(pix)
        else:
            comp = _largest(_prune(set(pix) - set(gone)))
            if len(comp) < 8: continue          # 작은 부스러기는 남기지 않는다 — 가장자리가 이빨·가시처럼 보이지 않게
        edge_slab = fate != "keep" or near < EDGE_ZONE
        if edge_slab:
            for (x, y), ch in _shade_edge(comp, fams[letter]).items(): out[y][x] = ch
        else:
            for (x, y) in comp: out[y][x] = body[y][x]
        kept |= comp
    # 흙이 판 가장자리를 덮은 자리(반쯤 묻힌 판): 흙 쪽 테 화소 몇을 흙으로 — 손으로 고른 위상
    for (x, y) in sorted(kept):
        if depth(open_, x, y) >= SOFT: continue
        outer = [q for q in ((x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)) if q not in kept and lay[q[1] % T][q[0] % T] != "." and 0 <= q[0] < T and 0 <= q[1] < T]
        if outer and (x * 7 + y * 13 + salt) % 5 == 0:
            out[y][x] = dirt[y][x]; kept.discard((x, y))
    # 남긴 판석 사이 줄눈: 몸통 쪽(SOFT 안쪽)과 양쪽이 판석인 줄눈은 몸통 그대로
    for y in range(T):
        for x in range(T):
            if (x, y) in kept or lay[y][x] != ".": continue
            if depth(open_, x, y) >= SOFT or _joint_between(kept, x, y):
                out[y][x] = body[y][x]
    # 흙 위 조각
    frags = set()
    for gl, fx, fy, fam in FRAG.get(role, []):
        pix = {(fx + dx, fy + dy) for dy, r in enumerate(FRAG_GLYPH[gl]) for dx, c in enumerate(r) if c == "#"}
        assert all(0 <= x < T and 0 <= y < T for x, y in pix), (role, gl, fx, fy)
        for (x, y), ch in A.shade_unit(pix, CHIP_FAM[fam]).items(): out[y][x] = ch   # 조각은 굴러다니는 돌 — 6단(윗테 빛 · 아랫테 그늘)
        frags |= pix
    for wx, wy in WEEDS.get(role, []):
        for dy, r in enumerate(WEED):
            for dx, c in enumerate(r):
                X, Y = wx + dx, wy + dy
                if c == "." or (X, Y) in kept or (X, Y) in frags: continue
                out[Y][X] = "f" if c == "~" else c
    stone = kept | frags
    # 판석·조각 아래·오른쪽 = 짙은 흙 그늘(흙으로 가라앉은 판의 입술): 바로 아래·오른쪽 아래 e, 그 아래와 오른쪽 f. 몸통 쪽 줄눈은 그대로.
    sh = {}
    for (x, y) in stone:
        for (dx, dy, ch) in ((0, 1, "e"), (1, 1, "e"), (1, 0, "f"), (0, 2, "f")):
            q = (x + dx, y + dy)
            if q in stone or not (0 <= q[0] < T and 0 <= q[1] < T): continue
            if sh.get(q) != "e": sh[q] = ch
    for (x, y), ch in sh.items():
        if lay[y][x] == "." and (depth(open_, x, y) >= SOFT or out[y][x] in "Q@TaAE"): continue
        out[y][x] = ch
    return A.rows_of(out)


def _joint_between(kept, x, y):
    return ((x - 1, y) in kept and (x + 1, y) in kept) or ((x, y - 1) in kept and (x, y + 1) in kept) or \
           (sum(p in kept for p in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))) >= 3)


def _prune(pix):
    """가는 가시(이웃 둘 미만인 화소)를 깎는다 — 깨진 판이 송곳니·가시가 아니라 뭉툭한 덩이로 남게."""
    pix = set(pix)
    while True:
        thin = {(x, y) for x, y in pix if sum(q in pix for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))) < 2
                or (((x + 1, y) not in pix and (x - 1, y) not in pix) or ((x, y + 1) not in pix and (x, y - 1) not in pix))}
        if not thin: return pix
        pix -= thin


def _largest(pix):
    seen, best = set(), set()
    for p in pix:
        if p in seen: continue
        comp, st = set(), [p]
        while st:
            q = st.pop()
            if q in comp or q not in pix: continue
            comp.add(q)
            st += [(q[0] + 1, q[1]), (q[0] - 1, q[1]), (q[0], q[1] + 1), (q[0], q[1] - 1)]
        seen |= comp
        if len(comp) > len(best): best = comp
    return best


_CACHE = None


def rows():
    global _CACHE
    if _CACHE is None:
        _CACHE = {r: role_rows(r) for r in ORDER}
    return _CACHE


def tiles():
    """{역할: 16×16 RGBA} — ORDER 순서(body, body2..8, N S W E NW NE SW SE iso inNW inNE inSE inSW, N2 S2 W2 E2)."""
    return {r: img_of(rw) for r, rw in rows().items()}


CORNER_ALT = ["NW2", "NE2", "SW2", "SE2"]


def phase_role(role, x, y):
    """곧은 변 네 벌·볼록 모서리 두 벌 중 하나를 위치로 고른다. 굽는 쪽은 이 함수를 그대로 쓴다.
    곧은 변: 변을 따라 짝수 자리는 {첫·둘째 벌}, 홀수 자리는 {셋째·넷째 벌}에서 위치 해시로 고른다 — 이웃 두 칸은 결코 같지 않고 일정한 주기도 없다.
    볼록 모서리: 위치 해시로 두 벌 중 하나(계단꼴 대각선에서 같은 칸이 줄짓지 않게)."""
    if role in ("NW", "NE", "SW", "SE"):
        return role + "2" if A._h(x * 5 + 1, y * 3 + 7) % 2 else role
    if role not in ("N", "S", "W", "E"): return role
    along, other = (x, y) if role in "NS" else (y, x)
    k = (along % 2) * 2 + A._h(along * 3 + "NSWE".index(role), other * 7 + 11) % 2
    return role if k == 0 else f"{role}{k + 1}"


# ================================================================ 표본 판: 잔디 안 다진 흙 마당 안 들쭉날쭉한 판석 덩이
SAMPLE_DIRT = [   # 잔디 안 다진 흙 마당(22×15)
    "......................",
] + [".####################."] * 13 + [
    "......................",
]
SAMPLE_FLAG = [   # 흙 마당 안 판석 덩이: 긴 곧은 변(네 벌이 섞이는가), 볼록·오목 모서리, 2×2 흙 구멍, 남쪽 꼬리, 외딴 칸
    "......................",
    "......................",
    "...###########........",
    "...############.......",
    "...#############...#..",
    "...####..########.....",
    "...####..########.....",
    "...##############.....",
    "....#############.....",
    "....###########.......",
    "......#####...........",
    "......##..............",
    "......................",
    "......................",
    "......................",
]


def sample(flag_grid=None, dirt_grid=None):
    flag_grid = flag_grid or SAMPLE_FLAG; dirt_grid = dirt_grid or SAMPLE_DIRT
    fl = {(x, y) for y, r in enumerate(flag_grid) for x, c in enumerate(r) if c == "#"}
    dr = {(x, y) for y, r in enumerate(dirt_grid) for x, c in enumerate(r) if c == "#"} | fl
    H, W = len(dirt_grid), len(dirt_grid[0])
    D = A.surfaces()["dirt"]
    F = rows()
    grass = img_of(A.GRASS)
    im = Image.new("RGBA", (W * T, H * T))
    for y in range(H):
        for x in range(W):
            if (x, y) in fl:
                r = phase_role(A.role_for(fl, x, y), x, y)
                if r == "body": r = (["body"] + VARIANTS)[A._h(x, y) % (1 + len(VARIANTS))]
                im.paste(img_of(F[r]), (x * T, y * T))
            elif (x, y) in dr:
                r = A.role_for(dr, x, y)
                if r == "body": r = (["body"] + VARIANTS)[A._h(x + 7, y + 3) % (1 + len(VARIANTS))]
                im.paste(img_of(D[r]), (x * T, y * T))
            else:
                im.paste(grass, (x * T, y * T))
    return im


GATE_KIND = "terrain"
GATE_NAME = ("ruined flagstone court sinking into a packed-earth yard, ground autotile seen top-down 3/4 (flat ground): pale irregular limestone "
             "slabs with mossy joints in the middle; toward the edges the paving breaks up raggedly — slabs cracked, chipped and missing, loose "
             "slab fragments and chips lying on the tamped reddish-brown earth, a faint shadow under the slab lips; no kerb; the packed-earth yard "
             "is bordered by grass")


def gate_image():
    return sample()


def gate_export(d):
    d = pathlib.Path(d); d.mkdir(parents=True, exist_ok=True)
    p = d / "yard_flag_dirt.png"
    gate_image().save(p)
    line = dict(png=str(p.resolve()), kind=GATE_KIND, name=GATE_NAME, label="beodeul_yard/flag_dirt", chipset="beodeul_city")
    (d / "items.jsonl").write_text(json.dumps(line, ensure_ascii=False) + "\n")
    return [line]


def check():
    bad = []
    used = {ch for rw in rows().values() for r in rw for ch in r}
    if used - set(PAL): bad.append(("unknown letters", sorted(used - set(PAL))))
    ok, miss = A.palette_check()
    if not ok: bad.append(("palette", miss))
    joint = set("JjkQT@aAE")
    dirtset = set("hm0ifle")
    R = rows()
    for r in EDGE_ROLES:
        rw = R[r]
        open_ = OPEN[r]
        # 바깥 띠는 흙(또는 흙 위 조각·그늘) — 흙 몸통 칸과 맞닿는 변에 판석이 닿지 않는다
        for side in [c for c in "NSWE" if c in open_ and not open_.startswith("c")]:
            for i in range(T):
                x, y = {"N": (i, 0), "S": (i, T - 1), "W": (0, i), "E": (T - 1, i)}[side]
                if rw[y][x] not in dirtset and rw[y][x] not in "x":
                    pass
        # 안쪽 판석 몸통 쪽 변: 줄눈 길 자리는 줄눈 그대로
        for (x, y) in A.BORDER_JOINTS:
            if depth(open_, x, y) >= SOFT and rw[y][x] not in joint: bad.append((r, "border joint", x, y, rw[y][x]))
    return bad


def preview(out):
    R = tiles()
    pad = 2
    cols = len(ORDER)
    blob = sample()
    W = max(cols * (T + pad), blob.width)
    im = Image.new("RGBA", (W, T + pad + 8 + blob.height), (40, 40, 44, 255))
    for j, r in enumerate(ORDER): im.paste(R[r], (j * (T + pad), 0))
    im.paste(blob, (0, T + pad + 8))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        b = check(); print("check:", b or "OK"); sys.exit(1 if b else 0)
    elif cmd == "preview":
        preview(sys.argv[2]); print("->", sys.argv[2])
    elif cmd == "gate":
        for l in gate_export(sys.argv[2]): print(l["png"])
    else:
        sys.exit(f"unknown command {cmd}")
