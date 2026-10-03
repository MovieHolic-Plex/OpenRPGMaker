"""조선 궁 내부 보기 페이지(자체완결 HTML, data URI) → ~/claude-viz/joseon-palace-int-{rooms,pieces}.html
    python3 pal_page.py            # 방 3장 + 조각 카드 둘 다
방 그림은 tiledata/joseon-palace-int/<id>/ 의 굽은 PNG(사람 포함)를, 조각 카드는 같은 배율의 기준(후보 B·v5)과 나란히 보여 준다."""
import base64, io, json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.expanduser('~/claude-viz')


def uri(im, scale=1):
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b = io.BytesIO(); im.convert('RGBA').save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


CSS = """body{background:#1d1b19;color:#e8e0d4;font:14px/1.5 -apple-system,'Noto Sans KR',sans-serif;margin:24px}
h1{font-size:20px}h2{font-size:16px;margin-top:32px;border-bottom:1px solid #4a423a;padding-bottom:4px}
img{image-rendering:pixelated;display:block}.row{display:flex;flex-wrap:wrap;gap:14px}
.card{background:#2a2622;border:1px solid #4a423a;padding:8px;border-radius:4px}.card b{font-size:12px;color:#d9b88a}
.card .refs{display:flex;gap:8px;align-items:flex-end}.card small{display:block;color:#a99d8c;max-width:520px;font-size:11px}
table{border-collapse:collapse}td,th{border:1px solid #4a423a;padding:3px 8px;font-size:12px}.ok{color:#8fd18f}.warn{color:#e0c070}"""


def rooms_page():
    import pal_rooms as RS
    h = ['<meta charset="utf-8"><title>조선 궁 내부 방 3장</title><style>%s</style>' % CSS, '<h1>조선 궁 내부 — 정전 어좌 홀 · 회랑 · 침전</h1>',
         '<p>접두 <code>pal_</code> 조각 87종 + 후보 B(<code>in_b_</code>) 키트. 정전 어좌 홀은 21×23(요청 약 30×22 — 공간이 남아 줄임). 3/4 시점, Actor1 사람. 클릭하면 원본 해상도(×1) 로 열린다.</p>']
    for spec in RS.ROOMS:
        rid = spec['id']
        stem = rid.replace('_', '-')
        p = os.path.join(ROOT, 'tiledata/joseon-palace-int', rid, stem + '-map-people.png')
        im = Image.open(p)
        sc = 3 if im.width <= 400 else 2
        h.append('<h2>%s — %s (%d×%d)</h2>' % (spec['title'], rid, im.width // 16, im.height // 16))
        h.append('<img src="%s" style="max-width:100%%">' % uri(im, sc))
    h.append('<h2>통행 겹침(붉은 칸 = 못 걷는 칸)</h2><div class="row">')
    for spec in RS.ROOMS:
        rid = spec['id']; stem = rid.replace('_', '-')
        im = Image.open(os.path.join(ROOT, 'tiledata/joseon-palace-int', rid, stem + '-walk-overlay.png'))
        h.append('<div class="card"><b>%s</b><img src="%s"></div>' % (rid, uri(im, 2)))
    h.append('</div>')
    open(os.path.join(OUT, 'joseon-palace-int-rooms.html'), 'w').write('\n'.join(h))


def pieces_page():
    import pal_demo, gate, json
    terr, objs = pal_demo.sheet_objects()
    meta = json.load(open(os.path.join(HERE, 'harness', 'pieces_meta.json')))
    verd = json.load(open(os.path.join(HERE, 'harness', 'verdicts.json')))
    h = ['<meta charset="utf-8"><title>조선 궁 내부 조각 %d종</title><style>%s</style>' % (sum(1 for k in objs if k.startswith('pal_')), CSS),
         '<h1>조선 궁 내부 조각(pal_) — 같은 배율 기준 옆에서</h1><p>왼쪽 = 내 조각(×4), 오른쪽 = 기준(후보 B 사가 실내 조각 · 실내 v5). 한 줄 판정은 시트를 눈으로 본 뒤 기록한 것(통과/보충).</p><div class="row">']
    for k, cv in objs.items():
        if not k.startswith('pal_'):
            continue
        refs = []
        for r in meta.get(k, {}).get('refs', [])[:2]:
            im = gate.ref_image(r)
            if im is not None:
                refs.append((r, im))
        v = verd.get(k, {})
        card = ['<div class="card"><b>%s</b> <span class="%s">%s</span><div class="refs"><div><img src="%s"></div>' % (k, 'ok' if v.get('status') == 'pass' else 'warn', v.get('status', '?'), uri(cv.img(), 4))]
        for r, im in refs:
            card.append('<div><small>%s</small><img src="%s"></div>' % (r, uri(im, 4)))
        card.append('</div><small>%s</small></div>' % v.get('line', ''))
        h.append(''.join(card))
    h.append('</div>')
    open(os.path.join(OUT, 'joseon-palace-int-pieces.html'), 'w').write('\n'.join(h))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    rooms_page(); pieces_page()
    print('쓴 곳', OUT)
