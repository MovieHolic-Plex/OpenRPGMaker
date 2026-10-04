#!/usr/bin/env python3
"""심판 결과 페이지: ~/claude-viz/px-harness-judge.html (+ px-harness-judge/*.png).

  python3 scripts/content/pixel-harness/judge/page.py --plan PLAN.json

PLAN.json = {"modeTest": {"same-screen": {"ours": [runs], "control": [runs]}, "same-factor": {...}},
             "calib": [runs], "baseline": {"new32": [runs], "v5": [runs]}, "defects": [runs]}
run = 판 폴더 경로(옆에 .key.json · .result.json). 판 그림을 페이지 폴더로 복사한다(REFMAP 이 섞인 판은 claude-viz 에만 둔다).
"""
import argparse, html, json, os, shutil
from PIL import Image, ImageDraw

VIZ = os.path.expanduser('~/claude-viz'); OUT = f'{VIZ}/px-harness-judge'
TYPE_COLOR = {'banding': (255, 80, 80), 'pillow_shading': (255, 170, 40), 'orphan_pixel': (250, 250, 60), 'jaggy_line': (90, 220, 90),
              'perspective': (80, 200, 255), 'proportion': (160, 120, 255), 'material_texture': (255, 110, 220), 'color': (255, 255, 255), 'other': (170, 170, 170)}
SIZE_WORDS = ('해상도', '크기', '화소가 크', '큰 화소', '화소 크', '도트가 굵', '굵은 화소', 'resolution', 'size', '작게', '크게 확대', '확대', '픽셀이 크', '화소 단위', '칸 단위')


def load(run):
    k = json.load(open(run.rstrip('/') + '.key.json'))
    rp = run.rstrip('/') + '.result.json'
    r = json.load(open(rp)) if os.path.exists(rp) else {'answers': []}
    return k, {a['plate']: a for a in r['answers']}


def copy_plate(run, plate):
    name = f"{os.path.basename(run.rstrip('/'))}-{plate}.png"; shutil.copy(f'{run.rstrip("/")}/{plate}.png', f'{OUT}/{name}')
    return f'px-harness-judge/{name}'


def ident_votes(runs):
    V = []
    for run in runs:
        k, A = load(run)
        for p, m in k['plates'].items():
            if p not in A: continue
            a = A[p]; cues = ' '.join(a.get('cues', []))
            V.append(dict(run=run, plate=p, id=m['id'], kind=m.get('kind'), variant=m.get('variant'), mode=k['mode'], ours=m['ours'],
                          identified=a['commercial'] != m['ours'], conf=a.get('confidence', 0.5), cues=a.get('cues', []),
                          sizeCue=any(w in cues for w in SIZE_WORDS)))
    return V


def summ(V):
    if not V: return dict(n=0)
    n = len(V); ident = sum(v['identified'] for v in V)
    return dict(n=n, identRate=round(ident / n, 3), meanConf=round(sum(v['conf'] for v in V) / n, 3),
                confScore=round(sum(v['conf'] * (1 if v['identified'] else -1) for v in V) / n, 3),
                sizeCue=round(sum(v['sizeCue'] for v in V) / n, 3), pickedA=round(sum((v['ours'] == 'B') == v['identified'] for v in V) / n, 3))


def overlay(png, defects, z=8):
    im = Image.open(png).convert('RGBA'); bg = Image.new('RGBA', im.size, (58, 54, 60, 255)); bg.alpha_composite(im)
    big = bg.resize((im.width * z, im.height * z), Image.NEAREST); d = ImageDraw.Draw(big)
    for i, df in enumerate(defects, 1):
        x, y, w, h = df.get('rect', [0, 0, 0, 0]); c = TYPE_COLOR.get(df.get('type'), (200, 200, 200))
        d.rectangle([x * z, y * z, (x + w) * z - 1, (y + h) * z - 1], outline=c + (255,), width=3)
        d.rectangle([x * z, y * z, x * z + 18, y * z + 16], fill=(0, 0, 0, 200)); d.text((x * z + 4, y * z + 2), str(i), fill=c + (255,))
    return big


CSS = '''body{font-family:system-ui,sans-serif;background:#15171b;color:#e4e4e4;margin:0;padding:24px 32px;max-width:1900px;line-height:1.55}
h1{font-size:22px}h2{font-size:18px;margin:28px 0 8px;border-top:1px solid #333;padding-top:16px}h3{font-size:15px;margin:14px 0 6px}
img{image-rendering:pixelated;display:block;max-width:100%}table{border-collapse:collapse;font-size:13px;margin:8px 0}
td,th{border:1px solid #333;padding:3px 8px;text-align:right;vertical-align:top}td:first-child,th:first-child,td.l{text-align:left}
.note{background:#20242a;padding:10px 14px;border-radius:8px}.muted{color:#9aa0a8;font-size:12px}.ok{color:#8fd694}.bad{color:#ff8a80}
.grid{display:flex;flex-wrap:wrap;gap:12px}.card{background:#1e2126;border-radius:8px;padding:8px;max-width:560px}.card p{margin:4px 0;font-size:12px}
.hot{background:#3a2a1a}'''


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--plan', required=True); ap.add_argument('--stage', default='')
    a = ap.parse_args(); P = json.load(open(a.plan)); os.makedirs(OUT, exist_ok=True)
    parts = [f'<!doctype html><meta charset="utf-8"><title>도트 심판 — 블라인드 눈 심판</title><style>{CSS}</style>',
             f'<h1>도트 품질 하네스 — 블라인드 눈 심판 {html.escape(a.stage)}</h1>']
    if P.get('headline'): parts.append(f'<p class="note">{P["headline"]}</p>')

    # 1. 배율 공정성
    if P.get('modeTest'):
        parts.append('<h2>1. 어느 배율이 공정한가 (질문 A, 12종)</h2><table><tr><th>배율</th><th>짝</th><th>판정 수</th><th>식별률</th><th>평균 확신</th><th>확신 점수</th><th>근거에 크기·해상도</th><th>A 고른 비율</th></tr>')
        for mode, arms in P['modeTest'].items():
            for arm, runs in arms.items():
                s = summ(ident_votes(runs)); lab = '우리 32px 견본 vs REFMAP' if arm == 'ours' else '대조군: REFMAP 을 32px 로 줄인 것 vs REFMAP'
                parts.append(f'<tr><td>{mode}</td><td class="l">{lab}</td><td>{s.get("n")}</td><td>{s.get("identRate")}</td><td>{s.get("meanConf")}</td><td>{s.get("confScore")}</td><td>{s.get("sizeCue")}</td><td>{s.get("pickedA")}</td></tr>')
        parts.append('</table>')
        if P.get('modeNote'): parts.append(f'<p class="note">{P["modeNote"]}</p>')
        # 판 예시: 모드마다 첫 판 몇 장
        for mode, arms in P['modeTest'].items():
            parts.append(f'<h3>{mode} 판 (첫 판정 판, 캡션 = 심판 답)</h3><div class="grid">')
            for arm in ('ours', 'control'):
                for run in arms.get(arm, [])[:1]:
                    k, A = load(run)
                    for p in sorted(k['plates'])[:P.get('platesPerMode', 4)]:
                        m = k['plates'][p]; ans = A.get(p, {}); ok = ans.get('commercial') and ans['commercial'] != m['ours']
                        parts.append(f'<div class="card"><img src="{copy_plate(run, p)}"><p><b>{html.escape(m["id"])}</b> 우리={m["ours"]} · 심판 상용={ans.get("commercial")} '
                                     f'({ans.get("confidence")}) <span class="{"ok" if ok else "bad"}">{"골라냄" if ok else "속음"}</span></p><p class="muted">{html.escape(" / ".join(ans.get("cues", [])))}</p></div>')
            parts.append('</div>')

    # 2. 사용자 취향 교정 — calib = {"v1 기본": [runs], "v2 ...": [runs]}
    if P.get('calib'):
        C = P['calib'] if isinstance(P['calib'], dict) else {'v1': P['calib']}
        table = {}; tot = {}; plates = {}
        for ver, runs in C.items():
            for run in runs:
                k, A = load(run)
                for p, m in k['plates'].items():
                    if p not in A: continue
                    r = table.setdefault(m['id'], dict(m=m, v={}))
                    r['v'].setdefault(ver, []).append(dict(agree=A[p]['better'] == m['truthSide'], conf=A[p].get('confidence'), reason=A[p].get('reason', '')))
                    tot.setdefault(ver, []).append(A[p]['better'] == m['truthSide'])
                    plates.setdefault(m['id'], (run, p, m))
        parts.append('<h2>2. 사용자 판정과 맞나 (교정)</h2><p>' + ' · '.join(
            f'<b>{html.escape(ver)}</b> {sum(t)}/{len(t)} ({sum(t) / max(1, len(t)):.0%})' for ver, t in tot.items()) + '</p>')
        if P.get('calibNote'): parts.append(f'<p class="note">{P["calibNote"]}</p>')
        parts.append('<table><tr><th>짝 (x vs y)</th><th>사용자 판정</th>' + ''.join(f'<th>{html.escape(v)}</th>' for v in C) + '<th>마지막 판 심판 근거</th></tr>')
        for r in table.values():
            m = r['m']; cells = ''
            for ver in C:
                vs = r['v'].get(ver, [])
                cells += '<td>' + ' '.join(f'<span class="{"ok" if v["agree"] else "bad"}">{"O" if v["agree"] else "X"}</span>' for v in vs) + '</td>'
            last = list(r['v'].values())[-1]
            parts.append(f'<tr><td class="l">{html.escape(m["x"])} vs {html.escape(m["y"])}</td><td class="l">{html.escape(m.get("truthNote") or "")}</td>{cells}'
                         f'<td class="l muted">{"<br>".join(html.escape(v["reason"]) for v in last)}</td></tr>')
        parts.append('</table><h3>교정 판 (사용자 쪽 = 사용자가 낫다고 한 쪽)</h3><div class="grid">')
        for i, (run, p, m) in plates.items():
            parts.append(f'<div class="card"><img src="{copy_plate(run, p)}"><p>{html.escape(m["x"])} / {html.escape(m["y"])} · 사용자 쪽 = {m["truthSide"]}</p></div>')
        parts.append('</div>')

    # 3. 기준선
    if P.get('baseline'):
        parts.append('<h2>3. 기준선 — 지금 수준 (질문 A 식별률 + 질문 B 결함)</h2>')
        D = {}
        for run in P.get('defects', []):
            k, A = load(run)
            for p, m in k['plates'].items():
                if p in A: D[m['id']] = dict(m=m, a=A[p], run=run, plate=p)
        byid = {}
        for var, runs in P['baseline'].items():
            for v in ident_votes(runs): byid.setdefault(v['id'], []).append(v)
        kinds = P.get('kinds', [])
        parts.append('<table><tr><th>종류</th><th>변형</th><th>판정 수</th><th>식별률</th><th>평균 확신</th><th>결함 수</th><th>심 3 결함</th><th>완성도 /10</th><th>주요 결함 종류</th></tr>')
        for kind in kinds:
            for var in P['baseline']:
                i = f'{kind}:{var}'; s = summ(byid.get(i, [])); d = D.get(i)
                dfs = d['a'].get('defects', []) if d else []
                types = {}
                for x in dfs: types[x.get('type')] = types.get(x.get('type'), 0) + 1
                parts.append(f'<tr><td class="l">{kind}</td><td>{var}</td><td>{s.get("n")}</td><td>{s.get("identRate")}</td><td>{s.get("meanConf")}</td>'
                             f'<td>{len(dfs) if d else ""}</td><td>{sum(1 for x in dfs if x.get("severity") == 3) if d else ""}</td><td>{d["a"].get("overall") if d else ""}</td>'
                             f'<td class="l muted">{", ".join(f"{t}×{c}" for t, c in sorted(types.items(), key=lambda z: -z[1]))}</td></tr>')
        parts.append('</table>')
        if P.get('baselineNote'): parts.append(f'<p class="note">{P["baselineNote"]}</p>')
        parts.append('<h3>결함 사각형 (심판이 원본 화소 좌표로 돌려준 것 ×8, 번호 = 아래 목록)</h3><p class="muted">' +
                     ' · '.join(f'<span style="color:rgb{c}">■</span> {t}' for t, c in TYPE_COLOR.items()) + '</p><div class="grid">')
        for kind in kinds:
            for var in P['baseline']:
                d = D.get(f'{kind}:{var}')
                if not d: continue
                dfs = d['a'].get('defects', []); z = 8 if d['m']['size'][0] <= 100 else 6
                if var == 'v5': z = 16 if d['m']['size'][0] <= 50 else 12
                im = overlay(d['m']['png'], dfs, z); name = f'ov-{kind}-{var}.png'; im.save(f'{OUT}/{name}')
                lis = ''.join(f'<li><b style="color:rgb{TYPE_COLOR.get(x.get("type"), (200, 200, 200))}">{html.escape(str(x.get("type")))}</b> s{x.get("severity")} {x.get("rect")} — {html.escape(x.get("note", ""))}</li>' for x in dfs)
                parts.append(f'<div class="card"><p><b>{kind} · {var}</b> 완성도 {d["a"].get("overall")}/10</p><img src="px-harness-judge/{name}"><ol style="font-size:12px;padding-left:18px">{lis}</ol></div>')
        parts.append('</div>')
    if P.get('weak'): parts.append(f'<h2>4. 심판의 약점</h2><div class="note">{P["weak"]}</div>')
    open(f'{VIZ}/px-harness-judge.html', 'w').write('\n'.join(parts)); print(f'{VIZ}/px-harness-judge.html')


if __name__ == '__main__':
    main()
