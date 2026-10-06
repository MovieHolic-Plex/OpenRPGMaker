# 궁 기물 사전(병풍·용상·향로·북·종·방석·침구·서안) 1/2

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

일월오봉 병풍·용상·향로·큰 북·종 걸이·등롱·드므·방석·신하 깔개·침구·용 문양 장·서안·화로·촛대·족자. 깔개는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_bangseok_a · 궁 방석 A 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_a","w":1,"h":1,"class":"prop","upperTiles":[[16557]],"walk":["F"]}
```

### jb-pal_bangseok_b · 궁 방석 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_b","w":1,"h":1,"class":"prop","upperTiles":[[16558]],"walk":["F"]}
```

### jb-pal_bangseok_c · 궁 방석 C 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_c","w":1,"h":1,"class":"prop","upperTiles":[[16559]],"walk":["F"]}
```

### jb-pal_bangseok_oa · 궁 방석 O-A 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_oa","w":1,"h":1,"class":"prop","upperTiles":[[16537]],"walk":["F"]}
```

### jb-pal_bangseok_ob · 궁 방석 O-B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_ob","w":1,"h":1,"class":"prop","upperTiles":[[16538]],"walk":["F"]}
```

### jb-pal_bangseok_oc · 궁 방석 O-C 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_bangseok_oc","w":1,"h":1,"class":"prop","upperTiles":[[16539]],"walk":["F"]}
```

### jb-pal_buk_big · 궁 북 큰 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_buk_big","w":2,"h":3,"class":"prop","upperTiles":[[16492,16493],[16494,16495],[16496,16497]],"walk":["XX","XX","XX"]}
```

### jb-pal_byeongpung_gung · 궁 병풍 4×2 · 4×2 · 분류 prop
막힘 4 · 걸음★ 4 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_byeongpung_gung","w":4,"h":2,"class":"prop","upperTiles":[[16521,16522,16523,16524],[16525,16526,16527,16528]],"walk":["CCCC","XXXX"]}
```

### jb-pal_byeongpung_gung2 · 궁 병풍 2 4×2 · 4×2 · 분류 prop
막힘 8 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_byeongpung_gung2","w":4,"h":2,"class":"prop","upperTiles":[[16529,16530,16531,16532],[16533,16534,16535,16536]],"walk":["XXXX","XXXX"]}
```

### jb-pal_chimgu · 궁 침구 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_chimgu","w":2,"h":2,"class":"prop","upperTiles":[[16540,16541],[16542,16543]],"walk":["XX","XX"]}
```

### jb-pal_chotdae_big · 궁 촛대 큰 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_chotdae_big","w":1,"h":2,"class":"prop","upperTiles":[[16549],[16550]],"walk":["C","X"]}
```

### jb-pal_deumeu_a · 궁 드므 A 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deumeu_a","w":2,"h":2,"class":"prop","upperTiles":[[16513,16514],[16515,16516]],"walk":["XX","XX"]}
```

### jb-pal_deumeu_b · 궁 드므 B 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deumeu_b","w":2,"h":2,"class":"prop","upperTiles":[[16517,16518],[16519,16520]],"walk":["XX","XX"]}
```

### jb-pal_deungnong_a · 궁 등롱 A 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deungnong_a","w":1,"h":2,"class":"prop","upperTiles":[[16507],[16508]],"walk":["C","X"]}
```

### jb-pal_deungnong_b · 궁 등롱 B 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_deungnong_b","w":1,"h":2,"class":"prop","upperTiles":[[16509],[16510]],"walk":["C","X"]}
```

### jb-pal_hang_deungnong_a · 궁 벽걸이 등롱 A 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hang_deungnong_a","w":1,"h":1,"class":"prop","upperTiles":[[16511]],"walk":["X"]}
```

### jb-pal_hang_deungnong_b · 궁 벽걸이 등롱 B 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hang_deungnong_b","w":1,"h":1,"class":"prop","upperTiles":[[16512]],"walk":["X"]}
```

### jb-pal_hang_jokja_a · 궁 벽걸이 족자 A 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hang_jokja_a","w":1,"h":2,"class":"prop","upperTiles":[[16572],[16573]],"walk":["X","X"]}
```

### jb-pal_hang_jokja_b · 궁 벽걸이 족자 B 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hang_jokja_b","w":1,"h":2,"class":"prop","upperTiles":[[16574],[16575]],"walk":["X","X"]}
```

### jb-pal_hwaro · 궁 화로 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hwaro","w":1,"h":1,"class":"prop","upperTiles":[[16548]],"walk":["X"]}
```

### jb-pal_hyangro_a · 궁 향로 A 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hyangro_a","w":2,"h":2,"class":"prop","upperTiles":[[16484,16485],[16486,16487]],"walk":["XX","XX"]}
```

### jb-pal_hyangro_b · 궁 향로 B 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hyangro_b","w":2,"h":2,"class":"prop","upperTiles":[[16488,16489],[16490,16491]],"walk":["XX","XX"]}
```
