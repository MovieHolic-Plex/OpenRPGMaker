# 저작권 정리 — 직접 만든 것만 남긴다 (2026-10-07~)

사용자 결정(2026-10-07): 저작권 문제로 **직접 만든 것(코드·손 도트·하네스로 그린 것)이 아니면 완전히 삭제**한다.
숨김·차단이 아니라 파일·DB 행을 지운다. 이전 결정(2026-09-29 EasyRPG 폐기, 2026-10-06 조수 차단 #2204)은
「막기」였고 등록 장소는 오히려 계속 추천했다 — 이 정리가 그것을 대신한다.

## 남기는 칩셋 (직접 만든 것)

`beodeul_city`(버들항) · `atlas_biome_interior`(손 도트 실내 v5) · `joseon_baram` · `wizarding_world` · `jp_city` · `modern_city`.
이 칩셋 위 등록 장소 37곳(조선 15 · 마법 학교 17 · 일본 도시 4 · 현대 도시 1)만 배송한다.

## 1단계 — 장소 (완료)

- **공용 DB** (`~/.local/share/oprn/shared-content.sqlite`): 라이브러리 37개 행과 그 이력(content_history 198행)을 지우고
  VACUUM 했다(3.7GB → 1.35GB). 남은 라이브러리: `charset-actor-kept`, `oprn-hand-interior-harness`, `worldmap-*` 4개.
  지우기 전 현재 판만 `~/backups/shared-places-purge-20261007.sqlite` 에 떠 두었다 — 사용자 확인 뒤 지운다.
- **번들**: `REGION_REFERENCES` 는 빈 목록, `PLACE_REFERENCES` 는 위 네 칩셋 모듈만. 지운 것: 호수·배·숲·성채·판타지·RPG 실내·
  RPG 던전·기후 마을·필드·엘프 나무 위·다양한 숲마을·큐레이션 마을 장소 모듈과 그 스냅숏(`src/project/regionReferences/*.json`),
  미리보기·내려받기 파일(`public/assets/region-references`), 검수 장소 카탈로그(`reviewedPlaces/catalog.json` 빈 목록,
  `public/assets/reviewed-places` 전부), 강변 숲마을 장소, 공용 오브젝트 카탈로그 254개와 미리보기(`public/assets/shared-objects`),
  참고 맵에서 잘라 온 집 형태 `ref-walled-*`·`ref-castle-*`.
- 아직 남은 것(2단계에서 같이 간다): 지운 장소 미리보기 중 **타일셋 참고문서가 그림으로 쓰는 것**
  (`bundledReferenceImageManifest.json`·`forestHarmonyTileset.json`·`sharedCastleReferences.json` 등이 가리킴)과 그 칩셋 자체.

## 2단계 — 자산 (대기)

칩셋·캐릭터 칩·얼굴·배틀러·전투 배경·효과음·음악·폰트·타이틀·아이콘. 목록과 판정은 감독자 보고 페이지에 있다.
「생성 이미지를 그대로 쓴 것」(흉상·전신, 아이템 아이콘, 타이틀·오프닝 스틸 등)은 사용자 판단 대기.

## 주의

- git 이력에는 지운 파일이 그대로 남는다. 저장소를 공개하기 전에는 이력 재작성(filter-repo)이 따로 필요하다.
- 이미 그 칩셋으로 그린 사용자 프로젝트 맵은 2단계에서 칩셋을 지우면 그림이 빠진다.
