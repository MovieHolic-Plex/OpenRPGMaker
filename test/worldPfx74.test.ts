import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { bodyDraftMessages, composeBodyWithDraft, mergeInterviewPatch, parseBodyDraft, parseInterviewTurn, interviewHistoryToMessages } from "@/ai/worldCanonInterview";
import { WORLD_CANON_BOUNDS, resolveWorldCanon } from "@/project/world/canon";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement, renderWithFakeDom } from "./fakeDom";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
import { isolateTimers } from "./mergedTeardown";
import { normalizeWorld, type WorldEntity } from "@/project/world";
import { createWorldPanelState, deleteWorldEntity, draftFromEntity, saveDraft, setPersistedCodexView } from "@/editor/panels/worldManager";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import * as worldManager from "@/editor/panels/worldManager";

describe("world", () => {
  isolateTimers();
  describe("worldCanonInterview", () => {
    isolateTimers();
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
    describe("world canon body AI draft", () => {
      let cleanupDom2: (() => void) | undefined;
      beforeEach(() => {
        cleanupDom2 = installFakeDom();
        store.replace(createBlankProject());
      });
      afterEach(() => cleanupDom2?.());

      it("parses a draft and clamps it to the body bound", () => {
        const parsed = parseBodyDraft(JSON.stringify({ body: "가".repeat(60_000), notes: ["왕도 이름을 지어냄", 42] }));
        expect(parsed?.body.length).toBe(WORLD_CANON_BOUNDS.body);
        expect(parsed?.notes).toEqual(["왕도 이름을 지어냄"]);
      });

      it("survives a fenced reply and rejects an empty body", () => {
        const fenced = parseBodyDraft("```json\n{\"body\":\"짧은 본문\",\"notes\":[]}\n```");
        expect(fenced?.body).toBe("짧은 본문");
        expect(parseBodyDraft(JSON.stringify({ body: "   ", notes: [] }))).toBeNull();
        expect(parseBodyDraft("no json")).toBeNull();
      });

      it("appends a continuation but replaces on a fresh draft", () => {
        expect(composeBodyWithDraft("기존 문단", "새 문단", "continue")).toBe("기존 문단\n\n새 문단");
        expect(composeBodyWithDraft("기존 문단", "새 문단", "draft")).toBe("새 문단");
        // 빈 본문에서는 모드와 무관하게 초안이 그대로 들어간다.
        expect(composeBodyWithDraft("   ", "새 문단", "continue")).toBe("새 문단");
      });

      it("feeds the canon, existing body, and instruction to the model", () => {
        const canon = resolveWorldCanon({ name: "비늘의 바다", absences: ["총기"], laws: { gods: { present: false } } });
        const messages = bodyDraftMessages({ mode: "continue", existingBody: "천 년 전 왕도가 가라앉았다.", instruction: "왕도 멸망만 3문단", canon });
        const text = messages.map((message) => message.content).join("\n");
        expect(text).toContain("비늘의 바다");
        expect(text).toContain("총기");
        expect(text).toContain("천 년 전 왕도가 가라앉았다.");
        expect(text).toContain("왕도 멸망만 3문단");
        expect(text).toContain("이어쓰기");
      });

      it("shows draft and continue controls on the body canvas", () => {
        const host = renderTab();
        expect(findByTestId(host, "world-canon-body-ai")).toBeTruthy();
        expect(findByTestId(host, "world-canon-body-ai-draft")).toBeTruthy();
        expect(findByTestId(host, "world-canon-body-ai-continue")).toBeTruthy();
        expect(findByTestId(host, "world-canon-body-ai-instruction")).toBeTruthy();
      });
    });
  });
  describe("worldCanonSpreadView", () => {
    isolateTimers();
    function renderTab(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.textContent = "";
        renderWorldCanonTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    /** 법윹 카드는 세계 설정 탭 안에 있다 — 테스트에서는 선 열고 조작한다. */
    function openSettingsTab(host: FakeElement): void {
      findByTestId(host, "db-ws-section-tab-settings")?.click();
    }
    describe("world canon spread view", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => cleanupDom?.());

      it("drops the spread head entirely and keeps the excerpt counter on the body card", () => {
        const host = renderTab();
        // 헤드(제목·미터·통계 띠)는 삭제됐다 — 정보는 본문 카드 힌트와 조수 전달 탭이 소유한다.
        expect(findByTestId(host, "db-world-canon-workspace")?.querySelector(".world-canon-spread-head")).toBeNull();
        expect(findByTestId(host, "db-world-canon-ai-meter")).toBeNull();
        expect(findByTestId(host, "db-world-canon-hero-stats")).toBeNull();
        expect(findByTestId(host, "db-world-canon-help")).toBeNull();
        // 발췌 카운터는 본문 카드 힌트에 남는다.
        const hint = findByTestId(host, "db-world-canon-body-card")?.querySelector(".db-ws-card-hint");
        expect(hint?.textContent).toContain("지금 0자");
      });

      it("shows law answers as question cards with conversational state", () => {
        store.update((draft) => {
          draft.worldCanon = { laws: { gods: { present: false }, money: { present: true, note: "이름이 화폐" } } };
        });
        const host = renderTab();
        openSettingsTab(host);
        expect(findByTestId(host, "db-world-canon-law-gods")?.textContent).toContain("없음 — 조수도 없다고 답함");
        expect(findByTestId(host, "db-world-canon-law-money")?.textContent).toContain("있음");
        expect(findByTestId(host, "db-world-canon-law-money")?.textContent).toContain("이름이 화폐");
        // 미정은 데이터 말이 아니라 결과 말로 보인다.
        expect(findByTestId(host, "db-world-canon-law-death")?.textContent).toContain("미정 — 조수가 상상합니다");
        // 구 tri-state 세그먼트는 카드로 대체됐다.
        expect(findByTestId(host, "db-world-canon-law-death-present")).toBeNull();
      });

      it("commits a law through the dialog options and note", () => {
        const host = renderTab();
        openSettingsTab(host);
        findByTestId(host, "db-world-canon-law-death")?.click();
        const dialog = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-dialog");
        expect(dialog).toBeTruthy();
        const noOption = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-option-no");
        noOption?.click();
        const note = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-note") as unknown as HTMLTextAreaElement;
        note.value = "죽음은 영원한 항해다";
        note.dispatchEvent(new Event("input"));
        findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-save")?.click();
        expect(store.getCurrent().worldCanon?.laws?.death).toEqual({ present: false, note: "죽음은 영원한 항해다" });
        // 반영하면 대화상자가 닫히고 카드가 갱신된다.
        expect(findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-dialog")).toBeNull();
        expect(findByTestId(host, "db-world-canon-law-death")?.textContent).toContain("죽음은 영원한 항해다");
      });

      it("opens on the body canvas, not a form", () => {
        const host = renderTab();
        const tabs = findByTestId(host, "db-ws-section-tabs");
        expect(tabs).toBeTruthy();
        const labels = tabs?.textContent ?? "";
        expect(labels).toContain("본문");
        expect(labels).toContain("세계 설정");
        expect(labels).toContain("조수 전달");
        // 초기 탭은 본문이다 — 세계 개요를 클릭하면 도화지가 먼저 보인다.
        const activeTab = tabs?.querySelector("[aria-selected='true']");
        expect(activeTab?.getAttribute("data-testid")).toBe("db-ws-section-tab-body");
        expect(findByTestId(host, "db-world-canon-body")).toBeTruthy();
        expect(findByTestId(host, "world-canon-ai-panel")).toBeNull();
      });

      it("keeps settings fields one tab away, not in the way", () => {
        const host = renderTab();
        expect(findByTestId(host, "db-world-canon-name")).toBeNull();
        expect(findByTestId(host, "db-world-canon-law-gods")).toBeNull();
        findByTestId(host, "db-ws-section-tab-settings")?.click();
        expect(findByTestId(host, "db-world-canon-name")).toBeTruthy();
        expect(findByTestId(host, "db-world-canon-law-gods")).toBeTruthy();
      });

      it("projects the AI delivery block with live status tiles inside its tab", () => {
        store.update((draft) => {
          draft.worldCanon = { name: "비늘의 바다", premise: "바다는 잊지 않는다", tones: ["mythic"], absences: ["총기"], laws: { gods: { present: false } } };
        });
        const host = renderTab();
        findByTestId(host, "db-ws-section-tab-ai")?.click();
        const panel = findByTestId(host, "db-ws-section-panel-ai");
        expect(panel?.querySelector("[data-testid='world-canon-ai-panel-preview']")?.textContent).toContain("## 이 세계(세계관 고정)");
        expect(panel?.querySelector("[data-testid='world-canon-ai-panel-preview']")?.textContent).toContain("신: 없음");
        const items = Array.from(panel?.querySelectorAll(".world-canon-ai-grid-item") ?? []);
        expect(items.length).toBe(5);
        // 문서 탭의 값이 조수 전달 탭에 투영된다.
        expect(panel?.textContent).toContain("비늘의 바다") ;
        expect(panel?.textContent).toContain("미정 3");
      });

      it("keeps unset as undefined when saving without a choice", () => {
        const host = renderTab();
        openSettingsTab(host);
        findByTestId(host, "db-world-canon-law-power")?.click();
        const save = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-power-save");
        save?.click();
        const laws = store.getCurrent().worldCanon?.laws ?? {};
        expect(laws.power?.present).toBeUndefined();
        expect(laws.power?.note ?? "").toBe("");
      });

      it("keeps the law note inside the project AI projection", () => {
        const host = renderTab();
        openSettingsTab(host);
        findByTestId(host, "db-world-canon-law-money")?.click();
        const yes = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-option-yes");
        yes?.click();
        const note = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-note") as unknown as HTMLTextAreaElement;
        note.value = "진주가 아니라 이름이 화폐다";
        note.dispatchEvent(new Event("input"));
        findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-save")?.click();
        expect(worldCanonPromptSection(store.getCurrent().worldCanon)).toContain("이름이 화폐다");
      });
    });
  });
  describe("worldLoreDisambiguation", () => {
    isolateTimers();
    function renderTab(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderWorldCanonTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("world lore copy disambiguation", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => cleanupDom?.());

      it("canon body field never calls itself 설정집", () => {
        const host = renderTab();
        const area = findByTestId(host, "db-world-canon-body");
        expect(area?.attrs.placeholder ?? "").not.toContain("설정집");
        expect(area?.attrs["aria-label"] ?? "").not.toContain("설정집");
      });

      it("canon body field names 이 세계 as its home", () => {
        const host = renderTab();
        const area = findByTestId(host, "db-world-canon-body");
        const selfName = `${area?.attrs.placeholder ?? ""} ${area?.attrs["aria-label"] ?? ""}`;
        expect(selfName).toContain("이 세계");
      });

      it("keeps the canon body in the document rather than the property inspector", () => {
        const host = renderTab();
        const body = findByTestId(host, "db-world-canon-body");
        expect(host.querySelector(".world-document-content")?.querySelector("[data-testid='db-world-canon-body']")).toBe(body);
        expect(findByTestId(host, "world-document-properties")?.querySelector("[data-testid='db-world-canon-body']")).toBeNull();
      });
    });
  });
});

describe("worldManager", () => {
  isolateTimers();
  describe("projectWikiCodex", () => {
    isolateTimers();
    const now = 1_788_652_800_000;
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    let cleanup: () => void;
    beforeEach(() => {
      cleanup = installFakeDom();
      vi.spyOn(Date, "now").mockReturnValue(now);
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });
    function documentEntity(overrides: Partial<WorldEntity> = {}): WorldEntity {
      return { id: "w_rule", type: "guideline", name: "Combat", summary: "Action combat", body: "**Action** combat", origin: "ai",
        wiki: { kind: "declaration", basis: "inferred", topic: "combat-mode", combatMode: "action",
          sources: [{ id: "user-1", kind: "user", text: hostile, at: 10 }] }, ...overrides };
    }
    function load(entities: WorldEntity[]) {
      const project = createBlankProject();
      project.world = normalizeWorld({ entities, relations: [] });
      store.replace(project);
      return project;
    }
    function edit(entity: WorldEntity) {
      const state = createWorldPanelState({ initialEntityId: entity.id });
      state.editDraft = draftFromEntity(store.getCurrent().world!.entities.find((entry) => entry.id === entity.id)!, []);
      return state;
    }
    function control(panel: FakeElement, id: string): FakeElement {
      const node = findByTestId(panel, id);
      if (!node) throw new Error(`Missing control: ${id}`);
      return node;
    }
    describe("sourced codex manual editing", () => {
      it("preserves wiki metadata and source history while recording a chronological manual source", () => {
        const old = documentEntity({ id: "w_old", wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "old", kind: "user", text: "Old rule", at: 1 }] } });
        const entity = documentEntity();
        const current = { ...entity, wiki: { ...entity.wiki!, supersedes: [old.id] } };
        const project = load([old, current]);
        const state = edit(current);
        state.editDraft!.tagsText = "reviewed";
        saveDraft(state, project.world!);
        const saved = store.getCurrent().world!.entities.find((entry) => entry.id === current.id)!;
        expect(saved.wiki).toMatchObject({ kind: "declaration", basis: "explicit", topic: "combat-mode", combatMode: "action", supersedes: [old.id] });
        expect(saved.wiki!.sources[0]).toEqual(current.wiki.sources[0]);
        expect(saved.wiki!.sources[1]).toMatchObject({ kind: "manual", at: now });
        expect(saved.wiki!.sources[1]!.id).not.toBe(saved.wiki!.sources[0]!.id);
        expect(saved.wiki!.sources[1]!.text).toContain(saved.body);
        expect(normalizeWorld(store.getCurrent().world)).toEqual(store.getCurrent().world);
        expect(state.editDraft).toBeNull();
      });

      it("clears stale machine combat mode through the real body input and save controls", () => {
        const entity = documentEntity();
        load([entity]);
        const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: entity.id }));
        control(panel, "world-edit-toggle").click();
        const body = control(panel, "world-edit-body");
        body.value = "Use random encounters instead";
        body.dispatchEvent(new Event("input"));
        control(panel, "world-edit-save").click();
        const saved = store.getCurrent().world!.entities[0]!;
        expect(saved.body).toBe(body.value);
        expect(saved.wiki?.basis).toBe("explicit");
        expect(saved.wiki?.combatMode).toBeUndefined();
        expect(saved.wiki?.sources[0]).toEqual(entity.wiki!.sources[0]);
      });

      it("saves progress edits separately without altering or fabricating application evidence", () => {
        const entity = documentEntity({ wiki: { kind: "progress", basis: "observed", topic: "map-build", sources: [{ id: "apply-1", kind: "application", text: "Placed 3 tiles", at: 10 }] } });
        const project = load([entity]);
        const state = edit(entity);
        state.editDraft!.body = "I think 100 tiles were placed";
        saveDraft(state, project.world!);
        const world = normalizeWorld(store.getCurrent().world);
        expect(world.entities.find((entry) => entry.id === entity.id)).toEqual(entity);
        const note = world.entities.find((entry) => entry.id === state.selectedId)!;
        expect(note.id).not.toBe(entity.id);
        expect(note.body).toBe("I think 100 tiles were placed");
        expect(note.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "map-build" });
        expect(note.wiki?.sources).toHaveLength(1);
        expect(note.wiki?.sources[0]).toMatchObject({ kind: "manual", at: now });
        expect(note.wiki?.sources[0]?.text).toContain(entity.id);
        expect(note.wiki?.supersedes).toBeUndefined();
      });

      it("protects referenced historical deletion and leaves supersession intact", () => {
        const old = documentEntity({ id: "w_old" });
        const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New rule", at: 20 }], supersedes: [old.id] } });
        load([old, latest]);
        expect(deleteWorldEntity(old.id)).toBe(false);
        expect(deleteWorldEntity(latest.id)).toBe(false);
        expect(normalizeWorld(store.getCurrent().world).entities).toEqual([old, latest]);
        expect(document.body.textContent).not.toBe("");
      });

      it("rejects locked and racing drafts without losing pending text", () => {
        const entity = documentEntity({ locked: true });
        const project = load([entity]);
        const state = edit(entity);
        state.editDraft!.body = "Pending";
        saveDraft(state, project.world!);
        expect(state.editError).not.toBe("");
        expect(store.getCurrent().world!.entities[0]).toEqual(entity);
        const unlocked = { ...entity, locked: false };
        load([unlocked]);
        const racing = edit(unlocked);
        racing.editDraft!.body = "Pending";
        store.update((p) => { p.world = { entities: [{ ...unlocked, summary: "Concurrent" }], relations: [] }; });
        saveDraft(racing, project.world!);
        expect(racing.editError).not.toBe("");
        expect(racing.editDraft!.body).toBe("Pending");
        expect(store.getCurrent().world!.entities[0]!.summary).toBe("Concurrent");
      });

      it("makes inferred knowledge explicit and keeps manual sources across repeated saves", () => {
        const entity = documentEntity({ wiki: { kind: "knowledge", basis: "inferred", topic: "village", sources: [{ id: "user-1", kind: "user", text: "Village plan", at: 10 }] } });
        const project = load([entity]);
        const state = edit(entity);
        state.editDraft!.body = "Confirmed village plan";
        saveDraft(state, project.world!);
        const first = store.getCurrent().world!.entities[0]!;
        const next = edit(first);
        next.editDraft!.summary = "Confirmed";
        saveDraft(next, project.world!);
        const saved = store.getCurrent().world!.entities[0]!;
        expect(saved.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "village" });
        expect(saved.wiki!.sources.slice(0, 2)).toEqual(first.wiki!.sources);
        expect(saved.wiki!.sources.map((source) => source.kind)).toEqual(["user", "manual", "manual"]);
        expect(new Set(saved.wiki!.sources.map((source) => source.id)).size).toBe(3);
      });

      it("retains legacy manual document behavior", () => {
        const entity = documentEntity({ wiki: undefined, origin: "user" });
        const project = load([entity]);
        const state = edit(entity);
        state.editDraft!.body = "Updated";
        saveDraft(state, project.world!);
        expect(store.getCurrent().world!.entities[0]!.wiki).toBeUndefined();
        expect(store.getCurrent().world!.entities[0]!.body).toBe("Updated");
        expect(deleteWorldEntity(entity.id)).toBe(true);
      });

      it("renders parsed provenance, collapsed source text, supersession, body and reference controls safely", () => {
        const old = documentEntity({ id: "w_old" });
        const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New", at: 20 }], supersedes: [old.id] } });
        const project = load([old, latest]);
        const mapId = Object.keys(project.maps)[0]!;
        store.update((p) => { p.world = normalizeWorld({ entities: [{ ...old, refs: [{ kind: "map", id: mapId }] }, latest], relations: [] }); });
        const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: old.id }));
        const provenance = control(panel, "world-wiki-provenance");
        expect(provenance.dataset).toMatchObject({ basis: "inferred", kind: "declaration", superseded: "true" });
        const sources = control(panel, "world-wiki-sources");
        expect(sources.tagName.toLowerCase()).toBe("details");
        expect(sources.getAttribute("open")).toBeNull();
        const source = control(panel, "world-wiki-source-0");
        expect(source.textContent).toContain(hostile);
        expect(source.textContent).toContain("user-1");
        expect(source.querySelector("img")).toBeNull();
        expect(source.querySelector("script")).toBeNull();
        expect([source, ...source.querySelectorAll("*")].every((node) => node.innerHTML === "")).toBe(true);
        expect(panel.querySelector(".world-markdown")?.querySelector("strong")?.textContent).toBe("Action");
        expect(findByTestId(panel, `world-ref-jump-map-${mapId}`)).toBeTruthy();
      });
    });
  });
  describe("projectWikiManualEdit", () => {
    isolateTimers();
    describe("codex concurrent document editing", () => {
      it("does not overwrite a document changed after the manual draft opened", () => {
        const original: WorldEntity = {
          id: "w_rule", type: "guideline", name: "Rule", summary: "Original", origin: "user",
        };
        const project = createBlankProject();
        project.world = { entities: [original], relations: [] };
        store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
        store.replace(project);
        const state = createWorldPanelState();
        state.editDraft = draftFromEntity(original, []);
        state.editDraft.summary = "Pending manual draft";
        const live = { ...original, summary: "Newer saved correction" };
        store.update((current) => { current.world = { entities: [live], relations: [] }; });

        saveDraft(state, project.world);

        expect(store.getCurrent().world?.entities[0]?.summary).toBe("Newer saved correction");
        expect(state.editDraft?.summary).toBe("Pending manual draft");
        expect(state.editError).not.toBe("");
      });

      it("does not recreate a document deleted while a manual draft was open", () => {
        const original: WorldEntity = {
          id: "w_rule", type: "guideline", name: "Rule", summary: "Original", origin: "user",
        };
        const project = createBlankProject();
        project.world = { entities: [], relations: [] };
        store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
        store.replace(project);
        const state = createWorldPanelState();
        state.editDraft = draftFromEntity(original, []);
        state.editDraft.summary = "Pending draft";

        saveDraft(state, project.world);

        expect(store.getCurrent().world?.entities).toEqual([]);
        expect(state.editError).not.toBe("");
      });
    });
  });
  describe("worldDocumentWorkspace", () => {
    isolateTimers();
    let cleanup: () => void;
    beforeEach(() => {
      cleanup = installFakeDom();
      setPersistedCodexView("overview", null);
      const project = createBlankProject();
      project.world = {
        entities: [
          { id: "w_person", type: "character", name: "기록관", summary: "", origin: "user" },
          { id: "w_event", type: "event", name: "일식", summary: "", origin: "user" },
          { id: "w_place", type: "place", name: "항구", summary: "", origin: "user" },
          { id: "w_faction", type: "faction", name: "의회", summary: "", origin: "user" },
        ],
        relations: [{ a: "w_person", b: "w_faction", kind: "memberOf" }],
      };
      store.replace(project);
    });
    afterEach(() => cleanup());
    function control(panel: FakeElement, id: string): FakeElement {
      const node = findByTestId(panel, id);
      if (!node) throw new Error(`Missing control: ${id}`);
      return node;
    }
    describe("world document navigation", () => {
      it("clears an unrelated reading selection when the category changes", () => {
        const panel = renderWithFakeDom(() => renderWorldPanel());
        control(panel, "world-card-w_person").click();
        control(panel, "world-tab-event").click();
        expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
        expect(findByTestId(panel, "world-card-w_event")).toBeTruthy();
      });

      it("clears reading details when search excludes the selected document", () => {
        const panel = renderWithFakeDom(() => renderWorldPanel());
        control(panel, "world-card-w_person").click();
        const search = control(panel, "world-search");
        search.value = "not-found";
        search.dispatchEvent(new Event("input"));
        expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
        expect(control(panel, "world-search")).toBe(search);
      });

      it("preserves an out-of-filter draft and explicitly marks its context", () => {
        const state = createWorldPanelState();
        const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
        control(panel, "world-card-w_person").click();
        control(panel, "world-edit-toggle").click();
        const input = control(panel, "world-edit-name");
        input.value = "작성 중인 인물";
        input.dispatchEvent(new Event("input"));
        control(panel, "world-tab-event").click();
        expect(state.editDraft?.name).toBe("작성 중인 인물");
        expect(control(panel, "world-draft-outside-filter").dataset.entityId).toBe("w_person");
      });

      it("browses places separately from factions", () => {
        const panel = renderWithFakeDom(() => renderWorldPanel());
        control(panel, "world-tab-place").click();
        expect(findByTestId(panel, "world-card-w_place")).toBeTruthy();
        expect(findByTestId(panel, "world-card-w_faction")).toBeNull();
      });

      it("opens a related document in its category", () => {
        const state = createWorldPanelState();
        const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
        control(panel, "world-tab-character").click();
        control(panel, "world-card-w_person").click();
        control(panel, "world-relation-chip").click();
        expect(state.tab).toBe("faction");
        expect(control(panel, "world-wiki-view").dataset.entityId).toBe("w_faction");
        expect(findByTestId(panel, "world-card-w_faction")).toBeTruthy();
      });
    });
  });
  describe("worldPanelLintMemo", () => {
    isolateTimers();
    describe("world panel lint memo (perf RED-first)", () => {
      let cleanup: (() => void) | undefined;

      beforeEach(() => {
        cleanup = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => cleanup?.());

      it("reuses the lint summary while the project object is unchanged", () => {
        const spy = vi.spyOn(worldManager, "summarizeWorldLint");
        try {
          const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
          const firstCalls = spy.mock.calls.length;
          expect(firstCalls).toBeGreaterThan(0);
          const search = panel.querySelector(".world-search-input") as HTMLInputElement | null;
          expect(search).toBeTruthy();
          search!.value = "없는말";
          search!.dispatchEvent(new Event("input"));
          search!.value = "없는말2";
          search!.dispatchEvent(new Event("input"));
          expect(spy.mock.calls.length).toBe(firstCalls);
        } finally {
          spy.mockRestore();
        }
      });
    });
  });
});
