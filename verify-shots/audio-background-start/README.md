# 직접 작곡한 OST·효과음과 오프닝 뒤의 맵 준비

## 실제 저장 결과

- 프로젝트 `f25d1f04-88f9-475b-92ee-95a891286d33` / **멈춘 시계의 기억**.
- SQLite: `output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590/project.sqlite`와 같은 폴더의 assets.
- 정본 revision **78**, editor store의 저장 응답과 `verifyPersistedRevision` verified, 새 페이지 재로드 후 같은 배치. 호스트의 SQLite를 직접 수정하지 않았다.
- 원래 타일·이벤트·타이틀 그림/연출·오프닝 6컷과 원곡은 보존했다(`preservation.json`).

| 배치 | 실제 조수 저작 | 길이 | 구성 |
| --- | --- | --- | --- |
| 서재 | 서재의 태엽 소리 | 25.26초 반복 | piano / bell / bass, 76 BPM |
| 기억의 길 | 기억의 회랑 | 21.82초 반복 | flute / strings / pluck / drum, 88 BPM |
| 타이틀 이동 / 확정 / 취소 | 별도 SE 3종 | 70 / 180 / 140ms | 조용한 클릭·상승음·하강음 |
| 오프닝 컷 04 | 시계 빛 공명 | 750ms | bell / noise |

악보·음향 패치는 실제 native UI의 `google-antigravity/gemini-3.8-flash` 실행이 작성했다. 엔진이 내장 합성으로 stereo PCM WAV를 만든다. 외부 음악 생성 모델·샘플 오케스트라·보컬을 쓰지 않았다. `generated-audio.json`은 원래 tool args/result, `audio/`는 SQLite assets에서 해시를 대조해 복사한 실제 WAV다.

## 수행 실패와 복구

첫 실시간 연결 정지와 두 번째 브라우저의 조기 재로드로 모델이 만든 결과를 모두 저장하지 못했다. 같은 run journal의 완료 음원과 연결을 **실제 편집기 store+정본 저장 API**로 복구했다. 마지막 native 조수 실행은 서재 BGM 지정 후 저장 응답까지 기다렸고 재로드를 통과했다. 중간 assignment 시도에는 제공자 MALFORMED_FUNCTION_CALL도 있었다. `attempt-history.json`에 모두 남겼다. 이를 처음부터 끝까지 한 번에 성공한 조수 생성률로 보고하지 않는다.

실제 플레이에서 document와 다음 프레임 Phaser가 같은 짧은 키 이벤트를 두 번 처리하는 문제도 발견해 WeakSet으로 한 번만 캡처한다. 수정 전 실패와 환경의 ERR_NETWORK_CHANGED는 원본 관측 폴더에 보존했다. 최종 출하 플레이는 격리 loopback network에서 같은 ZIP을 그대로 재생했다.

## 확인한 동작

`shipping-artifact.json`은 다운로드한 ZIP과 실제 SDK 소스 판본, 모든 JS/CSS 6파일의 해시 일치를 기록한다. **출하 player.html/export shim**에서 원본 6컷 자연 재생과 실제 방향키·대화·두 선택지·장소 전환·엔딩을 확인했다. 두 경로 24비트 모두 통과, runtime error 0, 정상 오프닝 로딩 카드 관측 0회. 실제 두 맵 음악의 재생 및 생성한 오프닝 SE의 SHA/play 이벤트를 대조했다.

`edges/`는 같은 출하 코드와 실제 그림/음원을 쓰는 분리 fixture다. 오프닝 중 준비된 맵의 이동·변수·스위치·시계·RNG가 멈추는지, 엔진 지연/즉시 skip의 마지막 화면 유지, title SE의 실제 WAV 해시/재생, 오류 복구 패널을 확인한다. fixture는 정본을 변경하지 않는다.

- `final-connection/opening-to-game.mp4`: 실제 연속 browser video + native audio. crop/scale/encode만, 속도 변경·가짜 프레임·후시 음악 없음.
- `final-connection/opening-to-game.gif`: 같은 영상의 무음 파생.
- `final-connection/media.json`: 원본 해시·녹화 시간 기준의 근사 AV 정렬.
- `audio/samples.json`: 실제 SHA, PCM peak/RMS, 반복 OST의 처음/끝 100ms 에너지. SE 종료의 의도된 무음은 정상이다.

Vite app/player 빌드 완료. 로컬 Vitest/gates/전체 typecheck는 AGENTS.md의 명시적 실행 제한 때문에 돌리지 않았다. 계약 테스트를 추가했으며 이 문서는 자동 합성 성공을 청취 품질 합격으로 대신하지 않는다. 합성 악기의 질감·곡의 길이는 상용 녹음 OST 수준으로 일반화할 수 없다.

즉시 확인: `final-connection/frames/1.png`, `final-connection/frames/4.png`, `edges/slow-wait.png`, `edges/error-recovery.png`.

검증 도구 교정 이력: 첫 UI SE 시도는 keyboard-only 화면에서 포인터 클릭을 써 중단됐다. 다음 시도는 8초 fixture가 cold map 준비보다 먼저 끝나 `map ready && opening visible` 관측을 놓쳤다. 실제 마지막 화면 유지와 상태 활성화 순서는 기록됐고 로딩 카드 관측은 0이었다. 냉기동 중 상태 동결 측정은 긴 fixture, 짧은/skip 지연 측정은 8초 fixture로 분리했다. 이 이력은 제품 합격 수에 합치지 않는다.

엔진 모듈 503 주입은 기존 자동 새로고침 복구를 먼저 거친다. 재시작해도 503이면 시네마틱을 취소하고 명시적 복구 패널을 보여 준다. 오류 관측은 이미 통과한 정상/느린/skip 3건을 영수증 해시로 보존한 뒤 남은 오류 사례만 실행한다.
