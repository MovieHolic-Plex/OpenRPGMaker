# 실내 기물 사전(가구·깔개·벽걸이·그릇) 3/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_hangari_m · 실내 항아리 중간 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hangari_m","w":1,"h":1,"class":"prop","upperTiles":[[16035]],"walk":["X"]}
```

### jb-in_b_hangari_s · 실내 항아리 작은 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hangari_s","w":1,"h":1,"class":"prop","upperTiles":[[16034]],"walk":["X"]}
```

### jb-in_b_hangari_straw · 실내 항아리 짚 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hangari_straw","w":1,"h":1,"class":"prop","upperTiles":[[16036]],"walk":["X"]}
```

### jb-in_b_hoechori · 실내 회초리 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hoechori","w":1,"h":1,"class":"prop","upperTiles":[[16108]],"walk":["X"]}
```

### jb-in_b_hwadeok_3 · 실내 화덕 3칸 3×2 · 3×2 · 분류 prop
막힘 3 · 걸음★ 3 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hwadeok_3","w":3,"h":2,"class":"prop","upperTiles":[[16062,16063,16064],[16065,16066,16067]],"walk":["CCC","XXX"]}
```

### jb-in_b_hwaro · 실내 화로 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hwaro","w":1,"h":1,"class":"prop","upperTiles":[[15961]],"walk":["X"]}
```

### jb-in_b_ibul_b · 실내 이부자리 B 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_b","w":1,"h":2,"class":"prop","upperTiles":[[16000],[16001]],"walk":["X","X"]}
```

### jb-in_b_ibul_folded · 실내 이부자리 갠 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_folded","w":1,"h":1,"class":"prop","upperTiles":[[16002]],"walk":["X"]}
```

### jb-in_b_ibul_r · 실내 이부자리 R 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_r","w":1,"h":2,"class":"prop","upperTiles":[[15998],[15999]],"walk":["X","X"]}
```

### jb-in_b_ibul_wide_b · 실내 이부자리 넓은 B 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_wide_b","w":2,"h":2,"class":"prop","upperTiles":[[16178,16179],[16180,16181]],"walk":["XX","XX"]}
```

### jb-in_b_ibul_wide_g · 실내 이부자리 넓은 G 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_wide_g","w":2,"h":2,"class":"prop","upperTiles":[[16183,16184],[16185,16186]],"walk":["XX","XX"]}
```

### jb-in_b_ibul_wide_r · 실내 이부자리 넓은 R 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibul_wide_r","w":2,"h":2,"class":"prop","upperTiles":[[16173,16174],[16175,16176]],"walk":["XX","XX"]}
```

### jb-in_b_ibuljang · 실내 이불장 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_ibuljang","w":2,"h":2,"class":"prop","upperTiles":[[15936,15937],[15938,15939]],"walk":["CC","XX"]}
```

### jb-in_b_jakdu · 실내 작두 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_jakdu","w":1,"h":1,"class":"prop","upperTiles":[[16084]],"walk":["X"]}
```

### jb-in_b_jangjak · 실내 장작 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_jangjak","w":1,"h":1,"class":"prop","upperTiles":[[16045]],"walk":["X"]}
```

### jb-in_b_jokja_a · 실내 족자 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_jokja_a","w":1,"h":1,"class":"prop","upperTiles":[[16003]],"walk":["X"]}
```

### jb-in_b_jokja_b · 실내 족자 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_jokja_b","w":1,"h":1,"class":"prop","upperTiles":[[16004]],"walk":["X"]}
```

### jb-in_b_jokja_c · 실내 족자 C 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_jokja_c","w":1,"h":1,"class":"prop","upperTiles":[[16005]],"walk":["X"]}
```

### jb-in_b_juga_2 · 실내 주가 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_juga_2","w":2,"h":1,"class":"prop","upperTiles":[[16094,16095]],"walk":["XX"]}
```

### jb-in_b_juga_3 · 실내 주가 3칸 3×1 · 3×1 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_juga_3","w":3,"h":1,"class":"prop","upperTiles":[[16091,16092,16093]],"walk":["XXX"]}
```

### jb-in_b_mangchi_teul · 실내 망치 틀 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mangchi_teul","w":1,"h":1,"class":"prop","upperTiles":[[16168]],"walk":["X"]}
```

### jb-in_b_mat_carpet_v4 · 실내 깔개 카펫 (길) 1×4 · 1×4 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_carpet_v4","w":1,"h":4,"class":"prop","upperTiles":[[16137],[16138],[16139],[16140]],"walk":["F","F","F","F"]}
```
