# 가을 두 폭포 강마을

단풍 든 숲에서 나온 강이 두 줄 절벽을 폭포로 떨어지는 가을 강마을. 금빛 풀밭에 노란 활엽수와 붉은 덤불이 있다. 62×65, tilesetId=forest_harmony_autumn, 원본 숲마을 twin-falls-river-village(tiledata/forest-villages/diverse). 입구 (17,61). 통행 검사 목표 [[11,12],[48,11],[9,34],[23,31],[41,32],[58,33],[7,56],[45,56]].

![가을 두 폭포 강마을](images/climate-autumn-twin-falls.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"fill","pieces":0,"scenes":[],"emptiness":{"before":{"maxSq":4,"screen":0.389},"after":{"maxSq":4,"screen":0.389}},"rule":"빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 덩이 장면(덤불숲·바위와 덤불·키큰 풀 덩이, 가을은 나무·꽃 포함)"}]
```

## 집 (원본 그대로)
```json
[{"id":"twin-falls-river-village-house-1","role":"목공 작업집","label":"오렌지 회벽 2층 rect-2f 집","x":8,"y":3,"w":7,"h":9,"front":{"x":11,"y":12}},{"id":"twin-falls-river-village-house-2","role":"주거","label":"파랑 석벽 rect-wide 집","x":45,"y":5,"w":8,"h":6,"front":{"x":48,"y":11}},{"id":"twin-falls-river-village-house-3","role":"약초 작업집","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":7,"y":26,"w":6,"h":8,"front":{"x":9,"y":34}},{"id":"twin-falls-river-village-house-4","role":"물자 보관집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":22,"y":24,"w":4,"h":7,"front":{"x":23,"y":31}},{"id":"twin-falls-river-village-house-5","role":"텃밭집","label":"왕궁 도시 · 파랑 회벽집 5×7","x":40,"y":25,"w":5,"h":7,"front":{"x":41,"y":32}},{"id":"twin-falls-river-village-house-6","role":"주거","label":"오렌지 회벽 l-mirror 집","x":54,"y":25,"w":6,"h":8,"front":{"x":58,"y":33}},{"id":"twin-falls-river-village-house-7","role":"밭집","label":"왕궁 도시 · 주황 박공 회벽집 6×8","x":5,"y":48,"w":6,"h":8,"front":{"x":7,"y":56}},{"id":"twin-falls-river-village-house-8","role":"물자 보관집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":44,"y":49,"w":4,"h":7,"front":{"x":45,"y":56}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
