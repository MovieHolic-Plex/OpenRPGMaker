#!/usr/bin/env python3
"""modern_campus 실내 평면 5장(학교 3 + 기숙사 2층) — 도구 인자(`build_hand_interior_room`) 모양의 JSON + 좌표 검증 + 합성 그림.

  python3 scripts/content/modern-campus/interior/campus_plans.py            # 평면 JSON 쓰기 + 검증(정상 0 오류) + 변조 6종이 코드대로 잡히는지
  python3 scripts/content/modern-campus/interior/campus_plans.py --render   # 합성 그림(public/assets/modern-campus-references/*.png)

검증기는 `src/editor/handInterior/builder.ts` 의 규칙(analyseHandInteriorPlan·발밑 바닥·겹침·벽 가구 북쪽 벽면·걸이 벽면 윗줄·문 틈·출입 BFS)을 **그대로 옮긴 것**이다.
엔진(TS 조립기·passabilityOf)을 돌린 것이 아니다 — modern_campus 사양(칸 번호)이 아직 구워지지 않았다. 확인 범위: 구조·좌표·도달(4방 BFS, 가구 발자국은 막힘).
이벤트 실행·미감·«학교처럼 보이는가»는 보지 않는다.
"""
import json, os, sys, copy, collections
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
PLANS = os.path.join(ROOT, 'tiledata', 'modern-campus', 'interior', 'plans')
JP_SPEC = json.load(open(os.path.join(ROOT, 'src', 'assets', 'jpInteriorSpec.json')))


# ═════════════════════════ 평면 작성 도우미 ═════════════════════════
def grid(W, H, rects, gaps=()):
    g = [['#'] * W for _ in range(H)]
    for (x0, y0, x1, y1) in rects:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): g[y][x] = '.'
    for (x, y) in gaps: g[y][x] = '.'
    return [''.join(r) for r in g]


def O(id_, x, y): return dict(id=id_, x=x, y=y)


def rooms_from(rects, kinds): return [dict(room=k, x0=r[0], y0=r[1], x1=r[2], y1=r[3]) for r, k in zip(rects, kinds)]


def build_plans():
    P = {}
    # ── 1. 교실 동(2교실 + 복도), 26×15 ─────────────────────────────────────────
    R1 = [(1, 1, 11, 8), (14, 1, 24, 8), (1, 10, 24, 13)]
    G1 = [(3, 9), (8, 9), (16, 9), (21, 9), (12, 14), (13, 14)]
    ob = [O('sc-blackboard', 4, 1), O('mc-wall-clock', 9, 1), O('sc-notice-board', 1, 1), O('sc-teacher-desk', 5, 3)]
    ob += [O('mc-desk-pair', x, y) for y in (5, 6) for x in (2, 5, 8)] + [O('mc-desk-pair', x, 7) for x in (2, 8)]   # QA: 가운데 열 맨 뒷줄을 비워 뒤 사물함과 통로 1칸
    ob += [O('sc-back-locker', 4, 8), O('sc-cleaning-locker', 10, 8), O('mc-bin-wide', 11, 8)]
    ob += [O('mc-board-green', 17, 1), O('mc-screen-proj', 14, 1), O('mc-cork-board', 22, 1), O('mc-wall-clock', 21, 1), O('mc-lectern', 22, 3)]
    ob += [O('mc-lecture-bench', x, y) for y in (4, 5, 6) for x in (15, 19)]
    ob += [O('mc-cabinet-glass', 23, 8), O('mc-pc-cart', 24, 3)]   # QA: 노트북 카트를 교탁 옆 벽으로
    ob += [O('mc-window-class', 5, 10), O('mc-cork-board', 10, 10), O('mc-wall-clock', 14, 10), O('mc-window-class', 18, 10), O('mc-cork-board', 23, 10)]
    ob += [O('mc-hall-locker', 5, 12), O('mc-hall-locker', 10, 12), O('mc-hall-locker', 14, 12), O('mc-hall-locker', 18, 12), O('mc-hall-locker', 22, 12)]
    ob += [O('mc-water-fountain', 1, 12), O('mc-umbrella-stand', 24, 12)]
    ob += [O('sc-classroom-door', x, 9) for x in (3, 8, 16, 21)]
    P['school-class-wing'] = dict(name='학교 교실 동 1층(교실 둘 + 복도)', tileset='modern_campus', plan=grid(26, 15, R1, G1), floor='mc-floor-lino', wall='mc-wall-class',
        zones=[dict(x0=1, y0=10, x1=24, y1=14, floor='mc-floor-corridor', wall='mc-wall-corridor')],
        objects=ob, tables=[], goods=[], start=[12, 13], rooms=rooms_from(R1[:2] + [(1, 10, 24, 13)], ['classroom', 'lecture', 'corridor']),
        doors=[dict(x=3, y=9, to='classroom', access=[3, 8, 3, 12]), dict(x=8, y=9, to='classroom', access=[8, 8, 8, 12]),
               dict(x=16, y=9, to='lecture', access=[16, 8, 16, 12]), dict(x=21, y=9, to='lecture', access=[21, 8, 21, 12])],
        exits=[dict(x0=12, x1=13, y=14, to='campus-yard', approach=[12, 13])])

    # ── 2. 특별교실 동(도서관 · 보건실 · 교무실 + 복도·계단), 26×15 ─────────────────
    R2 = [(1, 1, 11, 8), (14, 1, 18, 8), (21, 1, 24, 8), (1, 10, 24, 13)]
    G2 = [(4, 9), (9, 9), (16, 9), (22, 9), (12, 14), (13, 14)]
    ob = [O('sc-bookshelf', x, 3) for x in (1, 3, 5, 7, 9)] + [O('mc-lounge-sofa', 10, 6) if False else O('mc-lounge-sofa', 10, 3)]
    ob = [o for o in ob if not (o['id'] == 'mc-lounge-sofa')]
    ob += [O('mc-carrel', x, y) for y in (5, 6) for x in (1, 4, 7)] + [O('mc-book-trolley', 6, 8), O('sc-lib-counter', 11, 8), O('mc-wall-clock', 11, 1), O('mc-cork-board', 1, 1)]
    ob += [O('mc-eye-chart', 15, 1), O('sc-med-shelf', 18, 3), O('mc-aid-counter', 14, 3), O('sc-nurse-bed', 17, 5), O('mc-nurse-desk', 14, 6), O('sc-curtain', 17, 4), O('sc-scale', 18, 8), O('mc-bin-wide', 14, 8)]
    ob += [O('sc-whiteboard', 21, 1), O('sc-key-box', 23, 1), O('mc-cabinet-glass', 21, 3), O('sc-copy-machine', 24, 3), O('sc-staff-desk', 21, 5), O('sc-staff-desk', 23, 7)]
    ob += [O('mc-window-class', 5, 10), O('mc-cork-board', 14, 10), O('mc-wall-clock', 12, 10), O('mc-window-class', 18, 10)]
    ob += [O('mc-water-fountain', 1, 12), O('mc-trophy-shelf', 6, 12), O('mc-umbrella-stand', 11, 12), O('mc-hall-locker', 13, 12), O('sc-stairs-up', 23, 12)]
    ob += [O('sc-classroom-door', 4, 9), O('sc-classroom-door', 9, 9), O('sc-classroom-door', 16, 9), O('sc-classroom-door', 22, 9)]
    P['school-special-wing'] = dict(name='학교 특별교실 동 1층(도서관·보건실·교무실 + 복도·계단)', tileset='modern_campus', plan=grid(26, 15, R2, G2), floor='mc-floor-parquet', wall='mc-wall-dorm',
        zones=[dict(x0=14, y0=1, x1=18, y1=8, floor='mc-floor-cafe', wall='mc-wall-tile'), dict(x0=21, y0=1, x1=24, y1=8, floor='mc-floor-lino', wall='mc-wall-class'),
               dict(x0=1, y0=10, x1=24, y1=14, floor='mc-floor-corridor', wall='mc-wall-corridor')],
        objects=ob, tables=[], goods=[], start=[12, 13], rooms=rooms_from(R2[:3] + [R2[3]], ['library', 'infirmary', 'staffroom', 'corridor']),
        doors=[dict(x=4, y=9, to='library', access=[4, 8, 4, 12]), dict(x=9, y=9, to='library', access=[9, 8, 9, 12]),
               dict(x=16, y=9, to='infirmary', access=[16, 8, 16, 12]), dict(x=22, y=9, to='staffroom', access=[22, 8, 22, 12])],
        exits=[dict(x0=12, x1=13, y=14, to='campus-yard', approach=[12, 13])],
        stairs=[dict(x=23, y=12, w=2, dir='up', to='school-upper-floor', note='위층 장소는 같은 규칙으로 따로 짓는다(기숙사 2층 예제와 같은 짝 연결).')])

    # ── 3. 급식·동아리 동(급식실 · 화장실 · 동아리방 + 복도), 28×15 ─────────────────
    R3 = [(1, 1, 13, 8), (15, 1, 18, 8), (20, 1, 26, 8), (1, 10, 26, 13)]
    G3 = [(4, 9), (10, 9), (16, 9), (22, 9), (24, 9), (13, 14), (14, 14)]
    ob = [O('mc-serving-counter', 2, 3), O('mc-trash-bin', 6, 3), O('mc-fridge-counter', 9, 3), O('mc-wall-clock', 7, 1), O('mc-cork-board', 11, 1)]
    ob += [O('mc-cafe-table', 2, 5), O('mc-cafe-table', 7, 5), O('mc-cafe-table', 2, 7), O('mc-cafe-table', 7, 7), O('mc-cafe-table-2', 11, 5), O('mc-cafe-table-2', 11, 7), O('mc-bin-wide', 13, 8)]
    ob += [O('toilet', 15, 3), O('toilet', 17, 3), O('sc-sink', 16, 3), O('sc-urinal', 18, 3), O('mc-sink-vanity', 15, 6) if False else O('mc-bin-wide', 18, 8)]
    ob += [O('mc-cork-board', 21, 1), O('sc-whiteboard', 24, 1), O('mc-lounge-sofa', 20, 3), O('mc-club-shelf', 25, 3), O('mc-club-table', 21, 5), O('mc-low-table', 21, 7), O('mc-book-trolley', 24, 7), O('mc-bean-bag', 26, 5)]
    ob += [O('mc-window-class', 5, 10), O('mc-cork-board', 11, 10), O('mc-wall-clock', 13, 10), O('mc-window-class', 18, 10)]
    ob += [O('mc-water-fountain', 1, 12), O('mc-hall-locker', 6, 12), O('mc-hall-locker', 11, 12), O('mc-shoe-rack-low', 18, 12), O('mc-trophy-shelf', 25, 12)]
    ob += [O('sc-classroom-door', 4, 9), O('sc-classroom-door', 10, 9), O('door-open-toilet', 16, 9), O('sc-classroom-door', 22, 9), O('sc-classroom-door', 24, 9)]
    P['school-cafeteria-club-wing'] = dict(name='학교 급식·동아리 동 1층(급식실·화장실·동아리방 + 복도)', tileset='modern_campus', plan=grid(28, 15, R3, G3), floor='mc-floor-cafe', wall='mc-wall-cafe',
        zones=[dict(x0=15, y0=1, x1=18, y1=8, floor='mc-floor-tile-wc', wall='mc-wall-tile'), dict(x0=20, y0=1, x1=26, y1=8, floor='mc-floor-parquet', wall='mc-wall-dorm'),
               dict(x0=1, y0=10, x1=26, y1=14, floor='mc-floor-corridor', wall='mc-wall-corridor')],
        objects=ob, tables=[], goods=[], start=[13, 13], rooms=rooms_from(R3, ['cafeteria', 'toilet', 'club', 'corridor']),
        doors=[dict(x=4, y=9, to='cafeteria', access=[4, 8, 4, 12]), dict(x=10, y=9, to='cafeteria', access=[10, 8, 10, 12]),
               dict(x=16, y=9, to='toilet', access=[16, 8, 16, 12]), dict(x=22, y=9, to='club', access=[22, 8, 22, 12]), dict(x=24, y=9, to='club', access=[24, 8, 24, 12])],
        exits=[dict(x0=13, x1=14, y=14, to='campus-yard', approach=[13, 13])])

    # ── 4·5. 기숙사 1층·2층(계단으로 짝 연결), 24×15 ──────────────────────────────
    R4 = [(1, 1, 10, 8), (12, 1, 16, 8), (18, 1, 22, 8), (1, 10, 22, 13)]
    G4 = [(5, 9), (8, 9), (14, 9), (20, 9), (11, 14), (12, 14)]
    ob = [O('mc-lounge-sofa', 2, 3), O('mc-lounge-sofa', 5, 3), O('sc-tv-stand', 10, 3), O('mc-low-table', 3, 5), O('mc-bean-bag', 8, 5), O('mc-bean-bag', 9, 6), O('mc-fridge-counter', 7, 8) if False else O('mc-fridge-counter', 1, 8), O('mc-cork-board', 1, 1), O('mc-wall-clock', 6, 1)]
    ob += [O('mc-dorm-bed', 12, 3), O('mc-dorm-desk', 14, 3), O('mc-dorm-wardrobe', 16, 3), O('mc-dorm-dresser', 15, 7), O('mc-window-class', 13, 1)]   # QA: 서랍장을 방 가운데서 동쪽 벽으로
    ob += [O('mc-dorm-bed', 18, 3), O('mc-dorm-desk', 20, 3), O('mc-dorm-wardrobe', 22, 3), O('mc-dorm-dresser', 21, 7), O('mc-window-class', 19, 1)]
    ob += [O('mc-window-class', 6, 10), O('mc-cork-board', 15, 10), O('mc-wall-clock', 10, 10)]
    ob += [O('mc-shoe-rack-low', 1, 12), O('mc-umbrella-stand', 4, 12), O('mc-hall-locker', 15, 12), O('sc-stairs-up', 21, 12)]
    ob += [O('sc-classroom-door', 5, 9), O('sc-classroom-door', 8, 9), O('sc-classroom-door', 14, 9), O('sc-classroom-door', 20, 9)]
    P['dorm-1f'] = dict(name='기숙사 1층(라운지 + 방 둘 + 현관·계단)', tileset='modern_campus', plan=grid(24, 15, R4, G4), floor='mc-floor-dorm', wall='mc-wall-dorm',
        zones=[dict(x0=1, y0=10, x1=22, y1=14, floor='mc-floor-corridor', wall='mc-wall-corridor')],
        objects=ob, tables=[], goods=[], start=[11, 13], rooms=rooms_from(R4, ['lounge', 'dorm-room', 'dorm-room', 'corridor']),
        doors=[dict(x=5, y=9, to='lounge', access=[5, 8, 5, 12]), dict(x=8, y=9, to='lounge', access=[8, 8, 8, 12]),
               dict(x=14, y=9, to='dorm-room', access=[14, 8, 14, 12]), dict(x=20, y=9, to='dorm-room', access=[20, 8, 20, 12])],
        exits=[dict(x0=11, x1=12, y=14, to='campus-yard', approach=[11, 13])],
        stairs=[dict(x=21, y=12, w=2, dir='up', to='dorm-2f')],
        links=[dict(x=21, y=12, toMapId='dorm-2f', toX=20, toY=13, direction='up'), dict(x=22, y=12, toMapId='dorm-2f', toX=20, toY=13, direction='up')])

    R5 = [(1, 1, 5, 8), (7, 1, 11, 8), (13, 1, 17, 8), (19, 1, 22, 8), (1, 10, 22, 13)]
    G5 = [(3, 9), (9, 9), (15, 9), (20, 9)]
    ob = [O('mc-dorm-bed', 1, 3), O('mc-dorm-desk', 3, 3), O('mc-dorm-wardrobe', 5, 3), O('mc-dorm-dresser', 4, 7), O('mc-window-class', 2, 1)]
    ob += [O('mc-dorm-bed', 7, 3), O('mc-dorm-desk', 9, 3), O('mc-dorm-wardrobe', 11, 3), O('mc-dorm-dresser', 10, 7), O('mc-window-class', 8, 1)]
    ob += [O('toilet', 13, 3), O('sc-urinal', 14, 3), O('sc-sink', 15, 3), O('washing-machine', 16, 3), O('laundry-basket', 17, 3), O('mc-bin-wide', 17, 8)]
    ob += [O('mc-dorm-bed', 19, 3), O('mc-dorm-desk', 20, 3), O('mc-dorm-wardrobe', 22, 3) if False else O('mc-dorm-dresser', 21, 7), O('mc-cork-board', 20, 1)]   # QA: 떠 있던 서랍장을 벽으로, 책상 자리를 21 로
    ob = [O('mc-dorm-desk', 21, 3) if (o['id'] == 'mc-dorm-desk' and o['x'] == 20) else o for o in ob]
    ob += [O('mc-window-class', 5, 10), O('mc-cork-board', 11, 10), O('mc-wall-clock', 16, 10)]
    ob += [O('mc-vending-low', 1, 12) if False else O('mc-fridge-counter', 1, 12), O('mc-hall-locker', 6, 12), O('mc-hall-locker', 11, 12), O('sc-stairwell-down', 21, 12)]
    ob += [O('sc-classroom-door', 3, 9), O('sc-classroom-door', 9, 9), O('door-open-toilet', 15, 9), O('sc-classroom-door', 20, 9)]
    P['dorm-2f'] = dict(name='기숙사 2층(방 셋 + 공용 욕실 + 계단)', tileset='modern_campus', plan=grid(24, 15, R5, G5), floor='mc-floor-dorm', wall='mc-wall-dorm',
        zones=[dict(x0=13, y0=1, x1=17, y1=8, floor='mc-floor-tile-wc', wall='mc-wall-tile'), dict(x0=1, y0=10, x1=22, y1=14, floor='mc-floor-corridor', wall='mc-wall-corridor')],
        objects=ob, tables=[], goods=[], start=[20, 13], rooms=rooms_from(R5, ['dorm-room', 'dorm-room', 'bath', 'dorm-room', 'corridor']),
        doors=[dict(x=3, y=9, to='dorm-room', access=[3, 8, 3, 12]), dict(x=9, y=9, to='dorm-room', access=[9, 8, 9, 12]),
               dict(x=15, y=9, to='bath', access=[15, 8, 15, 12]), dict(x=20, y=9, to='dorm-room', access=[20, 8, 20, 12])],
        exits=[], stairs=[dict(x=21, y=12, w=2, dir='down', to='dorm-1f')],
        links=[dict(x=21, y=13, toMapId='dorm-1f', toX=21, toY=13, direction='down'), dict(x=22, y=13, toMapId='dorm-1f', toX=21, toY=13, direction='down')])
    return P


# ═════════════════════════ 사양(크기·종류) ═════════════════════════
def object_meta():
    """id → dict(kind, w, h, up, stairs, ko, new). 새 조각은 campus_interior.R, 재사용은 jpInteriorSpec.json."""
    import campus_interior as CI
    M = {}
    for i, o in JP_SPEC['objects'].items(): M[i] = dict(kind=o['kind'], w=o['w'], h=o['h'], up=o['up'], stairs=o.get('stairs'), ko=o['ko'], new=False, use=o.get('use') or [])
    for i, o in CI.R.objs.items(): M[i] = dict(kind=o['kind'], w=o['w'], h=o['h'], up=o['up'], stairs=o.get('stairs'), ko=o['ko'], new=True, use=list(o.get('use') or []))
    return M


class Analysis:
    def __init__(self, plan):
        self.H = len(plan); self.W = max(len(r) for r in plan)
        self.g = [[(plan[y][x] if x < len(plan[y]) else '#') != '#' for x in range(self.W)] for y in range(self.H)]
        self.face = [[0] * self.W for _ in range(self.H)]
        for y in range(self.H):
            for x in range(self.W):
                if not self.g[y][x]: continue
                if not self.inn(x, y - 1): self.face[y][x] = 1
                elif self.face[y - 1][x] == 1: self.face[y][x] = 2

    def inn(self, x, y): return 0 <= x < self.W and 0 <= y < self.H and self.g[y][x]
    def isFloor(self, x, y): return self.inn(x, y) and self.face[y][x] == 0


def validate(P, M):
    """builder.ts 규칙 옮김. 반환 [(code, message, x, y)] — 오류만."""
    A = Analysis(P['plan']); issues = []; foot = {}
    if not (P.get('floor') and P.get('wall')): issues.append(('no-floor-wall', '바닥·벽면 id 없음', 0, 0))
    for o in P['objects']:
        d = M.get(o['id'])
        if not d: issues.append(('unknown-object', o['id'], o['x'], o['y'])); continue
        lab = '%s@(%d,%d)' % (o['id'], o['x'], o['y'])
        if d['kind'] in ('floor', 'wall'):
            for dy in range(d['h']):
                for dx in range(d['w']):
                    x, y = o['x'] + dx, o['y'] + dy
                    if not A.isFloor(x, y) and d['stairs'] != 'up': issues.append(('not-on-floor', lab, x, y))
                    if (x, y) in foot: issues.append(('overlap', '%s 가 %s 와 겹침' % (lab, foot[(x, y)]), x, y))
                    foot[(x, y)] = lab
            if d['kind'] == 'wall':
                for dx in range(d['w']):
                    x = o['x'] + dx
                    if not (o['y'] > 0 and A.inn(x, o['y'] - 1) and A.face[o['y'] - 1][x] == 2):
                        issues.append(('stairs-not-at-wall' if d['stairs'] == 'up' else 'wall-piece-needs-face', lab, x, o['y'])); break
        elif d['kind'] == 'hang':
            if not all(A.inn(o['x'] + dx, o['y']) and A.face[o['y']][o['x'] + dx] == 1 for dx in range(max(1, d['w']))): issues.append(('hang-not-on-face', lab, o['x'], o['y']))
        elif d['kind'] == 'door':
            solid = lambda x, y: not A.inn(x, y)
            sideOk = lambda y: not A.isFloor(o['x'] - 1, y) and not A.isFloor(o['x'] + 1, y)
            ok = (A.isFloor(o['x'], o['y']) and solid(o['x'] - 1, o['y']) and solid(o['x'] + 1, o['y']) and A.inn(o['x'], o['y'] - 1)
                  and A.isFloor(o['x'], o['y'] + 1) and A.isFloor(o['x'], o['y'] + 2) and sideOk(o['y'] + 1) and sideOk(o['y'] + 2))
            if not ok: issues.append(('door-not-in-gap', lab, o['x'], o['y']))
        if d['stairs'] == 'down':
            for dy in range(max(1, d['h'])):
                for dx in range(d['w']): foot[(o['x'] + dx, o['y'] + dy)] = lab
    # 출입구 = 맨 아래 줄의 이어진 걸음 칸 한 덩이
    H, W = A.H, A.W
    exits = [x for x in range(W) if A.isFloor(x, H - 1)]
    if P.get('exits'):
        blocks = [];
        for x in exits:
            if blocks and blocks[-1][-1] == x - 1: blocks[-1].append(x)
            else: blocks.append([x])
        if len(blocks) != 1: issues.append(('interior-exit-ambiguous', '맨 아래 줄 출구 덩이 %d' % len(blocks), 0, H - 1))
        for e in P['exits']:
            if not all((x, H - 2) not in foot and A.isFloor(x, H - 2) for x in range(e['x0'], e['x1'] + 1)): issues.append(('exit-blocked', '출구 바로 위 칸이 막힘', e['x0'], H - 2))
    # 도달 BFS: 바닥 칸 − 발자국(floor·wall 가구 발밑, 계단 아래 포함). 문 칸은 걷는다.
    s = tuple(P['start'])
    if not A.isFloor(*s) or s in foot: issues.append(('start-blocked', 'start 가 막힌 칸', s[0], s[1])); return issues
    seen = {s}; q = collections.deque([s])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in seen or not A.isFloor(*n) or n in foot: continue
            seen.add(n); q.append(n)
    for y in range(H):
        for x in range(W):
            if A.isFloor(x, y) and (x, y) not in foot and (x, y) not in seen: issues.append(('unreachable-floor', '닿지 못하는 바닥', x, y))
    # 문 접근칸: 문 위 칸(방 쪽)과 아래 칸(복도 쪽)이 비어 있고 도달
    for dr in P.get('doors', []):
        for (ax, ay) in ((dr['access'][0], dr['access'][1]), (dr['access'][2], dr['access'][3])):
            if (ax, ay) in foot or (ax, ay) not in seen: issues.append(('door-access-blocked', '문 (%d,%d) 접근칸 (%d,%d) 막힘/미도달' % (dr['x'], dr['y'], ax, ay), ax, ay))
    return issues


def validate_plan(P, M): return validate(P, M)


# ═════════════════════════ 변조(오류 표본) ═════════════════════════
def tamper(P, kind):
    Q = copy.deepcopy(P); rows = [list(r) for r in Q['plan']]
    if kind == 'door-not-in-gap':
        d = next(o for o in Q['objects'] if o['id'].endswith('door') and o['id'] != 'door-open-toilet' or o['id'] == 'door-open-toilet')
        d['x'] += 1
    elif kind == 'overlap':
        o = next(o for o in Q['objects'] if o['id'] == 'mc-hall-locker'); Q['objects'].append(dict(id='mc-umbrella-stand', x=o['x'], y=o['y']))
    elif kind == 'wall-piece-needs-face':
        o = next((o for o in Q['objects'] if o['id'] in ('sc-bookshelf', 'sc-med-shelf', 'toilet', 'mc-fridge-counter', 'sc-stairs-up')), None)
        if o is None: return None
        o['y'] += 1 if o['id'] != 'sc-stairs-up' else 1
    elif kind == 'hang-not-on-face':
        o = next(o for o in Q['objects'] if o['id'] in ('sc-blackboard', 'mc-board-green', 'sc-bookshelf') and o['id'] != 'sc-bookshelf'); o['y'] += 3
    elif kind == 'exit-blocked':
        e = Q['exits'][0]; Q['objects'].append(dict(id='mc-umbrella-stand', x=e['x0'], y=len(rows) - 2))
    elif kind == 'door-access-blocked':
        d = Q['doors'][0]; Q['objects'].append(dict(id='mc-umbrella-stand', x=d['access'][0], y=d['access'][1]))
    elif kind == 'not-on-floor':
        o = next(o for o in Q['objects'] if o['id'] == 'mc-hall-locker'); o['y'] = len(rows) - 1
    else: return None
    return Q


TAMPERS = ['door-not-in-gap', 'overlap', 'hang-not-on-face', 'exit-blocked', 'door-access-blocked', 'not-on-floor']


def show(p, M):
    A = Analysis(p['plan']); G = [['#' if not A.inn(x, y) else ('~' if A.face[y][x] else '.') for x in range(A.W)] for y in range(A.H)]
    for o in p['objects']:
        d = M[o['id']]
        for dy in range(max(1, d['h']) if d['kind'] in ('floor', 'wall') else 0):
            for dx in range(d['w']):
                if 0 <= o['y'] + dy < A.H and 0 <= o['x'] + dx < A.W: G[o['y'] + dy][o['x'] + dx] = o['id'][3 if o['id'].startswith('mc-') else 0] .upper() if d['kind'] != 'hang' else G[o['y']][o['x']]
    print('\n'.join('%2d ' % i + ''.join(r) for i, r in enumerate(G)))


def main(argv):
    M = object_meta(); P = build_plans(); os.makedirs(PLANS, exist_ok=True)
    if '--grid' in argv:
        show(P[argv[argv.index('--grid') + 1]], M); return 0
    bad = 0
    for k, p in P.items():
        iss = validate_plan(p, M)
        print('%-28s %2dx%-2d 물건 %3d  오류·경고 %d' % (k, len(p['plan'][0]), len(p['plan']), len(p['objects']), len(iss)))
        for i in iss[:10]: print('   ', i)
        bad += len(iss)
        json.dump(p, open(os.path.join(PLANS, k + '.json'), 'w'), ensure_ascii=False, indent=1)
    first = P['school-class-wing']
    for t in TAMPERS:
        Q = tamper(first, t); iss = validate_plan(Q, M); codes = sorted({c for c, *_ in iss})
        print('변조 %-22s → %s' % (t, codes));
        if t not in codes: print('  x 못 잡음'); bad += 1
    if '--render' in argv:
        import campus_plan_render as PR; PR.render_all(P, M)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
