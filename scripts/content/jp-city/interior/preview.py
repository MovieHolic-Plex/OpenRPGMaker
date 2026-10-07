#!/usr/bin/env python3
"""일본 실내 방 미리보기 — 굽기 전에 블록 그림만으로 방을 조립해 PNG 로 찍는다(작업자 눈 확인·관문 증거용).
조립 규칙은 src/editor/handInterior/builder.ts 와 같다(구조 → 바닥 무늬 → 가구를 (y+높이) 순서로, 걸이는 벽면 윗줄 y 순서).
최종 정답은 굽기 뒤 TS 조립기(build_hand_interior_room, tileset jp_city)가 만든 맵이다 — 여기는 그 전의 눈 확인.

    python3 scripts/content/jp-city/interior/preview.py ROOM.json OUT.png [--x 3]
ROOM.json = 도구 인자와 같은 모양 {plan, floor, wall, ceiling?, zones?, objects?, tables?, goods?}.
파이썬에서: from preview import render_room; img, issues = render_room(room)
"""
import importlib.util, glob, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np                                    # noqa: E402
from PIL import Image                                 # noqa: E402
from ikit import blit, K, _hx                         # noqa: E402

BLOCKS = os.path.join(os.path.dirname(HERE), 'blocks')


def registries(blocks_dir=BLOCKS):
    """blocks/interior_*.py 를 모두 불러 Registry 목록(이름순)."""
    out = []
    for path in sorted(glob.glob(os.path.join(blocks_dir, 'interior_*.py'))):
        name = os.path.splitext(os.path.basename(path))[0]
        spec = importlib.util.spec_from_file_location('jpint_' + name, path)
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        if hasattr(mod, 'R'): out.append(mod.R)
    return out


class Lib:
    """여러 블록 Registry 를 id 하나로 찾는다."""
    def __init__(self, regs=None):
        self.regs = regs if regs is not None else registries()
        def find(attr):
            d = {}
            for r in self.regs:
                for k in getattr(r, attr): d.setdefault(k, r)
            return d
        self.floor, self.wall, self.ceil, self.obj, self.table, self.good = (find(a) for a in ('floors', 'walls', 'ceils', 'objs', 'tables', 'goods'))


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


def render_room(room, lib=None):
    lib = lib or Lib()
    plan = room['plan']; W, H, g, face, top, inn = analyse(plan)
    issues = []
    img = np.zeros((H * 16, W * 16, 4), np.uint8); img[:, :, :3] = _hx(K('sumi', -1)); img[:, :, 3] = 255
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
            if g[cy][cx] and face[cy][cx]: t = lib.wall[w].wall_cell(w, cx, face[cy][cx], west)
            elif g[cy][cx]:
                sh = (1 if cy > 0 and face[cy - 1][cx] else 0) | (2 if west else 0)
                t = lib.floor[f].floor_cell(f, cx, cy, sh)
            elif top[cy][cx]:
                nv = 1 if cy == 0 else (0 if inn(cx, cy - 1) or top[cy - 1][cx] else 1)
                b = (1 if inn(cx, cy + 1) else 0) | (2 if inn(cx, cy - 1) else 0) | (4 if inn(cx - 1, cy) else 0) | (8 if inn(cx + 1, cy) else 0) | 16 * nv
                t = lib.ceil[ceil_id].ceil_cell(ceil_id, b)
            else: continue
            img[cy * 16:cy * 16 + 16, cx * 16:cx * 16 + 16] = t

    def is_floor(x, y): return inn(x, y) and face[y][x] == 0
    draws = []                       # (key, order, x_px, y_px, arr)
    foot = {}
    surf = set()
    for n, o in enumerate(room.get('objects', [])):
        r = lib.obj.get(o['id'])
        if not r: issues.append('없는 가구 %s' % o['id']); continue
        d = r.objs[o['id']]; arr, U = r.obj_image(o['id'])
        label = '%s@(%d,%d)' % (o['id'], o['x'], o['y'])
        if d['kind'] in ('floor', 'wall'):
            for dy in range(d['h']):
                for dx in range(d['w']):
                    x, y = o['x'] + dx, o['y'] + dy
                    if not is_floor(x, y) and d['stairs'] != 'up': issues.append('%s 발밑 (%d,%d) 바닥 아님' % (label, x, y))
                    if (x, y) in foot: issues.append('%s 가 %s 와 겹침 (%d,%d)' % (label, foot[(x, y)], x, y))
                    foot[(x, y)] = label
                    if d['surface']: surf.add((x, y))
            if d['kind'] == 'wall' and not all(o['y'] > 0 and face[o['y'] - 1][o['x'] + dx] == 2 for dx in range(d['w']) if 0 <= o['x'] + dx < W):
                issues.append('%s 벽 가구 — 북쪽 벽면 바로 아래 첫 바닥 줄이 아니다' % label)
            key = (o['y'] + d['h']) * 16; py = (o['y'] - U) * 16
        elif d['kind'] == 'hang':
            if not all(0 <= o['x'] + dx < W and face[o['y']][o['x'] + dx] == 1 for dx in range(d['w'])): issues.append('%s 걸이 — 벽면 윗줄이 아니다' % label)
            key = o['y'] * 16; py = o['y'] * 16
        else:
            key = -1; py = o['y'] * 16
        draws.append((key, n, o['x'] * 16, py, arr))
    for n, t in enumerate(room.get('tables', [])):
        r = lib.table.get(t['style'])
        if not r: issues.append('없는 탁자 %s' % t['style']); continue
        arr = r._canvas(r.tables[t['style']]['draw'], t['w'] * 16, t['h'] * 16, t['w'], t['h'])
        for j in range(t['h']):
            for i in range(t['w']):
                x, y = t['x'] + i, t['y'] + j
                if not is_floor(x, y): issues.append('탁자 %s 발밑 (%d,%d) 바닥 아님' % (t['style'], x, y))
                if (x, y) in foot: issues.append('탁자 %s 가 %s 와 겹침' % (t['style'], foot[(x, y)]))
                foot[(x, y)] = 'table'; surf.add((x, y))
        draws.append(((t['y'] + t['h']) * 16, 1000 + n, t['x'] * 16, t['y'] * 16, arr))
    for kkey, _, x, y, arr in sorted(draws, key=lambda d: (d[0], d[1])): blit(img, arr, x, y)
    for gd in room.get('goods', []):
        r = lib.good.get(gd['id'])
        if not r: issues.append('없는 탁상 물건 %s' % gd['id']); continue
        if (gd['x'], gd['y']) not in surf: issues.append('탁상 물건 %s (%d,%d) 윗면 없는 칸' % (gd['id'], gd['x'], gd['y']))
        blit(img, r._canvas(r.goods[gd['id']]['draw'], 16, 16), gd['x'] * 16, gd['y'] * 16)
    return Image.fromarray(img, 'RGBA'), issues


if __name__ == '__main__':
    room = json.load(open(sys.argv[1])); out = sys.argv[2]
    k = int(sys.argv[sys.argv.index('--x') + 1]) if '--x' in sys.argv else 3
    im, iss = render_room(room)
    im = im.resize((im.width * k, im.height * k), Image.NEAREST); im.save(out)
    print('%s %dx%d · 문제 %d' % (out, im.width, im.height, len(iss)))
    for m in iss: print('  ✗', m)
