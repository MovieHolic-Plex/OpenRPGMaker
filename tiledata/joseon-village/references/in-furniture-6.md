# 실내 기물 사전(가구·깔개·벽걸이·그릇) 6/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_weapon_rack_2 · 실내 무기 걸이 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_weapon_rack_2","w":2,"h":2,"class":"prop","upperTiles":[[16188,16189],[16190,16191]],"walk":["CC","XX"]}
```

### jb-in_b_yak_table · 실내 약 상 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yak_table","w":2,"h":1,"class":"prop","upperTiles":[[16085,16086]],"walk":["XX"]}
```

### jb-in_b_yakcho_basket · 실내 약초 바구니 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakcho_basket","w":1,"h":1,"class":"prop","upperTiles":[[16087]],"walk":["X"]}
```

### jb-in_b_yakdang · 실내 약탕 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakdang","w":1,"h":1,"class":"prop","upperTiles":[[16082]],"walk":["X"]}
```

### jb-in_b_yakjang_1 · 실내 약장 1칸 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakjang_1","w":1,"h":2,"class":"prop","upperTiles":[[16080],[16081]],"walk":["C","X"]}
```

### jb-in_b_yakjang_2 · 실내 약장 2칸 2×3 · 2×3 · 분류 prop
막힘 2 · 걸음★ 4 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakjang_2","w":2,"h":3,"class":"prop","upperTiles":[[16074,16075],[16076,16077],[16078,16079]],"walk":["CC","CC","XX"]}
```

### jb-in_b_yakseonban_2 · 실내 약선반 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakseonban_2","w":2,"h":2,"class":"prop","upperTiles":[[16169,16170],[16171,16172]],"walk":["CC","XX"]}
```

### jb-in_b_yakyeon · 실내 약연 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_yakyeon","w":1,"h":1,"class":"prop","upperTiles":[[16083]],"walk":["X"]}
```
