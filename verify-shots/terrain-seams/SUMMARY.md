# 경사로 통행·버들항 원본 집·절벽 바닥 접합 QA

## 확인한 문제와 수정

- 경사로 걷기는 타일 중심 들림을 보간하고 클릭은 평지 좌표를 골라, 실제 발과 보이는 비탈/목표가 어긋났다. 실제 물리 발 좌표의 연속 경사 기하, 보이는 윗면 화소 선택, Phaser worldView 줌 원점으로 수정했다. 끊긴 표기와 옆구리 진입은 통로로 인정하지 않는다.
- 조수에게 크기 조절용 집 스타일 6종만 안내하고 원본 외관을 노출하지 않았다. 원본 키트 128개(도시 구역/생성 집 제외)를 inspect_terrain.houseKits와 에디터 외관 목록에 연결했다. 주택/저택/목조집/다른 외관으로 나누고 12개씩 넘긴다. 조립 스타일과 지붕만 조절하는 경로는 별도 선택으로 유지한다.
- 절차적 잔디 팔레트와 실제 바닥 타일을 따로 그려 대각선 모서리·윗턱·비탈 접합의 색과 소유권이 달랐다. 실제 현재 칩셋 하층/겹침/2층/그림자/autotile을 합성해 윗면과 경사로에 투영한다. 하층 바닥 변경도 이웃을 포함한 부분 갱신으로 반영한다.
- 실제 도로 폭 2가 1칸으로 줄어들던 원/폭 계산을 고쳤다. 전체 경사 길이와 두 층계참을 확보한 경우만 경사를 생성한다. 미리보기의 높이/경사/수심 배열도 복사해 원본과 Undo를 보호한다.

## 정본 저장과 실제 조수

사용자 저장소 `/home/main/.local/share/oprn/web-workspace/project.sqlite`는 읽기만 했다. 확인 당시 지도 121개, 높이를 가진 지도 0개였다. 시연 콘텐츠는 사용자 지도에 쓰지 않았다.

별도 실제 SQLite 프로젝트:

- project id: `9f70cb93-c831-4ab9-a6fe-d46a3634beff`
- 저장 폴더: `.vite-cache/terrain-seams/project`
- 실제 모델 `opencodex/gpt-6-astra`, 편집기와 같은 레지스트리/계획기로 실행. UI 의도 분류 요청을 대신하는 증거는 아니다.
- 모델은 현재 프로젝트의 참고문서와 원본 이미지들을 읽고 높이 4/6/9의 평탄한 집터에 `bd-manor-tower`(14×11), `bd-out-cabin`(5×6), `bd-out-house-plank`(8×6)를 배치했다. 세 문 앞 모두 도달했다.
- 최초 모델 저장 revision 2 후 같은 SQLite를 다시 load해 지도 동일. 16턴/27도구 호출, 잘못된 editId 1건을 스스로 고친 뒤 완료했다. 경사 표기 22칸, 지형 계단 0칸. 탑 저택 현관의 원본 계단 그림은 외관 키트의 일부다.
- `assistant/summary.json`, `tools.json`, `task.txt`가 실제 호출/선택/재로드 근거다. 실제 입력·출력이며 모델 응답을 캡처 스크립트에서 대체하지 않았다.
- 에디터 QA는 같은 SQLite 호스트에 연결해 표면과 폭 2칸 도로를 실제 UI로 저작/저장한 뒤 Undo했다. 페이지 재로드 후 세 지도 SHA가 시작과 동일하다. 최종 revision은 `editor/observations.json`에 있다. revision 증가는 시연 Undo와 부팅 메타데이터도 포함한다.

## 접합부 전량 시트 확인

현재 SQLite에서 재로드한 세 지도의 동/남 이웃 높이가 다른 모든 논리 접점에 좌표 ID를 부여했다. 각 접점의 윗면과 낮은 발치 밴드를 별도 잘라 전량 열었다.

| 지도 | 접점 | 전량 검토한 시트 |
|---|---:|---:|
| terrain_ai | 388 | 13 |
| ramps_four | 492 | 17 |
| houses_native | 306 | 11 |
| 합계 | 1,186 | 41 |

`current/manifest.json`은 저장소·revision·재로드 SHA·실제 경사 기하를, 각 `contacts.json`은 좌표/방향/양쪽 높이를 기록한다. 네 방향 매끈한 비탈, 잔디/흙/돌, 높은 단/낮은 단, 볼록/오목 경계와 대각선 접점을 포함한다. 앞쪽 높은 벽에 가려진 논리 접점도 목록에 포함되므로 **1,186곳이 모두 독립적으로 화면에 노출됐다는 뜻은 아니다.** 이 세 지도에 대한 전량 검토이며 임의의 모든 프로젝트/절벽 양식에 대한 일반 보장은 아니다.

즉시 확인:

- `current/houses_native/full-map.png`: 실제 조수가 고른 원본 세 외관과 고지/길.
- `current/ramps_four/full-map.png`: 네 방향 + 잔디/흙/돌 접합.
- `current/terrain_ai/contacts-top-foot-07.png`: 높은 벽·길·바닥의 접점.
- `current/ramps_four/contacts-top-foot-17.png`: 마지막 접점까지 검사한 시트.
- `before/full-map.png`: 수정 전 렌더 자료. 수정 전 집 예시는 조립식 세 집이며 원본 세 집 모델 결과와 혼동하지 않는다.

## 출하 플레이어의 실제 입력

`runtime/observations.json`과 `ramp-*-frames.json`:

- 편집기 play가 아닌 출하 `player.html`/웹 export shim 사용.
- 네 방향 모두 실제 키보드 오르기/내리기, 두 표시 배율에서 실제 마우스 클릭 목표까지 왕복, 옆구리 진입 차단.
- 매 프레임 렌더된 sprite 발을 독립적으로 저작한 높이 0→3/길이 4칸 시나리오와 비교. 최대 발 높이 오차 0px(관측 프레임), through 이동 없음.
- 실제 AI의 세 경로를 충돌 규칙이 적용된 정상 이동으로 따라 세 문 앞 칸 자체에 도달.
- 시나리오 시작 위치만 명시적으로 초기화한다. 이동 중 목적지로 순간 이동하지 않는다.
- 페이지 오류 0. 이 시나리오의 통행과 렌더 접지 근거이며 모든 이벤트/몸 크기/전투 필드 배치 검증은 아니다.

## 실제 패키지 에디터

`editor/observations.json`:

- 사용자 UI로 원본 주택 70개/저택 4개/목조집 4개 목록 선택, 주택 다음 페이지로 다른 키트 노출, 탑 저택 선택 확인. 나머지 원본은 다른 외관 분류다.
- 조립 스타일 6개와 지붕만 조절 컨트롤 노출 확인.
- 절벽 위 원본 바닥을 돌로 바꾸면 전체 굽기 횟수 증가 없이 window 한 번으로 갱신. 같은 화면의 전체 재생성 결과와 패치 화소 일치.
- 도로 폭 2를 선택하고 실제 드래그: x=12/13의 y=11…14, 총 8칸 매끈한 경사 표기. 저장 후 검사하고 Undo/재로드해 지도 복원.
- 최종 페이지 오류 0, 저장된 세 지도 SHA 보존.

## 재현 명령

실제 프로젝트 폴더/호스트를 준비한 뒤 아래 범위를 사용한다. 모델 실행은 `scripts/qa/terrain-assistant-live.mts`의 현재 프로젝트 참고문서 게이트를 따른다. 실행 중인 호스트 DB를 별도 프로세스로 수정하지 않는다.

```sh
bun scripts/capture/inspect-terrain-seams.mts --project <별도 SQLite 프로젝트> --out verify-shots/terrain-seams/current
python3 scripts/capture/terrain-seam-sheets.py verify-shots/terrain-seams/current
TERRAIN_QA_PROJECT=<폴더> TERRAIN_QA_URL=<자기 호스트> node scripts/capture/capture-terrain-seams-editor.mjs
node scripts/capture/capture-terrain-seams-runtime.mjs --source <실제 모델 실행 폴더> --cases <네 방향 시나리오.json>
```

2배속 MP4는 캡처 당시 Chromium 실제 프레임/시간으로 만들며 재구성 그림이 아니다. 큰 영상과 전체 프로젝트 JSON은 git에 넣지 않는다. 사용자에게 전달하는 영상은 에디터와 출하 플레이어 기록을 이어 붙인 것이다.

빌드: 최신 main 통합 후 `build:packaged`, `build:player`, `build:electron` 완료. 로컬 gates/Vitest/전체 typecheck/stash는 AGENTS 규칙에 따라 실행하지 않았다.
