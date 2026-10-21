#!/usr/bin/env python3
"""숲 r3 상태 쪽(짧게, 최신 상태만): ~/claude-viz/jp-forest-kit-1.html + 같은 이름 폴더의 그림.

  python3 forest_r3_viz.py --scenes DIR --argon DIR [--gate-status TEXT] [--bake-count N]
맨 위: 종마다 붓 시험 GIF + 칠한 모양 5종(1×). 그다음 짧은 상태와 Argon 판별 요약 표.
"""
import argparse
import glob
import html
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
VIZ = os.path.expanduser('~/claude-viz')
NAME = 'jp-forest-kit-1'
KO = dict(bl='활엽(느티·잡목)', bb='대숲', sk='벚나무', sg='삼나무', mp='단풍', mh='섞인 숲(삼나무+활엽)')
SCENES = [('blob', '덩이'), ('strips', '띠 1·2·3줄 / 세로 1·2칸'), ('lshape', 'L 자'), ('ring', '빈터 고리'), ('touching', '연못·길·집')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenes', required=True)
    ap.add_argument('--argon', required=True)
    ap.add_argument('--gate-status', default='')
    ap.add_argument('--bake-count', default='')
    ap.add_argument('--note', default='')
    a = ap.parse_args()
    out = os.path.join(VIZ, NAME)
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    S = a.scenes

    def cp(n):
        p = os.path.join(S, n)
        if not os.path.exists(p): return None
        shutil.copy(p, os.path.join(out, n)); return f'{NAME}/{n}'

    P = ['<h1>jp 숲 오토타일 — 종마다 붓 시험 + 칠한 모양 5종 (1×)</h1>']
    ref = cp('ref-beodeul.png')
    if ref: P.append(f'<div class="row"><figure><img class="s" src="{ref}"><figcaption>기준: 버들항 숲(같은 배율)</figcaption></figure></div>')
    for k, ko in KO.items():
        P.append(f'<h2>{ko}</h2><div class="row">')
        g = cp(f'{k}-paint.gif')
        if g: P.append(f'<figure><img class="g" src="{g}"><figcaption>붓 시험</figcaption></figure>')
        for sc, sko in SCENES:
            p = cp(f'{k}-{sc}.png')
            if p: P.append(f'<figure><img class="s" src="{p}"><figcaption>{sko}</figcaption></figure>')
        P.append('</div>')
    P.append('<h2>다른 종이 맞닿을 때</h2><div class="row">')
    for n, ko in (('adj-bl-sg.png', '활엽 | 삼나무'), ('adj-sk-mh.png', '벚나무 | 섞인 숲')):
        p = cp(n)
        if p: P.append(f'<figure><img class="s" src="{p}"><figcaption>{ko}</figcaption></figure>')
    P.append('</div>')
    P.append('<div class="box"><ul>'
             f'<li>{html.escape(a.note)}</li>'
             f'<li>임시 굽기(저장소 밖) 시트 칸 {html.escape(a.bake_count)} / 한도 24576. 저장소 굽기·머지 안 함.</li>'
             f'<li><b>3/4 관문 미통과 — 보정 대기</b>. {html.escape(a.gate_status)}</li></ul></div>')
    rows = {}
    for f in glob.glob(os.path.join(a.argon, 'argon-r*-*.json')):
        d = json.load(open(f))
        if d.get('round', 0) < 8: continue
        sp = d['scene'].split('-')[0]
        rows.setdefault(d['round'], {}).setdefault(sp, []).append(d)
    P.append('<h2>Argon 적대 검수 (gemini-4-argon-high, 장면마다 새 판정자, 1×+4×, 활엽·버들항을 옆에 둠)</h2>'
             '<table><tr><th>판</th><th>종</th><th>판정</th><th>막는 결함 평균</th><th>활엽 대비</th><th>1× 에서 가장 보이는 결함(장면 첫 줄)</th></tr>')
    for r in sorted(rows):
        for sp in list(KO) + ['adj']:
            ds = rows[r].get(sp)
            if not ds: continue
            v = ', '.join(sorted({d['verdict'] for d in ds}))
            nb = sum(len(d.get('blocking', [])) for d in ds) / len(ds)
            vp = ', '.join(sorted({str(d.get('vs_peer')) for d in ds}))
            tops = '<br>'.join(html.escape(f"{d['scene']}: {(d.get('visible_1x_rank') or ['-'])[0]}") for d in sorted(ds, key=lambda d: d['scene']))
            P.append(f'<tr><td>{r}</td><td>{KO.get(sp, "맞닿음")}</td><td>{v}</td><td>{nb:.1f}</td><td>{vp}</td><td class="t">{tops}</td></tr>')
    P.append('</table>')
    css = ('body{background:#22262e;color:#dde;font:14px/1.5 sans-serif;margin:16px}img{image-rendering:pixelated}'
           'img.s{width:416px}img.g{width:416px}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}'
           'figure{margin:0}figcaption{color:#aab;font-size:12px}h2{margin:14px 0 4px;font-size:17px}'
           'table{border-collapse:collapse}td,th{border:1px solid #445;padding:3px 8px;font-size:12px;vertical-align:top}'
           'td.t{max-width:760px}.box{background:#2c313b;padding:6px 14px;border-radius:6px;margin-top:12px}')
    open(os.path.join(VIZ, NAME + '.html'), 'w', encoding='utf-8').write(
        f'<!doctype html><meta charset="utf-8"><title>jp 숲 오토타일</title><style>{css}</style>' + '\n'.join(P))
    print(os.path.join(VIZ, NAME + '.html'))


if __name__ == '__main__':
    main()
