# 기존 화면 우선 시각 감사

현재 Supabase snapshot과 직전 QA snapshot의 maps가 JSON.stringify 비교에서 동일함을 확인했다.
아래 기존 스크린샷은 맵 배치 감사를 위해 즉시 확인한다. 창 스킨 등 맵 밖 설정은 달라졌으므로
현재 부팅/기능 동작의 증거로 대신 쓰지 않는다.

- verify-shots/runtime-qa/night-monster-final/02-opening.png — 즉시 확인: 현관의 방 구성
- verify-shots/runtime-qa/night-monster-final/03-foyer.png — 즉시 확인: 실제로는 서재 착지 화면, 공간과 조사물 배치
- verify-shots/runtime-qa/night-monster-final/04-bedroom.png — 즉시 확인: 침실의 실물 오브젝트
- verify-shots/runtime-qa/night-monster-final/05-chase.png — 즉시 확인: 추격 지형
- verify-shots/runtime-qa/night-monster-final/06-basement.png — 즉시 확인: 지하실과 출구의 시각적 연결
