# 실내 벽 프레임 / “천장” 오토타일 계약 수정 계획

- 작성 기준: 2026-07-15 케이스 PNG와 현재 워크트리의 코드
- 대상 칩셋: `easyrpg_chipset_interior`
- 선택안: **Option B — 주택은 크림 셸 문법 우선, 오토타일은 어두운 벽 `366` 전용**
- 이 문서는 구현 계획이다. 코드·타일셋·LegacyDb 데이터는 이 단계에서 변경하지 않는다.

## 0. 결론

현재 문제는 한 장의 칩셋을 재사용하는 것 자체가 아니라, 같은 숫자 ID를 다음 세 종류의 **저장 의미**로 동시에 해석하는 데 있다.

1. `105`를 몸통으로 하는 저장 오토타일
2. `396–458`을 소스로 하는 RM2k3식 8×8 쿼터 렌더
3. `74–107` 크림 벽면과 `396/397/398` 문 알코브를 직접 저장하는 주택 셸

목표 계약은 다음처럼 한 방향으로 만든다.

- 주택 셸은 오토타일을 거치지 않고, 픽셀이 완성된 **통타일**을 최종 `lowerTiles`에 직접 기록한다.
- 어두운 벽은 모든 벽 셀을 의미 타일 `366` 하나로 저장하고, 렌더 시에만 `368`, `396–398`, `426–428`, `456–458`의 쿼터를 샘플링한다.
- 렌더 소스 ID는 아틀라스 좌표일 뿐이다. `memberTileIds`, `triggerTileIds`, 맵 저장 결과로 사용하지 않는다.
- `233/258`은 실제로 핑크 플레이스홀더이고 `257`도 프레임 받침 아트가 아니므로 벽 계약에서 제거한다.
- 기존 프로젝트의 임의 타일 배열을 전역 치환하지 않는다. 구 계약은 명시적인 레거시 읽기 경계에만 격리하고, 알려진 생성 맵은 재생성·LegacyDb 저장·재로드 후 구 그룹을 제거한다.

## 1. Vision findings — 코드보다 먼저 확인한 픽셀 사실

### 1.1 `case_chipset_3x4_autotile_block.png`

- 3열×4행의 어두운 체크 무늬 블록이다.
- 첫 행은 완성된 사각 프레임이 아니라 고립 프리뷰와 작은 조인트/오목 코너 조각처럼 보인다.
- 아래 3행은 하나의 완성된 3×3 사각 프레임을 이룬다. 가운데 `427`은 테두리가 없는 어두운 체크 몸통이고, 외곽 셀에 회녹색 금속/석재 선이 들어 있다.
- 픽셀 방향은 명확하다.

| ID | 실제 보이는 선 |
|---:|---|
| `396` | 위 + 왼쪽 |
| `397` | 위 |
| `398` | 위 + 오른쪽 |
| `426` | 왼쪽 |
| `427` | 없음, 어두운 몸통 |
| `428` | 오른쪽 |
| `456` | 아래 + 왼쪽 |
| `457` | 아래 |
| `458` | 아래 + 오른쪽 |

### 1.2 `case_3x3_body_for_quarters.png`

- `396–458`의 3×3을 그대로 붙이면 끊김 없는 사각 프레임이 된다.
- 따라서 이 9개는 쿼터를 잘라 쓰기에 좋은 **픽셀 소스 세트**다.
- 이 이미지 자체에는 `edgeN`, `edgeS`, `doorStep` 같은 저장 의미가 없다. 보이는 것은 선이 어느 변에 놓였는지뿐이다.

### 1.3 `case_role_cards.png` / `case_role_strip.png`

- `105`는 어두운 프레임 몸통이 아니라 무늬가 약한 크림 회벽이다.
- `457`은 아래쪽 가로선, `397`은 위쪽 가로선이다.
- `428`은 오른쪽 세로선, `426`은 왼쪽 세로선이다.
- `233`과 `258`은 코너 아트가 아니라 불투명한 선홍색/핑크 사각형이다.
- `456/458`은 아래쪽 코너, `396/398`은 위쪽 코너로 실제 프레임 픽셀이 있다.
- 역할 스트립은 크림 회벽, 어두운 프레임, 핑크 플레이스홀더, 벽돌 면이 한 “오토타일” 역할 목록에 섞여 있음을 시각적으로 드러낸다.

### 1.4 `case_ring_body_105_only.png`

- 가운데 3×3 갈색 벽돌/바닥을 둘러싼 1칸 링이 전부 크림색이다.
- `105`만으로는 금속/석재 프레임 선이 전혀 생기지 않는다.
- 즉 `105`는 시각적으로 “프레임 오토타일 몸통”이 아니라 주택 회벽 면이다.

### 1.5 `case_ring_edge_corner_labels.png`

- 위쪽 두 코너가 핑크로 노출된다. `233/258`을 저장 코너로 쓰는 순간 렌더 보정이 빠진 경로에서 바로 깨진다.
- 위·아래·좌·우 변의 프레임 선은 가운데 벽돌을 향하지만, 현재 아래 코너 `456/458`은 그 내부 프레임과 자연스럽게 이어지지 않고 바깥쪽 아래/좌우에 선을 낸다.
- 현재 역할 이름의 코너 방향과 실제 픽셀 방향이 일치하지 않는 증거다.

### 1.6 `case_cream_north_face_2row.png`

- 위에는 어두운 공허 띠가 있고, 그 아래에 밝은 크림 상단 행과 약간 더 짙은 크림 하단 행이 두 줄로 이어진다.
- 좌우 끝은 갈색 목재 세로 마감이고, 아래에는 갈색 벽돌/바닥 행이 붙는다.
- 이 아트는 연속된 주택 정면 벽 문법이며, 어두운 3×4 블록을 쿼터 합성한 모습이 아니다.

### 1.7 `case_door_alcove_398_396_397.png`

- 문 개구부의 서쪽 어깨 `398`은 위+오른쪽 선, 동쪽 어깨 `396`은 위+왼쪽 선을 가져 개구부 안쪽을 감싼다.
- 아래 중앙의 `397`은 위쪽 선이 있는 문턱/계단으로 자연스럽게 읽힌다.
- `398 | floor | 396`과 그 아래 `397`은 **완성된 문 알코브 통타일 문법**으로는 시각적으로 일관된다.

### 1.8 `case_conflict_397_edgeS_vs_doorStep.png`

- 동일한 `397` 픽셀은 언제나 타일 위쪽에 가로선을 낸다.
- 이미지에서 위쪽 프레임과 아래쪽 문턱에 같은 모티프가 반복된다. 픽셀 자체가 `edgeS`와 `doorStep` 두 의미를 구분해 주지 않는다.
- 문제는 픽셀 재사용보다 저장 오토타일이 이를 `edgeS`로 분류하고, 쿼터 렌더는 다시 `Q_EDGE_N`으로 분류하는 반대 좌표계다.

### 1.9 `case_1col_pillar_posts.png`

- 한 열 안에서 `426`의 왼쪽 선과 `428`의 오른쪽 선을 절반씩 합성하면 양쪽 선이 있는 가는 포스트가 된다.
- 상단의 핑크 셀은 `233/258` 원시 픽셀을 코너/조인트로 저장하는 방식이 안전하지 않음을 다시 보여 준다.
- 이 합성은 어두운 벽 렌더에는 유용하지만, 크림 주택 칸막이가 반드시 같은 렌더 경로를 타야 한다는 뜻은 아니다.

### 1.10 `case_cream_solo_partition_77_107.png`

- 두 줄 높이의 크림 벽면에 갈색 세로 기둥이 양쪽으로 보이고, 아래는 갈색 바닥/벽돌 행이다.
- `77/107`은 1칸 폭 칸막이를 위해 이미 좌우 마감이 포함된 완성 타일이다.
- 이 자리를 `105` 몸통 한 열로 덮으면 이미지의 목재 경계가 사라진다.

### 1.11 `case_gold_brick_face_retint.png` / `case_stone_brick_face_retint.png`

- 위 두 행은 각각 자주·금장 벽돌 또는 밝은 회색 석재 벽돌의 완성된 벽면이고, 아래 행은 갈색 바닥/벽돌이다.
- 어두운 체크 프레임 픽셀이 없으며, 쿼터가 아니라 통타일로 렌더해야 한다.
- 기존 “크림 면을 완성한 뒤 재질만 리틴트”라는 방향은 유지할 수 있다.

### 1.12 `chipset_highlight_key_tiles.png`

- 어두운 3×4 프레임 블록은 시트 좌하단의 한 덩어리로 존재한다.
- 크림 회벽 세트는 시트 중앙 상단에 별도 2행 세트로 존재한다.
- `233/258`에 해당하는 핑크 셀은 가구/투명 배경 영역에 떨어져 있으며, 정상 프레임 코너 세트의 일부처럼 보이지 않는다.
- 따라서 “한 ID 연속 범위 = 한 저장 문법”이라고 가정하면 안 된다.

## 2. 현재 계약 지도

| 계층 | 현재 정본/함수 | 현재 사용하는 ID | 현재 의미 |
|---|---|---|---|
| 저장: 주택 벽 프레임 그룹 | `INTERIOR_WALL_FRAME_TILES`, `createInteriorWallFrameAutotileGroup` | 몸통 `105`; 변 `457/397/428/426`; 코너 `233/258/456/458`; 렌더용이라면서 멤버에 `368`도 포함 | `shapeAutotileGroupAround`가 맵의 저장 타일을 다시 쓴다. 크림 면·문 타일·바닥/러그는 connect 전용이다. |
| 저장: 어두운 벽 그룹 | `DARK_WALL_TILE`, `createDarkWallAutotileGroup` | 몸통 `366`; 9종 출력 `366/367/427/396/398/368/369/426/428`; 추가 멤버에 `397/456/457/458` 등 | `366` 브러시가 4이웃 결과에 따라 여러 숫자로 바뀐다. |
| 렌더: 쿼터 합성 | `interiorWallFrameQuarterComposition` | 중심 게이트: 광범위한 dark-mass(`366–461`, `430`, `233/257/258`, `116/146`); 소스: 중심 `427`, 오목 `368`, 변 `426/428/397/457`, 코너 `396/398/456/458` | 저장 타일과 이웃을 다시 해석해 8×8 쿼터를 덮는다. 주택 그룹이 시드돼 있어야 어두운 벽 렌더도 켜진다. |
| 셸: 초벌 | `paintHouseShellWalls` | `105` | 바닥 4인접 링과 북벽 확장 셀을 전부 `105`로 칠한 뒤 주택 벽 프레임 그룹으로 성형한다. |
| 셸: 결정적 덮어쓰기 | `HOUSE_WALL_FACE`, `paintHouseShellWalls` | 크림 `74/75/76`, `104/105/106`, `77/107`; 캡 `457`; 포스트 `428/426`; 남측 트림 `397` | 오토타일 결과가 문법과 어긋나는 곳을 다시 통타일로 강제한다. |
| 문 알코브 | `HOUSE_WALL_FACE.DOOR_*` | 서 플랭크 `398`, 동 플랭크 `396`, 계단 `397`, 받침 `257` | 남문과 수평 내부 문을 직접 덮어쓴다. `397`은 저장 그룹 `edgeS`이기도 하다. |
| 파티션 후처리 | `paintRoomPartitionWalls` | `105` | `paintHouseShellWalls`가 끝난 뒤 인접 방 경계의 바닥을 `105`로 바꾼다. 크림 2단/`77/107` 마감과 쿼터 성형을 다시 실행하지 않는다. |
| 리틴트 | `WALL_FACE_RETINT`, `applyWallMaterial` | 금장 `314–316/344–346`, 석재 `134–136/164–166` | 크림 면만 다른 완성 벽면으로 치환한다. 렌더 중심 게이트 밖이지만 이웃 mass에는 포함한다. |

## 3. 충돌 목록 — 심각도 순

### P0-1. 저장 의미가 하나가 아니다

- `397`: 저장 `edgeS` + 렌더 `Q_EDGE_N` + 남측 트림 + 문 계단
- `396/398`: 어두운 벽 저장 변 + 렌더 볼록 코너 + 주택 문 플랭크
- `105`: 주택 회벽 하단 가운데 + 저장 오토타일 몸통/브러시
- 한 셀의 숫자만으로는 어느 계층의 의도인지 복원할 수 없다. 편집·재성형·렌더 중 어느 경로가 먼저 오느냐에 따라 결과가 달라진다.

### P0-2. `233/258/257`의 원시 픽셀이 계약과 다르다

- `233/258`은 실제 프레임 코너가 아니라 핑크 플레이스홀더다.
- `257`은 어두운 녹회색 질감이지 문 기둥 받침 프레임이 아니다.
- 현재 렌더는 이들을 “라벨 타일”로 간주해 원시 픽셀을 숨긴다. 그룹 게이트가 빠지거나 plain fallback이 나면 즉시 잘못된 픽셀이 노출된다.

### P1-1. N/S 및 E/W 이름이 3×3 픽셀 방향과 반대다

- 저장 `edgeN=457`이지만 `457`의 실제 선은 아래쪽이다.
- 저장 `edgeS=397`이지만 `397`의 실제 선은 위쪽이다.
- 저장 `edgeW=428`은 실제 오른쪽 선이고, `edgeE=426`은 실제 왼쪽 선이다.
- “결손 방향”, “링에서의 위치”, “픽셀 선 방향”이 한 이름 공간에 섞였다.

### P1-2. 렌더 활성화가 잘못된 그룹에 결합돼 있다

- `interiorWallFrameQuarterComposition`은 `INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID`가 있어야 실행된다.
- 실제 합성 대상은 어두운 벽인데 주택 벽 프레임 그룹의 존재가 기능 스위치다.
- 주택 그룹을 제거하면 어두운 벽도 꺼지고, 그룹을 유지하면 문·포스트·공허까지 합성 대상이 된다.

### P1-3. 주택 모서리가 저장되지 않고 렌더 누출에 의존한다

- 남쪽 대각 코너는 `430` 공허로 남긴 뒤 인접 셀 렌더가 `368` 쿼터를 흘려 넣는다.
- 북쪽 캡 끝은 `233/258` 라벨을 저장한 뒤 렌더가 다른 픽셀로 가린다.
- 주택 결과를 JSON, 미리보기, 썸네일, 다른 렌더러가 읽을 때 동일한 외형을 보장하지 못한다.

### P1-4. 파티션이 최종 문법 이후에 `105` 몸통만 칠한다

- `applyInteriorRoomLayer(..., "walls")`는 `paintHouseShellWalls` 후 `paintRoomPartitionWalls`를 호출한다.
- 후처리된 경계는 `77/107`, 포스트, 트림, 코너 결정을 거치지 않는다.
- 특히 gapless 방 경계는 바닥 한 열을 빼앗은 뒤 회벽 몸통으로만 남는다.

### P2-1. 4이웃 저장 variant가 RM2k3 쿼터 문제를 충분히 표현하지 못한다

- 한 줄/한 열 링은 두 방향이 동시에 비어 있는데 `buildEdgeCornerVariantMap`은 우선순위 한 개의 통타일만 고른다.
- 이후 쿼터 렌더가 이를 다시 쪼개 보정한다. 저장 variant와 최종 화면 사이에 불필요한 두 번째 추론이 생긴다.

### P2-2. 동일 계약이 여러 상수와 주석으로 중복된다

- `INTERIOR_HOUSE_SHELL_CREAM_FACE`, `HOUSE_WALL_FACE`, `VR`, 쿼터 소스 상수가 같은 ID를 서로 다른 이름으로 반복한다.
- `INTERIOR_ROOM_FACE_ROWS`의 deprecated 주석처럼 현재 동작과 반대인 설명도 남아 있다.
- OpenWiki 역시 `233/258` 조인트와 `430` 코너 렌더 의존을 정상 규칙으로 기록하고 있다.

## 4. 목표 아키텍처

### 4.1 선택: Option B

**주택은 shell-first cream grammar, 오토타일은 어두운 벽 `366`에만 적용한다.**

선택 이유:

- Vision에서 주택의 핵심 아트는 `74–77/104–107`의 2행 회벽과 1칸 칸막이로 분명히 독립돼 있다.
- `105`는 눈으로 보아 크림 회벽이므로 이를 어두운 프레임의 범용 몸통으로 유지할 근거가 없다.
- `396–458` 3×3은 RM2k3 쿼터 소스로 완성도가 높으므로 어두운 벽 렌더에만 쓰면 된다.
- Option A를 주택에 적용하면 크림 2단, 리틴트, 문 알코브를 다시 예외 덮어쓰기로 남겨 현재 문제를 반복한다.
- Option C처럼 새 atlas ID를 추가할 필요가 없다. 기존 3×3의 실제 선 방향을 주택 통타일 배치와 렌더 샘플링에서 각각 명시하면 된다.

### 4.2 불변식

1. 새 주택 생성 경로는 `shapeAutotileGroupAround`를 호출하지 않는다.
2. 새 주택 맵에는 `233`, `258`, `257`을 벽/문 목적으로 기록하지 않는다.
3. 새 어두운 벽 맵은 벽 셀을 `366`으로만 저장한다.
4. `DARK_WALL_QUARTER_SOURCE`의 ID는 소스 atlas 좌표로만 사용하며 저장 그룹 멤버/트리거/variant 출력에 넣지 않는다.
5. `397`, `396`, `398`, `426`, `428`, `456`, `457`, `458`을 중심 타일로 둔 주택 셀은 쿼터 합성하지 않는다.
6. `430` 공허 셀은 쿼터 합성 중심이 아니다. 필요한 주택 모서리는 실제 코너 통타일로 저장한다.
7. 파티션 셀은 셸 역할 계산 전에 확정하며, 최종 셸 뒤에 `105`를 덮는 후처리를 두지 않는다.

### 4.3 주택 셸 — 결정적 통타일 문법

새 정본은 예를 들어 `HOUSE_SHELL_TILE` 한 곳에 둔다. 이름은 variant 결손 방향이 아니라 **배치 역할**을 나타낸다.

| 주택 역할 | 저장 ID | 픽셀 근거 |
|---|---:|---|
| 북벽 크림 상단 L/M/R | `74/75/76` | 2행 회벽의 밝은 상단 |
| 북벽 크림 하단 L/M/R | `104/105/106` | 2행 회벽의 걸레받이/하단 |
| 1칸 칸막이 상/하 | `77/107` | 양쪽 목재 마감이 들어 있는 완성 타일 |
| 북쪽 캡 직선 | `457` | 아래쪽 선이 회벽을 향함 |
| 북서 캡 조인트 | `458` | 아래+오른쪽 선이 캡과 서쪽 포스트를 이음 |
| 북동 캡 조인트 | `456` | 아래+왼쪽 선이 캡과 동쪽 포스트를 이음 |
| 서쪽 포스트 | `428` | 오른쪽 선이 방 안쪽을 향함 |
| 동쪽 포스트 | `426` | 왼쪽 선이 방 안쪽을 향함 |
| 남쪽 트림/문턱 직선 | `397` | 위쪽 선이 바닥/개구부를 향함 |
| 남서 외곽 코너 / 문 서 플랭크 | `398` | 위+오른쪽 선이 방/문 안쪽을 향함 |
| 남동 외곽 코너 / 문 동 플랭크 | `396` | 위+왼쪽 선이 방/문 안쪽을 향함 |
| 공허 | `430` | 프레임이 필요 없는 실제 빈 영역만 사용 |

`397`을 남측 트림과 문턱에 함께 쓰는 것은 허용한다. 두 위치 모두 “위쪽 선으로 바닥/개구부 경계를 표시한다”는 동일한 가시 역할이기 때문이다. 금지할 것은 `397`을 다시 저장 오토타일 `edgeS`로 해석하는 일이다.

### 4.4 어두운 벽 — 단일 저장 마스크 + 순수 쿼터 렌더

- 저장 타일: `366` 하나
- 렌더 중심: `centerTile === 366`인 셀만
- 렌더 소스:

| 소스 역할 | ID |
|---|---:|
| 중앙 몸통 | `427` |
| 오목 코너 | `368` |
| 위/아래 선 | `397/457` |
| 왼쪽/오른쪽 선 | `426/428` |
| 위+왼쪽 / 위+오른쪽 | `396/398` |
| 아래+왼쪽 / 아래+오른쪽 | `456/458` |

렌더 함수는 저장 타일 최적화 때문에 일부 쿼터를 생략하지 않는다. `427`을 underlay로 두고 네 쿼터의 소스를 항상 명시해, 저장 ID가 화면에 새어 나오지 않게 한다.

어두운 mass 판정은 별도 상수로 제한한다. 새 경로에서는 `366`과 실제 dark void로 인정한 ID만 mass이며, 크림/금장/석재 면과 주택 프레임 통타일은 중심·mass 양쪽에서 제외한다. 구 `233/257/258` 라벨 예외와 house-specific `dualRoomPartition`, `southIsDualPost` 분기는 삭제한다.

### 4.5 레거시 읽기 경계

숫자만 저장된 옛 맵은 `397`이 집인지 어두운 벽인지 전역 치환으로 판별할 수 없다. 따라서 다음 순서를 지킨다.

1. 새 blank/default tileset에는 구 `wall-frame-autotile` 그룹을 시드하지 않는다.
2. 옛 저장 프로젝트에 그 그룹 ID가 이미 있으면 이를 **레거시 판별 표식**으로만 읽는다.
3. 기존 `interiorWallFrameQuarterComposition`은 `legacyInteriorWallFrameQuarterComposition`으로 격리하고, 표식이 있는 미마이그레이션 프로젝트에서만 사용한다. 새 생성/편집 경로에서는 호출하지 않는다.
4. 알려진 `villager-room-v1` 맵은 원래 plan으로 walls 레이어를 재생성한다. 어두운 벽 전용 맵은 구 dark-wall member를 `366`으로 축약한다.
5. 변환 후 구 그룹을 제거하고 저장한다. 원격 콘텐츠라면 LegacyDb project id로 save 후 reload까지 확인한다.
6. 출처를 판별할 수 없는 사용자 맵은 자동 치환하지 않고 map id와 좌표를 lint로 보고한다. 명시적 `house`/`dark` 모드를 선택해 변환할 때까지 레거시 읽기 경계를 유지한다.

이 경계는 영구 writer가 아니다. 어떠한 새 페인트/생성 함수도 레거시 variant를 기록해서는 안 된다.

## 5. 구 역할 → 새 역할 리맵

새 atlas ID는 추가하지 않는다.

| 구 ID/역할 | 새 저장 역할 | 새 렌더 역할 | 처리 |
|---|---|---|---|
| `105` wall-frame body | 크림 하단 M `105` | 없음 | 주택 오토타일 멤버/브러시에서 제거 |
| `74/75/76` | 크림 상단 L/M/R 유지 | 없음 | 주택 셸 전용 |
| `104/106` | 크림 하단 L/R 유지 | 없음 | companion 개념 제거, 주택 셸 전용 |
| `77/107` | 1칸 칸막이 상/하 유지 | 없음 | 파티션 최종 출력으로 직접 저장 |
| `457 edgeN` | 북쪽 캡 직선 `457` | 아래 선 source `457` | 저장 오토타일 역할 제거 |
| `397 edgeS` | 남쪽 트림/문턱 `397` | 위 선 source `397` | dark 저장 variant에서 제거 |
| `428 edgeW` | 서쪽 포스트 `428` | 오른쪽 선 source `428` | 이름을 배치/픽셀 방향으로 분리 |
| `426 edgeE` | 동쪽 포스트 `426` | 왼쪽 선 source `426` | 이름을 배치/픽셀 방향으로 분리 |
| `233 cornerNW` | 사용 금지 | 없음 | 북서 캡 조인트를 `458`로 교체 |
| `258 cornerNE` | 사용 금지 | 없음 | 북동 캡 조인트를 `456`으로 교체 |
| `456 cornerSW` | 북동 캡 조인트 `456` | 아래+왼쪽 corner source | 실제 픽셀 방향으로 재배치 |
| `458 cornerSE` | 북서 캡 조인트 `458` | 아래+오른쪽 corner source | 실제 픽셀 방향으로 재배치 |
| `398` dark edge / door west | 남서 외곽 코너·문 서 플랭크 `398` | 위+오른쪽 corner source | 새 dark 저장값으로는 쓰지 않음 |
| `396` dark edge / door east | 남동 외곽 코너·문 동 플랭크 `396` | 위+왼쪽 corner source | 새 dark 저장값으로는 쓰지 않음 |
| `257` door post base / label | 벽 역할 없음; 주변은 `430` 유지 | 없음 | 원래 질감 자산으로 환원, 라벨 예외 제거 |
| `430` 렌더 중심 void | 실제 공허 `430` | 중심 합성 없음 | 주택 남쪽 코너를 `398/396`으로 직접 저장 |
| `366` dark body | 어두운 벽의 유일한 저장 마스크 `366` | 렌더 중심 | 유지 |
| `367/368/369/427` 및 구 dark variant | 새 저장 없음 | `368/427`만 source | 레거시 dark 변환 시 `366`으로 축약 |

## 6. 구현 순서

### Wave 1 — 픽셀 계약을 테스트로 고정

파일:

- `test/interiorWallFrameQuarterComposition.test.ts`
- `test/interiorAutotile.test.ts`
- `test/interiorRoomPipeline.test.ts`
- `test/darkWallAutotile.test.ts`
- `test/tilesetHarness.test.ts`

작업:

1. 기존 테스트를 바로 수정하지 말고 새 목표 테스트를 먼저 추가해 현재 코드에서 실패함을 확인한다.
2. `397=위 선`, `457=아래 선`, `426=왼쪽`, `428=오른쪽`, 네 코너의 실제 픽셀 방향을 데이터 계약으로 고정한다.
3. 새 blank project가 주택 wall-frame 그룹을 시드하지 않고 dark `366` 그룹만 시드해야 한다는 테스트를 추가한다.
4. 새 dark group의 `memberTileIds`, `triggerTileIds`, 모든 `variantMap` 출력이 `366`뿐이어야 한다는 테스트를 추가한다.
5. `397/396/398/426/428/430/105` 중심의 주택 셀이 쿼터 합성 `null`을 반환하는 음성 테스트를 추가한다.

완료 기준:

- 새 테스트가 현재 구현에서 저장 그룹 중복, 핑크 코너, house quarter 합성 때문에 올바른 이유로 실패한다.

### Wave 2 — 상수와 tileset metadata 계약 분리

파일:

- 새 파일 `src/project/defaults/interiorHouseWallTiles.ts`
- `src/project/tilesetHarness/themePacks.ts`
- `src/project/tilesetHarness.ts`
- `src/project/defaults/darkWallAutotile.ts`

작업:

1. `HOUSE_SHELL_TILE`을 새 파일의 단일 정본으로 만들고, 위 리맵 표의 배치 역할 이름을 사용한다.
2. `INTERIOR_WALL_FRAME_TILES`, `INTERIOR_WALL_FRAME_COMPANION_TILE_IDS`, `INTERIOR_WALL_FRAME_FLOOR_TILES`, `createInteriorWallFrameAutotileGroup`의 새 writer 사용을 제거한다.
3. `seedInteriorWallFrameAutotileGroup`을 새 프로젝트 시드 경로에서 제거한다.
4. `INTERIOR_METADATA_PACK_VERSION`을 올리고 `wall-cream`/`dark-zone` 설명을 새 계약으로 갱신한다.
5. `createDarkWallAutotileGroup`은 `366`만 member/trigger로 갖고 모든 mask가 `366`을 반환하게 한다. `connectTileIds`에 주택/바닥 타일을 넣지 않는다.
6. `INTERIOR_DARK_WALL_AUTOTILE_GROUP_ID`와 실제 dark group ID를 하나의 정본으로 통일한다.
7. 사용자 정의 autotile group은 그대로 보존한다. 제거 대상은 정확히 구 built-in wall-frame group ID뿐이다.

완료 기준:

- blank project의 interior tileset에는 dark `366` 그룹과 기존 terrain 그룹만 있고, 주택 wall-frame 그룹이 없다.
- `105`, `397`, `396`, `398`, `426`, `428`, `456`, `457`, `458`은 dark group의 저장 member/variant가 아니다.

### Wave 3 — 어두운 벽 렌더를 독립시킴

파일:

- `src/project/defaults/interiorWallFrameQuarter.ts` → `src/project/defaults/interiorDarkWallQuarter.ts`로 역할 변경/이름 변경
- `src/project/defaults/terrainQuarterAutotile.ts`
- `src/editor/tilesetImage.ts`는 게이트 회귀만 확인하고 필요 없으면 수정하지 않음

함수:

- `interiorWallFrameQuarterComposition` → `interiorDarkWallQuarterComposition`
- `chipsetQuarterComposition`

작업:

1. 활성화 조건을 주택 그룹 ID가 아니라 interior texture + dark group ID로 바꾼다.
2. 중심 게이트를 `366`으로 제한한다.
3. `INTERIOR_DARK_MASS_TILES`, `INTERIOR_WALL_FACE_TILES`, 라벨 세트와 house-specific 예외 분기를 제거한다.
4. 네 쿼터를 항상 명시하고 `427` underlay를 사용한다.
5. `430` 또는 주택 프레임 타일에서 주변 픽셀이 새어 나오는 경로를 없앤다.
6. 구 프로젝트 읽기용 함수가 필요하면 `legacyInteriorWallFrameQuarter.ts`에 그대로 격리하고 구 그룹 표식이 있을 때만 후순위 dispatch한다.

완료 기준:

- `366` 배열의 1점, 1행, 1열, L자, 3×3, 오목 코너가 예상 쿼터 네 개를 반환한다.
- 동일한 이웃 배치라도 중심이 `397` 문턱 또는 `428` 주택 포스트면 plain 통타일이다.

### Wave 4 — 주택 셸을 한 번에 결정하는 문법으로 교체

파일:

- 새 파일 `src/editor/interiorHouseWallGrammar.ts`
- `src/editor/interiorRoomPipeline.ts`

권장 순수 경계:

- `planInteriorHouseWalls(input: InteriorHouseWallInput): readonly HouseWallPlacement[]`
- `paintInteriorHouseWalls(map, placements): void`

작업:

1. floor mask, `rooms`, 외부 `door`, `innerDoors`를 입력으로 먼저 벽/파티션/개구부 topology를 계산한다.
2. gapless 좌우/상하 인접 방의 파티션 셀을 **셸 출력 전에** 예약한다. 기존 `paintRoomPartitionWalls`의 walls 이후 호출을 삭제한다.
3. 북벽 크림 2행, `77/107` 1열 파티션, 깊은 포스트, 캡, 남측 트림, 문을 역할별 placement로 산출한다.
4. 북서/북동 캡 조인트는 `458/456`, 남서/남동 외곽 코너는 `398/396`을 직접 기록한다.
5. 문 아래는 중앙 `397`만 기록하고 좌우 `257` 쓰기를 제거해 실제 공허 `430`을 유지한다.
6. `paintHouseShellWalls`에서 `105` 초벌 링과 `shapeAutotileGroupAround(createInteriorWallFrameAutotileGroup())` 호출을 삭제한다.
7. `HOUSE_WALL_FACE`와 `INTERIOR_HOUSE_SHELL_CREAM_FACE` 중복을 `HOUSE_SHELL_TILE` import로 치환한다.
8. `houseShellWallMembers`는 완성 셸 타일 + 리틴트 면만 반환한다. render-only/legacy label은 넣지 않는다.
9. 기존 `WALL_FACE_RETINT`은 크림 2행과 `77/107` 대응을 유지하고 프레임/문 타일은 리틴트하지 않는다.

완료 기준:

- 동일 plan은 항상 동일한 완성 타일 grid를 만든다.
- walls 레이어 이후 `105`는 정상 크림 하단 M 위치에만 존재한다.
- `233/258/257`과 “코너로 쓰인 `430`”이 새 주택 결과에 없다.

### Wave 5 — 레거시 진단과 원격 콘텐츠 전환

파일:

- 새 파일 `src/project/defaults/legacyInteriorWallContract.ts` 또는 동등한 좁은 모듈
- 필요 시 프로젝트별 기존 build script; 범용 임시 스크립트를 제품 코드에 남기지 않음
- 관련 persistence/load 테스트

작업:

1. `findLegacyInteriorWallContract(project)`가 구 그룹 ID와 의심 타일의 map id/좌표를 읽기 전용으로 보고하게 한다.
2. dark로 명시된 맵은 구 dark member 셀을 `366`으로 축약하는 순수 변환을 제공한다.
3. house로 명시된 `villager-room-v1` 맵은 타일 추측 변환 대신 원래 `InteriorRoomPlan`으로 walls를 재생성한다.
4. 모드를 판별할 수 없는 맵은 자동 변경하지 않고 실패 보고한다.
5. 실제 데모/프로젝트 맵을 바꾸는 실행 단계에서는 먼저 LegacyDb URL/anon key/project id를 확인한다.
6. 원격 저장이 켜진 실제 프로젝트를 load → 변환/재생성 → `saveProjectToLegacyDb` 또는 팀의 force-save 경로 → 같은 project id로 reload한다.
7. reload한 데이터에서 구 wall-frame group과 `233/258/257` 벽 사용이 없음을 확인한다.

완료 기준:

- 보고서에 프로젝트별 project id, 변환한 map id, save 성공, reload 검증 근거가 남는다.
- DB 연결 없이 fixture만 갱신한 상태는 콘텐츠 전환 완료로 간주하지 않는다.

### Wave 6 — 문서와 시각 증거 갱신

파일:

- `docs/interior-wall-frame-autotile-cases.html`
- `docs/interior-wall-frame-cases/*.png`
- 새 영구 생성기 `scripts/render-interior-wall-contract-cases.mts`
- `openwiki/editor-workflows.md`
- 필요 시 `openwiki/testing.md`

작업:

1. HTML의 A/B/C 설명을 “house 통타일 writer / dark 366 store / dark quarter source”로 바꾼다.
2. 역할 카드를 저장 역할과 렌더 소스 역할 두 묶음으로 분리한다. `233/258/257`은 금지 카드로 표시한다.
3. 모든 PNG는 수동 픽셀 조립이 아니라 실제 상수/grammar/quarter 함수를 호출하는 생성기로 다시 만든다.
4. OpenWiki의 `105 brush`, `233/258 cap joint`, `430+368 south corner`, `257 door base`, `paintRoomPartitionWalls` 후처리 설명을 새 계약으로 교체한다.
5. 외부 Combined Town, 던전 tileset 문서에는 손대지 않는다.

완료 기준:

- HTML과 OpenWiki가 코드와 같은 방향 이름·ID를 사용한다.
- 생성된 이미지에 핑크 코너, 끊어진 1열 파티션, 문 주변 쿼터 누출이 없다.

## 7. 재생성할 시각 grid 케이스

현재 파일명을 가능한 한 유지해 전후 비교가 쉽도록 한다.

| 케이스 | 새 검증 목적 |
|---|---|
| `case_chipset_3x4_autotile_block.png` | 원본 3×4 픽셀 소스가 바뀌지 않았음 |
| `case_3x3_body_for_quarters.png` | 3×3의 실제 선 방향 기준표 |
| `case_role_cards.png` | house 저장 역할과 dark source 역할을 분리 표시 |
| `case_role_strip.png` | `233/258/257` 금지와 두 계약의 경계를 한 줄에 표시 |
| `case_ring_body_105_only.png` | `105`가 plain 크림이고 더 이상 auto-shape되지 않는 음성 증거 |
| `case_ring_edge_corner_labels.png` | 핑크 없이 `458/456` 북쪽, `398/396` 남쪽 코너가 실제 선으로 연결됨 |
| `case_cream_north_face_2row.png` | `74–76/104–106` + `457` 캡의 완성 북벽 |
| `case_door_alcove_398_396_397.png` | `398 | floor | 396`, 아래 `397`, 주변 `430`; `257` 없음 |
| `case_conflict_397_edgeS_vs_doorStep.png` | 저장 충돌이 아니라 house whole tile `397` 대 dark source-only `397`로 분리됨 |
| `case_1col_pillar_posts.png` | house 포스트는 통타일, dark 1열은 쿼터 합성이라는 차이 |
| `case_cream_solo_partition_77_107.png` | gapless room에서도 `77/107`이 body-only `105`로 덮이지 않음 |
| `case_gold_brick_face_retint.png` | 금장 면은 plain 통타일이고 프레임/문은 유지 |
| `case_stone_brick_face_retint.png` | 석재 면은 plain 통타일이고 프레임/문은 유지 |
| `chipset_highlight_key_tiles.png` | house 저장 ID, dark store `366`, source-only 블록을 다른 색으로 표시 |

추가 grid를 생성한다.

- dark `366` 단일 셀
- dark `366` 1행
- dark `366` 1열
- dark `366` L자
- dark `366` 3×3과 가운데 floor hole
- dark 오목 코너
- 단일 사각 house shell
- 좌우 방 1열 파티션 + 내부 문
- 상하 방 3행 파티션 + 내부 문

각 이미지에는 입력 `lowerTiles` grid와 최종 렌더를 함께 남겨 저장/렌더 책임을 구분한다.

## 8. 검증 명령과 acceptance tests

### 8.1 Unit / integration

집중 실행:

```bash
npx vitest run \
  test/interiorAutotile.test.ts \
  test/darkWallAutotile.test.ts \
  test/interiorWallFrameQuarterComposition.test.ts \
  test/interiorRoomPipeline.test.ts \
  test/tilesetHarness.test.ts
```

필수 assertion:

1. 새 interior tileset에는 구 house wall-frame autotile group이 없다.
2. dark group은 `366`만 저장한다.
3. `366` 렌더는 모든 입력 모양에서 네 쿼터를 반환한다.
4. house ID와 `430`은 quarter composition 대상이 아니다.
5. 단일 사각 house grid의 캡 코너는 `458/456`, 남쪽 코너는 `398/396`이다.
6. 새 house grid 어디에도 `233/258/257`이 없다.
7. `397`은 south trim/door step 위치에서만 저장되고 auto-shape로 변하지 않는다.
8. 좌우 인접 방의 천장 직하 파티션은 `77/107`, 더 깊은 구간은 포스트이며 body-only `105`가 없다.
9. 수평 파티션 문은 바닥 개구와 `398/396` 플랭크를 보존한다.
10. cream/gold-brick/stone-brick 세 재질이 동일 topology와 통행/벽걸이 판정을 유지한다.
11. 사용자 정의 autotile group은 metadata pack 재적용 후 보존된다.
12. 레거시 진단은 ambiguous map을 변경하지 않고 map id/좌표를 반환한다.

### 8.2 Type/build

```bash
npm run typecheck:app
npm run build
```

- 변경 파일 진단 0
- build exit code 0
- 기존 unrelated 실패가 있으면 정확한 파일/테스트와 함께 별도 기록

### 8.3 Browser / visual

1. 실제 에디터에서 새 blank project 또는 원격 저장이 켜진 test project를 연다.
2. `villager-room-v1` 단일방, 좌우 파티션, 상하 파티션을 생성한다.
3. lower tile inspector로 저장 ID grid를 확인한다.
4. `366`을 각각 1점/1행/1열/L자로 칠하고 화면이 자동 연결되는지 확인한다.
5. `397` 문턱, `396/398` 플랭크를 직접 선택해도 주변 house 셀이 쿼터로 다시 그려지지 않는지 확인한다.
6. cream/gold/stone 세 방을 동일 카메라/줌으로 캡처한다.
7. 핑크 픽셀, 검정 덩어리 포스트, 외부 공허 쿼터 누출, 끊어진 문턱이 하나라도 보이면 실패다.

권장 Playwright 경로:

```bash
npx playwright test test/e2e/interior-dark-wall-autotile.spec.ts
npx playwright test test/e2e/interior-house-wall-grammar.spec.ts
```

기존 `interior-dark-wall-autotile.spec.ts`의 저장 variant 숫자 기대는 “모두 `366` 저장 + 스크린샷 렌더 확인”으로 바꾼다. JSON grid만 확인하고 화면을 보지 않는 테스트로 끝내지 않는다.

### 8.4 Persistence / LegacyDb

원격 데모나 실제 authored map을 갱신한 경우에만 필수다.

- LegacyDb URL / anon key / project id 확인
- remote persistence enabled 확인
- save 성공
- 같은 project id reload 성공
- reload 후 구 그룹 없음, 대상 map grid와 시각 결과 동일

완료 보고에는 secret이 아니라 project id와 save/reload 성공 근거만 남긴다.

## 9. Non-goals

- Combined Town 외부 지붕, 집 외관, road/sand autotile은 수정하지 않는다.
- `easyrpg_chipset_dungeon`의 던전 지형/천장 파이프라인은 수정하지 않는다.
- `easyrpg_chipset_interior`의 `366` 어두운 벽 경로만 이 계획의 dark 대상이다.
- 가구 배치, 이벤트/전송, 전투, runtime session, 통행 규칙을 재설계하지 않는다.
- cream/gold/stone 리틴트 팔레트의 색이나 원본 아트를 다시 그리지 않는다.
- 새 tile ID, atlas 확장, 핑크 셀에 임의 프레임 아트를 덧그리지 않는다.
- 출처가 불명확한 사용자 맵을 숫자 휴리스틱만으로 자동 변환하지 않는다.
- 코드 fixture나 로컬 JSON만 갱신하고 원격 콘텐츠 마이그레이션이 끝났다고 보고하지 않는다.

## 10. 최종 완료 조건

- 새 주택 writer에는 오토타일 단계가 없다.
- 새 dark writer는 `366`만 저장한다.
- house whole-tile과 dark quarter-source가 코드 상수·함수·테스트에서 분리돼 있다.
- `233/258/257`이 새 벽/문 결과에서 사라진다.
- 모든 지정 PNG와 추가 grid가 실제 구현 경로로 재생성되고 육안 QA를 통과한다.
- focused Vitest, typecheck, build, 두 Playwright 시나리오가 통과한다.
- OpenWiki와 HTML 카탈로그가 새 계약을 설명한다.
- authored content를 변경했다면 LegacyDb project id 기준 save + reload 증거가 있다.
