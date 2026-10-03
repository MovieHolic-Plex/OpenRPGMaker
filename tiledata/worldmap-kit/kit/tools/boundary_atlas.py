#!/usr/bin/env python3
"""경계 도감 — 지도에 실제로 있는 바닥 쌍마다 경계 한 곳을 확대해 전/후를 나란히 놓는다(적대적 시각 QA 의 입력).

  python3 kit/tools/boundary_atlas.py --world out/world.json --after out/fantasy-original.png [--before old.png] --out atlas.png

쌍(같은 높이 단에서 4방향으로 맞닿은 두 바닥)마다 경계 칸이 가장 많은 곳 근처에서, 장소·길·숲·산이 적은 칸을 고른다.
칸 하나 = 지형 3x3칸(48px) 을 4배. 위에 쌍 이름, 왼쪽 before · 오른쪽 after.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
import terrain_v4 as V  # noqa: E402

FONT = None
for f in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'):
    if Path(f).exists():
        FONT = ImageFont.truetype(f, 14)
        break


def sites(world, per_pair=1):
    G = np.array(world['ground'], np.int16)
    Hh = np.array(world['height_level'], np.int16)
    O = np.array(world['object'], np.int16)
    H, W = G.shape
    busy = O > 0
    for key in ('road_cells', 'foot_cells'):
        for x, y in world.get(key, []):
            busy[y, x] = True
    cand = {}
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            a = int(G[y, x])
            if a < 10:
                continue
            for dx, dy in ((1, 0), (0, 1)):
                b = int(G[y + dy, x + dx])
                if b < 10 or b == a or Hh[y + dy, x + dx] != Hh[y, x]:
                    continue
                k = tuple(sorted((a, b)))
                win = busy[y - 1:y + 2, x - 1:x + 2].sum() + (Hh[y - 1:y + 2, x - 1:x + 2] != Hh[y, x]).sum() * 2
                cand.setdefault(k, []).append((int(win), x, y))
    out = []
    for k, v in sorted(cand.items()):
        v.sort()
        picked = []
        for s in v:
            if all(abs(s[1] - p[1]) + abs(s[2] - p[2]) > 8 for p in picked):
                picked.append(s)
            if len(picked) >= per_pair:
                break
        for s in picked:
            out.append((k, s[1], s[2], len(v)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--world', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--before')
    ap.add_argument('--out', required=True)
    ap.add_argument('--per-pair', type=int, default=1)
    ap.add_argument('--zoom', type=int, default=4)
    a = ap.parse_args()
    world = json.loads(Path(a.world).read_text())
    imgs = [np.array(Image.open(p).convert('RGB')) for p in ([a.before] if a.before else []) + [a.after]]
    ss = sites(world, a.per_pair)
    z = a.zoom
    cw = 48 * z
    tw = cw * len(imgs) + 6 * (len(imgs) - 1)
    cols = 3 if len(imgs) == 2 else 5
    rows = (len(ss) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 12), rows * (cw + 26)), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, ((ga, gb), x, y, n) in enumerate(ss):
        r, c = divmod(i, cols)
        ox, oy = c * (tw + 12), r * (cw + 26)
        d.text((ox + 2, oy + 2), '%s ↔ %s  (%d,%d) · 경계 %d칸' % (V.NAMES.get(ga, ga), V.NAMES.get(gb, gb), x, y, n), fill=(230, 230, 230), font=FONT)
        for j, im in enumerate(imgs):
            crop = im[(y - 1) * 16:(y + 2) * 16, (x - 1) * 16:(x + 2) * 16]
            sheet.paste(Image.fromarray(crop).resize((cw, cw), Image.NEAREST), (ox + j * (cw + 6), oy + 22))
    sheet.save(a.out)
    print('%d쌍 %d곳 -> %s' % (len({s[0] for s in ss}), len(ss), a.out))


if __name__ == '__main__':
    main()
