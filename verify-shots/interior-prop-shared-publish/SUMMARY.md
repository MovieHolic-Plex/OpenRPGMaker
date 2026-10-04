# 하네스 확정 → 공용 DB 자동 등록

- 화면: http://mdc-server:18312/harness
- 실제 공용 DB: /home/main/.local/share/oprn/shared-content.sqlite
- 라이브러리: oprn-hand-interior-harness
- 사용자 선택 610종(593 기본 굽기 + 17 크기 변경), 함께 쓰기 5종, 굽기 누락 0.
- 전체 기물/킷 748종. 예제 맵 26장 구조·모든 프레임 픽셀·통행·도달 검사 오류 0.
- 참고문서 64개, 이미지 34개. 작은 분류를 합쳐 문서 제한을 지켰다.
- 공용 행을 다시 열어 판본 해시/시트 해시 확인. 직전 게시판의 칸 번호 자료도 재로드 확인.
- 같은 선택판 재요청은 추가 게시 없이 완료 상태 유지. 서버 재시작 후 완료 상태 유지.
- 새/기존 확인용 프로젝트 모두 공용 팩을 설치하고 project.sqlite + assets/ 저장 후 close/open 재로드 확인.
  실제 사용자의 기존 프로젝트는 수정하지 않았다. ID/폴더/재로드 증거: storage-proof.json.
- 화면: 완료 상태와 브라우저 오류 0, 선택 POST는 차단한 읽기 전용 확인. harness-status.png, browser-proof.json.
- 전체 gates/vitest/typecheck는 실행하지 않았다.
