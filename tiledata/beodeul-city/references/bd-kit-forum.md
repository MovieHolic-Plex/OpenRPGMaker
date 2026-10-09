# 구역 키트 · 버들항 포룸

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

## 버들항 포룸 — `bd-forum`

버들항 포룸 — 신전·주랑·분수·석상·노점·카페·아치 문 22×14. 원본 (54,34).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-forum', mapId, x, y})` — x,y 는 새 도시의 설계대로(원본은 (54,34)). 같은 크기의 평지 풀밭에.
- 출구 칸: 북 (2,0), (3,0), (4,0), (5,0), (6,0), (7,0), (8,0), (9,0), (14,0), (15,0), (16,0), (17,0), (18,0), (20,0); 서 (0,10); 동 (21,11); 남 (2,13), (3,13), (4,13), (16,13), (17,13)
- 잇는 법: 가운데 마을 큰 광장. 사방 길이 광장에 닿는다.
- 그림: `kit-forum`

역할 배열(22×14, 위 → 아래):
```text
XXFFFFFFFFFSSFFFFFFCFX
XSSSSSFSSSSSSSFSSSSSSX
XSSSSSFSSSSSSSFSSSSSSF
XSSSSSFSSSSSSSFSSSSSSF
XSSSSSFSSSSSSSFSSSSSSF
XCSSCCFSSSSSSSFSSSSSSF
XFSSSSFSSSSSSSSFCCCCSX
XFSSSSSSSCCCSSSSSFFFSX
XFSSSSSSFFFFFSSSSFSSSX
XFFFFFSSFSSSFSSSSFSSSX
FFFFFFSSSSSSFSSSSFSSSX
FXFFFXSSCSSSFSSSSFFFCF
FXFFFXSSCFFFFFFFFFFFCF
FXFFFXFFFFFXXXXXFFFXXX
```
