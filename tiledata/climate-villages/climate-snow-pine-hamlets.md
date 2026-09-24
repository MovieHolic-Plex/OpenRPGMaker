# 솔바람 산촌 · 설원

눈 덮인 산기슭에 흩어진 산촌. 솔숲 수관에 눈이 얹히고 지붕이 하얗게 덮였다. 개울은 얼지 않고 흐른다. 61×53, tilesetId=forest_harmony_snow, 원본 숲마을 pine-hamlets(tiledata/forest-villages/diverse). 입구 (30,49). 통행 검사 목표 [[7,12],[24,10],[49,14],[12,33],[37,32],[47,40],[23,45]].

![솔바람 산촌 · 설원](images/climate-snow-pine-hamlets.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"unflowered","cells":0,"bushes":0,"tiles":[348,288],"rule":"눈·재·모래에는 꽃이 피지 않는다: 덤불에 붙은 꽃은 같은 덤불(289)로, 나머지 꽃은 걷는다"},{"kind":"snow-bushes","trees":6,"rule":"활엽수 3×4 → 눈 덮인 둥근 덤불 3×3(아래 세 줄), 맨 윗줄은 눈밭"},{"kind":"buried-grass","cells":0,"kept":"G grass kept: without it the village fails the fill gate"},{"kind":"fill","pieces":0,"scenes":[],"emptiness":{"before":{"maxSq":4,"screen":0.353},"after":{"maxSq":4,"screen":0.353}},"rule":"빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 덩이 장면(덤불숲·바위와 덤불·키큰 풀 덩이, 가을은 나무·꽃 포함)"}]
```

## 집 (원본 그대로)
```json
[{"id":"pine-hamlets-house-1","role":"주거","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":6,"y":5,"w":4,"h":7,"front":{"x":7,"y":12}},{"id":"pine-hamlets-house-2","role":"텃밭집","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":22,"y":2,"w":6,"h":8,"front":{"x":24,"y":10}},{"id":"pine-hamlets-house-3","role":"목공 작업집","label":"파랑 석벽 rect-wide 집","x":46,"y":8,"w":8,"h":6,"front":{"x":49,"y":14}},{"id":"pine-hamlets-house-4","role":"약초 작업집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":11,"y":26,"w":4,"h":7,"front":{"x":12,"y":33}},{"id":"pine-hamlets-house-5","role":"주거","label":"오렌지 회벽 l-mirror 집","x":33,"y":24,"w":6,"h":8,"front":{"x":37,"y":32}},{"id":"pine-hamlets-house-6","role":"텃밭집","label":"왕궁 도시 · 파랑 회벽집 5×7","x":46,"y":33,"w":5,"h":7,"front":{"x":47,"y":40}},{"id":"pine-hamlets-house-7","role":"물자 보관집","label":"왕궁 도시 · 주황 박공 회벽집 6×8","x":21,"y":37,"w":6,"h":8,"front":{"x":23,"y":45}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
