"""Frozen acceptance criteria, advisory findings, and evidence-bound adjudication."""
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def bind(root, folder, request):
    source = Path(folder) / 'art-acceptance.json'
    request.pop('acceptance', None)
    if source.is_file():
        target = Path(root) / 'art-output/acceptance-contract.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        request['acceptance'] = {'path': str(target.relative_to(root)), 'sha256': digest(target)}


def semantic_fingerprint(layout):
    # Execution code and queued state remain hash-bound by art_layout; they do
    # not change the geometry whose previous approval may need adjudication.
    value = {k: v for k, v in layout.items() if k != 'sources'}
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def contract(folder):
    path = Path(folder) / 'art-acceptance.json'
    return {'sha256': digest(path), 'contract': json.loads(path.read_text())} if path.is_file() else None


def validate(report, acceptance, axes, adjudication=False):
    if not acceptance:
        return
    if report.get('acceptanceSha256') != acceptance['sha256']:
        raise ValueError('고정 합격 기준의 현재 해시가 필요합니다.')
    criteria = acceptance['contract']['criteria']
    observations = report.get('criterionResults', {})
    if set(observations) != {c['id'] for c in criteria}:
        raise ValueError('고정 필수 조건별 판정이 필요합니다.')
    failed_axes = set()
    for criterion in criteria:
        item = observations[criterion['id']]
        if (item.get('verdict') not in ('PASS', 'FAIL')
                or len(str(item.get('evidence', '')).strip()) < 20):
            raise ValueError('필수 조건의 구체적인 관찰 근거가 필요합니다.')
        if item['verdict'] == 'FAIL':
            if len(str(item.get('target', '')).strip()) < 3:
                raise ValueError('탈락 조건은 실제 물체/좌표를 지정해야 합니다.')
            failed_axes.update(set(criterion['axes']) & set(axes))
    for axis in axes:
        expected = 'FAIL' if axis in failed_axes else 'PASS'
        if report['checks'][axis]['verdict'] != expected:
            raise ValueError('필수 조건과 축 판정 불일치: ' + axis)
    warnings = report.get('warnings', [])
    if not isinstance(warnings, list) or any(not isinstance(w, str) for w in warnings):
        raise ValueError('개선 권고는 별도 문자열 목록으로 기록합니다.')
    if adjudication:
        decision = report.get('adjudication', {})
        expected = 'confirm-failure' if failed_axes else 'retain-pass'
        if decision.get('decision') != expected or len(str(decision.get('evidence', '')).strip()) < 30:
            raise ValueError('판정 충돌의 독립 재판정과 구체 근거가 필요합니다.')


def prior_layout_pass(folder, layout):
    acceptance = layout.get('acceptance')
    if not acceptance:
        return None
    semantic = semantic_fingerprint(layout['layout'])
    for path in sorted((Path(folder) / 'art-layout-history').glob('*.json'), reverse=True):
        report = json.loads(path.read_text())
        if (report.get('verdict') == 'PASS' and report.get('semanticFingerprint') == semantic
                and report.get('acceptanceSha256') == acceptance['sha256']):
            return {'path': str(path), 'sha256': digest(path), 'report': report}
    return None


def instructions(acceptance, dispute=None):
    if not acceptance:
        return ''
    text = '''\n\n## 고정 합격 기준 — 아래 계약이 일반적인 미적 반려 지시보다 우선한다
계약에 명시된 필수 조건 위반만 FAIL이다. 새로운 비율/완성도 기준을 추가하지 않는다.
모든 criterionResults[id]에 verdict와 20자 이상 evidence를 기록한다. FAIL에는 target(좌표/물체)도 필요하다.
checks의 각 축은 연결된 필수 조건 중 FAIL이 있을 때만 FAIL이다. 권고는 warnings 문자열 목록으로
남기며 전체 FAIL이나 fixes의 강제 수정으로 바꾸지 않는다. acceptanceSha256은 아래 sha256이다.
이전 실패 비교 중 이 계약의 권고 범위인 사항은 advisory로 근거를 기록하고 warnings로 남긴다.
이는 결함 은폐가 아니다. 원본·시점·접합·동선·공간 식별·명시한 비례 조건은 반드시 실제 근거로 판단한다.
계약에 없는 물리적 실측값을 추측하여 새 탈락 기준으로 삼지 않는다.
'''
    text += json.dumps(acceptance, ensure_ascii=False)
    if dispute:
        text += '''\n\n## 독립 재판정
같은 필수 조건의 기존 PASS와 새 FAIL이 충돌했다. 양쪽 근거와 현재 입력/그림을 직접 대조한다.
새 FAIL을 그대로 반복하거나 이전 PASS를 무조건 따르지 않는다. 위 고정 조건에서 실제 결함을
입증하면 confirm-failure, 입증되지 않으면 retain-pass다. 완전한 현재 판정 JSON에
adjudication:{decision,evidence}를 추가한다. evidence는 양쪽 판단의 차이를 30자 이상 설명한다.
'''
        text += json.dumps(dispute, ensure_ascii=False)
    return text
