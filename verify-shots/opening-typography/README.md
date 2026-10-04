# 글자·장면 오프닝 저작과 실제 재생

## 실제 저작·저장

- 게임: 멈춘 시계의 기억, project id `f25d1f04-88f9-475b-92ee-95a891286d33`.
- 정본: `output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590/project.sqlite` + assets.
- 실제 조수가 get_opening/show_title_opening → set_opening → 재조회로 4장면을 저장했다. 새 그림 생성은 요청하지 않았고 기존 세 그림을 재사용했다. 새로운 첫 제작 성공과 혼동하지 않는다.
- 모델 저장 revision 43. 실제 DB 폼으로 글자 등장 시간 1500→1400ms 저장·일반 재로드 확인 후 1500ms로 복원하여 revision 45. 최종 일반 재로드에서 프로젝트 문서와 맵 해시·세 원화 바이트가 일치한다. 추가 모델 요청 0.
- `assistant-receipt.json`: 실제 모델 도구 영수증. `task.txt`: 요청 원문. `editor.json`: 실제 폼과 미리보기. `reloaded.json`: 정본 재로드와 자산 SHA 근거.

## 지원 범위

- 공통 presentation을 text/image/video에 저장한다. 기본형 자막/서문/챕터/회상/크레딧.
- 글자: 즉시/페이드/상승/한 글자씩/흐림 해제/스크롤. 명조·고딕·도트, 크기·색·위치, 등장 대기·등장 시간·퇴장 페이드.
- 장면: 컷/페이드/디졸브/와이프/원형/섬광, 별도 퇴장 시간·배경 색·상하 띠. 이미지의 카메라/빛/입자/SE와 조합한다.
- 첫 합성 화면을 정착시킨 뒤 시간을 시작하며, 마지막 이미지는 실제 맵 준비가 끝날 때까지 유지하고 저작된 exitMs로 게임을 드러낸다.
- 실제 인물의 프레임 동작은 영상 장면이나 별도 이벤트 연출의 저작이 필요하다. 이 데모의 손·인물 그림은 정지 원화다.

## 출하 검증

최종 코드(main 통합 `44de1f2419`)를 UI 메뉴에서 내보낸 ZIP의 내용을 수정하지 않고 player.html/export shim으로 검증한다. `package-receipt.json`의 SHA/크기와 `export.json`을 대조한다. 전체 vitest/typecheck/gates는 세션 AGENTS 실행 제한에 따라 실행하지 않았다. 단위 회귀 계약은 추가했지만 실행했다고 보고하지 않는다.

- 저장된 실제 게임의 두 선택지: **20/20 비트 PASS**, 런타임 예외 0, 외부 URL 0. 음원 해제 때의 정상 ERR_ABORTED는 요청 실패 목록에 그대로 남긴다.
- 글자/전환 기능 전용 fixture: **3/3 묶음 PASS**. 유니코드 grapheme/리터럴 HTML/확인 두 단계, 모든 등장 방식과 스크롤/독립 퇴장, reduced-motion과 Esc 후 타이머 해제를 확인했다.
- 로딩: **4/4 PASS**. 그림 지연 중 이전 합성 프레임 고정, 정상 실행 그림 HTTP 각 1회, 404 재시도, 엔진 응답을 보류한 상태에서 Esc 후 실제 플레이 복귀를 확인했다.
- ZIP: **355,100,119 bytes**, SHA256 `7de5a1b38738cfca0011b3186bad75978b1fd45200873b20c0b1440c09068e37`. SDK artifact `6dd2841b07fc8d29`, renderer source revision `44de1f2419`.
- GIF `opening-to-first-choice.gif`: 정상 연속 녹화의 10~54초, 44초/840px/10fps, **18,349,821 bytes**. 재생 시간을 가속하거나 오프닝을 건너뛰지 않았다. GIF는 무음이며 실제 원본 영상의 첫 행동/선택 장면까지 포함한다.
- `keep/SUMMARY.md`, `release/SUMMARY.md`, `features/SUMMARY.md`, `loading/SUMMARY.md`를 먼저 읽는다. 시각 판정은 `visual/SUMMARY.md`와 실제 연속 영상의 추출 PNG에 따로 기록했다.


## 실패를 남긴 이유

`before-paint-clock`, `observer-before-cdp`, `observer-before-video`는 폐기된 관측/수정 전 증거다. 3초 장면 중 브라우저 스크린샷 대기가 다음 장면까지 넘어가 정확한 장면 소속 검사가 실패했다. 그래서 정상 연속 영상으로 오프닝을 기록하고, PNG는 영상에서 추출한다. 실제 영상을 눈으로 확인하면서 무거운 타이틀의 첫 서문 시계 소모와 마지막 암전 후 긴 검정 화면도 발견하여 재생기/인계를 수정했다. 실패를 최종 합격 근거에 섞지 않는다.

## 남는 한계

큰 출하 ZIP과 맵 텍스처 등록 시간은 남아 있다. 마지막 그림 유지는 이 준비 시간을 지우지 않는다. 기존 원화와 실제 픽셀 방의 크기·주인공 의상 차이도 이번 글자/전환 기능으로 고치지 않았다.
