"""설계도 → 기준 이미지. 건물 윤곽(X·D·G·A) 진한 점선, 머리 공간(*) 옅은 회색 점선, 안쪽 옅은 16px 격자,
입구(D) = 원본 그대로(위 검정·아래 359), 성문 통로(G) = 검정, 지붕/앞벽 경계(zones R|W) = 파란 점선(처마선). 오른쪽 = 화풍 기준(원본 집 또는 참고 맵 일부, 같은 배율)."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from fhlib import *
BP = json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))
K, T, C = BP['scale'], BP['tile'], 1254
BODY = 'XDGA'
def style_img(st):
    if 'form' in st: return house_render(st['form'])
    name, x, y, w, h = st['crop']
    return Image.open(f'{OUT}/ctx-{name}-before.png').crop((x * T, y * T, (x + w) * T, (y + h) * T)).convert('RGBA')
ids = sys.argv[1:]
for bp in BP['blueprints']:
    if ids and bp['id'] not in ids: continue
    m = bp['map']; H, W = len(m), len(m[0]); cs = T * K
    style = style_img(bp.get('style', BP['style'])); st = style.resize((style.width * K, style.height * K), Image.NEAREST)
    bw, bh = W * cs, H * cs
    x0 = (C - (bw + 60 + st.width)) // 2; y0 = (C - bh) // 2
    ref = Image.new('RGB', (C, C), MAGENTA); d = ImageDraw.Draw(ref)
    at = lambda x, y: m[y][x] if 0 <= y < H and 0 <= x < W else '.'
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            if c in BODY or c == '*': d.rectangle([x0 + x * cs, y0 + y * cs, x0 + (x + 1) * cs - 1, y0 + (y + 1) * cs - 1], outline=(228, 60, 228))
            if c == 'D':
                top = at(x, y + 1) == 'D'
                im = (Image.new('RGBA', (T, T), (0, 0, 0, 255)) if top else tile(359)).resize((cs, cs), Image.NEAREST); ref.paste(im, (x0 + x * cs, y0 + y * cs), im)
            if c == 'G': d.rectangle([x0 + x * cs, y0 + y * cs, x0 + (x + 1) * cs - 1, y0 + (y + 1) * cs - 1], fill=(8, 8, 10))
    def dash(p, q, col):
        (ax, ay), (bx, by) = p, q; L = max(abs(bx - ax), abs(by - ay))
        for t in range(0, L, 16):
            e = min(t + 8, L)
            d.line([(ax + (bx - ax) * t // L, ay + (by - ay) * t // L), (ax + (bx - ax) * e // L, ay + (by - ay) * e // L)], fill=col, width=3)
    for group, col in ((BODY, (20, 20, 20)), ('*', (160, 160, 160))):
        inside = lambda x, y: at(x, y) in group
        for y in range(H + 1):
            for x in range(W + 1):
                if x < W and inside(x, y) != inside(x, y - 1):
                    if group == '*' and (at(x, y) in BODY or at(x, y - 1) in BODY): continue   # 몸통과 맞닿은 선은 진한 선이 이긴다
                    dash((x0 + x * cs, y0 + y * cs), (x0 + (x + 1) * cs, y0 + y * cs), col)
                if y < H and inside(x, y) != inside(x - 1, y):
                    if group == '*' and (at(x, y) in BODY or at(x - 1, y) in BODY): continue
                    dash((x0 + x * cs, y0 + y * cs), (x0 + x * cs, y0 + (y + 1) * cs), col)
    z = bp.get('zones'); zat = lambda x, y: z[y][x] if z and 0 <= y < H and 0 <= x < W else '-'
    if z and bp.get('zoneTint'):                   # 지붕 구역을 옅은 주황으로(점선만으로는 처마가 위로 뜬다)
        for y in range(H):
            for x in range(W):
                if zat(x, y) == 'R': d.rectangle([x0 + x * cs + 1, y0 + y * cs + 1, x0 + (x + 1) * cs - 2, y0 + (y + 1) * cs - 2], fill=(246, 196, 150))
    if z:                                          # 처마선: 지붕(R)과 앞벽(W)이 맞닿는 경계 = 파란 점선
        rw = lambda a, b: {a, b} == {'R', 'W'}
        for y in range(H + 1):
            for x in range(W + 1):
                if x < W and rw(zat(x, y), zat(x, y - 1)): dash((x0 + x * cs, y0 + y * cs), (x0 + (x + 1) * cs, y0 + y * cs), (0, 90, 255))
                if y < H and rw(zat(x, y), zat(x - 1, y)): dash((x0 + x * cs, y0 + y * cs), (x0 + x * cs, y0 + (y + 1) * cs), (0, 90, 255))
    ref.paste(st, (x0 + bw + 60, y0 + bh - st.height), st)
    ref.save(f"{OUT}/{bp['id']}-ref.png")
    json.dump(dict(origin=[x0, y0], scale=K, cells=[W, H]), open(f"{OUT}/{bp['id']}-ref.json", 'w'))
    print(bp['id'], W, H, x0, y0, 'style', st.size)
