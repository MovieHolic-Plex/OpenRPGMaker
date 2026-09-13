# 장소 통합 검증 (2026-09-14)

이 변경은 편집기/엔진 코드와 최소 계약 테스트다. 실제 사용자 Supabase 프로젝트를
새로 저작하거나 수정하지 않았다. 브라우저의 blankProject와 런타임 JSON은 테스트 전용이다.

- `scripts/capture-new-place.mjs`: exit 0. 생성/취소/적용, 실내·실외·건물,
  실내를 건물로 묶기, 방/2층 추가, 1440px/1024px, 브라우저 오류 없음.
- `room-expanded-building.png`: 원래 실내를 첫 방으로 재사용한 건물에 2층 추가.
  포함된 장소 단일 개수, 층 변경/구성에서 빼기/원본 열기, 출입 연결 표면 확인.
- `building-floor2-1024.png`: 1024px에서 방 추가·층 추가·층 선택 확인.
- `npm run qa:runtime -- --scenario unified-place-floors`: exit 0, 5비트 통과, 오류 0.
  실제 출하 플레이어에서 그린 1층 → 새 2층 → 1층 왕복.
  리포트: `verify-shots/runtime-qa/unified-place-floors/SUMMARY.md`.
- 세부 계약 테스트와 구현 범위: `openwiki/unified-place-authoring.md`.
- 앱 타입 검사: exit 0. 최종 전체 게이트는 진행 중이며 결과 확인 후 이 기록을 갱신한다.
