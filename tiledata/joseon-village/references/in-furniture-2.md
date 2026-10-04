# 실내 기물 사전(가구·깔개·벽걸이·그릇) 2/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_chaekdemi · 실내 책더미 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_chaekdemi","w":1,"h":1,"class":"prop","upperTiles":[[16109]],"walk":["X"]}
```

### jb-in_b_cheol · 실내 쇠 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_cheol","w":1,"h":1,"class":"prop","upperTiles":[[16070]],"walk":["X"]}
```

### jb-in_b_chotdae · 실내 촛대 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_chotdae","w":1,"h":1,"class":"prop","upperTiles":[[15965]],"walk":["X"]}
```

### jb-in_b_dameum · 실내 담금질 통 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dameum","w":1,"h":1,"class":"prop","upperTiles":[[16068]],"walk":["X"]}
```

### jb-in_b_deungjan · 실내 등잔 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_deungjan","w":1,"h":1,"class":"prop","upperTiles":[[15964]],"walk":["X"]}
```

### jb-in_b_deungjan_stand · 실내 등잔 걸이 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_deungjan_stand","w":1,"h":2,"class":"prop","upperTiles":[[15962],[15963]],"walk":["C","X"]}
```

### jb-in_b_dok_big · 실내 독 큰 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_dok_big","w":1,"h":2,"class":"prop","upperTiles":[[16037],[16038]],"walk":["C","X"]}
```

### jb-in_b_geolsang_2 · 실내 걸상 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_geolsang_2","w":2,"h":1,"class":"prop","upperTiles":[[16021,16022]],"walk":["XX"]}
```

### jb-in_b_gongjang · 실내 작업대 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gongjang","w":2,"h":1,"class":"prop","upperTiles":[[16071,16072]],"walk":["XX"]}
```

### jb-in_b_gonjang_geori · 실내 곤장 걸이 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gonjang_geori","w":1,"h":2,"class":"prop","upperTiles":[[16146],[16147]],"walk":["C","X"]}
```

### jb-in_b_gonjang_teul · 실내 곤장 틀 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gonjang_teul","w":2,"h":2,"class":"prop","upperTiles":[[16122,16123],[16124,16125]],"walk":["XX","XX"]}
```

### jb-in_b_gwan_desk_2 · 실내 관아 책상 2칸 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gwan_desk_2","w":2,"h":2,"class":"prop","upperTiles":[[16116,16117],[16118,16119]],"walk":["XX","XX"]}
```

### jb-in_b_gwan_desk_3 · 실내 관아 책상 3칸 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gwan_desk_3","w":3,"h":2,"class":"prop","upperTiles":[[16110,16111,16112],[16113,16114,16115]],"walk":["XXX","XXX"]}
```

### jb-in_b_gyojasang_2 · 실내 교자상 2칸 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gyojasang_2","w":2,"h":1,"class":"prop","upperTiles":[[15956,15957]],"walk":["XX"]}
```

### jb-in_b_gyojasang_3 · 실내 교자상 3칸 3×1 · 3×1 · 분류 prop
막힘 3 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gyojasang_3","w":3,"h":1,"class":"prop","upperTiles":[[15958,15959,15960]],"walk":["XXX"]}
```

### jb-in_b_gyoui · 실내 교의 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_gyoui","w":1,"h":2,"class":"prop","upperTiles":[[16120],[16121]],"walk":["C","X"]}
```

### jb-in_b_hang_bagaji · 실내 벽걸이 바가지 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_bagaji","w":1,"h":1,"class":"prop","upperTiles":[[16010]],"walk":["X"]}
```

### jb-in_b_hang_gochu · 실내 벽걸이 고추 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_gochu","w":1,"h":1,"class":"prop","upperTiles":[[16007]],"walk":["X"]}
```

### jb-in_b_hang_meju · 실내 벽걸이 메주 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_meju","w":1,"h":1,"class":"prop","upperTiles":[[16009]],"walk":["X"]}
```

### jb-in_b_hang_sirae · 실내 벽걸이 시래기 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_sirae","w":1,"h":1,"class":"prop","upperTiles":[[16006]],"walk":["X"]}
```

### jb-in_b_hang_tools · 실내 벽걸이 연장 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_tools","w":1,"h":1,"class":"prop","upperTiles":[[16073]],"walk":["X"]}
```

### jb-in_b_hang_yakcho · 실내 벽걸이 약초 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_hang_yakcho","w":1,"h":1,"class":"prop","upperTiles":[[16008]],"walk":["X"]}
```
