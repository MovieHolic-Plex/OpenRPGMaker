# 검사기 교정: 정답지 REFMAP 12종(표본 밖) · 표본 50개(표본 안) · 우리 후보 33개를 pxlint 로 돌려 합/불과 결함 수를 모은다.
# 저장소 루트에서: python3 scripts/content/pixel-harness/calibrate.py
#   → tiledata/pixel-harness/calibration.json (수치만)  + 표준 출력에 마크다운 표
#   --viz 를 주면 오버레이 PNG 를 저장소 밖 ~/.local/share/oprn/pixel-harness/overlays/ 에 쓴다(REFMAP 오버레이 포함).
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_io as io, pxlint

OVL = os.path.join(io.SCRATCH, 'overlays')

def run(entry, material, tile_to=None, save=None):
    im = io.load_image(entry); T = entry['tile']
    if tile_to and tile_to != T:
        im = io.rescale(im, T, tile_to); T = tile_to
    a = io.arr(im)
    kind = 'surface' if entry.get('surface') else 'object'
    res = pxlint.lint_array(a, T, material, kind, STATS)
    if save:
        pxlint.overlay(a, res, 4).save(save)
    return res

def brief(res):
    return dict(passed=res['pass'], failed=res['failed'],
                values={c['id']: c['value'] for c in res['checks']},
                ranges={c['id']: c.get('range') for c in res['checks']},
                defects={c['id']: c.get('defectCount') for c in res['checks'] if c.get('defectCount') is not None})

def main():
    global STATS
    STATS = pxlint.load_stats()
    viz = '--viz' in sys.argv
    if viz: os.makedirs(OVL, exist_ok=True)
    G = io.golden()
    out = dict(version=1, note='REFMAP32 = REFMAP 을 32px 로 줄여 32 범위로 검사(표본 밖). REFMAP48 = 원본 48px 을 48 범위로. 우리 그림은 제 칸 크기로.',
               golden=[], samples={})
    for e in G['golden']:
        row = dict(id=e['id'], ko=e['ko'], material=e['material'])
        row['refmap32'] = brief(run(e['refmap'], e['material'], 32, save=os.path.join(OVL, f"ref32-{e['id']}.png") if viz else None))
        row['refmap48'] = brief(run(e['refmap'], e['material'], None))
        row['ours'] = []
        for o in e['ours']:
            name = o['set'] + ('-' + o['variant'] if o.get('variant') else '')
            r = run(o, e['material'], None, save=os.path.join(OVL, f"{name}-{e['id']}.png") if viz else None)
            row['ours'].append(dict(set=name, **brief(r)))
        out['golden'].append(row)
        print(e['id'], 'ref32', row['refmap32']['failed'], 'ref48', row['refmap48']['failed'],
              ' | '.join(f"{o['set']}:{','.join(o['failed']) or 'OK'}" for o in row['ours']), flush=True)
    out['extras'] = []
    for e in G.get('extras', []):
        row = dict(id=e['id'], ko=e['ko'], material=e['material'], ours=[])
        for o in e['ours']:
            r = run(o, e['material'], None, save=os.path.join(OVL, f"{o['set']}-x-{e['id']}.png") if viz else None)
            row['ours'].append(dict(set=o['set'], **brief(r)))
        out['extras'].append(row)
        print('extra', e['id'], ' | '.join(f"{o['set']}:{','.join(o['failed']) or 'OK'}" for o in row['ours']), flush=True)
    for s in G['samples']:
        out['samples'][s['id']] = brief(run(s, s['material'], 32))['failed']
    # 집계
    ids = [c['id'] for c in pxlint.CHECKS]
    def rate(rows): return round(sum(1 for r in rows if r['passed']) / max(1, len(rows)), 3)
    out['summary'] = dict(
        refmap32_pass=rate([g['refmap32'] for g in out['golden']]),
        refmap48_pass=rate([g['refmap48'] for g in out['golden']]),
        samples32_pass=round(sum(1 for v in out['samples'].values() if not v) / len(out['samples']), 3),
        refmap48_check_fail={i: sum(i in g['refmap48']['failed'] for g in out['golden']) for i in ids},
        refmap32_check_fail={i: sum(i in g['refmap32']['failed'] for g in out['golden']) for i in ids},
        samples32_check_fail={i: sum(i in v for v in out['samples'].values()) for i in ids},
        ours_check_fail={s: {i: sum(1 for g in out['golden'] for o in g['ours'] if o['set'] == s and i in o['failed']) for i in ids}
                         for s in sorted({o['set'] for g in out['golden'] for o in g['ours']})},
        ours_count={s: sum(1 for g in out['golden'] for o in g['ours'] if o['set'] == s) for s in sorted({o['set'] for g in out['golden'] for o in g['ours']})})
    json.dump(out, open(os.path.join(io.ROOT, 'tiledata/pixel-harness/calibration.json'), 'w'), ensure_ascii=False, indent=1, default=float)
    S = out['summary']
    print('\nREFMAP 정답지 합격률: 48px 원본(기준)', S['refmap48_pass'], '/ 32px 환산', S['refmap32_pass'], '/ 표본(32, 표본 안)', S['samples32_pass'])
    print(f'| 항목 | REFMAP48 불합격 (12) | REFMAP32 불합격 (12) | 표본 불합격 ({len(out["samples"])}) | ' + ' | '.join(f"{s} 불합격 ({S['ours_count'][s]})" for s in S['ours_check_fail']) + ' |')
    print('|---|---|---|---|' + '---|' * len(S['ours_check_fail']))
    for c in pxlint.CHECKS:
        i = c['id']
        print(f"| {c['ko']} | {S['refmap48_check_fail'][i]} | {S['refmap32_check_fail'][i]} | {S['samples32_check_fail'][i]} | " + ' | '.join(str(S['ours_check_fail'][s][i]) for s in S['ours_check_fail']) + ' |')

if __name__ == '__main__':
    main()
