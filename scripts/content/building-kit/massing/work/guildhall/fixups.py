"""마감 손질(2차 감독 메모 ⑧⑨⑩): 바깥 윤곽 재질 어두운 단 · 안쪽 투명 핀홀 메우기. 난수 없음."""
import json
import os

_PAL = json.load(open(__import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0] + '/harness-data/building-kit/massing/palette.json',
                      encoding='utf-8'))
_LUM = {}
for ch, h in _PAL['legend'].items():
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    _LUM[ch] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
_RAMP = {ch: name for name, chs in _PAL['ramps'].items() for ch in chs}
# 재질별 윤곽 단(밝기 0.15~0.3 — 먹선 아님)
EDGE = {'terracotta': '-', 'red': '9', 'grey': 'W', 'plaster': 'J', 'brick': 'J', 'blue': 'D', 'green': 'M',
        'gold': 'τ', 'wood': 'τ', 'teal': '>'}
# 회벽·돌 밝은 화소는 같은 결의 그늘 단으로(보라 J 대신 따뜻한 갈색이 어울리는 곳)
EDGE_PLASTER_WARM = 'α'


def _op(c, x, y):
    return 0 <= x < c.w and 0 <= y < c.h and c.g[y][x] != '.'


def fill_pinholes(c, fill=None):
    """바깥(화폭 테두리)에서 닿지 않는 투명 화소와, 상하좌우 셋 이상이 그림인 투명 홈을 메운다."""
    from collections import deque
    seen = [[False] * c.w for _ in range(c.h)]
    q = deque()
    for x in range(c.w):
        for y in (0, c.h - 1):
            if c.g[y][x] == '.' and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    for y in range(c.h):
        for x in (0, c.w - 1):
            if c.g[y][x] == '.' and not seen[y][x]:
                seen[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < c.w and 0 <= ny < c.h and not seen[ny][nx] and c.g[ny][nx] == '.':
                seen[ny][nx] = True
                q.append((nx, ny))
    n = 0
    for _ in range(4):
        changed = False
        for y in range(c.h):
            for x in range(c.w):
                if c.g[y][x] != '.':
                    continue
                nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                cnt = sum(_op(c, a, b) for a, b in nb)
                if not seen[y][x] or cnt >= 3:
                    # 가장 어두운 이웃 색으로
                    cols = [c.g[b][a] for a, b in nb if _op(c, a, b)]
                    cols.sort(key=lambda ch: _LUM.get(ch, 1))
                    c.g[y][x] = fill or (cols[0] if cols else '-')
                    n += 1
                    changed = True
        if not changed:
            break
    return n


def outline(c, keep_rows_from=None, thresh=0.30):
    """그림 바깥 테두리(투명과 상하좌우로 맞닿은 화소) 중 밝은 것을 재질 어두운 단으로."""
    keep_rows_from = c.h - 2 if keep_rows_from is None else keep_rows_from
    todo = []
    for y in range(c.h):
        if y >= keep_rows_from:
            continue
        for x in range(c.w):
            ch = c.g[y][x]
            if ch == '.':
                continue
            if any(not _op(c, x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                if _LUM.get(ch, 0) > thresh:
                    ramp = _RAMP.get(ch, 'grey')
                    todo.append((x, y, EDGE.get(ramp, 'W')))
    for x, y, ch in todo:
        c.g[y][x] = ch
    return len(todo)


def interior_holes(c):
    return sum(1 for y in range(c.h) for x in range(c.w) if c.g[y][x] == '.' and
               all(_op(c, x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))


def finalize(c):
    a = fill_pinholes(c)
    b = outline(c)
    print(f'  finalize: 핀홀 {a} 메움 · 윤곽 {b}화소 · 남은 안쪽 투명 {interior_holes(c)}')
