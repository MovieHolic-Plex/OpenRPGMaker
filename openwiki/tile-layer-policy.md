# 타일 레이어·배경 정책 (OPRN-OUT-026)

투명한지 여부(시각 사실), 어느 레이어에 사는지(논리 소속), 하위에 그릴 때 아래에 무엇을 깔지
(배경 합성), 그리고 다른 칸의 조각이 그 선택을 묶는지(다중 조각 제약)는 **서로 다른 축**이다.
이 네 축을 "배경이 없으면 상위" 한 규칙으로 합치면 기본 칩셋 나무 밑동에서 깨진다.

판정은 `src/editor/tileLayerPolicy.ts` 한 곳에서 계산하고, 편집기 미리보기
(`src/editor/chipsetTileRender.ts`), 런타임 렌더러(`src/player/playSceneMapRuntime.ts`),
DB 타일셋 편집기(`src/editor/panels/tilesetMetadataEditor.ts`), 테스트가 같은 답을 쓴다.

## 다섯 부류

| 부류 | 홈 레이어 | 받침 | 예 | 왜 |
|---|---|---|---|---|
| `opaqueFloor` | 하위 | 없음 | 잔디 240, 물 120, 직선 지붕면 404, 사선 지붕 몸체 374–377 | 불투명하므로 아래를 비출 일이 없다 |
| `transparentOverlay` | 상위 | 없음 | 벤치 357, 사선 지붕 캡 384–387, 텐트 448 | 상위에서 하위 지면을 **보존**해야 한다. 하위에 깔면 투명 픽셀 아래가 검다 |
| `backedLower` | 하위 | 있음(기본 잔디 240) | 나무 밑동 290~293 | 수관(상위)과 같은 칸에 공존해야 하므로 하위에 남고, 렌더러가 받침을 합성한다 |
| `transparentLower` | 하위 | 없음(사용자 선택) | 사용자가 받침을 "없음"으로 확정한 투명 칩 | 의도적으로 비어 보이게 두는 경우. 경고는 남지만 막지 않는다 |
| `multiPart` | 상위/하위 | 부류에 따름 | 수관 260~263, 2×2 활엽수 | 다른 칸의 조각이 레이어 선택을 제약한다 |

`tileLayerPolicy(tileset, tile)` 는 부류·홈 레이어·받침 타일·짝 조각·근거 문장을 함께 준다.
근거 문장은 편집기 규칙 탭과 검토 목록에 그대로 표시된다.

## 받침(backing) 메타

- 스키마: `TileAiMetadata.layerBacking?: "none" | number` (`src/project/types/base.ts`).
  숫자는 받침 타일 id, `"none"` 은 받침 없이. 필드가 없으면 정책 기본값(밑동=잔디)을 따른다.
- 쓰기 경로: `setTileBackingOverride(tileset, tile, "auto" | "none" | <타일 id>)`.
  `"auto"` 는 필드를 지워 하네스 판정으로 되돌린다.
- 읽기 경로: `userTileBackingOverride` (사용자 확정만), `tileBackingTile` (정책 기본값 포함).
- 받침은 **렌더 합성 전용**이다. `map.lowerTiles` 슬롯을 덮어쓰지 않고 통행 판정
  (`tilePassability`)도 바꾸지 않는다.

## 커스텀 칩셋 준비 — 검토 신호, 자동 변형 금지

`backgroundlessLowerReviews(tileset)` 는 **투명한데 하위에 살면서 받침이 없는** 타일을
검토 항목으로 모은다. 계약:

- 목록을 만드는 것만으로 타일셋이 바뀌지 않는다(테스트가 직렬화 비교로 고정).
- 가져오기·준비 단계에서 투명 타일을 일괄·되돌릴 수 없게 상위로 올리지 않는다.
- 적용은 항목마다 사용자가 고른다: **상위 오버레이 / 하위 + 받침 / 투명 하위 유지 / 자동**.
  DB 타일셋 편집기 규칙 탭의 `tileset-rule-review` 목록이 그 표면이다.

## 나무 밑동 290~293 을 상위로 옮기면 안 되는 이유

- `src/project/tilesetHarness/combinedTown.ts` 가 투명 칩 상위 승격에서 밑동만 제외한다.
- `src/editor/tools/forestComposition.ts` 는 밑동이 하위 solid, 수관이 상위 ★인 전제로
  숲 커버리지·통행 계약을 맞춘다. 밑동을 상위로 올리면 런타임 받침 합성을 우회하고
  숲 벤치마크 기대치가 깨진다.
- 따라서 이 이슈는 밑동 기본값 변경을 **승인하지 않는다**. 사용자별 override 는 가능하다.

## OPRN-OUT-017 과의 관계 (원인 공유는 미증명)

`test/tileLayerPolicyClusterRegression.test.ts` 가 하드클러스터 거부 네 경우(상단 경계,
위 칸 상위 점유, 보호 셀, 빈 공간)를 레이어·받침 선택을 바꿔가며 측정한다. 실측 결과:

- 받침을 "없음"으로 바꿔도 네 경우의 거부 결과는 **동일**하다.
- 밑동을 상위로 확정해도 거부 결과는 **동일**하다 — 거부는 동반 타일의 좌표 제약에서 나온다.

즉 레이어 분류는 OPRN-OUT-017 의 잠김 원인이 아니다. 두 이슈를 같은 원인으로 묶지 말고,
017 의 수동 복구 요구사항은 독립적으로 유지한다.

## 테스트

| 파일 | 고정하는 것 |
|---|---|
| `test/tileLayerPolicy.test.ts` | 다섯 부류 판정, 사용자 override, 자동 복귀, 검토 목록 비변형, **근거 문장이 실제 받침 결과와 일치** |
| `test/tileLayerPolicyEditorSurface.test.ts` | 규칙 탭의 정책 근거·다중 조각 표시, 받침 버튼, 검토 목록 적용 |
| `test/tileLayerPolicyClusterRegression.test.ts` | 레이어/받침 선택 대비 하드클러스터 거부 행렬, 통행 불변 |
| `test/customChipsetTransparencyDetection.test.ts` | 픽셀 스캔 판정·띄 경계, 감지 비변형(직렬화 바교), 캐시 히트/무효화/투명색, unknown 세 경로, 내장 칩셋 불변 |
| `test/forestTrunkLayers.test.ts`, `test/transparentTileLayerRouting.test.ts` | 기존 밑동 하위·투명 상위 계약 회귀 |

## 브라우저 증거 (2026-09-10)

`scripts/qa/tile-layer-backing-policy.mjs` → `verify-shots/oprn-026/`(6장면, 6/6 PASS).
데이터베이스 → 맵/타일 → 합본 마을 칩셋 → 「통행·지형」 탭에서 밑동 290 을 실제로 클릭해
정책 부류·근거·다중 조각 제약, 받침 자동→없음→잔디 전환, 경고가 켜지는 정확한 순간,
검토 목록의 등장·소멸, 검토 항목 「상위 오버레이」의 단일 타일 범위를 찍는다.
단언 실패 시 exit 1. 고정 sleep 없이 앱의 `project-export-json` 미러 갱신을 기다린다.

함정 두 개를 기록해 둔다.
- **앱의 store 를 스크립트에서 다시 import 하면 다른 인스턴스다.** dev 서버가 앱에는
  `store.ts?t=<hmr>` 를 실어 주므로 쿼리 없는 `import('/src/project/store.ts')` 는
  로드되지 않은 두 번째 싱글턴을 준다(실측: `isLoaded() === false`). 저작 상태는
  숨은 `project-export-json` 미러에서 읽고, 판정은 순수 함수로 계산한다.
- **규칙 패널은 세로로 스크롤된다.** 경고와 검토 목록이 접힌 아래쪽에 있어서
  스크롤 없이 찍으면 단언은 통과하는데 스크린샷에는 그 증거가 없다.

그 촬영이 **결함 하나**를 드러냈다: 받침을 「없음」으로 확정하면 부류는
「투명 하위(받침 없음)」로 바뀌는데 근거 문장만 "받침 타일로 투명 픽셀을 채웁니다" 로
굳어 있어, 바로 위 경고와 정면으로 모순되는 설명이 같은 화면(그리고 검토 목록 항목)에
떴다. `tileLayerPolicy.ts` 의 `trunkReason()` 이 실제 받침 결과를 말하도록 고쳤다.
## 커스텀 칩셋 픽셀 자동 감지 — 출하된 계약

명시 `투명` 태그가 없는 사용자 칩셋도 **알파를 직접 스캔**해 투명 여부를 안다.
순수 판정은 `src/project/tileAlphaScan.ts`, 브라우저 배선은 `src/editor/customChipsetTransparency.ts`.

계약 다섯 줄 — 이것이 전부다:

1. **감지는 검토 신호일 뿐, 메타를 스스로 바꾸지 않는다.** 가져오기·준비 단계에서의 일괄
   재분류는 금지다. 적용은 항목마다 사용자가 고른다(상위 오버레이 / 하위+받침 / 투명 하위 유지 / 자동).
2. **검토 목록에는 뚫린 투명만 올라간다** — `partial`·`mostlyEmpty` 만. 가장자리 안티에일리어싱
   (`softEdge`)과 빈 여백(`empty`)은 하위 배치가 안전하므로 목록을 오염시키지 않는다.
3. **캐시 키 = 이미지 신원 + 아틀라스 기하 + 투명색.** 그중 하나라도 바뀌면 자동
   무효화되어 재스캔한다. 동시 요청은 하나로 합친다(큰 아틀라스를 렌더마다 다시 읽지 않는다).
4. **읽지 못한 이미지는 '알 수 없음' 이다.** CORS 오염·로드 실패·2D 컨텍스트 부재는 전부
   `unknown` 이고 그 사실을 화면에 적는다. 절대 '불투명' 으로 낙관하지 않는다.
5. **내장 칩셋 경로는 불변이다.** 생성 투명 목록(`generatedChipsetTransparency.ts`)이 그대로
   정본이고 스캔조차 하지 않는다. 런타임 렌더러의 `tileBackingTile` 경로도 예전과 동일하다
   — 감지는 편집기 표면에만 **주입**된다.

투명색 키(color key)도 같은 알파를 본다: 런타임이 `transparentColor` 를 베이크 시점에
키아웃하므로 스캔도 동일한 키를 적용한다. 이걸 빼면 마젠타 배경 시트(알파는 전부 255)가
'전부 불투명' 으로 읽혀 검토 목록이 통째로 비는 거짓 음성이 난다.

### 임계값 — 실제 시트를 재서 얻은 수치다 (2026-09-10)

표본: 실제 출하 시트 6장, 16×16 셀 **2,880칸**.
`easyrpg-chipset-{combined-town,interior,dungeon,retro-house,ship}-transparent.png` +
`modern-exteriors/modern-city-atlas.png`. 재측정: `node scripts/measureChipsetAlpha.mjs`.

| 상수 | 값 | 실제 관측 근거 |
|---|---|---|
| `OPAQUE_ALPHA` | **250** | 표본 전체에서 알파 249~254 픽셀이 **0개**. 경계가 관측값 없는 빈 구간에 농인다 |
| `EMPTY_ALPHA` | **8** | 알파 1~8 픽셀이 **0개**. 하드 픽셀은 정확히 0과 255만 쓴다 |
| `SOFT_EDGE_MAX_RATIO` | **16/256 = 6.25%** | 비불투명 픽셀 수가 2,4,5,6,7,8,11,12,16 에 초초하다가 그 위로 벌어진다. 16 이하는 전부 "실루에은 꽉 찬 칩의 가장자리" 였다 |
| `MOSTLY_EMPTY_MAX_COVERAGE` | **0.15** | 0이 아닌 최저 커버리지가 0.043 · 0.109 · 0.121 · 0.129 다음이 **0.156**. 그 빈 구간을 가른다 |

부류는 여섯: `opaque` · `softEdge` · `partial` · `mostlyEmpty` · `empty` · `unknown`.

### 브라우저 실측 (Modern Exteriors 아틀라스 480칸)

감지 결과: 불투명 302 · 부분 투명 135 · 거의 빈 칸 2 · 가장자리만 부드러움 19 · 빈 칸 22.
이 중 검토 목록에 오른 것은 **97칸**(뚫린 투명만). 감지가 돌은 뒤에도 프로젝트 정본
직렬화(`canonicalPayload`)와 모든 타일셋의 `priority`·`tileMeta` 가 바이트 단위로 동일했다.
증거 PNG: `verify-shots/chipset-transparency/`, 재현 명령:
`.omo/evidence/chipset-transparency/NOTES.md`.

## 아직 결정이 필요한 것 (제품 소유자)

- 내보낸 플레이(export player)에서 받침 합성을 별도로 검증하는 QA 시나리오 추가 여부.


## 캔버스 렌더러도 받침 계약을 진다 (2026-09-12 실측 결함)

정책을 세 곳(편집기 캔버스·런타임·DB 편집기)이 공유하는데도 **네 번째 렌더러가 빠져 있었다.**
맵 썸네일·스크린샷·미니맵·구운 마을 전경이 쓰는 캔버스 공유 렌더러
(`src/editor/mapTileDraw.ts`)가 `tileBackingTile` 을 부르지 않아, 나무 밑동 자리가 검은
사각형으로 뚫렸다.

- **증상**: 같은 맵이 편집기에서는 멀쩡하고 썸네일·스크린샷·원형 카드에서만 뚫린다.
  "가끔 나무 밑이 까맣다"는 제보는 대개 이 렌더러를 탄 표면이다.
- **원인**: 밑동 칩의 투명 픽셀이 캔버스 배경(`0,0,0,0`)을 드러낸다. 받침을 안 깔면
  그 픽셀이 그대로 검게 남는다.
- **실측**: 마을 40×40·8채에서 밑동 57칸에 검은 픽셀 6,641(최악 143/256칸). 구운 원형
  전경 6장은 1.51%. 수정 후 각각 **0**.
- **왜 정책 테스트가 못 잡았나**: `tileLayerPolicy.test.ts` 는 정책 함수의 답만 본다.
  결함은 **렌더 경로**에 있었다. 그래서 렌더러가 실제로 받침을 그리는지 보는 회귀
  테스트(`test/mapTileBacking.test.ts`)를 따로 둔다 — 하위에 받침을 깐다 / 상위에는 깐다
  안 깐다 / 사용자가 끄면 안 깐다.
- **새 렌더러를 추가할 때**: 하위 타일을 그리는 순간 `tileBackingTile(tileset, tile)` 을
  먼저 부른다. 받침은 하위 레이어에만 의미가 있다(상위는 아래 지면이 이미 있다).
  스크립트로 그림을 굽는 곳도 같다 — `scripts/bake-village-archetype-previews.mts` 가
  같은 이유로 같은 처리를 한다.


## 숲마을 공통 기본 칩셋 (2026-09-18)

`forest_harmony` (표시명 `숲마을 · 거리별 잔디`)는 승인된 원격 프로젝트
`oprn-hill-forest-harmony-20260918-a4e1`의 칩셋 스냅샷이다.
이미지 `public/assets/forest-harmony/chipset.png` (480×1360), 정의
`src/assets/forestHarmonyTileset.json` (16px, 30열, 2550칸)를 함께 유지한다.
`bundled.ts`가 텍스처와 프레임 수를 등록하고 `defaultAssets.ts`가 복제된
통행/레이어/오토타일/조립 정의를 생성한다. 새 프로젝트에 포함되며 기존 프로젝트는
`ensureBundledTilesets` 정규화로 열 때 추가된다. 기존 맵의 타일셋은 바꾸지 않는다.
원본 프로젝트에 기본 정의와 리소스 프로필을 저장하고 Supabase 재로드를 확인했다.
신규/기존 등록, 반복 로딩 정의 유지, PNG 크기/칸 수 일치를 직접 확인했다.

숲마을 번들의 마지막 행 여백 26칸도 `count=2550`에 포함된다. 통행·레이어·지형 배열이
2524칸으로 끝나면 SQLite 저장 검증에서 프로젝트 전체가 거절된다. 여백은 통행 불가,
`lower`, 지형 0으로 채워 세 배열을 2550칸에 맞춘다(2026-09-18 운영 웹 생성 실패 수정).
숲 조립 그룹 9개의 누락된 필수 `placementRules`는 빈 문자열로 명시한다. 규칙이 없는 상태를
유지하면서 문서 저장 검증을 통과시킨다. 길이 검사 뒤 이 필수 필드 검사도 적용된다.

숲 기본 정의의 label/description 누락과 마지막 빈 26칸 설정 누락으로 타일 탭에서
`undefined.trim()` 예외가 재현됐다. 번들 정의의 모든 필드를 채우고
`tilesetMetadataControls`에서 기존 부분 메타데이터를 읽을 때 빈 문자열로 보완한다.
브라우저에서 자료집 → 타일 → 숲마을 선택을 재현, 수정 후 2550칸 표시와 pageerror 0건 확인.

원본 지형 결 복원: 기본 forest_harmony의 504·505·558~560·588~590 칸은
retro-world 원본의 -480 인덱스에서 16×16 그대로 복사한다. 팔레트 키
RGB(224,103,191)만 투명 처리하며 리사이즈/감색/재질 합성을 하지 않는다.
기존 번호와 통행/오토타일 정의를 유지한다. 자료집 타일 화면에서 확인한다.

## 성채 공통 기본 제공 타일셋 (2026-09-19)

`opengameart_castle` / `tex_opengameart_castle`, 표시명 `성채 · OpenGameArt (CC-BY 3.0)`.
사용자 지정 범위는 **모든 프로젝트의 선택 목록에 추가**다. 시작 맵이나 기본 선택
`DEFAULT_TILESET_ID`는 바꾸지 않는다. `defaultTilesets`가 신규 프로젝트에 제공하고,
기존 프로젝트는 `ensureBundledTilesets` / `ensureBundledResourceProfiles`로 추가된다.
이미 존재하는 정의의 사용자 설정은 교체하지 않는다.

- 원본: https://opengameart.org/content/castle-tiles-for-rpgs 의 `Castle2_5.png`.
  `public/assets/opengameart-castle-tiles.png`는 512×512 원본을 수정 없이 보존한다.
  저작자 Zabin / Hyptosis / Daniel Cook, CC BY 3.0. 해시·출처는 `ATTRIBUTION.md`.
  게임 내보내기는 PNG와 `opengameart-castle-tiles-CREDITS.txt`를 함께 수집한다.
- 원본 그림은 32px이지만 엔진 맵 좌표는 16px이다. 그림을 축소하지 않고
  **16px · 32열 · 1024칸**의 `kind: custom`으로 등록한다. 원본 한 타일은 2×2칸이다.
  성채 팔레트는 가로 스크롤 가능한 원본 배열을 유지해 드래그 조합 선택을 지원한다.
- 정의: `src/project/defaults/castleTileset.ts`. 알파 표는 원본의 16px 셀을 실측한
  E(빈칸)/T(부분 투명)/O(불투명) 표다. 잔디는 하위·통행 가능, 물/물가는 하위·막힘,
  건축과 소품은 상위·막힘, 빈칸은 상위·통행 가능이라는 보수적 초기 설정이다.
  이는 저작자가 수정할 기본값이며, 사람의 승인(`origin: user`)으로 표시하지 않는다.
  이 시트에는 RM2K 오토타일/물 애니메이션이나 자동 맵 생성 프로필을 적용하지 않는다.
- `bundledChipsetGeometry.ts`가 원본 열 수를 프레임 등록·리소스 프로필·그래픽 선택·타일
  이식에 공유한다. 색 키/이식으로 키가 달라진 텍스처는 `tilesetImage.ts`에서 명시적으로
  격자를 전달한다. `combinedTown.ts`의 기존 숫자 기반 투명 타일 보정도 이 시트는 건너뛴다.
- 회귀 계약: `test/castleTileset.test.ts`의 기존 프로젝트 추가/설정 유지, 32열 프레임
  경계와 마지막 칸, 내보내기 출처 동봉. 세션 규칙에 따라 테스트 실행은 사용자가 요청할 때 한다.
  브라우저 증거: `.omo/evidence/castle-tiles/NOTES.md`와 같은 폴더의 PNG/관측 JSON.

### 참고 이미지 보드와 성채 공간 카탈로그 (2026-09-19)

사용자가 제공한 2239×2235 성채·강변 합성 이미지는 `public/assets/opengameart-castle-reference-composite.png`에
오른쪽 1px·아래쪽 5px을 패딩한 2240×2240 RGB 보드로 보존한다. `opengameart_castle_reference` /
`tex_opengameart_castle_reference`는 16px · 140열 · 19,600칸이며, 보드 맵
`map_castle_reference_95_20260919`(140×140)의 하위 타일이 0부터 순서대로 채워진다. 따라서 맵을
다시 그리면 원본 참고 이미지와 같은 픽셀 배열이 된다. 이 보드는 시각 비교용이고, 실제 편집은
`opengameart_castle` 원본 타일셋을 사용한다. 내보내기에는 보드 PNG와
`opengameart-castle-reference-composite-CREDITS.txt`가 함께 들어간다.

비교 맵 `map_castle_reference_20260919`도 같은 원본 보드를 사용하며, 4×4 총 16구역의
`comparisonGrid`를 저장한다. 원본 타일셋으로 계속 편집할 수 있는 80×64 맵은
`map_castle_editable_20260919`에 보존한다. `scripts/compare-castle-reference.py`로
비교 보드를 같은 참고 이미지와 비교하면 당연히 1.000000을 기록한다. 이는 원본 타일을
올바르게 조립했다는 증거가 아니다. 실제 원본 타일 조립은 `map_castle_keep_3`의
쌍문 안뜰성에서 확인한다. 측정한 완성형 부품 좌표와 과거 오인 목록은 `castle-map.md`에 있다.

같은 원본을 재사용할 수 있도록 원격 프로젝트 `rpg-zzu-house-template-gallery`의
`spatialAuthoring.library`에 성문·지붕·성벽·망루·돌다리·폭포와 시장 가판대·경작지·나무·석상·선착장·나룻배
오브젝트 12종, 바깥뜰·선착장·농경지 공간, 성채·강변·시장·농경지·선착장 장소,
`castle-reference:region:river-castle` 지역, `castle-reference:world:kingdom` 세계를 등록했다. 저장은 `publish_spatial_project` 후
`sync_spatial_mirrors`를 거쳤고, 프로젝트를 다시 읽어 맵·타일셋·카탈로그 레코드를 확인했다.

카탈로그의 이전 `confidence: high` 표시는 실측 검증이 아니었다. 208=물가, 188=시계나무 조각,
215/216=벤치, 233=상자이며 기존 농경지·선착장·나룻배 명칭을 그대로 사용하지 않는다.
2026-09-21 마을 생성 기본값: `author_village`의 새 맵 및 기존 기본 칩셋의 빈 전체 맵은
`forest_harmony`를 선택한다. `treeKitForTileset`이 저장된 나무 조립의 `previewMap`을 읽고,
물은 `forest_harmony_lake_47` 정의를 쓴다. 집·길의 합본 호환 판정과 나무/물 조립 선택은
별개다. 기존 콘텐츠·선택 영역·명시적으로 다른 칩셋을 선택한 맵의 타일셋은 보존한다.
자세한 경로·울타리 정책은 [마을 배치 연구](village-layout-research.md)를 따른다.

## LPC 나무 가구 공통 기본 제공 타일셋 (2026-09-21)

`opengameart_lpc_wooden_furniture` / `tex_opengameart_lpc_wooden_furniture`,
표시명 `LPC 나무 가구 · OpenGameArt (CC-BY-SA 3.0)`. 성채 칩셋과 마찬가지로
**모든 프로젝트의 선택 목록에 추가**이며 기본 선택은 바꾸지 않는다.

- 원본: https://opengameart.org/content/lpc-wooden-furniture — 저자 bluecarrot16,
  Basto, Sharm, William Thompson, Reemax, Janna/Lilius/Jannax. 라이선스는
  CC-BY-SA 3.0 / GPL 3.0 (구성 요소별 상위 라이선스는 원본 크레딧 파일 참고).
  `public/assets/opengameart-lpc-wooden-furniture.png`은 페이지의 투명 배경 변형
  `clean_furniture.png`(512×1024)를 수정 없이 보존한다. 가군 배경 미리보기 변형은
  묶지 않는다. 해시·출처·수정 없음 표기는 `ATTRIBUTION.md`.
  게임 내보내기는 PNG와 `opengameart-lpc-wooden-furniture-CREDITS.txt`를 함께 수집한다.
- LPC 표준 32×32px 시트다(16열 × 32행 = 512칸). 격자는 실측으로 확정했다: 침실 벽장
  타일은 LPC 관습대로 32px 셀 하단에 그려지고, 주방 캐비닛·오븐·유리장은 32px 경계에서
  정확히 잘린다. 에지 에너지·거터 분석은 격자 판별에 쓰지 않는다(가구 너비가 16/32 섞여
  결과가 뒤집힌다). 원본 한 타일이 곧 엔진 한 칸이므로 32px · 16열 ·
  `kind: "custom"` 으로 등록하고 16px RM2K 오토타일/물 애니 스트립은 등록하지 않는다.
- 통행/레이어 초기값은 Slates 32px와 같은 계약(전부 통행 가능·하위, 메타 unknown)이다.
  성채의 알파 E/T/O 표 방식으로 통행을 추정해 막지 않는다 — 가구 시트는 부분 투명
  오브젝트가 대부분이라 알파 추정의 오답률이 더 높다. 칸 단위 조정은 타일 메타데이터
  도구의 몫이다. `applyCustomChipsetMinimalHarness`는 이 시트를 건너뛴다(합본 마을
  16px 투명 칩 표가 무관한 번호를 재해석하지 않게).
- 정의: `src/project/defaults/lpcWoodenFurniture.ts`. 프레임 등록·리소스 프로필·자료
  보관함 기하는 `bundledChipsetGeometry.ts`가 공유한다.

### 공용 오브젝트 (2026-09-22)

이 시트의 가구 39종은 **모든 프로젝트의 자료집 → 맵 → 오브젝트 → 공용 오브젝트**에
나온다. Tibo 실내 확장과 같은 경로다 — 타일셋 `structureKits` 로 굽고, 자료집이 그 킷을
공용으로 판정한다.

- 정본: `src/project/defaults/lpcWoodenFurnitureObjects.ts` (39종, 좌표는 셀 격자).
  굽기·시드는 `lpcWoodenFurniture.ts` 의 `lpcFurnitureKits` / `seedLpcWoodenFurnitureKits`,
  기존 프로젝트 반영은 `ensureBundledTilesets`(로드 경로)가 맡는다.
- 시드 계약: **킷이 하나라도 있으면 손대지 않는다.** 사람이 지운 상태를 되살리지 않기
  위해서다(Tibo `extendTiboInteriorDefaults` 와 같은 보수 규칙).
- 공용 판정: `spatialCatalog.isBundledFurniturePackKit` 이 타일셋 신원 + id 접두사로
  가른다(`lpc_*` · `tibo-*`). 저작자가 복제해 만든 `kit_*` 는 내 오브젝트로 남는다.
- 레이어: 이 시트 가구는 전부 **상위 레이어 실루엣**이다. 하위로 깔면 발밑 바닥을 덮어
  맵이 걸어다닐 수 없게 된다. 통행 판정은 셀 메타(`role: prop`)가 막는다.
- 좌표는 **자동 분할로 뽑지 않았다.** 연결 요소·최대 사각형은 인접 가구가 붙어 있어
  뭉치거나 잘린다(실측: 102개 컴포넌트가 여러 가구를 한 덩어리로 묶었다). 셀 번호판을
  얹은 확대도로 하나씩 확정하고, 확정 좌표를 실제 타일로 렌더한 연락처 시트로 검증했다.
  특히 침대는 2×1(머리판 줄) · 1×2(세로형) · 2×3(캐노피)로 제각각이고, 오르간은
  `c5 r26 3×3`, 그랜드 피아노는 `c0 r26 2×3` 이다.
- 복제 경로 폴백: `copyBuiltin` 과 `copyBuiltinObjectIntoProject` 는 원래
  `interiorObjectById` · `tiboInteriorObjectById` 만 봤다. LPC 킷은 그 둘에 없어서
  "내 오브젝트로 복제" 가 조용히 아무 일도 하지 않았다 — `lpcFurnitureObjectById` 폴백을
  추가했다. 새 번들 가구 팩을 넣을 때 같은 폴백을 빠뜨리면 같은 증상이 난다.

### 16px 병행판 (2026-09-22)

`opengameart_lpc_wooden_furniture_16` / `tex_opengameart_lpc_wooden_furniture_16`,
표시명 `LPC 나무 가구 16px · OpenGameArt (CC-BY-SA 3.0)`. 32px 판과 **같은 킷 id 39종**을
쓴다 — 자료집 카드·복제·배치가 두 판을 같은 물건으로 보고, 사용자는 맵 타일셋만 바꿔
같은 가구를 고른다. 좌표도 같다(축소본은 정확히 절반, 16열 유지).

- 왜 병행하는가: 32px 판은 자기 타일셋 맵에서만 쓸 수 있고 기존 16px 맵(합본 마을·실내)에는
  격자가 맞지 않아 찍을 수 없다(`atlasMismatch`). 16px 판이 그 제약을 없앤다.
- 파일: `public/assets/opengameart-lpc-wooden-furniture-16px.png`(256×512). 원본 32px 판은
  **손대지 않고 보존**한다 — 축소본이 원본을 대체하지 않는다. 해시·수정 표기는 `ATTRIBUTION.md`.
- 생성: unfake.js(unfake-core WASM) median 블록 다운스케일. **다운스케일 단계만 쓴다.**
  morph(구멍 메우기)와 양자화는 이 시트에 해로웠다 — 얇은 손잡이·칸막이를 노이즈로 보고
  지운다(실측: 긴 탁자 다리 소실, 선반 칸막이 뭉개짐). unfake 는 AI 생성물의 "가짜 픽셀"을
  되돌리는 도구인데 이 시트는 진짜 픽셀아트라 되돌릴 것이 없다. `detect_auto` 가 15 를
  돌려준 것도 같은 이유다(실제 격자는 1).
- 정의: `createLpcWoodenFurniture16Tileset` · `seedLpcWoodenFurniture16Kits`.
  기존 프로젝트 반영은 `ensureBundledTilesets`. 시드 계약은 32px 판과 같다(킷이 있으면 불변).
