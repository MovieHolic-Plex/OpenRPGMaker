"""python3 steam_b_viz.py wip|final — ~/claude-viz/steam-redo(-wip).html (자체완결, data URI). 관문 상태 = 영수증(그림 해시)."""
import base64, io, os, sys, html, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import steam_b_all  # noqa: F401
import registry as R
from PIL import Image

VIZ = os.path.expanduser('~/claude-viz')


def uri(im, z=1):
    if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def zoom_for(p):
    a = p['w'] * p['h']
    return 4 if a <= 4 else (3 if a <= 24 else 3)


def cards(ps, show_status=True):
    out = []
    for p in ps:
        st = R.status_of(p) if show_status else ''
        z = zoom_for(p)
        imgs = ''.join(f'<img src="{uri(R.render(p, f), z)}">' for f in range(p['frames']))
        out.append(f'<div class="c {st}"><div class="im">{imgs}</div><b>{html.escape(p["name"])}</b><br>'
                   f'<small>{p["id"]} · {p["kind"]} · {p["w"]}×{p["h"]}칸{" · %d프레임" % p["frames"] if p["frames"] > 1 else ""}'
                   f'{" · 관문 " + st.upper() if st else ""}</small></div>')
    return ''.join(out)


CSS = '''body{background:#1b1d22;color:#dde;font:14px/1.45 system-ui,sans-serif;margin:18px}
h1{font-size:20px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #444;padding-bottom:4px}
.g{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.c{background:#5c6860;border:3px solid #2a2;padding:8px;border-radius:6px;color:#111}
.c.fail{border-color:#d33}.c.none{border-color:#aa3}.im img{image-rendering:pixelated;margin-right:6px;vertical-align:bottom}
img{image-rendering:pixelated}.note{color:#bbc;max-width:1100px}.pair{display:flex;gap:16px;flex-wrap:wrap}.pair figure{margin:0}
figcaption{color:#ccd;font-size:13px;margin-top:4px}code{background:#2a2c33;padding:1px 4px;border-radius:3px}'''


def wip(n=30):
    ps = [p for p in R.pieces_of('B') if R.status_of(p) == 'pass'][:n]
    page = f'''<meta charset="utf-8"><title>sky_steam 줄 B 다시 그리기 — 중간 접촉 시트</title><style>{CSS}</style>
<h1>sky_steam 줄 B(증기 산업도시) 처음부터 다시 그리기 — 중간 접촉 시트: 관문 통과 첫 {len(ps)}조각</h1>
<p class="note">16px 칸, 3~4배 확대(nearest). 모두 object-gate(gemini-3.8-flash ×4, 과반·중앙값) <b>PASS</b> 영수증이 그림 화소 해시에 묶여 있다.
옛 줄 B(agent/sky-b) 그림은 하나도 쓰지 않았다 — 벽돌 한 장·철판 한 장마다 음영, 사람 크기 문(높이 22~26px), 깊은 윗면.</p>
<div class="g">{cards(ps)}</div>'''
    out = os.path.join(VIZ, 'steam-redo-wip.html'); open(out, 'w').write(page); print(out, len(ps))


if __name__ == '__main__':
    {'wip': wip}[sys.argv[1] if len(sys.argv) > 1 else 'wip']()
