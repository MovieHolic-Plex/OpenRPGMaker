# 산악 요새 조각 내보내기: parts/*.png(16 배수, 물체는 왼쪽 아래 정렬) + partmeta.json + parts.md. 새로 그린 조각만.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import numpy as np
import mfwl as wl
import mf_ground as G, mf_stone as S, mf_props as P
from mf_meta import META, FLOORS, FACES, AUTOS, CHASM
import mf_chasm

FN = {
 'stone_gate': S.stone_gate, 'gate_tower_a': lambda: S.gate_tower(False, False, False), 'gate_tower_b': lambda: S.gate_tower(True, True, True),
 'wall_4a': lambda: S.wall_seg(4, seed=2), 'wall_3': lambda: S.wall_seg(3, seed=6), 'wall_3_drain': lambda: S.wall_seg(3, seed=5, drain=True),
 'wall_end_w': lambda: P.wall_end(3, 'W', 1), 'wall_end_e': lambda: P.wall_end(4, 'E', 8), 'wall_rubble_end': S.wall_rubble_end,
 'rubble_pile': S.rubble_pile, 'bastion': lambda: S.bastion(0), 'wall_gatehouse': S.wall_gatehouse, 'drawbridge': S.drawbridge,
 'plank_bridge': S.plank_bridge, 'stairs_rock': S.stairs_rock, 'brazier_iron': S.brazier_iron, 'torch_post': S.torch_post,
 'forge_hearth': P.forge_hearth, 'anvil_block': P.anvil_block, 'quench_trough': P.quench_trough, 'tool_rack': P.tool_rack, 'grindstone': P.grindstone,
 'woodpile_tall': lambda: P.woodpile_tall(3, 281), 'woodpile_long': lambda: P.woodpile_tall(4, 283), 'log_bundle': P.log_bundle,
 'sacks_heap': P.sacks_heap, 'sacks_stack': P.sacks_stack, 'coal_heap': P.coal_heap, 'ore_heap': P.ore_heap, 'ore_cart': P.ore_cart, 'weapon_rack': P.weapon_rack,
 'crag_a': lambda: P.crag(0), 'crag_b': lambda: P.crag(1), 'outcrop': P.outcrop, 'snowrock_l': lambda: P.snowrock('l'), 'snowrock_m': lambda: P.snowrock('m'),
 'snowrock_s': lambda: P.snowrock('s'), 'boulders': P.boulders, 'rockfall': P.rockfall, 'scree_a': lambda: P.scree_mtn(0), 'scree_b': lambda: P.scree_mtn(1),
 'snow_patch_s': lambda: P.snow_patch(2, 1, 161), 'snow_patch_l': lambda: P.snow_patch(3, 2, 163), 'icicles': P.ice_icicles,
 'fir_snow_m': lambda: P.fir_snow(3, 171), 'fir_snow_l': lambda: P.fir_snow(4, 172), 'fir_snow_s': lambda: P.fir_snow(2, 173),
 'fir_dusted': P.fir_dusted, 'fir_dusted_b': lambda: P.fir_dusted(32, 48, 4, 185), 'fir_dusted_l': lambda: P.fir_dusted(48, 64, 5, 187),
 'juniper': P.juniper, 'dead_snag': P.dead_snag, 'cairn_mark': P.cairn_mark, 'waymarker': P.waymarker,
}

def tile3(fn, seed):
    return Image.fromarray(fn(48, 48, seed, per=(48, 48)), 'RGB').convert('RGBA')

def ground_scree():
    base = G.ground_rock()
    m = np.ones((48, 48), bool)
    lay = G.scree_layer(m, 61)
    # 이음새: 가장자리 3화소 자갈은 안쪽과 같은 밀도(주기 아님) — 표본이라 3x3 반복 시 점 무늬만 남는다
    base.alpha_composite(lay); return base

def face_fortwall():
    o = Image.new('RGBA', (48, 48)); px = o.load()
    for y in range(48):
        for x in range(48): px[x, y] = S.stone(x, y, seed=3) + (255,)
    return o

def export(IM, out):
    pr = wl.Parts(out)
    for name, (kind, ko, desc, rules, brows, layer, role) in META.items():
        img = IM.get(name) or FN[name]()
        pr.add(name, img, kind, ko, desc, rules, brows=brows, layer=layer, role=role)
    for name, (ko, desc, rules) in FLOORS.items():
        img = {'ground-rock': G.ground_rock, 'ground-gravel': G.ground_gravel, 'ground-snow': G.ground_snow, 'ground-scree': ground_scree}[name]()
        pr.add(name, img, 'floor', ko, desc, rules, role='terrain', pad=False)
    for name, (ko, desc, rules) in FACES.items():
        img = {'face_cliff': lambda: G.face_cliff(48, 3), 'face_fortwall': face_fortwall}[name]()
        pr.add(name, img, 'wall', ko, desc, rules, brows=img.height // 16, role='wall', pad=False)
    CP = mf_chasm.parts()
    for name, (ko, desc, rules) in CHASM.items():
        pr.add(name, CP[name], 'wall', ko, desc, rules, brows=4, layer='lower', role='wall', pad=False)
    for name, (ko, desc, layer, role, rules) in AUTOS.items():
        img = {'autotile-gravelpath': G.autotile_gravelpath, 'autotile-chasm': G.autotile_chasm, 'autotile-railing': G.autotile_railing}[name]()
        pr.add(name, img, 'autotile', ko, desc, rules, layer=layer, role=role, pad=False)
    return pr.finish('산악 요새·난쟁이 광산 정문 (mountain-fortress)')
