"""버들항 포도나무 줄(철사에 올린 포도 울타리) 손 도트 원본 — 16px 칸, 3/4 탑뷰, 버들항 시트에 이미 있는 색만.

2판(두 칸 높이). 한 줄 = 위 칸 줄(잎 지붕 윗면) + 아래 칸 줄(말린 잎 턱·앞면·포도·줄기·기둥·흙 그늘).
가로로는 왼쪽 끝 · 가운데 여럿(중간 기둥 있는 것·없는 것) · 오른쪽 끝. 위 칸 k 밑에는 반드시 같은 이름의 아래 칸 k 를 둔다.

세로 구성(두 칸 32줄, 빛은 왼쪽 위):
  0~15  윗면(plane): 위에서 내려다본 넓고 밝은 잎 지붕. 낮게 솟은 큰 잎 덩이가 뒤(위) 가장자리를 울퉁불퉁하게 만들고,
        면 안은 대비가 낮은 잎 결(빛 P·몸 2·그늘 3). 뒤가 밝고 앞으로 갈수록 한 단 어두워진다.
  15~21 말린 턱(lip): 윗면이 앞으로 꺾이는 자리. 버들항 나무처럼 대비가 큰 둥근 덩이(빛 1 → 그늘 4)가 칸 경계를 넘어
        늘어지고, 그 밑에 짙은 홈(6)이 들쭉날쭉하게 진다.
  20~25 앞면(face): 한 단 어두운 잎(4·5, 그늘 덩이 머리 3) + 밑 끝 잎 끝, 높이가 다른 포도송이(반짝 화소 h)가 턱 밑에 매달린다.
  25~31 굵은 줄기(3px, 칸마다 자리·기울기 다름, 없는 칸도 있다) · 중간 기둥(머리가 잎 지붕 위로 솟음) · 오른쪽 아래로 진 흙 그늘.

그림 원본은 손으로 고른 덩이 자리(cx, cy, rx, ry)·포도·줄기·기둥 자리다. 덩이 하나의 명암은 작은 규칙 함수가
버들항 나무 결대로 입힌다(빛 무늬는 2×2 묶음). 칸 경계(15열|0열)에 걸친 덩이(윗면·턱·앞면 하나씩)는 모든 가운데 칸이
같다 — 그래서 어떤 순서로 이어 붙여도 이음새가 없다. 이미지 생성·트레이싱·사람·글자 없음.

  python3 vine_art.py check            # 팔레트(모든 색이 버들항 시트 앞 224행에 있는가) + 이음새 검사
  python3 vine_art.py preview OUT.png  # 4배 확인판
"""
import math, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
PALETTE_ROWS = 224
T = 16
H2 = 2 * T            # 두 칸 높이 띠(0~15 윗면 칸, 16~31 앞면 칸)

PAL = {
    # 잎(버들항 풀·나무 색): 빛 1 · 윗면 밝은 결 P · 몸 2 · 그늘 3 · 짙음 4 · 더 짙음 5 · 홈·윤곽 6
    "1": "#a8ca5c", "P": "#8bb14e", "2": "#6e9943", "3": "#4c7337", "4": "#264d2c", "5": "#143a27", "6": "#0c2222",
    # 포도송이: 반짝 h · 빛 a · 몸 b · 그늘 c · 가장 짙음 d
    "h": "#8a94b0", "a": "#5a54be", "b": "#464198", "c": "#322f78", "d": "#13122f",
    # 나무(줄기·기둥) 6단
    "k": "#b77541", "l": "#885a26", "m": "#6f4725", "n": "#633712", "o": "#452a17", "p": "#2a1a0f",
    # 철사
    "w": "#90928f", "W": "#565755",
    # 흙 위 그늘(다진 흙 마당의 짙은 두 단)
    "E": "#4c3620", "F": "#70502e",
}
LEAF = "1P23456"


def rgba(ch):
    h = PAL[ch].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def img_of(rows):
    im = Image.new("RGBA", (T, len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".": im.putpixel((x, y), rgba(ch))
    return im


def _h(*a):
    n = 0x9E3779B1
    for v in a: n = ((n ^ (v & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF; n ^= n >> 13
    return n


# ---------------------------------------------------------------- 잎 덩이
def clump_pixels(cx, cy, rx, ry, seed):
    """둥근 덩이 화소 → 상대 좌표(u, v). 가장자리는 잎 끝처럼 몇 화소 깎는다(덩이 기준 좌표의 해시라 덩이를 16px 옮겨도 같다)."""
    ox = math.floor(cx)
    out = {}
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            r = u * u + v * v
            if r > 1: continue
            if r > 0.72 and v > -0.6 and _h(x - ox, y, seed) % 4 == 0: continue
            out[(x, y)] = (u, v)
    return out


def shade_clump(pix, seed, ox, mode):
    """mode: lip = 버들항 나무 결(빛 1 · 몸 2 · 그늘 3·4) / plane = 윗면의 낮은 대비(가장자리 1 · P · 2 · 3) / face = 앞면 그늘 덩이(3 · 4 · 5)."""
    out = {}
    for (x, y), (u, v) in pix.items():
        up, dn, rt = (x, y - 1) in pix, (x, y + 1) in pix, (x + 1, y) in pix
        lit = -0.6 * u - 0.8 * v + (0.30 - 0.035 * y if mode == "plane" else 0.0)
        n = (_h((x - ox) // 2, y // 2, seed) % 100) / 100 - 0.5
        t = lit + n * 0.45
        if not up: k = "1" if u < -0.05 and t > -0.2 else "2"
        elif t > 0.62: k = "1"
        elif t > -0.08: k = "2"
        elif t > -0.5: k = "3"
        else: k = "4"
        if not dn: k = "4" if k in "123" else "5"
        elif not rt and k in "12": k = "3"
        out[(x, y)] = k
    for (x, y), k in list(out.items()):      # 잎 자국: 몸(2) 위 성긴 빛 잎(1)과 그 오른쪽 아래 그늘(3)
        if k == "2" and _h(x - ox, y, seed, 9) % 9 == 0 and out.get((x + 1, y + 1)) == "2":
            out[(x, y)] = "1"; out[(x + 1, y + 1)] = "3"
        elif k == "3" and _h(x - ox, y, seed, 4) % 7 == 0 and out.get((x, y - 1)) == "3":
            out[(x, y)] = "2"
    if mode == "plane":
        edge = {p for p in out if (p[0], p[1] - 1) not in pix}
        out = {p: ("1" if p in edge and k == "1" else {"1": "P", "2": "2", "3": "3", "4": "3", "5": "3"}[k]) for p, k in out.items()}
    elif mode == "face":
        out = {p: {"1": "3", "2": "3", "3": "4", "4": "5", "5": "5"}[k] for p, k in out.items()}
    return out


def _draw_clumps(g, clumps, x_lo, x_hi, clip_lo, clip_hi, mode):
    """뒤(위)부터 앞(아래)으로. 앞 덩이 윗변 바로 위의 뒤 덩이 화소에 홈을 판다(윗면 3, 턱·앞면 5).
    안쪽 덩이(씨앗 20~)는 이어지는 경계 쪽 0·1(14·15)열에 닿지 않는다 — 그 두 열은 경계 덩이 몫."""
    groove = "3" if mode == "plane" else "5"
    for (cx, cy, rx, ry, seed) in sorted(clumps, key=lambda c: (c[1], c[0])):
        pix = clump_pixels(cx, cy, rx, ry, seed)
        if seed >= 20: pix = {k: v for k, v in pix.items() if clip_lo <= k[0] <= clip_hi}
        sh = shade_clump(pix, seed, math.floor(cx), mode)
        for (x, y), k in sh.items():
            if not (x_lo <= x <= x_hi and 0 <= y < H2): continue
            if (x, y - 1) not in pix and 0 <= y - 1 and g[y - 1][x] in LEAF and g[y - 1][x] not in "56": g[y - 1][x] = groove
        for (x, y), k in sh.items():
            if x_lo <= x <= x_hi and 0 <= y < H2: g[y][x] = k


# 칸 경계(15|0)에 걸친 덩이 — 모든 가운데 칸이 같다
SEAM = {"plane": [(16.0, 3.6, 3.8, 3.0, 11), (15.8, 10.8, 3.0, 2.8, 12)],
        "lip": [(15.6, 17.8, 3.2, 3.0, 13)],
        "face": [(16.2, 22.8, 2.4, 2.0, 14)]}
FACE_BOTTOM = 25       # 앞면 밑 끝 기본값(가운데 칸 0·1·14·15열과 12·13열은 늘 이 값 — 그늘이 경계를 넘는다)
WIRE_Y = 25

MID = {
    # plane/lip/face[(cx, cy, rx, ry)] · grapes[(x, 종류, 높이 어긋남)] 턱 밑에서 매달림 · trunk(x, 기울기)|None · post x|None
    # drip{x: 밑 끝}(x ≤ 11) · tips[x] 밑 끝에 늘어진 잎 끝 한 화소
    "m1": dict(plane=[(5.0, 3.2, 3.6, 2.8), (10.4, 4.4, 3.0, 2.8), (7.6, 10.0, 4.4, 3.4)],
               lip=[(4.4, 16.8, 3.4, 3.4), (8.8, 19.2, 2.2, 2.4), (11.4, 17.6, 2.4, 2.8)], face=[(7.2, 22.8, 2.4, 2.0)],
               grapes=[(3, "L", -2), (10, "X", 0)], trunk=(6, 1), post=None, drip={5: 26, 6: 26}, tips=[9, 12]),
    "m2": dict(plane=[(4.0, 4.0, 2.8, 2.6), (9.6, 2.8, 3.8, 2.6), (5.0, 9.6, 3.4, 3.0), (11.0, 11.0, 2.6, 2.8)],
               lip=[(5.6, 18.6, 4.2, 2.8), (11.4, 16.8, 2.4, 3.2)], face=[(3.8, 22.6, 2.0, 2.0), (11.4, 22.8, 2.2, 2.0)],
               grapes=[(3, "B", 1)], trunk=None, post=7, drip={}, tips=[5, 11]),
    "m3": dict(plane=[(7.4, 3.6, 4.6, 2.8), (3.6, 8.6, 2.6, 3.0), (9.8, 10.4, 3.6, 3.4)],
               lip=[(3.6, 19.0, 1.8, 2.4), (7.4, 17.2, 3.6, 3.4), (12.0, 19.0, 2.0, 2.4)], face=[(10.4, 22.4, 2.6, 2.2)],
               grapes=[(3, "X", -1), (9, "S", 1)], trunk=(11, -1), post=None, drip={8: 24, 9: 24}, tips=[7]),
    "m4": dict(plane=[(4.0, 3.8, 2.8, 2.8), (8.8, 3.0, 3.4, 2.6), (6.8, 9.4, 4.0, 3.2), (12.0, 8.0, 2.0, 2.6)],
               lip=[(4.2, 17.2, 2.8, 3.2), (9.0, 18.8, 3.4, 2.6), (12.4, 17.0, 1.8, 2.6)], face=[(5.6, 22.6, 2.4, 2.0)],
               grapes=[(7, "L", -2), (11, "S", 0)], trunk=(2, 0), post=None, drip={7: 26}, tips=[10, 13]),
    "m5": dict(plane=[(8.0, 3.4, 4.4, 2.8), (4.0, 7.8, 2.6, 3.0), (10.4, 10.6, 3.6, 3.2)],
               lip=[(4.0, 18.8, 2.6, 2.6), (9.2, 16.8, 3.6, 3.4)], face=[(9.6, 22.8, 2.4, 2.0)],
               grapes=[(2, "S", 0), (10, "X", -1)], trunk=None, post=5, drip={2: 24, 3: 24}, tips=[9]),
    "m6": dict(plane=[(4.8, 2.8, 3.4, 2.4), (10.4, 4.4, 3.4, 2.8), (6.4, 10.6, 3.6, 3.2)],
               lip=[(7.8, 18.4, 4.6, 3.0), (3.2, 17.0, 1.8, 2.8)], face=[(4.2, 22.4, 2.2, 2.2), (10.6, 22.8, 2.6, 2.0)],
               grapes=[(5, "L", -1), (11, "B", 1)], trunk=None, post=None, drip={}, tips=[3, 9]),
}

GRAPE = {   # 턱 밑에서 매달린 송이(위가 넓고 아래로 좁다): h 반짝(왼쪽 위) · a 빛 · b 몸 · c 그늘 · d 끝
    "X": ["hab..", "aabbc", "abbcd", ".bbc.", ".cd..", "..d.."],
    "L": ["hab.", "abbc", "abcd", ".bc.", ".d.."],
    "B": ["hab", "abc", ".cd", ".d."],
    "S": ["ha", "bc", "d."],
}


def render(spec, left=None, right=None, under=None, lip_reach=0):
    """spec → 32줄 행 문자열(0~15 윗면 칸, 16~31 앞면 칸). left/right = 끝 칸에서 잎이 시작·끝나는 열.
    under(g) = 잎보다 먼저 그릴 것(끝 기둥). lip_reach = 끝 칸에서 턱 덩이만 바깥으로 더 늘어지는 열 수(기둥을 덮는다)."""
    g = [["."] * T for _ in range(H2)]
    x_lo = 0 if left is None else left
    x_hi = T - 1 if right is None else right
    layers = {}
    for j, part in enumerate(("plane", "lip", "face")):
        cl = [(cx, cy, rx, ry, 20 + 10 * j + i) for i, (cx, cy, rx, ry) in enumerate(spec.get(part, []))]
        if left is None: cl += [(cx - T, cy, rx, ry, s) for cx, cy, rx, ry, s in SEAM[part]]
        if right is None: cl += list(SEAM[part])
        layers[part] = cl
    clip = (2 if left is None else 0, T - 3 if right is None else T - 1)
    drip = spec.get("drip", {})
    bottom = {x: drip.get(x, FACE_BOTTOM) for x in range(x_lo, x_hi + 1)}
    for side, x0, step in (("L", x_lo, 1), ("R", x_hi, -1)):
        if (side == "L" and left is None) or (side == "R" and right is None): continue
        for i, dz in enumerate((4, 2, 1)): bottom[x0 + step * i] -= dz
    # 1) 흙 그늘: 잎 밑 끝 아래, 오른쪽 아래로 두~세 칸 밀려 진다(o 한 줄 → E 두 줄 → F 성기게)
    sb = dict(bottom)
    if left is None:
        for x in (-3, -2, -1): sb[x] = FACE_BOTTOM      # 왼쪽 이웃 칸(12~15열은 늘 기본값)의 그늘이 넘어온다
    for x, b in sorted(sb.items()):
        for X in (x + 2, x + 3):
            if X < 0 or X >= T or (right is not None and X > x_hi + 3): continue
            for k in range(5):
                y = b + 1 + k
                if y >= H2: continue
                if k == 0: g[y][X] = "o"
                elif k < 3: g[y][X] = "E"
                elif k == 3 or _h(X, y, 61) % 3 == 0: g[y][X] = "F"
    if under: under(g)
    # 2) 잎 바탕: 윗면은 밝은 결(2 · P · 3, 뒤가 밝고 앞이 어둡다), 턱 아래 앞면은 5·4
    for x in range(x_lo, x_hi + 1):
        for y in range(3, bottom[x] + 1):
            if y < 18:
                m = _h(x, y, 3) % 9
                g[y][x] = "P" if m < (3 if y < 8 else 1) else "3" if m >= (8 if y < 8 else 6) else "2"
            else: g[y][x] = "5" if _h(x, y, 7) % 4 else "4"
    # 3) 윗면 덩이 → 앞면 그늘 덩이 → 턱 덩이(앞면 위로 늘어진다) → 턱 밑 짙은 홈
    _draw_clumps(g, layers["plane"], x_lo, x_hi, *clip, "plane")
    _draw_clumps(g, layers["face"], x_lo, x_hi, *clip, "face")
    lip_bottom = {}
    for (cx, cy, rx, ry, seed) in layers["lip"]:
        for (x, y) in clump_pixels(cx, cy, rx, ry, seed):
            if seed < 20 or clip[0] <= x <= clip[1]: lip_bottom[x] = max(lip_bottom.get(x, -1), y)
    lx_lo = x_lo - (lip_reach if left is not None else 0)
    lx_hi = x_hi + (lip_reach if right is not None else 0)
    _draw_clumps(g, layers["lip"], lx_lo, lx_hi, *clip, "lip")
    for x, y in lip_bottom.items():
        if x_lo <= x <= x_hi and y + 1 < bottom.get(x, 0) and g[y + 1][x] in LEAF: g[y + 1][x] = "6"
    # 4) 앞면 밑 끝: 윤곽 6, 그 위 한 줄은 4 이하, 밑 끝 아래 잎은 지운다, 잎 끝(tips) 한 화소가 늘어진다
    for x in range(x_lo, x_hi + 1):
        b = bottom[x]
        if g[b][x] in LEAF: g[b][x] = "6"
        if g[b - 1][x] in "1P23": g[b - 1][x] = "4"
        for y in range(b + 1, H2):
            if g[y][x] in LEAF: g[y][x] = "."
    for x in spec.get("tips", []):
        if x_lo <= x <= x_hi: g[bottom[x] + 1][x] = "5"; g[bottom[x]][x] = "4"
    # 4b) 끝 칸 바깥 다섯 열은 위에서 보아 둥글게: 바깥일수록 잎이 늦게 시작한다
    if left is not None or right is not None:
        for x in range(x_lo, x_hi + 1):
            d = min(x - x_lo if left is not None else 99, x_hi - x if right is not None else 99)
            y0 = {0: 11, 1: 6, 2: 3, 3: 2, 4: 1}.get(d)
            if y0 is None: continue
            for y in range(0, y0):
                if g[y][x] in LEAF: g[y][x] = "."
            if g[y0][x] in LEAF: g[y0][x] = "1" if left is not None else "3"
    # 5) 줄기(굵게 3px, 칸마다 자리·기울기가 다르다): 잎 밑에서 땅까지, 28줄에서 한 번 꺾이고 밑동이 퍼진다
    if spec.get("trunk"):
        tx, lean = spec["trunk"]
        for y in range(bottom[tx] + 1, H2):
            X = tx + (lean if y >= 28 else 0)
            g[y][X], g[y][X + 1], g[y][X + 2] = ("l" if y in (27, 29) else "m"), "n", "o"
        bx = tx + lean
        if bx - 1 >= x_lo: g[H2 - 1][bx - 1] = "o"
        if bx + 3 <= x_hi: g[H2 - 1][bx + 3] = "p"
        g[bottom[tx] + 1][tx - 1] = "o"; g[bottom[tx] + 1][tx + 3] = "o"   # 잎 속으로 갈라져 들어가는 가지
    # 6) 중간 기둥(3px 다듬은 나무, 줄기보다 밝다): 머리가 잎 지붕 위로 솟아 잎 속으로 들어가고, 잎 밑에서 땅까지 보인다 + 철사
    p = spec.get("post")
    if p is not None:
        g[0][p:p + 3] = list("kkl"); g[1][p:p + 3] = list("kln"); g[2][p:p + 3] = list("lln")
        g[3][p] = "3"; g[3][p + 1] = "n"; g[3][p + 2] = "4"
        for y in range(bottom[p] + 1, H2):
            g[y][p], g[y][p + 1], g[y][p + 2] = ("k", "l", "n") if y < H2 - 1 else ("l", "n", "o")
        for X in (p - 2, p - 1, p + 3, p + 4):
            if x_lo <= X <= x_hi and g[bottom[X] + 1][X] in ".oEF": g[bottom[X] + 1][X] = "w" if X in (p - 1, p + 3) else "W"
    # 7) 턱 밑에서 매달린 포도송이(높이가 송이마다 다르다) + 꼭지
    for gx, kind, dy0 in spec.get("grapes", []):
        gy = bottom[gx] - 3 + dy0
        for dy, r in enumerate(GRAPE[kind]):
            for dx, c in enumerate(r):
                if c != "." and x_lo <= gx + dx <= x_hi and gy + dy < H2: g[gy + dy][gx + dx] = c
        if g[gy - 1][gx + 1] in LEAF: g[gy - 1][gx + 1] = "6"
    return ["".join(r) for r in g]


# 끝 칸: 굵은 끝 기둥(빛 머리가 잎 지붕 위로 솟는다, 턱 덩이가 기둥 위로 늘어진다) + 둥글게 물러나는 끝 덩이
LEFT = dict(plane=[(9.6, 3.8, 3.4, 2.8), (8.8, 10.0, 3.4, 3.2), (12.6, 8.6, 2.0, 2.6)],
            lip=[(6.2, 17.6, 3.0, 2.8), (11.2, 18.6, 2.6, 2.8)], face=[(8.4, 22.6, 2.4, 2.0)],
            grapes=[(8, "B", 0)], trunk=None, post=None, drip={}, tips=[11])
RIGHT = dict(plane=[(6.2, 3.6, 3.6, 2.8), (3.4, 8.4, 2.2, 2.8), (7.0, 10.4, 3.2, 3.2)],
             lip=[(4.4, 18.4, 3.0, 3.0), (9.8, 17.6, 3.0, 2.8)], face=[(6.4, 22.8, 2.2, 2.0)],
             grapes=[(4, "L", -1)], trunk=None, post=None, drip={}, tips=[2])


def end_tile(spec, side):
    """끝 기둥 3px: 빛 머리(위에서 본 나뭇결 두 줄) → 몸(왼 빛 k · l · 오른 그늘 n) → 밑동. 잎보다 먼저 그려 턱 덩이가 덮는다."""
    px = 2 if side == "L" else 11

    def post(g):
        g[0][px:px + 3] = list("kkl"); g[1][px:px + 3] = list("lln")
        for y in range(2, H2 - 1): g[y][px:px + 3] = list("kln") if y % 7 else list("lln")
        g[H2 - 1][px:px + 3] = list("mno")
        for i, y in enumerate(range(H2 - 4, H2)):     # 기둥 그늘(오른쪽 아래)
            for X in (px + 3, px + 4):
                if X < T and g[y][X] in ".F": g[y][X] = "o" if X == px + 3 and i < 2 else "E"
    rows = render(spec, left=5, under=post, lip_reach=2) if side == "L" else render(spec, right=10, under=post, lip_reach=2)
    rows = [list(r) for r in rows]
    for y in (0, 1):                                   # 기둥 머리는 늘 잎 위로 솟는다
        rows[y][px:px + 3] = list("kkl") if y == 0 else list("lln")
    return ["".join(r) for r in rows]


ORDER = ["left", "m1", "m2", "m3", "m4", "m5", "m6", "right"]
ROLE_OF = {"left": "left", "right": "right", "m1": "mid", "m2": "mid-post", "m3": "mid", "m4": "mid", "m5": "mid-post", "m6": "mid"}
PARTS = ["top", "front"]   # 위 칸 줄(잎 지붕 윗면) · 아래 칸 줄(앞면·줄기·그늘)


def strips():
    out = {"left": end_tile(LEFT, "L"), "right": end_tile(RIGHT, "R")}
    for k, s in MID.items(): out[k] = render(s)
    return out


def tiles():
    """(이름, 'top'|'front') → 16줄 행 문자열."""
    out = {}
    for k, rows in strips().items():
        out[(k, "top")] = rows[:T]
        out[(k, "front")] = rows[T:]
    return out


def palette_check():
    sh = Image.open(SHEET_PATH).convert("RGBA")
    crop = sh.crop((0, 0, sh.width, PALETTE_ROWS * T))
    seen = {p for _, p in crop.getcolors(1 << 24) if p[3] == 255}
    missing = [(k, v) for k, v in PAL.items() if rgba(k) not in seen]
    used = {ch for rows in strips().values() for r in rows for ch in r} - {"."}
    unknown = sorted(used - set(PAL))
    if unknown: missing.append(("unknown letters", unknown))
    return not missing, missing


def seam_check():
    """가운데 칸 15열은 모두 같고 0열도 모두 같다(경계 덩이 공유) + 끝 칸의 안쪽 경계가 가운데와 같다."""
    s = strips()
    bad = []
    c15 = {k: [r[15] for r in s[k]] for k in ["left"] + list(MID)}
    c0 = {k: [r[0] for r in s[k]] for k in list(MID) + ["right"]}
    ref15, ref0 = c15["m1"], c0["m1"]
    for k, v in c15.items():
        d = sum(1 for p, q in zip(v, ref15) if p != q)
        if d: bad.append((k, "col15", d))
    for k, v in c0.items():
        d = sum(1 for p, q in zip(v, ref0) if p != q)
        if d: bad.append((k, "col0", d))
    return bad


def row_strip(n_mid, seed=0):
    names = list(MID)
    posts = [k for k in names if MID[k].get("post") is not None]
    plain = [k for k in names if MID[k].get("post") is None]
    seq = ["left"]
    since = 0
    for i in range(n_mid):
        h = (i * 2654435761 + seed * 40503) & 0xFFFF
        if since >= 2 and h % 3 != 0: k = posts[h % len(posts)]; since = 0
        else: k = plain[(h >> 3) % len(plain)]; since += 1
        if seq[-1] == k: k = plain[((h >> 3) + 1) % len(plain)]
        seq.append(k)
    return seq + ["right"]


def strip_img(name):
    return img_of(strips()[name])


def preview(out):
    im = Image.new("RGBA", (len(ORDER) * 18, 34 + 3 * 32), (40, 40, 44, 255))
    for i, k in enumerate(ORDER): im.alpha_composite(strip_img(k), (i * 18, 0))
    for r, n in enumerate((6, 3, 4)):
        for i, k in enumerate(row_strip(n, r)): im.alpha_composite(strip_img(k), (i * 16, 34 + r * 32))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out)


# ---------------------------------------------------------------- 표본: 다진 흙 마당 위 세 줄(길이 다름) + 낱 조각
DIRT_BODY = [29589 + i for i in range(8)]     # beodeul_yard_dirt 몸통 + 변형 일곱(bake_yard tid('dirt', body..body8))


def _cell(sh, t):
    return sh.crop(((t % 128) * T, (t // 128) * T, (t % 128) * T + T, (t // 128) * T + T))


def _hh(x, y):
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return n ^ (n >> 16)


def sample(rows_spec=((1, 1, 8, 0), (1, 4, 5, 1), (3, 7, 6, 2)), W=13, H=10, singles=True):
    """rows_spec: (x, y, 가운데 칸 수, 씨앗) — y 는 위 칸 줄. 줄 하나는 두 칸 높이, 줄 사이 흙 한 칸 길."""
    sh = Image.open(SHEET_PATH).convert("RGBA")
    extra = 4 if singles else 0
    im = Image.new("RGBA", (W * T, (H + extra) * T))
    for y in range(H + extra):
        for x in range(W): im.paste(_cell(sh, DIRT_BODY[_hh(x, y) % 8]), (x * T, y * T))
    for (x0, y0, n, seed) in rows_spec:
        for i, k in enumerate(row_strip(n, seed)): im.alpha_composite(strip_img(k), ((x0 + i) * T, y0 * T))
    if singles:   # 맨 아래: 가장 짧은 줄(왼쪽 끝 + 오른쪽 끝), 그 옆에 가운데 여섯을 차례로 이은 줄
        im.alpha_composite(strip_img("left"), (1 * T, (H + 1) * T)); im.alpha_composite(strip_img("right"), (2 * T, (H + 1) * T))
        for i, k in enumerate(ORDER): im.alpha_composite(strip_img(k), ((4 + i) * T, (H + 1) * T))
    return im


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        ok, miss = palette_check(); bad = seam_check()
        print("palette:", "OK" if ok else miss, "| seams:", bad or "OK")
        sys.exit(0 if ok and not bad else 1)
    elif cmd == "preview":
        preview(sys.argv[2]); print("->", sys.argv[2])
    elif cmd == "sample":
        im = sample(); im.save(sys.argv[2])
        for s in (2, 4): im.resize((im.width * s, im.height * s), Image.NEAREST).save(sys.argv[2].replace(".png", f"_{s}x.png"))
        print("->", sys.argv[2])
