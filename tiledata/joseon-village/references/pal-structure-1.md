# 궁 구조 조각 사전(벽·문·기둥·보·단·카펫·난간) 1/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

궁 벽(창호·회벽)·쌍문·단청 기둥·보·어좌 단(윗면·앞면·계단)·어도 카펫·난간·디딤돌. 단 계단·카펫·디딤돌은 걸음(F), 기둥 몸은 막힘, 머리는 걸음★.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_beam_dan_l · 궁 보 단청 왼끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_beam_dan_l","w":1,"h":1,"class":"prop","upperTiles":[[16408]],"walk":["C"]}
```

### jb-pal_beam_dan_m · 궁 보 단청 가운데 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_beam_dan_m","w":1,"h":1,"class":"prop","upperTiles":[[16407]],"walk":["C"]}
```

### jb-pal_beam_dan_r · 궁 보 단청 오른끝 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_beam_dan_r","w":1,"h":1,"class":"prop","upperTiles":[[16409]],"walk":["C"]}
```

### jb-pal_dais_face_l · 어좌 단 앞면 왼끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_face_l","w":1,"h":1,"class":"prop","upperTiles":[[16412]],"walk":["X"]}
```

### jb-pal_dais_face_m · 어좌 단 앞면 가운데 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_face_m","w":1,"h":1,"class":"prop","upperTiles":[[16415]],"walk":["X"]}
```

### jb-pal_dais_face_r · 어좌 단 앞면 오른끝 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_face_r","w":1,"h":1,"class":"prop","upperTiles":[[16418]],"walk":["X"]}
```

### jb-pal_dais_stair_3 · 궁 단 계단 3칸 3×1 · 3×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 3칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_stair_3","w":3,"h":1,"class":"prop","upperTiles":[[16419,16420,16421]],"walk":["FFF"]}
```

### jb-pal_dais_top_l_b · 어좌 단 윗면 왼끝 뒷줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_l_b","w":1,"h":1,"class":"prop","upperTiles":[[16411]],"walk":["F"]}
```

### jb-pal_dais_top_l_m · 어좌 단 윗면 왼끝 가운데줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_l_m","w":1,"h":1,"class":"prop","upperTiles":[[16410]],"walk":["F"]}
```

### jb-pal_dais_top_m_b · 어좌 단 윗면 가운데 뒷줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_m_b","w":1,"h":1,"class":"prop","upperTiles":[[16414]],"walk":["F"]}
```

### jb-pal_dais_top_m_m · 어좌 단 윗면 가운데 가운데줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_m_m","w":1,"h":1,"class":"prop","upperTiles":[[16413]],"walk":["F"]}
```

### jb-pal_dais_top_r_b · 어좌 단 윗면 오른끝 뒷줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_r_b","w":1,"h":1,"class":"prop","upperTiles":[[16417]],"walk":["F"]}
```

### jb-pal_dais_top_r_m · 어좌 단 윗면 오른끝 가운데줄 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_dais_top_r_m","w":1,"h":1,"class":"prop","upperTiles":[[16416]],"walk":["F"]}
```

### jb-pal_door_gung_l · 궁 문 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_door_gung_l","w":1,"h":2,"class":"wall","upperTiles":[[16384],[16385]],"walk":["X","X"]}
```

### jb-pal_door_gung_open_l · 궁 문 열린 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_door_gung_open_l","w":1,"h":2,"class":"wall","upperTiles":[[16386],[16387]],"walk":["X","X"]}
```

### jb-pal_door_gung_open_r · 궁 문 열린 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_door_gung_open_r","w":1,"h":2,"class":"wall","upperTiles":[[16390],[16391]],"walk":["X","X"]}
```

### jb-pal_door_gung_r · 궁 문 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_door_gung_r","w":1,"h":2,"class":"wall","upperTiles":[[16388],[16389]],"walk":["X","X"]}
```

### jb-pal_mat_carpet_l_a · 궁 깔개 카펫 왼끝 A 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_l_a","w":1,"h":1,"class":"prop","upperTiles":[[16422]],"walk":["F"]}
```

### jb-pal_mat_carpet_l_b · 궁 깔개 카펫 왼끝 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_l_b","w":1,"h":1,"class":"prop","upperTiles":[[16423]],"walk":["F"]}
```

### jb-pal_mat_carpet_l_s · 궁 깔개 카펫 왼끝 S 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_l_s","w":1,"h":1,"class":"prop","upperTiles":[[16424]],"walk":["F"]}
```

### jb-pal_mat_carpet_m_a · 궁 깔개 카펫 가운데 A 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_m_a","w":1,"h":1,"class":"prop","upperTiles":[[16425]],"walk":["F"]}
```

### jb-pal_mat_carpet_m_b · 궁 깔개 카펫 가운데 B 1×1 · 1×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 1칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_mat_carpet_m_b","w":1,"h":1,"class":"prop","upperTiles":[[16426]],"walk":["F"]}
```
