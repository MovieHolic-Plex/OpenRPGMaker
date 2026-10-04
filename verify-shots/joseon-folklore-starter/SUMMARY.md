# 조선 설화 기본 프리셋 — 저장과 실제 화면

## 즉시 확인

- `01-start-examples.png`: 실제 런처의 조선 설화 예제 카드.
- `03-editor-selection.png`: 실제 새 게임 창의 선택 내용과 화면 크기 설정.
- `04-normal-portrait.png`: QA 훅 없는 출하 플레이어의 조선 대화창/얼굴/Galmuri9.
- `05-battle.png`: 출하 플레이어의 신부 원귀와 RM2003 측면 전투.
- `06-pharmacy.png`: 약재함/약솥/책장/문을 갖춘 실제 약방. 진입 후 다시 마을로 걸어 나온다.

## 정본

- 프로젝트 ID: `f84dfa19-5b71-43f1-8523-b10910d23be7`.
- 저장 폴더: `/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004`.
- 최종 revision: **5**, SHA-256: `87f5c3ed9d61b69bf429e75927f66cd274094c209cd095906d893b92afb0a4dc`.
- native store API로 저장한 뒤 연결을 닫고 같은 폴더를 다시 열었다. native 비교 직렬화가 같고 참조 오류가 없다.
- 6맵, 클래스5(초보+4직업), 장비36, 적15. `storage-proof.json`.
- 콘텐츠 레코드와 전직/의뢰/상점 이벤트는 기존 버들마을 정본 revision13에서 읽었다.
- 지형은 현재 공용 joseon-baram 하네스의 지도이다. 예전 지형 칸13645를 최신 정의에 섞으면 길이 늪으로 바뀌므로 현재 지도와 함께 묶었다.
- 실내는 현재 공용 지도 NPC·문·시작 앵커에 맞췄다. 옛 약방 진입 (5,7)은 벽이고 현재 진입은 (6,6)이다.
- 하네스 `validate`: FAIL0/WARN0. 그림이나 지형을 직접 다시 그리지 않았다.

## 관측 범위

- `ui-proof.json`: 실제 런처 → 인계와 실제 새 게임 창 → 같은 생성기를 확인했다. 폴더 브리지만 fixture이며, 이 UI 실행을 정본 저장 근거로 쓰지 않는다.
- `runtime-proof.json` / `runtime-manifest.json`: 최종 내보낸 player.html의12비트 모두 통과. 전직·기술 사용·구매·시련을 확인했다. 오류0/404누락0.
- `rooms-proof.json` / `rooms-manifest.json`: 주막·서당·약방 각각 타일 이동으로 진입/귀환하는7비트 모두 통과. 오류0/누락0.
- 전투 승리 화면은 기존 F 디버그 비트다. 실제 보스 피해/예고/승리/보상은 이전 팩의 `verify-shots/joseon-folklore/battle-probe.json`에서 별도로 확인한 동일 레코드다. 장기간 전체 진행 밸런스를 증명하지 않는다.
- `player-build.json`: `npm run build:player` 성공, SDK artifact `e0df6c826c7b8d20`, schema4,407파일+36런타임 에셋.
- `export-proof.json`: 저장 후 재로드한 게임 내보내기,6맵/2820에셋, 외부 fallback0. preview `http://mdc-server:18345/player.html`.
- 전체 gates/Vitest/typecheck는 AGENTS 세션 제한에 따라 실행하지 않았다.
