"""3/4 시점 전면 수정 — 재작도 목록 생성기 → tiledata/atlas-pick/view34-rework.json

입력(읽기만):
  view34-audit.json            실외 감사(view34_check.py --audit)      : jp / modern / school
  interior-view34-audit.json   실내 감사(interior_view34_audit.py)    : v5 / pick / horror / school
  picks-{jp,school}.json       18303 사용자 선택(우선순위 1)
  ~/.local/share/oprn/hand-interior-pick/picks.sqlite  18302 사용자 선택 (audit 의 pick.items[].choice 가 이미 그것)
  sets.json, candidates-*/<slug>/info.json, i16-pick 의 candidates/<slug>/info.json

출력: view34-rework.json  {rules, gates, batches:[{id, set, gate, worker, items:[…]}], exclusions:[…], summary}
재실행하면 같은 입력에서 같은 결과가 나온다(감사 JSON 을 다시 뽑은 뒤 재생성 가능). 기존 후보는 덮어쓰지 않는다 — 새 후보 이름만 정한다.

사용: python3 scripts/content/atlas-pick/make_view34_rework.py [--i16 <i16-pick 워크트리 경로>]
"""
import argparse, collections, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, read_json

I16 = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-i16-pick'
BAD_OUT = ('FRONT', 'NOTOP', 'TOPDOWN')
BAD_IN = ('front', 'rim', 'topdown')
MAX_BATCHES = 16
MIN_N, MAX_N = 25, 35

# 우선순위 2 = 공통 기본 가구·건물 (맵마다 깔리는 것)
BASIC_WORDS = (
    'bed', 'desk', 'chair', 'table', 'shelf', 'bookshelf', 'wardrobe', 'closet', 'locker', 'cabinet', 'counter', 'sofa',
    'fireplace', 'stove', 'drawer', 'door', 'house', 'shop', 'store', 'front', 'building', 'wall', 'gate', 'station',
    'vending', 'bench', 'bus', 'car', 'taxi', 'kit_', 'podium', 'stair', 'pillar', 'column', 'fridge', 'sink', 'bath',
)
KIT_WEIGHT = 4          # 킷 한 벌 = 부품 시트 전부 + 조립 예 → 낱개 4개 분량으로 센다


def rj(p, d=None):
    return read_json(p, d)


def is_basic(slug):
    return any(w in slug for w in BASIC_WORDS)


def target_out(cat, verdict, w, h):
    """실외 조각의 목표 T/F 문장 (계약 §10-2/§10-3)."""
    cw, ch = w // 16, h // 16
    if cat == 'building':
        fl = max(1, round((h - 32) / 32)) if h > 32 else 1
        return f'건물: 지붕판 T = 깊이 D×16 (D=2 → 32px, 최소 T≥14, T/F 0.10~1.10), 앞면 F = 층수×32 (1층 가게 44~48). 앞면은 §10-2b 깊이 표(슬래브 9행·창 문턱·물러선 출입구). 막힘 = 밑면 D×16, 나머지 walk-behind. 칸 {cw}×{ch}'
    if cat == 'vehicle':
        return '차: 가로 진행 = 옆면 + 지붕·보닛·트렁크 윗면 3면, 윗선 단차 ≥5px(vehicle_h). 세로 진행 = 앞/뒷면 14 + 긴 지붕 T≥20, T/F 0.90~3.00(vehicle_v). 옆에서 본 입면도 금지. 검사는 `파일.png:vehicle`'
    if cat == 'prop_box':
        return '상자형 소품: T 4~8px(윗면) · F 12~24px(앞면), T/F 0.22~0.60 (T≥6 권장). 앞면 한 장 금지'
    return '소품: T 2~4 / F 6~16 (T/F 0.3~0.5, 얇은 판·가드레일류). 윗면 1~3px 띠가 아니라 앞 가장자리 하이라이트가 분명한 윗면'


def target_in(role_word):
    return ('실내: 벽 붙은 키 큰 가구 T 4~6px(앞 가장자리 하이라이트 1행 + 처마 그림자 2px, 들어간 앞면) / 탁자·침대·카운터 T = 깊이의 0.5~1.0배(8~14px) '
            '+ F 다리 8~14px / 의자 좌판 T 4~6 + 다리 6~8 / 상자·통 T 4~8 + F 8~16. 게이트: T≥3 이고 f≥15 (T≤2 = front, T=3 = rim, T>8 또는 f<15 = topdown)')


def finding_out(r):
    return f"{r['verdict']} · T={r['T']} F={r['F']} ratio={r['ratio']} · {r['why']}"


def load_info(cdir, slug):
    return rj(os.path.join(BASE, cdir, slug, 'info.json'), {}) or {}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--i16', default=I16); a = ap.parse_args()
    P16 = os.path.join(a.i16, 'tiledata/hand-interior/pick')
    out_a = rj(os.path.join(BASE, 'view34-audit.json'))
    in_a = rj(os.path.join(BASE, 'interior-view34-audit.json'))
    picks_jp = rj(os.path.join(BASE, 'picks-jp.json'), {})
    picks_school = rj(os.path.join(BASE, 'picks-school.json'), {})
    kits = rj(os.path.join(BASE, 'kits-jp.json'), {})
    excl = []
    items = []          # 후보 행(배치 전)

    # ---------- 18303 실외 (jp · modern · school out) ----------
    seen = set()
    school_place = {}
    for s in ('school',):
        cd = os.path.join(BASE, 'candidates-school')
        for sl in os.listdir(cd):
            school_place[sl] = load_info('candidates-school', sl).get('place')
    by_slug = collections.OrderedDict()
    for r in out_a:
        by_slug.setdefault((r['set'], r['slug']), []).append(r)
    for (st, sl), rows in by_slug.items():
        info = load_info({'jp': 'candidates-jp', 'modern': 'candidates-modern', 'school': 'candidates-school'}[st], sl)
        bad = [r for r in rows if r['verdict'] in BAD_OUT]
        if not bad:
            r0 = rows[0]
            if r0['verdict'] == 'EXEMPT':
                excl.append({'set': st, 'slug': sl, 'reason': 'exempt', 'why': f"검사기 면제 분류({r0['cat']}) — 나무·기둥·표지·바닥·얇은 판·킷 부품은 눈으로 본다(계약 §10-5). 이번 목록에서 제외, 2단계 눈 검수에서 잡히면 추가"})
            continue
        r0 = bad[0]
        if st == 'school' and school_place.get(sl) == 'in':
            continue   # 학원 실내 조각은 아래 실내 게이트에서 다룬다(외부 검사기는 실내 가구에 오탐)
        if (st, sl) in seen: continue
        seen.add((st, sl))
        kit = r0['assembled']
        chosen = (picks_jp if st == 'jp' else picks_school if st == 'school' else {}).get(sl, {}).get('choice')
        canvas = info.get('canvas') or [r0['w'], r0['h']]
        row = {
            'set': st, 'slug': sl, 'name': info.get('name', sl), 'kind': 'kit' if kit else 'outdoor', 'gate': 'view34_check',
            'category': r0['cat'], 'current': r0['file'].split('.ex-')[0] + ('.pxg' if kit else '') if kit else r0['file'],
            'chosen': chosen, 'violation': finding_out(r0) + (f' (조립 예 {len(bad)}건 모두 같은 결함)' if kit else ''),
            'footprint': f"{canvas[0] // 16}×{canvas[1] // 16}칸 (canvas {canvas[0]}×{canvas[1]})",
            'target': target_out(r0['cat'], r0['verdict'], canvas[0], canvas[1]),
            'layer': info.get('layer'),
            'weight': KIT_WEIGHT if kit else 1,
            'priority': 1 if chosen else (2 if is_basic(sl) else 3),
        }
        if kit:
            row['current'] = r0['file'].split('.ex-')[0] + '.png'
            row['target'] = ('킷 부품 시트 전체를 3/4 로 다시 찍는다: 건물류 부품 = 지붕 윗면 D×16 + 앞면 층수×32 + §10-2b 깊이, 소품류 부품 = T/F 표. 이음 계약(kits-jp.json contract)은 그대로. '
                            '검사는 조립 예(*.ex-*.png)에 `view34_check.py` 를 건다')
            row['naming'] = f"candidates-jp/{sl}/v34-A.pxg (부품 시트) → `python3 scripts/content/atlas-pick/jp_kit_compose.py --kit {sl}` 가 v34-A.ex-<예>.png 를 굽는다"
        items.append(row)

    # ---------- 실내 게이트: 18303 school in / horror ----------
    # 학원 실내(place=in) = 실내 감사 school 의 bad
    for x in in_a['school']['items']:
        if x['cls'] in BAD_IN:
            sl = x['key']
            info = load_info('candidates-school', sl)
            ch = picks_school.get(sl, {}).get('choice')
            cv = info.get('canvas') or [x['size'][0], x['size'][1]]
            if (('school', sl)) in seen: continue
            seen.add(('school', sl))
            items.append({
                'set': 'school', 'slug': sl, 'name': info.get('name', sl), 'kind': 'interior', 'gate': 'interior_view34_audit',
                'category': x['role'], 'current': f"candidates-school/{sl}/{ch}.png" if ch else f"candidates-school/{sl}/s?-A.png",
                'chosen': ch, 'violation': f"{x['cls']} · t={x['t']} f={x['f']} · {x.get('why', '')}",
                'footprint': f"{cv[0] // 16}×{cv[1] // 16}칸 (canvas {cv[0]}×{cv[1]})", 'target': target_in(x['role']), 'layer': info.get('layer'),
                'weight': 1, 'priority': 1 if ch else (2 if is_basic(sl) else 3),
            })
    # 학원 실외 감사에 걸렸지만 place=in 인 것 중 실내 감사에서 통과한 것은 제외 사유로 남긴다
    for (st, sl), rows in by_slug.items():
        if st == 'school' and school_place.get(sl) == 'in' and any(r['verdict'] in BAD_OUT for r in rows) and ('school', sl) not in seen:
            excl.append({'set': 'school', 'slug': sl, 'reason': 'interior-ok', 'why': '실외 검사기 오탐(실내 가구는 실내 게이트가 판정) — 실내 감사는 통과(ok/flat/wallface)'})

    # 호러: 슬러그 단위. 통과한 변형이 하나라도 있으면 그 변형을 고르면 된다 → 제외
    hv = collections.OrderedDict()
    for x in in_a['horror']['items']:
        sl, var = x['key'].split('/')
        hv.setdefault(sl, []).append((var, x))
    for sl, vs in hv.items():
        badv = [(v, x) for v, x in vs if x['cls'] in BAD_IN]
        if not badv: continue
        if any(x['cls'] == 'ok' for v, x in vs):
            excl.append({'set': 'horror', 'slug': sl, 'reason': 'has-ok-variant', 'why': '통과한 변형(' + ','.join(v for v, x in vs if x['cls'] == 'ok') + ')이 이미 있다 — 사용자가 그 변형을 고르면 된다'})
            continue
        info = load_info('candidates-horror', sl)
        v0, x0 = sorted(badv, key=lambda t: (t[0][-1] != 'A', t[0]))[0]
        cv = info.get('canvas') or [x0['size'][0], x0['size'][1]]
        items.append({
            'set': 'horror', 'slug': sl, 'name': info.get('name', sl), 'kind': 'interior', 'gate': 'interior_view34_audit',
            'category': x0['role'], 'current': f"candidates-horror/{sl}/{v0}.png",
            'chosen': None, 'violation': f"{x0['cls']} · t={x0['t']} f={x0['f']} (변형 {len(badv)}개 모두 미달) · {x0.get('why', '')}",
            'footprint': f"{cv[0] // 16}×{cv[1] // 16}칸 (canvas {cv[0]}×{cv[1]})", 'target': target_in(x0['role']), 'layer': info.get('layer'),
            'weight': 1, 'priority': 2 if is_basic(sl) else 3, 'stage': info.get('stage'),
        })

    # ---------- 18302 실내 (pick 178 폴더 + v5 로 폴더 없는 것) ----------
    folders = set(os.listdir(os.path.join(P16, 'candidates'))) if os.path.isdir(os.path.join(P16, 'candidates')) else set()
    for x in in_a['pick']['items']:
        if x['cls'] not in BAD_IN: continue
        sl = x['key']
        info = rj(os.path.join(P16, 'candidates', sl, 'info.json'), {}) or {}
        ch = x.get('choice')
        cv = info.get('canvas') or x['size']
        items.append({
            'set': 'interior', 'slug': sl, 'name': x['name'], 'kind': 'interior', 'gate': 'interior_view34_audit',
            'category': x['role'], 'current': f"tiledata/hand-interior/pick/candidates/{sl}/{ch}.png" if ch else f"tiledata/hand-interior/pick/candidates/{sl}/v5.png",
            'chosen': ch, 'violation': f"{x['cls']} · t={x['t']} f={x['f']} · {x.get('why', '')}",
            'footprint': f"{cv[0] // 16}×{cv[1] // 16}칸 (canvas {cv[0]}×{cv[1]})", 'target': target_in(x['role']), 'layer': info.get('layer'),
            'weight': 1, 'priority': 1 if ch else (2 if is_basic(sl) else 3),
        })
    pick_keys = {x['key'] for x in in_a['pick']['items']}
    pick_names = {x['name'] for x in in_a['pick']['items']}
    for x in in_a['v5']['items']:
        if x['cls'] in BAD_IN and x['name'] not in pick_names:
            excl.append({'set': 'interior', 'slug': x['key'] + ' ' + x['name'], 'reason': 'deferred-no-folder',
                         'why': f"v5 원본이 {x['cls']}(t={x['t']} f={x['f']}) 이나 18302 후보 폴더가 없다 — 1판 고르기에 오르지 않은 조각. 후보 폴더(jobs.json 등재)부터 만들어야 해서 2단계 범위 밖; 3/4 계약을 지켜 새로 찍을 때 함께 처리"})
    # v5 로 폴더가 있고 pick 감사에서 통과한 조각은 사용자가 고른 판이 이미 계약을 지킨다 → 제외 기록(개수만)

    # ---------- 세트 밖 제외 ----------
    excl.append({'set': 'worldmap', 'slug': '*', 'reason': 'other-agent', 'why': '월드맵은 3/4 계약 대상이 아니라 평면 위 아이콘 세트고, 재작업은 별도 백그라운드 에이전트(월드맵 확장 아이콘)가 진행 중이다'})
    for r in out_a:
        pass
    # 감사에서 면제된 분류 집계
    ex_cnt = collections.Counter((r['set'], r['cat']) for r in out_a if r['verdict'] == 'EXEMPT')
    # 제외 목록은 슬러그 단위로 정리(같은 슬러그 중복 제거)
    seen_ex = set(); ex2 = []
    for e in excl:
        k = (e['set'], e['slug'], e['reason'])
        if k in seen_ex: continue
        seen_ex.add(k); ex2.append(e)

    # ---------- 배치 ----------
    order = {'jp': 0, 'modern': 1, 'school': 2, 'horror': 3, 'interior': 4}
    groups = collections.OrderedDict()
    for it in items:
        groups.setdefault((it['set'], it['kind'] == 'kit'), []).append(it)
    # 킷은 jp 그룹 안에서 같은 배치에 몰아 두되, 배치 크기는 weight 로 센다
    plan = []
    for (st, is_kit), its in sorted(groups.items(), key=lambda kv: order[kv[0][0]]):
        pass
    by_set = collections.OrderedDict()
    for it in sorted(items, key=lambda i: (order[i['set']], i['kind'] != 'kit', i['priority'], i['kind'], i['slug'])):
        by_set.setdefault(it['set'], []).append(it)

    def chunk(its, weight_cap):
        tot = sum(i['weight'] for i in its)
        n = max(1, math.ceil(tot / weight_cap))
        per = tot / n
        out, cur, acc = [], [], 0
        for it in its:
            if cur and acc + it['weight'] > per + 1e-9 and len(out) < n - 1:
                out.append(cur); cur, acc = [], 0
            cur.append(it); acc += it['weight']
        out.append(cur)
        return out

    batches = []
    for st, its in by_set.items():
        # jp: 킷 10개(가중 40) 는 킷끼리 먼저 → 가중 합 기준으로 자른다
        for k, c in enumerate(chunk(its, MAX_N)):
            batches.append({'set': st, 'items': c})
    # 배치가 16 을 넘으면 가장 작은 인접 배치를 합친다(같은 세트끼리만)
    while len(batches) > MAX_BATCHES:
        best = None
        for i in range(len(batches) - 1):
            if batches[i]['set'] == batches[i + 1]['set']:
                s = sum(x['weight'] for x in batches[i]['items']) + sum(x['weight'] for x in batches[i + 1]['items'])
                if best is None or s < best[0]: best = (s, i)
        if best is None: break
        i = best[1]; batches[i]['items'] += batches[i + 1]['items']; del batches[i + 1]

    # 배치 순서 = 우선순위 평균 → 세트 순서
    for b in batches:
        b['prio'] = sum(i['priority'] for i in b['items']) / len(b['items'])
    batches.sort(key=lambda b: (round(b['prio'], 2), order[b['set']]))
    n16 = 0
    for k, b in enumerate(batches, 1):
        b['id'] = f'V{k:02d}'
        for it in b['items']:
            it['batch'] = b['id']
        if b['set'] == 'interior':
            b['worker'] = f'w{90 + n16}'; n16 += 1
            b['picker'] = '18302'
            for it in b['items']:
                it['naming'] = f"tiledata/hand-interior/pick/candidates/{it['slug']}/{b['worker']}-A.pxg  (i16-pick 워크트리; 선택 B/C = {b['worker']}-B/-C)"
                it['newCandidate'] = it['naming'].split('  ')[0]
        else:
            b['worker'] = 'v34'
            b['picker'] = '18303'
            for it in b['items']:
                cd = {'jp': 'candidates-jp', 'modern': 'candidates-modern', 'school': 'candidates-school', 'horror': 'candidates-horror'}[it['set']]
                it.setdefault('naming', f"tiledata/atlas-pick/{cd}/{it['slug']}/v34-A.pxg  (선택 B/C = v34-B/-C)")
                it['newCandidate'] = f"tiledata/atlas-pick/{cd}/{it['slug']}/v34-A.pxg"
        b['count'] = len(b['items']); b['weight'] = sum(i['weight'] for i in b['items'])
        b['sets'] = sorted({i['set'] for i in b['items']})
        b.pop('prio')

    doc = {
        'version': 1,
        'about': '3/4 시점 전면 수정 재작도 목록. 계약 = modern-style-bible.md §10(실외)·§11(실내). 절차 = WORKER-VIEW34.md. 생성기 = scripts/content/atlas-pick/make_view34_rework.py',
        'rules': {
            'neverOverwrite': '기존 후보(j5-A 등)·v0·v5 는 절대 덮어쓰지 않는다. 새 후보만 추가한다.',
            'picker18303': '세트 폴더 candidates-<set>/<slug>/v34-A.pxg (B·C 는 선택). WORKER_RE 가 v34-A 를 받아 pick_server 코드 변경이 필요 없고, 「후보 모아 보기」에서 j5-A 옆에 나란히 보인다.',
            'picker18302': 'i16-pick 워크트리 tiledata/hand-interior/pick/candidates/<slug>/w9N-A.pxg (N = 배치의 워커 번호 w90~w99, 배치마다 하나). 정규식 ^(w[0-9]{1,2}|pilot)-([A-Z])\\.pxg$ 에 맞는다. 후보 A = v5 를 3/4 로 다듬기 · B = 그림자·명암 강화 · C = 실루엣 재해석.',
            'gateOutdoor': 'python3 scripts/content/atlas-pick/view34_check.py <파일>.png[:분류] — 차는 :vehicle, 킷은 조립 예 *.ex-*.png',
            'gateIndoor': 'python3 scripts/content/atlas-pick/interior_view34_audit.py --wall-tall <파일>.png (벽 붙은 키 큰 가구) 또는 --object <파일>.png (일반 가구). 통과 = exit 0',
            'batchSize': f'{MIN_N}~{MAX_N} 개(킷 1벌 = {KIT_WEIGHT}개 분량), 배치당 작업자 1명, 최대 {MAX_BATCHES} 배치',
            'priority': '1 = 사용자가 고른 것(picks-jp/school, 18302 picks.sqlite), 2 = 공통 기본 가구·건물, 3 = 나머지',
        },
        'batches': [{k: v for k, v in b.items() if k != 'items'} | {'items': b['items']} for b in batches],
        'exclusions': ex2,
        'exemptOutdoor': {f'{s}/{c}': n for (s, c), n in sorted(ex_cnt.items())},
    }
    summ = {
        'batches': len(batches), 'items': len(items), 'weight': sum(i['weight'] for i in items),
        'perSet': dict(collections.Counter(i['set'] for i in items)),
        'perBatch': {b['id']: {'set': b['set'], 'n': b['count'], 'weight': b['weight'], 'worker': b['worker']} for b in batches},
        'exclusionReasons': dict(collections.Counter(e['reason'] for e in ex2)),
        'chosenItems': sum(1 for i in items if i['chosen']),
    }
    doc['summary'] = summ
    with open(os.path.join(BASE, 'view34-rework.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(json.dumps(summ, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
