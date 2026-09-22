# Castle2 학습 자료의 AI 참고문서 이관

저장소에만 남겼던 학습 자료를 실제 프로젝트 타일셋 `referenceDocuments`로 이관했다.

- 사용자 경로: 데이터베이스 → 맵 → 타일 → 성채 · OpenGameArt / 성채 · 항구와 자연 → AI 참고문서.
- 원본 문서 소유자: `opengameart_castle`. 파생 `castle_courtyard_harbor`는 원본을 공유한다.
- 용도: 성채 구도와 제작 기준 / 성채 칩셋 조립 / 비교 개선과 확정 장소.
- 문서 20개, 이미지 19개. 16구역 분석, 실패 판정, 부품 JSON 전체, 출처, 원본·파생 아틀라스, 비교 그림, 최종 사용자 결정을 포함한다.
- 개선2의 목재 관리소는 취소된 시도임을 문서 앞에 명시했다. 최종은 개선1 석조 관리소다.
- 사용자 참고 이미지의 큰 돌다리는 비교 대상에만 남는다. 게임 소재로 재도입하지 않는다.
- 타일·맵·NPC는 변경하지 않는다. 양쪽 저장은 기존 revision/SHA를 비교한다.
- SQLite 프로젝트 `b4706a77-9a38-4dcc-a89d-36244da53967`, 원격 프로젝트 `castle-fortress-city-20260921`.
- 공용 다운로드 4개와 독립 원격 저장본 `oprn-place-river-fortress-v1`, `oprn-place-castle-courtyard-v1`, `oprn-place-castle-small-harbor-v1`, `oprn-place-castle-stone-lodge-v1`에도 자체 참고문서를 포함한다. 원본 칩셋이 없는 독립 맵은 파생 칩셋이 문서를 소유한다.
- 기존의 모든 타 프로젝트를 일괄 수정하는 전역 문서 저장소는 아니다. 해당 프로젝트와 공용 맵 다운로드에 저장된다.

이관 스크립트: `scripts/content/register-castle-references.mjs`.
실제 화면 확인: `scripts/qa/capture-castle-ai-references.mjs`.
저장/재로드 영수증 및 실제 화면 증거는 이 디렉토리에 보관한다.
