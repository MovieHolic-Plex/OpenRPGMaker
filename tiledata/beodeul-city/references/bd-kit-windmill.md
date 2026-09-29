# 구역 키트 · 버들항 풍차 들

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 풍차 들 — `bd-windmill`

버들항 풍차 들 — 큰 탑풍차(날개 움직임 8장)·밀밭·양배추밭 12×22. 원본 (1,34).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-windmill', mapId, x, y})` — x,y 는 새 도시의 설계대로(원본은 (1,34)). 같은 크기의 평지 풀밭에.
- 출구 칸: 북 (11,0); 동 (11,1), (11,2), (11,3), (11,4), (11,5), (11,6), (11,7), (11,8), (11,9), (11,10), (11,11), (11,12), (11,13), (11,14), (11,15), (11,16), (11,17), (11,18), (11,19), (11,20); 남 (11,21)
- 잇는 법: 마을 서쪽 가장자리 풀밭.
- 그림: `kit-windmill`

역할 배열(12×22, 위 → 아래):
```text
FCCSSSSSSCCF
FSSSSSSSSSSF
SSSSSSSSSSFF
SSSSSSSSSSFF
SSSSSSSSSSFF
SSSSSSSSSSXF
SSSSSSSSSSSF
SSSSSSSSSSSF
SSSSSSSSSSSF
SSSSSSSSSSSF
SSSSSFFSSSSF
SSSSSFFFFCFF
FSSSFSSSSSSF
FSSSSSSSSSSF
FSSSSSSSSSSF
FSSFSSSSSSSF
FSSFFSSSSSSF
SSSSSFSFFFFF
SSSSSFSSSSSF
SSSSSFSSSSSF
SSFFSSSSSSFF
SSFFSSSSSSFF
```
