#!/usr/bin/env python3
"""H 방법(Tibo 3/4 생성 → C 팔레트 10색 → E Sonnet 손질) 6종 비교 페이지를 자체완결 HTML 로 만든다.

  python3 scripts/content/atlas-pick/make_h_method_page.py [--out ~/claude-viz/h-method-sets.html]

항목별로 [사용자 옛 선택 | v34-A(손 도트 3/4) | h34-A(H) | 생성 원본 썸네일] 을 4배·1배로 나란히 놓고,
3/4 검사 판정·비용·적대적 평가를 붙인다. 이미지는 전부 data URI.
검사는 view34_check.py(실외 :prop) / interior_view34_audit.py(--object / --wall-tall) 를 그대로 돌려 읽는다."""
import argparse, base64, glob, html, io, json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
AP = os.path.join(ROOT, 'tiledata', 'atlas-pick')

# (세트, slug, 이름, 옛 선택 후보, 검사 종류)
ITEMS = [
    ('jp', 'vending_drink', '음료 자판기', 'r1-A', 'prop'),
    ('jp', 'vending_ice', '아이스 자판기', 'r2-A', 'prop'),
    ('school', 'locker_row', '사물함 줄', 's3-A', 'object'),
    ('school', 'lab_cabinet', '실험실 캐비닛', 's5-A', 'object'),
    ('horror', 'wardrobe_ajar', '반쯤 열린 옷장', 'h5-A', 'wall-tall'),
    ('horror', 'dresser', '서랍장', 'hf4-A', 'object'),
]
NEIGH = {   # 세트의 다른 조각(화풍 대조용)
    'jp': ['mailbox_red', 'garbage_station'],
    'school': ['library_shelf', 'desk_pair'],
    'horror': ['bookshelf_manor', 'bedside_cabinet'],
}
SET_NAME = {'jp': '일본', 'school': '학원', 'horror': '호러'}
ROUNDS = {'jp': 2, 'school': 2, 'horror': 2}
USED_ROUND = {'jp': 'r1', 'school': 'r1', 'horror': 'r2'}
# 적대적 평가 — 눈으로 본 뒤 채운다(평가 근거는 각 문장에 적는다)
VERDICT = json.load(open(os.path.join(HERE, 'h_method_verdicts.json'), encoding='utf-8')) \
    if os.path.exists(os.path.join(HERE, 'h_method_verdicts.json')) else {}


def durl(path, scale=1):
    im = Image.open(path).convert('RGBA')
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def durl_thumb(path, maxh=220):
    im = Image.open(path).convert('RGBA')
    if im.height > maxh:
        r = maxh / im.height
        im = im.resize((max(1, round(im.width * r)), maxh), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def run_check(kind, png):
    try:
        if kind == 'prop':
            out = subprocess.run([sys.executable, os.path.join(HERE, 'view34_check.py'), png + ':prop'],
                                 capture_output=True, text=True, cwd=ROOT).stdout.strip().splitlines()[-1]
            return out[out.index(' prop') + 6:].strip()
        flag = '--wall-tall' if kind == 'wall-tall' else '--object'
        out = subprocess.run([sys.executable, os.path.join(HERE, 'interior_view34_audit.py'), flag, png],
                             capture_output=True, text=True, cwd=ROOT).stdout.strip().splitlines()[-1]
        return ' '.join(out.split()[:3])
    except Exception as e:   # 표는 계속 그린다
        return f'검사 실패 {e!r}'[:80]


def check_json(d, cand):
    p = os.path.join(d, cand + '.check.json')
    if not os.path.exists(p):
        return ''
    j = json.load(open(p, encoding='utf-8'))
    lint = 'lint 합' if j.get('lint', {}).get('pass') else 'lint 불(' + ','.join(j.get('lint', {}).get('failed', [])) + ')'
    ok = '검사 합격' if j.get('ok') and not j.get('hard') else '검사 불합격 ' + ';'.join(j.get('hard', []))
    return f"{ok} · {lint} · {j.get('colors','?')}색 · easyrpg 최대 {j.get('easyrpg',{}).get('max','?')}"


def item_cost(s, slug):
    tot = 0.0
    for wd in ('work', 'work-r1', 'work-r2-c-only'):
        p = os.path.join(AP, 'h-method', s, wd, slug + '-cost.json')
        if os.path.exists(p) and not (wd == 'work-r1' and USED_ROUND[s] == 'r1'):
            tot += json.load(open(p))['cost_usd']
    return tot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.expanduser('~/claude-viz/h-method-sets.html'))
    a = ap.parse_args()
    cards = []
    total_e = 0.0
    # 세트별 원본 시트 썸네일(선택한 라운드)
    for s, slug, name, old, kind in ITEMS:
        d = os.path.join(AP, f'candidates-{s}', slug)
        cols = []
        for label, cand, note in [('사용자 옛 선택 ' + old, old, '옛'), ('v34-A 손 도트 3/4', 'v34-A', 'v34'), ('h34-A H 방법', 'h34-A', 'h')]:
            png = os.path.join(d, cand + '.png')
            chk = run_check(kind, os.path.relpath(png, ROOT))
            cols.append((label, cand, png, chk, check_json(d, cand)))
        src = os.path.join(AP, 'h-method', s, 'work', slug + '-src.png')
        cost = item_cost(s, slug)
        total_e += cost
        v = VERDICT.get(slug, {})
        tds = ''
        for label, cand, png, chk, cj in cols:
            hl = ' h' if cand == 'h34-A' else ''
            tds += (f'<td class="c{hl}"><div class="lab">{html.escape(label)}</div>'
                    f'<div class="row"><img class="x4" src="{durl(png, 4)}"><img class="x1" src="{durl(png)}"></div>'
                    f'<div class="chk">3/4: {html.escape(chk)}</div><div class="cj">{html.escape(cj)}</div></td>')
        tds += (f'<td class="c"><div class="lab">생성 원본(Tibo sunburst, {USED_ROUND[s]})</div>'
                f'<img class="raw" src="{durl_thumb(src)}"><div class="cj">비교용 축소. 이 그림 하나를 C(팔레트 10색 글리프)·E(Sonnet)로 낮춘 것이 h34-A.</div></td>')
        cards.append(
            f'<section><h2>{html.escape(SET_NAME[s])} · {html.escape(name)} <small>{slug}</small>'
            f'<span class="cost">E 손질 ${cost:.2f}</span></h2><table><tr>{tds}</tr></table>'
            f'<div class="verd"><b>H vs v34-A: {html.escape(v.get("winner","-"))}</b>'
            f'<p><b>세트와 화풍 충돌?</b> {html.escape(v.get("clash","-"))}</p>'
            f'<p><b>윗면이 면으로 읽히나?</b> {html.escape(v.get("top","-"))}</p>'
            f'<p><b>총평.</b> {html.escape(v.get("note","-"))}</p></div></section>')
    # 세트 이웃 조각
    nb = ''
    for s, lst in NEIGH.items():
        imgs = ''
        for slug in lst:
            d = os.path.join(AP, f'candidates-{s}', slug)
            f = os.path.join(d, 'v34-A.png')
            if not os.path.exists(f):
                fs = sorted(x for x in glob.glob(os.path.join(d, '*-A.png')) if 'ctx' not in x)
                f = fs[0] if fs else None
            if f:
                imgs += f'<figure><img src="{durl(f, 4)}"><figcaption>{slug}</figcaption></figure>'
        nb += f'<div class="nb"><b>{SET_NAME[s]}의 다른 조각(대조용 4배)</b><div class="row">{imgs}</div></div>'
    css = '''body{background:#1c1c22;color:#ddd;font:14px/1.5 system-ui,sans-serif;margin:16px}
h1{font-size:20px}h2{font-size:16px;margin:0 0 8px}h2 small{color:#888;font-weight:400}.cost{float:right;color:#9c9}
section{background:#26262e;border:1px solid #3a3a46;border-radius:6px;padding:12px;margin:0 0 14px}
table{border-collapse:collapse}td.c{vertical-align:top;padding:6px 12px 6px 0;max-width:260px}td.h{background:#2d3a2d;padding-left:8px}
.lab{font-weight:600;margin-bottom:4px;font-size:12px}.row{display:flex;gap:10px;align-items:flex-end}
img{image-rendering:pixelated;background:#7a7a86 repeating-conic-gradient(#8a8a96 0 25%,#70707c 0 50%) 0 0/16px 16px}
img.raw{image-rendering:auto;background:#444;max-height:220px}.chk{font:12px monospace;margin-top:4px;color:#fc8}.cj{font-size:11px;color:#999;margin-top:2px}
.verd{margin-top:8px;border-top:1px solid #3a3a46;padding-top:6px}.verd p{margin:3px 0}.nb{margin:8px 0}figure{margin:0}figcaption{font-size:11px;color:#999}
.sum{background:#26262e;padding:10px;border-radius:6px;margin-bottom:14px}'''
    doc = (f'<!doctype html><meta charset="utf-8"><title>H 방법 6종 비교</title><style>{css}</style>'
           f'<h1>H 방법 6종 — 옛 선택 / v34-A / h34-A / 생성 원본</h1>'
           f'<div class="sum">{html.escape(VERDICT.get("_summary", ""))}<br>E 손질 비용 합계 ${total_e:.2f}'
           f'(Tibo 이미지 생성 비용은 호출 단위로 집계하지 못했다. 세트당 라운드 {ROUNDS["jp"]}회 × 3장 = 18장)</div>'
           f'{nb}{"".join(cards)}')
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(doc)
    print('wrote', a.out, len(doc) // 1024, 'KB  E cost', round(total_e, 2))


if __name__ == '__main__':
    main()
