# 솔바람 산촌 · 설원

눈 덮인 산기슭에 흩어진 산촌. 솔숲 수관에 눈이 얹히고 지붕이 하얗게 덮였다. 개울은 얼지 않고 흐른다. 62×54, tilesetId=forest_harmony_snow, 원본 숲마을 pine-hamlets(tiledata/forest-villages/diverse). 입구 (34,50). 통행 검사 목표 [[7,14],[28,12],[53,16],[12,35],[41,34],[51,42],[25,47]].

![솔바람 산촌 · 설원](images/climate-snow-pine-hamlets.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"unflowered","cells":24,"tiles":[348,288],"rule":"빈 땅의 들꽃·꽃덤불 → 이 시트의 키큰 풀 한 포기(눈 덮인·잿빛·마른 풀), 이웃과 다시 이음"},{"kind":"fill","pieces":0,"cells":0,"emptiness":{"before":{"maxSq":3,"screen":0.398},"after":{"maxSq":3,"screen":0.398}},"rule":"빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 삐죽한 풀숲 덩이·세 송이 들꽃"}]
```

## 집 (원본 그대로)
```json
[{"id":"pine-hamlets-house-1","role":"주거","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":6,"y":7,"w":4,"h":7,"front":{"x":7,"y":14}},{"id":"pine-hamlets-house-2","role":"텃밭집","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":26,"y":4,"w":6,"h":8,"front":{"x":28,"y":12}},{"id":"pine-hamlets-house-3","role":"목공 작업집","label":"파랑 석벽 rect-wide 집","x":50,"y":10,"w":8,"h":6,"front":{"x":53,"y":16}},{"id":"pine-hamlets-house-4","role":"약초 작업집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":11,"y":28,"w":4,"h":7,"front":{"x":12,"y":35}},{"id":"pine-hamlets-house-5","role":"주거","label":"오렌지 회벽 l-mirror 집","x":37,"y":26,"w":6,"h":8,"front":{"x":41,"y":34}},{"id":"pine-hamlets-house-6","role":"텃밭집","label":"왕궁 도시 · 파랑 회벽집 5×7","x":50,"y":35,"w":5,"h":7,"front":{"x":51,"y":42}},{"id":"pine-hamlets-house-7","role":"물자 보관집","label":"왕궁 도시 · 주황 박공 회벽집 6×8","x":23,"y":39,"w":6,"h":8,"front":{"x":25,"y":47}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
