# 구역 키트 · 버들항 포룸

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 22784칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 포룸 — `bd-forum`

버들항 포룸 — 신전·주랑·분수·석상·노점·카페·아치 문 22×14. 원본 (54,34).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-forum', mapId, x:54, y:34})` (원본 좌표. 다른 맵이면 같은 크기의 풀밭에)
- 잇는 법: 가운데 마을 큰 광장. 사방 길이 광장에 닿는다.
- 그림: `kit-forum`

역할 배열(22×14, 위 → 아래):
```text
SSFFFFFFFFFSSFFFFFFCFS
SSSSSSFSSSSSSSFSSSSSSS
XSSSSSFSSSSSSSFSSSSSSS
SSSSSSFSSSSSSSFSSSSSSS
SSSSSSFSSSSSSSFSSSSSSS
SCSSCCFSSSSSSSFSSSSSSS
SFSSSSFSSSSSSSSFCCCCSS
SFSSSSSSSCCCSSSSSFFFSS
SFSSSSSSFFFFFSSSSFSSSS
SFFFFFSSFSSSFSSSSFSSSS
FFFFFFSSSSSSFSSSSFSSSS
SSCCCSSSCSSSFSSSSFFFCC
SSCCCSSSCFFFFFFFFFFFCC
FSCFCSFCFFFXSSSXFFFSSS
```
