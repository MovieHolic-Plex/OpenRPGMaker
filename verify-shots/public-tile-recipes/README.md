# 公용 숲 타일 정밀 조립 증거

- factory-proof.json: 새 프로젝트 기본 정의에 문서 19개/이미지14개.
- persistence.json: 기존/새 프로젝트 SQLite 저장 후 재로드, 맵 불변.
- browser-proof.json 및 PNG: 실제 자료집에서 전 문서/그림 조회, 이미지 바이트 대조.
- tiledata/tilesets/forest_harmony/recipes/validation-examples.json: 오류 주입과 좌표 검출.
- 자동 그림은 런타임 스크린샷이 아니라 원본 칩·이식·받침을 합성한 배열 증거다.
- 앱 빌드만 실행. 전체 gates/Vitest/typecheck는 실행하지 않았다.
