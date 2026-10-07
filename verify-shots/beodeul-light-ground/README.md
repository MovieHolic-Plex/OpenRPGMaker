# 버들항 원본 유지 일광·접지 적용

사용자가 조사 결과 적용을 지시했다. 원본 집·지붕·나무·기초/소품 그림과 좌표, 밝은 잔디를 유지하고 바닥의 일광·접촉 그림자, 낮춘 연석, 큰 저대비 잔디/흙 변화를 적용했다. 빛은 왼쪽 위, 그늘은 짧게 오른쪽 아래다. 실제 공용 harmonize_beodeul_daylight 도구를 호출했으며 별도 AI 모델 실행 결과라고 주장하지 않는다.

## 정본 저장·재로드

- Project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- SQLite: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- Revision: 11
- SHA-256: `30434511120896be167381477e5c593b00af334ab87cdd39c1292ca132787ca8`
- SQLite API 저장 후 닫고 같은 저장소를 다시 열어 프로젝트 전체 일치를 확인했다.

## 변경과 보존

- 바닥 그림자 161칸, 포석 경계 보정 176칸, 저대비 잔디/흙 190칸.
- 마을의 기존 3·4층 전체, 이벤트, 시작점, 원래 문 열림/전이 및 실내 두 맵이 보존됐다. 기존 2층 그림을 덮지 않았다.
- 전체 1,620칸의 네 방향 통행이 전과 같고 도구 반복 적용이 프로젝트 전체 기준 no-op임을 확인했다.
- `before.png`, `shadow-only.png`, `village-overview.png`는 실제 저장 대상의 맵을 동일한 맵 렌더러로 2배 최근접 렌더링한 비교이며 플레이어 브라우저 캡처와 구분한다.
- `canonical-proof.json`과 `tool-result.json`, `output/beodeul-light-ground/reloaded-project.json`에 근거를 보존한다.

## 공용 등록과 하네스

source beodeul_ground는 원래 112칸 픽셀을 그대로 유지한 304칸이다. 하네스 build/validate/review로 source 배열·이전 칸 해시·일광 알파를 확인했다.
공용 source/defaults/기존 source ensure와 조수 toolRegistry/프롬프트/읽기 선행 계약에 등록했다. 새 houseCount 마을은 시공 마지막에 보정한다.
공용 자료 7 MD/7 이미지, 최대 문서 66654자. 첫 저장 시도는 예제 문서가 120,000자 상한을 넘어 거부됐고, 전체 네 층 배열과 이식 통행 규칙을 두 문서로 나누어 정본 저장에 성공했다. 자료는 생략하지 않았다.
원본/보정 마을과 실제 공용 픽셀의 정상/그림자 한 칸 삭제 오류 그림을 확인했다. 전체 gates/vitest/typecheck는 실행하지 않았다.

## 실제 플레이어

전용 player.html 시나리오 9비트 모두 통과, 런타임 에러 0개. 다섯 집·성당의 문 앞까지 실제 도보 이동 후 우물 마당으로 복귀했다. SUMMARY를 먼저 읽고 이층집/성당의 두 샷을 즉시 확인으로 지정해 실제 그림자·연석·접근을 확인한다.
