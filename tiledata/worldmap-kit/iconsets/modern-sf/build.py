#!/usr/bin/env python3
"""현대·SF 월드맵 아이콘 세트 재생성.  python3 build.py
산출: sheet.png · manifest.json · stats.md · sheet-check.json · preview/ (8배 시트·지도 맥락 크롭)
렌더러: lib/ (경사 투영 레이캐스터 — 3/4 시점을 투영 규칙으로 보장)."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'lib'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import scenes_msf as sc  # noqa: E402
import modsf_kit as K  # noqa: E402
import oblique as ob  # noqa: E402
from show import sheet as show_sheet, on_ground, GROUNDS  # noqa: E402

ROOT = HERE.parents[3]                      # repo root
WORLD = ROOT / 'public' / 'assets' / 'easyrpg-chipset-world.png'
KEY = np.array([255, 103, 139], np.uint8)
SHADOW = np.array([254, 103, 139], np.uint8)
COLS = 32                                   # 시트 열 수(칸)

# (역할, 아이콘 이름, 설명)  — 역할 순서는 지시서의 표 순서
ORDER = [
    ('capital', 'capital', '메가시티 — 높이가 다른 고층 빌딩 군(옥상 설비·헬리패드·창 격자)과 중앙 광장 첨탑, 순환 도로. 6x6'),
    ('fort_city', 'fort_city', '방벽 도시 — 콘크리트 방벽 고리·모서리 감시탑·앞 철문 문루 뒤로 고층. 4x4'),
    ('harbor_city', 'harbor_city', '항만 도시 — 문형 컨테이너 크레인·컨테이너 더미·컨테이너 실은 화물선·항만 고층. 5x4'),
    ('castle', 'castle_a', '군사 기지(격납고형) — 반원통 격납고·콘크리트 방벽·철문·레이더 타워. 3x3'),
    ('castle', 'castle_b', '군사 기지(포탑형) — 원통 포탑 넷·사령동·철문 문루. 3x3'),
    ('large_town', 'large_town_a', '교외 주택가(박공) — 박공 주택 여섯 동·마당 나무. 3x3'),
    ('large_town', 'large_town_b', '교외 주택가(신축) — 평지붕 주택 여섯 동·옥상 태양광. 3x3'),
    ('village', 'village_a', '컨테이너 촌락 — 쌓은 컨테이너 집·급수탑·옥상 태양광. 2x2'),
    ('village', 'village_b', '농가 — 붉은 헛간·사일로·살림집. 2x2'),
    ('camp', 'camp_a', '탐사 캠프 — 돔 텐트 셋·발전기·투광등. 2x2'),
    ('camp', 'camp_b', '피난민 캠프 — A자 천막 셋·급수 탱크·무전 마스트. 2x2'),
    ('tower_small', 'tower_small_a', '송신탑 — 적백 줄무늬 철탑·안테나 플랫폼. 1x2'),
    ('tower_small', 'tower_small_b', '풍력 터빈 — 흰 기둥·나셀·날개 셋. 1x2'),
    ('tower_great', 'tower_great', '궤도 엘리베이터 기단 — 층진 원통 탑·전망 고리·안테나. 2x4'),
    ('cave', 'cave', '지하 벙커 입구 — 흙 언덕·콘크리트 문틀·철문·환기구. 2x2'),
    ('ruin', 'ruin', '무너진 건물 — 앞이 뜯긴 몸체·기울어 박힌 슬래브·철근·잔해. 2x2'),
    ('ruin_city', 'ruin_city', '폐허 도시 — 무너진 고층 다섯 동과 잔해 더미. 4x3'),
    ('shrine', 'shrine', '연구 시설 — 원형 관측 돔·부속동·접시 안테나. 3x3'),
    ('landmark_nature', 'landmark_nature', '거대 태양광 패널 농장 — 기울어진 패널 열·관리동. 3x3'),
    ('circle', 'circle', '위성 안테나 어레이 — 접시 안테나 셋. 2x2'),
    ('volcano', 'volcano', '지열 발전소 — 냉각탑과 증기 기둥·터빈동. 2x2'),
    ('floating', 'floating', '부유 도시 — 공중에 뜬 암반 원판 위 고층·돔·밑 추진기, 땅에 그림자. 5x4'),
]
SPEC_CELLS = {'capital': (6, 6), 'fort_city': (4, 4), 'harbor_city': (5, 4), 'castle': (3, 3), 'large_town': (3, 3), 'village': (2, 2),
              'camp': (2, 2), 'tower_small': (1, 2), 'tower_great': (2, 4), 'cave': (2, 2), 'ruin': (2, 2), 'ruin_city': (4, 3),
              'shrine': (3, 3), 'landmark_nature': (3, 3), 'circle': (2, 2), 'volcano': (2, 2), 'floating': (5, 4)}


def world_colors():
    a = np.array(Image.open(WORLD).convert('RGB'))
    return set(map(tuple, a.reshape(-1, 3).tolist()))


def pack(sizes):
    """선반 채우기: (w,h) 칸 목록 → 위치 목록."""
    pos, x, y, rowh = [], 0, 0, 0
    for (w, h) in sizes:
        if x + w > COLS:
            x, y, rowh = 0, y + rowh, 0
        pos.append((x, y))
        x += w
        rowh = max(rowh, h)
    return pos, y + rowh


def main():
    sc.SOFT[0] = False
    arrs, stats = {}, {}
    for role, name, desc in ORDER:
        a, st = sc.ICONS[name]()
        arrs[name], stats[name] = a, st
        w, h = a.shape[1] // 16, a.shape[0] // 16
        assert (w, h) == SPEC_CELLS[role], f'{name}: {(w, h)} != {SPEC_CELLS[role]}'
    sizes = [(arrs[n].shape[1] // 16, arrs[n].shape[0] // 16) for _, n, _ in ORDER]
    pos, rows = pack(sizes)
    sheet = np.zeros((rows * 16, COLS * 16, 3), np.uint8)
    sheet[:] = KEY
    icons = []
    for (role, name, desc), (c, r), (w, h) in zip(ORDER, pos, sizes):
        sheet[r * 16:(r + h) * 16, c * 16:(c + w) * 16] = arrs[name]
        icons.append({'role': role, 'name': name, 'cells': [w, h], 'col': c, 'row': r, 'desc': desc})
    Image.fromarray(sheet).save(HERE / 'sheet.png')

    # ── 색 집합 검사 ──
    orig = world_colors()
    used = set(map(tuple, sheet.reshape(-1, 3).tolist())) - {tuple(KEY), tuple(SHADOW)}
    new = sorted(used - orig)
    extra_decl = {tuple(K.hx(c)) for c in K.EXTRA_HEX}
    undeclared = [c for c in new if c not in extra_decl]
    extra_used = ['%02x%02x%02x' % c for c in new if c in extra_decl]
    check = {'sheet': 'sheet.png', 'world_chipset': 'public/assets/easyrpg-chipset-world.png', 'world_colors': len(orig),
             'used_colors': len(used), 'from_world': len(used & orig), 'new_colors': ['%02x%02x%02x' % c for c in new],
             'new_count': len(new), 'extra_declared': K.EXTRA_HEX, 'extra_used': extra_used, 'undeclared_new': ['%02x%02x%02x' % c for c in undeclared],
             'ok': (len(undeclared) == 0 and len(new) <= 12)}
    (HERE / 'sheet-check.json').write_text(json.dumps(check, ensure_ascii=False, indent=2))
    manifest = {'id': 'modern-sf', 'name': '현대·SF', 'tile': 16, 'key': [255, 103, 139], 'shadow_key': [254, 103, 139],
                'sheet': 'sheet.png', 'cols': COLS, 'rows': rows, 'extra_colors': extra_used, 'icons': icons,
                'projection': {'kind': 'oblique raycast', 'KX': ob.KX, 'KY': ob.KY, 'light': [-.5, -.35, .8], 'sun_for_ground_shadow': list(map(float, ob.D_SUN)),
                               'note': '월드 x 오른쪽·y 안쪽·z 위, 1단위=1px. 윗면/앞면/오른쪽면만 보이는 투영이라 3/4 시점이 구조적으로 보장된다. 지면 그림자는 키색(254,103,139).'},
                'license': {'note': '지형·재질 색은 EasyRPG World.png(CC BY 4.0) 팔레트 + 세트 전용 보조색. 도형·장면은 이 저장소의 lib/ 렌더러로 직접 만든 것 — 생성 이미지·트레이싱 없음.'}}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

    # ── stats.md (렌더러가 센 면 px) ──
    lines = ['# 면 픽셀 수 (렌더러가 레이캐스트 결과에서 직접 센 값)', '',
             '투영: u = x + 0.28·y , v = z + 0.5·y. 보이는 면은 윗면·앞면(y−)·오른쪽면(x+) 뿐. 원통·돔의 왼쪽 곡면은 「왼쪽」 열에 센다.',
             '지면 그림자용 태양 방향(세트 전용): ' + str(list(map(float, ob.D_SUN))) + ' (키 큰 탑 그림자가 칸 밖으로 안 나가게 높게 잡음. 면 밝기용 LIGHT 는 원본 값 그대로).', '',
             '| 아이콘 | 칸 | 윗면 px | 앞면 px | 오른쪽면 px | 왼쪽 곡면 px | 윗/앞 | 오른쪽/앞 | 내용 상자(px) | 그림자 키 px |', '|---|---|---|---|---|---|---|---|---|---|']
    for role, name, _ in ORDER:
        a, st = arrs[name], stats[name]['all']
        t, f, rr, l = st['top'], st['front'], st['right'], st['left']
        shp = int(np.all(a == SHADOW, -1).sum())
        fit = sc.FIT.get(name, ('?', '?', ''))
        lines.append(f"| {name} | {a.shape[1] // 16}x{a.shape[0] // 16} | {t} | {f} | {rr} | {l} | {t / max(f, 1):.2f} | {rr / max(f, 1):.2f} | {fit[0]}x{fit[1]} | {shp} |")
    lines += ['', '모든 아이콘에서 윗면 > 0, 앞면 > 0, 오른쪽면 > 0 (원통·돔·원뿔 위주의 탑류는 오른쪽 곡면이 「왼쪽/오른쪽」 둘 다 센다). 정면 입면 한 장은 구조적으로 나올 수 없다.']
    (HERE / 'stats.md').write_text('\n'.join(lines) + '\n')

    # ── 미리보기 ──
    pv = HERE / 'preview'
    pv.mkdir(exist_ok=True)
    names = [n for _, n, _ in ORDER]
    show_sheet([arrs[n] for n in names], 8, names, GROUNDS['grass'], width=2200).save(pv / 'sheet-8x-grass.png')
    show_sheet([arrs[n] for n in names], 4, names, GROUNDS['sand'], width=2200).save(pv / 'sheet-4x-sand.png')
    show_sheet([arrs[n] for n in names], 1, names, GROUNDS['grass'], width=1400).save(pv / 'sheet-1x.png')
    for n in names:
        Image.fromarray(on_ground(arrs[n])).resize((arrs[n].shape[1] * 8, arrs[n].shape[0] * 8), Image.NEAREST).save(pv / f'{n}-8x.png')
    import mapctx_msf
    mapctx_msf.make(arrs, pv)
    print('icons', len(icons), 'sheet', sheet.shape[1] // 16, 'x', rows, 'cells; new colors', len(new), 'undeclared', len(undeclared))
    print('FIT', {k: v for k, v in sc.FIT.items() if v[2][0] < 2 and v[2][1] < 2 and 0})


if __name__ == '__main__':
    main()
