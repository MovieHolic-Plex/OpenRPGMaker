#!/usr/bin/env python3
"""옛 팔레트(jp.pal · modern.pal · school.pal) → modern3.pal 색 대응표를 만든다.
  python3 scripts/content/atlas-pick/make_remap_to_modern3.py     # tiledata/atlas-pick/remap-to-modern3.json 쓰기 + 요약 출력
쓰임: 학원·일본·강남 킷 후보를 modern3 로 자동 재채색 시험한다(png 의 hex → flat[hex]). 반투명 화소(~ - % &)는 자동 대응 없음(unmapped).

원리: 옛 램프마다 「허용 대상 램프」(재료가 같은 modern3 램프 1~3개)를 손으로 정한다(TARGETS). 옛 hex 는 허용 대상 램프들의 색 가운데
Lab 거리(L* 가중 1.3 — 단의 명암 위치를 먼저 맞춘다)가 가장 가까운 것으로 바꾼다. 같은 hex 가 여러 램프에 있으면 그 램프들의 허용 대상 합집합에서 고른다
(그래야 hex → hex 표가 한 값이다). 대응표는 램프 단 위치(램프명 + t)로도 적어 두어 사람이 검토할 수 있다."""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, PAL_DIR
from modern3_check import load_pal

SRC = ['jp.pal', 'modern.pal', 'school.pal']
TARGETS = {
    # 강남(m*)
    'mout': 'sumi yoru', 'masph': 'yoru', 'mconc': 'conc hodo', 'mpave': 'hodo conc', 'mgran': 'conc hodo', 'mbrick': 'renga ita',
    'mtile': 'renga kinari conc', 'mglass': 'garasu', 'mdglass': 'garasu tairu kon', 'mmetal': 'tekko conc', 'mwhite': 'shiro conc',
    'myellow': 'kii', 'mred': 'aka renga', 'mgreen': 'midori ki', 'mblue': 'kon tairu sora', 'mteal': 'garasu midori tairu',
    'mwood': 'ita yuka soil', 'morange': 'daidai', 'mpurple': 'murasaki pinku', 'mnavy': 'kon tairu', 'msoil': 'soil',
    # 일본
    'shu': 'aka renga kawara', 'akachin': 'aka renga kawara', 'ai': 'kon tairu', 'kawara': 'tekko tairu hodo', 'hinoki': 'ita yuka',
    'sumi': 'sumi soil ita', 'washi': 'kinari shiro', 'sakura': 'pinku', 'matsu': 'ki midori', 'moss': 'ki midori soil', 'ishi': 'hodo conc',
    'lacq': 'sumi yoru', 'taxi': 'kii', 'neon': 'neonP', 'neonc': 'neonC', 'kgreen': 'midori', 'korange': 'daidai', 'kblue': 'sora kon',
    'pole': 'tekko hodo', 'kasa': 'garasu tairu',
    # 학원 v5 손 도트 실내
    'vwood': 'ita yuka soil', 'vdwood': 'ita soil', 'vpine': 'yuka ita', 'viron': 'tekko', 'vbrass': 'kii yuka ita', 'vstone': 'hodo conc',
    'vlinen': 'kinari conc', 'vred': 'aka renga', 'vblue': 'sora kon', 'vgreen': 'midori', 'vyellow': 'kii', 'vglass': 'garasu',
    'vblack': 'sumi yoru', 'vwhite': 'shiro conc', 'vleaf': 'ki',
    # 학교 전용
    'kokuban': 'kokuban', 'wboard': 'shiro conc', 'cork': 'yuka ita', 'locker': 'tekko conc', 'cream': 'kinari conc', 'cfloor': 'yuka ita',
    'lino': 'lino', 'gym': 'yuka kii', 'gmat': 'kon sora tairu', 'jersey': 'murasaki pinku', 'fence': 'midori ki', 'undo': 'soil yuka',
    'stile': 'conc shiro garasu', 'tray': 'conc hodo', 'uniform': 'kon tairu',
}
WEAK = 22.0      # Lab 거리(L*×1.3 가중)가 이 이상이면 「대응 약함」

def lab(h):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(h >> 16 & 255), lin(h >> 8 & 255), lin(h & 255)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; y = 0.2126 * r + 0.7152 * g + 0.0722 * b; z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))

def dist(a, b):
    la, lb = lab(a), lab(b)
    return math.sqrt((1.3 * (la[0] - lb[0])) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2)

def hx(c): return '#%06x' % c

def main():
    new = load_pal(os.path.join(PAL_DIR, 'modern3.pal'))
    owner = {c: (n, i) for n, r in new.items() for i, c in enumerate(r)}
    old = {}          # (src, ramp) -> [hex int]
    for f in SRC:
        for n, r in load_pal(os.path.join(PAL_DIR, f)).items(): old[(f, n)] = r
    miss = sorted({n for (_, n) in old} - set(TARGETS))
    if miss: sys.exit('TARGETS 에 없는 옛 램프: ' + ' '.join(miss))
    bad = sorted({t for v in TARGETS.values() for t in v.split()} - set(new))
    if bad: sys.exit('modern3 에 없는 대상 램프: ' + ' '.join(bad))
    # 램프마다 단 순서를 지키는 대응(DP): 뒤 단의 L* 이 앞 단보다 낮아지지 않게(같은 값 허용) 합 거리를 최소화한다.
    rampmap = {}                      # (src, ramp) -> [target hex]
    for (f, n), r in old.items():
        cands = sorted({t for tn in TARGETS[n].split() for t in new[tn]}, key=lambda t: lab(t)[0])
        cost = [[dist(c, t) for t in cands] for c in r]
        INF = 1e9; dp = [[INF] * len(cands) for _ in r]; bk = [[0] * len(cands) for _ in r]
        for j in range(len(cands)): dp[0][j] = cost[0][j]
        for i in range(1, len(r)):
            best = INF; arg = 0
            for j in range(len(cands)):
                if dp[i - 1][j] < best: best, arg = dp[i - 1][j], j
                dp[i][j] = best + cost[i][j]; bk[i][j] = arg
        j = min(range(len(cands)), key=lambda k: dp[-1][k]); out = [0] * len(r)
        for i in range(len(r) - 1, -1, -1):
            out[i] = cands[j]; j = bk[i][j]
        rampmap[(f, n)] = out
    # hex 하나로 찾는 표(flat) — 같은 hex 가 여러 램프에 있어 대응이 갈리면 거리가 가장 작은 쪽을 쓰고 ambiguous 에 적는다.
    flat = {}; err = {}; amb = {}
    for (f, n), r in old.items():
        for c, t in zip(r, rampmap[(f, n)]):
            d = dist(c, t); amb.setdefault(c, {})[t] = amb.get(c, {}).get(t, []) + [n]
            if c not in err or d < err[c]: flat[c] = t; err[c] = d
    ambiguous = [{'from': hx(c), 'chosen': hx(flat[c]), 'others': {hx(t): ns for t, ns in v.items() if t != flat[c]}} for c, v in amb.items() if len(v) > 1]
    by = {}; seen = set()
    for (f, n), r in old.items():
        if n in seen: continue
        seen.add(n)
        rows = []
        for c, t in zip(r, rampmap[(f, n)]):
            rn, i = owner[t]; mid = len(new[rn]) // 2
            rows.append({'from': hx(c), 'to': hx(t), 'step': '%s%+d' % (rn, i - mid), 'dist': round(dist(c, t), 1)})
        by[n] = {'from': f, 'targets': TARGETS[n].split(), 'map': rows}
    allowed = flat
    weak = sorted(({'from': hx(c), 'to': hx(flat[c]), 'step': '%s%+d' % (owner[flat[c]][0], owner[flat[c]][1] - len(new[owner[flat[c]][0]]) // 2),
                    'dist': round(err[c], 1), 'ramps': sorted({n for (_, n), r in old.items() if c in r})} for c in allowed if err[c] >= WEAK), key=lambda w: -w['dist'])
    used = {flat[c] for c in flat}; unused = [hx(c) for c in sorted(set(owner) - used)]
    nonmono = []
    tot = sum(err.values()) / len(err)
    unmapped = [{'entry': '~ #141218 110', 'why': '반투명 그림자(-) — modern3 는 반투명 없음. 바닥·벽 위 화소는 합성한 뒤 아래 램프를 2단 내려 굽는다(자동 아님)'},
                {'entry': '- #141218 58', 'why': '반투명 그림자 번짐 — 같은 방식, 1단 내려 굽는다'},
                {'entry': '% #fff8d0 120', 'why': '반투명 불빛 번짐 — 아래 램프를 +1~2단 올려 굽는다'},
                {'entry': '& #cfe8f0 96', 'why': '(학원) 반투명 유리 반사 — garasu +1~2 로 굽는다'},
                {'entry': '# #e040c0', 'why': '실루엣 표시 마커 — 최종본에 남으면 안 된다(대응 없음)'}]
    doc = {'about': '옛 팔레트 → modern3 색 대응. flat[hex] 로 png 를 재채색한다. 반투명(unmapped)은 합성 후 굽기 필요. 근거 tiledata/atlas-pick/modern-style-bible.md',
           'sources': SRC, 'target': 'modern3.pal', 'weakDist': WEAK,
           'stats': {'oldRamps': len(seen), 'oldColors': len(flat), 'newColorsUsed': len(used), 'newColorsTotal': len(owner), 'meanDist': round(tot, 1),
                     'weakCount': len(weak), 'ambiguousHex': len(ambiguous), 'nonMonotoneRamps': nonmono, 'unusedNewColors': unused},
           'ambiguous': ambiguous, 'flat': {hx(c): hx(flat[c]) for c in sorted(flat)}, 'byRamp': by, 'weak': weak, 'unmapped': unmapped}
    p = os.path.join(BASE, 'remap-to-modern3.json')
    open(p, 'w', encoding='utf-8').write(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    print(p); s = doc['stats']
    print('옛 램프 %d · 옛 색 %d → modern3 %d색 사용(전체 %d) · 평균 거리 %.1f · 약한 대응 %d · 램프 안 단조(DP 보장) · 램프 갈림 hex %d · 안 쓰인 modern3 색 %d'
          % (s['oldRamps'], s['oldColors'], s['newColorsUsed'], s['newColorsTotal'], s['meanDist'], s['weakCount'], len(ambiguous), len(unused)))
    for w in weak[:14]: print('  약함 %s → %s (%s) d=%.1f  %s' % (w['from'], w['to'], w['step'], w['dist'], ','.join(w['ramps'])))

if __name__ == '__main__':
    main()
