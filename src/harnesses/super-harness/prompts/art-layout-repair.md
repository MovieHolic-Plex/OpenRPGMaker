# 실패 원인 단계로 돌아가 새 queued 판 준비
작업 폴더 {{ROOT}}, 개념 폴더 {{CDIR}}.
각 명령은 작업 폴더를 명시한다. 입력 일치 확인 모듈은 {{ART_LAYOUT_MODULE}}이다.
그 파일의 부모 폴더를 sys.path 맨 앞에 넣고 import art_layout 한다. 홈 전체에서 다른 사본을 찾지 않는다.
승인 모델 {{ART_MODEL_OVERRIDE}}, 상한 {{ART_LIMITS}}.
기존 하네스와 기준 자동차는 이미 준비되어 있다. 이번 작업은 명세/배치/시점의 교정과 native 실행 준비다.
먼저 art-feedback.json의 policy와 art-calibration.json(있으면)을 읽고 수정 경로를 따른다.

먼저 art-layout-review.json / art-layout-input.json / art-execution.json / parking-repair-brief.json을 읽는다.
반려된 source 명세와 직접 관련된 코드 부분만 확인한다. 기존 자료를 새로 조사하거나 전체 참고문서/전체 소스/위키를 반복 출력하지 않는다.
기준차·출처 이미지는 기존 것을 그대로 사용한다. 새 그림·하위 모델·native 실행·검수 판정 작성 금지.
FAIL의 구체 지적에 맞춰 캔버스·구역·치수 계약·주문서·관련 프롬프트만 수정한다.
기존 원본·검수 기록을 보존하도록 별도 data/runs 경로와 새 판 id를 사용한다.
변경된 좌표와 이전 고정 수치가 충돌하지 않게 판 brief/검사/검수 프롬프트까지 일치시킨다.
자료 복사는 가능하지만 수집 완료 후보를 queued로 되돌리지 않는다. 새 queued 후보는 candidateCount 이하, nativeAttempts=1이다.
기존 하네스 prepare 경로를 사용한다. 새 표본 명세를 위한 검사/조립의 최소 수정은 가능하다. 실행기 전체 재설계와 기본 풀 실행 금지. 실제 모델은 감독이 승인 설정으로 주입한다.
공용 참고 자료는 reference-source.json과 이전 data/references의 추출본을 재사용한다. 현재 쓰는 용도의 MD/이미지만 확인한다.
승인 모델 {{ART_MODEL_OVERRIDE}}가 있으면 기본 Sonnet 규칙보다 우선하며 확인을 다시 요청하지 않는다.

execution.layout의 도면 JSON 스키마는 기존 art-layout-input.json.layout과 같다.
- canvas/cellSize와 정확히 일치하는 grid; 모든 칸에 legend(role/purpose).
- proportions/negativeSpace/identityCues를 새 도면에 맞게 갱신한다. 빈 바닥을 이름만 바꿔 정당화하지 않는다.
- sources는 새 seed/치수/주문서/queued state/판 brief/그림 및 검수 프롬프트/native 코드의 현재 해시를 포함한다.
- 현재 {{CDIR}}/art-feedback.json SHA256을 execution.feedbackSha256에 넣는다.
- art_layout.build_input을 사용한 기계적인 입력 일치 확인은 허용한다. 도면의 PASS 선언은 하지 않는다.

결과 {{CDIR}}/art-result.json은 {"execution":{"harness":"modern-chipset","data":"새 data 상대경로","runs":"새 runs 상대경로","viz":"격리 viz 상대경로","round":"새 queued 판 id","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]} 형식.
검수는 감독이 이어서 실행한다. 새 그림은 도면 검수 PASS 후에만 시작한다.

## 반복 실패 재설계·3/4 시점 표본 관문 v3
현재 art-feedback.json의 policy.route/phase를 반드시 따른다. 이전 fixes의 keep는 재검토 가능한 모델 제안이다.
route=spec이면 잘못된 고정 치수·방향·알파 bbox 가정을 폐기하고 새 형태/접지/투영 명세로 교체한다.
route=assembly이면 배치부터, asset이면 해당 그림부터 고친다. route=integration이면 art-calibration.json의 합격 시점 표본을 작은 공간에 재조립한다.
layout에 아래 필드를 추가한다:
- phase: policy.phase와 동일한 calibration 또는 scene (피드백 없으면 scene).
- repairPlan: {route: policy.route, changes: 구체 변경 30자 이상, supersededConstraints: 교체한 기존 고정 조건과 근거 30자 이상}. spec 경로에는 반드시 교체 근거가 있어야 한다.
- camera: {references:[{path,sha256}], groundPlane: 바닥 두 축과 깊이 근거 20자 이상, heightAxis: 높이와 바닥 폭을 분리한 근거 20자 이상, lighting: 광원·면 밝기 근거 20자 이상, objects:[{id,footprint,topFace,verticalFace,contact,occlusion}]}.
  objects는 최소 2종이며 id 이외 설명은 각각 12자 이상이다. footprint는 지상 점유 면적/근거와 불확실성, verticalFace는 높이를 표현하는 면이다. 자동차 전체 alpha bbox를 지상 폭으로 쓰지 않는다.
  references는 실제 공용 기준 PNG의 상대 경로/해시다. 차량 외에도 환경 구조의 기준 이미지를 확인한다. sources에도 같은 refs를 넣는다.
- phase=calibration은 자동차 1대+낮은 멈춤턱 1개+벽 모서리 등 최대 4종으로 최소 시점 표본만 만든다. 전체 주차장/2면/큰 차로 요구는 이 단계에서 보류한다. 해당 native 명세·검사·검수 프롬프트에도 범위를 반영한다.
  기존 5×26 턱 상자/세로 길이/전경 한줄 규칙을 고정하지 않는다. 윗면·낮은 전면·바닥 접지와 바퀴 가림을 기준으로 재설계한다. 새 모델/직접 그림 금지, 기존 native 하네스로 제작한다.
- phase=scene에 art-calibration.json이 있으면 camera의 references/groundPlane/heightAxis/lighting를 승인값 그대로 유지하고, 승인 sources를 도면 sources에 포함한다. 물체 위치는 조립 위치에 맞게 바꾼다.
- scene 재조립은 간결한 주차장 범위로 하고 멈춤턱·벽/등 부착·마감의 이전 실패를 전부 교정한다. 그림의 큰 단색 비율을 줄이려고 임의 노이즈/소품을 넣지 않는다.
독립 검수는 이전 실패 그림과 1배/3배 결과를 비교한다. 표본이 합격해도 사람 선택은 공간 재조립 검수 후다.
