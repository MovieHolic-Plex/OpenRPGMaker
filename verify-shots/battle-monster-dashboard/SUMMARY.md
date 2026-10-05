# 몬스터 결과 대시보드 · 2026-10-05

## 즉시 확인

- `dashboard-1360.png`: 실제 서비스 화면. 결과 그림·동작과 Allow/Modify/Deny.
- `dashboard-375.png`: 휴대폰 폭의 실제 화면.
- `modify-dialog.png`: 수정 내용을 적는 실제 입력 창(격리 QA 서버).
- `revision-1360.png`: 실제 GPT가 만든 수정본을 원본과 나란히 보고 다시 선택하는 화면.

## 구현

사용자 화면은 `http://100.73.251.77:18346/`다. 기존 static 하네스 검토 페이지는 AI/개발자용이다.
`node/dashboard.py`가 실제 선택, 요청 보존, AI 수정·검수·패킹을 수행한다. 화면은
`dashboard.html/css/js`. 실행 입구는 `npm run harness -- battle-monster serve`다.

Allow는 선택을 저장하고 다음 결과로 이동한다. AI 검수/패킹이 끝나면 선택한 결과를 받는다.
Modify는 입력한 내용을 새 후보에서 GPT 6.1 sol high로 처리하고, 완성 후 다시 선택하도록
보여 준다. Deny는 검토 목록에서 제외하고 지난 결과에 남긴다. 해시·CLI·검사 단계는 UI에 없다.

## 브라우저·저장 확인

- `browser-proof.json`: 1360/800/375/320px에서 가로 overflow/JavaScript 오류0.
  움직임 정지, M 단축키로 Modify 열기, Escape 닫기, 내부 작업 정보가 화면에 없는지 확인.
- `interaction-proof.json`: **격리 root/18347 서버**에서 실제 버튼으로 Allow/Modify/Deny.
  선택/수정 원문과 작업이 저장되고 페이지 재로드 후 유지됨. 같은 요청 재전송200,
  옛 선택 버전409, 요청 토큰 없는 POST403. 실제 사용자 후보의 선택을 QA에서 바꾸지 않았다.
- `download-proof.json`: 서버 재시작 후 저장된 Allow 작업을 처리하여 HTTP200으로 선택 팩
  다운로드. ZIP47항목 재읽기, `jf-enemy-wild-boar` 등록 메타 확인.
- `revoke-proof.json`: Allow 이후 Deny로 바꾸자 기존 팩 URL도409로 다운로드 거절.
- `revision-proof.json` / `revision-browser-proof.json`: 실제 Modify 지시를 GPT 6.1 sol high에
  전달해 9자세 모두 변경, 기술 검사 통과, 별도 high 검수 완료. 새 후보가 **pending**으로
  돌아오고 원본/수정본/원래 수정 지시를 표시함. 서버 재시작 후에도 같은 결과를 재로드했다.
  1360/375/320px에서 비교 화면의 오류/overflow0. 이 QA 후보는 사용자 공용 후보에 설치하지 않았다.

## 작업 실행 범위

실제 새 원본/수정 후보는 격리된 `output/battle-monster-dashboard-qa`에 쓴다. 모델 호출은
로그인된 GPT 6.1 sol high를 사용한다. 기본 자세 승인 없이 `author --phase full`로 9자세
완성 후보를 생성하고 별도 세션으로 검수한다. 사용자 선택은 AI가 대신 기록하지 않는다.
첫 실제 Modify 호출에서 접지 y60 오류를 발견했고, 같은 모델에 기술 오류를 전달해 고쳤다.
초기 실패 요청은 진단 중 다시 큐에 넣어 복구했으며, 최초 실패와 보정 지시는 revision-proof에
명시했다. 사용자 수정 원문은 결정 ledger에서 보존하고 완료 요청에도 같은 원문으로 남겼다.
이에 따라 모델 호출 성공 후 기술 검사가 실패하면 원본을 보존하고 최대 두 번 오류만 고치는
경로를 추가했다. 호출 실패나 독립 검수의 미감 의견은 이 자동 수정 조건에 포함하지 않는다.

정본 게임/공용 몬스터 에셋은 이 대시보드 변경의 설치 대상이 아니다. Allow는 대시보드 결과
보관/선택 팩에 대한 결정이다. 실제 게임 설치 시 기존 저장·재로드 계약을 따른다.
gates/Vitest/전체 typecheck는 실행하지 않았다.
