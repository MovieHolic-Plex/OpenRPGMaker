#!/usr/bin/env python3
"""비교 페이지(자체완결 data URI)를 ~/claude-viz/worldmap-set-modern-sf.html 에 쓴다.  python3 page.py  (build.py 뒤에)"""
import base64
import io
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'lib'))
from PIL import Image  # noqa: E402
import numpy as np  # noqa: E402
from show import on_ground, GROUNDS  # noqa: E402

OUT = Path.home() / 'claude-viz' / 'worldmap-set-modern-sf.html'


def uri(img):
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def up(img, z):
    return img.resize((img.width * z, img.height * z), Image.NEAREST)


def main():
    man = json.loads((HERE / 'manifest.json').read_text())
    sheet = np.array(Image.open(HERE / 'sheet.png').convert('RGB'))
    cards = []
    for ic in man['icons']:
        w, h = ic['cells']
        a = sheet[ic['row'] * 16:(ic['row'] + h) * 16, ic['col'] * 16:(ic['col'] + w) * 16]
        im8 = up(Image.fromarray(on_ground(a)), 8)
        im1 = Image.fromarray(on_ground(a, GROUNDS['sand']))
        cards.append(f'''<div class="card"><div class="t">{ic['role']} · {ic['name']} <small>{w}x{h}칸</small></div>
<img class="big" src="{uri(im8)}"><div class="row"><img class="px1" src="{uri(up(im1, 2))}" title="2배 (사막 위)"><span>{ic['desc']}</span></div></div>''')
    ctx = []
    for k, label in (('grass', '초원'), ('desert', '사막'), ('hills', '언덕'), ('waste', '황무지')):
        p = HERE / 'preview' / f'map-ctx-{k}-12x9-2x.png'
        ctx.append(f'<figure><img src="{uri(Image.open(p).convert("RGB"))}"><figcaption>{label} — 12x9칸 ×2배</figcaption></figure>')
    allmap = HERE / 'preview' / 'map-all-grass-2x.png'
    crit = (HERE / 'criteria.md').read_text()
    # criteria.md 의 3라운드 표만 뽑아 HTML 표로
    sec = crit.split('## 3라운드')[1].split('## 지도 맥락')[0]
    rows = []
    for ln in sec.splitlines():
        if ln.startswith('|') and not ln.startswith('|---') and '역할 / 아이콘' not in ln:
            c = [x.strip() for x in ln.strip('|').split('|')]
            if len(c) >= 3:
                cls = 'ok' if c[2].startswith('✓') else 'warn'
                rows.append(f'<tr><td>{c[0]}</td><td>{c[1]}</td><td class="{cls}">{c[2]}</td></tr>')
    stats = (HERE / 'stats.md').read_text().split('\n')
    srows = [ln for ln in stats if ln.startswith('|')]
    shead = srows[0].strip('|').split('|')
    st_html = '<tr>' + ''.join(f'<th>{x.strip()}</th>' for x in shead) + '</tr>' + ''.join(
        '<tr>' + ''.join(f'<td>{x.strip()}</td>' for x in r.strip('|').split('|')) + '</tr>' for r in srows[2:])
    chk = json.loads((HERE / 'sheet-check.json').read_text())
    sw = ''.join(f'<span class="sw" style="background:#{c}" title="#{c}"></span>' for c in man['extra_colors'])
    html = f'''<!doctype html><meta charset="utf-8"><title>월드맵 아이콘 세트 — 현대·SF</title>
<style>
body{{background:#1b1c20;color:#e8e8ea;font:14px/1.5 system-ui,sans-serif;margin:24px;max-width:1500px}}
h1{{font-size:22px}} h2{{margin-top:34px;font-size:17px;border-bottom:1px solid #444;padding-bottom:4px}}
.grid{{display:flex;flex-wrap:wrap;gap:14px}}
.card{{background:#25262c;padding:8px;border-radius:6px}}
.card .t{{font-weight:600;margin-bottom:4px}} .card small{{color:#999;font-weight:400}}
.big{{image-rendering:pixelated;display:block;max-width:100%}}
.row{{display:flex;gap:10px;align-items:flex-start;margin-top:6px;max-width:520px;font-size:12px;color:#bbb}}
.px1{{image-rendering:pixelated}}
figure{{margin:0 14px 14px 0;display:inline-block}} figure img{{image-rendering:pixelated}} figcaption{{color:#aaa;font-size:12px}}
table{{border-collapse:collapse;font-size:12px;margin-top:8px}} td,th{{border:1px solid #444;padding:3px 7px;text-align:left}}
td.ok{{color:#8fd68f}} td.warn{{color:#ffc46b}} th{{background:#2d2e35}}
.sw{{display:inline-block;width:22px;height:22px;margin-right:4px;border:1px solid #666;vertical-align:middle}}
.note{{color:#bbb;max-width:1000px}}
</style>
<h1>월드맵 아이콘 세트 — 현대·SF <small style="color:#999">(modern-sf · {len(man['icons'])}장 / 17역할)</small></h1>
<p class="note">무엇을 보고 판단하나: (1) 각 아이콘이 의도한 것으로 읽히는지(오른쪽 설명과 대조) (2) 윗면이 보이고 오른쪽 아래로 그림자가 지는지 (3) 지도 맥락에서 한 세트로 읽히고 지형에 묻히지 않는지. 3/4 시점은 투영 렌더러(u = x + .28y, v = z + .5y)가 구조적으로 보장하고, 「뭘로 읽히나」는 사람 눈 판정이다.</p>
<h2>도감 (8배, 초원 위 · 작은 그림은 2배 사막 위)</h2><div class="grid">{''.join(cards)}</div>
<h2>지도 맥락 — 원본 월드 칩셋 지형 위</h2>{''.join(ctx)}
<h2>한 지도에 전부 (초원, 2배)</h2><img style="image-rendering:pixelated;max-width:100%" src="{uri(Image.open(allmap).convert('RGB'))}">
<h2>기준표 — 「이게 뭐로 보이나」 (3라운드 최종)</h2>
<table><tr><th>역할 / 아이콘</th><th>8배에서 읽힌 것</th><th>판정</th></tr>{''.join(rows)}</table>
<p class="note">1·2라운드에서 ✗ 였던 것(shrine 흰 알, circle 양배추, camp_b 납작 판, 증기 캡슐, 풍차 십자 등)과 고친 내용은 criteria.md 에 있다.</p>
<h2>면 픽셀 수(렌더러가 센 값)</h2><table>{st_html}</table>
<h2>색 집합 검사</h2>
<p class="note">시트에 쓰인 색 {chk['used_colors']}개 중 원본 월드 칩셋 색 {chk['from_world']}개, 세트 전용 보조색 {chk['new_count']}개(≤12), 선언 안 된 새 색 {len(chk['undeclared_new'])}개 → {'통과' if chk['ok'] else '실패'}.</p>
<p>{sw}</p>
<p class="note">보조색(16진수): {', '.join('#'+c for c in man['extra_colors'])}</p>
'''
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(OUT, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
