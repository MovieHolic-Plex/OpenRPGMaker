# 잿빛 여울성

재로 덮인 벌판 위 성채 마을. 해자와 여울이 용암으로 바뀌고 숲은 그을린 검은 숲이 된다. 80×87, tilesetId=forest_harmony_volcano, 원본 숲마을 ford-castle-town(tiledata/forest-villages/diverse). 입구 (36,83). 통행 검사 목표 [[6,16],[73,19],[9,37],[4,58],[18,59],[49,58],[75,58],[8,81],[42,82],[52,83]].

![잿빛 여울성](images/climate-volcano-ford-castle.png)

## 기후 편집 (원본 숲마을 위에 한 것)
```json
[{"kind":"unflowered","cells":0,"bushes":0,"tiles":[348,288],"rule":"눈·재·모래에는 꽃이 피지 않는다: 덤불에 붙은 꽃은 같은 덤불(289)로, 나머지 꽃은 걷는다"},{"kind":"sheet","lavaCells":401,"basaltBridgeCells":16,"rule":"물 칸은 시트에서 용암으로 칠해져 있다(번호·통행 그대로)"},{"kind":"buried-grass","cells":0,"kept":"G grass kept: without it the village fails the fill gate"},{"kind":"fill","pieces":0,"scenes":[],"emptiness":{"before":{"maxSq":4,"screen":0.385},"after":{"maxSq":4,"screen":0.385}},"rule":"빈칸 게이트(한 변 5칸 빈 정사각형 없음, 17×13 화면 빈 땅 ≤40%)를 넘을 때까지 덩이 장면(덤불숲·바위와 덤불·키큰 풀 덩이, 가을은 나무·꽃 포함)"}]
```

## 집 (원본 그대로)
```json
[{"id":"ford-castle-town-house-1","role":"기사 숙소","label":"파랑 석벽 rect-wide 집","x":3,"y":10,"w":8,"h":6,"front":{"x":6,"y":16}},{"id":"ford-castle-town-house-2","role":"망루지기 집","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":72,"y":12,"w":4,"h":7,"front":{"x":73,"y":19}},{"id":"ford-castle-town-house-3","role":"병사 숙소","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":7,"y":29,"w":6,"h":8,"front":{"x":9,"y":37}},{"id":"ford-castle-town-house-4","role":"주거","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":2,"y":50,"w":6,"h":8,"front":{"x":4,"y":58}},{"id":"ford-castle-town-house-5","role":"약방","label":"왕궁 도시 · 주황 박공 회벽집 6×8","x":16,"y":51,"w":6,"h":8,"front":{"x":18,"y":59}},{"id":"ford-castle-town-house-6","role":"성 곳간","label":"오렌지 회벽 2층 rect-2f 집","x":46,"y":49,"w":7,"h":9,"front":{"x":49,"y":58}},{"id":"ford-castle-town-house-7","role":"주거","label":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","x":74,"y":51,"w":4,"h":7,"front":{"x":75,"y":58}},{"id":"ford-castle-town-house-8","role":"텃밭집","label":"오렌지 회벽 l-mirror 집","x":4,"y":73,"w":6,"h":8,"front":{"x":8,"y":81}},{"id":"ford-castle-town-house-9","role":"목수집","label":"왕궁 도시 · 파랑 박공 회벽집 6×8 ②","x":40,"y":74,"w":6,"h":8,"front":{"x":42,"y":82}},{"id":"ford-castle-town-house-10","role":"나루 창고","label":"왕궁 도시 · 주황 박공 회벽집 6×8","x":50,"y":75,"w":6,"h":8,"front":{"x":52,"y":83}}]
```

전체 두 레이어는 다음 배열 문서가 정답이다.
