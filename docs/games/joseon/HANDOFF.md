# 해원 핸드오프 (2026-10-31, 일시중지)

- 현재: 사건 1 「우물에서 우는 아이」 끝까지 플레이 가능 — 런타임 체크포인트 6/6 통과(들머리·동헌·검안·탐문·지목·밤 우물 퇴마→주막 아침, 13:00 판), 헤드리스 증거 `scripts/qa/joseon-haewon-c1-proof.mts` allOk(정답·오답 갈래·퇴마 승패·SQLite 저장 재로드). 엔진 PR #4060·#4078·#4082·#4089 머지. 마지막 커밋(얼굴 빼기)은 굽기만 끝났고 체크포인트 재실행·1배 영상은 사용자 지시로 취소했다.
- 다음: origin/main 병합(#4098 오프닝 건너뛰기 금지 — 해원은 오프닝이 아직 없다) → `npm run bake:demos -- --only joseon-haewon`(heavy2.lock) → `QA_RECORD_VIDEO=… npm run qa:runtime -- --checkpoint-set joseon-haewon`(heavy.lock, unshare -rn) → 영상 이어 붙여 ~/claude-viz/game-joseon.html(생성기 초안은 /tmp/jw2/mkviz.py, 사라졌으면 다시 쓴다).
- 그다음: 사건 2 「셈하는 귀신」(관아 곳간·허 의원·진오귀굿), 사건 3·엔딩 셋, 오프닝 5컷. 남은 흠: 조선 칩 위 자동 얼굴은 데모에서 지웠을 뿐 조수 경로엔 그대로, 사건 도구는 지목 뒤 범인 퇴장을 스스로 하지 않는다(데모가 페이지를 덧붙임).
