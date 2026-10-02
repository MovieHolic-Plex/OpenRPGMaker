#!/usr/bin/env python3
"""고른(또는 후보) 조각을 도시 한 장면(25x29칸=400x464px)으로 조립한다. 판단은 하지 않는다 — 어느 후보 조합을 쓸지는 인자로 받는다.

  compose_city.py --out city.png --pick ground=<판>:<글자> shop=<판>:<글자> office=… apartment=… props=… car=<판>:<글자>
"""
import argparse, os, random, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RUNS = os.path.join(ROOT, 'qa-runs/harnesses/modern-chipset')
ACTOR1 = os.path.expanduser('~/gv3-work/chipset/Actor1.png')   # RPG Maker 캐릭터셋(생성 금지, 그대로 사용). 사람은 항상 이것.
W, H = 26, 30
RN0 = 11                                     # 동서 도로 첫 행

SOURCES = os.path.join(ROOT, 'tiledata/modern-city/sources')            # 합격 후보 사본(qa-runs 는 gitignore 라 사라질 수 있다)

def load(spec):
    rid, letter = spec.split(':'); p = os.path.join(RUNS, rid, letter + '.png')
    if not os.path.exists(p): p = os.path.join(SOURCES, f'{rid}_{letter}.png')
    return Image.open(p).convert('RGBA')

def cell(sheet, idx, cols=8): return sheet.crop(((idx % cols) * 16, (idx // cols) * 16, (idx % cols) * 16 + 16, (idx // cols) * 16 + 16))

# 소품 시트 x 위치(px)·크기
PROPS = {'lamp': (0, 16, 48), 'signal': (16, 16, 48), 'bollard': (32, 16, 16), 'hydrant': (48, 16, 16), 'vending': (64, 16, 32), 'tree': (80, 32, 48), 'trash': (112, 16, 16), 'busstop': (128, 16, 48)}

def prop(sheet, name):
    x, w, h = PROPS[name]; return sheet.crop((x, sheet.height - h, x + w, sheet.height))

# (캐릭터, 방향행, 프레임, 발 x, 발 y) — 칸 좌표가 아니라 px. 북쪽 보도 바닥선 y=(RN0-1)*16-2=158, 횡단보도 y=…
HERO = [(0, 2, 1, 40, 160), (0, 3, 1, 232, 100 + 80)]
CROWD = [(1, 2, 0, 120, 162), (3, 1, 1, 330, 150), (5, 3, 2, 360, 300), (2, 0, 1, 150, 316), (6, 2, 1, 80, 310)]


def actor(char, row, col):
    """Actor1 한 프레임(24x32). char 0=주인공 … 7, row 0=위 1=오른쪽 2=정면 3=왼쪽, col 0..2. 배경 키색은 (0,0) 화소."""
    im = Image.open(ACTOR1).convert('RGBA'); bg = im.getpixel((0, 0)); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][:3] == bg[:3]: px[x, y] = (0, 0, 0, 0)
    bx, by = (char % 4) * 72, (char // 4) * 128
    return im.crop((bx + col * 24, by + row * 32, bx + col * 24 + 24, by + row * 32 + 32))


def build(p, seed=3):
    rng = random.Random(seed)
    g = load(p['ground']); T = {i: cell(g, i) for i in range(16)}
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    def put(t, cx, cy): im.alpha_composite(t, (cx * 16, cy * 16))
    road_rows = range(RN0, RN0 + 6); road_cols = range(12, 18); mid_row = RN0 + 3
    for cy in range(H):
        for cx in range(W):
            in_h = cy in road_rows; in_v = cx in road_cols
            if in_h or in_v:
                if in_h and in_v: t = T[1] if rng.random() < .12 else T[0]
                elif in_h and cy == mid_row: t = T[2]
                elif in_v and cx == 15: t = T[3]
                else: t = T[1] if rng.random() < .12 else T[0]
            else:
                t = T[7] if (cx + cy * 3) % 7 == 0 else T[6]
            put(t, cx, cy)
    cn, cs = RN0 - 1, RN0 + 6                                     # 북·남 연석 행
    for cx in list(range(0, 11)) + list(range(18, W)): put(T[8], cx, cn); put(T[9], cx, cs)
    for cy in list(range(0, cn)) + list(range(cs + 1, H)): put(T[10], 11, cy); put(T[11], 18, cy)
    put(T[12], 11, cn); put(T[13], 18, cn); put(T[14], 11, cs); put(T[15], 18, cs)
    for cy in road_rows: put(T[4], 9, cy); put(T[4], 20, cy)       # 동서 도로 횡단보도(줄이 차 진행과 평행)
    for cx in road_cols: put(T[5], cx, cn - 1); put(T[5], cx, cs + 1)
    shop, office, apt = load(p['shop']), load(p['office']), load(p['apartment'])
    top_n = (cn - 2) * 16                                           # 북쪽 블록 건물 바닥선(보도 2행 위)
    im.alpha_composite(shop, (0, top_n - shop.height)); im.alpha_composite(office, (5 * 16, top_n - office.height)); im.alpha_composite(apt, (19 * 16, top_n - apt.height))
    top_s = (cs + 3) * 16                                           # 남쪽 블록 지붕 시작(보도 2행 아래)
    im.alpha_composite(office, (0, top_s)); im.alpha_composite(shop, (6 * 16, top_s)); im.alpha_composite(apt, (19 * 16, top_s))
    ps = load(p['props']); items = []
    yn = cn * 16 - 2; ys = (cs + 2) * 16 - 4                          # 북쪽 소품 바닥선 / 남쪽 소품 바닥선
    for name, cx, yb in (('lamp', 4, yn), ('vending', 6, yn), ('hydrant', 10, yn), ('bollard', 1, yn), ('lamp', 20, yn), ('tree', 23, yn), ('signal', 18, yn),
                         ('lamp', 1, ys), ('busstop', 9, ys), ('trash', 7, ys), ('lamp', 21, ys), ('signal', 11, ys), ('bollard', 23, ys)):
        pr = prop(ps, name); x = cx * 16 + (16 - pr.width) // 2 if name != 'tree' else W * 16 - pr.width - 8
        items.append((yb, pr, x, yb - pr.height))
    car = load(p['car'])
    yb_e = (cs) * 16 - 4; yb_w = (mid_row) * 16 + 2
    items.append((yb_e, car, 56, yb_e - car.height))                                           # 동행(오른쪽 향함) — 좌측통행: 남쪽 차선
    items.append((yb_w, car.transpose(Image.FLIP_LEFT_RIGHT), 21 * 16, yb_w - car.height))     # 서행 — 북쪽 차선
    # 사람(Actor1): 발 위치 = 이미지 바닥선. 주인공(0)은 북쪽 보도 상점 앞과 횡단보도, 나머지는 행인.
    for char, row, col, fx, fy in (HERO + CROWD):
        a = actor(char, row, col); items.append((fy, a, fx - 12, fy - 32))
    for _, pr, x, y in sorted(items, key=lambda t: t[0]): im.alpha_composite(pr, (x, y))
    return im

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); ap.add_argument('--pick', nargs='+', required=True); ap.add_argument('--scale', type=int, default=3)
    a = ap.parse_args(); p = dict(x.split('=') for x in a.pick)
    im = build(p); im.save(a.out); im.resize((im.width * a.scale, im.height * a.scale), Image.NEAREST).save(a.out.replace('.png', f'-x{a.scale}.png')); print(a.out, im.size)
