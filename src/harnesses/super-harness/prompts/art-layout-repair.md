# 반려된 제작 도면만 수정하여 새 queued 판 준비
작업 폴더 {{ROOT}}, 개념 폴더 {{CDIR}}.
승인 모델 {{ART_MODEL_OVERRIDE}}, 상한 {{ART_LIMITS}}.
기존 하네스와 기준 자동차는 이미 준비되어 있다. 이번 작업은 그림 저작이 아니라 도면 반려의 교정이다.

먼저 art-layout-review.json / art-layout-input.json / art-execution.json / parking-repair-brief.json을 읽는다.
반려된 source 명세와 직접 관련된 코드 부분만 확인한다. 기존 자료를 새로 조사하거나 전체 참고문서/전체 소스/위키를 반복 출력하지 않는다.
기준차·출처 이미지는 기존 것을 그대로 사용한다. 새 그림·하위 모델·native 실행·검수 판정 작성 금지.
FAIL의 구체 지적에 맞춰 캔버스·구역·치수 계약·주문서·관련 프롬프트만 수정한다.
기존 원본·검수 기록을 보존하도록 별도 data/runs 경로와 새 판 id를 사용한다.
변경된 좌표와 이전 고정 수치가 충돌하지 않게 판 brief/검사/검수 프롬프트까지 일치시킨다.
자료 복사는 가능하지만 수집 완료 후보를 queued로 되돌리지 않는다. 새 queued 후보는 candidateCount 이하, nativeAttempts=1이다.
기존 하네스 prepare 경로를 사용한다. 코드 재설계와 기본 풀 실행 금지. 실제 모델은 감독이 승인 설정으로 주입한다.

execution.layout의 도면 JSON 스키마는 기존 art-layout-input.json.layout과 같다.
- canvas/cellSize와 정확히 일치하는 grid; 모든 칸에 legend(role/purpose).
- proportions/negativeSpace/identityCues를 새 도면에 맞게 갱신한다. 빈 바닥을 이름만 바꿔 정당화하지 않는다.
- sources는 새 seed/치수/주문서/queued state/판 brief/그림 및 검수 프롬프트/native 코드의 현재 해시를 포함한다.
- 현재 {{CDIR}}/art-feedback.json SHA256을 execution.feedbackSha256에 넣는다.
- art_layout.build_input을 사용한 기계적인 입력 일치 확인은 허용한다. 도면의 PASS 선언은 하지 않는다.

결과 {{CDIR}}/art-result.json은 {"execution":{"harness":"modern-chipset","data":"새 data 상대경로","runs":"새 runs 상대경로","viz":"격리 viz 상대경로","round":"새 queued 판 id","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]} 형식.
검수는 감독이 이어서 실행한다. 새 그림은 도면 검수 PASS 후에만 시작한다.
