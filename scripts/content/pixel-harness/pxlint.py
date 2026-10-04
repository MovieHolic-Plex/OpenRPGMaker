#!/usr/bin/env python3
# 픽셀 규칙 검사기(pxlint). 그림 한 장 → 항목별 수치 · REFMAP 범위 대비 합/불 · 결함 좌표 · 4배 오버레이.
#
#   python3 scripts/content/pixel-harness/pxlint.py IMAGE.png [--rect x0,y0,x1,y1] [--tile 48] [--material wood]
#          [--kind object|surface|auto] [--json out.json] [--overlay out.png] [--scale 4] [--stats refmap-stats.json] [--quiet]
#
# 종료 코드: 0 = 전 항목 합격, 1 = 불합격 항목 있음, 2 = 입력 오류.
# 범위: tiledata/pixel-harness/refmap-stats.json 의 표본(samples) 분위수. 목표 해상도는 48px(2026-09-29 사용자 결정) — 기본 --tile 48 은
# REFMAP 원본을 환산 없이 잰 범위다. --tile 32/16 은 REFMAP 을 줄여 잰 환산 범위(옛 32px 견본·v5 검사용 선택 옵션).
# 출력 JSON 스키마는 tiledata/pixel-harness/README.md 「pxlint 출력」 절.
import os, sys, json, argparse, math
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxmetrics as pm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
STATS = os.path.join(ROOT, 'tiledata/pixel-harness/refmap-stats.json')
MATERIALS = ('wood', 'stone', 'cloth', 'metal', 'plant', 'ceramic', 'glass', 'roof', 'facade', 'ground')   # 뒤 셋 = 바깥(마을) 재료

# id, 한글, 지표, 방향(hi=위만 막음, lo=아래만, both), 무리 단계(kind|material), 적용(object|surface|all), 절대 여유(floor)
CHECKS = [
    dict(id='orphans', ko='외톨이 화소', metric='orphans.rate', side='hi', level='kind', applies='all', floor=0.01, defects='orphans'),
    dict(id='jaggies', ko='들쭉날쭉 선', metric='jaggies.per100', side='hi', level='kind', applies='all', floor=1.5, defects='jaggies'),
    dict(id='banding', ko='명암 띠(계단 등고선)', metric='banding.ratio', side='hi', level='kind', applies='all', floor=0.03, defects='banding'),
    dict(id='pillow', ko='베개 명암', metric='shading.pillow', side='hi', level='material', applies='all', floor=0.05, defects='pillow'),
    dict(id='colors', ko='색 수 과다', metric='palette.effective', side='hi', level='kind', applies='all', floor=3, defects=None),
    dict(id='saturation', ko='채도 이탈(과채도)', metric='saturation.s_median', side='hi', level='material', applies='all', floor=0.05, defects=None),
    dict(id='outline', ko='윤곽선 대비(검은 윤곽)', metric='outline.edge_ratio', side='lo', level='kind', applies='object', floor=0.05, defects='outline'),
    dict(id='outline_black', ko='윤곽 검정 비율', metric='outline.edge_black', side='hi', level='kind', applies='object', floor=0.05, defects='outline'),
    dict(id='joints', ko='줄눈·이음 대비', metric='outline.joint_contrast', side='hi', level='material', applies='surface', floor=0.04, defects='joints'),
    dict(id='light', ko='빛 방향 불일치', metric='shading.light_dev', side='rule', level='kind', applies='all', floor=0, defects='light'),
    dict(id='noise', ko='균일 잡음 결', metric='noise.speckle_lone', side='hi', level='material', applies='all', floor=0.03, defects='noise'),
    dict(id='dither', ko='체크 디더', metric='dither.ratio', side='hi', level='kind', applies='all', floor=0.01, defects='dither'),
]
COLORS = dict(orphans=(255, 40, 40), jaggies=(255, 60, 230), banding=(255, 220, 0), pillow=(0, 230, 255), light=(255, 150, 0),
              noise=(80, 255, 80), outline=(80, 120, 255), dither=(255, 255, 255), joints=(255, 120, 200))

def get(m, dotted):
    v = m
    for p in dotted.split('.'):
        v = v.get(p) if isinstance(v, dict) else None
    return v

def load_stats(path=STATS):
    return json.load(open(path))

def stat_group(stats, tile, material, kind, level, metric):
    """가까운 칸 크기의 표본 분위수. 무리에 5개 미만이면 한 단계 넓힌다: material/kind → kind → all."""
    T = min(stats['tiles'], key=lambda t: abs(int(t) - tile))
    S = stats['tiles'][T]['samples']
    chain = ([f'{material}/{kind}', kind, 'all'] if level == 'material' else [kind, 'all'])
    for g in chain:
        if g in S and S[g].get(metric) and S[g][metric]['n'] >= 5:
            return int(T), g, S[g][metric]
    return int(T), None, None

def bounds(qd, side, floor):
    iqr = qd['p75'] - qd['p25']
    hi = max(qd['p95'] + 0.5 * iqr, qd['max'] * 1.05, qd['p50'] + floor)
    lo = min(qd['p5'] - 0.5 * iqr, qd['min'] * 0.95, qd['p50'] - floor)
    return (lo if side in ('lo', 'both') else None), (hi if side in ('hi', 'both') else None)

def lint_array(a, tile=48, material=None, kind='auto', stats=None, keep_defects=True):
    """a: RGBA 배열. 결과 dict(스키마는 README)."""
    stats = stats or load_stats()
    if kind == 'auto':
        kind = 'surface' if (a[..., 3] >= 255).all() else 'object'
    m = pm.measure(a, tile, kind == 'surface')
    mat = material or 'all'
    checks = []
    for ck in CHECKS:
        if ck['applies'] != 'all' and ck['applies'] != kind: continue
        v = get(m, ck['metric'])
        T, grp, qd = stat_group(stats, tile, mat, kind, ck['level'], ck['metric'])
        row = dict(id=ck['id'], ko=ck['ko'], metric=ck['metric'], value=v, statTile=T, group=grp)
        if ck['side'] == 'rule':
            st = get(m, 'shading.light_strength')
            row['range'] = [None, pm.LIGHT_TOL]; row['strength'] = st; row['minStrength'] = pm.LIGHT_MIN
            if material == 'glass':
                row['pass'] = True; row['skipped'] = '유리·광원은 빛 방향을 재지 않는다'
            elif v is None or st is None or st < pm.LIGHT_MIN:
                row['pass'] = True; row['skipped'] = '명암 기울기가 약해 방향 없음'
            else:
                row['pass'] = bool(v <= pm.LIGHT_TOL)
        elif v is None or qd is None:
            row['range'] = None; row['pass'] = True; row['skipped'] = '값 없음(면적 부족)' if v is None else '범위 없음'
        else:
            lo, hi = bounds(qd, ck['side'], ck['floor'])
            row['range'] = [None if lo is None else round(lo, 4), None if hi is None else round(hi, 4)]
            row['ref'] = dict(n=qd['n'], p5=qd['p5'], p50=qd['p50'], p95=qd['p95'])
            row['pass'] = bool((lo is None or v >= lo) and (hi is None or v <= hi))
        dk = ck['defects']
        if dk:
            src = {'orphans': m['orphans'], 'jaggies': m['jaggies'], 'banding': m['banding'], 'noise': m['noise'],
                   'outline': m['outline'], 'dither': m['dither']}.get(dk)
            if dk in ('pillow', 'light'):
                d = [x for x in m['shading']['defects'] if x[-1] == dk]
                if not d and kind == 'object':        # 물체 전체 점수로 걸렸으면 몸 상자
                    ys, xs = np.nonzero(a[..., 3] >= 200)
                    if len(ys): d = [[int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, dk]]
            elif dk == 'joints':
                d = m['outline'].get('line_defects', [])
            else:
                d = (src or {}).get('defects', [])
            row['defectCount'] = len(d)
            if keep_defects and not row['pass']: row['defects'] = d
        checks.append(row)
    failed = [c['id'] for c in checks if not c['pass']]
    strip = lambda d: {k: (strip(v) if isinstance(v, dict) else v) for k, v in d.items() if k not in ('defects', 'line_defects')}
    return {'tool': 'pxlint', 'version': 1, 'metricsVersion': pm.VERSION, 'tile': tile, 'material': material, 'kind': kind, 'pass': not failed, **dict(
                size=m['size'], failed=failed, checks=checks, metrics=strip(m))}

def overlay(a, res, scale=4, bg=(40, 38, 44)):
    """결함을 4배 확대 그림 위에 표시. 불합격 항목만 그린다(합격 항목의 결함 후보는 README 참고)."""
    im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    base = Image.new('RGBA', im.size, bg + (255,)); base.alpha_composite(im)
    big = base.resize((im.width * scale, im.height * scale), Image.NEAREST)
    lay = Image.new('RGBA', big.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    s = scale
    for c in res['checks']:
        if c['pass'] or not c.get('defects'): continue
        col = COLORS.get(c['id'].split('_')[0], (255, 255, 255)); ca = col + (255,)
        for df in c['defects'][:1500]:
            if c['id'] == 'banding':
                x0, y0, x1, y1 = df[:4]; d.rectangle([x0 * s, y0 * s, (x1 + 1) * s - 1, (y1 + 1) * s - 1], outline=col + (200,))
            elif len(df) >= 4 and isinstance(df[2], (int, float)) and c['id'] in ('pillow', 'light', 'noise') and len(df) == 5:
                x0, y0, x1, y1 = df[:4]; d.rectangle([x0 * s, y0 * s, x1 * s - 1, y1 * s - 1], outline=ca, width=2)
            elif c['id'] == 'joints':
                x, y = df[0], df[1]; d.rectangle([x * s + 1, y * s + 1, x * s + s - 2, y * s + s - 2], fill=col + (110,))
            else:
                x, y = df[0], df[1]
                d.rectangle([x * s, y * s, x * s + s - 1, y * s + s - 1], outline=ca, width=max(1, s // 4))
    big.alpha_composite(lay)
    return big

def load_input(path, rect=None):
    im = Image.open(path).convert('RGBA')
    if rect: im = im.crop(tuple(rect))
    return np.array(im).astype(np.float64)

def main(argv=None):
    ap = argparse.ArgumentParser(description='도트 픽셀 규칙 검사기 (REFMAP 범위 대비)')
    ap.add_argument('image'); ap.add_argument('--rect', help='x0,y0,x1,y1 (x1·y1 제외)')
    ap.add_argument('--tile', type=int, default=48, help='그림의 칸 크기 px. 기본 48(목표 해상도, REFMAP 원본 범위 그대로). 32·16 을 주면 REFMAP 을 그 크기로 줄여 잰 환산 범위를 쓴다(선택)')
    ap.add_argument('--material', choices=MATERIALS, help='재료 범주 — 채도·색 수·줄눈·잡음 범위를 재료별로 고른다')
    ap.add_argument('--kind', choices=('auto', 'object', 'surface'), default='auto', help='object=투명 배경 물체, surface=칸을 꽉 채운 바닥·벽')
    ap.add_argument('--json'); ap.add_argument('--overlay'); ap.add_argument('--scale', type=int, default=4)
    ap.add_argument('--stats', default=STATS); ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args(argv)
    try:
        rect = [int(v) for v in a.rect.split(',')] if a.rect else None
        arr = load_input(a.image, rect)
    except Exception as e:
        print('입력 오류:', e, file=sys.stderr); return 2
    res = lint_array(arr, a.tile, a.material, a.kind, load_stats(a.stats))
    res['input'] = a.image; res['rect'] = rect
    if a.overlay:
        overlay(arr, res, a.scale).save(a.overlay); res['overlay'] = a.overlay
    out = json.dumps(res, ensure_ascii=False, indent=1, default=float)
    if a.json: open(a.json, 'w').write(out)
    if not a.quiet:
        print(f"{a.image} {res['kind']} tile={a.tile} material={a.material} → {'합격' if res['pass'] else '불합격: ' + ', '.join(res['failed'])}")
        for c in res['checks']:
            rg = c.get('range'); rs = '-' if not rg else f"[{'' if rg[0] is None else rg[0]}, {'' if rg[1] is None else rg[1]}]"
            print(f"  {'OK ' if c['pass'] else 'BAD'} {c['ko']:<16} {c['value']!s:<9} 범위 {rs:<18} 결함 {c.get('defectCount', '-')}{'  (' + c['skipped'] + ')' if c.get('skipped') else ''}")
    return 0 if res['pass'] else 1

if __name__ == '__main__':
    sys.exit(main())
