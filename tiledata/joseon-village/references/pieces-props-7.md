# 나무·소품·담·다리 조각 사전 7/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-in_wall_hoe_l · in wall hoe l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_l","w":1,"h":2,"class":"wall","upperTiles":[[15688],[15689]],"walk":["X","X"]}
```

### jb-in_wall_hoe_lr · in wall hoe lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_lr","w":1,"h":2,"class":"wall","upperTiles":[[15692],[15693]],"walk":["X","X"]}
```

### jb-in_wall_hoe_m · in wall hoe m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_m","w":1,"h":2,"class":"wall","upperTiles":[[15686],[15687]],"walk":["X","X"]}
```

### jb-in_wall_hoe_r · in wall hoe r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_r","w":1,"h":2,"class":"wall","upperTiles":[[15690],[15691]],"walk":["X","X"]}
```

### jb-in_wall_hoe_win · in wall hoe win 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_hoe_win","w":1,"h":2,"class":"wall","upperTiles":[[15726],[15727]],"walk":["X","X"]}
```

### jb-in_wall_mok_door · in wall mok door 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_door","w":1,"h":2,"class":"wall","upperTiles":[[15736],[15737]],"walk":["X","X"]}
```

### jb-in_wall_mok_l · in wall mok l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_l","w":1,"h":2,"class":"wall","upperTiles":[[15704],[15705]],"walk":["X","X"]}
```

### jb-in_wall_mok_lr · in wall mok lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_lr","w":1,"h":2,"class":"wall","upperTiles":[[15708],[15709]],"walk":["X","X"]}
```

### jb-in_wall_mok_m · in wall mok m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_m","w":1,"h":2,"class":"wall","upperTiles":[[15702],[15703]],"walk":["X","X"]}
```

### jb-in_wall_mok_r · in wall mok r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_r","w":1,"h":2,"class":"wall","upperTiles":[[15706],[15707]],"walk":["X","X"]}
```

### jb-in_wall_mok_win · in wall mok win 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-in_wall_mok_win","w":1,"h":2,"class":"wall","upperTiles":[[15728],[15729]],"walk":["X","X"]}
```

### jb-pal_wall_bun_l · pal wall bun l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_bun_l","w":1,"h":2,"class":"wall","upperTiles":[[16290],[16291]],"walk":["X","X"]}
```

### jb-pal_wall_bun_lr · pal wall bun lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_bun_lr","w":1,"h":2,"class":"wall","upperTiles":[[16294],[16295]],"walk":["X","X"]}
```

### jb-pal_wall_bun_m · pal wall bun m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_bun_m","w":1,"h":2,"class":"wall","upperTiles":[[16288],[16289]],"walk":["X","X"]}
```

### jb-pal_wall_bun_r · pal wall bun r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_bun_r","w":1,"h":2,"class":"wall","upperTiles":[[16292],[16293]],"walk":["X","X"]}
```

### jb-pal_wall_chang_l · pal wall chang l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_chang_l","w":1,"h":2,"class":"wall","upperTiles":[[16298],[16299]],"walk":["X","X"]}
```

### jb-pal_wall_chang_lr · pal wall chang lr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_chang_lr","w":1,"h":2,"class":"wall","upperTiles":[[16302],[16303]],"walk":["X","X"]}
```

### jb-pal_wall_chang_m · pal wall chang m 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_chang_m","w":1,"h":2,"class":"wall","upperTiles":[[16296],[16297]],"walk":["X","X"]}
```

### jb-pal_wall_chang_r · pal wall chang r 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_chang_r","w":1,"h":2,"class":"wall","upperTiles":[[16300],[16301]],"walk":["X","X"]}
```

### jb-pal_wall_hoe_doorl · pal wall hoe doorl 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_hoe_doorl","w":1,"h":2,"class":"wall","upperTiles":[[16312],[16313]],"walk":["X","X"]}
```

### jb-pal_wall_hoe_doorr · pal wall hoe doorr 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_hoe_doorr","w":1,"h":2,"class":"wall","upperTiles":[[16314],[16315]],"walk":["X","X"]}
```

### jb-pal_wall_hoe_l · pal wall hoe l 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_hoe_l","w":1,"h":2,"class":"wall","upperTiles":[[16306],[16307]],"walk":["X","X"]}
```
