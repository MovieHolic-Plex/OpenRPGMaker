"""jp_city street_hand 키트 -> object-gate 종류 표 + 굽기용 3/4 관문 확인.

판정은 `npm run harness -- object-gate review` 가 한다(유료). 여기서는 영수증만 읽는다(모델 호출 없음).
그림 정본 = street_hand.py selftest 가 내보내는 tiledata/jp-city/blocks/street_hand/_gate/<kit-id>.png (투명 배경).
종류는 판정자가 「종류가 맞다」고 과반 동의해야 하므로 정직하게 붙인다(면제 종류로 도망가지 말 것).
"""
from __future__ import annotations
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
GATE_DIR = os.path.join(REPO, 'tiledata', 'jp-city', 'blocks', 'street_hand', '_gate')
sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
sys.path.insert(0, HERE)

# id(접두 jp- 뺀 것) -> 종류. 이름이 패턴인 것은 kind_of() 가 처리.
EXACT = {
    # 기둥형(윗면 = 기둥머리)
    'pole': 'column', 'pole-guy': 'column', 'pole-wood': 'column', 'mirror2': 'column', 'hydrant-sign': 'column',
    'bus-stop': 'column', 'rail-signal': 'structure', 'gatepost': 'column', 'bridge-post': 'column',
    # 구조물
    'gate': 'structure', 'carport': 'structure', 'torii': 'structure', 'gas-canopy': 'structure', 'school-gate': 'structure',
    'rail-fence': 'structure', 'bridge-rail-v': 'structure',
    # 가구·소품류
    'tsukigime': 'structure', 'monohoshi': 'frame', 'keijiban': 'frame',
    'propane': 'round_body', 'ac-unit': 'box', 'gomi-box': 'box', 'pots': 'container', 'jizo': 'structure',
    # 벽 부착
    'wall-drain': 'wall_mounted',
    # 지면 판(노면·바닥 표시·그림자·물 무늬)
    'mark-lockplate': 'flat', 'crosswalk-v': 'flat', 'foot-shadow': 'flat', 'rail-xing': 'flat',
    'bridge-abut': 'flat', 'bridge-pier': 'structure', 'bridge-lip': 'flat', 'bridge-plank': 'flat', 'bridge-joint': 'flat',
    'water-glint': 'flat', 'water-streak': 'flat', 'water-shade': 'flat', 'water-dark': 'flat', 'water-dark-r': 'flat', 'water-rim-s': 'flat',
    # 지형 면(둑·석축·선로 도상)
    'river-wall': 'terrain', 'bank-lip': 'terrain', 'bank-mid': 'terrain', 'bank-slope': 'terrain', 'rail-h': 'terrain',
}

# 철도·고가·보도·골함석·덩굴 키트(blocks/rail_art.py) — 종류 표는 그쪽이 정본이다.
try:
    sys.path.insert(0, os.path.join(HERE, 'blocks'))
    import rail_art as _rail_art
    EXACT.update({k[3:]: v for k, v in _rail_art.kinds().items()})
except Exception:       # pragma: no cover
    pass
try:                    # 빈터 쓰임 키트(blocks/lot_art.py)
    import lot_art as _lot_art
    EXACT.update({k[3:]: v for k, v in _lot_art.kinds().items()})
except Exception:       # pragma: no cover
    pass


def kind_of(kit_id: str) -> str:
    k = kit_id[3:] if kit_id.startswith('jp-') else kit_id
    if k in EXACT: return EXACT[k]
    if k.startswith('wire-'): return 'wall_mounted'     # 4층 가공선: 얇은 평면 선(윗면이 없는 평면 덧그림 — 정직한 가장 가까운 면제 종류)
    if k.startswith('mark-'): return 'flat'              # 노면 표시·측구·흰 선
    if k.startswith('bwall'): return 'structure'         # 블록 담·펜스(갓돌 윗면)
    if k.startswith('sf-'): return 'structure'           # 상가 입면 띠
    raise KeyError(f'종류 미정 키트: {kit_id} — gate_kinds.py 에 추가하라')


# 지금 관문을 통과하지 못한다고 알려진 키트(이유 포함). 영수증이 통과로 나오기 전에는 계속 막는다 — 이 목록은 면제가 아니라 안내다.
KNOWN_FAILING = {}

# 부품(part_of): 건물의 1층 띠(jp-sf-*)는 지붕·위층이 따로 있는 키트라 혼자서는 윗면을 보일 수 없다.
# 띠 + 위층 + 지붕을 조립기가 짓는 대로 합친 「조립 건물」 그림(gate_assembled.py, kind=structure, 같은 판정자·같은 기준)이
# 통과 영수증을 갖고 그 그림이 띠를 화소 그대로(정수 오프셋) 품고 있을 때만 띠가 덮인다. 띠를 다시 그리면 자동으로 덮임이 풀린다.
PART_OF_PREFIX = ('sf-',)


def is_part(kit_id: str) -> bool:
    k = kit_id[3:] if kit_id.startswith('jp-') else kit_id
    return k.startswith(PART_OF_PREFIX)


def known_failing_reason(kit_id: str) -> str:
    k = kit_id[3:] if kit_id.startswith('jp-') else kit_id
    if k in KNOWN_FAILING: return KNOWN_FAILING[k]
    return ''


def gate_kits() -> list[str]:
    if not os.path.isdir(GATE_DIR): return []
    return sorted(f[:-4] for f in os.listdir(GATE_DIR) if f.endswith('.png'))


INST_BLOCKS = ('interior_hospital', 'interior_school2', 'interior_office2')


def inst_items():
    """[(블록, id, png, 종류)] — 시설 실내 블록이 내보낸 _gate/kinds.json(바닥·벽면 = terrain, 문 = part)."""
    import json
    out = []
    for b in INST_BLOCKS:
        d = os.path.join(REPO, 'tiledata', 'jp-city', 'blocks', b, '_gate')
        kj = os.path.join(d, 'kinds.json')
        if not os.path.exists(kj): continue
        for k, v in json.load(open(kj, encoding='utf-8')).items(): out.append((b, k, os.path.join(d, k + '.png'), v))
    return out


_CUR = None
def current_profile() -> str:
    """현재 판정 프로필 해시(npm run harness -- object-gate status 의 「현재 규칙 프로필 <해시>」). 한 번만 조회."""
    global _CUR
    if _CUR: return _CUR
    import subprocess
    out = subprocess.run(['npm', 'run', 'harness', '--', 'object-gate', 'status'], cwd=os.path.join(HERE, '..', '..', '..'), capture_output=True, text=True).stdout
    m = re.search(r'현재 규칙 프로필 ([0-9a-f]{16})', out)
    if not m: raise RuntimeError('현재 판정 프로필 해시를 못 읽었다(object-gate status)')
    _CUR = m.group(1); return _CUR


def state(png_path: str, kind: str, context: str = 'bundle'):
    """('pass'|'provisional', None) 또는 (None, 이유). provisional = 현재 프로필의 PASS 영수증이지만 프로필이 아직 보정 전.
    영수증이 FAIL 이거나 옛 프로필·다른 종류면 통과로 세지 않는다(OG.refusal 은 보정 여부를 판정보다 먼저 봐서 FAIL 도 「보정 안 됨」으로만 말한다)."""
    import object_gate as OG
    sha = OG.pixel_sha256(png_path)
    rc = OG.read_receipt(sha)
    if not rc: return None, '3/4 시점 판정 영수증이 없다 — object-gate review 를 먼저 받아라'
    # 서명된 사람 결정이 최종이다(2026-10-20): 허용이면 통과, 거절이면 막는다(read_hold_decision 이 서명을 확인한다).
    human = OG.human_decision(OG.read_hold_decision(sha), rc)
    if human == 'reject': return None, '사람이 검토 화면에서 거절했다 — 최종'
    if human == 'allow' and rc.get('kind') == kind: return 'pass', None
    if rc.get('kind') != kind: return None, f"영수증 종류({rc.get('kind')})가 요청 종류({kind})와 다르다"
    if rc.get('profileHash') != current_profile() and rc.get('profileHash') not in OG.calibrated_profiles():
        # 이미 출하된 그림의 동결 목록(gate_grandfather.py, 2026-10-21): 화소가 한 점도 안 바뀌었고 옛 프로필 통과 영수증이 있으면 통과.
        import gate_grandfather as GF
        if GF.is_grandfathered(sha, kind, rc): return 'grandfathered', None
        return None, f"옛 판정 프로필({rc.get('profileHash')}) 영수증이다 — 다시 판정받아라"
    if rc.get('verdict') != 'pass': return None, '3/4 시점 판정 불합격(' + ' · '.join(rc.get('reasons') or ['fail']) + ')'
    return ('pass' if rc.get('profileHash') in OG.calibrated_profiles() else 'provisional'), None


def check_all(context: str = 'bundle') -> dict:
    """모든 _gate 키트의 영수증 확인. {'ok':[...], 'bad':[(id, kind, why)], 'total':n}. 모델 호출 없음."""
    import object_gate as OG
    ok, bad, prov, covered, gf, changed = [], [], [], [], [], []
    import gate_assembled as GA
    for kid in gate_kits():
        kind = kind_of(kid)
        if is_part(kid):
            name, st = GA.covering(kid, context)
            if name: covered.append((kid, name + (' [미보정 프로필 임시]' if st == 'provisional' else GF_TAG if st == 'grandfathered' else ''))); continue
            bad.append((kid, kind, st)); continue
        png = os.path.join(GATE_DIR, kid + '.png')
        try:
            st, why = state(png, kind, context)
        except Exception as e:  # 깨진 PNG 등
            st, why = None, f'확인 실패: {e}'
        if st == 'provisional':                                  # 현재 프로필의 PASS 이지만 프로필이 아직 보정 전 → 임시 통과(보고에 「미보정」 표기)
            prov.append(kid); continue
        if st == 'grandfathered': gf.append(kid); continue
        if why: why = _changed_note(kid, png, why, changed)
        (bad if why else ok).append((kid, kind, why) if why else kid)
    # 시설 실내 블록(병원 hs- · 학교 보강 sx- · 사무실 보강 ox-, 2026-10-14): 새 그림이라 관문을 거친다(옛 실내 블록은 소급 면제).
    # 종류표 = 블록이 내보낸 _gate/kinds.json. 문(part)은 조립 방 조각 영수증(gate_rooms.py, kind structure)으로 덮는다.
    import gate_rooms as GR
    for b, kid, png, kind in inst_items():
        if kind == 'part':
            name, st = GR.covering(kid, png, context)
            if name: covered.append((kid, 'room ' + name + (' [미보정 프로필 임시]' if st == 'provisional' else GF_TAG if st == 'grandfathered' else ''))); continue
            bad.append((kid, kind, st)); continue
        try:
            st, why = state(png, kind, context)
        except Exception as e:
            st, why = None, f'확인 실패: {e}'
        if st == 'provisional': prov.append(kid); continue
        if st == 'grandfathered': gf.append(kid); continue
        if why: why = _changed_note(kid, png, why, changed)
        (bad if why else ok).append((kid, kind, why) if why else kid)
    gf_cov = [kid for kid, name in covered if name.endswith(GF_TAG)]
    return dict(ok=ok, prov=[p if isinstance(p, str) else p[0] for p in prov], covered=covered, bad=bad, grandfathered=gf, grandfathered_covered=gf_cov,
                changed=changed, total=len(ok) + len(prov) + len(gf) + len(covered) + len(bad))


GF_TAG = ' [동결 출하본]'


def _changed_note(key, png, why, changed):
    """동결 목록의 그림인데 화소가 바뀌어 동결이 풀린 경우 사유를 크게 바꾼다(changed 에 모은다)."""
    import object_gate as OG, gate_grandfather as GF
    try: old = GF.changed(key, OG.pixel_sha256(png))
    except Exception: old = None
    if not old: return why
    changed.append(key)
    return f'동결 출하본인데 화소가 바뀌었다(동결 {old[:12]}) — 새 그림 기준으로 판정·허용받아라. 원래 사유: {why}'


def report(res: dict, file=sys.stdout) -> None:
    print(f"[3/4 관문] street_hand·시설 실내 키트 {res['total']}개 중 통과 {len(res['ok'])} + 동결 출하본(화소 그대로) {len(res.get('grandfathered', []))} + 조립 건물 영수증으로 덮임 {len(res.get('covered', []))}(그중 동결 {len(res.get('grandfathered_covered', []))}) + 미보정 프로필 임시통과 {len(res.get('prov', []))}, 영수증 없음/불합격 {len(res['bad'])}", file=file)
    if res.get('changed'):
        print(f"!!! [3/4 관문] 동결 출하본 {len(res['changed'])}개의 화소가 바뀌었다 — 동결이 풀려 새 그림 기준을 거쳐야 한다: {', '.join(res['changed'][:12])}", file=file)
    for kid, name in res.get('covered', [])[:3]: print(f'  {kid}: covered by assembled {name}', file=file)
    if res.get('covered'): print(f"  … 띠 {len(res['covered'])}개 모두 'covered by assembled <표본>' (조립 건물 영수증, kind=structure)", file=file)
    if res['bad']:
        print(f"{'kit':34} {'kind':13} 사유", file=file)
        for kid, kind, why in res['bad']:
            kf = known_failing_reason(kid)
            print(f"{kid:34} {kind:13} {why}" + (f"  [알려진 불합격: {kf}]" if kf else ''), file=file)
    if not os.path.isdir(GATE_DIR) or not res['total']:
        print(f'_gate 사본이 없다: {GATE_DIR} — street_hand selftest 를 먼저 돌려라', file=file)


def enforce() -> None:
    """bake 진입 관문. 미통과 키트가 있으면 표를 찍고 종료(코드 3). 우회 환경변수는 없다(JP_GATE=skip 은 2026-10-15 제거)."""
    res = check_all()
    if res.get('changed'):
        print(f"!!! [3/4 관문] 동결 출하본 {len(res['changed'])}개의 화소가 바뀌었다: {', '.join(res['changed'])}", file=sys.stderr)
    if not res['bad'] and res['total']:
        ng, nc = len(res.get('grandfathered', [])), len(res.get('grandfathered_covered', []))
        print(f"[3/4 관문] 동결 출하본(화소 그대로·옛 프로필 통과 영수증) {ng} + 동결 조립 표본으로 덮인 부품 {nc} · 새 영수증 통과 {len(res['ok'])} · 임시 {len(res.get('prov', []))}"
              f" (동결 목록 tiledata/jp-city/gate-grandfathered.json)", file=sys.stderr)
        if res.get('covered'): print(f"[3/4 관문] 상가 띠 {len(res['covered'])}개는 조립 건물 영수증으로 덮임(covered by assembled)", file=sys.stderr)
        if res.get('prov'):
            print(f"[3/4 관문] 통과 {len(res['ok'])} · 임시통과 {len(res['prov'])} — 판정 프로필이 아직 「보정 안 됨」이다. 보고에 「관문 임시통과(프로필 미보정)」라고 적을 것.", file=sys.stderr)
        else:
            print(f"[3/4 관문] 통과 {res['total']}/{res['total']} (동결 출하본 포함)")
        return
    report(res, file=sys.stderr)
    print('굽기를 거절한다. 영수증을 받으려면: python3 scripts/content/jp-city/gate_review_all.py 후 npm run harness -- object-gate review --batch /tmp/jp-gate-chunk-N.jsonl\n'
          '(건너뛰는 길은 없다 — 그림을 고치거나 관문 정책을 사용자와 상의)', file=sys.stderr)
    sys.exit(3)


if __name__ == '__main__':
    r = check_all(); report(r)
