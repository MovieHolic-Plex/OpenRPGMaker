# 나무·소품·담·다리 조각 사전 5/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-gn_stone_v1 · 국내성 stone_v1 1×1 · 1×1 · 분류 wall
막힘 1 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gn_stone_v1","w":1,"h":1,"class":"wall","upperTiles":[[8158]],"walk":["X"]}
```

### jb-gnf_bastion_e · gnf bastion e 5×5 · 5×5 · 분류 wall
막힘 25 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gnf_bastion_e","w":5,"h":5,"class":"wall","upperTiles":[[9936,9937,9938,9939,9940],[9941,9942,9943,9944,9945],[9946,9947,9948,9949,9950],[9951,9952,9953,9954,9955],[9956,9957,9958,9959,9960]],"walk":["XXXXX","XXXXX","XXXXX","XXXXX","XXXXX"]}
```

### jb-gnf_bastion_e2 · gnf bastion e2 5×5 · 5×5 · 분류 wall
막힘 25 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gnf_bastion_e2","w":5,"h":5,"class":"wall","upperTiles":[[9886,9887,9888,9889,9890],[9891,9892,9893,9894,9895],[9896,9897,9898,9899,9900],[9901,9902,9903,9904,9905],[9906,9907,9908,9909,9910]],"walk":["XXXXX","XXXXX","XXXXX","XXXXX","XXXXX"]}
```

### jb-gnf_bastion_w · gnf bastion w 5×5 · 5×5 · 분류 wall
막힘 25 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gnf_bastion_w","w":5,"h":5,"class":"wall","upperTiles":[[9861,9862,9863,9864,9865],[9866,9867,9868,9869,9870],[9871,9872,9873,9874,9875],[9876,9877,9878,9879,9880],[9881,9882,9883,9884,9885]],"walk":["XXXXX","XXXXX","XXXXX","XXXXX","XXXXX"]}
```

### jb-gnf_bastion_w2 · gnf bastion w2 5×5 · 5×5 · 분류 wall
막힘 25 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gnf_bastion_w2","w":5,"h":5,"class":"wall","upperTiles":[[9911,9912,9913,9914,9915],[9916,9917,9918,9919,9920],[9921,9922,9923,9924,9925],[9926,9927,9928,9929,9930],[9931,9932,9933,9934,9935]],"walk":["XXXXX","XXXXX","XXXXX","XXXXX","XXXXX"]}
```

### jb-gungnae_wall_corner_ne · 국내성 성벽 corner_ne 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_ne","w":3,"h":5,"class":"wall","upperTiles":[[4793,4794,4795],[4809,4810,4811],[4825,4826,4827],[4841,4842,4843],[4857,4858,4859]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_nw · 국내성 성벽 corner_nw 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_nw","w":3,"h":5,"class":"wall","upperTiles":[[4790,4791,4792],[4806,4807,4808],[4822,4823,4824],[4838,4839,4840],[4854,4855,4856]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

### jb-gungnae_wall_corner_se · 국내성 성벽 corner_se 3×5 · 3×5 · 분류 wall
막힘 15 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-gungnae_wall_corner_se","w":3,"h":5,"class":"wall","upperTiles":[[4864,4865,4866],[4880,4881,4882],[4896,4897,4898],[4912,4913,4914],[4928,4929,4930]],"walk":["XXX","XXX","XXX","XXX","XXX"]}
```

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
