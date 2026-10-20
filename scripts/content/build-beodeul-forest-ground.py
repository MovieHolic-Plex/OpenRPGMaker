"""버들항 숲 바닥 — 「짙은 풀」 오토타일(47 이웃 모양) + 숲 장면 잔디. 공용 기초 칩셋 beodeul_ground 에 굽는다.

r5(2026-10-21 사용자 정정 「저 짙은풀은 오토타일로 깔리는 바닥타일이잖아. 숲 내부를 꾸미는 용도로 쓰는」):
원본 도시(tiledata/beodeul-city/render/city6_ground.png)는 나무 밑 땅을 짙은 풀 덩이로 칠했다 — 짙은 결(원본 칸 11628,
「버들항 풀밭」 땅 변형에 든 속 칸) 둘레를 3~4px 디더 띠로 밝은 잔디에 풀어 둔 둥근 덩이다. 버들항 칩셋에는 이 덩이의
가장자리 칸이 오토타일로 정리돼 있지 않아서(autotileGroups 에 없음), 도로 도구가 속 칸 11628 을 네모 판으로 그냥 깔았다.
여기서 그 가장자리를 47 이웃 모양으로 만든다:
  · 속(이웃 8칸 모두 짙은 풀) = 원본 칸 11628 그대로(새 화소 0). 원본의 같은 결 속 칸 1597·12939·12946·12947·15152 는 속 변형.
  · 가장자리 46모양 = 화소마다 원본 11628 화소 또는 바탕 잔디 화소를 그대로 옮긴 조합 — 새 색이 없다.
    경계는 밝은 이웃 칸까지 거리 5.5±2.8px(주기 16 물결 — 옆 칸과 이음새 없이 이어진다), 바깥 3.5px 는 4×4 Bayer 디더 띠.
  · 바탕 잔디 두 벌: 민무늬 잔디 737(마을 숲·마당 숲) · 숲 장면 잔디(737 채도 ×0.84, r4 B 사용자 승인 — 도로 숲 벽).
코드가 그린 그늘 칸(r2~r4 의 floor/edge/apron 그늘 코드 칸 256장)은 모두 뺐다 — 짙은 풀이 나무 밑 땅을 맡는다.

  python3 scripts/content/build-beodeul-forest-ground.py [--draft]   (반복 실행해도 같은 칸 번호에 다시 쓴다)

3/4·화풍 관문(AGENTS hard rule): 가장자리 칸과 숲 장면 잔디는 새 배열·새 색이다. object-gate 출구(bundle)를 칸마다 확인하고,
하나라도 막히면 쓰지 않는다 — 판정자(Opus 적대 판정)가 통과시키기 전에는 --draft 로만 쓸 수 있다(초안 PR 전용, 머지 금지).
"""
from pathlib import Path
import os, sys, math, json, colorsys
os.environ.setdefault('OBJECT_GATE_DATA', str(Path.home() / 'z-project/rpg-zzu-object-gate-holds/harness-data/object-gate'))
from PIL import Image
import numpy as np
R = Path(__file__).resolve().parents[2]
OUT = R / 'public/assets/beodeul-ground'
T = 16
DARK_NATIVE = 11628                                   # 원본 짙은 풀 속 칸(beodeul_city)
DARK_INTERIOR = [11628, 1597, 12939, 12946, 12947, 15152]  # 같은 결 원본 속 칸(가장자리 화소 차 0~2)
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
OFF = {N: (0, -1), E: (1, 0), S: (0, 1), W: (-1, 0), NE: (1, -1), SE: (1, 1), SW: (-1, 1), NW: (-1, -1)}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def canon(m):
    if not (m & N and m & E): m &= ~NE
    if not (m & S and m & E): m &= ~SE
    if not (m & S and m & W): m &= ~SW
    if not (m & N and m & W): m &= ~NW
    return m

def depth(px, py):
    # 경계 깊이 — 칸 좌표의 주기 16 물결이라 옆 칸 경계와 이어진다
    return 5.5 + 1.8 * math.sin(2 * math.pi * (px + py) / T) + 1.0 * math.sin(2 * math.pi * (2 * py - px) / T + 1.3)

def dark_mask(m):
    light = [OFF[b] for b in OFF if not m & b]
    out = np.zeros((T, T), bool)
    for py in range(T):
        for px in range(T):
            X, Y = px + 0.5, py + 0.5
            best = 99.0
            for dx, dy in light:
                x0, y0 = dx * T, dy * T
                best = min(best, math.hypot(max(x0 - X, 0, X - x0 - T), max(y0 - Y, 0, Y - y0 - T)))
            t = (best - depth(px, py)) / 3.5
            out[py, px] = t >= 1 or (t > 0 and (BAYER[py % 4][px % 4] + 0.5) / 16 < t)
    return out

city = Image.open(R / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
def native(i): return np.array(city.crop((i % 128 * T, i // 128 * T, i % 128 * T + T, i // 128 * T + T)))
DARK = native(DARK_NATIVE)
grass = Image.fromarray(native(737))

def desat(im, k=0.84):
    out = im.copy()
    for yy in range(im.height):
        for xx in range(im.width):
            r, g, b, a = im.getpixel((xx, yy))
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, ss * k, vv)
            out.putpixel((xx, yy), (round(r2 * 255), round(g2 * 255), round(b2 * 255), a))
    return out
wgrass = desat(grass)  # r4 B: 숲 장면(도로 숲 벽) 바닥 잔디만 채도 ×0.84 — 공용 잔디 737 은 그대로

cat_paths = [R / 'src/assets/beodeulGroundCatalog.json', R / 'tiledata/beodeul-ground/manifest.json']
m = json.loads(cat_paths[0].read_text())
sheet = Image.open(OUT / 'chipset.png').convert('RGBA')
cells = [sheet.crop((n % 8 * T, n // 8 * T, n % 8 * T + T, n // 8 * T + T)) for n in range(sheet.height // T * 8)]
mine = lambda r: r.get('forestGround') or r['id'].startswith('bdg-forest-ground') or r['id'] == 'bdg-woodland-grass'
m['recipes'] = [r for r in m['recipes'] if not mine(r)]  # 옛 숲 접지 칸(그늘 코드)·이전 판 짙은 풀 칸을 지우고 다시 쓴다
used = max(n for r in m['recipes'] for row in r['rows'] for n in row)
keep = [c.tobytes() for c in cells[:used + 1]]
cells = cells[:used + 1]
nxt = used + 1
new_recipes = []

def put(rid, name, img, kind):
    global nxt
    n = nxt; nxt += 1
    cells.append(img)
    new_recipes.append(dict(id=rid, name=name, width=1, height=1, layer=1, rows=[[n]], blocked=False, kind=kind, forestGround=True))
    return n

wgrass_id = put('bdg-woodland-grass', '숲 장면 잔디(채도 낮춤)', wgrass, 'woodland-grass')
masks = sorted({canon(k) for k in range(256)} - {255})
families = {}
for fam, base, label in (('plain', grass, '민무늬 잔디'), ('woodland', wgrass, '숲 장면 잔디')):
    b = np.array(base); ids = {}
    for mk in masks:
        a = b.copy(); dm = dark_mask(mk); a[dm] = DARK[dm]
        ids[str(mk)] = put(f'bdg-dark-grass-{fam}-{mk}', f'짙은 풀 가장자리({label}) {mk}', Image.fromarray(a), 'dark-grass-edge')
    families[fam] = ids
m['recipes'] += new_recipes
m['count'] = (len(cells) + 7) // 8 * 8
img = Image.new('RGBA', (128, m['count'] // 8 * T))
for n, c in enumerate(cells): img.paste(c, (n % 8 * T, n // 8 * T))
assert [img.crop((n % 8 * T, n // 8 * T, n % 8 * T + T, n // 8 * T + T)).tobytes() for n in range(used + 1)] == keep  # 앞 칸은 그대로

sys.path.insert(0, str(R / 'src/harnesses/_core'))
from object_gate import refusal  # noqa: E402
new_ids = [r['rows'][0][0] for r in new_recipes]
blocked = []
for n in new_ids:
    why = refusal(cells[n], kind='terrain', context='bundle')
    if why: blocked.append(f'칸 {n}: {why}')
print(f'object-gate(bundle): 새 칸 {len(new_ids)} 중 막힘 {len(blocked)}' + (f' — 예: {blocked[0]}' if blocked else ''))
if blocked and '--draft' not in sys.argv:
    sys.exit('3/4·화풍 관문 미통과 — 판정자가 통과시키기 전에는 공용 번들에 굽지 않는다(초안은 --draft)')
img.save(OUT / 'chipset.png'); img.resize((512, img.height * 4), Image.Resampling.NEAREST).save(OUT / 'atlas.png')
for p in cat_paths: p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
ground = dict(source='beodeul_ground', woodlandGrass=wgrass_id,
              darkGrass=dict(native=DARK_NATIVE, interior=DARK_INTERIOR, edgeConnects=True, families=families))
(R / 'tiledata/beodeul-ground/forest-ground.json').write_text(json.dumps(ground, indent=1) + '\n')
# 미리보기: 47모양(민무늬 잔디 위) + 둥근 덩이 시험
pv = Image.new('RGBA', ((len(masks) + 1) * 18, 36), (40, 40, 46, 255))
for k, mk in enumerate(masks):
    pv.paste(cells[families['plain'][str(mk)]], (k * 18, 0)); pv.paste(cells[families['woodland'][str(mk)]], (k * 18, 18))
pv.paste(Image.fromarray(DARK), (len(masks) * 18, 0))
pv.resize((pv.width * 3, pv.height * 3), Image.Resampling.NEAREST).save(OUT / 'forest-ground-preview.png')
print(json.dumps(dict(count=m['count'], woodlandGrass=wgrass_id, first=new_ids[1], last=new_ids[-1], new=len(new_ids))))
