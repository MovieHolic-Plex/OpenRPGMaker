// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiBridgeAuditEntry, AiBridgeTurnResult } from "@/editor/aiAssistantBridge";
import { createDatabaseAiBar, databaseAiContextFooter, databaseAiSuggestions, summarizeDatabaseAiTurn, type DatabaseAiBarHandle } from "@/editor/panels/databaseAiBar";
import { databaseTabLabel } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { databaseRecordArtUrl, describeDatabaseChanges, describeDatabaseListChange, formatDatabaseFieldValue, renderDatabaseChangeCards } from "@/editor/panels/databaseAiChangeCards";
import { diffDatabaseRecords } from "@/project/databaseRecordDiff";
import { type AiConfig, defaultAiConfig } from "@/ai/llmClient";
import type { AiDatabaseGenerationDeps, AiDatabaseGenerationInput, AiDatabaseGenerationOutcome } from "@/editor/aiDatabaseGeneration";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { store } from "@/project/store";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

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
describe("databaseAiBar", () => {
  isolateTimers();
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

    it("보내기: 풋터가 붙은 메시지로 전송하고, 진행 → 도구 → 검토 → 적용 → 되돌리기를 한 자리에 그린다", async () => {
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
      const apply = vi.fn(() => Promise.resolve(null));
      const handle = mount({
        send,
        status: () => ({ ready: true, turnBusy: busy, configReady: true, lastStatus: "", bridgeConnected: false, panelMounted: true }),
        audit: () => auditLog,
        schedule: scheduler.schedule,
        undo,
        undoLabel: () => "AI 적 튜닝",
        apply,
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

      // 턴 종료: 세션이 초안을 넘기고(deferApply) 답변이 온다. 프로젝트는 아직 그대로 — 검토 대기.
      auditLog.push({ kind: "assistant", text: "슬라임을 **중반** 난이도로 맞췄습니다." });
      busy = false;
      const beforeProject = structuredClone(createBlankProject()) as { database: Record<string, unknown[]> } & Project;
      beforeProject.database.enemies = [...beforeProject.database.enemies, {
        id: "enemy_slime", name: "슬라임", graphicHue: 0, transparent: false, flying: false,
        stats: { maxHp: 18, maxMp: 0, attack: 5, defense: 3, mind: 1, agility: 4 },
        rewards: { exp: 3, gold: 2, dropRatePercent: 0 }, skillIds: [], actions: [], stateRates: {}, elementRates: {},
      }] as typeof beforeProject.database.enemies;
      const afterProject = structuredClone(beforeProject);
      (afterProject.database.enemies as Array<{ id: string; stats: { maxHp: number } }>).find((e) => e.id === "enemy_slime")!.stats.maxHp = 120;
      turn.resolve(okResult({
        audit: auditLog,
        lastAssistantText: "슬라임을 **중반** 난이도로 맞췄습니다.",
        pendingProposal: { callCount: 1, summary: "tune_enemy", before: beforeProject, after: afterProject },
      }));
      await turn.promise;
      for (let i = 0; i < 3; i += 1) await Promise.resolve();
      expect(status.dataset.phase).toBe("review");
      expect(turnRegion.querySelector("[data-testid='database-ai-turn-answer']")?.textContent).toContain("슬라임을 중반 난이도로 맞췄습니다.");
      expect(run.disabled).toBe(false);
      expect(turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-abort']")?.hidden).toBe(true);
      const undoButton = turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-undo']")!;
      // 검토 중에는 되돌릴 것이 없다 — 적용이 아직 안 됐다.
      expect(undoButton.hidden).toBe(true);

      // 적용 → 그때야 되돌리기가 나온다.
      turnRegion.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-apply']")!.click();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
      expect(apply).toHaveBeenCalledTimes(1);
      expect(status.dataset.phase).toBe("done");
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
  describe("createDatabaseAiBar — 검토 후 적용", () => {
    const imp = (patch: Record<string, unknown> = {}) => ({
      id: "enemy_imp", name: "임프", graphicHue: 0, transparent: false, flying: false,
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 64, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 },
      rewards: { exp: 5, gold: 3, dropRatePercent: 0 },
      skillIds: [], actions: [], stateRates: {}, elementRates: {},
      ...patch,
    });

    function projectWith(enemies: unknown[]): Project {
      const next = structuredClone(createBlankProject()) as { database: Record<string, unknown[]> } & Project;
      next.database.enemies = [...next.database.enemies, ...enemies] as typeof next.database.enemies;
      return next;
    }

    const pendingProposal = () => ({
      callCount: 1,
      summary: "tune_enemy",
      before: projectWith([imp()]),
      after: projectWith([imp({ stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 } })]),
    });

    function mountReview(extra: Parameters<typeof createDatabaseAiBar>[0]["deps"] = {}) {
      const handle = createDatabaseAiBar({
        context: () => ({ tab: "enemies", record: { name: "임프", id: "enemy_imp" } }),
        deps: {
          send: () => Promise.resolve(okResult({ pendingProposal: pendingProposal() })),
          status: () => okResult().status,
          audit: () => [],
          schedule: () => () => undefined,
          ...extra,
        },
      });
      handles.push(handle);
      document.body.append(handle.toggle, handle.element);
      return handle;
    }

    async function runTurn(handle: DatabaseAiBarHandle): Promise<void> {
      handle.setOpen(true);
      const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
      input.value = "임프를 중반 난이도로";
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")!.click();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    }

    it("deferApply 로 보내고, 초안이 오면 카드를 그리며 아직 적용되지 않았다고 말한다", async () => {
      const send = vi.fn((_text: string, _options?: { readonly deferApply?: boolean }) =>
        Promise.resolve(okResult({ pendingProposal: pendingProposal() })));
      const handle = mountReview({ send });
      await runTurn(handle);

      expect(send.mock.calls[0]?.[1]).toEqual({ deferApply: true });
      const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
      expect(status.dataset.phase).toBe("review");
      expect(status.textContent).toContain("검토 대기");
      expect(status.textContent).toContain("아직 프로젝트에 적용되지 않았습니다");

      const cards = handle.element.querySelectorAll("[data-testid='database-ai-card']");
      expect(cards).toHaveLength(1);
      expect(handle.element.querySelector("[data-path='stats.maxHp'] .database-ai-card-after")?.textContent).toBe("300");
      expect(handle.element.querySelector("[data-testid='database-ai-card-delta']")?.textContent).toBe("+236");

      // 검토 중에는 결정 단추만 보이고 되돌리기·입력은 숨는다 — 되돌릴 것이 아직 없다.
      expect(handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-apply']")!.hidden).toBe(false);
      expect(handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-discard']")!.hidden).toBe(false);
      expect(handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-undo']")!.hidden).toBe(true);
      expect(handle.element.querySelector<HTMLElement>(".database-ai-composer")!.hidden).toBe(true);
      expect(handle.element.querySelector("[data-testid='database-ai-turn-apply'] .database-ai-turn-action-label")?.textContent).toBe("적용 1건");
    });

    it("적용은 브리지 apply 를 부르고 영수증·되돌리기로 넘어간다", async () => {
      const apply = vi.fn(() => Promise.resolve(null));
      const handle = mountReview({ apply, undoLabel: () => "AI 적 튀닝" });
      await runTurn(handle);
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-apply']")!.click();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      expect(apply).toHaveBeenCalledTimes(1);
      const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
      expect(status.dataset.phase).toBe("done");
      expect(status.textContent).toContain("적용됐어요");
      // 적용 뒤에도 카드는 남고 카드마다 되돌리기를 단다.
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card']")).toHaveLength(1);
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card-revert']")).toHaveLength(1);
      const undoButton = handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-undo']")!;
      expect(undoButton.hidden).toBe(false);
      expect(undoButton.textContent).toContain("AI 적 튀닝");
    });

    it("카드별로 골라 적용하고, 뺀 카드는 AI 전으로 남기며, 적용 뒤 한 장만 되돌린다", async () => {
      const before = projectWith([imp(), imp({ id: "enemy_bat", name: "박쥐" })]);
      const after = projectWith([
        imp({ stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 } }),
        imp({ id: "enemy_bat", name: "박쥐", stats: { maxHp: 90, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 } }),
      ]);
      let current: Project = before;
      const commits: { label: string; joinPrevious: boolean }[] = [];
      const handle = mountReview({
        send: () => Promise.resolve(okResult({ pendingProposal: { callCount: 2, summary: "tune_enemy", before, after } })),
        apply: () => { current = after; return Promise.resolve(null); },
        readProject: () => current,
        commitRecords: (project, label, options) => { current = project; commits.push({ label, joinPrevious: options.joinPrevious }); return true; },
      });
      await runTurn(handle);
      const hpOf = (id: string) => (current.database.enemies.find((enemy) => enemy.id === id) as { stats: { maxHp: number } }).stats.maxHp;

      const picks = handle.element.querySelectorAll<HTMLInputElement>("[data-testid='database-ai-card-pick']");
      expect(picks).toHaveLength(2);
      const label = () => handle.element.querySelector("[data-testid='database-ai-turn-apply'] .database-ai-turn-action-label")?.textContent;
      expect(label()).toBe("적용 2건");
      picks[1]!.checked = false;
      picks[1]!.dispatchEvent(new Event("change"));
      expect(label()).toBe("고른 1건 적용");

      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-apply']")!.click();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
      expect(hpOf("enemy_imp")).toBe(300);
      expect(hpOf("enemy_bat")).toBe(64);
      expect(commits).toEqual([{ label: "AI 변경 1건 빼기", joinPrevious: true }]);
      expect(handle.element.querySelector("[data-testid='database-ai-turn-status']")?.textContent).toContain("뺀 1건은 그대로");

      const reverts = handle.element.querySelectorAll<HTMLButtonElement>("[data-testid='database-ai-card-revert']");
      expect(reverts).toHaveLength(1);
      reverts[0]!.click();
      expect(hpOf("enemy_imp")).toBe(64);
      expect(commits.at(-1)).toEqual({ label: "AI 변경 되돌리기 · 임프", joinPrevious: false });
      expect([...handle.element.querySelectorAll("[data-testid='database-ai-card-state']")].map((node) => node.textContent)).toEqual(["되돌림", "뺀"]);
    });

    it("적용 실패 사유는 상태줄에 남기고 카드를 지우지 않는다", async () => {
      const apply = vi.fn(() => Promise.resolve("기준 프로젝트가 바뀜습니다."));
      const handle = mountReview({ apply });
      await runTurn(handle);
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-apply']")!.click();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
      expect(status.dataset.phase).toBe("error");
      expect(status.textContent).toContain("기준 프로젝트가 바뀜습니다");
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card']")).toHaveLength(1);
    });

    it("버리기는 브리지 discard 를 부르고 카드를 치우며 프로젝트는 그대로라고 말한다", async () => {
      const discard = vi.fn();
      const handle = mountReview({ discard });
      await runTurn(handle);
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-discard']")!.click();

      expect(discard).toHaveBeenCalledTimes(1);
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card']")).toHaveLength(0);
      const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
      expect(status.textContent).toContain("프로젝트는 그대로입니다");
      expect(handle.element.querySelector<HTMLElement>(".database-ai-composer")!.hidden).toBe(false);
    });

    it("초안이 넘어오지 않은 검토 턴은 쓰기 툴이 돌았어도 ‘반영됐다’고 말하지 않고 되돌리기도 숨긴다", async () => {
      // 실측 2026-09-15 라이브: tune_enemy 등 3개가 돌고 턴이 max-tool-calls 로 끝나 초안이 검수 미완료로 버려졌다.
      // 예전 판정은 저장소가 그대로인데 「완료 · 바꾼 것 3개 — 화면에 바로 반영됐어요」라고 했다.
      const audit: AiBridgeAuditEntry[] = [
        { kind: "tool", name: "tune_enemy", summary: "슬라임 maxHp 78→300", mode: "write", ok: true },
        { kind: "tool", name: "tune_enemy", summary: "슬라임 exp 32→40", mode: "write", ok: true },
      ];
      const handle = mountReview({
        send: () => Promise.resolve(okResult({
          audit,
          pendingProposal: null,
          runOutcome: { execution: "budget-exhausted", goal: "incomplete", delivery: "draft", imageAttached: false } as never,
          status: { ready: true, turnBusy: false, configReady: true, lastStatus: "검수 미완료", bridgeConnected: false, panelMounted: true },
        })),
        undoLabel: () => "AI 적 튀닝",
      });
      await runTurn(handle);

      const status = handle.element.querySelector<HTMLElement>("[data-testid='database-ai-turn-status']")!;
      expect(status.dataset.phase).toBe("error");
      expect(status.textContent).toContain("프로젝트는 그대로입니다");
      expect(status.textContent).toContain("예산");
      expect(status.textContent).not.toContain("반영됐어요");
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card']")).toHaveLength(0);
      // 적용된 것이 없으니 되돌릴 것도 없다 — 쓰기 툴 개수로 되돌리기를 내주면 엉뚱한 이전 편집을 되돌린다.
      expect(handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-turn-undo']")!.hidden).toBe(true);
      // 바꾼 것 목록은 보여 준다 — 무엇을 하려 했는지는 사용자가 알아야 한다.
      expect(handle.element.querySelector("[data-testid='database-ai-turn-tools']")?.textContent).toContain("78→300");
    });

    it("검토가 걸려 있는 동안에는 새 요청을 보내지 않는다", async () => {
      const send = vi.fn((_text: string, _options?: { readonly deferApply?: boolean }) =>
        Promise.resolve(okResult({ pendingProposal: pendingProposal() })));
      const handle = mountReview({ send });
      await runTurn(handle);
      const input = handle.element.querySelector<HTMLInputElement>("[data-testid='database-ai-input']")!;
      input.value = "하나 더";
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-run']")!.click();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("카드의 「이동」은 navigate 를 부르고 오버레이를 접는다(검토 상태는 유지)", async () => {
      const navigate = vi.fn();
      const handle = mountReview({ navigate });
      await runTurn(handle);
      handle.element.querySelector<HTMLButtonElement>("[data-testid='database-ai-card-goto']")!.click();

      expect(navigate).toHaveBeenCalledWith("enemies", "enemy_imp");
      expect(handle.element.hidden).toBe(true);
      handle.setOpen(true);
      expect(handle.element.querySelectorAll("[data-testid='database-ai-card']")).toHaveLength(1);
    });
  });
});

describe("databaseAiChangeCards", () => {
  isolateTimers();
  type Mutable<T> = { -readonly [K in keyof T]: T[K] };
  const BASE = createBlankProject();
  function project(records: Record<string, unknown[]>): Project {
    const next = structuredClone(BASE) as Mutable<Project>;
    const database = next.database as unknown as Record<string, unknown[]>;
    for (const [collection, list] of Object.entries(records)) {
      database[collection] = [...(database[collection] ?? []), ...list];
    }
    return next;
  }
  const imp = (patch: Record<string, unknown> = {}) => ({
    id: "enemy_imp", name: "임프", graphicHue: 0, transparent: false, flying: false,
    monsterResourceId: "generated-enemy-slime-01",
    stats: { maxHp: 64, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 },
    rewards: { exp: 5, gold: 3, dropRatePercent: 0 },
    skillIds: [], actions: [], stateRates: {}, elementRates: {},
    ...patch,
  });
  describe("renderDatabaseChangeCards — 레코드 카드", () => {
    it("변경 카드는 그림·이름·id·동사·필드 before→after·델타·이동 단추를 그린다", () => {
      const before = project({ enemies: [imp()] });
      const after = project({
        enemies: [imp({ stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 }, rewards: { exp: 40, gold: 3, dropRatePercent: 5, dropItemId: "item_sword" } })],
        items: [{ id: "item_sword", name: "동검", price: 120 }],
      });
      const onNavigate = vi.fn();
      const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after, onNavigate });
      document.body.append(list);

      const cards = list.querySelectorAll("[data-testid='database-ai-card']");
      expect(cards).toHaveLength(2);
      const impCard = list.querySelector<HTMLElement>("[data-record-id='enemy_imp']")!;
      expect(impCard.dataset.change).toBe("changed");
      expect(impCard.dataset.collection).toBe("enemies");
      expect(impCard.querySelector(".database-ai-card-name")?.textContent).toBe("임프");
      expect(impCard.querySelector(".database-ai-card-id")?.textContent).toBe("#enemy_imp");
      expect(impCard.querySelector(".database-ai-card-verb")?.textContent).toBe("변경");
      expect(impCard.querySelector(".database-ai-card-thumb img")).not.toBeNull();

      const hp = impCard.querySelector<HTMLElement>("[data-path='stats.maxHp']")!;
      expect(hp.querySelector(".database-ai-card-key")?.textContent).toBe("최대 HP");
      expect(hp.querySelector(".database-ai-card-before")?.textContent).toBe("64");
      expect(hp.querySelector(".database-ai-card-after")?.textContent).toBe("300");
      expect(hp.querySelector("[data-testid='database-ai-card-delta']")?.textContent).toBe("+236");
      expect(hp.querySelector(".database-ai-card-delta")?.classList.contains("is-up")).toBe(true);

      const drop = impCard.querySelector<HTMLElement>("[data-path='rewards.dropItemId']")!;
      expect(drop.querySelector(".database-ai-card-before")?.textContent).toBe("없음");
      expect(drop.querySelector(".database-ai-card-after")?.textContent).toBe("동검");
      expect(drop.querySelector("[data-testid='database-ai-card-delta']")).toBeNull();

      impCard.querySelector<HTMLButtonElement>("[data-testid='database-ai-card-goto']")!.click();
      expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ collection: "enemies", id: "enemy_imp" }));

      const swordCard = list.querySelector<HTMLElement>("[data-record-id='item_sword']")!;
      expect(swordCard.dataset.change).toBe("added");
      expect(swordCard.querySelector(".database-ai-card-verb")?.textContent).toBe("추가");
      // 아직 없는 레코드로는 이동할 수 없다 — 선택이 첫 레코드로 미끄러졌던 자리.
      expect(swordCard.querySelector("[data-testid='database-ai-card-goto']")).toBeNull();
      expect(swordCard.querySelector(".database-ai-card-before")).toBeNull();
      expect(swordCard.querySelector("[data-path='price'] .database-ai-card-after")?.textContent).toBe("120");
    });

    it("그림 필드가 바뀌면 지금/적용 후 두 장을 그린다", () => {
      const before = project({ enemies: [imp()] });
      const after = project({ enemies: [imp({ monsterResourceId: "generated-enemy-bat-01" })] });
      const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
      const pair = list.querySelector<HTMLElement>("[data-testid='database-ai-card-gfx']")!;
      expect(pair.dataset.path).toBe("monsterResourceId");
      const cells = pair.querySelectorAll(".database-ai-card-gfx-cell");
      expect(cells).toHaveLength(2);
      expect(cells[1]?.classList.contains("is-after")).toBe(true);
      expect(pair.textContent).toContain("지금");
      expect(pair.textContent).toContain("적용 후");
      expect(list.querySelector("[data-path='monsterResourceId'].database-ai-card-field")).toBeNull();
      expect(list.querySelector("[data-testid='database-ai-card-goto']")).toBeNull();
    });

    it("삭제 카드는 그림 없이 슬림하게 신원과 안내만 남긴다", () => {
      const before = project({ skills: [{ id: "skill_fog", name: "독 안개", mpCost: 6 }] });
      const after = project({});
      const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
      const card = list.querySelector<HTMLElement>("[data-testid='database-ai-card']")!;
      expect(card.classList.contains("is-slim")).toBe(true);
      expect(card.querySelector(".database-ai-card-thumb")).toBeNull();
      expect(card.querySelector(".database-ai-card-verb")?.textContent).toBe("삭제");
      expect(card.querySelector(".database-ai-card-note")?.textContent).toContain("삭제");
    });

    it("그림이 없는 레코드는 이름 첫 글자 배지를 쓴다", () => {
      const before = project({ skills: [{ id: "skill_a", name: "가시 찌르기", mpCost: 4 }] });
      const after = project({ skills: [{ id: "skill_a", name: "가시 찌르기", mpCost: 6 }] });
      const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
      expect(list.querySelector(".database-ai-card-thumb .database-ai-card-initial")?.textContent).toBe("가");
      expect(databaseRecordArtUrl(after, "skills", { id: "skill_a" })).toBeNull();
    });

    it("값 표기와 상태줄 요약", () => {
      const after = project({ items: [{ id: "item_sword", name: "동검", price: 120 }] });
      expect(formatDatabaseFieldValue(after, undefined)).toBe("없음");
      expect(formatDatabaseFieldValue(after, true)).toBe("켜짐");
      expect(formatDatabaseFieldValue(after, "item_sword")).toBe("동검");
      expect(formatDatabaseFieldValue(after, 42)).toBe("42");
      const changes = diffDatabaseRecords(project({ enemies: [imp()], skills: [{ id: "s", name: "s" }] }), project({ enemies: [imp({ level: 3 })], items: [{ id: "i", name: "i" }] }));
      expect(changes.map((change) => change.id).sort()).toEqual(["enemy_imp", "i", "s"]);
      expect(describeDatabaseChanges(changes)).toBe("바꾼 레코드 1 · 추가 1 · 삭제 1");
      expect(describeDatabaseChanges([])).toBe("바뀐 레코드 없음");
      expect(formatDatabaseFieldValue(after, "allEnemies", "scope")).toBe("적 전체");
      expect(formatDatabaseFieldValue(after, "battle", "occasion")).toBe("전투 중");
      expect(formatDatabaseFieldValue(after, "normal", "type")).toBe("일반");
    });

    it("목록 필드는 잘린 id 나열이 아니라 더한 것·뺀 것을 이름으로 말한다", () => {
      const skills = [
        { id: "skill_slash", name: "베기" },
        { id: "skill_guard", name: "수비" },
      ];
      const before = project({ skills, enemies: [imp({ skillIds: ["skill_slash", "skill_guard"] })] });
      const after = project({
        skills: [...skills, { id: "skill_dark_wave", name: "암흑 파동" }],
        enemies: [imp({ skillIds: ["skill_slash", "skill_dark_wave"] })],
      });
      expect(describeDatabaseListChange(["skill_slash", "skill_guard"], ["skill_slash", "skill_dark_wave"], { before, after })).toEqual({
        beforeCount: 2, afterCount: 2, added: ["암흑 파동"], removed: ["수비"],
      });
      const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
      const row = list.querySelector<HTMLElement>("[data-record-id='enemy_imp'] [data-path='skillIds']")!;
      expect([...row.querySelectorAll("[data-testid='database-ai-card-list-added']")].map((node) => node.textContent)).toEqual(["+ 암흑 파동"]);
      expect([...row.querySelectorAll("[data-testid='database-ai-card-list-removed']")].map((node) => node.textContent)).toEqual(["− 수비"]);
      expect(row.textContent).not.toContain("skill_");
      expect(describeDatabaseListChange([{ skillId: "skill_slash", level: 1 }], [{ skillId: "skill_slash", level: 1 }, { skillId: "skill_dark_wave", level: 5 }], { before, after })?.added).toEqual(["암흑 파동 (Lv5)"]);
      expect(describeDatabaseListChange(3, 4, { before, after })).toBeNull();
    });
  });
});

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
describe("databaseAiGenerateDialog", () => {
  isolateTimers();
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
        deps: { loadConfig: () => ({ ...config(), providerId: "openai-codex", imageProviderId: "google-antigravity" }) },
      });
      expect(overlay.querySelector("[data-testid='db-ai-generate-provider-notice']")?.textContent).toContain("google-antigravity");
    });
  });
});

describe("databaseAiGenerateProviderNotice", () => {
  isolateTimers();
  afterEach(() => { resetModalStackForTest(); document.body.replaceChildren(); });
  describe("database image provider notice", () => {
    it.each([
      { providerId: "google-antigravity", imageProviderId: "openai-codex", expected: ["openai-codex", "google-antigravity"] },
      // da29a9f402: 저장된 그림 제공자가 없으면 기본은 ChatGPT(openai-codex)다 — 대화가 Google 이면 그 차이를 적는다.
      { providerId: "google-antigravity", imageProviderId: undefined, expected: ["openai-codex", "google-antigravity"] },
      { providerId: "openai-codex", imageProviderId: "google-antigravity", expected: ["google-antigravity", "openai-codex"] },
    ])("renders selected image provider before chat provider: $providerId / $imageProviderId", ({ providerId, imageProviderId, expected }) => {
      const overlay = openDatabaseAiGenerateDialog({
        kind: "item", rerender: () => undefined,
        deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId, imageProviderId }) },
      });
      const notice = overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]');
      expect(notice?.textContent?.match(/google-antigravity|openai-codex/g)).toEqual(expected);
    });

    it("omits the notice when no image provider is stored and chat already uses the default ChatGPT route", () => {
      const overlay = openDatabaseAiGenerateDialog({
        kind: "item", rerender: () => undefined,
        deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId: "openai-codex", imageProviderId: undefined }) },
      });
      expect(overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]')).toBeNull();
    });

    it("omits the other-provider notice when the selected providers agree", () => {
      const overlay = openDatabaseAiGenerateDialog({
        kind: "item", rerender: () => undefined,
        deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId: "openai-codex", imageProviderId: "openai-codex" }) },
      });
      expect(overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]')).toBeNull();
    });
  });
});
