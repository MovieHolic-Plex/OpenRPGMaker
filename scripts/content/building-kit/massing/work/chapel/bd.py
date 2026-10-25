"""버들항 청석 지붕·흰 돌 붓(이 폴더 전용 사본). 난수 없음 — 변화는 손 표와 좌표로만. 빛 왼쪽 위.

버들항 대성당·병영 지붕을 1배로 재어 본 결: 위 절반은 밝은 비늘(H 머리 · G 몸 · B 틈, 8줄 한 켜),
아래 절반은 짙은 비늘(F 몸 · E/B 그늘, 4줄 한 켜). 색 비율 B:E:(F+G) ≈ 1:1:1.1, H 는 비늘 머리에만.
"""
import pix

# 따뜻한 흰 돌 램프(어두운 → 밝은): 연보라 줄눈 f · 몸 z/p · 밝은 0/3
WST = ['W', 'c', 't', 'f', 'w', 'y', 'l', 'z', 'p', '0', '3', '5']
G2W = dict(zip(pix.ST, WST))


class WarmAshlar(pix.Ashlar):
    """pix.Ashlar 를 따뜻한 흰 돌 램프로 — 줄눈은 연보라(f) 한 단."""

    def __init__(self, courses, mortar=3, **k):
        k.setdefault('warm', False)
        super().__init__(courses, **k)
        self.m = mortar

    def color(self, u, v, shade=0, mortar=None):
        ch = super().color(u, v, shade, self.m if mortar is None else mortar)
        return G2W.get(ch, ch) if ch else ch


def warm_region(c, x0, y0, x1, y1, keep=None):
    """회색 돌 글자를 따뜻한 흰 돌로 바꾼다(창 유리·문 나무는 회색 글자가 아니라 그대로)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if keep and keep(x, y):
                continue
            ch = c.get(x, y)
            if ch in G2W:
                c.put(x, y, G2W[ch])


# ---------------------------------------------------------------- 청석 비늘
# 밝은 켜(8줄 × 4) — 비늘 머리 H, 몸 G, 오른쪽 틈 B, 아래 겹침 E/B
UP = {
    'a': ['HGBH', 'HGBH', 'GGBH', 'GGBH', 'GGBG', 'EGEG', 'EBEE', 'GBBB'],
    'n': ['HHBH', 'HGBH', 'HGBH', 'GGBH', 'GGBG', 'EGEG', 'EBEE', 'GBBB'],   # 새 장(밝다)
    'o': ['GGBG', 'GGBH', 'GFBG', 'GFBG', 'FFBF', 'EFEF', 'EBEE', 'FBBB'],   # 묵은 장
    'c': ['HGBH', 'HGBH', 'GGBH', 'GBBH', 'GGBG', 'EGEG', 'EBEE', 'GBBB'],   # 이 빠진 장
}
# 짙은 켜(4줄 × 4)
LO = {
    'a': ['EBEF', 'EBFF', 'BBFF', 'EEBE'],
    'n': ['EBFG', 'EBFF', 'BBFF', 'EEBE'],
    'o': ['EBEE', 'EBEF', 'BBEF', 'EEBE'],
    'c': ['EBEF', 'EBBF', 'BBFF', 'EEBE'],
}
LIGHTEN = {'C': 'B', 'B': 'E', 'E': 'F', 'F': 'G', 'G': 'H', 'H': 'I', 'I': 'I'}
DARKEN = {'I': 'H', 'H': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'C', 'C': 'C'}


def shift(ch, s):
    while s > 0:
        ch = LIGHTEN.get(ch, ch)
        s -= 1
    while s < 0:
        ch = DARKEN.get(ch, ch)
        s += 1
    return ch


def slate(c, inside, x0, x1, y0, y1, split, var, stagger=(0, 2), shade=None, ox=0):
    """inside(x,y) 화소에 버들항 비늘. y<split 밝은 켜(8줄), 이후 짙은 켜(4줄).
    var: 변형 글자 문자열(a n o c) — 켜·장 번호로 읽는다. stagger: 켜마다 가로 어긋남."""
    for y in range(y0, y1 + 1):
        if y < split:
            ci, lv, th, T = (y - y0) // 8, (y - y0) % 8, 8, UP
        else:
            ci, lv, th, T = 100 + (y - split) // 4, (y - split) % 4, 4, LO
        off = stagger[ci % len(stagger)] + ox
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            col = (x + off) // 4
            v = var[(ci * 7 + col * 3) % len(var)]
            ch = T[v][lv][(x + off) % 4]
            if shade:
                ch = shift(ch, shade(x, y))
            c.put(x, y, ch)
