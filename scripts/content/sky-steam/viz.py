"""python3 viz.py -> ~/claude-viz/sky-a.html (자체완결, data URI). 관문 상태 = 영수증."""
import base64, io, os, html
import sky_a_all  # noqa
import registry as R
from PIL import Image
def uri(im, z):
    im = im.resize((im.width * z, im.height * z), 0); b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
ps = R.pieces_of('A'); n = sum(R.status_of(p) == 'pass' for p in ps)
cards = []
for p in ps:
    st = R.status_of(p); z = 4 if p['w'] * p['h'] <= 4 else 3 if p['w'] * p['h'] <= 12 else 2
    imgs = ''.join(f'<img src="{uri(R.render(p, f), z)}">' for f in range(p['frames']))
    cards.append(f'<div class="c {st}"><div class="im">{imgs}</div><b>{html.escape(p["name"])}</b><br><small>{p["id"][6:]} · {p["kind"]} · {p["w"]}x{p["h"]} · {st.upper()}</small></div>')
ex = ''.join(f'<h3>{t}</h3><img src="{uri(Image.open(os.path.join(R.REPO, "tiledata/sky-steam/example-A-" + k + ".png")), 2)}">' for k, t in (('ok', '구름 섬 연결 + 탑승 정답(흰 점 = 걷는 칸, 자홍 = 탑승 칸)'), ('bad', '오류(붉은 점): 다리 떨어짐 · 탑승 칸 갑판과 안 닿음 · 지도 밖')))
page = f'''<meta charset="utf-8"><title>sky_steam 줄 A 하늘섬</title><style>body{{background:#1a2438;color:#dde;font:14px sans-serif;margin:16px}}
.g{{display:flex;flex-wrap:wrap;gap:10px}}.c{{background:#6eaae1;border:3px solid #2a2;padding:6px;border-radius:6px;color:#112}}.c.fail{{border-color:#d33}}.c.none{{border-color:#aa3}}
.im img{{image-rendering:pixelated;margin-right:6px}}img{{image-rendering:pixelated}}</style>
<h2>sky_steam 줄 A 하늘섬 — {n}/{len(ps)} 관문 통과 (object-gate, gemini-3.8-flash x4)</h2><div class="g">{''.join(cards)}</div>{ex}'''
open(os.path.expanduser('~/claude-viz/sky-a.html'), 'w').write(page); print(n, len(ps))
