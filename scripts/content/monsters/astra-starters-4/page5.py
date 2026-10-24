"""Compact pick page ~/claude-viz/astra-starters-5.html: one row per line (stage 1-3 at 3x + 1x), one-line verdict,
at most 3 alternatives per open slot. Config: page5.json next to this file (line -> stages [{species, sprite|null, alts:[sprite..]}], verdict)."""
import json, os, shutil, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); VIZ = os.path.expanduser('~/claude-viz'); D = f'{VIZ}/astra-starters-5'
cfg = json.load(open(sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/page5.json'))
os.makedirs(D, exist_ok=True)
def tile(src, name, scale):
    im = Image.open(os.path.expanduser(src)).convert('RGBA'); im.resize((64*scale, 64*scale), Image.NEAREST).save(f'{D}/{name}'); return name
rows = []
for li, line in enumerate(cfg['lines']):
    cells = []
    for si, st in enumerate(line['stages']):
        if st.get('sprite'):
            a, b = tile(st['sprite'], f'{li}-{si}-3x.png', 3), tile(st['sprite'], f'{li}-{si}-1x.png', 1)
            cells.append(f'<td><img src="astra-starters-5/{a}"><img class=o src="astra-starters-5/{b}"><div>{st["label"]}</div></td>')
        else:
            alts = ''.join(f'<span><img src="astra-starters-5/{tile(s, f"{li}-{si}-alt{k}-2x.png", 2)}"><img class=o src="astra-starters-5/{tile(s, f"{li}-{si}-alt{k}-1x.png", 1)}"><b>{chr(65+k)}</b></span>' for k, s in enumerate(st.get('alts', [])[:3]))
            cells.append(f'<td class=open>{alts or "—"}<div>{st["label"]}</div></td>')
    rows.append(f'<tr><th>{line["name"]}</th>{"".join(cells)}</tr><tr><td></td><td colspan=3 class=v>{line["verdict"]}</td></tr>')
html = f'''<!doctype html><meta charset="utf-8"><title>Astra starters 5</title>
<style>body{{font:14px system-ui,sans-serif;background:#15171d;color:#e3e6ec;margin:12px}}table{{border-collapse:collapse}}td,th{{padding:4px 10px;vertical-align:bottom;text-align:left}}
img{{image-rendering:pixelated;background:#c8dcc0;margin-right:4px;vertical-align:bottom}}img.o{{margin-left:2px}}.open span{{display:inline-block;margin-right:10px}}.open b{{display:block}}td div{{color:#9aa3b2;font-size:12px}}.v{{color:#ffd27a;padding-bottom:14px}}</style>
<h2>Astra starters 5</h2><table><tr><th></th><th>stage 1</th><th>stage 2</th><th>stage 3</th></tr>{"".join(rows)}</table>'''
open(f'{VIZ}/astra-starters-5.html', 'w').write(html); print(f'{VIZ}/astra-starters-5.html')
