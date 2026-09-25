# Pixel Art World 시설 보완

범위·원본·지지 해석: [FACILITY-COMPLEMENTS](../tiledata/pixel-art-world/FACILITY-COMPLEMENTS.md).

`facility-complements.json` → `prepare-pixel-art-world-facility-complements.mjs` →
`pixelArtWorldFacilityComplementsCatalog.json`은 픽셀 없는 공용 메타데이터다.
별도 project/editor 모듈과 catalog appender가 일반 외부 타일셋 다운로드 UI에 연결된다.
사용자는 각 보완 PNG와 표시된 받침 원본을 함께 선택한다. SHA/규격을 먼저 검증하고
로컬 Canvas에서만 조립한다. 기존 소품 atlas와 설치된 타일 번호를 수정하지 않는다.

5atlas/12객체와5개의 작은 방향·받침 조립 표본을 생성한다. 표본은 완성 시설이나
플레이 장소 수가 아니며 모든 events는 빈 배열이다. sourceParts와 전체 upper 배열,
하위 보존(-1), 정상/누락 오류, 원본·받침 문서를 객체 kit마다 소유한다. 표본 raster
kit는 lower/upper 양쪽 전체 배열과 `ai.layerHome=perCell`을 갖는다.

창은 전체 뒤쪽에 벽을 요구하고, L주방은 벽과 바닥의 혼합 지지를 요구한다.
모델의 `wallRowsForExample`은 독립 정상 그림에도 실제 벽을 그린다. generator는
범위/겹침/명시 지지칸/상부장 벽/입구에서 접근칸 도달을 확인한다. 이 구조 검사는
그림의 자연스러움 검토나 이벤트 실행을 대체하지 않는다. 창 표본은 북벽 단면이며
남쪽 두 행을 직사각 바닥으로 끝낸다. 신호등은 실제 도로가 아닌 지주 방향/지지 표본이다.

일반 import는 repository asset 저장 후 lineage/현재 대상/cancel을 재확인하고,
한 snapshot + 라벨 있는 `store.update`로 tileset과 uploaded asset을 함께 넣는다.
비동기 준비 중 프로젝트가 바뀌거나 창을 닫으면 등록하지 않는다.

```bash
node scripts/content/prepare-pixel-art-world-facility-complements.mjs
npm run dev:worktree
node scripts/content/render-pixel-art-world-facility-complements.mjs /absolute/download-root http://127.0.0.1:9877
```

render 스크립트는 빈 private HTML에서 실제 browser prepare 모듈과 UI catalog를 호출한다.
외부 origin/쓰기 요청은 차단하고 store/import를 실행하지 않는다. 결과는 ignored
`output/paw-facility-complements/browser/`의5prepared·그림·report·install-plan이다.
`prepared[0].tileset.structureKits`의 처음12개 객체(팩별2/2/3/4/1), 각 마지막 표본kit
5개를 구분한다. sourceHashes는 파일 바이트 SHA이며 atlas 번호와 소스 번호는 별개다.

공용 DB와 정본 저장은 감독자가 담당한다. 별도 library
`pixel-art-world-facility-complements-local` 사용을 권장하며 기존106/539 라이브러리에
끼워 넣지 않는다. Publisher는 원본과 preparation/canonical receipt를 재해시하고,
UUID tileset/asset 및 kit/MD 참조를 함께 stable ID로 치환해야 한다. 표본을 등록한다면
지역 미연결 조립 후보임을 표시하고 region/실행map을 꾸며 만들지 않는다.
순수 browser prepare 성공은 공용 게시나 정본 저장의 근거가 아니다.

## 재현 가능한 로컬 공용 publisher

`publish-pixel-art-world-facility-complements-library.mjs`는 별도
`pixel-art-world-facility-complements-local`만 소유한다. 기존 loose/loose-supplements
라이브러리와 준비물은 읽거나 바꾸는 대상이 아니다. 검토된5prepared는 입력으로만
읽고 importer/render를 다시 실행하여 덮어쓰지 않는다.

입력 bundle은 `version:1`, `preparedFiles:[{id,path,sha256}]` 정확히5개와
`catalogSha256`, `metadataSha256`, `canonicalReceiptSha256`, `sharedSnapshotSha256`을
갖는다. 각 SHA는 파일 바이트를 해시하고 prepared path는 절대경로다. 정본 영수증은
`projectId/projectDir/revision/sha256/portableSha256`이 필요하며 `portablePath`가
없으면 영수증 옆 `current-portable.json`을 검증한다. 정본의 serialized SHA는
영수증 provenance이며 이 스크립트가 DB에 접속해 다시 읽었다는 뜻은 아니다.
영수증 자체와 portable 파일을 모두 봉인·재검사한다. snapshot은 미리 읽어둔 공식
`{revision,libraries}` JSON을 사용한다.

```bash
node scripts/content/publish-pixel-art-world-facility-complements-library.mjs \
  --prepare /private/output/bundle.json /private/download-root \
  /private/output/canonical/source-proof.json /private/output/shared-before.json \
  /private/output/facility-library

node scripts/content/publish-pixel-art-world-facility-complements-library.mjs \
  --publish-local /private/output/facility-library /private/output/publish-receipt
```

`--prepare`는 DB 모듈을 로드하지 않고 private output 파일만 만든다. 개발 서버도
필요하지 않다. Playwright 빈 페이지의 네트워크를 차단하고 원본10개 SHA/규격,
sourceParts 재합성 atlas, 파트 정상/반례, 전체 배열 정상/오류, 각 kit 소유 원본
그림과 MD의 전체 recipe/expected/incorrect를 검증한다. 오류는 검토된 `errorCell`을
사용한다. 그림자 최하단을 자동 선택해 신호등 밑동 오류를 바꾸지 않는다.
실제 모델 factory와 전체 kit/타일 그룹/통행 배열을 비교하고 스키마는 실제
`validateTileset`/`validateSpatialAuthoring`으로 검사한다. 지지/상부장 벽 및
입구→접근칸 연결도 다시 계산한다. 원본 metadata/전체 배열/그림은 변경하지 않는다.

출력은 `library.json`, `preparation-proof.json`, `preparation-seal.json`과
`artifacts/`의 atlas5 PNG + 조립 표본 preview5 PNG다. JSON 바이트/객체 해시,
출력PNG10개의 바이트 해시, 입력 파일 및 구현 계약 파일의 SHA를 기록한다.
봉인은 검토 후 드리프트 검사용이며 전자서명이 아니다. `readPreparedLibrary(dir)`는
DB 없이 모든 봉인을 검사하고 원본에서 다시 재구성하여 라이브러리 전체 일치를
확인한다. 출력PNG도 라이브러리 안의 asset/preview 바이트와 일치해야 한다.
검토 뒤 코드/카탈로그/입력이 바뀌면 재준비한다. 파일 경로도 봉인하므로 다른
워크트리에 통합한 감독자는 그 체크아웃에서 새 private output으로 준비해야 한다.

타일셋은 `shared_paw_facility_complement_*`, asset은 같은 ID의 `_image`,
객체 kit는 타일셋ID+원본recipeID, 표본 kit는 placeID+`_raster`로 고정한다.
중첩 MD JSON·그룹·이미지ID·참조도 함께 치환하고 입력 UUID 잔여를 거부한다.
숫자 타일 배열과 이미지 데이터는 그대로다. 객체12와 표본 raster5를 구분하며,
place5/preview5는 모두 지역 미연결 **방향·지지 조립 표본**이다. 완료 시설은0개다.
region과 게임map은0개이고 새 실행 이벤트도 만들지 않는다.

DB 쓰기는 명시적 `--publish-local`에서만 공식 `sharedContentSqlite` API로 수행한다.
준비 snapshot의 대상 라이브러리 payload 해시로 CAS하고 전체 snapshot revision을
잠그지 않는다. 다른 라이브러리에 속한 tileset/asset/place/preview/kit ID 충돌은
거부한다. 게시 후 공식 API로 다시 읽어 대상 전체 일치 및 기존 타 라이브러리
보존을 확인하고 영수증을 남긴다. 정본 프로젝트에는 쓰지 않는다.
