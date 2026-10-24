"""Stage-3 sheet with the full line: each row = picked stage 1, picked stage 2, then one stage-3 candidate, at 3x + 1x.
usage: SB=<sb> python3 line_sheet.py <out-prefix> <stage3-species>"""
import sys, os, json, glob, random
from PIL import Image, ImageDraw
SB = os.environ['SB']; out, sp3 = sys.argv[1], sys.argv[2]
random.seed(out)
seed = {s['id']: s for s in json.load(open(f'{SB}/data/seed.json'))['species']}
ledger = json.load(open(f'{SB}/data/ledger.json'))
def picked(sp):
    g = ledger['picks'][sp]['front']; src = g['sourcePath']; k = os.path.basename(src)[4:-4]
    return Image.open(os.path.join(os.path.dirname(src), f'sprite-{k}.png')).convert('RGBA')
sp2 = seed[sp3]['evolvesFrom']; sp1 = seed[sp2]['evolvesFrom']
s1, s2 = picked(sp1), picked(sp2)
run = sorted(glob.glob(f'{SB}/runs/{sp3}/front/*/run.json'))[-1]; d = os.path.dirname(run)
cands = [{'k': c['k'], 'run': os.path.basename(d), 'sprite': f"{d}/{c['sprite']}"} for c in json.load(open(run))['candidates']]
random.shuffle(cands)
rh = 192 + 20
S = Image.new('RGB', (3*200 + 3*70 + 50, rh*len(cands)), (200, 222, 190)); dr = ImageDraw.Draw(S)
for r, c in enumerate(cands):
    y = r*rh; dr.text((6, y+6), f'#{r+1}', fill=(0, 0, 0)); x = 40
    ims = [s1, s2, Image.open(c['sprite']).convert('RGBA')]
    for im in ims: b = im.resize((192, 192), Image.NEAREST); S.paste(b, (x, y+14), b); x += 200
    for im in ims: S.paste(im, (x, y+14+128), im); x += 70
S.save(f'{out}.png'); json.dump({str(i+1): c for i, c in enumerate(cands)}, open(f'{out}-key.json', 'w'), indent=1)
print(f'{out}.png', len(cands))
