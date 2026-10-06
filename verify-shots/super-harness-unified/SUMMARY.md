# 슈퍼하네싱 실제 서비스 통합 확인 (2026-10-04)

- 실제 주소: http://mdc-server:18315/harness. 이전 18312/harness#spaces에서 307로 이동하고 탭 hash 유지.
- super-harness.service MainPID=1695085와 /api/super-harness/runtime.pid 일치.
- prop-harness-test.service는 inactive. 이전 포트 소켓은 같은 MainPID의 이동 전용.
- 공간 개념 90개, paused=true, running=0 유지. 기물 목록 573개, 제작 queued/running=0.
- 선택 current 651행의 전후 전체 SHA-256 일치: 01a4d7ab2ba017d539cc708fb3897b8b854a7387e7358a55aa28d069e91ea3c7.
- 실제 공용 SQLite payload 재조회 해시 검증 및 판본 유지:
  9478673f5896a1a0922d17e47ab748298c65178066249c3b4dbd162ee4d2760e.
  선택 621개, 기물·킷 759개. 새 공용 DB나 프로젝트 사본을 만들지 않았다.
- 자동 제안 65개(새 제안 62, 기존 주문 3). 실제 화면에서 자동 제안 탭 열기 확인.
- 세 iframe 모두 같은 origin 18315: /harness/props, /spaces, /orders.
- 네 상위 탭 브라우저 조회 중 pageerror=0, HTTP 4xx/5xx=0; 원본 browser.json 참고.
- Playwright는 GET만 허용하고 POST를 차단했다. 후보를 대신 고르거나 유료 제작/공간 재개를 실행하지 않았다.
- Python AST 문법·독립 저장소 모듈 로드·기존 CLI engines 로드 확인.
  격리 그림 실행 준비가 라이브 CONTENT_ROOT/HIP_DB를 상속하지 않는 것도 확인(그림 명령 실행 없음). 전체 gates/vitest/typecheck 미실행.
- 사본: ~/.local/share/oprn/super-harness/migrations/20261004-084810-unified.

## 그림

01-spaces.png: 18312에서 이동한 공간 탭.
02-props.png: 기존 후보 그림·공용 반영 완료·기물/파생 화면.
03-orders.png: 같은 서버의 재료 주문서.
04-materials.png: 실제 공용 기물·킷 목록.
05-suggestions.png: 같은 서비스의 자동 파생 제안.

공간 survey의 공용 팩 자동 설치·예제 시공을 완료 근거로 삼지는 않았다.
본 변경은 HTTP/API/실행 소유를 실제 통합하고 기존 재료 gate를 보존한다.

최종 전환: #2073 최신 공간 코드를 병합한 후 CODE_ROOT override 제거. 두 실행기 코드가 모두 통합 체크아웃에서 실행한다.
