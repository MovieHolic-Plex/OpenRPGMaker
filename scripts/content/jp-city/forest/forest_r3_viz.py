#!/usr/bin/env python3
"""숲 r3 상태 쪽(최신 상태만): ~/claude-viz/jp-forest-kit-1.html + 같은 이름 폴더의 그림.

  python3 forest_r3_viz.py --scenes DIR --argon DIR [--gate-status TEXT] [--bake-count N]
보여 주는 것: 붓 시험 GIF(종 6) · 칠한 모양 5종(버들항 숲과 같은 배율 1×·4×) · 섞인 숲 규칙 · Argon 적대 검수 판별 표 · 관문 상태.
"""
import argparse
import glob
import html
import json
import os
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
VIZ = os.path.expanduser('~/claude-viz')
NAME = 'jp-forest-kit-1'
KO = dict(bl='활엽(느티·잡목)', bb='대숲', sk='벚나무', sg='삼나무', mp='단풍', mx='섞인 숲: 신사(소나무+단풍)', mh='섞인 숲: 산비탈(삼나무+활엽)')
SCENES = [('blob', '덩이'), ('strips', '띠 1·2·3줄 / 세로 1·2칸'), ('lshape', 'L 자(안쪽 모서리)'), ('ring', '빈터 둘레 고리'), ('touching', '연못·길·집 맞닿음')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenes', required=True)
    ap.add_argument('--argon', required=True)
    ap.add_argument('--gate-status', default='')
    ap.add_argument('--bake-count', default='')
    a = ap.parse_args()
    out = os.path.join(VIZ, NAME)
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)

    def png(src, scale, name=None, crop=None):
        im = Image.open(src).convert('RGBA')
        if crop: im = im.crop(crop)
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        n = name or (os.path.splitext(os.path.basename(src))[0] + f'-x{scale}.png')
        im.save(os.path.join(out, n))
        return f'{NAME}/{n}'

    S = a.scenes
    parts = []
    parts.append('<h1>jp 숲 r3 — 붓으로 칠하는 숲 오토타일 (최신 상태)</h1>')
    parts.append('<div class="box"><b>지금 상태</b><ul>'
                 '<li>숲은 손으로 찍는 키트가 아니라 <b>오토타일</b>이다: 칸마다 8방 마스크(정규화 47) + 칸 위치 위상(x mod w, y mod h)으로 그림이 정해진다. '
                 '엔진에 <code>phaseVariants</code> 를 더해 편집기 붓·조수 지형 도구·forestPainter 가 같은 표를 쓴다.</li>'
                 '<li>종 6: 활엽(6×4 위상) · 대숲 · 벚나무 · 삼나무 · 단풍 · 소나무(4×4). 섞인 숲(신사 소나무+단풍, 산비탈 삼나무+활엽)은 새 칸 없이 3×3 덩이 규칙.</li>'
                 f'<li>임시 굽기(저장소 밖): 시트 칸 {html.escape(a.bake_count)} (한도 24576). <b>저장소 굽기는 하지 않았다</b> — 관문 보정 대기.</li>'
                 f'<li><b>3/4 관문 미통과 — 보정 대기</b>. {html.escape(a.gate_status)}</li>'
                 '<li><b>Argon 적대 검수 6판 모두 NO-SHIP</b>(아래 표). 출하 기준에는 못 미친다.</li>'
                 '<li>stamp_object 무변경 버그: 원인 = 같은 타일셋 키트 칸 번호를 시트 카탈로그 끝에서 잘라 -1 로 바꿈 → 번호 그대로 쓰고, 못 옮기는 칸은 실패로(c9bc274db5).</li>'
                 '</ul></div>')
    # 붓 시험
    parts.append('<h2>붓 시험 — 붓질이 쌓일 때 칸이 이웃을 보고 바로 맞춰진다</h2><div class="row">')
    for k in KO:
        g = os.path.join(S, f'{k}-paint.gif')
        if os.path.exists(g):
            shutil.copy(g, os.path.join(out, f'{k}-paint.gif'))
            parts.append(f'<figure><img src="{NAME}/{k}-paint.gif"><figcaption>{KO[k]}</figcaption></figure>')
    parts.append('</div>')
    # 활엽 모양 5종 + 버들항
    ref = os.path.join(S, 'ref-beodeul.png')
    parts.append('<h2>칠한 모양 — 활엽, 버들항 숲(손으로 놓은 덩이)과 같은 배율</h2>')
    parts.append(f'<div class="row"><figure><img src="{png(ref, 2)}"><figcaption>버들항 기준 2×</figcaption></figure>'
                 f'<figure><img src="{png(ref, 4, "ref-x4.png", (96, 32, 272, 148))}"><figcaption>버들항 4×</figcaption></figure></div>')
    for sc, ko in SCENES:
        p = os.path.join(S, f'bl-{sc}.png')
        if not os.path.exists(p): continue
        parts.append(f'<div class="row"><figure><img src="{png(p, 2)}"><figcaption>활엽 · {ko} 2×</figcaption></figure>'
                     f'<figure><img src="{png(p, 4, f"bl-{sc}-q.png", (96, 32, 272, 148))}"><figcaption>4× 부분</figcaption></figure></div>')
    parts.append('<h2>다른 종 — 덩이 · 띠 · 맞닿음</h2>')
    for k in ('bb', 'sk', 'sg', 'mp', 'pn'):
        parts.append(f'<h3>{KO[k]}</h3><div class="row">')
        for sc in ('blob', 'strips', 'touching'):
            p = os.path.join(S, f'{k}-{sc}.png')
            if os.path.exists(p): parts.append(f'<figure><img src="{png(p, 2)}"><figcaption>{dict(SCENES)[sc]}</figcaption></figure>')
        parts.append('</div>')
    parts.append('<h2>섞인 숲 규칙 (새 칸 없음: 3×3 덩이마다 종 선택, 다른 종은 서로 숲 밖)</h2><div class="row">')
    for n, ko in (('mix-shrine', '신사 숲 — 소나무+단풍'), ('mix-hill', '산비탈 — 삼나무+활엽')):
        p = os.path.join(S, f'{n}.png')
        if os.path.exists(p): parts.append(f'<figure><img src="{png(p, 2)}"><figcaption>{ko}</figcaption></figure>')
    parts.append('</div>')
    # Argon 표
    parts.append('<h2>Argon 적대 검수 (gemini-4-argon-high, 판마다 장면별 독립 판정자, 1× + 4× 사분면, 버들항 같은 배율)</h2>')
    rows = {}
    for f in glob.glob(os.path.join(a.argon, 'argon-r*-*.json')):
        d = json.load(open(f))
        rows.setdefault(d['round'], {})[d['scene']] = d
    parts.append('<table><tr><th>판</th>' + ''.join(f'<th>{ko}</th>' for _, ko in SCENES) + '</tr>')
    for r in sorted(rows):
        cells = []
        for sc, _ in SCENES:
            d = rows[r].get(sc)
            cells.append(f'<td>{d.get("verdict", "?")} · 막음 {len(d.get("blocking", []))} · 반복 {d.get("repeat_interval_tiles")}</td>' if d else '<td>-</td>')
        parts.append(f'<tr><td>{r}</td>' + ''.join(cells) + '</tr>')
    parts.append('</table>')
    last = max(rows) if rows else None
    if last:
        parts.append(f'<h3>{last}판 막는 결함(원문)</h3>')
        for sc, ko in SCENES:
            d = rows[last].get(sc)
            if not d: continue
            parts.append(f'<details><summary>{ko}</summary><ul>' + ''.join(f'<li><b>{html.escape(str(b.get("where", "")))}</b> — {html.escape(str(b.get("what", "")))}</li>' for b in d.get('blocking', [])) + '</ul></details>')
    parts.append('<h2>버들항 역설계 크롭</h2><div class="row">')
    for n in ('spec-tree-x8.png', 'spec-grove-north-x4-grid.png', 'spec-shadow-x4.png'):
        p = os.path.join(ROOT, 'tiledata', 'jp-city', 'forest-r3', n)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(out, n)); parts.append(f'<figure><img src="{NAME}/{n}" style="max-width:520px"><figcaption>{n}</figcaption></figure>')
    parts.append('</div>')
    css = ('body{background:#22262e;color:#dde;font:14px/1.5 sans-serif;margin:20px}img{image-rendering:pixelated;max-width:100%}'
           '.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}figcaption{color:#aab;font-size:12px}'
           'table{border-collapse:collapse}td,th{border:1px solid #445;padding:3px 8px;font-size:12px}.box{background:#2c313b;padding:8px 14px;border-radius:6px}'
           'code{color:#fc8}')
    open(os.path.join(VIZ, NAME + '.html'), 'w', encoding='utf-8').write(
        f'<!doctype html><meta charset="utf-8"><title>jp 숲 r3</title><style>{css}</style>' + '\n'.join(parts))
    print(os.path.join(VIZ, NAME + '.html'))


if __name__ == '__main__':
    main()
