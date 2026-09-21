# 공용 숲마을 AI 참고문서

- 기존 로컬 SQLite 프로젝트를 실제 파일 브리지로 열고 문서만 store.update/flush.
- 새 페이지에서 재로드해 본문·이미지 바이트 일치, 원본 29개 맵 불변 확인.
- SQLite 저장 뒤 실제 타일 → AI 참고문서 화면을 확인했다. 개발 서버 재로드에서 일시적인 EditScene 모듈 로딩 오류가 기록되어 sqlite-proof.json에 보존한다.
- 최종 production-proof.json은 실제 배포 빌드에서 별도로 모든 문서와 8개 이미지 바이트/디코딩을 확인한 결과다.
- 공용 v2 스냅샷 8개 원격 저장 후 재조회 일치. 로컬 정본과 구분.
- 앱 빌드 확인. 요청하지 않은 gates/vitest/전체 typecheck는 실행하지 않음.
