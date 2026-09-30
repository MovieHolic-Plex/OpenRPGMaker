# 손 도트 실내 v5 가구 설명 다시 쓰기 — 전후 비교 페이지(~/claude-viz/interior-desc.html, 그림 ~/claude-viz/interior-desc/).
#   python3 scripts/qa/hand-interior-desc-viz.py [--before-rev 693f22e19] [--trials bakery,bakery-notes]
import sys, os, json, html, subprocess, argparse
sys.path.insert(0, 'tiledata/hand-interior/v5')
import notes6
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('--before-rev', default='693f22e19'); ap.add_argument('--trials', default='bakery,bakery-notes')
a = ap.parse_args()
VIZ = os.path.expanduser('~/claude-viz'); IMG = os.path.join(VIZ, 'interior-desc'); os.makedirs(IMG, exist_ok=True)
before_meta = json.loads(subprocess.check_output(['git', 'show', f'{a.before_rev}:tiledata/hand-interior/v5/interior-meta.json']))
B = {o['id']: o for o in before_meta['objects']}
A = {o['id']: o for o in json.load(open('tiledata/hand-interior/v5/interior-meta.json'))['objects']}
S = json.load(open('src/assets/handInteriorSpec.json'))['objects']
atlas = Image.open('tiledata/hand-interior/v5/interior-atlas.png').convert('RGBA')
esc = html.escape

def crop(k):
    r = A[k]['atlas']; im = atlas.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
    s = 3 if max(im.size) <= 48 else 2
    im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    bg = Image.new('RGBA', im.size, (92, 82, 72, 255)); bg.alpha_composite(im)
    fn = k.replace(' ', '_').replace(':', '-').replace('+', '_') + '.png'; bg.save(os.path.join(IMG, fn))
    return f'interior-desc/{fn}'

rows = []
for k in A:
    if k not in notes6.D6: continue
    wrong = k in ('display potion', 'display apple', 'display bread')
    why = '틀림' if wrong else '짧음' if len(B[k]['description']) < 20 else '돌려씀' if sum(1 for o in B.values() if o['description'] == B[k]['description']) > 1 else '보강'
    rows.append((['틀림', '짧음', '돌려씀', '보강'].index(why), f"""<tr data-why="{why}"><td><img src="{crop(k)}"></td><td><code>{esc(k)}</code><br>{esc(A[k]['name_ko'])}<br><span class="k">{A[k]['kind']}</span> <span class="w">{why}</span></td>
<td class="b">{esc(B[k]['description'])}<div class="t">{esc(' · '.join(B[k]['tags']) or '(태그 없음)')}</div></td>
<td><b>{esc(S[k]['desc'])}</b><br>{esc(S[k]['place'])}<div class="t">{esc(' · '.join(S[k]['tags']))}</div><div class="p">짝: {esc(', '.join(S[k]['pair']) or '-')}</div></td></tr>"""))

bj = json.load(open('verify-shots/hand-interior-parts/before.json')); aj = json.load(open('verify-shots/hand-interior-parts/after.json'))
def show(r):
    body = r.get('data'); txt = json.dumps(body, ensure_ascii=False, indent=1)
    if len(txt) > 3500: txt = txt[:3500] + '\n… (잘림)'
    return f"<div class='sum'>{esc(r.get('summary') or r.get('error', ''))} <i>({r.get('bytes', 0)} B)</i></div><pre>{esc(txt)}</pre>"
tool = ''.join(f"<h3><code>{esc(json.dumps(x['args'], ensure_ascii=False))}</code></h3><div class='two'><div><h4>전</h4>{show(x)}</div><div><h4>후</h4>{show(y)}</div></div>" for x, y in zip(bj, aj))

trials = []
for lab in a.trials.split(','):
    p = f'verify-shots/hand-interior-assistant/{lab}/summary.json'
    if not os.path.exists(p): continue
    s = json.load(open(p)); m = (s.get('maps') or [{}])[-1]
    png = next((f for f in os.listdir(os.path.dirname(p)) if f.startswith('map-') and f.endswith('.png')), None)
    img = ''
    if png:
        im = Image.open(os.path.join(os.path.dirname(p), png)); fn = f'trial-{lab}.png'; im.save(os.path.join(IMG, fn)); img = f"<img class='map' src='interior-desc/{fn}'>"
    trials.append((lab, s, m, img))
trow = ''.join(f"<tr><td>{esc(lab)}</td><td>{s['byTool'].get('read_tileset_reference', 0)}</td><td>{s['byTool'].get('list_hand_interior_parts', 0)}</td><td>{s['toolCalls']}</td><td>{s['failed']}</td><td>{round(s['ms']/1000)}s</td><td>{s['stats']['usage']['input']:,}</td><td>{esc(str(m.get('size')))} · 닿음 {m.get('reachableFromEntrance')}/{m.get('walkableCells')}</td><td class='b'>{esc(', '.join(r.split('/')[-1] for r in s['readReferences']))}</td></tr>" for lab, s, m, img in trials)
timgs = ''.join(f"<figure>{img}<figcaption>{esc(lab)}</figcaption></figure>" for lab, s, m, img in trials if img)

page = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>손 도트 실내 — 가구 설명·검색</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;margin:20px;background:#f6f4f0;color:#222}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccc;padding:6px;vertical-align:top;background:#fff}}
th{{background:#e8e2d8}}img{{image-rendering:pixelated}}td img{{max-width:140px}}.b{{color:#666}}.t{{color:#2a6;font-size:12px;margin-top:4px}}.p{{color:#86a;font-size:12px}}.k{{font-size:11px;background:#ddd;padding:1px 4px}}
.w{{font-size:11px;background:#fd8;padding:1px 4px}}pre{{background:#1e1e1e;color:#ddd;padding:8px;font-size:11px;max-height:360px;overflow:auto;white-space:pre-wrap}}.two{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.sum{{font-weight:600}}img.map{{max-width:520px;border:1px solid #999}}figure{{display:inline-block;margin:6px}}</style>
<h1>손 도트 실내 v5 — 가구 설명·검색 보강</h1>
<p>① 조수 시험 비교 ② 도구 응답 전후 ③ 다시 쓴 설명 {len(rows)}종(그림은 아틀라스에서 잘라 3배 확대). 판단: 참고문서 읽기 횟수가 줄었는지, 설명이 그림과 맞는지.</p>
<h2>① 조수 시험 「빵집 실내를 만들어줘」</h2>
<table><tr><th>시험</th><th>참고문서 read</th><th>list_parts</th><th>도구 호출</th><th>실패</th><th>시간</th><th>입력 토큰</th><th>결과 맵</th><th>읽은 문서</th></tr>{trow}</table>{timgs}
<h2>② list_hand_interior_parts 응답 전후</h2>{tool}
<h2>③ 다시 쓴 설명</h2><p>짧음 = 20자 미만, 돌려씀 = 다른 소품과 같은 문장, 틀림 = 그림과 다름(진열대 3종은 천 탁자가 아니라 작은 나무 진열대), 보강 = 어디에가 비었던 것.</p>
<table><tr><th>그림</th><th>id</th><th>전 설명 · 태그</th><th>후 desc / place · 태그 · 짝</th></tr>{''.join(r for _, r in sorted(rows, key=lambda t: t[0]))}</table></html>"""
open(os.path.join(VIZ, 'interior-desc.html'), 'w').write(page)
print('rows', len(rows), 'trials', [t[0] for t in trials])
