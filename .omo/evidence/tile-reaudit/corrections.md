# 교정된 타일 근거표

총 교정 2054칸 — 판독 다수결 1768칸, 사람이 고배율로 확정 286칸.

각 줄은 한 칸이다. `이전` 은 재감사 전 출하 라벨, `채택` 은 이번에 넣은 라벨,
`판독` 은 그림을 본 판독자들이 각각 무엇이라 말했는가다(`*` 는 저신뢰 표기).

판정을 눈으로 확인하려면 해당 시트의 블록 아틀라스를 다시 만든다:

```
vite-node scripts/gen-chipset-blocks.mts --sheet <시트> --rows <a>-<b> --scale 6
# 특정 칸만 크게 보려면
vite-node scripts/gen-chipset-blocks.mts --sheet <시트> --rows <a>-<b> --cols <c>-<d> --scale 14
```

아틀라스 PNG 는 커밋하지 않는다 — 커밋된 시트 PNG 에서 결정론적으로 재생성되므로
저장소에 8MB 를 넣을 이유가 없다. 사람이 직접 확정한 칸의 크롭만 커밋한다.

## retro_dungeon — 교정 385칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 0 | 이끼 낀 동굴 암벽 상단 `rock` | 연못 상단 프레임1 `water` | 연못 상단 프레임1`water` · 풀밭 물웅덩이 상단`water` | block-00-03 c0 r0 |
| 1 | 이끼 낀 동굴 암벽 북동 `rock` | 연못 상단 프레임2 `water` | 연못 상단 프레임2`water` · 풀밭 물웅덩이 상단`water` | block-00-03 c1 r0 |
| 2 | 이끼 낀 동굴 암벽 북서 `rock` | 연못 상단 프레임3 `water` | 연못 상단 프레임3`water` · 풀밭 물웅덩이 상단`water` | block-00-03 c2 r0 |
| 3 | 푸른 석재 벽돌 벽 `wall` | 석벽 수로 상단 프레임1 `water` | 석벽 수로 상단 프레임1`water` · 석조 수로 상단`water` | block-00-03 c3 r0 |
| 4 | 푸른 석재 벽돌 벽면 `wall` | 석벽 수로 상단 프레임2 `water` | 석벽 수로 상단 프레임2`water` · 석조 수로 상단`water` | block-00-03 c4 r0 |
| 5 | 푸른 벽돌 담벼락 `wall` | 석벽 수로 상단 프레임3 `water` | 석벽 수로 상단 프레임3`water` · 석조 수로 상단`water` | block-00-03 c5 r0 |
| 10 | 희고 깨끗한 얼음 `ice` | 눈 바닥 `ice` | 눈 바닥`floor` · 눈 바닥`terrain` · 눈 바닥`terrain` | block-00-03 c10 r0 |
| 11 | 얼음 낀 물 웅덩이 `water` | 눈밭 위 얼음 타일 `terrain` | 빙판 조각`floor` · 얼음 타일 모서리`terrain` · 눈밭 위 얼음 타일`terrain` | block-00-03 c11 r0 |
| 12 | 적갈색 흙바닥 상단 `floor` | 용암 지대 좌상단 `terrain` | 용암 지대 좌상단`terrain` · 용암 웅덩이 좌상단`water` · 용암 지대 좌상단`terrain` | block-00-03 c12 r0 |
| 13 | 적갈색 흙바닥 중앙 `floor` | 용암 지대 상단 `terrain` | 용암 지대 상단`terrain` · 용암 웅덩이 상단`water` · 용암 지대 상단`terrain` | block-00-03 c13 r0 |
| 14 | 적갈색 흙바닥 하단 `floor` | 용암 지대 우상단 `terrain` | 용암 지대 우상단`terrain` · 용암 웅덩이 우상단`water` · 용암 지대 우상단`terrain` | block-00-03 c14 r0 |
| 15 | 갈색 흙바닥 `floor` | 흙 지형 `terrain` | 흙 지형`terrain` · 흙 바닥`terrain` | block-00-03 c15 r0 |
| 16 | 갈색 흙바닥 상단 `floor` | 용암 대각선 경계 좌상단 `terrain` | 용암 대각선 경계 좌상단`terrain` · 흙과 용암 경계`terrain` | block-00-03 c16 r0 |
| 17 | 갈색 흙바닥 경계 `floor` | 용암 대각선 경계 우상단 `terrain` | 용암 대각선 경계 우상단`terrain` · 흙과 용암 경계`terrain` | block-00-03 c17 r0 |
| 18 | 짙은 회색 돌바닥 상단 `floor` | 어두운 석벽 상단 좌측 `wall` | 돌 지붕 좌측 모서리`roof` · 돌 바닥과 벽 경계`terrain` · 어두운 석벽 상단 좌측`wall` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 19 | 짙은 회색 돌바닥 중앙 `floor` | 어두운 석벽 상단 우측 `wall` | 돌 지붕 우측 모서리`roof` · 돌 바닥과 벽 경계`terrain` · 어두운 석벽 상단 우측`wall` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 20 | 짙은 회색 돌바닥 하단 `floor` | 문양이 새겨진 어두운 석벽 상단 `wall` | 석벽의 문양 조각 장식`decoration` · 문양이 새겨진 석벽`wall` · 문양이 새겨진 어두운 석벽 상단`wall` | block-00-03 c20 r0 |
| 24 | 물가 절벽 경계 `water` | 석판 묘비 좌측 `prop` | 석비 좌측`prop` · 석판 묘비 좌측`prop` | block-00-03 c24 r0 |
| 25 | 깊은 물 풀 `water` | 석판 묘비 중앙 `prop` | 석비 중앙`prop` · 석판 묘비 중앙`prop` | block-00-03 c25 r0 |
| 26 | 물가 암석 가장자리 `water` | 석판 묘비 우측 `prop` | 석비 우측`prop` · 석판 묘비 우측`prop` | block-00-03 c26 r0 |
| 27 | 금빛 장식 소품 `prop` | 원형 샹들리에 좌측 `prop` | 샹들리에 좌측`prop` · 원형 샹들리에 좌측`prop` | block-00-03 c27 r0 |
| 28 | 금빛 조형 소품 `prop` | 원형 샹들리에 중앙 `prop` | 샹들리에 중앙`prop` · 원형 샹들리에 중앙`prop` | block-00-03 c28 r0 |
| 29 | 금빛 휘날리는 장식 `prop` | 원형 샹들리에 우측 `prop` | 샹들리에 우측`prop` · 원형 샹들리에 우측`prop` | block-00-03 c29 r0 |
| 30 | 동굴 암벽 상단 경계 `rock` | 연못 좌측 프레임1 `water` | 연못 좌측 프레임1`water` · 풀밭 물웅덩이 좌측`water` | block-00-03 c0 r1 |
| 31 | 동굴 암벽 북동 경계 `rock` | 연못 중앙 프레임2 `water` | 연못 중앙 프레임2`water` · 풀밭 물웅덩이 좌측`water` | block-00-03 c1 r1 |
| 32 | 동굴 암벽 북서 경계 `rock` | 연못 우측 프레임3 `water` | 연못 우측 프레임3`water` · 풀밭 물웅덩이 좌측`water` | block-00-03 c2 r1 |
| 33 | 청회색 벽돌 벽 `wall` | 석벽 수로 세로길 프레임1 `water` | 석벽 수로 세로길 프레임1`water` · 석조 수로 좌측`water` | block-00-03 c3 r1 |
| 34 | 청회색 벽돌 벽면 `wall` | 석벽 수로 세로길 프레임2 `water` | 석벽 수로 세로길 프레임2`water` · 석조 수로 좌측`water` | block-00-03 c4 r1 |
| 35 | 청회색 벽돌 담 `wall` | 석벽 수로 세로길 프레임3 `water` | 석벽 수로 세로길 프레임3`water` · 석조 수로 좌측`water` | block-00-03 c5 r1 |
| 39 | 얼음 가장자리 물 `water` | 얼음판 좌상단 `terrain` | 빙판 좌상단`floor` · 빙판 좌상단`terrain` · 얼음판 좌상단`terrain` | block-00-03 c9 r1 |
| 40 | 얼음 사이 물가 `water` | 얼음판 상단 `terrain` | 빙판 상단`floor` · 빙판 상단`terrain` · 얼음판 상단`terrain` | block-00-03 c10 r1 |
| 41 | 얼음 낀 물가 `water` | 얼음판 우상단 `terrain` | 빙판 우상단`floor` · 빙판 우상단`terrain` · 얼음판 우상단`terrain` | block-00-03 c11 r1 |
| 42 | 적갈색 벽돌 바닥 상단 `floor` | 용암 지대 좌측 가장자리 `terrain` | 용암 지대 좌측 가장자리`terrain` · 용암 웅덩이 좌측`water` · 용암 지대 좌측`terrain` | block-00-03 c12 r1 |
| 43 | 적갈색 벽돌 바닥 중앙 `floor` | 빛나는 용암 중앙 `terrain` | 빛나는 용암 중앙`terrain` · 용암 웅덩이 중앙`water` · 용암 지대 중앙`terrain` | block-00-03 c13 r1 |
| 44 | 적갈색 벽돌 바닥 하단 `floor` | 용암 지대 우측 가장자리 `terrain` | 용암 지대 우측 가장자리`terrain` · 용암 웅덩이 우측`water` · 용암 지대 우측`terrain` | block-00-03 c14 r1 |
| 45 | 갈색 토양 바닥 `floor` | 어두운 흙 바닥 `terrain` | 어두운 흙 바닥`floor` · 어두운 흙 바닥`terrain` · 어두운 흙 바닥`terrain` | block-00-03 c15 r1 |
| 46 | 갈색 흙밭 `floor` | 흙 바닥 `terrain` | 갈색 흙 바닥 1`floor` · 흙 바닥`terrain` · 흙 바닥`terrain` | block-00-03 c16 r1 |
| 47 | 갈색 모래흙 바닥 `floor` | 흙 바닥 `terrain` | 갈색 흙 바닥 2`floor` · 흙 바닥`terrain` · 흙 바닥`terrain` | block-00-03 c17 r1 |
| 48 | 깊은 물 `water` | 어두운 석벽 좌측 `wall` | 어두운 석벽 좌측`wall` · 검푸른 석벽`wall` | block-00-03 c18 r1 |
| 49 | 깊은 물 `water` | 어두운 석벽 중앙 `wall` | 어두운 석벽 중앙`wall` · 검푸른 석벽`wall` | block-00-03 c19 r1 |
| 50 | 깊은 물 `water` | 어두운 석벽 우측 `wall` | 어두운 석벽 우측`wall` · 검푸른 석벽`wall` | block-00-03 c20 r1 |
| 54 | 나무 난간 상단 `fence` | 원형 레일 좌상단 `prop` | 원형 레일 좌상단`prop` · 원형 철로 좌상단`prop` | block-00-03 c24 r1 |
| 55 | 나무 난간 하단 `fence` | 원형 레일 우상단 `prop` | 원형 레일 우상단`prop` · 원형 철로 우상단`prop` | block-00-03 c25 r1 |
| 56 | 나무 울타리 가로대 `fence` | 광산 레일 가로 분기 `prop` | 광산 레일 가로 분기`prop` · 분기 철로`prop` | block-00-03 c26 r1 |
| 57 | 나무 울타리 격자 `fence` | 광산 레일 세로 교차로 `prop` | 광산 레일 세로 교차로`prop` · 교차 철로`prop` | block-00-03 c27 r1 |
| 58 | 나무 난간 격자 `fence` | 광산 레일 가로 교차로 `prop` | 광산 레일 가로 교차로`prop` · 분기 철로`prop` | block-00-03 c28 r1 |
| 59 | 나무 울타리 가로대 경계 `fence` | 광산 레일 가로 분기선 `prop` | 광산 레일 가로 분기선`prop` · 분기 철로`prop` | block-00-03 c29 r1 |
| 60 | 동굴 암벽 상단 모서리 `rock` | 연못 하단 프레임1 `water` | 연못 하단 프레임1`water` · 풀밭 물웅덩이 하단`water` | block-00-03 c0 r2 |
| 61 | 동굴 암벽 북동 모서리 `rock` | 연못 하단 프레임2 `water` | 연못 하단 프레임2`water` · 풀밭 물웅덩이 하단`water` | block-00-03 c1 r2 |
| 62 | 동굴 암벽 북서 모서리 `rock` | 연못 하단 프레임3 `water` | 연못 하단 프레임3`water` · 풀밭 물웅덩이 하단`water` | block-00-03 c2 r2 |
| 63 | 석재 벽돌 벽 좌측 `wall` | 석벽 수로 가로길 프레임1 `water` | 석벽 수로 가로길 프레임1`water` · 석조 수로 하단`water` | block-00-03 c3 r2 |
| 64 | 석재 벽돌 벽 중앙 `wall` | 석벽 수로 가로길 프레임2 `water` | 석벽 수로 가로길 프레임2`water` · 석조 수로 하단`water` | block-00-03 c4 r2 |
| 65 | 석재 벽돌 벽 우측 `wall` | 석벽 수로 가로길 프레임3 `water` | 석벽 수로 가로길 프레임3`water` · 석조 수로 하단`water` | block-00-03 c5 r2 |
| 69 | 얼음 위 물 경계 `water` | 얼음판 좌측 `terrain` | 빙판 좌측`floor` · 빙판 좌측`terrain` · 얼음판 좌측`terrain` | block-00-03 c9 r2 |
| 70 | 깊은 얼음 물 `water` | 얼음판 중앙 `terrain` | 빙판 중앙`floor` · 빙판 중앙`terrain` · 얼음판 중앙`terrain` | block-00-03 c10 r2 |
| 71 | 얼음 변두리 물 `water` | 얼음판 우측 `terrain` | 빙판 우측`floor` · 빙판 우측`terrain` · 얼음판 우측`terrain` | block-00-03 c11 r2 |
| 72 | 적갈색 흙 바닥 우측 `floor` | 용암 지대 좌하단 `terrain` | 용암 지대 좌하단`terrain` · 용암 웅덩이 좌하단`water` · 용암 지대 좌하단`terrain` | block-00-03 c12 r2 |
| 73 | 적갈색 흙 바닥 좌측 `floor` | 용암 지대 하단 `terrain` | 용암 지대 하단`terrain` · 용암 웅덩이 하단`water` · 용암 지대 하단`terrain` | block-00-03 c13 r2 |
| 74 | 적갈색 흙 바닥 경계 `floor` | 용암 지대 우하단 `terrain` | 용암 지대 우하단`terrain` · 용암 웅덩이 우하단`water` · 용암 지대 우하단`terrain` | block-00-03 c14 r2 |
| 75 | 진갈색 흙바닥 `floor` | 악마 얼굴 석조 부조 `decoration` | 석벽의 얼굴 조각`decoration` · 석조 얼굴 조각`wall` · 악마 얼굴 석조 부조`decoration` | block-00-03 c15 r2 |
| 76 | 갈색 흙바닥 좌측 `floor` | 용암 대각선 경계 좌하단 `terrain` | 용암 대각선 경계 좌하단`terrain` · 흙과 용암 경계`terrain` | block-00-03 c16 r2 |
| 77 | 갈색 흙바닥 우측 `floor` | 용암 대각선 경계 우하단 `terrain` | 용암 대각선 경계 우하단`terrain` · 흙과 용암 경계`terrain` | block-00-03 c17 r2 |
| 78 | 깊고 어두운 물 `water` | 짙은 회색 자갈 바닥 `floor` | 짙은 회색 자갈 바닥`floor` · 어두운 조약돌 바닥`floor` | block-00-03 c18 r2 |
| 81 | 어두운 물 웅덩이 `water` | 푸른빛 자갈 바닥 `floor` | 푸른빛 자갈 바닥`floor` · 청회색 돌 바닥`floor` | block-00-03 c21 r2 |
| 82 | 살구빛 흙바닥 `floor` | 황토색 흙 바닥 `terrain` | 황토색 흙 바닥`floor` · 황토색 흙 바닥`terrain` · 황갈색 흙 바닥`terrain` | block-00-03 c22 r2 |
| 83 | 갈색 점토 바닥 `floor` | 어두운 흙 바닥 `terrain` | 어두운 갈색 흙 바닥`floor` · 어두운 흙 바닥`terrain` · 어두운 흙 바닥`terrain` | block-00-03 c23 r2 |
| 84 | 나무 펜스 상단 `fence` | 원형 레일 좌하단 `prop` | 원형 레일 좌하단`prop` · 원형 철로 좌하단`prop` | block-00-03 c24 r2 |
| 85 | 나무 펜스 하단 `fence` | 원형 레일 우하단 `prop` | 원형 레일 우하단`prop` · 원형 철로 우하단`prop` | block-00-03 c25 r2 |
| 86 | 나무 울타리 좌측 `fence` | 광산 레일 가로 대각선 분기 `prop` | 광산 레일 가로 대각선 분기`prop` · 분기 철로`prop` | block-00-03 c26 r2 |
| 87 | 나무 울타리 우측 `fence` | 광산 레일 가로 대각선 분기 `prop` | 광산 레일 가로 대각선 분기`prop` · 분기 철로`prop` | block-00-03 c27 r2 |
| 88 | 나무 난간 중앙 `fence` | 광산 레일 가로 대각선 분기 `prop` | 광산 레일 가로 대각선 분기`prop` · 분기 철로`prop` | block-00-03 c28 r2 |
| 89 | 나무 울타리 격자 하단 `fence` | 광산 레일 가로 대각선 분기 `prop` | 광산 레일 가로 대각선 분기`prop` · 분기 철로`prop` | block-00-03 c29 r2 |
| 90 | 동굴 암벽 측면 `rock` | 연못 안쪽 모서리 프레임1 `water` | 연못 안쪽 모서리 프레임1`water` · 풀밭 물웅덩이 안쪽`water` | block-00-03 c0 r3 |
| 91 | 동굴 암벽 우측 경계 `rock` | 연못 안쪽 모서리 프레임2 `water` | 연못 안쪽 모서리 프레임2`water` · 풀밭 물웅덩이 안쪽`water` | block-00-03 c1 r3 |
| 92 | 동굴 암벽 좌측 경계 `rock` | 연못 안쪽 모서리 프레임3 `water` | 연못 안쪽 모서리 프레임3`water` · 풀밭 물웅덩이 안쪽`water` | block-00-03 c2 r3 |
| 93 | 벽돌 석벽 상단 `wall` | 석벽 수로 안쪽 모서리 프레임1 `water` | 석벽 수로 안쪽 모서리 프레임1`water` · 석조 수로 안쪽`water` | block-00-03 c3 r3 |
| 94 | 벽돌 석벽 중앙 `wall` | 석벽 수로 안쪽 모서리 프레임2 `water` | 석벽 수로 안쪽 모서리 프레임2`water` · 석조 수로 안쪽`water` | block-00-03 c4 r3 |
| 95 | 벽돌 석벽 하단 `wall` | 석벽 수로 안쪽 모서리 프레임3 `water` | 석벽 수로 안쪽 모서리 프레임3`water` · 석조 수로 안쪽`water` | block-00-03 c5 r3 |
| 100 | 물가 얼음 경계 `water` | 얼음판 하단 `terrain` | 빙판 하단`floor` · 빙판 하단`terrain` · 얼음판 하단`terrain` | block-00-03 c10 r3 |
| 101 | 얼음 낀 물 가장자리 `water` | 얼음판 우하단 `terrain` | 빙판 우하단`floor` · 빙판 우하단`terrain` · 얼음판 우하단`terrain` | block-00-03 c11 r3 |
| 102 | 갈색 흙 지면 `floor` | 흙 바닥 `terrain` | 어두운 흙 바닥 1`floor` · 흙 바닥`terrain` · 흙 바닥`terrain` | block-00-03 c12 r3 |
| 103 | 갈색 토양 지면 `floor` | 흙 바닥 `terrain` | 어두운 흙 바닥 2`floor` · 흙 바닥`terrain` · 흙 바닥`terrain` | block-00-03 c13 r3 |
| 104 | 갈색 흙바닥 중앙 `floor` | 흙 바닥 `terrain` | 어두운 흙 바닥 3`floor` · 흙 바닥`terrain` · 흙 바닥`terrain` | block-00-03 c14 r3 |
| 105 | 어두운 적갈색 바닥 `floor` | 붉은 석벽 좌측 `wall` | 붉은 석벽 좌측`wall` · 붉은 벽돌 벽`wall` | block-00-03 c15 r3 |
| 106 | 적갈색 흙 무늬 바닥 `floor` | 붉은 석벽 중앙 `wall` | 붉은 석벽 중앙`wall` · 붉은 벽돌 벽`wall` | block-00-03 c16 r3 |
| 107 | 적갈색 암석 바닥 `floor` | 붉은 석벽 우측 `wall` | 붉은 석벽 우측`wall` · 붉은 벽돌 벽`wall` | block-00-03 c17 r3 |
| 112 | 풀 낀 흙바닥 `floor` | 새싹이 돋은 흙 바닥 `terrain` | 새싹이 자란 흙바닥 1`floor` · 풀이 난 흙 바닥`terrain` · 새싹이 돋은 흙 바닥`terrain` | block-00-03 c22 r3 |
| 113 | 잡초 낀 흙바닥 `floor` | 새싹이 돋은 흙 바닥 `terrain` | 새싹이 자란 흙바닥 2`floor` · 풀이 난 흙 바닥`terrain` · 새싹이 돋은 흙 바닥`terrain` | block-00-03 c23 r3 |
| 114 | 나무 난간 좌측 `fence` | 세로 직선 광산 레일 `prop` | 세로 직선 광산 레일`prop` · 세로 철로`prop` | block-00-03 c24 r3 |
| 115 | 나무 난간 우측 `fence` | 가로 광산 레일 상향 굴곡 `prop` | 가로 광산 레일 상향 굴곡`prop` · 분기 철로`prop` | block-00-03 c25 r3 |
| 116 | 나무 울타리 가로 빗장 `fence` | 가로 직선 광산 레일 `prop` | 가로 직선 광산 레일`prop` · 가로 철로`prop` | block-00-03 c26 r3 |
| 117 | 나무 난간 가로 빗장 `fence` | 가로 광산 레일 하향 굴곡 `prop` | 가로 광산 레일 하향 굴곡`prop` · 분기 철로`prop` | block-00-03 c27 r3 |
| 118 | 뾰족한 청색 창날 `prop` | 푸른 수정 `prop` | 푸른 수정`prop` · 푸른 수정`prop` | block-00-03 c28 r3 |
| 119 | 사선으로 솟은 창날 `prop` | 원뿔형 얼음 결정 `prop` | 원뿔형 얼음 바위`rock` · 얼음 바위`prop` · 원뿔형 얼음 결정`prop` | block-00-03 c29 r3 |
| 120 | 파란 깊은 물 `water` | 푸른 수면 1 `water` | 푸른 수면 1`water` · 어두운 물`water` | block-04-07 c0 r4 |
| 121 | 파란 깊은 물 `water` | 푸른 수면 2 `water` | 푸른 수면 2`water` · 어두운 물`water` | block-04-07 c1 r4 |
| 122 | 파란 깊은 물 `water` | 잔잔한 수면 1 `water` | 잔잔한 수면 1`water` · 어두운 물`water` | block-04-07 c2 r4 |
| 123 | 물보라 흰 거품 `water` | 폭포 상단 1 `water` | 폭포 상단 1`water` · 폭포 상단`water` | block-04-07 c3 r4 |
| 124 | 맑은 얕은 물 `water` | 물 소용돌이 상단 `water` | 소용돌이 물 1`water` · 물 소용돌이 상단`water` | block-04-07 c4 r4 |
| 125 | 물 위 바위 섬 `rock` | 푸른 기하학 문양 바닥 `floor` | 푸른 마법진 발판 1`floor` · 푸른 기하학 문양 바닥`floor` | block-04-07 c5 r4 |
| 129 | 균열 난 검은 바위 `rock` | 작은 구덩이 `rock` | 작은 구덩이`terrain` · 작은 구덩이`cliff` · 작은 구덩이`cliff` | block-04-07 c9 r4 |
| 131 | 검은 동굴 구멍 `decoration` | 어두운 구덩이 `cliff` | 구덩이 모서리`terrain` · 어두운 구덩이`cliff` · 사각 구덩이`cliff` | block-04-07 c11 r4 |
| 133 | 갈색 벽돌 벽면 `wall` | 흙 바닥 2 `floor` | 흙 바닥 2`floor` · 흙 바닥`floor` | block-04-07 c13 r4 |
| 135 | 회색 돌담 벽 `wall` | 어두운 흙 바닥 좌측 테두리 `floor` | 어두운 흙 바닥 좌측 테두리`floor` · 흙 바닥 경계`floor` | block-04-07 c15 r4 |
| 136 | 석조 벽돌 벽면 `wall` | 어두운 흙 바닥 `floor` | 어두운 흙 바닥`floor` · 흙 바닥`floor` | block-04-07 c16 r4 |
| 137 | 돌 무늬 담벼락 `wall` | 어두운 흙 바닥 우측 테두리 `floor` | 어두운 흙 바닥 우측 테두리`floor` · 흙 바닥`floor` | block-04-07 c17 r4 |
| 138 | 타오르는 용암 `lava` | 붉은 카펫 좌상단 모서리 `decoration` | 붉은 카펫 좌상단 모서리`decoration` · 붉은 양탄자 좌상단`decoration` | block-04-07 c18 r4 |
| 139 | 타오르는 용암 `lava` | 붉은 카펫 상단 테두리 `decoration` | 붉은 카펫 상단 테두리`decoration` · 붉은 양탄자 상단`decoration` | block-04-07 c19 r4 |
| 140 | 타오르는 용암 `lava` | 붉은 카펫 우상단 모서리 `decoration` | 붉은 카펫 우상단 모서리`decoration` · 붉은 양탄자 우상단`decoration` | block-04-07 c20 r4 |
| 141 | 갈색 석조 계단 `stairs` | 가로 나무 다리 좌측 `floor` | 목재 벽 상단 좌측`wall` · 나무 발판`floor` · 가로 나무 다리 좌측`floor` | block-04-07 c21 r4 |
| 142 | 갈색 석조 계단 `stairs` | 가로 나무 다리 중앙 `floor` | 목재 벽 상단 중앙`wall` · 나무 발판`floor` · 가로 나무 다리 중앙`floor` | block-04-07 c22 r4 |
| 143 | 갈색 석조 계단 `stairs` | 가로 나무 다리 우측 `floor` | 목재 벽 상단 우측`wall` · 나무 발판`floor` · 가로 나무 다리 우측`floor` | block-04-07 c23 r4 |
| 144 | 물과 돌 섞인 바닥 `terrain` | 목재 사다리 상단 `stairs` | 목재 사다리 상단`stairs` · 사다리 상단`stairs` | block-04-07 c24 r4 |
| 145 | 회백색 석판 바닥 `floor` | 수도사 석상 상단 `prop` | 후드 석상 머리`prop` · 수도사 석상 상단`prop` | block-04-07 c25 r4 |
| 146 | 밝은 석조 바닥 `floor` | 가고일 석상 상단 `prop` | 가고일 석상 상단`prop` · 가고일 석상 상단`prop` | block-04-07 c26 r4 |
| 147 | 회색 돌 무늬 벽 `wall` | 십자가 묘비 `prop` | 십자가 묘비`prop` · 십자가 묘비`prop` | block-04-07 c27 r4 |
| 148 | 어두운 석벽 면 `wall` | 사각 묘비 `prop` | 사각 묘비`prop` · 석조 묘비`prop` | block-04-07 c28 r4 |
| 149 | 물결 섞인 돌 바닥 `terrain` | 고드름 `decoration` | 고드름`decoration` · 고드름`decoration` | block-04-07 c29 r4 |
| 152 | 푸른 파도 물 `water` | 잔잔한 수면 2 `water` | 잔잔한 수면 2`water` · 어두운 물`water` | block-04-07 c2 r5 |
| 153 | 물보라 이는 물가 `water` | 폭포 상단 2 `water` | 폭포 상단 2`water` · 폭포 중간`water` | block-04-07 c3 r5 |
| 154 | 깊은 색 물 바닥 `water` | 물 소용돌이 중간 `water` | 소용돌이 물 2`water` · 물 소용돌이 중간`water` | block-04-07 c4 r5 |
| 155 | 물 위 흰 바위 `rock` | 푸른 기하학 문양 바닥 `floor` | 푸른 마법진 발판 2`floor` · 푸른 기하학 문양 바닥`floor` | block-04-07 c5 r5 |
| 159 | 어두운 바위 틈 `rock` | 대형 구덩이 좌상단 `rock` | 구덩이 좌상단`terrain` · 대형 구덩이 좌상단`cliff` · 대형 구덩이 좌상단`cliff` | block-04-07 c9 r5 |
| 161 | 그늘진 바위 바닥 `floor` | 대형 구덩이 우상단 `cliff` | 구덩이 우상단`terrain` · 대형 구덩이 우상단`cliff` · 대형 구덩이 우상단`cliff` | block-04-07 c11 r5 |
| 162 | 잔불 깔린 바위 `terrain` | 암벽 대각선 좌상단 `cliff` | 암벽 대각선 좌상단`cliff` · 돌 절벽 좌상단`cliff` | block-04-07 c12 r5 |
| 163 | 재와 바위 섞인 바닥 `terrain` | 암벽 대각선 우상단 `cliff` | 암벽 대각선 우상단`cliff` · 돌 절벽 우상단`cliff` | block-04-07 c13 r5 |
| 164 | 불씨 박힌 흙 `terrain` | 암벽 상단 `cliff` | 암벽 상단`cliff` · 돌 절벽`cliff` | block-04-07 c14 r5 |
| 168 | 붉은 용암 불꽃 `lava` | 붉은 카펫 좌측 테두리 `decoration` | 붉은 카펫 좌측 테두리`decoration` · 붉은 양탄자 좌측`decoration` | block-04-07 c18 r5 |
| 169 | 붉은 용암 불꽃 `lava` | 붉은 양탄자 중앙 `decoration` | 붉은 카펫 중앙`decoration` · 붉은 양탄자 중앙`decoration` | block-04-07 c19 r5 |
| 170 | 붉은 용암 불꽃 `lava` | 붉은 카펫 우측 테두리 `decoration` | 붉은 카펫 우측 테두리`decoration` · 붉은 양탄자 우측`decoration` | block-04-07 c20 r5 |
| 171 | 갈색 돌 계단 `stairs` | 목재 바닥 1 `floor` | 목재 바닥 1`floor` · 나무 다리`floor` | block-04-07 c21 r5 |
| 172 | 회색 돌 경사로 `path` | 위쪽 노란색 화살표 발판 `path` | 위쪽 노란색 화살표 발판`floor` · 위쪽 화살표 발판`floor` | block-04-07 c22 r5 |
| 173 | 회색 미끄럼 경사 `path` | 아래쪽 노란색 화살표 발판 `path` | 아래쪽 노란색 화살표 발판`floor` · 아래쪽 화살표 발판`floor` | block-04-07 c23 r5 |
| 174 | 물 섞인 회색 바닥 `terrain` | 목재 사다리 하단 `stairs` | 목재 사다리 하단`stairs` · 사다리 하단`stairs` | block-04-07 c24 r5 |
| 175 | 회백색 돌 바닥 `floor` | 후드 석상 받침대 `prop` | 후드 석상 받침대`prop` · 수도사 석상 하단`prop` | block-04-07 c25 r5 |
| 176 | 회색 석재 바닥 `floor` | 가고일 석상 받침대 `prop` | 가고일 석상 받침대`prop` · 가고일 석상 하단`prop` | block-04-07 c26 r5 |
| 177 | 이끼 낀 밝은 벽 `wall` | 덩굴 가지 상단 `plant` | 덩굴 가지 상단`plant` · 식물 덩굴 분기`plant` | block-04-07 c27 r5 |
| 178 | 이끼 낀 석벽 면 `wall` | 덩굴 줄기 우하향 `plant` | 덩굴 줄기 우하향`plant` · 식물 덩굴 줄기`plant` | block-04-07 c28 r5 |
| 179 | 이끼 낀 돌 바닥 `floor` | 덩굴 줄기 우상향 `plant` | 덩굴 줄기 우상향`plant` · 식물 덩굴 끝`plant` | block-04-07 c29 r5 |
| 180 | 짙은 물 애니메이션 `water` | 푸른 수면 5 `water` | 푸른 수면 5`water` · 어두운 물`water` | block-04-07 c0 r6 |
| 181 | 짙은 물 애니메이션 `water` | 푸른 수면 6 `water` | 푸른 수면 6`water` · 어두운 물`water` | block-04-07 c1 r6 |
| 182 | 짙은 물 애니메이션 `water` | 잔잔한 수면 3 `water` | 잔잔한 수면 3`water` · 어두운 물`water` | block-04-07 c2 r6 |
| 183 | 거품 이는 물가 `water` | 폭포 하단 1 `water` | 폭포 하단 1`water` · 폭포 중간`water` | block-04-07 c3 r6 |
| 184 | 맑은 물 바닥 `water` | 물 소용돌이 중간 `water` | 소용돌이 물 3`water` · 물 소용돌이 중간`water` | block-04-07 c4 r6 |
| 185 | 물 위 돌 더미 `rock` | 푸른 기하학 문양 바닥 `floor` | 푸른 마법진 발판 3`floor` · 푸른 기하학 문양 바닥`floor` | block-04-07 c5 r6 |
| 190 | 새까만 어둠 구멍 `terrain` | 대형 구덩이 중앙 `cliff` | 구덩이 내부`terrain` · 대형 구덩이 중앙`cliff` · 대형 구덩이 내부`cliff` | block-04-07 c10 r6 |
| 191 | 어두운 바위 그늘 `floor` | 대형 구덩이 우측 `cliff` | 구덩이 우측 가장자리`terrain` · 대형 구덩이 우측`cliff` · 대형 구덩이 우단`cliff` | block-04-07 c11 r6 |
| 192 | 잔불 바위 흩뿌림 `terrain` | 암벽 좌측 `cliff` | 암벽 좌측`cliff` · 돌 절벽`cliff` | block-04-07 c12 r6 |
| 193 | 불탄 돌 바닥 `terrain` | 암벽 중앙 `cliff` | 암벽 중앙`cliff` · 돌 절벽`cliff` | block-04-07 c13 r6 |
| 194 | 재덮인 바위 바닥 `terrain` | 암벽 우측 `cliff` | 암벽 우측`cliff` · 돌 절벽`cliff` | block-04-07 c14 r6 |
| 198 | 용암 불바다 `lava` | 붉은 카펫 좌하단 모서리 `decoration` | 붉은 카펫 좌하단 모서리`decoration` · 붉은 양탄자 좌하단`decoration` | block-04-07 c18 r6 |
| 199 | 용암 불바다 `lava` | 붉은 카펫 하단 테두리 `decoration` | 붉은 카펫 하단 테두리`decoration` · 붉은 양탄자 하단`decoration` | block-04-07 c19 r6 |
| 200 | 용암 불바다 `lava` | 붉은 카펫 우하단 모서리 `decoration` | 붉은 카펫 우하단 모서리`decoration` · 붉은 양탄자 우하단`decoration` | block-04-07 c20 r6 |
| 201 | 갈색 돌 계단 `stairs` | 목재 바닥 2 `floor` | 목재 바닥 2`floor` · 나무 다리`floor` | block-04-07 c21 r6 |
| 202 | 회색 돌 경사로 `path` | 왼쪽 노란색 화살표 발판 `path` | 왼쪽 노란색 화살표 발판`floor` · 왼쪽 화살표 발판`floor` | block-04-07 c22 r6 |
| 203 | 회색 경사 바닥 `path` | 오른쪽 노란색 화살표 발판 `path` | 오른쪽 노란색 화살표 발판`floor` · 오른쪽 화살표 발판`floor` | block-04-07 c23 r6 |
| 204 | 돌 깔린 바닥 무늬 `floor` | 철창 상단 좌측 `gate` | 철창 상단 좌측`gate` · 쇠창살 좌상단`gate` | block-04-07 c24 r6 |
| 205 | 회색 바둑돌 바닥 `floor` | 철창 상단 중앙 `gate` | 철창 상단 중앙`gate` · 쇠창살 상단`gate` | block-04-07 c25 r6 |
| 206 | 돌 판 데크 바닥 `floor` | 철창 상단 우측 `gate` | 철창 상단 우측`gate` · 쇠창살 우상단`gate` | block-04-07 c26 r6 |
| 207 | 화롯불 불꽃 `torch` | 노란색 발광 균열 좌측 `torch` | 황금 덩굴 뿌리 좌측`plant` · 노란색 발광 균열 좌측`decoration` · 황금빛 액체 튀김 좌측`decoration` | block-04-07 c27 r6 |
| 208 | 화롯불 불꽃 `torch` | 노란색 발광 균열 중앙 `torch` | 황금 덩굴 밑동 중앙`plant` · 노란색 발광 균열 중앙`decoration` · 황금빛 액체 튀김 중앙`decoration` | block-04-07 c28 r6 |
| 209 | 화롯불 불꽃 `torch` | 노란색 발광 균열 파편 `torch` | 황금 덩굴 뿌리 우측`plant` · 노란색 발광 균열 파편`decoration` · 황금빛 액체 튀김 우측`decoration` | block-04-07 c29 r6 |
| 210 | 파란 물결 애니메이션 `water` | 푸른 수면 7 `water` | 푸른 수면 7`water` · 어두운 물`water` | block-04-07 c0 r7 |
| 211 | 파란 물결 애니메이션 `water` | 푸른 수면 8 `water` | 푸른 수면 8`water` · 어두운 물`water` | block-04-07 c1 r7 |
| 212 | 파란 물결 애니메이션 `water` | 잔잔한 수면 4 `water` | 잔잔한 수면 4`water` · 어두운 물`water` | block-04-07 c2 r7 |
| 213 | 흰 거품 돌아치는 물 `water` | 폭포 하단 2 `water` | 폭포 하단 2`water` · 폭포 하단`water` | block-04-07 c3 r7 |
| 214 | 잔잔한 물 바닥 `water` | 물 소용돌이 하단 `water` | 소용돌이 물 4`water` · 물 소용돌이 하단`water` | block-04-07 c4 r7 |
| 215 | 물 위 바위 섬 `rock` | 푸른 기하학 문양 바닥 `floor` | 푸른 마법진 발판 4`floor` · 푸른 기하학 문양 바닥`floor` | block-04-07 c5 r7 |
| 219 | 어두운 바위 굴 `rock` | 대형 구덩이 좌하단 `rock` | 구덩이 좌하단`terrain` · 대형 구덩이 좌하단`cliff` · 대형 구덩이 좌하단`cliff` | block-04-07 c9 r7 |
| 220 | 검은 동굴 어둠 `terrain` | 대형 구덩이 하단 `cliff` | 구덩이 하단 테두리`terrain` · 대형 구덩이 하단`cliff` · 대형 구덩이 하단`cliff` | block-04-07 c10 r7 |
| 221 | 어두운 돌 바닥 `floor` | 대형 구덩이 우하단 `cliff` | 구덩이 우하단`terrain` · 대형 구덩이 우하단`cliff` · 대형 구덩이 우하단`cliff` | block-04-07 c11 r7 |
| 222 | 잔불 섞인 바위 `terrain` | 암벽 대각선 좌하단 `cliff` | 암벽 대각선 좌하단`cliff` · 돌 절벽 좌하단`cliff` | block-04-07 c12 r7 |
| 223 | 불꽃 바위 바닥 `terrain` | 암벽 대각선 우하단 `cliff` | 암벽 대각선 우하단`cliff` · 돌 절벽 우하단`cliff` | block-04-07 c13 r7 |
| 224 | 이끼 낀 돌 바닥 `floor` | 파란 꽃이 핀 흙 바닥 `plant` | 파란 꽃이 핀 흙 바닥`plant` · 파란 꽃이 핀 흙 바닥`plant` | block-04-07 c14 r7 |
| 225 | 불 타는 바위 층 `terrain` | 암벽 하단 좌측 `cliff` | 암벽 하단 좌측`cliff` · 돌벽 하단`cliff` | block-04-07 c15 r7 |
| 226 | 잔불 가득 돌 `terrain` | 암벽 하단 중앙 `cliff` | 암벽 하단 중앙`cliff` · 돌벽 하단`cliff` | block-04-07 c16 r7 |
| 227 | 불씨 바위 바닥 `terrain` | 암벽 하단 우측 `cliff` | 암벽 하단 우측`cliff` · 돌벽 하단`cliff` | block-04-07 c17 r7 |
| 228 | 활활 타는 불꽃 `lava` | 붉은 카펫 세로 무늬 좌측 `decoration` | 붉은 카펫 세로 무늬 좌측`decoration` · 붉은 양탄자 술 좌측`decoration` | block-04-07 c18 r7 |
| 229 | 활활 타는 불꽃 `lava` | 붉은 카펫 세로 무늬 중앙 `decoration` | 붉은 카펫 세로 무늬 중앙`decoration` · 붉은 양탄자 술 중앙`decoration` | block-04-07 c19 r7 |
| 230 | 활활 타는 불꽃 `lava` | 붉은 카펫 세로 무늬 우측 `decoration` | 붉은 카펫 세로 무늬 우측`decoration` · 붉은 양탄자 술 우측`decoration` | block-04-07 c20 r7 |
| 231 | 갈색 돌 계단 `stairs` | 목재 바닥 3 `floor` | 목재 바닥 3`floor` · 나무 다리`floor` | block-04-07 c21 r7 |
| 232 | 흰 석판 무늬 벽 `wall` | 투명한 얼음 발판 `floor` | 투명한 얼음 발판`floor` · 사선 격자 유리판`floor` | block-04-07 c22 r7 |
| 234 | 회색 바둑돌 바닥 `floor` | 철창 하단 좌측 `gate` | 철창 하단 좌측`gate` · 쇠창살 좌하단`gate` | block-04-07 c24 r7 |
| 235 | 밝은 돌 바닥 무늬 `floor` | 철창 하단 중앙 `gate` | 철창 하단 중앙`gate` · 쇠창살 하단`gate` | block-04-07 c25 r7 |
| 236 | 회백색 돌 바닥 `floor` | 철창 하단 우측 `gate` | 철창 하단 우측`gate` · 쇠창살 우하단`gate` | block-04-07 c26 r7 |
| 237 | 흰 석조 벽면 `wall` | 눈 장식 좌측 `decoration` | 눈 덮인 바닥 좌상단`floor` · 눈 덮인 경사 좌상단`cliff` · 눈 바닥 모서리 좌측`decoration` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 238 | 하얀 돌 벽 `wall` | 눈 장식 중앙 `decoration` | 눈 덮인 바닥 우상단`floor` · 눈 덮인 경사 우상단`cliff` · 눈 바닥 모서리 중앙`decoration` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 239 | 밝은 석조 바닥 `floor` | 눈 장식 우측 `decoration` | 눈 덮인 바닥 V자 중앙`floor` · 눈 덮인 협곡`cliff` · 눈 바닥 모서리 우측`decoration` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 240 | 용암 바위 지면 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c0 r8 |
| 241 | 용암 애니메이션 2프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c1 r8 |
| 242 | 용암 애니메이션 3프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c2 r8 |
| 244 | 용암 애니메이션 4프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c4 r8 |
| 246 | 닫힌 나무 상자 `chest` | 1칸 구덩이 `cliff` | 1칸 구덩이`cliff` · 작은 구덩이`cliff` | block-08-11 c6 r8 |
| 247 | 어두운 돌 벽 `wall` | 어두운 구덩이 바닥 `cliff` | 구덩이 상단 좌측`cliff` · 어두운 구덩이 바닥`cliff` | block-08-11 c7 r8 |
| 248 | 장식 띠 나무 상자 `chest` | 구덩이 안쪽 모서리 `cliff` | 구덩이 상단 우측`cliff` · 구덩이 안쪽 모서리`cliff` | block-08-11 c8 r8 |
| 249 | 잔자갈 돌 바닥 `floor` | 암석 구덩이 상단 좌측 `cliff` | 암석 구덩이 상단 좌측`cliff` · 작은 흙 구덩이`cliff` | block-08-11 c9 r8 |
| 250 | 새까만 돌 벽 `wall` | 암석 구덩이 상단 중앙 `cliff` | 암석 구덩이 상단 중앙`cliff` · 흙 구덩이 바닥`cliff` | block-08-11 c10 r8 |
| 251 | 뚜껑 달린 상자 `chest` | 암석 구덩이 상단 우측 `cliff` | 암석 구덩이 상단 우측`cliff` · 흙 구덩이 안쪽 모서리`cliff` | block-08-11 c11 r8 |
| 254 | 테두리 나무 판자 `wall` | 목조 벽 상단 우측 `wall` | 어두운 목재 바닥`floor` · 목재 벽 상단`wall` · 목조 벽 상단 우측`wall` | block-08-11 c14 r8 |
| 255 | 흩어진 돌무더기 `rock` | 석벽 상단 좌측 `wall` | 갈색 자갈 바닥`floor` · 암석 벽`wall` · 석벽 상단 좌측`wall` | block-08-11 c15 r8 |
| 256 | 돌 잔해 무더기 `rock` | 석벽 상단 중앙 `wall` | 갈색 자갈 바닥`floor` · 암석 벽`wall` · 석벽 상단 중앙`wall` | block-08-11 c16 r8 |
| 257 | 작은 돌 쪼가리 `rock` | 석벽 상단 우측 `wall` | 갈색 자갈 바닥`floor` · 암석 벽`wall` · 석벽 상단 우측`wall` | block-08-11 c17 r8 |
| 259 | 바위 모서리 자동타일 `rock` | 둥근 나무 아치 좌측 `prop` | 둥근 나무 아치 좌측`prop` · 목재 아치 좌측`prop` | block-08-11 c19 r8 |
| 260 | 바위 가장자리 자동타일 `rock` | 둥근 나무 아치 우측 `prop` | 둥근 나무 아치 우측`prop` · 목재 아치 우측`prop` | block-08-11 c20 r8 |
| 262 | 파란 물웅덩이 `water` | 얼음 석순 상단 `rock` | 얼음 기둥 상단`prop` · 얼음 석순 상단`rock` · 얼음 석순 상단`rock` | block-08-11 c22 r8 |
| 264 | 타오르는 불꽃 2프레임 `torch` | 벽걸이 횃불 `torch` | 벽걸이 횃불`prop` · 벽걸이 횃불`decoration` · 벽 횃불`prop` | block-08-11 c24 r8 |
| 265 | 회색 산봉우리 `mountain` | 문자가 새겨진 석판 `prop` | 고대 문자 석판`prop` · 문자가 새겨진 석판`prop` | block-08-11 c25 r8 |
| 266 | 작은 검은 사각 덩어리 `rock` | 벽면 스위치 홈 `decoration` | 벽면 열쇠구멍`decoration` · 벽면 스위치 홈`decoration` | block-08-11 c26 r8 |
| 267 | 진한 남색 타원 덩어리 `water` | 어두운 종유석 `rock` | 어두운 종유석`rock` · 천장 종유석`cliff` · 천장 종유석`rock` | block-08-11 c27 r8 |
| 268 | 검푸른 구름 덩어리 `water` | 동굴 천장 암석 좌측 `cliff` | 동굴 천장 좌측`cliff` · 동굴 천장 암석 좌측`cliff` | block-08-11 c28 r8 |
| 269 | 남색 물감 얼룩 `water` | 동굴 천장 암석 우측 `cliff` | 동굴 천장 우측`cliff` · 동굴 천장 암석 우측`cliff` | block-08-11 c29 r8 |
| 270 | 용암 바위 지면 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c0 r9 |
| 271 | 용암 애니메이션 2프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c1 r9 |
| 272 | 용암 애니메이션 3프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c2 r9 |
| 276 | 나무 보물상자 `chest` | 어두운 구덩이 좌상단 `cliff` | 구덩이 좌상단`cliff` · 어두운 구덩이 좌상단`cliff` | block-08-11 c6 r9 |
| 277 | 띠 둘린 어두운 상자 `chest` | 어두운 구덩이 상단 `cliff` | 구덩이 상단`cliff` · 어두운 구덩이 상단`cliff` | block-08-11 c7 r9 |
| 278 | 목재 장식 상자 `chest` | 어두운 구덩이 우상단 `cliff` | 구덩이 우상단`cliff` · 어두운 구덩이 우상단`cliff` | block-08-11 c8 r9 |
| 279 | 뚜껑 덮인 석관 `chest` | 암석 구덩이 좌상단 `cliff` | 암석 구덩이 좌상단`cliff` · 흙 구덩이 좌상단`cliff` | block-08-11 c9 r9 |
| 280 | 칠흑 같은 돌 벽 `wall` | 암석 구덩이 상단 `cliff` | 암석 구덩이 상단`cliff` · 흙 구덩이 상단`cliff` | block-08-11 c10 r9 |
| 281 | 가장자리 어두운 석관 `chest` | 암석 구덩이 우상단 `cliff` | 암석 구덩이 우상단`cliff` · 흙 구덩이 우상단`cliff` | block-08-11 c11 r9 |
| 282 | 흐르는 물길 1프레임 `water` | 눈 덮인 바닥 좌상단 `floor` | 눈밭 좌상단`floor` · 눈 덮인 바닥 좌상단`floor` | block-08-11 c12 r9 |
| 283 | 흐르는 물길 2프레임 `water` | 눈 덮인 바닥 상단 `floor` | 눈밭 상단`floor` · 눈 덮인 바닥 상단`floor` | block-08-11 c13 r9 |
| 284 | 흐르는 물길 3프레임 `water` | 눈 덮인 바닥 우상단 `floor` | 눈밭 우상단`floor` · 눈 덮인 바닥 우상단`floor` | block-08-11 c14 r9 |
| 285 | 잔잔한 물 표면 1 `water` | 얼음 절벽 상단 좌측 `cliff` | 얼음 절벽 상단 좌측`cliff` · 빙벽 좌상단`cliff` | block-08-11 c15 r9 |
| 286 | 잔잔한 물 표면 2 `water` | 얼음 절벽 상단 중앙 `cliff` | 얼음 절벽 상단 중앙`cliff` · 빙벽 상단`cliff` | block-08-11 c16 r9 |
| 287 | 잔잔한 물 표면 3 `water` | 얼음 절벽 상단 우측 `cliff` | 얼음 절벽 상단 우측`cliff` · 빙벽 우상단`cliff` | block-08-11 c17 r9 |
| 289 | 작은 물웅덩이 `water` | 작은 얼음 덩어리 `rock` | 작은 얼음 덩어리`rock` · 얼음 덩어리`rock` | block-08-11 c19 r9 |
| 292 | 푸른 물웅덩이 `water` | 얼음 석순 하단 `rock` | 얼음 기둥 하단`prop` · 얼음 석순 하단`rock` · 얼음 석순 하단`rock` | block-08-11 c22 r9 |
| 293 | 노란 무늬 갈색 바위 `rock` | 삼각 화로 받침대 `prop` | 삼각 화로 받침대`prop` · 목재 화로 하단`prop` | block-08-11 c23 r9 |
| 294 | 갈색 흙 바닥 `floor` | 목재 기둥 상단 `prop` | 목재 기둥 상단`prop` · 목재 기둥 상단`prop` | block-08-11 c24 r9 |
| 295 | 그늘 진 돌 벽 `wall` | 어두운 통로 상단 `door` | 어두운 통로 상단`door` · 동굴 입구 상단`door` | block-08-11 c25 r9 |
| 296 | 세로 나무 말뚝 `prop` | 밧줄 `stairs` | 늘어진 덩굴`plant` · 나무 지지대 기둥`prop` · 밧줄`stairs` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 297 | 나무 격자 상자 `crate` | 나무 사다리 `stairs` | 나무 사다리`stairs` · 목재 사다리`stairs` | block-08-11 c27 r9 |
| 298 | 큰 갈색 바위 `rock` | 목재 표지판 `prop` | 목재 표지판`prop` · 나무 표지판`prop` | block-08-11 c28 r9 |
| 299 | 매끈 회색 표면 바위 `rock` | 해골 장식 `prop` | 해골 장식`prop` · 거대 해골 장식`decoration` · 해골`prop` | block-08-11 c29 r9 |
| 300 | 용암 바위 지면 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c0 r10 |
| 301 | 용암 애니메이션 2프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c1 r10 |
| 302 | 용암 애니메이션 3프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c2 r10 |
| 306 | 골동 나무 상자 `chest` | 어두운 구덩이 좌측 `cliff` | 구덩이 좌측`cliff` · 어두운 구덩이 좌측`cliff` | block-08-11 c6 r10 |
| 307 | 먹빛 돌 벽 `wall` | 어두운 구덩이 중앙 `cliff` | 구덩이 내부`cliff` · 어두운 구덩이 중앙`cliff` | block-08-11 c7 r10 |
| 308 | 쇠장식 보물상자 `chest` | 어두운 구덩이 우측 `cliff` | 구덩이 우측`cliff` · 어두운 구덩이 우측`cliff` | block-08-11 c8 r10 |
| 309 | 닫힌 돌 석관 `chest` | 암석 구덩이 좌측 `cliff` | 암석 구덩이 좌측`cliff` · 흙 구덩이 좌측`cliff` | block-08-11 c9 r10 |
| 310 | 검은 돌 벽 `wall` | 암석 구덩이 내부 `cliff` | 암석 구덩이 내부`cliff` · 흙 구덩이 중앙`cliff` | block-08-11 c10 r10 |
| 311 | 우측 테두리 석관 `chest` | 암석 구덩이 우측 `cliff` | 암석 구덩이 우측`cliff` · 흙 구덩이 우측`cliff` | block-08-11 c11 r10 |
| 312 | 흐르는 물길 1프레임 `water` | 눈 덮인 바닥 좌측 `floor` | 눈밭 좌측`floor` · 눈 덮인 바닥 좌측`floor` | block-08-11 c12 r10 |
| 313 | 흐르는 물길 2프레임 `water` | 눈 덮인 바위 `rock` | 눈 덮인 바위`rock` · 눈 덮인 바위`rock` | block-08-11 c13 r10 |
| 314 | 흐르는 물길 3프레임 `water` | 눈 덮인 바닥 우측 `floor` | 눈밭 우측`floor` · 눈 덮인 바닥 우측`floor` | block-08-11 c14 r10 |
| 315 | 고요한 물 표면 1 `water` | 얼음 절벽 중앙 좌측 `cliff` | 얼음 절벽 중앙 좌측`cliff` · 빙벽 좌측`cliff` | block-08-11 c15 r10 |
| 316 | 고요한 물 표면 2 `water` | 얼음 절벽 중앙 `cliff` | 얼음 절벽 중앙`cliff` · 빙벽 중앙`cliff` | block-08-11 c16 r10 |
| 317 | 고요한 물 표면 3 `water` | 얼음 절벽 중앙 우측 `cliff` | 얼음 절벽 중앙 우측`cliff` · 빙벽 우측`cliff` | block-08-11 c17 r10 |
| 320 | 번지는 물가 가장자리 `water` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-08-11 c20 r10 |
| 321 | 맑은 물웅덩이 `water` | 얼음 결정 상단 `rock` | 얼음 결정 상단`prop` · 얼음 결정 상단`rock` · 얼음 결정 상단`rock` | block-08-11 c21 r10 |
| 324 | 갈색 흙바닥 조각 `floor` | 목재 기둥 중앙 `prop` | 목재 기둥 중앙`prop` · 목재 기둥 중단`prop` | block-08-11 c24 r10 |
| 325 | 석재 기단 어두운 벽 `wall` | 어두운 통로 중앙 `door` | 어두운 통로 중앙`door` · 동굴 입구 중단`door` | block-08-11 c25 r10 |
| 326 | 가로 나무 널빤지 `floor` | 원형 나무 탁자 `furniture` | 원형 나무 탁자`furniture` · 원형 목재 탁자`furniture` | block-08-11 c26 r10 |
| 327 | 갈색 풀 덩어리 `prop` | 나무 의자 뒷모습 `furniture` | 나무 의자 뒷모습`furniture` · 목재 의자 후면`furniture` | block-08-11 c27 r10 |
| 328 | 갈색 뭉치 풀 `prop` | 나무 의자 뒷모습 `furniture` | 나무 의자 뒷모습`furniture` · 목재 의자 전면`furniture` | block-08-11 c28 r10 |
| 329 | 보석 박힌 장식판 `decoration` | 목재 책장 상단 `furniture` | 목재 책장 상단`furniture` · 목재 책장 상단`furniture` | block-08-11 c29 r10 |
| 330 | 용암 바위 지면 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c0 r11 |
| 331 | 용암 애니메이션 2프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c1 r11 |
| 332 | 용암 애니메이션 3프레임 `lava` | 붉은 암반 바닥 `floor` | 붉은 암반 바닥`floor` · 용암 바닥`floor` | block-08-11 c2 r11 |
| 336 | 고대 나무 상자 `chest` | 어두운 구덩이 좌하단 `cliff` | 구덩이 좌하단`cliff` · 어두운 구덩이 좌하단`cliff` | block-08-11 c6 r11 |
| 337 | 밑단 어두운 돌 벽 `wall` | 어두운 구덩이 하단 `cliff` | 구덩이 하단`cliff` · 어두운 구덩이 하단`cliff` | block-08-11 c7 r11 |
| 338 | 고대 목재 상자 `chest` | 어두운 구덩이 우하단 `cliff` | 구덩이 우하단`cliff` · 어두운 구덩이 우하단`cliff` | block-08-11 c8 r11 |
| 339 | 돌 석관 `chest` | 암석 구덩이 좌하단 `cliff` | 암석 구덩이 좌하단`cliff` · 흙 구덩이 좌하단`cliff` | block-08-11 c9 r11 |
| 340 | 아랫단 그늘 돌 벽 `wall` | 암석 구덩이 하단 `cliff` | 암석 구덩이 하단`cliff` · 흙 구덩이 하단`cliff` | block-08-11 c10 r11 |
| 341 | 오른쪽 어두운 석관 `chest` | 암석 구덩이 우하단 `cliff` | 암석 구덩이 우하단`cliff` · 흙 구덩이 우하단`cliff` | block-08-11 c11 r11 |
| 342 | 흐르는 물길 1프레임 `water` | 눈 덮인 바닥 좌하단 `floor` | 눈밭 좌하단`floor` · 눈 덮인 바닥 좌하단`floor` | block-08-11 c12 r11 |
| 343 | 흐르는 물길 2프레임 `water` | 눈 덮인 바닥 하단 `floor` | 눈밭 하단`floor` · 눈 덮인 바닥 하단`floor` | block-08-11 c13 r11 |
| 344 | 흐르는 물길 3프레임 `water` | 눈 덮인 바닥 우하단 `floor` | 눈밭 우하단`floor` · 눈 덮인 바닥 우하단`floor` | block-08-11 c14 r11 |
| 345 | 물 위 디딤돌 다리 `bridge` | 눈사람 `prop` | 눈사람`prop` · 눈사람`prop` | block-08-11 c15 r11 |
| 346 | 물결지는 물 표면 1 `water` | 얼음 절벽 하단 좌측 `cliff` | 얼음 절벽 하단 좌측`cliff` · 빙벽 좌하단`cliff` | block-08-11 c16 r11 |
| 347 | 물결지는 물 표면 2 `water` | 얼음 절벽 하단 우측 `cliff` | 얼음 절벽 하단 우측`cliff` · 빙벽 우하단`cliff` | block-08-11 c17 r11 |
| 350 | 넓은 물웅덩이 `water` | 얼음 결정 좌하단 `rock` | 얼음 결정 좌하단`prop` · 얼음 결정 좌하단`rock` · 얼음 결정 좌하단`rock` | block-08-11 c20 r11 |
| 351 | 연못 물결 `water` | 얼음 결정 우하단 `rock` | 얼음 결정 우하단`prop` · 얼음 결정 우하단`rock` · 얼음 결정 우하단`rock` | block-08-11 c21 r11 |
| 354 | 갈색 뻘 바닥 `floor` | 목재 기둥 하단 `prop` | 목재 기둥 하단`prop` · 목재 기둥 하단`prop` | block-08-11 c24 r11 |
| 355 | 겹겹 바위 지형 `rock` | 동굴 입구 바닥 `floor` | 흙 언덕 통로 입구`stairs` · 동굴 입구 바닥`floor` · 흙더미`decoration` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 356 | 갈색 돌기 덩어리 `prop` | 둥근 목재 스툴 `furniture` | 둥근 목재 스툴`furniture` · 목재 스툴`furniture` | block-08-11 c26 r11 |
| 357 | 갈색 가시 덩어리 `prop` | 목재 의자 좌측면 `furniture` | 측면 나무 의자`furniture` · 목재 의자 좌측면`furniture` | block-08-11 c27 r11 |
| 358 | 갈색 돌무더기 `rock` | 목재 의자 우측면 `furniture` | 측면 나무 의자`furniture` · 목재 의자 우측면`furniture` | block-08-11 c28 r11 |
| 359 | 화려한 무늬 장식판 `decoration` | 목재 책장 하단 `furniture` | 목재 책장 하단`furniture` · 목재 책장 하단`furniture` | block-08-11 c29 r11 |
| 360 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c0 r12 |
| 361 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c1 r12 |
| 362 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c2 r12 |
| 363 | 이끼 낀 갈색 바닥 `floor` | 작은 덤불 상단 `plant` | 작은 덤불 상단`plant` · 풀 포기 난 흙 바닥`terrain` · 작은 덤불`plant` | block-12-15 c3 r12 |
| 364 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c4 r12 |
| 365 | 초록 이끼 바닥 `floor` | 큰 덤불 상단 `plant` | 큰 덤불 상단`plant` · 잔디 덮인 흙 바닥`terrain` · 작은 덤불`plant` | block-12-15 c5 r12 |
| 366 | 푸른 물웅덩이 `water` | 얼음 테두리 어두운 웅덩이 단일 타일 `water` | 얼음 웅덩이 단일 타일`water` · 얼음 테두리 어두운 구덩이(1칸)`terrain`* · 얼음 구덩이 테두리`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 367 | 짙은 파란 물 `water` | 얼음 테두리 어두운 웅덩이 가로 좌측 `water` | 얼음 웅덩이 상단 경계`water` · 얼음 테두리 어두운 구덩이 가로 조각`terrain`* · 얼음 구덩이 심연`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 368 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 가로 우측 `water` | 얼음 웅덩이 안쪽 모서리`water` · 얼음 테두리 어두운 구덩이 가로 오른쪽 끝`terrain`* · 얼음 구덩이 안쪽 모서리`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 369 | 돌 테두리 푸른 웅덩이 `water` | 돌 테두리 어두운 웅덩이 단일 타일 `water` | 어두운 돌 웅덩이 단일 타일`water` · 돌 테두리 어두운 구덩이(1칸)`terrain`* · 돌 구덩이 테두리`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 370 | 어두운 물구덩이 `water` | 돌 테두리 어두운 웅덩이 가로 좌측 `water` | 어두운 돌 웅덩이 상단 경계`water` · 돌 테두리 어두운 구덩이 가로 조각`terrain`* · 돌 구덩이 심연`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 371 | 돌 테두리 어두운 물 `water` | 돌 테두리 어두운 웅덩이 가로 우측 `water` | 어두운 돌 웅덩이 안쪽 모서리`water` · 돌 테두리 어두운 구덩이 가로 오른쪽 끝`terrain`* · 돌 구덩이 안쪽 모서리`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 372 | 잔물결 파란 물 `water` | 얼음 폭포 상단 좌측 `water` | 얼음 폭포 상단 좌측`water` · 얼음 결정 벽면 좌측 상단`wall` · 얼음 폭포 상단 1`water` | block-12-15 c12 r12 |
| 373 | 잔물결 파란 물 `water` | 얼음 폭포 상단 중앙 `water` | 얼음 폭포 상단 중앙`water` · 얼음 결정 벽면 중앙 상단`wall` · 얼음 폭포 상단 2`water` | block-12-15 c13 r12 |
| 374 | 잔물결 파란 물 `water` | 얼음 폭포 상단 우측 `water` | 얼음 폭포 상단 우측`water` · 얼음 결정 벽면 우측 상단`wall` · 얼음 폭포 상단 3`water` | block-12-15 c14 r12 |
| 375 | 파란 무늬 흰 얼음 `ice` | 얼음 벽 상단 좌측 `wall` | 얼음 벽 상단 좌측`wall` · 눈 덮인 얼음 지면 띠`terrain` · 얼음 벽 상단 좌측`wall` | block-12-15 c15 r12 |
| 376 | 파란 무늬 흰 얼음 `ice` | 얼음 벽 상단 중앙 `wall` | 얼음 벽 상단 중앙`wall` · 눈 덮인 얼음 지면 띠`terrain` · 얼음 벽 상단 중앙`wall` | block-12-15 c16 r12 |
| 377 | 파란 무늬 흰 얼음 `ice` | 얼음 벽 상단 우측 `wall` | 얼음 벽 상단 우측`wall` · 눈 덮인 얼음 지면 띠`terrain` · 얼음 벽 상단 우측`wall` | block-12-15 c17 r12 |
| 378 | 갈색 둥근 덩어리 `prop` | 붉은 광석 더미 좌측 `rock` | 용암 웅덩이 좌상단`water` · 붉은 광석 더미 왼쪽`rock` · 붉은 광석 더미 좌측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 379 | 갈색 둥근 덩어리 `prop` | 붉은 광석 더미 우측 `rock` | 용암 웅덩이 우상단`water` · 붉은 광석 더미 오른쪽`rock` · 붉은 광석 더미 우측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 380 | 갈색 덩어리 `prop` | 흙 더미 좌측 `prop` | 흙더미 좌상단`terrain` · 갈색 흙 더미 왼쪽`rock` · 흙더미 좌측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 381 | 갈색 덩어리 `prop` | 흙 더미 우측 `prop` | 흙더미 우상단`terrain` · 갈색 흙 더미 오른쪽`rock` · 흙더미 우측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 382 | 회색 둥근 바위 `rock` | 연녹색 광석 조각 무리 `rock` | 녹색 자갈 더미`rock` · 연녹색 광석 조각 무리`rock` | block-12-15 c22 r12 |
| 384 | 푸른 테두리 명판 `decoration` | 목재 침대 상단(머리판과 베개) `furniture` | 침대 머리맡 상단`furniture` · 목재 침대 상단(머리판과 베개)`furniture` | block-12-15 c24 r12 |
| 385 | 나무 판벽 `wall` | 목재 테이블 상단 좌측 `furniture` | 목재 테이블 상단 좌측`furniture` · 긴 목재 선반 왼쪽`furniture`* | block-12-15 c25 r12 |
| 386 | 나무 판벽 `wall` | 목재 테이블 상단 중앙좌측 `furniture` | 목재 테이블 상단 중앙좌측`furniture` · 긴 목재 선반 중앙`furniture`* | block-12-15 c26 r12 |
| 387 | 나무 판벽 `wall` | 목재 테이블 상단 중앙우측 `furniture` | 목재 테이블 상단 중앙우측`furniture` · 긴 목재 선반 오른쪽`furniture`* | block-12-15 c27 r12 |
| 388 | 나무 판벽 `wall` | 목재 테이블 상단 우측 `furniture` | 목재 테이블 상단 우측`furniture` · 짧은 목재 선반`furniture`* | block-12-15 c28 r12 |
| 389 | 나무 상자 `chest` | 목재 서랍장 `chest` | 목재 협탁`furniture` · 목재 서랍장`furniture` | block-12-15 c29 r12 |
| 390 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c0 r13 |
| 391 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c1 r13 |
| 392 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c2 r13 |
| 393 | 초록 이끼 바닥 `floor` | 큰 덤불 상단 좌측 `plant` | 덤불 숲 좌상단`plant` · 잔디 지면 좌측 상단`terrain` · 큰 덤불 상단 좌측`plant` | block-12-15 c3 r13 |
| 394 | 초록 이끼 바닥 `floor` | 덤불 숲 상단 중앙 `plant` | 덤불 숲 상단 중앙`plant` · 잔디 지면 중앙 상단`terrain` · 큰 덤불 상단 중앙`plant` | block-12-15 c4 r13 |
| 395 | 초록 이끼 바닥 `floor` | 큰 덤불 상단 우측 `plant` | 덤불 숲 우상단`plant` · 잔디 지면 우측 상단`terrain` · 큰 덤불 상단 우측`plant` | block-12-15 c5 r13 |
| 396 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 상단 좌측 `water` | 얼음 웅덩이 좌상단 모서리`water` · 얼음 테두리 어두운 구덩이 좌상단`terrain`* · 얼음 구덩이 좌상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 397 | 짙은 파란 물 `water` | 얼음 테두리 어두운 웅덩이 상단 중앙 `water` | 얼음 웅덩이 상단 테두리`water` · 얼음 테두리 어두운 구덩이 상단`terrain`* · 얼음 구덩이 상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 398 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 상단 우측 `water` | 얼음 웅덩이 우상단 모서리`water` · 얼음 테두리 어두운 구덩이 우상단`terrain`* · 얼음 구덩이 우상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 399 | 돌 테두리 푸른 웅덩이 `water` | 돌 테두리 어두운 웅덩이 상단 좌측 `water` | 어두운 돌 웅덩이 좌상단 모서리`water` · 돌 테두리 어두운 구덩이 좌상단`terrain`* · 돌 구덩이 좌상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 400 | 어두운 물구덩이 `water` | 돌 테두리 어두운 웅덩이 상단 중앙 `water` | 어두운 돌 웅덩이 상단 테두리`water` · 돌 테두리 어두운 구덩이 상단`terrain`* · 돌 구덩이 상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 401 | 돌 테두리 어두운 물 `water` | 돌 테두리 어두운 웅덩이 상단 우측 `water` | 어두운 돌 웅덩이 우상단 모서리`water` · 돌 테두리 어두운 구덩이 우상단`terrain`* · 돌 구덩이 우상단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 402 | 잔물결 파란 물 `water` | 얼음 폭포 하단 좌측 `water` | 얼음 폭포 하단 좌측`water` · 얼음 결정 벽면 좌측 하단`wall` · 얼음 폭포 하단 1`water` | block-12-15 c12 r13 |
| 403 | 잔물결 파란 물 `water` | 얼음 폭포 하단 중앙 `water` | 얼음 폭포 하단 중앙`water` · 얼음 결정 벽면 중앙 하단`wall` · 얼음 폭포 하단 2`water` | block-12-15 c13 r13 |
| 404 | 잔물결 파란 물 `water` | 얼음 폭포 하단 우측 `water` | 얼음 폭포 하단 우측`water` · 얼음 결정 벽면 우측 하단`wall` · 얼음 폭포 하단 3`water` | block-12-15 c14 r13 |
| 405 | 왼편 그늘 어두운 돌벽 `rock` | 어두운 던전 벽 상단 좌측 `wall` | 어두운 던전 벽 상단 좌측`wall` · 어두운 청석 벽 좌상단`wall` | block-12-15 c15 r13 |
| 406 | 어두운 돌 블록 `rock` | 어두운 던전 벽 상단 중앙 `wall` | 어두운 던전 벽 상단 중앙`wall` · 어두운 청석 벽 상단 중앙`wall` | block-12-15 c16 r13 |
| 407 | 오른편 그늘 어두운 돌벽 `rock` | 어두운 던전 벽 상단 우측 `wall` | 어두운 던전 벽 상단 우측`wall` · 어두운 청석 벽 우상단`wall` | block-12-15 c17 r13 |
| 408 | 흰 뾰족 암석 `rock` | 눈 더미 좌측 `prop` | 눈더미 좌상단`terrain` · 눈 더미 왼쪽`rock` · 눈더미 좌측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 409 | 흰 뾰족 바위 조각 `rock` | 눈 더미 우측 `prop` | 눈더미 우상단`terrain` · 눈 더미 오른쪽`rock` · 눈더미 우측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 410 | 어두운 뾰족 암석 `rock` | 검은 광석 더미 좌측 `rock` | 어두운 모래더미 좌상단`terrain` · 검은 흙 더미 왼쪽`rock` · 석탄 더미 좌측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 411 | 어두운 뾰족 바위 조각 `rock` | 검은 광석 더미 우측 `rock` | 어두운 모래더미 우상단`terrain` · 검은 흙 더미 오른쪽`rock` · 석탄 더미 우측`prop` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 412 | 불 붙은 화로 `torch` | 갈색 암석 덩어리 `rock` | 갈색 암석 덩어리`rock` · 갈색 바위 무더기`rock` | block-12-15 c22 r13 |
| 413 | 푸른 뾰족 장식 `decoration` | 얼음 결정 파편 `rock` | 얼음 결정 파편`rock` · 얼음 결정 무리`rock` | block-12-15 c23 r13 |
| 414 | 푸른 테 흰 문 `door` | 목재 침대 하단(이불과 발판) `furniture` | 세로 침대 하단`furniture` · 목재 침대 하단(이불과 발판)`furniture` | block-12-15 c24 r13 |
| 415 | 어두운 문틀 문 `door` | 가로 목재 침대 왼쪽(베개) `furniture` | 가로 침대 좌측 머리맡`furniture` · 가로 목재 침대 왼쪽(베개)`furniture` | block-12-15 c25 r13 |
| 416 | 흰 돌 기둥 `pillar` | 가로 목재 침대 오른쪽 `furniture` | 가로 침대 우측 발치`furniture` · 가로 목재 침대 오른쪽`furniture` | block-12-15 c26 r13 |
| 417 | 주황 장식 기둥 `pillar` | 테 두른 나무 물통 `pillar` | 나무 통`prop` · 테 두른 나무 물통`prop` | block-12-15 c27 r13 |
| 419 | 갈색 돌멩이 `rock` | 나무 스툴 의자 `furniture` | 나무 스툴 의자`furniture` · 작은 나무 통`prop` · 나무 스툴`furniture` | block-12-15 c29 r13 |
| 420 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c0 r14 |
| 421 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c1 r14 |
| 422 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c2 r14 |
| 423 | 초록 이끼 바닥 `floor` | 덤불 숲 좌측 가장자리 `plant` | 덤불 숲 좌측 가장자리`plant` · 잔디 지면 좌측 중앙`terrain` · 큰 덤불 중앙 좌측`plant` | block-12-15 c3 r14 |
| 424 | 초록 이끼 바닥 `floor` | 덤불 숲 내부 `plant` | 덤불 숲 내부`plant` · 잔디 지면 중앙`terrain` · 큰 덤불 중앙`plant` | block-12-15 c4 r14 |
| 425 | 초록 이끼 바닥 `floor` | 덤불 숲 우측 가장자리 `plant` | 덤불 숲 우측 가장자리`plant` · 잔디 지면 우측 중앙`terrain` · 큰 덤불 중앙 우측`plant` | block-12-15 c5 r14 |
| 426 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 중간 좌측 `water` | 얼음 웅덩이 좌측 테두리`water` · 얼음 테두리 어두운 구덩이 좌측`terrain`* · 얼음 구덩이 좌측`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 427 | 짙은 파란 물 `water` | 얼음 테두리 어두운 웅덩이 내부 `water` | 얼음 웅덩이 내부 수면`water` · 얼음 테두리 어두운 구덩이 내부`terrain`* · 얼음 구덩이 심연 중앙`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 428 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 중간 우측 `water` | 얼음 웅덩이 우측 테두리`water` · 얼음 테두리 어두운 구덩이 우측`terrain`* · 얼음 구덩이 우측`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 429 | 돌 테두리 푸른 웅덩이 `water` | 돌 테두리 어두운 웅덩이 중간 좌측 `water` | 어두운 돌 웅덩이 좌측 테두리`water` · 돌 테두리 어두운 구덩이 좌측`terrain`* · 돌 구덩이 좌측`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 430 | 어두운 물구덩이 `water` | 돌 테두리 어두운 웅덩이 내부 `water` | 어두운 돌 웅덩이 내부 수면`water` · 돌 테두리 어두운 구덩이 내부`terrain`* · 돌 구덩이 심연 중앙`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 431 | 돌 테두리 어두운 물 `water` | 돌 테두리 어두운 웅덩이 중간 우측 `water` | 어두운 돌 웅덩이 우측 테두리`water` · 돌 테두리 어두운 구덩이 우측`terrain`* · 돌 구덩이 우측`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 432 | 낡은 돌 벽돌 벽면 `wall` | 조약돌 바닥 경계 좌측 `floor` | 돌길 모서리 좌상단`floor` · 회색 자갈 돌벽 좌상단`wall` · 조약돌 바닥 경계 좌측`floor` | block-12-15 c12 r14 |
| 433 | 낡은 돌 벽돌 벽면 `wall` | 조약돌 바닥 경계 우측 `floor` | 돌길 모서리 우상단`floor` · 회색 자갈 돌벽 상단 중앙`wall` · 조약돌 바닥 경계 우측`floor` | block-12-15 c13 r14 |
| 434 | 회색 돌 벽돌 벽면 `wall` | 조약돌 바닥 `floor` | 조약돌 바닥`floor` · 회색 자갈 돌벽 우상단`wall` · 조약돌 바닥`floor` | block-12-15 c14 r14 |
| 435 | 왼편 그늘 남청 돌벽 `rock` | 어두운 던전 벽 하단 좌측 `wall` | 어두운 던전 벽 하단 좌측`wall` · 어두운 청석 벽 좌측 중앙`wall` | block-12-15 c15 r14 |
| 437 | 오른편 그늘 남청 돌벽 `rock` | 어두운 던전 벽 하단 우측 `wall` | 어두운 던전 벽 하단 우측`wall` · 어두운 청석 벽 우측 중앙`wall` | block-12-15 c17 r14 |
| 438 | 회색 돌 경계 벽 `wall` | 대형 비석 상단 좌측 `prop` | 대형 비석 상단 좌측`prop` · 새김글 비석 좌상단`prop` | block-12-15 c18 r14 |
| 439 | 회청색 돌 벽면 `wall` | 새김글 비석 상단 중앙 `prop` | 대형 비석 상단 중앙`prop` · 새김글 비석 상단 중앙`prop` | block-12-15 c19 r14 |
| 440 | 회색 돌 경계 벽 `wall` | 대형 비석 상단 우측 `prop` | 대형 비석 상단 우측`prop` · 새김글 비석 우상단`prop` | block-12-15 c20 r14 |
| 444 | 나무 살대 울타리 좌 `fence` | 아치형 이중문 아치 좌상단 `door` | 돌계단 상단 좌측`stairs` · 아치형 목재 이중문 좌상단`door` · 파이프 오르간 상단 좌측`furniture` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 445 | 나무 살대 울타리 우 `fence` | 아치형 이중문 아치 우상단 `door` | 돌계단 상단 우측`stairs` · 아치형 목재 이중문 우상단`door` · 파이프 오르간 상단 우측`furniture` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 450 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c0 r15 |
| 451 | 갈색 흙 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c1 r15 |
| 452 | 갈색 흙돌 바닥 `floor` | 갈색 흙 바닥 `terrain` | 갈색 흙 바닥`terrain` · 갈색 흙 바닥`terrain` | block-12-15 c2 r15 |
| 453 | 초록 이끼 바닥 `floor` | 큰 덤불 하단 좌측 `plant` | 덤불 숲 좌하단`plant` · 잔디 지면 좌측 하단`terrain` · 큰 덤불 하단 좌측`plant` | block-12-15 c3 r15 |
| 454 | 초록 이끼 바닥 `floor` | 덤불 숲 하단 중앙 `plant` | 덤불 숲 하단 중앙`plant` · 잔디 지면 중앙 하단`terrain` · 큰 덤불 하단 중앙`plant` | block-12-15 c4 r15 |
| 455 | 초록 이끼 바닥 `floor` | 큰 덤불 하단 우측 `plant` | 덤불 숲 우하단`plant` · 잔디 지면 우측 하단`terrain` · 큰 덤불 하단 우측`plant` | block-12-15 c5 r15 |
| 456 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 하단 좌측 `water` | 얼음 웅덩이 좌하단 모서리`water` · 얼음 테두리 어두운 구덩이 좌하단`terrain`* · 얼음 구덩이 좌하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 457 | 짙은 파란 물 `water` | 얼음 테두리 어두운 웅덩이 하단 중앙 `water` | 얼음 웅덩이 하단 테두리`water` · 얼음 테두리 어두운 구덩이 하단`terrain`* · 얼음 구덩이 하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 458 | 가장자리 파란 물 `water` | 얼음 테두리 어두운 웅덩이 하단 우측 `water` | 얼음 웅덩이 우하단 모서리`water` · 얼음 테두리 어두운 구덩이 우하단`terrain`* · 얼음 구덩이 우하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 459 | 돌 테두리 푸른 웅덩이 `water` | 돌 테두리 어두운 웅덩이 하단 좌측 `water` | 어두운 돌 웅덩이 좌하단 모서리`water` · 돌 테두리 어두운 구덩이 좌하단`terrain`* · 돌 구덩이 좌하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 460 | 어두운 물구덩이 `water` | 돌 테두리 어두운 웅덩이 하단 중앙 `water` | 어두운 돌 웅덩이 하단 테두리`water` · 돌 테두리 어두운 구덩이 하단`terrain`* · 돌 구덩이 하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 461 | 돌 테두리 어두운 물 `water` | 돌 테두리 어두운 웅덩이 하단 우측 `water` | 어두운 돌 웅덩이 우하단 모서리`water` · 돌 테두리 어두운 구덩이 우하단`terrain`* · 돌 구덩이 우하단`cliff` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 462 | 낡은 돌 벽돌 벽면 `wall` | 조약돌 바닥 1 `floor` | 돌길 바닥`floor` · 회색 자갈 돌벽 좌하단`wall` · 조약돌 바닥 1`floor` | block-12-15 c12 r15 |
| 463 | 낡은 돌 벽돌 벽면 `wall` | 조약돌 바닥 2 `floor` | 돌길 바닥`floor` · 회색 자갈 돌벽 하단 중앙`wall` · 조약돌 바닥 2`floor` | block-12-15 c13 r15 |
| 464 | 어두운 돌 벽돌 벽면 `wall` | 어두운 조약돌 바닥 `floor` | 조약돌 바닥`floor` · 회색 자갈 돌벽 우하단`wall` · 어두운 조약돌 바닥`floor` | block-12-15 c14 r15 |
| 465 | 왼편 그늘 회색 돌벽 `rock` | 어두운 던전 벽 하단 바닥 좌측 `wall` | 어두운 던전 벽 하단 바닥 좌측`wall` · 어두운 청석 벽 좌하단`wall` | block-12-15 c15 r15 |
| 466 | 어두운 돌 블록 `rock` | 어두운 던전 벽 하단 바닥 중앙 `wall` | 어두운 던전 벽 하단 바닥 중앙`wall` · 어두운 청석 벽 하단 중앙`wall` | block-12-15 c16 r15 |
| 467 | 오른편 그늘 회색 돌벽 `rock` | 어두운 던전 벽 하단 바닥 우측 `wall` | 어두운 던전 벽 하단 바닥 우측`wall` · 어두운 청석 벽 우하단`wall` | block-12-15 c17 r15 |
| 468 | 회색 돌 경계 벽 `wall` | 대형 비석 하단 좌측 `prop` | 대형 비석 하단 좌측`prop` · 새김글 비석 좌하단`prop` | block-12-15 c18 r15 |
| 469 | 회청색 돌 벽면 `wall` | 새김글 비석 하단 중앙(비문) `prop` | 대형 비석 하단 중앙`prop` · 새김글 비석 하단 중앙(비문)`prop` | block-12-15 c19 r15 |
| 470 | 회색 돌 경계 벽 `wall` | 대형 비석 하단 우측 `prop` | 대형 비석 하단 우측`prop` · 새김글 비석 우하단`prop` | block-12-15 c20 r15 |
| 472 | 갈색 격자 원형 문양 `decoration` | 촛불 수레바퀴 샹들리에 하단 중앙 `decoration` | 샹들리에 하단 중앙`decoration` · 촛불 수레바퀴 샹들리에 하단 중앙`decoration` | block-12-15 c22 r15 |
| 474 | 밝은 나무 살대 좌 `fence` | 아치형 이중문 좌하단 `door` | 돌계단 하단 좌측`stairs` · 아치형 목재 이중문 좌하단`door` · 파이프 오르간 하단 좌측`furniture` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |
| 475 | 밝은 나무 살대 우 `fence` | 아치형 이중문 우하단 `door` | 돌계단 하단 우측`stairs` · 아치형 목재 이중문 우하단`door` · 파이프 오르간 하단 우측`furniture` | **사람 확정** (adj-retro_dungeon-r12-15-c18-25.png, fin-retro_dungeon-r0-1-c16-21.png, fin-retro_dungeon-r6-9-c24-29.png, fin-retro_dungeon-r9-11-c23-28.png, split2-dungeon-r1215-c0615.png, split2-dungeon-r1215-c1625.png) |

## retro_exterior — 교정 384칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 0 | 바닷가 물가 애니메이션 `coast` | 물가 상단 프레임 1 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 1`water` | block-00-03 c0 r0 |
| 1 | 바닷가 물가 애니메이션 `coast` | 물가 상단 프레임 2 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 2`water` | block-00-03 c1 r0 |
| 2 | 바닷가 물가 애니메이션 `coast` | 물가 상단 프레임 3 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 3`water` | block-00-03 c2 r0 |
| 3 | 바다 물결 애니메이션 `water` | 석조 수로 상단 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 1`water` | block-00-03 c3 r0 |
| 4 | 바다 물결 애니메이션 `water` | 석조 수로 상단 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 2`water` | block-00-03 c4 r0 |
| 5 | 바다 물결 애니메이션 `water` | 석조 수로 상단 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 3`water` | block-00-03 c5 r0 |
| 6 | 잔디 위 회백색 바위 `rock` | 잔디 위 작은 눈밭 `terrain` | 눈 덮인 잔디`terrain` · 눈 덮인 잔디`terrain` · 눈`terrain` · 잔디 위 작은 눈밭`terrain` | block-00-03 c6 r0 |
| 8 | 하얀 벽면 `wall` | 잔디 위 둥근 눈밭 `terrain` | 눈밭`terrain` · 눈밭 상단`terrain` · 눈`terrain` · 잔디 위 둥근 눈밭`terrain` | block-00-03 c8 r0 |
| 11 | 붉은 열매 나무 `tree` | 잔디 위 둥근 덤불 `tree` | 짙은 수풀`plant` · 덤불`plant` · 관목`plant` · 잔디 위 둥근 덤불`plant` | block-00-03 c11 r0 |
| 12 | 갈아엎은 흙밭 `terrain` | 목조 벽돌벽 상단 좌측 보 `wall` | 목조 기둥 상단`wall` · 목조 벽돌 벽 상단 좌측`wall` · 목조 보`wall` · 목조 벽돌벽 상단 좌측 보`wall` | block-00-03 c12 r0 |
| 13 | 이랑이 진 흙밭 `terrain` | 목조 벽돌벽 상단 중앙 보 `wall` | 목조 보 상단`wall` · 목조 벽돌 벽 상단 중앙`wall` · 목조 보`wall` · 목조 벽돌벽 상단 중앙 보`wall` | block-00-03 c13 r0 |
| 14 | 거친 흙밭 `terrain` | 목조 벽돌벽 상단 우측 보 `wall` | 목조 기둥 상단`wall` · 목조 벽돌 벽 상단 우측`wall` · 목조 보`wall` · 목조 벽돌벽 상단 우측 보`wall` | block-00-03 c14 r0 |
| 15 | 흙과 모래 땅 (상단) `sand` | 목조 회벽 상단 좌측 보 `wall` | 목조 기둥 상단`wall` · 목조 회벽 상단 좌측`wall` · 목조 보`wall` · 목조 회벽 상단 좌측 보`wall` | block-00-03 c15 r0 |
| 16 | 모래밭 (상하 흙 경계) `sand` | 목조 회벽 상단 중앙 보 `wall` | 목조 보 상단`wall` · 목조 회벽 상단 중앙`wall` · 목조 보`wall` · 목조 회벽 상단 중앙 보`wall` | block-00-03 c16 r0 |
| 17 | 모래밭 (모서리 흙) `sand` | 목조 회벽 상단 우측 보 `wall` | 목조 기둥 상단`wall` · 목조 회벽 상단 우측`wall` · 목조 보`wall` · 목조 회벽 상단 우측 보`wall` | block-00-03 c17 r0 |
| 18 | 물 가장자리 (우측 물결) `water` | 석조 아치문 상단 좌측 `wall` | 성벽 흉벽 좌측`wall` · 석조 난간 상단 좌측`wall` · 석조 문기둥`gate` · 석조 아치문 상단 좌측`wall` | block-00-03 c18 r0 |
| 19 | 물 가장자리 (좌우 물결) `water` | 석조 아치문 상단 중앙 `wall` | 성문 상부 아치`wall` · 성벽 다리 통로 상단`wall` · 석조 대문 상부`gate` · 석조 아치문 상단 중앙`wall` | block-00-03 c19 r0 |
| 20 | 물 가장자리 (좌측 물결) `water` | 석조 아치문 상단 우측 `wall` | 성벽 흉벽 우측`wall` · 석조 난간 상단 우측`wall` · 석조 문기둥`gate` · 석조 아치문 상단 우측`wall` | block-00-03 c20 r0 |
| 21 | 잔잔한 수면 (얼룩) `water` | 어두운 석벽 상단 좌측 `wall` | 돌벽 상단 좌측`wall` · 석벽 상단 좌측`wall` · 돌벽 갓돌`wall` · 어두운 석벽 상단 좌측`wall` | block-00-03 c21 r0 |
| 22 | 잔물결 수면 `water` | 어두운 석벽 상단 중앙 `wall` | 돌벽 상단 중앙`wall` · 석벽 상단 중앙`wall` · 돌벽 갓돌`wall` · 어두운 석벽 상단 중앙`wall` | block-00-03 c22 r0 |
| 23 | 잔잔한 바닷물 `water` | 어두운 석벽 상단 우측 `wall` | 돌벽 상단 우측`wall` · 석벽 상단 우측`wall` · 돌벽 끝 기둥`wall` · 어두운 석벽 상단 우측`wall` | block-00-03 c23 r0 |
| 24 | 물가 절벽 (잔디 끝) `cliff` | 원형 돌 우물 상단 좌측 `prop` | 원형 돌 우물 상단 좌측`prop` · 우물 상단 좌측`prop` · 돌 우물`prop` · 석조 우물 상단 좌측`prop` | block-00-03 c24 r0 |
| 25 | 물가 땅 끝 (잔디) `cliff` | 원형 돌 우물 상단 우측 `prop` | 원형 돌 우물 상단 우측`prop` · 우물 상단 우측`prop` · 돌 우물`prop` · 석조 우물 상단 우측`prop` | block-00-03 c25 r0 |
| 26 | 물가 푸른 덤불 `tree` | 석조 화덕 상단 좌측 `prop` | 석조 화덕 상단 좌측`prop` · 석조 화덕 상단 좌측`prop` · 돌 구덩이`prop`* · 어두운 암석 좌측`rock` | block-00-03 c26 r0 |
| 27 | 물가 잔디 절벽 `cliff` | 석조 화덕 상단 우측 `prop` | 석조 화덕 상단 우측`prop` · 석조 화덕 상단 우측`prop` · 돌 구덩이`prop`* · 어두운 암석 우측`rock` | block-00-03 c27 r0 |
| 28 | 물 위 초록 섬 `tree` | 묘비 `prop` | 묘비`prop` · 묘비`prop` · 묘비`prop` · 묘비`prop` | block-00-03 c28 r0 |
| 30 | 바닷가 물가 애니메이션 `coast` | 세로 수로 물 프레임 1 `coast` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 1`water` | block-00-03 c0 r1 |
| 31 | 바닷가 물가 애니메이션 `coast` | 세로 수로 물 프레임 2 `coast` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 2`water` | block-00-03 c1 r1 |
| 32 | 바닷가 물가 애니메이션 `coast` | 세로 수로 물 프레임 3 `coast` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 3`water` | block-00-03 c2 r1 |
| 33 | 바다 물결 애니메이션 `water` | 석조 세로 수로 물 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 1`water` | block-00-03 c3 r1 |
| 34 | 바다 물결 애니메이션 `water` | 석조 세로 수로 물 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 2`water` | block-00-03 c4 r1 |
| 35 | 바다 물결 애니메이션 `water` | 석조 세로 수로 물 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 3`water` | block-00-03 c5 r1 |
| 36 | 흰 벽 (위 잔디) `wall` | 눈밭 가장자리 좌상단 `terrain` | 눈밭 가장자리 좌상단`terrain` · 눈밭 가장자리 좌상단`terrain` · 눈`terrain` · 눈밭 좌상단`terrain` | block-00-03 c6 r1 |
| 37 | 흰 벽 (잔디 가장자리) `wall` | 눈밭 가장자리 상단 `terrain` | 눈밭 가장자리 상단`terrain` · 눈밭 가장자리 상단`terrain` · 눈`terrain` · 눈밭 상단`terrain` | block-00-03 c7 r1 |
| 38 | 흰 벽 (우하 잔디) `wall` | 눈밭 가장자리 우상단 `terrain` | 눈밭 가장자리 우상단`terrain` · 눈밭 가장자리 우상단`terrain` · 눈`terrain` · 눈밭 우상단`terrain` | block-00-03 c8 r1 |
| 39 | 붉은 열매 나무 `tree` | 덤불 가장자리 좌상단 `tree` | 숲 캐노피 좌상단`plant` · 덤불 가장자리 좌상단`plant` · 덤불`plant` · 덤불 좌상단`plant` | block-00-03 c9 r1 |
| 40 | 울창한 나무 `tree` | 덤불 가장자리 상단 `tree` | 숲 캐노피 상단`plant` · 덤불 가장자리 상단`plant` · 덤불`plant` · 덤불 상단`plant` | block-00-03 c10 r1 |
| 41 | 빽빽한 나무 수풀 `tree` | 덤불 가장자리 우상단 `tree` | 숲 캐노피 우상단`plant` · 덤불 가장자리 우상단`plant` · 덤불`plant` · 덤불 우상단`plant` | block-00-03 c11 r1 |
| 42 | 흙 경작지 `terrain` | 목조 벽돌벽 중간 좌측 기둥 `wall` | 목조 기둥 석벽 좌측`wall` · 목조 벽돌 벽 좌측`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 좌측 기둥`wall` | block-00-03 c12 r1 |
| 43 | 트인 흙밭 `terrain` | 목조 벽돌벽 중간 벽돌 `wall` | 석조 벽`wall` · 벽돌 벽 중앙`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 벽돌`wall` | block-00-03 c13 r1 |
| 44 | 흙 비탈 경작지 `terrain` | 목조 벽돌벽 중간 우측 기둥 `wall` | 목조 기둥 석벽 우측`wall` · 목조 벽돌 벽 우측`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 우측 기둥`wall` | block-00-03 c14 r1 |
| 45 | 모래밭 (좌측 흙) `sand` | 목조 회벽 중간 좌측 기둥 `wall` | 목조 기둥 회벽 좌측`wall` · 목조 회벽 좌측`wall` · 회벽`wall` · 목조 회벽 중간 좌측 기둥`wall` | block-00-03 c15 r1 |
| 46 | 평평한 모래밭 `sand` | 목조 회벽 중간 회벽 `wall` | 회반죽 벽`wall` · 회벽 중앙`wall` · 회벽`wall` · 목조 회벽 중간 회벽`wall` | block-00-03 c16 r1 |
| 47 | 모래밭 (우측 흙) `sand` | 목조 회벽 중간 우측 기둥 `wall` | 목조 기둥 회벽 우측`wall` · 목조 회벽 우측`wall` · 회벽`wall` · 목조 회벽 중간 우측 기둥`wall` | block-00-03 c17 r1 |
| 48 | 물가 포말 (우측) `water` | 석조 아치문 좌측 기둥 `wall` | 성문 통로 좌측 벽`wall` · 석조 난간 좌측`wall` · 석조 문기둥`gate` · 석조 아치문 좌측 기둥`wall` | block-00-03 c18 r1 |
| 49 | 거친 회색 돌절벽 `cliff` | 석조 아치문 통로 바닥 상단 `floor` | 성문 통로 바닥`floor` · 성벽 다리 바닥`floor` · 문짝`gate`* · 석조 아치문 통로 바닥 상단`floor` | block-00-03 c19 r1 |
| 50 | 물가 포말 (좌측) `water` | 석조 아치문 우측 기둥 `wall` | 성문 통로 우측 벽`wall` · 석조 난간 우측`wall` · 석조 문기둥`gate` · 석조 아치문 우측 기둥`wall` | block-00-03 c20 r1 |
| 51 | 새파란 바닷물 `water` | 어두운 석벽 중간 좌측 `wall` | 돌벽 좌측`wall` · 석벽 좌측`wall` · 돌벽`wall` · 어두운 석벽 중간 좌측`wall` | block-00-03 c21 r1 |
| 52 | 푸른 수면 `water` | 어두운 석벽 중간 `wall` | 돌벽 중앙`wall` · 석벽 중앙`wall` · 돌벽`wall` · 어두운 석벽 중간`wall` | block-00-03 c22 r1 |
| 53 | 깊고 잔잔한 바다 `water` | 어두운 석벽 중간 우측 `wall` | 돌벽 우측`wall` · 석벽 우측`wall` · 돌벽 끝 기둥`wall` · 어두운 석벽 중간 우측`wall` | block-00-03 c23 r1 |
| 54 | 물가 구석 (우하 모서리) `water` | 원형 돌 우물 하단 좌측 `prop` | 원형 돌 우물 하단 좌측`prop` · 우물 하단 좌측`prop` · 돌 우물`prop` · 석조 우물 하단 좌측`prop` | block-00-03 c24 r1 |
| 55 | 물가 구석 (좌상 모서리) `water` | 원형 돌 우물 하단 우측 `prop` | 원형 돌 우물 하단 우측`prop` · 우물 하단 우측`prop` · 돌 우물`prop` · 석조 우물 하단 우측`prop` | block-00-03 c25 r1 |
| 56 | 물가 구석 (우하 파임) `water` | 눈 덮인 석조 우물 하단 좌측 `prop` | 석조 화덕 하단 좌측`prop` · 석조 화덕 하단 좌측`prop` · 돌 구덩이`prop`* · 눈 덮인 석조 우물 하단 좌측`prop` | block-00-03 c26 r1 |
| 57 | 물가 구석 (좌상 파임) `water` | 눈 덮인 석조 우물 하단 우측 `prop` | 석조 화덕 하단 우측`prop` · 석조 화덕 하단 우측`prop` · 돌 구덩이`prop`* · 눈 덮인 석조 우물 하단 우측`prop` | block-00-03 c27 r1 |
| 58 | 물 위 작은 덤불 `tree` | 철제 격자문 `gate` | 철제 격자문`gate` · 철창 문`gate` · 철창`prop` · 철창문`door` | block-00-03 c28 r1 |
| 59 | 회색 돌멩이 `rock` | 작은 돌과 자갈 `rock` | 작은 돌과 자갈`rock` · 작은 돌더미`rock` · 자수정 결정`rock` · 작은 광석 더미`rock` | block-00-03 c29 r1 |
| 60 | 바닷가 물가 애니메이션 `coast` | 가로 수로 물 프레임 1 `coast` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 1`water` | block-00-03 c0 r2 |
| 61 | 바닷가 물가 애니메이션 `coast` | 가로 수로 물 프레임 2 `coast` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 2`water` | block-00-03 c1 r2 |
| 62 | 바닷가 물가 애니메이션 `coast` | 가로 수로 물 프레임 3 `coast` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 3`water` | block-00-03 c2 r2 |
| 63 | 바다 물결 애니메이션 `water` | 석조 가로 수로 물 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 1`water` | block-00-03 c3 r2 |
| 64 | 바다 물결 애니메이션 `water` | 석조 가로 수로 물 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 2`water` | block-00-03 c4 r2 |
| 65 | 바다 물결 애니메이션 `water` | 석조 가로 수로 물 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 3`water` | block-00-03 c5 r2 |
| 66 | 흰 벽 (좌상 잔디) `wall` | 눈밭 가장자리 좌측 `terrain` | 눈밭 가장자리 좌측`terrain` · 눈밭 가장자리 좌측`terrain` · 눈`terrain` · 눈밭 좌측`terrain` | block-00-03 c6 r2 |
| 67 | 새하얀 벽 `wall` | 눈밭 중앙 `terrain` | 눈 바닥`terrain` · 눈밭`terrain` · 눈`terrain` · 눈밭 중앙`terrain` | block-00-03 c7 r2 |
| 68 | 흰 벽 (우측 잔디) `wall` | 눈밭 가장자리 우측 `terrain` | 눈밭 가장자리 우측`terrain` · 눈밭 가장자리 우측`terrain` · 눈`terrain` · 눈밭 우측`terrain` | block-00-03 c8 r2 |
| 69 | 무성한 나무 `tree` | 덤불 가장자리 좌측 `tree` | 숲 캐노피 좌측`plant` · 덤불 가장자리 좌측`plant` · 덤불`plant` · 덤불 좌측`plant` | block-00-03 c9 r2 |
| 70 | 큰 나무 수풀 `tree` | 숲 캐노피 중앙 `tree` | 숲 캐노피 중앙`plant` · 덤불`plant` · 덤불`plant` · 덤불 중앙`plant` | block-00-03 c10 r2 |
| 71 | 붉은 열매 수풀 `tree` | 덤불 가장자리 우측 `tree` | 숲 캐노피 우측`plant` · 덤불 가장자리 우측`plant` · 덤불`plant` · 덤불 우측`plant` | block-00-03 c11 r2 |
| 72 | 마른 흙밭 `terrain` | 목조 벽돌벽 하단 좌측 기둥 `wall` | 목조 기둥 석벽 좌측`wall` · 목조 벽돌 벽 하단 좌측`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 좌측 기둥`wall` | block-00-03 c12 r2 |
| 73 | 흙과 모래 섞인 밭 `terrain` | 목조 벽돌벽 하단 벽돌 `wall` | 석조 벽`wall` · 벽돌 벽 하단 중앙`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 벽돌`wall` | block-00-03 c13 r2 |
| 74 | 새로 간 흙밭 `terrain` | 목조 벽돌벽 하단 우측 기둥 `wall` | 목조 기둥 석벽 우측`wall` · 목조 벽돌 벽 하단 우측`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 우측 기둥`wall` | block-00-03 c14 r2 |
| 75 | 모래밭 (좌측 흙 경계) `sand` | 목조 회벽 하단 좌측 기둥 `wall` | 목조 기둥 회벽 좌측`wall` · 목조 회벽 하단 좌측`wall` · 회벽`wall` · 목조 회벽 하단 좌측 기둥`wall` | block-00-03 c15 r2 |
| 76 | 너른 모래밭 `sand` | 목조 회벽 하단 회벽 `wall` | 회반죽 벽`wall` · 회벽 하단 중앙`wall` · 회벽`wall` · 목조 회벽 하단 회벽`wall` | block-00-03 c16 r2 |
| 77 | 모래밭 (우측 흙 경계) `sand` | 목조 회벽 하단 우측 기둥 `wall` | 목조 기둥 회벽 우측`wall` · 목조 회벽 하단 우측`wall` · 회벽`wall` · 목조 회벽 하단 우측 기둥`wall` | block-00-03 c17 r2 |
| 78 | 물 가장자리 (포말) `water` | 석조 아치문 하단 좌측 기둥 `wall` | 성문 하단 좌측 벽`wall` · 성벽 다리 기둥 좌측`wall` · 석조 문기둥`gate` · 석조 아치문 하단 좌측 기둥`wall` | block-00-03 c18 r2 |
| 79 | 이끼 낀 돌절벽 `cliff` | 석조 아치문 통로 바닥 하단 `floor` | 성문 바닥 통로`floor` · 다리 밑 통로`floor` · 문짝 아래`gate`* · 석조 아치문 통로 바닥 하단`floor` | block-00-03 c19 r2 |
| 80 | 물가 파도 물결 `water` | 석조 아치문 하단 우측 기둥 `wall` | 성문 하단 우측 벽`wall` · 성벽 다리 기둥 우측`wall` · 석조 문기둥`gate` · 석조 아치문 하단 우측 기둥`wall` | block-00-03 c20 r2 |
| 81 | 푸른 물 (얼룩) `water` | 어두운 석벽 하단 좌측 `wall` | 돌벽 하단 좌측`wall` · 석벽 하단 좌측`wall` · 돌벽`wall` · 어두운 석벽 하단 좌측`wall` | block-00-03 c21 r2 |
| 82 | 잔잔한 바다 `water` | 어두운 석벽 하단 `wall` | 돌벽 하단 중앙`wall` · 석벽 하단 중앙`wall` · 돌벽`wall` · 어두운 석벽 하단`wall` | block-00-03 c22 r2 |
| 83 | 고요한 물 `water` | 어두운 석벽 하단 우측 `wall` | 돌벽 하단 우측`wall` · 석벽 하단 우측`wall` · 돌벽 끝 기둥`wall` · 어두운 석벽 하단 우측`wall` | block-00-03 c23 r2 |
| 84 | 색색의 꽃밭 `plant` | 다채로운 보석 더미 `prop` | 물품 더미`prop` · 보석 더미`prop` · 천 더미`prop`* · 다채로운 보석 더미`prop` | block-00-03 c24 r2 |
| 85 | 주황 줄무늬 천막 `awning` | 목재 격자 창문 `window` | 격자 창문`window` · 나무 창문`window` · 창문`window` · 목재 격자 창문`window` | block-00-03 c25 r2 |
| 86 | 돌 우물터 `prop` | 커튼 달린 목재 창문 `window` | 커튼 창문`window` · 커튼 창문`window` · 창문`window`* · 커튼 달린 목재 창문`window` | block-00-03 c26 r2 |
| 87 | 파란 줄무늬 차양 `awning` | 아치형 유리 창문 `window` | 아치형 창문`window` · 아치형 창문`window` · 창문`window` · 아치형 유리 창문`window` | block-00-03 c27 r2 |
| 88 | 주황 상자 (청색 무늬) `crate` | 닫힌 목재 덧문 창문 `window` | 나무 상자 더미`prop` · 나무 덧문 창문`window` · 나무 선반`furniture`* · 닫힌 목재 덧문 창문`window` | block-00-03 c28 r2 |
| 89 | 흩어진 밝은 반짝임 `decoration` | 얼음 파편 `decoration` | 얼음 파편`decoration` · 얼음 파편`decoration` · 물방울`decoration`* · 얼음 파편`decoration` | block-00-03 c29 r2 |
| 90 | 바닷가 물가 애니메이션 `coast` | 깊은 수면 물 프레임 1 `coast` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 1`water` | block-00-03 c0 r3 |
| 91 | 바닷가 물가 애니메이션 `coast` | 깊은 수면 물 프레임 2 `coast` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 2`water` | block-00-03 c1 r3 |
| 92 | 바닷가 물가 애니메이션 `coast` | 깊은 수면 물 프레임 3 `coast` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 3`water` | block-00-03 c2 r3 |
| 93 | 바다 물결 애니메이션 `water` | 석조 수로 깊은 물 프레임 1 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 1`water` | block-00-03 c3 r3 |
| 94 | 바다 물결 애니메이션 `water` | 석조 수로 깊은 물 프레임 2 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 2`water` | block-00-03 c4 r3 |
| 95 | 바다 물결 애니메이션 `water` | 석조 수로 깊은 물 프레임 3 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 3`water` | block-00-03 c5 r3 |
| 96 | 흰 벽 (좌측 잔디) `wall` | 눈밭 가장자리 좌하단 `terrain` | 눈밭 가장자리 좌하단`terrain` · 눈밭 가장자리 좌하단`terrain` · 눈`terrain` · 눈밭 좌하단`terrain` | block-00-03 c6 r3 |
| 97 | 흰 벽면 (아래 잔디) `wall` | 눈밭 가장자리 하단 `terrain` | 눈밭 가장자리 하단`terrain` · 눈밭 가장자리 하단`terrain` · 눈`terrain` · 눈밭 하단`terrain` | block-00-03 c7 r3 |
| 98 | 흰 벽 (우하 잔디) `wall` | 눈밭 가장자리 우하단 `terrain` | 눈밭 가장자리 우하단`terrain` · 눈밭 가장자리 우하단`terrain` · 눈`terrain` · 눈밭 우하단`terrain` | block-00-03 c8 r3 |
| 99 | 짙은 초록 나무 `tree` | 덤불 가장자리 좌하단 `tree` | 숲 캐노피 좌하단`plant` · 덤불 가장자리 좌하단`plant` · 덤불`plant` · 덤불 좌하단`plant` | block-00-03 c9 r3 |
| 100 | 우거진 나무 `tree` | 덤불 가장자리 하단 `tree` | 숲 캐노피 하단`plant` · 덤불 가장자리 하단`plant` · 덤불`plant` · 덤불 하단`plant` | block-00-03 c10 r3 |
| 101 | 열매 진 나무 `tree` | 덤불 가장자리 우하단 `tree` | 숲 캐노피 우하단`plant` · 덤불 가장자리 우하단`plant` · 덤불`plant` · 덤불 우하단`plant` | block-00-03 c11 r3 |
| 102 | 적갈색 흙밭 `terrain` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 좌측`floor` | block-00-03 c12 r3 |
| 103 | 흙밭 (하단 그림자) `terrain` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 중앙`floor` | block-00-03 c13 r3 |
| 104 | 갈색 흙밭 `terrain` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 우측`floor` | block-00-03 c14 r3 |
| 105 | 흙밭 (어두운 끝) `terrain` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 1`floor` | block-00-03 c15 r3 |
| 106 | 마른 황토밭 `terrain` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 2`floor` | block-00-03 c16 r3 |
| 107 | 무늬 진 경작지 `terrain` | 목재 격자 트렐리스 `fence` | 목재 격자 트렐리스`fence` · 격자 울타리`fence` · 격자무늬 장식 기둥`decoration`* · 다이아몬드 격자 바닥 타일`floor` | block-00-03 c17 r3 |
| 108 | 물가 포말 (우상) `water` | 성벽 기단 좌측 `wall` | 성벽 기단 좌측`wall` · 석벽 기초 좌측`wall` · 석조 기단`wall` · 어두운 석조 바닥 좌측`floor` | block-00-03 c18 r3 |
| 109 | 물가 포말 (좌상) `water` | 성벽 기단 중앙 `wall` | 성벽 기단 중앙`wall` · 석벽 기초 중앙`wall` · 석조 기단`wall` · 어두운 석조 바닥 중앙`floor` | block-00-03 c19 r3 |
| 110 | 물가 포말 (좌측 물결) `water` | 성벽 기단 우측 `wall` | 성벽 기단 우측`wall` · 석벽 기초 우측`wall` · 석조 기단`wall` · 어두운 석조 바닥 우측`floor` | block-00-03 c20 r3 |
| 111 | 갈라진 돌절벽 `cliff` | 석조 기둥 벽 좌측 `wall` | 석조 기둥 벽 좌측`wall` · 석조 벽 하단 좌측`wall` · 낮은 돌담`wall` · 석벽 하단 좌측`wall` | block-00-03 c21 r3 |
| 112 | 암석 절벽면 `cliff` | 석조 판석 벽 중앙 `wall` | 석조 판석 벽 중앙`wall` · 석조 벽 하단 중앙`wall` · 낮은 돌담`wall` · 석벽 하단 중앙`wall` | block-00-03 c22 r3 |
| 113 | 균열 있는 돌벽 `cliff` | 석조 기둥 벽 우측 `wall` | 석조 기둥 벽 우측`wall` · 석조 벽 하단 우측`wall` · 낮은 돌담`wall` · 석벽 하단 우측`wall` | block-00-03 c23 r3 |
| 114 | 주황 반구형 물체 `prop` | 둥근 나무 받침대 `furniture` | 원형 탁자`furniture` · 원형 나무 탁자`furniture` · 둥근 나무 받침대`furniture` · 둥근 목재 탁자`furniture` | block-00-03 c24 r3 |
| 115 | 주황 줄무늬 차양 (우) `awning` | 목재 격자 창문 우측 `window` | 목재 창문 좌측`window` · 나무 창문 좌측`window` · 창문`window` · 목재 격자 창문 우측`window` | block-00-03 c25 r3 |
| 116 | 주황 줄무늬 천막 (좌) `awning` | 목재 창문 `window` | 목재 창문 우측`window` · 나무 창문 우측`window` · 나무 창문 우측`window` · 나무 문`door` · 목재 문`door` · 나무 문`door` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 117 | 흙바닥 지면 `terrain` | 나무 수납장 `furniture` | 나무 수납장`furniture` · 나무 탁자`furniture` · 나무 궤짝`furniture` · 목재 서랍장`furniture` | block-00-03 c27 r3 |
| 118 | 흙 경사면 `terrain` | 기울어진 목재 벤치 `furniture` | 기울어진 목재 벤치`furniture` · 비스듬한 나무 탁자`furniture` · 나무 작업대`furniture`* · 기울어진 목재 판자`furniture` | block-00-03 c28 r3 |
| 119 | 청회색 작은 물체 `prop` | 자수정 원석 `rock` | 큰 바위`rock` · 바위`rock` · 자수정 원석`rock` · 보라색 바위`rock` | block-00-03 c29 r3 |
| 120 | 짙은 남색 창문 3연 `window` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c0 r4 |
| 121 | 남색 창문 3연 밝은틀 `window` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c1 r4 |
| 122 | 남색 창문 3연 어두운틀 `window` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c2 r4 |
| 123 | 우물 상단 두레박줄 `prop` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r4 |
| 124 | 우물 하단 돌테 `prop` | 물보라 치는 어두운 물 `water` | 소용돌이치는 물`water` · 물보라`water` · 물보라 치는 어두운 물`water` · 소용돌이 물결`water` | block-04-07 c4 r4 |
| 125 | 우물 내부 어둠 오버레이 `prop` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 129 | 황무지 풀숲 `plant` | 조약돌 길 가장자리 `terrain` | 자갈길 모서리`terrain` · 자갈길 가장자리`terrain` · 조약돌 길 가장자리`terrain` · 조약돌 바닥 조각`floor` | block-04-07 c9 r4 |
| 131 | 마른 수풀 전면 오버레이 `plant` | 조약돌 바닥 오른쪽 위 `terrain` | 자갈길 모서리`terrain` · 돌길`terrain` · 자갈 바닥`terrain` · 조약돌 바닥`floor` · 조약돌 바닥`floor` · 조약돌 바닥 오른쪽 위`terrain` | block-04-07 c11 r4 |
| 132 | 울타리 상단 가로대 `fence` | 금속 장식 목재 벽 좌측 상단 `wall` | 통나무 벽 좌측`wall` · 통나무 벽`wall` · 통나무 벽 좌측`wall` · 금속 장식 목재 벽 좌측 상단`wall` | block-04-07 c12 r4 |
| 133 | 울타리 중간 결 `fence` | 통나무 벽 중앙 `wall` | 통나무 벽 중앙`wall` · 통나무 벽`wall` · 통나무 벽 중앙`wall` · 목재 벽 상단`wall` | block-04-07 c13 r4 |
| 134 | 울타리 오른쪽 끝 `fence` | 금속 장식 목재 벽 우측 상단 `wall` | 통나무 벽 우측`wall` · 통나무 벽`wall` · 통나무 벽 우측`wall` · 금속 장식 목재 벽 우측 상단`wall` | block-04-07 c14 r4 |
| 135 | 울타리 왼쪽 끝 `fence` | 금속 장식 목재 벽 상단 `wall` | 통나무 벽 좌측`wall` · 통나무 벽`wall` · 통나무 벽 좌우 모서리`wall` · 금속 장식 목재 벽 상단`wall` | block-04-07 c15 r4 |
| 136 | 울타리 아래 마감 `fence` | 금속 장식 목재 벽 상단 `wall` | 통나무 벽 우측`wall` · 통나무 벽`wall` · 통나무 벽`wall` · 금속 장식 목재 벽 상단`wall` | block-04-07 c16 r4 |
| 137 | 흙길 십자 교차로 `path` | 팀버프레임 벽 상단 보 `wall` | 목조 골조 벽 상단`wall` · 목조 트러스 벽`wall` · 팀버프레임 벽 상단 보`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c17 r4 |
| 138 | 자갈바닥 좌측 상단 `floor` | 어두운 석조 아치 입구 좌상단 `wall` | 돌성벽 처마 좌측`wall` · 돌 아치문 상단 좌측`wall` · 어두운 돌벽 아치 상단 좌측`wall` · 어두운 석조 아치 입구 좌상단`wall` | block-04-07 c18 r4 |
| 139 | 자갈바닥 우측 상단 `floor` | 어두운 석조 아치 입구 우상단 `wall` | 돌성벽 처마 우측`wall` · 돌 아치문 상단 우측`wall` · 어두운 돌벽 아치 상단 우측`wall` · 어두운 석조 아치 입구 우상단`wall` | block-04-07 c19 r4 |
| 140 | 자갈바닥 좌측 하단 `floor` | 어두운 돌벽 상단 `wall` | 어두운 돌벽`wall` · 어두운 돌벽`wall` · 어두운 돌벽 상단`wall` · 어두운 석조 벽`wall` | block-04-07 c20 r4 |
| 141 | 자갈바닥 우측 하단 `floor` | 어두운 돌벽 상단 `wall` | 어두운 돌벽`wall` · 어두운 돌벽`wall` · 어두운 돌벽 상단`wall` · 어두운 석조 벽`wall` | block-04-07 c21 r4 |
| 144 | 회색 벽돌벽 `wall` | 목재 기둥 상단 `prop` | 긴 목재 기둥 상단`prop` · 세로 탁자 상단`furniture` · 긴 목재 탁자 상단`furniture` · 세로 목재 탁자 상단`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 145 | 나무 문 오른쪽 설계도 `door` | 커튼 달린 창문 좌측 `window` | 창문 좌측`window` · 커튼 창문 좌측`window` · 침대 머리맡`furniture` · 푸른 커튼 창문`window` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 146 | 나무 문 왼쪽 설계도 `door` | 커튼 달린 창문 우측 `window` | 창문 우측`window` · 커튼 창문 우측`window` · 목재 덮개문`door` · 목재 사각 문`door` · 사각 나무 탁자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 147 | 벽 속 빈 틀 `wall` | 나무 의자 `furniture` | 원형 의자`furniture` · 나무 의자`furniture` · 작은 목재 스툴`furniture` · 작은 목재 의자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 148 | 벽 속 넓은 빈 틀 `wall` | 나무 협탁 `furniture` | 목재 의자 등받이`furniture` · 협탁`furniture` · 작은 목재 협탁`furniture` · 목재 협탁`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 149 | 벽 모서리 사선 마감 `wall` | 바위에 꽂힌 곡괭이 `prop` | 레버`prop` · 레버`prop` · 흙더미에 꽂힌 삽`prop` · 바위에 꽂힌 곡괭이`prop` | block-04-07 c29 r4 |
| 150 | 남색 원형 장식 상단 `decoration` | 어두운 물 소용돌이 좌측 `water` | 어두운 물 웅덩이 좌측`water` · 깊은 물`water` · 어두운 물 소용돌이 좌측`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c0 r5 |
| 151 | 남색 원형 장식 중앙 `decoration` | 어두운 물 소용돌이 중앙 `water` | 어두운 물 웅덩이 중앙`water` · 깊은 물`water` · 어두운 물 소용돌이 중앙`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c1 r5 |
| 152 | 남색 원형 장식 하단 `decoration` | 어두운 물 소용돌이 우측 `water` | 어두운 물 웅덩이 우측`water` · 깊은 물`water` · 어두운 물 소용돌이 우측`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c2 r5 |
| 153 | 우물 반복 타일 `prop` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r5 |
| 154 | 우물 원형 테 두께 `prop` | 물보라 치는 어두운 물 `water` | 소용돌이치는 물`water` · 물보라`water` · 물보라 치는 어두운 물`water` · 소용돌이 물결`water` | block-04-07 c4 r5 |
| 155 | 우물 중앙 결 오버레이 `prop` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 156 | 마른 흙 사분면 좌상 `terrain` | 새싹 밭이랑 좌측 `terrain` | 작물이 심어진 밭 좌단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌측 가장자리`terrain` · 새싹 밭고랑 좌측`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 157 | 마른 흙 사분면 우상 `terrain` | 새싹 밭이랑 중앙 `terrain` | 작물이 심어진 밭 중앙`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 중앙`terrain` · 새싹 밭고랑 중앙`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 158 | 마른 흙 사분면 우하 `terrain` | 새싹 밭이랑 우측 `terrain` | 작물이 심어진 밭 우단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우측 가장자리`terrain` · 새싹 밭고랑 우측`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 159 | 황무지 수풀 좌상단 `plant` | 조약돌 바닥 좌상단 가장자리 `terrain` | 자갈길 좌상단`terrain` · 돌길 좌상단 모서리`terrain` · 조약돌 바닥 좌상단 가장자리`terrain` · 조약돌 바닥 좌상단 테두리`floor` | block-04-07 c9 r5 |
| 160 | 황무지 수풀 우상단 `plant` | 조약돌 바닥 상단 가장자리 `terrain` | 자갈길 상단`terrain` · 돌길 상단 가장자리`terrain` · 조약돌 바닥 상단 가장자리`terrain` · 조약돌 바닥 상단 테두리`floor` | block-04-07 c10 r5 |
| 161 | 황무지 수풀 우하단 `plant` | 조약돌 바닥 우상단 가장자리 `terrain` | 자갈길 우상단`terrain` · 돌길 우상단 모서리`terrain` · 조약돌 바닥 우상단 가장자리`terrain` · 조약돌 바닥 우상단 테두리`floor` | block-04-07 c11 r5 |
| 167 | 울타리 중간 기둥 강조 `fence` | 팀버프레임 목재 기둥 벽 `wall` | 목재 기둥 마감재`wall` · 목재 벽 기둥`wall` · 팀버프레임 목재 기둥`wall` · 팀버프레임 목재 기둥 벽`wall` | block-04-07 c17 r5 |
| 168 | 통나무 울타리 위 색띠 `fence` | 나무 판자 벽 좌측 `wall` | 나무 바닥 상단 좌측`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 좌측`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 왼쪽 위`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 169 | 울타리 몸통 채움 `fence` | 나무 판자 벽 중앙 `wall` | 나무 바닥 상단 중앙`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 중앙`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 위쪽`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 170 | 울타리 몸통 우측 마감 `fence` | 나무 판자 벽 우측 `wall` | 나무 바닥 상단 우측`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 우측`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 오른쪽 위`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 171 | 울타리 흔적 왼쪽 세로 `fence` | 가로 목재 판자벽 좌측 `wall` | 나무 벽 좌단`wall` · 나무 판자 벽 좌측`wall` · 목재 판자 벽 좌측`wall` · 가로 목재 판자벽 좌측`wall` | block-04-07 c21 r5 |
| 172 | 울타리 흔적 중앙 블록 `fence` | 가로 목재 판자벽 중앙 `wall` | 나무 벽 중앙`wall` · 나무 판자 벽 중앙`wall` · 목재 판자 벽 중앙`wall` · 가로 목재 판자벽 중앙`wall` | block-04-07 c22 r5 |
| 173 | 울타리 흔적 오른쪽 세로 `fence` | 가로 목재 판자벽 우측 `wall` | 나무 벽 우단`wall` · 나무 판자 벽 우측`wall` · 목재 판자 벽 우측`wall` · 가로 목재 판자벽 우측`wall` | block-04-07 c23 r5 |
| 174 | 벽돌벽 반짝 광택 `wall` | 목재 기둥 중간 `prop` | 긴 목재 기둥 상단부`prop` · 세로 탁자 중앙`furniture` · 긴 목재 탁자 중단`furniture` · 세로 목재 탁자 중앙`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 175 | 벽돌 조각 상부 곡선 `wall` | 나무 의자 앞모습 `furniture` | 목재 의자 정면`furniture` · 나무 의자 앞모습`furniture` · 목재 의자 정면`furniture` · 전면 목재 의자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 176 | 벽돌 조각 하부 곡선 `wall` | 나무 의자 뒷모습 `furniture` | 목재 의자 정면`furniture` · 나무 의자 뒷모습`furniture` · 목재 의자 후면`furniture` · 후면 목재 의자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 177 | 안쪽 벽 창문들 `window` | 쇠테 나무 술통 `prop` | 나무 통`furniture` · 나무 술통`prop` · 목재 나무통`prop` · 목재 술통`prop` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 178 | 벽 안쪽 후면부 `wall` | 구운 고기 덩어리 `prop` | 구운 고기`prop` · 음식 바구니`prop` · 구운 고기 덩어리`prop` · 통구이 고기 요리`prop` | block-04-07 c28 r5 |
| 179 | 붉은 지붕 하단 처마 `roof` | 붉은 제비꼬리 깃발 상단 `decoration` | 붉은 깃발 상단`decoration` · 깃발 상단`decoration` · 붉은색 배너 상단`decoration` · 빨간색 문장 깃발`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 180 | 짙은 남색 창살 3연 `window` | 어두운 물 소용돌이 하단 좌측 `water` | 어두운 물 웅덩이 좌측`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 좌측`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c0 r6 |
| 181 | 남색 창살 3연 밝은틀 `window` | 어두운 물 소용돌이 하단 중앙 `water` | 어두운 물 웅덩이 중앙`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 중앙`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c1 r6 |
| 182 | 남색 창살 3연 어두운틀 `window` | 어두운 물 소용돌이 하단 우측 `water` | 어두운 물 웅덩이 우측`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 우측`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c2 r6 |
| 183 | 우물 조합 반복 블록 `prop` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r6 |
| 184 | 우물 외곽 왼쪽 연결 `prop` | 물보라 치는 어두운 물 `water` | 소용돌이치는 물`water` · 물보라`water` · 물보라 치는 어두운 물`water` · 소용돌이 물결`water` | block-04-07 c4 r6 |
| 185 | 우물 하이라이트 `prop` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 186 | 흙길 좌측 상단 코너 `path` | 새싹 밭이랑 좌측 `terrain` | 작물이 심어진 밭 좌단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌측 가장자리`terrain` · 새싹 밭고랑 좌측`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 187 | 흙길 중앙 사분면 `path` | 새싹 밭이랑 중앙 `terrain` | 작물이 심어진 밭 중앙`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 중앙`terrain` · 새싹 밭고랑 중앙`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 188 | 흙길 우하 코너 풀 `path` | 새싹 밭이랑 우측 `terrain` | 작물이 심어진 밭 우단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우측 가장자리`terrain` · 새싹 밭고랑 우측`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 189 | 황무지 풀숲 좌상 코너 `plant` | 조약돌 바닥 좌측 가장자리 `terrain` | 자갈길 좌측`terrain` · 돌길 좌측 가장자리`terrain` · 조약돌 바닥 좌측 가장자리`terrain` · 조약돌 바닥 좌측 테두리`floor` | block-04-07 c9 r6 |
| 190 | 황무지 풀숲 중앙 `plant` | 조약돌 바닥 가운데 `terrain` | 자갈길 중앙`terrain` · 돌길`terrain` · 자갈 바닥 중앙`terrain` · 조약돌 바닥 중앙`floor` · 조약돌 바닥 중앙`floor` · 조약돌 바닥 가운데`terrain` | block-04-07 c10 r6 |
| 191 | 황무지 풀숲 우하 코너 `plant` | 조약돌 바닥 우측 가장자리 `terrain` | 자갈길 우측`terrain` · 돌길 우측 가장자리`terrain` · 조약돌 바닥 우측 가장자리`terrain` · 조약돌 바닥 우측 테두리`floor` | block-04-07 c11 r6 |
| 192 | 울타리 판금 상단 `fence` | 세로 목재 판자벽 `wall` | 목재 벽 좌단`wall` · 나무 판자 벽`wall` · 가로 목재 바닥`floor` · 세로 목재 판자벽`wall` | block-04-07 c12 r6 |
| 193 | 울타리 손잡이 돌기 `fence` | 옹이 구멍 난 나무 벽 `wall` | 얼룩진 목재 벽/문`wall` · 옹이 구멍 난 나무 벽`wall` · 옹이구멍 있는 목재 벽`wall` · 구멍 난 목재 판자벽`wall` | block-04-07 c13 r6 |
| 194 | 울타리 위 기와 얼굴벽 `fence` | 반목조 석벽 기둥 상부 1 `wall` | 반목조 석벽 기둥 상부 1`wall` · 팀버프레임 돌벽 좌측 상단`wall` · 돌벽 팀버프레임 상단 좌측`wall` · 팀버프레임 돌벽 상단`wall` | block-04-07 c14 r6 |
| 195 | 울타리 위 높은 받침 `fence` | 반목조 석벽 기둥 상부 2 `wall` | 반목조 석벽 기둥 상부 2`wall` · 팀버프레임 돌벽 우측 상단`wall` · 돌벽 팀버프레임 상단 우측`wall` · 팀버프레임 돌벽 상단`wall` | block-04-07 c15 r6 |
| 196 | 울타리 위 회색 지붕 `fence` | 반목조 석벽 기둥 상부 3 `wall` | 반목조 석벽 기둥 상부 3`wall` · 팀버프레임 벽 좌측 상단`wall` · 회벽 팀버프레임 상단 좌측`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c16 r6 |
| 197 | 울타리 높은 받침 지붕 `fence` | 반목조 석벽 기둥 상부 4 `wall` | 반목조 석벽 기둥 상부 4`wall` · 팀버프레임 벽 우측 상단`wall` · 회벽 팀버프레임 상단 우측`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c17 r6 |
| 198 | 울타리 맞배 좌측 상 `fence` | 나무 판자 벽 좌측 `wall` | 나무 바닥 좌측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 좌측`wall` · 목재 바닥`floor` · 세로 판자 바닥 왼쪽`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 199 | 울타리 맞배 우측 상 `fence` | 나무 판자 벽 중앙 `wall` | 나무 바닥 중앙`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 중앙`wall` · 목재 바닥`floor` · 세로 판자 바닥 중앙`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 200 | 울타리 맞배 정면 `fence` | 나무 판자 벽 우측 `wall` | 나무 바닥 우측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 우측`wall` · 목재 바닥`floor` · 세로 판자 바닥 오른쪽`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 201 | 회색 포장 반복 블록 `floor` | 석조 틀 격자창 `window` | 철제 배수구 창살`floor` · 쇠창살 바닥 격자`floor` · 철제 배수구 격자`floor` · 철제 배수구 창살`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 202 | 포장 위 원형 문양 상 `floor` | 과일 상자 노란 과일 `prop` | 곡물 상자`prop` · 노란 과일 상자`furniture` · 과일 상자 노란 과일`prop` · 노란 과일 상자`prop` | block-04-07 c22 r6 |
| 203 | 포장 위 원형 문양 하 `floor` | 과일 상자 빨간 과일 `prop` | 사과 상자`prop` · 빨간 과일 상자`furniture` · 과일 상자 빨간 과일`prop` · 빨간 사과 상자`prop` | block-04-07 c23 r6 |
| 204 | 나무 도어 상부 틀 `door` | 목재 기둥 받침 `prop` | 긴 목재 기둥 하단부`prop` · 세로 탁자 하단`furniture` · 긴 목재 탁자 하단`furniture` · 세로 목재 탁자 하단`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 205 | 나무 도어 하부 틀 `door` | 나무 의자 우향 측면 `furniture` | 목재 의자 측면 좌`furniture` · 나무 의자 옆모습(우향)`furniture` · 목재 의자 측면 좌향`furniture` · 우향 목재 의자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 206 | 나무 도어 하부 쐐기 `door` | 나무 의자 좌향 측면 `furniture` | 목재 의자 측면 우`furniture` · 나무 의자 옆모습(좌향)`furniture` · 목재 의자 측면 우향`furniture` · 좌향 목재 의자`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 207 | 나무 도어 박스 문양 `door` | 나무 물통 `prop` | 목재 물통`furniture` · 나무 물통`prop` · 작은 나무 양동이`prop` · 작은 목재 통`prop` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 208 | 참나무 원목 문짝 `door` | 붉은 삼각 문장 깃발 `decoration` | 뾰족한 붉은 깃발`decoration` · 삼각 문장 깃발`decoration` · 방패형 붉은색 배너`decoration` · 빨간색 삼각 깃발`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 209 | 원목 판 상단 타일 `floor` | 붉은 제비꼬리 깃발 하단 `decoration` | 갈래 붉은 깃발`decoration` · 깃발 하단`decoration` · 삼각 붉은색 배너`decoration` · 빨간색 갈래 깃발`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 210 | 짙은 남색 벽돌 상단 `wall` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c0 r7 |
| 211 | 짙은 남색 벽돌 중앙 `wall` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c1 r7 |
| 212 | 짙은 남색 벽돌 하단 `wall` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c2 r7 |
| 213 | 우물 세로 반복 블록 `prop` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r7 |
| 214 | 우물 외곽 오른쪽 연결 `prop` | 물보라 치는 어두운 물 `water` | 소용돌이치는 물`water` · 물보라`water` · 물보라 치는 어두운 물`water` · 소용돌이 물결`water` | block-04-07 c4 r7 |
| 215 | 우물 내부 그림자 `prop` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 216 | 흙길 상단 코너 황토 `path` | 작물이 심어진 밭 좌하단 `terrain` | 작물이 심어진 밭 좌하단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌하단 모서리`terrain` · 새싹 밭고랑 좌측`floor` | block-04-07 c6 r7 |
| 217 | 흙길 중앙 황토 블록 `path` | 작물이 심어진 밭 하단 `terrain` | 작물이 심어진 밭 하단`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 하단 가장자리`terrain` · 새싹 밭고랑 중앙`floor` | block-04-07 c7 r7 |
| 218 | 흙길 우하 황토 코너 `path` | 작물이 심어진 밭 우하단 `terrain` | 작물이 심어진 밭 우하단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우하단 모서리`terrain` · 새싹 밭고랑 우측`floor` | block-04-07 c8 r7 |
| 219 | 황무지 풀숲 좌상 하이라이트 `plant` | 조약돌 바닥 좌하단 가장자리 `terrain` | 자갈길 좌하단`terrain` · 돌길 좌하단 모서리`terrain` · 조약돌 바닥 좌하단 가장자리`terrain` · 조약돌 바닥 좌하단 테두리`floor` | block-04-07 c9 r7 |
| 220 | 황무지 풀숲 밑동 `plant` | 조약돌 바닥 하단 가장자리 `terrain` | 자갈길 하단`terrain` · 돌길 하단 가장자리`terrain` · 조약돌 바닥 하단 가장자리`terrain` · 조약돌 바닥 하단 테두리`floor` | block-04-07 c10 r7 |
| 221 | 황무지 풀숲 우하 밑동 `plant` | 조약돌 바닥 우하단 가장자리 `terrain` | 자갈길 우하단`terrain` · 돌길 우하단 모서리`terrain` · 조약돌 바닥 우하단 가장자리`terrain` · 조약돌 바닥 우하단 테두리`floor` | block-04-07 c11 r7 |
| 222 | 울타리 낮은 판 전체 `fence` | 세로 나무 판자 벽 `wall` | 목재 벽 좌하단`wall` · 세로 나무 판자 벽`wall` · 세로 목재 벽 하단`wall` · 목재 판자벽`wall` | block-04-07 c12 r7 |
| 223 | 울타리 낮은판 흙받침 `fence` | 목재 벽 우하단 걸레받이 `wall` | 목재 벽 우하단 걸레받이`wall` · 나무 판자 벽 하단`wall` · 어두운 걸레받이 목재 벽`wall` · 목재 판자벽 하단`wall` | block-04-07 c13 r7 |
| 224 | 무지개 패널 세로 중앙 `decoration` | 반목조 석벽 기둥 하부 1 `wall` | 반목조 석벽 기둥 하부 1`wall` · 팀버프레임 돌벽 기둥 좌측`wall` · 돌벽 팀버프레임 하단 좌측`wall` · 목재 기둥 돌벽 하단`wall` | block-04-07 c14 r7 |
| 225 | 무지개 패널 세로 양옆 `decoration` | 반목조 석벽 기둥 하부 2 `wall` | 반목조 석벽 기둥 하부 2`wall` · 팀버프레임 돌벽 기둥 우측`wall` · 돌벽 팀버프레임 하단 우측`wall` · 목재 기둥 돌벽 하단`wall` | block-04-07 c15 r7 |
| 226 | 무지개 패널 가로 중앙 `decoration` | 팀버프레임 회반죽 벽 기둥 좌측 `wall` | 반목조 회벽 기둥 하부 1`wall` · 팀버프레임 회반죽 벽 기둥 좌측`wall` · 회벽 팀버프레임 하단 좌측`wall` · 목재 기둥 회벽 하단`wall` | block-04-07 c16 r7 |
| 227 | 무지개 패널 가로 양옆 `decoration` | 팀버프레임 회반죽 벽 기둥 우측 `wall` | 반목조 회벽 기둥 하부 2`wall` · 팀버프레임 회반죽 벽 기둥 우측`wall` · 회벽 팀버프레임 하단 우측`wall` · 목재 기둥 회벽 하단`wall` | block-04-07 c17 r7 |
| 228 | 울타리 맞배 좌측 하 `fence` | 나무 판자 벽 하단 좌측 `wall` | 나무 바닥 하단 좌측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 좌측`wall` · 목재 바닥`floor` · 세로 판자 바닥 왼쪽 아래`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 229 | 울타리 맞배 우측 하 `fence` | 나무 판자 벽 하단 중앙 `wall` | 나무 바닥 하단 중앙`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 중앙`wall` · 목재 바닥`floor` · 세로 판자 바닥 아래쪽`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 230 | 울타리 맞배 하단 마감 `fence` | 나무 판자 벽 하단 우측 `wall` | 나무 바닥 하단 우측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 우측`wall` · 목재 바닥`floor` · 세로 판자 바닥 오른쪽 아래`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 231 | 황금 장식 문양 코인 `decoration` | 원형 황금 장식창 `window` | 황금 마법진 바닥`floor` · 마법진`floor` · 황금빛 마법진 바닥`floor` · 마법진 문양 바닥`floor` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 234 | 울타리 게이트 좌측 문 `gate` | 긴 나무 벤치 좌측 `furniture` | 긴 목재 탁자 좌측`furniture` · 가로 긴 탁자 좌측`furniture` · 긴 가로 목재 탁자 좌측`furniture` · 긴 목재 탁자 좌측`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 235 | 울타리 게이트 우측 문 `gate` | 긴 나무 벤치 중앙 `furniture` | 긴 목재 탁자 중앙`furniture` · 가로 긴 탁자 중앙`furniture` · 긴 가로 목재 탁자 중앙`furniture` · 긴 목재 탁자 중앙`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 236 | 울타리 게이트 중앙 문 `gate` | 긴 나무 벤치 우측 `furniture` | 긴 목재 탁자 우측`furniture` · 가로 긴 탁자 우측`furniture` · 긴 가로 목재 탁자 우측`furniture` · 긴 목재 탁자 우측`furniture` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 237 | 울타리 이중 십자 결 `fence` | 나무 궤짝 `prop` | 나무 상자`furniture` · 나무 궤짝`prop` · 나무 보관 상자`prop` · 목재 보관 상자`prop` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 238 | 참나무 문 상단 이음 `door` | 대형 붉은 깃발 좌측 `decoration` | 넓은 붉은 현수막 좌측`decoration` · 대형 깃발 좌측`decoration` · 대형 붉은색 배너 하단 좌측`decoration` · 넓은 빨간색 벽걸이 깃발 좌측`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 239 | 참나무 문 하단 이음 `door` | 대형 붉은 깃발 우측 `decoration` | 넓은 붉은 현수막 우측`decoration` · 대형 깃발 우측`decoration` · 대형 붉은색 배너 하단 우측`decoration` · 넓은 빨간색 벽걸이 깃발 우측`decoration` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 246 | 돌바닥 `terrain` | 회색 석벽 단일 블록 `wall` | 돌 벽 상단 테두리`wall` · 독립된 돌길 바닥`floor` · 테두리 있는 회색 석재 바닥`terrain` · 회색 석벽 단일 블록`wall` | block-08-11 c6 r8 |
| 248 | 돌바닥 자동타일 `terrain` | 회색 자갈 석벽 단일 블록 `wall` | 돌 벽 상단 테두리`wall` · 돌길 바닥`floor` · 회색 자갈 석재 바닥`terrain` · 회색 자갈 석벽 단일 블록`wall` | block-08-11 c8 r8 |
| 249 | 돌바닥 `terrain` | 검은 쇄석 석벽 단일 블록 `wall` | 어두운 돌벽 상단 테두리`wall` · 독립된 어두운 돌바닥`floor` · 테두리 있는 검은 석재 바닥`terrain` · 검은 쇄석 석벽 단일 블록`wall` | block-08-11 c9 r8 |
| 251 | 돌바닥 경계 `terrain` | 어두운 쇄석 석벽 단일 블록 `wall` | 어두운 돌벽 상단 테두리`wall` · 어두운 돌바닥`floor` · 검은 자갈 석재 바닥`terrain` · 어두운 쇄석 석벽 단일 블록`wall` | block-08-11 c11 r8 |
| 252 | 나무 바닥 `floor` | 분홍색 거친 자연석 바닥 `terrain` | 분홍빛 자갈길`floor` · 붉은 자갈 바닥`floor` · 붉은 자연석 벽`wall` · 분홍색 석재 바닥`terrain` · 분홍색 거친 석재 바닥`terrain` · 분홍 회벽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 253 | 물 `water` | 청회색 거친 자연석 바닥 `terrain` | 푸른빛 자갈길`floor` · 푸른 자갈 바닥`floor` · 청회색 자연석 벽`wall` · 청회색 석재 바닥`terrain` · 청회색 각진 석재 바닥`terrain` · 청회색 회벽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 254 | 나무 판자 `floor` | 목재 골조 자주색 벽 상단 `wall` | 건물 외벽 기둥과 벽`wall` · 벽돌 벽과 나무 기둥`wall` · 목재 골조 자주색 벽 상단`wall` · 목재 골조 석벽 왼쪽`wall` | block-08-11 c14 r8 |
| 255 | 나무 판자 `floor` | 목재 골조 자주색 벽 상단 `wall` | 건물 외벽 기둥 사이 벽`wall` · 벽돌 벽과 나무 기둥`wall` · 목재 골조 자주색 벽 상단`wall` · 목재 골조 석벽 오른쪽`wall` | block-08-11 c15 r8 |
| 256 | 목재 바닥 `floor` | 건물 외벽 회반죽 벽 `wall` | 건물 외벽 회반죽 벽`wall` · 회색 벽과 나무 기둥`wall` · 목재 골조 회벽 상단`wall` · 회벽 목조 벽 왼쪽`wall` | block-08-11 c16 r8 |
| 257 | 목재 바닥 `floor` | 건물 외벽 회반죽 벽 `wall` | 건물 외벽 회반죽 벽`wall` · 회색 벽과 나무 기둥`wall` · 목재 골조 회벽 상단`wall` · 회벽 목조 벽 오른쪽`wall` | block-08-11 c17 r8 |
| 261 | 나무 기둥 `prop` | 마른 나무 가지 상단 `tree` | 마른 나무 상단`tree` · 마른 나무 상단`tree` · 마른 나무 가지 상단`tree` · 마른 나무 가지 상단`tree` | block-08-11 c21 r8 |
| 265 | 나무 울타리 `fence` | 잎 달린 덩굴 상단 `plant` | 덩굴 상단`plant` · 덩굴 상단`plant` · 덩굴 가지 상단`plant` · 잎 달린 덩굴 상단`plant` | block-08-11 c25 r8 |
| 266 | 금속 난간 `fence` | 회색 석상 머리 `prop` | 석상 머리`decoration` · 석상 상단`prop` · 회색 석상 머리`prop` · 회색 석상 상단`prop` | block-08-11 c26 r8 |
| 267 | 돌 울타리 `fence` | 회색 원기둥 머리 `prop` | 석조 기둥 머리`wall` · 석조 기둥 상단`prop` · 회색 원기둥 머리`prop` · 회색 석주 주두`prop` | block-08-11 c27 r8 |
| 268 | 바위 절벽 `cliff` | 아치형 창문 왼쪽 상단 `window` | 책장 지붕 좌측`furniture` · 파이프 오르간 좌상단`furniture` · 책장 상단 왼쪽`furniture` · 아치형 창문 왼쪽 상단`window` · 아치형 창문 왼쪽 상단`window` · 창문 좌측`window` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 269 | 바위 절벽 `cliff` | 아치형 창문 오른쪽 상단 `window` | 책장 지붕 우측`furniture` · 파이프 오르간 우상단`furniture` · 책장 상단 오른쪽`furniture` · 아치형 창문 오른쪽 상단`window` · 아치형 창문 오른쪽 상단`window` · 창문 우측`window` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 276 | 돌바닥 `terrain` | 돌 벽 좌상단 모서리 `wall` | 돌 벽 좌상단 모서리`wall` · 돌길 바닥 좌상단`floor` · 회색 석재 바닥 왼쪽`terrain` · 회색 석벽 상단 왼쪽`wall` | block-08-11 c6 r9 |
| 277 | 돌바닥 자동타일 `terrain` | 회색 석벽 상단 중앙 `wall` | 돌 벽 상단`wall` · 돌길 바닥 상단`floor` · 회색 석재 바닥 가운데`terrain` · 회색 석벽 상단 중앙`wall` | block-08-11 c7 r9 |
| 278 | 돌바닥 경계 `terrain` | 회색 석벽 상단 오른쪽 `wall` | 돌 벽 우상단 모서리`wall` · 돌길 바닥 우상단`floor` · 회색 석재 바닥 오른쪽`terrain` · 회색 석벽 상단 오른쪽`wall` | block-08-11 c8 r9 |
| 279 | 돌바닥 `terrain` | 어두운 돌벽 좌상단 모서리 `wall` | 어두운 돌벽 좌상단 모서리`wall` · 어두운 돌바닥 좌상단`floor` · 검은 석재 바닥 왼쪽`terrain` · 어두운 쇄석벽 상단 왼쪽`wall` | block-08-11 c9 r9 |
| 280 | 돌바닥 자동타일 `terrain` | 어두운 쇄석벽 상단 중앙 `wall` | 어두운 돌벽 상단`wall` · 어두운 돌바닥 상단`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 상단 중앙`wall` | block-08-11 c10 r9 |
| 281 | 돌바닥 경계 `terrain` | 어두운 돌벽 우상단 모서리 `wall` | 어두운 돌벽 우상단 모서리`wall` · 어두운 돌바닥 우상단`floor` · 검은 석재 바닥 오른쪽`terrain` · 어두운 쇄석벽 상단 오른쪽`wall` | block-08-11 c11 r9 |
| 282 | 분홍빛 지면 `terrain` | 연보라색 거친 자연석 바닥 `terrain` | 분홍빛 자갈길`floor` · 분홍 자갈 바닥`floor` · 분홍 자연석 벽`wall` · 분홍색 석재 바닥`terrain` · 연보라색 석재 바닥`terrain` · 보라 회벽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 283 | 회색 지면 `terrain` | 회녹색 거친 자연석 바닥 `terrain` | 푸른빛 자갈길`floor` · 청회색 자갈 바닥`floor` · 청록 자연석 벽`wall` · 녹회색 석재 바닥`terrain` · 회녹색 석재 바닥`terrain` · 녹색 회벽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 284 | 물가 자동타일 `water` | 자주색 벽돌 벽 왼쪽 끝 `wall` | 푸른 돌벽 상단 좌측`wall` · 푸른 벽돌 벽 좌상단`wall` · 자주색 벽돌 벽 왼쪽 끝`wall` · 청회색 벽돌벽 왼쪽 상단`wall` | block-08-11 c14 r9 |
| 285 | 물가 자동타일 `water` | 청회색 벽돌벽 중앙 상단 `wall` | 푸른 돌벽 상단 중앙`wall` · 푸른 벽돌 벽 상단`wall` · 자주색 벽돌 벽 왼쪽`wall` · 청회색 벽돌벽 중앙 상단`wall` | block-08-11 c15 r9 |
| 286 | 물가 자동타일 `water` | 청회색 벽돌벽 오른쪽 상단 `wall` | 푸른 돌벽 상단 중앙`wall` · 푸른 벽돌 벽 상단 이끼`wall` · 자주색 벽돌 벽 오른쪽`wall` · 청회색 벽돌벽 오른쪽 상단`wall` | block-08-11 c16 r9 |
| 287 | 물가 자동타일 `water` | 자주색 벽돌 벽 오른쪽 끝 `wall` | 푸른 돌벽 상단 우측`wall` · 푸른 벽돌 벽 우상단`wall` · 자주색 벽돌 벽 오른쪽 끝`wall` · 좁은 청회색 벽돌벽`wall` | block-08-11 c17 r9 |
| 290 | 풀 언덕 `cliff` | 잎이 무성한 나무 하단 `tree` | 원추형 나무 하단`tree` · 키 큰 나무 하단`tree` · 잎이 무성한 나무 하단`tree` · 잎이 무성한 나무 줄기`tree` | block-08-11 c20 r9 |
| 291 | 나무 기둥 `prop` | 마른 나무 줄기 하단 `tree` | 마른 나무 하단`tree` · 마른 나무 하단`tree` · 마른 나무 줄기 하단`tree` · 마른 나무 줄기`tree` | block-08-11 c21 r9 |
| 292 | 흙 비탈 `cliff` | 둥근 활엽수 좌측 하단 `tree` | 둥근 활엽수 좌측 하단`tree` · 큰 나무 좌하단`tree` · 큰 활엽수 왼쪽 하단`tree` · 큰 활엽수 밑동 왼쪽`tree` | block-08-11 c22 r9 |
| 293 | 흙 비탈 `cliff` | 둥근 활엽수 우측 하단 `tree` | 둥근 활엽수 우측 하단`tree` · 큰 나무 우하단`tree` · 큰 활엽수 오른쪽 하단`tree` · 큰 활엽수 밑동 오른쪽`tree` | block-08-11 c23 r9 |
| 295 | 풀 흙 비탈 `cliff` | 잎 달린 덩굴 중단 `plant` | 덩굴 중단`plant` · 덩굴 중단`plant` · 덩굴 가지 중단`plant` · 잎 달린 덩굴 중단`plant` | block-08-11 c25 r9 |
| 296 | 금속 난간 `fence` | 회색 석상 몸통 `prop` | 석상 몸체`decoration` · 석상 중단`prop` · 회색 석상 몸통`prop` · 회색 석상 하단`prop` | block-08-11 c26 r9 |
| 297 | 금속 울타리 `fence` | 회색 원기둥 몸통 `prop` | 석조 기둥 몸체와 기단`wall` · 석조 기둥 하단`prop` · 회색 원기둥 몸통`prop` · 회색 석주 기둥부`prop` | block-08-11 c27 r9 |
| 298 | 바위 지면 `rock` | 파이프 오르간 좌하단 `furniture` | 책장 본체 좌측`furniture` · 파이프 오르간 좌하단`furniture` · 책장 하단 왼쪽`furniture` · 아치형 창문 왼쪽 하단`window` · 아치형 창문 왼쪽 하단`window` · 책장 좌측`furniture` | block-08-11 c28 r9 |
| 299 | 바위 지면 `rock` | 파이프 오르간 우하단 `furniture` | 책장 본체 우측`furniture` · 파이프 오르간 우하단`furniture` · 책장 하단 오른쪽`furniture` · 아치형 창문 오른쪽 하단`window` · 아치형 창문 오른쪽 하단`window` · 책장 우측`furniture` | block-08-11 c29 r9 |
| 306 | 돌바닥 `terrain` | 회색 석벽 중앙 왼쪽 `wall` | 돌 벽 좌측 벽`wall` · 돌길 바닥 좌측`floor` · 회색 석재 바닥 왼쪽`terrain` · 회색 석벽 중앙 왼쪽`wall` | block-08-11 c6 r10 |
| 307 | 돌바닥 자동타일 `terrain` | 돌 벽 내부 바닥 `floor` | 돌 벽 내부 바닥`floor` · 돌길 바닥 중앙`floor` · 회색 석재 바닥 가운데`terrain` · 회색 석벽 중앙`wall` | block-08-11 c7 r10 |
| 308 | 돌바닥 경계 `terrain` | 회색 석벽 중앙 오른쪽 `wall` | 돌 벽 우측 벽`wall` · 돌길 바닥 우측`floor` · 회색 석재 바닥 오른쪽`terrain` · 회색 석벽 중앙 오른쪽`wall` | block-08-11 c8 r10 |
| 309 | 돌바닥 `terrain` | 어두운 쇄석벽 중앙 왼쪽 `wall` | 어두운 돌벽 좌측 벽`wall` · 어두운 돌바닥 좌측`floor` · 검은 석재 바닥 왼쪽`terrain` · 어두운 쇄석벽 중앙 왼쪽`wall` | block-08-11 c9 r10 |
| 310 | 돌바닥 자동타일 `terrain` | 어두운 돌벽 내부 바닥 `floor` | 어두운 돌벽 내부 바닥`floor` · 어두운 돌바닥 중앙`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 중앙`wall` | block-08-11 c10 r10 |
| 311 | 돌바닥 경계 `terrain` | 어두운 쇄석벽 중앙 오른쪽 `wall` | 어두운 돌벽 우측 벽`wall` · 어두운 돌바닥 우측`floor` · 검은 석재 바닥 오른쪽`terrain` · 어두운 쇄석벽 중앙 오른쪽`wall` | block-08-11 c11 r10 |
| 312 | 돌 바닥 `terrain` | 어두운 청회색 거친 자연석 바닥 `terrain` | 짙은 회색 자갈길`floor` · 회색 자갈 바닥`floor` · 어두운 청록 자연석 벽`wall` · 회색 조약돌 바닥`terrain` · 회색 거친 석재 바닥`terrain` · 어두운 회벽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 314 | 돌 포장 길 `path` | 베이지색 벽돌 벽 상단 좌측 `wall` | 베이지색 벽돌 벽 상단 좌측`wall` · 석조 벽 상단 좌측`wall` · 베이지색 문양 벽 상단`wall` · 베이지 문양 석벽 왼쪽 상단`wall` | block-08-11 c14 r10 |
| 315 | 돌 포장 길 `path` | 베이지 문양 석벽 중앙 왼쪽 상단 `wall` | 베이지색 벽돌 벽 상단`wall` · 석조 벽 상단 중좌측`wall` · 베이지색 문양 벽 상단`wall` · 베이지 문양 석벽 중앙 왼쪽 상단`wall` | block-08-11 c15 r10 |
| 316 | 돌 포장 `path` | 베이지 문양 석벽 중앙 오른쪽 상단 `wall` | 베이지색 벽돌 벽 상단`wall` · 석조 벽 상단 중우측`wall` · 베이지색 문양 벽 상단`wall` · 베이지 문양 석벽 중앙 오른쪽 상단`wall` | block-08-11 c16 r10 |
| 317 | 돌 포장 `path` | 베이지 문양 석벽 오른쪽 상단 `wall` | 베이지색 벽돌 벽 상단 우측`wall` · 석조 벽 상단 우측`wall` · 베이지색 문양 벽 상단`wall` · 베이지 문양 석벽 오른쪽 상단`wall` | block-08-11 c17 r10 |
| 319 | 나무 기둥 `prop` | 꺼진 검은 벽걸이 횃불 `prop` | 벽걸이 촛대 거치대`prop` · 벽 레버`prop` · 꺼진 벽 횃불`decoration` · 꺼진 검은 벽걸이 횃불`prop` | block-08-11 c19 r10 |
| 320 | 큰 나무 `tree` | 문양이 그려진 두루마리 `prop` | 양피지 공고문`prop` · 벽보`prop` · 문양이 그려진 두루마리`prop` · 문자가 새겨진 석판`prop` | block-08-11 c20 r10 |
| 321 | 나무 기둥 `prop` | 굽은 갈색 세로 막대 `prop` | 밧줄`prop` · 밧줄`prop` · 굽은 목재 막대`prop` · 굽은 갈색 세로 막대`prop`* | block-08-11 c21 r10 |
| 322 | 나무 판벽 `fence` | 나무 사다리 `stairs` | 나무 사다리`stairs` · 나무 사다리`stairs` · 나무 사다리`stairs` · 목제 사다리`stairs` | block-08-11 c22 r10 |
| 323 | 나무 상자 `crate` | 보라색 묘비 장식 상단 `prop` | 십자가 묘비 상단`prop` · 묘비 상단`prop` · 보라색 묘비 장식 상단`prop` · 보라색 장식 기둥 상단`prop` | block-08-11 c23 r10 |
| 325 | 풀 흙 비탈 `cliff` | 잎 달린 덩굴 하단 `plant` | 덩굴 하단`plant` · 덩굴 하단`plant` · 덩굴 가지 하단`plant` · 잎 달린 덩굴 하단`plant` | block-08-11 c25 r10 |
| 326 | 돌기둥 `pillar` | 회색 석상 하단 기단 `decoration` | 석상 하단 기단`decoration` · 석상 받침대`prop` · 석상 하단부`decoration` · 회색 석상 받침`prop` · 회색 벽걸이 장식`decoration`* · 돌 석상 하단`prop` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 327 | 나무 판자 `fence` | 긴 목제 의자 왼쪽 `furniture` | 나무 벤치 좌측`furniture` · 긴 탁자 좌측`furniture` · 긴 목재 들보 왼쪽`prop` · 긴 목제 의자 왼쪽`furniture` | block-08-11 c27 r10 |
| 328 | 나무 판자 `fence` | 긴 목제 의자 오른쪽 `furniture` | 나무 벤치 우측`furniture` · 긴 탁자 우측`furniture` · 긴 목재 들보 오른쪽`prop` · 긴 목제 의자 오른쪽`furniture` | block-08-11 c28 r10 |
| 329 | 검은 바위 `rock` | 검은색 걸개 상단 `decoration` | 동굴 입구 상단`door` · 어두운 입구 상단`door` · 검은 암흑 채움`decoration`* · 검은색 걸개 상단`decoration` · 검은 사각 면`decoration`* · 어두운 실내`wall` | block-08-11 c29 r10 |
| 336 | 돌바닥 `terrain` | 돌 벽 좌하단 모서리 `wall` | 돌 벽 좌하단 모서리`wall` · 돌길 바닥 좌하단`floor` · 회색 석재 바닥 왼쪽`terrain` · 회색 석벽 하단 왼쪽`wall` | block-08-11 c6 r11 |
| 337 | 돌바닥 자동타일 `terrain` | 회색 석벽 하단 중앙 `wall` | 돌 벽 하단`wall` · 돌길 바닥 하단`floor` · 회색 석재 바닥 가운데`terrain` · 회색 석벽 하단 중앙`wall` | block-08-11 c7 r11 |
| 338 | 돌바닥 경계 `terrain` | 회색 석벽 하단 오른쪽 `wall` | 돌 벽 우하단 모서리`wall` · 돌길 바닥 우하단`floor` · 회색 석재 바닥 오른쪽`terrain` · 회색 석벽 하단 오른쪽`wall` | block-08-11 c8 r11 |
| 339 | 돌바닥 `terrain` | 어두운 돌벽 좌하단 모서리 `wall` | 어두운 돌벽 좌하단 모서리`wall` · 어두운 돌바닥 좌하단`floor` · 검은 석재 바닥 왼쪽`terrain` · 어두운 쇄석벽 하단 왼쪽`wall` | block-08-11 c9 r11 |
| 340 | 돌바닥 자동타일 `terrain` | 어두운 쇄석벽 하단 중앙 `wall` | 어두운 돌벽 하단`wall` · 어두운 돌바닥 하단`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 하단 중앙`wall` | block-08-11 c10 r11 |
| 341 | 돌바닥 경계 `terrain` | 어두운 돌벽 우하단 모서리 `wall` | 어두운 돌벽 우하단 모서리`wall` · 어두운 돌바닥 우하단`floor` · 검은 석재 바닥 오른쪽`terrain` · 어두운 쇄석벽 하단 오른쪽`wall` | block-08-11 c11 r11 |
| 342 | 돌 포장 `path` | 베이지색 석판 바닥 `floor` | 밝은 석판 바닥`floor` · 밝은 석판 바닥`floor` · 베이지 석재 벽돌 벽`wall` · 베이지색 벽돌 바닥`terrain` · 베이지색 벽돌 바닥`terrain` · 원형 문양 석재`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 343 | 돌 포장 `path` | 원형 문양 석판 바닥 `floor` | 원형 문양 석판 바닥`floor` · 원형 문양 석판 바닥`floor` · 원형 문양 석판 바닥`floor` · 원형 문양 석재 바닥`terrain` · 원형 무늬 석재 바닥`terrain` · 원형 문양 석재`wall` | block-08-11 c13 r11 |
| 344 | 자갈 포장 `path` | 베이지색 벽돌 벽 하단 좌측 `wall` | 베이지색 벽돌 벽 하단 좌측`wall` · 석조 벽 하단 좌측`wall` · 갈색 문양 벽 하단`wall` · 베이지 문양 석벽 왼쪽 하단`wall` | block-08-11 c14 r11 |
| 345 | 자갈 포장 `path` | 베이지 문양 석벽 중앙 왼쪽 하단 `wall` | 베이지색 벽돌 벽 하단`wall` · 석조 벽 하단 중좌측`wall` · 갈색 문양 벽 하단`wall` · 베이지 문양 석벽 중앙 왼쪽 하단`wall` | block-08-11 c15 r11 |
| 346 | 자갈 포장 `path` | 베이지 문양 석벽 중앙 오른쪽 하단 `wall` | 베이지색 벽돌 벽 하단`wall` · 석조 벽 하단 중우측`wall` · 청회색 문양 벽 하단`wall` · 베이지 문양 석벽 중앙 오른쪽 하단`wall` | block-08-11 c16 r11 |
| 347 | 자갈 포장 `path` | 베이지 문양 석벽 오른쪽 하단 `wall` | 베이지색 벽돌 벽 하단 우측`wall` · 석조 벽 하단 우측`wall` · 청회색 문양 벽 하단`wall` · 베이지 문양 석벽 오른쪽 하단`wall` | block-08-11 c17 r11 |
| 348 | 빨간 배너 `banner` | 작은 들꽃 무리 `plant` | 바닥 들꽃`plant` · 들꽃`plant` · 작은 들꽃 무리`plant` · 흩어진 색색의 보석`decoration` · 여러 색의 작은 불빛`decoration` · 흩어진 꽃`plant` | block-08-11 c18 r11 |
| 349 | 나무 가판대 `counter` | 통나무 더미 하단 `prop` | 통나무 더미 하단`prop` · 장작더미`prop` · 갈색 광석 더미`rock`* · 높은 목제 등받이 의자`furniture` | block-08-11 c19 r11 |
| 350 | 큰 횃불 `torch` | 빨간 우체통 `prop` | 빨간 우체통`prop` · 빨간 우체통`prop` · 빨간색 튜닉`prop` · 빨간 등받이 의자`furniture` | block-08-11 c20 r11 |
| 351 | 붉은 천막 `awning` | 붉은 꽃 화분 `prop` | 꽃 화분`prop` · 붉은 꽃 화분`prop` · 빨간 꽃 화분`plant` · 붉은 꽃 화분`prop` | block-08-11 c21 r11 |
| 352 | 나무 간판 `sign` | 둥근 황토색 항아리 `sign` | 도자기 항아리`prop` · 항아리`prop` · 줄무늬 항아리`prop` · 둥근 황토색 항아리`prop` | block-08-11 c22 r11 |
| 353 | 나무 상자 `crate` | 십자가 묘비 하단 기단 `prop` | 십자가 묘비 하단 기단`prop` · 묘비 하단`prop` · 보라색 묘비 몸체`prop` · 보라색 장식 기둥 하단`prop` | block-08-11 c23 r11 |
| 358 | 나무 울타리 `fence` | 세로 목재 기둥 `prop` | 원목 기둥`prop` · 나무 기둥`prop` · 세로 목재 기둥`prop` · 세로 목재 기둥`prop` | block-08-11 c28 r11 |
| 359 | 검은 바위 `rock` | 동굴 입구 하단 바닥 `door` | 동굴 입구 하단 바닥`door` · 어두운 입구 하단`door` · 보라색 술 달린 검은 걸개 하단`decoration` · 검은 면과 보라색 울타리`fence`* | block-08-11 c29 r11 |
| 367 | 암흑 바닥 전체 `terrain` | 깨진 암반 구멍 상단 좌측 `cliff` | 어두운 구덩이 내부`cliff` · 어두운 수로 바닥`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽면`wall` · 어두운 돌 바닥`terrain` · 청록 석조 골조 벽 상단 보`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 368 | 칠흑 바닥 모서리 조각 `terrain` | 깨진 암반 구멍 상단 우측 `cliff` | 어두운 구덩이 모서리`cliff` · 석조 수로 내부 모서리`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽 모서리`wall` · 어두운 돌 바닥 모서리`terrain` · 청록 석조 골조 벽 상단 오른쪽 끝`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 369 | 어두운 돌 구덩이 상단 `terrain` | 석조 틀 어두운 창 단일 `window` | 사각 테두리 구덩이`cliff` · 깊은 물 단독 타일`water` · 돌 테두리 작은 보라색 구덩이`terrain` · 회색 틀의 남색 창문`window` · 남색 카펫 바닥`floor` · 남색 석조 벽 상단 왼쪽 결구`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 370 | 짙은 남청 바닥 `floor` | 남색 석조 벽 상단 보 `wall` | 남색 구덩이 내부`cliff` · 깊은 물 바닥`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽면`wall` · 남색 바닥`floor` · 남색 석조 벽 상단 보`wall` | block-12-15 c10 r12 |
| 371 | 어두운 돌 구덩이 사면 `terrain` | 남색 석조 벽 상단 오른쪽 끝 `wall` | 남색 구덩이 모서리`cliff` · 깊은 물 내부 모서리`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽 모서리`wall` · 남색 바닥 모서리`floor` · 남색 석조 벽 상단 오른쪽 끝`wall` | block-12-15 c11 r12 |
| 372 | 돌밭 보라 꽃포기 `plant` | 거친 자갈 흙 바닥 `terrain` | 붉은 자갈길`terrain` · 짙은 흙 바닥`terrain` · 보라색 돌 표면`rock` · 거친 자갈 흙 바닥`terrain` | block-12-15 c12 r12 |
| 373 | 잡석 꽃밭 보라꽃 `plant` | 붉은 흙 바닥 `terrain` | 붉은 흙밭`terrain` · 붉은 흙 바닥`terrain` · 자주색 돌 표면`rock` · 붉은 흙 바닥`terrain` | block-12-15 c13 r12 |
| 378 | 석벽 덩굴 우측 상단 `wall` | 곡선 목재 울타리 좌상단 `fence` | 곡선 목재 울타리 좌상단`fence` · 나무 울타리 좌측 상단`fence` · 둥근 목책 왼쪽 상단`fence` · 나무 울타리 좌측 끝`fence` | block-12-15 c18 r12 |
| 379 | 석벽 넝쿨 점무늬 `wall` | 목재 울타리 상단 `fence` | 목재 울타리 상단`fence` · 나무 울타리 상단`fence` · 둥근 목책 상단`fence` · 나무 울타리 상단`fence` | block-12-15 c19 r12 |
| 380 | 석벽 덩굴 좌측 하단 `wall` | 곡선 목재 울타리 우상단 `fence` | 곡선 목재 울타리 우상단`fence` · 나무 울타리 우측 상단`fence` · 둥근 목책 오른쪽 상단`fence` · 나무 울타리 우측 끝`fence` | block-12-15 c20 r12 |
| 381 | 석벽 노란 등불 얼룩 `torch` | 모닥불 `torch` | 모닥불`prop` · 모닥불`prop` · 모닥불`prop` · 모닥불`prop` | block-12-15 c21 r12 |
| 382 | 석벽 검은 균열 무늬 `wall` | 돌 화덕 `prop` | 돌 화덕`prop` · 돌 우물`prop` · 보라색 바위`rock` · 돌 우물`prop` | block-12-15 c22 r12 |
| 383 | 석벽 크림색 창문 `window` | 깨진 연두색 항아리 `prop` | 해골과 뼈`prop` · 해골과 뼈`prop` · 깨진 연두색 항아리`prop` · 해골과 뼈`prop` | block-12-15 c23 r12 |
| 384 | 짚지붕 모서리 우상 꺾임 `roof` | 주황색 기와 삼각지붕 왼쪽 사면 `roof` | 주황색 삼각 깃발`decoration` · 주황색 삼각 지붕 좌하단`roof` · 주황색 삼각 깃발 왼쪽`decoration` · 주황색 삼각 천 왼쪽 조각`decoration` · 주황색 삼각형 차양`roof` · 적갈색 기와지붕 왼쪽 사선 끝`roof` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 385 | 짚지붕 모서리 좌하 꺾임 `roof` | 주황색 기와 삼각지붕 오른쪽 사면 `roof` | 갈색 삼각 깃발`decoration` · 주황색 삼각 지붕 우하단`roof` · 주황색 삼각 깃발 오른쪽`decoration` · 주황색 삼각 천 오른쪽 조각`decoration` · 갈색 삼각형 차양`roof` · 적갈색 기와지붕 오른쪽 사선 끝`roof` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 386 | 푸른 지붕 꺾임 우상 `roof` | 파란색 기와 삼각지붕 왼쪽 사면 `roof` | 파란색 삼각 깃발`decoration` · 파란색 삼각 지붕 좌하단`roof` · 파란색 삼각 깃발 왼쪽`decoration` · 파란색 삼각 천 왼쪽 조각`decoration` · 파란색 삼각형 차양`roof` · 남색 기와지붕 왼쪽 사선 끝`roof` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 387 | 푸른 지붕 꺾임 좌하 `roof` | 파란색 기와 삼각지붕 오른쪽 사면 `roof` | 남색 삼각 깃발`decoration` · 파란색 삼각 지붕 우하단`roof` · 파란색 삼각 깃발 오른쪽`decoration` · 파란색 삼각 천 오른쪽 조각`decoration` · 남색 삼각형 차양`roof` · 남색 기와지붕 오른쪽 사선 끝`roof` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 388 | 석벽 나무 문짝 `door` | 세로 목재 기둥 `prop` | 통나무 기둥`prop` · 통나무 기둥`prop` · 세로 목재 기둥`prop` · 목재 기둥 상단`prop` | block-12-15 c28 r12 |
| 389 | 석벽 밑 밀짚 단 `decoration` | 천막 지붕 상단 장식 `roof` | 녹색 차양 지붕`roof` · 풀 덮개 차양`roof` · 녹색 천 덮개`decoration`* · 천막 지붕 상단 장식`roof` | block-12-15 c29 r12 |
| 391 | 밭흙 바닥 전체 `terrain` | 잔디 경계의 보라색 자갈 가운데 조각 `terrain` | 자갈길 상단`terrain` · 자갈길 상단 경계`terrain` · 잔디 경계의 보라색 자갈 가운데 조각`terrain` · 자갈길 상단 가장자리`terrain` | block-12-15 c1 r13 |
| 396 | 칠흑 북서 프레임 `terrain` | 돌 테두리 구덩이 좌상단 `cliff` | 돌 테두리 구덩이 좌상단`cliff` · 석조 수로 좌상단 모서리`water` · 어두운 구덩이 상단 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽 상단`wall` · 어두운 돌 바닥 좌상단 모퉁이`terrain` · 청록 석조 벽 패널 왼쪽 상단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 397 | 암흑 상단 경계 `terrain` | 돌 테두리 구덩이 상단 `cliff` | 돌 테두리 구덩이 상단`cliff` · 석조 수로 상단 경계`water` · 어두운 구덩이 상단 테두리`terrain` · 청록색 벽 테두리 상단`wall` · 어두운 돌 바닥 상단 가장자리`terrain` · 청록 석조 벽 패널 상단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 398 | 칠흑 북동 프레임 `terrain` | 돌 테두리 구덩이 우상단 `cliff` | 돌 테두리 구덩이 우상단`cliff` · 석조 수로 우상단 모서리`water` · 어두운 구덩이 상단 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽 상단`wall` · 어두운 돌 바닥 우상단 모퉁이`terrain` · 청록 석조 벽 패널 오른쪽 상단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 399 | 구덩이 북쪽 어두운 벽 `terrain` | 남색 석조 벽 패널 왼쪽 상단 `wall` | 사각 테두리 구덩이 좌상단`cliff` · 깊은 물 좌상단 모서리`water` · 보라색 구덩이 상단 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽 상단`wall` · 남색 카펫 좌상단 모퉁이`floor` · 남색 석조 벽 패널 왼쪽 상단`wall` | block-12-15 c9 r13 |
| 400 | 어두운 돌바닥 전체 `floor` | 남색 석조 벽 패널 상단 `wall` | 사각 테두리 구덩이 상단`cliff` · 깊은 물 상단 경계`water` · 보라색 구덩이 상단 테두리`terrain` · 남색 벽 테두리 상단`wall` · 남색 카펫 상단 가장자리`floor` · 남색 석조 벽 패널 상단`wall` | block-12-15 c10 r13 |
| 401 | 구덩이 동쪽 경계 `terrain` | 남색 석조 벽 패널 오른쪽 상단 `wall` | 사각 테두리 구덩이 우상단`cliff` · 깊은 물 우상단 모서리`water` · 보라색 구덩이 상단 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽 상단`wall` · 남색 카펫 우상단 모퉁이`floor` · 남색 석조 벽 패널 오른쪽 상단`wall` | block-12-15 c11 r13 |
| 402 | 풀꽃 핀 돌밭 `plant` | 붉은 흙 새싹 밭 `plant` | 붉은 밭 작물`plant` · 붉은 흙 새싹 밭`plant` · 초록 싹이 난 자주색 암벽`cliff` · 붉은 흙 밭 새싹`plant` | block-12-15 c12 r13 |
| 403 | 잡초 무성한 흙 `plant` | 짙은 흙 새싹 밭 `plant` | 자갈밭 작물`plant` · 짙은 흙 새싹 밭`plant` · 덩굴이 덮인 보라색 암벽`cliff` · 자갈 흙 밭 새싹`plant` | block-12-15 c13 r13 |
| 408 | 석벽 중앙 덩굴 기둥 `wall` | 나무 울타리 세로 기둥 `fence` | 세로 목재 울타리`fence` · 나무 울타리 세로 기둥`fence` · 둥근 목책 왼쪽 하단`fence` · 나무 울타리 수직 기둥`fence` | block-12-15 c18 r13 |
| 409 | 석벽 넝쿨 격자 무늬 `wall` | 나무 울타리 가로 중앙 `fence` | 가로 목재 울타리`fence` · 나무 울타리 가로 중앙`fence` · 둥근 목책 하단`fence` · 나무 울타리 중앙`fence` | block-12-15 c19 r13 |
| 410 | 석벽 덩굴 좌측 상단 `wall` | 나무 울타리 우측 연결부 `fence` | 목재 울타리 연결부`fence` · 나무 울타리 우측 끝단`fence` · 둥근 목책 오른쪽 하단`fence` · 나무 울타리 우측 연결부`fence` | block-12-15 c20 r13 |
| 411 | 석벽 작은 창 불빛 `window` | 흩어진 돌 `rock` | 흩어진 돌`rock` · 흩어진 돌`rock` · 흩어진 주황색 돌조각`decoration` · 모닥불 주변 자갈과 숯`prop` | block-12-15 c21 r13 |
| 412 | 석제 화단 흙 가운데 `prop` | 목재 술집 간판 `prop` | 주점 간판`prop` · 주점 간판`prop` · 목재 술집 간판`prop` · PUB 간판`prop` | block-12-15 c22 r13 |
| 413 | 석벽 목재 골조 틀 `wall` | 회색 십자 방향 표지판 `prop` | 석조 십자가`prop` · 석조 십자가`prop` · 회색 십자 방향 표지판`prop` · 철제 십자가`prop` | block-12-15 c23 r13 |
| 414 | 석벽 어두운 사선 그림자 `wall` | 거대 비석 좌측 상단 `prop` | 거대 비석 좌상단`prop` · 거대 비석 좌측 상단`prop` · 대형 묘비 왼쪽 상단`prop` · 룬 비석 좌상단`prop` | block-12-15 c24 r13 |
| 415 | 자갈돌 벽면 전체 `wall` | 거대 비석 상단 중앙 `prop` | 거대 비석 상단 중앙`prop` · 거대 비석 상단 중앙`prop` · 대형 묘비 상단`prop` · 룬 비석 상단 중앙`prop` | block-12-15 c25 r13 |
| 416 | 자갈 벽 어두운 사선 좌 `wall` | 대형 묘비 오른쪽 상단 `prop` | 거대 비석 우상단`prop` · 거대 비석 우측 상단`prop` · 대형 묘비 오른쪽 상단`prop` · 룬 비석 우상단`prop` | block-12-15 c26 r13 |
| 417 | 석벽 모래 사선 우상 `wall` | 베이지색 천막 지붕 왼쪽 `roof` | 천막 지붕 좌상단`roof` · 원형 천막 지붕 좌측`prop` · 둥근 텐트 지붕 왼쪽`roof` · 베이지색 천막 왼쪽 상단`prop` · 천막 지붕 좌상단`roof` · 베이지색 천막 지붕 왼쪽`roof` | block-12-15 c27 r13 |
| 418 | 모래 언덕 상단 경계 `sand` | 베이지색 천막 지붕 중앙 `roof` | 천막 지붕 상단 중앙`roof` · 원형 천막 지붕 중앙`prop` · 둥근 텐트 지붕 중앙`roof` · 베이지색 천막 상단`prop` · 천막 지붕 상단 중앙`roof` · 베이지색 천막 지붕 중앙`roof` | block-12-15 c28 r13 |
| 419 | 석벽 모래 사선 좌하 `wall` | 베이지색 천막 지붕 오른쪽 `roof` | 천막 지붕 우상단`roof` · 원형 천막 지붕 우측`prop` · 둥근 텐트 지붕 오른쪽`roof` · 베이지색 천막 오른쪽 상단`prop` · 천막 지붕 우상단`roof` · 베이지색 천막 지붕 오른쪽`roof` | block-12-15 c29 r13 |
| 426 | 칠흑 서쪽 경계 `terrain` | 돌 테두리 구덩이 좌측 `cliff` | 돌 테두리 구덩이 좌측`cliff` · 석조 수로 좌측 경계`water` · 어두운 구덩이 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽`wall` · 어두운 돌 바닥 좌측 가장자리`terrain` · 청록 석조 벽 패널 왼쪽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 427 | 암흑 중앙 면 `terrain` | 깨진 암반 구멍 내부 `cliff` | 돌 테두리 구덩이 내부`cliff` · 석조 수로 중앙 바닥`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽 중앙`wall` · 어두운 돌 바닥 중앙`terrain` · 청록 석조 벽 패널 중앙`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 428 | 칠흑 동쪽 경계 `terrain` | 돌 테두리 구덩이 우측 `cliff` | 돌 테두리 구덩이 우측`cliff` · 석조 수로 우측 경계`water` · 어두운 구덩이 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽`wall` · 어두운 돌 바닥 우측 가장자리`terrain` · 청록 석조 벽 패널 오른쪽`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 429 | 구덩이 서쪽 경계 `terrain` | 남색 석조 벽 패널 왼쪽 `wall` | 사각 테두리 구덩이 좌측`cliff` · 깊은 물 좌측 경계`water` · 보라색 구덩이 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽`wall` · 남색 카펫 좌측 가장자리`floor` · 남색 석조 벽 패널 왼쪽`wall` | block-12-15 c9 r14 |
| 430 | 어두운 암반 바닥 `floor` | 남색 석조 벽 패널 중앙 `wall` | 사각 테두리 구덩이 내부`cliff` · 깊은 물 중앙 바닥`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽 중앙`wall` · 남색 카펫 중앙`floor` · 남색 석조 벽 패널 중앙`wall` | block-12-15 c10 r14 |
| 431 | 구덩이 남동 모서리 `terrain` | 남색 석조 벽 패널 오른쪽 `wall` | 사각 테두리 구덩이 우측`cliff` · 깊은 물 우측 경계`water` · 보라색 구덩이 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽`wall` · 남색 카펫 우측 가장자리`floor` · 남색 석조 벽 패널 오른쪽`wall` | block-12-15 c11 r14 |
| 432 | 어두운 자갈바닥 흩어짐 `floor` | 이끼 낀 자갈 바닥 `terrain` | 이끼 낀 돌바닥`terrain` · 이끼 낀 자갈 바닥`terrain` · 이끼 낀 회색 암벽`cliff` · 이끼 낀 돌 바닥`terrain` | block-12-15 c12 r14 |
| 433 | 어두운 자갈 조밀 무늬 `floor` | 짙은 자갈 바닥 `terrain` | 돌바닥`terrain` · 짙은 자갈 바닥`terrain` · 회색 암벽`cliff` · 어두운 돌 바닥`terrain` | block-12-15 c13 r14 |
| 434 | 돌계단 난간 좌측 `stairs` | 대장간 화덕 상단 좌측 `prop` | 대장간 화덕 상단 좌측`prop` · 석조 화덕 좌측 상단`prop` · 밧줄 달린 회색 철문 왼쪽 상단`gate` · 지하 통로 사다리 좌상단`stairs` | block-12-15 c14 r14 |
| 435 | 돌계단 난간 우측 `stairs` | 대장간 화덕 상단 우측 `prop` | 대장간 화덕 상단 우측`prop` · 석조 화덕 우측 상단`prop` · 밧줄 달린 회색 철문 오른쪽 상단`gate` · 지하 통로 사다리 우상단`stairs` | block-12-15 c15 r14 |
| 438 | 석벽 흙 얼룩 중앙 `wall` | 곡선 목재 울타리 좌하단 `fence` | 곡선 목재 울타리 좌하단`fence` · 나무 울타리 좌측 끝단`fence` · 굽은 목책 조각`fence` · 나무 울타리 좌측 연결부`fence` | block-12-15 c18 r14 |
| 439 | 석벽 흙 점무늬 벽 `wall` | 나무 울타리 가로 하단 `fence` | 가로 목재 울타리`fence` · 나무 울타리 가로 하단`fence` · 곧은 목책 조각`fence` · 나무 울타리 하단`fence` | block-12-15 c19 r14 |
| 440 | 석벽 큰 흙 얼룩 `wall` | 목재 방향 푯말 `prop` | 목재 방향 푯말`prop` · 나무 이정표`prop` · 등받이 있는 목재 의자`furniture`* · 나무 이정표`prop` | block-12-15 c20 r14 |
| 442 | 석제 분수 물 `water` | 청록색 그림의 목재 간판 `prop` | 무기점 간판`prop` · 무기점 간판`prop` · 청록색 그림의 목재 간판`prop` · 검 무기점 간판`prop` | block-12-15 c22 r14 |
| 443 | 석제 화단 붉은 꽃 `plant` | 붉은 글씨의 여관 간판 `prop` | 여관 간판`prop` · 여관 간판`prop` · 붉은 글씨의 여관 간판`prop` · INN 여관 간판`prop` | block-12-15 c23 r14 |
| 444 | 바위 절벽 좌측 자갈면 `cliff` | 대형 묘비 왼쪽 가운데 `prop` | 거대 비석 중간 좌측`prop` · 거대 비석 좌측 중앙`prop` · 대형 묘비 왼쪽 가운데`prop` · 룬 비석 좌측 중앙`prop` | block-12-15 c24 r14 |
| 445 | 자갈 절벽 온전 면 `cliff` | 글자가 새겨진 대형 묘비 가운데 `prop` | 거대 비석 중간 중앙`prop` · 거대 비석 중앙`prop` · 글자가 새겨진 대형 묘비 가운데`prop` · 룬 비석 중앙`prop` | block-12-15 c25 r14 |
| 446 | 바위 절벽 우측 자갈면 `cliff` | 대형 묘비 오른쪽 가운데 `prop` | 거대 비석 중간 우측`prop` · 거대 비석 우측 중앙`prop` · 대형 묘비 오른쪽 가운데`prop` · 룬 비석 우측 중앙`prop` | block-12-15 c26 r14 |
| 447 | 절벽 사면 좌측 검댓 `cliff` | 베이지색 천막 왼쪽 벽면 `wall` | 천막 좌측 벽`wall` · 원형 천막 벽 좌측 상단`prop` · 텐트 왼쪽 천 벽`wall` · 베이지색 천막 왼쪽 가운데`prop` · 천막 좌측 벽`wall` · 베이지색 천막 왼쪽 벽면`wall` | block-12-15 c27 r14 |
| 448 | 절벽 층단 단면 전체 `cliff` | 검은 천막 입구 상단 `door` | 천막 입구 상단`door` · 원형 천막 입구 상단`prop` · 검은 천막 입구 상단`door` · 천막 입구 상단`door` | block-12-15 c28 r14 |
| 449 | 절벽 사면 우측 검댓 `cliff` | 베이지색 천막 오른쪽 벽면 `wall` | 천막 우측 벽`wall` · 원형 천막 벽 우측 상단`prop` · 텐트 오른쪽 천 벽`wall` · 베이지색 천막 오른쪽 가운데`prop` · 천막 우측 벽`wall` · 베이지색 천막 오른쪽 벽면`wall` | block-12-15 c29 r14 |
| 456 | 칠흑 남서 하단 경계 `terrain` | 돌 테두리 구덩이 좌하단 `cliff` | 돌 테두리 구덩이 좌하단`cliff` · 석조 수로 좌하단 모서리`water` · 어두운 구덩이 하단 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽 하단`wall` · 어두운 돌 바닥 좌하단 모퉁이`terrain` · 청록 석조 벽 패널 왼쪽 하단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 457 | 칠흑 남쪽 하단 경계 `terrain` | 돌 테두리 구덩이 하단 `cliff` | 돌 테두리 구덩이 하단`cliff` · 석조 수로 하단 경계`water` · 어두운 구덩이 하단 테두리`terrain` · 청록색 벽 테두리 하단`wall` · 어두운 돌 바닥 하단 가장자리`terrain` · 청록 석조 벽 패널 하단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 458 | 칠흑 남동 하단 경계 `terrain` | 돌 테두리 구덩이 우하단 `cliff` | 돌 테두리 구덩이 우하단`cliff` · 석조 수로 우하단 모서리`water` · 어두운 구덩이 하단 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽 하단`wall` · 어두운 돌 바닥 우하단 모퉁이`terrain` · 청록 석조 벽 패널 오른쪽 하단`wall` | **사람 확정** (adj-retro_exterior-r12-15-c17-27.png, adj-retro_exterior-r12-15-c6-16.png, adj-retro_exterior-r8-11-c12-20.png, adj-retro_exterior-r8-11-c21-29.png, banner-cols27-29-rows5-7.png, fin-retro_exterior-r12-15-c5-11.png, fin-retro_exterior-r2-3-c24-29.png, props-cols24-29-rows4-7.png, split-cols18-24-rows4-7.png, split-cols5-9-rows4-7.png) |
| 459 | 구덩이 남쪽 테두리 `terrain` | 남색 석조 벽 패널 왼쪽 하단 `wall` | 사각 테두리 구덩이 좌하단`cliff` · 깊은 물 좌하단 모서리`water` · 보라색 구덩이 하단 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽 하단`wall` · 남색 카펫 좌하단 모퉁이`floor` · 남색 석조 벽 패널 왼쪽 하단`wall` | block-12-15 c9 r15 |
| 460 | 어두운 바닥 하단 `floor` | 남색 석조 벽 패널 하단 `wall` | 사각 테두리 구덩이 하단`cliff` · 깊은 물 하단 경계`water` · 보라색 구덩이 하단 테두리`terrain` · 남색 벽 테두리 하단`wall` · 남색 카펫 하단 가장자리`floor` · 남색 석조 벽 패널 하단`wall` | block-12-15 c10 r15 |
| 461 | 구덩이 남서 테두리 `terrain` | 남색 석조 벽 패널 오른쪽 하단 `wall` | 사각 테두리 구덩이 우하단`cliff` · 깊은 물 우하단 모서리`water` · 보라색 구덩이 하단 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽 하단`wall` · 남색 카펫 우하단 모퉁이`floor` · 남색 석조 벽 패널 오른쪽 하단`wall` | block-12-15 c11 r15 |
| 462 | 어두운 땅 하얀 돌무리 좌 `rock` | 바위 무더기 좌측 `rock` | 보라색 광석`rock` · 바위 무더기 좌측`rock` · 밝은 결정이 박힌 암벽 왼쪽 조각`cliff` · 보라빛 광석 무더기`prop` | block-12-15 c12 r15 |
| 463 | 어두운 땅 하얀 돌무리 우 `rock` | 작은 보라색 광석 `rock` | 작은 보라색 광석`rock` · 바위 무더기 우측`rock` · 밝은 결정이 박힌 암벽 오른쪽 조각`cliff` · 보라빛 광석 파편`prop` | block-12-15 c13 r15 |
| 464 | 돌계단 상부 난간 좌 `stairs` | 대장간 화덕 하단 좌측 `prop` | 대장간 화덕 하단 좌측`prop` · 석조 화덕 좌측 하단`prop` · 밧줄 달린 회색 철문 왼쪽 하단`gate` · 지하 통로 사다리 좌하단`stairs` | block-12-15 c14 r15 |
| 465 | 돌계단 상부 난간 우 `stairs` | 대장간 화덕 하단 우측 `prop` | 대장간 화덕 하단 우측`prop` · 석조 화덕 우측 하단`prop` · 밧줄 달린 회색 철문 오른쪽 하단`gate` · 지하 통로 사다리 우하단`stairs` | block-12-15 c15 r15 |
| 468 | 석벽 담쟁이 넝쿨 좌 `wall` | 목조 아치 다리 왼쪽 `floor` | 목재 다리 좌측`floor` · 목재 다리 좌측 기둥`prop` · 목조 아치 다리 왼쪽`floor` · 목재 진열대 왼쪽 조각`furniture`* · 목재 다리 좌측 아치`stairs` · 목조 아치 울타리 상단 왼쪽`fence` | block-12-15 c18 r15 |
| 469 | 석벽 담쟁이 넝쿨 중앙 `wall` | 목조 아치 다리 중앙 `floor` | 목재 다리 중앙`floor` · 목재 다리 중앙 기둥`prop` · 목조 아치 다리 중앙`floor` · 목재 진열대 가운데 왼쪽 조각`furniture`* · 목재 다리 중앙 기둥`stairs` · 목조 아치 울타리 상단 중앙`fence` | block-12-15 c19 r15 |
| 470 | 석벽 넝쿨 열매 우측 `wall` | 목조 아치 다리 오른쪽 `floor` | 목재 다리 우측`floor` · 목재 다리 우측 기둥`prop` · 목조 아치 다리 오른쪽`floor` · 목재 진열대 가운데 오른쪽 조각`furniture`* · 목재 다리 우측 아치`stairs` · 목조 아치 울타리 상단 오른쪽`fence` | block-12-15 c20 r15 |
| 471 | 석벽 위 흙 가장자리 `wall` | 목재 상판 하단 지지대 `prop` | 목재 발판 지지대`prop` · 목재 다리 하단 받침`prop` · 목재 진열대 오른쪽 조각`furniture`* · 목재 상판 하단 지지대`prop` | block-12-15 c21 r15 |
| 472 | 석제 수조 나무판 `prop` | 보라색 병 그림의 목재 간판 `prop` | 방어구점 간판`prop` · 방어구점 간판`prop` · 보라색 병 그림의 목재 간판`prop` · 방패 방어구점 간판`prop` | block-12-15 c22 r15 |
| 473 | 석제 화단 진홍 꽃 `plant` | 빨간 항아리 그림의 목재 간판 `prop` | 도구점 간판`prop` · 도구점 간판`prop` · 빨간 항아리 그림의 목재 간판`prop` · 물약 잡화점 간판`prop` | block-12-15 c23 r15 |
| 474 | 절벽 하단 어두운 사면 `cliff` | 거대 비석 받침대 좌측 `prop` | 거대 비석 받침대 좌측`prop` · 거대 비석 좌측 하단`prop` · 대형 묘비 왼쪽 하단`prop` · 룬 비석 좌하단 받침대`prop` | block-12-15 c24 r15 |
| 475 | 절벽 층 아래 검은 층 `cliff` | 룬 비석 하단 중앙 받침대 `prop` | 거대 비석 받침대 중앙`prop` · 거대 비석 하단 중앙`prop` · 대형 묘비 하단`prop` · 룬 비석 하단 중앙 받침대`prop` | block-12-15 c25 r15 |
| 476 | 절벽 자갈 대각 사면 `cliff` | 거대 비석 받침대 우측 `prop` | 거대 비석 받침대 우측`prop` · 거대 비석 우측 하단`prop` · 대형 묘비 오른쪽 하단`prop` · 룬 비석 우하단 받침대`prop` | block-12-15 c26 r15 |
| 477 | 절벽 모서리 모래층 우 `cliff` | 베이지색 천막 왼쪽 하단 벽면 `wall` | 천막 좌하단 기둥`wall` · 원형 천막 벽 좌측 하단`prop` · 텐트 왼쪽 천 벽 하단`wall` · 베이지색 천막 왼쪽 하단`prop` · 천막 좌하단 지지대`wall` · 베이지색 천막 왼쪽 하단 벽면`wall` | block-12-15 c27 r15 |
| 478 | 검은 절벽 위 돌 하단 `cliff` | 원형 천막 입구 하단 `door` | 천막 입구 하단`door` · 원형 천막 입구 하단`door` · 검은 천막 입구 하단`door` · 천막 입구 하단`door` | block-12-15 c28 r15 |
| 479 | 절벽 모서리 모래층 좌 `cliff` | 베이지색 천막 오른쪽 하단 벽면 `wall` | 천막 우하단 기둥`wall` · 원형 천막 벽 우측 하단`prop` · 텐트 오른쪽 천 벽 하단`wall` · 베이지색 천막 오른쪽 하단`prop` · 천막 우하단 지지대`wall` · 베이지색 천막 오른쪽 하단 벽면`wall` | block-12-15 c29 r15 |

## retro_house — 교정 321칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 0 | 두레박 달린 우물 `prop` | 물가 상단 프레임 1 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 1`water` | block-00-03 c0 r0 |
| 1 | 돌로 쌓은 우물 `prop` | 물가 상단 프레임 2 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 2`water` | block-00-03 c1 r0 |
| 2 | 물 가득한 우물 `prop` | 물가 상단 프레임 3 `water` | 물`water` · 물`water` · 물`water` · 물가 상단 프레임 3`water` | block-00-03 c2 r0 |
| 3 | 잔잔한 파란 물 `water` | 석조 수로 상단 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 1`water` | block-00-03 c3 r0 |
| 4 | 잔물결이 인 물 `water` | 석조 수로 상단 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 2`water` | block-00-03 c4 r0 |
| 5 | 굵은 물결 수면 `water` | 석조 수로 상단 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 상단 프레임 3`water` | block-00-03 c5 r0 |
| 6 | 흰꽃 핀 관목 `plant` | 잔디 위 작은 눈밭 `terrain` | 눈 덮인 잔디`terrain` · 눈 덮인 잔디`terrain` · 눈`terrain` · 잔디 위 작은 눈밭`terrain` | block-00-03 c6 r0 |
| 8 | 흰 민무늬 벽면 `wall` | 잔디 위 둥근 눈밭 `terrain` | 눈밭`terrain` · 눈밭 상단`terrain` · 눈`terrain` · 잔디 위 둥근 눈밭`terrain` | block-00-03 c8 r0 |
| 9 | 짙은 녹음 나무 `tree` | 잔디 위 작은 덤불 `tree` | 작은 수풀`plant` · 덤불`plant` · 관목`plant` · 잔디 위 작은 덤불`plant` | block-00-03 c9 r0 |
| 11 | 빽빽한 어두운 나무 `tree` | 잔디 위 둥근 덤불 `tree` | 짙은 수풀`plant` · 덤불`plant` · 관목`plant` · 잔디 위 둥근 덤불`plant` | block-00-03 c11 r0 |
| 12 | 나무 침대 머리 좌 `furniture` | 목조 벽돌벽 상단 좌측 보 `wall` | 목조 기둥 상단`wall` · 목조 벽돌 벽 상단 좌측`wall` · 목조 보`wall` · 목조 벽돌벽 상단 좌측 보`wall` | block-00-03 c12 r0 |
| 13 | 나무 침대 머리 중앙 `furniture` | 목조 벽돌벽 상단 중앙 보 `wall` | 목조 보 상단`wall` · 목조 벽돌 벽 상단 중앙`wall` · 목조 보`wall` · 목조 벽돌벽 상단 중앙 보`wall` | block-00-03 c13 r0 |
| 14 | 나무 침대 머리 우 `furniture` | 목조 벽돌벽 상단 우측 보 `wall` | 목조 기둥 상단`wall` · 목조 벽돌 벽 상단 우측`wall` · 목조 보`wall` · 목조 벽돌벽 상단 우측 보`wall` | block-00-03 c14 r0 |
| 15 | 나무 침대 발치 좌 `furniture` | 목조 회벽 상단 좌측 보 `wall` | 목조 기둥 상단`wall` · 목조 회벽 상단 좌측`wall` · 목조 보`wall` · 목조 회벽 상단 좌측 보`wall` | block-00-03 c15 r0 |
| 16 | 나무 침대 발치 중앙 `furniture` | 목조 회벽 상단 중앙 보 `wall` | 목조 보 상단`wall` · 목조 회벽 상단 중앙`wall` · 목조 보`wall` · 목조 회벽 상단 중앙 보`wall` | block-00-03 c16 r0 |
| 17 | 나무 침대 발치 우 `furniture` | 목조 회벽 상단 우측 보 `wall` | 목조 기둥 상단`wall` · 목조 회벽 상단 우측`wall` · 목조 보`wall` · 목조 회벽 상단 우측 보`wall` | block-00-03 c17 r0 |
| 19 | 가운데 잿빛 석벽 `wall` | 석조 아치문 상단 중앙 `wall` | 성문 상부 아치`wall` · 성벽 다리 통로 상단`wall` · 석조 대문 상부`gate` · 석조 아치문 상단 중앙`wall` | block-00-03 c19 r0 |
| 24 | 어두운 사다리 왼쪽 `ladder` | 원형 돌 우물 상단 좌측 `prop` | 원형 돌 우물 상단 좌측`prop` · 우물 상단 좌측`prop` · 돌 우물`prop` · 석조 우물 상단 좌측`prop` | block-00-03 c24 r0 |
| 25 | 어두운 사다리 오른쪽 `ladder` | 원형 돌 우물 상단 우측 `prop` | 원형 돌 우물 상단 우측`prop` · 우물 상단 우측`prop` · 돌 우물`prop` · 석조 우물 상단 우측`prop` | block-00-03 c25 r0 |
| 26 | 뾰족한 어두운 구조물 `decoration` | 석조 화덕 상단 좌측 `prop` | 석조 화덕 상단 좌측`prop` · 석조 화덕 상단 좌측`prop` · 돌 구덩이`prop`* · 어두운 암석 좌측`rock` | block-00-03 c26 r0 |
| 27 | 검푸른 덩어리 구조물 `decoration` | 석조 화덕 상단 우측 `prop` | 석조 화덕 상단 우측`prop` · 석조 화덕 상단 우측`prop` · 돌 구덩이`prop`* · 어두운 암석 우측`rock` | block-00-03 c27 r0 |
| 28 | 세로 검푸른 기둥 `pillar` | 묘비 `prop` | 묘비`prop` · 묘비`prop` · 묘비`prop` · 묘비`prop` | block-00-03 c28 r0 |
| 29 | 보라꽃 장식 덤불 `decoration` | 자수정 원석 `rock` | 돌 무더기`rock` · 바위 더미`rock` · 자수정 원석`rock` · 광석 더미`rock` | block-00-03 c29 r0 |
| 30 | 잔디 낀 물가 `water` | 세로 수로 물 프레임 1 `water` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 1`water` | block-00-03 c0 r1 |
| 31 | 풀섶 낀 물가 `water` | 세로 수로 물 프레임 2 `water` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 2`water` | block-00-03 c1 r1 |
| 32 | 잔디 모서리 물가 `water` | 세로 수로 물 프레임 3 `water` | 물`water` · 수로 물`water` · 물`water` · 세로 수로 물 프레임 3`water` | block-00-03 c2 r1 |
| 33 | 짙은 파란 물결 `water` | 석조 세로 수로 물 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 1`water` | block-00-03 c3 r1 |
| 34 | 예리한 물결 수면 `water` | 석조 세로 수로 물 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 2`water` | block-00-03 c4 r1 |
| 35 | 포개진 물결 수면 `water` | 석조 세로 수로 물 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 세로 수로 물 프레임 3`water` | block-00-03 c5 r1 |
| 36 | 흰꽃 무성한 수풀 `plant` | 눈밭 가장자리 좌상단 `terrain` | 눈밭 가장자리 좌상단`terrain` · 눈밭 가장자리 좌상단`terrain` · 눈`terrain` · 눈밭 좌상단`terrain` | block-00-03 c6 r1 |
| 37 | 흰꽃 낀 초원 `terrain` | 눈밭 가장자리 상단 `terrain` | 눈밭 가장자리 상단`terrain` · 눈밭 가장자리 상단`terrain` · 눈`terrain` · 눈밭 상단`terrain` | block-00-03 c7 r1 |
| 38 | 흰꽃 낀 덤불 `plant` | 눈밭 가장자리 우상단 `terrain` | 눈밭 가장자리 우상단`terrain` · 눈밭 가장자리 우상단`terrain` · 눈`terrain` · 눈밭 우상단`terrain` | block-00-03 c8 r1 |
| 39 | 울창한 초록 나무 `tree` | 덤불 가장자리 좌상단 `tree` | 숲 캐노피 좌상단`plant` · 덤불 가장자리 좌상단`plant` · 덤불`plant` · 덤불 좌상단`plant` | block-00-03 c9 r1 |
| 40 | 그늘진 짙은 나무 `tree` | 덤불 가장자리 상단 `tree` | 숲 캐노피 상단`plant` · 덤불 가장자리 상단`plant` · 덤불`plant` · 덤불 상단`plant` | block-00-03 c10 r1 |
| 41 | 무성한 나무 군락 `tree` | 덤불 가장자리 우상단 `tree` | 숲 캐노피 우상단`plant` · 덤불 가장자리 우상단`plant` · 덤불`plant` · 덤불 우상단`plant` | block-00-03 c11 r1 |
| 42 | 자줏빛 무늬 기와 `roof` | 목조 벽돌벽 중간 좌측 기둥 `wall` | 목조 기둥 석벽 좌측`wall` · 목조 벽돌 벽 좌측`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 좌측 기둥`wall` | block-00-03 c12 r1 |
| 43 | 보라 화려한 기와 `roof` | 목조 벽돌벽 중간 벽돌 `wall` | 석조 벽`wall` · 벽돌 벽 중앙`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 벽돌`wall` | block-00-03 c13 r1 |
| 44 | 연보라 무늬 기와 `roof` | 목조 벽돌벽 중간 우측 기둥 `wall` | 목조 기둥 석벽 우측`wall` · 목조 벽돌 벽 우측`wall` · 돌 벽`wall` · 목조 벽돌벽 중간 우측 기둥`wall` | block-00-03 c14 r1 |
| 45 | 회백 크림 기와 `roof` | 목조 회벽 중간 좌측 기둥 `wall` | 목조 기둥 회벽 좌측`wall` · 목조 회벽 좌측`wall` · 회벽`wall` · 목조 회벽 중간 좌측 기둥`wall` | block-00-03 c15 r1 |
| 46 | 밝은 크림 기와 `roof` | 목조 회벽 중간 회벽 `wall` | 회반죽 벽`wall` · 회벽 중앙`wall` · 회벽`wall` · 목조 회벽 중간 회벽`wall` | block-00-03 c16 r1 |
| 47 | 크림 무늬 기와 `roof` | 목조 회벽 중간 우측 기둥 `wall` | 목조 기둥 회벽 우측`wall` · 목조 회벽 우측`wall` · 회벽`wall` · 목조 회벽 중간 우측 기둥`wall` | block-00-03 c17 r1 |
| 48 | 왼쪽 회청 석벽 `wall` | 석조 아치문 좌측 기둥 `wall` | 성문 통로 좌측 벽`wall` · 석조 난간 좌측`wall` · 석조 문기둥`gate` · 석조 아치문 좌측 기둥`wall` | block-00-03 c18 r1 |
| 49 | 연한 회색 석벽 `wall` | 석조 아치문 통로 바닥 상단 `floor` | 성문 통로 바닥`floor` · 성벽 다리 바닥`floor` · 문짝`gate`* · 석조 아치문 통로 바닥 상단`floor` | block-00-03 c19 r1 |
| 50 | 오른쪽 회청 석벽 `wall` | 석조 아치문 우측 기둥 `wall` | 성문 통로 우측 벽`wall` · 석조 난간 우측`wall` · 석조 문기둥`gate` · 석조 아치문 우측 기둥`wall` | block-00-03 c20 r1 |
| 54 | 북서 방향 계단 `stairs` | 원형 돌 우물 하단 좌측 `prop` | 원형 돌 우물 하단 좌측`prop` · 우물 하단 좌측`prop` · 돌 우물`prop` · 석조 우물 하단 좌측`prop` | block-00-03 c24 r1 |
| 55 | 북동 방향 계단 `stairs` | 원형 돌 우물 하단 우측 `prop` | 원형 돌 우물 하단 우측`prop` · 우물 하단 우측`prop` · 돌 우물`prop` · 석조 우물 하단 우측`prop` | block-00-03 c25 r1 |
| 56 | 남서 방향 계단 `stairs` | 눈 덮인 석조 우물 하단 좌측 `prop` | 석조 화덕 하단 좌측`prop` · 석조 화덕 하단 좌측`prop` · 돌 구덩이`prop`* · 눈 덮인 석조 우물 하단 좌측`prop` | block-00-03 c26 r1 |
| 57 | 남동 방향 계단 `stairs` | 눈 덮인 석조 우물 하단 우측 `prop` | 석조 화덕 하단 우측`prop` · 석조 화덕 하단 우측`prop` · 돌 구덩이`prop`* · 눈 덮인 석조 우물 하단 우측`prop` | block-00-03 c27 r1 |
| 58 | 회색 격자 울타리 `fence` | 철제 격자문 `gate` | 철제 격자문`gate` · 철창 문`gate` · 철창`prop` · 철창문`door` | block-00-03 c28 r1 |
| 59 | 회보라 장식 구조물 `decoration` | 작은 광석 더미 `rock` | 작은 돌과 자갈`rock` · 작은 돌더미`rock` · 자수정 결정`rock` · 작은 광석 더미`rock` | block-00-03 c29 r1 |
| 60 | 나무둑 낀 물가 `water` | 가로 수로 물 프레임 1 `water` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 1`water` | block-00-03 c0 r2 |
| 61 | 목재 둑 낀 물가 `water` | 가로 수로 물 프레임 2 `water` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 2`water` | block-00-03 c1 r2 |
| 62 | 통나무 낀 물가 `water` | 가로 수로 물 프레임 3 `water` | 물`water` · 수로 물`water` · 물`water` · 가로 수로 물 프레임 3`water` | block-00-03 c2 r2 |
| 63 | 고른 파란 수면 `water` | 석조 가로 수로 물 프레임 1 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 1`water` | block-00-03 c3 r2 |
| 64 | 잔잔한 수면 물 `water` | 석조 가로 수로 물 프레임 2 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 2`water` | block-00-03 c4 r2 |
| 65 | 푸른 잔물결 `water` | 석조 가로 수로 물 프레임 3 `water` | 수로 물`water` · 수로 물`water` · 물`water` · 석조 가로 수로 물 프레임 3`water` | block-00-03 c5 r2 |
| 66 | 흰꽃 초록 덤불 `plant` | 눈밭 가장자리 좌측 `terrain` | 눈밭 가장자리 좌측`terrain` · 눈밭 가장자리 좌측`terrain` · 눈`terrain` · 눈밭 좌측`terrain` | block-00-03 c6 r2 |
| 67 | 흰 민무늬 벽면 `wall` | 눈밭 중앙 `terrain` | 눈 바닥`terrain` · 눈밭`terrain` · 눈`terrain` · 눈밭 중앙`terrain` | block-00-03 c7 r2 |
| 68 | 흰꽃 섞인 잔디 `terrain` | 눈밭 가장자리 우측 `terrain` | 눈밭 가장자리 우측`terrain` · 눈밭 가장자리 우측`terrain` · 눈`terrain` · 눈밭 우측`terrain` | block-00-03 c8 r2 |
| 69 | 짙은 숲 나무 `tree` | 덤불 가장자리 좌측 `tree` | 숲 캐노피 좌측`plant` · 덤불 가장자리 좌측`plant` · 덤불`plant` · 덤불 좌측`plant` | block-00-03 c9 r2 |
| 70 | 빽빽한 숲 나무 `tree` | 숲 캐노피 중앙 `tree` | 숲 캐노피 중앙`plant` · 덤불`plant` · 덤불`plant` · 덤불 중앙`plant` | block-00-03 c10 r2 |
| 71 | 그윽한 숲 그늘 `tree` | 덤불 가장자리 우측 `tree` | 숲 캐노피 우측`plant` · 덤불 가장자리 우측`plant` · 덤불`plant` · 덤불 우측`plant` | block-00-03 c11 r2 |
| 72 | 붉은 갈 무늬 기와 `roof` | 목조 벽돌벽 하단 좌측 기둥 `wall` | 목조 기둥 석벽 좌측`wall` · 목조 벽돌 벽 하단 좌측`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 좌측 기둥`wall` | block-00-03 c12 r2 |
| 73 | 붉은색 무늬 기와 `roof` | 목조 벽돌벽 하단 벽돌 `wall` | 석조 벽`wall` · 벽돌 벽 하단 중앙`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 벽돌`wall` | block-00-03 c13 r2 |
| 74 | 진홍 무늬 기와 `roof` | 목조 벽돌벽 하단 우측 기둥 `wall` | 목조 기둥 석벽 우측`wall` · 목조 벽돌 벽 하단 우측`wall` · 돌 벽`wall` · 목조 벽돌벽 하단 우측 기둥`wall` | block-00-03 c14 r2 |
| 75 | 미색 무늬 기와 `roof` | 목조 회벽 하단 좌측 기둥 `wall` | 목조 기둥 회벽 좌측`wall` · 목조 회벽 하단 좌측`wall` · 회벽`wall` · 목조 회벽 하단 좌측 기둥`wall` | block-00-03 c15 r2 |
| 76 | 하얀 크림 기와 `roof` | 목조 회벽 하단 회벽 `wall` | 회반죽 벽`wall` · 회벽 하단 중앙`wall` · 회벽`wall` · 목조 회벽 하단 회벽`wall` | block-00-03 c16 r2 |
| 77 | 베이지 무늬 기와 `roof` | 목조 회벽 하단 우측 기둥 `wall` | 목조 기둥 회벽 우측`wall` · 목조 회벽 하단 우측`wall` · 회벽`wall` · 목조 회벽 하단 우측 기둥`wall` | block-00-03 c17 r2 |
| 78 | 왼쪽 회색 돌벽 `wall` | 석조 아치문 하단 좌측 기둥 `wall` | 성문 하단 좌측 벽`wall` · 성벽 다리 기둥 좌측`wall` · 석조 문기둥`gate` · 석조 아치문 하단 좌측 기둥`wall` | block-00-03 c18 r2 |
| 79 | 거친 회색 돌벽 `wall` | 석조 아치문 통로 바닥 하단 `floor` | 성문 바닥 통로`floor` · 다리 밑 통로`floor` · 문짝 아래`gate`* · 석조 아치문 통로 바닥 하단`floor` | block-00-03 c19 r2 |
| 80 | 오른쪽 회색 돌벽 `wall` | 석조 아치문 하단 우측 기둥 `wall` | 성문 하단 우측 벽`wall` · 성벽 다리 기둥 우측`wall` · 석조 문기둥`gate` · 석조 아치문 하단 우측 기둥`wall` | block-00-03 c20 r2 |
| 84 | 타오르는 화톳불 `torch` | 다채로운 보석 더미 `prop` | 물품 더미`prop` · 보석 더미`prop` · 천 더미`prop`* · 다채로운 보석 더미`prop` | block-00-03 c24 r2 |
| 85 | 나무 문틀 `gate` | 목재 격자 창문 `window` | 격자 창문`window` · 나무 창문`window` · 창문`window` · 목재 격자 창문`window` | block-00-03 c25 r2 |
| 86 | 걸린 표지판 `sign` | 커튼 달린 목재 창문 `window` | 커튼 창문`window` · 커튼 창문`window` · 창문`window`* · 커튼 달린 목재 창문`window` | block-00-03 c26 r2 |
| 88 | 뾰족한 나무문 `door` | 닫힌 목재 덧문 창문 `window` | 나무 상자 더미`prop` · 나무 덧문 창문`window` · 나무 선반`furniture`* · 닫힌 목재 덧문 창문`window` | block-00-03 c28 r2 |
| 89 | 청록 잎 무더기 `decoration` | 얼음 파편 `decoration` | 얼음 파편`decoration` · 얼음 파편`decoration` · 물방울`decoration`* · 얼음 파편`decoration` | block-00-03 c29 r2 |
| 90 | 기둥 세운 물가 `water` | 깊은 수면 물 프레임 1 `water` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 1`water` | block-00-03 c0 r3 |
| 91 | 목책 둘린 물가 `water` | 깊은 수면 물 프레임 2 `water` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 2`water` | block-00-03 c1 r3 |
| 92 | 세로 기둥 낀 물 `water` | 깊은 수면 물 프레임 3 `water` | 깊은 물`water` · 물`water` · 물`water` · 깊은 수면 물 프레임 3`water` | block-00-03 c2 r3 |
| 93 | 격자무늬 물결 `water` | 석조 수로 깊은 물 프레임 1 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 1`water` | block-00-03 c3 r3 |
| 94 | 휘감긴 물결 `water` | 석조 수로 깊은 물 프레임 2 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 2`water` | block-00-03 c4 r3 |
| 95 | 무늬진 수면 `water` | 석조 수로 깊은 물 프레임 3 `water` | 깊은 수로 물`water` · 수로 물`water` · 물`water` · 석조 수로 깊은 물 프레임 3`water` | block-00-03 c5 r3 |
| 96 | 흰꽃 낀 초록 덤불 `plant` | 눈밭 가장자리 좌하단 `terrain` | 눈밭 가장자리 좌하단`terrain` · 눈밭 가장자리 좌하단`terrain` · 눈`terrain` · 눈밭 좌하단`terrain` | block-00-03 c6 r3 |
| 97 | 흰 민무늬 벽면 `wall` | 눈밭 가장자리 하단 `terrain` | 눈밭 가장자리 하단`terrain` · 눈밭 가장자리 하단`terrain` · 눈`terrain` · 눈밭 하단`terrain` | block-00-03 c7 r3 |
| 98 | 흰꽃 핀 초록 덤불 `plant` | 눈밭 가장자리 우하단 `terrain` | 눈밭 가장자리 우하단`terrain` · 눈밭 가장자리 우하단`terrain` · 눈`terrain` · 눈밭 우하단`terrain` | block-00-03 c8 r3 |
| 99 | 어두운 수풀 나무 `tree` | 덤불 가장자리 좌하단 `tree` | 숲 캐노피 좌하단`plant` · 덤불 가장자리 좌하단`plant` · 덤불`plant` · 덤불 좌하단`plant` | block-00-03 c9 r3 |
| 100 | 빽빽한 나무숲 `tree` | 덤불 가장자리 하단 `tree` | 숲 캐노피 하단`plant` · 덤불 가장자리 하단`plant` · 덤불`plant` · 덤불 하단`plant` | block-00-03 c10 r3 |
| 101 | 짙은 잎 나무 `tree` | 덤불 가장자리 우하단 `tree` | 숲 캐노피 우하단`plant` · 덤불 가장자리 우하단`plant` · 덤불`plant` · 덤불 우하단`plant` | block-00-03 c11 r3 |
| 102 | 짙은 갈색 기와 `roof` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 좌측`floor` | block-00-03 c12 r3 |
| 103 | 밤빛 무늬 기와 `roof` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 중앙`floor` | block-00-03 c13 r3 |
| 104 | 갈색 줄 기와 `roof` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 우측`floor` | block-00-03 c14 r3 |
| 105 | 먼지 낀 갈 기와 `roof` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 1`floor` | block-00-03 c15 r3 |
| 106 | 어두운 갈 기와 `roof` | 통나무 벽 상단 `wall` | 통나무 벽 상단`wall` · 나무 판자 벽`wall` · 나무 판자 벽`wall` · 목재 마루 바닥 2`floor` | block-00-03 c16 r3 |
| 107 | 어두운 무늬 기와 `roof` | 목재 격자 트렐리스 `fence` | 목재 격자 트렐리스`fence` · 격자 울타리`fence` · 격자무늬 장식 기둥`decoration`* · 다이아몬드 격자 바닥 타일`floor` | block-00-03 c17 r3 |
| 111 | 회색 조약돌 바닥 `floor` | 석조 기둥 벽 좌측 `wall` | 석조 기둥 벽 좌측`wall` · 석조 벽 하단 좌측`wall` · 낮은 돌담`wall` · 석벽 하단 좌측`wall` | block-00-03 c21 r3 |
| 112 | 청회 타일 바닥 `floor` | 석조 판석 벽 중앙 `wall` | 석조 판석 벽 중앙`wall` · 석조 벽 하단 중앙`wall` · 낮은 돌담`wall` · 석벽 하단 중앙`wall` | block-00-03 c22 r3 |
| 113 | 잿빛 타일 바닥 `floor` | 석조 기둥 벽 우측 `wall` | 석조 기둥 벽 우측`wall` · 석조 벽 하단 우측`wall` · 낮은 돌담`wall` · 석벽 하단 우측`wall` | block-00-03 c23 r3 |
| 114 | 갈색 둥근 항아리 `prop` | 둥근 나무 받침대 `furniture` | 원형 탁자`furniture` · 원형 나무 탁자`furniture` · 둥근 나무 받침대`furniture` · 둥근 목재 탁자`furniture` | block-00-03 c24 r3 |
| 115 | 작은 나무 통 `barrel` | 목재 격자 창문 우측 `window` | 목재 창문 좌측`window` · 나무 창문 좌측`window` · 창문`window` · 목재 격자 창문 우측`window` | block-00-03 c25 r3 |
| 116 | 붉은 갈 벽면 `wall` | 나무 문 `door` | 목재 창문 우측`window` · 나무 창문 우측`window` · 나무 창문 우측`window` · 나무 문`door` · 목재 문`door` · 나무 문`door` | block-00-03 c26 r3 |
| 117 | 둥근 갈색 천막 지붕 `awning` | 목재 서랍장 `furniture` | 나무 수납장`furniture` · 나무 탁자`furniture` · 나무 궤짝`furniture` · 목재 서랍장`furniture` | block-00-03 c27 r3 |
| 118 | 어두운 갈색 천막 `awning` | 기울어진 목재 판자 `furniture` | 기울어진 목재 벤치`furniture` · 비스듬한 나무 탁자`furniture` · 나무 작업대`furniture`* · 기울어진 목재 판자`furniture` | block-00-03 c28 r3 |
| 119 | 새긴 회색 석상 `statue` | 자수정 원석 `rock` | 큰 바위`rock` · 바위`rock` · 자수정 원석`rock` · 보라색 바위`rock` | block-00-03 c29 r3 |
| 120 | 고요한 물 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c0 r4 |
| 121 | 잔잔한 물 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c1 r4 |
| 122 | 푸른 물바닥 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c2 r4 |
| 123 | 깊은 물바닥 `water` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r4 |
| 125 | 고요한 물바닥 `water` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 126 | 잔디 가장자리 지붕 `roof` | 밭 가장자리 흙바닥 `terrain` | 경작지 흙 모서리`terrain` · 경작지 모서리`terrain` · 밭 가장자리 흙바닥`terrain` · 둥근 흙길 테두리`floor` | block-04-07 c6 r4 |
| 127 | 무성한 잔디밭 `terrain` | 잡초 풀밭 `terrain` | 풀밭`terrain` · 풀밭`terrain` · 잡초 풀밭`terrain` · 잔디 바닥`floor` | block-04-07 c7 r4 |
| 128 | 장밋빛 지붕면 `roof` | 밭 흙바닥 `terrain` | 경작지 흙`terrain` · 경작지`terrain` · 밭 흙바닥`terrain` · 흙 바닥`floor` | block-04-07 c8 r4 |
| 129 | 잔디 위 돌덩어리 `rock` | 조약돌 길 가장자리 `terrain` | 자갈길 모서리`terrain` · 자갈길 가장자리`terrain` · 조약돌 길 가장자리`terrain` · 조약돌 바닥 조각`floor` | block-04-07 c9 r4 |
| 130 | 푸른 잔디밭 `terrain` | 잡초 풀밭 `terrain` | 풀밭`terrain` · 풀밭`terrain` · 잡초 풀밭`terrain` · 잔디 바닥`floor` | block-04-07 c10 r4 |
| 131 | 회색 돌바닥 `floor` | 조약돌 바닥 오른쪽 위 `terrain` | 자갈길 모서리`terrain` · 돌길`terrain` · 자갈 바닥`terrain` · 조약돌 바닥`floor` · 조약돌 바닥`floor` · 조약돌 바닥 오른쪽 위`terrain` | block-04-07 c11 r4 |
| 134 | 갈색 판자 벽 `wall` | 금속 장식 목재 벽 우측 상단 `wall` | 통나무 벽 우측`wall` · 통나무 벽`wall` · 통나무 벽 우측`wall` · 금속 장식 목재 벽 우측 상단`wall` | block-04-07 c14 r4 |
| 137 | 나무 창틀 창문 `window` | 팀버프레임 벽 상단 보 `wall` | 목조 골조 벽 상단`wall` · 목조 트러스 벽`wall` · 팀버프레임 벽 상단 보`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c17 r4 |
| 138 | 물과 잔디 경계 `water` | 어두운 석조 아치 입구 좌상단 `wall` | 돌성벽 처마 좌측`wall` · 돌 아치문 상단 좌측`wall` · 어두운 돌벽 아치 상단 좌측`wall` · 어두운 석조 아치 입구 좌상단`wall` | block-04-07 c18 r4 |
| 139 | 잔디와 물 경계 `water` | 어두운 석조 아치 입구 우상단 `wall` | 돌성벽 처마 우측`wall` · 돌 아치문 상단 우측`wall` · 어두운 돌벽 아치 상단 우측`wall` · 어두운 석조 아치 입구 우상단`wall` | block-04-07 c19 r4 |
| 140 | 고요한 물 `water` | 어두운 돌벽 상단 `wall` | 어두운 돌벽`wall` · 어두운 돌벽`wall` · 어두운 돌벽 상단`wall` · 어두운 석조 벽`wall` | block-04-07 c20 r4 |
| 141 | 잔잔한 물 `water` | 어두운 돌벽 상단 `wall` | 어두운 돌벽`wall` · 어두운 돌벽`wall` · 어두운 돌벽 상단`wall` · 어두운 석조 벽`wall` | block-04-07 c21 r4 |
| 142 | 물가 풀밭 `water` | 어두운 돌벽 창문 좌측 `window` | 돌벽 창문 좌측`wall` · 돌벽 창문 좌측`window` · 어두운 돌벽 창문 좌측`window` · 석조 창문 좌측`window` | block-04-07 c22 r4 |
| 143 | 풀밭 물가 `water` | 어두운 돌벽 창문 우측 `window` | 돌벽 창문 우측`wall` · 돌벽 창문 우측`window` · 어두운 돌벽 창문 우측`window` · 석조 창문 우측`window` | block-04-07 c23 r4 |
| 144 | 나무 판자 `prop` | 목재 기둥 상단 `prop` | 긴 목재 기둥 상단`prop` · 세로 탁자 상단`furniture` · 긴 목재 탁자 상단`furniture` · 세로 목재 탁자 상단`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 145 | 물가 나무 구조물 `prop` | 커튼 달린 창문 좌측 `window` | 창문 좌측`window` · 커튼 창문 좌측`window` · 침대 머리맡`furniture` · 푸른 커튼 창문`window` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 146 | 적갈색 헛간 `prop` | 목재 문 하단 `door` | 창문 우측`window` · 커튼 창문 우측`window` · 목재 덮개문`door` · 목재 사각 문`door` · 사각 나무 탁자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 147 | 나무 기둥 `pillar` | 나무 의자 `furniture` | 원형 의자`furniture` · 나무 의자`furniture` · 작은 목재 스툴`furniture` · 작은 목재 의자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 148 | 나무 말뚝 `pillar` | 나무 협탁 `furniture` | 목재 의자 등받이`furniture` · 협탁`furniture` · 작은 목재 협탁`furniture` · 목재 협탁`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 149 | 물 위 나무 다리 `prop` | 바위에 꽂힌 곡괭이 `prop` | 레버`prop` · 레버`prop` · 흙더미에 꽂힌 삽`prop` · 바위에 꽂힌 곡괭이`prop` | block-04-07 c29 r4 |
| 150 | 잔잔한 물 `water` | 어두운 물 소용돌이 좌측 `water` | 어두운 물 웅덩이 좌측`water` · 깊은 물`water` · 어두운 물 소용돌이 좌측`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c0 r5 |
| 151 | 고요한 물바닥 `water` | 어두운 물 소용돌이 중앙 `water` | 어두운 물 웅덩이 중앙`water` · 깊은 물`water` · 어두운 물 소용돌이 중앙`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c1 r5 |
| 152 | 푸른 물빛 `water` | 어두운 물 소용돌이 우측 `water` | 어두운 물 웅덩이 우측`water` · 깊은 물`water` · 어두운 물 소용돌이 우측`water` · 어두운 원형 웅덩이 상단`terrain` | block-04-07 c2 r5 |
| 153 | 물 표면 `water` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r5 |
| 155 | 깊은 물바닥 `water` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 156 | 잔디가 낀 지붕 `roof` | 새싹 밭이랑 좌측 `terrain` | 작물이 심어진 밭 좌단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌측 가장자리`terrain` · 새싹 밭고랑 좌측`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 157 | 지붕 표면 `roof` | 새싹 밭이랑 중앙 `terrain` | 작물이 심어진 밭 중앙`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 중앙`terrain` · 새싹 밭고랑 중앙`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 158 | 잔디 언저리 지붕 `roof` | 새싹 밭이랑 우측 `terrain` | 작물이 심어진 밭 우단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우측 가장자리`terrain` · 새싹 밭고랑 우측`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 159 | 잔디 낀 돌길 `path` | 조약돌 바닥 좌상단 가장자리 `terrain` | 자갈길 좌상단`terrain` · 돌길 좌상단 모서리`terrain` · 조약돌 바닥 좌상단 가장자리`terrain` · 조약돌 바닥 좌상단 테두리`floor` | block-04-07 c9 r5 |
| 160 | 돌길 모서리 `path` | 조약돌 바닥 상단 가장자리 `terrain` | 자갈길 상단`terrain` · 돌길 상단 가장자리`terrain` · 조약돌 바닥 상단 가장자리`terrain` · 조약돌 바닥 상단 테두리`floor` | block-04-07 c10 r5 |
| 161 | 잔디와 돌길 `path` | 조약돌 바닥 우상단 가장자리 `terrain` | 자갈길 우상단`terrain` · 돌길 우상단 모서리`terrain` · 조약돌 바닥 우상단 가장자리`terrain` · 조약돌 바닥 우상단 테두리`floor` | block-04-07 c11 r5 |
| 167 | 무늬 있는 나무 벽 `wall` | 팀버프레임 목재 기둥 벽 `wall` | 목재 기둥 마감재`wall` · 목재 벽 기둥`wall` · 팀버프레임 목재 기둥`wall` · 팀버프레임 목재 기둥 벽`wall` | block-04-07 c17 r5 |
| 168 | 나무 판자 바닥 `floor` | 나무 판자 벽 좌측 `wall` | 나무 바닥 상단 좌측`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 좌측`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 왼쪽 위`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 169 | 판자 바닥 `floor` | 나무 판자 벽 중앙 `wall` | 나무 바닥 상단 중앙`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 중앙`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 위쪽`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 170 | 나무 바닥 `floor` | 나무 판자 벽 우측 `wall` | 나무 바닥 상단 우측`floor` · 나무 판자 벽 상단`wall` · 목재 벽 상단 우측`wall` · 목재 바닥 상단`floor` · 세로 판자 바닥 오른쪽 위`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 171 | 널빤지 마루 `floor` | 가로 목재 판자벽 좌측 `wall` | 나무 벽 좌단`wall` · 나무 판자 벽 좌측`wall` · 목재 판자 벽 좌측`wall` · 가로 목재 판자벽 좌측`wall` | block-04-07 c21 r5 |
| 172 | 나무 마루 `floor` | 가로 목재 판자벽 중앙 `wall` | 나무 벽 중앙`wall` · 나무 판자 벽 중앙`wall` · 목재 판자 벽 중앙`wall` · 가로 목재 판자벽 중앙`wall` | block-04-07 c22 r5 |
| 173 | 목재 마루 `floor` | 가로 목재 판자벽 우측 `wall` | 나무 벽 우단`wall` · 나무 판자 벽 우측`wall` · 목재 판자 벽 우측`wall` · 가로 목재 판자벽 우측`wall` | block-04-07 c23 r5 |
| 174 | 나무 격자 울타리 `fence` | 목재 기둥 중간 `prop` | 긴 목재 기둥 상단부`prop` · 세로 탁자 중앙`furniture` · 긴 목재 탁자 중단`furniture` · 세로 목재 탁자 중앙`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 175 | 나무 탁자 `furniture` | 나무 의자 앞모습 `furniture` | 목재 의자 정면`furniture` · 나무 의자 앞모습`furniture` · 목재 의자 정면`furniture` · 전면 목재 의자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 176 | 나무 벤치 `furniture` | 나무 의자 뒷모습 `furniture` | 목재 의자 정면`furniture` · 나무 의자 뒷모습`furniture` · 목재 의자 후면`furniture` · 후면 목재 의자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 177 | 쇠테 나무 상자 `chest` | 쇠테 나무 술통 `prop` | 나무 통`furniture` · 나무 술통`prop` · 목재 나무통`prop` · 목재 술통`prop` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 178 | 알록달록 꽃송이 `decoration` | 구운 고기 덩어리 `prop` | 구운 고기`prop` · 음식 바구니`prop` · 구운 고기 덩어리`prop` · 통구이 고기 요리`prop` | block-04-07 c28 r5 |
| 179 | 붉은 깃발 `banner` | 붉은 제비꼬리 깃발 상단 `decoration` | 붉은 깃발 상단`decoration` · 깃발 상단`decoration` · 붉은색 배너 상단`decoration` · 빨간색 문장 깃발`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 180 | 잔잔한 물 `water` | 어두운 물 소용돌이 하단 좌측 `water` | 어두운 물 웅덩이 좌측`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 좌측`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c0 r6 |
| 181 | 잔잔한 물바닥 `water` | 어두운 물 소용돌이 하단 중앙 `water` | 어두운 물 웅덩이 중앙`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 중앙`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c1 r6 |
| 182 | 고요한 물 `water` | 어두운 물 소용돌이 하단 우측 `water` | 어두운 물 웅덩이 우측`water` · 깊은 물`water` · 어두운 물 소용돌이 하단 우측`water` · 어두운 원형 웅덩이 하단`terrain` | block-04-07 c2 r6 |
| 183 | 잔잔한 물 `water` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r6 |
| 185 | 깊은 물바닥 `water` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 186 | 잔디 가장자리 지붕 `roof` | 새싹 밭이랑 좌측 `terrain` | 작물이 심어진 밭 좌단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌측 가장자리`terrain` · 새싹 밭고랑 좌측`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 187 | 지붕 표면 `roof` | 새싹 밭이랑 중앙 `terrain` | 작물이 심어진 밭 중앙`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 중앙`terrain` · 새싹 밭고랑 중앙`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 188 | 잔디가 낀 지붕 `roof` | 새싹 밭이랑 우측 `terrain` | 작물이 심어진 밭 우단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우측 가장자리`terrain` · 새싹 밭고랑 우측`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 189 | 돌길 언저리 `path` | 조약돌 바닥 좌측 가장자리 `terrain` | 자갈길 좌측`terrain` · 돌길 좌측 가장자리`terrain` · 조약돌 바닥 좌측 가장자리`terrain` · 조약돌 바닥 좌측 테두리`floor` | block-04-07 c9 r6 |
| 190 | 회색 돌바닥 `floor` | 조약돌 바닥 가운데 `terrain` | 자갈길 중앙`terrain` · 돌길`terrain` · 자갈 바닥 중앙`terrain` · 조약돌 바닥 중앙`floor` · 조약돌 바닥 중앙`floor` · 조약돌 바닥 가운데`terrain` | block-04-07 c10 r6 |
| 191 | 잔디 섞인 돌바닥 `floor` | 조약돌 바닥 우측 가장자리 `terrain` | 자갈길 우측`terrain` · 돌길 우측 가장자리`terrain` · 조약돌 바닥 우측 가장자리`terrain` · 조약돌 바닥 우측 테두리`floor` | block-04-07 c11 r6 |
| 192 | 나무 판자 바닥 `floor` | 세로 목재 판자벽 `wall` | 목재 벽 좌단`wall` · 나무 판자 벽`wall` · 가로 목재 바닥`floor` · 세로 목재 판자벽`wall` | block-04-07 c12 r6 |
| 193 | 구멍 난 나무 바닥 `floor` | 옹이구멍 있는 목재 벽 `wall` | 얼룩진 목재 벽/문`wall` · 옹이 구멍 난 나무 벽`wall` · 옹이구멍 있는 목재 벽`wall` · 구멍 난 목재 판자벽`wall` | block-04-07 c13 r6 |
| 194 | 무늬 새긴 나무 문 `door` | 돌벽 팀버프레임 상단 좌측 `wall` | 반목조 석벽 기둥 상부 1`wall` · 팀버프레임 돌벽 좌측 상단`wall` · 돌벽 팀버프레임 상단 좌측`wall` · 팀버프레임 돌벽 상단`wall` | block-04-07 c14 r6 |
| 195 | 색 무늬 나무 문 `door` | 돌벽 팀버프레임 상단 우측 `wall` | 반목조 석벽 기둥 상부 2`wall` · 팀버프레임 돌벽 우측 상단`wall` · 돌벽 팀버프레임 상단 우측`wall` · 팀버프레임 돌벽 상단`wall` | block-04-07 c15 r6 |
| 196 | 따뜻한 빛 문 `door` | 회벽 팀버프레임 상단 좌측 `wall` | 반목조 석벽 기둥 상부 3`wall` · 팀버프레임 벽 좌측 상단`wall` · 회벽 팀버프레임 상단 좌측`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c16 r6 |
| 197 | 밝은 문 입구 `door` | 회벽 팀버프레임 상단 우측 `wall` | 반목조 석벽 기둥 상부 4`wall` · 팀버프레임 벽 우측 상단`wall` · 회벽 팀버프레임 상단 우측`wall` · 팀버프레임 회벽 상단`wall` | block-04-07 c17 r6 |
| 198 | 나무 마루 바닥 `floor` | 나무 판자 벽 좌측 `wall` | 나무 바닥 좌측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 좌측`wall` · 목재 바닥`floor` · 세로 판자 바닥 왼쪽`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 199 | 판자 마루 `floor` | 나무 판자 벽 중앙 `wall` | 나무 바닥 중앙`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 중앙`wall` · 목재 바닥`floor` · 세로 판자 바닥 중앙`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 200 | 나무 바닥 `floor` | 나무 판자 벽 우측 `wall` | 나무 바닥 우측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 중단 우측`wall` · 목재 바닥`floor` · 세로 판자 바닥 오른쪽`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 201 | 무늬 돌바닥 `floor` | 석조 틀 격자창 `window` | 철제 배수구 창살`floor` · 쇠창살 바닥 격자`floor` · 철제 배수구 격자`floor` · 철제 배수구 창살`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 202 | 창문 달린 나무 벽 `wall` | 과일 상자 노란 과일 `prop` | 곡물 상자`prop` · 노란 과일 상자`furniture` · 과일 상자 노란 과일`prop` · 노란 과일 상자`prop` | block-04-07 c22 r6 |
| 203 | 붉은 지붕 나무 벽 `wall` | 과일 상자 빨간 과일 `prop` | 사과 상자`prop` · 빨간 과일 상자`furniture` · 과일 상자 빨간 과일`prop` · 빨간 사과 상자`prop` | block-04-07 c23 r6 |
| 204 | 나무 격자판 `fence` | 목재 기둥 받침 `prop` | 긴 목재 기둥 하단부`prop` · 세로 탁자 하단`furniture` · 긴 목재 탁자 하단`furniture` · 세로 목재 탁자 하단`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 205 | 나무 기둥 `pillar` | 나무 의자 우향 측면 `furniture` | 목재 의자 측면 좌`furniture` · 나무 의자 옆모습(우향)`furniture` · 목재 의자 측면 좌향`furniture` · 우향 목재 의자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 206 | 나무 말뚝 `pillar` | 나무 의자 좌향 측면 `furniture` | 목재 의자 측면 우`furniture` · 나무 의자 옆모습(좌향)`furniture` · 목재 의자 측면 우향`furniture` · 좌향 목재 의자`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 207 | 나무 격자 무늬 `fence` | 나무 물통 `prop` | 목재 물통`furniture` · 나무 물통`prop` · 작은 나무 양동이`prop` · 작은 목재 통`prop` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 208 | 붉은 지붕 모서리 `roof` | 붉은 삼각 문장 깃발 `decoration` | 뾰족한 붉은 깃발`decoration` · 삼각 문장 깃발`decoration` · 방패형 붉은색 배너`decoration` · 빨간색 삼각 깃발`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 209 | 붉은 지붕 박공 `roof` | 붉은 제비꼬리 깃발 하단 `decoration` | 갈래 붉은 깃발`decoration` · 깃발 하단`decoration` · 삼각 붉은색 배너`decoration` · 빨간색 갈래 깃발`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 210 | 잔잔한 물바닥 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c0 r7 |
| 211 | 고요한 물 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c1 r7 |
| 212 | 잔잔한 물 `water` | 어두운 바다 `water` | 어두운 바다`water` · 깊은 물`water` · 어두운 물`water` · 어두운 남색 타일`terrain` | block-04-07 c2 r7 |
| 213 | 푸른 물빛 `water` | 물결치는 어두운 물 `water` | 물결`water` · 폭포`water` · 물결치는 어두운 물`water` · 물결 파동`water` | block-04-07 c3 r7 |
| 215 | 깊은 물바닥 `water` | 석조 틀 청색 유리창 `window` | 조각된 석판`floor` · 장식 바닥 타일`floor` · 청록색 바닥 타일`floor` · 사각 환기구`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 216 | 잔디 언저리 지붕 `roof` | 작물이 심어진 밭 좌하단 `terrain` | 작물이 심어진 밭 좌하단`terrain` · 새싹 밭이랑 좌측`plant` · 밭 새싹 좌하단 모서리`terrain` · 새싹 밭고랑 좌측`floor` | block-04-07 c6 r7 |
| 217 | 지붕 표면 `roof` | 밭 새싹 하단 가장자리 `terrain` | 작물이 심어진 밭 하단`terrain` · 새싹 밭이랑 중앙`plant` · 밭 새싹 하단 가장자리`terrain` · 새싹 밭고랑 중앙`floor` | block-04-07 c7 r7 |
| 218 | 잔디가 낀 지붕 `roof` | 작물이 심어진 밭 우하단 `terrain` | 작물이 심어진 밭 우하단`terrain` · 새싹 밭이랑 우측`plant` · 밭 새싹 우하단 모서리`terrain` · 새싹 밭고랑 우측`floor` | block-04-07 c8 r7 |
| 219 | 잔디 섞인 돌길 `path` | 조약돌 바닥 좌하단 가장자리 `terrain` | 자갈길 좌하단`terrain` · 돌길 좌하단 모서리`terrain` · 조약돌 바닥 좌하단 가장자리`terrain` · 조약돌 바닥 좌하단 테두리`floor` | block-04-07 c9 r7 |
| 220 | 돌바닥 가장자리 `floor` | 조약돌 바닥 하단 가장자리 `terrain` | 자갈길 하단`terrain` · 돌길 하단 가장자리`terrain` · 조약돌 바닥 하단 가장자리`terrain` · 조약돌 바닥 하단 테두리`floor` | block-04-07 c10 r7 |
| 221 | 돌과 잔디 바닥 `path` | 조약돌 바닥 우하단 가장자리 `terrain` | 자갈길 우하단`terrain` · 돌길 우하단 모서리`terrain` · 조약돌 바닥 우하단 가장자리`terrain` · 조약돌 바닥 우하단 테두리`floor` | block-04-07 c11 r7 |
| 222 | 나무 마루 `floor` | 세로 목재 벽 하단 `wall` | 목재 벽 좌하단`wall` · 세로 나무 판자 벽`wall` · 세로 목재 벽 하단`wall` · 목재 판자벽`wall` | block-04-07 c12 r7 |
| 223 | 가장자리 나무 바닥 `floor` | 어두운 걸레받이 목재 벽 `wall` | 목재 벽 우하단 걸레받이`wall` · 나무 판자 벽 하단`wall` · 어두운 걸레받이 목재 벽`wall` · 목재 판자벽 하단`wall` | block-04-07 c13 r7 |
| 224 | 장식 나무 문 `door` | 돌벽 팀버프레임 하단 좌측 `wall` | 반목조 석벽 기둥 하부 1`wall` · 팀버프레임 돌벽 기둥 좌측`wall` · 돌벽 팀버프레임 하단 좌측`wall` · 목재 기둥 돌벽 하단`wall` | block-04-07 c14 r7 |
| 225 | 틀 있는 나무 문 `door` | 돌벽 팀버프레임 하단 우측 `wall` | 반목조 석벽 기둥 하부 2`wall` · 팀버프레임 돌벽 기둥 우측`wall` · 돌벽 팀버프레임 하단 우측`wall` · 목재 기둥 돌벽 하단`wall` | block-04-07 c15 r7 |
| 226 | 열린 나무 문 `door` | 팀버프레임 회반죽 벽 기둥 좌측 `wall` | 반목조 회벽 기둥 하부 1`wall` · 팀버프레임 회반죽 벽 기둥 좌측`wall` · 회벽 팀버프레임 하단 좌측`wall` · 목재 기둥 회벽 하단`wall` | block-04-07 c16 r7 |
| 227 | 밝은 문 입구 `door` | 팀버프레임 회반죽 벽 기둥 우측 `wall` | 반목조 회벽 기둥 하부 2`wall` · 팀버프레임 회반죽 벽 기둥 우측`wall` · 회벽 팀버프레임 하단 우측`wall` · 목재 기둥 회벽 하단`wall` | block-04-07 c17 r7 |
| 228 | 나무 판자 마루 `floor` | 나무 판자 벽 하단 좌측 `wall` | 나무 바닥 하단 좌측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 좌측`wall` · 목재 바닥`floor` · 세로 판자 바닥 왼쪽 아래`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 229 | 우드 바닥 `floor` | 나무 판자 벽 하단 중앙 `wall` | 나무 바닥 하단 중앙`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 중앙`wall` · 목재 바닥`floor` · 세로 판자 바닥 아래쪽`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 230 | 나무 바닥 `floor` | 나무 판자 벽 하단 우측 `wall` | 나무 바닥 하단 우측`floor` · 세로 나무 판자 벽`wall` · 목재 벽 하단 우측`wall` · 목재 바닥`floor` · 세로 판자 바닥 오른쪽 아래`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 231 | 금빛 무늬 바닥 `floor` | 원형 황금 장식창 `window` | 황금 마법진 바닥`floor` · 마법진`floor` · 황금빛 마법진 바닥`floor` · 마법진 문양 바닥`floor` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 232 | 흰색 울타리 `fence` | 대리석 타일 바닥 `floor` | 대리석 타일 바닥`floor` · 유리 바닥`floor` · 유리 바닥 타일`floor` · 반사 유리 바닥`floor` | block-04-07 c22 r7 |
| 234 | 어두운 나무 벽 `wall` | 긴 나무 벤치 좌측 `furniture` | 긴 목재 탁자 좌측`furniture` · 가로 긴 탁자 좌측`furniture` · 긴 가로 목재 탁자 좌측`furniture` · 긴 목재 탁자 좌측`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 235 | 짙은 갈색 벽 `wall` | 긴 나무 벤치 중앙 `furniture` | 긴 목재 탁자 중앙`furniture` · 가로 긴 탁자 중앙`furniture` · 긴 가로 목재 탁자 중앙`furniture` · 긴 목재 탁자 중앙`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 236 | 어두운 목재 벽 `wall` | 긴 나무 벤치 우측 `furniture` | 긴 목재 탁자 우측`furniture` · 가로 긴 탁자 우측`furniture` · 긴 가로 목재 탁자 우측`furniture` · 긴 목재 탁자 우측`furniture` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 237 | 틀 있는 어두운 벽 `wall` | 나무 궤짝 `prop` | 나무 상자`furniture` · 나무 궤짝`prop` · 나무 보관 상자`prop` · 목재 보관 상자`prop` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 238 | 붉은 지붕 경사 `roof` | 대형 붉은 깃발 좌측 `decoration` | 넓은 붉은 현수막 좌측`decoration` · 대형 깃발 좌측`decoration` · 대형 붉은색 배너 하단 좌측`decoration` · 넓은 빨간색 벽걸이 깃발 좌측`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 239 | 붉은 지붕 경사면 `roof` | 대형 붉은 깃발 우측 `decoration` | 넓은 붉은 현수막 우측`decoration` · 대형 깃발 우측`decoration` · 대형 붉은색 배너 하단 우측`decoration` · 넓은 빨간색 벽걸이 깃발 우측`decoration` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 251 | 거친 검정 암벽 `wall` | 어두운 쇄석 석벽 단일 블록 `wall` | 어두운 돌벽 상단 테두리`wall` · 어두운 돌바닥`floor` · 검은 자갈 석재 바닥`terrain` · 어두운 쇄석 석벽 단일 블록`wall` | block-08-11 c11 r8 |
| 252 | 분홍 나뭇결 판 `floor` | 분홍색 거친 자연석 바닥 `terrain` | 분홍빛 자갈길`floor` · 붉은 자갈 바닥`floor` · 붉은 자연석 벽`wall` · 분홍색 석재 바닥`terrain` · 분홍색 거친 석재 바닥`terrain` · 분홍 회벽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 253 | 푸른 비늘 돌판 `floor` | 청회색 거친 자연석 바닥 `terrain` | 푸른빛 자갈길`floor` · 푸른 자갈 바닥`floor` · 청회색 자연석 벽`wall` · 청회색 석재 바닥`terrain` · 청회색 각진 석재 바닥`terrain` · 청회색 회벽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 259 | 마른 나무 밑동 `tree` | 부러진 나무 그루터기 `prop` | 통나무 더미 상단`prop` · 나뭇가지 더미`prop` · 부러진 나무 밑동`tree` · 부러진 나무 그루터기`prop` | block-08-11 c19 r8 |
| 262 | 오른쪽 연두 관목 `plant` | 둥근 활엽수 좌측 상단 `tree` | 둥근 활엽수 좌측 상단`tree` · 큰 나무 좌상단`tree` · 큰 활엽수 왼쪽 상단`tree` · 큰 활엽수 수관 왼쪽`tree` | block-08-11 c22 r8 |
| 263 | 둥근 연두 관목 `plant` | 큰 활엽수 오른쪽 상단 `tree` | 둥근 활엽수 우측 상단`tree` · 큰 나무 우상단`tree` · 큰 활엽수 오른쪽 상단`tree` · 큰 활엽수 수관 오른쪽`tree` | block-08-11 c23 r8 |
| 265 | 잎 달린 굵은 가지 `tree` | 잎 달린 덩굴 상단 `plant` | 덩굴 상단`plant` · 덩굴 상단`plant` · 덩굴 가지 상단`plant` · 잎 달린 덩굴 상단`plant` | block-08-11 c25 r8 |
| 266 | 방패 문양 묘비 `decoration` | 회색 석상 머리 `prop` | 석상 머리`decoration` · 석상 상단`prop` · 회색 석상 머리`prop` · 회색 석상 상단`prop` | block-08-11 c26 r8 |
| 267 | 회색 이오니아 기둥 `pillar` | 회색 원기둥 머리 `prop` | 석조 기둥 머리`wall` · 석조 기둥 상단`prop` · 회색 원기둥 머리`prop` · 회색 석주 주두`prop` | block-08-11 c27 r8 |
| 268 | 왼쪽 회색 난간상 `decoration` | 아치형 창문 왼쪽 상단 `window` | 책장 지붕 좌측`furniture` · 파이프 오르간 좌상단`furniture` · 책장 상단 왼쪽`furniture` · 아치형 창문 왼쪽 상단`window` · 아치형 창문 왼쪽 상단`window` · 창문 좌측`window` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 269 | 오른쪽 회색 난간상 `decoration` | 아치형 창문 오른쪽 상단 `window` | 책장 지붕 우측`furniture` · 파이프 오르간 우상단`furniture` · 책장 상단 오른쪽`furniture` · 아치형 창문 오른쪽 상단`window` · 아치형 창문 오른쪽 상단`window` · 창문 우측`window` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 280 | 가운데 검은 균열벽 `wall` | 어두운 쇄석벽 상단 중앙 `wall` | 어두운 돌벽 상단`wall` · 어두운 돌바닥 상단`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 상단 중앙`wall` | block-08-11 c10 r9 |
| 282 | 연보라 나뭇결 판 `floor` | 연보라색 거친 자연석 바닥 `terrain` | 분홍빛 자갈길`floor` · 분홍 자갈 바닥`floor` · 분홍 자연석 벽`wall` · 분홍색 석재 바닥`terrain` · 연보라색 석재 바닥`terrain` · 보라 회벽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 283 | 비늘 돌판 `floor` | 회녹색 거친 자연석 바닥 `terrain` | 푸른빛 자갈길`floor` · 청회색 자갈 바닥`floor` · 청록 자연석 벽`wall` · 녹회색 석재 바닥`terrain` · 회녹색 석재 바닥`terrain` · 녹색 회벽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 295 | 새잎 돋은 나뭇가지 `tree` | 잎 달린 덩굴 중단 `plant` | 덩굴 중단`plant` · 덩굴 중단`plant` · 덩굴 가지 중단`plant` · 잎 달린 덩굴 중단`plant` | block-08-11 c25 r9 |
| 296 | 얼굴 새긴 돌조각 `statue` | 회색 석상 몸통 `prop` | 석상 몸체`decoration` · 석상 중단`prop` · 회색 석상 몸통`prop` · 회색 석상 하단`prop` | block-08-11 c26 r9 |
| 297 | 홈 파인 회색 기둥 `pillar` | 회색 원기둥 몸통 `prop` | 석조 기둥 몸체와 기단`wall` · 석조 기둥 하단`prop` · 회색 원기둥 몸통`prop` · 회색 석주 기둥부`prop` | block-08-11 c27 r9 |
| 298 | 왼쪽 갈색 창틀 `window` | 파이프 오르간 좌하단 `furniture` | 책장 본체 좌측`furniture` · 파이프 오르간 좌하단`furniture` · 책장 하단 왼쪽`furniture` · 아치형 창문 왼쪽 하단`window` · 아치형 창문 왼쪽 하단`window` · 책장 좌측`furniture` | block-08-11 c28 r9 |
| 299 | 오른쪽 갈색 창틀 `window` | 파이프 오르간 우하단 `furniture` | 책장 본체 우측`furniture` · 파이프 오르간 우하단`furniture` · 책장 하단 오른쪽`furniture` · 아치형 창문 오른쪽 하단`window` · 아치형 창문 오른쪽 하단`window` · 책장 우측`furniture` | block-08-11 c29 r9 |
| 307 | 가운데 회색 석판벽 `wall` | 돌 벽 내부 바닥 `floor` | 돌 벽 내부 바닥`floor` · 돌길 바닥 중앙`floor` · 회색 석재 바닥 가운데`terrain` · 회색 석벽 중앙`wall` | block-08-11 c7 r10 |
| 310 | 가운데 검정 암석벽 `wall` | 어두운 돌벽 내부 바닥 `floor` | 어두운 돌벽 내부 바닥`floor` · 어두운 돌바닥 중앙`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 중앙`wall` | block-08-11 c10 r10 |
| 312 | 조약돌 바닥 `floor` | 어두운 청회색 거친 자연석 바닥 `terrain` | 짙은 회색 자갈길`floor` · 회색 자갈 바닥`floor` · 어두운 청록 자연석 벽`wall` · 회색 조약돌 바닥`terrain` · 회색 거친 석재 바닥`terrain` · 어두운 회벽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 319 | 검은 세로 돌기 `decoration` | 꺼진 검은 벽걸이 횃불 `prop` | 벽걸이 촛대 거치대`prop` · 벽 레버`prop` · 꺼진 벽 횃불`decoration` · 꺼진 검은 벽걸이 횃불`prop` | block-08-11 c19 r10 |
| 320 | 연두 문양 표지판 `sign` | 문양이 그려진 두루마리 `prop` | 양피지 공고문`prop` · 벽보`prop` · 문양이 그려진 두루마리`prop` · 문자가 새겨진 석판`prop` | block-08-11 c20 r10 |
| 322 | 갈색 나무 사다리 `ladder` | 나무 사다리 `stairs` | 나무 사다리`stairs` · 나무 사다리`stairs` · 나무 사다리`stairs` · 목제 사다리`stairs` | block-08-11 c22 r10 |
| 323 | 보라 십자 석상 `statue` | 보라색 묘비 장식 상단 `prop` | 십자가 묘비 상단`prop` · 묘비 상단`prop` · 보라색 묘비 장식 상단`prop` · 보라색 장식 기둥 상단`prop` | block-08-11 c23 r10 |
| 326 | 회색 매달린 장식 `decoration` | 회색 석상 하단 기단 `decoration` | 석상 하단 기단`decoration` · 석상 받침대`prop` · 석상 하단부`decoration` · 회색 석상 받침`prop` · 회색 벽걸이 장식`decoration`* · 돌 석상 하단`prop` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 327 | 왼쪽 통나무 선반 `counter` | 긴 목제 의자 왼쪽 `furniture` | 나무 벤치 좌측`furniture` · 긴 탁자 좌측`furniture` · 긴 목재 들보 왼쪽`prop` · 긴 목제 의자 왼쪽`furniture` | block-08-11 c27 r10 |
| 328 | 오른쪽 통나무 선반 `counter` | 긴 목제 의자 오른쪽 `furniture` | 나무 벤치 우측`furniture` · 긴 탁자 우측`furniture` · 긴 목재 들보 오른쪽`prop` · 긴 목제 의자 오른쪽`furniture` | block-08-11 c28 r10 |
| 329 | 검은 사각 바닥 `floor` | 검은색 걸개 상단 `decoration` | 동굴 입구 상단`door` · 어두운 입구 상단`door` · 검은 암흑 채움`decoration`* · 검은색 걸개 상단`decoration` · 검은 사각 면`decoration`* · 어두운 실내`wall` | block-08-11 c29 r10 |
| 337 | 가운데 짙은 석판벽 `wall` | 회색 석벽 하단 중앙 `wall` | 돌 벽 하단`wall` · 돌길 바닥 하단`floor` · 회색 석재 바닥 가운데`terrain` · 회색 석벽 하단 중앙`wall` | block-08-11 c7 r11 |
| 340 | 가운데 거친 검은벽 `wall` | 어두운 쇄석벽 하단 중앙 `wall` | 어두운 돌벽 하단`wall` · 어두운 돌바닥 하단`floor` · 검은 석재 바닥 가운데`terrain` · 어두운 쇄석벽 하단 중앙`wall` | block-08-11 c10 r11 |
| 342 | 회갈색 사각 석벽 `wall` | 베이지색 석판 바닥 `floor` | 밝은 석판 바닥`floor` · 밝은 석판 바닥`floor` · 베이지 석재 벽돌 벽`wall` · 베이지색 벽돌 바닥`terrain` · 베이지색 벽돌 바닥`terrain` · 원형 문양 석재`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 343 | 원형 문양 석벽 `wall` | 원형 문양 석판 바닥 `floor` | 원형 문양 석판 바닥`floor` · 원형 문양 석판 바닥`floor` · 원형 문양 석판 바닥`floor` · 원형 문양 석재 바닥`terrain` · 원형 무늬 석재 바닥`terrain` · 원형 문양 석재`wall` | block-08-11 c13 r11 |
| 349 | 조각된 갈색 목문 `door` | 통나무 더미 하단 `prop` | 통나무 더미 하단`prop` · 장작더미`prop` · 갈색 광석 더미`rock`* · 높은 목제 등받이 의자`furniture` | block-08-11 c19 r11 |
| 350 | 붉은 위쪽 화살표 `sign` | 빨간색 튜닉 `prop` | 빨간 우체통`prop` · 빨간 우체통`prop` · 빨간색 튜닉`prop` · 빨간 등받이 의자`furniture` | block-08-11 c20 r11 |
| 351 | 붉은꽃 화분 `plant` | 붉은 꽃 화분 `prop` | 꽃 화분`prop` · 붉은 꽃 화분`prop` · 빨간 꽃 화분`plant` · 붉은 꽃 화분`prop` | block-08-11 c21 r11 |
| 353 | 자주색 서랍장 `furniture` | 보라색 장식 기둥 하단 `prop` | 십자가 묘비 하단 기단`prop` · 묘비 하단`prop` · 보라색 묘비 몸체`prop` · 보라색 장식 기둥 하단`prop` | block-08-11 c23 r11 |
| 358 | 세로 통나무 기둥 `pillar` | 세로 목재 기둥 `prop` | 원목 기둥`prop` · 나무 기둥`prop` · 세로 목재 기둥`prop` · 세로 목재 기둥`prop` | block-08-11 c28 r11 |
| 359 | 어둠 속 보라 울타리 `fence` | 동굴 입구 하단 바닥 `door` | 동굴 입구 하단 바닥`door` · 어두운 입구 하단`door` · 보라색 술 달린 검은 걸개 하단`decoration` · 검은 면과 보라색 울타리`fence`* | block-08-11 c29 r11 |
| 361 | 꽃핀 초원 `terrain` | 초록 잔디 `terrain` | 잔디`terrain` · 잔디 바닥`terrain` · 초록 잔디`terrain` · 잔디 바닥`terrain` | block-12-15 c1 r12 |
| 366 | 금속틀 검은 바닥 `floor` | 돌 테두리 작은 구덩이 `terrain` | 돌 테두리 구덩이`cliff` · 석조 수로 단독 타일`water` · 돌 테두리 작은 구덩이`terrain` · 청회색 틀의 검은 창문`window` · 돌 테두리 바닥`terrain` · 청록 석조 골조 벽 상단 결구`wall` | block-12-15 c6 r12 |
| 367 | 검은 석재 바닥 `floor` | 깨진 암반 구멍 상단 좌측 `cliff` | 어두운 구덩이 내부`cliff` · 어두운 수로 바닥`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽면`wall` · 어두운 돌 바닥`terrain` · 청록 석조 골조 벽 상단 보`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 368 | 금속 모서리 암색 바닥 `floor` | 깨진 암반 구멍 상단 우측 `cliff` | 어두운 구덩이 모서리`cliff` · 석조 수로 내부 모서리`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽 모서리`wall` · 어두운 돌 바닥 모서리`terrain` · 청록 석조 골조 벽 상단 오른쪽 끝`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 369 | 회색틀 보라 바닥 `floor` | 석조 틀 어두운 창 단일 `window` | 사각 테두리 구덩이`cliff` · 깊은 물 단독 타일`water` · 돌 테두리 작은 보라색 구덩이`terrain` · 회색 틀의 남색 창문`window` · 남색 카펫 바닥`floor` · 남색 석조 벽 상단 왼쪽 결구`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 370 | 짙은 보라 바닥 `floor` | 남색 석조 벽 상단 보 `wall` | 남색 구덩이 내부`cliff` · 깊은 물 바닥`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽면`wall` · 남색 바닥`floor` · 남색 석조 벽 상단 보`wall` | block-12-15 c10 r12 |
| 371 | 회색 모서리 보라 바닥 `floor` | 남색 석조 벽 상단 오른쪽 끝 `wall` | 남색 구덩이 모서리`cliff` · 깊은 물 내부 모서리`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽 모서리`wall` · 남색 바닥 모서리`floor` · 남색 석조 벽 상단 오른쪽 끝`wall` | block-12-15 c11 r12 |
| 372 | 검보라 벽돌벽 `wall` | 거친 자갈 흙 바닥 `terrain` | 붉은 자갈길`terrain` · 짙은 흙 바닥`terrain` · 보라색 돌 표면`rock` · 거친 자갈 흙 바닥`terrain` | block-12-15 c12 r12 |
| 373 | 분홍 석재벽 `wall` | 붉은 흙 바닥 `terrain` | 붉은 흙밭`terrain` · 붉은 흙 바닥`terrain` · 자주색 돌 표면`rock` · 붉은 흙 바닥`terrain` | block-12-15 c13 r12 |
| 382 | 보라 돌무더기 `rock` | 돌 우물 `prop` | 돌 화덕`prop` · 돌 우물`prop` · 보라색 바위`rock` · 돌 우물`prop` | block-12-15 c22 r12 |
| 384 | 붉은 지붕 왼쪽사선 `roof` | 주황색 기와 삼각지붕 왼쪽 사면 `roof` | 주황색 삼각 깃발`decoration` · 주황색 삼각 지붕 좌하단`roof` · 주황색 삼각 깃발 왼쪽`decoration` · 주황색 삼각 천 왼쪽 조각`decoration` · 주황색 삼각형 차양`roof` · 적갈색 기와지붕 왼쪽 사선 끝`roof` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 385 | 붉은 지붕 오른쪽사선 `roof` | 주황색 기와 삼각지붕 오른쪽 사면 `roof` | 갈색 삼각 깃발`decoration` · 주황색 삼각 지붕 우하단`roof` · 주황색 삼각 깃발 오른쪽`decoration` · 주황색 삼각 천 오른쪽 조각`decoration` · 갈색 삼각형 차양`roof` · 적갈색 기와지붕 오른쪽 사선 끝`roof` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 386 | 푸른 지붕 왼쪽사선 `roof` | 파란색 기와 삼각지붕 왼쪽 사면 `roof` | 파란색 삼각 깃발`decoration` · 파란색 삼각 지붕 좌하단`roof` · 파란색 삼각 깃발 왼쪽`decoration` · 파란색 삼각 천 왼쪽 조각`decoration` · 파란색 삼각형 차양`roof` · 남색 기와지붕 왼쪽 사선 끝`roof` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 387 | 푸른 지붕 오른쪽사선 `roof` | 파란색 기와 삼각지붕 오른쪽 사면 `roof` | 남색 삼각 깃발`decoration` · 파란색 삼각 지붕 우하단`roof` · 파란색 삼각 깃발 오른쪽`decoration` · 파란색 삼각 천 오른쪽 조각`decoration` · 남색 삼각형 차양`roof` · 남색 기와지붕 오른쪽 사선 끝`roof` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 388 | 세로 통나무 기둥 `pillar` | 세로 목재 기둥 `prop` | 통나무 기둥`prop` · 통나무 기둥`prop` · 세로 목재 기둥`prop` · 목재 기둥 상단`prop` | block-12-15 c28 r12 |
| 389 | 체크 침대 머리 `bed` | 천막 지붕 상단 장식 `roof` | 녹색 차양 지붕`roof` · 풀 덮개 차양`roof` · 녹색 천 덮개`decoration`* · 천막 지붕 상단 장식`roof` | block-12-15 c29 r12 |
| 396 | 검은 바닥 북서 금속틀 `floor` | 돌 테두리 구덩이 좌상단 `cliff` | 돌 테두리 구덩이 좌상단`cliff` · 석조 수로 좌상단 모서리`water` · 어두운 구덩이 상단 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽 상단`wall` · 어두운 돌 바닥 좌상단 모퉁이`terrain` · 청록 석조 벽 패널 왼쪽 상단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 397 | 검은 바닥 북쪽 금속틀 `floor` | 돌 테두리 구덩이 상단 `cliff` | 돌 테두리 구덩이 상단`cliff` · 석조 수로 상단 경계`water` · 어두운 구덩이 상단 테두리`terrain` · 청록색 벽 테두리 상단`wall` · 어두운 돌 바닥 상단 가장자리`terrain` · 청록 석조 벽 패널 상단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 398 | 검은 바닥 북동 금속틀 `floor` | 돌 테두리 구덩이 우상단 `cliff` | 돌 테두리 구덩이 우상단`cliff` · 석조 수로 우상단 모서리`water` · 어두운 구덩이 상단 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽 상단`wall` · 어두운 돌 바닥 우상단 모퉁이`terrain` · 청록 석조 벽 패널 오른쪽 상단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 399 | 보라 바닥 북서 회색틀 `floor` | 남색 석조 벽 패널 왼쪽 상단 `wall` | 사각 테두리 구덩이 좌상단`cliff` · 깊은 물 좌상단 모서리`water` · 보라색 구덩이 상단 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽 상단`wall` · 남색 카펫 좌상단 모퉁이`floor` · 남색 석조 벽 패널 왼쪽 상단`wall` | block-12-15 c9 r13 |
| 400 | 보라 바닥 북쪽 회색틀 `floor` | 남색 석조 벽 패널 상단 `wall` | 사각 테두리 구덩이 상단`cliff` · 깊은 물 상단 경계`water` · 보라색 구덩이 상단 테두리`terrain` · 남색 벽 테두리 상단`wall` · 남색 카펫 상단 가장자리`floor` · 남색 석조 벽 패널 상단`wall` | block-12-15 c10 r13 |
| 401 | 보라 바닥 북동 회색틀 `floor` | 남색 석조 벽 패널 오른쪽 상단 `wall` | 사각 테두리 구덩이 우상단`cliff` · 깊은 물 우상단 모서리`water` · 보라색 구덩이 상단 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽 상단`wall` · 남색 카펫 우상단 모퉁이`floor` · 남색 석조 벽 패널 오른쪽 상단`wall` | block-12-15 c11 r13 |
| 402 | 이끼 낀 분홍 벽돌 `wall` | 붉은 흙 밭 새싹 `plant` | 붉은 밭 작물`plant` · 붉은 흙 새싹 밭`plant` · 초록 싹이 난 자주색 암벽`cliff` · 붉은 흙 밭 새싹`plant` | block-12-15 c12 r13 |
| 403 | 덩굴 덮인 검은 벽돌 `wall` | 자갈 흙 밭 새싹 `plant` | 자갈밭 작물`plant` · 짙은 흙 새싹 밭`plant` · 덩굴이 덮인 보라색 암벽`cliff` · 자갈 흙 밭 새싹`plant` | block-12-15 c13 r13 |
| 408 | 세로로 늘어진 밧줄 `rope` | 나무 울타리 수직 기둥 `fence` | 세로 목재 울타리`fence` · 나무 울타리 세로 기둥`fence` · 둥근 목책 왼쪽 하단`fence` · 나무 울타리 수직 기둥`fence` | block-12-15 c18 r13 |
| 411 | 흩어진 빵 조각 `prop` | 흩어진 돌 `rock` | 흩어진 돌`rock` · 흩어진 돌`rock` · 흩어진 주황색 돌조각`decoration` · 모닥불 주변 자갈과 숯`prop` | block-12-15 c21 r13 |
| 413 | 회색 십자 구조물 `decoration` | 회색 십자 방향 표지판 `prop` | 석조 십자가`prop` · 석조 십자가`prop` · 회색 십자 방향 표지판`prop` · 철제 십자가`prop` | block-12-15 c23 r13 |
| 414 | 비문 석판 왼쪽 윗돌 `statue` | 대형 묘비 왼쪽 상단 `prop` | 거대 비석 좌상단`prop` · 거대 비석 좌측 상단`prop` · 대형 묘비 왼쪽 상단`prop` · 룬 비석 좌상단`prop` | block-12-15 c24 r13 |
| 415 | 비문 석판 둥근 윗돌 `statue` | 거대 비석 상단 중앙 `prop` | 거대 비석 상단 중앙`prop` · 거대 비석 상단 중앙`prop` · 대형 묘비 상단`prop` · 룬 비석 상단 중앙`prop` | block-12-15 c25 r13 |
| 416 | 비문 석판 오른쪽 윗돌 `statue` | 대형 묘비 오른쪽 상단 `prop` | 거대 비석 우상단`prop` · 거대 비석 우측 상단`prop` · 대형 묘비 오른쪽 상단`prop` · 룬 비석 우상단`prop` | block-12-15 c26 r13 |
| 418 | 베이지 천막 중앙 지붕 `awning` | 베이지색 천막 지붕 중앙 `roof` | 천막 지붕 상단 중앙`roof` · 원형 천막 지붕 중앙`prop` · 둥근 텐트 지붕 중앙`roof` · 베이지색 천막 상단`prop` · 천막 지붕 상단 중앙`roof` · 베이지색 천막 지붕 중앙`roof` | block-12-15 c28 r13 |
| 426 | 검은 바닥 서쪽 금속틀 `floor` | 돌 테두리 구덩이 좌측 `cliff` | 돌 테두리 구덩이 좌측`cliff` · 석조 수로 좌측 경계`water` · 어두운 구덩이 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽`wall` · 어두운 돌 바닥 좌측 가장자리`terrain` · 청록 석조 벽 패널 왼쪽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 427 | 검은 바닥 중앙판 `floor` | 깨진 암반 구멍 내부 `cliff` | 돌 테두리 구덩이 내부`cliff` · 석조 수로 중앙 바닥`water` · 어두운 구덩이 내부`terrain` · 짙은 청록색 벽 중앙`wall` · 어두운 돌 바닥 중앙`terrain` · 청록 석조 벽 패널 중앙`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 428 | 검은 바닥 동쪽 금속틀 `floor` | 돌 테두리 구덩이 우측 `cliff` | 돌 테두리 구덩이 우측`cliff` · 석조 수로 우측 경계`water` · 어두운 구덩이 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽`wall` · 어두운 돌 바닥 우측 가장자리`terrain` · 청록 석조 벽 패널 오른쪽`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 429 | 보라 바닥 서쪽 회색틀 `floor` | 남색 석조 벽 패널 왼쪽 `wall` | 사각 테두리 구덩이 좌측`cliff` · 깊은 물 좌측 경계`water` · 보라색 구덩이 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽`wall` · 남색 카펫 좌측 가장자리`floor` · 남색 석조 벽 패널 왼쪽`wall` | block-12-15 c9 r14 |
| 430 | 보라 바닥 중앙판 `floor` | 남색 석조 벽 패널 중앙 `wall` | 사각 테두리 구덩이 내부`cliff` · 깊은 물 중앙 바닥`water` · 보라색 구덩이 내부`terrain` · 짙은 남색 벽 중앙`wall` · 남색 카펫 중앙`floor` · 남색 석조 벽 패널 중앙`wall` | block-12-15 c10 r14 |
| 431 | 보라 바닥 동쪽 회색틀 `floor` | 남색 석조 벽 패널 오른쪽 `wall` | 사각 테두리 구덩이 우측`cliff` · 깊은 물 우측 경계`water` · 보라색 구덩이 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽`wall` · 남색 카펫 우측 가장자리`floor` · 남색 석조 벽 패널 오른쪽`wall` | block-12-15 c11 r14 |
| 432 | 초록 이끼 돌벽 `wall` | 이끼 낀 자갈 바닥 `terrain` | 이끼 낀 돌바닥`terrain` · 이끼 낀 자갈 바닥`terrain` · 이끼 낀 회색 암벽`cliff` · 이끼 낀 돌 바닥`terrain` | block-12-15 c12 r14 |
| 433 | 회색 자갈 돌벽 `wall` | 어두운 돌 바닥 `terrain` | 돌바닥`terrain` · 짙은 자갈 바닥`terrain` · 회색 암벽`cliff` · 어두운 돌 바닥`terrain` | block-12-15 c13 r14 |
| 434 | 회색 계단 좌상단 `stairs` | 대장간 화덕 상단 좌측 `prop` | 대장간 화덕 상단 좌측`prop` · 석조 화덕 좌측 상단`prop` · 밧줄 달린 회색 철문 왼쪽 상단`gate` · 지하 통로 사다리 좌상단`stairs` | block-12-15 c14 r14 |
| 435 | 회색 계단 우상단 `stairs` | 대장간 화덕 상단 우측 `prop` | 대장간 화덕 상단 우측`prop` · 석조 화덕 우측 상단`prop` · 밧줄 달린 회색 철문 오른쪽 상단`gate` · 지하 통로 사다리 우상단`stairs` | block-12-15 c15 r14 |
| 436 | 푸른 쌍창 상단 `window` | 파란색 기와지붕 왼쪽 가운데 `roof` | 파란 기와 지붕 처마`roof` · 파란색 기와지붕 상단`roof` · 파란색 기와지붕 왼쪽 가운데`roof` · 파란색 기와 지붕 상단`roof` | block-12-15 c16 r14 |
| 442 | 청록 병 상점간판 `sign` | 청록색 그림의 목재 간판 `prop` | 무기점 간판`prop` · 무기점 간판`prop` · 청록색 그림의 목재 간판`prop` · 검 무기점 간판`prop` | block-12-15 c22 r14 |
| 443 | 붉은 글자 여관간판 `sign` | 붉은 글씨의 여관 간판 `prop` | 여관 간판`prop` · 여관 간판`prop` · 붉은 글씨의 여관 간판`prop` · INN 여관 간판`prop` | block-12-15 c23 r14 |
| 444 | 비문 석판 왼쪽 몸돌 `statue` | 대형 묘비 왼쪽 가운데 `prop` | 거대 비석 중간 좌측`prop` · 거대 비석 좌측 중앙`prop` · 대형 묘비 왼쪽 가운데`prop` · 룬 비석 좌측 중앙`prop` | block-12-15 c24 r14 |
| 445 | 비문 석판 중앙 몸돌 `statue` | 글자가 새겨진 대형 묘비 가운데 `prop` | 거대 비석 중간 중앙`prop` · 거대 비석 중앙`prop` · 글자가 새겨진 대형 묘비 가운데`prop` · 룬 비석 중앙`prop` | block-12-15 c25 r14 |
| 446 | 비문 석판 오른쪽 몸돌 `statue` | 대형 묘비 오른쪽 가운데 `prop` | 거대 비석 중간 우측`prop` · 거대 비석 우측 중앙`prop` · 대형 묘비 오른쪽 가운데`prop` · 룬 비석 우측 중앙`prop` | block-12-15 c26 r14 |
| 447 | 천막 입구 왼쪽 휘장 `awning` | 베이지색 천막 왼쪽 벽면 `wall` | 천막 좌측 벽`wall` · 원형 천막 벽 좌측 상단`prop` · 텐트 왼쪽 천 벽`wall` · 베이지색 천막 왼쪽 가운데`prop` · 천막 좌측 벽`wall` · 베이지색 천막 왼쪽 벽면`wall` | block-12-15 c27 r14 |
| 448 | 천막 입구 중앙 그늘 `awning` | 검은 천막 입구 상단 `door` | 천막 입구 상단`door` · 원형 천막 입구 상단`prop` · 검은 천막 입구 상단`door` · 천막 입구 상단`door` | block-12-15 c28 r14 |
| 449 | 천막 입구 오른쪽 휘장 `awning` | 베이지색 천막 오른쪽 벽면 `wall` | 천막 우측 벽`wall` · 원형 천막 벽 우측 상단`prop` · 텐트 오른쪽 천 벽`wall` · 베이지색 천막 오른쪽 가운데`prop` · 천막 우측 벽`wall` · 베이지색 천막 오른쪽 벽면`wall` | block-12-15 c29 r14 |
| 456 | 검은 바닥 남서 금속틀 `floor` | 돌 테두리 구덩이 좌하단 `cliff` | 돌 테두리 구덩이 좌하단`cliff` · 석조 수로 좌하단 모서리`water` · 어두운 구덩이 하단 왼쪽 테두리`terrain` · 청록색 벽 테두리 왼쪽 하단`wall` · 어두운 돌 바닥 좌하단 모퉁이`terrain` · 청록 석조 벽 패널 왼쪽 하단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 457 | 검은 바닥 남쪽 금속틀 `floor` | 돌 테두리 구덩이 하단 `cliff` | 돌 테두리 구덩이 하단`cliff` · 석조 수로 하단 경계`water` · 어두운 구덩이 하단 테두리`terrain` · 청록색 벽 테두리 하단`wall` · 어두운 돌 바닥 하단 가장자리`terrain` · 청록 석조 벽 패널 하단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 458 | 검은 바닥 남동 금속틀 `floor` | 돌 테두리 구덩이 우하단 `cliff` | 돌 테두리 구덩이 우하단`cliff` · 석조 수로 우하단 모서리`water` · 어두운 구덩이 하단 오른쪽 테두리`terrain` · 청록색 벽 테두리 오른쪽 하단`wall` · 어두운 돌 바닥 우하단 모퉁이`terrain` · 청록 석조 벽 패널 오른쪽 하단`wall` | **사람 확정** (fin-retro_house-r3-5-c24-28.png) |
| 459 | 보라 바닥 남서 회색틀 `floor` | 남색 석조 벽 패널 왼쪽 하단 `wall` | 사각 테두리 구덩이 좌하단`cliff` · 깊은 물 좌하단 모서리`water` · 보라색 구덩이 하단 왼쪽 테두리`terrain` · 남색 벽 테두리 왼쪽 하단`wall` · 남색 카펫 좌하단 모퉁이`floor` · 남색 석조 벽 패널 왼쪽 하단`wall` | block-12-15 c9 r15 |
| 460 | 보라 바닥 남쪽 회색틀 `floor` | 남색 석조 벽 패널 하단 `wall` | 사각 테두리 구덩이 하단`cliff` · 깊은 물 하단 경계`water` · 보라색 구덩이 하단 테두리`terrain` · 남색 벽 테두리 하단`wall` · 남색 카펫 하단 가장자리`floor` · 남색 석조 벽 패널 하단`wall` | block-12-15 c10 r15 |
| 461 | 보라 바닥 남동 회색틀 `floor` | 남색 석조 벽 패널 오른쪽 하단 `wall` | 사각 테두리 구덩이 우하단`cliff` · 깊은 물 우하단 모서리`water` · 보라색 구덩이 하단 오른쪽 테두리`terrain` · 남색 벽 테두리 오른쪽 하단`wall` · 남색 카펫 우하단 모퉁이`floor` · 남색 석조 벽 패널 오른쪽 하단`wall` | block-12-15 c11 r15 |
| 462 | 돌틈 보라꽃 왼쪽 `plant` | 바위 무더기 좌측 `rock` | 보라색 광석`rock` · 바위 무더기 좌측`rock` · 밝은 결정이 박힌 암벽 왼쪽 조각`cliff` · 보라빛 광석 무더기`prop` | block-12-15 c12 r15 |
| 463 | 돌틈 보라꽃 오른쪽 `plant` | 작은 보라색 광석 `rock` | 작은 보라색 광석`rock` · 바위 무더기 우측`rock` · 밝은 결정이 박힌 암벽 오른쪽 조각`cliff` · 보라빛 광석 파편`prop` | block-12-15 c13 r15 |
| 464 | 회색 계단 좌하단 `stairs` | 대장간 화덕 하단 좌측 `prop` | 대장간 화덕 하단 좌측`prop` · 석조 화덕 좌측 하단`prop` · 밧줄 달린 회색 철문 왼쪽 하단`gate` · 지하 통로 사다리 좌하단`stairs` | block-12-15 c14 r15 |
| 465 | 회색 계단 우하단 `stairs` | 대장간 화덕 하단 우측 `prop` | 대장간 화덕 하단 우측`prop` · 석조 화덕 우측 하단`prop` · 밧줄 달린 회색 철문 오른쪽 하단`gate` · 지하 통로 사다리 우하단`stairs` | block-12-15 c15 r15 |
| 466 | 푸른 쌍창 하단 `window` | 파란색 기와지붕 왼쪽 하단 `roof` | 파란 기와 지붕`roof` · 파란색 기와지붕 중간`roof` · 파란색 기와지붕 왼쪽 하단`roof` · 파란색 기와 지붕 상단`roof` | block-12-15 c16 r15 |
| 468 | 나무 아치 왼쪽 기둥 `decoration` | 목조 아치 다리 왼쪽 `floor` | 목재 다리 좌측`floor` · 목재 다리 좌측 기둥`prop` · 목조 아치 다리 왼쪽`floor` · 목재 진열대 왼쪽 조각`furniture`* · 목재 다리 좌측 아치`stairs` · 목조 아치 울타리 상단 왼쪽`fence` | block-12-15 c18 r15 |
| 469 | 나무 아치 중앙 받침 `decoration` | 목조 아치 다리 중앙 `floor` | 목재 다리 중앙`floor` · 목재 다리 중앙 기둥`prop` · 목조 아치 다리 중앙`floor` · 목재 진열대 가운데 왼쪽 조각`furniture`* · 목재 다리 중앙 기둥`stairs` · 목조 아치 울타리 상단 중앙`fence` | block-12-15 c19 r15 |
| 470 | 나무 아치 오른쪽 기둥 `decoration` | 목조 아치 다리 오른쪽 `floor` | 목재 다리 우측`floor` · 목재 다리 우측 기둥`prop` · 목조 아치 다리 오른쪽`floor` · 목재 진열대 가운데 오른쪽 조각`furniture`* · 목재 다리 우측 아치`stairs` · 목조 아치 울타리 상단 오른쪽`fence` | block-12-15 c20 r15 |
| 471 | 나무 들보 중앙 돌기 `decoration` | 목재 상판 하단 지지대 `prop` | 목재 발판 지지대`prop` · 목재 다리 하단 받침`prop` · 목재 진열대 오른쪽 조각`furniture`* · 목재 상판 하단 지지대`prop` | block-12-15 c21 r15 |
| 473 | 빨간 항아리 상점간판 `sign` | 빨간 항아리 그림의 목재 간판 `prop` | 도구점 간판`prop` · 도구점 간판`prop` · 빨간 항아리 그림의 목재 간판`prop` · 물약 잡화점 간판`prop` | block-12-15 c23 r15 |
| 474 | 비문 석판 왼쪽 받침 `statue` | 룬 비석 좌하단 받침대 `prop` | 거대 비석 받침대 좌측`prop` · 거대 비석 좌측 하단`prop` · 대형 묘비 왼쪽 하단`prop` · 룬 비석 좌하단 받침대`prop` | block-12-15 c24 r15 |
| 475 | 비문 석판 중앙 받침 `statue` | 룬 비석 하단 중앙 받침대 `prop` | 거대 비석 받침대 중앙`prop` · 거대 비석 하단 중앙`prop` · 대형 묘비 하단`prop` · 룬 비석 하단 중앙 받침대`prop` | block-12-15 c25 r15 |
| 476 | 비문 석판 오른쪽 받침 `statue` | 대형 묘비 오른쪽 하단 `prop` | 거대 비석 받침대 우측`prop` · 거대 비석 우측 하단`prop` · 대형 묘비 오른쪽 하단`prop` · 룬 비석 우하단 받침대`prop` | block-12-15 c26 r15 |
| 477 | 천막 왼쪽 휘장 자락 `awning` | 베이지색 천막 왼쪽 하단 벽면 `wall` | 천막 좌하단 기둥`wall` · 원형 천막 벽 좌측 하단`prop` · 텐트 왼쪽 천 벽 하단`wall` · 베이지색 천막 왼쪽 하단`prop` · 천막 좌하단 지지대`wall` · 베이지색 천막 왼쪽 하단 벽면`wall` | block-12-15 c27 r15 |
| 478 | 천막 중앙 어두운 입구 `awning` | 검은 천막 입구 하단 `door` | 천막 입구 하단`door` · 원형 천막 입구 하단`door` · 검은 천막 입구 하단`door` · 천막 입구 하단`door` | block-12-15 c28 r15 |
| 479 | 천막 오른쪽 휘장 자락 `awning` | 베이지색 천막 오른쪽 하단 벽면 `wall` | 천막 우하단 기둥`wall` · 원형 천막 벽 우측 하단`prop` · 텐트 오른쪽 천 벽 하단`wall` · 베이지색 천막 오른쪽 하단`prop` · 천막 우하단 지지대`wall` · 베이지색 천막 오른쪽 하단 벽면`wall` | block-12-15 c29 r15 |

## retro_world — 교정 249칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 0 | 초원 동굴 입구 `door` | 잔디 물가 북쪽 1 `water` | 잔디 물가 북쪽 1`water` · 아치형 창 상단`window` · 풀밭 물가 좌상단`water` | block-00-03 c0 r0 |
| 1 | 초원 동굴 입구 `door` | 잔디 물가 북쪽 2 `water` | 잔디 물가 북쪽 2`water` · 아치형 창 상단`window` · 풀밭 물가 상단`water` | block-00-03 c1 r0 |
| 2 | 초원 동굴 입구 `door` | 잔디 물가 북쪽 3 `water` | 잔디 물가 북쪽 3`water` · 아치형 창 상단`window` · 풀밭 물가 우상단`water` | block-00-03 c2 r0 |
| 3 | 설원 동굴 입구 `door` | 눈 덮인 물가 북쪽 1 `water` | 눈 덮인 물가 북쪽 1`water` · 아치형 창 상단`window` · 눈밭 물가 좌상단`water` | block-00-03 c3 r0 |
| 4 | 설원 동굴 입구 `door` | 눈 덮인 물가 북쪽 2 `water` | 눈 덮인 물가 북쪽 2`water` · 아치형 창 상단`window` · 눈밭 물가 상단`water` | block-00-03 c4 r0 |
| 5 | 설원 동굴 입구 `door` | 눈 덮인 물가 북쪽 3 `water` | 눈 덮인 물가 북쪽 3`water` · 아치형 창 상단`window` · 눈밭 물가 우상단`water` | block-00-03 c5 r0 |
| 6 | 숲 사방 풀 경계 `forest` | 풀밭 자갈 지형 1x1 `forest` | 잔디 위 둥근 자갈길`terrain` · 보라색 자갈 바닥 가장자리`floor` · 풀밭 자갈 지형 1x1`terrain` | block-00-03 c6 r0 |
| 7 | 밝은 점무늬 초원 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`terrain` · 초록 잔디`terrain` | block-00-03 c7 r0 |
| 8 | 빽빽한 자주빛 숲 `terrain` | 자갈길 바닥 `terrain` | 자갈길 바닥`terrain` · 보라색 자갈 바닥`floor` · 자갈 지형`terrain` | block-00-03 c8 r0 |
| 10 | 성긴 점무늬 초원 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`terrain` · 초록 잔디`terrain` | block-00-03 c10 r0 |
| 12 | 분홍빛 갈라진 땅 `terrain` | 분홍 석재 타일 `floor` | 붉은 돌바닥`floor` · 분홍 석재 타일`floor` | block-00-03 c12 r0 |
| 13 | 푸른 회색 암반 `rock` | 청회색 석재 타일 `floor` | 청회색 돌바닥`floor` · 청회색 석재 타일`floor` | block-00-03 c13 r0 |
| 20 | 숲 남동 대각 경계 `terrain` | 자갈 대각선 절벽 좌상향 `cliff` | 자갈 대각선 절벽 좌상향`cliff` · 보라 자갈 절벽 좌상단`cliff` | block-00-03 c20 r0 |
| 21 | 숲 남쪽 쐐기 경계 `terrain` | 자갈 대각선 절벽 우상향 `cliff` | 자갈 대각선 절벽 우상향`cliff` · 보라 자갈 절벽 우상단`cliff` | block-00-03 c21 r0 |
| 23 | 설원 북쪽 쐐기 경계 `cliff` | 눈 덮인 대각선 절벽 우상향 `cliff` | 눈 덮인 대각선 절벽 우상향`cliff` · 눈 절벽 우상단`cliff` | block-00-03 c23 r0 |
| 24 | 초원 남동 삼각 조각 `terrain` | 녹색 삼각 지붕 좌측 `roof` | 녹색 삼각 지붕 좌측`roof` · 초록 박공지붕 왼쪽`roof`* | block-00-03 c24 r0 |
| 25 | 초원 북쪽 삼각 조각 `terrain` | 녹색 삼각 지붕 우측 `roof` | 녹색 삼각 지붕 우측`roof` · 초록 박공지붕 오른쪽`roof`* | block-00-03 c25 r0 |
| 26 | 자주숲 남동 삼각 조각 `terrain` | 흑색 삼각 지붕 좌측 `roof` | 흑색 삼각 지붕 좌측`roof` · 보라 박공지붕 왼쪽`roof`* | block-00-03 c26 r0 |
| 27 | 자주숲 남서 삼각 조각 `terrain` | 흑색 삼각 지붕 우측 `roof` | 흑색 삼각 지붕 우측`roof` · 보라 박공지붕 오른쪽`roof`* | block-00-03 c27 r0 |
| 28 | 백색 남동 삼각 조각 `snow` | 흰색 눈 덮인 삼각 지붕 좌측 `roof` | 흰색 눈 덮인 삼각 지붕 좌측`roof` · 흰 박공지붕 왼쪽`roof`* | block-00-03 c28 r0 |
| 29 | 백색 북쪽 삼각 조각 `snow` | 흰색 눈 덮인 삼각 지붕 우측 `roof` | 흰색 눈 덮인 삼각 지붕 우측`roof` · 흰 박공지붕 오른쪽`roof`* | block-00-03 c29 r0 |
| 36 | 숲 서쪽 풀 경계 `forest` | 풀밭 자갈 지형 좌상단 `forest` | 자갈길 좌상단 모서리`terrain` · 잔디 테두리 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 좌상단`terrain` | block-00-03 c6 r1 |
| 37 | 숲 북쪽 풀 경계 `terrain` | 자갈길 상단 가장자리 `terrain` | 자갈길 상단 가장자리`terrain` · 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 상단`terrain` | block-00-03 c7 r1 |
| 38 | 숲 동쪽 풀 경계 `forest` | 풀밭 자갈 지형 우상단 `forest` | 자갈길 우상단 모서리`terrain` · 잔디점이 있는 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 우상단`terrain` | block-00-03 c8 r1 |
| 42 | 연보라 갈라진 땅 `terrain` | 연보라 석재 타일 `floor` | 분홍빛 돌바닥`floor` · 연보라 석재 타일`floor` | block-00-03 c12 r1 |
| 43 | 갈라진 땅 `terrain` | 회녹색 석재 타일 `floor` | 녹회색 돌바닥`floor` · 회녹색 석재 타일`floor` | block-00-03 c13 r1 |
| 50 | 숲 남서 대각 경계 `terrain` | 자갈 대각선 절벽 우하향 `cliff` | 자갈 대각선 절벽 우하향`cliff` · 보라 자갈 절벽 좌하단`cliff` | block-00-03 c20 r1 |
| 51 | 숲 남쪽 역삼각 경계 `terrain` | 자갈 대각선 절벽 좌하향 `cliff` | 자갈 대각선 절벽 좌하향`cliff` · 보라 자갈 절벽 우하단`cliff` | block-00-03 c21 r1 |
| 53 | 설원 남쪽 역삼각 경계 `cliff` | 눈 덮인 대각선 절벽 좌하향 `cliff` | 눈 덮인 대각선 절벽 좌하향`cliff` · 눈 절벽 우하단`cliff` | block-00-03 c23 r1 |
| 59 | 은빛 쌍봉 산맥 `mountain` | 백색 광석 덩어리 `mountain` | 백색 광석 덩어리`rock` · 흰 돌무더기`rock` | block-00-03 c29 r1 |
| 66 | 숲 북서 풀모서리 `terrain` | 자갈길 좌측 가장자리 `terrain` | 자갈길 좌측 가장자리`terrain` · 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 좌측`terrain` | block-00-03 c6 r2 |
| 67 | 숲 위쪽 좁은 풀띠 `terrain` | 자갈길 중앙 바닥 `terrain` | 자갈길 중앙 바닥`terrain` · 보라색 자갈 바닥`floor` · 자갈 지형 중앙`terrain` | block-00-03 c7 r2 |
| 68 | 숲 북동 풀모서리 `terrain` | 자갈길 우측 가장자리 `terrain` | 자갈길 우측 가장자리`terrain` · 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 우측`terrain` | block-00-03 c8 r2 |
| 72 | 가로결 갈색 목벽 `wall` | 목재 판자 바닥 `floor` | 목재 판자 바닥`floor` · 가로 판재 목벽 상단`wall` · 가로 나무 바닥`floor` | block-00-03 c12 r2 |
| 73 | 갈색 목벽 동굴문 `door` | 얼룩진 목재 판자 바닥 `floor` | 얼룩진 목재 판자 바닥`floor` · 어두운 아치형 목문 상단`door` · 얼룩진 가로 나무 바닥`floor` | block-00-03 c13 r2 |
| 74 | 밝은 회백색 자갈땅 `terrain` | 좌측 기둥 회벽 상단 `wall` | 좌측 기둥 회벽 상단`wall` · 밝은 회벽 상단`wall` | block-00-03 c14 r2 |
| 75 | 왼쪽 회백색 자갈땅 `terrain` | 기둥 없는 회벽 상단 `wall` | 기둥 없는 회벽 상단`wall` · 밝은 회벽 상단`wall` | block-00-03 c15 r2 |
| 76 | 가운데 회백색 자갈땅 `terrain` | 오른쪽 기둥이 있는 회벽 상단 `wall` | 우측 기둥 회벽 상단`wall` · 오른쪽 기둥이 있는 회벽 상단`wall` | block-00-03 c16 r2 |
| 77 | 오른쪽 회백색 자갈땅 `terrain` | 왼쪽 기둥이 있는 회벽 상단 `wall` | 양측 기둥 좁은 회벽 상단`wall` · 왼쪽 기둥이 있는 회벽 상단`wall` | block-00-03 c17 r2 |
| 78 | 왼쪽 잎무늬 초원 `terrain` | 잔디 절벽 좌측 경계 `cliff` | 잔디 절벽 좌측 경계`cliff` · 초록 잔디`terrain` · 풀밭 절벽 좌측`cliff` | block-00-03 c18 r2 |
| 79 | 가운데 잎무늬 초원 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`terrain` · 초록 잔디`terrain` | block-00-03 c19 r2 |
| 80 | 오른쪽 잎무늬 초원 `terrain` | 잔디 절벽 우측 경계 `cliff` | 잔디 절벽 우측 경계`cliff` · 초록 잔디`terrain` · 풀밭 절벽 우측`cliff` | block-00-03 c20 r2 |
| 81 | 숲 서남쪽 풀모서리 `terrain` | 자갈 절벽 좌상단 모서리 `cliff` | 자갈 절벽 좌상단 모서리`cliff` · 보라색 자갈 바닥`floor` · 자갈 절벽 좌상단`cliff` | block-00-03 c21 r2 |
| 82 | 숲 아래쪽 좁은 풀띠 `terrain` | 자갈 절벽 상단 경계 `cliff` | 자갈 절벽 상단 경계`cliff` · 어두운 테두리 보라색 자갈 바닥`floor` · 자갈 절벽 상단`cliff` | block-00-03 c22 r2 |
| 83 | 숲 동남쪽 풀모서리 `terrain` | 자갈 절벽 우상단 모서리 `cliff` | 자갈 절벽 우상단 모서리`cliff` · 보라색 자갈 바닥`floor` · 자갈 절벽 우상단`cliff` | block-00-03 c23 r2 |
| 89 | 회색 세로 묘비 `statue` | 석조 오벨리스크 상단 `statue` | 석조 오벨리스크 상단`prop` · 둥근 묘비`decoration` · 선돌 상단`prop` | block-00-03 c29 r2 |
| 90 | 초원 둘레 넓은 바다 `water` | 잔디 물가 개활 수면 1 `water` | 잔디 물가 개활 수면 1`water` · 어두운 석조 벽`wall` · 풀밭 물 모서리`water` | block-00-03 c0 r3 |
| 91 | 초원 둘레 넓은 바다 `water` | 잔디 물가 개활 수면 2 `water` | 잔디 물가 개활 수면 2`water` · 어두운 석조 벽`wall` · 풀밭 물 모서리`water` | block-00-03 c1 r3 |
| 92 | 초원 둘레 넓은 바다 `water` | 잔디 물가 개활 수면 3 `water` | 잔디 물가 개활 수면 3`water` · 어두운 석조 벽`wall` · 풀밭 물 모서리`water` | block-00-03 c2 r3 |
| 93 | 설원 둘레 넓은 바다 `water` | 눈 덮인 물가 개활 수면 1 `water` | 눈 덮인 물가 개활 수면 1`water` · 어두운 석조 벽`wall` · 눈밭 물 모서리`water` | block-00-03 c3 r3 |
| 94 | 설원 둘레 넓은 바다 `water` | 눈 덮인 물가 개활 수면 2 `water` | 눈 덮인 물가 개활 수면 2`water` · 어두운 석조 벽`wall` · 눈밭 물 모서리`water` | block-00-03 c4 r3 |
| 95 | 설원 둘레 넓은 바다 `water` | 눈 덮인 물가 개활 수면 3 `water` | 눈 덮인 물가 개활 수면 3`water` · 어두운 석조 벽`wall` · 눈밭 물 모서리`water` | block-00-03 c5 r3 |
| 97 | 숲 남쪽 풀경계 `terrain` | 자갈길 하단 가장자리 `terrain` | 자갈길 하단 가장자리`terrain` · 보라색 자갈 바닥`floor` · 풀밭 자갈 지형 하단`terrain` | block-00-03 c7 r3 |
| 103 | 목벽 아래 어두운 문 `door` | 걸레받이가 있는 목재 판벽 `wall` | 걸레받이가 있는 목재 벽`wall` · 어두운 아치형 목문 하단`door` · 세로 나무 바닥 하단`floor` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 104 | 회갈색 자갈 지면 `terrain` | 좌측 기둥 회벽 하단 `wall` | 좌측 기둥 회벽 하단`wall` · 밝은 회벽 하단`wall` | block-00-03 c14 r3 |
| 105 | 왼쪽 갈색점 자갈땅 `terrain` | 기둥 없는 회벽 하단 `wall` | 기둥 없는 회벽 하단`wall` · 밝은 회벽 하단`wall` | block-00-03 c15 r3 |
| 106 | 가운데 갈색점 자갈땅 `terrain` | 오른쪽 기둥이 있는 회벽 하단 `wall` | 우측 기둥 회벽 하단`wall` · 오른쪽 기둥이 있는 회벽 하단`wall` | block-00-03 c16 r3 |
| 107 | 오른쪽 갈색점 자갈땅 `terrain` | 왼쪽 기둥이 있는 회벽 하단 `wall` | 양측 기둥 좁은 회벽 하단`wall` · 왼쪽 기둥이 있는 회벽 하단`wall` | block-00-03 c17 r3 |
| 108 | 왼쪽 작은잎 초원 `terrain` | 잔디 절벽 좌측 하단 경계 `cliff` | 잔디 절벽 좌측 하단 경계`cliff` · 초록 잔디`terrain` · 풀밭 절벽 좌하단`cliff` | block-00-03 c18 r3 |
| 109 | 가운데 작은잎 초원 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`terrain` · 초록 잔디`terrain` | block-00-03 c19 r3 |
| 110 | 오른쪽 작은잎 초원 `terrain` | 잔디 절벽 우측 하단 경계 `cliff` | 잔디 절벽 우측 하단 경계`cliff` · 초록 잔디`terrain` · 풀밭 절벽 우하단`cliff` | block-00-03 c20 r3 |
| 111 | 숲 왼쪽 잔풀 경계 `terrain` | 자갈 절벽 좌하단 모서리 `cliff` | 자갈 절벽 좌하단 모서리`cliff` · 보라색 자갈 바닥`floor` · 자갈 절벽 좌측`cliff` | block-00-03 c21 r3 |
| 112 | 숲 가운데 잔풀 경계 `terrain` | 자갈 절벽 하단 경계 `cliff` | 자갈 절벽 하단 경계`cliff` · 보라색 자갈 바닥`floor` · 자갈 절벽 중앙`cliff` | block-00-03 c22 r3 |
| 113 | 숲 오른쪽 잔풀 경계 `terrain` | 자갈 절벽 우하단 모서리 `cliff` | 자갈 절벽 우하단 모서리`cliff` · 보라색 자갈 바닥`floor` · 자갈 절벽 우측`cliff` | block-00-03 c23 r3 |
| 116 | 굽은 목책 교차부 `fence` | 나무 이정표 표지판 `prop` | 나무 이정표 표지판`prop` · 목재 방향 표지판`prop` | block-00-03 c26 r3 |
| 117 | 주황빛 수정 조각 `decoration` | 광석 조각 `prop` | 바닥에 흩어진 광석 조각들`prop` · 흩어진 금빛 조각`decoration` · 작은 돌멩이`rock` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 118 | 녹금색 세 갈래 잔해 `decoration` | 녹색 금속 장비 더미 `prop` | 해골과 유골`prop` · 녹색 금속 장비 더미`prop`* | block-00-03 c28 r3 |
| 119 | 푸른 회색 돌기둥 `pillar` | 석조 오벨리스크 하단 `pillar` | 석조 오벨리스크 하단`prop` · 키 큰 석비`decoration` · 선돌 하단`prop` | block-00-03 c29 r3 |
| 120 | 어두운 수면 내부 `water` | 어두운 수면 `water` | 어두운 가림막 왼쪽`decoration`* · 어두운 석벽 왼쪽 윗면`wall`* · 어두운 바닥`floor` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 121 | 어두운 수면 내부 `water` | 어두운 수면 `water` | 어두운 가림막 중앙`decoration`* · 어두운 석벽 가운데 윗면`wall`* · 어두운 바닥`floor` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 122 | 어두운 수면 내부 `water` | 어두운 수면 `water` | 어두운 가림막 오른쪽`decoration`* · 어두운 석벽 오른쪽 윗면`wall`* · 어두운 바닥`floor` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 123 | 얼음 동굴 가시벽 `wall` | 얼음 폭포 물살 첫째 모습 `water` | 얼음 폭포 물살 첫째 모습`water` · 얼음 절벽 상단`cliff` · 폭포`water` | block-04-07 c3 r4 |
| 127 | 연두색 점무늬 초원 `terrain` | 나무 사이 잔디 `terrain` | 밝은 잔디밭`terrain` · 나무 사이 잔디`terrain` | block-04-07 c7 r4 |
| 128 | 빽빽한 짙은 숲 `forest` | 작은 둥근 덤불 `forest` | 작은 둥근 덤불`plant` · 나무 수관 오른쪽 상단`tree` · 작은 덤불`plant` | block-04-07 c8 r4 |
| 129 | 초원 중앙 눈 마름모 `snow` | 잔디밭의 작은 눈 조각 `snow` | 잔디밭의 작은 눈 조각`terrain` · 잔디 위 작은 눈더미`terrain` | block-04-07 c9 r4 |
| 134 | 베이지 굵은 균열 바닥 `floor` | 밝은 석조 벽 상단 왼쪽 `wall` | 밝은 석조 벽 상단 왼쪽`wall` · 밝은 석조 벽 왼쪽 상단`wall` | block-04-07 c14 r4 |
| 135 | 베이지 각진 균열 바닥 `floor` | 밝은 석조 벽 상단 중앙 왼쪽 `wall` | 밝은 석조 벽 상단 중앙 왼쪽`wall` · 밝은 석조 벽 왼쪽 위`wall` | block-04-07 c15 r4 |
| 136 | 베이지 성긴 균열 바닥 `floor` | 밝은 석조 벽 상단 중앙 오른쪽 `wall` | 밝은 석조 벽 상단 중앙 오른쪽`wall` · 밝은 석조 벽 가운데 위`wall` | block-04-07 c16 r4 |
| 137 | 베이지 가로 균열 바닥 `floor` | 밝은 석조 벽 상단 오른쪽 `wall` | 밝은 석조 벽 상단 오른쪽`wall` · 밝은 석조 벽 오른쪽 위`wall` | block-04-07 c17 r4 |
| 138 | 초원 남쪽 짙은 경계 `terrain` | 잔디 절벽 왼쪽 상단 `cliff` | 풀로 덮인 목재 들보 왼쪽`wall` · 잔디 절벽 왼쪽 상단`cliff` · 풀밭 절벽 상단 좌측`cliff` | block-04-07 c18 r4 |
| 139 | 초원 남쪽 얇은 경계 `terrain` | 잔디 절벽 가운데 상단 `cliff` | 풀로 덮인 목재 들보 중앙`wall` · 잔디 절벽 가운데 상단`cliff` · 풀밭 절벽 상단 중앙`cliff` | block-04-07 c19 r4 |
| 140 | 초원 남쪽 흙 경계 `terrain` | 잔디 절벽 오른쪽 상단 `cliff` | 풀로 덮인 목재 들보 오른쪽`wall` · 잔디 절벽 오른쪽 상단`cliff` · 풀밭 절벽 상단 우측`cliff` | block-04-07 c20 r4 |
| 141 | 자주색 밝은 자갈 바닥 `floor` | 자주색 지붕 왼쪽 상단 `roof` | 자주색 돌지붕 왼쪽`roof` · 자주색 지붕 왼쪽 상단`roof` | block-04-07 c21 r4 |
| 142 | 자주색 가로 돌무늬 `floor` | 자주색 지붕 가운데 상단 `roof` | 자주색 돌지붕 중앙`roof` · 자주색 지붕 가운데 상단`roof` | block-04-07 c22 r4 |
| 143 | 자주색 성긴 돌무늬 `floor` | 자주색 지붕 오른쪽 상단 `roof` | 자주색 돌지붕 오른쪽`roof` · 자주색 지붕 오른쪽 상단`roof` | block-04-07 c23 r4 |
| 146 | 검은 세로 벽스위치 `machine` | 벽 스위치 `prop` | 검은 세로형 벽 장식`decoration` · 검은 벽 스위치`prop`* · 좁은 벽 창문`window` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 150 | 어두운 수면 둥근 경계 `water` | 어두운 소용돌이 수면 상부 `water` | 둥근 암흑 가림막 위쪽 왼쪽`decoration`* · 어두운 석벽 왼쪽 상부`wall`* · 어두운 바닥 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 151 | 어두운 수면 둥근 경계 `water` | 어두운 소용돌이 수면 상부 `water` | 둥근 암흑 가림막 위쪽 중앙`decoration`* · 어두운 석벽 가운데 상부`wall`* · 어두운 바닥 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 152 | 어두운 수면 둥근 경계 `water` | 어두운 소용돌이 수면 상부 `water` | 둥근 암흑 가림막 위쪽 오른쪽`decoration`* · 어두운 석벽 오른쪽 상부`wall`* · 어두운 바닥 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 153 | 얼음 동굴 갈라진 벽 `wall` | 얼음 폭포 물살 둘째 모습 `water` | 얼음 폭포 물살 둘째 모습`water` · 얼음 절벽 위쪽`cliff` · 폭포`water` | block-04-07 c3 r5 |
| 157 | 숲 캐노피 가로 띠 `forest` | 나무 수관 가운데 위 `forest` | 큰 덤불 상단 중앙`tree` · 나무 수관 가운데 위`tree` | block-04-07 c7 r5 |
| 159 | 초원 남동쪽 눈모서리 `snow` | 눈밭 위쪽 왼쪽 `snow` | 눈밭 위쪽 왼쪽`terrain` · 눈밭 왼쪽 상단`terrain` | block-04-07 c9 r5 |
| 160 | 초원 남쪽 눈경계 `snow` | 눈밭 가운데 상단 `snow` | 눈밭 위쪽 중앙`terrain` · 눈밭 가운데 상단`terrain` | block-04-07 c10 r5 |
| 164 | 갈색 거친 돌바닥 `floor` | 갈색 무늬 석조 벽 하단 왼쪽 `wall` | 갈색 무늬 석조 벽 하단 왼쪽`wall` · 갈색 석조 벽 왼쪽 상단`wall` | block-04-07 c14 r5 |
| 165 | 갈색 세로 균열 바닥 `floor` | 갈색 무늬 석조 벽 하단 중앙 왼쪽 `wall` | 갈색 무늬 석조 벽 하단 중앙 왼쪽`wall` · 갈색 석조 벽 왼쪽 위`wall` | block-04-07 c15 r5 |
| 166 | 갈색 굽은 균열 바닥 `floor` | 갈색 무늬 석조 벽 하단 중앙 오른쪽 `wall` | 갈색 무늬 석조 벽 하단 중앙 오른쪽`wall` · 갈색 석조 벽 가운데 위`wall` | block-04-07 c16 r5 |
| 167 | 갈색 교차 균열 바닥 `floor` | 갈색 무늬 석조 벽 하단 오른쪽 `wall` | 갈색 무늬 석조 벽 하단 오른쪽`wall` · 갈색 석조 벽 오른쪽 위`wall` | block-04-07 c17 r5 |
| 168 | 눈밭 서쪽 검은 경계 `snow` | 눈 덮인 절벽 왼쪽 상부 `cliff` | 목재 들보 아래 흰 회벽 왼쪽`wall` · 눈 덮인 절벽 왼쪽 상부`cliff` · 눈 덮인 절벽 상단 좌측`cliff` | block-04-07 c18 r5 |
| 169 | 눈밭 북쪽 움푹 경계 `snow` | 눈 덮인 절벽 가운데 상부 `cliff` | 목재 들보 아래 흰 회벽 중앙`wall` · 눈 덮인 절벽 가운데 상부`cliff` · 눈 덮인 절벽 상단 중앙`cliff` | block-04-07 c19 r5 |
| 170 | 눈밭 동쪽 검은 경계 `snow` | 눈 덮인 절벽 오른쪽 상부 `cliff` | 목재 들보 아래 흰 회벽 오른쪽`wall` · 눈 덮인 절벽 오른쪽 상부`cliff` · 눈 덮인 절벽 상단 우측`cliff` | block-04-07 c20 r5 |
| 171 | 갈색 굵은 뿌리 절벽 `cliff` | 뒤엉킨 목재 벽 왼쪽 상부 `wall` | 거친 목재 벽 상단 왼쪽`wall` · 뒤엉킨 목재 벽 왼쪽 상부`wall` | block-04-07 c21 r5 |
| 172 | 갈색 갈라진 뿌리 절벽 `cliff` | 뒤엉킨 목재 벽 가운데 상부 `wall` | 거친 목재 벽 상단 중앙`wall` · 뒤엉킨 목재 벽 가운데 상부`wall` | block-04-07 c22 r5 |
| 173 | 갈색 굽은 뿌리 절벽 `cliff` | 뒤엉킨 목재 벽 오른쪽 상부 `wall` | 거친 목재 벽 상단 오른쪽`wall` · 뒤엉킨 목재 벽 오른쪽 상부`wall` | block-04-07 c23 r5 |
| 180 | 어두운 수면 굽은 경계 `water` | 어두운 소용돌이 수면 하부 `water` | 둥근 암흑 가림막 아래쪽 왼쪽`decoration`* · 어두운 석벽 왼쪽 중부`wall`* · 깊은 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 181 | 어두운 수면 굽은 경계 `water` | 어두운 소용돌이 수면 하부 `water` | 둥근 암흑 가림막 아래쪽 중앙`decoration`* · 어두운 석벽 가운데 중부`wall`* · 깊은 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 182 | 어두운 수면 굽은 경계 `water` | 어두운 소용돌이 수면 하부 `water` | 둥근 암흑 가림막 아래쪽 오른쪽`decoration`* · 어두운 석벽 오른쪽 중부`wall`* · 깊은 구멍`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 183 | 얼음 동굴 아래 가시벽 `wall` | 얼음 폭포 물살 셋째 모습 `water` | 얼음 폭포 물살 셋째 모습`water` · 얼음 절벽 아래쪽`cliff` · 폭포`water` | block-04-07 c3 r6 |
| 187 | 숲 캐노피 가는 테두리 `forest` | 나무 수관 가운데 아래 `forest` | 큰 덤불 가운데 중앙`tree` · 나무 수관 가운데 아래`tree` | block-04-07 c7 r6 |
| 189 | 초원 동쪽 눈경계 `snow` | 눈밭 왼쪽 아래 모서리 `snow` | 눈밭 가운데 왼쪽`terrain` · 눈밭 왼쪽 아래 모서리`terrain` | block-04-07 c9 r6 |
| 191 | 초원 서쪽 눈경계 `snow` | 눈밭 오른쪽 아래 모서리 `snow` | 눈밭 가운데 오른쪽`terrain` · 눈밭 오른쪽 아래 모서리`terrain` | block-04-07 c11 r6 |
| 193 | 회색 나뭇가지 부조 `decoration` | 동굴 석순 상부 `rock` | 회색 나무뿌리 상단`prop` · 목재 세로 보강대 상부`wall` · 동굴 석순`rock` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 196 | 남청색 굽은 돌무늬 `floor` | 짙은 청회색 돌바닥 `floor` | 짙은 청회색 돌바닥`floor` · 청회색 석조 벽 가운데 상부`wall` · 어두운 돌바닥`floor` | block-04-07 c16 r6 |
| 198 | 눈밭 서쪽 짙은 경계 `snow` | 눈 덮인 절벽 왼쪽 하부 `cliff` | 흰 회벽 가운데 왼쪽`wall` · 눈 덮인 절벽 왼쪽 하부`cliff` · 눈 덮인 절벽 좌측`cliff` | block-04-07 c18 r6 |
| 199 | 눈밭 중앙 밝은 면 `snow` | 눈밭 중앙 `terrain` | 흰 회벽 가운데 중앙`wall` · 눈 덮인 절벽 가운데 하부`cliff` · 눈 덮인 절벽 중앙`floor` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 200 | 눈밭 동쪽 짙은 경계 `snow` | 눈 덮인 절벽 오른쪽 하부 `cliff` | 흰 회벽 가운데 오른쪽`wall` · 눈 덮인 절벽 오른쪽 하부`cliff` · 눈 덮인 절벽 우측`cliff` | block-04-07 c20 r6 |
| 201 | 흙벽 왼쪽 굵은 뿌리 `cliff` | 거친 목재 벽 가운데 왼쪽 `wall` | 거친 목재 벽 가운데 왼쪽`wall` · 뒤엉킨 목재 벽 왼쪽 중부`wall` | block-04-07 c21 r6 |
| 202 | 흙벽 중앙 얽힌 뿌리 `cliff` | 뒤엉킨 목재 벽 가운데 중부 `wall` | 거친 목재 벽 가운데 중앙`wall` · 뒤엉킨 목재 벽 가운데 중부`wall` | block-04-07 c22 r6 |
| 203 | 흙벽 오른쪽 세로 뿌리 `cliff` | 거친 목재 벽 가운데 오른쪽 `wall` | 거친 목재 벽 가운데 오른쪽`wall` · 뒤엉킨 목재 벽 오른쪽 중부`wall` | block-04-07 c23 r6 |
| 207 | 검은 창끝형 장식 `decoration` | 무기 거치대 상단 `prop` | 검 거치대 상단`prop` · 장식용 대검 상부`decoration` · 무기 거치대 상단`prop` | block-04-07 c27 r6 |
| 208 | 회색 타원 문장석 `decoration` | 문양이 새겨진 석상 상단 `prop` | 문양이 새겨진 석상 상단`prop` · 문양 새긴 묘비 상부`prop` | block-04-07 c28 r6 |
| 210 | 검은 수면 내부 `water` | 검은 심해 수면 `water` | 검은 가림막 왼쪽`decoration`* · 어두운 석벽 왼쪽 하부`wall`* · 어둠`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 211 | 검은 수면 내부 `water` | 검은 심해 수면 `water` | 검은 가림막 중앙`decoration`* · 어두운 석벽 가운데 하부`wall`* · 어둠`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 212 | 검은 수면 내부 `water` | 검은 심해 수면 `water` | 검은 가림막 오른쪽`decoration`* · 어두운 석벽 오른쪽 하부`wall`* · 어둠`terrain` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 213 | 얼음 동굴 위아래 벽 `wall` | 얼음 폭포 물살 넷째 모습 `water` | 얼음 폭포 물살 넷째 모습`water` · 얼음 절벽 하단`cliff` · 폭포`water` | block-04-07 c3 r7 |
| 219 | 초원 북동쪽 눈모서리 `snow` | 눈밭 아래쪽 왼쪽 `snow` | 눈밭 아래쪽 왼쪽`terrain` · 눈밭 왼쪽 하단`terrain` | block-04-07 c9 r7 |
| 220 | 초원 북쪽 눈경계 `snow` | 눈밭 아래쪽 중앙 `snow` | 눈밭 아래쪽 중앙`terrain` · 눈밭 가운데 하단`terrain` | block-04-07 c10 r7 |
| 221 | 초원 북서쪽 눈모서리 `snow` | 눈밭 아래쪽 오른쪽 `snow` | 눈밭 아래쪽 오른쪽`terrain` · 눈밭 오른쪽 하단`terrain` | block-04-07 c11 r7 |
| 222 | 회색 굵은 뿌리 부조 `decoration` | 동굴 석순 좌하부 `rock` | 회색 나무뿌리 하단 왼쪽`prop` · 석조 벽 왼쪽 하부`wall` · 동굴 석순`rock` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 223 | 회색 가는 뿌리 부조 `decoration` | 작은 동굴 석순 무리 `rock` | 회색 나무뿌리 하단 오른쪽`prop` · 목재 세로 보강대 하부`wall` · 동굴 석순`rock` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 231 | 흙벽 왼쪽 얽힌 뿌리 `cliff` | 뒤엉킨 목재 벽 왼쪽 하부 `wall` | 거친 목재 벽 하단 왼쪽`wall` · 뒤엉킨 목재 벽 왼쪽 하부`wall` | block-04-07 c21 r7 |
| 232 | 흙벽 오른쪽 얽힌 뿌리 `cliff` | 뒤엉킨 목재 벽 오른쪽 하부 `wall` | 거친 목재 벽 하단 오른쪽`wall` · 뒤엉킨 목재 벽 오른쪽 하부`wall` | block-04-07 c22 r7 |
| 233 | 분홍 단색 사각형 `decoration` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 단색 분홍 타일`terrain`* · 빈 슬롯`empty` | block-04-07 c23 r7 |
| 234 | 다색 깃발형 묶음 `banner` | 알록달록한 천더미 `banner` | 색색의 천 더미`prop` · 알록달록한 천더미`prop`* | block-04-07 c24 r7 |
| 236 | 검은 단색 사각형 `decoration` | 검은 출입구 `door` | 검은 출입구`door` · 검은 출입구`door` | block-04-07 c26 r7 |
| 237 | 자홍빛 세로형 받침 장치 `machine` | 무기 거치대 하단 `machine` | 검 거치대 하단`prop` · 장식용 대검 하부`decoration` · 무기 거치대 하단`prop` | block-04-07 c27 r7 |
| 246 | 눈 덮인 침엽수 `tree` | 눈 덮인 산 왼쪽 꼭대기 `cliff` | 눈밭 좌상단 가장자리`terrain` · 눈 덮인 산 왼쪽 꼭대기`cliff` · 눈 덮인 절벽 모서리`cliff` | block-08-11 c6 r8 |
| 252 | 이끼 낀 검은 암벽 `wall` | 이끼 낀 돌바닥 `floor` | 이끼 낀 돌바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c12 r8 |
| 253 | 짙은 회색 자갈 암벽 `wall` | 어두운 돌바닥 `floor` | 어두운 돌바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c13 r8 |
| 254 | 회색 둥근 돌 암벽 `wall` | 돌 포장 바닥 `floor` | 돌 포장 바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c14 r8 |
| 255 | 회색 암벽 좌측 무늬 `wall` | 돌 포장 바닥 `floor` | 돌 포장 바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c15 r8 |
| 256 | 회색 암벽 중앙 무늬 `wall` | 돌 포장 바닥 `floor` | 돌 포장 바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c16 r8 |
| 257 | 회색 암벽 우측 무늬 `wall` | 돌 포장 바닥 `floor` | 돌 포장 바닥`floor` · 어두운 돌바닥`floor` | block-08-11 c17 r8 |
| 258 | 분홍색 평면 사각형 `decoration` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-08-11 c18 r8 |
| 261 | 뿌리 드러난 나무그루터기 `tree` | 통나무 더미 `prop` | 통나무 더미`prop` · 나무 잔해`prop` | block-08-11 c21 r8 |
| 266 | 어두운 철책 하단 `fence` | 어두운 통로 입구 `decoration` | 어두운 통로 입구`decoration` · 검은 커튼 하단`decoration` | block-08-11 c26 r8 |
| 269 | 양문 달린 나무장 `furniture` | 목재 옷장 상단 `furniture` | 목재 옷장 상단`furniture` · 옷장 상단`furniture` | block-08-11 c29 r8 |
| 276 | 설원 서쪽 암석 경계 `snow` | 눈 덮인 절벽 좌측 `cliff` | 눈밭 좌측 가장자리`terrain` · 눈 덮인 산 왼쪽`cliff` · 눈 덮인 절벽 좌측`cliff` | block-08-11 c6 r9 |
| 292 | 붉은 차양 과일가판대 `awning` | 빨간 차양 노점 `prop` | 숲속 마을`decoration` · 빨간 차양 노점`prop` · 마을`prop` | block-08-11 c22 r9 |
| 293 | 흰 차양 상품가판대 `awning` | 눈 덮인 마을 `prop` | 겨울 숲 마을`decoration` · 상점 가판대`prop` · 눈 덮인 마을`prop` | block-08-11 c23 r9 |
| 294 | 세로결 나무판 `wall` | 긴 목재 기둥 상단 `prop` | 긴 목재 기둥 상단`prop` · 목재 기둥 상단`prop` | block-08-11 c24 r9 |
| 299 | 서랍 둘 나무선반 `furniture` | 목재 옷장 하단 `furniture` | 목재 옷장 하단`furniture` · 옷장 하단`furniture` | block-08-11 c29 r9 |
| 300 | 연한 초원 왼쪽 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c0 r10 |
| 301 | 연한 초원 가운데 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c1 r10 |
| 302 | 연한 초원 오른쪽 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c2 r10 |
| 303 | 울창한 풀밭 왼쪽 무늬 `terrain` | 짙은 잔디 `terrain` | 짙은 잔디`terrain` · 잔디`terrain` | block-08-11 c3 r10 |
| 305 | 울창한 풀밭 오른쪽 무늬 `terrain` | 짙은 잔디 `terrain` | 짙은 잔디`terrain` · 잔디`terrain` | block-08-11 c5 r10 |
| 306 | 검은 바위 낀 서쪽 설원 `snow` | 눈 덮인 절벽 좌측 `cliff` | 눈밭 좌측 가장자리`terrain` · 눈 덮인 산 왼쪽`cliff` · 눈 덮인 절벽 좌측`cliff` | block-08-11 c6 r10 |
| 312 | 갈색 자갈 박힌 자주벽 `wall` | 적갈색 흙 `terrain` | 밭 흙`terrain` · 적갈색 흙`terrain` | block-08-11 c12 r10 |
| 313 | 분홍 사각 벽돌벽 `wall` | 자줏빛 흙 `terrain` | 붉은 흙`terrain` · 자줏빛 흙`terrain` | block-08-11 c13 r10 |
| 314 | 남색 벽돌벽 윗무늬 `wall` | 어두운 석벽 상단 `wall` | 어두운 석벽 상단`wall` · 검은 돌바닥`floor` · 석조 벽 상단`wall` | block-08-11 c14 r10 |
| 316 | 남색 벽돌벽 가운데무늬 `wall` | 어두운 석벽 상단 `wall` | 어두운 석벽 상단`wall` · 검은 돌바닥`floor` · 석조 벽 상단`wall` | block-08-11 c16 r10 |
| 322 | 황금 격자 구조물 좌측 `decoration` | 황금 성 상단 좌측 `prop` | 황금 성 좌상단`wall` · 성 왼쪽 상단`prop` · 황금 성 상단 좌측`prop` | block-08-11 c22 r10 |
| 323 | 황금 격자 구조물 우측 `decoration` | 황금 성 상단 우측 `prop` | 황금 성 우상단`wall` · 성 오른쪽 상단`prop` · 황금 성 상단 우측`prop` | block-08-11 c23 r10 |
| 324 | 짙은 세로결 목판 `wall` | 긴 목재 기둥 중단 `prop` | 긴 목재 기둥 중단`prop` · 목재 기둥 중간`prop` | block-08-11 c24 r10 |
| 330 | 초록 평원 왼편 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c0 r11 |
| 331 | 초록 평원 중앙 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c1 r11 |
| 332 | 초록 평원 오른편 무늬 `terrain` | 잔디 `terrain` | 잔디`terrain` · 잔디`terrain` | block-08-11 c2 r11 |
| 333 | 진한 풀숲 왼편 무늬 `terrain` | 짙은 잔디 `terrain` | 짙은 잔디`terrain` · 잔디`terrain` | block-08-11 c3 r11 |
| 334 | 진한 풀숲 중앙 무늬 `terrain` | 짙은 잔디 `terrain` | 짙은 잔디`terrain` · 잔디`terrain` | block-08-11 c4 r11 |
| 335 | 진한 풀숲 오른편 무늬 `terrain` | 짙은 잔디 `terrain` | 짙은 잔디`terrain` · 잔디`terrain` | block-08-11 c5 r11 |
| 336 | 암벽 맞닿은 서쪽 설원 `snow` | 눈 덮인 산 왼쪽 하단 `cliff` | 눈밭 좌하단 가장자리`terrain` · 눈 덮인 산 왼쪽 하단`cliff` · 눈 덮인 절벽 좌하단`cliff` | block-08-11 c6 r11 |
| 337 | 암석 줄기 드러난 설원 `snow` | 눈 덮인 산 가운데 하단 `cliff` | 눈밭 하단 가장자리`terrain` · 눈 덮인 산 가운데 하단`cliff` · 눈 덮인 절벽 하단`cliff` | block-08-11 c7 r11 |
| 338 | 초지 맞닿은 남쪽 설원 `snow` | 눈 덮인 산 오른쪽 하단 `cliff` | 눈밭 우하단 가장자리`terrain` · 눈 덮인 산 오른쪽 하단`cliff` · 눈 덮인 절벽 우하단`cliff` | block-08-11 c8 r11 |
| 342 | 초록 이끼점 자주 바닥 `floor` | 풀 돋은 적갈색 흙 `terrain` | 새싹 밭`plant` · 풀 돋은 적갈색 흙`terrain` · 새싹 밭`terrain` | block-08-11 c12 r11 |
| 343 | 초록 덩굴 자주 암벽 `wall` | 풀 돋은 자줏빛 흙 `terrain` | 새싹 밭`plant` · 풀 돋은 자줏빛 흙`terrain` · 새싹 밭`terrain` | block-08-11 c13 r11 |
| 345 | 짙은 남색 벽돌 왼면 `wall` | 어두운 석벽 하단 `wall` | 어두운 석벽 하단`wall` · 검은 돌바닥`floor` · 석조 벽 하단`wall` | block-08-11 c15 r11 |
| 347 | 짙은 남색 벽돌 오른면 `wall` | 어두운 석벽 하단 `wall` | 어두운 석벽 하단`wall` · 검은 돌바닥`floor` · 석조 벽 하단`wall` | block-08-11 c17 r11 |
| 352 | 황금 차양 구조물 좌측 `decoration` | 황금 성 하단 좌측 `prop` | 황금 성 좌하단`wall` · 성 왼쪽 하단`prop` · 황금 성 하단 좌측`prop` | block-08-11 c22 r11 |
| 353 | 황금 차양 구조물 우측 `decoration` | 황금 성 하단 우측 `prop` | 황금 성 우하단`wall` · 성 오른쪽 하단`prop` · 황금 성 하단 우측`prop` | block-08-11 c23 r11 |
| 354 | 검은 밑단 긴 목판 `wall` | 긴 목재 기둥 하단 `prop` | 긴 목재 기둥 하단`prop` · 목재 기둥 하단`prop` | block-08-11 c24 r11 |
| 355 | 작은 사각 나무받침 `furniture` | 작은 갈색 단지 `prop` | 작은 갈색 단지`prop` · 작은 단지`prop` | block-08-11 c25 r11 |
| 359 | 금테 두른 잠긴 보물상자 `chest` | 거울 화장대 하단 `chest` | 거울 화장대 하단`furniture` · 나무 서랍장`furniture` | block-08-11 c29 r11 |
| 361 | 연두 점무늬 초원 `terrain` | 잔디 `terrain` | 잔디`terrain` · 풀밭`terrain` | block-12-15 c1 r12 |
| 363 | 초원 위 삼각 산봉 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c3 r12 |
| 364 | 밝은 초원 `terrain` | 잔디 `terrain` | 잔디`terrain` · 풀밭`terrain` | block-12-15 c4 r12 |
| 365 | 초원 위 삼각 산봉 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c5 r12 |
| 367 | 칠흑 수면 한가운데 `water` | 어두운 물 상단 `water` | 어두운 물 상단`water` · 어두운 물`water` | block-12-15 c7 r12 |
| 368 | 좌우 끝 검은 수면 `water` | 어두운 물 모서리 `water` | 어두운 물 상단`water` · 어두운 물 모서리`water` | block-12-15 c8 r12 |
| 375 | 용암구덩이 북서 모서리 `lava` | 붉은 양탄자 모서리 `decoration` | 화려한 카펫 좌상`decoration` · 붉은 양탄자 모서리`decoration` | block-12-15 c15 r12 |
| 376 | 용암구덩이 북쪽 테두리 `lava` | 화려한 카펫 상단 `decoration` | 화려한 카펫 상단`decoration` · 붉은 양탄자`decoration` | block-12-15 c16 r12 |
| 377 | 용암구덩이 북동 모서리 `lava` | 붉은 양탄자 모서리 `decoration` | 화려한 카펫 우상`decoration` · 붉은 양탄자 모서리`decoration` | block-12-15 c17 r12 |
| 378 | 왼쪽 산비탈 조각 `mountain` | 화산 바위 좌상 `mountain` | 화산 바위 좌상`rock` · 화산 바위`rock` | block-12-15 c18 r12 |
| 379 | 우뚝한 산봉 조각 `mountain` | 화산 바위 우상 `mountain` | 화산 바위 우상`rock` · 화산 바위`rock` | block-12-15 c19 r12 |
| 390 | 서쪽 그늘 숲수관 `forest` | 큰 나무 좌상 `forest` | 큰 나무 좌상`tree` · 큰 나무 잎`tree` | block-12-15 c0 r13 |
| 391 | 얼룩진 숲 캐노피 `forest` | 큰 나무 상단 `forest` | 큰 나무 상단`tree` · 큰 나무 잎`tree` | block-12-15 c1 r13 |
| 392 | 연한 올리브 수관 `forest` | 큰 나무 우상 `forest` | 큰 나무 우상`tree` · 큰 나무 잎`tree` | block-12-15 c2 r13 |
| 393 | 남동 기슭 산봉우리 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c3 r13 |
| 394 | 양옆 기슭 산봉우리 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c4 r13 |
| 395 | 남서 기슭 산봉우리 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c5 r13 |
| 396 | 검은 수면 북서 모서리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c6 r13 |
| 397 | 검은 수면 북쪽 테두리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c7 r13 |
| 398 | 검은 수면 북동 모서리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c8 r13 |
| 404 | 흰 사선 무늬 석판 `floor` | 흰 사선 유리창 `window` | 흰 사선 무늬`decoration`* · 흰 사선 바닥`terrain` · 유리창`window` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 405 | 용암구덩이 서쪽 테두리 `lava` | 화려한 카펫 좌 `decoration` | 화려한 카펫 좌`decoration` · 붉은 양탄자`decoration` | block-12-15 c15 r13 |
| 406 | 용암구덩이 한가운데 `terrain` | 화려한 카펫 중앙 `decoration` | 화려한 카펫 중앙`decoration` · 붉은 양탄자`decoration` | block-12-15 c16 r13 |
| 407 | 용암구덩이 동쪽 테두리 `lava` | 화려한 카펫 우 `decoration` | 화려한 카펫 우`decoration` · 붉은 양탄자`decoration` | block-12-15 c17 r13 |
| 409 | 가파른 암벽 조각 `cliff` | 화산 바위 우 `cliff` | 화산 바위 우`rock` · 화산 바위`rock` | block-12-15 c19 r13 |
| 410 | 회색 점무늬 석주 `pillar` | 돌 석상 하단 `pillar` | 돌 석상 하단`prop` · 돌 석상 몸통`prop` | block-12-15 c20 r13 |
| 412 | 원형 석조 창살 `decoration` | 돌 우물 `prop` | 우물`prop` · 돌 우물`prop` | block-12-15 c22 r13 |
| 413 | 검은 동굴 입구 `town-icon` | 동굴 입구 `door` | 동굴 입구`prop` · 동굴 입구`door` · 동굴 입구`door` | block-12-15 c23 r13 |
| 417 | 넓은 나무장 왼쪽 `furniture` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c27 r13 |
| 418 | 흰천 걸린 나무장 `furniture` | 피아노 좌 `furniture` | 피아노 좌`furniture` · 피아노`furniture` | block-12-15 c28 r13 |
| 419 | 넓은 나무장 오른쪽 `furniture` | 피아노 우 `furniture` | 피아노 우`furniture` · 피아노`furniture` | block-12-15 c29 r13 |
| 420 | 짙은 줄무늬 숲수관 `forest` | 큰 나무 좌 `forest` | 큰 나무 좌`tree` · 큰 나무 잎`tree` | block-12-15 c0 r14 |
| 421 | 성긴 초록 숲수관 `forest` | 큰 나무 중앙 `forest` | 큰 나무 중앙`tree` · 큰 나무 잎`tree` | block-12-15 c1 r14 |
| 422 | 고른 초록 수관 `forest` | 큰 나무 우 `forest` | 큰 나무 우`tree` · 큰 나무 잎`tree` | block-12-15 c2 r14 |
| 423 | 동쪽 능선 산맥 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c3 r14 |
| 424 | 갈색 산맥 한가운데 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c4 r14 |
| 425 | 서쪽 능선 산맥 `mountain` | 소나무 `tree` | 소나무`tree` · 소나무`tree` | block-12-15 c5 r14 |
| 426 | 검은 수면 서쪽 테두리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c6 r14 |
| 427 | 검은 수면 한가운데 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c7 r14 |
| 428 | 검은 수면 동쪽 테두리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c8 r14 |
| 432 | 보라 회색 돌벽돌 `floor` | 보라 회색 석벽 상단 `wall` | 조약돌 바닥`floor` · 돌바닥`terrain` · 석벽 상단`wall` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 433 | 갈금 마름모 바닥 `floor` | 갈금 벽돌벽 상단 `wall` | 갈색 마루`floor` · 갈색 무늬 바닥`terrain` · 벽돌 벽 상단`wall` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 435 | 용암구덩이 남서 모서리 `lava` | 화려한 카펫 좌 `decoration` | 화려한 카펫 좌`decoration` · 붉은 양탄자`decoration` | block-12-15 c15 r14 |
| 436 | 용암구덩이 남쪽 테두리 `lava` | 화려한 카펫 하단 `decoration` | 화려한 카펫 하단`decoration` · 붉은 양탄자`decoration` | block-12-15 c16 r14 |
| 437 | 용암구덩이 남동 모서리 `lava` | 화려한 카펫 우 `decoration` | 화려한 카펫 우`decoration` · 붉은 양탄자`decoration` | block-12-15 c17 r14 |
| 443 | 회색 창턱 석벽 `wall` | 석조 벽 `wall` | 돌 벽`wall` · 석조 벽`wall` | block-12-15 c23 r14 |
| 444 | 석조 성채 왼쪽 `town-icon` | 책장 좌상 `furniture` | 책장 좌상`furniture` · 책장 상단`furniture`* | block-12-15 c24 r14 |
| 445 | 석조 성채 오른쪽 `town-icon` | 책장 우상 `furniture` | 책장 우상`furniture` · 책장 상단`furniture`* | block-12-15 c25 r14 |
| 450 | 서쪽 웅덩이 숲수관 `forest` | 큰 나무 좌하 `forest` | 큰 나무 좌하`tree` · 큰 나무 잎`tree` | block-12-15 c0 r15 |
| 451 | 남쪽 밝은 숲수관 `forest` | 큰 나무 하단 `forest` | 큰 나무 하단`tree` · 큰 나무 밑동`tree` | block-12-15 c1 r15 |
| 452 | 숲 캐노피 `forest` | 큰 나무 우하 `forest` | 큰 나무 우하`tree` · 큰 나무 잎`tree` | block-12-15 c2 r15 |
| 453 | 초원 맞닿은 서산 `mountain` | 소나무 밑동 `tree` | 소나무`tree` · 소나무 밑동`tree` | block-12-15 c3 r15 |
| 454 | 초원 위 산맥 중앙 `mountain` | 소나무 밑동 `tree` | 소나무`tree` · 소나무 밑동`tree` | block-12-15 c4 r15 |
| 455 | 초원 맞닿은 동산 `mountain` | 소나무 밑동 `tree` | 소나무`tree` · 소나무 밑동`tree` | block-12-15 c5 r15 |
| 457 | 검은 수면 남쪽 테두리 `water` | 어두운 물 `water` | 어두운 물`water` · 어두운 물`water` | block-12-15 c7 r15 |
| 462 | 어긋난 보라 돌벽돌 `floor` | 보라 회색 석벽 하단 `wall` | 조약돌 바닥`floor` · 돌바닥`terrain` · 석벽 하단`wall` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 463 | 갈금 격자 바닥 `floor` | 갈금 벽돌벽 하단 `wall` | 갈색 마루`floor` · 갈색 무늬 바닥`terrain` · 벽돌 벽 하단`wall` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 465 | 용암 서쪽 아래 테두리 `lava` | 화려한 카펫 하단 좌 `decoration` | 화려한 카펫 하단 좌`decoration` · 붉은 양탄자`decoration` | block-12-15 c15 r15 |
| 466 | 어두운 용암 내부 `terrain` | 화려한 카펫 하단 `decoration` | 화려한 카펫 하단`decoration` · 붉은 양탄자`decoration` | block-12-15 c16 r15 |
| 467 | 용암 동쪽 아래 테두리 `lava` | 화려한 카펫 하단 우 `decoration` | 화려한 카펫 하단 우`decoration` · 붉은 양탄자`decoration` | block-12-15 c17 r15 |
| 469 | 가파른 암벽 조각 `cliff` | 화산 바위 우하 `cliff` | 화산 바위 우하`rock` · 화산 바위`rock` | block-12-15 c19 r15 |
| 472 | 회색 세로 석주 `pillar` | 돌 기둥 `pillar` | 돌 벽`wall` · 돌 기둥`wall` | block-12-15 c22 r15 |
| 473 | 회색 가로 석인방 `wall` | 석조 아치 가로보 `wall` | 돌 처마`roof` · 석조 아치`wall` · 돌다리 하단`prop` | **사람 확정** (adj-retro_world-r12-15-c12-23.png, adj-retro_world-r4-7-c0-13.png, adj-retro_world-r4-7-c14-26.png, fin-retro_world-r2-3-c11-16.png, fin-retro_world-r2-3-c25-29.png, fin-retro_world-r8-10-c24-28.png) |
| 474 | 책 꽂힌 서가 왼쪽 `shelf` | 책장 좌하 `shelf` | 책장 좌하`furniture` · 책장`furniture` | block-12-15 c24 r15 |
| 475 | 책 꽂힌 서가 오른쪽 `shelf` | 책장 우하 `shelf` | 책장 우하`furniture` · 책장`furniture` | block-12-15 c25 r15 |
| 476 | 금테 붉은 의자 등 `furniture` | 왕좌 좌석 `furniture` | 왕좌`furniture` · 왕좌 좌석`furniture` | block-12-15 c26 r15 |
| 478 | 붉은 의자 방석 `furniture` | 큰 왕좌 좌석 `furniture` | 큰 왕좌 좌석`furniture` · 왕좌 좌석`furniture` | block-12-15 c28 r15 |

## ship — 교정 318칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 3 | 모래 해변 물가 `sand` | 둥근 청색 창 상단 `window` | 아치형 창문 상단`window` · 둥근 청색 창 상단`window` | block-00-03 c3 r0 |
| 4 | 모래섬 물웅덩이 `sand` | 둥근 청색 창 상단 `window` | 아치형 창문 상단`window` · 둥근 청색 창 상단`window` | block-00-03 c4 r0 |
| 5 | 모래 해안 물결 `sand` | 둥근 청색 창 상단 `window` | 아치형 창문 상단`window` · 둥근 청색 창 상단`window` | block-00-03 c5 r0 |
| 6 | 나무 갑판 `floor` | 구멍 난 가로 나무 바닥 `floor` | 벽돌 벽 구멍`wall` · 목재 바닥의 작은 구멍`terrain` · 구멍 난 가로 나무 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 7 | 나무 갑판 판자 `floor` | 가로 나무 바닥 `floor` | 벽돌 벽`wall` · 가로 목재 판자 바닥`terrain` · 가로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 8 | 짙은 갈색 나무 벽 `wall` | 구멍 난 가로 나무 바닥 모서리 `floor` | 벽돌 벽 구멍`wall` · 목재 바닥 구멍 가장자리`terrain` · 구멍 난 가로 나무 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 9 | 세로 이음 나무 판 `floor` | 구멍 난 세로 나무 바닥 `floor` | 벽돌 벽 구멍`wall` · 뜯긴 세로 판자 구멍`terrain` · 구멍 난 세로 나무 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 10 | 가로 이음 나무 판 `floor` | 세로 나무 바닥 `floor` | 벽돌 벽`wall` · 세로 목재 판자 바닥`terrain` · 세로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 11 | 짙은 갈색 나무 벽면 `wall` | 구멍 난 세로 나무 바닥 모서리 `floor` | 벽돌 벽 구멍`wall` · 목재 바닥 구멍 가장자리`terrain` · 구멍 난 세로 나무 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 12 | 갈색 나무 바닥 `floor` | 갈색 세로 나무 바닥 `floor` | 세로 나무 벽`wall` · 붉은 세로 판자 바닥`terrain` · 짙은 세로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 13 | 밝은 나무 바닥 `floor` | 밝은 가로 나무 바닥 `floor` | 가로 나무 벽`wall` · 밝은 가로 판자 바닥`terrain` · 가로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 14 | 짙은 갈색 나무 바닥 `floor` | 갈색 가로 나무 바닥 `floor` | 가로 나무 벽`wall` · 붉은 가로 판자 바닥`terrain` · 짙은 가로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 15 | 밝은 나무 바닥 판 `floor` | 밝은 세로 나무 바닥 `floor` | 세로 나무 벽`wall` · 밝은 세로 판자 바닥`terrain` · 밝은 세로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 16 | 나무 갑판 널 `floor` | 밝은 가로 나무 바닥 `floor` | 가로 나무 벽`wall` · 밝은 가로 판자 바닥`terrain` · 밝은 가로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 17 | 세로 이음 나무 판 `floor` | 세로 나무 판자 바닥 `floor` | 세로 나무 벽`wall` · 밝은 세로 판자 바닥`terrain` · 세로 나무 판자 바닥`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 22 | 대각선 나무 경사 `path` | 목재 사다리 왼쪽 `stairs` | 나무 사다리`stairs` · 목재 사다리 왼쪽`stairs` | block-00-03 c22 r0 |
| 23 | 줄무늬 나무 경사 `path` | 목재 사다리 오른쪽 `stairs` | 나무 사다리`stairs` · 목재 사다리 오른쪽`stairs` | block-00-03 c23 r0 |
| 25 | 어두운 나무 경사로 `path` | 가는 대각 목재 들보 상단 `prop` | 나무 선체`prop` · 가는 대각 목재 들보 상단`prop` | block-00-03 c25 r0 |
| 26 | 뾰족한 어두운 경사 조각 `cliff` | 선수 골조 상단 `prop` | 나무 선체`prop` · 빈 슬롯`empty` · 선수 난간 상단`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 27 | 어두운 나무 경사로 `path` | 굽은 목재 들보 왼쪽 `prop` | 나무 선체`prop` · 굽은 목재 들보 왼쪽`prop` | block-00-03 c27 r0 |
| 28 | 나무 경사 모서리 `path` | 굽은 목재 들보 중앙 `prop` | 나무 선체`prop` · 굽은 목재 들보 중앙`prop` | block-00-03 c28 r0 |
| 29 | 어두운 경사 끝 조각 `cliff` | 굽은 목재 들보 끝 `prop` | 나무 선체 곡선`prop` · 굽은 목재 들보 끝`prop` | block-00-03 c29 r0 |
| 33 | 모래 자갈 물가 `water` | 둥근 청색 창 하단 왼쪽 `window` | 창문`window` · 둥근 청색 창 하단 왼쪽`window` | block-00-03 c3 r1 |
| 34 | 모래 해안 바닷물 `water` | 둥근 청색 창 하단 중앙 `window` | 창문`window` · 둥근 청색 창 하단 중앙`window` | block-00-03 c4 r1 |
| 35 | 모래 가장자리 바다 `water` | 둥근 청색 창 하단 오른쪽 `window` | 창문`window` · 둥근 청색 창 하단 오른쪽`window` | block-00-03 c5 r1 |
| 36 | 짙은 나무 선체 벽 `wall` | 구멍 난 가로 나무 바닥 상단 좌측 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 상단 왼쪽`terrain` · 구멍 난 가로 나무 바닥 상단 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 37 | 짙은 나무 벽 `wall` | 구멍 난 가로 나무 바닥 상단 중앙 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 상단 중앙`terrain` · 구멍 난 가로 나무 바닥 상단 중앙`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 38 | 짙은 나무 격벽 `wall` | 구멍 난 가로 나무 바닥 상단 우측 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 상단 오른쪽`terrain` · 구멍 난 가로 나무 바닥 상단 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 39 | 짙은 나무 벽판 `wall` | 구멍 난 세로 나무 바닥 상단 좌측 `floor` | 어두운 입구`door` · 세로 판자 구멍 상단 왼쪽`terrain` · 구멍 난 세로 나무 바닥 상단 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 40 | 짙은 나무 벽 조각 `wall` | 구멍 난 세로 나무 바닥 상단 중앙 `floor` | 어두운 입구`door` · 세로 판자 구멍 상단 중앙`terrain` · 구멍 난 세로 나무 바닥 상단 중앙`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 41 | 짙은 나무 칸막이 `wall` | 구멍 난 세로 나무 바닥 상단 우측 `floor` | 어두운 입구`door` · 세로 판자 구멍 상단 오른쪽`terrain` · 구멍 난 세로 나무 바닥 상단 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 42 | 나무 바닥 `floor` | 판벽 위 가는 대각 띠 `wall` | 가로 나무 벽`wall` · 판벽 위 가는 대각 띠`wall` | block-00-03 c12 r1 |
| 43 | 밝은 경사 나무 `path` | 판벽 위 굵은 대각 띠 `wall` | 나무 벽 대각 빔`wall` · 판벽 위 굵은 대각 띠`wall` | block-00-03 c13 r1 |
| 44 | 대각 나무 경사 `path` | 갑판 목조 계단 좌측 난간 `stairs` | 나무 계단 상단`stairs` · 목재 난간 상단 왼쪽`fence` · 갑판 목조 계단 좌측 난간`stairs` | block-00-03 c14 r1 |
| 45 | 급해진 나무 경사 `path` | 갑판 목조 계단 `stairs` | 나무 기둥`furniture` · 목재 난간 왼쪽`fence` · 갑판 목조 계단`stairs` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 48 | 나무 경사 구석 `path` | 두꺼운 대각 목재 들보 상단 `prop` | 대각 목재 빔`wall` · 두꺼운 대각 목재 들보 상단`prop` · 대각선 목조 지지대 좌상단`prop` | block-00-03 c18 r1 |
| 49 | 청록 나무 구조물 `awning` | 줄무늬 가로 덮개 왼쪽 `prop` | 주름 배관`prop` · 줄무늬 가로 덮개 왼쪽`prop`* | block-00-03 c19 r1 |
| 50 | 청록 줄무늬 천막 `awning` | 줄무늬 가로 덮개 중앙 `prop` | 주름 배관`prop` · 줄무늬 가로 덮개 중앙`prop`* | block-00-03 c20 r1 |
| 51 | 청록 천막 가장자리 `awning` | 줄무늬 가로 덮개 오른쪽 `prop` | 주름 배관`prop` · 줄무늬 가로 덮개 오른쪽`prop`* | block-00-03 c21 r1 |
| 52 | 어두운 나무 경사 `path` | 두꺼운 대각 목재 들보 상단 `prop` | 대각 목재 빔`wall` · 두꺼운 대각 목재 들보 상단`prop` · 대각선 목조 지지대 우상단`prop` | block-00-03 c22 r1 |
| 53 | 장식 틀 창문 `window` | 금속 마개 목재 기둥 상단 `prop` | 나무 기둥`wall` · 금속 마개 목재 기둥 상단`prop`* · 선체 수직 기둥 상단`prop` | block-00-03 c23 r1 |
| 54 | 비스듬한 나무 경사 `path` | 가는 대각 목재 들보 중앙 `prop` | 나무 선체`prop` · 가는 대각 목재 들보 중앙`prop` | block-00-03 c24 r1 |
| 55 | 긴 나무 경사 `path` | 가는 대각 목재 들보 중앙 `prop` | 나무 선체`prop` · 가는 대각 목재 들보 중앙`prop` | block-00-03 c25 r1 |
| 56 | 짙은 나무 경사 `path` | 넓은 대각 목재 들보 상단 `prop` | 나무 선체`prop` · 넓은 대각 목재 들보 상단`prop` | block-00-03 c26 r1 |
| 57 | 작은 금속 장식물 `prop` | 짧은 세로 목재 말뚝 `prop` | 탁자 위 나무 막대`prop` · 짧은 세로 목재 말뚝`prop` | block-00-03 c27 r1 |
| 58 | 대칭 장식 조각 `decoration` | 나무 바퀴 정면 `prop` | 톱니바퀴`prop` · 나무 바퀴 정면`prop` | block-00-03 c28 r1 |
| 59 | 대칭 장식 무늬 `decoration` | 나무 바퀴 측면 `prop` | 톱니바퀴`prop` · 나무 바퀴 측면`prop` | block-00-03 c29 r1 |
| 66 | 짙은 갈색 나무 벽 `wall` | 구멍 난 가로 나무 바닥 중단 좌측 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 중단 왼쪽`terrain` · 구멍 난 가로 나무 바닥 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 67 | 아주 짙은 갈색 벽 `wall` | 구멍 난 가로 나무 바닥 내부 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 중단 중앙`terrain` · 바닥 구멍 내부`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 68 | 짙은 나무 벽면 `wall` | 구멍 난 가로 나무 바닥 중단 우측 `floor` | 어두운 입구`door` · 큰 목재 바닥 구멍 중단 오른쪽`terrain` · 구멍 난 가로 나무 바닥 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 69 | 짙은 나무 벽판 `wall` | 구멍 난 세로 나무 바닥 중단 좌측 `floor` | 어두운 입구`door` · 세로 판자 구멍 중단 왼쪽`terrain` · 구멍 난 세로 나무 바닥 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 70 | 아주 짙은 벽 `wall` | 구멍 난 세로 나무 바닥 내부 `floor` | 어두운 입구`door` · 세로 판자 구멍 중단 중앙`terrain` · 바닥 구멍 내부`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 71 | 짙은 나무 칸막이 `wall` | 구멍 난 세로 나무 바닥 중단 우측 `floor` | 어두운 입구`door` · 세로 판자 구멍 중단 오른쪽`terrain` · 구멍 난 세로 나무 바닥 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 72 | 나무 장식 구조물 `prop` | 벽걸이 장치 둥근 상부 `prop` | 기계 상단`prop`* · 벽걸이 장치 둥근 상부`prop`* | block-00-03 c12 r2 |
| 73 | 나무 창문 `window` | 벽걸이 장치 세로 관 상부 `prop` | 세로 탱크`prop` · 벽걸이 장치 세로 관 상부`prop`* | block-00-03 c13 r2 |
| 74 | 대각 격자 나무 `path` | 갑판 목조 계단 측면 난간 `stairs` | 나무 계단`stairs` · 목재 난간 하단 오른쪽`fence` · 갑판 목조 계단 측면 난간`stairs` | block-00-03 c14 r2 |
| 75 | 경사 격자 나무 `path` | 갑판 목조 계단 하단 `stairs` | 나무 계단`stairs` · 목재 난간 하단 왼쪽`fence` · 갑판 목조 계단 하단`stairs` | block-00-03 c15 r2 |
| 76 | 장식 나무 격자판 `fence` | 목재 난간 아래 가로 홈 `wall` | 이층 침대 하단`furniture` · 목재 난간 아래 가로 홈`wall` · 갑판 계단 측면 목조 벽`wall` | block-00-03 c16 r2 |
| 78 | 어두운 나무 격자 `wall` | 두꺼운 대각 목재 들보 중앙 `prop` | 대각 목재 빔`wall` · 두꺼운 대각 목재 들보 중앙`prop` · 대각선 목조 지지대 좌측`prop` | block-00-03 c18 r2 |
| 79 | 나무 경사 구석 `path` | 대각선 목조 지지대 중앙 좌측 `prop` | 대각 목재 빔`wall` · 두꺼운 대각 목재 들보 중앙`prop` · 대각선 목조 지지대 중앙 좌측`prop` | block-00-03 c19 r2 |
| 80 | 대칭 장식 조각 `decoration` | 금속 장식 목재 기둥 중단 `prop` | 세로 배관`prop` · 금속 장식 목재 기둥 중단`prop`* | block-00-03 c20 r2 |
| 81 | 어두운 나무 경사 `path` | 대각선 목조 지지대 중앙 우측 `prop` | 대각 목재 빔`wall` · 두꺼운 대각 목재 들보 중앙`prop` · 대각선 목조 지지대 중앙 우측`prop` | block-00-03 c21 r2 |
| 82 | 어두운 나무 격자 무늬 `wall` | 어두운 대각 목재 들보 중앙 `prop` | 대각 목재 빔`wall` · 어두운 대각 목재 들보 중앙`prop` · 대각선 목조 지지대 우측`prop` | block-00-03 c22 r2 |
| 83 | 청록 줄무늬 천막 `awning` | 사각 금속 등 `prop` | 금속 패널`prop` · 사각 금속 등`prop` | block-00-03 c23 r2 |
| 84 | 나무 경사 구조물 `path` | 금속 덮개와 대각 들보 접합부 `prop` | 나무 선체`prop` · 금속 덮개와 대각 들보 접합부`prop`* | block-00-03 c24 r2 |
| 85 | 나무 경사 구조 `path` | 교차하는 굽은 목재 들보 `prop` | 나무 선체`prop` · 교차하는 굽은 목재 들보`prop`* | block-00-03 c25 r2 |
| 86 | 가느다란 기둥 꼭대기 `pillar` | 선수 골조 우측단 `prop` | 나무 탁자`furniture` · 대각 목재 들보 끝`prop` · 선수 난간 하단`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 87 | 가느다란 기둥 끝 `pillar` | 긴 목재 선반 왼쪽 지지대 `furniture` | 나무 탁자 다리`furniture` · 긴 목재 선반 왼쪽 지지대`furniture` | block-00-03 c27 r2 |
| 88 | 벽 꼭대기 장식 `fence` | 긴 목재 선반 중앙 `furniture` | 나무 탁자`furniture` · 긴 목재 선반 중앙`furniture` | block-00-03 c28 r2 |
| 89 | 벽 모서리 장식 `fence` | 긴 목재 선반 오른쪽 `furniture` | 나무 탁자`furniture` · 긴 목재 선반 오른쪽`furniture` | block-00-03 c29 r2 |
| 93 | 물가 모래 해안 `water` | 창 아래 바다 `water` | 창 아래 바다`water` · 청색 직사각 창 하단 왼쪽`window` · 수면 모서리`water` | block-00-03 c3 r3 |
| 96 | 짙은 나무 벽 `wall` | 구멍 난 가로 나무 바닥 하단 좌측 `floor` | 벽돌 벽 하단`wall` · 큰 목재 바닥 구멍 하단 왼쪽`terrain` · 구멍 난 가로 나무 바닥 하단 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 97 | 짙은 갈색 벽 `wall` | 구멍 난 가로 나무 바닥 하단 중앙 `floor` | 벽돌 벽 하단`wall` · 큰 목재 바닥 구멍 하단 중앙`terrain` · 구멍 난 가로 나무 바닥 하단 중앙`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 98 | 짙은 나무 벽면 `wall` | 구멍 난 가로 나무 바닥 하단 우측 `floor` | 벽돌 벽 하단`wall` · 큰 목재 바닥 구멍 하단 오른쪽`terrain` · 구멍 난 가로 나무 바닥 하단 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 99 | 짙은 나무 벽판 `wall` | 구멍 난 세로 나무 바닥 하단 좌측 `floor` | 벽돌 벽 하단`wall` · 세로 판자 구멍 하단 왼쪽`terrain` · 구멍 난 세로 나무 바닥 하단 좌측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 100 | 짙은 나무 격벽 `wall` | 구멍 난 세로 나무 바닥 하단 중앙 `floor` | 벽돌 벽 하단`wall` · 세로 판자 구멍 하단 중앙`terrain` · 구멍 난 세로 나무 바닥 하단 중앙`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 101 | 짙은 나무 칸막이 `wall` | 구멍 난 세로 나무 바닥 하단 우측 `floor` | 벽돌 벽 하단`wall` · 세로 판자 구멍 하단 오른쪽`terrain` · 구멍 난 세로 나무 바닥 하단 우측`floor` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 102 | 나무 장식 구조물 `prop` | 벽걸이 장치 사각 하부 `prop` | 기계 하단`prop` · 벽걸이 장치 사각 하부`prop`* | block-00-03 c12 r3 |
| 103 | 나무 창문 `window` | 벽걸이 장치 세로 관 하부 `prop` | 세로 탱크`prop` · 벽걸이 장치 세로 관 하부`prop`* | block-00-03 c13 r3 |
| 107 | 높은 나무 기둥 `pillar` | 좁은 목재 판문 `door` | 나무 문`door`* · 좁은 목재 판문`door` | block-00-03 c17 r3 |
| 108 | 나무 장식 구조물 `prop` | 선체 수평 지지대 좌측 `prop` | 나무 벽과 배관`wall` · 판벽 앞 가는 금속 막대`decoration` · 선체 수평 지지대 좌측`prop` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 109 | 대각 격자 나무 판 `path` | 대각선 목조 지지대 하단 좌측 `prop` | 대각 목재 빔`wall` · 어두운 대각 목재 들보 하단`prop` · 대각선 목조 지지대 하단 좌측`prop` | block-00-03 c19 r3 |
| 111 | 경사 격자 나무 판 `path` | 대각선 목조 지지대 하단 우측 `prop` | 대각 목재 빔`wall` · 어두운 대각 목재 들보 하단`prop` · 대각선 목조 지지대 하단 우측`prop` | block-00-03 c21 r3 |
| 112 | 나무 장식 구조물 `prop` | 선체 수평 지지대 우측 `prop` | 가로 배관`prop` · 판벽 앞 굽은 띠와 금속 막대`decoration`* · 선체 수평 지지대 우측`prop` | block-00-03 c22 r3 |
| 113 | 청록 줄무늬 천막 `awning` | 가로 줄무늬 금속 막대 `prop` | 주름 배관`prop` · 가로 줄무늬 금속 막대`prop`* | block-00-03 c23 r3 |
| 114 | 비스듬한 나무 경사 `path` | 긴 대각 목재 들보 왼쪽 `prop` | 나무 선체`prop` · 긴 대각 목재 들보 왼쪽`prop` | block-00-03 c24 r3 |
| 115 | 어두운 나무 경사 `path` | 긴 대각 목재 들보 중앙 `prop` | 나무 선체`prop` · 긴 대각 목재 들보 중앙`prop` | block-00-03 c25 r3 |
| 116 | 긴 나무 경사 `path` | 긴 대각 목재 들보 오른쪽 `prop` | 나무 선체`prop` · 긴 대각 목재 들보 오른쪽`prop` | block-00-03 c26 r3 |
| 117 | 어두운 경사 조각 `cliff` | 넓은 대각 목재 들보 왼쪽 `prop` | 나무 선체`prop` · 넓은 대각 목재 들보 왼쪽`prop` | block-00-03 c27 r3 |
| 118 | 나무 경사판 `path` | 넓은 대각 목재 들보 오른쪽 `prop` | 나무 선체`prop` · 넓은 대각 목재 들보 오른쪽`prop` | block-00-03 c28 r3 |
| 120 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c0 r4 |
| 122 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c2 r4 |
| 123 | 옅은 파도 바닷물 `water` | 소용돌이치는 바다 `water` | 소용돌이치는 바다`water` · 거품 이는 바다`water` | block-04-07 c3 r4 |
| 125 | 옅은 파도 바닷물 `water` | 소용돌이 중심 바다 `water` | 소용돌이 중심 바다`water` · 소용돌이 중심`water` | block-04-07 c5 r4 |
| 126 | 중앙 어두운 반점 나무 갑판 `prop` | 구멍 뚫린 목재 바닥 `floor` | 갑판 작은 구멍`floor` · 구멍 뚫린 목재 바닥`floor` | block-04-07 c6 r4 |
| 128 | 어두운 개구부 목재 틀 `wall` | 십자형 구멍 뚫린 목재 바닥 `floor` | 갑판 바닥 구멍 상단`floor` · 십자형 구멍 뚫린 목재 바닥`floor` | block-04-07 c8 r4 |
| 131 | 어두운 개구부 목재 틀 `wall` | 십자형 구멍 뚫린 세로 목재 바닥 `floor` | 갑판 바닥 구멍 상단`floor` · 십자형 구멍 뚫린 세로 목재 바닥`floor` | block-04-07 c11 r4 |
| 132 | 무늬 나무 갑판 `floor` | 갑판 급수 펌프 하단부 `machine` | 바닥 고정 고리 상단`floor` · 갑판 바닥 쇠고리`prop` · 갑판 쇠고리`prop` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 134 | 나무 판자 바닥 `floor` | 둥근 구멍 아래 선체 가로 판벽 `wall` | 목재 벽 상단 좌측`wall` · 목재 계단 좌측`stairs` · 목조 계단 좌측`stairs` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 135 | 나무 판자 바닥 `floor` | 둥근 구멍 아래 선체 가로 판벽 `wall` | 목재 벽 상단 중앙`wall` · 목재 계단 중앙`stairs` · 목조 계단 중앙`stairs` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 136 | 가장자리 음영 나무 판자 `floor` | 둥근 구멍 아래 선체 가로 판벽 `wall` | 목재 벽 상단 우측`wall` · 목재 계단 우측`stairs` · 목조 계단 우측`stairs` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 137 | 금빛 장식이 섞인 나무 `decoration` | 목재 벽 모서리 `wall` | 목재 벽 모서리`wall` · 목재 벽 모서리`wall` | block-04-07 c17 r4 |
| 138 | 줄무늬 천 가장자리 목재 `awning` | 원통형 권양기 좌측 `prop` | 원통형 권양기 좌측`prop` · 가로형 권양기 좌측`prop` | block-04-07 c18 r4 |
| 139 | 금빛 장식 나무 `decoration` | 목조 골조 벽 좌측 사선 브레이스 `wall` | 갑판 난간 대각선 좌상단`fence` · 대각선 목재 지붕 지지대 좌측`wall` · 목조 골조 벽 좌측 사선`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 140 | 금빛 목재 격자 난간 `fence` | 목조 골조 벽 중앙 기둥 `wall` | 갑판 난간 세로 중앙`fence` · 중앙 수직 목재 지붕 지지대`wall` · 목조 골조 벽 중앙 기둥`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 141 | 금빛 장식 나무 `decoration` | 목조 골조 벽 우측 사선 브레이스 `wall` | 갑판 난간 대각선 우상단`fence` · 대각선 목재 지붕 지지대 우측`wall` · 목조 골조 벽 우측 사선`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 142 | 줄무늬 천 목재 장식 `awning` | 원통형 권양기 우측 `prop` | 원통형 권양기 우측`prop` · 가로형 권양기 우측`prop` | block-04-07 c22 r4 |
| 143 | 금빛 띠 장식 목재 판넬 `decoration` | 벽 부착 가로 널 선반 `shelf` | 목재 벽 상단`wall` · 목재 계단`stairs` · 1칸 목조 계단`stairs` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 146 | 비스듬한 목재 곡선 조각 `prop` | 대각선 선체 난간 상단 좌측 `wall` | 비스듬한 선체 외벽 좌상단`wall` · 대각선 선체 난간 상단 좌측`wall` | block-04-07 c26 r4 |
| 147 | 비스듬한 목재 이음매 `floor` | 대각선 선체 난간 상단 우측 `wall` | 비스듬한 선체 외벽 우상단`wall` · 대각선 선체 난간 상단 우측`wall` | block-04-07 c27 r4 |
| 148 | 작은 다색 조형물 `prop` | 선반 위 색색 물약병 `prop` | 포션 상자 선반`prop` · 선반 위의 물약병`furniture` · 물약 상자`prop` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 149 | 떠 있는 나무 판자 조각 `prop` | 갑판 목재 울타리 난간 상단 `fence` | 갑판 목재 울타리 난간 상단`fence` · 목재 난간`fence` | block-04-07 c29 r4 |
| 150 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c0 r5 |
| 152 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c2 r5 |
| 153 | 옅은 파도 바닷물 `water` | 소용돌이치는 바다 `water` | 소용돌이치는 바다`water` · 거품 이는 바다`water` | block-04-07 c3 r5 |
| 155 | 옅은 파도 바닷물 `water` | 소용돌이 중심 바다 `water` | 소용돌이 중심 바다`water` · 소용돌이 중심`water` | block-04-07 c5 r5 |
| 156 | 목재 위 어두운 바닥 `wall` | 갑판 바닥 구멍 좌상단 `floor` | 갑판 큰 구멍 좌상단`floor` · 갑판 바닥 구멍 좌상단`floor` | block-04-07 c6 r5 |
| 157 | 목재 상단 어두운 하단 `wall` | 갑판 큰 구멍 상단 중앙 `floor` | 갑판 큰 구멍 상단 중앙`floor` · 갑판 바닥 구멍 상단`floor` | block-04-07 c7 r5 |
| 158 | 목재 남쪽 어두움 `wall` | 갑판 바닥 구멍 우상단 `floor` | 갑판 큰 구멍 우상단`floor` · 갑판 바닥 구멍 우상단`floor` | block-04-07 c8 r5 |
| 159 | 목재 서쪽 어두운 벽 `wall` | 세로 갑판 바닥 구멍 좌상단 `floor` | 갑판 세로 구멍 좌상단`floor` · 세로 갑판 바닥 구멍 좌상단`floor` | block-04-07 c9 r5 |
| 160 | 목재와 어둠 경사 벽 `wall` | 갑판 세로 구멍 상단 중앙 `floor` | 갑판 세로 구멍 상단 중앙`floor` · 세로 갑판 바닥 구멍 상단`floor` | block-04-07 c10 r5 |
| 161 | 어둠과 우측 목재 벽 `wall` | 세로 갑판 바닥 구멍 우상단 `floor` | 갑판 세로 구멍 우상단`floor` · 세로 갑판 바닥 구멍 우상단`floor` | block-04-07 c11 r5 |
| 162 | 비스듬한 목재 격자 `decoration` | 대각선 계단 난간 상단 좌측 `stairs` | 난간 계단 좌상단`stairs` · 대각선 계단 난간 상단 좌측`stairs` | block-04-07 c12 r5 |
| 163 | 비스듬한 목재 사선 무늬 `decoration` | 대각선 계단 난간 상단 중앙 `stairs` | 난간 계단 중앙 상단`stairs` · 대각선 계단 난간 상단 중앙`stairs` | block-04-07 c13 r5 |
| 164 | 비스듬한 목재 격자 `decoration` | 대각선 계단 난간 상단 우측 `stairs` | 난간 계단 우상단`stairs` · 대각선 계단 난간 상단 우측`stairs` | block-04-07 c14 r5 |
| 165 | 위 목재 아래 금빛 무늬 `decoration` | 계단 측면 목재 바닥 `floor` | 계단 측면 목재 바닥`floor` · 목재 갑판 바닥`floor` | block-04-07 c15 r5 |
| 166 | 비스듬한 목재 격자 `decoration` | 곡선 선체 난간 상단 좌측 `wall` | 계단 측면 목재 벽 좌측`wall` · 곡선 선체 난간 상단 좌측`wall` | block-04-07 c16 r5 |
| 167 | 금빛 띠 목재 무늬 `decoration` | 곡선 선체 난간 상단 우측 `wall` | 계단 측면 목재 벽 우측`wall` · 곡선 선체 난간 상단 우측`wall` | block-04-07 c17 r5 |
| 168 | 거친 잔물결 바닷물 `water` | 짙은 석조 벽돌 벽 `wall` | 석재 난간 상단 좌측`fence` · 석조 난간 좌단`wall` · 석조 벽 좌측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 169 | 거친 잔물결 바닷물 `water` | 짙은 석조 벽돌 벽 `wall` | 석재 난간 상단 중앙`fence` · 석조 난간 중앙 좌측`wall` · 석조 벽 중앙 좌측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 170 | 거친 잔물결 바닷물 `water` | 짙은 석조 벽돌 벽 `wall` | 석재 난간 상단 중앙`fence` · 석조 난간 중앙 우측`wall` · 석조 벽 중앙 우측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 171 | 거친 잔물결 바닷물 `water` | 짙은 석조 벽돌 벽 `wall` | 석재 난간 상단 우측`fence` · 석조 난간 우단`wall` · 석조 벽 우측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 172 | 금빛 모서리 장식 목재 `decoration` | 세로 널 목조 벽 `wall` | 갑판 둥근 난간 좌상단`fence` · 목재 선실 벽 아치 좌측`wall` · 아치형 목조 벽 좌측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 173 | 금빛 모서리 장식 목재 `decoration` | 세로 널 목조 벽 우측 곡선 테두리 `wall` | 갑판 둥근 난간 우상단`fence` · 목재 선실 벽 아치 우측`wall` · 아치형 목조 벽 우측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 174 | 비스듬한 목재 곡선 조각 `prop` | 곡선 선체 난간 좌상단 `wall` | 곡선 선체 외벽 좌측`wall` · 곡선 선체 난간 좌상단`wall` | block-04-07 c24 r5 |
| 175 | 비스듬한 목재 격자 무늬 `prop` | 비스듬한 선체 외벽 중앙 `wall` | 비스듬한 선체 외벽 중앙`wall` · 대각선 선체 난간`wall` | block-04-07 c25 r5 |
| 176 | 비스듬한 목재 곡선 조각 `prop` | 비스듬한 선체 외벽 우측 `wall` | 비스듬한 선체 외벽 우측`wall` · 대각선 선체 난간`wall` | block-04-07 c26 r5 |
| 177 | 비스듬한 목재 곡선 조각 `prop` | 선체 곡선 난간 대각선 조각 `fence` | 빈 슬롯`empty` · 대각선 선체 난간 모서리`wall` · 선체 난간 대각선 하단`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 178 | 비스듬한 목재 곡선 조각 `prop` | 비스듬한 선체 외벽 모서리 `wall` | 비스듬한 선체 외벽 모서리`wall` · 대각선 선체 난간`wall` | block-04-07 c28 r5 |
| 180 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c0 r6 |
| 182 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c2 r6 |
| 183 | 옅은 파도 바닷물 `water` | 소용돌이치는 바다 `water` | 소용돌이치는 바다`water` · 거품 이는 바다`water` | block-04-07 c3 r6 |
| 185 | 옅은 파도 바닷물 `water` | 소용돌이 중심 바다 `water` | 소용돌이 중심 바다`water` · 소용돌이 중심`water` | block-04-07 c5 r6 |
| 186 | 목재 위 어두운 바닥 `wall` | 갑판 큰 구멍 좌측 중앙 `floor` | 갑판 큰 구멍 좌측 중앙`floor` · 갑판 바닥 구멍 좌측`floor` | block-04-07 c6 r6 |
| 187 | 새까만 어두운 벽 `wall` | 갑판 큰 구멍 내부 중앙 `floor` | 갑판 큰 구멍 내부 중앙`floor` · 갑판 바닥 구멍 내부`floor` | block-04-07 c7 r6 |
| 188 | 우측 목재 어두운 벽 `wall` | 갑판 큰 구멍 우측 중앙 `floor` | 갑판 큰 구멍 우측 중앙`floor` · 갑판 바닥 구멍 우측`floor` | block-04-07 c8 r6 |
| 189 | 좌측 목재 어두운 벽 `wall` | 세로 갑판 바닥 구멍 좌측 `floor` | 갑판 세로 구멍 좌측`floor` · 세로 갑판 바닥 구멍 좌측`floor` | block-04-07 c9 r6 |
| 190 | 새까만 어두운 벽 `wall` | 세로 갑판 바닥 구멍 내부 `floor` | 갑판 세로 구멍 내부`floor` · 세로 갑판 바닥 구멍 내부`floor` | block-04-07 c10 r6 |
| 191 | 어둠과 우측 목재 벽 `wall` | 세로 갑판 바닥 구멍 우측 `floor` | 갑판 세로 구멍 우측`floor` · 세로 갑판 바닥 구멍 우측`floor` | block-04-07 c11 r6 |
| 192 | 금빛 테 목재 문 `door` | 선실 사각 창 개구부 `window` | 선실 창문 프레임 상단`window` · 목재 기둥 구조물`prop` · 계단 하부 목조 지지대`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 193 | 세로 결 무늬 나무 갑판 `floor` | 선실 목재 벽 상단 `wall` | 선실 목재 벽 상단`wall` · 세로 목재 벽`wall` | block-04-07 c13 r6 |
| 194 | 비스듬한 목재 금빛 격자 `decoration` | 대각선 계단 난간살 상단 `stairs` | 난간 계단 좌하단`stairs` · 대각선 계단 난간살 상단`stairs` | block-04-07 c14 r6 |
| 195 | 비스듬한 목재 사선 무늬 `decoration` | 대각선 계단 난간살 하단 `stairs` | 난간 계단 우하단`stairs` · 대각선 계단 난간살 하단`stairs` | block-04-07 c15 r6 |
| 196 | 비스듬한 목재 격자 `decoration` | 목재 갑판 바닥 모서리 `floor` | 계단 착지 목재 바닥`floor` · 목재 갑판 바닥 모서리`floor` | block-04-07 c16 r6 |
| 197 | 금빛 목재 격자 무늬 `decoration` | 목재 벽 하단 그림자 `wall` | 목재 벽 하단 그림자`wall` · 어두운 목재 벽 하단`wall` | block-04-07 c17 r6 |
| 198 | 금빛 목재 짜임 무늬 `decoration` | 목재 벽 상단 좌측 `wall` | 목재 벽 상단 좌측`wall` · 목재 선실 벽 좌측`wall` | block-04-07 c18 r6 |
| 199 | 금빛 목재 격자 무늬 `decoration` | 목재 선실 벽 중앙 좌측 `wall` | 목재 벽 상단 중앙`wall` · 목재 선실 벽 중앙 좌측`wall` | block-04-07 c19 r6 |
| 200 | 금빛 목재 짜임 무늬 `decoration` | 목재 선실 벽 중앙 우측 `wall` | 목재 벽 상단 중앙`wall` · 목재 선실 벽 중앙 우측`wall` | block-04-07 c20 r6 |
| 201 | 금빛 목재 격자 무늬 `decoration` | 목재 벽 상단 우측 `wall` | 목재 벽 상단 우측`wall` · 목재 선실 벽 우측`wall` | block-04-07 c21 r6 |
| 202 | 가로 목재 격자 난간 `fence` | 환기 격자창 `window` | 환기 격자창`window` · 환기창`window` | block-04-07 c22 r6 |
| 203 | 금빛 격자 망 `fence` | 둥근 목조 기둥 `pillar` | 목재 기둥 상단`wall` · 돛대 기둥`prop` · 둥근 목조 기둥`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 204 | 받침대 작은 등불 `prop` | 밧줄과 활 장비 `prop` | 밧줄과 도르래`prop` · 밧줄과 활 장비`prop` | block-04-07 c24 r6 |
| 205 | 담색 덩어리 더미 `prop` | 해골과 뼈 더미 `decoration` | 해골과 뼈`prop` · 해골과 뼈`decoration` · 해골과 뼈`decoration` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 206 | 작은 목재 조각 `prop` | 선박 뱃머리 돌출봉 끝부분 `prop` | 선박 뱃머리 돌출봉 끝부분`prop` · 빌레잉 핀 하단`prop` | block-04-07 c26 r6 |
| 207 | 비스듬한 목재 격자 `decoration` | 선체 곡선 난간과 갑판 이음 `fence` | 비스듬한 선체 외벽 하단 좌측`wall` · 대각선 선체 바닥 가장자리`floor` · 선체 난간과 갑판`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 208 | 비스듬한 목재 곡선 조각 `prop` | 비스듬한 선체 외벽 하단 우측 `wall` | 비스듬한 선체 외벽 하단 우측`wall` · 대각선 선체 난간`wall` | block-04-07 c28 r6 |
| 209 | 비스듬한 목재 곡선 조각 `prop` | 비스듬한 선체 외벽 우하단 `wall` | 비스듬한 선체 외벽 우하단`wall` · 대각선 선체 난간 하단`wall` | block-04-07 c29 r6 |
| 212 | 짙은 파도 바닷물 `water` | 어두운 바다 `water` | 바다`water` · 어두운 바다`water` | block-04-07 c2 r7 |
| 213 | 옅은 파도 바닷물 `water` | 소용돌이치는 바다 `water` | 소용돌이치는 바다`water` · 거품 이는 바다`water` | block-04-07 c3 r7 |
| 215 | 옅은 파도 바닷물 `water` | 소용돌이 중심 바다 `water` | 소용돌이 중심 바다`water` · 소용돌이 중심`water` | block-04-07 c5 r7 |
| 216 | 목재 북쪽 경계 어두움 `wall` | 갑판 바닥 구멍 좌하단 `floor` | 갑판 큰 구멍 좌하단`floor` · 갑판 바닥 구멍 좌하단`floor` | block-04-07 c6 r7 |
| 217 | 목재 남쪽 경계 어두움 `wall` | 갑판 큰 구멍 하단 중앙 `floor` | 갑판 큰 구멍 하단 중앙`floor` · 갑판 바닥 구멍 하단`floor` | block-04-07 c7 r7 |
| 218 | 목재 동쪽 경계 어두움 `wall` | 갑판 바닥 구멍 우하단 `floor` | 갑판 큰 구멍 우하단`floor` · 갑판 바닥 구멍 우하단`floor` | block-04-07 c8 r7 |
| 219 | 목재 서쪽 경계 어두움 `wall` | 세로 갑판 바닥 구멍 좌하단 `floor` | 갑판 세로 구멍 좌하단`floor` · 세로 갑판 바닥 구멍 좌하단`floor` | block-04-07 c9 r7 |
| 220 | 목재 모서리 어두움 `wall` | 갑판 세로 구멍 하단 중앙 `floor` | 갑판 세로 구멍 하단 중앙`floor` · 세로 갑판 바닥 구멍 하단`floor` | block-04-07 c10 r7 |
| 221 | 목재 모서리 어두움 `wall` | 세로 갑판 바닥 구멍 우하단 `floor` | 갑판 세로 구멍 우하단`floor` · 세로 갑판 바닥 구멍 우하단`floor` | block-04-07 c11 r7 |
| 222 | 금빛 테 나무 판자 `floor` | 세로 목재 벽 좌측 가장자리 `wall` | 선실 기둥 모서리 하단`wall` · 세로 목재 벽 좌측 가장자리`wall` | block-04-07 c12 r7 |
| 223 | 세로 결 금빛 나무 갑판 `floor` | 선실 목재 벽 하단 `wall` | 선실 목재 벽 하단`wall` · 세로 목재 벽`wall` | block-04-07 c13 r7 |
| 224 | 짜임 목재 격자 무늬 `decoration` | 대각선 계단 난간 하단 좌측 `stairs` | 계단 난간 지지대 좌측`stairs` · 대각선 계단 난간 하단 좌측`stairs` | block-04-07 c14 r7 |
| 225 | 짜임 목재 격자 무늬 `decoration` | 대각선 계단 난간 기둥 하단 `stairs` | 계단 난간 지지대 우측`stairs` · 대각선 계단 난간 기둥 하단`stairs` | block-04-07 c15 r7 |
| 226 | 줄무늬 천 장식 목재 `awning` | 원통형 권양기 하단 좌측 `prop` | 원통형 권양기 하단 좌측`prop` · 권양기 드럼 하단`prop` | block-04-07 c16 r7 |
| 227 | 금빛 장식 곡선 목재 `decoration` | 원통형 권양기 하단 레버 `prop` | 원통형 권양기 하단 레버`prop` · 권양기 손잡이 상단`prop` | block-04-07 c17 r7 |
| 228 | 금빛 목재 격자 무늬 `fence` | 목재 선실 벽 하단 좌측 `wall` | 목재 벽 하단 좌측`wall` · 목재 선실 벽 하단 좌측`wall` | block-04-07 c18 r7 |
| 229 | 목재 격자 무늬 `fence` | 목재 선실 벽 하단 중앙 좌측 `wall` | 목재 벽 하단 중앙`wall` · 목재 선실 벽 하단 중앙 좌측`wall` | block-04-07 c19 r7 |
| 230 | 금빛 목재 격자 무늬 `fence` | 목재 선실 벽 하단 중앙 우측 `wall` | 목재 벽 하단 중앙`wall` · 목재 선실 벽 하단 중앙 우측`wall` | block-04-07 c20 r7 |
| 231 | 금빛 목재 격자 무늬 `fence` | 목재 선실 벽 하단 우측 `wall` | 목재 벽 하단 우측`wall` · 목재 선실 벽 하단 우측`wall` | block-04-07 c21 r7 |
| 232 | 색무늬 목재 문 패널 `door` | 창살 격자 창문 `window` | 창살 격자 창문`window` · 격자 창문`window` | block-04-07 c22 r7 |
| 234 | 위 목재 아래 어두운 축 `prop` | 선박 뱃머리 선수루 좌측 `prop` | 선박 뱃머리 선수루 좌측`prop` · 돛대 가로목 좌측`prop` | block-04-07 c24 r7 |
| 235 | 금빛 상단 목재 조각 `prop` | 선박 뱃머리 선수루 중앙 `prop` | 선박 뱃머리 선수루 중앙`prop` · 돛대 가로목 중앙 좌측`prop` | block-04-07 c25 r7 |
| 236 | 매달린 금빛 장식 `decoration` | 선박 뱃머리 돌출봉 연결부 `prop` | 선박 뱃머리 돌출봉 연결부`prop` · 돛대 가로목 중앙 우측`prop` | block-04-07 c26 r7 |
| 237 | 모서리 목재 금빛 조각 `prop` | 선박 뱃머리 선수루 우측 끝 `prop` | 선박 뱃머리 선수루 우측 끝`prop` · 돛대 가로목 우측 끝`prop` | block-04-07 c27 r7 |
| 238 | 금빛 곡선 장식 목재 `decoration` | 선체 난간 모서리 연결부 `fence` | 선박 뱃머리 난간 좌하단`fence` · 선체 난간 지지대`wall` · 선체 난간 모서리 연결부`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 239 | 금빛 줄무늬 천 `awning` | 선체 난간 모서리 금속 부속 `fence` | 선박 뱃머리 금속 결합부`fence` · 선체 난간 모서리 금속 보강재`wall` · 선체 난간 모서리 금속 부속`fence` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 245 | 잔디 오목 모서리 `terrain` | 모래 위 풀밭 우측 상단 `terrain` | 모래 위 풀밭 우측 상단`terrain` · 모래 위 풀밭 우측 상단`terrain` | block-08-11 c5 r8 |
| 254 | 짙은 가로 선실판 `floor` | 선실 목재 벽 상단 `wall` | 목재 벽 상단`wall` · 선실 목재 벽 상단`wall` | block-08-11 c14 r8 |
| 255 | 짙은 가로 널바닥 `floor` | 선실 목재 벽 상단 `wall` | 목재 벽 상단`wall` · 선실 목재 벽 상단`wall` | block-08-11 c15 r8 |
| 256 | 갑판 관통 돛대 `pillar` | 벽면 사다리 상단 `stairs` | 벽면 사다리 상단`stairs` · 벽면 사다리 상단`stairs` · 벽면 사다리 상단`stairs` | block-08-11 c16 r8 |
| 257 | 회색 둥근 금속물 `prop` | 선박 기계 상단 `prop` | 조타륜 상단`prop` · 선박 기계 상단`prop` · 조타륜 상단`prop` | block-08-11 c17 r8 |
| 259 | 회색 쇠닻 `prop` | 닻 `prop` | 닻`prop` · 닻`prop` | block-08-11 c19 r8 |
| 261 | 작은 나무 끝촉 `prop` | 돛대 꼭대기 `prop` | 돛대 상단`prop` · 돛대 꼭대기`prop` · 돛대 상단`prop` | block-08-11 c21 r8 |
| 262 | 우하 대각 들보 `ship` | 삼각 돛 우측 상단 `ship` | 대각선 선체 난간`wall` · 선체 경사 목재`prop` · 삼각 돛 우측 상단`prop` | block-08-11 c22 r8 |
| 264 | 검은 사각 면 `decoration` | 갑판 해치 입구 상단 `door` | 선실 입구 상단`door` · 갑판 해치 입구 상단`door` · 선실 출입구 상단`door` | block-08-11 c24 r8 |
| 265 | 굵은 대각 선체판 `ship` | 대각선 선체 외벽 `wall` | 대각선 선체 외벽`wall` · 선체 경사 목재`wall` | block-08-11 c25 r8 |
| 266 | 북서 삼각 선체 `ship` | 대각선 선체 외벽 모서리 `wall` | 대각선 선체 외벽 모서리`wall` · 선체 경사 목재`wall` | block-08-11 c26 r8 |
| 267 | 북동 삼각 선체 `ship` | 대각선 선체 외벽 `wall` | 대각선 선체 외벽`wall` · 선체 경사 목재`wall` | block-08-11 c27 r8 |
| 268 | 좌상 대각 선체 `ship` | 대각선 선체 외벽 `wall` | 대각선 선체 외벽`wall` · 선체 경사 목재`wall` | block-08-11 c28 r8 |
| 269 | 남서 삼각 선체 `ship` | 대각선 선체 외벽 모서리 `wall` | 대각선 선체 외벽 모서리`wall` · 선체 경사 목재`wall` | block-08-11 c29 r8 |
| 279 | 잔벽돌 나무판 `floor` | 목재 갑판 바닥 `floor` | 목재 갑판 바닥`floor` · 목재 바닥`floor` | block-08-11 c9 r9 |
| 281 | 가로결 나무판 `floor` | 목재 갑판 바닥 `floor` | 목재 갑판 바닥`floor` · 목재 바닥`floor` | block-08-11 c11 r9 |
| 283 | 두 짝 나무 선실문 `door` | 선실 목조 장식 벽판 `wall` | 목재 벽 하단 수납장`furniture` · 선실 목재 벽면`wall` · 선실 목조 장식 벽판`wall` | block-08-11 c13 r9 |
| 287 | 갑판 위 포탄 `floor` | 선박 기계 하단 지지대 `prop` | 조타륜 하단 받침대`prop` · 선박 기계 하단 지지대`prop` · 조타륜 하단`prop` | block-08-11 c17 r9 |
| 289 | 가는 대각 가로대 `ship` | 삼각 돛 좌측 상중단 `ship` | 대각선 선체 난간`wall` · 선체 경사 난간`prop` · 삼각 돛 좌측 상중단`prop` | block-08-11 c19 r9 |
| 290 | 짧은 나무 말뚝 `prop` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-08-11 c20 r9 |
| 293 | 남서 대각 판재 `ship` | 삼각 돛 우측 상중단 `ship` | 대각선 선체 난간`wall` · 선체 경사 난간`prop` · 삼각 돛 우측 상중단`prop` | block-08-11 c23 r9 |
| 296 | 굵은 우상 선체판 `ship` | 대각선 선체 외벽 `wall` | 대각선 선체 외벽`wall` · 선체 경사 외벽`wall` | block-08-11 c26 r9 |
| 297 | 북서 작은 판조각 `ship` | 대각선 선체 외벽 모서리 `wall` | 대각선 선체 외벽 모서리`wall` · 선체 경사 외벽`wall` | block-08-11 c27 r9 |
| 309 | 사각 나무벽돌 `floor` | 목재 바닥 가로목 `floor` | 목재 갑판 바닥`floor` · 목재 바닥 가로목`floor` | block-08-11 c9 r10 |
| 310 | 널찍한 나무판 `floor` | 목재 갑판 바닥 `floor` | 목재 갑판 바닥`floor` · 목재 바닥`floor` | block-08-11 c10 r10 |
| 312 | 둥근 윗면 나무벽 `wall` | 갑판 계단 상단 난간 `stairs` | 갑판 계단 상단 난간`stairs` · 선실 계단 입구 상단`stairs` · 갑판 계단 상단`stairs` | block-08-11 c12 r10 |
| 313 | 검은 창 선실벽 `window` | 갑판 사다리 계단 `stairs` | 갑판 사다리 계단`stairs` · 선실 계단`stairs` · 갑판 계단`stairs` | block-08-11 c13 r10 |
| 314 | 주황 모 깎인 벽 `wall` | 목재 갑판 바닥 `floor` | 목재 갑판 바닥`floor` · 갑판 바닥`floor` | block-08-11 c14 r10 |
| 315 | 왼쪽 굽은 선체 `ship` | 목조 선체 곡선 테두리 왼쪽 `wall` | 곡선 선체 난간 좌측`wall` · 선체 곡선 난간 좌측`prop` · 목조 선체 곡선 테두리 왼쪽`wall` | block-08-11 c15 r10 |
| 316 | 가운데 굽은 선체 `ship` | 목조 선체 곡선 테두리 중앙 `wall` | 곡선 선체 난간 중앙`wall` · 선체 곡선 난간 중앙`prop` · 목조 선체 곡선 테두리 중앙`wall` | block-08-11 c16 r10 |
| 317 | 검은 모 굽은 널 `ship` | 목조 선체 곡선 테두리 오른쪽 `wall` | 곡선 선체 난간 우측`wall` · 선체 곡선 난간 우측`prop` · 목조 선체 곡선 테두리 오른쪽`wall` | block-08-11 c17 r10 |
| 319 | 가는 사선 버팀대 `ship` | 삼각 돛 좌측 중단 바깥 `ship` | 대각선 선체 난간`wall` · 선체 경사 난간`prop` · 삼각 돛 좌측 중단 바깥`prop` | block-08-11 c19 r10 |
| 322 | 사선 가는 들보 `ship` | 삼각 돛 우측 중단 안쪽 `ship` | 대각선 목재 지지대`prop` · 선체 경사 난간`prop` · 삼각 돛 우측 중단 안쪽`prop` | block-08-11 c22 r10 |
| 323 | 대각 널빤지 조각 `ship` | 삼각 돛 우측 중단 바깥 `ship` | 대각선 선체 난간`wall` · 선체 경사 난간`prop` · 삼각 돛 우측 중단 바깥`prop` | block-08-11 c23 r10 |
| 327 | 회색 둥근 포탄 `prop` | 상향 대포 상단 포구 `prop` | 상향 대포 상단 포구`prop` · 상향 대포 포신`prop` · 상향 대포 포신`prop` | block-08-11 c27 r10 |
| 328 | 가로 나무 살창 `decoration` | 목재 사다리 상단 `stairs` | 밧줄 사다리`stairs` · 목재 사다리 상단`stairs` · 밧줄 사다리`stairs` | block-08-11 c28 r10 |
| 329 | 은밑 갈색 원통 `barrel` | 원형 목재 기둥 하단 `barrel` | 원형 목재 기둥 하단`prop` · 통나무 하단`prop` · 원형 목재 기둥 하단`prop` | block-08-11 c29 r10 |
| 342 | 창틀 난 선실벽 `window` | 선실 목조 골조벽 하단 왼쪽 `wall` | 목재 벽 기둥 좌측`wall` · 선실 목재 벽 하단`wall` · 선실 목조 골조벽 하단 왼쪽`wall` | block-08-11 c12 r11 |
| 343 | 문구멍 선실벽 `door` | 선실 목조 골조벽 하단 중앙 `wall` | 목재 벽 기둥 중앙`wall` · 선실 목재 벽 하단`wall` · 선실 목조 골조벽 하단 중앙`wall` | block-08-11 c13 r11 |
| 344 | 역브이 선실 천장 `roof` | 선실 목조 골조벽 하단 오른쪽 `wall` | 목재 벽 기둥 우측`wall` · 선실 목재 벽 하단`wall` · 선실 목조 골조벽 하단 오른쪽`wall` | block-08-11 c14 r11 |
| 345 | 검은 세로 문틀 `door` | 선실 목재 문 입구 `door` | 목재 벽 출입문`door` · 선실 목재 문 입구`door` · 선실 출입문`door` | block-08-11 c15 r11 |
| 346 | 문 안쪽 어둠 `door` | 선실 출입구 암부 `door` | 선실 입구 암부`door` · 갑판 해치 입구`door` · 선실 출입구 암부`door` | block-08-11 c16 r11 |
| 347 | 가로 널 선체판 `floor` | 목재 갑판 바닥 `floor` | 목재 갑판 바닥`floor` · 갑판 바닥`floor` | block-08-11 c17 r11 |
| 349 | 사선 나무 버팀 `ship` | 삼각 돛 좌측 하단 바깥 `ship` | 곡선 선체 외벽 좌측`wall` · 선체 곡선 난간`prop` · 삼각 돛 좌측 하단 바깥`prop` | block-08-11 c19 r11 |
| 351 | 회색 날 세로막대 `prop` | 돛대 기둥 하단 지지대 `prop` | 돛대 하단 받침대`prop` · 돛대 기둥 하단 지지대`prop` · 돛대 하단 받침대`prop` | block-08-11 c21 r11 |
| 357 | 포미 나무 포차 `machine` | 상향 대포 하단 몸체 `machine` | 상향 대포 하단 몸체`prop` · 상향 대포 포가`prop` · 상향 대포 포가`prop` | block-08-11 c27 r11 |
| 366 | 테두리 회색 석벽 `wall` | 석재 바닥 좌상단 테두리 `floor` | 석재 바닥 좌상단 테두리`floor` · 석조 벽 상단 좌측`wall` · 석조 바닥 상단 좌측`floor` | block-12-15 c6 r12 |
| 367 | 회색 석재 벽돌 `wall` | 석재 바닥 상단 테두리 `floor` | 석재 바닥 상단 테두리`floor` · 석조 벽 상단 중앙`wall` · 석조 바닥 상단`floor` | block-12-15 c7 r12 |
| 368 | 회색 석재 무늬벽 `wall` | 석재 바닥 상단 테두리 `floor` | 석재 바닥 상단 테두리`floor` · 석조 벽 상단 우측`wall` · 석조 바닥 상단 우측`floor` | block-12-15 c8 r12 |
| 369 | 나무 사각 창틀 `window` | 소형 목재 해치 `prop` | 작은 목재 해치`door` · 소형 목재 해치`prop` · 소형 목조 해치`prop` | block-12-15 c9 r12 |
| 370 | 창 너머 어둠 `window` | 어두운 공간 `empty` | 어두운 공간`empty` · 어두운 내부`empty` | block-12-15 c10 r12 |
| 371 | 십자 창살 창문 `window` | 목재 보 교차부 `prop` | 목재 보 교차부`prop` · 목재 보 교차점`prop` | block-12-15 c11 r12 |
| 372 | 세로 널빤지 벽 `wall` | 목재 벽 상단 좌측 `wall` | 목재 벽 상단 좌측`wall` · 목재 벽 좌측 하단`wall` | block-12-15 c12 r12 |
| 373 | 나무 벽널 가운데 `wall` | 목재 벽 상단 중앙 `wall` | 목재 벽 상단 중앙`wall` · 목재 벽 중앙 하단`wall` | block-12-15 c13 r12 |
| 375 | 나무벽 세로 이음 `wall` | 목재 벽 상단 좌측 `wall` | 목재 벽 상단 좌측`wall` · 목재 창살 벽 좌측`wall` | block-12-15 c15 r12 |
| 376 | 어두운 아궁이 `wall` | 목재 창살 창문 `window` | 아래로 내려가는 계단 상단`stairs` · 목재 창살 창문`window` · 목조 창살 창문`window` | block-12-15 c16 r12 |
| 377 | 나무벽 왼쪽 이음 `wall` | 목재 벽 상단 우측 `wall` | 목재 벽 상단 우측`wall` · 목재 창살 벽 우측`wall` | block-12-15 c17 r12 |
| 378 | 밝은 세로 나무결 `wall` | 배 외벽 좌현 상단 `wall` | 선체 좌현 상단`prop` · 배 외벽 좌현 상단`wall` · 선체 좌측 외벽`wall` | block-12-15 c18 r12 |
| 380 | 왼쪽 사선 나무판 `decoration` | 배 선수 목재 외벽 좌측 `wall` | 선수 목재 보 좌측`prop` · 배 선수 목재 외벽 좌측`wall` · 뱃머리 좌측 경사벽`wall` | block-12-15 c20 r12 |
| 381 | 오른쪽 사선 나무판 `decoration` | 배 선수 목재 외벽 우측 `wall` | 선수 목재 보 우측`prop` · 배 선수 목재 외벽 우측`wall` · 뱃머리 우측 경사벽`wall` | block-12-15 c21 r12 |
| 383 | 세로 나무판 기둥 `pillar` | 배 외벽 우현 상단 `pillar` | 선체 우현 상단`prop` · 배 외벽 우현 상단`wall` · 선체 우측 외벽`wall` | block-12-15 c23 r12 |
| 385 | 둥근 나무 술통 `barrel` | 대형 오크통 `barrel` | 목재 통`prop` · 대형 오크통`prop` | block-12-15 c25 r12 |
| 386 | 흰 도자기 항아리 `decoration` | 도자기 항아리 `prop` | 도자기 항아리`prop` · 도자기 항아리`prop` | block-12-15 c26 r12 |
| 390 | 흙 북서 모래사면 `terrain` | 흙 지형 좌상단 모서리 `terrain` | 흙 지형 좌상단 모서리`terrain` · 흙 바닥 좌상단`terrain` | block-12-15 c0 r13 |
| 391 | 흙 북쪽 모래경계 `terrain` | 흙 지형 상단 `terrain` | 흙 지형 상단`terrain` · 흙 바닥 상단`terrain` | block-12-15 c1 r13 |
| 392 | 흙 북동 모래사면 `terrain` | 흙 지형 우상단 모서리 `terrain` | 흙 지형 우상단 모서리`terrain` · 흙 바닥 우상단`terrain` | block-12-15 c2 r13 |
| 396 | 석벽 왼쪽 상단테 `wall` | 석재 바닥 좌상단 테두리 `floor` | 석재 바닥 좌상단 테두리`floor` · 석조 바닥 좌상단`floor` | block-12-15 c6 r13 |
| 397 | 석벽 상단 그림자 `wall` | 석재 바닥 상단 테두리 `floor` | 석재 바닥 상단 테두리`floor` · 석조 바닥 상단`floor` | block-12-15 c7 r13 |
| 398 | 석벽 오른쪽 상단테 `wall` | 석재 바닥 상단 테두리 `floor` | 석재 바닥 상단 테두리`floor` · 석조 바닥 우상단`floor` | block-12-15 c8 r13 |
| 399 | 창틀 좌상단 모서리 `window` | 대형 목조 해치 상단 좌측 `prop` | 대형 목재 입구 좌상단`door` · 대형 목재 해치 좌상단`prop` · 대형 목조 해치 상단 좌측`prop` | block-12-15 c9 r13 |
| 400 | 창틀 상단 가로대 `window` | 대형 목조 해치 상단 중앙 `prop` | 대형 목재 입구 상단`door` · 대형 목재 해치 상단`prop` · 대형 목조 해치 상단 중앙`prop` | block-12-15 c10 r13 |
| 401 | 창틀 우상단 모서리 `window` | 대형 목조 해치 상단 우측 `prop` | 대형 목재 입구 우상단`door` · 대형 목재 해치 우상단`prop` · 대형 목조 해치 상단 우측`prop` | block-12-15 c11 r13 |
| 405 | 나무 겹벽 이음 `wall` | 목재 기둥 벽 `wall` | 목재 기둥 벽`wall` · 목재 벽 기둥`wall` | block-12-15 c15 r13 |
| 408 | 사선 들보 나무판 `decoration` | 배 외벽 좌현 중상단 `wall` | 선체 좌현 외벽 상단`prop` · 배 외벽 좌현 중상단`wall` · 선체 좌측 외벽`wall` | block-12-15 c18 r13 |
| 409 | 굵은 사선 각재 `decoration` | 배 선수 목재 외벽 중좌측 `wall` | 선체 내부 대각선 빔 좌측`prop` · 배 선수 목재 외벽 중좌측`wall` · 뱃머리 좌측 경사벽`wall` | block-12-15 c19 r13 |
| 410 | 얇은 오른쪽 사선 `decoration` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c20 r13 |
| 411 | 얇은 왼쪽 사선 `decoration` | 배 선수 목재 외벽 중우측 `wall` | 빈 슬롯`empty` · 배 선수 목재 외벽 중우측`wall` · 뱃머리 중앙 우측 경사벽`wall` | block-12-15 c21 r13 |
| 412 | 반대 굵은 사선각 `decoration` | 배 외벽 우측 대각선부 `wall` | 선체 내부 대각선 빔 우측`prop` · 배 외벽 우측 대각선부`wall` · 뱃머리 우측 경사벽`wall` | block-12-15 c22 r13 |
| 413 | 사선 들보 오른판 `decoration` | 배 외벽 우현 중상단 `wall` | 선체 우현 외벽 상단`prop` · 배 외벽 우현 중상단`wall` · 선체 우측 외벽`wall` | block-12-15 c23 r13 |
| 417 | 작은 둥근 나무덩이 `prop` | 둥근 목재 의자 `furniture` | 둥근 목재 의자`furniture` · 원형 목재 의자`furniture` | block-12-15 c27 r13 |
| 418 | 가는 세로 나무기둥 `pillar` | 세로 목재 난간 상단 `fence` | 세로 목재 난간 상단`fence` · 목재 기둥`fence` | block-12-15 c28 r13 |
| 419 | 세로 나무 장대 `pillar` | 세로 목재 난간 상단 `fence` | 세로 목재 난간 상단`fence` · 목재 기둥`fence` | block-12-15 c29 r13 |
| 420 | 흙 서쪽 모래경계 `terrain` | 흙 지형 좌측 `terrain` | 흙 지형 좌측`terrain` · 흙 바닥 좌측`terrain` | block-12-15 c0 r14 |
| 422 | 흙 동쪽 모래경계 `terrain` | 흙 지형 우측 `terrain` | 흙 지형 우측`terrain` · 흙 바닥 우측`terrain` | block-12-15 c2 r14 |
| 426 | 석벽 왼쪽 가장자리 `wall` | 석재 바닥 좌측 테두리 `floor` | 석재 바닥 좌측 테두리`floor` · 석조 바닥 좌측`floor` | block-12-15 c6 r14 |
| 427 | 회색 석재 벽돌 `wall` | 석조 바닥 중앙 `floor` | 석재 바닥`floor` · 석조 바닥 중앙`floor` | block-12-15 c7 r14 |
| 428 | 석벽 오른쪽 가장자리 `wall` | 석재 바닥 우측 테두리 `floor` | 석재 바닥 우측 테두리`floor` · 석조 바닥 우측`floor` | block-12-15 c8 r14 |
| 429 | 창틀 왼쪽 세로대 `window` | 대형 목재 해치 좌측 `prop` | 대형 목재 입구 좌측`door` · 대형 목재 해치 좌측`prop` · 대형 목조 해치 좌측`prop` | block-12-15 c9 r14 |
| 431 | 창틀 오른쪽 세로대 `window` | 대형 목재 해치 우측 `prop` | 대형 목재 입구 우측`door` · 대형 목재 해치 우측`prop` · 대형 목조 해치 우측`prop` | block-12-15 c11 r14 |
| 432 | 나무 선반장 왼쪽 `shelf` | 목재 벽난로 상단 좌측 `prop` | 목재 벽난로 상단 좌측`prop` · 목재 카운터 상단 좌측`furniture` · 목조 벽 상단 좌측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 433 | 나무 선반장 가운데 `shelf` | 목재 벽난로 상단 중앙 `prop` | 목재 벽난로 상단 중앙`prop` · 목재 카운터 상단 중앙`furniture` · 목조 벽 상단 중앙`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 434 | 나무 선반장 오른쪽 `shelf` | 목재 벽난로 상단 우측 `prop` | 목재 벽난로 상단 우측`prop` · 목재 카운터 상단 우측`furniture` · 목조 벽 상단 우측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 435 | 고른 세로 나무널 `wall` | 목재 기둥 벽 `wall` | 목재 기둥 벽`wall` · 목재 벽 기둥`wall` | block-12-15 c15 r14 |
| 436 | 사선 무늬 나무벽 `wall` | 대각선 목재 난간 좌측 `prop` | 대각선 목재 빔 좌측`prop` · 대각선 목재 난간 좌측`prop` | block-12-15 c16 r14 |
| 437 | 반대 사선 나무벽 `wall` | 대각선 목재 난간 우측 `prop` | 대각선 목재 빔 우측`prop` · 대각선 목재 난간 우측`prop` | block-12-15 c17 r14 |
| 438 | 쌍줄 사선 각재 `decoration` | 선체 좌측 외벽 하단 `wall` | 선체 좌현 외벽 중앙`prop` · 배 외벽 좌현 중단`wall` · 선체 좌측 외벽 하단`wall` | block-12-15 c18 r14 |
| 439 | 우상단 작은 각 `decoration` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c19 r14 |
| 440 | 오목한 나무 곡면 `ship` | 배 선수 목재 외벽 하좌측 `wall` | 선수 대각선 외벽 좌측`prop` · 배 선수 목재 외벽 하좌측`wall` · 뱃머리 좌측 경사벽 하단`wall` | block-12-15 c20 r14 |
| 441 | 반대 나무 곡면 `ship` | 배 선수 목재 외벽 하우측 `wall` | 선수 대각선 외벽 우측`prop` · 배 선수 목재 외벽 하우측`wall` · 뱃머리 우측 경사벽 하단`wall` | block-12-15 c21 r14 |
| 442 | 좌상단 작은 각 `decoration` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c22 r14 |
| 443 | 반대 쌍줄 사선 `decoration` | 선체 우측 외벽 하단 `wall` | 선체 우현 외벽 중앙`prop` · 배 외벽 우현 중단`wall` · 선체 우측 외벽 하단`wall` | block-12-15 c23 r14 |
| 444 | 오른쪽 나무 계단 `stairs` | 파이프오르간 상단 좌측 `furniture` | 파이프오르간 상단 좌측`furniture` · 파이프오르간 상단 좌측`furniture` | block-12-15 c24 r14 |
| 445 | 왼쪽 나무 계단 `stairs` | 파이프오르간 상단 우측 `furniture` | 파이프오르간 상단 우측`furniture` · 파이프오르간 상단 우측`furniture` | block-12-15 c25 r14 |
| 447 | 가로 나무 들보 `decoration` | 가로 목재 난간 좌측 `fence` | 가로 목재 난간 좌측`fence` · 가로 목재 난간`fence` | block-12-15 c27 r14 |
| 448 | 십자 나무 들보 `decoration` | 십자 목재 난간 교차점 `fence` | 십자 목재 난간 교차점`fence` · 목재 난간 십자 교차점`fence` | block-12-15 c28 r14 |
| 449 | 가로 나무 장선 `decoration` | 가로 목재 난간 우측 `fence` | 가로 목재 난간 우측`fence` · 가로 목재 난간`fence` | block-12-15 c29 r14 |
| 451 | 흙 남쪽 모래경계 `terrain` | 흙 지형 하단 `terrain` | 흙 지형 하단`terrain` · 흙 바닥 하단`terrain` | block-12-15 c1 r15 |
| 456 | 석벽 좌측 하단면 `wall` | 석재 바닥 좌측 테두리 `floor` | 석재 바닥 좌측 테두리`floor` · 석조 바닥 좌하단`floor` | block-12-15 c6 r15 |
| 457 | 회색 석재 벽돌 `wall` | 석조 바닥 하단 `floor` | 석재 바닥`floor` · 석조 바닥 하단`floor` | block-12-15 c7 r15 |
| 458 | 석벽 우측 하단면 `wall` | 석재 바닥 우측 테두리 `floor` | 석재 바닥 우측 테두리`floor` · 석조 바닥 우하단`floor` | block-12-15 c8 r15 |
| 459 | 창틀 좌하단 모서리 `window` | 대형 목조 해치 하단 좌측 `prop` | 대형 목재 입구 좌하단`door` · 대형 목재 해치 좌하단`prop` · 대형 목조 해치 하단 좌측`prop` | block-12-15 c9 r15 |
| 460 | 창틀 하단 가로대 `window` | 대형 목조 해치 하단 중앙 `prop` | 대형 목재 입구 하단`door` · 대형 목재 해치 하단`prop` · 대형 목조 해치 하단 중앙`prop` | block-12-15 c10 r15 |
| 461 | 창틀 우하단 모서리 `window` | 대형 목조 해치 하단 우측 `prop` | 대형 목재 입구 우하단`door` · 대형 목재 해치 우하단`prop` · 대형 목조 해치 하단 우측`prop` | block-12-15 c11 r15 |
| 462 | 왼쪽홈 가로 마루 `floor` | 목재 벽난로 하단 좌측 `prop` | 목재 벽난로 하단 좌측`prop` · 목재 카운터 하단 좌측`furniture` · 목조 벽 하단 좌측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 463 | 어두운 빈 벽장 `furniture` | 목재 벽난로 화로 `prop` | 목재 벽난로 화로`prop` · 목재 화덕`prop` | block-12-15 c13 r15 |
| 464 | 오른쪽홈 가로 마루 `floor` | 목재 벽난로 하단 우측 `prop` | 목재 벽난로 하단 우측`prop` · 목재 카운터 하단 우측`furniture` · 목조 벽 하단 우측`wall` | **사람 확정** (adj-ship-r0-3-c17-26.png, adj-ship-r0-3-c6-16.png, adj-ship-r12-15-c10-14.png, cabin-window-192.png, deck-pump-132.png, fin-ship-r13-15-c8-13.png, fin-ship-r8-10-c22-26.png, hull-plank-wall-134-136.png, rail-pieces-177-207-238-239.png, split2-ship-r0003-c0616.png, split2-ship-r0003-c1726.png, stone-brick-168-171.png, timber-frame-139-141.png) |
| 465 | 세로널 오른쪽 홈 `wall` | 목재 기둥 벽 `wall` | 목재 기둥 벽`wall` · 목재 벽 기둥`wall` | block-12-15 c15 r15 |
| 468 | 우측 사선 얇은판 `decoration` | 선체 좌측 외벽 끝단 `wall` | 선체 좌현 외벽 하단`prop` · 배 외벽 좌현 하단`wall` · 선체 좌측 외벽 끝단`wall` | block-12-15 c18 r15 |
| 469 | 우상 사선 조각 `decoration` | 선수 전면 목재 빔 좌측 `prop` | 선수 전면 목재 빔 좌측`prop` · 배 선수 목재 보 좌측`prop` | block-12-15 c19 r15 |
| 470 | 나무 탁자 옆면 `furniture` | 배 선수 목재 십자 보 중앙 `prop` | 선수 전면 목재 기둥 좌측`prop` · 배 선수 목재 십자 보 중앙`prop` | block-12-15 c20 r15 |
| 471 | 좌상 사선 조각 `decoration` | 선수 전면 목재 기둥 우측 `prop` | 선수 전면 목재 기둥 우측`prop` · 배 선수 목재 보 우측`prop` | block-12-15 c21 r15 |
| 472 | 세로 나무 다리 `furniture` | 목재 선수 돌출 기둥 하단 `prop` | 선수 돌출부 끝 기둥`prop` · 목재 선수 돌출 기둥 하단`prop` | block-12-15 c22 r15 |
| 473 | 좌측 사선 얇은판 `decoration` | 선체 우측 외벽 끝단 `wall` | 선체 우현 외벽 하단`prop` · 배 외벽 우현 하단`wall` · 선체 우측 외벽 끝단`wall` | block-12-15 c23 r15 |
| 478 | 세로 가는 기둥끝 `pillar` | 세로 목재 난간 하단 `fence` | 세로 목재 난간 하단`fence` · 목재 기둥 하단`fence` | block-12-15 c28 r15 |
| 479 | 가로 나무 막대 `decoration` | 가로 목재 난간 조각 `fence` | 가로 목재 난간 조각`fence` · 가로 목재 난간`fence` | block-12-15 c29 r15 |

## world — 교정 397칸

| idx | 이전 | 채택 | 판독 | 근거 위치 |
|---|---|---|---|---|
| 8 | 초원 속 갈색 밭 `terrain` | 풀밭 모서리 흙바닥 `terrain` | 잔디 위 흙길`terrain` · 풀밭 모서리 흙바닥`terrain` | block-00-03 c8 r0 |
| 12 | 갈색 바위 산악 지대 `mountain` | 보라색 돌 바닥 `floor` | 보라색 돌 바닥`floor` · 분홍빛 돌바닥`floor` | block-00-03 c12 r0 |
| 13 | 풀섞인 바위 고지대 `mountain` | 녹회색 석재 바닥 `floor` | 청록색 돌 바닥`floor` · 녹회색 석재 바닥`floor` | block-00-03 c13 r0 |
| 14 | 늪지 습지 어두운 물 `terrain` | 보라색 벽돌 벽 상단 좌측 `wall` | 보라색 벽돌 벽 상단 좌측`wall` · 보라색 벽돌 벽 상단 좌측`wall` | block-00-03 c14 r0 |
| 15 | 늪지 진흙 물웅덩이 `terrain` | 보라색 벽돌 벽 상단 중앙 1 `wall` | 보라색 벽돌 벽 상단 중앙 1`wall` · 보라색 벽돌 벽 상단 중앙 1`wall` | block-00-03 c15 r0 |
| 16 | 늪지 습지 검은 물 `terrain` | 보라색 벽돌 벽 상단 중앙 2 `wall` | 보라색 벽돌 벽 상단 중앙 2`wall` · 보라색 벽돌 벽 상단 중앙 2`wall` | block-00-03 c16 r0 |
| 17 | 늪지 습지 물길 `terrain` | 보라색 벽돌 벽 상단 우측 `wall` | 보라색 벽돌 벽 상단 우측`wall` · 보라색 벽돌 벽 상단 우측`wall` | block-00-03 c17 r0 |
| 18 | 어두운 갈색 흙바닥 `terrain` | 잔디 절벽 오목 모서리 좌측 `cliff` | 잔디 절벽 오목 모서리 좌측`cliff` · 풀밭 절벽 경사면 상단 좌측`cliff` | block-00-03 c18 r0 |
| 19 | 초원 어두운 흙 경계 `terrain` | 잔디 절벽 오목 모서리 우측 `cliff` | 잔디 절벽 오목 모서리 우측`cliff` · 풀밭 절벽 경사면 상단 우측`cliff` | block-00-03 c19 r0 |
| 20 | 갈색 흙 평원 바닥 `terrain` | 흙 절벽 오목 모서리 좌측 `cliff` | 흙 절벽 오목 모서리 좌측`cliff` · 흙 절벽 경사면 상단 좌측`cliff` | block-00-03 c20 r0 |
| 21 | 갈색 밭 흙 평지 `terrain` | 흙 절벽 오목 모서리 우측 `cliff` | 흙 절벽 오목 모서리 우측`cliff` · 흙 절벽 경사면 상단 우측`cliff` | block-00-03 c21 r0 |
| 22 | 흙 땅 바다 물가 `coast` | 눈 절벽 오목 모서리 좌측 `cliff` | 눈 절벽 오목 모서리 좌측`cliff` · 눈 절벽 경사면 상단 좌측`cliff` | block-00-03 c22 r0 |
| 23 | 바다 물가 흙 해안 `coast` | 눈 절벽 오목 모서리 우측 `cliff` | 눈 절벽 오목 모서리 우측`cliff` · 눈 절벽 경사면 상단 우측`cliff` | block-00-03 c23 r0 |
| 24 | 초원 언덕 경사면 `terrain` | 초록 산봉우리 좌측 `cliff` | 초록 산봉우리 좌측`cliff` · 녹색 산봉우리 좌측`cliff` | block-00-03 c24 r0 |
| 25 | 언덕 초원 경사면 `terrain` | 초록 산봉우리 우측 `cliff` | 초록 산봉우리 우측`cliff` · 녹색 산봉우리 우측`cliff` | block-00-03 c25 r0 |
| 26 | 갈색 흙 언덕 경사 `terrain` | 바위산 봉우리 좌측 `cliff` | 바위산 봉우리 좌측`cliff` · 갈색 산봉우리 좌측`cliff` | block-00-03 c26 r0 |
| 27 | 흙 언덕 경사 지면 `terrain` | 바위산 봉우리 우측 `cliff` | 바위산 봉우리 우측`cliff` · 갈색 산봉우리 우측`cliff` | block-00-03 c27 r0 |
| 28 | 초원 바다 물가 해안 `coast` | 눈 덮인 설산 좌측 `cliff` | 설산 봉우리 좌측`cliff` · 눈 덮인 설산 좌측`cliff` | block-00-03 c28 r0 |
| 29 | 바다 물가 초원 해안 `coast` | 눈 덮인 설산 우측 `cliff` | 설산 봉우리 우측`cliff` · 눈 덮인 설산 우측`cliff` | block-00-03 c29 r0 |
| 34 | 백사장 얕은 바다 `coast` | 눈밭 속 세로 물길 2 `coast` | 눈 해안 세로 강 2`water` · 눈밭 속 세로 물길 2`water` | block-00-03 c4 r1 |
| 37 | 초원 흙 경사면 `terrain` | 풀밭과 흙길 경계 상단 `terrain` | 잔디 경계 흙길 상단`terrain` · 풀밭과 흙길 경계 상단`terrain` | block-00-03 c7 r1 |
| 42 | 갈색 바위 산악 암석 `mountain` | 회색 돌 바닥 `floor` | 회색 돌 바닥`floor` · 청회색 돌바닥`floor` | block-00-03 c12 r1 |
| 43 | 풀 낀 바위 산악지대 `mountain` | 짙은 회색 돌 바닥 `floor` | 짙은 회색 돌 바닥`floor` · 어두운 석재 바닥`floor` | block-00-03 c13 r1 |
| 44 | 늪지 습지 어두운 물가 `terrain` | 보라색 벽돌 벽 하단 좌측 `wall` | 보라색 벽돌 벽 하단 좌측`wall` · 보라색 벽돌 벽 하단 좌측`wall` | block-00-03 c14 r1 |
| 45 | 늪지 진흙 습지 물 `terrain` | 보라색 벽돌 벽 하단 중앙 1 `wall` | 보라색 벽돌 벽 하단 중앙 1`wall` · 보라색 벽돌 벽 하단 중앙 1`wall` | block-00-03 c15 r1 |
| 46 | 늪지 습지 검은 물가 `terrain` | 보라색 벽돌 벽 하단 중앙 2 `wall` | 보라색 벽돌 벽 하단 중앙 2`wall` · 보라색 벽돌 벽 하단 중앙 2`wall` | block-00-03 c16 r1 |
| 47 | 늪지 습지 웅덩이 `terrain` | 보라색 벽돌 벽 하단 우측 `wall` | 보라색 벽돌 벽 하단 우측`wall` · 보라색 벽돌 벽 하단 우측`wall` | block-00-03 c17 r1 |
| 48 | 초원 언덕 경사 오른쪽 `terrain` | 잔디 절벽 볼록 모서리 좌측 `cliff` | 잔디 절벽 볼록 모서리 좌측`cliff` · 풀밭 절벽 경사면 하단 좌측`cliff` | block-00-03 c18 r1 |
| 49 | 언덕 초원 경사 언덕 `terrain` | 잔디 절벽 볼록 모서리 우측 `cliff` | 잔디 절벽 볼록 모서리 우측`cliff` · 풀밭 절벽 경사면 하단 우측`cliff` | block-00-03 c19 r1 |
| 50 | 갈색 흙 언덕 오른쪽 `terrain` | 흙 절벽 볼록 모서리 좌측 `cliff` | 흙 절벽 볼록 모서리 좌측`cliff` · 흙 절벽 경사면 하단 좌측`cliff` | block-00-03 c20 r1 |
| 51 | 흙 언덕 경사 바닥 `terrain` | 흙 절벽 볼록 모서리 우측 `cliff` | 흙 절벽 볼록 모서리 우측`cliff` · 흙 절벽 경사면 하단 우측`cliff` | block-00-03 c21 r1 |
| 52 | 초원 바다 물가 오른쪽 `coast` | 눈 절벽 볼록 모서리 좌측 `cliff` | 눈 절벽 볼록 모서리 좌측`cliff` · 눈 절벽 경사면 하단 좌측`cliff` | block-00-03 c22 r1 |
| 53 | 바다 물가 초원 언덕 `coast` | 눈 절벽 볼록 모서리 우측 `cliff` | 눈 절벽 볼록 모서리 우측`cliff` · 눈 절벽 경사면 하단 우측`cliff` | block-00-03 c23 r1 |
| 54 | 마을 가옥 지붕 무리 `town-icon` | 목재 울타리 상단 좌측 `fence` | 목재 울타리 좌상단`fence` · 목재 울타리 상단 좌측`fence` | block-00-03 c24 r1 |
| 55 | 마을 초가집 이중 지붕 `town-icon` | 목재 울타리 상단 가로 `fence` | 목재 울타리 상단 가로`fence` · 목재 울타리 가로 상단`fence` | block-00-03 c25 r1 |
| 56 | 마을 단독 가옥 지붕 `town-icon` | 목재 울타리 상단 우측 `fence` | 목재 울타리 우상단`fence` · 목재 울타리 상단 우측`fence` | block-00-03 c26 r1 |
| 58 | 심해 소용돌이 물결 `water` | 파란 수정 `prop` | 파란 수정`prop` · 푸른 수정`prop` | block-00-03 c28 r1 |
| 68 | 흙 초원 경사 구릉 `terrain` | 풀밭과 흙길 경계 우측 `terrain` | 잔디 경계 흙길 우측`terrain` · 풀밭과 흙길 경계 우측`terrain` | block-00-03 c8 r2 |
| 72 | 갈색 흙 두둑 평지 `terrain` | 가로 목재 바닥 `floor` | 가로 목재 바닥`floor` · 가로 목재 마루`floor` | block-00-03 c12 r2 |
| 73 | 갈색 밭 이랑 지면 `terrain` | 구멍 난 가로 목재 바닥 `floor` | 구멍 난 가로 목재 바닥`floor` · 구멍 난 목재 마루`floor` | block-00-03 c13 r2 |
| 74 | 모래 해변 얕은 물가 `sand` | 목조 회벽 상단 좌측 `wall` | 목조 회벽 상단 좌측`wall` · 목조 회벽 상단 좌측`wall` | block-00-03 c14 r2 |
| 75 | 모래 해변 물굽이 `sand` | 목조 회벽 상단 중앙 `wall` | 목조 회벽 상단 중앙`wall` · 목조 회벽 상단 중앙`wall` | block-00-03 c15 r2 |
| 76 | 모래 해변 어귀 물가 `sand` | 목조 회벽 상단 우측 `wall` | 목조 회벽 상단 우측`wall` · 목조 회벽 상단 우측`wall` | block-00-03 c16 r2 |
| 77 | 모래 해변 바다 어귀 `sand` | 목조 회벽 상단 좁은 기둥 `wall` | 목조 회벽 상단 좁은 기둥`wall` · 목조 회벽 상단 기둥`wall` | block-00-03 c17 r2 |
| 78 | 초원 잔디 평원 바닥 `terrain` | 잔디 고원 좌상단 모서리 `cliff` | 잔디 고원 좌상단 모서리`cliff` · 풀밭 타일 상단 좌측 경계`terrain` · 잔디 벽 좌상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 79 | 초원 평야 푸른 잔디 `terrain` | 잔디 `terrain` | 잔디 고원 상단 경계`cliff` · 풀밭 타일 상단 경계`terrain` · 잔디 벽 상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 80 | 초원 언덕 경사 언덕 `terrain` | 잔디 고원 우상단 모서리 `cliff` | 잔디 고원 우상단 모서리`cliff` · 풀밭 타일 상단 우측 경계`terrain` · 잔디 벽 우상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 81 | 어두운 갈색 흙 평지 `terrain` | 흙 고원 좌상단 모서리 `cliff` | 흙 고원 좌상단 모서리`cliff` · 흙길 타일 상단 좌측 경계`terrain` · 흙벽 좌상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 82 | 갈색 흙 평원 지면 `terrain` | 흙 `terrain` | 흙 고원 상단 경계`cliff` · 흙길 타일 상단 경계`terrain` · 흙벽 상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 83 | 갈색 밭 흙 이랑 `terrain` | 흙 고원 우상단 모서리 `cliff` | 흙 고원 우상단 모서리`cliff` · 흙길 타일 상단 우측 경계`terrain` · 흙벽 우상단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 84 | 마을 탑 건물 랜드마크 `town-icon` | 목재 울타리 좌측 세로 기둥 `fence` | 목재 울타리 좌측 세로 기둥`fence` · 목재 울타리 세로 좌측`fence` | block-00-03 c24 r2 |
| 85 | 마을 가옥 지붕 두 채 `town-icon` | 목재 울타리 중앙 연결부 `fence` | 목재 울타리 가로 구간`fence` · 목재 울타리 중앙 연결부`fence` | block-00-03 c25 r2 |
| 86 | 마을 탑 단독 랜드마크 `town-icon` | 목재 울타리 연결부 기둥 `fence` | 목재 울타리 연결부 기둥`fence` · 목재 울타리 세로 우측`fence` | block-00-03 c26 r2 |
| 87 | 동굴 바위산 봉우리 `mountain` | 돌 우물 `prop` | 돌 우물`prop` · 돌 우물`prop` | block-00-03 c27 r2 |
| 88 | 거무튀튀한 암석 구조물 `rock` | 십자가 묘비 `prop` | 십자가 묘비`prop` · 십자가 묘비`prop` | block-00-03 c28 r2 |
| 89 | 바위산 말단 봉우리 `mountain` | 둥근 비석 상단 `prop` | 둥근 비석 상단`prop` · 석조 묘비 상단`prop` | block-00-03 c29 r2 |
| 97 | 갈색 흙 평지 지면 `terrain` | 풀밭과 흙길 경계 하단 `terrain` | 잔디 경계 흙길 하단`terrain` · 풀밭과 흙길 경계 하단`terrain` | block-00-03 c7 r3 |
| 102 | 갈색 밭 이랑 지면 `terrain` | 세로 목재 바닥 1 `floor` | 세로 목재 바닥 1`floor` · 세로 목재 마루 1`floor` | block-00-03 c12 r3 |
| 103 | 갈색 밭두둑 지면 `terrain` | 세로 목재 바닥 2 `floor` | 세로 목재 바닥 2`floor` · 세로 목재 마루 2`floor` | block-00-03 c13 r3 |
| 104 | 모래 해변 물가 백사 `sand` | 목조 회벽 하단 좌측 `wall` | 목조 회벽 하단 좌측`wall` · 목조 회벽 하단 좌측`wall` | block-00-03 c14 r3 |
| 105 | 모래 해변 모래 평지 `sand` | 목조 회벽 하단 중앙 `wall` | 목조 회벽 하단 중앙`wall` · 목조 회벽 하단 중앙`wall` | block-00-03 c15 r3 |
| 106 | 모래 해변 어귀 바다 `sand` | 목조 회벽 하단 우측 `wall` | 목조 회벽 하단 우측`wall` · 목조 회벽 하단 우측`wall` | block-00-03 c16 r3 |
| 107 | 모래 해변 바다 물가 `sand` | 목조 회벽 하단 좁은 기둥 `wall` | 목조 회벽 하단 좁은 기둥`wall` · 목조 회벽 하단 기둥`wall` | block-00-03 c17 r3 |
| 108 | 초원 잔디 평원 바닥 `terrain` | 잔디 고원 좌측 테두리 `cliff` | 잔디 고원 좌측 경계`cliff` · 풀밭 타일 하단 좌측 경계`terrain` · 잔디 벽 좌측`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 110 | 초원 언덕 경사 지면 `terrain` | 잔디 고원 우측 테두리 `cliff` | 잔디 고원 우측 경계`cliff` · 풀밭 타일 하단 우측 경계`terrain` · 잔디 벽 우측`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 111 | 갈색 흙 다진 평지 `terrain` | 흙 고원 좌측 테두리 `cliff` | 흙 고원 좌측 경계`cliff` · 흙길 타일 하단 좌측 경계`terrain` · 흙벽 좌측`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 112 | 갈색 흙 평원 바닥 `terrain` | 흙길 타일 하단 경계 `terrain` | 흙 고원 중앙`terrain` · 흙길 타일 하단 경계`terrain` | block-00-03 c22 r3 |
| 113 | 갈색 흙 언덕 경계 `terrain` | 흙 고원 우측 테두리 `cliff` | 흙 고원 우측 경계`cliff` · 흙길 타일 하단 우측 경계`terrain` · 흙벽 우측`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 114 | 마을 가옥 지붕 랜드마크 `town-icon` | 목재 울타리 하단 좌측 `fence` | 목재 울타리 좌하단`fence` · 목재 울타리 하단 좌측`fence` | block-00-03 c24 r3 |
| 115 | 마을 성곽 가옥 지붕 `town-icon` | 목재 울타리 하단 가로 `fence` | 목재 울타리 하단 가로`fence` · 목재 울타리 가로 하단`fence` | block-00-03 c25 r3 |
| 116 | 성채 성곽 랜드마크 `town-icon` | 목재 표지판 `town-icon` | 목재 표지판`prop` · 나무 표지판`prop` | block-00-03 c26 r3 |
| 117 | 흩어진 바위 초목 무리 `prop` | 떨어진 낙엽 `decoration` | 떨어진 낙엽`decoration` · 낙엽`decoration` | block-00-03 c27 r3 |
| 118 | 바위 작은 섬 랜드마크 `rock` | 해골과 뼈 `decoration` | 해골과 뼈`decoration` · 해골과 뼈`decoration` | block-00-03 c28 r3 |
| 119 | 바위 암석 덩어리 땅 `rock` | 둥근 비석 하단 `prop` | 둥근 비석 하단`prop` · 석조 묘비 하단`prop` | block-00-03 c29 r3 |
| 123 | 물거품 이는 바다 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 급류 상단`water` | block-04-07 c3 r4 |
| 124 | 하얀 포말 해면 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 급류 상단`water` | block-04-07 c4 r4 |
| 125 | 부서지는 파도 `water` | 마법 샘 `water` | 마법 샘`water` · 얼음 바닥`floor` · 소용돌이`water` | block-04-07 c5 r4 |
| 126 | 진주빛 심해 물결 `water` | 독 늪 내부 `terrain` | 독 늪`terrain` · 보라색 독늪 바닥`water` · 독 늪 내부`terrain` | block-04-07 c6 r4 |
| 127 | 초록 삼림 캐노피 `forest` | 푸른 잔디 `forest` | 잔디`terrain` · 푸른 잔디`terrain` | block-04-07 c7 r4 |
| 128 | 물가 초원 해안 `coast` | 독 늪 웅덩이 `terrain` | 독 늪`terrain` · 보라색 독늪 가장자리`water` · 독 늪 웅덩이`terrain` | block-04-07 c8 r4 |
| 129 | 하얀 물보라 물가 `coast` | 설원 바닥 `terrain` | 눈밭`terrain` · 설원 바닥`terrain` | block-04-07 c9 r4 |
| 130 | 평원 초지 `terrain` | 푸른 잔디 `terrain` | 잔디`terrain` · 푸른 잔디`terrain` | block-04-07 c10 r4 |
| 131 | 초원 물가 경계 `coast` | 설원 바닥 가장자리 `terrain` | 눈밭`terrain` · 설원 바닥 가장자리`terrain` | block-04-07 c11 r4 |
| 132 | 잿빛 암반 지대 `rock` | 자갈길 바닥 `floor` | 자갈길 바닥`floor` · 자갈길 바닥`floor` | block-04-07 c12 r4 |
| 133 | 이끼 낀 바위 지대 `rock` | 이끼 낀 벽돌 바닥 `floor` | 이끼 낀 벽돌 바닥`floor` · 이끼 낀 벽돌 바닥`floor` | block-04-07 c13 r4 |
| 134 | 황사 바위 언덕 `rock` | 밝은 석조 벽 상단 좌측 `wall` | 밝은 벽돌 벽 상단`wall` · 밝은 석조 벽 상단 좌측`wall` | block-04-07 c14 r4 |
| 135 | 자갈 모래 언덕 `sand` | 밝은 석조 벽 상단 중앙 `wall` | 밝은 벽돌 벽 상단`wall` · 밝은 석조 벽 상단 중앙`wall` | block-04-07 c15 r4 |
| 136 | 황토 바위 사막 `sand` | 밝은 석조 벽 상단 중앙 `wall` | 밝은 벽돌 벽 상단`wall` · 밝은 석조 벽 상단 중앙`wall` | block-04-07 c16 r4 |
| 137 | 모래 바위 지대 `sand` | 밝은 벽돌 벽 상단 우측 기둥 `wall` | 밝은 벽돌 벽 상단 우측 기둥`wall` · 밝은 석조 벽 상단 우측`wall` | block-04-07 c17 r4 |
| 138 | 흙길 난 초원 `path` | 잔디 절벽 상단 좌측 `cliff` | 잔디 절벽 상단 좌측`cliff` · 잔디 언덕 상단 좌측`cliff` | block-04-07 c18 r4 |
| 139 | 초록 목초지 `terrain` | 잔디 절벽 상단 중앙 `cliff` | 잔디 절벽 상단 중앙`cliff` · 잔디 언덕 상단 중앙`cliff` | block-04-07 c19 r4 |
| 140 | 푸른 평원 풀밭 `terrain` | 잔디 절벽 상단 우측 `cliff` | 잔디 절벽 상단 우측`cliff` · 잔디 언덕 상단 우측`cliff` | block-04-07 c20 r4 |
| 141 | 갈색 산악 평원 `terrain` | 흙 절벽 상단 좌측 `cliff` | 흙 절벽 상단 좌측`cliff` · 흙 절벽 상단 좌측`cliff` | block-04-07 c21 r4 |
| 142 | 갈색 언덕 지대 `terrain` | 흙 절벽 상단 중앙 `cliff` | 흙 절벽 상단 중앙`cliff` · 흙 절벽 상단 중앙`cliff` | block-04-07 c22 r4 |
| 143 | 황토 산맥 땅 `terrain` | 흙 절벽 상단 우측 `cliff` | 흙 절벽 상단 우측`cliff` · 흙 절벽 상단 우측`cliff` | block-04-07 c23 r4 |
| 144 | 불꽃 봉수대 아이콘 `torch` | 벽걸이 횃불 `torch` | 벽 횃불`prop` · 벽걸이 횃불`prop` | block-04-07 c24 r4 |
| 145 | 언덕 위 밝은 표지 `town-icon` | 시약병 선반 `town-icon` | 물약 선반`furniture` · 시약병 선반`prop` · 물약 선반`prop` | block-04-07 c25 r4 |
| 146 | 작은 바위 언덕 `rock` | 벽걸이 석재 스위치 `prop` | 벽 스위치`prop` · 벽걸이 석재 스위치`prop` | block-04-07 c26 r4 |
| 147 | 기와지붕 대형 건물 `town-icon` | 무기점 간판 `town-icon` | 무기점 간판`prop` · 무기점 간판`prop` | block-04-07 c27 r4 |
| 148 | 문과 창 큰 건물 `town-icon` | 방어구점 간판 `town-icon` | 방어구점 간판`prop` · 방어구점 간판`prop` | block-04-07 c28 r4 |
| 149 | 돌벽 큰 건물 `town-icon` | 잡화점 간판 `town-icon` | 잡화점 간판`prop` · 시계점 간판`prop` | block-04-07 c29 r4 |
| 153 | 물거품 이는 바다 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 소용돌이 급류`water` | block-04-07 c3 r5 |
| 154 | 하얀 포말 해면 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 소용돌이 급류`water` | block-04-07 c4 r5 |
| 155 | 부서지는 파도 `water` | 마법 샘 `water` | 마법 샘`water` · 얼음 바닥`floor` · 소용돌이`water` | block-04-07 c5 r5 |
| 156 | 진주빛 심해 물결 `water` | 독 늪 좌상단 `terrain` | 독 늪 좌상단`terrain` · 보라색 독늪 좌상단`water` · 독 늪 좌상단`terrain` | block-04-07 c6 r5 |
| 157 | 물가 풀밭 땅 `terrain` | 독 늪 상단 가장자리 `terrain` | 독 늪 상단`terrain` · 보라색 독늪 상단`water` · 독 늪 상단 가장자리`terrain` | block-04-07 c7 r5 |
| 158 | 물가 초원 해안 `coast` | 독 늪 우상단 `terrain` | 독 늪 우상단`terrain` · 보라색 독늪 우상단`water` · 독 늪 우상단`terrain` | block-04-07 c8 r5 |
| 159 | 하얀 물보라 물가 `coast` | 설원 좌상단 가장자리 `terrain` | 눈밭 좌상단`terrain` · 설원 좌상단 가장자리`terrain` | block-04-07 c9 r5 |
| 160 | 평원 초지 `terrain` | 설원 상단 가장자리 `terrain` | 눈밭 상단`terrain` · 설원 상단 가장자리`terrain` | block-04-07 c10 r5 |
| 161 | 초원 물가 경계 `coast` | 설원 우상단 가장자리 `terrain` | 눈밭 우상단`terrain` · 설원 우상단 가장자리`terrain` | block-04-07 c11 r5 |
| 162 | 회색 바위 지대 `rock` | 밝은 석판 바닥 `floor` | 밝은 석판 바닥`floor` · 석재 벽돌 바닥`floor` | block-04-07 c12 r5 |
| 163 | 회갈색 바위 지대 `rock` | 사각 문양 석재 타일 바닥 `floor` | 사각 문양 석판`floor` · 사각 문양 석재 타일 바닥`floor` | block-04-07 c13 r5 |
| 164 | 바위 섞인 황토 `sand` | 밝은 석조 벽 하단 좌측 `wall` | 밝은 벽돌 벽 하단`wall` · 밝은 석조 벽 하단 좌측`wall` | block-04-07 c14 r5 |
| 165 | 모래 자갈 언덕 `sand` | 밝은 석조 벽 하단 중앙 `wall` | 밝은 벽돌 벽 하단`wall` · 밝은 석조 벽 하단 중앙`wall` | block-04-07 c15 r5 |
| 166 | 바위 모래 사막 `sand` | 밝은 석조 벽 하단 중앙 `wall` | 밝은 벽돌 벽 하단`wall` · 밝은 석조 벽 하단 중앙`wall` | block-04-07 c16 r5 |
| 167 | 모래 언덕 지대 `sand` | 밝은 벽돌 벽 하단 우측 기둥 `wall` | 밝은 벽돌 벽 하단 우측 기둥`wall` · 밝은 석조 벽 하단 우측`wall` | block-04-07 c17 r5 |
| 168 | 초원 흙길 지대 `path` | 설원 절벽 상단 좌측 `cliff` | 눈 절벽 좌상단`cliff` · 설원 절벽 상단 좌측`cliff` | block-04-07 c18 r5 |
| 169 | 하얀 눈 설원 `snow` | 설원 절벽 상단 중앙 `cliff` | 눈 절벽 상단`cliff` · 설원 절벽 상단 중앙`cliff` | block-04-07 c19 r5 |
| 170 | 푸른 평원 초지 `terrain` | 설원 절벽 상단 우측 `cliff` | 눈 절벽 우상단`cliff` · 설원 절벽 상단 우측`cliff` | block-04-07 c20 r5 |
| 171 | 갈색 산악 지대 `terrain` | 흙 절벽 상단부 좌측 `cliff` | 흙 절벽 상층 좌측`cliff` · 흙 절벽 상단부 좌측`cliff` | block-04-07 c21 r5 |
| 172 | 갈색 평야 땅 `terrain` | 흙 절벽 상단부 중앙 `cliff` | 흙 절벽 상층 중앙`cliff` · 흙 절벽 상단부 중앙`cliff` | block-04-07 c22 r5 |
| 173 | 황갈색 산맥 언덕 `terrain` | 흙 절벽 상단부 우측 `cliff` | 흙 절벽 상층 우측`cliff` · 흙 절벽 상단부 우측`cliff` | block-04-07 c23 r5 |
| 174 | 해자 둘러싼 성 `town-icon` | 풍경화 액자 `town-icon` | 풍경화 액자`decoration` · 풍경화 액자`decoration` | block-04-07 c24 r5 |
| 175 | 불빛 나는 창 건물 `town-icon` | 모닥불 그림 액자 `town-icon` | 모닥불 그림 액자`decoration` · 모닥불 그림 액자`decoration` | block-04-07 c25 r5 |
| 176 | 초록 벽 요새 `town-icon` | 인물 초상화 액자 `town-icon` | 초상화 액자`decoration` · 인물 초상화 액자`decoration` | block-04-07 c26 r5 |
| 177 | 건물 좌측 아이콘 `town-icon` | 여관 간판 `town-icon` | 여관 간판`prop` · 여관 간판`prop` | block-04-07 c27 r5 |
| 178 | 건물 중앙 아이콘 `town-icon` | 주점 간판 `town-icon` | 주점 간판`prop` · 주점 간판`prop` | block-04-07 c28 r5 |
| 179 | 작은 언덕 아이콘 `rock` | 십자가 간판 `prop` | 신전 간판`prop` · 십자가 간판`prop` | block-04-07 c29 r5 |
| 183 | 물거품 이는 바다 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 물결`water` | block-04-07 c3 r6 |
| 184 | 하얀 포말 해면 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 물결`water` | block-04-07 c4 r6 |
| 185 | 부서지는 파도 `water` | 마법 샘 `water` | 마법 샘`water` · 얼음 바닥`floor` · 소용돌이`water` | block-04-07 c5 r6 |
| 186 | 진주빛 심해 물결 `water` | 독 늪 좌측 가장자리 `terrain` | 독 늪 좌측`terrain` · 보라색 독늪 좌측`water` · 독 늪 좌측 가장자리`terrain` | block-04-07 c6 r6 |
| 187 | 평야 숲 초지 `terrain` | 독 늪 중앙 `terrain` | 독 늪 중앙`terrain` · 보라색 독늪 중앙`water` · 독 늪 중앙`terrain` | block-04-07 c7 r6 |
| 188 | 물가 초원 해안 `coast` | 독 늪 우측 가장자리 `terrain` | 독 늪 우측`terrain` · 보라색 독늪 우측`water` · 독 늪 우측 가장자리`terrain` | block-04-07 c8 r6 |
| 189 | 하얀 물보라 물가 `coast` | 설원 좌측 가장자리 `terrain` | 눈밭 좌측`terrain` · 설원 좌측 가장자리`terrain` | block-04-07 c9 r6 |
| 190 | 평원 초지 `terrain` | 눈밭 중앙 `terrain` | 눈밭 중앙`terrain` · 설원 중앙`terrain` | block-04-07 c10 r6 |
| 191 | 초원 물가 경계 `coast` | 설원 우측 가장자리 `terrain` | 눈밭 우측`terrain` · 설원 우측 가장자리`terrain` | block-04-07 c11 r6 |
| 192 | 회색 암반 지대 `rock` | 어두운 석판 바닥 `floor` | 어두운 석판 바닥`floor` · 어두운 동굴 바닥`floor` | block-04-07 c12 r6 |
| 193 | 회갈색 바위 지대 `rock` | 석순 상단 `rock` | 석순 상단`rock` · 큰 종유석`rock` | block-04-07 c13 r6 |
| 194 | 바위 자갈 언덕 `sand` | 어두운 돌벽 상단 좌측 `wall` | 어두운 석벽 상단`wall` · 어두운 돌벽 상단 좌측`wall` | block-04-07 c14 r6 |
| 195 | 모래 바위 사막 `sand` | 어두운 돌벽 상단 중앙 `wall` | 어두운 석벽 상단`wall` · 어두운 돌벽 상단 중앙`wall` | block-04-07 c15 r6 |
| 196 | 황토 모래 언덕 `sand` | 어두운 돌벽 상단 중앙 `wall` | 어두운 석벽 상단`wall` · 어두운 돌벽 상단 중앙`wall` | block-04-07 c16 r6 |
| 197 | 바위 모래 지대 `sand` | 어두운 석벽 상단 우측 기둥 `wall` | 어두운 석벽 상단 우측 기둥`wall` · 어두운 돌벽 상단 우측`wall` | block-04-07 c17 r6 |
| 198 | 초원 흙길 지대 `path` | 설원 절벽 중간 좌측 `cliff` | 눈 절벽 중단 좌측`cliff` · 설원 절벽 중간 좌측`cliff` | block-04-07 c18 r6 |
| 199 | 눈 덮인 설원 `snow` | 설원 절벽 중간 중앙 `cliff` | 눈 절벽 중단 중앙`cliff` · 설원 절벽 중간 중앙`cliff` | block-04-07 c19 r6 |
| 200 | 푸른 평원 초지 `terrain` | 설원 절벽 중간 우측 `cliff` | 눈 절벽 중단 우측`cliff` · 설원 절벽 중간 우측`cliff` | block-04-07 c20 r6 |
| 201 | 갈색 산악 지대 `terrain` | 흙 절벽 중간부 좌측 `cliff` | 흙 절벽 중층 좌측`cliff` · 흙 절벽 중간부 좌측`cliff` | block-04-07 c21 r6 |
| 202 | 갈색 평야 땅 `terrain` | 흙 절벽 중간부 중앙 `cliff` | 흙 절벽 중층 중앙`cliff` · 흙 절벽 중간부 중앙`cliff` | block-04-07 c22 r6 |
| 203 | 황토 언덕 산맥 `terrain` | 흙 절벽 중간부 우측 `cliff` | 흙 절벽 중층 우측`cliff` · 흙 절벽 중간부 우측`cliff` | block-04-07 c23 r6 |
| 204 | 작은 집 아이콘 `town-icon` | 아치형 격자 창문 `window` | 아치형 격자 창문`window` · 아치형 격자 창문`window` | block-04-07 c24 r6 |
| 205 | 벽돌 쌓인 성벽 `wall` | 나무 덧문 창문 `window` | 나무 창문`window` · 나무 덧문 창문`window` | block-04-07 c25 r6 |
| 206 | 문 달린 건물 `town-icon` | 어두운 벽감 액자 `town-icon` | 동굴 그림 액자`decoration` · 어두운 벽감 액자`decoration` | block-04-07 c26 r6 |
| 207 | 물 위 목교 `bridge` | 갑옷 거치대 상단 `prop` | 갑옷 거치대 상단`prop` · 기사 석상 상단`prop` | block-04-07 c27 r6 |
| 208 | 모래 언덕 아이콘 `sand` | 여신 석상 상단 `prop` | 석상 상단`prop` · 여신 석상 상단`prop` | block-04-07 c28 r6 |
| 209 | 작은 나무 수풀 `plant` | 석조 기둥 상단 `prop` | 돌기둥 상단`prop` · 석조 기둥 상단`prop` | block-04-07 c29 r6 |
| 213 | 물거품 이는 바다 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 물결`water` | block-04-07 c3 r7 |
| 214 | 하얀 포말 해면 `water` | 소용돌이치는 물 `water` | 소용돌이치는 물`water` · 거센 물결`water` | block-04-07 c4 r7 |
| 215 | 부서지는 파도 `water` | 마법 샘 `water` | 마법 샘`water` · 얼음 바닥`floor` · 소용돌이`water` | block-04-07 c5 r7 |
| 216 | 진주빛 심해 물결 `water` | 독 늪 좌하단 `terrain` | 독 늪 좌하단`terrain` · 보라색 독늪 좌하단`water` · 독 늪 좌하단`terrain` | block-04-07 c6 r7 |
| 218 | 물가 초원 해안 `coast` | 독 늪 우하단 `terrain` | 독 늪 우하단`terrain` · 보라색 독늪 우하단`water` · 독 늪 우하단`terrain` | block-04-07 c8 r7 |
| 219 | 하얀 물보라 물가 `coast` | 설원 좌하단 가장자리 `terrain` | 눈밭 좌하단`terrain` · 설원 좌하단 가장자리`terrain` | block-04-07 c9 r7 |
| 220 | 평원 초지 `terrain` | 설원 하단 가장자리 `terrain` | 눈밭 하단`terrain` · 설원 하단 가장자리`terrain` | block-04-07 c10 r7 |
| 221 | 초원 물가 경계 `coast` | 설원 우하단 가장자리 `terrain` | 눈밭 우하단`terrain` · 설원 우하단 가장자리`terrain` | block-04-07 c11 r7 |
| 222 | 회색 암반 지대 `rock` | 작은 석순 무리 `rock` | 작은 돌조각들`rock` · 작은 석순 무리`rock` | block-04-07 c12 r7 |
| 223 | 회갈색 바위 지대 `rock` | 석순 하단 `rock` | 석순 하단`rock` · 종유석`rock` | block-04-07 c13 r7 |
| 224 | 바위 자갈 언덕 `sand` | 어두운 돌벽 하단 좌측 `wall` | 어두운 석벽 하단`wall` · 어두운 돌벽 하단 좌측`wall` | block-04-07 c14 r7 |
| 225 | 모래 바위 사막 `sand` | 어두운 돌벽 하단 중앙 `wall` | 어두운 석벽 하단`wall` · 어두운 돌벽 하단 중앙`wall` | block-04-07 c15 r7 |
| 226 | 황토 모래 언덕 `sand` | 어두운 돌벽 하단 중앙 `wall` | 어두운 석벽 하단`wall` · 어두운 돌벽 하단 중앙`wall` | block-04-07 c16 r7 |
| 227 | 바위 모래 지대 `sand` | 어두운 석벽 하단 우측 기둥 `wall` | 어두운 석벽 하단 우측 기둥`wall` · 어두운 돌벽 하단 우측`wall` | block-04-07 c17 r7 |
| 228 | 초원 흙길 지대 `path` | 설원 절벽 하단 좌측 `cliff` | 눈 절벽 하단 좌측`cliff` · 설원 절벽 하단 좌측`cliff` | block-04-07 c18 r7 |
| 229 | 눈 덮인 설원 `snow` | 설원 절벽 하단 중앙 `cliff` | 눈 절벽 하단 중앙`cliff` · 설원 절벽 하단 중앙`cliff` | block-04-07 c19 r7 |
| 230 | 푸른 평원 초지 `terrain` | 설원 절벽 하단 우측 `cliff` | 눈 절벽 하단 우측`cliff` · 설원 절벽 하단 우측`cliff` | block-04-07 c20 r7 |
| 231 | 갈색 산악 지대 `terrain` | 흙 절벽 하층 좌측 `cliff` | 흙 절벽 하층 좌측`cliff` · 흙 절벽 하단 좌측`cliff` | block-04-07 c21 r7 |
| 232 | 갈색 평야 땅 `terrain` | 흙 절벽 하층 중앙 `cliff` | 흙 절벽 하층 중앙`cliff` · 흙 절벽 하단 중앙`cliff` | block-04-07 c22 r7 |
| 234 | 불꽃 깃발 탑 `town-icon` | 스테인드글라스 창문 `window` | 스테인드글라스 창문`window` · 스테인드글라스 창문`window` | block-04-07 c24 r7 |
| 235 | 점멸 무늬 프레임 `animation` | 목재 사다리 `stairs` | 목재 사다리`stairs` · 나무 사다리`stairs` | block-04-07 c25 r7 |
| 236 | 검은 배경 프레임 `animation` | 어두운 통로 입구 `door` | 어두운 통로`door` · 어두운 통로 입구`door` | block-04-07 c26 r7 |
| 237 | 물가 기둥 구조물 `prop` | 기사 석상 받침대 하단 `prop` | 갑옷 거치대 하단`prop` · 기사 석상 받침대 하단`prop` | block-04-07 c27 r7 |
| 238 | 모래 바위 아이콘 `sand` | 여신 석상 받침대 하단 `prop` | 석상 하단`prop` · 여신 석상 받침대 하단`prop` | block-04-07 c28 r7 |
| 239 | 작은 나무 수풀 `plant` | 석조 기둥 받침대 하단 `prop` | 돌기둥 하단`prop` · 석조 기둥 받침대 하단`prop` | block-04-07 c29 r7 |
| 242 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c2 r8 |
| 245 | 풀 포인트 초원 `terrain` | 짙은 잔디 지형 `terrain` | 풀숲 지형`plant` · 짙은 잔디 지형`terrain` · 짙은 풀 지형`terrain` | block-08-11 c5 r8 |
| 246 | 설원 언 얼음물 `snow` | 눈 덮인 침엽수 `tree` | 눈 덮인 침엽수`tree` · 눈 덮인 덤불`plant` · 눈 덮인 작은 바위`rock` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 248 | 설원 어는 물길 `snow` | 눈 덮인 숲 조각 `tree` | 눈 덮인 숲 조각`tree` · 눈 덮인 나무`tree` | block-08-11 c8 r8 |
| 249 | 눈 덮인 흙 지면 `snow` | 눈 덮인 흙바위 더미 `rock` | 작은 설산`cliff` · 눈 쌓인 흙 둔덕`rock` · 눈 덮인 흙바위 더미`rock` | block-08-11 c9 r8 |
| 251 | 눈덮인 바위 지면 `snow` | 눈 덮인 흙바위 더미 `rock` | 작은 설산`cliff` · 눈 쌓인 흙 둔덕`rock` · 눈 덮인 흙바위 더미`rock` | block-08-11 c11 r8 |
| 252 | 풀 덮인 바위산 `mountain` | 풀 자란 자갈 지형 `mountain` | 풀 섞인 자갈길`floor` · 풀 자란 자갈 지형`terrain` · 이끼 낀 자갈 바닥`terrain` | block-08-11 c12 r8 |
| 253 | 눈 붙은 바위산 `mountain` | 자갈 지형 `mountain` | 조약돌 바닥`floor` · 자갈 지형`terrain` · 자갈 바닥`terrain` | block-08-11 c13 r8 |
| 254 | 어두운 암석산 `mountain` | 거친 석벽 상단 좌측 `wall` | 거친 석벽 상단 좌측`wall` · 어두운 이끼 석벽`wall` | block-08-11 c14 r8 |
| 255 | 회색 바위 능선 `mountain` | 거친 석벽 상단 중앙 `wall` | 거친 석벽 상단 중앙`wall` · 어두운 이끼 석벽`wall` | block-08-11 c15 r8 |
| 256 | 바위산 비탈 `mountain` | 거친 석벽 상단 중앙 `wall` | 거친 석벽 상단 중앙`wall` · 어두운 이끼 석벽`wall` | block-08-11 c16 r8 |
| 257 | 그늘진 바위산 `mountain` | 어두운 이끼 석벽 우측 끝 `wall` | 거친 석벽 상단 우측`wall` · 어두운 이끼 석벽 우측 끝`wall` | block-08-11 c17 r8 |
| 259 | 왕관 초록 나무 `tree` | 작은 활엽수 `tree` | 작은 활엽수`tree` · 작은 활엽수`tree` | block-08-11 c19 r8 |
| 262 | 빨간 열매 관목 `plant` | 붉은 지붕 작은 집 `prop` | 붉은 지붕 오두막`prop` · 붉은 지붕 작은 집`prop` | block-08-11 c22 r8 |
| 263 | 물가 바위 지대 `rock` | 눈 덮인 작은 집 `prop` | 눈 덮인 오두막`prop` · 눈 덮인 작은 집`prop` | block-08-11 c23 r8 |
| 264 | 바위 언덕 `rock` | 석제 안내판 `decoration` | 석조 건물`prop` · 석재 표지판`decoration`* · 석조 선반장`furniture`* | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 265 | 좁은 흙길 `path` | 매달린 나무통 밧줄 `prop` | 매달린 밧줄`prop` · 매달린 나무통 밧줄`prop` | block-08-11 c25 r8 |
| 266 | 어두운 목조 기단 `prop` | 어두운 벽난로 아궁이 `furniture` | 동굴 입구`door` · 어두운 구멍 상단`decoration`* · 어두운 벽난로 아궁이`furniture`* | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 267 | 나무 판자 갑판 `bridge` | 책장 상단 `furniture` | 책장 상단`furniture` · 책장 상단`furniture` | block-08-11 c27 r8 |
| 268 | 나무 판자 마루 `bridge` | 서랍 수납장 상단 `furniture` | 서랍 수납장 상단`furniture` · 목재 선반장 상단`furniture` | block-08-11 c28 r8 |
| 269 | 이음새 나무 갑판 `bridge` | 목재 장롱 상단 `furniture` | 옷장 상단`furniture` · 목재 장롱 상단`furniture` | block-08-11 c29 r8 |
| 272 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c2 r9 |
| 274 | 울창한 풀밭 `terrain` | 짙은 잔디 지형 `terrain` | 풀숲 지형`plant` · 짙은 잔디 지형`terrain` · 짙은 풀 지형`terrain` | block-08-11 c4 r9 |
| 276 | 설원 언 물가 `snow` | 눈 덮인 숲 상단 좌측 `tree` | 눈 덮인 숲 좌상단`tree` · 눈 덮인 숲 상단 좌측`tree` | block-08-11 c6 r9 |
| 277 | 설원 흐르는 물 `snow` | 눈 덮인 숲 상단 중앙 `tree` | 눈 덮인 숲 중상단`tree` · 눈 덮인 숲 상단 중앙`tree` | block-08-11 c7 r9 |
| 278 | 설원 물풀 지대 `snow` | 눈 덮인 숲 상단 우측 `tree` | 눈 덮인 숲 우상단`tree` · 눈 덮인 숲 상단 우측`tree` | block-08-11 c8 r9 |
| 279 | 눈 섞인 흙밭 `snow` | 눈 덮인 흙 둔덕 지대 상단 좌측 `rock` | 눈 덮인 산맥 좌상단`cliff` · 눈 덮인 흙 둔덕 지대 상단 좌측`rock` · 눈 덮인 바위 무리 상단 좌측`rock` | block-08-11 c9 r9 |
| 280 | 눈덮인 진흙 지면 `snow` | 눈 덮인 흙 둔덕 지대 상단 중앙 `rock` | 눈 덮인 산맥 중상단`cliff` · 눈 덮인 흙 둔덕 지대 상단 중앙`rock` · 눈 덮인 바위 무리 상단 중앙`rock` | block-08-11 c10 r9 |
| 281 | 흙섞인 설원 지면 `snow` | 눈 덮인 흙 둔덕 지대 상단 우측 `rock` | 눈 덮인 산맥 우상단`cliff` · 눈 덮인 흙 둔덕 지대 상단 우측`rock` · 눈 덮인 바위 무리 상단 우측`rock` | block-08-11 c11 r9 |
| 284 | 암벽 바위산 `mountain` | 거친 석벽 하단 좌측 `wall` | 거친 석벽 하단 좌측`wall` · 어두운 이끼 석벽`wall` | block-08-11 c14 r9 |
| 285 | 잿빛 바위 능선 `mountain` | 거친 석벽 하단 중앙 `wall` | 거친 석벽 하단 중앙`wall` · 어두운 이끼 석벽`wall` | block-08-11 c15 r9 |
| 286 | 바위산 돌벽 `mountain` | 거친 석벽 하단 중앙 `wall` | 거친 석벽 하단 중앙`wall` · 어두운 이끼 석벽`wall` | block-08-11 c16 r9 |
| 287 | 짙은 암벽 지대 `mountain` | 어두운 이끼 석벽 우측 끝 `wall` | 거친 석벽 하단 우측`wall` · 어두운 이끼 석벽 우측 끝`wall` | block-08-11 c17 r9 |
| 288 | 빨간 열매 나무 `tree` | 꽃 핀 관목 `tree` | 꽃 덤불`plant` · 꽃 핀 관목`plant` | block-08-11 c18 r9 |
| 289 | 초록 왕관 나무 `tree` | 둥근 덤불 `tree` | 둥근 덤불`plant` · 관목`plant` | block-08-11 c19 r9 |
| 291 | 숲속 작은 연못 `water` | 푸른 첨탑 성문 `gate` | 푸른 신전`prop` · 파란 지붕 성문`gate` · 파란 첨탑 성문 건물`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 292 | 나무 선착장 `bridge` | 나무 오두막 `prop` | 나무 오두막`prop` · 목조 건물`prop` | block-08-11 c22 r9 |
| 293 | 물가 목조 부두 `bridge` | 눈 덮인 석조 건물 `prop` | 눈 덮인 텐트`prop` · 눈 덮인 석조 건물`prop` | block-08-11 c23 r9 |
| 294 | 모래 벌판 `sand` | 긴 목재 탁자 상단 `furniture` | 긴 목재 탁자 상단`furniture` · 목재 식탁 상단`furniture` | block-08-11 c24 r9 |
| 295 | 마른 모래 땅 `sand` | 매달린 나무통 `prop` | 매달린 나무통`prop` · 매달린 나무통`prop` | block-08-11 c25 r9 |
| 296 | 해변 자갈밭 `coast` | 빛 효과 `decoration` | 빛 효과`decoration` · 뿌연 김`decoration`* | block-08-11 c26 r9 |
| 297 | 수상 목조 갑판 `bridge` | 책장 하단 `furniture` | 책장 하단`furniture` · 책장 하단`furniture` | block-08-11 c27 r9 |
| 298 | 갈색 나무 갑판 `bridge` | 서랍 수납장 하단 `furniture` | 서랍 수납장 하단`furniture` · 목재 선반장 하단`furniture` | block-08-11 c28 r9 |
| 299 | 나무널 갑판 `bridge` | 목재 장롱 하단 `furniture` | 옷장 하단`furniture` · 목재 장롱 하단`furniture` | block-08-11 c29 r9 |
| 301 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c1 r10 |
| 302 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c2 r10 |
| 303 | 풀무늬 초원 `terrain` | 짙은 잔디 지형 `terrain` | 풀숲 지형`plant` · 짙은 잔디 지형`terrain` · 짙은 풀 지형`terrain` | block-08-11 c3 r10 |
| 306 | 설원 얼음물 지대 `snow` | 눈 덮인 숲 중단 좌측 `tree` | 눈 덮인 숲 좌측`tree` · 눈 덮인 숲 중단 좌측`tree` | block-08-11 c6 r10 |
| 307 | 설원 강물 자락 `snow` | 눈 덮인 숲 중단 중앙 `tree` | 눈 덮인 숲 중앙`tree` · 눈 덮인 숲 중단 중앙`tree` | block-08-11 c7 r10 |
| 308 | 설원 수풀 물가 `snow` | 눈 덮인 숲 중단 우측 `tree` | 눈 덮인 숲 우측`tree` · 눈 덮인 숲 중단 우측`tree` | block-08-11 c8 r10 |
| 309 | 눈덮인 흙 지면 `snow` | 눈 덮인 흙 둔덕 지대 중단 좌측 `rock` | 눈 덮인 산맥 좌측`cliff` · 눈 덮인 흙 둔덕 지대 중단 좌측`rock` · 눈 덮인 바위 무리 중단 좌측`rock` | block-08-11 c9 r10 |
| 310 | 진흙설원 경계 `snow` | 눈 덮인 흙 둔덕 지대 중단 중앙 `rock` | 눈 덮인 산맥 중앙`cliff` · 눈 덮인 흙 둔덕 지대 중단 중앙`rock` · 눈 덮인 바위 무리 중단 중앙`rock` | block-08-11 c10 r10 |
| 311 | 흙섞인 설원 가장자리 `snow` | 눈 덮인 흙 둔덕 지대 중단 우측 `rock` | 눈 덮인 산맥 우측`cliff` · 눈 덮인 흙 둔덕 지대 중단 우측`rock` · 눈 덮인 바위 무리 중단 우측`rock` | block-08-11 c11 r10 |
| 312 | 사막 모래 지면 `sand` | 갈색 흙 지형 `sand` | 흙 바닥`terrain` · 갈색 흙 지형`terrain` | block-08-11 c12 r10 |
| 313 | 자갈 언덕 `rock` | 어두운 흙 바닥 `terrain` | 어두운 흙 바닥`terrain` · 자갈빛 흙 지형`terrain` | block-08-11 c13 r10 |
| 314 | 눈 덮인 바위산 `mountain` | 보라색 벽돌 벽 상단 좌측 `wall` | 보라색 벽돌 벽 상단 좌측`wall` · 자수정 벽돌 벽 상단`wall` | block-08-11 c14 r10 |
| 315 | 자줏빛 산봉우리 `mountain` | 보라색 벽돌 벽 상단 중앙 `wall` | 보라색 벽돌 벽 상단 중앙`wall` · 자수정 벽돌 벽 상단`wall` | block-08-11 c15 r10 |
| 316 | 만년설 바위산 `mountain` | 보라색 벽돌 벽 상단 중앙 `wall` | 보라색 벽돌 벽 상단 중앙`wall` · 자수정 벽돌 벽 상단`wall` | block-08-11 c16 r10 |
| 317 | 산 정상 바위 `mountain` | 자수정 벽돌 벽 상단 우측 끝 `wall` | 보라색 벽돌 벽 상단 우측`wall` · 자수정 벽돌 벽 상단 우측 끝`wall` | block-08-11 c17 r10 |
| 318 | 숲 캐노피 덩어리 `forest` | 큰 나무 잎사귀 좌측 `forest` | 큰 활엽수 좌상단`tree` · 큰 나무 잎사귀 좌측`tree` | block-08-11 c18 r10 |
| 319 | 숲 가장자리 캐노피 `forest` | 큰 나무 잎사귀 우측 `forest` | 큰 활엽수 우상단`tree` · 큰 나무 잎사귀 우측`tree` | block-08-11 c19 r10 |
| 320 | 회색 석조 건물 `town-icon` | 회색 석조 성채 좌상단 `wall` | 회색 성채 좌상단`prop` · 석조 성채 상단 좌측`wall` · 회색 석조 성채 좌상단`wall` | block-08-11 c20 r10 |
| 321 | 잿빛 석조 건물 `town-icon` | 회색 석조 성채 우상단 `wall` | 회색 성채 우상단`prop` · 석조 성채 상단 우측`wall` · 회색 석조 성채 우상단`wall` | block-08-11 c21 r10 |
| 322 | 풀둑 낀 연못 `water` | 푸른 첨탑 성채 좌측 지붕 `roof` | 푸른 성채 좌상단`prop` · 파란 첨탑 성 상단 좌측`wall` · 파란 첨탑 성 좌상단`roof` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 323 | 둑 낀 물웅덩이 `water` | 푸른 첨탑 성채 우측 지붕 `roof` | 푸른 성채 우상단`prop` · 파란 첨탑 성 상단 우측`wall` · 파란 첨탑 성 우상단`roof` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 324 | 모래 지면 `sand` | 긴 목재 탁자 중단 `furniture` | 긴 목재 탁자 중단`furniture` · 목재 식탁 중단`furniture` | block-08-11 c24 r10 |
| 325 | 바위 언덕 둔덕 `rock` | 회색 도자기 주전자 `prop` | 도자기 항아리`prop` · 회색 도자기 주전자`prop` | block-08-11 c25 r10 |
| 326 | 갈색 둑 땅 `terrain` | 원형 목재 탁자 `furniture` | 원형 목재 탁자`furniture` · 둥근 목재 탁자`furniture` | block-08-11 c26 r10 |
| 327 | 세로 나무 말뚝 `prop` | 목재 의자 전면 `furniture` | 목재 의자 전면`furniture` · 목재 안락의자`furniture` | block-08-11 c27 r10 |
| 328 | 나무 지주 `prop` | 목재 의자 후면 `furniture` | 목재 의자 후면`furniture` · 목재 의자`furniture` | block-08-11 c28 r10 |
| 329 | 둑 사이 수로 `water` | 목재 전신 거울 상단 `furniture` | 화장대 상단`furniture` · 목재 전신 거울 상단`furniture` | block-08-11 c29 r10 |
| 331 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c1 r11 |
| 332 | 평탄한 들판 풀밭 `terrain` | 잔디 지형 `terrain` | 잔디 지형`terrain` · 잔디 지형`terrain` | block-08-11 c2 r11 |
| 334 | 풀 언덕 초지 `terrain` | 짙은 잔디 지형 `terrain` | 풀숲 지형`plant` · 짙은 잔디 지형`terrain` · 짙은 풀 지형`terrain` | block-08-11 c4 r11 |
| 335 | 들판 풀 텍스처 `terrain` | 짙은 잔디 지형 `terrain` | 풀숲 지형`plant` · 짙은 잔디 지형`terrain` · 짙은 풀 지형`terrain` | block-08-11 c5 r11 |
| 336 | 설원 얼음 물빛 `snow` | 눈 덮인 숲 하단 좌측 `tree` | 눈 덮인 숲 좌하단`tree` · 눈 덮인 숲 하단 좌측`tree` | block-08-11 c6 r11 |
| 337 | 설원 어는 강 `snow` | 눈 덮인 숲 하단 중앙 `tree` | 눈 덮인 숲 중하단`tree` · 눈 덮인 숲 하단 중앙`tree` | block-08-11 c7 r11 |
| 338 | 설원 흙 물가 `snow` | 눈 덮인 숲 하단 우측 `tree` | 눈 덮인 숲 우하단`tree` · 눈 덮인 숲 하단 우측`tree` | block-08-11 c8 r11 |
| 339 | 눈덮인 진흙 지면 `snow` | 눈 덮인 흙 둔덕 지대 하단 좌측 `rock` | 눈 덮인 산맥 좌하단`cliff` · 눈 덮인 흙 둔덕 지대 하단 좌측`rock` · 눈 덮인 바위 무리 하단 좌측`rock` | block-08-11 c9 r11 |
| 340 | 진흙 설원 경계 `snow` | 눈 덮인 흙 둔덕 지대 하단 중앙 `rock` | 눈 덮인 산맥 중하단`cliff` · 눈 덮인 흙 둔덕 지대 하단 중앙`rock` · 눈 덮인 바위 무리 하단 중앙`rock` | block-08-11 c10 r11 |
| 341 | 흙섞인 눈밭 `snow` | 눈 덮인 흙 둔덕 지대 하단 우측 `rock` | 눈 덮인 산맥 우하단`cliff` · 눈 덮인 흙 둔덕 지대 하단 우측`rock` · 눈 덮인 바위 무리 하단 우측`rock` | block-08-11 c11 r11 |
| 342 | 숲 덮인 산 `mountain` | 풀 섞인 흙 바닥 `mountain` | 풀 섞인 흙 바닥`terrain` · 풀 자란 흙 지형`terrain` | block-08-11 c12 r11 |
| 343 | 풀 낀 모래 언덕 `sand` | 풀 섞인 황토 바닥 `sand` | 풀 섞인 황토 바닥`terrain` · 풀 자란 흙 지형`terrain` | block-08-11 c13 r11 |
| 344 | 자주빛 석조 건물 `town-icon` | 보라색 벽돌 벽 하단 좌측 `wall` | 보라색 벽돌 벽 하단 좌측`wall` · 자수정 벽돌 벽 하단`wall` | block-08-11 c14 r11 |
| 345 | 자색 돌 건물 `town-icon` | 보라색 벽돌 벽 하단 중앙 `wall` | 보라색 벽돌 벽 하단 중앙`wall` · 자수정 벽돌 벽 하단`wall` | block-08-11 c15 r11 |
| 346 | 보라빛 석조 구조 `town-icon` | 보라색 벽돌 벽 하단 중앙 `wall` | 보라색 벽돌 벽 하단 중앙`wall` · 자수정 벽돌 벽 하단`wall` | block-08-11 c16 r11 |
| 347 | 그늘진 자주 건물 `town-icon` | 자수정 벽돌 벽 하단 우측 끝 `wall` | 보라색 벽돌 벽 하단 우측`wall` · 자수정 벽돌 벽 하단 우측 끝`wall` | block-08-11 c17 r11 |
| 350 | 회색 석조 건물 `town-icon` | 회색 석조 성채 좌하단 `wall` | 회색 성채 좌하단`prop` · 석조 성채 하단 좌측`wall` · 회색 석조 성채 좌하단`wall` | block-08-11 c20 r11 |
| 351 | 잿빛 돌 건물 `town-icon` | 회색 석조 성채 우하단 `wall` | 회색 성채 우하단`prop` · 석조 성채 하단 우측`wall` · 회색 석조 성채 우하단`wall` | block-08-11 c21 r11 |
| 352 | 덩굴 덮인 목조 건물 `town-icon` | 파란 첨탑 성 하단 좌측 `wall` | 푸른 성채 좌하단`prop` · 파란 첨탑 성 하단 좌측`wall` · 파란 첨탑 성 좌하단`wall` | block-08-11 c22 r11 |
| 353 | 수풀 두른 갈색 집 `town-icon` | 파란 첨탑 성 하단 우측 `wall` | 푸른 성채 우하단`prop` · 파란 첨탑 성 하단 우측`wall` · 파란 첨탑 성 우하단`wall` | block-08-11 c23 r11 |
| 354 | 나무 부두 갑판 `bridge` | 긴 목재 탁자 하단 `furniture` | 긴 목재 탁자 하단`furniture` · 목재 식탁 하단`furniture` | block-08-11 c24 r11 |
| 355 | 갈색 흙 돔 언덕 `terrain` | 작은 나무통 `prop` | 목재 통`prop` · 작은 나무통`prop` | block-08-11 c25 r11 |
| 356 | 작은 흙 언덕 `terrain` | 목재 등받이 없는 의자 `furniture` | 원형 목재 의자`furniture` · 목재 등받이 없는 의자`furniture` | block-08-11 c26 r11 |
| 357 | 나무 기둥 받침대 `prop` | 목재 의자 우측면 `furniture` | 목재 의자 우측면`furniture` · 목재 의자 측면`furniture` | block-08-11 c27 r11 |
| 358 | 나무 말뚝 받침 `prop` | 목재 의자 좌측면 `furniture` | 목재 의자 좌측면`furniture` · 목재 의자 측면`furniture` | block-08-11 c28 r11 |
| 359 | 나무 판자 갑판 `bridge` | 낮은 목재 탁자 `furniture` | 화장대 하단`furniture` · 낮은 목재 탁자`furniture` | block-08-11 c29 r11 |
| 360 | 초원 잔디 표면 `terrain` | 작은 숲 `tree` | 작은 숲`tree` · 작은 숲`tree` | block-12-15 c0 r12 |
| 361 | 푸른 평야 초지 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`floor` · 잔디`terrain` · 잔디 바닥`terrain` | block-12-15 c1 r12 |
| 362 | 숲 그늘 풀바닥 `forest` | 작은 숲 `forest` | 작은 숲`tree` · 숲 상단`tree` | block-12-15 c2 r12 |
| 363 | 잔디 속 흙길 `path` | 작은 산 `cliff` | 작은 산`cliff` · 작은 산`cliff` | block-12-15 c3 r12 |
| 364 | 밝은 초장 풀밭 `terrain` | 잔디 바닥 `terrain` | 잔디 바닥`floor` · 잔디`terrain` · 잔디 바닥`terrain` | block-12-15 c4 r12 |
| 365 | 흙길 난 길목 `path` | 산 봉우리 `cliff` | 작은 산`cliff` · 산 봉우리`cliff` | block-12-15 c5 r12 |
| 366 | 짙푸른 바다 물결 `water` | 석재 창살 난간 `wall` | 격자 바닥`floor` · 석재 창살 난간`wall` · 석조 벽틀`wall` | block-12-15 c6 r12 |
| 367 | 깊은 바닷물 수면 `water` | 격자 구덩이 바닥 `floor` | 격자 구덩이 바닥`floor` · 격자 구덩이 바닥`floor` | block-12-15 c7 r12 |
| 368 | 해안 파도 경계 `coast` | 격자 구덩이 모서리 `floor` | 격자 구덩이 모서리`floor` · 석재 기둥 모서리`wall` · 석조 바닥 모서리`floor` | block-12-15 c8 r12 |
| 369 | 잔잔한 바다 수면 `water` | 암석 구덩이 테두리 `cliff` | 어두운 구덩이`floor` · 암석 구덩이 테두리`cliff` · 동굴 벽틀`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 370 | 심해 검은 물 `water` | 어두운 암흑 바닥 `floor` | 검은 어둠 바닥`floor` · 어두운 암흑 바닥`floor` | block-12-15 c10 r12 |
| 371 | 바다 속 어둠 무늬 `water` | 어두운 구덩이 모서리 `floor` | 어두운 구덩이 모서리`floor` · 암석 구멍 모서리`cliff` · 동굴 바닥 모서리`floor` | block-12-15 c11 r12 |
| 372 | 노란 마름모 상징 `decoration` | 상향 화살표 발판 `floor` | 상향 화살표 발판`floor` · 상향 화살표 발판`floor` | block-12-15 c12 r12 |
| 373 | 노란 마름모 상징 `decoration` | 하향 화살표 발판 `floor` | 하향 화살표 발판`floor` · 하향 화살표 발판`floor` | block-12-15 c13 r12 |
| 374 | 푸른 물 위 흰 얼음 `ice` | 석재 계단 `stairs` | 석재 계단`stairs` · 석재 계단`stairs` | block-12-15 c14 r12 |
| 375 | 타오르는 용암 `lava` | 붉은 카펫 좌상단 모서리 `decoration` | 붉은 양탄자 좌상단`floor` · 붉은 카펫 좌상단 모서리`decoration` · 붉은 양탄자 좌상단`decoration` | block-12-15 c15 r12 |
| 376 | 타오르는 용암 `lava` | 붉은 카펫 상단 테두리 `decoration` | 붉은 양탄자 상단`floor` · 붉은 카펫 상단 테두리`decoration` · 붉은 양탄자 상단`decoration` | block-12-15 c16 r12 |
| 377 | 타오르는 용암 `lava` | 붉은 카펫 우상단 모서리 `decoration` | 붉은 양탄자 우상단`floor` · 붉은 카펫 우상단 모서리`decoration` · 붉은 양탄자 우상단`decoration` | block-12-15 c17 r12 |
| 378 | 불길 퍼지는 용암 `lava` | 큰 갈색 산 좌상단 `cliff` | 큰 산 좌상단`cliff` · 큰 갈색 산 좌상단`cliff` | block-12-15 c18 r12 |
| 379 | 불길 퍼지는 용암 `lava` | 큰 갈색 산 우상단 `cliff` | 큰 산 우상단`cliff` · 큰 갈색 산 우상단`cliff` | block-12-15 c19 r12 |
| 380 | 핑크 바탕 무늬 `decoration` | 원형 석탑 상단 `wall` | 돌 탑 상단`wall` · 원형 석탑 상단`wall` | block-12-15 c20 r12 |
| 381 | 회갈색 덤불 무늬 `plant` | 석조 유적 상단 `prop` | 돌 건물 상단`wall` · 석조 유적 상단`prop` · 석조 유적 상단`prop` | block-12-15 c21 r12 |
| 382 | 회색 자갈 바닥 `rock` | 석조 신전 `prop` | 신전`prop` · 신전`decoration` · 석조 신전`prop` | block-12-15 c22 r12 |
| 383 | 연회색 돌 무늬 `rock` | 작은 석탑 `decoration` | 석상`prop` · 작은 석탑`decoration` · 동굴 입구 상단`rock` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 384 | 흰 눈 덮인 봉우리 `snow` | 세로 침대 상단 `furniture` | 침대 상단`furniture` · 세로 침대 상단`furniture` | block-12-15 c24 r12 |
| 385 | 붉은 사막 사구 `sand` | 긴 목재 탁자 좌측 `furniture` | 목재 탁자 좌측`furniture` · 긴 목재 탁자 좌측`furniture` | block-12-15 c25 r12 |
| 386 | 황갈색 사구 능선 `sand` | 긴 목재 탁자 중앙 `furniture` | 목재 탁자 중앙`furniture` · 긴 목재 탁자 중앙`furniture` | block-12-15 c26 r12 |
| 387 | 붉은 사구 언덕 `sand` | 긴 목재 탁자 우측 `furniture` | 목재 탁자 우측`furniture` · 긴 목재 탁자 우측`furniture` | block-12-15 c27 r12 |
| 388 | 바랜 사막 모래 `sand` | 작은 목재 탁자 `furniture` | 작은 목재 탁자`furniture` · 목재 탁자`furniture` | block-12-15 c28 r12 |
| 389 | 보랏빛 무늬 조각 `decoration` | 수정구슬 점술 탁자 `prop` | 점술 탁자`furniture` · 수정구슬 점술 탁자`prop` · 수정구 탁자`prop` | block-12-15 c29 r12 |
| 390 | 들판 풀밭 `terrain` | 숲 좌상단 `tree` | 숲 좌상단`tree` · 숲 좌상단`tree` | block-12-15 c0 r13 |
| 391 | 평온한 초원 `terrain` | 숲 상단 중앙 `tree` | 숲 상단`tree` · 숲 상단 중앙`tree` | block-12-15 c1 r13 |
| 392 | 숲 아래 풀 지면 `forest` | 숲 우상단 `forest` | 숲 우상단`tree` · 숲 우상단`tree` | block-12-15 c2 r13 |
| 393 | 흙길 낸 초원 `path` | 산맥 좌상단 `cliff` | 산 좌상단`cliff` · 산맥 좌상단`cliff` | block-12-15 c3 r13 |
| 394 | 흙밭 다져진 길 `path` | 산맥 상단 중앙 `cliff` | 산 상단`cliff` · 산맥 상단 중앙`cliff` | block-12-15 c4 r13 |
| 395 | 흙언덕 길목 `path` | 산맥 우상단 `cliff` | 산 우상단`cliff` · 산맥 우상단`cliff` | block-12-15 c5 r13 |
| 396 | 거품 검바다 수면 `water` | 격자 구덩이 벽 좌상단 `wall` | 격자 구덩이 벽 좌상단`wall` · 석재 난간 좌상단`wall` | block-12-15 c6 r13 |
| 397 | 짙은 바닷물 `water` | 격자 구덩이 벽 상단 `wall` | 격자 구덩이 벽 상단`wall` · 석재 난간 상단`wall` | block-12-15 c7 r13 |
| 398 | 물결 구르는 바다 `water` | 격자 구덩이 벽 우상단 `wall` | 격자 구덩이 벽 우상단`wall` · 석재 난간 우상단`wall` | block-12-15 c8 r13 |
| 399 | 바다 거품 이랑 `water` | 어두운 구덩이 좌상단 `cliff` | 어두운 구덩이 좌상단`cliff` · 암석 구덩이 좌상단`cliff` | block-12-15 c9 r13 |
| 400 | 어둠 가득 심해 `water` | 어두운 구덩이 상단 `cliff` | 어두운 구덩이 상단`cliff` · 암석 구덩이 상단`cliff` | block-12-15 c10 r13 |
| 401 | 검푸른 바다 어둠 `water` | 어두운 구덩이 우상단 `cliff` | 어두운 구덩이 우상단`cliff` · 암석 구덩이 우상단`cliff` | block-12-15 c11 r13 |
| 402 | 노란 삼각 표식 `banner` | 좌향 화살표 발판 `floor` | 좌향 화살표 발판`floor` · 좌향 화살표 발판`floor` | block-12-15 c12 r13 |
| 403 | 노란 삼각 표식 `banner` | 우향 화살표 발판 `floor` | 우향 화살표 발판`floor` · 우향 화살표 발판`floor` | block-12-15 c13 r13 |
| 404 | 하얀 눈밭 설원 `snow` | 유리창 상단 `window` | 유리창 상단`window` · 유리 바닥`floor` · 유리창`window` | block-12-15 c14 r13 |
| 405 | 끓어오르는 용암 `lava` | 붉은 카펫 좌측 테두리 `decoration` | 붉은 양탄자 좌측`floor` · 붉은 카펫 좌측 테두리`decoration` · 붉은 양탄자 좌측단`decoration` | block-12-15 c15 r13 |
| 406 | 끓어오르는 용암 `lava` | 붉은 양탄자 중앙 `decoration` | 붉은 양탄자 중앙`floor` · 붉은 카펫 중앙`decoration` · 붉은 양탄자 중앙`decoration` | block-12-15 c16 r13 |
| 407 | 끓어오르는 용암 `lava` | 붉은 카펫 우측 테두리 `decoration` | 붉은 양탄자 우측`floor` · 붉은 카펫 우측 테두리`decoration` · 붉은 양탄자 우측단`decoration` | block-12-15 c17 r13 |
| 408 | 핑크 바탕 갈색 무늬 `decoration` | 큰 갈색 산 좌하단 `cliff` | 큰 산 좌하단`cliff` · 큰 갈색 산 좌하단`cliff` | block-12-15 c18 r13 |
| 409 | 핑크 바탕 암석 무늬 `rock` | 큰 갈색 산 우하단 `rock` | 큰 산 우하단`cliff` · 큰 갈색 산 우하단`cliff` | block-12-15 c19 r13 |
| 410 | 핑크 바탕 틀 구조 `prop` | 원형 석탑 하단 입구 `wall` | 돌 탑 하단`wall` · 원형 석탑 하단 입구`wall` | block-12-15 c20 r13 |
| 411 | 회색 덤불 군락 `plant` | 석조 유적 하단 입구 `prop` | 돌 건물 하단`wall` · 석조 유적 하단 입구`prop` · 석조 유적 하단`prop` | block-12-15 c21 r13 |
| 412 | 푸른 틀 사각 무늬 `prop` | 석조 다리 북단 `stairs` | 석조 다리 북단`stairs` · 세로 석재 다리 상단`floor` · 석조 다리 상단`stairs` | block-12-15 c22 r13 |
| 413 | 어두운 재 무늬 지면 `terrain` | 동굴 입구 `door` | 동굴 입구`door` · 동굴 입구`door` | block-12-15 c23 r13 |
| 414 | 눈 덮인 설원 벽 `snow` | 세로 침대 하단 `furniture` | 침대 하단`furniture` · 세로 침대 하단`furniture` | block-12-15 c24 r13 |
| 415 | 핑크 바탕 흰 언덕 `snow` | 가로 침대 좌측 `furniture` | 가로 침대 좌측`furniture` · 가로 침대 좌측`furniture` | block-12-15 c25 r13 |
| 416 | 흰 눈 벽면 `snow` | 가로 침대 우측 `furniture` | 가로 침대 우측`furniture` · 가로 침대 우측`furniture` | block-12-15 c26 r13 |
| 417 | 핑크 바탕 붉은 기둥 `pillar` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c27 r13 |
| 418 | 붉은 지붕 겹층 `roof` | 피아노 좌측 `furniture` | 피아노 좌측`furniture` · 피아노 좌측`furniture` | block-12-15 c28 r13 |
| 419 | 핑크 바탕 붉은 무늬 `decoration` | 피아노 우측 `furniture` | 피아노 우측`furniture` · 피아노 우측`furniture` | block-12-15 c29 r13 |
| 420 | 초록 초원 표면 `terrain` | 숲 좌측 `tree` | 숲 좌측`tree` · 숲 좌측`tree` | block-12-15 c0 r14 |
| 421 | 푸른 들판 초지 `terrain` | 숲 중앙 `tree` | 숲 중앙`tree` · 숲 중앙`tree` | block-12-15 c1 r14 |
| 422 | 숲 그늘 초지 `forest` | 숲 우측 `forest` | 숲 우측`tree` · 숲 우측`tree` | block-12-15 c2 r14 |
| 423 | 흙길 초원 경계 `path` | 산맥 좌측 `cliff` | 산 좌측`cliff` · 산맥 좌측`cliff` | block-12-15 c3 r14 |
| 424 | 흙길 흐른 지대 `path` | 산맥 중앙 `cliff` | 산 중앙`cliff` · 산맥 중앙`cliff` | block-12-15 c4 r14 |
| 425 | 흙길 모퉁이 `path` | 산맥 우측 `cliff` | 산 우측`cliff` · 산맥 우측`cliff` | block-12-15 c5 r14 |
| 426 | 짙푸른 파도 바다 `water` | 격자 구덩이 벽 좌측 `wall` | 격자 구덩이 벽 좌측`wall` · 석재 난간 좌측`wall` | block-12-15 c6 r14 |
| 427 | 고요한 깊은 바다 `water` | 격자 구덩이 내부 `floor` | 격자 구덩이 내부`floor` · 격자 구덩이 중앙`floor` | block-12-15 c7 r14 |
| 428 | 물결 이는 해안 `coast` | 격자 구덩이 벽 우측 `wall` | 격자 구덩이 벽 우측`wall` · 석재 난간 우측`wall` | block-12-15 c8 r14 |
| 429 | 잔물결 바다 수면 `water` | 어두운 구덩이 좌측 `cliff` | 어두운 구덩이 좌측`cliff` · 암석 구덩이 좌측`cliff` | block-12-15 c9 r14 |
| 430 | 검은 심해 물결 `water` | 어두운 구덩이 내부 `floor` | 어두운 구덩이 내부`floor` · 암석 구덩이 중앙`floor` | block-12-15 c10 r14 |
| 431 | 바다 물결 어둠 `water` | 어두운 구덩이 우측 `cliff` | 어두운 구덩이 우측`cliff` · 암석 구덩이 우측`cliff` | block-12-15 c11 r14 |
| 432 | 황금 무늬 장식 `decoration` | 갈색 기와 지붕 상단 `roof` | 갈색 기와 지붕 상단`roof` · 갈색 기와 지붕 상단`roof` | block-12-15 c12 r14 |
| 433 | 주황 무늬 장식 `decoration` | 붉은 기와 지붕 상단 `roof` | 붉은 기와 지붕 상단`roof` · 붉은 기와 지붕 상단`roof` | block-12-15 c13 r14 |
| 434 | 핑크 바탕 흰 꽃모양 `plant` | 유리창 하단 `window` | 유리창 하단`window` · 유리창`window` | block-12-15 c14 r14 |
| 435 | 활활 타는 용암 `lava` | 붉은 카펫 좌하단 모서리 `decoration` | 붉은 양탄자 좌하단`floor` · 붉은 카펫 좌하단 모서리`decoration` · 붉은 양탄자 좌하단`decoration` | block-12-15 c15 r14 |
| 436 | 활활 타는 용암 `lava` | 붉은 카펫 하단 테두리 `decoration` | 붉은 양탄자 하단`floor` · 붉은 카펫 하단 테두리`decoration` · 붉은 양탄자 하단`decoration` | block-12-15 c16 r14 |
| 437 | 활활 타는 용암 `lava` | 붉은 카펫 우하단 모서리 `decoration` | 붉은 양탄자 우하단`floor` · 붉은 카펫 우하단 모서리`decoration` · 붉은 양탄자 우하단`decoration` | block-12-15 c17 r14 |
| 438 | 핑크 바탕 갈색 덩이 `decoration` | 화산 분화구 좌측 `cliff` | 화산 좌상단`cliff` · 화산 분화구 좌측`cliff` | block-12-15 c18 r14 |
| 439 | 핑크 바탕 회색 무늬 `rock` | 화산 분화구 우측 `rock` | 화산 우상단`cliff` · 화산 분화구 우측`cliff` | block-12-15 c19 r14 |
| 440 | 핑크 바탕 잡석 무늬 `rock` | 성채 좌상단 `wall` | 성 좌상단`wall` · 성채 좌상단`wall` | block-12-15 c20 r14 |
| 441 | 핑크 바탕 돌무더기 `rock` | 성채 우상단 `wall` | 성 우상단`wall` · 성채 우상단`wall` | block-12-15 c21 r14 |
| 442 | 푸른 틀 사각 무늬 `prop` | 석조 다리 교차부 `stairs` | 석조 다리 교차부`stairs` · 세로 석재 다리 중앙`floor` · 석조 다리 중단`stairs` | block-12-15 c22 r14 |
| 443 | 핑크 바탕 짙은 무늬 `decoration` | 석조 다리 가로형 좌측 `stairs` | 수평 석조 다리 우측`stairs` · 가로 석재 다리 상단 난간`wall` · 석조 다리 가로형 좌측`stairs` | block-12-15 c23 r14 |
| 444 | 회백색 돌담 벽 `wall` | 파이프 오르간 파이프 좌측 `furniture` | 파이프 오르간 좌상단`furniture` · 파이프 오르간 파이프 좌측`furniture` | block-12-15 c24 r14 |
| 445 | 회백석 무늬 벽 `wall` | 파이프 오르간 파이프 우측 `furniture` | 파이프 오르간 우상단`furniture` · 파이프 오르간 파이프 우측`furniture` | block-12-15 c25 r14 |
| 446 | 흔들리는 노란 불꽃 `animation` | 붉은 1인용 왕좌 상단 `furniture` | 붉은 1인용 왕좌 상단`furniture` · 붉은색 의자 등받이`furniture` | block-12-15 c26 r14 |
| 447 | 흔들리는 노란 불꽃 `animation` | 빈 슬롯 `empty` | 빈 슬롯`empty` · 빈 슬롯`empty` | block-12-15 c27 r14 |
| 448 | 세차게 타는 불꽃 `animation` | 붉은색 대형 소파 등받이 좌측 `furniture` | 대형 붉은 왕좌 좌상단`furniture` · 붉은색 대형 소파 등받이 좌측`furniture` | block-12-15 c28 r14 |
| 449 | 세차게 타는 불꽃 `animation` | 붉은색 대형 소파 등받이 우측 `furniture` | 대형 붉은 왕좌 우상단`furniture` · 붉은색 대형 소파 등받이 우측`furniture` | block-12-15 c29 r14 |
| 450 | 초록 평야 풀 `terrain` | 숲 좌하단 `tree` | 숲 좌하단`tree` · 숲 좌하단`tree` | block-12-15 c0 r15 |
| 451 | 푸른 초원 바닥 `terrain` | 숲 하단 중앙 `tree` | 숲 하단`tree` · 숲 하단 중앙`tree` | block-12-15 c1 r15 |
| 452 | 숲바닥 초지 `forest` | 숲 우하단 `forest` | 숲 우하단`tree` · 숲 우하단`tree` | block-12-15 c2 r15 |
| 453 | 흙길 초입 지대 `path` | 산맥 좌하단 `cliff` | 산 좌하단`cliff` · 산맥 좌하단`cliff` | block-12-15 c3 r15 |
| 454 | 흙길 넓은 지대 `path` | 산맥 하단 중앙 `cliff` | 산 하단`cliff` · 산맥 하단 중앙`cliff` | block-12-15 c4 r15 |
| 455 | 흙길 트인 길 `path` | 산맥 우하단 `cliff` | 산 우하단`cliff` · 산맥 우하단`cliff` | block-12-15 c5 r15 |
| 456 | 검푸른 바다 파도 `water` | 격자 구덩이 벽 좌하단 `wall` | 격자 구덩이 벽 좌하단`wall` · 석재 난간 좌하단`wall` | block-12-15 c6 r15 |
| 457 | 어두운 바닷물 `water` | 격자 구덩이 벽 하단 `wall` | 격자 구덩이 벽 하단`wall` · 석재 난간 하단`wall` | block-12-15 c7 r15 |
| 458 | 거품 물결 해안 `coast` | 격자 구덩이 벽 우하단 `wall` | 격자 구덩이 벽 우하단`wall` · 석재 난간 우하단`wall` | block-12-15 c8 r15 |
| 459 | 잔잔한 바다 수면 `water` | 어두운 구덩이 좌하단 `cliff` | 어두운 구덩이 좌하단`cliff` · 암석 구덩이 좌하단`cliff` | block-12-15 c9 r15 |
| 460 | 심해 검푸른 물 `water` | 구덩이 하단 `cliff` | 어두운 구덩이 하단`floor` · 암석 구덩이 하단`cliff` · 동굴 벽 하단`wall` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 461 | 바다 어둠 물결 `water` | 어두운 구덩이 우하단 `cliff` | 어두운 구덩이 우하단`cliff` · 암석 구덩이 우하단`cliff` | block-12-15 c11 r15 |
| 462 | 갈색 무늬 장식 `decoration` | 갈색 기와 지붕 하단 `roof` | 갈색 기와 지붕 하단`roof` · 갈색 기와 지붕 하단`roof` | block-12-15 c12 r15 |
| 463 | 주황 무늬 조각 `decoration` | 붉은 기와 지붕 하단 `roof` | 붉은 기와 지붕 하단`roof` · 붉은 기와 지붕 하단`roof` | block-12-15 c13 r15 |
| 464 | 짙회색 무늬 판 `decoration` | 환기구 `prop` | 환기구`floor` · 금속 격자 환기구`prop` · 철창 격자`decoration` | **사람 확정** (adj-world-r0-3-c18-23.png, adj-world-r8-11-c17-26.png, adj-world-r8-11-c6-16.png, fin-world-r1-3-c17-24.png, fin-world-r11-13-c21-25.png, fin-world-r11-13-c7-12.png, fin-world-r14-15-c8-16.png, fin-world-r7-9-c24-28.png) |
| 465 | 불꽃 치솟는 용암 `lava` | 붉은 양탄자 계단 좌측 `stairs` | 붉은 양탄자 계단 좌측`stairs` · 붉은 카펫 계단 좌측`stairs` | block-12-15 c15 r15 |
| 466 | 불꽃 치솟는 용암 `lava` | 붉은 양탄자 계단 중앙 `stairs` | 붉은 양탄자 계단 중앙`stairs` · 붉은 카펫 계단 중앙`stairs` | block-12-15 c16 r15 |
| 467 | 불꽃 치솟는 용암 `lava` | 붉은 양탄자 계단 우측 `stairs` | 붉은 양탄자 계단 우측`stairs` · 붉은 카펫 계단 우측`stairs` | block-12-15 c17 r15 |
| 468 | 핑크 빛 갈색 무늬 `decoration` | 화산 기슭 좌하단 `cliff` | 화산 좌하단`cliff` · 화산 기슭 좌하단`cliff` | block-12-15 c18 r15 |
| 469 | 핑크 빛 잡석 무늬 `rock` | 화산 기슭 우하단 `rock` | 화산 우하단`cliff` · 화산 기슭 우하단`cliff` | block-12-15 c19 r15 |
| 470 | 회색 돌무더기 지대 `rock` | 성채 좌하단 `wall` | 성 좌하단`wall` · 성채 좌하단`wall` | block-12-15 c20 r15 |
| 471 | 어둑한 바위 지대 `rock` | 성채 우하단 `wall` | 성 우하단`wall` · 성채 우하단`wall` | block-12-15 c21 r15 |
| 472 | 푸른 틀 사각 무늬 `prop` | 석조 다리 남단 `stairs` | 석조 다리 남단`stairs` · 세로 석재 다리 하단`floor` · 석조 다리 하단`stairs` | block-12-15 c22 r15 |
| 473 | 핑크 빛 바위 무늬 `rock` | 석조 다리 가로형 우측 `stairs` | 수평 석조 다리 난간`stairs` · 가로 석재 다리 하단 난간`wall` · 석조 다리 가로형 우측`stairs` | block-12-15 c23 r15 |
| 474 | 회갈색 돌벽 무늬 `wall` | 파이프 오르간 건반 좌측 `furniture` | 파이프 오르간 좌하단`furniture` · 파이프 오르간 건반 좌측`furniture` | block-12-15 c24 r15 |
| 475 | 회갈색 벽면 타일 `wall` | 파이프 오르간 건반 우측 `furniture` | 파이프 오르간 우하단`furniture` · 파이프 오르간 건반 우측`furniture` | block-12-15 c25 r15 |
| 476 | 붉은 불꽃 타오름 `animation` | 붉은 1인용 왕좌 하단 `furniture` | 붉은 1인용 왕좌 하단`furniture` · 붉은색 의자 방석`furniture` | block-12-15 c26 r15 |
| 477 | 핑크 빛 붉은 무늬 `decoration` | 붉은색 대형 소파 팔걸이 좌측 `furniture` | 대형 붉은 왕좌 좌하단`furniture` · 붉은색 대형 소파 팔걸이 좌측`furniture` | block-12-15 c27 r15 |
| 478 | 붉은 줄무늬 지붕 `roof` | 붉은색 대형 소파 방석 중앙 `furniture` | 대형 붉은 왕좌 중앙`furniture` · 붉은색 대형 소파 방석 중앙`furniture` | block-12-15 c28 r15 |
| 479 | 핑크 빛 붉은 조각 `decoration` | 붉은색 대형 소파 팔걸이 우측 `furniture` | 대형 붉은 왕좌 우하단`furniture` · 붉은색 대형 소파 팔걸이 우측`furniture` | block-12-15 c29 r15 |

