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
| `test/tileLayerPolicy.test.ts` | 다섯 부류 판정, 사용자 override, 자동 복귀, 검토 목록 비변형 |
| `test/tileLayerPolicyEditorSurface.test.ts` | 규칙 탭의 정책 근거·다중 조각 표시, 받침 버튼, 검토 목록 적용 |
| `test/tileLayerPolicyClusterRegression.test.ts` | 레이어/받침 선택 대비 하드클러스터 거부 행렬, 통행 불변 |
| `test/forestTrunkLayers.test.ts`, `test/transparentTileLayerRouting.test.ts` | 기존 밑동 하위·투명 상위 계약 회귀 |

## 아직 결정이 필요한 것 (제품 소유자)

- 내보낸 플레이(export player)에서 받침 합성을 별도로 검증하는 QA 시나리오 추가 여부.
- 커스텀 칩셋의 투명 여부를 픽셀 스캔으로 자동 감지할지(현재는 명시 메타 `투명` 태그만 신뢰).
