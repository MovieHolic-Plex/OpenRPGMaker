"""tiledata/gothic-manor/places/*.json(build_gothic_place 결과) → 같은 이름 .png(원본 해상도) + 독립 통행 검사(4층 모두 통행이어야 걷는 칸).
  python3 scripts/content/gothic-manor/render_places.py [--mark]   --mark: 갇힌 칸 빨강·문 초록·시작 노랑을 /tmp/gmplaces/ 에 따로 그린다."""
import glob, json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/gothic-manor/gothic-manor-chipset.png')).convert('RGBA')
TS = json.load(open(os.path.join(ROOT, 'src/assets/gothicManorTileset.json'), encoding='utf-8'))
TPR = TS['tilesPerRow']; P = TS['passability']
LAYERS = ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles')
cache = {}


def cell(t):
    if t not in cache: cache[t] = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))
    return cache[t]


def render(s):
    W, H = s['w'], s['h']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for k in LAYERS:
        for i, t in enumerate(s.get(k) or []):
            if t >= 0: im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    return im


def walk_cells(s):
    W, H = s['w'], s['h']; ok = []
    for i in range(W * H):
        ts = [s[k][i] for k in LAYERS if s.get(k) and s[k][i] >= 0]
        top = [t for t in ts]
        ok.append(bool(ts) and all((P[t]['up'] or P[t]['down'] or P[t]['left'] or P[t]['right']) for t in top))
    return ok


def comps(s, ok):
    W, H = s['w'], s['h']; seen = [False] * (W * H); out = []
    for a in range(W * H):
        if not ok[a] or seen[a]: continue
        seen[a] = True; st = [a]; c = []
        while st:
            i = st.pop(); c.append(i); x, y = i % W, i // W
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and ok[j] and not seen[j]: seen[j] = True; st.append(j)
        out.append(c)
    return sorted(out, key=len, reverse=True)


if __name__ == '__main__':
    mark = '--mark' in sys.argv
    os.makedirs('/tmp/gmplaces', exist_ok=True)
    for f in sorted(glob.glob(os.path.join(ROOT, 'tiledata/gothic-manor/places/*.json'))):
        s = json.load(open(f, encoding='utf-8')); W, H = s['w'], s['h']
        im = render(s); im.save(f[:-5] + '.png')
        ok = walk_cells(s); cs = comps(s, ok)
        small = [c for c in cs[1:]]
        print(os.path.basename(f), f'{W}x{H}', '걷는 칸', sum(ok), '덩이', len(cs), '작은 덩이 칸수', [len(c) for c in small][:8])
        if mark:
            m = im.copy(); d = ImageDraw.Draw(m)
            for c in small:
                for i in c: d.rectangle(((i % W) * 16, (i // W) * 16, (i % W) * 16 + 15, (i // W) * 16 + 15), outline=(255, 0, 0, 255))
            for e in (s.get('entrances') or []): d.rectangle((e['x'] * 16, e['y'] * 16, e['x'] * 16 + 15, e['y'] * 16 + 15), outline=(0, 255, 0, 255))
            for e in (s.get('doorCells') or []): d.rectangle((e['x'] * 16, e['y'] * 16, e['x'] * 16 + 15, e['y'] * 16 + 15), outline=(0, 255, 0, 255))
            sp = s['spawn']; d.rectangle((sp['x'] * 16, sp['y'] * 16, sp['x'] * 16 + 15, sp['y'] * 16 + 15), outline=(255, 255, 0, 255))
            m.save('/tmp/gmplaces/' + os.path.basename(f)[:-5] + '.png')
