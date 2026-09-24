# 얼어붙은 안개못

울타리 친 못이 통째로 얼어 석상 섬까지 걸어 들어갈 수 있는 설원 폐촌. 서쪽 강과 폭포는 얼지 않았다. 66×56, tilesetId=forest_harmony_snow, 원본 숲마을 mistpond-hollow(tiledata/forest-villages/diverse). 입구 (31,52). 통행 검사 목표 [[3,9],[43,11],[17,30],[48,30],[19,48],[50,50],[36,50],[30,32],[31,31]].

![얼어붙은 안개못](images/climate-snow-frozen-mistpond.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"unflowered","cells":15,"tiles":[348,288],"rule":"빈 땅의 들꽃·꽃덤불 → 이 시트의 키큰 풀 한 포기(눈 덮인·잿빛·마른 풀), 이웃과 다시 이음"},{"kind":"freeze","landmark":"mistpond-hollow-shrine-pond","box":[24,24,15,12],"swappedTiles":62,"rule":"물 칸 t → 얼음 칸 ice[t] (sheets.json snow.ice)"},{"kind":"fill","pieces":0,"cells":0,"emptiness":{"before":{"maxSq":4,"screen":0.394},"after":{"maxSq":4,"screen":0.394}},"rule":"빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 삐죽한 풀숲 덩이·세 송이 들꽃"}]
```

## 집 (원본 그대로)
```json
[{"id":"mistpond-hollow-house-1","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":2,"y":2,"w":4,"h":7,"front":{"x":3,"y":9}},{"id":"mistpond-hollow-house-2","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":42,"y":4,"w":4,"h":7,"front":{"x":43,"y":11}},{"id":"mistpond-hollow-house-3","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 6×8","x":15,"y":22,"w":6,"h":8,"front":{"x":17,"y":30}},{"id":"mistpond-hollow-house-4","role":"폐가","label":"폐가 · 오렌지 회벽 l-mirror 집","x":44,"y":22,"w":6,"h":8,"front":{"x":48,"y":30}},{"id":"mistpond-hollow-house-5","role":"폐가","label":"폐가 · 왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":17,"y":40,"w":6,"h":8,"front":{"x":19,"y":48}},{"id":"mistpond-hollow-house-6","role":"폐가","label":"폐가 · 오렌지 회벽 2층 rect-2f 집","x":47,"y":41,"w":7,"h":9,"front":{"x":50,"y":50}},{"id":"mistpond-hollow-house-7","role":"못지기 집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":35,"y":43,"w":4,"h":7,"front":{"x":36,"y":50}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
