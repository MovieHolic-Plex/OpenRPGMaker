"""버들항 woodland composer 정의 — 원본 bd-tree 키트 칸(그림 그대로)을 나무 composer(#3058 treeComposer.ts) 그림으로 묶는다.

새 그림은 없다. 칸 번호는 beodeul_city 시트의 원본 칸, cover 는 그 칸의 불투명 화소 비율이다.
  python3 scripts/content/build-beodeul-forest-composer.py  → src/assets/beodeulForestComposer.json
"""
from pathlib import Path
from PIL import Image
import json
R = Path(__file__).resolve().parents[2]
city = json.loads((R / 'src/assets/beodeulCityTileset.json').read_text())
K = {k['id']: k for k in city['structureKits']}
atlas = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
A = atlas.getchannel('A')

def cover(n):
    if n < 0: return 0
    x, y = n % 128 * 16, n // 128 * 16
    a = A.crop((x, y, x + 16, y + 16)).getdata()
    return round(sum(1 for v in a if v > 0) * 100 / 256)

# 숲 가장자리·숲 속 모두 줄기 나무(4×5·3×4)다. 숲 속을 수관만 있는 3×3 으로 바꿔 보니(2026-10-20 시험) 수관이 작아
# 3칸 격자 무늬가 다시 드러나고 수관 사이로 풀밭이 비쳤다 — 앞 나무 수관이 뒤 나무 줄기를 대부분 가리므로 줄기 나무를 그대로 쓴다.
# 수관만 있는 3×3(떠 보인다)과 측백(이가 빠진다)은 쓰지 않는다.
SHAPES = {'T4': ['d43edd', '5844f6'], 'T3': ['1a786c', 'd61d7e'], 'B2': ['37f48b', 'f4f319']}
INNER = SHAPES
sprites = []
trunk = {}
for shape, ids in SHAPES.items():
    for dark in (False, True):
        for id in (INNER[shape] if dark else ids):
            k = K['bd-tree-' + id]
            tiles = [n for r in k['rows'] for n in r['upperTiles']]
            cov = [cover(n) for n in tiles]
            sprites.append(dict(name=id, shape=shape, dark=dark, w=k['width'], h=k['height'], tiles=tiles, cover=cov))
            if shape not in trunk and not dark:
                # 줄기 열 = 맨 아래 줄에서 불투명 화소가 3할 넘는 칸(덤불은 맨 아래 줄 전체)
                bottom = cov[-k['width']:]
                trunk[shape] = [i for i, v in enumerate(bottom) if v > 30] or list(range(k['width']))
out = dict(kind='trees', version=1, layers=[4, 3, 2], rowStep=2, colStep=3, skip=0.05,
           shapeOrder=list(SHAPES), shapeOdds=[0.4, 0.95], trunkCols=trunk,
           overhangOnGroups=['버들항 풀밭'], overhangOnTiles=[], sprites=sprites,
           source='beodeul_city bd-tree 원본 칸(새 그림 없음). 규칙 #3058 treeComposer.ts')
(R / 'src/assets/beodeulForestComposer.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print(json.dumps(dict(trunk=trunk, sprites=[(s['name'], s['shape'], s['w'], s['h'], s['cover']) for s in sprites if not s['dark']])))
