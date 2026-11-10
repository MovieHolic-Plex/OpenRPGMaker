// 완료 판정(2026-11-11 J-B2): 화면 검수의 다듬기·모델이 받아 보지 못한 항목·장부는 완료를 막지 않는다. 그 밖의 막힘은 막는다.
import { describe, expect, it } from "vitest";
import { todoReport } from "@/ai/v2/finalReport";
import { TodoStore } from "@/ai/v2/loop/todoStore";

function storeWith(vqa: { severity?: "polish"; offered?: boolean; by?: "model" | "auto" }[], extra?: "gate-blocked"): TodoStore {
  const store = new TodoStore();
  store.init([{ phase: "짓기", items: [{ content: "마을을 짓는다" }] }]);
  store.done(store.items[0]!, undefined);
  const opened = store.append("화면 검수 1판", vqa.map((v, i) => ({ content: `결함 ${i}`, key: `vqa:map:m:${i}`, ...(v.severity ? { severity: v.severity } : {}) })), "vqa");
  vqa.forEach((v, i) => {
    if (v.offered !== false) { store.start(opened[i]!); store.markOffered(); }
    store.block(opened[i]!, "남음", v.by ?? "auto");
  });
  if (extra === "gate-blocked") { const [g] = store.append("함수 검사", [{ content: "엔딩을 부르는 이벤트가 없다", key: "game:ending" }], "gate"); store.block(g!, "고치는 도구가 없다", "auto"); }
  return store;
}

describe("todoReport completion", () => {
  it.each([
    ["polish left after one hand-off", [{ severity: "polish" as const }], undefined, true],
    ["polish the model blocked itself", [{ severity: "polish" as const, by: "model" as const }], undefined, true],
    ["blocker still there after the model had it", [{}], undefined, false],
    ["blocker the model blocked", [{ by: "model" as const }], undefined, false],
    ["blocker closed by code before the model ever received it", [{ offered: false }], undefined, true],
    ["polish only, but a function-check item is blocked", [{ severity: "polish" as const }], "gate-blocked" as const, false],
  ])("%s → complete %s", (_name, vqa, extra, complete) => {
    const report = todoReport({ store: storeWith(vqa, extra), draft: "마을을 지었습니다." });
    expect(report.complete).toBe(complete);
  });

  it("shows remaining polish and the ledger without calling them blocked", () => {
    const report = todoReport({ store: storeWith([{ severity: "polish" }]), draft: "마을을 지었습니다.", vqaLedger: ["[다듬기] 맵 «호수» — 배가 눈밭에 놓여 있다"] });
    expect(report.complete).toBe(true);
    expect(report.text).toContain("| 다듬기 남음 |");
    expect(report.text).not.toContain("| 막힘 |");
    expect(report.text).toContain("다듬기 남음 1(완료를 막지 않음)");
    expect(report.text).toContain("화면 검수 장부");
    expect(report.text).toContain("배가 눈밭에 놓여 있다");
  });

  it("counts only holding items as 막힘 in the head line", () => {
    const report = todoReport({ store: storeWith([{ severity: "polish" }, {}]), draft: "" });
    expect(report.complete).toBe(false);
    expect(report.text).toContain("막힘 1");
    expect(report.text).toContain("다듬기 남음 1");
  });
});
