# 숲마을 공용 선별본

소스 타일셋은 `forest_high_cliff_river`, 원본 프로젝트는
`oprn-hill-forest-harmony-20260918-a4e1`이다. 다른 타일셋에 타일 번호를 그대로 적용하지 않는다.

## 장소

최신 곡선 배치 10종 중 서로 다른 지형과 동선의 참고 가치가 있는 7종을 등록했다.
달물 호반마을, 두갈래 물길마을, 층층 정원마을, 긴숲 오솔마을,
열매뜰 마을, 잔물결 어촌, 다섯숲 숨은마을.
샘고리·나루 사이·바람등성이는 삭제하지 않고 기존 자료에 보존한다.
이미 공용인 13개 장소의 ID 및 스냅샷도 덮어쓰지 않는다.

정확한 ID와 선정 이유는 `places.json`, 원격 저장/재로드 증거는 `place-persistence.json`.
등록 진입점은 `src/project/curatedVillagePlaceReferences.ts`이며,
`public/assets/region-references/organic-*.oprn.json`에 이미지까지 포함한 독립 스냅샷을 둔다.
집 내부·NPC·상호작용은 구현 범위가 아니다.

## 오브젝트

원본 칩셋에서 선별한 19종을 `shared_forest_village_objects`에 등록한다.
`objects.json`에 이름, 안정 ID, 16px 타일 단위 크기를 기록한다.
기존 공용 Tibo 오브젝트 357개와 완성 이미지 해시를 비교하여 같은 이미지를 중복 추가하지 않았다.
기존 프로젝트는 `ensureBundledTilesets`, 새 프로젝트는 `defaultTilesets`로 받는다.
공용 오브젝트 → **숲마을 · 선별 소품 19종**에서 선택하고 내 오브젝트로 복사할 수 있다.
다른 칩셋 맵에 바로 찍는 것은 기존 타일셋 일치 규칙의 제한을 받는다.

- 16×16 픽셀을 그대로 복사하고, 오브젝트의 전체 폭·높이·투명도·통행·우선순위를 보존한다.
- 6열 14행 작은 시트에 배치한다. 표시용 previewMap의 하위 240번 받침은 오브젝트에 포함하지 않는다.
- 가마·장작보관대·물통·꽃수레·버섯과 통나무·종·금지된 벤치 등은 선별 대상에서 제외했다.
- 새 그림을 생성하거나 원본의 픽셀을 재해석하지 않았다.
- `oprn-shared-forest-village-objects-v1`은 원격 보존용 스냅샷이며,
  번들 정의와 같은 19개 키트를 이미지와 함께 포함한다.

재현 순서: 최신 로컬 SQLite와 LegacyDb를 읽어 `output/evidence/shared-village-curation/`
의 local-before.json / remote-before.json에 보관 → `prepare-shared-village.py` →
`publish-shared-villages.mjs` / `publish-shared-village-objects.mjs`.
동일 스냅샷 ID의 내용이 다르면 중단한다. 수정판은 새 리비전을 사용한다.

## 타일 → AI 참고문서

`AI-REFERENCES.md`와 기존 `PLACEMENT.md` 및 마을 사진 7개는
`forest_high_cliff_river` → **숲마을** 용도에 들어간다.
`OBJECTS-AI.md`와 소품 시트는 `shared_forest_village_objects` → **마을 소품** 용도에 들어간다.
현재 로컬 편집 프로젝트는 **SQLite가 정본**이다. 원격 스냅샷은 별도 보존본이다.
문서를 포함한 공용 다운로드는 새 v2 스냅샷을 사용하며 v1 원격 내용은 유지한다.

재현: `prepare-shared-village-references.mjs` →
`apply-shared-village-references.mjs`(에디터/SQLite) →
`save-shared-village-reference-snapshots.mjs`(원격 보존본).
위 스크립트들은 `scripts/content/`에 있다. 사용자 문서와 맵을 덮어쓰지 않는다.

위 원격 발행·스냅샷 스크립트는 저장 전환에서 제거한 과거 작업 기록이다. 생성된 자료는 보존하며 현재 프로젝트 저장은 `project.sqlite` + `assets/`를 사용한다.
