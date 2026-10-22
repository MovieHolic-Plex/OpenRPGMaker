"""building-kit 조립 — 부품을 seed buildings 레시피대로 붙여 건물 한 채를 만든다.

레시피(한 질량, 옛 모양도 그대로 된다):
  {id, title, use, cols, storeys, roof, wall, walls: [층마다 "L D M R"], band?, base?, extras?: [{part, at}]}
레시피(여러 질량 — 버들항 여관·사막 칸·탑처럼 덩어리를 합친다):
  {id, masses: [{id, cols, storeys, x, depth, roof, walls: [층마다 "L D R" 또는 {item, letters}], band?, base?, extras?}]}
  - x = 질량의 왼쪽 칸(0 = 그림 왼쪽 끝), depth = 0 이면 앞줄, 1 이면 한 칸 물러나 앉는다(앞 질량이 뒤 질량을 덮는다).
  - walls[층] 이 문자열이면 그 질량의 `wall` 을 쓴다. {item, letters} 면 층마다 다른 벽 재질이다
    (버들항 여관 = 1층 돌벽 wall.stone + 2층 반목조 wall.timber).
  - base 는 **선택**이다. 기본은 없다 — 벽 조각의 맨 아래 1~3px 이 스스로 기단(어두운 단·돌)이다.
    base 를 적은 레시피만 기단 행을 깐다(높은 사원의 계단 기단 같은 것). 전폭 보도블록은 금지다.

부품 역할: roof l·m·r (l·r 은 **2칸 폭** — 모임지붕 사선이 들어갈 자리, m 은 1칸 반복), wall l·m·w·d·r,
band/base l·m·r. 지붕 폭 = 벽 폭 = cols, 최소 4칸(l 2 + r 2).

세로 순서(질량마다, 위→아래): 지붕 → (층마다 벽 → 층 띠) → [기단].

조립 관문(FAIL)
  A1 문 정확히 하나(건물 전체 질량 합산) · 문이 앞 질량에 가려지지 않는다 — 쌍문은 doorTwice 만 예외
  A2 지붕과 벽 사이, 층과 층 사이에 투명·바탕색 틈 없음(질량마다). 위 조각의 맨 아래 행은 전부 불투명,
     아래 조각의 맨 윗행은 조각이 선언한 inset(처마 자리)만 비어 있을 수 있다
  A3 지붕 폭 = 벽 폭(cols) · cols ≥ 4 · 지붕 l·r 폭 2칸 · overhang 0
  A4 건물의 맨 아래 불투명 행이 그림 맨 아래 칸 경계 — 질량마다 칸 열의 맨 아래 불투명 화소가 그 질량의
     바닥 행이다(기단이 없으면 벽이, 있으면 기단이 바닥에 닿는다)
  A5 질량마다 맞닿은 조각 쌍의 이음(gate.check_join)
  A6 질량마다 지붕 윗면 높이 비율이 버들항 기준 실측 밴드(roofband) 안 — 모임·박공 0.37~0.62,
     평지붕·외쪽 0.30~0.62, 첨탑·원뿔은 세로 특징이라 밴드 밖(2행 이상만 본다)
  A7 질량들이 서로 닿거나 겹친다(가로로 빈틈 없이 이어지고 depth 차 ≤ 1, 앞줄 질량이 있다) — 떨어진 별개 건물 금지
  A8 masses 가 둘 이상이면 실루엣이 네모 판이 아니다(칸 열의 꼭대기 높이가 한 칸 이상 갈린다)
  A9 모임·박공 지붕은 용마루(지붕 맨 윗행의 가장 긴 불투명 구간)가 처마 폭의 0.35 이상 — 뾰족한 피라미드 금지
  A10 질량이 모두 같은 땅 행에 선다 — depth 는 앞뒤 순서만 정하지 세로로 밀지 않는다. 질량마다 맨 아래 불투명 행이
     같아야 하고, 건물 발자국 안에 질량 밑으로 투명(땅)이 비치면 안 된다. 층 높이도 질량마다 같다(벽 조각 높이 균일)
"""
import numpy as np

import dot
import gate as G
import roofband

LETTER_ROLE = {'L': 'l', 'M': 'm', 'W': 'w', 'D': 'd', 'R': 'r'}
ROOF_END = 2
MIN_COLS = 4
FLAT_MIN, FLAT_MAX = 0.30, 0.62
STOREY_CELLS = 2


def roof_kind(item):
    if item.get('spire') or item.get('cone'):
        return 'spire'
    return 'pitched' if int(item.get('end', ROOF_END)) == 2 else 'flat'

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

def _eave_px(role, inset, w=dot.T):
    """조각이 선언한 inset(바깥 가장자리에서 처마 자리로 비워 두는 화소). l 은 왼쪽, r 은 오른쪽."""
    n = int(inset or 0)
    if n <= 0 or role not in ('l', 'r'):
        return ()
    return tuple(range(0, min(n, w))) if role == 'l' else tuple(range(max(0, w - n), w))

def round_buildings(theme, rid=None):
    s = dot.seed(theme)
    ids = ((s.get('rounds') or {}).get(rid or '') or {}).get('buildings')
    if not ids:
        return s.get('buildings', [])
    by = {b['id']: b for b in s.get('buildings', [])}
    return [by[i] for i in ids if i in by]


def masses(recipe):
    raw = recipe.get('masses') or [dict(recipe)]
    out = []
    for i, m in enumerate(raw):
        mm = dict(m)
        mm.setdefault('id', f'm{i}')
        mm['x'] = int(m.get('x', 0))
        mm['depth'] = int(m.get('depth', 0))
        mm['cols'] = int(m['cols'])
        mm['storeys'] = int(m['storeys'])
        walls = []
        for row in m.get('walls') or []:
            if isinstance(row, dict):
                walls.append({'item': row.get('item') or m.get('wall'), 'letters': row.get('letters', '')})
            else:
                walls.append({'item': m.get('wall'), 'letters': row})
        mm['walls'] = walls
        out.append(mm)
    return out

def needed(recipe):
    out = set()
    for m in masses(recipe):
        for k in ('roof', 'wall', 'band', 'base'):
            if m.get(k):
                out.add(m[k])
        for row in m['walls']:
            if row.get('item'):
                out.add(row['item'])
        for ex in m.get('extras') or []:
            out.add(ex['part'])
    return out

def _mass_height(plan):
    return plan['rh'] + sum(w['h'] for w in plan['walls']) + plan['bands'] * plan['band_h'] + plan['base_h']

def assemble(recipe, items, pal, theme):
    """items = {항목 id: {'item': 시드 항목, 'img': PIL}}. 반환 {img, kit, checks, pieces, door, height, width, masses}."""
    checks = []
    missing = sorted(needed(recipe) - set(items))
    if missing:
        return {'img': None, 'kit': None, 'pieces': [], 'door': None, 'masses': [],
                'checks': [_r('A0', 'FAIL', False, f'부품이 없다: {", ".join(missing)}')]}

    plans = []
    for m in masses(recipe):
        roof_item = items[m['roof']]['item']
        if roof_item.get('spire'):
            rl = rm = rr = next((pc for pc in roof_item['pieces'] if pc.get('role') in ('m', 'x')), None)
        else:
            rl, rm, rr = (_role(roof_item, r) for r in ('l', 'm', 'r'))
        if not (rl and rm and rr):
            checks.append(_r('A0', 'FAIL', False, f'질량 {m["id"]}: 지붕 세트 {m["roof"]} 에 l·m·r 조각이 없다'))
            return {'img': None, 'kit': None, 'pieces': [], 'door': None, 'masses': [], 'checks': checks}
        walls = []
        for s, row in enumerate(m['walls']):
            wi = items.get(row['item'])
            wl = _role(wi['item'], 'l') if wi else None
            if wi is None or wl is None:
                checks.append(_r('A0', 'FAIL', False, f'질량 {m["id"]} {s}층: 벽 부품 {row["item"]} 이 없다'))
                return {'img': None, 'kit': None, 'pieces': [], 'door': None, 'masses': [], 'checks': checks}
            walls.append({'item': row['item'], 'img': wi['img'], 'item_def': wi['item'],
                          'letters': row['letters'].replace(' ', ''), 'h': wl['size'][1]})
        if len(walls) != m['storeys']:
            checks.append(_r('A0', 'FAIL', False,
                             f'질량 {m["id"]}: walls {len(walls)}개 ≠ storeys {m["storeys"]}'))
        band_item = items[m['band']]['item'] if m.get('band') else None
        base_item = items[m['base']]['item'] if m.get('base') else None
        plan = {'m': m, 'cols': m['cols'], 'x': m['x'], 'depth': m['depth'],
                'roof': m['roof'], 'roof_item': roof_item, 'roof_img': items[m['roof']]['img'],
                'lw': rl['size'][0], 'rw': rr['size'][0], 'rh': rl['size'][1],
                'end': int(roof_item.get('end', ROOF_END)),
                'walls': walls, 'band': m.get('band'), 'band_item': band_item,
                'band_h': (_role(band_item, 'l')['size'][1] if band_item else 0),
                'base': m.get('base'), 'base_item': base_item,
                'base_h': (_role(base_item, 'l')['size'][1] if base_item else 0),
                'extras': m.get('extras') or []}
        plan['bands'] = max(0, len(walls) - 1) if band_item else 0
        plan['h'] = _mass_height(plan)
        plans.append(plan)

    width = max(p['x'] + p['cols'] for p in plans)
    height = max(p['h'] for p in plans)
    cv = dot.Cv(width * dot.T, height * dot.T)
    owner = np.full((height * dot.T, width * dot.T), -1, int)
    placed = []
    doors = []
    bad3_pre = []

    def put(plan, item_id, sheet_img, pc, cx, cy, kind):
        crop = _piece_crop(sheet_img, pc)
        cv.paste(crop, cx * dot.T, cy * dot.T)
        a = np.array(crop.convert('RGBA'))
        op = a[:, :, 3] == 255
        y0, x0 = cy * dot.T, cx * dot.T
        h_, w_ = min(a.shape[0], owner.shape[0] - y0), min(a.shape[1], owner.shape[1] - x0)
        if h_ > 0 and w_ > 0:
            owner[y0:y0 + h_, x0:x0 + w_][op[:h_, :w_]] = plan['depth']
        rec = {'item': item_id, 'piece': pc['id'], 'role': pc.get('role'), 'kind': kind,
               'at': [cx, cy], 'size': pc['size'], 'crop': crop, 'inset': int(pc.get('inset') or 0),
               'mass': plan['m']['id'], 'depth': plan['depth']}
        placed.append(rec)
        return rec

    for plan in sorted(plans, key=lambda p: -p['depth']):
        y = height - plan['h']
        top = y
        nm = plan['cols'] - plan['lw'] - plan['rw']
        spire = roof_kind(plan['roof_item']) == 'spire'
        if spire:
            nm = plan['cols'] - 2 if plan['cols'] > 1 else 0
        if nm < 0:
            checks.append(_r('A3', 'FAIL', False,
                             f'질량 {plan["m"]["id"]}: cols {plan["cols"]} < 지붕 끝 {plan["lw"]}+{plan["rw"]}칸 — 최소 {MIN_COLS}칸'))
            return {'img': None, 'kit': None, 'pieces': placed, 'door': None, 'masses': [], 'checks': checks}
        roles = ['m'] if (spire and plan['cols'] == 1) else ['l'] + ['m'] * nm + ['r']
        roof_w = sum(_role(plan['roof_item'], r)['size'][0] for r in roles)
        if roof_w > plan['cols']:
            bad3_pre.append(f'{plan["m"]["id"]} 지붕 폭 {roof_w}칸 > 몸통 {plan["cols"]}칸')
            roles = roles[:max(1, plan['cols'])]
        cx = plan['x']
        plan['roof_recs'] = []
        for role in roles:
            pc = _role(plan['roof_item'], role)
            plan['roof_recs'].append(put(plan, plan['roof'], plan['roof_img'], pc, cx, y, 'roof'))
            cx += pc['size'][0]
        plan['roof_at'] = (plan['x'], y)
        y += plan['rh']
        for s, wall in enumerate(plan['walls']):
            letters = wall['letters']
            if len(letters) != plan['cols']:
                checks.append(_r('A0', 'FAIL', False,
                                 f'질량 {plan["m"]["id"]} {s}층 칸 순서 "{letters}" 길이가 cols {plan["cols"]} 와 다르다'))
                letters = (letters + 'M' * plan['cols'])[:plan['cols']]
            for i, ch in enumerate(letters):
                role = LETTER_ROLE.get(ch)
                if role is None:
                    checks.append(_r('A0', 'FAIL', False, f'질량 {plan["m"]["id"]} {s}층 칸 글자 {ch!r} 를 모른다(L M W D R)'))
                    role = 'm'
                pc = _role(wall['item_def'], role)
                if pc is None:
                    checks.append(_r('A0', 'FAIL', False, f'질량 {plan["m"]["id"]} 벽 세트 {wall["item"]} 에 {role} 조각이 없다'))
                    continue
                rec = put(plan, wall['item'], wall['img'], pc, plan['x'] + i, y, 'wall')
                rec['storey'] = s
                if ch == 'D':
                    doors.append({'mass': plan['m']['id'], 'depth': plan['depth'], 'at': [plan['x'] + i, y],
                                  'rec': rec, 'storey': s})
            plan.setdefault('storey_rows', []).append((s, y, wall['h']))
            y += wall['h']
            if plan['band_item'] and s < len(plan['walls']) - 1:
                bx = plan['x']
                for role in ['l'] + ['m'] * max(0, plan['cols'] - 2) + ['r']:
                    pc = _role(plan['band_item'], role)
                    if pc is None:
                        checks.append(_r('A0', 'FAIL', False, f'층 띠 세트 {plan["band"]} 에 {role} 조각이 없다'))
                        continue
                    put(plan, plan['band'], items[plan['band']]['img'], pc, bx, y, 'band')
                    bx += pc['size'][0]
                y += plan['band_h']
        if plan['base_item']:
            bx = plan['x']
            for role in ['l'] + ['m'] * max(0, plan['cols'] - 2) + ['r']:
                pc = _role(plan['base_item'], role)
                if pc is None:
                    checks.append(_r('A0', 'FAIL', False, f'기단 세트 {plan["base"]} 에 {role} 조각이 없다'))
                    continue
                put(plan, plan['base'], items[plan['base']]['img'], pc, bx, y, 'base')
                bx += pc['size'][0]
        for ex in plan['extras']:
            ax, ay = ex['at']
            for pc in items[ex['part']]['item']['pieces']:
                put(plan, ex['part'], items[ex['part']]['img'], pc,
                    plan['x'] + ax + pc['at'][0], top + ay + pc['at'][1], 'extra')
        plan['top'] = top

    a = cv.a
    op = a[:, :, 3] == 255

    if recipe.get('doorTwice'):
        checks.append(_r('A1', 'FAIL', len(doors) == 2, f'문 {len(doors)}개 (쌍문 레시피)'))
    else:
        checks.append(_r('A1', 'FAIL', len(doors) == 1,
                         f'문 {len(doors)}개' + ('' if len(doors) == 1 else ' — 건물 하나(질량 전부)에 문은 정확히 하나')))
    hidden = []
    for d in doors:
        rec = d['rec']
        crop = np.array(rec['crop'].convert('RGBA'))
        dop = crop[:, :, 3] == 255
        x0, y0 = rec['at'][0] * dot.T, rec['at'][1] * dot.T
        own = owner[y0:y0 + dop.shape[0], x0:x0 + dop.shape[1]][dop]
        if (own != d['depth']).any():
            hidden.append(d['mass'])
    if doors:
        checks.append(_r('A1', 'FAIL', not hidden,
                         '문이 보인다' if not hidden else f'문이 앞 질량에 가려진다: {sorted(set(hidden))}'))

    gaps = []
    for plan in plans:
        for (s, wy, wh) in plan.get('storey_rows', []):
            above = wy * dot.T - 1
            upper_ok = op[above, plan['x'] * dot.T:(plan['x'] + plan['cols']) * dot.T]
            if not upper_ok.all():
                gaps.append(f'{plan["m"]["id"]} {s}층 위 {int((~upper_ok).sum())}px')
            eave = s == 0
            for i in range(plan['cols']):
                x = (plan['x'] + i) * dot.T
                row = op[wy * dot.T, x:x + dot.T]
                role = 'l' if i == 0 else 'r' if i == plan['cols'] - 1 else 'm'
                piece = next((p for p in placed if p['mass'] == plan['m']['id'] and p['kind'] == 'wall'
                              and p['storey'] == s and p['at'][0] == plan['x'] + i), None)
                inset = _eave_px(role, piece['inset']) if (eave and piece) else ()
                if any(not row[j] for j in range(dot.T) if j not in inset):
                    gaps.append(f'{plan["m"]["id"]} {s}층 벽 위 {plan["x"] + i}열')
    checks.append(_r('A2', 'FAIL', not gaps,
                     '지붕·층 사이 틈 없음' if not gaps else f'지붕/벽·층 사이 틈 {gaps[:6]}'))

    bad3 = []
    bad3 += bad3_pre
    if int(recipe.get('overhang', 0)) != 0:
        bad3.append(f'overhang {recipe.get("overhang")} — 처마는 지붕 l·r 조각 안쪽 2~3px 에 그린다')
    for plan in plans:
        tag = plan['m']['id']
        if roof_kind(plan['roof_item']) == 'spire':
            if plan['cols'] not in (1, 2):
                bad3.append(f'{tag} 첨탑 질량 폭 {plan["cols"]}칸 — 탑은 1~2칸')
            if plan['lw'] != 1 or plan['rw'] != 1:
                bad3.append(f'{tag} 첨탑 지붕 끝 폭 l {plan["lw"]} r {plan["rw"]} (1칸)')
            continue
        if plan['cols'] < MIN_COLS:
            bad3.append(f'{tag} cols {plan["cols"]} < {MIN_COLS}(모임지붕 사선 l·r 2칸씩)')
        if plan['lw'] != plan['end'] or plan['rw'] != plan['end']:
            bad3.append(f'{tag} 지붕 끝 폭 l {plan["lw"]} r {plan["rw"]} ({plan["end"]}칸이어야)')
        if plan['lw'] + plan['rw'] + max(0, plan['cols'] - plan['lw'] - plan['rw']) != plan['cols']:
            bad3.append(f'{tag} 지붕 폭 ≠ 벽 폭')
    checks.append(_r('A3', 'FAIL', not bad3, f'지붕 폭 = 벽 폭({", ".join(str(p["cols"]) for p in plans)}칸), 끝 2칸, overhang 0'
                     if not bad3 else '; '.join(bad3)))

    bottom = height * dot.T - 1
    off = []
    if not op[bottom].any():
        off.append('그림 맨 아래 행이 비었다 — 건물이 뜬다')
    for plan in plans:
        for i in range(plan['cols']):
            x = (plan['x'] + i) * dot.T
            if not op[bottom, x:x + dot.T].any() and not op[bottom + 1:, x:x + dot.T].any():
                off.append(f'{plan["m"]["id"]} {plan["x"] + i}열이 자기 바닥(행 {bottom // dot.T})에도 안 닿는다')
    checks.append(_r('A4', 'FAIL', not off,
                     '맨 아래 불투명 행이 칸 경계 — 기단 없으면 벽이 땅에 닿는다' if not off
                     else f'건물이 뜬다/바닥보다 아래: {off[:4]}'))

    checks.append(_a10(plans, op, height))

    a5 = [_a5([p for p in placed if p['mass'] == plan['m']['id']]) for plan in plans]
    bad5 = [x for x in a5 if not x['ok']]
    checks.append(_r('A5', 'FAIL', not bad5,
                     a5[0]['msg'] if len(a5) == 1 and not bad5 else
                     (', '.join(x['msg'] for x in bad5) if bad5 else f'질량 {len(a5)}개 맞닿은 조각 이음 통과')))

    band = roofband.band()
    for plan in plans:
        ratio = plan['rh'] / max(plan['h'], 1)
        kind = roof_kind(plan['roof_item'])
        if kind == 'spire':
            ok = plan['rh'] >= 2
            span = '첨탑·원뿔은 세로 특징 — 비율 밴드 밖(2행 이상)'
        elif kind == 'pitched':
            ok = band['ratio_min'] <= ratio <= band['ratio_max']
            span = f"{band['ratio_min']:.2f}~{band['ratio_max']:.2f} (버들항 기준 실측)"
        else:
            ok = FLAT_MIN <= ratio <= FLAT_MAX
            span = f'{FLAT_MIN:.2f}~{FLAT_MAX:.2f} (평지붕·외쪽)'
        checks.append(_r('A6', 'FAIL', ok,
                         f'{plan["m"]["id"]} 지붕 {plan["rh"]}행 / 질량 {plan["h"]}행 = {ratio:.2f} ({span})'))

    checks.append(_a7(plans, len(masses(recipe)) > 1))

    ridge_bad = []
    for plan in plans:
        if roof_kind(plan['roof_item']) != 'pitched':
            continue
        frac, w = _ridge_frac(plan.get('roof_recs') or [])
        if frac < band['ridge_min']:
            ridge_bad.append(f'{plan["m"]["id"]} 용마루 {int(round(frac * w))}px / 처마 {w}px = {frac:.2f}')
    checks.append(_r('A9', 'FAIL', not ridge_bad,
                     f'용마루가 처마 폭의 {band["ridge_min"]:.2f} 이상' if not ridge_bad
                     else f'뾰족한 지붕(용마루 하한 {band["ridge_min"]:.2f}): ' + '; '.join(ridge_bad)))

    checks.append(_a11(plans, pal))

    if len(plans) > 1:
        tops = []
        for i in range(width):
            rows = np.nonzero(op[:, i * dot.T:(i + 1) * dot.T].any(axis=1))[0]
            tops.append(int(rows.min()) if len(rows) else height * dot.T)
        step = max(tops) - min(tops)
        checks.append(_r('A8', 'FAIL', step >= dot.T,
                         f'실루엣 꼭대기 높이 차 {step}px (한 칸 {dot.T}px 이상 갈려야 네모 판이 아니다)'))

    door_at = [d['at'] for d in doors]
    kit = _kit(recipe, plans, placed, width, height, doors)
    return {'img': cv, 'kit': kit, 'checks': checks, 'pieces': placed,
            'door': door_at[0] if door_at else None, 'height': height, 'width': width,
            'masses': [{'id': p['m']['id'], 'x': p['x'], 'depth': p['depth'], 'cols': p['cols'],
                        'rows': p['h'], 'top': p['top'], 'roof': p['roof'],
                        'walls': [w['item'] for w in p['walls']]} for p in plans]}

def mass_rows(m, items):
    """레시피 질량 하나의 세로 칸 수(지붕 + 층 벽 + 층 띠 + 기단). 부품 그림 없이 계약만으로 센다."""
    roof = items[m['roof']]['pieces'][0]['size'][1]
    walls = sum(items[row['item'] if isinstance(row, dict) else m.get('wall')]['pieces'][0]['size'][1]
                for row in (m.get('walls') or []))
    band = items[m['band']]['pieces'][0]['size'][1] if m.get('band') else 0
    base = items[m['base']]['pieces'][0]['size'][1] if m.get('base') else 0
    return roof + walls + band * max(0, int(m.get('storeys') or len(m.get('walls') or [])) - 1) + base


def mass_problems(ms):
    if len(ms) < 2:
        return []
    bad = []
    depths = [int(m.get('depth') or 0) for m in ms]
    if max(depths) - min(depths) > 1:
        bad.append(f'depth 차 {max(depths) - min(depths)} > 1 — 질량 사이에 빈 칸 행이 생긴다')
    spans = sorted((int(m.get('x') or 0), int(m.get('x') or 0) + int(m['cols']), m['id']) for m in ms)
    end = spans[0][1]
    for x0, x1, mid in spans[1:]:
        if x0 > end:
            bad.append(f'{mid} 가 x {end}~{x0} 에서 떨어져 있다 — 질량은 닿거나 겹쳐야 한다')
        end = max(end, x1)
    for m in ms:
        if int(m.get('x') or 0) < 0:
            bad.append(f'{m["id"]} x {m["x"]} < 0')
    return bad

def roof_problems(item):
    if item.get('spire'):
        bad = []
        pcs = item['pieces']
        if len(pcs) != 3 or {pc.get('role') for pc in pcs} != {'l', 'm', 'r'}:
            return ['첨탑 세트는 l·m·r 세 조각(각 1칸)이다']
        if any(pc['size'][0] != 1 for pc in pcs):
            bad.append('첨탑 조각 폭이 1칸이 아니다')
        if len({pc['size'][1] for pc in pcs}) != 1:
            bad.append('조각 높이가 다르다')
        if pcs[0]['size'][1] < 3:
            bad.append(f'첨탑 {pcs[0]["size"][1]}행 — 3행 이상의 가늘고 긴 첨탑')
        if item['size'][0] != 3:
            bad.append(f'첨탑 세트 폭 {item["size"][0]} — 3칸(l 1 + m 1 + r 1)')
        return bad
    rl, rm, rr = (_role(item, r) for r in ('l', 'm', 'r'))
    if not (rl and rm and rr):
        return ['l·m·r 조각이 없다']
    bad = []
    end = int(item.get('end', ROOF_END))
    if end not in (1, ROOF_END):
        bad.append(f'end {end} — 1칸(평지붕·외쪽) 또는 2칸(모임 사선)')
    if rl['size'][0] != end or rr['size'][0] != end:
        bad.append(f'끝 폭 l {rl["size"][0]} r {rr["size"][0]} — {end}칸이어야 한다')
    if rm['size'][0] != 1:
        bad.append(f'가운데 폭 {rm["size"][0]} — 1칸 반복이다')
    if len({rl['size'][1], rm['size'][1], rr['size'][1]}) != 1:
        bad.append('조각 높이가 다르다')
    rows = rl['size'][1]
    if rows not in (2, 3, 4):
        bad.append(f'지붕 {rows}행 — 2~4행(style-r4 부터 1층 2행·2층 3행, 옛 판은 3·4행)')
    if item['size'][0] != end * 2 + 1:
        bad.append(f'세트 폭 {item["size"][0]} — l {end} + m 1 + r {end} = {end * 2 + 1}칸')
    return bad

def _ridge_frac(recs):
    """질량의 지붕 조각을 왼쪽부터 이어 붙여 맨 윗행의 가장 긴 불투명 구간을 잰다(가림 영향 없음)."""
    if not recs:
        return 0.0, 0
    strip = np.concatenate([np.array(r['crop'].convert('RGBA'))
                            for r in sorted(recs, key=lambda r: r['at'][0])], axis=1)
    op = strip[:, :, 3] == 255
    w = int(op.shape[1])
    best = 0
    for a, b in _row_runs(op[0]):
        best = max(best, b - a + 1)
    return best / max(w, 1), w


def _row_runs(row):
    idx = np.nonzero(row)[0]
    if not len(idx):
        return []
    out, start, prev = [], int(idx[0]), int(idx[0])
    for x in idx[1:]:
        x = int(x)
        if x != prev + 1:
            out.append((start, prev))
            start = x
        prev = x
    out.append((start, prev))
    return out


def _a10(plans, op, height):
    bad = []
    grounds = {}
    for plan in plans:
        x0, x1 = plan['x'] * dot.T, (plan['x'] + plan['cols']) * dot.T
        rows = np.nonzero(op[:, x0:x1].any(axis=1))[0]
        g = int(rows.max()) if len(rows) else -1
        grounds[plan['m']['id']] = g
        if g >= 0 and not op[g + 1:, x0:x1].all():
            holes = int((~op[g + 1:, x0:x1]).sum())
            bad.append(f'{plan["m"]["id"]} 밑으로 빈 칸(땅) {holes}px — 질량이 땅에서 떴다')
    if len(set(grounds.values())) > 1:
        bad.append('질량마다 맨 아래 불투명 행이 다르다: '
                   + ', '.join(f'{k} 행 {v // dot.T}' for k, v in grounds.items()))
    heights = {}
    for plan in plans:
        hs = {w['h'] for w in plan['walls']}
        if len(hs) > 1:
            bad.append(f'{plan["m"]["id"]} 층 높이가 층마다 다르다 {sorted(hs)}')
        if hs and hs != {STOREY_CELLS}:
            bad.append(f'{plan["m"]["id"]} 벽 높이 {sorted(hs)} — 층은 {STOREY_CELLS}칸이다')
        heights[plan['m']['id']] = max(hs) if hs else 0
    if len(set(heights.values())) > 1:
        bad.append(f'질량마다 층 높이가 다르다 {heights}')
    return _r('A10', 'FAIL', not bad,
              f'질량 {len(plans)}개가 같은 땅 행(행 {height - 1})에 서고 질량 밑에 땅이 비치지 않는다'
              if not bad else '; '.join(bad))


def _a11(plans, pal):
    """탑 지붕(첨탑·원뿔) — 탑 몸통보다 좌우 2px 썩만 넓고, 건물 주 지붕과 같은 재료 램프."""
    bad = []
    main = max((p for p in plans if roof_kind(p['roof_item']) != 'spire'),
               key=lambda p: p['cols'] * p['h'], default=None)
    main_ramp = G.dominant_ramp(np.array(main['roof_img'].convert('RGBA')), pal) if main else None
    for plan in plans:
        kind = roof_kind(plan['roof_item'])
        if kind != 'spire' or plan is main:
            continue
        tag = plan['m']['id']
        recs = plan.get('roof_recs') or []
        if recs:
            strip = np.concatenate([np.array(r['crop'].convert('RGBA'))
                                    for r in sorted(recs, key=lambda r: r['at'][0])], axis=1)
            xs = np.nonzero((strip[:, :, 3] == 255).any(axis=0))[0]
            width = int(xs.max() - xs.min() + 1) if len(xs) else 0
            limit = plan['cols'] * dot.T + 4
            if width > limit:
                kindname = '첨탑' if plan['roof_item'].get('spire') else '원뿔'
                bad.append(f'{tag} {kindname} 폭 {width}px > 탑 몸통 '
                           f'{plan["cols"] * dot.T}px + 4px')
            ramp = G.dominant_ramp(strip, pal)
            if main_ramp and ramp != main_ramp:
                bad.append(f'{tag} 탑 지붕 재료 램프 {ramp} ≠ 주 지붕 {main_ramp}')
    return _r('A11', 'FAIL', not bad,
              '탑 지붕은 탑 몸통 + 좌우 2px 이내이고 주 지붕과 같은 램프' if not bad else '; '.join(bad))


def _a7(plans, multi):
    if not multi:
        return _r('A7', 'FAIL', True, '질량 하나 — 떨어짐 없음')
    bad = mass_problems([p['m'] for p in plans])
    if not any(p['depth'] == 0 for p in plans):
        bad.append('앞줄(depth 0) 질량이 없다 — 건물이 떠 있다')
    return _r('A7', 'FAIL', not bad,
              f'질량 {len(plans)}개가 닿거나 겹친다' if not bad else '; '.join(bad))

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

def _kit(recipe, plans, placed, width, height, doors):
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
    for d in doors:
        dx, dy = d['at']
        walk[dy][dx] = 'o'
        lower[dy][dx] = 'o'
        if dy + 1 < height and walk[dy + 1][dx] == 'X':
            walk[dy + 1][dx] = '.'
    front = max(plans, key=lambda p: (p['depth'] == 0, p['cols'], p['h']))
    door_plan = next((p for p in plans if d_belongs(p, doors)), front)
    return {
        'building': recipe['id'], 'title': recipe.get('title', ''), 'use': recipe.get('use', ''),
        'cols': width, 'rows': height, 'tile': dot.T,
        'roofRows': front['rh'], 'wallRows': front['walls'][0]['h'] if front['walls'] else 0,
        'bandRows': front['band_h'], 'baseRows': front['base_h'], 'storeys': front['m']['storeys'],
        'wallX': door_plan['x'], 'wallCols': door_plan['cols'],
        'doorMass': door_plan['m']['id'],
        'lower': [''.join(r) for r in lower], 'upper': [''.join(r) for r in upper],
        'walkGrid': [''.join(r) for r in walk],
        'door': list(doors[0]['at']) if doors else None,
        'masses': [{'id': p['m']['id'], 'x': p['x'], 'depth': p['depth'], 'cols': p['cols'], 'rows': p['h'],
                    'top': p['top'], 'roof': p['roof'], 'walls': [w['item'] for w in p['walls']],
                    'storeys': p['m']['storeys'], 'band': p.get('band'), 'base': p.get('base')} for p in plans],
        'walkNote': 'X 막힘 · ★ 지나감(그림이 사람 위 — 처마·지붕) · o 문 칸 · . 지나감',
    }

def d_belongs(plan, doors):
    return any(d['mass'] == plan['m']['id'] for d in doors)

def run_checks(res):
    return [c for c in res['checks'] if not c['ok']]
