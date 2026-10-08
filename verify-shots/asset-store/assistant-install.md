# 실제 스토어 → 조수 설치 증거

- 서버: `http://100.73.251.77:18320` 스테이징
- 검색: `store_search(query="버들항", kind="tileset", aiReadyOnly=true)`
- 다운로드: 버들항 장소 — 붕괴 후 황폐 필드, 판본 1
- 적용: `store_install(slug=beodeulhang-jangso-bunggoe-hu-hwangpye-p-f78ef830)`
- 결과: 타일셋 1개, 그림·소리 2개, 참고문서 1개, 출처가 붙은 업로드 자산 2개

전체 검색 결과, 설치 목록, 적용된 타일셋 id와 출처 수는 [assistant-install.json](./assistant-install.json)에 기록했다.

이 검증은 실제 스토어 바이트를 임시 캐시에 내려받은 뒤 조수 도구의 `prepare`와 `run`을 통과시켰다. 프로젝트 폴더가 없는 헤드리스 환경에서는 파일 참조 승격이 거부되므로, 증거 실행은 테스트용 메모리 프로젝트 대상을 열어 둔 상태로 수행했다. 실제 Electron 저장·재기동·크레딧 경로는 `electronAssetStore.spec.ts` E2E가 별도로 통과했다.
