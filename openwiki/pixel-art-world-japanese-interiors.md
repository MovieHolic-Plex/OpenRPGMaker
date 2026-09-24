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
