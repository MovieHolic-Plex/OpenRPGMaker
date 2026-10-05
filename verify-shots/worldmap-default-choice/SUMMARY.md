# 기본 월드맵과 포켓몬풍 선택 — 2026-10-05

- 일반 프로젝트의 초기 선택: **기본 · 기존 대륙 월드맵** → 기존 `edit_world_terrain` 생성기.
- 몬스터 수집 장르의 초기 선택: **포켓몬풍 · 마을과 도로** → `author_worldmap_structure`, `region-routes`.
- 명시적으로 다른 방식을 고르면 그 방식을 생성한다. 기본 UI 값은 새 저장 스키마 필드가 아니다.

## 편집기 화면

`editor-capture.json`: 실제 편집기에서 7개 방식과 기본 세계관 17개, 일반 기본 선택, 몬스터 장르 선택,
수동 전환 때 세계관 선택 표시/숨기기, 포켓몬풍 실제 맵 생성, JS 예외 0개를 확인했다.

- `editor-default.png`: 일반 프로젝트 기본 대륙 선택과 세계관 입력.
- `editor-pokemon.png`: 몬스터 장르의 포켓몬풍 초기 선택과 배치 번호.
- `editor-pokemon-generated.png`: 생성 후 실제 에디터 맵.

처음 두 캡처는 에디터 부팅 중 시간 제한에 도달했다. 같은 서버를 재사용한 후속 캡처가 위 결과를 확인했다.
화면용 `freshProject=1`은 정본 저장 근거로 쓰지 않는다.

## 실제 저장·재로드

`canonical-readback.json`: 실제 생성 도구 실행 → SQLite 저장 → 이미지 파일 분리 → 닫기 → 같은 저장소 재개방.

| 방식 | project id | 저장 폴더 | revision |
|---|---|---|---|
| 기본 | `054c114f-6160-43c1-ae5c-e0f9cf2cb59d` | `/home/main/.local/share/oprn/worldmap-default-choice-20261005-2/default` | 2 |
| 포켓몬풍 | `f3aaa617-423d-4535-ae69-3a9a8bd1535a` | `/home/main/.local/share/oprn/worldmap-default-choice-20261005-2/pokemon` | 1 |

기본은 기존 지형 원본(`worldmapSource`, fantasy), 96×72칸, 실제 저장된 지도 이미지 ref/파일을 확인했다.
포켓몬풍은 실제 마을·도로 8맵과 연결/통행 검사(`inspectWorldAtlas`)를 확인했다. 기존 게임 시작 맵/좌표는 두 경우 모두 보존했다.
조수 카탈로그의 기본/장르별 권장 방식과 조수 선택 노트도 같은 기록에 포함한다. 실모델 자연어 실행의 성공 증거는 아니다.

재현 명령은 `bun scripts/content/verify-worldmap-choice.mts <새 저장 루트>`와
개발 서버를 띄운 뒤 `node scripts/qa/capture-worldmap-choice.mjs`이다. 새 저장 루트만 허용하고 기존 폴더를 덮어쓰지 않는다.
gates/vitest/전체 typecheck는 실행하지 않았다.
