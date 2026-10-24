"""Install the user-approved Astra starter lines (2026-10-24, astra-starters-5.html, "이제 괜찮네.. 이거로해") from the
round-4 sandbox onto the nine existing harness species, so campaign wiring (campaignSpeciesId) stays as is.
Copies raws into qa-runs (gitignored, same layout as harness runs), grids into harness-data, rewrites the ledger picks
(drops old authored/touch-up layers: the approved art is the untouched grid), updates seed design text, and records the
human approval with source + grid hashes. Then run: npm run harness -- monster-collect-species build.
usage: python3 install.py [--sb ~/astra-starters-wip/s4/sb]"""
import json, os, shutil, hashlib, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
SB = os.path.expanduser(sys.argv[sys.argv.index('--sb') + 1] if '--sb' in sys.argv else '~/astra-starters-wip/s4/sb')
DATA = os.path.join(ROOT, 'harness-data/monster-collect-species')
MAP = {'grass-a-1': 'leafling', 'grass-a-2': 'frondhare', 'grass-a-3': 'grovewarden',
       'fire-a-1': 'sparkit', 'fire-a-2': 'kilnclaw', 'fire-a-3': 'furnscale',
       'water-a-1': 'aqualing', 'water-a-2': 'brookraft', 'water-a-3': 'tidekeeper'}
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
sbl = json.load(open(f'{SB}/data/ledger.json'))['picks']
sbs = {s['id']: s for s in json.load(open(f'{SB}/data/seed.json'))['species']}
ledger = json.load(open(f'{DATA}/ledger.json')); seed = json.load(open(f'{DATA}/seed.json'))
byid = {s['id']: s for s in seed['species']}
for src, dst in MAP.items():
    entry = {}
    for side in ('front', 'back'):
        p = sbl[src][side]
        raw = p['sourcePath']; run = os.path.basename(os.path.dirname(raw))
        qdir = os.path.join(ROOT, 'qa-runs/harnesses/monster-collect-species', dst, side, f'astra4-{src}-{run}')
        os.makedirs(qdir, exist_ok=True)
        for f in os.listdir(os.path.dirname(raw)): shutil.copy2(os.path.join(os.path.dirname(raw), f), qdir)
        assert sha(os.path.join(qdir, os.path.basename(raw))) == p['sourceSha256'], (src, side)
        grid = f'grids/{dst}-{side}.png'; shutil.copy2(os.path.join(SB, 'data', p['grid']), os.path.join(DATA, grid))
        e = {k: v for k, v in p.items() if k not in ('authored', 'authoredSha256', 'previousAuthoredSha256', 'humanApproval')}
        e.update(grid=grid, sourcePath=os.path.relpath(os.path.join(qdir, os.path.basename(raw)), ROOT), sandboxSpecies=src)
        if side == 'front':
            e['humanApproval'] = dict(p['humanApproval'], gridSha256=sha(os.path.join(DATA, grid)))
        entry[side] = e
    ledger['picks'][dst] = entry
    for k in ('design', 'signature', 'accent', 'palette', 'types'):
        byid[dst][k] = sbs[src][k]
    if 'motion' in sbs[src]: byid[dst]['motion'] = sbs[src]['motion']
    else: byid[dst].pop('motion', None)
    print(dst, '<-', src, entry['front']['sourceSha256'][:12], entry['back']['sourceSha256'][:12])
seed['style']['avoid'] = list(dict.fromkeys(seed['style']['avoid'] + json.load(open(f'{SB}/data/seed.json'))['style']['avoid']))
json.dump(ledger, open(f'{DATA}/ledger.json', 'w'), ensure_ascii=False, indent=2); open(f'{DATA}/ledger.json', 'a').write('\n')
json.dump(seed, open(f'{DATA}/seed.json', 'w'), ensure_ascii=False, indent=2); open(f'{DATA}/seed.json', 'a').write('\n')
