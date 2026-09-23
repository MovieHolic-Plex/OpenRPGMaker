# 이슬여울 마을 · 공용 AI 조립 자료

편집기: **타일 → 참고문서 → 이슬여울 · 25종 장식 조립**.
`forest_harmony`와 `shared_forest_village_objects`의 새/기존 번들 타일셋에서 읽는다.

[먼저 읽기](guide.md) → [숲 조립](forest.md) → [소품 사전](props-1.md) (1~5) →
[85개 배치](placements.md) → [건물/문앞](houses.md) → [전체 배열](layout-01.md) (01~06) →
[원본 결합 사전](bindings-1.md) (1~3) → [오류 검증](validation.md) → [레이어 정정](layer-corrections.md).
기본 건물·가구·울타리·동굴 전체 조립은 `appendix-*.md`에 있다.

- `sample.json`: 승인 정본에서 추출한 맵과 렌더링 타일셋. 내부 전이 대상이 생략되어 있으므로 완전한 게임 프로젝트가 아니다.
- `parts.json`: 25개 부품, 85개 실제 배치, 사용 타일 225개의 원본 결합/메타데이터.
- `validation-examples.json`: 정상 및 5가지 실제 오류 입력과 정확한 검출 좌표.
- `images/`: 실제 엔진 타일 출력. 원본 픽셀을 보존하며 오류 비교만 2배 nearest-neighbor.
- `ai-references/`: 저장/재로드 영수증과 실제 자료집 컴포넌트 화면.

재생성은 저장소 루트에서 `node scripts/content/build-dewbank-references.mjs`.
그림 재생성은 워크트리 개발 서버를 켜고
`DEWBANK_DEV_URL=http://127.0.0.1:<port> node scripts/content/render-dewbank-evidence.mjs`.
CLI 검사: `node scripts/content/validate-dewbank-village.mjs <exported-project.json> dewbank_village`.
검사기는 원본에 쓰지 않는다. 임의 맵을 이 표본과 같은 배치로 강제하지 않는다.

공용 타일 그림은 기존 번들을 재사용했다. 출처는 [전체 타일 출처](../../../../public/assets/ATTRIBUTION.md) 및
[숲과 마을 출처 기록](../../../forest-villages/README.md)에서 확인한다.
