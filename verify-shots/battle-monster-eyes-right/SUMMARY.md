# 검객 눈 오른쪽 이동 · 2026-10-05

사용자 원문: 「좀 더 눈을 오른쪽으로 옮겨라」.
화면에 보이던 fresh-eyes-v2에 실제 사용자 rework를 현재 suite binding으로 기록했다.
새 후보 wandering-swordsman/eyes-right-v3은 검토 대기이며 사람이 Allow하지 않았다.

## 결과

18자세의 두 눈과 닫힌 눈을 화면 오른쪽으로 native1픽셀 옮겼다.
작은 눈·눈썹 영역의 직접 고른 252픽셀을 실제 GPT6.1sol/high 저작 세션에서 적용했다.
chosen-eye-runs.json의 자세별 [x,y,색 문자열]이 실제 원본과 정확히 맞는 것을 확인했다.
피격·독·기절의 표정과 수면·쓰러짐의 닫힌 눈을 유지했다.
원본 팔레트, alpha footprint, 지정한 run 밖의 픽셀과 기존 source 문서는 동일하다.
몸·머리 윤곽·코·입·옷·무기·효과·발과8GIF의 실제 순서/노출 시간을 보존했다.

## 확인

- 실제 author job/model/effort/입력 해시와 원본/좌표 기록을 보존했다.
- native64×64/18색/투명 테두리/alpha/y60 접지/서로 다른18자세의 자산 검사.
- 실제 독립 검수 job/result/binding/첨부 이미지 해시를 확인했다. 추천: rework.
  검수의 추천은 사람 선택이나 실전 전투 승인을 대신하지 않는다.
  검수는 눈에 대한 지적 없이 windup 허리 윤곽(36,41/37,42)의 부분 보완을 추천했다.
  이 좌표가 부모와 동일한 것을 확인하고 이번 눈 위치 요청 범위에서 기존 그림을 보존했다(review-scope.json).
- 커밋용 source 재디코드 binding이 현재 후보와 일치한다.
- 8GIF의 모든 프레임 RGBA 재읽기와 원본 비교, 기존 시간표 동일 확인.
- 실제 브라우저1440/375/320px:8동작·16native64 GIF 전후 비교, 정지/재생, 오류/가로 overflow0.
- 기존 Allow8종의 선택 버전은 작업 시작 전 API와 동일하다. 선택 버튼을 누르지 않았다.
- 옛 폐기7후보는 활성 목록에 없으며 부모 원본/수정 요청 기록은 보존했다.
- 전체 gates/Vitest/typecheck와 게임 정본 설치/실전 전투는 실행하지 않았다.

## 즉시 확인

- face-before-after.png: 실제 부모/수정 source의 동일 crop 확대와 native64 원본.
- paused.png:8동작의 실제 부모/수정본 대표 자세와 사용자 선택 버튼.
- browser-proof.json /author-proof.json: 현재 후보·범위·검수·선택 보존 근거.

현재 후보: http://100.73.251.77:18346/?candidate=wandering-swordsman%2Feyes-right-v3
