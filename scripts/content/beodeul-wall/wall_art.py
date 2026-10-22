"""버들항 마을 성벽 손 도트 원본 — 16px 칸, 3/4 탑뷰(성벽 위 통로는 위에서 본 면, 그 아래 앞면), 버들항 시트에 실제로 있는 색만.

그림은 손으로 쓴 행 문자열 글리프(돌 블록·판석·흉벽 톱니·아치·문·계단)를 손으로 고른 자리에 찍어 만든다.
글리프의 자리(어느 칸의 어느 변에 흉벽이 서는지)는 규칙 함수가 정한다 — 농장 3판(farm_art.py)과 같은 방식.
이미지 생성·트레이싱 없음, 사람·글자 없음. 빛은 왼쪽 위, 윤곽은 검정이 아니라 돌의 가장 어두운 톤.

색 출처(모두 beodeul-city-chipset.png 앞 223행에 있는 값):
  돌(마름돌)  왕성 성벽 앞면(bd-castle)        o O m M s S B w L H
  통로 판석   왕성 안뜰 판석                    2 3 4 5 (+ 1)
  기와        h107 민가 지붕(farm_art 와 같은 값) r R t T y
  나무·쇠     창고 널벽·문(farm_art 와 같은 값)   e d c b a A · n i
"""
from PIL import Image

PAL = {
    # 돌 (어둠 → 밝음)
    "o": "#2b203f", "O": "#403a31", "m": "#54504e", "M": "#6d6863", "s": "#86827f",
    "S": "#99968c", "B": "#a7a7a1", "w": "#9f9a8d", "L": "#bcbbb1", "H": "#c8c5ba",
    # 통로 판석 (따뜻한 회색)
    "1": "#665b55", "2": "#7a6e67", "3": "#9e8d83", "4": "#bcaaa0", "5": "#c2bca7",
    # 기와
    "r": "#4b1c1e", "R": "#7a2e2c", "t": "#9a3a26", "T": "#b85530", "y": "#c97a33",
    # 나무
    "e": "#3d220c", "d": "#452a17", "c": "#633712", "b": "#6f4725", "a": "#885a26", "A": "#b77541",
    # 쇠·불
    "n": "#1e150a", "i": "#374243", "j": "#5b6667", "f": "#ec9900", "F": "#fbc10d",
    # 기와(버들항 민가 h101 지붕에서 잰 값)
    "q": "#2b203f", "x": "#462033", "g": "#5f2d4c", "k": "#fff2a5", "K": "#db8537", "u": "#933c3b",
    "U": "#d37f3b", "v": "#863736", "z": "#f0df97", "Z": "#c97a33",
    # 반투명 그림자(시트도 반투명 그림자를 쓴다)
    ",": (20, 16, 12, 90),
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


def blank(w=16, h=16, ch="."): return [[ch] * w for _ in range(h)]
def rows_of(g): return ["".join(r) for r in g]


def stamp(g, glyph, x, y):
    H, W = len(g), len(g[0])
    for dy, r in enumerate(glyph):
        for dx, ch in enumerate(r):
            if ch == "." or not (0 <= y + dy < H and 0 <= x + dx < W): continue
            g[y + dy][x + dx] = ch


# 어둡게 한 단(그늘): 같은 재질 램프에서 한 단 아래
DARKER = {"H": "L", "L": "B", "w": "s", "B": "S", "S": "s", "s": "M", "M": "m", "m": "O", "O": "o", "o": "o",
          "5": "4", "4": "3", "3": "2", "2": "1", "1": "1"}


def darken(g, x, y, n=1):
    if 0 <= y < len(g) and 0 <= x < len(g[0]) and g[y][x] in DARKER:
        for _ in range(n): g[y][x] = DARKER.get(g[y][x], g[y][x])


# ================================================================ 질감 글리프 (손으로 쓴 행)
# 통로 판석 16×16 — 가로·세로 모두 이음새 없이 감긴다. 줄눈 3(갈색 회색), 돌 윗변·왼변 w(빛), 아랫변·오른변 4(그늘),
# 몸은 돌마다 5(모래빛 회색) 또는 B(밝은 회색). 앞면 마름돌(차가운 회색)과 다른 따뜻한 판석이라 윗면으로 읽힌다.
FLAGS = [
    "3333333333333333",
    "wwwwww43wwwwww43",
    "w55w5543wBBBBB43",
    "w5555543wBwBBB43",
    "4444444344444443",
    "3333333333333333",
    "ww43wwwwww43wwww",
    "5543wBBBBB43w555",
    "5543wBwBBB43w5w5",
    "5543wBBBBB43w555",
    "4443444444434444",
    "3333333333333333",
    "wwww43wwwwww43ww",
    "BBBB43w5555543wB",
    "BBwB43w55w5543wB",
    "4444434444444344",
]

# 마름돌 앞면 16×16 = 두 켜(8px). 위 켜는 칸 안에 블록 하나(줄눈 x15), 아래 켜는 반 칸 어긋난 블록(줄눈 x7) — 가로로 감긴다.
# 변형 a·b·c 는 위 켜 블록의 몸 색(S 회색·w 따뜻한 돌·B 밝은 돌)과 반점만 다르다(아래 켜 블록은 칸 경계를 넘으므로 같은 색).
_COURSE_A = [
    "BLLLLLLLLLLLLL%m",
    "L%%*%%%%%+%%%%sm",
    "L%**%%%%%%%%*%sm",
    "L%%%%%+%%%%**%sm",
    "L+%%%%%%%%%%%%sm",
    "L%*%%%%%**%%%+sm",
    "%ssssss%ssssssmm",
    "mmmmmmmmmmmmmmmm",
]
_COURSE_B = [
    "LLLLLLBmBLLLLLLL",
    "BBSBBBsmLBBBBBBB",
    "BSSBBLsmLBBBSSBB",
    "BBBBBSsmLBLBBBSB",
    "BLBBBBsmLBSBBBBB",
    "BBBBBSsmLBBBBBLB",
    "sssSsssmSssssSss",
    "mmmmmmmmmmmmmmmm",
]
_BODY = {"a": ("S", "s"), "b": ("w", "s"), "c": ("B", "S")}
_LIGHTER = {"S": "B", "w": "L", "B": "L"}
ASHLAR = {v: [r.replace("%", body).replace("*", speck).replace("+", _LIGHTER[body]) for r in _COURSE_A] + list(_COURSE_B) for v, (body, speck) in _BODY.items()}

# 굽도리(기초) 16×8 — 내민 한 켜: 윗면 턱(빛) + 작은 막돌 + 바닥 윤곽.
PLINTH = [
    "LLLLLLLLLLLLLLLL",
    "ssssssssssssssss",
    "SSSSmSSSSSSmSSSS",
    "SsSSmSSSsSSmSSsS",
    "SSSmSSSSSmSSSSSm",
    "MMMmMMMMMmMMMMMm",
    "mmmmmmmmmmmmmmmm",
    "oooooooooooooooo",
]

# 흉벽 톱니(앞 흉벽, 칸 아래 7행) 8열 주기: 톱니 5열(윗면 2행 + 앞면 5행), 총안 3열(뒤 통로가 그늘져 보이고, 낮은 흉벽 갓돌 + 앞면).
# 같은 글자 '#' 는 「아래 판석을 그늘 두 단」.
MERLON_FRONT = [  # 8×7, 열 0~4 톱니, 5~7 총안
    "HHHHL###",
    "LLLLB###",
    "LSSSs###",
    "LSSSsHHH",
    "LSsSsBLL",
    "LSSSsSSS",
    "smmmmsss",
]
# 뒤 흉벽(북쪽 성벽 — 안쪽 면이 보인다): 칸 위 6행. 총안 위 3행은 비어(바깥 땅이 보인다).
MERLON_BACK = [  # 8×6
    "ooooo...",
    "HHHHLo..",
    "LSSSso..",
    "LSsSsoHH",
    "LSSSsSLL",
    "smmmmsss",
]
# 세로 성벽 흉벽(서쪽 띠, 위에서 본 것) 5×8 주기: 톱니 윗면 3행 + 남쪽 앞면 2행, 총안 3행은 낮은 갓돌.
MERLON_SIDE_W = [  # 5 열(x0 바깥 윤곽) × 8 행
    "oHHHL",
    "oLLLB",
    "oLLLB",
    "oBBBS",
    "oSsss",
    "oSBBB",
    "oSBBS",
    "osSSS",
]


def _mirror(glyph): return [r[::-1] for r in glyph]


MERLON_SIDE_E_RAW = _mirror(MERLON_SIDE_W)


def _fix_light_east(glyph):
    """동쪽 띠는 거울상이지만 빛은 여전히 왼쪽 위 — 톱니 윗면의 왼쪽 열을 밝게, 오른쪽 끝 바로 안쪽을 그늘로."""
    out = []
    for r in glyph:
        r = list(r)
        out.append("".join(r))
    return out


MERLON_SIDE_E = [
    "LHHHo",
    "BLLLo",
    "BLLLo",
    "SBBBo",
    "sssSo",
    "BBBSo",
    "SBBSo",
    "SSSso",
]


# ================================================================ 칸 조립 규칙
def flags_at(g, x0, y0, x1, y1, wx=0, wy=0):
    """통로 판석을 [x0,x1)×[y0,y1) 에 칠한다. wx·wy 는 칸의 세계 좌표 어긋남(판석이 칸을 넘어 이어지게)."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            g[y][x] = FLAGS[(y + wy) % 16][(x + wx) % 16]


def top_cell(N="O", S="O", W="O", E="O", wx=0, wy=0, corner=()):
    """성벽 윗면(통로) 한 칸. 각 변: 'P' 흉벽, 'D' 떨어지는 가장자리(윤곽), 'O' 이어짐(옆 칸 통로).
    N='P' = 북쪽 성벽(안쪽 면이 보인다)의 뒤 흉벽, S='P' = 남쪽 성벽(바깥 면이 보인다)의 앞 흉벽,
    W·E='P' = 세로 성벽의 흉벽 띠. corner = 오목 모서리 톱니('NE','NW','SE','SW')."""
    g = blank()
    flags_at(g, 0, 0, 16, 16, wx, wy)
    # 떨어지는 가장자리 — 북: 안쪽 턱(빛 + 그늘), 남: 통로 앞 모서리(빛) + 앞면 위 그늘
    if N == "D":
        for x in range(16): g[0][x] = "o"; g[1][x] = "L"; g[2][x] = "M"
    if S == "D":
        for x in range(16): g[14][x] = "H"; g[15][x] = "m"
    if W == "D":
        for y in range(16): g[y][0] = "o"
    if E == "D":
        for y in range(16): g[y][15] = "o"
    # 흉벽
    if N == "P":
        for x in range(16):
            for y in range(6): g[y][x] = MERLON_BACK[y][(x + wx) % 8]
        for x in range(16):
            if (x + wx) % 8 < 5:   # 톱니 발치 그늘이 통로에 진다
                darken(g, x, 6, 2)
            else: darken(g, x, 6, 1)
    if S == "P":
        for x in range(16):
            col = MERLON_FRONT
            for y in range(7):
                ch = col[y][(x + wx) % 8]
                if ch == "#": darken(g, x, 9 + y, 2)
                else: g[9 + y][x] = ch
    if W == "P":
        for y in range(16):
            for x in range(5): g[y][x] = MERLON_SIDE_W[(y + wy) % 8][x]
            if (y + wy) % 8 in (1, 2, 3, 4, 5): darken(g, 5, y, 2 if (y + wy) % 8 < 5 else 1)
    if E == "P":
        for y in range(16):
            for x in range(5): g[y][11 + x] = MERLON_SIDE_E[(y + wy) % 8][x]
    return g


def face_cell(lower=False, var="a", left="", right=""):
    """성벽 앞면 한 칸(위 칸 = 마름돌 두 켜, 아래 칸 = 마름돌 한 켜 + 굽도리).
    left/right: '' 이어짐, 'end' 성벽 끝(모서리 돌 + 윤곽), 'shadow' 옆에 선 세로 성벽이 드리운 그늘(왼쪽만), 'abut' 맞닿음 줄눈."""
    src = ASHLAR[var]
    g = [list(r) for r in src]
    if lower:
        g = [list(r) for r in src[:8]] + [list(r) for r in PLINTH]
    if left == "end":
        for y in range(16):
            g[y][0] = "o"
            if g[y][1] not in ("m", "o"): g[y][1] = "L" if g[y][1] != "s" else "B"
        # 모서리 돌: 아래 켜의 반 블록 대신 세운 돌(긴 돌) — 줄눈을 막는다
        for y in range(8, 15):
            if not lower:
                g[y][1] = "L"; g[y][7] = "s" if g[y][7] == "m" else g[y][7]
    if right == "end":
        for y in range(16):
            g[y][15] = "o"
            if g[y][14] not in ("o",): g[y][14] = "m" if g[y][14] == "m" else "s"
    if left == "shadow":
        for y in range(16):
            darken(g, 0, y, 2); darken(g, 1, y, 2); darken(g, 2, y, 1)
    if left == "abut":
        for y in range(16): g[y][0] = "m"
    if right == "abut":
        for y in range(16): g[y][15] = "m"
    return g


# ================================================================ 여러 칸 기물
def _face_block(w, h, var_seq="acbacb", plinth=True):
    """w×h 칸 크기의 앞면(마름돌 켜 + 맨 아래 굽도리). 위쪽 행부터 켜 A/B 교대, 칸마다 변형을 바꾼다."""
    W, H = w * 16, h * 16
    g = blank(W, H)
    for cy in range(h):
        for cx in range(w):
            v = var_seq[(cx + cy * 2) % len(var_seq)]
            src = ASHLAR[v]
            last = plinth and cy == h - 1
            for y in range(16):
                row = (src[y] if not (last and y >= 8) else PLINTH[y - 8])
                for x in range(16): g[cy * 16 + y][cx * 16 + x] = row[x]
    return g


def _outline_sides(g, y0, y1):
    W = len(g[0])
    for y in range(y0, y1):
        g[y][0] = "o"; g[y][W - 1] = "o"
        if g[y][1] not in "om": g[y][1] = "L"
        if g[y][W - 2] not in "om": g[y][W - 2] = "s"


def _quoins(g, y0, y1):
    """모서리 돌: 양 끝 4열에 긴 돌·짧은 돌을 번갈아(켜마다) — 손으로 고른 줄눈 자리."""
    W = len(g[0])
    for y in range(y0, y1):
        k = (y - y0) % 16
        long_ = k < 8
        for side in (0, 1):
            xs = range(1, 6 if long_ else 4) if side == 0 else range(W - (6 if long_ else 4), W - 1)
            for x in xs:
                ky = (y - y0) % 8
                ch = "L" if ky == 0 else ("s" if ky == 6 else ("m" if ky == 7 else ("L" if (side == 0 and x == 1) else "B")))
                g[y][x] = ch
            # 모서리 돌 안쪽 끝 줄눈
            xe = (5 if long_ else 3) if side == 0 else (W - (6 if long_ else 4) - 1)
            if (y - y0) % 8 != 7: g[y][xe + (1 if side == 0 else 0)] = "m"


# 아치: 손으로 고른 줄 길이. 행마다 (y, 홍예 바깥 반폭, 열린 반폭). 가운데는 x31|x32 사이. 열린 반폭 -1 = 닫힘.
ARCH_ROWS = [
    (20, 4, -1), (21, 7, -1), (22, 10, -1), (23, 12, -1), (24, 13, -1), (25, 14, -1),
    (26, 15, 3), (27, 16, 6), (28, 17, 8), (29, 17, 9), (30, 18, 10), (31, 18, 11),
    (32, 18, 12), (33, 18, 12), (34, 18, 13), (35, 18, 13), (36, 18, 13), (37, 18, 14),
]
ARCH_SPRING = 38          # 이 행부터 아래는 곧은 문설주(열린 반폭 14)
ARCH_TOP = 26
# 홍예돌 사이 방사 줄눈(왼쪽 반의 x, y — 오른쪽은 거울). 쐐기돌 양옆 줄눈 포함.
ARCH_JOINTS = [(29, 20), (29, 21), (29, 22), (29, 23), (29, 24), (29, 25),
               (24, 22), (24, 23), (23, 24), (23, 25),
               (19, 27), (18, 28), (18, 29), (17, 30),
               (16, 33), (15, 33), (14, 33), (17, 33)]


def arch_open_half(y):
    if y >= ARCH_SPRING: return 14
    for (yy, _v, o) in ARCH_ROWS:
        if yy == y: return o
    return -1


def arch_ring_half(y):
    for (yy, v, _o) in ARCH_ROWS:
        if yy == y: return v
    return -1


def _dist(x): return x - 32 if x >= 32 else 31 - x


def gatehouse(closed=False):
    """성문루 4×4 칸(64×64). 0행 = 탑 꼭대기(사방 흉벽), 1~3행 = 앞면과 2칸 폭 통로 아치.
    반환: (위층 64×64 행, 아래층 64×64 행 — 통로 칸만 그림, 나머지 '.')"""
    W, H = 64, 64
    g = blank(W, H)
    for cx in range(4):
        t = top_cell(N="P", S="P", W="P" if cx == 0 else "O", E="P" if cx == 3 else "O", wx=cx * 16, wy=0)
        for y in range(16):
            for x in range(16): g[y][cx * 16 + x] = t[y][x]
    f = _face_block(4, 3)
    for y in range(48):
        for x in range(64): g[16 + y][x] = f[y][x]
    _quoins(g, 16, 56)
    _outline_sides(g, 16, 64)
    for y in range(16): g[y][0] = "o"; g[y][63] = "o"
    for x in range(1, 63): g[16][x] = "m" if g[16][x] in "LBHwS" else g[16][x]
    # 홍예(아치 테): 왼쪽 반은 빛(L, 테 바깥 H), 오른쪽 반은 그늘(S, 테 바깥 s), 바깥 테두리 줄눈 m
    for (y, hv, ho) in ARCH_ROWS:
        for x in range(W):
            d = _dist(x)
            if d >= hv or d < ho: continue
            left = x < 32
            ch = ("L" if left else "S")
            if d == hv - 1: ch = "m"
            elif d == hv - 2: ch = "H" if left else "B"
            g[y][x] = ch
    # 쐐기돌(가운데 4열, 20~26행): 밝은 돌, 위는 한 단 더 밝게
    for y in range(19, 27):
        for x in range(30, 34):
            g[y][x] = "H" if y <= 20 else ("L" if x < 32 else "B")
        g[y][29] = "m"; g[y][34] = "m"
    for x in range(29, 35): g[19][x] = "m"
    for (x, y) in ARCH_JOINTS:
        for xx in (x, 63 - x):
            if g[y][xx] not in ".o": g[y][xx] = "m"
    # 홍예 받침돌(문설주 위 내민 돌)
    for x in list(range(12, 19)) + list(range(45, 52)):
        g[37][x] = "m"; g[38][x] = "H" if x < 32 else "L"; g[39][x] = "B" if x < 32 else "S"; g[40][x] = "m"
    # 문설주 안쪽 모서리(빛 왼쪽 문설주 오른쪽 면은 안 보인다 — 바깥 1열만 밝게/그늘)
    for y in range(41, 64):
        g[y][17] = "L"; g[y][46] = "s"
    low = [["."] * W for _ in range(H)]
    for y in range(ARCH_TOP, 64):
        ho = arch_open_half(y)
        for x in range(W):
            if _dist(x) >= ho: continue
            g[y][x] = "?" if closed else "."
            if closed: continue
            # 통로 안: 꼭대기는 짙은 어둠, 아래로 판석 바닥이 앞으로 갈수록 밝아진다
            # 통로 바닥은 비워 둔다(아래층 투명) — 맵의 길(1층)이 아치 밑으로 그대로 이어진다. 아치 머리 밑만 그늘.
            if y < 44: ch = "o"
            elif y < 47: ch = "O"
            elif y < 50: ch = ","
            else: ch = "."
            # 왼쪽 문설주가 드리운 그늘 띠(빛은 왼쪽 위)
            if _dist(x) == ho - 1 and x < 32 and y >= 47: ch = ","
            low[y][x] = ch
    if not closed:
        # 들어 올린 쇠창살: 4px 간격 세로살(j 빛·i 그늘), 30행 가로대, 34행 끝 가시
        for y in range(ARCH_TOP, 35):
            ho = arch_open_half(y)
            for x in range(W):
                if _dist(x) >= ho: continue
                k = (x - 18) % 4
                if y == 30: low[y][x] = "j" if k != 3 else "i"
                elif k == 1: low[y][x] = "j" if y < 34 else "i"
                elif k == 2 and y < 34: low[y][x] = "i"
    else:
        # 닫힌 문 두 짝: 세로 널 4px(a 빛·c 몸·e 틈), 쇠띠 둘(i·j 징), 가운데 맞닿음, 고리 둘
        for y in range(ARCH_TOP, 64):
            for x in range(W):
                if g[y][x] != "?": continue
                k = (x - 18) % 4
                ch = "a" if k == 0 else ("c" if k in (1, 2) else "e")
                if x == 31: ch = "e"
                if x == 32: ch = "n"
                if y in (35, 53): ch = "j" if k == 2 else "i"
                if y in (36, 54): ch = "n"
                if y >= 62: ch = "n"
                g[y][x] = ch
        for (x, y) in ((28, 44), (35, 44)):
            g[y][x] = "j"; g[y + 1][x - 1] = "i"; g[y + 1][x + 1] = "i"; g[y + 2][x] = "i"
        for y in range(ARCH_TOP, 64):
            ho = arch_open_half(y)
            for x in range(W):
                d = _dist(x)
                if d < ho and (d == ho - 1 and y < 40 or y == ARCH_TOP): g[y][x] = "n"
    # 횃불 두 개(문설주 바깥 마름돌, 쇠 받침)
    for tx in (8, 55):
        for (dx, dy, ch) in ((0, 0, "F"), (-1, 1, "f"), (0, 1, "F"), (1, 1, "f"), (0, 2, "f"), (0, 3, "i"), (-1, 4, "i"), (0, 4, "j"), (1, 4, "i"), (0, 5, "i"), (0, 6, "n")):
            g[42 + dy][tx + dx] = ch
    return rows_of(g), rows_of(low)


# 기와 4×4 모듈(민가 h101 앞 지붕과 같은 문법: 틈 g · 크림 k k · 주황 K / 붉은 몸 u U u 틈 g), 켜마다 2px 어긋난다.
ROOF_TILE = ["xuuv", "xuUv", "vuvx", "uuvx"]
ROOF_TILE_LIT = ["guUu", "guuU", "uUug", "Uuug"]      # 빛 받는 왼쪽 비탈
ROOF_TILE_DARK = ["qxvg", "qxgv", "gvxq", "vgxq"]     # 그늘진 오른쪽 비탈
# 망루 모임지붕: 꼭짓점 y4, 처마 y27. 행마다 (바깥 반폭, 앞 비탈 반폭) — 손으로 고른 줄 길이.
TOWER_ROOF_HW = [1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 16, 16]
TOWER_ROOF_HF = [0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
TOWER_ROOF_Y = 4


def tower():
    """작은 네모 망루 2×6 칸(32×96). 0~1행 = 버들항 민가 기와의 모임지붕, 2~5행 = 앞면(모서리 돌·아치 창·화살 구멍·굽도리).
    앞면이 성벽보다 한 칸 높아 성벽 위 통로 위로 솟는다."""
    W, H = 32, 96
    g = blank(W, H)
    for i, (hw, hf) in enumerate(zip(TOWER_ROOF_HW, TOWER_ROOF_HF)):
        y = TOWER_ROOF_Y + i
        for x in range(W):
            d = x - 16 if x >= 16 else 15 - x
            if d >= hw: continue
            row = (y - TOWER_ROOF_Y) % 4
            shift = 2 if ((y - TOWER_ROOF_Y) // 4) % 2 else 0
            col = (x + shift) % 4
            if d < hf: ch = ROOF_TILE[row][col]
            elif x < 16: ch = ROOF_TILE_LIT[row][col]
            else: ch = ROOF_TILE_DARK[row][col]
            if d == hw - 1: ch = "q"                              # 지붕 윤곽
            elif d == hf and hf > 0: ch = "U" if x < 16 else "q"  # 모서리 마루(왼쪽 빛, 오른쪽 그늘)
            g[y][x] = ch
    for (x, y, ch) in ((15, 0, "q"), (16, 0, "q"), (15, 1, "H"), (16, 1, "L"), (15, 2, "L"), (16, 2, "s"), (14, 2, "q"), (17, 2, "q"), (15, 3, "q"), (16, 3, "q")):
        g[y][x] = ch                                              # 꼭대기 돌 꼭지
    for x in range(W):
        g[28][x] = "x"; g[29][x] = "q"                            # 처마 그늘
    f = _face_block(2, 4, "bcab")
    for y in range(64):
        for x in range(32): g[32 + y][x] = f[y][x]
    for x in range(W):
        g[30][x] = "m"; g[31][x] = "L" if 0 < x < 31 else "o"     # 처마 밑 띠돌
    _quoins(g, 32, 88)
    _outline_sides(g, 30, 96)
    # 아치 창(위층): 손으로 쓴 글리프 — 돌 테(왼쪽 빛), 어두운 유리 대신 덧문 틈
    WIN = [
        "..mmmm..",
        ".mLHHsm.",
        "mLHooOsm",
        "mLooooSm",
        "mLooOoSm",
        "mLooooSm",
        "mLooOoSm",
        "mLooooSm",
        "mHHHHLLm",
        ".msssss.",
    ]
    stamp(g, WIN, 12, 36)
    # 화살 구멍(십자): 손으로 쓴 글리프
    SLIT = [
        "..mmm..",
        "..LoO..",
        "..LoO..",
        "mmLoOmm",
        "LoooooO",
        "mmLoOmm",
        "..LoO..",
        "..LoO..",
        "..LoO..",
        "..sss..",
    ]
    stamp(g, SLIT, 12, 60)
    # 망루는 성벽 앞으로 내민다: 그림 전체를 6px 내려(앞면 밑변이 성벽 굽도리보다 아래) 7번째 칸 줄에 밑동과 땅 그림자를 둔다.
    out = blank(W, H + 16)
    for y in range(H):
        out[y + TOWER_DROP] = g[y]
    for x in range(1, W):
        out[H + TOWER_DROP][x] = ","; 
        if x > 2: out[H + TOWER_DROP + 1][x] = ","
    return rows_of(out)


TOWER_DROP = 6


# 계단 16×32: 북쪽 성벽 안쪽 면에 붙여 성벽 위 통로로 오른다. 디딤판(빛) 3행 + 챌판(그늘) 2행 × 6단, 양 옆 돌 볼.
def stairs():
    """디딤판 3행(5 빛 / 4 / 4) + 챌판 2행(2 / 1), 맨 아래 단은 땅에 닿는 윤곽. 양 옆 볼 2px(L·s) + 윤곽."""
    g = blank(16, 32)
    step_rows = ["5", "4", "4", "2", "1"]     # 한 단 5행: 디딤판 빛(5)·몸(4) 두 행, 챌판 그늘(2)·밑 그림자(1)
    for y in range(32):
        k = (y - 2) % 5 if y >= 2 else None
        for x in range(16):
            if x == 0 or x == 15: g[y][x] = "o"; continue
            if x == 1: g[y][x] = "L"; continue
            if x == 2: g[y][x] = "B"; continue
            if x == 13: g[y][x] = "S"; continue
            if x == 14: g[y][x] = "s"; continue
            if y < 2: g[y][x] = "4" if y == 0 else "5"; continue
            ch = step_rows[k]
            if k == 0 and x == 3: ch = "H"
            if k == 0 and x == 12: ch = "4"
            if k in (3, 4) and x == 12: ch = "1"
            g[y][x] = ch
    for x in range(16): g[31][x] = "o"
    for x in range(1, 15): g[30][x] = "m" if x not in (1, 14) else g[30][x]
    return rows_of(g)


# ================================================================ 조각 목록
def _shade_left(g, n=3):
    for y in range(16):
        for x in range(n): darken(g, x, y, 2 if x < n - 1 else 1)
    return g


def _corner_merlon(g, corner):
    """오목 모서리 톱니: 앞(남) 흉벽 글리프와 옆 흉벽 글리프가 만나는 5×7(남쪽) 또는 5×6(북쪽) 덩이."""
    if corner in ("SE", "SW"):
        x0 = 11 if corner == "SE" else 0
        for y in range(7):
            for x in range(5):
                g[9 + y][x0 + x] = MERLON_FRONT[y][x] if MERLON_FRONT[y][x] != "#" else g[9 + y][x0 + x]
        # 톱니 발치 그늘(왼쪽 위 빛 — 톱니 오른쪽 아래로)
        xs = range(x0 - 2, x0) if corner == "SE" else range(5, 7)
        if corner == "SW":
            for y in range(9, 16): darken(g, 5, y, 1)
    else:
        x0 = 11 if corner == "NE" else 0
        for y in range(6):
            for x in range(5):
                ch = MERLON_BACK[y][x]
                if ch != ".": g[y][x0 + x] = ch
        for x in range(x0, x0 + 5): darken(g, x, 6, 2)
    return g


def _stair_head(g):
    """계단이 닿는 통로 앞 모서리: 가운데 12열은 가장자리 선을 끊고 계단 맨 윗단 빛을 이어 준다."""
    for x in range(2, 14):
        g[14][x] = FLAGS[14][x]; g[15][x] = "4"
    return g


# 세로 성벽 남쪽 끝 마감: 통로 앞 턱 빛줄(H)과 그 밑 줄눈(m)을 흉벽 띠까지 칸 폭 전체로 — 짧은 빛 토막이 남지 않게
_CAP_S = [(x, 14, "H") for x in range(1, 15)] + [(x, 15, "m") for x in range(1, 15)]


def _lip_under_bands(g, lipped):
    """┴ 갈림목: 가름벽 흉벽 띠(x0~4·x11~15) 밑에만 부모 통로의 북쪽 턱(0~2행)을 둔다 — 가름벽 통로(x5~10)는 부모 통로와 한 면으로 이어진다."""
    for y in range(3):
        for x in list(range(0, 5)) + list(range(11, 16)): g[y][x] = lipped[y][x]
    return g


def _cap_n(g):
    """세로 성벽 북쪽 끝 마감: 맨 윗줄 윤곽을 칸 폭 전체로, 흉벽 띠 윗면은 한 단 밝게(턱 빛)."""
    for x in range(1, 15): g[0][x] = "o"
    for x in range(1, 15):
        if g[1][x] == "L": g[1][x] = "H"
        elif g[1][x] == "B": g[1][x] = "L"
    return g


def _patch(g, pts):
    for (x, y, ch) in pts: g[y][x] = ch
    return g


def _bands_from(g, src, y0, y1):
    """세로 성벽 흉벽 띠(서 x0~4, 동 x11~15)를 src 칸에서 [y0,y1) 행만 옮겨 온다 — T 자 갈림목에서 가름벽 띠가 이어지게."""
    for y in range(y0, y1):
        for x in list(range(0, 6)) + list(range(11, 16)): g[y][x] = src[y][x]
    return g


def pieces():
    """(이름, 16×16 행, 통행 방향 문자열 U/D/L/R, ★ 여부, 층 'upper'|'lower', 설명) 목록 — 시트 꼬리에 이 순서로 놓는다."""
    out = []

    def T(name, g, passdirs, desc, star=False, layer="upper"):
        out.append(dict(name=name, rows=rows_of(g) if isinstance(g[0], list) else g, pass_=passdirs, star=star, layer=layer, desc=desc))

    # --- 가로 성벽 윗면(통로)
    T("hs", top_cell(N="D", S="P"), "LR", "남쪽 성벽 윗면 통로(바깥 앞면이 보인다, 앞 흉벽 톱니). 동서로 걷는다")
    T("hs_shL", _shade_left(top_cell(N="D", S="P")), "LR", "남쪽 성벽 윗면 — 왼쪽(서쪽)에 선 성문루·망루 그늘")
    T("hs_endW", top_cell(N="D", S="P", W="P"), "R", "남쪽 성벽 서쪽 끝(끝 흉벽)")
    T("hs_endE", top_cell(N="D", S="P", E="P"), "L", "남쪽 성벽 동쪽 끝(끝 흉벽)")
    T("hn", top_cell(N="P", S="D"), "LR", "북쪽 성벽 윗면 통로(안쪽 앞면이 보인다, 뒤 흉벽 톱니). 동서로 걷는다")
    T("hn_shL", _shade_left(top_cell(N="P", S="D")), "LR", "북쪽 성벽 윗면 — 왼쪽에 선 성문루·망루 그늘")
    T("hn_endW", top_cell(N="P", S="D", W="P"), "R", "북쪽 성벽 서쪽 끝")
    T("hn_endE", top_cell(N="P", S="D", E="P"), "L", "북쪽 성벽 동쪽 끝")
    T("hn_stair", _stair_head(top_cell(N="P", S="D")), "LRD", "북쪽 성벽 윗면 — 바로 아래 계단이 닿는 칸(남쪽으로 내려간다)")
    # --- 볼록 모서리(둘레 바깥 모서리)
    T("c_nw", _patch(top_cell(N="P", W="P"), [(15, 14, "H"), (15, 15, "o")]), "RD", "성벽 둘레 북서 모서리(바깥 모서리 톱니)")
    T("c_ne", _patch(top_cell(N="P", E="P"), [(0, 14, "H"), (0, 15, "o")]), "LD", "성벽 둘레 북동 모서리")
    T("c_sw", _patch(top_cell(W="P", S="P"), [(15, 0, "o")]), "RU", "성벽 둘레 남서 모서리")
    T("c_se", _patch(top_cell(E="P", S="P"), [(0, 0, "o")]), "LU", "성벽 둘레 남동 모서리")
    # --- 오목 모서리(둘레가 안으로 꺾인 곳 — 바깥이 꺾임 안쪽)
    T("cc_se", _corner_merlon(top_cell(N="D", W="D"), "SE"), "RD", "오목 모서리 ┌ (바깥이 남동 — 동쪽은 남쪽 성벽, 남쪽은 동쪽 성벽)")
    T("cc_sw", _corner_merlon(top_cell(N="D", E="D"), "SW"), "LD", "오목 모서리 ┐ (바깥이 남서)")
    T("cc_ne", _corner_merlon(top_cell(S="D", W="D"), "NE"), "RU", "오목 모서리 └ (바깥이 북동 — 동쪽은 북쪽 성벽, 북쪽은 동쪽 성벽)")
    T("cc_nw", _corner_merlon(top_cell(S="D", E="D"), "NW"), "LU", "오목 모서리 ┘ (바깥이 북서)")
    # --- T 자(가름벽이 갈라지는 곳)
    v2 = top_cell(W="P", E="P")
    T("t_n", top_cell(N="P"), "LRD", "┬ 북쪽 성벽에서 남쪽으로 가름벽(v2)이 갈라진다")
    T("t_s", _lip_under_bands(top_cell(S="P"), top_cell(N="D", S="P")), "LRU", "┴ 남쪽 성벽에서 북쪽으로 가름벽(v2)이 갈라진다")
    T("t_w", _patch(top_cell(W="P"), [(15, 0, "o")]), "UDR", "├ 서쪽 성벽에서 동쪽으로 가름벽(hs)이 갈라진다")
    T("t_e", _patch(top_cell(E="P"), [(0, 0, "o")]), "UDL", "┤ 동쪽 성벽에서 서쪽으로 가름벽(hs)이 갈라진다")
    # --- 세로 성벽(위에서 본 통로 + 바깥쪽 흉벽 띠)
    T("vw", top_cell(W="P", E="D"), "UD", "서쪽 성벽 윗면(서쪽 흉벽). 남북으로 걷는다")
    T("ve", top_cell(W="D", E="P"), "UD", "동쪽 성벽 윗면(동쪽 흉벽)")
    T("v2", top_cell(W="P", E="P"), "UD", "가름벽 세로(양쪽 흉벽)")
    T("vw_endN", _cap_n(top_cell(N="D", W="P", E="D")), "D", "서쪽 성벽 북쪽 끝")
    T("ve_endN", _cap_n(top_cell(N="D", W="D", E="P")), "D", "동쪽 성벽 북쪽 끝")
    T("v2_endN", _cap_n(top_cell(N="D", W="P", E="P")), "D", "가름벽 북쪽 끝")
    T("vw_endS", _patch(top_cell(S="D", W="P", E="D"), _CAP_S), "U", "서쪽 성벽 남쪽 끝(아래에 끝 앞면 f_*_col 두 칸)")
    T("ve_endS", _patch(top_cell(S="D", W="D", E="P"), _CAP_S), "U", "동쪽 성벽 남쪽 끝")
    T("v2_endS", _patch(top_cell(S="D", W="P", E="P"), _CAP_S), "U", "가름벽 남쪽 끝")
    # --- 앞면(막힘)
    for v in "abc":
        T(f"f_u_{v}", face_cell(False, v), "", f"성벽 앞면 위 칸(마름돌 두 켜, 변형 {v})")
    for v in "abc":
        T(f"f_l_{v}", face_cell(True, v), "", f"성벽 앞면 아래 칸(마름돌 한 켜 + 굽도리, 변형 {v})")
    T("f_u_endL", face_cell(False, "a", left="end"), "", "앞면 위 칸 — 왼쪽 끝(모서리 돌·윤곽)")
    T("f_l_endL", face_cell(True, "a", left="end"), "", "앞면 아래 칸 — 왼쪽 끝")
    T("f_u_endR", face_cell(False, "c", right="end"), "", "앞면 위 칸 — 오른쪽 끝")
    T("f_l_endR", face_cell(True, "c", right="end"), "", "앞면 아래 칸 — 오른쪽 끝")
    T("f_u_shL", face_cell(False, "b", left="shadow"), "", "앞면 위 칸 — 왼쪽에 선 세로 성벽·성문루·망루의 그늘")
    T("f_l_shL", face_cell(True, "b", left="shadow"), "", "앞면 아래 칸 — 왼쪽 그늘")
    T("f_u_abR", face_cell(False, "a", right="abut"), "", "앞면 위 칸 — 오른쪽에 세로 성벽이 맞닿음")
    T("f_l_abR", face_cell(True, "a", right="abut"), "", "앞면 아래 칸 — 오른쪽 맞닿음")
    T("f_u_col", face_cell(False, "a", left="end", right="end"), "", "세로 성벽 남쪽 끝 앞면 위 칸(양쪽 끝)")
    T("f_l_col", face_cell(True, "a", left="end", right="end"), "", "세로 성벽 남쪽 끝 앞면 아래 칸")
    # --- 계단(북쪽 성벽 안쪽 면에 붙임)
    st = stairs()
    T("stair_u", st[:16], "UD", "성벽 위로 오르는 계단 위 칸(북쪽 성벽 앞면 위 칸 자리)", layer="upper")
    T("stair_l", st[16:], "UD", "계단 아래 칸(앞면 아래 칸 자리, 땅에서 오른다)", layer="upper")
    # --- 성문루 4×4 (열림)
    up, low = gatehouse(False)
    upc, _lowc = gatehouse(True)

    def crop(rows, cx, cy): return [r[cx * 16:cx * 16 + 16] for r in rows[cy * 16:cy * 16 + 16]]

    def merge(a, b):   # b(아래층) 위에 a(위층)를 얹은 한 장
        return ["".join((ca if ca != "." else cb) for ca, cb in zip(ra, rb)) for ra, rb in zip(a, b)]
    for cy in range(4):
        for cx in range(4):
            u = crop(up, cx, cy); l = crop(low, cx, cy)
            passage = cx in (1, 2)
            if cy == 0:
                T(f"gate_{cx}_{cy}", u, "UD" if passage else "", "성문루 꼭대기" + (" — 통로 위(사람이 밑으로 지나간다, ★)" if passage else ""), star=passage)
            elif cy == 1 and passage:
                T(f"gate_{cx}_{cy}", u, "UD", "성문루 아치 머리(★, 통로가 비친다)", star=True)
            elif passage:
                T(f"gate_{cx}_{cy}", merge(u, l), "UD", "성문루 통로(열린 아치 안, 걸음)", layer="lower")
            else:
                T(f"gate_{cx}_{cy}", u, "", "성문루 앞면 기둥(막힘)")
    for cx in (1, 2):
        T(f"gate_floor_{cx}", [r[cx * 16:cx * 16 + 16] for r in _tunnel_floor(cx)], "UD", "성문루 꼭대기 밑 통로 바닥(아래층, 걸음)", layer="lower")
        T(f"gate_dark_{cx}", ["".join(ch if ch != "." else "o" for ch in r) for r in crop(low, cx, 1)], "UD", "성문루 아치 머리 밑 통로 어둠(아래층, 걸음)", layer="lower")
    for cy in (1, 2, 3):
        for cx in (1, 2):
            T(f"gatec_{cx}_{cy}", crop(upc, cx, cy), "", "닫힌 성문(널 문짝 두 짝, 막힘)", layer="lower" if cy > 1 else "upper")
    # --- 망루 2×7(성벽 앞으로 6px 내민다 — 7번째 줄은 밑동·그림자)
    tw = tower()
    for cy in range(7):
        for cx in range(2):
            T(f"tower_{cx}_{cy}", crop(tw, cx, cy), "", "네모 망루 " + ("기와 모임지붕" if cy < 2 else "앞면(화살 구멍·모서리 돌)"))
    return out


def _tunnel_floor(cx):
    """성문루 꼭대기 칸 밑 통로 바닥: 판석을 세 단 어둡게(지붕 밑 그늘)."""
    g = blank(64, 16)
    for y in range(16):
        for x in range(64):
            ch = FLAGS[y][x % 16]
            for _ in range(3): ch = DARKER.get(ch, ch)
            g[y][x] = ch
    return rows_of(g)
