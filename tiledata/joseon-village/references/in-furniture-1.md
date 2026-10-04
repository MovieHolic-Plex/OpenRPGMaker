# 실내 기물 사전(가구·깔개·벽걸이·그릇) 1/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_ansuk · 실내 안석 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ansuk","w":1,"h":1,"class":"prop","upperTiles":[[16107]],"walk":["X"]}
```

### jb-in_b_bandaji_1 · 실내 반닫이 1칸 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_bandaji_1","w":1,"h":1,"class":"prop","upperTiles":[[15948]],"walk":["X"]}
```

### jb-in_b_bandaji_2 · 실내 반닫이 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_bandaji_2","w":2,"h":1,"class":"prop","upperTiles":[[15946,15947]],"walk":["XX"]}
```

### jb-in_b_banseok_b · 실내 방석 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_b","w":1,"h":1,"class":"prop","upperTiles":[[15967]],"walk":["F"]}
```

### jb-in_b_banseok_g · 실내 방석 G 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_g","w":1,"h":1,"class":"prop","upperTiles":[[15968]],"walk":["F"]}
```

### jb-in_b_banseok_r · 실내 방석 R 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_r","w":1,"h":1,"class":"prop","upperTiles":[[15966]],"walk":["F"]}
```

### jb-in_b_banseok_round_b · 실내 방석 둥근 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_round_b","w":1,"h":1,"class":"prop","upperTiles":[[16182]],"walk":["F"]}
```

### jb-in_b_banseok_round_g · 실내 방석 둥근 G 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_round_g","w":1,"h":1,"class":"prop","upperTiles":[[16187]],"walk":["F"]}
```

### jb-in_b_banseok_round_r · 실내 방석 둥근 R 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_round_r","w":1,"h":1,"class":"prop","upperTiles":[[16177]],"walk":["F"]}
```

### jb-in_b_banseok_s · 실내 방석 S 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_banseok_s","w":1,"h":1,"class":"prop","upperTiles":[[15969]],"walk":["F"]}
```

### jb-in_b_betul · 실내 베틀 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_betul","w":3,"h":2,"class":"prop","upperTiles":[[16050,16051,16052],[16053,16054,16055]],"walk":["CCC","XXX"]}
```

### jb-in_b_boryo_2 · 실내 보료 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_boryo_2","w":2,"h":1,"class":"prop","upperTiles":[[16105,16106]],"walk":["XX"]}
```

### jb-in_b_buk · 실내 북 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_buk","w":1,"h":2,"class":"prop","upperTiles":[[16126],[16127]],"walk":["C","X"]}
```

### jb-in_b_bumak_2 · 실내 부뚜막 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_bumak_2","w":2,"h":2,"class":"prop","upperTiles":[[16024,16025],[16026,16027]],"walk":["CC","XX"]}
```

### jb-in_b_bumak_3 · 실내 부뚜막 3칸 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_bumak_3","w":3,"h":2,"class":"prop","upperTiles":[[16028,16029,16030],[16031,16032,16033]],"walk":["CCC","XXX"]}
```

### jb-in_b_byeongpung_2 · 실내 병풍 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_2","w":2,"h":2,"class":"prop","upperTiles":[[15918,15919],[15920,15921]],"walk":["CC","XX"]}
```

### jb-in_b_byeongpung_2d · 실내 병풍 2칸 D 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_2d","w":2,"h":2,"class":"prop","upperTiles":[[15922,15923],[15924,15925]],"walk":["XX","XX"]}
```

### jb-in_b_byeongpung_2e · 실내 병풍 2칸 E 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_2e","w":2,"h":2,"class":"prop","upperTiles":[[15926,15927],[15928,15929]],"walk":["XX","XX"]}
```

### jb-in_b_byeongpung_a · 실내 병풍 A 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_a","w":3,"h":2,"class":"prop","upperTiles":[[15900,15901,15902],[15903,15904,15905]],"walk":["CCC","XXX"]}
```

### jb-in_b_byeongpung_b · 실내 병풍 B 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_b","w":3,"h":2,"class":"prop","upperTiles":[[15906,15907,15908],[15909,15910,15911]],"walk":["CCC","XXX"]}
```

### jb-in_b_byeongpung_c · 실내 병풍 C 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_c","w":3,"h":2,"class":"prop","upperTiles":[[15912,15913,15914],[15915,15916,15917]],"walk":["CCC","XXX"]}
```

### jb-in_b_byeongpung_royal · 실내 병풍 왕실 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_byeongpung_royal","w":3,"h":2,"class":"prop","upperTiles":[[15930,15931,15932],[15933,15934,15935]],"walk":["CCC","XXX"]}
```
