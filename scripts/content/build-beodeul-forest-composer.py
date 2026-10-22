"""버들항 숲 composer 정의 — 원본 버들항 키트 칸(그림 그대로)을 나무 composer(#3058 treeComposer.ts) 그림으로 묶는다.

새 그림은 없다. 칸 번호는 beodeul_city 시트의 원본 칸, cover 는 그 칸의 불투명 화소 비율이다.
숲 종류 셋(forestType):
  · broadleaf 활엽 — 줄기 나무 bd-tree-d43edd·5844f6(4×5), 1a786c·d61d7e(3×4), 가장자리 틈 덤불 37f48b·f4f319(2×2)
  · conifer   침엽 — 해안 절벽길 전나무 bd-pick-coast-cliff-road-fir-l(3×4)·m·m2·s(2×3) + 원본 도시 숲의 측백 bd-tree-eef4bc·28ad5e·c27062(1×3)
  · mixed     혼효 — 원본 도시 숲(tiledata/beodeul-city/render-full/city6.png)처럼 큰 활엽수 사이에 측백·전나무가 선다
접지(ground)는 scripts/content/build-beodeul-forest-ground.py 가 만든 beodeul_ground 칸이다(런타임에 대상 칩셋으로 이식).

  python3 scripts/content/build-beodeul-forest-composer.py  → src/assets/beodeulForestComposer.json
"""
from pathlib import Path
from PIL import Image
import json
R = Path(__file__).resolve().parents[2]
city = json.loads((R / 'src/assets/beodeulCityTileset.json').read_text())
K = {k['id']: k for k in city['structureKits']}
A = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA').getchannel('A')

def cover(n):
    if n < 0: return 0
    x, y = n % 128 * 16, n // 128 * 16
    a = A.crop((x, y, x + 16, y + 16)).tobytes()
    return round(sum(1 for v in a if v > 0) * 100 / 256)

def kid(name): return name if name.startswith('bd-') else 'bd-tree-' + name
FIR = 'bd-pick-coast-cliff-road-fir-'
CYP = ['eef4bc', '28ad5e', 'c27062']

def build(shapes, order, odds, rowStep, colStep, skip, shadeCover, shadeRows):
    sprites, trunk = [], {}
    for shape, names in shapes.items():
        for dark in (False, True):
            for name in names:
                k = K[kid(name)]
                tiles = [n for r in k['rows'] for n in r['upperTiles']]
                cov = [cover(n) for n in tiles]
                sprites.append(dict(name=kid(name), shape=shape, dark=dark, w=k['width'], h=k['height'], tiles=tiles, cover=cov))
                if shape not in trunk:
                    bottom = cov[-k['width']:]
                    best = max(bottom)
                    trunk[shape] = [i for i, v in enumerate(bottom) if v > 30 and v * 2 >= best] or [bottom.index(best)]
    return dict(kind='trees', version=1, layers=[4, 3, 2], rowStep=rowStep, colStep=colStep, skip=skip,
                shapeOrder=order, shapeOdds=odds, trunkCols=trunk, overhangOnGroups=['버들항 풀밭'], overhangOnTiles=[], sprites=sprites,
                groundShadeCover=shadeCover, groundShadeRows=shadeRows)  # 그늘은 수관 아랫부분 몇 줄에서만 — 북쪽 숲 끝 수관 꼭대기 밑 잔디엔 그늘이 없다  # 접지 그늘 덮개 문턱(가는 침엽수는 칸을 덜 덮으므로 낮춘다)

# 숲 속도 줄기 나무를 쓴다 — 수관만 있는 3×3 은 작아서 3칸 격자 무늬와 풀밭 틈이 드러났다(2026-10-20 시험).
# woodland r4(B, 2026-10-21): 숲 덩이마다 나무색 한 톤 — 속(가장자리에서 2칸 이상)은 짙은 초록 D3·D2, 가장자리만 밝은 연두 T4·T3·B2.
# 짙은 큰 나무는 원본에 3×4(1e09f0) 하나뿐이라 속은 3×4 + 2×2 덤불, 큰 4×5 는 가장자리에만 선다(크고 작은 수관 섞기).
LIME_T4 = ['d43edd', '5844f6', 'b1d104']
LIME_T3 = ['1a786c', 'd61d7e', 'bdd36e']
LIME_B2 = ['37f48b', 'f4f319', '132848']
DEEP_T3 = ['1e09f0']
DEEP_B2 = ['47e17a', 'd105b2', 'cc0fcb', 'e9d9b3']
defs = {
    'broadleaf': build({'T4': LIME_T4, 'T3': LIME_T3, 'B2': LIME_B2, 'D3': DEEP_T3, 'D2': DEEP_B2},
                       ['T4', 'T3', 'B2'], [0.4, 0.95], 2, 3, 0.05, 30, 2),
    'conifer': build({'C3': [FIR + 'l'], 'C2': [FIR + 'm', FIR + 'm2', FIR + 's'], 'P1': CYP},
                     ['C3', 'C2', 'P1'], [0.45, 0.85], 2, 2, 0.04, 12, 1),
    'mixed': build({'T4': LIME_T4, 'S': CYP + [FIR + 'm', FIR + 'm2'], 'T3': LIME_T3 + [FIR + 'l'], 'D3': DEEP_T3, 'D2': DEEP_B2},
                   ['T4', 'S', 'T3'], [0.35, 0.7], 2, 3, 0.04, 20, 2),
}
ground = json.loads((R / 'tiledata/beodeul-ground/forest-ground.json').read_text())
out = dict(source='beodeul_city 원본 키트 칸(새 그림 없음). 규칙 #3058 treeComposer.ts. 접지 칸은 beodeul_ground(forest-ground.json).',
           ground=ground, types=defs)
(R / 'src/assets/beodeulForestComposer.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({t: d['trunkCols'] for t, d in defs.items()}))
