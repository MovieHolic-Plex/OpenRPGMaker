# 실내 기물 사전(가구·깔개·벽걸이·그릇) 4/6

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_mat_dot_2x2 · 실내 깔개 돗자리 2×2 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_dot_2x2","w":2,"h":2,"class":"prop","upperTiles":[[15994,15995],[15996,15997]],"walk":["FF","FF"]}
```

### jb-in_b_mat_hopi · 실내 깔개 호피 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_hopi","w":2,"h":2,"class":"prop","upperTiles":[[16129,16130],[16131,16132]],"walk":["FF","FF"]}
```

### jb-in_b_mat_jip_2x2 · 실내 깔개 짚 2×2 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_2x2","w":2,"h":2,"class":"prop","upperTiles":[[15970,15971],[15972,15973]],"walk":["FF","FF"]}
```

### jb-in_b_mat_jip_2x2__s11 · 실내 깔개 짚 2×2 (변형 11) 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_2x2__s11","w":2,"h":2,"class":"prop","upperTiles":[[16358,16359],[16360,16361]],"walk":["FF","FF"]}
```

### jb-in_b_mat_jip_2x2b · 실내 깔개 짚 2×2B 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_2x2b","w":2,"h":2,"class":"prop","upperTiles":[[15980,15981],[15982,15983]],"walk":["FF","FF"]}
```

### jb-in_b_mat_jip_2x2c · 실내 깔개 짚 2×2C 2×2 · 2×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_2x2c","w":2,"h":2,"class":"prop","upperTiles":[[15984,15985],[15986,15987]],"walk":["FF","FF"]}
```

### jb-in_b_mat_jip_3x2 · 실내 깔개 짚 3×2 3×2 · 3×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_3x2","w":3,"h":2,"class":"prop","upperTiles":[[15974,15975,15976],[15977,15978,15979]],"walk":["FFF","FFF"]}
```

### jb-in_b_mat_jip_3x2__s11 · 실내 깔개 짚 3×2 (변형 11) 3×2 · 3×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_3x2__s11","w":3,"h":2,"class":"prop","upperTiles":[[16362,16363,16364],[16365,16366,16367]],"walk":["FFF","FFF"]}
```

### jb-in_b_mat_jip_3x2c · 실내 깔개 짚 3×2C 3×2 · 3×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 6칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mat_jip_3x2c","w":3,"h":2,"class":"prop","upperTiles":[[15988,15989,15990],[15991,15992,15993]],"walk":["FFF","FFF"]}
```

### jb-in_b_moru · 실내 모루 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_moru","w":1,"h":1,"class":"prop","upperTiles":[[16060]],"walk":["X"]}
```

### jb-in_b_muldongi · 실내 물동이 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_muldongi","w":1,"h":1,"class":"prop","upperTiles":[[16041]],"walk":["X"]}
```

### jb-in_b_mulle · 실내 물레 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mulle","w":1,"h":1,"class":"prop","upperTiles":[[16056]],"walk":["X"]}
```

### jb-in_b_munggap · 실내 문갑 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_munggap","w":2,"h":1,"class":"prop","upperTiles":[[15949,15950]],"walk":["XX"]}
```

### jb-in_b_mungseo_ham · 실내 문서 함 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_mungseo_ham","w":1,"h":1,"class":"prop","upperTiles":[[16128]],"walk":["X"]}
```

### jb-in_b_nong_1 · 실내 농 1칸 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_nong_1","w":1,"h":2,"class":"prop","upperTiles":[[15940],[15941]],"walk":["C","X"]}
```

### jb-in_b_nong_2 · 실내 농 2칸 2×2 · 2×2 · 분류 prop
막힘 2 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_nong_2","w":2,"h":2,"class":"prop","upperTiles":[[15942,15943],[15944,15945]],"walk":["CC","XX"]}
```

### jb-in_b_pungmu · 실내 풀무 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pungmu","w":2,"h":1,"class":"prop","upperTiles":[[16058,16059]],"walk":["XX"]}
```

### jb-in_b_pyeongsang_2 · 실내 평상 2칸 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_2","w":2,"h":2,"class":"prop","upperTiles":[[16017,16018],[16019,16020]],"walk":["XX","XX"]}
```

### jb-in_b_pyeongsang_2b · 실내 평상 2칸 B 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_2b","w":2,"h":2,"class":"prop","upperTiles":[[16154,16155],[16156,16157]],"walk":["XX","XX"]}
```

### jb-in_b_pyeongsang_2c · 실내 평상 2칸 C 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_2c","w":2,"h":2,"class":"prop","upperTiles":[[16158,16159],[16160,16161]],"walk":["XX","XX"]}
```

### jb-in_b_pyeongsang_3 · 실내 평상 3칸 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_3","w":3,"h":2,"class":"prop","upperTiles":[[16011,16012,16013],[16014,16015,16016]],"walk":["XXX","XXX"]}
```

### jb-in_b_pyeongsang_3b · 실내 평상 3칸 B 3×2 · 3×2 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-in_b_pyeongsang_3b","w":3,"h":2,"class":"prop","upperTiles":[[16148,16149,16150],[16151,16152,16153]],"walk":["XXX","XXX"]}
```
