# 버들항 참고 건물 유형 (`bd-bld-ref-*`)

오너의 참고 그림 여섯 장(저장소에 없다)에 서 있는 건물의 **유형** — 농장 건물 · 일터 · 읍 건물 · 항구 건물 · 성읍 조각 — 44채를 버들항 손으로 새로 그린 킷이다.
살림집(오두막·가게집·여관 …)은 집 양식(`bd-house-st-*`) 몫이고 여기에는 없다. 참고 그림은 구조와 밀도만 배웠고 베끼지 않았다.

**그림은 3/4 관문 미통과 — 오너 면제**(묶음 `fable-refbuildings-beodeul-2026-11-15`, 출구 bundle·shared, 스토어 출구는 막힌 그대로).

| 파일 | 무엇 |
|---|---|
| `types.json` | 유형 목록(정본은 `scripts/content/beodeul-ref-buildings/types_src.py`): 칸 크기 · 문 칸 · 지나가는 칸 · 갈래 · 터 · 급 · 맞는 집 양식 · 마을 종류 · 실내 · 그림에 든 것 · 곁에 놓을 기물 |
| `ramps.json` | 색 줄(집 양식의 목골 · 통나무 · 석조 항구 · 보랏빛 슬레이트 색 줄을 값 그대로 한 표로 + 새 줄 넷) |
| `parts/*.png` · `parts.json` | 부품과 출처 — 어느 판이 Fable 5.2 medium 그림이고 어느 판이 코드인지 |
| `buildings/*.png` · `report.json` | 조립된 건물 그림과 수치(막힌 칸 · 옆선 편차 · 민무늬 몫 · 색 수) |
| `catalog.json` | 구운 칸 번호(46,464~) · 해시 |

다시 만들기: `types_src.py` → `code_parts.py` → `assemble.py` → `bake.py` (모두 `scripts/content/beodeul-ref-buildings/`, PIL·numpy 필요). 낱말 탐침 `bun scripts/content/beodeul-ref-buildings/words.mts`.
빌더가 읽을 표는 `src/assets/beodeulRefBuildings.json` 이다 — 아직 어느 빌더도 이 킷을 놓지 않는다.
