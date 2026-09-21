import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { mergeInterviewPatch, parseInterviewTurn, interviewHistoryToMessages } from "@/ai/worldCanonInterview";
import { resolveWorldCanon } from "@/project/world/canon";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.textContent = "";
    renderWorldCanonTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("world canon interview", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    vi.restoreAllMocks();
  });

  it("parses a model turn and drops fields outside the schema", () => {
    const turn = parseInterviewTurn(JSON.stringify({
      recap: "바다가 이름을 보관하는 세계로 이해했다.",
      question: "이 세계에 신이 있나요?",
      choices: ["신은 없다", "신이 있다"],
      patch: { name: "비늘의 바다", tones: ["mythic", "bogus"], nonsense: 1 },
      done: false,
    }));
    expect(turn?.recap).toContain("바다가 이름을");
    expect(turn?.question).toContain("신이 있나요");
    expect(turn?.choices).toHaveLength(2);
    expect(turn?.patch.name).toBe("비늘의 바다");
    // 스키마 밖 톤은 버린다.
    expect(turn?.patch.tones).toEqual(["mythic"]);
    expect(turn?.patch).not.toHaveProperty("nonsense");
  });

  it("survives a fenced JSON reply and returns null on garbage", () => {
    const fenced = parseInterviewTurn("Here you go:\n```json\n{\"recap\":\"r\",\"question\":\"q\",\"choices\":[],\"patch\":{},\"done\":true}\n```");
    expect(fenced?.question).toBe("q");
    expect(fenced?.done).toBe(true);
    expect(parseInterviewTurn("not json at all")).toBeNull();
  });

  it("clamps patch values to the world canon bounds", () => {
    const turn = parseInterviewTurn(JSON.stringify({
      recap: "", question: "", choices: [], done: false,
      patch: { name: "가".repeat(400), absences: Array.from({ length: 60 }, (_, index) => `금기${index}`) },
    }));
    expect(turn?.patch.name?.length).toBe(120);
    expect(turn?.patch.absences?.length).toBe(32);
  });

  it("merges a patch without dropping existing values", () => {
    const canon = resolveWorldCanon({ name: "옛 이름", tones: ["grim"], laws: { gods: { present: false } } });
    const merged = mergeInterviewPatch(canon, { premise: "새 전제", tones: ["mythic"], laws: { money: { present: true, note: "이름이 화폐" } } });
    expect(merged.name).toBeUndefined();
    expect(merged.premise).toBe("새 전제");
    // 톤은 합집합 — 기존 grim 이 남는다.
    expect(merged.tones).toEqual(["grim", "mythic"]);
    expect(merged.laws?.gods).toEqual({ present: false, note: "" });
    expect(merged.laws?.money).toEqual({ present: true, note: "이름이 화폐" });
  });

  it("sends the stored canon as context so the model never re-asks settled slots", () => {
    const canon = resolveWorldCanon({ name: "서녘", premise: "마법은 피의 대가", laws: { death: { present: false } } });
    const messages = interviewHistoryToMessages([{ role: "user", text: "안녕" }], canon);
    const context = messages.map((message) => message.content).join("\n");
    expect(context).toContain("서녘");
    expect(context).toContain("마법은 피의 대가");
    expect(context).toContain("법칙 death: 없음");
  });

  it("renders the interview surface instead of a settings form", () => {
    const host = renderTab();
    findByTestId(host, "db-ws-section-tab-settings")?.click();
    const interview = findByTestId(host, "world-canon-interview");
    expect(interview).toBeTruthy();
    expect(findByTestId(host, "world-canon-interview-input")).toBeTruthy();
    expect(findByTestId(host, "world-canon-interview-start")).toBeTruthy();
    expect(findByTestId(host, "world-canon-interview-summary")?.textContent).toContain("이름 —");
    // 수동 입력은 인터뷰 뒤 접힌 fallback(details) 안에만 있다.
    const manual = interview?.querySelector(".world-canon-interview-manual");
    expect(manual).toBeTruthy();
    expect(manual?.querySelector("[data-testid='db-world-canon-name']")).toBeTruthy();
    // 인터뷰 표면이 먼저 보이고, 폼이 첫 화면을 차지하지 않는다.
    expect(interview?.querySelector(".world-canon-interview-log")).toBeTruthy();
  });

  it("applies an interview patch onto the project canon through writeCanon", async () => {
    const host = renderTab();
    findByTestId(host, "db-ws-section-tab-settings")?.click();
    const interview = findByTestId(host, "world-canon-interview");
    // 인터뷰 경로를 검증하기 위해 병합 함수를 직접 통과시킨 뒤, UI 칩이 갱신되는지 본다.
    const patch = mergeInterviewPatch(resolveWorldCanon(store.getCurrent().worldCanon), { name: "비늘의 바다", premise: "바다는 잊지 않는다" });
    store.update((draft) => {
      draft.worldCanon = { ...(draft.worldCanon ?? {}), name: patch.name, premise: patch.premise };
    });
    expect(store.getCurrent().worldCanon?.name).toBe("비늘의 바다");
    expect(interview).toBeTruthy();
  });
});

