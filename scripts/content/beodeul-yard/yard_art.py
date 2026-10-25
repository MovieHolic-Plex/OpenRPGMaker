"""버들항 마당 바닥 손 도트 원본 — 16px 칸, 3/4 탑뷰, 버들항 시트(앞 224행)에 실제로 있는 색만.

세 마당 바닥 — 각각 경작지(farmland)와 같은 8이웃 오토타일 14역할 + 몸통 변형 3:
  cobble  시골 작업 마당 강자갈(버들항 거리 포석보다 둥글고 따뜻하고 불규칙) — 시장·대장간·광산 마당
  dirt    다진 흙 마당(다진 흙, 희미한 바퀴 자국·발자국, 잔돌, 지푸라기) — 광산·포도밭·농가 마당
  flag    판석 뜰(크고 불규칙한 옅은 석회암 판석, 줄눈 이끼, 금 간·내려앉은 판석) — 신전 폐허 뜰

그림 원본은 손으로 쓴 행 문자열이다: 자갈은 손으로 고른 자리에 찍은 둥근 돌 글리프, 판석은 손으로 그린 판석 배치도,
흙은 손으로 쓴 16×16 행. 돌·판석 한 장마다 왼쪽 위 빛 테·오른쪽 아래 그늘 테, 줄눈은 돌 아래 그늘(버들항 문법)을
작은 규칙 함수가 입힌다(농장 3판 farm_art.py 와 같은 방식). 가장자리는 손으로 고른 흔들리는 테 높이표(16 주기)와
손으로 고른 풀 포기 글리프·자리로 만든다. 이미지 생성·트레이싱·사람·글자 없음. 빛은 왼쪽 위, 그림자는 오른쪽 아래.

  python3 yard_art.py preview OUT.png     # 4배 확인판(모든 칸 + 표면마다 표본 덩이)
  python3 yard_art.py gate DIR            # 3/4 관문용 표본 PNG(표면마다 하나) + DIR/items.jsonl
  python3 yard_art.py compare OUT.png     # 3배 비교판(버들항 길·광장·모랫길 옆, 쓰임 조각을 얹어)
  python3 yard_art.py check               # 팔레트 검사(모든 색이 버들항 시트 앞 224행에 있는가) + 이음새 검사
"""
import json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
PALETTE_ROWS = 224          # 버들항 시트에서 색을 뽑는 범위(앞 224행 = 28672칸)
T = 16

PAL = {
    # 잔디(버들항 737 칸의 네 톤) + 그늘·풀잎
    "1": "#618c3b", "2": "#6e9943", "3": "#7aa34b", "4": "#84ab52",
    "5": "#4c7337", "6": "#426a2e", "7": "#8bb14e", "8": "#94b353", "9": "#3a582e",
    # 자갈 돌 세 가족, 가족마다 6단(빛 → 그늘): 황갈 / 회 / 갈
    "w": "#e2d6c0", "t": "#d2c6b0", "u": "#b89c7e", "v": "#967a60", "g": "#786248", "n": "#5e4c38",
    "W": "#c4c6c3", "G": "#a8aaa7", "H": "#929491", "I": "#777579", "F": "#6d6863", "U": "#54504e",
    "o": "#b49c78", "B": "#988472", "C": "#816a56", "D": "#6e5b49", "V": "#574234", "Y": "#45382a",
    # 자갈 줄눈: 돌 아래 그늘 J · 줄눈 j · 넓은 틈의 모래흙 k
    "J": "#2e241c", "j": "#45382a", "k": "#5e4c38",
    # 연석(다듬은 돌 테): 윗면 K L · 그늘 M · 앞면 N O · 줄눈 P
    "K": "#d2c6b0", "L": "#bcbbb1", "M": "#99968c", "N": "#7c7a73", "O": "#54504e", "P": "#3e403d",
    # 다진 흙 7단: 빛 l · 밝음 i · 따뜻한 몸 m · 몸 h · 그늘 0 · 짙음 f · 가장 짙음 e — 지푸라기 s S · 잔돌 q p r R
    "l": "#c89a66", "i": "#ae7c50", "m": "#946a38", "h": "#8a5e3c", "0": "#7e4a34", "f": "#70502e", "e": "#4c3620",
    "s": "#e8cc74", "S": "#c8aa46", "q": "#c4c6c3", "p": "#90928f", "r": "#777579", "R": "#565755",
    # 판석 세 가족 6단: 옅은 석회암 / 따뜻한 판 / 내려앉은 판
    "x": "#f2ead8", "y": "#e2d6c0", "z": "#d9d2be", "%": "#cfccc0", "Z": "#c8c5ba", "X": "#9f9a8d",
    "c": "#ece2c4", "&": "#d8caa8", "d": "#d2c6b0", "b": "#c4b492", "*": "#b49c78", "+": "#988472",
    "=": "#bcbbb1", "?": "#7c7a73",
    # 판석 줄눈: 판 아래 그늘 Q · 줄눈 @ · 깊은 틈 T — 이끼 a A E
    "Q": "#686048", "@": "#86827f", "T": "#4a4332", "a": "#676b46", "A": "#7c8438", "E": "#93a34c",
}


def rgba(ch):
    h = PAL[ch].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def img_of(rows):
    w = len(rows[0])
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    im = Image.new("RGBA", (w, len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r): im.putpixel((x, y), rgba(ch))
    return im


def rows_of(g): return ["".join(r) for r in g]


# ================================================================ 잔디 = 버들항 737 칸 그대로(검사: palette_check 가 시트와 대조)
GRASS = [
    "1122222232222222",
    "2223222222222222",
    "2222222212112322",
    "1221242221112222",
    "2121231222122121",
    "2122211222112121",
    "2111212222211121",
    "1222211222222221",
    "2121222222223232",
    "2222122223223223",
    "3332222222334223",
    "2222223222233222",
    "2222322222321222",
    "2222223232332222",
    "2222222233222222",
    "2222222222222222",
]

# ================================================================ 자갈(강자갈) 몸통
# 둥근 돌 글리프. 칸 경계를 넘는 돌(감김)은 네 변형이 모두 같다 — 그래야 어떤 배열로 이어 붙여도 이음새가 없다.
GLYPH = {
    "R64": [".####.", "######", "######", ".####."],
    "R65": [".####.", "######", "######", "######", ".####."],
    "R54": [".###.", "#####", "#####", ".###."],
    "R55": [".###.", "#####", "#####", "#####", ".###."],
    "R44": [".##.", "####", "####", ".##."],
    "R45": [".##.", "####", "####", "####", ".##."],
    "R43": [".##.", "####", ".##."],
    "R53": [".###.", "#####", ".###."],
    "R34": [".#.", "###", "###", ".#."],
    "R33": [".#.", "###", ".#."],
    "P22": ["##", "##"],
    "P32": ["###", ".##"],
    "P21": ["##"],
    "R75": [".#####.", "#######", "#######", "#######", ".#####."],
    "R56": [".###.", "#####", "#####", "#####", "#####", ".###."],
    "R66": [".####.", "######", "######", "######", "######", ".####."],
    "R76": [".#####.", "#######", "#######", "#######", "#######", ".#####."],
    "R86": [".######.", "########", "########", "########", "########", ".######."],
    "R87": ["..####..", ".######.", "########", "########", "########", ".######.", "..####.."],
    "R97": ["..#####..", ".#######.", "#########", "#########", "#########", ".#######.", "..#####.."],
}
FAM = {   # 돌 한 가족: 빛 → 그늘 6단(버들항 문법: 윗테 가장 밝게, 왼테 빛, 안쪽 세 단, 오른테·아랫테 그늘)
    "t": "wtuvgn",
    "g": "WGHIFU",
    "b": "oBCDVY",
}


def shade_unit(pix, ramp, sunk=False, flat=False):
    """돌·판석 한 장(감김을 푼 화소 집합)을 6단으로 칠한다 → {(x, y): 글자}.
    윗테 0단 · 왼테 1단 · 안쪽은 왼쪽 위 → 오른쪽 아래로 2·3·4단 · 오른테 4단 · 아랫테 5단."""
    xs = [x for x, _ in pix]; ys = [y for _, y in pix]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    out = {}
    for (x, y) in pix:
        up, lf, dn, rt = (x, y - 1) in pix, (x - 1, y) in pix, (x, y + 1) in pix, (x + 1, y) in pix
        if flat:   # 판석: 윗면이 평평하다 — 테만 빛·그늘, 안쪽은 두 단(왼쪽 위 2 · 오른쪽 아래 3)
            if not dn: k = 3
            elif not up: k = 0
            elif not rt: k = 2
            elif not lf: k = 1
            else: k = 1 if ((x - x0) / w + (y - y0) / h) / 2 < 0.3 else 2
        elif not dn: k = 5
        elif not up: k = 0
        elif not rt: k = 4
        elif not lf: k = 1
        else:
            u = ((x - x0) / w + (y - y0) / h) / 2
            k = 2 if u < 0.45 else 3 if u < 0.72 else 4
        if sunk and flat: k = {0: 4, 1: 3, 2: 2, 3: 1}[k]            # 내려앉은 판석: 윗테에 앞 판의 그늘, 아랫테에 빛
        elif sunk: k = {0: 5, 1: 4, 5: 1, 4: 2}.get(k, k)     # 내려앉은 돌: 윗테·왼테에 그늘, 아랫테에 빛     # 내려앉은 판: 윗테·왼테에 그늘, 아랫테에 빛
        out[(x, y)] = ramp[k]
    return out


# 테두리를 넘는 돌(모든 변형 공통) — 왼쪽 위 기준 자리(감김).
COB_EDGE = [("P22", 15, 15, "t")]   # 칸 경계를 넘는 돌은 네 칸이 만나는 모서리의 작은 돌 하나뿐 — 나머지 경계(15행·15열)는 흙 줄눈
# 변형마다 다른 안쪽 돌(칸의 3/4). 손으로 고른 자리 — 줄지어 서지 않게 크기·높이를 엇갈렸다(돌끼리 닿지 않게 _place 가 검사한다).
COB_INNER = {   # 칸마다 통째로 든 돌(경계를 넘지 않는다): 큰 강자갈(6~9px) 몇에 중간 돌, 틈에 잔돌. 변형 여덟이 크기·자리를 엇갈린다
    "body": [("R87", 0, 0, "t"), ("R54", 9, 0, "g"), ("R44", 9, 5, "b"), ("R65", 1, 8, "b"), ("P21", 13, 5, "g"), ("R54", 9, 11, "t"), ("P22", 8, 9, "b"), ("P22", 13, 9, "b"), ("P22", 6, 13, "b"), ("P21", 1, 14, "t"), ("P21", 0, 7, "t"), ("P21", 6, 7, "t"), ("P21", 7, 0, "t")],
    "body2": [("R65", 1, 1, "g"), ("R76", 8, 0, "t"), ("R54", 0, 8, "t"), ("R87", 6, 7, "b"), ("P22", 13, 13, "g"), ("R43", 3, 12, "g"), ("P21", 13, 7, "t"), ("P21", 0, 13, "t"), ("P21", 4, 7, "t"), ("P21", 6, 6, "t"), ("P21", 6, 0, "t"), ("P21", 0, 6, "t")],
    "body3": [("R54", 1, 0, "b"), ("R65", 7, 1, "g"), ("R76", 0, 6, "t"), ("R54", 9, 8, "b"), ("R43", 5, 12, "g"), ("P21", 13, 5, "t"), ("P22", 11, 13, "b"), ("P22", 2, 13, "b"), ("P21", 6, 0, "t"), ("P21", 13, 12, "t"), ("P21", 8, 7, "t"), ("P21", 13, 7, "t"), ("P21", 12, 0, "t"), ("P21", 0, 4, "t")],
    "body4": [("R97", 0, 1, "g"), ("R54", 10, 0, "t"), ("R44", 11, 5, "b"), ("R65", 1, 9, "t"), ("R65", 8, 10, "g"), ("P22", 8, 7, "b"), ("P21", 0, 8, "t"), ("P21", 6, 14, "t"), ("P21", 8, 0, "t")],
    "body5": [("R44", 0, 1, "t"), ("R87", 5, 0, "b"), ("R65", 0, 7, "g"), ("R54", 8, 8, "t"), ("R43", 11, 12, "b"), ("P21", 13, 5, "g"), ("R44", 5, 11, "b"), ("P22", 1, 13, "b"), ("P22", 13, 7, "b"), ("P21", 12, 0, "t"), ("P21", 3, 5, "t"), ("P21", 3, 0, "t"), ("P21", 9, 14, "t")],
    "body6": [("R76", 1, 0, "b"), ("R44", 9, 1, "t"), ("R65", 9, 6, "g"), ("R87", 0, 7, "t"), ("P22", 12, 13, "b"), ("R43", 7, 12, "g"), ("P21", 0, 6, "t"), ("P21", 12, 0, "t"), ("P21", 8, 5, "t"), ("P21", 8, 0, "t"), ("P21", 13, 4, "t")],
    "body7": [("R65", 0, 1, "t"), ("R54", 7, 0, "b"), ("R43", 11, 3, "g"), ("R87", 5, 5, "g"), ("R54", 0, 9, "b"), ("P21", 12, 13, "t"), ("R43", 4, 12, "g"), ("P22", 9, 13, "b"), ("P22", 13, 10, "b"), ("P21", 0, 7, "t"), ("P21", 2, 14, "t"), ("P21", 12, 0, "t"), ("P21", 5, 0, "t")],
    "body8": [("R54", 0, 1, "g"), ("R97", 6, 1, "t"), ("R44", 1, 6, "b"), ("R65", 3, 10, "g"), ("R54", 10, 9, "b"), ("P22", 5, 0, "b"), ("P22", 0, 12, "b"), ("P21", 13, 14, "t"), ("P21", 8, 9, "t"), ("P21", 9, 14, "t"), ("P21", 6, 8, "t"), ("P21", 0, 10, "t")],
}

def _place(stones):
    g = [[-1] * T for _ in range(T)]
    errs = []
    for i, (gl, x, y, _fam) in enumerate(stones):
        for dy, r in enumerate(GLYPH[gl]):
            for dx, c in enumerate(r):
                if c != "#": continue
                X, Y = (x + dx) % T, (y + dy) % T
                if g[Y][X] >= 0: errs.append(("overlap", i, g[Y][X], X, Y))
                g[Y][X] = i
    for Y in range(T):
        for X in range(T):
            a = g[Y][X]
            if a < 0: continue
            for dx, dy in ((1, 0), (0, 1)):
                b = g[(Y + dy) % T][(X + dx) % T]
                if b >= 0 and b != a: errs.append(("touch", a, b, X, Y))
    return g, errs


def cobble_body(name):
    stones = COB_EDGE + COB_INNER[name]
    g, errs = _place(stones)
    assert not errs, (name, errs[:6])
    out = [["j"] * T for _ in range(T)]
    at = lambda X, Y: g[Y % T][X % T]
    for gl, x, y, fam in stones:
        pix = {(x + dx, y + dy) for dy, r in enumerate(GLYPH[gl]) for dx, c in enumerate(r) if c == "#"}
        for (X, Y), ch in shade_unit(pix, FAM[fam]).items(): out[Y % T][X % T] = ch
    for Y in range(T):
        for X in range(T):
            if at(X, Y) >= 0: continue
            if at(X, Y - 1) >= 0 or at(X - 1, Y) >= 0 or at(X - 1, Y - 1) >= 0: out[Y][X] = "J"     # 돌 아래·오른쪽 = 그늘 줄눈
            else: out[Y][X] = "j"     # 나머지 틈 = 흙 줄눈(넓은 틈에 모래 점을 찍지 않는다 — 네 돌 사이마다 같은 + 무늬가 찍혀 보였다)
    return rows_of(out)


# ================================================================ 다진 흙 몸통
# 결(모든 변형 공통, 감겨 이어진다): 몸 h 에 따뜻한 m · 그늘 0 · 짙은 f · 밝은 i 점을 손으로 흩었다. 같은 색이 네 칸 넘게 줄짓지 않게.
DIRT_GRAIN = [
    "hmhh0hhmfhhmh0ih",
    "0hhmhh0hhhihmhfh",
    "hhfhm0hhihh0hhhm",
    "himh0hhm0hfhmihh",
    "h0hhfhmhihhmh0hh",
    "mhh0hhihhm0hhfh0",
    "0fhhm0hhhfhmihmh",
    "hhihhhm0fhh0hh0m",
    "h0mh0fhhhmihhmhf",
    "mhhmhhih0hhhfh0h",
    "ihfh0mhhhm0hhmhh",
    "hhm0hhhf0ihh0mih",
    "h0hhmihmh0hmhfhm",
    "hhfhh0hhmhhihh0h",
    "0mhihhmhf0hhmhhh",
    "hhh0mfhihhm0hfhi",
]
# 변형마다 손으로 그린 덧그림('.' = 결 그대로): 흙덩이(위 l·i, 아래 f·e), 바퀴 자국, 발자국, 잔돌, 지푸라기. 테두리 줄은 비운다.
DIRT_OVER = {
    "body": ["." * 16] * 16,   # 가장자리·모서리 칸 13가지가 모두 이 몸통을 쓰므로 결만 둔다 — 덧그림이 16px 마다 줄짓지 않게
    "body2": [   # 결과 같은 색(0·m)으로 흐린 옅은 자국 · 흙덩이 · 지푸라기
        "................",
        "................",
        ".........lli....",
        "........lihhf...",
        ".........ffe....",
        "................",
        "..0m0...........",
        "....m00m0.......",
        "........m00m....",
        "...........m0...",
        "................",
        "................",
        "..li............",
        ".lihf.......s...",
        "..fe.........S..",
        "................",
    ],
    "body3": [   # 발자국 한 쌍(앞꿈치 + 뒤꿈치) · 큰 흙덩이 · 잔돌 무리
        "................",
        "................",
        "................",
        "....ff..........",
        "...feef.........",
        "...lfel....lli..",
        "....ll....lihhf.",
        "...........ffee.",
        "................",
        "................",
        "..q.............",
        ".prf.q......0...",
        "..ffprf....000..",
        ".....ff.........",
        "................",
        "................",
    ],
    "body4": [   # 흩어진 지푸라기 · 흙덩이 · 얕게 꺼진 자리
        "................",
        "................",
        "...........s....",
        "..0.........Ss..",
        ".000............",
        "................",
        "......lli.......",
        ".....lihhf......",
        "......ffee......",
        "................",
        "..s.............",
        "...Ss.......li..",
        ".....S.....lihf.",
        "............fe..",
        "................",
        "................",
    ],
    "body5": [   # 잔돌 무리 · 작은 흙덩이
        "................",
        "................",
        "................",
        ".........q......",
        "........prf.q...",
        ".........ffprf..",
        "............ff..",
        "................",
        "................",
        "................",
        "...li...........",
        "..lihf..........",
        "...ffe..........",
        "................",
        "................",
        "................",
    ],
    "body6": [   # 길쭉한 큰 흙덩이 하나
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "....llli........",
        "...lihhhf.......",
        "....fffee.......",
        "................",
        "................",
        "...........0....",
        "................",
        "................",
        "................",
        "................",
    ],
    "body7": [   # 지푸라기 몇 올 · 얕게 꺼진 자리
        "................",
        "................",
        "......s.........",
        ".......Ss.......",
        "................",
        "................",
        "................",
        "............0...",
        "...........000..",
        "............0...",
        "................",
        "................",
        "..s.............",
        "...S............",
        "................",
        "................",
    ],
    "body8": [   # 흙덩이 둘(크기가 다르다)
        "................",
        "................",
        "..........li....",
        ".........lihf...",
        "..........fe....",
        "................",
        "................",
        "................",
        "................",
        "..lli...........",
        ".lihhf..........",
        "..ffee..........",
        "................",
        "................",
        "................",
        "................",
    ],
}

GRAIN_SHIFT = {"body": (0, 0), "body2": (5, 3), "body3": (9, 11), "body4": (13, 6), "body5": (2, 9), "body6": (11, 2), "body7": (7, 13), "body8": (14, 10)}   # 변형마다 결을 감아 돌려 같은 무늬가 16px 마다 되풀이되지 않게


GRAIN_SOFT = str.maketrans({"i": "h", "f": "0"})   # 결은 가까운 세 단(h m 0)만 — 밝은 i·짙은 f 는 손으로 그린 흙덩이에만 써서 덩이가 읽히게


def _grain(n):
    dx, dy = GRAIN_SHIFT[n]
    return ["".join(DIRT_GRAIN[(y + dy) % T][(x + dx) % T] for x in range(T)).translate(GRAIN_SOFT) for y in range(T)]


DIRT = {n: ["".join(o if o != "." else g for g, o in zip(gr, ov)) for gr, ov in zip(_grain(n), DIRT_OVER[n])] for n in DIRT_OVER}


# ================================================================ 판석 몸통
# 판석 배치도(손으로 그림): 글자 = 판석 한 장, '.' = 줄눈. 칸 경계를 넘는 판석은 셋뿐이다 — 네 칸이 만나는 모서리 판 r(4×4),
# 위아래 칸에 걸친 좁은 판 q(4×4), 좌우 칸에 걸친 판 p(4×3) — 경계 판이 좁아야 16px 마다 가로·세로 줄이 생기지 않는다. 이 셋과 15행·15열의 줄눈은 모든 변형이 같다(SLAB_FIXED 가 검사한다).
# 나머지(칸의 3/4)는 변형마다 다른 큰 판석 — 그래서 같은 몸통이 16px 마다 되풀이돼 보이지 않는다.
# 들쭉날쭉한 큰 판석 여덟 벌 — 손으로 찍은 씨앗 자리(판석 한가운데)마다 가까운 화소를 모아 1px 줄눈으로 가른 뒤 행 문자열로 굳혔다.
# 판석은 칸 안에 통째로 든다(경계를 넘는 판석 없음). 칸 사이 줄눈은 BORDER_V·BORDER_H 길을 따라 15열과 이웃 칸 0열 사이를 오가며 꺾인다 — 곧은 격자선이 16px 마다 보이지 않게. 두 칸 넘게 넓은 줄눈은 flag_body 가 이끼로 칠한다.
SLABS_1 = [
    "aaaa......bbb...",
    "aaaaaa.bbbbbbbb.",
    "aaaaaa.bbbbbbbb.",
    ".aaaaa.bbbbbbb..",
    ".aaaaa...bbb..cc",
    ".aaa..dd....cccc",
    "....ddddd.cccccc",
    ".e.dddddd.cccccc",
    ".e..ddddd.ccccc.",
    "eee..ddd...cccc.",
    "eeee.dd.ff..ccc.",
    ".eee...ffff...c.",
    ".eeee.fffffff...",
    ".eeee.ffffffffff",
    ".eee..ffffffffff",
    "......fff.....f.",
]
SLABS_2 = [
    "aaaa......bbb...",
    "aaaaaaaaa.bbbbb.",
    "aaaaaaaaa.bbbbb.",
    "....aaaa.bbbbbb.",
    ".cc..a....bbbbbb",
    ".ccc..ddd..bbbbb",
    ".ccc.ddddd..bbbb",
    ".ccc.dddddd.b..b",
    ".ccc.dddddd..ff.",
    "cccc.dddddd.fff.",
    "c......ddd.ffff.",
    ".eeeee..d.fffff.",
    ".eeeeee..fffffff",
    ".eeeeeee.fffffff",
    ".eeeeeee.fffffff",
    ".....eeee.....f.",
]
SLABS_3 = [
    "aaaa......bbb...",
    "aaaaa.bbbbbb.cc.",
    "aaaaa.bbbbbb.cc.",
    ".aaa.bbbbbb.ccc.",
    ".aaa.bbbbbb.cccc",
    ".a.....bbb.ccccc",
    "..dddd....cccccc",
    ".ddddddd...ccccc",
    ".ddddddd.e..ccc.",
    "dddddddd.ee.....",
    "ddddddd.eeeeeee.",
    ".dddddd.eeeeeee.",
    ".ddddd.eeeeeeeee",
    ".ddddd.eeeeeeeee",
    ".ddddd.eeeeeeeee",
    "......eee.....e.",
]
SLABS_4 = [
    ".aaa......bbb...",
    ".aaaaa..bbbbbbb.",
    "..aaaaa.bbbbbbb.",
    "..aaaaa.bbbbbbb.",
    "...aaaa..bbbbbbb",
    ".f.aaaaa........",
    ".f..aaa...cccccc",
    ".ff....dd.cccccc",
    ".f..ddddd.ccccc.",
    "..e.ddddd.ccccc.",
    "eee..dddd..cccc.",
    ".eee.ddddd.cccc.",
    ".eee..dddd.ccccc",
    ".eeee.dddd.ccccc",
    ".eeee..dd.cccccc",
    ".......dd.....c.",
]
SLABS_5 = [
    "aaaa......ccc...",
    "aaaaaaa.b..cccc.",
    "aaaaaa.bbb.cccc.",
    ".aaaaa.bbb..ccc.",
    "......bbbbb..ccc",
    ".ddd..bbbbbb.ccc",
    ".dddd.bbbbbb..cc",
    ".dddd..bbbb....c",
    ".ddddd.....eeee.",
    "dddddd..eeeeeee.",
    "ddddd.f.eeeeeee.",
    ".ddd.ff..eeeeee.",
    ".dd.ffff.eeeeeee",
    ".d.fffff.eeeeeee",
    ".d.fffff.eeeeeee",
    ".....ffff.....e.",
]
SLABS_6 = [
    "cccc.......bb...",
    "ccc.aaaaaa.bbbb.",
    "ccc..aaaaa.bbbb.",
    ".ccc.aaaa.bbbbb.",
    ".ccc..aaa.bbbbbb",
    ".cccc.aaa.bbbbbb",
    ".cccc.aa.....bbb",
    ".ccc....dddd...b",
    ".c..ee..ddddddd.",
    "..eeeee.dddddd..",
    "eeeeeee.ddddd.f.",
    ".eeeeee.dddd.ff.",
    ".eeeeee.ddd.ffff",
    ".eeeeee.dd.fffff",
    ".eeeeee.d.ffffff",
    ".....ee.d.....f.",
]
SLABS_7 = [
    "aaaa......bbb...",
    "aaaa.bbbbbbb.cc.",
    "aaaa.bbbbbb..cc.",
    ".aaa..bbbb.cccc.",
    ".aaaa..bb.cccccc",
    ".aaa.d...ccccccc",
    ".a..dddd.ccccccc",
    "..dddddd.ccccccc",
    ".ddddddd....ccc.",
    "...ddddd.ee.....",
    "ff.....d.eeeeee.",
    ".fffff..eeeeeee.",
    ".ffffff.eeeeeeee",
    ".ffffff.eeeeeeee",
    ".ffffff.eeeeeeee",
    ".....ff.e.....e.",
]
SLABS_8 = [
    "aaaa......bbb...",
    "aaaaaaa.bbbbbbb.",
    "aaaaaaa.bbbbbbb.",
    ".aaaaaa.bbbbbbb.",
    ".aaaaaa.bbbbbbbb",
    "...aaa....bbbbbb",
    ".c....ddd...bbb.",
    ".ccc.dddddd.....",
    ".ccc.dddddd.eee.",
    "cccc...ddd.eeee.",
    "cccc.f....eeeee.",
    ".cc.ffff.eeeeee.",
    ".cc.ffff..eeeeee",
    ".c.ffffff.eeeeee",
    "..fffffff.eeeeee",
    ".....ffff.....e.",
]


SLAB_SHARED = {}   # 칸 경계를 넘는 판석은 없다 — 모든 판석이 칸 안에 통째로 들고, 경계 15행·15열은 줄눈이다(모서리에 작은 판을 두면 16px 마다 밝은 점이 찍혀 보였다)


def _slab_shared(x, y):
    x %= T; y %= T
    for k, rows in SLAB_SHARED.items():
        if x in rows.get(y, ()): return k
    return None

# 칸 사이 줄눈 길(모든 변형 공통): BORDER_V[y] = y행에서 세로 줄눈이 놓인 열(15 = 이 칸 15열, 16 = 오른쪽 칸 0열),
# BORDER_H[x] = x열에서 가로 줄눈이 놓인 행(15 = 이 칸 15행, 16 = 아래 칸 0행). 길이 꺾이는 자리는 두 열(행)을 다 줄눈으로 둬 판석이 대각으로 맞닿지 않게 한다.
BORDER_V = [15, 15, 15, 16, 16, 16, 16, 16, 15, 15, 15, 16, 16, 16, 16, 15]
BORDER_H = [15, 15, 15, 15, 16, 16, 16, 16, 16, 15, 15, 15, 15, 16, 16, 15]


def _border_joints():
    J = set()
    for y in range(T):
        J.add((BORDER_V[y] % T, y))
        if y and BORDER_V[y] != BORDER_V[y - 1]: J |= {(T - 1, y), (0, y)}
    for x in range(T):
        J.add((x, BORDER_H[x] % T))
        if x and BORDER_H[x] != BORDER_H[x - 1]: J |= {(x, T - 1), (x, 0)}
    return J


BORDER_JOINTS = _border_joints()


def SLAB_FIXED(x, y):
    """반드시 줄눈인 자리 '.', 자유 자리 None. (경계를 넘는 판석이 있으면 그 글자)"""
    sh = _slab_shared(x, y)
    if sh: return sh
    if (x % T, y % T) in BORDER_JOINTS: return "."
    if any(_slab_shared(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): return "."
    return None


# 가족: 판석 색 6단(빛 → 그늘)
SLAB_FAM = {"cool": "xyz%ZX", "warm": "c&db*+", "sunk": "z%Z=X?"}
EDGE_FAM = {}
FLAG_SPEC = {   # 배치도, 안쪽 판석 가족, 손으로 찍은 세부 (x, y, 글자): 금 X ? · 패인 점 Z = — 금은 다섯에만, 모양·자리가 다르다
    "body":  (SLABS_1, {"a": "cool", "b": "warm", "c": "cool", "d": "sunk", "e": "warm", "f": "cool"},
              [(10, 1, "X"), (11, 2, "X"), (11, 3, "?")]),
    "body2": (SLABS_2, {"a": "warm", "b": "cool", "c": "warm", "d": "cool", "e": "cool", "f": "sunk"},
              [(8, 8, "=")]),
    "body3": (SLABS_3, {"a": "warm", "b": "cool", "c": "sunk", "d": "cool", "e": "warm"},
              [(2, 8, "X"), (3, 9, "X"), (3, 10, "?"), (4, 11, "X")]),
    "body4": (SLABS_4, {"a": "cool", "b": "warm", "c": "cool", "d": "warm", "e": "sunk", "f": "warm"},
              [(12, 8, "Z")]),
    "body5": (SLABS_5, {"a": "cool", "b": "sunk", "c": "warm", "d": "warm", "e": "cool", "f": "cool"},
              [(10, 9, "X"), (11, 10, "?"), (12, 10, "X")]),
    "body6": (SLABS_6, {"a": "warm", "b": "cool", "c": "cool", "d": "warm", "e": "cool", "f": "sunk"},
              [(3, 11, "=")]),
    "body7": (SLABS_7, {"a": "cool", "b": "warm", "c": "cool", "d": "warm", "e": "cool", "f": "sunk"},
              [(7, 1, "X"), (8, 2, "X"), (8, 3, "?")]),
    "body8": (SLABS_8, {"a": "warm", "b": "cool", "c": "sunk", "d": "cool", "e": "warm", "f": "cool"},
              [(13, 11, "Z"), (2, 2, "X"), (3, 3, "X")]),
}

def _unwrap(pix):
    """감긴 칸 안의 화소 집합을 이어진 한 덩이 좌표로 편다(경계를 넘는 판석)."""
    xs = sorted({x for x, _ in pix}); ys = sorted({y for _, y in pix})
    def shift(vals):
        if len(vals) == T: return 0
        gaps = [(vals[(i + 1) % len(vals)] - vals[i]) % T for i in range(len(vals))]
        i = max(range(len(vals)), key=lambda k: gaps[k])
        return vals[(i + 1) % len(vals)]          # 가장 큰 틈 뒤의 첫 값이 덩이의 시작
    ox, oy = shift(xs), shift(ys)
    return {(((x - ox) % T) + ox, ((y - oy) % T) + oy) for x, y in pix}


def flag_body(name):
    lay, fams, marks = FLAG_SPEC[name]
    fams = dict(EDGE_FAM, **fams)
    at = lambda X, Y: lay[Y % T][X % T]
    out = [["@"] * T for _ in range(T)]
    for slab in sorted({c for r in lay for c in r} - {"."}):
        pix = _unwrap({(x, y) for y in range(T) for x in range(T) if lay[y][x] == slab})
        for (X, Y), ch in shade_unit(pix, SLAB_FAM[fams[slab]], sunk=fams[slab] == "sunk", flat=True).items(): out[Y % T][X % T] = ch
    for Y in range(T):
        for X in range(T):
            if at(X, Y) != ".": continue
            up, lf = at(X, Y - 1) != ".", at(X - 1, Y) != "."
            out[Y][X] = "T" if (up and lf) else "Q" if (up or lf) else "@"
            if 0 < X < T - 1 and 0 < Y < T - 1 and sum(at(X + dx, Y + dy) == "." for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3:
                out[Y][X] = "A" if (up or lf) else "a"     # 두 칸 넘게 벌어진 줄눈 = 이끼 덤불(빛 쪽 a, 그늘 쪽 A)
    for x, y, c in marks: out[y][x] = c
    return rows_of(out)


def _check_slab_layouts():
    for name, (lay, fams, marks) in FLAG_SPEC.items():
        assert len(lay) == T and all(len(r) == T for r in lay), (name, [len(r) for r in lay])
        for Y in range(T):
            for X in range(T):
                a, fx = lay[Y][X], SLAB_FIXED(X, Y)
                assert fx is None or fx == a, ("경계 판석/줄눈 자리가 다르다", name, X, Y, fx, a)
                if a == ".": continue
                assert a in fams or a in EDGE_FAM, ("가족 없는 판석", name, a)
                for dx, dy in ((1, 0), (0, 1)):
                    b = lay[(Y + dy) % T][(X + dx) % T]
                    assert b == "." or b == a, ("slab touch", name, X, Y, a, b)
        for x, y, c in marks:
            assert (lay[y][x] == ".") == (c in "aAE"), ("이끼는 줄눈에, 금·점은 판석에", name, x, y, c)
            assert _slab_shared(x, y) is None and 0 < x < T - 1 and 0 < y < T - 1, ("경계 판석·경계 줄눈에는 세부를 찍지 않는다", name, x, y)


# ================================================================ 가장자리(역할)
ROLES = ["body", "N", "S", "W", "E", "NW", "NE", "SW", "SE", "iso", "inNW", "inNE", "inSE", "inSW"]
VARIANTS = ["body2", "body3", "body4", "body5", "body6", "body7", "body8"]
ROLE_EDGES = {"body": "", "N": "N", "S": "S", "W": "W", "E": "E", "NW": "NW", "NE": "NE", "SW": "SW", "SE": "SE", "iso": "NSWE"}
NOTCH = {"inNW": "NW", "inNE": "NE", "inSW": "SW", "inSE": "SE"}

# 테 높이표(16 주기 — 같은 변끼리 이어 붙이면 그대로 이어진다). 마당 윗면의 첫·끝 화소.
# 다듬은 연석(자갈·판석)은 곧게, 다진 흙은 손으로 고른 흔들림 — 흔들림은 변 가운데(4~10)에만 두어 모서리 둥글림이 깨지지 않게.
EDGE_TABLES = {
    "kerb": dict(N=[2] * 16, S=[11] * 16, W=[2] * 16, E=[13] * 16),
    "dirt": dict(N=[2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2],
                 S=[11, 11, 11, 11, 11, 12, 12, 11, 11, 10, 10, 11, 11, 11, 11, 11],
                 W=[2, 2, 2, 2, 1, 1, 2, 2, 3, 3, 2, 2, 2, 2, 2, 2],
                 E=[13, 13, 13, 13, 13, 14, 14, 13, 13, 12, 12, 13, 13, 13, 13, 13]),
}


def top_fn(role, surface="cobble"):
    edges = ROLE_EDGES.get(role, "")
    notch = NOTCH.get(role)
    tb = EDGE_TABLES["dirt" if surface == "dirt" else "kerb"]
    n = lambda x: tb["N"][x % T]
    s = lambda x: tb["S"][x % T]
    w = lambda y: tb["W"][y % T]
    e = lambda y: tb["E"][y % T]

    def top(x, y):
        if "N" in edges and y < n(x): return False
        if "S" in edges and y > s(x): return False
        if "W" in edges and x < w(y): return False
        if "E" in edges and x > e(y): return False
        # 볼록 모서리 둥글리기
        if "N" in edges and "W" in edges and (x - w(y)) + (y - n(x)) < 2: return False
        if "N" in edges and "E" in edges and (e(y) - x) + (y - n(x)) < 2: return False
        if "S" in edges and "W" in edges and (x - w(y)) + (s(x) - y) < 2: return False
        if "S" in edges and "E" in edges and (e(y) - x) + (s(x) - y) < 2: return False
        # 오목 모서리: 이웃 두 변의 풀 띠가 만나는 작은 풀 자리(이웃 칸 테와 그대로 이어진다)
        if notch == "NW" and x < w(y) and y < n(x): return False
        if notch == "NE" and x > e(y) and y < n(x): return False
        if notch == "SW" and x < w(y) and y > s(x): return False
        if notch == "SE" and x > e(y) and y > s(x): return False
        return True
    return top


# 풀 포기 글리프: 숫자 = 잔디 색, '~' = 포기 밑 그늘(마당 위면 그 표면의 그늘색, 풀 위면 5).
TUFT_N = [".8.7.", "73837", "~3~3~"]           # 북쪽 테 너머로 늘어진 풀(마당 윗테를 덮는다)
TUFT_S = [".7.8", "7383", "3323"]               # 남쪽 앞면 발치에 자란 풀(앞면 아래 끝을 덮는다)
TUFT_W = ["7.", "38", "37", "~~"]               # 서쪽 테 위로 기운 풀
TUFT_E = [".7", "83", "73", "~~"]
TUFT_SMALL = [".7.", "737", "~~~"]
# 표면별 테 문법
RIM = {
    "cobble": dict(kerb=True, ring1={"N": "K", "S": "K", "W": "K", "E": "M"}, ring2="L", ring3="J", face=("N", "O"), joint=("M", "P"),
                   shade="J", tufts=1),
    "flag": dict(kerb=True, ring1={"N": "x", "S": "x", "W": "y", "E": "Z"}, ring2="Z", ring3="T", face=("X", "Q"), joint=("Q", "T"),
                 shade="T", tufts=1),
    "dirt": dict(kerb=False, ring1={"N": "l", "S": "i", "W": "i", "E": "0"}, ring2=None, ring3=None, face=("f", "e"), joint=None,
                 shade="f", tufts=2),
}
KERB_JOINT_X = (5, 10)      # 남북 테 연석의 이음 자리(16 주기)
KERB_JOINT_Y = (7,)      # 동서 테 연석의 이음 자리


def role_rows(surface, role, body):
    top = top_fn(role, surface)
    tb = EDGE_TABLES["dirt" if surface == "dirt" else "kerb"]
    N_TOP, S_TOP, W_TOP, E_TOP = tb["N"], tb["S"], tb["W"], tb["E"]
    st = RIM[surface]
    nf = len(st["face"])

    def face_k(x, y):
        """앞면 몇째 줄(1..nf) 또는 0."""
        if top(x, y): return 0
        for k in range(1, nf + 1):
            if top(x, y - k): return k if all(not top(x, y - j) for j in range(1, k)) else 0
        return 0

    solid = lambda x, y: top(x, y) or face_k(x, y) > 0
    g = [[""] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if top(x, y):
                ch = body[y][x]
                side = None
                for d, (dx, dy) in (("N", (0, -1)), ("S", (0, 1)), ("W", (-1, 0)), ("E", (1, 0))):
                    if not top(x + dx, y + dy): side = d; break
                if side is None and not all(top(x + dx, y + dy) for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1))):
                    side = "N" if not (top(x - 1, y - 1) and top(x + 1, y - 1)) else "S"
                rim = True
                if side:
                    ch = st["ring1"][side]
                elif st["ring2"] and not all(top(x + dx, y + dy) for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0), (-1, -1), (1, -1), (-1, 1), (1, 1))):
                    ch = st["ring2"]
                elif st["ring3"] and not all(top(x + dx, y + dy) for dx in range(-3, 4) for dy in range(-3, 4) if abs(dx) + abs(dy) <= 3):
                    ch = st["ring3"]
                else:
                    rim = False
                if rim and st["kerb"] and ch in (st["ring1"]["N"], st["ring1"]["W"], st["ring1"]["E"], st["ring2"]):
                    ns = not top(x, y - 1) or not top(x, y + 1) or not top(x, y - 2) or not top(x, y + 2)
                    if (ns and x % T in KERB_JOINT_X) or (not ns and y % T in KERB_JOINT_Y):
                        ch = st["joint"][0]
                g[y][x] = ch
                continue
            k = face_k(x, y)
            if k:
                ch = st["face"][k - 1]
                if st["joint"] and x % T in KERB_JOINT_X: ch = st["joint"][1]
                g[y][x] = ch
                continue
            # 풀: 마당이 오른쪽·아래로 드리우는 그늘
            if solid(x, y - 1): g[y][x] = "6"
            elif solid(x - 1, y) or solid(x - 1, y - 1): g[y][x] = "5"
            elif top(x, y + 1) or top(x + 1, y): g[y][x] = "1"
            else: g[y][x] = GRASS[y][x]

    def put_tuft(glyph, x0, y0):
        for dy, r in enumerate(glyph):
            for dx, c in enumerate(r):
                if c == ".": continue
                X, Y = x0 + dx, y0 + dy
                if not (0 <= X < T and 0 <= Y < T): continue
                if c == "~": g[Y][X] = st["shade"] if solid(X, Y) else "5"
                else: g[Y][X] = c

    # 풀 포기: 곧은 변의 손으로 고른 자리에만(모서리 둥글림 근처는 건너뛴다). 흙 마당은 포기가 더 많다.
    edges = ROLE_EDGES.get(role, "")
    many = st["tufts"] >= 2
    for ax in ((3, 9) if many else (9,)):
        if "N" in edges and top(ax + 2, N_TOP[(ax + 2) % T]) and top(ax - 1, 8) and top(ax + 5, 8):
            put_tuft(TUFT_N, ax, N_TOP[(ax + 2) % T] - 1)
    for ax in ():   # 남쪽 흙둑에는 풀 포기를 두지 않는다 — 곧은 변 칸 하나가 되풀이되며 16px 마다 같은 점이 줄지었다
        if "S" in edges and top(ax + 1, 8) and top(ax - 1, 8) and top(ax + 5, 8):
            fy = S_TOP[(ax + 1) % T] + nf
            put_tuft(TUFT_S, ax, fy - 1)
    for ay in ((5, 10) if many else (6,)):
        if "W" in edges and top(8, ay - 1) and top(8, ay + 4):
            put_tuft(TUFT_W, W_TOP[ay % T] - 1, ay)
    for ay in ((4, 9) if many else (9,)):
        if "E" in edges and top(8, ay - 1) and top(8, ay + 4):
            put_tuft(TUFT_E, E_TOP[ay % T], ay)
    if role in NOTCH:   # 오목 모서리 풀 자리 한가운데 작은 포기
        cx = {"NW": 0, "NE": 14, "SW": 0, "SE": 14}[NOTCH[role]]
        cy = {"NW": 0, "NE": 0, "SW": 14, "SE": 14}[NOTCH[role]]
        if NOTCH[role] in ("NW", "NE"): put_tuft(TUFT_SMALL, cx - 1 if cx else 0, cy)
    return rows_of(g)


_SURF_CACHE = None


def surfaces():
    """{"cobble"|"dirt"|"flag": {role: rows}} — 역할 14 + 몸통 변형 7 (+ 자갈·판석은 곧은 가장자리 둘째 벌 4)."""
    global _SURF_CACHE
    if _SURF_CACHE: return _SURF_CACHE
    _check_slab_layouts()
    bodies = {
        "cobble": {n: cobble_body(n) for n in ["body"] + VARIANTS},
        "dirt": {n: DIRT[n] for n in ["body"] + VARIANTS},
        "flag": {n: flag_body(n) for n in ["body"] + VARIANTS},
    }
    out = {}
    for s, bs in bodies.items():
        d = {r: role_rows(s, r, bs["body"]) for r in ROLES}
        for v in VARIANTS: d[v] = bs[v]
        if s in EDGE_ALT_SURFACES:
            for r, (alt, body) in EDGE_ALT.items(): d[alt] = role_rows(s, r, bs[body])
        out[s] = d
    _SURF_CACHE = out
    return out


# 곧은 가장자리 둘째 벌(자갈·판석만): 같은 역할이지만 다른 몸통 변형을 품는다. 칠하는 도구는 위치 위상(phaseVariants, 2×2)으로
# 남북 변은 x 홀수 칸, 동서 변은 y 홀수 칸에 둘째 벌을 쓴다 — 긴 변이 16px 마다 같은 칸으로 줄짓지 않게. 흙은 첫 벌 그대로(그림·영수증 유지).
EDGE_ALT = {"N": ("N2", "body5"), "S": ("S2", "body6"), "W": ("W2", "body7"), "E": ("E2", "body3")}
EDGE_ALT_SURFACES = ("cobble", "flag")
ALT_ORDER = [a for a, _b in EDGE_ALT.values()]


def phase_role(surface, role, x, y):
    """위치 위상으로 고른 곧은 가장자리 둘째 벌(없으면 그대로)."""
    if surface not in EDGE_ALT_SURFACES or role not in EDGE_ALT: return role
    odd = (x % 2) if role in ("N", "S") else (y % 2)
    return EDGE_ALT[role][0] if odd else role


ORDER = ROLES[:1] + VARIANTS + ROLES[1:]       # 굽는 칸 순서: body, body2..8, N, S, W, E, NW, NE, SW, SE, iso, inNW, inNE, inSE, inSW


def _h(x, y):
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return n ^ (n >> 16)


def role_for(cells, x, y):
    """농장 soil_group 과 같은 마스크 → 역할 규칙."""
    on = lambda a, b: (a, b) in cells
    N, E, S, W = on(x, y - 1), on(x + 1, y), on(x, y + 1), on(x - 1, y)
    NE, SE, SW, NW = on(x + 1, y - 1), on(x + 1, y + 1), on(x - 1, y + 1), on(x - 1, y - 1)
    if not (N or E or S or W): return "iso"
    if N and E and S and W:
        for ok, k in ((NW, "inNW"), (NE, "inNE"), (SE, "inSE"), (SW, "inSW")):
            if not ok: return k
        return "body"
    if not N and not W: return "NW"
    if not N and not E: return "NE"
    if not S and not W: return "SW"
    if not S and not E: return "SE"
    if not N: return "N"
    if not S: return "S"
    if not W: return "W"
    return "E"


def sample(surface, grid):
    """grid: 행 문자열 목록('#' = 마당) 또는 불리언 2차원 → RGBA 그림. 몸통은 위치 해시로 넷 중 하나를 고른다."""
    rows = [[(c == "#") if isinstance(c, str) else bool(c) for c in r] for r in grid]
    H, W = len(rows), len(rows[0])
    cells = {(x, y) for y in range(H) for x in range(W) if rows[y][x]}
    S = surfaces()[surface]
    grass = img_of(GRASS)
    im = Image.new("RGBA", (W * T, H * T))
    for y in range(H):
        for x in range(W):
            if (x, y) not in cells: im.paste(grass, (x * T, y * T)); continue
            r = phase_role(surface, role_for(cells, x, y), x, y)
            if r == "body": r = (["body"] + VARIANTS)[_h(x, y) % (1 + len(VARIANTS))]
            im.paste(img_of(S[r]), (x * T, y * T))
    return im


# 관문·확인용 표본 덩이(11×9): 볼록 모서리 넷, 오목 모서리 넷(풀 구멍 둘레 포함), 외딴 칸, 남쪽 2폭 목(1칸 길이),
# 몸통 변형 셋이 다 나온다. 1폭 줄은 넣지 않는다 — 농장 경작지와 같은 마스크 → 역할 규칙은 마주 보는 두 변이 모두 빈 칸을 그리지 못한다.
SAMPLE_GRID = [   # 덩이 둘레까지만 자른 판(마당 칸 70 / 99) — 풀만 있는 칸이 판정 그림을 채우지 않게
    ".######..#.",
    "########...",
    "#########..",
    "###..######",
    "###..######",
    "###########",
    ".#########.",
    "...######..",
    "...##......",
]


def palette_check():
    """모든 PAL 색과 잔디 행이 버들항 시트 앞 224행에 실제로 있는가. 반환: (ok, 없는 색 목록)."""
    sh = Image.open(SHEET_PATH).convert("RGBA")
    crop = sh.crop((0, 0, sh.width, PALETTE_ROWS * T))
    seen = {c for c in crop.getcolors(1 << 24) and [p for _, p in crop.getcolors(1 << 24)] if c[3] == 255}
    missing = [(k, v) for k, v in PAL.items() if rgba(k) not in seen]
    g737 = sh.crop(((737 % 128) * T, (737 // 128) * T, (737 % 128) * T + T, (737 // 128) * T + T))
    if list(g737.getdata()) != list(img_of(GRASS).getdata()): missing.append(("GRASS", "737 칸과 다르다"))
    used = {ch for s in surfaces().values() for rows in s.values() for r in rows for ch in r}
    unknown = sorted(used - set(PAL))
    if unknown: missing.append(("unknown letters", unknown))
    return not missing, missing


def seam_check():
    """몸통 넷을 어떤 순서로 붙여도 이어지는가: 이웃과 맞닿는 15행·15열의 돌/줄눈 자리, 그리고 그 너머로 이어지는 돌(15행·15열에서 돌인 자리의
    0행·0열)이 넷 모두 같아야 한다. 줄눈 그늘의 짙고 옅음은 안쪽 돌에 따라 다르므로 돌/줄눈만 본다."""
    bad = []
    joint = set("JjkQT@aAE")
    for s in ("cobble",):
        S = surfaces()[s]

        def ring(rows):
            n = ["".join("_" if c in joint else "#" for c in r) for r in rows]
            last_r, last_c = n[T - 1], "".join(r[T - 1] for r in n)
            first_r = "".join(n[0][x] if last_r[x] == "#" else "-" for x in range(T))
            first_c = "".join(n[y][0] if last_c[y] == "#" else "-" for y in range(T))
            return last_r, last_c, first_r, first_c
        base = ring(S["body"])
        for v in VARIANTS:
            if ring(S[v]) != base: bad.append((s, v))
    # 판석: 칸 사이 줄눈 길(BORDER_JOINTS)이 모든 변형·모든 역할 몸통에서 줄눈이면 어느 두 칸을 붙여도 판석이 맞닿지 않는다
    S = surfaces()["flag"]
    for v in ["body"] + VARIANTS:
        for (x, y) in BORDER_JOINTS:
            if S[v][y][x] not in joint: bad.append(("flag", v, x, y))
    return bad


def preview(out):
    S = surfaces()
    pad = 2
    cols = len(ORDER)
    tiles_h = 3 * (T + pad)
    blobs = [sample(s, SAMPLE_GRID) for s in ("cobble", "dirt", "flag")]
    bw = sum(b.width + 8 for b in blobs)
    W = max(cols * (T + pad), bw)
    im = Image.new("RGBA", (W, tiles_h + 8 + blobs[0].height), (40, 40, 44, 255))
    for i, s in enumerate(("cobble", "dirt", "flag")):
        for j, r in enumerate(ORDER): im.paste(img_of(S[s][r]), (j * (T + pad), i * (T + pad)))
    x = 0
    for b in blobs: im.paste(b, (x, tiles_h + 8)); x += b.width + 8
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out)


GATE_NAME = {
    "cobble": "rustic cobbled work yard ground autotile: rounded warm river cobbles with dark earth joints, a low dressed stone kerb rim with a 2px front face on the south edge, grass tufts at the rim, lying flat on grass (top-down 3/4 RPG ground)",
    "dirt": "packed-earth yard ground autotile: tamped reddish-brown earth with faint wheel rut, footprints, pebbles and straw, a slight earth bank shadow on the south edge and grass tufts creeping over the rim, lying flat on grass (top-down 3/4 RPG ground)",
    "flag": "flagstone temple court ground autotile: large irregular pale limestone slabs with dark joints, moss in the joints, a cracked and a sunken slab, a low dressed kerb rim with a 2px front face on the south edge, lying flat on grass (top-down 3/4 RPG ground)",
}


def gate_export(d):
    d = pathlib.Path(d); d.mkdir(parents=True, exist_ok=True)
    lines = []
    for s in ("cobble", "dirt", "flag"):
        p = d / f"yard_{s}.png"
        sample(s, SAMPLE_GRID).save(p)
        lines.append(dict(png=str(p.resolve()), kind="terrain", name=GATE_NAME[s], label=f"beodeul_yard/{s}"))
    (d / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
    return lines



# ================================================================ 비교판(3배): 마당 + 쓰임 조각 | 버들항 길·광장·모랫길
COMPARE_KITS = {
    "cobble": [("bd-pick-mining-valley-smelt", 1, 0), ("bd-pick-mining-valley-headframe", 7, 0)],
    "dirt": [("bd-pick-vineyard-winery", 1, 0), ("bd-pick-vineyard-wine-press", 8, 3)],
    "flag": [("bd-pick-temple-ruins-roof-naiskos-pediment", 1, 0), ("bd-pick-temple-ruins-column-temple-tall", 8, 0),
             ("bd-pick-temple-ruins-ruined-wall-2", 9, 5)],
}
FIELD_GRID = [
    "..............",
    ".############.",
    ".############.",
    ".############.",
    ".############.",
    ".############.",
    ".#########....",
    ".#########.##.",
    "..............",
]


def _sheet_cell(sh, t):
    return sh.crop(((t % 128) * T, (t // 128) * T, (t % 128) * T + T, (t // 128) * T + T))


def _group_patch(sh, ts, gid, grid):
    g = next(x for x in ts["autotileGroups"] if x["id"] == gid)
    cells = {(x, y) for y, r in enumerate(grid) for x, c in enumerate(r) if c == "#"}
    im = Image.new("RGBA", (len(grid[0]) * T, len(grid) * T))
    for y, r in enumerate(grid):
        for x, _ in enumerate(r):
            im.paste(_sheet_cell(sh, 737), (x * T, y * T))
            if (x, y) not in cells: continue
            on = lambda a, b: (a, b) in cells
            m = (on(x, y - 1) * 1 | on(x + 1, y) * 2 | on(x, y + 1) * 4 | on(x - 1, y) * 8 | on(x + 1, y - 1) * 16 | on(x + 1, y + 1) * 32
                 | on(x - 1, y + 1) * 64 | on(x - 1, y - 1) * 128)
            t = g["variantMap"].get(str(m), g["variantMap"].get("255"))
            im.alpha_composite(_sheet_cell(sh, t), (x * T, y * T))
    return im


def _kit(sh, k):
    im = Image.new("RGBA", (k["width"] * T, k["height"] * T))
    for y, row in enumerate(k["rows"]):
        for key in ("tiles", "upperTiles"):
            for x, t in enumerate(row.get(key) or []):
                if t is not None and t >= 0: im.alpha_composite(_sheet_cell(sh, t), (x * T, y * T))
    return im


def compare(out):
    sh = Image.open(SHEET_PATH).convert("RGBA")
    ts = json.loads((ROOT / "src/assets/beodeulCityTileset.json").read_text())
    kits = {k["id"]: k for k in ts["structureKits"]}
    small = ["......", ".####.", ".####.", ".####.", ".####.", "......"]
    plaza_ids = next(g for g in ts["tileGroups"] if g["id"] == "beodeul:plaza")["tileIds"]
    plaza = Image.new("RGBA", (6 * T, 6 * T))
    for y in range(6):
        for x in range(6):
            plaza.paste(_sheet_cell(sh, 737 if x in (0, 5) or y in (0, 5) else [1509, 1509, 2691, 1509][(x * 3 + y) % 4]), (x * T, y * T))
    refs = [_group_patch(sh, ts, "beodeul_road_autotile", small), plaza, _group_patch(sh, ts, "beodeul_sand_autotile", small),
            _group_patch(sh, ts, "farmland", small)]
    rows = []
    for s in ("cobble", "dirt", "flag"):
        field = sample(s, FIELD_GRID)
        for kid, kx, ky in COMPARE_KITS[s]:
            if kid in kits: field.alpha_composite(_kit(sh, kits[kid]), (kx * T, ky * T))
        bare = sample(s, small)
        parts = [field, bare] + refs
        W = sum(p.width + 6 for p in parts)
        H = max(p.height for p in parts)
        row = Image.new("RGBA", (W, H), (40, 40, 44, 255))
        x = 0
        for p in parts: row.alpha_composite(p, (x, 0)); x += p.width + 6
        rows.append(row)
    W = max(r.width for r in rows)
    im = Image.new("RGBA", (W, sum(r.height + 6 for r in rows)), (40, 40, 44, 255))
    y = 0
    for r in rows: im.alpha_composite(r, (0, y)); y += r.height + 6
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(out)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        ok, miss = palette_check()
        print("palette:", "OK" if ok else miss, "| colours:", len(PAL))
        print("seams:", seam_check() or "OK")
        sys.exit(0 if ok and not seam_check() else 1)
    elif cmd == "preview":
        preview(sys.argv[2]); print("->", sys.argv[2])
    elif cmd == "compare":
        compare(sys.argv[2]); print("->", sys.argv[2])
    elif cmd == "gate":
        for l in gate_export(sys.argv[2]): print(l["png"])
    else:
        sys.exit(f"unknown command {cmd}")
