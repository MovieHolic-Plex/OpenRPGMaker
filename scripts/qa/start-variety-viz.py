#!/usr/bin/env python3
"""start-variety 프로브 결과 → ~/claude-viz/start-variety.html (이미지는 ~/claude-viz/start-variety/ 로 복사).
   bun scripts/qa/start-variety-probe.mts && bun scripts/qa/start-variety-example-probe.mts && python3 scripts/qa/start-variety-viz.py"""
import json, html, collections, os, shutil, glob
SRC = 'output/evidence/start-variety'
DST = os.path.expanduser('~/claude-viz')
os.makedirs(f'{DST}/start-variety', exist_ok=True)
for f in glob.glob(f'{SRC}/*.png'): shutil.copy(f, f'{DST}/start-variety/')
R = json.load(open(f'{SRC}/report.json')); X = json.load(open(f'{SRC}/example-report.json'))
TH = {'river':'강가','coast':'포구','desert':'사막','snow':'설원','swamp':'늪'}
FO = {'street':'길가','scatter':'흩어진','riverbank':'물가 띠','plaza':'광장'}
TE = {'flat':'평지','terraces':'계단식 비탈','hillside':'눈 덮인 비탈','basin':'오아시스 골','ridge':'마른 둔덕'}
def card(x):
    p = x['plan']; n = x['new']; o = x['old']; pre = p['prebuildTown']; s = x['slug']
    note = f"칩셋 <b>{n['tileset']}</b> · " + ('시작 마을을 코드가 미리 지음' if pre else '시작 맵은 그 칩셋의 빈 땅 — 마을은 AI가 같은 칩셋으로 지음')
    return f'''<section class="card"><h3>{html.escape(x['title'])}</h3>
<p class="meta">{x['genre']} · 구상 <b>{TH[p['theme']]}·{FO[p['form']]}·{TE[p['terrain']]}</b> · {note}</p>
<div class="grid"><div><h4>옛 시작 맵 {o['start'][0]}×{o['start'][1]}</h4><img src="start-variety/{s}-old-start.png"></div>
<div><h4>새 시작 맵 {n['start'][0]}×{n['start'][1]}</h4><img src="start-variety/{s}-new-start.png"></div>
<div><h4>옛 길 맵 {o['route'][0]}×{o['route'][1]}</h4><img class="r" src="start-variety/{s}-old-route.png"></div>
<div><h4>새 길 맵 {n['route'][0]}×{n['route'][1]}</h4><img class="r" src="start-variety/{s}-new-route.png"></div></div></section>'''
rs = collections.Counter(tuple(x['new']['route']) for x in R)
forms = collections.Counter(f"{TH[x['plan']['theme']]}·{FO[x['plan']['form']]}" for x in R)
tsets = collections.Counter(x['new']['tileset'] for x in R)
pre = sum(1 for x in R if x['plan']['prebuildTown'])
allok = all(x['old']['ok'] and x['new']['ok'] for x in R)
ex = ''.join(f'<div><h4>{html.escape(e["title"])} ({e["size"][0]}×{e["size"][1]})</h4><img src="start-variety/{e["file"]}"></div>' for e in X if 'file' in e)
page = f'''<!doctype html><meta charset="utf-8"><title>새 게임 시작 맵 — 옛 vs 새</title>
<style>body{{background:#14161c;color:#e6e6ea;font:14px/1.5 system-ui,sans-serif;margin:auto;padding:24px;max-width:1500px}}
h1{{font-size:22px}}h3{{margin:0 0 2px}}h4{{margin:6px 0 4px;font-size:12px;color:#9aa}}.meta{{margin:0 0 8px;color:#bbc}}
.card{{background:#1d2029;border-radius:10px;padding:14px 16px;margin:16px 0}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.grid img{{width:100%;image-rendering:pixelated;border:1px solid #333;background:#000;max-height:360px;object-fit:contain}}.r{{max-height:220px!important}}
.dim img{{opacity:.45}}.sum{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}.box{{background:#1d2029;border-radius:10px;padding:14px 16px}}
.bad{{color:#ff8a7a}}.good{{color:#7ee0a0}}.ex{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}}.ex img{{width:100%;image-rendering:pixelated;border:1px solid #333}}</style>
<h1>새 게임 시작 맵 — 옛 고정 뼈대 vs 컨셉에서 뽑은 구상</h1>
<p>번들 컨셉 카드 {len(R)}장(모험·스토리)에 옛 뼈대와 새 뼈대를 각각 깔고 자동 플레이 판정까지 돌렸다. 판정: {'옛·새 모두 전부 통과' if allok else '일부 실패 있음'}.</p>
<div class="sum"><div class="box"><h3 class="bad">옛</h3>
<p>길 맵 <b>{len(R)}장 전부 24×12</b>, 입구·구간 끝 줄 6 고정, 시작 맵은 장르와 무관한 빈 풀밭 20×15. 「예제로 시작」은 제목이 뭐든 같은 마을(seed 7).</p></div>
<div class="box"><h3 class="good">새</h3>
<p>길 맵 크기 {len(rs)}종 ({', '.join(f'{w}×{h}' for (w,h) in sorted(rs))}). 마을 구상 {len(forms)}종 ({', '.join(f'{k} {v}' for k,v in forms.items())}).<br>
칩셋: {', '.join(f'{k} {v}' for k,v in tsets.items())} (옛: 전부 beodeul_city). 시작 마을을 코드가 미리 지은 컨셉은 버들항 {pre}/{len(R)}장 — 나머지는 컨셉의 칩셋(현대 jp_city·조선·마법 학교)의 빈 땅으로 시작 맵을 옮기고 길 맵을 그 칩셋의 길·마당으로 깐다. 마을 자체는 AI가 같은 칩셋 계열로 짓는다.</p></div></div>
<h2>「예제로 시작」 — 제목마다 다른 마을</h2>
<div class="ex">{ex}</div>
<h2>컨셉 카드별 (옛 | 새)</h2>
{''.join(card(x) for x in R)}
<p style="color:#889">같은 기획이면 같은 구상(재현 가능). 판정 = 시작부터 구간 끝까지 자동 플레이로 닿는가(재미·미관 보증 아님).</p>'''
open(f'{DST}/start-variety.html', 'w').write(page)
print('ok', pre, len(R))
