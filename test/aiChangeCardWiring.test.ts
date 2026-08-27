import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import type { ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

function makeLog(): {
  readonly log: HTMLElement;
  readonly host: ReturnType<typeof createConversationLogHost>;
} {
  const log = document.createElement("div");
  const host = createConversationLogHost({
    log,
    revealVolatileZone: () => undefined,
    removeStartScreen: () => undefined,
  });
  return { log, host };
}

function okResult(summary: string): ToolResult {
  return { ok: true, summary };
}

function rowChildClasses(log: HTMLElement): string[] {
  const row = (log as unknown as FakeElement).children.find((child) => child.className.includes("ai-command-row"));
  return (row?.children ?? []).map((child) => child.className);
}

function changeCard(): HTMLElement {
  const card = document.createElement("section");
  card.className = "ai-change-card";
  card.dataset.testid = "ai-change-card";
  return card;
}

describe("변경 카드가 툴 활동보다 먼저 읽힌다", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("툴 활동이 이미 붙은 턴에서 카드가 그 앞에 삽입되고 툴 활동은 조용해진다", () => {
    const { log, host } = makeLog();
    host.renderConversationEntry({ kind: "user", text: "광장 만들어줘" });
    host.appendToolLine("build_plaza", okResult("광장 8×6"));

    host.appendChangeCard(changeCard());

    const classes = rowChildClasses(log);
    const cardIndex = classes.findIndex((name) => name.includes("ai-change-card-host"));
    const toolIndex = classes.findIndex((name) => name.includes("ai-tool-activity"));
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(cardIndex).toBeLessThan(toolIndex);
    expect(classes[toolIndex]).toContain("is-quiet");
  });

  it("툴 활동 목록은 카드가 붙은 뒤에도 접힌 상태를 유지한다", () => {
    const { log, host } = makeLog();
    host.renderConversationEntry({ kind: "user", text: "광장 만들어줘" });
    host.appendToolLine("build_plaza", okResult("광장 8×6"));

    host.appendChangeCard(changeCard());

    const list = (log as unknown as FakeElement).querySelector(".ai-tool-activity-list");
    expect(list?.hidden).toBe(true);
  });

  it("툴 활동이 없으면 카드가 커맨드 줄 끝에 붙는다", () => {
    const { log, host } = makeLog();
    host.renderConversationEntry({ kind: "user", text: "광장 만들어줘" });

    host.appendChangeCard(changeCard());

    const classes = rowChildClasses(log);
    expect(classes.some((name) => name.includes("ai-change-card-host"))).toBe(true);
    expect(classes.some((name) => name.includes("ai-tool-activity"))).toBe(false);
  });
});
