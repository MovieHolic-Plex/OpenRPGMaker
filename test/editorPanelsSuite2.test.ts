// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { store } from "@/project/store";
import { getMapEditHistoryState, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import { chooseKind, cleanupAudioManager, control, row, setupAudioManager, writeDraft } from "./helpers/audioDescriptionManager";
import { AUDIO_PREVIEW_DEFAULTS, AudioPreviewSession, type AudioPreviewState } from "@/editor/panels/audioPreviewSession";
import { audioPreviewTime } from "@/editor/panels/audioPreviewPlayer";
import { installPreviewMedia, mediaMetadata, previewMedia } from "./support/previewMedia";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { BATTLE_HIT_FEEL_IDS, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";
import { isolateTimers } from "./mergedTeardown";

describe("audioDescriptionEditor", () => {
  isolateTimers();
  beforeEach(setupAudioManager);
  afterEach(cleanupAudioManager);
  const resource = { kind: "music", resourceId: "audio-a" } as const;
  describe("audio description manager", () => {
    it("owns history shortcuts while the resource modal is open", () => {
      chooseKind("music");

      expect(historyHotkeyOwnedByPanel()).toBe(true);
    });

    it("releases history shortcut ownership when the resource modal closes", () => {
      chooseKind("music");

      control("resource-modal-close").click();

      expect(historyHotkeyOwnedByPanel()).toBe(false);
    });

    it("renders an editable description when the visible music category is selected", () => {
      // Given: the existing resource modal.
      // When:
      chooseKind("music");
      // Then: behavioral baseline RED, not a missing-module failure.
      expect(document.querySelectorAll('[data-testid="audio-description-input"]').length).toBe(1);
    });

    it.each(["music", "sound"] as const)("enumerates the complete %s catalog without mutations", kind => {
      // Given:
      const before = structuredClone(store.getCurrent());
      const expected = listAudioResources(kind, before).map(item => item.id).sort();
      // When:
      chooseKind(kind);
      // Then:
      const actual = [...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
        .map(node => node.dataset.resourceId).sort();
      expect(actual).toEqual(expected);
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });

    it("commits normalized input once when Save is activated", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      writeDraft("  <b>author sentinel</b>\nsecond line  ");
      const changes: { readonly scope: string; readonly origin?: string; readonly label?: string }[] = [];
      const unsubscribe = store.subscribe((_project, change) => changes.push(change));
      // When:
      control("audio-description-save").click();
      unsubscribe();
      // Then:
      expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource))
        .toBe("<b>author sentinel</b>\nsecond line");
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ scope: "project", origin: "human" });
      expect(Boolean(changes[0]?.label)).toBe(true);
      expect(control("resource-modal").querySelector("b")).toBeNull();
      expect(control("audio-description-source").dataset.source).toBe("project");
    });

    it("retains a saved description when the manager is reopened", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      writeDraft("reopen sentinel");
      control("audio-description-save").click();
      control("resource-modal-close").click();
      // When:
      openResourceModal();
      chooseKind("music");
      row(resource.resourceId).click();
      // Then:
      expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("reopen sentinel");
    });

    it("stores an explicit clear when an empty draft is saved", () => {
      // Given:
      chooseKind("music");
      const builtin = listAudioResources("music", store.getCurrent()).find(item => item.description.length > 0);
      if (!builtin) throw new Error("Expected a described bundled resource");
      row(builtin.id).click();
      writeDraft("");
      // When:
      control("audio-description-save").click();
      // Then:
      expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, {
        kind: "music", resourceId: builtin.id,
      })).toBe("");
      expect(control("audio-description-source").dataset.source).toBe("project");
    });

    it("removes only the selected override when Restore default is activated", () => {
      // Given:
      store.update(project => {
        project.audioDescriptions = { music: { "audio-a": "", "audio-b": "keep sibling" } };
      });
      chooseKind("music");
      row(resource.resourceId).click();
      resetMapEditHistory();
      // When:
      control("audio-description-reset").click();
      // Then:
      expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
      expect(store.getCurrent().audioDescriptions?.music?.["audio-b"]).toBe("keep sibling");
      expect(control("audio-description-source").dataset.source).toBe("missing");
    });

    it("restores the prior override when project Undo runs", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      writeDraft("undo sentinel");
      control("audio-description-save").click();
      // When:
      expect(undoMapEdit()).toBe(true);
      // Then:
      expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
      expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("");
    });

    it("restores the authored override when project Redo runs", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      writeDraft("redo sentinel");
      control("audio-description-save").click();
      undoMapEdit();
      // When:
      expect(redoMapEdit()).toBe(true);
      // Then:
      expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("redo sentinel");
    });

    it("retains draft DOM, caret and focus during an unrelated store rerender", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      const input = writeDraft("draft stays here");
      input.setSelectionRange(3, 8);
      // When:
      store.update(project => {
        project.audioDescriptions = { music: { "audio-b": "external update" } };
      }, { scope: "project", label: "fixture update" });
      // Then:
      expect(control("audio-description-input")).toBe(input);
      expect(input.value).toBe("draft stays here");
      expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
      expect(document.activeElement).toBe(input);
    });

    it("finds a resource by description without changing the project", () => {
      store.update(project => {
        project.audioDescriptions = { music: { "audio-a": "SEARCH_SENTINEL_20260906" } };
      });
      chooseKind("music");
      const before = structuredClone(store.getCurrent());
      const search = control<HTMLInputElement>("audio-description-search");

      search.value = "SEARCH_SENTINEL_20260906";
      search.dispatchEvent(new Event("input", { bubbles: true }));

      expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
        .map(node => node.dataset.resourceId)).toEqual(["audio-a"]);
      expect(store.getCurrent()).toEqual(before);
    });

    it("filters effective empty descriptions without changing the current draft", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      const input = writeDraft("unsaved");
      const before = structuredClone(store.getCurrent());
      const expected = listAudioResources("music", before)
        .filter(item => item.description.trim().length === 0).map(item => item.id).sort();
      // When:
      const filter = control<HTMLInputElement>("audio-description-missing-filter");
      filter.checked = true;
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      // Then:
      expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
        .map(node => node.dataset.resourceId).sort()).toEqual(expected);
      expect(control("audio-description-input")).toBe(input);
      expect(input.value).toBe("unsaved");
      expect(store.getCurrent()).toEqual(before);
    });

    it("rejects an over-limit programmatic draft without recording history", () => {
      // Given:
      chooseKind("music");
      row(resource.resourceId).click();
      writeDraft("x".repeat(4001));
      const before = structuredClone(store.getCurrent());
      // When:
      control("audio-description-save").click();
      // Then:
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      expect(control<HTMLTextAreaElement>("audio-description-input").value).toHaveLength(4001);
    });
  });
});

describe("audioPreviewSession", () => {
  isolateTimers();
  const sessions: AudioPreviewSession[] = [];
  function fixture() {
    const host = document.createElement("div");
    document.body.append(host);
    const session = new AudioPreviewSession(host);
    sessions.push(session);
    const states: AudioPreviewState[] = [];
    session.subscribe(state => states.push(state));
    session.select("/fixture.wav");
    return { session, host, media: previewMedia(host), state: () => states.at(-1), states };
  }
  beforeEach(() => { installPreviewMedia(); });
  afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  describe("editor preview media lifecycle", () => {
    it("does not infer playing from selection or a fulfilled play promise", async () => {
      const f = fixture();
      expect(f.state()?.phase).toBe("ready");
      await f.session.play();
      expect(f.state()?.phase).toBe("loading");
      f.media.dispatchEvent(new Event("playing"));
      expect(f.state()?.phase).toBe("playing");
    });
    it("keeps metadata loading distinct from a requested play", () => {
      const f = fixture();
      f.media.dispatchEvent(new Event("loadstart"));
      expect(f.state()).toMatchObject({ phase: "loading", requested: false });
    });
    it("reports a rejected play and permits retry", async () => {
      const f = fixture();
      vi.mocked(f.media.play).mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
      await f.session.play();
      expect(f.state()).toMatchObject({ phase: "error", error: "blocked" });
      await f.session.play();
      f.media.dispatchEvent(new Event("playing"));
      expect(f.state()?.phase).toBe("playing");
    });
    it("ignores rejected play and events from a replaced source", async () => {
      const f = fixture();
      let reject: (reason: Error) => void = () => { throw new Error("play request not installed"); };
      vi.mocked(f.media.play).mockImplementationOnce(() => new Promise((_resolve, rejectPlay) => { reject = rejectPlay; }));
      const pending = f.session.play();
      f.session.select("/replacement.wav");
      reject(new Error("late rejection"));
      await pending;
      for (const name of ["playing", "ended", "error", "loadedmetadata"]) f.media.dispatchEvent(new Event(name));
      expect(f.state()).toMatchObject({ phase: "ready", current: 0, error: "" });
      expect(f.media.hasAttribute("src")).toBe(false);
    });
    it("pauses without rewinding and resumes from the same position", async () => {
      const f = fixture();
      await f.session.play(); f.media.dispatchEvent(new Event("playing"));
      f.media.currentTime = 8;
      f.session.pause();
      expect(f.state()?.phase).toBe("paused");
      await f.session.play();
      expect(f.media.currentTime).toBe(8);
    });
    it("stops immediately and ignores late canplay or playing", async () => {
      const f = fixture();
      await f.session.play();
      f.media.currentTime = 5;
      f.session.stop();
      f.media.dispatchEvent(new Event("canplay")); f.media.dispatchEvent(new Event("playing"));
      expect(f.state()).toMatchObject({ phase: "stopped", current: 0 });
      expect(f.media.paused).toBe(true);
    });
    it("replays an ended sound immediately", async () => {
      const f = fixture();
      mediaMetadata(f.media, 0.18);
      await f.session.play();
      f.media.currentTime = 0.18; f.media.dispatchEvent(new Event("ended"));
      expect(f.state()?.phase).toBe("ended");
      await f.session.play();
      expect(f.media.currentTime).toBe(0);
      f.media.dispatchEvent(new Event("playing"));
      expect(f.state()?.phase).toBe("playing");
    });
    it("seeks only with a finite known duration and keeps an ended seek position", () => {
      const f = fixture();
      mediaMetadata(f.media, Infinity); f.session.seek(3);
      expect(f.media.currentTime).toBe(0);
      mediaMetadata(f.media, 10); f.session.seek(12);
      expect(f.media.currentTime).toBe(10);
      f.media.dispatchEvent(new Event("ended")); f.session.seek(3);
      expect(f.state()).toMatchObject({ phase: "paused", current: 3, duration: 10 });
    });
    it("makes buffering and decode errors observable", async () => {
      const f = fixture();
      await f.session.play(); f.media.dispatchEvent(new Event("playing"));
      f.media.dispatchEvent(new Event("waiting"));
      expect(f.state()?.phase).toBe("loading");
      f.media.dispatchEvent(new Event("error"));
      expect(f.state()?.phase).toBe("error");
      expect(f.state()?.error.length).toBeGreaterThan(0);
    });
    it("keeps a failed selected source failed during metadata refresh", () => {
      const f = fixture(); f.media.dispatchEvent(new Event("error"));
      f.session.select("/fixture.wav");
      expect(f.state()?.phase).toBe("error");
    });
    it("allows only the latest editor session to play", async () => {
      const a = fixture(); const b = fixture();
      await a.session.play(); a.media.dispatchEvent(new Event("playing"));
      await b.session.play(); b.media.dispatchEvent(new Event("playing"));
      expect(a.media.paused).toBe(true);
      expect(a.state()?.phase).toBe("stopped");
      expect(b.state()?.phase).toBe("playing");
    });
    it("releases source and listeners on disposal", async () => {
      const f = fixture(); await f.session.play();
      f.session.dispose(); const count = f.states.length;
      f.media.dispatchEvent(new Event("error")); f.media.dispatchEvent(new Event("playing"));
      expect(f.states).toHaveLength(count);
      expect(f.host.querySelector("audio")).toBeNull();
      expect(f.media.hasAttribute("src")).toBe(false);
      expect(f.media.paused).toBe(true);
    });
    it("keeps cross-origin playback native until pan is requested", () => {
      const f = fixture(); f.session.select("https://audio.example/no-cors.mp3");
      expect(previewMedia(f.host).hasAttribute("crossorigin")).toBe(false);
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
      expect(previewMedia(f.host).crossOrigin).toBe("anonymous");
    });
    it("applies volume, tempo and a media-position-driven fade without timers", async () => {
      const f = fixture();
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, volume: 40, tempo: 135, fade: 4 });
      await f.session.play();
      expect(f.media.volume).toBe(0); expect(f.media.playbackRate).toBe(1.35);
      f.media.currentTime = 2; f.media.dispatchEvent(new Event("timeupdate"));
      expect(f.media.volume).toBeCloseTo(0.2);
      f.media.currentTime = 4; f.media.dispatchEvent(new Event("timeupdate"));
      expect(f.media.volume).toBeCloseTo(0.4);
    });
    it.each([[0.18, "0:00.18"], [0, "0:00"], [84.636725, "1:24"], [null, "--:--"]] as const)("formats meaningful preview time %s", (seconds, expected) => {
      expect(audioPreviewTime(seconds)).toBe(expected);
    });
    it("preserves fade progress across a music loop, seek and pause", async () => {
      const f = fixture();
      f.session.select("/loop.wav", "", true);
      const media = previewMedia(f.host);
      mediaMetadata(media, 2);
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, fade: 4 });
      await f.session.play();
      media.currentTime = 1.5; media.dispatchEvent(new Event("timeupdate"));
      expect(media.volume).toBeCloseTo(0.375);
      media.currentTime = 0.5; media.dispatchEvent(new Event("timeupdate"));
      expect(media.loop).toBe(true); expect(media.volume).toBeCloseTo(0.625);
      f.session.seek(1.5); media.dispatchEvent(new Event("timeupdate"));
      expect(media.volume).toBeCloseTo(0.625);
      f.session.pause(); await f.session.play();
      media.currentTime = 1.75; media.dispatchEvent(new Event("timeupdate"));
      expect(media.volume).toBeCloseTo(0.6875);
    });
    it("connects real pan routing and disposes every WebAudio resource", async () => {
      const source = { connect: vi.fn(), disconnect: vi.fn() };
      const panner = { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
      const close = vi.fn().mockResolvedValue(undefined);
      const destination = {};
      const createSource = vi.fn(() => source);
      vi.stubGlobal("AudioContext", class {
        destination = destination;
        createMediaElementSource = createSource;
        createStereoPanner = () => panner;
        resume = () => Promise.resolve();
        close = close;
      });
      const f = fixture();
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
      await f.session.play();
      expect(createSource).toHaveBeenCalledWith(previewMedia(f.host));
      expect(source.connect).toHaveBeenCalledWith(panner);
      expect(panner.connect).toHaveBeenCalledWith(destination);
      expect(panner.pan.value).toBe(-0.4);
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: 80 });
      expect(panner.pan.value).toBe(0.8);
      f.session.dispose();
      expect(source.disconnect).toHaveBeenCalledOnce(); expect(panner.disconnect).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    });
    it("does not recreate a failed pan session after disposal", async () => {
      const f = fixture();
      f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
      previewMedia(f.host).dispatchEvent(new Event("error"));
      f.session.dispose();
      await f.session.play();
      expect(f.host.querySelector("audio")).toBeNull();
    });
  });
});

/**
 * 타격감 프리셋(2026-09-27): system.battleHitFeel = impact(기본·생략) | light | calm.
 * 저장 계약(기본 생략·무효값 → 기본), 자료집 시스템 탭 선택, AI set_project_settings, 런타임 DOM 층(아군 피격 흔들림 바닥 ·
 * 히트스톱 진동 · 베기 궤적)을 묶는다. 화면 증거는 output/combat-qa/hitfeel-*(player.html 프로브).
 */
describe("battleHitFeelPreset", () => {
  isolateTimers();
  describe("system.battleHitFeel — 저장 계약", () => {
    it("새 프로젝트는 묵직하게(impact)로 열리고 JSON 에 키가 없다", () => {
      const project = createBlankProject();
      expect(resolveBattleHitFeel(project.system.battleHitFeel)).toBe("impact");
      expect(serialize(project)).not.toContain("battleHitFeel");
    });

    it("light · calm 은 왕복을 보존하고 impact 는 생략된다", () => {
      for (const feel of ["light", "calm"] as const) {
        const project = createBlankProject();
        project.system.battleHitFeel = feel;
        const wire = serialize(project);
        expect(wire).toContain(`"battleHitFeel":"${feel}"`);
        expect(deserialize(wire).system.battleHitFeel).toBe(feel);
      }
      const base = createBlankProject();
      expect(normalizeSystemRecords({ ...base.system, battleHitFeel: "impact" }).battleHitFeel).toBeUndefined();
    });

    it("모르는 값은 기본으로 풀린다", () => {
      const obj = JSON.parse(serialize(createBlankProject()));
      obj.system.battleHitFeel = "wobbly";
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.system.battleHitFeel).toBeUndefined();
      expect(resolveBattleHitFeel(restored.system.battleHitFeel)).toBe("impact");
    });
  });
  // 타격감 선택은 시스템 탭에서 자료집 「전투 화면」 탭의 타격감 카드로 옮겨졌다(databaseBattleScreenTab.ts).
  describe("자료집 전투 화면 탭 — 타격감 선택", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function renderSystem(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderBattleScreenTab(host);
      return host;
    }

    function hitFeelSelect(host: HTMLElement): HTMLSelectElement {
      const select = host.querySelector<HTMLSelectElement>('[data-testid="db-field-system-battle-hit-feel"]');
      if (!select) throw new Error("타격감 선택이 없다");
      return select;
    }

    it("세 프리셋을 내놓고 기본은 묵직하게다", () => {
      const select = hitFeelSelect(renderSystem());
      expect([...select.options].map((option) => option.value)).toEqual([...BATTLE_HIT_FEEL_IDS]);
      expect(select.value).toBe("impact");
    });

    it("고르면 프로젝트에 저장되고, 기본으로 돌리면 키가 사라진다", () => {
      const host = renderSystem();
      const select = hitFeelSelect(host);
      select.value = "calm";
      select.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleHitFeel).toBe("calm");
      const again = hitFeelSelect(host);
      again.value = "impact";
      again.dispatchEvent(new Event("change"));
      expect("battleHitFeel" in store.getCurrent().system).toBe(false);
    });
  });
  describe("AI set_project_settings battle.hitFeel", () => {
    it("light 를 저장하고 impact 로 되돌리면 지운다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "light" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBe("light");
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "impact" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBeUndefined();
    });
  });
  describe("런타임 타격감 층", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("묵직하게는 아군 피격 흔들림을 최소 heavy 로 올리고, 다른 프리셋은 피해 비율 그대로 둔다", () => {
      expect(hurtShakeIntensity("impact", "graze")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "normal")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "crushing")).toBe("crushing");
      expect(hurtShakeIntensity("impact", undefined)).toBeUndefined();
      expect(hurtShakeIntensity("light", "graze")).toBe("graze");
      expect(hurtShakeIntensity("calm", "normal")).toBe("normal");
    });

    it("진동은 translate 로만 떨고 잦아들어 제자리로 돌아온다", () => {
      const sprite = document.createElement("img");
      const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
      sprite.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
        calls.push({ frames, options });
        return {} as Animation;
      }) as typeof sprite.animate;
      vibrateStruck(sprite, "normal");
      expect(calls).toHaveLength(1);
      const offsets = calls[0]!.frames.map((frame) => Number.parseFloat(String(frame.translate)));
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(0);
      expect(Math.abs(offsets[1]!)).toBeGreaterThan(Math.abs(offsets[offsets.length - 2]!));
      expect(offsets.some((value) => value < 0)).toBe(true);
      expect(calls[0]!.frames.every((frame) => frame.transform === undefined)).toBe(true);
    });

    it("베기 궤적은 적 노드에 붙었다가 스스로 사라진다", async () => {
      const enemy = document.createElement("button");
      enemy.className = "battle-enemy";
      document.body.append(enemy);
      spawnSlashTrail(enemy);
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, SWING_LEAD_MS + 260));
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).toBeNull();
    });
  });
});
