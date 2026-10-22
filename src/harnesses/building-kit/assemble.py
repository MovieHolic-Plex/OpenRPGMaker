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

투영 문법 개정(2026-10-22, 사용자 반려 「집이 이 각도로 보여야 한다 — 지금은 전혀 아니다」) — 질량 종류 `kind`:
  ridge_side  (기본) 용마루가 정면과 나란한 옛 지붕(모임·박공·평·첨탑). 옛 판은 전부 이것이다.
  gable_front 박공 끝(삼각 벽)이 남쪽(보는 쪽)을 보고 용마루가 북쪽으로 물러난다. 화면에서 용마루는 앞 꼭대기에서
              뒤 꼭대기까지 **세로선**이고, 그 왼쪽 사면(밝음)·오른쪽 사면(어두움)이 세로로 긴 면으로 보인다.
              위→아래: 뒤 끝 `back` 의 b<c>(또는 골 v<c>) → 사면 띠 `roof` 의 l·ml·k|k2·mr·r × depth_rows → 앞 박공
              `gable` 의 g<c> → 층마다 벽(→ 층 띠). cols 2~6, depth_rows 2~6. back_end: gable(뒤 박공) | valley(골).
  lean_to     옆에 붙는 외쪽 지붕. low(left|right) = 낮은 처마 쪽. 위→아래: lb<c> → hi·m·lo × depth_rows → lf<c> → 벽.
  extras 의 {part, at, on: "roof"} 는 그 질량 지붕 면 위에 얹는다(굴뚝·지붕창). at[1] 이 음수면 질량 위로 솟는다.

  A12 박공 정면 질량: 용마루(가운데 2px 띠)가 뒤 끝 꼭대기부터 앞 꼭대기까지 끊기지 않고, 사면 띠의 모든 행에서
      양옆 사면과 다른 색 선이다 · 왼쪽 사면 평균 밝기가 오른쪽보다 SLOPE_STEP 이상 밝다(빛은 왼쪽 위)
  A13 지붕 만남: back_end valley 는 뒤 끝 윗변 바로 위가 전부 더 뒤 질량의 **지붕** 화소(골 화소는 앞 날개 것),
      뒤 박공·외쪽 뒤 끝 윗변 바로 위에 더 뒤 질량의 지붕이 있으면 FAIL(지붕 속에 박힌 박공 — valley 를 쓴다)
  A14 on: roof 부속: 밑동(맨 아래 불투명 행)의 화소가 전부 그 질량 지붕 화소 위이고, 어느 화소도 그 질량 벽에 걸치지 않는다
  A15 시드 판의 requireGableFront 가 켜져 있으면 건물마다 gable_front 질량이 하나 이상(round_buildings 가 표시)
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

RIDGE_SIDE, GABLE_FRONT, LEAN_TO = 'ridge_side', 'gable_front', 'lean_to'
RECEDING = (GABLE_FRONT, LEAN_TO)
KINDS = (RIDGE_SIDE, GABLE_FRONT, LEAN_TO)
GF_COLS = (2, 6)
LEAN_COLS = (2, 3)
DEPTH_ROWS = (2, 6)
# 물러나는 지붕(박공 정면·외쪽)은 지붕이 실루엣의 대부분이다(사용자 판정 2026-10-22, 높은 3/4 카메라) —
# 벽은 질량 아래 띠. 옛 A6 밴드(버들항 모임지붕 실측)는 용마루가 정면과 나란한 지붕의 것이라 여기 쓰지 않는다.
RECEDING_MIN, RECEDING_MAX = 0.50, 0.85
RIDGE_STEP = 6.0
SLOPE_STEP = 8.0
ROOF_KINDS = ('roof',)


def gf_body_roles(cols):
    """박공 정면 사면 띠 한 행의 조각 순서(왼→오). 홀수 폭은 1칸 용마루 k, 짝수 폭은 2칸 용마루 k2 — 꼭대기가 가운데."""
    c = int(cols)
    if c <= 2:
        return ['k2']
    if c % 2:
        n = (c - 3) // 2
        return ['l'] + ['ml'] * n + ['k'] + ['mr'] * n + ['r']
    n = (c - 4) // 2
    return ['l'] + ['ml'] * n + ['k2'] + ['mr'] * n + ['r']


def lean_body_roles(cols, low):
    mid = ['m'] * max(0, int(cols) - 2)
    return ['lo'] + mid + ['hi'] if low == 'left' else ['hi'] + mid + ['lo']


def end_roles(m):
    """질량의 (뒤 끝 role, 앞 조각 role)."""
    c = int(m['cols'])
    if m['kind'] == GABLE_FRONT:
        return ('v' if m.get('back_end') == 'valley' else 'b') + str(c), f'g{c}'
    return f'lb{c}', f'lf{c}'


def body_roles(m):
    return gf_body_roles(m['cols']) if m['kind'] == GABLE_FRONT else lean_body_roles(m['cols'], m.get('low'))


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

def requires_gable_front(theme, rid):
    """시드 판의 requireGableFront(style-r5 부터) — 건물마다 gable_front 질량이 있어야 한다(A15)."""
    return bool(((dot.seed(theme).get('rounds') or {}).get(rid or '') or {}).get('requireGableFront'))

def round_buildings(theme, rid=None):
    """그 판의 레시피. 판이 requireGableFront 면 사본에 `_requireGableFront` 를 붙여 assemble 이 A15 를 본다 —
    조립·검수·마을·시트 어느 경로로 조립해도 같은 관문을 거친다."""
    s = dot.seed(theme)
    ids = ((s.get('rounds') or {}).get(rid or '') or {}).get('buildings')
    if not ids:
        return s.get('buildings', [])
    by = {b['id']: b for b in s.get('buildings', [])}
    out = [by[i] for i in ids if i in by]
    if requires_gable_front(theme, rid):
        out = [dict(b, _requireGableFront=True) for b in out]
    return out


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
        mm['kind'] = m.get('kind') or RIDGE_SIDE
        if mm['kind'] in RECEDING:
            mm['depth_rows'] = int(m.get('depth_rows') or 0)
        if mm['kind'] == GABLE_FRONT:
            mm['back_end'] = m.get('back_end') or 'gable'
            mm['back'] = m.get('back') or m.get('gable')
        if mm['kind'] == LEAN_TO:
            mm['gable'] = mm['back'] = m.get('roof')
            mm['low'] = m.get('low') or 'right'
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
        for k in ('roof', 'wall', 'band', 'base', 'gable', 'back'):
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

def _receding_roof(m, items):
    """물러나는 질량의 지붕 조각(뒤 끝·사면 띠·앞 조각). 없으면 (None, 이유)."""
    back_role, front_role = end_roles(m)
    back_pc = _role(items[m['back']]['item'], back_role)
    front_pc = _role(items[m['gable']]['item'], front_role)
    body = [(r, _role(items[m['roof']]['item'], r)) for r in body_roles(m)]
    miss = [f'{m["back"]}:{back_role}'] if back_pc is None else []
    miss += [f'{m["gable"]}:{front_role}'] if front_pc is None else []
    miss += [f'{m["roof"]}:{r}' for r, pc in body if pc is None]
    if miss:
        return None, f'질량 {m["id"]}({m["kind"]} {m["cols"]}칸): 조각이 없다 {", ".join(dict.fromkeys(miss))}'
    body_h = {pc['size'][1] for _, pc in body}
    return {'back_pc': back_pc, 'front_pc': front_pc, 'body': [pc for _, pc in body],
            'back_h': back_pc['size'][1], 'front_h': front_pc['size'][1], 'body_h': max(body_h),
            'body_hs': body_h}, None

def assemble(recipe, items, pal, theme, require_gable_front=None):
    """items = {항목 id: {'item': 시드 항목, 'img': PIL}}. 반환 {img, kit, checks, pieces, door, height, width, masses}.

    require_gable_front 가 None 이면 레시피의 `_requireGableFront`(round_buildings 가 판 플래그로 붙인다)를 따른다."""
    checks = []
    if require_gable_front is None:
        require_gable_front = bool(recipe.get('_requireGableFront'))
    missing = sorted(needed(recipe) - set(items))
    if missing:
        return {'img': None, 'kit': None, 'pieces': [], 'door': None, 'masses': [],
                'checks': [_r('A0', 'FAIL', False, f'부품이 없다: {", ".join(missing)}')]}

    plans = []
    for m in masses(recipe):
        roof_item = items[m['roof']]['item']
        if m['kind'] in RECEDING:
            rec, why = _receding_roof(m, items)
            if rec is None:
                checks.append(_r('A0', 'FAIL', False, why))
                return {'img': None, 'kit': None, 'pieces': [], 'door': None, 'masses': [], 'checks': checks}
            rl = rm = rr = None
        elif roof_item.get('spire'):
            rl = rm = rr = next((pc for pc in roof_item['pieces'] if pc.get('role') in ('m', 'x')), None)
        else:
            rl, rm, rr = (_role(roof_item, r) for r in ('l', 'm', 'r'))
        if m['kind'] == RIDGE_SIDE and not (rl and rm and rr):
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
        plan = {'m': m, 'kind': m['kind'], 'cols': m['cols'], 'x': m['x'], 'depth': m['depth'],
                'roof': m['roof'], 'roof_item': roof_item, 'roof_img': items[m['roof']]['img'],
                'end': int(roof_item.get('end', ROOF_END)),
                'walls': walls, 'band': m.get('band'), 'band_item': band_item,
                'band_h': (_role(band_item, 'l')['size'][1] if band_item else 0),
                'base': m.get('base'), 'base_item': base_item,
                'base_h': (_role(base_item, 'l')['size'][1] if base_item else 0),
                'extras': m.get('extras') or []}
        if m['kind'] in RECEDING:
            plan.update(rec)
            plan['lw'] = plan['rw'] = None
            plan['rh'] = rec['back_h'] + m['depth_rows'] * rec['body_h'] + rec['front_h']
            plan['roof_kind'] = m['kind']
        else:
            plan.update({'lw': rl['size'][0], 'rw': rr['size'][0], 'rh': rl['size'][1],
                         'roof_kind': roof_kind(roof_item)})
        plan['bands'] = max(0, len(walls) - 1) if band_item else 0
        plan['h'] = _mass_height(plan)
        plan['rise'] = max([0] + [-int(ex['at'][1]) for ex in plan['extras']])
        plan['idx'] = len(plans)
        plans.append(plan)

    width = max(p['x'] + p['cols'] for p in plans)
    height = max(p['h'] + p['rise'] for p in plans)
    cv = dot.Cv(width * dot.T, height * dot.T)
    owner = np.full((height * dot.T, width * dot.T), -1, int)
    owner_plan = np.full((height * dot.T, width * dot.T), -1, int)
    owner_kind = np.full((height * dot.T, width * dot.T), '', object)
    roof_px = {p['idx']: np.zeros((height * dot.T, width * dot.T), bool) for p in plans}
    wall_px = {p['idx']: np.zeros((height * dot.T, width * dot.T), bool) for p in plans}
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
        if h_ > 0 and w_ > 0 and y0 >= 0 and x0 >= 0:
            sel = op[:h_, :w_]
            owner[y0:y0 + h_, x0:x0 + w_][sel] = plan['depth']
            owner_plan[y0:y0 + h_, x0:x0 + w_][sel] = plan['idx']
            owner_kind[y0:y0 + h_, x0:x0 + w_][sel] = kind
            if kind in ROOF_KINDS:
                roof_px[plan['idx']][y0:y0 + h_, x0:x0 + w_] |= sel
            elif kind in ('wall', 'band', 'base'):
                wall_px[plan['idx']][y0:y0 + h_, x0:x0 + w_] |= sel
        rec = {'item': item_id, 'piece': pc['id'], 'role': pc.get('role'), 'kind': kind,
               'at': [cx, cy], 'size': pc['size'], 'crop': crop, 'inset': int(pc.get('inset') or 0),
               'mass': plan['m']['id'], 'depth': plan['depth']}
        placed.append(rec)
        return rec

    def rest(plan, y, top):
        """지붕 아래 층 벽·층 띠·기단과 extras — 지붕 종류와 상관없이 같다."""
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
                r = put(plan, ex['part'], items[ex['part']]['img'], pc,
                        plan['x'] + ax + pc['at'][0], top + ay + pc['at'][1], 'extra')
                r['on'] = ex.get('on')
                plan.setdefault('extra_recs', []).append(r)
        plan['top'] = top

    for plan in sorted(plans, key=lambda p: -p['depth']):
        y = height - plan['h']
        top = y
        if plan['kind'] in RECEDING:
            m = plan['m']
            plan['roof_recs'] = []
            plan['stack'] = []
            back = put(plan, m['back'], items[m['back']]['img'], plan['back_pc'], plan['x'], y, 'roof')
            back['part'] = 'back'
            plan['roof_recs'].append(back)
            plan['stack'].append(('back', y, plan['back_h']))
            y += plan['back_h']
            for row in range(m['depth_rows']):
                cx = plan['x']
                for pc in plan['body']:
                    r = put(plan, m['roof'], plan['roof_img'], pc, cx, y, 'roof')
                    r['part'] = 'body'
                    plan['roof_recs'].append(r)
                    cx += pc['size'][0]
                plan['stack'].append(('body', y, plan['body_h']))
                y += plan['body_h']
            front = put(plan, m['gable'], items[m['gable']]['img'], plan['front_pc'], plan['x'], y, 'roof')
            front['part'] = 'front'
            plan['roof_recs'].append(front)
            plan['stack'].append(('front', y, plan['front_h']))
            plan['roof_at'] = (plan['x'], top)
            y += plan['front_h']
            rest(plan, y, top)
            continue
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
        rest(plan, y, top)

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
        x0, x1 = plan['x'] * dot.T, (plan['x'] + plan['cols']) * dot.T
        for (part, sy, sh) in (plan.get('stack') or [])[1:]:
            yb = sy * dot.T
            for yy, side in ((yb - 1, '위'), (yb, '아래')):
                row = op[yy, x0:x1]
                if not row.all():
                    gaps.append(f'{plan["m"]["id"]} 지붕 {part} 이음 {side} 행 {int((~row).sum())}px')
    checks.append(_r('A2', 'FAIL', not gaps,
                     '지붕·층 사이 틈 없음' if not gaps else f'지붕/벽·층 사이 틈 {gaps[:6]}'))

    bad3 = []
    bad3 += bad3_pre
    if int(recipe.get('overhang', 0)) != 0:
        bad3.append(f'overhang {recipe.get("overhang")} — 처마는 지붕 l·r 조각 안쪽 2~3px 에 그린다')
    for plan in plans:
        tag = plan['m']['id']
        if plan['kind'] in RECEDING:
            bad3 += _a3_receding(plan)
            continue
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
        kind = plan['roof_kind']
        if kind in RECEDING:
            ok = RECEDING_MIN <= ratio <= RECEDING_MAX
            span = (f'{RECEDING_MIN:.2f}~{RECEDING_MAX:.2f} ({kind} — 물러나는 지붕이 실루엣의 대부분, '
                    '벽은 아래 띠)')
        elif kind == 'spire':
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
        if plan['roof_kind'] != 'pitched':
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

    gf = [p for p in plans if p['kind'] == GABLE_FRONT]
    if gf:
        checks.append(_a12(gf))
    if any(p['kind'] in RECEDING for p in plans):
        checks.append(_a13(plans, op, owner_plan, owner_kind))
    if any(r.get('on') == 'roof' for p in plans for r in p.get('extra_recs') or []):
        checks.append(_a14(plans, roof_px, wall_px))
    if require_gable_front:
        checks.append(_r('A15', 'FAIL', bool(gf),
                         f'박공 정면 질량 {len(gf)}개' if gf else
                         '이 판은 requireGableFront — 모든 질량이 용마루가 정면과 나란한 지붕(평평한 정면 입면)이다. '
                         'gable_front 질량이 하나 이상 있어야 한다'))

    door_at = [d['at'] for d in doors]
    kit = _kit(recipe, plans, placed, width, height, doors)
    return {'img': cv, 'kit': kit, 'checks': checks, 'pieces': placed,
            'door': door_at[0] if door_at else None, 'height': height, 'width': width,
            'masses': [{'id': p['m']['id'], 'kind': p['kind'], 'x': p['x'], 'depth': p['depth'], 'cols': p['cols'],
                        'rows': p['h'], 'top': p['top'], 'roof': p['roof'],
                        'walls': [w['item'] for w in p['walls']]} for p in plans]}

def _piece_of(item, role):
    return next((pc for pc in item.get('pieces', []) if pc.get('role') == role), None)

def roof_rows(m, items):
    """질량 하나의 지붕 행 수(계약만으로). 물러나는 질량은 뒤 끝 + 사면 띠 × depth_rows + 앞 조각."""
    kind = m.get('kind') or RIDGE_SIDE
    if kind in RECEDING:
        mm = dict(m, kind=kind, back_end=m.get('back_end') or 'gable')
        if kind == LEAN_TO:
            mm['gable'] = mm['back'] = m['roof']
        else:
            mm['back'] = m.get('back') or m.get('gable')
        back_role, front_role = end_roles(mm)
        back = _piece_of(items[mm['back']], back_role)
        front = _piece_of(items[mm['gable']], front_role)
        body = _piece_of(items[m['roof']], body_roles(mm)[0])
        if not (back and front and body):
            raise KeyError(f'{m.get("id")}: {back_role}/{front_role}/{body_roles(mm)[0]} 조각이 없다')
        return back['size'][1] + int(m.get('depth_rows') or 0) * body['size'][1] + front['size'][1]
    return items[m['roof']]['pieces'][0]['size'][1]

def mass_rows(m, items):
    """레시피 질량 하나의 세로 칸 수(지붕 + 층 벽 + 층 띠 + 기단). 부품 그림 없이 계약만으로 센다."""
    roof = roof_rows(m, items)
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

FORM_KIND = {'gf_slope': 'slope', 'gf_back': 'roofend', 'gable_front': 'gable', 'lean_to': None}


def form_problems(item):
    """물러나는 지붕 부품(form) 세트 계약. 폭 변형 조각은 role 끝 숫자 = 폭 칸 수."""
    form = item.get('form')
    pcs = item.get('pieces', [])
    roles = {pc.get('role'): pc for pc in pcs}
    bad = []

    def width_variants(prefixes, kind):
        out = []
        for role, pc in roles.items():
            pre = next((p for p in prefixes if role and role.startswith(p) and role[len(p):].isdigit()), None)
            if pre is None:
                continue
            c = int(role[len(pre):])
            out.append(role)
            if pc['size'][0] != c:
                bad.append(f'{role} 폭 {pc["size"][0]}칸 — 이름대로 {c}칸')
            if kind and pc.get('kind') != kind:
                bad.append(f'{role} kind {pc.get("kind")} — {kind}')
        return out

    if form == 'gf_slope':
        for r in ('l', 'k', 'r'):
            if r not in roles:
                bad.append(f'사면 띠에 {r} 조각이 없다(l 왼 사면 끝 · k 용마루 · r 오른 사면 끝)')
        for r, pc in roles.items():
            want = 2 if r == 'k2' else 1
            if r not in ('l', 'ml', 'k', 'k2', 'mr', 'r'):
                bad.append(f'모르는 role {r}')
                continue
            if pc['size'][0] != want:
                bad.append(f'{r} 폭 {pc["size"][0]}칸 — {want}칸')
            if pc.get('kind') != 'slope':
                bad.append(f'{r} kind {pc.get("kind")} — slope(반복 사면 띠)')
        if len({pc['size'][1] for pc in pcs}) > 1:
            bad.append('사면 띠 조각 높이가 다르다')
    elif form == 'gf_back':
        if not width_variants(('b', 'v'), 'roofend'):
            bad.append('뒤 끝 조각(b<폭> 또는 골 v<폭>)이 없다')
    elif form == 'gable_front':
        if not width_variants(('g',), 'gable'):
            bad.append('앞 박공 조각(g<폭>)이 없다')
        width_variants(('b', 'v'), 'roofend')
    elif form == 'lean_to':
        if item.get('low') not in ('left', 'right'):
            bad.append(f'low {item.get("low")!r} — left|right(낮은 처마 쪽)')
        for r in ('hi', 'm', 'lo'):
            pc = roles.get(r)
            if pc is None:
                bad.append(f'외쪽 사면 띠에 {r} 조각이 없다')
            elif pc['size'][0] != 1 or pc.get('kind') != 'slope':
                bad.append(f'{r} 는 1칸 slope 조각')
        if not width_variants(('lb',), 'roofend'):
            bad.append('외쪽 뒤 끝 lb<폭> 조각이 없다')
        if not width_variants(('lf',), 'gable'):
            bad.append('외쪽 앞 조각 lf<폭> 이 없다')
    else:
        bad.append(f'모르는 form {form!r}')
    return bad


def roof_problems(item):
    if item.get('form'):
        return form_problems(item)
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


def _a3_receding(plan):
    m = plan['m']
    tag = m['id']
    bad = []
    lo, hi = GF_COLS if plan['kind'] == GABLE_FRONT else LEAN_COLS
    if not lo <= plan['cols'] <= hi:
        bad.append(f'{tag} {plan["kind"]} 폭 {plan["cols"]}칸 — {lo}~{hi}칸')
    if not DEPTH_ROWS[0] <= m['depth_rows'] <= DEPTH_ROWS[1]:
        bad.append(f'{tag} depth_rows {m["depth_rows"]} — {DEPTH_ROWS[0]}~{DEPTH_ROWS[1]}행(지붕이 물러나는 길이)')
    if plan['back_pc']['size'][0] != plan['cols'] or plan['front_pc']['size'][0] != plan['cols']:
        bad.append(f'{tag} 뒤 끝 {plan["back_pc"]["size"][0]}칸·앞 조각 {plan["front_pc"]["size"][0]}칸 ≠ 몸통 {plan["cols"]}칸')
    body_w = sum(pc['size'][0] for pc in plan['body'])
    if body_w != plan['cols']:
        bad.append(f'{tag} 사면 띠 폭 {body_w}칸 ≠ 몸통 {plan["cols"]}칸')
    if len(plan['body_hs']) != 1:
        bad.append(f'{tag} 사면 띠 조각 높이가 다르다 {sorted(plan["body_hs"])}')
    if plan['kind'] == GABLE_FRONT and plan['back_h'] != plan['front_h']:
        bad.append(f'{tag} 뒤 끝 {plan["back_h"]}행 ≠ 앞 박공 {plan["front_h"]}행 — 같은 지붕 물매(높이)다')
    if plan['kind'] == LEAN_TO:
        want = plan['roof_item'].get('low')
        if m.get('low') not in ('left', 'right'):
            bad.append(f'{tag} lean_to low {m.get("low")!r} — left|right')
        elif want and want != m.get('low'):
            bad.append(f'{tag} lean_to low {m.get("low")} ≠ 지붕 세트 {plan["roof"]} 의 low {want}(빛 방향이 뒤집힌다)')
    if int(m.get('overhang', 0) or 0):
        bad.append(f'{tag} overhang — 처마는 조각 안쪽에 그린다')
    return bad


def _roof_local(plan):
    """질량 자기 지붕 조각만 모은 RGBA(다른 질량에 가려도 자기 화소로 잔다)."""
    x0, y0 = plan['roof_at']
    out = np.zeros((plan['rh'] * dot.T, plan['cols'] * dot.T, 4), np.uint8)
    for r in plan.get('roof_recs') or []:
        a = np.array(r['crop'].convert('RGBA'))
        ox, oy = (r['at'][0] - x0) * dot.T, (r['at'][1] - y0) * dot.T
        h, w = min(a.shape[0], out.shape[0] - oy), min(a.shape[1], out.shape[1] - ox)
        sel = a[:h, :w, 3] > 0
        out[oy:oy + h, ox:ox + w][sel] = a[:h, :w][sel]
    return out


def ridge_report(plan):
    """박공 정면 질량의 용마루·사면 빛 실측(A12). 용마루 띠 = 가운데 2px(열 c-1, c)."""
    a = _roof_local(plan)
    op = a[:, :, 3] == 255
    L = G.lum(a)
    c = plan['cols'] * dot.T // 2
    y_body = plan['back_h'] * dot.T
    y_front = (plan['back_h'] + plan['m']['depth_rows'] * plan['body_h']) * dot.T
    band_any = op[:, c - 1:c + 1].any(axis=1)
    rows = np.nonzero(band_any)[0]
    tops = np.nonzero(op.any(axis=1))[0]
    first = int(rows.min()) if len(rows) else None
    top = int(tops.min()) if len(tops) else None
    gaps = [y for y in range(first if first is not None else 0, min(y_front, op.shape[0] - 1) + 1) if not band_any[y]]
    flat = []
    for y in range(y_body, y_front):
        if not op[y, c - 1:c + 1].all():
            flat.append(y)
            continue
        hit = False
        for x in (c - 1, c):
            dl = (not op[y, c - 3]) or abs(L[y, x] - L[y, c - 3]) >= RIDGE_STEP
            dr = (not op[y, c + 2]) or abs(L[y, x] - L[y, c + 2]) >= RIDGE_STEP
            hit = hit or (dl and dr)
        if not hit:
            flat.append(y)
    X = np.arange(op.shape[1])[None, :]
    body = np.zeros_like(op)
    body[y_body:y_front] = True
    left, right = op & body & (X < c - 2), op & body & (X >= c + 2)
    lm = float(L[left].mean()) if left.any() else 0.0
    rm = float(L[right].mean()) if right.any() else 0.0
    return {'first': first, 'top': top, 'gaps': gaps, 'flat': flat, 'left': lm, 'right': rm,
            'y_front': y_front, 'y_body': y_body, 'c': c}


def _a12(gf_plans):
    bad, ok_msgs = [], []
    for plan in gf_plans:
        tag = plan['m']['id']
        r = ridge_report(plan)
        if r['first'] is None:
            bad.append(f'{tag} 용마루 띠(가운데 2px)가 비었다')
            continue
        if r['first'] != r['top']:
            bad.append(f'{tag} 뒤 끝 꼭대기가 용마루에 있지 않다(지붕 맨 윗행 {r["top"]}, 용마루 시작 {r["first"]})')
        if r['gaps']:
            bad.append(f'{tag} 용마루가 끊긴다(투명 행 {r["gaps"][:4]}… 총 {len(r["gaps"])}행)')
        if r['flat']:
            bad.append(f'{tag} 용마루가 사면과 구분되지 않는 행 {len(r["flat"])}개(예 {r["flat"][:4]}) — '
                       f'가운데 2px 에 양옆 사면과 밝기 {RIDGE_STEP:.0f} 이상 다른 용마루 선')
        if r['left'] - r['right'] < SLOPE_STEP:
            bad.append(f'{tag} 왼쪽 사면 {r["left"]:.0f} vs 오른쪽 {r["right"]:.0f} — 빛은 왼쪽 위, '
                       f'왼쪽이 {SLOPE_STEP:.0f} 이상 밝아야 한다')
        ok_msgs.append(f'{tag} 용마루 {r["y_front"] - r["first"]}px 연속, 사면 {r["left"]:.0f}/{r["right"]:.0f}')
    return _r('A12', 'FAIL', not bad, '; '.join(ok_msgs) if not bad else '; '.join(bad))


def _a13(plans, op, owner_plan, owner_kind):
    bad, msgs = [], []
    for plan in plans:
        if plan['kind'] not in RECEDING:
            continue
        tag = plan['m']['id']
        a = np.array(plan['roof_recs'][0]['crop'].convert('RGBA'))
        bop = a[:, :, 3] == 255
        gx0 = plan['x'] * dot.T
        gy0 = plan['roof_at'][1] * dot.T
        deeper, sky, mine = 0, [], []
        for x in range(bop.shape[1]):
            ys = np.nonzero(bop[:, x])[0]
            if not len(ys):
                sky.append(x)
                continue
            gy, gx = gy0 + int(ys.min()), gx0 + x
            above = gy - 1
            k = owner_plan[above, gx] if above >= 0 else -1
            if above >= 0 and op[above, gx] and owner_kind[above, gx] == 'roof' and k >= 0 \
                    and plans[k]['depth'] > plan['depth']:
                deeper += 1
            else:
                sky.append(x)
            if owner_plan[gy, gx] != plan['idx']:
                mine.append(x)
        n = bop.shape[1]
        valley = plan['kind'] == GABLE_FRONT and plan['m'].get('back_end') == 'valley'
        if valley:
            if sky:
                bad.append(f'{tag} 골(valley) 윗변 {len(sky)}/{n}열 위가 더 뒤 질량의 지붕이 아니다 — '
                           '골은 뒤 지붕 면 위에서 끝난다(날개 꼭대기를 뒤 지붕 안으로)')
            if mine:
                bad.append(f'{tag} 골 화소 {len(mine)}열이 앞 날개 것이 아니다')
            msgs.append(f'{tag} 골 {n}열 전부 뒤 지붕에 맞닿음')
        elif deeper:
            bad.append(f'{tag} 뒤 끝 윗변 {deeper}/{n}열 바로 위가 더 뒤 질량의 지붕이다 — 지붕 속에 박힌 끝. '
                       'back_end "valley" 와 골 조각(v<폭>)을 쓴다')
        else:
            msgs.append(f'{tag} 뒤 끝 자유(하늘·벽 앞)')
    return _r('A13', 'FAIL', not bad, '; '.join(msgs) if not bad else '; '.join(bad))


def _a14(plans, roof_px, wall_px):
    bad, n = [], 0
    for plan in plans:
        for r in plan.get('extra_recs') or []:
            if r.get('on') != 'roof':
                continue
            n += 1
            a = np.array(r['crop'].convert('RGBA'))
            eop = a[:, :, 3] == 255
            gx0, gy0 = r['at'][0] * dot.T, r['at'][1] * dot.T
            rp, wp = roof_px[plan['idx']], wall_px[plan['idx']]
            off, on_wall = 0, 0
            ys = np.nonzero(eop.any(axis=1))[0]
            base = int(ys.max()) if len(ys) else None
            for x in (np.nonzero(eop[base])[0] if base is not None else []):
                gy, gx = gy0 + base, gx0 + int(x)
                if not (0 <= gy < rp.shape[0] and 0 <= gx < rp.shape[1]) or not rp[gy, gx]:
                    off += 1
            for y, x in zip(*np.nonzero(eop)):
                gy, gx = gy0 + int(y), gx0 + int(x)
                if 0 <= gy < wp.shape[0] and 0 <= gx < wp.shape[1] and wp[gy, gx]:
                    on_wall += 1
            if off:
                bad.append(f'{plan["m"]["id"]} {r["item"]} 밑동(맨 아래 행) {off}px 이 그 질량 지붕 면 위가 아니다(떠 있다)')
            if on_wall:
                bad.append(f'{plan["m"]["id"]} {r["item"]} 화소 {on_wall}개가 벽에 걸친다')
    return _r('A14', 'FAIL', not bad, f'지붕 위 부속 {n}개가 지붕 면에 얹힌다' if not bad else '; '.join(bad))


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
            a_im, b_im = p['crop'], q['crop']
            if p.get('part') or q.get('part'):
                # 박공 정면·외쪽 쌓기 조각은 폭이 서로 달라(뒤 끝 4칸 위에 사면 띠 1~2칸) 실제로 맞닿는 열끼리만 견준다.
                ox0, ox1 = max(x0, qx), min(x1, qx + q['size'][0])
                a_im = a_im.crop(((ox0 - x0) * dot.T, 0, (ox1 - x0) * dot.T, a_im.height))
                b_im = b_im.crop(((ox0 - qx) * dot.T, 0, (ox1 - qx) * dot.T, b_im.height))
            ok, s, lim = G.check_join(a_im, b_im, 'y')
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
