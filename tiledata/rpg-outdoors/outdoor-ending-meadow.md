# 노을빛 엔딩 들판

엔딩 장면. 꽃이 가득한 들판 언덕의 외딴 큰 나무와 벤치, 들판을 가로질러 멀리 떠나는 길. 탁 트인 꽃 들판. 가운데 낮은 언덕 위에 외딴 큰 참나무와 벤치가 있고, 남쪽에서 온 흙길이 나무 곁을 지나 동쪽 멀리로 이어진다. 들꽃과 덤불이 셋씩 무리 지어 피고 가장자리에 숲이 둘러선다. 40×30, tilesetId=forest_harmony. 통행 검사 시작 (12,25).

![노을빛 엔딩 들판](images/outdoor-ending-meadow.png)

## 출구 — 어디와 맞닿나
- 출구0 남쪽 (12,29) → 마을 북쪽 길
- 출구1 동쪽 (39,10) → 먼 길(끝)

## 지형
```json
{"cliffs":[],"stairs":[],"landmarks":[]}
```

## 집 (템플릿·역할·문)
```json
[]
```

## 소품 (주인·이유가 있는 것만 남겼다)
```json
[{"name":"벤치","x":20,"y":13,"w":2,"h":1,"purpose":"나무 아래 벤치"},{"name":"돌 석상","x":26,"y":15,"w":1,"h":2,"purpose":"추모비"}]
```

## 포장·다리·부두·덩이
```json
[{"name":"나무 · big-oak","kind":"vegetation","x":19,"y":7,"w":4,"h":5},{"name":"나무 · round-bush","kind":"vegetation","x":37,"y":5,"w":3,"h":3},{"name":"나무 · small-bush","kind":"vegetation","x":5,"y":14,"w":2,"h":2},{"name":"나무 · round-bush","kind":"vegetation","x":5,"y":27,"w":3,"h":3},{"name":"나무 · small-bush","kind":"vegetation","x":3,"y":21,"w":2,"h":2},{"name":"나무 · tree","kind":"vegetation","x":25,"y":18,"w":3,"h":4},{"name":"나무 · small-bush","kind":"vegetation","x":23,"y":20,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":14,"y":7,"w":2,"h":2},{"name":"나무 · round-bush","kind":"vegetation","x":5,"y":9,"w":3,"h":3},{"name":"나무 · round-bush","kind":"vegetation","x":8,"y":8,"w":3,"h":3},{"name":"나무 · tree","kind":"vegetation","x":12,"y":10,"w":3,"h":4},{"name":"나무 · tree","kind":"vegetation","x":15,"y":10,"w":3,"h":4},{"name":"나무 · round-bush","kind":"vegetation","x":7,"y":17,"w":3,"h":3},{"name":"나무 · small-bush","kind":"vegetation","x":25,"y":8,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":27,"y":8,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":36,"y":22,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":27,"y":23,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":19,"y":26,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":29,"y":20,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":16,"y":8,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":33,"y":6,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":5,"y":17,"w":2,"h":2},{"name":"나무 · small-bush","kind":"vegetation","x":23,"y":8,"w":2,"h":2}]
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
{"reachable":729,"emptiness":{"maxSq":2,"screen":0.339,"at":[20,0],"screenAt":[4,12]}}
```

전체 두 레이어는 「노을빛 엔딩 들판 · 0행부터 전체 배열」 문서가 정답이다.
