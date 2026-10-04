# 편집기 UX 지연 감사 — 2026-10-04

먼저 고칠 순서는 **자료집 타이핑 → 되돌리기 → 긴 이벤트 편집**이다. 세 경로 모두 최신 편집기에서 지연을 직접 재현했다. 다음으로 팔레트·맵 목록, 높이 도구, 숨은 미리보기, 저장/조수 체크포인트를 다룬다.

기준: `main` d7a3f0136e. 조수 UI PR #2049와 오른쪽 영역 드래그 PR #2053 이후다. 10명의 서브에이전트(9개 영역 조사 + 1개 독립 검토)를 6명 동시 실행 한도 안에서 두 차례로 배치했다. 원래 조사에서 24개 코드 후보를 찾았고, Ctrl+Z를 별도로 재조사했다. 조사 에이전트는 소스만 읽었고 감독자가 브라우저 측정을 직렬로 실행했다. 제품 코드는 바꾸지 않았다.

## 직접 측정한 사용자 동작

Chromium의 실제 편집기를 1440×900, 배율 1, CPU 제한 없이 실행했다. 임시 UI fixture에는 32×24 / 128×128 / 512×512 바닥 맵을 사용했다. 자료집은 아이템 25 / 250 / 1,000개, 이벤트는 단순 문장 명령 100 / 1,000개로 구성했다. 모델·팀 호스트·정본 SQLite 쓰기는 사용하지 않았다. 공용 참고문서 hydration을 비워 이 비용은 측정에서 제외했다. reduced-motion 상태이므로 자동 재생 미리보기 비용도 이 결과에 포함되지 않는다.

아래 시간은 **자동화 입력 시작 → 다음 두 requestAnimationFrame**까지다. Playwright 통신과 프레임 대기가 포함되며, 픽셀이 표시된 시점이나 순수 함수 시간은 아니다. 일반 동작은 조건당 3회 중앙값이고 이벤트 열기는 조건당 1회다. 45개 기본 측정 구간 + 14개 자료집/이벤트 구간, 총 59개다. 두 실행 모두 uncaught page error는 0개였고, 없는 로컬 계정 서비스에 대한 console 네트워크 오류는 있었다. Vite 개발 모드/합성 프로젝트의 결과를 사용자 정본이나 Electron 출하 성능으로 일반화하지 않는다.

| 동작 / 데이터 크기 | 중앙값 / 단일 열기 | 관찰한 근거 |
|---|---:|---|
| 아이템 설명 1글자 / 25개 | 225ms | 글자마다 행 25개 제거 + 25개 생성 |
| 아이템 설명 1글자 / 250개 | 509ms | 글자마다 행 250개 제거 + 250개 생성 |
| 아이템 설명 1글자 / 1,000개 | **1,291ms** | 글자마다 행 1,000개 제거 + 1,000개 생성 |
| Ctrl+Z / 32×24 | **559ms** | 단일 main-thread long task 최대 378ms |
| Ctrl+Z / 128×128 | 496ms | 단일 long task 최대 310ms |
| Ctrl+Z / 512×512 | **860ms** | 단일 long task 최대 684ms |
| 이벤트 목록 열기 / 명령 100개 | 555ms | 페이지 DOM 전체 5,130개 노드 |
| 이벤트 목록 열기 / 명령 1,000개 | **3,521ms** | 페이지 DOM 전체 32,130개 노드 |
| 한 칸 칠하기 / 32×24 | 106ms | updateMapTiles 콜백 자체 중앙값 2ms |
| 한 칸 칠하기 / 128×128 | 74ms | 콜백 자체 중앙값 1.5ms |
| 한 칸 칠하기 / 512×512 | 197ms | 콜백 자체 중앙값 3ms, 후속 구간 long task 최대 132ms |
| 레이어 전환 / 32 / 128 / 512 | 173 / 165 / 152ms | 각 조건 최대 long task 81 / 79 / 74ms |
| 줌 단추 / 32 / 128 / 512 | 123 / 126 / 142ms | 해당 구간에서 ≥50ms long task 없음 |

자료집 설명 입력은 실제 record.description이 `descriptionaaa`로 바뀌었고 입력 포커스가 유지되는 것을 확인했다. 한 칸 칠하기도 실제 타일값 23을 매번 확인했다. Ctrl+Z는 실제 키보드 경로를 측정했으나 이 스크립트가 각 역변환의 타일값을 별도로 단언하지는 않는다. 이벤트는 네이티브 목록 모드의 100/1,000개 표시를 확인했다. `data-command-path`로 세려던 행 수는 0이므로 그 값은 행 수 근거로 쓰지 않는다.

원본: [기본 측정](measurements.json), [폼 측정](forms/measurements.json), [구간별 스타일·레이아웃 trace](trace-costs.json). trace는 basic 실행의 시작/종료 UserTiming 표시와 renderer style/layout/paint 비용만 남겼다. 숫자는 DOM 작업량과 함께 평가하며 노이즈가 있는 단일 시간만으로 후보 전부를 확정하지 않는다.

## 우선순위와 좁은 수정 단위

| 순서 | 문제 / 근거 수준 | 다음 수정 단위 | 완료 확인 |
|---|---|---|---|
| 1 | 아이템 설명·필터가 무관한 전체 행을 다시 만듦. 지연과 행 변이를 직접 측정 | 설명/가격 등 목록 투영에 없는 변경은 목록 갱신 제외. 이름·분류 변경은 해당 행만 갱신. 대형 목록은 가상화 | 1,000개에서 설명 한 글자 입력 시 행 추가/제거 0. 포커스·IME·선택·필터 유지 |
| 2 | Ctrl+Z가 맵 복사와 project 범위 통지로 캔버스/독 재구성을 유발. 지연 측정, 각 함수의 비용 기여는 아직 미분리 | tile history에 변경 칸/범위를 보존해 증분 복원·증분 렌더. 지도만 복원하고 빈 draft reconciliation은 빠른 경로로 | 한 칸 undo/redo가 해당 칸만 바꿈. 카메라/선택/열린 event draft와 순서 보존. 같은 fixture before/after |
| 3 | 긴 이벤트 목록. 열기 지연 직접 측정, 숨은 storyboard 생성은 독립 코드 검토로 확인 | 활성 목록/스토리/흐름 보기만 생성. 리스트 행 가상화 또는 단계적 마운트. Tab trap의 숨은 컨트롤 열거 축소 | 1,000명령 첫 표시 개선. 접힌 분기·검색·드래그·키보드·스크롤·검증 위치 일치 |
| 4 | 필터된 타일 선택 시 닫힌 보조/키트 팝업까지 생성; 맵 목록 두 번 재구축. 코드 후보 | 필터 중에도 선택 강조를 제자리 변경. 팝업 내용은 열 때 생성. 맵 선택 갱신 소유자 하나로 | Beodeul 필터 선택 / 200맵 전환에서 팝업 canvas 생성 0, 트리 갱신 1회 |
| 5 | 높이 hover가 캐시 확인 전에 전체 levels/ramps 해시. 코드 후보, 독립 검토 확인 | 맵 변경 버전에 연결한 signature 캐시 + field.maxLift 재사용. 전역 pixel buffer는 strip/page 단위로 나눔 | 같은 칸 hover에 전체 맵 탐색 0. 작은/최대 높이 수정에서 메모리와 CPU 측정, 높이 픽킹 동일 |
| 6 | 연결된 숨은 스킬 미리보기가 계속 rAF; 오프스크린 캐릭터 카드도 애니메이션. 코드 후보 | UI 미리보기의 가시성에 실행 수명 연결. 보이지 않는 그림은 정지 | 숨은/접힌/최소화 상태의 preview draw 0. 조수 작업·저장 등 실제 백그라운드 작업은 계속 진행 |
| 7 | save diff의 yield가 맵 사이에만 있음; spatial 체크포인트 roundtrip은 heavy-entry reuse를 끔. 코드 후보 | 변경 맵/항목 단위 비교·worker 또는 resumable serialization. spatial 의존성 보존한 lint 재사용 | 원래 권위·lint·commit·정본 저장/재로드 계약 유지. 입력 도중 긴 동기 작업과 데이터 왕복 측정 |
| 8 | AI 대화 검색이 매 키마다 전체 IDB getAll+검증+정렬; 리소스 목록 전체 재생성. 코드 후보 | 대화 summary/index/pagination + debounce. 소재 선택은 제자리 변경, audio 가상 목록 재사용 | 많은 기록/소재에서 작업량이 총수보다 보이는 페이지 크기에 따름; 검색/역사 이미지 정확성 유지 |
| 9 | Electron 공용 카탈로그 경로가 ETag validator를 전달하지 않음. native 측정 전 코드 후보 | 프로토콜에서 If-None-Match/ETag/304 계약 보존 | Electron 두 번째 실행에서 body 재압축 해제/parse를 생략하는지 따로 확인 |

## 다른 후보와 보고서

- [canvas](agents/canvas.md): 높이 hover 전체 탐색, relief backing buffer, 파괴된 타일 추적 축적.
- [palette/sidebar](agents/palette-sidebar.md): 필터 팔레트의 닫힌 팝업 생성, 맵 트리 중복 갱신/O(M²) 열거, 진행 패널의 전체 이벤트 복제.
- [database](agents/database.md): 아이템 행 재구성, 이름 입력마다 전체 명령 참조 스캔, 생활 컬렉션의 숨은 inspector/dropdown 전체 생성.
- [events](agents/events.md): 비활성 보기 생성, 명령 이동의 맵/페이지 복제, 선택지 이름마다 분기 전체 복제.
- [assistant](agents/assistant.md): 기록 getAll 검색, spatial roundtrip 재사용 제한, 활동 이미지의 atlas 색 키 처리 반복.
- [storage/undo](agents/storage-undo.md)와 [Ctrl+Z 후속](agents/storage-undo-followup.md): idle callback 안의 비분할 기준선 준비, save whole-map 직렬화, history 점프와 단일 undo.
- [assets](agents/assets.md): 전체 이미지/SE 목록 재구성, 안 보이는 캐릭터 카드 애니메이션.
- [startup/idle](agents/startup-idle.md): Electron 캐시 계약 누락, parked DB의 자동 재생.
- [global DOM](agents/dom-global.md): 긴 event modal의 매 Tab 포커스 후보/geometry 열거.
- [independent verification](agents/verification.md): 대표 네 주장에 대한 도달성 확인과 과장 제거.

코드 산식상 1024² relief의 전역 RGBA(4바이트)+owner(2)+part(1)만으로 **1.75GiB**가 필요하다(패딩/다른 버퍼 제외). 이 크기를 실제로 할당해 측정한 결과는 아니다.

검토에서 바로잡은 부분: 이벤트의 숨은 storyboard는 생성 뒤 목록 모드에서 제거된다(지속 보유 주장 제외). 높이 maximum 스캔은 hover 칸 변경 때이며 signature 스캔과 구분한다. 큰 맵 undo도 현재 camera-window 렌더링을 쓰므로 512² 전체 타일 객체 생성이라고 하지 않는다. history의 per-entry 복제는 타일셋/업로드를 공유한다. warm gallery의 이미지 재디코드는 입증되지 않았다. Tab의 많은 offsetParent 읽기를 모두 별도 reflow라고 세지 않는다. 기존 CSS/i18n 전체를 일반적인 원인으로 단정하지 않았다.

## 재현

```bash
npm run dev:worktree
BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-audit.mjs
# 앞 측정이 끝난 뒤 직렬 실행
BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-forms-audit.mjs
```

전체 테스트·게이트·Vitest·typecheck는 세션 제한에 따라 실행하지 않았다. 기록은 UI 조사이며 정본 저장 증거나 수정 완료 보고가 아니다. 제품별 대응 패치를 만들 때는 해당 동작의 before/after와 편집 정확성을 함께 확인한다.
