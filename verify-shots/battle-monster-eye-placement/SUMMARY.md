# 검객 눈 위치 교정 · 2026-10-05

사용자 원문: 「눈의 위치가 좀 이상하다야」.
삭제된 eyes-v4를 복구하지 않고 현재 새 검객 fresh-gat-complete-v1에 이 원문을 현재 suite binding의
rework로 기록했다. 기존 Allow8종/버전과 다른 선택을 보존했다.

## 결과

새 후보 wandering-swordsman/fresh-eyes-v2, native64/18자세/8GIF.
원본은 실제 GPT6.1sol/high로 눈·눈썹 띠의 명시 좌표만 직접 고쳤다.
먼 쪽 눈을 머리선에서 얼굴 안쪽으로 이동하고 눈 간격/눈동자 방향을 정리했다.
피격·독·기절의 표정과 수면·쓰러짐의 닫힌 눈은 각 얼굴의 방향에 맞춰 저작했다.
모든 바깥 픽셀, 팔레트와 alpha footprint는 부모와 바이트/픽셀 단위로 같은 것을 확인했다.
칼끝·칼집·긴 검/무기 연결·의복·효과·몸체와 기존 시간표도 보존했다.

새 후보는 검토 대기이다. 실제 사용자의 Allow는 만들지 않았다.
대시보드에는8동작별 이전/수정 후의16native GIF를 동시에 보여 준다.
이전 원본은 해당 수정 요청과 검수/저작 출처로 보존하며 예전7폐기 후보는 여전히 없다.

## 확인

- source/18격자·색 수·alpha·투명 테두리·y60 접지 및 서로 다른 자세 검사.
- 각 원본 변경 좌표가 지정한 작은 눈·눈썹 띠 안이고 alpha footprint가 동일함을 확인.
- 원본 body/눈 이외의 모든 픽셀과 팔레트 동일. eye-placement.json에 실제 좌표를 보존.
- 실제 별도 high 검수의 job/result/현재 binding/첨부 PNG 해시 확인. 추천: keep.
  이는 사람 선택/실제 전투 승인을 대신하지 않는다.
- 모델 저작/검수 이후 보존 스크립트에서 jobs 상위 폴더 누락으로 한 번 실패했다.
  실제 원본/result를 유지하고 폴더를 보정해 복구했다(archive-recovery.json). 모델 호출을 다시 하거나 실패를 성공으로 바꾸지 않았다.
- 커밋용 원본 재디코드의 같은 binding 확인.
- GIF 모든 프레임 RGBA와 노출 시간이 현재 원본/기존 시간표와 같음.
- 실제 브라우저1440/375/320px:16native64 GIF,8상태, 전체 정지/재생, 오류/가로 overflow0.
  사용자 선택 버튼을 누르지 않았다. API의 Allow8종/버전과 폐기7후보 부재를 확인했다.
- 전체 gates/Vitest/typecheck, Modify 왕복/게임 정본 설치/실제 전투는 실행하지 않았다.

## 즉시 확인

- face-before-after.png: 실제 부모/수정본의 동일 crop 확대와 native64 원본.
- paused.png:8상태의 실제 이전/수정 후 대표 자세와 선택 버튼.
- desktop.png /320.png: 실제 GIF 동시 재생과 작은 화면.
- author-proof.json /browser-proof.json: 범위/선택/현재 후보/독립 검수 근거.

현재 후보: http://100.73.251.77:18346/?candidate=wandering-swordsman%2Ffresh-eyes-v2
