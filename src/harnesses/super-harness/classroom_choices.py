"""Expose native classroom receipts without interpreting them as parking kits."""
from pathlib import Path


def group(root, receipt, receipt_ref, io):
    contract=io.safe(root,receipt['contractPath'])
    if io.digest(contract)!=receipt['contractSha256']:raise ValueError('교실 명세가 native 검수 이후 바뀌었습니다.')
    specification=io.read(contract)
    required={slot['requirementId'] for slot in specification['slots'].values()}
    if not required:raise ValueError('교실 필수 품목 누락')
    result=dict(id='classroom-kit',title='교실 전체 칩 세트',description='실제 교실의 문 열림·닫힘과 전체 공간을 비교합니다.',requiresContextReview=True,candidates=[])
    for row in receipt['candidates']:
        image=row.get('image');check_ref=row.get('checkFile');verdict_ref=row.get('verdictFile')
        if not image or not check_ref or not verdict_ref:raise ValueError('교실 native 영수증 갱신 필요: 원본·검사·검수 파일 누락')
        for ref in [image,check_ref,verdict_ref,*row.get('contextImages',[]),*row.get('contextSources',[])]:io.verified(root,ref)
        check=io.read(io.verified(root,check_ref));review=io.read(io.verified(root,verdict_ref))
        if check.get('imageSha256')!=image['sha256'] or check.get('contractSha256')!=receipt['contractSha256']:raise ValueError('교실 그림/명세와 기계 검사 해시 불일치')
        if row.get('check')!=check or any(row.get('review',{}).get(k)!=v for k,v in review.items()):raise ValueError('교실 영수증과 실제 검사 판정 불일치')
        verdicts=review.get('groups',{})
        passed=(row.get('status')=='done' and check.get('ok') is True and review.get('verdict')=='PASS'
                and review.get('assembly',{}).get('verdict')=='PASS'
                and all(verdicts.get(k,{}).get('verdict')=='PASS' for k in required))
        images=row.get('contextImages',[])
        if not images:raise ValueError('교실 전체 조립 그림 없음')
        reasons=[str(v.get('reasons') or k) for k,v in verdicts.items() if v.get('verdict')!='PASS']
        if review.get('assembly',{}).get('verdict')!='PASS':reasons.append(review.get('assembly',{}).get('reasons') or '전체 조립 검수 미완료')
        fixes=[dict(category='assembly',target='교실 조립',problem=' / '.join(reasons),change=review['fix'],keep='통과한 가구·문 원본과 독립 판정')] if review.get('fix') and not passed else []
        result['candidates'].append(dict(id=row['letter'],title='예시 '+row['letter'],passed=passed,
            summary='품목·조립 native 검수 통과' if passed else '수정 필요 · 선택할 수 없음',reasons=reasons,
            repairFixes=fixes,sources=[receipt_ref,io.ref(root,contract),image,check_ref,verdict_ref]+row.get('contextSources',[]),
            images=images,sheet=image,caution='원래 FAIL은 유지하며 전체 데모 독립 검수 후 평가합니다.'))
    return result
