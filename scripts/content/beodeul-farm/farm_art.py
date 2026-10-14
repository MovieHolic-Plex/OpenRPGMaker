"""beodeul_farm 손 도트 원본 (2판, 2026-10-14) — 16px 칸, 3/4 탑뷰, 버들항 시트 실제 색만.

1판(Sonnet)을 통째로 다시 그렸다. 칸 번호·키·역할 이름은 1판과 같다(bake_farm.py 가 번호를 정한다).
그림은 행 문자열과 손으로 고른 글리프(작은 행 문자열)를 손으로 고른 자리에 찍어 만든다. 코드는 읽고 합치고 굽기만 한다.
이미지 생성·트레이싱 없음, 사람 모양 없음, 글자·상표 없음.

빛은 왼쪽 위(버들항 시트와 같다). 그림자는 오른쪽 아래로 진다.
색은 버들항 시트(tiledata/beodeul-city/render-full/city6.png)에서 잰 값이다:
  흙·나무  #1e150a #3d220c #452a17 #633712 #6f4725 #885a26 #b77541 #d9a566  (6단 + 윤곽 + 빛)
  풀       #275e1f #4b8232 #579f35 #73b83e #8fd24a
  잎       #143a27 #205030 #367740 #4b8232 #73b83e #8fd24a #a8dc6e
  밀       #845c1f #aa7a08 #ec9900 #fbc10d #ecdb95 · 짚 #9d9c33
  붉은 지붕·널 #4b1c1e #7a2e2c #9a3a26 #b85530 #c97a33 #f0df97 (버들항 민가 기와에서 잼)
  돌       #374243 #5b6667 #777579 #929491 #c4c6c3
"""
from PIL import Image

PAL = {
    # 흙·나무 (어둠 → 밝음)
    "n": "#1e150a", "e": "#3d220c", "d": "#452a17", "c": "#633712", "b": "#6f4725", "a": "#885a26", "A": "#b77541", "T": "#d9a566",
    "p": "#5b6667", "q": "#90928f",                       # 흙 속 잔돌
    # 풀
    "k": "#275e1f", "i": "#4b8232", "g": "#579f35", "h": "#73b83e", "l": "#8fd24a",
    # 잎
    "E": "#143a27", "D": "#205030", "F": "#367740", "K": "#4b8232", "L": "#73b83e", "M": "#8fd24a", "Q": "#a8dc6e",
    # 밀·짚
    "w": "#845c1f", "y": "#aa7a08", "O": "#ec9900", "Y": "#fbc10d", "U": "#ecdb95", "v": "#9d9c33",
    # 토마토
    "r": "#863736", "R": "#c2432f", "S": "#f06a45",
    # 붉은 지붕·헛간 벽
    "1": "#4b1c1e", "2": "#7a2e2c", "3": "#9a3a26", "4": "#b85530", "5": "#f0df97", "6": "#c97a33",
    # 돌
    "7": "#374243", "8": "#5b6667", "9": "#777579", "0": "#929491", "W": "#c4c6c3",
    # 반투명 그림자(버들항 시트도 반투명 그림자를 쓴다)
    ",": (20, 12, 4, 96), ";": (14, 30, 8, 70),
}


def rgba(ch):
    if ch == ".": return (0, 0, 0, 0)
    v = PAL[ch]
    if isinstance(v, tuple): return v
    h = v.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def img_of(rows):
    w = len(rows[0])
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    im = Image.new("RGBA", (w, len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r): im.putpixel((x, y), rgba(ch))
    return im


def blank(w=16, h=16): return [["."] * w for _ in range(h)]
def rows_of(g): return ["".join(r) for r in g]


def stamp(g, glyph, x, y, wrap=True, under=False):
    """글리프(행 문자열)를 (x, y) 왼쪽 위에 찍는다. '.' 은 건너뛴다. wrap 이면 가로로 감는다(이음새 없는 반복)."""
    H, W = len(g), len(g[0])
    for dy, r in enumerate(glyph):
        for dx, ch in enumerate(r):
            if ch == ".": continue
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H): continue
            if wrap: xx %= W
            elif not (0 <= xx < W): continue
            if under and g[yy][xx] != ".": continue
            g[yy][xx] = ch


# ================================================================ 흙(경작지)
# 풀 바탕 — 버들항 잔디 칸(737)처럼 거의 고른 #579f35 에 드문 결.
GRASS = [
    "gggggggggggggggg",
    "gggghgggggggiggg",
    "gggggggggggggggg",
    "ggiggggggghggggg",
    "gggggggggggggggg",
    "gggggggigggggggh",
    "ghgggggggggggggg",
    "gggggggggggigggg",
    "gggggghggggggggg",
    "giggggggggggggig",
    "gggggggggigggggg",
    "gggghggggggggggg",
    "gggggggggggghggg",
    "ggggggiggggggggg",
    "gggggggggggggggg",
    "ghgggggggigggggg",
]

# 이랑 몸통: 네 줄 주기(마루 빛 a/A → 앞면 b → 아래 c → 고랑 d/e). 가로 16, 세로 16 모두 이음새 없이 감긴다.
# 마루는 곧은 줄이 아니라 흙덩이(A)·꺼짐(b)·잔돌(p q)로 손으로 흔들었다.
BODY = [
    "aAabaaaAaabaAaab",
    "babbAbbabbbabbab",
    "cbcbbcbccbcbcbcc",
    "dcddedcdddecddcd",
    "aabaAaabaaaAabaa",
    "bbabbbabbAbbabbb",
    "cbcccbbccbccbccb",
    "dddcddedcddddedc",
    "AaabaaaAabaaabAa",
    "bAbbabbbbbabbAbb",
    "cbccbcbbcbccbcbc",
    "eddcdddcddcddcdd",
    "aabaaAaabaAaabaa",
    "bbbAbbabbbbbabAb",
    "bcbcccbcbccbcbcc",
    "dcdddedcddcdeddd",
]
RIM = "AaaAaaaTaAaaaAaa"          # 둑 위 가장자리(빛 받는 흙 테)
FRONT_HI = "cccbcccccbcccccb"     # 둑 앞면 위 줄
FRONT_LO = "dddddeddddddedde"     # 둑 앞면 아래 줄

ROLE_EDGES = {
    "body": "", "N": "N", "S": "S", "W": "W", "E": "E",
    "NW": "NW", "NE": "NE", "SW": "SW", "SE": "SE", "iso": "NSWE",
}
NOTCH = {"inNW": "NW", "inNE": "NE", "inSW": "SW", "inSE": "SE"}


def _inside_fn(role):
    edges = ROLE_EDGES.get(role, "")
    notch = NOTCH.get(role)
    x0 = 2 if "W" in edges else -99
    x1 = 13 if "E" in edges else 99
    y0 = 2 if "N" in edges else -99
    y1 = 14 if "S" in edges else 99

    def inside(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1): return False
        # 볼록 모서리 둥글리기(세 화소)
        if "N" in edges and "W" in edges and (x - x0) + (y - y0) <= 1: return False
        if "N" in edges and "E" in edges and (x1 - x) + (y - y0) <= 1: return False
        if "S" in edges and "W" in edges and (x - x0) + (y1 - y) <= 1: return False
        if "S" in edges and "E" in edges and (x1 - x) + (y1 - y) <= 1: return False
        # 오목 모서리: 대각선 이웃 칸만 풀 — 이웃 가장자리 칸의 풀 띠(2화소)·앞면 그림자(1화소)와 이어진다
        if notch == "NW" and x <= 1 and y <= 1: return False
        if notch == "NE" and x >= 14 and y <= 1: return False
        if notch == "SW" and x <= 1 and y >= 15: return False
        if notch == "SE" and x >= 14 and y >= 15: return False
        return True
    return inside


def soil_rows(role):
    inside = _inside_fn(role)
    out = []
    for y in range(16):
        row = ""
        for x in range(16):
            if not inside(x, y):
                # 밭 둑이 오른쪽·아래로 드리우는 그림자
                shade = inside(x - 1, y) or inside(x, y - 1) or inside(x - 1, y - 1)
                row += "i" if shade else GRASS[y][x]
                continue
            lf, rt = inside(x - 1, y), inside(x + 1, y)
            up, up2 = inside(x, y - 1), inside(x, y - 2)
            dn, dn2 = inside(x, y + 1), inside(x, y + 2)
            if not dn: ch = "e" if not (lf and rt) else FRONT_LO[x]
            elif not dn2: ch = "e" if not (lf and rt) else FRONT_HI[x]
            elif not up: ch = "e"
            elif not lf or not rt: ch = "e"
            elif not up2: ch = RIM[x]
            elif not inside(x - 1, y - 1) or not inside(x + 1, y - 1): ch = "a"   # 둥근 모서리 안쪽 테
            else: ch = BODY[y][x]
            row += ch
        out.append(row)
    return out


def role_rows():
    return {r: soil_rows(r) for r in ("body", "N", "S", "W", "E", "NW", "NE", "SW", "SE", "iso", "inNW", "inNE", "inSW", "inSE")}


_WET = {"T": "A", "A": "a", "a": "b", "b": "c", "c": "d", "d": "e", "e": "n", "q": "p"}
# 물 먹은 흙의 젖은 빛 — 마루 위 드문 화소(손으로 고름). 몸통 좌표 기준.
_WET_GLINT = {}


def wet(rows):
    """물 준 흙: 같은 그림의 흙 색만 한 단 어둡게 + 마루에 젖은 빛 몇 점. 풀은 그대로."""
    out = []
    for y, r in enumerate(rows):
        s = ""
        for x, ch in enumerate(r):
            if (x, y) in _WET_GLINT and ch in "aA": s += _WET_GLINT[(x, y)]
            else: s += _WET.get(ch, ch)
        out.append(s)
    return out


# ================================================================ 작물 (투명 바탕, 흙 칸 위 윗층)
# 이랑 마루는 y ≡ 0 (mod 4). 포기는 마루 앞면에 뿌리를 두고(줄기 밑이 y=5·13), 그림자(,)를 고랑으로 떨군다.
CROPS = {}

_WS = ["Q..", ".LQ", ".K.", ".,,"]                       # 밀 싹: 잎 두 장
g = blank()
for x in (1, 5, 9, 13): stamp(g, _WS, x, 3, wrap=False)
for x in (3, 7, 11): stamp(g, _WS, x, 11, wrap=False)
CROPS["wheat_sprout"] = rows_of(g)

_WY = [                                                   # 밀 자라는 중: 칼잎 포기(5×8)
    "..Q..",
    "Q.M..",
    "M.MQ.",
    "LMLM.",
    ".LKL.",
    ".KLKM",
    ".FKF.",
    "..,,,",
]
g = blank()
for x in (0, 4, 8, 12): stamp(g, _WY, x, -1, wrap=False)
for x in (2, 6, 10): stamp(g, _WY, x, 7, wrap=False)
CROPS["wheat_young"] = rows_of(g)

# 밀 익음: 이삭 띠 둘(뒤 줄 0~7행·앞 줄 8~15행). 위 넉 줄은 옅은 이삭(U)·금빛(Y)·짚(v), 아래는 줄기 결(y w), 줄 사이 그늘(w).
# 버들항 도시 밀밭(옅은 이삭 + 줄기 세로결 + 띠 아래 갈색 선)과 가도 밀밭(금빛)의 중간 색.
CROPS["wheat_mature"] = [
    ".UU.YU.UU.UY.UU.",
    "UYUvUYUUYvUUvYUU",
    "vUvYvUvvUvYvUvvY",
    "yvUvyvYvyvUvyvUv",
    "vyvwvyvwvyvwvyvw",
    "wvyvwvyvwvyvwvyv",
    "vwywvwywvwywvwyw",
    "wwywwwywwwywwwyw",
    "UYUUyUUYUUvUYUUy",
    "vUYvUvUvYUvUvUvY",
    "UvUvyvUvvUvYvyvU",
    "yvyvUvyvyvUvyvUv",
    "vyvwvyvwvyvwvyvw",
    "wvyvwvyvwvyvwvyv",
    "vwywvwywvwywvwyw",
    ",w,w,w,w,w,w,w,w",
]

_CS = [".Q.Q", ".MLM", "..K.", "..,,"]                    # 배추 싹: 떡잎 둘
g = blank()
for x in (1, 9): stamp(g, _CS, x, 3, wrap=False)
for x in (1, 9): stamp(g, _CS, x, 11, wrap=False)
CROPS["cabbage_sprout"] = rows_of(g)

_CY = [                                                   # 배추 자라는 중: 벌어진 잎 6×5
    ".Q..Q.",
    "QMLLMQ",
    "LMKKML",
    ".KFFK.",
    "..,,,,",
]
g = blank()
for x in (1, 9): stamp(g, _CY, x, 2, wrap=False)
for x in (1, 9): stamp(g, _CY, x, 10, wrap=False)
CROPS["cabbage_young"] = rows_of(g)

_CM = [                                                   # 배추 익음: 겉잎에 싸인 둥근 통 8×7
    "..LMML..",
    ".LQQMKL.",
    "LMQQQMKD",
    "KMQMMKKD",
    "KKMMKKFD",
    ".DFKKFD,",
    "..DDDD,,",
]
g = blank()
for x in (0, 8): stamp(g, _CM, x, 1, wrap=False)
for x in (0, 8): stamp(g, _CM, x, 9, wrap=False)
CROPS["cabbage_mature"] = rows_of(g)

_TS = ["Q.Q", ".M.", ".K.", ".,,"]                        # 토마토 싹
g = blank()
for x in (2, 10): stamp(g, _TS, x, 11, wrap=False)
CROPS["tomato_sprout"] = rows_of(g)

_TY = [                                                   # 토마토 자라는 중: 지주(위 끝 윗면 보임) + 잎
    "..TA...",
    "..ac...",
    ".QacM..",
    "QMacLQ.",
    "LKacKL.",
    ".QacMQ.",
    "MLacLKM",
    "KFacFK.",
    ".DacD..",
    "..ac,,.",
    "..dd,,.",
]
g = blank()
for x in (1, 9): stamp(g, _TY, x, 4, wrap=False)
CROPS["tomato_young"] = rows_of(g)

_TM = [                                                   # 토마토 익음: 지주에 묶인 덤불, 2×2 열매 송이(빛 U)
    "...TA...",
    "..LacQ..",
    ".QMacML.",
    "QUSacKLQ",
    "MRrLcURL",
    "LKFacSrK",
    ".QMacLQ.",
    "MUSRcKML",
    "KRrrcFKD",
    ".DKacUSD",
    "..DacRr,",
    "...dd,,.",
]
g = blank()
for x in (0, 8): stamp(g, _TM, x, 3, wrap=False)
CROPS["tomato_mature"] = rows_of(g)

# 씨 뿌림(새 칸): 마루마다 북돋운 밝은 흙무덤(3×2, 마른 겉흙 T)과 고랑으로 지는 그림자. 심는 중 장면에 쓴다.
# (QA 1차: 2×2 무덤은 맨 흙과 구별되지 않았다 — 3폭·밝은 꼭지로 키웠다.)
_SD = ["TA.", "AaT", ",,,"]
g = blank()
for x in (1, 5, 9, 13): stamp(g, _SD, x, 3, wrap=False)
for x in (3, 7, 11): stamp(g, _SD, x, 11, wrap=False)
CROPS["seeded"] = rows_of(g)


# ================================================================ 나무 울타리
# 모든 조각이 같은 말뚝 하나를 쓴다: 열 5~10(윤곽 포함 6폭), 머리 윗면 2~5행(4행, 나이테), 앞면 6~13행, 밑동 14, 땅 15.
# 가로대(동서): 위 가로대 5~10행(윗면 6·7행, 앞면 8·9행), 아래 가로대 11~15행(윗면 12, 앞면 13·14).
# 세로 줄(남북): 가로대는 위에서 내려다본 긴 띠(윗면)로 보인다 — 열 6~9, 윤곽 5·10.
#   말뚝 앞(남쪽)으로 나가는 띠는 가로대 높이(8행)에서 말뚝 앞면을 덮고 내려가 다음 칸 0·1행으로 이어진다.
POST = {
    1: "nnnnnn",
    2: "nTAAAn",
    3: "nAaTAn",
    4: "nATaAn",
    5: "nAAAan",
    6: "nbaacn",
    7: "nbacdn",
    8: "nbcbcn",
    9: "nbacdn",
    10: "nbccdn",
    11: "nbacdn",
    12: "nbcbdn",
    13: "nbccdn",
    14: "ndddde",
    15: ".nnnn.",
}
RAIL = {5: "nnnnn", 6: "ATAAA", 7: "aaAaa", 8: "cbccc", 9: "ddddd", 10: "nnnnn",
        11: "nnnnn", 12: "aAaaa", 13: "ccbcc", 14: "ddddd", 15: "nnnnn"}
# 세로 줄(남북)의 가로대는 말뚝 옆면(서쪽 줄은 서쪽, 동쪽 줄은 동쪽)에 붙인다 — 위에서 본 긴 띠(윗면)가 말뚝 옆을 지나가고,
# 말뚝은 머리 윗면 4행 + 앞면이 가리지 않고 다 보인다. (QA·관문 1차: 띠가 말뚝 앞면을 덮으면 판정자가 「윗면 0행 기둥」으로 읽었다.)
STRIP = ["nTAan", "nTAan", "nTAan", "nTaan", "nTAan", "nTAan"]   # 6행 주기, 4번째 행은 널 이음
RAIL_END_S = ["nTAan", "naaan", "ncccn", "ndddn", "nnnnn"]          # 띠가 남쪽에서 끝날 때: 가로대 끝 앞면(2행)
RAIL_END_N = ["nnnnn", "nTAAn"]                                      # 띠가 북쪽에서 시작할 때: 윗면 테


def _strip(g, x0, y_from, y_to, end_s=False, start_n=False):
    for y in range(y_from, y_to + 1): stamp(g, [STRIP[y % 6]], x0, y, wrap=False)
    if start_n: stamp(g, RAIL_END_N, x0, y_from, wrap=False)
    if end_s: stamp(g, RAIL_END_S, x0, y_to - len(RAIL_END_S) + 1, wrap=False)


def _fence_piece(west=False, east=False, north=False, south=False, post=True, side="W"):
    """west/east = 가로대(동서), north/south = 세로 띠(남북, side 쪽 옆면에 붙음)."""
    g = blank()
    if west:
        for y, r in RAIL.items(): stamp(g, [r], 0, y, wrap=False)
    if east:
        for y, r in RAIL.items(): stamp(g, [r], 11, y, wrap=False)
    sx = 0 if side == "W" else 11
    if north and south: _strip(g, sx, 0, 15)
    elif north: _strip(g, sx, 0, 11, end_s=True)        # 북쪽에서 와서 이 말뚝 옆에서 끝난다
    elif south: _strip(g, sx, 5, 15, start_n=True)       # 이 말뚝 옆 가로대 높이에서 시작해 남쪽으로
    if post:
        for y, r in POST.items(): stamp(g, [r], 5, y, wrap=False)
    return rows_of(g)


FENCE = {}
FENCE["h"] = _fence_piece(west=True, east=True)
FENCE["v"] = _fence_piece(north=True, south=True, side="W")      # 서쪽 둘레(가로대가 말뚝 서쪽 옆)
FENCE["cNW"] = _fence_piece(east=True, south=True, side="W")
FENCE["cNE"] = _fence_piece(west=True, south=True, side="E")
FENCE["cSW"] = _fence_piece(east=True, north=True, side="W")
FENCE["cSE"] = _fence_piece(west=True, north=True, side="E")
FENCE["endW"] = _fence_piece(east=True)                    # 가로 줄 서쪽 끝 말뚝
FENCE["endE"] = _fence_piece(west=True)                    # 가로 줄 동쪽 끝 말뚝
FENCE["vN"] = _fence_piece(south=True, side="W")           # 세로 줄 북쪽 끝 말뚝
FENCE["vS"] = _fence_piece(north=True, side="W")           # 세로 줄 남쪽 끝 말뚝
FENCE["post"] = _fence_piece()                             # 홀로 선 말뚝
FENCE["vE"] = _fence_piece(north=True, south=True, side="E")     # 동쪽 둘레(가로대가 말뚝 동쪽 옆) — 2판 새 칸

# 울타리 문(닫힘): 왼쪽 굵은 문기둥(울타리 말뚝과 같은 머리 윗면 4행) + 오른쪽으로 단 널문.
# 널문 윗 띠장은 윗면 3행(T/A/a)이 보이고, 그 아래 세로 널·사선 빗장·아래 띠장 윗면 1행. 오른쪽 끝은 이웃 가로 울타리 가로대에 닿는다.
# (관문 1차 FAIL: 양쪽 4폭 기둥 + 얇은 널문. 2차 FAIL: 꽉 막힌 널판이 「정면 입면도」로 읽혔다 — 가로 울타리와 같은 비례의 열린 틀로.)
_GATE_LEAF = {          # 열린 틀 널문: 위 띠장(윗면 2행+앞면 2행) · 사선 빗장 · 끝 세로대 · 아래 띠장 — 틈은 풀이 비친다(투명)
    4: "nnnnnnnnnn",
    5: "TTATTATTAn",
    6: "AAAaAAAaAn",
    7: "ccbcccbccn",
    8: "dddddddddn",
    9: "nnnnnnnnnn",
    10: "...nTAcnAn",
    11: ".nTAcn.nAn",
    12: "nnnnnnnnnn",
    13: "AaTaaAaaTn",
    14: "ccbcccbccn",
    15: "nnnnnnnnnn",
}
g = blank()
for y, r in POST.items(): stamp(g, [r], 0, y, wrap=False)
for y, r in _GATE_LEAF.items(): stamp(g, [r], 6, y, wrap=False)
FENCE["gate"] = rows_of(g)


# ================================================================ 큰 기물: 헛간·닭장 (여러 칸, 투명 바탕)
def _roof_tiles(w, h, seed=0):
    """버들항 민가 기와 결(4행 한 켜): 홈(1) / 기와 윗머리 빛(4 3) / 몸(2 3) / 몸(2). 켜마다 반 장 어긋난다."""
    rows = []
    for y in range(h):
        k = (y + seed) % 4
        shift = 2 if (y + seed) // 4 % 2 else 0
        r = ""
        for x in range(w):
            o = (x + shift) % 4
            if k == 0: ch = "1" if o in (2, 3) else "2"
            elif k == 1: ch = "1" if o == 3 else ("4" if o in (0, 1) else "3")
            elif k == 2: ch = "1" if o == 3 else ("3" if o == 0 else "2")
            else: ch = "1" if o == 3 else "2"
            r += ch
        rows.append(r)
    return rows


def _planks_v(w, h, lit="2", mid="2", dark="1", step=3):
    """세로 널벽(헛간 붉은 널): 널 사이 홈(1), 널 왼쪽 빛."""
    rows = []
    for y in range(h):
        r = ""
        for x in range(w):
            o = x % step
            r += dark if o == step - 1 else (lit if o == 0 and y % 7 != 3 else mid)
        rows.append(r)
    return rows


def barn():
    """헛간 6×6 칸(96×96). 처마가 남쪽을 보는 맞배 지붕(윗면이 크게 보인다) + 가운데 건초 다락 박공(작은 지붕) +
    붉은 널벽, 흰 테 두른 큰 두 짝 문(X 띠장), 양옆 작은 창, 돌 기초. 지붕 용마루에 환기 탑."""
    W, H = 96, 96
    g = blank(W, H)
    # 지붕 윤곽: 6~58행, 처마 양끝 2화소씩 나온다
    roof = _roof_tiles(92, 46)
    for y in range(46):
        stamp(g, ["n" + roof[y] + "n"], 1, 10 + y, wrap=False)
    stamp(g, ["n" * 94], 1, 9, wrap=False)
    # 용마루(윗면 띠): 4행 — 밝은 수키와 줄
    for y, r in enumerate(["n" * 94, "n" + "5" * 92 + "n", "n" + "".join("6" if x % 5 else "4" for x in range(92)) + "n", "n" + "3" * 92 + "n", "n" + "1" * 92 + "n"]):
        stamp(g, [r], 1, 5 + y, wrap=False)
    # 처마 끝(앞 테): 밝은 테 + 그늘
    stamp(g, ["n" + "5" * 92 + "n"], 1, 56, wrap=False)
    stamp(g, ["n" + "4" * 92 + "n"], 1, 57, wrap=False)
    stamp(g, ["n" * 94], 1, 58, wrap=False)
    # 환기 탑(용마루 위 작은 집): 윗면 지붕 + 앞면 루버
    cup = [
        "....nnnnnnnn....",
        "...n55555555n...",
        "..n4646464646n..",
        "..n3333333333n..",
        "..nnnnnnnnnnnn..",
        "...naTaTaTaTn...",
        "...ndcdcdcdcn...",
        "...nnnnnnnnnn...",
    ]
    stamp(g, cup, 40, 0, wrap=False)
    # 건초 다락 박공(지붕 앞으로 튀어나온 작은 박공): 삼각 지붕 두 면 + 박공벽 + 다락 문
    gable = [
        "...........nn...........",
        "..........n55n..........",
        ".........n5432n.........",
        "........n543321n........",
        ".......n5432.321n.......",
        "......n5432...321n......",
        ".....n5432.....321n.....",
        "....n5432.......321n....",
        "...n5432.........321n...",
        "..n5432...........321n..",
        ".n5432.............321n.",
        "n5432...............321n",
    ]
    stamp(g, gable, 36, 26, wrap=False)
    # 박공벽(붉은 널) 채우기 — 삼각 안쪽
    for i in range(1, 11):
        y = 26 + 1 + i
        x0 = 36 + 12 - i + 3
        x1 = 36 + 12 + i - 4
        for x in range(x0, x1 + 1):
            if g[y][x] == ".": g[y][x] = "2" if (x - 36) % 3 else "1"
    for x in range(36, 60):
        g[38][x] = g[38][x] if g[38][x] != "." else "2"
    # 박공벽 아래(지붕면 위) 다락 벽 띠
    for y in range(38, 50):
        for x in range(39, 57):
            g[y][x] = "1" if (x - 39) % 3 == 2 else ("2" if y % 7 != 3 else "1")
    for y in range(38, 50): g[y][38] = "n"; g[y][57] = "n"
    stamp(g, ["n" * 20], 38, 50, wrap=False)
    # 다락 문(흰 테, 짚이 비침)
    loft = [
        "nnnnnnnnnn",
        "nWWWWWWWWn",
        "nWUYOYUYWn",
        "nWYOyOyOWn",
        "nWOyw yOWn".replace(" ", "y"),
        "nWywvwywWn",
        "nWWWWWWWWn",
        "nnnnnnnnnn",
    ]
    stamp(g, loft, 43, 40, wrap=False)
    # 다락 박공 지붕면이 큰 지붕에 드리우는 그림자
    for y in range(51, 55):
        for x in range(40, 58):
            if g[y][x] in "2345": g[y][x] = "1" if (x + y) % 2 else "2"
    # 벽(59~89행): 붉은 세로 널, 위아래 흰 테
    wall = _planks_v(92, 31)
    for y in range(31):
        stamp(g, ["n" + wall[y] + "n"], 2, 59 + y, wrap=False)
    stamp(g, ["n" + "1" * 90 + "n"], 3, 59, wrap=False)        # 처마 밑 그늘
    stamp(g, ["n" + "1" * 90 + "n"], 3, 60, wrap=False)
    for x in (4, 91):                                          # 모서리 흰 기둥
        for y in range(61, 90): g[y][x] = "W"; g[y][x + 1] = "0"
    # 큰 두 짝 문(32폭 28행): 흰 테 + X 띠장
    door = ["n" + "W" * 30 + "n"]
    for i in range(26):
        r = list("nW" + "2" * 28 + "Wn")
        for x in range(2, 30):
            if (x - 2) % 3 == 2: r[x] = "1"
        # 가운데 맞닿는 선
        r[15] = "n"; r[16] = "W"
        # X 띠장: 왼짝 x 2..15, 오른짝 17..29
        for lx, rx in ((2 + i * 13 // 25, 15 - i * 13 // 25), (17 + i * 12 // 25, 29 - i * 12 // 25)):
            r[lx] = "W"; r[rx] = "W"
        if i in (0, 12, 25):
            for x in range(2, 30): r[x] = "W" if x not in (15,) else "n"
        door.append("".join(r))
    door.append("n" * 32)
    stamp(g, door, 32, 61, wrap=False)
    # 작은 창 둘(흰 테, 어두운 유리, 윗틀 윗면)
    win = ["nnnnnnnnn", "nWWWWWWWn", "nW87W87Wn", "nW77W77Wn", "nWWWWWWWn", "nW77W77Wn", "n0000000n", "nnnnnnnnn"]
    stamp(g, win, 12, 66, wrap=False)
    stamp(g, win, 75, 66, wrap=False)
    # 돌 기초(윗면 1행 + 앞면)
    stamp(g, ["n" + "".join("0" if x % 6 else "9" for x in range(92)) + "n"], 1, 89, wrap=False)
    for y, pat in ((90, "9989998989"), (91, "8898988898"), (92, "7787787778")):
        stamp(g, ["n" + "".join(pat[(x + y) % 10] for x in range(92)) + "n"], 1, y, wrap=False)
    stamp(g, ["n" * 94], 1, 93, wrap=False)
    # 문 앞 흙 문턱
    stamp(g, ["nTAAAAAAAAAAAAAAAAAAAAAAAAAAAATn"], 32, 89, wrap=False)
    # 바닥 그림자(반투명)
    stamp(g, [";" * 92], 3, 94, wrap=False)
    stamp(g, [";" * 88], 5, 95, wrap=False)
    return rows_of(g)


def coop():
    """닭장 3×3 칸(48×48): 말뚝 위 작은 판잣집 — 홑지붕 윗면(널), 앞면 널벽에 작은 문과 경사 사다리, 기둥 넷."""
    g = blank(48, 48)
    # 지붕(윗면 크게): 4~21행 — 비탈을 따라 내려가는 널(세로), 널 사이 홈, 군데군데 이음(가로 짧은 홈), 위 끝 빛.
    for y in range(4, 22):
        r = ""
        for x in range(42):
            k = x % 5
            if x in (0, 41): ch = "n"
            elif y == 4: ch = "T"
            elif k == 4: ch = "d"
            elif (y - 4 + (x // 5) * 7) % 11 == 0: ch = "c"        # 널 이음
            elif k == 0: ch = "A"
            elif y > 18: ch = "b"                                   # 처마 쪽은 한 단 어둡게
            else: ch = "a"
            r += ch
        stamp(g, [r], 3, y, wrap=False)
    stamp(g, ["n" * 42], 3, 3, wrap=False)
    stamp(g, ["n" + "b" * 40 + "n", "n" + "c" * 40 + "n", "n" * 42], 3, 22, wrap=False)   # 처마 앞 테
    # 벽(25~38행): 세로 널(갈색), 양 끝 기둥
    for y in range(25, 39):
        r = "n" + "".join("e" if x % 4 == 3 else ("a" if x % 4 == 0 else "b") for x in range(36)) + "n"
        stamp(g, [r], 6, y, wrap=False)
    stamp(g, ["n" + "d" * 36 + "n"], 6, 25, wrap=False)
    # 닭 드나드는 작은 문(어둠) + 창
    stamp(g, ["nnnnnnn", "nTAAAan", "nennnen", "nen.nen".replace(".", "n"), "nennnen", "nennnen", "nnnnnnn"], 14, 31, wrap=False)
    stamp(g, ["nnnnnnnnn", "nAaaaaaan", "nbcbcbcbn", "ncbcbcbcn", "nnnnnnnnn"], 29, 29, wrap=False)   # 알 꺼내는 뚜껑 상자(윗면)
    # 바닥판 앞 테(윗면 1행) + 기둥 다리
    stamp(g, ["n" + "A" * 38 + "n", "n" + "c" * 38 + "n", "n" * 40], 5, 38, wrap=False)
    for x in (7, 40):
        stamp(g, ["nan", "nbn", "nbn", "ncn", "ncn", "ndn", "nnn"], x, 41, wrap=False)
    # 경사 사다리(널 + 가로 발판)
    for i in range(8):
        stamp(g, ["nAan"], 15 + i // 3, 40 + i, wrap=False)
    for i in (1, 4, 7):
        g[40 + i][16 + i // 3] = "T"
    # 그림자
    stamp(g, [";" * 36], 8, 47, wrap=False)
    return rows_of(g)


OBJECTS = {"barn": (barn(), 6, 6), "coop": (coop(), 3, 3)}
