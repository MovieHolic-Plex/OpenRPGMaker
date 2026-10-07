# 버들항 · 우물 공동마당 마을

## 실제 적용 결과

원본 민가 5채와 교회를 그대로 옮겨 54×34 배치로 재구성했다. 북쪽 세 집은 하나의 우물·벤치·빨래 마당을 공유한다. 남쪽 두 집은 장작/텃밭과 숲 가장자리에 두고, 중앙 생활 공간에서 교회 길과 흙 샛길을 연결했다. 밝은 원본 잔디, 모든 건물의 타일 배열/문 한 개/창문/지붕 윗면은 유지했다. 기초·나무 목/뿌리·짧은 투사 그림자는 새 위치에 다시 붙였다.

## 정본 저장 / 재로드

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 폴더: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004`
- 대상: `project.sqlite`, 맵 `map_beodeul_rest` (버들쉼터)
- 최종 revision: **14**
- SHA256: `a93675c2ffdb34eb3f7145740ccf7d3c9efdac625d3b1154574aa415b4a18445`
- revision 13에 실제 배치 저장; revision 14는 학습 이미지 설명 갱신만 저장. 두 revision의 전체 맵은 deepEqual이다.
- `openLocalProjectStore` API로 저장하고 닫은 뒤 같은 폴더를 다시 열었다. 재로드 전체 프로젝트가 저장한 객체와 deepEqual이다. 원래 문 열기/실내 이동 시험 두 맵과 이벤트, 시작점은 이전 정본과 동일하다.
- 근거: `canonical-proof.json`, `scripts/qa/beodeul-shared-village-proof.mts`, `scripts/qa/beodeul-courtyard-reference-save.mts`.

## 공용 AI 조수 적용

`compose_beodeul_courtyard_village` 도구·참고문서 허용 목록·프롬프트 정책을 추가했다. 인식된 54×30 예제(집 5채+교회)를 재배치하라는 명시적 요청에만 사용한다. 이벤트/높이/다른 맵 또는 공통 이벤트의 전이 도착점이 있으면 거부한다. 임의 마을의 자동 재설계 도구는 아니다. 반복 호출은 no-op이다.

`tiledata/beodeul-ground/COURTYARD.md`, 전체 네 층/이식 규칙 예제 JSON, 실제 원본 렌더를 저장하고 공용 번들 문서로 배포했다. 새 프로젝트와 기존 정본의 city·ground 모두 3개 문서/이미지가 있는 것을 확인했다. 각 문서는 120,000자 이하이며 이미지 바이트는 번들 JSON에 넣지 않았다. 배포 이미지의 긴 변은 820px, 128색 학습 사본이다. 게임 소재와 비교 화면은 실제 원본 픽셀을 그대로 사용한다.

## 통행 / 화면 근거

- 원본 건물 여섯 채의 모든 유효 타일이 새 원점에서도 동일하다. 기초 6곳, 나무 밑동 보정, 문 앞 도달성을 확인했다.
- grass를 가로지르는 지름길 대신 흙길·포석·디딤돌에서만 canMove 경로를 구했다.
- 전용 `player.html` 런타임으로 여섯 문 앞까지 실제 도보 이동 후 우물 곁으로 복귀: **9개 비트 중 실패 0, 런타임 오류 0**.
- `runtime/SUMMARY.md`를 먼저 읽고 지정한 두 PNG(텃밭 집/우물 복귀)를 열어 확인했다. 실내 이동 이벤트를 이 마을에 새로 추가한 작업은 아니다.
- `village-overview.png`: SQLite 재로드 데이터의 실제 2배 렌더. `before.png`: 실제 revision 12 배치.
- 비교 화면은 손으로 그린 시안이 아니라 이 두 실제 렌더를 무손실로 1배 크기로 환원한 그림이다. 세 보기 전환과 작은 화면에서의 폭을 확인했다. 근거 `visual-proof.json`, `visual-comparison.png`.

전체 gates/vitest/typecheck는 실행하지 않았다. 이번 확인은 해당 콘텐츠의 저장·재로드·도보 통행·비교 화면에 한정했다. 공간 구성의 자연스러움은 사용자 판단이며 자동 검사가 합격을 대신하지 않는다.
