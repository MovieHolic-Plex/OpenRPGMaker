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
| `opaqueFloor` | 하위 | 없음 | 잔디 240, 물 120, 직선 지붕면 404 | 불투명하므로 아래를 비출 일이 없다 |
| `transparentOverlay` | 상위 | 없음 | 벤치 357, 사선 지붕 385, 텐트 448 | 상위에서 하위 지면을 **보존**해야 한다. 하위에 깔면 투명 픽셀 아래가 검다 |
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
