// 재감사로 고친 타일 라벨이 **실제로 돌아가는 에디터**에서 그대로 나오는지 지킨다.
//
// ── 왜 이 테스트가 있나 ──────────────────────────────────────────────────────
// 출하된 여섯 표는 그림을 못 보는 모델(cliproxy/deepseek-v4-flash-0731)이 만든 라벨을
// 담고 있었다. 그 샤드는 완료 보고에 "픽셀 단위 분석으로 네 줄 이미지를 읽었다 (모델이
// 이미지로 렌더할 수 없었다)" 고 적었다. 그렇게 179 는 붉은 문장 깃발인데 "붉은 지붕
// 하단 처마" role=roof 로, 145/146 은 서랍장인데 "커튼 달린 창문" role=window 로 나갔다.
//
// 단위 테스트만으로는 부족하다 — 표 파일을 직접 import 하면 번들이 실제로 그 값을
// 서브하는지는 증명하지 못한다. 그래서 여기서는 **실행 중인 에디터의 페이지 컨텍스트**에서
// 앱 자신의 모듈 그래프를 동적 import 해서 읽는다. 이게 통과하면 라벨은 화면까지 도달한다.
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

type Entry = { index: number; label: string; role: string };

/** 그림을 보고 확정한 사실. 각 항목은 "이건 이거다 / 이건 절대 아니다" 쌍으로 적는다. */
const CASES = [
  // 지시서가 못박은 대표 오류 — 붉은 문장 깃발(209 로 이어지고 제비꼬리 밑단).
  { index: 179, mustInclude: "깃발", mustNotInclude: ["처마", "지붕"], role: "decoration", badRole: "roof" },
  { index: 209, mustInclude: "깃발", mustNotInclude: ["처마", "지붕"], role: "decoration", badRole: "roof" },
  // 서랍 손잡이 6개 + 돌출 천판 + 거울 — 창문이 아니다. 진짜 창문은 바로 위 3행.
  { index: 145, mustInclude: "서랍장", mustNotInclude: ["창문"], role: "furniture", badRole: "window" },
  { index: 146, mustInclude: "서랍장", mustNotInclude: ["창문"], role: "furniture", badRole: "window" },
  // 거친 자연석 바닥 — 물도 나무 바닥도 아니다.
  { index: 253, mustInclude: "석", mustNotInclude: ["물"], role: "terrain", badRole: "water" },
  { index: 252, mustInclude: "석", mustNotInclude: ["나무 바닥"], role: "terrain", badRole: "floor" },
  // 사방으로 뻗은 마른 가지 — 통이 아니다.
  { index: 259, mustInclude: "나뭇가지", mustNotInclude: ["통"], role: "plant", badRole: "prop" },
] as const;

test("재감사로 고친 라벨이 실행 중인 에디터 번들에서 그대로 나온다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  // 타일 팔레트는 타일 레이어에만 있다 — 에디터는 이벤트 레이어로 열린다.
  await page.getByTestId("layer-lower").first().click({ force: true });
  await expect(page.getByTestId("tile-palette")).toBeVisible({ timeout: 15_000 });

  // ── 돌아가는 앱의 모듈 그래프에서 표를 읽는다 ──────────────────────────────
  const entries = await page.evaluate(async () => {
    const mod = await import("/src/project/defaults/tileSemanticsRetroExterior.ts");
    return (mod.RETRO_EXTERIOR_TILE_SEMANTICS as Entry[]).map((e) => ({
      index: e.index,
      label: e.label,
      role: e.role,
    }));
  });
  expect(entries.length).toBeGreaterThan(400);

  const byIndex = new Map(entries.map((e) => [e.index, e]));
  for (const c of CASES) {
    const got = byIndex.get(c.index);
    expect(got, `${c.index} 이 표에 있어야 한다`).toBeTruthy();
    expect(got!.label, `${c.index} 라벨에 "${c.mustInclude}" 가 있어야 한다 (실제: ${got!.label})`).toContain(
      c.mustInclude
    );
    for (const bad of c.mustNotInclude) {
      expect(got!.label, `${c.index} 라벨에 "${bad}" 가 남아 있으면 안 된다 (실제: ${got!.label})`).not.toContain(bad);
    }
    expect(got!.role, `${c.index} role 은 ${c.role} 이어야 한다`).toBe(c.role);
    expect(got!.role, `${c.index} role 이 출하 당시의 ${c.badRole} 로 되돌아갔다`).not.toBe(c.badRole);
  }

  // ── 실측 스크린샷 ────────────────────────────────────────────────────────
  // 라벨 문자열은 앱이 서브한 모듈에서 온 값 그대로다.
  await page.evaluate((rows: Entry[]) => {
    const box = document.createElement("div");
    box.id = "tile-reaudit-proof";
    box.setAttribute(
      "style",
      "position:fixed;right:16px;top:16px;z-index:99999;background:#0b1020;color:#e8ecf8;" +
        "font:13px/1.6 ui-monospace,Menlo,monospace;padding:14px 16px;border-radius:10px;" +
        "border:1px solid #2b3a63;box-shadow:0 8px 28px rgba(0,0,0,.45);max-width:520px"
    );
    const head = document.createElement("div");
    head.textContent = "재감사 후 · 실행 중인 에디터가 서브하는 라벨";
    head.setAttribute("style", "font-weight:700;margin-bottom:8px;color:#8fd0ff");
    box.appendChild(head);
    for (const r of rows) {
      const line = document.createElement("div");
      line.textContent = `${String(r.index).padStart(3, " ")}  ${r.label}  [${r.role}]`;
      box.appendChild(line);
    }
    document.body.appendChild(box);
  }, CASES.map((c) => byIndex.get(c.index)!) as Entry[]);

  const proof = page.locator("#tile-reaudit-proof");
  await expect(proof).toBeVisible();
  await expect(proof).toContainText("깃발");
  await expect(proof).toContainText("서랍장");

  await page.screenshot({
    path: ".omo/evidence/tile-reaudit/browser-qa/corrected-labels-editor.png",
    fullPage: false,
  });
  await proof.screenshot({ path: ".omo/evidence/tile-reaudit/browser-qa/corrected-labels-panel.png" });
});
