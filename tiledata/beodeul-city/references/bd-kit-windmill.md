# 구역 키트 · 버들항 풍차 들

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 22784칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 풍차 들 — `bd-windmill`

버들항 풍차 들 — 큰 탑풍차(날개 움직임 8장)·밀밭·양배추밭 12×22. 원본 (1,34).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-windmill', mapId, x:1, y:34})` (원본 좌표. 다른 맵이면 같은 크기의 풀밭에)
- 잇는 법: 마을 서쪽 가장자리 풀밭.
- 그림: `kit-windmill`

역할 배열(12×22, 위 → 아래):
```text
SCCSSSSSSCCF
FSSSSSSSSSSF
FCCSSSSSSSFF
SSSSSSSSSSFF
SSSSSSSSSSFF
SSSSSSSSSSXF
SSSSSSSSSSSF
FSFSSSSSSSSF
SSFSSSSSSSSF
SSFSSSSSSSSF
SSSSFFFSSSSF
SSSSSFFFFCFF
SSSSSSSSSSSF
SFFFSSSSSSSF
FFSFSSSSSSSF
SSSFSSSSSSSF
SSSFSSSSSSSF
SSSSSSSFFFFF
SSSSSSSSSSSF
SSSSSSSSSSSF
FFFSSSFFSSFF
SSSSSSFFSSFF
```
