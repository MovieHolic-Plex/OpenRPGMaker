"""바깥 윤곽을 '옆 재질의 짙은 색조'로(무채 회색·남흑 금지). object-gate 사실 계산과 같은 기준:
가장자리 화소(4방 중 투명 또는 화폭 끝, 맨 아래 땅 줄 제외) 가운데 max(r,g,b) < 110 이고 채도(max-min) <= 12 이면 무채로 친다.
여기서는 무채든 아니든 짙은 가장자리(밝기 < 0.45)를 재질별 색조 짙은 단으로 바꾼다. 난수 없음."""
import json
import os

_P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '..', '..',
                                 'harness-data', 'building-kit', 'massing', 'palette.json'), encoding='utf-8'))['legend']


def rgb(ch):
    h = _P[ch]
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def lum(ch):
    r, g, b = rgb(ch)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def chroma(ch):
    r, g, b = rgb(ch)
    return max(r, g, b) - min(r, g, b)


GREY = set('TUVWXYZabcdefghijklmnopqrs')
RED = set('6789!@#$%&*+=?<')
WOOD = set('/|:;,_-αβγδεζηθικλμνξπρσ')
PLAS = set('tuvwxyz012345J')
BLUE = set('ABCDEFGHI')
GREEN = set('MNOPQRS')
GOLD = set('KLτ')
TEAL = set('^>')


def tinted(ch, lit):
    """재질 → (빛 쪽, 그늘 쪽) 짙은 색조."""
    if ch in RED:
        return '%' if lit else '7'
    if ch in WOOD:
        return 'δ' if lit else '-'
    if ch in GOLD:
        return 'τ'
    if ch in GREEN:
        return 'M'
    if ch in BLUE or ch in TEAL:
        return '*' if lit else 'J'
    if ch in PLAS:
        return 't' if lit else 'J'
    return 't' if lit else 'J'          # 회색 돌: 갈회색(빛) · 보라 갈색(그늘)


def tint_edges(c, cx, keep_bottom=True, thresh=0.45):
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch == '.':
                continue
            nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            out = [not (0 <= a < c.w and 0 <= b < c.h) or c.get(a, b) == '.' for a, b in nb]
            if not any(out):
                continue
            if lum(ch) >= thresh and chroma(ch) > 12:
                continue
            if lum(ch) >= 0.55:
                continue
            pts.append((x, y, tinted(ch, x + 0.5 < cx)))
    for x, y, ch in pts:
        c.put(x, y, ch)
    return len(pts)


def neutral_share(c):
    edge = neutral = 0
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch == '.':
                continue
            op = lambda a, b: 0 <= a < c.w and 0 <= b < c.h and c.get(a, b) != '.'
            l, r, u, d = op(x - 1, y), op(x + 1, y), op(x, y - 1), op(x, y + 1)
            if l and r and u and d:
                continue
            if l and r and u and not d:
                continue
            R, G, B = rgb(ch)
            if max(R, G, B) >= 110:
                continue
            edge += 1
            if max(R, G, B) - min(R, G, B) <= 12:
                neutral += 1
    return neutral, edge
