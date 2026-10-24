"""Blind sheet for one stage across species: every candidate sprite from the latest harness run of each species,
shuffled and numbered. Shows 4x and 1x, optionally with the picked previous stage at the left of each row.
usage: SB=<sandbox> python3 stage_sheet.py <out-prefix> <species...>   -> <out-prefix>.png + <out-prefix>-key.json"""
import sys, os, json, glob, random
from PIL import Image, ImageDraw
SB = os.environ['SB']; out = sys.argv[1]; species = sys.argv[2:]
random.seed(os.environ.get('SEED', out))
ledger = json.load(open(f'{SB}/data/ledger.json')) if os.path.exists(f'{SB}/data/ledger.json') else {'picks': {}}
seed = {s['id']: s for s in json.load(open(f'{SB}/data/seed.json'))['species']}
items = []
for sp in species:
    run = sorted(glob.glob(f'{SB}/runs/{sp}/front/*/run.json'))[-1]
    r = json.load(open(run)); d = os.path.dirname(run)
    for c in r['candidates']:
        items.append({'species': sp, 'run': os.path.basename(d), 'k': c['k'], 'sprite': f"{d}/{c['sprite']}", 'eye': c.get('eye'), 'issues': [i['message'] for i in c['issues'] if i['level'] == 'error']})
random.shuffle(items)
def prev_sprite(sp):
    p = seed[sp].get('evolvesFrom')
    if not p: return None
    f = f'{SB}/bundle/{p}/front.png'
    if os.path.exists(f): return Image.open(f).convert('RGBA')
    g = ledger['picks'].get(p, {}).get('front')
    return None
cols = 4; cw = 256 + 64 + 24; rh = 256 + 30
S = Image.new('RGB', (cols*cw, ((len(items)+cols-1)//cols)*rh), (200, 222, 190)); d = ImageDraw.Draw(S)
for i, it in enumerate(items):
    x, y = (i % cols)*cw, (i//cols)*rh
    a = Image.open(it['sprite']).convert('RGBA')
    S.paste(a.resize((256, 256), Image.NEAREST), (x+4, y+24), a.resize((256, 256), Image.NEAREST))
    S.paste(a, (x+264, y+24+192), a)
    pv = prev_sprite(it['species'])
    if pv: S.paste(pv, (x+264, y+24+100), pv)
    d.text((x+6, y+6), f'#{i+1}', fill=(0, 0, 0))
S.save(f'{out}.png')
json.dump({str(i+1): it for i, it in enumerate(items)}, open(f'{out}-key.json', 'w'), indent=1, ensure_ascii=False)
print(len(items), 'candidates ->', f'{out}.png')
