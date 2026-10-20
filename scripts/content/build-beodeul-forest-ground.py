"""버들항 숲 바닥 — 「짙은 풀」 오토타일(47 이웃 모양) + 숲 장면 잔디. 공용 기초 칩셋 beodeul_ground 에 굽는다.

r5(2026-10-21 사용자 정정 「저 짙은풀은 오토타일로 깔리는 바닥타일이잖아. 숲 내부를 꾸미는 용도로 쓰는」):
원본 도시(tiledata/beodeul-city/render/city6_ground.png)는 나무 밑 땅을 짙은 풀 덩이로 칠했다 — 짙은 결(원본 칸 11628,
「버들항 풀밭」 땅 변형에 든 속 칸) 둘레를 3~4px 디더 띠로 밝은 잔디에 풀어 둔 둥근 덩이다. 버들항 칩셋에는 이 덩이의
가장자리 칸이 오토타일로 정리돼 있지 않아서(autotileGroups 에 없음), 도로 도구가 속 칸 11628 을 네모 판으로 그냥 깔았다.
여기서 그 가장자리를 47 이웃 모양으로 만든다:
  · 속(이웃 8칸 모두 짙은 풀) = 원본 칸 11628 그대로(새 화소 0). 원본의 같은 결 속 칸 1597·12939·12946·12947·15152 는 속 변형.
  · 가장자리 46모양 = 화소마다 원본 11628 화소 또는 바탕 잔디 화소를 그대로 옮긴 조합. 민무늬 잔디 벌은 원본에 없는 색 0,
    숲 장면 잔디 벌은 바탕(채도 낮춘 650)의 색 4개가 원본에 없다.
    경계는 밝은 이웃 칸까지 거리 5.5±3.4px(주기 16 물결 세 겹 — 옆 칸과 이음새 없이 이어지고, 한 칸 안에서도 곧은 토막이 남지 않게), 바깥 3.5px 는 4×4 Bayer 디더 띠.
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
    # 경계 깊이 — 칸 좌표의 주기 16 물결이라 옆 칸 경계와 이어진다(전역 화소 좌표 mod 16 의 함수).
    # 3차 검수 W3: 두 겹만으론 세로·가로 한 칸 경계가 곧게 보였다 — 세 겹 물결(넓은 덩이 가장자리는 r6 과 같은 굴곡).
    # 최소 깊이 3 ≥ 여백 3 — canon 이 지운 대각 이웃의 실제 값과 상관없이 여백 화소가 같게 계산된다(dark_mask).
    return 6.0 + 1.5 * math.sin(2 * math.pi * (px + py) / T) + 0.9 * math.sin(2 * math.pi * (2 * py - px) / T + 1.3) + 0.6 * math.sin(2 * math.pi * (3 * px - 3 * py) / T + 0.4)

MARGIN = 6
DITHER = 3.5
CORNER_R = 11.0
CARD = {N: (0, -1), E: (1, 0), S: (0, 1), W: (-1, 0)}

def in_block(cells, ax, ay):
    """칸 (ax,ay) 가 짙은 2×2 덩이에 들어 있는가."""
    return any(all((ax + i, ay + j) in cells for i in (0, sx) for j in (0, sy)) for sx in (-1, 1) for sy in (-1, 1))

def thin_seam(cells, ax, ay, dx, dy):
    """짙은 두 칸 사이 이음매가 「한 칸 폭」인가 — 두 칸을 함께 품는 짙은 2×2 덩이가 없으면 그렇다. 양쪽 칸이 같은 답을 낸다."""
    bx, by = ax + dx, ay + dy
    px, py = (0, 1) if dx else (1, 0)
    return not any((ax + px * k, ay + py * k) in cells and (bx + px * k, by + py * k) in cells for k in (-1, 1))

def spine(cx, cy, dark_cells, X, Y):
    """한 칸 폭 띠·외딴 칸(4·5차 독립 Opus 적대 VQA, 2026-10-21):
    · 굴곡 경계만으로는 한 칸 폭 띠가 다 깎여 끊긴 점 사슬이 됐다 → 「한 칸 폭」 이음매마다 칸 가운데까지 가는 띠를 깐다.
    · 가운데 둥근 속을 크게 두면 구슬 사슬(가운데 불룩·이음매 잘록)이 됐다 → 속은 띠 반폭과 같게(불룩함 없음).
    · 띠 테두리가 곧으면 디더가 빗살처럼 반복됐다 → 왼·오른 테두리를 서로 다른 물결로 흔든다.
    띠 중심선·테두리는 그 이음매에서 잰 거리 u 만의 함수라 이음매 양쪽 칸이 같은 열/행에서 만난다.
    반환값 ≤0 단단함, 0~1.5 디더."""
    lx, ly = X - cx * T, Y - cy * T
    best = 99.0
    arms = 0
    for b, (dx, dy) in CARD.items():
        if (cx + dx, cy + dy) not in dark_cells or not thin_seam(dark_cells, cx, cy, dx, dy): continue
        arms += 1
        along, across = (ly if dy < 0 else T - ly, lx) if dy else (lx if dx < 0 else T - lx, ly)
        u = along
        if u > 8.5: continue
        c = 8 + 1.0 * math.sin(math.pi * u / 8)
        lo = c - (3.2 + 0.7 * math.sin(2 * math.pi * u / 8 + 0.7))
        hi = c + (3.2 + 0.7 * math.sin(2 * math.pi * u / 8 + 2.6))
        best = min(best, max(lo - across, across - hi))
    if arms:
        best = min(best, math.hypot(lx - 8, ly - 8) - 3.2)  # 팔들이 가운데서 만나는 마디(띠 반폭과 같음)
    return best

def dark_mask(m):
    """칸 하나의 짙은 화소 — 전역 필드(밝은 이웃 칸까지 거리·전역 좌표 물결·Bayer) ∪ 뼈대(spine)를 칸+여백 3px 창에서
    계산하고, 크기 3 이하의 떨어진 짙은 조각(디더 낱점)을 지운다. 조각 판정은 전역 필드의 연결 성분으로 하므로 옆 칸도
    같은 조각을 같게 지운다(이음매 양쪽 일치). 칸에 닿는 크기 ≤3 조각은 여백 3 안에 다 들어가 판정이 정확하다."""
    light = [OFF[b] for b in OFF if not m & b]
    dark_cells = {(0, 0)} | {OFF[b] for b in OFF if m & b}
    Wn = T + 2 * MARGIN
    win = np.zeros((Wn, Wn), bool)
    for wy in range(Wn):
        for wx in range(Wn):
            X, Y = wx - MARGIN + 0.5, wy - MARGIN + 0.5
            cx, cy = math.floor(X / T), math.floor(Y / T)
            if (cx, cy) not in dark_cells: continue
            px, py = int(math.floor(X)) % T, int(math.floor(Y)) % T
            bay = (BAYER[py % 4][px % 4] + 0.5) / 16
            if dark_cells == {(0, 0)}:
                # 외딴 짙은 칸 하나: 단단한 덩이는 풀포기·구멍(물건)으로 읽혔다(4·5차 VQA) — 가운데로 갈수록 짙어지는 성긴 디더 그늘만.
                # 외딴 짙은 칸 하나: 둥근 덩이·마름모는 풀포기·구멍(물건)으로 읽혔다(5·6차) — 테두리가 고르지 않은 얼룩(성긴 디더 가장자리).
                # 납작한 가로 타원 그늘(그림자처럼 땅에 깔림) + 약한 물결, 테두리는 성긴 디더 2px.
                ex, ey = (X - 8) / 6.6, (Y - 8.3) / 4.4
                r, th = math.hypot(ex, ey), math.atan2(ey, ex)
                rad = 1.0 + 0.08 * math.sin(3 * th + 0.5) + 0.05 * math.sin(5 * th + 2.0)
                t = (rad - r) * 4.4 / 2.0 + 0.5
                win[wy, wx] = t >= 1 or (t > 0 and bay < t)
                continue
            dV = dH = dD = 99.0
            for dx, dy in light:
                x0, y0 = dx * T, dy * T
                gx, gy = max(x0 - X, 0, X - x0 - T), max(y0 - Y, 0, Y - y0 - T)
                if gx == 0: dV = min(dV, gy)
                elif gy == 0: dH = min(dH, gx)
                else: dD = min(dD, math.hypot(gx, gy))
            best = min(dV, dH, dD)
            dep = depth(px, py)
            if dV < CORNER_R and dH < CORNER_R:
                # 볼록 모서리(위·옆이 다 밝음)를 둥글린다 — 각진 모서리에 디더가 45° 가시처럼 남았다(5차 VQA).
                # 모서리 안쪽에서는 물결의 얕은 골(깊이 3 근처)이 가시를 다시 만들므로 깊이를 5.5 이상으로 부드럽게 올린다.
                best = min(best, CORNER_R - math.hypot(CORNER_R - dV, CORNER_R - dH))
                w = min(1.0, (CORNER_R - max(dV, dH)) / 3.0)
                dep = dep + w * (max(dep, 5.5) - dep)
            t = (best - dep) / DITHER
            sp = spine(cx, cy, dark_cells, X, Y)
            win[wy, wx] = t >= 1 or (t > 0 and bay < t) or sp <= 0 or (sp <= 1.5 and bay < 0.5 * (1.5 - sp) / 1.5 + 0.15)
    # 가시 다듬기(5차 VQA: 볼록 모서리·띠 테두리에 45° 낱화소 줄이 가시처럼 남았다): 짙은 8이웃이 2개 이하인 화소를
    # 세 번 걷어 낸다. 바둑판 디더 속 화소는 이웃이 4개라 남는다. 창 전체(여백 포함)에서 계산하므로 옆 칸도 같게 걷는다.
    for _ in range(3):
        pad = np.pad(win, 1)
        cnt = sum(np.roll(np.roll(pad, ddy, 0), ddx, 1) for ddx in (-1, 0, 1) for ddy in (-1, 0, 1) if ddx or ddy)[1:-1, 1:-1]
        win = win & (cnt > 2)
    seen = np.zeros_like(win)
    for sy in range(Wn):
        for sx in range(Wn):
            if not win[sy, sx] or seen[sy, sx]: continue
            comp, stack = [], [(sx, sy)]; seen[sy, sx] = True
            while stack:
                x, y = stack.pop(); comp.append((x, y))
                for ddx in (-1, 0, 1):
                    for ddy in (-1, 0, 1):
                        nx, ny = x + ddx, y + ddy
                        if 0 <= nx < Wn and 0 <= ny < Wn and win[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; stack.append((nx, ny))
            inside = all(0 < x < Wn - 1 and 0 < y < Wn - 1 for x, y in comp)
            if len(comp) <= 3 and inside:
                for x, y in comp: win[y, x] = False
    return win[MARGIN:MARGIN + T, MARGIN:MARGIN + T]

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
