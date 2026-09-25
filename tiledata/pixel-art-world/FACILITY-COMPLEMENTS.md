# 시설 별도 보완 원본 5종

새 원본 5종, 독립 atlas 5개, 완전체 객체 12개, 방향·받침 조립 표본 5개다.
이 표본은 완성된 시설·도로·실제 플레이 공간이 아니다. 기존 loose atlas, tile ID,
539객체, 소품 보충5팩의 메타데이터·준비물을 변경하지 않는다.

| 원본 | 실제 규격 | 객체 | 설치·검토 |
|---|---:|---:|---|
| SPT-Gym01.png | 64×64 | 2 | 각32×64 졸업식/무문자 입간판. 다리가 있는 바닥 자립물 |
| SPT-Signal01.png | 128×256 | 2 | 각64×256 지주 전체+그림자. 정면/후면 사선 보기 구별 |
| SPT-WSchool01.png | 256×128 | 3 | 192×96 3연창,64×96 세로창,64×32 작은 가로창. 모두 벽 부착 |
| SPT-kitchen01.png | 192×256 | 4 | 각96×128 청/적/베이지/갈색 L주방. 상부장 벽+하부장 바닥 |
| gtaible.png | 160×96 | 1 | 5×3 유리탁자 전체. 상판·세 다리·그림자를 보존 |

공식 페이지: [특별교실/체육관](https://yms.main.jp/dotartworld/page2/tile-school02.html),
[편의점/신호등](https://yms.main.jp/dotartworld/page2/tile-conveni01.html),
[목조학교/어두운 창](https://yms.main.jp/dotartworld/page2/tile-schoolw01.html),
[주택/주방 색상](https://yms.main.jp/dotartworld/page2/tile-townI01.html),
[사무실/유리탁자](https://yms.main.jp/dotartworld/page2/tile-office01.html).

정확한 SHA·sourceRect·target·sourceBounds·supportCells·blockingCells·방향·접근칸은
`facility-complements.json`을 따른다. sourceRect/target/sourceBounds는 픽셀,
sourceBounds는 해당 sourceRect 내부의 상대 bbox이고 끝 좌표는 exclusive다.
occupied/blocking/support/outputRect와 whole arrays는32px칸이다.
원본을 resize/반전하지 않고 원래32px 사각 범위를 그대로 유지한다. 특히 작은 창의
아래8px와 입간판 아래9px 투명 여백을 alpha bbox로 잘라 정렬을 바꾸지 않는다.
원본5장의 모든 비투명 픽셀이 이12개 sourceRect에 포함되는지를 private geometry
receipt에서 확인한다. 이는 임의 연결/반복 조립을 모두 검토했다는 의미가 아니다.

신호등의 왼쪽 불투명 bbox 끝은 y179 exclusive, 실제 끝은178(지지행5)이다.
아래 alpha76 그림자는254행까지 이어져도 추가 통행 차단을 만들지 않는다.
오른쪽 실제 밑동은242(지지행7)다. 명시한 밑동만 차단하고, sourceRect 전체와
그림자는 그림으로 보존한다. 앞/뒤 신호함이 함께 있는 지주라 단일 북/남 향으로
단정하지 않으며 앞사선/뒷사선 보기와 실제 접근 좌표를 따로 기록한다.

유리탁자는 실제 alpha가0 또는255이고 불투명 픽셀9501개다. 반투명 느낌은 그려진
유리 재질 표현이며 통행 가능 신호가 아니다. 원본5×3 전체를 보수적으로 막고
왼쪽 앞다리/가운데 앞다리/오른쪽 뒷다리 받침을 실제 바닥에 놓는다.

L주방은 상부장 뒤 벽, 싱크/레인지 밑동의 바닥을 함께 요구한다. 원본의 L 안쪽
빈 칸은 upper -1이므로 접근에 사용한다. 정상/오류 예제도 밝은 벽과 원본 목재
바닥을 분리한다. 작은 조립 표본에는 청색1개를 쓰며,4색을 큰 빈 전시장에 나열하지
않는다. 청/적이 기존 주택 본판에 포함된다는 공식 설명과 별도 PNG의 판본을 구분한다.

받침 원본은 ST-Schl-Gym / ST-Convi-E01 / ST-Schl-WI01 / ST-Town-I01 /
ST-Icecream-I01에서 각1개씩 함께 선택한다. 별도 RTP 픽셀은 쓰지 않는다.
정본 프로젝트 `6ae74f7a-23a2-449b-8171-5afb5dff532b` revision54에서 관련 현재
참고문서를 읽고 export한 다음 실제 이미지와 보완 원본을 대조했다. 주방은 같은
ST-Town-I01의0번 목재바닥을 새로 명시 검토해 벽/바닥 경계를 분명히 했다.

제작자 일반 조건과 각 원본 안내를 보존한다. 사용자 다운로드 원본과 파생 그림은
Git/public/앱 번들에 넣지 않는다. 원본/가공 소재 재배포 금지, 공개 게임 크레딧 필요.
새 권리 승인·출입·조리·착석·교통 로직·문/창 개폐 기능을 주장하지 않는다.
