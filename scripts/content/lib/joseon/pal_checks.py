"""조선 궁 내부 방 자동 점검 — 후보 B 의 inb_checks.analyze(C1~C8)를 그대로 건 뒤 궁 전용 점검을 더한다.

  C1~C8   inb_checks.py 와 같다(구조 「구조:」 0 · 출입구에서 도달 · 문 앞 3×3 비움 · 사용 칸 · 같은 기물 일렬(접촉) · 벽걸이 · 맨바닥 판 10칸 미만 · 겹침 0).
          궁 건축 조각(pal_wall_·pal_door_gung·pal_beam_·pal_pillar_·pal_dais_·pal_nangan_)은 가구가 아니므로 C4·C5·C8 에서 뺀다.
          깔개·카펫(pal_mat_)은 C5·C4·C8 에서 뺀다(inb 의 in_b_mat_ 와 같은 취급, 걸을 수 있고 바닥에 붙은 조각).
  P1      문 앞 칸·협문 앞 칸(extra.json doors)이 걸을 수 있고 출입구에서 닿는다
  P2      어좌 방: 출입구 앞 칸에서 어도(카펫·계단 칸)만 밟아 어좌 앞 칸까지 걸어간다 + 어도 칸 어디도 가구가 막지 않는다
  P3      같은 기물 셋 이상이 줄 간격이 있어도 한 줄(같은 x 또는 같은 y)에 늘어서면 안 된다(건축·깔개 제외)
  P4      좌우 복제 금지: 가구의 절반 넘게가 거울 위치에 같은 이름으로 놓이면 안 된다(건축은 대칭이어도 된다)
  P5      가구 발자국(맨 아랫줄)이 천장·어둠 칸에 걸치지 않는다
  P6      바닥 줄에 누운 보(pal_beam_)를 깔지 않는다 — 기둥 머리 두공이 보 노릇을 하고, 진짜 위층 보는 아직 없다(2026-10 검수에서 바닥 띠로 읽혔다)
"""
import inb_checks as CK
import inb_room as RM

ARCH = ('pal_wall_', 'pal_door_gung', 'pal_beam_', 'pal_pillar_', 'pal_dais_', 'pal_nangan_')
CK.WALLP = tuple(CK.WALLP) + ARCH + ('pal_hang_',)
CK.MATS = tuple(CK.MATS) + ('pal_mat_',)
CK.HANG = tuple(CK.HANG) + ('pal_hang_',)
FLAT = CK.FLATDECOR + ('pal_mat_',)
NOT_FURN = ARCH + FLAT + ('pal_hang_', 'in_b_hang_', 'in_b_jokja_', 'in_b_win_', 'in_b_wall_')


def furniture(room):
    return [(n, x, y, w, h) for (n, x, y, w, h) in room.placed if not n.startswith(NOT_FURN)]


def analyze(room, sheet, spec=None):
    rep = CK.analyze(room, sheet)
    walkable, seen, cv = rep['walkable'], rep['reach'], rep['cover']
    p = room.plan
    fn = furniture(room)
    # P1 문 앞 칸
    for d in getattr(room, 'doors_extra', []):
        c = (d['x'], d['y'])
        if c not in walkable:
            rep['fails'].append(f"P1 문 앞 칸 {c} 이 걸을 수 없는 칸이다(문 {d.get('piece')})")
        elif c not in seen:
            rep['fails'].append(f"P1 문 앞 칸 {c} 에 출입구에서 닿지 못한다")
    # P2 어도
    aisle = (spec or {}).get('aisle')
    if aisle:
        cells = set(map(tuple, aisle['cells']))
        th = [t for t in room.placed if t[0] == aisle['throne']]
        if not th:
            rep['fails'].append('P2 어좌 조각이 놓이지 않았다')
        else:
            _, tx, ty, tw, tch = th[0]
            front = {(tx + i, ty + tch) for i in range(tw)}
            blocked = sorted(c for c in cells if c not in walkable)
            if blocked:
                rep['fails'].append(f'P2 어도 칸이 막혔다 {len(blocked)}: {blocked[:10]}')
            dx, dy = room.door
            allowed = (cells | front) & walkable
            start = (dx, dy - 1)
            got = RM.bfs(p, allowed, start) if start in allowed else set()
            if not (got & front):
                rep['fails'].append('P2 출입구 앞 칸에서 어도만 밟아 어좌 앞 칸에 닿지 못한다')
            else:
                rep['info']['aisleToThrone'] = len(got)
            # 어도 폭: 같은 y 에서 연속 3칸 이상 걸어갈 수 있어야 한다(어도 위에 가구가 얹히면 안 됨)
    # P3 같은 기물 한 줄(간격 허용)
    by = {}
    for (n, x, y, w, h) in fn:
        by.setdefault(n, []).append((x, y, w, h))
    for n, lst in by.items():
        for axis in (0, 1):
            groups = {}
            for t in lst:
                groups.setdefault(t[axis], []).append(t)
            for k, g in groups.items():
                if len(g) >= 3:
                    rep['fails'].append(f"P3 같은 기물 {n} 이 {'x' if axis == 0 else 'y'}={k} 한 줄에 {len(g)}개")
    # P4 좌우 복제
    W_ = room.W
    names = {(n, x, y, w) for (n, x, y, w, h) in fn}
    if len(fn) >= 6:
        mirrored = sum(1 for (n, x, y, w, h) in fn if (n, W_ - 1 - (x + w - 1), y, w) in names and (W_ - 1 - (x + w - 1)) != x)
        ratio = mirrored / len(fn)
        rep['info']['mirrorRatio'] = round(ratio, 2)
        if ratio > 0.5:
            rep['fails'].append(f'P4 가구 {mirrored}/{len(fn)} 이 거울 위치에 같은 이름으로 놓였다(좌우 복제)')
    # P6 바닥에 누운 보 금지
    for (n, x, y, w, h) in room.placed:
        if n.startswith('pal_beam_'):
            rep['fails'].append(f'P6 {n}({x},{y}) 보가 바닥 줄에 놓였다(위층 보 층이 없으므로 쓰지 않는다)')
    # P5 발자국이 천장에 걸치는가
    for (n, x, y, w, h) in fn:
        for i in range(w):
            if p.solid(x + i, y + h - 1):
                rep['fails'].append(f'P5 {n}({x},{y}) 의 발자국이 천장·어둠 칸 ({x + i},{y + h - 1}) 에 걸친다')
                break
    return rep
