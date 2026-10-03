# 나무·소품·담·다리 조각 사전 2/10

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-zelkova_b · 느티나무 b 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 15 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_b","w":4,"h":5,"class":"tree","upperTiles":[[475,476,477,478],[491,492,493,494],[507,508,509,510],[-1,524,525,526],[539,540,541,542]],"walk":["CCCC","CCCC","CCCC",".CCC","FXXF"]}
```

### jb-zelkova_c · 느티나무 c 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_c","w":4,"h":5,"class":"tree","upperTiles":[[560,561,562,563],[576,577,578,579],[592,593,594,595],[608,609,610,611],[624,625,626,627]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-zelkova_d · 느티나무 d 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_d","w":4,"h":5,"class":"tree","upperTiles":[[564,565,566,567],[580,581,582,583],[596,597,598,599],[612,613,614,615],[628,629,630,631]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-zelkova_e · 느티나무 e 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 15 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_e","w":4,"h":5,"class":"tree","upperTiles":[[568,569,570,571],[584,585,586,587],[600,601,602,603],[616,617,618,-1],[632,633,634,635]],"walk":["CCCC","CCCC","CCCC","CCC.","FXXF"]}
```

### jb-zelkova_f · 느티나무 f 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_f","w":4,"h":5,"class":"tree","upperTiles":[[572,573,574,575],[588,589,590,591],[604,605,606,607],[620,621,622,623],[636,637,638,639]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-zelkova_g · 느티나무 g 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 13 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_g","w":4,"h":5,"class":"tree","upperTiles":[[-1,641,642,-1],[656,657,658,659],[672,673,674,675],[688,689,690,-1],[704,705,706,707]],"walk":[".CC.","CCCC","CCCC","CCC.","FXXF"]}
```

### jb-zelkova_h · 느티나무 h 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_h","w":4,"h":5,"class":"tree","upperTiles":[[644,645,646,647],[660,661,662,663],[676,677,678,679],[692,693,694,695],[708,709,710,711]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-zelkova_i · 느티나무 i 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_i","w":4,"h":5,"class":"tree","upperTiles":[[648,649,650,651],[664,665,666,667],[680,681,682,683],[696,697,698,699],[712,713,714,715]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-zelkova_j · 느티나무 j 4×5 · 4×5 · 분류 tree
막힘 2 · 걸음★ 16 · 걸음 2칸. 풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-zelkova_j","w":4,"h":5,"class":"tree","upperTiles":[[652,653,654,655],[668,669,670,671],[684,685,686,687],[700,701,702,703],[716,717,718,719]],"walk":["CCCC","CCCC","CCCC","CCCC","FXXF"]}
```

### jb-bush_a · 덤불 a 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_a","w":2,"h":2,"class":"bush","upperTiles":[[974,975],[990,991]],"walk":["CC","XX"]}
```

### jb-bush_b · 덤불 b 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_b","w":2,"h":2,"class":"bush","upperTiles":[[1024,1025],[1040,1041]],"walk":["CC","XX"]}
```

### jb-bush_c · 덤불 c 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_c","w":2,"h":2,"class":"bush","upperTiles":[[1026,1027],[1042,1043]],"walk":["CC","XX"]}
```

### jb-bush_d · 덤불 d 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_d","w":2,"h":2,"class":"bush","upperTiles":[[1028,1029],[1044,1045]],"walk":["CC","XX"]}
```

### jb-bush_e · 덤불 e 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_e","w":2,"h":2,"class":"bush","upperTiles":[[1030,1031],[1046,1047]],"walk":["CC","XX"]}
```

### jb-bush_f · 덤불 f 2×2 · 2×2 · 분류 bush
막힘 2 · 걸음★ 2 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_f","w":2,"h":2,"class":"bush","upperTiles":[[1032,1033],[1048,1049]],"walk":["CC","XX"]}
```

### jb-bush_l_a · 덤불 l_a 3×2 · 3×2 · 분류 bush
막힘 3 · 걸음★ 3 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_l_a","w":3,"h":2,"class":"bush","upperTiles":[[960,961,962],[976,977,978]],"walk":["CCC","XXX"]}
```

### jb-bush_l_b · 덤불 l_b 3×2 · 3×2 · 분류 bush
막힘 3 · 걸음★ 3 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_l_b","w":3,"h":2,"class":"bush","upperTiles":[[963,964,965],[979,980,981]],"walk":["CCC","XXX"]}
```

### jb-bush_l_c · 덤불 l_c 3×2 · 3×2 · 분류 bush
막힘 3 · 걸음★ 3 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_l_c","w":3,"h":2,"class":"bush","upperTiles":[[1034,1035,1036],[1050,1051,1052]],"walk":["CCC","XXX"]}
```

### jb-bush_l_d · 덤불 l_d 3×2 · 3×2 · 분류 bush
막힘 3 · 걸음★ 3 · 걸음 0칸. 풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.
```json
{"kit":"kit:joseon_baram/jb-bush_l_d","w":3,"h":2,"class":"bush","upperTiles":[[1037,1038,1039],[1053,1054,1055]],"walk":["CCC","XXX"]}
```

### jb-small_p · 어린 나무 p 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_p","w":2,"h":3,"class":"sapling","upperTiles":[[2338,2339],[2354,2355],[2370,2371]],"walk":["CC","CC","XX"]}
```

### jb-small_z_a · 어린 나무 z_a 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_z_a","w":2,"h":3,"class":"sapling","upperTiles":[[2221,2222],[2237,2238],[2253,2254]],"walk":["CC","CC","XX"]}
```

### jb-small_z_b · 어린 나무 z_b 2×3 · 2×3 · 분류 sapling
막힘 2 · 걸음★ 4 · 걸음 0칸. 풀 위. 줄기 칸만 막힌다.
```json
{"kit":"kit:joseon_baram/jb-small_z_b","w":2,"h":3,"class":"sapling","upperTiles":[[2336,2337],[2352,2353],[2368,2369]],"walk":["CC","CC","XX"]}
```
