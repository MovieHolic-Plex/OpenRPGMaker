# 용암못 폐촌

울타리 친 못이 끓는 용암못이 된 폐촌. 빈 재밭 두 곳에 작은 화산 봉우리 한 쌍(잠든 봉우리·분화하는 봉우리)이 솟아 있다. 80×64, tilesetId=forest_harmony_volcano, 원본 숲마을 mistpond-hollow(tiledata/forest-villages/diverse). 입구 (40,60). 통행 검사 목표 [[7,12],[53,12],[22,34],[58,35],[24,55],[61,55],[45,55]].

![용암못 폐촌](images/climate-volcano-lava-pond.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"volcanic-peaks","x":33,"y":12,"w":4,"h":2,"upper":[[858,859,918,919],[888,889,948,949]]},{"kind":"volcanic-peaks","x":43,"y":26,"w":4,"h":2,"upper":[[858,859,918,919],[888,889,948,949]]},{"kind":"sheet","lavaCells":341,"basaltBridgeCells":8,"rule":"물 칸은 시트에서 용암으로 칠해져 있다(번호·통행 그대로)"}]
```

## 집 (원본 그대로)
```json
[{"id":"mistpond-hollow-house-1","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":6,"y":5,"w":4,"h":7,"front":{"x":7,"y":12}},{"id":"mistpond-hollow-house-2","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":52,"y":5,"w":4,"h":7,"front":{"x":53,"y":12}},{"id":"mistpond-hollow-house-3","role":"폐가","label":"폐가 · 왕궁 도시 · 주황 박공 회벽집 6×8","x":20,"y":26,"w":6,"h":8,"front":{"x":22,"y":34}},{"id":"mistpond-hollow-house-4","role":"폐가","label":"폐가 · 오렌지 회벽 l-mirror 집","x":54,"y":27,"w":6,"h":8,"front":{"x":58,"y":35}},{"id":"mistpond-hollow-house-5","role":"폐가","label":"폐가 · 왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":22,"y":47,"w":6,"h":8,"front":{"x":24,"y":55}},{"id":"mistpond-hollow-house-6","role":"폐가","label":"폐가 · 오렌지 회벽 2층 rect-2f 집","x":58,"y":46,"w":7,"h":9,"front":{"x":61,"y":55}},{"id":"mistpond-hollow-house-7","role":"못지기 집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":44,"y":48,"w":4,"h":7,"front":{"x":45,"y":55}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
