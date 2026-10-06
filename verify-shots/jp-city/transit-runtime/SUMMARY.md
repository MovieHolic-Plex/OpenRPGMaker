# 맵 위 탈것 비전 QA

판정: **통과**

픽스처(조수 도구 set_map_transit 실물):
```
픽스처: /home/main/z-project/rpg-zzu-jp-city-jp-houses/verify-shots/runtime-qa/transit/_fixture.json
  일본 도시 · 小学校 탈것 노선 3개(차 흐름 2, 버스 1) — 차도 띠 1개(동서 띠 y 44~47(폭 4) x 0~67 가장자리→가장자리) · 120초 시험: 탈것 16대. 게임에서 차는 주인공 앞에서 서고, 정류장에서 문을 연다.
[{"id":"traffic-ew44-right","kind":"road","path":[{"x":-12,"y":44},{"x":79,"y":44}],"stops":[]},{"id":"traffic-ew44-left","kind":"road","path":[{"x":79,"y":46},{"x":-12,"y":46}],"stops":[]},{"id":"bus-ew44-right","kind":"bus","path":[{"x":-12,"y":44},{"x":79,"y":44}],"stops":[{"index":52,"name":"学校前","waitSec":8,"board":{"mapId":"map_lantern_village","x":14,"y":18}}]}]
```

- PASS — 시작 맵: jp-city-school (35,41)
- PASS — 노선이 런타임에 도달: traffic-ew44-right, traffic-ew44-left, bus-ew44-right
- PASS — 맵 위에 그려진 탈것: 10대 / 전체 16대 — jp-car-white@64.6,44(right) jp-bus-city@32.0,44(right_open) jp-car-silver@26.0,44(right) jp-car-kei-yellow@21.0,44(right) jp-car-black@15.0,44(right) jp-bus-city@5.0,44(right)
- PASS — 동쪽행이 동쪽으로 달린다: 안 막힌 2대 중앙값 Δx 6.67칸/1.5초
- PASS — 서쪽행이 서쪽으로 달린다: 안 막힌 5대 중앙값 Δx -6.67칸/1.5초
- PASS — 화면이 실제로 달라진다: 변한 픽셀 18.92%
- PASS — 차가 주인공 칸을 덮지 않는다: 없음
- PASS — 주인공 바로 앞에서 차가 선다: jp-bus-city 꼬리..머리 x 11.0~20.0 막힘 16.95초
- PASS — 버스가 学校前 에 서서 문을 연다: jp-bus-city x 32~41 y 44 프레임 right_open
- PASS — 정차 프레임: right_open (동쪽행 = 오른쪽 면 — 문은 왼쪽 면에만 있어 right_open = right 그림)
- PASS — 「조사」로 버스를 타면 board 맵으로 간다: map_lantern_village (14,18)
- PASS — 다른 맵에서는 탈것을 치운다: 시뮬레이션 없음
- PASS — 지하철이 승강장에 서서 문을 연다: jp-subway x 9~39 y 4 프레임 right_open
- PASS — 지하철 문 연 프레임: right_open
- PASS — 지하철을 타면 board 맵(学校前)으로 간다: jp-city-school (35,41)

## 증거 파일

- `t0.png`·`t1.png` — 1.5초 간격(차 흐름) · `blocked.png` — 주인공 앞에 선 차 · `bus-stop.png` — 学校前 버스 정차 · `boarded.png` — 탄 뒤 도착 맵 · `subway-stop.png` — 승강장에 선 지하철
