# 실내 구조 조각 사전(벽·창·문·기둥·보·단·계단) 3/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

벽면 2줄 조각(`wall_*` 1×2, 끝 l·m·r·lr)·창·문틀·미닫이·기둥·보·계단·사다리·단·출구 깔개. 벽·문은 윗부분 `C`(천장 위로 걸침) 아랫부분 `X`, 문 칸·출구 깔개는 걸음.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_b_wall_dol_r · 실내 벽 돌벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_dol_r","w":1,"h":2,"class":"wall","upperTiles":[[15819],[15820]],"walk":["X","X"]}
```

### jb-in_b_wall_heuk_l · 실내 벽 흙벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_heuk_l","w":1,"h":2,"class":"wall","upperTiles":[[15809],[15810]],"walk":["X","X"]}
```

### jb-in_b_wall_heuk_lr · 실내 벽 흙벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_heuk_lr","w":1,"h":2,"class":"wall","upperTiles":[[15813],[15814]],"walk":["X","X"]}
```

### jb-in_b_wall_heuk_m · 실내 벽 흙벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_heuk_m","w":1,"h":2,"class":"wall","upperTiles":[[15807],[15808]],"walk":["X","X"]}
```

### jb-in_b_wall_heuk_r · 실내 벽 흙벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_heuk_r","w":1,"h":2,"class":"wall","upperTiles":[[15811],[15812]],"walk":["X","X"]}
```

### jb-in_b_wall_hoe_l · 실내 벽 회벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_hoe_l","w":1,"h":2,"class":"wall","upperTiles":[[15793],[15794]],"walk":["X","X"]}
```

### jb-in_b_wall_hoe_lr · 실내 벽 회벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_hoe_lr","w":1,"h":2,"class":"wall","upperTiles":[[15797],[15798]],"walk":["X","X"]}
```

### jb-in_b_wall_hoe_m · 실내 벽 회벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_hoe_m","w":1,"h":2,"class":"wall","upperTiles":[[15791],[15792]],"walk":["X","X"]}
```

### jb-in_b_wall_hoe_r · 실내 벽 회벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_hoe_r","w":1,"h":2,"class":"wall","upperTiles":[[15795],[15796]],"walk":["X","X"]}
```

### jb-in_b_wall_mok_l · 실내 벽 목재벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_mok_l","w":1,"h":2,"class":"wall","upperTiles":[[15801],[15802]],"walk":["X","X"]}
```

### jb-in_b_wall_mok_lr · 실내 벽 목재벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_mok_lr","w":1,"h":2,"class":"wall","upperTiles":[[15805],[15806]],"walk":["X","X"]}
```

### jb-in_b_wall_mok_m · 실내 벽 목재벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_mok_m","w":1,"h":2,"class":"wall","upperTiles":[[15799],[15800]],"walk":["X","X"]}
```

### jb-in_b_wall_mok_r · 실내 벽 목재벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_wall_mok_r","w":1,"h":2,"class":"wall","upperTiles":[[15803],[15804]],"walk":["X","X"]}
```

### jb-in_b_win_heuk · 실내 창 흙벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_win_heuk","w":1,"h":2,"class":"wall","upperTiles":[[15837],[15838]],"walk":["X","X"]}
```

### jb-in_b_win_hoe · 실내 창 회벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_win_hoe","w":1,"h":2,"class":"wall","upperTiles":[[15831],[15832]],"walk":["X","X"]}
```

### jb-in_b_win_mok · 실내 창 목재벽 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_win_mok","w":1,"h":2,"class":"wall","upperTiles":[[15835],[15836]],"walk":["X","X"]}
```

### jb-in_b_win_round · 실내 창 둥근 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_b_win_round","w":1,"h":2,"class":"wall","upperTiles":[[15833],[15834]],"walk":["X","X"]}
```
