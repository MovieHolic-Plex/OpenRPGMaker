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
