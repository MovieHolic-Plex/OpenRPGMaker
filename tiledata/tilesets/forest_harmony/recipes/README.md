# 공용 숲마을 정밀 조립 자료

공용 타일 `forest_harmony` → AI 참고문서 → **정밀 조립·검증**에서 읽는다.
부품10개, 조립6개(건물·가구·숲·울타리·동굴), 상세문서19개, 정상6장·오류비교8장이다.

- [요구사항별 근거](COMPLIANCE.md)
- [실행 순서](public-assembly-guide.md)
- [조립 데이터 정본](catalog.json): 두 레이어 전체 배열·원본 좌표·문·접근칸·순서
- [원본 부품 사전](parts.json): 칩셋 ID, 원본 칸/픽셀 좌표, 전체 배열
- [검증 실제 출력](validation-examples.json)
- [레이어 정정](public-layer-corrections.md)
- [숲 비교 그림](forest-strip-missing-trunk.png)

기존 원본 숲 조립법은 LEGACY-FOREST.md를 참고한다. 직접 재배치 시 최신 정밀 조립법을 우선한다.

## 재생성

1. node scripts/content/prepare-public-tile-recipes.mjs
2. node scripts/content/prepare-forest-executable-references.mjs
3. node scripts/content/render-public-recipe-references.mjs
4. node scripts/content/embed-public-tile-recipes.mjs
5. node scripts/content/prepare-forest-public-references.mjs
6. 프로젝트 호스트를 종료하고 node scripts/content/register-public-tile-recipes.mjs <projectDir...>

공용 다운로드 갱신은 해당 프로젝트의 forest_harmony에 ensureForestHarmonyReferences를 적용한다.
출하된 public-assembly-v2를 고칠 때는 관리 중인 같은 카테고리도 갱신해야 한다.
기존 사용자 카테고리·맵·오브젝트는 덮지 않는다.
