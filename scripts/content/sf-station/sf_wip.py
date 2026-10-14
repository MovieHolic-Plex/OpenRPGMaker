"""중간 접촉 시트 ~/claude-viz/sf-wip.html — 다시 그린(Opus v2) 조각을 3배로."""
import io, base64, sys
import sf_all, sf_core as C, sf_kit
from PIL import Image
n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
ids = [i for i in C.PIECES if i in sf_kit.REDRAWN][:n]
cards = []
for i in ids:
    p = C.PIECES[i]; im = Image.fromarray(C.render(p), 'RGBA'); z = 3
    bg = Image.new('RGBA', im.size, (46, 50, 64, 255)); bg.alpha_composite(im)
    big = bg.resize((im.width * z, im.height * z), Image.NEAREST); b = io.BytesIO(); big.save(b, 'PNG')
    st = C.status_of(p)
    cards.append(f'<figure><img src="data:image/png;base64,{base64.b64encode(b.getvalue()).decode()}"><figcaption><b>{i}</b> {p["w"]}×{p["h"]} · {p["kind"]} · 관문 <i class="{st}">{st}</i><br>{p["name"]}</figcaption></figure>')
html = f'''<!doctype html><meta charset=utf-8><title>sf_station WIP — Opus 다시 그리기</title>
<style>body{{background:#14161b;color:#e6e8ee;font:14px/1.5 sans-serif;margin:20px}}main{{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}}figure{{margin:0;background:#1c1f27;padding:8px;border-radius:6px}}img{{image-rendering:pixelated;display:block}}figcaption{{font-size:12px;color:#9aa3b5;max-width:300px}}.pass{{color:#3fb27f}}.fail,.none{{color:#d9a441}}</style>
<h1>sf_station — Opus 다시 그린 조각 {len(ids)}개 (3배)</h1><p>Sonnet 초안을 버리고 Opus 가 다시 찍은 조각. 16px 3/4 시점 코드 손 도트, 잠금 팔레트. 관문 = object-gate 영수증(none = 아직 판정 전).</p><main>{"".join(cards)}</main>'''
open('/home/main/claude-viz/sf-wip.html', 'w').write(html); print(len(ids))
