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
    revealVolatileZone: () => undefined,
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

  it("attaches tool activity to the last command row instead of a bubble", () => {
    // Break: appendToolLine still wraps the group in ai-chat-bubble.
    const { log, host } = makeLog();

    host.appendBubble("user", "길 깔아줘");
    host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" });

    const activity = findByTestId(log as unknown as FakeElement, "ai-tool-activity");
    const row = log.querySelector("[data-testid=ai-command-row]");
    expect(activity).toBeTruthy();
    expect(activity?.className).not.toContain("ai-chat-bubble");
    expect(row?.contains(activity as unknown as Node)).toBe(true);
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

describe("작업 타임라인 — 한국어 라벨 · 진행 중 펼침 · 완료 후 요약 접힘 (데크 2026-09-03)", () => {
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
    const host = createConversationLogHost({ log, removeStartScreen: () => undefined, ...(renderChip ? { renderChip } : {}) });
    return { log, host };
  }

  it("라이브 행은 한국어 라벨 + 요약 + 상태이고, 함수 이름은 title 로 내려간다", () => {
    // Break: 행이 `✓ place_npc …` 한 줄 텍스트로 돌아가거나 라벨이 함수 이름 그대로다.
    const { log, host } = makeHost();
    host.appendBubble("user", "상인 세워줘");
    host.appendToolLine("place_npc", { ok: true, summary: "상인 「두리」 (27,15)" }, { x: 27, y: 15 }, { live: true });
    const entry = findByTestId(log as unknown as FakeElement, "ai-tool-entry");
    expect(entry?.querySelector(".ai-act-label")?.textContent).toBe("NPC 배치");
    expect(entry?.querySelector(".ai-act-sum")?.textContent).toBe("상인 「두리」 (27,15)");
    expect(entry?.querySelector(".ai-act-status")).not.toBeNull();
    expect(entry?.getAttribute("title")).toContain("place_npc");
    expect(entry?.textContent).not.toContain("place_npc");
  });

  it("진행 중(live)엔 목록이 펼쳐지고 헤더는 단계 수, 닫으면 접히고 라벨 요약이 붙는다", () => {
    // Break: 완료 뒤에도 펼쳐져 영수증을 밀어내거나, 접힌 헤더가 「작업 2」 처럼 무엇을 했는지 말하지 않는다.
    const { log, host } = makeHost();
    host.appendBubble("user", "우물 놓고 상인 세워줘");
    host.appendToolLine("get_map_region", { ok: true, summary: "60×45" }, { x: 0, y: 0, w: 60, h: 45 }, { live: true });
    host.appendToolLine("stamp_structure", { ok: true, summary: "우물 1" }, { x: 24, y: 11 }, { live: true });
    host.appendToolLine("place_npc", { ok: true, summary: "상인 2" }, { x: 22, y: 14 }, { live: true });
    const list = log.querySelector(".ai-tool-activity-list") as unknown as FakeElement;
    const toggle = findByTestId(log as unknown as FakeElement, "ai-tool-activity-toggle");
    expect(list.hidden).toBe(false);
    // 조회 툴(get_*)은 노이즈로 세지 않는다 — 단계는 쓰기 2.
    expect(toggle?.textContent).toBe("작업 2단계");
    host.closeToolActivity();
    expect(list.hidden).toBe(true);
    expect(toggle?.textContent).toBe("작업 2단계 · 건물 찍기 → NPC 배치");
  });

  it("복원 경로(live 아님)는 접힌 채 붙고 조회만 있으면 「조회 N건」", () => {
    // Break: 복원된 대화가 펼쳐진 목록으로 화면을 채운다(e2e assistant-change-preview 계약).
    const { log, host } = makeHost();
    host.appendBubble("user", "맵 좀 봐줘");
    host.appendToolLine("get_map_region", { ok: true, summary: "60×45" });
    host.appendToolLine("show_map_region", { ok: true, summary: "보임" });
    const list = log.querySelector(".ai-tool-activity-list") as unknown as FakeElement;
    const toggle = findByTestId(log as unknown as FakeElement, "ai-tool-activity-toggle");
    expect(list.hidden).toBe(true);
    expect(toggle?.textContent).toBe("조회 2건");
  });

  it("renderChip 이 주어지면 행 앞에 맵 칩을 꽂고, null 이면 아이콘 칩", () => {
    // Break: 칩 훅이 무시되어 모든 행이 아이콘으로만 남는다.
    const chip = document.createElement("span");
    chip.className = "ai-act-chip";
    chip.dataset.testid = "fake-chip";
    const { log, host } = makeHost((name) => (name === "place_npc" ? chip : null));
    host.appendBubble("user", "상인");
    host.appendToolLine("place_npc", { ok: true, summary: "상인 1" }, { x: 1, y: 1 }, { live: true });
    host.appendToolLine("configure_game_systems", { ok: true, summary: "설정" }, {}, { live: true });
    const entries = log.querySelectorAll("[data-testid=ai-tool-entry]");
    expect(findByTestId(entries[0] as unknown as FakeElement, "fake-chip")).toBe(chip);
    expect(entries[1]?.querySelector(".ai-act-chip")?.className).toContain("is-icon");
  });
});
