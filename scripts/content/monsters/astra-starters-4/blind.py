"""blind review sheets per element: shuffled numbers, each row = stages 1-3 at 64px (3x) + 1x strip. key -> ~/astra-starters-wip/s4/blind-key.json"""
import glob, os, json, random
from PIL import Image, ImageDraw
OUT = os.path.expanduser('~/astra-starters-wip/s4/out'); W4 = os.path.expanduser('~/astra-starters-wip/s4')
random.seed(int(os.environ.get('SEED', '7')))
key = {}
for el in ['grass', 'fire', 'water']:
    tags = sorted({os.path.basename(p).split('-s')[0] for p in glob.glob(f'{OUT}/{el}*-s1-64.png')})
    random.shuffle(tags); key[el] = {str(i+1): t for i, t in enumerate(tags)}
    rowh = 64*3+16
    S = Image.new('RGB', (3*(64*3+12) + 3*70 + 60, rowh*len(tags)), (200, 222, 190)); d = ImageDraw.Draw(S)
    for r, t in enumerate(tags):
        y = r*rowh; d.text((6, y+6), f'#{r+1}', fill=(0, 0, 0)); x = 40
        for st in (1, 2, 3):
            a = Image.open(f'{OUT}/{t}-s{st}-64.png'); S.paste(a.resize((192, 192), Image.NEAREST), (x, y+8), a.resize((192, 192), Image.NEAREST)); x += 204
        for st in (1, 2, 3):
            a = Image.open(f'{OUT}/{t}-s{st}-64.png'); S.paste(a, (x, y+136), a); x += 70
    S.save(f'{W4}/blind-{el}.png')
json.dump(key, open(f'{W4}/blind-key.json', 'w'), indent=1)
print(key)
