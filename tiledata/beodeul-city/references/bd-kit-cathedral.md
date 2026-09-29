# 구역 키트 · 버들항 성당 언덕

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 성당 언덕 — `bd-cathedral`

버들항 성당 언덕 — 첨탑 성당과 성당 앞 광장 17×22. 원본 (82,3).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-cathedral', mapId, x, y})` — x,y 는 새 도시의 설계대로(원본은 (82,3)). 같은 크기의 평지 풀밭에.
- 출구 칸: 서 (0,14), (0,15), (0,17), (0,18), (0,19)
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
FFFFFFFFFFFFFFFFS
SFFFFFFSSFFFFSSSS
FSSFFFFSSFFSFFFSS
FFFFFFFFFFFFFFFSS
FFFFFFFFFFFFFFFFS
XXXXFFFFFFXXXXXXS
XXXXFCCCCFXXXXXXF
```
