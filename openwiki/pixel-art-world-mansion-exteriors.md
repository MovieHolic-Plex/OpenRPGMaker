# Pixel Art World 저택 외관3판본

[원본·지붕/발코니 whole·접근·준비 계약](../tiledata/pixel-art-world/MANSION-EXTERIORS.md).
`mansion-exteriors.json`은 raw54, `mansion-exteriors-layout.json`은 합성7/장소3,
`mansion-exteriors-comparison.json`은 원본별 wholeRGBA/alpha 비교다.
prepare-pixel-art-world-mansion-exteriors.mjs → Catalog/Layout JSON.

외부타일셋 카탈로그에서3팩을 선택하며 `externalTilesetImport.ts`가 실제SHA/치수를검증하고
`pixelArtWorldMansionExteriors.ts`에연결한다. 원본408칸보존/B·Y528/P552칸.
전체건물은 원본중앙셀만반복하며 곡면/처마/기단을보존한다. 같은upper에창을찍어벽을지우지않는다.
잘린이웃창을포함하는 raw포르티코는 등록하지않고 sourceRect부분들을 완전난간/기둥으로합성한다.

보행발코니는 미지원이다. 공식3층관계를정적2레이어그림으로대체하고통행을허용하지않는다.
각객체에전체배열/원본근거/정상오류자료, 구조객체에는전체건물관계그림도소유한다.
Publisher는 Catalog54/Layout61/scenes3를구분한다. 준비그림은사용자로컬이며 DB저장은감독자만한다.

## 로컬 공용 저장과 실제 관찰 (2026-09-25)

root 통합 브라우저에서3원본 SHA/408칸 prefix/61객체/3장소를 다시 준비했다.
`publish-pixel-art-world-local-library.mjs`의 Catalog/Layout 대상에 외관을 함께 추가한다.
장소는 실외 태그와 현관 앞 port를 가지며, 지역은 `mansion-exterior-candidates`의 전체 배열과
색상별 원본 대응/별도 실내 연결 지침을 소유한다. 실내 후보 문구로 외관을 설명하지 않는다.

정본 revision55에3타일·3자산, revision56에 native+연출 공용36타일·120자산을 저장해 바이트까지
재로드했다. 정본 id `6ae74f7a-23a2-449b-8171-5afb5dff532b`, 사용자 로컬 `paw-city-20260924`.
공용 native는34타일·479객체·30장소·1지역·12맵이며 다른 별도 라이브러리와 구분한다.
외관3의 접근점17곳이 실제 canMove로 왕복 가능했다. 실제 AI 도구로 외관3타일·64kit(래스터3포함)·
3장소와 지역을 읽어289MD/307페이지/237그림을 확인했다. 추가3외관/2물연출 다운로드 카드와
3장소의 AI 패널은 최신 빌드 편집기에서 오류0으로 확인했다.
개인 근거 `output/paw-mansion-exterior-install/`; 원본·준비그림은 Git/public에 넣지 않는다.
도시 배치·현관 전이·보행발코니 지원을 완료했다는 근거는 아니다. 전체 테스트/게이트는 실행하지 않았다.

동일 최신 빌드의 실제 새 프로젝트 메뉴에서 생성한 SQLite id
`b66b94bd-0aaa-494c-82a4-c57d9a89d8da`를 revision2에서 재로드했다.
PAW281타일셋 정의와365자산 전체 바이트가 공용 자료와 일치했다.
`output/paw-mansion-exterior-install/automatic-project-proof.json`은 실제 start.createProject 요청과
새 폴더 재로드 근거다. 이전 dev→host 대용량 전달 관찰 실패를 재사용하지 않고 실제 UI 경로로 확인했다.
