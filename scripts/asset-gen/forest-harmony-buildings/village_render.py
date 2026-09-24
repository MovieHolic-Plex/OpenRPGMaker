"""author_village 결과를 16px/칸 PNG 로. 앱 렌더와 같은 합성(하위 → 상위, layerBacking, tileGrafts).  python3 village_render.py village.json out.png [overlay.png]
overlay: 초록 = 입구에서 걸어서 닿는 칸, 빨강 = 막힘, 노랑 = 문, 하늘색 테두리 = 문 앞 칸."""
import json, re, sys
from PIL import Image, ImageDraw
from fhlib import *
src = open(os.path.join(ROOT, 'src/assets/bundled.ts')).read()
TEX = {k: p for k, p in re.findall(r'textureKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"', src)}
_sheets = {}
def sheet_of(k):
    if k not in _sheets:
        path = f"{OUT}/{os.environ.get('VDIR', 'village')}/gen-sheet.png" if k in ('tex_gen_fh_buildings', 'tex_forest_harmony_fantasy_town') else os.path.join(ROOT, 'public', TEX[k])
        _sheets[k] = Image.open(path).convert('RGBA')
    return _sheets[k]
def render(v):
    m, ts = v['map'], v['tileset']; W, H = m['width'], m['height']
    grafts = {g['targetTile']: (g['sourceChipset'], g['sourceTile']) for g in ts['tileGrafts']}
    cache = {}
    def img(i):
        if i not in cache:
            k, s = grafts.get(i, (ts['image']['id'], i)); sh = sheet_of(k); per = sh.width // 16
            cache[i] = sh.crop(((s % per) * 16, (s // per) * 16, (s % per) * 16 + 16, (s // per) * 16 + 16))
        return cache[i]
    out = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for layer in ('lowerTiles', 'upperTiles'):
        for idx, t in enumerate(m[layer]):
            if t is None or t < 0: continue
            meta = ts['tileMeta'][t] if t < len(ts['tileMeta']) else None
            bk = (meta or {}).get('layerBacking')
            if isinstance(bk, int) and bk >= 0 and (layer == 'lowerTiles' or m['lowerTiles'][idx] < 0): out.alpha_composite(img(bk), ((idx % W) * 16, (idx // W) * 16))
            out.alpha_composite(img(t), ((idx % W) * 16, (idx // W) * 16))
    return out
CHAR = {}
for f in ('src/assets/easyrpgRtp.ts', 'src/assets/scarloxyPack.ts'):
    t = open(os.path.join(ROOT, f)).read().replace('${ASSET_DIR}', 'assets/scarloxy')
    for obj in re.findall(r'\{[^{}]*?category:\s*"charset"[^{}]*\}', t):
        k, pth = re.search(r'textureKey:\s*"([^"]+)"', obj), re.search(r'path:\s*[`"]([^`"]+)[`"]', obj)
        if k and pth: CHAR[k.group(1)] = pth.group(1)
def charset(k):
    if k not in _sheets:
        im = Image.open(os.path.join(ROOT, 'public', CHAR[k]))
        if im.mode == 'P' and 'transparency' not in im.info: im.info['transparency'] = 0   # RPG 만들기 2000 문자 그림: 팔레트 0번 = 투명
        _sheets[k] = im.convert('RGBA')
    return _sheets[k]
def draw_events(v, out):
    """NPC·동물: 첫 쪽 그림(pattern = 12열 격자 번호), 칸 가운데 아래에 맞춘다(앱과 같이 24×32 그대로)."""
    for ev in v['map'].get('events') or []:
        g = (ev.get('pages') or [{}])[0].get('graphic') or {}
        sp = (g.get('sprite') or {}).get('id')
        if not sp or sp not in CHAR: continue
        sh = charset(sp); fw, fh = sh.width // 12, sh.height // 8; f = g.get('pattern', 1)
        fr = sh.crop(((f % 12) * fw, (f // 12) * fh, (f % 12) * fw + fw, (f // 12) * fh + fh))
        out.alpha_composite(fr, (ev['x'] * 16 + 8 - fw // 2, (ev['y'] + 1) * 16 - fh))
    return out
def overlay(v, base):
    m = v['map']; W, H = m['width'], m['height']; reach = set(v['reachable'])
    o = Image.new('RGBA', base.size); d = ImageDraw.Draw(o)
    for y in range(H):
        for x in range(W):
            col = (40, 255, 90, 60) if f'{x},{y}' in reach else (255, 40, 40, 70)
            d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], fill=col)
    for b in v['buildings']:
        for dr in b['doors']:
            d.rectangle([dr['x'] * 16, dr['y'] * 16, dr['x'] * 16 + 15, dr['y'] * 16 + 15], fill=(255, 220, 0, 170))
            f = dr['front']; d.rectangle([f['x'] * 16 + 1, f['y'] * 16 + 1, f['x'] * 16 + 14, f['y'] * 16 + 14], outline=(0, 230, 255, 255), width=2)
    r = base.copy(); r.alpha_composite(o); return r
if __name__ == '__main__':
    v = json.load(open(sys.argv[1])); im = draw_events(v, render(v)); im.convert('RGB').save(sys.argv[2])
    if len(sys.argv) > 3: overlay(v, im).convert('RGB').save(sys.argv[3])
    print('ok', im.size)
