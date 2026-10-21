"""building-kit 조립 — 부품을 seed buildings 레시피대로 붙여 건물 한 채를 만든다.

레시피: {id, title, use, cols, storeys, roof, wall, walls: [층마다 칸 순서], band?, base, overhang?, extras?}
  - roof/wall/band/base = 부품 세트 항목 id. 조각은 role 로 찾는다(roof: l·m·r, wall: l·m·w·d·r, band/base: l·m·r).
  - walls[층] 의 글자: L 왼끝 · M 가운데 · W 창 · D 문 · R 오른끝. 문은 1층(맨 아래 층)에만.
  - extras: [{part: 항목 id, at: [칸 x, 칸 y]}] — 지붕·벽 위 고정 좌표에 얹는다.

세로 순서(위→아래): 지붕 → (층마다 벽 → 층 띠) → 기단.

조립 관문(FAIL)
  A1 문 정확히 하나(맨 아래 층) — 쌍문은 시드가 doorTwice 를 명시한 레시피만 예외
  A2 지붕과 벽 사이 투명·바탕색 틈 없음(벽 모든 열)
  A3 지붕이 벽 폭을 덮음(처마 0~1칸 돌출)
  A4 기단 맨 아래 행 = 그림 맨 아래 칸 경계
  A5 모든 맞닿은 조각 쌍의 이음(위 조각 아래 열 ↔ 아래 조각 윗 열, gate.check_join)
  A6 지붕 윗면 높이 비율 0.30~0.50(지붕 행 / 건물 전체 행 — object-gen --min-top 30 --max-top 50 과 같은 범위)
"""
import numpy as np

import dot
import gate as G

LETTER_ROLE = {'L': 'l', 'M': 'm', 'W': 'w', 'D': 'd', 'R': 'r'}
ROOF_ROLES = ('l', 'm', 'r')
EDGE_ROLES = ('l', 'm', 'r')
TOP_MIN, TOP_MAX = 0.30, 0.50


def _r(code, level, ok, msg):
    return {'code': code, 'level': level, 'ok': bool(ok), 'msg': msg}


def _role(item, role):
    for pc in item['pieces']:
        if pc.get('role') == role:
            return pc
    return None


def _piece_crop(sheet_img, pc):
    x, y = pc['at'][0] * dot.T, pc['at'][1] * dot.T
    w, h = pc['size'][0] * dot.T, pc['size'][1] * dot.T
    return sheet_img.crop((x, y, x + w, y + h))


def assemble(recipe, items, pal, theme):
    """items = {항목 id: {'item': 시드 항목, 'img': PIL}}. 반환 {img, kit, checks, pieces, door, height, width}."""
    checks = []
    need = [recipe['roof'], recipe['wall'], recipe['base']] + ([recipe['band']] if recipe.get('band') else [])
    missing = [i for i in need if i not in items]
    for ex in recipe.get('extras') or []:
        if ex['part'] not in items:
            missing.append(ex['part'])
    if missing:
        return {'img': None, 'kit': None, 'pieces': [], 'door': None,
                'checks': [_r('A0', 'FAIL', False, f'부품이 없다: {", ".join(sorted(set(missing)))}')]}

    roof, wall, base = items[recipe['roof']]['img'], items[recipe['wall']]['img'], items[recipe['base']]['img']
    band = items[recipe['band']]['img'] if recipe.get('band') else None
    cols, storeys = int(recipe['cols']), int(recipe['storeys'])
    overhang = int(recipe.get('overhang', 1))
    roof_pc = _role(items[recipe['roof']]['item'], 'l')
    rh = roof_pc['size'][1]
    wall_pc = _role(items[recipe['wall']]['item'], 'l')
    wh = wall_pc['size'][1]
    band_h = _role(items[recipe['band']]['item'], 'l')['size'][1] if band else 0
    base_pc = _role(items[recipe['base']]['item'], 'l')
    base_h = base_pc['size'][1]

    roof_w = cols + 2 * overhang
    wall_x = (roof_w - cols) // 2
    height = rh + storeys * wh + max(0, storeys - 1) * band_h + base_h
    cv = dot.Cv(roof_w * dot.T, height * dot.T)
    placed = []

    def put(item_id, sheet_img, pc, cx, cy, kind):
        crop = _piece_crop(sheet_img, pc)
        cv.paste(crop, cx * dot.T, cy * dot.T)
        placed.append({'item': item_id, 'piece': pc['id'], 'role': pc.get('role'), 'kind': kind,
                       'at': [cx, cy], 'size': pc['size'], 'crop': crop})

    y = 0
    roof_roles = ['l'] + ['m'] * max(0, roof_w - 2) + ['r']
    for i, role in enumerate(roof_roles):
        pc = _role(items[recipe['roof']]['item'], role)
        if pc is None:
            return {'img': None, 'kit': None, 'pieces': placed, 'door': None,
                    'checks': [_r('A0', 'FAIL', False, f'지붕 세트에 {role} 조각이 없다')]}
        put(recipe['roof'], roof, pc, i, y, 'roof')
    y += rh

    door_at = []
    for s in range(storeys):
        letters = recipe['walls'][s]
        if len(letters.replace(' ', '')) != cols:
            checks.append(_r('A0', 'FAIL', False, f'{s}층 칸 순서 "{letters}" 길이가 cols {cols} 와 다르다'))
            letters = (letters.replace(' ', '') + 'M' * cols)[:cols]
        else:
            letters = letters.replace(' ', '')
        for i, ch in enumerate(letters):
            role = LETTER_ROLE.get(ch)
            if role is None:
                checks.append(_r('A0', 'FAIL', False, f'{s}층 칸 글자 {ch!r} 를 모른다(L M W D R)'))
                role = 'm'
            pc = _role(items[recipe['wall']]['item'], role)
            if pc is None:
                checks.append(_r('A0', 'FAIL', False, f'벽 세트에 {role} 조각이 없다'))
                continue
            put(recipe['wall'], wall, pc, wall_x + i, y, 'wall')
            if ch == 'D':
                door_at.append((wall_x + i, y))
        y += wh
        if band and s < storeys - 1:
            for i, role in enumerate(['l'] + ['m'] * max(0, cols - 2) + ['r']):
                pc = _role(items[recipe['band']]['item'], role)
                if pc is None:
                    checks.append(_r('A0', 'FAIL', False, f'층 띠 세트에 {role} 조각이 없다'))
                    continue
                put(recipe['band'], band, pc, wall_x + i, y, 'band')
            y += band_h

    for i, role in enumerate(['l'] + ['m'] * max(0, cols - 2) + ['r']):
        pc = _role(items[recipe['base']]['item'], role)
        if pc is None:
            checks.append(_r('A0', 'FAIL', False, f'기단 세트에 {role} 조각이 없다'))
            continue
        put(recipe['base'], base, pc, wall_x + i, y, 'base')

    for ex in recipe.get('extras') or []:
        sheet = items[ex['part']]['img']
        ax, ay = ex['at']
        for pc in items[ex['part']]['item']['pieces']:
            put(ex['part'], sheet, pc, ax + pc['at'][0], ay + pc['at'][1], 'extra')

    a = cv.a
    op = a[:, :, 3] == 255
    wall_top = rh
    wall_cols = range(wall_x, wall_x + cols)

    if recipe.get('doorTwice'):
        checks.append(_r('A1', 'FAIL', len(door_at) == 2, f'문 {len(door_at)}개 (쌍문 레시피)'))
    else:
        checks.append(_r('A1', 'FAIL', len(door_at) == 1, f'문 {len(door_at)}개' + ('' if len(door_at) == 1 else ' — 건물 하나에 문은 정확히 하나')))

    gaps = [x for x in wall_cols if not op[wall_top - 1, x * dot.T:x * dot.T + dot.T].all()]
    checks.append(_r('A2', 'FAIL', not gaps, '지붕과 벽 사이 틈 없음' if not gaps else f'지붕/벽 사이 틈 열 {gaps[:6]}'))

    ok3 = 0 <= roof_w - cols <= 2 and wall_x >= 0
    checks.append(_r('A3', 'FAIL', ok3, f'지붕 {roof_w}칸 vs 벽 {cols}칸 (처마 {roof_w - cols}칸, 0~2 이어야)'))

    last = height - 1
    ok4 = bool(op[last].any()) and op[last].all()
    checks.append(_r('A4', 'FAIL', ok4, f'기단 맨 아래 행 {last} 이 그림 맨 아래 칸 경계' if ok4 else '기단 아래에 빈 행이 있다(건물이 뜬다)'))

    checks.append(_a5(placed))

    ratio = rh / height
    checks.append(_r('A6', 'FAIL', TOP_MIN <= ratio <= TOP_MAX, f'지붕 {rh}행 / 건물 {height}행 = {ratio:.2f} (0.30~0.50)'))

    kit = _kit(recipe, placed, roof_w, height, rh, storeys, wh, band_h, base_h, wall_x, cols, door_at)
    return {'img': cv, 'kit': kit, 'checks': checks, 'pieces': placed, 'door': door_at[0] if door_at else None,
            'height': height, 'width': roof_w, 'wall_x': wall_x, 'cols': cols}


def _a5(placed):
    bad = []
    pairs = 0
    for p in placed:
        x0, y0 = p['at']
        x1, y1 = x0 + p['size'][0], y0 + p['size'][1]
        for q in placed:
            if q is p:
                continue
            qx, qy = q['at']
            if qy != y1:
                continue
            overlap = max(0, min(x1, qx + q['size'][0]) - max(x0, qx))
            if overlap <= 0:
                continue
            pairs += 1
            ok, s, lim = G.check_join(p['crop'], q['crop'], 'y')
            if not ok:
                bad.append(f'{p["item"]}:{p["piece"]}↓{q["item"]}:{q["piece"]} {s:.1f}>{lim:.1f}')
    if pairs == 0:
        return _r('A5', 'FAIL', False, '맞닿은 조각 쌍이 없다 — 배치가 잘못됐다')
    return _r('A5', 'FAIL', not bad, '맞닿은 조각 이음 어긋남 ' + ', '.join(bad) if bad else f'맞닿은 조각 {pairs}쌍 이음 통과')


def _kit(recipe, placed, width, height, rh, storeys, wh, band_h, base_h, wall_x, cols, door_at):
    lower = [['.'] * width for _ in range(height)]
    upper = [['.'] * width for _ in range(height)]
    walk = [['.'] * width for _ in range(height)]
    for p in placed:
        x0, y0 = p['at']
        for j in range(p['size'][1]):
            for i in range(p['size'][0]):
                X, Y = x0 + i, y0 + j
                if not (0 <= X < width and 0 <= Y < height):
                    continue
                if p['kind'] == 'roof':
                    upper[Y][X] = '★'
                    walk[Y][X] = '★'
                else:
                    lower[Y][X] = 'X'
                    walk[Y][X] = 'X'
    for (dx, dy) in door_at:
        walk[dy][dx] = 'o'
        lower[dy][dx] = 'o'
        if dy + 1 < height and walk[dy + 1][dx] == 'X':
            walk[dy + 1][dx] = '.'
    return {
        'building': recipe['id'], 'title': recipe.get('title', ''), 'use': recipe.get('use', ''),
        'cols': width, 'rows': height, 'tile': dot.T,
        'roofRows': rh, 'wallRows': wh, 'bandRows': band_h, 'baseRows': base_h, 'storeys': storeys,
        'wallX': wall_x, 'wallCols': cols,
        'lower': [''.join(r) for r in lower], 'upper': [''.join(r) for r in upper],
        'walkGrid': [''.join(r) for r in walk],
        'door': list(door_at[0]) if door_at else None,
        'walkNote': 'X 막힘 · ★ 지나감(그림이 사람 위 — 처마·지붕) · o 문 칸 · . 지나감',
    }


def run_checks(res):
    return [c for c in res['checks'] if not c['ok']]
