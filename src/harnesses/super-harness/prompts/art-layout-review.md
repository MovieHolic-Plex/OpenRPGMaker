# 그림 제작 전 실제 표본 도면의 적대적 검수
입력 {{INPUT}} / 출력 {{OUTPUT}} / 작업 폴더 {{ROOT}}
이전 실패 피드백: {{FEEDBACK}}

입력의 layout.grid(ASCII), legend, areaCells와 sources의 실제 치수 계약·주문서를 읽는다.
현재 도면 자체를 평가한다. 기존 planning.json 승인은 이 축소/변경 표본의 승인이 아니다.
준비자가 정한 좌표와 숫자도 반려할 수 있다. 계약 준수를 공간 품질로 착각하지 않는다.
그림을 그리거나 파일을 고치지 않는다. 출력 JSON 하나만 기록한다. 하위 작업자를 시작하지 않는다.

각 축 PASS/FAIL + 구체 좌표/비율/이용 동작을 포함한 evidence(20자 이상):
- proportions: 실제 기준차/기물의 투영 크기와 주차면·폭·벽 높이의 비율이 자연스러운가? 들어가기만 하면 PASS가 아니다.
- spaceUse: 모든 여백의 기능을 따져라. 화면 오른쪽/아래쪽의 이유 없는 패딩, 과도한 후퇴 간격, 넓은 빈 바닥을 검출한다. 빈칸을 clearance/circulation으로 이름만 바꿔도 통과시키지 않는다. 실제 출입/회전/보행에 필요한 위치·크기인지 본다. 밀도 숫자만 높이려고 장식을 채우는 것도 FAIL. 필요 없는 면적은 화면과 벽을 줄여야 한다.
- circulation: 입구→접근→주차/활동→출구의 연결과 차체 기준 회전/하차 여유. 작은 표본의 범위를 넘어선 시설 전체를 요구하지 않는다.
- identity: 라벨을 가려도 공간을 알 수 있는 구조·재료·설비 단서가 계획되어 있는가? 전체 경사로/차단기를 보류했어도 조명/벽 마감/구조 리듬 등 작은 구역에 필요한 단서는 남겨야 한다.
- composition: 실제 타일 게임 화면으로 볼 때 내용에 맞는 화면 크기, 벽과 주차열의 관계, 시선 위계, 명암/재료 구분이 계획되었는가? 단색 바닥과 선만 큰 방에 놓은 도면이면 FAIL.

손상된 부분을 조금 고치는 것으로 완료 선언하지 않는다. 이전 후보가 더 큰 구조 문제를 보이면 그 문제도 기록한다.
한 축 FAIL이면 전체 FAIL. 수정은 asset/assembly/spec로 구분하고 구체 target/problem/change/keep을 기록한다.
출력:
{"gateVersion":3,"fingerprint":"입력 fingerprint","verdict":"PASS 또는 FAIL","checks":{"projection":{"verdict":"PASS 또는 FAIL","evidence":"바닥과 높이·접지·가림 검토"},"proportions":{"verdict":"PASS 또는 FAIL","evidence":"관찰"},"spaceUse":{"verdict":"PASS 또는 FAIL","evidence":"관찰"},"circulation":{"verdict":"PASS 또는 FAIL","evidence":"관찰"},"identity":{"verdict":"PASS 또는 FAIL","evidence":"관찰"},"composition":{"verdict":"PASS 또는 FAIL","evidence":"관찰"}},"reasons":[],"fixes":[]}

- projection: layout.camera.references의 실제 이미지를 열어 groundPlane/heightAxis/lighting와 물체별 footprint/topFace/verticalFace/contact/occlusion을 대조한다. 윗면이 띠가 아닌 면인가? 세로 화면 길이를 물체 높이로 읽게 만드는 모순이 있는가? 차의 알파 bbox 높이를 지상 폭으로 취급했으면 FAIL.
layout.repairPlan이 피드백 policy의 단계로 되돌아갔는지 본다. 반복 실패에 기존 치수/방향을 그대로 유지한 채 명암만 바꾸면 FAIL.
phase=calibration이면 최대 4종(기준차+낮은 멈춤턱+벽 모서리)의 작은 시점 표본이다. 전체 주차장/두 주차면/완성 출입 동선은 요구하지 않는다.
표본 범위의 접지·면 구분·기준 대비 관계를 먼저 확정하고 scene은 그 뒤 별도로 검수한다.
통행은 도색선이 아닌 실제 장애물/걷는 바닥으로 판단한다. 도색선 경계 하나만 보고 좁다고 반려하지 않는다.
