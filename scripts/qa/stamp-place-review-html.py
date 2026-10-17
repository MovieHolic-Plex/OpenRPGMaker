#!/usr/bin/env python3
"""바로 깔기 적대적 리뷰 결과 → 자체완결 HTML(~/claude-viz).
python3 scripts/qa/stamp-place-review-html.py <base결과폴더> <후결과폴더> <출력.html> [UI_BEFORE_DIR UI_AFTER_DIR]"""
import base64, collections, html, io, json, os, sys
from PIL import Image
sys.argv, args = sys.argv[:1], sys.argv[1:]
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("rep", os.path.join(os.path.dirname(__file__), "stamp-place-corpus-report.py"))
rep = importlib.util.module_from_spec(spec); spec.loader.exec_module(rep)

BASE, AFTER, OUT = args[0], args[1], args[2]
UIB, UIA = (args[3], args[4]) if len(args) >= 5 else (None, None)
CORPUS = json.load(open("scripts/qa/stamp-place-corpus.json"))
TEXT = {c["id"]: c["text"] for c in CORPUS}
CAT = {c["id"]: c["cat"] for c in CORPUS}
THEME_LABEL = {"beodeul": "버들항", "jp": "일본 주택가(길 선택)", "interior": "손 도트 실내", "sky": "천공섬", "jpyard": "일본 주택가(마당 선택)", "monster": "몬스터 키트", "farm": "초원 마을"}
CORE = ["beodeul", "jp", "interior", "sky"]
EXTRA = ["jpyard", "monster", "farm"]

def load(path):
    d = json.load(open(path + "/results.json"))
    return {(r["theme"], r["id"]): r for r in d["results"]}
B, A = load(BASE), load(AFTER)

STYLE = {
  "그림 맞음": ("#1f7a3d", "그림"), "거절 올바름": ("#1f7a3d", "올바른 거절"),
  "정직한 거절(그림 없음+대안)": ("#2563b8", "그림 없음 거절"), "정직한 거절(자리 없음)": ("#0e8a9a", "자리 없음"),
  "엉뚱한 물건": ("#c0392b", "엉뚱한 물건"), "이벤트만(그림 없음)": ("#c0392b", "이벤트만"), "없는 물건에 뭔가 깔림": ("#c0392b", "없는데 깔림"),
  "도구 실패(사유 표시)": ("#b9770e", "실패(사유 표시)"), "아무것도 안 함": ("#b9770e", "무반응"),
  "모호한 말: 변화 있음": ("#6b7280", "모호:변화"), "모호한 말: 변화 없음": ("#6b7280", "모호:없음"), "거절(사유 불명)": ("#b9770e", "거절(사유불명)"),
}
def cell(r):
    if r is None: return "-"
    cat, lie = rep.categorize(r)
    color, label = STYLE.get(cat, ("#555", cat))
    mark = ' <b style="color:#fff;background:#7b0d0d;padding:0 3px">거짓줄</b>' if lie else ""
    return f'<span class="chip" style="background:{color}" title="{html.escape(" / ".join(r["lines"])[:400])}">{label}</span>{mark}'

def tally(R):
    c = collections.Counter(); lies = 0
    for r in R:
        cat, lie = rep.categorize(r); c[cat] += 1; lies += lie
    return c, lies
def rows_for(M, themes): return [r for (t, i), r in M.items() if t in themes]
cb, lb = tally(rows_for(B, CORE)); ca, la = tally(rows_for(A, CORE)); ce, le = tally(rows_for(A, EXTRA))
N = len(rows_for(B, CORE))

def pct(n, d): return f"{100*n/d:.1f}%"
cats = ["그림 맞음", "엉뚱한 물건", "이벤트만(그림 없음)", "없는 물건에 뭔가 깔림", "정직한 거절(그림 없음+대안)", "정직한 거절(자리 없음)", "거절 올바름", "도구 실패(사유 표시)", "아무것도 안 함", "모호한 말: 변화 있음", "모호한 말: 변화 없음"]
def summary_rows():
    out = []
    for k in cats:
        out.append(f"<tr><td>{k}</td><td>{cb[k]}</td><td>{pct(cb[k],N)}</td><td>{ca[k]}</td><td>{pct(ca[k],N)}</td><td>{ce[k]}</td></tr>")
    out.append(f'<tr class="lie"><td>결과 줄 거짓(「깔았다」인데 보이는 것 없음)</td><td>{lb}</td><td>{pct(lb,N)}</td><td>{la}</td><td>{pct(la,N)}</td><td>{le}</td></tr>')
    return "\n".join(out)

def b64(path, w=None):
    im = Image.open(path).convert("RGB")
    if w and im.width > w: im = im.resize((w, int(im.height * w / im.width)), Image.NEAREST)
    buf = io.BytesIO(); im.quantize(colors=96, method=Image.MEDIANCUT, dither=Image.NONE).save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

GALLERY = [("beodeul", "pot"), ("interior", "pot"), ("interior", "chair"), ("jp", "table"), ("sky", "bench"), ("beodeul", "lamp"),
           ("beodeul", "well"), ("interior", "vending"), ("sky", "pond"), ("jp", "bench"), ("sky", "tree"), ("interior", "bed")]
def crop_of(folder, theme, cid):
    p = f"{folder}/crops/{theme}-{cid}.png"
    return p if os.path.exists(p) else None
def gallery():
    out = []
    for theme, cid in GALLERY:
        b, a = B.get((theme, cid)), A.get((theme, cid))
        if not b or not a: continue
        cb_, ca_ = crop_of(BASE, theme, cid), crop_of(AFTER, theme, cid)
        def block(title, r, crop):
            img = f'<img src="{b64(crop, 1000)}" alt="">' if crop else '<div class="noimg">캡처 없음</div>'
            cat, lie = rep.categorize(r)
            lines = "".join(f"<li>{html.escape(l)[:260]}</li>" for l in r["lines"][:5])
            return f'<div class="half"><h4>{title} {cell(r)}</h4>{img}<ul>{lines}</ul></div>'
        out.append(f'<section class="case"><h3>{THEME_LABEL[theme]} · 「{html.escape(TEXT[cid])}」</h3><div class="pair">{block("수정 전(origin/main)", b, cb_)}{block("수정 후", a, ca_)}</div></section>')
    return "\n".join(out)

def corpus_table():
    head = "".join(f"<th>{THEME_LABEL[t]}</th>" for t in CORE + EXTRA)
    rows = []
    for c in CORPUS:
        tds = []
        for t in CORE + EXTRA:
            b, a = B.get((t, c["id"])), A.get((t, c["id"]))
            tds.append(f"<td>{cell(b) + ' → ' if b else ''}{cell(a)}</td>")
        rows.append(f'<tr><td class="s">{html.escape(c["text"])}<br><small>{c["cat"]}</small></td>{"".join(tds)}</tr>')
    return f"<table class='corp'><tr><th>문장</th>{head}</tr>{''.join(rows)}</table>"

def ui_block():
    if not (UIB and UIA): return ""
    items = []
    for name, title in [("jp-01", "일본 주택가 「화분 깔아 줘」"), ("jp-02", "일본 주택가 「자판기 놓아 줘」"), ("beodeul-01", "버들항 「화분 깔아 줘」")]:
        pb, pa = f"{UIB}/{name}-full.png", f"{UIA}/{name}-full.png"
        if os.path.exists(pb) and os.path.exists(pa):
            items.append(f'<section class="case"><h3>{title} — 실제 에디터 화면(원본 캡처)</h3><div class="pair"><div class="half"><h4>수정 전</h4><img src="{b64(pb)}"></div><div class="half"><h4>수정 후</h4><img src="{b64(pa)}"></div></div></section>')
    return "<h2>실제 에디터(바로 깔기 켜고 영역 드래그 → 문장 Enter) 전/후</h2>" + "".join(items) if items else ""

A_JPYARD_ART = sum(1 for (t, i), r in A.items() if t == "jpyard" and rep.categorize(r)[0] == "그림 맞음")
doc = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>바로 깔기 적대적 리뷰 1</title>
<style>
body{{font:14px/1.5 system-ui,'Noto Sans KR',sans-serif;margin:24px;color:#1b1f24;background:#fafafa;max-width:1700px}}
h1{{font-size:22px}}h2{{margin-top:34px;border-bottom:2px solid #ddd;padding-bottom:4px}}h3{{margin:18px 0 6px}}h4{{margin:4px 0}}
table{{border-collapse:collapse;background:#fff}}td,th{{border:1px solid #ddd;padding:4px 8px;text-align:left;vertical-align:top}}th{{background:#f0f2f5}}
.lie td{{background:#fdecec;font-weight:600}}.chip{{color:#fff;padding:1px 6px;border-radius:3px;font-size:12px;white-space:nowrap}}
.corp td{{font-size:12px}}.corp td.s{{min-width:150px;font-size:13px}}small{{color:#777}}
.pair{{display:flex;gap:14px;align-items:flex-start}}.half{{flex:1;min-width:0}}.half img{{max-width:100%;image-rendering:pixelated;border:1px solid #ccc}}
.half ul{{margin:4px 0;padding-left:18px;font-size:12px;color:#444}}.case{{background:#fff;border:1px solid #e1e1e1;padding:8px 12px;margin:12px 0}}
.noimg{{background:#eee;color:#888;padding:40px;text-align:center}}.note{{background:#fff8e1;border:1px solid #f0d98c;padding:8px 12px}}
code{{background:#eef;padding:0 3px}}
</style>
<h1>바로 깔기 적대적 리뷰 1 — 「화분 깔아 줘」가 이벤트만 만들던 문제</h1>
<p class="note"><b>모델 표기:</b> 편집기 기본 조수 모델(Google gemini-4-argon medium)의 8318 프록시 키(<code>OPRN_LIVE_KEY</code>)가 이 환경에 없어,
같은 모델을 <code>agy -p --model gemini-4-argon-medium</code> 으로 대신 불러 응답을 캐시했다(키 파일·값은 열지 않음). 계획기·검증기·러너·도구는 실제 코드를 그대로 돈다.
수정 후 숫자는 기록된 대본 재생(모델 호출 없음, 재현 가능). vitest/gates 는 규칙대로 <b>미실행</b>(tsc 만).</p>

<h2>한눈에: 같은 200회 코퍼스(50문장 × 4칩셋) 전/후</h2>
<table><tr><th>분류</th><th>전 건수</th><th>전 %</th><th>후 건수</th><th>후 %</th><th>추가 3칩셋(후, 150회)</th></tr>
{summary_rows()}</table>
<p><small>분류는 같은 채점 코드(<code>scripts/qa/stamp-place-corpus-report.py</code>)로 전·후 동일하게 매긴다. 「정직한 거절」 = 깔지 않고 이유·가까운 이름을 말함. 추가 3칩셋 = 일본 주택가(마당 선택)·몬스터 키트(빈 땅 맵)·초원 마을.</small></p>

<h2>남은 약점·한계 (정직하게)</h2>
<ul>
<li><b>일본 주택가(길 선택)</b>의 「자리 없음」은 코퍼스가 맵 한가운데 8×6 을 골랐는데 그곳이 도로라서다 — 도로 위에 화분을 놓지 않는 것은 맞는 거절이지만 시험 설계가 나빴다. 같은 맵의 <b>마당 선택(jpyard)</b>은 50문장 중 {A_JPYARD_ART}개가 그림으로 깔렸다.</li>
<li><b>몬스터 키트</b>는 빈 땅(바닥 타일 없음)의 맵이라 놓을 칸이 0 — 「자리 없음」이 정답이고, 그림이 아예 없는 물건(화분·우물·자판기…)은 「그림 없음」으로 거절한다. 그림을 새로 만들지 않았다.</li>
<li>남은 「엉뚱한 물건」 판정 2~3건: 일본 주택가 「울타리 둘러 줘」(울타리 그림은 맞지만 <b>도로 위에 얹혀 통행을 막음</b> — 재료 라벨 선택 문제, 이번에 못 고침), 초원 마을 「덤불 깔아 줘」(캡처 확인: 진짜 덤불 그림 48칸이 깔림 — 채점 키워드가 못 읽어 엉뚱으로 셈, 오분류).</li>
<li>채점은 키워드·도구 결과·타일 변화 기반 휴리스틱이다 — 「그림 맞음」은 눈으로 본 합격이 아니다. 아래 캡처 12건은 직접 열어 확인한 것만 골랐고, 전체 350장은 <code>output/stamp-corpus/final2/crops</code>.</li>
<li>모델이 같다(Argon medium 대용)고 해도 응답은 확률적이다. 수정 후 숫자는 같은 응답을 재생한 값이며, 재생이 아닌 새 응답에서는 ±몇 % 흔들린다(이번 작업 중 after2/after3/final 이 각각 실제 호출이었고 그림 맞음 53.5%/54%/54% 로 일관).</li>
<li>vitest 로 돌린 검증은 없다(규칙). <code>test/stampPlaceRunner.test.ts</code> 수정과 <code>test/stampObjects.test.ts</code> 신규는 <b>미실행</b>.</li>
</ul>

<h2>원인 순위 (실측)</h2>
<ol>
<li><b>계획기에 물건을 이름으로 찾아 찍는 도구가 없었다</b> — 모델이 <code>place_props</code> 라벨을 짐작하거나 조사 지점·NPC 로 흉내. 엉뚱한 물건 39%의 대부분.</li>
<li><b>그림 없는 이벤트가 들어갔다</b> — 조사 지점은 「빈 바닥 위 투명」, NPC 는 사람 그림(자판기 관리인). 이벤트만 12.5%.</li>
<li><b>비수목 <code>place_props</code> 에 density 를 보내 첫 호출이 항상 실패</b> → 수리 호출이 엉뚱한 대체(자갈·풀 얼룩)를 냈다.</li>
<li><b>결과 줄이 도구 요약만 이어 붙였다</b> — 보이는 변화가 없어도 「완료」(거짓 줄 18%).</li>
<li><b>수리 성공이 첫 시도 실패를 지웠다</b> — 헤드라인이 「완료」, 없는 물건도 「실패」로만 표시.</li>
</ol>
<p>수정 원칙: <b>그림 없으면 이벤트도 지형도 안 깐다. 가까운 실제 이름을 보여 주고 거절. 조용한 대체·거짓 성공 금지. 결과 줄은 실제 바뀐 타일 수·이벤트 수·그림 유무.</b></p>

{ui_block()}

<h2>전/후 캡처 (코퍼스 한 판, 선택 영역 8×6 + 여백, 칸 단위 확대, 좌=깔기 전 · 우=깔기 후)</h2>
{gallery()}

<h2>코퍼스 전체 표 (문장 × 칩셋, 전 → 후; 칩을 올리면 결과 줄)</h2>
{corpus_table()}
</html>"""
open(OUT, "w", encoding="utf-8").write(doc)
print(OUT, len(doc) // 1024, "KB")
