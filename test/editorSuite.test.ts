// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runActionCombatTest } from "@/editor/actionCombatRuntimeProbe";
import { applyPendingAiBootIntent, clearPendingAiBootIntent, clearWelcomeIntentBootFlags, peekPendingAiBootAutoSend, peekPendingAiBootDisplayText, peekPendingAiBootIntent, prefillAiAssistantInput, registerAiBootIntentTarget, setPendingAiBootIntent, setPendingWelcomePipeline, shouldSuppressCoachMarksForWelcomeIntent, wasWelcomeIntentAppliedThisBoot } from "@/editor/aiBootIntent";
import { historyHotkeyOwnedByPanel, isTextEditingFocus, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { bindMapSurfaceFocusHandoff } from "@/editor/mapSurfaceFocus";
import { applyBgmStatus, fetchBgmStatus, startBgmInstall, BGM_INSTALLED_EVENT, type BgmInstallStatus } from "@/editor/bgmInstallClient";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";
import { CameraScrollbars } from "@/editor/CameraScrollbars";
import { editorCameraBounds } from "@/editor/cameraFocusViewport";
import { shouldPresentEditorWelcome, setEditorWelcomeDismissed, EDITOR_WELCOME_DISMISSED_KEY } from "@/editor/editorWelcome";
import { editorSpriteScale, eventMarkerTileScale, renderEventMarkers } from "@/editor/editSceneEventMarkers";
import { eventAtPoint, eventBodyRect, eventCoversPoint, findEventCoveringPoint, overlappingEventPairs } from "@/project/eventFootprintQuery";
import { runtimeEventView } from "@/project/runtimeEventState";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import type { CharacterFootprint, EventPage, GameEvent, GameMap } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("actionProofUuidFallback", () => {
  isolateTimers();
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });
  function insecureActionProject() {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    project.maps[project.startMapId]!.actionCombat = true;
    return project;
  }
  describe("action proof run identity on insecure origins", () => {
    it("issues a run id without crypto.randomUUID (plain HTTP has no secure context)", async () => {
      const api = globalThis.crypto;
      const shim = Object.create(null);
      Object.assign(shim, api);
      vi.stubGlobal("crypto", shim as Crypto);
      expect("randomUUID" in (globalThis.crypto as object)).toBe(false);
      vi.stubGlobal("fetch", vi.fn(async () => new Response("no-player", { status: 404 })));
      const project = insecureActionProject();
      const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
      expect(receipt.status).toBe("unverified");
    });
  });
});

describe("aiBootIntent", () => {
  isolateTimers();
  beforeEach(() => {
    clearPendingAiBootIntent();
    clearWelcomeIntentBootFlags();
    registerAiBootIntentTarget(null);
  });
  describe("aiBootIntent", () => {
    it("stores pending intent and suppresses coach marks", () => {
      setPendingAiBootIntent("  포켓몬 같은 몬스터 수집  ");
      expect(peekPendingAiBootIntent()).toBe("포켓몬 같은 몬스터 수집");
      expect(peekPendingAiBootAutoSend()).toBe(false);
      expect(shouldSuppressCoachMarksForWelcomeIntent()).toBe(true);
    });

    it("applies open+prefill without send by default", () => {
      const open = vi.fn();
      const prefill = vi.fn();
      const send = vi.fn();
      registerAiBootIntentTarget({ open, prefill, send });
      setPendingAiBootIntent("스타듀 같은 농장 생활");
      expect(applyPendingAiBootIntent()).toBe(true);
      expect(open).toHaveBeenCalledOnce();
      expect(prefill).toHaveBeenCalledWith("스타듀 같은 농장 생활");
      expect(send).not.toHaveBeenCalled();
      expect(peekPendingAiBootIntent()).toBeNull();
      expect(wasWelcomeIntentAppliedThisBoot()).toBe(true);
      expect(applyPendingAiBootIntent()).toBe(false);
    });

    it("auto-sends when pipeline requests autoSend", () => {
      const open = vi.fn();
      const prefill = vi.fn();
      const send = vi.fn();
      registerAiBootIntentTarget({ open, prefill, send });
      setPendingWelcomePipeline({
        prompt: "장르 프리셋: 모험 JRPG",
        autoSend: true,
        replaceWithBlank: true,
        source: "chip",
        presetId: "adventure-jrpg",
      });
      expect(peekPendingAiBootAutoSend()).toBe(true);
      expect(applyPendingAiBootIntent()).toBe(true);
      expect(send).toHaveBeenCalledWith("장르 프리셋: 모험 JRPG");
      expect(prefill).not.toHaveBeenCalled();
    });

    it("carries the visible user sentence separately from the prompt sent to the model", () => {
      // Break: 보이는 문장이 핸드오프에서 빠지면 조수 말풍선이 「사용자 의도: …」 내부 지시문으로 뜬다.
      const open = vi.fn();
      const prefill = vi.fn();
      const send = vi.fn();
      registerAiBootIntentTarget({ open, prefill, send });
      setPendingWelcomePipeline({ prompt: "사용자 의도: 고양이 찾기\n\n한국어로 진행하고…", displayText: "고양이 찾기", autoSend: true, source: "free-text" });
      expect(peekPendingAiBootDisplayText()).toBe("고양이 찾기");
      expect(applyPendingAiBootIntent()).toBe(true);
      expect(send).toHaveBeenCalledWith("사용자 의도: 고양이 찾기\n\n한국어로 진행하고…", "고양이 찾기");
      expect(peekPendingAiBootDisplayText()).toBeNull();

      // AI 연결 전: 입력창에 담기는 쪽도 같은 두 문장을 받는다.
      setPendingAiBootIntent("장르 프리셋: 모험 JRPG\n체크리스트", { displayText: "모험 JRPG · 시작 마을" });
      expect(applyPendingAiBootIntent()).toBe(true);
      expect(prefill).toHaveBeenCalledWith("장르 프리셋: 모험 JRPG\n체크리스트", "모험 JRPG · 시작 마을");

      // 쓰던 초안은 두 문장 모두의 앞에 그대로 남는다.
      const draftPrefill = vi.fn();
      registerAiBootIntentTarget({ open, prefill: draftPrefill, getDraft: () => "내 메모" });
      expect(prefillAiAssistantInput("전체 지시", { preserveDraft: true, displayText: "요약" })).toBe(true);
      expect(draftPrefill).toHaveBeenCalledWith("내 메모\n\n전체 지시", "내 메모\n\n요약");
    });

    it("prefillAiAssistantInput never sends and requires target", () => {
      expect(prefillAiAssistantInput("x")).toBe(false);
      const open = vi.fn();
      const prefill = vi.fn();
      registerAiBootIntentTarget({ open, prefill });
      expect(prefillAiAssistantInput("모험 JRPG")).toBe(true);
      expect(prefill).toHaveBeenCalledWith("모험 JRPG");
    });

    it("appends an unsent handoff without overwriting existing draft bytes", () => {
      // Given: a mounted composer with unfinished user instructions and a send hook.
      let draft = "  original instructions\n";
      const send = vi.fn();
      const open = vi.fn();
      registerAiBootIntentTarget({ open, getDraft: () => draft, prefill: text => { draft = text; }, send });
      // When: a diagnostic is explicitly prepared with draft preservation.
      expect(prefillAiAssistantInput("UNSENT", { preserveDraft: true })).toBe(true);
      // Then: both blocks remain editable and no turn was sent.
      expect(draft).toBe("  original instructions\n\n\nUNSENT");
      expect(send).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledOnce();
    });

    it("refuses preserving handoff when the target cannot read its draft", () => {
      const prefill = vi.fn();
      registerAiBootIntentTarget({ open: vi.fn(), prefill });
      expect(prefillAiAssistantInput("UNSENT", { preserveDraft: true })).toBe(false);
      expect(prefill).not.toHaveBeenCalled();
    });
    it("does not auto-apply on register (focus order owned by finishEditorBoot)", () => {
      setPendingAiBootIntent("대기", { autoSend: true });
      const open = vi.fn();
      const prefill = vi.fn();
      const send = vi.fn();
      registerAiBootIntentTarget({ open, prefill, send });
      expect(open).not.toHaveBeenCalled();
      expect(peekPendingAiBootIntent()).toBe("대기");
      applyPendingAiBootIntent();
      expect(send).toHaveBeenCalledWith("대기");
    });
  });
});

describe("aiConversationNavigation", () => {
  isolateTimers();
  const navigationKeys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "PageDown", "PageUp", "Home", "End", " "];
  function keyAt(target: HTMLElement, key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    return event;
  }
  describe("conversation navigation ownership", () => {
    let conversation: HTMLDivElement;
    beforeEach(() => {
      conversation = document.createElement("div");
      conversation.tabIndex = 0;
      conversation.dataset.editorNavigationOwner = "true";
      document.body.append(conversation);
    });
    afterEach(() => document.body.replaceChildren());

    it.each(navigationKeys)("leaves native %s on the conversation region", (key) => {
      conversation.focus();
      const event = keyAt(conversation, key);
      expect(shouldIgnoreEditorShortcut(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    });

    it.each(["button", "a", "summary", "span"])("also yields navigation from a %s descendant", (tag) => {
      const wrapper = document.createElement("div");
      const child = document.createElement(tag);
      wrapper.append(child);
      conversation.append(wrapper);
      for (const key of navigationKeys) expect(shouldIgnoreEditorShortcut(keyAt(child, key))).toBe(true);
    });

    it("retains modified navigation, including fast arrows and document endpoints", () => {
      for (const modifiers of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        for (const key of navigationKeys) expect(shouldIgnoreEditorShortcut(keyAt(conversation, key, modifiers))).toBe(true);
      }
    });

    it("does not disable unrelated editor commands or take history ownership", () => {
      for (const key of ["1", "F6", "+", "Delete", "Escape", "s", "z", "y"]) {
        expect(shouldIgnoreEditorShortcut(keyAt(conversation, key))).toBe(false);
        expect(shouldIgnoreEditorShortcut(keyAt(conversation, key, { ctrlKey: true }))).toBe(false);
      }
      expect(historyHotkeyOwnedByPanel()).toBe(false);
      expect(isTextEditingFocus(keyAt(conversation, "z", { ctrlKey: true }))).toBe(false);
    });

    it("leaves canvas and unrelated regions navigable even while the conversation is mounted", () => {
      const canvas = document.createElement("canvas");
      const region = document.createElement("div");
      region.setAttribute("role", "region");
      document.body.append(canvas, region);
      for (const key of navigationKeys) {
        expect(shouldIgnoreEditorShortcut(keyAt(canvas, key))).toBe(false);
        expect(shouldIgnoreEditorShortcut(keyAt(region, key))).toBe(false);
      }
      conversation.dataset.editorNavigationOwner = "false";
      expect(shouldIgnoreEditorShortcut(keyAt(conversation, "ArrowDown"))).toBe(false);
    });

    it.each(["region", "descendant"])("hands %s focus directly to a clicked canvas without synthetic history keys", (owner) => {
      const button = document.createElement("button");
      conversation.append(button);
      const focused = owner === "region" ? conversation : button;
      const host = document.createElement("div");
      const canvas = document.createElement("canvas");
      host.append(canvas);
      document.body.append(host);
      bindMapSurfaceFocusHandoff(host);
      focused.focus();
      expect(document.activeElement).toBe(focused);
      const keyboardEvent = vi.fn();
      document.addEventListener("keydown", keyboardEvent);
      document.addEventListener("keyup", keyboardEvent);
      try {
        canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        expect(keyboardEvent).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(document.body);
        expect(shouldIgnoreEditorShortcut(keyAt(document.body, "ArrowDown"))).toBe(false);
        expect(historyHotkeyOwnedByPanel()).toBe(false);
      } finally {
        document.removeEventListener("keydown", keyboardEvent);
        document.removeEventListener("keyup", keyboardEvent);
      }
    });

    it("keeps unrelated button focus when the map is clicked", () => {
      const button = document.createElement("button");
      const host = document.createElement("div");
      document.body.append(button, host);
      bindMapSurfaceFocusHandoff(host);
      button.focus();
      host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      expect(document.activeElement).toBe(button);
    });

    it.each(["input", "textarea", "select"])("preserves %s shortcut and native text-history guards", (tag) => {
      const field = document.createElement(tag);
      conversation.append(field);
      for (const key of ["ArrowDown", "1", "s", "z", "y"]) {
        const event = keyAt(field, key, { ctrlKey: true });
        expect(shouldIgnoreEditorShortcut(event)).toBe(true);
        expect(isTextEditingFocus(event)).toBe(true);
      }
    });
  });
});

describe("bgmInstallClient", () => {
  isolateTimers();
  const status = (over: Partial<BgmInstallStatus> = {}): BgmInstallStatus => ({
    expected: 281, installed: ["x.mp3"], installing: false,
    stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over,
  });
  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), { status: 200, ...init, headers: { "Content-Type": "application/json" } });
  afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); });
  it("status 를 적용하면 판정이 갱신되고 완료 이벤트가 뜬다", () => {
    const seen: string[] = [];
    const listener = () => seen.push("fired");
    window.addEventListener(BGM_INSTALLED_EVENT, listener);
    try {
      applyBgmStatus(status());
      expect(isBgmFileInstalled("x.mp3")).toBe(true);
      expect(isBgmFileInstalled("other.mp3")).toBe(false);
      expect(seen).toEqual(["fired"]);
    } finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
  });
  it("설치 중 status 는 적용하되 완료 이벤트는 내지 않는다", () => {
    const seen: string[] = [];
    const listener = () => seen.push("fired");
    window.addEventListener(BGM_INSTALLED_EVENT, listener);
    try {
      applyBgmStatus(status({ installing: true }));
      expect(seen).toEqual([]);
    } finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
  });
  it("엔드포인트가 없는 배포 환경에서는 null 을 주고 조용히 넘어간다", async () => {
    // 정적 배포는 SPA 폴백 HTML 을 200 으로 준다 — 상태 코드로는 구분할 수 없다.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>", {
      status: 200, headers: { "Content-Type": "text/html" } })));
    expect(await fetchBgmStatus()).toBeNull();
  });
  it("네트워크가 끊겨도 예외를 던지지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection refused"); }));
    expect(await fetchBgmStatus()).toBeNull();
  });
  it("정상 status 는 그대로 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(status({ installed: ["a.mp3", "b.mp3"] }))));
    expect((await fetchBgmStatus())?.installed).toEqual(["a.mp3", "b.mp3"]);
  });
  it("403 은 사용자에게 보여줄 이유를 담아 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "원격 접속에서는 opt-in 이 필요합니다." }, { status: 403 })));
    const result = await startBgmInstall();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/opt-in/);
  });
  it("202 는 성공으로 본다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ started: true }, { status: 202 })));
    expect(await startBgmInstall()).toEqual({ ok: true, error: null });
  });
});

describe("cameraScrollbars", () => {
  isolateTimers();
  afterEach(() => document.body.replaceChildren());
  const area = {
    canvas: { x: 300, y: 100, width: 1000, height: 700 },
    unoccluded: { x: 300, y: 100, width: 600, height: 500 },
    worldView: { x: 250, y: 200, width: 500, height: 350 },
    zoom: 2,
  };
  describe("native camera scrollbar projection", () => {
    it("mounts two named keyboard scroll regions with proportional content and position", () => {
      const pan = vi.fn();
      const bars = new CameraScrollbars(document.body, pan);
      bars.sync(area, 1600, 1200);
      const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
      const y = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-y"]')!;
      expect(x.getAttribute("role")).toBe("region");
      expect(x.tabIndex).toBe(0);
      expect(y.tabIndex).toBe(0);
      expect(x.children.length).toBe(1);
      expect(y.children.length).toBe(1);
      // Track length is the canvas edge (1000-16 / 700-16); the thumb still reports
      // the unobstructed span, so every metric scales by track/visible.
      expect(parseFloat((x.firstElementChild as HTMLElement).style.width)).toBeCloseTo((3200 + 600 + 64) * 984 / 600);
      expect(x.scrollLeft).toBeCloseTo((500 + 300 + 32) * 984 / 600);
      expect(y.scrollTop).toBeCloseTo((400 + 250 + 32) * 684 / 500);
      x.dispatchEvent(new Event("scroll"));
      expect(pan).not.toHaveBeenCalled();
      bars.destroy();
      expect(document.body.childElementCount).toBe(0);
    });

    it("pins both tracks to the canvas edge, so opening the assistant never moves them", () => {
      const bars = new CameraScrollbars(document.body, vi.fn());
      const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
      const y = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-y"]')!;

      // Assistant open: the deck crops a right-hand column out of the visible area.
      bars.sync(area, 1600, 1200);
      const boxed = (node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height];
      const open = [boxed(x), boxed(y)];
      expect(open).toEqual([
        ["0px", "684px", "984px", "16px"],
        ["984px", "0px", "16px", "684px"],
      ]);

      // Assistant collapsed: the whole canvas is visible again. The tracks hold still.
      bars.sync({ ...area, unoccluded: area.canvas }, 1600, 1200);
      expect([boxed(x), boxed(y)]).toEqual(open);
      bars.destroy();
    });

    it.each([
      { width: 1120, height: 700 },
      { width: 1000, height: 820 },
    ])("reprojects canvas-only resize to $width x $height without changing the visible world", dimensions => {
      const pan = vi.fn();
      const bars = new CameraScrollbars(document.body, pan);
      bars.sync(area, 1600, 1200);
      const resized = { ...area, canvas: { ...area.canvas, ...dimensions } };
      // Keep both view objects, their origins and zoom unchanged: canvas size alone
      // must invalidate the projection even when assistant occlusion holds steady.
      bars.sync(resized, 1600, 1200);
      const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
      const y = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-y"]')!;
      expect(x.style.top).toBe(`${dimensions.height - 16}px`);
      expect(x.style.width).toBe(`${dimensions.width - 16}px`);
      expect(y.style.left).toBe(`${dimensions.width - 16}px`);
      expect(y.style.height).toBe(`${dimensions.height - 16}px`);
      for (const [node, span, track, content, position, horizontal] of [
        [x, 600, dimensions.width - 16, 3864, 832, true],
        [y, 500, dimensions.height - 16, 2964, 682, false],
      ] as const) {
        const ratio = track / span;
        const spacer = node.firstElementChild as HTMLElement;
        const key = horizontal ? "scrollLeft" : "scrollTop";
        expect(Number(node.dataset.trackRatio)).toBeCloseTo(ratio);
        expect(parseFloat(horizontal ? spacer.style.width : spacer.style.height)).toBeCloseTo(content * ratio);
        expect(node[key]).toBeCloseTo(position * ratio);
        node.dispatchEvent(new Event("scroll"));
        expect(pan).not.toHaveBeenCalled();
        node[key] += 80;
        const pending = node[key];
        bars.sync(resized, 1600, 1200);
        expect(node[key]).toBe(pending);
        node.dispatchEvent(new Event("scroll"));
        expect(pan).toHaveBeenCalledExactlyOnceWith(horizontal ? 80 / 2 / ratio : 0, horizontal ? 0 : 80 / 2 / ratio);
        node.dispatchEvent(new Event("scroll"));
        expect(pan).toHaveBeenCalledTimes(1);
        pan.mockClear();
      }
      bars.destroy();
    });

    it("does not erase native input before its scroll event; converts track pixels once", () => {
      const pan = vi.fn();
      const bars = new CameraScrollbars(document.body, pan);
      bars.sync(area, 1600, 1200);
      const x = document.querySelector<HTMLElement>('[data-testid="editor-camera-scroll-x"]')!;
      x.scrollLeft += 80;
      const pending = x.scrollLeft;
      bars.sync(area, 1600, 1200);
      expect(x.scrollLeft).toBe(pending);
      x.dispatchEvent(new Event("scroll"));
      expect(pan).toHaveBeenCalledExactlyOnceWith(80 / 2 / (984 / 600), 0);
      x.dispatchEvent(new Event("scroll"));
      expect(pan).toHaveBeenCalledTimes(1);
    });

    it("derives asymmetric map bounds that let both edges reach the visible center", () => {
      const bounds = editorCameraBounds({ ...area, mapWidth: 1600, mapHeight: 1200 });
      expect(bounds).toEqual({ x: -166, y: -141, width: 2132, height: 1582 });
      // Camera's minimum world-view X is bounds.x; at either limit its visible
      // center is 32 CSS pixels beyond the map, irrespective of overlay width.
      expect(bounds.x + area.unoccluded.width / 2 / area.zoom).toBe(-16);
      expect(bounds.x + bounds.width - area.canvas.width / area.zoom + area.unoccluded.width / 2 / area.zoom).toBe(1616);
    });
  });
});

describe("editorWelcomeBootGate", () => {
  isolateTimers();
  /**
   * Orchestration contract for finishEditorBoot without mounting Phaser:
   * cold gate matrix + D7 guest-then-prefill order + coach suppress.
   */
  describe("editor welcome boot gate orchestration", () => {
    beforeEach(() => {
      clearPendingAiBootIntent();
      clearWelcomeIntentBootFlags();
      registerAiBootIntentTarget(null);
      try {
        localStorage.removeItem(EDITOR_WELCOME_DISMISSED_KEY);
      } catch {
        /* ignore */
      }
    });

    it("cold boot presents only when unmounted, not dismissed, not automation", () => {
      expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false })).toBe(true);
      expect(shouldPresentEditorWelcome({ modeShellMounted: true, dismissed: false, automation: false })).toBe(false);
      expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: true, automation: false })).toBe(false);
      expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: true })).toBe(false);
    });

    it("re-entry path clears pending so recovery does not prefill stale intent", () => {
      setPendingAiBootIntent("stale");
      // finishEditorBoot re-entry: modeMounted true → clearPending
      clearPendingAiBootIntent();
      expect(peekPendingAiBootIntent()).toBeNull();
      expect(applyPendingAiBootIntent()).toBe(false);
    });

    it("D7 order: identity can run before applyPending; apply opens+prefills last", () => {
      const order: string[] = [];
      registerAiBootIntentTarget({
        open: () => order.push("open"),
        prefill: (text) => order.push(`prefill:${text}`),
      });
      setPendingAiBootIntent("포켓몬 같은 몬스터 수집");
      expect(shouldSuppressCoachMarksForWelcomeIntent()).toBe(true);

      // Simulate finishEditorBoot intent branch:
      order.push("guest-identity");
      applyPendingAiBootIntent();
      expect(order).toEqual(["guest-identity", "open", "prefill:포켓몬 같은 몬스터 수집"]);
      expect(peekPendingAiBootIntent()).toBeNull();
    });

    it("dismissed storage prevents cold presentation", () => {
      setEditorWelcomeDismissed(true);
      expect(shouldPresentEditorWelcome({ modeShellMounted: false, automation: false })).toBe(false);
    });
  });
});

// 편집 맵과 내장 플레이어가 이벤트를 **몸 사각**으로 다루는지 — 2차 스펙 §5.
//
// 판별력 규칙: 프로브는 앵커 칸을 겨냥하지 않는다. 앵커는 1x1 이어도 같은 결과라
// 아무것도 증명하지 않는다.
describe("editSceneEventFootprint", () => {
  isolateTimers();
  function page(overrides: Partial<EventPage> = {}): EventPage {
    return {
      id: "p1",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
      ...overrides,
    };
  }
  function event(
    id: string,
    x: number,
    y: number,
    footprint?: CharacterFootprint,
    extra: Partial<EventPage> = {}
  ): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [page({ footprint, ...extra })],
    };
  }
  function mapWith(events: readonly GameEvent[]): GameMap {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    return { ...map, events: [...events] };
  }
  describe("eventBodyRect — 발자국은 첫 페이지에서 읽는다", () => {
    it("발자국 없는 이벤트는 앵커 한 칸이다(항등)", () => {
      expect(eventBodyRect(event("e", 5, 7))).toEqual({ left: 5, right: 5, top: 7, bottom: 7 });
    });

    it("3x3 은 발밑에서 위로 자란다", () => {
      expect(eventBodyRect(event("e", 5, 7, { width: 3, height: 3 })))
        .toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
    });

    it("짝수 폭은 앵커가 중앙 왼쪽이다", () => {
      expect(eventBodyRect(event("e", 5, 7, { width: 2, height: 2 })))
        .toEqual({ left: 5, right: 6, top: 6, bottom: 7 });
    });
  });
  describe("findEventCoveringPoint — 비앵커 칸 클릭이 선택으로 잡힌다", () => {
    const golem = event("golem", 5, 7, { width: 3, height: 3 });
    const events = [golem];

    it("상체 칸을 클릭해도 같은 이벤트다 — 앵커 점 비교는 여기서 빈 칸이라 답했다", () => {
      for (const [x, y] of [[4, 5], [5, 5], [6, 5], [4, 6], [6, 6], [4, 7], [6, 7]] as const) {
        expect(findEventCoveringPoint(events, x, y)?.id).toBe("golem");
      }
    });

    it("몸 사각 밖은 잡히지 않는다", () => {
      for (const [x, y] of [[3, 6], [7, 6], [5, 4], [5, 8]] as const) {
        expect(findEventCoveringPoint(events, x, y)).toBeUndefined();
      }
    });

    it("발자국 없는 이벤트는 앵커 한 칸만 잡는다(항등)", () => {
      const plain = [event("plain", 2, 3)];
      expect(findEventCoveringPoint(plain, 2, 3)?.id).toBe("plain");
      expect(findEventCoveringPoint(plain, 3, 3)).toBeUndefined();
      expect(findEventCoveringPoint(plain, 2, 2)).toBeUndefined();
    });

    it("겹치면 배열 순서가 이긴다 — 2차에서 규칙을 바꾸지 않고 명문화만 한다", () => {
      const first = event("first", 5, 7, { width: 3, height: 3 });
      const second = event("second", 5, 6, { width: 3, height: 3 });
      expect(findEventCoveringPoint([first, second], 4, 6)?.id).toBe("first");
      expect(findEventCoveringPoint([second, first], 4, 6)?.id).toBe("second");
    });

    it("eventAtPoint 는 맵의 정적 목록에 대한 래퍼다", () => {
      const map = mapWith([golem]);
      expect(eventAtPoint(map, 6, 5)?.id).toBe("golem");
      expect(eventAtPoint(map, 7, 5)).toBeUndefined();
    });

    it("eventCoversPoint 는 단일 이벤트 판정이다", () => {
      expect(eventCoversPoint(golem, 4, 5)).toBe(true);
      expect(eventCoversPoint(golem, 3, 5)).toBe(false);
    });
  });
  describe("overlappingEventPairs — 앵커 키로는 못 잡던 겹침", () => {
    it("앵커가 다른데 몸이 겹치는 두 이벤트를 잡는다", () => {
      // 앵커 문자열 키(`x,y`)는 5,7 과 5,6 을 서로 다르다고 본다 — 그래서 못 잡았다.
      const pairs = overlappingEventPairs([
        event("a", 5, 7, { width: 3, height: 3 }),
        event("b", 5, 6, { width: 3, height: 3 }),
      ]);
      expect(pairs).toHaveLength(1);
      expect([pairs[0]?.a.id, pairs[0]?.b.id]).toEqual(["a", "b"]);
    });

    it("몸이 안 닿으면 쌍이 없다", () => {
      expect(overlappingEventPairs([
        event("a", 2, 7, { width: 3, height: 3 }),
        event("b", 8, 7, { width: 3, height: 3 }),
      ])).toHaveLength(0);
    });

    it("발자국 없는 이벤트끼리는 같은 칸일 때만 겹친다(항등)", () => {
      expect(overlappingEventPairs([event("a", 4, 4), event("b", 5, 4)])).toHaveLength(0);
      expect(overlappingEventPairs([event("a", 4, 4), event("b", 4, 4)])).toHaveLength(1);
    });
  });
  describe("editorSpriteScale — 배율이 있으면 실제 크기", () => {
    it("배율 없는 그림은 예전처럼 한 칸으로 축소한다", () => {
      expect(editorSpriteScale(undefined, 24, 32)).toBe(eventMarkerTileScale(24, 32));
      expect(editorSpriteScale({}, 24, 32)).toBe(eventMarkerTileScale(24, 32));
    });

    it("배율이 있으면 그 값을 그대로 쓴다 — 타일에 맞춰 줄이지 않는다", () => {
      expect(editorSpriteScale({ scale: 3 }, 24, 32)).toBe(3);
      expect(editorSpriteScale({ scale: 0.5 }, 24, 32)).toBe(0.5);
    });

    it("비정규 배율은 1 로 굳는다", () => {
      expect(editorSpriteScale({ scale: Number.NaN }, 24, 32)).toBe(1);
    });
  });
  type FakeRect = {
    readonly kind: "rectangle";
    x: number;
    y: number;
    width: number;
    height: number;
    originX: number;
    originY: number;
    strokeColor: number | null;
    data: Record<string, unknown>;
  };
  type FakeImage = {
    readonly kind: "image";
    x: number;
    y: number;
    width: number;
    height: number;
    originX: number;
    originY: number;
    scale: number;
  };
  type FakeObject = FakeRect | FakeImage | { readonly kind: "other" };
  function fakeMarkerScene(): { scene: unknown; layer: { add(o: FakeObject): void }; objects: FakeObject[] } {
    const objects: FakeObject[] = [];
    const scene = {
      cameras: { main: { zoom: 1 } },
      add: {
        rectangle(x: number, y: number, width: number, height: number): FakeRect {
          const rect: FakeRect = {
            kind: "rectangle",
            x,
            y,
            width,
            height,
            originX: 0.5,
            originY: 0.5,
            strokeColor: null,
            data: {},
          };
          return Object.assign(rect, {
            setOrigin(ox: number, oy: number) {
              rect.originX = ox;
              rect.originY = oy;
              return rect;
            },
            setStrokeStyle(_w: number, color: number) {
              rect.strokeColor = color;
              return rect;
            },
            setData(key: string, value: unknown) {
              rect.data[key] = value;
              return rect;
            },
          });
        },
        image(x: number, y: number): FakeImage {
          const image: FakeImage = {
            kind: "image",
            x,
            y,
            width: 24,
            height: 32,
            originX: 0.5,
            originY: 0.5,
            scale: 1,
          };
          return Object.assign(image, {
            setOrigin(ox: number, oy: number) {
              image.originX = ox;
              image.originY = oy;
              return image;
            },
            setScale(value: number) {
              image.scale = value;
              return image;
            },
          });
        },
        container() {
          return { add() {}, setAlpha() {} };
        },
        circle() {
          return { setStrokeStyle() {} };
        },
        text() {
          return { setOrigin() { return {}; } };
        },
      },
    };
    const layer = { add: (o: FakeObject) => objects.push(o) };
    return { scene, layer, objects };
  }
  function renderMarkers(events: readonly GameEvent[], tileSize = 16): FakeObject[] {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [...events];
    project.maps[mapId]!.tileSize = tileSize;
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
    const { scene, layer, objects } = fakeMarkerScene();
    renderEventMarkers(
      {
        scene: scene as never,
        overlayLayer: layer as never,
      },
      store.getCurrent().maps[mapId]!,
      "event"
    );
    return objects;
  }
  describe("renderEventMarkers — 편집 맵에 몸 사각과 통행 행을 그린다", () => {
    const SPRITE = { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale: 3 } as const;

    it("3x3 몸은 사각 오버레이 두 장을 낳는다 — 통행 음영과 몸 외곽선", () => {
      const objects = renderMarkers([
        event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 1 }),
      ]);
      const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
      const bodyRect = rects.find((r) => r.data.testid === "event-body-rect");
      expect(bodyRect).toBeTruthy();
      // 몸 사각: 왼쪽 4, 위 5 에서 3x3 타일.
      expect([bodyRect?.x, bodyRect?.y, bodyRect?.width, bodyRect?.height]).toEqual([64, 80, 48, 48]);
      expect([bodyRect?.originX, bodyRect?.originY]).toEqual([0, 0]);
      // 통행 음영은 하단 한 행만 — 48x16.
      const pass = rects.find((r) => r.data.testid === undefined && r.height === 16);
      expect([pass?.x, pass?.y, pass?.width]).toEqual([64, 112, 48]);
    });

    it("통행 행이 몸 높이와 같으면 음영이 몸 사각을 다 덮는다", () => {
      const objects = renderMarkers([
        event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 3 }),
      ]);
      const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
      const pass = rects.find((r) => r.data.testid === undefined);
      expect([pass?.width, pass?.height]).toEqual([48, 48]);
    });

    it("발자국 없는 이벤트는 예전 한 칸 마커 그대로다(항등)", () => {
      const objects = renderMarkers([event("plain", 5, 7)]);
      const rects = objects.filter((o): o is FakeRect => o.kind === "rectangle");
      expect(rects).toHaveLength(1);
      // TILE_SIZE - 4 = 12, 중앙 원점 — 1차와 같은 마커다.
      expect([rects[0]?.width, rects[0]?.height, rects[0]?.originX]).toEqual([12, 12, 0.5]);
      expect(rects[0]?.data.testid).toBeUndefined();
    });

    it.each([[16, 1], [32, 1], [48, 2]])("%ipx 맵의 자동 캐릭터는 런타임과 같은 발밑 위치·%i배로 표시된다", (tileSize, scale) => {
      const objects = renderMarkers([
        event("plain", 5, 7, undefined, { graphic: { sprite: SPRITE.sprite } }),
      ], tileSize);
      const image = objects.find((o): o is FakeImage => o.kind === "image");
      expect([image?.x, image?.y]).toEqual([5.5 * tileSize, 8 * tileSize]);
      expect([image?.originX, image?.originY]).toEqual([0.5, 1]);
      expect(image?.scale).toBe(scale);
    });

    it("1x1 이라도 배율을 지정하면 발밑 기준 실제 크기로 바뀐다", () => {
      const objects = renderMarkers([
        event("scaled", 5, 7, undefined, { graphic: { sprite: SPRITE.sprite, scale: 2 } }),
      ]);
      const image = objects.find((o): o is FakeImage => o.kind === "image");
      expect([image?.x, image?.y, image?.scale]).toEqual([88, 128, 2]);
      expect(image?.originY).toBe(1);
    });

    it("스프라이트를 실제 배율로 몸 사각 발밑 중앙에 세운다", () => {
      const objects = renderMarkers([
        event("golem", 5, 7, { width: 3, height: 3 }, { passRows: 1, graphic: SPRITE }),
      ]);
      const image = objects.find((o): o is FakeImage => o.kind === "image");
      expect(image).toBeTruthy();
      expect(image?.scale).toBe(3);
      // 앵커 칸(5,7) 의 가로 중앙 = 5*16+8 = 88, 발밑 = (7+1)*16 = 128.
      expect([image?.x, image?.y]).toEqual([88, 128]);
      expect([image?.originX, image?.originY]).toEqual([0.5, 1]);
    });

    it("몸 사각이 겹친 이벤트는 외곽선 색이 다르다(저작 시점 경고)", () => {
      const objects = renderMarkers([
        event("a", 5, 7, { width: 3, height: 3 }),
        event("b", 5, 6, { width: 3, height: 3 }),
      ]);
      const warned = objects.filter(
        (o): o is FakeRect => o.kind === "rectangle" && o.data.testid === "event-body-overlap"
      );
      expect(warned).toHaveLength(2);
    });

    it("겹치지 않으면 경고 외곽선이 없다", () => {
      const objects = renderMarkers([
        event("a", 2, 7, { width: 3, height: 3 }),
        event("b", 8, 7, { width: 3, height: 3 }),
      ]);
      expect(objects.some((o) => o.kind === "rectangle" && o.data.testid === "event-body-overlap")).toBe(false);
    });
  });
  describe("내장 플레이어 마커 — 클릭 히트박스가 몸 사각이다", () => {
    function marker(footprint?: CharacterFootprint): HTMLElement {
      const host = document.createElement("div");
      host.style.width = "320px";
      host.style.height = "240px";
      document.body.append(host);
      // 마커는 export-QA 부트에서만 존재한다(`instrumented`). 플래그 없이 만들면
      // `upsertEventMarker` 가 조용히 반환해 히트박스를 관측할 대상 자체가 없다.
      const overlay = new RuntimeDomOverlay(() => host, { qaInstrumentation: true });
      const source = event("golem", 5, 7, footprint);
      overlay.upsertEventMarker(runtimeEventView(source, {}, {}));
      const found = host.querySelector<HTMLElement>("[data-testid='event-golem']");
      if (!found) throw new Error("marker missing");
      return found;
    }

    it("3x3 은 48x48 히트박스가 되고 위치도 몸 사각 좌상단이다", () => {
      const element = marker({ width: 3, height: 3 });
      expect(element.style.width).toBe("48px");
      expect(element.style.height).toBe("48px");
      // 몸 사각 좌상단 (4,5) → 64,80 px.
      expect(element.dataset.mapX).toBe("64");
      expect(element.dataset.mapY).toBe("80");
    });

    it("발자국 없는 이벤트는 한 칸 그대로다(항등)", () => {
      const element = marker();
      expect(element.style.width).toBe("16px");
      expect(element.dataset.mapX).toBe("80");
      expect(element.dataset.mapY).toBe("112");
    });
  });
});
