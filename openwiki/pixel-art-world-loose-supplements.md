# Pixel Art World 개별 소품 조립 보충

범위/정확한좌표/남은보류: `tiledata/pixel-art-world/LOOSE-SUPPLEMENTS.md`.

기존 loose539객체/106prepared를바꾸지않는독립5atlas. `loose-supplements.json` → `prepare-pixel-art-world-loose-supplements.mjs` → `pixelArtWorldLooseSupplementsCatalog.json`. `pixelArtWorldLooseSupplements.ts`는객체10(주상태9+기존벤치1)/장소5의전체배열과타일셋을만든다. 일반importer/appender도기존loose와별도다. 공유publisher/정본writer는감독자소유.

소스파트픽셀좌표와출력32px칸을섞지않는다. front/back는원본을개인atlas에굽는순서이며맵상위레이어를겹쳐쓰는기능이아니다. replace파트는이전상태/그림자를지운다. 객체하위-1/상위전체,장소는두레이어전체를kit가소유한다. L화단공백은-1로유지한다.

source/support먼저읽기·원본전체·파트정상반례·배열정상오류·장소문서를kit별로소유. 그림문/FPS/애니메이션을실제기능으로추정하지않는다. 열린신사/새장은정적전체차단,촛불은frame0만. 흙L화단은심기전표본이다. 모든PNG/dataURL은사용자가제공한원본에서privateprepare/import로만생성하며Git/public픽셀없음.

## 별도 로컬 공용 라이브러리 준비·게시

`scripts/content/publish-pixel-art-world-loose-supplements-library.mjs`가
`pixel-art-world-loose-supplements-local` 하나만 소유한다. 기존
`pixel-art-world-loose-local`의 106원본/539객체는 수정하지 않는다.
객체 10개는 주요 정적 상태 9개와 기존 벤치 재사용 1개다. 장소 래스터 kit 5개는
이 객체 수에 포함하지 않는다. 장소·미리보기 각각 5개, atlas·asset 각각 5개이며
지역과 게임맵은 0개다. 장소 이름·소유 문서에 **지역 미연결 정적 후보**를 명시한다.
신사·새장 열림은 통행 이벤트가 아니며, 촛불은 frame0, L화단은 심기 전 흙 테두리다.

입력 bundle(JSON)은 다음 키를 갖는다. 해시는 모두 파일 바이트 SHA-256이며
`preparedFiles`는 catalog의 5개 packId와 정확히 일치해야 한다.

```json
{
  "version": 1,
  "preparedFiles": [{"id": "paw-supplement-hina", "path": "/private/output/hina-prepared.json", "sha256": "64 hex"}],
  "catalogSha256": "64 hex",
  "metadataSha256": "64 hex",
  "canonicalReceiptSha256": "64 hex",
  "sharedSnapshotSha256": "64 hex"
}
```

위 `preparedFiles` 예시는 첫 항목만 표시한 것이며 실제로는 5개가 필요하다.
카탈로그는 `src/assets/pixelArtWorldLooseSupplementsCatalog.json`, 메타데이터는
`tiledata/pixel-art-world/loose-supplements.json`이다. 준비 파일 경로는 절대경로다.
정본 읽기 영수증은 `projectId/projectDir/revision/sha256/portableSha256`을 갖는다.
`portablePath`가 없으면 영수증 옆 `current-portable.json`을 사용한다. 원본 정본의
직렬화 SHA는 읽기 영수증의 provenance이며, 이 스크립트가 DB를 다시 읽어 증명하지는
않는다. 대신 영수증 자체와 실제 portable 파일 바이트를 모두 봉인·재검사한다.
공용 snapshot은 공식 읽기 결과 `{revision,libraries}`를 미리 파일로 제공한다.

```bash
node scripts/content/publish-pixel-art-world-loose-supplements-library.mjs \
  --prepare /private/output/bundle.json /private/download-root \
  /private/output/canonical/source-proof.json /private/output/shared-before.json \
  /private/output/supplement-library

node scripts/content/publish-pixel-art-world-loose-supplements-library.mjs \
  --publish-local /private/output/supplement-library /private/output/publish-receipt
```

출력 경로는 `output/` 아래의 비공개 폴더여야 한다. `--prepare`는 SQLite 모듈을
로드하지 않고 파일만 만든다. 원본을 `by-source/<제작자 URL 상대경로>` 또는 다운로드
루트의 원래 파일명에서 찾아 직접 재해시한다. Playwright의 빈 페이지 Canvas로
원본 규격, atlas, 모든 파트 정상/반례, 전체 배열 정상/오류, 장소 정상/오류,
각 kit가 소유한 원본 이미지까지 재합성·픽셀 대조한다. 앱·호스트·네트워크·저장소
브리지를 열지 않는다. 준비물의 `sourceHashes`만 신뢰하지 않는다.

실제 `createSupplementTileset` 결과와 전체 kit/레이어/통행/그룹 배열을 비교하고,
`validateTileset` 및 `validateSpatialAuthoring`의 실제 스키마로 검사한다. 후자의
빈 공간 문서는 메모리에서 장소 형식 검사용으로만 만들며 저장하거나 region을
생성하지 않는다. UUID 타일셋·asset과 객체/장소 kit ID를 `shared_paw_*`로 바꾸고
중첩 MD JSON·이미지 ID·그룹·배치 참조에도 한 번의 치환을 적용한다. 픽셀은 그대로다.

결과 `library.json`, `preparation-proof.json`, `preparation-seal.json`에는 원본과
준비물·카탈로그·메타데이터·읽기 영수증·snapshot의 봉인과 ID 대응을 남긴다.
봉인은 악의적 변조에 대한 전자서명이 아니라 검토 후 파일 드리프트 검사다.
`readPreparedLibrary()`는 DB 없이 봉인과 원본을 다시 확인하고 라이브러리를 재구성해
전체가 일치하는지 검사하므로, 감독자는 게시 전에 이 함수만 호출해 재검토할 수 있다.

DB를 여는 경로는 명시적 `--publish-local` 하나다. 공식
`scripts/lib/sharedContentSqlite.ts` API를 그때만 로드하여 대상 라이브러리의
기존 payload 해시로 CAS한다. snapshot 전체 revision은 CAS하지 않으므로 다른
라이브러리의 병행 추가는 허용한다. 타 라이브러리 ID 소유권 충돌을 거부하고,
공식 게시 직후 다시 읽어 대상 전체 일치 및 기존의 다른 라이브러리 보존을 확인한다.
오래된 입력이면 새 snapshot으로 다시 준비한다. 정본 프로젝트에는 쓰지 않는다.

## 감독자 통합 관찰 (2026-09-25)

root fresh prepare 후 봉인 입력으로 공용 게시, 정본revision53의5타일셋/5자산 바이트와
기존12맵 보존을 재로드했다. 실제canMove5장소10접근점 양방향과 AI90MD/103페이지/137그림 확인.
원본106/객체539 라이브러리는 그대로다. 보충카드가 검색어를 갖지 않아 검색 후 계속 숨는
실제 결함을 수정했다. 카드에 이름/원본 파일명/객체명 검색어를 넣었고 공통 필터의 빈 검색어는
모든 카드를 표시한다. `output/paw-supplement-install/` 및 `output/paw-mansion-install/` 참조.

`append-pixel-art-world-region-candidates.mjs`는 기존 공용도시 region에 학교·하수도3곳과
보충5곳의 정확한 전체 배열/의존 타일셋/접근점을 추가한다. 기존 maps/tilesets/assets는
변경하지 않고 현재 native library만 CAS한다. native publisher도 같은 함수를 호출하여 후속
전체 재게시에서 이 자료가 지워지지 않는다. region 조회로18MD/21페이지/18그림을 확인했다.
새 도시 배치/출입 이벤트 완료를 뜻하지 않는다.
