# 실제 원본 배경 v2 체크포인트

이 증거의 카탈로그와 이미지는 `src/editor/interviewSceneBank.json` 및 `public/assets/harnesses/interview-scene-bank/`의 실제 배포 원본이다. 이미지/카탈로그를 합성하거나 대체하지 않았다. 1,457개 전체 제작 완료 증거는 아니다.

- `native-bank-proof.json`: 실제 76개 배경 목록에서 네 장르, 13개 선택을 production interview dialog로 클릭했다. 인증 연결 상태만 false로 설정했으며 신규 이미지 생성 요청은 0개, 브라우저 오류는 0개였다. 디코드된 캐시를 준비한 후 클릭 이벤트 안의 장면 키와 원본 URL을 확인했다. DOM 전환 시간 4.2–12.4ms는 다운로드/화면 합성 지연까지 재는 값이 아니다.
- `native-bank-browser.mjs`: 위 관찰의 재현 스크립트. Vite가 반환한 실제 대화창 모듈의 import URL을 읽어 같은 캐시 클래스의 디코드 완료를 관찰한다. HMR 쿼리를 제거한 다른 모듈을 관찰하면 잘못된 타임아웃이 발생하므로 URL을 그대로 사용한다. 배경 이미지나 카탈로그는 주입하지 않는다. 결과는 세션 `qa-runs/harnesses/interview-scene-bank/production-v2-browser/`에 쓴다.
- `fresh-checkout-proof.json`: 당시 51개 합격 목록에서 합격작 한 장의 세션 PNG와 정확한 생성 요청을 일시적으로 제외한 상태로 실제 하네스 status를 실행했다. 저장소의 배포 원본과 requests 사본으로 51개 합격이 유지됐다. 제외한 세션 파일은 finally에서 복원했다. 이 수치는 해당 관찰 시점이며 현재 전체 배포 수를 뜻하지 않는다.

검수는 원본을 직접 열어 pixelArt/composition/allChoices/latestChoice/identityUnset/noText/distinctShot을 각각 판단했다. 탈락 원인을 새 생성 요청에 추가하여 다시 그렸으며 원본을 픽셀 필터나 팔레트 변환으로 바꾸지 않았다. 실제 배포 수는 현재 manifest 및 하네스 status에서 읽는다. 76개 배경의 첫 관찰에서는 전체 typecheck/Vitest/gates를 실행하지 않았다.

2026-10-05 추가 증거: `targeted-startup-tests.log`는 기획 직렬화·장르 기본값·입력창 표시·저장 전 자동 실행 차단·전환/실패/중복 시작의 관련 테스트 15개 통과 기록이다. `published-integrity-proof.json`은 `python3 scripts/qa/interview-scene-bank-integrity.py`로 현재 배포 목록 전체의 원본 바이트·PNG 디코드·16:9/불투명·중복 없음·정확한 생성 요청 및 일곱 검수 해시를 확인한 결과다. 그 시점의 배포 수와 미완성 수를 함께 기록하며, 검사 통과를 남은 그림의 제작 완료나 전체 인터뷰 클릭 검증으로 확대하지 않는다.

`romance-native-bank.png`, `monster-native-bank.png`는 위 실제 카탈로그 관찰에서 찍은 production dialog 스크린샷이다. 인터뷰 컴포넌트를 별도 컨테이너에 올린 관찰이며, 앱 시작 전체 셸의 전체화면 동작이나 게임 생성·AI 조수 전달을 검증한 증거는 아니다.
