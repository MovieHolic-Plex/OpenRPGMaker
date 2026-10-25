"""청석 앞 사면(손 변화표): inn/common.roof 와 같은 방식 — 줄마다 손으로 쓴 엇갈림, 낱장 변화표를 줄마다 다른 자리에서 읽는다.
낱장은 둥근 머리 청석(왼쪽 빛 · 오른쪽 골 그늘 · 맨 아래 겹침). 난수 없음."""
# 회청 석판(차분): 왼 사면(빛) · 오른 사면(그늘) 따로
LIT_BANDS = [('r', 'n', 'k', 'e'), ('r', 'n', 'k', 'e'), ('n', 'k', 'h', 'e'), ('n', 'k', 'h', 'b'), ('k', 'h', 'g', 'b')]
DRK_BANDS = [('k', 'h', 'e', 'a'), ('k', 'h', 'e', 'a'), ('h', 'e', 'd', 'a'), ('h', 'e', 'b', 'X'), ('e', 'd', 'b', 'X')]
SLATE_BANDS = LIT_BANDS
LIGHTER = {'r': 's', 'h': 'k', 'g': 'h', 'e': 'g', 'b': 'e', 'a': 'b', 'k': 'n', 'n': 'r', 'd': 'e', 'X': 'a', 'W': 'X'}
DARKER = {'r': 'n', 'k': 'h', 'h': 'g', 'g': 'e', 'e': 'b', 'b': 'a', 'a': 'X', 'n': 'k', 'd': 'a', 'X': 'W', 'W': 'W'}
VAR = [
    '0010002000015000200001000400',
    '2000100000000010002000100000',
    '0001000200100000000010020010',
    '0400002000001000010000200000',
    '1000000100002000100400000200',
    '0020000010000002000010001000',
    '0000120000040010000200000000',
    '0001000020500100120000040001',
    '0200004000100020000000100020',
    '0010020000000001000020000100',
    '0000100002000040010000102000',
    '1020000001000200000000010004',
]
COURSE_OFF = [0, 3, 1, 4, 2, 0, 3, 1, 4, 2, 1, 3, 0, 2, 4, 1]
TW_ROW = [4, 4, 5, 4, 4, 4, 5, 4, 4, 4, 5, 4]      # 줄마다 낱장 폭도 조금씩 다르다


def tile_px(u, r, w, h, band, v):
    """청석 한 장: 맨 아래 줄 = 겹침 그늘(가로로 이어진다), 오른쪽 끝 = 골, 왼쪽 1px 빛. 반짝은 변화표 5 일 때만."""
    hi, lt, md, dk = band
    if v == '1':
        md = LIGHTER[md]
    elif v == '2':
        lt, md = md, DARKER[md]
    if r == h - 1:
        return dk
    if v == '4' and r == h - 2:
        return dk if u else md
    if u == w - 1:
        return dk
    if u == 0:
        return hi if (r == 0 and v in '15') else lt
    return md


def slate_roof(c, inside, x0, x1, y0, y1, th=4, vshift=0, bands=None):
    global SLATE_BANDS
    SLATE_BANDS = bands or LIT_BANDS
    n = (y1 - y0 + 1 + th - 1) // th
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        b = SLATE_BANDS[min(len(SLATE_BANDS) - 1, k * len(SLATE_BANDS) // max(1, n))]
        off = COURSE_OFF[(k + vshift) % len(COURSE_OFF)]
        tw = TW_ROW[(k + vshift) % len(TW_ROW)]
        row = VAR[(k * 3 + vshift) % len(VAR)]
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            v = row[(t + k * 7 + vshift) % len(row)]
            c.put(x, y, tile_px(u, r, tw, th, b, v))
