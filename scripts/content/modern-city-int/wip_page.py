"""중간 시트 페이지: 처음 n 조각을 3배로 → ~/claude-viz/modern-int-wip.html (자체완결, data URI)."""
import base64, io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import pieces as P

def uri(a, s=3):
    im = Image.fromarray(a, 'RGBA'); im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def main(n=30, out=os.path.expanduser('~/claude-viz/modern-int-wip.html')):
    items = P.piece_images()[:n]
    cards = ''.join(f'<figure><div class="im"><img src="{uri(a)}"></div><figcaption><b>{id_}</b><br>{ko}<br><i>{k}</i></figcaption></figure>' for id_, ko, a, k in items)
    html = f'''<!doctype html><meta charset="utf-8"><title>modern_city 실내 — 중간 시트</title>
<style>body{{background:#1b1e26;color:#dde;font:13px/1.4 sans-serif;margin:20px}}h1{{font-size:18px}}
.g{{display:flex;flex-wrap:wrap;gap:14px}}figure{{margin:0;background:#262a35;padding:8px;border-radius:6px}}
.im{{background:repeating-conic-gradient(#3a3f4c 0 25%,#323642 0 50%) 0 0/24px 24px;display:inline-block}}img{{image-rendering:pixelated;display:block}}
figcaption{{font-size:11px;color:#aab;margin-top:4px;max-width:200px}}</style>
<h1>modern_city(도쿄풍 현대) 실내 조각 — 처음 {len(items)}개, 3배</h1>
<p>코드 손 도트, 시트 램프만. 바닥 9 · 벽면 8 · 문 5 · 창/벽걸이. 아직 object-gate 전(중간 확인용).</p><div class="g">{cards}</div>'''
    open(out, 'w').write(html); print(out, len(items))

if __name__ == '__main__': main()
