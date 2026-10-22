# ObjectSpec v1 — 기물 설명서 하나로 (2026-10-20)

기물(맵 오브젝트) 하나의 「이름·크기·발밑·놓는 곳·쓰임·통행·3/4 영수증·출처」를 담는 단일 정본.
**object-gen**(비공개 저장소 `MovieHolic-Plex/object-gen`) · **에셋 스토어** · **에디터**가 같은 꼴을 읽는다.
2026-10-21 부터 tile-gen 은 지형(바닥·자동 타일·물·숲·절벽) 생성기라 기물 설명서를 쓰지 않는다 — 그 팩은 `content.objects` 없이 타일셋 하나와 `autotileGroups`(·`animationStrips`)만 싣는다(`openwiki/editor-workshop.md`).
설계 그림: `~/claude-viz/asset-gen-platform-1.html` (http://mdc-server:18301/asset-gen-platform-1.html).

## 어디에 있나

| 조각 | 위치 | 하는 일 |
|---|---|---|
| 형식·검사 | `src/project/objectSpec.ts` | `ObjectSpecV1`, `validateObjectSpec`, `objectSpecPassage`, `objectSpecOneLine`. **아무것도 import 하지 않는다** — 스토어가 계약 파일로 바이트 그대로 복사한다 |
| 킷 ↔ 설명서 | `src/project/objectSpecKits.ts` | `objectSpecOfKit`(정식 spec → 공방 옛 태그), `specFromLegacyWorkshopTags`, `migrateLegacyWorkshopKit` |
| 정본 자리 | `SectionStructureKitDef.spec` (`src/project/types/base.ts`) | 기물이 속한 타일셋의 구조 킷 |
| 스토어 팩 | `StorePackContent.objects[]` (`src/assetStore/format.ts`) = `{tileset, kit, spec}` | `buildPack` 이 킷 spec 에서 만든다(`packObjects`). 넣을 때 킷에 spec 이 없으면 목록에서 붙인다 |
| object-gen | `schema/objectspec.v1.schema.json`, `types/objectspec.ts`, `objectgen/spec.py` | 같은 계약. 필드를 바꾸면 이쪽과 같이 고친다(tile-gen 사본은 2026-10-21 지형 전환 때 지웠다) |

## 규칙

- 필드는 **더하기만** 한다(`oprn-object-spec/1` 유지). 스토어 계약 순서는 `openwiki/asset-store.md` 「계약 동기화 절차」.
- `tags` 는 찾기 낱말이다. `hand:floor`·`foot:1` 같은 인코딩 태그를 넣지 않는다 — 그 정보는 `placement.anchor`·`view.footRows` 에 있다.
- `passage` 한 칸: `.` 밟음 · `X` 막힘 · `*` 캐릭터 위에 그려지며 지나감(★) · 공백 = 그림 없는 칸.
- `gate` 는 영수증 **요약**이다. 번들·공용·공개 스토어 출구는 영수증 원본(`object-gate`)을 다시 본다 — 설명서의 `verdict: "pass"` 만으로 통과시키지 않는다.
- `provenance.aiGenerated` 는 AI 가 그렸으면 참이다. 공방·`author_pixel_art`·object-gen 은 항상 참으로 쓴다.
- 번들·팩 킷처럼 설명서가 아직 없는 킷을 `objectSpecOfKit` 이 짐작해 만들지 않는다(추측값이 정본처럼 퍼지지 않게).

## 공방 태그 이주

- 새 굽기(`bakeWorkshopObject`)는 `spec` 을 쓰고 `ai.tags` 에는 `[stampKind, "workshop"]` 만 남긴다.
- 읽는 쪽(`bakedWorkshopKit`·`workshopHandObjects`·`roomKitHandObjects`)은 spec 을 먼저, 없으면 옛 태그를 본다.
- 옛 저장본은 불러올 때 `attachWorkshopTiles`(`ensureBundledTilesets`·`ensureAtlasBiomeInteriorCurrent` 가 지나가는 자리)가 `migrateLegacyWorkshopKit` 으로 옮긴다. 업로드 칩셋에 구운 공방 킷은 이 길을 안 타므로 읽는 쪽 대체 경로가 계속 필요하다.

## 시험

`test/objectSpec.test.ts` — 검사, 옛 태그 → 설명서, 공방 굽기 spec, 팩 목록·매니페스트 검사.
