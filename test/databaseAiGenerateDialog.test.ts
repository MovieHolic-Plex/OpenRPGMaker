// @vitest-environment happy-dom
// test/databaseAiGenerateDialog.test.ts
//
// DB 「AI로 생성」 대화상자의 사용 계약(2026-09-03 재작성).
// 실측 문제: Win98 식 파란 헤더·MS PGothic·420px 창으로 모던 DB 스튜디오와 이질적이었고,
// 진행은 평문 한 줄, 완료도 「완료: 이름 (id)」 평문뿐이라 무엇이 만들어졌는지 보이지 않았다.
// 여기서 고정하는 것:
//   1. 단계가 보인다(정보 → 그림 → 등록) — data-phase 로 노출.
//   2. 완료 시 만들어진 레코드의 핵심 수치가 카드로 보이고, 「하나 더 만들기」로 이어진다.
//   3. 실행 중에는 입력이 잠기고 닫기가 「취소」가 된다(취소는 AbortSignal 로 전달).
//   4. 기존 testid·상태 접두어(「완료」/「실패」)는 캡처 스크립트가 읽으므로 유지한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/ai/llmClient";
import type { AiDatabaseGenerationDeps, AiDatabaseGenerationInput, AiDatabaseGenerationOutcome } from "@/editor/aiDatabaseGeneration";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function config(): AiConfig {
  return {
    authMode: "chatgpt",
    providerId: "google-antigravity",
    baseUrl: "",
    model: "gemini-3.7-flash",
    liteModel: "gemini-3.7-flash",
    apiKey: "",
    maxToolCalls: 10,
    maxTokens: 1000,
    reasoningEffort: "low",
    agentMode: "auto",
  } as AiConfig;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

type Generate = (input: AiDatabaseGenerationInput, deps?: AiDatabaseGenerationDeps) => Promise<AiDatabaseGenerationOutcome>;

afterEach(() => {
  document.body.replaceChildren();
});

function seedEnemy(): void {
  const project = createBlankProject();
  project.database.enemies.push({
    ...project.database.enemies[0]!,
    id: "enemy_ai_frost-wolf",
    name: "서슬 늑대",
    stats: { maxHp: 180, maxMp: 25, attack: 52, defense: 28, mind: 18, agility: 58 },
    rewards: { exp: 48, gold: 36, dropRatePercent: 15 },
  });
  store.replace(project);
}

describe("openDatabaseAiGenerateDialog", () => {
  it("현대 대화상자 뼈대: 제목·설명·예시 칩·그림 옵션·만들기, 열자마자 설명에 포커스", () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { loadConfig: config } });
    const dialog = overlay.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("h2")?.textContent).toContain("몬스터");
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    expect(document.activeElement).toBe(brief);
    expect(overlay.querySelectorAll("[data-testid^='db-ai-generate-example-']").length).toBeGreaterThanOrEqual(2);
    // 몬스터는 그림을 만들지 않고 도트 몬스터 140종에서 고른다(2026-10-02) — 그림 옵션은 아이템에만 있다.
    expect(overlay.querySelector("[data-testid='db-ai-generate-artwork']")).toBeNull();
    const itemOverlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { loadConfig: config } });
    expect(itemOverlay.querySelector<HTMLInputElement>("[data-testid='db-ai-generate-artwork']")?.checked).toBe(true);
    expect(overlay.querySelector("[data-testid='db-ai-generate-run']")?.textContent).toContain("만들기");
    expect(overlay.querySelector("[data-testid='db-ai-generate-close']")?.textContent).toContain("닫기");
    // 상태줄은 아직 비어 있다.
    expect(overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")?.dataset.phase).toBe("idle");
  });

  it("예시 칩은 설명을 채우기만 하고 생성은 부르지 않는다", () => {
    const generate = vi.fn<Generate>();
    const overlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { generate, loadConfig: config } });
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-example-0']")?.click();
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    expect(brief.value.length).toBeGreaterThan(5);
    expect(generate).not.toHaveBeenCalled();
  });

  it("빈 설명으로 만들기를 누르면 부르지 않고 안내만 남긴다", () => {
    const generate = vi.fn<Generate>();
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { generate, loadConfig: config } });
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    expect(generate).not.toHaveBeenCalled();
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    expect(status.dataset.phase).toBe("error");
    expect(status.textContent).toContain("설명");
  });

  it("실행: 단계가 흐르고(정보→등록 — 몬스터는 그림 단계가 없다), 완료 카드에 수치가 보이며 rerender 가 불린다", async () => {
    seedEnemy();
    const pending = deferred<AiDatabaseGenerationOutcome>();
    let phaseHook: ((phase: "text" | "artwork" | "apply") => void) | undefined;
    const generate = vi.fn<Generate>((input, deps) => {
      phaseHook = deps?.onPhase;
      expect(input.kind).toBe("enemy");
      expect(input.brief).toContain("서슬 늑대");
      expect(input.withArtwork).toBe(false);
      return pending.promise;
    });
    const rerender = vi.fn();
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender, deps: { generate, loadConfig: config } });
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    const run = overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")!;
    const close = overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-close']")!;
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    brief.value = "얼음 동굴에 사는 서슬 늑대";
    brief.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(run.disabled).toBe(true);
    expect(brief.disabled).toBe(true);
    expect(close.textContent).toContain("취소");
    expect(status.dataset.phase).toBe("text");
    phaseHook?.("apply");
    expect(status.dataset.phase).toBe("apply");

    pending.resolve({
      kind: "enemy",
      recordId: "enemy_ai_frost-wolf",
      name: "서슬 늑대",
      resourceId: "generated-enemy-wolf-grey",
      artworkDataUrl: "/assets/generated/pixel-enemy-portraits/wolf-grey.png",
      summary: "AI 몬스터 생성: 서슬 늑대",
    });
    await vi.waitFor(() => expect(status.dataset.phase).toBe("done"));
    // 캡처 스크립트 호환: 완료 상태는 「완료」로 시작한다.
    expect(status.textContent?.startsWith("완료")).toBe(true);
    expect(rerender).toHaveBeenCalledTimes(1);
    const result = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-result']")!;
    expect(result.hidden).toBe(false);
    expect(result.textContent).toContain("서슬 늑대");
    expect(result.textContent).toContain("180");
    expect(result.textContent).toContain("52");
    expect(result.textContent).toContain("48");
    const preview = overlay.querySelector<HTMLImageElement>("[data-testid='db-ai-generate-preview']")!;
    expect(preview.hidden).toBe(false);
    expect(preview.src).toContain("/assets/generated/pixel-enemy-portraits/wolf-grey.png");
    // 마무리 행동: 닫기 + 하나 더 만들기.
    expect(close.textContent).toContain("닫기");
    expect(run.disabled).toBe(false);
    expect(run.textContent).toContain("하나 더");
    expect(brief.disabled).toBe(false);
    run.click();
    // 「하나 더」는 설명을 비우고 결과를 접는다 — 생성은 새 설명을 받은 뒤에만 부른다.
    expect(generate).toHaveBeenCalledTimes(1);
    expect(brief.value).toBe("");
    expect(result.hidden).toBe(true);
    expect(status.dataset.phase).toBe("idle");
  });

  it("실패는 상태줄에 「실패」로 남고 설명은 그대로 두어 다시 시도할 수 있다", async () => {
    const generate = vi.fn<Generate>(() => Promise.reject(new Error("AI 응답에서 JSON 객체를 찾지 못했습니다.")));
    const overlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { generate, loadConfig: config } });
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    brief.value = "상급 회복약";
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    await vi.waitFor(() => expect(status.dataset.phase).toBe("error"));
    expect(status.textContent?.startsWith("실패")).toBe(true);
    expect(status.textContent).toContain("JSON");
    expect(brief.value).toBe("상급 회복약");
    expect(brief.disabled).toBe(false);
    expect(overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.disabled).toBe(false);
  });

  it("실행 중 취소는 AbortSignal 을 끊고 대화상자를 닫는다", () => {
    const pending = deferred<AiDatabaseGenerationOutcome>();
    let signal: AbortSignal | undefined;
    const generate = vi.fn<Generate>((input) => {
      signal = input.signal;
      return pending.promise;
    });
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { generate, loadConfig: config } });
    document.body.append(overlay);
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    brief.value = "늑대";
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    expect(signal?.aborted).toBe(false);
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-close']")?.click();
    expect(signal?.aborted).toBe(true);
    expect(overlay.isConnected).toBe(false);
  });

  it("그림 제공자가 대화 제공자와 다르면 그 사실을 옵션 옆에 적는다", () => {
    const overlay = openDatabaseAiGenerateDialog({
      kind: "item",
      rerender: () => undefined,
      deps: { loadConfig: () => ({ ...config(), providerId: "openai-codex" }) },
    });
    expect(overlay.querySelector("[data-testid='db-ai-generate-provider-notice']")?.textContent).toContain("google-antigravity");
  });
});
