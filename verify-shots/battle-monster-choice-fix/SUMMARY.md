# Allow / Deny 반영 수정 — 2026-10-05

## 실제 화면: 즉시 확인

- `live-allow.png`: 저장된 선택 8종만 Allow에 표시. 같은 종의 옛 Allow 버전 4개는 지난 결과로 분리.
- `live-deny.png`: 방아토끼·산적 칼잡이·방랑 검객 기존 후보 3개가 Deny에 유지.
- `deny-applied.png`: 격리 QA root에서 파일 준비 대기 중 Deny로 변경한 직후.

## 확인한 원인과 변경

선택은 ledger에 저장됐지만 카드가 Allow 대신 ‘결과 준비 중’을 표시했다. 백엔드·프런트엔드는
포장 대기와 실행 중 선택 변경을 막았다. suite 검수가 이미 있는데도 poses·idle을 차례로
모델에 재전송해 사용자 Allow의 다운로드가 오래 대기했다.

선택 상태·파일 준비 상태를 분리하고, Deny 목록과 상단 반영 요약을 추가했다. 준비 중에도
Modify/Deny가 입력된다. 선택 투영은 실제 ledger 사건을 재생한다. 활성 버전을 Deny해도
오래된 Allow를 자동 복귀시키지 않고, 선택하지 않은 경쟁 후보를 Deny하면 현재 선택을 보존한다.

suite 검수의 현재 binding·이미지·독립 모델 작업 출처를 확인하고, 실제 원본 파일 해시가 같은
하위 poses/idle만 포함한다. 팩의 review-coverage.json은 원래 검수 phase/jobId와 해시를 기록한다.
검수 결과를 복제하거나 사람이 Allow하지 않은 후보를 승인하지 않는다.

## 근거

- `browser-proof.json`: 격리된 실제 HTTP/브라우저로 Allow → 작업 잠금 중 Deny → 재로드,
  최신 버전 1개 표시, 대기 중 Modify. Deny 흐름 약 553ms. 사용자 원본 선택은 변경하지 않았다.
- `replay-proof.json`: 활성 Deny 후 옛 Allow가 복귀하지 않음, 경쟁 후보 Deny가 현재 선택을
  보존함, 이전 작업 완료가 supersededBy를 지우지 않음, 재시작 후 최신 선택 유지.
- `coverage-proof.json`: suite 검수로 정확한 poses/idle 원본 포함·ZIP 재읽기,
  새 모델 호출 0회. 팔레트 변경으로 옛 검수가 무효가 됨을 확인하고 QA 원본은 복원.
- `live-before.json` / `live-after.json`: 적용 전후 모든 실제 사용자 선택 동일,
  ledger 바이트 동일. 다운로드 준비 대기 5개가 0개로 완료.
- `live-browser-proof.json`: 실제 서비스 Allow 8종/Deny 3개, 브라우저 오류 없음.
- `inbox-1440.png`, `inbox-375.png`, `inbox-320.png`: 가로 넘침 없음.

전체 gates/vitest/typecheck는 실행하지 않았다. Python 구문 확인·JS 구문 확인과 위 흐름을 직접 확인했다.
이 화면은 결과 선택/팩 다운로드이며 플레이 가능한 프로젝트 설치를 완료했다고 주장하지 않는다.
