/**
 * 실제 실행 중인 에디터에서 "AI 가 에디터 전 영역에 접근 가능한가"를 증명한다.
 *
 * 왜 e2e 인가: 능력 색인·자연어 승격은 유닛 테스트로 계약을 고정했지만, 브라우저에서
 * 실제로 로드된 모듈과 실제 프로젝트(store.getCurrent())로 조립된 시스템 프롬프트가
 * 같은 결과를 내는지는 런타임에서만 확인된다. Vite dev 가 /src/*.ts 를 그대로 서빙하므로
 * 페이지 컨텍스트에서 동적 import 로 살아있는 모듈을 불러 검증한다.
 *
 * Run:
 *   DEV_SERVER_PORT=9812 npx playwright test test/e2e/ai-editor-reach.spec.ts --project=chromium
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE = path.resolve(".omo/evidence/ai-editor-reach-20260827");
mkdirSync(EVIDENCE, { recursive: true });

interface ReachProbe {
  readonly activeToolCount: number;
  readonly missingFromIndex: readonly string[];
  readonly hasRuleBlock: boolean;
  readonly promptChars: number;
  readonly indexChars: number;
  readonly truncated: boolean;
  readonly request: string;
  readonly domains: readonly string[];
  readonly domainExposedCount: number;
  readonly domainExposedHasTool: boolean;
  readonly escalatedNames: readonly string[];
  readonly emptyEscalation: readonly string[];
  readonly projectName: string;
}

const NL_REQUEST = "타이틀 화면 바꿔줘";
const NL_EXPECTED_TOOL = "set_title_screen";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

test("AI reaches every editor area from the running editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  const probe = (await page.evaluate(async ({ request, expectedTool }) => {
    const load = async (specifier: string): Promise<Record<string, unknown>> =>
      (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;

    const toolsModule = await load("/src/editor/tools/index.ts");
    const contextModule = await load("/src/ai/contextBuilder.ts");
    const indexModule = await load("/src/ai/toolCapabilityIndex.ts");
    const escalationModule = await load("/src/ai/capabilityEscalation.ts");
    const toolModeModule = await load("/src/editor/assistantToolMode.ts");
    const storeModule = await load("/src/project/store.ts");

    const activeTools = toolsModule.activeTools as () => readonly { readonly name: string }[];
    const toOpenAiTools = toolsModule.toOpenAiTools as (
      defs: undefined,
      options: { domains: ReadonlySet<string> },
    ) => readonly { readonly function: { readonly name: string } }[];
    const buildSystemPrompt = contextModule.buildSystemPrompt as (project: unknown, options: unknown) => string;
    const buildToolCapabilityIndex = indexModule.buildToolCapabilityIndex as () => string;
    const capabilityEscalatedToolNames = escalationModule.capabilityEscalatedToolNames as (
      text: string,
      exposed: ReadonlySet<string>,
    ) => readonly string[];
    const computeActiveToolDomains = toolModeModule.computeActiveToolDomains as (text: string) => ReadonlySet<string>;
    const store = storeModule.store as { getCurrent: () => { readonly name: string } };

    const project = store.getCurrent();
    const prompt = buildSystemPrompt(project, {});
    const capabilityIndex = buildToolCapabilityIndex();
    const active = activeTools();
    const domains = computeActiveToolDomains(request);
    const domainExposed = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    const escalated = capabilityEscalatedToolNames(request, new Set(domainExposed));

    return {
      activeToolCount: active.length,
      missingFromIndex: active.map((tool) => tool.name).filter((name) => !prompt.includes(name)),
      hasRuleBlock: prompt.includes("find_tools") && prompt.includes("결함"),
      promptChars: prompt.length,
      indexChars: capabilityIndex.length,
      truncated: prompt.includes("[예산 초과"),
      request,
      domains: [...domains],
      domainExposedCount: domainExposed.length,
      domainExposedHasTool: domainExposed.includes(expectedTool),
      escalatedNames: [...escalated],
      emptyEscalation: [...capabilityEscalatedToolNames("   ", new Set(domainExposed))],
      projectName: project.name,
    };
  }, { request: NL_REQUEST, expectedTool: NL_EXPECTED_TOOL })) as ReachProbe;

  writeFileSync(path.join(EVIDENCE, "c5-runtime-probe.json"), `${JSON.stringify(probe, null, 2)}\n`, "utf8");
  await page.screenshot({ path: path.join(EVIDENCE, "c5-editor-loaded.png"), animations: "disabled" });

  expect(probe.missingFromIndex).toEqual([]);
  expect(probe.activeToolCount).toBeGreaterThanOrEqual(140);
  expect(probe.hasRuleBlock).toBe(true);
  expect(probe.truncated).toBe(false);

  expect(probe.domainExposedHasTool).toBe(false);
  expect(probe.escalatedNames).toContain(NL_EXPECTED_TOOL);

  expect(probe.emptyEscalation).toEqual([]);
});
