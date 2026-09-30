/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { showProjectInterview } from "@/editor/ui/projectInterviewDialog";
import { extractAdditionalInterviewAnswers } from "@/ai/projectInterviewAnswers";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { interviewBrief } from "./helpers/gameDesignBrief";

vi.mock("@/ai/projectInterviewAnswers", () => ({ extractAdditionalInterviewAnswers: vi.fn(async () => ({})) }));
const control = <T extends HTMLElement = HTMLButtonElement>(id: string): T => document.querySelector<T>(`[data-testid="${id}"]`)!;
afterEach(() => { document.body.replaceChildren(); resetModalStackForTest(); vi.mocked(extractAdditionalInterviewAnswers).mockReset(); vi.useRealTimers(); });

it("collects five answers and requires explicit summary confirmation", async () => {
  const done = vi.fn();
  const pending = showProjectInterview("monster-collect", { presentationDelayMs: 0 }); void pending.then(done);
  expect(control<HTMLButtonElement>("project-interview-next").disabled).toBe(true);
  for (let i = 0; i < 5; i++) {
    control(i === 0 ? "project-interview-option-3" : "project-interview-option-0").click();
    control("project-interview-next").click();
  }
  expect(done).not.toHaveBeenCalled();
  const summary = control<HTMLTextAreaElement>("project-interview-summary");
  summary.value = "포획 뒤 기억을 잃는 마을의 첫 사건까지만."; summary.dispatchEvent(new Event("input"));
  control("project-interview-confirm").click();
  const brief = await pending;
  expect(brief?.summary).toBe(summary.value);
  expect(brief?.answers.experience.text).toBe("공포");
  expect(brief?.answers.detail.question).toContain("공포");
});

it("marks a suggested answer and restores the opener when cancelled", async () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const pending = showProjectInterview("farm-life", { presentationDelayMs: 0 });
  control("project-interview-recommend").click(); control("project-interview-next").click();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(await pending).toBeNull(); expect(document.activeElement).toBe(opener);
  const completed = showProjectInterview("farm-life", { presentationDelayMs: 0 });
  control("project-interview-recommend").click(); control("project-interview-next").click();
  for (let i = 1; i < 5; i++) { control("project-interview-option-0").click(); control("project-interview-next").click(); }
  control("project-interview-confirm").click();
  expect((await completed)?.answers.experience.source).toBe("recommended");
});

it("skips explicitly answered later slots and preserves the full free answer", async () => {
  const remaining = { activity: "몬스터를 수집", progression: "마을을 조사", detail: "포획 뒤 주민의 기억이 변화", scope: "첫 포획까지만" };
  vi.mocked(extractAdditionalInterviewAnswers).mockResolvedValue(remaining);
  const pending = showProjectInterview("monster-collect", { presentationDelayMs: 0 });
  const original = "공포 속에서 몬스터를 수집하고 마을을 조사. 포획 뒤 주민의 기억이 변화. 첫 포획까지만.";
  const input = control<HTMLTextAreaElement>("project-interview-answer"); input.value = original; input.dispatchEvent(new Event("input"));
  control("project-interview-next").click();
  await vi.waitFor(() => expect(control("project-interview-confirm")).toBeTruthy());
  control("project-interview-confirm").click();
  expect((await pending)?.answers.experience.text).toBe(original);
});

it("editing a stored brief does not mutate it until confirmed", async () => {
  const original = interviewBrief(); const before = structuredClone(original);
  const pending = showProjectInterview(original.presetId, { initialBrief: original, presentationDelayMs: 0 });
  control("project-interview-edit-activity").click();
  control("project-interview-option-1").click(); control("project-interview-next").click();
  control("project-interview-cancel").click();
  expect(await pending).toBeNull(); expect(original).toEqual(before);
});


it("shows answer receipts and preparation stages before the next question", async () => {
  vi.useFakeTimers();
  const pending = showProjectInterview("monster-collect", { presentationDelayMs: 1200 });
  control("project-interview-option-3").click(); control("project-interview-next").click();
  expect(control("project-interview-receipt").textContent).toContain("공포");
  expect(control("project-interview-phase").textContent).toBe("답변을 확인하고 있어요");
  await vi.advanceTimersByTimeAsync(600);
  expect(control("project-interview-phase").textContent).toContain("기획에 담고");
  await vi.advanceTimersByTimeAsync(600);
  expect(control("project-interview-phase").textContent).toContain("다음 질문");
  await vi.advanceTimersByTimeAsync(450);
  expect(document.querySelector(".project-interview-last-receipt")?.textContent).toContain("공포");
  control("project-interview-cancel").click(); expect(await pending).toBeNull();
});

it("cancelling during the receipt clears its timers and never reopens the modal", async () => {
  vi.useFakeTimers();
  const pending = showProjectInterview("monster-collect", { presentationDelayMs: 1200 });
  control("project-interview-option-0").click(); control("project-interview-next").click();
  control("project-interview-cancel").click(); expect(await pending).toBeNull();
  await vi.advanceTimersByTimeAsync(2000);
  expect(document.querySelector('[data-testid="project-interview"]')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
