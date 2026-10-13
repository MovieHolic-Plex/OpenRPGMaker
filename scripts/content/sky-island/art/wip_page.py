#!/usr/bin/env python3
"""중간 검수 시트 ~/claude-viz/<name>.html (자체완결, data URI, 3배)."""
import os, sys, io, base64, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import RAMPS


def uri(im, z=3):
    if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def page(path, title, regs, scenes=(), note=''):
    out = ['<!doctype html><meta charset=utf-8><title>%s</title><style>body{background:#1b1d24;color:#ddd;font:13px sans-serif;margin:16px}'
           'h2{margin:22px 0 8px}.g{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.c{background:#7eaee8;padding:6px;border-radius:4px}'
           '.c img{image-rendering:pixelated;display:block}.c span{display:block;color:#111;font-size:11px;margin-top:3px;max-width:240px}'
           '.pal span{display:inline-block;width:22px;height:22px}.sc img{image-rendering:pixelated;max-width:100%%;border:1px solid #444}</style>' % html.escape(title),
           '<h1>%s</h1><p>%s</p>' % (html.escape(title), html.escape(note))]
    out.append('<h2>팔레트 (램프 %d)</h2><div class=pal>' % len(RAMPS))
    for name, cols in RAMPS.items():
        out.append('<div><b style="display:inline-block;width:80px">%s</b>' % name + ''.join('<span style="background:#%06x"></span>' % c for c in cols) + '</div>')
    out.append('</div>')
    for gname, reg in regs:
        out.append('<h2>%s (%d)</h2><div class=g>' % (html.escape(gname), len(reg.items)))
        for it in reg.items:
            im = reg.render(it, 0).img()
            out.append('<div class=c><img src="%s"><span>%s · %s</span></div>' % (uri(im), it['id'], html.escape(it['name'])))
        out.append('</div>')
    for name, im, z in scenes:
        out.append('<h2>%s</h2><div class=sc><img src="%s"></div>' % (html.escape(name), uri(im, z)))
    with open(path, 'w') as f: f.write('\n'.join(out))
