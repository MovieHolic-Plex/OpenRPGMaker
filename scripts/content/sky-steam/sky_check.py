"""sky_steam 맵 구조 검사(참고문서 「자동 검사」 와 같은 규칙). 장면 = steam_b_scenes.Scene(아래/위층 배열 + placed 키트 목록).

오류 코드(맵 좌표는 0 기준 칸):
  SKY-KIT-CUT        키트가 맵 밖으로 잘림
  SKY-LAYER          위층 홈 칸(priority upper)이 아래층 배열에, 또는 아래층 홈 칸이 위층 배열에 있음
  SKY-NO-GROUND      건물·소품 칸 밑(아래층)이 비었거나 구름 바다(걷는 땅 아님) — 하늘을 나는 것(비공정·기구·구름·연기)은 제외
  SKY-DOOR-BLOCKED   건물(structure) 바로 아래 줄에 걸을 수 있는 칸이 하나도 없음(문 앞 접근칸 막힘)
  SKY-UNREACHABLE    장면이 이어 달라고 한 건물들의 문 앞 칸끼리 걸어서 못 감
검사 범위: 칸 배열의 구조·통행만 본다. 이벤트 실행(문 이동)·미적 품질·조수 모델 성공률은 이 검사로 주장하지 않는다.
"""
from __future__ import annotations
from collections import deque

FLYING = ('sky-a-airship', 'sky-a-airship-anim', 'sky-a-hot-air-balloon', 'sky-a-cloud-puff', 'sky-a-cloud-mist', 'sky-a-steam-cloud', 'steam-smoke-anim',
          'sky-a-island-s', 'sky-a-island-m', 'sky-a-rock-root', 'sky-a-bridge', 'sky-a-whale-pier', 'sky-a-gondola', 'steam-dock-deck', 'sky-a-harbor')
CLOUD = 'sky-a-cloud-sea'


def passage(d, t):
    return (d['tileMeta'][t].get('passage') or ('passable' if d['passability'][t]['up'] else 'solid')) if t >= 0 else None


def home(d, t):
    """엔진 tileLayerHome 과 같은 판정: 잠긴 칸은 meta.defaultLayer, 아니면 priority."""
    m = d['tileMeta'][t]
    return m['defaultLayer'] if m.get('locked') and m.get('defaultLayer') in ('lower', 'upper') else d['priority'][t]


def walkable(d, lower, upper, i):
    u = upper[i]
    if u >= 0:
        p = passage(d, u)
        if p == 'solid': return False
        if p == 'passable': return True
    lo = lower[i]
    return lo >= 0 and d['passability'][lo]['up']


def check(scene, connect=()):
    d = scene.d; W, H = scene.w, scene.h
    errs = []
    cloud = {t for t, _ in scene.cells[CLOUD].values()} if CLOUD in scene.cells else set()
    for i, t in enumerate(scene.lower):
        if t >= 0 and home(d, t) == 'upper': errs.append(('SKY-LAYER', i % W, i // W, f'아래층에 위층 홈 칸 {t}'))
    for i, t in enumerate(scene.upper):
        if t >= 0 and home(d, t) == 'lower': errs.append(('SKY-LAYER', i % W, i // W, f'위층에 아래층 홈 칸 {t}'))
    fronts = {}
    for (kid, x0, y0, w, h) in scene.placed:
        if x0 < 0 or y0 < 0 or x0 + w > W or y0 + h > H: errs.append(('SKY-KIT-CUT', x0, y0, f'{kid} {w}×{h} 가 맵 밖으로 잘림'))
        k = scene.kits.get(kid)
        if not k or kid in FLYING: continue
        if kid.startswith('steam-wall') or kid.startswith('steam-at-'): continue
        for y, row in enumerate(k['rows']):
            for x in range(w):
                if row['upperTiles'][x] < 0 and row['tiles'][x] < 0: continue
                X, Y = x0 + x, y0 + y
                if not (0 <= X < W and 0 <= Y < H): continue
                if row['tiles'][x] >= 0: continue
                lo = scene.lower[Y * W + X]
                if lo < 0 or lo in cloud:
                    # 칸 그림이 바닥에 닿는 맨 아래 줄만 따진다(위쪽은 공중에 걸친 지붕·기둥)
                    if y == h - 1: errs.append(('SKY-NO-GROUND', X, Y, f'{kid} 밑이 {"구름" if lo in cloud else "빈 칸"}'))
        if 'structure' in (k['ai'].get('tags') or []) and 'vehicle' not in (k['ai'].get('tags') or []) and kid not in ('steam-mooring-mast', 'steam-dock-crane', 'steam-tram', 'steam-locomotive', 'steam-carriage'):
            Y = y0 + h
            cells = [(x0 + x, Y) for x in range(w) if 0 <= x0 + x < W and Y < H]
            ok = [c for c in cells if walkable(d, scene.lower, scene.upper, c[1] * W + c[0])]
            if not ok: errs.append(('SKY-DOOR-BLOCKED', x0, Y, f'{kid} 문 앞 줄(y={Y}) 걷는 칸 없음'))
            else: fronts[(kid, x0, y0)] = ok[len(ok) // 2]
    want = [f for k, f in fronts.items() if not connect or k[0] in connect]
    if len(want) > 1:
        start = want[0]; seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and walkable(d, scene.lower, scene.upper, ny * W + nx):
                    seen.add((nx, ny)); q.append((nx, ny))
        for f in want[1:]:
            if f not in seen: errs.append(('SKY-UNREACHABLE', f[0], f[1], f'문 앞 {f} 가 {start} 와 안 이어짐'))
    return errs
