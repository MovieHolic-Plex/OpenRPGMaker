# 독립 재료 준비 검수 — 맵 제작 승인

저장소: {{ROOT}}
조사서: {{CDIR}}/materials.json
기계 확인 결과: {{REPORT}}

조사자와 독립적으로 필수 재료 목록이 이 공간의 시대·문화·기능을 충분히 담는지 확인한다.
조사서에 빠진 핵심(주차선, 교실 칠판, 조선 주막 온돌/소반, 하수도 물길, 감방의 닫히는 문)도 실패 이유다.
모든 실제 preview 그림과 해당 용도 references를 직접 연다. 이름이 맞아도 그림·축척·시대가 다르면 FAIL.
미검수 후보와 미배포 그림은 사용 가능한 공용 재고가 아니다. 조선 자료는 현재 조각 해시의 하네스 판정도 확인한다.
바닥·벽·천장을 다른 시대로 빌리는 예외는 없다. 구현되지 않은 조립법을 완성된 재료로 인정하지 않는다.

결과 {{CDIR}}/material-review.json:
{
 "verdict":"PASS 또는 FAIL", "fingerprint":"기계 확인 결과의 fingerprint",
 "requirements":["결과의 requirements 전체"], "images":["결과의 images 객체 전체"],
 "checks":{"era":"PASS 또는 FAIL","coverage":"PASS 또는 FAIL","renderability":"PASS 또는 FAIL"},
 "reasons":["누락/미배포/불일치를 구체적으로"]
}
배열에는 문자열 설명이 아니라 실제 보고서의 값/객체를 복사한다. 모든 재료가 준비됐을 때만 PASS.
