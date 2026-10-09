# One self-contained evidence page (images as data URIs) for the 버들항 save + assistant proof:
#   original vs reloaded-from-store render, the assistant's two results, the tool-call trace summary, the verdict.
#   python3 scripts/qa/beodeul-assistant-page.py   → ~/claude-viz/beodeul-assistant-proof.html
import base64, html, io, json, os, pathlib, collections
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
V = ROOT / "verify-shots/beodeul-assistant"
OUT = pathlib.Path(os.path.expanduser("~/claude-viz/beodeul-assistant-proof.html"))
def uri(path, side=800, crop=None, q=None):
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    s = min(1.0, side / max(im.size))
    if s < 1: im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=q or 86); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
def fig(src, cap, w=None):
    return f'<figure><img src="{src}" alt="{html.escape(cap)}"{f" style=\"width:{w}px\"" if w else ""}><figcaption>{html.escape(cap)}</figcaption></figure>'
proof = json.loads((ROOT / "tiledata/beodeul-city/storage-proof.json").read_text())
diff = json.loads((V / "pixel-diff.json").read_text())
judge = json.loads((V / "judge.json").read_text())
runs = {l: json.loads((V / l / "summary.json").read_text()) for l in ("fresh", "existing")}
traces = {l: json.loads((V / l / "trace.json").read_text()) for l in ("fresh", "existing")}
tamper = json.loads((ROOT / "tiledata/beodeul-city/qa-tamper-checks.json").read_text())
orig = ROOT / "tiledata/beodeul-city/render-full/city6.png"
rel = V / "reloaded-render.png"

def phases(t):
    # compress the trace into phases of consecutive same-tool calls
    out = []
    for s in t:
        if out and out[-1][0] == s["name"]: out[-1][1] += 1; out[-1][2] += (0 if s["ok"] else 1)
        else: out.append([s["name"], 1, 0 if s["ok"] else 1, s["summary"][:110]])
    return out
def run_section(l):
    r, j, t = runs[l], judge[l], traces[l]
    reads = [s for s in t if s["name"] == "read_tileset_reference"]
    docs = sorted({json.loads(s["args"]).get("documentId") or json.loads(s["args"]).get("imageId") for s in reads})
    kits = collections.Counter(k.split("/")[-1] for k in r["kitsStamped"])
    dist = [k for k in kits if k in ("bd-castle", "bd-estate", "bd-forum", "bd-cathedral", "bd-windmill", "bd-river-bridge", "bd-harbour", "bd-harbour-west")]
    rows = "".join(f"<tr><td>{i + 1}</td><td><code>{html.escape(n)}</code></td><td>{c}</td><td>{e or ''}</td><td>{html.escape(s)}</td></tr>" for i, (n, c, e, s) in enumerate(phases(t)))
    fails = "".join(f"<li><code>{html.escape(s['name'])}</code> — {html.escape(s['summary'][:200])}</li>" for s in t if not s["ok"]) or "<li>없음</li>"
    up = r.get("loadUpgrade") or {}
    return f"""
<h2>조수 결과 — {'새 프로젝트' if l == 'fresh' else '기존 프로젝트(소금 평원 필드 사본)'}</h2>
<p class=meta>project id <code>{r['projectId']}</code> · 저장소 <code>{r['projectDir']}</code> · 맵 <code>{r['mapId']}</code> {r['size'][0]}×{r['size'][1]} (<code>{r['tilesetId']}</code>) ·
모델 <b>{r['model']}</b> (생각 high) · {r['ms'] / 60000:.1f}분 · 모델 턴 {r['stats']['turns']} · 도구 호출 {r['toolCalls']}(실패 {r['failed']}) · 노출 도구 {r['exposedTools']} ·
저장 후 재로드 동일 {r['reloadEqual']}{f" · 로드 시 beodeul_city 없음→생김 {up.get('hadBeodeulBefore') is False and up.get('hasAfter')}, 기존 맵 {up.get('existingMaps')}장 유지" if up else ''}</p>
<div class=row>{fig(uri(V / l / 'render.png'), f'조수 결과 {l} — 저장소에서 다시 읽은 맵을 저장소 렌더러로 그림')}{fig(uri(orig), '버들항 v6 원본')}</div>
<div class=row>{fig(uri(V / l / 'render.png', 900, (0, 500, 900, 1000)), '조수가 새로 지은 가운데 마을(0~56열 × 31~62행)')}{fig(uri(orig, 900, (0, 500, 900, 1000)), '원본 같은 구역')}</div>
<h3>참고문서를 읽었나</h3>
<p><code>list_tileset_references</code> {r['readReferences']['list']}회, <code>read_tileset_reference</code> {r['readReferences']['read']}회 — 버들항 문서·그림 {len(docs)}종을 읽었다:
<br><small>{', '.join(html.escape(str(d)) for d in docs)}</small></p>
<h3>무엇을 찍었나</h3>
<p>구역 키트 {len(dist)}/8 (모두 원본 원점: {j['allAtOriginal']}) · 건물 조각 {j['housePiecesStamped']} · 소품 {sum(v for k, v in kits.items() if k.startswith('bd-prop-'))} · 나무 {sum(v for k, v in kits.items() if k.startswith('bd-tree-'))} ·
<code>paint_tiles</code> {r['byTool'].get('paint_tiles', 0)}회(대표 칸 {', '.join(f'{k}×{v}' for k, v in j['paintTiles'].items())})</p>
<h3>구조 검사 (scripts/qa/beodeul-assistant-judge.py)</h3>
<ul><li>원본과 같은 칸 {j['cellsSameAsOriginal']}/10000 ({j['ratioSame'] * 100:.1f}%) — 나머지는 조수가 새로 지은 가운데 마을·빈 풀밭</li>
<li>걸을 수 있는 칸 {j['walkable']}, 큰길(62,33)에서 닿는 칸 {j['reachFromMain']}</li>
<li>조수가 찍은 건물 문 앞 {j['pieceDoors']}곳 중 닿지 않는 곳 {j['pieceDoorsUnreached']}</li>
<li>건물 발자국 겹침 {j['houseFootprintOverlaps']}</li></ul>
<h3>실패한 호출</h3><ul>{fails}</ul>
<details><summary>도구 호출 흐름 ({len(phases(t))}구간 · 같은 도구 연속 호출은 한 줄)</summary>
<table><tr><th>#</th><th>도구</th><th>횟수</th><th>실패</th><th>첫 결과</th></tr>{rows}</table></details>
<p class=meta>조수 마지막 보고: {html.escape(r['finalText'][:900])}</p>
"""
tam = "".join(f"<tr><td><code>{html.escape(x['tamper'])}</code></td><td>{x['code']}</td><td>{len(x['detected'])}</td></tr>" for x in tamper)
qa_imgs = "".join(fig(uri(ROOT / f"public/assets/beodeul-city/references/{n}.png", 520), c, 520) for n, c in (
    ("err-door-blocked", "오류 그림 1 · 문 앞 막힘"), ("err-drawbridge-missing", "오류 그림 2 · 도개교 없음"), ("err-stair-missing", "오류 그림 3 · 궁전 계단 없음"),
    ("err-pier-gap", "오류 그림 4 · 잔교 끊김"), ("err-tree-row", "오류 그림 5 · 같은 나무 일렬(눈 검사)")))
ts = proof["tileset"]
page = f"""<!doctype html><html lang=ko><meta charset=utf-8><title>버들항 v6 — 정본 저장 · 공용 타일셋 · 조수 시험 증거</title>
<style>body{{font:14px/1.55 system-ui,sans-serif;background:#16181c;color:#e6e6e6;margin:24px auto;max-width:1680px;padding:0 16px}}h1{{font-size:22px}}h2{{margin-top:36px;border-top:1px solid #333;padding-top:18px}}
.row{{display:flex;gap:14px;flex-wrap:wrap}}figure{{margin:0}}img{{image-rendering:pixelated;max-width:820px;border:1px solid #333}}figcaption{{color:#aaa;font-size:12px;max-width:820px}}
code{{background:#262a31;padding:1px 4px;border-radius:3px}}table{{border-collapse:collapse;font-size:12px}}td,th{{border:1px solid #333;padding:3px 6px;vertical-align:top}}.meta{{color:#bbb}}
.verdict{{background:#1f2a1f;border:1px solid #3c6;padding:12px 16px;border-radius:6px}}.warn{{background:#2a241a;border:1px solid #c93;padding:12px 16px;border-radius:6px}}</style>
<h1>버들항 v6 — 그대로 저장 · 공용 타일셋 · 조수가 「비슷한 도시」를 깔 수 있나</h1>
<div class=verdict><b>판정.</b> 조수(klb/claude-opus-5.5)는 새 프로젝트와 기존 프로젝트 모두에서 도구로만 참고문서를 읽고(용도 4개의 문서·그림 22·20종),
구역 키트 8개를 원본 좌표에 모두 찍고, 비어 있는 가운데 마을에 길을 깔고 건물 {judge['fresh']['housePiecesStamped']}·{judge['existing']['housePiecesStamped']}채와 소품·나무를 놓아 100×100 도시를 채웠다.
문 앞은 모두 큰길에 닿고 건물 발자국 겹침은 0이다. <b>다만 결과의 65%는 원본 구역을 통째로 찍은 것이다.</b> 조수가 스스로 설계한 부분은 가운데 마을(성·저택·포룸·항구 사이 띠)뿐이고,
그 부분은 연석 없는 평평한 포석 띠와 원본보다 성긴 집 배치라 원본만큼 촘촘하지 않다. 「버들항과 비슷한 도시를 깐다」는 되지만, 「버들항 조각으로 다른 배치의 새 도시를 짓는다」는 아직 약하다(아래 결함).</div>

<h2>1 · 원본 대 저장소에서 다시 읽은 맵</h2>
<p class=meta>project id <code>{proof['projectId']}</code> · <code>{proof['projectDir']}</code> · revision {proof['revision']} · 재로드 deepEqual(프로젝트·맵·타일셋) {proof['deepEqual']} ·
통행 대조 {proof['walkability']['cells']}칸 중 불일치 {proof['walkability']['mismatch']}(걸음 {proof['walkability']['walkable']}) · 주민 이벤트 {proof['map']['npcs']}</p>
<div class=row>{fig(uri(orig), '버들항 v6 원본 city6.png (Python 합성, 주민 포함)')}{fig(uri(rel), '정본 저장소에서 다시 읽은 맵을 저장소 렌더러(editor/mapTileDraw)로 그림 — 주민은 NPC 이벤트')}</div>
<p>화소 비교: 주민 없는 원본 렌더와 <b>{diff['vsNoTownsfolk']['differing']}화소</b> 차이. 주민 포함 city6.png 와는 {diff['vsCity6']['differing']}화소({diff['vsCity6']['ratio'] * 100:.2f}%) 차이이고,
전부 주민 122명 그림 상자 안이다(상자 밖 0) — 주민을 타일이 아닌 이벤트로 옮겼기 때문이다.</p>
<div class=row>{fig(uri(V / 'diff-vs-city6.png', 600), '차이 지도(빨강 = 다른 화소) — 주민 자리만', 600)}</div>

<h2>2 · 공용 번들에 들어간 것</h2>
<ul><li>시트 <code>public/assets/beodeul-city/beodeul-city-chipset.png</code> {ts['count']}칸(128열) · 텍스처 <code>{ts['image']['id']}</code> · <code>src/assets/bundled.ts</code> → <code>ensureBundledTilesets</code>(새·기존 프로젝트)</li>
<li>animationStrips {ts['animationStrips']} · 키트 {ts['structureKits']}(구역 8·건물 70·소품 34·나무 8) · 땅 재료 {ts['tileGroups']}</li>
<li>참고문서 {len(ts['referenceDocuments'])}용도: {', '.join(f"{d['id']}(MD {d['docs']}·그림 {d['images']})" for d in ts['referenceDocuments'])} — 그림은 정적 경로, JSON 에 바이트 없음</li></ul>
<h3>16구역 QA 교훈 → 오류 그림 (실제 변조 · 자동 검출)</h3>
<table><tr><th>변조</th><th>검출 코드</th><th>검출 수</th></tr>{tam}</table>
<div class=row>{qa_imgs}</div>
{run_section('fresh')}
{run_section('existing')}
<h2>결함 (눈으로 본 것, 두 결과 공통)</h2>
<div class=warn><ul>
<li><b>복사 비중이 크다.</b> 성·저택·포룸·성당·풍차·강/다리·항구 둘을 원본 원점에 그대로 찍었다(원본과 같은 칸 65%). 문서가 「원본 좌표 = 정답」이라고 가르쳤기 때문이다 — 새 배치 능력의 증거로는 약하다.</li>
<li><b>새 가운데 마을의 길이 평평하다.</b> 이 시트에는 오토타일이 없어 <code>paint_tiles</code> 로 포석 대표 칸 2989 를 사각형으로 칠했다 — 원본의 연석·이음새가 없고 풀과 칼로 자른 듯 만난다.</li>
<li><b>원본보다 성기다.</b> 구역 상자 밖 3,484칸에서 물체(윗층) 칸이 원본 1,855 / 조수 새 프로젝트 1,069 · 기존 프로젝트 1,232. 원본 가운데 마을은 집이 벽을 맞대고 줄지어 서는데, 조수는 집 사이를 띄우고 나무 무리로 채웠다. 층층 지형(1단/0단 사이 옹벽)은 구역 키트 안에만 있고 새로 짓지 못했다.</li>
<li><b>강이 끊겼다.</b> 원본 강은 북쪽 성벽 아래(33~36열, 0~23행)에서 내려와 폭포(33,27)로 떨어진다. 그 윗줄기는 어느 구역 키트에도 들어 있지 않아 두 결과 모두 물 74칸이 비고 폭포가 풀밭에서 시작한다.
기존 프로젝트 결과는 가운데 운하(47~50열, 44~61행) 72칸도 포석·집으로 덮었다 — 강이 폭포 아래에서 항구까지 이어지지 않는다(원본 물 1,415칸 → 새 1,341 · 기존 1,225).</li>
<li><b>구역 키트 이음새.</b> 키트 상자 경계와 조수가 칠한 풀·포석이 만나는 곳에 원본 연석이 끊긴 줄이 보인다.</li>
<li><b>실패 호출 2회는 조수 탓이 아니었다.</b> 편집기 <code>fill_region</code> 이 성공 결과를 만들다 <code>layer is not defined</code>(없는 변수)로 죽는 기존 버그였다 — 두 시험 모두 첫 풀밭 채우기에서 맞았다(맵 변경은 버려짐). 이번에 고쳤다(<code>layer: requestedLayer</code>). 조수는 <code>tile_query</code> 로 칸 번호를 찾아 <code>paint_tiles</code> 로 우회했다.</li>
</ul></div>
<p class=meta>재현: <code>python3 scripts/content/build-beodeul-city.py</code> → <code>python3 scripts/content/prepare-beodeul-city-references.py</code> → <code>node scripts/content/save-beodeul-city.mjs</code> → <code>bun scripts/content/render-beodeul-city.mts</code> →
<code>bun scripts/qa/beodeul-assistant-run.mts --project … --label fresh --new 100x100</code> → <code>python3 scripts/qa/beodeul-assistant-judge.py</code> → <code>python3 scripts/qa/beodeul-assistant-page.py</code>. 설명: <code>openwiki/beodeul-city.md</code></p>
</html>"""
OUT.write_text(page)
print(OUT, len(page) // 1024, "KB")
