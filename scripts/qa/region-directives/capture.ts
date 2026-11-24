// 영역 지시 레시피를 실제 편집기에서 찍는다 — 캔버스 영역 → 지시(「여기 상점 만들어 줘」) → 맵 위 결과 카드 → 새 실내 맵 → 테스트 플레이로 문 드나들기.
// 조수 응답은 대본(scripted transport)이다: /v1/agent/run 요청이 오면 편집기가 보낸 프로젝트에 build_region_place 를 그대로 돌려
// 그 결과를 done 으로 돌려준다(assistant-capability matrix-live 와 같은 방식). 모델 판단은 이 캡처의 축이 아니다.
//
// 실행: bun scripts/qa/region-directives/capture.ts <출력 폴더> <kind> [지시 문장]
//   빌드가 있어야 한다(dist/ · dist-electron/browser-bridge.js) — openwiki/harnesses/assistant-capability.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { firefox } from "playwright";
import { initLocalProjectStore } from "../../../electron/local-store/store";
import { createCapabilityFixtureProject } from "../../../src/harnesses/assistant-capability/node/capabilityFixture";
import { startHost, newEditor } from "../../../src/harnesses/assistant-capability/node/editorDriver.mjs";
import { runTool } from "../../../src/editor/tools/toolRunner";
import type { Project } from "../../../src/project/types";

const REGION = { x: 14, y: 8, width: 13, height: 12 };

async function prepare(root: string): Promise<{ projectDir: string; mapId: string }> {
  const projectDir = resolve(root, "project");
  mkdirSync(projectDir, { recursive: true });
  const project = createCapabilityFixtureProject();
  const ctx = { project, currentMapId: "", assistantRun: false };
  const made = runTool(ctx, "create_map", { name: "버들 마을", width: 40, height: 30, tilesetId: "beodeul_city" });
  const mapId = (made.data as { mapId: string }).mapId;
  const ready = ctx.project;
  ready.meta.title = "영역 지시 레시피";
  if (ready.system.opening) ready.system.opening.enabled = false;
  ready.startMapId = mapId;
  ready.startPos = { x: REGION.x + 6, y: REGION.y + REGION.height + 1 };
  const local = await initLocalProjectStore({ projectDir });
  try { await local.saveProject(ready); } finally { local.close(); }
  return { projectDir, mapId };
}

function body(request: { postDataBuffer(): Buffer | null }): any {
  const raw = request.postDataBuffer();
  if (!raw) return {};
  return JSON.parse((raw[0] === 31 ? gunzipSync(raw) : raw).toString("utf8"));
}

export async function capture(root: string, kind: string, instruction: string): Promise<void> {
  mkdirSync(root, { recursive: true });
  const { projectDir, mapId } = await prepare(root);
  const host = await startHost(projectDir, root);
  const browser = await firefox.launch({ headless: true });
  const log: Record<string, unknown> = { kind, instruction, region: REGION, mapId, shots: [] as string[] };
  const shot = async (page: any, name: string) => { const file = resolve(root, `${name}.png`); await page.screenshot({ path: file }); (log.shots as string[]).push(file); };
  try {
    const editor = await newEditor(browser, host.url, projectDir, { piApply: "yolo", piApplyPolicyVersion: 1, piTeam: false, autonomyLevel: "balanced", assistantVersion: "v2" }, { bootTimeoutMs: 360000 });
    const page = editor.page;
    await page.route("**/v1/chat/completions**", (route: any) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{}" } }] }) }));
    await page.route("**/v1/agent/run**", async (route: any) => {
      const request = body(route.request());
      const project = structuredClone(request.project) as Project;
      const ctx = { project, currentMapId: mapId, assistantRun: true };
      const args = { mapId, region: REGION, kind };
      const result = runTool(ctx, "build_region_place", args);
      log.task = String(request.task ?? request.command?.task ?? "").slice(0, 2000);
      log.result = { ok: result.ok, summary: result.summary, data: result.data };
      const events = [
        { type: "start", provider: request.provider, model: request.model, toolCount: 1 },
        { type: "tool_start", id: "rd-1", name: "build_region_place", args },
        { type: "tool_end", id: "rd-1", name: "build_region_place", ok: result.ok, summary: result.summary, result: result.data },
        { type: "assistant", text: result.ok ? `${instruction} — 지었어요. ${result.summary}` : `못 지었어요: ${result.summary}` },
        { type: "done", project: ctx.project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: result.ok ? 0 : 1 } },
      ];
      await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" });
    });
    await page.waitForTimeout(1500);
    await page.evaluate(({ mapId, region, instruction }) => {
      window.dispatchEvent(new CustomEvent("oprn:ai-region-handoff", { detail: { mapId, region, instruction, autoRun: false, stamp: false } }));
    }, { mapId, region: REGION, instruction });
    await page.waitForTimeout(1200);
    await shot(page, "1-before");
    await page.getByTestId("ai-send").click();
    await page.getByTestId("region-result-card").waitFor({ timeout: 180000 });
    await page.waitForTimeout(1500);
    log.card = await page.getByTestId("region-result-count").textContent();
    await shot(page, "2-after-exterior");
    await page.getByTestId("region-result-compare").click();
    await page.waitForTimeout(1200);
    await shot(page, "3-compare-before");
    await page.getByTestId("region-result-compare").click();
    const innerName = String((log.result as { summary?: string }).summary ?? "").split(":")[0]!.trim();
    log.innerName = innerName;
    const tree = page.getByTestId("map-tree");
    await tree.getByText(innerName, { exact: true }).first().click().catch((error: Error) => { log.treeClick = error.message.slice(0, 200); });
    await page.waitForTimeout(2000);
    await shot(page, "4-interior");
    await tree.getByText("버들 마을").first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByTestId("topbar-test-play").click();
    await page.waitForTimeout(6000);
    await shot(page, "5-play-outside");
    for (let i = 0; i < 4; i += 1) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(450); }
    await page.waitForTimeout(2500);
    await shot(page, "6-play-inside");
    for (let i = 0; i < 3; i += 1) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(450); }
    await page.waitForTimeout(2500);
    await shot(page, "7-play-back-outside");
  } finally {
    writeFileSync(resolve(root, "capture.json"), JSON.stringify(log, null, 2));
    await browser.close().catch(() => {});
    await host.close();
  }
}

if (import.meta.main) {
  const [out, kind, text] = process.argv.slice(2);
  if (!out || !kind) throw new Error("capture.ts <출력 폴더> <kind> [지시]");
  await capture(resolve(out), kind, text ?? "여기 상점 만들어 줘");
}
