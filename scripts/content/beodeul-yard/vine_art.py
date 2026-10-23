"""버들항 포도나무 줄(덕 없이 철사에 올린 포도 울타리) 손 도트 원본 — 16px 칸, 3/4 탑뷰, 버들항 시트에 이미 있는 색만.

한 칸 높이 가로 줄: 왼쪽 끝(끝 기둥) · 가운데 여럿(기둥은 몇 칸에 하나) · 오른쪽 끝(끝 기둥).
다진 흙 마당(beodeul_yard_dirt) 위에 위층으로 얹는다(투명 칸은 흙이 비친다). 줄 사이는 흙 한 칸 길.

칸 안 세로 구성(위 → 아래): 잎 덩이가 솟은 윗면(평면, 빛) → 어두운 앞면·아랫면(포도송이가 매달린다) →
아래 철사 한 줄과 굽은 포도 줄기 → 흙에 진 그늘. 빛은 왼쪽 위.

그림 원본은 손으로 고른 자리·글리프다(잎 덩이 글리프와 자리, 포도송이 자리, 줄기 자리, 윤곽 높이표).
덩이 한 개마다 왼쪽 위 빛 테 · 오른쪽 아래 그늘 테를 작은 규칙 함수가 입힌다(yard_art.py 의 돌과 같은 방식).
칸 경계(15열|0열)에 걸친 잎 덩이 하나는 모든 가운데 칸이 같다 — 그래서 어떤 순서로 이어 붙여도 이음새가 없고
경계마다 빈 띠가 생기지 않는다. 이미지 생성·트레이싱·사람·글자 없음.

  python3 vine_art.py check            # 팔레트(모든 색이 버들항 시트 앞 224행에 있는가) + 이음새 검사
  python3 vine_art.py preview OUT.png  # 4배 확인판
"""
import pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
PALETTE_ROWS = 224
T = 16

PAL = {
    # 잎 8단(버들항 덕·장원 덩굴·나무의 색, 서로 떨어진 단만): 빛 1 → 가장 짙음 8
    "1": "#a8ca5c", "2": "#8bb14e", "3": "#6f9a43", "4": "#4b8232",
    "5": "#366324", "6": "#264d2c", "7": "#143a27", "8": "#0c231a",
    # 포도송이 4단(버들항 덕·바구니의 포도) + 붉은 기
    "a": "#524cb1", "b": "#2e2b66", "c": "#1c1a45", "d": "#13122f", "r": "#a40100",
    # 나무(줄기·기둥) 6단
    "k": "#b77541", "l": "#885a26", "m": "#6f4725", "n": "#633712", "o": "#452a17", "p": "#2a1a0f",
    # 철사
    "w": "#90928f", "W": "#565755",
    # 흙 위 그늘(다진 흙 마당의 짙은 두 단)
    "E": "#4c3620", "F": "#70502e",
}


def rgba(ch):
    h = PAL[ch].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def img_of(rows):
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".": im.putpixel((x, y), rgba(ch))
    return im


# ---------------------------------------------------------------- 잎 덩이
# 한 덩이 = 위에서 본 윗면(빛 모자) + 앞으로 늘어진 앞면(그늘). 덩이마다 따로 왼쪽 위 빛 모자와, 다음 덩이 밑으로
# 파고드는 1px 짙은 홈을 갖는다. 덩이 안에는 손으로 찍은 작은 잎 송이(subs)가 결을 만든다.
EDGE_Y = 5            # 윗면 → 앞면 꺾이는 줄(덩이마다 ±1 은 top/bot 이 정한다)
SUB = {"c": [".#.", "###"], "o": ["##", "##"], "t": [".##.", "####"], "v": ["##."]}


def _blob(x0, x1, top, bot):
    """둥근 모서리 덩이 화소 집합: 위 두 줄·아래 한 줄은 양 끝을 깎는다."""
    pix = set()
    for y in range(top, bot + 1):
        cut = 2 if y == top else 1 if y == top + 1 or y == bot else 0
        for x in range(x0 + cut, x1 - cut + 1): pix.add((x, y))
    return pix


def _shade_blob(pix, top, bot, edge):
    xs = [x for x, _ in pix]
    x0, x1 = min(xs), max(xs)
    w = max(1, x1 - x0)
    out = {}
    for (x, y) in pix:
        u = (x - x0) / w
        up, dn, lf, rt = (x, y - 1) in pix, (x, y + 1) in pix, (x - 1, y) in pix, (x + 1, y) in pix
        if y < edge:                                    # 윗면: 빛 모자 → 몸 → 오른쪽 그늘
            if not up: k = "1" if u < 0.45 else "2"
            elif y == top + 1 and u < 0.6: k = "2"
            elif not rt: k = "4"
            else:   # 잎 결: 대각으로 기운 2px 잎 자국(밝은 2 · 짙은 4) — 칸 위치 x 에 묶여 칸 사이로 이어진다
                m = (x % T + 2 * y) % 6
                k = "2" if m == 0 and u < 0.7 else "4" if m == 3 and u > 0.25 else "3"
        elif y == edge: k = "4" if u < 0.3 else "5"     # 꺾이는 줄
        else:                                           # 앞면: 아래로 짙어지고, 잎 자국(5)이 성기게 비친다
            m = (x % T + 3 * y) % 7
            if not dn: k = "7"
            elif y == edge + 1: k = "5" if u < 0.5 else "6"
            else: k = "5" if m == 0 else "7" if m == 4 else "6"
        out[(x, y)] = k
    return out


SUB_RAMP = {"top": "1223", "front": "4555"}


def _sub(g, gl, sx, sy, zone, x_lo, x_hi):
    pix = {(sx + dx, sy + dy) for dy, r in enumerate(SUB[gl]) for dx, c in enumerate(r) if c == "#"}
    ramp = SUB_RAMP[zone]
    for (x, y) in pix:
        X, Y = x + 1, y + 1                         # 작은 송이 오른쪽 아래 그늘
        if zone == "front" and (X, Y) not in pix and x_lo <= X <= x_hi and 0 <= Y < T and g[Y][X] in "1234567": g[Y][X] = "7"
    for (x, y) in pix:
        if not (x_lo <= x <= x_hi and 0 <= y < T): continue
        up, lf, rt = (x, y - 1) in pix, (x - 1, y) in pix, (x + 1, y) in pix
        g[y][x] = ramp[0] if not up and not lf else ramp[1] if not up else ramp[3] if not rt else ramp[2]


# 경계(15열|0열)에 걸친 덩이: 모든 가운데 칸이 같다 → 어떤 순서로 이어도 이음새가 없다
SEAM = dict(x0=13, x1=18, top=1, bot=9, subs=[("o", 14, 2, "top"), ("v", 15, 7, "front")])

MID = {
    # clumps[(x0, x1, top, bot, subs)] 왼쪽부터 찍는다(오른쪽 덩이가 앞) · grapes[(x, y, 종류)] · trunk x|None · post x|None
    # wire: 앞면 밑 틈으로 보이는 철사 점 x · shade: 흙 그늘 길이(열마다 2~3)
    "m1": dict(clumps=[(2, 8, 0, 10, [("c", 3, 1, "top"), ("o", 5, 7, "front")]),
                       (7, 13, 2, 9, [("t", 8, 2, "top"), ("v", 9, 7, "front")])],
               grapes=[(5, 9, "L")], trunk=4, post=None, wire=[10, 11, 12], shade="2223332222223222"),
    "m2": dict(clumps=[(1, 6, 1, 9, [("o", 2, 2, "top")]),
                       (5, 13, 0, 10, [("t", 6, 1, "top"), ("c", 10, 2, "top"), ("o", 7, 7, "front")])],
               grapes=[(2, 9, "S"), (11, 10, "B")], trunk=None, post=9, wire=[3, 4], shade="2233222222333222"),
    "m3": dict(clumps=[(2, 9, 1, 9, [("t", 3, 1, "top"), ("v", 3, 7, "front")]),
                       (8, 13, 0, 11, [("c", 9, 1, "top"), ("o", 10, 7, "front")])],
               grapes=[(5, 9, "B")], trunk=11, post=None, wire=[2, 3, 7], shade="2222233222222322"),
    "m4": dict(clumps=[(1, 7, 0, 10, [("c", 2, 1, "top"), ("o", 4, 6, "front")]),
                       (6, 10, 2, 9, [("o", 7, 3, "top")]),
                       (9, 13, 1, 10, [("v", 10, 2, "top"), ("v", 10, 7, "front")])],
               grapes=[(7, 9, "L"), (12, 10, "S")], trunk=None, post=None, wire=[1, 2, 5], shade="3222222223322222"),
    "m5": dict(clumps=[(1, 8, 1, 10, [("t", 2, 2, "top"), ("o", 4, 7, "front")]),
                       (7, 13, 0, 9, [("c", 8, 1, "top"), ("o", 10, 3, "top")])],
               grapes=[(9, 9, "B")], trunk=12, post=5, wire=[1, 2, 11], shade="2222222223332222"),
    "m6": dict(clumps=[(2, 7, 0, 9, [("o", 3, 1, "top")]),
                       (6, 13, 1, 11, [("t", 7, 2, "top"), ("c", 10, 1, "top"), ("v", 8, 8, "front")])],
               grapes=[(3, 9, "S"), (11, 10, "L")], trunk=7, post=None, wire=[2, 3, 4], shade="2222233222222322"),
}

GRAPE = {   # 포도송이(아래로 좁아지는 세모): 빛 a · 몸 b · 그늘 c · 가장 짙음 d
    "L": ["abbc", "abbc", ".bc.", ".cd.", "..d."],
    "B": ["abc", "abc", ".cd", ".d."],
    "S": ["ab", "bc", ".d"],
}


def render(spec, left=None, right=None):
    """spec 하나 → 행 문자열 16개. left/right = 끝 칸에서 잎이 시작·끝나는 열(그 바깥은 비운다)."""
    g = [["."] * T for _ in range(T)]
    x_lo = 0 if left is None else left
    x_hi = T - 1 if right is None else right
    shade = [int(c) for c in spec["shade"]]
    clumps = []
    if left is None: clumps.append((SEAM["x0"] - T, SEAM["x1"] - T, SEAM["top"], SEAM["bot"], [(gl, x - T, y, z) for gl, x, y, z in SEAM["subs"]]))
    clumps += list(spec["clumps"])
    if right is None: clumps.append((SEAM["x0"], SEAM["x1"], SEAM["top"], SEAM["bot"], SEAM["subs"]))
    # 잎 밑 끝(열마다) — 그늘·철사·줄기 자리를 정한다
    bottom = {}
    for (x0, x1, top, bot, _s) in clumps:
        for (x, y) in _blob(x0, x1, top, bot):
            bottom[x] = max(bottom.get(x, -1), y)
    # 1) 흙 그늘: 잎 밑 끝 아래, 오른쪽으로 한 칸 밀려 진다 — E 두 줄, F 한 줄
    for x in range(x_lo - 1, x_hi + 1):
        if x not in bottom: continue
        X = x + 1
        if not (0 <= X <= (T - 1 if right is None else x_hi + 1)): continue
        sd = shade[x] if 0 <= x < T else 2
        for k in range(sd):
            y = bottom[x] + 1 + k
            if y < T: g[y][X] = "E" if k < 2 else "F"
    # 2) 줄기(칸에 하나 이하): 잎 밑에서 땅까지, 13행에서 한 번 꺾인다
    tx = spec.get("trunk")
    if tx is not None and x_lo <= tx and tx + 1 <= x_hi:
        for y in range(bottom.get(tx, 10), T):
            X = tx + (1 if y >= 13 and tx % 2 else 0)
            if X + 1 > x_hi: continue
            if y < 15: g[y][X], g[y][X + 1] = ("k" if y == 12 else "l"), "n"
            else: g[y][X], g[y][X + 1] = "m", "o"
        root = tx + (1 if tx % 2 else 0)
        if x_lo <= root - 1 and g[15][root - 1] in ".EF": g[15][root - 1] = "o"
    # 3) 잎 덩이(왼쪽부터, 오른쪽이 앞) — 앞 덩이 왼쪽 가장자리에 1px 짙은 홈(뒤 덩이 밑으로 파고든다)
    for (x0, x1, top, bot, subs) in clumps:
        pix = _blob(x0, x1, top, bot)
        for (x, y), ch in _shade_blob(pix, top, bot, EDGE_Y).items():
            if x_lo <= x <= x_hi: g[y][x] = ch
        nx = x0 - 1
        if x_lo <= nx <= x_hi:
            for y in range(top + 1, min(top + 3, EDGE_Y)):     # 홈은 윗면 위쪽 두 줄만(길게 그으면 덩이가 따로 선 포기처럼 갈라진다)
                if g[y][nx] in "1234567": g[y][nx] = "4" if y == top + 1 else "5"
        for gl, sx, sy, zone in subs: _sub(g, gl, sx, sy, zone, x_lo, x_hi)
    # 4) 철사: 잎 밑 틈으로 보이는 점
    for x in spec["wire"]:
        y = bottom.get(x, 9) + 1
        if x_lo <= x <= x_hi and y < T and g[y][x] in ".EF": g[y][x] = "W"
    # 5) 중간 기둥: 잎 위로 빛 머리 두 줄, 잎 밑에서 땅까지
    p = spec.get("post")
    if p is not None:
        g[0][p], g[0][p + 1] = "k", "k"
        g[1][p], g[1][p + 1] = "k", "l"
        for y in range(max(bottom.get(p, 9), bottom.get(p + 1, 9)) + 1, T): g[y][p], g[y][p + 1] = ("l", "n") if y < 15 else ("m", "o")
    # 6) 포도송이(앞면 밑에서 매달린다) + 꼭지
    for gx, gy, kind in spec["grapes"]:
        for dy, r in enumerate(GRAPE[kind]):
            for dx, c in enumerate(r):
                X, Y = gx + dx, gy + dy
                if c != "." and x_lo <= X <= x_hi and Y < T: g[Y][X] = c
        if g[gy - 1][gx + 1] in "567": g[gy - 1][gx + 1] = "8"
    return ["".join(r) for r in g]


# 끝 칸: 끝 기둥(굵게, 땅까지, 빛 머리) + 둥근 끝 덩이 + 기둥 머리에서 땅 말뚝으로 내려가는 비스듬한 버팀 철사
LEFT = dict(clumps=[(5, 10, 1, 9, [("o", 6, 2, "top")]), (9, 13, 0, 10, [("c", 10, 1, "top"), ("v", 10, 7, "front")])],
            grapes=[(7, 9, "B")], trunk=None, post=None, wire=[6], shade="0000022232222222")
RIGHT = dict(clumps=[(2, 7, 0, 10, [("t", 3, 1, "top"), ("o", 4, 7, "front")]), (6, 10, 2, 9, [("o", 7, 3, "top")])],
             grapes=[(4, 9, "L")], trunk=None, post=None, wire=[1, 9], shade="2223322222000000")


def end_tile(spec, side):
    if side == "L":
        rows = [list(r) for r in render(spec, left=5)]
        px = 3
        brace = [(2, 2), (2, 3), (2, 4), (1, 5), (1, 6), (1, 7), (1, 8), (0, 9), (0, 10)]
        stake = 0
    else:
        rows = [list(r) for r in render(spec, right=10)]
        px = 11
        brace = [(13, 2), (13, 3), (13, 4), (14, 5), (14, 6), (14, 7), (14, 8), (15, 9), (15, 10)]
        stake = 15
    # 끝 기둥: 빛 머리 → 몸(왼 빛 l · 오른 그늘 n) → 밑동, 기둥 아래 오른쪽 그늘
    rows[0][px], rows[0][px + 1] = "k", "k"
    rows[1][px], rows[1][px + 1] = "k", "l"
    for y in range(2, 15): rows[y][px], rows[y][px + 1] = "l", "n"
    rows[15][px], rows[15][px + 1] = "m", "o"
    for y in (12, 13, 14):
        if px + 2 < T and rows[y][px + 2] in ".F": rows[y][px + 2] = "E" if y < 14 else "F"
    # 버팀 철사(위는 밝은 w, 아래로 갈수록 그늘 W) + 땅 말뚝
    for i, (x, y) in enumerate(brace): rows[y][x] = "w" if i < 5 else "W"
    rows[11][stake], rows[12][stake], rows[13][stake] = "k", "l", "m"
    rows[14][stake] = "E"
    return ["".join(r) for r in rows]


ORDER = ["left", "m1", "m2", "m3", "m4", "m5", "m6", "right"]
ROLE_OF = {"left": "left", "right": "right", "m1": "mid", "m2": "mid-post", "m3": "mid", "m4": "mid", "m5": "mid-post", "m6": "mid"}


def tiles():
    out = {"left": end_tile(LEFT, "L"), "right": end_tile(RIGHT, "R")}
    for k, s in MID.items(): out[k] = render(s)
    return out


def palette_check():
    sh = Image.open(SHEET_PATH).convert("RGBA")
    crop = sh.crop((0, 0, sh.width, PALETTE_ROWS * T))
    seen = {p for _, p in crop.getcolors(1 << 24) if p[3] == 255}
    missing = [(k, v) for k, v in PAL.items() if rgba(k) not in seen]
    used = {ch for rows in tiles().values() for r in rows for ch in r} - {"."}
    unknown = sorted(used - set(PAL))
    if unknown: missing.append(("unknown letters", unknown))
    return not missing, missing


def seam_check():
    """가운데·끝 칸 오른쪽 15열과 이웃 0열이 같은 모양(투명/잎/나무)인가 — 줄이 끊기지 않는다."""
    t = tiles()
    cls = lambda c: "." if c == "." else "L" if c in "12345678" else "o"
    bad = []
    lefts = ["left"] + list(MID); rights = list(MID) + ["right"]
    for a in lefts:
        ca = [cls(r[15]) for r in t[a]]
        for b in rights:
            cb = [cls(r[0]) for r in t[b]]
            diff = sum(1 for p, q in zip(ca, cb) if p != q)
            if diff > 2: bad.append((a, b, diff))
    return bad


def row_strip(n_mid, seed=0):
    names = list(MID)
    seq = ["left"]
    since = 0
    for i in range(n_mid):
        h = (i * 2654435761 + seed * 40503) & 0xFFFF
        posts = [k for k in names if MID[k].get("post") is not None]
        plain = [k for k in names if MID[k].get("post") is None]
        if since >= 2 and h % 3 != 0: k = posts[h % len(posts)]; since = 0
        else: k = plain[(h >> 3) % len(plain)]; since += 1
        if seq[-1] == k: k = plain[((h >> 3) + 1) % len(plain)]
        seq.append(k)
    return seq + ["right"]


def preview(out):
    t = tiles()
    im = Image.new("RGBA", (len(ORDER) * 18, 18 + 3 * 16), (40, 40, 44, 255))
    for i, k in enumerate(ORDER): im.alpha_composite(img_of(t[k]), (i * 18, 0))
    for r, n in enumerate((6, 3, 4)):
        for i, k in enumerate(row_strip(n, r)): im.alpha_composite(img_of(t[k]), (i * 16, 18 + r * 16))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        ok, miss = palette_check(); bad = seam_check()
        print("palette:", "OK" if ok else miss, "| seams:", bad or "OK")
        sys.exit(0 if ok and not bad else 1)
    elif cmd == "preview":
        preview(sys.argv[2]); print("->", sys.argv[2])


# ---------------------------------------------------------------- 표본: 다진 흙 마당 위 세 줄(길이 다름) + 낱 조각
DIRT_BODY = [29589 + i for i in range(8)]     # beodeul_yard_dirt 몸통 + 변형 일곱(bake_yard tid('dirt', body..body8))


def _cell(sh, t):
    return sh.crop(((t % 128) * T, (t // 128) * T, (t % 128) * T + T, (t // 128) * T + T))


def _h(x, y):
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return n ^ (n >> 16)


def sample(rows_spec=((1, 1, 8, 0), (1, 3, 5, 1), (3, 5, 6, 2)), W=13, H=7, singles=True):
    """rows_spec: (x, y, 가운데 칸 수, 씨앗). 바닥은 다진 흙 마당 몸통(시트에서), 줄 사이 흙 한 칸 길."""
    sh = Image.open(SHEET_PATH).convert("RGBA")
    t = tiles()
    extra = 2 if singles else 0
    im = Image.new("RGBA", (W * T, (H + extra) * T))
    for y in range(H + extra):
        for x in range(W): im.paste(_cell(sh, DIRT_BODY[_h(x, y) % 8]), (x * T, y * T))
    for (x0, y0, n, seed) in rows_spec:
        for i, k in enumerate(row_strip(n, seed)): im.alpha_composite(img_of(t[k]), ((x0 + i) * T, y0 * T))
    if singles:   # 맨 아래: 가장 짧은 줄(왼쪽 끝 + 오른쪽 끝) 하나, 그 옆에 가운데 여섯을 차례로 이은 줄
        im.alpha_composite(img_of(t["left"]), (1 * T, (H + 1) * T)); im.alpha_composite(img_of(t["right"]), (2 * T, (H + 1) * T))
        for i, k in enumerate(["left"] + list(MID) + ["right"]): im.alpha_composite(img_of(t[k]), ((4 + i) * T, (H + 1) * T))
    return im
