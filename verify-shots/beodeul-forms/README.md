# 버들항 · 여섯 건축의 강변 마을

사용자 요청: 긴 민가, 좁고 높은 민가, ㄱ자 민가, 현관과 지붕창이 있는 여관, 열린 작업장과 굴뚝이 있는 대장간, 넓은 화물 출입구와 차양이 있는 창고를 모두 반영한 마을.

## 실제 결과

- `map_beodeul_forms_village`, 50×50, 16동, 강과 두 아치 다리.
- 본체의 폭·높이·용마루 방향·별채·현관을 구분한 신규 여섯 구조와 기존 소형 집·찻집·교회를 함께 배치했다.
- 모든 신규 본체에는 같은 원점의 그림자와 기초를 적용했다. 기존 다섯 맵과 원본 그림은 보존했다.
- 재로드한 실제 맵의 전체 그림은 [reloaded.png](reloaded.png), 여섯 구조 비교는 [families.png](../../public/assets/beodeul-forms/families.png).
- 전체 그림을 직접 열어 확인했고, 실제 player.html의 여관·대장간 화면도 확인했다. 기계 검사 결과를 미적 합격으로 대신하지 않았다.

## 정본 저장·재로드

- 프로젝트 ID: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`.
- 저장 폴더: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004` (`project.sqlite`와 `assets/`).
- 저장 revision: **25**.
- 저장 SHA256: `ea3317c4c13b9098d06e77672e82ad26211327cb31e649f5d0717d238b587a86`.
- 같은 저장 API로 저장한 뒤 별도 프로세스에서 같은 폴더를 다시 열었다. 새 맵을 포함한 여섯 맵, 시작 위치, 공용 구조 키트 18개와 참고문서를 대조했다. [canonical-proof.json](canonical-proof.json).
- 기존 다섯 맵을 보존했으며, 새 맵의 16개 건물 본체 전체 배열을 재로드한 타일 배열과 대조했다. 재로드 그림과 저장 전 그림의 RGB 픽셀도 일치한다.

## 공용 배포

- `beodeul_forms`: 544칸, 16px, 16열, 본체 6개·그림자 6개·기초 6개.
- 공용 `beodeul_city`에 전체 키트와 통행·우선순위 규칙을 이식한다.
- 출처: `tiledata/beodeul-forms/`, 공용 참고문서: `src/assets/beodeulFormsReferences.json` (19 MD, 이미지 3개, 이미지 바이트 내장 없음).
- 새 프로젝트와 기존 프로젝트 모두 여섯 계열을 갖고, 기존 맵·기존 통행을 보존하며 재실행이 멱등인 것을 확인했다. [fresh-existing-proof.json](fresh-existing-proof.json).
- 외부 게임 화면은 구성 참고로만 사용했다. 외부 게임 픽셀은 게임 소재에 넣지 않았다.

## 확인 근거

- `beodeul-architecture build / validate / review`: 원본 보존 경로와 신규 여섯 구조 경로를 모두 실행했다. 원본 해시, 시트 재조립, 입구 및 통행 검사와 검수 그림 확인을 수행했다.
- 시작점에서 16개 문 앞과 두 다리의 양쪽 진입점까지 실제 `canMove`와 도로 칸으로 경로를 계산했다.
- 별도 게임 QA 하네스 `player.html`: 시작 비트와 16개 문 앞까지 실제 도보 이동을 포함한 총 18비트, 실패 0개, 런타임 오류 0개. [runtime/SUMMARY.md](runtime/SUMMARY.md), [runtime/manifest.json](runtime/manifest.json).
- 여관 [실제 게임 화면](runtime/11-bd-house-form-inn-35-8.png), 대장간 [실제 게임 화면](runtime/16-bd-house-form-smithy-42-13.png).
- 실제 문 앞에 모루를 놓으면 정상의 통행 true가 false로 바뀌는 오류 예제를 렌더했다. `tiledata/beodeul-forms/errors.json` 및 `normal-error-native.png`.

이번 결과는 마을 외장과 배치다. 신규 실내, 판매·대화, 문 전이 이벤트를 구현한 결과로 해석하지 않는다. 전체 gates, vitest, 전체 typecheck는 실행하지 않았다.
