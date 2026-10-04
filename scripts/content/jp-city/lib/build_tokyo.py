"""도쿄 지구 확장 v2: build 위에 부품을 더 등록한다 (게이트 통과본)."""
import sys
import jpenv
from build import *
import build as B
import parts_tokyo as T
import parts_vehicles as V
import v2temple as TP, v2misc as M2, v2props as PR, parts_signs as SG
def _all(w): return tuple(range(w))

for n_, cv in (*[(f'zeb_d{k}', T.diag_cell(k)) for k in range(-3, 4)], ('pave_a', T.pave_cell('a')), ('pave_b', T.pave_cell('b')), ('lawn', T.lawn_cell()), ('sando', T.sando_cell('a')), ('sando_b', T.sando_cell('b')),
               ('plant_strip', T.curb_plant()), ('vz_n', T.vzebra('n')), ('vz_c', T.vzebra('c')), ('vz_s', T.vzebra('s')), ('rail', T.rail_cell())):
    STREET[n_] = add(f'st.{n_}', cv.a)
import parts_tokyo3 as T3
for nm, cv in (('water', T3.water_cell()), ('quay', T3.quay_cell())): STREET[nm] = add(f'st.{nm}', cv.a)

# 행인(Actor1 person.0~39)은 번들에서 제외 — 칸 번호를 지키려고 그 자리를 빈 칸으로 남긴다(tiledata/jp-city/people-reserve.json)
import json as _json
_PR = _json.load(open(jpenv.PEOPLE_RESERVE)); reserve_blank(_PR['cells'], _PR['start'])
for k, s_ in (('zelkova', 1), ('ginkgo', 2), ('sakura', 3)): reg_prop(f'tree.{k}', M2.tree_street(k, s_), (3, 4), '가로수(줄기 칸만 막힘)')
reg_prop('hachiko', M2.hachiko(), (0, 1), '하치코상(받침 막힘)')
reg_prop('metro_exit', M2.metro_entrance('出口'), (0, 1, 2, 3), '지하철 출입구')
reg_prop('arch_centergai', M2.arch_gate('センター街'), (0, 9), '보행자 거리 아치(아래 통과)')
reg_prop('viaduct6', M2.viaduct(6), (0, 1, 4, 5), 'JR 고가 6칸(기둥 막힘, 가운데 통과)')
reg_prop('ricksha_cart', M2.ricksha_cart(), (), '인력거 수레')
for n_, f in (('train8', lambda: V.train(8)), ('train10', lambda: V.train(10)), ('train10_b', lambda: V.train(10, 'sora')), ('train10_y', lambda: V.train(10, 'kii'))): reg_prop(n_, f(), (), '열차')
for col in ('white', 'silver', 'black', 'red', 'blue', 'taxi', 'green', 'navy'):
    reg_prop(f'car.{col}', V.car(col), (), '자동차'); reg_prop(f'car.{col}_r', V.car(col, flip=True), (), '자동차(반전)')
reg_prop('van.white', V.car('white', 'van'), (), '밴'); reg_prop('van.silver_r', V.car('silver', 'van', True), (), '밴(반전)')
reg_prop('bus', V.bus(), (), '버스'); reg_prop('bus_r', V.bus(True, 'sora'), (), '버스(반전)')
reg_prop('ad_truck', V.ad_truck(), (), '광고 트럭'); reg_prop('ad_truck_r', V.ad_truck(True), (), '광고 트럭(반전)')
reg_prop('kaminarimon', TP.kaminarimon(), (0, 1, 2, 3, 8, 9, 10, 11), '가미나리몬(가운데 통과)')
reg_prop('hozomon', TP.hozomon(), (0, 1, 2, 3, 10, 11, 12, 13), '호조몬(가운데 통과)')
reg_prop('pagoda5', TP.pagoda(), _all(6), '오층탑'); reg_prop('honden', TP.honden(18), _all(18), '본당')
for v in range(4):
    reg_prop(f'nakamise.{v}', TP.nakamise_stall(v), _all(5), '나카미세 점포')
    reg_prop(f'nakamise_back.{v}', TP.nakamise_stall(v, True), _all(5), '나카미세 점포 뒷면')
reg_prop('censer', TP.censer(), (0, 1, 2), '상향로'); reg_prop('chozuya', TP.chozuya(), (1, 2, 3, 4), '오미즈야')
reg_prop('lantern_post', TP.lantern_post(), (0,), '초롱 기둥'); reg_prop('stone_lantern', TP.stone_lantern(), (0,), '석등')
reg_prop('sanmon6', TP.sanmon(6), (0, 5), '산문(가운데 통과)'); reg_prop('string_lanterns4', TP.string_lanterns(4), (), '초롱 줄')
reg_prop('wall.tsuiji', PR.wall_tsuiji(), (0,), '築地塀'); reg_prop('wall.block', PR.wall_block(), (0,), '블록 담'); reg_prop('wall.hedge', PR.wall_hedge(), (0,), '생울타리')
reg_prop('wall.board', PR.wall_board(), (0,), '판자 담'); reg_prop('gate.iron', PR.gate_iron(), (0,), '철문'); reg_prop('gate.iron_open', PR.gate_iron(True), (), '열린 철문')
reg_prop('stairs_stone8', PR.stone_stairs(8, 4), (), '돌계단'); reg_prop('stairs_stone15', PR.stone_stairs(15, 5), (), '큰 돌계단')
reg_prop('iron_stair', PR.iron_stair(), (0, 1), '외부 철제 계단'); reg_prop('iron_stair_r', PR.iron_stair(True), (0, 1), '외부 철제 계단(반전)')
for k, (hh, sd) in enumerate(((8, 1), (10, 2), (6, 3), (8, 4))): reg_prop(f'neon_stack.{k}', PR.neon_stack(hh, sd), (0,), '세로 간판 적층')
reg_prop('barricade3', PR.barricade(3), (0, 1, 2), '이동식 방책'); reg_prop('cone', PR.cone(), (0,), '콘')
reg_prop('rack.0', PR.rack(0), (0, 1), '옷걸이 랙'); reg_prop('rack.1', PR.rack(1), (0, 1), '옷걸이 랙'); reg_prop('record_wagon', PR.record_wagon(), (0, 1), '레코드 웨건')
reg_prop('theatre_front8', PR.theatre_front(8), (), '소극장 정면 띠')
for k in range(4): reg_deco(f'vision.{k}', SG.vision(k, 6, 4)); reg_deco(f'mural.{k}', SG.mural(k, 6, 4))
for k, (w, h) in enumerate(((8, 3), (10, 3), (6, 3))): reg_deco(f'facade_ad.{k}', SG.facade_ad(w, h, k))

import oldfix
oldfix.apply(sys.modules['build'])

for _m in ('parts_new_a', 'parts_new_b'):
    try:
        import importlib; importlib.import_module(_m).register(reg_prop, reg_deco, add, STREET)
    except ModuleNotFoundError as e:
        if e.name != _m: raise
