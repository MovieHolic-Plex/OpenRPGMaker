# 나무·소품·담·다리 조각 사전 20/21

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16776칸**, 16px 칸, 한 줄 **72칸** — 번호 n 의 칸은 행 n÷72, 열 n%72, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 16551 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).

나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_gyeongdae · pal gyeongdae 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_gyeongdae","w":1,"h":1,"class":"prop","upperTiles":[[16410]],"walk":["X"]}
```

### jb-pal_hwajangdae · pal hwajangdae 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hwajangdae","w":2,"h":2,"class":"prop","upperTiles":[[16406,16407],[16408,16409]],"walk":["XX","XX"]}
```

### jb-pal_hyangro · pal hyangro 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_hyangro","w":1,"h":2,"class":"prop","upperTiles":[[16371],[16372]],"walk":["X","X"]}
```

### jb-pal_jangnong · pal jangnong 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_jangnong","w":2,"h":3,"class":"prop","upperTiles":[[16400,16401],[16402,16403],[16404,16405]],"walk":["XX","XX","XX"]}
```

### jb-pal_jong · pal jong 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_jong","w":2,"h":2,"class":"prop","upperTiles":[[16390,16391],[16392,16393]],"walk":["XX","XX"]}
```

### jb-pal_munseo_ham · pal munseo ham 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_munseo_ham","w":1,"h":1,"class":"prop","upperTiles":[[16385]],"walk":["X"]}
```

### jb-pal_pillar · pal pillar 1×3 · 1×3 · 분류 prop
막힘 1 · 걸음★ 2 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar","w":1,"h":3,"class":"prop","upperTiles":[[16316],[16317],[16318]],"walk":["C","C","X"]}
```

### jb-pal_pillar_2 · pal pillar 2 1×2 · 1×2 · 분류 prop
막힘 1 · 걸음★ 1 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_pillar_2","w":1,"h":2,"class":"prop","upperTiles":[[16319],[16320]],"walk":["C","X"]}
```

### jb-pal_seoan_gwan · pal seoan gwan 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_seoan_gwan","w":2,"h":1,"class":"prop","upperTiles":[[16383,16384]],"walk":["XX"]}
```

### jb-pal_seoga_tall · pal seoga tall 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_seoga_tall","w":2,"h":3,"class":"prop","upperTiles":[[16414,16415],[16416,16417],[16418,16419]],"walk":["XX","XX","XX"]}
```

### jb-pal_surasang · pal surasang 2×1 · 2×1 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_surasang","w":2,"h":1,"class":"prop","upperTiles":[[16411,16412]],"walk":["XX"]}
```

### jb-pal_throne · pal throne 2×3 · 2×3 · 분류 prop
막힘 6 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_throne","w":2,"h":3,"class":"prop","upperTiles":[[16347,16348],[16349,16350],[16351,16352]],"walk":["XX","XX","XX"]}
```

### jb-pal_uija · pal uija 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_uija","w":1,"h":2,"class":"prop","upperTiles":[[16381],[16382]],"walk":["X","X"]}
```

### jb-pal_yaktang · pal yaktang 1×1 · 1×1 · 분류 prop
막힘 1 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-pal_yaktang","w":1,"h":1,"class":"prop","upperTiles":[[16413]],"walk":["X"]}
```

### jb-palace_censer · 궁궐 censer 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_censer","w":1,"h":2,"class":"prop","upperTiles":[[4240],[4256]],"walk":["X","X"]}
```

### jb-palace_deumeu · 궁궐 deumeu 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_deumeu","w":1,"h":2,"class":"prop","upperTiles":[[4159],[4175]],"walk":["X","X"]}
```

### jb-palace_eodo · 궁궐 eodo 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_eodo","w":4,"h":1,"class":"prop","upperTiles":[[4009,4010,4011,4012]],"walk":["FFFF"]}
```

### jb-palace_eodo_end · 궁궐 eodo_end 4×1 · 4×1 · 분류 prop
막힘 0 · 걸음★ 0 · 걸음 4칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_eodo_end","w":4,"h":1,"class":"prop","upperTiles":[[4096,4097,4098,4099]],"walk":["FFFF"]}
```

### jb-palace_gate_side_3 · 궁문 side_3 3×8 · 3×8 · 분류 prop
막힘 10 · 걸음★ 0 · 걸음 14칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_gate_side_3","w":3,"h":8,"class":"prop","upperTiles":[[5365,5366,5367],[5381,5382,5383],[5397,5398,5399],[5413,5414,5415],[5429,5430,5431],[5445,5446,5447],[5461,5462,5463],[5477,5478,5479]],"walk":["FXF","XXX","XXX","XXX","FFF","FFF","FFF","FFF"]}
```

### jb-palace_haetae · 궁궐 haetae 2×2 · 2×2 · 분류 prop
막힘 4 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_haetae","w":2,"h":2,"class":"prop","upperTiles":[[4157,4158],[4173,4174]],"walk":["XX","XX"]}
```

### jb-palace_lantern · 궁궐 lantern 1×2 · 1×2 · 분류 prop
막힘 2 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_lantern","w":1,"h":2,"class":"prop","upperTiles":[[4156],[4172]],"walk":["X","X"]}
```

### jb-palace_pond_4 · 궁궐 pond_4 4×3 · 4×3 · 분류 prop
막힘 12 · 걸음★ 0 · 걸음 0칸. 땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).
```json
{"kit":"kit:joseon_baram/jb-palace_pond_4","w":4,"h":3,"class":"prop","upperTiles":[[4100,4101,4102,4103],[4116,4117,4118,4119],[4132,4133,4134,4135]],"walk":["XXXX","XXXX","XXXX"]}
```
