// @vitest-environment happy-dom
// ☰ 「사용 로그 내려받기」 계약: 텍스트 서식 + 두 표면의 항목 + 빈 로그일 때 파일을 만들지 않음.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formatAiActivityLogText, aiActivityLogTextFileName } from "@/ai/activityLogText";
import type { AiActivityLogRecord } from "@/ai/activityLogTypes";
import { downloadAiUsageLogText } from "@/editor/panels/aiUsageLogDownload";
import { createAiActionMenuItems } from "@/editor/panels/aiActionMenu";

/** src/ai/activityLog.ts 의 저장 키. 로그를 심는 것이 목적이라 기록 API 를 태우지 않는다. */
const ACTIVITY_STORAGE_KEY = "oprn:ai-activity-logs";

const RECORD: AiActivityLogRecord = {
  id: "rec-1",
  runId: "run-9",
  at: "2026-09-09T01:02:03.000Z",
  channel: "chat",
  model: "gemini-3-pro",
  liteModel: "gemini-3-flash",
  instruction: "마을 광장에\n분수를 놓아줘",
  mapId: "map-1",
  mapName: "마을",
  region: { x: 2, y: 3, width: 4, height: 5 },
  result: {
    ok: true,
    applied: true,
    changedCells: 12,
    changedEvents: 1,
    assistantText: "분수를 놓았습니다.",
    commitIds: ["commit-a"],
    recap: {
      elapsedMs: 3200,
      promptTokens: 1200,
      completionTokens: 340,
      llmCalls: 2,
      toolCalls: 1,
      ralphContinues: 0,
      volumeContinues: 0,
      process: [],
    },
  },
  toolCalls: [{ name: "place_tiles", args: { x: 2, y: 3 }, ok: true, summary: "12칸 배치" }],
  audit: [
    { kind: "user", text: "마을 광장에 분수를 놓아줘", at: "2026-09-09T01:02:00.000Z" },
    { kind: "tool", name: "place_tiles", args: { x: 2 }, ok: false, summary: "실패", reason: "좌표가 맵 밖" },
    { kind: "status", text: "턴 종료" },
  ],
  diagnostics: { severity: "warning", kinds: ["tool-failure"], messages: ["도구 1건 실패"], failedTools: ["place_tiles"] },
  index: { toolNames: [], failedToolNames: [], auditKinds: [], commitIds: [], uiActions: [], mapIds: [] },
  truncated: { audit: 3 },
  persisted: "both",
};

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

// 실측(2026-09-17 조수 로그 100건): Pi 18턴 중 6턴이 머리말과 적용 결과가 어긋났다. 「실패」인데
// 적용된 반쯤 적용 상태와 「성공」인데 검토 대기인 상태는 다음에 할 일이 정반대인데(되돌리기 ↔ 검토),
// 머리말만 보고는 구분이 안 됐다. 어긋날 때만 괄호로 사실을 덧붙인다.
it("머리말은 적용 결과와 어긋날 때 그 사실을 함께 말한다", () => {
  const headline = (over: Partial<AiActivityLogRecord["result"]>): string => {
    const text = formatAiActivityLogText([{ ...RECORD, result: { ...RECORD.result, ...over } }], { at: new Date() });
    return text.split("\n").find((line) => line.startsWith("[1] ")) ?? "";
  };

  expect(headline({ ok: true, applied: true })).toContain("· 성공");
  expect(headline({ ok: true, applied: true })).not.toContain("성공(");
  // 검토 대기 — 붙지 않았는데 「성공」만 보이면 사용자가 끝난 줄 안다.
  expect(headline({ ok: true, applied: false })).toContain("· 성공(적용 안 됨)");
  // 반쯤 적용 — 「실패」만 보이면 되돌릴 것이 남은 줄 모른다.
  expect(headline({ ok: false, applied: true })).toContain("· 실패(부분 적용)");
  expect(headline({ ok: false, applied: false })).toContain("· 실패");
  expect(headline({ ok: false, applied: false })).not.toContain("실패(");
  // 적용 여부를 모르는 기록(화면 조작 등)은 예전 그대로 한 낱말이다.
  expect(headline({ ok: true, applied: undefined })).toContain("· 성공");
  expect(headline({ ok: true, applied: undefined })).not.toContain("성공(");
});

it("한 턴을 사람이 읽는 텍스트로 옮긴다 — 지시·결과·도구·대화 기록·잘림이 모두 남는다", () => {
  const text = formatAiActivityLogText([RECORD], { at: new Date("2026-09-09T02:00:00.000Z") });

  expect(text).toContain("AI 조수 사용 로그");
  expect(text).toContain("내려받은 시각: 2026-09-09T02:00:00.000Z");
  expect(text).toContain("기록: 1건 (최신 순)");
  expect(text).toContain("[1] 2026-09-09T01:02:03.000Z · 대화 · 성공");
  expect(text).toContain("모델: gemini-3-pro (보조 gemini-3-flash)");
  expect(text).toContain("맵: 마을 (map-1)");
  expect(text).toContain("영역: (2, 3) 크기 4×5");
  // 여러 줄 지시는 한 줄로 이어 붙이지 않는다.
  expect(text).toContain("지시:\n  마을 광장에\n  분수를 놓아줘");
  expect(text).toContain("결과 상세: 적용됨 · 셀 12칸 · 이벤트 1건");
  expect(text).toContain("자원: 3.2초 · LLM 2회 · 도구 1회 · 토큰 1200/340");
  expect(text).toContain("커밋: commit-a");
  expect(text).toContain("진단: 경고 · tool-failure · 실패 도구 place_tiles");
  expect(text).toContain("1. [ok] place_tiles — 12칸 배치");
  expect(text).toContain("조수 응답: 분수를 놓았습니다.");
  expect(text).toContain("[사용자]");
  expect(text).toContain("[도구 실패] place_tiles — 실패");
  expect(text).toContain("사유: 좌표가 맵 밖");
  expect(text).toContain("[상태]: 턴 종료");
  expect(text).toContain("잘린 기록: 대화 기록 3건");
  expect(text).toContain("기록 id: rec-1");
  expect(text.endsWith("\n")).toBe(true);
});

it("파일 이름은 콜론·점 없이 시각을 담는다(윈도 파일명 제약)", () => {
  const name = aiActivityLogTextFileName(new Date("2026-09-09T02:03:04.500Z"));
  expect(name).toBe("ai-usage-log-2026-09-09T02-03-04-500Z.txt");
  expect(name).not.toMatch(/[:.](?!txt)/u);
});

it("기록이 있으면 txt 를 내려받는다", async () => {
  // listAiActivityLogs 가 실제로 읽는 자리에 직접 넣는다 — recordAiActivity 는 원격 미러
  // fetch 를 띄우므로 이 계약(로그 → 파일)과 무관한 실패를 끌고 온다.
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([RECORD]));
  const blobs: { name: string }[] = [];
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stub");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(this: HTMLAnchorElement) {
    blobs.push({ name: this.download });
  });

  expect(downloadAiUsageLogText()).toBe(true);
  expect(blobs).toHaveLength(1);
  expect(blobs[0]?.name).toMatch(/^ai-usage-log-.*\.txt$/u);
  const saved = createUrl.mock.calls[0]?.[0];
  if (!(saved instanceof Blob)) throw new Error("Blob 이 만들어지지 않았다");
  expect(saved.type).toBe("text/plain;charset=utf-8");
  await expect(saved.text()).resolves.toContain("분수를 놓아줘");
});

it("기록이 없으면 빈 파일을 떨어뜨리지 않는다", () => {
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stub");
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  expect(downloadAiUsageLogText()).toBe(false);
  expect(createUrl).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});

it("두 ☰ 표면 모두에 항목이 있고, 누르면 메뉴를 닫고 내려받기를 부른다", () => {
  for (const [variant, testid] of [["header", "ai-more-usage-log"], ["composer", "ai-command-menu-usage-log"]] as const) {
    const calls: string[] = [];
    const menu = createAiActionMenuItems({
      variant,
      close: () => calls.push("close"),
      actions: {
        exportAudit: () => undefined,
        downloadUsageLog: () => calls.push("download"),
        openHistory: () => undefined,
        openTools: () => undefined,
        openInstructions: () => undefined,
        compactContext: () => undefined,
        openSettings: () => undefined,
      },
    });
    const item = menu.items.find((button) => button.dataset.testid === testid);
    if (!item) throw new Error(`${variant} 표면에 ${testid} 항목이 없다`);
    expect(item.textContent).toContain("사용 로그 내려받기");
    item.click();
    expect(calls).toEqual(["close", "download"]);
  }
});
