"""조선 실내: 평면 → 지도 유도 + 자동 점검.

평면 문자:
  '#'  막힘(천장·벽 덩어리·어둠). 방에 닿은 칸은 천장 띠(서까래 끝), 나머지는 어둠.
  o 온돌(장판)+회벽 · c 온돌+창호벽 · m 마루+회벽 · k 마루+창호벽 · M 마루+목재벽 · d 흙바닥+황토벽 · s 돌바닥+돌벽 · b 흙바닥+돌벽
  D  남쪽 벽 틈의 출입구 칸(걸어 나가는 칸, in_exit_mat). 그 한 칸 북쪽이 들어오는 칸.
규칙(스킬 interior-chipset-authoring 0절 · 메모리 map-structure-ceiling-wall-rooms):
  * 막힌 칸 바로 아래 두 줄은 벽면(못 걸음)이다 — 평면에서 유도하고 손으로 칠하지 않는다.
  * 벽면 밑 바닥 칸은 접지 그늘 변형, 서쪽 벽 덩어리 곁은 가장자리 그늘 변형을 쓴다.
  * 남북 통로(막힌 칸 사이 틈)는 벽면 두 줄 + 걷는 줄 1 = 3줄이어야 한다(아니면 막힌다) — lint 가 잡는다.
"""
import sys

CH = {'o': ('ondol', 'hoe'), 'c': ('ondol', 'changho'), 'm': ('maru', 'hoe'), 'k': ('maru', 'changho'), 'M': ('maru', 'mok'),
      'd': ('dirt', 'heuk'), 's': ('stone', 'dol'), 'b': ('dirt', 'dol'), 'D': ('dirt', 'heuk')}
FLOOR_CHARS = set(CH)


class Plan:
    def __init__(s, rows):
        s.rows = [r for r in rows]
        s.H = len(rows)
        s.W = max(len(r) for r in rows)
        s.rows = [r.ljust(s.W, '#') for r in s.rows]

    def ch(s, x, y):
        if 0 <= x < s.W and 0 <= y < s.H:
            return s.rows[y][x]
        return '#'

    def solid(s, x, y):
        return s.ch(x, y) == '#'

    def is_floor(s, x, y):
        return s.ch(x, y) in FLOOR_CHARS

    def face_u(s, x, y):
        return s.is_floor(x, y) and s.solid(x, y - 1) and s.ch(x, y) != 'D'

    def face_l(s, x, y):
        return s.is_floor(x, y) and s.face_u(x, y - 1) and s.ch(x, y) != 'D'

    def is_face(s, x, y):
        return s.face_u(x, y) or s.face_l(x, y)

    def walk_floor(s, x, y):
        """벽면이 아닌 걷는 바닥 칸."""
        return s.is_floor(x, y) and not s.is_face(x, y)

    def floor_kind(s, x, y):
        return CH[s.ch(x, y)][0]

    def wall_kind(s, x, y):
        return CH[s.ch(x, y)][1]

    def ceil_mask(s, x, y, bits):
        """(x,y) 천장 칸의 이웃 8방향 중 막힌 칸 비트(water_blob 비트 규칙)."""
        N, E, S, W, NE, SE, SW, NW = bits
        m = 0
        for b, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0)), (NE, (1, -1)), (SE, (1, 1)), (SW, (-1, 1)), (NW, (-1, -1))):
            if s.solid(x + dx, y + dy):
                m |= b
        return m

    def shade_mode(s, x, y):
        """걷는 바닥 칸의 그늘 변형: 위가 벽면 아랫줄이면 n, 서쪽이 막힌 칸이면 w, 둘 다면 nw, 없으면 ''."""
        if not s.walk_floor(x, y):
            return ''
        n = s.face_l(x, y - 1)
        w = s.solid(x - 1, y)
        return ('n' if n else '') + ('w' if w else '')


def faces(plan):
    """[(x, y, kind, ends)] 벽면 위 칸마다 한 줄. ends: m/l/r/lr(옆 칸이 같은 재질 벽면이 아니면 끝)."""
    out = []
    for y in range(plan.H):
        for x in range(plan.W):
            if plan.face_u(x, y):
                kind = plan.wall_kind(x, y)
                le = not (plan.face_u(x - 1, y) and plan.wall_kind(x - 1, y) == kind)
                re = not (plan.face_u(x + 1, y) and plan.wall_kind(x + 1, y) == kind)
                ends = ('l' if le else '') + ('r' if re else '') or 'm'
                out.append((x, y, kind, ends))
    return out


# ------------------------------------------------------------------------------------------------ 점검
def _walkable(plan, block):
    """걸을 수 있는 칸 집합 = 방 바닥(벽면 제외) − 가구가 막은 칸. block: 막힌 칸 집합."""
    return {(x, y) for y in range(plan.H) for x in range(plan.W) if (plan.walk_floor(x, y) or plan.ch(x, y) == 'D') and (x, y) not in block}


def bfs(plan, walk, start):
    seen = {start}
    q = [start]
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, y + dy)
            if c in walk and c not in seen:
                seen.add(c)
                q.append(c)
    return seen


def lint_structure(plan, label=''):
    """구조 규칙 위반 목록(0 이어야 한다): 천장 밑 벽면 2줄·남북 통로 3줄·방 모양."""
    bad = []
    for y in range(plan.H):
        for x in range(plan.W):
            ch = plan.ch(x, y)
            if ch == '#':
                continue
            if ch == 'D':
                if not plan.solid(x - 1, y) or not plan.solid(x + 1, y):
                    bad.append(f'구조: 출입구 D({x},{y}) 양옆이 막혀 있지 않다')
                if plan.solid(x, y - 1):
                    bad.append(f'구조: 출입구 D({x},{y}) 북쪽이 막혀 있다')
                continue
            # 천장 밑 벽면 2줄: 막힌 칸 아래에 바닥이 있으면 그 아래 한 칸도 바닥이어야 한다(세로 한 줄 방 금지)
            if plan.solid(x, y - 1) and not plan.is_floor(x, y + 1):
                bad.append(f'구조: ({x},{y}) 벽면 윗줄 밑에 벽면 아랫줄이 없다(천장 밑 벽면 2줄 규칙)')
            if plan.face_l(x, y) and not plan.is_floor(x, y + 1):
                bad.append(f'구조: ({x},{y}) 벽면 아랫줄 밑에 걷는 바닥이 없다(통로 3줄 규칙)')
    return bad


def lint_room(plan, door, blocked, start=None):
    """도달성: 문 앞에서 모든 걷는 바닥 칸에 닿는가(가구가 막은 칸 제외). 닿지 못하는 칸 목록."""
    walk = _walkable(plan, blocked)
    st = start or (door[0], door[1] - 1)
    seen = bfs(plan, walk, st)
    return sorted(walk - seen), seen, walk
