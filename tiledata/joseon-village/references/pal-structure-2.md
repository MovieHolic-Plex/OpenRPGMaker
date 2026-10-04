# 궁 구조 조각 사전(벽·문·기둥·보·단·카펫·난간) 2/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

궁 벽(창호·회벽)·쌍문·단청 기둥·보·어좌 단(윗면·앞면·계단)·어도 카펫·난간·디딤돌. 단 계단·카펫·디딤돌은 걸음(F), 기둥 몸은 막힘, 머리는 걸음★.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_mat_carpet_m_s · 궁 깔개 카펫 가운데 S 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_m_s","w":1,"h":1,"class":"prop","upperTiles":[[16427]],"walk":["F"]}
```

### jb-pal_mat_carpet_r_a · 궁 깔개 카펫 오른끝 A 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_r_a","w":1,"h":1,"class":"prop","upperTiles":[[16428]],"walk":["F"]}
```

### jb-pal_mat_carpet_r_b · 궁 깔개 카펫 오른끝 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_r_b","w":1,"h":1,"class":"prop","upperTiles":[[16429]],"walk":["F"]}
```

### jb-pal_mat_carpet_r_s · 궁 깔개 카펫 오른끝 S 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_r_s","w":1,"h":1,"class":"prop","upperTiles":[[16430]],"walk":["F"]}
```

### jb-pal_mat_run_l · 궁 깔개 줄무늬 왼끝 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_run_l","w":1,"h":2,"class":"prop","upperTiles":[[16437],[16438]],"walk":["F","F"]}
```

### jb-pal_mat_run_m · 궁 깔개 줄무늬 가운데 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_run_m","w":1,"h":2,"class":"prop","upperTiles":[[16432],[16433]],"walk":["F","F"]}
```

### jb-pal_mat_run_r · 궁 깔개 줄무늬 오른끝 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_run_r","w":1,"h":2,"class":"prop","upperTiles":[[16442],[16443]],"walk":["F","F"]}
```

### jb-pal_mat_runb_l · 궁 깔개 줄무늬 B 왼끝 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_runb_l","w":1,"h":2,"class":"prop","upperTiles":[[16439],[16440]],"walk":["F","F"]}
```

### jb-pal_mat_runb_m · 궁 깔개 줄무늬 B 가운데 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_runb_m","w":1,"h":2,"class":"prop","upperTiles":[[16434],[16435]],"walk":["F","F"]}
```

### jb-pal_mat_runb_r · 궁 깔개 줄무늬 B 오른끝 1×2 · 1×2 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_runb_r","w":1,"h":2,"class":"prop","upperTiles":[[16444],[16445]],"walk":["F","F"]}
```

### jb-pal_nangan_l · 궁 난간 왼끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_nangan_l","w":1,"h":1,"class":"prop","upperTiles":[[16436]],"walk":["X"]}
```

### jb-pal_nangan_m · 궁 난간 가운데 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_nangan_m","w":1,"h":1,"class":"prop","upperTiles":[[16431]],"walk":["X"]}
```

### jb-pal_nangan_r · 궁 난간 오른끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_nangan_r","w":1,"h":1,"class":"prop","upperTiles":[[16441]],"walk":["X"]}
```

### jb-pal_pillar_dan_2a · 궁 기둥 단청 2칸 A 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_2a","w":1,"h":2,"class":"prop","upperTiles":[[16392],[16393]],"walk":["C","X"]}
```

### jb-pal_pillar_dan_2b · 궁 기둥 단청 2칸 B 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_2b","w":1,"h":2,"class":"prop","upperTiles":[[16397],[16398]],"walk":["C","X"]}
```

### jb-pal_pillar_dan_2c · 궁 기둥 단청 2칸 C 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_2c","w":1,"h":2,"class":"prop","upperTiles":[[16402],[16403]],"walk":["C","X"]}
```

### jb-pal_pillar_dan_3a · 궁 기둥 단청 3칸 A 1×3 · 1×3 · 분류 prop
막힘 1 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_3a","w":1,"h":3,"class":"prop","upperTiles":[[16394],[16395],[16396]],"walk":["C","C","X"]}
```

### jb-pal_pillar_dan_3b · 궁 기둥 단청 3칸 B 1×3 · 1×3 · 분류 prop
막힘 1 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_3b","w":1,"h":3,"class":"prop","upperTiles":[[16399],[16400],[16401]],"walk":["C","C","X"]}
```

### jb-pal_pillar_dan_3c · 궁 기둥 단청 3칸 C 1×3 · 1×3 · 분류 prop
막힘 1 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_dan_3c","w":1,"h":3,"class":"prop","upperTiles":[[16404],[16405],[16406]],"walk":["C","C","X"]}
```

### jb-pal_step_stone · 궁 디딤돌 돌 2×1 · 2×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 2칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_step_stone","w":2,"h":1,"class":"prop","upperTiles":[[16452,16453]],"walk":["FF"]}
```

### jb-pal_wall_gung_l · 궁 벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gung_l","w":1,"h":2,"class":"wall","upperTiles":[[16370],[16371]],"walk":["X","X"]}
```

### jb-pal_wall_gung_lr · 궁 벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gung_lr","w":1,"h":2,"class":"wall","upperTiles":[[16374],[16375]],"walk":["X","X"]}
```
