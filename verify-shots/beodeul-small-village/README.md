# 버들항 — 나무 연결 보정과 집 5채 작은 마을

2026-10-04. 사용자가 왼쪽 나무의 잘린 느낌을 고치고 서로 다른 형태의 집 약 5채로 자연스러운 작은 마을을 요청했다.

## 나무 보정

원래 3×3 수관의 마지막 줄에는 투명 여백이 있고, 이전에 붙인 밑동은 다음 행에서 시작해 줄기가 끊겨 보였다.
공용 `bdg-tree-neck`을 source 41에 추가하여 수관 마지막 행 가운데에 줄기와 잎을 겹쳤다.
★ 우선순위로 원래 수관 통행을 따르며, 기존 source 0~40을 재번호하지 않는다.
현재 공용 팩은 48슬롯·42개 그림·16레시피다.
이미 꾸민 맵에는 빠진 밑동/연결만 보충하며 다른 꾸밈을 중복하지 않는다.

저장한 기존 맵 `map_blank_start`의 (4,5), (5,12)에 실제 연결 graft가 있다.
원래 1/3층, 기존 비어 있지 않은 2/4층, 모든 방향 통행, 문 이벤트와 실내 맵을 비교해 보존을 확인했다.
`old-trees-fixed.png`는 이 저장 맵을 3배 정수 확대해 그린 것이다. 이벤트 테두리는 편집기 렌더 표시다.

## 실제 조수가 만든 마을

실제 편집기 AI 경로 `classifyPlainPiTurn → composePiTask → buildPiRunRequest → runPiAgent`로 실행했다.
모델 `opencodex/gpt-6-astra`; 호출 원문·도구 기록은
`../assistant-beodeul-village/small-village/five-houses/`에 있다.
조수는 `author_beodeul_town({houseCount:5})`로 새 맵을 만들고, 참고문서와 그림을 읽고,
기존 맵에 `dress_beodeul_ground`를 적용한 뒤 새 마을의 숲 가장자리·우물 주변 녹지를 추가했다.
밑동이 불완전한 추가 나무는 실제 화면을 보고 원래 줄기가 있는 3×4 나무로 교체했다.
최종 도구 기록 51회 중 실패 0회(실행기 집계는 내부 호출 포함 53회)다.

새 맵 `map_beodeul_rest`, 이름 **버들쉼터**, 40×30, 시작 위치 (18,17).

| 집 키트 | 외형 | 원점 | 문 앞 접근 칸 |
|---|---|---|---|
| bd-house-h101_0 | 별채가 붙은 박공집, 7×6 | (4,3) | (6,9) |
| bd-house-h104_0 | 넓은 이층집, 7×8 | (17,2) | (19,10) |
| bd-house-h112_0 | 작은 돌벽 박공집, 4×6 | (30,5) | (32,11) |
| bd-house-h109_1 | 돌출 현관이 있는 ㄱ자집, 8×8 | (5,18) | (6,26) |
| bd-house-h107_0 | 낮고 넓은 살림집, 6×6 | (27,20) | (30,26) |

모든 원본 집의 전체 그림 배열을 저장 맵과 비교했다. 같은 집의 색 변형이 아닌 서로 다른 키트 5종이다.
밝은 잔디, 굽은 큰길·좁은 샛길, 우물과 벤치, 풀·꽃·흙·통·빨래, 나무와 덤불을 배치했다.
`village-overview.png`는 SQLite에서 다시 읽은 실제 최종 맵의 전체 렌더(2배 정수 확대)다.
공용 참고 그림 `public/assets/beodeul-ground/small-village-native.png`는 seed 1004의 기본 표본이며,
조수의 후속 녹지 보강을 포함한 최종 결과와 구별한다.

## 공용 적용

- 그림/레시피: `scripts/content/build-beodeul-ground.py`, `src/assets/beodeulGroundCatalog.json`, `public/assets/beodeul-ground/`.
- 나무 보정/기존 판 보충: `src/editor/tools/beodeulGroundTools.ts`, `src/project/defaults/beodeulGround.ts`.
- 작은 마을 생성: `src/editor/tools/beodeulSmallVillage.ts`, `authorBeodeulTown.ts`의 houseCount 3~5 모드.
- 채팅/Pi 공통 안내: `src/ai/promptPolicies.ts`, `src/ai/piAgent/beodeulTownRoute.ts`.
- 정확한 5채 사전/전체 네 층 표본: `tiledata/beodeul-ground/SMALL-VILLAGE.md`, `small-village-example.json`.
- 배포: 기본 ground 참고문서 생성 뒤 `bun scripts/content/prepare-beodeul-small-village-references.mts`.
  번들 용도 `beodeul-ground-dressing`은 현재 MD 4개·이미지 3개다. 기본 참고문서 재생성도 작은 마을 자료를 보존한다.
  새 프로젝트는 defaults, 기존 프로젝트는 ensureBundledTilesets/ensureBeodeulGroundReferences로 받는다.
  기본 표본은 실제 createBlankProject 경로로 생성했고, 기존 정본은 같은 ensure 경로를 거쳐 저장·재로드했다.
  `common-registration.json`은 새 프로젝트와 작은 마을 자료가 빠진 기존 사본 양쪽의 등록,
  저자 문서 보존, 옛 연결 칸의 ★/그룹 보충, 두 번째 ensure 불변을 직접 확인한 근거다.

## 정본 저장과 재로드

- Project ID: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 폴더: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004`
- 저장소: 위 폴더의 `project.sqlite` + `assets/`
- 저장 revision: **7**
- SHA-256: `afaf9aac144a58f357f580267aa40f4740271032321260292c6d8911c17510ca`
- 근거: `canonical-proof.json`, `scripts/qa/beodeul-small-village-proof.mts`.

조수 실행기가 실제 SQLite API로 저장한 후 다시 읽었고, 별도 proof도 같은 저장소를 두 번 열어
프로젝트 전체와 해시가 같은지 확인했다. 원래 야외/실내 두 맵의 콘텐츠와 기존 문 열림/전이는 보존했고
야외 나무 연결 2칸만 추가했다. 시작 맵은 새 마을로 바뀌었다.
프로젝트 JSON은 이 재로드 결과를 전용 플레이어에 전달하기 위한 산출물이며 정본을 대신하지 않는다.

## 플레이어 확인

`node scripts/qa/runtime/beodeul-small-village.capture.mjs`는 전용 `player.html` 경로를 사용한다.
시작 마당 → 5채의 문 앞 → 우물 마당 복귀를 **실제 도보 입력**으로 확인했다.
현재 canMove와 포석/판석 칸만 사용하는 경로 탐색으로 모든 문 앞의 연결을 확인했으며, 순간이동으로 대신하지 않았다.
총 8비트 통과, 실패 0, 런타임 에러 없음. 원문은 `runtime/SUMMARY.md`를 먼저 읽는다.

시각 확인: `02-village-start.png`, `03-house-1.png`, `overview-player.png`를 직접 열었다.
집 외형 5종, 줄기/밑동 연결, 우물 마당과 길 접속, 길 위에 선 플레이어가 실제로 보였다.
`overview-player.png`는 모든 이동 후 같은 플레이어의 카메라만 축소한 전체 화면이다.
맵 데이터나 플레이어 위치를 바꾸지 않았다.

## 범위와 지표

이번 새 마을은 외장과 꾸밈이다. 새 집 5채의 실내·출입 이벤트·주민은 만들지 않았으며,
원래 한 채의 실내·문 이벤트가 보존됐다는 확인을 새 집 5채의 출입 확인으로 확대하지 않는다.

도시용 일반 형태 자는 문 앞 샛길 끝 4개를 막다른 길로, 21칸 우물 마당을 24칸 미만 광장으로 보고 경고한다.
이는 실제 문 앞 도보 연결 실패가 아니다. 빈 잔디 비율도 도시 기준에는 많으므로 모든 도시 품질 기준 통과라고 보고하지 않는다.
이번 결과는 작은 잔디 마을로 화면을 직접 검토했다. 전체 gates/vitest/typecheck는 AGENTS의 세션 실행 제한에 따라 실행하지 않았다.
