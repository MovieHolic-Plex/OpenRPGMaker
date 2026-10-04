# 배경 준비와 오프닝 컷 연출 — 실제 출하 플레이어

## 결과

- 실제 조수로 기존 저장 게임 「멈춘 시계의 기억」의 원화를 수정했다. 새 프로젝트의 자동 첫 제작 성공으로 계산하지 않는다.
- 프로젝트: `f25d1f04-88f9-475b-92ee-95a891286d33`, SQLite revision **41**.
- 정본: `output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590/project.sqlite`와 같은 폴더의 `assets/`. 브라우저 재로드와 실제 그림 세 파일의 SHA-256/길이를 확인했다.
- 실제 편집기 메뉴로 받은 `output/qa/opening-cinematic-v4-ordered/game-web.zip`을 그대로 풀어 `player.html`에서 재생했다. ZIP/JSON/코드를 수작업으로 바꾸지 않았다.
- 두 선택지 각각 타이틀 → 오프닝 3컷 → 첫 입력 → 시계 조사 → 선택/응답 → 다음 맵 → 엔딩, **18/18 비트 통과**. 런타임 예외와 외부 URL 요청은 없었다.
- 로딩 **4/4 상황 통과**: 늦는 그림 동안 타이틀/이전 컷 유지, HTTP 캐시를 꺼도 디코드된 그림 재사용(각 1회), 404 뒤 R 재시도, 엔진 응답을 잡아 둔 채 reduced motion/Esc 스킵 후 실제 첫 플레이. 늦게 온 그림이 오프닝을 되살리지 않았다.
- 두 번째 컷은 늦게 디코드된 뒤 **4초 전체**를 재생했다. 마지막 원화가 맵 준비 중 배경으로 유지되는 것도 관찰했다.

## 영상과 근거

![타이틀부터 첫 선택까지 실제 재생](opening-to-first-choice.gif)

GIF는 실제 정상 motion/키보드 재생을 8fps로 변환했다. 첫 실행의 문장 읽기 2.5초/샷 관찰 1.8초 대기만 포함한다. 컷 시간을 늘리거나 장면/게임 코드를 바꾸지 않았다. 처음 부팅하는 빈 구간과 화면 바깥 여백만 잘랐다. `gif.json`에 원본 WebM과 구간을 기록했다.

- `repair-receipt.json`: 실제 `generate_opening_image` → `edit_opening` → 원화 4장 이미지 전달 → 작업 종료. 전체 대형 wire 대신 도구 인자/결과/id만 남겼다.
- `reloaded.json`: 저장·브라우저 재로드 후 같은 revision/document/maps/원화. 추가 모델 요청 0회.
- `export.json`, `package-receipt.json`: UI 내보내기와 변조하지 않은 패키지 해시/SDK 출처.
- `gameplay.json`, `keep/SUMMARY.md`, `release/SUMMARY.md`: 두 선택지 실제 재생.
- `loading.json`, `loading/SUMMARY.md`: 지연/요청 재사용/오류 복구/스킵.
- `visual/SUMMARY.md`: 기능 비트와 별도로 본 컷 구성·자막·흰 WebGL 잔상 판정.
- 조사: [RPG 일곱 작품 공식 자료와 적용 판단](../../openwiki/rpg-opening-research.md).

## 수정 과정과 한계

배경 준비에서 Phaser와 PlayScene을 병렬로 평가했던 오류를 발견했다. `PlayScene`은 Phaser가 먼저 있어야 하므로 순서를 고쳤다. `failed-engine-ordering.json`에 실패를 보존했고, 최종 로딩 QA는 엔진 응답을 의도적으로 막은 상태에서 스킵해 수정된 출하물을 확인한다.

조수의 마지막 원화 제작은 성공했지만 최초 관찰자의 스크린샷이 시간 초과됐다. 원화가 실제 정본에 저장된 사실은 별도의 일반 브라우저 재로드로 확인했다. 이전 Google 이미지 할당량 실패와 이 관찰 실패를 새 자동 제작 성공으로 세지 않는다.

현재는 **서재 원경 → 빛나는 시계 근접 → 손을 뻗는 인물**의 서로 다른 실제 원화 3장과 카메라·빛·입자·효과음·전환 연출이다. 인물 프레임 애니메이션을 만들었다고 주장하지 않는다. 원경 공간 규모와 인물 의상은 픽셀 게임 화면에 더 맞출 여지가 있다. 타이틀·오프닝 분위기 개선이 고급 RPG 수준의 전체 연출 완성을 의미하지 않는다.

엔진/그림을 타이틀 뒤에서 준비하지만 Phaser 텍스처 생성과 맵 구성은 게임 시작 때 수행한다. 출하 ZIP은 약 355MB로 아직 크다. 이번 변경은 패키지 크기를 줄이지 않았다.

`build:app` → `build:player`는 성공했다. 로컬 Vitest/gates/전체 typecheck는 AGENTS의 실행 제한에 따라 실행하지 않았다. 계약/저장/장면 시간 회귀 검사는 추가했으며 실제 브라우저 근거와 구분한다.
