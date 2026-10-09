# 시각 검증 페이지(자체완결 HTML) 생성: 지도 1x·2x 확대·조각 판·오토타일·통행 격자.
import os, json, html
from gc_kit import *
from gc_ext import autotile_mask, atile_img

def overlay_grid(render, grid, scale=2):
    im = render.resize((render.width * scale, render.height * scale), Image.NEAREST).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); t = T * scale
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == '1': d.rectangle((x * t, y * t, x * t + t - 1, y * t + t - 1), fill=(60, 220, 90, 60))
            else: d.rectangle((x * t, y * t, x * t + t - 1, y * t + t - 1), fill=(230, 40, 40, 90))
    im.alpha_composite(ov); return im.convert('RGB')

def autotile_demo(sheet, bg_tile, shape):
    """shape = {(x,y)} 칸 모양에 오토타일을 적용한 그림 (바닥 위)."""
    xs = [c[0] for c in shape]; ys = [c[1] for c in shape]
    x0, y0, x1, y1 = min(xs) - 1, min(ys) - 1, max(xs) + 2, max(ys) + 2
    im = new((x1 - x0) * T, (y1 - y0) * T)
    for y in range(y1 - y0):
        for x in range(x1 - x0): im.alpha_composite(bg_tile, (x * T, y * T))
    for (x, y) in shape: im.alpha_composite(atile_img(sheet, autotile_mask(shape, x, y)), ((x - x0) * T, (y - y0) * T))
    return im

def sheet_labeled(sheet, bg=(52, 70, 50, 255), scale=6):
    cw = 16 * scale + 6; im = Image.new('RGBA', (4 * cw, 4 * (cw + 12)), (28, 30, 34, 255)); d = ImageDraw.Draw(im)
    for m_ in range(16):
        x = m_ % 4 * cw + 3; y = m_ // 4 * (cw + 12) + 3
        d.rectangle((x, y, x + 16 * scale - 1, y + 16 * scale - 1), fill=bg)
        im.alpha_composite(atile_img(sheet, m_).resize((16 * scale, 16 * scale), Image.NEAREST), (x, y))
        d.text((x, y + 16 * scale + 1), '%d  N%d E%d S%d W%d' % (m_, m_ & 1, (m_ >> 1) & 1, (m_ >> 2) & 1, (m_ >> 3) & 1), fill=(220, 224, 232, 255))
    return im

def build_page(path, title, slug, render, grid, crops, kit, autos, qa_lines, plan_summary, extra_sections=()):
    """crops = [(제목, (x0,y0,x1,y1) 1x 픽셀 상자, 배율)]; autos = [(이름, sheet, 바탕 타일, 데모 모양)]."""
    h = ['<!doctype html><meta charset="utf-8"><title>%s</title><style>body{background:#16181c;color:#d8dce4;font:14px/1.5 sans-serif;margin:20px;max-width:1500px}h1,h2{font-weight:600}img{image-rendering:pixelated;max-width:100%%;border:1px solid #333;display:block;margin:8px 0}code{background:#262a32;padding:1px 4px;border-radius:3px}table{border-collapse:collapse}td,th{border:1px solid #333;padding:3px 8px;vertical-align:top;font-size:12px}.g{color:#6c6}.r{color:#e66}</style>' % html.escape(title)]
    h.append('<h1>%s</h1><p>%s</p>' % (html.escape(title), html.escape(plan_summary)))
    h.append('<h2>지도 전체 1x (%dx%d칸)</h2><img src="%s" width="%d">' % (render.width // T, render.height // T, png_uri(render), render.width))
    for (ttl, box, sc) in crops:
        c = render.crop(box); h.append('<h2>확대 %dx — %s</h2><img src="%s">' % (sc, html.escape(ttl), png_uri(c, sc)))
    h.append('<h2>통행 격자 (초록=걷기, 빨강=막힘)</h2><img src="%s">' % png_uri(overlay_grid(render, grid, 1) , 1))
    h.append('<h2>조각 판 (번호 순, %d종)</h2>' % len(kit.order))
    items = [(n, kit.parts[n]) for n in kit.order]
    h.append('<img src="%s">' % png_uri(board(items, 8, 3).convert('RGBA'), 1))
    h.append('<table><tr><th>#</th><th>조각</th><th>크기</th><th>종류</th><th>막힘 줄</th><th>설명 / 놓는 법</th></tr>')
    for i, n in enumerate(kit.order):
        me = kit.meta[n]; im = kit.parts[n]
        h.append('<tr><td>%d</td><td><code>%s</code><br>%s</td><td>%dx%d칸</td><td>%s%s</td><td>%d</td><td>%s<br><i>%s</i></td></tr>' % (i + 1, n, html.escape(me['ko']), im.width // T, im.height // T, me['kind'], (' / ' + me['layer']) if 'layer' in me else '', me['brows'], html.escape(me['desc']), html.escape(me['rules'])))
    h.append('</table>')
    for (nm, sheet, bgt, shape) in autos:
        h.append('<h2>오토타일 — %s (4×4, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)</h2><img src="%s"><p>적용 예(바닥 위):</p><img src="%s">' % (html.escape(nm), png_uri(sheet_labeled(sheet), 1), png_uri(autotile_demo(sheet, bgt, shape), 4)))
    for ttl, body in extra_sections: h.append('<h2>%s</h2>%s' % (html.escape(ttl), body))
    h.append('<h2>적대적 QA 기록</h2><ul>%s</ul>' % ''.join('<li>%s</li>' % html.escape(q) for q in qa_lines))
    open(path, 'w').write(''.join(h)); return os.path.getsize(path)
