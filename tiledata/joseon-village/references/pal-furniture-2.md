# 궁 기물 사전(병풍·용상·향로·북·종·방석·침구·서안) 2/2

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

일월오봉 병풍·용상·향로·큰 북·종 걸이·등롱·드므·방석·신하 깔개·침구·용 문양 장·서안·화로·촛대·족자. 깔개는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_ilwol_byeongpung · 궁 일월오봉 병풍 7×3 · 7×3 · 분류 prop
막힘 7 · 걸음★ 14 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_ilwol_byeongpung","w":7,"h":3,"class":"prop","upperTiles":[[16454,16455,16456,16457,16458,16459,16460],[16461,16462,16463,16464,16465,16466,16467],[16468,16469,16470,16471,16472,16473,16474]],"walk":["CCCCCCC","CCCCCCC","XXXXXXX"]}
```

### jb-pal_jong_geori · 궁 종 걸이 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_jong_geori","w":3,"h":3,"class":"prop","upperTiles":[[16498,16499,16500],[16501,16502,16503],[16504,16505,16506]],"walk":["XXX","XXX","XXX"]}
```

### jb-pal_mat_gung_a · 궁 깔개 A 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_gung_a","w":2,"h":1,"class":"prop","upperTiles":[[16446,16447]],"walk":["FF"]}
```

### jb-pal_mat_gung_b · 궁 깔개 B 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_gung_b","w":2,"h":1,"class":"prop","upperTiles":[[16448,16449]],"walk":["FF"]}
```

### jb-pal_mat_gung_c · 궁 깔개 C 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_gung_c","w":2,"h":1,"class":"prop","upperTiles":[[16450,16451]],"walk":["FF"]}
```

### jb-pal_mat_sinha_b1 · 궁 깔개 신하 방석 깔개 B1 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_b1","w":2,"h":1,"class":"prop","upperTiles":[[16560,16561]],"walk":["FF"]}
```

### jb-pal_mat_sinha_b2 · 궁 깔개 신하 방석 깔개 B2 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_b2","w":2,"h":1,"class":"prop","upperTiles":[[16562,16563]],"walk":["FF"]}
```

### jb-pal_mat_sinha_b3 · 궁 깔개 신하 방석 깔개 B3 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_b3","w":2,"h":1,"class":"prop","upperTiles":[[16564,16565]],"walk":["FF"]}
```

### jb-pal_mat_sinha_r1 · 궁 깔개 신하 방석 깔개 R1 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_r1","w":2,"h":1,"class":"prop","upperTiles":[[16566,16567]],"walk":["FF"]}
```

### jb-pal_mat_sinha_r2 · 궁 깔개 신하 방석 깔개 R2 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_r2","w":2,"h":1,"class":"prop","upperTiles":[[16568,16569]],"walk":["FF"]}
```

### jb-pal_mat_sinha_r3 · 궁 깔개 신하 방석 깔개 R3 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_sinha_r3","w":2,"h":1,"class":"prop","upperTiles":[[16570,16571]],"walk":["FF"]}
```

### jb-pal_seoan · 궁 서안 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_seoan","w":2,"h":1,"class":"prop","upperTiles":[[16544,16545]],"walk":["XX"]}
```

### jb-pal_seoan_b · 궁 서안 B 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_seoan_b","w":2,"h":1,"class":"prop","upperTiles":[[16546,16547]],"walk":["XX"]}
```

### jb-pal_yong_jang · 궁 용 문양 장 2×3 · 2×3 · 분류 prop
막힘 2 · 걸음★ 4 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_yong_jang","w":2,"h":3,"class":"prop","upperTiles":[[16551,16552],[16553,16554],[16555,16556]],"walk":["CC","CC","XX"]}
```

### jb-pal_yongsang · 궁 용상 3×3 · 3×3 · 분류 prop
막힘 9 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_yongsang","w":3,"h":3,"class":"prop","upperTiles":[[16475,16476,16477],[16478,16479,16480],[16481,16482,16483]],"walk":["XXX","XXX","XXX"]}
```
