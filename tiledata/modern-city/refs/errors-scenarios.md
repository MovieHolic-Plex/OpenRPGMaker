# 현대 도시 — 정상/오류 변조 실험 7종

tilesetId `modern_city` · 그림 `public/assets/modern-city/modern-city-chipset.png`(텍스처 `tex_modern_city`, **9998칸**, 16px 칸, 시트 768×3344px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-modern` — 버들항(`oprn-atlas`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

각 실험은 예제 맵의 사본에서 **한 가지만** 바꾸고 검사기를 돌린 결과다(좌표는 모두 맵 칸 좌표, 0 기준). 그림은 왼쪽 정상·오른쪽 오류(원본 ×2 확대), 빨강 테두리 = 오류 칸, 초록 테두리 = 정상일 때 비어 있어야 하는 문 앞 접근 칸.

## E1 — `door-access-blocked`
- 변조: 문 앞 접근 칸에 막히는 소품을 얹었다. 세부: {"kit": "mc-prop-fence-a", "building": "mc-bld-fire-A", "door_access": [6, 11]}
- 검사 결과 코드: {"door-access-blocked": 1} — 기대한 코드가 좌표 [[6, 11]] 에서 검출됨.
- 그림: `mc-img-err-e1-door-access-blocked` (자른 범위 x 1~12, y 5~14).
- 고치는 법: 문 앞 접근 칸에서 소품·차량을 치우거나 한 칸 옮긴다(예제 도시는 5곳을 옮기고 2곳을 뺐다).

## E2 — `back-over-front`
- 변조: 뒷줄 건물과 앞줄 건물의 찍는 순서를 맞바꿨다. 세부: {"back": "mc-bld-dept-C", "front": "mc-bld-shop-B", "overlap": [33, 30, 37, 30]}
- 검사 결과 코드: {"back-over-front": 1} — 기대한 코드가 좌표 [[33, 30]] 에서 검출됨.
- 그림: `mc-img-err-e2-back-over-front` (자른 범위 x 29~40, y 27~36).
- 고치는 법: 겹치는 건물은 뒷줄(발이 위쪽)을 먼저, 앞줄을 나중에 찍는다(배치 목록 순서를 고친다).

## E3 — `marking-in-intersection`
- 변조: 교차로 중심 6×6 안에 노란 중앙선 칸을 얹었다. 세부: {"tile": 25}
- 검사 결과 코드: {"marking-in-intersection": 1} — 기대한 코드가 좌표 [[25, 17]] 에서 검출됨.
- 그림: `mc-img-err-e3-marking-in-intersection` (자른 범위 x 19~30, y 12~21).
- 고치는 법: 교차로 중심 6×6 안의 중앙선 칸을 지운다. 구간은 횡단보도 바깥에서 끝낸다.

## E4 — `tall-prop-on-road`
- 변조: 키 큰 소품(가로등류)을 도로 한가운데 발밑에 세웠다. 세부: {"kit": "mc-prop-lamp-a"}
- 검사 결과 코드: {"tall-prop-on-road": 1} — 기대한 코드가 좌표 [[25, 29]] 에서 검출됨.
- 그림: `mc-img-err-e4-tall-prop-on-road` (자른 범위 x 19~30, y 22~31).
- 고치는 법: 가로등·신호등·전신주·가로수는 보도·공원에 둔다.

## E5 — `building-in-lower-layer`
- 변조: 건물 벽 칸 하나를 3층 대신 1층에 찍었다. 세부: {"building": "mc-bld-shop-B", "tile": 1235}
- 검사 결과 코드: {"layer-mismatch": 1, "building-in-lower-layer": 1} — 기대한 코드가 좌표 [[34, 32]] 에서 검출됨.
- 그림: `mc-img-err-e5-building-in-lower-layer` (자른 범위 x 30~41, y 28~37).
- 고치는 법: 건물·소품 칸은 3층(upperTiles)에 둔다. 1층엔 땅만.

## E6 — `overlay-in-base-layer`
- 변조: 투명 중앙선 칸을 2층 대신 1층에 찍었다(아래 아스팔트가 사라져 검게 보인다). 세부: {"tile": 25}
- 검사 결과 코드: {"overlay-in-base-layer": 1} — 기대한 코드가 좌표 [[4, 17]] 에서 검출됨.
- 그림: `mc-img-err-e6-overlay-in-base-layer` (자른 범위 x 0~11, y 12~21).
- 고치는 법: 도로 표시·그림자는 2층(lowerOverlayTiles)에 둔다. 1층엔 불투명 땅만(투명 칸을 1층에 두면 아래 땅이 없어 검게 보인다).

## E7 — `curb-mismatch`
- 변조: 가로 도로 북쪽 연석 칸을 반대 방향(북쪽이 도로) 연석으로 바꿨다. 세부: {"tile": 10, "expected": 9}
- 검사 결과 코드: {"curb-mismatch": 1} — 기대한 코드가 좌표 [[10, 14]] 에서 검출됨.
- 그림: `mc-img-err-e7-curb-mismatch` (자른 범위 x 4~15, y 9~18).
- 고치는 법: 연석을 낱칸으로 깔았다면 도로가 있는 쪽 이름(「~쪽이 도로」)을 맞춘다. 가능하면 오토타일 `mc-sidewalk-curb` 로 칠한다.

## 이 실험이 다루지 않는 오류
- 정지선·횡단보도·화살표 칸의 위치 오류, 소품끼리 겹침, 그림자 위치 — 구조 검사 항목이 아니다(예제에서는 규칙 재계산으로 어긋남 0 확인). 잘린 뿌리·빠진 줄기·반대 외곽은 숲 계열 용어로, 이 도시 칩셋에는 해당 소재(나무 키트는 소품 1개 키트)가 없다.
