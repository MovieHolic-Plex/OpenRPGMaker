# 반려된 공간의 준비 입력 수정
작업 폴더 {{ROOT}}, 개념 폴더 {{CDIR}}.
입력 검증 모듈 {{ART_LAYOUT_MODULE}}의 부모를 sys.path 맨 앞에 넣어 import art_layout 한다.
승인된 모델 {{ART_MODEL_OVERRIDE}}, 실행 상한 {{ART_LIMITS}}.
현재 수정 지시 {{ART_FEEDBACK}}.

## 대상과 근거
현재 개념 폴더의 art-execution.json에서 실제 harness/data/판 경로를 읽고 그대로 같은 하네스를 쓴다.
art-layout-input.json과 art-layout-review.json의 반려 지적, art-feedback.json의 policy를 읽는다.
현재 planning.json/materials.json이 새로 승인되었으면 새 기획의 크기·좌표를 따른다.
옛 planning-source나 기존 queued 판의 넓은 크기를 그대로 고정하지 말고 시드·조립 계약까지 새 기획과 일치시킨다.
교실은 교실, 공동묘지는 공동묘지, 하수도는 하수도다. 다른 공간의 명세나 기준차를 요구하지 않는다.
parking-repair-brief.json, art-acceptance.json, art-calibration.json은 있을 때만 적용한다.
없는 선택 파일을 사용자에게 요구하거나 다른 공간 파일로 대체하지 않는다.
공용 참고자료는 reference-source.json과 이전 추출본의 해당 용도 MD·이미지를 재사용한다.
기존 수정 제안서가 있으면 활용하고 이미 조사한 전체 자료/위키를 반복 조사하지 않는다.

## 수정 범위
반려된 치수·방향·접합·여백·문 개구·배치부터 수정한다.
빈 공간이 많으면 외벽과 canvas를 줄인다. open/corridor도 축소 대상이다.
가로·세로 축소안을 실제 좌표와 기능으로 비교하고 불필요한 패딩·중복 활동 면적을 제거한다. 수학적인 최소 면적은 목표가 아니다. 더 조밀한 배치만을 요구하는 옛 지적은 실제 과대 바닥과 구분해 repairPlan에 근거를 남긴다.
통로/발표/시야라는 이름, 소품 추가, 가구 축소, 필수 좌석 삭제로 과대 바닥을 정당화하지 않는다. 실패를 만든 기존 keep 조건도 재검토한다.
policy.route/phase를 따르고 layout.repairPlan에 변경점과 폐기한 잘못된 가정을 구체적으로 남긴다.
completionRepairs의 필수 항목, 승인된 시점, 다른 Allow 예시와 기존 검수 기록을 보존한다.
별도의 data/판 경로에서 기존 하네스의 prepare 경로로 새 queued 입력만 준비한다.
후보 수는 candidateCount 이하, nativeAttempts=1이다. 기존 완료 후보를 queued로 되돌리지 않는다.
캔버스/grid/범례, 치수, footprint/topFace/verticalFace/contact/occlusion,
방향별 벽·모서리·문 개구와 통행, 시드·brief·미래 검수 프롬프트의 좌표를 일치시킨다.
layout의 sources는 실제 새 시드·DB·판·brief·프롬프트·native 코드·기준 이미지의 현재 해시를 포함한다.
현재 art-feedback.json SHA256을 execution.feedbackSha256에 넣는다.

## 재반려를 줄이는 완료 확인
직전 review.fixes 전부를 repairPlan에서 항목별로 대응한다. 각 항목에 수정 파일/좌표,
수정 전후 값, 확인 결과를 남긴다. 반영하지 못한 항목을 완료했다고 쓰지 않는다.
검수자가 실제 좌표로 제시한 가로·세로 축소안과 결합안을 먼저 검토한다.
한 행/열만 줄이고 끝내지 말고 남은 삭제 가능한 전폭 행/열도 같은 작업 안에서 점검한다.
필수 기능을 잃는다면 구체 동작·점유 충돌로 설명하고 원래 폭을 유지한다.
벽 마스크는 문장 수정만으로 완료하지 않는다. 각 방향의 실제 합성 코드·offset·clip을 대조해
윗면/정면이 잘리는지, 보행칸을 덮는지 확인한다. 기존 높은 벽/낮은 둑의 마스크를
서로 다른 방향에 재사용해 생긴 지적은 모든 해당 방향에서 해결한다.
마지막에 도면·시드·주문서·camera·미래 작업 프롬프트를 함께 검색해 폐기한 좌표가 남지 않게 한다.

## 역할 경계
현재 준비 작업자는 그림을 직접 그리거나 하위 모델/native를 실행하거나 PASS를 작성하지 않는다.
사용자에게 판/부품/명세를 고치라고 요구하지 않는다. 기술적인 수정은 준비 작업자가 수행한다.
이 금지는 현재 역할에만 적용한다. 미래 reviewTemplate에는 실제 그림을 보고 지정 verdict.json에
PASS/FAIL, 필수 항목별 근거와 구체 수정 지시를 반드시 쓰도록 한다.
실행기 전면 재설계와 전체 풀 구동, 후보 선택·설치·공용 게시를 하지 않는다.
감독이 승인 모델을 주입하므로 모델 변경을 재질문하지 않는다.

## 준비 결과 계약
layout.repairPlan에는 route(policy.route와 같음), phase, changes(30자 이상 변경 요약),
supersededConstraints(30자 이상 폐기한 고정 조건 근거)를 쓴다.
항목별 fixes로 대신 설명할 때는 각 target/before/after/modifiedFiles/verificationResult를 빠짐없이 쓴다.
최종 제출 전에 import art_repair; art_repair.require_preparation(ROOT, Path(CDIR), layout, feedback)를
실제 현재 도면·피드백으로 실행한다. build_input만 통과했다고 준비 완료로 끝내지 않는다.
기존 구조 조립 코드가 있으면 빈 슬롯의 context 조립도 실행해서 필드/파일 오류를 먼저 찾는다.

## 출력
art_layout.build_input(ROOT, execution)으로 기계적인 입력 일치를 확인한다. 도면 PASS 선언은 하지 않는다.
{{CDIR}}/art-result.json에 실제 하네스에 맞는 execution을 기록하고 종료한다.
interior-props: {"execution":{"harness":"interior-props","data":"새 data 상대경로","picks":"격리 picks 상대경로","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]}
modern-chipset: {"execution":{"harness":"modern-chipset","data":"새 data 상대경로","runs":"새 runs 상대경로","viz":"격리 viz 상대경로","round":"새 queued 판 id","feedbackSha256":"현재 피드백 해시","layout":{"path":"새 도면 상대경로","sha256":"도면 해시"}},"remaining":[]}
감독이 도면 독립 검수 후 native 실행을 담당한다. 준비가 실패해도 출력 파일을 생략하지 말고
{"candidates":[],"reasons":["실제 기술 원인과 수정 시도"]}를 남긴다.

## 입력과 생성 출력 구분
선택 저장소 picks/picks.sqlite와 WAL/SHM은 도면 sources에 넣지 않는다. 읽기·체크포인트만으로
파일 바이트가 달라질 수 있고, 선택은 별도 현재 해시 영수증으로 확인한다. 실행 후보의
data/harness.sqlite와 주문서·시드·코드·원본 그림의 해시 결합은 유지한다.
reference-source.json의 sources 배열이 있으면 각 references의 directory/INDEX.json에서 현재 용도를 고른다.
생성 과정에서 덮어쓰는 art-output 아래 장면 PNG/assembly-evidence.json을 제작 전 기준으로 쓸 때는
layout.sources의 해당 ref에 role="generated-preview"를 지정한다. 감독이 독립 검수 전에 불변 사본을 만든다.
원본 아틀라스·시드·명세·코드를 generated-preview로 분류하지 않는다. 생성 결과 자체는 수집 후 실제 그림으로 다시 검수한다.
문맥 예산: 대형 JSON·소스·격자를 통째로 출력하지 않는다. rg로 위치를 찾고 최대 120줄씩 읽고,
해당 용도 MD 전 페이지는 나누어 확인하며 진행 메모로 중복 열람을 줄인다. PNG/base64 텍스트 출력 금지.

## 기존 결과의 실행 입력이 없는 경우
이전 버전의 art-execution/art-layout 파일이 없다는 사실만으로 중단하지 않는다.
planning.json의 승인 기획, art-demo-input.json의 components, art-result.previous.json,
실제 native 영수증·완료 후보 저장소에서 근거를 읽어 새로운 layout/repairPlan을 준비한다.
기존 그림 자체가 합격이고 지적이 배치·문 방향·통행·출구 명세 수정이면 원본 도트를 다시 그릴 필요가 없다.
수정 도면에서 기존 그림을 써서 해결할 수 있음을 구체적으로 명세하고 execution.resumeMode="collect-existing"를
제출할 수 있다. 완료된 native 후보만 허용되며 감독은 새 도면의 독립 검수 후 수집→데모 재조립→시각 검수를 수행한다.
없는 PASS를 만들거나 완료 후보를 queued로 바꾸지 않는다. 실제 그림 결함/필수 조각 누락은 기존 제작 경로를 따른다.

`theme-material-feedback.json.kind=missing-production`이면 이전 승인 도면의 결함을 다시 만들라는 뜻이 아니다.
covered/기존 art-batches 원본을 보존하고 missing만 새 격리 제작 묶음으로 준비한다.
직전 PASS의 공간 기하·해결된 수정은 유지하고 미제작 재료의 접지·시점·부착 계약만 보완한다.
art-actors.json에 별도 인물 주문이 있으면 상태/원본을 읽고 중복 생성하지 않는다.

## 바닥 타일의 native 분류
소품 하네스에서 `kind=floor`는 바닥에 서는 입체 가구다. 지형 바닥이라는 뜻이 아니다.
production 묶음의 모든 칸이 `layer:0`, `topMin:0`인 바닥/무늬는 `kind:flat`으로 준비한다.
불투명 석판·목재 타일에 가구의 투명 귀퉁이 검사를 적용하지 않는다. 검사 코드를 약화하거나
바닥에 투명 구멍을 뚫지 말고 분류를 바로잡는다. 입체 기물/벽은 실제 설치 레이어와 종류를 유지한다.
변경된 sets.json·시드·코드를 도면 sources에 묶고 독립 도면 검수를 받는다.

## 병렬 제작의 받침 의존성
카운터/탁자 등 이번에 만드는 받침 위에 놓이는 소품은 그림 제작을 병렬로 하되 검수 순서를 명시한다.
interior-props `data/seed.json`의 `reviewDependencies`에 소품 id별 `[{"item":"받침 id","candidate":"h8-A"}]`를 기록한다.
실제 주문 round/letter에 맞춰 지정하고 seed 및 `src/harnesses/interior-props/review_dependencies.py`를 layout.sources에 묶는다.
받침의 실제 PNG가 기계·독립검수 PASS인 뒤 소품 검수가 시작된다. 빈 v5.png를 받침으로 사용하지 않는다.
후보가 여러 개면 임의 자동선택하지 말고 이번 검수에 쓸 후보를 계약에 명시한다. 이미 완성된 받침도 실제 PNG·해시를 근거에 연결한다.
# 교체된 부품의 보존과 실제 사용
현재 공간에서 더 이상 사용하지 않는 옛 부품도 PNG/영수증은 보존한다. 새 부품을 만들 때 네이티브
품목 이름이 달라졌다면 전체 데모가 두 품목을 모두 강제로 사용하지 않도록 layout.componentReplacements에
[{"from":"기존 art-choices 그룹 ID","to":"새 native 품목 그룹 ID","requirement":"동일한 기획 재료 ID","reason":"교체 이유와 보존할 역할"}]를 명시한다.
현재 수집 전에는 to가 새 네이티브 품목 ID여야 한다. 새 부품이 그 재료의 필수 기능을 전부 대체하는
경우만 쓰며, 기존 가마솥/후드와 새 배기 지지대처럼 역할을 나눠 사용하는 품목은 함께 보존한다.
이 명세는 새 도면 독립 검수에 포함한다. 감독은 이전 납품과 새 coverage가 같은 재료인지 확인한다.
예전 문을 수집 자료로 보존하기 위해 승인 도면에 없는 문을 방 안에 덧붙이지 않는다.

## 부품 검수와 전체 장면 검수의 순서
전용 부품 제작은 병렬이므로 아직 제작되지 않은 다른 부품과 최종 네 상태 장면을
개별 품목의 native PASS 선행 조건으로 요구하지 않는다. reviewTemplate는 현재 품목의
실제 PNG/필수 슬롯, 시점·비례·접합·반복 이음과 그 품목에 필요한 작은 실제 조립 표본을 검사한다.
벽의 연속 이음, 문의 실제 개구폭/평행성, 수납 띠와 사람의 국소 접근은 실제 표본으로 확인한다.
해당 국소 표본이 없으면 그 표본 생성/검수 작업으로 돌리고 그림을 이유 없이 다시 그리지 않는다.
모든 부품/인물의 보존, 방 전체 네 상태, 전체 동선·명암·공간 정체성은 art-demo 조립 후
art-context-review에서 필수로 확인한다. 이를 native 부품 PASS에 끌어와 순환 대기를 만들지 않는다.
전체 검수 의무는 layout/completionRepairs에 보존하며 최종 공간 PASS 전에 해소한다.
기존 FAIL 판정이나 원본을 덮어 PASS로 바꾸지 않는다. 새로 승인받은 검수 입력과 범위로
별도 검수 영수증을 남기고, 실제 픽셀 결함이 없는 품목은 원본을 보존한다.

## 같은 품목을 부분 수정할 때 원본 보존
새 후보가 이전 후보의 일부만 바꾸면 보존할 나머지 조각을 누락시키지 않는다.
layout.preservedSources에 {path,sha256,requirement,reason}를 기록하고 layout.sources에도 같은 원본을 묶는다.
requirement는 기존 themeCoverage의 재료 ID, reason은 보존할 부분과 배치 사유다.
원본은 동일 테마 art-batches의 native 영수증 candidateImages와 themeCoverage 양쪽에서 확인돼야 한다.
예: 양옆 낮은 선반을 새로 그려도 기존 북쪽 선반 crop은 보존 원본으로 명시한다.
도면 독립 승인 이후에만 사용 가능하다. 실행 중인 승인 도면을 직접 수정하지 않는다.

## 전체 공간 수정의 범위 유지
이전 반려 대상이 space-demo이면 시점 결함도 phase=scene 안에서 고친다.
교체된 옛 부품을 각각 다시 승인받는 calibration으로 되돌아가지 않는다.
이름이 달라진 교체 부품은 componentReplacements로 연결하고, 보존할 일부 원본은 preservedSources로 명시한다.
도면을 새로 승인받은 뒤 현재 전체 공간 데모와 독립 검수를 다시 제출한다.
