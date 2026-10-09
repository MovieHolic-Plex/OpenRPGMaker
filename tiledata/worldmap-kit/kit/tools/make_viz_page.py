#!/usr/bin/env python3
"""out/ 의 결과로 비교 페이지(자체완결 HTML, 이미지는 data URI)를 쓴다.

  python3 kit/tools/make_viz_page.py [--out ~/claude-viz/worldmap-kit.html]
"""
import argparse
import base64
import html
import json
import re
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
WM = KIT.parent
OUT = WM / 'out'


def b64(path):
    return 'data:image/png;base64,' + base64.b64encode(Path(path).read_bytes()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(Path.home() / 'claude-viz' / 'worldmap-kit.html'))
    a = ap.parse_args()
    report = json.loads((OUT / 'build-report.json').read_text())
    world = json.loads((OUT / 'world.json').read_text())
    check = (OUT / 'journey-check.txt').read_text()
    roles = json.loads((KIT / 'roles.json').read_text())
    man = json.loads((WM / 'iconsets' / 'fantasy' / 'manifest.json').read_text())
    jr = json.loads((WM / 'journeys' / 'fantasy-5act.json').read_text())
    pals = []
    for pid in world['palettes']:
        pj = json.loads((WM / 'palettes' / (pid + '.json')).read_text())
        pals.append(dict(id=pid, name=pj['name'], desc=pj['desc'], img=b64(OUT / world['images'][pid]), m=report['palettes'][pid]))
    sheet_uri = b64(WM / 'iconsets' / 'fantasy' / 'sheet.png')

    # 역할 표
    by_role = {}
    for ic in man['icons']:
        by_role.setdefault(ic['role'], []).append(ic)
    places = {}
    for p in jr['places']:
        places.setdefault(p['role'], []).append(p['id'])
    legacy = {l['icon']: l for l in roles['legacy_fantasy']}
    rows = []
    for r in roles['roles']:
        thumbs = ''
        for ic in by_role.get(r['id'], []):
            w, h = ic['cells']
            fit = legacy[ic['name']]['fits']
            thumbs += '<span class="th%s" title="%s %dx%d%s" style="width:%dpx;height:%dpx;--x:-%dpx;--y:-%dpx"></span>' % (
                '' if fit else ' bad', html.escape(ic['name']), w, h, '' if fit else ' (칸 수 불일치 fits:false)', w * 16, h * 16, ic['col'] * 16, ic['row'] * 16)
        rows.append('<tr><td><code>%s</code></td><td>%dx%d</td><td>%s</td><td class="thumbs">%s</td><td>%s</td></tr>' % (
            r['id'], *r['cells'], html.escape(r['name']), thumbs, html.escape(', '.join(places.get(r['id'], [])) or '—')))
    roles_table = '\n'.join(rows)

    # 도달성 보고 요약
    stage = re.findall(r'^  R(\d)  (.+?)\s+수단: (.+?)\s+땅/발판 칸\s+(\d+) \(\+(\d+)\)\s+닿는 장소\s+(\d+) \(\+(\d+)\)', check, re.M)
    stage_rows = ''.join('<tr><td>R%s</td><td>%s</td><td>%s</td><td>%s (+%s)</td><td>%s (+%s)</td></tr>' % (
        s[0], html.escape(s[1].strip()), html.escape(s[2].strip()), s[3], s[4], s[5], s[6]) for s in stage)
    ok2 = len(re.findall(r'^  OK .+설계 \d막\s+BFS \d막', check, re.M))
    xx2 = len(re.findall(r'^  XX ', check, re.M))
    last = [l for l in check.splitlines() if l.startswith('결과:')][-1]
    key_lines = [l.strip() for l in check.splitlines() if re.match(r'^  OK (요새 통행증|범선|사막선|비공정)\s', l) or re.match(r'^  OK 천공섬 는', l)]
    legs = [l.strip() for l in check.splitlines() if re.match(r'^  (OK|XX) .+ → .+ 수단', l)]
    legs_ok = sum(1 for l in legs if l.startswith('OK'))

    # 지표 표
    mrows = ''
    for p in pals:
        m = p['m']['terrain_metrics']
        im = p['m']['icon_metrics']
        mrows += '<tr><td>%s</td><td>%s %.3f</td><td>%s %d</td><td>%s %.2f · 중앙 %.2f</td></tr>' % (
            html.escape(p['id']), m['key_min_pair'][0], m['key_min_pair'][1], m['key_min_steps'][0], m['key_min_steps'][1], html.escape(im['min'][0]), im['min'][1], im['median'])

    buttons = ''.join('<button data-p="%s"%s>%s</button>' % (p['id'], ' class="on"' if p['id'] == 'winter' else '', html.escape(p['name'])) for p in pals)
    imgs_js = json.dumps({p['id']: p['img'] for p in pals})
    descs_js = json.dumps({p['id']: p['desc'] for p in pals}, ensure_ascii=False)

    page = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>월드맵 키트 — 빌더·팔레트 층</title>
<style>
:root{color-scheme:dark}
body{margin:0;background:#12151c;color:#d9deea;font:14px/1.55 system-ui,"Noto Sans KR",sans-serif}
main{max-width:1280px;margin:0 auto;padding:20px 24px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2a3040;padding-bottom:4px}
p.sub{color:#9aa4b8;margin:0 0 14px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
button{background:#1d2330;color:#d9deea;border:1px solid #333b50;border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}
button.on{background:#3b5bdb;border-color:#5c7cfa;color:#fff}
.mapbox{background:#000;border:1px solid #2a3040;overflow:auto;max-height:84vh}
.mapbox img{display:block;image-rendering:pixelated}
.two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border-bottom:1px solid #2a3040;padding:5px 8px;text-align:left;vertical-align:middle}th{color:#9aa4b8;font-weight:600}
code{background:#1d2330;padding:1px 5px;border-radius:4px}
.thumbs{display:flex;gap:4px;flex-wrap:wrap}
.th{display:inline-block;background-image:url(__SHEET__);background-position:var(--x) var(--y);image-rendering:pixelated;background-color:#1d2330;outline:1px solid #333b50}
.th.bad{outline:2px solid #ff6b6b}
.ok{color:#69db7c}.warn{color:#ffd43b}.bad{color:#ff8787}
.card{background:#171c27;border:1px solid #2a3040;border-radius:8px;padding:12px 16px;margin:10px 0}
li{margin:3px 0}pre{background:#0d1017;padding:10px;overflow:auto;font-size:12px;border-radius:6px}
.desc{min-height:2.6em;color:#b6bfd4}
</style></head><body><main>
<h1>월드맵 키트 — 빌더·팔레트 층</h1>
<p class="sub">지형(공용) · 팔레트 · 아이콘 세트 · 여정 템플릿 4층으로 가른 키트의 결과. fantasy 세트 × 6 팔레트. 보고 판단할 것: ① 아래 지도에서 팔레트를 바꿔 가며 <b>지형 종류가 서로 구별되는가</b>(특히 한겨울) ② <b>아이콘이 묻히지 않는가</b> ③ 도달성 검사가 통과하는가 ④ 자기평가의 한계.</p>

<h2>1. 6팔레트 지도 (같은 지형 · 같은 아이콘, 색 표만 교체)</h2>
<div class="bar" id="pbar">__BUTTONS__</div>
<div class="bar"><label><input type="checkbox" id="cmp"> 원본과 나란히</label>
<label>배율 <select id="zoom"><option value="0.5">0.5x</option><option value="0.75" selected>0.75x (한 화면)</option><option value="1">1x (1536px)</option><option value="2">2x</option></select></label></div>
<div class="desc" id="desc"></div>
<div class="mapbox" id="mapbox"></div>

<h2>2. 지표 (build-report.json) — 눈으로 보기 전에 뭉침을 잡는 숫자</h2>
<table><tr><th>팔레트</th><th>주요 지형 평균색 최소 쌍거리 (원본 0.037)</th><th>주요 지형 최소 명암 단 수 (3 미만이면 뭉침)</th><th>아이콘이 둘레와 다른 화소 비율(최저 · 중앙)</th></tr>__MROWS__</table>
<p class="sub">주요 지형 = 초원·사바나·모래·툰드라·눈·숲·산·절벽·늪·황무지·화산재·바다·강. 거리는 OKLab. 이 숫자는 보조이고 판정은 위 지도를 눈으로 본 것이다.</p>

<h2>3. 역할 표 — 17 역할 × 칸 수 (fantasy 의 아이콘 38종이 들어간 모습)</h2>
<table><tr><th>역할 id</th><th>칸</th><th>이름</th><th>fantasy 아이콘 (붉은 테두리 = 칸 수 불일치 fits:false)</th><th>fantasy-5act 에서 쓰는 장소</th></tr>
__ROLES__</table>
<p class="sub">다른 두 세계관 세트는 이 17 역할을 이 칸 수대로 채우면 된다. 빌더는 역할의 칸 수와 같은 아이콘만 후보로 삼고, 변형이 여럿이면 장소 id 의 crc32 로 고른다(세트의 <code>pins</code> 가 우선).</p>

<h2>4. 도달성 검사 — fantasy-5act 템플릿 × fantasy 세트 (world.json 으로 돌린 결과)</h2>
<div class="card"><b class="ok">__LAST__</b> · 막 구분 대조 OK __OK2__곳 / XX __XX2__곳 · 줄거리 선 __LEGS_OK__/__LEGS__구간이 그 막의 수단만으로 지도 위에서 이어진다</div>
<table><tr><th>막</th><th>이름</th><th>쥐고 있는 수단</th><th>땅/발판 칸</th><th>닿는 장소</th></tr>__STAGE__</table>
<ul>__KEYS__</ul>
<details><summary>전체 보고 (journey-check.txt)</summary><pre>__CHECK__</pre></details>

<h2>5. 눈 검수 (직접 열어 본 것)</h2>
<div class="card">
<p><b>라운드 1</b> 재배색 실험의 규칙(한 줄 hue/채도 연산)을 그대로 옮겨 렌더 → ✗ 한겨울: 초원·사바나·모래·황무지가 한 색의 연한 흰 푸른빛으로 뭉쳐 지형이 안 구분됨(원인: 밝기 범위를 min~max 로 잡아 화면 대부분의 색이 램프 한 단에 몰림), ✗ 황혼·화산재: 평지 종류가 올리브/갈색 일색.<br>
<b>라운드 2</b> 지형 종류별 3~4단 램프로 다시 적고 램프를 화소 가중 2~98% 밝기에 폄 → ✓ 한겨울 구별, ✗ 황혼의 초원·사바나가 형광에 가까운 채도.<br>
<b>라운드 3</b> 황혼 채도를 낮추고 화산재의 재·바다·산, 한겨울의 산·툰드라 간격을 벌림 → 통과. <b>라운드 4</b> 한겨울 초원·툰드라를 더 갈라 놓음(교외 평지와 고원 윗면의 경계가 흐렸다).</p>
<ul>
<li><b>① original = final3</b> : <span class="ok">✓</span> 화소 단위로 같다(차이 화소 0 / 1,769,472, <code>kit/selftest.py</code>)이고 눈으로도 원래 지도와 같은 그림을 확인.</li>
<li><b>② winter 에서 지형이 구별됨</b> : <span class="ok">✓</span> 북쪽 눈(흰색) · 툰드라(청록 회색) · 초원(연한 녹청) · 사막/사바나(베이지) · 고원 윗면(청회색) · 숲(진한 청록) · 산(연보라 회색) · 늪·화산재(어둡게)가 서로 다른 색상과 명암을 갖는다. 아쉬운 점: 눈 덮인 초원은 원본의 초원처럼 한 면이 넓고 평평하다(칸 노이즈를 더하지 않았다).</li>
<li><b>③ dusk · ashfall 에서 구역이 구별됨</b> : <span class="ok">✓</span> 둘 다 초원·모래·사바나·북쪽 툰드라·붉은 고원·화산재 지대·독늪이 구분된다. 황혼이 더 또렷하고, 화산재는 올리브·황토 중간톤이 비슷해 구별이 약하다(그래도 숲/평지/모래는 갈린다).</li>
<li><b>④ 아이콘이 묻히지 않음</b> : <span class="ok">✓</span> 4팔레트 모두 대성·요새·탑·신전이 또렷하다. 낮은 곳: 어두운 화산재 위의 화염 요새, 섬 폐허(묘당)는 황혼·화산재에서 둘레와 명도 차가 작다(원본도 어두운 바탕 위라 비슷하다).</li>
</ul></div>

<h2>6. 자기평가</h2>
<div class="card"><ul>
<li><b>잘 된 것</b> : 원본 지형·아이콘 배치가 화소 단위로 재현된다(selftest). 입력 오류(역할 빠짐·칸 수 틀림·pins 틀림·없는 팔레트·없는 여정)는 무엇이 모자란지 적고 종료 코드 2 로 멈춘다. 도달성 검사는 world.json 의 지형만으로 원래 보고와 글자 단위로 같은 결과를 낸다. 팔레트 한 장은 캐시가 있으면 약 2초.</li>
<li><b>한계 1 — role 은 렌더가 끝난 색에서 거꾸로 센다</b> : 지형 코드가 색 표를 직접 읽는 구조가 아니라서 색 → 칸 종류 대응의 순도가 0.845 다. 칸 경계에 걸친 색(오토타일 가장자리·사구 마루)은 이웃 종류의 램프를 탈 수 있다. 눈에 띄는 오염은 못 봤지만 정확한 것은 아니다.</li>
<li><b>한계 2 — 지형은 한 벌뿐</b> : 96x72 대륙 둘·장벽 4개가 고정이다. 여정 템플릿의 장소 id·좌표 일부(내해 항구·고갯길 요새·사막 신전·사막 폐허·설원 마을, 천공섬)는 지형 코드가 이름과 좌표로 직접 참조한다. 다른 이야기는 같은 지형 위에서 역할·막·수단 배치만 바꿀 수 있다.</li>
<li><b>한계 3 — 첫 지형 렌더가 느리다</b> : 약 100초(한 번). --cache 로 이후 팔레트는 몇 초.</li>
<li><b>한계 4 — fantasy 한 세트로만 시험</b> : desert-east · modern-sf 가 17 역할을 채우기 전에는 칸 수·그림자 규약이 실제 다른 세트에서 맞는지 확인하지 못했다(오류 처리는 가짜 세트로만 시험).</li>
<li><b>한계 5 — 제품 번들 미등록</b> : 제품의 <code>atlas_biome_world</code> 는 타일 인덱스 방식이고 이 키트는 래스터 렌더라서, 등록하려면 지형 오토타일/경계 키트를 시트로 굽는 별도 작업이 필요하다.</li>
<li><b>변경한 것</b> : 지형 모듈은 경로 상수만 바꿨고, 천공섬의 바다 그림자와 아이콘 붙이기를 지형 단계에서 분리했다(결과 화소 동일). 한 가지 추가: 세트 manifest 에 선택 필드 <code>pins</code>(장소→아이콘 고정)를 두어 fantasy 의 손 배정을 보존했다.</li>
</ul></div>

<script>
const IMGS=__IMGS__, DESC=__DESCS__;
let cur='winter';
const box=document.getElementById('mapbox'),cmp=document.getElementById('cmp'),zoom=document.getElementById('zoom'),desc=document.getElementById('desc');
function draw(){
  const z=parseFloat(zoom.value),w=1536*z;
  const one=(id,label)=>'<div><div style="padding:2px 6px;background:#12151c;color:#9aa4b8">'+label+'</div><img src="'+IMGS[id]+'" width="'+w+'"></div>';
  box.innerHTML=cmp.checked&&cur!=='original'?'<div class="two">'+one('original','original')+one(cur,cur)+'</div>':one(cur,cur);
  desc.textContent=DESC[cur];
  document.querySelectorAll('#pbar button').forEach(b=>b.classList.toggle('on',b.dataset.p===cur));
}
document.querySelectorAll('#pbar button').forEach(b=>b.onclick=()=>{cur=b.dataset.p;draw()});
cmp.onchange=draw;zoom.onchange=draw;draw();
</script></main></body></html>'''
    rep = {'__SHEET__': sheet_uri, '__BUTTONS__': buttons, '__MROWS__': mrows, '__ROLES__': roles_table, '__LAST__': html.escape(last),
           '__OK2__': str(ok2), '__XX2__': str(xx2), '__LEGS_OK__': str(legs_ok), '__LEGS__': str(len(legs)), '__STAGE__': stage_rows,
           '__KEYS__': ''.join('<li class="ok">%s</li>' % html.escape(k) for k in key_lines), '__CHECK__': html.escape(check),
           '__IMGS__': imgs_js, '__DESCS__': descs_js}
    for k, v in rep.items():
        page = page.replace(k, v)
    Path(a.out).write_text(page)
    print('wrote', a.out, round(len(page) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
