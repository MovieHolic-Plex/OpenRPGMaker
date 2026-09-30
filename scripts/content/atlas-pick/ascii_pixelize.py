"""생성 이미지 → 팔레트 제한 → 모노스페이스 아스키아트 → 다시 픽셀화 (데모).

제안된 변환 경로를 그대로 재현하고, 흔한 두 방법(최근접 축소, 평균 축소+양자화)과 나란히 보인다.
에셋 채택용이 아니다 — 생성 픽셀을 옮기는 경로라 사용자 규칙(2026-09-30)상 데모 전용.

  python3 scripts/content/atlas-pick/ascii_pixelize.py
출력: tiledata/atlas-pick/ascii-pixelize/{<이름>-*.png, <이름>.txt, result.json}
"""
import json, re
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / 'tiledata/atlas-pick/bakeoff/c-32px/raw/P-r1-1.png'
PAL = ROOT / 'tiledata/atlas-pick/palette/modern3.pal'
OUT = ROOT / 'tiledata/atlas-pick/ascii-pixelize'
K = 10  # 물건 하나가 쓰는 색 수 상한
CHARS = '@#%&$*+=~:'  # 어두움 → 밑음. 투명은 '.'

# 생성 그림(P-r1-1, 1774×887) 속 물건 상자와 modern3 축척표 목표 크기
TARGETS = {
    'tree_sakura': (32, 48), 'tree_green': (32, 48),
    'vending_red': (16, 26), 'vending_blue': (16, 26),
    'street_lamp': (16, 40), 'traffic_light': (32, 48),
    'hero': (16, 24), 'taxi': (56, 24), 'guardrail': (48, 16),
}


def palette():
    cols = []
    for line in PAL.read_text(encoding='utf-8').splitlines():
        if line.startswith('@ramp'):
            cols += [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in re.findall(r'#[0-9a-fA-F]{6}', line)]
    return sorted(set(cols))


def dist(a, b):
    r = (a[0] + b[0]) / 2
    return (2 + r / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - r) / 256) * (a[2] - b[2]) ** 2


def nearest(c, pal, cache):
    if c not in cache:
        cache[c] = min(pal, key=lambda p: dist(c, p))
    return cache[c]


def pick_k(cnt, k):
    """많이 쓴 색부터, 그다음은 「면적^0.5 × 이미 고른 색과의 거리」가 큰 색 — 신호등 불빛 같은 작은 강조색을 살린다."""
    items = list(cnt.items())
    chosen = [max(items, key=lambda t: t[1])[0]]
    while len(chosen) < min(k, len(items)):
        c = max((c for c, _ in items if c not in chosen),
                key=lambda c: cnt[c] ** 0.5 * min(dist(c, d) for d in chosen))
        chosen.append(c)
    return chosen


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def boxes(im):
    """자홍 바탕 위 회색 상자들 — 연결 성분(행·열 투영 반복)."""
    w, h = im.size
    px = im.load()
    mag = lambda c: c[0] > 200 and c[1] < 60 and c[2] > 200
    seen = [[False] * w for _ in range(h)]
    out = []
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            if seen[y][x] or mag(px[x, y]):
                continue
            stack = [(x, y)]; seen[y][x] = True
            x0 = x1 = x; y0 = y1 = y
            while stack:
                cx, cy = stack.pop()
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for nx, ny in ((cx + 4, cy), (cx - 4, cy), (cx, cy + 4), (cx, cy - 4)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and not mag(px[nx, ny]):
                        seen[ny][nx] = True; stack.append((nx, ny))
            if (x1 - x0) > 40 and (y1 - y0) > 40:
                out.append((x0, y0, x1 + 1, y1 + 1))
    return sorted(out, key=lambda b: (b[1] // 200, b[0]))


def object_mask(crop):
    """상자 회색 바탕을 투명으로 — 가장자리 최빈색에 가까운 색."""
    w, h = crop.size
    px = crop.load()
    edge = Counter(px[x, y] for x in range(w) for y in (0, 1, h - 2, h - 1))
    bg = edge.most_common(1)[0][0]
    return [[dist(px[x, y], bg) > 1800 for x in range(w)] for y in range(h)], bg


def tight(mask):
    ys = [y for y, r in enumerate(mask) if any(r)]
    xs = [x for x in range(len(mask[0])) if any(mask[y][x] for y in ys)]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def run_one(name, crop, target, pal):
    mask, bg = object_mask(crop)
    x0, y0, x1, y1 = tight(mask)
    crop = crop.crop((x0, y0, x1, y1)); mask = [r[x0:x1] for r in mask[y0:y1]]
    w, h = crop.size
    tw, th = target
    # 축척표 크기 안에 비율 유지로 맞춤(아래·가운데 정렬)
    s = min(tw / w, th / h)
    gw, gh = max(1, round(w * s)), max(1, round(h * s))
    ox, oy = (tw - gw) // 2, th - gh

    # 1) 팔레트 제한 — 원 해상도에서 modern3 최근접, 그다음 많이 쓴 K색만
    px = crop.load(); cache = {}
    q = [[nearest(px[x, y], pal, cache) if mask[y][x] else None for x in range(w)] for y in range(h)]
    top = pick_k(Counter(c for r in q for c in r if c), K)
    q = [[(min(top, key=lambda p: dist(c, p)) if c not in top else c) if c else None for c in r] for r in q]

    # 2) 아스키아트 — 한 글자 = 한 픽셀, 칸 안 최빈 색(평균 아님 → 섞인 중간색이 안 생김)
    order = sorted(top, key=lum)
    ch = {c: CHARS[i] for i, c in enumerate(order)}
    grid = [['.'] * tw for _ in range(th)]
    for gy in range(gh):
        for gx in range(gw):
            sx0, sx1 = int(gx * w / gw), max(int(gx * w / gw) + 1, int((gx + 1) * w / gw))
            sy0, sy1 = int(gy * h / gh), max(int(gy * h / gh) + 1, int((gy + 1) * h / gh))
            cnt = Counter(q[y][x] for y in range(sy0, sy1) for x in range(sx0, sx1))
            solid = sum(v for c, v in cnt.items() if c)
            if solid * 2 < sum(cnt.values()):
                continue
            c = max((c for c in cnt if c), key=lambda c: cnt[c])
            grid[oy + gy][ox + gx] = ch[c]
    text = '\n'.join(''.join(r) for r in grid)

    # 3) 다시 픽셀화 — 글자 → 팔레트 색
    back = {v: k for k, v in ch.items()}
    img = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    for y, r in enumerate(grid):
        for x, c in enumerate(r):
            if c != '.':
                img.putpixel((x, y), back[c] + (255,))

    # 비교 A: 최근접 축소(생성 그림 그대로)
    rgba = crop.convert('RGBA'); a = rgba.load()
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                a[x, y] = (0, 0, 0, 0)
    A = Image.new('RGBA', (tw, th)); A.paste(rgba.resize((gw, gh), Image.NEAREST), (ox, oy))
    # 비교 B: 평균 축소 → modern3 양자화
    Bs = rgba.resize((gw, gh), Image.BOX); b = Bs.load()
    for y in range(gh):
        for x in range(gw):
            p = b[x, y]
            b[x, y] = (nearest(p[:3], pal, cache) + (255,)) if p[3] > 127 else (0, 0, 0, 0)
    B = Image.new('RGBA', (tw, th)); B.paste(Bs, (ox, oy))

    # 비교 D: 「글자 모양」 아스키아트 — 밝기를 글자 잉크 농도로 적고(' .:-=+*#%@'), 색은 칸 최빈 색.
    # 고정폭 글꼴로 실제로 그린 뒤 목표 크기로 다시 픽셀화(평균 → 이 물건 K색으로 양자화).
    D, dtext = glyph_variant(q, mask, crop, w, h, gw, gh, top)
    Dimg = Image.new('RGBA', (tw, th)); Dimg.paste(D[0], (ox, oy))
    D[1].save(OUT / f'{name}-d-render.png')
    (OUT / f'{name}-glyph.txt').write_text(dtext + '\n', encoding='utf-8')

    for tag, im in (('a-nearest', A), ('b-box-quant', B), ('c-ascii', img), ('d-glyph', Dimg)):
        im.save(OUT / f'{name}-{tag}.png')
    (OUT / f'{name}.txt').write_text(text + '\n', encoding='utf-8')
    crop.save(OUT / f'{name}-src.png')
    colors = lambda im: len({p for p in im.getdata() if p[3]})
    return {'name': name, 'target': target, 'src': [w, h], 'legend': {v: '#%02x%02x%02x' % k for k, v in ch.items()},
            'colors': {'a': colors(A), 'b': colors(B), 'c': colors(img), 'd': colors(Dimg)}}


GLYPHS = ' .:-=+*#%@'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'


def glyph_variant(q, mask, crop, w, h, gw, gh, top):
    from PIL import ImageDraw, ImageFont
    cols, rows = gw * 2, gh  # 고정폭 글자는 세로가 가로의 약 2배 → 한 픽셀 = 가로 2글자
    px = crop.convert('L').load()
    lines, colors = [], []
    for gy in range(rows):
        line, crow = '', []
        for gx in range(cols):
            sx0, sx1 = int(gx * w / cols), max(int(gx * w / cols) + 1, int((gx + 1) * w / cols))
            sy0, sy1 = int(gy * h / rows), max(int(gy * h / rows) + 1, int((gy + 1) * h / rows))
            cells = [(x, y) for y in range(sy0, sy1) for x in range(sx0, sx1) if mask[y][x]]
            if len(cells) * 2 < (sx1 - sx0) * (sy1 - sy0):
                line += ' '; crow.append(None); continue
            v = sum(px[x, y] for x, y in cells) / len(cells)
            line += GLYPHS[min(len(GLYPHS) - 1, 1 + int(v / 256 * (len(GLYPHS) - 1)))]
            crow.append(Counter(q[y][x] for x, y in cells).most_common(1)[0][0])
        lines.append(line); colors.append(crow)
    font = ImageFont.truetype(FONT, 12)
    cw, chh = 7, 14
    render = Image.new('RGBA', (cols * cw, rows * chh), (0, 0, 0, 0))
    dr = ImageDraw.Draw(render)
    for y, (line, crow) in enumerate(zip(lines, colors)):
        for x, (c, col) in enumerate(zip(line, crow)):
            if col:
                dr.text((x * cw, y * chh), c, font=font, fill=col + (255,))
    # 다시 픽셀화: 글자마다 실제 잉크 농도를 재어(렌더 결과에서) 밝기로 되돌리고, 색상은 칸 색에서 가져온다.
    # 한 픽셀 = 가로 2글자. 점수 = 칸 색과의 거리 + 잉크 밝기와 후보 밝기 차 → 이 물건 K색 중 하나.
    alpha = render.getchannel('A').load()
    full = max(1, max(sum(alpha[x, y] for y in range(chh) for x in range(cw)) for _ in [0]))
    ink = {}
    for g in GLYPHS:
        t = Image.new('L', (cw, chh)); ImageDraw.Draw(t).text((0, 0), g, font=font, fill=255)
        ink[g] = sum(t.getdata()) / 255
    top_ink = max(ink.values()) or 1
    out = Image.new('RGBA', (gw, gh), (0, 0, 0, 0))
    for y in range(gh):
        for x in range(gw):
            pair = [(lines[y][i], colors[y][i]) for i in (2 * x, 2 * x + 1) if i < cols and colors[y][i]]
            if not pair:
                continue
            level = sum(ink[g] for g, _ in pair) / len(pair) / top_ink
            col = Counter(c for _, c in pair).most_common(1)[0][0]
            want = level * 255
            best = min(top, key=lambda p: dist(col, p) / 9 + (lum(p) - want) ** 2 * 3)
            out.putpixel((x, y), best + (255,))
    return (out, render), '\n'.join(lines)


def main():
    pal = palette()
    im = Image.open(RAW).convert('RGB')
    bx = boxes(im)
    names = list(TARGETS)
    assert len(bx) == len(names), (len(bx), bx)
    res = [run_one(n, im.crop(b), TARGETS[n], pal) for n, b in zip(names, bx)]
    (OUT / 'result.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    for r in res:
        print(r['name'], r['src'], '→', r['target'], r['colors'])


if __name__ == '__main__':
    main()
