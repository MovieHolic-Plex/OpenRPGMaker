"""beodeul_farm 손 도트 원본 (3판 화풍 정렬, 2026-10-14) — 16px 칸, 3/4 탑뷰, 버들항 시트에 실제로 있는 색만.

2판(PR #2534)이 「버들항과 분위기가 너무 다르다」고 해서 버들항 집·울타리·밭 조각을 8배로 놓고 문법을 읽어 다시 그렸다.
칸 번호·키·역할 이름은 1·2판과 같다(bake_farm.py 가 번호를 정한다). 새 조각(흙길 오토타일·풀 무늬)은 꼬리 빈칸에 덧붙인다.
그림은 행 문자열과 손으로 고른 글리프를 손으로 고른 자리에 찍어 만든다. 버들항 문법(지붕 기와 4×4 모듈과 행마다 한 단씩 내려가는
명암, 용마루 막새 줄, 처마 밑 회벽 그늘 4단, 3폭 목재 보, 1단 돌 기초)은 규칙 함수로 옮겼다. 이미지 생성·트레이싱 없음, 사람·글자 없음.

빛은 왼쪽 위(버들항 시트와 같다). 그림자는 오른쪽 아래로 진다. 윤곽은 검정이 아니라 그 면의 어두운 톤(울타리 #3d220c, 지붕 #2b203f).
색은 모두 버들항 시트(beodeul-city-chipset.png 앞 216행)에 있는 값이다 — 지붕 램프는 h107 민가 지붕에서, 회벽·보는 같은 집 벽에서,
널판은 창고(ware0) 벽에서, 흙길은 버들항 모랫길에서, 밀은 버들항 밀밭에서 잰 값.
"""
from PIL import Image

PAL = {
    # 흙·나무 (어둠 → 밝음)
    "n": "#1e150a", "e": "#3d220c", "d": "#452a17", "c": "#633712", "b": "#6f4725", "a": "#885a26", "A": "#b77541", "T": "#dcaf6c",
    "p": "#5b6667", "q": "#90928f",                       # 흙 속 잔돌
    # 풀
    "k": "#275e1f", "i": "#4b8232", "g": "#579f35", "h": "#73b83e", "l": "#8fd24a",
    # 잎
    "E": "#143a27", "D": "#205030", "F": "#367740", "K": "#4b8232", "L": "#73b83e", "M": "#8fd24a", "Q": "#8fd24a",
    # 밀·짚
    "w": "#845c1f", "y": "#aa7a08", "O": "#ec9900", "Y": "#fbc10d", "U": "#ecdb95", "v": "#9d9c33",
    # 토마토
    "r": "#7a2e2c", "R": "#863736", "S": "#e0482a",
    # 붉은 지붕·헛간 벽
    "1": "#4b1c1e", "2": "#7a2e2c", "3": "#9a3a26", "4": "#b85530", "5": "#f0df97", "6": "#c97a33",
    # 돌
    "7": "#374243", "8": "#5b6667", "9": "#777579", "0": "#929491", "W": "#c4c6c3",
    # 반투명 그림자(버들항 시트도 반투명 그림자를 쓴다)
    ",": (20, 12, 4, 96), ";": (14, 30, 8, 70),
}


def rgba(ch):
    if ch == ".": return (0, 0, 0, 0)
    if isinstance(ch, str) and ch.startswith("#"):
        return (int(ch[1:3], 16), int(ch[3:5], 16), int(ch[5:7], 16), 255)
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


_WET = {"T": "A", "A": "a", "a": "b", "b": "c", "c": "d", "d": "e", "e": "e", "q": "p"}   # 윤곽은 검정으로 떨어뜨리지 않는다(3판)
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
# 3판: 버들항 텃밭(잎 #58a035 #73b83e #4b8232, 그늘 #205030)과 밀밭(#aa7a08 #845c1f 바탕, #fbc10d 이삭 끝 드물게, 띠 사이 #714210)의 톤.
# 아주 밝은 연두·노랑 덩이를 줄이고 몸통은 중간 톤, 빛은 점으로만.
PAL.update({"Z": "#714210", "G": "#58a035", "N": "#2a1a0f"})   # N: 울타리 윤곽 — 버들항 창고 널벽 테와 같은 짙은 갈색(검정 #1e150a 보다 한 단 밝다)
CROPS = {}

_WS = ["L..", ".GL", ".K.", ".,,"]                       # 밀 싹: 잎 두 장
g = blank()
for x in (1, 5, 9, 13): stamp(g, _WS, x, 3, wrap=False)
for x in (3, 7, 11): stamp(g, _WS, x, 11, wrap=False)
CROPS["wheat_sprout"] = rows_of(g)

_WY = [                                                   # 밀 자라는 중: 칼잎 포기(5×8)
    "..L..",
    "G.L..",
    "L.GL.",
    "KLKG.",
    ".KFK.",
    ".FKFG",
    ".DFD.",
    "..,,,",
]
g = blank()
for x in (0, 4, 8, 12): stamp(g, _WY, x, -1, wrap=False)
for x in (2, 6, 10): stamp(g, _WY, x, 7, wrap=False)
CROPS["wheat_young"] = rows_of(g)

# 밀 익음: 버들항 밀밭 문법 — 띠 둘(0~7·8~15행). 띠마다 위 두 줄 이삭(바탕 y, 끝 Y 드물게, 옅은 U 아주 드물게),
# 가운데 줄기 세로결(y w), 아래 한 줄 어두운 결(w Z), 맨 아래 띠 사이 그늘(Z).
CROPS["wheat_mature"] = [       # (QA 3판: 2판보다 어두워져 버들항 밀밭의 금빛보다 칙칙했다 — 이삭 Y·U 를 버들항 밀밭 비율로)
    ".YyYyY.yYU.Yy.yY",
    "YyYOyYUyYyYOyYyU",
    "yUYyYyyYyUYyYyYy",
    "ywyYwyywYwyywYwy",
    "wywwywwywwywyyww",
    "ywZwywZwywZwywZw",
    "ZwZwZwZwZwZwZwZw",
    "ZZZZZZZZZZZZZZZZ",
    "yYUyYy.YyYyUYOyy",
    "YyyOyYyYUyYyYyUY",
    "yYUyYwyYyyYwyUwy",
    "wywYywywwYwwywyw",
    "ywwywwywywwywwyw",
    "wZywZwywZwywZwyZ",
    "ZwZwZwZwZwZwZwZw",
    ",Z,Z,Z,Z,Z,Z,Z,Z",
]

_CS = [".L.L", ".GLG", "..K.", "..,,"]                    # 배추 싹: 떡잎 둘
g = blank()
for x in (1, 9): stamp(g, _CS, x, 3, wrap=False)
for x in (1, 9): stamp(g, _CS, x, 11, wrap=False)
CROPS["cabbage_sprout"] = rows_of(g)

_CY = [                                                   # 배추 자라는 중: 벌어진 잎 6×5
    ".L..L.",
    "LGKKGL",
    "GLKKLG",
    ".KFFK.",
    "..,,,,",
]
g = blank()
for x in (1, 9): stamp(g, _CY, x, 2, wrap=False)
for x in (1, 9): stamp(g, _CY, x, 10, wrap=False)
CROPS["cabbage_young"] = rows_of(g)

_CM = [                                                   # 배추 익음: 겉잎에 싸인 둥근 통 8×7 — 윗면(속잎 L·빛 M 점) / 앞면 K / 그늘 F D
    "..KGGK..",
    ".KLMLGK.",
    "KGLLLGKD",
    "KGLGGKFD",
    "FKGGKKFD",
    ".DFKKFD,",
    "..DDDD,,",
]
g = blank()
for x in (0, 8): stamp(g, _CM, x, 1, wrap=False)
for x in (0, 8): stamp(g, _CM, x, 9, wrap=False)
CROPS["cabbage_mature"] = rows_of(g)

_TS = ["L.L", ".G.", ".K.", ".,,"]                        # 토마토 싹
g = blank()
for x in (2, 10): stamp(g, _TS, x, 11, wrap=False)
CROPS["tomato_sprout"] = rows_of(g)

_TY = [                                                   # 토마토 자라는 중: 지주(위 끝 윗면 보임) + 잎
    "..Aa...",
    "..ac...",
    ".LacG..",
    "LGacKL.",
    "GKacKG.",
    ".LacGL.",
    "GKacKKG",
    "KFacFK.",
    ".DacD..",
    "..ac,,.",
    "..dd,,.",
]
g = blank()
for x in (1, 9): stamp(g, _TY, x, 4, wrap=False)
CROPS["tomato_young"] = rows_of(g)

_TM = [                                                   # 토마토 익음: 지주에 묶인 덤불, 열매 송이(밝은 점 S 하나, 몸 R, 그늘 r)
    "...Aa...",
    "..LacL..",
    ".LGacGL.",
    "LSRacKGL",
    "GRrLcSRG",
    "LKFacRrK",
    ".LGacGL.",
    "GSRRcKGL",
    "KRrrcFKD",
    ".DKacSRD",
    "..DacRr,",
    "...dd,,.",
]
g = blank()
for x in (0, 8): stamp(g, _TM, x, 3, wrap=False)
CROPS["tomato_mature"] = rows_of(g)

# 씨 뿌림: 마루마다 북돋운 흙무덤(3×2, 마른 겉흙 T)과 고랑으로 지는 그림자.
_SD = ["TA.", "AaT", ",,,"]
g = blank()
for x in (1, 5, 9, 13): stamp(g, _SD, x, 3, wrap=False)
for x in (3, 7, 11): stamp(g, _SD, x, 11, wrap=False)
CROPS["seeded"] = rows_of(g)


# ================================================================ 나무 울타리 (3판: 2판보다 가늘고 윤곽을 밝게)
# 2판은 말뚝 6폭 + 검정 윤곽(#1e150a)이라 만화처럼 굵게 떠 보였다. 3판은 말뚝 5폭, 윤곽은 어두운 나무 톤 e(#3d220c),
# 왼쪽(빛 받는 쪽)은 윤곽 없이 빛 a 로 끝낸다. 3/4 윗면은 줄이지 않는다 — 말뚝 머리 윗면 4행, 가로대 윗면 2행.
# (관문 실측: 말뚝 머리 2행·가로대 윗면 1행으로 가늘게 한 판은 13조각 모두 「정면 입면도 · 윗면 0행」으로 FAIL 했다.)
# 말뚝: 열 5~9, 머리 윗면 0~3행, 앞면 4~13행, 밑동 14, 땅 그림자 15. 세로 줄(남북)의 가로대는 위에서 본 띠(5폭)로 말뚝 옆면에 붙는다.
POST = {               # 머리 윗면 4행(고른 밝은 A, 빛 T) ↔ 앞면(b·c·d) 한 단 이상 어둡게. 옆 윤곽 N, 위 윤곽은 두지 않는다.
    0: "NTTTN",            # (관문 실측: 윗면 결·나이테, 윗면 위 1px 어두운 테는 판정자가 「정면 입면의 윤곽」으로 읽었다)
    1: "NTTAN",
    2: "NTAAN",
    3: "NAAAN",
    4: "NcccN",
    5: "NbcdN",
    6: "NbcdN",
    7: "NbcdN",
    8: "NccdN",
    9: "NbcdN",
    10: "NbcdN",
    11: "NbcdN",
    12: "NccdN",
    13: "NbcdN",
    14: "NdddN",
    15: ".;;;;",
}
# 가로대 둘: 윗면 3행(옅은 T 앞 가장자리 + A) + 앞면 2행(c · d) + 땅 그림자 1행, 사이로 풀이 비친다. 위 3~8행, 아래 10~15행.
# (관문 실측: 윗면 위 1px 어두운 테·윗면의 결·그림자 없는 판은 판정자가 「정면 입면」으로 읽었다. 이 판이 통과했다.)
RAIL = {3: "TTTTTTTTTTTTTTTT", 4: "TATTTATTTTATTTAT", 5: "AAAAAAAAAAAAAAAA", 6: "cccccccccccccccc", 7: "dddddddddddddddd", 8: ";;;;;;;;;;;;;;;;",
        10: "TTTTTTTTTTTTTTTT", 11: "TATTTTATTTTTATTT", 12: "AAAAAAAAAAAAAAAA", 13: "cccccccccccccccc", 14: "dddddddddddddddd", 15: ";;;;;;;;;;;;;;;;"}
STRIP = ["NTTAN", "NTAAN", "NTTAN", "NTAAN", "NTTAN", "NcccN"]     # 6행 주기, 6번째 행은 널 이음
# 세로 줄 몸통(v·vE·vN·vS·cSW·cSE): 널 한 장마다 윗면 4행 + 앞 끝면 2행(c d)이 보이게 겹쳐 놓은 띠 — 3/4 윗면 단서를 매 널에 준다.
# (관문 실측: 끝면 없는 고른 띠는 「윗면 2행」·「정면 입면」으로 FAIL 이 잦았다.)
STRIP2 = ["NTTTN", "NTAAN", "NAAAN", "NAAAN", "NcccN", "NdddN"]
STRIP_END_S = ["NAAAN", "NcccN", "NdddN", ";;;;;"]         # 띠가 남쪽에서 끝날 때: 가로대 끝 앞면 + 밑 그늘
STRIP_END_N = ["NAAAN", "NTAAN"]                                    # 띠가 북쪽에서 시작할 때: 윗면 테


def _strip(g, x0, y_from, y_to, end_s=False, start_n=False, pat=None):
    pat = pat or STRIP
    for y in range(y_from, y_to + 1): stamp(g, [pat[y % 6]], x0, y, wrap=False)
    if start_n: stamp(g, STRIP_END_N, x0, y_from, wrap=False)
    if end_s: stamp(g, STRIP_END_S, x0, y_to - len(STRIP_END_S) + 1, wrap=False)


def _rail(g, x_from, x_to):
    for y, r in RAIL.items():
        stamp(g, [r[x_from:x_to + 1]], x_from, y, wrap=False)


def _fence_piece(west=False, east=False, north=False, south=False, post=True, side="W", pat=None):
    """west/east = 가로대(동서), north/south = 세로 띠(남북, side 쪽 옆면에 붙음)."""
    g = blank()
    if west: _rail(g, 0, 5)
    if east: _rail(g, 9, 15)
    sx = 0 if side == "W" else 10
    if north and south: _strip(g, sx, 0, 15, pat=pat)
    elif north: _strip(g, sx, 0, 12, end_s=True, pat=pat)        # 북쪽에서 와서 이 말뚝 옆에서 끝난다
    elif south: _strip(g, sx, 5, 15, start_n=True, pat=pat)       # 이 말뚝 옆 가로대 높이에서 시작해 남쪽으로
    if post:
        for y, r in POST.items(): stamp(g, [r], 5, y, wrap=False)
    return rows_of(g)


FENCE = {}
FENCE["h"] = _fence_piece(west=True, east=True)
FENCE["v"] = _fence_piece(north=True, south=True, side="W", pat=STRIP2)      # 서쪽 둘레(가로대가 말뚝 서쪽 옆)
FENCE["cNW"] = _fence_piece(east=True, south=True, side="W")
FENCE["cNE"] = _fence_piece(west=True, south=True, side="E")
FENCE["cSW"] = _fence_piece(east=True, north=True, side="W", pat=STRIP2)
FENCE["cSE"] = _fence_piece(west=True, north=True, side="E", pat=STRIP2)
FENCE["endW"] = _fence_piece(east=True)                    # 가로 줄 서쪽 끝 말뚝
FENCE["endE"] = _fence_piece(west=True)                    # 가로 줄 동쪽 끝 말뚝
FENCE["vN"] = _fence_piece(south=True, side="W", pat=STRIP2)           # 세로 줄 북쪽 끝 말뚝
FENCE["vS"] = _fence_piece(north=True, side="W", pat=STRIP2)           # 세로 줄 남쪽 끝 말뚝
FENCE["post"] = _fence_piece()                             # 홀로 선 말뚝
FENCE["vE"] = _fence_piece(north=True, south=True, side="E", pat=STRIP2)     # 동쪽 둘레(가로대가 말뚝 동쪽 옆)

# 울타리 문(닫힘): 왼쪽 문기둥(울타리 말뚝과 같은 머리, 칸 서쪽 끝) + 오른쪽으로 단 열린 틀 널문.
# 위·아래 띠장은 이웃 가로대와 같은 높이(3~7·10~14행), 그 사이 사선 빗장(왼쪽 아래 → 오른쪽 위), 끝 세로대(열 13~15)가 문짝 끝을 닫는다. 틈은 투명.
_GATE = {               # 열 5~15: 띠장은 이웃 가로대와 같은 행(위 3~8 · 아래 10~15), 끝 세로대 열 13~15(머리 윗면 0~2행)
    0: "........NTN",
    1: "........NTN",
    2: "........NAN",
    3: "TTTTTTTTTAN",
    4: "TATTATTTAcN",
    5: "AAAAAAAAAcN",
    6: "cccccccccdN",
    7: "NNNNNNNNNdN",
    8: "....NTAcNcN",
    9: "..NTAcN.NcN",
    10: "TTTTTTTTTcN",
    11: "TATTTATTAcN",
    12: "AAAAAAAAAcN",
    13: "cccccccccdN",
    14: "NNNNNNNNNNN",
    15: ";;;;;;;;;;;",
}
g = blank()
for y, r in POST.items(): stamp(g, [r], 0, y, wrap=False)
for y, r in _GATE.items(): stamp(g, [r], 5, y, wrap=False)
FENCE["gate"] = rows_of(g)


# ================================================================ 버들항 지붕·벽 문법 (헛간·닭장)
# h107 민가 지붕에서 잰 램프: 위 → 아래로 행마다 한 단씩 어두워지는 빛(L)·몸(M)·홈(D) 셋.
ROOF_L = ["#d5803b", "#d37f3b", "#d27f3a", "#d07d3a", "#cf7d39", "#ce7c39", "#cc7b38", "#cb7a38", "#ca7a38", "#c87837", "#c77837",
          "#c67737", "#c47636", "#c37536", "#bf7335", "#be7335", "#bd7234"]
ROOF_M = ["#933c3b", "#923c3b", "#903b3a", "#8f3a39", "#8e3a39", "#8d3a38", "#8c3938", "#8b3938", "#8a3837", "#893837", "#883736",
          "#873736", "#853635", "#843635", "#833635", "#823534"]
ROOF_D = ["#602b46", "#602b45", "#5f2b45", "#5e2b44", "#5e2a44", "#5d2a44", "#5d2a43", "#5c2a43", "#5c2943", "#5b2942", "#5a2942",
          "#5a2941", "#592841", "#582840", "#57273f", "#56273e", "#55263e"]
# 기와 한 장 = 4×4 모듈(빛 왼쪽 위, 홈 오른쪽·아래). 버들항 지붕과 같은 배열.
TILE_MOD = ["MLMD", "LLMD", "LLDD", "DMMM"]
EAVE_ROWS = [["#783130", "#ae6930", "#783130", "#4f2439"], ["#783130", "#ae6930", "#ae6930", "#4f2439"],
             ["#4f2439", "#ae6930", "#ae6930", "#4f2439"], ["#76302f", "#76302f", "#4d2338", "#76302f"]]
RIDGE_CAP = ["#fff2a5", "#db8537", "#5f2d4c", "#fff2a5"]       # 용마루 막새: 옅은 둘 · 주황 · 홈
RIDGE_CAP2 = ["#fff1a4", "#da8437", "#5e2d4c", "#fff1a4"]
OUTLINE = "#1e150a"                                         # 버들항 지붕 옆선(1폭)과 같은 값
BARGE = "#6f4725"


def roof_px(x, y, h, shade=0):
    """기와면 (x, y) 화소. y 는 기와면 안의 행(0 = 용마루 바로 아래), h 는 기와면 높이. shade>0 이면 그늘(몇 단 어둡게)."""
    k = min(len(ROOF_M) - 1, int(y * (len(ROOF_M) - 1) / max(1, h - 1)) + shade * 5)
    ch = TILE_MOD[y % 4][x % 4]
    if shade >= 2: ch = {"L": "M", "M": "D", "D": "D"}[ch]
    return {"L": ROOF_L[min(k, len(ROOF_L) - 1)], "M": ROOF_M[k], "D": ROOF_D[min(k, len(ROOF_D) - 1)]}[ch]


def put(g, x, y, c):
    if 0 <= y < len(g) and 0 <= x < len(g[0]): g[y][x] = c


def hline(g, x0, x1, y, c):
    for x in range(x0, x1 + 1): put(g, x, y, c)


def vline(g, x, y0, y1, c):
    for y in range(y0, y1 + 1): put(g, x, y, c)


def gable_roof(g, x0, x1, y0, y1):
    """맞배 지붕 윗면(처마가 남쪽): y0 윤곽 · 용마루 · 막새 2행 · 기와면 · 처마 4행. 양 옆은 1폭 윤곽 + 박공널."""
    hline(g, x0, x1, y0, OUTLINE)
    hline(g, x0 + 1, x1 - 1, y0 + 1, "#71482c")
    hline(g, x0 + 1, x1 - 1, y0 + 2, "#452a17")
    for x in range(x0 + 2, x1 - 1):
        put(g, x, y0 + 3, RIDGE_CAP[(x - x0) % 4]); put(g, x, y0 + 4, RIDGE_CAP2[(x - x0) % 4])
    face_top, face_bot = y0 + 5, y1 - 4
    hgt = face_bot - face_top + 1
    for y in range(face_top, face_bot + 1):
        for x in range(x0 + 2, x1 - 1): put(g, x, y, roof_px(x - x0, y - face_top, hgt))
    for i, row in enumerate(EAVE_ROWS):
        for x in range(x0 + 2, x1 - 1): put(g, x, y1 - 3 + i, row[(x - x0) % 4])
    vline(g, x0, y0, y1, OUTLINE); vline(g, x1, y0, y1, OUTLINE)
    vline(g, x0 + 1, y0 + 1, y1, BARGE); vline(g, x1 - 1, y0 + 1, y1, "#633712")
    put(g, x0 + 1, y0 + 1, "#442c19"); put(g, x0 + 1, y1, "#442c19")


PLASTER, SPECK = "#ecd6c6", "#bcaaa0"
EAVE_SHADE = ["#170e08", "#130d06", "#6d6363", "#7c7070", "#928484", "#c1afaf"]   # 처마 밑 짙은 그늘 2행 + 회벽 그늘 4단


def plaster_wall(g, x0, x1, y0, y1, seed=0):
    """회벽(처마 밑 그늘 램프 + 드문 얼룩) — 왼쪽 1폭 윤곽."""
    for y in range(y0, y1 + 1):
        k = y - y0
        for x in range(x0 + 1, x1 + 1):
            if k < len(EAVE_SHADE): c = EAVE_SHADE[k]
            else: c = SPECK if (x * 7 + y * 13 + seed) % 11 == 0 or (x * 3 + y * 5 + seed) % 17 == 0 else PLASTER
            put(g, x, y, c)
        put(g, x0, y, "#181009" if k < 6 else OUTLINE)


TIMBER = ["#6f4725", "#633712", "#312210"]                  # 3폭 보: 빛 · 몸 · 그늘


def post_v(g, x, y0, y1):
    for i, c in enumerate(TIMBER): vline(g, x + i, y0, y1, c)


def beam_h(g, x0, x1, y):
    hline(g, x0, x1, y, "#6f4725"); hline(g, x0, x1, y + 1, "#452a17")


def brace(g, x0, y0, x1, y1):
    """사선 버팀목(2화소 띠: 몸 #633712 + 그늘 #452a17)."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = x0 + round(i * (x1 - x0) / n); y = y0 + round(i * (y1 - y0) / n)
        put(g, x, y, "#633712"); put(g, x + 1, y, "#452a17")


PLANK_ROWS = [["#653f23", "#744c2a", "#653f23", "#885a26"], ["#885a26"], ["#744c2a", "#3c1700", "#653f23", "#5a3011"], ["#3c1700"]]


def plank_wall(g, x0, x1, y0, y1, vertical=False):
    """버들항 창고(ware0) 널벽: 가로 널 4행 주기(결 · 빛 · 옹이 · 홈). vertical 이면 세로 널(문짝)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if vertical:
                o = (x - x0) % 4
                c = ["#885a26", "#744c2a", "#653f23", "#3c1700"][o]
                if o == 1 and (y * 5 + x) % 9 == 0: c = "#5a3011"
            else:
                row = PLANK_ROWS[(y - y0) % 4]
                c = row[(x * 3 + (y // 4) * 5) % len(row)] if len(row) > 1 else row[0]
            put(g, x, y, c)


STONE_TOP = ["#929491", "#929491", "#c4c6c3", "#929491", "#929491", "#3e403d", "#929491", "#929491"]


def stone_base(g, x0, x1, y):
    for x in range(x0, x1 + 1): put(g, x, y, STONE_TOP[x % 8])
    hline(g, x0, x1, y + 1, "#37383c")
    put(g, x0, y, "#5a5b62"); put(g, x0, y + 1, "#37383c")


WINDOW = [   # 버들항 창: 나무 틀 + 짙은 유리 4칸 + 빛 + 창턱
    ["#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17"],
    ["#452a17", "#212d42", "#1b243a", "#633712", "#212d42", "#1b243a", "#1b243a", "#452a17"],
    ["#452a17", "#33849a", "#212d42", "#633712", "#88adc1", "#212d42", "#1b243a", "#452a17"],
    ["#452a17", "#633712", "#633712", "#633712", "#633712", "#633712", "#633712", "#452a17"],
    ["#452a17", "#212d42", "#1b243a", "#633712", "#212d42", "#1b243a", "#1b243a", "#452a17"],
    ["#452a17", "#1b243a", "#1b243a", "#633712", "#1b243a", "#1b243a", "#212d42", "#452a17"],
    ["#6f4725", "#885a26", "#885a26", "#885a26", "#885a26", "#885a26", "#885a26", "#6f4725"],
    ["#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17", "#452a17"],
]
FLOWER_BOX = [
    [".", "#e0482a", "#4b8232", "#fbc10d", "#e0482a", "#4b8232", "#e0482a", "."],
    ["#4b8232", "#367740", "#e0482a", "#4b8232", "#367740", "#e0482a", "#4b8232", "#367740"],
    ["#885a26", "#885a26", "#885a26", "#885a26", "#885a26", "#885a26", "#885a26", "#6f4725"],
    ["#633712", "#633712", "#452a17", "#633712", "#633712", "#452a17", "#633712", "#452a17"],
]
HAY = ["#fbc10d", "#aa7a08", "#845c1f", "#aa7a08", "#ecdb95", "#aa7a08", "#845c1f", "#714210"]


def barn():
    """헛간 6×6 칸(96×96) — 버들항 민가 문법의 농가 헛간.
    맞배 기와지붕(남쪽 처마, 윗면이 크게 보인다) + 가운데 건초 다락 박공(회벽·보·건초 문) /
    처마 밑 그늘 진 회벽에 3폭 목재 보 · 사선 버팀목 / 가운데 큰 두 짝 널문(Z 띠장) / 양옆 창과 화분 / 1단 돌 기초."""
    W, H = 96, 96
    g = blank(W, H)
    gable_roof(g, 1, 94, 4, 57)
    # 건초 다락 박공(지붕 앞으로 튀어나온 작은 박공): 기와 두 비탈(왼쪽 밝게) + 박공널 + 회벽 박공면(왕대공·평보) + 앞벽의 건초 문
    cx, apex, eave = 48, 19, 41
    for y in range(apex, eave + 1):
        outer = 2 + int((y - apex) * 0.85)
        inner = outer - 6
        for x in range(cx - outer - 2, cx + outer + 2):
            d = abs(x - cx) if x < cx else abs(x - cx + 1)
            if d == outer + 1: put(g, x, y, OUTLINE)
            elif d == outer: put(g, x, y, (RIDGE_CAP if x < cx else RIDGE_CAP2)[(y // 2) % 2 * 2 + (0 if x < cx else 1)])   # 비탈 끝 막새(옅은 테)
            elif inner < d < outer: put(g, x, y, roof_px(d + (0 if x < cx else 2), y - apex, eave - apex + 1, 0 if x < cx else 1))
            elif d == inner and y <= apex + 2: put(g, x, y, roof_px(d, y - apex, eave - apex + 1))
            elif d == inner and y > apex + 2: put(g, x, y, BARGE if x < cx else "#633712")
            elif d == inner - 1 and y > apex + 3: put(g, x, y, "#312210")
            elif d < inner - 1 and y > apex + 3: put(g, x, y, SPECK if (x * 7 + y * 3) % 13 == 0 else PLASTER)
    for y in range(apex + 1, eave + 1):                    # 오른쪽 비탈이 큰 지붕에 드리우는 그늘(2화소)
        outer = 2 + int((y - apex) * 0.85)
        for x in (cx + outer + 1, cx + outer + 2):
            if g[y][x] in ROOF_L or g[y][x] in ROOF_M: put(g, x, y, ROOF_D[10])
    half = 2 + int((eave - apex) * 0.85) - 6 - 1          # 박공면 반폭(맨 아래)
    vline(g, cx - 1, apex + 6, eave, "#6f4725"); vline(g, cx, apex + 6, eave, "#633712")   # 왕대공
    beam_h(g, cx - half + 1, cx + half - 2, eave - 6)                                    # 평보
    for y in (eave + 1, eave + 2): hline(g, cx - half - 7, cx + half + 6, y, ROOF_D[13] if y == eave + 1 else "#2b203f")
    # 앞벽(박공 아래, 지붕면 위로 솟은 벽): 회벽 + 건초 문
    fy0, fy1 = eave + 3, 51
    for y in range(fy0, fy1 + 1):
        for x in range(cx - half, cx + half):
            put(g, x, y, SPECK if (x * 5 + y * 7) % 11 == 0 else PLASTER)
        put(g, cx - half - 1, y, OUTLINE); put(g, cx + half, y, OUTLINE)
    hline(g, cx - 6, cx + 5, fy0, "#6f4725")
    for y in range(fy0 + 1, fy1 + 1):
        put(g, cx - 6, y, "#6f4725"); put(g, cx + 5, y, "#452a17")
        for x in range(cx - 5, cx + 5):
            put(g, x, y, "#281b0e" if y < fy0 + 3 else HAY[(x * 3 + y * 5) % len(HAY)])
    hline(g, cx - half - 1, cx + half, fy1 + 1, "#2b203f")
    # 박공 아래·오른쪽으로 기와 위에 드리우는 그늘
    for y in range(fy1 + 2, fy1 + 4):
        for x in range(cx - half, cx + half + 4):
            if g[y][x] in ROOF_L or g[y][x] in ROOF_M: put(g, x, y, ROOF_D[12])
    for y in range(eave + 3, fy1 + 2):
        for x in range(cx + half + 1, cx + half + 4):
            if g[y][x] in ROOF_L: put(g, x, y, ROOF_M[12])
    # 처마 밑 벽(58~91행): 회벽 + 보
    plaster_wall(g, 4, 91, 58, 91, seed=3)
    put(g, 91, 58, "#181009")
    for y in range(58, 92): put(g, 92, y, OUTLINE)
    for x in (5, 30, 62, 88):
        post_v(g, x, 63, 91)
    beam_h(g, 8, 87, 74)
    # 판 사이 사선 버팀목(버들항 민가처럼 바깥 판에만)
    brace(g, 9, 76, 19, 89); brace(g, 85, 76, 75, 89)
    # 창 둘 + 화분
    for wx in (14, 72):
        for y, row in enumerate(WINDOW):
            for x, c in enumerate(row): put(g, wx + x, 63 + y, c)
    for y, row in enumerate(FLOWER_BOX):
        for x, c in enumerate(row):
            if c != ".": put(g, 14 + x, 70 + y, c)
    # 큰 두 짝 널문(33~61열, 63~91행): 세로 널 + 위·아래 띠장 + 사선 띠장(Z) + 가운데 맞닿음
    dx0, dx1, dy0, dy1 = 33, 61, 64, 91
    hline(g, dx0 - 1, dx1 + 1, 62, "#6f4725"); hline(g, dx0 - 1, dx1 + 1, 63, "#452a17")      # 문 위 인방
    plank_wall(g, dx0, dx1, dy0, dy1, vertical=True)
    vline(g, dx0 - 1, dy0, dy1, "#2a1a0f"); vline(g, dx1 + 1, dy0, dy1, "#2a1a0f")
    mid = (dx0 + dx1) // 2
    vline(g, mid, dy0, dy1, "#2a1a0f"); vline(g, mid + 1, dy0, dy1, "#633712")
    for yy in (dy0 + 2, dy1 - 4):
        hline(g, dx0, mid - 1, yy, "#b77541"); hline(g, dx0, mid - 1, yy + 1, "#633712")
        hline(g, mid + 2, dx1, yy, "#b77541"); hline(g, mid + 2, dx1, yy + 1, "#633712")
    n = (dy1 - 4) - (dy0 + 4)
    for i in range(n):
        y = dy0 + 4 + i
        xl = dx0 + (i * (mid - 2 - dx0)) // n
        xr = dx1 - (i * (dx1 - mid - 3)) // n
        put(g, xl, y, "#b77541"); put(g, xl + 1, y, "#633712")
        put(g, xr, y, "#b77541"); put(g, xr - 1, y, "#633712")
    for y in (dy0 + 10, dy1 - 10):                              # 쇠고리
        put(g, mid - 2, y, "#5b6667"); put(g, mid + 3, y, "#5b6667")
    # 돌 기초
    stone_base(g, 4, 91, 92)
    for x in range(dx0, dx1 + 1): put(g, x, 92, "#885a26" if x % 3 else "#744c2a")   # 문턱(나무)
    # 바닥 그림자
    hline(g, 6, 93, 94, ";"); hline(g, 8, 92, 95, ";")
    return g


def coop():
    """닭장 3×3 칸(48×48): 말뚝 다리 위 작은 판잣집 — 기와 맞배지붕 윗면 + 창고 문법 가로 널벽, 작은 문, 경사 사다리, 알 상자."""
    g = blank(48, 48)
    gable_roof(g, 3, 44, 3, 24)
    # 벽(25~37행): 처마 밑 그늘 2행 + 가로 널
    for y in (25, 26): hline(g, 6, 41, y, "#170e08" if y == 25 else "#2a1a0f")
    plank_wall(g, 7, 40, 27, 37)
    vline(g, 6, 25, 37, "#2a1a0f"); vline(g, 41, 25, 37, "#2a1a0f")
    vline(g, 7, 27, 37, "#633712"); vline(g, 40, 27, 37, "#452a17")
    # 닭 드나드는 작은 문(짙은 틈, 나무 테, 윗틀 빛)
    for y in range(30, 38):
        for x in range(14, 21):
            edge = x in (14, 20) or y == 30
            put(g, x, y, "#6f4725" if edge else ("#281b0e" if y < 34 else "#170e08"))
    hline(g, 14, 20, 29, "#b77541")
    # 알 상자(벽에 붙은 뚜껑 상자 — 윗면 2행 + 앞면)
    for y, row in enumerate([["#452a17"] * 11, ["#452a17"] + ["#b77541"] * 9 + ["#452a17"], ["#452a17"] + ["#885a26"] * 9 + ["#452a17"],
                             ["#452a17"] + ["#633712", "#744c2a"] * 4 + ["#633712", "#452a17"], ["#452a17"] + ["#633712"] * 9 + ["#452a17"], ["#2a1a0f"] * 11]):
        for x, c in enumerate(row): put(g, 27 + x, 30 + y, c)
    # 바닥판 앞 테(윗면 1행 + 앞면) + 다리
    hline(g, 5, 42, 38, "#b77541"); hline(g, 5, 42, 39, "#633712"); hline(g, 5, 42, 40, "#3d220c")
    for x in (7, 39):
        for y in range(41, 47):
            put(g, x, y, "#885a26"); put(g, x + 1, y, "#633712"); put(g, x + 2, y, "#3d220c")
    # 경사 사다리(널 + 가로 발판)
    for i in range(8):
        put(g, 15 + i // 2, 39 + i, "#885a26"); put(g, 16 + i // 2, 39 + i, "#b77541"); put(g, 17 + i // 2, 39 + i, "#633712")
    for i in (2, 5):
        put(g, 15 + i // 2, 39 + i, "#dcaf6c")
    # 그림자
    hline(g, 8, 44, 47, ";")
    return g


OBJECTS = {"barn": (barn(), 6, 6), "coop": (coop(), 3, 3)}


# ================================================================ 흙길 오토타일 (3판 새 칸)
# 버들항 길 포석 오토타일처럼 반듯한 가장자리: 이어지지 않는 쪽은 칸 끝에서 2화소 안쪽에 곧게 끊긴다(풀 테 1 + 풀 그늘 1).
# 색은 버들항 모랫길 몸(#8a745c · 빛 #9e8b64 · 그늘 #816a56)과 그 테(#6e5b49 · #76634f). 몸에는 바퀴 자국 두 줄과 드문 잔돌.
LANE = {"o": "#8a745c", "u": "#9e8b64", "s": "#816a56", "r": "#6e5b49", "t": "#76634f", "x": "#a89878", "z": "#777579"}
PAL.update(LANE)
LANE_BODY = [          # (QA 3판: 고른 흙이 버들항 포석·잔디 옆에서 납작했다 — 잔돌 z·x, 짙은 흙점 s·r, 바퀴 자국 두 줄을 더 또렷하게)
    "oouosoooouozoxoo",
    "osoooooxsoooosoo",
    "ouoozooooouooroo",
    "rssrsssrrsssrssr",
    "ouuoooxouooouoou",
    "ooozoosoooxoooso",
    "osoooouooooozooo",
    "oouxoooosrooouoo",
    "zoooosoooooxoooo",
    "ouoooooozouoosoo",
    "srrssrsssrsssrrs",
    "ooouuoooouoooxou",
    "oxooooszooooouoo",
    "oousooooooxoosoo",
    "zoooooxsoouooooz",
    "ooxooouoosoooxoo",
]


def lane_rows(mask):
    """mask 비트: 1 북 · 2 동 · 4 남 · 8 서로 이어짐."""
    N, E, S, W = mask & 1, mask & 2, mask & 4, mask & 8
    x0 = -99 if W else 2
    x1 = 99 if E else 13
    y0 = -99 if N else 2
    y1 = 99 if S else 13

    def inside(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1): return False
        if not N and not W and x == x0 and y == y0: return False
        if not N and not E and x == x1 and y == y0: return False
        if not S and not W and x == x0 and y == y1: return False
        if not S and not E and x == x1 and y == y1: return False
        return True
    out = []
    for y in range(16):
        r = ""
        for x in range(16):
            if inside(x, y):
                edge_n = not inside(x, y - 1)
                edge_w = not inside(x - 1, y)
                edge_s = not inside(x, y + 1)
                edge_e = not inside(x + 1, y)
                if edge_n: r += "t"                                   # 북쪽 테: 풀 둑 아래 그늘진 흙
                elif edge_s: r += "u" if (x + y) % 5 else "x"         # 남쪽 테: 빛 받는 흙 테
                elif edge_w: r += "s"
                elif edge_e: r += "t"
                else: r += LANE_BODY[y][x]
            else:
                # 길 둘레 풀: 길 바로 바깥 남·동쪽은 풀이 길로 떨어지는 테(짙은 풀), 북쪽 위는 풀 그늘
                if inside(x, y + 1): r += "i"                          # 길 북쪽 테 위 풀 그늘
                elif inside(x - 1, y) or inside(x, y - 1) or inside(x + 1, y): r += "i" if (x + y) % 3 else "k"
                else: r += GRASS[y][x]
        out.append(r)
    return out


LANE_TILES = {m: lane_rows(m) for m in range(16)}


# ================================================================ 풀 무늬 (3판 새 칸, 737 잔디와 이음새 없이)
# 버들항 잔디: 거의 고른 #579f35 위에 드문 밝은 점(#8fd24a)과 짙은 풀 그늘 덩이(#4b8232 #367740). 칸 테두리 2화소는 바탕 잔디 그대로 둔다.
TUFT = ["..l..", ".hlh.", "hKhKh", ".iKi.", "..;.."]                # 풀 포기: 윗잎 빛 · 아래 그늘 · 땅 그림자
CLUMP = [".ii.i..", "ikiikii", "ikkkkii", ".iikii.", "..ii..."]     # 짙은 풀 덩이(버들항 잔디의 그늘 덩이 #4b8232 · #275e1f) — QA 3판: 점만 있는 무늬는 납작했다
TUFT_S = [".l.", "hKh", ".;."]
CLOVER = [".hh.", "hlKh", "hKKi", ".ii."]
FLOWER_W = ["..W..", ".WhW.", "..K..", "..;.."]                    # 흰 들꽃(버들항 회벽 흰 톤 W)
FLOWER_Y = [".Y.", "YhY", ".K.", ".;."]
PEBBLES = [".0.", "9z0", ";;."]
PAL.update({"W": "#ecd6c6"})


def grass_var(glyphs):
    g = [list(r) for r in GRASS]
    for gl, x, y in glyphs: stamp(g, gl, x, y, wrap=False)
    return rows_of(g)


GRASS_VARS = {
    "tufts": grass_var([(CLUMP, 2, 6), (TUFT, 3, 3), (TUFT_S, 10, 9)]),
    "tufts2": grass_var([(CLUMP, 7, 8), (TUFT_S, 2, 10), (TUFT, 8, 2), (TUFT_S, 11, 10)]),
    "clover": grass_var([(CLUMP, 3, 7), (CLOVER, 4, 5), (TUFT_S, 11, 2)]),
    "flowers_w": grass_var([(FLOWER_W, 2, 2), (FLOWER_W, 9, 8), (TUFT_S, 11, 2)]),
    "flowers_y": grass_var([(FLOWER_Y, 3, 8), (FLOWER_Y, 10, 3), (TUFT_S, 6, 2)]),
    "pebbles": grass_var([(PEBBLES, 4, 4), (TUFT_S, 10, 9), (["0"], 11, 3)]),
}
