# 생활 실내 다섯 곳 (2026-09-24)

승인된 평면안을 기존 Tibo/목재 소재로 실제 저작했다. 방 14개, 맵 5개이며 기존 장소를 교체하지 않는다. 위아래 방 간격은 4행 북벽과 천장 한 행을 확보하도록 평면안보다 넓혔다.

| 맵 ID 접미사 | 장소 | 방 수 | 바닥 |
|---|---|---:|---|
| fisher | 어부의 집 · 밧줄과 작은 창고 | 2 | 목재·창고 석재 |
| tailor | 재봉사의 집 · 창가 재단방 | 2 | 목재 |
| lodging | 공동 임대주택 · 꺾인 복도 네 방 | 4 | 목재 |
| pawn | 전당포 · 카운터 뒤 보관실 | 3 | 목재·보관실 석재 |
| guild | 상인 조합 회관 · 회의와 기록 | 3 | 목재·접수실 석재 |

맵 ID는 `map_daily_life_<접미사>_20260924`, 공용 장소 ID는 `shared_authored-<맵 ID>`다. 공용 SQLite 라이브러리는 `tibo-daily-life-five-20260924`, 원격 보관본 project ID는 `oprn-shared-daily-life-five-20260924`다. 저장 후 두 저장소에서 재로드 일치를 확인했다. 영수증은 이 폴더의 local-proof.json / remote-proof.json이다.

정확한 하위·상위 전체 배열은 기본 카탈로그 `src/project/defaults/spatial/reviewedPlaces/catalog.json`의 `shared_tileset_daily_life_20260924` → `structureKits` → `raster_<맵 ID>`에 있다. 공용 SQLite에는 원본 GameMap 5개와 원본 아틀라스가 함께 보관된다. 실제 타일 미리보기는 public/assets/reviewed-places/shared_*.png다.

construction-proof.json은 좌상단 원점 좌표, 방별 floor cells, 가구 kit ID·행 배열·배치 원점, 출구, 의자 쌍, 엔진 도달 좌표를 기록한다. `anchor:north`는 조립 그림을 북벽 밑단에 붙이는 배치로, 가구가 벽 아래에 떠 보이지 않도록 한다. 일반 주거 침대는 324/354 두 조각. 빈 긴 탁자는 325 → 326 반복 → 327이며 상위 레이어다. h형 의자는 `tibo-v7-3-2`로 탁자 왼쪽, 같은 상판 행에 둔다. 방향 없는 걸상은 회의탁자 옆과 아래에 사용했다.

하위 목재바닥72, 회녹색 석재2052. 벽 밑단은 목재104–107/석재2053–2056을 대응시킨다. 1칸 기둥은15/45/75, 목재 밑단105. 천장은 proof-wood-ceiling-3x4 variantMap에 이웃 8방향 비트를 넣는다. 벽과 천장은 하위, 가구와 벽 장식은 상위. 창문은 기둥 사이 북벽 중간에 둔다.

방마다 주된 상판 가구 하나 이하, 소형 침대, 빵 화덕·큰 침대·삭제 소품·장화 미사용. 모든 출구는 1칸짜리 프리셋으로 실제 마을 이동 이벤트는 만들지 않았다. 저작 검사에서 천장 연결 성분1, 북벽4행, 가구 접근, 의자 방향, 출구 연결을 확인했으며 현재 collision.ts의 canMove/isPassableLanding으로 빈 바닥 전부 도달함을 확인했다. 이는 직접 플레이한 결과와 구별한다.
