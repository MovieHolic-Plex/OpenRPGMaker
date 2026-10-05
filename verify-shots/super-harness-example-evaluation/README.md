# 예시를 보고 평가하는 화면

2026-10-05 http://mdc-server:18315/spaces?concept=underground-prison 실제 UI 확인.

- 1440×1150 desktop 및 390×844 mobile. 예시가 먼저 보이고 원본 부품은 접힌 상세로 이동했다.
- 화면 내 장면/문 열림 전환 후 계단 의견 초안이 보존됐다. 모바일 가로 넘침 없음.
- 브라우저에서 평가 POST 응답만 가로채 요청의 fingerprint/이미지 해시/평가 항목/의견과 저장 표시를 확인했다.
  저장 후 같은 장면 유지, pageerror 0. 실제 GET은 전후 동일하여 사용자 대신 평가·선택하지 않았다.
- 실제 서버의 낡은 fingerprint 평가 요청은 쓰기 전에 거부했다.
- live sh.sqlite를 SQLite backup API로 임시 사본에 복사하고 해당 사본에서 평가 저장→재로드를 확인했다.
  stage/art selections/paused 불변, 잘못된 후보 및 이미지 해시 거부, 다음 제작 프롬프트에 의견 포함 확인.
- 서비스 재시작 전후 작업 689는 alive=true, paused=true 유지. 기물 pool은 실행/대기 0개인 상태에서 재시작했다.
- Python AST, JS syntax, git diff --check 확인. gates/vitest/typecheck는 실행하지 않았다.

그림: desktop.png, mobile.png, evaluation-form.png. 실제 평가를 입력하기 전 화면이며 정본의 의견 기록을 꾸미지 않았다.
