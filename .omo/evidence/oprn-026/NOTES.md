# OPRN-OUT-026 — 투명 오브젝트 레이어 정책 검토 (증거)

작업 워크트리: `/home/main/z-project/rpg-zzu-oprn026` · 브랜치 `agent/oprn026`
범위 경계 준수: 내장 나무 밑동 기본 분류를 바꾸지 않았고, 하드클러스터 검증을 제거하지 않았고,
렌더러 재작성이나 가져온 커스텀 칩셋 메타의 자동 변형을 하지 않았다.

## 수용 기준별 상태

| 기준 | 상태 | 근거 |
|---|---|---|
| 투명 타일이 상위/받침 있는 하위/의도적 투명 하위/다중 조각 제약 중 무엇인지, 왜 그런지 문서화 | 충족 | `openwiki/tile-layer-policy.md` 다섯 부류 표 + `src/editor/tileLayerPolicy.ts` `tileLayerPolicy()` 의 부류·근거 반환 |
| 커스텀 칩셋 준비가 배경 없는 하위 타일을 자동·되돌릴 수 없이 상위로 올리지 않고 검토로 노출 | 충족 | `backgroundlessLowerReviews()` 는 비변형(테스트 "목록을 만드는 것만으로는 타일셋이 바뀌지 않는다"), 편집기 `tileset-rule-review` 목록 |
| 사용자가 홈 레이어와 받침 정책을 보고 덮어쓸 수 있다 | 충족 | 규칙 탭 `tileset-rule-backing`(자동/없음/잔디 받침), 검토 항목 4선택지, `test/tileLayerPolicyEditorSurface.test.ts` 6건 |
| 290~293 을 단일 나무·겹친 숲에서 평가(하위 밑동 + 상위 수관 공존 포함) | 충족 | `test/tileLayerPolicyClusterRegression.test.ts` "빈 공간 배치는 밑동 하위 + 수관 상위로 확장된다", 기존 `test/forestTrunkLayers.test.ts` dense/impassable 2건 통과 |
| 편집기 미리보기·런타임 렌더링·통행·되돌리기가 모든 레이어/받침 선택에서 일치 | 부분 충족 | 두 렌더러가 하드코딩 대신 공유 `tileBackingTile()` 을 쓰도록 통일(`chipsetTileRender.ts`, `playSceneMapRuntime.ts`), 통행 불변 테스트 통과. 내보낸 플레이(export player) 화면 QA 는 미실시 — 정책 문서의 "제품 소유자 결정 필요"에 기록 |
| 불투명 바닥·일반 투명 소품·받침 있는 하위 합성·의도적 투명 하위·다중 조각 테스트 | 충족 | `test/tileLayerPolicy.test.ts` 11건 |
| 레이어 선택이 017 의 경계·보호 셀·점유 거부를 바꾸는지 회귀 테스트로 판정 | 충족 | `test/tileLayerPolicyClusterRegression.test.ts` — 받침 변경·상위 확정 모두 네 경우의 거부 결과 불변 |
| 재현 없이 017 과 같은 원인이라고 주장하지 않는다 | 충족 | 위 회귀 결과로 "레이어 분류는 017 원인이 아니다"라고 기록(`openwiki/tile-layer-policy.md`) |

## 실행한 검증 (모두 이 워크트리)

```
npm run typecheck:app                      → exit 0 (출력 없음)
npx vitest run test/tileLayerPolicy.test.ts --maxWorkers=2                     → 11 passed
npx vitest run test/tileLayerPolicyClusterRegression.test.ts --maxWorkers=2    → 6 passed
npx vitest run test/tileLayerPolicyEditorSurface.test.ts --maxWorkers=2        → 6 passed
npx vitest run test/tilesetSectionTabs.test.ts test/forestTrunkLayers.test.ts \
  test/transparentTileLayerRouting.test.ts test/tileLayerClassification.test.ts \
  test/layerRouting.m1.test.ts test/playSceneTileCulling.test.ts --maxWorkers=2 → 63 passed
```

## 브라우저 증거 (2026-09-10, 워크트리 `/home/main/z-project/rpg-zzu-uievidence` · 브랜치 `agent/uievidence`)

`scripts/qa/tile-layer-backing-policy.mjs` → `verify-shots/oprn-026/` · **6/6 PASS · 페이지 오류 0건**.
실제 Chromium, `http://127.0.0.1:9865/?blankProject=1` → 데이터베이스 → 맵/타일 →
합본 마을 칩셋 → 「통행·지형」 탭. 1440x900. 단언 실패 시 exit 1.
고정 sleep 없음 — 앱이 내보내는 `project-export-json` 미러가 갱신될 때까지 기다린다.
LegacyDb 에 아무것도 쓰지 않았다: 앱의 「임시 세션」 배너(`save-skip-banner`)로 확인했다.

| 장면 | 무엇을 실측했나 | PNG |
|---|---|---|
| 01 trunk-policy | 밑동 290 선택 → 부류 「받침 있는 하위」 + 근거 + 다중 조각 제약(수관 260~263 전부 명시) | `01-trunk-policy.png` |
| 02 backing-auto | 받침 기본 「자동」 = 잔디 240 합성, 경고 없음, 검토 목록 없음 | `02-backing-auto.png` |
| 03 backing-none-warning | 「없음」 → 부류가 「투명 하위(받침 없음)」로 뒤집히고 **그때** 경고가 뜬다. 형제 밑동 291 은 받침 240 그대로 | `03-backing-none-warning.png` |
| 04 review-appears | 그 타일이 생긴 뒤에야 「배경 없는 하위 타일 검토 (1)」 목록 등장, 항목은 290 하나 · 선택지 4개 | `04-review-appears.png` |
| 05 backing-grass | 「잔디 받침」 → 경고와 검토 목록이 함께 사라진다 | `05-backing-grass.png` |
| 06 review-overlay-one | 검토 항목 「상위 오버레이」는 290 만 상위(`transparentOverlay`)로 옮기고 291·292·293 의 홈 레이어·받침은 불변 | `06-review-overlay-one-before.png`, `06-review-overlay-one.png` |

환경 소음 필터: Vite HMR 웹소켓 실패(GET 중계가 웹소켓을 프록시하지 못한다)와
`?blankProject=1` 의 의도적 자동저장 비활성 알림만 걸렀다. 그 밖의 오류는 실패로 센다.

## 촬영이 드러낸 결함 (같은 변경에서 수정 + 회귀 테스트)

받침을 「없음」으로 확정하면 부류는 「투명 하위(받침 없음)」로 바뀌는데, 근거 문장만
"받침 타일로 투명 픽셀을 채웁니다" 로 굳어 있었다. 즉 규칙 탭이 바로 위 경고
(「받침 없이 하위에 깔면 투명 부분이 검게 보일 수 있습니다」)와 정면으로 모순되는 설명을
같은 화면에 띄웠고, 그 문장은 검토 목록 항목에도 그대로 복사된다.
고침: `src/editor/tileLayerPolicy.ts` 의 `trunkReason()` 이 실제 받침 결과를 말한다.
회귀: `test/tileLayerPolicy.test.ts` 2건 — 「받침을 없음으로 확정한 밑동의 근거는 받침이
채운다고 말하지 않는다」 / 「받침이 살아 있는 밑동의 근거는 여전히 받침 합성을 설명한다」.

음성 대조: `tileLayerPolicy.ts` 를 되돌리면 03 만 FAIL + exit 1
(「reason must not contradict the warning right above it」).

## 실행한 검증 (브라우저 증거 단계)

```
npm run typecheck:app                                                          → exit 0
npx vitest run test/tileLayerPolicy.test.ts test/tileLayerPolicyEditorSurface.test.ts \
  test/tileLayerPolicyClusterRegression.test.ts test/forestTrunkLayers.test.ts \
  test/transparentTileLayerRouting.test.ts test/tileLayerClassification.test.ts  → 46 passed
TILE_POLICY_QA_URL=http://127.0.0.1:9865 node scripts/qa/tile-layer-backing-policy.mjs → 6/6 PASS, exit 0
```

## 남은 일 / 이관

- 내보내기 플레이어 화면에서 받침 합성 스크린샷 QA(`npm run qa:runtime`) 는 감독자 통합 단계에서.
  이 촬영은 **편집기 규칙 탭** 표면만 덮는다 — 출하 플레이어의 받침 합성은 별개 시나리오다.
- 커스텀 칩셋 투명 픽셀 자동 감지 여부는 제품 소유자 결정 대기.
