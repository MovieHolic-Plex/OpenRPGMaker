# 나무·소품·담·다리 조각 사전 5/10

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gungnae_wall_corner_sw · 국내성 성벽 corner_sw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_sw","w":3,"h":5,"class":"wall","upperTiles":[[4796,4797,4798],[4812,4813,4814],[4828,4829,4830],[4844,4845,4846],[4860,4861,4862]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_end_l · 국내성 성벽 end_l 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_l","w":1,"h":5,"class":"wall","upperTiles":[[4867],[4883],[4899],[4915],[4931]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_end_r · 국내성 성벽 end_r 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_end_r","w":1,"h":5,"class":"wall","upperTiles":[[4868],[4884],[4900],[4916],[4932]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h · 국내성 성벽 h 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h","w":1,"h":5,"class":"wall","upperTiles":[[4475],[4491],[4507],[4523],[4539]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h1 · 국내성 성벽 h1 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h1","w":1,"h":5,"class":"wall","upperTiles":[[4476],[4492],[4508],[4524],[4540]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h2 · 국내성 성벽 h2 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h2","w":1,"h":5,"class":"wall","upperTiles":[[4477],[4493],[4509],[4525],[4541]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h3 · 국내성 성벽 h3 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h3","w":1,"h":5,"class":"wall","upperTiles":[[4478],[4494],[4510],[4526],[4542]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h4 · 국내성 성벽 h4 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h4","w":1,"h":5,"class":"wall","upperTiles":[[4479],[4495],[4511],[4527],[4543]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_h5 · 국내성 성벽 h5 1×5 · 1×5 · 분류 wall
막힘 5 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_h5","w":1,"h":5,"class":"wall","upperTiles":[[4688],[4704],[4720],[4736],[4752]],"walk":["X","X","X","X","X"]}
```

### jb-gungnae_wall_v · 국내성 성벽 v 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v","w":3,"h":1,"class":"wall","upperTiles":[[4689,4690,4691]],"walk":["XXX"]}
```

### jb-gungnae_wall_v1 · 국내성 성벽 v1 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v1","w":3,"h":1,"class":"wall","upperTiles":[[4695,4696,4697]],"walk":["XXX"]}
```

### jb-gungnae_wall_v1_e · 국내성 성벽 v1_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v1_e","w":3,"h":1,"class":"wall","upperTiles":[[4698,4699,4700]],"walk":["XXX"]}
```

### jb-gungnae_wall_v2 · 국내성 성벽 v2 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v2","w":3,"h":1,"class":"wall","upperTiles":[[4701,4702,4703]],"walk":["XXX"]}
```

### jb-gungnae_wall_v2_e · 국내성 성벽 v2_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v2_e","w":3,"h":1,"class":"wall","upperTiles":[[4768,4769,4770]],"walk":["XXX"]}
```

### jb-gungnae_wall_v3 · 국내성 성벽 v3 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v3","w":3,"h":1,"class":"wall","upperTiles":[[4771,4772,4773]],"walk":["XXX"]}
```

### jb-gungnae_wall_v3_e · 국내성 성벽 v3_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v3_e","w":3,"h":1,"class":"wall","upperTiles":[[4774,4775,4776]],"walk":["XXX"]}
```

### jb-gungnae_wall_v4 · 국내성 성벽 v4 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v4","w":3,"h":1,"class":"wall","upperTiles":[[4777,4778,4779]],"walk":["XXX"]}
```

### jb-gungnae_wall_v4_e · 국내성 성벽 v4_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v4_e","w":3,"h":1,"class":"wall","upperTiles":[[4780,4781,4782]],"walk":["XXX"]}
```

### jb-gungnae_wall_v5 · 국내성 성벽 v5 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v5","w":3,"h":1,"class":"wall","upperTiles":[[4784,4785,4786]],"walk":["XXX"]}
```

### jb-gungnae_wall_v5_e · 국내성 성벽 v5_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v5_e","w":3,"h":1,"class":"wall","upperTiles":[[4787,4788,4789]],"walk":["XXX"]}
```

### jb-gungnae_wall_v_e · 국내성 성벽 v_e 3×1 · 3×1 · 분류 wall
막힘 3 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_v_e","w":3,"h":1,"class":"wall","upperTiles":[[4692,4693,4694]],"walk":["XXX"]}
```

### jb-palace_wall_h · 궁 담 h 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-palace_wall_h","w":1,"h":2,"class":"wall","upperTiles":[[3914],[3930]],"walk":["X","X"]}
```
