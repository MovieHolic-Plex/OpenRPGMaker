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

# id(접두 jp- 뺀 것) -> 종류. 이름이 패턴인 것은 kind_of() 가 처리.
EXACT = {
    # 기둥형(윗면 = 기둥머리)
    'pole': 'column', 'pole-guy': 'column', 'pole-wood': 'column', 'mirror2': 'column', 'hydrant-sign': 'column',
    'bus-stop': 'column', 'rail-signal': 'box', 'gatepost': 'column', 'bridge-post': 'column',
    # 구조물
    'gate': 'structure', 'carport': 'structure', 'torii': 'structure', 'gas-canopy': 'structure', 'school-gate': 'structure',
    'rail-fence': 'structure', 'bridge-rail-v': 'structure',
    # 가구·소품류
    'tsukigime': 'frame', 'monohoshi': 'frame', 'keijiban': 'frame',
    'propane': 'round_body', 'ac-unit': 'box', 'gomi-box': 'box', 'pots': 'container', 'jizo': 'figure',
    # 벽 부착
    'wall-drain': 'wall_mounted',
    # 지면 판(노면·바닥 표시·그림자·물 무늬)
    'mark-lockplate': 'flat', 'crosswalk-v': 'flat', 'foot-shadow': 'flat', 'rail-xing': 'flat',
    'bridge-abut': 'flat', 'bridge-pier': 'flat', 'bridge-lip': 'flat', 'bridge-plank': 'flat', 'bridge-joint': 'flat',
    'water-glint': 'flat', 'water-streak': 'flat', 'water-shade': 'flat', 'water-dark': 'flat', 'water-dark-r': 'flat', 'water-rim-s': 'flat',
    # 지형 면(둑·석축·선로 도상)
    'river-wall': 'terrain', 'bank-lip': 'terrain', 'bank-mid': 'terrain', 'bank-slope': 'terrain', 'rail-h': 'terrain',
}


def kind_of(kit_id: str) -> str:
    k = kit_id[3:] if kit_id.startswith('jp-') else kit_id
    if k in EXACT: return EXACT[k]
    if k.startswith('wire-'): return 'wall_mounted'     # 4층 가공선: 얇은 평면 선(윗면이 없는 평면 덧그림 — 정직한 가장 가까운 면제 종류)
    if k.startswith('mark-'): return 'flat'              # 노면 표시·측구·흰 선
    if k.startswith('bwall'): return 'structure'         # 블록 담·펜스(갓돌 윗면)
    if k.startswith('sf-'): return 'structure'           # 상가 입면 띠
    raise KeyError(f'종류 미정 키트: {kit_id} — gate_kinds.py 에 추가하라')


# 지금 관문을 통과하지 못한다고 알려진 키트(이유 포함). 영수증이 통과로 나오기 전에는 계속 막는다 — 이 목록은 면제가 아니라 안내다.
KNOWN_FAILING = {
    'sf-*': '상가 입면 띠(jp-sf-*): 정면 입면만 있고 윗면이 없다(elevation strip without top face) — 윗면 지붕/차양 행을 그려야 함',
}


def known_failing_reason(kit_id: str) -> str:
    k = kit_id[3:] if kit_id.startswith('jp-') else kit_id
    if k in KNOWN_FAILING: return KNOWN_FAILING[k]
    if k.startswith('sf-'): return KNOWN_FAILING['sf-*']
    return ''


def gate_kits() -> list[str]:
    if not os.path.isdir(GATE_DIR): return []
    return sorted(f[:-4] for f in os.listdir(GATE_DIR) if f.endswith('.png'))


def check_all(context: str = 'bundle') -> dict:
    """모든 _gate 키트의 영수증 확인. {'ok':[...], 'bad':[(id, kind, why)], 'total':n}. 모델 호출 없음."""
    import object_gate as OG
    ok, bad = [], []
    for kid in gate_kits():
        kind = kind_of(kid)
        try:
            why = OG.refusal(os.path.join(GATE_DIR, kid + '.png'), kind=kind, context=context)
        except Exception as e:  # 깨진 PNG 등
            why = f'확인 실패: {e}'
        (bad if why else ok).append((kid, kind, why) if why else kid)
    return dict(ok=ok, bad=bad, total=len(ok) + len(bad))


def report(res: dict, file=sys.stdout) -> None:
    print(f"[3/4 관문] street_hand 키트 {res['total']}개 중 통과 {len(res['ok'])}, 영수증 없음/불합격 {len(res['bad'])}", file=file)
    if res['bad']:
        print(f"{'kit':34} {'kind':13} 사유", file=file)
        for kid, kind, why in res['bad']:
            kf = known_failing_reason(kid)
            print(f"{kid:34} {kind:13} {why}" + (f"  [알려진 불합격: {kf}]" if kf else ''), file=file)
    if not os.path.isdir(GATE_DIR) or not res['total']:
        print(f'_gate 사본이 없다: {GATE_DIR} — street_hand selftest 를 먼저 돌려라', file=file)


def enforce() -> None:
    """bake 진입 관문. 미통과 키트가 있으면 표를 찍고 종료(코드 3). JP_GATE=skip 이면 큰 경고 후 통과."""
    res = check_all()
    if not res['bad'] and res['total']:
        print(f"[3/4 관문] 통과 {res['total']}/{res['total']}")
        return
    report(res, file=sys.stderr)
    if os.environ.get('JP_GATE') == 'skip':
        print('!' * 70 + f"\n!! JP_GATE=skip — 3/4 관문 미통과 키트 {max(len(res['bad']), 1)}개를 알고도 굽는다. 보고에 「3/4 관문 미통과」라고 적을 것.\n" + '!' * 70, file=sys.stderr)
        return
    print('굽기를 거절한다. 영수증을 받으려면: python3 scripts/content/jp-city/gate_review_all.py 후 npm run harness -- object-gate review --batch /tmp/jp-gate-chunk-N.jsonl\n'
          '(관문을 건너뛰려면 JP_GATE=skip — 권장하지 않음)', file=sys.stderr)
    sys.exit(3)


if __name__ == '__main__':
    r = check_all(); report(r)
