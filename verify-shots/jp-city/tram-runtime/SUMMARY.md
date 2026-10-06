# 노면전차 거리 런타임 QA

판정: **통과**

- PASS — 노선 4개(차 동·서, 전차 동·서): traffic-ew12-right, traffic-ew22-left, tram-ew15-right, tram-ew18-left
- PASS — 차가 양쪽 일방 차로로 달린다: 동쪽행 2대 Δx 6.27 · 서쪽행 2대 Δx -6.27
- PASS — 차가 궤도 위를 달리지 않는다: 없음
  (차 행: right:y12 left:y23)
- PASS — 서쪽행 전차가 안전지대 옆에 서서 문을 연다: x 23~34 y 18 프레임 left_open
- PASS — 전차 몸이 섬 앞(궤도 18~19, 주인공 x 위): x 23~34
- PASS — 「조사」로 전차를 타면 동네 역 앞으로: jp-city-town (41,12)
- PASS — 지하철 출입구 계단으로 들어가면 콘코스: jp-city-station-concourse (12,4)

증거: `flow.png`(차·전차 흐름) · `tram-stop.png`(섬 옆에 선 전차)
