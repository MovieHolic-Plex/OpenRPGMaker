// @vitest-environment happy-dom
// test/databaseAiBar.test.ts
//
// 데이터베이스 창 「AI 어시스턴트」 바의 사용 계약.
// 실측(2026-09-03)에서 예전 바는 메시지를 채팅 세션에 던진 뒤 토스트 한 줄만 남겼고, DB 창이
// 모달이라 채팅 패널이 뒤에 가려져 AI 가 실제로 몬스터 스탯을 바꿨는데도 화면에 아무 흔적이
// 없었다. 여기서 고정하는 것:
//   1. 제안 칩은 지금 보는 탭·선택 레코드에 맞춘 문장이다(범용 4개 고정 아님).
//   2. 전송 메시지는 사용자 문장 + 「[컨텍스트]」 풋터 한 줄(buildSpec 정규식 호환)이다.
//   3. 턴이 도는 동안 진행 단계·도구 결과·답변이 **바 안에** 그려지고, 끝나면 되돌리기 경로가 보인다.
//   4. 실패(설정 없음·패널 미마운트)는 토스트가 아니라 바 안의 상태줄로 남는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiBridgeAuditEntry, AiBridgeTurnResult } from "@/editor/aiAssistantBridge";
import {
  createDatabaseAiBar,
  databaseAiContextFooter,
  databaseAiSuggestions,
  summarizeDatabaseAiTurn,
  type DatabaseAiBarHandle,
} from "@/editor/panels/databaseAiBar";
import { databaseTabLabel } from "@/editor/panels/database";

type Scheduled = { fn: () => void; ms: number; cancelled: boolean };

/** 폴링을 손으로 돌리는 스케줄러 — 실제 타이머를 기다리지 않는다. */
function manualScheduler() {
  const queue: Scheduled[] = [];
  return {
    schedule: (fn: () => void, ms: number): (() => void) => {
      const entry: Scheduled = { fn, ms, cancelled: false };
      queue.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    tick(): number {
      const pending = queue.splice(0, queue.length).filter((entry) => !entry.cancelled);
      for (const entry of pending) entry.fn();
      return pending.length;
    },
    pending: () => queue.filter((entry) => !entry.cancelled).length,
  };
}

function okResult(overrides: Partial<AiBridgeTurnResult> = {}): AiBridgeTurnResult {
  return {
    ok: true,
    status: { ready: true, turnBusy: false, configReady: true, lastStatus: "대기", bridgeConnected: false, panelMounted: true },
    audit: [],
    harness: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const handles: DatabaseAiBarHandle[] = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.dispose();
  document.body.replaceChildren();
  delete (window as { __oprnDbAiLastRequest?: unknown }).__oprnDbAiLastRequest;
});

describe("databaseAiSuggestions — 탭·선택에 맞춘 제안", () => {
  it("몬스터 탭 + 선택 레코드: 점검·다듬기·비슷한 것·난이도 네 갈래를 준다", () => {
    const suggestions = databaseAiSuggestions({ tab: "enemies", record: { name: "슬라임", id: "enemy_slime" } });
    expect(suggestions.map((entry) => entry.id)).toEqual(["tune", "similar", "balance", "review"]);
    expect(suggestions.find((entry) => entry.id === "tune")?.prompt).toContain("슬라임");
    expect(suggestions.find((entry) => entry.id === "review")?.prompt).toContain("몬스터");
    expect(suggestions.length).toBeLessThanOrEqual(4);
  });

  it("레코드가 없는 탭(개요)은 레코드 제안을 빼고 프로젝트 우선순위를 준다", () => {
    const ids = databaseAiSuggestions({ tab: "overview", record: null }).map((entry) => entry.id);
    expect(ids).not.toContain("tune");
    expect(ids).not.toContain("similar");
    expect(ids).toContain("project");
  });

  it("그룹별 밸런스 제안이 다르다 — 파티는 성장 곡선, 시스템은 스위치·변수", () => {
    const party = databaseAiSuggestions({ tab: "classes", record: null }).find((entry) => entry.id === "balance");
    const system = databaseAiSuggestions({ tab: "switches", record: null }).find((entry) => entry.id === "balance");
    expect(party?.prompt).toContain("성장");
    expect(system?.prompt).toContain("스위치");
  });
});

describe("databaseAiContextFooter — 채팅 파이프라인 호환 풋터", () => {
  it("탭 라벨과 선택 레코드를 한 줄로 붙인다", () => {
    const footer = databaseAiContextFooter({ tab: "enemies", record: { name: "슬라임", id: "enemy_slime" } });
    expect(footer).toBe(`[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 ${databaseTabLabel("enemies")}, 선택 레코드: 슬라임(enemy_slime)`);
  });

  it("레코드가 없으면 탭까지만 말한다", () => {
    expect(databaseAiContextFooter({ tab: "overview", record: null }))
      .toBe("[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 개요");
  });
});

describe("summarizeDatabaseAiTurn — 감사 항목을 단계·도구·답변으로 접는다", () => {
  const tool: AiBridgeAuditEntry = { kind: "tool", name: "tune_enemy", summary: "적 '돌 골렘' 튜닝: maxHp 64→300" };
  const answer: AiBridgeAuditEntry = { kind: "assistant", text: "**최대 HP** 를 올렸습니다." };
  const noise: AiBridgeAuditEntry = { kind: "status", text: "tools:exposed 45 — author_house,…" };

  it("도구가 아직 없고 바쁘면 생각하는 중", () => {
    const summary = summarizeDatabaseAiTurn([noise], { busy: true });
    expect(summary.phase).toBe("thinking");
    expect(summary.tools).toEqual([]);
  });

  it("도구가 실행됐고 바쁘면 적용 중 + 도구 요약", () => {
    const summary = summarizeDatabaseAiTurn([noise, tool], { busy: true });
    expect(summary.phase).toBe("working");
    expect(summary.tools).toEqual(["적 '돌 골렘' 튜닝: maxHp 64→300"]);
    expect(summary.statusText).toContain("1개");
  });

  it("끝나면 완료 · 바꾼 것 개수와 마지막 답변(마크다운 강조 제거)", () => {
    const summary = summarizeDatabaseAiTurn([tool, answer], { busy: false });
    expect(summary.phase).toBe("done");
    expect(summary.statusText).toContain("바꾼 것 1개");
    expect(summary.answer).toBe("최대 HP 를 올렸습니다.");
  });

  it("변경 없이 답만 했으면 그렇게 말한다", () => {
    const summary = summarizeDatabaseAiTurn([answer], { busy: false });
    expect(summary.phase).toBe("done");
    expect(summary.statusText).toContain("변경 없음");
  });

  it("읽기 툴(도구 탐색·조회)은 바꾼 것으로 세지 않고, 실패한 쓰기는 보이되 세지 않는다", () => {
    const read: AiBridgeAuditEntry = { kind: "tool", name: "find_tools", summary: "편집기 툴 6개 발견: upsert_enemy, …", mode: "read", ok: true };
    const failed: AiBridgeAuditEntry = { kind: "tool", name: "upsert_enemy", summary: "적 수정 — id 없음", mode: "write", ok: false };
    const summary = summarizeDatabaseAiTurn([read, failed, tool], { busy: false });
    expect(summary.tools).toEqual(["실패 — 적 수정 — id 없음", "적 '돌 골렘' 튜닝: maxHp 64→300"]);
    expect(summary.changed).toBe(1);
    expect(summary.statusText).toContain("바꾼 것 1개");
    const onlyRead = summarizeDatabaseAiTurn([read, answer], { busy: false });
    expect(onlyRead.tools).toEqual([]);
    expect(onlyRead.statusText).toContain("변경 없음");
  });

  it("오류는 상태 문장 앞에 실패를 붙인다", () => {
    const summary = summarizeDatabaseAiTurn([], { busy: false, error: "AI 설정(API 키)이 필요합니다." });
    expect(summary.phase).toBe("error");
    expect(summary.statusText).toContain("AI 설정(API 키)이 필요합니다.");
  });
});

describe("createDatabaseAiBar — DOM 계약", () => {
  function mount(deps: Parameters<typeof createDatabaseAiBar>[0]["deps"], record = { name: "슬라임", id: "enemy_slime" }) {
    const handle = createDatabaseAiBar({
      context: () => ({ tab: "enemies", record }),
      deps,
    });
    handles.push(handle);
    document.body.append(handle.toggle, handle.element);
    return handle;
  }

  it("접힌 채 시작하고, 토글로 열리며 입력에 포커스가 간다", () => {
    const handle = mount({});
    expect(handle.element.hidden).toBe(true);
    expect(handle.toggle.getAttribute("aria-expanded")).toBe("false");
    handle.toggle.click();
    expect(handle.element.hidden).toBe(false);
    expect(handle.toggle.getAttribute("aria-expanded")).toBe("true");
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']");
    expect(document.activeElement).toBe(input);
    // 현재 위치 칩이 무엇을 AI 에게 알리는지 말한다.
    expect(handle.element.querySelector("[data-testid='database-ai-context']")?.textContent).toContain("몬스터");
    expect(handle.element.querySelector("[data-testid='database-ai-context']")?.textContent).toContain("슬라임");
  });

  it("제안 칩을 누르면 입력이 채워지고 바로 보내지는 않는다", () => {
    const send = vi.fn(() => Promise.resolve(okResult()));
    const handle = mount({ send });
    handle.setOpen(true);
    handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-suggestion-tune']")?.click();
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
    expect(input.value).toContain("슬라임");
    expect(send).not.toHaveBeenCalled();
  });

  it("빈 입력은 보내지 않고 포커스만 돌려준다", () => {
    const send = vi.fn(() => Promise.resolve(okResult()));
    const handle = mount({ send });
    handle.setOpen(true);
    handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")?.click();
    expect(send).not.toHaveBeenCalled();
  });

  it("보내기: 풋터가 붙은 메시지로 전송하고, 진행 → 도구 → 완료를 바 안에 그린다", async () => {
    const scheduler = manualScheduler();
    const turn = deferred<AiBridgeTurnResult>();
    const auditLog: AiBridgeAuditEntry[] = [{ kind: "user", text: "이전 턴" }];
    let busy = false;
    const send = vi.fn((text: string) => {
      busy = true;
      auditLog.push({ kind: "user", text });
      return turn.promise;
    });
    const undo = vi.fn(() => true);
    const handle = mount({
      send,
      status: () => ({ ready: true, turnBusy: busy, configReady: true, lastStatus: "", bridgeConnected: false, panelMounted: true }),
      audit: () => auditLog,
      schedule: scheduler.schedule,
      undo,
      undoLabel: () => "AI 적 튜닝",
    });
    handle.setOpen(true);
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
    const run = handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")!;
    input.value = "선택한 몬스터를 중반 난이도로 맞춰줘";
    run.click();

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0]?.[0] ?? "";
    expect(message.startsWith(`선택한 몬스터를 중반 난이도로 맞춰줘\n\n[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 ${databaseTabLabel("enemies")}`)).toBe(true);
    expect(message).toContain("선택 레코드: 슬라임(enemy_slime)");
    expect((window as { __oprnDbAiLastRequest?: { message: string } }).__oprnDbAiLastRequest?.message).toBe(message);
    // 입력은 비고 보내기는 잠긴다. 요청 원문은 턴 영역이 이어받는다.
    expect(input.value).toBe("");
    expect(run.disabled).toBe(true);
    const turnRegion = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn']")!;
    expect(turnRegion.hidden).toBe(false);
    expect(turnRegion.querySelector("[data-testid='database-ai-turn-request']")?.textContent).toContain("선택한 몬스터를 중반 난이도로 맞춰줘");
    const status = turnRegion.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
    expect(status.dataset.phase).toBe("thinking");
    expect(turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-abort']")?.hidden).toBe(false);

    // 도구가 실행되면 다음 폴링에 요약이 나타난다.
    auditLog.push({ kind: "tool", name: "tune_enemy", summary: "적 '슬라임' 튜닝: maxHp 18→120" });
    expect(scheduler.tick()).toBeGreaterThan(0);
    expect(status.dataset.phase).toBe("working");
    expect(turnRegion.querySelector("[data-testid='database-ai-turn-tools']")?.textContent).toContain("maxHp 18→120");

    // 턴 종료: 답변·완료 상태·되돌리기.
    auditLog.push({ kind: "assistant", text: "슬라임을 **중반** 난이도로 맞췄습니다." });
    busy = false;
    turn.resolve(okResult({ audit: auditLog, lastAssistantText: "슬라임을 **중반** 난이도로 맞췄습니다." }));
    await turn.promise;
    await Promise.resolve();
    expect(status.dataset.phase).toBe("done");
    expect(turnRegion.querySelector("[data-testid='database-ai-turn-answer']")?.textContent).toContain("슬라임을 중반 난이도로 맞췄습니다.");
    expect(run.disabled).toBe(false);
    expect(turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-abort']")?.hidden).toBe(true);
    const undoButton = turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-undo']")!;
    expect(undoButton.hidden).toBe(false);
    expect(undoButton.textContent).toContain("AI 적 튜닝");
    undoButton.click();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(status.textContent).toContain("되돌렸어요");
    // 폴링은 턴이 끝나면 멈춘다.
    scheduler.tick();
    expect(scheduler.pending()).toBe(0);
  });

  it("실패 결과는 바 안 상태줄에 남고 다시 보낼 수 있다", async () => {
    const scheduler = manualScheduler();
    const send = vi.fn(() => Promise.resolve(okResult({ ok: false, error: "AI 설정(API 키)이 필요합니다. 에디터 설정 모달을 확인하세요." })));
    const handle = mount({ send, schedule: scheduler.schedule, audit: () => [], status: () => okResult().status });
    handle.setOpen(true);
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
    input.value = "밸런스 봐줘";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
    expect(status.dataset.phase).toBe("error");
    expect(status.textContent).toContain("AI 설정(API 키)이 필요합니다");
    expect(handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")?.disabled).toBe(false);
  });

  it("입력에서 Escape 는 바만 접고 문서 층으로 올리지 않는다(데이터베이스 창은 그대로)", () => {
    const handle = mount({});
    handle.setOpen(true);
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
    let reachedDocument = false;
    const listener = (): void => {
      reachedDocument = true;
    };
    document.addEventListener("keydown", listener);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    document.removeEventListener("keydown", listener);
    expect(reachedDocument).toBe(false);
    expect(handle.element.hidden).toBe(true);
    expect(document.activeElement).toBe(handle.toggle);
  });

  it("닫기 버튼은 바를 접고 aria-expanded 를 맞춘다; dispose 는 폴링을 끊는다", () => {
    const scheduler = manualScheduler();
    const turn = deferred<AiBridgeTurnResult>();
    const handle = mount({
      send: () => turn.promise,
      schedule: scheduler.schedule,
      audit: () => [],
      status: () => ({ ...okResult().status, turnBusy: true }),
    });
    handle.setOpen(true);
    const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
    input.value = "x";
    handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")?.click();
    expect(scheduler.pending()).toBe(1);
    handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-close']")?.click();
    expect(handle.element.hidden).toBe(true);
    expect(handle.toggle.getAttribute("aria-expanded")).toBe("false");
    handle.dispose();
    expect(scheduler.pending()).toBe(0);
  });
});
