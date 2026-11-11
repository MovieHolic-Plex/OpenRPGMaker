"""PR 하나의 은행 전/후 쪽: 대조 표(바뀐 칸) · 바뀐 판 · 목적 탐침 맵별 줄 · 맵 짝.
usage: prPage.py <ab 결과 폴더(specBank.mts ab --out 의 폴더 — a/ b/ diff.json)> <out.html> <제목> <판:맵,판:맵…> [메모 파일]"""
import base64, glob, html, json, os, re, sys

res, out, title, pairs = sys.argv[1:5]
note = open(sys.argv[5]).read() if len(sys.argv) > 5 else ''
E = html.escape
sh = lambda v: '-' if v is None else (f'{v[0]}/{v[1]}' if isinstance(v, list) else str(v))
A = {json.load(open(f))['id']: json.load(open(f)) for f in sorted(glob.glob(os.path.join(res, 'a', '*', 'metrics.json')))}
B = {json.load(open(f))['id']: json.load(open(f)) for f in sorted(glob.glob(os.path.join(res, 'b', '*', 'metrics.json')))}
ba, bb = json.load(open(os.path.join(res, 'a', 'bank.json'))), json.load(open(os.path.join(res, 'b', 'bank.json')))
D = json.load(open(os.path.join(res, 'diff.json')))
head = f"{D['a']} → {D['b']}"
rows = [[r['label'], r['a'], r['b'], '▲ 좋아짐' if r['dir'] > 0 else '▼ 나빠짐' if r['dir'] < 0 else '(분모만 바뀜)' if r.get('denominatorOnly') else '', ' '.join(r['worseGames'])] for r in D['rows']]
changed_games = [g for g in A if g in B and any(A[g]['values'].get(k) != B[g]['values'].get(k) for k in set(A[g]['values']) | set(B[g]['values']) if not k.startswith(('replay', 'trust')))]
key = lambda name: re.sub(r'[^\w]+', '_', name, flags=re.U)
def pic(side, game, mapname):
    for f in glob.glob(os.path.join(res, side, game, 'maps', '*.png')):
        if re.sub(r'^\d+-', '', os.path.basename(f))[:-4] == key(mapname): return 'data:image/png;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
def purpose(side, game, mapname):
    M = A if side == 'a' else B
    return next((l for l in M[game]['lines'].get('purpose', []) if l.startswith(mapname + ' ')), '')
KEYS = [('purposeBuildings', '바깥 맵의 건물'), ('purposeEnterable', '들어가지는 건물/건물'), ('purposeRoleBuildings', '역할 있는 건물/건물'), ('purposeFiller', '채움 건물/건물'), ('purposePeople', '바깥 맵의 사람'), ('purposeRoute', '길 칸/걷는 칸'), ('purposeArea', '바깥 맵 넓이(칸)'), ('walkablePerStop', '꼭 들를 곳 하나당 걷는 칸'), ('lockedOnEntrance', '잠김 한 줄(입구에)'), ('exitsOnRoad', '출구가 길 위'), ('exitsFullWidth', '출구가 길 폭 전체'), ('maps', '맵'), ('events', '이벤트'), ('shipBlockers', '출하 차단'), ('gateProblems', '끝맺음 관문이 짚은 문제'), ('autoplayEnding', '자동 플레이 엔딩 도달'), ('replayWritesSame', '그때와 같은 결과의 쓰기')]
css = 'body{font:14px/1.6 system-ui,"Noto Sans KR",sans-serif;margin:0;background:#f6f5f1;color:#1c1b19}main{max-width:1240px;margin:0 auto;padding:24px 20px 70px}h1{font-size:23px;margin:0 0 6px}h2{font-size:18px;margin:34px 0 8px;padding-top:12px;border-top:2px solid #1c1b19}h3{font-size:15px;margin:20px 0 6px}table{border-collapse:collapse;background:#fff;width:100%;margin:8px 0}th,td{border:1px solid #d9d6cc;padding:4px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:#ebe8de}.up{color:#0b6b3a;font-weight:600}.down{color:#b3261e;font-weight:600}.note{background:#fff8dc;border:1px solid #e3d48a;border-radius:6px;padding:8px 12px;margin:10px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 20px}.pair figure{margin:0;background:#fff;border:1px solid #d9d6cc;border-radius:8px;padding:8px}.pair img{max-width:100%;image-rendering:pixelated;display:block;margin:0 auto}figcaption{font-size:12.5px;color:#55524b;margin-top:6px}pre{white-space:pre-wrap;background:#fff;border:1px solid #d9d6cc;padding:8px 10px;font-size:12.5px}'
mark = lambda s: f'<span class="up">{E(s)}</span>' if '좋아짐' in s else f'<span class="down">{E(s)}</span>' if '나빠짐' in s else E(s)
h = [f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{E(title)}</title><style>{css}</style></head><body><main><h1>{E(title)}</h1>',
     f'<p>명세 은행 {len(A)}판을 두 빌더로 다시 지었다(모델 호출 0) — 전 <code>{E(ba.get("at") or ba.get("head", ""))}</code> · 후 <code>{E(bb.get("at") or bb.get("head", ""))}</code>. 재는 자는 후 쪽 작업 폴더의 탐침이다. 한 줄 전체 {max(ba.get("wallSec", 0), bb.get("wallSec", 0))}초(두 번을 같이, 한 번에 {ba.get("jobs")}개씩).</p>',
     '<div class="note">수치는 기계가 센 것이다(<b>화면 미검증</b>). 그림을 직접 본 것은 아래 맵 짝뿐이다.</div>',
     f'<div class="note">{note}</div>' if note else '',
     f'<h2>1. 바뀐 판 — {len(changed_games)} / {len(A)}</h2><p>{E(" · ".join(changed_games)) or "없음"}. 나머지 판은 모든 칸이 같다.</p>']
for g in changed_games:
    h.append(f'<h3>{E(g)}</h3><table><thead><tr><th>칸</th><th>전</th><th>후</th></tr></thead><tbody>' + ''.join(f'<tr><td>{E(l)}</td><td>{E(sh(A[g]["values"].get(k)))}</td><td>{E(sh(B[g]["values"].get(k)))}</td></tr>' for k, l in KEYS if A[g]['values'].get(k) != B[g]['values'].get(k) or k in ('exitsOnRoad', 'autoplayEnding')) + '</tbody></table>')
    h.append('<pre>전(맵마다)\n' + E('\n'.join(A[g]['lines'].get('purpose', []))) + '\n\n후(맵마다)\n' + E('\n'.join(B[g]['lines'].get('purpose', []))) + '</pre>')
h.append('<h2>2. 맵 짝 (1배)</h2>')
for p in [x for x in pairs.split(',') if x]:
    g, m = p.split(':')
    a, b = pic('a', g, m), pic('b', g, m)
    if a and b: h.append(f'<h3>{E(g)} · {E(m)}</h3><div class="pair"><figure><img src="{a}"><figcaption>전 — {E(purpose("a", g, m))}</figcaption></figure><figure><img src="{b}"><figcaption>후 — {E(purpose("b", g, m))}</figcaption></figure></div>')
h.append('<p>파란 칸 = 맵 사이 이동 이벤트, 자주 칸 = 그 밖의 투명 이벤트(잠김 한 줄 등).</p>')
h.append(f'<h2>3. 은행 전체 대조 ({E(head)})</h2><table><thead><tr><th>칸</th><th>전</th><th>후</th><th>합계</th><th>나빠진 판</th></tr></thead><tbody>' + ''.join(f'<tr><td>{E(r[0])}</td><td>{E(r[1])}</td><td>{E(r[2])}</td><td>{mark(r[3])}</td><td>{E(" ".join(r[4:]))}</td></tr>' for r in rows) + '</tbody></table>')
h.append('<p>비율 칸은 수와 비율을 같이 적는다. 분모만 줄거나 늘어 비율이 움직인 줄은 나빠짐·좋아짐으로 치지 않는다.</p></main></body></html>')
open(out, 'w').write(''.join(h))
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB', 'changed', changed_games)
