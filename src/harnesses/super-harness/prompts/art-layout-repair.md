# 반려된 공간의 준비 입력 수정
작업 폴더 {{ROOT}}, 개념 폴더 {{CDIR}}.
입력 검증 모듈 {{ART_LAYOUT_MODULE}}의 부모를 sys.path 맨 앞에 넣어 import art_layout 한다.
승인된 모델 {{ART_MODEL_OVERRIDE}}, 실행 상한 {{ART_LIMITS}}.
현재 수정 지시 {{ART_FEEDBACK}}.

## 대상과 근거
현재 개념 폴더의 art-execution.json에서 실제 harness/data/판 경로를 읽고 그대로 같은 하네스를 쓴다.
art-layout-input.json과 art-layout-review.json의 반려 지적, art-feedback.json의 policy를 읽는다.
교실은 교실, 공동묘지는 공동묘지, 하수도는 하수도다. 다른 공간의 명세나 기준차를 요구하지 않는다.
parking-repair-brief.json, art-acceptance.json, art-calibration.json은 있을 때만 적용한다.
없는 선택 파일을 사용자에게 요구하거나 다른 공간 파일로 대체하지 않는다.
공용 참고자료는 reference-source.json과 이전 추출본의 해당 용도 MD·이미지를 재사용한다.
기존 수정 제안서가 있으면 활용하고 이미 조사한 전체 자료/위키를 반복 조사하지 않는다.

## 수정 범위
반려된 치수·방향·접합·여백·문 개구·배치부터 수정한다. 실패를 만든 기존 keep 조건도 재검토한다.
policy.route/phase를 따르고 layout.repairPlan에 변경점과 폐기한 잘못된 가정을 구체적으로 남긴다.
completionRepairs의 필수 항목, 승인된 시점, 다른 Allow 예시와 기존 검수 기록을 보존한다.
별도의 data/판 경로에서 기존 하네스의 prepare 경로로 새 queued 입력만 준비한다.
후보 수는 candidateCount 이하, nativeAttempts=1이다. 기존 완료 후보를 queued로 되돌리지 않는다.
캔버스/grid/범례, 치수, footprint/topFace/verticalFace/contact/occlusion,
방향별 벽·모서리·문 개구와 통행, 시드·brief·미래 검수 프롬프트의 좌표를 일치시킨다.
layout의 sources는 실제 새 시드·DB·판·brief·프롬프트·native 코드·기준 이미지의 현재 해시를 포함한다.
현재 art-feedback.json SHA256을 execution.feedbackSha256에 넣는다.

## 역할 경계
현재 준비 작업자는 그림을 직접 그리거나 하위 모델/native를 실행하거나 PASS를 작성하지 않는다.
사용자에게 판/부품/명세를 고치라고 요구하지 않는다. 기술적인 수정은 준비 작업자가 수행한다.
이 금지는 현재 역할에만 적용한다. 미래 reviewTemplate에는 실제 그림을 보고 지정 verdict.json에
PASS/FAIL, 필수 항목별 근거와 구체 수정 지시를 반드시 쓰도록 한다.
실행기 전면 재설계와 전체 풀 구동, 후보 선택·설치·공용 게시를 하지 않는다.
감독이 승인 모델을 주입하므로 모델 변경을 재질문하지 않는다.

## 출력
art_layout.build_input(ROOT, execution)으로 기계적인 입력 일치를 확인한다. 도면 PASS 선언은 하지 않는다.
{{CDIR}}/art-result.json에 실제 하네스에 맞는 execution을 기록하고 종료한다.
interior-props: {"execution":{"harness":"interior-props","data":"새 data 상대경로","picks":"격리 picks 상대경로","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]}
modern-chipset: {"execution":{"harness":"modern-chipset","data":"새 data 상대경로","runs":"새 runs 상대경로","viz":"격리 viz 상대경로","round":"새 queued 판 id","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]}
감독이 도면 독립 검수 후 native 실행을 담당한다. 준비가 실패해도 출력 파일을 생략하지 말고
{"candidates":[],"reasons":["실제 기술 원인과 수정 시도"]}를 남긴다.
