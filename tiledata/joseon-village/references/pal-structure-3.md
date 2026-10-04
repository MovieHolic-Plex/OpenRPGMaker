# 궁 구조 조각 사전(벽·문·기둥·보·단·카펫·난간) 3/3

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

궁 벽(창호·회벽)·쌍문·단청 기둥·보·어좌 단(윗면·앞면·계단)·어도 카펫·난간·디딤돌. 단 계단·카펫·디딤돌은 걸음(F), 기둥 몸은 막힘, 머리는 걸음★.

`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). `door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.

### jb-pal_wall_gung_m · 궁 벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gung_m","w":1,"h":2,"class":"wall","upperTiles":[[16368],[16369]],"walk":["X","X"]}
```

### jb-pal_wall_gung_r · 궁 벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gung_r","w":1,"h":2,"class":"wall","upperTiles":[[16372],[16373]],"walk":["X","X"]}
```

### jb-pal_wall_gungho_l · 궁 벽 궁 회벽 왼끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gungho_l","w":1,"h":2,"class":"wall","upperTiles":[[16378],[16379]],"walk":["X","X"]}
```

### jb-pal_wall_gungho_lr · 궁 벽 궁 회벽 양끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gungho_lr","w":1,"h":2,"class":"wall","upperTiles":[[16382],[16383]],"walk":["X","X"]}
```

### jb-pal_wall_gungho_m · 궁 벽 궁 회벽 가운데 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gungho_m","w":1,"h":2,"class":"wall","upperTiles":[[16376],[16377]],"walk":["X","X"]}
```

### jb-pal_wall_gungho_r · 궁 벽 궁 회벽 오른끝 1×2 · 1×2 · 분류 wall
막힘 2 · 걸음★ 0 · 걸음 0칸. 집·마당 둘레에 이어 놓는다. 전부 막힌다.
```json
{"kit":"kit:joseon_baram/jb-pal_wall_gungho_r","w":1,"h":2,"class":"wall","upperTiles":[[16380],[16381]],"walk":["X","X"]}
```
