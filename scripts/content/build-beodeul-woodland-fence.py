"""버들항 woodland 울타리 — 원본 밭 울타리(bd-farm-fenced-plot) 칸을 화소 그대로 공용 기초 칩셋(beodeul_ground)에 옮긴다.

2026-10-20: bdg-woodland-fence-* 세 조각은 PIL 도형으로 그린 임시 그림이었고(짙은 갈색, 기둥 위가 뜸),
모서리가 「가로 + 기둥 토막」 한 가지라 오른쪽·위쪽 모서리를 맞출 수 없었다. 버들항 원본에는 같은 결의 밭 울타리 8조각
(가로·왼쪽/오른쪽 세로·네 모서리)이 이미 있다 — 새 그림 없이 그 화소를 복사한다.

  · 643 fence-horizontal  ← 28288 (가로)
  · 644 fence-vertical    ← 28289 (왼쪽 세로)          = fence-vertical-west 와 같은 그림
  · 645 fence-corner      ← 28292 (왼쪽 아래 모서리)   = fence-corner-sw 와 같은 그림
  · 새 칸: fence-vertical-east ← 28300, fence-corner-se ← 28293, fence-corner-nw ← 28290, fence-corner-ne ← 28291
같은 번호(643~645)는 그림만 바뀌므로 이미 이 조각을 쓴 맵도 원본 결로 보인다(이식 칸은 원본 칸을 읽는다).
반복 실행해도 같은 결과다.

  python3 scripts/content/build-beodeul-woodland-fence.py
"""
from pathlib import Path
from PIL import Image
import json, hashlib
R = Path(__file__).resolve().parents[2]
OUT = R / 'public/assets/beodeul-ground'
city = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
cat_paths = [R / 'src/assets/beodeulGroundCatalog.json', R / 'tiledata/beodeul-ground/manifest.json']
m = json.loads(cat_paths[0].read_text())
sheet = Image.open(OUT / 'chipset.png').convert('RGBA')
cells = [sheet.crop((n % 8 * 16, n // 8 * 16, n % 8 * 16 + 16, n // 8 * 16 + 16)) for n in range(sheet.height // 16 * 8)]
src = lambda n: city.crop((n % 128 * 16, n // 128 * 16, n % 128 * 16 + 16, n // 128 * 16 + 16))
recipes = {r['id']: r for r in m['recipes']}
keep = hashlib.sha256(sheet.crop((0, 0, 128, 643 // 8 * 16)).tobytes()).hexdigest()

PIECES = [  # (이름, 원본 칸, 설명)
    ('horizontal', 28288, '가로'), ('vertical', 28289, '세로(서쪽 변)'), ('corner', 28292, '남서 모서리'),
    ('vertical-east', 28300, '세로(동쪽 변)'), ('corner-se', 28293, '남동 모서리'),
    ('corner-nw', 28290, '북서 모서리'), ('corner-ne', 28291, '북동 모서리'),
]
last = max(n for r in m['recipes'] for row in r['rows'] for n in row if not r['id'].startswith('bdg-woodland-fence-'))
assert last < 643, last
for name, source, label in PIECES:
    rid = 'bdg-woodland-fence-' + name
    if rid in recipes:
        n = recipes[rid]['rows'][0][0]
    else:
        n = max(max(n for row in r['rows'] for n in row) for r in m['recipes']) + 1
        r = dict(id=rid, name='숲 깊이 · fence-' + name, width=1, height=1, layer=3, rows=[[n]], blocked=False, woodland=True,
                 blockingCells=[[0, 0]], upperCells=[], kind='fence')
        m['recipes'].append(r); recipes[rid] = r
    while len(cells) <= n: cells.append(Image.new('RGBA', (16, 16)))
    cells[n] = src(source)
    recipes[rid].update(name=f'숲 울타리 · {label}', sourceCityTile=source, sourceKit='bd-farm-fenced-plot')
    src(source).save(OUT / f'woodland-fence-{name}.png')
m['count'] = (len(cells) + 7) // 8 * 8
img = Image.new('RGBA', (128, m['count'] // 8 * 16))
for n, c in enumerate(cells): img.paste(c, (n % 8 * 16, n // 8 * 16))
assert hashlib.sha256(img.crop((0, 0, 128, 643 // 8 * 16)).tobytes()).hexdigest() == keep  # 앞 칸은 그대로
img.save(OUT / 'chipset.png'); img.resize((512, img.height * 4), Image.Resampling.NEAREST).save(OUT / 'atlas.png')
for p in cat_paths: p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(count=m['count'], fence={n: recipes['bdg-woodland-fence-' + n]['rows'][0][0] for n, _, _ in PIECES})))
