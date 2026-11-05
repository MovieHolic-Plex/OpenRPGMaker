# 영상용 걷기 길: 입구에서 볼거리 순서대로 가장 가까운 닿는 칸까지 최단 길(4방향 통행 그대로).
import sys, json, os
from collections import deque
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layers as L
from bake import MAPS
WAY = {
    'bd-wave-ash-plain': [(23, 10), (12, 4), (35, 0)],
    'bd-wave-volcano-field': [(35, 29), (35, 23), (35, 19)],
    'bd-wave-ruined-village': [(31, 28), (32, 18), (50, 9)],
    'bd-wave-ice-age-field': [(35, 39), (35, 26), (35, 20), (45, 11)],
    'bd-wave-mountain-fortress': [(30, 50), (35, 25), (35, 22), (35, 18), (35, 13)],
}
DIRS = (('up', 0, -1), ('down', 0, 1), ('left', -1, 0), ('right', 1, 0))
out = {}; cache = {}
rep = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'report.json')))
for mid, place, name, (y0, y1), _ in MAPS:
    if place not in cache: cache[place] = L.build(place)
    r = cache[place]; fl = r['flags'][y0:y1].copy(); wk = r['walk'][y0:y1]
    if y0 > 0: fl[0, :, 0] = wk[0, :]
    H, W = wk.shape
    def bfs(s):
        prev = {s: None}; q = deque([s])
        while q:
            x, y = q.popleft()
            for k, (_, dx, dy) in enumerate(DIRS):
                nx, ny = x + dx, y + dy
                if fl[y, x, k] and 0 <= nx < W and 0 <= ny < H and wk[ny, nx] and (nx, ny) not in prev: prev[(nx, ny)] = (x, y); q.append((nx, ny))
        return prev
    cur = tuple(rep[mid]['entry']); moves = []; stops = []
    for (tx, ty) in WAY[mid]:
        prev = bfs(cur)
        tgt = min(prev, key=lambda c: (abs(c[0] - tx) + abs(c[1] - ty), c[1]))
        path = []; c = tgt
        while c != cur: path.append(c); c = prev[c]
        path.reverse(); p0 = cur
        for c in path:
            dx, dy = c[0] - p0[0], c[1] - p0[1]
            moves.append({(0, -1): 'up', (0, 1): 'down', (-1, 0): 'left', (1, 0): 'right'}[(dx, dy)]); p0 = c
        cur = tgt; stops.append(list(tgt))
    out[mid.replace('-', '_')] = dict(entry=rep[mid]['entry'], moves=moves, end=list(cur), stops=stops)
    print(mid, len(moves), 'end', cur, stops)
json.dump(out, open('/tmp/fs2rev/fixtures/routes.json', 'w'))
