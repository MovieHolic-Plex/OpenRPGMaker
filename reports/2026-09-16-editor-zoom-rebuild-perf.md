# 편집기 대형 맵 렉 — 줌 재빌드와 부팅 크래시 (2026-09-16)

대형 맵에서 남아 있던 렉의 주범을 계측으로 특정했다. 8/30 런타임 수정(PR #263/#271)과
그 뒤의 편집기 컬링(`dc0773829`)은 유효했다 — 정지 프레임은 256×256에서도 문제가 없다.
남은 것은 **줌 1단계마다 타일 오브젝트 전체를 다시 만드는 경로**였다.

## 실측

측정 하네스: `test/e2e/_large-map-perf.spec.ts` (진단 스펙, 기본 스위트 제외).
시드: `test/fixtures/projects/system-shell-v3.json`의 맵을 N×N으로 키우고, 앱의 정규화기
(`validateProjectV4`)를 페이지 안에서 태워 심는다. 환경: chromium headless + swiftshader,
공유 박스(loadavg 50~70) — 절대값은 실제 GPU 환경보다 느리고 흔들린다. 크기 간 상대 증가를 본다.

원자료: `verify-shots/editor-large-map-perf/zoom-before.jsonl` · `zoom-after.jsonl`
(수정 전/후 같은 스펙을 각각 한 번씩 돌린 기록 — `zoomSteps` 가 줌 디스패치의 동기 벽시계다.)

| 맵 크기 | 타일 오브젝트(근사) | 줌 1단계 — 수정 전 | 줌 1단계 — 수정 후 |
|---|---|---|---|
| 48×48 | 약 2.5천 | 677~ 894 ms | 33~ 54 ms |
| 96×96 | 약 1만 | **11.0~22.8 초** | 30~ 54 ms |

- 줌 레벨 상한에 닿아 `editorState.set`이 무변화로 무시되는 단계는 전후 모두 ~0.5 ms.
  이 내부 대조군이 "측정된 시간은 재빌드 비용"이라는 인과를 닫는다.
- 오브젝트 4배(48²→96²)에 시간이 16~25배 — 초선형이다.

## 원인

1. `EditScene.renderStateKey`에 `state.zoom`이 포함되어 있었다 → ctrl+휠 한 칸마다
   `redrawWhenViewStateChanges` → `redraw()` → `container.removeAll(true)` + 타일 전체 재생성.
2. 그 재생성이 **O(N²)**다. Phaser 3.90에서 `Container.add`는 자식을 이전 display list에서
   떼는데(`removeFromDisplayList` → `DisplayList.remove` → `ArrayUtils.Remove`의 `indexOf`),
   `Container.remove`/`removeAll(true)`의 destroy 경로도 같은 `indexOf`를 탄다. 즉 오브젝트
   하나를 넣고 뺄 때마다 자식 목록 전체를 훑는다 — 생성·파괴가 모두 O(N)이라 전체는 O(N²).

## 수정

- `renderStateKey`에서 `zoom`을 뺐다. 타일 오브젝트의 모양·좌표는 줌에 의존하지 않는다
  (확대는 카메라 속성이다).
- 줌 변경은 `applyCameraZoomOnly()`가 처리한다: `applyCameraView(preserveLookAt=true)` +
  내비게이션 기하 + 배경 미리보기 레이아웃 + 뷰포트 게시. 화면 밖 타일 컬링은 다음 `update()`
  프레임에 `worldView` 변화를 보고 스스로 다시 계산한다.
- `editor-zoom-preserves-look-at.spec.ts`의 주 검증(팬 뒤 줌이 look-at을 보존한다)은 수정
  뒤에도 통과한다. 같은 파일의 "기록을 펼치면 가시 사각형이…" 테스트는 클린 트리에서도
  같은 이유로 실패하는 기준선 실패다(수정 전후 동일).

## 남은 것 (미해결)

- **페인트 드래그**: 샘플당 186~240 ms, 프레임 최대 233~683 ms. 셀+8방 이웃×2레이어 재생성에
  더해 증분 렌더마다 `tileLayer.sort("depth")`가 자식 전체(최대 13만)를 정렬한다. 후보 수정:
  lower/upper 컨테이너 분리로 정렬 제거, `scene.make`+`addAt`으로 재부모화 회피, 스토어 커밋
  프레임 배치.
- **정지 프레임**: 컬링 뒤에도 Phaser가 display list를 매 프레임 순회한다(O(N)). 실기기 영향은
  미측정.

## 곁가지 결함 (같은 PR)

정규화를 거치지 않은 프로젝트(옛 JSON 저장본·e2e 시드)에서 참조 검증이 던져 **에디터 부팅이
통째로 죽었다**:
- `validateActorEquipment`의 `Object.values(undefined)` (배우에 `initialEquipment` 없음)
- `validateClassRecords`의 `.map(undefined)` (클래스에 `learnedSkills` 등 없음)

`collectProjectReferenceIssues`는 "이슈 수집"이 계약인데 최상위 검증 호출들이 `check()` 밖에
있었다. 전부 `check()` 안으로 넣어 예외도 이슈 문자열로 남긴다. 회귀: `test/showcaseProjectReferences.test.ts`.
