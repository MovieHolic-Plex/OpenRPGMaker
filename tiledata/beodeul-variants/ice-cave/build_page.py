# 시각 검증 페이지(자체완결 HTML) 생성: python3 build_page.py <slug> <제목>
import sys, os, json, base64, io
from PIL import Image, ImageDraw
slug, title = sys.argv[1], sys.argv[2]
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', slug); HERE = os.path.abspath(HERE)
meta = json.load(open(HERE + '/partmeta.json')); grid = json.load(open(HERE + '/grid.json'))
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
img = Image.open(HERE + '/render-1x.png').convert('RGBA'); W, H = grid['w'], grid['h']
# 통행 겹침
ov = img.copy(); d = ImageDraw.Draw(ov, 'RGBA')
for y, row in enumerate(grid['rows']):
    for x, ch in enumerate(row):
        d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], fill=(60, 255, 90, 70) if ch == '.' else (255, 40, 40, 85))
for k, (x, y) in grid['marks'].items(): d.ellipse([x * 16 + 2, y * 16 + 2, x * 16 + 13, y * 16 + 13], outline=(255, 255, 0, 255), width=2)
# 조각 판
names = list(meta); ims = [(n, Image.open(HERE + '/parts/' + n + '.png').convert('RGBA')) for n in names]
S = 3; cw = 16 * 6 * S // 2 + 6; cols = 8
cell = [max(i.width for _, i in ims) * S + 10, 0]
rows_h = []
sheet_cells = []
bg = (88, 120, 70, 255) if slug.startswith('plains') else (50, 62, 90, 255)
cw = 220; ch = 0
for n, im in ims:
    sc = S if max(im.size) <= 64 else 2
    sheet_cells.append((n, im.resize((im.width * sc, im.height * sc), Image.NEAREST)))
ch = max(i.height for _, i in sheet_cells) + 22
cw = 200
rowsN = (len(sheet_cells) + cols - 1) // cols
sh = Image.new('RGBA', (cols * cw, rowsN * ch), bg); dd = ImageDraw.Draw(sh)
for k, (n, im) in enumerate(sheet_cells):
    x = (k % cols) * cw + 4; y = (k // cols) * ch + 4
    if im.width > cw - 8: im = im.resize((cw - 8, int(im.height * (cw - 8) / im.width)), Image.NEAREST)
    sh.alpha_composite(im, (x, y)); dd.text((x, y + im.height + 4), '%d %s' % (k + 1, n), fill=(255, 255, 255, 255))
# 오토타일 16칸
autos = [n for n in names if n.startswith('autotile')]
at = Image.new('RGBA', (len(autos) * 300, 300), (0, 0, 0, 0)); ad = ImageDraw.Draw(at)
gb = Image.open(HERE + '/parts/ground-meadow.png').convert('RGBA') if slug.startswith('plains') else Image.open(HERE + '/parts/ground-ice.png').convert('RGBA')
for i, n in enumerate(autos):
    s_ = Image.open(HERE + '/parts/' + n + '.png').convert('RGBA'); base = Image.new('RGBA', (64, 64))
    for k in range(16): base.alpha_composite(gb.crop((0, 0, 16, 16)), ((k % 4) * 16, (k // 4) * 16))
    base.alpha_composite(s_); big = base.resize((256, 256), Image.NEAREST)
    bd = ImageDraw.Draw(big)
    for k in range(16): bd.text(((k % 4) * 64 + 3, (k // 4) * 64 + 3), str(k), fill=(255, 255, 0, 255))
    at.alpha_composite(big, (i * 300 + 10, 10)); ad.text((i * 300 + 10, 272), n, fill=(255, 255, 255, 255))
def crop(x, y, w, h): return img.crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.NEAREST)
z1 = crop(0, 0, min(img.width, 480), 320); z2 = crop(max(0, img.width - 480), img.height - 320, 480, 320)
kinds = {}
for n in names: kinds[meta[n]['kind']] = kinds.get(meta[n]['kind'], 0) + 1
tbl = ''.join('<tr><td>%d</td><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (i + 1, n, meta[n]['kind'], meta[n]['ko'], meta[n].get('brows', ''), meta[n]['rules']) for i, n in enumerate(names))
html = '''<!doctype html><meta charset=utf-8><title>%(t)s</title><style>body{background:#1c1f26;color:#dde;font:14px sans-serif;margin:16px}img{image-rendering:pixelated;max-width:100%%;display:block;margin:8px 0}h2{border-bottom:1px solid #445;padding-bottom:4px;margin-top:28px}table{border-collapse:collapse;font-size:12px}td{border:1px solid #445;padding:2px 6px}code{color:#8cf}</style>
<h1>%(t)s</h1><p>맵 %(w)dx%(h)d칸 · 조각 %(n)d개 %(k)s · 한 화면(20x15) 빈 바닥 최악 %(e).2f · 도달 못한 표지 %(u)s</p>
<h2>맵 1x 전체</h2><img src="%(m1)s"><h2>2x 확대 (왼쪽 위 / 오른쪽 아래)</h2><img src="%(z1)s"><img src="%(z2)s">
<h2>통행 격자 겹침 (초록=걸음, 빨강=막힘, 노랑 원=표지)</h2><img src="%(ov)s"><h2>오토타일 16변형 (칸 번호 = 위1+오른2+아래4+왼8)</h2><img src="%(at)s">
<h2>조각 판 (번호)</h2><img src="%(sh)s"><h2>조각 표</h2><table><tr><td>#</td><td>이름</td><td>종류</td><td>한글</td><td>막힘줄</td><td>놓는 법</td></tr>%(tbl)s</table>''' % dict(
    t=title, w=W, h=H, n=len(names), k=kinds, e=grid.get('empty_window', [0])[0], u=grid.get('unreachable', grid.get('reach')), m1=uri(img), z1=uri(z1), z2=uri(z2), ov=uri(ov), at=uri(at), sh=uri(sh), tbl=tbl)
out = os.path.expanduser('~/claude-viz/beodeul-wave-%s.html' % slug); open(out, 'w').write(html); print(out, os.path.getsize(out) // 1024, 'KB')
