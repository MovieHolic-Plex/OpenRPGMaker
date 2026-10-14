#!/usr/bin/env python3
"""modern_city 실내 예제 방(조수 참고 예제 · 방 표 · 적대 검수 대상) — 손으로 배치한 평면과 가구.
쓰기: python3 scripts/content/modern-city-int/examples.py [--render]
  → tiledata/modern-city/interior/examples/<id>.json (build_hand_interior_room 인자 모양 + rooms 사각형)
  → --render 면 tiledata/modern-city/interior/examples/<id>.png (원 해상도) 와 /tmp/mci-ex/<id>-x3.png

배치 원칙(조수 지침과 같다):
  · 방마다 용도 구역이 있다(사무 섬·회의실·탕비, 계산대·진열 통로·뒷방, 침실·거실·부엌 …).
  · 벽 가구(kind wall)는 북쪽 벽면 바로 아래 첫 바닥 줄, 걸이는 벽면 윗줄.
  · 사람 동선은 2칸 폭(가게 진열 통로는 1칸도 된다 — narrow 로 밝힌다). 출구에서 모든 바닥에 닿는다.
  · 의자는 탁자·책상을 보고 앉는다(남향 의자 = 책상 북쪽, 북향 의자 = 책상 남쪽).
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'modern-city', 'interior', 'examples')


def O(id_, x, y): return {'id': 'mci-' + id_, 'x': x, 'y': y}
def T(style, x, y, w, h): return {'style': 'mci-' + style, 'x': x, 'y': y, 'w': w, 'h': h}
def G(id_, x, y): return {'id': 'mci-g-' + id_, 'x': x, 'y': y}


EX = {}

# ── 사무실 한 층: 열린 사무 섬 둘 + 벽 쪽 1인 줄 + 회의실(문) + 복도 끝 서버·복합기 ──
EX['office-floor'] = dict(
    name='도쿄풍 사무실 한 층', kind='office',
    plan=['####################',
          '#..........#.......#',
          '#..........#.......#',
          '#..........#.......#',
          '#..........#.......#',
          '#..........#.......#',
          '#..........#.......#',
          '#..........##.######',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '########..##########'],
    floor='mci-carpet-office', wall='mci-wall-office', exitWidth=2,
    zones=[dict(x0=12, x1=18, y0=1, y1=6, floor='mci-wood-oak', wall='mci-wall-office')],
    objects=[
        O('window-city', 2, 1), O('window-city', 5, 1), O('wall-clock', 8, 1), O('whiteboard', 13, 1), O('window-blind', 16, 1),
        O('notice-board', 12, 8), O('ac-wall', 16, 8),
        O('shelf-office', 1, 3), O('filing', 3, 3), O('coffee-station', 7, 3), O('plant-tall', 10, 3), O('plant-tall', 5, 3),
        # 사무 줄(모두 남쪽을 보고 앉는다: 남향 의자 + 화면이 북쪽인 책상) — 줄마다 뒤로 2칸 통로
        O('chair-office-s', 2, 5), O('chair-office-s', 4, 5), O('desk-pc-back', 1, 6), O('desk-pc-back', 3, 6),
        O('chair-office-s', 8, 5), O('chair-office-s', 10, 5), O('desk-pc-back', 7, 6), O('desk-pc-back', 9, 6),
        O('chair-office-s', 2, 8), O('chair-office-s', 4, 8), O('desk-pc-back', 1, 9), O('desk-pc-back', 3, 9),
        O('chair-office-s', 8, 8), O('chair-office-s', 10, 8), O('desk-pc-back', 7, 9), O('desk-pc-back', 9, 9),
        O('chair-office-s', 2, 11), O('chair-office-s', 4, 11), O('desk-pc-back', 1, 12), O('desk-pc-back', 3, 12),
        O('plant-tall', 6, 12),
        # 회의실
        O('chair-office-s', 14, 3), O('chair-office-s', 15, 3), O('chair-office-s', 16, 3),
        O('plant-tall', 18, 3), O('door-wood', 13, 7),
        # 복도 동쪽: 대기 소파·서류장
        O('plant-tall', 11, 10), O('filing', 15, 10), O('shelf-office', 17, 10),
    ],
    tables=[T('t-meeting', 14, 4, 3, 2)],
    goods=[G('laptop', 14, 4), G('coffee', 16, 5), G('papers', 15, 4)],
    start=[9, 12],
    rooms=[dict(room='open-office', x0=0, y0=0, x1=11, y1=13), dict(room='meeting', x0=11, y0=0, x1=19, y1=7), dict(room='hall', x0=11, y0=7, x1=19, y1=13)],
)

# ── 편의점: 벽 냉장고 줄 · 진열 섬 두 줄 · 계산대 · 뒷방(창고) ──
EX['konbini'] = dict(
    name='도쿄풍 편의점', kind='konbini',
    plan=['################',
          '#.........#....#',
          '#.........#....#',
          '#.........#....#',
          '#.........#....#',
          '#.........###.##',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '######..########'],
    floor='mci-vinyl-store', wall='mci-wall-store', exitWidth=2,
    zones=[dict(x0=11, x1=14, y0=1, y1=4, floor='mci-concrete', wall='mci-wall-metal')],
    objects=[
        O('cooler', 1, 3), O('cooler', 3, 3), O('cooler', 5, 3), O('magazine', 7, 3), O('fridge', 9, 3),
        O('gondola', 2, 6), O('gondola', 4, 6), O('gondola', 2, 9), O('gondola', 4, 9),
        O('freezer', 8, 6),
        O('counter-register', 11, 9), O('fridge', 14, 8),
        O('basket-stack', 5, 11),
        # 뒷방
        O('rack', 11, 3), O('pallet', 14, 3),
        O('door-steel', 13, 5),
    ],
    tables=[], goods=[],
    start=[6, 11],
    rooms=[dict(room='backroom', x0=10, y0=0, x1=15, y1=5), dict(room='konbini', x0=0, y0=0, x1=15, y1=12)],
    narrow=[dict(x0=13, y0=6, x1=13, y1=8, why='뒷방 문에서 계산대 안쪽으로 가는 직원 길')],
)

# ── 원룸 아파트(1LDK): 침실 · 거실 · 부엌 식탁 · 욕실 ──
EX['apartment'] = dict(
    name='도쿄풍 아파트 1LDK', kind='apartment',
    plan=['################',
          '#......#.......#',
          '#......#.......#',
          '#......#.......#',
          '#......#.......#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#......#.......#',
          '#......#.......#',
          '#......#.......#',
          '##########..####'],
    floor='mci-wood-oak', wall='mci-wall-home', exitWidth=2,
    zones=[],
    objects=[
        O('window-curtain', 2, 1), O('ac-wall', 4, 1), O('window-city', 9, 1), O('art-frame', 12, 1),
        O('bedside', 1, 3), O('bed-double', 2, 3), O('bedside', 4, 3), O('wardrobe', 5, 3),
        O('chair-office-s', 2, 9), O('desk-pc-back', 1, 10), O('plant-tall', 6, 10),
        O('sofa', 8, 3), O('fridge', 11, 3), O('kitchen', 12, 3),
        O('rug', 8, 4), O('coffee-table', 9, 5),
        O('chair-wood-s', 12, 5), O('chair-wood-s', 13, 5), O('cafe-chair-e', 11, 7), O('cafe-chair-w', 14, 7),
        O('plant-tall', 14, 10),
    ],
    tables=[T('t-wood', 12, 6, 2, 2)],
    goods=[G('vase', 12, 6), G('coffee', 13, 7)],
    start=[10, 10],
    rooms=[dict(room='bedroom', x0=0, y0=0, x1=7, y1=11), dict(room='living', x0=7, y0=0, x1=15, y1=11)],
)

# ── 병원 병동(4인실 둘 + 간호 통로) ──
EX['hospital-ward'] = dict(
    name='도쿄풍 병원 병동', kind='hospital',
    plan=['##################',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '########.#########',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '############..####'],
    floor='mci-vinyl-hospital', wall='mci-wall-hospital', exitWidth=2,
    zones=[],
    objects=[
        O('window-blind', 2, 1), O('window-blind', 7, 1), O('wall-clock', 10, 1), O('window-blind', 13, 1),
        O('iv-stand', 1, 3), O('hosp-bed', 2, 3), O('bedside', 3, 3),
        O('iv-stand', 5, 3), O('hosp-bed', 6, 3), O('bedside', 7, 3),
        O('iv-stand', 10, 3), O('hosp-bed', 11, 3), O('bedside', 12, 3),
        O('iv-stand', 14, 3), O('hosp-bed', 15, 3), O('bedside', 16, 3),
        O('med-cart', 9, 3),
        O('door-hospital', 8, 7),
        O('notice-board', 3, 8), O('wall-clock', 13, 8),
        O('wait-bench', 1, 10), O('wait-bench', 4, 10), O('reception', 10, 10), O('plant-tall', 16, 10),
    ],
    tables=[], goods=[],
    start=[12, 11],
    rooms=[dict(room='ward', x0=0, y0=0, x1=17, y1=6), dict(room='waiting_room', x0=0, y0=7, x1=17, y1=12)],
)

# ── 사무 빌딩 로비: 엘리베이터 · 보안 게이트 · 안내 데스크 · 우편함 · 대기 소파 ──
EX['lobby'] = dict(
    name='도쿄풍 빌딩 로비', kind='lobby',
    plan=['####################',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..#............#..#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '########....########'],
    floor='mci-stone-lobby', wall='mci-wall-lobby', exitWidth=4,
    zones=[],
    objects=[
        O('art-frame', 2, 1), O('wall-clock', 9, 1), O('art-frame', 16, 1),
        O('mailboxes', 1, 3), O('plant-tall', 3, 3), O('elevator', 5, 3), O('elevator', 8, 3), O('elevator', 11, 3),
        O('plant-tall', 14, 3), O('stairs-up', 16, 3),
        O('planter', 1, 8), O('security-gate', 5, 8), O('security-gate', 8, 8), O('security-gate', 11, 8), O('planter', 14, 8), O('planter', 17, 8),
        O('reception', 14, 10), O('plant-tall', 18, 10),
        O('sofa', 1, 10), O('coffee-table', 2, 11),
    ],
    tables=[], goods=[G('vase', 2, 11)],
    start=[10, 12],
    rooms=[dict(room='lobby', x0=0, y0=0, x1=19, y1=13)],
)

# ── 카페: 카운터(에스프레소·케이크 진열) · 창가 바 의자 · 둥근 탁자 ──
EX['cafe'] = dict(
    name='도쿄풍 카페', kind='cafe',
    plan=['################',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#...........####',
          '#####..#########'],
    floor='mci-wood-dark', wall='mci-wall-brick', exitWidth=2,
    zones=[],
    objects=[
        O('menu-board', 2, 1), O('wall-clock', 6, 1), O('window-city', 9, 1), O('window-city', 12, 1),
        O('coffee-station', 1, 3), O('fridge', 3, 3), O('plant-tall', 14, 3),
        O('pastry-case', 5, 5),
        O('bar-stool', 9, 4), O('bar-stool', 11, 4), O('bar-stool', 13, 4),
        O('cafe-chair-e', 8, 7), O('cafe-table', 9, 7), O('cafe-chair-w', 10, 7),
        O('cafe-chair-e', 12, 7), O('cafe-table', 13, 7), O('cafe-chair-w', 14, 7),
        O('armchair', 1, 8), O('cafe-table', 2, 8), O('armchair', 3, 8),
        O('plant-tall', 11, 9),
    ],
    tables=[T('t-counter', 1, 5, 4, 1), T('t-wood', 9, 3, 5, 1)],
    goods=[G('coffee', 1, 5), G('register', 3, 5), G('vase', 13, 7), G('coffee', 9, 7), G('coffee', 10, 3)],
    start=[5, 9],
    rooms=[dict(room='cafe', x0=0, y0=0, x1=15, y1=10)],
    narrow=[dict(x0=1, y0=4, x1=4, y1=4, why='카운터 뒤 직원 길')],
)

# ── 은행 창구 ──
EX['bank'] = dict(
    name='도쿄풍 은행 지점', kind='bank',
    plan=['##################',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '####..........####',
          '#######....#######'],
    floor='mci-stone-lobby', wall='mci-wall-lobby', exitWidth=4,
    zones=[],
    objects=[
        O('wall-clock', 3, 1), O('art-frame', 8, 1), O('notice-board', 14, 1),
        O('filing', 1, 3), O('shelf-office', 14, 3), O('chair-office-s', 5, 4), O('chair-office-s', 8, 4), O('chair-office-s', 11, 4),
        O('teller', 4, 5), O('teller', 10, 5),
        O('planter', 4, 8), O('planter', 11, 8),
        O('wait-bench', 1, 9), O('wait-bench', 13, 9), O('plant-tall', 16, 6), O('plant-tall', 1, 6),
    ],
    tables=[T('t-counter', 7, 5, 3, 1)],
    goods=[G('papers', 8, 5)],
    start=[8, 10],
    rooms=[dict(room='bank', x0=0, y0=0, x1=17, y1=11)],
)

# ── 지하철 역 대합실 ──
EX['concourse'] = dict(
    name='도쿄풍 지하철 대합실', kind='station',
    plan=['####################',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#.#..............#.#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '#..................#',
          '########....########'],
    floor='mci-tile-concourse', wall='mci-wall-tile', exitWidth=4,
    zones=[],
    objects=[
        O('route-map', 2, 1), O('route-map', 7, 1), O('wall-clock', 11, 1), O('route-map', 15, 1),
        O('magazine', 1, 3), O('cooler', 3, 3), O('plant-tall', 5, 3),
        O('stairs-up', 15, 3),
        O('ticket-gate', 6, 6), O('ticket-gate', 9, 6), O('ticket-gate', 12, 6),
        O('bench-metal', 1, 8), O('bench-metal', 16, 8), O('bench-metal', 16, 10),
        O('tactile', 10, 8), O('tactile', 10, 9), O('tactile', 10, 10),
    ],
    tables=[], goods=[],
    start=[10, 10],
    rooms=[dict(room='concourse', x0=0, y0=0, x1=19, y1=11)],
)

# ── 물류 창고 ──
EX['warehouse'] = dict(
    name='도쿄풍 물류 창고', kind='warehouse',
    plan=['##################',
          '#................#',
          '#................#',
          '#................#',
          '#.......#........#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#................#',
          '#######...########'],
    floor='mci-concrete', wall='mci-wall-metal', exitWidth=3,
    zones=[],
    objects=[
        O('rack', 1, 3), O('rack', 4, 3), O('rack', 11, 3), O('rack', 14, 3),
        O('ac-wall', 8, 1),
        O('pallet', 2, 6), O('pallet', 3, 6), O('pallet', 12, 6), O('pallet', 15, 6), O('pallet', 16, 6),
        O('pallet', 1, 8), O('pallet', 16, 9), O('pallet', 14, 9),
    ],
    tables=[T('t-wood', 4, 7, 3, 1)],
    goods=[G('papers', 4, 7), G('phone', 6, 7)],
    start=[8, 9],
    rooms=[dict(room='warehouse', x0=0, y0=0, x1=17, y1=10)],
)


def write(render=False):
    os.makedirs(OUT, exist_ok=True)
    if render:
        sys.path.insert(0, HERE)
        from preview import render_room
        from PIL import Image
        os.makedirs('/tmp/mci-ex', exist_ok=True)
    bad = 0
    for k, ex in EX.items():
        json.dump(ex, open(os.path.join(OUT, k + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        if render:
            im, iss = render_room(ex)
            im.save(os.path.join(OUT, k + '.png'))
            im.resize((im.width * 3, im.height * 3), Image.NEAREST).save('/tmp/mci-ex/%s-x3.png' % k)
            print('%-15s %dx%d 문제 %d' % (k, im.width // 16, im.height // 16, len(iss)))
            for m in iss: print('   ✗', m)
            bad += len(iss)
    return bad


if __name__ == '__main__':
    sys.exit(1 if write('--render' in sys.argv) else 0)
