# 시각화 페이지: ~/claude-viz/px-harness-lint.html + ~/claude-viz/px-harness-lint/*.png (REFMAP 크롭은 여기에만 — 저장소 밖)
# 저장소 루트에서: python3 scripts/content/pixel-harness/viz.py
# 12종마다 REFMAP 짝(32px 로 줄인 것 ×4) 과 우리 그림(결함 오버레이, 32px ×4 · 16px ×8)을 나란히, 항목별 수치·합불 표.
import os, sys, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_io as io, pxlint

VIZ = os.path.expanduser('~/claude-viz/px-harness-lint'); PAGE = os.path.expanduser('~/claude-viz/px-harness-lint.html')

def save(im, name):
    im.save(os.path.join(VIZ, name)); return f'px-harness-lint/{name}'

def lint(entry, material, to=None):
    im = io.load_image(entry); T = entry['tile']
    if to and to != T: im = io.rescale(im, T, to); T = to
    a = io.arr(im); res = pxlint.lint_array(a, T, material, 'surface' if entry.get('surface') else 'object', STATS)
    return im, a, res, T

def fmt(v):
    if v is None: return '–'
    if isinstance(v, float): return f'{v:.3g}'
    return str(v)

def card(title, im, a, res, T):
    k = 8 if T == 16 else 4
    src = save(pxlint.overlay(a, res, k), f'{title}.png')
    bad = res['failed']
    head = '<b class="ok">합격</b>' if not bad else '<b class="bad">불합격</b> ' + html.escape(', '.join(c['ko'] for c in res['checks'] if not c['pass']))
    return src, head

def main():
    global STATS
    STATS = pxlint.load_stats(); os.makedirs(VIZ, exist_ok=True)
    G = io.golden(); cal = json.load(open(os.path.join(io.ROOT, 'tiledata/pixel-harness/calibration.json')))
    ids = [c['id'] for c in pxlint.CHECKS]; ko = {c['id']: c['ko'] for c in pxlint.CHECKS}
    blocks = []
    for e in G['golden'] + G.get('extras', []):
        cols = []
        if e.get('refmap'):
            im, a, res, T = lint(e['refmap'], e['material'], None)
            src, head = card(f"ref48-{e['id']}", im, a, res, T)
            cols.append(('REFMAP 48px 원본 (기준, ×4)', src, head, res))
            im, a, res, T = lint(e['refmap'], e['material'], 32)
            src, head = card(f"ref-{e['id']}", im, a, res, T)
            cols.append(('REFMAP → 32px 환산 (×4)', src, head, res))
        for o in e['ours']:
            name = o['set'] + ('-' + o['variant'] if o.get('variant') else '')
            im, a, res, T = lint(o, e['material'])
            src, head = card(f"{name}-{e['id']}", im, a, res, T)
            cols.append((f"{name} ({T}px{' ×8' if T == 16 else ' ×4'})", src, head, res))
        figs = ''.join(f'<figure><img src="{s}"><figcaption>{html.escape(t)}<br>{h}</figcaption></figure>' for t, s, h, _ in cols)
        rows = ''
        for cid in ids:
            cells = ''
            for _, _, _, res in cols:
                c = next((c for c in res['checks'] if c['id'] == cid), None)
                if not c: cells += '<td class="na">–</td>'; continue
                rg = c.get('range'); rs = '' if not rg else f"<span class='rg'>[{fmt(rg[0]) if rg[0] is not None else ''}, {fmt(rg[1]) if rg[1] is not None else ''}]</span>"
                dc = c.get('defectCount'); ds = f" <span class='dc'>결함 {dc}</span>" if dc and not c['pass'] else ''
                cells += f"<td class='{'ok' if c['pass'] else 'bad'}'>{fmt(c['value'])} {rs}{ds}</td>"
            rows += f'<tr><td>{html.escape(ko[cid])}</td>{cells}</tr>'
        hdr = ''.join(f'<th>{html.escape(t)}</th>' for t, _, _, _ in cols)
        note = f"<p class='muted'>{html.escape(e['note'])}</p>" if e.get('note') else ''
        blocks.append(f"<section><h2>{html.escape(e['ko'])} <span class='muted'>{e['id']} · 재료 {e['material']}</span></h2>{note}<div class='row'>{figs}</div>"
                      f"<table><tr><th>항목</th>{hdr}</tr>{rows}</table></section>")
    S = cal['summary']; sets = list(S['ours_check_fail'])
    srows = ''.join(f"<tr><td>{html.escape(c['ko'])}</td><td>{S['refmap48_check_fail'][c['id']]}</td><td>{S['refmap32_check_fail'][c['id']]}</td><td>{S['samples32_check_fail'][c['id']]}</td>" +
                    ''.join(f"<td>{S['ours_check_fail'][s][c['id']]}</td>" for s in sets) + '</tr>' for c in pxlint.CHECKS)
    legend = ''.join(f"<span class='lg' style='border-color:rgb{pxlint.COLORS[k]}'>{html.escape(n)}</span>" for k, n in
                     [('orphans', '외톨이'), ('jaggies', '들쭉날쭉'), ('banding', '명암 띠'), ('pillow', '베개'), ('light', '빛 방향'),
                      ('noise', '잡음 반점'), ('outline', '검은 윤곽'), ('dither', '체크 디더'), ('joints', '줄눈(칠함)')])
    page = f'''<!doctype html><meta charset="utf-8"><title>도트 품질 하네스 — pxlint 교정</title>
<style>
body{{font-family:system-ui,sans-serif;background:#15171b;color:#e4e4e4;margin:0;padding:22px 30px;line-height:1.5;max-width:2000px}}
h1{{font-size:21px}} h2{{font-size:17px;margin:26px 0 6px;border-top:1px solid #333;padding-top:14px}}
img{{image-rendering:pixelated;display:block;max-width:none}} figure{{margin:0 14px 10px 0;display:inline-block;vertical-align:top}}
figcaption,.muted{{color:#9aa0a8;font-size:12px}} .row{{display:flex;flex-wrap:wrap;align-items:flex-end}}
table{{border-collapse:collapse;font-size:12.5px;margin:6px 0}} td,th{{border:1px solid #333;padding:2px 7px;text-align:left;vertical-align:top}}
td.ok{{background:#1b3024}} td.bad{{background:#4a1f22;font-weight:600}} td.na{{color:#555}} b.ok{{color:#7fdc9a}} b.bad{{color:#ff8a8a}}
.rg{{color:#8b939c;font-weight:400;font-size:11px}} .dc{{color:#ffb3b3;font-size:11px}} .note{{background:#20242a;padding:10px 14px;border-radius:8px;max-width:1200px}}
.lg{{display:inline-block;border:2px solid;padding:0 6px;margin:0 6px 4px 0;font-size:12px}}
</style>
<h1>도트 품질 하네스 — 정답지 12종 · REFMAP 통계 · pxlint 교정</h1>
<div class="note"><b>목표 해상도는 48px</b>(사용자 결정, REFMAP 과 같은 크기). pxlint 기본은 48px 입력 + REFMAP 원본 범위다. 지금 있는 우리 그림은 32px·16px 라서 REFMAP 을 그 크기로 줄여 잰 환산 범위로 검사했다(표본 {len(G['samples'])}개). 정답지 REFMAP 12종은 범위를 만들 때 쓰지 않은 표본 밖 시험이다.
<b>REFMAP 합격률 48px 원본 {S['refmap48_pass']*100:.0f}% · 32px 환산 {S['refmap32_pass']*100:.0f}%</b> (표본 안 {S['samples32_pass']*100:.0f}%).
오버레이는 <b>불합격 항목의 결함만</b> 그린다. 48px·32px 은 ×4, 16px(v5)은 ×8.<br>{legend}</div>
<h2>교정 요약 — 항목별 불합격 수</h2>
<table><tr><th>항목</th><th>REFMAP 48 정답지 (12)</th><th>REFMAP→32 정답지 (12)</th><th>REFMAP 표본 ({len(G['samples'])})</th>{''.join(f"<th>{html.escape(s)} ({S['ours_count'][s]})</th>" for s in sets)}</tr>{srows}</table>
{''.join(blocks)}
'''
    open(PAGE, 'w').write(page)
    print(PAGE)

if __name__ == '__main__':
    main()
