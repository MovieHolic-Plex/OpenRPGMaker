"""Admit an explicitly enrolled, unchanged occupied-shelf READ re-review.

The original receipt remains immutable. This resolves only its native READ failure;
scene acceptance, user selection, runtime validation and installation stay separate.
"""
from pathlib import Path
import json
import art_choices
import art_supplementary


def require(ok, message):
    if not ok:
        raise ValueError('원본 재검수 연결 오류: ' + message)


def resolve(data, cid, source, item, candidate, old_review, entry=None):
    entries = art_supplementary.load(data, cid)
    matches = [e for e in entries if e.get('nativeReviewReceipt') and e['source'] == source]
    # Labels belong to presentation, not source identity.
    if not matches:
        matches = [e for e in entries if e.get('nativeReviewReceipt')
                   and all(e['source'].get(k) == source.get(k) for k in ('path', 'sha256'))]
    if entry is None and not matches:
        return None
    require(len(matches) == 1, '하나의 현재 원본에 재검수 영수증 하나가 필요합니다.')
    require(entry is None or entry == matches[0], '재검수 등록이 변경되거나 철회되었습니다.')
    entry = matches[0]
    data = Path(data).resolve()
    refs = {(data / r['path']).resolve(): r['sha256'] for r in entry['files']}

    def bound(path, sha):
        path = Path(path).resolve()
        require(path.is_relative_to(data) and refs.get(path) == sha, '등록되지 않은 검수 근거: ' + str(path))
        require(art_choices.digest(path) == sha, '검수 근거 해시가 변경되었습니다.')
        return path

    enrolled = entry['nativeReviewReceipt']
    receipt_file = bound(data / enrolled['path'], enrolled['sha256'])
    receipt = json.loads(receipt_file.read_text())
    require(receipt.get('status') == 'reviewed-not-selected', '전문 하네스 재검수 완료 영수증이 아닙니다.')
    require(receipt.get('item') == item and receipt.get('originalCandidate') == candidate, '원래 품목/후보가 다릅니다.')
    source_sha = source['sha256']
    require(receipt.get('originalSourceSha256') == receipt.get('candidateSha256') == source_sha, '원본 그림이 바뀌었습니다.')
    bound(receipt['candidate'], source_sha)
    initial_file = bound(receipt['initialVerdictFile'], receipt['initialVerdictSha256'])
    initial = json.loads(initial_file.read_text())
    require(initial == old_review and initial.get('verdict') == 'FAIL' and initial.get('codes') == ['READ'],
            '보존한 원래 READ 단독 실패와 일치해야 합니다.')
    require(receipt.get('fullRoomApproved') is False and receipt.get('selection') is None,
            '재검수를 전체 공간 승인/선택으로 사용할 수 없습니다.')
    bound(receipt_file.parent / 'input-manifest.json', receipt['inputManifestSha256'])
    evidence_file = bound(receipt['contextEvidenceFile'], receipt['contextEvidenceSha256'])
    evidence = json.loads(evidence_file.read_text())
    require(evidence.get('originalSourceSha256') == source_sha and evidence.get('fullRoomApproved') is False,
            '접촉 비교가 같은 원본에 묶이지 않았습니다.')
    require(evidence.get('proofCount') == len(evidence.get('proofs', [])) and evidence['proofCount'] > 0,
            '접촉 비교 그림이 없습니다.')
    require(bool(evidence.get('generated')), '비교 렌더 파일이 없습니다.')
    for proof in evidence['generated']:
        bound(proof['file'], proof['sha256'])
    verdicts = receipt.get('requiredNativeVerdicts', [])
    require(len(verdicts) == 2 and {v['phase'] for v in verdicts} == {'review', 'review2'},
            '첫째/둘째 독립 검수 영수증이 모두 필요합니다.')
    require(len({v['file'] for v in verdicts}) == 2 and len({v['sha256'] for v in verdicts}) == 2,
            '동일 검수를 두 번 계산할 수 없습니다.')
    for ref in verdicts:
        verdict = json.loads(bound(ref['file'], ref['sha256']).read_text())
        require(verdict.get('verdict') == 'PASS' and verdict.get('candidateSha256') == source_sha
                and verdict.get('scope') == 'native-occupied-shelf-context', '독립 검수의 원본/범위/합격이 다릅니다.')
        rows = verdict.get('slotResults', [])
        require(len(rows) == 2 and {r['key'] for r in rows} == {'west-run', 'east-run'}
                and all(r.get('verdict') == 'PASS' for r in rows), '양쪽 원본 슬롯의 독립 합격이 필요합니다.')
    final = next(v for v in verdicts if v['phase'] == 'review2')
    require(receipt['verdictFile'] == final['file'] and receipt['verdictSha256'] == final['sha256'],
            '최종 영수증이 둘째 검수를 가리키지 않습니다.')
    return dict(version=1, source=source, item=item, candidate=candidate, originalReview=old_review, entry=entry)


def verify(data, cid, recovery):
    current = resolve(data, cid, recovery['source'], recovery['item'], recovery['candidate'],
                      recovery['originalReview'], recovery['entry'])
    require(current == recovery, '저장한 재검수 근거가 현재 입력과 다릅니다.')
