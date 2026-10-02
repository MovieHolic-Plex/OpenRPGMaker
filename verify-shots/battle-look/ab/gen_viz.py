# 조수 전투 화면 선택 A/B 시각화 생성기 — python3 gen_viz.py → ~/claude-viz/battle-look-ab.html
# 입력: /tmp/bws/ab-results.json(고치기 전·#1849), qa-runs/fix-*(#1858), qa-runs/v3-*(#1874), 블라인드 판정 JUDGE.
import json, os, html
Q = '/home/main/z-project/rpg-zzu-retro-btl-b/qa-runs'
OUT = os.path.expanduser('~/claude-viz/battle-look-ab.html')
JUDGE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'judge.json')))
LABEL = {'pixel':'도트 창','line':'흰 줄 상자','teal':'청람 작은 창','pattern':'무늬 상자','ink':'먹빛 금테','gold':'화려한 금테','parch':'양피지','icons':'아이콘 줄','veil':'얇은 장막','soft':'버튼 네 개','pop':'강렬한 사선','cinema':'영화식'}
BRIEFS = [('ember','잿불 광산의 세 사람','영웅 모험 · 「함께 해냈다는 뿌듯함」'),('dark','잿빛 왕관의 복수','어두운 복수극 · 「씁쓸한 비장함」'),('story','포포와 별사탕 숲','아이용 동화 · 「따뜻하고 귀여운」'),
          ('sf','별빛 정거장 탈출','SF · 「차갑고 고요한 우주」'),('comedy','엉터리 용사단','코미디 · 「배꼽 잡는 유쾌함」'),('youth','바람의 견습생들','청춘 모험 · 「밝고 경쾌한」')]
ARMS = [('before','고치기 전','main 2ce42d3'),('after','#1849','조수 지시 추가'),('fix','#1858','계획→실행 이음매'),('v3','#1874','「현대」 판정 수정 = 지금')]

def paw(run):
    p = f'{Q}/{run}/tools.jsonl'
    return sum('Pixel Art World 칩셋만' in l for l in open(p)) if os.path.exists(p) else None
def rekick(run):
    p = f'{Q}/{run}/events.ndjson'
    return os.path.exists(p) and any('plan_execution_rekick' in l for l in open(p))
def look_of(run):
    p = f'{Q}/{run}/project.json'
    return json.load(open(p))['system'].get('battleLook') if os.path.exists(p) else None
def old_img(look):
    if not look: return 'pixel'
    p, a = look.get('preset'), look.get('accent','')
    if p == 'gold': return 'gold-d9534f' if a == '#d9534f' else 'gold'
    if p == 'parch': return 'parch-ffaa00' if a == '#ffaa00' else 'parch'
    if p == 'ink':
        if look.get('font') == 'neodgm': return 'ink-neodgm'
        if look.get('turnOrder') and look.get('light'): return 'ink-turn-light'
        if look.get('turnOrder'): return 'ink-turn-dust'
        return 'ink-c0392b' if a == '#c0392b' else 'ink-c5a059'
    return 'pixel'

cells = {(b, a): [] for b, *_ in BRIEFS for a, *_ in ARMS}
for r in json.load(open('/tmp/bws/ab-results.json')):
    arm = r['arm']
    c = {'look': r.get('look'), 'aborted': r.get('status') == 'aborted', 'img': old_img(r.get('look')),
         'paw': None if arm == 'before' else paw(r['run']), 'rekick': False, 'round': r['round']}
    cells[(r['brief'], arm)].append(c)
for k in cells: cells[k].sort(key=lambda c: c.get('round', 0))
for n in sorted(os.listdir(Q)):
    for pre, arm in (('fix-', 'fix'), ('v3-', 'v3')):
        if n.startswith(pre):
            b = n[len(pre):].rsplit('-', 1)[0]
            lk = look_of(n)
            failed = n == 'fix-story-2'
            cells[(b, arm)].append({'look': lk, 'aborted': False, 'failed': failed, 'img': n, 'paw': paw(n), 'rekick': rekick(n)})

def verdict(b, look):
    p = (look or {}).get('preset', 'pixel')
    j = JUDGE[b]
    if p == j['best']: return 'best', '심판 1순위'
    if p in j['fit']: return 'ok', '심판: 어울림'
    if p in j['bad']: return 'bad', '심판: 안 어울림'
    return 'meh', '심판: 애매'

def cell(b, c):
    if c.get('failed'):
        return '<div class="cell ab"><div class="ph">맵 못 만듦<br><small>「현대 맵 → PAW 칩셋만」<br>거절이 막음 (#1874 로 고침)</small></div><p>—</p></div>'
    if c['aborted']:
        return '<div class="cell ab"><div class="ph">중단<br><small>계획만 말하고<br>아무것도 안 만듦 (#1858 로 고침)</small></div><p>—</p></div>'
    lk = c['look']
    if lk:
        cls, vtxt = verdict(b, lk)
        extra = ', '.join(f'{k}={v}' for k, v in lk.items() if k != 'preset')
        title = f"<b>{LABEL[lk['preset']]}</b>"
    else:
        cls, vtxt, extra, title = 'none', '손 안 댐', '', '기본 도트 창'
    tags = []
    if c['paw']: tags.append(f'<span class="pawt">맵 칠하기 거절 {c["paw"]}번</span>')
    if c['paw'] == 0: tags.append('<span class="okt">거절 0</span>')
    if c['rekick']: tags.append('<span class="rk">↻ 재요청으로 완주</span>')
    return (f'<div class="cell {cls}{" rek" if c["rekick"] else ""}"><img src="battle-look-ab/{c["img"]}.jpg">'
            f'<p>{title} <span class="v {cls}">{vtxt}</span><br><small>{html.escape(extra)}</small><br>{" ".join(tags)}</p></div>')

def stats(arm):
    runs = [(b, c) for b, *_ in BRIEFS for c in cells[(b, arm)]]
    done = [(b, c) for b, c in runs if not c['aborted'] and not c.get('failed')]
    chose = [(b, c) for b, c in done if c['look']]
    fit = [(b, c) for b, c in chose if verdict(b, c['look'])[0] in ('best', 'ok')]
    best = [(b, c) for b, c in chose if verdict(b, c['look'])[0] == 'best']
    pawruns = [c for b, c in runs if c['paw']]
    return len(runs), len(runs) - len(done), len(chose), len(fit), len(best), len(pawruns)

kpi = ''
for arm, name, sub in ARMS:
    n, ab, ch, fit, best, pw = stats(arm)
    pawtxt = '기록 없음' if arm == 'before' else f'맵 칠하기 거절이 난 판 {pw}'
    kpi += (f'<div class="k-{arm}">{name} <small>{sub}</small><b>{fit} / {n}</b>판이 심판 기준 어울리는 꾸밈<br>'
            f'<small>{n}판 · 꾸밈 고름 {ch} · 심판 1순위 {best} · 못 끝낸 판 {ab} · {pawtxt}</small></div>')

secs = ''
for b, t, sub in BRIEFS:
    j = JUDGE[b]
    rows = ''
    for arm, name, s in ARMS:
        cs = cells[(b, arm)]
        if not cs: continue
        rows += f'<div class="arm a-{arm}"><h3>{name}<br><small>{s}</small></h3><div class="cells">{"".join(cell(b, c) for c in cs)}</div></div>'
    secs += (f'<section><h2>{t} <span>{sub}</span></h2><p class="exp">블라인드 심판 — 1순위 <b>{LABEL[j["best"]]}</b> · 어울림 {", ".join(LABEL[x] for x in j["fit"])} · '
             f'안 어울림 {", ".join(LABEL[x] for x in j["bad"])}<br><small>「{html.escape(j["why"])}」</small></p>{rows}</section>')

page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>조수의 전투 화면 선택 A/B</title>
<style>body{{margin:0;background:#15161a;color:#e8e6df;font:14px/1.55 system-ui,sans-serif}}main{{max-width:1560px;margin:auto;padding:22px}}h1{{font-size:21px;margin:0 0 6px}}
.kpi{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}}.kpi div{{background:#1f2128;border:1px solid #333743;border-radius:8px;padding:12px 14px}}.kpi b{{font-size:26px;display:block}}
.k-before b{{color:#c9a46a}}.k-after b{{color:#d8c070}}.k-fix b{{color:#8fb8e8}}.k-v3 b{{color:#8fd18f}}
.note{{background:#2a2216;border:1px solid #6b5426;border-radius:8px;padding:10px 14px;color:#e9d5a8;margin:10px 0}}.fixnote{{background:#16202c;border:1px solid #2f4d6e;border-radius:8px;padding:10px 14px;color:#cfe0f2;margin:10px 0}}
section{{margin:26px 0;border-top:1px solid #2c2f38;padding-top:14px}}h2{{font-size:17px;margin:0}}h2 span{{color:#a9a395;font-weight:400;font-size:14px;margin-left:8px}}.exp{{color:#a9a395;margin:2px 0 8px}}
.arm{{display:flex;gap:12px;align-items:flex-start;margin:8px 0;padding:6px 0;border-radius:8px}}.arm h3{{width:96px;flex:none;font-size:13px;color:#c9c3b5;margin:6px 0}}.arm h3 small{{color:#8b8678;font-weight:400}}.a-v3{{background:#17221a}}
.cells{{display:flex;gap:10px;flex-wrap:wrap}}.cell{{width:220px;background:#1d1f25;border:2px solid #333743;border-radius:8px;padding:6px}}.cell img{{width:100%;display:block;border-radius:4px}}.cell p{{margin:5px 2px 0;font-size:12.5px}}
.cell.best,.cell.ok{{border-color:#4f8f4f}}.cell.bad{{border-color:#9a4a3a}}.cell.meh{{border-color:#8a7a3a}}.cell.none img{{opacity:.45;filter:grayscale(.6)}}.cell.ab{{border-style:dashed;border-color:#7a6a3a}}.cell.rek{{box-shadow:0 0 0 2px #3b6fa8 inset}}
.ph{{height:165px;display:grid;place-items:center;text-align:center;color:#d9c48a;background:#25221a;border-radius:4px}}.v{{font-size:11.5px;padding:0 5px;border-radius:4px;background:#2b2e36}}.v.best{{background:#2f5a2f;color:#dff5df}}.v.ok{{color:#a6dca6}}.v.bad{{color:#f0a090}}.v.meh{{color:#e6d08a}}
.pawt{{color:#f0a090;font-size:11.5px}}.okt{{color:#8fd18f;font-size:11.5px}}.rk{{color:#8fb8e8;font-size:11.5px}}small{{color:#9a958a}}</style><main>
<h1>조수가 전투 화면 프리셋을 기획 톤에 맞게 고르나 — 실측 A/B (4단계)</h1>
<p>같은 기획을 단계마다 여러 번 만들게 했다(qa:game gen, gemini-3.8-flash, 새 프로젝트 마법사와 같은 경로). 칸마다 그 판이 실제로 저장한 전투 화면을 출하 런타임으로 찍은 그림이다.
「어울림」은 <b>내가 아니라 별도 에이전트가 블라인드로</b> 매겼다. 조수가 무엇을 골랐는지 모르는 채로 기획서와 12개 프리셋 그림만 보고 고른 답이다.</p>
<div class="kpi">{kpi}</div>
<div class="fixnote">🔧 <b>단계별로 고친 것</b><br>
<b>#1849</b>: 조수에게 프리셋 분위기를 알려 줬다. 이 단계에서 버그 두 개가 숨어 있었다.<br>
<b>#1858</b>: 계획 턴의 「읽기 전용」 말을 실행 턴이 자기 얘기로 읽고 멈추던 것을 고쳤다(머리말과 0편집 재요청). 양피지 선택 글씨와 영화 띠 CSS도 같이 고쳤다.<br>
<b>#1874</b>: #1849 의 분위기 글에 들어 있던 「현대」(얇은 장막 = 현대·SF …) 때문에 판타지 첫 제작 전체가 <b>「현대 맵 → PAW 칩셋만」 게이트</b>에 걸렸다. #1849 와 #1858 단계의 판 대부분에서 마을·성 맵 칠하기가 2~7번씩 거절됐다(빨간 글씨). 분위기 글에서 「현대」를 빼자 거절이 0번이 됐다.<br>
<b>덤</b>: 정면 스킨 위에서 꾸밈을 고르면 측면 스킨으로 같이 바꾼다(자료집과 조수 모두).</div>
<div class="note">⚠ 주의할 점 — ① 판 수가 기획당 1~6판이라 비율은 대략치다. ② 심판도 모델 한 명이다. 사람 눈과 다를 수 있다. ③ 고치기 전 1회차 3판은 저장값만 남았고, 「맵 칠하기 거절」 수는 기록이 없다. ④ SF·코미디·청춘은 #1874 단계에서만 2판씩 돌렸다.</div>
{secs}</main></html>'''
open(OUT, 'w').write(page)
print('ok', OUT)
