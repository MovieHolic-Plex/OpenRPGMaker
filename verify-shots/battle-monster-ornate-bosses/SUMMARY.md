# 화려한 요괴·대형 보스 제작 · 2026-10-06

## 결과

실제 battle-monster 하네스로 신규6종을 제작해 검토 대시보드에 게시했다.
홍련 구미호·뇌운 해태·연화 화귀는 native96, 금갑 도깨비왕·청린 이무기·산군 백호는 native128.
각18자세/8동작 GIF, 현재 후보 합계108자세/48GIF다. 기존64px 인간형과 동일 픽셀 배율로 비교한다.
대표 구미호 먼저, 이후5종을 별도 후보 폴더에서 최대3명으로 저작했다.
실제 GPT6.1sol/high 저작자와 별도 새 독립 검수자를 호출했다. 실제 controller3개의 종료코드는 모두0이다.

- 실제 화면: http://100.73.251.77:18346/
- 빠른 그림 확인: `ornate-roster.png`, `lotus-flame-spirit-paused.png`, `golden-dokkaebi-king-paused.png`
- 동작: 대기·공격(준비/전진/타격/회수)·피격·쓰러짐·스킬·독·기절·수면.
- 화려함의 소재: 아홉 꼬리/불꽃, 금갑/철퇴, 비늘/갈기, 예복/큰 소매, 뿔/뇌운, 백호의 털 줄무늬.

## 실제 확인 근거

`browser-proof-all.json`: 실제6후보가 suite/ready이며 각8GIF가 native96/128로 로드된다.
백호 보완판은8동작 각각의 이전/수정 후를 함께 보여16GIF다. 일시 정지/재생을 실제 클릭했다.
크기 비교 canvas는 몬스터/64px 인간형을 같은2배로 그린다.1440px 데스크톱과375/320px 좁은 화면을
확인했으며 가로 넘침/페이지 오류는0이다. 선택 버튼은 누르지 않았다.

`source-archive-proof.json`: 저장소의 지속 원본을 다시 읽어 live source binding과6종 모두 일치한다.
18격자/투명 테두리/접지/팔레트 검사, native PNG와 GIF의 픽셀·시간 재읽기는 하네스 계약을 따른다.
`root-authoring-audit.json`: 실제 ASCII/선택 좌표와 helper를 읽고 원/다각형/전체 프레임 변환으로
형태를 만드는 호출이 없음을 확인했다. 정적 코드/픽셀 검사는 미감이나 자연스러운 움직임의 합격을 뜻하지 않는다.
저작 원본·actual jobs/지시/결과·독립 검수·생산 시간표는 `harness-data/battle-monster/authored/20261006/`.
현재6후보와 초기 백호를 포함해7개 원본 버전을 보존했다. 외부 참고 이미지 바이트/events.jsonl은 복사하지 않았다.

`state-selection-proof.json`: 실제 선택52건의 기존 행과8종의 선택 binding을 그대로 보존했다.
새 선택은0건, 새6종은 모두 pending이다. 원래17종의 seed/전역 style도 동일하며6종만 추가했다.
완료 시점 working/making은0이다. 실제 사용자 Allow/Modify/Deny는 live ledger에 있으며 이 변경에 커밋하지 않는다.

## 백호의 제한된 교정

초기 원본이 짧은 반점으로 읽혀 별도 AI 교정 `ornate-boss-stripes-v2`를 만들었다.
18자세의 털색2179픽셀을 자세마다 직접 골라 굽은 줄무늬로 교정했다. `stripe-scope-proof.json`은
팔레트 바이트/모든 alpha 윤곽/생산 시간표가 동일하고 다른 색의 픽셀은 보존됨을 입증한다.
현재 자식이 대기 목록에 있고 원본 v1은 이전 결과/출처에 남는다. 사용자 Modify/Allow를 만들지 않았다.

## 독립 시각 검수

추천을 실제 그대로 남겼다. 모든 현재 후보가 rework 의견을 받았으며 자동 재시도/사용자 승인으로 바꾸지 않았다.
주요 의견에는 꼬리 부피, 관절/장식 연결, 일부 자세의 빈틈과 추진력, 공격과 상태이상의 차이가 있다.
이는 추가 미감/동작 교정 대상이며 사용자는 결과와 움직임을 보고 Allow/Modify/Deny를 결정한다.

| 현재 후보 | 실제 추천 | 의견 수 |
|---|---|---:|
| azure-scale-imugi/ornate-boss-v1 | rework | 11 |
| crimson-nine-tail-fox/ornate-boss-v1 | rework | 7 |
| golden-dokkaebi-king/ornate-boss-v1 | rework | 9 |
| lotus-flame-spirit/ornate-boss-v1 | rework | 7 |
| mountain-white-tiger/ornate-boss-stripes-v2 | rework | 8 |
| thunder-cloud-haetae/ornate-boss-v1 | rework | 7 |

## 범위

원본을 검토 자산 저장소에 저장하고 재로드했다. 게임 프로젝트 정본/적 레코드/전투 피해 시점에 설치했다고
보고하지 않는다. 검토용 GIF 순서 재생을 실전 전투 영상으로 주장하지 않는다.
사용자 요청 없이 Vitest/gates/전체 typecheck를 실행하지 않았다. native 하네스 검사와 실제 읽기 전용 화면 확인을 했다.
