"""4단계 지형 어휘 도감: 바닥 18종(바다 위 덩이 + 안쪽 이웃 바닥 경계), 고원 2색, 물 3종, 물체 9종을 실제 렌더러로 그려 한 장에 모은다.
출력: terrain-sheet-v4.png(2배), terrain-sheet-v4.json(종류·고유 칸 수)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from terrain_v4 import *
import terrain_v4 as V

PW, PH = 10, 7
SHAPE = {1: (2, 7), 2: (1, 8), 3: (1, 8), 4: (1, 8), 5: (2, 7)}


def base(g, inner):
    G = np.zeros((PH, PW), np.int16)
    for y, (a, b) in SHAPE.items():
        G[y, a:b + 1] = g
    G[2:5, 5:8] = inner
    return G


def draw(M, decor=False):
    img = render_ground(M)
    render_faces(M, img)
    render_objects(M, img)
    render_water(M, img)
    render_depth(M, img)
    render_ramps(M, img)
    return img


panels = []   # (title, img)
for g in GROUNDS:
    inner = SAND if g in (GRASS, JUNGLE, FARM, CROP, SAVANNA, SWAMP) else GRASS
    G = base(g, inner)
    panels.append((f'{NAMES[g]}  (안쪽 = {NAMES[inner]})', draw(Map4(G))))
for g in (CHASM, CRATER, MARSH, BASALT, GLACIER):
    if g not in GROUNDS:
        inner = GRASS
        panels.append((f'{NAMES[g]}  (안쪽 = 초원)', draw(Map4(base(g, inner)))))
seen = set(int(g) for g in GROUNDS) | set()
# 고원 2색(갈색 = 초원 위, 회색 = 툰드라 위)
for g, nm in ((GRASS, '고원: 갈색 바위 (초원 위, 2단)'), (TUNDRA, '고원: 회색 바위 (툰드라 위)')):
    G = np.full((PH, PW), g, np.int16); G[0, :] = SEA; G[:, 0] = SEA; G[:, -1] = SEA; G[-1, :] = SEA
    Hh = np.zeros((PH, PW), np.int16)
    Hh[1:4, 2:8] = 1
    if g == GRASS: Hh[1:3, 3:6] = 2
    RAMP = np.zeros((PH, PW), bool)
    panels.append((nm, draw(Map4(G, None, Hh, RAMP=RAMP))))
# 물 3종
G = np.full((PH, PW), GRASS, np.int16)
G[1:3, 1:5] = RIVER; G[1:3, 5:9] = RIVER
G[4:6, 1:4] = LAVA; G[4:6, 6:9] = TOXIC
G[3, :] = GRASS
panels.append(('강·용암·독수 (풀밭 위)', draw(Map4(G))))
# 물체 9종: 바닥 위 3x3 덩이
OBJS = [(BROAD, GRASS, '활엽수'), (CONIFER, GRASS, '침엽수'), (JUNGLEF, JUNGLE, '정글 숲'), (DEAD, DIRT, '고사목'), (SNOWF, SNOW, '눈 숲'),
        (MOUNT, GRASS, '갈색 산'), (SMOUNT, SNOW, '눈 산'), (VOLC, ASH, '화산'), (MESA, BADLANDS, '붉은 메사')]
for o, g, nm in OBJS:
    G = np.full((PH, PW), g, np.int16); O = np.zeros((PH, PW), np.int16)
    O[2:5, 2:8] = o
    O[2, 2] = 0; O[4, 7] = 0
    panels.append((f'{nm}', draw(Map4(G, O))))

COLS = 4
S2 = 2
pw, ph = PW * 16 * S2, PH * 16 * S2 + 22
rows = (len(panels) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (pw + 10) + 10, rows * (ph + 10) + 10), (21, 24, 29))
d = ImageDraw.Draw(sheet)
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf', 14)
uniq = set()
for i, (title, img) in enumerate(panels):
    im = Image.fromarray(img)
    for ty in range(PH):
        for tx in range(PW):
            uniq.add(img[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16].tobytes())
    im = im.resize((pw, PH * 16 * S2), Image.NEAREST)
    x, y = 10 + (i % COLS) * (pw + 10), 10 + (i // COLS) * (ph + 10)
    d.text((x, y + 2), title, fill=(230, 230, 230), font=FONT)
    sheet.paste(im, (x, y + 22))
sheet.save(HERE / 'terrain-sheet-v4.png')
json.dump({'panels': [t for t, _ in panels], 'unique_tiles_in_sheet': len(uniq), 'ground_types': len(GROUNDS)},
          open(HERE / 'terrain-sheet-v4.json', 'w'), ensure_ascii=False)
print(len(panels), 'panels', len(uniq), 'unique tiles', sheet.size)
