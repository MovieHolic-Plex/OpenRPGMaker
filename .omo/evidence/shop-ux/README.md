# 상점 편집 개편 검증 (2026-09-05)

진열 상품 목록과 선택 상품의 가격·판매 시기를 나란히 배치했다. 상품 추가는 검색·종류 필터·복수 선택을 지원하는 별도 창이며, 거래 규칙·상인 대사·거래 후 행동은 탭에서 편집한다.

## 검증

- 최신 main 통합 뒤 `npm run typecheck:app`: exit 0.
- 최신 main 통합 뒤 관련 Vitest 9파일: 78 passed. UI 초안의 연속 편집, 상품 순서·삭제, 추가 취소/일괄 추가, 가격·계절 overlay 보존, 두 분기, 기존 가격·흥정·상인 예산 계약을 검사했다.
- `npm run gates -- --only css`: exit 0 (CSS 예산·그래프).
- Playwright `shop-command-fullscreen.spec.ts`: 상품 추가·취소, 가격/계절 연속 편집, 미리보기, 매입 예산 숨김/복원, 흥정 설정 보존, 실제 대사, 거래 없음 분기, 적용/재열기를 실제 편집기에서 검증했다. `geometry.json`은 세 화면 크기에서 상품 행·적용 버튼이 보이고 상점 창에 가로 넘침이 없음을 기록한다.
- 브라우저 최초 전체 실행은 2 passed. 기하 기록 형식 수정 후 재실행에서 상품 시나리오는 통과했고, 키보드 시나리오는 편집기 canvas 로딩에서 60초 시간 초과가 났다. 해당 시나리오만 재실행하여 1 passed (59.7초)를 확인했다.
- 전체 `npm run gates`: exit 1. 13,070 tests 중 12,889 passed / 166 failed / 15 pending. 상점 스냅샷 갱신 전의 전체 실행이다. 저장된 9월 2일 기준선 밖에서 실패한 14파일의 모든 실패 assertion은 변경 전 `2ef2b071`의 격리 워크트리에서도 재현했다(`validation.json`).
- 최신 main 통합 전, 상점 스냅샷 갱신 뒤 form/interaction/commit 축의 상점 차이는 없다. 남은 표면 검사 실패 6건은 변경 전과 동일하다: changeFace/showPicture의 AI 입력, giveMonster/evolveMonster 선택지, M2 AI 입력, 포털 피커/NPC 그래픽 기준선. CSS live 검사의 `.selected` / `bottom` 소실도 변경 전과 동일하다. 저장소 전체 검사는 통과 상태가 아니다.

## 화면 증거

- [1440×900 상품 편집](01-goods-1440.png)
- [1280×800 상품 편집](01-goods-1280.png)
- [1024×768 상품 편집](01-goods-1024.png)
- [전체 상품 추가창의 마지막 행](02-catalog.png)
- [거래 규칙](03-rules.png)

상품·맵·이벤트 콘텐츠를 새로 저작하는 작업은 아니며, 브라우저의 임시 프로젝트는 UI 검증용이다.

최신 main 통합 후 일반 Chromium 전송으로 재검사할 때 두 시나리오 모두 localhost 모듈 요청의 `ERR_NETWORK_CHANGED`로 부팅하지 못했다(trace의 menu.ts 동적 import 실패). 호스트의 network change 이벤트를 피하는 선택 옵션 `SHOP_QA_ROUTE_MODULES=1`은 동일 baseURL의 GET 응답을 Playwright Node 전송으로 전달한다.

최종 브라우저 확인: `SHOP_QA_ROUTE_MODULES=1 DEV_SERVER_PORT=19841 E2E_RETRIES=0 npx playwright test test/e2e/shop-command-fullscreen.spec.ts`에서 상품 시나리오 통과. 키보드 시나리오는 `route.fetch` 연결 종료로 부팅에 실패해 GET 연결 재시도 옵션을 적용하고 `--grep "catalog Escape"`로 다시 실행하여 exit 0 / 1 passed를 확인했다. 두 시나리오의 제품 동작은 최신 main 위에서 검증했다.
