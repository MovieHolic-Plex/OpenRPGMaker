#!/usr/bin/env python3
"""parts.png + parts.json 의 조각 이름만으로 강남 3/4 데모 장면 조립. → scene.png, scene-overlay.png, kits/*.json+up.png, scene-map.json
  python3 tiledata/atlas-pick/gangnam-v2/compose.py"""
import json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from modern_style_bible_proof import K
import view34_proof as V
from view34_proof import shade, ell_shade

M = json.load(open(os.path.join(HERE, 'parts.json')))
SHEET = Image.open(os.path.join(HERE, 'parts.png')).convert('RGBA')
P = M['parts']
def part(n):
    p = P[n]; return SHEET.crop((p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']))

W, H = 480, 368
GF = 240                     # 건물 밑선(문 앞 바닥 높이)
SIDE0 = GF                   # 인도 2줄
CURB = GF + 32
ROAD0 = CURB + 16
def hexrgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255, 255)

scene = Image.new('RGBA', (W, H), hexrgb(K('yoru', -3)))
def put(img, x, y): scene.alpha_composite(img, (x, y))
def tile(n, x, y): put(part(n), x, y)

# ── 바닥 (lo) ─────────────────────────────────────────────
lo = {}                                                  # (col,row) -> 조각 이름
def L(c, r, n): lo[(c, r)] = n
cols, rows = W // 16, H // 16
for c in range(cols):
    L(c, 0, 'far_wall' if c % 3 != 1 else 'far_wall_plain')
    L(c, 1, 'alley_dk2'); L(c, 2, 'alley_dk1')
    for r in range(3, GF // 16): L(c, r, 'alley')
    for r in (GF // 16, GF // 16 + 1): L(c, r, 'pave')
    L(c, CURB // 16, 'curb')
    for k in range(5): L(c, ROAD0 // 16 + k, 'road_dash' if k == 2 else 'road')
for c in (24, 25):                                        # 횡단보도: 인도 끝(연석)까지 이어 붙인다
    for k in range(5): L(c, ROAD0 // 16 + k, 'xwalk')
for (c, r), n in sorted(lo.items()): tile(n, c * 16, r * 16)

# ── 뒷골목 바닥 데칼 (평평한 회색 판 방지): 맨홀 2개 · 배수 홈 · 주차선 · 젖은 자국. 아래 단계 색만 쓴다 ──
_d = ImageDraw.Draw(scene)
def _c(r, t): return hexrgb(K(r, t))
def manhole(cx, cy):
    _d.ellipse((cx - 7, cy - 4, cx + 6, cy + 4), fill=_c('tekko', -2), outline=_c('tekko', -3))
    _d.ellipse((cx - 5, cy - 3, cx + 4, cy + 2), fill=_c('tekko', -1))
    for k in (-3, -1, 1, 3): _d.line((cx + k - 2, cy - 2, cx + k, cy + 2), fill=_c('tekko', -3))
    _d.line((cx - 6, cy - 4, cx + 2, cy - 4), fill=_c('tekko', 0))
manhole(330, 138); manhole(150, 96); manhole(60, 150)
for px_ in (304, 336, 368, 400, 432, 464):                # 주차선: 뒷골목 안쪽 벽 쪽으로 붙여 세운 칸
    _d.line((px_, 66, px_, 106), fill=_c('conc', 2)); _d.line((px_ + 1, 66, px_ + 1, 106), fill=_c('conc', 1))
_d.line((304, 66, 465, 66), fill=_c('conc', 2))
for (ex, ey, ew, eh) in ((312, 118, 22, 8), (420, 122, 16, 6), (100, 130, 18, 6)): _d.ellipse((ex, ey, ex + ew, ey + eh), fill=_c('conc', -2))
for gy in (44, 60): _d.line((296, gy, 302, gy), fill=_c('conc', -3))

# ── 그림자 도우미 ────────────────────────────────────────
def bshadow(x, w, D=2):
    shade(V_cv, x, GF, w + 4, 8, 2); shade(V_cv, x, GF + 8, w + 4, 2, 1); shade(V_cv, x + w, GF - D * 16 + 8, 8, D * 16, 2)
class CvView:                                             # view34 의 shade/lower 는 Cv(numpy) 를 받는다 → 장면도 Cv 로 다룬다
    pass
from modern_style_bible_proof import Cv
import numpy as np
V_cv = Cv(W, H); V_cv.a[:, :] = np.array(scene)

def sync():
    global scene
    scene = Image.fromarray(V_cv.a.astype('uint8'), 'RGBA')
def flush_scene(): V_cv.a[:, :] = np.array(scene)

# ── 건물: 밴드 이름표대로 16px 열을 깔고 y 는 아래에서 위로 ──────────────
BUILD = [('tower', 0), ('cafe', 144), ('conbini', 288)]
placed = []
def build_img(kit):
    k = M['kits'][kit]; w, h = k['px']; im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for b in k['bands']:
        for i, n in enumerate(b['parts']): im.alpha_composite(part(n), (i * 16, b['y']))
    return im
for kit, x in BUILD:
    im = build_img(kit); placed.append((kit, x, GF - im.height, im))
# 그림자(건물 밑) — 건물보다 먼저 바닥에
for kit, x, y, im in placed: bshadow(x, im.width)
sync()

# 뒤에 숨는 행인 (건물보다 먼저) — 편의점 지붕판 뒤 (발 y=176, 머리 8px 만 지붕 뒤로 보인다)
HID = (352, 176)
hb = part('hero_b'); scene.alpha_composite(hb, (HID[0], HID[1] - 24))
for kit, x, y, im in placed: scene.alpha_composite(im, (x, y))
# 골목 입구 소품: 분리수거함(뒤쪽 벽 아래), 자판기(편의점 왼쪽 벽에 붙여)
scene.alpha_composite(part('bins'), (256, GF - 48))
flush_scene()

# 앞 소품(발 y 로 정렬): (이름, x, 발y, 그림자 반폭)
PROPS = [('lamp', 8, GF + 28, 5), ('tree', 136, GF + 30, 10), ('lamp', 244, GF + 28, 5), ('vend_a', 272, GF - 2, 7),
         ('busstop', 432, GF + 30, 20), ('taxi_l', 304, ROAD0 + 38, 0), ('taxi_r', 60, H - 4, 0),
         ('hero_a', 72, GF + 20, 0)]
PROPS.sort(key=lambda p: p[2])
for n, x, fy, sh in PROPS:
    p = part(n); w, h = p.size
    if sh: ell_shade(V_cv, x + w // 2 + 2, fy - 1, sh + 3, 2, 2)
    elif n.startswith('taxi'): ell_shade(V_cv, x + w // 2, fy - 2, 28, 3, 2)
    sync(); scene.alpha_composite(p, (x, fy - h)); flush_scene()
sync()
placed_props = [(n, x, fy - part(n).height, part(n)) for n, x, fy, _ in PROPS]
scene.save(os.path.join(HERE, 'scene.png'))

# ── 층·통행 겹침 (빨강=막힘, 파랑=위로 가려짐, 초록=문 앞 F) ────────────────
ov = scene.copy().convert('RGBA'); od = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(od)
def paint(kit_walk, x0, y0):
    for r, line in enumerate(kit_walk):
        for c, ch in enumerate(line):
            box = (x0 + c * 16, y0 + r * 16, x0 + c * 16 + 15, y0 + r * 16 + 15)
            if ch == 'S' or ch == 'X': d.rectangle(box, fill=(230, 40, 40, 120))
            elif ch == 'C': d.rectangle(box, fill=(40, 110, 240, 70))
            elif ch == 'F': d.rectangle(box, fill=(40, 200, 90, 150))
for kit, x, y, im in placed: paint(M['kits'][kit]['walk'], x, y)
for n, x, y, im in placed_props:      # 소품은 발 y 가 16 배수가 아니므로 화소 그대로: 아래 16px = 막힘(빨강), 그 위 = 가려짐(파랑)
    if n == 'hero_a' or n not in M['kits']: continue
    w, h = im.size; wk = M['kits'][n]['walk']
    d.rectangle((x, y, x + w - 1, y + h - 17), fill=(40, 110, 240, 70))
    d.rectangle((x, y + h - 16, x + w - 1, y + h - 1), fill=(230, 40, 40, 120))
# 숨은 행인: 발자국(빨강 X 아님, 주황 표시) + 머리 위 가림 여부
d.rectangle((HID[0], HID[1] - 24, HID[0] + 15, HID[1] - 1), outline=(255, 190, 0, 255), width=1)
ov = Image.alpha_composite(ov, od)
dd = ImageDraw.Draw(ov)
for c in range(cols + 1): dd.line([(c * 16, 0), (c * 16, H)], fill=(255, 255, 255, 28))
for r in range(rows + 1): dd.line([(0, r * 16), (W, r * 16)], fill=(255, 255, 255, 28))
ov.save(os.path.join(HERE, 'scene-overlay.png'))

# ── 킷 내보내기: 버들항 형식(id · name · w · h · walk · role · doors · assembly · up.png) ──
kd = os.path.join(HERE, 'kits'); os.makedirs(kd, exist_ok=True)
for kit, x, y, im in placed:
    k = M['kits'][kit]
    im.save(os.path.join(kd, f'gv2-{kit}.up.png'))
    json.dump(dict(id=f'gv2-{kit}', name={'tower': '강남 5층 상가', 'cafe': '강남 카페', 'conbini': '강남 편의점'}[kit], w=k['w'], h=k['h'],
                   walk=k['walk'], role='building', description=k['description'], doors=k['doors'], tags=['gangnam', 'modern3', 'view34'],
                   assembly=[dict(kit=n, x=(i * 16) // 16, y=b['y'] // 16) for b in k['bands'] for i, n in enumerate(b['parts'])]),
              open(os.path.join(kd, f'gv2-{kit}.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(dict(size=[W, H], tile=16, ground_line=GF, buildings=[dict(kit=k, x=x, y=y) for k, x, y, _ in placed],
               props=[dict(name=n, x=x, y=y) for n, x, y, _ in placed_props], hidden_hero=dict(x=HID[0], feet_y=HID[1])),
          open(os.path.join(HERE, 'scene-map.json'), 'w'), ensure_ascii=False, indent=1)
print('scene', scene.size, 'buildings', [(k, x, y) for k, x, y, _ in placed])
