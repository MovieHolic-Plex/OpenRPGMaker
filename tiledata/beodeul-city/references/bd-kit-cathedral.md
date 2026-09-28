# 구역 키트 · 버들항 성당 언덕

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 22784칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 성당 언덕 — `bd-cathedral`

버들항 성당 언덕 — 첨탑 성당과 성당 앞 광장 17×22. 원본 (82,3).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-cathedral', mapId, x:82, y:3})` (원본 좌표. 다른 맵이면 같은 크기의 풀밭에)
- 잇는 법: 언덕 위. 계단(88,25)으로 아래 길과 잇는다.
- 그림: `kit-cathedral`

역할 배열(17×22, 위 → 아래):
```text
FFFFFFFFFFFFFFFFF
SFCFFFFFFFFFFFSSF
SXSXXXXXXXXXXFSSF
SSSSXXXXXXXXXSSSF
FSSSXXXXXXXXXSSSF
XSSSSSSSSSSSSSSSF
SSSSSSSSSSSSSSSFF
SSSSSSSSSSSSSSSFF
SSSSSSSSSSSSSXSXF
SSSSSSSSSSSSSSSSS
SSSSSSSSSSSSSSSSS
FSSSSSSSSSSSSSSSS
FSSSSSSSSSSSSSSSC
FSSSSSSSSSSSSSSSF
FFFFFFFFFFFFFFFSF
FFFFFFFFFFFFFFFFF
SFFFFFFSSFFFFSSFF
FSSFFFFSSFFSFFSSF
FFFFFFFFFFFFFFSSF
FFFFFFFFFFFFFFFFF
XXXXFFFFFFXXXXXXS
XXXXFCCCCFXXXXXXS
```
