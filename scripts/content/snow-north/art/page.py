"""claude-viz 페이지 도우미 — 자체완결 HTML(data URI)."""
import base64, io, os
from PIL import Image

VIZ = os.path.expanduser('~/claude-viz')


def uri(im, z=1):
    if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def ground_bg(tile, z):
    return uri(tile, z)


def card(name, im, z=3, note='', bg=None):
    style = "background-image:url('%s');" % bg if bg else ''
    return ('<div class=card><div class=pic style="%s"><img src="%s" width=%d height=%d></div><div class=nm>%s</div>%s</div>'
            % (style, uri(im, z), im.width * z, im.height * z, name, ('<div class=nt>%s</div>' % note) if note else ''))


CSS = """body{background:#15171c;color:#e8e8e8;font:14px/1.5 system-ui,sans-serif;margin:0 auto;padding:18px;max-width:1700px}
h1{font-size:22px}h2{font-size:17px;margin-top:28px;color:#fff}p,li{color:#c8ccd4}
.grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.card{background:#1f232b;border-radius:6px;padding:8px}
.pic{background:#4a4446;padding:6px;display:inline-block}
img{image-rendering:pixelated;display:block}
.nm{font-size:12px;color:#fff;margin-top:4px}.nt{font-size:11px;color:#9aa3ad;max-width:360px}
.wide img{max-width:100%;height:auto}
table{border-collapse:collapse}td,th{border:1px solid #333;padding:4px 8px}"""


def write(name, title, body):
    os.makedirs(VIZ, exist_ok=True)
    path = os.path.join(VIZ, name + '.html')
    open(path, 'w').write('<!doctype html><meta charset=utf-8><title>%s</title><style>%s</style><h1>%s</h1>%s' % (title, CSS, title, body))
    return path
