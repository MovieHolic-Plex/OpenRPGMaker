# REFMAP 통계 추출: 표본(samples 50개)과 정답지 REFMAP 12종을 칸 크기 16·32·48 로 환산해 재고, 재료·종류별 분위수를 낸다.
# 저장소 루트에서: python3 scripts/content/pixel-harness/refstats.py  → tiledata/pixel-harness/refmap-stats.json (수치만)
# 48→T 환산: 그림을 LANCZOS 로 T/48 배 줄인 뒤 잰다(「REFMAP 을 T px 로 그렸다면」). 길이 지표는 ×T/48, 넓이는 ×(T/48)² 로
# 같은 값이 나오는지 native(48) 대 환산본으로 따로 적는다(conversion).
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_io as io, pxmetrics as pm

TILES = (16, 32, 48)
METRICS = ['orphans.rate', 'jaggies.per100', 'jaggies.stair_regular', 'banding.ratio', 'shading.pillow',
           'shading.light_angle', 'shading.light_strength', 'shading.light_dev', 'shading.light_inconsistent',
           'palette.unique', 'palette.effective', 'palette.ramp_steps', 'palette.clump_median', 'palette.clump_p90',
           'palette.clump_single', 'palette.hue_shift', 'palette.hue_shift_abs', 'palette.dark_cooler',
           'saturation.s_median', 'saturation.s_p90', 'saturation.chroma_median', 'outline.edge_ratio', 'outline.edge_black',
           'outline.line_frac', 'outline.joint_contrast', 'noise.rms', 'noise.ac1', 'noise.speckle', 'noise.speckle_lone', 'noise.speckle_cover',
           'dither.ratio', 'semi_alpha']

def flat(m):
    out = {}
    for k in METRICS:
        v = m
        for part in k.split('.'):
            v = v.get(part) if isinstance(v, dict) else None
        if isinstance(v, bool): v = float(v)
        out[k] = v
    return out

def measure_ref(entry, T):
    im = io.rescale(io.load_image(entry), 48, T)
    return pm.measure(io.arr(im), T, entry.get('surface', False))

def quant(vals):
    v = np.array([x for x in vals if x is not None and np.isfinite(x)], float)
    if len(v) == 0: return None
    p = np.quantile(v, [0.05, 0.25, 0.5, 0.75, 0.95])
    return dict(n=int(len(v)), min=round(float(v.min()), 4), p5=round(float(p[0]), 4), p25=round(float(p[1]), 4),
                p50=round(float(p[2]), 4), p75=round(float(p[3]), 4), p95=round(float(p[4]), 4), max=round(float(v.max()), 4),
                mean=round(float(v.mean()), 4))

OUTSIDE = {'roof', 'facade', 'ground'}   # 바깥 재료: 제 무리(재료·재료/종류)에만 넣는다 — all·object·surface(실내 범위)는 그대로

def groups(rows):
    """rows: [(material, kind, flat)] → 무리 이름 → 지표 → 분위수. 무리: all, kind, material, material/kind.
    바깥 재료(OUTSIDE)는 all·kind 무리에 섞지 않는다. 섞으면 모든 재료의 종류 단계 범위(명암 띠·들쭉날쭉 등)가 바뀐다."""
    keys = {}
    for mat, kind, f in rows:
        for g in ((mat, f'{mat}/{kind}') if mat in OUTSIDE else ('all', kind, mat, f'{mat}/{kind}')):
            keys.setdefault(g, []).append(f)
    return {g: {k: quant([f[k] for f in fs]) for k in METRICS} for g, fs in keys.items()}

def main():
    G = io.golden()
    res = dict(version=1, tool='pxmetrics', metricsVersion=pm.VERSION,
               note='REFMAP 실내 팩(48px, 붓 그림)을 16·32·48 칸으로 환산해 잰 분위수. 표본 50개로 범위를 만들고 정답지 REFMAP 12종은 범위 밖 시험용.',
               conversion=dict(rule='그림을 LANCZOS 로 T/48 배 줄인 뒤 잰다. 크기 의존 매개변수는 k=T/32 로 늘이고 줄인다: 띠 폭 상한 6k, 그늘 띠 3k, 조각 최소 넓이 40k², 블록 8k, 선 검출 창 5k.',
                               lengths='길이(띠 폭·그늘·블록) ×T/48, 넓이(덩어리) ×(T/48)². 덩어리 넓이는 32px 기준으로 환산해 보고한다(clump_* 는 이미 ÷k²).'),
               tiles={}, samples={}, golden={})
    for T in TILES:
        rows = []
        for s in G['samples']:
            f = flat(measure_ref(s, T)); kind = 'surface' if s.get('surface') else 'object'
            rows.append((s['material'], kind, f)); res['samples'].setdefault(s['id'], dict(material=s['material'], kind=kind))[str(T)] = f
        grows = []
        for e in G['golden']:
            r = e['refmap']; f = flat(measure_ref(r, T)); kind = 'surface' if r.get('surface') else 'object'
            grows.append((e['material'], kind, f)); res['golden'].setdefault(e['id'], dict(material=e['material'], kind=kind))[str(T)] = f
        res['tiles'][str(T)] = dict(samples=groups(rows), withGolden=groups(rows + grows))
        print('tile', T, 'done', flush=True)
    # 환산 점검: native 48 에서 잰 덩어리 넓이(32 기준 환산값)와 32 로 줄여 잰 값의 중앙값 비
    conv = {}
    for k in ('palette.clump_median', 'palette.clump_p90', 'banding.ratio', 'noise.speckle', 'orphans.rate', 'jaggies.per100'):
        a = res['tiles']['48']['samples']['all'][k]; b = res['tiles']['32']['samples']['all'][k]
        conv[k] = dict(native48_p50=a and a['p50'], down32_p50=b and b['p50'])
    res['conversion']['check'] = conv
    out = os.path.join(io.ROOT, 'tiledata/pixel-harness/refmap-stats.json')
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
    print(out)

if __name__ == '__main__':
    main()
