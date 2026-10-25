"""바깥 테두리 화소를 재질의 어두운 단으로 올린다(무채색 짙은 회색·먹 → 푸른 기 도는 돌 어두운 단, 먹 갈색 → 갈색 단)."""
LIFT = {'U': 'b', 'V': 'b', 'W': 'b', 'T': 'b', 'X': 'a', 'Y': 'a', 'Z': 'a', '_': 'α', 'C': 'E', 'A': 'E', '/': 'α',
        '|': 'α', ':': 'α', ';': 'α', ',': 'α'}


def lift_edges(c):
    n = 0
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch in LIFT and any(not (0 <= x + a < c.w and 0 <= y + b < c.h) or c.get(x + a, y + b) == '.'
                                  for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                pts.append((x, y, LIFT[ch]))
    for x, y, ch in pts:
        c.put(x, y, ch)
        n += 1
    return n
