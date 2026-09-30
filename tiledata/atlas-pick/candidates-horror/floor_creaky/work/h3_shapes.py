from h3_lib import *
def L(**kw):
    d = {}
    for ramp, chars in kw.items():
        for i, ch in enumerate(chars):
            if ch != '_': d[ch] = (ramp, i)
    return d
def ell(g, cx, cy, rx, ry, c, fn=None):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                g.put(x, y, fn(x, y) if fn else c)
def line(g, pts, c):
    for x, y in pts: g.put(x, y, c)
def finish(slug, notes, LG, scale=10):
    for d, (n, g) in notes.items():
        save(slug, d, g, LG, n)
        check(slug, d)
    sheet(slug, 'ABC', scale, 'sheet.png')
