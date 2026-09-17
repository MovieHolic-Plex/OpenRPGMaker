import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function makeLog(): {
  readonly log: HTMLElement;
  readonly host: ReturnType<typeof createConversationLogHost>;
} {
  const log = document.createElement("div");
  const host = createConversationLogHost({
    log,
    removeStartScreen: () => undefined,
  });
  return { log, host };
}

describe("conversation log command rows", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("records a user+assistant turn as two command rows and zero chat bubbles", () => {
    // Break: appendConversationBubble still assigns ai-chat-bubble / ai-chat-user.
    const { log, host } = makeLog();

    host.renderConversationEntry({ kind: "user", text: "호수 만들어줘" });
    host.renderConversationEntry({ kind: "assistant", text: "초안입니다." });

    expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(2);
    expect(log.querySelectorAll(".ai-chat-user")).toHaveLength(0);
    expect(log.querySelectorAll(".ai-chat-assistant")).toHaveLength(0);
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-user")?.textContent).toContain("호수 만들어줘");
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toContain("초안입니다.");
  });

  it("prefixes each human-log row with @>", () => {
    // Break: the row is emitted without an @> prefix node.
    const { log, host } = makeLog();

    host.appendBubble("user", "길 깔아줘");
    host.appendBubble("system", "오류: 키 없음");

    const prefixes = log.querySelectorAll(".ai-command-prefix");
    expect(prefixes).toHaveLength(2);
    expect(prefixes[0]?.textContent).toBe("@>");
    expect(prefixes[1]?.textContent).toBe("@>");
  });

  it("streams tokens into the last command row in place", () => {
    // Break: each stream token creates another ai-command-row instead of mutating the last body.
    const { log, host } = makeLog();

    const streamed = host.appendBubble("assistant", "");
    streamed.textContent = `${streamed.textContent ?? ""}헬`;
    streamed.textContent = `${streamed.textContent ?? ""}로`;

    expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
    expect(streamed.textContent).toBe("헬로");
    expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toBe("헬로");
  });

  it("keeps markdown rendering inside the command row", () => {
    // Break: assistant markdown is rendered as a sibling bubble, not inside the row.
    const { log, host } = makeLog();

    host.appendBubble("assistant", "**초안**입니다");

    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(row?.querySelector(".md")).toBeTruthy();
    expect(row?.querySelector("strong")?.textContent).toBe("초안");
  });

  it("tool lines leave the log entirely — they are handed to the work sink (방향 G)", () => {
    // Break: appendToolLine attaches ai-tool-activity to the command row again.
    const log = document.createElement("div");
    const received: HTMLElement[] = [];
    const host = createConversationLogHost({
      log,
      removeStartScreen: () => undefined,
      workSink: {
        appendToolEntry: (entry) => void received.push(entry),
        noteReadOnlyTool: () => undefined,
        appendCard: () => undefined,
      },
    });

    host.appendBubble("user", "길 깔아줘");
    const entry = host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" }, undefined, { live: true });

    expect(entry).not.toBeNull();
    expect(received).toEqual([entry]);
    expect(findByTestId(log as unknown as FakeElement, "ai-tool-activity")).toBeNull();
    expect(findByTestId(log as unknown as FakeElement, "ai-tool-entry")).toBeNull();
    expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
  });

  it("attaches a tile grid to the last command row instead of a bubble", () => {
    // Break: appendTileGrid still wraps the grid in ai-chat-bubble.
    const { log, host } = makeLog();

    host.appendBubble("assistant", "격자");
    host.appendTileGrid({
      tilesetId: DEFAULT_TILESET_ID,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      lower: [[0]],
      upper: [[-1]],
    });

    const grid = findByTestId(log as unknown as FakeElement, "ai-bubble-tile-grid");
    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(grid).toBeTruthy();
    expect(grid?.className).not.toContain("ai-chat-bubble");
    expect(row?.contains(grid as unknown as Node)).toBe(true);
  });
});

describe("작업 행 — 한국어 라벨 · 조회는 개수만 · 복원 경로 표시 (데크 2026-09-03 → 띠 2026-09-17)", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  function makeHost(renderChip?: Parameters<typeof createConversationLogHost>[0]["renderChip"]) {
    const log = document.createElement("div");
    const entries: Array<{ entry: HTMLElement; live: boolean; name: string }> = [];
    const reads: Array<{ name: string; live: boolean }> = [];
    const host = createConversationLogHost({
      log,
      removeStartScreen: () => undefined,
      workSink: {
        appendToolEntry: (entry, meta) => void entries.push({ entry, live: meta.live, name: meta.name }),
        noteReadOnlyTool: (name, live) => void reads.push({ name, live }),
        appendCard: () => undefined,
      },
      ...(renderChip ? { renderChip } : {}),
    });
    return { log, host, entries, reads };
  }

  it("라이브 행은 한국어 라벨 + 요약 + 상태이고, 함수 이름은 title 로 내려간다", () => {
    // Break: 행이 `✓ place_npc …` 한 줄 텍스트로 돌아가거나 라벨이 함수 이름 그대로다.
    const { host, entries } = makeHost();
    host.appendBubble("user", "상인 세워줘");
    host.appendToolLine("place_npc", { ok: true, summary: "상인 「두리」 (27,15)" }, { x: 27, y: 15 }, { live: true });
    const entry = entries[0]?.entry as unknown as FakeElement | undefined;
    expect(entry?.dataset.testid).toBe("ai-tool-entry");
    expect(entry?.querySelector(".ai-act-label")?.textContent).toBe("NPC 배치");
    expect(entry?.querySelector(".ai-act-sum")?.textContent).toBe("상인 「두리」 (27,15)");
    expect(entry?.querySelector(".ai-act-status")).not.toBeNull();
    expect(entry?.getAttribute("title")).toContain("place_npc");
    expect(entry?.textContent).not.toContain("place_npc");
  });

  it("조회 툴(get_*)은 행 없이 개수만 알리고, 쓰기 툴만 행이 된다", () => {
    // Break: 조회가 단계 행으로 남아 카드가 「작업 3단계」 로 부푼다.
    const { host, entries, reads } = makeHost();
    host.appendBubble("user", "우물 놓고 상인 세워줘");
    expect(host.appendToolLine("get_map_region", { ok: true, summary: "60×45" }, { x: 0, y: 0, w: 60, h: 45 }, { live: true })).toBeNull();
    host.appendToolLine("stamp_structure", { ok: true, summary: "우물 1" }, { x: 24, y: 11 }, { live: true });
    host.appendToolLine("place_npc", { ok: true, summary: "상인 2" }, { x: 22, y: 14 }, { live: true });
    expect(reads).toEqual([{ name: "get_map_region", live: true }]);
    expect(entries.map((item) => item.name)).toEqual(["stamp_structure", "place_npc"]);
    expect(entries.every((item) => item.live)).toBe(true);
  });

  it("복원 경로(live 아님)는 live=false 로 표시돼 띠가 걸러낼 수 있다", () => {
    // Break: 복원된 대화의 툴콜이 이번 세션의 작업 카드로 쌓인다.
    const { host, entries, reads } = makeHost();
    host.appendBubble("user", "맵 좀 봐줘");
    host.appendToolLine("get_map_region", { ok: true, summary: "60×45" });
    host.appendToolLine("show_map_region", { ok: true, summary: "보임" });
    host.appendToolLine("paint_road", { ok: true, summary: "길 3칸" });
    expect(reads.map((item) => item.live)).toEqual([false, false]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.live).toBe(false);
  });

  it("renderChip 이 주어지면 행 앞에 맵 칩을 꽂고, null 이면 아이콘 칩", () => {
    // Break: 칩 훅이 무시되어 모든 행이 아이콘으로만 남는다.
    const chip = document.createElement("span");
    chip.className = "ai-act-chip";
    chip.dataset.testid = "fake-chip";
    const { host, entries } = makeHost((name) => (name === "place_npc" ? chip : null));
    host.appendBubble("user", "상인");
    host.appendToolLine("place_npc", { ok: true, summary: "상인 1" }, { x: 1, y: 1 }, { live: true });
    host.appendToolLine("configure_game_systems", { ok: true, summary: "설정" }, {}, { live: true });
    expect(findByTestId(entries[0]!.entry as unknown as FakeElement, "fake-chip")).toBe(chip);
    expect(entries[1]?.entry.querySelector(".ai-act-chip")?.className).toContain("is-icon");
  });
});
