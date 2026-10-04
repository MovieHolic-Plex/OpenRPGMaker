# 실내 기물 사전(가구·깔개·벽걸이·그릇) 5/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_pyeongsang_3c · 실내 평상 3칸 C 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_3c","w":3,"h":2,"class":"prop","upperTiles":[[16162,16163,16164],[16165,16166,16167]],"walk":["XXX","XXX"]}
```

### jb-in_b_sang_low_2 · 실내 상 낮은 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sang_low_2","w":2,"h":1,"class":"prop","upperTiles":[[15954,15955]],"walk":["XX"]}
```

### jb-in_b_seoan · 실내 서안 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_seoan","w":1,"h":1,"class":"prop","upperTiles":[[16096]],"walk":["X"]}
```

### jb-in_b_seoan_2 · 실내 서안 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_seoan_2","w":2,"h":1,"class":"prop","upperTiles":[[16097,16098]],"walk":["XX"]}
```

### jb-in_b_seoga_1 · 실내 서가 1칸 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_seoga_1","w":1,"h":2,"class":"prop","upperTiles":[[16103],[16104]],"walk":["C","X"]}
```

### jb-in_b_seoga_2 · 실내 서가 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_seoga_2","w":2,"h":2,"class":"prop","upperTiles":[[16099,16100],[16101,16102]],"walk":["CC","XX"]}
```

### jb-in_b_seonban_2 · 실내 선반 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_seonban_2","w":2,"h":2,"class":"prop","upperTiles":[[16046,16047],[16048,16049]],"walk":["CC","XX"]}
```

### jb-in_b_sewing · 실내 바느질 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sewing","w":1,"h":1,"class":"prop","upperTiles":[[16057]],"walk":["X"]}
```

### jb-in_b_soban_a · 실내 소반 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_soban_a","w":1,"h":1,"class":"prop","upperTiles":[[15951]],"walk":["X"]}
```

### jb-in_b_soban_b · 실내 소반 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_soban_b","w":1,"h":1,"class":"prop","upperTiles":[[15952]],"walk":["X"]}
```

### jb-in_b_soban_c · 실내 소반 C 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_soban_c","w":1,"h":1,"class":"prop","upperTiles":[[15953]],"walk":["X"]}
```

### jb-in_b_sokuri_fruit · 실내 소쿠리 과일 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sokuri_fruit","w":1,"h":1,"class":"prop","upperTiles":[[16044]],"walk":["X"]}
```

### jb-in_b_sokuri_grain · 실내 소쿠리 곡식 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sokuri_grain","w":1,"h":1,"class":"prop","upperTiles":[[16043]],"walk":["X"]}
```

### jb-in_b_sokuri_veg · 실내 소쿠리 채소 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sokuri_veg","w":1,"h":1,"class":"prop","upperTiles":[[16042]],"walk":["X"]}
```

### jb-in_b_ssal_dwiju · 실내 쌀 뒤주 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ssal_dwiju","w":1,"h":2,"class":"prop","upperTiles":[[16039],[16040]],"walk":["C","X"]}
```

### jb-in_b_stool · 실내 걸상 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_stool","w":1,"h":1,"class":"prop","upperTiles":[[16023]],"walk":["X"]}
```

### jb-in_b_suldok · 실내 술독 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_suldok","w":1,"h":1,"class":"prop","upperTiles":[[16088]],"walk":["X"]}
```

### jb-in_b_sulsang · 실내 술상 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sulsang","w":2,"h":1,"class":"prop","upperTiles":[[16089,16090]],"walk":["XX"]}
```

### jb-in_b_sutdeomi · 실내 숯더미 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sutdeomi","w":1,"h":1,"class":"prop","upperTiles":[[16061]],"walk":["X"]}
```

### jb-in_b_sutdol · 실내 숫돌 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_sutdol","w":1,"h":1,"class":"prop","upperTiles":[[16069]],"walk":["X"]}
```

### jb-in_b_throne · 실내 의자 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_throne","w":2,"h":2,"class":"prop","upperTiles":[[16133,16134],[16135,16136]],"walk":["CC","XX"]}
```

### jb-in_b_tool_rack_2 · 실내 농기구 걸이 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_tool_rack_2","w":2,"h":2,"class":"prop","upperTiles":[[16192,16193],[16194,16195]],"walk":["CC","XX"]}
```
