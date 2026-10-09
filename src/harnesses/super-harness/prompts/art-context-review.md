# 조립한 칩 후보의 독립 적대적 검수

입력 {{INPUT}}
출력 {{OUTPUT}}
후보 워크트리 {{ROOT}}

입력 JSON만 먼저 읽고 groups의 모든 candidates.images를 실제로 연다. 모든 열림/닫힘 그림을 확인한다.
previousResponseError가 있으면 이전 원문과 구체적인 오류를 확인해 보완한다. 형식 오류를 고치려고 기존 FAIL이나 관찰 근거를 지우거나 합격으로 바꾸지 않는다.
supplementaryEvidence가 있으면 supplementaryDataRoot 기준 files의 판정·비교 그림을 실제로 읽고 scope를 확인한다. 같은 원본의 재검수 근거이며 현재 전체 방의 합격을 대신하지 않는다. 이전 READ 누락이 해소됐는지와 새 장면의 실제 결함을 구분한다.
부품별 PASS는 공간 합격이 아니다. 기존 실패 피드백과 repairBrief를 읽고 지적이 실제로 해결됐는지 확인한다.
comparisonObligations의 required=true 항목은 시설 완료를 막는 결함이다. 다음 세대에도 전부 비교하며
advisory/deferred로 낮출 수 없다. 미해결이면 FAIL+fixes로 재작업한다. 실제 전후 그림으로 반증한
invalid-prior-claim은 가능하지만 필수 criterionResults와 모순되어서는 안 된다.
그림·시드·기획·선택·공용 저장소는 수정하지 않는다. 출력 JSON만 기록한다. 하위 작업자를 부르지 않는다.

아홉 축을 각각 관찰 좌표/물체와 함께 판정한다.
- identity: 설명과 라벨을 가려도 해당 공간으로 읽히는가.
- scale: 실제 공용 자동차/기준 기물이 장면에 있으며 원본 비율과 주차면·차로·멈춤턱 크기가 맞는가. 기준 그림이 없으면 주차장 scale은 FAIL.
- attachments: 벽·모서리·바닥이 잇닿는가. 문은 벽 개구부, 계단/경사로는 출입 연결, 차단기는 차로에 연결되는가.
- circulation: 기준 물체가 장면에서 들어오고 이동하고 머물 수 있는 여유가 보이는가. 막힌 외벽 안의 출입 경사로를 합격시키지 않는다.
- projection: 3/4 탑뷰의 바닥 깊이와 물체 높이를 구분한다. 기준 이미지와 camera 계약을 실제로 대조하여 지붕/윗면이 면으로 보이는지, 낮은 기물이 바닥에 누웠는지, 수직면 두께·접지·가림 순서가 같은 시점인지 평가한다. 자동차 알파 bbox 높이는 지상 폭/충돌폭이 아니다.
- style: 시점·명암·물체 두께가 통일되는가. 낮은 멈춤턱을 기둥으로, 천장 기물을 바닥 기물로 오인하지 않는가.

- spaceUse: 주차면/차로/보행에 필요한 여백과 이유 없이 남는 바닥을 구별한다. 좌표·면적 비율을 관찰하고 오른쪽/아래의 낭비를 반려한다. clearance라는 이름은 근거가 아니다.
- composition: 실제 게임 화면의 공간 밀도·명암 위계·구조 리듬·재료 구분이 충분한가? 조잡하거나 미완성인 방에 차/선만 놓였으면 FAIL. 장식으로 면적을 채워도 통과시키지 않는다.
- specification: 승인된 도면/명세 자체의 치수·축척·방향이 틀렸는지 독립적으로 판단한다. 부품/도면 PASS를 품질 근거로 쓰지 않는다. 명세대로 그렸어도 빈약한 공간이면 spec/assembly 수정으로 반려한다.

입력 approvedLayout과 실제 결과를 비교한다. 이미지에 보이는 문제가 새로 생겼으면 추가로 지적한다.
부품 검수가 FAIL이어도 공간 전체를 검수하여 모든 문제를 함께 다음 수정으로 보낸다.
각 후보 판정에 gateVersion:3를 반드시 기록한다. checks에는 위 아홉 키를 모두 쓴다.
repairBrief에 따라 작은 표본에서 보류한 부품의 부재를 실패로 세지 않는다. 있는 부품의 잘못된 배치는 실패다.
실패마다 category(asset 그림 / assembly 배치 / spec 치수·명세), target(구체 부품/좌표), problem,
change(다음 저작자가 실행할 변경), keep(유지해야 할 합격 요소)을 fixes에 기록한다. "더 좋게" 같은 추상 지시 금지.
한 축이라도 FAIL이면 후보 전체 FAIL. PASS는 아홉 축 모두 PASS와 관찰 근거가 있어야 한다.

입력 manifestSha256, 후보 fingerprint, images의 sha256을 그대로 연결한다. 일부 후보를 생략하지 않는다.
```json
{"manifestSha256":"입력값","groups":{"group-id":{"candidate-id":{
 "gateVersion":3,"fingerprint":"입력 후보값","verdict":"FAIL","imagesSeen":["각 조립 이미지 sha256"],
 "checks":{"projection":{"verdict":"PASS","evidence":"기준 이미지와 윗면·수직면·바닥 접지 비교"},"identity":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"scale":{"verdict":"FAIL","evidence":"실제 위치·물체 관찰"},"attachments":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"circulation":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"style":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"spaceUse":{"verdict":"FAIL","evidence":"오른쪽 여백의 용도·면적 관찰"},"composition":{"verdict":"FAIL","evidence":"화면 전체 구조와 명암 관찰"},"specification":{"verdict":"FAIL","evidence":"명세 치수 자체의 결함 관찰"}},
 "reasons":["사람이 읽을 수 있는 실패 이유"],
 "fixes":[{"category":"spec","target":"주차면","problem":"기준 차량 없음","change":"공용 자동차를 원본 배율로 놓고 차폭에 맞춰 주차선을 수정","keep":"통과한 벽·바닥 색과 시점"}]
}}}}
```

## 전후 비교와 시점 표본 (v3 필수)
입력 previousImages의 모든 이미지를 열고 현재 1배/3배 그림과 비교한다. previousImagesSeen에 그 sha256 전부를 기록한다.
comparisonObligations의 해당 group 항목마다 comparisons[id] = {status, before, after, evidence}를 작성한다.
status: resolved / unresolved / invalid-prior-claim / deferred. before/after/evidence는 각각 20자 이상,
입력 obligation id를 정확히 그대로 사용한다. 추가 관찰은 필수 비교를 대체하지 않으며, 추가 comparisons에도 동일한 근거·미해결 FAIL 규칙을 적용한다.
구체적인 좌표·외곽선·접지·면 분리를 들어 설명한다. 같은 크기/색만 유지했다는 말은 해결 근거가 아니다.
unresolved가 하나라도 있으면 전체 FAIL 및 해당 checks FAIL, fixes에 다음 수정 지시를 쓴다.
이전 검수의 잘못된 주장은 invalid-prior-claim으로 판정할 수 있으나 실제 근거를 들어야 한다.
예: 도색선은 장애물이 아니다. 차의 알파 bbox와 바닥 점유/충돌 범위를 같다고 가정하지 않는다.
통행 불가 주장은 보행 가능 바닥의 합집합과 실제 장애물/몸통 범위로 판단한다. 없는 충돌 데이터를 검증했다고 하지 않는다.

approvedLayout.layout.phase=calibration이면 자동차+저상 기물+벽 모서리의 작은 시점 표본이다.
표본 범위에서 identity/spaceUse/composition 등을 평가하고, 전체 주차장/두 번째 주차면이 없다고 탈락시키지 않는다.
projection/style/scale 결함은 보류할 수 없다. 원래 전체 공간에서 해결할 항목만 deferred와 구체 이유를 허용한다.
표본 PASS는 공간 완성이나 사람 선택 승인이 아니다. 감독이 합격 표본을 보존하고 공간 재조립을 별도로 실행한다.
scene 단계에서는 deferred를 허용하지 않는다. 보류한 공간 결함까지 전부 비교해야 한다.

fixes의 keep는 사용자 제약과 다르다. 기존 5×26 상자나 바닥 긴축이 결함을 만든다면 그 조건을 spec으로 폐기/교체한다.
같은 축에서 반복 실패하면 색깔 수정만 지시하지 말고 형태/투영/기준 이미지의 잘못된 가정을 재검토한다.
깔끔한 콘크리트에 불필요한 노이즈나 소품을 넣어 밀도 수치를 맞추지 않는다. 면 분리·이음·접지·부착 관계를 평가한다.
