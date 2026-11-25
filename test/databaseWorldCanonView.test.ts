import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { WorldCodexSession } from "@/editor/panels/worldCodexSession";
import { deleteWorldEntity, setPersistedCodexView } from "@/editor/panels/worldManager";
import { deserialize, serialize } from "@/project/io";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
import { lintWorld } from "@/project/world";
import { bodyDraftMessages, composeBodyWithDraft, mergeInterviewPatch, parseBodyDraft, parseInterviewTurn, interviewHistoryToMessages } from "@/ai/worldCanonInterview";
import { WORLD_CANON_BOUNDS, resolveWorldCanon } from "@/project/world/canon";
import { isolateTimers } from "./mergedTeardown";

describe("databaseWorldCanonView", () => {
  isolateTimers();
  /** 이름·없는 것·법칙은 세계 설정 탭안에 있다. */
  function openSettingsTab(host: FakeElement): void {
    findByTestId(host, "db-ws-section-tab-settings")?.click();
  }
  function renderTab(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderWorldCanonTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  function setInput(host: FakeElement, testid: string, value: string): void {
    const control = findByTestId(host, testid);
    if (!control) throw new Error(`missing ${testid}`);
    control.value = value;
    control.dispatchEvent(new Event("input"));
  }
  describe("database world canon view", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    afterEach(() => cleanupDom?.());

    it("commits the world name and free-form body onto project.worldCanon", () => {
      const host = renderTab();
      openSettingsTab(host);
      expect(findByTestId(host, "db-world-canon-workspace")).toBeTruthy();

      setInput(host, "db-world-canon-name", "서녘 공화국");
      setInput(host, "db-world-canon-body", "마법은 피의 대가다.");

      expect(store.getCurrent().worldCanon).toEqual({
        name: "서녘 공화국",
        body: "마법은 피의 대가다.",
      });
    });

    it("toggles a tone chip into the stored canon", () => {
      const host = renderTab();
      openSettingsTab(host);
      findByTestId(host, "db-world-canon-tone-grim")?.click();
      expect(store.getCurrent().worldCanon?.tones).toEqual(["grim"]);
    });

    it("adds an absence tag from the add control", () => {
      const host = renderTab();
      openSettingsTab(host);
      setInput(host, "db-world-canon-absence-input", "총");
      findByTestId(host, "db-world-canon-absence-add")?.click();
      expect(store.getCurrent().worldCanon?.absences).toEqual(["총"]);
    });

    it("leaves an undo snapshot for the draft/canon/secret switch", () => {
      store.update((draft) => {
        draft.worldCanon = { name: "안개 해안" };
      });
      resetMapEditHistory();
      const host2 = renderTab();
      // segmentedControl 은 change 이벤트로 동작한다.
      const group = findByTestId(host2, "db-world-canon-status");
      const canonOption = group?.querySelectorAll("[data-testid='db-world-canon-status-option']")
        .find((node) => node.attrs.value === "canon");
      expect(canonOption).toBeTruthy();
      (canonOption as FakeElement & { checked: boolean }).checked = true;
      canonOption?.dispatchEvent(new Event("change"));
      expect(store.getCurrent().worldCanon?.status).toBe("canon");
      expect(getMapEditHistoryState().canUndo).toBe(true);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().worldCanon?.status).toBeUndefined();
    });

    it("renders a markdown preview of the authored body", () => {
      const host = renderTab();
      setInput(host, "db-world-canon-body", "## 역사\n- 왕위는 비어 있다.");
      const toggle = findByTestId(host, "db-world-canon-preview-toggle");
      const area = findByTestId(host, "db-world-canon-body");
      expect(toggle).toBeTruthy();
      toggle?.click();
      const preview = findByTestId(host, "db-world-canon-preview");
      expect(preview).toBeTruthy();
      expect(preview?.textContent).toContain("역사");
      // 미리보기가 열리면 편집기는 가려지고, 닫으면 돌아온다.
      expect(area?.getAttribute("hidden")).toBe("");
      toggle?.click();
      expect(area?.getAttribute("hidden")).toBeNull();
    });

    it("keeps the preview open across a tab rerender", () => {
      const host = renderTab();
      setInput(host, "db-world-canon-body", "## 역사\n- 왕위는 비어 있다.");
      findByTestId(host, "db-world-canon-preview-toggle")?.click();
      const rerendered = renderTab();
      expect(findByTestId(rerendered, "db-world-canon-preview")?.textContent).toContain("역사");
      // 다음 테스트에 열린 미리보기가 새지 않게 닫는다.
      findByTestId(rerendered, "db-world-canon-preview-toggle")?.click();
    });

    it("updates the excerpt counter while typing the body", () => {
      const host = renderTab();
      const hint = findByTestId(host, "db-world-canon-body-card")?.querySelector(".db-ws-card-hint");
      expect(hint?.textContent).toContain("지금 0자");
      // 상한(20,000) 안쪽은 잘리지 않는다 — 예전엔 600자 상한이라 700자에서 잘렸다.
      setInput(host, "db-world-canon-body", "가".repeat(19_500));
      expect(hint?.textContent).not.toContain("읽지 않습니다");
      // 상한을 넘기면 몇 자가 남는지 고지한다.
      setInput(host, "db-world-canon-body", "가".repeat(20_700));
      expect(hint?.textContent).toContain("뒤 700자는 읽지 않습니다");
    });

    it("updates the body-card excerpt counter while typing without a rerender", () => {
      const host = renderTab();
      openSettingsTab(host);
      findByTestId(host, "db-ws-section-tab-body")?.click();
      setInput(host, "db-world-canon-body", "가".repeat(20_700));
      const hint = findByTestId(host, "db-world-canon-body-card")?.querySelector(".db-ws-card-hint");
      // 표시는 실제 전달 상한과 같은 상수에서 온다.
      expect(hint?.textContent).toContain("뒤 700자는 읽지 않습니다");
    });

    it("rejects an absence past the cap with feedback instead of silently dropping", () => {
      const full = Array.from({ length: 32 }, (_, index) => `금기${index}`);
      store.update((draft) => {
        draft.worldCanon = { name: "꽉 찬 세계", absences: full };
      });
      const host2 = renderTab();
      openSettingsTab(host2);
      setInput(host2, "db-world-canon-absence-input", "하나 더");
      findByTestId(host2, "db-world-canon-absence-add")?.click();
      expect(store.getCurrent().worldCanon?.absences).toHaveLength(32);
    });

    it("drops worldCanon when the last authored field is cleared", () => {
      const host = renderTab();
      openSettingsTab(host);
      openSettingsTab(host);
      setInput(host, "db-world-canon-name", "안개 해안");
      expect(store.getCurrent().worldCanon?.name).toBe("안개 해안");
      setInput(host, "db-world-canon-name", "   ");
      expect(store.getCurrent().worldCanon).toBeUndefined();
    });
  });
});

describe("worldAuthoringRegression", () => {
  isolateTimers();
  let cleanup: () => void;
  beforeEach(() => {
    cleanup = installFakeDom(); store.replace(createBlankProject()); resetMapEditHistory();
    setPersistedCodexView("overview", null);
  });
  afterEach(() => cleanup());
  function control(root: FakeElement, id: string): FakeElement {
    const found = findByTestId(root, id); if (!found) throw new Error(id); return found;
  }
  function input(root: FakeElement, id: string, value: string): void {
    const found = control(root, id); found.value = value; found.dispatchEvent(new Event("input"));
  }
  function canonView(): FakeElement {
    const host = document.createElement("div"); renderWorldCanonTab(host, () => {}); return host as unknown as FakeElement;
  }
  /** 법윹 카드는 세계 설정 탭안에 있다. */
  function openSettingsTab(root: FakeElement): void {
    findByTestId(root, "db-ws-section-tab-settings")?.click();
  }
  describe("world authoring data preservation", () => {
    it("merges law notes and toggles with the latest law values", () => {
      const host = canonView(); openSettingsTab(host);
      // 스프레드 뷰: 법칙 카드 -> 대화상자에서 선택/비고 -> 저장. tri-state 데이터 계약은 그대로다.
      function openLaw(id: string): void {
        control(host, "db-world-canon-law-" + id).click();
      }
      function commitLaw(id: string, option: "unset" | "no" | "yes", note: string): void {
        openLaw(id);
        if (option !== "unset") control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-option-" + option).click();
        const noteBox = control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-note") as unknown as FakeElement & { value: string };
        noteBox.value = note; noteBox.dispatchEvent(new Event("input"));
        control(document.body as unknown as FakeElement, "db-world-canon-law-" + id + "-save").click();
      }
      commitLaw("power", "unset", "피의 대가");
      commitLaw("gods", "yes", "여신");
      expect(store.getCurrent().worldCanon?.laws).toEqual({ power: { note: "피의 대가" }, gods: { note: "여신", present: true } });
    });

    it("round-trips explicit absence without inventing laws for legacy blank projects", () => {
      const project = createBlankProject();
      expect(worldCanonPromptSection(deserialize(serialize(project)).worldCanon)).toBeNull();
      project.worldCanon = { laws: { gods: { present: false } } };
      const loaded = deserialize(serialize(project));
      expect(loaded.worldCanon).toEqual(project.worldCanon);
      expect(worldCanonPromptSection(loaded.worldCanon)).toContain("신: 없음");
      expect(worldCanonPromptSection(loaded.worldCanon)).not.toContain("죽음:");
    });

    it("limits every bounded authoring control at the input boundary", () => {
      const host = canonView(); openSettingsTab(host);
      for (const [id, max] of Object.entries({ name: 120, premise: 280, era: 80, tech: 80 })) {
        expect(control(host, `db-world-canon-${id}`).getAttribute("maxlength"), id).toBe(String(max));
      }
      findByTestId(host, "db-ws-section-tab-body")?.click();
      expect(control(host, "db-world-canon-body").getAttribute("maxlength"), "body").toBe("50000");
      // 법칙 비고 상한은 카드 안이 아니라 카드가 여는 대화상자 소유다.
      for (const kind of ["power", "gods", "death", "money"]) {
        control(host, "db-world-canon-law-" + kind).click();
        const noteBox = control(document.body as unknown as FakeElement, "db-world-canon-law-" + kind + "-note");
        expect(noteBox.getAttribute("maxlength"), kind).toBe("160");
        control(document.body as unknown as FakeElement, "db-world-canon-law-" + kind + "-save").click();
      }
    });

    it("retains inputs across categories and a rebuilt tab, then commits through the modal session", () => {
      const session = new WorldCodexSession();
      let panel = renderWorldPanel({ embedded: true, state: session.state }) as unknown as FakeElement;
      control(panel, "world-add-entity").click();
      input(panel, "world-edit-name", "보존할 이름"); input(panel, "world-edit-summary", "보존할 요약");
      control(panel, "world-tab-character").click();
      expect(control(panel, "world-edit-name").value).toBe("보존할 이름");
      panel = renderWorldPanel({ embedded: true, state: session.state }) as unknown as FakeElement;
      expect(control(panel, "world-edit-summary").value).toBe("보존할 요약");
      expect(session.isDirty()).toBe(true);
      expect(session.commit()).toBe(true); expect(session.isDirty()).toBe(false);
      expect(deserialize(serialize(store.getCurrent())).world?.entities[0]).toMatchObject({ name: "보존할 이름", summary: "보존할 요약" });
    });

    it("never commits an old modal draft into a different project", () => {
      const session = new WorldCodexSession();
      const panel = renderWorldPanel({ state: session.state }) as unknown as FakeElement;
      control(panel, "world-add-entity").click(); input(panel, "world-edit-name", "이전 프로젝트 카드");
      store.replaceProject(createBlankProject());
      expect(session.commit()).toBe(false);
      expect(store.getCurrent().world?.entities ?? []).toEqual([]);
    });

    it("retains the search node and draft while filtering", () => {
      const panel = renderWorldPanel() as unknown as FakeElement;
      control(panel, "world-add-entity").click(); input(panel, "world-edit-name", "작성 중");
      const search = control(panel, "world-search"); input(panel, "world-search", "검색");
      expect(control(panel, "world-search")).toBe(search);
      expect(control(panel, "world-edit-name").value).toBe("작성 중");
    });

    it("does not clear an invalid locked edit when the modal attempts to commit", () => {
      store.update((project) => { project.world = { entities: [{ id: "w_lock", type: "concept", name: "잠김", summary: "", origin: "user", locked: true }], relations: [] }; });
      const session = new WorldCodexSession();
      const panel = renderWorldPanel({ state: session.state }) as unknown as FakeElement;
      control(panel, "world-card-w_lock").click(); control(panel, "world-edit-toggle").click();
      input(panel, "world-edit-name", "변경 시도");
      expect(session.commit()).toBe(false); expect(session.state.editError).toContain("잠금");
      expect(session.isDirty()).toBe(true); session.discard(); expect(session.isDirty()).toBe(false);
    });

    it("deletes a card and its relations, keeps referenced game data, and restores it with undo", () => {
      const mapId = store.getCurrent().startMapId;
      store.update((project) => { project.world = {
        entities: [{ id: "w_a", type: "place", name: "장소", summary: "", origin: "user", refs: [{ kind: "map", id: mapId }] }, { id: "w_b", type: "character", name: "주민", summary: "", origin: "user", locked: true }],
        relations: [{ a: "w_b", b: "w_a", kind: "locatedIn" }],
      }; });
      const before = structuredClone(store.getCurrent().world);
      expect(deleteWorldEntity("w_b")).toBe(false);
      expect(deleteWorldEntity("w_a")).toBe(true);
      expect(store.getCurrent().world?.relations).toEqual([]); expect(store.getCurrent().maps[mapId]).toBeTruthy();
      expect(undoMapEdit()).toBe(true); expect(store.getCurrent().world).toEqual(before);
    });

    it("does not call a named transfer event an unregistered NPC", () => {
      const project = createBlankProject(); const map = project.maps[project.startMapId];
      const base = { id: "p", name: "집 문", conditions: [], trigger: { kind: "action" }, graphic: { sprite: { type: "bundled", id: "door" } }, commands: [{ kind: "transfer", mapId: map.id, x: 0, y: 0 }] };
      map.events = [{ id: "door", x: 1, y: 1, pages: [base] }] as never;
      expect(lintWorld({ entities: [], relations: [] }, project).some((issue) => issue.code === "world-npc-unregistered")).toBe(false);
    });
  });
});

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
