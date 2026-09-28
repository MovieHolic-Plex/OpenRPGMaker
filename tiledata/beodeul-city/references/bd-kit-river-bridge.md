# 구역 키트 · 버들항 강·폭포·아치 다리

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 22784칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 강·폭포·아치 다리 — `bd-river-bridge`

버들항 강·폭포·아치 다리 — 가운데 마을과 성 사이 강(33~36열), 폭포(33,27), 다리(33,33) 16×20. 원본 (26,24).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-river-bridge', mapId, x:26, y:24})` (원본 좌표. 다른 맵이면 같은 크기의 풀밭에)
- 잇는 법: 강을 길이 건너는 곳에 다리 폭 4칸.
- 그림: `kit-river-bridge`

역할 배열(16×20, 위 → 아래):
```text
XXXXXXXXXXXFSSFS
XXXXXXXXXXXFFFFF
FXXXXXXXXXXXXXXX
XXXXXXXSSSSXXXXX
XXXXXXXSSSSXXXXX
XFCCFFFSSSSFFFFF
CCCCSSCSSSSCCFSS
CCSSSSCSXXXCCFSS
SSSSFFSXXXXSSFFF
FFFFFFFFFFFFFFFF
FFFFFFCCCCCCFFFF
FFFFFFCSSSSSSSFS
XSSXXSXSSSSSSSFS
SSSSSSSXXXXSSSFS
SSSSSSSXXXXXXXXX
SSSSSSSXXXXXXXXX
SSSSSSSXXXXXXXXX
SSSSSSSXXXXXXXXS
SSSSFFSSSFSSSSSS
SSSSFFSSSFSSSSSS
```
