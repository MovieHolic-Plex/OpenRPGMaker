# 손 도트 실내 v5 증거 한 장(자체완결 HTML): 조수 시험 → v5 시트·예제 방 → 폐기 목록.
# 사용: python3 scripts/qa/hand-interior-viz.py [출력 경로, 기본 ~/claude-viz/atlas-interior.html]  (저장소 루트에서)
import base64, glob, html, json, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/atlas-interior.html')
TRIALS = 'verify-shots/hand-interior-assistant'
MAPS = 'tiledata/hand-interior/v5-maps'
V5 = 'tiledata/hand-interior/v5'
ORDER = ['bakery', 'inn1f', 'cottage', 'manor1f', 'refuse-tibo']

def uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
def e(s):
    return html.escape(str(s))
def load(p, d=None):
    return json.load(open(p)) if os.path.exists(p) else d

parts = []
def card(title, search, body):
    parts.append(f'<section class=card data-t="{e(search.lower())}"><h3>{e(title)}</h3>{body}</section>')

# ---------------------------------------------------------------- 1) 조수 시험
parts.append('<h2 id=trials>1. 조수 시험 — 새 SQLite 프로젝트, 칩셋은 조수가 고른다</h2>')
rows = []
for label in ORDER:
    s = load(f'{TRIALS}/{label}/summary.json')
    if not s: continue
    maps = s.get('maps', [])
    rows.append(f"<tr><td>{e(label)}</td><td>{e(s['task'])}</td><td>{e(', '.join(s['chosenTilesets']) or '(맵 없음)')}</td><td>{s['toolCalls']}</td><td>{s['failed']}</td>"
                f"<td>{len(s['retiredAttempts'])} / {s['retiredRejections']}</td><td>{len(s['oldToolCalls'])}</td>"
                f"<td>{'; '.join(f'{m['size'][0]}×{m['size'][1]} 도달 {m['reachableFromEntrance']} · 못 닿음 {m['unreachedWalkable']}' for m in maps) or '-'}</td><td>{'같음' if s['reloadEqual'] else '다름'}</td></tr>")
parts.append('<table><tr><th>시험</th><th>요청</th><th>고른 칩셋</th><th>도구 호출</th><th>실패</th><th>폐기 칩셋 시도/거부</th><th>옛 실내 도구</th><th>맵 · 입구 BFS</th><th>저장 후 재로드</th></tr>' + ''.join(rows) + '</table>')
for label in ORDER:
    s = load(f'{TRIALS}/{label}/summary.json')
    if not s: continue
    imgs = ''.join(f'<figure><img src="{uri(p)}" style="max-width:100%"><figcaption>{e(os.path.basename(p))}</figcaption></figure>' for p in sorted(glob.glob(f'{TRIALS}/{label}/map-*.png')))
    by = ', '.join(f'{k}×{v}' for k, v in s['byTool'].items())
    refs = ', '.join(s.get('readReferences', [])[:12])
    body = (f"<p><b>요청</b> {e(s['task'])} · 모델 {e(s['model'])} · {round(s['ms'] / 1000)}초 · 프로젝트 <code>{e(s['projectDir'])}</code> ({e(s['projectId'])})</p>"
            f"<p><b>도구</b> {e(by)}</p><p><b>읽은 참고문서</b> {e(refs or '-')}</p>"
            + (f"<p><b>폐기 칩셋 시도</b> {e(json.dumps(s['retiredAttempts'], ensure_ascii=False))}</p>" if s['retiredAttempts'] else '')
            + f"<div class=pr>{imgs or '<p>(새 맵 없음)</p>'}</div><p class=final><b>조수 마지막 말</b> {e(s['finalText'][:900])}</p>")
    card(f'시험 {label}', f"{label} {s['task']} 시험", body)
vis = load(f'{TRIALS}/bakery/visibility.json')
probe = load(f'{TRIALS}/bakery/retired-probe.json')
if vis:
    card('조수에게 보이는 것 (bakery 시험 시작 시 덤프)', '노출 도구 참고문서 목록 visibility tibo',
         f"<p>노출 도구 {len(vis['exposedTools'])}개 · 전체 카탈로그 {vis['fullCatalogSize']}개 · 옛 실내 도구 노출 <b>{e(vis['oldToolsExposed'] or '없음')}</b> · 카탈로그에 <b>{e(vis['oldToolsInFullCatalog'] or '없음')}</b></p>"
         f"<p>참고문서 목록의 폐기 칩셋 <b>{e(vis['retiredInReferenceList'] or '없음')}</b> · 실내 계열 참고문서 분류 {e(', '.join(vis['interiorLikeReferenceCategories']))}</p>"
         f"<p>공용 장소·오브젝트 {vis['sharedRowsTotal']}행 중 폐기 칩셋 행 <b>{len(vis['sharedRowsWithRetiredTileset'])}</b> · Tibo 언급 행 <b>{len(vis['sharedRowsMentioningTibo'])}</b></p>"
         f"<details><summary>노출 도구 전체</summary><p>{e(', '.join(vis['exposedTools']))}</p></details>")
if probe:
    pr = ''.join(f"<tr><td>{e(p['name'])}</td><td><code>{e(json.dumps(p['args'], ensure_ascii=False)[:110])}</code></td><td>{'통과' if p['ok'] else '거부'}</td><td>{e(p['code'] or '')}</td><td>{e(p['summary'][:160])}</td></tr>" for p in probe['executor'])
    res = ', '.join(f"{k}={'해석됨' if v else '없음'}" for k, v in probe['piResolvesOldTool'].items())
    card('실행기 거부 증거 — 모델이 옛 실내 칩셋에 닿는 같은 호출을 직접 실행', '거부 실행기 probe retired create_map import stamp',
         f"<table><tr><th>도구</th><th>인자</th><th>결과</th><th>코드</th><th>메시지</th></tr>{pr}</table><p>Pi 도구 해석기(이름을 불러도): {e(res)}</p>")

# ---------------------------------------------------------------- 2) v5 시트와 예제 방
parts.append('<h2 id=sheet>2. 손 도트 실내 v5 칩셋과 예제 26맵</h2>')
sheet = load('src/assets/atlasBiomeInteriorSheet.json')
card('시트 atlas_biome_interior (48칸 폭)', '시트 sheet chipset 칩셋',
     f"<p>{sheet['count']}칸 · 가로 {sheet['tilesPerRow']}칸. 바닥·벽면은 표면마다 짜임 주기로 접었다(기둥·지지목·줄눈이 원본 자리).</p><img src='{uri('public/assets/atlas-interior/interior-chipset.png')}' style='width:{sheet['tilesPerRow'] * 32}px'>")
check = load(f'{MAPS}/check.json'); check = check if isinstance(check, list) else check['maps']
examples = load(f'{MAPS}/maps.json')
names = {p['key']: examples['maps'][p['id']]['name'] for p in examples['plans']}
ids = {p['key']: p['id'] for p in examples['plans']}
for c in check:
    k = c['map']; orig = f'{V5}/v5_{k}.png'
    body = (f"<p>{c['size'][0]}×{c['size'][1]} · 구조 차 {c['structDiffPx']} · 12프레임 픽셀 차 {c['pixelDiffAllFrames']} · 통행 격자 불일치 {c['walkMismatch']} · 입구 도달 {c['reachable']}칸 · 닿지 못한 바닥 {len(c['unreached'])} · 접지 않은 원본과 같은 화소 {round(c['sameAsUnfoldedOriginal'] * 100)}%</p>"
            f"<div class=pr><figure><img src='{uri(orig)}' style='width:{c['size'][0] * 32}px'><figcaption>원본 v5 그림</figcaption></figure>"
            f"<figure><img src='{uri(f'{MAPS}/render/{k}.png')}' style='width:{c['size'][0] * 32}px'><figcaption>칩셋 칸으로 다시 쌓은 맵 {e(ids[k])}</figcaption></figure></div>")
    card(f'{names[k]} · {ids[k]}', f'{names[k]} {k} {ids[k]} 예제', body)
shots = sorted(glob.glob('verify-shots/hand-interior/0[3-8]-*.png'))
card('편집기 화면 (이벤트 레이어 — 편집기는 늘 한 층을 흐리게 그린다)', '편집기 editor 화면',
     '<div class=pr>' + ''.join(f"<figure><img src='{uri(p)}' style='width:560px'><figcaption>{e(os.path.basename(p))}</figcaption></figure>" for p in shots) + '</div>'
     + f"<figure><img src='{uri('verify-shots/hand-interior/01-brush-autotiles.png')}'><figcaption>실제 마우스 붓: 천장 2종·깔개 2종·선로 — mask 불일치 0</figcaption></figure>")

# ---------------------------------------------------------------- 3) 폐기 목록
parts.append('<h2 id=discard>3. 폐기 목록</h2>')
card('폐기한 것', '폐기 discard retired tibo easyrpg lpc abi',
     '<ul>'
     '<li>실내 칩셋 <code>easyrpg_chipset_interior</code> · <code>tibo_interior_expanded</code> · <code>opengameart_lpc_wooden_furniture</code>(32·16): 조수의 참고문서·공용 장소/오브젝트·킷 목록에서 숨김, create_map·import_region_reference·stamp_object·참고문서 읽기는 <code>retired-interior-tileset</code> 으로 거부. 번들 정의·옛 맵 자체는 지우지 않았다(옛 프로젝트 호환).</li>'
     '<li>공용 장소 중 실내 태그(공간형태:건물 내부)인데 v5 칩셋이 아닌 것: 숨김 + 가져오기 거부.</li>'
     '<li>옛 도구(방 세션·place_concept·get_concept_facility·furnish_interior_space 등): deprecated — 노출·Pi 해석 제외, 실행 호환만.</li>'
     '<li>옛 atlas_biome_interior 정의(오전: Tibo 번호 0~2159 + 배·던전)와 이식 실내 140맵(abi-*)·그 참고문서·스크립트: 삭제. 옛 저장본은 정의를 통째로 교체하고 그 칩셋 맵은 그대로 둔 채 경고.</li>'
     '<li>배·던전 블록 → <code>atlas_biome_dungeon</code>(1140칸, 30열)으로 분리(감독자 결정).</li>'
     '<li>조수 문장: 편집기 프롬프트·의도 노트·능력 색인·계획·장르 프리셋의 실내 경로를 build_hand_interior_room 으로. 개념 꾸러미·방 문법 절은 싣지 않는다.</li>'
     '</ul>')

HEAD = '''<!doctype html><meta charset=utf-8><title>손 도트 실내 v5 — 조수는 이 실내 칩만</title>
<style>body{font:14px/1.5 system-ui,sans-serif;background:#1d1b19;color:#eee;margin:0}main{padding:0 24px 40px}img{image-rendering:pixelated;display:block}
.card{background:#2a2724;border-radius:8px;padding:10px 14px;margin:12px 0}.card h3{margin:2px 0 6px}.pr{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0}figcaption{color:#bbb;font-size:12px}table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #555;padding:4px 8px;vertical-align:top;font-size:13px}
code{color:#f0c674}.final{color:#cfc}#finder{position:sticky;top:0;z-index:9;background:#1b1d22;border-bottom:1px solid #444;padding:8px 24px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#finder input{flex:0 0 320px;padding:6px 8px;background:#111;color:#eee;border:1px solid #555;border-radius:6px;font-size:14px}#toc a{font-size:12px;color:#ccd;background:#2a2d34;padding:2px 6px;border-radius:4px;text-decoration:none;margin:2px}</style>
<div id=finder><input id=q placeholder="찾기: 빵집, bakery, 여관, 거부, 폐기, 시험…"><span id=cnt style="color:#aaa;font-size:13px"></span><div id=toc style="display:flex;flex-wrap:wrap;max-height:84px;overflow:auto;flex:1"></div></div>
<main><h1>손 도트 실내 v5 — 조수는 이 실내 칩만 깐다</h1>
<p>보고 판단할 것: ① 시험 네 번이 모두 atlas_biome_interior 를 골랐고 폐기 칩셋 시도가 0인지, 거부 시험·실행기 표에서 옛 칩셋이 막히는지 ② 조수가 지은 방이 벽·천장·동선이 맞는지(입구 BFS·못 닿은 칸) ③ 예제 26맵이 원본 v5 그림과 같은지(가구·기둥 자리).</p>'''
TAIL = '''</main><script>
const cards=[...document.querySelectorAll('.card')],toc=document.getElementById('toc'),q=document.getElementById('q'),cnt=document.getElementById('cnt');
cards.forEach((c,i)=>{c.id='c'+i;const a=document.createElement('a');a.href='#c'+i;a.textContent=c.querySelector('h3').textContent.slice(0,24);a.dataset.t=c.dataset.t+' '+a.textContent.toLowerCase();toc.appendChild(a)});
const f=()=>{const v=q.value.trim().toLowerCase();let n=0;cards.forEach(c=>{const ok=!v||(c.dataset.t+' '+c.querySelector('h3').textContent.toLowerCase()).includes(v);c.style.display=ok?'':'none';if(ok)n++});
[...toc.children].forEach(a=>a.style.display=(!v||a.dataset.t.includes(v))?'':'none');cnt.textContent=v?`${n}개`:`카드 ${cards.length}개`};q.addEventListener('input',f);f();
</script>'''
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(HEAD + '\n'.join(parts) + TAIL)
print(OUT, os.path.getsize(OUT))
