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


REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SHOTS = os.path.join(REPO, 'verify-shots', 'sky-steam')


def boxed(path, defects, color=(255, 40, 200, 255)):
    """QA 전 장면에 결함 상자(qa_defects.json box, 장면 화소)를 2px 테두리로 그린다."""
    from PIL import ImageDraw
    im = Image.open(path).convert('RGBA'); d = ImageDraw.Draw(im)
    for df in defects:
        x, y, w, h = df['box']
        d.rectangle([x, y, x + w - 1, y + h - 1], outline=color, width=2)
        d.rectangle([x, y, x + 6 * len(df['id']) + 3, y + 10], fill=(0, 0, 0, 200)); d.text((x + 2, y), df['id'], fill=color)
    return im


def crop3(path, box, pad=16):
    im = Image.open(path).convert('RGBA'); x, y, w, h = box
    x, y = min(x, im.width - 16), min(y, im.height - 16); w, h = min(w, im.width - x), min(h, im.height - y)   # 후 장면이 더 작으면 같은 자리 근처
    c = im.crop((max(0, x - pad), max(0, y - pad), min(im.width, x + w + pad), min(im.height, y + h + pad)))
    z = 3 if c.width * 3 <= 720 else 2 if c.width * 2 <= 900 else 1
    return uri(c, z)


def final():
    import sky_a_all  # noqa: F401  줄 A 조각도 등록
    qa = json.load(open(os.path.join(HERE, 'qa_defects.json')))
    td = json.load(open(os.path.join(REPO, 'src', 'assets', 'skySteamTileset.json')))
    rep = {'count': td['count'], 'kits': len(td['structureKits']), 'autotiles': len(td['autotileGroups']), 'strips': len(td['animationStrips'])}
    pb = [p for p in R.pieces_of('B')]; pa = [p for p in R.pieces_of('A')]
    nb = sum(1 for p in pb if R.status_of(p) == 'pass'); na = sum(1 for p in pa if R.status_of(p) == 'pass')
    groups = {}
    for p in pb: groups.setdefault(p['id'].split('-')[1] if p['id'].startswith('steam-i-') is False else 'interior', []).append(p)
    def cat(p):
        i = p['id']
        if i.startswith('steam-i-'): return '실내 기물'
        if i.startswith('steam-wall') or i.startswith('steam-t-wall'): return '실내 벽'
        if i.startswith('steam-t-') or i.startswith('steam-at-'): return '바닥·오토타일'
        if p['frames'] > 1: return '애니메이션'
        if p['kind'] == 'structure': return '건물·탈것·부두'
        return '거리·공장 소품'
    order = ['건물·탈것·부두', '거리·공장 소품', '애니메이션', '바닥·오토타일', '실내 벽', '실내 기물']
    sheet = ''.join(f'<h3>{c} ({sum(1 for p in pb if cat(p) == c)})</h3><div class="g">{cards([p for p in pb if cat(p) == c])}</div>' for c in order)
    qa_html = []
    for sc in ['street', 'yard', 'boiler', 'inn', 'dock']:
        ds = [d for d in qa['defects'] if d['scene'] == sc]
        bp, ap = os.path.join(SHOTS, 'qa-before', sc + '.png'), os.path.join(SHOTS, 'qa-after', sc + '.png')
        rows = ''.join(f'<tr><td><b>{d["id"]}</b></td><td>{d["kind"]}</td><td>{html.escape(d["what"])}</td><td>{html.escape(d["fix"])}</td>'
                       f'<td><img src="{crop3(bp, d["box"])}" style="max-width:420px"></td><td><img src="{crop3(ap, d["box"])}" style="max-width:420px"></td></tr>' for d in ds)
        qa_html.append(f'<h3>{sc}</h3><div class="pair"><figure><img src="{uri(boxed(bp, ds))}"><figcaption>전(원본 해상도, 자홍 상자 = 결함)</figcaption></figure>'
                       f'<figure><img src="{uri(Image.open(ap))}"><figcaption>후(같은 해상도)</figcaption></figure></div>'
                       f'<table><tr><th>id</th><th>종류</th><th>결함</th><th>고친 것</th><th>전 (확대)</th><th>후 (확대)</th></tr>{rows}</table>')
    comp = os.path.join(SHOTS, 'compose')
    comp_html = ''.join(f'<figure><img src="{uri(Image.open(os.path.join(comp, f)))}"><figcaption>{f[:-4]}</figcaption></figure>'
                        for f in sorted(os.listdir(comp)) if f.endswith('.png')) if os.path.isdir(comp) else ''
    asst = os.path.join(SHOTS, 'assistant.json'); ah = ''
    if os.path.exists(asst):
        for r in json.load(open(asst)):
            imgs = ''.join(f'<figure><img src="{uri(Image.open(os.path.join(SHOTS, m)))}" style="max-width:900px"><figcaption>{html.escape(m)}</figcaption></figure>' for m in r['maps'])
            ah += (f'<h3>{html.escape(r["round"])} · 「{html.escape(r["prompt"])}」 — <b>{r["score"]}/10</b></h3><p class="note">{html.escape(r["verdict"])}</p>'
                   f'<p class="note"><small>도구: {html.escape(r.get("tools", ""))}</small></p><div class="pair">{imgs}</div>')
    nd = len(qa['defects']); fixed = sum(1 for d in qa['defects'] if d['kind'] != 'open')
    page = f'''<meta charset="utf-8"><title>sky_steam 줄 B 다시 그리기 — 결과</title><style>{CSS}
table{{border-collapse:collapse;margin:8px 0 18px}}td,th{{border:1px solid #444;padding:4px 6px;vertical-align:top;font-size:13px}}h3{{margin:18px 0 6px}}</style>
<h1>sky_steam — 줄 B(증기 산업도시 + 실내) 처음부터 다시 그리기</h1>
<p class="note">줄 B {nb}/{len(pb)}조각 · 줄 A {na}/{len(pa)}조각이 object-gate(gemini-3.8-flash ×4, 과반) <b>PASS</b> 영수증(그림 화소 해시)을 갖고 번들 sky_steam 한 칩셋에 구웠다:
칸 {rep.get("count", "?")} · 키트 {rep.get("kits", "?")} · 오토타일 {rep.get("autotiles", "?")} · 애니 스트립 {rep.get("strips", "?")}. 옛 sky-b 그림은 하나도 쓰지 않았다.
적대적 시각 QA 1회: 장면 5장에서 결함 {nd}건, 개선 1회로 {fixed}건 고침({nd - fixed}건 미해결: D1 줄 A/B 축척).</p>
<h2>1. 무엇을 보면 되나</h2><p class="note">① 조각 시트(3~4배)에서 윗면이 면으로 보이는지 ② QA 전/후에서 상자 친 곳이 고쳐졌는지 ③ 조수(gemini-3.8-flash)가 세 문장으로 실제 짠 맵.</p>
<h2>2. 조수 실시험 (실제 입력창 경로, 새 기본 프로젝트)</h2>{ah or '<p class="note">아직 없음</p>'}
<h2>3. 구성기 compose_sky_steam 표본 (씨앗·종류별, 구조 검사 0건)</h2><div class="pair">{comp_html}</div>
<h2>4. 적대적 시각 QA 1회 — 전/후</h2>{''.join(qa_html)}
<h2>5. 줄 B 조각 시트 ({len(pb)}조각, 3~4배)</h2>{sheet}
<h2>6. 줄 A 조각 ({len(pa)}조각)</h2><div class="g">{cards(pa)}</div>'''
    out = os.path.join(VIZ, 'steam-redo.html'); open(out, 'w').write(page); print(out, os.path.getsize(out))


if __name__ == '__main__':
    {'wip': wip, 'final': final}[sys.argv[1] if len(sys.argv) > 1 else 'wip']()
