# 중단된 월드맵 작업의 추가 완료 근거 — 2026-10-04

원래 Claude 세션 `77bfc270-edea-4448-84c9-a62e2aacefbc`의 후속이다. 앞선 실제 지리 구현은 PR #2020으로 합쳤다.

## 공용 등록

- 사람 결정은 외부 하네스 SQLite에서 **읽기 전용 트랜잭션**으로 읽었다. 346개 중 사람이 고른 79개(원본 72 · 재작성 후보 7)만 포함한다.
- 선택 원본 PNG·SHA256·후보 시도 번호·전체 칸 배열·덧붙이기 전용 칸 사전은 `tiledata/worldmap-kit/selected/`, `harness-data/worldmap-icons/slots.json`.
- 16px · 30열 · 1,620칸. 원본 EasyRPG World의 앞 480칸은 그대로이며 선택 아이콘만 뒤에 붙였다.
- `bake.py check` 및 공개본 `build/check --snapshot`에서 해시·전체 배열·PNG·참고 그림이 일치했다. 선택 결정은 변경하지 않았다.
- 새 프로젝트와 기존 두 프로젝트 모두 `worldmap_selected`와 선택 참고문서 3용도를 재로드했다.
- `list_worldmap_icons` → 소스 참고문서 읽기 → `stamp_worldmap_icon` → `inspect_worldmap_icon`.

## 정본 저장과 재로드

| 프로젝트 | project id | 저장 대상 | 근거 |
|---|---|---|---|
| 조선 원본 | `e85f0f8a-99b0-4098-abfe-3a0aefd7c3d8` | `/home/main/.local/share/oprn/worldmap-real-geo-20261004-joseon` | revision 3 · 공용 등록만 보충 · 원본 맵/시작 해시 동일 |
| 유카탄 원본 | `abcd1257-74e2-4013-b403-dd247945beb3` | `/home/main/.local/share/oprn/worldmap-real-geo-20261004-maya` | revision 2 · 공용 등록만 보충 · 원본 맵/시작 해시 동일 |
| 선택 아이콘 도감 | `858abf11-8be8-4ff7-b3a2-44a274a7f15a` | `/home/main/.local/share/oprn/worldmap-selected-20261004` | revision 10 · 도감 79개/3맵 + 이식 예제 · 캐릭터 75% 유지 |

`electron/local-store/store.ts`의 saveProject → close → openLocalProjectStore → loadSnapshot으로 확인했다.
도감의 편집기 확인은 실제 SQLite 호스트와 네이티브 저장 브리지를 사용했다. `blankProject`·메모리 어댑터·LegacyDb 원격 쓰기는 사용하지 않았다.
`save-reload.json`, `graft-save-reload.json`, `editor-scale.json`, `inspection-regeneration.json`에 상세 근거가 있다.

## 동작 확인

- UI: 맵 속성의 50%를 75%로 변경 → SQLite 저장 → 브라우저 재접속에서도 75%. 브라우저 오류 없음.
- 구조: 미선택 아이콘·경계 밖·겹친 위층은 부분 수정 없이 거부했다. 다른 타일셋에 찍어도 바닥은 보존되고 같은 소스 36칸을 재사용했다.
- 검사: 저장된 정상 수도 전체 배열 일치. 한 칸을 지운 사본은 `MISSING_CELL (38,8)`을 정확히 돌려줬다.
- 재생성: 기록된 실제 Python 결과를 빌더로 주입해 위층·2/4층·그림자·36개 이식 슬롯·통행 설정 보존, 크기 변경 시 원자적 거부를 확인했다. 새 렌더 실행 근거는 아니다.
- 내보내기: 선택 시트와 출처 MD가 수집됐다. 참고문서 JSON은 플레이어 번들에서 제거한다.
- 출하 플레이어: 조선·유카탄 원본 모두 타이틀 → 시작 → 고을 입장 → 세계 지도 복귀 **4/4**, 런타임 오류 없음.
- 출하 플레이어: 이식 도감의 그림 표시 → 입구 통과 → 옆 벽 차단 **4/4**, 런타임 오류 없음. 즉시 확인 샷에서 modern-sf 수도와 75% 캐릭터를 직접 확인했다.

런타임 리포트는 `verify-shots/runtime-qa/worldmap-real-joseon/`, `worldmap-real-maya/`, `worldmap-selected/`의 SUMMARY.md를 먼저 읽는다.
이식 입력 QA는 도감의 맵과 사용하는 타일셋만 포함한 `prepareWebExport` 사본이다. 전체 기본 자료 약 154MB 사본은 부팅을 완료하지 못했고, 새 프로젝트 전량의 부팅 성능 합격으로 보고하지 않는다.

## 남은 사람 결정과 범위

스팀펑크의 형광색 화산·부유 대륙·수정 언덕에 대해 하네스로 교정 후보를 준비했다. `visual-review.json`과 기존 선택 화면에서 확인한다.
AGENTS.md는 월드맵 아이콘 후보를 **사람이 받기/버리기**하도록 요구하므로 미선택 후보를 공용 시트에 넣지 않는다.
현대 소도시 등 미선택 267개도 후보 상태로 남는다. 원래 자료의 산줄기 반복은 16px 지형의 스타일 한계다.
유카탄의 지리와 연결은 확인했지만 전용 마야 건축 소재는 없고 판타지·버들항을 사용한다. 전체 게임 엔딩 검증도 아니다.

갤러리: http://mdc-server:18301/worldmap-real-geo.html
공개 선택 다운로드: https://movieholic-plex.github.io/oprn-worldmap-kit/
