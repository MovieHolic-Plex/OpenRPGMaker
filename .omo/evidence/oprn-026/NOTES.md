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

## 남은 일 / 이관

- 내보내기 플레이어 화면에서 받침 합성 스크린샷 QA(`npm run qa:runtime`) 는 감독자 통합 단계에서.
- 커스텀 칩셋 투명 픽셀 자동 감지 여부는 제품 소유자 결정 대기.
