#!/usr/bin/env python3
"""[fix4 파생본: 장소 31곳 기준] 9단계 도달성 증명. 지도 칸의 통행 판정 위에서 BFS 로 막별 도달 영역을 구하고, 설계서의 막 구분과 대조한다.

  python3 journey_check_v9.py            # 표준출력 + journey-check-v9.txt, 불일치가 있으면 종료코드 1

통행 판정(journey_world_v9.base_walk):
  걷기  = 땅 칸 중 산·절벽(높이 차)·강·협곡·바다·사구가 아닌 칸. 다리·경사로·장소 발자국은 열림. 숲은 느리지만 걷는다.
  관문  = 고갯길 요새 발자국은 통행증이 있을 때만 열림.
  배    = 바다 칸 이동. 내해 항구에서 타고, 걸을 수 있고 높이 0 인 해안 어디서나 내림(절벽·사구·산 해안은 못 내림).
  사막선 = 걷기 + 사구 칸 이동.
  비공정 = 어디든 + 천공섬 발판.
"""
import sys
from pathlib import Path

import numpy as np

import journey_world_v9 as J
import journey_plan_v9 as P

HERE = Path(__file__).resolve().parent
ORDER = ['pass', 'ship', 'skiff', 'air']
ACT_NAMES = [a['name'] for a in J.ACTS]


# 바다 장벽 최소 폭(칸). 실제 지리(kit_realgeo)는 kit_gen.generate 가 2 로 낮춘다 — 영국 해협·쓰시마 해협처럼
# 실제 해협은 칸 한두 개라 4 를 고집하면 브리튼·유럽·지중해가 다 실패했다. 물은 어차피 걸어서 못 건넌다(막 검사가 따로 본다).
MIN_SEA_GAP = [4]


def run(verbose=True, w=None, out_path=None):
    w = w if w is not None else J.World()   # [worldmap-kit] 이미 만든 세계(지도 JSON 에서 복원한 것 포함)를 받을 수 있다
    out = []
    bad = []

    def say(s=''):
        out.append(s)
        if verbose:
            print(s)

    say('=== 9단계 여정 도달성 검사 ===')
    say('시작 지점 %s (%s 안)' % (J.START, P.START_PLACE))
    say('')
    names = [p[0] for p in P.PLACES]
    # 1) 막별 새로 닿는 장소
    say('[1] 막별 도달 영역(수단을 하나씩 더해 BFS)')
    prev = np.zeros_like(w.reach[0])
    stage_places = {}
    for k, r in enumerate(w.reach):
        got = [n for n in names if w.place_stage(n) is not None and w.place_stage(n) <= k]
        new = [n for n in names if w.place_stage(n) == k]
        stage_places[k] = new
        means = ' + '.join(J.MEANS[m]['name'] for m in ORDER[:k]) or '(수단 없음, 걸어서만)'
        say('  R%d  %-20s 수단: %-34s 땅/발판 칸 %5d (+%d)  닿는 장소 %2d (+%d)' % (
            k, J.ACTS[k]['name'], means, int((r & ~w.sea).sum()), int((r & ~prev).sum()), len(got), len(new)))
        prev = r.copy()
    say('')
    # 2) 설계서 정답표와 대조
    say('[2] 설계서(막 구분표)와 BFS 결과 대조')
    ok = True
    for n in names:
        exp, got = P.EXPECT_STAGE[n], w.place_stage(n)
        flag = 'OK ' if exp == got else 'XX '
        if exp != got:
            ok = False
            bad.append('막 불일치: %s 설계 %s막 / BFS %s막' % (n, exp + 1, None if got is None else got + 1))
        say('  %s%-10s 설계 %d막  BFS %s막' % (flag, n, exp + 1, '-' if got is None else got + 1))
    say('  => %s' % ('설계서와 일치(%d곳 전부)' % len(names) if ok else '불일치 있음'))
    say('')
    # 3) 열쇠 장소 조건
    say('[3] 수단을 얻는 장소는 그 수단 이전 영역에서 닿고, 그 수단 없이는 처음부터 최종에 못 닿는다')
    for k, m in enumerate(ORDER):
        src, act = P.MEANS_SOURCE[m]
        st = w.place_stage(src)
        # 수단 m 을 얻기 전 영역 = R_k (k = 이 수단 이전에 가진 수단 수)
        in_prev = st is not None and st <= k
        first_here = st == k
        flag = 'OK ' if in_prev and first_here and st == act else 'XX '
        if flag == 'XX ':
            bad.append('열쇠 장소 조건: %s → %s (R%s)' % (m, src, st))
        say('  %s%-6s ← %-8s : %s 에서 처음 닿음(R%s), 이전 수단 %d개로 닿음=%s' % (
            flag, J.MEANS[m]['name'], src, ACT_NAMES[st] if st is not None else '-', st, k, in_prev))
    fin = P.FINAL
    for k in range(4):
        reach_fin = any(w.reach[k][y, x] for (x, y) in P.fp(w, fin))
        flag = 'OK ' if not reach_fin else 'XX '
        if reach_fin:
            bad.append('최종 장소가 R%d 에서 이미 닿는다' % k)
        say('  %s%s 는 R%d(수단 %d개) 에서 %s' % (flag, fin, k, k, '닿지 않는다' if not reach_fin else '닿는다(불일치)'))
    reach_fin4 = any(w.reach[4][y, x] for (x, y) in P.fp(w, fin))
    say('  %s%s 는 R4(수단 4개)에서 닿는다=%s' % ('OK ' if reach_fin4 else 'XX ', fin, reach_fin4))
    if not reach_fin4:
        bad.append('최종 장소가 비공정으로도 안 닿는다')
    say('')
    # 4) 수단을 하나씩만 쥐었을 때: 어떤 장벽이 무엇을 가두는가
    say('[4] 수단을 하나씩만 쥐었을 때 걸어서 닿는 장소 — 각 장벽이 지도에서 실제로 가두는 땅')
    full = w.reach_with(ORDER)

    def places_of(r):
        out_ = []
        for n in names:
            cells = P.fp(w, n)
            if any(r[y, x] for (x, y) in cells) or (n == J.GATE_SITE and any(r[b, a] for (x, y) in cells for a, b in J.neighbors4(x, y))):
                out_.append(n)
        return out_
    base_p = set(places_of(w.reach[0]))
    say('  - 수단 없음: %d곳' % len(base_p))
    for m in ORDER:
        r = w.reach_with([m])
        gain = sorted(set(places_of(r)) - base_p)
        say('  - %s 만: +%d곳 %s' % (J.MEANS[m]['name'], len(gain), ', '.join(gain) if gain else ''))
    say('  (통행증 없이 배만 쥐면 해안 상륙으로 관문을 돌아가므로 ①이 뚫린다 — 배를 얻는 곳(정글 마을)이 관문 안쪽에 있어 순서가 지켜진다. 이 순서 의존은 [3]이 증명한다.)')
    say('')
    # 5) 처음부터 걸어서
    r0 = w.reach[0]
    walk_places = places_of(r0)
    say('[5] 수단 없이 시작 마을에서 걸어서 닿는 장소(%d곳): %s' % (len(walk_places), ', '.join(walk_places)))
    must_not = list(P.CFG['must_not_walk'])
    for n in must_not:
        if n in walk_places:
            bad.append('걸어서 처음부터 닿으면 안 되는 곳이 닿는다: ' + n)
    say('  처음부터 걸어서 못 닿아야 할 %d곳이 모두 막혀 있다=%s' % (len(must_not), all(n not in walk_places for n in must_not)))
    say('')
    # 6) 장벽 두께
    bn = P.barrier_numbers(w)
    say('[6] 장벽 두께(지도 칸)')
    say('  ① 산벽: 관문 행을 뺀 %d행에서 서쪽 땅과 동쪽 땅 사이 막힌 칸 최소 %d칸(y=%s). 관문(고갯길 요새) 폭 %d칸, 틈은 이 관문 하나.' % (
        bn['mount_wall_rows'], bn['mount_wall_min_thickness'], bn['mount_wall_min_row'], bn['gate_width']))
    say('  ② 바다: 서대륙~동대륙 최단 바다 %s칸 (%s 부근)' % (bn['sea_gap'], bn['sea_gap_at']))
    say('  ③ 대사막 사구 바다: 사구 %d칸. 걸어서 닿는 땅에서 사구를 건너야 하는 폭 — %s' % (
        bn['dune_cells'], ', '.join('%s %d칸' % kv for kv in sorted(bn['dune_depth_to'].items()))))
    say('  ④ 하늘: 천공섬은 가장 가까운 땅에서 바다 %d칸 떨어진 바다 위 발판(배·사막선으로 닿지 못함)' % bn['sky_gap'])
    if bn['mount_wall_min_thickness'] < 2:
        bad.append('산벽 최소 두께 2칸 미만')
    if bn['sea_gap'] is None or bn['sea_gap'] < MIN_SEA_GAP[0]:
        bad.append('바다 장벽이 너무 좁다')
    say('')
    # 7) 첫 화면
    ov = P.opening_view(w)
    x0, y0, x1, y1 = ov['box']
    say('[7] 시작 화면(%dx%d칸, x %d~%d, y %d~%d)에 들어오는 장소' % (J.WINDOW[0], J.WINDOW[1], x0, x1, y0, y1))
    for n, a, b in ov['places']:
        say('  - %-10s (%d/%d칸 보임) %s' % (n, a, b, '← 이후 막의 장소(먼 곳)' if P.PLACE[n][1] >= 1 else ''))
    vis = {n for n, a, b in ov['places']}
    for need in P.CFG['opening_must_see']:
        if need not in vis:
            bad.append('첫 화면에 안 보임: ' + need)
    if not (vis & set(P.CFG['opening_far'])):
        bad.append('첫 화면에 다음 막의 먼 곳(거대한 탑)이 안 보임')
    say('')
    # 8) 줄거리 선: 각 구간이 그 막의 수단으로 실제로 이어지는가
    say('[8] 줄거리 선(%d구간)이 그 막의 수단만으로 지도 위에서 이어지는가' % (len(P.MAIN_LINE) - 1))
    legs = P.main_line_legs(w)
    for lg in legs:
        p = lg['path']
        modes = sorted({c[2] for c in p}) if p else []
        flag = 'OK ' if p else 'XX '
        if not p:
            bad.append('줄거리 구간 끊김: %s → %s' % (lg['a'], lg['b']))
        say('  %s%-10s → %-10s 수단 %d개로 이동 %s  경로 %s칸' % (flag, lg['a'], lg['b'], lg['stage'], '/'.join(modes), len(p) if p else '-'))
    say('')
    # 9) 길(그려진 도로)이 장벽을 가로지르지 않는가
    say('[9] 지도에 그려진 길 %d줄이 걷는 칸 위에만 있고, 양 끝이 같은 막에 있는가' % len(w.paths))
    nbad = 0
    for name, cells in w.paths:
        a_, b_ = P.route_ends()[name]
        on_wall = [c for c in cells if not (w.walk0[c[1], c[0]] or (c[0], c[1]) in w.bridge)]
        sa = w.place_stage(a_) if a_ in P.PLACE else None
        sb = w.place_stage(b_) if b_ in P.PLACE else None
        if on_wall or (sa is not None and sb is not None and sa != sb and J.GATE_SITE not in (a_, b_)):
            nbad += 1
            bad.append('길이 장벽을 지난다: %s (막히는 칸 %d, 막 %s/%s)' % (name, len(on_wall), sa, sb))
    say('  장벽을 지나는 길 %d줄 => %s' % (nbad, 'OK' if nbad == 0 else 'XX'))
    say('')
    # 10) 어디서도 닿지 않는 걸을 수 있는 칸(정직한 기록)
    import scipy.ndimage as ndi
    left = (w.walk0 | w.dune) & (w.M.G >= 10) & ~w.reach[4]
    lab, nn = ndi.label(left)
    sizes = sorted([int((lab == i).sum()) for i in range(1, nn + 1)], reverse=True)
    say('[10] 걸을 수 있는 칸인데 어느 수단으로도 닿지 않는 고립 칸: %d칸 (덩이 %d개, 큰 순 %s)' % (int(left.sum()), nn, sizes[:6]))
    say('     (고원 가장자리·절벽 끝을 막는 보수적 판정 때문. 전체 걷는 칸 %d 중 %.1f%%)' % (
        int((w.walk0 | w.dune).sum()), 100.0 * left.sum() / max((w.walk0 | w.dune).sum(), 1)))
    say('')
    say('결과: %s' % ('모든 검사 통과' if not bad else '불일치 %d건' % len(bad)))
    for b in bad:
        say('  !! ' + b)
    if out_path:
        Path(out_path).write_text('\n'.join(out) + '\n', encoding='utf-8')
    return w, bad, dict(stage_places=stage_places, barrier=bn, opening=ov, legs=legs)


if __name__ == '__main__':
    _, bad, _ = run()
    sys.exit(1 if bad else 0)
