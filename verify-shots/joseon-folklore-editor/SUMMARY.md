# 조선 설화 팩 · 에디터 표면

이 증거는 `freshProject=1` 임시 세션에서 데이터베이스 추가 버튼을 확인한 것이다.
정본 게임 저장 증거는 `content-packs/joseon-folklore/INTEGRATION.md`에 따로 기록한다.

- `01-pack-catalog.png`: 데이터베이스 개요에서 선택형 팩 추가 버튼.
- `02-save-unavailable.png`: flush의 skipped 결과를 주입한 실패 경로.
  store.update가 뷰를 재생성한 뒤에도 연결된 뷰에 저장 실패 alert가 나타나야 한다.
- `RESULT.json`: 위 실패 경로의 관측값. 메모리 fixture이며 SQLite 저장 성공으로 간주하지 않는다.
