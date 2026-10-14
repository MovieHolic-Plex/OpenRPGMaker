"""조각 연락 시트 HTML(자체완결, data URI): python3 page.py <출력이름> <모듈,모듈> [최대 개수] [배율] [제목]
→ ~/claude-viz/<출력이름>.html"""
import base64, io, os, sys, html
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import loader, gmlib
from PIL import Image

def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def cards(mods, limit, z):
    out = []; actor = gmlib._scale_actor()
    for mod in mods:
        reg = loader.load(mod)
        for p in reg.pieces.values():
            fr = [gmlib.render_piece(p, f).img() for f in range(p['frames'])]
            w = sum(f.width + 4 for f in fr) + 30; h = max(max(f.height for f in fr), 32)
            bg = Image.new('RGBA', (w, h), gmlib.RAMPS['grass'][3]); x = 0
            for f in fr: bg.alpha_composite(f, (x, h - f.height)); x += f.width + 4
            if actor and p['kind'] not in ('terrain', 'flat'): bg.alpha_composite(actor, (x + 2, h - 32))
            out.append((p['id'], p['name'], p.get('kind') or '', bg.resize((w * z, h * z), Image.NEAREST), bg))
        for a in reg.autotiles.values():
            m, t, pa, ic = gmlib.autotile_cells(a); demo = gmlib._autotile_demo(t, n=7)
            out.append((a['id'], a['name'] + ' (오토타일)', 'terrain', demo.resize((demo.width * z, demo.height * z), Image.NEAREST), demo))
        for r in reg.runs.values():
            demo = gmlib.run_demo(r); bg = Image.new('RGBA', demo.size, gmlib.RAMPS['grass'][3]); bg.alpha_composite(demo)
            out.append((r['id'], r['name'] + ' (줄 조각)', r['kind'], bg.resize((bg.width * z, bg.height * z), Image.NEAREST), bg))
    return out[:limit]

def main():
    name, mods = sys.argv[1], sys.argv[2].split(',')
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10 ** 6; z = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    title = sys.argv[5] if len(sys.argv) > 5 else name
    cs = cards(mods, limit, z)
    items = ''.join(f'<figure><img src="{uri(im)}" width="{im.width}" height="{im.height}"><img class="x1" src="{uri(one)}"><figcaption><b>{html.escape(i)}</b> · {html.escape(k)}<br>{html.escape(n)}</figcaption></figure>' for i, n, k, im, one in cs)
    doc = f'''<!doctype html><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>body{{background:#16141c;color:#ddd;font:13px/1.4 system-ui,sans-serif;margin:16px}}h1{{font-size:18px}}
.g{{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}}figure{{margin:0;background:#211e29;padding:8px;border-radius:6px}}
img{{image-rendering:pixelated;display:block}}img.x1{{margin-top:4px}}figcaption{{max-width:420px;margin-top:4px;color:#bbb}}b{{color:#fff}}</style>
<h1>{html.escape(title)}</h1><p>{len(cs)}개 · {z}배 확대(아래 작은 그림은 1배) · 오른쪽 사람은 EasyRPG Actor1 축척 표본(24×32).</p><div class="g">{items}</div>'''
    path = os.path.expanduser(f'~/claude-viz/{name}.html'); open(path, 'w').write(doc); print(path, len(cs))

if __name__ == '__main__': main()
