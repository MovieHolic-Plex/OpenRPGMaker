"""객잔 살림 판 inn-r1 — 묶음 inn 7항목 + 배치 견본 set_table_four × 줄 A·B × 후보 2 (A1 A2 B1 B2).

줄의 화풍 기준은 style-r1 의 그 글자 조각(round_table_stools·inn_floor_wood·inn_wall_pillar)이다 — 같은 램프·먹 1px 윤곽·
왼쪽 위 빛. 그림은 전부 행 문자열이다. R(...) 은 손으로 정한 열 자리에 글자열을 놓는 보조일 뿐 도형을 만들지 않는다.

탁자·걸상 계약(seed table_round.geometry · stool_drum.geometry)은 네 후보가 모두 지킨다 — 그래야 set_table_four 의 layout
(seed)이 어떤 후보를 고르든 같다. 탁자 윗면 타원 12~20행(가운데 16 = 칸 경계)·두께 띠 아래 22행·받침 발 31행,
걸상 앉는 면 9~11행(가운데 10)·발 15행. 탁자 윗면 타원 테두리(TOP)는 계약 모양이라 공용이고, 윗면 안쪽·두께 띠·다리는 후보마다 손으로 쓴다.

meta: 'top' = 윗면 행(관문 F), 탁자 'ellipse'·'band', 걸상 'seat' = 관문 K 가 읽는 행.
"""
from tk import Cv, T, compose_layout, grid, stamp
import frame_r1 as F

ROUND = 'inn-r1'
WAVE = 'inn'

# ---------------------------------------------------------------------------
# 범례: 숫자 = 그 그림의 주 재료(후보마다 정한다), 글자 = 다른 램프
# ---------------------------------------------------------------------------
BASE = {'K': 'ink'}
BASE.update({c: ('zhu', i + 1) for i, c in enumerate('rstuvw')})     # 주칠 1~6
BASE.update({c: ('mu', i + 1) for i, c in enumerate('abcdef')})      # 짙은 나무 1~6
BASE.update({c: ('bai', i + 2) for i, c in enumerate('ghijk')})      # 흰 회벽 2~6
BASE.update({c: ('song', i + 2) for i, c in enumerate('lmnop')})     # 소나무 2~6
BASE['L'] = ('song', 1)
BASE.update({c: ('shi', i + 1) for i, c in enumerate('ABCDEF')})     # 청석 1~6
BASE.update({c: ('huang', i + 2) for i, c in enumerate('MNOPQ')})    # 황토 2~6
BASE.update({c: ('wa', i + 1) for i, c in enumerate('RSTUVW')})      # 청회 기와 1~6
BASE.update({'X': ('jin', 2), 'x': ('jin', 3), 'y': ('jin', 4), 'z': ('jin', 5), 'Z': ('jin', 6)})


def leg(main):
    d = dict(BASE)
    d.update({str(i): (main, i) for i in range(7)})
    return d


def R(*segs, w=32):
    """한 행: '.' 바탕 위 (열, 글자열) 을 손으로 정한 자리에 놓는다."""
    row = ['.'] * w
    for x, s in segs:
        for i, ch in enumerate(s):
            if ch != ' ':
                row[x + i] = ch
    return ''.join(row)


def canvas(rows, legend, w, h):
    return grid(rows, legend, w, h)


# ---------------------------------------------------------------------------
# 1. 둥근 탁자 (2×2) — 계약 테두리 + 후보마다 윗면 안쪽·두께 띠·다리
# ---------------------------------------------------------------------------
# 윗면 타원 테두리(계약). F = 윗면 안쪽 자리, B = 두께 띠 자리, K = 먹 윤곽. 12~22행.
TOP = {
    12: ".........KKKKKKKKKKKKKK.........",
    13: "......KKKFFFFFFFFFFFFFFKKK......",
    14: "....KKFFFFFFFFFFFFFFFFFFFFKK....",
    15: "...KFFFFFFFFFFFFFFFFFFFFFFFFK...",
    16: "...KFFFFFFFFFFFFFFFFFFFFFFFFK...",
    17: "...KFFFFFFFFFFFFFFFFFFFFFFFFK...",
    18: "...KKKFFFFFFFFFFFFFFFFFFFFKKK...",
    19: "...KBBKKKFFFFFFFFFFFFFFKKKBBK...",
    20: "....KKBBBKKKKKKKKKKKKKKBBBKK....",
    21: "......KKKBBBBBBBBBBBBBBKKK......",
    22: ".........KKKKKKKKKKKKKK.........",
}
TABLE_META = {'top': (13, 20), 'ellipse': (12, 21), 'band': 22, 'foot': 31}


def ktop(light, shade):
    """TOP 계약 모양은 그대로, 먹(K) 대신 재료 밝은 단(위·왼쪽 테두리)·1단(아래·오른쪽 테두리). 먹 윤곽 없는 후보용."""
    out = {}
    for y in range(12, 23):
        r = []
        for x, ch in enumerate(TOP[y]):
            if ch != 'K':
                r.append(ch)
                continue
            up = y == 12 or TOP.get(y - 1, '.' * 32)[x] == '.'
            lf = TOP[y][x - 1] == '.'
            r.append(light if (up or (lf and y <= 16)) else shade)
        out[y] = ''.join(r)
    return out


def table(face, band, legs, legend, deco=(), note='', top=None):
    """face = 13~19행 윗면 안쪽(행마다 F 자리 수만큼), band = 19~21행 두께 띠(행마다 B 자리 수만큼),
    legs = 23~31행(9행, 32폭), deco = [(행들, x, y)] 윗면 위 소품."""
    rows = ['.' * 32] * 12
    top = top or TOP
    for y in range(12, 23):
        t = top[y]
        f = iter(face.get(y, ''))
        b = iter(band.get(y, ''))
        out = []
        for ch in t:
            if ch == 'F':
                out.append(next(f))
            elif ch == 'B':
                out.append(next(b))
            else:
                out.append(ch)
        for it, name in ((f, 'face'), (b, 'band')):
            if next(it, None) is not None:
                raise ValueError(f'{y}행 {name} 글자가 자리보다 많다')
        rows.append(''.join(out))
    assert len(legs) == 9, len(legs)
    rows += legs
    cv = canvas(rows, legend, 32, 32)
    for r_, x, y in deco:
        stamp(cv, r_, legend, x, y)
    return cv, dict(TABLE_META, note=note)


def table_a1():
    face = {
        13: "66666666665555",
        14: "66665555566666665554",
        15: "666666666666666555555554",
        16: "566666666655555544445544",
        17: "555555666555555555555444",
        18: "45555555554444554444",
        19: "44444433333333",
    }
    band = {19: "3221", 20: "332211", 21: "33332222222111"}
    legs = [                                      # 먹 윤곽 없이: 왼쪽 밝은 단 6, 오른쪽 그늘 1(mu 1단)
        R((13, "654321"), (19, "~~~~~~~")),
        R((13, "654321"), (19, "~~~~~")),
        R((13, "654321")),
        R((13, "wuutsr")),
        R((13, "654321")),
        R((12, "66543211")),
        R((10, "665544332211")),
        R((9, "65544433322211"), (23, "~~")),
        R((9, "11111111111111"), (23, "~~~~")),
    ]
    return table(face, band, legs, leg('mu'), top=ktop('5', '1'), note='줄 A · style A 그대로 짙은 나무 둥근 탁자. 가운데 기둥 하나(주칠 고리)·넓게 벌어진 받침 발이 칸 아래 경계에 닿는다.')


def table_a2():
    face = {
        13: "vvvvvvvvvvvvvu",
        14: "vu6666666666666655ut",
        15: "u66666666666666555555554",
        16: "u66666666555555555544443",
        17: "u55666555555555554444443",
        18: "tu555555555544444444",
        19: "tttttttttttsss",
    }
    band = {19: "utts", 20: "uutsss", 21: "uuuuttttttsssr"}
    legs = [
        R((6, "K54K"), (11, "K43K"), (17, "K32K"), (22, "K32K"), (26, "~~")),
        R((6, "K54K"), (11, "K43K"), (17, "K32K"), (22, "K32K"), (26, "~")),
        R((6, "K54K"), (11, "K43K"), (17, "K32K"), (22, "K32K")),
        R((6, "K54K"), (11, "K43K"), (17, "K32K"), (22, "K32K")),
        R((6, "K54K"), (11, "KKKK"), (17, "KKKK"), (22, "K32K")),
        R((6, "K54K"), (22, "K32K")),
        R((6, "K54K"), (22, "K32K")),
        R((5, "KK54K"), (22, "K32KK"), (27, "~")),
        R((5, "KKKKK"), (22, "KKKKK"), (27, "~~~")),
    ]
    return table(face, band, legs, leg('mu'), note='줄 A · 주칠 테를 두른 짙은 나무 탁자(윗면 가장자리·두께 띠가 주칠)·다리 넷(앞 둘은 끝이 밖으로 휜다, 뒤 둘은 짧게 보인다).')


def table_b1():
    face = {
        13: "66666666666655",
        14: "66666666666666665555",
        15: "666666666666666666555554",
        16: "666666666666666665555544",
        17: "566666666666666655555444",
        18: "55555555555555554444",
        19: "44444555544433",
    }
    band = {19: "tssr", 20: "ttssrr", 21: "tttttssssssrrr"}
    # 자사(紫砂) 찻주전자·찻잔 — 흰 덩이·먹 점이면 6배에서 눈처럼 읽혔다(감독 2026-10-08).
    # 짙은 나무 램프 한 덩이로 그리고 윤곽은 먹 대신 mu 1단(a), 속에 홀로 떨어진 점을 두지 않는다. 왼쪽 손잡이·오른쪽 부리.
    teapot = [             # 10×7: 꼭지·뚜껑 윗면(밝은 f e)·몸통 둥근 앞면, 왼쪽 고리 손잡이, 오른쪽 위로 솟은 부리
        "....aa....",
        "...afea..a",
        "..affeeaab",
        "aaaeeeedaa",
        "a.aeddddca",
        "aaadccccba",
        "...aaaaaa.",
    ]
    legs = [                                      # 벌어진 다리 둘 + 가로대(윗면 밝은 줄·아랫면 그늘) — 먹 대신 song 밝은 단/0~1단
        R((10, "5430"), (18, "4320"), (22, "~~~")),
        R((10, "5430"), (18, "4320"), (22, "~~")),
        R((9, "5430"), (19, "4320")),
        R((9, "5435555555320")),
        R((9, "5435555443120")),
        R((8, "543000000000320")),
        R((7, "5430"), (21, "4320")),
        R((6, "55430"), (21, "43200"), (26, "~~")),
        R((6, "11100"), (21, "11000"), (26, "~~~~")),
    ]
    deco = [(teapot, 7, 12)]   # 찻주전자 하나만 — 둥근 덩이 둘이 나란하면 눈처럼 읽힌다. 뒤 걸상 앉는 면을 가리지 않게 왼쪽
    return table(face, band, legs, leg('song'), deco, top=ktop('5', '0'),
                 note='줄 B · style B 그대로 밝은 소나무 탁자·주칠 두께 띠·자사 찻주전자 하나(짙은 흙빛, 먹 점 없음). 벌어진 다리 둘에 가로대.')


def table_b2():
    face = {
        13: "dddddddddddddc",
        14: "d666666666666666655c",
        15: "d6666666666666665555555c",
        16: "d6666666666655555555544c",
        17: "c5555666555555555544444b",
        18: "c55555555554444444cb",
        19: "cccccccbbbbbbb",
    }
    face[14] = face[14].ljust(20, 'c')[:19] + 'c'
    face[16] = face[16].ljust(24, 'c')[:23] + 'c'
    band = {19: "cbba", 20: "ccbbaa", 21: "ccyccybbybbyaa"}
    steam = [".LLLLLL.", "LooooonL", "LmmmmmlL", ".LLLLLL."]   # 소나무 찜바구니(윤곽 소나무 1단) — 흰 접시는 입처럼 읽혔다
    jug = ["..KK..", ".KPOK.", "KPOONK", "KONNMK", ".KKKK."]
    legs = [                                      # 짙은 나무 북 모양 통받침에 금 징 두 줄
        R((10, "KKKKKKKKKKKK"), (22, "~~~")),
        R((9, "KedddccccbbbaK"), (23, "~~")),
        R((9, "KdyddcyccbybaK")),
        R((9, "KddddccccbbbaK")),
        R((9, "KccccbbbbaaaaK")),
        R((9, "KdyddcyccbybaK")),
        R((9, "KccccbbbbaaaaK")),
        R((9, "KbbbbaaaaaaaaK"), (23, "~~")),
        R((9, "KKKKKKKKKKKKKK"), (23, "~~~~")),
    ]
    deco = [(jug, 7, 12), (steam, 15, 15)]   # 비대칭 대각선 — 두 덩이가 눈처럼 나란히 서지 않게
    return table(face, band, legs, leg('song'), deco,
                 note='줄 B · 소나무 윗면에 짙은 나무 테·두께 띠에 금 징·소나무 찜바구니와 황토 술병. 받침은 금 징 박은 짙은 나무 북 모양 통받침.')


# ---------------------------------------------------------------------------
# 2. 북 걸상 (1×1) — 계약: 앉는 면 타원 8~11행(윤곽 포함, 가운데 9.5), 발 15행, 폭 3~12열
# ---------------------------------------------------------------------------
STOOL_META = {'top': (9, 11), 'seat': (8, 12)}


def stool(rows, legend, shadow=((12, 15), (13, 14), (13, 15)), note=''):
    assert len(rows) == 8 and all(len(r) == 10 for r in rows), rows
    full = ['.' * 16] * 8 + [R((3, r), w=16) for r in rows]
    cv = canvas(full, legend, 16, 16)
    for x, y in shadow:
        cv.shadow(x, y)
    return cv, dict(STOOL_META, note=note)


def stool_a1():
    return stool([
        "..665555..",
        ".66555544.",
        "6655554431",
        "5uuuuuuur1",
        "5444333221",
        "4333322211",
        "3322221111",
        ".11111111.",
    ], leg('mu'), shadow=((12, 14), (12, 15), (13, 14), (13, 15), (14, 15)),
        note='줄 A · style A 그대로 짙은 나무 북 걸상·주칠 징 한 줄. 먹 윤곽 없이 밝은 단(위·왼쪽)·1단(아래·오른쪽).')


def stool_a2():
    return stool([
        "..KKKKKK..",
        ".K666665K.",
        "K66666555K",
        "KKKKKKKKKK",
        "K5b5b4b4bK",
        "K5b5b4b4bK",
        "K55554443K",
        "KK.KKKK.KK",
    ], leg('song'), shadow=((12, 14), (13, 14), (13, 15)), note='줄 A · 밝은 소나무 북 걸상에 짙은 나무 세로 살·짧은 발.')


def stool_b1():
    return stool([
        "..666660..",
        ".66666650.",
        "6655555440",
        "1000000000",
        ".50....00.",
        ".50....00.",
        ".50....00.",
        ".00....00.",
    ], leg('song'), shadow=((5, 14), (6, 14), (7, 14), (8, 14), (6, 15), (7, 15), (8, 15), (12, 15), (13, 15), (13, 14), (14, 15), (11, 15)),
        note='줄 B · 소나무 다리 둘 걸상(다리가 보인다). 먹 윤곽 없이 밝은 단(위·왼쪽)·song 0(아래·오른쪽).')


def stool_b2():
    return stool([
        "..KKKKKK..",
        ".KvvvvuuK.",
        "KuuuutttsK",
        "KKKKKKKKKK",
        "K5y44y3y2K",
        "K44333322K",
        "K33222211K",
        ".KK....KK.",
    ], leg('mu'), shadow=((12, 15), (13, 14), (13, 15)), note='줄 B · 짙은 나무 북 걸상에 붉은 방석·금 징·발 둘.')


# ---------------------------------------------------------------------------
# 3. 배치 견본 (4×2) — seed set_table_four.layout 대로 합성(관문 K 가 같은지 본다)
# ---------------------------------------------------------------------------
def _seed_item(iid):
    import json
    import os
    from tk import DATA
    s = json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
    return next(it for it in s['items'] if it['id'] == iid)


def set_of(tfn, sfn, note):
    it = _seed_item('set_table_four')
    tcv, _ = tfn()
    scv, _ = sfn()
    cv = compose_layout(it['layout'], {'table': tcv, 'stool': scv}, it['size'])
    ty = it['layout']['place']['table']['px'][1]
    return cv, {'top': (ty + 13, ty + 20), 'note': note}


def set_a1():
    return set_of(table_a1, stool_a1, '줄 A · A1 탁자 + A1 걸상 넷을 layout 대로(뒤 → 탁자 → 좌·우 → 앞).')


def set_a2():
    return set_of(table_a2, stool_a2, '줄 A · A2 탁자 + A2 걸상 넷을 layout 대로.')


def set_b1():
    return set_of(table_b1, stool_b1, '줄 B · B1 탁자 + B1 걸상 넷을 layout 대로.')


def set_b2():
    return set_of(table_b2, stool_b2, '줄 B · B2 탁자 + B2 걸상 넷을 layout 대로.')


# ---------------------------------------------------------------------------
# 4. 계산대 (3×2, 48×32) — 윗면 13~15행, 앞 모서리 16~17, 앞면 19~30, 굽 31
# ---------------------------------------------------------------------------
def counter(rows, legend, deco=(), note='', top=(13, 16)):
    """rows = 12~31행(20행, 48폭). 위 12행은 비워 둔다(소품이 올라간다)."""
    assert len(rows) == 20, len(rows)
    for j, r_ in enumerate(rows):
        assert len(r_) == 48, (j, len(r_), r_)
    cv = canvas(['.' * 48] * 12 + list(rows), legend, 48, 32)
    for r_, x, y in deco:
        stamp(cv, r_, legend, x, y)
    return cv, {'top': top, 'note': note}


ABACUS = [            # 주판 13×6: 짙은 테·판, 가운데 들보, 위 알 한 줄·아래 알 두 줄(흰 알)
    "KKKKKKKKKKKKK",
    "Kajajajajajak",
    "KcccccccccccK",
    "Kajajajajajak",
    "Kajajajajajak",
    "KKKKKKKKKKKKK",
]
ABACUS = [r.replace('k', 'K') for r in ABACUS]


def deink(rows, light, shade, light_top=None):
    """먹(K) 윤곽을 재질 단으로 바꾼 사본: 위·왼쪽이 트인 K = light(밝은 단), 아래·오른쪽이 트인 K = shade(재질 1단), 안쪽 K = shade.
    공용 상수를 건드리지 않고 고른 후보만 먹 없이 칠하려는 것."""
    lt = light_top or light
    h, w = len(rows), len(rows[0])

    def at(y, x):
        return rows[y][x] if 0 <= y < h and 0 <= x < w else '.'
    out = []
    for y in range(h):
        line = ''
        for x in range(w):
            c = rows[y][x]
            if c != 'K':
                line += c
            elif at(y - 1, x) == '.':
                line += lt
            elif at(y, x - 1) == '.':
                line += light
            else:
                line += shade
        out.append(line)
    return out


_MINSTEP = {'mu': 1, 'wa': 1, 'zhu': 1, 'zhuz': 1, 'cao': 1}


def deink_mat(rows, legend, inner='a', top_up=1):
    """먹(K) 을 안쪽 이웃 재질의 단으로 바꾼 사본(재질 인식).
    위가 트인 K = 안쪽 이웃 +top_up 단(밝게), 왼쪽이 트인 K = 안쪽 이웃 그대로,
    아래·오른쪽이 트인 K = 안쪽 이웃 -1 단(먹 밝기 아래로는 안 내림), 안쪽 K = inner."""
    h, w = len(rows), len(rows[0])
    inv = {}
    for ch, v in legend.items():
        if isinstance(v, tuple):
            inv.setdefault(v, ch)

    def at(y, x):
        return rows[y][x] if 0 <= y < h and 0 <= x < w else '.'

    def sample(y, x, dy, dx):
        y += dy
        x += dx
        while 0 <= y < h and 0 <= x < w:
            c = rows[y][x]
            if c not in 'K.~':
                return c
            y += dy
            x += dx
        return None

    def shift(c, d):
        v = legend.get(c)
        if not isinstance(v, tuple):
            return c
        ramp, st = v
        lo = _MINSTEP.get(ramp, 0)
        n = min(6, max(lo, st + d))
        return inv.get((ramp, n), c)
    out = []
    for y in range(h):
        line = ''
        for x in range(w):
            c = rows[y][x]
            if c != 'K':
                line += c
                continue
            if at(y - 1, x) == '.':
                s_ = sample(y, x, 1, 0)
                line += shift(s_, top_up) if s_ else inner
            elif at(y, x - 1) == '.':
                s_ = sample(y, x, 0, 1)
                line += s_ if s_ else inner
            elif at(y + 1, x) == '.':
                s_ = sample(y, x, -1, 0)
                line += shift(s_, -1) if s_ else inner
            elif at(y, x + 1) == '.':
                s_ = sample(y, x, 0, -1)
                line += shift(s_, -1) if s_ else inner
            else:
                line += inner
        out.append(line)
    return out


def counter_a1():
    pan = ["KvvvvvvvvvvvtK", "KvuuuuuuuuuutK", "KvuuuuuuuuuutK", "KvuuuuuuuuuutK",
           "KvuuuuuuuuuutK", "KvuuuuuuuuuutK", "KtttttttttttsK"]
    rows = [
        ".K" + "K" * 44 + "K.",
        ".K" + "6" * 43 + "5K.",
        ".K" + "6666" + "55555" + "66666666666666" + "55555" + "666666666666" + "5554" + "K.",
        ".K" + "5" * 40 + "4444" + "K.",
        "K" + "4" * 45 + "3K",
        "K" + "3" * 44 + "21K",
        "K" * 48,
        "Kd" + "c" * 44 + "bK",
    ]
    for p_ in pan:
        rows.append("Kdc" + p_ * 3 + "cbK")
    rows += ["Kd" + "c" * 44 + "bK", "Kd" + "c" * 44 + "bK", "K" + "b" * 46 + "K", "K" + "a" * 46 + "K", "K" * 48]
    ledger = ["KKKKKKKKK", "KkkkkkkkK", "KtttttttK", "KsssssssK", "KKKKKKKKK"]
    stone = [".KKKK.", "KAABBK", "KBBCCK", "KKKKKK"]
    rows = deink(rows, 'e', 'a', 'f')
    rows[4] = "e" + "4" * 46 + "a"      # 윗판 앞 모서리 mu 4 띠(두 줄: 4·5행)
    rows[5] = "e" + "4" * 45 + "3a"
    deco = [(deink(ABACUS, 'd', 'a', 'e'), 5, 9), (deink(ledger, 'u', 'r', 'v'), 23, 10), (deink(stone, 'E', 'A', 'F'), 36, 11)]
    return counter(rows, leg('mu'), deco, '줄 A · 짙은 나무 계산대(윗면 결)·앞면 주칠 판 셋·짙은 굽. 위에 주판·장부(붉은 겉장)·벼루.')


def counter_a2():
    # 왼쪽 36열 = 흰 회벽 몸통(짙은 나무 윗판·청석 굽), 35열 = 들판 경첩 줄, 오른쪽 = 들어 올리는 판 + 끝 기둥(아래가 트인 출입구)
    rows = [
        ".K" + "K" * 44 + "K.",
        ".K" + "f" * 10 + "e" * 23 + "K" + "e" * 9 + "d" + "K.",
        ".K" + "eeee" + "dddd" + "e" * 25 + "K" + "eeee" + "dd" + "eee" + "c" + "K.",
        ".K" + "d" * 33 + "K" + "d" * 9 + "c" + "K.",
        "K" + "c" * 34 + "K" + "c" * 10 + "bK",
        "K" * 48,
        "K" + "6" * 32 + "54K" + "......" + "KeddcK",
        "K6" + "5" * 31 + "43K" + "......" + "KeddcK",
        "K6" + "5" * 2 + "4" * 12 + "5" * 3 + "4" * 12 + "5" * 2 + "43K" + "......" + "KeddcK",
        "K6" + "5" * 2 + "4" + "6" * 10 + "3" + "5" * 3 + "4" + "6" * 10 + "3" + "5" * 2 + "43K" + "......" + "KdccbK",
        "K6" + "5" * 2 + "4" + "6" * 10 + "3" + "5" * 3 + "4" + "6" * 10 + "3" + "5" * 2 + "43K" + "......" + "KdccbK",
        "K6" + "5" * 2 + "3" * 12 + "5" * 3 + "3" * 12 + "5" * 2 + "43K" + "......" + "KdccbK",
        "K" + "4" * 33 + "3K" + "......" + "KdccbK",
        "K" + "F" * 33 + "EK" + "......" + "KFFEEK",
        "K" + "E" * 33 + "DK" + "......" + "KEEDDK",
        "K" + "D" * 33 + "CK" + "......" + "KDDCCK",
        "K" + "C" * 33 + "BK" + "......" + "KCCBBK",
        "K" + "B" * 33 + "AK" + "......" + "KBBAAK",
        "K" + "A" * 33 + "AK" + "......" + "KAAAAK",
        "K" * 36 + "......" + "KKKKKK",
    ]
    box = ["KKKKKKK", "KvvvvuK", "KuKKKtK", "KtttssK", "KKKKKKK"]
    tray = ["KKKKKKKKKK", "KfjfjfjeeK", "KeeeeeeedK", "KKKKKKKKKK"]
    deco = [(ABACUS, 4, 9), (box, 20, 9), (tray, 37, 11)]
    return counter(rows, leg('bai'), deco,
                   '줄 A · 흰 회벽 몸통 계산대(짙은 나무 윗판·청석 굽, 회벽에 들어간 판 둘)·오른쪽 끝은 들어 올리는 판(아래가 트인 출입구·끝 기둥). 위에 주판·돈궤·잔 쟁반.')


def counter_b1():
    pan = ["cdddddddddddddc", "cdbbbbbbbbbbbac", "cdbbbbbcbbbbbac", "cdbbbbbbbbbbbac",
           "cdbbbbbbbbbcbac", "cdbbbbbbbbbbbac", "caaaaaaaaaaaaac"]
    rows = [
        ".K" + "K" * 44 + "K.",
        ".K" + "6" * 43 + "5K.",
        ".K" + "66666666" + "55" + "6" * 19 + "55" + "6" * 11 + "54" + "K.",
        ".K" + "5" * 40 + "4444" + "K.",
        "K" + "t" * 45 + "sK",
        "K" + "s" * 44 + "rrK",
        "K" * 48,
        "K" + "c" * 46 + "K",
    ]
    for p_ in pan:
        rows.append("Kc" + p_ * 3 + "K")
    rows += ["K" + "c" * 46 + "K", "K" + "a" * 46 + "K", "K" + "C" * 46 + "K", "K" + "B" * 46 + "K", "K" * 48]
    tea = ["KKKKKKKKK", "KndcndcnK", "KnnnnnnnK", "KKKKKKKKK"]      # 쟁반 위 자사 잔 둘(흰 점 없이)
    teapot = ["....ab....", "..aeeddca.", "baeedddcaa", "badddcccba", "..abbbbba."]
    rows = deink(rows, '6', '0', '6')
    deco = [(deink(ABACUS, 'd', 'a', 'e'), 6, 9), (deink(tea, 'e', 'a', 'f'), 26, 11), (teapot, 37, 9)]
    L_ = leg('song')
    L_['a'] = ('mu', 1)
    return counter(rows, L_, deco,
                   '줄 B · 소나무 윗판에 주칠 앞 모서리·짙은 나무 판벽 앞면(style B 징두리 판)·청석 굽. 위에 주판·자사 잔 쟁반·자사 찻주전자.')


def counter_b2():
    rows = [
        ".K" + "K" * 44 + "K.",
        ".K" + "6" * 43 + "5K.",
        ".K" + "6666" + "55555" + "6" * 16 + "55555" + "6" * 10 + "5554" + "K.",
        ".K" + "4" * 40 + "3333" + "K.",
        "K" + "y" * 45 + "xK",
        "K" + "x" * 44 + "XXK",
        "K" * 48,
        "K" + "c" * 46 + "K",
    ]
    for j in range(7):
        rows.append("Kc" + ("Ktvt" * 11) + "cK")
    rows += ["Kc" + "y" * 44 + "cK", "K" + "b" * 46 + "K", "K" + "a" * 46 + "K", "K" + "a" * 46 + "K", "K" * 48]
    books = ["KKKKKKKK", "KjjjjjjK", "KSSSSSSK", "KjjjjjjK", "KRRRRRRK", "KKKKKKKK"]
    jug = ["..KK..", ".KPOK.", "KPOONK", "KONNMK", "KNMMMK", ".KKKK."]
    coins = ["KyK.KyK", "KxK.KxK"]
    deco = [(books, 6, 8), (jug, 20, 8), (coins, 31, 13)]
    return counter(rows, leg('mu'), deco,
                   '줄 B · 짙은 나무 윗판에 금 앞 모서리·주칠 세로 살 앞면·금 띠. 위에 장부 더미(청회 겉장)·황토 술병·엽전.')


# ---------------------------------------------------------------------------
# 5. 부엌 아궁이·솥 (2×2)
# ---------------------------------------------------------------------------
POT_LID_A = [          # 나무 뚜껑 덮은 솥 12×7: 쇠 솥 테(B C) 안에 뚜껑(나무), 손잡이 한 줄
    "...KKKKKK...",
    ".KKffffeeKK.",
    "KCfeeKKeddCK",
    "KCeedddddcCK",
    "KBdddcccccBK",
    ".KBBBBBBBBK.",
    "..KKKKKKKK..",
]


def front28(inner):
    assert len(inner) == 28, (len(inner), inner)
    return R((1, "K" + inner + "K"))


def stove_a1():
    L_ = leg('bai')
    rows = ['.' * 32] * 7 + [
        R((1, "K" * 30)),
        R((1, "KD" + "D" * 26 + "CK")),
        R((1, "KD" + "6" * 26 + "CK")),
        R((1, "KD" + "6" * 25 + "5CK")),
        R((1, "KD" + "5" * 26 + "CK")),
        R((1, "KD" + "5" * 25 + "4CK")),
        R((1, "KD" + "5" * 24 + "44CK")),
        R((1, "KC" + "4" * 24 + "33BK")),
        R((1, "KB" + "B" * 26 + "AK")),
        R((1, "K" * 30)),
        front28("6" + "5" * 25 + "43"),
        front28("5" * 25 + "433"),
        front28("55KKKKKKKK5555555KKKKKKKK433"),
        front28("55KtuvvutK5555555KtuvvutK433"),
        front28("55KuvZZvuK5555555KuvZZvuK433"),
        front28("44KuzZZzuK4444444KuzZZzuK332"),
        front28("44KvzZZzvK4444444KvzZZzvK322"),
        front28("44KuLmnLuK4444444KuLmnLuK322"),
        front28("33KKKKKKKK3333333KKKKKKKK221"),
        front28("3" * 24 + "2211"),
        R((1, "K" + "E" * 28 + "K")),
        R((1, "K" + "D" * 28 + "K")),
        R((1, "K" + "C" * 28 + "K")),
        R((1, "K" + "B" * 28 + "K"), (31, "~")),
        R((1, "K" * 30), (31, "~")),
    ]
    assert len(rows) == 32, len(rows)
    cv = canvas(rows, L_, 32, 32)
    stamp(cv, POT_LID_A, L_, 3, 7)
    stamp(cv, POT_LID_A, L_, 16, 7)
    return cv, {'top': (9, 14), 'note': '줄 A · 흰 회벽 바른 아궁이(청석 테두리 윗면·청석 굽)·나무 뚜껑 덮은 쇠솥 둘·앞면 아궁이 둘에 장작과 불빛.'}


def stove_a2():
    L_ = leg('bai')
    rows = [
        R((22, "KKKKKKK")),
        R((22, "KjAAAiK")),
        R((22, "KkjjjiK")),
        R((22, "KjjjjhK")),
        R((22, "KjjjjhK")),
        R((22, "KiiiihK")),
        R((22, "KiiiihK")),
        R((1, "K" * 21), (22, "KhhhhgK"), (29, "KK")),
        R((1, "K" + "F" * 20), (22, "KgggggK"), (29, "FK")),
        R((1, "K" + "F" * 28 + "K")),
        R((1, "KF" + "E" * 26 + "DK")),
        R((1, "KE" + "E" * 25 + "DDK")),
        R((1, "KE" + "E" * 25 + "DDK")),
        R((1, "KE" + "E" * 25 + "DDK")),
        R((1, "K" + "D" * 26 + "CCK")),
        R((1, "K" * 30)),
        front28("6" * 26 + "55"),
        front28("5" * 26 + "44"),
        front28("555555" + "K" * 14 + "55555544"),
        front28("55555" + "KtuvvvvvvvvvvutK" + "5555544"),
        front28("55555" + "KuvzZZZZZZZZzvuK" + "5555443"),
        front28("44444" + "KvzZZZZZZZZZZzvK" + "4444433"),
        front28("44444" + "KvzLmnoLmnoLmzvK" + "4444433"),
        front28("44444" + "KuLmnoLmnoLmnouK" + "4444332"),
        front28("33333" + "K" * 16 + "3333322"),
        front28("3" * 25 + "222"),
        front28("2" * 26 + "11"),
        R((1, "K" + "E" * 28 + "K")),
        R((1, "K" + "D" * 28 + "K")),
        R((1, "K" + "C" * 28 + "K")),
        R((1, "K" + "B" * 28 + "K"), (31, "~")),
        R((1, "K" * 30), (31, "~")),
    ]
    assert len(rows) == 32, len(rows)
    rows = deink_mat(rows, L_)
    cv = canvas(rows, L_, 32, 32)
    stamp(cv, POT_BIG_N, L_, 3, 4)       # 솥 밑이 윗판 안쪽에 앉고 앞으로 윗판 윗면 2~3행이 보이게
    stamp(cv, POT_SMALL_N, L_, 17, 6)
    return cv, {'top': (9, 14), 'note': '줄 A · 청석 윗판 아궁이·뒤 오른쪽에 흰 회벽 굴뚝·큰 솥과 작은 솥(소나무 뚜껑)·앞면 넓은 아궁이 하나에 장작과 불빛.'}


POT_BIG = [            # 쇠솥 14×8 + 소나무 뚜껑(손잡이 한 줄)
    "....KKKKKK....",
    "..KKpppoooKK..",
    ".KCppoKKoonnCK"[:14],
    "KCoooonnnnnmCK",
    "KCnnnnmmmmmlCK",
    "KBmmmmllllllBK",
    ".KBBBBBBBBBBK.",
    "..KKKKKKKKKK..",
]
POT_BIG[2] = ".KCppoKKoonnCK"
POT_SMALL = [          # 작은 솥 10×6
    "..KKKKKK..",
    ".KpooooonK",
    "KCooKKnnCK",
    "KCnnnmmmCK",
    ".KBBBBBBK.",
    "..KKKKKK..",
]
POT_SMALL[1] = ".KpooooonK"[:9] + "."
POT_SMALL[1] = ".KpooonnK."


POT_BIG_N = [          # 먹 없는 쇠솥 14×9: 소나무 뚜껑 둥근 윗면 + 손잡이 꼭지 + 쇠 테 띠 + 몸
    "......pp......",
    "....mpoonm....",
    "..mpppooonnlm.",
    ".mpooooonnnllm",
    "CEFEEEEEEEEEEC",
    "BDEDDDDDDDDDCB",
    ".BDCCCCCCCCBA.",
    "..BBBBBBBBAA..",
    "...AAAAAAAA...",
]
POT_SMALL_N = [        # 먹 없는 작은 솥 10×7
    "....pp....",
    "..mpoonm..",
    ".mpooonnlm",
    "CEFEEEEEEC",
    ".CDDDDDDB.",
    ".BCCCCCBA.",
    "..AAAAAA..",
]


def stove_b1():
    # 황토 아궁이: 윗판 황토, 앞 모서리에 청회 기와 턱, 큰 솥·작은 솥, 앞면 넓은 아궁이 하나(불빛)와 장작 두 개비
    rows = ['.' * 32] * 8 + [
        R((1, "K" * 30)),
        R((1, "K" + "6" * 27 + "5K")),
        R((1, "K6" + "5" * 26 + "4K")),
        R((1, "K" + "5" * 27 + "4K")),
        R((1, "K" + "5" * 26 + "44K")),
        R((1, "K" + "5" * 26 + "44K")),
        R((0, "K" + "WV" * 15 + "K")),
        R((0, "K" + "TS" * 15 + "K")),
        R((0, "K" * 32)),
        R((0, "K5" + "4" * 28 + "3K")),
        R((0, "K5" + "4" * 28 + "3K")),
        R((0, "K5" + "4" * 28 + "3K")),
        R((0, "K5" + "4" * 6 + "K" * 16 + "4" * 6 + "3K")),
        R((0, "K5" + "4" * 5 + "K" + "tuvvvvvvvvvvvvut" + "K" + "4" * 5 + "3K")),
        R((0, "K5" + "4" * 5 + "K" + "uvzZZZZZZZZZZzvu" + "K" + "4" * 5 + "3K")),
        R((0, "K4" + "3" * 5 + "K" + "vzZZZZZZZZZZZZzv" + "K" + "3" * 5 + "2K")),
        R((0, "K4" + "3" * 5 + "K" + "uvLmnoLmnoLmnozu" + "K" + "3" * 5 + "2K")),
        R((0, "K4" + "3" * 5 + "K" + "tLmnoLmnoLmnoLut" + "K" + "3" * 5 + "2K")),
        R((0, "K4" + "3" * 5 + "K" * 18 + "3" * 5 + "2K")),
        R((0, "K3" + "2" * 28 + "1K")),
        R((0, "K3" + "2" * 28 + "1K")),
        R((0, "K" + "a" * 30 + "K")),
        R((0, "K" + "a" * 30 + "K")),
        R((0, "K" * 32)),
    ]
    rows = [r_ for r_ in rows]
    assert len(rows) == 32, len(rows)
    L_ = leg('huang')
    rows = deink_mat(rows, L_)
    cv = canvas(rows, L_, 32, 32)
    stamp(cv, POT_BIG_N, L_, 2, 3)       # 솥 밑이 윗판 안쪽에 앉고 앞으로 윗판 윗면 2행이 보이게
    stamp(cv, POT_SMALL_N, L_, 19, 5)
    return cv, {'top': (9, 14), 'note': '줄 B · 황토 아궁이(앞 모서리 청회 기와 턱)·큰 솥과 작은 솥(소나무 뚜껑)·앞면 넓은 아궁이에 장작과 불빛.'}


STEAMER = [            # 대나무 대신 소나무 찜통 세 층 12×13 (뚜껑 윗면 + 층 띠) — 아래는 쇠솥 테
    "...KKKKKK...",
    ".KKppppooKK.",
    "KopppooonnmK",
    "KKKKKKKKKKKK",
    "KnoonnnnmmlK",
    "KmmmlmmmmllK",
    "KKKKKKKKKKKK",
    "KnoonnnnmmlK",
    "KmmmlmmmmllK",
    "KKKKKKKKKKKK",
    "KCDDDDDDDDCK",
    ".KCCCCCCCCK.",
    "..KKKKKKKK..",
]
KETTLE = [
    "...KK...",
    "..KdcK..",
    ".KKKKKK.",
    "KedddccK",
    "KddcccbKK",
    "KcccbbbKb",
    ".KKKKKK..",
]
KETTLE = [r_.ljust(9, '.') for r_ in KETTLE]


def stove_b2():
    # 벽돌 아궁이(황토 벽돌·줄눈)·왼쪽에 찜통 세 층이 솥 위로 높이 선다·오른쪽 주전자·앞면 둥근 아궁이 하나
    brick_a = "K" + ("NNNNNNMK" * 4)[:30] + "K"
    brick_b = "K" + ("NNNMKNNN" * 4)[:30] + "K"
    rows = ['.' * 32] * 10 + [
        R((1, "K" * 30)),
        R((1, "K" + "Q" * 27 + "PK")),
        R((1, "KQ" + "P" * 26 + "OK")),
        R((1, "K" + "P" * 26 + "OOK")),
        R((1, "K" + "O" * 26 + "NNK")),
        R((0, "K" + "N" * 30 + "K")),
        R((0, "K" * 32)),
        R((0, "K" + "P" * 30 + "K")),
        R((0, brick_a)),
        R((0, "K" + "M" * 30 + "K")),
        R((0, brick_b[:10] + "KKKKKKKKKKKK" + brick_b[22:])),
        R((0, brick_a[:9] + "KtuvvvvvvutK" + brick_a[21:])[:32]),
        R((0, "K" + "M" * 7 + "KuvzZZZZzvuK" + "M" * 11 + "K")),
        R((0, brick_b[:8] + "KvzZZZZZZzvK" + brick_b[20:])),
        R((0, brick_a[:8] + "KvzLmnLmnzvK" + brick_a[20:])),
        R((0, "K" + "M" * 7 + "KuLmnoLmnouK" + "M" * 11 + "K")),
        R((0, brick_b[:8] + "KKKKKKKKKKKK" + brick_b[20:])),
        R((0, "K" + "M" * 30 + "K")),
        R((0, "K" + "a" * 30 + "K")),
        R((0, "K" + "a" * 30 + "K")),
        R((0, "K" * 32)),
        R((0, "." * 32)),
    ]
    rows = rows[:31] + [R((0, "K" * 32))]
    rows[30] = R((0, "K" + "a" * 30 + "K"))
    assert len(rows) == 32, len(rows)
    L_ = leg('huang')
    cv = canvas(rows, L_, 32, 32)
    stamp(cv, STEAMER, L_, 3, 2)
    stamp(cv, KETTLE, L_, 20, 8)
    return cv, {'top': (11, 15), 'note': '줄 B · 황토 벽돌 아궁이(줄눈)·솥 위에 소나무 찜통 세 층(뚜껑 윗면)·주전자·앞면 둥근 아궁이에 장작과 불빛.'}


# ---------------------------------------------------------------------------
# 6. 술독 (2×1) — 붉은 천으로 입 막은 독. 입(천) 윗면 타원이 보인다. 바닥이 칸 아래 경계.
# ---------------------------------------------------------------------------
def jars(parts, legend, note, top, shadow=()):
    cv = Cv(32, 16)
    for r_, x, y in parts:
        stamp(cv, r_, legend, x, y)
    for x, y in shadow:
        cv.shadow(x, y)
    return cv, {'top': top, 'note': note}


JAR_A = [              # 11×14 독: 붉은 천(윗면 2행)·끈·어깨·몸통(왼쪽 빛)·굽
    "...KKKKK...",
    "..KvvvvuK..",
    ".KuvvuuutK.",
    ".KKtttttKK.",
    "..KKKKKKK..",
    ".K6555544K.",
    "K655555443K",
    "K655555443K",
    "K555555433K",
    "K555554432K",
    "K455544332K",
    ".K4443322K.",
    ".K3332221K.",
    "..KKKKKKK..",
]
JAR_S = [              # 9×11 작은 독
    "..KKKKK..",
    ".KvvvuuK.",
    ".KtttttK.",
    "..KKKKK..",
    ".K65544K.",
    "K6555443K",
    "K5555433K",
    "K4554332K",
    ".K44332K.",
    ".K33221K.",
    "..KKKKK..",
]


def jars_a1():
    L_ = leg('mu')
    js, ja = deink_mat(JAR_S, L_), deink_mat(JAR_A, L_)
    return jars([(js, 0, 5), (js, 22, 5), (ja, 10, 2)], L_,
                '줄 A · 짙은 갈색 유약 독 셋(가운데 큰 독)·붉은 천으로 입을 막고 끈으로 묶었다.', (6, 8),
                shadow=((31, 14), (31, 15), (21, 15)))


JAR_W = [              # 12×14 흰 유약 독 + 붉은 네모 종이(글자 없음, 테두리만 짙다)
    "...KKKKKK...",
    "..KvvvvvuK..",
    ".KuvvvuuutK.",
    ".KKKttttKKK.",
    "..KKKKKKKK..",
    ".K66666554K.",
    "K666666554 K".replace(' ', '4'),
    "K666tuuu54 K".replace(' ', '4'),
    "K666tvvu543K",
    "K666tvvu543K",
    "K555ssst443K",
    ".K55544433K.",
    ".K44443332K.",
    "..KKKKKKKK..",
]


def jars_a2():
    jug = [".KK.", "KhgK", "KihK", ".KK."]
    return jars([(JAR_W, 0, 2), (JAR_W, 13, 2), (jug, 27, 12)], leg('bai'),
                '줄 A · 흰 유약 큰 독 둘에 붉은 마름모 종이(글자 없음)·작은 흰 술병 하나.', (3, 5),
                shadow=((25, 15), (25, 14), (31, 15)))


JAR_H = [              # 11×14 황토 독: 붉은 천·새끼줄(황토 밝은 띠) 두 줄
    "...KKKKK...",
    "..KvvvvuK..",
    ".KuvvuuutK.",
    ".KKtttttKK.",
    "..KQPPPOK..",
    ".K6555544K.",
    "K655555443K",
    "KQPPPPPOOOK",
    "K555555433K",
    "K555554432K",
    "KQPPPPPOONK",
    ".K4443322K.",
    ".K3332221K.",
    "..KKKKKKK..",
]


def deep_shade(rows, legend, spare_light=False):
    """그늘 쪽(오른쪽·아래가 트인) 가장자리를 재질 어두운 단으로: 황토 0단, 붉은 천 1단(먹 아님).
    바닥(붉은 줄)과의 대비를 지키는 그늘 쪽 예외."""
    h, w = len(rows), len(rows[0])
    inv = {v: k for k, v in legend.items() if isinstance(v, tuple)}
    out = []
    for y in range(h):
        cs = list(rows[y])
        for x in range(w):
            c = cs[x]
            v = legend.get(c)
            if c in '.~' or not isinstance(v, tuple):
                continue
            right = x + 1 >= w or rows[y][x + 1] == '.'
            below = y + 1 >= h or rows[y + 1][x] == '.'
            if spare_light:
                up = y == 0 or rows[y - 1][x] == '.'
                left = x == 0 or rows[y][x - 1] == '.'
                if up:
                    continue
            if right or below:
                tgt = (v[0], 0 if v[0] in ('huang', 'jin') else min(v[1], 1))
                cs[x] = inv.get(tgt, c)
        out.append(''.join(cs))
    return out


def lift_light(rows, legend, d=3):
    """빛 쪽(위·왼이 트이고 오른쪽·아래는 막힌) 가장자리의 0~1단을 d 단 밝힌다(그늘 쪽은 건드리지 않음)."""
    h, w = len(rows), len(rows[0])
    inv = {v: k for k, v in legend.items() if isinstance(v, tuple)}
    out = []
    for y in range(h):
        cs = list(rows[y])
        for x in range(w):
            v = legend.get(cs[x])
            if cs[x] in '.~' or not isinstance(v, tuple) or v[1] > 1:
                continue
            up = y == 0 or rows[y - 1][x] == '.'
            left = x == 0 or rows[y][x - 1] == '.'
            right = x + 1 >= w or rows[y][x + 1] == '.'
            below = y + 1 >= h or rows[y + 1][x] == '.'
            if (up or left) and not (right or below):
                cs[x] = inv.get((v[0], min(6, v[1] + d)), cs[x])
        out.append(''.join(cs))
    return out


def jars_b1():
    L_ = leg('huang')
    jh, js = deep_shade(deink_mat(JAR_H, L_), L_), deep_shade(deink_mat(JAR_S, L_), L_)
    return jars([(jh, 0, 2), (js, 11, 5), (jh, 20, 2)], L_,
                '줄 B · 황토 독 둘(새끼줄 두 줄)·작은 독 하나, 붉은 천으로 입을 막았다.', (3, 5),
                shadow=((31, 14), (31, 15), (10, 15), (19, 15), (9, 15), (20, 15)))


STAND = [              # 낮은 소나무 받침 32×4: 윗면 2행 + 앞면 + 발
    "K" * 32,
    "Kppppppppppppppppppppppppppppoo K".replace(' ', 'K'),
    "Kmmmmmmmmmmmmmmmmmmmmmmmmmmmmml K".replace(' ', 'K'),
    "KKK" + "." * 26 + "KKK",
]
STAND[1] = "K" + "p" * 28 + "ooK"
STAND[2] = "K" + "m" * 29 + "lK"


def jars_b2():
    jd = dict(leg('mu'))
    return jars([(STAND, 0, 12), (JAR_S, 2, 2), (JAR_S, 12, 2), (JAR_S, 21, 2)], jd,
                '줄 B · 낮은 소나무 받침(윗면) 위에 짙은 유약 작은 독 셋. 받침 발이 칸 아래 경계에 닿는다.', (3, 5))


# ---------------------------------------------------------------------------
# 7. 차림판 (2×1, 벽에 거는 판 — 둘레 투명, 층은 wall). 글자 없이 색 판·색 띠만.
# ---------------------------------------------------------------------------
def board(rows, legend, note, top):
    assert len(rows) == 16 and all(len(r_) == 32 for r_ in rows), [len(r_) for r_ in rows]
    return canvas(rows, legend, 32, 16), {'top': top, 'note': note}


def menu_a1():
    slips = "kk" + "rutrk" * 4 + "kk"
    ends = "kk" + "rssrk" * 4 + "kk"
    rows = [
        R(),
        R((2, "e" + "f" * 26 + "b")),
        R((2, "e" + "f" * 25 + "db")),
        R((2, "d" + "e" * 25 + "cb")),
        R((1, "c" + "b" * 28 + "a")),
        R((2, "cc" + "k" * 24 + "ba")),
        R((2, "cc" + slips + "ba")),
        R((2, "cc" + slips + "ba")),
        R((2, "cc" + slips + "ba")),
        R((2, "cc" + slips + "ba")),
        R((2, "cc" + ends + "ba")),
        R((2, "cc" + "j" * 24 + "ba")),
        R((2, "c" + "b" * 26 + "a")),
        R((2, "a" * 28), (30, "~")),
        R((3, "~" * 28)),
        R(),
    ]
    return board(rows, leg('bai'), '줄 A · 짙은 나무 갓(윗면 3행, 먹선 없음)·테를 두른 흰 판에 붉은 종이 띠 넷(글자 없음).', (1, 4))


def menu_a2():
    rows = [
        R(),
        R((1, "K" * 30)),
        R((1, "K" + "f" * 27 + "eK")),
        R((1, "K" + "e" * 26 + "ddK")),
        R((1, "K" + "c" * 26 + "bbK")),
        R((1, "K" * 30)),
        R((3, "K..K..K..K..K..K..K..K")),
        R((2, "KKK" + "KKKK" * 6 + "K")),
        R((2, "K6K" + "KuK.K5K." * 3 + "K")),
    ]
    tagA = ["KKK", "K6K", "K5K", "K5K", "K4K", "K4K", "KKK"]
    tagB = ["KKK", "KvK", "KuK", "KuK", "KtK", "KtK", "KKK"]
    rows = [
        R(),
        R((1, "K" * 30)),
        R((1, "K" + "f" * 27 + "eK")),
        R((1, "K" + "e" * 26 + "ddK")),
        R((1, "K" + "c" * 26 + "bbK")),
        R((1, "K" * 30)),
    ]
    xs = [3, 7, 11, 15, 19, 23, 27]
    body = [['.'] * 32 for _ in range(10)]
    for i, x in enumerate(xs):
        body[0][x + 1] = 'K'                   # 고리
        t = tagA if i % 2 == 0 else tagB
        dy = 1 if i % 3 == 1 else 0
        for j, r_ in enumerate(t):
            for k, ch in enumerate(r_):
                body[1 + dy + j][x + k] = ch
        body[8 + dy][x + 3] = '~'
    rows += [''.join(r_) for r_ in body]
    L_ = leg('song')
    return board(rows, L_, '줄 A · 짙은 나무 걸이대(윗면 2행)에 소나무 패·주칠 패를 번갈아 건 차림 패 일곱(글자 없음).', (2, 4))


def menu_b1():
    rows = [
        R(),
        R((2, "y" + "z" * 26 + "x")),
        R((2, "y" + "z" * 25 + "yx")),
        R((2, "x" + "y" * 25 + "xX")),
        R((1, "t" + "s" * 28 + "r")),
        R((2, "tv" + "u" * 24 + "sr")),
        R((2, "tu" + "QQPQQPQQPQQPQQPQQPQQPQQP" + "sr")),
        R((2, "tu" + "PPOPPOPPOPPOPPOPPOPPOPPO" + "sr")),
        R((2, "tu" + "PPOPPOPPOPPOPPOPPOPPOPPO" + "sr")),
        R((2, "tu" + "OONOONOONOONOONOONOONOON" + "sr")),
        R((2, "tu" + "t" * 24 + "sr")),
        R((2, "t" + "s" * 26 + "r")),
        R((2, "r" * 28), (30, "~")),
        R((3, "yxX"), (11, "yxX"), (19, "yxX"), (27, "yxX")),
        R((3, "yXX"), (11, "yXX"), (19, "yXX"), (27, "yXX"), (30, "~")),
        R((4, "X"), (12, "X"), (20, "X"), (28, "X")),
    ]
    L_ = {**leg('huang'), '@': ('jin', 0)}
    rows = deep_shade(rows, L_)
    return board(rows, L_, '줄 B · 금 갓(윗면 3행, 먹선 없음)·주칠 테 안에 황토 종이 띠 여덟·아래 금 술 넷(글자 없음).', (1, 4))


def menu_b2():
    rows = [
        R((4, "K" * 24)),
        R((3, "KWVWVWVWVWVWVWVWVWVWVWVWK")[:26]),
        R((2, "KVUVUVUVUVUVUVUVUVUVUVUVUVK")[:28]),
        R((1, "KKTSTSTSTSTSTSTSTSTSTSTSTSTKK")[:30]),
        R((1, "K" * 30)),
        R((3, "Kd" + "c" * 22 + "bK")),
        R((3, "Kc" + "PPKQQKPPKQQKPPKQQKPPKQ" + "aK")),
        R((3, "Kc" + "OOKPPKOOKPPKOOKPPKOOKP" + "aK")),
        R((3, "Kc" + "OOKPPKOOKPPKOOKPPKOOKP" + "aK")),
        R((3, "Kc" + "NNKOOKNNKOOKNNKOOKNNKO" + "aK")),
        R((3, "Kb" + "a" * 22 + "aK")),
        R((3, "K" * 26), (29, "~")),
        R((4, "~" * 25)),
        R(),
        R(),
        R(),
    ]
    rows[1] = R((3, "K" + "WV" * 12 + "K"))
    rows[2] = R((2, "K" + "VU" * 13 + "K"))
    rows[3] = R((1, "K" + "TS" * 14 + "K"))
    return board(rows, leg('mu'), '줄 B · 청회 기와 갓을 얹은 짙은 나무 판(담머리 화법)·황토 종이 띠(글자 없음).', (1, 4))


# ---------------------------------------------------------------------------
# 8. 종이 등롱 (2×1 세트: hang 매다는 것 · stand 세우는 것)
# ---------------------------------------------------------------------------
def lantern_set(hang, stand, legend, note, top_h, top_s):
    assert len(hang) == 16 and all(len(r_) == 16 for r_ in hang), [len(r_) for r_ in hang]
    assert len(stand) == 16 and all(len(r_) == 16 for r_ in stand), [len(r_) for r_ in stand]
    rows = [h_ + s_ for h_, s_ in zip(hang, stand)]
    cv = canvas(rows, legend, 32, 16)
    return cv, {'note': note, 'pieces': {'hang': {'top': top_h}, 'stand': {'top': top_s}}}


def R16(*segs):
    return R(*segs, w=16)


def lantern_a1():
    hang = [
        R16((7, "KK")),
        R16((7, "KK")),
        R16((5, "KKKKKK")),
        R16((4, "KyzzzyxK")),
        R16((4, "KxyyxxXK")),
        R16((3, "KKKKKKKKKK")),
        R16((2, "KvwwwvvuutK")),
        R16((2, "KwZZwwvuutK")),
        R16((2, "KwZZwwvuutK")),
        R16((2, "KvwwwvvuutK")),
        R16((2, "KuvvvuuttsK")),
        R16((3, "KKKKKKKKKK")),
        R16((4, "KyxxxxXK")),
        R16((5, "KKKKKK")),
        R16((6, "KuutK")),
        R16((7, "KsK")),
    ]
    stand = [
        R16(),
        R16(),
        R16((5, "KKKKKK")),
        R16((4, "KyzzzyxK")),
        R16((3, "KKKKKKKKKK")),
        R16((3, "KvwwwvuutK")),
        R16((3, "KwZZwvuutK")),
        R16((3, "KvwwwvuutK")),
        R16((3, "KKKKKKKKKK")),
        R16((5, "KyxxXK")),
        R16((6, "KdcK")),
        R16((6, "KdcK")),
        R16((6, "KdcK"), (10, "~")),
        R16((3, "KKKKKKKKKK")),
        R16((3, "KeeeeddccK"), (13, "~")),
        R16((3, "KKKKKKKKKK"), (13, "~~")),
    ]
    L_ = {**leg('zhu'), '@': ('jin', 0)}
    hang, stand = deep_shade(deink_mat(hang, L_), L_, True), deep_shade(deink_mat(stand, L_), L_, True)
    return lantern_set(hang, stand, L_, '줄 A · 둥근 붉은 종이 등롱(금 뚜껑 윗면·밝은 가운데)·매다는 것은 끈과 술, 세우는 것은 짙은 나무 기둥과 받침.',
                       (3, 5), (3, 5))


def lantern_a2():
    hang = [
        R16((7, "KK")),
        R16((4, "KKKKKKKK")),
        R16((3, "KeeeeeeddK")),
        R16((3, "KddddddccK")),
        R16((2, "KKKKKKKKKKKK")),
        R16((2, "KcKwwwvvKbK.")),
        R16((2, "KcKwZZwvKbK.")),
        R16((2, "KcKwZZwvKbK.")),
        R16((2, "KcKvwwvuKbK.")),
        R16((2, "KcKuvvutKbK.")),
        R16((2, "KKKKKKKKKKKK")),
        R16((3, "KddddddccK")),
        R16((4, "KKKKKKKK")),
        R16((2, "Ku"), (7, "KuK"), (12, "uK")),
        R16((2, "Kt"), (7, "KtK"), (12, "tK")),
        R16((3, "s"), (8, "s"), (12, "s")),
    ]
    stand = [
        R16((5, "KKKKKK")),
        R16((4, "KeeeedK")),
        R16((4, "KddddcK")),
        R16((3, "KKKKKKKKKK")),
        R16((3, "KcKwwvKbK")),
        R16((3, "KcKwZvKbK")),
        R16((3, "KcKuvuKbK")),
        R16((3, "KKKKKKKKK")),
        R16((4, "KdcccbK")),
        R16((4, "KKdcbKK")),
        R16((5, "KdcbK")),
        R16((5, "KdcbK")),
        R16((4, "KdKdbKbK"), (12, "~")),
        R16((3, "KdK.K.KbK"), (12, "~")),
        R16((2, "KdK..K..KbK"), (13, "~")),
        R16((2, "KKK..K..KKK"), (13, "~~")),
    ]
    return lantern_set(hang, stand, leg('zhu'), '줄 A · 짙은 나무 틀 육각 궁등(위 갓 윗면·붉은 종이 면·술 셋)·세우는 것은 다리 셋 받침 위 작은 궁등.',
                       (2, 4), (1, 3))


def lantern_b1():
    hang = [
        R16((7, "KK")),
        R16((6, "KyyK")),
        R16((5, "KKKKKK")),
        R16((4, "KzZZzyxK")),
        R16((4, "KyzzyxXK")),
        R16((4, "KKKKKKKK")),
        R16((3, "KvwZZvuutK")),
        R16((3, "KwZZZwvutK")),
        R16((3, "KwZZZwvutK")),
        R16((3, "KvwZwvuutK")),
        R16((4, "KvvuuttK")),
        R16((4, "KKKKKKKK")),
        R16((5, "KyxxXK")),
        R16((6, "KyyK")),
        R16((6, "KxxK")),
        R16((7, "XX")),
    ]
    stand = [
        R16((5, "KKKKKK")),
        R16((4, "KzZZyxK")),
        R16((4, "KyzyxXK")),
        R16((4, "KKKKKKK")),
        R16((4, "KwZvutK")),
        R16((4, "KwZvutK")),
        R16((4, "KvvutsK")),
        R16((4, "KKKKKKK")),
        R16((5, "KyxXK")),
        R16((6, "KxK")),
        R16((6, "KxK")),
        R16((6, "KxK"), (9, "~")),
        R16((4, "KKKKKKK"), (11, "~")),
        R16((3, "KzzyyxxXK"), (12, "~")),
        R16((3, "KyyxxXXXK"), (12, "~~")),
        R16((3, "KKKKKKKKK"), (12, "~~")),
    ]
    L_ = {**leg('zhu'), '@': ('jin', 0)}
    hang, stand = (lift_light(deep_shade(deink_mat(r, L_), L_), L_) for r in (hang, stand))
    return lantern_set(hang, stand, L_, '줄 B · 길쭉한 붉은 등롱(금 뚜껑 윗면·금 술)·세우는 것은 금 기둥과 금 받침 위 작은 등롱.',
                       (3, 5), (1, 3))


def lantern_b2():
    hang = [
        R16((7, "KK")),
        R16((7, "KK")),
        R16((4, "KKKKKKKK")),
        R16((3, "KTUUUUTSK")),
        R16((3, "KSTTTTSRK")),
        R16((2, "KKKKKKKKKKK")),
        R16((2, "KvwxwvxuxtK")),
        R16((2, "KwZxZwxvxtK")),
        R16((2, "KwZxZwxvxtK")),
        R16((2, "KvwxwvxuxtK")),
        R16((2, "KuvxvuxtxsK")),
        R16((2, "KKKKKKKKKKK")),
        R16((3, "KSTTTTSRK")),
        R16((4, "KKKKKKKK")),
        R16((6, "KuuK")),
        R16((6, "KttK")),
    ]
    stand = [
        R16((4, "KKKKKKKK")),
        R16((3, "KTUUUUTSK")),
        R16((3, "KSTTTTSRK")),
        R16((3, "KKKKKKKKK")),
        R16((3, "KwZxZvxtK")),
        R16((3, "KwZxZvxtK")),
        R16((3, "KvwxvuxsK")),
        R16((3, "KKKKKKKKK")),
        R16((4, "KSTTTSK")),
        R16((5, "KcbK")),
        R16((5, "KcbK")),
        R16((5, "KcbK"), (9, "~")),
        R16((5, "KcbK"), (9, "~")),
        R16((2, "KKKKKKKKKK"), (12, "~")),
        R16((2, "KTUUUUTTSK"), (12, "~")),
        R16((2, "KKKKKKKKKK"), (12, "~~")),
    ]
    return lantern_set(hang, stand, leg('zhu'), '줄 B · 청회 기와 갓·금 살을 댄 둥근 붉은 등롱(갓 윗면)·세우는 것은 짙은 나무 기둥에 기와 받침돌.',
                       (3, 5), (1, 3))


CANDIDATES = {
    'table_round': {'A1': table_a1, 'A2': table_a2, 'B1': table_b1, 'B2': table_b2},
    'stool_drum': {'A1': stool_a1, 'A2': stool_a2, 'B1': stool_b1, 'B2': stool_b2},
    'set_table_four': {'A1': set_a1, 'A2': set_a2, 'B1': set_b1, 'B2': set_b2},
    'counter_inn': {'A1': counter_a1, 'A2': counter_a2, 'B1': counter_b1, 'B2': counter_b2},
    'kitchen_stove': {'A1': stove_a1, 'A2': stove_a2, 'B1': stove_b1, 'B2': stove_b2},
    'wine_jars': {'A1': jars_a1, 'A2': jars_a2, 'B1': jars_b1, 'B2': jars_b2},
    'menu_board': {'A1': menu_a1, 'A2': menu_a2, 'B1': menu_b1, 'B2': menu_b2},
    'lantern_paper': {'A1': lantern_a1, 'A2': lantern_a2, 'B1': lantern_b1, 'B2': lantern_b2},
}


# ---------------------------------------------------------------------------
# 시트 조립 보기·장면
# ---------------------------------------------------------------------------
def _img(w, h, fill=(0, 0, 0, 0)):
    from PIL import Image
    return Image.new('RGBA', (w, h), fill)


def _floor_under(set_im, floor):
    """견본 크기만큼 그 줄 style 마루를 깔고 견본을 얹는다."""
    v = _img(set_im.width, set_im.height)
    if floor is not None:
        for x in range(0, set_im.width, floor.width):
            for y in range(0, set_im.height, floor.height):
                v.alpha_composite(floor, (x, y))
    v.alpha_composite(set_im)
    return v


def _x2(im):
    from PIL import Image
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


PREVIEWS = {
    'set_table_four': lambda c, st: [('그 줄 style 마루 위 견본(4배로 보임)', _x2(_floor_under(c['_'], st.get('inn_floor_wood'))))],
}

SCENE_HEAD = ('<h2>줄별 장면 8×8 칸 객잔 홀 (3배) — 같은 번호의 frame-r1 벽·마루 + 이 판 후보</h2>'
              '<p class="lead">벽(왼끝·창·가운데·오른끝)과 마루(벽 밑 foot·변형·style 조각)는 frame-r1 의 같은 번호 후보다. '
              '탁자 세트 둘은 <b>set_table_four 견본(4×3)을 그대로</b> 찍었다(층: 뒤 걸상 → 탁자 → 좌·우 → 앞). 세트 아래 맨 끝 줄은 빈 바닥으로 남겼다. '
              '계산대 위에 세우는 등롱, 벽에 차림판과 매다는 등롱. 사람은 Actor1. 맨 왼쪽은 조선 객잔 지도 같은 크기 자락.</p>')


def _frame_parts(key):
    """frame-r1 같은 번호의 벽 조각·마루 조각."""
    w = F.CANDIDATES['wall_inn_set'][key]()[0].img()
    f = F.CANDIDATES['floor_wood_inn'][key]()[0].img()
    wall = {'l': w.crop((0, 0, 16, 32)), 'm': w.crop((16, 0, 64, 32)), 'win': w.crop((64, 0, 112, 32)),
            'door': w.crop((112, 0, 176, 32)), 'r': w.crop((176, 0, 192, 32))}
    floor = {'v1': f.crop((0, 0, 32, 32)), 'v2': f.crop((32, 0, 64, 32)), 'v3': f.crop((64, 0, 96, 32)), 'foot': f.crop((96, 0, 128, 32))}
    return wall, floor


def scenes(get, style, actor, key):
    """줄별 장면 8×8 칸(128×128): 벽 2줄 + 마루 6줄. 계산대·술독·아궁이는 벽 밑 두 줄, 탁자 세트(4×3) 둘은 칸 (0,4)·(4,4), 맨 아래 줄은 빈 바닥."""
    out = {}
    need = [get(i) for i in ('set_table_four', 'counter_inn', 'kitchen_stove', 'wine_jars', 'menu_board', 'lantern_paper')]
    if any(n is None for n in need):
        return out
    sett, counter_, stove_, jars_, menu, lant = need
    wall, floor = _frame_parts(key)
    v = _img(128, 128, (0, 0, 0, 255))
    v.alpha_composite(F.wall_patch(wall, ('l', 'win', 'm', 'r')), (0, 0))
    for bx in range(4):
        v.alpha_composite(floor['foot'], (bx * 32, 32))
    st = style.get('inn_floor_wood')
    sty = st if st is not None else floor['v1']
    for by, row in enumerate(((floor['v1'], floor['v2'], sty, floor['v3']), (floor['v3'], sty, floor['v1'], floor['v2']))):
        for bx, im in enumerate(row):
            v.alpha_composite(im, (bx * 32, 64 + by * 32))
    v.alpha_composite(menu, (80, 16))            # 칸 (5,1) — 벽 아래 칸에 건다
    v.alpha_composite(lant['hang'], (48, 0))     # 칸 (3,0)·(7,0) — 보 앞에 매단다
    v.alpha_composite(lant['hang'], (112, 0))
    v.alpha_composite(counter_, (0, 32))
    v.alpha_composite(lant['stand'], (32, 32))
    v.alpha_composite(jars_, (48, 32))
    v.alpha_composite(stove_, (96, 32))
    v.alpha_composite(actor, (66, 34))
    v.alpha_composite(sett, (0, 64))
    v.alpha_composite(sett, (64, 64))
    out['객잔 홀 8×8: 벽·차림판·등롱 / 계산대·술독·아궁이 / 탁자 세트(견본 4×3) 둘 / 빈 바닥 한 줄'] = v
    return out
