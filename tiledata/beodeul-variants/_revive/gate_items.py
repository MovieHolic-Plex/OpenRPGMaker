# 3/4 관문 묶음: 네 장소 스크립트가 새로 찍은 조각(parts/*.png, 땅·오토타일·절벽 앞면 제외)을 종류와 함께 items.jsonl 로.
import os, json, re
VAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = [  # (정규식, kind)
    (r'fog|cobweb|icicles|tracks|trail|ivy|ash_scatter|ember|pumice|burnt_grass|drygrass|nettles|weeds|pave_|frozen_grass|snow_patch|scree|crack|fumarole', 'flat'),
    (r'bone|rubble|debris|tile_debris|rockfall|beams_charred|crate_broken|barrel_broken|sack_torn|bucket|bell_fallen|fence_fallen|marker_fallen|crows_ground|log_bundle|charred_log|bench_broken|cart_overturned|stall_collapsed|ore_heap|coal_heap|lava_bomb|steam|smoke|sulfur_crystals|mound|cooled|ice_floe|ice_shards|pressure_ridge|beast_ribs|beast_skull|mammoth_ribs|mammoth_skull|tusk_single|fur_pile|supply|firewood|woodpile|sacks', 'debris'),
    (r'tree|snag|stump|sapling|bush|fir_|juniper|reeds|crops|rock|boulder|crag|outcrop|obsidian|basalt_columns|serac|ice_pillar|drift|cairn|frozen_bush|sulfur_vent|lava_pool|crater|mountain|lava_fall|icefall', 'organic'),
    (r'house|church|gable|ruin|gate|tower|bastion|wall_|temple|crypt|cave|den|tent|windbreak|bridge|drawbridge|stairs|chasm|pier|glacier|tusk_arch|frozen_beast|step', 'structure'),
    (r'well|brazier|campfire|trough|forge|hearth|ore_cart|sled', 'container'),
    (r'rack|tripod|crow_post|scarecrow|stall', 'frame'),
    (r'lamppost|torch|post|marker|waymark|cross|tomb|grave|notice|cairn_spear|guardian', 'column'),
    (r'anvil|grindstone|barrel_tipped|tool', 'other'),
    (r'skeleton', 'debris'),
]
def kind(n):
    for rx, k in RULES:
        if re.search(rx, n): return k
    return 'other'
out = []
for place in ('volcano-field', 'ruined-village', 'ice-age-field', 'mountain-fortress'):
    d = os.path.join(VAR, place, 'parts')
    for f in sorted(os.listdir(d)):
        n = f[:-4]
        if n.startswith(('autotile-', 'ground-', 'face_')) or not f.endswith('.png'): continue
        out.append(dict(png=os.path.join(d, f), kind=kind(n), name=n.replace('_', ' '), label=f'beodeul_city/wave-places/{place}/{n}'))
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gate-items.jsonl'), 'w').write('\n'.join(json.dumps(o, ensure_ascii=False) for o in out) + '\n')
from collections import Counter
print(len(out), Counter(o['kind'] for o in out))
