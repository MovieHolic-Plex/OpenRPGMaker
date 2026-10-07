"""tiledata/wizarding/spaces/*.json(빌더 결과) → 같은 이름 .png(원본 해상도) + 독립 통행 검사(4층 모두 통행이어야 걷는 칸).
  python3 scripts/content/wizarding/render_spaces.py [--mark]   --mark: 갇힌 칸 빨강·문 초록·시작 노랑 테두리를 /tmp/wzspaces/ 에 따로 그린다."""
import glob, json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png')).convert('RGBA')
TS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
TPR = TS['tilesPerRow']; P = TS['passability']
LAYERS = ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles')
cache = {}
def cell(t):
    if t not in cache: cache[t] = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))
    return cache[t]
def walk_cells(s):
    W, H = s['w'], s['h']
    ok = []
    for i in range(W * H):
        ts = [s[k][i] for k in LAYERS if s.get(k) and s[k][i] >= 0]
        ok.append(bool(ts) and s['lowerTiles'][i] >= 0 and all(P[t]['up'] for t in ts))
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
mark = '--mark' in sys.argv
os.makedirs('/tmp/wzspaces', exist_ok=True)
for f in sorted(glob.glob(os.path.join(ROOT, 'tiledata/wizarding/spaces/*.json'))):
    s = json.load(open(f, encoding='utf-8')); W, H = s['w'], s['h']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for k in LAYERS:
        for i, t in enumerate(s.get(k) or []):
            if t >= 0: im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    im.save(f[:-5] + '.png', optimize=True)
    cs = comps(s, walk_cells(s)); main = set(cs[0]) if cs else set()
    door_in = all(any(abs(d['x'] - i % W) + abs(d['y'] - i // W) <= 1 for i in main) for d in s['doorCells'])
    print(f"{os.path.basename(f)[:-5]:30s} {W}x{H} 덩이 {[len(c) for c in cs[:4]]} 문닿음 {door_in} 시작 {s['spawn']['y'] * W + s['spawn']['x'] in main}")
    if mark:
        m = im.copy(); d = ImageDraw.Draw(m)
        for c in cs[1:]:
            for i in c: d.rectangle(((i % W) * 16, (i // W) * 16, (i % W) * 16 + 15, (i // W) * 16 + 15), outline=(255, 0, 0, 255), width=2)
        m.save('/tmp/wzspaces/' + os.path.basename(f)[:-5] + '.png')
