# 갈매기 곶 등대

바다로 튀어나온 곶 끝의 등대. 등대지기 집, 부두와 나룻배, 바위 해안. 동·남·서 삼면이 바다인 곶. 곶 끝 둥근 돌마당에 원통형 등대가 서고, 그 곁에 등대지기 집과 장작·통 마당이 있다. 서쪽 물가에 부두와 나룻배, 북쪽 숲길로 들어온다. 등대 문은 등대 꼭대기 방(실내)으로 이어진다. 44×38, tilesetId=forest_harmony. 통행 검사 시작 (22,4).

![갈매기 곶 등대](images/outdoor-lighthouse-cape.png)

## 출구 — 어디와 맞닿나
- 출구0 북쪽 (22,0) → 해안 필드 남쪽 출구

## 지형
```json
{"cliffs":[],"stairs":[],"landmarks":[]}
```

## 집 (템플릿·역할·문)
```json
[{"template":3,"role":"등대지기 집","x":12,"y":12,"w":4,"h":7,"door":{"x":13,"y":18},"front":{"x":13,"y":19},"yard":"storage","yardSide":"left"}]
```

## 소품 (주인·이유가 있는 것만 남겼다)
```json
[{"name":"돌등","x":19,"y":22,"w":1,"h":2,"owner":"등대","purpose":"돌마당 등불"},{"name":"돌등","x":25,"y":22,"w":1,"h":2,"owner":"등대","purpose":"돌마당 등불"},{"name":"장작 더미","x":26,"y":25,"w":1,"h":1,"owner":"등대","purpose":"등불 땔감"},{"name":"술통","x":24,"y":26,"w":1,"h":1,"owner":"등대","purpose":"기름통"},{"name":"낚시 바구니","x":15,"y":25,"w":1,"h":1,"owner":"부두","purpose":"부두 낚시"},{"name":"밧줄 뭉치","x":14,"y":27,"w":1,"h":1,"owner":"부두","purpose":"부두 짐"},{"name":"나무 상자","x":11,"y":18,"w":1,"h":1,"owner":"outdoor-lighthouse-cape-house-1","purpose":"창고"},{"name":"술통","x":11,"y":17,"w":1,"h":1,"owner":"outdoor-lighthouse-cape-house-1","purpose":"창고"},{"name":"작은 오크통","x":11,"y":19,"w":1,"h":1,"owner":"outdoor-lighthouse-cape-house-1","purpose":"창고"},{"name":"과일 상자","x":10,"y":16,"w":2,"h":1,"owner":"outdoor-lighthouse-cape-house-1","purpose":"창고"}]
```

## 포장·다리·부두·덩이
```json
[{"name":"등대 돌마당","kind":"paving","group":"builtin_cobble"},{"name":"등대 · 성곽 원탑 모양 등대","kind":"piece","x":21,"y":14,"w":2,"h":8},{"name":"왕궁 도시 · 주황 박공 회벽집 4×7 ②","kind":"house","x":12,"y":12,"w":4,"h":7},{"name":"선착장","kind":"dock","x":5,"y":26,"w":4,"h":1},{"name":"나룻배","kind":"boat","x":0,"y":22,"w":8,"h":4},{"name":"나무 · round-bush","kind":"vegetation","x":28,"y":7,"w":3,"h":3},{"name":"나무 · small-bush","kind":"vegetation","x":18,"y":7,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":14,"y":7,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":11,"y":6,"w":2,"h":2},{"name":"나무 · tree","kind":"vegetation","x":27,"y":11,"w":3,"h":4},{"name":"나무 · small-bush","kind":"vegetation","x":25,"y":12,"w":2,"h":2},{"name":"나무 · round-bush","kind":"vegetation","x":30,"y":12,"w":3,"h":3},{"name":"나무 · tree","kind":"vegetation","x":28,"y":20,"w":3,"h":4},{"name":"나무 · small-bush","kind":"vegetation","x":31,"y":21,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":28,"y":25,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":30,"y":26,"w":2,"h":2},{"name":"나무 · round-bush","kind":"vegetation","x":17,"y":26,"w":3,"h":3},{"name":"나무 · round-bush","kind":"vegetation","x":28,"y":29,"w":3,"h":3},{"name":"나무 · small-bush","kind":"vegetation","x":31,"y":16,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":15,"y":22,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":14,"y":29,"w":2,"h":2}]
```



## 채우기 규칙 (빈칸 게이트: 마을·장면 한 화면 17×13 에 맨땅 40% 이하·가장 큰 빈 네모 4칸 이하, 필드 50%·5칸)
맨땅(plain)으로 세는 칸: 잔디 240·잔디 질감 1140~1147, 포장 몸통 포석 190·석판 307·자갈 310·흙 421·모래 424·눈 67. 빈칸은 **자연 덩이로 먼저** 줄이고, 생활 소품은 주인이 있을 때만 둔다.
- 나무 덩이: 나무 키트(활엽수 978~980/1008~1010·1038~1040/1068~1070 3×4, 둥근 덤불 983~985/1013~1015/1043~1045 3×3, 작은 덤불 1073/1074/1103/1104 2×2)를 어깨를 붙여 3~7그루씩. 줄·바둑판으로 세우지 않는다.
- 꽃: 들꽃 348 을 **3~5칸 묶음**(2×2 속 + 한두 칸)이나 화단 키트(꽃 화단·화분)로만. 한 칸씩 흩은 「색종이 밭」 금지.
- 덤불 289 묶음·작은 덤불 2×2, 바위 537·29 는 3~6칸 무리로 절벽 발치·물가·숲 가장자리에만. 한 줄(가로·세로 3칸 이상 일렬) 금지.
- 키큰 풀: E builtin_tall_grass(243~335, 숲 수관 1칸 안)·F builtin_tall_grass_light(1124~1126/1154~1156/1184~1186, 외톨이 1127, 속 1157, 트인 곳)·G builtin_tall_grass_short(1128~1130/1158~1160/1188~1190, 외톨이 1131, 속 1161, 집·길 3칸 안). 덩이마다 한 종류, 2×2 이상, variantMap 으로 이웃에 맞춰 고른다(scripts/content/lib/tall-grass.mjs arrangeTallGrass).
- 금지 재료: 짙은 수풀 builtin_undergrowth(9·11·39~41·69~71·99~101, 검은 초록 구불이), 어두운 덤불 986~988·1016~1018·1046~1048(구덩이로 보임), 마른 가지 740·바위·뼈 383·부서진 울타리 410 을 고르게 흩뿌리기(절벽·폐허 벽·물가 곁 1~3곳에 몰아 둔다).
- 주인 없는 소품 금지: 벤치·통나무·상자·항아리·허수아비·표지판은 2칸 안에 이유(집 문·가게·밭·우물·부두·작업장·길)가 있어야 한다. 없으면 두지 말고 뺀다.

## 검사
```json
{"reachable":581,"emptiness":{"maxSq":3,"screen":0.335,"at":[20,22],"screenAt":[12,16]}}
```

전체 두 레이어는 「갈매기 곶 등대 · 0행부터 전체 배열」 문서가 정답이다.
