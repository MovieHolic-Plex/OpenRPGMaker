"""building-kit 마을 합성 — 그 줄의 조립 건물을 버들항 땅 위에 길·마당·광장과 함께 놓는다.

  python3 harness.py village <테마> <판> --line A [--seed N] [--size 40x28] [--all]

사용자(2026-10-22, northern-snow): 「그나마 괜찮은데, 사실은 마을을 지어야지」. 건물 한 채씩만 보면 접지·비율이
맞아도 마을로 놓았을 때 어긋나는지 알 수 없다. 이 단계는 **지금 화소 그대로** 그 줄의 조립 건물을 놓고, 놓은 결과를
PNG(1배·2배)와 HTML 한 장으로 낸다.

- 바닥·길·광장·나무·우물은 모두 테마 잠금 팔레트의 램프 색으로만 그린다(버들항 화소를 복사하지 않는다).
  북방(northern-snow)은 눈(snow 램프) 바닥, 나머지는 잔디(grass 램프) 바닥이다.
- 건물은 검수 영수증이 **지금 그림 화소 해시**에 대해 complete + PASS 인 것만 놓는다(`--all` 은 전부).
- 문은 길 쪽을 향하고, 문 앞 마당 1~2칸을 거쳐 길까지 걸어갈 수 있어야 한다(BFS 로 확인하고 실패를 보고한다).
- 건물끼리 겹치지 않는다. 같은 `--seed` 면 같은 마을이 나온다.
- `--finished` 는 마감 건물(finish 단계)을 놓는다 — 마감 검수 영수증이 지금 마감 그림 해시에 대해 PASS 인 것만(`--all` 은 마감본 전부).
  결과 이름에 `-finished` 가 붙는다.
"""
import base64
import datetime
import html as html_mod
import io
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import review  # noqa: E402

DEFAULT_SIZE = (52, 40)
YARD_CHOICES = (1, 2)
ROAD_HALF = 1
PLAZA = 7

def _h(x, y, salt=0):
    return ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) % 100

def ground_ramp(theme):
    return 'snow' if 'snow' in dot.palette(theme)['ramps'] else 'grass'

def _canvas(theme, ramp, tones):
    """tones = {(x, y): 단} 함수를 16×16 Cv 로. 화소마다 색을 고른다(난수가 아니라 좌표 함수)."""
    cv = dot.Cv(dot.T, dot.T)
    ramp_cols = dot.ramps(theme)[ramp]
    for y in range(dot.T):
        for x in range(dot.T):
            cv.a[y, x, :3] = ramp_cols[min(tones(x, y), len(ramp_cols) - 1)]
            cv.a[y, x, 3] = 255
    return cv

def _tile(theme, ramp, body, light=None, dark=None, salt=0):
    def tone(x, y):
        h = _h(x, y, salt)
        if dark is not None and h < 9:
            return dark
        if light is not None and h > 95:
            return light
        return body
    return _canvas(theme, ramp, tone)

def _road_tile(theme, salt=0):
    def tone(x, y):
        if y % 8 == 0:
            return 1
        if x % 16 == 0:
            return 2
        h = _h(x, y, salt)
        return 1 if h < 12 else 4 if h > 94 else 3
    return _canvas(theme, 'cobble', tone)

def _plaza_tile(theme, salt=0):
    def tone(x, y):
        if _h(x, y, salt) < 6:
            return 2
        return 4 if (x % 8 and y % 8) else 3
    return _canvas(theme, 'cobble', tone)

def _well(theme):
    cv = dot.Cv(dot.T * 2, dot.T * 2)
    stone, wood = 'stone', 'wood'
    for y in range(9, dot.T * 2 - 1):
        for x in range(2, dot.T * 2 - 2):
            if not (y < 13 or y > dot.T * 2 - 4):
                continue
            cv.put(x, y, dot.C(theme, stone, 4 if y % 3 else 3))
    for y in range(13, dot.T * 2 - 4):
        for x in range(4, dot.T * 2 - 4):
            cv.put(x, y, dot.C(theme, stone, 0))
    for x in (2, dot.T * 2 - 3):
        for y in range(2, 14):
            cv.put(x, y, dot.C(theme, wood, 2 if x == 2 else 1))
    for y in range(0, 4):
        for x in range(1, dot.T * 2 - 1):
            if y == 0 and (x < 3 or x > dot.T * 2 - 4):
                continue
            cv.put(x, y, dot.C(theme, wood, 3 if x < dot.T else 2))
    for y in range(4, 9):
        for x in range(dot.T - 1, dot.T + 1):
            cv.put(x, y, dot.C(theme, wood, 0))
    return cv


def _tree(theme):
    cv = dot.Cv(dot.T, dot.T * 2)
    snowy = 'snow' in dot.palette(theme)['ramps']
    ramp = 'ivy' if 'ivy' in dot.palette(theme)['ramps'] else 'grass'
    tones = (1, 2, 3) if ramp == 'ivy' else (0, 1, 2)
    cx, cy, rx, ry = 7.5, 13.0, 7.5, 11.0
    for y in range(0, 28):
        for x in range(dot.T):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d > 1.0:
                continue
            edge = d > 0.72
            tone = tones[0] if (edge or y > cy + 6) else tones[2] if (x + y) % 7 == 0 else tones[1]
            cv.put(x, y, dot.C(theme, ramp, tone))
    if snowy:
        for y in range(0, 24):
            for x in range(dot.T):
                if cv.a[y, x, 3] == 0:
                    continue
                above = y == 0 or cv.a[y - 1, x, 3] == 0
                cap = above or (y % 6 in (0, 1) and _h(x, y, 7) > 25)
                if cap:
                    cv.put(x, y, dot.C(theme, 'snow', 4 if y % 6 == 0 else 3))
    for y in range(24, 32):
        for x in (6, 7, 8):
            cv.put(x, y, dot.C(theme, 'wood', 2 if x < 7 else 0))
    return cv


def _bush(theme):
    cv = dot.Cv(dot.T, dot.T)
    ramp = 'ivy' if 'ivy' in dot.palette(theme)['ramps'] else 'grass'
    tones = (1, 2, 3) if ramp == 'ivy' else (0, 1, 2)
    for y in range(7, 16):
        for x in range(1, 15):
            d = ((x - 7.5) / 6.5) ** 2 + ((y - 11.5) / 4.0) ** 2
            if d > 1.0:
                continue
            cv.put(x, y, dot.C(theme, ramp, tones[0] if d > 0.7 else tones[1] if (x + y) % 5 else tones[2]))
    return cv

def _road_center(x, w, h, rng_phase):
    mid = h // 2 + 2
    return int(round(mid + 3.0 * math.sin(2 * math.pi * (x / w * 1.1 + rng_phase))))

def _place_recipes(recipes, kits, size, road_rows, avoid=()):
    w, h = size
    placed = []
    i = 0
    for side in (0, 1):
        x = 2 + side * 3
        while x < w - 2 and recipes:
            recipe = recipes[i % len(recipes)]
            kit = kits[recipe['id']]
            cols, rows = kit['cols'], kit['rows']
            if x + cols >= w:
                break
            center = min(road_rows[min(w - 1, x + k)] for k in range(cols))
            yard = YARD_CHOICES[i % len(YARD_CHOICES)]
            if side == 0:
                bottom = center - ROAD_HALF - 1 - yard
                top = bottom - rows + 1
            else:
                top = center + ROAD_HALF + 1 + yard
                bottom = top + rows - 1
            rect = (x, top, x + cols, bottom + 1)
            if top < 1 or bottom > h - 1 or any(_hit(rect, p['rect']) for p in placed) \
                    or any(_hit(rect, q) for q in avoid):
                x += cols + 3
                i += 1
                continue
            placed.append({'recipe': recipe, 'kit': kit, 'rect': rect, 'door': kit['door'],
                           'yard': yard, 'side': side, 'id': f"{recipe['id']}#{len(placed) + 1}"})
            x += cols + 3
            i += 1
    return placed

def _hit(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

def _walkable(placed, w, h):
    grid = [['.'] * w for _ in range(h)]
    for p in placed:
        kit = p['kit']
        for j, row in enumerate(kit['walkGrid']):
            for k, ch in enumerate(row):
                if ch == 'X':
                    grid[p['rect'][1] + j][p['rect'][0] + k] = 'X'
    return grid

def _reach(grid, start, targets):
    seen = {start}
    queue = [start]
    while queue:
        cx, cy = queue.pop(0)
        if (cx, cy) in targets:
            return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]) and (nx, ny) not in seen and grid[ny][nx] != 'X':
                seen.add((nx, ny))
                queue.append((nx, ny))
    return False

def plan(theme, rid, line, seed=0, size=DEFAULT_SIZE, all_=False, parts=None, finished=False):
    recipes = [b for b in AS.round_buildings(theme, rid)]
    if parts is None:
        import harness
        rendered = harness.render_round(theme, rid)[1]
        parts = harness.parts_for(theme, rid, line, rendered)
    fin, fin_why = {}, {}
    if finished:
        import finish
        fin, fin_why = finish.finished_candidates(theme, rid, {line: parts})
    used, skipped = [], []
    kits = {}
    for recipe in recipes:
        res = AS.assemble(recipe, parts, dot.palette(theme), theme)
        if res['img'] is None or AS.run_checks(res):
            skipped.append((recipe['id'], f'needs drawing: {", ".join(res["needsDrawing"])}' if res.get('needsDrawing')
                            else '조립 관문 FAIL'))
            continue
        im = res['img'].img()
        bid = f'{line}.{recipe["id"]}'
        if finished:
            if bid not in fin:
                skipped.append((recipe['id'], '마감본 없음 — ' + fin_why.get(bid, 'finish 미실행')))
                continue
            im = fin[bid]['img']
        ok = review.passed(theme, rid, bid, im, finished)
        if not ok and not all_:
            rec = review.receipt(theme, rid, bid, finished)
            why = '검수 영수증 없음' if not rec else (
                f'검수 {rec.get("verdict")} ({rec.get("votes", "?")})' if rec.get('verdict') != 'PASS'
                else '영수증 해시가 지금 그림과 다르다')
            skipped.append((recipe['id'], why))
            continue
        used.append({'recipe': recipe, 'img': im, 'kit': res['kit'],
                     'review': 'PASS' if ok else 'PASS 없음(--all)'})
        kits[recipe['id']] = res['kit']
    rng = random.Random(seed)
    w, h = size
    phase = rng.random()
    road_rows = [_road_center(x, w, h, phase) for x in range(w)]
    px0 = max(1, w // 3 - PLAZA // 2)
    pc = road_rows[px0 + PLAZA // 2]
    plaza_rect = (px0, pc - PLAZA // 2, px0 + PLAZA, pc + PLAZA // 2 + 1)
    placed = _place_recipes([u['recipe'] for u in used], kits, size, road_rows, avoid=[plaza_rect])
    return {'theme': theme, 'round': rid, 'line': line, 'seed': seed, 'size': size, 'finished': finished,
            'road_rows': road_rows, 'placed': placed, 'used': used, 'skipped': skipped,
            'plaza_rect': plaza_rect, 'well_at': (px0 + PLAZA // 2 - 1, pc - 1),
            'images': {u['recipe']['id']: u['img'] for u in used}}

def compose(theme, rid, line, seed=0, size=DEFAULT_SIZE, all_=False, parts=None, finished=False):
    p = plan(theme, rid, line, seed, size, all_, parts, finished)
    w, h = size
    pal = dot.palette(theme)
    ground = ground_ramp(theme)
    cv = dot.Cv(w * dot.T, h * dot.T)
    road_cells = set()
    plaza_cells = set()
    road_tile, plaza_tile = _road_tile(theme), _plaza_tile(theme)
    gbody, glight, gdark = 3, 4, 2
    ground_tiles = [_tile(theme, ground, gbody, glight, gdark, salt=k) for k in range(4)]
    for cy in range(h):
        for cx in range(w):
            t = ground_tiles[(cx * 3 + cy * 5) % 4]
            cv.a[cy * dot.T:(cy + 1) * dot.T, cx * dot.T:(cx + 1) * dot.T] = t.a
    for cx in range(w):
        c = p['road_rows'][cx]
        for dy in range(-ROAD_HALF, ROAD_HALF + 1):
            cy = c + dy
            if 0 <= cy < h:
                cv.a[cy * dot.T:(cy + 1) * dot.T, cx * dot.T:(cx + 1) * dot.T] = road_tile.a
                road_cells.add((cx, cy))
    px0, py0, px1, py1 = p['plaza_rect']
    for cy in range(py0, py1):
        for cx in range(px0, px1):
            if 0 <= cy < h and 0 <= cx < w:
                cv.a[cy * dot.T:(cy + 1) * dot.T, cx * dot.T:(cx + 1) * dot.T] = plaza_tile.a
                plaza_cells.add((cx, cy))
                road_cells.add((cx, cy))
    for pl in p['placed']:
        x0, y0 = pl['rect'][0], pl['rect'][1]
        cv.paste(dot.Cv.of(p['images'][pl['recipe']['id']]), x0 * dot.T, y0 * dot.T)
    yard_cells = set()
    for pl in p['placed']:
        dx, dy = pl['door']
        cx = pl['rect'][0] + dx
        cy = pl['rect'][1] + dy
        step = 1 if pl['side'] == 0 else -1
        y = cy + step
        while 0 <= y < h and (cx, y) not in road_cells:
            yard_cells.add((cx, y))
            cv.a[y * dot.T:(y + 1) * dot.T, cx * dot.T:(cx + 1) * dot.T] = road_tile.a
            y += step
    cv.paste(_well(theme), p['well_at'][0] * dot.T, p['well_at'][1] * dot.T)
    occupied = {pl['rect'] for pl in p['placed']}
    occupied_cells = [(x, y) for (x0, y0, x1, y1) in occupied for x in range(x0, x1) for y in range(y0, y1)]
    green = []
    rng = random.Random(seed * 7919 + 11)
    for _ in range(200):
        cx, cy = rng.randrange(1, w - 2), rng.randrange(3, h - 3)
        if (cx, cy) in road_cells or (cx, cy + 1) in road_cells or (cx, cy - 1) in road_cells \
                or (cx, cy) in yard_cells:
            continue
        if (cx, cy) in plaza_cells or any(_hit((cx, cy - 1, cx + 1, cy + 1), (q[0], q[1], q[0] + 1, q[1] + 1))
                                          for q in plaza_cells):
            continue
        if any(_hit((cx, cy, cx + 1, cy + 1), r) for r in occupied):
            continue
        if any((cx, cy + d) in road_cells or (cx, cy + d) in yard_cells for d in (-1, 0, 1)):
            continue
        if any(_hit((cx, cy - 1, cx + 1, cy + 1), (gx, gy, gx + 1, gy + 2)) for gx, gy in green):
            continue
        if any(_hit((cx, cy - 1, cx + 1, cy + 1), (ox, oy, ox + 1, oy + 1)) for ox, oy in occupied_cells):
            continue
        green.append((cx, cy))
        cv.paste(_tree(theme) if rng.random() < 0.6 else _bush(theme), cx * dot.T, (cy - 1) * dot.T)
        if len(green) >= 9:
            break
    grid = _walkable(p['placed'], w, h)
    failures = []
    for pl in p['placed']:
        dx, dy = pl['door']
        door = (pl['rect'][0] + dx, pl['rect'][1] + dy)
        start = (door[0], door[1] + (1 if pl['side'] == 0 else -1))
        if not _reach(grid, start, road_cells):
            failures.append(f'{pl["id"]}: 문 {door} 에서 길까지 걸어갈 수 없다')
    for i, a in enumerate(p['placed']):
        for b in p['placed'][i + 1:]:
            if _hit(a['rect'], b['rect']):
                failures.append(f'{a["id"]} 와 {b["id"]} 가 겹친다')
    return {**p, 'img': cv.img(), 'road': road_cells, 'plaza': plaza_cells, 'yard': yard_cells,
            'trees': green, 'failures': failures}

def write(theme, rid, line, seed=0, size=DEFAULT_SIZE, all_=False, quiet=False, finished=False):
    res = compose(theme, rid, line, seed, size, all_, finished=finished)
    base = os.path.join(dot.RUNS, theme, rid)
    os.makedirs(base, exist_ok=True)
    suf = '-finished' if finished else ''
    p1 = os.path.join(base, f'village-{line}{suf}.png')
    res['img'].save(p1)
    res['img'].resize((res['img'].width * 2, res['img'].height * 2), Image.NEAREST).save(
        os.path.join(base, f'village-{line}{suf}-x2.png'))
    html_path = os.path.join(dot.VIZ, f'bk-village-{theme}-{rid}-{line}{suf}.html')
    os.makedirs(dot.VIZ, exist_ok=True)
    open(html_path, 'w', encoding='utf-8').write(page(res))
    if not quiet:
        print(f'{theme} {rid} 줄 {line} 마을 {res["size"][0]}×{res["size"][1]}칸 · 건물 {len(res["placed"])}채 '
              f'· 실패 {len(res["failures"])} → {os.path.relpath(p1, dot.REPO)}')
        for pl in res['placed']:
            print(f'  {pl["id"]:22} 검수 {pl["review"]}  마당 {pl["yard"]}칸')
        for bid, why in res['skipped']:
            print(f'  건너뜀 {bid}: {why}')
        for f in res['failures']:
            print(f'  실패: {f}')
    return res, html_path

def _b64(im, scale=1):
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()

def page(res):
    rows = []
    for pl in res['placed']:
        rec = review.receipt(res['theme'], res['round'], f'{res["line"]}.{pl["recipe"]["id"]}', res.get('finished', False))
        status = 'PASS' if rec and rec.get('verdict') == 'PASS' else 'PASS 없음'
        pl['review'] = status
        rows.append(f'<tr><td>{html_mod.escape(pl["id"])}</td><td>{html_mod.escape(pl["recipe"].get("title", ""))}</td>'
                    f'<td>{pl["rect"][0]},{pl["rect"][1]}</td><td>{pl["yard"]}</td>'
                    f'<td class="{"ok" if status == "PASS" else "warn"}">{status}</td></tr>')
    skipped = ''.join(f'<li>{html_mod.escape(bid)} — {html_mod.escape(why)}</li>' for bid, why in res['skipped'])
    fails = ''.join(f'<li class="bad">{html_mod.escape(f)}</li>' for f in res['failures']) or '<li class="ok">없음</li>'
    return f'''<!doctype html><html lang="ko"><meta charset="utf-8">
<title>building-kit 마을 — {html_mod.escape(res["theme"])} {html_mod.escape(res["round"])} 줄 {res["line"]}</title>
<style>
body{{background:#16141c;color:#e6e2da;font:14px/1.6 system-ui,"Noto Sans KR",sans-serif;margin:0;padding:24px 28px 80px}}
h1{{font-size:21px;margin:0 0 4px}} h2{{font-size:16px;margin:26px 0 6px;border-top:1px solid #3a3644;padding-top:16px}}
.lead{{color:#b9b3a8;max-width:1000px}} img{{image-rendering:pixelated;display:block;max-width:100%}}
table{{border-collapse:collapse;font-size:13px}} td,th{{border:1px solid #3a3644;padding:3px 8px;text-align:left}}
.ok{{color:#8fd08f}} .bad{{color:#ff8a7a}} .warn{{color:#f0c060}} code{{background:#2a2633;padding:1px 5px;border-radius:3px}}
</style>
<h1>building-kit 마을 — {html_mod.escape(res["theme"])} · {html_mod.escape(res["round"])} · 줄 {res["line"]}{" · 마감" if res.get("finished") else ""}</h1>
<p class="lead">시드 {res["seed"]} · {res["size"][0]}×{res["size"][1]}칸 · 건물 {len(res["placed"])}채 ·
문에서 길까지 걸어가기 실패 {len(res["failures"])}건. 검수 PASS 인 건물만 놓았다(아니면 <code>--all</code>).
바닥·길·나무·우물은 테마 팔레트 램프 색으로만 그렸다.</p>
<h2>1배</h2><img alt="village 1x" src="data:image/png;base64,{_b64(res["img"])}">
<h2>2배</h2><img alt="village 2x" src="data:image/png;base64,{_b64(res["img"], 2)}">
<h2>놓은 건물</h2>
<table><tr><th>건물</th><th>이름</th><th>좌표</th><th>마당</th><th>검수</th></tr>{''.join(rows)}</table>
<h2>건너뛴 건물</h2><ul>{skipped or '<li>없음</li>'}</ul>
<h2>문→길 도달 실패</h2><ul>{fails}</ul>
'''
