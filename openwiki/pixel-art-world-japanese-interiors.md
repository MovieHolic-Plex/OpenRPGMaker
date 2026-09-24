# Pixel Art World 이자카야·일본식 방

[원본·3층 합성·장소·준비 계약](../tiledata/pixel-art-world/JAPANESE-INTERIORS.md).
`japanese-interiors.json`은 원본400칸/23레시피, `japanese-interiors-layout.json`은
픽셀 합성2개와 실제 장소2개의 메타데이터 정본이다. prepare 스크립트가 Catalog/Layout JSON을 만든다.

`externalTilesetCatalog.ts`로 두 팩을 선택하며 `externalTilesetImport.ts`는 원본 SHA/치수 확인 후
`pixelArtWorldJapaneseInteriors.ts`에 연결한다. 일반 원본 문서 생성/render 콜백을 받아
파생 아틀라스만 뒤에 붙이고 객체25개/장소2개 문서·그림을 생성한다. 원본/파생 좌표 단위를 구분한다.
타일 참고문서 외 각 structureKit에도 자기 정상/오류 문서를 붙인다. 합성물의 부품 픽셀좌표는
원본이고 완성 타일번호는 파생이므로 400번 이후를 원본 시트에서 자르면 안 된다.

원본400칸을 그대로 유지하고 이자카야480칸/와시츠400칸으로 준비한다. 다른 팩은 기존 동작을 유지한다.
브라우저 준비·공용 인계 명령은 위 문서에 있다. 픽셀/그림/준비 JSON은 사용자 로컬 전용이다.
DB 쓰기·정본 save/reload는 감독자 단계이며 준비 성공으로 저장 완료를 주장하지 않는다.

## 로컬 공용 게시와 정본 확인 (2026-09-24)

native publisher는 원본 Catalog와 파생 Layout을 함께 읽고,25객체의 실제 structureKit 소유
문서를 복사한다.2scene의 원본 문서와 전체 배열을 공용 장소에 함께 보존한다.
지역 `shared_paw_city`의 `facility-expansion`은 욕실/체육관/식당/와시츠4장소를 확장 후보로
설명한다. 각 전체 배열·문턱·접근점·장소ID·실제 그림을 싣고 아직 도시 이벤트에 연결되지 않았음을
명시한다. 새 실내로 배치할 때 기존 외관/주택/계단을 덮지 않고 출입과 복귀를 별도 연결한다.

root가 실제 importer를 다시 실행해 원본400칸 보존/shape/접지/전체장소 배열을 확인했다.
실제 collision.canMove 접근20점/필수통로가 양방향 연결된다. 원본2타일셋·2자산 revision46,
공용26타일셋·69자산 revision47에서 호스트CAS 저장 후 같은SQLite에서 정확히 재로드했다.
기존12맵 보존. AI도구2타일·27kits(25객체+2장소 래스터)·2장소·1지역의121MD/124페이지/92이미지
조회와 신규blank serialize/deserialize 일치,두번째공용투영불변을 확인했다.
별도SQLite 신규생성264타일셋 증거는 이 일본식팩 게시 전이므로 이팩의 신규생성증거로 쓰지 않는다.

공용 Node조립 PNG와 browser Canvas조립 PNG는 이자카야107/와시츠24픽셀에서 최대RGB1레벨의
합성 반올림 차이가 있고alpha는 일치한다. 미리보기RGBA동일이라고 주장하지 않는다.
사용자 원본/파생 atlas 바이트와 전체배열 저장 검증은 별도이며 정확히 일치한다.
증거 Git 제외 `output/paw-japanese-install/`. 전체테스트/게이트는 실행하지 않았다.
실제 빌드 편집기에서 파일명2개 검색·다운로드/가져오기 카드와 장소2개 썸네일/AI문서 섹션을 확인했다.
첫 UI 관찰은 표시 이름에 없는 '이자카야'를 검색한 스크립트 오류로 카드 대기시간을 초과했고,
실제 이름 '작은 일식당'으로 고쳐 재관찰했다. 제품 오류와 구분한다. 재관찰 브라우저 오류0.
