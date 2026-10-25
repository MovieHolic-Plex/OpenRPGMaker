"""building-kit 시험용 고정 후보 — 행 문자열 손 도트(시트에 나오지 않는다).

문법(2026-10-22 개정): 지붕 세트는 끝 조각 2칸(l 2 + m 1 + r 2 = 5칸), 기단 행은 선택(기본 없음 — 벽 맨 아래 2행이
자기 재질의 기초), 층마다 다른 벽 재질. 행은 좌표를 고른 규칙으로 찍는다(난수·도형 마스크 없음):
  지붕 — 용마루(위 3행, 짧고 밝음) → 기와 사면(중간·어두운 단) → 처마 띠(어두운 단) → 맨 아래 2행은 벽 상단 들보와
         같은 나무 단(조립 이음 A5). 끝 조각 안에서 처마 모서리→용마루 끝 모임 사선을 가장 어두운 단으로 긋는다.
  벽   — 맨 위 2행 나무 들보, 맨 아래 2행 자기 재질 기초(기단 행 없이 땅에 닿는다), 가운데는 기둥·줄눈 박자.
색은 테마 팔레트의 (램프, 단) 글자만 쓴다.
"""

LEGEND = {
    'A': {
        'a': ('roof', 0), 'b': ('roof', 1), 'c': ('roof', 2), 'd': ('roof', 3), 'e': ('roof', 4),
        'p': ('plaster', 3), 'r': ('plaster', 2), 'q': ('plaster', 1),
        't': ('timber', 3), 'u': ('timber', 1), 'v': ('timber', 2), 's': ('timber', 4), 'o': ('timber', 0),
        'g': ('iron', 0), 'l': ('iron', 2),
        'k': ('stone', 1), 'j': ('stone', 2), 'i': ('stone', 3), 'm': ('stone', 4), 'n': ('stone', 5),
    },
    'B': {
        'a': ('slate', 0), 'b': ('slate', 0), 'c': ('slate', 1), 'd': ('slate', 2), 'e': ('slate', 3),
        'x': ('ashlar', 1), 'y': ('ashlar', 3), 'z': ('ashlar', 4), 'w': ('ashlar', 2), 'v': ('ashlar', 0),
        'p': ('plaster', 3), 'r': ('plaster', 2), 'q': ('plaster', 1),
        't': ('timber', 3), 'u': ('timber', 1), 's': ('timber', 4), 'o': ('timber', 0),
        'g': ('iron', 0), 'l': ('iron', 3),
        'k': ('stone', 1), 'j': ('stone', 2), 'i': ('stone', 3), 'm': ('stone', 4), 'n': ('stone', 5),
    },
    'C': {
        'a': ('shingle', 0), 'b': ('shingle', 1), 'c': ('shingle', 2), 'd': ('shingle', 3), 'e': ('shingle', 4),
        'w': ('wood', 5), 'x': ('wood', 6), 'v': ('wood', 4), 'u': ('wood', 3), 's': ('wood', 2), 't': ('wood', 1),
        'p': ('plaster', 3), 'r': ('plaster', 2), 'q': ('plaster', 1),
        'o': ('wood', 0),
        'g': ('iron', 0), 'l': ('iron', 2),
        'k': ('stone', 1), 'j': ('stone', 2), 'i': ('stone', 3), 'm': ('stone', 4), 'n': ('stone', 5),
    },
}

ROOF_RAMP = {'A': 'roof', 'B': 'slate', 'C': 'shingle'}
TILE_PERIOD = {'A': 4, 'B': 3, 'C': 5}
RIDGE_HALF = {'A': 10, 'B': 9, 'C': 11}
MATERIAL = {'timber': ('plaster', 3), 'stone': ('stone', 4)}
LINE_BODY = {'A': ('plaster', 3), 'B': ('ashlar', 4), 'C': ('wood', 4)}
LINE_STONE = {'A': ('stone', 4), 'B': ('ashlar', 3), 'C': ('stone', 3)}
BEAM_RAMP = {'A': 'timber', 'B': 'timber', 'C': 'wood'}
POSTS = {'A': (4, 12), 'B': (2, 13), 'C': (4, 11)}

def _let(line, ramp, tone):
    cands = {k: v for k, v in LEGEND[line].items() if v[0] == ramp}
    if not cands:
        raise KeyError(f'{line}: 램프 {ramp} 글자가 범례에 없다')
    return min(cands, key=lambda k: abs(cands[k][1] - tone))

def _beam(line, i):
    return _let(line, BEAM_RAMP[line], 2 if i % 2 == 0 else 1)

def _roof_rows(line, cells=3, end=2):
    ramp, period, ridge_half = ROOF_RAMP[line], TILE_PERIOD[line], RIDGE_HALF[line]
    w, h = (2 * end + 1) * 16, cells * 16
    r = [_let(line, ramp, t) for t in range(5)]
    rows = []
    for y in range(h):
        e = round(ridge_half * (1 - y / (h - 1)))
        out = []
        for gx in range(w):
            cx, local = divmod(gx, 16)
            back = w - 1 - gx
            if y >= h - 2:
                out.append(_beam(line, y))
            elif cx < end and gx < e:
                out.append(r[0] if gx == e - 1 else r[1])
            elif cx >= cells - end and back < e:
                out.append(r[0] if back == e - 1 else r[1])
            elif y <= 2:
                out.append(r[4] if (local % 16 == 5 and y == 1) else r[3])
            elif y >= h - 16:
                out.append(r[0] if y % 4 == 0 else r[1])
            elif y % period == 0:
                out.append(r[1])
            else:
                out.append(r[3] if (local % 16 == 7 and y % 8 == 4) else r[2])
        rows.append(''.join(out))
    return rows

def _wall_rows(line, mat, role):
    ramp, tone = LINE_BODY[line] if mat == 'timber' else LINE_STONE[line]
    body, speck = _let(line, ramp, tone), _let(line, ramp, tone - 1)
    frame = _let(line, ramp, max(0, tone - 2))
    sill = _let(line, ramp, max(0, tone - 3))
    glass, iron = _let(line, 'iron', 0), _let(line, 'iron', 2)
    door_a, door_b = _let(line, BEAM_RAMP[line], 4), _beam(line, 0)
    posts = POSTS[line]
    rows = []
    for y in range(32):
        out = []
        for x in range(16):
            if y < 2:
                out.append(_beam(line, x + y))
            elif y >= 30:
                out.append(frame if (x + y) % 2 == 0 else sill)
            elif role == 'd' and 6 <= y and 2 <= x <= 13:
                out.append(door_a if (x in (2, 13) or y % 9 == 6) else door_b)
            elif role == 'w' and 6 <= y <= 17 and 4 <= x <= 11:
                out.append(iron if (x in (4, 11) or y in (6, 17)) else glass)
            elif role == 'w' and y == 18 and 4 <= x <= 11:
                out.append(frame)
            elif x in posts:
                out.append(frame)
            else:
                out.append(speck if (x * 5 + y) % 7 == 0 else body)
        rows.append(''.join(out))
    return rows

def _band_row(line):
    lit = _let(line, BEAM_RAMP[line], 3)
    top = {'A': 2, 'B': 1, 'C': 3}[line]
    pattern = {'A': 'x', 'B': 'xy', 'C': 'xxy'}[line]
    rows = []
    for y in range(16):
        out = []
        for x in range(16):
            if y < top:
                out.append(lit)
            elif pattern[x % len(pattern)] == 'y':
                out.append(_let(line, BEAM_RAMP[line], 0))
            else:
                out.append(_beam(line, y))
        rows.append(''.join(out))
    return rows

def _base_rows(line):
    stone_a, stone_b = _let(line, 'stone', 4), _let(line, 'stone', 2)
    top = _let(line, 'stone', 5)
    rows = []
    for y in range(16):
        out = []
        for x in range(16):
            if y < 2:
                out.append(_beam(line, x + y))
            elif y < 4:
                out.append(top if (x + y) % 3 else stone_a)
            else:
                out.append(stone_a if (x + y) % 6 else stone_b)
        rows.append(''.join(out))
    return rows

ROOF_CELLS = {'roof.hip': 3, 'roof.hip.tall': 4, 'roof.flat': 3, 'roof.crenel': 3,
              'roof.steep': 3, 'roof.steep.tall': 4, 'roof.lean': 3,
              'roof.mansard': 3, 'roof.mansard.tall': 4, 'roof.cone': 3,
              'roof.hip.low': 2, 'roof.mansard.low': 2, 'roof.spire': 4}
ROOF_ENDS = {'roof.flat': 1, 'roof.crenel': 1, 'roof.lean': 1, 'roof.spire': 1}
WALL_MATS = {'wall.storey': 'timber', 'wall.timber': 'timber', 'wall.stone': 'stone',
             'wall.log': 'timber', 'wall.ivy': 'timber'}

def roof(line, item_id):
    cells = ROOF_CELLS[item_id]
    end = ROOF_ENDS.get(item_id, 2)
    if item_id == 'roof.spire':
        rows = _spire_rows(line, cells)
        return {'l': rows, 'm': rows, 'r': rows}
    rows = _roof_rows(line, cells, end)
    w = 16 * end
    out = {'l': [r[:w] for r in rows], 'r': [r[-w:] for r in rows]}
    out['m'] = [r[w:w + 16] for r in rows]
    return out

def _spire_rows(line, cells):
    ramp = ROOF_RAMP[line]
    r = [_let(line, ramp, t) for t in range(5)]
    h = cells * 16
    rows = []
    for y in range(h):
        half = 1 + (7 * y) // (h - 1)
        out = []
        for x in range(16):
            d = abs(x - 7.5)
            if d > half:
                out.append('.')
            elif d > half - 1.5:
                out.append(r[0])
            else:
                out.append(r[4] if x < 8 else r[2])
        rows.append(''.join(out))
    return rows


def wall(line, item_id, role):
    return _wall_rows(line, WALL_MATS.get(item_id, 'timber'), role)

def band(line):
    return _band_row(line)

def base(line):
    return _base_rows(line)

ROOFS = {line: _roof_rows(line) for line in 'ABC'}
ROOFS_TALL = {line: _roof_rows(line, 4) for line in 'ABC'}
ROOFS_LOW = {line: _roof_rows(line, 2) for line in 'ABC'}
SPIRES = {line: _spire_rows(line, 4) for line in 'ABC'}
WALLS = {line: {role: _wall_rows(line, 'timber', role) for role in 'lmwdr'} for line in 'ABC'}
WALLS_STONE = {line: {role: _wall_rows(line, 'stone', role) for role in 'lmwdr'} for line in 'ABC'}
BANDS = {line: _band_row(line) for line in 'ABC'}
BASES = {line: _base_rows(line) for line in 'ABC'}


# --- 박공 정면 투영(style-r5) 시험 부품 — 좌표 규칙으로만 찍는다 -----------------------------------
# 사면 띠: 왼쪽 사면 = 밝은 두 단(줄눈 4행마다), 오른쪽 사면 = 어두운 두 단, 가운데 2px 용마루 = 가장 밝은 단.
# 뒤 끝·앞 박공: 가운데 꼭대기에서 양 처마로 내려가는 ^ 빗선(d = 가운데에서의 거리 비율).

def _roof_tones(line):
    return [_let(line, ROOF_RAMP[line], t) for t in range(5)]

def _slope_px(line, side, y):
    r = _roof_tones(line)
    if side == 'L':
        return r[2] if y % 4 == 2 else r[3]
    return r[0] if y % 4 == 2 else r[1]

def _gf_row_px(line, gx, W, y):
    """박공 정면 사면 한 화소 — 전체 폭 W 안 gx. 가운데 2px(W/2-1, W/2) 는 용마루."""
    c = W // 2
    if gx in (c - 1, c):
        return _roof_tones(line)[4]
    return _slope_px(line, 'L' if gx < c else 'R', y)

def gf_slope(line):
    r = _roof_tones(line)
    out = {}
    for role, w in (('l', 16), ('ml', 16), ('k', 16), ('k2', 32), ('mr', 16), ('r', 16)):
        rows = []
        for y in range(16):
            row = []
            for x in range(w):
                if role in ('l', 'ml'):
                    ch = _slope_px(line, 'L', y)
                    if role == 'l' and x < 2:
                        ch = r[2]
                elif role in ('mr', 'r'):
                    ch = _slope_px(line, 'R', y)
                    if role == 'r' and x >= 14:
                        ch = r[0]
                else:
                    ch = _gf_row_px(line, x, w, y)
                row.append(ch)
            rows.append(''.join(row))
        out[role] = rows
    return out

def _edge(x, W, H, step=0):
    d = abs(x + 0.5 - W / 2) / (W / 2)
    e = int(round(d * (H - 1)))
    if step:
        e = (e // step) * step
    return e

def _back_rows(line, cells, rows_, step=0):
    W, H = cells * 16, rows_ * 16
    r = _roof_tones(line)
    out = []
    for y in range(H):
        row = []
        for x in range(W):
            e = _edge(x, W, H, step)
            if y < e:
                row.append('.')
            elif y == e:
                row.append(r[0])
            else:
                row.append(_gf_row_px(line, x, W, y))
        out.append(''.join(row))
    return out

def _gable_rows(line, cells, rows_, step=0):
    W, H = cells * 16, rows_ * 16
    ramp, tone = LINE_BODY[line]
    body, speck = _let(line, ramp, tone), _let(line, ramp, tone - 1)
    r = _roof_tones(line)
    out = []
    for y in range(H):
        row = []
        for x in range(W):
            e = _edge(x, W, H, step)
            if y >= H - 2:
                row.append(_beam(line, y))
            elif y < e:
                row.append(_slope_px(line, 'L' if x < W // 2 else 'R', y))
            elif y <= e + 1:
                row.append(r[0])
            else:
                row.append(speck if (x * 5 + y) % 7 == 0 else body)
        out.append(''.join(row))
    return out

def gable_set(line, item_id):
    if item_id == 'gable.step':
        return {'g5': _gable_rows(line, 5, 2, step=4), 'b5': _back_rows(line, 5, 2, step=4)}
    return {'g3': _gable_rows(line, 3, 1), 'g4': _gable_rows(line, 4, 2)}

def gf_back(line):
    return {'b4': _back_rows(line, 4, 2), 'v3': _back_rows(line, 3, 1)}

def gf_valley(line):
    """날개 골 v4·v5·v6(2행) — ^ 선 위는 투명(본채 지붕이 비친다), 선 아래는 사면 띠 위쪽 끝과 가운데 용마루."""
    return {f'v{c}': _back_rows(line, c, 2) for c in (4, 5, 6)}

def lean(line):
    """외쪽(오른쪽이 낮다) — 그늘 쪽이라 중간·어두운 단. 뒤·앞 끝 빗선은 왼쪽(높음)→오른쪽(낮음)."""
    r = _roof_tones(line)

    def body(x, y, role):
        if role == 'hi' and x < 2:
            return r[3]
        if role == 'lo' and x >= 14:
            return r[0]
        return r[1] if y % 4 == 2 else r[2]
    out = {role: [''.join(body(x, y, role) for x in range(16)) for y in range(16)] for role in ('hi', 'm', 'lo')}
    ramp, tone = LINE_BODY[line]
    wall_c = _let(line, ramp, tone)
    lb, lf = [], []
    for y in range(16):
        b, f = [], []
        for x in range(32):
            e = int(round(x / 31 * 15))
            b.append('.' if y < e else r[0] if y == e else body(x % 16, y, 'm'))
            if y >= 14:
                f.append(_beam(line, y))
            elif y < e:
                f.append(body(x % 16, y, 'm'))
            elif y <= e + 1:
                f.append(r[0])
            else:
                f.append(wall_c)
        lb.append(''.join(b))
        lf.append(''.join(f))
    out['lb2'], out['lf2'] = lb, lf
    return out

def chimney(line):
    stone, cap, dark = _let(line, 'stone', 3), _let(line, 'stone', 5), _let(line, 'stone', 1)
    rows = []
    for y in range(32):
        row = []
        for x in range(16):
            if y < 4:
                row.append(cap if 3 <= x <= 12 else '.')
            elif 4 <= x <= 11:
                row.append(dark if x == 11 or y % 6 == 0 else stone)
            else:
                row.append('.')
        rows.append(''.join(row))
    return {'c': rows}
