#!/usr/bin/env python3
"""최종 검수 페이지 ~/claude-viz/desert-east.html — 팔레트 · 조각 전부(관문 판정 표시) · 구성기 장면 5 · 방 6 · 조수 실제 실행 결과.

  python3 final_page.py --scenes /tmp/de-final --gate /tmp/de-gate.json [--ai /tmp/ai-gemini-de/summary.json]

--scenes 폴더: <kind>.png(야외) · room-<kind>.png(실내). --gate: {"de-<id>": "PASS"|"FAIL ..."} . --ai: [{"prompt","score","note","pngs":[path]}].
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, buildings as BD, props as PR, interior as IN
from page import card, write, uri

ap = argparse.ArgumentParser()
ap.add_argument('--scenes', required=True); ap.add_argument('--gate', required=True); ap.add_argument('--ai')
a = ap.parse_args()
gate = json.load(open(a.gate))
z = 2
sand = TR.R.render(TR.R.by['sand']).img()
bg = uri(sand, z)
pal = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'palette.json')))


def verdict(pid):
    v = gate.get(pid, '판정 없음')
    col = '#7fd17f' if v.startswith('PASS') else '#ff8a7a'
    return '<span style="color:%s">%s</span>' % (col, v)


n_pass = sum(1 for v in gate.values() if v.startswith('PASS'))
body = ['<p>사막·동양풍(아라비아·실크로드·이집트·메소포타미아) 새 공용 칩셋 <b>desert_east</b>. 16px 3/4 탑뷰, 코드 손 도트, 잠긴 팔레트(램프 %d개). '
        '3/4 관문(object-gate, gemini-3.8-flash ×4 과반) 판정: <b>%d / %d 통과</b> — 보정 프로필이 미보정이라 통과는 잠정이다. 장면·방은 원 해상도 1배로 둔다(브라우저에서 확대해 볼 것).</p>'
        % (len([k for k in pal if not k.startswith('_')]), n_pass, len(gate))]
body.append('<h2>무엇을 보면 되나</h2><ul><li>장면: 건물 문 앞이 길로 이어지는가, 소품이 맞는 땅(야자=풀, 낙타·덤불=모래) 위에 있는가, 빈 땅에 용도가 있는가.</li>'
            '<li>조각: 윗면이 면으로 보이는가(3/4), 관문 판정 색(초록 통과·빨강 미통과).</li><li>조수: 실제 입력창 경로(gemini-3.8-flash high)로 지은 맵과 점수.</li></ul>')
if a.ai and os.path.exists(a.ai):
    body.append('<h2>조수 실제 실행 (gemini-3.8-flash high)</h2>')
    for r in json.load(open(a.ai)):
        body.append('<h3>「%s」 — %s</h3><p>%s</p><div class=grid>' % (r['prompt'], r.get('score', ''), r.get('note', '')))
        for p in r.get('pngs', []):
            if os.path.exists(p): body.append('<div class="card wide"><img src="%s"><div class=nm>%s</div></div>' % (uri(Image.open(p).convert('RGBA')), os.path.basename(p)))
        body.append('</div>')
body.append('<h2>구성기 장면 (compose_desert_east_map, 씨앗 2)</h2><div class=grid>')
for k in ['oasis', 'bazaar', 'palace', 'pyramid', 'caravanserai']:
    p = os.path.join(a.scenes, k + '.png')
    if os.path.exists(p): body.append('<div class="card wide"><img src="%s"><div class=nm>%s</div></div>' % (uri(Image.open(p).convert('RGBA')), k))
body.append('</div><h2>실내 방 (compose_desert_east_room, 2배)</h2><div class=grid>')
for k in ['teahouse', 'shop', 'palace_hall', 'tomb', 'hammam', 'inn']:
    p = os.path.join(a.scenes, 'room-%s.png' % k)
    if os.path.exists(p): body.append(card(k, Image.open(p).convert('RGBA'), 2))
body.append('</div><h2>팔레트</h2><table>')
for k, v in pal.items():
    if k.startswith('_'): continue
    body.append('<tr><td>%s</td><td>%s</td></tr>' % (k, ''.join('<span style="display:inline-block;width:26px;height:18px;background:%s"></span>' % c for c in v)))
body.append('</table>')
for title, reg in (('건물·유적·성벽·천막', BD.R), ('야외 소품', PR.R), ('실내', IN.R)):
    body.append('<h2>%s (%d)</h2><div class=grid>' % (title, len(reg.items)))
    for it in reg.items:
        pid = 'de-' + it['id']
        body.append(card(pid + ' · ' + it['name'], reg.render(it).img(), z, '칸 %d×%d · %s · %s' % (it['w'], it['h'], it['kind'], verdict(pid)), None if title == '실내' else bg))
    body.append('</div>')
body.append('<h2>바닥 한 칸·모서리 왕 타일</h2><div class=grid>')
for it in TR.R.items:
    if it.get('wang'): continue
    pid = 'de-' + it['id']
    im = TR.R.render(it).img(); t = Image.new('RGBA', (48, 48))
    for x in range(3):
        for y in range(3): t.paste(im, (x * 16, y * 16))
    body.append(card(pid, t, z, verdict(pid)))
for sid in TR.WANG:
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tiledata', 'desert-east', 'terrain', '_gate', 'de-wang-%s.png' % sid)
    if os.path.exists(p): body.append(card('de-wang-' + sid, Image.open(p).convert('RGBA'), z, verdict('de-wang-' + sid)))
body.append('</div>')
print(write('desert-east', 'desert_east 사막·동양풍 칩셋 — 조각·장면·방·조수', ''.join(body)))
