# Pixel Art World 정적 소품 보완

원본/권리/경계/한계는 [STATIC-PROPS-COMPLEMENTS](../tiledata/pixel-art-world/STATIC-PROPS-COMPLEMENTS.md).
독립 `static-props-complements.json` → `prepare-pixel-art-world-static-props-complements.mjs`
→ `pixelArtWorldStaticPropsComplementsCatalog.json`과 전용 project/editor 모델을 사용한다.
외부 다운로드 catalog appender는 사용자 선택 원본SHA/치수를 확인한 뒤 Canvas에서
전체 sourceParts를 조립한다. 일반import는 현재 repository/lineage/cancel 재확인 후
asset저장 + snapshot + store.update로 추가한다. 준비 함수는 저장하지 않는다.

5원본과 공통받침1개를 사용하여5atlas/23객체/5조립표본을 만든다.23객체 kit는
원본·받침·MD·정상오류를 소유하고,5표본kit는 전체하위/상위와 perCell 레이어를 갖는다.
기존106/539·loose supplements·facility complements의 번호·그림·문서를 바꾸지 않는다.
생성기는 source/target범위,명시받침,벽장식,겹침,입구→접근 연결을 확인한다.
이젤 빈틀을 자동 후면으로 추정하거나, 팻말 돌출을48px경계로 자르지 않는다.

```bash
node scripts/content/prepare-pixel-art-world-static-props-complements.mjs
npm run dev:worktree
node scripts/content/render-pixel-art-world-static-props-complements.mjs /absolute/download-root http://127.0.0.1:9877
```

render는 private HTML에서 실제 browser prepare와 catalog카드를 열고
`output/paw-static-props/browser/`에5prepared/그림/install-plan/report를 쓴다.
외부/쓰기 요청을 차단하고 import/store/DB 저장은 호출하지 않는다.

## 별도 로컬 공용 publisher

`publish-pixel-art-world-static-props-complements-library.mjs`는
`pixel-art-world-static-props-complements-local`만 소유한다.
입력 bundle은 `version:1`,정확히5개의 `preparedFiles:[{id,path,sha256}]`,
`catalogSha256/metadataSha256/canonicalReceiptSha256/sharedSnapshotSha256`이다.
모두 파일 바이트SHA이며 prepared path는 절대경로다. 정본receipt는
projectId/projectDir/revision/sha256/portableSha256과 선택portablePath를 쓴다.
portablePath가 없으면 같은폴더 current-portable.json을 검증한다.

```bash
node scripts/content/publish-pixel-art-world-static-props-complements-library.mjs \
  --prepare /private/output/bundle.json /private/download-root \
  /private/output/canonical/source-proof.json /private/output/shared-before.json \
  /private/output/static-props-library

node scripts/content/publish-pixel-art-world-static-props-complements-library.mjs \
  --publish-local /private/output/static-props-library /private/output/publish-receipt
```

`--prepare`는 DB모듈을 로드하지 않는다. 원본5+공통받침1의 실제 바이트SHA와 규격을
다시 확인하고 네트워크가 차단된 빈 브라우저에서 atlas/정상오류/표본/owned원본그림을
재합성하여 픽셀 동일성을 확인한다. 실제 모델 factory와전체kit/통행/배열을 대조하고
실제validateTileset/validateSpatialAuthoring으로 검증한다. 별도 테스트 스위트가 아니다.

UUID를 `shared_paw_static_props_complement_*` tileset/asset/객체kit/표본raster로
치환하고 중첩MD JSON/이미지링크까지 함께 갱신한다. 출력 library/proof/seal과
atlas5+preview5 PNG의 SHA, 입력/계약구현파일SHA를 봉인한다. `readPreparedLibrary(dir)`는
DB 없이 다시 봉인/원본/픽셀/스키마/전체라이브러리를 확인한다. 경로도 봉인되므로
통합한 감독자는 자신의 체크아웃에서 새output으로 prepare를 재실행해야 한다.

공식 sharedContentSqlite는 명시적 `--publish-local`에서만 로드한다. 대상library해시로
CAS하며 다른library의ID소유 충돌을 거부한다. 게시 후 공식 재로드와 기존library
동일성을 확인한다. 정본 프로젝트에는 쓰지 않는다. 감독자가 게시/정본저장을 담당한다.
23객체와5표본raster를 구분하고 places5/previews5는 지역 미연결 조립 후보다.
가짜region/map/event를 만들지 않으며 완성시설수는0이다.
