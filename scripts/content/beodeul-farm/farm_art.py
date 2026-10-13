"""beodeul_farm 손 도트 원본 — 16px 칸, 3/4 시점, 버들항 팔레트만.

모든 그림은 행 문자열(16자 x 16행)로 직접 찍었다. '.' = 투명(또는 몸통 그대로),
코드는 읽고 합치고 굽기만 한다. 이미지 생성·트레이싱 없음, 사람 없음.
"""
from PIL import Image

PAL = {
    # 흙 (버들항 밭 이랑 #633712 #452a17 계열 + 나무 #885a26 #714d29)
    "a": "#885a26", "U": "#e6c08a", "A": "#b77541", "T": "#d9a566", "b": "#714d29", "c": "#633712", "d": "#452a17", "e": "#3d220c", "n": "#2a1a0f", "m": "#543719",
    # 풀 (버들항 잔디 #579f35 + 밝은 #73b83e, 어두운 #4b8232, 윤곽 #3a5a34)
    "g": "#579f35", "h": "#73b83e", "i": "#4b8232", "j": "#3a5a34",
    # 잎·작물
    "D": "#205030", "G": "#4b8232", "L": "#579f35", "H": "#73b83e", "Q": "#a8dc6e",
    "k": "#431d00", "w": "#845c1f", "y": "#aa7a08", "Y": "#fbc10d",
    "r": "#863736", "R": "#c2432f", "P": "#f06a45",
}

def rgba(ch):
    if ch == ".": return (0, 0, 0, 0)
    h = PAL[ch].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)

def img_of(rows):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    im = Image.new("RGBA", (16, 16))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r): im.putpixel((x, y), rgba(ch))
    return im

# ---------------------------------------------------------------- 밭 몸통 (이랑 가로, 네 줄 주기, 가로·세로 이음새 없음)
BODY = [
    "bbabbbbbabbbbbba",
    "cccccbccccccbccc",
    "ccccccccdcccccdc",
    "dddddddddddddddd",
    "bbbbabbbbbabbbbb",
    "ccbccccccccbcccc",
    "cdcccccdcccccccc",
    "dddddddddddddddd",
    "babbbbbbabbbbbbb",
    "ccccbcccccccbccc",
    "cccccccccdcccccc",
    "dddddddddddddddd",
    "bbbbbbabbbbabbbb",
    "ccbcccccbccccccc",
    "cccccdcccccccdcc",
    "dddddddddddddddd",
]

# ---------------------------------------------------------------- 가장자리 (. = 몸통 그대로)
EDGE_N = [
    "gggggggggggggggg",
    "gghggggggiggggjg",
    "eeeeeeeeeeeeeeee",
    "bbbbabbbbbbbabbb",
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "................", "................", "................",
]
EDGE_S = [
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "................", "................",
    "cccccccccccccccc",
    "dddddddddddddddd",
    "eeeeeeeeeeeeeeee",
    "iiiiiijiiiiiiiji",
    "gghggggggiggggjg",
]
_W_ROWS = ["ggeb", "hgeb", "gieb", "ggeb"]
EDGE_W = [_W_ROWS[y % 4] + "." * 12 for y in range(16)]
_E_ROWS = ["cegg", "cegh", "dgig", "cegg"]
EDGE_E = ["." * 12 + _E_ROWS[y % 4] for y in range(16)]

def _compose(layers):
    """layers: 위에 얹을 가장자리 행 목록들(앞쪽이 우선) 위에 BODY."""
    out = []
    for y in range(16):
        row = ""
        for x in range(16):
            ch = BODY[y][x]
            grass = [lay[y][x] for lay in layers if lay[y][x] in "ghij"]
            other = [lay[y][x] for lay in layers if lay[y][x] != "."]
            if grass: ch = grass[0]
            elif other: ch = other[0]
            row += ch
        out.append(row)
    return out

def _patch(rows, patches):
    g = [list(r) for r in rows]
    for (x, y), ch in patches.items(): g[y][x] = ch
    return ["".join(r) for r in g]

# 모서리 둥글리기(손으로 고른 화소)
ROUND = {
    "NW": {(2, 2): "g", (3, 3): "e", (4, 3): "b"},
    "NE": {(13, 2): "g", (12, 3): "e", (11, 3): "b"},
    "SW": {(2, 13): "g", (3, 12): "e", (3, 11): "d"},
    "SE": {(13, 13): "g", (12, 12): "e", (12, 11): "d"},
}

def role_rows():
    r = {}
    r["body"] = BODY
    r["N"] = _compose([EDGE_N])
    r["S"] = _compose([EDGE_S])
    r["W"] = _compose([EDGE_W])
    r["E"] = _compose([EDGE_E])
    r["NW"] = _patch(_compose([EDGE_N, EDGE_W]), ROUND["NW"])
    r["NE"] = _patch(_compose([EDGE_N, EDGE_E]), ROUND["NE"])
    r["SW"] = _patch(_compose([EDGE_S, EDGE_W]), ROUND["SW"])
    r["SE"] = _patch(_compose([EDGE_S, EDGE_E]), ROUND["SE"])
    iso = _compose([EDGE_N, EDGE_S, EDGE_W, EDGE_E])
    for k in ("NW", "NE", "SW", "SE"): iso = _patch(iso, ROUND[k])
    r["iso"] = iso
    # 오목 모서리: 이웃 칸 넷은 밭인데 대각선 하나만 비었다 — 그 모서리에 풀 한 귀퉁이
    r["inNW"] = _patch(BODY, {(0, 0): "g", (1, 0): "g", (2, 0): "g", (0, 1): "g", (1, 1): "g", (0, 2): "g", (3, 0): "e", (2, 1): "e", (1, 2): "e", (0, 3): "e"})
    r["inNE"] = _patch(BODY, {(15, 0): "g", (14, 0): "g", (13, 0): "g", (15, 1): "g", (14, 1): "g", (15, 2): "g", (12, 0): "e", (13, 1): "e", (14, 2): "e", (15, 3): "e"})
    r["inSW"] = _patch(BODY, {(0, 15): "g", (1, 15): "g", (2, 15): "g", (0, 14): "g", (1, 14): "g", (0, 13): "g", (3, 15): "e", (2, 14): "e", (1, 13): "e", (0, 12): "e"})
    r["inSE"] = _patch(BODY, {(15, 15): "g", (14, 15): "g", (13, 15): "g", (15, 14): "g", (14, 14): "g", (15, 13): "g", (12, 15): "e", (13, 14): "e", (14, 13): "e", (15, 12): "e"})
    return r

def wet(rows):
    """물 준 흙: 같은 그림의 흙 색만 한 단 어둡게(팔레트 교체)."""
    mp = {"b": "m", "a": "b", "c": "d", "d": "e"}
    return ["".join(mp.get(ch, ch) for ch in r) for r in rows]

# ---------------------------------------------------------------- 작물 (투명 바탕, 흙 칸 위에 얹는 윗층)
CROPS = {}
CROPS["wheat_sprout"] = [
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "................",
    "....H.....H.....",
    "...HL..H..LH..H.",
    "...GL..L..GL..L.",
    "..HG..HL..G..HL.",
    "..G...G...G..G..",
    "................",
]
CROPS["wheat_young"] = [
    "................", "................", "................", "................",
    "................",
    "......H.....H...",
    "..H...L..H..L...",
    "..L..HL..L.HL..H",
    ".HL..L..HL.L...L",
    ".L..GL..L.GL.H.G",
    ".G..G..GL..G.L..",
    "HL.HL..G..GL.G.H",
    "L..G..LG..G..G.L",
    "G..G..G...G..G.G",
    "........G.......",
    "................",
]
CROPS["wheat_mature"] = [
    "..Y.....Y.......",
    ".YyY...YyY...Y..",
    ".YyY...YYy..YyY.",
    "..y.Y...y...YYy.",
    ".Yy.Yy..Y.Y..y..",
    ".wy.yY.Yy.Yy.w.Y",
    "..w.wy.yY.yY.w.y",
    ".Yw.w..wy.w..wY.",
    ".yw.wY.w..wY.wy.",
    ".w..wy.wY.wy.w.Y",
    ".w.Yw..wy.w..w.y",
    ".k.yw.Yw..wY.k.w",
    ".k.w..yk..wy.k..",
    ".G.k..wk..k..G..",
    "..G.G.k..GG.G...",
    "................",
]
CROPS["cabbage_sprout"] = [
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "................", "................",
    "......HH........",
    "....HHLLH.......",
    "...HLLGGLH......",
    "....GGDDGG......",
    ".....DD.D.......",
]
CROPS["cabbage_young"] = [
    "................", "................", "................", "................",
    "................", "................", "................",
    ".....HHHH.......",
    "...HHQLLLHH.....",
    "..HHLLLLGGHH....",
    "..HLLGLLLGGH....",
    "..GLGGDLLGGG....",
    "...GGGDGGGG.....",
    "....GGDDDG......",
    ".....D.DD.......",
    "................",
]
CROPS["cabbage_mature"] = [
    "................", "................", "................", "................",
    "................", "................",
    "....HHQQHH......",
    "..HHQQQHHLHH....",
    ".HHQQHHHLLLLH...",
    ".HQQHHLLLGLLH...",
    "HHQHLLLQQLGGGH..",
    "HQHLLLQHLLGGGH..",
    "HHLLLHHLLLGGGG..",
    ".GLLLLLLLGGGDG..",
    ".GGGLLLLGGGDD...",
    "..DGGGGGGGDD....",
]
CROPS["tomato_sprout"] = [
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "................", "................",
    "......H.........",
    ".....HLH........",
    "......G.H.......",
    "......G.G.......",
    "......DD........",
]
CROPS["tomato_young"] = [
    "................", "................", "................", "................",
    "......b.........",
    "....H.b.H.......",
    "...HLHbHLH......",
    "...GLLbLLG......",
    "....GHbGH.......",
    "...HGGbGGH......",
    "..HLGLbLGLH.....",
    "...GGDbDGG......",
    "....DDbDD.......",
    ".....Db.D.......",
    "......e.........",
    "................",
]
CROPS["tomato_mature"] = [
    "................", "................",
    ".......b........",
    "....H..b..H.....",
    "...HLH.b.HLH....",
    "..HLGLRbRLGLH...",
    "..GGRPRbLRPRG...",
    "...GRRRbGRRG....",
    "..HLGRPbLGGLH...",
    ".HLGGGGbGRPRLH..",
    ".GGLRPRbGRRRGG..",
    "..GGRRRbLGGGD...",
    "..DGGrGbGrGDD...",
    "...DDGDbDGDD....",
    "......Db........",
    ".......e........",
]

# ---------------------------------------------------------------- 나무 울타리 (3/4: 말뚝 윗면 3행(밝음) + 구분선 + 앞면(어두움), 가로대 윗면 2행 + 앞면 2행)
# 말뚝(6폭, 열 5~10): 윗면 r3~r5, 구분선 r6, 앞면 r7~r13, 밑동 r14, 밑줄 r15. 가로대: 위 r6~r9, 아래 r11~r14 (윗면 T·A, 앞면 m·m).
_POST = ["nnnnnn", "nTTTTn", "nTTTTn", "nTAATn", "nAAAAn", "nnnnnn"] + ["nmbmmn"] * 6 + ["neeeen", "nnnnnn"]  # r2..r15

def _fence(left_rails, right_rails, stripe_top=0):
    rails = {4: "T", 5: "T", 6: "A", 7: "m", 8: "m", 10: "T", 11: "T", 12: "A", 13: "m", 14: "m"}
    rows = []
    for y in range(16):
        if y < 2:
            rows.append(".....nTTTTn....." if (stripe_top and y == 1) else (".....nnnnnn....." if stripe_top else "." * 16)); continue
        r = _POST[y - 2]
        l = rails[y] * 5 if left_rails and y in rails else "....."
        rt = rails[y] * 5 if right_rails and y in rails else "....."
        rows.append(l + r + rt)
    return rows

FENCE = {}
FENCE["h"] = _fence(True, True)
# 세로 줄: 3/4 윗면 슬래브 5행(밝고 결 있음) + 어두운 뒷가장자리 + 어두운 앞면
_VTOP = ["..nnnnnn..", "nnUUUUUUnn", "nUUTUUUTUn", "nUTTTUTTTn", "nTTATTTATn", "nTAAAAAATn", ".nnnnnnnn."]
_VFRONT = ["ndbdddbdn"[:0] + "nddbddbddn"] * 7 + ["neeeeeeeen", "nnnnnnnnnn"]
FENCE["v"] = ["...%s..." % r for r in (_VTOP + _VFRONT)]
_VPOST = ["nnnnnn", "nTTTTn", "nTAATn", "nAAAAn", "nnnnnn", "nmbmmn", "nmbmmn", "nmbmmn", "nmbmmn", "nmbmmn", "neeeen", "nnnnnn"]
_STRIPE = ["nTTTTn", "nTTTTn", "nTAATn", "nTTTTn"]
FENCE["cNW"] = _fence(False, True)
_rails_s = {4: "T", 5: "T", 6: "A", 7: "m", 8: "m", 10: "T", 11: "T", 12: "A", 13: "m", 14: "m"}
FENCE["cSW"] = [(rt := ("." * 5 if y not in _rails_s else _rails_s[y] * 5)) and ("....." + r + rt) for y, r in enumerate(_STRIPE + _VPOST)]
_GTOP = [".nnnnnnnnnnnnnn.", "nnUUUUUUUUUUUUnn", "nUUUUTUUUUTUUUUn", "nUUTUUUUUUUUTUUn", "nUTTTUUTUUUTTTUn", "nTTATTTTTTTTATTn", "nTAAAAAAAAAAAATn", ".nnnnnnnnnnnnnn."]
_GFRONT = ["nddedn" + "dbdb" + "ndeddn"] * 6 + ["neeeeeeeeeeeeeen", "n" * 16]
FENCE["gate"] = _GTOP + _GFRONT
