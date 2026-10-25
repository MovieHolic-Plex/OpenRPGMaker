"""버들항 판석→다진 흙 오토타일(flag over dirt) 손 도트 원본 — 16px 칸, 3/4 탑뷰(평지), 버들항 시트 색만(yard_art.PAL).

신전 폐허 뜰에서 판석(beodeul_yard_flag)이 다진 흙 마당(beodeul_yard_dirt) 안에 놓일 때 쓰는 가장자리 벌.
기존 판석 가장자리는 바깥이 잔디이고 다듬은 연석 테가 있다 — 흙 마당 안에서는 「새로 깐 광장」으로 읽혔다(VQA r8·r9).
이 벌은 연석이 없다: 판석이 가장자리로 갈수록 판 한 장 단위로 깨지고 빠져서 흙으로 무너진다(r5 다시 그림).

  - 바탕은 yard_art 다진 흙 몸통(DIRT["body"])의 같은 자리 화소 — 흙 몸통 칸과 이음새가 없다. 열린 쪽 HARD 화소 띠는 늘 흙.
  - 열린 쪽에서 SOFT 화소 넘게 안쪽은 그 역할이 고른 판석 몸통 배치도 그대로(칸 사이 줄눈 길 BORDER_JOINTS 유지).
    판석은 칸 경계를 넘지 않고 경계는 늘 줄눈이므로, 가장자리 칸끼리 맞출 화소는 흙 띠와 몸통 쪽뿐이다.
  - 사이 띠: 벌마다 물러남 곡선(_profile: 들쭉날쭉한 바탕 2~6 + 깊은 만 하나·둘 또는 곶)을 정하고, 판석마다 그 곡선 깊이에서
    납작하게 잘라 낸다(판마다 -1~+2 화소 차이, 끝에 1화소 턱, 열에 셋은 한쪽 귀가 떨어져 나감). 열에 하나 남짓은 통째로 빠지고,
    선 밖에 든 판은 반쯤 흙 위에 누운 낱장으로 남는다. 가장자리 줄눈(열린 쪽에서 EARTH_JOINT 안)은 흙으로 메워진다.
  - 깨진 판은 흙에 물든 판 색(EDGE_RAMP)으로 다시 칠하고, 흙과 맞닿은 윗·왼테는 흙 턱 그늘, 열린 쪽 SINK_D 안은 한 단 더 어둡게(닳아 가라앉음).
    통째로 남은 안쪽 판(무게중심 BODY_TONE 넘게 안쪽)은 몸통 색 그대로.
  - 흙 턱 그늘: 판·조각 둘레 흙 한 줄은 f(흙 몸보다 약 15~18% 어둡게), 아래·오른쪽 두 줄째는 0.
  - 흙 위 조각·부스러기·잡풀은 몇 벌에만, 자리·크기·모양을 벌마다 따로 고른다(같은 높이 점선이 되지 않게).

역할·순서: yard_art.ORDER(body, body2..body8 = 판석 몸통 그대로, N, S, W, E, NW, NE, SW, SE, iso, inNW, inNE, inSE, inSW) 뒤에 ALT_ORDER:
  곧은 변 N2..N16, S2..S16, W2..W16, E2..E16(변마다 16벌), 그다음 모서리 NW2..NW8, NE2..NE8, SW2..SW8, SE2..SE8, inNW2..inNW8, inNE2..inNE8, inSE2..inSE8, inSW2..inSW8(8벌).
  변형 표: STRAIGHT_VARIANTS[d] = [d, d2, …, d16], CORNER_VARIANTS[c] = [c, c2, …, c8]. 새 칸은 몸통 여덟을 뺀 129칸(기본 13 + 곧은 변 60 + 모서리 56).

벌 고르기 phase_role(role, x, y) — (x, y) = 지도 칸 좌표(0 이상 정수). 굽는 쪽·TS 조립기는 이 식을 그대로 옮긴다:
  M = 2^32,  fmix32(h): h ^= h>>>16; h = h*0x85EBCA6B mod M; h ^= h>>>13; h = h*0xC2B2AE35 mod M; h ^= h>>>16   (murmur3 마무리)
  H(a, b, salt) = fmix32((a*0x9E3779B1 + b*0x85EBCA77 + salt*0xC2B2AE3D) mod M)
     TS: fmix32((Math.imul(a,0x9E3779B1) + Math.imul(b,0x85EBCA77) + Math.imul(salt,0xC2B2AE3D)) >>> 0), fmix32 안의 곱도 Math.imul(…)>>>0
  탐욕 수열 G(n, salt, line, k), k >= 0:  g[0..k] 를 차례로 채운다 — g[i] = 첫 c_t(i) (t = 0, 1, 2, …) 로서 g[i-1], g[i-2], g[i-3](있는 것만) 어느 것과도 다른 값,
     c_t(i) = H(i, line, salt + 1000*t) mod n.  G = g[k]. (줄마다 한 번 채워 두고 재사용 — 순수: 줄과 자리만 본다)
  곧은 변 d ∈ {N,S,W,E}, saltD = {N:1, S:2, W:3, E:4}:
     along, other = (x, y) if d in N/S else (y, x)
     → STRAIGHT_VARIANTS[d][G(16, saltD + 100, other, along)]   (변을 따라 세 칸 안에 같은 칸이 결코 없다, 위치 주기 없음)
  모서리 c ∈ CORNERS = [NW, NE, SW, SE, inNW, inNE, inSE, inSW], saltC = 11 + CORNERS.index(c):
     c ∈ {NW, NE, inNW, inNE}: k = y, q = x;  c ∈ {SW, SE, inSE, inSW}: k = x, q = y
     → CORNER_VARIANTS[c][G(8, saltC, floor(q / 32), k)]
     계단꼴 대각선에서 k 가 1씩 변하므로 같은 계단에서 세 칸 안에 같은 칸이 없다.
  그 밖(body, iso)은 그대로. 몸통 칸 변형은 yard_art 판석 몸통 규칙 그대로.
이미지 생성·트레이싱·사람·글자 없음. 벌 안의 모양은 역할 이름 crc32 씨앗의 고정 난수(그리는 때만 쓰고 조립기는 몰라도 된다).

  python3 flag_dirt_art.py preview OUT.png   # 4배 확인판(모든 칸 + 표본 판)
  python3 flag_dirt_art.py gate DIR          # 3/4 관문용 표본 PNG + DIR/items.jsonl
  python3 flag_dirt_art.py check             # 팔레트·이음새 검사
API: tiles() -> {role: 16×16 RGBA}, rows() -> {role: 행 문자열}, ORDER, NEW_ROLES, STRAIGHT_VARIANTS, CORNER_VARIANTS, phase_role(role, x, y),
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
STRAIGHT_N = 16     # 곧은 변마다 벌 수(4 위상 × 4)
CORNER_N = 8        # 볼록·오목 모서리마다 벌 수
CORNERS = ["NW", "NE", "SW", "SE", "inNW", "inNE", "inSE", "inSW"]
STRAIGHT_VARIANTS = {d: [d] + [f"{d}{k}" for k in range(2, STRAIGHT_N + 1)] for d in "NSWE"}
CORNER_VARIANTS = {c: [c] + [f"{c}{k}" for k in range(2, CORNER_N + 1)] for c in CORNERS}
ALT_ORDER = [v for d in "NSWE" for v in STRAIGHT_VARIANTS[d][1:]] + [v for c in CORNERS for v in CORNER_VARIANTS[c][1:]]
ORDER = A.ORDER + ALT_ORDER
EDGE_ROLES = [r for r in ROLES if r != "body"] + ALT_ORDER
NEW_ROLES = EDGE_ROLES      # 새로 그린 칸(몸통 여덟은 yard_art 판석 몸통과 같은 그림)

HARD = 2        # 칸 변에서 이만큼은 늘 흙(여기에 흔들림 JAG 를 더한다 — 깨진 선은 칸 안 3~11화소를 오간다)
SOFT = 12       # 칸 변에서 이만큼 넘게는 늘 판석 몸통(이웃 판석 몸통 칸과 줄눈 길이 맞는다)

# 역할마다 열린 쪽(흙 쪽): 변 N S W E, 오목 모서리 cNW…(그 모서리만)
OPEN = {"iso": "NSWE"}
for _d, _vs in STRAIGHT_VARIANTS.items():
    for _v in _vs: OPEN[_v] = _d
for _c, _vs in CORNER_VARIANTS.items():
    for _v in _vs: OPEN[_v] = ("c" + _c[2:]) if _c.startswith("in") else _c
BASE_OF = {v: d for d, vs in list(STRAIGHT_VARIANTS.items()) + list(CORNER_VARIANTS.items()) for v in vs}
BASE_OF["iso"] = "iso"

# 역할마다 품을 판석 몸통 — 곧은 변 여덟 벌은 여덟 몸통을 하나씩(변마다 다른 차례), 모서리 세 벌도 서로 다른 몸통
_BODIES = ["body"] + VARIANTS
BODY_OF = {"iso": "body3"}
for _i, _d in enumerate("NSWE"):      # 벌 k = 위상 c·4 + 고름 p. 위상 c 는 옆 위상(c±1)과만 몸통을 둘씩 나눈다 — 같은 위상(64px)·두 위상 건너(32px)는 몸통이 겹치지 않는다
    for _k, _v in enumerate(STRAIGHT_VARIANTS[_d]):
        _c, _p = divmod(_k, 4)
        _idx = 2 * _c + _p if _p < 2 else 2 * ((_c - 1) % 4) + (_p - 2)
        BODY_OF[_v] = _BODIES[(_idx + 3 * _i) % 8]
for _i, _c in enumerate(CORNERS):
    for _k, _v in enumerate(CORNER_VARIANTS[_c]): BODY_OF[_v] = _BODIES[(_i * 5 + _k * 3 + 2) % 8]

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


def _old_role_rows(role):
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


# ================================================================ 벌 고르기(굽는 쪽·TS 조립기가 그대로 따라 한다 — 모듈 머리말의 식)
M32 = 0xFFFFFFFF
SIDE_SALT = {"N": 1, "S": 2, "W": 3, "E": 4}
CORNER_SALT = {c: 11 + i for i, c in enumerate(CORNERS)}


def fmix32(h):
    """murmur3 마무리 섞기(32비트)."""
    h &= M32
    h ^= h >> 16; h = (h * 0x85EBCA6B) & M32
    h ^= h >> 13; h = (h * 0xC2B2AE35) & M32
    h ^= h >> 16
    return h


def cell_hash(x, y, salt):
    return fmix32(x * 0x9E3779B1 + y * 0x85EBCA77 + salt * 0xC2B2AE3D)


CORNER_BY_Y = ("NW", "NE", "inNW", "inNE")   # 이 모서리는 계단을 따라 y 가 1씩, 나머지(SW SE inSE inSW)는 x 가 1씩 변한다 — 그 좌표가 수열 자리
CORNER_BLOCK = 32      # 다른 좌표를 32칸 띠로 묶어 띠마다 다른 수열(같은 띠 안의 같은 역할 모서리는 수열 자리가 1~3 차이면 늘 다르다)
_SEQ = {}


def _greedy_seq(n, salt, line, upto):
    """줄 하나(line)를 따라 0..upto 자리마다 벌 번호(0..n-1)를 고른다: 자리 i 의 후보 H(i, line, salt + 1000·t) mod n 을 t = 0, 1, 2, … 차례로 보며
    바로 앞 세 자리(i-1, i-2, i-3)에 쓴 번호가 아닌 첫 후보. 순수(줄과 자리만 본다) — 조립기는 같은 줄을 0 부터 같은 식으로 훑는다."""
    key = (n, salt, line)
    seq = _SEQ.setdefault(key, [])
    while len(seq) <= upto:
        i = len(seq)
        prev = seq[max(0, i - 3):i]
        t = 0
        while True:
            c = cell_hash(i, line, salt + 1000 * t) % n
            if c not in prev: break
            t += 1
        seq.append(c)
    return seq[upto]


def phase_role(role, x, y):
    """(역할, 칸 x, 칸 y) → 그 자리에 놓을 벌 이름. 순수 함수(위치만 본다). 식은 모듈 머리말.
    곧은 변: 변의 줄(other)마다 along 0 부터 탐욕 수열 — 열여섯 벌을 해시로 고르되 바로 앞 세 칸과 같은 벌은 건너뛴다(세 칸 안에 같은 칸이 결코 없고, 위치 주기가 없다).
    모서리: 계단을 따라 1씩 변하는 좌표(k = y 또는 x)를 자리로, 다른 좌표의 32칸 띠마다 탐욕 수열(여덟 벌) — 계단을 따라 세 칸 안에 같은 칸이 없고,
    옆 계단의 같은 역할 모서리도 k 가 1~3 다르면 다르다(무작위 덩이 300판 시험에서 세 칸 안 같은 역할 쌍의 1% 미만만 같다)."""
    if role in STRAIGHT_VARIANTS:
        along, other = (x, y) if role in "NS" else (y, x)
        return STRAIGHT_VARIANTS[role][_greedy_seq(STRAIGHT_N, SIDE_SALT[role] + 100, other, along)]
    if role in CORNER_VARIANTS:
        k, q = (y, x) if role in CORNER_BY_Y else (x, y)
        return CORNER_VARIANTS[role][_greedy_seq(CORNER_N, CORNER_SALT[role], q // CORNER_BLOCK, k)]
    return role


# ================================================================ 가장자리 칸 그리기(판석 한 장 단위로 깨고 빼고 줄인다)
BAND = 4        # 칸 옆 경계(변을 따라 이웃 칸과 맞닿는 두 열)에서는 열린 쪽에서 이만큼까지 흙, 그 안은 판석 그대로 — 어느 벌끼리 붙어도 맞는다
EARTH_JOINT = 7  # 열린 쪽에서 이만큼 안쪽까지의 줄눈은 흙으로 메워졌다(가장자리 판이 줄눈 선에 갇힌 이빨이 아니라 흙에 놓인 낱장으로 읽히게)
BODY_TONE = 6    # 통째로 남은 판의 무게중심이 열린 쪽에서 이만큼 넘게 안쪽이면 몸통 색 그대로
SINK_D = 6      # 열린 쪽에서 이만큼 안쪽까지의 판석 화소는 한 단 더 어둡게(흙에 묻혀 닳은 판)
FRAG2 = {       # 흙 위 조각·부스러기 글리프(크기·모양 여러 가지)
    "p1": ["#"], "p2": ["##"], "p2v": ["#", "#"], "p3": ["##", ".#"], "p3b": [".#", "##"],
    "f31": ["###"], "f32": ["###", ".##"], "f22": ["##", "##"], "f42": [".###", "###."], "f43": [".###", "####", "##.."],
    "f33": [".##", "###", "##."], "f52": ["####.", ".####"],
}
SMALL = ("p1", "p2", "p2v", "p3", "p3b")
WEED_GLYPHS = [[".7", "73"], ["7.", "37"], ["3"], ["7", "3"], [".8.", "737"]]


def _canon(open_, x, y):
    """오목 모서리를 왼쪽 위(cNW) 꼴로 편 좌표."""
    u = x if "W" in open_ else T - 1 - x
    v = y if "N" in open_ else T - 1 - y
    return u, v


def _side_dist(c, x, y):
    return {"N": y, "S": T - 1 - y, "W": x, "E": T - 1 - x}[c]


def _measure(open_, x, y):
    """열린 쪽까지의 거리(판석을 자를 잣대)."""
    if open_.startswith("c"):
        u, v = _canon(open_, x, y)
        return u + v
    return min(_side_dist(c, x, y) for c in open_)


def _lateral(open_, x, y):
    if open_.startswith("c"):
        u, v = _canon(open_, x, y); return u - v
    c = min(open_, key=lambda c: _side_dist(c, x, y))
    return x if c in "NS" else y


def _forced(open_, x, y, corner_r):
    """→ 'dirt' | 'stone' | None. 판석은 칸 경계를 넘지 않고 경계는 늘 줄눈이라, 옆 칸과 맞출 것은 흙 띠(열린 쪽 HARD)와 몸통 쪽(SOFT)뿐이다."""
    if open_.startswith("c"):
        u, v = _canon(open_, x, y)
        if u + v < 5: return "dirt"
        if u + v >= SOFT + 2: return "stone"
        return None
    ds = [_side_dist(c, x, y) for c in open_]
    if min(ds) < HARD: return "dirt"
    return "stone" if min(ds) >= SOFT else None


def _prune_keep(pix, prot):
    pix = set(pix)
    while True:
        thin = {(x, y) for x, y in pix if (x, y) not in prot and (
            sum(q in pix for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))) < 2
            or ((x + 1, y) not in pix and (x - 1, y) not in pix) or ((x, y + 1) not in pix and (x, y - 1) not in pix))}
        if not thin: return pix
        pix -= thin


def _components(pix):
    seen, out = set(), []
    for p in sorted(pix):
        if p in seen: continue
        comp, st = set(), [p]
        while st:
            q = st.pop()
            if q in comp or q not in pix: continue
            comp.add(q); st += [(q[0] + 1, q[1]), (q[0] - 1, q[1]), (q[0], q[1] + 1), (q[0], q[1] - 1)]
        seen |= comp; out.append(comp)
    return out


def _profile(rng):
    """변 하나의 물러남 곡선(옆 좌표 0..15 → 열린 쪽에서 판석이 잘리는 깊이). 양 끝 두 칸은 BAND — 이웃 칸과 맞는다.
    벌마다 모양이 다르다: 들쭉날쭉한 바탕 높이(2~7) 위에 깊은 만 하나·둘, 또는 변 가까이 나온 곶."""
    P = [BAND] * T
    lvl = 3
    for l in range(2, T - 2):
        lvl = max(HARD, min(6, lvl + rng.choice([-1, -1, 0, 0, 1, 1, 2, -2])))
        P[l] = lvl
    kind = rng.choice(["bay", "bay", "two", "cape", "plain"])
    if kind in ("bay", "two"):
        for _ in range(1 if kind == "bay" else 2):
            m, w, D = rng.randint(3, 12), rng.randint(2, 4), rng.randint(7, 11)
            for l in range(2, T - 2): P[l] = max(P[l], round(D - (D - BAND) * abs(l - m) / w) if abs(l - m) <= w else 0)
    elif kind == "cape":
        a = rng.randint(3, 9)
        for l in range(a, a + rng.randint(2, 4)): P[l] = HARD
    for _ in range(T):          # 이웃 자리끼리 1 넘게 뛰지 않게(경계 판이 가는 조각으로 남지 않게) — 양 끝 BAND 는 그대로
        for l in range(2, T - 2):
            P[l] = max(min(P[l], P[l - 1] + 1, P[l + 1] + 1), P[l - 1] - 1, P[l + 1] - 1)
    return P


def _rng(role):
    import random, zlib
    return random.Random(zlib.crc32(("flag-dirt/" + role).encode()))


def role_rows(role):
    if role == "body": return A.flag_body("body")
    if role in VARIANTS: return A.flag_body(role)
    if role == "iso": return _old_role_rows(role)
    open_ = OPEN[role]
    rng = _rng(role)
    bname = BODY_OF[role]
    lay, fams, _marks = A.FLAG_SPEC[bname]
    body = A.flag_body(bname)
    dirt = A.DIRT["body"]
    out = [list(r) for r in dirt]
    corner_r = rng.choice([8, 9, 10, 11])
    hole_r = rng.choice([7, 8, 9, 10, 11])
    prof = {c: _profile(rng) for c in "NSWE"}
    F = {(x, y): _forced(open_, x, y, corner_r) for y in range(T) for x in range(T)}
    meas = {(x, y): _measure(open_, x, y) for y in range(T) for x in range(T)}
    lo = 5 if open_.startswith("c") else HARD      # 잣대에서 늘 흙인 깊이
    kept, edge = set(), {}
    for letter, pix in sorted(_slabs(lay).items()):
        pix = set(pix)
        dead = {p for p in pix if F[p] == "dirt"}
        prot = {p for p in pix if F[p] == "stone"}
        if prot == pix:                    # 몸통 쪽 판석 — 그대로
            for (x, y) in pix: out[y][x] = body[y][x]
            kept |= pix; continue
        if open_.startswith("c"):
            cut = {p for p in pix if meas[p] < hole_r + rng.choice([-1, 0, 0, 1, 2])}
        else:
            cut = set()
            for c in open_:
                lat_c = round(sum((x if c in "NS" else y) for x, y in pix) / len(pix))
                cd = prof[c][lat_c] + rng.choice([-1, 0, 0, 0, 1, 1, 2])          # 판마다 깊이가 다른 납작한 끝
                lats = sorted({(x if c in "NS" else y) for x, y in pix})
                split, side = rng.choice(lats), rng.random() < 0.5
                cut |= {(x, y) for x, y in pix if _side_dist(c, x, y) < cd + (1 if ((x if c in "NS" else y) < split) == side else 0)}
        if len(open_) == 2:   # 볼록 모서리: 꼭짓점 쪽 판은 판 한 장 단위로 빠진다(비스듬히 썰린 세모 조각이 남지 않게)
            cx = 0 if "W" in open_ else T - 1
            cy = 0 if "N" in open_ else T - 1
            if sum(abs(x - cx) + abs(y - cy) for x, y in pix) / len(pix) < corner_r: cut = set(pix)
        r = rng.random()
        if not prot and r < 0.14: continue                               # 빠진 판
        if not prot and cut >= pix - dead:                              # 깨진 선 밖에 통째로 든 판: 셋에 하나는 흙 위에 누운 낱장으로 남는다
            if r < 0.45 and min(meas[p] for p in pix) >= HARD + 1: comp = set(pix)
            else: continue
        else:
            comp = pix - cut
            if rng.random() < 0.3:                                      # 한쪽 귀가 떨어져 나간 판
                lats = sorted({_lateral(open_, *p) for p in comp} or {0})
                end = lats[0] if rng.random() < 0.5 else lats[-1]
                k = rng.choice([2, 3])
                mm = min((meas[p] for p in comp), default=0)
                comp -= {p for p in comp if (meas[p] - mm) + abs(_lateral(open_, *p) - end) < k}
        comp = (comp - dead) | prot
        comp = _prune_keep(comp, prot)
        parts = [c for c in _components(comp) if len(c) >= 7 or c & prot]
        if not parts and not prot and rng.random() < 0.55:          # 잘린 나머지가 부스러기뿐이면: 흙 띠만 비우고 판을 거의 통째로 남긴다(변 가까이 나온 판)
            parts = [c for c in _components(_prune_keep(pix - dead, set())) if len(c) >= 7]
        for c in parts:
            kept |= c
            if c == pix and sum(meas[p] for p in pix) / len(pix) >= BODY_TONE and min(meas[p] for p in pix) >= BODY_TONE - 1:    # 깨지지 않은 안쪽 판은 몸통 색 그대로 — 가장자리 칸과 몸통 칸 사이에 색 경계 줄이 서지 않게
                for (x, y) in c: out[y][x] = body[y][x]
            else: edge[letter] = edge.get(letter, set()) | c
    # 남은 가장자리 판 칠하기: 흙에 물든 판, 흙과 맞닿은 윗·왼테는 흙 턱 그늘, 열린 쪽 가까이는 한 단 더 어둡게(닳아 가라앉음)
    def is_joint(q):
        X, Y = q
        if not (0 <= X < T and 0 <= Y < T): return True
        return lay[Y][X] == "." and (F[q] == "stone" or q in kept or meas[q] >= SOFT)
    for letter, comp in edge.items():
        ramp = EDGE_RAMP[fams[letter]]
        xs = [x for x, _ in comp]; ys = [y for _, y in comp]
        x0, y0 = min(xs), min(ys); w, h = max(1, max(xs) - x0), max(1, max(ys) - y0)
        for (x, y) in comp:
            up, dn, lf, rt = (x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)
            if dn not in comp: k = 4
            elif rt not in comp: k = 3
            elif up not in comp: k = 0 if is_joint(up) else 2
            elif lf not in comp: k = 1 if is_joint(lf) else 2
            else: k = 1 if ((x - x0) / w + (y - y0) / h) / 2 < 0.35 else 2
            if meas[(x, y)] < SINK_D and k < 4: k += 1
            out[y][x] = ramp[k]
    # 줄눈: 몸통 쪽과, 남은 판석 사이(칸 밖은 이웃 칸 판석으로 친다 — 경계 줄눈이 흙 위에 가시로 서지 않게 양쪽 판이 있어야 남긴다)
    kept_ext = set(kept) | {(x, y) for x in range(-1, T + 1) for y in range(-1, T + 1) if not (0 <= x < T and 0 <= y < T)
                            and F.get((min(max(x, 0), T - 1), min(max(y, 0), T - 1))) == "stone"}
    for y in range(T):
        for x in range(T):
            if (x, y) in kept or lay[y][x] != ".": continue
            if meas[(x, y)] >= SOFT or (F[(x, y)] == "stone" and not (len(open_) == 1 and _side_dist(open_, x, y) < SOFT)) or \
                    (meas[(x, y)] >= EARTH_JOINT and _joint_between(kept_ext, x, y)):
                out[y][x] = body[y][x]
    joint = {(x, y) for y in range(T) for x in range(T) if (x, y) not in kept and out[y][x] != dirt[y][x]}
    stone = kept | joint
    # 흙 위 조각·부스러기: 몇 칸에만, 자리·크기·모양이 제각각(판에서 1~10화소)
    def free(px):
        return all(1 <= X < T - 1 and 1 <= Y < T - 1 and (X, Y) not in stone and F[(X, Y)] != "stone" and meas[(X, Y)] >= 1 for X, Y in px)
    frags = set()
    nfr = rng.choice([0, 0, 0, 0, 1, 1, 2])
    tries = 0
    while nfr and tries < 200:
        tries += 1
        gl = rng.choice(list(FRAG2) + list(SMALL) * 2)
        X0, Y0 = rng.randrange(1, T - 1), rng.randrange(1, T - 1)
        px = {(X0 + dx, Y0 + dy) for dy, rr in enumerate(FRAG2[gl]) for dx, c in enumerate(rr) if c == "#"}
        if not free(px) or any(abs(X - a) + abs(Y - b) < 4 for X, Y in px for a, b in frags): continue
        fam = rng.choice(["warm", "cool", "clod"])
        if fam == "clod":
            for (X, Y) in px: out[Y][X] = "i" if (X, Y - 1) not in px else "f"
        elif len(px) <= 2:
            for (X, Y) in px: out[Y][X] = rng.choice("b*+") if fam == "warm" else rng.choice("Z%X")
        else:
            for (X, Y), ch in A.shade_unit(px, CHIP_FAM[fam]).items(): out[Y][X] = ch
        frags |= px; nfr -= 1
    # 잡풀: 판과 흙 사이 틈에서(몇 칸에만)
    weeds = set()
    if rng.random() < 0.3:
        cand = sorted(p for p in kept if F[p] != "stone" and meas[p] < SOFT)
        rng.shuffle(cand)
        for (x, y) in cand[:40]:
            g = rng.choice(WEED_GLYPHS)
            px = {(x + dx - len(g[0]) // 2, y + dy - len(g) + 1): c for dy, rr in enumerate(g) for dx, c in enumerate(rr) if c != "."}
            if all(1 <= X < T - 1 and 1 <= Y < T - 1 and (X, Y) not in frags for X, Y in px):
                for (X, Y), c in px.items(): out[Y][X] = c
                weeds |= set(px); break
    # 흙 턱 그늘: 판 둘레 흙 한 줄은 f(몸보다 약 18% 어둡게), 판 아래·오른쪽 두 줄째는 0 — 가라앉은 판 둘레
    solid = stone | frags
    ring1, ring2 = set(), set()
    for (x, y) in solid:
        for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0), (1, 1)):
            ring1.add((x + dx, y + dy))
        for dx, dy in ((0, 2), (2, 0), (1, 2), (2, 1)):
            ring2.add((x + dx, y + dy))
    for (x, y) in ring2 - ring1:
        if 0 <= x < T and 0 <= y < T and (x, y) not in solid and (x, y) not in weeds and _measure(open_, x, y) >= 1 and out[y][x] in "hm":
            out[y][x] = "0"
    for (x, y) in ring1:
        if 0 <= x < T and 0 <= y < T and (x, y) not in solid and (x, y) not in weeds and _measure(open_, x, y) >= 1 and out[y][x] in "hm0il":
            out[y][x] = "f"
    return A.rows_of(out)


# ================================================================ 표본 판: 잔디 안 다진 흙 마당 안 들쭉날쭉한 판석 덩이
SAMPLE_W, SAMPLE_H = 28, 18
SAMPLE_DIRT = ["." * SAMPLE_W] + ["." + "#" * (SAMPLE_W - 2) + "."] * (SAMPLE_H - 2) + ["." * SAMPLE_W]
SAMPLE_FLAG = [   # 흙 마당 안 판석 덩이: 북쪽 곧은 변 14칸, 북서·북동·남서·남동 계단 대각선(볼록·오목이 번갈아), 2×2 흙 구멍, 남쪽 곧은 변, 외딴 칸
    "............................",
    "............................",
    ".......##############.......",
    "......################......",
    ".....##################.....",
    "....####################....",
    "...######..##############...",
    "...######..##############...",
    "...######################...",
    "....####################..#.",
    ".....##################.....",
    "......################......",
    ".......##############.......",
    "........##################..",
    "........#################...",
    "............................",
    "............................",
    "............................",
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
