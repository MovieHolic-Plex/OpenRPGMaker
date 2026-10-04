# 강 · 폭포 · 다리 · 호수 항구 키트

tilesetId `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, 23936칸, 16px 칸, 한 줄 128칸 — 번호 n 의 칸은 행 n÷128, 열 n%128). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.

원본의 윗 강(성 옆 74칸 — v6 에서 키트로 덮이지 않던 곳)과 강 조각·폭포 둘·아치 다리·호수 항구·항구 광장. 강 몸은 오토타일 물로 칠하고,
이 키트는 **모양이 정해진 자리**(폭포 낙차·다리 갑판·호수 둑과 잔교)에만 쓴다. 강 폭은 모두 4칸이다.

순서: 호수 항구(남쪽 가장자리) → 폭포(강 위 끝) → `버들항 물` 로 폭포 아래 ~ 호수 하구(호수 x+38)까지 4칸 폭 → 다리 → 다리 양쪽 거리.

## 버들항 윗 강줄기 — `bd-river-upper` (4×24)

버들항 윗 강줄기 — 성벽 북문 틈에서 시작해 성 해자 옆을 지나 폭포 위까지 4칸 폭 물(둑·그림자 포함) 4×24. 원본 (33,0).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-river-upper', mapId, x, y})`
- 잇는 법: 물 4칸 폭. 위는 맵 가장자리, 아래는 bd-waterfall-drop 로 이어진다. 양쪽은 성 둑길과 저택 담이다.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-river-upper`

역할 배열:
```text
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
XXXX
```

## 버들항 곧은 강 조각(남북) 4×4 — `bd-river-straight-ns` (4×4)

버들항 곧은 강 조각(남북) 4×4 — 세로로 이어 찍는 재료 4×4. 원본 (33,6).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-river-straight-ns', mapId, x, y})`
- 잇는 법: 물 4칸 폭. 세로로 몇 번이든 이어 찍는다(양옆에 강둑 땅·담이 필요하다). 끝은 폭포·굽이·다리로 마무리.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-river-straight-ns`

역할 배열:
```text
XXXX
XXXX
XXXX
XXXX
```

## 버들항 곧은 운하 조각(동서) 8×4 — `bd-canal-straight-ew` (8×4)

버들항 곧은 운하 조각(동서) 8×4 — 가로로 이어 찍는 재료 8×4. 원본 (38,38).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-canal-straight-ew', mapId, x, y})`
- 잇는 법: 물 4칸 폭. 가로로 이어 찍는다. 위쪽 둑은 돌 벽면(6px)이 붙는다.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-canal-straight-ew`

역할 배열:
```text
XXXXXXXX
XXXXXXXX
XXXXXXXX
XXXSXXXX
```

## 버들항 강 굽이 — `bd-river-bend-ns-ew` (4×4)

버들항 강 굽이 — 남북 강이 동쪽 운하로 꺾이는 4×4 4×4. 원본 (33,38).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-river-bend-ns-ew', mapId, x, y})`
- 잇는 법: 북쪽에서 내려온 강이 동쪽으로 꺾인다.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-river-bend-ns-ew`

역할 배열:
```text
XXXX
XXXX
XXXX
XXXX
```

## 버들항 강 굽이 — `bd-canal-bend-ew-ns` (4×4)

버들항 강 굽이 — 동서 운하가 남쪽 강으로 꺾이는 4×4 4×4. 원본 (47,38).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-canal-bend-ew-ns', mapId, x, y})`
- 잇는 법: 서쪽에서 온 운하가 남쪽으로 꺾인다.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-canal-bend-ew-ns`

역할 배열:
```text
XXXX
XXXX
XXXX
XXXX
```

## 버들항 강 위 아치 다리 — `bd-bridge-arch` (4×5)

버들항 강 위 아치 다리 — 폭 4칸 갑판(2줄)에 양쪽 난간, 남쪽 면에 아치 둘과 물깎이 4×5 4×5. 원본 (33,32).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-bridge-arch', mapId, x, y})`
- 잇는 법: 남북으로 흐르는 4칸 폭 강을 동서 큰길이 건널 때. 갑판 2줄(위에서 둘째·셋째 줄)이 길 두 줄과 맞아야 한다. 강 위·아래는 강 조각(bd-river-straight-ns)으로 이어 준다.
- 출구 칸: 서 (0,1), (0,2); 동 (3,1), (3,2)
- 그림: `kit-bridge-arch`

역할 배열:
```text
XXXX
FFFF
FFFF
XXXX
XXXX
```

## 버들항 폭포(위 단 → 가운데 단) — `bd-waterfall-drop` (12×7)

버들항 폭포(위 단 → 가운데 단) — 강이 3칸 절벽 아래로 떨어지고 물웅덩이로 이어짐 12×7 12×7. 원본 (29,26).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-waterfall-drop', mapId, x, y})`
- 잇는 법: 위 강(4칸 폭)을 이 폭포 위에서 받고, 아래는 웅덩이 강으로 이어진다. 양옆은 바위 절벽면·풀 가장자리 칸이 구워져 있다. 폭포 위 강의 물 칸은 키트 맨 위에서 원점 기준 4~7칸째다.
- 출구 칸: 없음(둘레가 풀·담)
- 그림: `kit-waterfall-drop`

역할 배열:
```text
XXXXXXXXXXXX
XXXXSSSSXXXX
XXXXSSSSXXXX
FFFFSSSSFFFF
FSFCSSSSCCXX
XSFCSXXXCCXX
XSFXXXXXXSXX
```

## 버들항 폭포(가운데 단 → 항구 단) — `bd-waterfall-wall` (12×9)

버들항 폭포(가운데 단 → 항구 단) — 석축 옹벽을 넘는 폭포 12×9 12×9. 원본 (43,59).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-waterfall-wall', mapId, x, y})`
- 잇는 법: 가운데 마을과 항구 사이 석축 옹벽 위에 폭포. 아래 물은 항구 대로 옆 강으로 이어진다.
- 출구 칸: 남 (2,8), (3,8), (4,8), (5,8), (6,8), (7,8), (8,8), (9,8), (10,8), (11,8)
- 그림: `kit-waterfall-wall`

역할 배열:
```text
XXXFXXXXFFXF
FFFFXXXXFFFF
XXXXXSXXXXXX
XXXXSSSSXXXX
XXXXSSSSXXXX
FFFCSSSSSSFF
SSFCSSSSSSFS
SSFXXXXXFFFF
FFFFFFFFFFFF
```

## 버들항 호수 항구 — `bd-harbour-lake` (83×15)

버들항 호수 항구 — 남쪽 호수(자연 둑·갈대), 물가 산책길(포석 두 줄), 잔교 넷, 계선주, 배(움직임), 강 하구의 아치 다리 83×15 83×15. 원본 (9,85).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-harbour-lake', mapId, x, y})`
- 잇는 법: 맵 남쪽 가장자리. 위 줄(산책길)에 큰길이 닿고, 강은 키트 위 줄의 물 칸(원점에서 38~41칸째)으로 들어온다. 집·도로는 이 위에 새로 깐다.
- 출구 칸: 북 (3,0), (4,0), (24,0), (25,0), (26,0), (27,0), (28,0), (29,0), (30,0), (31,0), (32,0), (33,0), (34,0), (35,0), (36,0), (37,0), (38,0), (39,0), (40,0), (41,0), (42,0), (43,0), (44,0), (45,0), (52,0), (61,0), (62,0), (75,0), (76,0); 서 (0,7), (0,8), (0,9), (0,10); 남 (0,14)
- 그림: `kit-harbour-lake`

역할 배열:
```text
XXXFFXXXXFFXXXXXXXXXXXXXFFFFFFFFFFFFFFFFFFFFFFCCCCCCFXXXXXFFFFFXXXXFSSSFXSXFFXXXXXX
SSFFFXXXXCCFXXXFSFXFFFFFFSFFSFFSFFFFFFFFFFFFSFSSSXSSFFFSFFFFFFFFXXXFSSSFSSSFFXXXXXX
SSFFFXXXXSSFFFFFFFFFSSFFXXXXXFFXXXXXXXXXXXXXXXXXXXXXXFFFFFFFSFFFFFFFSSSFSSSFFFFFFSF
FCCFFXXXXFFFFFFXXXXXXXXXXXXXXFFXXXXXXXXXXXXXSSSSSSXXXFFXXXXXXXXXSSFFFFSSSSSCFFSSSFF
FCCFFXXXXCSCCSFXXXXXXXXXXXXXXFFXSSXXXXXXXXXXSSSSSSSXXFFXXXXXXXXXSSSFFSSSSSSCFFSSSFF
FSFFFXXXXSSCCSXXXXXXXXXXXXXXXFFSSSXXXXXXXXXSSSSSSSSSXFFXXXXXXXXXXXXFFXSSSSSFFSSSSFX
FFFFFFFFFSXFFXXXXXXXXXXXXXXXXFFSSSXXXXXXXXSSSSSSSSSSXFFXXXXXXXXXXXXFFSSSSFFCCSFFSSX
FFCFFSCFFXXFFSSXXXXXXXXXXXXXXXXXXXXXXXXXXXSSSSSSSSSSXXXXXXXXXXXXXXXFCSSSCCCSSSCFSSX
FXSXXXSXXXXFFXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSSSSSSSSSSXXXXXXXXXXXXXXXFCSSXXSSXXSSXSSX
FXXXXXXXXXXFFXXXXXXXXXXXXXSSXXXXXXXXXXXXXXSSSSSSSSSSXXXXXXXXXXXXXXXFFXXXXXXXXXXSSSX
FXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSSXXXXXXXXXXXXXXXXXXXSSSSX
CSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSSSSX
CSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSSFX
CSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSFX
FXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXSFX
```

## 버들항 항구 광장 — `bd-harbour-square` (12×11)

버들항 항구 광장 — 생선 노점·닻 전시대·그물 건조대·분수(물고기 연못)가 있는 포석 광장 12×11 12×11. 원본 (59,66).

- 찍기: `stamp_object({objectId:'kit:beodeul_city/bd-harbour-square', mapId, x, y})`
- 잇는 법: 부두에서 가까운 큰길 옆. 광장 가장자리에 길이 닿는다.
- 출구 칸: 북 (11,0); 동 (11,1), (11,2), (11,3), (11,4), (11,5), (11,6), (11,7), (11,8), (11,9); 서 (0,8); 남 (11,10)
- 그림: `kit-harbour-square`

역할 배열:
```text
FFFFFFFFFXXF
FFSSSSSSFSSF
FFSSFSSSFSSF
FFSSFSSSFFFF
FFXXFSSSSSSF
CCFFFCSSSSSF
CSSFFSSSSSFF
SSSFFSSFSSFF
FFFFFFFFFFFF
SSSSSSFFFFFF
FFSSFXXXXXXF
```
