---
name: verify
description: rpg-zzu 변경을 실제 에디터/플레이 화면에서 관찰 검증하는 레시피 (Playwright 드라이브)
---

# rpg-zzu 검증 레시피

웹 에디터(Vite) + Phaser 런타임. 검증은 Playwright로 실제 화면을 구동해 스크린샷으로 관찰한다.

## 구동

- `npx playwright test <spec>` — playwright.config.ts의 webServer가 dev 서버(127.0.0.1:9173)를 자동 기동/재사용한다. 별도 `npm run dev` 불필요.
- 임시 드라이브 스펙은 `test/e2e/`에 만들어야 실행된다(testDir 고정). 검증 후 삭제.
- 스크린샷 evidence는 스크래치패드 절대경로로 저장.

## 필수 보일러플레이트 (없으면 UI가 안 보임)

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});
```
- `mode-play`, 타일 툴바(`structure-stamp-menu` 등)는 전문가 모드에서만 노출된다.

## 프로젝트 주입

```ts
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed"; // test/e2e/
const context: ToolContext = { project: createEmptyToolProject("이름") };
runTool(context, "build_village", { seed: 7 }); // 마을+집 내부 맵 생성
await seedProjectFromSupabaseCanonical(page, context.project);
```

## 플레이 모드 드라이브

- `page.getByTestId("mode-play").click()` → `startNewGameFromTitle(page)` (test/e2e/runtimeInput.ts)
- 상태 확인: `page.getByTestId("runtime-state-json")`의 JSON(mapId, player, inputEnabled)을 poll.
- 이동/조작: `tapKey(page, "ArrowUp", 90)`, `tapKey(page, "Space", 30)`.

## 에디터 드라이브

- 맵 전환: `map-tree-node-<mapId>` 클릭.
- 맵 편집 락 배너가 뜨면(다른 탭 편집 중) `map-lock-banner-takeover` 클릭 후 진행 — 안 하면 클릭 편집이 조용히 무시된다.
- 툴바 드롭다운 토글은 상태 유지형: Escape로 안 닫힘. 항목이 보이면 그대로 클릭, 안 보이면 토글 버튼 클릭(최대 2회).
- 캔버스: `page.getByTestId("edit-canvas").locator("canvas")`. 클릭 위치→타일 매핑에 오프셋 오차가 있으니, 적용 여부는 클릭 전/후 `canvas.screenshot()` 버퍼 비교 + 스크린샷 육안 확인으로.

## 함정

- 클린 HEAD에서도 ~28개 테스트+typecheck 실패(전투/DB 등) — 관련 없는 실패에 흔들리지 말 것.
- test/houseKit.test.ts "하네싱" summary 단언은 HEAD에서 이미 깨져 있음(소스는 "집 키트 규칙 적용 완료" 생성).
- 스크린샷 판독이 애매하면 PowerShell System.Drawing으로 크롭+NearestNeighbor 업스케일해서 타일 단위로 읽기.
