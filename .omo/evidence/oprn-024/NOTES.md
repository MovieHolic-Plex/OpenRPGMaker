# OPRN-OUT-024 — 공통 지연 툴팁 (증거)

워크트리 `/home/main/z-project/rpg-zzu-oprn024` · 브랜치 `agent/oprn024`.

| 수용 기준 | 상태 | 근거 |
|---|---|---|
| 문서화된 공유 지연 툴팁 컴포넌트/동작 제공 | 충족 | `src/editor/delayedTooltip.ts` + `openwiki/delayed-tooltip.md` |
| 무차별 적용이 아니라 명시 롤아웃 목록 | 충족 | `DELAYED_TOOLTIP_ROLLOUT` 14개 항목, 설치기는 목록의 testid 만 조회 |
| 1~2초 지연 후 표시, 정의된 조건에서 사라짐 | 충족 | `TOOLTIP_DELAY_MS=1200`; 테스트 "호버 직후에는 뜨지 않고 지연이 지나야 뜬다", "지연이 끝나기 전에 포인터가 떠나면 뜨지 않는다" |
| 키보드 초점으로 같은 라벨, Escape 로 컨트롤 실행 없이 닫힘 | 충족 | 테스트 "키보드 초점은 같은 라벨을 즉시 보여 준다", "Escape 는 툴팁만 닫고 컨트롤을 실행하지 않는다"(click 카운트 0) |
| 대상을 덮지 않고 네 변 안에 머무름 | 충족 | 순수 함수 `computeTooltipPlacement` + 6건의 배치 테스트(아래/위 뒤집기/좌/우/상/좁은 화면) |
| 클릭 가로채기·레이아웃 밀림·리렌더 후 잔존 없음 | 충족 | CSS `pointer-events: none`, `position: fixed`(문서 흐름 밖), 테스트 "패널이 다시 렌더돼 대상이 떨어지면 툴팁이 유령으로 남지 않는다" |
| 한국어 시각 라벨 6자 이하 지향, 뜻은 안 자름 | 충족 | 테스트가 롤아웃 전 항목의 label ≤ 6자와 name ≥ label 을 강제 |
| 모든 대상이 완전한 접근 가능한 이름 유지 | 충족 | `accessibleName` → `aria-label`; 테스트 "완전한 접근 가능한 이름은 짧은 시각 라벨과 별개로 남는다" |
| 지연·조기 이탈·키보드 초점·Escape·리렌더 정리·뷰포트 가장자리 테스트 | 충족 | `test/delayedTooltip.test.ts` 16건 |

기존 계약 보존: `title` 을 지우지 않고 호버 중에만 임시 제거·복원한다
(테스트 "title 은 평소에 살아 있고 호버 동안만 떼어 둔다"). 이로써
`test/e2e/oprn-editor-fidelity-shell.spec.ts`(toolbar-save)와
`test/e2e/ai-new-chat-docks.spec.ts`(ai-new-chat)의 title 단언이 깨지지 않는다.

## 실행한 검증

```
npm run typecheck:app                                                    → exit 0
npx vitest run test/delayedTooltip.test.ts --maxWorkers=2                → 16 passed
npx vitest run test/delayedTooltip.test.ts test/uxcEditorShell.test.ts \
  test/basicLeftRail.test.ts test/tilesetSectionTabs.test.ts --maxWorkers=2 → 58 passed
```

## 남은 일

- 브라우저 스크린샷 증거(verify-shots/oprn-024/)는 감독자 통합 단계의 e2e 실행에서 채운다.
  단위 테스트는 fakeDom 이라 실제 렌더 좌표를 찍지 않는다.
