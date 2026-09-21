# 새 프로젝트 공용 기본 자료

이전 이관은 특정 성채 프로젝트와 공용 맵 다운로드에만 적용되어 새 프로젝트에서는 문서가 없었다. 사용자가 요청한 공용 조건을 충족하지 못한 누락이었다.

이제 `src/assets/sharedCastleReferences.json`을 출하 번들로 제공한다. `createCastleTileset()`이 프로젝트 생성 시 3용도, 20 MD, 19 이미지의 독립 사본을 넣는다. `ensureBundledTilesets()`는 기존 기본 성채의 문서가 없는 경우에도 보충한다. 작성된 문서(빈 배열 포함)와 공유 설정, 다른 이미지로 교체한 칩셋은 보존한다.

실제 새 빈 프로젝트(`?blankProject=1`)를 열어 별도 프로젝트 주입이나 가져오기 없이 타일 → 성채 · OpenGameArt → AI 참고문서에서 세 용도와 모든 첨부 이미지의 디코딩을 확인했다. 증거: `browser-proof.json`, `database-guide.png`. 이는 기본 제공 코드 검증이며 특정 맵의 저장 증거로 주장하지 않는다.

화면 확인 스크립트: `scripts/qa/capture-shared-castle-references.mjs [baseURL]`.
기존 성채 프로젝트 이관 기록은 `../ai-references/`에 남겨둔다. 그 기록만으로 공용 등록이 끝났다고 하지 않는다.
