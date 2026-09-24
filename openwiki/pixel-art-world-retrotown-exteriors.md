# Pixel Art World — 목욕탕·레트로 동네 외관

ST-Sento-E01 / ST-RTown-E01 두 native32 원본(256×1600)을 사용자 PNG에서 준비한다.
그림/dataURL은 Git/public에 넣지 않고 metadata/importer/docs만 배포한다.

- 원본 SHA, 공식 실제 샘플, 전체 문틀 경계 오류와 수정을 먼저 읽는다: [상세 근거](../tiledata/pixel-art-world/RETROTOWN-EXTERIORS.md).
- 입력: `tiledata/pixel-art-world/retrotown-exteriors{,-layout,-comparison}.json`.
- 생성: `prepare-pixel-art-world-retrotown-exteriors.mjs` → `pixelArtWorldRetrotownExteriorsCatalog.json` raw41 및 `pixelArtWorldRetrotownExteriorsLayout.json` final45/scenes2.
- 실제 임포터: `src/editor/pixelArtWorldRetrotownExteriors.ts`. 원본400칸 보존, 합성뒤append. 외부카탈로그의 exactSHA 검증 뒤에만 생성한다.
- 사용자 로컬 준비: `prepare-pixel-art-world-retrotown-exterior-browser.mjs`, 공용용 payload는 기존 `prepare-pixel-art-world-native-install.mjs`.
- AI 경로: 타일 참고문서 + 각 structureKit 자체 referenceDocuments + 장소별 full arrays/owned MD/이미지. 공용 publisher에는 Catalog와 Layout의 두 목록을 맞춰 넘긴다.
- 상점 문틀128×80 / 종이문64×68의 아래에 독립 디딤돌이 있다. 높이96 raw 사각을 whole로 재등록하지 않는다. 정상/오류 경계 그림을 읽는다.
- 목욕탕 내부 ST-Sento-I02는 연결후보다. 문그림/approachCells를 실제 실내전이로 해석하지 않는다.

픽셀 설치·공용등록·정본저장/재로드는 root sole writer. private prepare만으로 저장완료라고 하지 않는다.
