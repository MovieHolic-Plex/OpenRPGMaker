# 마을 종류 표(kinds1.py 외딴 마을 · kinds2.py 마을·읍) → src/assets/beodeulVillageKinds.json.
#   bun scripts/content/beodeul-village-kinds/listKits.mts > /tmp/kits.tsv
#   python3 scripts/content/beodeul-village-kinds/build.py src/assets/beodeulVillageKinds.json /tmp/kits.tsv [아직 굽지 않은 킷 목록 IDS.md]
# 킷 id 를 지금 타일셋(kits.tsv)과 아직 굽지 않은 목록(IDS.md — 없어도 된다)에 맞춰 보고, 어디에도 없는 id · 한 장면 안에서 겹치는 조각이 있으면 멈춘다.
import json, re, sys
from kinds1 import HAMLETS
from kinds2 import VILLAGES, TOWNS
have = {}
for line in open(sys.argv[2]):
    f = line.rstrip('\n').split('\t')
    if f[0].startswith('bd-'): have[f[0]] = tuple(map(int, f[1].split('x')))
soon = {}
for line in (open(sys.argv[3]) if len(sys.argv) > 3 else []):
    m = re.match(r'^\| `(bd-obj-[^`]+)` \| [^|]+ \| (\d+)×(\d+) \| ([^|]+) \|', line)
    if m and 'DROPPED' not in line: soon[m.group(1)] = ((int(m.group(2)), int(m.group(3))), '물 위' in m.group(4))
# 공통 기물(종류와 무관한 59종)은 자리 규칙으로 쓴다: 간판 = 일터·집 문 옆, 등 = 길모퉁이, 살림 = 집 발치 줄(종류마다 둘씩 돌려 가며).
SIGNS = {"fishing-cove": ["fish"], "waystation": ["stable"], "smithy-village": ["smith"], "market-village": ["item", "bakery"], "weavers": ["tailor"], "ranch": ["stable"], "brewers": ["item"],
         "harbour-town": ["fish", "item"], "market-town": ["bank", "item", "bakery"], "guild-town": ["bakery", "tailor", "item", "magic"], "scholar-town": ["magic", "item"],
         "garrison-town": ["weapon", "armour"], "canal-town": ["item", "bank"], "hot-spring": ["item"], "herbalist": ["magic"], "border-post": ["weapon"], "festival": ["bakery"]}
LAMPS = {"hamlet": ["torch-post", "lantern-ground"], "village": ["lamp-hanging-pole", "torch-post"], "town": ["lamp-twin-stone", "lamp-hanging-pole"]}
HOUSEHOLD = "rain-barrel stepladder baskets-stack hamper coal-bin wash-stand post-box bird-table dog-bowl-post cat-barrel planter-hanging planter-tiered planter-window-herbs trellis-vine topiary stool-pair bench-barrel-plank handcart-empty cart-water cart-firewood birdcage-stand hand-bell-table trash-heap planter-cart bench-round-tree bench-arbour cart-pedlar planter-boat".split()
ANCH = {"work", "shore", "commons", "entry", "upper", "house", "behind", "road", "wild", "plaza"}
bad = []; out = []; stats = []
def size(i): return have.get(i) or (soon[i][0] if i in soon else None)
for k in HAMLETS + VILLAGES + TOWNS:
    scenes = []; complete = 0; waiting = 0
    for sid, ko, en, at, mn, spec in k['scenes']:
        assert at in ANCH, (k['id'], sid, at)
        pieces = []; now_ok = True; req = 0; cells = set()
        for tok in spec.split():
            m = re.match(r'^([?~]*)([^@]+)@(-?\d+),(-?\d+)$', tok); assert m, tok
            flags, ids, dx, dy = m.group(1), m.group(2).split('|'), int(m.group(3)), int(m.group(4))
            full = ['bd-' + i for i in ids]
            for i in full:
                if i not in have and i not in soon: bad.append(f"{k['id']}/{sid}: {i}")
            first = next((i for i in full if i in have), None)
            opt = '?' in flags; wat = '~' in flags
            if not opt and not wat:
                req += 1
                if not first: now_ok = False
            # 겹침 검사(그릴 수 있는 뭍 조각끼리) — 가장 큰 후보 크기로
            if not wat:
                szs = [size(i) for i in full if size(i)]
                if szs:
                    w = max(s[0] for s in szs); h = max(s[1] for s in szs)
                    mine = {(dx + i, dy - j) for i in range(w) for j in range(h)}
                    if mine & cells: bad.append(f"{k['id']}/{sid}: 겹침 {tok} {sorted(mine & cells)[:3]}")
                    cells |= mine
            if any(i not in have for i in full) : waiting += 1 if not first else 0
            pieces.append(tok)
        # 장면은 서너 ~ 여덟 가지: 꼭 있어야 하는 조각 셋 이상 여덟 이하 — 낱개·둘은 장면이 아니다
        assert 3 <= req <= 8 and 3 <= mn <= req, (k['id'], sid, req, mn)
        if now_ok: complete += 1
        scenes.append({"id": sid, "ko": ko, "en": en, "at": at, "min": mn, "pieces": pieces})
    for pool in ('home', 'waterPool', 'wild', 'work'):
        for i in k[pool]:
            if 'bd-' + i not in have and 'bd-' + i not in soon: bad.append(f"{k['id']}/{pool}: {i}")
    fit = {"water": k['water']}
    for f in ('tiers', 'woods'):
        if k.get(f): fit[f] = k[f]
    for f in ('walls', 'harbour', 'square'):
        if k.get(f): fit[f] = True
    n = len(out)
    extra = ["obj-" + HOUSEHOLD[(2 * n + j) % len(HOUSEHOLD)] for j in (0, 1)]
    signs = ["obj-sign-" + x for x in SIGNS.get(k['id'], [])]; lamps = ["obj-" + x for x in LAMPS[k['rank']]]
    for i in extra + signs + lamps:
        if 'bd-' + i not in have and 'bd-' + i not in soon: bad.append(f"{k['id']}/common: {i}")
    k = dict(k, home=k['home'] + [i for i in extra if i not in k['home']])
    out.append({"signs": signs, "lamps": lamps, "id": k['id'], "ko": k['ko'], "en": k['en'], "hint": k['hint'], "rank": k['rank'], "fit": fit, "gather": {"ko": k['gather'][0], "en": k['gather'][1]},
                "work": k['work'], "scenes": scenes, "home": k['home'], "water": k['waterPool'], "wild": k['wild']})
    stats.append((k['id'], k['rank'], len(scenes), complete, waiting))
if bad:
    print('\n'.join(bad)); sys.exit(1)
dst = sys.argv[1]
with open(dst, 'w') as f:
    f.write('{\n "note": "버들항 마을 종류 표. 조각 = [?곁들이][~물 위]킷|대안@dx,dy (bd- 를 뗀 id · 발 = 맨 아래 줄 왼쪽 칸). 고치는 곳: scripts/content/beodeul-village-kinds/ (build.py).",\n "kinds": [\n')
    f.write(',\n'.join('  ' + json.dumps(k, ensure_ascii=False) for k in out))
    f.write('\n ]\n}\n')
print(f"종류 {len(out)} · 장면 {sum(s[2] for s in stats)} · 지금 킷으로 필수 조각이 다 있는 장면 {sum(s[3] for s in stats)}")
for s in stats:
    if s[3] < s[2]: print(f"  {s[0]} ({s[1]}): 장면 {s[2]} 가운데 {s[3]} 만 지금 선다")
print('hint chars', sum(len(k['id']) + len(k['hint']) + 4 for k in out))
