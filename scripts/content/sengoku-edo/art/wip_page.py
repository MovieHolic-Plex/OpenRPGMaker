#!/usr/bin/env python3
"""검수 시트 HTML(~/claude-viz/sengoku-wip.html): 팔레트 + 조각 전부(3배, 이름표). 자체완결(data URI)."""
import base64, io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import RAMPS
import terrain, buildings, props


def uri(im, z=3):
    im = im.resize((im.width * z, im.height * z), 0)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def page(path, title='sengoku_edo 진행 시트', extra=''):
    h = [f'<!doctype html><meta charset=utf-8><title>{title}</title><style>body{{background:#2a2a2e;color:#ddd;font:13px sans-serif;margin:16px}}'
         '.g{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.c{background:#6a765c;padding:6px;border-radius:4px}.c img{image-rendering:pixelated;display:block}'
         '.c span{display:block;font-size:11px;margin-top:3px;color:#fff}.sw{display:inline-block;width:18px;height:18px}h2{margin:18px 0 8px}</style>',
         f'<h1>{title}</h1>{extra}<h2>팔레트(잠금, {sum(len(v) for v in RAMPS.values())}색 · 램프 {len(RAMPS)})</h2>']
    for k, v in RAMPS.items():
        h.append(f'<div><code style="display:inline-block;width:70px">{k}</code>' + ''.join(f'<span class=sw style="background:{c}"></span>' for c in v) + '</div>')
    for mod, nm in ((buildings, '건물'), (props, '소품·나무·다리'), (terrain, '바닥')):
        h.append(f'<h2>{nm} ({len(mod.R.items)})</h2><div class=g>')
        for it in mod.R.items:
            im = mod.R.render(it).img()
            h.append(f'<div class=c><img src="{uri(im)}"><span>se-{it["id"]} · {it["w"]}×{it["h"]} · {it["kind"]}</span></div>')
        h.append('</div>')
    open(path, 'w').write('\n'.join(h))


if __name__ == '__main__':
    page(os.path.expanduser('~/claude-viz/sengoku-wip.html'))
