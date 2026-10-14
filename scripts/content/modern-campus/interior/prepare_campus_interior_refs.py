#!/usr/bin/env python3
"""modern_campus 실내 참고문서 번들 → src/assets/modernCampusInteriorReferences.json (이미지는 /assets/modern-campus-references/*.png 경로만, 바이트 없음).
계약: tiledata/AI-REFERENCE-CONTRACT.md. 평면·가구는 campus_plans.py·campus_interior.py 가 정본이고, 이 스크립트는 그 값을 문서로 옮길 뿐이다.
  python3 scripts/content/modern-campus/interior/campus_plans.py --render      # 평면 JSON + 그림 먼저
  python3 scripts/content/modern-campus/interior/prepare_campus_interior_refs.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
import campus_interior as CI, campus_plans as CP

PFX = 'mci-'
OUT = os.path.join(ROOT, 'src', 'assets', 'modernCampusInteriorReferences.json')
IMGDIR = '/assets/modern-campus-references/'
M = CP.object_meta(); P = CP.build_plans()

KIND_KO = {'floor': '바닥 가구(발밑 w×h 막힘)', 'wall': '벽 가구(북쪽 벽면 바로 아래 첫 바닥 줄)', 'hang': '걸이(벽면 두 줄 중 윗줄)', 'flat': '바닥 깔개(걸을 수 있음)', 'door': '문(가로 칸막이 1칸 틈)', 'sidedoor': '옆문'}
ROOMS = [  # (종류, 한국어, 조수 낱말, 재사용 id 묶음, 새 id)
    ('classroom', '교실', '교실 · 학급', 'classroom', ['mc-desk-pair', 'mc-board-green', 'mc-wall-clock', 'mc-cabinet-glass', 'mc-pc-cart', 'mc-bin-wide', 'mc-window-class', 'mc-cork-board']),
    ('corridor', '복도', '복도 · 현관 · 신발장', 'corridor', ['mc-hall-locker', 'mc-water-fountain', 'mc-umbrella-stand', 'mc-trophy-shelf', 'mc-shoe-rack-low']),
    ('stairwell', '계단실', '계단 · 계단실', 'stairs', []),
    ('toilet', '화장실', '화장실 · 세면', 'toilet', ['mc-floor-tile-wc', 'mc-wall-tile', 'mc-cleaning-wagon']),
    ('lockers', '사물함 구역', '사물함 · 로커', 'corridor', ['mc-hall-locker', 'mc-shoe-rack-low']),
    ('staffroom', '교무실', '교무실 · 직원실', 'staffroom', ['mc-cabinet-glass', 'mc-trophy-shelf', 'mc-dorm-dresser']),
    ('cafeteria', '급식실', '급식실 · 식당 · 배식', 'cafeteria', ['mc-serving-counter', 'mc-tray-cart', 'mc-fridge-counter', 'mc-cafe-table', 'mc-cafe-table-2', 'mc-cafe-stool', 'mc-floor-cafe', 'mc-wall-cafe']),
    ('library', '도서관', '도서관 · 서고 · 열람실', 'library', ['mc-carrel', 'mc-book-trolley', 'mc-catalog-drawers', 'mc-floor-parquet']),
    ('dorm-room', '기숙사 방', '기숙사 · 방', 'dorm', ['mc-dorm-bed', 'mc-dorm-desk', 'mc-dorm-wardrobe', 'mc-dorm-dresser', 'mc-lounge-sofa', 'mc-low-table', 'mc-bean-bag', 'mc-floor-dorm']),
    ('club', '동아리 방', '동아리 · 부실', 'club', ['mc-club-table', 'mc-club-shelf', 'mc-amp-stack', 'mc-lounge-sofa', 'mc-low-table', 'mc-bean-bag', 'mc-trophy-shelf']),
    ('lecture', '강의실', '강의실 · 대강의실', 'lecture', ['mc-lecture-bench', 'mc-lectern', 'mc-lecture-stool', 'mc-screen-proj', 'mc-board-green']),
    ('infirmary', '보건실', '보건실 · 의무실', 'infirmary', ['mc-aid-counter', 'mc-nurse-desk', 'mc-eye-chart']),
]
GATE_N = len(CI.R.objs) + len(CI.R.floors) + len(CI.R.walls)


def table(rows, head):
    return '\n'.join(['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows])


def new_piece_rows():
    rows = []
    for i, o in CI.R.objs.items():
        rows.append((i, o['ko'], o['kind'], '%dx%d' % (o['w'], max(o['h'], 0)), o['up'], o.get('gate'), ','.join(o['use']) or '-', o.get('place') or '-'))
    return rows


def rules_doc():
    reuse_rows = [(k, ', '.join('`%s`' % i for i in v)) for k, v in CI.REUSE.items()]
    rooms_rows = []
    for k, ko, words, reuse_key, new in ROOMS:
        reuse = ', '.join('`%s`' % i for i in CI.REUSE.get(reuse_key, [])[:8]); nw = ', '.join('`%s`' % i for i in new)
        rooms_rows.append((k, ko, words, reuse or '-', nw or '-'))
    return f'''# modern_campus 실내 — 짓는 법·사전·평면 규칙·변조 오류 (학교 12방 · 기숙사)

tilesetId `modern_campus`(야외 번들과 같은 칩셋 id, 실내 조각은 같은 시트에 덧붙인다). 판본: 첫 묶음(2026-10-13). 그림 정본 `scripts/content/modern-campus/interior/campus_interior.py`,
평면 정본 `campus_plans.py`(JSON `tiledata/modern-campus/interior/plans/*.json`), 합성 그림 `public/assets/modern-campus-references/interior-*.png`.

> **상태(꼭 읽을 것)**: 이 조각 {GATE_N}종(가구 {len(CI.R.objs)} · 바닥 {len(CI.R.floors)} · 벽면 {len(CI.R.walls)})은 전부 object-gate 판정(gemini 4회·과반) PASS 이다(`mc-fire-cabinet` 은 영수증이 없어 시트에서 뺐다). **시트에 구워졌다**(`scripts/content/modern-campus/bake_mc.py`) — 가구 id 는 칸 사양 `modernCampusRoomSpec.json` 에 있고, `build_hand_interior_room({{tileset:"modern_campus"}})` 가 평면 5장을 그대로 짓는다(엔진 통행 BFS·경고 0 — `qa/check-campus-interiors.mts`).
> **출구 폭:** 이 평면들의 남쪽 출구는 2칸이다 — 도구 인자에 **`exitWidth:2`** 를 함께 준다(기본은 1칸 출구).
> 한 번도 통과하지 못한 조각 {len(CI.DROPPED)}종은 버렸다(`DROPPED`): {', '.join('`%s`' % d for d in CI.DROPPED)} — 쓰지 말 것.

## 1. 방 종류 12 → 가구(재사용 · 새 조각)

{table(rooms_rows, ['방', '이름', '조수 낱말', '재사용(jp_city 실내 · 손 도트 v5)', '새 조각(mc-)'])}

재사용 id 는 **다시 그리지 않고 참조**한다. 같은 id 는 이미 jp_city 사양에 칸 번호가 있다:

{table(reuse_rows, ['방 묶음', '재사용 id'])}

## 2. 새 조각 사전 (id·발자국·종류·쓰임·놓는 곳)

크기는 칸 w×h(16px). 가구 그림 높이 = (ceil(up/16) + h)×16 px. 종류(kind)는 `build_hand_interior_room` 의 조립 규칙이고, **관문 종류**는 object-gate 에 낸 정직한 종류다.

{table(new_piece_rows(), ['id', '이름', '조립 종류', 'w×h', 'up px', '관문 종류', '쓰임', '놓는 곳'])}

바닥 {len(CI.R.floors)}: {', '.join('`%s`(%d×%d칸)' % (i, f['cols'], f['rows']) for i, f in CI.R.floors.items())}. 벽면 {len(CI.R.walls)}: {', '.join('`%s`(%d칸 주기)' % (i, w['cols']) for i, w in CI.R.walls.items())}.
바닥·벽면은 도트 직접 그린 terrain 조각이다(관문 종류 terrain).

## 3. 조립 순서(실행 순서)

1. 평면 문자열 한 장: `#` 막힘, 그 밖 실내. 막힌 칸 바로 아래 두 줄 = 벽면(못 걸음), 나머지 = 바닥. 방은 위쪽 띠(벽면 2줄 + 바닥 7줄 이하), 가로 칸막이 줄 1줄, 복도(벽면 2줄 + 바닥 4줄)로 쌓는다.
2. 방 사이 **문** = 가로 칸막이 `#` 줄의 1칸 틈에 `sc-classroom-door`(교실·강의실·기숙사 방) 또는 `door-open-toilet`(화장실) — 틈 좌우 `#`, 위 칸은 방, 아래 두 줄은 복도 바닥.
3. 존(zones)으로 방마다 바닥·벽면 id 를 바꾼다(복도 `mc-floor-corridor`+`mc-wall-corridor`, 급식실 `mc-floor-cafe`+`mc-wall-cafe`, 화장실 `mc-floor-tile-wc`+`mc-wall-tile`, 도서관·동아리 `mc-floor-parquet`+`mc-wall-dorm`, 기숙사 `mc-floor-dorm`+`mc-wall-dorm`, 교실·강의실 `mc-floor-lino`+`mc-wall-class`).
4. 걸이(칠판·시계·게시판·창)를 먼저, 벽 가구(책장·변기·계단)는 **북쪽 벽면 바로 아래 첫 바닥 줄**, 바닥 가구는 나머지. 그리는 순서 = (y+높이)×16, 남쪽 가구가 앞.
5. 교실 책상은 `mc-desk-pair`(2칸 한 쌍) 3열×3행 격자(열 사이 1칸), 칠판 앞에 교탁, 뒤에 사물함·청소함. 강의실은 `mc-lecture-bench`(3칸) 줄 사이 통로 1칸.
6. 복도는 폭 4줄(벽 가구 줄 + 통로 2줄 + 사물함 줄). 통로 2줄 폭을 유지한다(주 동선).
7. 출입구 = 맨 아래 줄 이어진 틈(교사 현관), 틈 바로 위 1줄은 비운다. 위층 연결은 `sc-stairs-up`(위, 복도 북쪽 벽 앞 2칸) · `sc-stairwell-down`(아래, 2×2 바닥) + 아래 줄 이동 칸.

## 4. 문 그림 · 접근칸 · 출입 이벤트 — 세 가지를 섞지 않는다

| 구분 | 무엇 | 예(교실 동) |
|---|---|---|
| 문 그림 | 가로 칸막이 틈 칸 (x,y) 에 선 `sc-classroom-door` 16×32(인방 + 열린 문틀). 발자국 없음, 통로를 막지 않는다 | (3,9) |
| 접근칸 | 문 위 칸 (x,y-1) 과 문 아래 칸 (x,y+3) — 비워 둔다. 가구·이벤트 금지(검증 `door-access-blocked`) | (3,8) · (3,12) |
| 출입 이벤트 | 맵 이동(transfer). **교실 문은 같은 맵 안이라 이벤트가 없다.** 이벤트는 ① 계단 앞 칸(`links`) ② 건물 출입구 틈 칸(`exits`) 에만 둔다 | 기숙사 1층 (21,12)(22,12) → 2층 (20,13) |

문을 그려 놓고 이동 이벤트를 틈 칸에 얹지 않는다 — 이벤트는 문 그림이 아니라 **접근칸 한 칸 앞의 별도 칸**에 둔다.

## 5. 기숙사 층 연결

- 1층 `dorm-1f`: `sc-stairs-up`(2칸, 복도 북쪽 벽 앞 (21,12)) — 이동 칸은 **계단 그림 칸 자체** (21,12)·(22,12) 방향 `up` → 2층 `dorm-2f` 도착 (20,13)(계단 옆 바닥, 비워 둔다).
- 2층 `dorm-2f`: `sc-stairwell-down`(2×2 바닥 (21,12)·(22,12)·(21,13)·(22,13)) — 이동 칸은 계단통 **아래 줄** (21,13)·(22,13) 방향 `down` → 1층 도착 (21,13)(계단 바로 아래 칸).
- 두 맵의 `links` 는 서로를 가리키는 한 쌍이다(`toMapId` 가 상대 맵 id). 도착 칸은 발자국 밖·도달 가능한 칸이어야 하고, 계단 앞 칸에 가구를 두지 않는다.
- 같은 방식으로 학교 본관 위층도 잇는다(`school-special-wing` 의 `sc-stairs-up` (23,12) 2칸). 위층 장소는 같은 규칙으로 따로 짓는다.
- `create_transfer_pair` 는 막힌 문 칸을 옮기므로 쓰지 않는다. 기숙사는 방 문이 같은 맵 안이라 이동 이벤트가 없고, 층 이동 이벤트만 있다.

## 6. 자동 검증 범위와 변조 오류

`python3 scripts/content/modern-campus/interior/campus_plans.py` 가 평면 5장을 `builder.ts` 규칙대로 점검한다: 발밑 바닥(`not-on-floor`)·겹침(`overlap`)·벽 가구 북쪽 벽면(`wall-piece-needs-face`, `stairs-not-at-wall`)·걸이 벽면 윗줄(`hang-not-on-face`)·문 틈(`door-not-in-gap`)·출구 덩이(`interior-exit-ambiguous`)·출구 위 칸(`exit-blocked`)·4방 도달(`unreachable-floor`, `start-blocked`)·문 접근칸(`door-access-blocked`).
정상 5장 0 오류. 교실 동 평면을 **실제로 변조**해 코드가 그대로 잡히는지 본다(정상/오류 그림 `interior-err-compare.png`). 변조 6종: 문 한 칸 이동 → `door-not-in-gap`, 같은 칸에 가구 두 개 → `overlap`, 칠판을 바닥으로 → `hang-not-on-face`, 출구 위에 가구 → `exit-blocked`, 문 접근칸에 가구 → `door-access-blocked`, 가구를 맨 아래 벽줄로 → `not-on-floor`.
**확인하지 않는 것**: 이벤트 실행(계단 이동이 실제로 일어나는지)·«학교처럼 보이는가»(미감)·엔진 `passabilityOf` 판정(칸 번호가 없어서)·저가 모델의 성공률. 합성 그림은 코드가 조각 그림을 평면대로 놓은 근사이며 **엔진 출력이 아니다**.

## 7. 정상/오류 그림
'''


def plan_doc(k, p):
    iss = CP.validate_plan(p, M)
    objs = ', '.join('[{"id":"%s","x":%d,"y":%d}]' % (o['id'], o['x'], o['y']) for o in p['objects'][:0])
    arr = json.dumps([o for o in p['objects']], ensure_ascii=False, separators=(',', ':'))
    plan_txt = '\n'.join('%2d %s' % (i, r) for i, r in enumerate(p['plan']))
    zones = json.dumps(p['zones'], ensure_ascii=False)
    rooms = '\n'.join('- %s: x %d..%d · y %d..%d' % (r['room'], r['x0'], r['x1'], r['y0'], r['y1']) for r in p['rooms'])
    doors = '\n'.join('- 문 그림 (%d,%d) → %s · 접근칸 (%d,%d) · (%d,%d) · **이벤트 없음(같은 맵)**' % (d['x'], d['y'], d['to'], d['access'][0], d['access'][1], d['access'][2], d['access'][3]) for d in p['doors'])
    exits = '\n'.join('- 출입구 틈 y=%d x %d..%d → `%s`(건물 문 앞 접근칸 위쪽 줄 y=%d 는 비움)' % (e['y'], e['x0'], e['x1'], e['to'], e['y'] - 1) for e in p.get('exits', [])) or '- (이 층에 건물 출입구 없음)'
    stairs = '\n'.join('- 계단 %s (%d,%d) %d칸 → `%s`' % (s['dir'], s['x'], s['y'], s['w'], s['to']) for s in p.get('stairs', [])) or '- (계단 없음)'
    links = json.dumps(p.get('links', []), ensure_ascii=False) if p.get('links') else '[]'
    tool = {'tileset': 'modern_campus', 'name': p['name'], 'plan': p['plan'], 'floor': p['floor'], 'wall': p['wall'], 'zones': p['zones'], 'objects': p['objects'], 'exitWidth': 2, 'start': p['start'], 'links': p.get('links', [])}
    return f'''# modern_campus 실내 예제 — {p['name']} (`{k}`, {len(p['plan'][0])}×{len(p['plan'])}칸)

tilesetId `modern_campus` · 좌표 0기준 (x 오른쪽, y 아래) · 칸 16px. 이 문서의 입력은 `build_hand_interior_room` 인자 모양이다(굽기 완료 — `mc-` id 는 시트에 있다).
자동 검증: 오류·경고 {len(iss)}건(`campus_plans.py`). 합성 그림(엔진 출력 아님): `interior-{k}.png`.

## 평면 (`#` 막힘 · `.` 실내)
```
{plan_txt}
```
방(rooms):
{rooms}

존(zones): `{zones}` · 기본 바닥 `{p['floor']}` · 기본 벽면 `{p['wall']}`

## 문·계단·출입 (그림 / 접근칸 / 이벤트 분리)
{doors}
{stairs}
{exits}
이동 칸 `links`: `{links}`

## 전체 물건 배열 ({len(p['objects'])}개, 정본 JSON `tiledata/modern-campus/interior/plans/{k}.json`)
```json
{arr}
```

## 도구 인자 전체
```json
{json.dumps(tool, ensure_ascii=False, separators=(',', ':'))}
```
시작 칸 `start` = {p['start']}. 칸 번호는 시트에 구워진 사양(`list_hand_interior_parts({{tileset:"modern_campus"}})`)이 정한다 — 이 평면·물건 배열이 정답 입력이다.
'''


ROOM_TABLE_OUT = os.path.join(ROOT, 'src', 'assets', 'modernCampusRoomTable.json')
ALIASES = {
    'classroom': ['교실', '학급', '반', '홈룸', 'classroom'], 'corridor': ['복도', '현관', '昇降口', '교사 현관', 'hallway', 'corridor'], 'stairwell': ['계단실', '계단', '비상계단', 'stairwell'],
    'toilet': ['화장실', '세면실', 'restroom', 'toilet'], 'lockers': ['사물함', '로커', '락커', 'lockers'], 'staffroom': ['교무실', '직원실', '교사실', 'staff room'],
    'cafeteria': ['급식실', '식당', '학생식당', '배식', 'cafeteria'], 'library': ['도서관', '도서실', '열람실', 'library'], 'dorm-room': ['기숙사', '기숙사 방', '호실', 'dorm'],
    'club': ['동아리 방', '동아리', '부실', '부활동실', 'club room'], 'lecture': ['강의실', '대강의실', '계단강의실', 'lecture hall'], 'infirmary': ['보건실', '의무실', 'infirmary'],
    'lounge': ['라운지', '휴게실', 'lounge'], 'bath': ['공용 욕실', '샤워실', 'bath'], 'dorm-hall': ['기숙사 복도'],
}


def room_table():
    kinds = {k: dict(ko=ko, alias=ALIASES[k]) for k, ko, *_ in ROOMS}
    for k, ko in (('lounge', '기숙사 라운지'), ('bath', '공용 욕실·샤워실')): kinds[k] = dict(ko=ko, alias=ALIASES[k])
    buildings = {'campus_school_class': '학교 교실 동 1층(교실 둘 + 복도, school-class-wing)', 'campus_school_special': '학교 특별교실 동 1층(도서관·보건실·교무실 + 계단, school-special-wing)',
                 'campus_school_cafeteria': '학교 급식·동아리 동 1층(급식실·화장실·동아리방, school-cafeteria-club-wing)', 'campus_dorm': '기숙사 1·2층(라운지·방·공용 욕실·계단, dorm-1f·dorm-2f)'}
    bmap = {'school-class-wing': 'campus_school_class', 'school-special-wing': 'campus_school_special', 'school-cafeteria-club-wing': 'campus_school_cafeteria', 'dorm-1f': 'campus_dorm', 'dorm-2f': 'campus_dorm'}
    examples = []
    for k, p in P.items():
        for r in p['rooms']:
            if r['room'] == 'corridor': kind = 'corridor'
            else: kind = r['room']
            cnt = {}
            for o in p['objects']:
                if r['x0'] <= o['x'] <= r['x1'] and r['y0'] <= o['y'] <= r['y1']: cnt[o['id']] = cnt.get(o['id'], 0) + 1
            examples.append([k, bmap[k], kind, [[i, n] for i, n in sorted(cnt.items())]])
    return dict(kinds=kinds, buildings=buildings, examples=examples, docPrefix=PFX + 'ex-', newObjectIds=sorted(CI.R.objs), floors=sorted(CI.R.floors), walls=sorted(CI.R.walls), dropped=CI.DROPPED)


def main():
    json.dump(room_table(), open(ROOM_TABLE_OUT, 'w'), ensure_ascii=False, indent=1)
    docs = [dict(id=PFX + 'rules', name='modern_campus 실내 · 짓는 법·방 12종 사전·평면 규칙·변조 오류', markdown=rules_doc() + '\n![정상/오류](' + IMGDIR + 'interior-err-compare.png)\n\n새 조각 도감: `' + IMGDIR + 'interior-pieces.png`\n')]
    imgs = [
        dict(id=PFX + 'img-err-compare', name='interior-err-compare.png', caption='교실 동 정상(왼쪽)과 변조 4종(오른쪽, 빨간 테두리 = 검출 좌표). 검증 코드는 변조마다 이름 붙은 오류 코드를 낸다. 코드 합성 그림(엔진 출력 아님, ×4).', dataUrl=IMGDIR + 'interior-err-compare.png'),
        dict(id=PFX + 'img-pieces', name='interior-pieces.png', caption='새 가구 %d종 도감(원본 해상도 ×2, 투명 = 회색 배경). 전부 object-gate PASS.' % len(CI.R.objs), dataUrl=IMGDIR + 'interior-pieces.png')]
    for k, p in P.items():
        docs.append(dict(id=PFX + 'ex-' + k, name='modern_campus 실내 예제 · ' + p['name'], markdown=plan_doc(k, p)))
        imgs.append(dict(id=PFX + 'img-' + k, name='interior-%s.png' % k, caption='%s %d×%d칸(×2, 코드 합성 — 엔진 출력 아님). 배열·입력 `%sex-%s`.' % (p['name'], len(p['plan'][0]), len(p['plan']), PFX, k), dataUrl=IMGDIR + 'interior-%s.png' % k))
    cat = dict(id=PFX + 'interior', name='modern_campus · 학교·기숙사 실내 (방 12종 · 평면 5장)', description='학교 교실·복도·계단실·화장실·사물함·교무실·급식실·도서관·기숙사 방·동아리방·강의실·보건실을 짓는 법. 새 조각 사전·평면 완전 배열·문 그림/접근칸/이벤트 분리·기숙사 층 연결·변조 오류.',
               documents=docs, images=imgs)
    json.dump([cat], open(OUT, 'w'), ensure_ascii=False, indent=1)
    print('docs', len(docs), 'images', len(imgs), 'bytes', os.path.getsize(OUT))


if __name__ == '__main__':
    main()
