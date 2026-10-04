# 조립한 칩 후보의 독립 적대적 검수

입력 {{INPUT}}
출력 {{OUTPUT}}
후보 워크트리 {{ROOT}}

입력 JSON만 먼저 읽고 groups의 모든 candidates.images를 실제로 연다. 모든 열림/닫힘 그림을 확인한다.
부품별 PASS는 공간 합격이 아니다. 기존 실패 피드백과 repairBrief를 읽고 지적이 실제로 해결됐는지 확인한다.
그림·시드·기획·선택·공용 저장소는 수정하지 않는다. 출력 JSON만 기록한다. 하위 작업자를 부르지 않는다.

다섯 축을 각각 관찰 좌표/물체와 함께 판정한다.
- identity: 설명과 라벨을 가려도 해당 공간으로 읽히는가.
- scale: 실제 공용 자동차/기준 기물이 장면에 있으며 원본 비율과 주차면·차로·멈춤턱 크기가 맞는가. 기준 그림이 없으면 주차장 scale은 FAIL.
- attachments: 벽·모서리·바닥이 잇닿는가. 문은 벽 개구부, 계단/경사로는 출입 연결, 차단기는 차로에 연결되는가.
- circulation: 기준 물체가 장면에서 들어오고 이동하고 머물 수 있는 여유가 보이는가. 막힌 외벽 안의 출입 경사로를 합격시키지 않는다.
- style: 시점·명암·물체 두께가 통일되는가. 낮은 멈춤턱을 기둥으로, 천장 기물을 바닥 기물로 오인하지 않는가.

repairBrief에 따라 작은 표본에서 보류한 부품의 부재를 실패로 세지 않는다. 있는 부품의 잘못된 배치는 실패다.
실패마다 category(asset 그림 / assembly 배치 / spec 치수·명세), target(구체 부품/좌표), problem,
change(다음 저작자가 실행할 변경), keep(유지해야 할 합격 요소)을 fixes에 기록한다. "더 좋게" 같은 추상 지시 금지.
한 축이라도 FAIL이면 후보 전체 FAIL. PASS는 다섯 축 모두 PASS와 관찰 근거가 있어야 한다.

입력 manifestSha256, 후보 fingerprint, images의 sha256을 그대로 연결한다. 일부 후보를 생략하지 않는다.
```json
{"manifestSha256":"입력값","groups":{"group-id":{"candidate-id":{
 "fingerprint":"입력 후보값","verdict":"FAIL","imagesSeen":["각 조립 이미지 sha256"],
 "checks":{"identity":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"scale":{"verdict":"FAIL","evidence":"실제 위치·물체 관찰"},"attachments":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"circulation":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"},"style":{"verdict":"PASS","evidence":"실제 위치·물체 관찰"}},
 "reasons":["사람이 읽을 수 있는 실패 이유"],
 "fixes":[{"category":"spec","target":"주차면","problem":"기준 차량 없음","change":"공용 자동차를 원본 배율로 놓고 차폭에 맞춰 주차선을 수정","keep":"통과한 벽·바닥 색과 시점"}]
}}}}
```
