#!/usr/bin/env python3
"""한 번 실행한 변환 기록: v9-final3 한 장짜리 산출물 -> 키트의 roles.json · iconsets/fantasy · journeys/fantasy-5act.json.

원본 입력(커밋 cbdab2d47 의 design-map/v9-final/)이 있어야 다시 돌릴 수 있다. 키트를 쓰는 데는 필요 없다.
  python3 make_fantasy_assets.py --final3 <v9-final 폴더> --dump <장소·길 덤프 JSON>
덤프 JSON 은 fix4_build.install('final') + World() 직후의 M4.SITES / M4.ROUTES 를 적은 것이다(원본 흐름이 실제로 쓴 최종 목록).
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

KIT = Path(__file__).resolve().parent.parent
WM = KIT.parent
sys.path.insert(0, str(KIT / 'lib'))
os.environ['CITY_TAG'] = 'v8'

ROLES = [
    # id, cells, 한글 이름, 설명
    ('capital', (6, 6), '수도', '이중 성벽 대도시. 한 세계에 하나.'),
    ('fort_city', (4, 4), '성곽 도시', '성벽을 두른 큰 도시. 지역 거점.'),
    ('harbor_city', (5, 4), '항구 도시', '성곽 도시 + 부두(남쪽이 물가).'),
    ('castle', (3, 3), '성·요새', '관문 요새, 마왕성, 불꽃 요새 같은 3x3 성채.'),
    ('large_town', (3, 3), '큰 마을', '3x3 마을·농촌·항구 마을.'),
    ('village', (2, 2), '촌락', '2x2 작은 마을(기후·문화별 변형이 가장 많은 역할).'),
    ('camp', (2, 2), '야영지', '천막·오아시스 같은 임시 거처.'),
    ('tower_small', (1, 2), '작은 탑', '등대·마법사 탑·감시탑. 1x2.'),
    ('tower_great', (2, 4), '거대한 탑', '지평선에서도 보이는 2x4 탑.'),
    ('cave', (2, 2), '동굴', '던전 입구.'),
    ('ruin', (2, 2), '폐허', '묻힌 신전·피라미드·묘당 같은 2x2 유적.'),
    ('ruin_city', (4, 3), '폐허 도시', '무너진 옛 도시.'),
    ('shrine', (3, 3), '신전', '3x3 성지·신전.'),
    ('landmark_nature', (3, 3), '자연 랜드마크', '거목 같은 3x3 자연물.'),
    ('circle', (2, 2), '돌원', '고대 돌 원·제단 원.'),
    ('volcano', (2, 2), '화산', '분화구와 용암 줄기.'),
    ('floating', (5, 4), '떠 있는 땅', '천공섬. 바다 위에 뜨고 그림자가 바다에 진다.'),
]
# 장소 id -> 역할
PLACE_ROLE = {
    '대성': 'capital', '강가 마을': 'large_town', '내해 항구': 'harbor_city', '설원 마을': 'large_town', '눈 촌락': 'village',
    '고원 마을': 'village', '산기슭 동굴': 'cave', '사막 촌락': 'village', '사막 폐허': 'ruin', '정글 마을': 'village',
    '고갯길 요새': 'castle', '해협 감시탑': 'tower_small', '화산': 'volcano', '화염 요새': 'castle', '사바나 마을': 'fort_city',
    '오아시스 촌락': 'camp', '협곡 폐허': 'ruin', '북동 눈 촌락': 'village', '동쪽 항구': 'large_town', '독늪 탑': 'tower_small',
    '섬 동굴': 'cave', '섬 탑': 'tower_small', '남섬 마을': 'village', '섬 폐허': 'ruin', '북섬 촌락': 'camp',
    '거대한 탑': 'tower_great', '폐허 도시': 'ruin_city', '거목': 'landmark_nature', '사막 신전': 'shrine', '고대 돌원': 'circle',
    '천공섬': 'floating',
}
ICON_ROLE = {
    'castle_dark': 'castle', 'castle_dark_grand': 'capital', 'town_bell': 'large_town', 'town_red': 'large_town', 'town_snow': 'large_town',
    'village_wood': 'village', 'village_snow': 'village', 'city_capital': 'capital', 'city_fort': 'fort_city', 'city_harbor': 'harbor_city',
    'sky_island': 'floating', 'giant_tower': 'tower_great', 'ruined_city': 'ruin_city', 'giant_tree': 'landmark_nature',
    'desert_temple': 'shrine', 'stone_circle': 'circle', 'lighthouse': 'tower_small', 'witch_tower': 'tower_small', 'mage_spire': 'tower_small',
    'cave_rock': 'cave', 'cave_vine': 'cave', 'igloo_camp': 'village', 'mine_town': 'village', 'tent_camp': 'camp', 'monastery': 'village',
    'adobe_village': 'village', 'treehouse_village': 'village', 'oasis_camp': 'camp', 'stilt_village': 'village', 'windmill_farm': 'large_town',
    'harbor_town': 'large_town', 'log_village': 'large_town', 'pass_fortress': 'castle', 'flame_fortress': 'castle',
    'desert_colonnade': 'ruin', 'stepped_pyramid': 'ruin', 'crypt': 'ruin', 'volcano_altar': 'volcano',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--final3', required=True)
    ap.add_argument('--dump', required=True)
    ap.add_argument('--orig-chipset', default='')
    a = ap.parse_args()
    F = Path(a.final3)
    ext = json.loads((F / 'ext-v9-final3.json').read_text())
    dump = json.loads(Path(a.dump).read_text())
    role_cells = {r[0]: r[1] for r in ROLES}

    # 1) roles.json + 레거시 매핑
    legacy = []
    icons = []
    for m in ext['icons']:
        role = ICON_ROLE[m['name']]
        fits = tuple(m['cells']) == role_cells[role]
        legacy.append(dict(icon=m['name'], role=role, cells=m['cells'], role_cells=list(role_cells[role]), fits=fits, origin=m['origin']))
        icons.append(dict(role=role, name=m['name'], cells=m['cells'], col=m['col'], row=m['row'], desc=m['desc']))
    roles = dict(schema='worldmap-roles/1', tile=16,
                 note='아이콘 세트는 이 17개 역할을 이 칸 수대로 채운다. 지형은 장소 발자국(칸 수)에 맞춰 만들어지므로 칸 수가 다르면 지도가 어긋난다.',
                 roles=[dict(id=r[0], cells=list(r[1]), name=r[2], desc=r[3]) for r in ROLES],
                 legacy_fantasy=legacy)
    (KIT / 'roles.json').write_text(json.dumps(roles, ensure_ascii=False, indent=1))

    # 2) 아이콘 세트 fantasy
    out = WM / 'iconsets' / 'fantasy'
    shutil.copyfile(F / 'ext-v9-final3.png', out / 'sheet.png')
    sheet = np.array(Image.open(out / 'sheet.png').convert('RGB'), np.uint8)
    cols = {tuple(c) for c in sheet.reshape(-1, 3)}
    base_cols = set()
    if a.orig_chipset:
        base_cols = {tuple(c) for c in np.array(Image.open(a.orig_chipset).convert('RGB')).reshape(-1, 3)}
    key = (255, 103, 139)
    extra = sorted(c for c in cols if c not in base_cols and c not in (key, (254, 103, 139)))
    pins = {s[0]: s[2] for s in dump['sites']}
    pins['천공섬'] = dump['sky'][1]
    manifest = dict(id='fantasy', name='판타지 (기본)', tile=16, key=list(key), sheet='sheet.png',
                    shadow_key=[254, 103, 139],
                    extra_colors=['%02x%02x%02x' % c for c in extra],
                    icons=icons, pins=pins,
                    license='CC BY 4.0 — EasyRPG RTP World(easyrpg-chipset-world.png) 파생 도트. tiledata/worldmap-kit/ATTRIBUTION.md 참조')
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    # 3) 여정 템플릿
    import journey_plan_v9 as P
    import journey_world_v9 as J
    gname = {v: k for k, v in dump['ground_names'].items()}
    sky = dump['sky']
    pl = {p[0]: p for p in P.PLACES}
    seq = {p[0]: i for i, p in enumerate(P.PLACES)}
    places = []
    for s in dump['sites']:
        name, _, _icon, x, y, g, kind, note = s
        act, func, story = pl[name][1], pl[name][2], pl[name][3]
        places.append(dict(id=name, role=PLACE_ROLE[name], x=x, y=y, ground=gname.get(g) if g is not None else None, kind=kind,
                           act=act, function=func, story=story, note=note, seq=seq[name]))
    w, h = role_cells['floating']
    places.append(dict(id='천공섬', role='floating', x=sky[2], y=sky[3], ground=None, kind='sky', act=pl['천공섬'][1], function=pl['천공섬'][2],
                       story=pl['천공섬'][3], note=sky[4], seq=seq['천공섬']))
    tmpl = dict(
        schema='worldmap-journey/1', id='fantasy-5act', name='판타지 5막 여정', terrain='shared-v9',
        desc='서부 대륙에서 시작해 통행증 → 범선 → 사막선 → 비공정으로 장벽 4개를 차례로 넘어 천공섬에 닿는 5막 여정. 아이콘 id 없이 역할 id 로만 장소를 가리킨다.',
        terrain_bound_note='places[].id 와 roads[] 의 끝점 이름은 공용 지형 코드(경사로·늪·사구 후처리)가 이름으로 참조한다. 표시 이름을 바꾸려면 label 을 쓰고 id 는 두어라.',
        acts=[dict(id=a_['id'], name=a_['name'], means=a_['means'], color=a_['color']) for a_ in J.ACTS],
        means={k: dict(name=v['name'], source=v['source'], barrier=v['barrier'], act=P.MEANS_SOURCE[k][1]) for k, v in J.MEANS.items()},
        barriers=[
            dict(id='mount_wall', name='중앙 산줄기', means='pass', gate='고갯길 요새', desc='북쪽 해안에서 내해까지 끊김 없는 산벽. 유일한 틈이 관문 요새(통행증 필요).'),
            dict(id='sea', name='서·동 대륙 사이 바다', means='ship', gate='내해 항구', desc='걸어서 못 건너는 바다. 항구에서 범선을 탄다.'),
            dict(id='dune_sea', name='서남 대사막(사구 바다)', means='skiff', gate='사막 촌락', desc='걸어서 못 건너는 사구. 사막선으로만 건넌다. 폐허·신전·고원은 그 안의 섬.'),
            dict(id='sky', name='하늘', means='air', gate='사막 신전', desc='천공섬은 바다 위 발판. 비공정으로만 닿는다.'),
        ],
        start=dict(place=P.START_PLACE, cell=list(J.START)),
        final=P.FINAL, crisis=list(P.CRISIS),
        places=places,
        roads=[dict(id=r[0], **{'from': r[1], 'to': r[2]}, via=r[3]) for r in dump['routes']],
        terrain_nodes=dict(ramps=[dict(id=r[0], x=r[1], upper=r[2], min_y=r[3]) for r in dump['ramps']],
                           note='경사로는 공용 지형이 만든다. roads 의 끝점으로 쓸 수 있다.'),
        main_line=[dict(place=n, event=e) for n, e in P.MAIN_LINE],
        leg_stage=[[a_, b_, st] for (a_, b_), st in P.LEG_STAGE.items()],
        entries=dict(ship=sorted(P.SHIP_ENTRY), skiff=sorted(P.SKIFF_ENTRY)),
        checks=dict(must_not_walk=['정글 마을', '거대한 탑', '고대 돌원', '사막 신전', '사막 폐허', '해협 감시탑', '화산', '천공섬', '오아시스 촌락'],
                    opening_must_see=['고갯길 요새', '내해 항구'], opening_far=['거대한 탑']),
    )
    (WM / 'journeys' / 'fantasy-5act.json').write_text(json.dumps(tmpl, ensure_ascii=False, indent=1))
    print('roles', len(ROLES), 'icons', len(icons), 'places', len(places), 'roads', len(tmpl['roads']), 'extra colors', len(extra),
          'unfit', [l['icon'] for l in legacy if not l['fits']])


if __name__ == '__main__':
    main()
