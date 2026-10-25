#!/usr/bin/env python3
"""비교판: 작은 조립 장면(금 간 도로 교차로 · 폐허 둘 · 바리케이드 뒤 판잣집 · 녹슨 차 · 모닥불 · 노점 · 덤불)을 버들항 같은 크기 조각 옆에 3배로.
    python3 wl_scene.py [OUT.png]   (기본 tiledata/wasteland-ruins/compare-3x.png)
장면은 칸 격자 위에 바닥(흙·도로 오토타일·콘크리트 판)을 깔고 조각을 칸 좌표에 찍는다(굽기·구성기와 같은 칸 단위)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wl_all  # noqa: F401
import wl_core as C
import wl_ground as G
import numpy as np
from PIL import Image

GW, GH = 26, 20
# 바닥: . 흙(변형 해시) · # 도로 · t 발길 · s 콘크리트 판
ROWS = [
    '..........................',
    '..........................',
    '.sssssss..........##......',
    '.sssssss..........##......',
    '.sssssss..........##......',
    '.sssssss..........##......',
    '.sssssss..........##......',
    '......##..........##......',
    '##########################',
    '##########################',
    '......##..........##......',
    '......##..........##......',
    '......##..........##......',
    '......##..........##......',
    '......##..................',
    '......##..................',
    '......#####...............',
    '.tttttttttttttttt.........',
    '..........................',
    '..........................',
]
# (조각, x, y) 칸 좌표 — 왼쪽 위
PLACE = [
    ('husk-a', 1, 1), ('husk-tall', 9, 1), ('husk-b', 21, 1), ('wall-h', 14, 4),
    ('car-rust-h', 9, 7), ('car-rust-v', 18, 10), ('jersey-barrier', 12, 10), ('lamp-broken', 5, 10),
    ('fence-h', 9, 11), ('fence-h', 10, 11), ('gate-scrap', 11, 10), ('fence-h', 13, 11), ('fence-h', 14, 11), ('fence-h', 15, 11),
    ('wall-v', 16, 11), ('wall-v', 16, 14),
    ('wall-v', 8, 12), ('barricade-h', 8, 16),
    ('shack-a', 9, 13), ('shack-b', 12, 13), ('lean-to', 1, 11), ('campfire', 4, 12), ('log-seat', 3, 13), ('stall-a', 1, 15), ('stall-b', 4, 15),
    ('water-tank', 23, 13), ('generator', 18, 16), ('solar-scrap', 18, 15), ('drums', 17, 14), ('tyres', 20, 14), ('crates', 1, 18),
    ('scrap-heap', 23, 17), ('rubble-pile', 15, 7), ('dead-tree', 23, 10), ('bush-wild', 4, 17), ('vine-wall', 7, 18), ('sign-blank', 20, 12), ('wall-stub', 15, 1),
    ('rubble-a', 8, 6), ('rubble-b', 16, 9), ('weeds-a', 2, 10), ('weeds-b', 25, 10), ('weeds-c', 14, 18), ('puddle', 13, 9), ('rubble-c', 20, 10),
]


def cell(pid, cx=0, cy=0):
    a = C.render(C.PIECES[pid]); return a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]


def build():
    lay = ['' .join('#' if ch == '#' else '.' for ch in r) for r in ROWS]
    ms = G.auto_masks(lay)
    mt = G.auto_masks(['' .join('#' if ch == 't' else '.' for ch in r) for r in ROWS])
    img = np.zeros((GH * 16, GW * 16, 4), np.uint8)
    for y in range(GH):
        for x in range(GW):
            ch = ROWS[y][x]
            if ch == '#':
                m = ms[(x, y)]
                t = cell('asphalt', m % 4, m // 4)
                if m == 15 and C.hsh(x, y, 7) % 10 < 3: t = cell('asphalt', C.hsh(y, x, 8) % 4, 4)   # 구성기처럼 꽉 찬 칸 30% 속 변형
            elif ch == 't':
                m = mt[(x, y)]; t = cell('track', m % 4, m // 4)
            elif ch == 's': t = cell('slab-' + 'aaaaaabbcc'[C.hsh(x, y, 5) % 10], x % 8, y % 8)       # 이음 판: 자리 (x mod 4, y mod 4)
            else: h = C.hsh(x, y, 6) % 16; t = cell('dirt-' + ('b' if h < 10 else 'c' if h < 13 else 'd'), x % 4, y % 4)   # 구성기와 같은 무게 b:c:d = 10:3:3 (dirt-a 는 뺐다)
            img[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = t
    im = Image.fromarray(img, 'RGBA')
    for (pid, x, y) in sorted(PLACE, key=lambda p: (p[2] + C.PIECES[p[0]]['h'], p[1])):
        p = C.PIECES[pid]
        im.alpha_composite(Image.fromarray(C.render(p), 'RGBA'), (x * 16, y * 16))
    return im


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(C.OUT, 'compare-3x.png')
    sc = build()
    bd = Image.open(os.path.join(C.ROOT, 'tiledata/beodeul-city/render/city6.png')).convert('RGBA')
    bx, by = int(os.environ.get('BX', 880)), int(os.environ.get('BY', 1000))
    bc = bd.crop((bx, by, bx + sc.width, by + sc.height))
    gap = 8
    S = Image.new('RGBA', (sc.width * 2 + gap, sc.height), (30, 30, 30, 255))
    S.alpha_composite(sc, (0, 0)); S.alpha_composite(bc, (sc.width + gap, 0))
    S = S.resize((S.width * 3, S.height * 3), Image.NEAREST)
    os.makedirs(os.path.dirname(out), exist_ok=True); S.save(out); sc.save(out.replace('.png', '-scene1x.png'))
    print(out, S.size)


if __name__ == '__main__': main()
