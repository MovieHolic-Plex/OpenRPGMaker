"""Assemble existing approved parking tiles into a separately reviewed larger scene."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'tiledata/modern-city/parking-wide'
PLAN = ROOT / 'harness-data/modern-chipset/parking-wide/plan.md'


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def build(review_path):
    review = json.loads(Path(review_path).read_text())
    binding = json.loads(Path(review_path).with_suffix('.input.json').read_text())
    if (binding['planSha256'] != hashlib.sha256(PLAN.read_bytes()).hexdigest()
            or binding['sheetSha256'] != hashlib.sha256((ROOT/'public/assets/modern-city/modern-city-chipset.png').read_bytes()).hexdigest()):
        raise ValueError('Planning input changed after review')
    if review.get('verdict') != 'PASS' or any(i['severity'] == 'hard' for i in review.get('issues', [])):
        raise ValueError('Independent planning approval required')
    data = json.loads((ROOT / 'src/assets/modernCityTileset.json').read_text())
    kit = next(k for k in data['structureKits'] if k['id'] == 'mc-parking-two-bays')
    source = kit['rows']
    width, height = 26, 18
    lower = [[source[3]['tiles'][0]] * width for _ in range(height)]
    upper = [[-1] * width for _ in range(height)]
    # One continuous north wall, one outer return. No whole-room repetition.
    for y in (0, 1):
        for x in range(width):
            lower[y][x] = source[y]['tiles'][x if x < 2 else 2 + (x - 2) % 3]
    for x in range(width):
        lower[2][x] = source[2]['tiles'][x if x < 2 else 2]
    for offset in (0, 12):
        for y in (0, 1, 2):
            for x in range(8, 12):
                lower[y][x + offset] = source[y]['tiles'][x]
        for y in range(2, 15):
            sy = 2 if y == 2 else 6 if y == 14 else 3 if y % 2 else 4
            for x in range(7, 14):
                lower[y][x + offset] = source[sy]['tiles'][x]
    cars = []
    for bank, rows in enumerate(((0, 2, 5), (1, 3, 4))):
        for row in rows:
            x0, y0 = 8 + bank*12, 2 + row*2
            for dy in (0, 1):
                for dx in range(5):
                    upper[y0+dy][x0+dx] = source[2+dy]['upperTiles'][8+dx]
            cars.append({'bank':bank,'bay':row,'x':x0,'y':y0,'width':5,'height':2})
    targets = [[0,16], [4,2], [16,2], [16,16]]
    for bank in range(2):
        for row in range(6):
            targets.extend([[7+12*bank,3+2*row],[9+12*bank,2+2*row],[9+12*bank,4+2*row]])
    blocked = [[4,0],[16,1],[0,2]] + [[c['x']+1,c['y']+1] for c in cars]
    blocked += [[12+12*b,3+2*r] for b in range(2) for r in range(6)]
    recipe = {'version':1,'id':'mc-parking-wide-experiment','name':'지하 주차장 · 12면 확장 실험',
              'width':width,'height':height,'tileSize':16,'tilesetId':'modern_city','start':[4,16],
              'rows':[{'tiles':a,'upperTiles':b} for a,b in zip(lower,upper)],'cars':cars,
              'bayCount':12,'targets':targets,'blocked':blocked,
              'planSha256':hashlib.sha256(PLAN.read_bytes()).hexdigest(),
              'scope':'Existing-chip static cutaway experiment; not a complete structural facility',
              'missing':['structural columns','overhead lighting','ramp','barrier','fire door','full perimeter'],
              'sourceKit':kit['id'], 'sourceSheetSha256':hashlib.sha256((ROOT/'public/assets/modern-city/modern-city-chipset.png').read_bytes()).hexdigest()}
    atlas = Image.open(ROOT/'public/assets/modern-city/modern-city-chipset.png').convert('RGBA')
    image = Image.new('RGBA',(width*16,height*16))
    for grid in (lower,upper):
        for y,row in enumerate(grid):
            for x,tid in enumerate(row):
                if tid < 0: continue
                if tid >= data['count']: raise ValueError('Unknown tile')
                sx,sy=tid%data['tilesPerRow']*16,tid//data['tilesPerRow']*16
                image.alpha_composite(atlas.crop((sx,sy,sx+16,sy+16)),(x*16,y*16))
    OUT.mkdir(parents=True,exist_ok=True)
    image.save(OUT/'scene.png')
    write(OUT/'recipe.json',recipe)
    write(OUT/'plan-review.json',review)
    write(OUT/'plan-review.input.json',binding)
    print(json.dumps({'recipe':str(OUT/'recipe.json'),'image':str(OUT/'scene.png'),'bays':12,'cars':len(cars)}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--review',required=True)
    build(parser.parse_args().review)
