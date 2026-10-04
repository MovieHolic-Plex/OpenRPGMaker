# 기존 지형의 AI 재편집 점검 — 2026-10-04

## 결과

- 생산 도구·집 보호·저장 계약 **20개 점검 통과**: `final-contracts/observations.json`.
- 실제 GPT-6 Astra Pi 실행: 요청한 능선·지붕·도로 **3/3 수정**, 실제 통행 **4/4**, SQLite 재로드 일치. `live-fixed/summary.json`, `live-fixed/verified-result.json`.
- 실제 기본 모델 Gemini 3.8 Flash: **패키지 에디터의 입력창·전송 버튼 → 의도 선언 → Pi 실행 → 실시간 적용 → SQLite 저장 → 브라우저 재로드** 통과. `editor/observations.json`, `editor/trace.json`, `editor/verified-result.json`.
- 기본 모델 결과도 요청한 세 생산 도구를 별도로 재실행한 맵과 일치한다. 지붕을 찍은 실제 시각(`stampedAt`)만 비교에서 제외한다. 원본 집 세 채·다른 지도·잠금·기존 경사로 22칸 보존, 계단 0칸, 시야 차단 꺼짐, 네 집터 평탄.
- 2배속 MP4는 실제 Firefox 화면 녹화다. 로그인 구간을 제외하고 1440×960, 20fps, 66.15초로 변환했다. UI를 재구성하거나 모델 답변을 대체하지 않았다.

## 발견해서 고친 문제

| 문제 | 수정 |
|---|---|
| 폭만 바꾸는 재편집이 높이 증가량·시드 등 생략한 값을 기본값으로 초기화 | 기존 `editId`의 점과 설정을 이어받는다. 없는 ID는 변경 없이 거부 |
| 높이 ops가 잠금 칸을 무시하고 기존 집터 일부만 변경 | 잠금 높이 변경·집터/문 앞의 비평탄 변경은 원자적으로 거부. 집터 전체와 문 앞을 함께 올리기는 허용 |
| 집의 투명한 칸과 사각형 밖 문 앞이 지형·호수·군집에 덮임 | 전체 구조물 사각형과 문 앞 보호. 길은 문 앞의 바닥을 칠할 수 있으며 자동 접합이 문 앞 높이를 바꾸면 계획 거부 |
| 조수에게 기존 지붕 수정 도구가 없고 집 보호가 정상 지붕 수정도 거부 | 에디터의 동일 roof 계획을 재사용하는 `resize_terrain_house_roof`. 기존 집에서 재실행한 결과와 네 타일 층·복원 밑그림을 비교해 정확한 지붕 수정만 허용 |
| 두 번째 타일 층 덧칠이 기존 집 보호를 통과 | 네 MZ 타일 층과 기존 두 스택 모두 검사. 벽 변조·다른 집 덧칠·나중에 생긴 사람 편집을 덮는 초안은 거부 |
| 128개 집 카탈로그 때문에 조회 응답 뒤의 feature ID가 12,000자 상한에서 잘림 | 수정에는 `includeCatalog:false`. 원본 외관은 기본 16개씩 조회하고 `catalog.nextOffset`으로 전체 128개 탐색. 실제 Pi 전송 형식으로 잘리지 않는지 점검 |
| 기본 Gemini 모델이 nullable 정수 enum 도구를 전송하기 전에 실패 | 선택값 `[1,2,null]`을 CCA의 `enum:["1","2"], nullable:true`로 보존. 기존 비정상 enum·멤버 변경 거부 유지 |

`contracts/transport.json`은 실제 SDK가 정규화한 Gemini/Claude 전송물 35개 도구를 확인한다. 입력/전송물 불변·재실행 일치·멤버 확대/nullable 변조 거부와 잘못된 스키마 5종 거부도 점검했다. `editor-schema-failure/observations.json`과 `failure.png`는 수정 전 기본 모델의 실제 실패다.

## 저장 대상과 재로드

| 실행 | 프로젝트 ID | 저장 폴더 | 재로드 |
|---|---|---|---|
| 실제 GPT | `af864cef-5fc3-4655-a3aa-1a15db4dccf1` | `.vite-cache/terrain-ai-edit/project` | revision 5, 정확한 요청 결과 |
| 실제 에디터 Gemini | `e62b431c-691f-4e6f-91bc-567e674519c2` | `.vite-cache/terrain-ai-edit/editor-project` | revision 8, 에디터 재로드 및 별도 LocalStore 재로드 |
| 20개 계약 점검 | `bb51ee07-ee96-41bf-8d8d-c7fc4c22d7ff` | `.vite-cache/terrain-ai-edit/final-contracts-project` | `final-contracts/observations.json` |

모두 별도의 QA 정본이다. 사용자 정본 `c779e278-8cec-4da4-9c2f-df423460b60d`에는 QA 쓰기를 하지 않았다.

## 범위와 재현

- 요청은 `live-fixed/task.txt`. 고지 4·6·9의 원본 탑 저택·박공 오두막·날개 집과 낮은 조립식 집을 함께 둔 기존 맵에서 수정했다. 기존 feature ID·높이·시드·문·벽·경사로를 보존하는 사례다.
- 버들항 원본 고정 외관의 지붕 크기는 변경하지 않는다. 지붕 수정은 에디터도 지원하는 조립식 외관에서만 가능하고 원본 외관에는 명시적으로 실패한다.
- 실제 Claude 호출은 설정된 KLB 서비스 연결 거부로 실행하지 못했다. Claude SDK 전송 형식 점검을 실제 모델 실행으로 표현하지 않는다.
- `__oprnAiBridge.send()`는 옛 AssistantSession 경로다. 이번 Pi UI 근거는 native 입력창과 전송 버튼으로 만들었다. 브리지의 읽기 `status()`/`audit()`만 관측에 사용했다.
- 전체 gates/Vitest/typecheck 통과를 주장하지 않는다. 일반 `build`에 포함된 typecheck는 발견 즉시 중단했고, 패키지·플레이어·Electron 빌드와 위의 집중 점검을 수행했다.
- 패키지 에디터/플레이어/Electron 빌드 기준 소스: `af264e469ae216f60b131795e707c7f35b92731e`. 후속 머지·설치 근거는 `deployment.json`에 기록한다.

재현 도구: `scripts/qa/terrain-ai-edit-audit.mts`, `terrain-ai-transport-audit.mts`, `terrain-assistant-live.mts --mode modify`, `terrain-ai-edit-result.mts`, `scripts/capture/capture-terrain-ai-edit.mjs`. JSON 프로젝트/체크포인트와 원시 영상은 로컬 QA 저장소에 두며 Git에는 관측 결과와 선택한 화면만 남긴다.
