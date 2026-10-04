# 조선 실내 키트 · 오류 교훈(실제 변조 그림 + 검출 코드·좌표)

tilesetId `joseon_baram` · 그림 `public/assets/joseon-baram/joseon-baram-chipset.png`(텍스처 `tex_joseon_baram`, **16768칸**, 16px 칸, 한 줄 **128칸** — 번호 n 의 칸은 행 n÷128, 열 n%128, 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 13490 이상 곳곳에 같은 그림이 다른 통행으로 쓰이는 복사본 칸(꼬리)이 있다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다). 칸 번호는 판이 늘어도 바뀌지 않는다(새 조각은 뒤에 덧붙는다).

입구 막힘·방 사이 문 막힘·천장 밑 벽 누락·벽 조각 아래층·같은 걸상 일렬·천장 가장자리 반대를 실내 정본 방에 실제로 넣고 검출했다.
아래 사례는 정본 지도를 **실제로 변조**해 만든 그림이고, 저작 검사(`newrefs.py` 의 `detect`)가 같은 좌표를 잡는다. 기록: `tiledata/joseon-village/qa-tamper-checks-new.json`.
정상 지도 11장은 마스크 불일치(알려진 칸)를 뺀 모든 코드가 **0 건**이다.

| 코드 | 맵 좌표 | 변조 | 검출 좌표(앞 3개) |
|---|---|---|---|
| `entry-blocked` | `joseon_in_inn_b` (11,11) | 들어오는 칸 (11,11) 에 걸상(`in_b_stool`)을 놓음 | [[11, 11]] |
| `region-unreachable` | `joseon_in_house_b` (1,5) | 민가 칸막이 문 틈 (4,6) 에 걸상을 놓음(그 너머 6칸이 갇힘) | [[1, 5]] |
| `wall-missing-under-ceiling` | `joseon_in_school_b` (1,1) | 서당 북벽 벽면 윗줄 (1,1) 의 벽 조각 칸을 지움 | [[1, 1]] |
| `object-tile-in-lower-layer` | `joseon_in_office_b` (1,1) | 관아 벽 조각 칸 (1,1) 을 lowerTiles 에 칠함 | [[1, 1]] |
| `same-prop-three-in-row` | `joseon_in_smith_b` (3,4) | 대장간 바닥 (3,4)~(5,4) 에 같은 걸상 셋을 가로로 일렬로 놓음 | [[3, 4]] |
| `autotile-mask-mismatch` | `joseon_in_house_b` (12,9) | 천장 가장자리 칸 (12,9) 을 반대쪽 가장자리 모양(마스크 102→108)으로 바꿈 | [['jb_in_b_ceil47_autotile', 12, 9]] |

## 코드 뜻
| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `door-unreachable` | 문 앞·출구 칸에 들어오는 칸에서 닿지 못한다 | 문 앞 3칸은 비운다. 소품·나무를 치운다 |
| `region-unreachable` | 걸을 수 있는 칸이 입구에서 닿지 못하는 섬이 된다 | 길목(복도·문 틈)에 막힘 조각을 놓지 않는다. 지도 어디도 갇힌 칸이 없다 |
| `entry-blocked` | 들어오는 칸 자체가 막혔다 | 출구 깔개 바로 북쪽 칸은 비운다 |
| `object-tile-in-lower-layer` | 조각 그림 칸이 아래층(lowerTiles)에 칠해졌다 | 조각은 `stamp_object` 로 윗층에 찍는다 |
| `autotile-mask-mismatch` | 오토타일 칸 번호가 이웃 8칸이 정하는 변형과 다르다 | 손으로 번호를 고르지 않고 칠하는 도구(fill_region·lay_path)로 다시 칠한다 |
| `wall-missing-under-ceiling` | 천장(어둠) 바로 아래 칸에 벽(앞면)이 없다 | 천장 밑 두 줄은 벽 조각(실내·궁) 또는 앞면 두 줄(동굴)이다 |
| `same-prop-three-in-row` | 같은 기물 그림 셋이 일렬이다 | 기물은 서로 다른 변형으로, 용도 곁에 묶어 놓는다 |
| `aisle-blocked` | 입구에서 어좌 단 계단까지 카펫(어도)만 밟아 가는 길이 끊겼다 | 어도 위에는 아무것도 놓지 않는다 |

## 검사가 주장하는 것·주장하지 않는 것 (item 7)
이 검사는 **구조와 통행**만이다(칸 번호가 정답 배열과 같은가, 엔진 규칙으로 닿는가, 위 코드). 이벤트 실행(문 이동·대화), 미적 품질(자연스러움·밀도), 저가 모델 성공률은 구조 검사 통과로 대신 주장하지 않는다.
저장 전에 위 검사가 실패하면 부분 배치를 남기지 않는다(도구가 되돌린다).

## 기존 문서·칸 메타의 레이어 정정 (item 8)
이 용도의 조각·지형은 신규다 — 정정할 이전 문서·before/after 가 없다. 칸 메타(`tileMeta`)는 처음부터 투명 여부·홈 레이어(`defaultLayer`)·통행(`passage`)·렌더 우선순위(`priority`)를 따로 적는다: 조각 칸은 `upper`, X=`solid`/C=`star`/F=`passable`, 땅·천장 칸은 `lower`.
