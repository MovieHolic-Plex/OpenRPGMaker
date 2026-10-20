"""버들항 숲 접지(r6 TreeComposerGround) 칸 — 숲 바닥 그늘 64 + 숲 둘레 땅 그늘 64.

규칙은 jp 숲 r6(scripts/content/jp-city/forest/forest_r6_ground.py, #3058)과 같은 그늘 코드·영역이다:
  비트 = 가운데·북·서·북서·동·북동 칸이 「그늘 덮개」(나무 그림이 덮은 칸)인가. 속 = 덮개 칸을 오른쪽 아래로 민 사각형,
  가 = 왼 2 · 오른 7 · 아래 7px 넓힌 사각형(빛이 왼쪽 위 — 그늘은 오른쪽 아래로 길다), 원판 다수결로 둥글리고 1px 흔든다.
색은 버들항 원본 숲 조각 그림자(public/assets/beodeul-ground/woodland-*-shadow.png) 두 단 그대로다:
  가 (30,49,27) α65 · 속 (29,43,23) α115. 버들항은 반투명을 쓸 수 있으므로 둘레 그늘은 투명 덧칸(어느 잔디 위에도 같은 칸),
  숲 바닥은 민무늬 잔디 737 에 같은 색을 합성한 불투명 칸이다. 경계는 단색 덩이 밖 듬성한 낱점(원본 도시 숲 그늘 결).
새 그림이 아니라 원본 잔디·원본 그림자 색의 합성이다.

  python3 scripts/content/build-beodeul-forest-ground.py   (반복 실행해도 같은 칸 번호에 다시 쓴다)
"""
from pathlib import Path
from PIL import Image
import json, hashlib
R = Path(__file__).resolve().parents[2]
OUT = R / 'public/assets/beodeul-ground'
T = 16
OUTER = (30, 49, 27, 65)
CORE = (29, 43, 23, 115)
SHADE_BITS = (('C', 0, 0), ('N', 0, -1), ('W', -1, 0), ('NW', -1, -1), ('E', 1, 0), ('NE', 1, -1))
NCODES = 1 << len(SHADE_BITS)
DISK = [(dx, dy) for dy in range(-4, 5) for dx in range(-4, 5) if dx * dx + dy * dy <= 13]

def h(px, py, salt):
    v = hashlib.blake2b(f'bdg-ground|{salt}|{px}|{py}'.encode(), digest_size=4).digest()
    return int.from_bytes(v, 'little') / 4294967296.0

def raw(X, Y, forest):
    lev = 0
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            if not forest(i, j): continue
            x0, y0 = i * T, j * T
            # 그늘 덩이는 대부분 나무 밑에 숨는다 — 덮개 칸의 윗부분은 비우고(위 4~5px) 오른쪽 아래로 민다(보이는 부분 +5~9px).
            if x0 + 3 <= X < x0 + T + 4 and y0 + 5 <= Y < y0 + T + 4: return 2
            if x0 - 1 <= X < x0 + T + 7 and y0 + 4 <= Y < y0 + T + 7: lev = 1
    return lev

def lone(px, py):
    v = h(px, py, 'd')
    return all(v > h(px + dx, py + dy, 'd') for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

def level(px, py, forest):
    """0 잔디 · 1 가 · 2 속. 원본 도시 숲 그늘 결(woodland r3, 2026-10-21 독립 검수 D7): 속은 단색 덩이, 가장자리 밖으로만
    듬성한 낱점. 원판(반지름 √13) 평균 비율이 절반을 넘으면 덩이, 그보다 옅은 띠에서는 해시 확률로 낱점만 찍는다
    (정규 바둑 무늬 없음). 낱점 자리는 4이웃 해시보다 큰 화소뿐이라 낱점끼리 붙지 않고 무늬도 없다."""
    jx, jy = int(h(px, py, 'x') * 3) - 1, int(h(px, py, 'y') * 3) - 1
    core = outer = 0
    for dx, dy in DISK:
        r = raw(px + dx + jx, py + dy + jy, forest)
        core += r == 2; outer += r >= 1
    n = len(DISK)
    cf, of = core / n, outer / n
    if cf > 0.5: return 2
    if of > 0.5: return 1 if cf <= 0.3 or h(px, py, 'c') > (cf - 0.3) * 2.0 else 2
    if of > 0.12 and lone(px, py) and h(px, py, 'e') < (of - 0.12) * 3.0: return 1
    return 0

def forest_of(code):
    pos = {(dx, dy): bool(code >> k & 1) for k, (_, dx, dy) in enumerate(SHADE_BITS)}
    return lambda i, j: pos.get((i, j), False)

def overlay(code):
    f = forest_of(code); im = Image.new('RGBA', (T, T))
    for py in range(T):
        for px in range(T):
            L = level(px, py, f)
            if L: im.putpixel((px, py), CORE if L == 2 else OUTER)
    return im

city = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
grass = city.crop((737 % 128 * T, 737 // 128 * T, 737 % 128 * T + T, 737 // 128 * T + T))
cat_paths = [R / 'src/assets/beodeulGroundCatalog.json', R / 'tiledata/beodeul-ground/manifest.json']
m = json.loads(cat_paths[0].read_text())
sheet = Image.open(OUT / 'chipset.png').convert('RGBA')
cells = [sheet.crop((n % 8 * T, n // 8 * T, n % 8 * T + T, n // 8 * T + T)) for n in range(sheet.height // T * 8)]
recipes = {r['id']: r for r in m['recipes']}
used = max(n for r in m['recipes'] if not r['id'].startswith('bdg-forest-ground-') for row in r['rows'] for n in row)
keep = [c.tobytes() for c in cells[:used + 1]]
nxt = used + 1

def slot(rid):
    global nxt
    if rid in recipes: return recipes[rid]['rows'][0][0]
    n = nxt; nxt += 1; return n

floor_ids, edge_ids, apron_ids = [], [], []
for code in range(NCODES):
    ov = overlay(code)
    # 숲 바닥 = 잔디에 나무 그늘(코드)만. 「숲 칸이면 어디나 그늘」은 덩이가 작은 마을 숲에서 칸 네모로 드러났다(2026-10-20 r2 시험).
    f = grass.copy(); f.alpha_composite(ov)
    if code == 0:  # 그늘 덮개가 없는 숲 바닥 — 잔디 결 점 두 개로 숲 칸임을 표시(붓·도구가 숲 칸을 알아본다)
        for p in ((4, 11), (12, 5)): f.alpha_composite(Image.new('RGBA', (1, 1), OUTER), p)
    rid = f'bdg-forest-ground-floor-{code}'; n = slot(rid)
    while len(cells) <= n: cells.append(Image.new('RGBA', (T, T)))
    cells[n] = f; floor_ids.append(n)
    recipes[rid] = recipes.get(rid) or dict(id=rid, name=f'숲 바닥 그늘 {code}', width=1, height=1, layer=1, rows=[[n]], blocked=False, kind='forest-floor', forestGround=True)
    # 숲 가장자리 칸(8이웃 중 숲 밖이 있다)의 바닥 — 그늘 코드대로만 어둡게(바깥 잔디와 칸 경계 없이 이어진다)
    e = f.copy()  # 가장자리 바닥 = 숲 바닥(같은 그림, 칸 번호만 따로 — 나중에 가장자리만 달리 칠할 자리)
    rid = f'bdg-forest-ground-edge-{code}'; n = slot(rid)
    while len(cells) <= n: cells.append(Image.new('RGBA', (T, T)))
    cells[n] = e; edge_ids.append(n)
    recipes[rid] = recipes.get(rid) or dict(id=rid, name=f'숲 가장자리 바닥 그늘 {code}', width=1, height=1, layer=1, rows=[[n]], blocked=False, kind='forest-floor-edge', forestGround=True)
    if ov.getbbox():
        rid = f'bdg-forest-ground-apron-{code}'; n = slot(rid)
        while len(cells) <= n: cells.append(Image.new('RGBA', (T, T)))
        cells[n] = ov; apron_ids.append(n)
        recipes[rid] = recipes.get(rid) or dict(id=rid, name=f'숲 둘레 땅 그늘 {code}', width=1, height=1, layer=2, rows=[[n]], blocked=False, kind='forest-apron', forestGround=True)
    else:
        apron_ids.append(-1)
known = {r['id'] for r in m['recipes']}
for rid, r in recipes.items():
    if rid not in known: m['recipes'].append(r)
m['count'] = (len(cells) + 7) // 8 * 8
img = Image.new('RGBA', (128, m['count'] // 8 * T))
for n, c in enumerate(cells): img.paste(c, (n % 8 * T, n // 8 * T))
assert [img.crop((n % 8 * T, n // 8 * T, n % 8 * T + T, n // 8 * T + T)).tobytes() for n in range(used + 1)] == keep  # 앞 칸은 그대로
img.save(OUT / 'chipset.png'); img.resize((512, img.height * 4), Image.Resampling.NEAREST).save(OUT / 'atlas.png')
for p in cat_paths: p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
ground = dict(shadeBits=[[dx, dy] for _, dx, dy in SHADE_BITS], shadeCover=30, shadeCoverBase=15,
              floorTiles=floor_ids, floorEdgeTiles=edge_ids, apronLayer=2, apronBases=[737], apronTiles=apron_ids, source='beodeul_ground')
(R / 'tiledata/beodeul-ground/forest-ground.json').write_text(json.dumps(ground, indent=1) + '\n')
# 미리보기: 코드별 숲 바닥·둘레 그늘
pv = Image.new('RGBA', (NCODES * 18, 36), (40, 40, 46, 255))
for code in range(NCODES):
    pv.paste(cells[floor_ids[code]], (code * 18, 0))
    g = grass.copy()
    if apron_ids[code] >= 0: g.alpha_composite(cells[apron_ids[code]])
    pv.paste(g, (code * 18, 18))
pv.resize((pv.width * 3, pv.height * 3), Image.Resampling.NEAREST).save(OUT / 'forest-ground-preview.png')
print(json.dumps(dict(count=m['count'], floor=floor_ids[:3], apron=[a for a in apron_ids if a >= 0][:3], apronCount=sum(a >= 0 for a in apron_ids))))
