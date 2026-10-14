#!/usr/bin/env python3
"""modern_city 실내 방 미리보기 — 굽기 전에 조각 그림만으로 방을 조립해 PNG 로 찍는다(눈 확인·조립 관문 그림).
조립 규칙은 src/editor/handInterior/builder.ts 와 같다: 구조(천장 띠·벽면·바닥) → 바닥 무늬(flat) →
가구를 drawKey 순서로(걸이 = y·16, 문 = (y+3)·16, 옆문 = (y+1)·16, 나머지 = (y+h)·16) → 탁상 물건.
최종 정답은 굽기 뒤 build_hand_interior_room({tileset:"modern_city"}) 가 만든 맵이다.

    python3 scripts/content/modern-city-int/preview.py ROOM.json OUT.png [--x 3]
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np                                   # noqa: E402
from PIL import Image                                # noqa: E402
from mkit import blit, default_ceiling               # noqa: E402
import pieces                                        # noqa: E402

R = pieces.R


def analyse(plan):
    H = len(plan); W = max(len(r) for r in plan)
    g = [[(plan[y][x] if x < len(plan[y]) else '#') != '#' for x in range(W)] for y in range(H)]
    def inn(x, y): return 0 <= x < W and 0 <= y < H and g[y][x]
    face = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if not g[y][x]: continue
            if not inn(x, y - 1): face[y][x] = 1
            elif face[y - 1][x] == 1: face[y][x] = 2
    top = [[(not g[y][x]) and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) for x in range(W)] for y in range(H)]
    return W, H, g, face, top, inn


def render_room(room):
    plan = room['plan']; W, H, g, face, top, inn = analyse(plan)
    issues = []
    img = np.zeros((H * 16, W * 16, 4), np.uint8); img[:, :, :3] = (0x1d, 0x1a, 0x22); img[:, :, 3] = 255
    import mpx
    img[:, :, :3] = mpx._rgb(mpx.RAMPS['ink'][0])
    ceil_id = room.get('ceiling', 'default')

    def mat(x, y):
        f, w = room['floor'], room['wall']
        for z in room.get('zones', []):
            if z['x0'] <= x <= z['x1'] and z['y0'] <= y <= z['y1']: f, w = z.get('floor') or f, z.get('wall') or w
        return f, w
    for cy in range(H):
        for cx in range(W):
            f, w = mat(cx, cy)
            west = 0 if inn(cx - 1, cy) else 1
            if g[cy][cx] and face[cy][cx]: t = R.wall_cell(w, cx, face[cy][cx], west)
            elif g[cy][cx]:
                sh = (1 if cy > 0 and face[cy - 1][cx] else 0) | (2 if west else 0)
                t = R.floor_cell(f, R.lay_x(f, cx, cy), cy, sh)
            elif top[cy][cx]:
                nv = 1 if cy == 0 else (0 if inn(cx, cy - 1) or top[cy - 1][cx] else 1)
                b = (1 if inn(cx, cy + 1) else 0) | (2 if inn(cx, cy - 1) else 0) | (4 if inn(cx - 1, cy) else 0) | (8 if inn(cx + 1, cy) else 0) | 16 * nv
                t = R.ceil_cell(ceil_id, b)
            else: continue
            img[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16] = t

    def is_floor(x, y): return inn(x, y) and face[y][x] == 0
    draws = []
    foot = {}
    surf = set()
    for n, o in enumerate(room.get('objects', [])):
        d = R.objs.get(o['id'])
        if not d: issues.append('없는 가구 %s' % o['id']); continue
        arr, U = R.obj_image(o['id'])
        label = '%s@(%d,%d)' % (o['id'], o['x'], o['y'])
        k = d['kind']
        if k in ('floor', 'wall'):
            for dy in range(d['h']):
                for dx in range(d['w']):
                    x, y = o['x'] + dx, o['y'] + dy
                    if not is_floor(x, y): issues.append('%s 발밑 (%d,%d) 바닥 아님' % (label, x, y))
                    if (x, y) in foot: issues.append('%s 가 %s 와 겹침 (%d,%d)' % (label, foot[(x, y)], x, y))
                    foot[(x, y)] = label
                    if d['surface']: surf.add((x, y))
            if k == 'wall' and not all(o['y'] > 0 and face[o['y'] - 1][o['x'] + dx] == 2 for dx in range(d['w'])):
                issues.append('%s 벽 가구 — 북쪽 벽면 바로 아래 첫 바닥 줄이 아니다' % label)
            draws.append(((o['y'] + d['h']) * 16, n, o['x'] * 16, (o['y'] - U) * 16, arr))
        elif k == 'hang':
            if not all(0 <= o['x'] + dx < W and face[o['y']][o['x'] + dx] == 1 for dx in range(d['w'])): issues.append('%s 걸이 — 벽면 윗줄이 아니다' % label)
            draws.append((o['y'] * 16, n, o['x'] * 16, o['y'] * 16, arr))
        elif k == 'door':
            x, y = o['x'], o['y']
            ok = is_floor(x, y) and not inn(x - 1, y) and not inn(x + 1, y) and inn(x, y - 1) and is_floor(x, y + 1) and is_floor(x, y + 2) \
                and all(not is_floor(x - 1, yy) and not is_floor(x + 1, yy) for yy in (y + 1, y + 2))
            if not ok: issues.append('%s 문 — 가로 칸막이 1칸 틈이 아니다' % label)
            lin = R._canvas(default_ceiling, 16, 16, 3)
            draws.append(((y + 3) * 16, n, x * 16, y * 16, lin))
            draws.append(((y + 3) * 16, n, x * 16, (y + 1) * 16, arr))
        elif k == 'sidedoor':
            draws.append(((o['y'] + 1) * 16, n, o['x'] * 16, (o['y'] - 2) * 16, arr))
        else:
            for dy in range(max(1, d['h'])):
                for dx in range(d['w']):
                    if not is_floor(o['x'] + dx, o['y'] + dy): issues.append('%s 깔개 (%d,%d) 바닥 아님' % (label, o['x'] + dx, o['y'] + dy))
            draws.append((-1, n, o['x'] * 16, o['y'] * 16, arr))
    for n, t in enumerate(room.get('tables', [])):
        if t['style'] not in R.tables: issues.append('없는 탁자 %s' % t['style']); continue
        arr = R.table_image(t['style'], t['w'], t['h'])
        for j in range(t['h']):
            for i in range(t['w']):
                x, y = t['x'] + i, t['y'] + j
                if not is_floor(x, y): issues.append('탁자 %s 발밑 (%d,%d) 바닥 아님' % (t['style'], x, y))
                if (x, y) in foot: issues.append('탁자 %s 가 %s 와 겹침' % (t['style'], foot[(x, y)]))
                foot[(x, y)] = 'table'; surf.add((x, y))
        draws.append(((t['y'] + t['h']) * 16, 1000 + n, t['x'] * 16, t['y'] * 16, arr))
    for _k, _n, x, y, arr in sorted(draws, key=lambda d: (d[0], d[1])): blit(img, arr, x, y)
    for gd in room.get('goods', []):
        if gd['id'] not in R.goods: issues.append('없는 탁상 물건 %s' % gd['id']); continue
        if (gd['x'], gd['y']) not in surf: issues.append('탁상 물건 %s (%d,%d) 윗면 없는 칸' % (gd['id'], gd['x'], gd['y']))
        blit(img, R._canvas(R.goods[gd['id']]['draw'], 16, 16), gd['x'] * 16, gd['y'] * 16)
    # 걸음 도달: 아래 끝 출구에서 BFS(가구 발밑·벽면·막힘 제외)
    walk = {(x, y) for y in range(H) for x in range(W) if is_floor(x, y) and (x, y) not in foot}
    for o in room.get('objects', []):
        d = R.objs.get(o['id'])
        if d and d['kind'] in ('floor', 'wall'):
            for (wx, wy) in d['walk']: walk.add((o['x'] + wx, o['y'] + wy))
        if d and d['kind'] == 'door':
            for yy in (o['y'], o['y'] + 1, o['y'] + 2): walk.add((o['x'], yy))
        if d and d['kind'] == 'sidedoor': walk.add((o['x'], o['y']))
    starts = [(x, H - 1) for x in range(W) if (x, H - 1) in walk]
    seen = set(starts); q = list(starts)
    while q:
        x, y = q.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) in walk and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
    lost = sorted(walk - seen)
    if lost: issues.append('출구에서 닿지 못하는 바닥 %d칸: %s' % (len(lost), ' '.join('%d,%d' % p for p in lost[:12])))
    return Image.fromarray(img, 'RGBA'), issues


if __name__ == '__main__':
    room = json.load(open(sys.argv[1])); out = sys.argv[2]
    k = int(sys.argv[sys.argv.index('--x') + 1]) if '--x' in sys.argv else 3
    im, iss = render_room(room)
    im = im.resize((im.width * k, im.height * k), Image.NEAREST); im.save(out)
    print('%s %dx%d · 문제 %d' % (out, im.width, im.height, len(iss)))
    for m in iss: print('  ✗', m)
