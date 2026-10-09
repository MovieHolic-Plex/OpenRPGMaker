# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-reeds 를 둥근 덩이 윤곽으로.
#   옛 판(sd_parts.reeds_cell): 투명 바탕에 갈대 줄기만 — 덩이 윤곽이 없고 줄기 끝이 칸 경계를 넘나들어 이음매 튐 12px, 규약 위반 8.
#   새 판: 윤곽은 공용 깊이장 autotile_edge.edge_fields(정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7).
#   윤곽 안에 갈대밭 밑 그늘(REED[1] 반투명, 바깥 1.2px 은 옅게)을 깔고, 갈대 줄기·잎·이삭은 옛 판 규칙 그대로(밑동 y=7·15 두 줄,
#   가장자리로 갈수록 성기고 낮다) 그리되 윤곽 밖 화소는 버린다. 걷기·막힘 규칙·이름 그대로.
#   덮어쓰는 파일: parts/autotile-reeds.png 하나(sd_parts.autotile_reeds 가 이 판을 부른다).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
from PIL import Image
from sd_art import REED
from px2 import _hash
from autotile_edge import edge_fields

SEED = 73
EDGE_SEED = 31                                                            # 윤곽 잡음 씨앗(감사 bad 가 가장 낮은 것)
SHADE = REED[1]


def reeds_cell(n, seed=SEED, eseed=None, inset=2.0, jag=2.8, rad=7.0):
    m = edge_fields(n, inset, jag, rad, EDGE_SEED if eseed is None else eseed)[0]
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < 0: continue
            px[x, y] = SHADE + ((40 if v < 1.2 else 96),)                          # 갈대밭 밑 그늘(물·진흙이 비친다)

    def put(xx, y, c):
        if 0 <= xx < 16 and 0 <= y < 16 and m[y, xx] >= 0: px[xx, y] = c + (255,)
    for base in (7, 15):
        for x in range(16):
            if _hash(x, base, seed) > 0.72: continue
            if m[base, x] < 0: continue
            depth = m[base, x]
            if depth < 2.5 and _hash(x, base, seed + 1) < 0.55: continue
            hgt = 3 + int(_hash(x, base, seed + 2) * (6 if base == 15 else 5))
            if depth < 3: hgt = max(2, hgt - 3)
            top = base - hgt
            lean = -1 if _hash(x, base, seed + 3) < 0.3 else (1 if _hash(x, base, seed + 3) > 0.75 else 0)
            for k, y in enumerate(range(base, top, -1)):
                xx = x + (lean if k >= hgt - 2 else 0)
                f = k / max(1, hgt)
                c = REED[2] if f < 0.3 else (REED[3] if f < 0.7 else REED[4])
                if xx < 8 and f > 0.5: c = REED[5]
                put(xx, y, c)
            if _hash(x, base, seed + 4) < 0.18:                                     # 이삭
                put(x, top + 1, (126, 78, 44)); put(x, top + 2, (98, 58, 32))
            put(x, base, REED[1])                                                   # 밑동 그늘
    return im


def autotile_reeds(eseed=None):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i in range(16): sh.alpha_composite(reeds_cell(i, eseed=eseed), ((i % 4) * 16, (i // 4) * 16))
    return sh


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-reeds.png')
    autotile_reeds().save(out); print('wrote', out)
