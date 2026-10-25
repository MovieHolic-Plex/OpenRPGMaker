"""바깥 테두리 화소를 재질의 어두운 단으로 — 무채색(최대<110 · 채도≤12) 금지.
돌: 빛 쪽(왼·위) 테두리는 따뜻한 갈회 't', 그늘 쪽(오른·아래)은 보랏빛 갈회 'c'.
원뿔 청석 등 cool 영역은 cool(x, y) 가 참이면 짙은 남청 'D'. 먹 갈색 '_' → 'α', 짙은 보라 'C'·'A' → 'E'."""
NEUTRAL = set('TUVWXYZab>dh')
INK = {'_': 'α', 'C': 'E', 'A': 'E', '/': 'α', '|': 'α', ':': 'α', ';': 'α', ',': 'α', '6': '7'}


def _open(c, x, y, a, b):
    return not (0 <= x + a < c.w and 0 <= y + b < c.h) or c.get(x + a, y + b) == '.'


def lift_edges(c, cool=None):
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch == '.':
                continue
            sides = [(a, b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if _open(c, x, y, a, b)]
            if not sides:
                continue
            if ch in INK:
                pts.append((x, y, INK[ch]))
            elif ch in NEUTRAL:
                if cool and cool(x, y):
                    pts.append((x, y, 'D'))
                elif (1, 0) in sides or (0, 1) in sides:
                    pts.append((x, y, 'c'))
                else:
                    pts.append((x, y, 't'))
    for x, y, ch in pts:
        c.put(x, y, ch)
    return len(pts)
