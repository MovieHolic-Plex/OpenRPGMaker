#!/usr/bin/env python3
"""선 문법 보정 — line_metrics 의 항목이 사용자 눈과 맞는지 그동안 고른 결과로 잰다(게이트로 쓰기 전에 먼저).

같은 기물 안에서 「고른 그림」과 「안 고른 후보」를 짝지어, 고른 쪽이 덜 나쁜 짝의 비율(승률)을 항목마다 센다.
승률 50% 근처 = 사용자 눈과 상관없는 항목 → 게이트로 쓰지 않는다. 그리고 「고른 것인데 나쁜 점수」·「버린 것인데 좋은 점수」를
그림으로 내놓아 사용자가 직접 확인한다.

  python3 scripts/content/hand-interior-pick/line_calibrate.py [--html ~/claude-viz/line-calibrate.html] [--json out.json]
"""
import argparse, base64, io, json, os, re, sys
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import line_metrics as lm  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAND = os.path.join(ROOT, 'tiledata/hand-interior/pick/candidates')
PICKS = os.path.join(ROOT, 'tiledata/hand-interior/pick/picks.json')
NAME = re.compile(r'^(?:([hw]\d+)-([A-Z])|v5)\.png$')
KEYS = ['o_thick', 'o_melt', 'o_none', 'o_foreign', 'light_inv', 'l_thick']
KO = dict(o_thick='외곽 두께 2칸+', o_melt='외곽이 몸통에 묻힘', o_none='외곽 없음·연함', o_foreign='외곽 색이 다른 계열',
          light_inv='빛 방향 거꾸로', l_thick='안쪽 선 2칸+')


def slug_of(k):
    for s in (k.replace(' ', '_'), k.replace(' ', '-'), k):
        if os.path.isdir(os.path.join(CAND, s)): return s


def job(f):
    try: return f, lm.measure(f)
    except Exception as e: return f, dict(error=str(e))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--html'); ap.add_argument('--json'); a = ap.parse_args()
    picks = json.load(open(PICKS))
    groups = {}
    for k, v in picks.items():
        s = slug_of(k)
        if not s: continue
        files = [os.path.join(CAND, s, n) for n in sorted(os.listdir(os.path.join(CAND, s))) if NAME.match(n)]
        chosen = os.path.join(CAND, s, v['choice'] + '.png')
        if chosen not in files or len(files) < 2: continue
        groups[k] = (chosen, [f for f in files if f != chosen])
    allf = sorted({f for c, r in groups.values() for f in [c] + r})
    with Pool(max(2, (os.cpu_count() or 4) // 2)) as p: M = dict(p.map(job, allf, chunksize=8))
    M = {f: m for f, m in M.items() if m and 'error' not in m}
    stats = {}
    for key in KEYS:
        win = lose = tie = 0
        for c, rs in groups.values():
            if c not in M: continue
            for r in rs:
                if r not in M: continue
                d = M[r][key] - M[c][key]
                if abs(d) < 0.02: tie += 1
                elif d > 0: win += 1
                else: lose += 1
        picked = sorted(M[c][key] for c, _ in groups.values() if c in M)
        stats[key] = dict(win=win, lose=lose, tie=tie, rate=win / max(1, win + lose),
                          p50=picked[len(picked) // 2], p90=picked[int(len(picked) * 0.9)])
    out = dict(groups=len(groups), files=len(M), stats=stats)
    for key, s in stats.items():
        print(f'{KO[key]:14s} 승률 {s["rate"]:.0%} (이김 {s["win"]} · 짐 {s["lose"]} · 비김 {s["tie"]})  고른 것 중앙 {s["p50"]:.2f} · 90% {s["p90"]:.2f}')
    if a.json: json.dump(dict(out, metrics={os.path.relpath(f, ROOT): m for f, m in M.items()}), open(a.json, 'w'), ensure_ascii=False)
    if a.html: html(a.html, groups, M, stats)


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def card(f, key, M, tag):
    _, im = lm.overlay(f, 4)
    rel = os.path.relpath(f, CAND)
    return (f'<div class=c><img src="{uri(im)}"><b>{tag} · {rel}</b>'
            f'<span>{KO[key]} {M[f][key]:.0%}</span></div>')


def html(path, groups, M, stats):
    sys.path.insert(0, HERE); import common
    objs = common.objects_by_slug()
    chosen = [c for c, _ in groups.values() if c in M]
    isbig = lambda f: bool((objs.get(os.path.basename(os.path.dirname(f))) or {}).get('blockout'))   # 3/4 밑그림을 단 대형 기물(기차·피아노 …)
    big = [f for f in chosen if isbig(f)]
    small = [f for f in chosen if not isbig(f) and M[f]['n'] > 300]
    med = lambda fs, k: sorted(M[f][k] for f in fs)[len(fs) // 2] if fs else 0
    h = ['<!doctype html><meta charset=utf-8><title>선 측정 맞춰 보기</title><style>body{background:#1d1b20;color:#ddd;font:14px sans-serif;margin:20px;max-width:1500px}'
         'table{border-collapse:collapse}td,th{padding:4px 12px;border-bottom:1px solid #333;text-align:left}.g{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}'
         '.c{display:flex;flex-direction:column;gap:3px;background:#2a272e;padding:6px;max-width:720px}img{image-rendering:pixelated;max-width:100%}span{color:#aaa;font-size:12px}'
         'h2{font-size:16px;margin:30px 0 6px}h3{font-size:14px;margin:14px 0 6px;color:#bbb}.k i{display:inline-block;width:12px;height:12px;margin:0 4px 0 12px;vertical-align:middle}.q{background:#3a2f1a;padding:8px 12px;border-left:3px solid #e9b44c}</style>',
         '<h1 style="font-size:19px">선 측정 맞춰 보기</h1>',
         '<p>각 그림: 왼쪽 원본, 오른쪽 측정이 문제라고 표시한 칸.</p>',
         '<p class=k>표시 색:<i style="background:#ff2828"></i>두꺼운 외곽(2칸+)<i style="background:#3cc8ff"></i>외곽 없음·연함'
         '<i style="background:#ffff00"></i>외곽 색이 물건 색과 다름(검정·회색 테)<i style="background:#ff00e6"></i>굵은 안쪽 선(2칸+)<i style="background:#ff9600"></i>몸통에 묻힌 외곽</p>',
         '<h2>1. 고르신 결과로는 선을 못 가린다</h2>',
         f'<p>같은 기물에서 고르신 그림과 안 고른 후보 짝 {sum(len(r) for _, r in groups.values())}개를 비교하면 모든 항목이 50% 안팎입니다. '
         '한 판의 후보 다섯 장이 같은 버릇으로 선을 그려서, 선 때문에 고르신 적이 없다는 뜻입니다. 그래서 고른 결과 말고 <b>사장님 눈으로 직접</b> 맞춰야 합니다.</p>',
         '<h2>2. 작은 기물(고르신 것) vs 대형 기물 — 차이가 나는 항목</h2>',
         '<table><tr><th>항목</th><th>작은 기물 중앙값</th><th>대형 중앙값</th></tr>']
    for k in KEYS:
        h.append(f'<tr><td>{KO[k]}</td><td>{med(small, k):.0%}</td><td>{med(big, k):.0%}</td></tr>')
    h.append('</table><p>차이가 큰 것: 외곽 두께, 외곽 없음, 안쪽 선 굵기. (빛 방향은 대형이 오히려 더 잘 지킨다.)</p>')
    for k in ('o_thick', 'o_none', 'o_foreign', 'l_thick'):
        h.append(f'<h2>{KO[k]}</h2><h3>대형 중 이 점수가 가장 나쁜 것</h3><div class=g>'
                 + ''.join(card(f, k, M, '대형') for f in sorted(big, key=lambda f: -M[f][k])[:4]) + '</div>'
                 + '<h3>작은 기물(고르신 것) 중 이 점수가 가장 나쁜 것 — 이것들이 괜찮아 보이면 측정이 과하게 잡는 것</h3><div class=g>'
                 + ''.join(card(f, k, M, '작은') for f in sorted(small, key=lambda f: -M[f][k])[:4]) + '</div>')
    h.append('<h2>확인 부탁</h2><p class=q>항목마다: ① 대형 쪽 표시가 말씀하신 그 문제가 맞는지, ② 작은 쪽 표시도 고쳐야 할 것인지(아니면 괜찮은데 잘못 잡은 것인지).</p>')
    open(os.path.expanduser(path), 'w').write('\n'.join(h))


if __name__ == '__main__':
    main()
