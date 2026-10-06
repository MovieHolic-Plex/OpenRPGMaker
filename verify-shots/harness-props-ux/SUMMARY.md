# 기물 선택 UX와 실제 공용 반영 확인

사용자 요청: 선택 화면을 편하게 바꾸고 DB 사용과 선택한 칩셋의 공용 반영을 확인한다.

- 검색·상태 필터, 현재/후보 1/후보 2 비교, 카드 안 테두리 전환, 접힌 상세, 하단 확정 동작.
- 저장 대기 → 선택 저장 → 공용 반영을 구분하고 실제 DB 게시 시각·선택/킷 수·적용 범위를 표시한다.
- 1440×1000, 1024×768, 640×800 확인. 큰/작은 화면에서 가로 넘침 없음.
- 실제 API GET과 로컬 새 HTML로 검색·필터·탭 이동·초안 보존·자동 제안 확인. pageerror/HTTP 실패 없음.
- POST는 모두 가로채 모의 응답. 5초 전송 전 되돌리기, .sel 선택, 저장 실패 시 기물/선택/메모 복구,
  성공 응답 뒤 저장 알림 확인. 실제 사용자 선택·유료 작업 POST=0.
- 실제 공용 SQLite revision/payload 해시 대조, 최근 12개 후보를 공통 팔레트로 변환해 아틀라스에서 재조립한 그림과 픽셀 일치.
- 공용 선택 673종, 기물·킷 811개. shared-audit.json.
- 별도 새/기존 프로젝트 양쪽 SQLite+assets 저장 후 다시 열어 811개 킷 및 이미지 해시 일치.
  기존 지도 유지, 실제 사용자 프로젝트는 수정 없음. 프로젝트 id·폴더는 storage-proof.json.
- JS syntax 및 git diff --check 확인. 전체 gates/vitest/typecheck 미실행.

그림: 01-review.png, 02-shared.png, 03-suggestions.png, 04-compact.png.
05-save-flow.png는 모의 POST 확인 화면이며 실제 선택 저장 증거가 아니다.

운영 반영 후 실제 18315 응답 HTML로도 검색·공용 탭을 확인했다. live.json의 actualLiveHtml=true.
두 정적 파일만 교체했고 서비스 재시작은 하지 않았다. 원래 파일 사본/해시는 deployment.json.
